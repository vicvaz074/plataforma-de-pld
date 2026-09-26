/**
 * Closed, data-only interpreter for the XML mapping extracted from SAT workbooks.
 * No eval, VBA execution, file/network access, Excel automation, or dynamic imports.
 * Unsupported syntax fails closed. Program hashes identify the reviewed source.
 */
import programsJson from "./generated/sat-xml-programs.json"
import { satDate, satMoney } from "./sat-xml"

type Routine = { params: { name: string; default?: string | null }[]; lines: string[] }
type Module = { sheet?: string | null; variables?: string[]; publicVariables?: string[]; initialValues?: Record<string, number>; constants: Record<string, string>; routines: Record<string, Routine> }
type Program = { sourceFile: string; sourceSha256: string; verifiedAt: string; fixedCells?: Record<string, string>; modules: Record<string, Module> }
type Value = string | number | boolean
type Context = { module: string; sheet: string; vars: Record<string, Value>; arrays?: Record<string, Record<string, Value>>; depth: number }
type Statement =
  | { kind: "assign"; name: string; expression: string }
  | { kind: "array"; name: string; index: string; expression: string }
  | { kind: "if"; branches: { condition?: string; body: Statement[] }[] }
  | { kind: "for"; name: string; start: string; end: string; step: string; body: Statement[] }
  | { kind: "while"; condition: string; body: Statement[] }
  | { kind: "exit"; target: string }
  | { kind: "call"; expression: string }

const programs = programsJson as unknown as Record<string, Program>
const parsedRoutines = new Map<Routine, Statement[]>()
const identifier = /^[a-z_áéíóúñ][\wáéíóúñ]*$/i
const globalName = /^(shoja\w*|strxml|strsml|valorfecha|esadministracionderecursos|__output)$/i

function esc(value: Value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}

function tokenize(source: string) {
  const tokens: string[] = []
  const pattern = /\s*("(?:""|[^"])*"|\d+(?:\.\d+)?|<>|<=|>=|[a-z_áéíóúñ][\wáéíóúñ]*|[().,+\-*/&=<>\\])/igy
  let index = 0
  while (index < source.trimEnd().length) {
    pattern.lastIndex = index
    const match = pattern.exec(source)
    if (!match) throw new Error(`Expresión XML no soportada: ${source.slice(index, index + 80)}`)
    tokens.push(match[1])
    index = pattern.lastIndex
  }
  return tokens
}

function parseStatements(lines: string[]): Statement[] {
  let index = 0
  const block = (stop: RegExp): Statement[] => {
    const result: Statement[] = []
    while (index < lines.length && !stop.test(lines[index])) {
      const line = lines[index++]
      let match: RegExpMatchArray | null
      if ((match = line.match(/^select\s+case\s+(.+)$/i))) {
        const selector = match[1]
        const branches: { condition?: string; body: Statement[] }[] = []
        while (/^case\s+/i.test(lines[index] || "")) {
          const choice = lines[index++].replace(/^case\s+/i, "")
          branches.push({ condition: /^else$/i.test(choice) ? undefined : `${selector} = ${choice}`, body: block(/^(case\s+|end\s+select)/i) })
        }
        if (!/^end\s+select/i.test(lines[index] || "")) throw new Error(`Falta End Select: ${line}`)
        index++
        result.push({ kind: "if", branches })
      } else if ((match = line.match(/^if\s+(.+?)\s+then\s*(.*)$/i))) {
        const branches: { condition?: string; body: Statement[] }[] = []
        if (match[2]) {
          branches.push({ condition: match[1], body: parseStatements([match[2]]) })
        } else {
          branches.push({ condition: match[1], body: block(/^(elseif|else|end\s*if)\b/i) })
          while (index < lines.length && /^elseif\b/i.test(lines[index])) {
            const branch = lines[index++].match(/^elseif\s+(.+?)\s+then\s*(.*)$/i)!
            branches.push({ condition: branch[1], body: branch[2] ? parseStatements([branch[2]]) : block(/^(elseif|else|end\s*if)\b/i) })
          }
          if (/^else$/i.test(lines[index] || "")) { index++; branches.push({ body: block(/^end\s*if\b/i) }) }
          if (!/^end\s*if\b/i.test(lines[index] || "")) throw new Error(`Falta End If: ${line}`)
          index++
        }
        result.push({ kind: "if", branches })
      } else if ((match = line.match(/^for\s+(\w+)\s*=\s*(.+?)\s+to\s+(.+?)(?:\s+step\s+(.+))?$/i))) {
        const body = block(/^next\b/i)
        if (!/^next\b/i.test(lines[index] || "")) throw new Error(`Falta Next: ${line}`)
        index++
        result.push({ kind: "for", name: match[1].toLowerCase(), start: match[2], end: match[3], step: match[4] || "1", body })
      } else if ((match = line.match(/^do\s+while\s+(.+)$/i))) {
        const body = block(/^loop\b/i)
        index++
        result.push({ kind: "while", condition: match[1], body })
      } else if ((match = line.match(/^exit\s+(function|sub|do|for)$/i))) {
        result.push({ kind: "exit", target: match[1].toLowerCase() })
      } else if ((match = line.match(/^(\w+)\((.+?)\)\s*=\s*(.*)$/i))) {
        result.push({ kind: "array", name: match[1].toLowerCase(), index: match[2], expression: match[3] })
      } else if ((match = line.match(/^const\s+(\w+)(?:\s+as\s+\w+)?\s*=\s*(.*)$/i))) {
        result.push({ kind: "assign", name: match[1].toLowerCase(), expression: match[2] })
      } else if ((match = line.match(/^(?:let\s+)?(\w+)\s*=\s*(.*)$/i))) {
        result.push({ kind: "assign", name: match[1].toLowerCase(), expression: match[2] })
      } else if ((match = line.match(/^call\s+(.+)$/i))) {
        result.push({ kind: "call", expression: match[1] })
      } else if (/^(xml\w*)\s*(\(.*\))?$/i.test(line)) {
        result.push({ kind: "call", expression: line })
      } else {
        throw new Error(`Instrucción XML no soportada: ${line.slice(0, 140)}`)
      }
    }
    return result
  }
  return block(/^$/)
}

export function getSatXmlProgramSource(templateId: string) {
  const program = programs[templateId]
  return program ? { file: program.sourceFile, sha256: program.sourceSha256, verifiedAt: program.verifiedAt } : undefined
}

export function renderSatWorkbookXml(templateId: string, cells: Record<string, string>): { xml: string; errors: string[] } {
  const program = programs[templateId]
  if (!program) return { xml: "", errors: ["No existe un mapeo XML verificado para esta plantilla."] }
  const globals: Record<string, Value> = { esadministracionderecursos: templateId === "sat-fraccion-xi-b-administracion" }
  const publicVariables = new Set(Object.values(program.modules).flatMap((module) => module.publicVariables || []))
  const moduleVariables: Record<string, Record<string, Value>> = Object.fromEntries(Object.entries(program.modules).map(([key, module]) => [key, Object.assign(Object.create(null), module.initialValues)]))
  let steps = 0
  const findRoutine = (name: string, context: Context) => {
    if (program.modules[context.module]?.routines[name]) return context.module
    return Object.keys(program.modules).find((module) => program.modules[module].routines[name])
  }
  const get = (name: string, context: Context): Value => {
    name = name.toLowerCase()
    if (name === "true") return true
    if (name === "false") return false
    if (["vbcrlf", "vblf", "vbnewline"].includes(name)) return "\n"
    if (name in context.vars) return context.vars[name]
    if (name in moduleVariables[context.module]) return moduleVariables[context.module][name]
    if (name in globals) return globals[name]
    const constant = program.modules[context.module]?.constants[name]
      ?? Object.values(program.modules).find((module) => name in module.constants)?.constants[name]
    if (constant !== undefined) return expression(constant, { ...context, depth: context.depth + 1 })
    if (findRoutine(name, context)) return call(name, [], context)
    return ""
  }
  const readCell = (address: Value, context: Context): string => {
    const ref = String(address).replace(/\$/g, "").toUpperCase()
    if (!ref) return ""
    if (!/^[A-Z]+\d+$/.test(ref)) throw new Error(`Referencia XML no válida: ${ref}`)
    return program.fixedCells?.[`${context.sheet}!${ref}`] ?? cells[`${context.sheet}!${ref}`] ?? ""
  }
  const expression = (source: string, context: Context): Value => {
    if (context.depth > 100) throw new Error("El mapeo XML excedió la profundidad permitida.")
    const tokens = tokenize(source)
    let pos = 0
    const peek = () => (tokens[pos] || "").toLowerCase()
    const primary = (): Value => {
      const token = tokens[pos++]
      if (token === undefined) throw new Error(`Expresión XML incompleta: ${source}`)
      let value: Value
      if (token.startsWith('"')) value = token.slice(1, -1).replace(/""/g, '"')
      else if (/^\d/.test(token)) value = Number(token)
      else if (token === "(") { value = binary(0); if (tokens[pos++] !== ")") throw new Error(`Paréntesis XML no balanceados: ${source}`) }
      else if (token === "-") value = -Number(primary())
      // VBA Not binds after comparisons but before And/Or: Not r > 25 means
      // Not (r > 25), not (Not r) > 25. Several official row loops rely on this.
      else if (token.toLowerCase() === "not") value = !binary(3)
      else if (identifier.test(token)) {
        if (peek() === "(") {
          pos++
          const args: Value[] = []
          while (peek() !== ")") {
            args.push(binary(0))
            if (peek() !== ",") break
            pos++
          }
          if (tokens[pos++] !== ")") throw new Error(`Argumentos XML no balanceados: ${source}`)
          value = call(token.toLowerCase(), args, context)
        } else value = get(token, context)
      } else throw new Error(`Token XML no soportado: ${token}`)
      if (peek() === ".") {
        pos++
        // Formula is only a read of the supplied cell value; formulas are never evaluated.
        if (!["value", "value2", "text", "formula"].includes((tokens[pos++] || "").toLowerCase())) throw new Error("Propiedad XML no soportada.")
      }
      return value
    }
    const precedence: Record<string, number> = { or: 1, and: 2, "=": 3, "<>": 3, "<": 3, ">": 3, "<=": 3, ">=": 3, "&": 4, "+": 5, "-": 5, "*": 6, "/": 6, "\\": 6, mod: 6 }
    const binary = (minimum: number): Value => {
      let left = primary()
      while (peek() in precedence && precedence[peek()] >= minimum) {
        const operator = peek(); pos++
        const right = binary(precedence[operator] + 1)
        switch (operator) {
          case "or": left = Boolean(left) || Boolean(right); break
          case "and": left = Boolean(left) && Boolean(right); break
          case "&": left = String(left) + String(right); break
          case "+": left = typeof left === "string" && typeof right === "string" ? left + right : Number(left) + Number(right); break
          case "-": left = Number(left) - Number(right); break
          case "*": left = Number(left) * Number(right); break
          case "/": left = Number(left) / Number(right); break
          case "\\": left = Math.trunc(Number(left) / Number(right)); break
          case "mod": left = Number(left) % Number(right); break
          case "=": left = String(left) === String(right); break
          case "<>": left = String(left) !== String(right); break
          case "<": left = Number(left) < Number(right); break
          case ">": left = Number(left) > Number(right); break
          case "<=": left = Number(left) <= Number(right); break
          case ">=": left = Number(left) >= Number(right); break
        }
      }
      return left
    }
    const result = binary(0)
    if (pos !== tokens.length) throw new Error(`Expresión XML sin consumir: ${source}`)
    return result
  }
  const execute = (statements: Statement[], context: Context): string | undefined => {
    for (const statement of statements) {
      if (++steps > 500_000) throw new Error("El mapeo XML excedió el límite de instrucciones.")
      if (statement.kind === "assign") {
        const target = globalName.test(statement.name) || publicVariables.has(statement.name) ? globals
          : program.modules[context.module].variables?.includes(statement.name) ? moduleVariables[context.module] : context.vars
        target[statement.name] = expression(statement.expression, context)
      } else if (statement.kind === "array") {
        context.arrays ??= {}
        context.arrays[statement.name] ??= Object.create(null)
        context.arrays[statement.name][String(expression(statement.index, context))] = expression(statement.expression, context)
      } else if (statement.kind === "call") expression(statement.expression, context)
      else if (statement.kind === "exit") return statement.target
      else if (statement.kind === "if") {
        const branch = statement.branches.find((branch) => !branch.condition || expression(branch.condition, context))
        if (branch) { const exit = execute(branch.body, context); if (exit) return exit }
      } else if (statement.kind === "for") {
        const from = Number(expression(statement.start, context)), to = Number(expression(statement.end, context)), step = Number(expression(statement.step, context))
        if (!step || !Number.isFinite(from + to + step) || Math.abs((to - from) / step) > 2000) throw new Error("Rango repetido XML no válido.")
        for (let index = from; step > 0 ? index <= to : index >= to; index += step) {
          context.vars[statement.name] = index
          const exit = execute(statement.body, context)
          if (exit === "for") break
          if (exit) return exit
        }
      } else if (statement.kind === "while") {
        let iterations = 0
        while (expression(statement.condition, context)) {
          if (++iterations > 2000) throw new Error("La tabla XML excedió el límite de filas.")
          const exit = execute(statement.body, context)
          if (exit === "do") break
          if (exit) return exit
        }
      }
    }
  }
  const call = (name: string, args: Value[], context: Context): Value => {
    if (context.depth > 100) throw new Error("El mapeo XML excedió la profundidad permitida.")
    if (context.arrays?.[name]) return context.arrays[name][String(args[0])] ?? 0
    const text = String(args[0] ?? "")
    switch (name) {
      case "range": return readCell(args[0], context)
      case "existendatosenceldas": return args.some((address) => String(address) && readCell(address, context) !== "")
      case "abre": return `<${text}>\n`
      case "cierra": return `</${text}>\n`
      case "valor": case "opcional":
        if (!/^[a-z][a-z0-9_]*$/i.test(text)) throw new Error("Etiqueta XML no válida.")
        return name === "opcional" && String(args[1] ?? "").trim() === "" ? "" : `<${text}>${esc(args[1] ?? "")}</${text}>\n`
      case "clave1": return text.split(",")[0].trim()
      case "clave2": return text.split(",").at(-1)?.trim() || ""
      case "clave3": return text.includes("||") ? text.split("||").at(-1)!.trim() : text.split(",")[0].trim()
      case "fecha": case "formatofecha": return text ? satDate(text) : ""
      case "fechahora": {
        if (!text) return ""
        if (/^\d{14}$/.test(text)) return text
        const time = text.match(/[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
        return satDate(text.split(/[T ]/)[0]) + (time ? `${time[1]}${time[2]}${time[3] || "00"}` : "000000")
      }
      case "monto": case "formatonumerodecimal": return text ? satMoney(text) : ""
      case "formatonumeroentero": return text ? String(Math.trunc(Number(text))) : ""
      case "cpnal": case "formatocodigopostalnacional": return text ? text.padStart(5, "0") : ""
      case "lcase": return text.toLowerCase()
      case "ucase": return text.toUpperCase()
      case "trim": case "trim$": return text.trim()
      case "cstr": return text
      case "cint": case "clng": case "val": case "cdbl": return Number(text)
      case "len": return text.length
      case "left": return text.slice(0, Number(args[1]))
      case "right": return text.slice(-Number(args[1]))
      case "mid": return text.slice(Number(args[1]) - 1, args[2] === undefined ? undefined : Number(args[1]) - 1 + Number(args[2]))
      case "replace": return text.split(String(args[1])).join(String(args[2]))
      case "strcomp": {
        const a = Number(args[2]) === 1 ? text.toLowerCase() : text
        const b = Number(args[2]) === 1 ? String(args[1]).toLowerCase() : String(args[1])
        return a === b ? 0 : a < b ? -1 : 1
      }
      case "instr": return args.length >= 3 ? String(args[1]).indexOf(String(args[2]), Number(args[0]) - 1) + 1 : text.indexOf(String(args[1])) + 1
      case "iif": return args[0] ? args[1] : args[2]
      case "isnumeric": return text.trim() !== "" && Number.isFinite(Number(text))
    }
    const moduleName = findRoutine(name, context)
    if (!moduleName) throw new Error(`Función XML no soportada: ${name}`)
    const module = program.modules[moduleName], routine = module.routines[name]
    const nested: Context = { module: moduleName, sheet: module.sheet || context.sheet, vars: { [name]: "" }, depth: context.depth + 1 }
    for (let i = 0; i < routine.params.length; i++) {
      const param = routine.params[i]
      nested.vars[param.name] = args[i] ?? (param.default ? expression(param.default, context) : "")
    }
    let statements = parsedRoutines.get(routine)
    if (!statements) { statements = parseStatements(routine.lines); parsedRoutines.set(routine, statements) }
    execute(statements, nested)
    return nested.vars[name] ?? ""
  }
  const invoke = (module: string, name: string, sheet?: string) => call(name, [], { module, sheet: sheet || program.modules[module].sheet || "", vars: {}, depth: 0 })
  try {
    if (templateId.startsWith("sat-fraccion-xi-")) {
      globals.shoja_datosgenerales = invoke("hoja01", "xml_hoja_persona_objeto_del_aviso")
      globals.shoja_beneficiariocontrolador = invoke("hoja02", "xml_hoja_beneficiario_controlador")
      const activity = Object.entries(program.modules).find(([, module]) => module.sheet === "Acto u operación")!
      const root = Object.keys(activity[1].routines).find((name) => name.startsWith("xml_hoja_sp"))!
      globals.shoja_operacionspr = invoke(activity[0], root)
      globals.shoja_operacionesfinancieras = invoke("mod_opfinancieras", "xml_hoja_opf", "Operaciones financieras")
      globals.__output = invoke("x_xml", "xml_serviciosprofesionales")
    } else if (templateId === "sat-fraccion-xvi-activos-virtuales") {
      for (let i = 1; i <= 9; i++) invoke(`hoja0${i}`, "generaxml")
      invoke("hoja09", "xmlaviso")
    } else {
      const sheets = Object.entries(program.modules).filter(([, module]) => module.sheet)
      if (templateId === "sat-fraccion-v-bis-desarrollo") {
        invoke("sheet1", "xmlaviso")
        // The official buttons invoke only source sheets that contain a contribution.
        const roots: [string, string[]][] = [["xmlrecpropios", ["B10", "G10"]], ["xmlsocios", ["C6"]], ["xmlterceros", ["C6"]], ["xmlprestamofin", ["B9"]], ["xmlprestamonofin", ["F9"]], ["xmlfinbursatil", ["C9", "D9", "E9"]]]
        for (const [root, triggers] of roots) {
          const entry = sheets.find(([, module]) => module.routines[root])
          if (entry && triggers.some((cell) => cells[`${entry[1].sheet}!${cell}`])) invoke(entry[0], root)
        }
        const contributions = [2, 3, 4, 5, 6, 7].map((i) => String(globals[`shoja${i}`] || "")).join("")
        invoke("valida", contributions ? "xmlcierraarchivo" : "xmlcierraarchivoopcional")
        globals.__output = String(globals.shoja1 || "") + (contributions && !globals.valorfecha ? "<aportaciones>\n" : "") + contributions + String(globals.shoja8 || "")
      } else {
      for (const [moduleName, module] of sheets) {
        const root = module.routines.xml ? "xml" : module.routines.generaxml ? "generaxml" : undefined
        if (root) invoke(moduleName, root)
      }
      }
    }
    const xml = String(globals.__output || globals.strxml || "").trim()
    if (!xml.startsWith("<archivo ") || !xml.endsWith("</archivo>")) throw new Error("El mapeo no produjo un archivo XML completo.")
    return { xml: `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`, errors: [] }
  } catch (error) {
    return { xml: "", errors: [error instanceof Error ? error.message : "Error de generación XML."] }
  }
}
