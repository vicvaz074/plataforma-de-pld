'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'), os=require('node:os'),path=require('node:path')
const {randomBytes,createHash}=require('node:crypto')
const {DatabaseSync}=require('node:sqlite')
const {startServer,inspectDatabase}=require('./index.cjs')
const {makeBinding}=require('./sqlite.cjs')
const {privateBucket,belowRoot}=require('./files.cjs')
const root=path.resolve(__dirname,'../..'), migrationsPath=path.join(root,'migrations')
const secret=randomBytes(40).toString('hex')
test('contención de recursos Windows admite casing del volumen pero nunca otra raíz, unidad ni carpeta vecina',()=>{
  const p=path.win32,dir='C:/Users/RunnerAdmin/Temp/pld';
  assert.equal(belowRoot(dir,'c:/users/RUNNERadmin/temp/pld/login.html',p),true);
  for(const outside of ['C:/Users/RunnerAdmin/Temp/pld-privado/login.html','D:/otros/login.html',dir])assert.equal(belowRoot(dir,outside,p),false);
})
function folder(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'davara-test-runtime-'))
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}))
  return dir
}
function opts(dir){
  const assetsPath=path.join(dir,'out'),workerPath=path.join(dir,'worker.cjs')
  fs.mkdirSync(assetsPath);fs.writeFileSync(path.join(assetsPath,'login.html'),'<html>Ingreso de prueba</html>')
  require('esbuild').buildSync({entryPoints:[path.join(root,'workers/index.ts')],bundle:true,platform:'node',format:'cjs',target:'node22',outfile:workerPath})
  return {databasePath:path.join(dir,'empresa.sqlite'),storagePath:path.join(dir,'adjuntos'),assetsPath,migrationsPath,workerPath,secret}
}
test('identificación previa no crea archivos ni modifica bases ajenas',t=>{
  const dir=folder(t),file=path.join(dir,'datos.sqlite')
  assert.deepEqual(inspectDatabase(file,migrationsPath),{kind:'new',hasUsers:false});assert.equal(fs.existsSync(file),false)
  const db=new DatabaseSync(file);db.exec('CREATE TABLE original (valor TEXT)');db.close()
  const before=createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  assert.throws(()=>inspectDatabase(file,migrationsPath),/no corresponde/)
  assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before)
})
test('el adaptador SQL confirma o revierte el lote completo',async()=>{
  const db=new DatabaseSync(':memory:'),adapter=makeBinding(db)
  try{
    await adapter.exec('CREATE TABLE muestra (id INTEGER PRIMARY KEY,revision INTEGER CHECK(revision>0))')
    await assert.rejects(adapter.batch([adapter.prepare('INSERT INTO muestra VALUES(1,1)'),adapter.prepare('INSERT INTO muestra VALUES(2,-1)')]))
    assert.equal(await adapter.prepare('SELECT id FROM muestra').first(),null)
    await adapter.prepare('INSERT INTO muestra VALUES(1,2)').run()
    assert.equal(await adapter.prepare('SELECT revision FROM muestra').first('revision'),2)
  }finally{db.close()}
})
test('objetos privados conservan bytes y claves sin rutas controladas por el usuario',async t=>{
  const dir=folder(t),bucket=privateBucket(dir),name='organización/empresa/demo.pdf',bytes=Uint8Array.from([0,37,255])
  await bucket.put(name,bytes);let f=await bucket.get(name)
  assert.equal(f.size,3);assert.deepEqual(new Uint8Array(await new Response(f.body).arrayBuffer()),bytes)
  await bucket.delete(name);assert.equal(await bucket.get(name),null)
})
test('servidor empaquetable: admin único, inicio real, expediente, evidencia, aislamiento y reapertura',async t=>{
  const dir=folder(t),options=opts(dir)
  let service=await startServer(options),cookie=''
  const admin={name:'Administrador de prueba',email:'principal@example.test',password:randomBytes(22).toString('hex')}
  async function req(route,method='GET',payload,extra={}){
    const form=payload instanceof FormData
    const headers={Origin:service.origin,...(cookie?{Cookie:cookie}:{}),...(!form&&payload?{'Content-Type':'application/json'}:{}),...extra}
    return fetch(service.origin+route,{method,headers,body:form?payload:payload?JSON.stringify(payload):undefined})
  }
  async function checked(route,method,payload,want){
    const res=await req(route,method,payload);assert.equal(res.status,want,route);return res.json()
  }
  async function signIn(){
    const res=await req('/api/auth/sign-in/email','POST',{email:admin.email,password:admin.password});assert.equal(res.status,200)
    cookie=res.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');assert.ok(cookie)
  }
  try{
    assert.equal(service.hasUsers,false)
    assert.equal((await req('/login')).status,200)
    assert.equal((await req('/api/v1/session')).status,401)
    assert.equal((await req('/api/v1/bootstrap','POST',admin)).status,404)
    assert.equal((await (await req('/api/v1/health')).json()).distribution,'pld-onprem')
    const bad=await fetch(service.origin+'/api/v1/session',{headers:{Origin:'https://otra.example.test'}});assert.equal(bad.status,403)
    await service.bootstrap(admin);assert.equal(service.hasUsers,true)
    await assert.rejects(service.bootstrap(admin),/administrador/)
    await signIn();assert.equal((await checked('/api/v1/session','GET',null,200)).user.platformRole,'superadmin')
    const org=await checked('/api/v1/organizations','POST',{name:'Ficticia'},201)
    const company=await checked('/api/v1/companies','POST',{name:'Prueba A',organizationId:org.id,rfc:'AAA010101AAA'},201)
    const other=await checked('/api/v1/companies','POST',{name:'Prueba B',organizationId:org.id,rfc:'BBB010101BBB'},201)
    const base='/api/v1/companies/'+company.id
    const item={collection:'kyc_expedientes_detalle',id:'demo-one',expectedRevision:0,payload:{id:'demo-one',nombre:'Cliente ficticio',identifiers:{curp:'TEST010101HDFXXX00'}}}
    await checked(base+'/records/batch','POST',{mutations:[item]},200)
    assert.equal((await req(base+'/records/batch','POST',{mutations:[item]})).status,409)
    const file=new FormData();file.set('file',new Blob(['evidencia ficticia']),'prueba.txt');file.set('moduleKey','evidencias');file.set('title','Evidencia de prueba')
    const header={'X-PLD-Upload-Key':'f'.repeat(64)}
    assert.equal((await req(base+'/files','POST',file,{'X-PLD-Upload-Key':'no-es-una-clave'})).status,400)
    const [first,duplicate]=await Promise.all([req(base+'/files','POST',file,header),req(base+'/files','POST',file,header)])
    assert.equal(first.status,201);assert.equal(duplicate.status,201)
    const version=await first.json();assert.equal((await duplicate.json()).id,version.id)
    file.set('title','Otro destino')
    assert.equal((await req(base+'/files','POST',file,header)).status,409)
    file.set('title','Evidencia de prueba')
    assert.equal((await (await req(base+'/files','POST',file,header)).json()).id,version.id)
    const separate=await req('/api/v1/companies/'+other.id+'/files','POST',file,header)
    assert.equal(separate.status,201);assert.notEqual((await separate.json()).id,version.id)
    assert.equal((await req('/api/v1/companies/'+other.id+'/files/'+version.id)).status,404)
    const bk=await checked(base+'/backups','POST',{},201);assert.equal(bk.fileCount,1)
    const csvForm=new FormData()
    csvForm.set('file',new Blob(['cliente,rfc,tipoPersona,actividad,fecha,monto,moneda,instrumento\nFICTICIO,AAA010101AAA,pm_mexicana,fraccion-xv-uso-goce,2026-09-28,10000000.00,MXN,8']),'demo.csv')
    csvForm.set('moduleKey','operaciones')
    const imported=await checked(base+'/files','POST',csvForm,201)
    const job=await checked(base+'/imports','POST',{fileVersionId:imported.id,idempotencyKey:'csv-demo'},202)
    await service.close()
    assert.deepEqual(inspectDatabase(options.databasePath,migrationsPath),{kind:'existing',hasUsers:true})
    await assert.rejects(startServer({...options,secret:randomBytes(40).toString('hex')}),/clave/)
    await assert.rejects(startServer({...options,storagePath:path.join(dir,'equivocado')}),/almacén/)
    service=await startServer(options);cookie='';assert.equal(service.hasUsers,true);await signIn()
    assert.equal((await req(base+'/files/'+version.id)).status,200)
    assert.equal(await (await req(base+'/files/'+version.id)).text(),'evidencia ficticia')
    assert.ok((await checked(base+'/snapshot','GET',null,200)).records.some(v=>v.id===item.id))
    assert.ok(!(await checked('/api/v1/companies/'+other.id+'/snapshot','GET',null,200)).records.some(v=>v.id===item.id))
    let jobState
    for(let i=0;i<100;i++){
      jobState=await checked(base+'/imports/'+job.id,'GET',null,200)
      if(jobState.status==='ready'||jobState.status==='failed')break
      await new Promise(r=>setTimeout(r,80))
    }
    assert.equal(jobState.status,'ready',jobState.error||'Se esperaba una vista previa de importación.')
    const preview=await checked(base+'/imports/'+job.id+'/preview','GET',null,200)
    assert.equal(preview.rows[0].operation.montoCentavos,1_000_000_000)
    assert.equal((await checked(base+'/imports','POST',{fileVersionId:imported.id,idempotencyKey:'csv-demo'},200)).id,job.id)
  }finally{await service.close()}
})
