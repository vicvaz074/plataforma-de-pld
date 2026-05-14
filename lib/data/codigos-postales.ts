export interface CodigoPostalInfo {
  codigo: string
  estado: string
  municipio: string
  ciudad?: string
  asentamientos: string[]
}

export interface CodigoPostalSnapshot {
  schemaVersion: number
  source: string
  sourceTemplate: string
  generatedAt: string
  records: CodigoPostalInfo[]
}

export const CODIGOS_POSTALES: CodigoPostalInfo[] = [
  {
    codigo: "66260",
    estado: "Nuevo León",
    municipio: "San Pedro Garza García",
    ciudad: "San Pedro Garza García",
    asentamientos: ["Del Valle Oriente", "Residencial San Agustín", "Zona Valle"],
  },
  {
    codigo: "66220",
    estado: "Nuevo León",
    municipio: "San Pedro Garza García",
    ciudad: "San Pedro Garza García",
    asentamientos: ["Del Valle", "San Pedro", "Fuentes del Valle"],
  },
  {
    codigo: "67350",
    estado: "Nuevo León",
    municipio: "Allende",
    ciudad: "Allende",
    asentamientos: ["Centro", "Los Sabinos", "Valle Dorado"],
  },
  {
    codigo: "01020",
    estado: "Ciudad de México",
    municipio: "Álvaro Obregón",
    ciudad: "Ciudad de México",
    asentamientos: ["Guadalupe Inn", "Florida", "Axotla"],
  },
  {
    codigo: "03100",
    estado: "Ciudad de México",
    municipio: "Benito Juárez",
    ciudad: "Ciudad de México",
    asentamientos: ["Del Valle Centro", "Insurgentes San Borja", "Narvarte Poniente"],
  },
  {
    codigo: "11000",
    estado: "Ciudad de México",
    municipio: "Miguel Hidalgo",
    ciudad: "Ciudad de México",
    asentamientos: ["Lomas de Chapultepec", "Molino del Rey", "Bosque de Chapultepec"],
  },
  {
    codigo: "44100",
    estado: "Jalisco",
    municipio: "Guadalajara",
    ciudad: "Guadalajara",
    asentamientos: ["Centro", "Americana", "Obrera"],
  },
  {
    codigo: "77500",
    estado: "Quintana Roo",
    municipio: "Benito Juárez",
    ciudad: "Cancún",
    asentamientos: ["Cancún Centro", "Supermanzana 2", "Supermanzana 4"],
  },
  {
    codigo: "97115",
    estado: "Yucatán",
    municipio: "Mérida",
    ciudad: "Mérida",
    asentamientos: ["Altabrisa", "Montebello", "San Ramón Norte"],
  },
]

const CODIGOS_POSTALES_CACHE = new Map(
  CODIGOS_POSTALES.map((item) => [item.codigo, item] as const),
)

export function normalizeCodigoPostal(value: string): string {
  return value.trim().replace(/[^0-9]/g, "").match(/\d{5}/)?.[0] ?? ""
}

const normalizeForCatalog = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim()

const mergeInfo = (current: CodigoPostalInfo | undefined, incoming: CodigoPostalInfo): CodigoPostalInfo => {
  if (!current) return incoming
  return {
    codigo: incoming.codigo || current.codigo,
    estado: incoming.estado || current.estado,
    municipio: incoming.municipio || current.municipio,
    ciudad: incoming.ciudad || current.ciudad,
    asentamientos: Array.from(new Set([...current.asentamientos, ...incoming.asentamientos].filter(Boolean))),
  }
}

export function mergeCodigoPostalCatalog(
  base: CodigoPostalInfo[],
  incoming: CodigoPostalInfo[],
): CodigoPostalInfo[] {
  const byCode = new Map<string, CodigoPostalInfo>()
  for (const item of base) {
    const codigo = normalizeCodigoPostal(item.codigo)
    if (!codigo) continue
    byCode.set(codigo, { ...item, codigo })
  }
  for (const item of incoming) {
    const codigo = normalizeCodigoPostal(item.codigo)
    if (!codigo) continue
    byCode.set(codigo, mergeInfo(byCode.get(codigo), { ...item, codigo }))
  }
  return Array.from(byCode.values()).sort((a, b) => a.codigo.localeCompare(b.codigo, "es"))
}

export function registerCodigoPostalInfo(info: CodigoPostalInfo) {
  const codigo = normalizeCodigoPostal(info?.codigo || "")
  if (!codigo) return
  CODIGOS_POSTALES_CACHE.set(codigo, { ...info, codigo })
}

export function findCodigoPostalInfo(codigo: string): CodigoPostalInfo | undefined {
  const limpio = normalizeCodigoPostal(codigo)
  if (!limpio) return undefined
  return CODIGOS_POSTALES_CACHE.get(limpio)
}

export function findCodigoPostalInfoInCatalog(
  catalog: CodigoPostalInfo[],
  codigo: string,
): CodigoPostalInfo | undefined {
  const limpio = normalizeCodigoPostal(codigo)
  if (!limpio) return undefined
  return catalog.find((item) => normalizeCodigoPostal(item.codigo) === limpio)
}

export function findSatAddressOption(options: string[], value: string): string | undefined {
  const target = normalizeForCatalog(value)
  if (!target) return undefined
  return options.find((option) => {
    const normalized = normalizeForCatalog(option)
    const [, labelAfterCode] = option.split(/,(.+)/)
    const normalizedLabel = normalizeForCatalog(labelAfterCode || option)
    return normalized === target || normalizedLabel === target || normalized.includes(target)
  })
}

export const CIUDADES_MEXICO: string[] = Array.from(
  new Set(
    CODIGOS_POSTALES
      .map((item) => item.ciudad?.trim())
      .filter((ciudad): ciudad is string => Boolean(ciudad && ciudad.length > 0)),
  ),
)
  .sort((a, b) => a.localeCompare(b, "es"))

export function filtrarCiudadesMexico(termino: string): string[] {
  const criterio = termino.trim().toLowerCase()
  if (!criterio) return CIUDADES_MEXICO
  return CIUDADES_MEXICO.filter((ciudad) => ciudad.toLowerCase().includes(criterio))
}
