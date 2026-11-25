'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')
const { createHash, randomUUID } = require('node:crypto')

// Only application migrations shipped with this version are authoritative.
const metaSql = 'CREATE TABLE pld_desktop_binding (id INTEGER PRIMARY KEY CHECK(id=1), storageId TEXT NOT NULL, secretHash TEXT NOT NULL)'
const bindingFile = '.davara-pld-storage'
const digest = value => createHash('sha256').update(value).digest('hex')
const signature = db => db.prepare("SELECT type,name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all()
const migrations = dir => fs.readdirSync(dir).filter(n => /^\d+_[\w-]+\.sql$/.test(n)).sort().map(n => fs.readFileSync(path.join(dir,n),'utf8'))
function checkSchema(db, scripts) {
  if (!scripts.length) throw Error('No se encontraron las migraciones incluidas en el instalador.')
  const actual = signature(db)
  if (!actual.length) return { applied:0, bound:false, hasUsers:false }
  const existing = actual.filter(r => r.name !== 'pld_desktop_binding')
  const bound = actual.length !== existing.length
  const expected = new DatabaseSync(':memory:')
  try {
    for (let i=0; i<scripts.length; i++) {
      expected.exec(scripts[i])
      if (JSON.stringify(signature(expected)) !== JSON.stringify(existing)) continue
      if (bound) {
        expected.exec(metaSql)
        if (JSON.stringify(signature(expected)) !== JSON.stringify(actual)) break
      }
      const hasUsers = Boolean(db.prepare('SELECT 1 FROM user LIMIT 1').get())
      if (!bound && (hasUsers || db.prepare('SELECT 1 FROM pld_organizations LIMIT 1').get())) {
        throw Error('La base contiene datos de otra instalación sin su identidad de escritorio. Solicita una migración con sus archivos y claves.')
      }
      return { applied:i+1, bound, hasUsers }
    }
  } finally { expected.close() }
  throw Error('La base seleccionada no corresponde a una versión compatible de PLD. No se modificó.')
}
function ordinaryFile(file) {
  if (!path.isAbsolute(file)) throw Error('Selecciona un archivo local con ruta absoluta.')
  try {
    if (!fs.lstatSync(file).isFile()) throw Error('La ruta no es un archivo regular.')
    return true
  } catch (e) { if (e.code === 'ENOENT') return false; throw e }
}
function inspectDatabase(file, migrationsPath) {
  if (!ordinaryFile(file)) return {kind:'new',hasUsers:false}
  const db = new DatabaseSync(file,{readOnly:true,allowExtension:false})
  try {
    const {applied,hasUsers} = checkSchema(db,migrations(migrationsPath))
    return { kind:applied?'existing':'new',hasUsers }
  } finally { db.close() }
}
function openDatabase({databasePath:file, storagePath, migrationsPath, secret}) {
  if (typeof secret !== 'string' || secret.length < 32) throw Error('Falta la clave de autenticación de la instalación.')
  if (!path.isAbsolute(storagePath) || path.resolve(file)===path.resolve(storagePath)) throw Error('Selecciona un almacén privado de archivos válido.')
  const scripts = migrations(migrationsPath), existing=ordinaryFile(file)
  if (!existing) fs.closeSync(fs.openSync(file,'wx',0o600))
  const db = new DatabaseSync(file,{allowExtension:false})
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA trusted_schema=OFF')
    const {applied,bound,hasUsers} = checkSchema(db,scripts)
    const keyHash=digest(secret)
    const ref=path.join(storagePath,bindingFile)
    if (bound) {
      const row=db.prepare('SELECT storageId,secretHash FROM pld_desktop_binding WHERE id=1').get()
      if (!row || row.secretHash!==keyHash) throw Error('La clave de esta configuración no corresponde a esa base. Restaura la configuración original.')
      if (!fs.existsSync(ref) || !fs.lstatSync(ref).isFile() || fs.readFileSync(ref,'utf8')!==row.storageId) throw Error('El almacén de documentos no corresponde a la base. Selecciona o restaura juntos base, documentos y configuración.')
    } else {
      if (fs.existsSync(storagePath) && (!fs.lstatSync(storagePath).isDirectory() || fs.readdirSync(storagePath).length)) throw Error('El almacén para una instalación nueva debe estar vacío.')
    }
    if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath,{recursive:true,mode:0o700})
    if (!fs.lstatSync(storagePath).isDirectory()) throw Error('La carpeta de archivos no es válida.')
    const storeId=bound?null:randomUUID()
    db.exec('BEGIN IMMEDIATE')
    try {
      for (const script of scripts.slice(applied)) db.exec(script)
      if (!bound) {
        db.exec(metaSql);db.prepare('INSERT INTO pld_desktop_binding VALUES(1,?,?)').run(storeId,keyHash)
        fs.writeFileSync(ref,storeId,{flag:'wx',mode:0o600})
      }
      db.exec('COMMIT')
    } catch(e) {
      db.exec('ROLLBACK')
      if (storeId && fs.existsSync(ref) && fs.readFileSync(ref,'utf8')===storeId) fs.unlinkSync(ref)
      throw e
    }
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL')
    return { db,hasUsers,binding:makeBinding(db) }
  } catch(e) { db.close();throw e }
}
function makeBinding(db) {
  const bindValue = v => typeof v==='boolean'?Number(v):v instanceof Date?v.getTime():v
  class Statement {
    constructor(sql, args=[]) { this.sql=sql;this.args=args }
    bind(...args) { return new Statement(this.sql,args.map(bindValue)) }
    execute() {
      const rows=db.prepare(this.sql).all(...this.args)
      const meta=/^\s*(?:insert|delete|update|replace)\b/i.test(this.sql)
        ? db.prepare('SELECT changes() AS changes, last_insert_rowid() AS last_row_id').get()
        : {changes:0,last_row_id:null}
      return {results:rows,success:true,meta}
    }
    async all() { return this.execute() }
    async run() { return this.execute() }
    async first(column) { const row=db.prepare(this.sql).get(...this.args);return row?(column===undefined?row:row[column]??null):null }
  }
  return {
    prepare(sql){return new Statement(sql)},
    async exec(sql){db.exec(sql)},
    async batch(statements){
      db.exec('BEGIN IMMEDIATE')
      try { const results=statements.map(s=>s.execute());db.exec('COMMIT');return results }
      catch(e){db.exec('ROLLBACK');throw e}
    }
  }
}
module.exports={openDatabase,inspectDatabase,makeBinding}
