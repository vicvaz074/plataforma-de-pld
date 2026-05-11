import type { DocumentRequirement, EvidenceChecklistEvaluation, OperacionEvidenceStatus } from "./types"

const RCG_URL = "https://wwwnp.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/Normateca/Nacional/LFPIORPI/RCG.pdf"

const COMMON_OPERATION_REQUIREMENTS: DocumentRequirement[] = [
  {
    id: "operacion-soporte",
    label: "Soporte del acto u operacion, contrato, instrumento o comprobante equivalente.",
    category: "operacion",
    critical: true,
    appliesTo: ["*"],
    source: "LFPIORPI art. 18 fr. IV y art. 24; RCG art. 24",
    requiresJustificationWhenMissing: true,
  },
  {
    id: "operacion-forma-pago",
    label: "Evidencia de forma de pago, liquidacion, cuenta origen/destino o medio utilizado.",
    category: "operacion",
    critical: true,
    appliesTo: ["*"],
    source: "LFPIORPI art. 18 fr. IV",
    requiresJustificationWhenMissing: true,
  },
  {
    id: "pep-ebr-declaracion",
    label: "Declaracion PEP/EBR y resultado de revision de cargo, listas o seguimiento reforzado.",
    category: "pep-ebr",
    critical: false,
    appliesTo: ["*"],
    source: "LFPIORPI art. 18 fr. VII, VIII y X",
    requiresJustificationWhenMissing: false,
  },
]

const REQUIREMENTS_BY_CLIENT_TYPE: Record<string, DocumentRequirement[]> = {
  pf_residente: [
    {
      id: "pf-identificacion-oficial",
      label: "Identificacion oficial vigente con fotografia, firma y domicilio cuando lo contenga.",
      category: "identificacion",
      critical: true,
      appliesTo: ["pf_residente"],
      source: "RCG Anexo 3, inciso b), numeral i)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "pf-curp-rfc",
      label: "CURP y RFC o cedula de identificacion fiscal, cuando cuente con ellas.",
      category: "fiscal",
      critical: true,
      appliesTo: ["pf_residente"],
      source: "RCG Anexo 3, inciso a), numeral ix) e inciso b), numeral ii)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "pf-domicilio",
      label: "Comprobante de domicilio menor a tres meses cuando no conste en la identificacion.",
      category: "domicilio",
      critical: true,
      appliesTo: ["pf_residente"],
      source: "RCG Anexo 3, inciso b), numeral iii)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "pf-beneficiario-controlador",
      label: "Constancia firmada sobre conocimiento de beneficiario controlador y, en su caso, identificacion.",
      category: "beneficiario-controlador",
      critical: true,
      appliesTo: ["pf_residente"],
      source: "RCG Anexo 3, inciso b), numeral iv)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "pf-poder-tercero",
      label: "Carta poder o instrumento notarial cuando actua como apoderado de otra persona.",
      category: "representacion",
      critical: false,
      appliesTo: ["pf_residente"],
      source: "RCG Anexo 3, inciso b), numeral v)",
      requiresJustificationWhenMissing: false,
    },
  ],
  pf_visitante: [
    {
      id: "pfv-pasaporte-documento",
      label: "Pasaporte o documento oficial extranjero vigente; documento migratorio cuando aplique.",
      category: "identificacion",
      critical: true,
      appliesTo: ["pf_visitante"],
      source: "RCG Anexo 5, inciso b), numeral i)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "pfv-domicilio",
      label: "Domicilio en el pais de residencia y domicilio en Mexico si recibe correspondencia.",
      category: "domicilio",
      critical: true,
      appliesTo: ["pf_visitante"],
      source: "RCG Anexo 5, inciso a), numeral vi)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "pfv-identificacion-fiscal",
      label: "Identificacion fiscal o documento equivalente cuando cuente con el.",
      category: "fiscal",
      critical: false,
      appliesTo: ["pf_visitante"],
      source: "RCG Anexo 5",
      requiresJustificationWhenMissing: false,
    },
    {
      id: "pfv-beneficiario-controlador",
      label: "Constancia de beneficiario controlador y documentacion de identificacion cuando exista.",
      category: "beneficiario-controlador",
      critical: true,
      appliesTo: ["pf_visitante"],
      source: "RCG art. 12, fr. VII y Anexo 5",
      requiresJustificationWhenMissing: true,
    },
  ],
  pm_mexicana: [
    {
      id: "pm-acta-constitutiva",
      label: "Acta constitutiva, testimonio o documento de existencia e inscripcion registral.",
      category: "identificacion",
      critical: true,
      appliesTo: ["pm_mexicana"],
      source: "RCG Anexo 4, inciso b), numeral i)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "pm-rfc-constancia",
      label: "RFC, cedula de identificacion fiscal o constancia de situacion fiscal.",
      category: "fiscal",
      critical: true,
      appliesTo: ["pm_mexicana"],
      source: "RCG Anexo 4, inciso a), numeral viii) e inciso b), numeral ii)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "pm-domicilio",
      label: "Comprobante de domicilio o constancia fiscal con domicilio vigente.",
      category: "domicilio",
      critical: true,
      appliesTo: ["pm_mexicana"],
      source: "RCG Anexo 4, inciso b), numeral iii)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "pm-poderes-representante",
      label: "Poderes notariales del representante, apoderado o persona que realiza la operacion.",
      category: "representacion",
      critical: true,
      appliesTo: ["pm_mexicana"],
      source: "RCG Anexo 4, inciso b), numeral iv)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "pm-identificacion-representante",
      label: "Identificacion oficial vigente del representante o apoderado.",
      category: "representacion",
      critical: true,
      appliesTo: ["pm_mexicana"],
      source: "RCG Anexo 4, inciso b), numeral iv)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "pm-beneficiario-controlador",
      label: "Declaracion de beneficiario controlador, estructura accionaria o control efectivo.",
      category: "beneficiario-controlador",
      critical: true,
      appliesTo: ["pm_mexicana"],
      source: "RCG Anexo 4, inciso b), numeral v)",
      requiresJustificationWhenMissing: true,
    },
  ],
  pm_extranjera: [
    {
      id: "pme-constitucion",
      label: "Documento que compruebe constitucion, representacion o establecimiento.",
      category: "identificacion",
      critical: true,
      appliesTo: ["pm_extranjera"],
      source: "RCG Anexo 6, inciso b), numeral i)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "pme-tax-id-rfc",
      label: "RFC o numero de identificacion fiscal extranjero cuando cuente con el.",
      category: "fiscal",
      critical: true,
      appliesTo: ["pm_extranjera"],
      source: "RCG Anexo 6, inciso b), numeral iv)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "pme-domicilio",
      label: "Comprobante de domicilio de la persona moral extranjera.",
      category: "domicilio",
      critical: true,
      appliesTo: ["pm_extranjera"],
      source: "RCG Anexo 6, inciso b), numeral ii)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "pme-poderes-identificacion",
      label: "Poder del representante e identificacion oficial vigente.",
      category: "representacion",
      critical: true,
      appliesTo: ["pm_extranjera"],
      source: "RCG Anexo 6, inciso b), numeral iii)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "pme-beneficiario-controlador",
      label: "Constancia y documentacion de beneficiario controlador.",
      category: "beneficiario-controlador",
      critical: true,
      appliesTo: ["pm_extranjera"],
      source: "RCG Anexo 6, inciso b), numeral v)",
      requiresJustificationWhenMissing: true,
    },
  ],
  organismo_internacional: [
    {
      id: "org-documento-establecimiento",
      label: "Documento de constitucion, representacion o establecimiento en Mexico.",
      category: "identificacion",
      critical: true,
      appliesTo: ["organismo_internacional"],
      source: "RCG Anexo 6 Bis, inciso b), numeral i)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "org-domicilio",
      label: "Domicilio, telefono y correo de la embajada, consulado u organismo.",
      category: "domicilio",
      critical: true,
      appliesTo: ["organismo_internacional"],
      source: "RCG Anexo 6 Bis, inciso a)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "org-representante",
      label: "Poder o documento de representacion e identificacion de quien actua.",
      category: "representacion",
      critical: true,
      appliesTo: ["organismo_internacional"],
      source: "RCG Anexo 6 Bis, inciso b), numeral iii)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "org-tax-id",
      label: "RFC o identificacion fiscal equivalente cuando cuente con ella.",
      category: "fiscal",
      critical: false,
      appliesTo: ["organismo_internacional"],
      source: "RCG Anexo 6 Bis, inciso b), numeral iv)",
      requiresJustificationWhenMissing: false,
    },
  ],
  pm_derecho_publico: [
    {
      id: "pub-existencia",
      label: "Documento que acredite legal existencia de la persona moral de derecho publico.",
      category: "identificacion",
      critical: true,
      appliesTo: ["pm_derecho_publico"],
      source: "RCG Anexo 4 Bis, inciso b), numeral i)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "pub-rfc",
      label: "RFC o cedula de identificacion fiscal cuando cuente con ella.",
      category: "fiscal",
      critical: true,
      appliesTo: ["pm_derecho_publico"],
      source: "RCG Anexo 4 Bis, inciso b), numeral ii)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "pub-domicilio",
      label: "Comprobante de domicilio institucional.",
      category: "domicilio",
      critical: true,
      appliesTo: ["pm_derecho_publico"],
      source: "RCG Anexo 4 Bis, inciso b), numeral iii)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "pub-facultades-servidor",
      label: "Nombramiento, facultades e identificacion del servidor publico que realiza la operacion.",
      category: "representacion",
      critical: true,
      appliesTo: ["pm_derecho_publico"],
      source: "RCG Anexo 4 Bis, inciso b), numeral iv)",
      requiresJustificationWhenMissing: true,
    },
  ],
  pm_derecho_publico_simplificado: [
    {
      id: "pub-simplificado-datos",
      label: "Nombre de la entidad, fecha de creacion o RFC y domicilio institucional.",
      category: "identificacion",
      critical: true,
      appliesTo: ["pm_derecho_publico_simplificado"],
      source: "RCG Anexo 7 Bis",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "pub-simplificado-funcionarios",
      label: "Nombre y fecha de nacimiento de funcionarios que realizan el acto u operacion.",
      category: "representacion",
      critical: true,
      appliesTo: ["pm_derecho_publico_simplificado"],
      source: "RCG Anexo 7 Bis",
      requiresJustificationWhenMissing: true,
    },
  ],
  fideicomiso: [
    {
      id: "fideicomiso-contrato",
      label: "Testimonio o copia certificada del instrumento que contiene la constitucion del fideicomiso.",
      category: "identificacion",
      critical: true,
      appliesTo: ["fideicomiso"],
      source: "RCG Anexo 8, inciso b), numeral i)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "fideicomiso-rfc",
      label: "Cedula de identificacion fiscal del fideicomiso, si cuenta con ella.",
      category: "fiscal",
      critical: true,
      appliesTo: ["fideicomiso"],
      source: "RCG Anexo 8, inciso b), numeral ii)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "fideicomiso-fiduciario-identificador",
      label: "Denominacion del fiduciario y numero, referencia o identificador del fideicomiso.",
      category: "identificacion",
      critical: true,
      appliesTo: ["fideicomiso"],
      source: "RCG Anexo 8, inciso a), numerales i) y ii)",
      requiresJustificationWhenMissing: true,
    },
    {
      id: "fideicomiso-poderes-delegado",
      label: "Poderes del apoderado o delegado fiduciario e identificacion oficial.",
      category: "representacion",
      critical: true,
      appliesTo: ["fideicomiso"],
      source: "RCG Anexo 8, inciso b), numeral iii)",
      requiresJustificationWhenMissing: true,
    },
  ],
}

const LEGACY_CLIENT_TYPE_MAP: Record<string, string> = {
  pfn: "pf_residente",
  pfe: "pf_visitante",
  pmn: "pm_mexicana",
  pme: "pm_extranjera",
  dependencia: "pm_derecho_publico",
  autoridad: "pm_derecho_publico",
  vehiculo: "pm_mexicana",
}

export function normalizeClienteTipoForEvidence(tipoCliente: string | undefined | null) {
  if (!tipoCliente) return "pf_residente"
  return LEGACY_CLIENT_TYPE_MAP[tipoCliente] ?? tipoCliente
}

export function getDocumentRequirementsForCliente(
  tipoCliente: string | undefined | null,
  actividadKey?: string,
): DocumentRequirement[] {
  const normalized = normalizeClienteTipoForEvidence(tipoCliente)
  const base = REQUIREMENTS_BY_CLIENT_TYPE[normalized] ?? REQUIREMENTS_BY_CLIENT_TYPE.pm_mexicana
  const requirements = actividadKey ? [...base, ...COMMON_OPERATION_REQUIREMENTS] : [...base]

  if (actividadKey?.startsWith("fraccion-xiv")) {
    requirements.push({
      id: "aduanal-pedimento-mercancia",
      label: "Pedimento, encargo conferido o documento aduanero que identifique mercancia y regimen.",
      category: "operacion",
      critical: true,
      appliesTo: [normalized],
      source: "LFPIORPI art. 17 fr. XIV",
      requiresJustificationWhenMissing: true,
      activityOverrides: ["fraccion-xiv"],
    })
  }

  return requirements
}

function isCompleted(requirement: DocumentRequirement, completed: Record<string, boolean> | undefined) {
  if (!completed) return false
  return Boolean(completed[requirement.id] ?? completed[requirement.label])
}

function getJustification(
  requirement: DocumentRequirement,
  justifications: Record<string, string> | undefined,
) {
  const text = justifications?.[requirement.id] ?? justifications?.[requirement.label] ?? ""
  return text.trim()
}

export function evaluateEvidenceChecklist(input: {
  requirements: DocumentRequirement[]
  completed?: Record<string, boolean>
  justifications?: Record<string, string>
}): EvidenceChecklistEvaluation {
  const missingCritical: DocumentRequirement[] = []
  const missingOptional: DocumentRequirement[] = []
  const acceptedJustifications: EvidenceChecklistEvaluation["justifications"] = []

  input.requirements.forEach((requirement) => {
    if (isCompleted(requirement, input.completed)) return

    const justification = getJustification(requirement, input.justifications)
    if (requirement.critical && requirement.requiresJustificationWhenMissing && justification.length >= 12) {
      acceptedJustifications.push({
        requirementId: requirement.id,
        label: requirement.label,
        justification,
      })
      return
    }

    if (requirement.critical) {
      missingCritical.push(requirement)
    } else {
      missingOptional.push(requirement)
    }
  })

  return {
    canSave: true,
    canClose: missingCritical.length === 0,
    missingCritical,
    missingOptional,
    justifications: acceptedJustifications,
    sourceNotes: [
      `Matriz documental derivada de RCG articulos 12, 17 y anexos 3, 4, 4 Bis, 5, 6, 6 Bis, 7 Bis y 8. Fuente: ${RCG_URL}`,
      "La evaluacion es de apoyo operativo; cumplimiento debe validar documentos originales o copias certificadas cuando aplique.",
    ],
    recommendedActions:
      missingCritical.length > 0
        ? [
            "Solicitar evidencia critica faltante antes de cerrar aviso, informe o expediente.",
            "Registrar justificacion temporal cuando el documento exista pero este pendiente de integracion.",
          ]
        : missingOptional.length > 0
          ? ["Cerrar con nota de seguimiento para evidencia opcional pendiente."]
          : ["Checklist documental listo para cierre interno."],
  }
}

export function buildChecklistFromRequirements(
  requirements: DocumentRequirement[],
  existing?: Record<string, boolean>,
): Record<string, boolean> {
  const checklist: Record<string, boolean> = {}

  requirements.forEach((requirement) => {
    checklist[requirement.label] = Boolean(existing?.[requirement.label] ?? existing?.[requirement.id])
  })

  return checklist
}

export function getOperacionEvidenceStatus(input: {
  tipoCliente: string
  actividadKey?: string
  completed?: Record<string, boolean>
  justifications?: Record<string, string>
}): OperacionEvidenceStatus {
  const requirements = getDocumentRequirementsForCliente(input.tipoCliente, input.actividadKey)
  const evaluation = evaluateEvidenceChecklist({
    requirements,
    completed: input.completed,
    justifications: input.justifications,
  })

  return {
    canSave: evaluation.canSave,
    canClose: evaluation.canClose,
    checklist: buildChecklistFromRequirements(requirements, input.completed),
    missingCriticalCount: evaluation.missingCritical.length,
    missingOptionalCount: evaluation.missingOptional.length,
    sourceNotes: evaluation.sourceNotes,
  }
}
