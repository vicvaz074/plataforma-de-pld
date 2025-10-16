export interface PaisOption {
  code: string
  nombre: string
}

export const PAISES: PaisOption[] = [
  { code: "MX", nombre: "México" },
  { code: "US", nombre: "Estados Unidos" },
  { code: "CA", nombre: "Canadá" },
  { code: "ES", nombre: "España" },
  { code: "DE", nombre: "Alemania" },
  { code: "FR", nombre: "Francia" },
  { code: "GB", nombre: "Reino Unido" },
  { code: "BR", nombre: "Brasil" },
  { code: "AR", nombre: "Argentina" },
  { code: "CO", nombre: "Colombia" },
  { code: "CL", nombre: "Chile" },
  { code: "CN", nombre: "China" },
  { code: "JP", nombre: "Japón" },
  { code: "AU", nombre: "Australia" },
  { code: "IT", nombre: "Italia" },
]

export function findPais(code: string | undefined) {
  if (!code) return undefined
  const normalized = code.trim().toUpperCase()
  return PAISES.find((pais) => pais.code === normalized)
}
