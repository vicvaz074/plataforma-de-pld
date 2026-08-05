import assert from "node:assert/strict"
import test from "node:test"

import {
  filterSatCatalogOptions,
  formatSatCatalogOption,
  getSatCatalogSelectionLabel,
} from "../components/pld/sat-catalog-combobox"
import type { SatEuiCatalogOption } from "../lib/pld/expediente-eui"

const OPTIONS: SatEuiCatalogOption[] = [
  {
    value: "1100001",
    code: "1100001",
    label: "SECTOR PRIMARIO - AGRICULTURA",
  },
  {
    value: "5610015",
    code: "5610015",
    label: "SERVICIOS PROFESIONALES Y TÉCNICOS - SERVICIOS JURÍDICOS",
  },
]

test("SAT catalog search matches codes and accent-insensitive labels", () => {
  assert.equal(filterSatCatalogOptions(OPTIONS, ""), OPTIONS)
  assert.deepEqual(
    filterSatCatalogOptions(OPTIONS, "5610015").map((option) => option.value),
    ["5610015"],
  )
  assert.deepEqual(
    filterSatCatalogOptions(OPTIONS, "servicios juridicos").map((option) => option.value),
    ["5610015"],
  )
  assert.deepEqual(
    filterSatCatalogOptions(OPTIONS, "actividad inexistente"),
    [],
  )
})

test("SAT catalog selection displays code and label without changing the persisted value", () => {
  assert.equal(
    formatSatCatalogOption(OPTIONS[1]),
    "5610015 · SERVICIOS PROFESIONALES Y TÉCNICOS - SERVICIOS JURÍDICOS",
  )
  assert.equal(
    getSatCatalogSelectionLabel(OPTIONS, "5610015"),
    "5610015 · SERVICIOS PROFESIONALES Y TÉCNICOS - SERVICIOS JURÍDICOS",
  )
  assert.equal(getSatCatalogSelectionLabel(OPTIONS, "valor-legacy"), "valor-legacy")
})
