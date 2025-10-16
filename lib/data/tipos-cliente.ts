export type ClienteTipoDetalleOption = {
  value: string
  label: string
}

export type ClienteTipoOption = {
  value: string
  label: string
  descripcion: string
  requiresDetalle?: boolean
  detalleLabel?: string
  detallePlaceholder?: string
  detalleOpciones?: ClienteTipoDetalleOption[]
}

function normalizeIdentifier(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
}

const ENTIDAD_FINANCIERA_DETALLES = [
  "Sociedades Controladoras de Grupos Financieros",
  "Sociedades de Inversión",
  "Sociedades de Inversión Especializadas en Fondos para el Retiro",
  "Sociedades Operadoras de Sociedades de Inversión",
  "Sociedades Distribuidoras de Acciones de Sociedades de Inversión",
  "Instituciones de Crédito",
  "Casas de Bolsa",
  "Casas de Cambio",
  "Administradoras de Fondos para el Retiro",
  "Instituciones de Seguros",
  "Sociedades Mutualistas de Seguros",
  "Instituciones de Fianzas",
  "Almacenes Generales de Depósito",
  "Arrendadoras Financieras",
  "Sociedades Cooperativas de Ahorro y Préstamo",
  "Sociedades Financieras Populares",
  "Sociedades Financieras Rurales",
  "Sociedades Financieras de Objeto Limitado",
  "Sociedades Financieras de Objeto Múltiple",
  "Uniones de Crédito",
  "Empresas de Factoraje Financiero",
  "Sociedades Emisoras de Valores",
  "Entidades Financieras del Exterior",
  "Dependencias y Entidades públicas federales, estatales y municipales",
  "Bolsas de Valores",
  "Instituciones para el Depósito de Valores",
  "Empresas que administren mecanismos para facilitar las transacciones con valores",
  "Contrapartes Centrales cuyos valores se encuentren inscritos en el Registro Nacional de Valores",
]

const DERECHO_PUBLICO_SIMPLIFICADO_DETALLES = [
  "Secretaría de Gobernación",
  "Secretaría de Relaciones Exteriores",
  "Secretaría de la Defensa Nacional",
  "Secretaría de Marina",
  "Secretaría de Hacienda y Crédito Público",
  "Secretaría de Infraestructura, Comunicaciones y Transportes",
  "Secretaría de la Función Pública",
  "Centro de Investigación y Seguridad Nacional",
  "Instituto Nacional de Migración",
  "Servicio de Administración Tributaria",
]

export const CLIENTE_TIPOS: ClienteTipoOption[] = [
  {
    value: "pf_residente",
    label: "Persona física residente (mexicana o extranjera)",
    descripcion:
      "Aplica a personas físicas con nacionalidad mexicana o extranjeras con condición de residencia temporal o permanente en México.",
  },
  {
    value: "pf_visitante",
    label: "Persona física extranjera visitante",
    descripcion:
      "Personas físicas extranjeras con condición de estancia de visitante sin residencia en territorio mexicano.",
  },
  {
    value: "pm_mexicana",
    label: "Persona moral mexicana",
    descripcion: "Sociedades mercantiles o civiles constituidas conforme a las leyes mexicanas.",
  },
  {
    value: "pm_extranjera",
    label: "Persona moral extranjera",
    descripcion: "Entidades jurídicas constituidas en el extranjero que operan o contratan en México.",
  },
  {
    value: "entidad_financiera",
    label: "Entidad financiera, sociedad o dependencia (seguros, fianzas y bursátil)",
    descripcion:
      "Sujetos obligados del sector asegurador, afianzador o bursátil, incluyendo sociedades y dependencias con operaciones financieras especializadas.",
    requiresDetalle: true,
    detalleLabel: "Tipo de entidad financiera",
    detallePlaceholder: "Selecciona el tipo de entidad",
    detalleOpciones: ENTIDAD_FINANCIERA_DETALLES.map((label) => ({
      value: label,
      label,
    })),
  },
  {
    value: "fideicomiso",
    label: "Fideicomiso",
    descripcion: "Estructuras fiduciarias constituidas ante una institución fiduciaria autorizada.",
  },
  {
    value: "organismo_internacional",
    label: "Embajada, consulado u organismo internacional",
    descripcion: "Representaciones diplomáticas, consulares u organismos internacionales con operaciones en México.",
  },
  {
    value: "pm_derecho_publico",
    label: "Persona moral mexicana de derecho público",
    descripcion: "Dependencias, entidades u organismos públicos con régimen de derecho público general.",
  },
  {
    value: "pm_derecho_publico_simplificado",
    label: "Persona moral mexicana de derecho público (régimen simplificado)",
    descripcion:
      "Entidades de derecho público incorporadas al régimen simplificado de confianza u homólogo permitido por ley.",
    requiresDetalle: true,
    detalleLabel: "Dependencia o entidad",
    detallePlaceholder: "Selecciona la dependencia",
    detalleOpciones: DERECHO_PUBLICO_SIMPLIFICADO_DETALLES.map((label) => ({
      value: label,
      label,
    })),
  },
]

export function findClienteTipoOption(identifier: string | undefined | null) {
  if (!identifier) return undefined
  return (
    CLIENTE_TIPOS.find((option) => option.value === identifier) ||
    CLIENTE_TIPOS.find((option) => normalizeIdentifier(option.label) === normalizeIdentifier(identifier))
  )
}

export function findClienteTipoLabel(identifier: string | undefined | null) {
  return findClienteTipoOption(identifier)?.label ?? identifier ?? ""
}
