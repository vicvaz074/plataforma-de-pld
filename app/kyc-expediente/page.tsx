"use client"
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
} from "react"
import { useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Building2,
  FolderOpen,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react"
import { CLIENTE_TIPOS, findClienteTipoLabel, findClienteTipoOption } from "@/lib/data/tipos-cliente"
import { PAISES, findPaisByCodigo, findPaisByNombre } from "@/lib/data/paises"
import {
  CIUDADES_MEXICO,
  findCodigoPostalInfo,
  registerCodigoPostalInfo,
  type CodigoPostalInfo,
} from "@/lib/data/codigos-postales"
import { demoFraccionXV } from "@/lib/demo/fraccion-xv"

interface CampoExpediente {
  id: string
  label: string
  requerido?: boolean
  type?: string
  multiline?: boolean
  placeholder?: string
}

interface GrupoIdentificacion {
  id: string
  titulo: string
  descripcion: string
  campos: CampoExpediente[]
}

interface DocumentoRequerido {
  id: string
  titulo: string
  descripcion: string
  obligatorio?: boolean
}

const IDENTIFICACION_CAMPOS: GrupoIdentificacion[] = [
  {
    id: "datos-generales",
    titulo: "Datos de identificación del cliente",
    descripcion: "Información básica necesaria para identificar plenamente a la persona moral.",
    campos: [
      { id: "nombre", label: "Denominación o razón social", requerido: true, placeholder: "Ej. Grupo Ejemplar, S.A. de C.V." },
      { id: "fecha-constitucion", label: "Fecha de constitución", type: "date" },
      { id: "pais-nacionalidad", label: "País de nacionalidad", requerido: true, placeholder: "Ej. México" },
      { id: "rfc", label: "Registro Federal de Contribuyentes / NIF", requerido: true, placeholder: "Ej. GEX123456789" },
      { id: "actividad-giro", label: "Actividad, giro mercantil, actividad u objeto social", multiline: true },
    ],
  },
]

const DOCUMENTACION_REQUERIDA: DocumentoRequerido[] = [
  {
    id: "formulario-identificacion",
    titulo: "Formulario de Identificación del Cliente",
    descripcion: "Formato interno completo con datos generales, domicilio, representante y beneficiarios.",
    obligatorio: true,
  },
  {
    id: "documento-acto-operacion",
    titulo: "Documento que acredita la celebración del Acto u Operación",
    descripcion: "Contrato, factura, póliza o documento equivalente.",
    obligatorio: true,
  },
  {
    id: "instrumento-constitucion",
    titulo: "Instrumento público que acredita la constitución del Cliente",
    descripcion: "Acta constitutiva o escritura pública vigente.",
    obligatorio: true,
  },
  {
    id: "registro-publico",
    titulo: "Constancia de inscripción en el Registro Público",
    descripcion: "Documento que acredita la inscripción del instrumento constitutivo.",
    obligatorio: true,
  },
  {
    id: "situacion-fiscal",
    titulo: "Constancia de Situación Fiscal (SAT)",
    descripcion: "Documento emitido por el SAT con régimen y obligaciones vigentes.",
    obligatorio: true,
  },
  {
    id: "comprobante-domicilio-cliente",
    titulo: "Comprobante de domicilio del Cliente",
    descripcion: "Recibo de servicios o estado de cuenta reciente.",
    obligatorio: true,
  },
  {
    id: "poder-representante",
    titulo: "Instrumento que contiene los poderes del representante",
    descripcion: "Poder notarial o documento equivalente.",
  },
  {
    id: "identificacion-representante",
    titulo: "Identificación oficial del representante o apoderado legal",
    descripcion: "INE, pasaporte, cédula profesional o documento migratorio.",
    obligatorio: true,
  },
  {
    id: "comprobante-representante",
    titulo: "Comprobante de domicilio del representante o apoderado legal",
    descripcion: "Recibo de servicios o estado de cuenta reciente.",
  },
  {
    id: "identificacion-beneficiario",
    titulo: "Identificación oficial del Beneficiario Controlador",
    descripcion: "INE, pasaporte o documento oficial equivalente.",
    obligatorio: true,
  },
  {
    id: "curp-beneficiario",
    titulo: "Constancia CURP (o equivalente) del Beneficiario Controlador",
    descripcion: "Documento de identificación poblacional.",
  },
  {
    id: "rfc-beneficiario",
    titulo: "Cédula de Identificación Fiscal o NIF del Beneficiario Controlador",
    descripcion: "Documento fiscal vigente.",
  },
  {
    id: "domicilio-beneficiario",
    titulo: "Comprobante de domicilio del Beneficiario Controlador",
    descripcion: "Aplica cuando no coincide con la identificación presentada.",
  },
]

type DocumentStatus = "pendiente" | "en-proceso" | "completo"

const DOCUMENTO_STATUS: { value: DocumentStatus; label: string; classes: string }[] = [
  { value: "pendiente", label: "Pendiente", classes: "bg-rose-100 text-rose-700" },
  { value: "en-proceso", label: "En revisión", classes: "bg-amber-100 text-amber-700" },
  { value: "completo", label: "Completo", classes: "bg-emerald-100 text-emerald-700" },
]

const TIPO_VIALIDAD_OPCIONES = [
  { value: "calle", label: "Calle" },
  { value: "avenida", label: "Avenida" },
  { value: "boulevard", label: "Boulevard" },
  { value: "carretera", label: "Carretera" },
  { value: "cerrada", label: "Cerrada" },
  { value: "privada", label: "Privada" },
]

const IDENTIFICACION_TIPOS = [
  { value: "ine", label: "INE" },
  { value: "pasaporte", label: "Pasaporte" },
  { value: "cedula", label: "Cédula profesional" },
  { value: "migratorio", label: "Documento migratorio" },
  { value: "otro", label: "Otro" },
]

const TIPO_INMUEBLE_OPCIONES = [
  { value: "casa", label: "Casa" },
  { value: "departamento", label: "Departamento" },
  { value: "terreno", label: "Terreno" },
  { value: "bodega", label: "Bodega" },
  { value: "local", label: "Local comercial" },
  { value: "otro", label: "Otro" },
]

type RespuestaBinaria = "si" | "no"

const DOMICILIO_TIPOS = [
  { value: "nacional", label: "Domicilio nacional" },
  { value: "extranjero", label: "Domicilio extranjero" },
]

const PERSONA_TIPO_OPCIONES = [
  { value: "persona_moral", label: "Persona moral" },
  { value: "persona_fisica", label: "Persona física" },
]

const EXPEDIENTE_TIPOS = [
  { value: "persona_moral", label: "Persona Moral" },
  { value: "persona_fisica", label: "Persona Física" },
  { value: "persona_moral_derecho_publico", label: "Persona Moral de Derecho Público" },
  { value: "entidad_financiera_seguros", label: "Entidad Financiera / Seguros" },
  {
    value: "pm_derecho_publico_regimen_simplificado",
    label: "PM de Derecho Público Régimen Simplificado",
  },
  { value: "embajada_consulado_organismo", label: "Embajada, Consulado u Organismo" },
  { value: "fideicomiso", label: "Fideicomiso" },
]

const ACTO_OPERACION_OPCIONES = [
  { value: "compraventa", label: "Compraventa" },
  { value: "arrendamiento", label: "Arrendamiento" },
  { value: "donacion", label: "Donación" },
  { value: "constitucion", label: "Constitución de sociedad" },
  { value: "otro", label: "Otro" },
]

function normalizarBusqueda(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
}

interface PersonaReportada {
  id: string
  tipo: (typeof PERSONA_TIPO_OPCIONES)[number]["value"]
  denominacion: string
  apellidoPaterno: string
  apellidoMaterno: string
  fechaConstitucion: string
  rfc: string
  curp: string
  pais: string
  paisNacimiento: string
  giro: string
  rolRelacion: string
  representante: {
    nombre: string
    apellidoPaterno: string
    apellidoMaterno: string
    fechaNacimiento: string
    rfc: string
    curp: string
  }
  domicilio: {
    ambito: (typeof DOMICILIO_TIPOS)[number]["value"]
    pais: string
    entidad: string
    municipio: string
    ciudad: string
    colonia: string
    codigoPostal: string
    calle: string
    numeroExterior: string
    numeroInterior: string
  }
  contacto: {
    conoceTelefono: RespuestaBinaria
    conocePaisTelefono: RespuestaBinaria
    clavePais: string
    telefono: string
    correo: string
  }
  identificacion: {
    tipo: string
    numero: string
    pais: string
    fechaVencimiento: string
  }
  participacion: {
    porcentajeCapital: string
    origenRecursos: string
    esPep: RespuestaBinaria
    detallePep: string
  }
}

interface ActoOperacion {
  tipo: string
  fechaCelebracion: string
  relacionNegocios: "" | RespuestaBinaria
}

interface SujetoObligadoOption {
  id: string
  nombre: string
  rfc: string
}

interface Domicilio {
  codigoPostal: string
  tipoVialidad: string
  nombreVialidad: string
  numeroExterior: string
  numeroInterior: string
  colonia: string
  municipio: string
  ciudad: string
  entidad: string
  pais: string
}

interface ContactoCliente {
  ladaFijo: string
  telefonoFijo: string
  extension: string
  ladaMovil: string
  telefonoMovil: string
  correo: string
}

interface RepresentanteLegal {
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  rfc: string
  puesto: string
  paisNacionalidad: string
}

interface IdentificacionRepresentante {
  tipo: string
  numero: string
  autoridad: string
  vigencia: string
}

interface InmuebleInfo {
  tipo: string
  valorReferencia: string
  folioReal: string
}

const CLIENTES_STORAGE_KEY = "actividades_vulnerables_clientes"
const EXPEDIENTE_DETALLE_STORAGE_KEY = "kyc_expedientes_detalle"
const SEPOMEX_API_BASE = "https://api.zippopotam.us/mx"
const SEPOMEX_STORAGE_PREFIX = "codigo_postal_cache_"

function generarIdTemporal() {
  return Math.random().toString(36).slice(2, 10)
}

function crearDomicilioBase(): Domicilio {
  return {
    codigoPostal: "",
    tipoVialidad: "",
    nombreVialidad: "",
    numeroExterior: "",
    numeroInterior: "",
    colonia: "",
    municipio: "",
    ciudad: "",
    entidad: "",
    pais: "MX",
  }
}

function crearPersonaBase(): PersonaReportada {
  return {
    id: generarIdTemporal(),
    tipo: "persona_moral",
    denominacion: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    fechaConstitucion: "",
    rfc: "",
    curp: "",
    pais: "MX",
    paisNacimiento: "MX",
    giro: "",
    rolRelacion: "Beneficiario controlador",
    representante: {
      nombre: "",
      apellidoPaterno: "",
      apellidoMaterno: "",
      fechaNacimiento: "",
      rfc: "",
      curp: "",
    },
    domicilio: {
      ambito: "nacional",
      pais: "MX",
      entidad: "",
      municipio: "",
      ciudad: "",
      colonia: "",
      codigoPostal: "",
      calle: "",
      numeroExterior: "",
      numeroInterior: "",
    },
    contacto: {
      conoceTelefono: "si",
      conocePaisTelefono: "si",
      clavePais: "MX",
      telefono: "",
      correo: "",
    },
    identificacion: {
      tipo: "",
      numero: "",
      pais: "MX",
      fechaVencimiento: "",
    },
    participacion: {
      porcentajeCapital: "",
      origenRecursos: "",
      esPep: "no",
      detallePep: "",
    },
  }
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

interface ExpedienteResumen {
  rfc: string
  nombre: string
  tipoCliente: string
  detalleTipoCliente?: string
}

interface ExpedienteDetalle extends ExpedienteResumen {
  tipoExpediente?: (typeof EXPEDIENTE_TIPOS)[number]["value"]
  responsable?: string
  claveSujetoObligado?: string
  claveActividadVulnerable?: string
  actoOperacion?: ActoOperacion
  domicilioCliente?: Record<string, string>
  contactoCliente?: Record<string, string>
  representanteLegal?: Record<string, string>
  identificacionRepresentante?: Record<string, string>
  inmueble?: Record<string, string>
  ubicacionInmueble?: Record<string, string>
  identificacion?: Record<string, string>
  documentacion?: Record<string, DocumentStatus>
  personas: PersonaReportada[]
  actualizadoEn?: string
}

interface ExpedienteListadoItem extends ExpedienteResumen {
  actualizadoEn?: string
  detalle?: ExpedienteDetalle | null
}

function normalizarTexto(value: string | undefined | null) {
  if (!value) return ""
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
}

function sanitizeTipoCliente(value: string | undefined | null) {
  if (!value) return CLIENTE_TIPOS[0]?.value ?? ""
  const encontrado = findClienteTipoOption(value)
  return encontrado ? encontrado.value : CLIENTE_TIPOS[0]?.value ?? ""
}

function sanitizeTipoExpediente(value: string | undefined | null) {
  if (!value) return EXPEDIENTE_TIPOS[0]?.value ?? "persona_moral"
  return EXPEDIENTE_TIPOS.some((option) => option.value === value)
    ? value
    : EXPEDIENTE_TIPOS[0]?.value ?? "persona_moral"
}

function sanitizeStringMap(raw: any): Record<string, string> {
  if (!raw || typeof raw !== "object") return {}
  const resultado: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") {
      resultado[key] = value
    }
  }
  return resultado
}

function sanitizeDocumentacionMap(raw: any): Record<string, DocumentStatus> {
  if (!raw || typeof raw !== "object") return {}
  const resultado: Record<string, DocumentStatus> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value === "pendiente" || value === "en-proceso" || value === "completo") {
      resultado[key] = value
    }
  }
  return resultado
}

function sanitizePersonaGuardada(raw: any): PersonaReportada | null {
  if (!raw || typeof raw !== "object") return null

  const base = crearPersonaBase()
  const representanteRaw = typeof raw.representante === "object" && raw.representante ? raw.representante : {}
  const domicilioRaw = typeof raw.domicilio === "object" && raw.domicilio ? raw.domicilio : {}
  const contactoRaw = typeof raw.contacto === "object" && raw.contacto ? raw.contacto : {}
  const identificacionRaw =
    typeof raw.identificacion === "object" && raw.identificacion ? raw.identificacion : {}
  const participacionRaw =
    typeof raw.participacion === "object" && raw.participacion ? raw.participacion : {}

  const persona: PersonaReportada = {
    ...base,
    id:
      typeof raw.id === "string" && raw.id.trim().length > 0 ? raw.id : generarIdTemporal(),
    tipo: raw.tipo === "persona_fisica" || raw.tipo === "persona_moral" ? raw.tipo : base.tipo,
    denominacion: typeof raw.denominacion === "string" ? raw.denominacion : base.denominacion,
    apellidoPaterno:
      typeof raw.apellidoPaterno === "string" ? raw.apellidoPaterno : base.apellidoPaterno,
    apellidoMaterno:
      typeof raw.apellidoMaterno === "string" ? raw.apellidoMaterno : base.apellidoMaterno,
    fechaConstitucion:
      typeof raw.fechaConstitucion === "string" ? raw.fechaConstitucion : base.fechaConstitucion,
    rfc: typeof raw.rfc === "string" ? raw.rfc : base.rfc,
    curp: typeof raw.curp === "string" ? raw.curp : base.curp,
    pais:
      typeof raw.pais === "string"
        ? findPaisByNombre(raw.pais)?.code ?? findPaisByCodigo(raw.pais)?.code ?? raw.pais
        : base.pais,
    paisNacimiento:
      typeof raw.paisNacimiento === "string"
        ? findPaisByNombre(raw.paisNacimiento)?.code ??
          findPaisByCodigo(raw.paisNacimiento)?.code ??
          raw.paisNacimiento
        : base.paisNacimiento,
    giro: typeof raw.giro === "string" ? raw.giro : base.giro,
    rolRelacion: typeof raw.rolRelacion === "string" ? raw.rolRelacion : base.rolRelacion,
    representante: {
      ...base.representante,
      nombre: typeof representanteRaw.nombre === "string" ? representanteRaw.nombre : base.representante.nombre,
      apellidoPaterno:
        typeof representanteRaw.apellidoPaterno === "string"
          ? representanteRaw.apellidoPaterno
          : base.representante.apellidoPaterno,
      apellidoMaterno:
        typeof representanteRaw.apellidoMaterno === "string"
          ? representanteRaw.apellidoMaterno
          : base.representante.apellidoMaterno,
      fechaNacimiento:
        typeof representanteRaw.fechaNacimiento === "string"
          ? representanteRaw.fechaNacimiento
          : base.representante.fechaNacimiento,
      rfc: typeof representanteRaw.rfc === "string" ? representanteRaw.rfc : base.representante.rfc,
      curp: typeof representanteRaw.curp === "string" ? representanteRaw.curp : base.representante.curp,
    },
    domicilio: {
      ...base.domicilio,
      ambito: domicilioRaw.ambito === "extranjero" ? "extranjero" : "nacional",
      pais:
        domicilioRaw.ambito === "extranjero"
          ? typeof domicilioRaw.pais === "string"
            ? findPaisByNombre(domicilioRaw.pais)?.code ??
              findPaisByCodigo(domicilioRaw.pais)?.code ??
              domicilioRaw.pais
            : base.domicilio.pais
          : "MX",
      entidad: typeof domicilioRaw.entidad === "string" ? domicilioRaw.entidad : base.domicilio.entidad,
      municipio: typeof domicilioRaw.municipio === "string" ? domicilioRaw.municipio : base.domicilio.municipio,
      ciudad: typeof domicilioRaw.ciudad === "string" ? domicilioRaw.ciudad : base.domicilio.ciudad,
      colonia: typeof domicilioRaw.colonia === "string" ? domicilioRaw.colonia : base.domicilio.colonia,
      codigoPostal:
        typeof domicilioRaw.codigoPostal === "string"
          ? domicilioRaw.codigoPostal.replace(/[^0-9]/g, "").slice(0, 5)
          : base.domicilio.codigoPostal,
      calle: typeof domicilioRaw.calle === "string" ? domicilioRaw.calle : base.domicilio.calle,
      numeroExterior:
        typeof domicilioRaw.numeroExterior === "string"
          ? domicilioRaw.numeroExterior
          : base.domicilio.numeroExterior,
      numeroInterior:
        typeof domicilioRaw.numeroInterior === "string"
          ? domicilioRaw.numeroInterior
          : base.domicilio.numeroInterior,
    },
    contacto: {
      ...base.contacto,
      conoceTelefono: "si",
      conocePaisTelefono:
        contactoRaw.conocePaisTelefono === "no" || contactoRaw.conocePaisTelefono === "si"
          ? contactoRaw.conocePaisTelefono
          : base.contacto.conocePaisTelefono,
      clavePais:
        typeof contactoRaw.clavePais === "string"
          ? findPaisByNombre(contactoRaw.clavePais)?.code ??
            findPaisByCodigo(contactoRaw.clavePais)?.code ??
            contactoRaw.clavePais
          : base.contacto.clavePais,
      telefono: typeof contactoRaw.telefono === "string" ? contactoRaw.telefono : base.contacto.telefono,
      correo: typeof contactoRaw.correo === "string" ? contactoRaw.correo : base.contacto.correo,
    },
    identificacion: {
      ...base.identificacion,
      tipo: typeof identificacionRaw.tipo === "string" ? identificacionRaw.tipo : base.identificacion.tipo,
      numero: typeof identificacionRaw.numero === "string" ? identificacionRaw.numero : base.identificacion.numero,
      pais:
        typeof identificacionRaw.pais === "string"
          ? findPaisByNombre(identificacionRaw.pais)?.code ??
            findPaisByCodigo(identificacionRaw.pais)?.code ??
            identificacionRaw.pais
          : base.identificacion.pais,
      fechaVencimiento:
        typeof identificacionRaw.fechaVencimiento === "string"
          ? identificacionRaw.fechaVencimiento
          : base.identificacion.fechaVencimiento,
    },
    participacion: {
      ...base.participacion,
      porcentajeCapital:
        typeof participacionRaw.porcentajeCapital === "string"
          ? participacionRaw.porcentajeCapital
          : base.participacion.porcentajeCapital,
      origenRecursos:
        typeof participacionRaw.origenRecursos === "string"
          ? participacionRaw.origenRecursos
          : base.participacion.origenRecursos,
      esPep:
        participacionRaw.esPep === "si" || participacionRaw.esPep === "no"
          ? participacionRaw.esPep
          : base.participacion.esPep,
      detallePep:
        typeof participacionRaw.detallePep === "string"
          ? participacionRaw.detallePep
          : base.participacion.detallePep,
    },
  }

  if (persona.domicilio.ambito === "nacional" && persona.domicilio.codigoPostal.length === 5) {
    const info = findCodigoPostalInfo(persona.domicilio.codigoPostal)
    if (info) {
      persona.domicilio.entidad = info.estado
      persona.domicilio.municipio = info.municipio
      persona.domicilio.ciudad = info.ciudad ?? ""
      if (info.asentamientos.length > 0) {
        persona.domicilio.colonia = info.asentamientos.includes(persona.domicilio.colonia)
          ? persona.domicilio.colonia
          : info.asentamientos[0]
      }
    }
  }

  return persona
}

function sanitizeClienteResumen(raw: any): ExpedienteResumen | null {
  if (!raw || typeof raw !== "object") return null
  const rfc = typeof raw.rfc === "string" ? raw.rfc.trim().toUpperCase() : ""
  const nombre = typeof raw.nombre === "string" ? raw.nombre.trim() : ""
  if (!rfc || !nombre) return null

  const tipoCliente = sanitizeTipoCliente(typeof raw.tipoCliente === "string" ? raw.tipoCliente : undefined)
  const detalle = typeof raw.detalleTipoCliente === "string" ? raw.detalleTipoCliente : undefined

  return { rfc, nombre, tipoCliente, detalleTipoCliente: detalle }
}

function sanitizeExpedienteGuardado(raw: any): ExpedienteDetalle | null {
  if (!raw || typeof raw !== "object") return null
  const rfc = typeof raw.rfc === "string" ? raw.rfc.trim().toUpperCase() : ""
  if (!rfc) return null

  const nombre =
    typeof raw.nombre === "string" && raw.nombre.trim().length > 0 ? raw.nombre : raw.identificacion?.nombre ?? rfc

  const personasRaw = Array.isArray(raw.personas) ? raw.personas : []
  const personas = personasRaw
    .map((item) => sanitizePersonaGuardada(item))
    .filter((item): item is PersonaReportada => Boolean(item))
  const actoRaw = raw.actoOperacion && typeof raw.actoOperacion === "object" ? raw.actoOperacion : {}
  const actoOperacion: ActoOperacion = {
    tipo: typeof actoRaw.tipo === "string" ? actoRaw.tipo : "",
    fechaCelebracion: typeof actoRaw.fechaCelebracion === "string" ? actoRaw.fechaCelebracion : "",
    relacionNegocios:
      actoRaw.relacionNegocios === "si" || actoRaw.relacionNegocios === "no" ? actoRaw.relacionNegocios : "",
  }

  return {
    rfc,
    nombre,
    tipoCliente: sanitizeTipoCliente(typeof raw.tipoCliente === "string" ? raw.tipoCliente : undefined),
    tipoExpediente: sanitizeTipoExpediente(typeof raw.tipoExpediente === "string" ? raw.tipoExpediente : undefined),
    detalleTipoCliente:
      typeof raw.detalleTipoCliente === "string" && raw.detalleTipoCliente.trim().length > 0
        ? raw.detalleTipoCliente
        : undefined,
    responsable: typeof raw.responsable === "string" ? raw.responsable : undefined,
    claveSujetoObligado:
      typeof raw.claveSujetoObligado === "string" ? raw.claveSujetoObligado : undefined,
    claveActividadVulnerable:
      typeof raw.claveActividadVulnerable === "string" ? raw.claveActividadVulnerable : undefined,
    actoOperacion,
    domicilioCliente: sanitizeStringMap(raw.domicilioCliente),
    contactoCliente: sanitizeStringMap(raw.contactoCliente),
    representanteLegal: sanitizeStringMap(raw.representanteLegal),
    identificacionRepresentante: sanitizeStringMap(raw.identificacionRepresentante),
    inmueble: sanitizeStringMap(raw.inmueble),
    ubicacionInmueble: sanitizeStringMap(raw.ubicacionInmueble),
    identificacion: sanitizeStringMap(raw.identificacion),
    documentacion: sanitizeDocumentacionMap(raw.documentacion),
    personas,
    actualizadoEn: typeof raw.actualizadoEn === "string" ? raw.actualizadoEn : undefined,
  }
}

function buildResumenDesdeDetalle(detalle: ExpedienteDetalle): ExpedienteResumen {
  return {
    rfc: detalle.rfc,
    nombre: detalle.nombre ?? detalle.rfc,
    tipoCliente: detalle.tipoCliente ?? (CLIENTE_TIPOS[0]?.value ?? ""),
    detalleTipoCliente: detalle.detalleTipoCliente,
  }
}

function formatearFechaActualizacion(fecha?: string) {
  if (!fecha) return null
  const parsed = new Date(fecha)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
}

export default function KycExpedientePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-sm text-slate-500">
          <span className="h-3 w-3 animate-pulse rounded-full bg-slate-300" />
          Cargando expediente KYC...
        </div>
      }
    >
      <KycExpedienteContent />
    </Suspense>
  )
}

function obtenerStatusDocumento(value: DocumentStatus | undefined) {
  const fallback = DOCUMENTO_STATUS[0]
  if (!value) return fallback
  return DOCUMENTO_STATUS.find((item) => item.value === value) ?? fallback
}

function KycExpedienteContent() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [tipoExpediente, setTipoExpediente] = useState<(typeof EXPEDIENTE_TIPOS)[number]["value"]>(
    EXPEDIENTE_TIPOS[0]?.value ?? "persona_moral",
  )
  const [tipoCliente, setTipoCliente] = useState<string>(CLIENTE_TIPOS[0]?.value ?? "")
  const [detalleTipoCliente, setDetalleTipoCliente] = useState<string>("")
  const [responsable, setResponsable] = useState("")
  const [nombreExpediente, setNombreExpediente] = useState("")
  const [fechaRegistro, setFechaRegistro] = useState(() => new Date().toISOString().slice(0, 10))
  const [claveSujetoObligado, setClaveSujetoObligado] = useState("")
  const [claveActividadVulnerable, setClaveActividadVulnerable] = useState("")
  const [actoOperacion, setActoOperacion] = useState<ActoOperacion>({
    tipo: "",
    fechaCelebracion: "",
    relacionNegocios: "",
  })
  const [datosIdentificacion, setDatosIdentificacion] = useState<Record<string, string>>({})
  const [domicilioCliente, setDomicilioCliente] = useState<Domicilio>(() => crearDomicilioBase())
  const [contactoCliente, setContactoCliente] = useState<ContactoCliente>({
    ladaFijo: "",
    telefonoFijo: "",
    extension: "",
    ladaMovil: "",
    telefonoMovil: "",
    correo: "",
  })
  const [representanteLegal, setRepresentanteLegal] = useState<RepresentanteLegal>({
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    rfc: "",
    puesto: "",
    paisNacionalidad: "MX",
  })
  const [identificacionRepresentante, setIdentificacionRepresentante] = useState<IdentificacionRepresentante>({
    tipo: "",
    numero: "",
    autoridad: "",
    vigencia: "",
  })
  const [inmueble, setInmueble] = useState<InmuebleInfo>({
    tipo: "",
    valorReferencia: "",
    folioReal: "",
  })
  const [ubicacionInmueble, setUbicacionInmueble] = useState<Domicilio>(() => crearDomicilioBase())
  const [documentacionEstado, setDocumentacionEstado] = useState<Record<string, DocumentStatus>>({})
  const [personasReportadas, setPersonasReportadas] = useState<PersonaReportada[]>(() => [crearPersonaBase()])
  const [expedientesResumen, setExpedientesResumen] = useState<ExpedienteResumen[]>([])
  const [expedientesDetalle, setExpedientesDetalle] = useState<Record<string, ExpedienteDetalle>>({})
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState<string | null>(null)
  const [expedientesCargados, setExpedientesCargados] = useState(false)
  const [busquedaPais, setBusquedaPais] = useState("")
  const [busquedasColonias, setBusquedasColonias] = useState<Record<string, string>>({})
  const [busquedasCiudades, setBusquedasCiudades] = useState<Record<string, string>>({})
  const [busquedaExpedientes, setBusquedaExpedientes] = useState("")
  const [sujetosObligados, setSujetosObligados] = useState<SujetoObligadoOption[]>([])
  const [sujetoObligadoSeleccionado, setSujetoObligadoSeleccionado] = useState("")

  const tipoClienteSeleccionado = useMemo(() => findClienteTipoOption(tipoCliente), [tipoCliente])
  const tipoClienteLabel = useMemo(() => findClienteTipoLabel(tipoCliente), [tipoCliente])
  const tipoClienteResumen = useMemo(
    () => (detalleTipoCliente ? `${tipoClienteLabel} – ${detalleTipoCliente}` : tipoClienteLabel),
    [detalleTipoCliente, tipoClienteLabel],
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    const savedData = window.localStorage.getItem("registro-sat-data")
    if (!savedData) {
      setSujetosObligados([])
      return
    }

    try {
      const data = JSON.parse(savedData)
      const sujetos = Array.isArray(data.sujetosRegistrados)
        ? data.sujetosRegistrados
            .map((item: Partial<SujetoObligadoOption> & { identificacion?: { rfc?: string } }) => ({
              id: typeof item.id === "string" ? item.id : "",
              nombre: typeof item.nombre === "string" ? item.nombre : "",
              rfc: typeof item.identificacion?.rfc === "string" ? item.identificacion.rfc : "",
            }))
            .filter((item) => item.id && item.nombre)
        : []
      setSujetosObligados(sujetos)
    } catch (error) {
      console.error("No fue posible leer los sujetos obligados registrados", error)
      setSujetosObligados([])
    }
  }, [])

  useEffect(() => {
    if (sujetosObligados.length === 0) return
    const sujetoActual = sujetosObligados.find((item) => item.rfc === claveSujetoObligado)
    if (sujetoActual && sujetoActual.id !== sujetoObligadoSeleccionado) {
      setSujetoObligadoSeleccionado(sujetoActual.id)
    }
    if (!sujetoObligadoSeleccionado) {
      setSujetoObligadoSeleccionado(sujetoActual?.id ?? sujetosObligados[0]?.id ?? "")
      if (!claveSujetoObligado && sujetosObligados[0]?.rfc) {
        setClaveSujetoObligado(sujetosObligados[0].rfc)
      }
    }
  }, [claveSujetoObligado, sujetoObligadoSeleccionado, sujetosObligados])

  const totalCamposIdentificacion = useMemo(() => {
    const identificacion = IDENTIFICACION_CAMPOS.reduce((acc, grupo) => acc + grupo.campos.length, 0)
    const domicilio = Object.keys(crearDomicilioBase()).length
    const contacto = Object.keys(contactoCliente).length
    const representante = Object.keys(representanteLegal).length
    const identificacionRep = Object.keys(identificacionRepresentante).length
    const inmuebleCampos = Object.keys(inmueble).length
    const ubicacion = Object.keys(crearDomicilioBase()).length
    return identificacion + domicilio + contacto + representante + identificacionRep + inmuebleCampos + ubicacion
  }, [contactoCliente, identificacionRepresentante, inmueble, representanteLegal])
  const camposIdentificacionCompletos = useMemo(() => {
    const identificacionCompleta = IDENTIFICACION_CAMPOS.flatMap((grupo) => grupo.campos).filter((campo) => {
      const valor = datosIdentificacion[campo.id]
      return typeof valor === "string" && valor.trim().length > 0
    }).length
    const domicilioCompleto = Object.values(domicilioCliente).filter((value) => value.trim()).length
    const contactoCompleto = Object.values(contactoCliente).filter((value) => value.trim()).length
    const representanteCompleto = Object.values(representanteLegal).filter((value) => value.trim()).length
    const identificacionRepCompleta = Object.values(identificacionRepresentante).filter((value) => value.trim()).length
    const inmuebleCompleto = Object.values(inmueble).filter((value) => value.trim()).length
    const ubicacionCompleta = Object.values(ubicacionInmueble).filter((value) => value.trim()).length
    return (
      identificacionCompleta +
      domicilioCompleto +
      contactoCompleto +
      representanteCompleto +
      identificacionRepCompleta +
      inmuebleCompleto +
      ubicacionCompleta
    )
  }, [
    contactoCliente,
    datosIdentificacion,
    domicilioCliente,
    identificacionRepresentante,
    inmueble,
    representanteLegal,
    ubicacionInmueble,
  ])

  const documentosCompletos = useMemo(
    () => DOCUMENTACION_REQUERIDA.filter((doc) => documentacionEstado[doc.id] === "completo").length,
    [documentacionEstado],
  )

  const progresoGlobal = useMemo(() => {
    const total = totalCamposIdentificacion + DOCUMENTACION_REQUERIDA.length
    if (total === 0) return 0
    const completados = camposIdentificacionCompletos + documentosCompletos
    return Math.min(100, Math.round((completados / total) * 100))
  }, [
    totalCamposIdentificacion,
    camposIdentificacionCompletos,
    documentosCompletos,
  ])

  const infoDomicilioCliente = useMemo(() => {
    if (domicilioCliente.codigoPostal.length !== 5) return undefined
    return findCodigoPostalInfo(domicilioCliente.codigoPostal)
  }, [domicilioCliente.codigoPostal])

  const coloniasCliente = infoDomicilioCliente?.asentamientos ?? []
  const coloniaClienteSeleccionada = coloniasCliente.includes(domicilioCliente.colonia)
    ? domicilioCliente.colonia
    : coloniasCliente[0] ?? ""

  const infoUbicacionInmueble = useMemo(() => {
    if (ubicacionInmueble.codigoPostal.length !== 5) return undefined
    return findCodigoPostalInfo(ubicacionInmueble.codigoPostal)
  }, [ubicacionInmueble.codigoPostal])

  const coloniasInmueble = infoUbicacionInmueble?.asentamientos ?? []
  const coloniaInmuebleSeleccionada = coloniasInmueble.includes(ubicacionInmueble.colonia)
    ? ubicacionInmueble.colonia
    : coloniasInmueble[0] ?? ""

  const expedientesDisponibles = useMemo(() => {
    const mapa = new Map<string, ExpedienteListadoItem>()
    expedientesResumen.forEach((resumen) => {
      const detalle = expedientesDetalle[resumen.rfc]
      mapa.set(resumen.rfc, {
        ...resumen,
        detalle: detalle ?? null,
        actualizadoEn: detalle?.actualizadoEn,
      })
    })

    Object.values(expedientesDetalle).forEach((detalle) => {
      mapa.set(detalle.rfc, {
        ...buildResumenDesdeDetalle(detalle),
        detalle,
        actualizadoEn: detalle.actualizadoEn,
      })
    })

    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  }, [expedientesDetalle, expedientesResumen])

  const expedientesFiltrados = useMemo(() => {
    const termino = normalizarBusqueda(busquedaExpedientes)
    if (!termino) return expedientesDisponibles
    return expedientesDisponibles.filter((item) =>
      normalizarBusqueda(`${item.nombre} ${item.rfc}`).includes(termino),
    )
  }, [busquedaExpedientes, expedientesDisponibles])

  const paisesFiltrados = useMemo(() => {
    const termino = normalizarBusqueda(busquedaPais)
    if (!termino) return PAISES
    return PAISES.filter((pais) =>
      normalizarBusqueda(`${pais.label} ${pais.code}`).includes(termino),
    )
  }, [busquedaPais])

  const expedienteSeleccionadoInfo = useMemo(
    () =>
      expedienteSeleccionado
        ? expedientesDisponibles.find((item) => item.rfc === expedienteSeleccionado) ?? null
        : null,
    [expedienteSeleccionado, expedientesDisponibles],
  )

  const aplicarDetalleEnFormulario = useCallback(
    (detalle: ExpedienteDetalle) => {
      setNombreExpediente(detalle.nombre ?? detalle.identificacion?.nombre ?? detalle.rfc)
      const fechaBase = detalle.actualizadoEn ? new Date(detalle.actualizadoEn) : null
      const fechaDetalle =
        fechaBase && !Number.isNaN(fechaBase.getTime())
          ? fechaBase.toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10)
      setFechaRegistro(fechaDetalle)
      setTipoExpediente(
        sanitizeTipoExpediente(detalle.tipoExpediente ?? EXPEDIENTE_TIPOS[0]?.value ?? "persona_moral"),
      )
      setTipoCliente(detalle.tipoCliente ?? (CLIENTE_TIPOS[0]?.value ?? ""))
      setDetalleTipoCliente(detalle.detalleTipoCliente ?? "")
      setResponsable(detalle.responsable ?? "")
      setClaveSujetoObligado(detalle.claveSujetoObligado ?? "")
      setClaveActividadVulnerable(detalle.claveActividadVulnerable ?? "")
      setActoOperacion(
        detalle.actoOperacion ?? {
          tipo: "",
          fechaCelebracion: "",
          relacionNegocios: "",
        },
      )
      setDomicilioCliente({ ...crearDomicilioBase(), ...(detalle.domicilioCliente ?? {}) })
      setContactoCliente({
        ladaFijo: "",
        telefonoFijo: "",
        extension: "",
        ladaMovil: "",
        telefonoMovil: "",
        correo: "",
        ...(detalle.contactoCliente ?? {}),
      })
      setRepresentanteLegal({
        nombre: "",
        apellidoPaterno: "",
        apellidoMaterno: "",
        rfc: "",
        puesto: "",
        paisNacionalidad: "MX",
        ...(detalle.representanteLegal ?? {}),
      })
      setIdentificacionRepresentante({
        tipo: "",
        numero: "",
        autoridad: "",
        vigencia: "",
        ...(detalle.identificacionRepresentante ?? {}),
      })
      setInmueble({
        tipo: "",
        valorReferencia: "",
        folioReal: "",
        ...(detalle.inmueble ?? {}),
      })
      setUbicacionInmueble({ ...crearDomicilioBase(), ...(detalle.ubicacionInmueble ?? {}) })
      const identificacion = {
        ...detalle.identificacion,
        nombre: detalle.identificacion?.nombre ?? detalle.nombre ?? "",
        rfc: detalle.identificacion?.rfc ?? detalle.rfc ?? "",
      }
      setDatosIdentificacion(identificacion)
      setDocumentacionEstado({ ...(detalle.documentacion ?? {}) })
      const personas =
        detalle.personas.length > 0
          ? detalle.personas.map((persona) => ({
              ...persona,
              id: persona.id && persona.id.trim().length > 0 ? persona.id : generarIdTemporal(),
            }))
          : [crearPersonaBase()]
      setPersonasReportadas(personas)
      setBusquedasColonias({})
      setBusquedasCiudades({})
      setBusquedaPais("")
    },
    [
      setActoOperacion,
      setClaveActividadVulnerable,
      setClaveSujetoObligado,
      setDatosIdentificacion,
      setDetalleTipoCliente,
      setDocumentacionEstado,
      setDomicilioCliente,
      setFechaRegistro,
      setIdentificacionRepresentante,
      setInmueble,
      setNombreExpediente,
      setContactoCliente,
      setPersonasReportadas,
      setRepresentanteLegal,
      setResponsable,
      setTipoExpediente,
      setTipoCliente,
      setBusquedasColonias,
      setBusquedasCiudades,
      setBusquedaPais,
      setUbicacionInmueble,
    ],
  )

  const aplicarResumenEnFormulario = useCallback(
    (resumen: ExpedienteResumen) => {
      setNombreExpediente(resumen.nombre)
      setTipoCliente(resumen.tipoCliente)
      setDetalleTipoCliente(resumen.detalleTipoCliente ?? "")
      setResponsable("")
      setClaveSujetoObligado("")
      setClaveActividadVulnerable("")
      setDatosIdentificacion({ nombre: resumen.nombre, rfc: resumen.rfc })
      setDatosFiscales({})
      setPerfilOperaciones({})
      setDocumentacionEstado({})
      const base = crearPersonaBase()
      setPersonasReportadas([{ ...base, denominacion: resumen.nombre, rfc: resumen.rfc }])
      setBusquedasColonias({})
      setBusquedasCiudades({})
      setBusquedaPais("")
    },
    [
      setClaveActividadVulnerable,
      setClaveSujetoObligado,
      setDatosFiscales,
      setDatosIdentificacion,
      setDetalleTipoCliente,
      setDocumentacionEstado,
      setNombreExpediente,
      setPerfilOperaciones,
      setPersonasReportadas,
      setResponsable,
      setTipoCliente,
      setBusquedasColonias,
      setBusquedasCiudades,
      setBusquedaPais,
    ],
  )

    const cargarExpediente = useCallback(
      (rfc: string) => {
        const detalle = expedientesDetalle[rfc]
        if (detalle) {
          setExpedienteSeleccionado(rfc)
          aplicarDetalleEnFormulario(detalle)
          return
        }
        const resumen = expedientesResumen.find((item) => item.rfc === rfc)
        if (resumen) {
          setExpedienteSeleccionado(rfc)
          aplicarResumenEnFormulario(resumen)
        }
      },
      [aplicarDetalleEnFormulario, aplicarResumenEnFormulario, expedientesDetalle, expedientesResumen],
    )

    const sincronizarExpedientes = useCallback(() => {
      if (typeof window === "undefined") return

      try {
        const stored = window.localStorage.getItem(CLIENTES_STORAGE_KEY)
        const parsed = stored ? JSON.parse(stored) : []
        const resumen = Array.isArray(parsed)
          ? parsed
              .map((item) => sanitizeClienteResumen(item))
              .filter((item): item is ExpedienteResumen => Boolean(item))
          : []
        setExpedientesResumen(resumen)
      } catch (error) {
        console.error("No fue posible leer el catálogo de clientes guardados", error)
        setExpedientesResumen([])
      }

      try {
        const storedDetalle = window.localStorage.getItem(EXPEDIENTE_DETALLE_STORAGE_KEY)
        const parsedDetalle = storedDetalle ? JSON.parse(storedDetalle) : []
        const mapa = new Map<string, ExpedienteDetalle>()
        if (Array.isArray(parsedDetalle)) {
          parsedDetalle.forEach((item) => {
            const sane = sanitizeExpedienteGuardado(item)
            if (sane) {
              mapa.set(sane.rfc, sane)
            }
          })
        }
        setExpedientesDetalle(Object.fromEntries(mapa) as Record<string, ExpedienteDetalle>)
      } catch (error) {
        console.error("No fue posible leer el detalle de expedientes guardados", error)
        setExpedientesDetalle({})
      }

      setExpedientesCargados(true)
    }, [])

    useEffect(() => {
      if (typeof window === "undefined") return
      sincronizarExpedientes()
      const handler = () => sincronizarExpedientes()
      window.addEventListener("storage", handler)
      return () => window.removeEventListener("storage", handler)
    }, [sincronizarExpedientes])

    useEffect(() => {
      if (!expedienteSeleccionado) return
      const existe = expedientesDisponibles.some((item) => item.rfc === expedienteSeleccionado)
      if (!existe) {
        setExpedienteSeleccionado(null)
      }
    }, [expedienteSeleccionado, expedientesDisponibles])

    const busquedaInicialProcesada = useRef(false)

    useEffect(() => {
      if (busquedaInicialProcesada.current) return
      if (!expedientesCargados) return

      const parametro = searchParams?.get("buscar")?.trim()
      if (!parametro) {
        busquedaInicialProcesada.current = true
        return
      }

      const criterio = normalizarTexto(parametro)
      const coincidencia = expedientesDisponibles.find((item) => {
        const rfcNormalizado = normalizarTexto(item.rfc)
        const nombreNormalizado = normalizarTexto(item.nombre)
        return rfcNormalizado === criterio || (nombreNormalizado && nombreNormalizado === criterio)
      })

      busquedaInicialProcesada.current = true

      if (!coincidencia) {
        toast({
          title: "Cliente no encontrado",
          description: "No se localizó el cliente en los expedientes guardados.",
          variant: "destructive",
        })
        return
      }

      cargarExpediente(coincidencia.rfc)
      toast({
        title: "Expediente recuperado",
        description: "Se cargó la información guardada para " + coincidencia.nombre + ".",
      })
    }, [searchParams, expedientesDisponibles, cargarExpediente, expedientesCargados, toast])

    const hydrateCodigoPostalInfo = useCallback(
      async (personaId: string, codigo: string) => {
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

        setPersonasReportadas((prev) =>
          prev.map((persona) => {
            if (persona.id !== personaId) return persona
            if (persona.domicilio.ambito !== "nacional") return persona
            if (persona.domicilio.codigoPostal !== limpio) return persona
            const colonias = info?.asentamientos ?? []
            return {
              ...persona,
              domicilio: {
                ...persona.domicilio,
                pais: "MX",
                entidad: info?.estado ?? "",
                municipio: info?.municipio ?? "",
                ciudad: info?.ciudad ?? "",
                colonia:
                  colonias.length > 0
                    ? colonias.includes(persona.domicilio.colonia)
                      ? persona.domicilio.colonia
                      : colonias[0]
                    : "",
              },
            }
          }),
        )
      },
      [setPersonasReportadas],
    )

    const handleCodigoPostalChange = useCallback(
      (personaId: string, value: string) => {
        const limpio = value.replace(/[^0-9]/g, "").slice(0, 5)
        setPersonasReportadas((prev) =>
          prev.map((persona) => {
            if (persona.id !== personaId) return persona
            if (persona.domicilio.ambito !== "nacional") {
              return {
                ...persona,
                domicilio: { ...persona.domicilio, codigoPostal: limpio },
              }
            }

            if (limpio.length !== 5) {
              return {
                ...persona,
                domicilio: {
                  ...persona.domicilio,
                  codigoPostal: limpio,
                  pais: "MX",
                  entidad: "",
                  municipio: "",
                  ciudad: "",
                  colonia: "",
                },
              }
            }

            const info = findCodigoPostalInfo(limpio)
            const colonias = info?.asentamientos ?? []

            return {
              ...persona,
              domicilio: {
                ...persona.domicilio,
                codigoPostal: limpio,
                pais: "MX",
                entidad: info?.estado ?? "",
                municipio: info?.municipio ?? "",
                ciudad: info?.ciudad ?? "",
                colonia:
                  colonias.length > 0
                    ? colonias.includes(persona.domicilio.colonia)
                      ? persona.domicilio.colonia
                      : colonias[0]
                    : "",
              },
            }
          }),
        )
        setBusquedasColonias((prev) => ({ ...prev, [personaId]: "" }))
        setBusquedasCiudades((prev) => ({ ...prev, [personaId]: "" }))
        if (limpio.length === 5 && !findCodigoPostalInfo(limpio)) {
          void hydrateCodigoPostalInfo(personaId, limpio)
        }
      },
      [setBusquedasCiudades, setBusquedasColonias, hydrateCodigoPostalInfo],
    )

  const hydrateCodigoPostalCliente = useCallback(
    async (codigo: string, setter: Dispatch<SetStateAction<Domicilio>>) => {
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
    setter((prev) => {
      if (prev.codigoPostal !== limpio) return prev
      const colonias = info?.asentamientos ?? []
      return {
        ...prev,
        pais: "MX",
        entidad: info?.estado ?? "",
        municipio: info?.municipio ?? "",
        ciudad: info?.ciudad ?? "",
        colonia:
          colonias.length > 0 ? (colonias.includes(prev.colonia) ? prev.colonia : colonias[0]) : "",
      }
    })
    },
    [],
  )

  const handleCodigoPostalClienteChange = useCallback(
    (value: string) => {
      const limpio = value.replace(/[^0-9]/g, "").slice(0, 5)
      setDomicilioCliente((prev) => {
        if (limpio.length !== 5) {
          return {
            ...prev,
            codigoPostal: limpio,
            pais: "MX",
            entidad: "",
            municipio: "",
            ciudad: "",
            colonia: "",
          }
        }
        const info = findCodigoPostalInfo(limpio)
        const colonias = info?.asentamientos ?? []
        return {
          ...prev,
          codigoPostal: limpio,
          pais: "MX",
          entidad: info?.estado ?? "",
          municipio: info?.municipio ?? "",
          ciudad: info?.ciudad ?? "",
          colonia: colonias.length > 0 ? (colonias.includes(prev.colonia) ? prev.colonia : colonias[0]) : "",
        }
      })
      if (limpio.length === 5 && !findCodigoPostalInfo(limpio)) {
        void hydrateCodigoPostalCliente(limpio, setDomicilioCliente)
      }
    },
    [hydrateCodigoPostalCliente],
  )

  const handleCodigoPostalInmuebleChange = useCallback(
    (value: string) => {
      const limpio = value.replace(/[^0-9]/g, "").slice(0, 5)
      setUbicacionInmueble((prev) => {
        if (limpio.length !== 5) {
          return {
            ...prev,
            codigoPostal: limpio,
            pais: "MX",
            entidad: "",
            municipio: "",
            ciudad: "",
            colonia: "",
          }
        }
        const info = findCodigoPostalInfo(limpio)
        const colonias = info?.asentamientos ?? []
        return {
          ...prev,
          codigoPostal: limpio,
          pais: "MX",
          entidad: info?.estado ?? "",
          municipio: info?.municipio ?? "",
          ciudad: info?.ciudad ?? "",
          colonia: colonias.length > 0 ? (colonias.includes(prev.colonia) ? prev.colonia : colonias[0]) : "",
        }
      })
      if (limpio.length === 5 && !findCodigoPostalInfo(limpio)) {
        void hydrateCodigoPostalCliente(limpio, setUbicacionInmueble)
      }
    },
    [hydrateCodigoPostalCliente],
  )

  const crearNuevoExpediente = useCallback(() => {
    setExpedienteSeleccionado(null)
    setNombreExpediente("")
    setFechaRegistro(new Date().toISOString().slice(0, 10))
    setTipoExpediente(EXPEDIENTE_TIPOS[0]?.value ?? "persona_moral")
    setTipoCliente(CLIENTE_TIPOS[0]?.value ?? "")
    setDetalleTipoCliente("")
    setResponsable("")
    setClaveSujetoObligado("")
    setClaveActividadVulnerable("")
    setActoOperacion({ tipo: "", fechaCelebracion: "", relacionNegocios: "" })
    setDatosIdentificacion({})
    setDomicilioCliente(crearDomicilioBase())
    setContactoCliente({
      ladaFijo: "",
      telefonoFijo: "",
      extension: "",
      ladaMovil: "",
      telefonoMovil: "",
      correo: "",
    })
    setRepresentanteLegal({
      nombre: "",
      apellidoPaterno: "",
      apellidoMaterno: "",
      rfc: "",
      puesto: "",
      paisNacionalidad: "MX",
    })
    setIdentificacionRepresentante({
      tipo: "",
      numero: "",
      autoridad: "",
      vigencia: "",
    })
    setInmueble({
      tipo: "",
      valorReferencia: "",
      folioReal: "",
    })
    setUbicacionInmueble(crearDomicilioBase())
    setDocumentacionEstado({})
    setPersonasReportadas([crearPersonaBase()])
    setBusquedasColonias({})
    setBusquedasCiudades({})
    setBusquedaPais("")
  }, [])

  const cargarDemoExpedienteFraccionXV = useCallback(() => {
    const demo = demoFraccionXV.expediente

    setNombreExpediente(demo.nombre ?? demo.rfc)
    setFechaRegistro(new Date().toISOString().slice(0, 10))
    setTipoExpediente(EXPEDIENTE_TIPOS[0]?.value ?? "persona_moral")
    setTipoCliente(demo.tipoCliente ?? (CLIENTE_TIPOS[0]?.value ?? ""))
    setDetalleTipoCliente(demo.detalleTipoCliente ?? "")
    setResponsable(demo.responsable ?? "")
    setClaveSujetoObligado(demo.claveSujetoObligado ?? "")
    setClaveActividadVulnerable(demo.claveActividadVulnerable ?? "")
    setActoOperacion({ tipo: "", fechaCelebracion: "", relacionNegocios: "" })
    setDatosIdentificacion(demo.identificacion ?? {})
    setDomicilioCliente(crearDomicilioBase())
    setContactoCliente({
      ladaFijo: "",
      telefonoFijo: "",
      extension: "",
      ladaMovil: "",
      telefonoMovil: "",
      correo: "",
    })
    setRepresentanteLegal({
      nombre: "",
      apellidoPaterno: "",
      apellidoMaterno: "",
      rfc: "",
      puesto: "",
      paisNacionalidad: "MX",
    })
    setIdentificacionRepresentante({
      tipo: "",
      numero: "",
      autoridad: "",
      vigencia: "",
    })
    setInmueble({
      tipo: "",
      valorReferencia: "",
      folioReal: "",
    })
    setUbicacionInmueble(crearDomicilioBase())
    setDocumentacionEstado(demo.documentacion ?? {})
    setBusquedaPais("")
    setBusquedaExpedientes("")

    const personasDemo: PersonaReportada[] = demo.personas.map((personaDemo) => {
      const base = crearPersonaBase()
      const ambito = personaDemo.domicilio?.ambito === "extranjero" ? "extranjero" : "nacional"
      const codigoPostal =
        typeof personaDemo.domicilio?.codigoPostal === "string"
          ? personaDemo.domicilio.codigoPostal.replace(/[^0-9]/g, "").slice(0, 5)
          : ""
      const info = codigoPostal.length === 5 ? findCodigoPostalInfo(codigoPostal) : undefined
      const colonias = info?.asentamientos ?? []

      return {
        ...base,
        id: personaDemo.id ?? generarIdTemporal(),
        tipo: personaDemo.tipo === "persona_fisica" ? "persona_fisica" : "persona_moral",
        denominacion: personaDemo.denominacion ?? base.denominacion,
        fechaConstitucion: personaDemo.fechaConstitucion ?? base.fechaConstitucion,
        rfc: personaDemo.rfc ?? base.rfc,
        curp: personaDemo.curp ?? base.curp,
        pais: personaDemo.pais ?? base.pais,
        giro: personaDemo.giro ?? base.giro,
        rolRelacion: personaDemo.rolRelacion ?? base.rolRelacion,
        representante: {
          ...base.representante,
          nombre: personaDemo.representante?.nombre ?? base.representante.nombre,
          apellidoPaterno:
            personaDemo.representante?.apellidoPaterno ?? base.representante.apellidoPaterno,
          apellidoMaterno:
            personaDemo.representante?.apellidoMaterno ?? base.representante.apellidoMaterno,
          fechaNacimiento:
            personaDemo.representante?.fechaNacimiento ?? base.representante.fechaNacimiento,
          rfc: personaDemo.representante?.rfc ?? base.representante.rfc,
          curp: personaDemo.representante?.curp ?? base.representante.curp,
        },
        domicilio: {
          ...base.domicilio,
          ambito,
          pais: ambito === "extranjero" ? personaDemo.domicilio?.pais ?? base.domicilio.pais : "MX",
          entidad: personaDemo.domicilio?.entidad ?? base.domicilio.entidad,
          municipio: personaDemo.domicilio?.municipio ?? base.domicilio.municipio,
          ciudad: personaDemo.domicilio?.ciudad ?? base.domicilio.ciudad,
          colonia:
            colonias.length > 0
              ? colonias.includes(personaDemo.domicilio?.colonia ?? base.domicilio.colonia)
                ? (personaDemo.domicilio?.colonia as string)
                : colonias[0]
              : personaDemo.domicilio?.colonia ?? base.domicilio.colonia,
          codigoPostal,
          calle: personaDemo.domicilio?.calle ?? base.domicilio.calle,
          numeroExterior: personaDemo.domicilio?.numeroExterior ?? base.domicilio.numeroExterior,
          numeroInterior: personaDemo.domicilio?.numeroInterior ?? base.domicilio.numeroInterior,
        },
        contacto: {
          ...base.contacto,
          conoceTelefono: "si",
          conocePaisTelefono: personaDemo.contacto?.conocePaisTelefono === "no" ? "no" : "si",
          clavePais: personaDemo.contacto?.clavePais ?? base.contacto.clavePais,
          telefono: personaDemo.contacto?.telefono ?? base.contacto.telefono,
          correo: personaDemo.contacto?.correo ?? base.contacto.correo,
        },
        identificacion: {
          ...base.identificacion,
          tipo: personaDemo.identificacion?.tipo ?? base.identificacion.tipo,
          numero: personaDemo.identificacion?.numero ?? base.identificacion.numero,
          pais: personaDemo.identificacion?.pais ?? base.identificacion.pais,
          fechaVencimiento:
            personaDemo.identificacion?.fechaVencimiento ?? base.identificacion.fechaVencimiento,
        },
        participacion: {
          ...base.participacion,
          porcentajeCapital:
            personaDemo.participacion?.porcentajeCapital ?? base.participacion.porcentajeCapital,
          origenRecursos:
            personaDemo.participacion?.origenRecursos ?? base.participacion.origenRecursos,
          esPep: personaDemo.participacion?.esPep === "si" ? "si" : "no",
          detallePep: personaDemo.participacion?.detallePep ?? base.participacion.detallePep,
        },
      }
    })

    setPersonasReportadas(personasDemo)
    setBusquedasColonias({})
    setBusquedasCiudades({})
    setExpedienteSeleccionado(null)

    toast({
      title: "Expediente demo cargado",
      description: "Se llenó un expediente de ejemplo para la Fracción XV de inmuebles.",
    })
  }, [
    setClaveActividadVulnerable,
    setClaveSujetoObligado,
    setDatosFiscales,
    setDatosIdentificacion,
    setDetalleTipoCliente,
    setDocumentacionEstado,
    setNombreExpediente,
    setPerfilOperaciones,
    setPersonasReportadas,
    setResponsable,
    setTipoCliente,
    toast,
  ])

    useEffect(() => {
      if (!tipoClienteSeleccionado?.requiresDetalle) {
        setDetalleTipoCliente("")
        return
    }

    if (tipoClienteSeleccionado.detalleOpciones) {
      setDetalleTipoCliente((prev) => {
        if (tipoClienteSeleccionado.detalleOpciones?.some((option) => option.value === prev)) {
          return prev
        }
        return ""
      })
    }
  }, [tipoClienteSeleccionado])

  

  const actualizarPersonaReportada = (id: string, updater: (persona: PersonaReportada) => PersonaReportada) => {
    setPersonasReportadas((prev) => prev.map((persona) => (persona.id === id ? updater(persona) : persona)))
  }

  const agregarPersonaReportada = () => {
    const nuevaPersona = crearPersonaBase()
    setPersonasReportadas((prev) => [...prev, nuevaPersona])
    setBusquedasColonias((prev) => ({ ...prev, [nuevaPersona.id]: "" }))
    setBusquedasCiudades((prev) => ({ ...prev, [nuevaPersona.id]: "" }))
    toast({
      title: "Persona añadida",
      description: "Se agregó un nuevo registro para documentar otra persona relacionada.",
    })
  }

  const eliminarPersonaReportada = (id: string) => {
    if (personasReportadas.length <= 1) {
      toast({
        title: "Acción no disponible",
        description: "Debes conservar al menos una persona registrada en el expediente.",
        variant: "destructive",
      })
      return
    }

    setPersonasReportadas((prev) => prev.filter((persona) => persona.id !== id))
    setBusquedasColonias((prev) => {
      if (!(id in prev)) return prev
      const { [id]: _omit, ...rest } = prev
      return rest
    })
    setBusquedasCiudades((prev) => {
      if (!(id in prev)) return prev
      const { [id]: _omit, ...rest } = prev
      return rest
    })
    toast({
      title: "Persona eliminada",
      description: "Se retiró la persona del expediente único.",
    })
  }

  const guardarExpediente = () => {
    if (typeof window === "undefined") return

    const nombre = datosIdentificacion.nombre?.trim()
    const rfc = datosIdentificacion.rfc?.trim().toUpperCase()

    if (!nombre || !rfc) {
      toast({
        title: "Información incompleta",
        description: "Captura al menos el nombre o razón social y el RFC para guardar el expediente.",
        variant: "destructive",
      })
      return
    }

    try {
      const tipoNormalizado = sanitizeTipoCliente(tipoCliente)
      const resumenCliente = {
        rfc,
        nombre,
        tipoCliente: tipoNormalizado,
        detalleTipoCliente,
      }

      const almacenActual = window.localStorage.getItem(CLIENTES_STORAGE_KEY)
      let listado: any[] = []
      if (almacenActual) {
        try {
          const parsed = JSON.parse(almacenActual)
          if (Array.isArray(parsed)) {
            listado = parsed
          }
        } catch (error) {
          console.warn("No fue posible leer el catálogo de clientes guardados", error)
        }
      }

      const mapa = new Map<string, any>()
      listado.forEach((item) => {
        if (item && typeof item === "object" && typeof item.rfc === "string") {
          mapa.set(item.rfc, item)
        }
      })
      mapa.set(rfc, { ...(mapa.get(rfc) ?? {}), ...resumenCliente })
      window.localStorage.setItem(CLIENTES_STORAGE_KEY, JSON.stringify(Array.from(mapa.values())))

      const personasSanitizadas = personasReportadas
        .map((persona) => sanitizePersonaGuardada(persona))
        .filter((persona): persona is PersonaReportada => Boolean(persona))

      const detalleExpediente = {
        ...resumenCliente,
        tipoExpediente: sanitizeTipoExpediente(tipoExpediente),
        responsable,
        claveSujetoObligado,
        claveActividadVulnerable,
        actoOperacion,
        domicilioCliente: { ...domicilioCliente },
        contactoCliente: { ...contactoCliente },
        representanteLegal: { ...representanteLegal },
        identificacionRepresentante: { ...identificacionRepresentante },
        inmueble: { ...inmueble },
        ubicacionInmueble: { ...ubicacionInmueble },
        identificacion: { ...datosIdentificacion, nombre, rfc },
        documentacion: { ...documentacionEstado },
        personas: personasSanitizadas,
        actualizadoEn: new Date().toISOString(),
      }

      const detalleActual = window.localStorage.getItem(EXPEDIENTE_DETALLE_STORAGE_KEY)
      let expedientes: any[] = []
      if (detalleActual) {
        try {
          const parsed = JSON.parse(detalleActual)
          if (Array.isArray(parsed)) expedientes = parsed
        } catch (error) {
          console.warn("No fue posible leer el detalle de expedientes guardados", error)
        }
      }

      const indiceExistente = expedientes.findIndex(
        (item) => item && typeof item === "object" && typeof item.rfc === "string" && item.rfc === rfc,
      )
      if (indiceExistente >= 0) {
        expedientes[indiceExistente] = { ...expedientes[indiceExistente], ...detalleExpediente }
      } else {
        expedientes.push(detalleExpediente)
      }

      window.localStorage.setItem(EXPEDIENTE_DETALLE_STORAGE_KEY, JSON.stringify(expedientes))

      const detalleSanitizado = sanitizeExpedienteGuardado(detalleExpediente)
      if (detalleSanitizado) {
        setExpedientesDetalle((prev) => ({ ...prev, [detalleSanitizado.rfc]: detalleSanitizado }))
        setExpedientesResumen((prev) => {
          const sinActual = prev.filter((item) => item.rfc !== detalleSanitizado.rfc)
          const actualizado = buildResumenDesdeDetalle(detalleSanitizado)
          return [...sinActual, actualizado].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
        })
        setExpedientesCargados(true)
        setExpedienteSeleccionado(detalleSanitizado.rfc)
        aplicarDetalleEnFormulario(detalleSanitizado)
      }

      toast({
        title: "Expediente guardado",
        description: "La información quedó disponible para prellenar avisos en actividades vulnerables.",
      })
    } catch (error) {
      console.error("Error al guardar el expediente", error)
      toast({
        title: "No fue posible guardar",
        description: "Intenta nuevamente o revisa los permisos de almacenamiento del navegador.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <Card className="border-slate-200 bg-emerald-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-emerald-700" /> Expedientes guardados
          </CardTitle>
          <CardDescription>
            Consulta, sincroniza y reutiliza expedientes ya capturados para acelerar los avisos de actividades vulnerables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_auto] md:items-end">
            <div className="space-y-2">
              <Label>Consultar expediente almacenado</Label>
              <Select
                value={expedienteSeleccionado ?? undefined}
                onValueChange={(value) => cargarExpediente(value)}
                disabled={expedientesDisponibles.length === 0}
                onOpenChange={(open) => {
                  if (open) {
                    setBusquedaExpedientes("")
                  }
                }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecciona un expediente" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      autoFocus
                      placeholder="Buscar expediente..."
                      value={busquedaExpedientes}
                      onChange={(event) => setBusquedaExpedientes(event.target.value)}
                    />
                  </div>
                  {expedientesFiltrados.length > 0 ? (
                    expedientesFiltrados.map((item) => (
                      <SelectItem key={item.rfc} value={item.rfc}>
                        {item.nombre} – {item.rfc}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Button type="button" variant="outline" onClick={crearNuevoExpediente}>
                Crear nuevo expediente
              </Button>
              <Button type="button" variant="ghost" onClick={sincronizarExpedientes}>
                Actualizar lista
              </Button>
            </div>
          </div>

          {expedienteSeleccionadoInfo && (
            <div className="rounded border border-emerald-200 bg-white/70 p-4 text-sm">
              <p className="font-semibold text-emerald-900">{expedienteSeleccionadoInfo.nombre}</p>
              <p className="text-xs text-emerald-700">{expedienteSeleccionadoInfo.rfc}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {expedienteSeleccionadoInfo.tipoCliente && (
                  <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                    {findClienteTipoLabel(expedienteSeleccionadoInfo.tipoCliente)}
                  </Badge>
                )}
                {expedienteSeleccionadoInfo.detalleTipoCliente && (
                  <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                    {expedienteSeleccionadoInfo.detalleTipoCliente}
                  </Badge>
                )}
                {formatearFechaActualizacion(expedienteSeleccionadoInfo.actualizadoEn) && (
                  <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                    Actualizado {formatearFechaActualizacion(expedienteSeleccionadoInfo.actualizadoEn)}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {expedientesDisponibles.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="max-w-sm"
                  placeholder="Buscar en expedientes guardados..."
                  value={busquedaExpedientes}
                  onChange={(event) => setBusquedaExpedientes(event.target.value)}
                />
                {busquedaExpedientes && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setBusquedaExpedientes("")}>
                    Limpiar
                  </Button>
                )}
              </div>
              <ScrollArea className="h-52 rounded border border-slate-200 bg-white">
                <div className="divide-y divide-slate-200">
                  {expedientesFiltrados.map((item) => {
                    const seleccionado = item.rfc === expedienteSeleccionado
                    const actualizado = formatearFechaActualizacion(item.actualizadoEn)
                    return (
                      <button
                        key={item.rfc}
                        type="button"
                        onClick={() => cargarExpediente(item.rfc)}
                        className={`flex w-full flex-col gap-1 p-3 text-left transition ${
                          seleccionado ? "bg-emerald-100/60" : "hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-700">{item.nombre}</p>
                            <p className="text-xs text-slate-500">{item.rfc}</p>
                          </div>
                          {actualizado && (
                            <span className="text-[11px] text-slate-500">{actualizado}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.tipoCliente && (
                            <Badge variant="outline" className="border-slate-200">
                              {findClienteTipoLabel(item.tipoCliente)}
                            </Badge>
                          )}
                          {item.detalleTipoCliente && (
                            <Badge variant="outline" className="border-slate-200">
                              {item.detalleTipoCliente}
                            </Badge>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Aún no se han guardado expedientes desde este módulo. Captura los datos y utiliza el botón "Guardar" para
              sincronizarlos con actividades vulnerables.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-slate-600" /> Domicilio del cliente
          </CardTitle>
          <CardDescription>Captura el domicilio base y permite el autollenado por código postal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Código Postal</Label>
              <Input
                value={domicilioCliente.codigoPostal}
                onChange={(event) => handleCodigoPostalClienteChange(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Vialidad</Label>
              <Select
                value={domicilioCliente.tipoVialidad}
                onValueChange={(value) => setDomicilioCliente((prev) => ({ ...prev, tipoVialidad: value }))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_VIALIDAD_OPCIONES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre de la Vialidad</Label>
              <Input
                value={domicilioCliente.nombreVialidad}
                onChange={(event) => setDomicilioCliente((prev) => ({ ...prev, nombreVialidad: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Número Exterior</Label>
              <Input
                value={domicilioCliente.numeroExterior}
                onChange={(event) => setDomicilioCliente((prev) => ({ ...prev, numeroExterior: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Número Interior</Label>
              <Input
                value={domicilioCliente.numeroInterior}
                onChange={(event) => setDomicilioCliente((prev) => ({ ...prev, numeroInterior: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Colonia / Urbanización</Label>
              <Select
                value={coloniaClienteSeleccionada}
                onValueChange={(value) => setDomicilioCliente((prev) => ({ ...prev, colonia: value }))}
                disabled={coloniasCliente.length === 0}
              >
                <SelectTrigger className="bg-white" disabled={coloniasCliente.length === 0}>
                  <SelectValue placeholder="Selecciona la colonia" />
                </SelectTrigger>
                <SelectContent>
                  {coloniasCliente.length > 0 ? (
                    coloniasCliente.map((colonia) => (
                      <SelectItem key={colonia} value={colonia}>
                        {colonia}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Captura un código postal válido</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Alcaldía / Municipio / Demarcación</Label>
              <Input value={domicilioCliente.municipio} readOnly className="bg-slate-50" />
            </div>
            <div className="space-y-2">
              <Label>Ciudad o Población</Label>
              <Input value={domicilioCliente.ciudad} readOnly className="bg-slate-50" />
            </div>
            <div className="space-y-2">
              <Label>Entidad, Estado, Provincia</Label>
              <Input value={domicilioCliente.entidad} readOnly className="bg-slate-50" />
            </div>
            <div className="space-y-2">
              <Label>País</Label>
              <Input value={domicilioCliente.pais} readOnly className="bg-slate-50" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-slate-600" /> Datos de contacto del cliente
          </CardTitle>
          <CardDescription>Captura los teléfonos y correo electrónico del cliente.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Lada</Label>
            <Input
              value={contactoCliente.ladaFijo}
              onChange={(event) => setContactoCliente((prev) => ({ ...prev, ladaFijo: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Número Telefónico (Fijo)</Label>
            <Input
              value={contactoCliente.telefonoFijo}
              onChange={(event) => setContactoCliente((prev) => ({ ...prev, telefonoFijo: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Extensión (en su caso)</Label>
            <Input
              value={contactoCliente.extension}
              onChange={(event) => setContactoCliente((prev) => ({ ...prev, extension: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Lada (móvil)</Label>
            <Input
              value={contactoCliente.ladaMovil}
              onChange={(event) => setContactoCliente((prev) => ({ ...prev, ladaMovil: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Número Telefónico (Móvil)</Label>
            <Input
              value={contactoCliente.telefonoMovil}
              onChange={(event) => setContactoCliente((prev) => ({ ...prev, telefonoMovil: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Correo electrónico</Label>
            <Input
              type="email"
              value={contactoCliente.correo}
              onChange={(event) => setContactoCliente((prev) => ({ ...prev, correo: event.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-slate-600" /> Datos del representante o apoderado legal
          </CardTitle>
          <CardDescription>Completa esta sección si el cliente actúa mediante representante.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nombre(s) (sin abreviaturas)</Label>
            <Input
              value={representanteLegal.nombre}
              onChange={(event) => setRepresentanteLegal((prev) => ({ ...prev, nombre: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Apellido paterno</Label>
            <Input
              value={representanteLegal.apellidoPaterno}
              onChange={(event) =>
                setRepresentanteLegal((prev) => ({ ...prev, apellidoPaterno: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Apellido materno</Label>
            <Input
              value={representanteLegal.apellidoMaterno}
              onChange={(event) =>
                setRepresentanteLegal((prev) => ({ ...prev, apellidoMaterno: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Registro Federal de Contribuyentes / NIF</Label>
            <Input
              value={representanteLegal.rfc}
              onChange={(event) =>
                setRepresentanteLegal((prev) => ({ ...prev, rfc: event.target.value.toUpperCase() }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Puesto o Cargo</Label>
            <Input
              value={representanteLegal.puesto}
              onChange={(event) => setRepresentanteLegal((prev) => ({ ...prev, puesto: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>País de Nacionalidad</Label>
            <Select
              value={findPaisByCodigo(representanteLegal.paisNacionalidad)?.code ?? representanteLegal.paisNacionalidad}
              onValueChange={(nuevoPais) => setRepresentanteLegal((prev) => ({ ...prev, paisNacionalidad: nuevoPais }))}
              onOpenChange={(open) => {
                if (open) setBusquedaPais("")
              }}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Selecciona país" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <Input
                    autoFocus
                    placeholder="Buscar país..."
                    value={busquedaPais}
                    onChange={(event) => setBusquedaPais(event.target.value)}
                  />
                </div>
                {paisesFiltrados.length > 0 ? (
                  paisesFiltrados.map((pais) => (
                    <SelectItem key={pais.code} value={pais.code}>
                      {pais.label}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias</div>
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-600" /> Identificación del representante
          </CardTitle>
          <CardDescription>Datos de la identificación presentada por el representante o apoderado legal.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de identificación</Label>
            <Select
              value={identificacionRepresentante.tipo}
              onValueChange={(value) => setIdentificacionRepresentante((prev) => ({ ...prev, tipo: value }))}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Selecciona el tipo" />
              </SelectTrigger>
              <SelectContent>
                {IDENTIFICACION_TIPOS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Número de identificación</Label>
            <Input
              value={identificacionRepresentante.numero}
              onChange={(event) =>
                setIdentificacionRepresentante((prev) => ({ ...prev, numero: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Autoridad que emite la identificación</Label>
            <Input
              value={identificacionRepresentante.autoridad}
              onChange={(event) =>
                setIdentificacionRepresentante((prev) => ({ ...prev, autoridad: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Fecha de vigencia</Label>
            <Input
              type="date"
              value={identificacionRepresentante.vigencia}
              onChange={(event) =>
                setIdentificacionRepresentante((prev) => ({ ...prev, vigencia: event.target.value }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-600" /> Características del inmueble
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de Inmueble</Label>
            <Select value={inmueble.tipo} onValueChange={(value) => setInmueble((prev) => ({ ...prev, tipo: value }))}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Selecciona el tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPO_INMUEBLE_OPCIONES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor de Referencia</Label>
            <Input
              value={inmueble.valorReferencia}
              onChange={(event) => setInmueble((prev) => ({ ...prev, valorReferencia: event.target.value }))}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Folio Real o Antecedentes Registrales</Label>
            <Input
              value={inmueble.folioReal}
              onChange={(event) => setInmueble((prev) => ({ ...prev, folioReal: event.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-slate-600" /> Ubicación del inmueble
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Código Postal</Label>
              <Input
                value={ubicacionInmueble.codigoPostal}
                onChange={(event) => handleCodigoPostalInmuebleChange(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Vialidad</Label>
              <Select
                value={ubicacionInmueble.tipoVialidad}
                onValueChange={(value) => setUbicacionInmueble((prev) => ({ ...prev, tipoVialidad: value }))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_VIALIDAD_OPCIONES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre de la Vialidad</Label>
              <Input
                value={ubicacionInmueble.nombreVialidad}
                onChange={(event) =>
                  setUbicacionInmueble((prev) => ({ ...prev, nombreVialidad: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Número Exterior</Label>
              <Input
                value={ubicacionInmueble.numeroExterior}
                onChange={(event) =>
                  setUbicacionInmueble((prev) => ({ ...prev, numeroExterior: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Número Interior</Label>
              <Input
                value={ubicacionInmueble.numeroInterior}
                onChange={(event) =>
                  setUbicacionInmueble((prev) => ({ ...prev, numeroInterior: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Colonia / Urbanización</Label>
              <Select
                value={coloniaInmuebleSeleccionada}
                onValueChange={(value) => setUbicacionInmueble((prev) => ({ ...prev, colonia: value }))}
                disabled={coloniasInmueble.length === 0}
              >
                <SelectTrigger className="bg-white" disabled={coloniasInmueble.length === 0}>
                  <SelectValue placeholder="Selecciona la colonia" />
                </SelectTrigger>
                <SelectContent>
                  {coloniasInmueble.length > 0 ? (
                    coloniasInmueble.map((colonia) => (
                      <SelectItem key={colonia} value={colonia}>
                        {colonia}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Captura un código postal válido</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Alcaldía / Municipio / Demarcación</Label>
              <Input value={ubicacionInmueble.municipio} readOnly className="bg-slate-50" />
            </div>
            <div className="space-y-2">
              <Label>Ciudad o Población</Label>
              <Input value={ubicacionInmueble.ciudad} readOnly className="bg-slate-50" />
            </div>
            <div className="space-y-2">
              <Label>Entidad, Estado, Provincia</Label>
              <Input value={ubicacionInmueble.entidad} readOnly className="bg-slate-50" />
            </div>
            <div className="space-y-2">
              <Label>País</Label>
              <Input value={ubicacionInmueble.pais} readOnly className="bg-slate-50" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-600" /> Expediente único de identificación
            </CardTitle>
            <CardDescription>
              Centraliza todos los datos y documentos del cliente para que los avisos se prellenan automáticamente al
              registrarlo en actividades vulnerables.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={cargarDemoExpedienteFraccionXV}>
              Cargar demo Fracción XV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre del expediente</Label>
              <Input value={nombreExpediente} onChange={(event) => setNombreExpediente(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Responsable del expediente</Label>
              <Input value={responsable} onChange={(event) => setResponsable(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fecha de registro / actualización</Label>
              <Input type="date" value={fechaRegistro} readOnly className="bg-slate-50" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de expediente</Label>
              <Select value={tipoExpediente} onValueChange={setTipoExpediente}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecciona el tipo de expediente" />
                </SelectTrigger>
                <SelectContent>
                  {EXPEDIENTE_TIPOS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sujeto obligado</Label>
              <Select
                value={sujetoObligadoSeleccionado}
                onValueChange={(value) => {
                  setSujetoObligadoSeleccionado(value)
                  const seleccionado = sujetosObligados.find((item) => item.id === value)
                  setClaveSujetoObligado(seleccionado?.rfc ?? "")
                }}
                disabled={sujetosObligados.length === 0}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecciona un sujeto obligado" />
                </SelectTrigger>
                <SelectContent>
                  {sujetosObligados.length > 0 ? (
                    sujetosObligados.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.nombre}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Sin sujetos obligados registrados.
                    </div>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Se conecta con el sujeto obligado registrado en el módulo de alta.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Clave de sujeto obligado</Label>
              <Input value={claveSujetoObligado} onChange={(event) => setClaveSujetoObligado(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Clave de actividad vulnerable</Label>
              <Input
                value={claveActividadVulnerable}
                onChange={(event) => setClaveActividadVulnerable(event.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Resumen de avance del expediente</p>
                <p className="text-xs text-slate-500">Tipo de cliente: {tipoClienteResumen}</p>
              </div>
              <Badge variant="outline" className="bg-white text-xs font-semibold">
                {progresoGlobal}% completado
              </Badge>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="relative h-2 w-full max-w-xs overflow-hidden rounded bg-slate-200">
                <div
                  className="absolute inset-y-0 left-0 rounded bg-emerald-500 transition-all"
                  style={{ width: `${progresoGlobal}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="bg-white">
                  Identificación {camposIdentificacionCompletos}/{totalCamposIdentificacion}
                </Badge>
                <Badge variant="outline" className="bg-white">
                  Documentación {documentosCompletos}/{DOCUMENTACION_REQUERIDA.length}
                </Badge>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Guarda el expediente cuando actualices datos clave para mantenerlos disponibles al momento de preparar un
              aviso ante la autoridad.
            </p>
            <div className="mt-4 flex justify-end">
              <Button onClick={guardarExpediente}>Guardar expediente</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-600" /> Acto u operación realizada con el cliente
          </CardTitle>
          <CardDescription>Registra los datos clave del acto u operación para el expediente.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de Acto u Operación</Label>
            <Select
              value={actoOperacion.tipo}
              onValueChange={(value) => setActoOperacion((prev) => ({ ...prev, tipo: value }))}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Selecciona el tipo de acto" />
              </SelectTrigger>
              <SelectContent>
                {ACTO_OPERACION_OPCIONES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fecha de celebración del Acto u Operación</Label>
            <Input
              type="date"
              value={actoOperacion.fechaCelebracion}
              onChange={(event) =>
                setActoOperacion((prev) => ({ ...prev, fechaCelebracion: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>¿Existe Relación de Negocios?</Label>
            <Select
              value={actoOperacion.relacionNegocios}
              onValueChange={(value) =>
                setActoOperacion((prev) => ({ ...prev, relacionNegocios: value as RespuestaBinaria }))
              }
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Selecciona una opción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="si">Sí</SelectItem>
                <SelectItem value="no">No</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 text-xs text-muted-foreground">
            Si existe relación de negocios, considera el expediente activo para seguimiento continuo.
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-slate-600" /> Identificación del cliente
          </CardTitle>
          <CardDescription>
            Registra la información oficial y los documentos soporte necesarios para acreditar la identidad del cliente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de Cliente con quien se realiza el Acto u Operación</Label>
              <Select value={tipoCliente} onValueChange={(value) => setTipoCliente(value)}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecciona tipo de cliente" />
                </SelectTrigger>
                <SelectContent>
                  {CLIENTE_TIPOS.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tipoClienteSeleccionado?.requiresDetalle && (
              <div className="space-y-2">
                <Label>{tipoClienteSeleccionado.detalleLabel ?? "Detalle del tipo de cliente"}</Label>
                {tipoClienteSeleccionado.detalleOpciones ? (
                  <Select value={detalleTipoCliente} onValueChange={setDetalleTipoCliente}>
                    <SelectTrigger className="bg-white">
                      <SelectValue
                        placeholder={
                          tipoClienteSeleccionado.detallePlaceholder ?? "Selecciona la opción que corresponda"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {tipoClienteSeleccionado.detalleOpciones.map((detalle) => (
                        <SelectItem key={detalle.value} value={detalle.value}>
                          {detalle.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={detalleTipoCliente}
                    onChange={(event) => setDetalleTipoCliente(event.target.value)}
                    placeholder={tipoClienteSeleccionado.detallePlaceholder ?? "Describe la entidad o figura jurídica"}
                  />
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {IDENTIFICACION_CAMPOS.map((grupo) => (
              <div key={grupo.id} className="space-y-3 rounded border bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-700">{grupo.titulo}</p>
                  <Badge variant="outline" className="text-xs">
                    {
                      grupo.campos.filter((campo) => datosIdentificacion[campo.id]?.trim()).length
                    }/{grupo.campos.length}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">{grupo.descripcion}</p>
                <div className="space-y-3">
                  {grupo.campos.map((campo) => {
                    const value = datosIdentificacion[campo.id] ?? ""
                    const onChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                      let nuevoValor = event.target.value
                      if (campo.id === "rfc" || campo.id === "curp") {
                        nuevoValor = nuevoValor.toUpperCase()
                      }
                      setDatosIdentificacion((prev) => ({ ...prev, [campo.id]: nuevoValor }))
                      if (campo.id === "nombre") {
                        setNombreExpediente(nuevoValor)
                      }
                    }

                    return (
                      <div key={campo.id} className="space-y-1 text-sm">
                        <Label className="flex items-center justify-between text-xs font-semibold uppercase text-slate-600">
                          {campo.label}
                          {campo.requerido && <span className="text-rose-500">*</span>}
                        </Label>
                        {campo.id === "pais-nacionalidad" ? (
                          <Select
                            value={value}
                            onValueChange={(nuevoValor) =>
                              setDatosIdentificacion((prev) => ({ ...prev, [campo.id]: nuevoValor }))
                            }
                            onOpenChange={(open) => {
                              if (open) setBusquedaPais("")
                            }}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Selecciona país" />
                            </SelectTrigger>
                            <SelectContent>
                              <div className="p-2">
                                <Input
                                  autoFocus
                                  placeholder="Buscar país..."
                                  value={busquedaPais}
                                  onChange={(event) => setBusquedaPais(event.target.value)}
                                />
                              </div>
                              {paisesFiltrados.length > 0 ? (
                                paisesFiltrados.map((pais) => (
                                  <SelectItem key={pais.code} value={pais.label}>
                                    {pais.label}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias</div>
                              )}
                            </SelectContent>
                          </Select>
                        ) : campo.multiline ? (
                          <Textarea
                            value={value}
                            onChange={onChange}
                            placeholder={campo.placeholder ?? "Captura la información"}
                            rows={3}
                          />
                        ) : (
                          <Input
                            type={campo.type ?? "text"}
                            value={value}
                            onChange={onChange}
                            placeholder={campo.placeholder ?? ""}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-600" /> Beneficiarios controladores
          </CardTitle>
          <CardDescription>
            Registra la información del beneficiario controlador (1) y agrega un segundo beneficiario si aplica.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {personasReportadas.map((persona, index) => {
            const paisPersonaOption = findPaisByCodigo(persona.pais) ?? findPaisByNombre(persona.pais)
            const paisDomicilioOption =
              findPaisByCodigo(persona.domicilio.pais) ?? findPaisByNombre(persona.domicilio.pais)
            const paisIdentificacionOption =
              findPaisByCodigo(persona.identificacion.pais) ?? findPaisByNombre(persona.identificacion.pais)
            const paisContactoOption =
              findPaisByCodigo(persona.contacto.clavePais) ?? findPaisByNombre(persona.contacto.clavePais)
            const infoCodigoPostal =
              persona.domicilio.ambito === "nacional" && persona.domicilio.codigoPostal.length === 5
                ? findCodigoPostalInfo(persona.domicilio.codigoPostal)
                : undefined
            const coloniasDisponibles = infoCodigoPostal?.asentamientos ?? []
            const busquedaColonia = busquedasColonias[persona.id] ?? ""
            const terminoColonia = normalizarBusqueda(busquedaColonia)
            let coloniasFiltradas =
              terminoColonia
                ? coloniasDisponibles.filter((colonia) =>
                    normalizarBusqueda(colonia).includes(terminoColonia),
                  )
                : coloniasDisponibles
            if (
              persona.domicilio.colonia &&
              coloniasDisponibles.includes(persona.domicilio.colonia) &&
              !coloniasFiltradas.includes(persona.domicilio.colonia)
            ) {
              coloniasFiltradas = [persona.domicilio.colonia, ...coloniasFiltradas]
            }
            coloniasFiltradas = Array.from(new Set(coloniasFiltradas))
            const coloniaSeleccionada = coloniasDisponibles.includes(persona.domicilio.colonia)
              ? persona.domicilio.colonia
              : coloniasDisponibles[0] ?? ""
            const busquedaCiudad = busquedasCiudades[persona.id] ?? ""
            const terminoCiudad = normalizarBusqueda(busquedaCiudad)
            const mostrarCiudadesMexico =
              persona.domicilio.ambito === "nacional" && persona.domicilio.pais === "MX"
            let ciudadesFiltradas: string[] = []
            if (mostrarCiudadesMexico) {
              ciudadesFiltradas = terminoCiudad
                ? CIUDADES_MEXICO.filter((ciudad) =>
                    normalizarBusqueda(ciudad).includes(terminoCiudad),
                  )
                : CIUDADES_MEXICO
              if (persona.domicilio.ciudad && !ciudadesFiltradas.includes(persona.domicilio.ciudad)) {
                ciudadesFiltradas = [persona.domicilio.ciudad, ...ciudadesFiltradas]
              }
              ciudadesFiltradas = Array.from(new Set(ciudadesFiltradas))
            }

            return (
              <div key={persona.id} className="space-y-6 rounded border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-700">Beneficiario controlador {index + 1}</span>
                  <span className="text-xs text-slate-500">Datos de identificación</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => eliminarPersonaReportada(persona.id)}
                  className="text-rose-500 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre(s) (sin abreviaturas)</Label>
                  <Input
                    value={persona.denominacion}
                    onChange={(event) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        denominacion: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Apellido paterno</Label>
                  <Input
                    value={persona.apellidoPaterno}
                    onChange={(event) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        apellidoPaterno: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Apellido materno</Label>
                  <Input
                    value={persona.apellidoMaterno}
                    onChange={(event) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        apellidoMaterno: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de nacimiento</Label>
                  <Input
                    type="date"
                    value={persona.fechaConstitucion}
                    onChange={(event) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        fechaConstitucion: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>País de nacionalidad</Label>
                  <Select
                    value={paisPersonaOption?.code ?? persona.pais}
                    onValueChange={(nuevoPais) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        pais: nuevoPais,
                      }))
                    }
                    onOpenChange={(open) => {
                      if (open) setBusquedaPais("")
                    }}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Selecciona país" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-2">
                        <Input
                          autoFocus
                          placeholder="Buscar país..."
                          value={busquedaPais}
                          onChange={(event) => setBusquedaPais(event.target.value)}
                        />
                      </div>
                      {paisesFiltrados.length > 0 ? (
                        paisesFiltrados.map((pais) => (
                          <SelectItem key={pais.code} value={pais.code}>
                            {pais.label}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>País de nacimiento</Label>
                  <Select
                    value={findPaisByCodigo(persona.paisNacimiento)?.code ?? persona.paisNacimiento}
                    onValueChange={(nuevoPais) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        paisNacimiento: nuevoPais,
                      }))
                    }
                    onOpenChange={(open) => {
                      if (open) setBusquedaPais("")
                    }}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Selecciona país" />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="p-2">
                        <Input
                          autoFocus
                          placeholder="Buscar país..."
                          value={busquedaPais}
                          onChange={(event) => setBusquedaPais(event.target.value)}
                        />
                      </div>
                      {paisesFiltrados.length > 0 ? (
                        paisesFiltrados.map((pais) => (
                          <SelectItem key={pais.code} value={pais.code}>
                            {pais.label}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>CURP o equivalente</Label>
                  <Input
                    value={persona.curp}
                    onChange={(event) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        curp: event.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>RFC / NIF</Label>
                  <Input
                    value={persona.rfc}
                    onChange={(event) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        rfc: event.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Porcentaje de participación</Label>
                  <Input
                    value={persona.participacion.porcentajeCapital}
                    onChange={(event) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        participacion: { ...prev.participacion, porcentajeCapital: event.target.value },
                      }))
                    }
                    placeholder="Ej. 25%"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <MapPin className="h-4 w-4" /> Domicilio de la persona
                </div>
                <div className="flex flex-wrap gap-2">
                  {DOMICILIO_TIPOS.map((opcion) => (
                    <Button
                      key={opcion.value}
                      type="button"
                      variant={persona.domicilio.ambito === opcion.value ? "default" : "outline"}
                      onClick={() => {
                        if (persona.domicilio.ambito === opcion.value) return
                        setBusquedasColonias((prev) => ({ ...prev, [persona.id]: "" }))
                        setBusquedasCiudades((prev) => ({ ...prev, [persona.id]: "" }))
                        actualizarPersonaReportada(persona.id, (prev) => {
                          const esNacional = opcion.value === "nacional"
                          return {
                            ...prev,
                            domicilio: {
                              ...prev.domicilio,
                              ambito: opcion.value,
                              pais: esNacional
                                ? "MX"
                                : prev.domicilio.pais === "MX"
                                  ? ""
                                  : prev.domicilio.pais,
                              codigoPostal: "",
                              entidad: "",
                              municipio: "",
                              ciudad: "",
                              colonia: "",
                            },
                          }
                        })
                      }}
                    >
                      {opcion.label}
                    </Button>
                  ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>País</Label>
                    <Select
                      value={paisDomicilioOption?.code ?? persona.domicilio.pais}
                      onValueChange={(nuevoPais) => {
                        setBusquedasColonias((prev) => ({ ...prev, [persona.id]: "" }))
                        setBusquedasCiudades((prev) => ({ ...prev, [persona.id]: "" }))
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          domicilio: {
                            ...prev.domicilio,
                            pais: nuevoPais,
                            codigoPostal: "",
                            entidad: "",
                            municipio: "",
                            ciudad: "",
                            colonia: "",
                          },
                        }))
                      }}
                      disabled={persona.domicilio.ambito === "nacional"}
                      onOpenChange={(open) => {
                        if (open) setBusquedaPais("")
                      }}
                    >
                      <SelectTrigger className="bg-white" disabled={persona.domicilio.ambito === "nacional"}>
                        <SelectValue placeholder="Selecciona país" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <Input
                            autoFocus
                            placeholder="Buscar país..."
                            value={busquedaPais}
                            onChange={(event) => setBusquedaPais(event.target.value)}
                          />
                        </div>
                        {paisesFiltrados.length > 0 ? (
                          paisesFiltrados.map((pais) => (
                            <SelectItem key={pais.code} value={pais.code}>
                              {pais.label}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Entidad federativa / Estado</Label>
                    <Input
                      value={persona.domicilio.entidad}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          domicilio: { ...prev.domicilio, entidad: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Municipio o delegación</Label>
                    <Input
                      value={persona.domicilio.municipio}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          domicilio: { ...prev.domicilio, municipio: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ciudad</Label>
                    {mostrarCiudadesMexico ? (
                      <Select
                        value={persona.domicilio.ciudad}
                        onValueChange={(nuevaCiudad) =>
                          actualizarPersonaReportada(persona.id, (prev) => ({
                            ...prev,
                            domicilio: { ...prev.domicilio, ciudad: nuevaCiudad },
                          }))
                        }
                        onOpenChange={(open) => {
                          if (open) {
                            setBusquedasCiudades((prev) => ({ ...prev, [persona.id]: "" }))
                          }
                        }}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Selecciona ciudad" />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="p-2">
                            <Input
                              autoFocus
                              placeholder="Buscar ciudad..."
                              value={busquedaCiudad}
                              onChange={(event) =>
                                setBusquedasCiudades((prev) => ({
                                  ...prev,
                                  [persona.id]: event.target.value,
                                }))
                              }
                            />
                          </div>
                          {ciudadesFiltradas.length > 0 ? (
                            ciudadesFiltradas.map((ciudad) => (
                              <SelectItem key={ciudad} value={ciudad}>
                                {ciudad}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias</div>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={persona.domicilio.ciudad}
                        onChange={(event) =>
                          actualizarPersonaReportada(persona.id, (prev) => ({
                            ...prev,
                            domicilio: { ...prev.domicilio, ciudad: event.target.value },
                          }))
                        }
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Colonia o localidad</Label>
                    {coloniasDisponibles.length > 0 ? (
                      <Select
                        value={coloniaSeleccionada}
                        onValueChange={(nuevaColonia) =>
                          actualizarPersonaReportada(persona.id, (prev) => ({
                            ...prev,
                            domicilio: { ...prev.domicilio, colonia: nuevaColonia },
                          }))
                        }
                        onOpenChange={(open) => {
                          if (open) {
                            setBusquedasColonias((prev) => ({ ...prev, [persona.id]: "" }))
                          }
                        }}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Selecciona colonia" />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="p-2">
                            <Input
                              autoFocus
                              placeholder="Buscar colonia..."
                              value={busquedaColonia}
                              onChange={(event) =>
                                setBusquedasColonias((prev) => ({
                                  ...prev,
                                  [persona.id]: event.target.value,
                                }))
                              }
                            />
                          </div>
                          {coloniasFiltradas.length > 0 ? (
                            coloniasFiltradas.map((colonia) => (
                              <SelectItem key={colonia} value={colonia}>
                                {colonia}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias</div>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={persona.domicilio.colonia}
                        onChange={(event) =>
                          actualizarPersonaReportada(persona.id, (prev) => ({
                            ...prev,
                            domicilio: { ...prev.domicilio, colonia: event.target.value },
                          }))
                        }
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Código postal</Label>
                    <Input
                      value={persona.domicilio.codigoPostal}
                      onChange={(event) => handleCodigoPostalChange(persona.id, event.target.value)}
                      inputMode="numeric"
                      maxLength={5}
                    />
                    <p className="text-xs text-slate-500">
                      Al capturar un código postal nacional se completan automáticamente la entidad, municipio y colonias
                      disponibles.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Calle</Label>
                    <Input
                      value={persona.domicilio.calle}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          domicilio: { ...prev.domicilio, calle: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número exterior</Label>
                    <Input
                      value={persona.domicilio.numeroExterior}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          domicilio: { ...prev.domicilio, numeroExterior: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número interior</Label>
                    <Input
                      value={persona.domicilio.numeroInterior}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          domicilio: { ...prev.domicilio, numeroInterior: event.target.value },
                        }))
                      }
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Phone className="h-4 w-4" /> Medios de contacto
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>¿Se conoce la clave de país?</Label>
                    <div className="flex flex-wrap gap-2">
                      {[{ value: "si", label: "Sí" }, { value: "no", label: "No" }].map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={persona.contacto.conocePaisTelefono === option.value ? "default" : "outline"}
                          onClick={() =>
                            actualizarPersonaReportada(persona.id, (prev) => ({
                              ...prev,
                              contacto: { ...prev.contacto, conocePaisTelefono: option.value as RespuestaBinaria },
                            }))
                          }
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Clave de país</Label>
                    <Select
                      value={paisContactoOption?.code ?? persona.contacto.clavePais}
                      onValueChange={(nuevoPais) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          contacto: { ...prev.contacto, clavePais: nuevoPais },
                        }))
                      }
                      disabled={persona.contacto.conocePaisTelefono === "no"}
                      onOpenChange={(open) => {
                        if (open) setBusquedaPais("")
                      }}
                    >
                      <SelectTrigger
                        className="bg-white"
                        disabled={persona.contacto.conocePaisTelefono === "no"}
                      >
                        <SelectValue placeholder="Selecciona código" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <Input
                            autoFocus
                            placeholder="Buscar país..."
                            value={busquedaPais}
                            onChange={(event) => setBusquedaPais(event.target.value)}
                          />
                        </div>
                        {paisesFiltrados.length > 0 ? (
                          paisesFiltrados.map((pais) => (
                            <SelectItem key={pais.code} value={pais.code}>
                              {pais.code} – {pais.label}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      value={persona.contacto.telefono}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          contacto: {
                            ...prev.contacto,
                            telefono: event.target.value.replace(/[^0-9]/g, ""),
                          },
                        }))
                      }
                      inputMode="tel"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Correo electrónico</Label>
                    <Input
                      type="email"
                      value={persona.contacto.correo}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          contacto: { ...prev.contacto, correo: event.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <FileText className="h-4 w-4" /> Identificación presentada
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo de documento</Label>
                    <Input
                      value={persona.identificacion.tipo}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          identificacion: { ...prev.identificacion, tipo: event.target.value },
                        }))
                      }
                      placeholder="INE, pasaporte, cédula, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número de documento</Label>
                    <Input
                      value={persona.identificacion.numero}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          identificacion: { ...prev.identificacion, numero: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>País de expedición</Label>
                    <Select
                      value={paisIdentificacionOption?.code ?? persona.identificacion.pais}
                      onValueChange={(nuevoPais) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          identificacion: { ...prev.identificacion, pais: nuevoPais },
                        }))
                      }
                      onOpenChange={(open) => {
                        if (open) setBusquedaPais("")
                      }}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecciona país" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <Input
                            autoFocus
                            placeholder="Buscar país..."
                            value={busquedaPais}
                            onChange={(event) => setBusquedaPais(event.target.value)}
                          />
                        </div>
                        {paisesFiltrados.length > 0 ? (
                          paisesFiltrados.map((pais) => (
                            <SelectItem key={pais.code} value={pais.code}>
                              {pais.label}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-muted-foreground">Sin coincidencias</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Vigencia</Label>
                    <Input
                      type="date"
                      value={persona.identificacion.fechaVencimiento}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          identificacion: { ...prev.identificacion, fechaVencimiento: event.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

            </div>
          )})}

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={agregarPersonaReportada} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Añadir beneficiario controlador
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-slate-600" /> Documentación que integra el expediente
          </CardTitle>
          <CardDescription>
            Marca el estatus de cada documento para asegurar que el expediente esté listo ante cualquier revisión.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {DOCUMENTACION_REQUERIDA.map((documento) => {
            const estado = obtenerStatusDocumento(documentacionEstado[documento.id])
            return (
              <div key={documento.id} className="space-y-3 rounded border bg-white p-4 text-sm shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-700">{documento.titulo}</p>
                    <p className="text-xs text-slate-500">{documento.descripcion}</p>
                  </div>
                  <Badge className={`${estado.classes} text-xs font-semibold capitalize`}>{estado.label}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DOCUMENTO_STATUS.map((opcion) => (
                    <Button
                      key={opcion.value}
                      type="button"
                      size="sm"
                      variant={estado.value === opcion.value ? "default" : "outline"}
                      onClick={() =>
                        setDocumentacionEstado((prev) => ({
                          ...prev,
                          [documento.id]: opcion.value,
                        }))
                      }
                    >
                      {opcion.label}
                    </Button>
                  ))}
                </div>
                {documento.obligatorio && (
                  <p className="text-[11px] text-rose-500">Documento indispensable para la integración del aviso.</p>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
