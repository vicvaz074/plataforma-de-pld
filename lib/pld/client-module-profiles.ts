type Profile = Record<string, any>
export function readClientProfile(raw: string | null, clientId: string): Profile {
  if (!raw) return {}
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("El registro del cliente no es legible; no se sobrescribió.")
  const record = value as Profile
  const profile = record.profiles?.[clientId]
  return profile && typeof profile === "object" && !Array.isArray(profile) ? profile : {}
}
export function mergeClientProfile(raw: string | null, clientId: string, profile: Profile) {
  if (!clientId) throw new Error("Selecciona un expediente antes de guardar.")
  let record: Profile = {}
  if (raw) {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("El registro del cliente no es legible; no se sobrescribió.")
    record = parsed
  }
  return { schemaVersion: 3, legacyUnassigned: record.legacyUnassigned ?? (record.schemaVersion !== 3 && Object.keys(record).length ? record : undefined),
    profiles: { ...(record.profiles || {}), [clientId]: { ...profile, expedienteId: clientId } } }
}

/** Commit a finished file read against the latest profile, never its pre-await UI snapshot. */
export function appendClientProfileDocument(storage: Pick<Storage, "getItem" | "setItem">, key: string, clientId: string, document: Profile, trace: Profile) {
  const raw = storage.getItem(key)
  const latest = readClientProfile(raw, clientId)
  if (latest.documentos !== undefined && !Array.isArray(latest.documentos) || latest.trazabilidad !== undefined && !Array.isArray(latest.trazabilidad)) throw new Error("El expediente necesita revisión antes de agregar archivos.")
  const next = { ...latest, documentos: [...(latest.documentos || []), document], trazabilidad: [trace, ...(latest.trazabilidad || [])], validation: null }
  storage.setItem(key, JSON.stringify(mergeClientProfile(raw, clientId, next)))
  return next
}
