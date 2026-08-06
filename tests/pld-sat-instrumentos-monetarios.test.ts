import assert from "node:assert/strict"
import test from "node:test"

import { filterSearchableSelectOptions } from "../components/pld/searchable-select"
import {
  normalizeSatInstrumentoMonetarioOptions,
  SAT_INSTRUMENTO_MONETARIO_OPTIONS,
} from "../lib/pld/sat-instrumentos-monetarios"

test("instrumento monetario conserva el catálogo oficial completo", () => {
  assert.equal(SAT_INSTRUMENTO_MONETARIO_OPTIONS.length, 16)
  assert.deepEqual(
    SAT_INSTRUMENTO_MONETARIO_OPTIONS.at(-1),
    { value: "16", label: "Activos Virtuales" },
  )
  assert.equal(
    SAT_INSTRUMENTO_MONETARIO_OPTIONS.find((option) => option.value === "8")?.label,
    "Transferencia Interbancaria",
  )
})

test("instrumento monetario filtra sin acentos y conserva el código SAT", () => {
  assert.deepEqual(
    filterSearchableSelectOptions(SAT_INSTRUMENTO_MONETARIO_OPTIONS, "credito").map(
      ({ value }) => value,
    ),
    ["2"],
  )
  assert.deepEqual(
    filterSearchableSelectOptions(SAT_INSTRUMENTO_MONETARIO_OPTIONS, "transferencia misma").map(
      ({ value }) => value,
    ),
    ["9"],
  )
  assert.equal(filterSearchableSelectOptions(SAT_INSTRUMENTO_MONETARIO_OPTIONS, "16")[0]?.label, "Activos Virtuales")
})

test("instrumento monetario normaliza opciones provenientes de XLSM y usa respaldo oficial", () => {
  assert.deepEqual(
    normalizeSatInstrumentoMonetarioOptions([
      "1,Efectivo",
      "8,Transferencia Interbancaria",
    ]),
    [
      { value: "1", label: "Efectivo" },
      { value: "8", label: "Transferencia Interbancaria" },
    ],
  )
  assert.deepEqual(
    normalizeSatInstrumentoMonetarioOptions([]),
    SAT_INSTRUMENTO_MONETARIO_OPTIONS,
  )
})
