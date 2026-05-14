import test from "node:test"
import assert from "node:assert/strict"

import {
  buildPepCoverageReport,
  extractPepCargoDefinitionsFromText,
  mergePepCargoDefinitions,
  searchPep,
  validatePepSourceFreshness,
} from "../lib/pld"
import type { PepCargo, PepPersonRecord, PepSourceRecord } from "../lib/pld"
import pepCargosSnapshot from "../public/data/pep-cargos-mx.json"
import { parseCurrentConagoGovernors } from "../scripts/pep-gobernadores-utils.mjs"
import { parseDiputadosMembers, parseSenadoMembers } from "../scripts/pep-legislativo-utils.mjs"
import { parseNominaApfRecord } from "../scripts/pep-nomina-apf-utils.mjs"

const pdfTextFixture = `
SECCIÓN I.- ÁMBITO FEDERAL
I.I PODER EJECUTIVO
I.I.1 Presidencia de la República
      • Presidente de la República
      • Secretarios de Estado
I.I.2.J. Secretaría de Economía
      • Secretario de Economía
I.III PODER LEGISLATIVO
      • Senadores
      • Diputados
SECCIÓN II.- ÁMBITO ESTATAL
II.I PODER EJECUTIVO ESTATAL
      • Gobernadores
SECCIÓN III.- ÁMBITO MUNICIPAL
III.I PODER EJECUTIVO MUNICIPAL
      • Presidentes Municipales
SECCIÓN IV.- PARTIDOS POLÍTICOS
      • Presidente Nacional de los Partidos Políticos
      • Secretario General o su equivalente de los Partidos Políticos
`

test("PEP PDF cargo extraction classifies core federal, state, municipal and party cargos", () => {
  const cargos = extractPepCargoDefinitionsFromText(pdfTextFixture, {
    sourceId: "shcp-pdf-2020",
    sourceLabel: "Lista PEP 2020",
    sourceUrl: "file:///Lista_PEPS_2020.pdf",
    extractedAt: "2026-05-11T00:00:00.000Z",
  })

  assert.equal(cargos.some((cargo) => cargo.cargo === "PRESIDENTE DE LA REPÚBLICA" && cargo.ambito === "federal"), true)
  assert.equal(cargos.some((cargo) => cargo.cargo === "SECRETARIO DE ECONOMÍA" && cargo.dependencia === "SECRETARÍA DE ECONOMÍA"), true)
  assert.equal(cargos.some((cargo) => cargo.cargo === "SENADORES" && cargo.poder === "legislativo"), true)
  assert.equal(cargos.some((cargo) => cargo.cargo === "GOBERNADORES" && cargo.ambito === "estatal"), true)
  assert.equal(cargos.some((cargo) => cargo.cargo === "PRESIDENTES MUNICIPALES" && cargo.ambito === "municipal"), true)
  assert.equal(cargos.some((cargo) => cargo.cargo.includes("PARTIDOS POLÍTICOS") && cargo.ambito === "partido"), true)
})

test("PEP cargo merge keeps SHCP/UIF CSV coverage and deduplicates PDF cargos", () => {
  const csvCargos = (pepCargosSnapshot as { cargos: PepCargo[] }).cargos
  const pdfCargos = extractPepCargoDefinitionsFromText(pdfTextFixture, {
    sourceId: "shcp-pdf-2020",
    sourceLabel: "Lista PEP 2020",
    sourceUrl: "file:///Lista_PEPS_2020.pdf",
    extractedAt: "2026-05-11T00:00:00.000Z",
  })

  const merged = mergePepCargoDefinitions({
    csvCargos,
    pdfCargos,
    syncedAt: "2026-05-11T00:00:00.000Z",
  })

  assert.equal(merged.length >= csvCargos.length, true)
  assert.equal(new Set(merged.map((cargo) => cargo.id)).size, merged.length)
  assert.equal(merged.some((cargo) => cargo.cargo === "SECRETARIO DE ECONOMÍA"), true)
  assert.equal(merged.some((cargo) => cargo.sourceIds.includes("shcp-uif-csv")), true)
})

test("PEP coverage report tracks resolved holders, stale sources and review queue", () => {
  const pdfCargos = extractPepCargoDefinitionsFromText(pdfTextFixture, {
    sourceId: "shcp-pdf-2020",
    sourceLabel: "Lista PEP 2020",
    sourceUrl: "file:///Lista_PEPS_2020.pdf",
    extractedAt: "2026-05-11T00:00:00.000Z",
  })
  const merged = mergePepCargoDefinitions({
    csvCargos: [],
    pdfCargos,
    syncedAt: "2026-05-11T00:00:00.000Z",
  })
  const economia = merged.find((cargo) => cargo.cargo === "SECRETARIO DE ECONOMÍA")
  assert.ok(economia)

  const personas: PepPersonRecord[] = [
    {
      id: "mx-federal-se-marcelo-ebrard",
      name: "Marcelo Ebrard Casaubón",
      country: "mx",
      cargoIds: [economia.id],
      positions: [{ cargo: "Secretario de Economía", dependencia: "Secretaría de Economía", desde: "2024-10-01" }],
      source: "public-mx",
      sourceLabel: "Gobierno de México",
      sourceUrl: "https://www.gob.mx/se",
      resolutionStatus: "resolved",
      verifiedAt: "2026-05-11T00:00:00.000Z",
      sourceIds: ["gob-mx-se"],
    },
  ]
  const sources: PepSourceRecord[] = [
    {
      sourceId: "gob-mx-se",
      sourceLabel: "Secretaría de Economía",
      sourceUrl: "https://www.gob.mx/se",
      sourceType: "official-directory",
      lastSyncedAt: "2026-05-11T00:00:00.000Z",
      maxAgeDays: 90,
      status: "active",
    },
    {
      sourceId: "municipios-manual",
      sourceLabel: "Directorio municipal pendiente",
      sourceUrl: "manual://municipios",
      sourceType: "manual-review",
      lastSyncedAt: "2025-01-01T00:00:00.000Z",
      maxAgeDays: 90,
      status: "active",
    },
  ]

  const coverage = buildPepCoverageReport({
    cargos: merged,
    personas,
    sources,
    now: "2026-05-11T00:00:00.000Z",
  })

  assert.equal(coverage.totalCargos, merged.length)
  assert.equal(coverage.cargosConTitular, 1)
  assert.equal(coverage.cargosSinTitular, merged.length - 1)
  assert.equal(coverage.staleSources.some((source) => source.sourceId === "municipios-manual"), true)
  assert.equal(coverage.reviewQueue.some((item) => item.reason === "sin_titular_resuelto"), true)
})

test("PEP coverage report excludes verified non-nominal cargos from pending review queue", () => {
  const cargos = extractPepCargoDefinitionsFromText(pdfTextFixture, {
    sourceId: "shcp-pdf-2020",
    sourceLabel: "Lista PEP 2020",
    sourceUrl: "file:///Lista_PEPS_2020.pdf",
    extractedAt: "2026-05-11T00:00:00.000Z",
  })
  const governors = cargos.find((cargo) => cargo.cargo === "GOBERNADORES")
  assert.ok(governors)

  const coverage = buildPepCoverageReport({
    cargos,
    personas: [],
    sources: [],
    now: "2026-05-11T00:00:00.000Z",
    cargoVerifications: [
      {
        cargoId: governors.id,
        status: "verified_no_nominal_source",
        category: "collective",
        verifiedAt: "2026-05-11T00:00:00.000Z",
        sourceIds: ["conago"],
        note: "Cargo colectivo; fuente nominal estatal parcial cargada por separado.",
      },
    ],
  })

  assert.equal(coverage.cargosVerificadosSinTitular, 1)
  assert.equal(coverage.cargosPendientesRevision, cargos.length - 1)
  assert.equal(coverage.reviewQueue.some((item) => item.cargoId === governors.id), false)
})

test("PEP source freshness validation marks stale and active sources", () => {
  const sources: PepSourceRecord[] = [
    {
      sourceId: "fresh",
      sourceLabel: "Fuente vigente",
      sourceUrl: "https://example.test/fresh",
      sourceType: "official-directory",
      lastSyncedAt: "2026-05-01T00:00:00.000Z",
      maxAgeDays: 45,
      status: "active",
    },
    {
      sourceId: "stale",
      sourceLabel: "Fuente vencida",
      sourceUrl: "https://example.test/stale",
      sourceType: "official-directory",
      lastSyncedAt: "2026-01-01T00:00:00.000Z",
      maxAgeDays: 45,
      status: "active",
    },
  ]

  const result = validatePepSourceFreshness(sources, "2026-05-11T00:00:00.000Z")

  assert.equal(result.fresh.some((source) => source.sourceId === "fresh"), true)
  assert.equal(result.stale.some((source) => source.sourceId === "stale"), true)
})

test("WhoIs PEP uses resolved PepPersonRecord snapshots before cargo-only matches", () => {
  const person: PepPersonRecord = {
    id: "mx-federal-se-marcelo-ebrard",
    name: "Marcelo Ebrard Casaubón",
    aliases: ["Marcelo Luis Ebrard Casaubon"],
    country: "mx",
    cargoIds: ["pep-cargo-secretario-economia"],
    positions: [{ cargo: "Secretario de Economía", dependencia: "Secretaría de Economía", desde: "2024-10-01" }],
    source: "public-mx",
    sourceLabel: "Gobierno de México",
    sourceUrl: "https://www.gob.mx/se",
    resolutionStatus: "resolved",
    verifiedAt: "2026-05-11T00:00:00.000Z",
    sourceIds: ["gob-mx-se"],
  }

  const result = searchPep(
    { nombre: "Marcelo Ebrard Casaubon", relacion: "cliente" },
    {
      personRecords: [person],
      cargos: [
        {
          tipoAdministracionPublica: "CENTRAL",
          entidadAdministracionPublica: "No aplica",
          dependencia: "SECRETARÍA DE ECONOMÍA",
          cargo: "SECRETARIO DE ECONOMÍA",
        },
      ],
      internalRecords: [],
    },
    "2026-05-11T12:00:00.000Z",
  )

  assert.equal(result.status, "coincidencia_alta")
  assert.equal(result.results[0]?.entity.id, "mx-federal-se-marcelo-ebrard")
  assert.equal(result.results[0]?.entity.positions?.[0]?.cargo, "Secretario de Economía")
})

test("Nómina APF parser preserves positions when institution names contain unquoted commas", () => {
  const row = [
    "FIDEL MALDONADO LOPEZ",
    "ADMINISTRACIÓN DEL SISTEMA PORTUARIO NACIONAL ALTAMIRA",
    " S.A. DE C.V.",
    "DIRECTOR GENERAL DE LA ADMINISTRACION DEL SISTEMA PORTUARIO NACIONAL ALTAMIRA",
    " S.A DE C.V",
    "150822",
    "104821.2890625",
  ]

  const record = parseNominaApfRecord(row, {
    nombre: 0,
    institucion: 1,
    puesto: 2,
  }, "Administración del Sistema Portuario Nacional Altamira, S.A. de C.V.")

  assert.equal(record.nombre, "FIDEL MALDONADO LOPEZ")
  assert.equal(record.institucion, "Administración del Sistema Portuario Nacional Altamira, S.A. de C.V.")
  assert.equal(
    record.puesto,
    "DIRECTOR GENERAL DE LA ADMINISTRACION DEL SISTEMA PORTUARIO NACIONAL ALTAMIRA, S.A DE C.V",
  )
})

test("Legislative parser extracts Senate and Chamber member names from official HTML", () => {
  const senadoHtml = `
    <h2>Grupo Parlamentario Morena</h2>
    <p>Sonora</p>
    <h4><a>Sen. Heriberto Marcelo Aguilar Castillo</a></h4>
    <tr><td>2</td><td>Álvarez Lima, José Antonio Cruz</td><td>MORENA</td></tr>
    <p>Ciudad de México</p>
    <h4><a>Sen. Adán Augusto López Hernández</a></h4>
  `
  const diputadosHtml = `
    <a href="curricula.php?dipt=1">1 Abreu Artiñano Rocío Adriana</a> Campeche Circ. 3
    <a href="curricula.php?dipt=2">2 Acosta Islas Anabel</a> Sonora Dtto. 6
  `

  const senadores = parseSenadoMembers(senadoHtml)
  const diputados = parseDiputadosMembers(diputadosHtml)

  assert.deepEqual(
    senadores.map((member) => member.name).sort((first, second) => first.localeCompare(second, "es")),
    ["Adán Augusto López Hernández", "Heriberto Marcelo Aguilar Castillo", "José Antonio Cruz Álvarez Lima"],
  )
  assert.deepEqual(
    diputados.map((member) => member.name),
    ["Abreu Artiñano Rocío Adriana", "Acosta Islas Anabel"],
  )
})

test("CONAGO parser extracts only current governors for the requested date", () => {
  const html = `
    #### Mtra. María Teresa Jiménez Esquivel
    01/10/2022 a 30/09/2028
    Aguascalientes
    #### C.P. Martín Orozco Sandoval
    01/12/2016 a 30/09/2022
    Aguascalientes
    #### Lic. Clara Marina Brugada Molina
    05/10/2024 a 04/10/2030
    Ciudad de México
  `

  const governors = parseCurrentConagoGovernors(html, "2026-05-14")

  assert.deepEqual(
    governors.map((governor) => `${governor.name} · ${governor.state}`),
    ["María Teresa Jiménez Esquivel · Aguascalientes", "Clara Marina Brugada Molina · Ciudad de México"],
  )
})
