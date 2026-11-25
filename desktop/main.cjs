'use strict';
const {app,BrowserWindow,ipcMain,dialog,session,Menu,safeStorage,net,shell}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {createHash}=require('node:crypto');
const {DEFAULT_PORT,makeService,localFile,probeOrigin}=require('./shared/setup.cjs');
const homeUrl=pathToFileURL(path.join(__dirname,'setup','index.html')).href;
const {classify}=require('./shared/links.cjs');
let knownLinks;
function openLink(parent,origin,s,target){
  if(!knownLinks)knownLinks=new Set(require(path.join(resourceBase,'public-links.json')));
  const kind=classify(target,origin,knownLinks);
  if(kind==='external'){
    void dialog.showMessageBox(parent,{type:'question',title:'Salir de la plataforma',message:'¿Abrir esta referencia fuera de PLD?',detail:target,buttons:['Cancelar','Abrir'],defaultId:0,cancelId:0}).then(({response})=>{if(response===1)return shell.openExternal(target);}).catch(()=>{});
  }else if(kind==='document'){
    const viewer=new BrowserWindow({parent,width:980,height:760,title:'Documento · Davara PLD',webPreferences:{session:s,contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true,javascript:false,devTools:false,webviewTag:false}});
    viewer.removeMenu();secureWindow(viewer,url=>url===target);
    void viewer.loadURL(target).catch(()=>{if(!viewer.isDestroyed())viewer.close();});
  }
  return !!kind;
}
let wizard=null,work=null,service,chosen=null,notice='',lastSettings=null,allowQuit=false,closing=false,resourceBase,stationShell=null;
const replyError=e=>{
  if(e?.code==='EADDRINUSE')return 'Ese puerto está ocupado. Prueba otro puerto o cierra la otra instancia.';
  if(e?.code==='EACCES'||e?.code==='EPERM'||e?.code==='EROFS')return 'No hay permiso para escribir en esa ubicación. Selecciona una carpeta del servidor a la que tengas acceso.';
  return typeof e?.message==='string' && e.message.length<350 ? e.message : 'No se pudo completar la configuración. Verifica la ubicación y vuelve a intentar.';
};
function secureWindow(win,allowed) {
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(e,url)=>{if(!allowed(url))e.preventDefault();});
  win.webContents.on('will-redirect',(e,url)=>{if(!allowed(url))e.preventDefault();});
  win.webContents.on('will-attach-webview',event=>event.preventDefault());
}
function restrictPermissions(s) {
  s.setPermissionRequestHandler((_c,_p,done)=>done(false));
  s.setPermissionCheckHandler(()=>false);
  s.setDevicePermissionHandler(()=>false);
}
function trustedWizard(e) {
  if(!wizard || wizard.isDestroyed() || e.sender!==wizard.webContents || !e.senderFrame || e.senderFrame!==wizard.webContents.mainFrame || e.senderFrame.url!==homeUrl)throw new Error('Ventana de configuración no autorizada.');
}
function bind(name,fn) {
  ipcMain.handle('pld:'+name,async(e,...args)=>{
    trustedWizard(e);
    try{return {ok:true,value:await fn(...args)};}catch(error){return {ok:false,message:replyError(error)};}
  });
}
function setupWindow() {
  if(wizard && !wizard.isDestroyed()){wizard.focus();return;}
  const s=session.fromPartition('wizard');restrictPermissions(s);
  const dirUrl=pathToFileURL(path.join(__dirname,'setup')+path.sep).href;
  s.webRequest.onBeforeRequest((details,done)=>done({cancel:!details.url.startsWith(dirUrl)}));
  wizard=new BrowserWindow({width:960,height:780,minWidth:620,minHeight:540,title:'Configurar Plataforma PLD',backgroundColor:'#faf8f4',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),session:s,contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true,devTools:false}});
  secureWindow(wizard,url=>url===homeUrl);
  wizard.on('closed',()=>{wizard=null;});wizard.once('ready-to-show',()=>wizard?.show());
  void wizard.loadURL(homeUrl).catch(()=>{});
}
function allowedUrl(url,origin) {
  try{
    const u=new URL(url);return u.origin===origin && (u.protocol==='http:'||u.protocol==='https:'||u.protocol==='blob:');
  }catch{return false;}
}
function openPlatform(origin) {
  if(work&&!work.isDestroyed()){work.show();work.focus();return;}
  const id=createHash('sha256').update(origin).digest('hex').slice(0,32);
  const s=session.fromPartition('persist:pld-'+id,{cache:false});restrictPermissions(s);
  const station=service.current?.mode==='client';
  if(station&&!stationShell){
    stationShell=require('./shared/station-shell.cjs').createStationTransport({session:s,origin,assetsPath:path.join(resourceBase,'out'),directory:path.join(app.getPath('userData'),'Borradores PLD'),crypt:safeStorage,contracts:require(path.join(resourceBase,'contracts.cjs')),offline:require('./offline/station.cjs')});
  }
  s.webRequest.onBeforeRequest((d,done)=>{
    // Generated report blobs are same-origin; data images are local, not network traffic.
    const allow=allowedUrl(d.url,origin)||(d.url.startsWith('data:') && ['image','font'].includes(d.resourceType));
    done({cancel:!allow});
  });
  s.on('will-download',(_e,item)=>{if(!allowedUrl(item.getURL(),origin) && !item.getURL().startsWith('blob:'+origin+'/'))item.cancel();});
  const w=new BrowserWindow({width:1360,height:890,minWidth:740,minHeight:520,title:'Plataforma PLD · Davara',backgroundColor:'#fff',webPreferences:{session:s,contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true,devTools:false,webviewTag:false}});
  if(station)w.webContents.setUserAgent(w.webContents.getUserAgent()+' DavaraPLDStation/1');
  work=w;secureWindow(w,url=>{try{return new URL(url).origin===origin && /^(https?):/.test(url);}catch{return false;}});
  w.webContents.setWindowOpenHandler(({url})=>{openLink(w,origin,s,url);return {action:'deny'};});
  w.webContents.on('will-navigate',(event,url)=>{if(!allowedUrl(url,origin)&&openLink(w,origin,s,url))event.preventDefault();});
  w.on('closed',()=>{if(work===w)work=null;});
  if(wizard && !wizard.isDestroyed())wizard.close();
  void w.loadURL(origin+(station?'/':'/login')).catch(()=>{if(w.isDestroyed())return;
    dialog.showMessageBox(w,{type:'warning',title:'No se pudo abrir la plataforma',message:'No se pudo cargar la dirección de la instalación.',detail:'Verifica la red, el certificado y la puerta HTTPS de Alsea. Desde el menú Plataforma puedes reintentar o abrir la configuración de conexión.'});
  });
}
function presentPlatform(origin) {
  try{openPlatform(origin);}
  catch(e){notice=replyError(e);setupWindow();dialog.showErrorBox('No se pudo abrir la plataforma',notice);}
}
async function changeConnection() {
  if(closing)return;
  const prior=service.current;
  if(prior?.mode==='server') {
    const {response}=await dialog.showMessageBox({type:'warning',title:'Configuración del servidor',message:'¿Detener temporalmente el servidor para cambiar la configuración?',detail:'Los usuarios conectados perderán acceso hasta que se complete la configuración o se reinicie la aplicación. No se borrarán los datos.',buttons:['Conservar en ejecución','Detener y configurar'],defaultId:0,cancelId:0});
    if(response!==1)return;
  }
  if(prior?.mode==='client'){
    const {response}=await dialog.showMessageBox({type:'question',title:'Cambiar de instalación',message:'¿Quieres revisar la conexión de esta estación?',detail:'Los borradores pendientes permanecen cifrados en el perfil de este equipo y están vinculados a la instalación e identidad originales. No se enviarán al cambiar de servidor.',buttons:['Conservar conexión','Configurar'],defaultId:0,cancelId:0});
    if(response!==1)return;
  }
  if(stationShell){const st=stationShell;stationShell=null;await st.close();}
  await service.stop();
  try{lastSettings=service.config();chosen=lastSettings?.mode==='server'?lastSettings.databasePath:null;}catch{lastSettings=null;chosen=null;}
  notice='La configuración anterior se conserva hasta que guardes la nueva.';setupWindow();
  if(work&&!work.isDestroyed())work.close();
}
function installMenu(){
  const menu=[];
  if(process.platform==='darwin')menu.push({label:app.name,submenu:[{role:'about'},{type:'separator'},{role:'hide'},{role:'quit'}]});
  menu.push({label:'Plataforma',submenu:[{label:'Abrir plataforma',click(){if(service.current)presentPlatform(service.current.mode==='client'?service.current.origin:service.current.publicOrigin||'http://127.0.0.1:'+service.current.port);else setupWindow();}},{label:'Configurar conexión…',click:()=>void changeConnection().catch(e=>dialog.showErrorBox('Configuración',replyError(e)))},{type:'separator'},{role:'quit',label:'Salir'}]},{role:'editMenu'},{role:'windowMenu'});
  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
}
async function launch() {
  resourceBase=app.isPackaged?path.join(process.resourcesPath,'pld'):path.join(__dirname,'build','pld');
  service=makeService({userData:app.getPath('userData'),resources:{assetsPath:path.join(resourceBase,'out'),migrationsPath:path.join(resourceBase,'migrations'),workerPath:path.join(resourceBase,'worker.cjs')},runtime:require('./runtime/index.cjs'),crypt:safeStorage,probe:origin=>probeOrigin(origin,(...args)=>net.fetch(...args))});
  bind('state',()=>{
    let c=lastSettings;try{c=c||service.config();}catch(e){notice=replyError(e);}
    const db=chosen||service.defaultDb;
    let details;try{details=service.inspect(db);}catch(e){details={kind:'invalid',hasUsers:false};if(!notice)notice=replyError(e);}
    return {notice,mode:c?.mode||null,origin:c?.origin||'',publicOrigin:c?.publicOrigin||'',port:c?.port||DEFAULT_PORT,databasePath:db,details};
  });
  bind('choose',async(mode)=>{
    let filename;
    if(mode==='new') {
      const r=await dialog.showSaveDialog(wizard,{title:'Ubicación de la nueva base SQLite',defaultPath:service.defaultDb,filters:[{name:'Base de datos SQLite',extensions:['sqlite','db','sqlite3']}]});if(r.canceled)return null;filename=r.filePath;
      if(require('node:fs').existsSync(filename))throw new Error('Ese archivo ya existe. Usa «Enlazar existente» o selecciona un nombre nuevo. No se ha sobrescrito nada.');
    } else if(mode==='existing'){
      const r=await dialog.showOpenDialog(wizard,{title:'Enlazar base PLD existente o SQLite vacía',properties:['openFile'],filters:[{name:'Base de datos SQLite',extensions:['sqlite','db','sqlite3']},{name:'Todos los archivos',extensions:['*']}]});if(r.canceled)return null;filename=r.filePaths[0];
    } else throw new Error('Selecciona una opción válida.');
    const details=service.inspect(localFile(filename));chosen=filename;
    return {databasePath:filename,details};
  });
  bind('test',async(origin)=>{const {corporateOrigin}=require('./shared/setup.cjs');const v=corporateOrigin(origin);await probeOrigin(v,(...a)=>net.fetch(...a));return v;});
  bind('finish',async(input)=>{const {origin}=await service.submit(input,chosen);lastSettings=null;notice='';
    // Switch only after the IPC reply has been delivered and secret fields cleared.
    return {origin};
  });
  bind('open',()=>{const c=service.current;if(!c)throw new Error('Completa primero la instalación.');const origin=c.mode==='server'?(c.publicOrigin||'http://127.0.0.1:'+c.port):c.origin;setImmediate(()=>presentPlatform(origin));return true;});
  installMenu();
  try { const ready=await service.resume();if(ready){openPlatform(ready.origin);return;} }
  catch(e){notice=replyError(e);try{lastSettings=service.config();chosen=lastSettings?.databasePath||null;}catch{lastSettings=null;} }
  setupWindow();
}
if(!app.requestSingleInstanceLock())app.quit();
else {
  app.on('second-instance',()=>{const w=work||wizard;if(w){if(w.isMinimized())w.restore();w.show();w.focus();}else app.emit('activate');});
  app.on('activate',()=>{if(!service)return;const c=service.current;if(c)presentPlatform(c.mode==='client'?c.origin:c.publicOrigin||'http://127.0.0.1:'+c.port);else setupWindow();});
  app.on('web-contents-created',(_e,c)=>c.on('will-attach-webview',e=>e.preventDefault()));
  app.on('window-all-closed',()=>{if(process.platform!=='darwin'&&!service?.activeServer&&!closing) app.quit();});
  app.on('before-quit',e=>{if(allowQuit||!service?.activeServer)return;e.preventDefault();if(closing)return;closing=true;
    void (async()=>{const result=await dialog.showMessageBox({type:'warning',title:'Salir del servidor PLD',message:'Salir detendrá el servidor PLD y desconectará a los usuarios.',buttons:['Mantener activo','Detener y salir'],defaultId:0,cancelId:0});if(result.response===1){await service.stop();allowQuit=true;app.quit();}else{closing=false;app.emit('activate');}})().catch(()=>{closing=false;});
  });
  app.whenReady().then(launch).catch(e=>{dialog.showErrorBox('No se pudo iniciar Plataforma PLD',replyError(e));allowQuit=true;app.quit();});
}
