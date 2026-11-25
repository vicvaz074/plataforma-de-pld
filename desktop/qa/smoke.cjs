'use strict'
// End-to-end acceptance of the installed application. Only disposable data;
// uses a temporary OS profile, a free loopback port and a random password.
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const net = require('node:net')
const {randomBytes} = require('node:crypto')
const { _electron: electron } = require('playwright-core')

async function vacantPort() {
  const s = net.createServer()
  await new Promise((resolve,reject) => s.once('error',reject).listen(0,'127.0.0.1',resolve))
  const port = s.address().port
  await new Promise(resolve => s.close(resolve))
  return port
}
async function pick(app, predicate) {
  const deadline=Date.now()+30000
  while(Date.now()<deadline) {
    for(const w of app.windows()) if(!w.isClosed() && predicate(w.url())) return w
    await new Promise(r=>setTimeout(r,125))
  }
  throw new Error('No apareció la ventana esperada. Ventanas: '+app.windows().map(x=>x.url()).join(', '))
}
async function waitForAdmin(page, expected) {
  const handle=await page.waitForFunction(async id=>{
    try {
      const r=await fetch('/api/v1/session',{cache:'no-store'})
      if(!r.ok)return false
      const {user}=await r.json()
      return user?.platformRole==='superadmin'&&typeof user.id==='string'&&(!id||user.id===id)?user.id:false
    }catch{return false}
  },expected||null,{timeout:30000,polling:500})
  return handle.jsonValue()
}
async function main() {
  const executablePath=path.resolve(process.argv[2]||'')
  if(!process.argv[2]) throw new Error('Indique la ruta al ejecutable de Electron empaquetado.')
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'davara-pld-qa-'))
  const profile=path.join(dir,'perfil')
  const port=await vacantPort()
  const email='admin@example.test',password=randomBytes(24).toString('hex')
  const opt={executablePath,args:[...(process.argv[3]?[path.resolve(process.argv[3])]:[]),'--user-data-dir='+profile],timeout:50000}
  // QA helpers use the Electron main process only to exit the synthetic
  // installation. The renderer uses the normal login UI and HTTP session.
  let app
  async function close() {
    if(!app) return
    const active=app;app=null
    const done=active.waitForEvent('close',{timeout:10000}).catch(()=>{})
    await active.evaluate(({app})=>app.exit(0)).catch(()=>{})
    await done
  }
  try {
    app=await electron.launch(opt)
    const wizard=await app.firstWindow()
    await wizard.locator('#server-mode').click()
    await wizard.locator('#next').click()
    if(!(await wizard.locator('#port').isVisible())) await wizard.locator('#advanced').click()
    await wizard.locator('#port').fill(String(port))
    await wizard.locator('#next').click()
    await wizard.locator('#name').fill('Administrador de prueba')
    await wizard.locator('#email').fill(email)
    await wizard.locator('#password').fill(password)
    await wizard.locator('#confirmation').fill('confirmacion-incorrecta')
    const finish=wizard.locator('#finish')
    if(await finish.isEnabled()) await finish.click()
    assert.ok(await wizard.locator('#confirmation').isVisible(),'Una confirmación distinta no puede terminar el alta.')
    await wizard.locator('#confirmation').fill(password)
    await finish.click()
    await wizard.locator('#open').click({timeout:30000})
    const pl=await pick(app,u=>u.startsWith('http://127.0.0.1:'))
    const uiErrors=[]
    pl.on('pageerror',e=>uiErrors.push(e.message))
    await pl.locator('#email').fill(email)
    await pl.locator('#password').fill(password)
    await pl.locator('button[type=submit]').click()
    const first=await waitForAdmin(pl)
    await pl.reload()
    await waitForAdmin(pl,first)
    assert.deepEqual(uiErrors,[])
    await close()
    app=await electron.launch(opt)
    const restarted=await pick(app,u=>u.startsWith('http://127.0.0.1:'))
    const before=await restarted.evaluate(async()=>{try{const r=await fetch('/api/v1/session');return r.ok?(await r.json()).user?.id:null}catch{return null}})
    if(!before) {
      await restarted.locator('#email').fill(email)
      await restarted.locator('#password').fill(password)
      await restarted.locator('button[type=submit]').click()
    }
    await waitForAdmin(restarted,first)
    console.log('OK: asistente, rechazo de confirmación, administrador principal, sesión real, recarga y reinicio con la misma cuenta.')
  } finally { await close() }
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
