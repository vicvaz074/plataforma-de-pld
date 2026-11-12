import { sessionCan, type ModuleKey } from "../../pilot/contracts"
import { pilotApi, jsonRequest } from "../../pilot/api"
import { assertModuleScope, captureModuleScope, getActiveCompany, getPilotSession, isCloudConnected } from "../../pilot/module-storage"
import { renderProfessionalReport, REPORT_LOGO_URL, safeReportFilename } from "./renderer"
import type { ProfessionalReport, ProfessionalReportContext } from "./types"

export type { ProfessionalReport, ProfessionalReportContext, ReportMetric, ReportBar, ReportTableColumn, ReportSection } from "./types"
export { renderProfessionalReport, REPORT_LOGO_URL, REPORT_PAGE, PROFESSIONAL_REPORT_VERSION, safeReportFilename } from "./renderer"

/** Bind data, branding and authorization before the first asynchronous boundary. */
export async function downloadProfessionalReport(report: ProfessionalReport, module: ModuleKey): Promise<void> {
  const scope = captureModuleScope()
  const connected = isCloudConnected()
  const company = getActiveCompany()
  const session = getPilotSession()
  const demo = !connected && process.env.NEXT_PUBLIC_PLD_MODE === "demo"
  if (!demo && (!connected || !company)) throw new Error("Selecciona una empresa conectada para descargar el reporte.")
  if (connected && !sessionCan(session, company, module, "download")) throw new Error("No tienes permiso para descargar reportes de este módulo.")
  const context: ProfessionalReportContext = {
    company: company ? { name: company.name, rfc: company.rfc } : { name: "DEMOSTRACIÓN - datos locales", rfc: "No productivo" },
    generatedBy: session?.user.name || (demo ? "Modo demostración" : ""),
    generatedAt: new Date().toISOString(),
  }
  // Snapshot caller data now: a mutable array cannot acquire a second company's
  // records while fonts/logo are loading. Structured JSON is the report API.
  const snapshot = JSON.parse(JSON.stringify(report)) as ProfessionalReport
  if (demo) snapshot.disclaimers = [...(snapshot.disclaimers || []), "Modo demostración: información local, no productiva."]
  const response = await fetch(REPORT_LOGO_URL, { credentials: "same-origin", cache: "force-cache" })
  if (!response.ok) throw new Error("No se pudo cargar el logo oficial del reporte. Intenta de nuevo.")
  const logo = new Uint8Array(await response.arrayBuffer())
  const document = await renderProfessionalReport(snapshot, context, logo)
  assertModuleScope(scope)
  if (isCloudConnected() !== connected || getActiveCompany()?.id !== company?.id) throw new Error("La empresa cambió durante la generación. Vuelve a descargar el reporte.")
  if (connected && !sessionCan(getPilotSession(), getActiveCompany(), module, "download")) throw new Error("El permiso de descarga cambió. Vuelve a iniciar la acción.")
  // A cached session cannot authorize a grant revoked on the server while the
  // PDF was rendering. Bind this final check to the captured company, then
  // reject a company/session switch during the authorization request as well.
  if (connected && company) {
    await pilotApi(`/companies/${encodeURIComponent(company.id)}/authorize`, jsonRequest("POST", { moduleKey: module, action: "download" }))
    assertModuleScope(scope)
    if (!sessionCan(getPilotSession(), getActiveCompany(), module, "download")) throw new Error("El permiso de descarga cambió. Vuelve a iniciar la acción.")
  }
  await document.save(safeReportFilename(snapshot.filename), { returnPromise: true })
}
