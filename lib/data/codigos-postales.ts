export interface CodigoPostalInfo {
  codigoPostal: string
  estado: string
  municipio: string
  ciudad: string
  colonias: string[]
}

export const CODIGOS_POSTALES_MX: CodigoPostalInfo[] = [
  {
    codigoPostal: "01020",
    estado: "Ciudad de México",
    municipio: "Álvaro Obregón",
    ciudad: "Ciudad de México",
    colonias: ["Guadalupe Inn", "San Ángel", "Axotla"],
  },
  {
    codigoPostal: "09230",
    estado: "Ciudad de México",
    municipio: "Iztapalapa",
    ciudad: "Ciudad de México",
    colonias: ["El Paraíso", "Jacarandas", "El Rodeo"],
  },
  {
    codigoPostal: "44100",
    estado: "Jalisco",
    municipio: "Guadalajara",
    ciudad: "Guadalajara",
    colonias: ["Centro", "Americana", "Colonia Moderna"],
  },
  {
    codigoPostal: "77500",
    estado: "Quintana Roo",
    municipio: "Benito Juárez",
    ciudad: "Cancún",
    colonias: ["Centro", "Zona Hotelera", "Supermanzana 3"],
  },
  {
    codigoPostal: "64000",
    estado: "Nuevo León",
    municipio: "Monterrey",
    ciudad: "Monterrey",
    colonias: ["Centro", "Obispado", "Chepevera"],
  },
]

export function buscarCodigoPostalMx(codigo: string) {
  return CODIGOS_POSTALES_MX.find((item) => item.codigoPostal === codigo)
}
