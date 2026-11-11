import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { buildSatDynamicOperationForm, normalizeSatXlsmLayout, satFieldValuesToWorkbookCells } from "../lib/pld/sat-xlsm"
import { resolveSatTemplateForActividad } from "../lib/pld/sat-template-catalog"

const template=resolveSatTemplateForActividad("fraccion-xv-uso-goce")
const layout=normalizeSatXlsmLayout(JSON.parse(readFileSync(`public/data/sat-xlsm-layouts/${template.templateId}.json`,"utf8")))
const context={sujetoObligadoRfc:"EQA260101AB1",clienteRfc:"DLV190624M32",representanteRfc:"HECD820412L98",
  beneficiarioTipoPersona:"persona_fisica",beneficiarioPfRfc:"LUPA7906228V4",beneficiarioPfNombre:"Adriana",clienteTipoPersona:"persona_moral",clienteRazonSocial:"CLIENTE FICTICIO"}

test("SAT prefill keeps subject, client, representative and beneficiary RFCs separate; optional header stays blank",()=>{
  const values=buildSatDynamicOperationForm({template,layout,prefill:context}).initialValues
  assert.equal(values["persona_aviso.sujeto_obligado_rfc"],context.sujetoObligadoRfc)
  assert.equal(values["persona_aviso.pm.rfc"],context.clienteRfc)
  assert.equal(values["persona_aviso.representante.rfc"],context.representanteRfc)
  assert.equal(values["beneficiario.pf.rfc"],context.beneficiarioPfRfc)
  for(const field of layout.sections.flatMap(section=>section.fields).filter(field=>field.label.includes("Entidad colegiada")))assert.equal(values[field.id],undefined,field.id)
})

test("an explicitly captured collegiate entity RFC is preserved, not removed by coincidence or inferred from a customer",()=>{
  const header=layout.sections.flatMap(section=>section.fields).find(field=>field.cell==="C9"&&field.label.includes("Entidad colegiada"))!
  const values=buildSatDynamicOperationForm({template,layout,prefill:context}).initialValues
  const genuine="COE200101AB1"
  const cells=satFieldValuesToWorkbookCells({...values,[header.id]:genuine},layout)
  assert.equal(cells[`${header.sheetName}!${header.cell}`],genuine)
})
