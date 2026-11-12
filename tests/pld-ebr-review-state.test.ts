import assert from "node:assert/strict"
import test from "node:test"
import { currentStoredEbrRisk, ebrApprovalView, ebrPepReviewBasis, findCurrentEbrWhois, retainUnchangedPepScreeningDate } from "../lib/pld/ebr-review-state"
import { getIntegrationClient } from "../lib/pld/integration-records"

test("approved display uses its saved summary; changed PEP identity, date or content requires a new review", () => {
  const input = { identity: { id: "client", nombre: "Persona", identifier: "RFC" }, cargo: "Servidor", dependencia: "Dependencia", screening: { status: "sin-coincidencia" }, whois: { status: "coincidencia_alta", checkedAt: "2026-11-11", results: [{ id: "hit" }] } }
  const basis = ebrPepReviewBasis(input)
  const saved = { workflow: { status: "approved" }, riskSummary: { level: "Reforzado", percent: 83 }, pepReviewBasis: basis }
  const original = JSON.stringify(saved)
  const approved = ebrApprovalView({ saved, changed: false, pepReviewBasis: basis, reviewOverdue: false, preliminaryLevel: "Bajo", preliminaryPercent: 12 })
  assert.equal(approved.isCurrentApproved, true); assert.equal(approved.level, "Reforzado"); assert.equal(approved.percent, 83)
  for (const changed of [
    { ...input, cargo: "Otro cargo" }, { ...input, dependencia: "Otra dependencia" },
    { ...input, identity: { ...input.identity, nombre: "Otra persona" } },
    { ...input, whois: { ...input.whois, status: "sin_coincidencias" } },
    { ...input, whois: { ...input.whois, checkedAt: "2026-11-12" } },
    { ...input, whois: { ...input.whois, results: [{ id: "another-hit-same-status" }] } },
  ]) {
    const view = ebrApprovalView({ saved, changed: false, pepReviewBasis: ebrPepReviewBasis(changed), reviewOverdue: false, preliminaryLevel: "Bajo", preliminaryPercent: 12 })
    assert.equal(view.isCurrentApproved, false); assert.equal(view.sourceChanged, true); assert.equal(view.level, "Bajo")
    assert.deepEqual(view.historicalApproved, saved.riskSummary)
  }
  assert.equal(JSON.stringify(saved), original, "historical approved data must not be overwritten")
  assert.equal(ebrApprovalView({ saved: { ...saved, pepReviewBasis: undefined }, changed: false, pepReviewBasis: basis, reviewOverdue: false, preliminaryLevel: "Bajo", preliminaryPercent: 12 }).isCurrentApproved, false, "legacy approval lacks proof of current PEP source review")
})

test("rerendering the unchanged local catalog does not fabricate a new screening consultation", () => {
  const saved = { checkedAt: "2026-11-11", status: "sin-coincidencia", matches: [] }
  const rendered = { ...saved, checkedAt: "2026-11-12" }
  assert.equal(retainUnchangedPepScreeningDate(rendered, saved).checkedAt, saved.checkedAt)
  assert.equal(retainUnchangedPepScreeningDate({ ...rendered, status: "posible-pep" }, saved).checkedAt, rendered.checkedAt)
})

test("operational consumers never expose a historical EBR risk as current after a live PEP change", () => {
  const client=getIntegrationClient({expedienteId:"client-one",nombre:"Persona ficticia",rfc:"AAA010101AAA"})!
  const whois={expedienteId:client.id,query:{nombre:client.nombre,relacion:"cliente"},status:"sin_coincidencia",checkedAt:"2026-11-10T10:00:00.000Z",results:[],appliedDecisions:[],sourceSnapshots:[],recommendation:"Documentar revisión"}
  const identity={id:client.id,nombre:client.nombre,identifier:client.identifier,rfc:client.rfc,identifiers:client.identifiers}
  const saved={schemaVersion:3,clientId:client.id,workflow:{status:"approved"},riskSummary:{level:"Bajo",score:9,percent:15},pepWhoisSnapshot:whois,reviewPlan:{nextReviewAt:"2026-12-12"},pepReviewBasis:ebrPepReviewBasis({identity,screening:null,whois})}
  const original=JSON.stringify(saved),at=new Date("2026-11-11T12:00:00.000Z")
  assert.deepEqual(currentStoredEbrRisk(saved,client,[whois],at),saved.riskSummary,"Unchanged reviewed source remains current")
  for(const latest of [
    {...whois,checkedAt:"2026-11-11T10:00:00.000Z"},
    {...whois,status:"coincidencia_alta",checkedAt:"2026-11-11T10:00:00.000Z"},
    {...whois,recommendation:"Otra evidencia; mismo estado"},
    {...whois,query:{...whois.query,nombre:"Otra persona"}},
  ])assert.equal(currentStoredEbrRisk(saved,client,[latest,whois],at),null,"New date, same-label content or a changed result requires review")
  assert.equal(currentStoredEbrRisk(saved,{...client,nombre:"Nueva identidad"},[whois],at),null)
  assert.equal(currentStoredEbrRisk({...saved,pepReviewBasis:undefined},client,[whois],at),null,"Legacy unknown review basis remains pending")
  assert.equal(currentStoredEbrRisk({...saved,schemaVersion:2},client,[whois],at),null)
  assert.equal(currentStoredEbrRisk({...saved,workflow:{status:"draft"}},client,[whois],at),null)
  assert.equal(currentStoredEbrRisk(saved,client,[{...whois,query:{nombre:42}}],at),null)
  assert.equal(currentStoredEbrRisk(saved,client,null,at),null)
  assert.equal(currentStoredEbrRisk(saved,client,[whois],new Date("2026-12-12T01:00:00Z")),null)
  assert.equal(findCurrentEbrWhois([whois,{...whois,checkedAt:"2026-11-11T10:00:00.000Z"}],client.id)?.checkedAt,"2026-11-11T10:00:00.000Z","The latest ID-bound consultation is used even if storage ordering differs")
  assert.equal(JSON.stringify(saved),original,"Read views do not overwrite the saved approval or risk summary")
})
