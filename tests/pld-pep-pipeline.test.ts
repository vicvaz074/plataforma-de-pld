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
