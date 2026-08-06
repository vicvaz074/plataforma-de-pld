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

/**
 * Naturaleza de la persona objeto del aviso.
 *
 * El Anexo agrupa en un mismo renglón las columnas de persona moral y las del
 * fideicomiso, que son excluyentes. Este control decide cuáles aplican para que
 * un fideicomiso no arrastre además la denominación y el giro de una persona
 * moral que no existe.
 */
export const PERSONA_OBJETO_TYPE_FIELD_ID = "persona_objeto.tipo_persona"

export type PersonaObjetoTipo = "persona_fisica" | "persona_moral" | "fideicomiso"

/**
 * Ámbito del domicilio de la persona objeto.
 *
 * El Anexo publica dos tablas de domicilio, nacional y en el extranjero, ambas
 * con columnas marcadas como obligatorias. Se llena la que corresponde al
 * domicilio del cliente, así que sin este control todo aviso quedaría detenido
 * pidiendo un domicilio que no existe.
 */
export const PERSONA_OBJETO_DOMICILIO_FIELD_ID = "persona_objeto.ambito_domicilio"

export type PersonaObjetoDomicilioAmbito = "nacional" | "internacional"

export const SAT_SYNTHETIC_CONTROL_FIELD_IDS: readonly string[] = [
  BENEFICIARY_PERSON_TYPE_FIELD_ID,
  BENEFICIARY_REPEAT_MODE_FIELD_ID,
  BENEFICIARY_TRUST_MODE_FIELD_ID,
  PERSONA_OBJETO_TYPE_FIELD_ID,
  PERSONA_OBJETO_DOMICILIO_FIELD_ID,
]

/**
 * Controles que pueden deducirse de los datos ya capturados por ser una
 * elección entre figuras excluyentes.
 *
 * Los interruptores de modo quedan fuera a propósito: son intención del
 * capturista, así que un valor rezagado no debe darlos por activados —
 * si lo hiciera, ese mismo dato obsoleto se colaría al libro.
 */
export const SAT_INFERABLE_CONTROL_FIELD_IDS: readonly string[] = [
  BENEFICIARY_PERSON_TYPE_FIELD_ID,
  PERSONA_OBJETO_TYPE_FIELD_ID,
  PERSONA_OBJETO_DOMICILIO_FIELD_ID,
]

export function isSatInferableControlFieldId(fieldId: string): boolean {
  return SAT_INFERABLE_CONTROL_FIELD_IDS.includes(fieldId)
}

export function isSatSyntheticControlFieldId(fieldId: string): boolean {
  return SAT_SYNTHETIC_CONTROL_FIELD_IDS.includes(fieldId)
}
