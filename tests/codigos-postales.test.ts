import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import {
  findCodigoPostalInfoInCatalog,
  findSatAddressOption,
  type CodigoPostalInfo,
} from "../lib/data/codigos-postales"

const repoRoot = process.cwd()

test("SAT postal catalog extracted from XLSM Combos includes Miguel Hidalgo CP examples", () => {
  const snapshotPath = path.join(repoRoot, "public/data/sat-postal-catalog-mx.json")
  assert.equal(existsSync(snapshotPath), true, "Run pnpm sync:sat:postal to extract Combos postal data")

  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as { records: CodigoPostalInfo[] }
  const cp11200 = findCodigoPostalInfoInCatalog(snapshot.records, "11200")
  const cp11280 = findCodigoPostalInfoInCatalog(snapshot.records, "11280")

  assert.equal(cp11200?.estado, "DISTRITO FEDERAL")
  assert.equal(cp11200?.municipio, "MIGUEL HIDALGO")
  assert.deepEqual(cp11200?.asentamientos.slice(0, 2), ["LOMAS HERMOSA", "LOMAS DE SOTELO"])

  assert.equal(cp11280?.estado, "DISTRITO FEDERAL")
  assert.equal(cp11280?.municipio, "MIGUEL HIDALGO")
  assert.deepEqual(cp11280?.asentamientos, ["TORRE BLANCA"])
})

test("SAT postal catalog supplies municipality and city for KYC address autofill", () => {
  const snapshotPath = path.join(repoRoot, "public/data/sat-postal-catalog-mx.json")
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as { records: CodigoPostalInfo[] }

  const monterrey = findCodigoPostalInfoInCatalog(snapshot.records, "64000")
  assert.equal(monterrey?.municipio, "MONTERREY")
  assert.equal(monterrey?.ciudad, "MONTERREY")

  const sanPedro = findCodigoPostalInfoInCatalog(snapshot.records, "66260")
  assert.equal(sanPedro?.municipio, "SAN PEDRO GARZA GARCIA")
  assert.equal(sanPedro?.ciudad, "SAN PEDRO GARZA GARCIA")
  assert.ok(sanPedro?.asentamientos.includes("DEL VALLE ORIENTE"))
})

test("postal helpers match SAT address values against official dropdown labels", () => {
  const catalog: CodigoPostalInfo[] = [
    {
      codigo: "11280",
      estado: "DISTRITO FEDERAL",
      municipio: "MIGUEL HIDALGO",
      ciudad: "DISTRITO FEDERAL",
      asentamientos: ["TORRE BLANCA"],
    },
  ]
  const info = findCodigoPostalInfoInCatalog(catalog, "CP 11280")

  assert.equal(info?.codigo, "11280")
  assert.equal(
    findSatAddressOption(["1,AGUASCALIENTES", "9,DISTRITO FEDERAL", "15,MEXICO"], info?.estado || ""),
    "9,DISTRITO FEDERAL",
  )
  assert.equal(findSatAddressOption(["TORRE BLANCA", "LOMAS DE SOTELO"], "Torre Blanca"), "TORRE BLANCA")
})
