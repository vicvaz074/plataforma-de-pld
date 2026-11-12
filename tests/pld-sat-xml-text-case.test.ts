import assert from "node:assert/strict"
import test from "node:test"
import { buildPresentationCases } from "../lib/demo/pld-presentation-cases"
import { buildDefaultPldTenants } from "../lib/pld/tenants"
import { normalizeGeneratedSatXmlText, validateGeneratedSatXml } from "../lib/pld/sat-xml-validation"

test("edited mixed-case identity fields retain valid XV output without changing captured XML inputs", () => {
  const tenant = buildDefaultPldTenants("case-qa").tenants[0]
  const original = buildPresentationCases(tenant, new Date("2026-11-11T18:00:00Z")).packages[0].xml
  assert.equal(validateGeneratedSatXml(original).valid, true)
  const edited = original.replace("DESARROLLOS LAGO VERDE", "Desarrollos Lago Verde")
    .replace("DANIEL", "Daniel").replace("HERRERA", "Herrera").replace("CRUZ", "Cruz")
    .replace("ADRIANA", "Adriana").replace("LUNA", "Luna").replace("PAREDES", "Paredes")
    .replace("ADMINISTRACION@LAGOVERDE.DEMO", "administracion@lagoverde.demo")
  assert.equal(validateGeneratedSatXml(edited).valid, false)
  assert.equal(normalizeGeneratedSatXmlText(edited), original)
  assert.equal(validateGeneratedSatXml(normalizeGeneratedSatXmlText(edited)).valid, true)
  assert.match(edited, /<nombre>Daniel<\/nombre>/)
})

test("case-sensitive virtual-asset identifiers and hashes are never uppercased to silence XSD errors", () => {
  const xml = `<archivo xmlns="http://www.uif.shcp.gob.mx/recepcion/avi"><informe><aviso><operaciones_persona><persona_aviso><datos_cuenta_plataforma><id_usuario>WalletAa9</id_usuario><cuenta_relacionada>bc1qAbCdEf</cuenta_relacionada></datos_cuenta_plataforma><tipo_persona><persona_fisica><nombre>Daniel</nombre></persona_fisica></tipo_persona></persona_aviso><detalle_operaciones><operaciones_compra><compra><hash_operacion>aB01fE</hash_operacion></compra></operaciones_compra></detalle_operaciones></operaciones_persona></aviso></informe></archivo>`
  const normalized = normalizeGeneratedSatXmlText(xml)
  assert.equal(normalized, xml.replace("<nombre>Daniel</nombre>", "<nombre>DANIEL</nombre>"))
  assert.match(normalized, /<hash_operacion>aB01fE<\/hash_operacion>/)
})

test("unsupported namespaces and invalid accents are not silently changed", () => {
  const unknown = '<archivo xmlns="https://example.test"><nombre>Daniel</nombre></archivo>'
  assert.equal(normalizeGeneratedSatXmlText(unknown), unknown)
  const xml = '<archivo xmlns="http://www.uif.shcp.gob.mx/recepcion/ari"><informe><aviso><persona_aviso><tipo_persona><persona_fisica><nombre>José</nombre></persona_fisica></tipo_persona></persona_aviso></aviso></informe></archivo>'
  assert.equal(normalizeGeneratedSatXmlText(xml), xml)
})

test("repeated persons retain independent names including unchanged and empty occurrences", () => {
  const xml = '<archivo xmlns="http://www.uif.shcp.gob.mx/recepcion/ari"><informe><aviso><dueno_beneficiario><tipo_persona><persona_fisica><nombre>Ana</nombre></persona_fisica></tipo_persona></dueno_beneficiario><dueno_beneficiario><tipo_persona><persona_fisica><nombre/></persona_fisica></tipo_persona></dueno_beneficiario><dueno_beneficiario><tipo_persona><persona_fisica><nombre>LUIS</nombre></persona_fisica></tipo_persona></dueno_beneficiario><dueno_beneficiario><tipo_persona><persona_fisica><nombre>Daniel</nombre></persona_fisica></tipo_persona></dueno_beneficiario></aviso></informe></archivo>'
  assert.equal(normalizeGeneratedSatXmlText(xml), xml.replace("<nombre>Ana</nombre>", "<nombre>ANA</nombre>").replace("<nombre>Daniel</nombre>", "<nombre>DANIEL</nombre>"))
})
