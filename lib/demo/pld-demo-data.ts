import { evaluarOperacionVulnerable } from "@/lib/pld/operations"
import { matchPepCargo } from "@/lib/pld/pep"
import { buildDefaultPldTenants } from "@/lib/pld/tenants"
import { buildPldOperationalCase } from "@/lib/pld/operational-flow"
import { generateSatOutputPackage } from "@/lib/pld/sat-outputs"
import { buildSatFormatSnapshot } from "@/lib/pld/sat-formatos"
import type { PepScreeningResult, UmbralStatus } from "@/lib/pld/types"

export const DEMO_SEED_METADATA_KEY = "pld-demo-seed-metadata"

export const DEMO_STORAGE_KEYS = [
  "registro-sat-data",
  "pld-tenants",
  "pld-active-tenant-id",
  "kyc_expedientes_detalle",
  "actividades_vulnerables_clientes",
  "actividades_vulnerables_operaciones",
  "ebr_evaluaciones",
  "beneficiario-controlador-data",
  "pld-training-module",
  "capacitacion-control-data",
  "auditoria-lineamientos",
  "auditoria-interna-registros",
  "auditoria-observaciones-autoridades",
  "auditoria-planes-accion",
  "auditoria-verificacion-data",
  "pld-evidences-documents",
  "pld-evidences-logs",
  "evidencias-trazabilidad-data",
  "pld-sat-output-packages",
  "pld-sat-format-snapshot",
  "gobernanza-control-data",
  "monitoreo-operaciones-data",
  "documents",
  "completedActivities",
  "userSectionsProgress",
  DEMO_SEED_METADATA_KEY,
] as const

export type DemoStorageKey = (typeof DEMO_STORAGE_KEYS)[number]
export type PldDemoDataset = Record<DemoStorageKey, unknown>

interface DemoStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface DemoOperationSeed {
  id: string
  actividadKey: string
  actividadNombre: string
  tipoCliente: string
  detalleTipoCliente?: string
  cliente: string
  rfc: string
  mismoGrupo: boolean
  fechaOperacion: string
  monto: number
  tipoOperacion: string
  evidencia: string
  expedienteReferenciado: string
  pepCargo?: string
  pepDependencia?: string
  pepScreening?: PepScreeningResult
  inmueble?: Record<string, unknown>
  liquidacion?: Record<string, unknown>
  beneficiario?: Record<string, unknown>
  contraparte?: Record<string, unknown>
  instrumento?: Record<string, unknown>
}

const DEMO_SUBJECT = {
  id: "so-demo-isn",
  nombre: "Inmobiliaria Sierra Norte, S.A. de C.V.",
  rfc: "ISN2103158Q7",
  actividadKey: "fraccion-v-inmuebles",
  actividad: "Fracción V · Desarrollo e intermediación inmobiliaria",
  correoCumplimiento: "cumplimiento@sierranorte.demo",
  oficial: "Sofía Martínez Ortega",
}

const PDF_DATA_URL = "data:application/pdf;base64,JVBERi0xLjQKJURlbW8K"

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function isoAt(referenceDate: Date, monthOffset: number, day: number, hour = 10) {
  const date = new Date(referenceDate)
  date.setMonth(referenceDate.getMonth() + monthOffset, day)
  date.setHours(hour, 0, 0, 0)
  return date.toISOString()
}

function mxn(value: number) {
  return Math.round(value * 100) / 100
}

function demoDocument(id: string, name: string, uploadDate: string, size = 184_320) {
  return {
    id,
    name,
    type: "application/pdf",
    uploadDate,
    dataUrl: PDF_DATA_URL,
    mimeType: "application/pdf",
    size,
  }
}

function demoDireccion(overrides: Partial<Record<string, string>> = {}) {
  return {
    codigoPostal: "66220",
    tipoVialidad: "Avenida",
    nombreVialidad: "Real de San Agustín",
    numeroExterior: "245",
    numeroInterior: "Piso 4",
    colonia: "Residencial San Agustín",
    alcaldia: "San Pedro Garza García",
    ciudad: "San Pedro Garza García",
    entidad: "Nuevo León",
    pais: "MX",
    ...overrides,
  }
}

function demoContacto(correo: string, telefono = "8183552200") {
  return {
    ladaFijo: "81",
    telefonoFijo: telefono,
    extension: "104",
    ladaMovil: "81",
    telefonoMovil: "8120405500",
    correo,
  }
}

function demoIdentificacion(numero: string, vigencia = "2030-12-31") {
  return {
    tipo: "INE",
    numero,
    autoridad: "Instituto Nacional Electoral",
    vigencia,
  }
}

function buildRegistroSat(referenceDate: Date) {
  const uploadedAt = isoAt(referenceDate, -4, 12)
  const detalle = demoDocument("sat-detalle-demo", "Detalle de alta SAT PLD - demo.pdf", uploadedAt)
  const acuse = demoDocument("sat-acuse-demo", "Acuse de registro SAT PLD - demo.pdf", isoAt(referenceDate, -4, 14))
  const aceptacion = demoDocument("sat-aceptacion-demo", "Aceptación REC Portal PLD - demo.pdf", isoAt(referenceDate, -4, 16))

  const actividad = {
    actividadKey: DEMO_SUBJECT.actividadKey,
    fechaPrimera: "2024-01-15",
    cuentaRegistro: "si",
    tipoDocumento: "Registro",
    autoridadDocumento: "SAT",
    folioDocumento: "SPPLD-AV-2026-000128",
    periodoDocumento: "2026",
    domicilio: {
      codigoPostal: "66220",
      tipoVialidad: "Avenida",
      nombreVialidad: "Real de San Agustín",
      numeroExterior: "245",
      numeroInterior: "Piso 4",
      colonia: "Residencial San Agustín",
      alcaldia: "San Pedro Garza García",
      entidad: "Nuevo León",
      pais: "México",
    },
  }

  const identificacion = {
    fecha: "2021-03-15",
    rfc: DEMO_SUBJECT.rfc,
    nombre: DEMO_SUBJECT.nombre,
    apellidoPaterno: "",
    paisNacionalidad: "MX",
    paisNacimiento: "MX",
    curp: "",
  }

  const representante = {
    nombre: "Sofía",
    apellidoPaterno: "Martínez",
    apellidoMaterno: "Ortega",
    fechaNacimiento: "1984-08-19",
    rfc: "MAOS840819K12",
    curp: "MAOS840819MNLRTF05",
    paisNacionalidad: "MX",
    fechaDesignacion: "2026-01-20",
    fechaAceptacion: "2026-01-22",
    contacto: {
      claveLada: "81",
      telefonoFijo: "8183552200",
      extension: "104",
      telefonoMovil: "8120405500",
      correo: DEMO_SUBJECT.correoCumplimiento,
    },
    certificacion: {
      respuesta: "si",
      tipoDocumento: "Constancia",
      autoridadDocumento: "CNBV",
      folioDocumento: "CNBV-PLD-2025-7741",
      periodoDocumento: "2025-2028",
    },
  }

  const documentos = [detalle, acuse, aceptacion]

  return {
    documentos,
    datosChecklist: {
      "actividad-descripcion": {
        completed: true,
        notes: "Intermediación y desarrollo de proyectos habitacionales con operaciones sujetas a Fracción V.",
      },
      "actividad-ubicacion": { completed: true, notes: "Oficinas corporativas y sala de cierre documentadas." },
      "pm-denominacion": { completed: true, notes: DEMO_SUBJECT.nombre },
      "pm-rfc": { completed: true, notes: DEMO_SUBJECT.rfc },
      "pm-representante": { completed: true, notes: DEMO_SUBJECT.oficial },
      "pm-domicilio": { completed: true, notes: "Domicilio validado contra constancia fiscal." },
      "rec-nombre": { completed: true, notes: DEMO_SUBJECT.oficial },
      "rec-correo": { completed: true, notes: DEMO_SUBJECT.correoCumplimiento },
      "rec-telefono": { completed: true, notes: "81 8355 2200 ext. 104" },
    },
    sujetosRegistrados: [
      {
        id: DEMO_SUBJECT.id,
        nombre: DEMO_SUBJECT.nombre,
        tipo: "moral",
        actividad: DEMO_SUBJECT.actividad,
        creadoEn: isoAt(referenceDate, -4, 16),
        documentos: { detalle, acuse, aceptacion },
        checklistCampos: [
          "actividad-descripcion",
          "actividad-ubicacion",
          "pm-denominacion",
          "pm-rfc",
          "pm-representante",
          "pm-domicilio",
          "rec-nombre",
          "rec-correo",
        ],
        registroCompleto: true,
        identificacion,
        contactos: [
          {
            nombreCompleto: "Sofía Martínez Ortega",
            claveLada: "81",
            telefonoFijo: "8183552200",
            extension: "104",
            telefonoMovil: "8120405500",
            correo: DEMO_SUBJECT.correoCumplimiento,
          },
          {
            nombreCompleto: "Daniel Herrera Cruz",
            claveLada: "81",
            telefonoFijo: "8183552200",
            extension: "118",
            telefonoMovil: "8119224433",
            correo: "juridico@sierranorte.demo",
          },
          {
            nombreCompleto: "Mesa de control PLD",
            claveLada: "81",
            telefonoFijo: "8183552200",
            extension: "130",
            telefonoMovil: "",
            correo: "mesa.control@sierranorte.demo",
          },
        ],
        actividades: [actividad],
        representante,
      },
    ],
    tipoSujeto: "moral",
    identificacion,
    contactos: [
      {
        nombreCompleto: "Sofía Martínez Ortega",
        claveLada: "81",
        telefonoFijo: "8183552200",
        extension: "104",
        telefonoMovil: "8120405500",
        correo: DEMO_SUBJECT.correoCumplimiento,
      },
    ],
    actividades: [actividad],
    representante,
    documentosRegistro: { detalle, acuse, aceptacion },
  }
}

function buildExpedientes(referenceDate: Date) {
  const updatedAt = referenceDate.toISOString()
  const representante = {
    nombre: "Daniel",
    apellidoPaterno: "Herrera",
    apellidoMaterno: "Cruz",
    rfc: "HECD820412L98",
    cargo: "Representante legal",
    paisNacionalidad: "MX",
  }

  const beneficiario1 = {
    nombres: "Adriana",
    apellidoPaterno: "Luna",
    apellidoMaterno: "Paredes",
    fechaNacimiento: "1979-06-22",
    paisNacionalidad: "MX",
    paisNacimiento: "MX",
    curp: "LUPA790622MNLNRD03",
    rfc: "LUPA7906228V4",
    porcentajeParticipacion: "62",
    domicilio: demoDireccion({ colonia: "Del Valle", alcaldia: "San Pedro Garza García" }),
    contacto: demoContacto("adriana.luna@lagoverde.demo"),
    resideExtranjero: "no",
    domicilioCorrespondencia: demoDireccion({ colonia: "Del Valle" }),
    identificacion: demoIdentificacion("INE-LUPA-884210"),
  }

  const personaMoral = {
    rfc: "DLV190624M32",
    nombre: "Desarrollos Lago Verde, S.A.P.I. de C.V.",
    tipoCliente: "pm_mexicana",
    detalleTipoCliente: "Desarrolladora inmobiliaria residencial",
    sujetoObligadoId: DEMO_SUBJECT.id,
    sujetoObligadoNombre: DEMO_SUBJECT.nombre,
    actualizadoEn: updatedAt,
    expedienteEui: {
      fechaRegistro: dateOnly(referenceDate),
      tipoExpediente: "persona_moral",
      sujetoObligadoId: DEMO_SUBJECT.id,
      sujetoObligadoNombre: DEMO_SUBJECT.nombre,
      tipoCliente: "pm_mexicana",
      tipoActoOperacion: "Promesa y compraventa de lotes residenciales",
      fechaActoOperacion: "2026-04-18",
      relacionNegocios: "si",
      cliente: {
        denominacion: "Desarrollos Lago Verde, S.A.P.I. de C.V.",
        fechaConstitucion: "2019-06-24",
        paisNacionalidad: "MX",
        rfc: "DLV190624M32",
        actividad: "Desarrollo, comercialización y administración de inmuebles residenciales.",
      },
      domicilioCliente: demoDireccion({ nombreVialidad: "Calzada del Valle", numeroExterior: "512" }),
      contactoCliente: demoContacto("administracion@lagoverde.demo"),
      representante,
      identificacionRepresentante: demoIdentificacion("INE-HECD-552081"),
      beneficiario1,
      beneficiario2: null,
      inmueble: {
        tipo: "Lote residencial",
        valorReferencia: "1250000",
        folioReal: "NL-SPGG-2026-004821",
        ubicacion: demoDireccion({ codigoPostal: "67350", alcaldia: "Allende", ciudad: "Allende", entidad: "Nuevo León" }),
      },
      documentacion: {
        acta_constitutiva: true,
        constancia_fiscal: true,
        poder_representante: true,
        identificacion_representante: true,
        comprobante_domicilio: true,
        declaracion_beneficiario: true,
      },
    },
    personas: [
      {
        id: "cliente-DLV190624M32",
        tipo: "persona_moral",
        denominacion: "Desarrollos Lago Verde, S.A.P.I. de C.V.",
        fechaConstitucion: "2019-06-24",
        rfc: "DLV190624M32",
        pais: "MX",
        giro: "Desarrollo inmobiliario residencial",
        rolRelacion: "Cliente",
        representante: {
          nombre: representante.nombre,
          apellidoPaterno: representante.apellidoPaterno,
          apellidoMaterno: representante.apellidoMaterno,
          rfc: representante.rfc,
          curp: "",
        },
        domicilio: demoDireccion({ nombreVialidad: "Calzada del Valle", numeroExterior: "512" }),
        contacto: { clavePais: "MX", telefono: "8120405500", correo: "administracion@lagoverde.demo" },
      },
    ],
  }

  const personaFisica = {
    rfc: "ROGM780915K20",
    nombre: "María Fernanda Rojas Gómez",
    tipoCliente: "pf_residente",
    detalleTipoCliente: "Cliente persona física con cargo público declarado",
    sujetoObligadoNombre: DEMO_SUBJECT.nombre,
    actualizadoEn: updatedAt,
    expedienteEui: {
      fechaRegistro: dateOnly(referenceDate),
      tipoExpediente: "persona_fisica",
      sujetoObligadoNombre: DEMO_SUBJECT.nombre,
      sujetoObligadoRfc: DEMO_SUBJECT.rfc,
      tipoCliente: "pf_residente",
      tipoActoOperacion: "Anticipo para adquisición de casa habitación",
      fechaActoOperacion: "2026-04-30",
      relacionNegocios: "no",
      cliente: {
        nombres: "María Fernanda",
        apellidoPaterno: "Rojas",
        apellidoMaterno: "Gómez",
        fechaNacimiento: "1978-09-15",
        paisNacimiento: "MX",
        paisNacionalidad: "MX",
        curp: "ROGM780915MDFJMR07",
        rfc: "ROGM780915K20",
        ocupacion: "Directora general en organismo público descentralizado",
      },
      domicilioCliente: demoDireccion({ codigoPostal: "03100", colonia: "Del Valle Centro", alcaldia: "Benito Juárez", ciudad: "Ciudad de México", entidad: "Ciudad de México" }),
      contactoCliente: demoContacto("maria.rojas@example.demo", "5555201133"),
      actuaRepresentante: "no",
      representante: {
        nombres: "",
        apellidoPaterno: "",
        apellidoMaterno: "",
        fechaNacimiento: "",
        paisNacionalidad: "MX",
        ocupacion: "",
        contacto: demoContacto(""),
        identificacion: demoIdentificacion(""),
      },
      domicilioCorrespondencia: demoDireccion({ codigoPostal: "03100", colonia: "Del Valle Centro", alcaldia: "Benito Juárez", ciudad: "Ciudad de México", entidad: "Ciudad de México" }),
      identificacionCliente: demoIdentificacion("INE-ROGM-420155"),
      documentacion: {
        identificacion_oficial: true,
        comprobante_domicilio: true,
        curp_rfc: true,
        declaracion_pep: true,
        origen_recursos: true,
      },
    },
    personas: [
      {
        id: "cliente-ROGM780915K20",
        tipo: "persona_fisica",
        denominacion: "María Fernanda Rojas Gómez",
        rfc: "ROGM780915K20",
        curp: "ROGM780915MDFJMR07",
        pais: "MX",
        giro: "Servicio público",
        rolRelacion: "Cliente",
        representante: null,
        domicilio: demoDireccion({ codigoPostal: "03100", colonia: "Del Valle Centro", alcaldia: "Benito Juárez", ciudad: "Ciudad de México", entidad: "Ciudad de México" }),
        contacto: { clavePais: "MX", telefono: "5555201133", correo: "maria.rojas@example.demo" },
      },
    ],
  }

  const comercioExterior = {
    rfc: "IME220118B91",
    nombre: "Importadora Mérida Especializada, S.A. de C.V.",
    tipoCliente: "pm_mexicana",
    detalleTipoCliente: "Cliente de comercio exterior con mercancía de alto valor",
    sujetoObligadoNombre: DEMO_SUBJECT.nombre,
    actualizadoEn: updatedAt,
    expedienteEui: {
      fechaRegistro: dateOnly(referenceDate),
      tipoExpediente: "persona_moral",
      sujetoObligadoId: DEMO_SUBJECT.id,
      sujetoObligadoNombre: DEMO_SUBJECT.nombre,
      tipoCliente: "pm_mexicana",
      tipoActoOperacion: "Despacho de joyería y relojería",
      fechaActoOperacion: "2026-05-05",
      relacionNegocios: "si",
      cliente: {
        denominacion: "Importadora Mérida Especializada, S.A. de C.V.",
        fechaConstitucion: "2022-01-18",
        paisNacionalidad: "MX",
        rfc: "IME220118B91",
        actividad: "Importación de relojería, joyería y accesorios de lujo.",
      },
      domicilioCliente: demoDireccion({ codigoPostal: "97115", colonia: "Altabrisa", alcaldia: "Mérida", ciudad: "Mérida", entidad: "Yucatán" }),
      contactoCliente: demoContacto("compliance@importadoramerida.demo", "9999442200"),
      representante: {
        nombre: "Ricardo",
        apellidoPaterno: "Valdés",
        apellidoMaterno: "Novelo",
        rfc: "VANR760702QZ4",
        cargo: "Apoderado aduanal",
        paisNacionalidad: "MX",
      },
      identificacionRepresentante: demoIdentificacion("INE-VANR-202610"),
      beneficiario1: {
        ...beneficiario1,
        nombres: "Claudia",
        apellidoPaterno: "Mena",
        apellidoMaterno: "Baeza",
        rfc: "MEBC8103049F8",
        porcentajeParticipacion: "55",
        contacto: demoContacto("claudia.mena@importadoramerida.demo"),
      },
      beneficiario2: null,
      inmueble: { tipo: "", valorReferencia: "", folioReal: "", ubicacion: demoDireccion() },
      documentacion: {
        acta_constitutiva: true,
        constancia_fiscal: true,
        pedimento: true,
        factura_comercial: true,
        manifestacion_valor: true,
      },
    },
    personas: [
      {
        id: "cliente-IME220118B91",
        tipo: "persona_moral",
        denominacion: "Importadora Mérida Especializada, S.A. de C.V.",
        rfc: "IME220118B91",
        pais: "MX",
        giro: "Comercio exterior de joyería y relojería",
        rolRelacion: "Cliente",
        representante: { nombre: "Ricardo", apellidoPaterno: "Valdés", apellidoMaterno: "Novelo", rfc: "VANR760702QZ4", curp: "" },
        domicilio: demoDireccion({ codigoPostal: "97115", colonia: "Altabrisa", alcaldia: "Mérida", ciudad: "Mérida", entidad: "Yucatán" }),
        contacto: { clavePais: "MX", telefono: "9999442200", correo: "compliance@importadoramerida.demo" },
      },
    ],
  }

  return [personaMoral, personaFisica, comercioExterior]
}

function mapStatusToAlert(status: UmbralStatus, fechaLimite?: string) {
  if (status === "aviso") {
    return `Aviso ordinario a presentar a mas tardar el dia 17 del mes inmediato siguiente (${fechaLimite ?? "fecha por calcular"}).`
  }
  if (status === "identificacion") {
    return "Operacion sujeta a identificacion y acumulacion SAT en ventana de seis meses."
  }
  return null
}

function buildOperations(referenceDate: Date) {
  const pepScreening = matchPepCargo({
    nombre: "María Fernanda Rojas Gómez",
    cargo: "DIRECTOR GENERAL DEL INSTITUTO MEXICANO DEL TRANSPORTE",
    dependencia: "SECRETARÍA DE COMUNICACIONES Y TRANSPORTES",
    relacion: "cliente",
  })

  const seeds: DemoOperationSeed[] = [
    {
      id: "op-demo-001",
      actividadKey: "fraccion-v-inmuebles",
      actividadNombre: "Fracción V – Construcción, desarrollo e intermediación inmobiliaria",
      tipoCliente: "pm_mexicana",
      detalleTipoCliente: "Desarrolladora residencial",
      cliente: "Desarrollos Lago Verde, S.A.P.I. de C.V.",
      rfc: "DLV190624M32",
      mismoGrupo: false,
      fechaOperacion: dateOnly(new Date("2026-02-12T12:00:00-06:00")),
      monto: 650_000,
      tipoOperacion: "Promesa de compraventa · Anticipo de lote",
      evidencia: "Contrato preliminar, CFDI de anticipo y ficha SPEI.",
      expedienteReferenciado: "DLV190624M32",
      inmueble: { tipo: "Lote residencial", folioReal: "NL-SPGG-2026-004821", ubicacion: "Allende, Nuevo León" },
      liquidacion: { formaPago: "Transferencia SPEI", bancoOrigen: "BBVA México", cuentaOrdenante: "****8201" },
      beneficiario: { nombre: "Adriana Luna Paredes", porcentaje: "62", identificado: true },
    },
    {
      id: "op-demo-002",
      actividadKey: "fraccion-v-inmuebles",
      actividadNombre: "Fracción V – Construcción, desarrollo e intermediación inmobiliaria",
      tipoCliente: "pm_mexicana",
      detalleTipoCliente: "Desarrolladora residencial",
      cliente: "Desarrollos Lago Verde, S.A.P.I. de C.V.",
      rfc: "DLV190624M32",
      mismoGrupo: false,
      fechaOperacion: dateOnly(new Date("2026-03-21T12:00:00-06:00")),
      monto: 1_250_000,
      tipoOperacion: "Segundo pago de compraventa",
      evidencia: "Convenio modificatorio, estado de cuenta y recibo oficial.",
      expedienteReferenciado: "DLV190624M32",
      inmueble: { tipo: "Lote residencial", folioReal: "NL-SPGG-2026-004821", ubicacion: "Allende, Nuevo León" },
      liquidacion: { formaPago: "Transferencia SPEI", bancoOrigen: "Santander", cuentaOrdenante: "****3319" },
      beneficiario: { nombre: "Adriana Luna Paredes", porcentaje: "62", identificado: true },
    },
    {
      id: "op-demo-003",
      actividadKey: "fraccion-v-bis-desarrollo",
      actividadNombre: "Fracción V Bis – Recepción de recursos para desarrollo inmobiliario",
      tipoCliente: "pm_mexicana",
      detalleTipoCliente: "Aportante a desarrollo inmobiliario",
      cliente: "Desarrollos Lago Verde, S.A.P.I. de C.V.",
      rfc: "DLV190624M32",
      mismoGrupo: false,
      fechaOperacion: dateOnly(new Date("2026-04-18T12:00:00-06:00")),
      monto: 3_800_000,
      tipoOperacion: "Aportación para desarrollo de etapa II",
      evidencia: "Contrato de inversión, dispersión bancaria y minuta de comité.",
      expedienteReferenciado: "DLV190624M32",
      liquidacion: { formaPago: "Transferencia SPEI", bancoOrigen: "Banorte", cuentaOrdenante: "****9921" },
      beneficiario: { nombre: "Adriana Luna Paredes", porcentaje: "62", identificado: true },
    },
    {
      id: "op-demo-004",
      actividadKey: "fraccion-v-inmuebles",
      actividadNombre: "Fracción V – Construcción, desarrollo e intermediación inmobiliaria",
      tipoCliente: "pf_residente",
      detalleTipoCliente: "Persona física con cargo público declarado",
      cliente: "María Fernanda Rojas Gómez",
      rfc: "ROGM780915K20",
      mismoGrupo: false,
      fechaOperacion: dateOnly(new Date("2026-04-30T12:00:00-06:00")),
      monto: 2_450_000,
      tipoOperacion: "Anticipo para adquisición de casa habitación",
      evidencia: "Contrato de adhesión, declaración PEP y comprobante SPEI.",
      expedienteReferenciado: "ROGM780915K20",
      pepCargo: "DIRECTOR GENERAL DEL INSTITUTO MEXICANO DEL TRANSPORTE",
      pepDependencia: "SECRETARÍA DE COMUNICACIONES Y TRANSPORTES",
      pepScreening,
      inmueble: { tipo: "Casa habitación", folioReal: "CDMX-BJ-2026-002114", ubicacion: "Benito Juárez, Ciudad de México" },
      liquidacion: { formaPago: "Transferencia SPEI", bancoOrigen: "Citibanamex", cuentaOrdenante: "****4107" },
    },
    {
      id: "op-demo-005",
      actividadKey: "fraccion-xiv-aduanal-d",
      actividadNombre: "Fracción XIV – Servicios de comercio exterior: joyas y metales",
      tipoCliente: "pm_mexicana",
      detalleTipoCliente: "Importadora especializada",
      cliente: "Importadora Mérida Especializada, S.A. de C.V.",
      rfc: "IME220118B91",
      mismoGrupo: false,
      fechaOperacion: dateOnly(new Date("2026-05-05T12:00:00-06:00")),
      monto: 118_500,
      tipoOperacion: "Despacho aduanal de relojería",
      evidencia: "Pedimento, factura comercial y manifestación de valor.",
      expedienteReferenciado: "IME220118B91",
      contraparte: { paisOrigen: "CH", proveedor: "Helvetia Time AG", incoterm: "DAP" },
      liquidacion: { formaPago: "Transferencia internacional", bancoOrigen: "UBS Switzerland", cuentaOrdenante: "****1188" },
    },
    {
      id: "op-demo-006",
      actividadKey: "fraccion-vi-metales",
      actividadNombre: "Fracción VI – Metales, piedras preciosas, joyas o relojes",
      tipoCliente: "pm_mexicana",
      detalleTipoCliente: "Compra puntual de relojería para exhibición",
      cliente: "Importadora Mérida Especializada, S.A. de C.V.",
      rfc: "IME220118B91",
      mismoGrupo: false,
      fechaOperacion: dateOnly(new Date("2026-05-07T12:00:00-06:00")),
      monto: 120_000,
      tipoOperacion: "Compra de relojería de lujo",
      evidencia: "Factura, orden de compra y pago referenciado.",
      expedienteReferenciado: "IME220118B91",
      liquidacion: { formaPago: "Transferencia SPEI", bancoOrigen: "HSBC México", cuentaOrdenante: "****5130" },
    },
  ]

  const historical: Array<{ id: string; actividadKey: string; clienteKey: string; fechaOperacion: string; montoMxn: number }> = []

  return seeds.map((seed) => {
    const result = evaluarOperacionVulnerable({
      actividadKey: seed.actividadKey,
      clienteKey: seed.rfc,
      fechaOperacion: seed.fechaOperacion,
      montoMxn: seed.monto,
      operacionesHistoricas: historical,
    })
    historical.push({
      id: seed.id,
      actividadKey: seed.actividadKey,
      clienteKey: seed.rfc,
      fechaOperacion: seed.fechaOperacion,
      montoMxn: seed.monto,
    })
    const periodo = seed.fechaOperacion.slice(0, 7)
    return {
      schemaVersion: 2,
      id: seed.id,
      actividadKey: seed.actividadKey,
      actividadNombre: seed.actividadNombre,
      tipoCliente: seed.tipoCliente,
      detalleTipoCliente: seed.detalleTipoCliente,
      cliente: seed.cliente,
      rfc: seed.rfc,
      mismoGrupo: seed.mismoGrupo,
      periodo,
      mes: Number(seed.fechaOperacion.slice(5, 7)),
      anio: Number(seed.fechaOperacion.slice(0, 4)),
      monto: seed.monto,
      moneda: "MXN",
      monedaDescripcion: "Peso mexicano (MXN)",
      fechaOperacion: seed.fechaOperacion,
      tipoOperacion: seed.tipoOperacion,
      evidencia: seed.evidencia,
      umaDiaria: result.uma.diario,
      identificacionUmbralPesos: mxn(result.identificacionUmbralMxn),
      avisoUmbralPesos: mxn(result.avisoUmbralMxn),
      umbralStatus: result.status,
      acumuladoCliente: mxn(result.acumulacion.montoAcumuladoMxn),
      alerta: mapStatusToAlert(result.status, result.fechaLimiteAviso),
      avisoPresentado: seed.id === "op-demo-002" || seed.id === "op-demo-005",
      alertaResuelta: seed.id === "op-demo-002" || seed.id === "op-demo-005" || result.status !== "aviso",
      documentosSoporte: [
        {
          id: `${seed.id}-doc-contrato`,
          requisito: "Soporte contractual o equivalente",
          notas: seed.evidencia,
          archivoNombre: `${seed.id}-soporte.pdf`,
          fechaRegistro: referenceDate.toISOString(),
        },
      ],
      requisitosChecklist: {
        "Formulario de identificacion del cliente o usuario.": true,
        "Identificacion oficial o documentos constitutivos, segun tipo de cliente.": true,
        "Constancia fiscal/RFC o dato equivalente cuando aplique.": true,
        "Soporte del acto u operacion y forma de pago.": true,
        "Declaracion de beneficiario controlador cuando corresponda.": seed.rfc !== "ROGM780915K20",
      },
      kycIntegrado: true,
      referenciaAviso:
        result.status === "aviso" ? `AV-DEMO-${seed.fechaOperacion.slice(0, 7).replace("-", "")}-${seed.id.slice(-3)}` : undefined,
      claveSujetoObligado: "AV-2026-ISN",
      claveActividadVulnerable: seed.actividadKey,
      expedienteReferenciado: seed.expedienteReferenciado,
      personaExpedienteId: `cliente-${seed.rfc}`,
      personaAviso: {
        tipo: seed.tipoCliente === "pf_residente" ? "persona_fisica" : "persona_moral",
        denominacion: seed.cliente,
        id: `cliente-${seed.rfc}`,
        requisito: "Cliente/usuario",
        notas: "Snapshot demo generado desde expediente KYC.",
        fechaRegistro: referenceDate.toISOString(),
      },
      inmueble: seed.inmueble ?? null,
      liquidacion: seed.liquidacion ?? null,
      beneficiario: seed.beneficiario ?? null,
      contraparte: seed.contraparte ?? null,
      instrumento: seed.instrumento ?? null,
      figuraCliente: seed.actividadKey.includes("inmuebles") ? "comprador" : undefined,
      figuraSujetoObligado: seed.actividadKey.includes("inmuebles") ? "intermediario" : undefined,
      pepCargo: seed.pepCargo,
      pepDependencia: seed.pepDependencia,
      pepScreening: seed.pepScreening,
      demoSeed: true,
    }
  })
}

function buildSatOutputPackages(referenceDate: Date) {
  const tenant = {
    ...buildDefaultPldTenants("tenant-demo-isn").tenants[0],
    id: "tenant-demo-isn",
    rfc: DEMO_SUBJECT.rfc,
    razonSocial: DEMO_SUBJECT.nombre,
    representanteCumplimiento: {
      ...buildDefaultPldTenants("tenant-demo-isn").tenants[0].representanteCumplimiento,
      nombre: DEMO_SUBJECT.oficial,
      email: DEMO_SUBJECT.correoCumplimiento,
    },
  }
  const completedEvidence = {
    "pm-acta-constitutiva": true,
    "pm-rfc-constancia": true,
    "pm-domicilio": true,
    "pm-poderes-representante": true,
    "pm-identificacion-representante": true,
    "pm-beneficiario-controlador": true,
    "pf-identificacion-oficial": true,
    "pf-domicilio": true,
    "pf-actividad": true,
    "pf-beneficiario-controlador": true,
    "operacion-soporte": true,
    "operacion-forma-pago": true,
  }
  const baseDate = dateOnly(referenceDate)
  const inmueblesSatFieldValues = buildInmueblesSatFieldValues()
  const avisoNormal = buildPldOperationalCase({
    tenant,
    periodo: "202605",
    actividadKey: "fraccion-v-inmuebles",
    clienteId: "cliente-DLV190624M32",
    clienteNombre: "Desarrollos Lago Verde, S.A.P.I. de C.V.",
    clienteRfc: "DLV190624M32",
    tipoCliente: "pm_mexicana",
    fechaOperacion: "2026-05-05",
    montoMxn: 1_850_000,
    formaPago: "Transferencia SPEI",
    completedEvidence,
    satTemplateId: "sat-fraccion-v-inmuebles",
    satTemplateFile: "Inmuebles_v4_5.xlsm",
    satTemplateVariant: "sat-fraccion-v-inmuebles",
    satFieldValues: inmueblesSatFieldValues,
    satMissingRequiredFields: [],
    satWorkbookStatus: "listo",
    actor: DEMO_SUBJECT.oficial,
  })
  const f4594SatFieldValues = buildF4594SatFieldValues()
  const f4594Tenant = {
    ...tenant,
    id: "tenant-demo-f4594",
    rfc: "FSC220908AC2",
    razonSocial: "F4594 Sujeto Obligado Demo",
  }
  const avisoF4594 = buildPldOperationalCase({
    tenant: f4594Tenant,
    periodo: "202505",
    actividadKey: "fraccion-xv-uso-goce",
    clienteId: "cliente-LME161125GY9",
    clienteNombre: "LOGISALL MEXICO S DE RL DE CV",
    clienteRfc: "LME161125GY9",
    tipoCliente: "pm_mexicana",
    fechaOperacion: "2025-05-26",
    montoMxn: 148_092.99,
    formaPago: "1,Contado",
    completedEvidence,
    satTemplateId: "sat-fraccion-xv-arrendamiento",
    satTemplateFile: "Arrendamiento_v4_5.xlsm",
    satTemplateVariant: "sat-fraccion-xv-arrendamiento",
    satFieldValues: f4594SatFieldValues,
    satMissingRequiredFields: [],
    satWorkbookStatus: "listo",
    actor: DEMO_SUBJECT.oficial,
  })
  const informeCeros = {
    ...buildPldOperationalCase({
      tenant,
      periodo: "202606",
      actividadKey: "fraccion-v-inmuebles",
      clienteId: "periodo-sin-operaciones",
      clienteNombre: "Periodo sin operaciones objeto de aviso",
      clienteRfc: DEMO_SUBJECT.rfc,
      tipoCliente: "pm_mexicana",
      fechaOperacion: baseDate,
      montoMxn: 0,
      formaPago: "No aplica",
      completedEvidence,
      actor: DEMO_SUBJECT.oficial,
    }),
    satOutputStatus: {
      kind: "informe_ceros" as const,
      label: "Informe en ceros",
      descripcion: "Periodo demo sin actos u operaciones objeto de aviso.",
      canClose: true,
      warnings: [],
    },
  }
  const informe27Bis = buildPldOperationalCase({
    tenant,
    periodo: "202605",
    actividadKey: "fraccion-xv-uso-goce",
    clienteId: "cliente-DLV190624M32-27bis",
    clienteNombre: "Desarrollos Lago Verde, S.A.P.I. de C.V.",
    clienteRfc: "DLV190624M32",
    tipoCliente: "pm_mexicana",
    fechaOperacion: "2026-05-10",
    montoMxn: 420_000,
    formaPago: "Intercompañía documentada",
    supuesto27Bis: true,
    completedEvidence,
    actor: DEMO_SUBJECT.oficial,
  })
  const aviso24h = buildPldOperationalCase({
    tenant,
    periodo: "202605",
    actividadKey: "fraccion-vi-metales",
    clienteId: "cliente-ROGM780915K20-24h",
    clienteNombre: "María Fernanda Rojas Gómez",
    clienteRfc: "ROGM780915K20",
    tipoCliente: "pf_residente",
    fechaOperacion: "2026-05-07",
    montoMxn: 120_000,
    formaPago: "Transferencia SPEI",
    sospecha24h: true,
    alertaCodigo: "2901",
    alertaDescripcion: "Cliente PEP con operación incongruente frente al perfil declarado.",
    suspicionNarrative:
      "La cliente declaró cargo público y solicitó acelerar la operación sin entregar soporte completo de origen de recursos.",
    completedEvidence,
    actor: DEMO_SUBJECT.oficial,
  })

  return [avisoNormal, avisoF4594, informeCeros, informe27Bis, aviso24h].map(generateSatOutputPackage)
}

function buildInmueblesSatFieldValues() {
  return {
    "persona_aviso.sujeto_obligado_rfc": DEMO_SUBJECT.rfc,
    "persona_aviso.periodo": "202605",
    "persona_aviso.referencia": "AV-DEMO-202605-001",
    "persona_aviso.prioridad": "1,NORMAL",
    "persona_aviso.tipo_alerta": "100,Sin alerta.",
    "persona_aviso.pm.razon_social": "Desarrollos Lago Verde, S.A.P.I. de C.V.",
    "persona_aviso.pm.fecha_constitucion": "24/06/2019",
    "persona_aviso.pm.rfc": "DLV190624M32",
    "persona_aviso.pm.pais_nacionalidad": "MEXICO,MX",
    "persona_aviso.pm.giro_mercantil": "NO APLICA||1000000",
    "persona_aviso.representante.nombre": "Ricardo",
    "persona_aviso.representante.apellido_paterno": "Valdés",
    "persona_aviso.representante.apellido_materno": "Novelo",
    "persona_aviso.representante.fecha_nacimiento": "02/07/1976",
    "persona_aviso.representante.rfc": "VANR760702QZ4",
    "persona_aviso.representante.curp": "VANR760702HNLLVC09",
    "persona_aviso.domicilio_nacional.estado": "Nuevo León",
    "persona_aviso.domicilio_nacional.municipio": "San Pedro Garza García",
    "persona_aviso.domicilio_nacional.ciudad": "San Pedro Garza García",
    "persona_aviso.domicilio_nacional.colonia": "Valle del Campestre",
    "persona_aviso.domicilio_nacional.calle": "Avenida Roble",
    "persona_aviso.domicilio_nacional.numero_exterior": "300",
    "persona_aviso.domicilio_nacional.codigo_postal": "66260",
    "persona_aviso.contacto.pais_telefono": "MEXICO,MX",
    "persona_aviso.contacto.telefono": "8183552200",
    "persona_aviso.contacto.correo": "cumplimiento@dlv.demo",
    "beneficiario.pf.nombre": "Adriana",
    "beneficiario.pf.apellido_paterno": "Luna",
    "beneficiario.pf.apellido_materno": "Paredes",
    "beneficiario.pf.fecha_nacimiento": "12/09/1976",
    "beneficiario.pf.rfc": "LUPA760912QA1",
    "beneficiario.pf.curp": "LUPA760912MNLNRD04",
    "beneficiario.pf.pais_nacionalidad": "MEXICO,MX",
    "acto.fecha_operacion": "05/05/2026",
    "acto.figura_cliente": "2,Comprador",
    "acto.figura_sujeto_obligado": "3,Intermediario",
    "inmueble.tipo_bien": "12,Terreno urbano habitacional",
    "inmueble.valor_pactado": "1850000",
    "inmueble.codigo_postal": "66260",
    "inmueble.calle": "Avenida Roble",
    "inmueble.numero_exterior": "300",
    "inmueble.colonia": "Valle del Campestre",
    "inmueble.terreno_m2": "240",
    "inmueble.inmueble_m2": "185",
    "inmueble.folio_real": "FR-2026-000184",
    "instrumento.fecha": "05/05/2026",
    "instrumento.numero": "INS-DEMO-2026-184",
    "instrumento.notario": "28",
    "instrumento.entidad": "19,NUEVO LEÓN",
    "instrumento.valor_avaluo": "1850000",
    "instrumento.fecha_contrato": "05/05/2026",
    "pago.fecha": "05/05/2026",
    "pago.forma_pago": "1,Contado",
    "pago.instrumento_monetario": "8,Transferencia Interbancaria",
    "pago.moneda": "1,Peso mexicano",
    "pago.monto": "1850000",
  }
}

function buildF4594SatFieldValues() {
  return {
    "persona_aviso.sujeto_obligado_rfc": "FSC220908AC2",
    "persona_aviso.periodo": "202505",
    "persona_aviso.referencia": "AV202505",
    "persona_aviso.prioridad": "1,NORMAL",
    "persona_aviso.tipo_alerta": "100,Sin alerta.",
    "persona_aviso.pm.razon_social": "LOGISALL MEXICO S DE RL DE CV",
    "persona_aviso.pm.fecha_constitucion": "25/11/2016",
    "persona_aviso.pm.rfc": "LME161125GY9",
    "persona_aviso.pm.pais_nacionalidad": "MEXICO,MX",
    "persona_aviso.pm.giro_mercantil": "INDUSTRIA - PLASTICO Y DEL HULE||3260005",
    "persona_aviso.representante.nombre": "LEE",
    "persona_aviso.representante.apellido_paterno": "CHUNWOO",
    "persona_aviso.representante.apellido_materno": "N",
    "persona_aviso.representante.fecha_nacimiento": "23/09/1977",
    "persona_aviso.representante.curp": "LEXC770923HNEXXH07",
    "persona_aviso.domicilio_nacional.codigo_postal": "66650",
    "persona_aviso.domicilio_nacional.colonia": "PESQUERIA",
    "persona_aviso.domicilio_nacional.calle": "ARMONIA",
    "persona_aviso.domicilio_nacional.numero_exterior": "104",
    "persona_aviso.contacto.pais_telefono": "MEXICO,MX",
    "persona_aviso.contacto.telefono": "66926318336",
    "persona_aviso.contacto.correo": "SANTANA@LOGISALL.COM",
    "acto.fecha_operacion": "26/05/2025",
    "acto.tipo_operacion": "1501,Arrendamiento de inmuebles",
    "inmueble.tipo_bien": "11,Nave Industrial",
    "inmueble.valor_referencia": "58569267",
    "inmueble.codigo_postal": "66679",
    "inmueble.colonia": "LA ARENA",
    "inmueble.calle": "CARRETERA PESQUERIA-LOS RAMONES",
    "inmueble.numero_exterior": "KM 11",
    "inmueble.folio_real": "06019003",
    "inmueble.fecha_inicio": "01/05/2025",
    "inmueble.fecha_termino": "31/05/2025",
    "pago.fecha": "26/05/2025",
    "pago.forma_pago": "1,Contado",
    "pago.instrumento_monetario": "8,Transferencia Interbancaria",
    "pago.moneda": "2,Dólar estadounidense",
    "pago.monto": "148092.99",
  }
}

function buildEbrEvaluations(referenceDate: Date) {
  const pepScreening = matchPepCargo({
    nombre: "María Fernanda Rojas Gómez",
    cargo: "DIRECTOR GENERAL DEL INSTITUTO MEXICANO DEL TRANSPORTE",
    dependencia: "SECRETARÍA DE COMUNICACIONES Y TRANSPORTES",
    relacion: "cliente",
  })

  const low = {
    nationalityRisk: "other",
    nationalityCountryCode: "MX",
    pep: "none",
    bankInstitution: "national_only",
    suspiciousBehaviors: [],
    incomeSources: ["propietario", "arrendamiento"],
    cashExposure: "bajo",
    ngoNonRegulated: "no",
    institutionAge: "public_or_mature",
  }

  return {
    DLV190624M32: {
      schemaVersion: 2,
      rfc: "DLV190624M32",
      clientAnswers: low,
      subjectAnswers: low,
      hasBeneficiaryController: true,
      beneficiaryAnswers: { ...low, incomeSources: ["inversiones", "propietario"] },
      notes: "Riesgo medio por volumen inmobiliario y acumulación de pagos en seis meses. Expediente y beneficiario controlador completos.",
      updatedAt: isoAt(referenceDate, 0, 6, 11),
    },
    ROGM780915K20: {
      schemaVersion: 2,
      rfc: "ROGM780915K20",
      clientAnswers: {
        ...low,
        pep: "pep",
        bankInstitution: "national_only",
        suspiciousBehaviors: ["urgent_close"],
        incomeSources: ["asalariado", "inversiones"],
      },
      subjectAnswers: low,
      hasBeneficiaryController: false,
      beneficiaryAnswers: low,
      pepCargo: "DIRECTOR GENERAL DEL INSTITUTO MEXICANO DEL TRANSPORTE",
      pepDependencia: "SECRETARÍA DE COMUNICACIONES Y TRANSPORTES",
      pepScreening,
      notes: "Aplicar debida diligencia reforzada por coincidencia de cargo PEP. Requiere autorización de cumplimiento y evidencia de origen de recursos.",
      updatedAt: isoAt(referenceDate, 0, 7, 12),
    },
    IME220118B91: {
      schemaVersion: 2,
      rfc: "IME220118B91",
      clientAnswers: {
        ...low,
        bankInstitution: "mixed",
        incomeSources: ["empresario", "inversiones"],
        cashExposure: "medio",
      },
      subjectAnswers: low,
      hasBeneficiaryController: true,
      beneficiaryAnswers: { ...low, incomeSources: ["empresario"] },
      notes: "Riesgo alto por comercio exterior, contrapartes internacionales y mercancía sensible; sin coincidencia PEP.",
      updatedAt: isoAt(referenceDate, 0, 7, 15),
    },
  }
}

function buildBeneficiario(referenceDate: Date) {
  const preguntas = [
    { id: "bc-1", answer: "si", notes: "Declaración firmada incluida en expediente.", lastUpdated: isoAt(referenceDate, -1, 20) },
    { id: "bc-2", answer: "si", notes: "Adriana Luna Paredes participa con 62%.", lastUpdated: isoAt(referenceDate, -1, 20) },
    { id: "bc-3", answer: "no", notes: "No se identificaron poderes de control adicionales.", lastUpdated: isoAt(referenceDate, -1, 21) },
    { id: "bc-4", answer: "no", notes: "Estructura directa sin sociedades intermedias.", lastUpdated: isoAt(referenceDate, -1, 21) },
    { id: "bc-5", answer: "si", notes: "Datos mínimos recabados y validados.", lastUpdated: isoAt(referenceDate, -1, 22) },
    { id: "bc-6", answer: "si", notes: "Actualización anual 2026 realizada.", lastUpdated: isoAt(referenceDate, -1, 22) },
    { id: "bc-7", answer: "no", notes: "Sin cambios accionarios posteriores a la última asamblea.", lastUpdated: isoAt(referenceDate, -1, 23) },
  ]

  const documentos = [
    {
      id: "bc-doc-declaracion",
      name: "Declaración beneficiario controlador - Lago Verde.pdf",
      type: "application/pdf",
      uploadDate: isoAt(referenceDate, -1, 22),
      expiryDate: isoAt(referenceDate, 11, 22),
      status: "vigente",
      url: PDF_DATA_URL,
      category: "declaracion",
    },
    {
      id: "bc-doc-libro-socios",
      name: "Libro de accionistas actualizado.pdf",
      type: "application/pdf",
      uploadDate: isoAt(referenceDate, -1, 22),
      status: "vigente",
      url: PDF_DATA_URL,
      category: "documentacion-societaria",
    },
  ]

  return {
    preguntas,
    documentos,
    trazabilidad: [
      {
        id: "bc-trace-001",
        action: "Declaración validada",
        user: DEMO_SUBJECT.oficial,
        timestamp: isoAt(referenceDate, -1, 22),
        details: "Se validó declaración y cadena accionaria de Desarrollos Lago Verde.",
        section: "beneficiario-controlador",
      },
    ],
    clientType: "moral",
    propertyChain: [
      { id: "bc-chain-001", entityName: "Desarrollos Lago Verde, S.A.P.I. de C.V.", country: "México", participation: "100%", level: 1 },
      { id: "bc-chain-002", entityName: "Adriana Luna Paredes", country: "México", participation: "62%", level: 2 },
      { id: "bc-chain-003", entityName: "Mauricio Ibarra Soto", country: "México", participation: "38%", level: 2 },
    ],
    screeningResults: [
      {
        id: "bc-screen-001",
        bcName: "Adriana Luna Paredes",
        list: "UIF/OFAC/ONU",
        status: "sin-coincidencias",
        source: "Consulta documental demo",
        checkedAt: isoAt(referenceDate, -1, 22),
        observations: "Sin coincidencias; conservar evidencia de consulta.",
      },
    ],
    declaraciones: [
      {
        id: "bc-dec-001",
        folio: "BC-DEMO-2026-001",
        date: isoAt(referenceDate, -1, 22),
        user: DEMO_SUBJECT.oficial,
        notes: "Declaración anual firmada por representante legal.",
      },
    ],
    lastBCUpdate: isoAt(referenceDate, -1, 22),
    folioCounter: 2,
  }
}

function buildTraining(referenceDate: Date) {
  const documents = [
    {
      id: "cap-doc-plan-2026",
      name: "Plan anual capacitación PLD 2026.pdf",
      category: "plan",
      dataUrl: PDF_DATA_URL,
      fileType: "application/pdf",
      size: 245_100,
      uploadedAt: isoAt(referenceDate, -3, 10),
      uploadedBy: DEMO_SUBJECT.oficial,
      notes: "Plan aprobado por Dirección General.",
    },
    {
      id: "cap-doc-asistencia-abril",
      name: "Lista de asistencia sesión abril 2026.pdf",
      category: "asistencia",
      dataUrl: PDF_DATA_URL,
      fileType: "application/pdf",
      size: 132_700,
      uploadedAt: isoAt(referenceDate, -1, 18),
      uploadedBy: "Mesa de control PLD",
      sessionId: "cap-sesion-abril",
    },
    {
      id: "cap-doc-oficial",
      name: "Constancia anual Oficial de Cumplimiento.pdf",
      category: "oficial",
      dataUrl: PDF_DATA_URL,
      fileType: "application/pdf",
      size: 186_400,
      uploadedAt: isoAt(referenceDate, -2, 25),
      uploadedBy: DEMO_SUBJECT.oficial,
      notes: "Curso PLD-FT Actividades Vulnerables 2026.",
    },
  ]

  const sessions = [
    {
      id: "cap-sesion-abril",
      title: "Actualización LFPIORPI 2026 y acumulación de avisos",
      date: "2026-04-18",
      modality: "Presencial",
      durationHours: 3,
      topicsSummary: "Reforma reglamentaria, umbrales UMA, día 17, PEP y evidencia de operaciones.",
      attendanceDocumentId: "cap-doc-asistencia-abril",
      temarioDocumentId: "cap-doc-plan-2026",
      materialsDocumentIds: ["cap-doc-plan-2026"],
      evaluationApplied: true,
      evaluationDocumentId: "cap-doc-asistencia-abril",
      attendees: ["emp-001", "emp-002", "emp-003"],
      observations: "Se reforzó el llenado de expedientes y alertas por acumulación a seis meses.",
      createdAt: isoAt(referenceDate, -1, 18),
      createdBy: DEMO_SUBJECT.oficial,
    },
  ]

  const employees = [
    {
      id: "emp-001",
      name: "Sofía Martínez Ortega",
      role: "Oficial de Cumplimiento",
      department: "Cumplimiento",
      hireDate: "2023-02-01",
      criticalRole: true,
      lastTrainingDate: "2026-04-18",
      needsInitialTraining: false,
      certificates: ["cap-doc-oficial"],
      history: [{ sessionId: "cap-sesion-abril", sessionTitle: "Actualización LFPIORPI 2026 y acumulación de avisos", date: "2026-04-18", certificateId: "cap-doc-oficial" }],
    },
    {
      id: "emp-002",
      name: "Daniel Herrera Cruz",
      role: "Gerente jurídico",
      department: "Legal",
      hireDate: "2022-09-12",
      criticalRole: true,
      lastTrainingDate: "2026-04-18",
      needsInitialTraining: false,
      certificates: [],
      history: [{ sessionId: "cap-sesion-abril", sessionTitle: "Actualización LFPIORPI 2026 y acumulación de avisos", date: "2026-04-18" }],
    },
    {
      id: "emp-003",
      name: "Valeria Fuentes Ríos",
      role: "Ejecutiva comercial",
      department: "Ventas",
      hireDate: "2025-11-03",
      criticalRole: true,
      lastTrainingDate: "2026-04-18",
      needsInitialTraining: false,
      certificates: [],
      history: [{ sessionId: "cap-sesion-abril", sessionTitle: "Actualización LFPIORPI 2026 y acumulación de avisos", date: "2026-04-18" }],
    },
  ]

  return {
    trainingPlan: {
      year: "2026",
      approvedBy: "Dirección General",
      approvalDate: "2026-02-10",
      objectives: "Alinear al equipo con obligaciones de Actividades Vulnerables, EBR, PEP, avisos y conservación de evidencias.",
      coverage: "Oficial de Cumplimiento, jurídico, ventas, administración y mesa de control.",
      planDocumentId: "cap-doc-plan-2026",
      schedule: [
        { id: "sched-enero", month: "Enero", topic: "Inducción PLD y roles", audience: "Personal nuevo" },
        { id: "sched-abril", month: "Abril", topic: "Actualización LFPIORPI 2026", audience: "Todo el personal crítico" },
        { id: "sched-septiembre", month: "Septiembre", topic: "Casos prácticos de avisos y PEP", audience: "Ventas y cumplimiento" },
      ],
      createdAt: isoAt(referenceDate, -3, 10),
      updatedAt: isoAt(referenceDate, -1, 18),
    },
    sessions,
    employees,
    documents,
    officialCompliance: {
      name: DEMO_SUBJECT.oficial,
      lastCertificationDate: "2025-06-20",
      certificateDocumentId: "cap-doc-oficial",
    },
    traceability: [
      {
        id: "cap-trace-001",
        action: "Sesión cerrada",
        details: "Se cargó asistencia y evaluación de la capacitación anual.",
        user: DEMO_SUBJECT.oficial,
        timestamp: isoAt(referenceDate, -1, 18),
        sessionId: "cap-sesion-abril",
      },
    ],
    checklistAnswers: {
      a1: { answer: "si", notes: "Plan anual aprobado y cargado.", evidenceId: "cap-doc-plan-2026" },
      b1: { answer: "si", notes: "Personal crítico capacitado en abril 2026.", evidenceId: "cap-doc-asistencia-abril" },
      b2: { answer: "si", notes: "Oficial con constancia anual vigente.", evidenceId: "cap-doc-oficial" },
      c1: { answer: "si", notes: "Asistieron áreas comercial, jurídico y cumplimiento." },
      c2: { answer: "si", notes: "Inducción incluida en calendario anual." },
      d1: { answer: "si", notes: "Evaluación aplicada al cierre de la sesión." },
      d2: { answer: "si", notes: "Temario y materiales vinculados." },
      e1: { answer: "si", notes: "Historial por colaborador actualizado." },
    },
    moduleClosed: false,
  }
}

function buildAuditoria(referenceDate: Date) {
  const lineamientos = [
    {
      version: "PCI-PLD-2026.1",
      date: isoAt(referenceDate, -3, 15),
      approvedBy: "Consejo de Administración",
      notes: "Actualización por reforma reglamentaria y criterios de acumulación SAT 2026.",
    },
  ]

  const auditorias = [
    {
      id: "aud-demo-2026-q2",
      date: isoAt(referenceDate, 0, 6),
      scope: ["alcance-1", "alcance-3", "alcance-6", "alcance-9", "alcance-12"],
      findings:
        "El control de acumulación y PEP opera en demo; se observó oportunidad de reforzar evidencia de origen de recursos en cliente PEP.",
      responsible: "Auditor externo demo",
      status: "En seguimiento",
      followUpDue: isoAt(referenceDate, 1, 15),
    },
  ]

  const observaciones = [
    {
      id: "obs-demo-001",
      authority: "SAT",
      receivedAt: isoAt(referenceDate, -1, 28),
      dueDate: isoAt(referenceDate, 0, 12),
      respondedAt: undefined,
      status: "En progreso",
      responsible: DEMO_SUBJECT.oficial,
      documents: ["acuse-aviso-demo.pdf", "expediente-cliente-pep.pdf"],
    },
  ]

  const planes = [
    {
      id: "plan-demo-001",
      finding: "Fortalecer evidencia de origen de recursos para operaciones PEP.",
      action: "Agregar checklist reforzado y autorización de cumplimiento antes de cierre.",
      owner: DEMO_SUBJECT.oficial,
      dueDate: isoAt(referenceDate, 1, 15),
      status: "En proceso",
      evidence: "Minuta de revisión y formulario PEP firmado.",
    },
    {
      id: "plan-demo-002",
      finding: "Actualizar manual operativo con regla de acumulación a seis meses.",
      action: "Aprobar versión PCI-PLD-2026.2 y difundir a ventas/jurídico.",
      owner: "Daniel Herrera Cruz",
      dueDate: isoAt(referenceDate, 0, 28),
      status: "Abierto",
      evidence: "Borrador de manual y calendario de capacitación.",
    },
  ]

  return {
    lineamientos,
    auditorias,
    observaciones,
    planes,
    resumen: {
      hallazgos: planes,
      periodo: "Enero - mayo 2026",
      sujeto: DEMO_SUBJECT.nombre,
      generadoEn: referenceDate.toISOString(),
    },
  }
}

function buildEvidencias(referenceDate: Date) {
  const docs = [
    {
      id: "ev-kyc-dlv-acta",
      expedienteId: "DLV190624M32",
      module: "kyc",
      submodule: "persona-moral",
      documentType: "acta-constitutiva",
      title: "Acta constitutiva y poderes - Lago Verde",
      notes: "Documento demo para expediente KYC.",
      uploadDate: isoAt(referenceDate, -2, 12),
      documentDate: "2019-06-24",
      user: "Mesa de control PLD",
      fileName: "acta-lago-verde-demo.pdf",
      fileSize: 242_100,
      fileType: "application/pdf",
      fileData: PDF_DATA_URL,
      version: 1,
      versionHistory: [],
      archived: false,
      source: "manual",
      sourceId: "ev-kyc-dlv-acta",
    },
    {
      id: "ev-op-pep-origen",
      expedienteId: "ROGM780915K20",
      module: "reportes",
      submodule: "aviso",
      documentType: "soporte-operacion",
      title: "Soporte de origen de recursos cliente PEP",
      notes: "Estado de cuenta, declaración y autorización de cumplimiento.",
      uploadDate: isoAt(referenceDate, 0, 2),
      documentDate: "2026-04-30",
      user: DEMO_SUBJECT.oficial,
      fileName: "origen-recursos-pep-demo.pdf",
      fileSize: 198_600,
      fileType: "application/pdf",
      fileData: PDF_DATA_URL,
      version: 2,
      versionHistory: [
        { version: 1, timestamp: isoAt(referenceDate, 0, 1), user: "Mesa de control PLD", changeNote: "Carga inicial." },
      ],
      archived: false,
      source: "manual",
      sourceId: "ev-op-pep-origen",
    },
    {
      id: "ev-cap-plan",
      expedienteId: "Gobernanza",
      module: "capacitacion",
      submodule: "plan-anual",
      documentType: "plan-capacitacion",
      title: "Plan anual de capacitación PLD 2026",
      notes: "Sincronizable con módulo de capacitación.",
      uploadDate: isoAt(referenceDate, -3, 10),
      documentDate: "2026-02-10",
      user: DEMO_SUBJECT.oficial,
      fileName: "plan-capacitacion-pld-2026.pdf",
      fileSize: 245_100,
      fileType: "application/pdf",
      fileData: PDF_DATA_URL,
      version: 1,
      versionHistory: [],
      archived: false,
      source: "capacitacion",
      sourceId: "cap-doc-plan-2026",
    },
  ]

  const logs = docs.map((doc, index) => ({
    id: `trace-ev-${index + 1}`,
    documentId: doc.id,
    expedienteId: doc.expedienteId,
    module: doc.module,
    action: "upload",
    timestamp: doc.uploadDate,
    user: doc.user,
    details: `Carga demo de ${doc.title}.`,
  }))

  return { docs, logs, snapshot: { documentos: docs, logs } }
}

function buildGobernanza(referenceDate: Date) {
  const documents = [
    {
      id: "gov-doc-manual",
      relatedQuestionId: "manuales-politicas-1",
      name: "Manual PLD Actividades Vulnerables 2026",
      documentType: "Manual interno",
      fileName: "manual-pld-2026-demo.pdf",
      mimeType: "application/pdf",
      size: 318_420,
      uploadDate: isoAt(referenceDate, -3, 15),
      issueDate: "2026-02-15",
      expiryDate: "2027-02-15",
      retentionUntil: "2031-02-15",
      status: "vigente",
      hash: "demo-hash-manual-pld-2026",
      base64: PDF_DATA_URL.split(",")[1],
      relatedModules: ["gobernanza", "capacitacion", "auditoria"],
      notes: "Versión aprobada por Consejo de Administración.",
      signedBy: "Consejo de Administración",
      signedAt: isoAt(referenceDate, -3, 15),
    },
    {
      id: "gov-doc-oficial",
      relatedQuestionId: "oficial-designacion-1",
      name: "Designación Oficial de Cumplimiento",
      documentType: "Acuse SAT",
      fileName: "designacion-oficial-demo.pdf",
      mimeType: "application/pdf",
      size: 112_050,
      uploadDate: isoAt(referenceDate, -4, 16),
      issueDate: "2026-01-22",
      retentionUntil: "2031-01-22",
      status: "vigente",
      hash: "demo-hash-oficial-2026",
      base64: PDF_DATA_URL.split(",")[1],
      relatedModules: ["gobernanza", "registro-sat"],
      notes: "Acuse de aceptación del cargo en Portal PLD.",
      signedBy: DEMO_SUBJECT.oficial,
      signedAt: isoAt(referenceDate, -4, 16),
    },
  ]

  const questions = [
    {
      id: "oficial-designacion-1",
      submodule: "oficial",
      category: "Designación y facultades",
      question: "¿Se designó formalmente al Oficial de Cumplimiento ante el SAT?",
      legalReference: "Art. 20 LFPIORPI y art. 10 RCG",
      answer: "si",
      notes: "Designación y aceptación cargadas.",
      evidenceHints: ["Acuse SAT de designación del Oficial"],
      relatedDocuments: ["gov-doc-oficial"],
      required: true,
    },
    {
      id: "manuales-politicas-1",
      submodule: "manuales",
      category: "Gobernanza",
      question: "¿Existe manual PLD actualizado?",
      legalReference: "Art. 20 LFPIORPI",
      answer: "si",
      notes: "Manual 2026 aprobado y difundido.",
      evidenceHints: ["Manual interno"],
      relatedDocuments: ["gov-doc-manual"],
      required: true,
    },
  ]

  return {
    questions,
    documents,
    trace: [
      {
        id: "gov-trace-001",
        action: "Manual aprobado",
        section: "manuales",
        timestamp: isoAt(referenceDate, -3, 15),
        user: "Consejo de Administración",
        details: "Se aprobó Manual PLD 2026 y calendario de difusión.",
      },
    ],
    manualVersions: [
      {
        id: "manual-version-2026-1",
        version: 1,
        folio: "PCI-PLD-2026.1",
        uploadedAt: isoAt(referenceDate, -3, 15),
        documentId: "gov-doc-manual",
        summary: "Incorpora EBR, PEP por cargo y acumulación SAT a seis meses.",
      },
    ],
    committeeSessions: [
      {
        id: "comite-demo-001",
        sessionNumber: "01/2026",
        sessionDate: "2026-02-15",
        attendees: [DEMO_SUBJECT.oficial, "Daniel Herrera Cruz", "Dirección General"],
        agreements: [
          {
            agreement: "Aprobar actualización de manual PLD y ruta de capacitación.",
            responsible: DEMO_SUBJECT.oficial,
            deadline: "2026-04-30",
            status: "cerrado",
          },
          {
            agreement: "Implementar checklist reforzado para cliente PEP.",
            responsible: "Daniel Herrera Cruz",
            deadline: "2026-05-28",
            status: "en-proceso",
          },
        ],
        notes: "Sesión ordinaria con enfoque en reforma y auditoría 2026.",
        documentId: "gov-doc-manual",
      },
    ],
    alerts: [
      {
        id: "alert-demo-pep",
        title: "Revisión reforzada cliente PEP",
        description: "Validar autorización y origen de recursos antes del cierre definitivo.",
        targetDate: isoAt(referenceDate, 0, 18),
        responsible: DEMO_SUBJECT.oficial,
        channelEmail: true,
        channelInApp: true,
      },
      {
        id: "alert-demo-manual",
        title: "Difusión de manual PCI-PLD-2026.2",
        description: "Actualizar manual con plan correctivo de auditoría y difundir a ventas.",
        targetDate: isoAt(referenceDate, 0, 28),
        responsible: "Daniel Herrera Cruz",
        channelEmail: false,
        channelInApp: true,
      },
    ],
    expedienteCerrado: false,
  }
}

function buildProgress() {
  return [
    {
      id: "registro-sat",
      title: "Alta y Registro SAT/SPPLD",
      description: "Alta SAT vinculada al EUI: sujeto obligado, actividad, REC, folio y acuses.",
      path: "/registro-sat",
      progress: 100,
      status: "completado",
      iconName: "FileCheck",
      category: "cumplimiento",
      priority: 1,
      tasks: [
        { id: "sat-1", title: "Capturar sujeto obligado", completed: true },
        { id: "sat-2", title: "Cargar acuse de registro", completed: true },
        { id: "sat-3", title: "Designar REC/Oficial", completed: true },
      ],
    },
    {
      id: "kyc-demo",
      title: "Expedientes KYC",
      description: "EUI multi-cliente enlazado a Alta SAT, beneficiario controlador y evidencia.",
      path: "/kyc-expediente",
      progress: 85,
      status: "en-progreso",
      iconName: "Users",
      category: "documentacion",
      priority: 1,
      tasks: [
        { id: "kyc-1", title: "Cliente moral inmobiliario", completed: true },
        { id: "kyc-2", title: "Cliente persona física PEP", completed: true },
        { id: "kyc-3", title: "Completar evidencia complementaria", completed: false },
      ],
    },
    {
      id: "operaciones-demo",
      title: "Actos y Operaciones",
      description: "Operaciones con identificación, EBR/evidencia y salida SAT sugerida.",
      path: "/actividades-vulnerables",
      progress: 80,
      status: "pendiente-revision",
      iconName: "Shield",
      category: "cumplimiento",
      priority: 1,
      tasks: [
        { id: "op-1", title: "Registrar operaciones inmobiliarias", completed: true },
        { id: "op-2", title: "Validar avisos ordinarios", completed: true },
        { id: "op-3", title: "Cerrar evidencia PEP", completed: false },
      ],
    },
    {
      id: "avisos-sat-demo",
      title: "Avisos e Informes SAT",
      description: "Ruta demo: Alta SAT → EUI → Operación → EBR/Evidencia → Aviso/Informe SAT.",
      path: "/avisos-informes",
      progress: 100,
      status: "completado",
      iconName: "FileText",
      category: "cumplimiento",
      priority: 1,
      tasks: [
        { id: "sat-out-1", title: "XML de aviso normal", completed: true },
        { id: "sat-out-2", title: "Informe en ceros", completed: true },
        { id: "sat-out-3", title: "Informe 27 Bis y aviso 24 horas", completed: true },
      ],
    },
    {
      id: "auditoria-demo",
      title: "Auditoría y Planes de Acción",
      description: "Hallazgos, observaciones y acciones correctivas listas para demo.",
      path: "/auditoria-verificacion",
      progress: 65,
      status: "en-progreso",
      iconName: "ClipboardList",
      category: "cumplimiento",
      priority: 2,
      tasks: [
        { id: "aud-1", title: "Generar matriz de cumplimiento", completed: true },
        { id: "aud-2", title: "Documentar acciones correctivas", completed: true },
        { id: "aud-3", title: "Adjuntar remisión final", completed: false },
      ],
    },
  ]
}

export function buildPldDemoDataset(referenceDate = new Date()): PldDemoDataset {
  const registroSat = buildRegistroSat(referenceDate)
  const expedientes = buildExpedientes(referenceDate)
  const operaciones = buildOperations(referenceDate)
  const ebr = buildEbrEvaluations(referenceDate)
  const beneficiario = buildBeneficiario(referenceDate)
  const training = buildTraining(referenceDate)
  const auditoria = buildAuditoria(referenceDate)
  const evidencias = buildEvidencias(referenceDate)
  const gobernanza = buildGobernanza(referenceDate)
  const tenantState = buildDefaultPldTenants("tenant-demo-isn")
  tenantState.tenants[0] = {
    ...tenantState.tenants[0],
    rfc: DEMO_SUBJECT.rfc,
    razonSocial: DEMO_SUBJECT.nombre,
    nombreComercial: "Sierra Norte Demo PLD",
    representanteCumplimiento: {
      ...tenantState.tenants[0].representanteCumplimiento,
      nombre: DEMO_SUBJECT.oficial,
      email: DEMO_SUBJECT.correoCumplimiento,
    },
  }
  const satOutputPackages = buildSatOutputPackages(referenceDate)
  const satFormatSnapshot = buildSatFormatSnapshot(referenceDate.toISOString())
  const metadata = {
    schemaVersion: 1,
    name: "Demo PLD Actividades Vulnerables 2026",
    seededAt: referenceDate.toISOString(),
    subjectName: DEMO_SUBJECT.nombre,
    subjectRfc: DEMO_SUBJECT.rfc,
    counts: {
      sujetosRegistrados: registroSat.sujetosRegistrados.length,
      expedientes: expedientes.length,
      operaciones: operaciones.length,
      ebr: Object.keys(ebr).length,
      evidencias: evidencias.docs.length,
      satPackages: satOutputPackages.length,
      hallazgos: auditoria.planes.length,
    },
  }

  return {
    "registro-sat-data": registroSat,
    "pld-tenants": tenantState,
    "pld-active-tenant-id": tenantState.activeTenantId,
    kyc_expedientes_detalle: expedientes,
    actividades_vulnerables_clientes: expedientes.map((expediente) => ({
      rfc: expediente.rfc,
      nombre: expediente.nombre,
      tipoCliente: expediente.tipoCliente,
      mismoGrupo: false,
      detalleTipoCliente: expediente.detalleTipoCliente,
    })),
    actividades_vulnerables_operaciones: operaciones,
    ebr_evaluaciones: ebr,
    "beneficiario-controlador-data": beneficiario,
    "pld-training-module": training,
    "capacitacion-control-data": training,
    "auditoria-lineamientos": auditoria.lineamientos,
    "auditoria-interna-registros": auditoria.auditorias,
    "auditoria-observaciones-autoridades": auditoria.observaciones,
    "auditoria-planes-accion": auditoria.planes,
    "auditoria-verificacion-data": auditoria.resumen,
    "pld-evidences-documents": evidencias.docs,
    "pld-evidences-logs": evidencias.logs,
    "evidencias-trazabilidad-data": evidencias.snapshot,
    "pld-sat-output-packages": satOutputPackages,
    "pld-sat-format-snapshot": satFormatSnapshot,
    "gobernanza-control-data": gobernanza,
    "monitoreo-operaciones-data": {
      alertas: operaciones
        .filter((operacion) => operacion.umbralStatus === "aviso" || operacion.pepScreening?.requiresHumanReview)
        .map((operacion) => ({
          id: `mon-${operacion.id}`,
          rfc: operacion.rfc,
          cliente: operacion.cliente,
          tipo: operacion.pepScreening?.requiresHumanReview ? "PEP" : "Aviso",
          nivel: operacion.pepScreening?.requiresHumanReview ? "Alto" : "Medio",
          fecha: operacion.fechaOperacion,
          estado: operacion.alertaResuelta ? "Atendida" : "Pendiente",
        })),
    },
    documents: evidencias.docs.map((doc) => ({
      id: doc.id,
      name: doc.title,
      module: doc.module,
      uploadedAt: doc.uploadDate,
      fileName: doc.fileName,
    })),
    completedActivities: [
      "registro-sat-demo",
      "kyc-dlv-demo",
      "operacion-dlv-aviso-demo",
      "ebr-pep-demo",
      "capacitacion-abril-demo",
    ],
    userSectionsProgress: buildProgress(),
    [DEMO_SEED_METADATA_KEY]: metadata,
  }
}

export function installPldDemoData(storage: DemoStorage, referenceDate = new Date()) {
  const dataset = buildPldDemoDataset(referenceDate)
  DEMO_STORAGE_KEYS.forEach((key) => {
    storage.setItem(key, JSON.stringify(dataset[key]))
  })
  const metadata = dataset[DEMO_SEED_METADATA_KEY] as { counts: Record<string, number> }
  return {
    keysWritten: [...DEMO_STORAGE_KEYS],
    counts: metadata.counts,
  }
}

export function clearPldDemoData(storage: DemoStorage) {
  DEMO_STORAGE_KEYS.forEach((key) => storage.removeItem(key))
}

export function getPldDemoSeedStatus(storage: DemoStorage) {
  const raw = storage.getItem(DEMO_SEED_METADATA_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as {
      schemaVersion: number
      name: string
      seededAt: string
      subjectName: string
      subjectRfc: string
      counts: Record<string, number>
    }
  } catch {
    return null
  }
}
