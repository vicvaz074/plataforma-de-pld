export interface CodigoPostalInfo {
  codigoPostal: string
  estado: string
  municipio: string
  ciudad: string
  colonias: string[]
}

const CODIGOS_POSTALES: CodigoPostalInfo[] = [
  {
    codigoPostal: "01020",
    estado: "Ciudad de México",
    municipio: "Álvaro Obregón",
    ciudad: "Ciudad de México",
    colonias: ["Guadalupe Inn", "San Ángel", "Axotla", "Florida"],
  },
  {
    codigoPostal: "09230",
    estado: "Ciudad de México",
    municipio: "Iztapalapa",
    ciudad: "Ciudad de México",
    colonias: ["El Paraíso", "San Lorenzo Tezonco", "Lomas de Zaragoza"],
  },
  {
    codigoPostal: "64000",
    estado: "Nuevo León",
    municipio: "Monterrey",
    ciudad: "Monterrey",
    colonias: ["Centro", "Obispado", "Chepevera"],
  },
  {
    codigoPostal: "44100",
    estado: "Jalisco",
    municipio: "Guadalajara",
    ciudad: "Guadalajara",
    colonias: ["Centro", "Americana", "Obrera"],
  },
  {
    codigoPostal: "76140",
    estado: "Querétaro",
    municipio: "Querétaro",
    ciudad: "Santiago de Querétaro",
    colonias: ["Centro Sur", "Carretas", "Alamos"],
  },
  {
    codigoPostal: "22880",
    estado: "Baja California",
    municipio: "Ensenada",
    ciudad: "Ensenada",
    colonias: ["Playa Ensenada", "Moderna", "Acapulco"]
  }
]

export function findCodigoPostal(codigo: string | undefined) {
  if (!codigo) return undefined
  const normalized = codigo.trim()
  return CODIGOS_POSTALES.find((entry) => entry.codigoPostal === normalized)
}

export function listarCodigosPostales() {
  return CODIGOS_POSTALES
}
