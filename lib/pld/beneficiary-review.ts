import { reviewSignature } from "./module-continuity"

/** A document's claimed hash is not a substitute for the actual file reference
 * or version. Bind the complete reviewed document and declaration content. */
export function beneficiaryReviewSignature(profile: Record<string, any>) {
  return reviewSignature({
    preguntas: Array.isArray(profile.preguntas) ? profile.preguntas.map(({ id, answer, notes }: Record<string, unknown>) => ({ id, answer, notes })) : [],
    documentos: profile.documentos ?? [],
    declaraciones: profile.declaraciones ?? [],
    clientType: profile.clientType ?? null,
    propertyChain: profile.propertyChain ?? [],
    screeningResults: profile.screeningResults ?? [],
    lastBCUpdate: profile.lastBCUpdate ?? null,
  })
}
