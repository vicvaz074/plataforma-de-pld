import { SAT_TEMPLATE_CATALOG } from "./sat-template-catalog"
import { normalizeSatXlsmLayout } from "./sat-xlsm"
import { isSatXlsmFieldRequired } from "./ui-workflow"
import type {
  SatTemplateCatalogItem,
  SatTemplateDemoScenario,
  SatXlsmField,
  SatXlsmLayout,
} from "./types"

/** Cortes de seguridad para el llenado iterativo de escenarios demo. */
const MAX_DEMO_FILL_PASSES = 6

const DEMO_PERIOD = "202605"
const DEMO_TENANT_RFC = "FSC220908AC2"
const DEMO_TENANT_NAME = "Fixture SAT Demo I-XVI"
const DEMO_CLIENT_NAME = "LOGISALL MEXICO S DE RL DE CV"
const DEMO_CLIENT_RFC = "LME161125GY9"
const DEMO_OPERATION_DATE = "26/05/2026"
const DEMO_AMOUNT = 148_092.99
const DEMO_COMPLETED_EVIDENCE = {
  "pm-acta-constitutiva": true,
  "pm-rfc-constancia": true,
  "pm-domicilio": true,
  "pm-poderes-representante": true,
  "pm-identificacion-representante": true,
  "pm-beneficiario-controlador": true,
  "operacion-soporte": true,
  "operacion-forma-pago": true,
}

export function getConcreteSatTemplates(
  catalog: SatTemplateCatalogItem[] = SAT_TEMPLATE_CATALOG,
): SatTemplateCatalogItem[] {
  const templates = new Map<string, SatTemplateCatalogItem>()
  for (const item of catalog) {
    if (!item.variants.length) {
      templates.set(item.templateId, item)
      continue
    }
    for (const variant of item.variants) {
      templates.set(variant.templateId, {
        ...item,
        templateId: variant.templateId,
        actividadKeys: variant.actividadKeys,
        nombre: `${item.nombre} - ${variant.label}`,
        officialXlsmName: variant.officialXlsmName,
        sourceZipUrl: variant.sourceZipUrl,
        localPath: variant.localPath,
        requiresVariantSelection: true,
      })
    }
  }
  return [...templates.values()]
}

export function buildSatTemplateDemoScenarios(): SatTemplateDemoScenario[] {
  return getConcreteSatTemplates().map((template) => {
    const isF4594 = template.templateId === "sat-fraccion-xv-arrendamiento"
    return {
      id: `sat-demo-${template.templateId}`,
      templateId: template.templateId,
      actividadKey: template.actividadKeys[0],
      label: isF4594 ? "F4594 - Renta Mayo 2025" : `Demo ${template.fraccion} - ${template.nombre}`,
      periodo: isF4594 ? "202505" : DEMO_PERIOD,
      tenantRfc: DEMO_TENANT_RFC,
      tenantName: isF4594 ? "F4594 Sujeto Obligado Demo" : DEMO_TENANT_NAME,
      clienteNombre: DEMO_CLIENT_NAME,
      clienteRfc: DEMO_CLIENT_RFC,
      fechaOperacion: isF4594 ? "2025-05-26" : "2026-05-26",
      montoMxn: DEMO_AMOUNT,
      formaPago: "1,Contado",
      template,
      satFieldValues: isF4594 ? buildF4594SatFieldValues() : buildBaseSatFieldValues(template),
      satCellValues: {},
      completedEvidence: DEMO_COMPLETED_EVIDENCE,
      workbookValidationStatus: isF4594 ? "golden_fixture" : "strict_synthetic",
      goldenFixtureId: isF4594 ? "f4594-arrendamiento-av202505-mac-xmlfix" : undefined,
    }
  })
}

export function buildSatTemplateDemoScenarioValues(input: {
  scenario: SatTemplateDemoScenario
  layout: SatXlsmLayout
}): { satFieldValues: Record<string, string>; satCellValues: Record<string, string> } {
  const layout = normalizeSatXlsmLayout(input.layout)
  const satFieldValues = { ...input.scenario.satFieldValues }
  const satCellValues = { ...(input.scenario.satCellValues || {}) }
  const fields = layout.sections.flatMap((section) => section.fields)

  // Elegir una opción puede volver obligatorios campos que dependen de ella
  // (por ejemplo el domicilio del inmueble al declarar un bien inmueble), así
  // que se recorre hasta que no aparezcan nuevos pendientes.
  for (let pass = 0; pass < MAX_DEMO_FILL_PASSES; pass += 1) {
    let filled = 0
    for (const field of fields) {
      if (!isSatXlsmFieldRequired(field, satFieldValues)) continue
      const cellKey = `${field.sheetName}!${field.cell}`
      if (satFieldValues[field.id] || satCellValues[cellKey]) {
        if (satFieldValues[field.id] && field.options?.length && !field.options.includes(satFieldValues[field.id])) {
          satFieldValues[field.id] = selectDemoOption(field, input.scenario)
        }
        continue
      }
      satFieldValues[field.id] = demoValueForField(field, input.scenario)
      filled += 1
    }
    if (!filled) break
  }

  return { satFieldValues, satCellValues }
}

function buildBaseSatFieldValues(template: SatTemplateCatalogItem): Record<string, string> {
  const reference = `DEMO-${template.claveActividad}-${DEMO_PERIOD}`.replace(/[^A-Z0-9-]/g, "")
  return {
    "persona_aviso.sujeto_obligado_rfc": DEMO_TENANT_RFC,
    "persona_aviso.periodo": DEMO_PERIOD,
    "persona_aviso.referencia": reference,
    "persona_aviso.prioridad": "1,NORMAL",
    "persona_aviso.tipo_alerta": "100,Sin alerta.",
    "persona_aviso.pm.razon_social": DEMO_CLIENT_NAME,
    "persona_aviso.pm.fecha_constitucion": "25/11/2016",
    "persona_aviso.pm.rfc": DEMO_CLIENT_RFC,
    "persona_aviso.pm.pais_nacionalidad": "MEXICO,MX",
    "persona_aviso.pm.giro_mercantil": "INDUSTRIA - PLASTICO Y DEL HULE||3260005",
    "persona_aviso.representante.nombre": "LEE",
    "persona_aviso.representante.apellido_paterno": "CHUNWOO",
    "persona_aviso.representante.apellido_materno": "N",
    "persona_aviso.representante.fecha_nacimiento": "23/09/1977",
    "persona_aviso.representante.curp": "LEXC770923HNEXXH07",
    "persona_aviso.domicilio_nacional.codigo_postal": "66650",
    "persona_aviso.domicilio_nacional.colonia": "PESQUERIA",
    "persona_aviso.domicilio_nacional.calle": "ARMONIA",
    "persona_aviso.domicilio_nacional.numero_exterior": "104",
    "persona_aviso.contacto.pais_telefono": "MEXICO,MX",
    "persona_aviso.contacto.telefono": "66926318336",
    "persona_aviso.contacto.correo": "SANTANA@LOGISALL.COM",
    "beneficiario.pf.nombre": "ANA",
    "beneficiario.pf.apellido_paterno": "MARTINEZ",
    "beneficiario.pf.apellido_materno": "LOPEZ",
    "beneficiario.pf.fecha_nacimiento": "12/09/1976",
    "beneficiario.pf.rfc": "MALA760912QA1",
    "beneficiario.pf.curp": "MALA760912MNLPRN04",
    "beneficiario.pf.pais_nacionalidad": "MEXICO,MX",
    "acto.fecha_operacion": DEMO_OPERATION_DATE,
    "acto.tipo_operacion": "",
    "pago.fecha": DEMO_OPERATION_DATE,
    "pago.forma_pago": "1,Contado",
    "pago.instrumento_monetario": "8,Transferencia Interbancaria",
    "pago.moneda": "1,Peso mexicano",
    "pago.monto": String(DEMO_AMOUNT),
  }
}

function buildF4594SatFieldValues(): Record<string, string> {
  return {
    "persona_aviso.sujeto_obligado_rfc": "FSC220908AC2",
    "persona_aviso.periodo": "202505",
    "persona_aviso.referencia": "AV202505",
    "persona_aviso.prioridad": "1,NORMAL",
    "persona_aviso.tipo_alerta": "100,Sin alerta.",
    "persona_aviso.pm.razon_social": "LOGISALL MEXICO S DE RL DE CV",
    "persona_aviso.pm.fecha_constitucion": "25/11/2016",
    "persona_aviso.pm.rfc": "LME161125GY9",
    "persona_aviso.pm.pais_nacionalidad": "MEXICO,MX",
    "persona_aviso.pm.giro_mercantil": "INDUSTRIA - PLASTICO Y DEL HULE||3260005",
    "persona_aviso.representante.nombre": "LEE",
    "persona_aviso.representante.apellido_paterno": "CHUNWOO",
    "persona_aviso.representante.apellido_materno": "N",
    "persona_aviso.representante.fecha_nacimiento": "23/09/1977",
    "persona_aviso.representante.curp": "LEXC770923HNEXXH07",
    "persona_aviso.domicilio_nacional.codigo_postal": "66650",
    "persona_aviso.domicilio_nacional.colonia": "PESQUERIA",
    "persona_aviso.domicilio_nacional.calle": "ARMONIA",
    "persona_aviso.domicilio_nacional.numero_exterior": "104",
    "persona_aviso.contacto.pais_telefono": "MEXICO,MX",
    "persona_aviso.contacto.telefono": "66926318336",
    "persona_aviso.contacto.correo": "SANTANA@LOGISALL.COM",
    "acto.fecha_operacion": "26/05/2025",
    "acto.tipo_operacion": "1501,Arrendamiento de inmuebles",
    "inmueble.tipo_bien": "11,Nave Industrial",
    "inmueble.valor_referencia": "58569267",
    "inmueble.codigo_postal": "66679",
    "inmueble.colonia": "LA ARENA",
    "inmueble.calle": "CARRETERA PESQUERIA-LOS RAMONES",
    "inmueble.numero_exterior": "KM 11",
    "inmueble.folio_real": "06019003",
    "inmueble.fecha_inicio": "01/05/2025",
    "inmueble.fecha_termino": "31/05/2025",
    "pago.fecha": "26/05/2025",
    "pago.forma_pago": "1,Contado",
    "pago.instrumento_monetario": "8,Transferencia Interbancaria",
    "pago.moneda": "2,Dólar estadounidense",
    "pago.monto": "148092.99",
  }
}

function demoValueForField(field: SatXlsmField, scenario: SatTemplateDemoScenario): string {
  const normalized = slug(`${field.id} ${field.label} ${field.sheetName}`)
  if (field.options?.length) return selectDemoOption(field, scenario)
  if (normalized.includes("periodo") || normalized.includes("mes-reportado")) return scenario.periodo
  if (normalized.includes("referencia")) return `DEMO-${scenario.template.claveActividad}-${scenario.periodo}`
  if (normalized.includes("sujeto-obligado") && normalized.includes("rfc")) return scenario.tenantRfc
  if (normalized.includes("rfc")) return normalized.includes("representante") ? "LEXC770923XX1" : scenario.clienteRfc
  if (normalized.includes("curp")) return "LEXC770923HNEXXH07"
  if (normalized.includes("correo")) return "SANTANA@LOGISALL.COM"
  if (normalized.includes("telefono")) return "66926318336"
  if (normalized.includes("codigo-postal")) return normalized.includes("inmueble") || normalized.includes("acto") ? "66679" : "66650"
  if (normalized.includes("colonia")) return normalized.includes("inmueble") ? "LA ARENA" : "PESQUERIA"
  if (normalized.includes("calle") || normalized.includes("avenida") || normalized.includes("via")) return "ARMONIA"
  if (normalized.includes("numero-exterior")) return "104"
  if (normalized.includes("numero-interior")) return ""
  if (normalized.includes("fecha")) return scenario.fechaOperacion.includes("-") ? toDisplayDate(scenario.fechaOperacion) : scenario.fechaOperacion
  if (normalized.includes("monto") || normalized.includes("valor") || normalized.includes("importe")) return String(scenario.montoMxn)
  if (normalized.includes("cantidad") || normalized.includes("plazo") || normalized.includes("superficie")) return "12"
  if (normalized.includes("pais") || normalized.includes("nacionalidad")) return "MEXICO,MX"
  if (normalized.includes("razon-social") || normalized.includes("denominacion")) return scenario.clienteNombre
  if (normalized.includes("apellido-paterno")) return "CHUNWOO"
  if (normalized.includes("apellido-materno")) return "N"
  if (normalized.includes("nombre")) return "LEE"
  if (normalized.includes("folio")) return `FOLIO-${scenario.template.claveActividad}-${scenario.periodo}`
  if (normalized.includes("descripcion")) return `Operación demo ${scenario.template.fraccion}`
  return `DATO DEMO ${scenario.template.claveActividad}`
}

function selectDemoOption(field: SatXlsmField, scenario: SatTemplateDemoScenario): string {
  const options = field.options || []
  const normalized = slug(`${field.id} ${field.label}`)
  const preferred = [
    normalized.includes("prioridad") ? /^1,\s*NORMAL/i : undefined,
    normalized.includes("alerta") ? /^100,/i : undefined,
    normalized.includes("pais") || normalized.includes("nacionalidad") ? /MEXICO,MX/i : undefined,
    normalized.includes("giro") || normalized.includes("actividad") ? /NO APLICA\|\|1000000/i : undefined,
    normalized.includes("tipo-operacion") && scenario.template.templateId.includes("arrendamiento")
      ? /Arrendamiento de inmuebles/i
      : undefined,
    normalized.includes("forma-pago") ? /Contado/i : undefined,
    normalized.includes("instrumento") ? /Transferencia Interbancaria/i : undefined,
    normalized.includes("moneda") || normalized.includes("divisa") ? /Peso/i : undefined,
    normalized.includes("inmueble") || normalized.includes("bien") ? /Nave Industrial/i : undefined,
  ].filter(Boolean) as RegExp[]

  for (const pattern of preferred) {
    const option = options.find((item) => pattern.test(item))
    if (option) return option
  }

  return options.find((item) => item.trim()) || "1"
}

function toDisplayDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
}
