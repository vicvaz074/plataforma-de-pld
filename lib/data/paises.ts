export interface PaisOption {
  code: string
  label: string
}

export const PAISES: PaisOption[] = [
  { code: "MX", label: "México" },
  { code: "US", label: "Estados Unidos" },
  { code: "CA", label: "Canadá" },
  { code: "ES", label: "España" },
  { code: "AR", label: "Argentina" },
  { code: "BR", label: "Brasil" },
  { code: "GB", label: "Reino Unido" },
  { code: "DE", label: "Alemania" },
  { code: "FR", label: "Francia" },
  { code: "JP", label: "Japón" },
  { code: "CN", label: "China" },
  { code: "IT", label: "Italia" },
  { code: "CL", label: "Chile" },
  { code: "CO", label: "Colombia" },
  { code: "PE", label: "Perú" },
]

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
}

export function findPaisByCodigo(code?: string | null): PaisOption | undefined {
  if (!code) return undefined
  const normalizado = code.trim().toUpperCase()
  return PAISES.find((pais) => pais.code === normalizado)
}

export function findPaisByNombre(nombre?: string | null): PaisOption | undefined {
  if (!nombre) return undefined
  const normalizado = normalizar(nombre)
  return PAISES.find((pais) => normalizar(pais.label) === normalizado)
}
