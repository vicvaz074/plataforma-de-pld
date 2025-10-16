import { z } from "zod"

export const actividadSchema = z.object({
  key: z.string(),
  fraccion: z.string(),
  nombre: z.string(),
  descripcion: z.string(),
  identificacionUmbralUma: z.number().nonnegative(),
  avisoUmbralUma: z.number().nonnegative(),
  obligaciones: z.object({
    identificacion: z.string(),
    aviso: z.string(),
    sinUmbral: z.string(),
  }),
  criteriosUif: z.array(z.string()),
  ejemplosOperaciones: z.array(
    z.object({
      titulo: z.string(),
      descripcion: z.string(),
    }),
  ),
  clienteObligaciones: z.object({
    personaFisica: z.array(z.string()),
    personaMoral: z.array(z.string()),
    personaExtranjera: z.array(z.string()),
    fideicomiso: z.array(z.string()),
    vehiculo: z.array(z.string()),
    autoridad: z.array(z.string()),
    otro: z.array(z.string()),
  }),
})

export type ActividadVulnerable = z.infer<typeof actividadSchema>

const baseClienteObligaciones = {
  personaFisica: [
    "Identificación oficial vigente (INE o pasaporte).",
    "CURP y RFC actualizados.",
    "Comprobante de domicilio menor a 3 meses.",
    "Declaración sobre origen y destino de los recursos.",
  ],
  personaMoral: [
    "Acta constitutiva y poderes notariales vigentes.",
    "RFC y constancia de situación fiscal.",
    "Identificación del representante legal y lista de accionistas.",
    "Estados financieros o evidencia de capacidad económica.",
  ],
  personaExtranjera: [
    "Pasaporte y documento migratorio vigente.",
    "Comprobante de domicilio en el país de origen o en México.",
    "Declaración del beneficiario final y origen de recursos.",
  ],
  fideicomiso: [
    "Contrato de fideicomiso y anexos vigentes.",
    "Identificación de fiduciario, fideicomitente y fideicomisarios.",
    "Relación de beneficiarios finales y estructura de control.",
  ],
  vehiculo: [
    "Documentos constitutivos del vehículo corporativo o sociedad vehículo.",
    "Poderes y autorizaciones para operar.",
  ],
  autoridad: ["Mandato u oficio que respalde la operación y a la persona responsable."],
  otro: ["Documentación específica conforme a políticas internas y nivel de riesgo."],
}

type ClienteKey = keyof typeof baseClienteObligaciones

function buildClienteObligaciones(overrides: Partial<Record<ClienteKey, string[]>> = {}) {
  return {
    personaFisica: overrides.personaFisica ?? baseClienteObligaciones.personaFisica,
    personaMoral: overrides.personaMoral ?? baseClienteObligaciones.personaMoral,
    personaExtranjera: overrides.personaExtranjera ?? baseClienteObligaciones.personaExtranjera,
    fideicomiso: overrides.fideicomiso ?? baseClienteObligaciones.fideicomiso,
    vehiculo: overrides.vehiculo ?? baseClienteObligaciones.vehiculo,
    autoridad: overrides.autoridad ?? baseClienteObligaciones.autoridad,
    otro: overrides.otro ?? baseClienteObligaciones.otro,
  }
}

export const actividadesVulnerables: ActividadVulnerable[] = [
  {
    key: "demo-servicio-cumplimiento",
    fraccion: "Fracción Demo",
    nombre: "Servicio demostrativo de cumplimiento",
    descripcion: "Ejemplo temporal para mostrar el flujo completo de captura en la plataforma.",
    identificacionUmbralUma: 10,
    avisoUmbralUma: 25,
    obligaciones: {
      sinUmbral: "Registra notas internas del escenario de demostración para practicar el flujo completo.",
      identificacion:
        "Identifica al cliente ficticio cuando el acumulado alcance 10 UMA para mostrar los controles.",
      aviso:
        "Simula el envío de un aviso cuando el escenario supera 25 UMA y documenta los pasos realizados.",
    },
    criteriosUif: [
      "Permite explicar la clasificación de operaciones sin afectar catálogos reales.",
      "Sirve para capacitar a nuevos usuarios antes de trabajar con expedientes productivos.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Contrato piloto con cliente demostrativo",
        descripcion: "Escenario abreviado para practicar la integración de expedientes y avisos.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones({
      personaFisica: [
        "Identificación oficial genérica del ejemplo y comprobante de domicilio controlado.",
      ],
      personaMoral: [
        "Acta constitutiva resumida y evidencia de facultades preparada para la demo.",
      ],
    }),
  },
  {
    key: "fraccion-i-juegos",
    fraccion: "Fracción I",
    nombre: "Juegos con apuesta, concursos y sorteos",
    descripcion:
      "Organización o comercialización de juegos con apuesta, concursos, sorteos y entrega de premios en medios físicos o digitales.",
    identificacionUmbralUma: 325,
    avisoUmbralUma: 645,
    obligaciones: {
      sinUmbral: "Llevar registro interno de participantes, premios y medios de pago aun sin llegar al umbral legal.",
      identificacion:
        "Identificar al cliente o ganador al alcanzar 325 UMA acumuladas en el mes, corroborando listas de personas bloqueadas.",
      aviso:
        "Presentar aviso dentro de los 17 días siguientes cuando el monto mensual supere 645 UMA, anexando evidencia de pagos y sorteos.",
    },
    criteriosUif: [
      "Acumular boletos, fichas o créditos del mismo participante durante el mes calendario.",
      "Monitorear canales digitales para detectar operaciones inusuales o repetitivas.",
      "Verificar premios pagados en efectivo o con transferencias de terceros.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Venta de boletos premium",
        descripcion: "Un cliente adquiere boletos de sorteo que suman más de 325 UMA en un mes.",
      },
      {
        titulo: "Pago de premio en efectivo",
        descripcion: "La entrega del premio rebasa 645 UMA, detonando la obligación de aviso.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones({
      vehiculo: ["Documento que vincule al vehículo corporativo con el participante beneficiado."],
    }),
  },
  {
    key: "fraccion-ii-tarjetas-servicios",
    fraccion: "Fracción II",
    nombre: "Tarjetas de crédito o de servicios",
    descripcion:
      "Emisión o comercialización de tarjetas de crédito o servicios por sujetos distintos a instituciones financieras.",
    identificacionUmbralUma: 805,
    avisoUmbralUma: 1285,
    obligaciones: {
      sinUmbral: "Registrar contratos, límites autorizados y medios de fondeo de cada tarjeta.",
      identificacion:
        "Integrar expediente al alcanzar 805 UMA en el mes, incluyendo constancia fiscal y origen de recursos.",
      aviso:
        "Reportar adquisiciones o recargas que superen 1,285 UMA acumuladas, identificando beneficiarios finales.",
    },
    criteriosUif: [
      "Separar operaciones de titulares y adicionales para el cálculo de umbrales.",
      "Monitorear recargas inusuales o pagos anticipados de grandes montos.",
      "Validar transferencias provenientes de cuentas de terceros relacionados.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Recarga corporativa",
        descripcion: "Una empresa recarga tarjetas de servicio para empleados y rebasa 805 UMA en el mes.",
      },
      {
        titulo: "Pago de membresía premium",
        descripcion: "El cliente cubre anualidad y consumo que supera 1,285 UMA, por lo que procede aviso.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones({
      fideicomiso: [
        "Contrato de fideicomiso con facultades para emitir o administrar tarjetas.",
        "Políticas de uso y controles de disposición firmados por los beneficiarios.",
      ],
    }),
  },
  {
    key: "fraccion-ii-tarjetas-prepagadas",
    fraccion: "Fracción II",
    nombre: "Tarjetas prepagadas",
    descripcion:
      "Venta o recarga de tarjetas prepagadas que permiten la acumulación de recursos o transferencias entre usuarios.",
    identificacionUmbralUma: 645,
    avisoUmbralUma: 645,
    obligaciones: {
      sinUmbral: "Controlar números de tarjeta, límites operativos y canales de dispersión.",
      identificacion:
        "Identificar al usuario cuando sus recargas mensuales alcanzan 645 UMA, verificando beneficiarios y destino.",
      aviso:
        "Presentar aviso cuando la suma mensual iguale o supere 645 UMA, detallando movimientos y medios de recarga.",
    },
    criteriosUif: [
      "Sumar recargas y retiros asociados a un mismo RFC o CURP.",
      "Restringir recargas consecutivas realizadas en efectivo.",
      "Monitorear operaciones internacionales vinculadas a la tarjeta.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Recarga en efectivo",
        descripcion: "Un usuario realiza depósitos en ventanilla que en conjunto superan 645 UMA.",
      },
      {
        titulo: "Transferencia entre tarjetas",
        descripcion: "Familiares transfieren saldos entre sí y alcanzan el umbral legal.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-ii-vales",
    fraccion: "Fracción II",
    nombre: "Vales, cupones, monederos electrónicos o certificados",
    descripcion:
      "Emisión o comercialización de vales, cupones y monederos electrónicos que concentren recursos o permitan su redención.",
    identificacionUmbralUma: 645,
    avisoUmbralUma: 645,
    obligaciones: {
      sinUmbral: "Registrar cadenas de distribución y participantes autorizados del programa.",
      identificacion:
        "Integrar expediente del adquirente al alcanzar 645 UMA acumuladas, documentando reglas de canje.",
      aviso:
        "Avisar operaciones que igualen o superen el umbral, señalando usuarios finales y comercios afiliados.",
    },
    criteriosUif: [
      "Conciliar vales emitidos vs. vales redimidos por beneficiario.",
      "Identificar empresas que utilicen monederos para nómina o prestaciones en efectivo.",
      "Supervisar redenciones masivas en establecimientos de alto riesgo.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Programa de recompensas",
        descripcion: "Una empresa entrega monederos electrónicos a su plantilla y rebasa el umbral mensual.",
      },
      {
        titulo: "Venta corporativa de vales",
        descripcion: "La comercialización de cupones para campañas promocionales supera 645 UMA.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones({
      personaMoral: [
        ...baseClienteObligaciones.personaMoral,
        "Inventario de folios emitidos y política interna de uso de monederos.",
      ],
    }),
  },
  {
    key: "fraccion-iii-cheques",
    fraccion: "Fracción III",
    nombre: "Emisión o comercialización de cheques de viajero",
    descripcion:
      "Operaciones que involucren la emisión, comercialización o canje de cheques de viajero por sujetos distintos a instituciones financieras.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 645,
    obligaciones: {
      sinUmbral: "Llevar control cronológico de cheques emitidos y canjeados, identificando punto de venta.",
      identificacion:
        "Identificar siempre a quien adquiere o canjea cheques de viajero sin importar el monto.",
      aviso:
        "Presentar aviso cuando el total mensual por cliente alcance 645 UMA, anexando comprobantes y datos del viaje.",
    },
    criteriosUif: [
      "Verificar que la compra y el canje se realicen por la misma persona.",
      "Solicitar información del origen de los fondos utilizados.",
      "Detectar intentos de fraccionar operaciones entre familiares o terceros.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Compra para viaje",
        descripcion: "Un cliente adquiere cheques por diferentes montos; todos requieren identificación inmediata.",
      },
      {
        titulo: "Canje en efectivo",
        descripcion: "El canje acumulado del mes supera 645 UMA y genera aviso.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-iv-prestamos",
    fraccion: "Fracción IV",
    nombre: "Préstamos o créditos, con o sin garantía",
    descripcion:
      "Otorgamiento habitual de préstamos o créditos, incluyendo esquemas con o sin garantía, por sujetos distintos a instituciones financieras.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 1605,
    obligaciones: {
      sinUmbral: "Documentar análisis de crédito, contratos y bitácora de pagos aun si el monto es menor al umbral.",
      identificacion:
        "Identificar siempre al acreditado, avales y beneficiarios antes de dispersar los recursos.",
      aviso:
        "Reportar operaciones o acumulados que superen 1,605 UMA en el mes, detallando garantías y medios de pago.",
    },
    criteriosUif: [
      "Evaluar coherencia entre flujo de pago y capacidad económica del acreditado.",
      "Controlar créditos revolventes y renovaciones otorgadas al mismo cliente.",
      "Verificar relación entre acreditado y beneficiario final del crédito.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Crédito con garantía prendaria",
        descripcion: "El monto autorizado excede el umbral y debe reportarse.",
      },
      {
        titulo: "Préstamo grupal",
        descripcion: "Se acumulan varios créditos menores al mismo RFC y se supera 1,605 UMA.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones({
      personaMoral: [
        ...baseClienteObligaciones.personaMoral,
        "Estados financieros auditados y flujo proyectado de pago del crédito.",
      ],
    }),
  },
  {
    key: "fraccion-v-inmuebles",
    fraccion: "Fracción V",
    nombre: "Comercialización de bienes inmuebles",
    descripcion:
      "Actividades de construcción, desarrollo, intermediación y compraventa de bienes inmuebles realizadas por particulares.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 8025,
    obligaciones: {
      sinUmbral: "Controlar prospectos, apartados y preventas con soporte contractual y financiero.",
      identificacion:
        "Identificar siempre a compradores, vendedores y coinversionistas, integrando expediente inmobiliario completo.",
      aviso:
        "Reportar operaciones que superen 8,025 UMA acumuladas, anexando contratos, avalúos y medios de pago.",
    },
    criteriosUif: [
      "Vincular pagos anticipados y mensualidades al mismo cliente.",
      "Confirmar beneficiarios finales cuando participen sociedades vehículo.",
      "Monitorear preventas financiadas con recursos de origen extranjero.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Venta de inmueble",
        descripcion: "Se formaliza compraventa con valor superior al umbral de aviso.",
      },
      {
        titulo: "Rentas anticipadas",
        descripcion: "Rentas adelantadas se acumulan y detonan aviso en el mismo periodo.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones({
      vehiculo: [
        "Estructura corporativa del vehículo que participa y cuentas bancarias dedicadas al proyecto.",
      ],
    }),
  },
  {
    key: "fraccion-v-bis-desarrollo",
    fraccion: "Fracción V Bis",
    nombre: "Desarrollo inmobiliario",
    descripcion:
      "Planeación, financiamiento y ejecución de desarrollos inmobiliarios, incluyendo preventas y administración de proyectos.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 8025,
    obligaciones: {
      sinUmbral: "Registrar inversionistas, etapas de obra y fuentes de financiamiento por proyecto.",
      identificacion:
        "Identificar siempre a participantes y documentar flujos de capital y cuentas concentradoras.",
      aviso:
        "Cuando los cobros o aportaciones acumuladas superen 8,025 UMA en el mes, generar aviso o informe 27 Bis según corresponda.",
    },
    criteriosUif: [
      "Dar seguimiento al avance de obra y liberar etapas conforme a flujos recibidos.",
      "Controlar fideicomisos de garantía y administración vinculados al desarrollo.",
      "Identificar vínculos entre inversionistas del mismo grupo empresarial.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Preventas por etapa",
        descripcion: "Pagos iniciales de departamentos superan el umbral mensual y requieren aviso.",
      },
      {
        titulo: "Aportaciones de capital",
        descripcion: "Un inversionista realiza desembolsos recurrentes que activan la obligación de reporte.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones({
      personaMoral: [
        ...baseClienteObligaciones.personaMoral,
        "Plan maestro del desarrollo y presupuesto autorizado por el consejo.",
      ],
    }),
  },
  {
    key: "fraccion-vi-metales",
    fraccion: "Fracción VI",
    nombre: "Comercialización de piedras y metales preciosos, joyas y relojes",
    descripcion:
      "Compra, venta o intermediación de metales y piedras preciosas, joyería fina y relojes de alto valor.",
    identificacionUmbralUma: 805,
    avisoUmbralUma: 1605,
    obligaciones: {
      sinUmbral: "Registrar inventario, proveedores y clientes frecuentes, incluyendo importaciones y exportaciones.",
      identificacion:
        "Integrar expediente al superar 805 UMA en el mes, con facturas, origen de recursos y beneficiario final.",
      aviso:
        "Reportar operaciones que excedan 1,605 UMA detallando piezas, gramajes y medios de pago.",
    },
    criteriosUif: [
      "Vigilar compras en efectivo o transferencias desde jurisdicciones de riesgo.",
      "Controlar ventas recurrentes al mismo cliente dentro del periodo.",
      "Registrar movimientos de mercancía hacia bóvedas o consignaciones.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Compra de joyería",
        descripcion: "Una persona adquiere varias piezas que juntas superan el umbral de identificación.",
      },
      {
        titulo: "Venta de lingotes",
        descripcion: "La comercialización de lingotes excede 1,605 UMA y amerita aviso.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-vii-arte",
    fraccion: "Fracción VII",
    nombre: "Subasta y comercialización de obras de arte",
    descripcion:
      "Organización de subastas, venta o intermediación de obras de arte en galerías físicas o digitales.",
    identificacionUmbralUma: 2410,
    avisoUmbralUma: 4815,
    obligaciones: {
      sinUmbral: "Documentar procedencia, avalúos y contratos de consignación aun sin llegar al umbral.",
      identificacion:
        "Identificar compradores y vendedores cuando la operación alcance 2,410 UMA, incorporando autenticidad y medios de pago.",
      aviso:
        "Avisar transacciones que superen 4,815 UMA, anexando contratos y dictámenes de expertos.",
    },
    criteriosUif: [
      "Verificar autenticidad de la obra y cadena de custodia.",
      "Detectar ofertas fraccionadas o intermediarios recurrentes.",
      "Registrar pagos en efectivo, activos virtuales o transferencias internacionales.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Subasta internacional",
        descripcion: "Un comprador extranjero adquiere una obra que supera el umbral de aviso.",
      },
      {
        titulo: "Venta en galería",
        descripcion: "La venta acumulada de piezas a un mismo coleccionista rebasa 2,410 UMA.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones({
      personaExtranjera: [
        ...baseClienteObligaciones.personaExtranjera,
        "Carta de procedencia lícita o certificado de exportación cuando aplique.",
      ],
    }),
  },
  {
    key: "fraccion-viii-vehiculos",
    fraccion: "Fracción VIII",
    nombre: "Distribución y comercialización de vehículos",
    descripcion:
      "Venta o intermediación de vehículos terrestres, marítimos y aéreos, nuevos o usados.",
    identificacionUmbralUma: 3210,
    avisoUmbralUma: 6420,
    obligaciones: {
      sinUmbral: "Registrar inventario, valuaciones y medios de pago aun sin alcanzar el umbral.",
      identificacion:
        "Identificar a compradores y vendedores cuando las operaciones alcancen 3,210 UMA en el periodo.",
      aviso:
        "Avisar transacciones que superen 6,420 UMA acumuladas, especificando número de serie y forma de pago.",
    },
    criteriosUif: [
      "Revisar pagos en efectivo o transferencias desde cuentas de terceros.",
      "Detectar exportaciones o importaciones recurrentes del mismo cliente.",
      "Validar documentación de procedencia legal del vehículo.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Venta de flota",
        descripcion: "Una empresa adquiere varios vehículos y rebasa el umbral de aviso.",
      },
      {
        titulo: "Compra de embarcación",
        descripcion: "La adquisición de una embarcación de lujo supera 3,210 UMA y requiere identificación inmediata.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones({
      vehiculo: [
        "Poderes de representación y documentos de importación o pedimentos aduanales.",
      ],
    }),
  },
  {
    key: "fraccion-ix-blindaje",
    fraccion: "Fracción IX",
    nombre: "Servicios de blindaje de vehículos y bienes inmuebles",
    descripcion:
      "Prestación de servicios de blindaje, acondicionamiento o modificación de vehículos y bienes inmuebles para protección.",
    identificacionUmbralUma: 2410,
    avisoUmbralUma: 4815,
    obligaciones: {
      sinUmbral: "Documentar cotizaciones, especificaciones técnicas y contratos celebrados.",
      identificacion:
        "Integrar expediente al superar 2,410 UMA, verificando perfil de riesgo del solicitante.",
      aviso:
        "Reportar servicios que excedan 4,815 UMA con detalle de materiales, niveles de blindaje y proveedores involucrados.",
    },
    criteriosUif: [
      "Revisar el destino y usuario final del bien blindado.",
      "Controlar subcontrataciones y proveedores extranjeros.",
      "Validar antecedentes del solicitante en listas restrictivas.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Blindaje nivel V",
        descripcion: "El contrato excede el umbral de aviso por los materiales utilizados.",
      },
      {
        titulo: "Blindaje residencial",
        descripcion: "Las obras de refuerzo en un inmueble superan 2,410 UMA y obligan a identificación.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-x-traslado",
    fraccion: "Fracción X",
    nombre: "Traslado y custodia de dinero o valores",
    descripcion:
      "Empresas que realizan traslado, recolección o custodia de dinero, valores o documentos susceptibles de representar recursos.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 3210,
    obligaciones: {
      sinUmbral: "Mantener bitácoras de rutas, pólizas de seguro y autorizaciones de traslado.",
      identificacion:
        "Identificar siempre al cliente contratante y destinatario aun cuando el monto no sea determinable.",
      aviso:
        "Reportar traslados superiores a 3,210 UMA o aquellos en los que no sea posible conocer el monto trasladado.",
    },
    criteriosUif: [
      "Controlar cargas parciales de un mismo contrato y sus acumulados.",
      "Verificar que custodios y vehículos cuenten con autorizaciones vigentes.",
      "Documentar incidencias y movimientos extraordinarios durante la ruta.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Traslado interbancario",
        descripcion: "El traslado supera 3,210 UMA y se programa aviso dentro de los 17 días.",
      },
      {
        titulo: "Custodia indeterminada",
        descripcion: "No es posible conocer el monto custodiado, por lo que se presenta aviso en todos los casos.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones({
      personaMoral: [
        ...baseClienteObligaciones.personaMoral,
        "Contrato de prestación de servicios con descripción de rutas y montos estimados.",
      ],
    }),
  },
  {
    key: "fraccion-xi-a-inmuebles",
    fraccion: "Fracción XI",
    nombre: "Servicios profesionales: compraventa o cesión de inmuebles",
    descripcion:
      "Profesionales independientes que realizan compraventa de bienes inmuebles o cesión de derechos en representación de clientes.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 0,
    obligaciones: {
      sinUmbral: "Registrar mandatos y alcance del servicio profesional desde su aceptación.",
      identificacion:
        "Identificar siempre al cliente y beneficiario final aun antes de ejecutar la operación.",
      aviso:
        "Presentar aviso cuando, en representación del cliente, se realice cualquier operación financiera vinculada al mandato.",
    },
    criteriosUif: [
      "Documentar poderes notariales y contratos que acrediten la representación.",
      "Conservar la comunicación con el cliente respecto de instrucciones recibidas.",
      "Verificar la procedencia de fondos utilizados para cerrar la operación.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Mandato de compraventa",
        descripcion: "El profesional negocia la compra de un inmueble y debe presentar aviso por la operación realizada.",
      },
      {
        titulo: "Cesión de derechos",
        descripcion: "Se formaliza cesión de derechos litigiosos a nombre del cliente y se reporta por la simple ejecución.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xi-b-administracion",
    fraccion: "Fracción XI",
    nombre: "Servicios profesionales: administración y manejo de recursos",
    descripcion:
      "Profesionales independientes que administran o manejan recursos, valores o cualquier otro activo de sus clientes.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 0,
    obligaciones: {
      sinUmbral: "Documentar instrucciones de administración y controles de segregación de funciones.",
      identificacion:
        "Identificar siempre al titular y beneficiarios de los recursos bajo administración.",
      aviso:
        "Reportar cuando se ejecute una operación financiera en nombre y representación del cliente.",
    },
    criteriosUif: [
      "Conservar evidencia de instrucciones y reportes entregados al cliente.",
      "Revisar transferencias a terceros sin relación aparente.",
      "Verificar que los activos administrados coincidan con el perfil del cliente.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Gestión de portafolio",
        descripcion: "El profesional compra valores a nombre del cliente y presenta aviso por la operación.",
      },
      {
        titulo: "Administración de inmuebles",
        descripcion: "Se cobran rentas y se depositan en cuentas del cliente, generando obligación de reporte.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xi-c-cuentas",
    fraccion: "Fracción XI",
    nombre: "Servicios profesionales: manejo de cuentas bancarias, de ahorro o de valores",
    descripcion:
      "Profesionales independientes que operan cuentas bancarias, de ahorro o de valores en representación de sus clientes.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 0,
    obligaciones: {
      sinUmbral: "Registrar poderes y facultades otorgadas por el cliente antes de operar las cuentas.",
      identificacion:
        "Identificar a titulares, cotitulares y beneficiarios antes de ejecutar movimientos.",
      aviso:
        "Avisar cuando se realicen operaciones financieras a nombre del cliente, independientemente del monto.",
    },
    criteriosUif: [
      "Controlar transferencias internacionales y retiros inusuales.",
      "Verificar instrucciones escritas o electrónicas del cliente.",
      "Revisar coincidencia entre beneficiarios y titulares autorizados.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Transferencia internacional",
        descripcion: "El profesional envía recursos al extranjero por instrucción del cliente; procede aviso.",
      },
      {
        titulo: "Manejo de inversiones",
        descripcion: "Se realizan compras de valores en bolsa a nombre del cliente, generando obligación de reporte.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xi-d-aportaciones",
    fraccion: "Fracción XI",
    nombre: "Servicios profesionales: organización de aportaciones de capital",
    descripcion:
      "Profesionales independientes que organizan aportaciones de capital o recursos para constitución, operación y administración de sociedades mercantiles.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 0,
    obligaciones: {
      sinUmbral: "Conservar acuerdos de intención, contratos de inversión y actas de asamblea.",
      identificacion:
        "Identificar a inversionistas y beneficiarios desde la fase de estructuración.",
      aviso:
        "Avisar cuando se formalicen aportaciones o transferencias de recursos en nombre del cliente.",
    },
    criteriosUif: [
      "Evaluar la procedencia de los recursos aportados por cada inversionista.",
      "Verificar coincidencia entre montos comprometidos y depositados.",
      "Controlar la participación de socios extranjeros o PEPs.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Capital semilla",
        descripcion: "Se integra expediente de inversionistas y se reporta la aportación inicial realizada.",
      },
      {
        titulo: "Incremento de capital",
        descripcion: "El profesional coordina ampliación de capital y debe presentar aviso por los movimientos financieros.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xi-e-corporativo",
    fraccion: "Fracción XI",
    nombre: "Servicios profesionales: constitución, escisión, fusión y administración de personas morales",
    descripcion:
      "Profesionales que constituyen, fusionan, escinden o administran personas morales o vehículos corporativos, incluido el fideicomiso y compraventa de entidades mercantiles.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 0,
    obligaciones: {
      sinUmbral: "Registrar instrucciones, clientes y documentación soporte de cada acto corporativo.",
      identificacion:
        "Identificar siempre a socios, accionistas y beneficiarios finales antes de formalizar actos corporativos.",
      aviso:
        "Avisar cuando se realicen operaciones financieras en representación del cliente relacionadas con la estructura corporativa.",
    },
    criteriosUif: [
      "Evaluar cadenas de titularidad y control efectivo.",
      "Verificar protocolos notariales y registros mercantiles.",
      "Documentar fusiones o adquisiciones transfronterizas.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Constitución de sociedad",
        descripcion: "El profesional constituye una empresa y tramita cuentas bancarias, generando obligación de aviso.",
      },
      {
        titulo: "Fusión de compañías",
        descripcion: "Se trasladan activos y pasivos entre entidades y se documenta ante la autoridad.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xii-notarios-a",
    fraccion: "Fracción XII",
    nombre: "Notarías: transmisión o constitución de derechos reales sobre inmuebles",
    descripcion:
      "Actos notariales que impliquen transmisión o constitución de derechos reales sobre bienes inmuebles.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 8000,
    obligaciones: {
      sinUmbral: "Llevar protocolo y control de cotejo de documentos para cada acto.",
      identificacion:
        "Identificar siempre a otorgantes y beneficiarios finales, verificando origen de recursos.",
      aviso:
        "Presentar aviso cuando el valor del acto alcance 8,000 UMA, señalando datos del inmueble y medios de pago.",
    },
    criteriosUif: [
      "Revisar avalúos y valores catastrales del inmueble.",
      "Controlar operaciones entre partes relacionadas.",
      "Documentar pagos parciales y créditos asociados al acto.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Compraventa notarial",
        descripcion: "El valor declarado excede el umbral y se integra aviso.",
      },
      {
        titulo: "Constitución de hipoteca",
        descripcion: "El valor del inmueble supera 8,000 UMA y se reporta la operación.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xii-notarios-b",
    fraccion: "Fracción XII",
    nombre: "Notarías: poderes irrevocables para actos de administración o dominio",
    descripcion:
      "Otorgamiento de poderes irrevocables para actos de administración o dominio formalizados ante notario.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 0,
    obligaciones: {
      sinUmbral: "Registrar facultades delegadas y vigilar su uso.",
      identificacion:
        "Identificar siempre a otorgante y apoderado, verificando la relación entre ambos.",
      aviso:
        "Avisar en todos los casos debido al riesgo inherente del mandato irrevocable.",
    },
    criteriosUif: [
      "Verificar antecedentes del apoderado y beneficiario final.",
      "Revisar si el poder sustituye o revoca facultades previas.",
      "Documentar límites o condiciones del mandato.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Poder general irrevocable",
        descripcion: "Se otorga poder amplio y debe reportarse de inmediato.",
      },
      {
        titulo: "Delegación de dominio",
        descripcion: "El poder autoriza actos de dominio y requiere aviso aunque no haya monto determinado.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xii-notarios-c",
    fraccion: "Fracción XII",
    nombre: "Notarías: constitución o modificación patrimonial de personas morales",
    descripcion:
      "Constitución de personas morales y modificaciones patrimoniales, fusión o escisión formalizadas ante notario.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 0,
    obligaciones: {
      sinUmbral: "Documentar estructura accionaria, aportaciones y beneficiarios finales.",
      identificacion:
        "Identificar siempre a socios fundadores y representantes legales.",
      aviso:
        "Avisar en todos los casos debido al impacto patrimonial del acto notarial.",
    },
    criteriosUif: [
      "Analizar procedencia de aportaciones patrimoniales.",
      "Detectar reorganizaciones corporativas con fines de ocultamiento.",
      "Revisar vehículos o fideicomisos involucrados en la operación.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Constitución de empresa",
        descripcion: "Se inscribe nueva sociedad y se reporta el acto por la simple realización.",
      },
      {
        titulo: "Escisión patrimonial",
        descripcion: "La división de activos obliga a aviso y análisis reforzado.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xii-notarios-d",
    fraccion: "Fracción XII",
    nombre: "Notarías: fideicomisos traslativos de dominio o garantía",
    descripcion:
      "Constitución o modificación de fideicomisos traslativos de dominio o de garantía formalizados ante notario.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 4000,
    obligaciones: {
      sinUmbral: "Controlar la identificación de partes y bienes fideicomitidos.",
      identificacion:
        "Identificar siempre a fiduciarios, fideicomitentes y fideicomisarios, así como beneficiarios finales.",
      aviso:
        "Avisar cuando el valor de los bienes fideicomitidos alcance 4,000 UMA.",
    },
    criteriosUif: [
      "Revisar el objeto del fideicomiso y destino de los recursos.",
      "Controlar fideicomisos que involucren múltiples inmuebles o garantías cruzadas.",
      "Identificar cambios en el comité técnico o beneficiarios.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Fideicomiso de garantía",
        descripcion: "Se afecta un inmueble valuado en más de 4,000 UMA y se reporta.",
      },
      {
        titulo: "Fideicomiso de administración",
        descripcion: "Aunque no exista monto declarado, se identifica a todas las partes por obligación inherente.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xii-notarios-e",
    fraccion: "Fracción XII",
    nombre: "Notarías: contratos de mutuo o crédito",
    descripcion:
      "Otorgamiento de contratos de mutuo o crédito, con o sin garantía, formalizados ante notario.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 0,
    obligaciones: {
      sinUmbral: "Registrar contrato, garantías y destino de los recursos.",
      identificacion:
        "Identificar a mutuante y mutuario sin importar el monto.",
      aviso:
        "Avisar en todos los casos dada la formalización notarial del crédito.",
    },
    criteriosUif: [
      "Verificar medios de disposición y pagos del crédito.",
      "Documentar avales o fiadores involucrados.",
      "Revisar coincidencia con contratos privados previos.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Mutuo con garantía hipotecaria",
        descripcion: "Se celebra ante notario y debe reportarse independientemente del monto.",
      },
      {
        titulo: "Crédito entre particulares",
        descripcion: "La formalización notarial obliga a identificar y avisar en todos los casos.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xii-corredores-a",
    fraccion: "Fracción XII",
    nombre: "Corredores públicos: avalúos sobre bienes",
    descripcion:
      "Avalúos de bienes muebles o inmuebles realizados por corredores públicos.",
    identificacionUmbralUma: 8025,
    avisoUmbralUma: 8025,
    obligaciones: {
      sinUmbral: "Registrar mandatos y dictámenes emitidos con su documentación soporte.",
      identificacion:
        "Integrar expediente del solicitante cuando el valor de avalúo alcance 8,025 UMA.",
      aviso:
        "Avisar operaciones que superen dicho valor, detallando metodología y destino del avalúo.",
    },
    criteriosUif: [
      "Verificar coherencia entre valor declarado y mercado.",
      "Controlar avalúos recurrentes al mismo cliente.",
      "Documentar bienes valuados en el extranjero o con uso inusual.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Avalúo industrial",
        descripcion: "El valor estimado supera el umbral y debe reportarse.",
      },
      {
        titulo: "Valuación de colección",
        descripcion: "Una colección privada alcanza el límite y se integra aviso.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xii-corredores-b",
    fraccion: "Fracción XII",
    nombre: "Corredores públicos: actos societarios",
    descripcion:
      "Constitución de personas morales mercantiles, modificaciones patrimoniales, fusión o escisión y compraventa de acciones ante corredor público.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 0,
    obligaciones: {
      sinUmbral: "Conservar escrituras, listas de socios y beneficiarios finales.",
      identificacion:
        "Identificar siempre a quienes intervienen en la operación societaria.",
      aviso:
        "Avisar en todos los casos debido al impacto patrimonial del acto formalizado.",
    },
    criteriosUif: [
      "Analizar procedencia de aportaciones y valuación de acciones.",
      "Detectar reorganizaciones corporativas con fines de ocultamiento.",
      "Revisar operaciones transfronterizas o con socios extranjeros.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Constitución mercantil",
        descripcion: "La nueva sociedad se formaliza ante corredor y debe reportarse.",
      },
      {
        titulo: "Venta de acciones",
        descripcion: "Se transmite control accionario y se presenta aviso sin importar el monto.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xii-corredores-c",
    fraccion: "Fracción XII",
    nombre: "Corredores públicos: fideicomisos",
    descripcion:
      "Constitución, modificación o cesión de derechos de fideicomiso formalizadas ante corredor público.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 0,
    obligaciones: {
      sinUmbral: "Identificar a partes, bienes fideicomitidos y finalidad del contrato.",
      identificacion:
        "Identificar siempre a fiduciarios, fideicomitentes y fideicomisarios.",
      aviso:
        "Avisar en todos los casos debido a la transmisión de derechos.",
    },
    criteriosUif: [
      "Controlar transferencias de derechos entre partes relacionadas.",
      "Verificar incorporación de activos extranjeros al fideicomiso.",
      "Monitorear modificaciones al comité técnico.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Cesión de fideicomiso",
        descripcion: "Se cede participación en fideicomiso de inversión y se reporta.",
      },
      {
        titulo: "Constitución de fideicomiso",
        descripcion: "El acto se formaliza ante corredor y genera obligación de aviso inmediato.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xii-corredores-d",
    fraccion: "Fracción XII",
    nombre: "Corredores públicos: mutuos o créditos mercantiles",
    descripcion:
      "Otorgamiento de contratos de mutuo mercantil o créditos mercantiles formalizados ante corredor público.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 0,
    obligaciones: {
      sinUmbral: "Registrar contrato, garantías y destino de los recursos.",
      identificacion:
        "Identificar a mutuante y mutuario sin importar el monto.",
      aviso:
        "Avisar en todos los casos por la formalización mercantil del crédito.",
    },
    criteriosUif: [
      "Verificar flujo de pago y medios de disposición.",
      "Documentar avales o colaterales aportados.",
      "Revisar operaciones vinculadas a otras sociedades del grupo.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Mutuo mercantil",
        descripcion: "Se celebra crédito mercantil ante corredor y se presenta aviso.",
      },
      {
        titulo: "Refinanciamiento",
        descripcion: "El contrato sustituye uno previo y debe reportarse nuevamente.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xii-aduanal-a",
    fraccion: "Fracción XII",
    nombre: "Comercio exterior: vehículos terrestres, aéreos y marítimos",
    descripcion:
      "Prestación de servicios de comercio exterior como agente o apoderado aduanal relacionados con vehículos.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 0,
    obligaciones: {
      sinUmbral: "Registrar pedimentos, importadores y destino final de los vehículos.",
      identificacion:
        "Identificar siempre a clientes y consignatarios, verificando su padrón de importadores.",
      aviso:
        "Avisar todas las operaciones debido al riesgo inherente en la importación o exportación de vehículos.",
    },
    criteriosUif: [
      "Verificar número de serie y documentación de procedencia legal.",
      "Detectar operaciones con destinos finales inusuales.",
      "Controlar pagos anticipados realizados por terceros.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Importación de vehículos de lujo",
        descripcion: "El agente tramita pedimentos y debe presentar aviso.",
      },
      {
        titulo: "Exportación de aeronave",
        descripcion: "Se gestiona salida de aeronave y se documenta ante la autoridad.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xii-aduanal-b",
    fraccion: "Fracción XII",
    nombre: "Comercio exterior: máquinas para juegos y sorteos",
    descripcion:
      "Servicios aduanales relacionados con importación o exportación de máquinas para juegos con apuesta y sorteos.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 0,
    obligaciones: {
      sinUmbral: "Documentar pedimentos, certificados de seguridad y destino de las máquinas.",
      identificacion:
        "Identificar a importador, exportador y destinatario final sin excepción.",
      aviso:
        "Avisar en todos los casos por tratarse de bienes catalogados como de riesgo.",
    },
    criteriosUif: [
      "Verificar autorizaciones de la autoridad competente para operar las máquinas.",
      "Registrar rutas logísticas y resguardos temporales.",
      "Monitorear operaciones recurrentes del mismo grupo empresarial.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Importación de máquinas de casino",
        descripcion: "El agente realiza el despacho y presenta aviso obligatorio.",
      },
      {
        titulo: "Exportación temporal",
        descripcion: "Se envían máquinas a ferias internacionales y se reporta la operación.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xii-aduanal-c",
    fraccion: "Fracción XII",
    nombre: "Comercio exterior: equipos y materiales para tarjetas de pago",
    descripcion:
      "Despacho aduanal de equipos y materiales para la elaboración de tarjetas de pago.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 0,
    obligaciones: {
      sinUmbral: "Registrar lotes, especificaciones técnicas y destinatarios autorizados.",
      identificacion:
        "Identificar a fabricantes, importadores y usuarios finales.",
      aviso:
        "Avisar todas las operaciones debido al potencial de uso ilícito de los materiales.",
    },
    criteriosUif: [
      "Verificar cantidades importadas contra contratos comerciales.",
      "Controlar bodegas temporales y medidas de seguridad.",
      "Monitorear clientes con antecedentes de operaciones inusuales.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Importación de plásticos para tarjetas",
        descripcion: "El despacho se reporta por la simple realización.",
      },
      {
        titulo: "Exportación de chips EMV",
        descripcion: "Se gestiona salida de chips y se genera aviso obligatorio.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xii-aduanal-d",
    fraccion: "Fracción XII",
    nombre: "Comercio exterior: joyas, relojes, metales y piedras preciosas",
    descripcion:
      "Servicios de comercio exterior relacionados con joyas, relojes, metales y piedras preciosas.",
    identificacionUmbralUma: 485,
    avisoUmbralUma: 485,
    obligaciones: {
      sinUmbral: "Conservar manifiestos, facturas y avalúos de las piezas transportadas.",
      identificacion:
        "Identificar al cliente y al destinatario final cuando el valor individual alcance 485 UMA.",
      aviso:
        "Avisar operaciones cuyo valor individual iguale o supere 485 UMA, precisando inventario y resguardos.",
    },
    criteriosUif: [
      "Verificar correspondencia entre pedimento y mercancía valuada.",
      "Controlar traslados temporales para exhibiciones o subastas.",
      "Monitorear clientes con operaciones frecuentes de alto valor.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Importación de joyería de lujo",
        descripcion: "Cada pieza vale más de 485 UMA, por lo que se presenta aviso.",
      },
      {
        titulo: "Exportación para subasta",
        descripcion: "Las obras se envían al extranjero y se documenta su valor individual.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xii-aduanal-e",
    fraccion: "Fracción XII",
    nombre: "Comercio exterior: obras de arte",
    descripcion:
      "Servicios de comercio exterior vinculados con la importación o exportación de obras de arte.",
    identificacionUmbralUma: 4815,
    avisoUmbralUma: 4815,
    obligaciones: {
      sinUmbral: "Registrar certificados de autenticidad, avalúos y embalajes especiales.",
      identificacion:
        "Identificar a clientes cuando el valor individual alcance 4,815 UMA.",
      aviso:
        "Avisar operaciones con obras cuyo valor individual iguale o supere 4,815 UMA, detallando ruta y seguro.",
    },
    criteriosUif: [
      "Verificar permisos de exportación o importación emitidos por autoridad competente.",
      "Controlar movimientos de obras catalogadas como patrimonio.",
      "Monitorear empresas de logística especializadas en arte.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Importación de obra maestra",
        descripcion: "La pieza supera el umbral y se reporta a la autoridad.",
      },
      {
        titulo: "Exportación temporal para exposición",
        descripcion: "Se documenta valor asegurado y se genera aviso.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xii-aduanal-f",
    fraccion: "Fracción XII",
    nombre: "Comercio exterior: materiales de resistencia balística",
    descripcion:
      "Despacho aduanal de materiales y equipos de resistencia balística.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 0,
    obligaciones: {
      sinUmbral: "Registrar licencias, permisos y usuarios finales autorizados.",
      identificacion:
        "Identificar siempre a importadores, exportadores y destino final.",
      aviso:
        "Avisar todas las operaciones por tratarse de bienes estratégicos.",
    },
    criteriosUif: [
      "Verificar autorizaciones de la Secretaría de la Defensa Nacional u otras autoridades.",
      "Controlar rutas de transporte y almacenamiento temporal.",
      "Monitorear solicitudes recurrentes del mismo cliente.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Importación de placas balísticas",
        descripcion: "El despacho requiere aviso por la simple operación.",
      },
      {
        titulo: "Exportación de chalecos",
        descripcion: "Se envía equipo balístico a una filial y se documenta ante la UIF.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xiii-donativos",
    fraccion: "Fracción XIII",
    nombre: "Recepción de donativos por organizaciones sin fines de lucro",
    descripcion:
      "Organizaciones sin fines de lucro que reciben donativos en efectivo o especie.",
    identificacionUmbralUma: 1605,
    avisoUmbralUma: 3210,
    obligaciones: {
      sinUmbral: "Registrar donativos menores y políticas internas de integridad.",
      identificacion:
        "Identificar al donante cuando el monto mensual alcance 1,605 UMA, verificando su situación fiscal.",
      aviso:
        "Reportar donativos que superen 3,210 UMA, especificando destino y evidencia de recepción.",
    },
    criteriosUif: [
      "Vigilar donativos recurrentes de la misma persona o grupo.",
      "Verificar que los recursos se apliquen al objeto social autorizado.",
      "Controlar donativos en especie con valor elevado.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Donativo en efectivo",
        descripcion: "Una persona entrega recursos que superan 1,605 UMA y se integra expediente.",
      },
      {
        titulo: "Donativo en especie",
        descripcion: "Equipo médico donado supera 3,210 UMA y genera aviso.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones({
      personaMoral: [
        ...baseClienteObligaciones.personaMoral,
        "Acta constitutiva con objeto social no lucrativo y comprobante de autorización vigente.",
      ],
    }),
  },
  {
    key: "fraccion-xv-uso-goce",
    fraccion: "Fracción XV",
    nombre: "Derechos personales de uso y goce de bienes inmuebles",
    descripcion:
      "Otorgamiento de derechos personales para el uso o goce de bienes inmuebles, como arrendamientos o usufructos.",
    identificacionUmbralUma: 1605,
    avisoUmbralUma: 3210,
    obligaciones: {
      sinUmbral: "Controlar contratos y pagos programados aun sin alcanzar el umbral.",
      identificacion:
        "Identificar a arrendatarios o usuarios cuando el monto mensual alcance 1,605 UMA.",
      aviso:
        "Avisar cuando los pagos o anticipos superen 3,210 UMA durante el periodo, indicando medios de pago.",
    },
    criteriosUif: [
      "Sumar rentas anticipadas o depósitos que correspondan al mismo contrato.",
      "Verificar uso final del inmueble y vinculación con actividades vulnerables.",
      "Controlar contratos en moneda extranjera y conversiones a pesos.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Arrendamiento corporativo",
        descripcion: "El arrendatario paga rentas por adelantado y rebasa el umbral de aviso.",
      },
      {
        titulo: "Cesión de usufructo",
        descripcion: "La contraprestación por el uso supera 1,605 UMA y obliga a identificar.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones(),
  },
  {
    key: "fraccion-xvi-activos-virtuales",
    fraccion: "Fracción XVI",
    nombre: "Operaciones con activos virtuales",
    descripcion:
      "Prestación habitual de servicios para intercambio, transferencia, resguardo o administración de activos virtuales.",
    identificacionUmbralUma: 0,
    avisoUmbralUma: 210,
    obligaciones: {
      sinUmbral: "Implementar políticas de conocimiento del cliente y monitoreo transaccional en todas las operaciones.",
      identificacion:
        "Identificar siempre a usuarios y beneficiarios finales, verificando su perfil transaccional.",
      aviso:
        "Avisar operaciones cuyo equivalente mensual supere 210 UMA y aquellas que impliquen retiros en efectivo mayores a 4 UMA conforme a las disposiciones.",
    },
    criteriosUif: [
      "Registrar wallets utilizadas y su vinculación con clientes identificados.",
      "Monitorear transferencias internacionales o a jurisdicciones de alto riesgo.",
      "Detectar retiros en efectivo o conversiones rápidas que puedan evadir los umbrales.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Intercambio cripto a moneda local",
        descripcion: "El cliente convierte activos virtuales cuyo valor mensual supera 210 UMA y genera aviso.",
      },
      {
        titulo: "Retiro en efectivo",
        descripcion: "Se retiran activos virtuales por monto equivalente a 4 UMA en efectivo, activando reporte inmediato.",
      },
    ],
    clienteObligaciones: buildClienteObligaciones({
      personaExtranjera: [
        ...baseClienteObligaciones.personaExtranjera,
        "Información sobre jurisdicción de origen de la plataforma o wallet utilizada.",
      ],
    }),
  },
]
