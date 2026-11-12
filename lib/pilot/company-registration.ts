import type { Company } from "./contracts"

const rfc = (value:unknown) => typeof value === "string" ? value.trim().toUpperCase() : ""

export function prefillCompanyRegistration<T extends { rfc:string; nombre:string }>(identity:T, company:Pick<Company,"rfc"|"name">):T {
  return {...identity,rfc:rfc(company.rfc),nombre:identity.nombre.trim() ? identity.nombre : company.name}
}

/** Reject mixed identities before any autosave; never filter/delete them on read. */
export function cloudRegistrationIssue(raw:unknown,company:Pick<Company,"rfc">):string|null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "El registro de Alta no es legible. Conserva el original para recuperación."
  const value=raw as Record<string,unknown>
  if (value.sujetosRegistrados !== undefined && !Array.isArray(value.sujetosRegistrados)) return "La lista de sujetos obligados necesita revisión."
  const subjects=(value.sujetosRegistrados || []) as unknown[]
  if (subjects.length>1) return "Esta empresa contiene varios sujetos obligados. Asígnalos a sus empresas desde la migración antes de continuar; no se eliminó ningún registro."
  const expected=rfc(company.rfc)
  if (!expected) return "La empresa activa necesita un RFC en Administración antes de registrar su Alta."
  const draft=value.identificacion as Record<string,unknown>|undefined
  if (draft && rfc(draft.rfc) && rfc(draft.rfc)!==expected) return "El RFC capturado no corresponde a la empresa activa. Revisa la asignación de los datos antes de continuar."
  for (const subject of subjects) {
    if (!subject || typeof subject!=="object") return "El sujeto guardado necesita revisión antes de continuar."
    const item=subject as Record<string,unknown>
    const identity=item.identificacion as Record<string,unknown>|undefined
    if (rfc(identity?.rfc || item.rfc)!==expected) return "El sujeto guardado no corresponde al RFC de la empresa activa. Se conservó sin reasignar su identidad."
  }
  return null
}
