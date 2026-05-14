import { resolveSatFormatoForActividad } from "./sat-formatos"
import type {
  PldOperationalCase,
  SatOutputKind,
  SatOutputValidation,
  SatXmlCanonicalComparison,
  SatXmlLayoutDefinition,
} from "./types"

type SatXmlInput = {
  operationalCase: PldOperationalCase
  outputKind: SatOutputKind
  validation: SatOutputValidation
  generatedAt: string
}

type SatXmlValueMap = Record<string, string | undefined>

export function getSatXmlLayoutForActividad(actividadKey: string): SatXmlLayoutDefinition {
  const formato = resolveSatFormatoForActividad(actividadKey)

  return {
    id: formato.xmlLayoutId,
    formatoId: formato.id,
    activityCode: formato.xmlActivityCode,
    namespace: formato.xmlNamespace,
    schemaLocation: formato.xmlSchemaLocation,
    rootTag: "archivo",
  }
}

export function buildOfficialSatXml(input: SatXmlInput): string {
  const { operationalCase, outputKind } = input
  const formato = resolveSatFormatoForActividad(operationalCase.actividadKey)
  const layout = getSatXmlLayoutForActividad(operationalCase.actividadKey)
  const values = buildValueMap(operationalCase)
  const aviso =
    outputKind === "informe_ceros"
      ? ""
      : formato.id === "sat-fraccion-xv-arrendamiento"
        ? buildArrendamientoAviso(values, operationalCase)
        : buildGenericAviso(values, operationalCase, outputKind)

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    "",
    `<archivo xsi:schemaLocation="${escapeXml(layout.schemaLocation)}" xmlns="${escapeXml(
      layout.namespace,
    )}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`,
    "<informe>",
    node("mes_reportado", value(values, "persona_aviso.periodo") || operationalCase.periodo, true),
    "<sujeto_obligado>",
    node("clave_sujeto_obligado", value(values, "persona_aviso.sujeto_obligado_rfc") || operationalCase.tenantRfc, true),
    node("clave_actividad", layout.activityCode, true),
    "</sujeto_obligado>",
    aviso,
    "</informe>",
    "</archivo>",
  ]
    .filter((line) => line !== "")
    .join("\n")
}

export function compareSatXmlCanonical(actual: string, expected: string): SatXmlCanonicalComparison {
  const actualCanonical = canonicalSatXml(actual)
  const expectedCanonical = canonicalSatXml(expected)

  return {
    equivalent: actualCanonical === expectedCanonical,
    actualCanonical,
    expectedCanonical,
    diff:
      actualCanonical === expectedCanonical
        ? ""
        : `XML SAT distinto.\nActual:   ${actualCanonical.slice(0, 500)}\nEsperado: ${expectedCanonical.slice(0, 500)}`,
  }
}

export function canonicalSatXml(xml: string): string {
  return xml
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .trim()
}

export function satCatalogCode(raw: unknown): string {
  const text = normalize(raw)
  if (!text) return ""
  const doublePipe = text.split("||")
  if (doublePipe.length > 1) return doublePipe[doublePipe.length - 1].trim()
  return text.split(",")[0]?.trim() || text
}

export function satCountryCode(raw: unknown): string {
  const text = normalize(raw)
  if (!text) return ""
  const parts = text.split(",")
  return (parts.length > 1 ? parts[parts.length - 1] : parts[0]).trim()
}

export function satDate(raw: unknown): string {
  const text = normalize(raw)
  if (!text) return ""
  if (/^\d{8}$/.test(text)) return text
  if (/^\d{5}(?:\.\d+)?$/.test(text)) return dateFromExcelSerial(Number(text))

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}${iso[2]}${iso[3]}`

  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return `${dmy[3]}${dmy[2].padStart(2, "0")}${dmy[1].padStart(2, "0")}`

  return text.replace(/\D/g, "").slice(0, 8)
}

export function satMoney(raw: unknown): string {
  const text = normalize(raw).replace(/,/g, "")
  const amount = Number(text)
  return Number.isFinite(amount) ? amount.toFixed(2) : ""
}

export function excelSerialFromDate(raw: unknown): number | null {
  const text = normalize(raw)
  if (!text) return null
  if (/^\d{5}(?:\.\d+)?$/.test(text)) return Number(text)
  const normalized = satDate(text)
  if (!/^\d{8}$/.test(normalized)) return null
  const year = Number(normalized.slice(0, 4))
  const month = Number(normalized.slice(4, 6))
  const day = Number(normalized.slice(6, 8))
  const utc = Date.UTC(year, month - 1, day)
  return Math.round(utc / 86_400_000 + 25_569)
}

function buildArrendamientoAviso(values: SatXmlValueMap, operationalCase: PldOperationalCase): string {
  const personaMoral = buildPersonaMoral(values, operationalCase)
  const personaFisica = buildPersonaFisica(values, operationalCase)
  const personaAviso = wrap("persona_aviso", [
    wrap("tipo_persona", [personaMoral || personaFisica]),
    wrap("tipo_domicilio", [wrap("nacional", [
      node("colonia", value(values, "persona_aviso.domicilio_nacional.colonia")),
      node("calle", value(values, "persona_aviso.domicilio_nacional.calle")),
      node("numero_exterior", value(values, "persona_aviso.domicilio_nacional.numero_exterior")),
      node("numero_interior", value(values, "persona_aviso.domicilio_nacional.numero_interior")),
      node("codigo_postal", value(values, "persona_aviso.domicilio_nacional.codigo_postal")),
    ])]),
    wrap("telefono", [
      node("clave_pais", satCountryCode(value(values, "persona_aviso.contacto.pais_telefono"))),
      node("numero_telefono", value(values, "persona_aviso.contacto.telefono")),
      node("correo_electronico", value(values, "persona_aviso.contacto.correo")),
    ]),
  ])

  return wrap("aviso", [
    node("referencia_aviso", value(values, "persona_aviso.referencia") || operationalCase.id, true),
    node("prioridad", satCatalogCode(value(values, "persona_aviso.prioridad") || "1,NORMAL"), true),
    wrap("alerta", [
      node("tipo_alerta", satCatalogCode(value(values, "persona_aviso.tipo_alerta") || "100,Sin alerta."), true),
      node("descripcion_alerta", value(values, "persona_aviso.descripcion_alerta") || operationalCase.alertaDescripcion),
    ]),
    personaAviso,
    wrap("detalle_operaciones", [
      wrap("datos_operacion", [
        node("fecha_operacion", satDate(value(values, "acto.fecha_operacion") || operationalCase.fechaOperacion), true),
        node("tipo_operacion", satCatalogCode(value(values, "acto.tipo_operacion")), true),
        wrap("caracteristicas", [
          node("fecha_inicio", satDate(value(values, "inmueble.fecha_inicio"))),
          node("fecha_termino", satDate(value(values, "inmueble.fecha_termino"))),
          node("tipo_inmueble", satCatalogCode(value(values, "inmueble.tipo_bien")), true),
          node("valor_referencia", satMoney(value(values, "inmueble.valor_referencia") || value(values, "inmueble.valor_pactado")), true),
          node("colonia", value(values, "inmueble.colonia")),
          node("calle", value(values, "inmueble.calle")),
          node("numero_exterior", value(values, "inmueble.numero_exterior")),
          node("numero_interior", value(values, "inmueble.numero_interior")),
          node("codigo_postal", value(values, "inmueble.codigo_postal")),
          node("folio_real", value(values, "inmueble.folio_real")),
        ]),
        wrap("datos_liquidacion", [
          node("fecha_pago", satDate(value(values, "pago.fecha")), true),
          node("forma_pago", satCatalogCode(value(values, "pago.forma_pago")), true),
          node("instrumento_monetario", satCatalogCode(value(values, "pago.instrumento_monetario")), true),
          node("moneda", satCatalogCode(value(values, "pago.moneda")), true),
          node("monto_operacion", satMoney(value(values, "pago.monto") || operationalCase.montoMxn), true),
        ]),
      ]),
    ]),
  ])
}

function buildPersonaMoral(values: SatXmlValueMap, operationalCase: PldOperationalCase) {
  const razon = value(values, "persona_aviso.pm.razon_social") || operationalCase.clienteNombre
  const rfc = value(values, "persona_aviso.pm.rfc") || operationalCase.clienteRfc
  if (!razon && !rfc) return ""

  return wrap("persona_moral", [
    node("denominacion_razon", razon, true),
    node("fecha_constitucion", satDate(value(values, "persona_aviso.pm.fecha_constitucion"))),
    node("rfc", rfc),
    node("pais_nacionalidad", satCountryCode(value(values, "persona_aviso.pm.pais_nacionalidad"))),
    node("giro_mercantil", satCatalogCode(value(values, "persona_aviso.pm.giro_mercantil"))),
    wrap("representante_apoderado", [
      node("nombre", value(values, "persona_aviso.representante.nombre")),
      node("apellido_paterno", value(values, "persona_aviso.representante.apellido_paterno")),
      node("apellido_materno", value(values, "persona_aviso.representante.apellido_materno")),
      node("fecha_nacimiento", satDate(value(values, "persona_aviso.representante.fecha_nacimiento"))),
      node("rfc", value(values, "persona_aviso.representante.rfc")),
      node("curp", value(values, "persona_aviso.representante.curp")),
    ]),
  ])
}

function buildPersonaFisica(values: SatXmlValueMap, operationalCase: PldOperationalCase) {
  const nombre = value(values, "persona_aviso.pf.nombre")
  if (!nombre) return ""
  return wrap("persona_fisica", [
    node("nombre", nombre, true),
    node("apellido_paterno", value(values, "persona_aviso.pf.apellido_paterno")),
    node("apellido_materno", value(values, "persona_aviso.pf.apellido_materno")),
    node("fecha_nacimiento", satDate(value(values, "persona_aviso.pf.fecha_nacimiento"))),
    node("rfc", value(values, "persona_aviso.pf.rfc") || operationalCase.clienteRfc),
    node("curp", value(values, "persona_aviso.pf.curp")),
    node("pais_nacionalidad", satCountryCode(value(values, "persona_aviso.pf.pais_nacionalidad"))),
    node("actividad_economica", satCatalogCode(value(values, "persona_aviso.pf.actividad_economica"))),
  ])
}

function buildGenericAviso(values: SatXmlValueMap, operationalCase: PldOperationalCase, outputKind: SatOutputKind) {
  return wrap("aviso", [
    node("referencia_aviso", value(values, "persona_aviso.referencia") || operationalCase.id, true),
    node("prioridad", satCatalogCode(value(values, "persona_aviso.prioridad") || (outputKind === "aviso_24h" ? "2" : "1")), true),
    wrap("alerta", [
      node("tipo_alerta", satCatalogCode(value(values, "persona_aviso.tipo_alerta") || operationalCase.alertaCodigo || "100"), true),
      node("descripcion_alerta", value(values, "persona_aviso.descripcion_alerta") || operationalCase.alertaDescripcion),
    ]),
    wrap("persona_aviso", [
      wrap("tipo_persona", [
        wrap("persona_moral", [
          node("denominacion_razon", value(values, "persona_aviso.pm.razon_social") || operationalCase.clienteNombre, true),
          node("rfc", value(values, "persona_aviso.pm.rfc") || operationalCase.clienteRfc),
        ]),
      ]),
    ]),
    wrap("detalle_operaciones", [
      wrap("datos_operacion", [
        node("fecha_operacion", satDate(value(values, "acto.fecha_operacion") || operationalCase.fechaOperacion), true),
        node("monto_operacion", satMoney(value(values, "pago.monto") || operationalCase.montoMxn), true),
      ]),
    ]),
  ])
}

function buildValueMap(operationalCase: PldOperationalCase): SatXmlValueMap {
  const values: SatXmlValueMap = {}
  for (const [key, raw] of Object.entries(operationalCase.satFieldValues || {})) values[key] = normalize(raw)
  for (const [key, raw] of Object.entries(operationalCase.satCellValues || {})) values[key] = normalize(raw)
  return values
}

function value(values: SatXmlValueMap, key: string): string {
  return values[key]?.trim() || ""
}

function node(tag: string, raw: unknown, required = false): string {
  const text = normalize(raw)
  if (!text && !required) return ""
  return `<${tag}>${escapeXml(text)}</${tag}>`
}

function wrap(tag: string, children: string[]): string {
  const body = children.filter(Boolean).join("\n")
  return body ? `<${tag}>\n${body}\n</${tag}>` : ""
}

function normalize(raw: unknown) {
  return raw === undefined || raw === null ? "" : String(raw).trim()
}

function dateFromExcelSerial(serial: number) {
  const utc = Math.round((serial - 25_569) * 86_400_000)
  const date = new Date(utc)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}${month}${day}`
}

function escapeXml(value: string | number | undefined | null) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
