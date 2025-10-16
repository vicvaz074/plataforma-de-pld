export const PAISES = [
  { value: "MX", label: "México" },
  { value: "US", label: "Estados Unidos de América" },
  { value: "CA", label: "Canadá" },
  { value: "ES", label: "España" },
  { value: "DE", label: "Alemania" },
  { value: "FR", label: "Francia" },
  { value: "GB", label: "Reino Unido" },
  { value: "BR", label: "Brasil" },
  { value: "AR", label: "Argentina" },
  { value: "CL", label: "Chile" },
  { value: "CN", label: "China" },
  { value: "JP", label: "Japón" },
  { value: "AD", label: "Andorra" },
  { value: "PA", label: "Panamá" },
  { value: "CO", label: "Colombia" },
  { value: "PE", label: "Perú" },
  { value: "VE", label: "Venezuela" },
  { value: "IT", label: "Italia" },
  { value: "IE", label: "Irlanda" },
  { value: "PT", label: "Portugal" },
  { value: "OT", label: "Otro país" },
]

export const MONEDAS_CATALOGO = [
  { value: "MXN", label: "Peso mexicano (MXN)" },
  { value: "USD", label: "Dólar estadounidense (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "CAD", label: "Dólar canadiense (CAD)" },
  { value: "GBP", label: "Libra esterlina (GBP)" },
  { value: "JPY", label: "Yen japonés (JPY)" },
  { value: "CHF", label: "Franco suizo (CHF)" },
  { value: "BRL", label: "Real brasileño (BRL)" },
  { value: "ARS", label: "Peso argentino (ARS)" },
  { value: "CLP", label: "Peso chileno (CLP)" },
  { value: "CNY", label: "Yuan chino (CNY)" },
  { value: "COP", label: "Peso colombiano (COP)" },
  { value: "PEN", label: "Sol peruano (PEN)" },
  { value: "OTRA", label: "Otra divisa (especificar)" },
]

export function buscarPaisPorNombre(nombre: string | undefined) {
  if (!nombre) return undefined
  const normalizado = nombre.trim().toLowerCase()
  return PAISES.find((pais) => pais.label.toLowerCase().includes(normalizado))
}
