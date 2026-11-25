'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, randomUUID } = require('node:crypto');

const DEFAULT_PORT = 6731;
const fail = message => { throw new Error(message); };
function corporateOrigin(input) {
  if (typeof input !== 'string' || input.length > 350 || !input.trim()) fail('Escribe la dirección HTTPS indicada por TI.');
  let url;
  try { url = new URL(input.trim()); } catch { fail('Escribe una dirección completa, por ejemplo https://pld.empresa.mx.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash || url.pathname !== '/') fail('Usa únicamente el origen HTTPS corporativo, sin ruta, usuario ni contraseña.');
  return url.origin;
}
function serverSettings(input) {
  const value = String(input.port ?? DEFAULT_PORT);
  if (!/^[0-9]{1,5}$/.test(value) || Number(value)<1024 || Number(value)>65535) fail('El puerto debe estar entre 1024 y 65535.');
  const publicOrigin = input.publicOrigin?.trim() ? corporateOrigin(input.publicOrigin) : undefined;
  return {port:Number(value), ...(publicOrigin ? {publicOrigin} : {})};
}
function account(input) {
  const name=typeof input.name==='string' ? input.name.trim() : '';
  const email=typeof input.email==='string' ? input.email.trim().toLowerCase() : '';
  const password=input.password;
  if (!name || name.length>160) fail('Escribe el nombre de la persona administradora (hasta 160 caracteres).');
  if (email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Escribe un correo válido: será tu usuario para iniciar sesión.');
  if (typeof password!=='string' || password.length<11 || password.length>128) fail('La contraseña debe tener entre 11 y 128 caracteres.');
  if (password!==input.confirmation) fail('La confirmación no coincide con la contraseña.');
  return {name,email,password};
}
function localFile(filename) {
  if (typeof filename!=='string' || !path.isAbsolute(filename) || /^(?:\\\\|\/\/)/.test(filename)) fail('Selecciona un archivo en el disco del servidor, no una carpeta compartida de red.');
  const stat=fs.lstatSync(filename,{throwIfNoEntry:false});
  if (stat && !stat.isFile()) fail('Selecciona un archivo de base de datos normal, no una carpeta ni un enlace.');
  return filename;
}
function safeDir(dir) {
  fs.mkdirSync(dir,{mode:0o700,recursive:true});
  if (!fs.lstatSync(dir).isDirectory()) fail('La carpeta de datos no es un directorio local válido.');
}
function readJson(file) {
  const s=fs.lstatSync(file,{throwIfNoEntry:false});
  if (!s) return null;
  if (!s.isFile() || s.size>12_000) fail('El archivo de configuración no es válido.');
  try { const value=JSON.parse(fs.readFileSync(file,'utf8')); if (value===null || typeof value!=='object') throw new Error(); return value; } catch { fail('El archivo de configuración está dañado. Restáuralo desde una copia autorizada.'); }
}
function atomicConfig(file,value) {
  safeDir(path.dirname(file));
  const tmp=path.join(path.dirname(file),'.config-'+randomUUID());
  try { fs.writeFileSync(tmp,JSON.stringify(value),{mode:0o600,flag:'wx'});fs.renameSync(tmp,file); } finally { try{fs.unlinkSync(tmp);}catch(e){if(e.code!=='ENOENT')throw e;} }
}
function getSecret(db,kind,crypt) {
  const dir=db+'.pld';const file=path.join(dir,'host-key.json');
  if (!crypt.isEncryptionAvailable() || (process.platform==='linux' && crypt.getSelectedStorageBackend?.()==='basic_text')) fail('No está disponible el llavero seguro del sistema. Abre la aplicación con la cuenta que administrará el servidor.');
  const parent=fs.lstatSync(dir,{throwIfNoEntry:false});
  if(parent && !parent.isDirectory()) fail('La carpeta de archivos del servidor no es válida.');
  const meta=readJson(file);
  if (meta) {
    if (meta.version!==1 || typeof meta.encrypted!=='string') fail('La clave protegida del servidor no es válida.');
    try { const result=crypt.decryptString(Buffer.from(meta.encrypted,'base64'));if(!/^[\da-f]{96}$/.test(result))throw new Error();return result; } catch { fail('No se puede abrir la clave del servidor. Usa la misma cuenta del sistema y sus respaldos de claves.'); }
  }
  if (kind==='existing') fail('Falta la clave de esta instalación. Recupera su carpeta .pld y el llavero original. No se creará otro administrador.');
  safeDir(dir);
  const secret=randomBytes(48).toString('hex');
  try {fs.writeFileSync(file,JSON.stringify({version:1,encrypted:crypt.encryptString(secret).toString('base64')}),{flag:'wx',mode:0o600});}catch(e){if(e.code==='EEXIST')return getSecret(db,kind,crypt);throw e;}
  return secret;
}
async function probeOrigin(origin,fetchImpl=fetch) {
  let response; try {
    response=await fetchImpl(origin+'/api/v1/health',{redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(8000)});
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const h=await response.json();
      if (h.configured===true && h.distribution==='pld-onprem') return;
    }
  } catch {}
  fail('No se encontró una instalación PLD interna en esa dirección. Verifica la red corporativa, el certificado y la dirección con TI.');
}
function makeService({userData,resources,runtime,crypt,probe=probeOrigin}) {
  const file=path.join(userData,'installation.json');
  const defaultDb=path.join(userData,'Datos PLD','plataforma.sqlite');
  let active=null, activeConfig=null, busy=false;
  function config() {
    const val=readJson(file);if(!val)return null;
    if(val.version!==1) fail('Versión de configuración no compatible.');
    if(val.mode==='client') return {version:1,mode:'client',origin:corporateOrigin(val.origin)};
    if(val.mode==='server') return {version:1,mode:'server',databasePath:localFile(val.databasePath),...serverSettings(val)};
    fail('Modo de instalación no reconocido.');
  }
  function inspect(db) { return runtime.inspectDatabase(localFile(db),resources.migrationsPath); }
  async function start(c,details,admin) {
    const secret=getSecret(c.databasePath,details.kind,crypt);
    const service=await runtime.startServer({...resources,databasePath:c.databasePath,storagePath:path.join(c.databasePath+'.pld','archivos'),secret,port:c.port,publicOrigin:c.publicOrigin,bootstrapEmail:admin?.email,bootstrapToken:admin?randomBytes(48).toString('hex'):undefined});
    try {
      if (!service.hasUsers) {if(!admin)fail('La configuración del primer administrador quedó pendiente. Completa el asistente.');await service.bootstrap(admin);}
      else if(admin) fail('La base ya tiene cuentas. Vuelve a seleccionarla para iniciar sesión sin crear otro administrador.');
      return service;
    } catch(e) { await service.close();throw e; }
  }
  async function submit(input,selectedDb) {
    if(busy)fail('Hay una verificación en curso.');
    if(active)fail('El servidor ya está configurado y en ejecución.');
    busy=true;let server=null;
    try {
      let c;
      if(input.mode==='client') {const origin=corporateOrigin(input.origin);await probe(origin);c={version:1,mode:'client',origin};}
      else if(input.mode==='server') {
        const db=localFile(selectedDb||defaultDb);
        const d=inspect(db);
        const settings=serverSettings(input);
        const admin=d.hasUsers?undefined:account(input);
        if(d.hasUsers && (input.password || input.email)) fail('Esta instalación ya tiene cuentas; inicia sesión con una de ellas.');
        if(!fs.existsSync(path.dirname(db)))safeDir(path.dirname(db));
        c={version:1,mode:'server',databasePath:db,...settings};
        server=await start(c,d,admin);
      } else fail('Selecciona un tipo de instalación.');
      atomicConfig(file,c);active=server;activeConfig=c;
      return {origin:server?.origin||c.origin};
    } catch(e) {if(server)await server.close();throw e;} finally{busy=false;}
  }
  async function resume() {
    const c=config();if(!c)return null;
    // First-time binding was verified over real TLS. A known station must
    // be able to load the local shell with no network, without creating any
    // session; only an unexpired session authorized online can open data.
    if(c.mode==='client'){activeConfig=c;return {origin:c.origin};}
    if(!fs.existsSync(c.databasePath))fail('No se encuentra la base configurada. Vuelve a conectar el disco del servidor. No se creó una base nueva.');
    const d=inspect(c.databasePath);if(!d.hasUsers)fail('La base no contiene la cuenta administradora esperada. Revisa la ubicación o continúa el asistente.');
    active=await start(c,d);activeConfig=c;return {origin:active.origin};
  }
  async function stop() {const s=active;active=null;activeConfig=null;if(s)await s.close();}
  return {defaultDb,config,inspect,submit,resume,stop,get current(){return activeConfig;},get activeServer(){return Boolean(active);}};
}
module.exports={DEFAULT_PORT,corporateOrigin,serverSettings,account,localFile,getSecret,probeOrigin,makeService};
