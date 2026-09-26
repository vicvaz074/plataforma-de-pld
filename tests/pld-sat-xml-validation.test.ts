import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { validateGeneratedSatXml } from "../lib/pld/sat-xml-validation"

test("el validador local concuerda con libxml2 para los ejemplos oficiales actuales", () => {
  const dir = resolve("tests/fixtures/sat-official")
  const failures: string[] = []
  let checked = 0
  for (const name of readdirSync(dir).filter((name) => name.endsWith(".xml"))) {
    const bytes = readFileSync(resolve(dir, name))
    const xml = new TextDecoder(bytes[0] === 255 && bytes[1] === 254 ? "utf-16le" : "utf-8").decode(bytes)
    const ns = xml.match(/xmlns="http:\/\/www\.uif\.shcp\.gob\.mx\/recepcion\/([^"]+)"/)?.[1]
    if (!ns) continue
    const xsd = resolve(dir, `${ns === "spr" ? "spr2" : ns}.xsd`)
    const reference = spawnSync("xmllint", ["--nonet", "--noout", "--schema", xsd, resolve(dir, name)], { encoding: "utf8" })
    if (reference.error) throw reference.error
    const local = validateGeneratedSatXml(xml)
    if (local.valid !== (reference.status === 0)) failures.push(`${name}: local=${local.valid}, libxml=${reference.status}; ${local.errors.slice(0, 2).join("; ")}`)
    checked++
  }
  assert.ok(checked >= 40)
  assert.deepEqual(failures, [])
})

test("rechaza XML incompleto, entidades externas y namespaces desconocidos", () => {
  for (const xml of ["", "<archivo>", '<archivo>\u0000</archivo>', '<!DOCTYPE archivo SYSTEM "file:///etc/passwd"><archivo/>', '<archivo xmlns="urn:invalid"/>']) {
    assert.equal(validateGeneratedSatXml(xml).valid, false)
  }
})
