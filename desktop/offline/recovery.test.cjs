"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {handleRecovery}=require("./recovery.cjs");
const origin="https://pld.example.test",company="prueba";
function mock(){const data=new Map(),perm=new Set(["view","edit","upload","download"]);let user="A";return {data,perm,as:u=>user=u,context:()=>({actorId:user,origin,can:(c,k,a)=>c===company&&k==="kyc_expedientes_detalle"&&perm.has(a),get:()=>structuredClone(data.get(user)||[]),set:xs=>data.set(user,structuredClone(xs))})}}
async function call(m,method,scope=company,body,id,confirm=false){
  const url=new URL("/api/v1/desktop-offline/recovery",origin);url.searchParams.set("companyId",scope);if(id)url.searchParams.set("id",id);
  const r=await handleRecovery(new Request(url,{method,...(body?{body:JSON.stringify(body)}:{}),headers:confirm?{"x-pld-confirm":"yes"}:{}}),m.context());
  return {status:r.status,body:await r.json()};
}
const file={kind:"file",collection:"kyc_expedientes_detalle",name:"ficticio.txt",data:"data:text/plain;base64,QUJD"};
test("la copia de un adjunto fallido no es una versión documental; repetir no duplica y cada acceso queda aislado",async()=>{
  const m=mock(),saved=await call(m,"POST",company,file);
  assert.equal(saved.status,201);assert.equal(saved.body.localOnly,true);assert.equal(saved.body.documentId,undefined);
  const {id}=saved.body;assert.equal((await call(m,"POST",company,file)).body.id,id);
  assert.equal((await call(m,"GET")).body.items.length,1);
  assert.equal((await call(m,"GET","otra",null,id)).status,404);
  m.as("B");assert.equal((await call(m,"GET",company,null,id)).status,404);m.as("A");
  m.perm.delete("download");assert.equal((await call(m,"GET",company,null,id)).status,404);m.perm.add("download");
  assert.equal((await call(m,"GET",company,null,id)).body.body.data,file.data);
  assert.equal((await call(m,"DELETE",company,null,id)).status,400);
  assert.equal((await call(m,"DELETE",company,null,id,true)).status,200);
});
test("registros conservan revisión y adjuntos con control de carga; una colección no autorizada rechaza el lote",async()=>{
  const m=mock(),mutation={collection:file.collection,id:"exp-1",expectedRevision:7,payload:{documento:file.data}};
  const body={kind:"records",mutations:[mutation]};m.perm.delete("upload");
  assert.equal((await call(m,"POST",company,body)).status,403);m.perm.add("upload");
  const r=await call(m,"POST",company,body);assert.equal((await call(m,"GET",company,null,r.body.id)).body.body.mutations[0].expectedRevision,7);
  assert.equal((await call(m,"POST",company,{kind:"records",mutations:[mutation,{...mutation,collection:"users"}]})).status,403);
  assert.equal((await call(m,"GET")).body.items.length,1);
});
