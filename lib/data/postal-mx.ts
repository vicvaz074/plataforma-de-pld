export interface CodigoPostalInfo {
  codigoPostal: string
  estado: string
  municipio: string
  colonias: string[]
}

const CODIGOS_POSTALES: Record<string, CodigoPostalInfo> = {
  "01020": {
    codigoPostal: "01020",
    estado: "Ciudad de México",
    municipio: "Álvaro Obregón",
    colonias: ["Guadalupe Inn", "Florida", "Axotla"],
  },
  "02860": {
    codigoPostal: "02860",
    estado: "Ciudad de México",
    municipio: "Azcapotzalco",
    colonias: ["San Alvaro", "Clavería", "Victoria de las Democracias"],
  },
  "44100": {
    codigoPostal: "44100",
    estado: "Jalisco",
    municipio: "Guadalajara",
    colonias: ["Centro", "Americana", "Colonia Moderna"],
  },
  "54033": {
    codigoPostal: "54033",
    estado: "Estado de México",
    municipio: "Tlalnepantla de Baz",
    colonias: ["San Lucas Patoni", "La Loma", "Valle Dorado"],
  },
  "64000": {
    codigoPostal: "64000",
    estado: "Nuevo León",
    municipio: "Monterrey",
    colonias: ["Centro", "Obispado", "Independencia"],
  },
  "66260": {
    codigoPostal: "66260",
    estado: "Nuevo León",
    municipio: "San Pedro Garza García",
    colonias: ["Del Valle Oriente", "Residencial Santa Bárbara", "Valle de San Ángel"],
  },
  "77500": {
    codigoPostal: "77500",
    estado: "Quintana Roo",
    municipio: "Benito Juárez",
    colonias: ["Centro", "Supermanzana 5", "Supermanzana 3"],
  },
}

export function buscarCodigoPostal(codigo: string): CodigoPostalInfo | undefined {
  const limpio = codigo.trim()
  if (limpio.length === 5) {
    return CODIGOS_POSTALES[limpio]
  }
  return undefined
}

export function coloniasPorCodigoPostal(codigo: string): string[] {
  return buscarCodigoPostal(codigo)?.colonias ?? []
}

