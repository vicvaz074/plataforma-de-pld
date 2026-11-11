import { reviewSignature } from "./module-continuity"
import { matchPepCargo, normalizeName } from "./pep"
import { assertPepSearchResponse } from "./record-shapes"
import type { IntegrationClient } from "./integration-records"
import type { PepSearchResponse, PepScreeningResult } from "./types"

/** The exact effective source, including identity, lookup date and contents,
 * belongs to the review. Equal risk labels alone never establish equivalence. */
export function ebrPepReviewBasis(input: { identity: unknown; cargo?: string; dependencia?: string; screening?: unknown; whois?: unknown }) {
  return reviewSignature({ identity: input.identity, cargo: input.cargo ?? "", dependencia: input.dependencia ?? "", screening: input.screening ?? null, whois: input.whois ?? null })
}

/** Rendering the same local catalog match again is not a new consultation. */
export function retainUnchangedPepScreeningDate<T extends { checkedAt: string }>(current: T, saved?: T): T {
  if (!saved) return current
  const { checkedAt: _currentDate, ...currentContent } = current
  const { checkedAt: _savedDate, ...savedContent } = saved
  return reviewSignature(currentContent) === reviewSignature(savedContent) ? { ...current, checkedAt: saved.checkedAt } : current
}

export function ebrApprovalView(input: {
  saved?: { workflow?: { status: string }; riskSummary?: { level: string; percent: number }; pepReviewBasis?: string } | null
  changed: boolean; pepReviewBasis: string; reviewOverdue: boolean; preliminaryLevel: string; preliminaryPercent: number
}) {
  const historicalApproved = input.saved?.workflow?.status === "approved" ? input.saved.riskSummary : undefined
  const sourceChanged = Boolean(input.saved && input.saved.pepReviewBasis !== input.pepReviewBasis)
  const reviewPending = input.changed || sourceChanged || input.reviewOverdue || input.preliminaryLevel === "Pendiente"
  const isCurrentApproved = Boolean(historicalApproved && !reviewPending)
  return { isCurrentApproved, sourceChanged, reviewPending, historicalApproved,
    level: isCurrentApproved ? historicalApproved!.level : input.preliminaryLevel,
    percent: isCurrentApproved ? historicalApproved!.percent : input.preliminaryPercent }
}

type Data = Record<string, any>
const record = (value: unknown): value is Data => Boolean(value && typeof value === "object" && !Array.isArray(value))

/** A current source is selected by stable expediente ID, never by a risk label. */
export function findCurrentEbrWhois(history: unknown, clientId: string): PepSearchResponse | null {
  if (!Array.isArray(history)) throw new Error("El historial PEP no contiene una colección válida.")
  history.forEach(assertPepSearchResponse)
  const matches = history.filter(item => item.expedienteId === clientId)
  if (matches.some(item => !Number.isFinite(Date.parse(item.checkedAt)))) throw new Error("La fecha de consulta PEP no es válida.")
  return matches.reduce((latest: PepSearchResponse | null,item: PepSearchResponse) => !latest || Date.parse(item.checkedAt) > Date.parse(latest.checkedAt) ? item : latest,null)
}

/** Read-only operational view. A saved approval is historical unless its exact
 * client and effective PEP sources still match the reviewed basis. */
export function currentStoredEbrRisk(saved: unknown, client: IntegrationClient | null, whoisHistory: unknown, now = new Date()): {level:string;score:number;percent:number} | null {
  if (!record(saved) || !client || saved.archivedAt || saved.schemaVersion !== 3 || saved.workflow?.status !== "approved" || saved.needsMigrationReview || typeof saved.pepReviewBasis !== "string") return null
  if (saved.expedienteId !== client.id && saved.clientId !== client.id) return null
  const risk = saved.riskSummary
  if (!record(risk) || !["Bajo","Medio","Alto","Reforzado"].includes(risk.level) || !Number.isFinite(risk.score) || !Number.isFinite(risk.percent)) return null
  const reviewDate = saved.reviewPlan?.nextReviewAt
  if (typeof reviewDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(reviewDate) || !Number.isFinite(Date.parse(reviewDate)) || reviewDate <= now.toISOString().slice(0,10)) return null
  try {
    const whois = findCurrentEbrWhois(whoisHistory,client.id)
    if (whois?.query.nombre && normalizeName(whois.query.nombre) !== normalizeName(client.nombre)) return null
    const cargo = typeof saved.pepCargo === "string" ? saved.pepCargo : "", dependencia = typeof saved.pepDependencia === "string" ? saved.pepDependencia : ""
    const screening = cargo.trim() || dependencia.trim() ? retainUnchangedPepScreeningDate(matchPepCargo({nombre:client.nombre,cargo,dependencia,relacion:saved.hasBeneficiaryController ? "beneficiario-controlador" : "cliente"}),saved.pepScreening as PepScreeningResult | undefined) : null
    const basis = ebrPepReviewBasis({identity:{id:client.id,nombre:client.nombre,identifier:client.identifier,rfc:client.rfc,identifiers:client.identifiers},cargo,dependencia,screening,whois})
    return basis === saved.pepReviewBasis ? {level:risk.level,score:risk.score,percent:risk.percent} : null
  } catch { return null }
}
