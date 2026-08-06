/**
 * Controles de captura que no corresponden a ninguna celda del libro del SAT.
 *
 * El Anexo respectivo publica una sola tabla de beneficiario controlador, pero
 * la captura necesita saber qué rama aplica (persona física o moral, si se
 * declaran varios beneficiarios y si el titular es un fideicomiso). Esos
 * selectores viven únicamente en el formulario y gobiernan `activeWhen`, por lo
 * que nunca deben buscarse entre los campos extraídos de la plantilla.
 */

export const BENEFICIARY_PERSON_TYPE_FIELD_ID = "beneficiario.tipo_persona"
export const BENEFICIARY_REPEAT_MODE_FIELD_ID = "beneficiario.permitir_repetidos"
export const BENEFICIARY_TRUST_MODE_FIELD_ID = "beneficiario.es_fideicomiso"

export const SAT_SYNTHETIC_CONTROL_FIELD_IDS: readonly string[] = [
  BENEFICIARY_PERSON_TYPE_FIELD_ID,
  BENEFICIARY_REPEAT_MODE_FIELD_ID,
  BENEFICIARY_TRUST_MODE_FIELD_ID,
]

export function isSatSyntheticControlFieldId(fieldId: string): boolean {
  return SAT_SYNTHETIC_CONTROL_FIELD_IDS.includes(fieldId)
}
