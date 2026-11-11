import { Inflate, strFromU8, unzipSync } from "fflate"

export const IMPORT_LIMITS = { bytes: 10 * 1024 * 1024, uncompressedBytes: 80 * 1024 * 1024, rows: 2000, columns: 128, cells: 256_000, pages: 50 } as const

const invalidZip = () => new Error("El archivo no contiene una estructura Excel válida.")
const expandedLimit = () => new Error("El libro excede el tamaño expandido permitido.")
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  return crc >>> 0
})

/** Validate the exact ZIP records the reader will use, not signatures found in arbitrary payloads.
 * Inflate in small input chunks: neither an advertised output size nor a ZIP bomb may cause
 * an unbounded allocation before the expanded-byte budget is checked.
 */
export function assertImportFileLimits(bytes: Uint8Array, fileName: string): void {
  if (!bytes.length || bytes.length > IMPORT_LIMITS.bytes) throw new Error("El archivo debe tener contenido y pesar hasta 10 MB.")
  if (!/\.(xlsx|xlsm|csv)$/i.test(fileName)) throw new Error("Selecciona un archivo .xlsx, .xlsm o .csv.")
  if (/\.csv$/i.test(fileName)) return
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const u16 = (offset: number) => view.getUint16(offset, true)
  const u32 = (offset: number) => view.getUint32(offset, true)
  const inside = (offset: number, length: number, end = bytes.length) => offset >= 0 && length >= 0 && offset + length <= end
  let eocd = -1
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 22 - 65535); offset--) {
    if (u32(offset) === 0x06054b50 && offset + 22 + u16(offset + 20) === bytes.length) { eocd = offset; break }
  }
  if (eocd < 0) throw invalidZip()
  // SheetJS 0.18 scans for the last raw EOCD signature, even inside comments.
  // Do not validate one directory and then let its parser select another one.
  for (let cursor = bytes.length - 4; cursor > eocd; cursor--) if (u32(cursor) === 0x06054b50) throw invalidZip()
  const entries = u16(eocd + 10), directorySize = u32(eocd + 12), directoryOffset = u32(eocd + 16)
  if (entries === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff || eocd >= 20 && u32(eocd - 20) === 0x07064b50) throw new Error("No se admiten libros ZIP64 en esta importación.")
  if (u16(eocd + 4) || u16(eocd + 6) || u16(eocd + 8) !== entries || !entries || entries > 5000 || directoryOffset + directorySize !== eocd) throw invalidZip()
  const names = new Set<string>()
  const records: Array<{ start: number; end: number; data: number; compressed: number; size: number; crc: number; method: number }> = []
  let offset = directoryOffset, claimedTotal = 0
  for (let entry = 0; entry < entries; entry++) {
    if (!inside(offset, 46, eocd) || u32(offset) !== 0x02014b50) throw invalidZip()
    const flags = u16(offset + 8), method = u16(offset + 10), crc = u32(offset + 16)
    const compressed = u32(offset + 20), size = u32(offset + 24), nameLength = u16(offset + 28), extraLength = u16(offset + 30), commentLength = u16(offset + 32), local = u32(offset + 42)
    if ([compressed, size, local].includes(0xffffffff)) throw new Error("No se admiten libros ZIP64 en esta importación.")
    if (flags & ~0x080e || flags & 1 || ![0, 8].includes(method) || u16(offset + 34) || !nameLength || !inside(offset + 46, nameLength + extraLength + commentLength, eocd)) throw invalidZip()
    const nameBytes = bytes.subarray(offset + 46, offset + 46 + nameLength)
    // ASCII paths and UTF-8 names are unambiguous to both SheetJS and ZIP readers.
    let name: string
    try { name = new TextDecoder("utf-8", { fatal: true }).decode(nameBytes) } catch { throw invalidZip() }
    if (name.includes("\0") || name.includes("\\") || name.startsWith("/") || name.split("/").includes("..") || names.has(name)) throw invalidZip()
    names.add(name)
    const checkExtra = (start: number, length: number) => {
      for (let cursor = start; cursor < start + length;) {
        if (cursor + 4 > start + length || cursor + 4 + u16(cursor + 2) > start + length || u16(cursor) === 1) throw invalidZip()
        cursor += 4 + u16(cursor + 2)
      }
    }
    checkExtra(offset + 46 + nameLength, extraLength)
    if (!inside(local, 30, directoryOffset) || u32(local) !== 0x04034b50 || u16(local + 6) !== flags || u16(local + 8) !== method || u16(local + 26) !== nameLength) throw invalidZip()
    const localExtra = u16(local + 28), data = local + 30 + nameLength + localExtra
    if (!inside(local + 30, nameLength + localExtra, directoryOffset) || !nameBytes.every((value, index) => value === bytes[local + 30 + index]) || !inside(data, compressed, directoryOffset)) throw invalidZip()
    checkExtra(local + 30 + nameLength, localExtra)
    const descriptor = Boolean(flags & 8)
    if (descriptor) {
      if ((u32(local + 14) !== 0 && u32(local + 14) !== crc) || (u32(local + 18) !== 0 && u32(local + 18) !== compressed) || (u32(local + 22) !== 0 && u32(local + 22) !== size)) throw invalidZip()
    } else if (u32(local + 14) !== crc || u32(local + 18) !== compressed || u32(local + 22) !== size) throw invalidZip()
    let end = data + compressed
    if (descriptor) {
      const signed = inside(end, 4, directoryOffset) && u32(end) === 0x08074b50
      const values = end + (signed ? 4 : 0)
      if (!inside(values, 12, directoryOffset) || u32(values) !== crc || u32(values + 4) !== compressed || u32(values + 8) !== size) throw invalidZip()
      end = values + 12
    }
    if (method === 0 && compressed !== size) throw invalidZip()
    claimedTotal += size
    if (claimedTotal > IMPORT_LIMITS.uncompressedBytes) throw expandedLimit()
    records.push({ start: local, end, data, compressed, size, crc, method })
    offset += 46 + nameLength + extraLength + commentLength
  }
  if (offset !== eocd) throw invalidZip()
  // Disallow hidden/local-only records, overlaps, prefixes and gaps: all bytes handed
  // to the downstream ZIP parser must belong to the validated directory.
  records.sort((a, b) => a.start - b.start)
  let next = 0
  for (const record of records) { if (record.start !== next) throw invalidZip(); next = record.end }
  if (next !== directoryOffset) throw invalidZip()
  let actualTotal = 0
  for (const record of records) {
    let actual = 0, checksum = 0xffffffff
    const count = (chunk: Uint8Array) => {
      actual += chunk.length; actualTotal += chunk.length
      if (actual > record.size || actualTotal > IMPORT_LIMITS.uncompressedBytes) throw expandedLimit()
      for (const value of chunk) checksum = crcTable[(checksum ^ value) & 255] ^ (checksum >>> 8)
    }
    if (record.method === 0) count(bytes.subarray(record.data, record.data + record.compressed))
    else {
      const inflater = new Inflate(count)
      try {
        if (!record.compressed) throw invalidZip()
        for (let cursor = 0; cursor < record.compressed; cursor += 1024) {
          const end = Math.min(cursor + 1024, record.compressed)
          inflater.push(bytes.subarray(record.data + cursor, record.data + end), end === record.compressed)
        }
      } catch (error) { if (error instanceof Error && error.message === expandedLimit().message) throw error; throw invalidZip() }
    }
    if (actual !== record.size || ((checksum ^ 0xffffffff) >>> 0) !== record.crc) throw invalidZip()
  }
}

const tableLimit = () => new Error("La tabla excede el límite de 2,000 filas, 128 columnas o 256,000 celdas. Divide el archivo en lotes.")

/** Establish and enforce the delimiter before SheetJS creates any cell objects.
 * Delimiter guessing matches the reader's 1KiB sample, then FS fixes that choice.
 * Embedded newlines/separators and doubled quotes stay within their quoted cell.
 */
export function preflightCsvTable(input: string): { content: string; delimiter: string } {
  let content = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n")
  const directive = /^sep=([^\r\n])(?:\r|\n)/.exec(content)
  const separators = ["|", ";", "\t", ","]
  let delimiter = directive?.[1]
  if (directive) {
    if (!separators.includes(delimiter!)) throw new Error("El separador CSV no es compatible. Usa coma, punto y coma, tabulador o barra vertical.")
    content = content.slice(directive[0].length)
  }
  if (!delimiter) {
    const counts = new Map(separators.map((separator) => [separator, 0]))
    let quoted = false
    for (let i = 0; i < Math.min(content.length, 1024); i++) {
      const character = content[i]
      if (character === '"') quoted = !quoted
      else if (!quoted && counts.has(character)) counts.set(character, counts.get(character)! + 1)
    }
    delimiter = separators.reduce((best, separator) => counts.get(separator)! >= counts.get(best)! ? separator : best, ",")
  }
  let row = 1, column = 1, maxColumn = 1, quoted = false, start = 0
  for (let i = 0; i < content.length; i++) {
    const character = content[i]
    if (character === '"' && content[start] === '"') quoted = !quoted
    if (quoted || character !== delimiter && character !== "\n" && character !== "\r") continue
    if (character === delimiter) column++
    else { row++; column = 1 }
    start = i + 1
    maxColumn = Math.max(maxColumn, column)
    if (column > IMPORT_LIMITS.columns || row > IMPORT_LIMITS.rows + 10 || row * maxColumn > IMPORT_LIMITS.cells) throw tableLimit()
  }
  if (quoted) throw new Error("El CSV contiene un campo entre comillas sin cerrar.")
  return { content, delimiter }
}

function tableCoordinate(value: string) {
  const match = /^([A-Z]{1,3})([1-9]\d*)$/.exec(value)
  if (!match) throw new Error("La tabla contiene un rango de celdas no válido.")
  let column = 0
  for (const letter of match[1]) column = column * 26 + letter.charCodeAt(0) - 64
  const row = Number(match[2])
  if (column > IMPORT_LIMITS.columns || row > IMPORT_LIMITS.rows + 10) throw tableLimit()
  return { column, row }
}

/** Call only after assertImportFileLimits. Inspect the selected table's actual
 * rows/cells as well as its advertised dimension before sheetRows can hide them.
 * Catalog sheets in SAT imports are deliberately not subject to table budgets.
 */
export function assertValidatedTabularWorkbookLimits(bytes: Uint8Array): void {
  const metadata = unzipSync(bytes, { filter: (entry) => ["xl/workbook.xml", "xl/_rels/workbook.xml.rels"].includes(entry.name) })
  if (!metadata["xl/workbook.xml"] || !metadata["xl/_rels/workbook.xml.rels"]) throw invalidZip()
  const decode = (value: string) => value.replace(/&(?:#(x[\da-f]+|\d+)|amp|quot|apos|lt|gt);/gi, (entity, number: string | undefined) => {
    if (number) {
      const code = number[0].toLowerCase() === "x" ? parseInt(number.slice(1), 16) : Number(number)
      if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) throw invalidZip()
      return String.fromCodePoint(code)
    }
    return ({ "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">" } as Record<string, string>)[entity.toLowerCase()]
  })
  // SheetJS folds attribute namespaces/case and legacy underscore suffixes.
  // Reject duplicate effective attributes instead of selecting a different value.
  const attributeKey = (name: string) => name.startsWith("xmlns:") ? name : name.split(":").at(-1)!.split("_")[0].toLowerCase()
  const attr = (tag: string, name: string) => {
    const attributes = new Map<string, string>()
    for (const match of tag.matchAll(/\s([\w:.-]+)\s*=\s*(["'])(.*?)\2/g)) {
      const key = attributeKey(match[1])
      if (attributes.has(key)) throw invalidZip()
      attributes.set(key, decode(match[3]))
    }
    return attributes.get(attributeKey(name)) || ""
  }
  let sheet: string | undefined
  const sheetNames = new Set<string>()
  for (const [tag] of strFromU8(metadata["xl/workbook.xml"]).matchAll(/<(?:\w+:)?sheet\b[^>]*>/g)) {
    const name = attr(tag, "name")
    if (!name || sheetNames.has(name) || sheetNames.size >= 5000) throw invalidZip()
    sheetNames.add(name)
    if (!sheet && !/^(combos|catalogos|catálogos)$/i.test(name)) sheet = tag
  }
  if (!sheet) throw new Error("El libro no contiene una hoja de datos.")
  const id = attr(sheet, "r:id")
  const relationships = new Map<string, string>()
  for (const [tag] of strFromU8(metadata["xl/_rels/workbook.xml.rels"]).matchAll(/<(?:\w+:)?Relationship\b[^>]*>/g)) {
    const relationId = attr(tag, "Id")
    if (!relationId || relationships.has(relationId) || relationships.size >= 5000) throw invalidZip()
    relationships.set(relationId, tag)
  }
  const relationship = relationships.get(id)
  if (!relationship || attr(relationship, "TargetMode") === "External") throw invalidZip()
  const target = attr(relationship, "Target"), parts: string[] = []
  for (const part of (target.startsWith("/") ? target.slice(1) : `xl/${target}`).split("/")) {
    if (part === "..") { if (!parts.length) throw invalidZip(); parts.pop() }
    else if (part && part !== ".") parts.push(part)
  }
  const path = parts.join("/")
  const selected = unzipSync(bytes, { filter: (entry) => entry.name === path })[path]
  if (!selected) throw invalidZip()
  const xml = strFromU8(selected)
  let maxColumn = 0, maxRow = 0, cells = 0, rows = 0, currentRow = 0, currentColumn = 0
  const include = (coordinate: { column: number; row: number }) => {
    maxColumn = Math.max(maxColumn, coordinate.column); maxRow = Math.max(maxRow, coordinate.row)
    if (maxColumn * maxRow > IMPORT_LIMITS.cells) throw tableLimit()
  }
  for (const [tag] of xml.matchAll(/<(?:\w+:)?(?:dimension|row|c)\b[^>]*>/g)) {
    if (/^<(?:\w+:)?dimension\b/.test(tag)) {
      const range = attr(tag, "ref").split(":")
      if (range.length > 2) throw invalidZip()
      range.forEach((cell) => include(tableCoordinate(cell)))
    } else if (/^<(?:\w+:)?row\b/.test(tag)) {
      rows++; currentColumn = 0
      const row = attr(tag, "r")
      currentRow = row ? tableCoordinate(`A${row}`).row : currentRow + 1
      if (rows > IMPORT_LIMITS.rows + 10 || currentRow > IMPORT_LIMITS.rows + 10) throw tableLimit()
    } else {
      if (++cells > IMPORT_LIMITS.cells) throw tableLimit()
      const ref = attr(tag, "r")
      if (ref) { const coordinate = tableCoordinate(ref); currentColumn = coordinate.column; include(coordinate) }
      else { currentColumn++; include({ column: currentColumn, row: currentRow || 1 }); if (currentColumn > IMPORT_LIMITS.columns) throw tableLimit() }
    }
  }
}
