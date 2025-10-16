export interface CatalogOption {
  value: string
  label: string
}

export const PAISES: CatalogOption[] = [
  { value: "MX", label: "México" },
  { value: "US", label: "Estados Unidos" },
  { value: "CA", label: "Canadá" },
  { value: "ES", label: "España" },
  { value: "GB", label: "Reino Unido" },
  { value: "DE", label: "Alemania" },
  { value: "FR", label: "Francia" },
  { value: "IT", label: "Italia" },
  { value: "BR", label: "Brasil" },
  { value: "AR", label: "Argentina" },
  { value: "CL", label: "Chile" },
  { value: "CO", label: "Colombia" },
  { value: "JP", label: "Japón" },
  { value: "CN", label: "China" },
  { value: "AU", label: "Australia" },
  { value: "ZA", label: "Sudáfrica" },
  { value: "AD", label: "Andorra" },
]

export const PAISES_TELEFONO: CatalogOption[] = [
  { value: "52", label: "+52 México" },
  { value: "1", label: "+1 Estados Unidos / Canadá" },
  { value: "44", label: "+44 Reino Unido" },
  { value: "34", label: "+34 España" },
  { value: "55", label: "+55 Brasil" },
  { value: "54", label: "+54 Argentina" },
  { value: "56", label: "+56 Chile" },
  { value: "57", label: "+57 Colombia" },
  { value: "81", label: "+81 Japón" },
  { value: "86", label: "+86 China" },
]

export const ENTIDADES_FEDERATIVAS: CatalogOption[] = [
  { value: "Aguascalientes", label: "Aguascalientes" },
  { value: "Baja California", label: "Baja California" },
  { value: "Baja California Sur", label: "Baja California Sur" },
  { value: "Campeche", label: "Campeche" },
  { value: "Chiapas", label: "Chiapas" },
  { value: "Chihuahua", label: "Chihuahua" },
  { value: "Ciudad de México", label: "Ciudad de México" },
  { value: "Coahuila", label: "Coahuila" },
  { value: "Colima", label: "Colima" },
  { value: "Durango", label: "Durango" },
  { value: "Estado de México", label: "Estado de México" },
  { value: "Guanajuato", label: "Guanajuato" },
  { value: "Guerrero", label: "Guerrero" },
  { value: "Hidalgo", label: "Hidalgo" },
  { value: "Jalisco", label: "Jalisco" },
  { value: "Michoacán", label: "Michoacán" },
  { value: "Morelos", label: "Morelos" },
  { value: "Nayarit", label: "Nayarit" },
  { value: "Nuevo León", label: "Nuevo León" },
  { value: "Oaxaca", label: "Oaxaca" },
  { value: "Puebla", label: "Puebla" },
  { value: "Querétaro", label: "Querétaro" },
  { value: "Quintana Roo", label: "Quintana Roo" },
  { value: "San Luis Potosí", label: "San Luis Potosí" },
  { value: "Sinaloa", label: "Sinaloa" },
  { value: "Sonora", label: "Sonora" },
  { value: "Tabasco", label: "Tabasco" },
  { value: "Tamaulipas", label: "Tamaulipas" },
  { value: "Tlaxcala", label: "Tlaxcala" },
  { value: "Veracruz", label: "Veracruz" },
  { value: "Yucatán", label: "Yucatán" },
  { value: "Zacatecas", label: "Zacatecas" },
]

export const TIPOS_OPERACION_INMUEBLE: CatalogOption[] = [
  { value: "501", label: "501 – Arrendamiento" },
  { value: "502", label: "502 – Cesión de derechos" },
  { value: "503", label: "503 – Uso temporal" },
  { value: "504", label: "504 – Usufructo" },
]

export const FIGURA_CLIENTE_OPCIONES: CatalogOption[] = [
  { value: "1", label: "Propietario / Dueño" },
  { value: "2", label: "Arrendatario" },
  { value: "3", label: "Comodato" },
]

export const FIGURA_SUJETO_OBLIGADO_OPCIONES: CatalogOption[] = [
  { value: "1", label: "Arrendador" },
  { value: "2", label: "Administrador" },
  { value: "3", label: "Fideicomitente" },
]

export const TIPOS_INMUEBLE: CatalogOption[] = [
  { value: "1", label: "1 – Casa habitación" },
  { value: "2", label: "2 – Departamento" },
  { value: "3", label: "3 – Local comercial" },
  { value: "4", label: "4 – Nave industrial" },
  { value: "5", label: "5 – Terreno" },
]

export const FORMAS_PAGO: CatalogOption[] = [
  { value: "1", label: "1 – Transferencia" },
  { value: "2", label: "2 – Depósito bancario" },
  { value: "3", label: "3 – Cheque" },
  { value: "4", label: "4 – Efectivo" },
]

export const INSTRUMENTOS_MONETARIOS: CatalogOption[] = [
  { value: "1", label: "1 – Transferencia electrónica" },
  { value: "2", label: "2 – Cheque nominativo" },
  { value: "3", label: "3 – Cheque de caja" },
  { value: "4", label: "4 – Depósito en efectivo" },
  { value: "5", label: "5 – Orden de pago" },
]

export const MONEDAS_EXTENDIDAS: CatalogOption[] = [
  { value: "MXN", label: "Peso mexicano (MXN)" },
  { value: "USD", label: "Dólar estadounidense (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "CAD", label: "Dólar canadiense (CAD)" },
  { value: "GBP", label: "Libra esterlina (GBP)" },
  { value: "JPY", label: "Yen japonés (JPY)" },
  { value: "CHF", label: "Franco suizo (CHF)" },
  { value: "BRL", label: "Real brasileño (BRL)" },
  { value: "COP", label: "Peso colombiano (COP)" },
  { value: "ARS", label: "Peso argentino (ARS)" },
  { value: "CLP", label: "Peso chileno (CLP)" },
  { value: "PEN", label: "Sol peruano (PEN)" },
  { value: "OTRA", label: "Otra divisa (especificar)" },
]

