import assert from "node:assert/strict"
import test from "node:test"

import { filterActividadesVulnerables } from "../components/pld/actividad-vulnerable-combobox"
import { actividadesVulnerables } from "../lib/data/actividades"

test("activity selector keeps one canonical option per activity key", () => {
  const keys = actividadesVulnerables.map((actividad) => actividad.key)

  assert.equal(new Set(keys).size, keys.length)
  assert.equal(filterActividadesVulnerables(actividadesVulnerables, ""), actividadesVulnerables)
})

test("activity selector search is accent-insensitive across official activity metadata", () => {
  const byName = filterActividadesVulnerables(actividadesVulnerables, "prestamos")
  const byFraction = filterActividadesVulnerables(actividadesVulnerables, "fraccion xi")
  const byExample = filterActividadesVulnerables(actividadesVulnerables, "garantia prendaria")

  assert.equal(byName.some((actividad) => actividad.key === "fraccion-iv-prestamos"), true)
  assert.equal(
    byFraction.every((actividad) => actividad.fraccion.startsWith("Fracción XI")),
    true,
  )
  assert.equal(byFraction.length > 0, true)
  assert.equal(byExample.some((actividad) => actividad.key === "fraccion-iv-prestamos"), true)
  assert.deepEqual(
    filterActividadesVulnerables(actividadesVulnerables, "actividad que no existe"),
    [],
  )
})
