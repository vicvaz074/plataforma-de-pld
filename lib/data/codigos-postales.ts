export interface CodigoPostalInfo {
  codigo: string
  estado: string
  municipio: string
  ciudad?: string
  asentamientos: string[]
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
    codigo: "01020",
    estado: "Ciudad de México",
    municipio: "Álvaro Obregón",
    ciudad: "Ciudad de México",
    asentamientos: ["Guadalupe Inn", "Florida", "Axotla"],
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
]

const CODIGOS_POSTALES_CACHE = new Map(
  CODIGOS_POSTALES.map((item) => [item.codigo, item] as const),
)

export function registerCodigoPostalInfo(info: CodigoPostalInfo) {
  if (!info?.codigo) return
  CODIGOS_POSTALES_CACHE.set(info.codigo, info)
}

export function findCodigoPostalInfo(codigo: string): CodigoPostalInfo | undefined {
  const limpio = codigo.trim().replace(/[^0-9]/g, "")
  if (limpio.length < 5) return undefined
  return CODIGOS_POSTALES_CACHE.get(limpio)
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
