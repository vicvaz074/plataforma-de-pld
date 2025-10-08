import { formatCurrency, formatUma, getUmaForMonth, type UmaMonth } from "./uma"

export type ThresholdType = "identificacion" | "aviso"

export interface ThresholdDetail {
  tipo: ThresholdType
  uma: number | "todas"
  descripcion: string
}

export interface SubActivity {
  key: string
  label: string
  descripcion: string
  satCode: string
  thresholds: ThresholdDetail[]
  obligacionesCumplidas: string[]
  obligacionesAviso: string[]
  criteriosUif: string[]
}

export interface VulnerableActivity {
  fraccion: string
  titulo: string
  referenciaLegal: string
  actividades: SubActivity[]
}

export const vulnerableActivities: VulnerableActivity[] = [
  {
    fraccion: "I",
    titulo: "Juegos con apuesta, concursos o sorteos",
    referenciaLegal: "Artículo 17, fracción I de la LFPIORPI y Anexo 2 de las RCG en materia de actividades vulnerables",
    actividades: [
      {
        key: "venta-boletos",
        label: "Venta de boletos y acceso a sorteos",
        descripcion:
          "Incluye la comercialización de boletos, fichas o contraseñas para sorteos, rifas, concursos o juegos con apuesta autorizados.",
        satCode: "101",
        thresholds: [
          {
            tipo: "identificacion",
            uma: 325,
            descripcion: "Identificación obligatoria a partir de 325 UMA por transacción o conjunto de transacciones relacionadas.",
          },
          {
            tipo: "aviso",
            uma: 645,
            descripcion: "Aviso obligatorio al SAT cuando el monto sea igual o superior a 645 UMA por cliente y periodo.",
          },
        ],
        obligacionesCumplidas: [
          "Integrar expediente con identificación oficial vigente, comprobante de domicilio y RFC del participante.",
          "Verificar coincidencia de datos con bases internas y listas de personas bloqueadas de la UIF.",
          "Controlar consecutivo de boletos y medios de pago utilizados en la operación.",
        ],
        obligacionesAviso: [
          "Generar reporte de aviso a través del portal de Prevención de Lavado de Dinero del SAT dentro de los 17 días siguientes.",
          "Adjuntar evidencia documental de la operación, medio de pago y comprobantes fiscales emitidos.",
          "Registrar folio de confirmación del acuse y resguardar XML de envío.",
        ],
        criteriosUif: [
          "Identificar participaciones inusuales en sorteos especiales o con premios extraordinarios.",
          "Corroborar origen de recursos cuando se utilicen pagos en efectivo o transferencias internacionales.",
          "Documentar acumulación de operaciones del mismo cliente y grupo empresarial por mes calendario.",
        ],
      },
      {
        key: "pago-premios",
        label: "Pago y entrega de premios",
        descripcion:
          "Comprende el pago en numerario, especie o transferencia de premios provenientes de juegos con apuesta, concursos o sorteos.",
        satCode: "102",
        thresholds: [
          {
            tipo: "identificacion",
            uma: 325,
            descripcion: "Identificación obligatoria cuando el premio individual o acumulado iguale o supere 325 UMA.",
          },
          {
            tipo: "aviso",
            uma: 645,
            descripcion: "Aviso obligatorio por premios iguales o superiores a 645 UMA dentro del mismo periodo reportable.",
          },
        ],
        obligacionesCumplidas: [
          "Recabar evidencia de la entrega del premio y firma de conformidad del participante.",
          "Registrar el medio de pago empleado y validar su correspondencia con el cliente identificado.",
          "Conservar registro audiovisual o fotográfico cuando la regulación sectorial lo requiera.",
        ],
        obligacionesAviso: [
          "Capturar detalle del premio en el aviso electrónico (tipo, valor comercial y método de entrega).",
          "Adjuntar documentación soporte del pago, incluyendo facturas o recibos timbrados.",
          "Controlar seguimiento posterior cuando el premio sea en especie y su enajenación genere nuevas operaciones reportables.",
        ],
        criteriosUif: [
          "Contrastar frecuencia de premios por cliente frente a patrones habituales del sorteo.",
          "Monitorear clientes vinculados a Personas Políticamente Expuestas o listas restrictivas.",
          "Escalar a la Oficialía de Cumplimiento premios múltiples que superen los umbrales en un semestre móvil.",
        ],
      },
      {
        key: "operacion-financiera",
        label: "Operaciones financieras relacionadas con sorteos",
        descripcion:
          "Movimientos financieros derivados de sorteos, incluyendo fideicomisos, cuentas concentradoras y dispersiones de recursos.",
        satCode: "103",
        thresholds: [
          {
            tipo: "identificacion",
            uma: 325,
            descripcion: "Identificación obligatoria cuando la operación individual iguala o supera 325 UMA.",
          },
          {
            tipo: "aviso",
            uma: 645,
            descripcion: "Aviso obligatorio cuando la suma de operaciones financieras vinculadas al sorteo alcanza 645 UMA por cliente.",
          },
        ],
        obligacionesCumplidas: [
          "Integrar evidencia de la operación bancaria (estado de cuenta, contrato, comprobante de transferencia).",
          "Conciliar con la contabilidad y el folio del sorteo o concurso autorizado.",
          "Verificar beneficiarios finales y posibles terceros involucrados en la transacción.",
        ],
        obligacionesAviso: [
          "Detallar en el aviso los números de cuenta y bancos involucrados, así como referencias de transferencia.",
          "Anexar documentación soporte y comprobantes de origen de los recursos cuando proceda.",
          "Registrar seguimiento posterior cuando la operación se canalice a otro sujeto obligado del mismo grupo empresarial.",
        ],
        criteriosUif: [
          "Dar seguimiento a operaciones trianguladas entre filiales del mismo grupo empresarial.",
          "Identificar aportaciones o retiros inusuales provenientes del extranjero.",
          "Monitorear operaciones escalonadas que busquen fraccionar montos para evitar umbrales.",
        ],
      },
    ],
  },
  {
    fraccion: "II",
    titulo: "Tarjetas de servicios, crédito o prepagadas",
    referenciaLegal: "Artículo 17, fracción II de la LFPIORPI y criterios de interpretación UIF 03/2023",
    actividades: [
      {
        key: "tarjetas-credito-servicio",
        label: "Emisión y comercialización de tarjetas de crédito o de servicios",
        descripcion:
          "Incluye tarjetas bancarias, departamentales y de servicios cuya línea de crédito sea administrada por el sujeto obligado.",
        satCode: "201",
        thresholds: [
          {
            tipo: "identificacion",
            uma: 805,
            descripcion: "Identificación obligatoria por adquisiciones o pagos que alcancen 805 UMA en un periodo de 30 días.",
          },
          {
            tipo: "aviso",
            uma: 1285,
            descripcion: "Aviso obligatorio por operaciones iguales o mayores a 1,285 UMA por cliente y mes calendario.",
          },
        ],
        obligacionesCumplidas: [
          "Validar contrato, estado de cuenta inicial y comprobante de ingresos declarado por el cliente.",
          "Registrar medios de pago utilizados para la liquidación o recarga de la tarjeta.",
          "Aplicar controles reforzados cuando existan pagos en efectivo superiores al umbral de identificación.",
        ],
        obligacionesAviso: [
          "Reportar en el aviso los números de cuenta asociados, montos, moneda y frecuencia de recargas o pagos.",
          "Adjuntar evidencia documental de la operación (contrato, comprobantes de pago, CFDI emitidos).",
          "Monitorear acumulación de pagos durante el semestre móvil conforme a los criterios de la UIF.",
        ],
        criteriosUif: [
          "Atender incrementos súbitos de línea de crédito sin soporte económico del cliente.",
          "Detectar múltiples tarjetas a nombre de personas relacionadas o dentro del mismo grupo empresarial.",
          "Corroborar coincidencia entre domicilio declarado y geolocalización de operaciones.",
        ],
      },
      {
        key: "tarjetas-prepagadas",
        label: "Tarjetas prepagadas, vales y monederos electrónicos",
        descripcion:
          "Considera tarjetas de regalo, monederos electrónicos y vales emitidos o comercializados por el sujeto obligado.",
        satCode: "202",
        thresholds: [
          {
            tipo: "identificacion",
            uma: 645,
            descripcion: "Identificación obligatoria a partir de la emisión o recarga equivalente a 645 UMA.",
          },
          {
            tipo: "aviso",
            uma: 1285,
            descripcion: "Aviso obligatorio cuando el valor de la tarjeta prepagada o vale alcanza 1,285 UMA por cliente.",
          },
        ],
        obligacionesCumplidas: [
          "Integrar expediente del adquirente y del beneficiario final de la tarjeta.",
          "Registrar número de serie y condiciones de uso o redención del vale.",
          "Aplicar monitoreo reforzado cuando existan múltiples tarjetas asignadas a un mismo RFC.",
        ],
        obligacionesAviso: [
          "Detallar en el aviso la forma de recarga, limitantes de uso y sucursales involucradas.",
          "Adjuntar contrato o términos y condiciones firmados por el cliente.",
          "Generar seguimiento trimestral de operaciones recurrentes para identificar fraccionamiento.",
        ],
        criteriosUif: [
          "Identificar compras masivas de tarjetas sin justificación comercial.",
          "Analizar operaciones realizadas por intermediarios o brokers sin contrato formal.",
          "Monitorear devoluciones en efectivo o reembolsos a cuentas de terceros.",
        ],
      },
    ],
  },
  {
    fraccion: "III",
    titulo: "Emisión o comercialización de cheques de viajero (no financieros)",
    referenciaLegal: "Artículo 17, fracción III de la LFPIORPI",
    actividades: [
      {
        key: "cheques-viajero",
        label: "Venta o entrega de cheques de viajero",
        descripcion:
          "Operaciones de emisión, comercialización, distribución o adquisición de cheques de viajero por parte de entidades no financieras.",
        satCode: "301",
        thresholds: [
          {
            tipo: "identificacion",
            uma: 215,
            descripcion: "Identificación obligatoria a partir de 215 UMA por operación o conjunto de operaciones en un mes.",
          },
          {
            tipo: "aviso",
            uma: 645,
            descripcion: "Aviso obligatorio cuando los cheques de viajero alcanzan 645 UMA por cliente.",
          },
        ],
        obligacionesCumplidas: [
          "Validar origen de los fondos y justificar el destino del viaje declarado.",
          "Resguardar comprobantes de venta y formularios de declaración aduanera cuando aplique.",
          "Registrar número de serie y entidad emisora del cheque.",
        ],
        obligacionesAviso: [
          "Adjuntar copia digital del cheque, identificación y comprobante de pago.",
          "Reportar la moneda de emisión y el país de destino estimado.",
          "Informar sobre reembolsos o cancelaciones posteriores dentro del mismo periodo.",
        ],
        criteriosUif: [
          "Monitorear compras reiteradas de cheques de viajero por el mismo beneficiario.",
          "Identificar clientes con vínculos en jurisdicciones de riesgo elevado.",
          "Escalar operaciones que involucren múltiples intermediarios o terceros adquirentes.",
        ],
      },
    ],
  },
  {
    fraccion: "IV",
    titulo: "Mutuo, garantía, préstamos o créditos",
    referenciaLegal: "Artículo 17, fracción IV de la LFPIORPI",
    actividades: [
      {
        key: "mutuos-creditos",
        label: "Otorgamiento de mutuos, préstamos o créditos",
        descripcion:
          "Operaciones de financiamiento realizadas por personas distintas a entidades financieras, incluyendo garantías y factoraje.",
        satCode: "401",
        thresholds: [
          {
            tipo: "identificacion",
            uma: "todas",
            descripcion: "Identificación obligatoria en todos los préstamos, sin importar el monto, de conformidad con las RCG.",
          },
          {
            tipo: "aviso",
            uma: 1605,
            descripcion: "Aviso obligatorio cuando el monto otorgado o amortizado sea igual o superior a 1,605 UMA por cliente.",
          },
        ],
        obligacionesCumplidas: [
          "Integrar expediente crediticio, análisis de capacidad de pago y dictamen interno.",
          "Obtener declaración de origen de recursos y destino del crédito.",
          "Registrar garantías aportadas y avalúos correspondientes.",
        ],
        obligacionesAviso: [
          "Detallar condiciones financieras (plazo, tasa, garantías) en el aviso electrónico.",
          "Anexar contrato, estados de cuenta y recibos de pago.",
          "Monitorear pagos anticipados o liquidaciones en efectivo que rebasen el umbral.",
        ],
        criteriosUif: [
          "Identificar estructuras de crédito entre empresas relacionadas que carezcan de sustancia económica.",
          "Detectar préstamos cruzados con terceros sin relación comercial aparente.",
          "Evaluar riesgo incrementado cuando existan clientes de alto perfil o PEP.",
        ],
      },
    ],
  },
  {
    fraccion: "V",
    titulo: "Construcción, desarrollo e intermediación en bienes inmuebles",
    referenciaLegal: "Artículo 17, fracción V de la LFPIORPI",
    actividades: [
      {
        key: "intermediacion-inmobiliaria",
        label: "Intermediación y comercialización de bienes inmuebles",
        descripcion:
          "Servicios de compra-venta, arrendamiento y administración de inmuebles residenciales o comerciales.",
        satCode: "501",
        thresholds: [
          {
            tipo: "identificacion",
            uma: "todas",
            descripcion: "Identificación obligatoria para toda operación inmobiliaria administrada por el sujeto obligado.",
          },
          {
            tipo: "aviso",
            uma: 8025,
            descripcion: "Aviso obligatorio cuando el valor del inmueble sea igual o superior a 8,025 UMA por acto u operación.",
          },
        ],
        obligacionesCumplidas: [
          "Resguardar contratos, avalúos registrados y comprobantes de pago.",
          "Verificar la relación entre comprador, vendedor y beneficiario final.",
          "Registrar forma de pago y cuentas bancarias utilizadas.",
        ],
        obligacionesAviso: [
          "Incluir datos catastrales, ubicación y características del inmueble en el aviso.",
          "Adjuntar identificación de todas las partes y poderes notariales.",
          "Conservar evidencia de pagos parciales, anticipos y financiamiento asociado.",
        ],
        criteriosUif: [
          "Monitorear operaciones en efectivo o con recursos provenientes del extranjero.",
          "Verificar vinculación entre compradores y desarrolladores del mismo grupo empresarial.",
          "Analizar operaciones sucesivas sobre el mismo inmueble dentro de un semestre móvil.",
        ],
      },
    ],
  },
  {
    fraccion: "V Bis",
    titulo: "Desarrollo inmobiliario",
    referenciaLegal: "Artículo 17, fracción V Bis de la LFPIORPI (Decreto DOF 20/01/2023) y Anexo 2 RCG",
    actividades: [
      {
        key: "preventas-desarrollos",
        label: "Preventas y financiamiento de desarrollos inmobiliarios",
        descripcion:
          "Operaciones de preventa, construcción y financiamiento directo de desarrollos inmobiliarios residenciales, comerciales o turísticos.",
        satCode: "505",
        thresholds: [
          {
            tipo: "identificacion",
            uma: 3210,
            descripcion: "Identificación obligatoria cuando el anticipo, pago o financiamiento alcance 3,210 UMA por cliente.",
          },
          {
            tipo: "aviso",
            uma: 6420,
            descripcion: "Aviso obligatorio cuando la operación vinculada al desarrollo supere 6,420 UMA por acto u operación.",
          },
        ],
        obligacionesCumplidas: [
          "Documentar contrato de preventa, fideicomiso maestro y cuentas concentradoras.",
          "Identificar inversionistas, compradores y desarrolladores participantes, incluyendo beneficiarios finales.",
          "Verificar licencias de construcción y permisos municipales vigentes.",
        ],
        obligacionesAviso: [
          "Reportar ubicación del proyecto, etapa constructiva y avance físico-financiero.",
          "Adjuntar estados de cuenta de fideicomisos o cuentas escrow vinculadas.",
          "Registrar integración de anticipos, aportaciones y retiros por cada condómino o inversionista.",
        ],
        criteriosUif: [
          "Analizar operaciones cruzadas entre compradores del mismo grupo empresarial para evitar avisos.",
          "Monitorear pagos en efectivo o transferencias internacionales que financien el desarrollo.",
          "Evaluar perfiles de riesgo alto cuando el proyecto se ubique en zonas con incidencia delictiva elevada.",
        ],
      },
      {
        key: "administracion-inmobiliaria",
        label: "Administración de recursos para desarrollo inmobiliario",
        descripcion:
          "Incluye administración de anticipos, fideicomisos y fondos destinados a la construcción o urbanización de inmuebles.",
        satCode: "506",
        thresholds: [
          {
            tipo: "identificacion",
            uma: 1605,
            descripcion: "Identificación obligatoria cuando la administración de recursos alcance 1,605 UMA por cliente dentro del periodo.",
          },
          {
            tipo: "aviso",
            uma: 3210,
            descripcion: "Aviso obligatorio por manejo de recursos iguales o superiores a 3,210 UMA relacionados con el desarrollo.",
          },
        ],
        obligacionesCumplidas: [
          "Conciliar movimientos de cuentas administradas y emitir reportes financieros mensuales.",
          "Identificar origen de recursos aportados por cada participante.",
          "Registrar contratos de administración y estructura de gobierno del proyecto.",
        ],
        obligacionesAviso: [
          "Detallar en el aviso las cuentas, bancos y beneficiarios de los recursos administrados.",
          "Adjuntar estados de cuenta, contratos y autorizaciones de disposición.",
          "Registrar seguimiento posterior a la presentación del aviso y reinicio de acumulación.",
        ],
        criteriosUif: [
          "Supervisar traspasos entre cuentas espejo o controladoras sin sustento documental.",
          "Detectar inyecciones de capital desde paraísos fiscales o jurisdicciones de riesgo.",
          "Evaluar riesgo de lavado mediante compra masiva de unidades por un mismo grupo empresarial.",
        ],
      },
    ],
  },
  {
    fraccion: "VI",
    titulo: "Comercialización de metales y piedras preciosas, joyas o relojes",
    referenciaLegal: "Artículo 17, fracción VI de la LFPIORPI",
    actividades: [
      {
        key: "metales-preciosos",
        label: "Compra y venta de metales y joyería",
        descripcion:
          "Incluye oro, plata, platino, gemas, relojería fina y piezas de colección valuadas por unidad.",
        satCode: "601",
        thresholds: [
          {
            tipo: "identificacion",
            uma: 805,
            descripcion: "Identificación obligatoria a partir de 805 UMA por transacción o conjunto de transacciones en un mes.",
          },
          {
            tipo: "aviso",
            uma: 1605,
            descripcion: "Aviso obligatorio cuando el valor total alcance 1,605 UMA.",
          },
        ],
        obligacionesCumplidas: [
          "Verificar origen lícito de las piezas y documentación de propiedad.",
          "Registrar peso, quilataje y número de certificado de autenticidad.",
          "Aplicar medidas reforzadas a clientes frecuentes que paguen en efectivo.",
        ],
        obligacionesAviso: [
          "Adjuntar factura, certificado gemológico y evidencia fotográfica de la pieza.",
          "Detallar forma de pago, divisa y ubicación de entrega.",
          "Registrar seguimiento de reventas o empeños posteriores.",
        ],
        criteriosUif: [
          "Monitorear compras sucesivas que aparenten fraccionamiento.",
          "Identificar exportaciones inmediatas sin documentación aduanera adecuada.",
          "Evaluar riesgo cuando intervienen terceros sin vínculo patrimonial comprobable.",
        ],
      },
    ],
  },
  {
    fraccion: "VII",
    titulo: "Comercialización o subasta de obras de arte",
    referenciaLegal: "Artículo 17, fracción VII de la LFPIORPI",
    actividades: [
      {
        key: "obras-arte",
        label: "Compra, venta y subasta de obras de arte",
        descripcion:
          "Operaciones de adquisición, consignación y subasta de obras pictóricas, esculturas, antigüedades y piezas coleccionables.",
        satCode: "701",
        thresholds: [
          {
            tipo: "identificacion",
            uma: 2410,
            descripcion: "Identificación obligatoria cuando el valor de la obra alcanza 2,410 UMA.",
          },
          {
            tipo: "aviso",
            uma: 4815,
            descripcion: "Aviso obligatorio por transacciones de 4,815 UMA o más.",
          },
        ],
        obligacionesCumplidas: [
          "Documentar autenticidad, procedencia y certificaciones.",
          "Registrar inventarios y pólizas de seguro aplicables.",
          "Realizar debida diligencia reforzada con coleccionistas y marchantes internacionales.",
        ],
        obligacionesAviso: [
          "Adjuntar certificado de autenticidad, avalúo y contrato de compraventa.",
          "Detallar ubicación de la obra y condiciones de custodia.",
          "Registrar beneficiarios finales cuando existan intermediarios o galerías asociadas.",
        ],
        criteriosUif: [
          "Identificar adquisiciones realizadas a través de fundaciones o trusts extranjeros.",
          "Monitorear incremento atípico de valores declarados respecto al mercado.",
          "Escalar operaciones vinculadas a listas restrictivas internacionales.",
        ],
      },
    ],
  },
  {
    fraccion: "VIII",
    titulo: "Comercialización o distribución habitual de vehículos",
    referenciaLegal: "Artículo 17, fracción VIII de la LFPIORPI",
    actividades: [
      {
        key: "venta-vehiculos",
        label: "Venta y distribución de vehículos terrestres, marítimos o aéreos",
        descripcion:
          "Incluye automóviles, motocicletas, camiones, embarcaciones y aeronaves nuevas o usadas.",
        satCode: "801",
        thresholds: [
          {
            tipo: "identificacion",
            uma: 3210,
            descripcion: "Identificación obligatoria a partir de 3,210 UMA por operación.",
          },
          {
            tipo: "aviso",
            uma: 6420,
            descripcion: "Aviso obligatorio cuando la venta alcance 6,420 UMA.",
          },
        ],
        obligacionesCumplidas: [
          "Registrar número de serie, placas y documentación de propiedad.",
          "Verificar origen de recursos y coincidencia con el perfil transaccional del cliente.",
          "Aplicar controles para pagos fraccionados o combinados en distintas divisas.",
        ],
        obligacionesAviso: [
          "Detallar características del vehículo, valor, forma de pago y entregas parciales.",
          "Adjuntar contrato, factura electrónica y comprobantes de pago.",
          "Monitorear acumulación semestral de operaciones relacionadas con el mismo vehículo o cliente.",
        ],
        criteriosUif: [
          "Identificar compras realizadas por representantes o terceros sin justificación.",
          "Monitorear exportaciones inmediatas y ventas en zonas fronterizas.",
          "Escalar operaciones que involucren conversiones de divisas en efectivo.",
        ],
      },
    ],
  },
  {
    fraccion: "IX",
    titulo: "Servicios de blindaje de vehículos o inmuebles",
    referenciaLegal: "Artículo 17, fracción IX de la LFPIORPI",
    actividades: [
      {
        key: "servicios-blindaje",
        label: "Blindaje de vehículos, inmuebles y bienes móviles",
        descripcion:
          "Servicios de instalación de blindaje, materiales balísticos y adecuaciones de seguridad.",
        satCode: "901",
        thresholds: [
          {
            tipo: "identificacion",
            uma: 2410,
            descripcion: "Identificación obligatoria por contratos iguales o mayores a 2,410 UMA.",
          },
          {
            tipo: "aviso",
            uma: 4815,
            descripcion: "Aviso obligatorio por contratos iguales o mayores a 4,815 UMA.",
          },
        ],
        obligacionesCumplidas: [
          "Registrar especificaciones técnicas del blindaje y certificaciones del proveedor.",
          "Documentar la cadena de custodia de los materiales utilizados.",
          "Verificar identidad y perfil de riesgo del beneficiario final del servicio.",
        ],
        obligacionesAviso: [
          "Detallar nivel de blindaje, valor de los materiales y plazos de ejecución.",
          "Adjuntar contrato, comprobantes de pago y autorizaciones de importación si aplica.",
          "Registrar seguimiento de mantenimientos posteriores vinculados a la operación.",
        ],
        criteriosUif: [
          "Monitorear blindajes solicitados por personas con antecedentes delictivos o sin actividad económica comprobable.",
          "Identificar pagos realizados en efectivo o a través de empresas fachada.",
          "Escalar operaciones vinculadas a grupos empresariales con señalamientos de riesgo.",
        ],
      },
    ],
  },
  {
    fraccion: "X",
    titulo: "Servicios de traslado o custodia de dinero o valores",
    referenciaLegal: "Artículo 17, fracción X de la LFPIORPI",
    actividades: [
      {
        key: "custodia-valores",
        label: "Traslado y custodia de valores",
        descripcion:
          "Incluye transporte, custodia y administración temporal de dinero en efectivo, valores o documentos de titularidad.",
        satCode: "1001",
        thresholds: [
          {
            tipo: "identificacion",
            uma: "todas",
            descripcion: "Identificación obligatoria en todas las operaciones de custodia o traslado de valores.",
          },
          {
            tipo: "aviso",
            uma: 3210,
            descripcion: "Aviso obligatorio cuando el valor transportado o custodiado sea igual o mayor a 3,210 UMA.",
          },
        ],
        obligacionesCumplidas: [
          "Documentar rutas, horarios y protocolos de seguridad.",
          "Registrar pólizas de seguro, participantes y medios de transporte utilizados.",
          "Verificar identidad de remitente y destinatario, incluyendo beneficiario final.",
        ],
        obligacionesAviso: [
          "Detallar valor declarado, moneda, tipo de valores y custodia durante el traslado.",
          "Adjuntar contrato y orden de servicio firmada.",
          "Registrar incidentes o desviaciones detectadas durante el servicio.",
        ],
        criteriosUif: [
          "Identificar traslados reiterados hacia centros cambiarios o casas de empeño de alto riesgo.",
          "Monitorear operaciones con rutas internacionales o zonas de seguridad limitada.",
          "Escalar operaciones que concentren valores sin sustento contractual.",
        ],
      },
    ],
  },
  {
    fraccion: "XI",
    titulo: "Servicios profesionales independientes",
    referenciaLegal: "Artículo 17, fracción XI de la LFPIORPI",
    actividades: [
      {
        key: "servicios-profesionales",
        label: "Servicios de consultoría financiera, fiduciaria o corporativa",
        descripcion:
          "Profesionales que gestionan recursos, constituyen sociedades, fideicomisos o realizan operaciones financieras a nombre de clientes.",
        satCode: "1101",
        thresholds: [
          {
            tipo: "identificacion",
            uma: "todas",
            descripcion: "Identificación obligatoria cuando el profesional actúe en nombre y representación del cliente en operaciones señaladas.",
          },
          {
            tipo: "aviso",
            uma: 1605,
            descripcion: "Aviso obligatorio cuando el valor de la operación gestionada alcance 1,605 UMA.",
          },
        ],
        obligacionesCumplidas: [
          "Conservar mandato, poderes y contratos de prestación de servicios profesionales.",
          "Verificar beneficiarios finales de las estructuras jurídicas creadas o administradas.",
          "Registrar operaciones y movimientos financieros realizados a nombre del cliente.",
        ],
        obligacionesAviso: [
          "Detallar tipo de acto jurídico, montos y cuentas utilizadas en el aviso electrónico.",
          "Adjuntar contratos, escrituras y documentos notariales relevantes.",
          "Registrar seguimiento cuando existan operaciones posteriores derivadas del mandato.",
        ],
        criteriosUif: [
          "Evaluar riesgo incrementado cuando el profesional administre activos offshore.",
          "Identificar constitución de sociedades sin actividad económica aparente.",
          "Monitorear cambios frecuentes de representantes legales o apoderados.",
        ],
      },
    ],
  },
  {
    fraccion: "XII",
    titulo: "Servicios de fe pública",
    referenciaLegal: "Artículo 17, fracción XII de la LFPIORPI",
    actividades: [
      {
        key: "notarios-corredores",
        label: "Notarios y corredores públicos",
        descripcion:
          "Actos de fe pública relacionados con transmisión de dominio, otorgamiento de poderes, constitución de garantías y sociedades.",
        satCode: "1201",
        thresholds: [
          {
            tipo: "identificacion",
            uma: "todas",
            descripcion: "Identificación obligatoria conforme a los actos previstos en la fracción XII y reglas aplicables.",
          },
          {
            tipo: "aviso",
            uma: 8025,
            descripcion: "Aviso obligatorio cuando el valor del acto jurídico alcance 8,025 UMA (aplicable a transmisión de dominio e hipotecas).",
          },
        ],
        obligacionesCumplidas: [
          "Integrar protocolo con identificación de otorgantes, comparecientes y beneficiarios finales.",
          "Verificar pagos de impuestos y derechos correspondientes.",
          "Registrar avalúos, cuentas bancarias y medios de pago.",
        ],
        obligacionesAviso: [
          "Reportar datos del acto notarial, folio y detalles de inmueble o sociedad.",
          "Adjuntar copia certificada digitalizada y comprobantes de pago.",
          "Registrar seguimiento de operaciones subsecuentes vinculadas al acto.",
        ],
        criteriosUif: [
          "Monitorear actos repetitivos sobre la misma sociedad o inmueble.",
          "Detectar constitución de fideicomisos con estructuras complejas sin sustento económico.",
          "Escalar operaciones con beneficiarios ubicados en jurisdicciones de riesgo.",
        ],
      },
    ],
  },
  {
    fraccion: "XIII",
    titulo: "Uso de préstamos o créditos para adquisición de bienes",
    referenciaLegal: "Artículo 17, fracción XIII de la LFPIORPI",
    actividades: [
      {
        key: "intermediacion-crediticia",
        label: "Intermediación financiera para adquisición de bienes",
        descripcion:
          "Personas morales o físicas que intermedien préstamos o créditos para adquisición de bienes inmuebles o vehículos.",
        satCode: "1301",
        thresholds: [
          {
            tipo: "identificacion",
            uma: 1605,
            descripcion: "Identificación obligatoria cuando el préstamo intermediado alcance 1,605 UMA.",
          },
          {
            tipo: "aviso",
            uma: 3210,
            descripcion: "Aviso obligatorio cuando el préstamo o crédito supere 3,210 UMA.",
          },
        ],
        obligacionesCumplidas: [
          "Documentar mandato, contrato de intermediación y beneficiario final del financiamiento.",
          "Verificar origen de recursos del acreditado y destino del préstamo.",
          "Controlar dispersión de recursos y pagos.",
        ],
        obligacionesAviso: [
          "Detallar monto total, plazos y garantías en el aviso.",
          "Adjuntar estados de cuenta, comprobantes de pago y documentación del bien adquirido.",
          "Monitorear amortizaciones anticipadas o pagos en efectivo posteriores.",
        ],
        criteriosUif: [
          "Detectar estructuras de crédito cruzadas entre empresas vinculadas.",
          "Analizar operaciones respaldadas por bienes sobrevaluados.",
          "Escalar operaciones con colaterales ubicados en zonas de alto riesgo.",
        ],
      },
    ],
  },
  {
    fraccion: "XIV",
    titulo: "Servicios de construcción o desarrollo de infraestructura",
    referenciaLegal: "Artículo 17, fracción XIV de la LFPIORPI",
    actividades: [
      {
        key: "infraestructura",
        label: "Construcción y desarrollo de infraestructura",
        descripcion:
          "Contratos de obra pública o privada relacionados con infraestructura logística, energética o de transporte.",
        satCode: "1401",
        thresholds: [
          {
            tipo: "identificacion",
            uma: 3210,
            descripcion: "Identificación obligatoria cuando el contrato supere 3,210 UMA.",
          },
          {
            tipo: "aviso",
            uma: 6420,
            descripcion: "Aviso obligatorio por contratos iguales o mayores a 6,420 UMA.",
          },
        ],
        obligacionesCumplidas: [
          "Documentar licitaciones, contratos y garantías de cumplimiento.",
          "Verificar origen de recursos y estructura accionaria de contratistas.",
          "Registrar avances físicos y financieros certificados.",
        ],
        obligacionesAviso: [
          "Detallar ubicación, objeto del contrato y flujo financiero en el aviso.",
          "Adjuntar estimaciones, bitácoras y comprobantes de pago.",
          "Registrar seguimiento al reinicio de acumulación tras presentar el aviso.",
        ],
        criteriosUif: [
          "Monitorear subcontrataciones a empresas sin capacidad operativa.",
          "Detectar pagos anticipados desproporcionados respecto al avance físico.",
          "Escalar operaciones con financiamiento de origen opaco.",
        ],
      },
    ],
  },
  {
    fraccion: "XV",
    titulo: "Arrendamiento de bienes muebles",
    referenciaLegal: "Artículo 17, fracción XV de la LFPIORPI",
    actividades: [
      {
        key: "arrendamiento",
        label: "Arrendamiento de bienes muebles",
        descripcion:
          "Arrendamiento de bienes muebles, maquinaria, equipo de transporte y similares cuando el arrendador no sea entidad financiera.",
        satCode: "1501",
        thresholds: [
          {
            tipo: "identificacion",
            uma: 1605,
            descripcion: "Identificación obligatoria cuando la renta mensual o anticipo sea igual o superior a 1,605 UMA.",
          },
          {
            tipo: "aviso",
            uma: 3210,
            descripcion: "Aviso obligatorio cuando el contrato alcance 3,210 UMA por acto u operación.",
          },
        ],
        obligacionesCumplidas: [
          "Verificar existencia física del bien y su valuación.",
          "Registrar origen de recursos del arrendatario y beneficiario final del uso del bien.",
          "Controlar pagos parciales, depósitos en garantía y penalizaciones.",
        ],
        obligacionesAviso: [
          "Detallar características del bien, plazo del contrato y forma de pago.",
          "Adjuntar contrato, estados de cuenta y comprobantes fiscales.",
          "Registrar seguimiento cuando existan subarrendamientos no autorizados.",
        ],
        criteriosUif: [
          "Monitorear rotación recurrente de bienes arrendados a un mismo cliente.",
          "Detectar pagos en efectivo o triangulados a través de terceros.",
          "Escalar operaciones con bienes de alto valor estratégico (aeronaves, maquinaria especializada).",
        ],
      },
    ],
  },
  {
    fraccion: "XVI",
    titulo: "Servicios de comercio exterior de activos virtuales",
    referenciaLegal: "Artículo 17, fracción XVI de la LFPIORPI",
    actividades: [
      {
        key: "activos-virtuales",
        label: "Intercambio o transferencia de activos virtuales",
        descripcion:
          "Operaciones de intercambio entre activos virtuales y moneda de curso legal, custodia de wallets y transferencias internacionales.",
        satCode: "1601",
        thresholds: [
          {
            tipo: "identificacion",
            uma: 645,
            descripcion: "Identificación obligatoria cuando el valor de la operación con activos virtuales alcance 645 UMA.",
          },
          {
            tipo: "aviso",
            uma: 1605,
            descripcion: "Aviso obligatorio por operaciones iguales o superiores a 1,605 UMA en un mes calendario.",
          },
        ],
        obligacionesCumplidas: [
          "Verificar la titularidad de las direcciones públicas y wallets utilizadas.",
          "Registrar hashes, identificadores de transacción y contraparte participante.",
          "Implementar análisis blockchain para detectar vínculos con direcciones de riesgo.",
        ],
        obligacionesAviso: [
          "Detallar en el aviso la red utilizada, identificadores de transacción y custodios intervinientes.",
          "Adjuntar capturas o reportes blockchain que acrediten la operación.",
          "Registrar seguimiento reforzado posterior a la presentación del aviso.",
        ],
        criteriosUif: [
          "Monitorear operaciones con mixers, tumblers o exchanges no regulados.",
          "Identificar transferencias a jurisdicciones con regulación laxa o inexistente.",
          "Escalar operaciones vinculadas a mercados darknet o ransomware.",
        ],
      },
    ],
  },
]

export interface UmaCalculationResult {
  month: UmaMonth
  umaValue?: number
  thresholdUma: number | "todas"
  thresholdInPesos?: number
}

export const calculateThreshold = (
  month: UmaMonth | null,
  thresholdUma: number | "todas",
): UmaCalculationResult | null => {
  if (!month) return null
  if (thresholdUma === "todas") {
    return { month, thresholdUma }
  }
  const period = getUmaForMonth(month.year, month.month)
  if (!period) {
    return { month, thresholdUma, umaValue: undefined, thresholdInPesos: undefined }
  }
  const amount = period.daily * thresholdUma
  return {
    month,
    umaValue: period.daily,
    thresholdUma,
    thresholdInPesos: amount,
  }
}

export const describeThreshold = (calculation: UmaCalculationResult | null) => {
  if (!calculation) return "Selecciona mes y año para calcular el umbral.";
  if (calculation.thresholdUma === "todas") {
    return "Aplica identificación en todas las operaciones sin importar el monto.";
  }
  if (!calculation.thresholdInPesos) {
    return "UMA del periodo aún no publicada. Verifica nuevamente cuando el SAT emita la actualización anual.";
  }
  return `${formatUma(calculation.thresholdUma)} (${formatCurrency(calculation.thresholdInPesos)})`
}
