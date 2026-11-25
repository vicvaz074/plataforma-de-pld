'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {DatabaseSync} = require('node:sqlite');

const MAX = 96 * 1024 * 1024;
function openVault(directory, origin, crypt) {
  if (!crypt?.isEncryptionAvailable() || (process.platform==='linux' && crypt.getSelectedStorageBackend?.() === 'basic_text'))
    throw Error('No está disponible la protección del llavero para esta estación.');
  const dir = path.join(directory, crypto.createHash('sha256').update(origin).digest('hex'));
  fs.mkdirSync(dir, {recursive:true, mode:0o700});
  if (!fs.lstatSync(dir).isDirectory()) throw Error('Directorio local no válido.');
  const keyfile = path.join(dir, 'key.bin'), dbfile = path.join(dir, 'station.db');
  for (const f of [keyfile, dbfile]) {
    const stat = fs.lstatSync(f, {throwIfNoEntry:false});
    if (stat && !stat.isFile()) throw Error('Archivo local no válido.');
  }
  if (!fs.existsSync(keyfile)) {
    if (fs.existsSync(dbfile)) throw Error('Falta la clave original de la estación. No se reemplazaron sus datos.');
    fs.writeFileSync(keyfile, crypt.encryptString(crypto.randomBytes(32).toString('hex')), {flag:'wx',mode:0o600});
  }
  const unwrapped = crypt.decryptString(fs.readFileSync(keyfile));
  if (!/^[a-f\d]{64}$/.test(unwrapped)) throw Error('Clave local no válida.');
  const key = Buffer.from(unwrapped,'hex'), aad = Buffer.from('davara-offline-v1:'+origin);
  const db = new DatabaseSync(dbfile);
  fs.chmodSync(dbfile,0o600);
  let version = 0, locked = false;
  const state = {v:1, leases:[], actors:[]};
  function restore(){
    const row = db.prepare('SELECT rev,box FROM station WHERE id=1').get();
    if (row) {
      const box=Buffer.from(row.box);
      if (box.length > MAX+28 || box.length < 29) throw Error('Tamaño de caché no válido.');
      const cipher=crypto.createDecipheriv('aes-256-gcm', key, box.subarray(0,12));
      cipher.setAAD(aad); cipher.setAuthTag(box.subarray(12,28));
      Object.assign(state,JSON.parse(Buffer.concat([cipher.update(box.subarray(28)),cipher.final()]).toString()));
      if (state.v!==1 || !Array.isArray(state.actors) || !Array.isArray(state.leases)) throw Error('Versión local no compatible.');
      version=row.rev;
    }else Object.assign(state,{v:1,leases:[],actors:[]});
  }
  try {
    db.exec('PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS station (id INTEGER PRIMARY KEY CHECK(id=1), rev INTEGER NOT NULL, box BLOB NOT NULL) STRICT');
    restore();
  } catch(e) { db.close(); key.fill(0); throw e; }
  return {
    state,
    digest(value) {return crypto.createHmac('sha256',key).update(aad).update(value).digest('hex');},
    save() {
      if (locked) throw Error('Almacén local bloqueado; abre nuevamente la estación.');
      try {
        const clear=Buffer.from(JSON.stringify(state));
        if (clear.length>MAX) {clear.fill(0);restore();throw Object.assign(Error('Se alcanzó la capacidad de la estación. Los cambios anteriores siguen protegidos; sincroniza o revisa tus copias.'),{status:507,code:'OFFLINE_CAPACITY'});}
        const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
        cipher.setAAD(aad);
        const encrypted=Buffer.concat([cipher.update(clear),cipher.final()]);clear.fill(0);
        const box=Buffer.concat([iv,cipher.getAuthTag(),encrypted]);
        const result=version===0 ? db.prepare('INSERT OR IGNORE INTO station (id,rev,box) VALUES(1,1,?)').run(box)
          : db.prepare('UPDATE station SET rev=rev+1,box=? WHERE id=1 AND rev=?').run(box,version);
        if(result.changes!==1) throw Error('Otra instancia modificó la estación.');
        version++;
      } catch(e) {if(e.code!=='OFFLINE_CAPACITY')locked=true;throw e;}
    },
    assertOpen(){if(locked)throw Error('Almacén local bloqueado; abre nuevamente la estación.');},
    close(){locked=true;key.fill(0);db.close();}
  };
}
module.exports={openVault};
