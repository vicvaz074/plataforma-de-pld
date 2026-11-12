import { SAT_SYNTHETIC_CONTROL_FIELD_IDS } from "./sat-field-controls"
import type { SatXlsmField } from "./types"

// Saved prototype records used this finite semantic schema for every SAT format.
// Where the selected layout has no such field, keep the value as inert metadata;
// it must never acquire an arbitrary sheet/cell destination.
const LEGACY_SEMANTIC_FIELD_IDS = new Set([
  "acto.fecha_operacion", "acto.tipo_operacion", "pago.fecha", "pago.forma_pago", "pago.instrumento_monetario", "pago.moneda", "pago.monto",
  "persona_aviso.sujeto_obligado_rfc", "persona_aviso.periodo", "persona_aviso.referencia", "persona_aviso.prioridad", "persona_aviso.tipo_alerta",
  "persona_aviso.pm.razon_social", "persona_aviso.pm.fecha_constitucion", "persona_aviso.pm.rfc", "persona_aviso.pm.pais_nacionalidad", "persona_aviso.pm.giro_mercantil",
  "persona_aviso.representante.nombre", "persona_aviso.representante.apellido_paterno", "persona_aviso.representante.apellido_materno", "persona_aviso.representante.fecha_nacimiento", "persona_aviso.representante.curp",
  "persona_aviso.domicilio_nacional.codigo_postal", "persona_aviso.domicilio_nacional.colonia", "persona_aviso.domicilio_nacional.calle", "persona_aviso.domicilio_nacional.numero_exterior",
  "persona_aviso.domicilio_nacional.estado", "persona_aviso.domicilio_nacional.municipio", "persona_aviso.domicilio_nacional.ciudad",
  "persona_aviso.contacto.pais_telefono", "persona_aviso.contacto.telefono", "persona_aviso.contacto.correo",
  "beneficiario.pf.nombre", "beneficiario.pf.apellido_paterno", "beneficiario.pf.apellido_materno", "beneficiario.pf.fecha_nacimiento", "beneficiario.pf.rfc", "beneficiario.pf.curp", "beneficiario.pf.pais_nacionalidad",
])

// The original XV extractor used these exact eight field/cell names in B19:I28.
// Admit only their finite migration to the canonical official mapping: never a
// generic suffix/cell match that could authorize arbitrary workbook destinations.
const LEGACY_XV_PF_COLUMNS = [
  ["nombre-s", "nombre", "B"],
  ["apellido-paterno", "apellido_paterno", "C"],
  ["apellido-materno", "apellido_materno", "D"],
  ["fecha-nacimiento", "fecha_nacimiento", "E"],
  ["rfc", "rfc", "F"],
  ["curp", "curp", "G"],
  ["pais-de-nacionalidad", "pais_nacionalidad", "H"],
  ["actividad-economica", "actividad_economica", "I"],
] as const

function legacyXvPfAliases(byId: ReadonlyMap<string, SatXlsmField>, controls: ReadonlySet<string>): Map<string, string> {
  const aliases = new Map<string, string>()
  for (let row = 1; row <= 10; row++) {
    let recognizedRow = false
    for (const [legacyName, canonicalName, column] of LEGACY_XV_PF_COLUMNS) {
      const canonical = `persona_aviso.pf.${row === 1 ? "" : `${row}.`}${canonicalName}`
      const field = byId.get(canonical)
      if (field?.sheetName !== "Persona Objeto del aviso" || field.cell !== `${column}${18 + row}`) continue
      const oldId = `persona-objeto-del-aviso.persona-fisica-r19.${legacyName}.${row === 1 ? "" : `${row}.`}${column.toLowerCase()}${18 + row}`
      aliases.set(oldId, canonical)
      recognizedRow = true
    }
    if (row > 1 && recognizedRow) {
      const canonicalControl = `sat.row.persona-objeto-del-aviso.persona-objeto-pf.${row}`
      if (controls.has(canonicalControl)) aliases.set(`sat.row.persona-objeto-del-aviso.persona-fisica-r19.${row}`, canonicalControl)
    }
  }
  return aliases
}

/** Canonical Excel A1 addresses only: never interpolate untrusted syntax in XML/regex. */
export function isSatCellAddress(value: string): boolean {
  if (!/^[A-Z]{1,3}[1-9]\d{0,6}$/.test(value)) return false
  const [, letters, row] = /^([A-Z]+)(\d+)$/.exec(value)!
  let column = 0
  for (const letter of letters) column = column * 26 + letter.charCodeAt(0) - 64
  return column <= 16384 && Number(row) <= 1048576
}

/** The same allowlist must be used on admission and export. A cell alias is a
 * representation of a known field, not authority to write any workbook cell.
 * Conditional controls have no workbook destination and remain available to pruning.
 */
export function normalizeSatFieldValues(
  fields: readonly SatXlsmField[],
  values: Record<string, string>,
): Record<string, string> {
  const byId = new Map(fields.map((field) => [field.id, field]))
  const byCell = new Map<string, SatXlsmField>()
  const controls = new Set(SAT_SYNTHETIC_CONTROL_FIELD_IDS)
  for (const field of fields) {
    if (!isSatCellAddress(field.cell)) throw new Error("El formato SAT contiene una celda no válida.")
    byCell.set(`${field.sheetName}!${field.cell}`, field)
    for (const condition of [...field.activeWhen || [], ...field.requiredWhen || []]) {
      if (/^sat\.(?:branch|row)\.[a-z0-9_.-]+$/i.test(condition.fieldId)) controls.add(condition.fieldId)
    }
  }
  const legacyAliases = legacyXvPfAliases(byId, controls)
  const output: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) {
    const admittedKey = legacyAliases.get(key) || key
    let field = byId.get(admittedKey)
    if (!field && admittedKey.includes("!")) {
      const split = admittedKey.lastIndexOf("!")
      const cell = admittedKey.slice(split + 1).toUpperCase()
      if (!isSatCellAddress(cell)) throw new Error("La dirección de celda SAT no es válida.")
      field = byCell.get(`${admittedKey.slice(0, split)}!${cell}`)
    }
    const canonical = field?.id || (controls.has(admittedKey) || LEGACY_SEMANTIC_FIELD_IDS.has(admittedKey) ? admittedKey : undefined)
    if (!canonical) throw new Error(`El campo SAT no corresponde al formato seleccionado: ${key}.`)
    if (Object.hasOwn(output, canonical)) {
      // Official workbooks normalize captured strings to uppercase. This is the
      // same value, not a conflicting second destination; prefer semantic casing.
      if (output[canonical].toUpperCase() !== value.toUpperCase()) throw new Error(`Los valores SAT del campo y su celda no coinciden: ${canonical}.`)
      if (key !== canonical) continue
    }
    // defineProperty also keeps special object keys inert if a future layout uses one.
    Object.defineProperty(output, canonical, { value, enumerable: true, writable: true, configurable: true })
  }
  return output
}
