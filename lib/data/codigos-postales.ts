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
    codigo: "11550",
    estado: "Ciudad de México",
    municipio: "Miguel Hidalgo",
    ciudad: "Ciudad de México",
    asentamientos: ["Polanco V Sección", "Granada", "Ampliación Granada"],
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
    codigo: "97203",
    estado: "Yucatán",
    municipio: "Mérida",
    ciudad: "Mérida",
    asentamientos: ["Francisco de Montejo", "Chuburná", "Campestre"],
  },
]

export function findCodigoPostalInfo(codigo: string): CodigoPostalInfo | undefined {
  const limpio = codigo.trim()
  if (limpio.length < 5) return undefined
  return CODIGOS_POSTALES.find((item) => item.codigo === limpio)
}
