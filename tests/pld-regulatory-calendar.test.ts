import assert from "node:assert/strict"
import test from "node:test"
import { AUDIT_2026_CHECKLIST, AUDIT_2026_SECTIONS, RCG_2026_MILESTONES, regulatoryMilestoneStatus } from "../lib/pld/regulatory-calendar"
import { restoreAuditWorkflow } from "../lib/pld/module-continuity"
import { normativeDocuments } from "../lib/pld/legal-framework"

test("reforma publicada no equivale a exigibilidad anticipada o formatos disponibles", () => {
  for (const milestone of RCG_2026_MILESTONES) {
    assert.equal(regulatoryMilestoneStatus(milestone.date, "2026-09-28"), milestone.date ? "programado" : "pendiente-resolucion")
    if (milestone.date) assert.equal(regulatoryMilestoneStatus(milestone.date, milestone.date), "fecha-alcanzada")
  }
  assert.equal(regulatoryMilestoneStatus(null, "2030-01-01"), "pendiente-resolucion")
  assert.throws(() => regulatoryMilestoneStatus("2027-03-01", "incorrecta"))
  const rcg = normativeDocuments.find((item) => item.id === "rcg-lfpiorpi")!
  assert.equal(rcg.status, "reformado")
  assert.equal(rcg.lastReform, "2026-08-07")
})

test("auditoría: siete secciones, confirmaciones nuevas y conservación del historial", () => {
  assert.equal(AUDIT_2026_SECTIONS.length, 7)
  const restored = restoreAuditWorkflow({ schemaVersion: 2, finalChecklist: { certificado: true, envio: true, acciones: true } },
    { responses: {}, scopeAnswers: {}, reviewAnswers: {},
      finalChecklist: Object.fromEntries(AUDIT_2026_CHECKLIST.map((item) => [item.id, false])) })
  assert.equal(restored.finalChecklist.certificado, true, "historial CNBV conservado, no reinterpretado")
  assert.equal(restored.finalChecklist.acciones, true)
  assert.equal(restored.finalChecklist["rcg2026-certificacion"], false)
  assert.equal(restored.finalChecklist["rcg2026-entrega"], false)
})
