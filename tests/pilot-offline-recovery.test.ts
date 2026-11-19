import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash, randomBytes } from "node:crypto"
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { Miniflare } from "miniflare"
import { requireCompany } from "../workers/access"
import { handleBackups } from "../workers/backups"
import type { PilotActor, PilotEnv } from "../workers/types"

const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")
const cli = (...args: string[]) => spawnSync(process.execPath, ["scripts/pilot-offline-recovery.mjs", ...args],
  { encoding: "utf8", timeout: 45_000, env: { NODE_ENV: "test", PATH: process.env.PATH, TMPDIR: tmpdir(), NO_COLOR: "1" } })

test("respaldo offline: recupera una empresa en D1/R2 nuevos después de apagar el origen", { timeout: 150_000 }, async t => {
  const { localStore, migrate } = await import("../scripts/pilot-offline-recovery.mjs")
  const root = await mkdtemp(join(tmpdir(), "pld-offline-drill-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const staging = join(root, "staging"), custody = join(root, "custody"), keys = join(root, "keys")
  for (const dir of [staging, custody, keys]) await mkdir(dir, { mode: 0o700 })
  const fileDir = join(staging, "versions"), manifestPath = join(staging, "manifest.json")
  const keyPath = join(keys, "fixture.key"), archivePath = join(custody, "company.pldoff"), destination = join(root, "clean-target")
  await mkdir(fileDir, { mode: 0o700 })
  await writeFile(keyPath, randomBytes(32), { mode: 0o600 })
  const company = "fixture-company-A", other = "fixture-company-B", id = "expediente-compartido"
  const at = "2026-01-01T09:00:00.000Z", binary = Buffer.from([0, 255, 80, 76, 68, 45, 65, 13, 10, 0, 126])
  const actor: PilotActor = { id: "fixture-owner", name: "Ensayo", email: "ensayo@example.invalid", platformRole: "superadmin",
    status: "active", requiresPasswordChange: false, twoFactorEnabled: false }
  const noGrant: PilotActor = { ...actor, id: "fixture-stranger", platformRole: "user" }
  const source = new Miniflare({ modules: true, script: "export default { fetch() { return new Response(null, {status:404}) } }",
    host: "127.0.0.1", port: 0, compatibilityDate: "2026-07-01", d1Databases: ["DB"], r2Buckets: ["EVIDENCE_BUCKET"],
    d1Persist: false, r2Persist: false })
  let backup = "", manifestSha = "", archiveSha = ""
  const collection = "kyc_expedientes_detalle"
  const finalPayload = JSON.stringify({ id, nombre: "Cliente ficticio A actualizado", companyId: company })
  try {
    const db = await source.getD1Database("DB"), bucket = await source.getR2Bucket("EVIDENCE_BUCKET")
    const env = { DB: db, EVIDENCE_BUCKET: bucket } as unknown as PilotEnv
    await migrate(db)
    await db.prepare("INSERT INTO user(id,name,email,createdAt,updatedAt,platformRole) VALUES(?,?,?,0,0,'superadmin')")
      .bind(actor.id, actor.name, actor.email).run()
    await db.prepare("INSERT INTO pld_organizations(id,name,createdAt,updatedAt) VALUES('fixture-org','Ficticia',?,?)").bind(at, at).run()
    for (const co of [company, other]) {
      await db.prepare("INSERT INTO pld_companies(id,organizationId,name,createdAt,updatedAt) VALUES(?,'fixture-org',?,?,?)").bind(co, co, at, at).run()
      const theirs = co === other, first = JSON.stringify({ id, nombre: theirs ? "Marcador B privado ficticio" : "Cliente ficticio A", companyId: co })
      await db.prepare("INSERT INTO pld_records VALUES(?,?,?,?,?,0,?,?,?)")
        .bind(co, collection, id, theirs ? 1 : 2, theirs ? first : finalPayload, at, at, actor.id).run()
      await db.prepare("INSERT INTO pld_record_versions VALUES(?,?,?,?,?,0,?,?)").bind(co, collection, id, 1, first, at, actor.id).run()
      if (!theirs) await db.prepare("INSERT INTO pld_record_versions VALUES(?,?,?,?,?,0,?,?)").bind(co, collection, id, 2, finalPayload, at, actor.id).run()
      const doc = "doc-" + co, version = "v-" + co, key = "fixture-org/" + co + "/" + doc + "/" + version
      const blob = theirs ? Buffer.from("Solo binario de empresa B ficticia") : binary
      await db.prepare("INSERT INTO pld_documents VALUES(?,?,'expedientes','Evidencia ficticia','expediente',?,1,?,?)")
        .bind(doc, co, id, at, at).run()
      await db.prepare("INSERT INTO pld_file_versions(id,documentId,companyId,version,objectKey,sha256,fileName,mimeType,size,status,createdAt,uploadedBy) VALUES(?,?,?,1,?,?,'ficticio.bin','application/octet-stream',?,'pending',?,?)")
        .bind(version, doc, co, key, digest(blob), blob.length, at, actor.id).run()
      await bucket.put(key, blob)
    }
    const url = new URL("http://localhost/api/v1/companies/" + company + "/backups")
    await assert.rejects(() => handleBackups(new Request(url, { method: "POST" }), url, noGrant, env), { status: 403 })
    const created = await handleBackups(new Request(url, { method: "POST" }), url, actor, env)
    assert.equal(created?.status, 201)
    const receipt = await created!.json()
    assert.equal(receipt.recordCount, 1); assert.equal(receipt.fileCount, 1)
    backup = receipt.id; manifestSha = receipt.sha256
    const download = new URL(url + "/" + backup)
    const response = await handleBackups(new Request(download), download, actor, env)
    assert.equal(response?.status, 200)
    const bytes = Buffer.from(await response!.arrayBuffer())
    assert.ok(!bytes.includes(Buffer.from(other))); assert.ok(!bytes.includes(Buffer.from("Marcador B")))
    await writeFile(manifestPath, bytes, { mode: 0o600 })
    const file = JSON.parse(bytes.toString()).files[0]
    const snapshotObject = await bucket.get(file.backupObjectKey)
    assert.ok(snapshotObject); assert.notEqual(file.backupObjectKey, file.objectKey)
    const packArgs = ["pack", company, backup, manifestSha, manifestPath, fileDir, keyPath, archivePath]
    assert.notEqual(cli(...packArgs).status, 0, "Sin binario no se anuncia copia")
    await writeFile(join(fileDir, file.id), Buffer.alloc(file.size), { mode: 0o600 })
    assert.notEqual(cli(...packArgs).status, 0, "Binario incorrecto no se empaqueta")
    await assert.rejects(access(archivePath), { code: "ENOENT" })
    await writeFile(join(fileDir, file.id), Buffer.from(await snapshotObject.arrayBuffer()))
    const packaged = cli(...packArgs)
    assert.equal(packaged.status, 0, packaged.stderr)
    archiveSha = JSON.parse(packaged.stdout).sha256
    assert.equal(digest(await readFile(archivePath)), archiveSha)
  } finally {
    await source.dispose() // no D1 or R2 persistence: both source bindings cease to exist
  }
  await rm(staging, { recursive: true }) // remove the drill's plaintext manifest and staged version
  await assert.rejects(access(manifestPath), { code: "ENOENT" })

  // A different OS process receives only the vault file, receipt, key and an unused path.
  const attempt = (co: string, file: string, key: string, sha = manifestSha) => cli("restore", co, backup, sha, file, key, destination)
  const damaged = join(custody, "damaged.pldoff"), wrongKey = join(keys, "other.key")
  const corrupt = await readFile(archivePath); corrupt[corrupt.length - 1] ^= 1
  await writeFile(damaged, corrupt, { mode: 0o600 }); await writeFile(wrongKey, randomBytes(32), { mode: 0o600 })
  for (const failure of [attempt(other, archivePath, keyPath), attempt(company, archivePath, wrongKey),
    attempt(company, damaged, keyPath), attempt(company, archivePath, keyPath, "0".repeat(64))]) {
    assert.equal(failure.status, 1, failure.stderr)
  }
  await assert.rejects(access(destination), { code: "ENOENT" })
  const restored = attempt(company, archivePath, keyPath)
  assert.equal(restored.status, 0, restored.stderr)
  const report = JSON.parse(restored.stdout.trim().split("\n").at(-1)!)
  assert.equal(report.archiveSha256, archiveSha); assert.equal(report.manifestSha256, manifestSha)
  assert.deepEqual([report.records, report.history, report.documents, report.versions, report.bytes], [1, 2, 1, 1, binary.length])
  assert.deepEqual(JSON.parse(await readFile(join(destination, "COMPLETE.json"), "utf8")), report)
  assert.notEqual(attempt(company, archivePath, keyPath).status, 0, "Destino existente no se sobreescribe")
  const opened = localStore(destination)
  try {
    const db = await opened.getD1Database("DB"), bucket = await opened.getR2Bucket("EVIDENCE_BUCKET")
    const record = await db.prepare("SELECT * FROM pld_records").first()
    assert.equal(record?.companyId, company); assert.equal(record?.id, id)
    assert.equal(record?.payload, finalPayload); assert.equal(record?.revision, 2)
    const history = (await db.prepare("SELECT * FROM pld_record_versions ORDER BY revision").all()).results
    assert.deepEqual(history.map(row => [row.revision, JSON.parse(String(row.payload)).nombre, row.actorId]),
      [[1, "Cliente ficticio A", actor.id], [2, "Cliente ficticio A actualizado", actor.id]])
    const doc = await db.prepare("SELECT * FROM pld_documents").first()
    const version = await db.prepare("SELECT * FROM pld_file_versions").first()
    assert.equal(doc?.relatedId, id); assert.equal(version?.documentId, doc?.id); assert.equal(version?.version, 1)
    assert.equal(version?.sha256, digest(binary))
    const objects = (await bucket.list()).objects
    assert.deepEqual(objects.map(obj => obj.key), [version?.objectKey])
    const recovered = await bucket.get(String(version?.objectKey))
    assert.ok(recovered); assert.deepEqual(Buffer.from(await recovered.arrayBuffer()), binary)
    for (const table of ["pld_records", "pld_record_versions", "pld_documents", "pld_file_versions"]) {
      assert.equal(await db.prepare("SELECT count(*) AS n FROM " + table + " WHERE companyId<>?").bind(company).first("n"), 0)
    }
    assert.equal(await db.prepare("SELECT count(*) AS n FROM pld_companies WHERE id=?").bind(other).first("n"), 0)
    assert.equal(await db.prepare("SELECT status FROM pld_companies WHERE id=?").bind(company).first("status"), "archived")
    assert.deepEqual((await db.prepare("SELECT id,status,platformRole FROM user").all()).results, [{ id: actor.id, status: "suspended", platformRole: "user" }])
    for (const table of ["account", "session", "twoFactor", "pld_memberships", "pld_grants"]) {
      assert.equal(await db.prepare("SELECT count(*) AS n FROM " + table).first("n"), 0)
    }
    await assert.rejects(() => requireCompany(noGrant, company, { DB: db } as unknown as PilotEnv, "expedientes", "download"), { status: 404 })
    t.diagnostic("Simulacro ficticio: origen apagado, 1 empresa, 1 EUI, 2 revisiones, 1 documento, 1 binario (" + binary.length +
      " bytes), SHA-256 binario " + digest(binary) + "; comprobante manifiesto " + manifestSha + "; archivo cifrado " + archiveSha +
      ". Segunda empresa excluida; denegados clave/empresa/SHA incorrectos, copia alterada, archivo faltante/corrupto, destino existente y acceso sin permiso.")
  } finally { await opened.dispose() }
})
