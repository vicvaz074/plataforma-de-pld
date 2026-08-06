import assert from "node:assert/strict"
import test from "node:test"

import {
  applyEmbeddedSearchableSelectOtherText,
  applyEmbeddedSearchableSelectSelection,
  applySeparateSearchableSelectSelection,
  getEmbeddedSearchableSelectOtherText,
  getSearchableSelectWithOtherSelection,
} from "../components/pld/searchable-select-with-other"

const streetOptions = ["Calle", "Prolongación", "Otro"] as const

test("derives catalog selections without case or accent sensitivity", () => {
  assert.equal(
    getSearchableSelectWithOtherSelection(
      streetOptions,
      "  PROLONGACION ",
      "Otro",
    ),
    "Prolongación",
  )
  assert.equal(
    getSearchableSelectWithOtherSelection(streetOptions, "calle", "Otro"),
    "Calle",
  )
  assert.equal(
    getSearchableSelectWithOtherSelection(streetOptions, "", "Otro"),
    "",
  )
})

test("embedded mode presents legacy custom values as Otro without losing their text", () => {
  assert.equal(
    getSearchableSelectWithOtherSelection(streetOptions, "EJE VIAL", "Otro"),
    "Otro",
  )
  assert.equal(
    getEmbeddedSearchableSelectOtherText(streetOptions, "EJE VIAL"),
    "EJE VIAL",
  )
  assert.equal(
    getEmbeddedSearchableSelectOtherText(streetOptions, "prolongacion"),
    "",
  )
})

test("embedded mode preserves a custom value when Otro is reselected", () => {
  assert.equal(
    applyEmbeddedSearchableSelectSelection(
      streetOptions,
      "Sendero peatonal",
      "otro",
      "Otro",
    ),
    "Sendero peatonal",
  )
  assert.equal(
    applyEmbeddedSearchableSelectSelection(
      streetOptions,
      "Calle",
      "OTRO",
      "Otro",
    ),
    "Otro",
  )
})

test("embedded mode stores custom text directly and keeps Otro selected when cleared", () => {
  assert.equal(
    applyEmbeddedSearchableSelectOtherText("Sendero peatonal", "Otro"),
    "Sendero peatonal",
  )
  assert.equal(applyEmbeddedSearchableSelectOtherText("", "Otro"), "Otro")
  assert.equal(applyEmbeddedSearchableSelectOtherText("   ", "Otro"), "Otro")
})

test("embedded mode canonicalizes a regular option and clears its custom branch", () => {
  assert.equal(
    applyEmbeddedSearchableSelectSelection(
      streetOptions,
      "EJE VIAL",
      "prolongacion",
      "Otro",
    ),
    "Prolongación",
  )
})

test("separate mode keeps the configured code for Otro and clears text only on another branch", () => {
  const codedOptions = [
    { value: "01", label: "Inmueble" },
    { value: "99", label: "Otro" },
  ] as const

  assert.deepEqual(
    applySeparateSearchableSelectSelection(codedOptions, "otro", "99"),
    { value: "99", clearOtherText: false },
  )
  assert.deepEqual(
    applySeparateSearchableSelectSelection(codedOptions, "INMUEBLE", "99"),
    { value: "01", clearOtherText: true },
  )
  assert.deepEqual(
    applySeparateSearchableSelectSelection(codedOptions, "01", "99"),
    { value: "01", clearOtherText: true },
  )
})
