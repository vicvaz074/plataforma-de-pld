"use client"

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { actividadesVulnerables } from "@/lib/data/actividades"
import { findCodigoPostalInfo, registerCodigoPostalInfo, type CodigoPostalInfo } from "@/lib/data/codigos-postales"
import { PAISES, findPaisByNombre } from "@/lib/data/paises"
import { readFileAsDataUrl } from "@/lib/storage/read-file"
import { cn } from "@/lib/utils"
import { Building2, ClipboardList, FileText, Paperclip, ShieldCheck, Upload, UserCog } from "lucide-react"
import type { LucideIcon } from "lucide-react"

interface RequiredDataField {
  id: string
  label: string
  description: string
  required: boolean
  tips?: string[]
}

interface RequiredDataSection {
  id: string
  title: string
  description: string
  icon: LucideIcon
  fields: RequiredDataField[]
  appliesTo: SubjectType[]
}

type SubjectType = "none" | "fisica" | "moral" | "fideicomiso"
type RegistroDocumentKey = "detalle" | "acuse" | "aceptacion"

interface DocumentUpload {
  id: string
  name: string
  type: string
  uploadDate: Date
  dataUrl: string
  mimeType: string
  size: number
}

interface SujetoRegistrado {
  id: string
  nombre: string
  tipo: SubjectType
  actividad: string
  creadoEn: Date
  documentos: Record<RegistroDocumentKey, DocumentUpload | null>
  checklistCampos: string[]
  registroCompleto: boolean
  identificacion: IdentificacionSujeto
  contactos: ContactoSujeto[]
  actividades: ActividadSujeto[]
  representante: RepresentanteCumplimiento | null
}

type DatosChecklistState = Record<string, { completed: boolean; notes: string }>

interface IdentificacionSujeto {
  fecha: string
  rfc: string
  nombre: string
  apellidoPaterno: string
  paisNacionalidad: string
  paisNacimiento: string
  curp: string
}

interface ContactoSujeto {
  nombreCompleto: string
  claveLada: string
  telefonoFijo: string
  extension: string
  telefonoMovil: string
  correo: string
}

interface DomicilioActividad {
  codigoPostal: string
  tipoVialidad: string
  nombreVialidad: string
  numeroExterior: string
  numeroInterior: string
  colonia: string
  alcaldia: string
  entidad: string
  pais: string
}

interface ActividadSujeto {
  actividadKey: string
  fechaPrimera: string
  cuentaRegistro: "" | "si" | "no"
  tipoDocumento: string
  autoridadDocumento: string
  folioDocumento: string
  periodoDocumento: string
  domicilio: DomicilioActividad
}

interface RepresentanteCumplimiento {
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  fechaNacimiento: string
  rfc: string
  curp: string
  paisNacionalidad: string
  fechaDesignacion: string
  fechaAceptacion: string
  contacto: {
    claveLada: string
    telefonoFijo: string
    extension: string
    telefonoMovil: string
    correo: string
  }
  certificacion: {
    respuesta: "" | "si" | "no"
    tipoDocumento: string
    autoridadDocumento: string
    folioDocumento: string
    periodoDocumento: string
  }
}

interface EjemploSujetoObligado {
  id: string
  label: string
  tipo: SubjectType
  identificacion: IdentificacionSujeto
  contactos: ContactoSujeto[]
  actividades: ActividadSujeto[]
  representante?: RepresentanteCumplimiento | null
}

const datosAltaRegistro: RequiredDataSection[] = [
  {
    id: "actividad-vulnerable",
    title: "Actividad vulnerable declarada",
    description: "Pregunta central del checklist: ¿qué actividad vulnerable realizarás?",
    icon: ShieldCheck,
    appliesTo: ["fisica", "moral", "fideicomiso"],
    fields: [
      {
        id: "actividad-descripcion",
        label: "Actividad vulnerable a realizar",
        description: "Describe la fracción seleccionada y la operación que se realizará.",
        required: true,
        tips: ["Redacta la fracción del artículo 17 y el giro concreto."],
      },
      {
        id: "actividad-ubicacion",
        label: "Domicilio donde se ejecuta la actividad",
        description: "Dirección completa para identificar el lugar de operaciones.",
        required: true,
      },
    ],
  },
  {
    id: "persona-fisica-identificacion",
    title: "Identificación de persona física (Anexo 1)",
    description: "Datos solicitados por el SAT para sujetos obligados personas físicas.",
    icon: ClipboardList,
    appliesTo: ["fisica"],
    fields: [
      {
        id: "pf-nombre",
        label: "Nombre completo",
        description: "Tal como aparece en la identificación oficial y RFC.",
        required: true,
      },
      {
        id: "pf-rfc",
        label: "RFC",
        description: "Clave de RFC activa con homoclave.",
        required: true,
      },
      {
        id: "pf-curp",
        label: "CURP",
        description: "Identificador de población asociado a la persona física.",
        required: true,
      },
      {
        id: "pf-domicilio",
        label: "Domicilio fiscal",
        description: "Calle, número, colonia, municipio y código postal.",
        required: true,
      },
    ],
  },
  {
    id: "persona-moral-identidad",
    title: "Identidad de la persona moral (Anexo 2)",
    description: "Datos societarios para el alta de sujetos obligados personas morales.",
    icon: Building2,
    appliesTo: ["moral"],
    fields: [
      {
        id: "pm-denominacion",
        label: "Denominación o razón social",
        description: "Nombre legal completo conforme al acta constitutiva.",
        required: true,
      },
      {
        id: "pm-rfc",
        label: "RFC de la sociedad",
        description: "Registro Federal de Contribuyentes activo.",
        required: true,
      },
      {
        id: "pm-representante",
        label: "Representante legal",
        description: "Nombre completo y cargo del representante acreditado.",
        required: true,
      },
      {
        id: "pm-domicilio",
        label: "Domicilio fiscal",
        description: "Domicilio registrado ante el SAT para la sociedad.",
        required: true,
      },
    ],
  },
  {
    id: "fideicomiso-datos",
    title: "Datos del fideicomiso",
    description: "Información clave para sujetos obligados constituidos como fideicomiso.",
    icon: ClipboardList,
    appliesTo: ["fideicomiso"],
    fields: [
      {
        id: "fid-nombre",
        label: "Nombre del fideicomiso",
        description: "Denominación utilizada en el contrato de fideicomiso.",
        required: true,
      },
      {
        id: "fid-fiduciario",
        label: "Fiduciario",
        description: "Institución fiduciaria responsable.",
        required: true,
      },
      {
        id: "fid-fideicomitente",
        label: "Fideicomitente y fideicomisario",
        description: "Identifica a quienes aportan y reciben beneficios.",
        required: true,
      },
    ],
  },
  {
    id: "rec-datos",
    title: "Datos del encargado de cumplimiento",
    description: "Información del representante o encargado designado.",
    icon: UserCog,
    appliesTo: ["moral", "fideicomiso"],
    fields: [
      {
        id: "rec-nombre",
        label: "Nombre completo",
        description: "Persona designada ante el SAT/UIF.",
        required: true,
      },
      {
        id: "rec-correo",
        label: "Correo de contacto",
        description: "Medio oficial para recibir notificaciones.",
        required: true,
      },
      {
        id: "rec-telefono",
        label: "Teléfono de contacto",
        description: "Número directo o con extensión.",
        required: false,
      },
    ],
  },
]

const evidenciasRecomendadas = [
  {
    id: "acta-constitutiva",
    label: "Acta constitutiva",
    descripcion: "Evidencia recomendada pero no obligatoria.",
  },
  {
    id: "situacion-fiscal",
    label: "Constancia de situación fiscal",
    descripcion: "Refuerza la identificación del sujeto obligado.",
  },
  {
    id: "comprobante-domicilio",
    label: "Comprobante de domicilio",
    descripcion: "Factura o estado de cuenta reciente (opcional).",
  },
]

const datosChecklistIndex = datosAltaRegistro.reduce<
  Record<string, { sectionId: string; sectionTitle: string; field: RequiredDataField }>
>((acc, section) => {
  section.fields.forEach((field) => {
    acc[field.id] = { sectionId: section.id, sectionTitle: section.title, field }
  })
  return acc
}, {})

const createDefaultDatosChecklistState = (): DatosChecklistState =>
  datosAltaRegistro.reduce<DatosChecklistState>((acc, section) => {
    section.fields.forEach((field) => {
      acc[field.id] = { completed: false, notes: "" }
    })
    return acc
  }, {})

const createDefaultIdentificacion = (): IdentificacionSujeto => ({
  fecha: "",
  rfc: "",
  nombre: "",
  apellidoPaterno: "",
  paisNacionalidad: "",
  paisNacimiento: "",
  curp: "",
})

const createDefaultContacto = (): ContactoSujeto => ({
  nombreCompleto: "",
  claveLada: "",
  telefonoFijo: "",
  extension: "",
  telefonoMovil: "",
  correo: "",
})

const createDefaultDomicilio = (): DomicilioActividad => ({
  codigoPostal: "",
  tipoVialidad: "",
  nombreVialidad: "",
  numeroExterior: "",
  numeroInterior: "",
  colonia: "",
  alcaldia: "",
  entidad: "",
  pais: "México",
})

const createDefaultActividad = (): ActividadSujeto => ({
  actividadKey: "",
  fechaPrimera: "",
  cuentaRegistro: "",
  tipoDocumento: "",
  autoridadDocumento: "",
  folioDocumento: "",
  periodoDocumento: "",
  domicilio: createDefaultDomicilio(),
})

const createDefaultRepresentante = (): RepresentanteCumplimiento => ({
  nombre: "",
  apellidoPaterno: "",
  apellidoMaterno: "",
  fechaNacimiento: "",
  rfc: "",
  curp: "",
  paisNacionalidad: "",
  fechaDesignacion: "",
  fechaAceptacion: "",
  contacto: {
    claveLada: "",
    telefonoFijo: "",
    extension: "",
    telefonoMovil: "",
    correo: "",
  },
  certificacion: {
    respuesta: "",
    tipoDocumento: "",
    autoridadDocumento: "",
    folioDocumento: "",
    periodoDocumento: "",
  },
})

const tiposSujetos: { value: SubjectType; label: string }[] = [
  { value: "none", label: "---" },
  { value: "fisica", label: "Persona física" },
  { value: "moral", label: "Persona moral" },
  { value: "fideicomiso", label: "Fideicomiso" },
]

const opcionesDocumento = ["Registro", "Autorización", "Patente", "Certificado", "Otro"]
const opcionesAutoridad = ["SAT", "SHCP", "CNBV", "UIF", "Otra"]
const SEPOMEX_API_BASE = "https://api.zippopotam.us/mx"
const SEPOMEX_STORAGE_PREFIX = "codigo_postal_cache_"
const actividadEjemplo = actividadesVulnerables[0]?.key ?? ""

const ejemplosSujetosObligados: EjemploSujetoObligado[] = [
  {
    id: "fisica-joyeria",
    label: "Persona física · Joyería local",
    tipo: "fisica",
    identificacion: {
      fecha: "1988-05-20",
      rfc: "GOML880520ABC",
      nombre: "Laura",
      apellidoPaterno: "Gómez",
      paisNacionalidad: "MX",
      paisNacimiento: "MX",
      curp: "GOML880520MDFRLR09",
    },
    contactos: [
      {
        nombreCompleto: "Laura Gómez Ruiz",
        claveLada: "55",
        telefonoFijo: "5512345678",
        extension: "101",
        telefonoMovil: "5511122233",
        correo: "laura.gomez@joyeria.example",
      },
      {
        nombreCompleto: "Carlos Hernández",
        claveLada: "55",
        telefonoFijo: "5588776655",
        extension: "",
        telefonoMovil: "5544332211",
        correo: "c.hernandez@joyeria.example",
      },
    ],
    actividades: [
      {
        actividadKey: actividadEjemplo,
        fechaPrimera: "2023-01-15",
        cuentaRegistro: "si",
        tipoDocumento: "Registro",
        autoridadDocumento: "SAT",
        folioDocumento: "REG-12345",
        periodoDocumento: "2023-2025",
        domicilio: {
          codigoPostal: "03100",
          tipoVialidad: "Avenida",
          nombreVialidad: "Insurgentes Sur",
          numeroExterior: "123",
          numeroInterior: "4B",
          colonia: "Del Valle Centro",
          alcaldia: "Benito Juárez",
          entidad: "Ciudad de México",
          pais: "México",
        },
      },
    ],
    representante: null,
  },
  {
    id: "moral-inmobiliaria",
    label: "Persona moral · Inmobiliaria",
    tipo: "moral",
    identificacion: {
      fecha: "2015-09-10",
      rfc: "INM150910XYZ",
      nombre: "Inmuebles del Centro, S.A. de C.V.",
      apellidoPaterno: "",
      paisNacionalidad: "",
      paisNacimiento: "",
      curp: "",
    },
    contactos: [
      {
        nombreCompleto: "Marta Silva López",
        claveLada: "81",
        telefonoFijo: "8188996677",
        extension: "200",
        telefonoMovil: "8111223344",
        correo: "marta.silva@inmuebles.example",
      },
    ],
    actividades: [
      {
        actividadKey: actividadEjemplo,
        fechaPrimera: "2019-06-01",
        cuentaRegistro: "no",
        tipoDocumento: "",
        autoridadDocumento: "",
        folioDocumento: "",
        periodoDocumento: "",
        domicilio: {
          codigoPostal: "64000",
          tipoVialidad: "Calle",
          nombreVialidad: "Morelos",
          numeroExterior: "250",
          numeroInterior: "",
          colonia: "Centro",
          alcaldia: "Monterrey",
          entidad: "Nuevo León",
          pais: "México",
        },
      },
    ],
    representante: {
      nombre: "Raúl",
      apellidoPaterno: "Martínez",
      apellidoMaterno: "Ortega",
      fechaNacimiento: "1979-04-12",
      rfc: "MAOR790412XYZ",
      curp: "MAOR790412HMCRRL07",
      paisNacionalidad: "MX",
      fechaDesignacion: "2022-01-05",
      fechaAceptacion: "2022-01-10",
      contacto: {
        claveLada: "81",
        telefonoFijo: "8188553322",
        extension: "115",
        telefonoMovil: "8112233445",
        correo: "raul.martinez@inmuebles.example",
      },
      certificacion: {
        respuesta: "si",
        tipoDocumento: "Certificado",
        autoridadDocumento: "UIF",
        folioDocumento: "CERT-7788",
        periodoDocumento: "2023-2025",
      },
    },
  },
  {
    id: "fideicomiso-energia",
    label: "Fideicomiso · Energía renovable",
    tipo: "fideicomiso",
    identificacion: {
      fecha: "2020-02-28",
      rfc: "FEN200228AAA",
      nombre: "Fideicomiso Energía Verde",
      apellidoPaterno: "",
      paisNacionalidad: "MX",
      paisNacimiento: "",
      curp: "",
    },
    contactos: [
      {
        nombreCompleto: "Valeria Soto Paredes",
        claveLada: "33",
        telefonoFijo: "3333556677",
        extension: "12",
        telefonoMovil: "3312345678",
        correo: "valeria.soto@fideicomiso.example",
      },
    ],
    actividades: [
      {
        actividadKey: actividadEjemplo,
        fechaPrimera: "2021-03-15",
        cuentaRegistro: "si",
        tipoDocumento: "Autorización",
        autoridadDocumento: "SHCP",
        folioDocumento: "AUT-4599",
        periodoDocumento: "2021-2026",
        domicilio: {
          codigoPostal: "44100",
          tipoVialidad: "Avenida",
          nombreVialidad: "Juárez",
          numeroExterior: "880",
          numeroInterior: "12",
          colonia: "Americana",
          alcaldia: "Guadalajara",
          entidad: "Jalisco",
          pais: "México",
        },
      },
    ],
    representante: {
      nombre: "Patricia",
      apellidoPaterno: "Luna",
      apellidoMaterno: "Zepeda",
      fechaNacimiento: "1982-11-30",
      rfc: "LUZP821130QWE",
      curp: "LUZP821130MJCLPR08",
      paisNacionalidad: "MX",
      fechaDesignacion: "2020-03-10",
      fechaAceptacion: "2020-03-12",
      contacto: {
        claveLada: "33",
        telefonoFijo: "3333778899",
        extension: "",
        telefonoMovil: "3311988877",
        correo: "patricia.luna@fideicomiso.example",
      },
      certificacion: {
        respuesta: "no",
        tipoDocumento: "",
        autoridadDocumento: "",
        folioDocumento: "",
        periodoDocumento: "",
      },
    },
  },
]

const normalizarTexto = (valor: unknown) => (typeof valor === "string" ? valor : "")
const normalizarEspacios = (texto: string) => texto.replace(/\s+/g, " ").trim()
const normalizarBusqueda = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()

const obtenerCodigoPais = (pais?: string) => {
  if (!pais) return ""
  const encontrado = findPaisByNombre(pais)?.code
  if (encontrado) return encontrado
  const normalizado = normalizarBusqueda(pais)
  if (normalizado.includes("mexic")) return "MX"
  if (normalizado.includes("estados unidos")) return "US"
  return ""
}

const convertirFecha = (valor?: string) => {
  if (!valor) return ""
  const match = valor.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return ""
  const [, dia, mes, anio] = match
  return `${anio}-${mes}-${dia}`
}

const encontrarActividadKey = (actividad: string) => {
  if (!actividad) return ""
  const actividadNormalizada = normalizarBusqueda(actividad)
  return (
    actividadesVulnerables.find((item) => {
      const nombreNormalizado = normalizarBusqueda(item.nombre)
      return (
        actividadNormalizada.includes(nombreNormalizado) || nombreNormalizado.includes(actividadNormalizada)
      )
    })?.key ?? ""
  )
}

const extraerContactosDesdeTexto = (textoPlano: string): ContactoSujeto[] => {
  const texto = normalizarEspacios(textoPlano)
  const contactos: ContactoSujeto[] = []

  const detalleRegex =
    /Clave lada:\s*([0-9]{2,3})\s*Número de teléfono:\s*([0-9]+)\s*Correo electrónico:\s*([^\s]+)\s*Celular:\s*([0-9]+)/gi
  const acuseRegex =
    /Clave Lada:\s*([0-9]{2,3})\s*Telef[oó]no:\s*([0-9]+)\s*Celular:\s*([0-9]+)\s*Correo electrónico:\s*([^\s]+)/gi

  const capturar = (match: RegExpExecArray) => {
    contactos.push({
      nombreCompleto: "",
      claveLada: match[1] ?? "",
      telefonoFijo: match[2] ?? "",
      extension: "",
      telefonoMovil: match[4] ?? "",
      correo: match[3] ?? "",
    })
  }

  let match = detalleRegex.exec(texto)
  while (match) {
    capturar(match)
    match = detalleRegex.exec(texto)
  }

  match = acuseRegex.exec(texto)
  while (match) {
    const contacto = {
      nombreCompleto: "",
      claveLada: match[1] ?? "",
      telefonoFijo: match[2] ?? "",
      extension: "",
      telefonoMovil: match[3] ?? "",
      correo: match[4] ?? "",
    }
    contactos.push(contacto)
    match = acuseRegex.exec(texto)
  }

  const ladas = Array.from(texto.matchAll(/Clave Lada:\s*([0-9]{2,3})/gi)).map(
    (item) => item[1] ?? "",
  )
  const telefonos = Array.from(texto.matchAll(/Telef[oó]no:\s*([0-9]+)/gi)).map(
    (item) => item[1] ?? "",
  )
  const celulares = Array.from(texto.matchAll(/Celular:\s*([0-9]+)/gi)).map(
    (item) => item[1] ?? "",
  )
  const correos = Array.from(texto.matchAll(/Correo electrónico:\s*([^\s]+)/gi)).map(
    (item) => item[1] ?? "",
  )

  const maxRegistros = Math.max(ladas.length, telefonos.length, celulares.length, correos.length)
  if (maxRegistros > 0) {
    for (let index = 0; index < maxRegistros; index += 1) {
      contactos.push({
        nombreCompleto: "",
        claveLada: ladas[index] ?? "",
        telefonoFijo: telefonos[index] ?? "",
        extension: "",
        telefonoMovil: celulares[index] ?? "",
        correo: correos[index] ?? "",
      })
    }
  }

  const unicos = new Map<string, ContactoSujeto>()
  contactos.forEach((contacto) => {
    const key = `${contacto.correo}-${contacto.telefonoFijo}-${contacto.telefonoMovil}`
    if (!unicos.has(key)) {
      unicos.set(key, contacto)
    }
  })

  return Array.from(unicos.values())
}

const extraerDatosRegistroDesdeTexto = (textoPlano: string) => {
  const texto = normalizarEspacios(textoPlano.replace(/\|/g, " "))
  const datos: {
    tipoSujeto?: SubjectType
    identificacion?: Partial<IdentificacionSujeto>
    contactos?: ContactoSujeto[]
    actividad?: Partial<ActividadSujeto>
    domicilio?: Partial<DomicilioActividad>
    representante?: Partial<RepresentanteCumplimiento>
  } = {}

  if (/persona\s+f[ií]sica/i.test(texto)) {
    datos.tipoSujeto = "fisica"
  } else if (/persona\s+moral/i.test(texto)) {
    datos.tipoSujeto = "moral"
  } else if (/fideicomiso/i.test(texto)) {
    datos.tipoSujeto = "fideicomiso"
  }

  const denominacionMatch = texto.match(
    /Denominaci[oó]n o raz[oó]n social:\s*(.+?)\s*Fecha de constituci[oó]n/i,
  )
  const denominacionAcuseMatch = texto.match(
    /Denominaci[oó]n o raz[oó]n social:\s*([A-ZÁÉÍÓÚÑ0-9/.\s]+?)\s*(RFC:|FECHA|PA[IÍ]S|NACIONALIDAD|$)/i,
  )
  const identificacionMatch = texto.match(
    /([A-ZÁÉÍÓÚÑ0-9/.\s]+?)\s+(\d{2}\/\d{2}\/\d{4})\s+([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i,
  )
  const identificacionInvertidaMatch = texto.match(
    /([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})\s+([A-ZÁÉÍÓÚÑ0-9/.\s]+?)\s+(\d{2}\/\d{2}\/\d{4})/i,
  )
  const rfcMatch = texto.match(/RFC:\s*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i)
  const rfcLibreMatch = texto.match(/[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}/)
  const fechaConstitucionMatch = texto.match(/Fecha de constituci[oó]n:\s*(\d{2}\/\d{2}\/\d{4})/i)
  const fechaLibreMatch = texto.match(/\d{2}\/\d{2}\/\d{4}/)
  const nacionalidadMatch = texto.match(/Pa[ií]s de nacionalidad:\s*([A-ZÁÉÍÓÚÑ\s]+)/i)
  const paisConstitucionMatch = texto.match(
    /PA[IÍ]S DE CONSTITUCI[OÓ]N:\s*([A-ZÁÉÍÓÚÑ\s]+)\s+NACIONALIDAD:\s*([A-ZÁÉÍÓÚÑ\s]+)/i,
  )

  const paisNacionalidad = (nacionalidadMatch?.[1] ?? paisConstitucionMatch?.[2] ?? "").trim()

  const nombreExtraido = normalizarEspacios(
    denominacionMatch?.[1]?.trim() ??
      denominacionAcuseMatch?.[1]?.trim() ??
      identificacionMatch?.[1]?.trim() ??
      identificacionInvertidaMatch?.[2]?.trim() ??
      "",
  )
  const fechaExtraida = convertirFecha(
    fechaConstitucionMatch?.[1] ??
      identificacionMatch?.[2] ??
      identificacionInvertidaMatch?.[3] ??
      fechaLibreMatch?.[0],
  )
  const rfcExtraido =
    rfcMatch?.[1]?.trim() ??
    identificacionMatch?.[3]?.trim() ??
    identificacionInvertidaMatch?.[1]?.trim() ??
    rfcLibreMatch?.[0]?.trim() ??
    ""

  datos.identificacion = {
    nombre: nombreExtraido,
    rfc: rfcExtraido,
    fecha: fechaExtraida,
    paisNacionalidad: obtenerCodigoPais(paisNacionalidad),
  }

  if (!datos.identificacion.nombre && /FIDEICOMISO/i.test(texto)) {
    const fallback = texto.match(/FIDEICOMISO\s+[0-9/ A-ZÁÉÍÓÚÑ]+/i)
    if (fallback?.[0]) {
      datos.identificacion.nombre = fallback[0].trim()
    }
  }

  datos.contactos = extraerContactosDesdeTexto(texto)

  const actividadMatch = texto.match(
    /Actividad vulnerable:\s*Fecha inicial:\s*([A-ZÁÉÍÓÚÑ\s]+?)\s+(\d{2}\/\d{2}\/\d{4})\s*([A-ZÁÉÍÓÚÑ\s]+)?/i,
  )
  const actividadAcuseMatch = texto.match(
    /ACTIVIDAD VULNERABLE REALIZADA\s*FECHA PRIMERA OPERACION\s*([A-ZÁÉÍÓÚÑ\s]+?)\s+(\d{2}\/\d{2}\/\d{4})/i,
  )
  const actividadNombre =
    actividadMatch || actividadAcuseMatch
      ? normalizarEspacios(
          [actividadMatch?.[1], actividadMatch?.[3]].filter(Boolean).join(" ") ||
            actividadAcuseMatch?.[1] ||
            "",
        )
      : ""
  const fechaActividad = actividadMatch?.[2] || actividadAcuseMatch?.[2] || ""

  datos.actividad = {
    actividadKey: encontrarActividadKey(actividadNombre),
    fechaPrimera: convertirFecha(fechaActividad),
  }

  const codigoPostalMatch = texto.match(/C[oó]digo postal:\s*(\d{5})/i)
  const calleMatch = texto.match(/Nombre de la calle o vialidad:\s*([A-ZÁÉÍÓÚÑ0-9\s.]+?)\s*C[oó]digo postal:/i)
  const entidadMatch = texto.match(/Entidad federativa:\s*([A-ZÁÉÍÓÚÑ\s]+)/i)
  const coloniaMatch = texto.match(/Colonia:\s*([A-ZÁÉÍÓÚÑ0-9\s]+)/i)
  const numeroExteriorMatch = texto.match(/N[uú]mero exterior:\s*([A-Z0-9\s]+)/i)
  const numeroInteriorMatch = texto.match(/N[uú]mero interior:\s*([A-Z0-9\s]+)/i)
  const alcaldiaMatch = texto.match(/Delegaci[oó]n o municipio:\s*([A-ZÁÉÍÓÚÑ0-9\s]+)/i)
  const tipoVialidadMatch = texto.match(/Tipo de vialidad:\s*([A-ZÁÉÍÓÚÑ\s]+)/i)

  datos.domicilio = {
    codigoPostal: codigoPostalMatch?.[1] ?? "",
    nombreVialidad: calleMatch?.[1]?.trim() ?? "",
    entidad: entidadMatch?.[1]?.trim() ?? "",
    colonia: coloniaMatch?.[1]?.trim() ?? "",
    numeroExterior: numeroExteriorMatch?.[1]?.trim() ?? "",
    numeroInterior: numeroInteriorMatch?.[1]?.trim() ?? "",
    alcaldia: alcaldiaMatch?.[1]?.trim() ?? "",
    tipoVialidad: tipoVialidadMatch?.[1]?.trim() ?? "",
    pais: "México",
  }

  const representanteMatch = texto.match(
    /Nombre:\s*([A-ZÁÉÍÓÚÑ\s]+?)\s*Fecha de nacimiento:\s*(\d{2}\/\d{2}\/\d{4})\s*Pa[ií]s de nacionalidad:\s*([A-ZÁÉÍÓÚÑ\s]+?)\s*Apellido paterno:\s*([A-ZÁÉÍÓÚÑ\s]+?)\s*RFC:\s*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})\s*Apellido materno:\s*([A-ZÁÉÍÓÚÑ\s]+?)\s*CURP:\s*([A-Z0-9]{18})\s*Fecha de designaci[oó]n:\s*(\d{2}\/\d{2}\/\d{4})/i,
  )

  if (representanteMatch) {
    datos.representante = {
      nombre: representanteMatch[1]?.trim() ?? "",
      fechaNacimiento: convertirFecha(representanteMatch[2]),
      paisNacionalidad: obtenerCodigoPais(representanteMatch[3]),
      apellidoPaterno: representanteMatch[4]?.trim() ?? "",
      rfc: representanteMatch[5]?.trim() ?? "",
      apellidoMaterno: representanteMatch[6]?.trim() ?? "",
      curp: representanteMatch[7]?.trim() ?? "",
      fechaDesignacion: convertirFecha(representanteMatch[8]),
    }
  }

  if (/ACEPTACI[OÓ]N DE DESIGNACI[OÓ]N/i.test(texto) || /DESIGNACI[OÓ]N DE RESPONSABLE DE CUMPLIMIENTO/i.test(texto)) {
    const identidadMatch = texto.match(
      /NOMBRE\(S\):\s*([A-ZÁÉÍÓÚÑ\s]+?)\s*PRIMER APELLIDO:\s*([A-ZÁÉÍÓÚÑ\s]+?)\s*SEGUNDO APELLIDO:\s*([A-ZÁÉÍÓÚÑ\s]+?)\s*FECHA DE NACIMIENTO:\s*(\d{2}\/\d{2}\/\d{4})\s*PA[IÍ]S DE NACIMIENTO:\s*([A-ZÁÉÍÓÚÑ\s]+?)\s*PA[IÍ]S DE NACIONALIDAD:\s*([A-ZÁÉÍÓÚÑ\s]+)/i,
    )
    const curpNombreMatch = texto.match(
      /([A-Z]{4}\d{6}[A-Z0-9]{8})\s+([A-ZÁÉÍÓÚÑ]+)\s+([A-ZÁÉÍÓÚÑ]+)(?:\s+([A-ZÁÉÍÓÚÑ]+))?/,
    )
    const rfcAceptacionMatch = texto.match(/RFC:\s*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/i)
    const curpMatch = texto.match(/[A-Z]{4}\d{6}[A-Z0-9]{8}/)
    const fechaEstadoMatch = texto.match(/Fecha de estado:\s*(\d{2}\/\d{2}\/\d{4})/i)
    const fechasAceptacion = Array.from(texto.matchAll(/ACEPTAD[OA]\s*(\d{2}\/\d{2}\/\d{4})/gi)).map(
      (match) => match[1] ?? "",
    )
    const contactoAceptacion = {
      claveLada: texto.match(/Clave Lada:\s*([0-9]{2,3})/i)?.[1] ?? "",
      telefonoFijo: texto.match(/Telef[oó]no:\s*([0-9]+)/i)?.[1] ?? "",
      extension: "",
      telefonoMovil: texto.match(/Celular:\s*([0-9]+)/i)?.[1] ?? "",
      correo: texto.match(/Correo electr[oó]nico:\s*([^\s]+)/i)?.[1] ?? "",
    }

    datos.representante = {
      ...datos.representante,
      nombre: identidadMatch?.[1]?.trim() ?? curpNombreMatch?.[2]?.trim() ?? datos.representante?.nombre ?? "",
      apellidoPaterno:
        identidadMatch?.[2]?.trim() ?? curpNombreMatch?.[3]?.trim() ?? datos.representante?.apellidoPaterno ?? "",
      apellidoMaterno:
        identidadMatch?.[3]?.trim() ?? curpNombreMatch?.[4]?.trim() ?? datos.representante?.apellidoMaterno ?? "",
      fechaNacimiento:
        convertirFecha(identidadMatch?.[4] ?? "") ||
        datos.representante?.fechaNacimiento ||
        "",
      paisNacionalidad: obtenerCodigoPais(identidadMatch?.[6] ?? "") || datos.representante?.paisNacionalidad || "",
      rfc: rfcAceptacionMatch?.[1]?.trim() ?? datos.representante?.rfc ?? "",
      curp: curpMatch?.[0]?.trim() ?? datos.representante?.curp ?? "",
      fechaDesignacion: convertirFecha(fechaEstadoMatch?.[1] ?? "") || datos.representante?.fechaDesignacion || "",
      fechaAceptacion: convertirFecha(fechasAceptacion[0] ?? ""),
      contacto: contactoAceptacion,
    }
  }

  return datos
}

const construirNombreSujeto = (tipo: SubjectType, identificacion: IdentificacionSujeto) => {
  if (tipo === "fisica") {
    return [identificacion.nombre.trim(), identificacion.apellidoPaterno.trim()].filter(Boolean).join(" ")
  }
  return identificacion.nombre.trim()
}

const obtenerEtiquetaFecha = (tipo: SubjectType) => {
  if (tipo === "fisica") return "Fecha de Nacimiento"
  if (tipo === "moral") return "Fecha de Constitución"
  if (tipo === "fideicomiso") return "Fecha de Constitución"
  return "Fecha"
}

const obtenerEtiquetaNombre = (tipo: SubjectType) => {
  if (tipo === "fisica") return "Nombre(s) (sin abreviaturas)"
  if (tipo === "moral") return "Denominación o Razón Social"
  if (tipo === "fideicomiso") return "Denominación"
  return "Nombre"
}

async function fetchCodigoPostalInfo(codigo: string): Promise<CodigoPostalInfo | undefined> {
  try {
    const response = await fetch(`${SEPOMEX_API_BASE}/${codigo}`)
    if (!response.ok) return undefined
    const data = (await response.json()) as {
      "post code"?: string
      country?: string
      "country abbreviation"?: string
      places?: Array<{
        "place name"?: string
        state?: string
        "state abbreviation"?: string
        "province"?: string
        "province abbreviation"?: string
        "community"?: string
        "community abbreviation"?: string
      }>
    }
    if (!data || !Array.isArray(data.places) || data.places.length === 0) return undefined
    const place = data.places[0] ?? {}
    const asentamientos = Array.from(
      new Set(
        data.places
          .map((item) => item["place name"])
          .filter((nombre): nombre is string => Boolean(nombre && nombre.trim().length > 0)),
      ),
    )
    return {
      codigo,
      estado: place.state ?? "",
      municipio: place.province ?? place.state ?? "",
      ciudad: place.community ?? "",
      asentamientos,
    }
  } catch (error) {
    console.error("No se pudo consultar el código postal:", error)
    return undefined
  }
}

export default function RegistroSATPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("nuevo")
  const [tipoSujeto, setTipoSujeto] = useState<SubjectType>("none")
  const [identificacion, setIdentificacion] = useState<IdentificacionSujeto>(() => createDefaultIdentificacion())
  const [contactos, setContactos] = useState<ContactoSujeto[]>(() =>
    Array.from({ length: 3 }, () => createDefaultContacto()),
  )
  const [actividades, setActividades] = useState<ActividadSujeto[]>(() => [createDefaultActividad()])
  const [representante, setRepresentante] = useState<RepresentanteCumplimiento>(() => createDefaultRepresentante())
  const [documentosRegistro, setDocumentosRegistro] = useState<
    Record<RegistroDocumentKey, DocumentUpload | null>
  >({
    detalle: null,
    acuse: null,
    aceptacion: null,
  })
  const [documentos, setDocumentos] = useState<DocumentUpload[]>([])
  const [sujetosRegistrados, setSujetosRegistrados] = useState<SujetoRegistrado[]>([])
  const [sujetoSeleccionadoId, setSujetoSeleccionadoId] = useState<string | null>(null)
  const [sujetoEnEdicionId, setSujetoEnEdicionId] = useState<string | null>(null)
  const [ejemploSeleccionado, setEjemploSeleccionado] = useState<string>("")
  const [datosChecklistState, setDatosChecklistState] = useState<DatosChecklistState>(() =>
    createDefaultDatosChecklistState(),
  )

  const seccionesAplicables = useMemo(() => {
    if (tipoSujeto === "none") return []
    return datosAltaRegistro.filter((section) => section.appliesTo.includes(tipoSujeto))
  }, [tipoSujeto])

  const datosChecklistResumen = useMemo(() => {
    const total = seccionesAplicables.reduce((acc, section) => acc + section.fields.length, 0)
    const completados = seccionesAplicables.reduce(
      (acc, section) => acc + section.fields.filter((field) => datosChecklistState[field.id]?.completed).length,
      0,
    )
    const progreso = total === 0 ? 0 : Math.round((completados / total) * 100)
    return { total, completados, progreso }
  }, [datosChecklistState, seccionesAplicables])

  const catalogoActividades = useMemo(
    () =>
      new Map(
        actividadesVulnerables.map((actividad) => [
          actividad.key,
          `${actividad.fraccion} · ${actividad.nombre}`,
        ]),
      ),
    [],
  )

  const nombreSujeto = construirNombreSujeto(tipoSujeto, identificacion)

  const resumenActividades = useMemo(() => {
    const seleccionadas = actividades
      .map((actividad) => catalogoActividades.get(actividad.actividadKey))
      .filter((actividad): actividad is string => Boolean(actividad))
    return seleccionadas.join("; ")
  }, [actividades, catalogoActividades])

  useEffect(() => {
    const savedData = localStorage.getItem("registro-sat-data")
    if (!savedData) return

    try {
      const data = JSON.parse(savedData)

      const documentosGuardados = Array.isArray(data.documentos)
        ? data.documentos.map((doc: Partial<DocumentUpload>) => ({
            id: doc.id ?? Date.now().toString(),
            name: doc.name ?? "",
            type: doc.type ?? "",
            uploadDate: doc.uploadDate ? new Date(doc.uploadDate as unknown as string) : new Date(),
            dataUrl: typeof doc.dataUrl === "string" ? doc.dataUrl : "",
            mimeType: doc.mimeType ?? "application/octet-stream",
            size: typeof doc.size === "number" ? doc.size : 0,
          }))
        : []

      const checklist = createDefaultDatosChecklistState()
      if (data.datosChecklist && typeof data.datosChecklist === "object") {
        Object.entries(data.datosChecklist as Record<string, unknown>).forEach(([key, value]) => {
          if (typeof value === "object" && value !== null && key in checklist) {
            const registro = value as Record<string, unknown>
            checklist[key] = {
              completed: registro.completed === true || registro.completed === "true",
              notes: typeof registro.notes === "string" ? registro.notes : "",
            }
          }
        })
      }

      const sujetosCargados = Array.isArray(data.sujetosRegistrados)
        ? data.sujetosRegistrados.map((item: Partial<SujetoRegistrado>) => {
            const detalle = item.documentos?.detalle
              ? {
                  ...item.documentos.detalle,
                  uploadDate: new Date(item.documentos.detalle.uploadDate as unknown as string),
                }
              : null

            const acuse = item.documentos?.acuse
              ? {
                  ...item.documentos.acuse,
                  uploadDate: new Date(item.documentos.acuse.uploadDate as unknown as string),
                }
              : null

            const aceptacion = item.documentos?.aceptacion
              ? {
                  ...item.documentos.aceptacion,
                  uploadDate: new Date(item.documentos.aceptacion.uploadDate as unknown as string),
                }
              : null

            const registroCompleto =
              item.registroCompleto === true || (detalle !== null && acuse !== null && aceptacion !== null)

            return {
              id: item.id ?? crypto.randomUUID(),
              nombre: item.nombre ?? "",
              tipo: (item.tipo as SubjectType) ?? "moral",
              actividad: item.actividad ?? "",
              creadoEn: item.creadoEn ? new Date(item.creadoEn as unknown as string) : new Date(),
              checklistCampos: Array.isArray(item.checklistCampos)
                ? item.checklistCampos.map((campo) => String(campo))
                : [],
              documentos: {
                detalle,
                acuse,
                aceptacion,
              },
              registroCompleto,
              identificacion:
                item.identificacion && typeof item.identificacion === "object"
                  ? {
                      fecha: normalizarTexto((item.identificacion as Record<string, unknown>).fecha),
                      rfc: normalizarTexto((item.identificacion as Record<string, unknown>).rfc),
                      nombre: normalizarTexto((item.identificacion as Record<string, unknown>).nombre),
                      apellidoPaterno: normalizarTexto((item.identificacion as Record<string, unknown>).apellidoPaterno),
                      paisNacionalidad: normalizarTexto((item.identificacion as Record<string, unknown>).paisNacionalidad),
                      paisNacimiento: normalizarTexto((item.identificacion as Record<string, unknown>).paisNacimiento),
                      curp: normalizarTexto((item.identificacion as Record<string, unknown>).curp),
                    }
                  : createDefaultIdentificacion(),
              contactos: Array.isArray(item.contactos)
                ? item.contactos.map((contacto: Record<string, unknown>) => ({
                    nombreCompleto: normalizarTexto(contacto.nombreCompleto),
                    claveLada: normalizarTexto(contacto.claveLada),
                    telefonoFijo: normalizarTexto(contacto.telefonoFijo),
                    extension: normalizarTexto(contacto.extension),
                    telefonoMovil: normalizarTexto(contacto.telefonoMovil),
                    correo: normalizarTexto(contacto.correo),
                  }))
                : Array.from({ length: 3 }, () => createDefaultContacto()),
              actividades: Array.isArray(item.actividades)
                ? item.actividades.map((actividad: Record<string, unknown>) => ({
                    actividadKey: normalizarTexto(actividad.actividadKey),
                    fechaPrimera: normalizarTexto(actividad.fechaPrimera),
                    cuentaRegistro: normalizarTexto(actividad.cuentaRegistro) as "" | "si" | "no",
                    tipoDocumento: normalizarTexto(actividad.tipoDocumento),
                    autoridadDocumento: normalizarTexto(actividad.autoridadDocumento),
                    folioDocumento: normalizarTexto(actividad.folioDocumento),
                    periodoDocumento: normalizarTexto(actividad.periodoDocumento),
                    domicilio: {
                      codigoPostal: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.codigoPostal),
                      tipoVialidad: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.tipoVialidad),
                      nombreVialidad: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.nombreVialidad),
                      numeroExterior: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.numeroExterior),
                      numeroInterior: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.numeroInterior),
                      colonia: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.colonia),
                      alcaldia: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.alcaldia),
                      entidad: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.entidad),
                      pais:
                        normalizarTexto((actividad.domicilio as Record<string, unknown>)?.pais) ||
                        createDefaultDomicilio().pais,
                    },
                  }))
                : [createDefaultActividad()],
              representante:
                item.representante && typeof item.representante === "object"
                  ? {
                      ...createDefaultRepresentante(),
                      nombre: normalizarTexto((item.representante as Record<string, unknown>).nombre),
                      apellidoPaterno: normalizarTexto((item.representante as Record<string, unknown>).apellidoPaterno),
                      apellidoMaterno: normalizarTexto((item.representante as Record<string, unknown>).apellidoMaterno),
                      fechaNacimiento: normalizarTexto((item.representante as Record<string, unknown>).fechaNacimiento),
                      rfc: normalizarTexto((item.representante as Record<string, unknown>).rfc),
                      curp: normalizarTexto((item.representante as Record<string, unknown>).curp),
                      paisNacionalidad: normalizarTexto(
                        (item.representante as Record<string, unknown>).paisNacionalidad,
                      ),
                      fechaDesignacion: normalizarTexto(
                        (item.representante as Record<string, unknown>).fechaDesignacion,
                      ),
                      fechaAceptacion: normalizarTexto(
                        (item.representante as Record<string, unknown>).fechaAceptacion,
                      ),
                      contacto: {
                        claveLada: normalizarTexto(
                          ((item.representante as Record<string, unknown>).contacto as Record<string, unknown>)?.claveLada,
                        ),
                        telefonoFijo: normalizarTexto(
                          ((item.representante as Record<string, unknown>).contacto as Record<string, unknown>)
                            ?.telefonoFijo,
                        ),
                        extension: normalizarTexto(
                          ((item.representante as Record<string, unknown>).contacto as Record<string, unknown>)?.extension,
                        ),
                        telefonoMovil: normalizarTexto(
                          ((item.representante as Record<string, unknown>).contacto as Record<string, unknown>)
                            ?.telefonoMovil,
                        ),
                        correo: normalizarTexto(
                          ((item.representante as Record<string, unknown>).contacto as Record<string, unknown>)?.correo,
                        ),
                      },
                      certificacion: {
                        respuesta: normalizarTexto(
                          ((item.representante as Record<string, unknown>).certificacion as Record<string, unknown>)
                            ?.respuesta,
                        ) as "" | "si" | "no",
                        tipoDocumento: normalizarTexto(
                          ((item.representante as Record<string, unknown>).certificacion as Record<string, unknown>)
                            ?.tipoDocumento,
                        ),
                        autoridadDocumento: normalizarTexto(
                          ((item.representante as Record<string, unknown>).certificacion as Record<string, unknown>)
                            ?.autoridadDocumento,
                        ),
                        folioDocumento: normalizarTexto(
                          ((item.representante as Record<string, unknown>).certificacion as Record<string, unknown>)
                            ?.folioDocumento,
                        ),
                        periodoDocumento: normalizarTexto(
                          ((item.representante as Record<string, unknown>).certificacion as Record<string, unknown>)
                            ?.periodoDocumento,
                        ),
                      },
                    }
                  : null,
            }
          })
        : []

      const documentosRegistroGuardados =
        data.documentosRegistro && typeof data.documentosRegistro === "object"
          ? (Object.entries(data.documentosRegistro) as [RegistroDocumentKey, Partial<DocumentUpload>][]).reduce<
              Record<RegistroDocumentKey, DocumentUpload | null>
            >((acc, [key, value]) => {
              acc[key] = value
                ? {
                    id: value.id ?? crypto.randomUUID(),
                    name: value.name ?? "",
                    type: value.type ?? key,
                    uploadDate: value.uploadDate ? new Date(value.uploadDate as unknown as string) : new Date(),
                    dataUrl: typeof value.dataUrl === "string" ? value.dataUrl : "",
                    mimeType: value.mimeType ?? "application/octet-stream",
                    size: typeof value.size === "number" ? value.size : 0,
                  }
                : null
              return acc
            }, { detalle: null, acuse: null, aceptacion: null })
          : { detalle: null, acuse: null, aceptacion: null }

      const identificacionRaw = (data.identificacion ?? {}) as Record<string, unknown>
      const identificacionCargada: IdentificacionSujeto = {
        fecha: normalizarTexto(identificacionRaw.fecha),
        rfc: normalizarTexto(identificacionRaw.rfc),
        nombre: normalizarTexto(identificacionRaw.nombre),
        apellidoPaterno: normalizarTexto(identificacionRaw.apellidoPaterno),
        paisNacionalidad: normalizarTexto(identificacionRaw.paisNacionalidad),
        paisNacimiento: normalizarTexto(identificacionRaw.paisNacimiento),
        curp: normalizarTexto(identificacionRaw.curp),
      }

      const contactosCargados = Array.isArray(data.contactos)
        ? data.contactos.map((contacto: Record<string, unknown>) => ({
            nombreCompleto: normalizarTexto(contacto.nombreCompleto),
            claveLada: normalizarTexto(contacto.claveLada),
            telefonoFijo: normalizarTexto(contacto.telefonoFijo),
            extension: normalizarTexto(contacto.extension),
            telefonoMovil: normalizarTexto(contacto.telefonoMovil),
            correo: normalizarTexto(contacto.correo),
          }))
        : []

      const contactosNormalizados = Array.from({ length: 3 }, (_, index) =>
        contactosCargados[index] ? { ...createDefaultContacto(), ...contactosCargados[index] } : createDefaultContacto(),
      )

      const actividadesCargadas = Array.isArray(data.actividades)
        ? data.actividades.map((actividad: Record<string, unknown>) => ({
            actividadKey: normalizarTexto(actividad.actividadKey),
            fechaPrimera: normalizarTexto(actividad.fechaPrimera),
            cuentaRegistro: normalizarTexto(actividad.cuentaRegistro) as "" | "si" | "no",
            tipoDocumento: normalizarTexto(actividad.tipoDocumento),
            autoridadDocumento: normalizarTexto(actividad.autoridadDocumento),
            folioDocumento: normalizarTexto(actividad.folioDocumento),
            periodoDocumento: normalizarTexto(actividad.periodoDocumento),
            domicilio: {
              codigoPostal: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.codigoPostal),
              tipoVialidad: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.tipoVialidad),
              nombreVialidad: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.nombreVialidad),
              numeroExterior: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.numeroExterior),
              numeroInterior: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.numeroInterior),
              colonia: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.colonia),
              alcaldia: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.alcaldia),
              entidad: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.entidad),
              pais:
                normalizarTexto((actividad.domicilio as Record<string, unknown>)?.pais) ||
                createDefaultDomicilio().pais,
            },
          }))
        : []

      const actividadesNormalizadas =
        actividadesCargadas.length > 0
          ? actividadesCargadas.map((actividad) => ({ ...createDefaultActividad(), ...actividad }))
          : [createDefaultActividad()]

      const representanteRaw = (data.representante ?? {}) as Record<string, unknown>
      const representanteCargado: RepresentanteCumplimiento = {
        ...createDefaultRepresentante(),
        nombre: normalizarTexto(representanteRaw.nombre),
        apellidoPaterno: normalizarTexto(representanteRaw.apellidoPaterno),
        apellidoMaterno: normalizarTexto(representanteRaw.apellidoMaterno),
        fechaNacimiento: normalizarTexto(representanteRaw.fechaNacimiento),
        rfc: normalizarTexto(representanteRaw.rfc),
        curp: normalizarTexto(representanteRaw.curp),
        paisNacionalidad: normalizarTexto(representanteRaw.paisNacionalidad),
        fechaDesignacion: normalizarTexto(representanteRaw.fechaDesignacion),
        fechaAceptacion: normalizarTexto(representanteRaw.fechaAceptacion),
        contacto: {
          claveLada: normalizarTexto((representanteRaw.contacto as Record<string, unknown>)?.claveLada),
          telefonoFijo: normalizarTexto((representanteRaw.contacto as Record<string, unknown>)?.telefonoFijo),
          extension: normalizarTexto((representanteRaw.contacto as Record<string, unknown>)?.extension),
          telefonoMovil: normalizarTexto((representanteRaw.contacto as Record<string, unknown>)?.telefonoMovil),
          correo: normalizarTexto((representanteRaw.contacto as Record<string, unknown>)?.correo),
        },
        certificacion: {
          respuesta: normalizarTexto((representanteRaw.certificacion as Record<string, unknown>)?.respuesta) as
            | ""
            | "si"
            | "no",
          tipoDocumento: normalizarTexto((representanteRaw.certificacion as Record<string, unknown>)?.tipoDocumento),
          autoridadDocumento: normalizarTexto((representanteRaw.certificacion as Record<string, unknown>)?.autoridadDocumento),
          folioDocumento: normalizarTexto((representanteRaw.certificacion as Record<string, unknown>)?.folioDocumento),
          periodoDocumento: normalizarTexto((representanteRaw.certificacion as Record<string, unknown>)?.periodoDocumento),
        },
      }

      setDocumentos(documentosGuardados as DocumentUpload[])
      setDatosChecklistState(checklist)
      setSujetosRegistrados(sujetosCargados as SujetoRegistrado[])
      setSujetoSeleccionadoId(sujetosCargados[0]?.id ?? null)
      setTipoSujeto((data.tipoSujeto as SubjectType) ?? "none")
      setIdentificacion(identificacionCargada)
      setContactos(contactosNormalizados)
      setActividades(actividadesNormalizadas)
      setRepresentante(representanteCargado)
      setDocumentosRegistro(documentosRegistroGuardados)
    } catch (error) {
      console.error("Error al cargar datos de registro SAT", error)
    }
  }, [])

  useEffect(() => {
    const data = {
      documentos,
      datosChecklist: datosChecklistState,
      sujetosRegistrados,
      tipoSujeto,
      identificacion,
      contactos,
      actividades,
      representante,
      documentosRegistro,
    }
    localStorage.setItem("registro-sat-data", JSON.stringify(data))
  }, [
    documentos,
    datosChecklistState,
    sujetosRegistrados,
    tipoSujeto,
    identificacion,
    contactos,
    actividades,
    representante,
    documentosRegistro,
  ])

  const crearDocumentoDesdeArchivo = async (file: File, tipo: string): Promise<DocumentUpload> => {
    const dataUrl = await readFileAsDataUrl(file)
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      name: file.name,
      type: tipo,
      uploadDate: new Date(),
      dataUrl,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    }
  }

  const obtenerTextoDocumentoRegistro = async (file: File) => {
    const esPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    if (!esPdf) {
      return file.text()
    }

    const pdfjsModule = await import("pdfjs-dist")
    const pdfjs = "default" in pdfjsModule ? pdfjsModule.default : pdfjsModule
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc =
        "https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs"
    }
    const buffer = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: buffer, disableWorker: true }).promise
    let textoCompleto = ""

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const content = await page.getTextContent()
      const items = content.items as Array<{ str?: string }>
      const pageText = items.map((item) => item.str ?? "").join(" ")
      textoCompleto += ` ${pageText}`
    }

    return textoCompleto
  }


  const actualizarEstatusDatoChecklist = (id: string, completed: boolean) => {
    setDatosChecklistState((prev) => ({
      ...prev,
      [id]: {
        completed,
        notes: prev[id]?.notes ?? "",
      },
    }))
  }

  const actualizarNotasDatoChecklist = (id: string, notas: string) => {
    setDatosChecklistState((prev) => ({
      ...prev,
      [id]: {
        completed: prev[id]?.completed ?? false,
        notes: notas,
      },
    }))
  }

  const obtenerChecklistDesdeCamposConfirmados = (
    camposConfirmados: string[],
    tipo: SubjectType,
  ): DatosChecklistState => {
    const checklist = createDefaultDatosChecklistState()

    datosAltaRegistro
      .filter((section) => section.appliesTo.includes(tipo))
      .flatMap((section) => section.fields)
      .forEach((field) => {
        if (camposConfirmados.includes(field.label)) {
          checklist[field.id] = {
            completed: true,
            notes: checklist[field.id]?.notes ?? "",
          }
        }
      })

    return checklist
  }

  const camposObligatoriosCapturados = Boolean(
    tipoSujeto !== "none" && nombreSujeto.trim() && resumenActividades.trim(),
  )
  const documentosRequeridosCompletos =
    !!documentosRegistro.detalle && !!documentosRegistro.acuse && !!documentosRegistro.aceptacion

  const limpiarFormulario = () => {
    setTipoSujeto("none")
    setIdentificacion(createDefaultIdentificacion())
    setContactos(Array.from({ length: 3 }, () => createDefaultContacto()))
    setActividades([createDefaultActividad()])
    setRepresentante(createDefaultRepresentante())
    setDocumentosRegistro({ detalle: null, acuse: null, aceptacion: null })
    setDatosChecklistState(createDefaultDatosChecklistState())
    setSujetoEnEdicionId(null)
    setEjemploSeleccionado("")
  }

  const completarContactos = (contactosEjemplo: ContactoSujeto[]) =>
    Array.from({ length: 3 }, (_, index) =>
      contactosEjemplo[index] ? { ...createDefaultContacto(), ...contactosEjemplo[index] } : createDefaultContacto(),
    )

  const cargarEjemploSujeto = (ejemplo: EjemploSujetoObligado) => {
    setTipoSujeto(ejemplo.tipo)
    setIdentificacion({ ...createDefaultIdentificacion(), ...ejemplo.identificacion })
    setContactos(completarContactos(ejemplo.contactos))
    setActividades(
      ejemplo.actividades.length > 0
        ? ejemplo.actividades.map((actividad) => ({ ...createDefaultActividad(), ...actividad }))
        : [createDefaultActividad()],
    )
    setRepresentante(
      ejemplo.tipo === "moral" || ejemplo.tipo === "fideicomiso"
        ? ({ ...createDefaultRepresentante(), ...(ejemplo.representante ?? {}) } as RepresentanteCumplimiento)
        : createDefaultRepresentante(),
    )
    setDocumentosRegistro({ detalle: null, acuse: null, aceptacion: null })
    setDatosChecklistState(createDefaultDatosChecklistState())
    setSujetoEnEdicionId(null)
    setEjemploSeleccionado(ejemplo.id)

    toast({
      title: "Ejemplo cargado",
      description: "Se completaron los datos del formulario con un sujeto obligado de ejemplo.",
    })
  }

  const manejarCargarEjemplo = () => {
    const ejemplo = ejemplosSujetosObligados.find((item) => item.id === ejemploSeleccionado)
    if (!ejemplo) return
    cargarEjemploSujeto(ejemplo)
  }

  const registrarSujeto = (
    docs: Record<RegistroDocumentKey, DocumentUpload | null>,
    opciones?: { permitirIncompleto?: boolean },
  ) => {
    if (tipoSujeto === "none" || !nombreSujeto.trim() || !resumenActividades.trim()) return false

    const registroCompleto = !!(docs.detalle && docs.acuse && docs.aceptacion)
    if (!registroCompleto && !opciones?.permitirIncompleto) return false

    const camposChecklist = datosAltaRegistro
      .filter((section) => section.appliesTo.includes(tipoSujeto))
      .flatMap((section) => section.fields)
      .filter((field) => datosChecklistState[field.id]?.completed)
      .map((field) => field.label)

    const sujetoExistente = sujetosRegistrados.find((item) => item.id === sujetoEnEdicionId)
    const nuevoSujeto: SujetoRegistrado = {
      id: sujetoExistente?.id ?? (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
      nombre: nombreSujeto.trim(),
      tipo: tipoSujeto,
      actividad: resumenActividades.trim(),
      creadoEn: sujetoExistente?.creadoEn ?? new Date(),
      checklistCampos: camposChecklist,
      documentos: {
        detalle: docs.detalle,
        acuse: docs.acuse,
        aceptacion: docs.aceptacion,
      },
      registroCompleto,
      identificacion,
      contactos,
      actividades,
      representante: tipoSujeto === "moral" || tipoSujeto === "fideicomiso" ? representante : null,
    }

    setSujetosRegistrados((prev) => {
      const existenteIndex = sujetoExistente
        ? prev.findIndex((item) => item.id === sujetoExistente.id)
        : prev.findIndex((item) => item.nombre === nuevoSujeto.nombre && item.tipo === tipoSujeto)
      if (existenteIndex >= 0) {
        const copia = [...prev]
        copia[existenteIndex] = nuevoSujeto
        return copia
      }
      return [nuevoSujeto, ...prev]
    })
    setSujetoSeleccionadoId(nuevoSujeto.id)
    setDocumentosRegistro({ detalle: null, acuse: null, aceptacion: null })
    setSujetoEnEdicionId(null)

    toast({
      title: sujetoExistente
        ? "Sujeto obligado actualizado"
        : registroCompleto
          ? "Sujeto obligado registrado"
          : "Registro guardado incompleto",
      description: sujetoExistente
        ? "Los datos y documentos del sujeto se guardaron con los cambios realizados."
        : registroCompleto
          ? "Los documentos de detalle, acuse y aceptación registraron al sujeto automáticamente."
          : "Los documentos obligatorios están pendientes. Completa el expediente para finalizar el alta.",
    })
    return registroCompleto
  }

  const registrarSujetoManual = () => {
    if (!camposObligatoriosCapturados) {
      toast({
        title: "Faltan datos clave",
        description: "Selecciona el tipo de sujeto, completa la identificación y agrega al menos una actividad vulnerable.",
        variant: "destructive",
      })
      return
    }

    registrarSujeto(documentosRegistro, { permitirIncompleto: true })
    setActiveTab("registrados")

    limpiarFormulario()
  }

  const manejarCargaDocumentoRegistro = async (
    event: ChangeEvent<HTMLInputElement>,
    tipoDoc: RegistroDocumentKey,
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      let datosExtraidos: ReturnType<typeof extraerDatosRegistroDesdeTexto> | null = null
      try {
        const texto = await obtenerTextoDocumentoRegistro(file)
        if (texto.trim()) {
          const candidato = extraerDatosRegistroDesdeTexto(texto)
          const hayDatosExtraidos = Boolean(
            candidato.tipoSujeto ||
              candidato.identificacion?.nombre ||
              candidato.identificacion?.rfc ||
              candidato.contactos?.length ||
              candidato.actividad?.actividadKey ||
              candidato.domicilio?.codigoPostal ||
              candidato.representante?.rfc,
          )
          datosExtraidos = hayDatosExtraidos ? candidato : null
          if (datosExtraidos) {
            aplicarDatosExtraidos(datosExtraidos)
          } else {
            toast({
              title: "No se detectaron campos automáticamente",
              description:
                "Se cargó el documento, pero el formato no coincidió. Puedes completar los datos manualmente.",
            })
          }
        } else {
          toast({
            title: "Documento sin texto detectable",
            description:
              "No se pudo leer contenido en el PDF. Si es un escaneo, intenta con el XML o captura manualmente.",
          })
        }
      } catch (error) {
        console.error("No se pudo extraer texto del documento", error)
        toast({
          title: "No se pudo leer el documento",
          description:
            "El PDF puede estar escaneado o sin texto seleccionable. Considera cargar el XML o capturar manualmente.",
          variant: "destructive",
        })
      }

      const documento = await crearDocumentoDesdeArchivo(file, tipoDoc)
      setDocumentos((prev) => [documento, ...prev])
      setDocumentosRegistro((prev) => {
        const actualizado = { ...prev, [tipoDoc]: documento }
        registrarSujeto(actualizado)
        return actualizado
      })

      toast({
        title: `Documento ${tipoDoc === "detalle" ? "detalle" : tipoDoc} cargado`,
        description: `${file.name} se agregó a la carpeta de alta y registro.${
          datosExtraidos ? " Se extrajeron datos automáticamente." : ""
        }`,
      })
    } catch (error) {
      console.error("Error al guardar archivo", error)
      toast({
        title: "No se pudo cargar el archivo",
        description: "Verifica el formato y vuelve a intentarlo.",
        variant: "destructive",
      })
    } finally {
      event.target.value = ""
    }
  }

  const iniciarEdicionSujeto = () => {
    if (!sujetoSeleccionado) return

    setTipoSujeto(sujetoSeleccionado.tipo)
    setIdentificacion(sujetoSeleccionado.identificacion ?? createDefaultIdentificacion())
    setContactos(
      sujetoSeleccionado.contactos?.length
        ? sujetoSeleccionado.contactos
        : Array.from({ length: 3 }, () => createDefaultContacto()),
    )
    setActividades(
      sujetoSeleccionado.actividades?.length ? sujetoSeleccionado.actividades : [createDefaultActividad()],
    )
    setRepresentante(sujetoSeleccionado.representante ?? createDefaultRepresentante())
    setDocumentosRegistro(sujetoSeleccionado.documentos)
    setDatosChecklistState(
      obtenerChecklistDesdeCamposConfirmados(sujetoSeleccionado.checklistCampos, sujetoSeleccionado.tipo),
    )
    setSujetoEnEdicionId(sujetoSeleccionado.id)
    setActiveTab("nuevo")

    toast({
      title: "Edición en curso",
      description: "Actualiza los datos y vuelve a guardar para mantener los cambios.",
    })
  }

  const iniciarNuevoRegistro = () => {
    limpiarFormulario()
    setActiveTab("nuevo")
  }

  const cancelarEdicion = () => {
    setSujetoEnEdicionId(null)
    limpiarFormulario()
  }

  const eliminarSujetoSeleccionado = () => {
    if (!sujetoSeleccionado) return

    const confirmar = window.confirm(
      "¿Deseas eliminar este sujeto obligado? Esta acción no se puede deshacer.",
    )
    if (!confirmar) return

    const idEliminar = sujetoSeleccionado.id

    setSujetosRegistrados((prev) => {
      const actualizados = prev.filter((item) => item.id !== idEliminar)
      const siguienteSeleccion = actualizados[0]?.id ?? null
      setSujetoSeleccionadoId((seleccionActual) => {
        if (seleccionActual && seleccionActual !== idEliminar) return seleccionActual
        return siguienteSeleccion
      })
      return actualizados
    })

    if (sujetoEnEdicionId === idEliminar) {
      cancelarEdicion()
    }

    toast({
      title: "Sujeto eliminado",
      description: "El registro se eliminó de la lista de sujetos obligados.",
    })
  }

  const manejarCargaDocumento = async (event: ChangeEvent<HTMLInputElement>, tipo: string) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const documento = await crearDocumentoDesdeArchivo(file, tipo)
      setDocumentos((prev) => [documento, ...prev])
      toast({
        title: "Documento cargado",
        description: `El documento ${documento.name} se almacenó como evidencia opcional.`,
      })
    } catch (error) {
      console.error("Error al guardar archivo", error)
      toast({
        title: "No se pudo cargar el archivo",
        description: "Verifica el formato y vuelve a intentarlo.",
        variant: "destructive",
      })
    } finally {
      event.target.value = ""
    }
  }

  const hydrateCodigoPostalInfo = useCallback(
    async (index: number, codigo: string) => {
      if (typeof window === "undefined") return
      const limpio = codigo.trim().replace(/[^0-9]/g, "")
      if (limpio.length !== 5) return

      const cacheKey = `${SEPOMEX_STORAGE_PREFIX}${limpio}`
      let info: CodigoPostalInfo | undefined
      const cacheRaw = window.localStorage.getItem(cacheKey)
      if (cacheRaw) {
        try {
          info = JSON.parse(cacheRaw) as CodigoPostalInfo
        } catch {
          window.localStorage.removeItem(cacheKey)
        }
      }

      if (!info) {
        info = await fetchCodigoPostalInfo(limpio)
        if (info) {
          window.localStorage.setItem(cacheKey, JSON.stringify(info))
        }
      }

      if (!info) return
      registerCodigoPostalInfo(info)

      setActividades((prev) =>
        prev.map((actividad, idx) => {
          if (idx !== index) return actividad
          if (actividad.domicilio.codigoPostal !== limpio) return actividad
          const colonias = info.asentamientos ?? []
          return {
            ...actividad,
            domicilio: {
              ...actividad.domicilio,
              pais: "México",
              entidad: info.estado ?? "",
              alcaldia: info.municipio ?? "",
              colonia:
                colonias.length > 0
                  ? colonias.includes(actividad.domicilio.colonia)
                    ? actividad.domicilio.colonia
                    : colonias[0]
                  : actividad.domicilio.colonia,
            },
          }
        }),
      )
    },
    [setActividades],
  )

  const handleCodigoPostalChange = useCallback(
    (index: number, value: string) => {
      const limpio = value.replace(/[^0-9]/g, "").slice(0, 5)
      setActividades((prev) =>
        prev.map((actividad, idx) => {
          if (idx !== index) return actividad

          if (limpio.length !== 5) {
            return {
              ...actividad,
              domicilio: {
                ...actividad.domicilio,
                codigoPostal: limpio,
                pais: "México",
                entidad: "",
                alcaldia: "",
              },
            }
          }

          const info = findCodigoPostalInfo(limpio)
          const colonias = info?.asentamientos ?? []

          return {
            ...actividad,
            domicilio: {
              ...actividad.domicilio,
              codigoPostal: limpio,
              pais: "México",
              entidad: info?.estado ?? "",
              alcaldia: info?.municipio ?? "",
              colonia:
                colonias.length > 0
                  ? colonias.includes(actividad.domicilio.colonia)
                    ? actividad.domicilio.colonia
                    : colonias[0]
                  : actividad.domicilio.colonia,
            },
          }
        }),
      )

      if (limpio.length === 5 && !findCodigoPostalInfo(limpio)) {
        void hydrateCodigoPostalInfo(index, limpio)
      }
    },
    [hydrateCodigoPostalInfo],
  )

  const aplicarDatosExtraidos = useCallback(
    (datos: ReturnType<typeof extraerDatosRegistroDesdeTexto>) => {
      if (!datos) return
      if (datos.tipoSujeto && (tipoSujeto === "none" || tipoSujeto === datos.tipoSujeto)) {
        setTipoSujeto(datos.tipoSujeto)
      }

      if (datos.identificacion) {
        setIdentificacion((prev) => ({
          ...prev,
          nombre: prev.nombre.trim() ? prev.nombre : datos.identificacion?.nombre ?? "",
          rfc: prev.rfc.trim() ? prev.rfc : datos.identificacion?.rfc ?? "",
          fecha: prev.fecha.trim() ? prev.fecha : datos.identificacion?.fecha ?? "",
          paisNacionalidad: prev.paisNacionalidad.trim()
            ? prev.paisNacionalidad
            : datos.identificacion?.paisNacionalidad ?? "",
        }))
      }

      if (datos.contactos && datos.contactos.length > 0) {
        setContactos((prev) =>
          prev.map((contacto, index) => {
            const extraido = datos.contactos?.[index]
            if (!extraido) return contacto
            return {
              ...contacto,
              claveLada: contacto.claveLada.trim() ? contacto.claveLada : extraido.claveLada,
              telefonoFijo: contacto.telefonoFijo.trim() ? contacto.telefonoFijo : extraido.telefonoFijo,
              telefonoMovil: contacto.telefonoMovil.trim() ? contacto.telefonoMovil : extraido.telefonoMovil,
              correo: contacto.correo.trim() ? contacto.correo : extraido.correo,
            }
          }),
        )
      }

      if (datos.actividad || datos.domicilio) {
        setActividades((prev) => {
          const actuales = prev.length > 0 ? [...prev] : [createDefaultActividad()]
          const primera = actuales[0] ?? createDefaultActividad()
          actuales[0] = {
            ...primera,
            actividadKey: primera.actividadKey.trim()
              ? primera.actividadKey
              : datos.actividad?.actividadKey ?? "",
            fechaPrimera: primera.fechaPrimera.trim()
              ? primera.fechaPrimera
              : datos.actividad?.fechaPrimera ?? "",
            domicilio: {
              ...primera.domicilio,
              codigoPostal: primera.domicilio.codigoPostal.trim()
                ? primera.domicilio.codigoPostal
                : datos.domicilio?.codigoPostal ?? "",
              tipoVialidad: primera.domicilio.tipoVialidad.trim()
                ? primera.domicilio.tipoVialidad
                : datos.domicilio?.tipoVialidad ?? "",
              nombreVialidad: primera.domicilio.nombreVialidad.trim()
                ? primera.domicilio.nombreVialidad
                : datos.domicilio?.nombreVialidad ?? "",
              numeroExterior: primera.domicilio.numeroExterior.trim()
                ? primera.domicilio.numeroExterior
                : datos.domicilio?.numeroExterior ?? "",
              numeroInterior: primera.domicilio.numeroInterior.trim()
                ? primera.domicilio.numeroInterior
                : datos.domicilio?.numeroInterior ?? "",
              colonia: primera.domicilio.colonia.trim()
                ? primera.domicilio.colonia
                : datos.domicilio?.colonia ?? "",
              alcaldia: primera.domicilio.alcaldia.trim()
                ? primera.domicilio.alcaldia
                : datos.domicilio?.alcaldia ?? "",
              entidad: primera.domicilio.entidad.trim()
                ? primera.domicilio.entidad
                : datos.domicilio?.entidad ?? "",
              pais: primera.domicilio.pais.trim() ? primera.domicilio.pais : datos.domicilio?.pais ?? "",
            },
          }
          return actuales
        })

        if (datos.domicilio?.codigoPostal) {
          handleCodigoPostalChange(0, datos.domicilio.codigoPostal)
          hydrateCodigoPostalInfo(0, datos.domicilio.codigoPostal)
        }
      }

      const tipoAplicable = datos.tipoSujeto ?? tipoSujeto
      if (datos.representante && (tipoAplicable === "moral" || tipoAplicable === "fideicomiso")) {
        setRepresentante((prev) => ({
          ...prev,
          nombre: prev.nombre.trim() ? prev.nombre : datos.representante?.nombre ?? "",
          apellidoPaterno: prev.apellidoPaterno.trim()
            ? prev.apellidoPaterno
            : datos.representante?.apellidoPaterno ?? "",
          apellidoMaterno: prev.apellidoMaterno.trim()
            ? prev.apellidoMaterno
            : datos.representante?.apellidoMaterno ?? "",
          fechaNacimiento: prev.fechaNacimiento.trim()
            ? prev.fechaNacimiento
            : datos.representante?.fechaNacimiento ?? "",
          rfc: prev.rfc.trim() ? prev.rfc : datos.representante?.rfc ?? "",
          curp: prev.curp.trim() ? prev.curp : datos.representante?.curp ?? "",
          paisNacionalidad: prev.paisNacionalidad.trim()
            ? prev.paisNacionalidad
            : datos.representante?.paisNacionalidad ?? "",
          fechaDesignacion: prev.fechaDesignacion.trim()
            ? prev.fechaDesignacion
            : datos.representante?.fechaDesignacion ?? "",
          fechaAceptacion: prev.fechaAceptacion.trim()
            ? prev.fechaAceptacion
            : datos.representante?.fechaAceptacion ?? "",
          contacto: {
            ...prev.contacto,
            claveLada: prev.contacto.claveLada.trim()
              ? prev.contacto.claveLada
              : datos.representante?.contacto?.claveLada ?? "",
            telefonoFijo: prev.contacto.telefonoFijo.trim()
              ? prev.contacto.telefonoFijo
              : datos.representante?.contacto?.telefonoFijo ?? "",
            telefonoMovil: prev.contacto.telefonoMovil.trim()
              ? prev.contacto.telefonoMovil
              : datos.representante?.contacto?.telefonoMovil ?? "",
            correo: prev.contacto.correo.trim()
              ? prev.contacto.correo
              : datos.representante?.contacto?.correo ?? "",
          },
        }))
      }
    },
    [
      handleCodigoPostalChange,
      hydrateCodigoPostalInfo,
      setActividades,
      setContactos,
      setIdentificacion,
      setTipoSujeto,
      setRepresentante,
      tipoSujeto,
    ],
  )

  const agregarActividad = () => {
    setActividades((prev) => {
      if (prev.length >= 5) return prev
      return [...prev, createDefaultActividad()]
    })
  }

  const eliminarActividad = (index: number) => {
    setActividades((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((_, idx) => idx !== index)
    })
  }

  const actualizarIdentificacionCampo = (campo: keyof IdentificacionSujeto, valor: string) => {
    setIdentificacion((prev) => ({ ...prev, [campo]: valor }))
  }

  const actualizarContactoCampo = (index: number, campo: keyof ContactoSujeto, valor: string) => {
    setContactos((prev) =>
      prev.map((contacto, idx) => (idx === index ? { ...contacto, [campo]: valor } : contacto)),
    )
  }

  const actualizarActividadCampo = (index: number, campo: keyof ActividadSujeto, valor: string) => {
    setActividades((prev) =>
      prev.map((actividad, idx) => (idx === index ? { ...actividad, [campo]: valor } : actividad)),
    )
  }

  const actualizarDomicilioActividadCampo = (index: number, campo: keyof DomicilioActividad, valor: string) => {
    setActividades((prev) =>
      prev.map((actividad, idx) =>
        idx === index ? { ...actividad, domicilio: { ...actividad.domicilio, [campo]: valor } } : actividad,
      ),
    )
  }

  const actualizarRepresentanteCampo = (campo: keyof RepresentanteCumplimiento, valor: string) => {
    setRepresentante((prev) => ({ ...prev, [campo]: valor }))
  }

  const actualizarRepresentanteContactoCampo = (
    campo: keyof RepresentanteCumplimiento["contacto"],
    valor: string,
  ) => {
    setRepresentante((prev) => ({ ...prev, contacto: { ...prev.contacto, [campo]: valor } }))
  }

  const actualizarRepresentanteCertificacionCampo = (
    campo: keyof RepresentanteCumplimiento["certificacion"],
    valor: string,
  ) => {
    setRepresentante((prev) => ({ ...prev, certificacion: { ...prev.certificacion, [campo]: valor } }))
  }

  const sujetoSeleccionado = sujetosRegistrados.find((item) => item.id === sujetoSeleccionadoId)
  const documentosCompletados = (Object.values(documentosRegistro).filter(Boolean) as DocumentUpload[]).length
  const enEdicion = Boolean(sujetoEnEdicionId)

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Alta y Registro ante el SAT</h1>
              <p className="text-muted-foreground">
                Gestiona sujetos obligados, carga automática de detalle, acuse y aceptación, y checklist guiado por anexos.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Sesión guardada en este navegador
            </Badge>
            <Badge variant="secondary">Registro ágil y responsivo</Badge>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="sm:col-span-2 xl:col-span-1">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Sujetos obligados registrados</p>
              <p className="text-3xl font-bold">{sujetosRegistrados.length}</p>
              <p className="text-xs text-muted-foreground">Cada carga con detalle, acuse y aceptación crea un registro.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 pt-6">
              <p className="text-sm text-muted-foreground">Avance del checklist</p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-3xl font-bold">{datosChecklistResumen.progreso}%</p>
                <Progress value={datosChecklistResumen.progreso} className="h-2 flex-1" />
              </div>
              <p className="text-xs text-muted-foreground">
                {datosChecklistResumen.completados} de {datosChecklistResumen.total} datos listos
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 pt-6">
              <p className="text-sm text-muted-foreground">Documentos del alta cargados</p>
              <p className="text-3xl font-bold">{documentosCompletados} / 3</p>
              <p className="text-xs text-muted-foreground">Detalle, acuse y aceptación de designación.</p>
            </CardContent>
          </Card>
          <Card className="sm:col-span-2 xl:col-span-1">
            <CardContent className="space-y-2 pt-6">
              <p className="text-sm font-semibold">Guía rápida</p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                <li>Selecciona el tipo de sujeto y completa la identificación.</li>
                <li>Adjunta detalle, acuse y aceptación (botones abajo).</li>
                <li>Usa el botón Registrar sujeto para confirmar.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="registrados" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Sujetos registrados
          </TabsTrigger>
          <TabsTrigger value="nuevo" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Registrar nuevo sujeto obligado
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registrados" className="space-y-4">
          <Card>
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Sujetos obligados registrados
                  </CardTitle>
                  <CardDescription>
                    Selecciona un registro para ver la información cargada y confirmar si el expediente está completo.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={iniciarNuevoRegistro}>
                  Registrar nuevo sujeto obligado
                </Button>
              </div>
              {sujetosRegistrados.length === 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                  <span>No hay registros aún.</span>
                  <Button size="sm" onClick={iniciarNuevoRegistro}>
                    Comenzar un registro
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-1">
                {sujetosRegistrados.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Aún no hay sujetos obligados registrados. Ingresa los datos iniciales y agrega documentos cuando los tengas.
                  </p>
                ) : (
                  <ScrollArea className="h-[320px] pr-4">
                    <div className="space-y-2">
                      {sujetosRegistrados.map((sujeto) => (
                        <button
                          key={sujeto.id}
                          onClick={() => setSujetoSeleccionadoId(sujeto.id)}
                          className={cn(
                            "w-full rounded-lg border p-3 text-left transition hover:border-primary",
                            sujetoSeleccionadoId === sujeto.id ? "border-primary bg-primary/5" : "border-muted",
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="font-semibold">{sujeto.nombre}</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs text-muted-foreground capitalize">{sujeto.tipo}</p>
                                <Badge variant={sujeto.registroCompleto ? "secondary" : "destructive"}>
                                  {sujeto.registroCompleto ? "Completo" : "Incompleto"}
                                </Badge>
                              </div>
                            </div>
                            <Badge variant="outline">{sujeto.creadoEn.toLocaleDateString()}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{sujeto.actividad}</p>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              <div className="lg:col-span-2">
                {sujetoSeleccionado ? (
                    <div className="space-y-4 rounded-lg border p-4">
                      <div className="flex flex-wrap items-center gap-3 justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Sujeto obligado</p>
                          <p className="text-2xl font-semibold">{sujetoSeleccionado.nombre}</p>
                          <p className="text-sm text-muted-foreground capitalize">{sujetoSeleccionado.tipo}</p>
                        </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={sujetoSeleccionado.registroCompleto ? "secondary" : "destructive"}>
                          {sujetoSeleccionado.registroCompleto ? "Completo" : "Incompleto"}
                        </Badge>
                        <Badge variant="secondary">
                          Registrado {sujetoSeleccionado.creadoEn.toLocaleDateString()}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={iniciarEdicionSujeto}>
                          Editar
                        </Button>
                        <Button variant="destructive" size="sm" onClick={eliminarSujetoSeleccionado}>
                          Eliminar
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Actividad vulnerable registrada</p>
                      <p className="text-sm text-muted-foreground">{sujetoSeleccionado.actividad}</p>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-semibold">Documentos cargados</p>
                      <div className="grid gap-3 md:grid-cols-3">
                        {(Object.entries(sujetoSeleccionado.documentos) as [RegistroDocumentKey, DocumentUpload | null][]).map(
                          ([key, doc]) => (
                            <div key={key} className="rounded-lg border p-3 space-y-1">
                              <p className="text-xs text-muted-foreground uppercase">{key}</p>
                              {doc ? (
                                <>
                                  <p className="font-medium break-words">{doc.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {doc.uploadDate.toLocaleDateString()} · {(doc.size / 1024).toFixed(1)} KB
                                  </p>
                                </>
                              ) : (
                                <p className="text-sm text-muted-foreground">Pendiente de carga</p>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    </div>

                    {sujetoSeleccionado.checklistCampos.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">Datos confirmados del checklist</p>
                        <div className="flex flex-wrap gap-2">
                          {sujetoSeleccionado.checklistCampos.map((campo) => (
                            <Badge key={campo} variant="outline">
                              {campo}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border p-6 text-muted-foreground">
                    Selecciona un sujeto obligado para ver sus documentos y datos registrados.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nuevo" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle>Datos iniciales</CardTitle>
                <CardDescription>
                  Selecciona el tipo de sujeto obligado para habilitar los campos de identificación, contacto y actividades.
                </CardDescription>
              </div>
              {enEdicion && <Badge variant="outline">Editando sujeto</Badge>}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tipo-sujeto">Tipo de Sujeto Obligado</Label>
                  <Select value={tipoSujeto} onValueChange={(value) => setTipoSujeto(value as SubjectType)}>
                    <SelectTrigger id="tipo-sujeto">
                      <SelectValue placeholder="---" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {tiposSujetos.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  Si seleccionas "---", el resto del formulario no aplica. Al elegir un tipo se habilitan los datos de identificación,
                  contacto y actividades vulnerables requeridas.
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div className="space-y-2">
                  <Label htmlFor="ejemplo-sujeto">Cargar ejemplo de sujeto obligado</Label>
                  <Select value={ejemploSeleccionado} onValueChange={setEjemploSeleccionado}>
                    <SelectTrigger id="ejemplo-sujeto">
                      <SelectValue placeholder="Selecciona un ejemplo" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {ejemplosSujetosObligados.map((ejemplo) => (
                        <SelectItem key={ejemplo.id} value={ejemplo.id}>
                          {ejemplo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={manejarCargarEjemplo} disabled={!ejemploSeleccionado}>
                  Cargar ejemplo
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                El ejemplo reemplaza los datos actuales del formulario y es útil para pruebas rápidas.
              </p>
              {tipoSujeto === "none" && (
                <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Selecciona un tipo de sujeto obligado para habilitar el resto del formulario.
                </div>
              )}
            </CardContent>
          </Card>
          {tipoSujeto !== "none" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Datos de identificación del Sujeto Obligado</CardTitle>
                  <CardDescription>Captura la información principal del sujeto obligado según su tipo.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fecha-identificacion">{obtenerEtiquetaFecha(tipoSujeto)}</Label>
                    <Input
                      id="fecha-identificacion"
                      type="date"
                      value={identificacion.fecha}
                      onChange={(event) => actualizarIdentificacionCampo("fecha", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rfc-sujeto">Registro Federal de Contribuyentes (RFC)</Label>
                    <Input
                      id="rfc-sujeto"
                      value={identificacion.rfc}
                      onChange={(event) => actualizarIdentificacionCampo("rfc", event.target.value.toUpperCase())}
                      placeholder="RFC con homoclave"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nombre-sujeto">{obtenerEtiquetaNombre(tipoSujeto)}</Label>
                    <Input
                      id="nombre-sujeto"
                      value={identificacion.nombre}
                      onChange={(event) => actualizarIdentificacionCampo("nombre", event.target.value)}
                      placeholder="Captura el nombre o denominación"
                    />
                  </div>
                  {tipoSujeto === "fisica" && (
                    <div className="space-y-2">
                      <Label htmlFor="apellido-paterno">Apellido Paterno</Label>
                      <Input
                        id="apellido-paterno"
                        value={identificacion.apellidoPaterno}
                        onChange={(event) => actualizarIdentificacionCampo("apellidoPaterno", event.target.value)}
                        placeholder="Apellido paterno"
                      />
                    </div>
                  )}
                  {(tipoSujeto === "fisica" || tipoSujeto === "fideicomiso") && (
                    <div className="space-y-2">
                      <Label htmlFor="pais-nacionalidad">País de Nacionalidad</Label>
                      <Select
                        value={identificacion.paisNacionalidad}
                        onValueChange={(value) => actualizarIdentificacionCampo("paisNacionalidad", value)}
                      >
                        <SelectTrigger id="pais-nacionalidad">
                          <SelectValue placeholder="Selecciona un país" />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {PAISES.map((pais) => (
                            <SelectItem key={pais.code} value={pais.code}>
                              {pais.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {tipoSujeto === "fisica" && (
                    <div className="space-y-2">
                      <Label htmlFor="pais-nacimiento">País de Nacimiento</Label>
                      <Select
                        value={identificacion.paisNacimiento}
                        onValueChange={(value) => actualizarIdentificacionCampo("paisNacimiento", value)}
                      >
                        <SelectTrigger id="pais-nacimiento">
                          <SelectValue placeholder="Selecciona un país" />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {PAISES.map((pais) => (
                            <SelectItem key={pais.code} value={pais.code}>
                              {pais.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {tipoSujeto === "fisica" && (
                    <div className="space-y-2">
                      <Label htmlFor="curp-sujeto">Clave Única de Registro de Población (CURP)</Label>
                      <Input
                        id="curp-sujeto"
                        value={identificacion.curp}
                        onChange={(event) => actualizarIdentificacionCampo("curp", event.target.value.toUpperCase())}
                        placeholder="CURP"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Datos de contacto del Sujeto Obligado</CardTitle>
                  <CardDescription>Captura hasta tres personas de contacto con los mismos campos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {contactos.map((contacto, index) => (
                    <div key={`contacto-${index}`} className="space-y-4 rounded-lg border p-4">
                      <p className="text-sm font-semibold">Persona {index + 1}</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`contacto-nombre-${index}`}>Nombre completo de la persona contacto</Label>
                          <Input
                            id={`contacto-nombre-${index}`}
                            value={contacto.nombreCompleto}
                            onChange={(event) => actualizarContactoCampo(index, "nombreCompleto", event.target.value)}
                          />
                        </div>
                        <div className="grid gap-4 md:grid-cols-3 md:col-span-2">
                          <div className="space-y-2">
                            <Label htmlFor={`contacto-lada-${index}`}>Clave LADA</Label>
                            <Input
                              id={`contacto-lada-${index}`}
                              value={contacto.claveLada}
                              onChange={(event) => actualizarContactoCampo(index, "claveLada", event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`contacto-fijo-${index}`}>Número Telefónico Fijo</Label>
                            <Input
                              id={`contacto-fijo-${index}`}
                              value={contacto.telefonoFijo}
                              onChange={(event) => actualizarContactoCampo(index, "telefonoFijo", event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`contacto-ext-${index}`}>Extensión (en su caso)</Label>
                            <Input
                              id={`contacto-ext-${index}`}
                              value={contacto.extension}
                              onChange={(event) => actualizarContactoCampo(index, "extension", event.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`contacto-movil-${index}`}>Número Telefónico Móvil</Label>
                          <Input
                            id={`contacto-movil-${index}`}
                            value={contacto.telefonoMovil}
                            onChange={(event) => actualizarContactoCampo(index, "telefonoMovil", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`contacto-correo-${index}`}>Correo Electrónico</Label>
                          <Input
                            id={`contacto-correo-${index}`}
                            type="email"
                            value={contacto.correo}
                            onChange={(event) => actualizarContactoCampo(index, "correo", event.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <CardTitle>Actividad Vulnerable</CardTitle>
                      <CardDescription>
                        Añade actividades vulnerables con su domicilio nacional. Se permiten hasta 5.
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-start gap-2 md:items-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={agregarActividad}
                        disabled={actividades.length >= 5}
                      >
                        Añadir Actividad Vulnerable
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        {actividades.length} de 5 actividades registradas.
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {actividades.map((actividad, index) => {
                    const registroSi = actividad.cuentaRegistro === "si"
                    return (
                      <div key={`actividad-${index}`} className="space-y-4 rounded-lg border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold">Actividad Vulnerable ({index + 1})</p>
                          {actividades.length > 1 && (
                            <Button variant="ghost" size="sm" onClick={() => eliminarActividad(index)}>
                              Eliminar
                            </Button>
                          )}
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`actividad-clave-${index}`}>Actividad Vulnerable que pretende realizar</Label>
                            <Select
                              value={actividad.actividadKey}
                              onValueChange={(value) => actualizarActividadCampo(index, "actividadKey", value)}
                            >
                              <SelectTrigger id={`actividad-clave-${index}`}>
                                <SelectValue placeholder="Selecciona una actividad" />
                              </SelectTrigger>
                              <SelectContent position="popper">
                                {actividadesVulnerables.map((item) => (
                                  <SelectItem key={item.key} value={item.key}>
                                    {item.fraccion} · {item.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`actividad-fecha-${index}`}>
                              Fecha en que se realizó por primera vez la Actividad Vulnerable
                            </Label>
                            <Input
                              id={`actividad-fecha-${index}`}
                              type="date"
                              value={actividad.fechaPrimera}
                              onChange={(event) => actualizarActividadCampo(index, "fechaPrimera", event.target.value)}
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor={`actividad-registro-${index}`}>
                              ¿Cuenta con registro / autorización / patente o certificado para realizar la Actividad Vulnerable?
                            </Label>
                            <Select
                              value={actividad.cuentaRegistro}
                              onValueChange={(value) => actualizarActividadCampo(index, "cuentaRegistro", value)}
                            >
                              <SelectTrigger id={`actividad-registro-${index}`}>
                                <SelectValue placeholder="Selecciona una opción" />
                              </SelectTrigger>
                              <SelectContent position="popper">
                                <SelectItem value="si">Sí</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {registroSi && (
                          <div className="grid gap-4 md:grid-cols-2 rounded-lg border border-dashed p-4">
                            <div className="space-y-2">
                              <Label htmlFor={`actividad-doc-tipo-${index}`}>Tipo de Documento</Label>
                              <Select
                                value={actividad.tipoDocumento}
                                onValueChange={(value) => actualizarActividadCampo(index, "tipoDocumento", value)}
                              >
                                <SelectTrigger id={`actividad-doc-tipo-${index}`}>
                                  <SelectValue placeholder="Selecciona" />
                                </SelectTrigger>
                                <SelectContent position="popper">
                                  {opcionesDocumento.map((opcion) => (
                                    <SelectItem key={opcion} value={opcion}>
                                      {opcion}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`actividad-doc-autoridad-${index}`}>Autoridad que lo emite</Label>
                              <Select
                                value={actividad.autoridadDocumento}
                                onValueChange={(value) => actualizarActividadCampo(index, "autoridadDocumento", value)}
                              >
                                <SelectTrigger id={`actividad-doc-autoridad-${index}`}>
                                  <SelectValue placeholder="Selecciona" />
                                </SelectTrigger>
                                <SelectContent position="popper">
                                  {opcionesAutoridad.map((opcion) => (
                                    <SelectItem key={opcion} value={opcion}>
                                      {opcion}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`actividad-doc-folio-${index}`}>Número o Folio de identificación</Label>
                              <Input
                                id={`actividad-doc-folio-${index}`}
                                value={actividad.folioDocumento}
                                onChange={(event) => actualizarActividadCampo(index, "folioDocumento", event.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`actividad-doc-periodo-${index}`}>Periodo que ampara el registro</Label>
                              <Input
                                id={`actividad-doc-periodo-${index}`}
                                value={actividad.periodoDocumento}
                                onChange={(event) => actualizarActividadCampo(index, "periodoDocumento", event.target.value)}
                                placeholder="YYYY-MM-DD o rango"
                              />
                            </div>
                          </div>
                        )}

                        <div className="space-y-4 rounded-lg border border-dashed p-4">
                          <p className="text-sm font-semibold">
                            Domicilio en Territorio Nacional donde lleva a cabo la Actividad Vulnerable ({index + 1})
                          </p>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor={`domicilio-cp-${index}`}>Código Postal</Label>
                              <Input
                                id={`domicilio-cp-${index}`}
                                value={actividad.domicilio.codigoPostal}
                                onChange={(event) => handleCodigoPostalChange(index, event.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`domicilio-tipo-${index}`}>Tipo de Vialidad</Label>
                              <Input
                                id={`domicilio-tipo-${index}`}
                                value={actividad.domicilio.tipoVialidad}
                                onChange={(event) =>
                                  actualizarDomicilioActividadCampo(index, "tipoVialidad", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`domicilio-nombre-${index}`}>Nombre de la Vialidad</Label>
                              <Input
                                id={`domicilio-nombre-${index}`}
                                value={actividad.domicilio.nombreVialidad}
                                onChange={(event) =>
                                  actualizarDomicilioActividadCampo(index, "nombreVialidad", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`domicilio-ext-${index}`}>Número Exterior</Label>
                              <Input
                                id={`domicilio-ext-${index}`}
                                value={actividad.domicilio.numeroExterior}
                                onChange={(event) =>
                                  actualizarDomicilioActividadCampo(index, "numeroExterior", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`domicilio-int-${index}`}>Número Interior</Label>
                              <Input
                                id={`domicilio-int-${index}`}
                                value={actividad.domicilio.numeroInterior}
                                onChange={(event) =>
                                  actualizarDomicilioActividadCampo(index, "numeroInterior", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`domicilio-colonia-${index}`}>Colonia / Urbanización</Label>
                              <Input
                                id={`domicilio-colonia-${index}`}
                                value={actividad.domicilio.colonia}
                                onChange={(event) =>
                                  actualizarDomicilioActividadCampo(index, "colonia", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`domicilio-alcaldia-${index}`}>Alcaldía / Municipio</Label>
                              <Input
                                id={`domicilio-alcaldia-${index}`}
                                value={actividad.domicilio.alcaldia}
                                placeholder="Se completa con el CP"
                                disabled
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`domicilio-entidad-${index}`}>Entidad / Estado / Provincia</Label>
                              <Input
                                id={`domicilio-entidad-${index}`}
                                value={actividad.domicilio.entidad}
                                placeholder="Se completa con el CP"
                                disabled
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`domicilio-pais-${index}`}>País</Label>
                              <Input id={`domicilio-pais-${index}`} value={actividad.domicilio.pais} disabled />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              {(tipoSujeto === "moral" || tipoSujeto === "fideicomiso") && (
                <Card>
                  <CardHeader>
                    <CardTitle>Representante Encargado de Cumplimiento</CardTitle>
                    <CardDescription>Se captura únicamente para personas morales y fideicomisos.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <p className="text-sm font-semibold">Datos del Representante Encargado de Cumplimiento</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="rec-nombres">Nombre(s) (sin abreviaturas)</Label>
                          <Input
                            id="rec-nombres"
                            value={representante.nombre}
                            onChange={(event) => actualizarRepresentanteCampo("nombre", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-apellido-paterno">Apellido Paterno</Label>
                          <Input
                            id="rec-apellido-paterno"
                            value={representante.apellidoPaterno}
                            onChange={(event) => actualizarRepresentanteCampo("apellidoPaterno", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-apellido-materno">Apellido Materno</Label>
                          <Input
                            id="rec-apellido-materno"
                            value={representante.apellidoMaterno}
                            onChange={(event) => actualizarRepresentanteCampo("apellidoMaterno", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-fecha-nacimiento">Fecha de Nacimiento</Label>
                          <Input
                            id="rec-fecha-nacimiento"
                            type="date"
                            value={representante.fechaNacimiento}
                            onChange={(event) => actualizarRepresentanteCampo("fechaNacimiento", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-rfc">RFC</Label>
                          <Input
                            id="rec-rfc"
                            value={representante.rfc}
                            onChange={(event) => actualizarRepresentanteCampo("rfc", event.target.value.toUpperCase())}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-curp">CURP</Label>
                          <Input
                            id="rec-curp"
                            value={representante.curp}
                            onChange={(event) => actualizarRepresentanteCampo("curp", event.target.value.toUpperCase())}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-pais">País de Nacionalidad</Label>
                          <Select
                            value={representante.paisNacionalidad}
                            onValueChange={(value) => actualizarRepresentanteCampo("paisNacionalidad", value)}
                          >
                            <SelectTrigger id="rec-pais">
                              <SelectValue placeholder="Selecciona un país" />
                            </SelectTrigger>
                            <SelectContent position="popper">
                              {PAISES.map((pais) => (
                                <SelectItem key={pais.code} value={pais.code}>
                                  {pais.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-fecha-designacion">Fecha de Designación</Label>
                          <Input
                            id="rec-fecha-designacion"
                            type="date"
                            value={representante.fechaDesignacion}
                            onChange={(event) => actualizarRepresentanteCampo("fechaDesignacion", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-fecha-aceptacion">Fecha de Aceptación de la Designación</Label>
                          <Input
                            id="rec-fecha-aceptacion"
                            type="date"
                            value={representante.fechaAceptacion}
                            onChange={(event) => actualizarRepresentanteCampo("fechaAceptacion", event.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm font-semibold">Datos de contacto del Representante Encargado de Cumplimiento</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="rec-lada">Clave LADA</Label>
                          <Input
                            id="rec-lada"
                            value={representante.contacto.claveLada}
                            onChange={(event) => actualizarRepresentanteContactoCampo("claveLada", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-telefono">Número Telefónico Fijo</Label>
                          <Input
                            id="rec-telefono"
                            value={representante.contacto.telefonoFijo}
                            onChange={(event) => actualizarRepresentanteContactoCampo("telefonoFijo", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-extension">Extensión (en su caso)</Label>
                          <Input
                            id="rec-extension"
                            value={representante.contacto.extension}
                            onChange={(event) => actualizarRepresentanteContactoCampo("extension", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-movil">Número Telefónico Móvil</Label>
                          <Input
                            id="rec-movil"
                            value={representante.contacto.telefonoMovil}
                            onChange={(event) => actualizarRepresentanteContactoCampo("telefonoMovil", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-correo">Correo Electrónico</Label>
                          <Input
                            id="rec-correo"
                            type="email"
                            value={representante.contacto.correo}
                            onChange={(event) => actualizarRepresentanteContactoCampo("correo", event.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm font-semibold">Credenciales del Representante Encargado de Cumplimiento</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="rec-certificacion">
                            ¿El Representante Encargado de Cumplimiento cuenta con Certificación en materia de PLD/FT?
                          </Label>
                          <Select
                            value={representante.certificacion.respuesta}
                            onValueChange={(value) =>
                              actualizarRepresentanteCertificacionCampo("respuesta", value)
                            }
                          >
                            <SelectTrigger id="rec-certificacion">
                              <SelectValue placeholder="Selecciona una opción" />
                            </SelectTrigger>
                            <SelectContent position="popper">
                              <SelectItem value="si">Sí</SelectItem>
                              <SelectItem value="no">No</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {representante.certificacion.respuesta === "si" && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="rec-cert-tipo">Tipo de Documento</Label>
                              <Select
                                value={representante.certificacion.tipoDocumento}
                                onValueChange={(value) =>
                                  actualizarRepresentanteCertificacionCampo("tipoDocumento", value)
                                }
                              >
                                <SelectTrigger id="rec-cert-tipo">
                                  <SelectValue placeholder="Selecciona" />
                                </SelectTrigger>
                                <SelectContent position="popper">
                                  {opcionesDocumento.map((opcion) => (
                                    <SelectItem key={opcion} value={opcion}>
                                      {opcion}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="rec-cert-autoridad">Autoridad que lo emite</Label>
                              <Select
                                value={representante.certificacion.autoridadDocumento}
                                onValueChange={(value) =>
                                  actualizarRepresentanteCertificacionCampo("autoridadDocumento", value)
                                }
                              >
                                <SelectTrigger id="rec-cert-autoridad">
                                  <SelectValue placeholder="Selecciona" />
                                </SelectTrigger>
                                <SelectContent position="popper">
                                  {opcionesAutoridad.map((opcion) => (
                                    <SelectItem key={opcion} value={opcion}>
                                      {opcion}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="rec-cert-folio">Número o Folio de identificación</Label>
                              <Input
                                id="rec-cert-folio"
                                value={representante.certificacion.folioDocumento}
                                onChange={(event) =>
                                  actualizarRepresentanteCertificacionCampo("folioDocumento", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="rec-cert-periodo">Periodo que ampara el registro</Label>
                              <Input
                                id="rec-cert-periodo"
                                value={representante.certificacion.periodoDocumento}
                                onChange={(event) =>
                                  actualizarRepresentanteCertificacionCampo("periodoDocumento", event.target.value)
                                }
                                placeholder="YYYY-MM-DD o rango"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <CardTitle>Documentos obligatorios del alta</CardTitle>
                <CardDescription>
                  Carga detalle, acuse y aceptación de designación de encargado. Si faltan, podrás guardar el registro y quedará
                  marcado como incompleto.
                </CardDescription>
              </div>
              <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
                <Button className="w-full md:w-auto" onClick={registrarSujetoManual} disabled={!camposObligatoriosCapturados}>
                  {enEdicion ? "Actualizar sujeto obligado" : "Registrar sujeto obligado"}
                </Button>
                {enEdicion && (
                  <Button variant="ghost" className="w-full md:w-auto" onClick={cancelarEdicion}>
                    Cancelar edición
                  </Button>
                )}
                <p className="text-xs text-muted-foreground text-left md:text-right">
                  Se confirmará el registro y el formulario quedará listo para el siguiente sujeto.
                </p>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {(
                [
                  { id: "detalle", label: "Detalle de alta" },
                  { id: "acuse", label: "Acuse del SAT" },
                  { id: "aceptacion", label: "Aceptación de designación" },
                ] as { id: RegistroDocumentKey; label: string }[]
              ).map((doc) => {
                const documento = documentosRegistro[doc.id]
                return (
                  <div key={doc.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{doc.label}</p>
                        <p className="text-xs text-muted-foreground">PDF o XML</p>
                      </div>
                      <Badge variant={documento ? "default" : "outline"}>
                        {documento ? "Cargado" : "Pendiente"}
                      </Badge>
                    </div>
                    <Button variant="outline" className="w-full" asChild>
                      <label className="flex cursor-pointer items-center justify-center gap-2">
                        <Upload className="h-4 w-4" />
                        {documento ? "Reemplazar archivo" : "Subir archivo"}
                        <input
                          type="file"
                          className="sr-only"
                          onChange={(event) => manejarCargaDocumentoRegistro(event, doc.id)}
                        />
                      </label>
                    </Button>
                    {documento && (
                      <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-3.5 w-3.5" />
                          <span className="truncate" title={documento.name}>
                            {documento.name}
                          </span>
                        </div>
                        <p>{documento.uploadDate.toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                )
              })}
              <div className="md:col-span-3 grid gap-3 rounded-lg border bg-muted/40 p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <ClipboardList className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold">Checklist listo para múltiples registros</p>
                    <p className="text-sm text-muted-foreground">
                      Reutiliza el checklist para cada sujeto. Al registrar, el formulario se limpia para iniciar el siguiente.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant={camposObligatoriosCapturados ? "default" : "outline"}>Datos capturados</Badge>
                  <Badge variant={documentosRequeridosCompletos ? "default" : "outline"}>Documentos listos</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklist guiado por anexos</CardTitle>
              <CardDescription>
                Marca los datos solicitados por el anexo correspondiente para evitar consultar las reglas manualmente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Avance</span>
                  <span className="text-sm font-semibold">{datosChecklistResumen.progreso}%</span>
                </div>
                <Progress value={datosChecklistResumen.progreso} className="h-2" />
              </div>

              <div className="space-y-4">
                {seccionesAplicables.map((section) => {
                  const completados = section.fields.filter((field) => datosChecklistState[field.id]?.completed).length
                  const progresoSeccion = Math.round((completados / section.fields.length) * 100)
                  const Icon = section.icon

                  return (
                    <Card key={section.id} className="border-dashed">
                      <CardHeader className="pb-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <Icon className="h-5 w-5 text-primary" />
                              {section.title}
                            </CardTitle>
                            <CardDescription>{section.description}</CardDescription>
                          </div>
                          <Badge variant="outline">{progresoSeccion}%</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {section.fields.map((field) => (
                          <div
                            key={field.id}
                            className="space-y-3 rounded-lg border border-dashed bg-muted/30 p-4"
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                id={`dato-${field.id}`}
                                checked={datosChecklistState[field.id]?.completed ?? false}
                                onCheckedChange={(checked) => actualizarEstatusDatoChecklist(field.id, checked === true)}
                                className="mt-1"
                              />
                              <div className="flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Label htmlFor={`dato-${field.id}`} className="font-medium">
                                    {field.label}
                                  </Label>
                                  <Badge variant={field.required ? "default" : "secondary"}>
                                    {field.required ? "Obligatorio" : "Opcional"}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{field.description}</p>
                                {field.tips && field.tips.length > 0 && (
                                  <ul className="ml-5 list-disc space-y-1 text-xs text-muted-foreground">
                                    {field.tips.map((tip) => (
                                      <li key={tip}>{tip}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                            <div className="ml-7 space-y-2">
                              <Label
                                htmlFor={`dato-notas-${field.id}`}
                                className="text-xs font-semibold uppercase text-muted-foreground"
                              >
                                Notas y referencias
                              </Label>
                              <Textarea
                                id={`dato-notas-${field.id}`}
                                value={datosChecklistState[field.id]?.notes ?? ""}
                                onChange={(event) => actualizarNotasDatoChecklist(field.id, event.target.value)}
                                placeholder="Anota folios, responsables o ubicación del respaldo."
                              />
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evidencia documental recomendada</CardTitle>
              <CardDescription>
                No es obligatoria, pero ayuda a completar el expediente de alta y registro (acta, situación fiscal, domicilio).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {evidenciasRecomendadas.map((doc) => (
                <div key={doc.id} className="space-y-3 rounded-lg border p-4">
                  <div className="space-y-1">
                    <p className="font-semibold">{doc.label}</p>
                    <p className="text-sm text-muted-foreground">{doc.descripcion}</p>
                  </div>
                  <Button variant="outline" className="w-full" asChild>
                    <label className="flex cursor-pointer items-center justify-center gap-2">
                      <Upload className="h-4 w-4" />
                      Adjuntar
                      <input
                        type="file"
                        className="sr-only"
                        onChange={(event) => manejarCargaDocumento(event, doc.id)}
                      />
                    </label>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
          </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
