import assert from "node:assert/strict"
import test from "node:test"

import {
  filterSearchableSelectOptions,
  getSearchableSelectSelectionLabel,
  getSearchableSelectSelectionIndex,
  normalizeSearchableSelectOptions,
  normalizeSearchableSelectText,
} from "../components/pld/searchable-select"
import { PAISES } from "../lib/data/paises"

const options = [
  "Comercio al por menor",
  {
    value: "541110",
    label: "Servicios jurídicos",
    keywords: ["abogados", "asesoría legal"],
  },
  {
    value: "531120",
    label: "Alquiler sin intermediación de bienes raíces",
  },
] as const

test("searchable select normalizes accents, case and surrounding whitespace", () => {
  assert.equal(normalizeSearchableSelectText("  ASESORÍA Jurídica  "), "asesoria juridica")
})

test("searchable select accepts strings and value-label options", () => {
  assert.deepEqual(normalizeSearchableSelectOptions(options), [
    {
      value: "Comercio al por menor",
      label: "Comercio al por menor",
    },
    {
      value: "541110",
      label: "Servicios jurídicos",
      keywords: ["abogados", "asesoría legal"],
    },
    {
      value: "531120",
      label: "Alquiler sin intermediación de bienes raíces",
    },
  ])
})

test("searchable select filters accent-insensitively by label, value and keywords", () => {
  assert.deepEqual(
    filterSearchableSelectOptions(options, "juridicos").map(({ value }) => value),
    ["541110"],
  )
  assert.deepEqual(
    filterSearchableSelectOptions(options, "asesoria legal").map(({ value }) => value),
    ["541110"],
  )
  assert.deepEqual(
    filterSearchableSelectOptions(options, "531120").map(({ value }) => value),
    ["531120"],
  )
  assert.equal(filterSearchableSelectOptions(options, "actividad inexistente").length, 0)
})

test("country searches match names with or without accents and their ISO code", () => {
  const countryOptions = PAISES.map((country) => ({
    value: country.code,
    label: country.label,
    keywords: [country.code],
  }))

  assert.deepEqual(
    filterSearchableSelectOptions(countryOptions, "mexico").map(({ value }) => value),
    ["MX"],
  )
  assert.deepEqual(
    filterSearchableSelectOptions(countryOptions, "espana").map(({ value }) => value),
    ["ES"],
  )
  assert.equal(filterSearchableSelectOptions(countryOptions, "mx")[0]?.value, "MX")
})

test("searchable select returns every option for an empty query and removes duplicate values", () => {
  const duplicated = [...options, { value: "541110", label: "Etiqueta duplicada" }]
  const filtered = filterSearchableSelectOptions(duplicated, "")

  assert.equal(filtered.length, 3)
  assert.equal(filtered.find(({ value }) => value === "541110")?.label, "Servicios jurídicos")
})

test("searchable select shows the configured label and preserves a legacy value", () => {
  assert.equal(getSearchableSelectSelectionLabel(options, "541110"), "Servicios jurídicos")
  assert.equal(
    getSearchableSelectSelectionLabel(options, "Giro histórico no catalogado"),
    "Giro histórico no catalogado",
  )
  assert.equal(getSearchableSelectSelectionLabel(options, ""), "")
})

test("searchable select activates the current value instead of the first option when opened", () => {
  assert.equal(getSearchableSelectSelectionIndex(options, "541110"), 1)
  assert.equal(getSearchableSelectSelectionIndex(options, "Giro histórico no catalogado"), -1)
  assert.equal(getSearchableSelectSelectionIndex(options, ""), -1)
})
