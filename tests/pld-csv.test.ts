import test from "node:test"
import assert from "node:assert/strict"
import { csvCell, serializeCsv } from "../lib/pld/csv"

test("CSV preserves text and quoting without promoting collaborator content to formulas", () => {
  for (const text of ["=1+1", "+SUM(A1)", "-2+3", "@SUM(A1)", " \t=HYPERLINK(\"x\")", "\ufeff=1", "\u200b=1", "\ttext", "\rtext"]) assert.ok(csvCell(text).startsWith("\"'"), JSON.stringify(text))
  assert.equal(csvCell(-12.50), '"-12.5"')
  assert.equal(serializeCsv([["Razón social", 'Comillas "uno", dos\ntres', 10_000_000], ["México", null, 0]]), '"Razón social","Comillas ""uno"", dos\ntres","10000000"\r\n"México","","0"')
})
