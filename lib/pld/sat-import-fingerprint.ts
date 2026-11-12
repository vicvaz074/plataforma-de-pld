import type { WorkBook } from "xlsx"
import generated from "./generated/sat-import-fingerprints.json"

export interface SatImportFingerprint {
  templateId:string; officialFileName:string; sourceSha256:string; sourceUrl:string;
  sheetNames:string[]; definedNames:Array<{name:string;ref:string;sheet?:number}>;
  anchors:Array<{sheet:string;cell:string;text:string}>;
  autoDetect?:boolean; manualReason?:string;
}
export interface SatImportFingerprintManifest {schemaVersion:1;source:string;templates:SatImportFingerprint[]}
export interface SatImportIdentification {status:"recognized"|"ambiguous"|"unknown";templateIds:string[];evidence:string[]}
export const SAT_IMPORT_FINGERPRINTS=generated as SatImportFingerprintManifest
export const normalizeSatFingerprintText=(value:unknown)=>String(value??"").normalize("NFC").replace(/\s+/g," ").trim()

/** Format identification only, not authenticity or SAT acceptance. No filename,
 * captured value, similarity score or first-match fallback is authoritative. */
export function identifySatImportWorkbook(workbook:WorkBook,manifest:SatImportFingerprintManifest=SAT_IMPORT_FINGERPRINTS):SatImportIdentification {
  const sheetNames=[...(workbook.SheetNames||[])].sort()
  const names=new Map((workbook.Workbook?.Names||[]).map((item)=>[`${item.Sheet??"global"}\u0000${item.Name}`,normalizeSatFingerprintText(item.Ref)]))
  const matches=manifest.templates.filter((fingerprint)=>{
    if (fingerprint.autoDetect===false) return false
    if (fingerprint.anchors.length<8 || JSON.stringify([...fingerprint.sheetNames].sort())!==JSON.stringify(sheetNames)) return false
    if (!fingerprint.definedNames.every((item)=>names.get(`${item.sheet??"global"}\u0000${item.name}`)===normalizeSatFingerprintText(item.ref))) return false
    return fingerprint.anchors.every((anchor)=>{
      const cell=workbook.Sheets[anchor.sheet]?.[anchor.cell]
      return Boolean(cell && !cell.f && typeof cell.v==="string" && normalizeSatFingerprintText(cell.v)===anchor.text)
    })
  })
  const templateIds=[...new Set(matches.map((item)=>item.templateId))]
  if (!templateIds.length) return {status:"unknown",templateIds:[],evidence:["No coincide exactamente con la estructura y etiquetas fijas de una plantilla SAT soportada."]}
  return {status:templateIds.length===1 ? "recognized" : "ambiguous",templateIds,
    evidence:matches.map((item)=>`${item.templateId}: ${item.sheetNames.length} hojas, ${item.definedNames.length} rangos nombrados y ${item.anchors.length} etiquetas fijas coinciden exactamente.`)}
}
