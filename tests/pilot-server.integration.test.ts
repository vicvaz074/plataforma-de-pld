import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { Miniflare } from "miniflare"
import { createHmac, createHash } from "node:crypto"
import { buildPresentationCases } from "../lib/demo/pld-presentation-cases"
import { buildDefaultPldTenants } from "../lib/pld/tenants"
import { beneficiaryReviewSignature } from "../lib/pld/beneficiary-review"
import { ALL_ACTIONS, MODULE_LABELS } from "../lib/pilot/contracts"

function totp(secret:string){
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits=""
  for(const ch of secret.toUpperCase().replace(/=+$/,""))bits+=alphabet.indexOf(ch).toString(2).padStart(5,"0")
  const key=Buffer.from((bits.match(/.{8}/g)||[]).map((byte)=>parseInt(byte,2))),counter=Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30_000)))
  const digest=createHmac("sha1",key).update(counter).digest(),offset=digest[digest.length-1]&15
  return String((digest.readUInt32BE(offset)&0x7fffffff)%1_000_000).padStart(6,"0")
}

test("Worker real: cuentas, sesiones, aislamiento por empresa, conflictos y versiones R2", {timeout:180_000}, async () => {
  const build=mkdtempSync(join(tmpdir(),"pld-worker-test-"))
  // A clean checkout has no frontend build yet. Use tracked source assets;
  // the real test binding below serves the same official SAT layout fixtures.
  execFileSync("pnpm",["exec","wrangler","deploy","-c","wrangler.worker.jsonc","--dry-run","--env=","--assets","public","--outdir",build],{stdio:"pipe",env:{...process.env,WRANGLER_SEND_METRICS:"false"}})
  const origin="http://127.0.0.1:8787",token="test-bootstrap-"+"x".repeat(40)
  const mf=new Miniflare({modulesRoot:build,modules:[{type:"ESModule",path:join(build,"index.js")}],compatibilityDate:"2026-07-01",compatibilityFlags:["nodejs_compat"],d1Databases:["DB"],r2Buckets:["EVIDENCE_BUCKET"],queueProducers:{IMPORT_QUEUE:"test-imports"},queueConsumers:{"test-imports":{maxBatchSize:1,maxBatchTimeout:0,maxRetries:3,retryDelay:0}},serviceBindings:{ASSETS:async(request)=>{const path=new URL(request.url).pathname;if(!/^\/data\/sat-xlsm-layouts\/[a-z0-9-]+\.json$/.test(path))return new Response("not found",{status:404});return new Response(readFileSync(join("public",path))) }},bindings:{BETTER_AUTH_URL:origin,BETTER_AUTH_SECRET:"test-only-secret-"+"s".repeat(48),BOOTSTRAP_TOKEN:token,BOOTSTRAP_EMAIL:"supreme@example.test",ENVIRONMENT:"test"}})
  try{
    const db=await mf.getD1Database("DB")
    for(const file of readdirSync("migrations").filter((name)=>name.endsWith(".sql")).sort())for(const sql of readFileSync(join("migrations",file),"utf8").split(";").map((s)=>s.trim()).filter(Boolean)) await db.prepare(sql).run()
    async function request(path:string,method="GET",payload?:unknown,cookie="",authorization=""){
      const headers:Record<string,string>={Origin:origin};if(cookie)headers.Cookie=cookie;if(authorization)headers.Authorization=authorization
      if(payload!==undefined)headers["Content-Type"]="application/json"
      return mf.dispatchFetch(origin+path,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload)})
    }
    const parse=async (response:{status:number;json:()=>Promise<unknown>})=>({status:response.status,data:await response.json() as any})
    const cookies=(response:{headers:{getSetCookie:()=>string[]}},previous="")=>{const jar=new Map(previous.split("; ").filter(Boolean).map((part)=>[part.slice(0,part.indexOf("=")),part]));for(const header of response.headers.getSetCookie()){const part=header.split(";")[0],key=part.slice(0,part.indexOf("="));if(part.endsWith("="))jar.delete(key);else jar.set(key,part)}return [...jar.values()].join("; ")}
    const login=async(email:string,password:string)=>{
      const response=await request("/api/auth/sign-in/email","POST",{email,password})
      const data=await response.json();assert.equal(response.status,200,JSON.stringify(data))
      const cookies=response.headers.getSetCookie().map((c)=>c.split(";")[0]).join("; ")
      assert.ok(cookies.includes("session_token"),"A real server session cookie must be returned")
      return cookies
    }
    assert.equal((await request("/api/v1/session")).status,401)
    assert.equal((await request("/api/v1/bootstrap","POST",{email:"other@example.test",name:"Other",password:"test-password-only-2026"},"","Bearer "+token)).status,403)
    assert.equal((await request("/api/v1/bootstrap","POST",{email:"supreme@example.test",name:"Supreme Test",password:"test-password-only-2026"},"","Bearer "+token)).status,201)
    assert.equal((await request("/api/v1/bootstrap","POST",{},"","Bearer "+token)).status,409)
    let supreme=await login("supreme@example.test","test-password-only-2026")
    const session=await parse(await request("/api/v1/session","GET",undefined,supreme));assert.equal(session.data.user.platformRole,"superadmin")
    // A freshly activated owner has global rights but no company context yet.
    // Onboarding must use these APIs, never fabricate memberships or grants.
    for(const key of ["organizations","companies","memberships","grants"])assert.deepEqual(session.data[key],[],`Bootstrap starts without ${key}`)
    const emptyAdmin=await parse(await request("/api/v1/admin","GET",undefined,supreme))
    assert.equal(emptyAdmin.status,200,"The owner can open administration before creating an organization")
    assert.deepEqual(emptyAdmin.data.organizations,[]);assert.deepEqual(emptyAdmin.data.companies,[])
    assert.equal(emptyAdmin.data.users.some((user:any)=>user.id===session.data.user.id),true)
    const missingOrganization=await parse(await request("/api/v1/companies","POST",{name:"Empresa sin contexto",rfc:"AAA010101AAA"},supreme))
    assert.equal(missingOrganization.status,400);assert.equal(missingOrganization.data.code,"INVALID_FIELD")
    assert.deepEqual((await parse(await request("/api/v1/admin","GET",undefined,supreme))).data.companies,[],"A rejected first step cannot leave a partial company")
    const firstOrganization=await parse(await request("/api/v1/organizations","POST",{name:"Organización A"},supreme))
    assert.equal(firstOrganization.status,201,JSON.stringify(firstOrganization.data))
    const orgA=firstOrganization.data
    const orgB=(await parse(await request("/api/v1/organizations","POST",{name:"Organización B"},supreme))).data
    const firstCompany=await parse(await request("/api/v1/companies","POST",{organizationId:orgA.id,name:"Empresa A",rfc:"AAA010101AAA"},supreme))
    assert.equal(firstCompany.status,201,JSON.stringify(firstCompany.data))
    const companyA=firstCompany.data
    const companyB=(await parse(await request("/api/v1/companies","POST",{organizationId:orgB.id,name:"Empresa B",rfc:"BBB010101BBB"},supreme))).data
    assert.ok(companyA.id&&companyB.id)
    const ownerAfterSetup=await parse(await request("/api/v1/session","GET",undefined,supreme))
    assert.deepEqual(ownerAfterSetup.data.companies.map((item:any)=>item.id).sort(),[companyA.id,companyB.id].sort())
    assert.deepEqual(ownerAfterSetup.data.memberships,[]);assert.deepEqual(ownerAfterSetup.data.grants,[])
    for(const moduleKey of Object.keys(MODULE_LABELS))for(const action of ALL_ACTIONS){
      const authorized=await parse(await request(`/api/v1/companies/${companyA.id}/authorize`,"POST",{moduleKey,action},supreme))
      assert.equal(authorized.status,200,`Superadmin requires no per-company grant for ${moduleKey}:${action}: ${JSON.stringify(authorized.data)}`)
      assert.equal(authorized.data.companyId,companyA.id)
    }
    assert.equal((await request(`/api/v1/companies/${companyB.id}/authorize`,"POST",{moduleKey:"operaciones",action:"approve"},supreme)).status,200,"Global administration extends across organizations")
    assert.equal((await request(`/api/v1/companies/${crypto.randomUUID()}/authorize`,"POST",{moduleKey:"operaciones",action:"edit"},supreme)).status,404,"Global authority does not create a missing company context")
    assert.equal((await request(`/api/v1/companies/${companyB.id}`,"PATCH",{status:"archived"},supreme)).status,200)
    const archivedCompany=await parse(await request(`/api/v1/companies/${companyB.id}/authorize`,"POST",{moduleKey:"operaciones",action:"edit"},supreme))
    assert.equal(archivedCompany.status,409);assert.equal(archivedCompany.data.code,"COMPANY_ARCHIVED")
    assert.equal((await request(`/api/v1/companies/${companyB.id}`,"PATCH",{status:"active"},supreme)).status,200)
    const created=await parse(await request("/api/v1/users","POST",{organizationId:orgA.id,name:"Captura A",email:"capture@example.test",role:"capture",companyIds:[companyA.id]},supreme))
    assert.equal(created.status,201,JSON.stringify(created.data))
    assert.equal("password" in created.data.user,false)
    const capture=await login("capture@example.test",created.data.temporaryPassword)
    assert.equal((await request(`/api/v1/companies/${companyA.id}/snapshot`,"GET",undefined,capture)).status,403,"Temporary credentials cannot access company data")
    const changed=await parse(await request("/api/auth/change-password","POST",{currentPassword:created.data.temporaryPassword,newPassword:"updated-test-password-2026",revokeOtherSessions:true},capture))
    assert.equal(changed.status,200,JSON.stringify(changed.data))
    let capture2=await login("capture@example.test","updated-test-password-2026")
    const userSession=await parse(await request("/api/v1/session","GET",undefined,capture2))
    assert.deepEqual(userSession.data.companies.map((c:any)=>c.id),[companyA.id])
    assert.equal(userSession.data.user.requiresPasswordChange,false)
    const preferences=await parse(await request("/api/v1/profile","PATCH",{preferences:{theme:"dark",language:"es",notifications:false}},capture2));assert.equal(preferences.status,200);assert.equal(preferences.data.preferences.theme,"dark")
    assert.equal((await parse(await request("/api/v1/profile","GET",undefined,capture2))).data.preferences.notifications,false)
    assert.equal((await request("/api/v1/profile","PATCH",{preferences:{platformRole:"superadmin"}},capture2)).status,400)
    assert.equal((await request(`/api/v1/companies/${companyA.id}/authorize`,"POST",{moduleKey:"operaciones",action:"download"},capture2)).status,200)
    assert.equal((await request(`/api/v1/companies/${companyA.id}/authorize`,"POST",{moduleKey:"operaciones",action:"approve"},capture2)).status,403)
    const ownSessions=await parse(await request("/api/v1/profile/sessions","GET",undefined,capture2));assert.equal(ownSessions.status,200);assert.equal(ownSessions.data.sessions.some((item:any)=>item.current),true);assert.equal(JSON.stringify(ownSessions.data).includes("token"),false)
    assert.equal((await request(`/api/v1/companies/${companyB.id}/snapshot`,"GET",undefined,capture2)).status,404)
    assert.equal((await request("/api/v1/admin","GET",undefined,capture2)).status,403)
    assert.equal((await request("/api/v1/organizations","POST",{name:"Escalamiento rechazado"},capture2)).status,403)
    assert.equal((await request("/api/v1/companies","POST",{organizationId:orgA.id,name:"Empresa no autorizada",rfc:"AAA010101AAA"},capture2)).status,403,"Ordinary users cannot inherit the owner's company-creation rights")
    const companyPath=`/api/v1/companies/${companyA.id}/records/batch`
    assert.equal((await request(companyPath,"POST",{mutations:[{collection:"registro-sat-data",id:"singleton",expectedRevision:0,payload:{sujetosRegistrados:[{id:"legacy-subject",identificacion:{rfc:companyB.rfc}}]}}]},capture2)).status,400)
    const alta=await parse(await request(companyPath,"POST",{mutations:[{collection:"registro-sat-data",id:"singleton",expectedRevision:0,payload:{identificacion:{rfc:""},sujetosRegistrados:[{id:"legacy-subject",identificacion:{rfc:companyA.rfc}}]}}]},capture2));assert.equal(alta.status,200);assert.equal(alta.data.records[0].payload.sujetosRegistrados[0].id,"legacy-subject");assert.equal(alta.data.records[0].payload.companyId,companyA.id)
    assert.equal((await request(companyPath,"POST",{mutations:[{collection:"pld-tenants",id:"singleton",expectedRevision:0,payload:{activeTenantId:companyB.id,tenants:[{id:companyB.id,rfc:companyB.rfc}]}}]},capture2)).status,400)
    assert.equal((await request(companyPath,"POST",{mutations:[{collection:"pld-active-tenant-id",id:"singleton",expectedRevision:0,payload:companyB.id}]},capture2)).status,400)
    for(const [collection,payload] of [["gobernanza-control-data",{expedienteCerrado:true}],["pld-training-module",{moduleClosed:true}],["auditoria-interna-registros",{status:"Cerrado"}],["auditoria-verificacion-workflow",{finalChecklist:{finalSigned:true}}]] as const)assert.equal((await request(companyPath,"POST",{mutations:[{collection,id:"closure-attack",expectedRevision:0,payload}]},capture2)).status,403,`${collection} closure requires approval`)
    const boundaryMutation=(collection:string,id:string,payload:unknown,expectedRevision=0)=>({mutations:[{collection,id,expectedRevision,payload}]})
    assert.equal((await request(companyPath,"POST",boundaryMutation("beneficiario-controlador-data","nested-forgery",{profiles:{"eui-one":{validation:{signature:"forged",validatedAt:"2099-01-01"},documentos:[]}}}),capture2)).status,403,"Nested BC validation requires approval")
    assert.equal((await request(companyPath,"POST",boundaryMutation("gobernanza-control-data","nested-forgery",{documents:[{id:"forged",signedBy:"Supreme",signedAt:"2099-01-01"}]}),capture2)).status,403,"Nested governance signature requires approval")
    for(const malformed of ["true","false",1,{},[]])assert.equal((await request(companyPath,"POST",boundaryMutation("gobernanza-control-data","truthy-closure",{expedienteCerrado:malformed}),capture2)).status,400,"Truthy non-booleans cannot authorize Governance closure")
    const historicalEbr={schemaVersion:2,methodologyVersion:"metodo-historico",rfc:"AAA010101AAA",riskSummary:{level:"Bajo",percent:10},workflow:{status:"approved",approvedBy:"Autor histórico"}}
    const migratedEbr=await parse(await request(companyPath,"POST",{mutations:[{collection:"ebr_evaluaciones",id:"historical-risk",expectedRevision:0,payload:historicalEbr}]},capture2));assert.equal(migratedEbr.status,200,JSON.stringify(migratedEbr.data));assert.deepEqual(migratedEbr.data.records[0].payload.legacySnapshot,historicalEbr);assert.equal(migratedEbr.data.records[0].payload.workflow.status,"draft");assert.equal(migratedEbr.data.records[0].payload.riskSummary,undefined);assert.equal(migratedEbr.data.records[0].payload.needsMigrationReview,true)
    const mutation={collection:"kyc_expedientes_detalle",id:"eui-one",expectedRevision:0,payload:{id:"eui-one",nombre:"Cliente de prueba",identifiers:{curp:"TEST010101HDFXXX00"}}}
    const saved=await parse(await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[mutation]},capture2))
    assert.equal(saved.status,200,JSON.stringify(saved.data));assert.equal(saved.data.records[0].revision,1)
    assert.equal((await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[mutation]},capture2)).status,409)
    const partial=await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{...mutation,id:"eui-two",payload:{id:"eui-two"}},{...mutation,expectedRevision:0}]},capture2)
    assert.equal(partial.status,409)
    const snapshot=await parse(await request(`/api/v1/companies/${companyA.id}/snapshot`,"GET",undefined,capture2));assert.equal(snapshot.data.records.filter((record:any)=>record.collection==="kyc_expedientes_detalle").length,1)
    const concurrent=await Promise.all(["primero","segundo"].map((nombre)=>request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{...mutation,expectedRevision:1,payload:{...mutation.payload,nombre}}]},capture2)))
    assert.deepEqual(concurrent.map((response)=>response.status).sort(),[200,409],"Two writers cannot overwrite the same expected revision")
    const history=await parse(await request(`/api/v1/companies/${companyA.id}/records/kyc_expedientes_detalle/eui-one/history`,"GET",undefined,capture2));assert.deepEqual(history.data.versions.map((item:any)=>item.revision),[2,1])
    const inbox=await parse(await request(`/api/v1/organizations/${orgA.id}/inbox`,"GET",undefined,capture2));assert.equal(inbox.status,200)
    assert.equal(inbox.data.company.id,`inbox:${orgA.id}:${created.data.user.id}`)
    assert.equal((await request(`/api/v1/organizations/${orgB.id}/inbox`,"GET",undefined,capture2)).status,404)
    const inboxWrite=await request(`/api/v1/organizations/${orgA.id}/inbox/records/batch`,"POST",{mutations:[{...mutation,id:"private-eui",payload:{expedienteId:"private-eui"}}]},capture2);assert.equal(inboxWrite.status,200)
    assert.equal((await request(`/api/v1/companies/${encodeURIComponent(`inbox:${orgA.id}:${session.data.user.id}`)}/snapshot`,"GET",undefined,capture2)).status,404)
    const privateCompanyId=`inbox:${orgA.id}:${created.data.user.id}`
    const privateForm=new FormData();privateForm.set("file",new File(["%PDF-1.4\nEXPEDIENTE PRIVADO FICTICIO\n%%EOF"],"privado.pdf",{type:"application/pdf"}));privateForm.set("moduleKey","expedientes")
    const privateUploadRequest=new Request(origin+`/api/v1/companies/${encodeURIComponent(privateCompanyId)}/files`,{method:"POST",headers:{Cookie:capture2,Origin:origin},body:privateForm})
    const privateFile=await parse(await mf.dispatchFetch(privateUploadRequest.url,{method:"POST",headers:Object.fromEntries(privateUploadRequest.headers),body:await privateUploadRequest.arrayBuffer()}));assert.equal(privateFile.status,201,JSON.stringify(privateFile.data))
    assert.equal((await request(privateFile.data.downloadUrl,"PATCH",{status:"approved"},supreme)).status,200)
    assert.equal((await request(`/api/v1/organizations/${orgA.id}/inbox/records/batch`,"POST",{mutations:[{...mutation,id:"private-eui",expectedRevision:1,payload:{expedienteId:"private-eui",nombre:"Cliente privado ficticio",attachments:[{dataUrl:privateFile.data.downloadUrl,sha256:privateFile.data.sha256}]}}]},capture2)).status,200)
    const copyInput={sourceCompanyId:privateCompanyId,expedienteId:"private-eui",expectedRevision:2}
    assert.equal((await request(`/api/v1/companies/${companyB.id}/expedientes/copy`,"POST",copyInput,supreme)).status,403,"Copying an EUI across organizations is denied")
    const copied=await parse(await request(`/api/v1/companies/${companyA.id}/expedientes/copy`,"POST",copyInput,capture2));assert.equal(copied.status,201,JSON.stringify(copied.data));assert.equal(copied.data.records[0].revision,3)
    assert.equal(copied.data.records[0].payload.sujetoObligadoId,companyA.id)
    const copiedUrl=copied.data.records[0].payload.attachments[0].dataUrl;assert.notEqual(copiedUrl,privateFile.data.downloadUrl);assert.ok(copiedUrl.includes(companyA.id))
    assert.match(await (await request(copiedUrl,"GET",undefined,capture2)).text(),/PRIVADO FICTICIO/)
    const copiedFiles=await parse(await request(`/api/v1/companies/${companyA.id}/files`,"GET",undefined,capture2));assert.equal(copiedFiles.data.files.find((file:any)=>file.downloadUrl===copiedUrl).status,"pending","Copy resets the review in the new company")
    assert.equal((await request(`/api/v1/companies/${companyA.id}/expedientes/copy`,"POST",copyInput,capture2)).status,409)
    const copiedHistory=await parse(await request(`/api/v1/companies/${companyA.id}/records/kyc_expedientes_detalle/private-eui/history`,"GET",undefined,capture2));assert.deepEqual(copiedHistory.data.versions.map((item:any)=>item.revision),[3,2,1])
    assert.equal((await request(`/api/v1/organizations/${orgA.id}/inbox`,"GET",undefined,capture2)).status,200,"The private original remains intact")
    const embedded=await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{...mutation,id:"embedded",payload:{file:"data:application/pdf;base64,JVBERg=="}}]},capture2);assert.equal(embedded.status,400)
    assert.equal((await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{...mutation,id:"embedded-text",payload:{file:"data:application/json,%7B%7D"}}]},capture2)).status,400)
    const upload=async(content:string,documentId?:string,expectedRevision=0,name="test.pdf")=>{
      const form=new FormData();form.set("file",new File([content],name,{type:"application/pdf"}));form.set("moduleKey","evidencias");form.set("title","Evidencia de prueba")
      if(documentId)form.set("documentId",documentId);form.set("expectedRevision",String(expectedRevision))
      const uploadRequest=new Request(origin+`/api/v1/companies/${companyA.id}/files`,{method:"POST",headers:{Cookie:capture2,Origin:origin},body:form})
      return parse(await mf.dispatchFetch(uploadRequest.url,{method:"POST",headers:Object.fromEntries(uploadRequest.headers),body:await uploadRequest.arrayBuffer()}))
    }
    const v1=await upload("%PDF-1.4\nFICTICIO VERSION UNO\n%%EOF"),v2=await upload("%PDF-1.4\nFICTICIO VERSION DOS\n%%EOF",v1.data.documentId,1)
    assert.equal(v1.status,201,JSON.stringify(v1.data));assert.equal(v2.status,201,JSON.stringify(v2.data));assert.equal(v2.data.version,2);assert.notEqual(v1.data.sha256,v2.data.sha256)
    const oldFile=await request(v1.data.downloadUrl,"GET",undefined,capture2);assert.match(await oldFile.text(),/VERSION UNO/)
    const forbiddenFile=await request(v1.data.downloadUrl.replace(companyA.id,companyB.id),"GET",undefined,capture2);assert.equal(forbiddenFile.status,404)
    const unicodeName="Contrato 東京✅.pdf",unicodeContent="%PDF-1.4\nCONTRATO FICTICIO UNICODE\n%%EOF",unicodeFile=await upload(unicodeContent,undefined,0,unicodeName);assert.equal(unicodeFile.status,201);assert.equal(unicodeFile.data.fileName,unicodeName)
    const unicodeDownload=await request(unicodeFile.data.downloadUrl,"GET",undefined,capture2);assert.equal(unicodeDownload.status,200);assert.ok(unicodeDownload.headers.get("content-disposition")?.includes(`filename*=UTF-8''${encodeURIComponent(unicodeName)}`));assert.equal(createHash("sha256").update(new Uint8Array(await unicodeDownload.arrayBuffer())).digest("hex"),unicodeFile.data.sha256)
    assert.equal((await request(v2.data.downloadUrl,"PATCH",{status:"approved"},capture2)).status,403,"Capture role cannot approve files")
    const grantBase={organizationId:orgA.id,userId:created.data.user.id,companyId:companyA.id,role:"capture"}
    assert.equal((await request("/api/v1/grants","PUT",{...grantBase,permissions:{expedientes:["view","edit"]}},supreme)).status,200)
    assert.equal((await request(`/api/v1/companies/${companyA.id}/records?collection=ebr_evaluaciones`,"GET",undefined,capture2)).status,403,"Missing modules are denied rather than expanded from role defaults")
    assert.equal((await request(v1.data.downloadUrl,"GET",undefined,capture2)).status,403)
    assert.equal((await request("/api/v1/grants","PUT",{...grantBase,permissions:{}},supreme)).status,200)
    assert.equal((await request(`/api/v1/companies/${companyA.id}/snapshot`,"GET",undefined,capture2)).status,404,"An empty grant removes all data access")
    const allModules=["registro","expedientes","operaciones","avisos","ebr","pep","beneficiario","evidencias","capacitacion","auditoria","gobernanza"]
    assert.equal((await request("/api/v1/grants","PUT",{...grantBase,permissions:Object.fromEntries(allModules.map((module)=>[module,["view","edit","upload","download"]]))},supreme)).status,200)
    const evidence={id:"evidence-real",fileData:v2.data.downloadUrl,fileName:v2.data.fileName,fileType:v2.data.mimeType,fileSize:v2.data.size,sha256:v2.data.sha256,version:1,versionHistory:[],uploadDate:new Date().toISOString(),user:"spoofed",reviewStatus:"pending",approvedAt:"2026-09-28",archived:false}
    const evidenceSave=await parse(await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{collection:"pld-evidences-documents",id:evidence.id,expectedRevision:0,payload:evidence}]},capture2));assert.equal(evidenceSave.status,200);assert.equal(evidenceSave.data.records[0].payload.approvedAt,undefined)
    assert.equal((await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{collection:"pld-evidences-documents",id:evidence.id,expectedRevision:1,payload:{...evidence,reviewStatus:"approved"}}]},capture2)).status,403)
    const reviewed=await parse(await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{collection:"pld-evidences-documents",id:evidence.id,expectedRevision:1,payload:{...evidence,reviewStatus:"approved",reviewedBy:"spoofed"}}]},supreme));assert.equal(reviewed.status,200);assert.equal(reviewed.data.records[0].payload.reviewedBy,session.data.user.id)
    const physicalReviewed=await parse(await request(`/api/v1/companies/${companyA.id}/files`,"GET",undefined,supreme));assert.equal(physicalReviewed.data.files.find((file:any)=>file.id===v2.data.id).status,"approved","Evidence and private-file approval are updated in the same transaction")
    const restoredEvidence={...reviewed.data.records[0].payload,fileData:v1.data.downloadUrl,sha256:v1.data.sha256,reviewStatus:"pending",versionHistory:[]}
    const evidenceRestored=await parse(await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{collection:"pld-evidences-documents",id:evidence.id,expectedRevision:2,payload:restoredEvidence}]},capture2));assert.equal(evidenceRestored.status,200);assert.equal(evidenceRestored.data.records[0].payload.reviewStatus,"pending");assert.equal(evidenceRestored.data.records[0].payload.versionHistory.length,1,"Server retains the old bytes even when a client omits history")
    assert.equal((await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{collection:"pld-evidences-documents",id:evidence.id,expectedRevision:3,payload:{...evidenceRestored.data.records[0].payload,archived:true}}]},capture2)).status,403)
    const bcCollection="beneficiario-controlador-data",bcId="nested-bc-review",bcDoc={id:"bc-doc",name:"Declaración ficticia",url:v1.data.downloadUrl,sha256:v1.data.sha256,category:"declaracion",archived:false}
    const bcDraft={profiles:{"eui-one":{expedienteId:"eui-one",documentos:[bcDoc],preguntas:[],declaraciones:[],trazabilidad:[{id:"bc-trace",action:"Carga de prueba",user:"Falso autor",timestamp:"2099-01-01"}],validation:null}}}
    const bcSaved=await parse(await request(companyPath,"POST",boundaryMutation(bcCollection,bcId,bcDraft),capture2));assert.equal(bcSaved.status,200,JSON.stringify(bcSaved.data))
    const bcProfile=bcSaved.data.records[0].payload.profiles["eui-one"]
    assert.equal(bcProfile.trazabilidad[0].user,"Captura A");assert.equal(bcProfile.trazabilidad[0].actorId,created.data.user.id);assert.notEqual(bcProfile.trazabilidad[0].timestamp,"2099-01-01")
    const bcApproval={profiles:{"eui-one":{...bcProfile,validation:{signature:beneficiaryReviewSignature(bcProfile),validatedAt:"2099-01-01",validatedBy:"forged"}}}}
    assert.equal((await request(companyPath,"POST",boundaryMutation(bcCollection,bcId,bcApproval,1),capture2)).status,403)
    const bcApproved=await parse(await request(companyPath,"POST",boundaryMutation(bcCollection,bcId,bcApproval,1),supreme));assert.equal(bcApproved.status,200,JSON.stringify(bcApproved.data))
    const reviewedBc=bcApproved.data.records[0].payload.profiles["eui-one"]
    assert.equal(reviewedBc.validation.validatedBy,session.data.user.id);assert.equal(reviewedBc.validation.validatedByName,"Supreme Test");assert.notEqual(reviewedBc.validation.validatedAt,"2099-01-01");assert.equal(reviewedBc.validation.reviewedFiles[0].fileVersionId,v1.data.id)
    assert.equal((await request(companyPath,"POST",boundaryMutation(bcCollection,bcId,{profiles:{"eui-one":{...reviewedBc,documentos:[{...bcDoc,archived:true}]}}},2),capture2)).status,403,"Nested archival requires archive")
    assert.equal((await request(companyPath,"POST",boundaryMutation(bcCollection,bcId,{profiles:{"eui-one":{...reviewedBc,documentos:[]}}},2),capture2)).status,403,"Removing a nested document cannot bypass archive")
    const reboundBc={...reviewedBc,documentos:[{...bcDoc,url:v2.data.downloadUrl}],trazabilidad:[{...reviewedBc.trazabilidad[0],user:"Historia reescrita"}]}
    const bcEdited=await parse(await request(companyPath,"POST",boundaryMutation(bcCollection,bcId,{profiles:{"eui-one":reboundBc}},2),capture2));assert.equal(bcEdited.status,200,JSON.stringify(bcEdited.data));assert.equal(bcEdited.data.records[0].payload.profiles["eui-one"].validation,null,"A changed URL invalidates review even with the old claimed hash");assert.equal(bcEdited.data.records[0].payload.profiles["eui-one"].trazabilidad[0].user,"Captura A")
    const wrongHashBc=bcEdited.data.records[0].payload.profiles["eui-one"]
    assert.equal((await request(companyPath,"POST",boundaryMutation(bcCollection,bcId,{profiles:{"eui-one":{...wrongHashBc,validation:{signature:beneficiaryReviewSignature(wrongHashBc),validatedAt:"2099-01-01"}}}},3),supreme)).status,400,"Even an approver cannot bind an unrelated claimed hash")
    const bcHistory=await parse(await request(`/api/v1/companies/${companyA.id}/records/${bcCollection}/${bcId}/history`,"GET",undefined,supreme));assert.equal(bcHistory.data.versions.length,3);assert.equal(bcHistory.data.versions[1].payload.profiles["eui-one"].documentos[0].url,v1.data.downloadUrl)
    const govCollection="gobernanza-control-data",govId="signed-governance",govDoc={id:"gov-doc",base64:v1.data.downloadUrl,hash:v1.data.sha256,archived:false}
    const govSaved=await parse(await request(companyPath,"POST",boundaryMutation(govCollection,govId,{documents:[govDoc],questions:[],trace:[],manualVersions:[],expedienteCerrado:false}),capture2));assert.equal(govSaved.status,200)
    const govSigning={...govSaved.data.records[0].payload,documents:[{...govDoc,signedBy:"Forged signer",signedAt:"2099-01-01"}]}
    assert.equal((await request(companyPath,"POST",boundaryMutation(govCollection,govId,govSigning,1),capture2)).status,403)
    const govSigned=await parse(await request(companyPath,"POST",boundaryMutation(govCollection,govId,govSigning,1),supreme));assert.equal(govSigned.status,200,JSON.stringify(govSigned.data));assert.equal(govSigned.data.records[0].payload.documents[0].signedBy,"Supreme Test");assert.equal(govSigned.data.records[0].payload.documents[0].signedById,session.data.user.id)
    assert.equal((await request(companyPath,"POST",boundaryMutation(govCollection,govId,{...govSigned.data.records[0].payload,documents:[{...govSigned.data.records[0].payload.documents[0],archived:true}]},2),capture2)).status,403)
    const govClosed=await parse(await request(companyPath,"POST",boundaryMutation(govCollection,govId,{...govSigned.data.records[0].payload,expedienteCerrado:true,closedBy:"spoofed"},2),supreme));assert.equal(govClosed.status,200,JSON.stringify(govClosed.data));assert.equal(govClosed.data.records[0].payload.closedBy,session.data.user.id)
    const govEdited=await parse(await request(companyPath,"POST",boundaryMutation(govCollection,govId,{...govClosed.data.records[0].payload,questions:[{id:"q-one",notes:"Contenido editado"}]},3),capture2));assert.equal(govEdited.status,200);assert.equal(govEdited.data.records[0].payload.expedienteCerrado,false,"Capture edits reopen governance instead of retaining approval")
    const govFileEdited=await parse(await request(companyPath,"POST",boundaryMutation(govCollection,govId,{...govEdited.data.records[0].payload,documents:[{...govEdited.data.records[0].payload.documents[0],base64:v2.data.downloadUrl}]},4),capture2));assert.equal(govFileEdited.status,200);assert.equal(govFileEdited.data.records[0].payload.documents[0].signedAt,undefined,"Document changes invalidate the internal signature")
    const trainingCollection="pld-training-module",trainingId="closed-training",trainingDoc={id:"training-doc",name:"Constancia",category:"oficial",dataUrl:v1.data.downloadUrl,sha256:v1.data.sha256,fileType:"application/pdf",size:v1.data.size,uploadedAt:new Date().toISOString(),uploadedBy:"Carga de prueba"}
    const trainingClosed=await parse(await request(companyPath,"POST",boundaryMutation(trainingCollection,trainingId,{moduleClosed:true,documents:[trainingDoc],sessions:[],employees:[],traceability:[],officialCompliance:{name:"Oficial"}},0),supreme));assert.equal(trainingClosed.status,200,JSON.stringify(trainingClosed.data))
    const trainingEdited=await parse(await request(companyPath,"POST",boundaryMutation(trainingCollection,trainingId,{...trainingClosed.data.records[0].payload,officialCompliance:{name:"Otro oficial"}},1),capture2));assert.equal(trainingEdited.status,200);assert.equal(trainingEdited.data.records[0].payload.moduleClosed,false,"Capture edits reopen training")
    for(const value of [null,{},"not-an-array",[null],[{}]]){
      const malformed=await parse(await request(companyPath,"POST",boundaryMutation(trainingCollection,"malformed-training",{sessions:value}),capture2));assert.equal(malformed.status,400,JSON.stringify(value));assert.equal(malformed.data.code,"INVALID_RECORD_SHAPE")
    }
    const pepSearch={query:{nombre:"Persona ficticia",relacion:"cliente"},status:"sin_coincidencia",checkedAt:new Date().toISOString(),results:[],appliedDecisions:[],sourceSnapshots:[],recommendation:"Revisión humana"}
    assert.equal((await request(companyPath,"POST",boundaryMutation("pld-pep-search-history","valid-search",pepSearch),capture2)).status,200)
    for(const payload of [{...pepSearch,query:{nombre:42}},{...pepSearch,status:"anything"},{...pepSearch,results:[null]},{...pepSearch,results:[{status:"sin_coincidencia",score:1,requiresHumanReview:false,source:"internal",matchedFields:[],note:"",entity:{id:"bad",name:42}}]}])assert.equal((await request(companyPath,"POST",boundaryMutation("pld-pep-search-history","malformed-search",payload),capture2)).status,400)
    assert.equal((await request(companyPath,"POST",boundaryMutation("pld-pep-internal-records","malformed-decision",{schemaVersion:1,subjectName:{malformed:true},decision:"confirmado_pep",evidence:"texto"}),capture2)).status,400)
    for(const unsafe of ["javascript:alert(1)","vbscript:msgbox(1)","//evil.test/file.pdf","https://evil.test/file.pdf","data:application/pdf;base64,JVBERg==",v1.data.downloadUrl.replace(companyA.id,companyB.id)]){
      for(const payload of [{attachments:[{dataUrl:unsafe}]},{documents:[{base64:unsafe}]},{versionHistory:[{fileData:unsafe}]},{profiles:{client:{documentos:[{url:unsafe}]}}}])assert.equal((await request(companyPath,"POST",boundaryMutation("kyc_expedientes_detalle","unsafe-link",payload),capture2)).status,400,JSON.stringify(payload))
    }
    assert.equal((await request(companyPath,"POST",boundaryMutation("kyc_expedientes_detalle","ordinary-text",{notes:"Texto libre javascript:alert(1)",sourceUrl:"https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPIORPI.pdf",url:"https://normativa.example.test/consulta"}),capture2)).status,200,"Normative URLs and ordinary text are not mistaken for file references")
    const actualReference={fileVersionId:v1.data.id,documentId:v1.data.documentId,sha256:v1.data.sha256,downloadUrl:v1.data.downloadUrl,fileName:v1.data.fileName}
    const institutional={workflow:{status:"approved"},institutionalFactors:["clientesUsuarios","productosServicios","canalesTransacciones","geografia"].map((key)=>({key,score:3,rationale:"Juicio interno ficticio documentado",evidenceId:v1.data.id,evidence:actualReference})),
      controls:[{id:"control-one",label:"Control de prueba",effectiveness:"effective",evidenceId:v1.data.id,evidence:actualReference,reviewedBy:"spoofed",reviewedAt:"2099-01-01"}],sources:[{id:"normativa",label:"Referencia documentada de prueba",consultedAt:new Date().toISOString()}],methodologyAccepted:true,
      reviewPlan:{nextReviewAt:new Date(Date.now()+30*86400_000).toISOString().slice(0,10),actions:[]}}
    const fakeInstitution={...institutional,institutionalFactors:institutional.institutionalFactors.map((factor)=>({...factor,evidenceId:"free-text",evidence:undefined})),controls:institutional.controls.map((control)=>({...control,evidenceId:"free-text",evidence:undefined}))}
    assert.equal((await request(companyPath,"POST",{mutations:[{collection:"ebr-institutional-assessment",id:"singleton",expectedRevision:0,payload:fakeInstitution}]},supreme)).status,400,"Free-text citations do not authorize mitigation or approval")
    const forgedInstitution={...institutional,controls:[{...institutional.controls[0],evidence:{...actualReference,fileVersionId:"missing-real-object"}}]}
    assert.equal((await request(companyPath,"POST",{mutations:[{collection:"ebr-institutional-assessment",id:"singleton",expectedRevision:0,payload:forgedInstitution}]},supreme)).status,400)
    const foreignForm=new FormData();foreignForm.set("file",new File(["%PDF-1.4\nOTRA EMPRESA FICTICIA\n%%EOF"],"otra.pdf",{type:"application/pdf"}));foreignForm.set("moduleKey","ebr")
    const foreignRequest=new Request(origin+`/api/v1/companies/${companyB.id}/files`,{method:"POST",headers:{Cookie:supreme,Origin:origin},body:foreignForm}),foreignFile=await parse(await mf.dispatchFetch(foreignRequest.url,{method:"POST",headers:Object.fromEntries(foreignRequest.headers),body:await foreignRequest.arrayBuffer()}));assert.equal(foreignFile.status,201)
    const crossInstitution={...institutional,controls:[{...institutional.controls[0],evidence:{fileVersionId:foreignFile.data.id,sha256:foreignFile.data.sha256,documentId:foreignFile.data.documentId,downloadUrl:foreignFile.data.downloadUrl,fileName:foreignFile.data.fileName}}]}
    assert.equal((await request(companyPath,"POST",{mutations:[{collection:"ebr-institutional-assessment",id:"singleton",expectedRevision:0,payload:crossInstitution}]},supreme)).status,400,"An object from another company is not EBR support")
    const institutionSaved=await parse(await request(companyPath,"POST",{mutations:[{collection:"ebr-institutional-assessment",id:"singleton",expectedRevision:0,payload:institutional}]},supreme));assert.equal(institutionSaved.status,200,JSON.stringify(institutionSaved.data));assert.equal(institutionSaved.data.records[0].payload.institutionalRisk.complete,true);assert.equal(institutionSaved.data.records[0].payload.controls[0].reviewedBy,session.data.user.id)
    assert.equal(institutionSaved.data.records[0].payload.sources[0].recordedBy,session.data.user.id);assert.equal(institutionSaved.data.records[0].payload.sources[0].consultedAt,institutional.sources[0].consultedAt)
    assert.equal((await request(v1.data.downloadUrl,"PATCH",{status:"rejected",reason:"Rechazo de prueba"},supreme)).status,200)
    const inactiveEvidence=await parse(await request(companyPath,"POST",{mutations:[{collection:"ebr-institutional-assessment",id:"singleton",expectedRevision:1,payload:institutional}]},supreme));assert.equal(inactiveEvidence.status,400);assert.equal(inactiveEvidence.data.code,"EBR_EVIDENCE_INACTIVE")
    assert.equal((await request(v1.data.downloadUrl,"PATCH",{status:"approved"},supreme)).status,200)
    const falseClosure={...institutional,reviewPlan:{...institutional.reviewPlan,actions:[{id:"closed-false",title:"Cierre ficticio",ownerId:session.data.user.id,dueAt:institutional.reviewPlan.nextReviewAt,status:"completed",evidenceId:"invented",evidence:{...actualReference,fileVersionId:"invented"}}]}}
    assert.equal((await request(companyPath,"POST",{mutations:[{collection:"ebr-institutional-assessment",id:"singleton",expectedRevision:1,payload:falseClosure}]},supreme)).status,400,"A closed action also requires actual scoped evidence")
    const csv="cliente,rfc,tipoPersona,actividad,fecha,monto,moneda,instrumento\nCLIENTE FICTICIO,AAA010101AAA,pm_mexicana,fraccion-xv-uso-goce,2026-09-28,10000000.00,MXN,8"
    const importForm=new FormData();importForm.set("file",new File([csv],"operaciones.csv",{type:"text/csv"}));importForm.set("moduleKey","operaciones")
    const importUploadRequest=new Request(origin+`/api/v1/companies/${companyA.id}/files`,{method:"POST",headers:{Cookie:capture2,Origin:origin},body:importForm})
    const importFile=await parse(await mf.dispatchFetch(importUploadRequest.url,{method:"POST",headers:Object.fromEntries(importUploadRequest.headers),body:await importUploadRequest.arrayBuffer()}));assert.equal(importFile.status,201)
    const job=await parse(await request(`/api/v1/companies/${companyA.id}/imports`,"POST",{fileVersionId:importFile.data.id,idempotencyKey:"test-csv-once"},capture2));assert.equal(job.status,202)
    let jobData:any
    for(let attempt=0;attempt<100;attempt++){
      jobData=(await parse(await request(`/api/v1/companies/${companyA.id}/imports/${job.data.id}`,"GET",undefined,capture2))).data
      if(["ready","failed"].includes(jobData.status))break
      await new Promise((resolve)=>setTimeout(resolve,100))
    }
    assert.equal(jobData.status,"ready",JSON.stringify(jobData))
    const preview=await parse(await request(`/api/v1/companies/${companyA.id}/imports/${job.data.id}/preview`,"GET",undefined,capture2));assert.equal(preview.data.rows.length,1)
    assert.equal(preview.data.rows[0].operation.montoCentavos,1_000_000_000)
    assert.equal(preview.data.rows[0].status,"incomplete","Tabular rows need applicable SAT details before completion")
    const repeated=await parse(await request(`/api/v1/companies/${companyA.id}/imports`,"POST",{fileVersionId:importFile.data.id,idempotencyKey:"test-csv-once"},capture2));assert.equal(repeated.data.id,job.data.id)
    const defaults=await request("/api/auth/two-factor/enable","POST",{password:"updated-test-password-2026"},capture2);assert.equal(defaults.status,403,"MFA starts disabled by supreme policy")
    const tenant={...buildDefaultPldTenants(companyA.id).tenants[0],rfc:companyA.rfc,razonSocial:companyA.name}
    const operation=buildPresentationCases(tenant,new Date("2026-09-28T12:00:00Z")).operations[2]
    const fixtureExpedienteId=String(operation.expedienteReferenciado)
    assert.equal((await request(companyPath,"POST",{mutations:[{collection:"kyc_expedientes_detalle",id:fixtureExpedienteId,expectedRevision:0,payload:{expedienteId:fixtureExpedienteId,nombre:operation.cliente,rfc:operation.rfc,tipoCliente:operation.tipoCliente,identifiers:{rfc:operation.rfc,nif:"",curp:""}}}]},supreme)).status,200)
    const documentOperationId=operation.id+"-supporting-document",documentOperation={...operation,id:documentOperationId,documentosSoporte:[{id:"support-one",requisito:"Soporte ficticio",archivoNombre:"soporte.pdf",archivoContenido:"javascript:alert(1)"}]}
    assert.equal((await request(companyPath,"POST",boundaryMutation("actividades_vulnerables_operaciones",documentOperationId,documentOperation),capture2)).status,400,"Actos archivoContenido is an actual document reference")
    const safeDocumentOperation=await parse(await request(companyPath,"POST",boundaryMutation("actividades_vulnerables_operaciones",documentOperationId,{...documentOperation,documentosSoporte:[{...documentOperation.documentosSoporte[0],archivoContenido:v1.data.downloadUrl}]}),capture2));assert.equal(safeDocumentOperation.status,200,JSON.stringify(safeDocumentOperation.data));assert.equal(safeDocumentOperation.data.records.find((record:any)=>record.collection==="actividades_vulnerables_operaciones").payload.documentosSoporte[0].archivoContenido,v1.data.downloadUrl)
    assert.equal((await request(companyPath,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:documentOperationId,expectedRevision:1,deleted:true}]},supreme)).status,200)
    const foreignExpediente="foreign-eui-reference",unknownExpediente="missing-eui-reference"
    assert.equal((await request(`/api/v1/companies/${companyB.id}/records/batch`,"POST",{mutations:[{collection:"kyc_expedientes_detalle",id:foreignExpediente,expectedRevision:0,payload:{expedienteId:foreignExpediente,nombre:"Ficticio de otra empresa"}}]},supreme)).status,200)
    for(const referenced of [unknownExpediente,foreignExpediente]){
      const badReference=await parse(await request(companyPath,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:operation.id+"-bad-reference",expectedRevision:0,payload:{...operation,id:operation.id+"-bad-reference",expedienteReferenciado:referenced}}]},capture2));assert.equal(badReference.status,404,JSON.stringify(badReference.data));assert.equal(badReference.data.code,"EXPEDIENTE_NOT_FOUND")
    }
    for(const expedienteFirst of [true,false]){
      const sharedId=`same-batch-${expedienteFirst}`,linkedId=operation.id+sharedId,linked={collection:"actividades_vulnerables_operaciones",id:linkedId,expectedRevision:0,payload:{...operation,id:linkedId,expedienteReferenciado:sharedId}},eui={collection:"kyc_expedientes_detalle",id:sharedId,expectedRevision:0,payload:{expedienteId:sharedId,nombre:operation.cliente,rfc:operation.rfc}}
      const atomicLink=await parse(await request(companyPath,"POST",{mutations:expedienteFirst?[eui,linked]:[linked,eui]},capture2));assert.equal(atomicLink.status,200,JSON.stringify(atomicLink.data))
      assert.equal((await request(companyPath,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:linkedId,expectedRevision:1,deleted:true}]},supreme)).status,200)
    }
    const accumulatingIds=[operation.id+"-accum-one",operation.id+"-accum-two"]
    const accumulating=await parse(await request(companyPath,"POST",{mutations:accumulatingIds.map((id,index)=>({collection:"actividades_vulnerables_operaciones",id,expectedRevision:0,payload:{...operation,id,monto:200000,montoCentavos:20_000_000,finance:{...operation.finance,originalAmount:"200000.00",mxnAmountCents:20_000_000},liquidacion:{...(operation.liquidacion as object),monto:200000,montoCentavos:20_000_000},satFieldValues:{...operation.satFieldValues,"pago.monto":"200000.00","persona_aviso.referencia":`ACUM-TEST-${index+1}`},satCellValues:{...operation.satCellValues,"Acto u operación!F27":"200000.00","Persona Objeto del aviso!C6":`ACUM-TEST-${index+1}`}}}))},capture2));assert.equal(accumulating.status,200,JSON.stringify(accumulating.data))
    const accumulatedOperation=accumulating.data.records.find((record:any)=>record.collection==="actividades_vulnerables_operaciones"&&record.id===accumulatingIds[1]).payload,accumulatedPackage=accumulating.data.records.find((record:any)=>record.collection==="pld-sat-output-packages"&&record.payload.sourceOperationId===accumulatingIds[1]).payload
    assert.equal(accumulatedOperation.umbralStatus,"aviso");assert.equal(accumulatedPackage.outputKind,"aviso_normal");assert.equal(accumulatedPackage.label,"Aviso normal","A reportable accumulated operation is not reclassified from its individual amount")
    assert.match(accumulatedPackage.xml,/<monto_operacion>200000\.00<\/monto_operacion>/);assert.doesNotMatch(JSON.stringify(accumulatedPackage),/Laura Méndez|Inmuebles Santa Norte|CNBV-EBR-2019-ENR-2023/)
    assert.equal((await request(companyPath,"POST",{mutations:accumulatingIds.map((id)=>({collection:"actividades_vulnerables_operaciones",id,expectedRevision:1,deleted:true}))},supreme)).status,200)
    const incompleteSat=await parse(await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:operation.id,expectedRevision:0,payload:{...operation,satFieldValues:{},satCellValues:{},satMissingRequiredFields:[]}}]},capture2))
    assert.equal(incompleteSat.status,400,"An empty client-supplied missing[] does not bypass server SAT validation");assert.equal(incompleteSat.data.code,"SAT_FIELDS_INCOMPLETE")
    assert.equal((await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:operation.id,expectedRevision:0,payload:{...operation,captureStatus:"unknown",satFieldValues:{},satCellValues:{}}}]},capture2)).status,400)
    const unidentified=await parse(await request(companyPath,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:operation.id+"-unlinked",expectedRevision:0,payload:{...operation,id:operation.id+"-unlinked",expedienteReferenciado:undefined,expedienteId:undefined,clienteId:undefined}}]},capture2));assert.equal(unidentified.status,400);assert.equal(unidentified.data.code,"CLIENT_IDENTITY_REQUIRED")
    const bogusInstitution={collection:"ebr-institutional-assessment",id:"singleton",expectedRevision:1,payload:{workflow:{status:"approved",approvedBy:"spoofed"},institutionalFactors:[],controls:[],institutionalRisk:{complete:true,inherentLevel:"Bajo"},methodologyAccepted:true}}
    assert.equal((await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[bogusInstitution]},capture2)).status,403)
    assert.equal((await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[bogusInstitution]},supreme)).status,400,"Incomplete institutional risk cannot be approved even by an administrator")
    assert.equal((await request("/api/v1/grants","PUT",{...grantBase,permissions:{operaciones:["view","edit","upload","download"]}},supreme)).status,200)
    const limitedId=operation.id+"-limited",manualClientId=crypto.randomUUID(),limitedSave=await parse(await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:limitedId,expectedRevision:0,payload:{...operation,id:limitedId,expedienteReferenciado:undefined,expedienteId:undefined,clienteId:manualClientId,personaExpedienteId:undefined}}]},capture2));assert.equal(limitedSave.status,200,JSON.stringify(limitedSave.data));assert.equal(limitedSave.data.records.some((record:any)=>record.collection==="pld-sat-output-packages"),false,"Derived packages are not leaked to users without Avisos view permission")
    const forbiddenEui=await request(companyPath,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:limitedId+"-eui",expectedRevision:0,payload:{...operation,id:limitedId+"-eui"}}]},capture2);assert.equal(forbiddenEui.status,403,"A new EUI link still requires Expedientes view")
    const operationsSnapshotClient=await parse(await request(companyPath,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:limitedId+"-reuse",expectedRevision:0,payload:{...operation,id:limitedId+"-reuse",expedienteReferenciado:undefined,expedienteId:undefined,clienteId:manualClientId,importSource:{fileName:"import-ficticio.csv",fileHash:"ficticio",row:1,sheet:"data"},importClientResolution:{kind:"client",id:manualClientId}}}]},capture2));assert.equal(operationsSnapshotClient.status,200,JSON.stringify(operationsSnapshotClient.data))
    const foreignClientId=crypto.randomUUID()
    assert.equal((await request(`/api/v1/companies/${companyB.id}/records/batch`,"POST",{mutations:[{collection:"actividades_vulnerables_clientes",id:foreignClientId,expectedRevision:0,payload:{id:foreignClientId,clienteId:foreignClientId,nombre:"Cliente extranjero al ámbito",rfc:operation.rfc}}]},supreme)).status,200)
    for(const selected of [crypto.randomUUID(),foreignClientId]){
      const unknownClient=await parse(await request(companyPath,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:limitedId+"-unknown",expectedRevision:0,payload:{...operation,id:limitedId+"-unknown",expedienteReferenciado:undefined,expedienteId:undefined,clienteId:selected,importSource:{fileName:"import-ficticio.csv",fileHash:"ficticio",row:2,sheet:"data"},importClientResolution:{kind:"client",id:selected}}}]},capture2));assert.equal(unknownClient.status,404,JSON.stringify(unknownClient.data));assert.equal(unknownClient.data.code,"CLIENT_NOT_FOUND")
    }
    const provisionalId=crypto.randomUUID(),provisional={kind:"provisional",id:provisionalId,client:{id:provisionalId,nombre:operation.cliente,rfc:operation.rfc,identifiers:{rfc:operation.rfc,nif:"",curp:""},tipoCliente:operation.tipoCliente}}
    const provisionalIds=[limitedId+"-group-one",limitedId+"-group-two"]
    const grouped=await parse(await request(companyPath,"POST",{mutations:provisionalIds.map((id,index)=>({collection:"actividades_vulnerables_operaciones",id,expectedRevision:0,payload:{...operation,id,expedienteReferenciado:undefined,expedienteId:undefined,clienteId:provisionalId,importSource:{fileName:"import-ficticio.csv",fileHash:"ficticio-grupo",row:index+1,sheet:"data"},importClientResolution:provisional}}))},capture2));assert.equal(grouped.status,200,JSON.stringify(grouped.data));assert.equal(grouped.data.records.filter((record:any)=>record.collection==="actividades_vulnerables_operaciones").every((record:any)=>record.payload.clienteId===provisionalId),true)
    const indexSnapshot=await parse(await request(`/api/v1/companies/${companyA.id}/records?collection=actividades_vulnerables_clientes`,"GET",undefined,supreme));assert.equal(indexSnapshot.data.records.filter((record:any)=>record.id===provisionalId).length,1,"A shared provisional group creates one scoped reusable index entry")
    assert.equal((await request(companyPath,"POST",{mutations:provisionalIds.map((id)=>({collection:"actividades_vulnerables_operaciones",id,expectedRevision:1,deleted:true}))},supreme)).status,200)
    assert.equal((await request(companyPath,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:limitedId+"-reuse",expectedRevision:1,deleted:true}]},supreme)).status,200)
    assert.equal((await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:limitedId,expectedRevision:1,deleted:true}]},supreme)).status,200)
    assert.equal((await request("/api/v1/grants","PUT",{...grantBase,permissions:Object.fromEntries(allModules.map((module)=>[module,["view","edit","upload","download"]]))},supreme)).status,200)
    const opSave=await parse(await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:operation.id,expectedRevision:0,payload:operation}]},capture2))
    assert.equal(opSave.status,200,JSON.stringify(opSave.data));assert.equal(opSave.data.records.some((r:any)=>r.collection==="pld-sat-output-packages"),true,"Operation and SAT package are committed together")
    assert.equal((await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:operation.id,expectedRevision:1,payload:{...operation,lifecycle:{status:"cancelled",cancellationReason:"Cancelación ficticia"}}}]},capture2)).status,403,"An edit permission cannot be used to bypass archive permission")
    assert.equal((await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:operation.id,expectedRevision:1,payload:{...operation,avisoPresentado:true,submission:{...operation.submission,wasEverPresented:true}}}]},supreme)).status,400,"Presentation history cannot be fabricated without an acknowledgement")
    assert.match(opSave.data.records.find((r:any)=>r.collection==="pld-sat-output-packages").payload.xml,/<monto_operacion>400000\.00<\/monto_operacion>/)
    const opDelete=await parse(await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:operation.id,expectedRevision:1,payload:operation,deleted:true}]},supreme))
    assert.equal(opDelete.status,200,JSON.stringify(opDelete.data));assert.equal(opDelete.data.records.some((r:any)=>r.collection==="pld-sat-output-packages"&&r.deleted),true)
    const presentationId=operation.id+"-presented",presentable={...operation,id:presentationId}
    const presentableSave=await parse(await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:presentationId,expectedRevision:0,payload:presentable}]},supreme));assert.equal(presentableSave.status,200)
    const operationPresented={...presentableSave.data.records.find((record:any)=>record.collection==="actividades_vulnerables_operaciones").payload,revision:2,avisoPresentado:true,submission:{status:"presented",wasEverPresented:true,reference:"FOLIO-FICTICIO",presentedBy:"spoofed"}}
    const firstSubmissionId=`submission-${presentationId}-r1`,presentation={id:firstSubmissionId,schemaVersion:2,operationId:presentationId,preparedOperationRevision:1,sourceOperationRevision:2,status:"presented",form:{folio:"FOLIO-FICTICIO",digitalSeal:"SELLO-FICTICIO-NO-SAT",submissionDate:"2026-09-28",acknowledgementDate:"2026-09-28"},attachments:[{type:"Acuse SAT",dataUrl:v1.data.downloadUrl,sha256:v1.data.sha256}]}
    const proofSave=await parse(await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:presentationId,expectedRevision:1,payload:operationPresented},{collection:"pld-submissions-workflow",id:firstSubmissionId,expectedRevision:0,payload:presentation}]},supreme));assert.equal(proofSave.status,200,JSON.stringify(proofSave.data))
    const storedPresented=proofSave.data.records.find((record:any)=>record.collection==="actividades_vulnerables_operaciones").payload;assert.equal(storedPresented.submission.presentedBy,session.data.user.id)
    const originalWorkflow=proofSave.data.records.find((record:any)=>record.collection==="pld-submissions-workflow").payload
    assert.equal((await request(companyPath,"POST",{mutations:[{collection:"kyc_expedientes_detalle",id:fixtureExpedienteId,expectedRevision:1,payload:{expedienteId:fixtureExpedienteId,nombre:operation.cliente,rfc:operation.rfc,archived:true}}]},supreme)).status,200)
    assert.equal((await request(companyPath,"POST",{mutations:[{collection:"pld-submissions-workflow",id:firstSubmissionId,expectedRevision:1,payload:{...originalWorkflow,form:{...originalWorkflow.form,folio:"MODIFICADO"}}}]},supreme)).status,409,"A presented workflow is immutable")
    assert.equal((await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:presentationId,expectedRevision:2,payload:storedPresented,deleted:true}]},supreme)).status,409,"A presented operation cannot be deleted")
    const editPresented=await parse(await request(companyPath,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:presentationId,expectedRevision:2,payload:{...storedPresented,tipoOperacion:"Corrección ficticia",submission:{...storedPresented.submission,correctionReason:"Corrección documentada de prueba"}}}]},supreme));assert.equal(editPresented.status,200,JSON.stringify(editPresented.data))
    const correctedOperation=editPresented.data.records.find((record:any)=>record.collection==="actividades_vulnerables_operaciones").payload;assert.equal(correctedOperation.submission.status,"correction-pending")
    const correctionId=`submission-${presentationId}-r3`,draftCorrection={...presentation,id:correctionId,preparedOperationRevision:3,sourceOperationRevision:3,status:"draft",correctionOf:firstSubmissionId,previousOperationRevision:2,form:{},attachments:[]}
    assert.equal((await request(companyPath,"POST",{mutations:[{collection:"pld-submissions-workflow",id:correctionId,expectedRevision:0,payload:draftCorrection}]},supreme)).status,200)
    const correctingPresentation={...correctedOperation,revision:4,submission:{...correctedOperation.submission,status:"presented",reference:"FOLIO-CORRECCION-FICTICIO",correctionReason:undefined}},newWorkflow={...draftCorrection,status:"presented",sourceOperationRevision:4,form:{...presentation.form,folio:"FOLIO-CORRECCION-FICTICIO"},attachments:presentation.attachments}
    const correctionMutations=(workflow:any)=>[{collection:"actividades_vulnerables_operaciones",id:presentationId,expectedRevision:3,payload:correctingPresentation},{collection:"pld-submissions-workflow",id:correctionId,expectedRevision:1,payload:workflow}]
    const newReceipt={...newWorkflow,attachments:[{type:"Acuse SAT",dataUrl:v2.data.downloadUrl,sha256:v2.data.sha256}]}
    const beforePackage=await db.prepare("SELECT payload FROM pld_records WHERE companyId=? AND collection='pld-sat-output-packages' AND id=?").bind(companyA.id,`satpkg-${presentationId}`).first<{payload:string}>();assert.ok(beforePackage)
    // Simulate an earlier stale-package persistence bug, not an authorized API write.
    await db.prepare("UPDATE pld_records SET payload=? WHERE companyId=? AND collection='pld-sat-output-packages' AND id=?").bind(JSON.stringify({...JSON.parse(beforePackage!.payload),sourceOperationRevision:2}),companyA.id,`satpkg-${presentationId}`).run()
    const stalePackage=await parse(await request(companyPath,"POST",{mutations:correctionMutations(newReceipt)},supreme));assert.equal(stalePackage.status,409);assert.equal(stalePackage.data.code,"SUBMISSION_PACKAGE_STALE")
    await db.prepare("UPDATE pld_records SET payload=? WHERE companyId=? AND collection='pld-sat-output-packages' AND id=?").bind(beforePackage!.payload,companyA.id,`satpkg-${presentationId}`).run()
    const changedCapture=correctionMutations(newReceipt);changedCapture[0].payload={...correctingPresentation,tipoOperacion:"Captura modificada sin preparar paquete"}
    const changedDuringConfirmation=await parse(await request(companyPath,"POST",{mutations:changedCapture},supreme));assert.equal(changedDuringConfirmation.status,409);assert.equal(changedDuringConfirmation.data.code,"SUBMISSION_CAPTURE_CHANGED")
    const reusedAck=await parse(await request(companyPath,"POST",{mutations:correctionMutations(newWorkflow)},supreme));assert.equal(reusedAck.status,400,JSON.stringify(reusedAck.data));assert.equal(reusedAck.data.code,"ACK_REUSE_FORBIDDEN")
    const correctionSaved=await parse(await request(companyPath,"POST",{mutations:correctionMutations(newReceipt)},supreme));assert.equal(correctionSaved.status,200,JSON.stringify(correctionSaved.data))
    const currentPresented=correctionSaved.data.records.find((record:any)=>record.collection==="actividades_vulnerables_operaciones").payload;assert.equal(currentPresented.revision,4);assert.equal(currentPresented.submission.status,"presented")
    const historicalWorkflow=await parse(await request(`/api/v1/companies/${companyA.id}/records/pld-submissions-workflow/${firstSubmissionId}/history`,"GET",undefined,supreme));assert.equal(historicalWorkflow.data.versions.length,1);assert.deepEqual(historicalWorkflow.data.versions[0].payload,originalWorkflow)
    const cancellation=await parse(await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{collection:"actividades_vulnerables_operaciones",id:presentationId,expectedRevision:4,payload:{...currentPresented,lifecycle:{status:"cancelled",cancellationReason:"Cancelación de ejemplo ficticio"}}}]},supreme));assert.equal(cancellation.status,200,JSON.stringify(cancellation.data));assert.equal(cancellation.data.records.find((record:any)=>record.collection==="actividades_vulnerables_operaciones").payload.lifecycle.cancelledBy,session.data.user.id)
    assert.equal((await request(`/api/v1/companies/${companyA.id}/backups`,"POST",{},capture2)).status,403)
    const backup=await parse(await request(`/api/v1/companies/${companyA.id}/backups`,"POST",{},supreme));assert.equal(backup.status,201,JSON.stringify(backup.data));assert.ok(backup.data.fileCount>=3)
    const manifest=await parse(await request(`/api/v1/companies/${companyA.id}/backups/${backup.data.id}`,"GET",undefined,supreme));assert.equal(manifest.status,200);assert.deepEqual(Object.keys(manifest.data).sort(),["version","companyId","createdAt","records","documents","files","history"].sort());assert.equal(JSON.stringify(manifest.data).includes("test-password"),false)
    const deletedEui=await request(`/api/v1/companies/${companyA.id}/records/batch`,"POST",{mutations:[{...mutation,expectedRevision:2,deleted:true}]},supreme);assert.equal(deletedEui.status,200)
    const originalObject=await db.prepare("SELECT objectKey FROM pld_file_versions WHERE id=?").bind(v1.data.id).first<{objectKey:string}>();assert.ok(originalObject)
    const bucket=await mf.getR2Bucket("EVIDENCE_BUCKET");await bucket.delete(originalObject!.objectKey)
    assert.equal((await request(v1.data.downloadUrl,"GET",undefined,supreme)).status,404)
    const missingEvidence=await parse(await request(companyPath,"POST",{mutations:[{collection:"ebr-institutional-assessment",id:"singleton",expectedRevision:1,payload:institutional}]},supreme));assert.equal(missingEvidence.status,400);assert.equal(missingEvidence.data.code,"EBR_EVIDENCE_MISSING")
    const recoveryPath=`/api/v1/companies/${companyA.id}/backups/${backup.data.id}/restore`
    assert.equal((await request(recoveryPath,"POST",{confirmCompanyId:companyA.id,expectedRevisions:[{collection:mutation.collection,id:mutation.id,revision:2}],fileVersionIds:[v1.data.id]},supreme)).status,409,"Stale restoration cannot overwrite a changed record")
    const restored=await parse(await request(recoveryPath,"POST",{confirmCompanyId:companyA.id,expectedRevisions:[{collection:mutation.collection,id:mutation.id,revision:3}],fileVersionIds:[v1.data.id]},supreme));assert.equal(restored.status,200,JSON.stringify(restored.data));assert.equal(restored.data.filesRecovered,1);assert.equal(restored.data.fullDisasterRecovery,false);assert.equal(restored.data.records[0].revision,4)
    assert.match(await (await request(v1.data.downloadUrl,"GET",undefined,supreme)).text(),/VERSION UNO/)
    const kept=await parse(await request(recoveryPath,"POST",{confirmCompanyId:companyA.id,expectedRevisions:[{collection:mutation.collection,id:mutation.id,revision:4}],fileVersionIds:[v1.data.id]},supreme));assert.equal(kept.status,200);assert.equal(kept.data.records.length,0);assert.equal(kept.data.filesRecovered,0);assert.equal(kept.data.skipped[0].reason,"ACTIVE_RECORD_PRESERVED")
    assert.equal((await request(`/api/v1/organizations/${orgA.id}`,"PATCH",{mfaEnabled:true},capture2)).status,403)
    assert.equal((await request(`/api/v1/organizations/${orgA.id}`,"PATCH",{mfaEnabled:true},supreme)).status,200)
    assert.equal((await request("/api/v1/admin","GET",undefined,supreme)).status,403,"The owner must also enroll when activating MFA")
    const supremeMfa=await parse(await request("/api/auth/two-factor/enable","POST",{password:"test-password-only-2026"},supreme));assert.equal(supremeMfa.status,200,JSON.stringify(supremeMfa.data))
    const supremeVerified=await request("/api/auth/two-factor/verify-totp","POST",{code:totp(new URL(supremeMfa.data.totpURI).searchParams.get("secret")!)},supreme);assert.equal(supremeVerified.status,200,JSON.stringify(await supremeVerified.clone().json()));supreme=cookies(supremeVerified,supreme)
    assert.equal((await request("/api/v1/admin","GET",undefined,supreme)).status,200)
    assert.equal((await request(`/api/v1/companies/${companyA.id}/snapshot`,"GET",undefined,capture2)).status,401,"Changing MFA policy revokes earlier sessions")
    capture2=await login("capture@example.test","updated-test-password-2026")
    assert.equal((await request(`/api/v1/companies/${companyA.id}/snapshot`,"GET",undefined,capture2)).status,403,"Enrollment is required")
    const enrolled=await parse(await request("/api/auth/two-factor/enable","POST",{password:"updated-test-password-2026"},capture2))
    assert.equal(enrolled.status,200,JSON.stringify(enrolled.data));assert.ok(enrolled.data.totpURI);assert.ok(enrolled.data.backupCodes.length)
    const verificationResponse=await request("/api/auth/two-factor/verify-totp","POST",{code:totp(new URL(enrolled.data.totpURI).searchParams.get("secret")!)},capture2);capture2=cookies(verificationResponse,capture2)
    const verified=await parse(verificationResponse)
    assert.equal(verified.status,200,JSON.stringify(verified.data))
    await request("/api/auth/sign-out","POST",{},capture2)
    const challenge=await request("/api/auth/sign-in/email","POST",{email:"capture@example.test",password:"updated-test-password-2026"})
    const challengeData=await challenge.json() as any;assert.equal(challengeData.twoFactorRedirect,true)
    const challengeCookies=challenge.headers.getSetCookie().map((c)=>c.split(";")[0]).join("; ")
    assert.equal((await request("/api/v1/session","GET",undefined,challengeCookies)).status,401,"Password alone does not establish an MFA session")
    const recovery=await request("/api/auth/two-factor/verify-backup-code","POST",{code:enrolled.data.backupCodes[0]},challengeCookies)
    const recoveryData=await recovery.json();assert.equal(recovery.status,200,JSON.stringify(recoveryData))
    capture2=recovery.headers.getSetCookie().map((c)=>c.split(";")[0]).join("; ")
    assert.equal((await request("/api/v1/session","GET",undefined,capture2)).status,200)
    const administrativeSessions=await parse(await request(`/api/v1/users/${created.data.user.id}/sessions?organizationId=${orgA.id}`,"GET",undefined,supreme));assert.equal(administrativeSessions.status,200);assert.ok(administrativeSessions.data.sessions.length)
    assert.equal((await request(`/api/v1/users/${created.data.user.id}/sessions`,"DELETE",{organizationId:orgA.id},supreme)).status,200)
    assert.equal((await request("/api/v1/session","GET",undefined,capture2)).status,401,"Administrative revocation invalidates the next request")
    // Grant revocation is also checked against a fresh session, independent of revocation.
    const challengeAgain=await request("/api/auth/sign-in/email","POST",{email:"capture@example.test",password:"updated-test-password-2026"})
    const cookiesAgain=challengeAgain.headers.getSetCookie().map((c)=>c.split(";")[0]).join("; ")
    const recoverAgain=await request("/api/auth/two-factor/verify-backup-code","POST",{code:enrolled.data.backupCodes[1]},cookiesAgain)
    assert.equal(recoverAgain.status,200);capture2=recoverAgain.headers.getSetCookie().map((c)=>c.split(";")[0]).join("; ")
    assert.equal((await request("/api/v1/grants","DELETE",{organizationId:orgA.id,userId:created.data.user.id,companyId:companyA.id},supreme)).status,200)
    assert.equal((await request(`/api/v1/companies/${companyA.id}/snapshot`,"GET",undefined,capture2)).status,404,"Revocation is immediate without relying on a new login")
    const admin=await parse(await request("/api/v1/admin","GET",undefined,supreme));assert.equal(admin.status,200);assert.equal(admin.data.audit.some((e:any)=>e.action==="file.uploaded"),true)
    assert.ok(admin.data.users.find((user:any)=>user.id===created.data.user.id).lastAccess,"Last access survives revocation and is based on a completed authenticated sign-in")
    assert.equal(JSON.stringify(admin.data.users).includes("test-password"),false)
  }finally{await mf.dispose()}
})
