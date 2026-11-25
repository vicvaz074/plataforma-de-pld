'use strict'
const fs = require('node:fs')
const fsp = fs.promises
const path = require('node:path')
const {createHash,randomUUID} = require('node:crypto')
const {Readable} = require('node:stream')

// Object keys come from the application, never become filenames, and never
// share the directory of the frontend. A download always goes through the API.
function privateBucket(dir) {
  function filename(key){
    const h=createHash('sha256').update(String(key)).digest('hex')
    return path.join(dir,h.slice(0,2),h.slice(2))
  }
  return {
    async put(key,value){
      const name=filename(key), tmp=name+'.'+randomUUID()+'.part'
      await fsp.mkdir(path.dirname(name),{recursive:true,mode:0o700})
      const bytes=value instanceof ArrayBuffer ? Buffer.from(value) : ArrayBuffer.isView(value) ? Buffer.from(value.buffer,value.byteOffset,value.byteLength) : Buffer.from(await new Response(value).arrayBuffer())
      const h=await fsp.open(tmp,'wx',0o600)
      try {
        try { await h.writeFile(bytes);await h.sync() } finally { await h.close() }
        await fsp.rename(tmp,name)
      } catch(e) {await fsp.unlink(tmp).catch(()=>{});throw e}
    },
    async get(key){
      const name=filename(key)
      let f
      try {f=await fsp.open(name,'r')} catch(e){if(e.code==='ENOENT')return null;throw e}
      try{
        const stat=await f.stat()
        return {size:stat.size,body:Readable.toWeb(f.createReadStream({autoClose:true}))}
      }catch(e){await f.close();throw e}
    },
    async delete(key){try{await fsp.unlink(filename(key))}catch(e){if(e.code!=='ENOENT')throw e}}
  }
}
const MIME={'.css':'text/css','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.html':'text/html; charset=utf-8','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.pdf':'application/pdf','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.xlsm':'application/vnd.ms-excel.sheet.macroEnabled.12','.wasm':'application/wasm','.csv':'text/csv','.xml':'application/xml'}
// Self-hosted HTML, inline Next hydration and PDF workers. A desktop install
// cannot silently send form values or the postal lookup to external services.
const CSP="default-src 'self'; connect-src 'self' blob: data:; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self' blob:; frame-src 'self' blob: data:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
function staticAssets(rootDir) {
  const dir=fs.realpathSync(rootDir)
  return {async fetch(request){
    if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405})
    let name
    try{name=decodeURIComponent(new URL(request.url).pathname)}catch{return new Response(null,{status:400})}
    if(name.includes('\\')||name.includes('\0')||name.includes(':')||name.split('/').some(p=>p.startsWith('.'))||['/_worker.js','/_routes.json','/_headers','/_redirects'].includes(name)) return new Response(null,{status:404})
    name=name.replace(/^\/+|\/+$/g,'')
    const list=name?[name,name+'.html',path.join(name,'index.html')]:['index.html']
    for(const item of list){
      let real,stat
      try{real=await fsp.realpath(path.resolve(dir,item));stat=await fsp.stat(real)}catch(e){if(e.code==='ENOENT'||e.code==='ENOTDIR')continue;throw e}
      if(!real.startsWith(dir+path.sep)||!stat.isFile())continue
      const ext=path.extname(real).toLowerCase()
      const headers={'Content-Type':MIME[ext]||'application/octet-stream','Content-Length':String(stat.size),'Cache-Control':name.startsWith('_next/static/')?'public, max-age=31536000, immutable':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}
      if(ext==='.html')headers['Content-Security-Policy']=CSP
      return new Response(request.method==='HEAD'?null:Readable.toWeb(fs.createReadStream(real)),{headers})
    }
    return new Response('No encontrado',{status:404})
  }}
}
module.exports={privateBucket,staticAssets}
