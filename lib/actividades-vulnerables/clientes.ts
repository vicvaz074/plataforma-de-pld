export const CLIENTES_STORAGE_KEY = "actividades_vulnerables_clientes"

export const CLIENTE_TIPOS = [
  { value: "pfn", label: "Persona física mexicana" },
  { value: "pfe", label: "Persona física extranjera" },
  { value: "pmn", label: "Persona moral mexicana" },
  { value: "pme", label: "Persona moral extranjera" },
  { value: "fideicomiso", label: "Fideicomiso" },
  { value: "dependencia", label: "Dependencia o entidad pública" },
  { value: "vehiculo", label: "Vehículo corporativo" },
  { value: "otro", label: "Otro sujeto obligado" },
] as const

export type ClienteTipoValue = (typeof CLIENTE_TIPOS)[number]["value"]

export interface ClienteGuardado {
  rfc: string
  nombre: string
  tipoCliente: string
  mismoGrupo: boolean
}

export const CLIENTE_TIPOS_LABEL_MAP: Record<string, string> = CLIENTE_TIPOS.reduce(
  (acc, tipo) => {
    acc[tipo.value] = tipo.label
    return acc
  },
  {} as Record<string, string>,
)
