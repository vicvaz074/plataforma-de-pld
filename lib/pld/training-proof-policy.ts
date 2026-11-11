/** Internal documentary review policy, NOT a legal expiry for REC certification.
 * DOF Acuerdo115/2026 arts.39 Bis/39 Bis1/transitoryVII (consulted2026-11-11)
 * concerns annual training programmes, first period2027; it does not establish
 * a generic365-day validity of every certificate. */
export const INTERNAL_TRAINING_REVIEW_DAYS=365
export function getTrainingProofPolicy(input:{date?:string;hasDocument:boolean;now?:Date}) {
  const date=input.date?.slice(0,10) || ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return {ready:false,status:"missing-date" as const,days:null}
  const parsed=new Date(`${date}T00:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==date) return {ready:false,status:"invalid-date" as const,days:null}
  const parts=new Intl.DateTimeFormat("en",{timeZone:"America/Mexico_City",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(input.now || new Date())
  const part=(name:string)=>parts.find((item)=>item.type===name)?.value || ""
  const today=new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00.000Z`)
  const days=Math.floor((today.getTime()-parsed.getTime())/86_400_000)
  if (days<0) return {ready:false,status:"future-date" as const,days}
  if (!input.hasDocument) return {ready:false,status:"missing-document" as const,days}
  if (days>INTERNAL_TRAINING_REVIEW_DAYS) return {ready:false,status:"review-due" as const,days}
  return {ready:true,status:"documented" as const,days}
}
