import { resolveSatFormatoForActividad } from "./sat-formatos"
import { resolveSatTemplateForActividad } from "./sat-template-catalog"
import type {
  PldOperationalCase,
  PldSubjectRegistrationLink,
  SatDownloadOption,
  SatFieldDefinition,
  SatLayoutDefinition,
  SatOutputKind,
  SatOutputPackage,
  SatOutputValidation,
} from "./types"

const SAT_XML_SOURCE =
  "Resolución por la que se expiden los formatos oficiales de los avisos e informes que deben presentar quienes realicen actividades vulnerables."

const BASE_REQUIRED_FIELDS: SatFieldDefinition[] = [
  {
    id: "periodo",
    label: "Periodo reportado",
    xmlTag: "mes_reportado",
    required: true,
    source: SAT_XML_SOURCE,
    dataType: "numerico",
    pattern: "^\\d{6}$",
  },
  {
    id: "sujeto_obligado.rfc",
    label: "RFC del sujeto obligado",
    xmlTag: "sujeto_obligado",
    required: true,
    source: SAT_XML_SOURCE,
    dataType: "alfanumerico",
  },
  {
    id: "clave_actividad",
    label: "Clave de actividad vulnerable",
    xmlTag: "clave_actividad",
    required: true,
    source: SAT_XML_SOURCE,
    dataType: "alfanumerico",
  },
  {
    id: "cliente.nombre",
    label: "Nombre o razón social de cliente/usuario",
    xmlTag: "nombre_razon_social",
    required: true,
    source: SAT_XML_SOURCE,
    dataType: "alfanumerico",
  },
  {
    id: "operacion.fecha",
    label: "Fecha de operación",
    xmlTag: "fecha_operacion",
    required: true,
    source: SAT_XML_SOURCE,
    dataType: "fecha",
  },
  {
    id: "operacion.monto",
    label: "Monto de operación",
    xmlTag: "monto_operacion",
    required: true,
    source: SAT_XML_SOURCE,
    dataType: "moneda",
  },
]

export function getSatLayoutForActividad(actividadKey: string): SatLayoutDefinition {
  const formato = resolveSatFormatoForActividad(actividadKey)

  return {
    id: `layout-${formato.id}`,
    formatoId: formato.id,
    anexo: formato.anexo,
    outputKinds: formato.outputModes,
    activityXmlTag: formato.layoutXmlTag,
    requiredFields: BASE_REQUIRED_FIELDS,
    sourceUrl: formato.satPageUrl,
    sourceLastVerified: formato.sourceLastVerified,
  }
}

export function generateSatOutputPackage(operationalCase: PldOperationalCase): SatOutputPackage {
  const formato = resolveSatFormatoForActividad(operationalCase.actividadKey)
  const template = resolveSatTemplateForActividad(
    operationalCase.actividadKey,
    operationalCase.satTemplateVariant || operationalCase.satTemplateId,
  )
  const layout = getSatLayoutForActividad(operationalCase.actividadKey)
  const outputKind = operationalCase.satOutputStatus.kind
  const generatedAt = new Date().toISOString()
  const validation = validateSatOutput(operationalCase, outputKind)
  const prefix = outputKind === "informe_ceros" || outputKind === "informe_27_bis" ? "informe" : "aviso"
  const clienteRfc = sanitizeFilePart(operationalCase.clienteRfc || operationalCase.clienteId || "SINRFC")
  const fractionSlug = slugFraction(formato.fraccion)
  const xmlFileName = `${prefix}-${fractionSlug}-${operationalCase.periodo || "SINPERIODO"}-${clienteRfc}.xml`
  const fichaFileName = `ficha-captura-${fractionSlug}-${operationalCase.periodo || "SINPERIODO"}-${clienteRfc}.csv`
  const workbookFileName = `${prefix}-${fractionSlug}-${operationalCase.periodo || "SINPERIODO"}-${clienteRfc}.xlsm`
  const xml = buildSatXml({
    operationalCase,
    outputKind,
    validation,
    layout,
    generatedAt,
  })
  const ficha = buildCaptureSheet(operationalCase, outputKind, validation)
  const downloads = buildDownloads({
    xmlFileName,
    fichaFileName,
    validation,
    officialTemplateUrl:
      outputKind === "informe_ceros" || outputKind === "informe_27_bis"
        ? formato.informeCerosUrl || formato.avisoUrl
        : formato.avisoUrl || formato.informeCerosUrl,
    officialTemplateName:
      outputKind === "informe_ceros" || outputKind === "informe_27_bis"
        ? formato.plantillaInformeNombre || formato.officialXlsmName
        : template.officialXlsmName,
    workbookFileName,
    workbookAvailable: Boolean(operationalCase.satFieldValues && template.localPath),
  })

  return {
    id: `satpkg-${operationalCase.id}-${outputKind}`,
    schemaVersion: 1,
    createdAt: generatedAt,
    tenantId: operationalCase.tenantId,
    tenantRfc: operationalCase.tenantRfc,
    tenantName: operationalCase.tenantName,
    periodo: operationalCase.periodo,
    formatoId: formato.id,
    actividadKey: operationalCase.actividadKey,
    clienteNombre: operationalCase.clienteNombre,
    clienteRfc: operationalCase.clienteRfc,
    outputKind,
    label: operationalCase.satOutputStatus.label,
    xml,
    xmlFileName,
    ficha,
    fichaFileName,
    officialTemplateUrl: downloads.find((download) => download.kind === "official_template")?.url,
    officialTemplateName: downloads.find((download) => download.kind === "official_template")?.fileName,
    satTemplateId: template.templateId,
    satTemplateFile: template.officialXlsmName,
    satTemplateVariant: operationalCase.satTemplateVariant || template.templateId,
    satTemplateLocalPath: template.localPath,
    satFieldValues: operationalCase.satFieldValues,
    satCellValues: operationalCase.satCellValues,
    satMissingRequiredFields: operationalCase.satMissingRequiredFields,
    satWorkbookStatus: operationalCase.satWorkbookStatus,
    satWorkbookFileName: workbookFileName,
    validation,
    downloads,
  }
}

export function buildPldSubjectRegistrationLinks(input: {
  registroSat: unknown
  tenantsState?: unknown
  expedientes?: unknown
}): PldSubjectRegistrationLink[] {
  const registro = asRecord(input.registroSat)
  const sujetos = asArray(registro.sujetosRegistrados)
  const tenantsState = asRecord(input.tenantsState)
  const tenants = asArray(tenantsState.tenants)
  const expedientes = asArray(input.expedientes)
  const links: PldSubjectRegistrationLink[] = []

  sujetos.forEach((raw) => {
    const sujeto = asRecord(raw)
    const identificacion = asRecord(sujeto.identificacion)
    const id = stringValue(sujeto.id)
    const rfc = stringValue(identificacion.rfc)
    const nombre = stringValue(sujeto.nombre) || stringValue(identificacion.nombre)
    if (!rfc || !id) return

    const actividades = asArray(sujeto.actividades)
      .map((actividad) => stringValue(asRecord(actividad).actividadKey))
      .filter(Boolean)
    const folios = asArray(sujeto.actividades)
      .map((actividad) => stringValue(asRecord(actividad).folioDocumento))
      .filter(Boolean)
    const matchingTenant = tenants.find((tenant) => stringValue(asRecord(tenant).rfc) === rfc)
    const matchingExpedientes = expedientes.filter((expediente) => {
      const record = asRecord(expediente)
      return stringValue(record.sujetoObligadoId) === id || stringValue(record.sujetoObligadoNombre) === nombre
    })
    const documentos = asRecord(sujeto.documentos)
    const acuses: PldSubjectRegistrationLink["acuses"] = []
    ;(["detalle", "acuse", "aceptacion"] as const).forEach((type) => {
      const doc = asRecord(documentos[type])
      const name = stringValue(doc.name)
      if (!name) return
      acuses.push({
        type,
        name,
        uploadedAt: stringValue(doc.uploadDate) || undefined,
      })
    })
    const tenantRecord = asRecord(matchingTenant)

    links.push({
      sujetoObligadoId: id,
      sujetoObligadoRfc: rfc,
      sujetoObligadoNombre: nombre,
      tenantId: stringValue(tenantRecord.id) || undefined,
      tenantRfc: stringValue(tenantRecord.rfc) || undefined,
      tenantName: stringValue(tenantRecord.razonSocial) || undefined,
      actividadKeys: actividades,
      foliosRegistro: folios,
      euiCount: matchingExpedientes.length,
      euiRfcs: matchingExpedientes.map((expediente) => stringValue(asRecord(expediente).rfc)).filter(Boolean),
      acuses,
      status: matchingExpedientes.length > 0 ? "vinculado" : matchingTenant ? "sin_eui" : "sin_tenant",
    })
  })

  return links
}

function validateSatOutput(operationalCase: PldOperationalCase, outputKind: SatOutputKind): SatOutputValidation {
  const missingFields: string[] = []
  const errors: string[] = []
  const warnings: string[] = []

  if (!operationalCase.periodo || !/^\d{6}$/.test(operationalCase.periodo)) missingFields.push("periodo")
  if (!operationalCase.tenantRfc) missingFields.push("sujeto_obligado.rfc")
  if (!operationalCase.tenantName) missingFields.push("sujeto_obligado.razon_social")
  if (!operationalCase.actividadKey) missingFields.push("clave_actividad")

  if (outputKind !== "informe_ceros") {
    if (!operationalCase.clienteNombre) missingFields.push("cliente.nombre")
    if (!operationalCase.fechaOperacion) missingFields.push("operacion.fecha")
    if (!Number.isFinite(operationalCase.montoMxn) || operationalCase.montoMxn < 0) missingFields.push("operacion.monto")
    if (operationalCase.satMissingRequiredFields?.length) {
      operationalCase.satMissingRequiredFields.forEach((field) => missingFields.push(`xlsm.${field}`))
    }
  }

  if (outputKind === "aviso_24h" && !operationalCase.suspicionNarrative?.trim()) {
    missingFields.push("alerta.narrativa_24h")
  }

  if (outputKind === "informe_27_bis" && !operationalCase.satOutputStatus.descripcion.trim()) {
    warnings.push("Verificar que el supuesto 27 Bis cuente con soporte documental antes de carga al SPPLD.")
  }

  if (!operationalCase.evidenceStatus.canClose && outputKind !== "aviso_24h") {
    warnings.push("Existen evidencias críticas pendientes; conservar justificación antes de cerrar expediente.")
  }

  return {
    status: missingFields.length || errors.length ? "borrador_bloqueado" : "listo",
    missingFields,
    errors,
    warnings,
  }
}

function buildSatXml(input: {
  operationalCase: PldOperationalCase
  outputKind: SatOutputKind
  validation: SatOutputValidation
  layout: SatLayoutDefinition
  generatedAt: string
}) {
  const { operationalCase, outputKind, validation, layout, generatedAt } = input
  const formato = resolveSatFormatoForActividad(operationalCase.actividadKey)
  const isBlocked = validation.status === "borrador_bloqueado"
  const isInformeCeros = outputKind === "informe_ceros"
  const isInforme27Bis = outputKind === "informe_27_bis"
  const isAviso = outputKind === "aviso_normal" || outputKind === "aviso_24h"

  return `<?xml version="1.0" encoding="UTF-8"?>
<archivo xmlns="http://www.uif.shcp.gob.mx/recepcion/actividades-vulnerables" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <informe>
    <mes_reportado>${escapeXml(operationalCase.periodo)}</mes_reportado>
    <tipo_salida>${escapeXml(outputKind)}</tipo_salida>
    <borrador_no_cargable>${isBlocked ? "SI" : "NO"}</borrador_no_cargable>
    <formato_sat>
      <id>${escapeXml(formato.id)}</id>
      <anexo>${escapeXml(formato.anexo)}</anexo>
      <fraccion>${escapeXml(formato.fraccion)}</fraccion>
      <clave_actividad>${escapeXml(formato.claveActividad)}</clave_actividad>
      <plantilla>${escapeXml(formato.officialXlsmName)}</plantilla>
      <fuente>${escapeXml(formato.satPageUrl)}</fuente>
      <verificado_en>${escapeXml(formato.sourceLastVerified)}</verificado_en>
    </formato_sat>
    <sujeto_obligado>
      <rfc>${escapeXml(operationalCase.tenantRfc)}</rfc>
      <razon_social>${escapeXml(operationalCase.tenantName)}</razon_social>
    </sujeto_obligado>
    <salida_sat>
      <sin_operaciones>${isInformeCeros ? "1" : "0"}</sin_operaciones>
      <exento>${isInforme27Bis ? "1" : "0"}</exento>
      <aviso>${isAviso ? "1" : "0"}</aviso>
      <fecha_limite>${escapeXml(operationalCase.satOutputStatus.fechaLimite || "")}</fecha_limite>
    </salida_sat>
    <aviso>
      <referencia_aviso>${escapeXml(operationalCase.id)}</referencia_aviso>
      <prioridad>${outputKind === "aviso_24h" ? "2" : "1"}</prioridad>
      <alerta>
        <tipo_alerta>${escapeXml(operationalCase.alertaCodigo || (outputKind === "aviso_24h" ? "9999" : "100"))}</tipo_alerta>
        <descripcion_alerta>${escapeXml(operationalCase.alertaDescripcion || operationalCase.suspicionNarrative || "Sin alerta.")}</descripcion_alerta>
      </alerta>
      <persona_aviso>
        <nombre_razon_social>${escapeXml(operationalCase.clienteNombre)}</nombre_razon_social>
        ${operationalCase.clienteRfc ? `<rfc>${escapeXml(operationalCase.clienteRfc)}</rfc>` : ""}
        <tipo_cliente>${escapeXml(operationalCase.tipoCliente)}</tipo_cliente>
      </persona_aviso>
      <detalle_operaciones>
        <${layout.activityXmlTag}>
          <actividad>${escapeXml(operationalCase.actividadKey)}</actividad>
          <fecha_operacion>${escapeXml(operationalCase.fechaOperacion)}</fecha_operacion>
          <forma_pago>${escapeXml(operationalCase.formaPago)}</forma_pago>
          <monto_operacion>${formatMoney(operationalCase.montoMxn)}</monto_operacion>
        </${layout.activityXmlTag}>
      </detalle_operaciones>
      <evidencia>
        <puede_cerrar>${operationalCase.evidenceStatus.canClose ? "SI" : "NO"}</puede_cerrar>
        <faltantes_criticos>${operationalCase.evidenceStatus.missingCritical.length}</faltantes_criticos>
      </evidencia>
    </aviso>
  </informe>
  <validacion>
    <estatus>${escapeXml(validation.status)}</estatus>
    <faltantes>${escapeXml(validation.missingFields.join("|"))}</faltantes>
    <advertencias>${escapeXml(validation.warnings.join("|"))}</advertencias>
  </validacion>
  <trazabilidad>
    <generado_en>${escapeXml(generatedAt)}</generado_en>
    <version_xml>sat-layout-oficial-v1</version_xml>
  </trazabilidad>
</archivo>`
}

function buildCaptureSheet(
  operationalCase: PldOperationalCase,
  outputKind: SatOutputKind,
  validation: SatOutputValidation,
) {
  const rows = [
    ["Campo", "Valor"],
    ["Tipo de salida", outputKind],
    ["Estatus XML", validation.status],
    ["Periodo", operationalCase.periodo],
    ["RFC sujeto obligado", operationalCase.tenantRfc],
    ["Sujeto obligado", operationalCase.tenantName],
    ["Actividad vulnerable", operationalCase.actividadKey],
    ["Cliente", operationalCase.clienteNombre],
    ["RFC cliente", operationalCase.clienteRfc || ""],
    ["Fecha de operación", operationalCase.fechaOperacion],
    ["Monto MXN", formatMoney(operationalCase.montoMxn)],
    ["Forma de pago", operationalCase.formaPago],
    ["Faltantes", validation.missingFields.join("; ")],
    ["Advertencias", validation.warnings.join("; ")],
  ]

  return rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n")
}

function buildDownloads(input: {
  xmlFileName: string
  fichaFileName: string
  workbookFileName: string
  workbookAvailable: boolean
  officialTemplateUrl?: string
  officialTemplateName?: string
  validation: SatOutputValidation
}): SatDownloadOption[] {
  const downloads: SatDownloadOption[] = [
    {
      id: "official-template",
      label: "Descargar plantilla oficial SAT",
      kind: "official_template",
      url: input.officialTemplateUrl,
      fileName: input.officialTemplateName,
      status: input.officialTemplateUrl ? "external" : "blocked",
    },
    {
      id: "filled-workbook",
      label: input.validation.status === "listo" ? "Descargar Excel SAT rellenado" : "Excel SAT borrador",
      kind: "filled_workbook",
      fileName: input.workbookFileName,
      mimeType: "application/vnd.ms-excel.sheet.macroEnabled.12",
      status: input.workbookAvailable && input.validation.status === "listo" ? "available" : "blocked",
    },
    {
      id: "xml",
      label: input.validation.status === "listo" ? "Descargar XML SAT" : "Descargar XML borrador",
      kind: "xml",
      fileName: input.xmlFileName,
      mimeType: "application/xml",
      status: input.validation.status === "listo" ? "available" : "blocked",
    },
    {
      id: "capture-sheet",
      label: "Descargar ficha de captura",
      kind: "capture_sheet",
      fileName: input.fichaFileName,
      mimeType: "text/csv",
      status: "available",
    },
    {
      id: "validation",
      label: "Ver campos faltantes",
      kind: "validation",
      fileName: "validacion-sat.txt",
      mimeType: "text/plain",
      status: input.validation.missingFields.length ? "blocked" : "available",
    },
  ]

  return downloads
}

function escapeXml(value: string | number | undefined | null) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function formatMoney(value: number) {
  if (!Number.isFinite(value)) return "0.00"
  return value.toFixed(2)
}

function slugFraction(fraccion: string) {
  return fraccion
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/fraccion\s+/, "fraccion-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

function sanitizeFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 32) || "SINRFC"
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : ""
}
