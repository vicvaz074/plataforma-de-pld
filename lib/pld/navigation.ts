export type PldNavigationKey =
  | "dashboard"
  | "registroSat"
  | "expedienteUnico"
  | "actividadesVulnerables"
  | "ebr"
  | "pepWhois"
  | "avisosInformes"
  | "capacitacionControl"
  | "auditoriaVerificacion"
  | "evidenciasTrazabilidad"
  | "gobernanzaControl"
  | "compiladoLeyes"
  | "alicia"

export type PldDashboardCategory = "configuracion" | "operacion" | "riesgo" | "evidencia" | "gobernanza"

export type PldNavigationItem = {
  key: PldNavigationKey
  href: string
  iconName:
    | "LayoutDashboard"
    | "FileCheck"
    | "Users"
    | "Shield"
    | "ClipboardCheck"
    | "UserSearch"
    | "FileText"
    | "GraduationCap"
    | "Search"
    | "Database"
    | "Settings"
    | "Book"
    | "Sparkles"
  title: {
    es: string
    en: string
  }
  description: {
    es: string
    en: string
  }
}

export type PldDashboardModule = PldNavigationItem & {
  category: PldDashboardCategory
  priority: 1 | 2 | 3
  adminRestricted: boolean
  tasks: Array<{
    id: string
    title: {
      es: string
      en: string
    }
  }>
}

export const APP_NAVIGATION_ITEMS: PldNavigationItem[] = [
  {
    key: "dashboard",
    iconName: "LayoutDashboard",
    href: "/dashboard",
    title: { es: "Panel de control", en: "Dashboard" },
    description: {
      es: "Vista ejecutiva de avance, pendientes y acceso rápido a los módulos PLD.",
      en: "Executive view of PLD progress, pending work and module shortcuts.",
    },
  },
  {
    key: "registroSat",
    iconName: "FileCheck",
    href: "/registro-sat",
    title: { es: "Alta y registro", en: "Onboarding and registration" },
    description: {
      es: "Alta SAT, folios, acuses, actividades vulnerables registradas y responsables.",
      en: "SAT onboarding, folios, acknowledgements, registered vulnerable activities and owners.",
    },
  },
  {
    key: "expedienteUnico",
    iconName: "Users",
    href: "/kyc-expediente",
    title: { es: "Expediente único de identificación", en: "Unique identification file" },
    description: {
      es: "KYC/EUI, documentación por tipo de persona, beneficiario controlador y actualización del expediente.",
      en: "KYC/UIC, documentation by person type, beneficial owner and file refresh.",
    },
  },
  {
    key: "actividadesVulnerables",
    iconName: "Shield",
    href: "/actividades-vulnerables",
    title: { es: "Actos y operaciones", en: "Acts and operations" },
    description: {
      es: "Registro guiado de operaciones, umbrales, acumulación, evidencia y salida SAT.",
      en: "Guided operation capture, thresholds, accumulation, evidence and SAT output.",
    },
  },
  {
    key: "ebr",
    iconName: "ClipboardCheck",
    href: "/ebr",
    title: { es: "Evaluación Basada en Riesgo (EBR)", en: "Risk-Based Evaluation (RBE)" },
    description: {
      es: "Riesgo inherente, controles mitigantes, riesgo residual, PEP/listas y plan de acción.",
      en: "Inherent risk, mitigating controls, residual risk, PEP/lists and action plan.",
    },
  },
  {
    key: "pepWhois",
    iconName: "UserSearch",
    href: "/pep-whois",
    title: { es: "WhoIs PEP", en: "WhoIs PEP" },
    description: {
      es: "Búsqueda PEP local-first, coincidencias familiares/asociados y decisiones humanas trazables.",
      en: "Local-first PEP search, family/associate matches and traceable human decisions.",
    },
  },
  {
    key: "avisosInformes",
    iconName: "FileText",
    href: "/avisos-informes",
    title: { es: "Avisos e informes", en: "Notices and reports" },
    description: {
      es: "Bandeja SAT para aviso normal, informe en ceros, 27 Bis, aviso 24h, XML, XLSM y acuses.",
      en: "SAT tray for ordinary notices, zero reports, 27 Bis, 24h notices, XML, XLSM and receipts.",
    },
  },
  {
    key: "capacitacionControl",
    iconName: "GraduationCap",
    href: "/capacitacion-control",
    title: { es: "Capacitación y Control Interno", en: "Training and Internal Control" },
    description: {
      es: "Plan anual, constancias, evidencias de capacitación y seguimiento de controles internos.",
      en: "Annual plan, certificates, training evidence and internal-control follow-up.",
    },
  },
  {
    key: "auditoriaVerificacion",
    iconName: "Search",
    href: "/auditoria-verificacion",
    title: { es: "Auditoría y Verificación Interna", en: "Audit and Internal Verification" },
    description: {
      es: "Programa de auditoría, hallazgos, matriz de cumplimiento, acciones correctivas y anexos.",
      en: "Audit program, findings, compliance matrix, corrective actions and annexes.",
    },
  },
  {
    key: "evidenciasTrazabilidad",
    iconName: "Database",
    href: "/evidencias-trazabilidad",
    title: { es: "Evidencias y Trazabilidad", en: "Evidence and Traceability" },
    description: {
      es: "Repositorio de evidencias, versiones, origen del documento, bitácora y trazabilidad por módulo.",
      en: "Evidence repository, versions, document origin, log and module-level traceability.",
    },
  },
  {
    key: "gobernanzaControl",
    iconName: "Settings",
    href: "/gobernanza-control",
    title: { es: "Gobernanza y Control Interno", en: "Governance and Internal Control" },
    description: {
      es: "Manual PLD, responsables, políticas, comité, controles, reportes internos y seguimiento.",
      en: "PLD manual, owners, policies, committee, controls, internal reports and follow-up.",
    },
  },
  {
    key: "compiladoLeyes",
    iconName: "Book",
    href: "/marco-normativo-aplicable",
    title: { es: "Marco Normativo Aplicable", en: "Applicable Legal Framework" },
    description: {
      es: "Normativa PLD, fuentes oficiales, UMA, criterios operativos y consulta regulatoria.",
      en: "PLD regulation, official sources, UMA, operating criteria and regulatory lookup.",
    },
  },
  {
    key: "alicia",
    iconName: "Sparkles",
    href: "/alicia",
    title: { es: "Alicia", en: "Alicia" },
    description: {
      es: "Asistente PLD para consultar el expediente, criterios, pendientes y próximos pasos.",
      en: "PLD assistant for file lookup, criteria, pending items and next steps.",
    },
  },
]

export const PLD_DASHBOARD_CATEGORIES: Array<{
  id: "todas" | PldDashboardCategory
  name: {
    es: string
    en: string
  }
  iconName: PldNavigationItem["iconName"]
}> = [
  { id: "todas", name: { es: "Todos", en: "All" }, iconName: "FileText" },
  { id: "configuracion", name: { es: "Configuración", en: "Setup" }, iconName: "FileCheck" },
  { id: "operacion", name: { es: "Operación SAT", en: "SAT operations" }, iconName: "Shield" },
  { id: "riesgo", name: { es: "Riesgo", en: "Risk" }, iconName: "ClipboardCheck" },
  { id: "evidencia", name: { es: "Evidencia", en: "Evidence" }, iconName: "Database" },
  { id: "gobernanza", name: { es: "Gobernanza", en: "Governance" }, iconName: "Settings" },
]

export const PLD_DASHBOARD_MODULES: PldDashboardModule[] = [
  {
    ...APP_NAVIGATION_ITEMS.find((item) => item.key === "registroSat")!,
    category: "configuracion",
    priority: 1,
    adminRestricted: true,
    tasks: [
      { id: "registro-sat-alta", title: { es: "Validar alta SAT y actividades registradas", en: "Validate SAT onboarding and registered activities" } },
      { id: "registro-sat-acuses", title: { es: "Cargar folios, acuses y representante", en: "Upload folios, receipts and representative" } },
      { id: "registro-sat-evidencia", title: { es: "Vincular evidencias al sujeto obligado", en: "Link evidence to the obligated party" } },
    ],
  },
  {
    ...APP_NAVIGATION_ITEMS.find((item) => item.key === "expedienteUnico")!,
    category: "configuracion",
    priority: 1,
    adminRestricted: true,
    tasks: [
      { id: "eui-identificacion", title: { es: "Completar datos de identificación del cliente", en: "Complete client identification data" } },
      { id: "eui-documentos", title: { es: "Revisar checklist documental por tipo de persona", en: "Review document checklist by person type" } },
      { id: "eui-beneficiario", title: { es: "Actualizar beneficiario controlador y representante", en: "Update beneficial owner and representative" } },
    ],
  },
  {
    ...APP_NAVIGATION_ITEMS.find((item) => item.key === "actividadesVulnerables")!,
    category: "operacion",
    priority: 1,
    adminRestricted: true,
    tasks: [
      { id: "actos-operacion", title: { es: "Registrar operación del periodo con formato SAT", en: "Register period operation with SAT format" } },
      { id: "actos-umbrales", title: { es: "Revisar umbral, acumulación y posible aviso", en: "Review threshold, accumulation and possible notice" } },
      { id: "actos-evidencia", title: { es: "Cerrar evidencia crítica o justificar pendiente", en: "Close critical evidence or justify pending items" } },
    ],
  },
  {
    ...APP_NAVIGATION_ITEMS.find((item) => item.key === "ebr")!,
    category: "riesgo",
    priority: 1,
    adminRestricted: true,
    tasks: [
      { id: "ebr-factores", title: { es: "Calificar factores cliente, actividad, canal y geografía", en: "Score client, activity, channel and geography factors" } },
      { id: "ebr-controles", title: { es: "Registrar controles mitigantes y riesgo residual", en: "Record mitigating controls and residual risk" } },
      { id: "ebr-plan", title: { es: "Documentar plan de mitigación", en: "Document mitigation plan" } },
    ],
  },
  {
    ...APP_NAVIGATION_ITEMS.find((item) => item.key === "pepWhois")!,
    category: "riesgo",
    priority: 1,
    adminRestricted: true,
    tasks: [
      { id: "pep-consulta", title: { es: "Consultar PEP por nombre y apellidos", en: "Run PEP screening by name and surnames" } },
      { id: "pep-familiares", title: { es: "Revisar coincidencias familiares o asociados", en: "Review family or associate matches" } },
      { id: "pep-decision", title: { es: "Guardar decisión humana y evidencia", en: "Save human decision and evidence" } },
    ],
  },
  {
    ...APP_NAVIGATION_ITEMS.find((item) => item.key === "avisosInformes")!,
    category: "operacion",
    priority: 1,
    adminRestricted: true,
    tasks: [
      { id: "avisos-paquetes", title: { es: "Revisar paquetes SAT calculados", en: "Review calculated SAT packages" } },
      { id: "avisos-xml-xlsm", title: { es: "Descargar XML, XLSM y ficha de captura", en: "Download XML, XLSM and capture sheet" } },
      { id: "avisos-acuse", title: { es: "Registrar folio y acuse del SPPLD", en: "Record SPPLD folio and receipt" } },
    ],
  },
  {
    ...APP_NAVIGATION_ITEMS.find((item) => item.key === "capacitacionControl")!,
    category: "gobernanza",
    priority: 2,
    adminRestricted: true,
    tasks: [
      { id: "capacitacion-plan", title: { es: "Programar plan anual de capacitación", en: "Schedule annual training plan" } },
      { id: "capacitacion-constancias", title: { es: "Cargar constancias y evaluaciones", en: "Upload certificates and evaluations" } },
      { id: "capacitacion-seguimiento", title: { es: "Revisar avance por responsable", en: "Review progress by owner" } },
    ],
  },
  {
    ...APP_NAVIGATION_ITEMS.find((item) => item.key === "auditoriaVerificacion")!,
    category: "gobernanza",
    priority: 2,
    adminRestricted: true,
    tasks: [
      { id: "auditoria-programa", title: { es: "Preparar programa y alcance de auditoría", en: "Prepare audit program and scope" } },
      { id: "auditoria-hallazgos", title: { es: "Registrar hallazgos y matriz de cumplimiento", en: "Record findings and compliance matrix" } },
      { id: "auditoria-acciones", title: { es: "Dar seguimiento a acciones correctivas", en: "Track corrective actions" } },
    ],
  },
  {
    ...APP_NAVIGATION_ITEMS.find((item) => item.key === "evidenciasTrazabilidad")!,
    category: "evidencia",
    priority: 1,
    adminRestricted: true,
    tasks: [
      { id: "evidencia-faltantes", title: { es: "Revisar documentos críticos faltantes", en: "Review missing critical documents" } },
      { id: "evidencia-versiones", title: { es: "Validar versiones, origen y responsable", en: "Validate versions, origin and owner" } },
      { id: "evidencia-bitacora", title: { es: "Auditar bitácora de trazabilidad", en: "Audit traceability log" } },
    ],
  },
  {
    ...APP_NAVIGATION_ITEMS.find((item) => item.key === "gobernanzaControl")!,
    category: "gobernanza",
    priority: 2,
    adminRestricted: true,
    tasks: [
      { id: "gobernanza-manual", title: { es: "Actualizar manual, políticas y responsables", en: "Update manual, policies and owners" } },
      { id: "gobernanza-comite", title: { es: "Registrar comité, reportes y acuerdos", en: "Record committee, reports and resolutions" } },
      { id: "gobernanza-controles", title: { es: "Verificar controles internos vigentes", en: "Verify active internal controls" } },
    ],
  },
  {
    ...APP_NAVIGATION_ITEMS.find((item) => item.key === "compiladoLeyes")!,
    category: "gobernanza",
    priority: 3,
    adminRestricted: false,
    tasks: [
      { id: "marco-fuentes", title: { es: "Confirmar fuentes oficiales vigentes", en: "Confirm current official sources" } },
      { id: "marco-uma", title: { es: "Revisar UMA, reglas y guías operativas", en: "Review UMA, rules and operating guides" } },
    ],
  },
  {
    ...APP_NAVIGATION_ITEMS.find((item) => item.key === "alicia")!,
    category: "gobernanza",
    priority: 3,
    adminRestricted: false,
    tasks: [
      { id: "alicia-consulta", title: { es: "Consultar pendientes y criterios PLD", en: "Ask for pending PLD items and criteria" } },
      { id: "alicia-evidencia", title: { es: "Usar respuestas como apoyo documental interno", en: "Use answers as internal documentation support" } },
    ],
  },
]
