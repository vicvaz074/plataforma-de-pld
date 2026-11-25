'use strict'
const http=require('node:http')
const path=require('node:path')
const fs=require('node:fs')
const {Readable}=require('node:stream')
const {pipeline}=require('node:stream/promises')
const {randomBytes}=require('node:crypto')
const {inspectDatabase,openDatabase}=require('./sqlite.cjs')
const {privateBucket,staticAssets}=require('./files.cjs')

function parseOrigin(value){
  if (!value)return null
  const u=new URL(value)
  if (u.protocol!=='https:'||u.pathname!=='/'||u.search||u.hash||u.username||u.password) throw Error('El dominio corporativo debe ser un origen HTTPS sin ruta, usuario ni contraseña.')
  return u
}
function durableImports(db,worker,env){
  let timer,stopped=false,running=null
  async function pump(){
    await worker.scheduled({},env)
    // The original outbox and job claim are SQLite-backed. Polling their
    // durable state also recovers a crash between dispatch and execution.
    const jobs=db.prepare("SELECT id FROM pld_import_jobs WHERE status='queued' ORDER BY createdAt LIMIT 10").all()
    for(const job of jobs){
      if(stopped)break
      await worker.queue({messages:[{body:{jobId:job.id},ack(){},retry(){}}]},env)
    }
  }
  function wake(ms){
    if(stopped||running)return
    clearTimeout(timer)
    timer=setTimeout(()=>{running=pump().catch(()=>{console.error('pld.desktop.import.dispatch_failed')}).finally(()=>{running=null;wake(3000)})},ms)
    timer.unref()
  }
  env.IMPORT_QUEUE={async send(){wake(30)}}
  wake(50)
  return async()=>{stopped=true;clearTimeout(timer);await running}
}
function apiError(status,message){return Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}})}
async function requestBody(req){
  if(['GET','HEAD'].includes(req.method))return undefined
  const max=String(req.headers['content-type']||'').startsWith('multipart/form-data')?20*1024*1024+100000:2000000
  if(Number(req.headers['content-length'])>max)throw Error('PLD_BODY_LIMIT')
  let size=0;const chunks=[]
  for await (const chunk of req){size+=chunk.length;if(size>max)throw Error('PLD_BODY_LIMIT');chunks.push(chunk)}
  return Buffer.concat(chunks,size)
}
function isNested(root,file){return file===root||file.startsWith(root+path.sep)}
async function startServer(options){
  const {databasePath,storagePath,assetsPath,migrationsPath,workerPath,secret,port=0,bootstrapEmail}=options
  const external=parseOrigin(options.publicOrigin)
  const root=fs.realpathSync(assetsPath)
  if(isNested(root,path.resolve(databasePath))||isNested(root,path.resolve(storagePath)))throw Error('La base y los documentos no deben guardarse en la carpeta pública.')
  const entry=require(workerPath), worker=entry.default||entry
  if(typeof worker.fetch!=='function'||typeof worker.queue!=='function'||typeof worker.scheduled!=='function')throw Error('El servicio incluido en el instalador no es válido.')
  const assets=staticAssets(root)
  const {db,binding,hasUsers}=openDatabase(options)
  const token=options.bootstrapToken||randomBytes(40).toString('hex')
  let origin,listenOrigin,stopImports,ready=false,closed=false,bootstrapPending=false
  const env={DB:binding,EVIDENCE_BUCKET:privateBucket(storagePath),ASSETS:assets,ENVIRONMENT:'onprem',BETTER_AUTH_SECRET:secret}
  const server=http.createServer({requestTimeout:120_000,headersTimeout:15_000},async(req,res)=>{
    async function dispatch(){
      if(!ready)return apiError(503,'El servicio se está preparando.')
      // When configured behind TLS, the local reverse proxy must preserve the
      // corporate Host. Forwarded Host/Proto headers never select this origin.
      if(req.headers.host!==new URL(origin).host)return apiError(421,'Dominio no autorizado.')
      const raw=req.url||'/'
      if(!raw.startsWith('/')||raw.startsWith('//')||raw.includes('\\'))return apiError(400,'Ruta no válida.')
      const u=new URL(raw,origin)
      if(u.origin!==origin)return apiError(400,'Ruta no válida.')
      if(u.pathname.replace(/\/+$/,'')==='/api/v1/bootstrap')return apiError(404,'Recurso no disponible.')
      if(req.headers.origin && req.headers.origin!==origin)return apiError(403,'Origen no autorizado.')
      const remoteHeaders=new Headers()
      for(const [k,v] of Object.entries(req.headers)){
        if(v===undefined||['connection','keep-alive','transfer-encoding','host','forwarded','cf-connecting-ip','x-forwarded-host','x-forwarded-proto','x-forwarded-for'].includes(k))continue
        if(Array.isArray(v)){for(const s of v)remoteHeaders.append(k,s)}else remoteHeaders.set(k,v)
      }
      remoteHeaders.set('cf-connecting-ip',req.socket.remoteAddress||'127.0.0.1')
      if(u.pathname==='/api/v1/health' && req.method==='GET'){
        return Response.json({configured:true,mode:'cloud',environment:'onprem',distribution:'pld-onprem'},{headers:{'Cache-Control':'no-store'}})
      }
      const request=new Request(u,{method:req.method,headers:remoteHeaders,body:await requestBody(req)})
      if(u.pathname==='/api'||u.pathname.startsWith('/api/'))return worker.fetch(request,env)
      return assets.fetch(request)
    }
    try{
      const reply=await dispatch()
      res.statusCode=reply.status
      reply.headers.forEach((v,k)=>{if(k!=='set-cookie')res.setHeader(k,v)})
      const cookies=reply.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies)
      if(reply.body&&req.method!=='HEAD')await pipeline(Readable.fromWeb(reply.body),res)
      else res.end()
    }catch(e){
      if(res.destroyed||res.headersSent){res.destroy();return}
      const large=e.message==='PLD_BODY_LIMIT'
      res.writeHead(large?413:500,{'Content-Type':'application/json','Cache-Control':'no-store'})
      res.end(JSON.stringify({error:large?'Solicitud demasiado grande.':'No se pudo completar la solicitud.'}))
    }
  })
  try{
    await new Promise((ok,fail)=>{
      server.once('error',fail)
      server.listen(port,'127.0.0.1',()=>{server.removeListener('error',fail);ok()})
    })
    listenOrigin='http://127.0.0.1:'+server.address().port
    origin=external?external.origin:listenOrigin
    env.BETTER_AUTH_URL=origin
    stopImports=durableImports(db,worker,env);ready=true
    return {
      origin,listenOrigin,
      get hasUsers(){return closed?hasUsers:Boolean(db.prepare('SELECT 1 FROM user LIMIT 1').get())},
      async bootstrap(input){
        if(closed||bootstrapPending||db.prepare('SELECT 1 FROM user LIMIT 1').get())throw Error('La instalación ya tiene administrador o el alta está en curso.')
        bootstrapPending=true
        try{
          const resp=await worker.fetch(new Request(origin+'/api/v1/bootstrap',{method:'POST',headers:{origin,'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(input)}),{...env,BOOTSTRAP_TOKEN:token,BOOTSTRAP_EMAIL:bootstrapEmail})
          if(!resp.ok){const err=await resp.json();throw Error(err.error||'No se pudo crear el administrador.')}
        }finally{bootstrapPending=false}
      },
      async close(){
        if(closed)return
        closed=true;ready=false
        await Promise.all([stopImports(),new Promise(resolve=>server.close(resolve))])
        db.close()
      }
    }
  }catch(e){await stopImports?.();server.close();db.close();throw e}
}
module.exports={startServer,inspectDatabase}
