export type ExpedientePmDocumentChecklistStatus = "automatic" | "manual" | "missing"

export type ExpedientePmDocumentChecklistSource =
  | "captured-data"
  | "detected-document"
  | "manual-confirmation"
  | "none"

export type ExpedientePmDocumentId =
  | "formulario-identificacion-cliente"
  | "soporte-acto-operacion"
  | "existencia-persona-moral"
  | "inscripcion-registro-publico"
  | "constancia-situacion-fiscal"
  | "domicilio-cliente"
  | "poderes-representante"
  | "identificacion-representante"
  | "domicilio-representante"
  | "identificacion-beneficiario"
  | "curp-beneficiario"
  | "identificacion-fiscal-beneficiario"
  | "domicilio-beneficiario"

export interface ExpedientePmDocumentDefinition {
  id: ExpedientePmDocumentId
  label: string
  aliases: readonly string[]
  targetId?: string
}

export const EXPEDIENTE_PM_DOCUMENTS: readonly ExpedientePmDocumentDefinition[] = [
  {
    id: "formulario-identificacion-cliente",
    label: "Formulario de Identificación del Cliente",
    aliases: ["formulario_identificacion", "formulario-identificacion"],
    targetId: "cliente-denominacion",
  },
  {
    id: "soporte-acto-operacion",
    label: "Documento que acredita la celebración del Acto u Operación (contrato, factura, etc.)",
    aliases: ["operacion-soporte", "documento_acto_operacion", "soporte_acto_operacion"],
    targetId: "tipo-acto-operacion",
  },
  {
    id: "existencia-persona-moral",
    label: "Instrumento público que acredite la constitución del Cliente",
    aliases: ["acta_constitutiva", "acta-constitutiva", "pm-acta-constitutiva"],
  },
  {
    id: "inscripcion-registro-publico",
    label: "Constancia de inscripción en el Registro Público del instrumento que acredite su constitución",
    aliases: ["registro_publico", "registro-publico", "constancia_registro_publico"],
  },
  {
    id: "constancia-situacion-fiscal",
    label: "Constancia de Situación Fiscal (SAT)",
    aliases: ["constancia_fiscal", "situacion-fiscal", "pm-rfc-constancia"],
    targetId: "cliente-rfc",
  },
  {
    id: "domicilio-cliente",
    label: "Comprobante de domicilio del Cliente",
    aliases: ["comprobante_domicilio", "comprobante-domicilio", "pm-domicilio"],
    targetId: "domicilio-cliente-cp",
  },
  {
    id: "poderes-representante",
    label: "Instrumento que contenga los poderes del representante o apoderado legal",
    aliases: ["poder_representante", "poderes_representante", "pm-poderes-representante"],
    targetId: "representante-nombre",
  },
  {
    id: "identificacion-representante",
    label: "Identificación oficial del representante o apoderado legal",
    aliases: ["identificacion_representante", "pm-identificacion-representante"],
    targetId: "identificacion-representante-tipo",
  },
  {
    id: "domicilio-representante",
    label: "Comprobante de domicilio del representante o apoderado legal",
    aliases: ["comprobante_domicilio_representante", "domicilio_representante"],
    targetId: "domicilio-representante-cp",
  },
  {
    id: "identificacion-beneficiario",
    label: "Identificación oficial del Beneficiario Controlador",
    aliases: [
      "identificacion_beneficiario",
      "identificacion_beneficiario_controlador",
      "declaracion_beneficiario",
      "pm-beneficiario-controlador",
    ],
    targetId: "beneficiario-1-identificacion-tipo",
  },
  {
    id: "curp-beneficiario",
    label: "Constancia CURP (o equivalente) del Beneficiario Controlador",
    aliases: ["curp_beneficiario", "constancia_curp_beneficiario"],
    targetId: "beneficiario-1-curp",
  },
  {
    id: "identificacion-fiscal-beneficiario",
    label: "Cédula de Identificación Fiscal o NIF del Beneficiario Controlador",
    aliases: ["rfc_beneficiario", "nif_beneficiario", "cedula_fiscal_beneficiario"],
    targetId: "beneficiario-1-rfc",
  },
  {
    id: "domicilio-beneficiario",
    label: "Comprobante de domicilio del Beneficiario Controlador (si no coincide con la ID)",
    aliases: ["comprobante_domicilio_beneficiario", "domicilio_beneficiario"],
    targetId: "beneficiario-1-domicilio-cp",
  },
]

export interface ExpedienteChecklistAddress {
  codigoPostal?: string
  tipoVialidad?: string
  nombreVialidad?: string
  numeroExterior?: string
  colonia?: string
  alcaldia?: string
  entidad?: string
  pais?: string
}

export interface ExpedienteChecklistIdentification {
  tipo?: string
  numero?: string
  autoridad?: string
  vigencia?: string
}

export interface ExpedientePmDocumentChecklistInput {
  cliente?: {
    denominacion?: string
    fechaConstitucion?: string
    paisNacionalidad?: string
    rfc?: string
    nif?: string
    actividad?: string
  }
  tipoActoOperacion?: string
  fechaActoOperacion?: string
  domicilioCliente?: ExpedienteChecklistAddress
  representante?: {
    nombre?: string
    apellidoPaterno?: string
    rfc?: string
    cargo?: string
  }
  identificacionRepresentante?: ExpedienteChecklistIdentification
  domicilioRepresentante?: ExpedienteChecklistAddress
  beneficiario?: {
    nombres?: string
    apellidoPaterno?: string
    curp?: string
    rfc?: string
    nif?: string
    domicilio?: ExpedienteChecklistAddress
    identificacion?: ExpedienteChecklistIdentification
  }
  manual?: Record<string, unknown> | null
  detectedDocuments?: Record<string, unknown> | null
}

export type ExpedientePmDocumentManualState = Record<ExpedientePmDocumentId, boolean>

export interface ExpedientePmDocumentChecklistItem extends ExpedientePmDocumentDefinition {
  status: ExpedientePmDocumentChecklistStatus
  source: ExpedientePmDocumentChecklistSource
  sourceLabel: string
  valueSummary: string
  missingFields: string[]
  manualChecked: boolean
}

export interface ExpedientePmDocumentChecklistResult {
  items: ExpedientePmDocumentChecklistItem[]
  manualState: ExpedientePmDocumentManualState
  effectiveSnapshot: Record<string, boolean>
  summary: {
    total: number
    automatic: number
    manual: number
    missing: number
    progress: number
  }
  isComplete: boolean
  canSave: true
}

interface RequiredValue {
  label: string
  value: unknown
}

interface AutomaticEvaluation {
  complete: boolean
  valueSummary: string
  missingFields: string[]
}

const hasValue = (value: unknown) =>
  typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined

const normalizeLookupKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

const isCompletedValue = (value: unknown) => {
  if (value === true || value === 1) return true
  if (typeof value !== "string") return false
  return ["true", "completo", "completa", "presente", "integrado", "integrada"].includes(
    normalizeLookupKey(value),
  )
}

const definitionByLookupKey = new Map<string, ExpedientePmDocumentDefinition>()

EXPEDIENTE_PM_DOCUMENTS.forEach((definition) => {
  const lookupKeys = [definition.id, definition.label, ...definition.aliases]
  lookupKeys.forEach((key) => {
    definitionByLookupKey.set(normalizeLookupKey(key), definition)
  })
})

const emptyManualState = (): ExpedientePmDocumentManualState =>
  Object.fromEntries(EXPEDIENTE_PM_DOCUMENTS.map(({ id }) => [id, false])) as ExpedientePmDocumentManualState

export function normalizeExpedientePmDocumentManualState(
  raw: Record<string, unknown> | null | undefined,
): ExpedientePmDocumentManualState {
  const normalized = emptyManualState()
  if (!raw || typeof raw !== "object") return normalized

  Object.entries(raw).forEach(([key, value]) => {
    const definition = definitionByLookupKey.get(normalizeLookupKey(key))
    if (!definition) return
    normalized[definition.id] = normalized[definition.id] || isCompletedValue(value)
  })

  return normalized
}

const evaluateRequiredValues = (values: RequiredValue[], summaryValues = values): AutomaticEvaluation => {
  const missing = values.filter(({ value }) => !hasValue(value))
  return {
    complete: missing.length === 0,
    valueSummary:
      missing.length === 0
        ? summaryValues
            .map(({ value }) => (hasValue(value) ? String(value).trim() : ""))
            .filter(Boolean)
            .join(" · ")
        : "",
    missingFields: missing.map(({ label }) => label),
  }
}

const evaluateAddress = (address: ExpedienteChecklistAddress | undefined): AutomaticEvaluation => {
  const tipoVialidad =
    normalizeLookupKey(address?.tipoVialidad ?? "") === "otro" ? "" : address?.tipoVialidad

  return evaluateRequiredValues([
    { label: "Código postal", value: address?.codigoPostal },
    { label: "Tipo de vialidad", value: tipoVialidad },
    { label: "Nombre de la vialidad", value: address?.nombreVialidad },
    { label: "Número exterior", value: address?.numeroExterior },
    { label: "Colonia", value: address?.colonia },
    { label: "Alcaldía o municipio", value: address?.alcaldia },
    { label: "Entidad", value: address?.entidad },
    { label: "País", value: address?.pais },
  ])
}

const evaluateIdentification = (
  identification: ExpedienteChecklistIdentification | undefined,
): AutomaticEvaluation =>
  evaluateRequiredValues([
    { label: "Tipo de identificación", value: identification?.tipo },
    { label: "Número de identificación", value: identification?.numero },
    { label: "Autoridad emisora", value: identification?.autoridad },
    { label: "Vigencia", value: identification?.vigencia },
  ])

const evaluateAutomaticData = (
  id: ExpedientePmDocumentId,
  input: ExpedientePmDocumentChecklistInput,
): AutomaticEvaluation => {
  switch (id) {
    case "formulario-identificacion-cliente":
      return evaluateRequiredValues(
        [
          { label: "Denominación o razón social", value: input.cliente?.denominacion },
          { label: "Fecha de constitución", value: input.cliente?.fechaConstitucion },
          { label: "País", value: input.cliente?.paisNacionalidad },
          { label: "RFC o NIF", value: input.cliente?.rfc || input.cliente?.nif },
          { label: "Actividad o giro", value: input.cliente?.actividad },
        ],
        [
          { label: "Cliente", value: input.cliente?.denominacion },
          { label: "Identificador", value: input.cliente?.rfc || input.cliente?.nif },
          { label: "Actividad o giro", value: input.cliente?.actividad },
        ],
      )
    case "soporte-acto-operacion":
      return evaluateRequiredValues([
        { label: "Tipo de acto u operación", value: input.tipoActoOperacion },
        { label: "Fecha del acto u operación", value: input.fechaActoOperacion },
      ])
    case "constancia-situacion-fiscal":
      return evaluateRequiredValues([{ label: "RFC", value: input.cliente?.rfc }])
    case "domicilio-cliente":
      return evaluateAddress(input.domicilioCliente)
    case "poderes-representante":
      return evaluateRequiredValues([
        { label: "Nombre", value: input.representante?.nombre },
        { label: "Apellido paterno", value: input.representante?.apellidoPaterno },
        { label: "RFC o NIF", value: input.representante?.rfc },
        { label: "Puesto o cargo", value: input.representante?.cargo },
      ])
    case "identificacion-representante":
      return evaluateIdentification(input.identificacionRepresentante)
    case "domicilio-representante":
      return evaluateAddress(input.domicilioRepresentante)
    case "identificacion-beneficiario":
      return evaluateIdentification(input.beneficiario?.identificacion)
    case "curp-beneficiario":
      return evaluateRequiredValues([{ label: "CURP o equivalente", value: input.beneficiario?.curp }])
    case "identificacion-fiscal-beneficiario":
      return evaluateRequiredValues([
        { label: "RFC o NIF", value: input.beneficiario?.rfc || input.beneficiario?.nif },
      ])
    case "domicilio-beneficiario":
      return evaluateAddress(input.beneficiario?.domicilio)
    case "existencia-persona-moral":
    case "inscripcion-registro-publico":
      return {
        complete: false,
        valueSummary: "",
        missingFields: ["Confirmación o documento"],
      }
  }
}

export function buildExpedientePmDocumentationSnapshot(
  items: readonly ExpedientePmDocumentChecklistItem[],
  existing?: Record<string, unknown> | null,
): Record<string, boolean> {
  const snapshot: Record<string, boolean> = {}

  if (existing && typeof existing === "object") {
    Object.entries(existing).forEach(([key, value]) => {
      snapshot[key] = isCompletedValue(value)
    })
  }

  items.forEach((item) => {
    const complete = item.status !== "missing"
    snapshot[item.id] = complete
    snapshot[item.label] = complete
    item.aliases.forEach((alias) => {
      snapshot[alias] = complete
    })
  })

  return snapshot
}

export function evaluateExpedientePmDocumentChecklist(
  input: ExpedientePmDocumentChecklistInput,
): ExpedientePmDocumentChecklistResult {
  const manualState = normalizeExpedientePmDocumentManualState(input.manual)
  const detectedState = normalizeExpedientePmDocumentManualState(input.detectedDocuments)

  const items = EXPEDIENTE_PM_DOCUMENTS.map((definition): ExpedientePmDocumentChecklistItem => {
    const automaticData = evaluateAutomaticData(definition.id, input)
    const detectedDocument = detectedState[definition.id]
    const manualChecked = manualState[definition.id]

    if (detectedDocument) {
      return {
        ...definition,
        status: "automatic",
        source: "detected-document",
        sourceLabel: "Documento detectado",
        valueSummary: "Documento reconocido en el expediente.",
        missingFields: [],
        manualChecked,
      }
    }

    if (automaticData.complete) {
      return {
        ...definition,
        status: "automatic",
        source: "captured-data",
        sourceLabel: "Datos capturados",
        valueSummary: automaticData.valueSummary,
        missingFields: [],
        manualChecked,
      }
    }

    if (manualChecked) {
      return {
        ...definition,
        status: "manual",
        source: "manual-confirmation",
        sourceLabel: "Confirmación manual",
        valueSummary: "Confirmado manualmente como integrado.",
        missingFields: [],
        manualChecked: true,
      }
    }

    return {
      ...definition,
      status: "missing",
      source: "none",
      sourceLabel: "Pendiente",
      valueSummary: "",
      missingFields: automaticData.missingFields,
      manualChecked: false,
    }
  })

  const automatic = items.filter(({ status }) => status === "automatic").length
  const manual = items.filter(({ status }) => status === "manual").length
  const missing = items.filter(({ status }) => status === "missing").length
  const completed = automatic + manual

  return {
    items,
    manualState,
    effectiveSnapshot: buildExpedientePmDocumentationSnapshot(items, input.manual),
    summary: {
      total: items.length,
      automatic,
      manual,
      missing,
      progress: items.length === 0 ? 100 : Math.round((completed / items.length) * 100),
    },
    isComplete: missing === 0,
    canSave: true,
  }
}
