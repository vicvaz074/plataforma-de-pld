import assert from "node:assert/strict"
import test from "node:test"

import {
  filterNormativeDocuments,
  filterNormativeObligations,
  normativeDocuments,
  normativeObligations,
  normativeUpdates,
} from "../lib/pld/legal-framework"

test("normative documents include official source metadata", () => {
  assert.ok(normativeDocuments.length >= 30)

  for (const document of normativeDocuments) {
    assert.ok(document.id, "document must have id")
    assert.ok(document.title, `${document.id} must have title`)
    assert.ok(document.authority, `${document.id} must have authority`)
    assert.ok(document.sector, `${document.id} must have sector`)
    assert.ok(document.hierarchy, `${document.id} must have hierarchy`)
    assert.ok(document.status, `${document.id} must have status`)
    assert.ok(document.reviewedAt, `${document.id} must have reviewedAt`)
    assert.match(document.url, /^https?:\/\//, `${document.id} must have official URL`)
    assert.ok(document.operationalImpact, `${document.id} must explain operational impact`)
    assert.ok(document.tags.length > 0, `${document.id} must have tags`)
    assert.ok(document.relatedModules.length > 0, `${document.id} must map to modules`)
  }
})

test("operational obligations include foundation and impacted module", () => {
  const documentIds = new Set(normativeDocuments.map((document) => document.id))

  for (const obligation of normativeObligations) {
    assert.ok(obligation.module, `${obligation.id} must map to a module`)
    assert.match(obligation.moduleHref, /^\//, `${obligation.id} must link to app route`)
    assert.ok(obligation.foundation, `${obligation.id} must include legal foundation`)
    assert.ok(obligation.impact, `${obligation.id} must include operational impact`)
    assert.ok(obligation.sourceDocumentIds.length > 0, `${obligation.id} must cite source documents`)

    for (const sourceId of obligation.sourceDocumentIds) {
      assert.ok(documentIds.has(sourceId), `${obligation.id} cites missing document ${sourceId}`)
    }
  }
})

test("legal framework search works accent-insensitively for key PLD terms", () => {
  const cases = [
    ["PEP", "reglamento-lfpiorpi-2026"],
    ["beneficiario controlador", "lfpiorpi-vigente"],
    ["27 Bis", "rcg-lfpiorpi"],
    ["V Bis", "dof-reforma-lfpiorpi-2025"],
    ["CNBV", "guia-cnbv-ebr"],
    ["conservacion 10 anos", "sppld-preguntas"],
  ] as const

  for (const [query, expectedId] of cases) {
    const results = filterNormativeDocuments(normativeDocuments, { query })
    assert.ok(
      results.some((document) => document.id === expectedId),
      `expected ${expectedId} for query ${query}`,
    )
  }
})

test("operational map search finds module obligations", () => {
  assert.ok(filterNormativeObligations(normativeObligations, "aviso 24h").some((item) => item.id === "aviso-24h"))
  assert.ok(filterNormativeObligations(normativeObligations, "conservacion 10 anos").some((item) => item.id === "resguardo-evidencias"))
  assert.ok(filterNormativeObligations(normativeObligations, "beneficiario controlador").some((item) => item.id === "beneficiario-controlador"))
})

test("recent legal timeline includes 2025 LFPIORPI and 2026 Reglamento reforms", () => {
  assert.ok(normativeUpdates.some((update) => update.date === "2025-07-16" && update.title.includes("LFPIORPI")))
  assert.ok(normativeUpdates.some((update) => update.date === "2026-03-27" && update.title.includes("Reglamento")))
})
