import assert from "node:assert/strict"
import test from "node:test"
import { configurePilotSession, flushModuleStorage, getModuleStorage, loadCompanyStorage, resetCompanyStorage, retryModuleStorage } from "../lib/pilot/module-storage"
import type { PilotSession, RecordMutation } from "../lib/pilot/contracts"
import { isStationRenderer } from "../lib/pilot/station-recovery"

test("station renderer transfers each eligible write to one owner; no second uploader on an ambiguous acknowledgment",async()=>{
  const before=globalThis.fetch, windowDescriptor=Object.getOwnPropertyDescriptor(globalThis,"window")
  const bridge=Object.assign(new EventTarget(),{navigator:{userAgent:"Electron/45"},location:{protocol:"https:"}})
  Object.defineProperty(globalThis,"window",{value:bridge,configurable:true})
  const company={id:"co-station",organizationId:"org-test",name:"Empresa ficticia",rfc:"AAA010101AAA",status:"active" as const}
  const auth:PilotSession={user:{id:"captura",name:"QA",email:"capture@example.test",platformRole:"superadmin",status:"active",requiresPasswordChange:false,twoFactorEnabled:false},companies:[company],organizations:[],grants:[],memberships:[],mfaRequired:false}
  const paths:string[]=[];let mode:"pending"|"unknown"|"manual"="pending",original:RecordMutation[]=[]
  globalThis.fetch=async(input,init)=>{
    const u=String(input);paths.push((init?.method||"GET")+" "+u)
    if(u.endsWith("/snapshot"))return Response.json({records:[]})
    if(u.includes("/recovery?")){
      if(init?.method==="DELETE")return Response.json({removed:true})
      original=JSON.parse(String(init?.body)).mutations;return Response.json({id:"receipt",localOnly:true},{status:201})
    }
    const confirmed=()=>original.map(m=>({...m,revision:m.expectedRevision+1}))
    if(u.includes("/commit?")){
      if(mode==="unknown")throw Error("Respuesta interrumpida")
      if(mode==="manual")return Response.json({code:"MANUAL_REPLAY_REQUIRED"},{status:422})
      return Response.json({pending:true,records:confirmed()},{status:202,headers:{"X-PLD-Offline":"pending"}})
    }
    if(u.endsWith("/records/batch"))return Response.json({records:confirmed()})
    throw Error("No debe activarse otro cargador: "+u)
  }
  try{
    assert.equal(isStationRenderer(),false,"Un servidor Electron con HTTPS corporativo no es una estación")
    bridge.navigator.userAgent+=" DavaraPLDStation/1";assert.equal(isStationRenderer(),true)
    configurePilotSession(auth);await loadCompanyStorage(company)
    const storage=getModuleStorage(),fileData="data:application/pdf;base64,JVBERi0xLjQK"
    storage.setItem("kyc_expedientes_detalle",JSON.stringify([{id:"qa1",attachments:[{fileName:"ejemplo.pdf",fileData}]}]))
    await flushModuleStorage()
    assert.match(JSON.stringify(original),/data:application\/pdf/)
    assert.ok(!paths.some(p=>p.endsWith("/files")||p.includes("/records/batch")||p.startsWith("DELETE")))
    mode="unknown";storage.setItem("kyc_expedientes_detalle",JSON.stringify([{id:"qa1",nombre:"Edición posterior",attachments:[{fileName:"ejemplo.pdf",fileData}]}]))
    await assert.rejects(flushModuleStorage(),/interrumpida/)
    assert.equal(original[0].expectedRevision,1)
    assert.ok(!paths.some(p=>p.endsWith("/files")||p.includes("/records/batch")||p.startsWith("DELETE")),"Un error ambiguo no libera la copia ni dispara otro envío")
    mode="pending";await retryModuleStorage()
    mode="manual";storage.setItem("pld-training-module",JSON.stringify({tarea:"Plan pendiente"}));await flushModuleStorage()
    assert.equal(paths.filter(p=>p.endsWith("/records/batch")).length,1,"Sólo un rechazo explícito antes del envío permite el guardado convencional")
    assert.equal(paths.filter(p=>p.startsWith("DELETE")).length,1)
  }finally{
    resetCompanyStorage();globalThis.fetch=before
    if(windowDescriptor)Object.defineProperty(globalThis,"window",windowDescriptor);else Reflect.deleteProperty(globalThis,"window")
  }
})
