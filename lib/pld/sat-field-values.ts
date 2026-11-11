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
  const output: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) {
    let field = byId.get(key)
    if (!field && key.includes("!")) {
      const split = key.lastIndexOf("!")
      const cell = key.slice(split + 1).toUpperCase()
      if (!isSatCellAddress(cell)) throw new Error("La dirección de celda SAT no es válida.")
      field = byCell.get(`${key.slice(0, split)}!${cell}`)
    }
    const canonical = field?.id || (controls.has(key) || LEGACY_SEMANTIC_FIELD_IDS.has(key) ? key : undefined)
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
