import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import test from "node:test"
import { deflateSync, strFromU8, strToU8, unzipSync, zipSync } from "fflate"
import * as XLSX from "xlsx"
import { assertImportFileLimits, parseOperationImport, readOperationImportWorkbook } from "../lib/pld/import-operations"
import { preflightCsvTable } from "../lib/pld/import-workbook-limits"

const context = { companyId: "test", companyName: "Prueba", companyRfc: "FSC220908AC2", actor: "user" }

test("CSV is bounded before reader allocation and keeps quoted delimiters, newlines and encodings", () => {
  const wide = Array.from({ length: 129 }, () => "value").join(",")
  assert.ok(XLSX.read(wide,{type:"string",raw:true}).Sheets.Sheet1.DY1)
  assert.throws(() => preflightCsvTable(wide), /límite/)
  assert.throws(() => readOperationImportWorkbook(strToU8(wide), "wide.csv"), /límite/)
  assert.throws(() => preflightCsvTable('name,notes\n"unclosed'), /sin cerrar/)
  for (const delimiter of [",", ";", "\t", "|"]) {
    const content = `sep=${delimiter}\r\ncliente${delimiter}notas\r\n"Compañía, México"${delimiter}"Línea 1\r\nLínea 2; con ""comillas"""`
    const workbook = readOperationImportWorkbook(strToU8(content), "control.csv")
    assert.equal(workbook.Sheets.Sheet1.A2.v, "Compañía, México")
    assert.equal(workbook.Sheets.Sheet1.B2.v, 'Línea 1\nLínea 2; con "comillas"')
  }
  const latin = Uint8Array.from(Buffer.from("cliente;monto\nCompañía;10000000.00", "latin1"))
  assert.equal(readOperationImportWorkbook(latin, "latin.csv").Sheets.Sheet1.A2.v, "Compañía")
  const rectangle = ("x,".repeat(127) + "x\n").repeat(2001)
  assert.throws(() => preflightCsvTable(rectangle), /límite/)
})
function workbookBytes() {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["cliente", "rfc", "monto"], ["Empresa", "DLV190624M32", "10000000.01"]]), "Captura")
  return new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx", compression: true }))
}
function firstCentral(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return view.getUint32(bytes.length - 22 + 16, true)
}

test("ZIP admission rejects conflicting local sizes before the real workbook reader can allocate them", () => {
  const original = workbookBytes()
  const altered = original.slice(), view = new DataView(altered.buffer), directory = firstCentral(altered)
  const local = view.getUint32(directory + 42, true)
  // A bounded version of the original trigger: the old central-only check saw
  // the unchanged small size while SheetJS used this local 2 MiB allocation.
  view.setUint32(local + 22, 2 * 1024 * 1024, true)
  assert.ok(view.getUint32(directory + 24, true) < 2 * 1024 * 1024)
  const originalAllocate = Buffer.allocUnsafe, allocated: number[] = []
  Buffer.allocUnsafe = (size: number) => { allocated.push(size); return originalAllocate(size) }
  try {
    assert.throws(() => XLSX.read(altered, { type: "array" }), /Bad uncompressed size/)
    assert.ok(allocated.includes(2 * 1024 * 1024), "the controlled legacy reader reaches the local-header allocation before rejecting it")
    allocated.length = 0
    assert.throws(() => readOperationImportWorkbook(altered, "altered.xlsx"), /estructura/)
    assert.equal(allocated.includes(2 * 1024 * 1024), false, "admission now rejects before the reader allocation")
  } finally { Buffer.allocUnsafe = originalAllocate }
  const control = readOperationImportWorkbook(original, "control.xlsx")
  assert.equal(control.Sheets.Captura.C2.v, "10000000.01")
})

test("actual DEFLATE output is bounded even when both ZIP size claims agree on a false small value", () => {
  const bytes = zipSync({ "payload.xml": strToU8("A".repeat(2 * 1024 * 1024)) })
  const view = new DataView(bytes.buffer), directory = firstCentral(bytes)
  view.setUint32(22, 1, true); view.setUint32(directory + 24, 1, true)
  assert.throws(() => assertImportFileLimits(bytes, "false-size.xlsx"), /expandido/)
})

test("ZIP record offsets, names, CRC, encryption, ZIP64 and encoding cannot disagree with the parser", () => {
  const original = workbookBytes(), directory = firstCentral(original)
  for (const mutate of [
    (v: DataView) => v.setUint32(directory + 42, 1, true),
    (v: DataView) => v.setUint32(directory + 20, 0xffffffff, true),
    (v: DataView) => v.setUint16(directory + 8, v.getUint16(directory + 8, true) | 1, true),
    (v: DataView) => v.setUint32(directory + 16, 0, true),
    (v: DataView) => v.setUint8(directory + 46, 0xff),
  ]) {
    const altered = original.slice(); mutate(new DataView(altered.buffer))
    assert.throws(() => assertImportFileLimits(altered, "altered.xlsx"), /estructura|ZIP64/)
  }
  assert.throws(() => assertImportFileLimits(original.subarray(1), "offset.xlsx"), /estructura/)
  const commented = new Uint8Array(original.length + 22)
  commented.set(original)
  const commentView = new DataView(commented.buffer)
  commentView.setUint16(original.length - 2, 22, true)
  commentView.setUint32(original.length, 0x06054b50, true)
  commentView.setUint16(original.length + 20, 1, true)
  assert.throws(() => assertImportFileLimits(commented, "ambiguous-comment.xlsx"), /estructura/)
})

function descriptorZip(signed: boolean) {
  const payload = strToU8("descriptor control"), regular = zipSync({ "data.xml": payload })
  const source = new DataView(regular.buffer), directory = firstCentral(regular)
  const dataStart = 30 + source.getUint16(26, true) + source.getUint16(28, true)
  const compressed = deflateSync(payload)
  const descriptorLength = signed ? 16 : 12, newDirectory = dataStart + compressed.length + descriptorLength
  const output = new Uint8Array(newDirectory + regular.length - directory), view = new DataView(output.buffer)
  output.set(regular.subarray(0, dataStart)); output.set(compressed, dataStart)
  output.set(regular.subarray(directory), newDirectory)
  view.setUint16(6, 8, true); view.setUint32(14, 0, true); view.setUint32(18, 0, true); view.setUint32(22, 0, true)
  view.setUint16(newDirectory + 8, 8, true)
  const descriptor = dataStart + compressed.length
  if (signed) view.setUint32(descriptor, 0x08074b50, true)
  const values = descriptor + (signed ? 4 : 0)
  view.setUint32(values, source.getUint32(directory + 16, true), true)
  view.setUint32(values + 4, compressed.length, true); view.setUint32(values + 8, payload.length, true)
  view.setUint32(output.length - 22 + 16, newDirectory, true)
  return output
}

test("ordinary signed and unsigned ZIP data descriptors remain valid and mismatched descriptors fail", () => {
  for (const signed of [false, true]) {
    const bytes = descriptorZip(signed)
    assert.doesNotThrow(() => assertImportFileLimits(bytes, "descriptor.xlsx"))
    const directory = firstCentral(bytes)
    new DataView(bytes.buffer).setUint32(directory - 4, 999, true)
    assert.throws(() => assertImportFileLimits(bytes, "descriptor.xlsx"), /estructura/)
  }
})

test("untrusted worksheet dimensions are rejected before rectangular table expansion, without silent truncation", async () => {
  for (const dimension of ["A1:XFD2001", "A1:B999999", "A1:DY2001"]) {
    const zip = unzipSync(workbookBytes())
    zip["xl/worksheets/sheet1.xml"] = strToU8(strFromU8(zip["xl/worksheets/sheet1.xml"]).replace(/<dimension ref="[^"]+"\/>/, `<dimension ref="${dimension}"/>`))
    const bytes = zipSync(zip)
    const read = readOperationImportWorkbook(bytes, "wide.xlsx")
    assert.equal(read.Sheets.Captura["!fullref"] || read.Sheets.Captura["!ref"], dimension)
    await assert.rejects(parseOperationImport({ bytes, fileName: "wide.xlsx", context }), /límite/)
  }
  const rows = "cliente,rfc\n" + Array.from({ length: 2013 }, () => "Empresa,DLV190624M32").join("\n")
  await assert.rejects(parseOperationImport({ bytes: strToU8(rows), fileName: "rows.csv", context }), /límite|2,000/)
  const zip = unzipSync(workbookBytes())
  zip["xl/worksheets/sheet1.xml"] = strToU8(strFromU8(zip["xl/worksheets/sheet1.xml"]).replace("</sheetData>", '<row r="999999"><c r="A999999" t="str"><v>hidden beyond sheetRows</v></c></row></sheetData>'))
  await assert.rejects(parseOperationImport({ bytes: zipSync(zip), fileName: "lying-dimension.xlsx", context }), /límite/)
  const ambiguous = unzipSync(workbookBytes())
  const relationships = strFromU8(ambiguous["xl/_rels/workbook.xml.rels"])
  ambiguous["xl/_rels/workbook.xml.rels"] = strToU8(relationships.replace("</Relationships>", `${relationships.match(/<Relationship\s[^>]*\/>/)![0]}</Relationships>`))
  await assert.rejects(parseOperationImport({ bytes: zipSync(ambiguous), fileName: "ambiguous-relationship.xlsx", context }), /estructura/)
  const attributes = unzipSync(workbookBytes())
  attributes["xl/workbook.xml"] = strToU8(strFromU8(attributes["xl/workbook.xml"]).replace('name="Captura"', 'name="Captura" name="Otro"'))
  await assert.rejects(parseOperationImport({ bytes: zipSync(attributes), fileName: "ambiguous-attribute.xlsx", context }), /estructura/)
})

test("all 40 official macro-enabled workbooks pass the exact ZIP admission check", () => {
  let count = 0
  for (const directory of readdirSync("public/sat-templates")) for (const file of readdirSync(`public/sat-templates/${directory}`)) {
    if (!file.endsWith(".xlsm")) continue
    assert.doesNotThrow(() => assertImportFileLimits(new Uint8Array(readFileSync(`public/sat-templates/${directory}/${file}`)), file), file)
    count++
  }
  assert.equal(count, 40)
})
