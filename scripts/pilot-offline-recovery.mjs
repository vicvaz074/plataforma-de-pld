// Offline operator tool, never mounted on the Worker. Only restores to a new local store.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { constants } from "node:fs"
import { link, mkdir, open, readFile, unlink, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Miniflare } from "miniflare"

const MAGIC = Buffer.from("PLDOFF01")
const MIB = 1024 * 1024, MAX_MANIFEST = 20 * MIB, MAX_FILES = 100 * MIB
const sha = bytes => createHash("sha256").update(bytes).digest("hex")
const checked = (condition, message) => { if (!condition) throw new Error(message) }
const safeId = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,180}$/.test(value)
const validSha = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
const receipt = (company, backup, digest) => Buffer.from(JSON.stringify(["PLDOFF01", company, backup, digest]))
const TABLES = [
  ["records", "pld_records", "companyId collection id revision payload deleted createdAt updatedAt updatedBy"],
  ["history", "pld_record_versions", "companyId collection id revision payload deleted createdAt actorId"],
  ["documents", "pld_documents", "id companyId moduleKey title relatedType relatedId revision createdAt updatedAt"],
  ["files", "pld_file_versions", "id documentId companyId version objectKey sha256 fileName mimeType size status createdAt uploadedBy reviewedBy reviewedAt reason"],
]

async function boundedFile(path, maximum, privateKey = false) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const stat = await handle.stat()
    checked(stat.isFile() && stat.size <= maximum, "Tipo o tamaño de archivo no admitido.")
    if (privateKey) checked((stat.mode & 0o077) === 0 && stat.size === 32, "La clave debe ser privada (0600) y de 32 bytes.")
    // Cap even if a staging file changes between stat and read.
    const bytes = Buffer.alloc(stat.size)
    let offset = 0
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, null)
      checked(bytesRead > 0, "Archivo truncado.")
      offset += bytesRead
    }
    checked(!(await handle.read(Buffer.alloc(1), 0, 1, null)).bytesRead, "El archivo cambió durante la lectura.")
    return bytes
  } finally { await handle.close() }
}

function parseManifest(bytes, company, backup, expectedHash) {
  checked(safeId(company) && safeId(backup) && validSha(expectedHash), "Identidad o SHA-256 esperado inválido.")
  checked(sha(bytes) === expectedHash, "SHA-256 del manifiesto no coincide con el comprobante independiente.")
  let manifest
  try { manifest = JSON.parse(bytes) } catch { throw new Error("Manifiesto JSON inválido.") }
  checked(manifest.version === 1 && manifest.companyId === company && typeof manifest.createdAt === "string", "Empresa o versión de manifiesto incorrecta.")
  for (const [group, , columns] of TABLES) {
    checked(Array.isArray(manifest[group]) && manifest[group].every(row => row && row.companyId === company &&
      columns.split(" ").every(column => Object.hasOwn(row, column))), "Fila ajena o incompleta en " + group + ".")
  }
  const documents = new Set(manifest.documents.map(doc => doc.id))
  const versions = new Set()
  let size = 0
  checked(manifest.files.length <= 50, "Demasiadas versiones.")
  for (const file of manifest.files) {
    checked(safeId(file.id) && !versions.has(file.id) && documents.has(file.documentId) &&
      file.backupObjectKey === ["backups", company, backup, "files", file.id].join("/") &&
      validSha(file.sha256) && Number.isSafeInteger(file.size) && file.size >= 0, "Referencia de archivo inválida.")
    versions.add(file.id)
    size += file.size
  }
  checked(size <= MAX_FILES, "Volumen no admitido.")
  return manifest
}

// PLDOFF01 || nonce(12) || AES-256-GCM(uint32BE(manifest size) || manifest || ordered file bytes) || tag(16).
// The Worker manifest commits to the bytes, order, sizes and scope. No paths from the archive are extracted.
async function pack(company, backup, expectedHash, manifestPath, filesDir, keyPath, output) {
  const bytes = await boundedFile(manifestPath, MAX_MANIFEST)
  const manifest = parseManifest(bytes, company, backup, expectedHash)
  // An invalid input must never receive an apparently complete archive.
  const nonce = randomBytes(12)
  const encryption = createCipheriv("aes-256-gcm", await boundedFile(keyPath, 32, true), nonce)
  encryption.setAAD(receipt(company, backup, expectedHash))
  const prefix = Buffer.alloc(4)
  prefix.writeUInt32BE(bytes.length)
  const encrypted = [MAGIC, nonce, encryption.update(prefix), encryption.update(bytes)]
  for (const file of manifest.files) {
    const content = await boundedFile(join(filesDir, file.id), file.size)
    checked(content.length === file.size && sha(content) === file.sha256, "Tamaño o SHA-256 incorrecto en copia documental.")
    encrypted.push(encryption.update(content))
  }
  encrypted.push(encryption.final(), encryption.getAuthTag())
  const archive = Buffer.concat(encrypted)
  const temporary = join(dirname(output), ".pldoff-partial-" + randomBytes(16).toString("hex"))
  const handle = await open(temporary, "wx", 0o600)
  try {
    try { await handle.writeFile(archive); await handle.sync() } finally { await handle.close() }
    await link(temporary, output) // atomic publication, fails if output already exists
    const directory = await open(dirname(output), "r")
    try { await directory.sync() } finally { await directory.close() }
  } finally { await unlink(temporary) }
  return { scope: "offline-company-copy", sha256: sha(archive), manifestSha256: expectedHash, versions: manifest.files.length }
}

export function localStore(directory) {
  return new Miniflare({
    modules: true, script: "export default { fetch() { return new Response(null, {status:404}) } }",
    host: "127.0.0.1", port: 0, compatibilityDate: "2026-07-01",
    d1Databases: ["DB"], r2Buckets: ["EVIDENCE_BUCKET"],
    d1Persist: join(directory, "d1"), r2Persist: join(directory, "r2"),
  })
}

export async function migrate(db) {
  // Manifest v1 is pinned to the reviewed pilot schema, not arbitrary future SQL.
  for (const name of ["0001_pilot.sql", "0002_private_backups.sql"]) {
    const source = await readFile(new URL("../migrations/" + name, import.meta.url), "utf8")
    for (const statement of source.split(";").map(part => part.trim()).filter(Boolean)) await db.prepare(statement).run()
  }
}

const newKey = (company, file) => ["offline-recovery", company, file.id].join("/")

async function restore(company, backup, expectedHash, archivePath, keyPath, destination) {
  const archive = await boundedFile(archivePath, MAX_MANIFEST + MAX_FILES + 40)
  checked(archive.length >= 40 && archive.subarray(0, 8).equals(MAGIC), "Formato de copia no admitido.")
  const decryption = createDecipheriv("aes-256-gcm", await boundedFile(keyPath, 32, true), archive.subarray(8, 20))
  decryption.setAAD(receipt(company, backup, expectedHash))
  decryption.setAuthTag(archive.subarray(-16))
  const plain = Buffer.concat([decryption.update(archive.subarray(20, -16)), decryption.final()])
  const length = plain.readUInt32BE()
  checked(length <= MAX_MANIFEST && length <= plain.length - 4, "Manifiesto truncado.")
  const manifest = parseManifest(plain.subarray(4, 4 + length), company, backup, expectedHash)
  let offset = 4 + length
  const blobs = manifest.files.map(file => {
    const bytes = plain.subarray(offset, offset + file.size)
    checked(bytes.length === file.size && sha(bytes) === file.sha256, "Contenido documental incompleto.")
    offset += file.size
    return bytes
  })
  checked(offset === plain.length, "Contenido adicional en la copia.")
  // Exclusive creation; never connects to a pre-existing store or remote account.
  await mkdir(destination, { mode: 0o700 })
  const sandbox = localStore(destination)
  const summary = { scope: "offline-company-quarantine", company, backup, manifestSha256: expectedHash,
    archiveSha256: sha(archive), records: manifest.records.length, history: manifest.history.length,
    documents: manifest.documents.length, versions: blobs.length, bytes: blobs.reduce((sum, blob) => sum + blob.length, 0) }
  try {
    const db = await sandbox.getD1Database("DB"), bucket = await sandbox.getR2Bucket("EVIDENCE_BUCKET")
    await migrate(db)
    const at = manifest.createdAt, org = "offline-quarantine"
    await db.prepare("INSERT INTO pld_organizations(id,name,createdAt,updatedAt) VALUES(?,?,?,?)").bind(org, "Cuarentena local", at, at).run()
    await db.prepare("INSERT INTO pld_companies(id,organizationId,name,status,createdAt,updatedAt) VALUES(?,?,?,'archived',?,?)")
      .bind(company, org, "Recuperación sin accesos", at, at).run()
    // Preserve attribution IDs for foreign keys without importing any account, permission, session or credential.
    const actors = new Set([...manifest.records.map(row => row.updatedBy), ...manifest.history.map(row => row.actorId),
      ...manifest.files.flatMap(row => row.reviewedBy == null ? [row.uploadedBy] : [row.uploadedBy, row.reviewedBy])])
    let index = 0
    for (const id of actors) {
      await db.prepare("INSERT INTO user(id,name,email,createdAt,updatedAt,status,platformRole) VALUES(?,?,?,0,0,'suspended','user')")
        .bind(id, "Atribución histórica", "actor-" + (++index) + "@recovery.invalid").run()
    }
    for (const [group, table, columnList] of TABLES) {
      const columns = columnList.split(" ")
      const statement = db.prepare("INSERT INTO " + table + "(" + columns.join(",") + ") VALUES(" + columns.map(() => "?").join(",") + ")")
      const rows = manifest[group]
      for (let start = 0; start < rows.length; start += 50) {
        await db.batch(rows.slice(start, start + 50).map(row => statement.bind(...columns.map(col => col === "objectKey" ? newKey(company, row) : row[col]))))
      }
      checked(await db.prepare("SELECT count(*) AS n FROM " + table).first("n") === rows.length, "Recuento de destino incorrecto.")
    }
    for (const [i, file] of manifest.files.entries()) {
      const key = newKey(company, file)
      await bucket.put(key, blobs[i], { httpMetadata: { contentType: file.mimeType } })
      const recovered = await bucket.get(key)
      checked(recovered && sha(Buffer.from(await recovered.arrayBuffer())) === file.sha256, "La relectura en destino no coincide.")
    }
    checked(!(await db.prepare("PRAGMA foreign_key_check").all()).results.length, "Referencias incompletas en destino.")
  } finally { await sandbox.dispose() }
  // Only written once all tables, object reads and shutdown have completed.
  await writeFile(join(destination, "COMPLETE.json"), JSON.stringify(summary) + "\n", { mode: 0o600, flag: "wx" })
  return summary
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077)
  const [command, ...args] = process.argv.slice(2)
  try {
    checked((command === "pack" && args.length === 7) || (command === "restore" && args.length === 6),
      "Uso: pack EMPRESA BACKUP SHA_MANIFIESTO MANIFIESTO DIR_VERSIONES CLAVE SALIDA | restore EMPRESA BACKUP SHA_MANIFIESTO ARCHIVO CLAVE DESTINO_NUEVO")
    console.log(JSON.stringify(await (command === "pack" ? pack : restore)(...args)))
  } catch (error) {
    console.error("Recuperación offline no completada:", error.message)
    process.exitCode = 1
  }
}
