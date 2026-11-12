import schemaJson from "./generated/sat-xsd.json"

type SchemaNode = { tag: string; name?: string; type?: string; base?: string; value?: string; minOccurs?: string; maxOccurs?: string; children?: SchemaNode[] }
type Schema = { file: string; root: SchemaNode; types: Record<string, SchemaNode> }
type XmlNode = { name: string; text: string; children: XmlNode[] }
const schemas = schemaJson as unknown as Record<string, Schema>

// Only human-readable types whose SAT XSD restricts capitalization may be
// normalized. Never touch wallet addresses, hashes, account IDs or references.
const humanTextType = /^(?:nombre(?:_banco|_institucion)?|denominacion_razon|correo_electronico|direccion_\d+-\d+|descripcion_\d+-\d+|descripcion_activo_virtual)_type$/

/** Output-only case conversion, scoped by the exact official XSD type/path.
 * Captured cells remain unchanged. A candidate is used only if it satisfies
 * every restriction of that type; invalid punctuation/accents are not erased.
 */
export function normalizeGeneratedSatXmlText(xml: string): string {
  try {
    const { root, namespace } = parseGeneratedXml(xml)
    const schema = schemas[namespace]
    if (!schema) return xml
    const changes = new Map<string, string>()
    const occurrences = new Map<string, number>()
    const elements = (definition: SchemaNode): SchemaNode[] => definition.tag === "element"
      ? [definition] : (definition.children || []).flatMap(elements)
    const accepts = (rules: SchemaNode[], value: string) => rules.every((rule) => {
      const length = Array.from(value).length
      if (rule.tag === "pattern") return new RegExp(`^(?:${rule.value})$`).test(value)
      if (rule.tag === "length") return length === Number(rule.value)
      if (rule.tag === "minLength") return length >= Number(rule.value)
      if (rule.tag === "maxLength") return length <= Number(rule.value)
      return false // Unsupported restrictions never authorize a transformation.
    })
    const visit = (node: XmlNode, definition: SchemaNode, path: string, depth: number) => {
      if (depth > 100 || node.name !== definition.name) return
      const occurrence = (occurrences.get(path) || 0) + 1
      occurrences.set(path, occurrence)
      const type = schema.types[definition.type || ""]
      if (type?.tag === "complexType") {
        const children = (type.children || []).flatMap(elements)
        for (const child of node.children) {
          const childDefinition = children.find((item) => item.name === child.name)
          if (childDefinition) visit(child, childDefinition, `${path}/${child.name}`, depth + 1)
        }
      } else if (type?.tag === "simpleType" && humanTextType.test(definition.type || "") && !node.children.length) {
        const rules = type.children?.find((item) => item.tag === "restriction")?.children || []
        const candidate = node.text.toUpperCase()
        if (candidate !== node.text && rules.length && !accepts(rules, node.text) && accepts(rules, candidate)) changes.set(`${path}#${occurrence}`, candidate)
      }
    }
    visit(root, schema.root, `/${root.name}`, 0)
    if (!changes.size) return xml
    const stack: Array<{ name: string; occurrence: number }> = []
    occurrences.clear()
    return xml.replace(/<[^>]+>|[^<]+/g, (token) => {
      if (/^<\//.test(token)) stack.pop()
      else if (/^<[a-z_]/i.test(token)) {
        const name=token.match(/^<([a-z_][\w.-]*)/i)![1]
        const path=`/${[...stack.map((item)=>item.name),name].join("/")}`
        const occurrence=(occurrences.get(path)||0)+1
        occurrences.set(path,occurrence)
        if(!/\/\s*>$/.test(token))stack.push({name,occurrence})
      }
      else if (!token.startsWith("<")) {
        const replacement = changes.get(`/${stack.map((item)=>item.name).join("/")}#${stack.at(-1)?.occurrence}`)
        if (replacement !== undefined) return replacement.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
      }
      return token
    })
  } catch { return xml } // The validator still reports malformed/unknown XML.
}

function decodeXml(text: string): string {
  if (/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/i.test(text)) throw new Error("Entidad XML no válida.")
  return text.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, entity: string) => {
    const predefined: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }
    return predefined[entity] ?? String.fromCodePoint(entity.startsWith("#x") ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)))
  })
}

/** Only accepts our generated, unprefixed XML. DTD/entities/external resolution are prohibited. */
function parseGeneratedXml(xml: string): { root: XmlNode; namespace: string } {
  if (xml.length > 10_000_000 || /<!DOCTYPE|<!ENTITY|<!\[CDATA\[/i.test(xml) || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(xml)) throw new Error("Construcción XML no permitida.")
  const source = xml.replace(/^\uFEFF/, "").replace(/^\s*<\?xml[^?]*\?>/, "").replace(/<!--[\s\S]*?-->/g, "").trim()
  const namespace = source.match(/^<archivo\s[^>]*\bxmlns="([^"]+)"/)?.[1] || ""
  const stack: XmlNode[] = []
  let root: XmlNode | undefined
  const parts = source.match(/<[^>]+>|[^<]+/g) || []
  for (const token of parts) {
    if (token.startsWith("</")) {
      const name = token.match(/^<\/([a-z_][\w.-]*)\s*>$/i)?.[1]
      if (!name || stack.pop()?.name !== name) throw new Error("Etiquetas XML no balanceadas.")
    } else if (token.startsWith("<")) {
      const match = token.match(/^<([a-z_][\w.-]*)([^>]*)>$/i)
      if (!match || (stack.length && !/^\s*\/?\s*$/.test(match[2]))) throw new Error("Nodo XML no permitido.")
      const node: XmlNode = { name: match[1], text: "", children: [] }
      if (stack.length) stack[stack.length - 1].children.push(node)
      else if (root) throw new Error("Más de una raíz XML.")
      else root = node
      if (!/\/\s*>$/.test(token)) stack.push(node)
    } else if (stack.length) stack[stack.length - 1].text += decodeXml(token)
    else if (token.trim()) throw new Error("Texto fuera del archivo XML.")
    if (stack.length > 100) throw new Error("Profundidad XML excesiva.")
  }
  if (!root || stack.length) throw new Error("Archivo XML incompleto.")
  return { root, namespace }
}

/** Checks all structure, choices, occurrence counts and restrictions in the cached SAT XSD subset.
 * This is a local validation, never an acknowledgment or acceptance by SAT.
 */
export function validateGeneratedSatXml(xml: string): { valid: boolean; errors: string[]; schemaFile?: string } {
  const errors: string[] = []
  try {
    const { root, namespace } = parseGeneratedXml(xml)
    const schema = schemas[namespace]
    if (!schema) return { valid: false, errors: ["No existe un XSD oficial verificado para esta salida."] }
    let steps = 0
    const add = (message: string) => { if (errors.length < 40) errors.push(message) }
    const canStart = (definition: SchemaNode, name?: string): boolean => definition.tag === "element"
      ? definition.name === name : Boolean(definition.children?.some((child) => canStart(child, name)))
    const nullable = (definition: SchemaNode): boolean => definition.minOccurs === "0" || (definition.tag === "sequence"
      ? Boolean(definition.children?.every(nullable)) : definition.tag === "choice" ? Boolean(definition.children?.some(nullable)) : false)
    const consume = (definition: SchemaNode, nodes: XmlNode[], start: number, path: string): number => {
      if (++steps > 200_000) throw new Error("Límite de validación XML excedido.")
      const min = Number(definition.minOccurs ?? 1), max = definition.maxOccurs === "unbounded" ? nodes.length + 1 : Number(definition.maxOccurs ?? 1)
      let cursor = start, count = 0
      while (count < max && canStart(definition, nodes[cursor]?.name)) {
        const before = cursor
        if (definition.tag === "element") {
          validateNode(nodes[cursor], definition, `${path}/${definition.name}`)
          cursor++
        } else if (definition.tag === "sequence") {
          for (const child of definition.children || []) cursor = consume(child, nodes, cursor, path)
        } else if (definition.tag === "choice") {
          const choice = definition.children?.find((child) => canStart(child, nodes[cursor]?.name))
          if (choice) cursor = consume(choice, nodes, cursor, path)
        } else throw new Error(`Componente XSD no soportado: ${definition.tag}`)
        count++
        if (cursor === before) break
      }
      if (count < min && !nullable(definition)) {
        const expected = definition.name || definition.children?.map((child) => child.name || child.tag).join(" / ")
        add(`${path}: falta ${expected}.`)
      }
      return cursor
    }
    const validateNode = (node: XmlNode, definition: SchemaNode, path: string) => {
      if (node.name !== definition.name) { add(`${path}: nodo incorrecto ${node.name}.`); return }
      const type = schema.types[definition.type || ""]
      if (!type) throw new Error(`Tipo XSD no resuelto: ${definition.type}`)
      if (type.tag === "complexType") {
        let cursor = 0
        for (const model of type.children || []) cursor = consume(model, node.children, cursor, path)
        if (cursor < node.children.length) add(`${path}: nodo fuera del formato ${node.children[cursor].name}.`)
        if (node.text.trim()) add(`${path}: no admite texto libre.`)
      } else if (type.tag === "simpleType") {
        if (node.children.length) add(`${path}: no admite nodos hijos.`)
        const restriction = type.children?.[0]
        if (restriction?.tag !== "restriction") throw new Error("Restricción XSD no soportada.")
        for (const rule of restriction.children || []) {
          const size = Array.from(node.text).length, value = Number(rule.value)
          let valid = true
          if (rule.tag === "length") valid = size === value
          else if (rule.tag === "minLength") valid = size >= value
          else if (rule.tag === "maxLength") valid = size <= value
          else if (rule.tag === "minInclusive") valid = Number(node.text) >= value
          else if (rule.tag === "pattern") valid = new RegExp(`^(?:${rule.value})$`).test(node.text)
          else throw new Error(`Restricción XSD no soportada: ${rule.tag}`)
          if (!valid) { add(`${path}: valor no válido (${rule.tag}).`); break }
        }
      } else throw new Error("Tipo de esquema no soportado.")
    }
    validateNode(root, schema.root, "/archivo")
    return { valid: errors.length === 0, errors, schemaFile: schema.file }
  } catch (error) {
    return { valid: false, errors: [error instanceof Error ? error.message : "No fue posible validar XML."] }
  }
}
