export const LEGAL_SOURCE_REVIEWED_AT = "2026-05-14"

export type NormativeSector =
  | "Actividades Vulnerables"
  | "Sistema financiero"
  | "Legislacion secundaria"
  | "Internacional"

export type NormativeAuthority =
  | "SAT/SPPLD"
  | "SHCP/UIF"
  | "Congreso/DOF"
  | "CNBV"
  | "CNSF"
  | "CONSAR"
  | "GAFI/ONU"

export type NormativeHierarchy =
  | "Ley"
  | "Reglamento"
  | "Reglas"
  | "Resolucion"
  | "Criterio"
  | "Guia"
  | "Portal oficial"
  | "Disposiciones sectoriales"
  | "Referencia internacional"

export type NormativeStatus =
  | "vigente"
  | "reformado"
  | "pendiente_rcg"
  | "criterio_sat"
  | "referencia_sectorial"
  | "internacional"

export type OperationalStatus = "vigente" | "parcial" | "pendiente_rcg" | "referencia"

export interface NormativeDocument {
  id: string
  title: string
  authority: NormativeAuthority
  sector: NormativeSector
  hierarchy: NormativeHierarchy
  status: NormativeStatus
  publishedAt?: string
  lastReform?: string
  reviewedAt: string
  url: string
  summary: string
  operationalImpact: string
  tags: string[]
  relatedModules: string[]
}

export interface NormativeObligation {
  id: string
  module: string
  moduleHref: string
  obligation: string
  foundation: string
  sourceDocumentIds: string[]
  status: OperationalStatus
  impact: string
  tags: string[]
}

export interface NormativeUpdate {
  id: string
  date: string
  title: string
  source: string
  sourceUrl: string
  impact: string
  status: NormativeStatus
  tags: string[]
}

export interface LegalFrameworkFilters {
  query?: string
  sector?: NormativeSector | "todos"
  authority?: NormativeAuthority | "todos"
  status?: NormativeStatus | "todos"
}

const reviewedAt = LEGAL_SOURCE_REVIEWED_AT

export const LEGAL_SECTORS: NormativeSector[] = [
  "Actividades Vulnerables",
  "Sistema financiero",
  "Legislacion secundaria",
  "Internacional",
]

export const LEGAL_AUTHORITIES: NormativeAuthority[] = [
  "SAT/SPPLD",
  "SHCP/UIF",
  "Congreso/DOF",
  "CNBV",
  "CNSF",
  "CONSAR",
  "GAFI/ONU",
]

export const LEGAL_STATUSES: NormativeStatus[] = [
  "vigente",
  "reformado",
  "pendiente_rcg",
  "criterio_sat",
  "referencia_sectorial",
  "internacional",
]

export const normativeDocuments: NormativeDocument[] = [
  {
    id: "sat-normateca-av",
    title: "Normateca SAT de Actividades Vulnerables",
    authority: "SAT/SPPLD",
    sector: "Actividades Vulnerables",
    hierarchy: "Portal oficial",
    status: "vigente",
    reviewedAt,
    url: "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/normateca.html",
    summary: "Indice oficial SAT con leyes, reglamentos, reglas, resoluciones, guias, listas y material de apoyo para Actividades Vulnerables.",
    operationalImpact: "Fuente de control para validar si una guia, formato, criterio o enlace oficial sigue vigente antes de modificar reglas de la plataforma.",
    tags: ["normateca", "SAT", "Actividades Vulnerables", "guias", "formatos"],
    relatedModules: ["Marco normativo", "Actos y Operaciones", "Avisos e Informes"],
  },
  {
    id: "lfpiorpi-vigente",
    title: "Ley Federal para la Prevencion e Identificacion de Operaciones con Recursos de Procedencia Ilicita",
    authority: "Congreso/DOF",
    sector: "Actividades Vulnerables",
    hierarchy: "Ley",
    status: "reformado",
    publishedAt: "2012-10-17",
    lastReform: "2025-07-16",
    reviewedAt,
    url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPIORPI.pdf",
    summary: "Ley marco de PLD para Actividades Vulnerables; contiene el articulo 17, obligaciones del articulo 18, avisos, restricciones, sanciones y beneficiario controlador.",
    operationalImpact: "Define la base juridica para alta SAT, EUI, actos, avisos, evidencias, PEP, beneficiario controlador y sanciones.",
    tags: ["LFPIORPI", "articulo 17", "articulo 18", "beneficiario controlador", "PEP"],
    relatedModules: ["Registro SAT", "KYC/EUI", "Actos y Operaciones", "Beneficiario Controlador", "Avisos e Informes"],
  },
  {
    id: "dof-reforma-lfpiorpi-2025",
    title: "Decreto DOF 16/07/2025 que reforma la LFPIORPI y el Codigo Penal Federal",
    authority: "Congreso/DOF",
    sector: "Actividades Vulnerables",
    hierarchy: "Ley",
    status: "reformado",
    publishedAt: "2025-07-16",
    lastReform: "2025-07-16",
    reviewedAt,
    url: "https://www.dof.gob.mx/nota_detalle.php?codigo=5763161&fecha=16/07/2025",
    summary: "Reforma amplia que ajusta Actividades Vulnerables, beneficiario controlador, obligaciones del articulo 18, sanciones y articulo 400 Bis del CPF.",
    operationalImpact: "Debe mostrarse como cambio reciente y marcar obligaciones que dependen de Reglas de Caracter General actualizadas.",
    tags: ["reforma 2025", "400 Bis", "V Bis", "articulo 18", "sanciones"],
    relatedModules: ["Marco normativo", "Actos y Operaciones", "EBR", "Gobernanza"],
  },
  {
    id: "reglamento-lfpiorpi-2026",
    title: "Reglamento de la LFPIORPI reformado",
    authority: "Congreso/DOF",
    sector: "Actividades Vulnerables",
    hierarchy: "Reglamento",
    status: "reformado",
    lastReform: "2026-03-27",
    reviewedAt,
    url: "https://www.dof.gob.mx/nota_detalle.php?codigo=5783547&fecha=27/03/2026",
    summary: "Reforma reglamentaria 2026 que actualiza definiciones, obligaciones, visitas, uso de medios electronicos y agrega capitulo sobre personas politicamente expuestas.",
    operationalImpact: "Impacta PEP, visitas/verificacion, funciones de autoridades, controles internos, EUI y evidencias.",
    tags: ["Reglamento", "reforma 2026", "PEP", "visitas", "medios electronicos"],
    relatedModules: ["WhoIs PEP", "Auditoria", "Evidencias", "Gobernanza"],
  },
  {
    id: "rcg-lfpiorpi",
    title: "Reglas de Caracter General de la LFPIORPI",
    authority: "SAT/SPPLD",
    sector: "Actividades Vulnerables",
    hierarchy: "Reglas",
    status: "pendiente_rcg",
    reviewedAt,
    url: "https://wwwnp.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/Normateca/Nacional/LFPIORPI/RCG.pdf",
    summary: "Reglas operativas para alta, expedientes, anexos documentales, acumulacion, avisos, informes, 27 Bis y resguardo.",
    operationalImpact: "Fuente primaria para checklists documentales, acumulacion de seis meses, informes en ceros, 27 Bis y conservacion.",
    tags: ["RCG", "anexos", "acumulacion", "27 Bis", "informe en ceros"],
    relatedModules: ["KYC/EUI", "Actos y Operaciones", "Avisos e Informes", "Evidencias"],
  },
  {
    id: "resolucion-alta-registro",
    title: "Resolucion del formato oficial para alta y registro de Actividades Vulnerables",
    authority: "SAT/SPPLD",
    sector: "Actividades Vulnerables",
    hierarchy: "Resolucion",
    status: "vigente",
    reviewedAt,
    url: "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/normateca.html",
    summary: "Regula el formato y proceso de alta y registro de quienes realizan Actividades Vulnerables.",
    operationalImpact: "Soporta el modulo de Registro SAT, folios, acuses y vinculacion del sujeto obligado con sus actividades.",
    tags: ["alta", "registro", "SPPLD", "sujeto obligado"],
    relatedModules: ["Registro SAT", "Gobernanza"],
  },
  {
    id: "resolucion-avisos-informes",
    title: "Resolucion de formatos oficiales de avisos e informes",
    authority: "SAT/SPPLD",
    sector: "Actividades Vulnerables",
    hierarchy: "Resolucion",
    status: "vigente",
    reviewedAt,
    url: "https://wwwnp.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/Normateca/Nacional/LFPIORPI/ResolucionAvisoseInformes.pdf",
    summary: "Define anexos, estructura XML, campos obligatorios y formatos oficiales para avisos e informes por fraccion.",
    operationalImpact: "Fuente de verdad para XLSM/XML SAT, validacion de campos y descarga de paquetes de aviso.",
    tags: ["XML", "XLSM", "avisos", "informes", "SAT"],
    relatedModules: ["Actos y Operaciones", "Avisos e Informes"],
  },
  {
    id: "sppld-criterios",
    title: "Criterios y preguntas frecuentes SPPLD",
    authority: "SAT/SPPLD",
    sector: "Actividades Vulnerables",
    hierarchy: "Criterio",
    status: "criterio_sat",
    reviewedAt,
    url: "https://sppld.sat.gob.mx/pld/interiores/criterios.html",
    summary: "Criterios operativos SAT/SPPLD sobre reforma LFPIORPI, V Bis, fraccion XII, alta, avisos y obligaciones condicionadas a nuevas RCG.",
    operationalImpact: "Debe usarse para notas de vigencia, warnings normativos y explicaciones de criterios en UI.",
    tags: ["criterio SAT", "V Bis", "fraccion XII", "pendiente RCG", "2025"],
    relatedModules: ["Actos y Operaciones", "Avisos e Informes", "Marco normativo"],
  },
  {
    id: "sat-identificacion-eui",
    title: "Identificacion de cliente o usuario y Expediente Unico de Identificacion",
    authority: "SAT/SPPLD",
    sector: "Actividades Vulnerables",
    hierarchy: "Guia",
    status: "vigente",
    reviewedAt,
    url: "https://wwwmat.sat.gob.mx/consulta/49899/identifica-a-tu-cliente-o-usuario-y-cumple-con-la-lfpiorpi-",
    summary: "Guia SAT sobre integracion y conservacion del EUI, anexos documentales y verificacion en listas oficiales.",
    operationalImpact: "Base para checklist documental por tipo de persona, listas, beneficiario controlador y bloqueo de cierre.",
    tags: ["EUI", "KYC", "anexos 3-8", "listas", "beneficiario controlador"],
    relatedModules: ["KYC/EUI", "Beneficiario Controlador", "Evidencias"],
  },
  {
    id: "sppld-preguntas",
    title: "Preguntas frecuentes SPPLD",
    authority: "SAT/SPPLD",
    sector: "Actividades Vulnerables",
    hierarchy: "Criterio",
    status: "criterio_sat",
    reviewedAt,
    url: "https://sppld.sat.gob.mx/pld/interiores/preguntas.html",
    summary: "Preguntas frecuentes sobre avisos, DECLARANOT, acumulacion, informe en ceros, conservacion y coexistencia de actividades.",
    operationalImpact: "Ayuda a explicar salidas SAT, acumulacion, informe en ceros, conservacion por 10 anos y reglas por fraccion.",
    tags: ["preguntas frecuentes", "conservacion 10 anos", "informe en ceros", "acumulacion", "DECLARANOT"],
    relatedModules: ["Actos y Operaciones", "Avisos e Informes", "Evidencias"],
  },
  {
    id: "guia-acumulacion-2026",
    title: "Guia SAT de acumulacion para presentacion de avisos 2026",
    authority: "SAT/SPPLD",
    sector: "Actividades Vulnerables",
    hierarchy: "Guia",
    status: "criterio_sat",
    reviewedAt,
    url: "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/GuiaAcumulacionPresentacionAvisos2026.pdf",
    summary: "Guia operativa para acumulacion de actos u operaciones y presentacion de avisos durante 2026.",
    operationalImpact: "Se usa como fuente secundaria junto con RCG art. 19 para explicar acumulacion y advertencias normativas.",
    tags: ["acumulacion", "avisos", "2026", "RCG art. 19"],
    relatedModules: ["Actos y Operaciones", "Avisos e Informes"],
  },
  {
    id: "guia-27-bis",
    title: "Presentacion de informes por articulo 27 Bis",
    authority: "SAT/SPPLD",
    sector: "Actividades Vulnerables",
    hierarchy: "Guia",
    status: "vigente",
    reviewedAt,
    url: "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/normateca.html",
    summary: "Guia SAT para identificar y presentar informes por supuestos de excepcion conforme al articulo 27 Bis de RCG.",
    operationalImpact: "Base de la salida SAT informe 27 Bis y su trazabilidad de justificacion.",
    tags: ["27 Bis", "informes", "excepcion", "grupo empresarial"],
    relatedModules: ["Avisos e Informes", "Actos y Operaciones"],
  },
  {
    id: "restriccion-efectivo-metales",
    title: "Restriccion de uso de efectivo y metales",
    authority: "SAT/SPPLD",
    sector: "Actividades Vulnerables",
    hierarchy: "Guia",
    status: "vigente",
    reviewedAt,
    url: "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/normateca.html",
    summary: "Material SAT sobre restricciones aplicables a pagos con efectivo, divisas y metales en operaciones vulnerables.",
    operationalImpact: "Debe conectarse con Actos, forma de pago, alertas, EBR y evidencia de liquidacion.",
    tags: ["efectivo", "metales", "restriccion", "forma de pago"],
    relatedModules: ["Actos y Operaciones", "EBR", "Evidencias"],
  },
  {
    id: "manual-lineamientos-identificacion",
    title: "Manual de lineamientos de identificacion de clientes o usuarios y relacion de negocios",
    authority: "SAT/SPPLD",
    sector: "Actividades Vulnerables",
    hierarchy: "Guia",
    status: "vigente",
    reviewedAt,
    url: "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/normateca.html",
    summary: "Guia SAT para procedimientos de identificacion, conocimiento del cliente y relacion de negocios.",
    operationalImpact: "Soporta politicas de EUI, debida diligencia, actualizacion periodica y resguardo documental.",
    tags: ["identificacion", "relacion de negocios", "EUI", "debida diligencia"],
    relatedModules: ["KYC/EUI", "Gobernanza", "Auditoria"],
  },
  {
    id: "enr-2023-uif",
    title: "Evaluacion Nacional de Riesgos 2023",
    authority: "SHCP/UIF",
    sector: "Sistema financiero",
    hierarchy: "Guia",
    status: "referencia_sectorial",
    publishedAt: "2023-00-00",
    reviewedAt,
    url: "https://www.pld.hacienda.gob.mx/work/models/PLD/documentos/enr2023.pdf",
    summary: "Diagnostico nacional de riesgos de lavado de dinero, financiamiento al terrorismo y vulnerabilidades del regimen PLD/CFT.",
    operationalImpact: "Referencia para metodologia EBR, factores de riesgo, controles mitigantes y auditoria.",
    tags: ["ENR 2023", "UIF", "riesgo", "EBR"],
    relatedModules: ["EBR", "Auditoria", "Gobernanza"],
  },
  {
    id: "guia-cnbv-ebr",
    title: "Guia CNBV para metodologia de evaluacion de riesgos PLD/FT",
    authority: "CNBV",
    sector: "Sistema financiero",
    hierarchy: "Guia",
    status: "referencia_sectorial",
    reviewedAt,
    url: "https://www.gob.mx/cnbv/articulos/guia-para-la-elaboracion-de-una-metodologia-de-evaluacion-de-riesgos-en-materia-de-pld-ft-109268?idiom=es",
    summary: "Criterios para identificar, medir y mitigar riesgos de LD/FT en sujetos supervisados por CNBV.",
    operationalImpact: "Referencia metodologica para EBR aun cuando el foco operativo sean Actividades Vulnerables.",
    tags: ["CNBV", "EBR", "metodologia", "riesgo"],
    relatedModules: ["EBR", "Auditoria"],
  },
  {
    id: "codigo-penal-federal-pld",
    title: "Codigo Penal Federal: operaciones con recursos de procedencia ilicita y terrorismo",
    authority: "Congreso/DOF",
    sector: "Legislacion secundaria",
    hierarchy: "Ley",
    status: "vigente",
    reviewedAt,
    url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/CPF.pdf",
    summary: "Incluye tipos penales relevantes como articulo 400 Bis y disposiciones relacionadas con terrorismo y financiamiento.",
    operationalImpact: "Referencia sancionatoria y conceptual para alertas, auditoria y capacitacion.",
    tags: ["400 Bis", "terrorismo", "financiamiento al terrorismo", "CPF"],
    relatedModules: ["Capacitacion", "Auditoria", "EBR"],
  },
  {
    id: "lfpdppp",
    title: "Ley Federal de Proteccion de Datos Personales en Posesion de los Particulares",
    authority: "Congreso/DOF",
    sector: "Legislacion secundaria",
    hierarchy: "Ley",
    status: "vigente",
    reviewedAt,
    url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf",
    summary: "Regula tratamiento de datos personales por particulares, relevante para expedientes, evidencias, PEP y auditoria.",
    operationalImpact: "Debe considerarse en carga documental, retencion, accesos, consentimiento y seguridad de datos.",
    tags: ["datos personales", "expedientes", "evidencias", "privacidad"],
    relatedModules: ["KYC/EUI", "Evidencias", "WhoIs PEP"],
  },
  {
    id: "ley-instituciones-credito",
    title: "Ley de Instituciones de Credito, articulo 115",
    authority: "Congreso/DOF",
    sector: "Sistema financiero",
    hierarchy: "Ley",
    status: "referencia_sectorial",
    reviewedAt,
    url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LIC.pdf",
    summary: "Base legal PLD/FT para instituciones de credito y sujetos regulados del sector bancario.",
    operationalImpact: "Referencia sectorial para banca y controles de debida diligencia reforzada.",
    tags: ["banca", "LIC", "articulo 115", "CNBV"],
    relatedModules: ["EBR", "Gobernanza"],
  },
  {
    id: "dcg-instituciones-credito",
    title: "Disposiciones PLD aplicables a instituciones de credito",
    authority: "CNBV",
    sector: "Sistema financiero",
    hierarchy: "Disposiciones sectoriales",
    status: "referencia_sectorial",
    reviewedAt,
    url: "https://www.cnbv.gob.mx/Normatividad/Disposiciones%20de%20car%C3%A1cter%20general%20aplicables%20a%20las%20instituciones%20de%20cr%C3%A9dito.pdf",
    summary: "Disposiciones de caracter general para controles PLD/FT del sector bancario.",
    operationalImpact: "Referencia de gobierno, monitoreo, reportes, listas, PEP y debida diligencia reforzada.",
    tags: ["banca", "DCG", "CNBV", "PLD/FT"],
    relatedModules: ["EBR", "Gobernanza", "Auditoria"],
  },
  {
    id: "ley-mercado-valores",
    title: "Ley del Mercado de Valores, articulos 212 y 226 Bis",
    authority: "Congreso/DOF",
    sector: "Sistema financiero",
    hierarchy: "Ley",
    status: "referencia_sectorial",
    reviewedAt,
    url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LMV.pdf",
    summary: "Base legal PLD/FT para casas de bolsa y participantes del mercado de valores.",
    operationalImpact: "Referencia sectorial para catalogo normativo financiero y obligaciones comparables de riesgo.",
    tags: ["casas de bolsa", "valores", "LMV", "CNBV"],
    relatedModules: ["EBR", "Auditoria"],
  },
  {
    id: "dcg-casas-bolsa",
    title: "Disposiciones PLD para casas de bolsa",
    authority: "CNBV",
    sector: "Sistema financiero",
    hierarchy: "Disposiciones sectoriales",
    status: "referencia_sectorial",
    reviewedAt,
    url: "https://www.dof.gob.mx/nota_detalle.php?codigo=5158508&fecha=09/09/2010",
    summary: "Disposiciones de caracter general emitidas para casas de bolsa en materia PLD/FT.",
    operationalImpact: "Referencia sectorial para matriz de riesgos, monitoreo y reportes.",
    tags: ["casas de bolsa", "DCG", "valores", "CNBV"],
    relatedModules: ["EBR", "Auditoria"],
  },
  {
    id: "ley-fondos-inversion",
    title: "Ley de Fondos de Inversion, articulo 91",
    authority: "Congreso/DOF",
    sector: "Sistema financiero",
    hierarchy: "Ley",
    status: "referencia_sectorial",
    reviewedAt,
    url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LFI.pdf",
    summary: "Base legal para obligaciones PLD/FT de fondos de inversion.",
    operationalImpact: "Referencia sectorial para cobertura del sistema financiero.",
    tags: ["fondos de inversion", "LFI", "CNBV"],
    relatedModules: ["EBR", "Gobernanza"],
  },
  {
    id: "dcg-fondos-inversion",
    title: "Disposiciones PLD para fondos de inversion",
    authority: "CNBV",
    sector: "Sistema financiero",
    hierarchy: "Disposiciones sectoriales",
    status: "referencia_sectorial",
    reviewedAt,
    url: "https://www.dof.gob.mx/nota_detalle.php?codigo=5377886&fecha=31/12/2014",
    summary: "Disposiciones de caracter general a que se refiere el articulo 91 de la Ley de Fondos de Inversion.",
    operationalImpact: "Referencia sectorial para metodologia, reportes, listas y controles.",
    tags: ["fondos de inversion", "DCG", "CNBV"],
    relatedModules: ["EBR", "Auditoria"],
  },
  {
    id: "lgoaac-95bis",
    title: "Ley General de Organizaciones y Actividades Auxiliares del Credito, articulo 95 Bis",
    authority: "Congreso/DOF",
    sector: "Sistema financiero",
    hierarchy: "Ley",
    status: "referencia_sectorial",
    reviewedAt,
    url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LGOAAC.pdf",
    summary: "Base legal PLD para SOFOM, centros cambiarios, transmisores de dinero y otros auxiliares de credito.",
    operationalImpact: "Referencia sectorial para cobertura de auxiliares de credito en el marco normativo.",
    tags: ["SOFOM", "centros cambiarios", "transmisores de dinero", "LGOAAC"],
    relatedModules: ["EBR", "Gobernanza"],
  },
  {
    id: "dcg-sofom",
    title: "Disposiciones PLD para SOFOM",
    authority: "CNBV",
    sector: "Sistema financiero",
    hierarchy: "Disposiciones sectoriales",
    status: "referencia_sectorial",
    reviewedAt,
    url: "https://www.dof.gob.mx/nota_detalle.php?codigo=5182183&fecha=17/03/2011",
    summary: "Disposiciones de caracter general aplicables a sociedades financieras de objeto multiple en materia PLD/FT.",
    operationalImpact: "Referencia sectorial para controles, reportes, oficial de cumplimiento y auditoria.",
    tags: ["SOFOM", "CNBV", "DCG", "95 Bis"],
    relatedModules: ["EBR", "Auditoria", "Gobernanza"],
  },
  {
    id: "dcg-transmisores-dinero",
    title: "Disposiciones PLD para transmisores de dinero",
    authority: "CNBV",
    sector: "Sistema financiero",
    hierarchy: "Disposiciones sectoriales",
    status: "referencia_sectorial",
    reviewedAt,
    url: "https://www.dof.gob.mx/nota_detalle.php?codigo=5242565&fecha=10/04/2012",
    summary: "Disposiciones PLD/FT para transmisores de dinero conforme a LGOAAC.",
    operationalImpact: "Referencia sectorial para monitoreo de operaciones y reportes financieros.",
    tags: ["transmisores de dinero", "CNBV", "DCG"],
    relatedModules: ["EBR", "Auditoria"],
  },
  {
    id: "dcg-centros-cambiarios",
    title: "Disposiciones PLD para centros cambiarios",
    authority: "CNBV",
    sector: "Sistema financiero",
    hierarchy: "Disposiciones sectoriales",
    status: "referencia_sectorial",
    reviewedAt,
    url: "https://www.dof.gob.mx/nota_detalle.php?codigo=5242564&fecha=10/04/2012",
    summary: "Disposiciones PLD/FT para centros cambiarios conforme a LGOAAC.",
    operationalImpact: "Referencia sectorial para efectivo, divisas, clientes, listas y reportes.",
    tags: ["centros cambiarios", "divisas", "CNBV", "DCG"],
    relatedModules: ["EBR", "Auditoria"],
  },
  {
    id: "ley-uniones-credito",
    title: "Ley de Uniones de Credito, articulo 129",
    authority: "Congreso/DOF",
    sector: "Sistema financiero",
    hierarchy: "Ley",
    status: "referencia_sectorial",
    reviewedAt,
    url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LUC.pdf",
    summary: "Base legal PLD/FT aplicable a uniones de credito.",
    operationalImpact: "Referencia sectorial para cobertura financiera y controles de riesgo.",
    tags: ["uniones de credito", "LUC", "CNBV"],
    relatedModules: ["EBR", "Gobernanza"],
  },
  {
    id: "ley-ahorro-credito-popular",
    title: "Ley de Ahorro y Credito Popular, articulo 124",
    authority: "Congreso/DOF",
    sector: "Sistema financiero",
    hierarchy: "Ley",
    status: "referencia_sectorial",
    reviewedAt,
    url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LACP.pdf",
    summary: "Base legal PLD/FT para SOFIPO, SOFINCO y sector de ahorro y credito popular.",
    operationalImpact: "Referencia sectorial para SOFIPO/SOCAP y entidades populares.",
    tags: ["SOFIPO", "SOCAP", "LACP", "sector popular"],
    relatedModules: ["EBR", "Gobernanza"],
  },
  {
    id: "cnbv-sector-popular",
    title: "Disposiciones legales para SOFIPO, SOFINCO y organismos de integracion financiera rural",
    authority: "CNBV",
    sector: "Sistema financiero",
    hierarchy: "Disposiciones sectoriales",
    status: "referencia_sectorial",
    reviewedAt,
    url: "https://www.gob.mx/cnbv/acciones-y-programas/disposiciones-legales-sofipos-sofincos-y-organismos-de-integracion-financiera-rural",
    summary: "Compilado CNBV de disposiciones aplicables al sector popular, incluidas referencias PLD/FT.",
    operationalImpact: "Referencia sectorial para SOFIPO/SOCAP y cumplimiento financiero.",
    tags: ["SOFIPO", "SOCAP", "CNBV", "sector popular"],
    relatedModules: ["EBR", "Auditoria"],
  },
  {
    id: "ley-fintech",
    title: "Ley para Regular las Instituciones de Tecnologia Financiera, articulo 58",
    authority: "Congreso/DOF",
    sector: "Sistema financiero",
    hierarchy: "Ley",
    status: "referencia_sectorial",
    reviewedAt,
    url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LRITF.pdf",
    summary: "Base legal PLD/FT para instituciones de tecnologia financiera.",
    operationalImpact: "Referencia sectorial para fintech, activos virtuales y modelos digitales.",
    tags: ["fintech", "ITF", "LRITF", "activos virtuales"],
    relatedModules: ["EBR", "Gobernanza"],
  },
  {
    id: "dcg-fintech",
    title: "Disposiciones PLD para Instituciones de Tecnologia Financiera",
    authority: "CNBV",
    sector: "Sistema financiero",
    hierarchy: "Disposiciones sectoriales",
    status: "referencia_sectorial",
    reviewedAt,
    url: "https://www.gob.mx/cms/uploads/attachment/file/909810/DCG_Instituciones_de_Tecnolog_a_Financiera__2018.pdf",
    summary: "Disposiciones de caracter general a que se refiere el articulo 58 de la Ley Fintech.",
    operationalImpact: "Referencia sectorial para KYC digital, riesgo tecnologico, listas y reportes.",
    tags: ["fintech", "ITF", "CNBV", "activos virtuales"],
    relatedModules: ["EBR", "WhoIs PEP", "Auditoria"],
  },
  {
    id: "ley-seguros-fianzas",
    title: "Ley de Instituciones de Seguros y de Fianzas, articulos 492 y 493",
    authority: "Congreso/DOF",
    sector: "Sistema financiero",
    hierarchy: "Ley",
    status: "referencia_sectorial",
    reviewedAt,
    url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LISF.pdf",
    summary: "Base legal PLD/FT para aseguradoras y afianzadoras.",
    operationalImpact: "Referencia sectorial para seguros, fianzas y controles PLD/FT.",
    tags: ["seguros", "fianzas", "CNSF", "LISF"],
    relatedModules: ["EBR", "Gobernanza"],
  },
  {
    id: "circular-seguros-fianzas",
    title: "Circular Unica de Seguros y Fianzas",
    authority: "CNSF",
    sector: "Sistema financiero",
    hierarchy: "Disposiciones sectoriales",
    status: "referencia_sectorial",
    reviewedAt,
    url: "https://www.gob.mx/cnsf/documentos/circular-unica-de-seguros-y-fianzas",
    summary: "Compilado regulatorio sectorial CNSF con anexos y disposiciones aplicables a seguros y fianzas.",
    operationalImpact: "Referencia sectorial para seguros/fianzas dentro del alcance amplio PLD Mexico.",
    tags: ["CNSF", "seguros", "fianzas", "circular unica"],
    relatedModules: ["EBR", "Auditoria"],
  },
  {
    id: "ley-sar",
    title: "Ley de los Sistemas de Ahorro para el Retiro, articulo 108 Bis",
    authority: "Congreso/DOF",
    sector: "Sistema financiero",
    hierarchy: "Ley",
    status: "referencia_sectorial",
    reviewedAt,
    url: "https://www.diputados.gob.mx/LeyesBiblio/pdf/LSAR.pdf",
    summary: "Base legal PLD/FT para administradoras y participantes del sistema de ahorro para el retiro.",
    operationalImpact: "Referencia sectorial para AFORE y controles financieros.",
    tags: ["AFORE", "CONSAR", "LSAR", "108 Bis"],
    relatedModules: ["EBR", "Gobernanza"],
  },
  {
    id: "gafi-recomendaciones",
    title: "Recomendaciones del GAFI",
    authority: "GAFI/ONU",
    sector: "Internacional",
    hierarchy: "Referencia internacional",
    status: "internacional",
    reviewedAt,
    url: "https://sppld.sat.gob.mx/pld/interiores/recomendacionesgafi.html",
    summary: "Estandares internacionales sobre lavado de activos, financiamiento al terrorismo y proliferacion.",
    operationalImpact: "Marco de referencia para EBR, beneficiario final, PEP, listas, sanciones y auditoria.",
    tags: ["GAFI", "estandares internacionales", "FT", "proliferacion"],
    relatedModules: ["EBR", "Auditoria", "Gobernanza"],
  },
  {
    id: "listas-onu",
    title: "Resoluciones del Consejo de Seguridad de la ONU",
    authority: "GAFI/ONU",
    sector: "Internacional",
    hierarchy: "Referencia internacional",
    status: "internacional",
    reviewedAt,
    url: "https://sppld.sat.gob.mx/pld/interiores/actualizacionlistas.html",
    summary: "Listas y resoluciones vinculadas con terrorismo, financiamiento y proliferacion de armas de destruccion masiva.",
    operationalImpact: "Base para screening de listas, alertas, bloqueo operativo y evidencias de consulta.",
    tags: ["listas ONU", "terrorismo", "proliferacion", "listas negras"],
    relatedModules: ["WhoIs PEP", "EBR", "Evidencias"],
  },
  {
    id: "gafi-beneficiario-final",
    title: "Guia GAFI sobre beneficiario final de personas juridicas",
    authority: "GAFI/ONU",
    sector: "Internacional",
    hierarchy: "Referencia internacional",
    status: "internacional",
    reviewedAt,
    url: "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/normateca.html",
    summary: "Guia internacional sobre identificacion de beneficiario final y estructuras de control.",
    operationalImpact: "Referencia complementaria para beneficiario controlador, estructuras complejas y auditoria.",
    tags: ["beneficiario final", "beneficiario controlador", "GAFI", "personas juridicas"],
    relatedModules: ["Beneficiario Controlador", "KYC/EUI", "Auditoria"],
  },
]

export const normativeObligations: NormativeObligation[] = [
  {
    id: "alta-registro-sppld",
    module: "Alta SAT",
    moduleHref: "/registro-sat",
    obligation: "Darse de alta en SPPLD y registrar actividades vulnerables antes de operar.",
    foundation: "LFPIORPI art. 17 y RCG arts. 4 a 10",
    sourceDocumentIds: ["lfpiorpi-vigente", "resolucion-alta-registro"],
    status: "vigente",
    impact: "Vincula sujeto obligado, RFC, actividad, representante, folio y acuse.",
    tags: ["alta", "registro", "sujeto obligado"],
  },
  {
    id: "eui-anexos",
    module: "EUI/KYC",
    moduleHref: "/kyc-expediente",
    obligation: "Integrar y conservar Expediente Unico de Identificacion por tipo de persona.",
    foundation: "LFPIORPI art. 18; RCG anexos 3, 4, 4 Bis, 5, 6, 6 Bis, 7, 7 Bis, 7A y 8",
    sourceDocumentIds: ["sat-identificacion-eui", "rcg-lfpiorpi"],
    status: "vigente",
    impact: "Define checklist documental, identificacion, domicilio, poderes, representante y actividad.",
    tags: ["EUI", "KYC", "anexos", "documentos"],
  },
  {
    id: "beneficiario-controlador",
    module: "Beneficiario Controlador",
    moduleHref: "/beneficiario-controlador",
    obligation: "Identificar, documentar y actualizar beneficiario controlador o dueno beneficiario.",
    foundation: "LFPIORPI arts. 3, 18 y Capitulo IV Bis reformado",
    sourceDocumentIds: ["lfpiorpi-vigente", "dof-reforma-lfpiorpi-2025", "gafi-beneficiario-final"],
    status: "parcial",
    impact: "Afecta declaraciones, evidencias, estructura de control, actualizacion y auditoria.",
    tags: ["beneficiario controlador", "beneficiario final", "control"],
  },
  {
    id: "pep-listas",
    module: "PEP/listas",
    moduleHref: "/pep-whois",
    obligation: "Identificar PEP, familiares/asociados y validar listas oficiales o internacionales.",
    foundation: "Reglamento LFPIORPI Capitulo Sexto Bis; guia SAT de identificacion; listas ONU",
    sourceDocumentIds: ["reglamento-lfpiorpi-2026", "sat-identificacion-eui", "listas-onu"],
    status: "parcial",
    impact: "Eleva riesgo, exige evidencia de screening y decision humana trazable.",
    tags: ["PEP", "listas", "familiares", "asociados"],
  },
  {
    id: "actos-operaciones-art17",
    module: "Actos y Operaciones",
    moduleHref: "/actividades-vulnerables",
    obligation: "Clasificar actividad vulnerable, umbral, acumulacion, restriccion de efectivo y salida SAT.",
    foundation: "LFPIORPI art. 17; RCG art. 19; criterios SPPLD",
    sourceDocumentIds: ["lfpiorpi-vigente", "rcg-lfpiorpi", "sppld-criterios", "guia-acumulacion-2026"],
    status: "vigente",
    impact: "Determina aviso normal, informe en ceros, informe 27 Bis, aviso 24h o no acumulacion.",
    tags: ["articulo 17", "umbral", "acumulacion", "efectivo"],
  },
  {
    id: "ebr-metodologia",
    module: "EBR",
    moduleHref: "/ebr",
    obligation: "Aplicar enfoque basado en riesgos y documentar factores, mitigantes y riesgo residual.",
    foundation: "LFPIORPI art. 20; ENR 2023; guia CNBV EBR como referencia metodologica",
    sourceDocumentIds: ["enr-2023-uif", "guia-cnbv-ebr", "manual-lineamientos-identificacion"],
    status: "parcial",
    impact: "Soporta perfiles, riesgo inherente, controles mitigantes, PEP y plan de accion.",
    tags: ["EBR", "riesgo", "mitigantes", "ENR 2023"],
  },
  {
    id: "resguardo-evidencias",
    module: "Evidencias",
    moduleHref: "/evidencias-trazabilidad",
    obligation: "Conservar informacion y documentacion soporte por 10 anos en medio fisico o electronico.",
    foundation: "LFPIORPI art. 18 fr. IV; criterios SPPLD actualizados por reforma 16/07/2025",
    sourceDocumentIds: ["lfpiorpi-vigente", "sppld-preguntas"],
    status: "vigente",
    impact: "Exige versionado, bitacora, acuses, XML, soporte de pago y documentos de formalizacion.",
    tags: ["conservacion 10 anos", "evidencias", "acuses", "XML"],
  },
  {
    id: "avisos-informes",
    module: "Avisos e Informes",
    moduleHref: "/avisos-informes",
    obligation: "Presentar avisos o informes en SPPLD a mas tardar el dia 17 del mes inmediato siguiente, salvo supuestos especiales.",
    foundation: "LFPIORPI art. 24; RCG arts. 24, 25 y 27; Resolucion de formatos oficiales",
    sourceDocumentIds: ["resolucion-avisos-informes", "sppld-preguntas", "guia-27-bis"],
    status: "vigente",
    impact: "Controla XML/XLSM, ficha de captura, informe en ceros, 27 Bis, modificatorios y acuses.",
    tags: ["avisos", "informe en ceros", "27 Bis", "dia 17", "XML"],
  },
  {
    id: "aviso-24h",
    module: "Avisos e Informes",
    moduleHref: "/avisos-informes",
    obligation: "Presentar aviso 24 horas cuando existan indicios o sospecha, incluso si el acto no se celebra.",
    foundation: "LFPIORPI, Reglamento y criterios SAT/SPPLD sobre alertas",
    sourceDocumentIds: ["sppld-preguntas", "resolucion-avisos-informes"],
    status: "vigente",
    impact: "Requiere narrativa, alerta, prioridad y evidencia de decision.",
    tags: ["aviso 24h", "sospecha", "alerta", "prioridad"],
  },
  {
    id: "capacitacion-anual",
    module: "Capacitacion",
    moduleHref: "/capacitacion-control",
    obligation: "Capacitar al personal y documentar programa, asistencia, evaluaciones y constancias.",
    foundation: "LFPIORPI art. 20; reforma 2025 y reglas aplicables",
    sourceDocumentIds: ["lfpiorpi-vigente", "dof-reforma-lfpiorpi-2025"],
    status: "parcial",
    impact: "Debe vincular sesiones, evidencia, roles criticos y actualizaciones normativas.",
    tags: ["capacitacion", "constancias", "personal"],
  },
  {
    id: "auditoria-verificacion",
    module: "Auditoria",
    moduleHref: "/auditoria-verificacion",
    obligation: "Acreditar cumplimiento ante visitas de verificacion, requerimientos y revisiones internas o externas.",
    foundation: "LFPIORPI arts. 34 a 37; Reglamento LFPIORPI reformado; consultas SAT de verificacion",
    sourceDocumentIds: ["reglamento-lfpiorpi-2026", "sppld-preguntas", "sat-normateca-av"],
    status: "vigente",
    impact: "Ordena matriz de cumplimiento, hallazgos, acciones correctivas, evidencias y acuses.",
    tags: ["auditoria", "visitas", "verificacion", "hallazgos"],
  },
  {
    id: "gobernanza-manual",
    module: "Gobernanza",
    moduleHref: "/gobernanza-control",
    obligation: "Contar con politicas, manual PLD, responsable/representante de cumplimiento y controles internos.",
    foundation: "LFPIORPI art. 20; Reglamento LFPIORPI; RCG",
    sourceDocumentIds: ["lfpiorpi-vigente", "reglamento-lfpiorpi-2026", "rcg-lfpiorpi"],
    status: "parcial",
    impact: "Vincula manual, responsables, aprobaciones, actualizacion normativa y trazabilidad.",
    tags: ["manual PLD", "gobernanza", "responsable", "controles"],
  },
]

export const normativeUpdates: NormativeUpdate[] = [
  {
    id: "reforma-lfpiorpi-2025",
    date: "2025-07-16",
    title: "Reforma LFPIORPI y Codigo Penal Federal",
    source: "DOF",
    sourceUrl: "https://www.dof.gob.mx/nota_detalle.php?codigo=5763161&fecha=16/07/2025",
    impact: "Actualiza Actividades Vulnerables, beneficiario controlador, obligaciones del articulo 18, sanciones y articulo 400 Bis.",
    status: "reformado",
    tags: ["LFPIORPI", "400 Bis", "beneficiario controlador"],
  },
  {
    id: "entrada-vigor-2025",
    date: "2025-07-17",
    title: "Entrada en vigor general de la reforma LFPIORPI 2025",
    source: "Criterios SPPLD",
    sourceUrl: "https://sppld.sat.gob.mx/pld/interiores/criterios.html",
    impact: "SAT/SPPLD aclara que ciertas obligaciones del articulo 18 fracciones VII a XI dependen de nuevas Reglas de Caracter General.",
    status: "pendiente_rcg",
    tags: ["pendiente RCG", "articulo 18", "criterio SAT"],
  },
  {
    id: "reglamento-2026",
    date: "2026-03-27",
    title: "Reforma al Reglamento de la LFPIORPI",
    source: "DOF",
    sourceUrl: "https://www.dof.gob.mx/nota_detalle.php?codigo=5783547&fecha=27/03/2026",
    impact: "Agrega capitulo de PEP y actualiza controles, definiciones, visitas y facultades.",
    status: "reformado",
    tags: ["Reglamento", "PEP", "2026"],
  },
  {
    id: "calendario-2026",
    date: "2026-01-01",
    title: "Calendarizacion oficial 2026 para avisos e informes",
    source: "SAT/SPPLD",
    sourceUrl: "https://www.sat.gob.mx/minisitio/ActividadesVulnerables/normateca.html",
    impact: "Debe usarse para explicar vencimientos y facilidad administrativa del periodo.",
    status: "criterio_sat",
    tags: ["avisos", "informes", "2026", "dia 17"],
  },
  {
    id: "enr-2023",
    date: "2023-00-00",
    title: "Evaluacion Nacional de Riesgos 2023",
    source: "SHCP/UIF",
    sourceUrl: "https://www.pld.hacienda.gob.mx/work/models/PLD/documentos/enr2023.pdf",
    impact: "Referencia de contexto de amenazas, vulnerabilidades y factores de riesgo para EBR.",
    status: "referencia_sectorial",
    tags: ["ENR", "UIF", "EBR"],
  },
]

export function normalizeLegalSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/['`´]/g, "")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

export function filterNormativeDocuments(
  documents: NormativeDocument[],
  filters: LegalFrameworkFilters,
) {
  const query = normalizeLegalSearch(filters.query ?? "")
  const terms = query ? query.split(" ") : []

  return documents.filter((document) => {
    if (filters.sector && filters.sector !== "todos" && document.sector !== filters.sector) return false
    if (filters.authority && filters.authority !== "todos" && document.authority !== filters.authority) return false
    if (filters.status && filters.status !== "todos" && document.status !== filters.status) return false

    if (!terms.length) return true

    const searchable = normalizeLegalSearch(
      [
        document.title,
        document.authority,
        document.sector,
        document.hierarchy,
        document.status,
        document.summary,
        document.operationalImpact,
        ...document.tags,
        ...document.relatedModules,
      ].join(" "),
    )

    return terms.every((term) => searchable.includes(term))
  })
}

export function filterNormativeObligations(
  obligations: NormativeObligation[],
  query: string,
) {
  const normalizedQuery = normalizeLegalSearch(query)
  const terms = normalizedQuery ? normalizedQuery.split(" ") : []
  if (!terms.length) return obligations

  return obligations.filter((obligation) => {
    const searchable = normalizeLegalSearch(
      [
        obligation.module,
        obligation.obligation,
        obligation.foundation,
        obligation.impact,
        obligation.status,
        ...obligation.tags,
      ].join(" "),
    )

    return terms.every((term) => searchable.includes(term))
  })
}

export function groupObligationsByModule(obligations: NormativeObligation[]) {
  return obligations.reduce<Record<string, NormativeObligation[]>>((groups, obligation) => {
    groups[obligation.module] = [...(groups[obligation.module] ?? []), obligation]
    return groups
  }, {})
}
