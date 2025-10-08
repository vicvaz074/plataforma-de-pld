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

export const actividadesVulnerables: ActividadVulnerable[] = [
  {
    key: "fraccion-i",
    fraccion: "Fracción I",
    nombre: "Juegos con apuesta, concursos o sorteos",
    descripcion:
      "Incluye la organización de juegos con apuesta, concursos o sorteos, así como la comercialización de boletos o fichas asociadas a dichos eventos.",
    identificacionUmbralUma: 325,
    avisoUmbralUma: 645,
    obligaciones: {
      sinUmbral: "No existe obligación de identificación ni aviso; mantener registro interno de operaciones.",
      identificacion:
        "Obligación de recabar identificación oficial, datos generales, historial de operaciones y verificar listas oficiales.",
      aviso:
        "Obligación de presentar aviso ante el SAT dentro de los 17 días siguientes y mantener expediente completo con evidencia de pagos de premios, fichas o boletos.",
    },
    criteriosUif: [
      "Acumulación mensual por cliente para determinar el umbral.",
      "Control de boletos premiados y premios entregados con evidencia documental.",
      "Seguimiento reforzado a clientes frecuentes o con operaciones inusuales.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Venta de boletos",
        descripcion:
          "Venta de boletos para sorteo navideño o evento especial que acumula operaciones en el mes calendario.",
      },
      {
        titulo: "Entrega de premio",
        descripcion:
          "Pago de premio en efectivo o depósito bancario que rebasa el umbral de aviso en el mes correspondiente.",
      },
    ],
    clienteObligaciones: {
      personaFisica: [
        "Identificación oficial vigente (INE, pasaporte).",
        "CURP y RFC válidos.",
        "Comprobante de domicilio menor a 3 meses.",
        "Declaración del origen de los recursos y perfil transaccional.",
      ],
      personaMoral: [
        "Acta constitutiva inscrita y poderes notariales vigentes.",
        "Identificación del representante legal y estructura accionaria.",
        "RFC y constancia de situación fiscal.",
        "Estado financiero o declaraciones que acrediten capacidad económica.",
      ],
      personaExtranjera: [
        "Pasaporte y documento migratorio vigente.",
        "Comprobante de domicilio del país de residencia o en México.",
        "Declaración de origen de recursos y beneficiario final.",
      ],
      fideicomiso: [
        "Contrato de fideicomiso inscrito.",
        "Identificación de fiduciario, fideicomitente y fideicomisario.",
        "Listado de beneficiarios finales y estructura de control.",
      ],
      vehiculo: [
        "Documentación del vehículo y constancia de propiedad.",
        "Contrato de resguardo o transporte correspondiente.",
      ],
      autoridad: ["Oficio o mandato que respalde la operación y datos del funcionario responsable."],
      otro: ["Justificación documental específica del tipo de cliente."],
    },
  },
  {
    key: "fraccion-ii",
    fraccion: "Fracción II",
    nombre: "Tarjetas de servicios, crédito o prepagadas",
    descripcion:
      "Emisión, comercialización u operación de tarjetas de crédito, servicios, prepagadas o cupones electrónicos por entidades no financieras.",
    identificacionUmbralUma: 805,
    avisoUmbralUma: 1285,
    obligaciones: {
      sinUmbral: "Registrar la operación en el sistema interno y monitorear variaciones del perfil transaccional.",
      identificacion:
        "Integrar expediente con identificación oficial, constancia fiscal y corroborar origen de recursos.",
      aviso:
        "Generar aviso ante el SAT con detalle de recargas, adquisiciones y beneficiarios finales, anexando evidencia documental.",
    },
    criteriosUif: [
      "Separar operaciones de tarjetas de crédito/servicio vs prepagadas.",
      "Controlar recargas acumuladas por cliente en el mes calendario.",
      "Identificar clientes que utilicen múltiples tarjetas de alto monto.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Recarga de tarjeta de servicios",
        descripcion: "Recarga mayor a 805 UMA durante el mes calendario que obliga a identificación.",
      },
      {
        titulo: "Compra de tarjetas prepagadas",
        descripcion: "Venta única o acumulada que supera 1,285 UMA y genera obligación de aviso.",
      },
    ],
    clienteObligaciones: {
      personaFisica: [
        "Identificación oficial, RFC y comprobante de domicilio.",
        "Declaración firmada de uso y destino de los recursos.",
      ],
      personaMoral: [
        "Documentación societaria y representante legal acreditado.",
        "Contrato de prestación de servicios y perfil transaccional autorizado.",
      ],
      personaExtranjera: [
        "Identificación y documento migratorio.",
        "Información bancaria del país de origen cuando aplique.",
      ],
      fideicomiso: [
        "Contrato, listado de fideicomitentes y beneficiarios.",
        "Políticas internas de uso de tarjetas.",
      ],
      vehiculo: ["Documentación que acredite destino de los bienes o servicios adquiridos."],
      autoridad: ["Mandato escrito y autorización presupuestal."],
      otro: ["Documentación complementaria según el giro y riesgo del cliente."],
    },
  },
  {
    key: "fraccion-v",
    fraccion: "Fracción V",
    nombre: "Construcción, desarrollo e intermediación en bienes inmuebles",
    descripcion:
      "Operaciones de compra, venta, arrendamiento o intermediación en bienes inmuebles realizadas por particulares.",
    identificacionUmbralUma: 1605,
    avisoUmbralUma: 8025,
    obligaciones: {
      sinUmbral: "Seguimiento interno de propuestas y control de preventas.",
      identificacion:
        "Integrar expediente con identificación, comprobantes financieros y origen de recursos del comprador o arrendatario.",
      aviso:
        "Presentar aviso por operaciones que superen el umbral acumulado y adjuntar contratos, avalúos y medios de pago.",
    },
    criteriosUif: [
      "Evaluar proyectos por fracciones y etapas de entrega.",
      "Vincular pagos anticipados y mensualidades al mismo cliente para acumulación.",
      "Identificar beneficiarios finales en operaciones de coinversión.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Venta de inmueble",
        descripcion: "Contrato de compraventa que rebasa 8,025 UMA en el mes.",
      },
      {
        titulo: "Arrendamiento",
        descripcion: "Rentas anticipadas que acumuladas exceden 1,605 UMA y obligan a identificación.",
      },
    ],
    clienteObligaciones: {
      personaFisica: [
        "Identificación, RFC, comprobante de domicilio y evidencia de ingresos.",
        "Declaración notariada de beneficiario final en caso de coinversión.",
      ],
      personaMoral: [
        "Acta constitutiva, poderes, estados financieros y estructura accionaria.",
        "Identificación de socios o accionistas con control significativo.",
      ],
      personaExtranjera: [
        "Pasaporte, documento migratorio y constancia fiscal de país de origen.",
        "Declaración de origen de recursos en idioma español.",
      ],
      fideicomiso: [
        "Contrato, participantes, comité técnico y beneficiarios finales.",
        "Autorización de fiduciario para realizar la operación.",
      ],
      vehiculo: ["Documentos de propiedad o contratos de intermediación.", "Factura de adquisición o preventa."],
      autoridad: ["Mandato o convenio interinstitucional con soporte presupuestal."],
      otro: ["Documentación complementaria según el proyecto y riesgo identificado."],
    },
  },
  {
    key: "fraccion-v-bis",
    fraccion: "Fracción V Bis",
    nombre: "Desarrollo inmobiliario",
    descripcion:
      "Actividades de desarrollo inmobiliario, incluyendo preventas, construcción por etapas y administración de proyectos habitacionales o comerciales.",
    identificacionUmbralUma: 3210,
    avisoUmbralUma: 9645,
    obligaciones: {
      sinUmbral: "Registrar prospectos y contratos preliminares en controles internos.",
      identificacion:
        "Integrar expediente de los inversionistas y compradores, con contratos de preventa, flujo financiero y plan de obra.",
      aviso:
        "Preparar aviso cuando los pagos o aportaciones superen el umbral, incluyendo evidencia de transferencias, contratos y avalúos.",
    },
    criteriosUif: [
      "Seguimiento del avance de obra y liberación de etapas para correlacionar flujos.",
      "Control de fideicomisos de garantía y administración vinculados al proyecto.",
      "Identificación de inversionistas relacionados o del mismo grupo empresarial.",
    ],
    ejemplosOperaciones: [
      {
        titulo: "Preventas",
        descripcion: "Pago inicial y mensualidades que superan el umbral de aviso durante la etapa de preventa.",
      },
      {
        titulo: "Aportaciones de inversionistas",
        descripcion:
          "Aportaciones acumuladas de un mismo grupo empresarial que rebasan 9,645 UMA y requieren aviso o informe en ceros conforme al 27 Bis.",
      },
    ],
    clienteObligaciones: {
      personaFisica: [
        "Identificación oficial, RFC, comprobante de domicilio y perfil transaccional.",
        "Declaración del origen lícito de recursos y evidencia bancaria.",
      ],
      personaMoral: [
        "Documentación societaria, poderes, estados financieros auditados y beneficiarios finales.",
        "Contratos de coinversión y acuerdos de colaboración.",
      ],
      personaExtranjera: [
        "Pasaporte, documento migratorio y comprobante de domicilio del país de origen.",
        "Opinión de cumplimiento fiscal o equivalente.",
      ],
      fideicomiso: [
        "Contrato de fideicomiso maestro y anexos.",
        "Identificación de fideicomitentes, fiduciario y fideicomisarios.",
      ],
      vehiculo: [
        "Documentos de sociedades vehículo o desarrolladoras específicas.",
        "Cuentas bancarias dedicadas y controles de obra.",
      ],
      autoridad: ["Convenios de colaboración o inversión con entidades públicas."],
      otro: ["Documentación adicional conforme al grado de riesgo y normativa aplicable."],
    },
  },
]
