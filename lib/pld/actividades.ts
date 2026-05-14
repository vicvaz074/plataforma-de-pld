import type { ActividadVulnerableCatalogItem } from "./types"

const LFPIORPI_URL = "https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPIORPI.pdf"
const VERIFIED = "2026-05-08"

const documentosBase = [
  "Formulario de identificacion del cliente o usuario.",
  "Identificacion oficial o documentos constitutivos, segun tipo de cliente.",
  "Constancia fiscal/RFC o dato equivalente cuando aplique.",
  "Soporte del acto u operacion y forma de pago.",
  "Declaracion de beneficiario controlador cuando corresponda.",
]

const ACTIVIDAD_KEY_ALIASES: Record<string, string> = {
  "fraccion-ii-vales": "fraccion-ii-instrumentos-valor",
}

export function normalizeActividadKey(key: string): string {
  return ACTIVIDAD_KEY_ALIASES[key] ?? key
}

function activity(
  key: string,
  fraccion: string,
  nombre: string,
  descripcion: string,
  identificacionUmbralUma: number,
  avisoUmbralUma: number,
  overrides: Partial<ActividadVulnerableCatalogItem> = {},
): ActividadVulnerableCatalogItem {
  return {
    key,
    fraccion,
    nombre,
    descripcion,
    identificacionUmbralUma,
    avisoUmbralUma,
    acumulacion: identificacionUmbralUma > 0 ? "umbral-identificacion" : "todas-las-operaciones",
    fundamento: `LFPIORPI articulo 17, ${fraccion}`,
    sourceUrl: LFPIORPI_URL,
    lastVerified: VERIFIED,
    documentosBase,
    ...overrides,
  }
}

export const ACTIVIDADES_VULNERABLES_ARTICULO_17: ActividadVulnerableCatalogItem[] = [
  activity(
    "fraccion-i-juegos",
    "Fracción I",
    "Juegos con apuesta, concursos y sorteos",
    "Venta de boletos, fichas, comprobantes, pago de premios u operaciones financieras vinculadas.",
    325,
    645,
  ),
  activity(
    "fraccion-ii-tarjetas-servicios",
    "Fracción II",
    "Tarjetas de servicios o de crédito",
    "Emision o comercializacion habitual o profesional distinta a entidades financieras.",
    805,
    1285,
  ),
  activity(
    "fraccion-ii-tarjetas-prepagadas",
    "Fracción II",
    "Tarjetas prepagadas",
    "Comercializacion o abono de recursos en tarjetas prepagadas.",
    645,
    645,
  ),
  activity(
    "fraccion-ii-instrumentos-valor",
    "Fracción II",
    "Instrumentos de almacenamiento de valor monetario",
    "Emision, comercializacion o abono de recursos a instrumentos de almacenamiento de valor.",
    645,
    645,
  ),
  activity("fraccion-iii-cheques", "Fracción III", "Cheques de viajero", "Emision o comercializacion habitual o profesional de cheques de viajero.", 0, 645),
  activity("fraccion-iv-prestamos", "Fracción IV", "Prestamos, creditos, mutuo o garantia", "Otorgamiento habitual o profesional por sujetos distintos a entidades financieras.", 0, 1605),
  activity("fraccion-v-inmuebles", "Fracción V", "Construccion, desarrollo e intermediacion inmobiliaria", "Compra, venta, intermediacion o constitucion de derechos sobre inmuebles.", 0, 8025),
  activity("fraccion-v-bis-desarrollo", "Fracción V Bis", "Recepcion de recursos para desarrollo inmobiliario", "Recepcion de recursos destinados a desarrollo inmobiliario para venta o renta.", 0, 8025),
  activity("fraccion-vi-metales", "Fracción VI", "Metales, piedras preciosas, joyas o relojes", "Comercializacion o intermediacion de metales preciosos, piedras preciosas, joyas o relojes.", 805, 1605),
  activity("fraccion-vii-arte", "Fracción VII", "Obras de arte", "Subasta o comercializacion habitual o profesional de obras de arte.", 2410, 4815),
  activity("fraccion-viii-vehiculos", "Fracción VIII", "Vehiculos aereos, maritimos o terrestres", "Comercializacion o distribucion habitual o profesional de vehiculos nuevos o usados.", 3210, 6420),
  activity("fraccion-ix-blindaje", "Fracción IX", "Blindaje de vehiculos e inmuebles", "Prestacion habitual o profesional de servicios de blindaje.", 2410, 4815),
  activity("fraccion-x-traslado", "Fracción X", "Traslado o custodia de dinero y valores", "Prestacion habitual o profesional de traslado o custodia de dinero o valores.", 0, 3210),
  activity("fraccion-xi-a-inmuebles", "Fracción XI", "Servicios profesionales - inmuebles", "Preparacion o realizacion a nombre del cliente de compraventa o cesion de derechos sobre inmuebles.", 0, 0, { avisoSiempre: true }),
  activity("fraccion-xi-b-administracion", "Fracción XI", "Servicios profesionales - administracion de activos", "Administracion y manejo de recursos, valores o cualquier otro activo de clientes.", 0, 0, { avisoSiempre: true }),
  activity("fraccion-xi-c-cuentas", "Fracción XI", "Servicios profesionales - cuentas bancarias", "Manejo de cuentas bancarias, de ahorro o de valores.", 0, 0, { avisoSiempre: true }),
  activity("fraccion-xi-d-aportaciones", "Fracción XI", "Servicios profesionales - aportaciones de capital", "Organizacion de aportaciones para sociedades mercantiles.", 0, 0, { avisoSiempre: true }),
  activity("fraccion-xi-e-corporativo", "Fracción XI", "Servicios profesionales - estructuras corporativas", "Constitucion, escision, fusion, operacion o administracion de personas morales, vehiculos corporativos o fideicomisos.", 0, 0, { avisoSiempre: true }),
  activity("fraccion-xii-notarios-a", "Fracción XII", "Fe publica notarial - inmuebles", "Transmision o constitucion de derechos reales sobre inmuebles ante notario.", 0, 8000),
  activity("fraccion-xii-notarios-b", "Fracción XII", "Fe publica notarial - poderes irrevocables", "Otorgamiento de poderes para actos de administracion o dominio con caracter irrevocable.", 0, 0, { avisoSiempre: true }),
  activity("fraccion-xii-notarios-c", "Fracción XII", "Fe publica notarial - personas morales", "Constitucion, modificacion patrimonial, fusion, escision o compraventa de acciones/partes sociales.", 0, 0, { avisoSiempre: true }),
  activity("fraccion-xii-notarios-d", "Fracción XII", "Fe publica notarial - fideicomisos", "Constitucion o modificacion de fideicomisos traslativos de dominio o garantia.", 0, 4000),
  activity("fraccion-xii-notarios-e", "Fracción XII", "Fe publica notarial - mutuo o credito", "Contratos de mutuo o credito donde el acreedor no sea sistema financiero u organismo publico de vivienda.", 0, 0, { avisoSiempre: true }),
  activity("fraccion-xii-corredores-a", "Fracción XII", "Fe publica corredor - avaluos", "Avaluos sobre bienes ante corredor publico.", 8025, 8025),
  activity("fraccion-xii-corredores-b", "Fracción XII", "Fe publica corredor - sociedades mercantiles", "Constitucion, modificacion patrimonial, fusion, escision o compraventa de acciones/partes sociales.", 0, 0, { avisoSiempre: true }),
  activity("fraccion-xii-corredores-c", "Fracción XII", "Fe publica corredor - fideicomisos", "Constitucion, modificacion o cesion de derechos de fideicomisos.", 0, 0, { avisoSiempre: true }),
  activity("fraccion-xii-corredores-d", "Fracción XII", "Fe publica corredor - mutuo mercantil", "Contratos de mutuo o creditos mercantiles permitidos por legislacion aplicable.", 0, 0, { avisoSiempre: true }),
  activity("fraccion-xiii-donativos", "Fracción XIII", "Donativos a asociaciones y sociedades sin fines de lucro", "Recepcion de donativos por asociaciones y sociedades sin fines de lucro.", 1605, 3210),
  activity("fraccion-xiv-aduanal-a", "Fracción XIV", "Servicios de comercio exterior - vehículos", "Despacho de vehiculos terrestres, aereos o maritimos nuevos o usados.", 0, 0, { inciso: "a", avisoSiempre: true }),
  activity("fraccion-xiv-aduanal-b", "Fracción XIV", "Servicios de comercio exterior - juegos y sorteos", "Despacho de maquinas para juegos de apuesta y sorteos.", 0, 0, { inciso: "b", avisoSiempre: true }),
  activity("fraccion-xiv-aduanal-c", "Fracción XIV", "Servicios de comercio exterior - tarjetas de pago", "Despacho de equipos y materiales para elaborar tarjetas de pago.", 0, 0, { inciso: "c", avisoSiempre: true }),
  activity("fraccion-xiv-aduanal-d", "Fracción XIV", "Servicios de comercio exterior - joyas y metales", "Despacho de joyas, relojes, piedras preciosas y metales preciosos.", 485, 485, { inciso: "d", avisoSiempre: true }),
  activity("fraccion-xiv-aduanal-e", "Fracción XIV", "Servicios de comercio exterior - obras de arte", "Despacho de obras de arte.", 4815, 4815, { inciso: "e", avisoSiempre: true }),
  activity("fraccion-xiv-aduanal-f", "Fracción XIV", "Servicios de comercio exterior - blindaje", "Despacho de materiales de resistencia balistica para servicios de blindaje.", 0, 0, { inciso: "f", avisoSiempre: true }),
  activity("fraccion-xv-uso-goce", "Fracción XV", "Uso o goce de bienes inmuebles", "Constitucion de derechos personales de uso o goce de bienes inmuebles.", 1605, 3210),
  activity("fraccion-xvi-activos-virtuales", "Fracción XVI", "Activos virtuales", "Intercambio habitual y profesional de activos virtuales por sujetos distintos a entidades financieras.", 0, 210),
  activity("fraccion-xvi-activos-virtuales-operacion", "Fracción XVI", "Activos virtuales - operacion del cliente", "Intercambio habitual y profesional de activos virtuales por sujetos distintos a entidades financieras.", 0, 210),
  activity("fraccion-xvi-activos-virtuales-contraprestacion", "Fracción XVI", "Activos virtuales - contraprestacion", "Contraprestacion cobrada por el servicio de activos virtuales.", 0, 4),
]

export function findActividadByKey(key: string): ActividadVulnerableCatalogItem {
  const normalizedKey = normalizeActividadKey(key)
  const activity = ACTIVIDADES_VULNERABLES_ARTICULO_17.find((item) => item.key === normalizedKey)

  if (!activity) {
    throw new Error(`Actividad vulnerable no encontrada: ${key}`)
  }

  return activity
}
