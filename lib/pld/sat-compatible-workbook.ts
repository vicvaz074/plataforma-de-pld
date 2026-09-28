import { strFromU8, strToU8, unzipSync, zipSync } from "fflate"

export const COMPATIBLE_WORKBOOK_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

/** Presentation/capture copy, NOT a replacement for the official SAT XLSM.
 * ActiveX is unsupported on Mac/web and disabled by default in current Office.
 * Source: support.microsoft.com/en-us/excel/add-or-register-an-activex-control
 * Consulted 2026-09-28. Never ask users to lower Office security settings.
 */
export function buildCompatibleSatWorkbook(input: Uint8Array): Uint8Array {
  const zip = unzipSync(input)
  if (!zip["xl/workbook.xml"] || !zip["[Content_Types].xml"]) throw new Error("El archivo no es un libro Excel válido.")
  const removed = new Set(Object.keys(zip).filter((path) =>
    /^(?:xl\/(?:activeX|ctrlProps|embeddings|drawings|externalLinks)\/|customUI\/|_xmlsignatures\/)/i.test(path) ||
    /^xl\/(?:vba[^/]*|calcChain\.xml)/i.test(path),
  ))
  for (const path of removed) delete zip[path]
  // Relationship targets are relative to the owning part, not its _rels folder.
  for (const path of Object.keys(zip).filter((name) => name.endsWith(".rels"))) {
    const directory = path === "_rels/.rels" ? "" : path.slice(0, path.lastIndexOf("_rels/"))
    zip[path] = strToU8(strFromU8(zip[path]).replace(/<Relationship\b[^>]*\/?\s*>/g, (tag) => {
      const target = /\bTarget="([^"]*)"/.exec(tag)?.[1] || ""
      const segments: string[] = []
      for (const segment of (target.startsWith("/") ? target.slice(1) : directory + target).split("/")) {
        if (segment === "..") segments.pop()
        else if (segment && segment !== ".") segments.push(segment)
      }
      return removed.has(segments.join("/")) ? "" : tag
    }))
  }
  for (const path of Object.keys(zip).filter((name) => /^xl\/worksheets\/[^/]+\.xml$/.test(name))) {
    let xml = strFromU8(zip[path])
    for (const tag of ["controls", "oleObjects", "drawing", "legacyDrawing", "legacyDrawingHF"]) {
      xml = xml.replace(new RegExp(`<${tag}\\b[^>]*(?:\\/>|>[\\s\\S]*?<\\/${tag}>)`, "g"), "")
    }
    zip[path] = strToU8(xml)
  }
  let workbook = strFromU8(zip["xl/workbook.xml"])
    .replace(/\s+codeName="[^"]*"/g, "")
    .replace(/showSheetTabs="0"/g, 'showSheetTabs="1"')
    .replace(/<externalReferences\b[^>]*>[\s\S]*?<\/externalReferences>/g, "")
  // SAT uses macro buttons to navigate hidden forms. Expose those tabs.
  workbook = workbook.replace(/<sheet\b[^>]*\/>/g, (tag) =>
    /name="(?:Combos|Cat[aá]logos?)[^"]*"/i.test(tag) ? tag : tag.replace(/\s+state="(?:hidden|veryHidden)"/, ""),
  )
  zip["xl/workbook.xml"] = strToU8(workbook)
  zip["[Content_Types].xml"] = strToU8(strFromU8(zip["[Content_Types].xml"])
    .replace(/<Override\b[^>]*\/>/g, (tag) => removed.has((/PartName="([^"]+)"/.exec(tag)?.[1] || "").replace(/^\//, "")) ? "" : tag)
    .replace("application/vnd.ms-excel.sheet.macroEnabled.main+xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"))
  return zipSync(zip)
}

export function compatibleWorkbookFileName(fileName: string) {
  return fileName.replace(/\.(?:xlsm|xlsx)$/i, "") + "-compatible.xlsx"
}
