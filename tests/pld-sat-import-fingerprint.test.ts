import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import test from "node:test"
import type {WorkBook} from "xlsx"
import {identifySatImportWorkbook,SAT_IMPORT_FINGERPRINTS,type SatImportFingerprint,type SatImportFingerprintManifest} from "../lib/pld/sat-import-fingerprint"

function structuralBook(source:SatImportFingerprint):WorkBook {
  const book:WorkBook={SheetNames:[...source.sheetNames],Sheets:Object.fromEntries(source.sheetNames.map((sheet)=>[sheet,{}])),
    Workbook:{Names:source.definedNames.map((item)=>({Name:item.name,Ref:item.ref,...(item.sheet===undefined ? {} : {Sheet:item.sheet})}))}}
  for(const anchor of source.anchors)book.Sheets[anchor.sheet][anchor.cell]={t:"s",v:anchor.text}
  return book
}
const one=(source:SatImportFingerprint):SatImportFingerprintManifest=>({schemaVersion:1,source:"test",templates:[source]})

test("40 fingerprints contain only non-input labels; the generic XIV book cannot select an activity",()=>{
  assert.equal(SAT_IMPORT_FINGERPRINTS.templates.length,40)
  for(const fingerprint of SAT_IMPORT_FINGERPRINTS.templates){
    const layout=JSON.parse(readFileSync(`public/data/sat-xlsm-layouts/${fingerprint.templateId}.json`,"utf8"))
    const captured=new Set(layout.sections.flatMap((section:{fields:Array<{sheetName:string;cell:string}>})=>section.fields.map((field)=>`${field.sheetName}!${field.cell}`)))
    assert.ok(fingerprint.anchors.every((anchor)=>!captured.has(`${anchor.sheet}!${anchor.cell}`)),fingerprint.templateId)
    const result=identifySatImportWorkbook(structuralBook(fingerprint))
    if(fingerprint.autoDetect===false){
      assert.equal(fingerprint.templateId,"sat-fraccion-xiv-comercio-exterior")
      assert.equal(result.status,"unknown")
      assert.ok(fingerprint.manualReason)
    }else{
      assert.ok(result.templateIds.includes(fingerprint.templateId),fingerprint.templateId)
      assert.ok(["recognized","ambiguous"].includes(result.status))
    }
  }
})

test("renamed workbook recognition uses exact structure, not filename or captured client/money",()=>{
  const source=SAT_IMPORT_FINGERPRINTS.templates.find((item)=>item.templateId==="sat-fraccion-xv-arrendamiento")!
  const book=structuralBook(source)
  book.Props={Title:"archivo-renombrado-del-cliente.xlsx"}
  book.Sheets["Persona Objeto del aviso"].D33={t:"s",v:"RFC-DIFERENTE-CAPTURADO"}
  book.Sheets["Acto u operación"].F27={t:"n",v:10_000_000}
  const recognized=identifySatImportWorkbook(book,one(source))
  assert.equal(recognized.status,"recognized")
  assert.deepEqual(recognized.templateIds,[source.templateId])
  const anchor=source.anchors[0]
  book.Sheets[anchor.sheet][anchor.cell]={t:"s",v:anchor.text+" altered"}
  assert.equal(identifySatImportWorkbook(book,one(source)).status,"unknown")
})

test("ambiguous structures never choose the first candidate and a normal table is not SAT",()=>{
  const source=SAT_IMPORT_FINGERPRINTS.templates[0]
  const manifest={...one(source),templates:[source,{...source,templateId:"second-template"}]}
  assert.deepEqual(identifySatImportWorkbook(structuralBook(source),manifest).templateIds,[source.templateId,"second-template"])
  assert.equal(identifySatImportWorkbook(structuralBook(source),manifest).status,"ambiguous")
  assert.equal(identifySatImportWorkbook({SheetNames:["Datos"],Sheets:{Datos:{A1:{t:"s",v:"RFC"},B1:{t:"s",v:"Monto"}}}}).status,"unknown")
})

test("missing named ranges or formula-generated labels cannot satisfy a static fingerprint",()=>{
  const source=SAT_IMPORT_FINGERPRINTS.templates.find((item)=>item.autoDetect!==false && item.definedNames.length)!
  const book=structuralBook(source)
  book.Workbook!.Names!.pop()
  assert.equal(identifySatImportWorkbook(book,one(source)).status,"unknown")
  const formulaBook=structuralBook(source),anchor=source.anchors[0]
  formulaBook.Sheets[anchor.sheet][anchor.cell].f='"'+anchor.text+'"'
  assert.equal(identifySatImportWorkbook(formulaBook,one(source)).status,"unknown")
})
