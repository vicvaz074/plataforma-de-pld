import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import type { jsPDF } from "jspdf"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { downloadProfessionalReport, REPORT_LOGO_URL, type ProfessionalReport } from "../lib/pld/reports"
import { configurePilotSession, loadCompanyStorage, resetCompanyStorage } from "../lib/pilot/module-storage"
import type { PilotSession } from "../lib/pilot/contracts"

const a = { id: "report-company-a", organizationId: "report-org", name: "EMPRESA_ORIGEN_A", rfc: "AAA010101AAA", status: "active" as const }
const b = { ...a, id: "report-company-b", name: "EMPRESA_DESTINO_B" }
const session: PilotSession = {
  user: { id: "report-viewer", name: "Consulta autorizada", email: "viewer@example.test", platformRole: "user", status: "active", requiresPasswordChange: false, twoFactorEnabled: false },
  organizations: [{ id: a.organizationId, name: "Organización QA", mfaEnabled: false }], companies: [a, b], memberships: [{ organizationId: a.organizationId, userId: "report-viewer", role: "viewer" }],
  grants: [a, b].map(company => ({ companyId: company.id, userId: "report-viewer", permissions: { ebr: ["view", "download"] } })), mfaRequired: false,
}
const report: ProfessionalReport = { title: "Reporte autorizado", summary: ["DATOS_ORIGINALES_A"], sections: [], filename: "Reporte QA.pdf" }
const logo = readFileSync("public/logo-davara-governance/logo-davara-governance-black.png")
const deferred = <T = void>() => { let resolve!: (value: T | PromiseLike<T>) => void; const promise = new Promise<T>(done => { resolve = done }); return { promise, resolve } }
async function savedText(document: jsPDF) {
  const pdf = await getDocument({ data: new Uint8Array(document.output("arraybuffer")), useSystemFonts: true }).promise
  const items = []
  for (let index = 1; index <= pdf.numPages; index++) items.push(...(await (await pdf.getPage(index)).getTextContent()).items)
  await pdf.destroy()
  return items.filter(item => "str" in item).map(item => "str" in item ? item.str : "").join(" ")
}
interface DownloadRequestControl {
  wait?: Promise<void>; fail?: boolean; started?: () => void
  authorizationWait?: Promise<void>; authorizationDenied?: boolean; authorizationStarted?: () => void
  authorizations: Array<{ url: string; body: unknown }>
}
async function withConnected(run: (saved: Array<{ filename: string; document: jsPDF }>, logoRequest: DownloadRequestControl) => Promise<void>) {
  const original = globalThis.fetch
  const { jsPDF: Pdf } = await import("jspdf")
  const api = Pdf.API as unknown as Record<string, unknown>
  const previous = api.save
  const saved: Array<{ filename: string; document: jsPDF }> = []
  const logoRequest: DownloadRequestControl = { authorizations: [] }
  api.save = function(this: jsPDF, filename: string) { saved.push({ filename, document: this }); return Promise.resolve() }
  globalThis.fetch = async (input, init) => {
    if (String(input) === REPORT_LOGO_URL) {
      logoRequest.started?.(); if (logoRequest.wait) await logoRequest.wait
      return logoRequest.fail ? new Response("Not found", { status: 404 }) : new Response(logo, { headers: { "content-type": "image/png" } })
    }
    if (String(input).endsWith("/authorize")) {
      logoRequest.authorizations.push({ url: String(input), body: JSON.parse(String(init?.body)) })
      logoRequest.authorizationStarted?.()
      if (logoRequest.authorizationWait) await logoRequest.authorizationWait
      return new Response(JSON.stringify(logoRequest.authorizationDenied ? { error: "Permiso de descarga revocado" } : { authorized: true }), { status: logoRequest.authorizationDenied ? 403 : 200, headers: { "content-type": "application/json" } })
    }
    return new Response(JSON.stringify({ records: [] }), { headers: { "content-type": "application/json" } })
  }
  try { configurePilotSession(session); await loadCompanyStorage(a); await run(saved, logoRequest) }
  finally { globalThis.fetch = original; if (previous === undefined) delete api.save; else api.save = previous; resetCompanyStorage() }
}

test("a read-only user with download permission can export; mutable caller data cannot change the captured company/report", async () => {
  await withConnected(async (saved, request) => {
    const ready = deferred(), started = deferred()
    request.wait = ready.promise; request.started = () => started.resolve()
    const mutable: ProfessionalReport = { ...report, summary: [...report.summary] }
    const pending = downloadProfessionalReport(mutable, "ebr")
    await started.promise
    mutable.summary[0] = "DATOS_OTRA_EMPRESA_B"; mutable.filename = "OTRO.pdf"
    ready.resolve(); await pending
    assert.equal(saved.length, 1)
    assert.equal(saved[0].filename, "Reporte-QA.pdf")
    assert.deepEqual(request.authorizations, [{ url: `/api/v1/companies/${a.id}/authorize`, body: { moduleKey: "ebr", action: "download" } }])
    const text = await savedText(saved[0].document)
    assert.match(text, /EMPRESA_ORIGEN_A/); assert.match(text, /DATOS_ORIGINALES_A/)
    assert.ok(!text.includes("DATOS_OTRA_EMPRESA_B"))
  })
})

test("server-side revocation cannot be bypassed by a cached local download grant", async () => {
  await withConnected(async (saved, request) => {
    request.authorizationDenied = true
    await assert.rejects(downloadProfessionalReport(report, "ebr"), /revocado/)
    assert.equal(request.authorizations.length, 1)
    assert.equal(saved.length, 0)
  })
})

test("switching company during final server authorization cancels the original company's download", async () => {
  await withConnected(async (saved, request) => {
    const ready = deferred(), started = deferred()
    request.authorizationWait = ready.promise; request.authorizationStarted = () => started.resolve()
    const rejected = assert.rejects(downloadProfessionalReport(report, "ebr"), /empresa o el acceso cambió|empresa cambió/)
    await started.promise
    await loadCompanyStorage(b)
    ready.resolve(); await rejected
    assert.equal(saved.length, 0)
    assert.equal(request.authorizations[0].url, `/api/v1/companies/${a.id}/authorize`, "The check uses captured company A, never active company B")
  })
})

test("company switch or revoked session during asynchronous generation cancels the download", async () => {
  await withConnected(async (saved, request) => {
    const ready = deferred(), started = deferred()
    request.wait = ready.promise; request.started = () => started.resolve()
    const rejected = assert.rejects(downloadProfessionalReport(report, "ebr"), /empresa o el acceso cambió|empresa cambió|permiso/i)
    await started.promise; await loadCompanyStorage(b); ready.resolve(); await rejected
    assert.equal(saved.length, 0, "Never brand company A data with company B")
  })
  await withConnected(async (saved, request) => {
    const ready = deferred(), started = deferred()
    request.wait = ready.promise; request.started = () => started.resolve()
    const rejected = assert.rejects(downloadProfessionalReport(report, "ebr"), /empresa o el acceso cambió|permiso/i)
    await started.promise
    configurePilotSession({ ...session, grants: session.grants.map(grant => ({ ...grant, permissions: { ebr: ["view"] } })) })
    ready.resolve(); await rejected
    assert.equal(saved.length, 0)
  })
})

test("missing download permission or failed official logo rejects without a false successful download", async () => {
  await withConnected(async (saved, request) => {
    await assert.rejects(downloadProfessionalReport(report, "auditoria"), /permiso/i)
    request.fail = true
    await assert.rejects(downloadProfessionalReport(report, "ebr"), /logo oficial/i)
    assert.equal(saved.length, 0)
  })
})

test("without an active company production cannot silently use demo branding", async () => {
  const mode = process.env.NEXT_PUBLIC_PLD_MODE
  delete process.env.NEXT_PUBLIC_PLD_MODE
  try { resetCompanyStorage(); await assert.rejects(downloadProfessionalReport(report, "ebr"), /empresa conectada/) }
  finally { if (mode === undefined) delete process.env.NEXT_PUBLIC_PLD_MODE; else process.env.NEXT_PUBLIC_PLD_MODE = mode }
})
