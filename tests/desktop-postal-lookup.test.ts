import assert from "node:assert/strict"
import test from "node:test"
import { lookupBundledPostalCode } from "../lib/data/postal-lookup"

test("la consulta postal no transmite el código capturado fuera de la instalación", async () => {
  const requests: string[] = []
  const original = globalThis.fetch
  try {
    globalThis.fetch = async (url, init) => {
      requests.push(String(url))
      assert.equal(init?.redirect, "error")
      return Response.json({ records: [{ codigo: "11280", estado: "DF", municipio: "Miguel Hidalgo", asentamientos: ["Torre Blanca"] }] })
    }
    assert.equal(await lookupBundledPostalCode("inválido"), undefined)
    assert.equal((await lookupBundledPostalCode("11280"))?.municipio,"Miguel Hidalgo")
    assert.equal(await lookupBundledPostalCode("99999"), undefined)
    assert.deepEqual(requests, ["/data/sat-postal-catalog-mx.json"])
  } finally {
    globalThis.fetch=original
  }
})
