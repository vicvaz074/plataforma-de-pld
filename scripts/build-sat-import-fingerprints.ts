import {createHash} from "node:crypto"
import {readFileSync,writeFileSync} from "node:fs"
import {unzipSync,strFromU8} from "fflate"
import * as XLSX from "xlsx"
import {getConcreteSatTemplates} from "../lib/pld/sat-demo-scenarios"
import {getSatTemplateCachePath} from "../lib/pld/sat-template-catalog"
import {normalizeSatXlsmLayout} from "../lib/pld/sat-xlsm"

// Read-only source extraction. Existing browser/Worker SheetJS contracts expose
// named ranges and raw fixed labels; no workbook is modified/exported or macros run.
const normalized=(value:unknown)=>String(value??"").normalize("NFC").replace(/\s+/g," ").trim()
const labelKey=(value:unknown)=>normalized(value).replace(/^\*\s*|\s*\*$/g,"").trim()
const decode=(value:string)=>value.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&")
const attribute=(value:string,name:string)=>decode(new RegExp(`\\b${name}="([^"]*)"`).exec(value)?.[1]||"")
const destination="lib/pld/generated/sat-import-fingerprints.json"
const templates=getConcreteSatTemplates().map((template)=>{
  const bytes=readFileSync(getSatTemplateCachePath(template))
  const xmls=unzipSync(bytes,{filter:(file)=>file.name==="xl/workbook.xml"})
  const workbookXml=strFromU8(xmls["xl/workbook.xml"])
  const sheetNames=[...workbookXml.matchAll(/<sheet\b([^>]*?)\/?\s*>/g)].map((match)=>attribute(match[1],"name"))
  const definedNames=[...workbookXml.matchAll(/<definedName\b([^>]*)>([\s\S]*?)<\/definedName>/g)].flatMap((match)=>{
    const name=attribute(match[1],"name"),ref=normalized(decode(match[2])),sheet=attribute(match[1],"localSheetId")
    if (!name || name.startsWith("_xlnm") || !/^[^!\[\]]+!\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?$/i.test(ref)) return []
    return [{name,ref,...(sheet ? {sheet:Number(sheet)} : {})}]
  }).sort((a,b)=>a.name.localeCompare(b.name)||(a.sheet??-1)-(b.sheet??-1))
  const layout=normalizeSatXlsmLayout(JSON.parse(readFileSync(`public/data/sat-xlsm-layouts/${template.templateId}.json`,"utf8")))
  const fields=layout.sections.flatMap((section)=>section.fields)
  const captured=new Set(fields.map((field)=>`${field.sheetName}!${field.cell}`))
  const labels=new Set(fields.map((field)=>labelKey(field.label)))
  const formSheets=layout.sections.filter((section)=>section.fields.length && !/combo|catalog/i.test(section.sheetName)).map((section)=>section.sheetName)
  const workbook=XLSX.read(bytes,{type:"array",sheets:formSheets,sheetRows:250,cellFormula:true,cellHTML:false,bookVBA:false,raw:true})
  const candidates:Array<{sheet:string;cell:string;text:string}>=[]
  for (const sheet of formSheets) for (const [cell,value] of Object.entries(workbook.Sheets[sheet]||{})) {
    if (cell.startsWith("!") || captured.has(`${sheet}!${cell}`)) continue
    const item=value as XLSX.CellObject
    if (item.f || typeof item.v!=="string") continue
    const text=normalized(item.v)
    if (text.length<5 || text.length>200 || !labels.has(labelKey(text))) continue
    candidates.push({sheet,cell,text})
  }
  return {templateId:template.templateId,officialFileName:template.officialXlsmName,sourceSha256:createHash("sha256").update(bytes).digest("hex"),sourceUrl:template.sourceZipUrl,sheetNames,definedNames,candidates}
})
const frequency=new Map<string,number>()
for(const template of templates)for(const item of template.candidates){const key=JSON.stringify(item);frequency.set(key,(frequency.get(key)||0)+1)}
const manifest={schemaVersion:1,source:"Cached official SAT XLSM; fixed non-input labels only; no legal/version update inferred",templates:templates.map(({candidates,...template})=>{
  const ranked=[...candidates].sort((a,b)=>(frequency.get(JSON.stringify(a))||0)-(frequency.get(JSON.stringify(b))||0)||a.sheet.localeCompare(b.sheet)||a.cell.localeCompare(b.cell))
  const anchors=ranked.slice(0,32)
  if(template.templateId==="sat-fraccion-xiv-comercio-exterior") return {...template,anchors,autoDetect:false,manualReason:"El archivo cacheado es un Informe en Ceros genérico para múltiples actividades; su estructura no identifica la vía de pedimento ni una actividad única."}
  if(anchors.length<8)throw new Error(`${template.templateId}: insufficient fixed non-input labels (${anchors.length})`)
  return {...template,anchors,autoDetect:true}
})}
const output=JSON.stringify(manifest,null,2)+"\n"
if(process.argv.includes("--check")){if(readFileSync(destination,"utf8")!==output)throw new Error("SAT import fingerprint manifest is stale. Regenerate it.")}
else writeFileSync(destination,output)
console.log(JSON.stringify({templates:manifest.templates.length,anchors:manifest.templates.reduce((sum,item)=>sum+item.anchors.length,0),bytes:Buffer.byteLength(output)}))
