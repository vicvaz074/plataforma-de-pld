"use client"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
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
  Globe2,
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
import { findCodigoPostalInfo } from "@/lib/data/codigos-postales"

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
    titulo: "Datos generales del cliente",
    descripcion: "Información básica necesaria para identificar plenamente a la persona física o moral.",
    campos: [
      { id: "nombre", label: "Nombre / Razón social", requerido: true, placeholder: "Ej. Grupo Ejemplar, S.A. de C.V." },
      { id: "rfc", label: "RFC", requerido: true, placeholder: "Ej. GEX123456789", type: "text" },
      { id: "curp", label: "CURP", placeholder: "Para personas físicas", type: "text" },
      {
        id: "fecha-constitucion",
        label: "Fecha de constitución / nacimiento",
        type: "date",
        requerido: false,
      },
      { id: "nacionalidad", label: "Nacionalidad", requerido: true, placeholder: "Ej. Mexicana" },
    ],
  },
  {
    id: "contacto-actividad",
    titulo: "Actividad y medios de contacto",
    descripcion: "Datos que permitirán prellenar avisos y verificar la actividad económica declarada.",
    campos: [
      { id: "domicilio", label: "Domicilio completo", requerido: true, multiline: true, placeholder: "Calle, número, colonia, municipio, estado, país" },
      { id: "telefono", label: "Teléfono de contacto", placeholder: "Incluye lada o clave internacional" },
      { id: "correo", label: "Correo electrónico", placeholder: "Ej. cumplimiento@empresa.com", type: "email" },
      { id: "actividad-economica", label: "Actividad económica", requerido: true, placeholder: "Giro comercial o profesional" },
      { id: "origen-recursos", label: "Origen declarado de los recursos", multiline: true },
    ],
  },
  {
    id: "documentos",
    titulo: "Documentos soporte",
    descripcion: "Actas constitutivas, poderes notariales e identificaciones vigentes.",
    campos: [
      { id: "identificacion", label: "Identificación oficial presentada", requerido: true },
      { id: "numero-identificacion", label: "Número de identificación", requerido: true },
      { id: "situacion-fiscal", label: "Constancia de situación fiscal", requerido: true },
      { id: "comprobante", label: "Comprobante de domicilio", requerido: true },
      { id: "documentos-adicionales", label: "Otros documentos relevantes", multiline: true },
    ],
  },
]

const DOCUMENTACION_REQUERIDA: DocumentoRequerido[] = [
  {
    id: "identificacion-oficial",
    titulo: "Identificación oficial vigente",
    descripcion: "INE, pasaporte, cédula profesional o documento migratorio vigente de la persona obligada o representante.",
    obligatorio: true,
  },
  {
    id: "acta-constitutiva",
    titulo: "Acta constitutiva / acta de nacimiento",
    descripcion: "Documento que acredita la creación de la persona moral o la identidad de la persona física.",
    obligatorio: true,
  },
  {
    id: "poder-notarial",
    titulo: "Poderes notariales",
    descripcion: "Poder general o especial que faculta al representante legal para actos de administración.",
  },
  {
    id: "situacion-fiscal",
    titulo: "Constancia de situación fiscal",
    descripcion: "Documento emitido por el SAT con datos de régimen, domicilio fiscal y obligaciones vigentes.",
    obligatorio: true,
  },
  {
    id: "comprobante-domicilio",
    titulo: "Comprobante de domicilio",
    descripcion: "Recibo de servicios, estado de cuenta o constancia de residencia con antigüedad no mayor a 3 meses.",
    obligatorio: true,
  },
  {
    id: "estructura-accionaria",
    titulo: "Estructura accionaria y beneficiarios",
    descripcion: "Relación de accionistas o beneficiarios finales con porcentaje de participación y documentación soporte.",
  },
  {
    id: "declaracion-pep",
    titulo: "Declaración de Personas Políticamente Expuestas",
    descripcion: "Formato firmado donde el cliente manifiesta si es o no PEP y detalla el cargo en su caso.",
  },
]

type DocumentStatus = "pendiente" | "en-proceso" | "completo"

const DOCUMENTO_STATUS: { value: DocumentStatus; label: string; classes: string }[] = [
  { value: "pendiente", label: "Pendiente", classes: "bg-rose-100 text-rose-700" },
  { value: "en-proceso", label: "En revisión", classes: "bg-amber-100 text-amber-700" },
  { value: "completo", label: "Completo", classes: "bg-emerald-100 text-emerald-700" },
]

const DATOS_FISCALES_CAMPOS: CampoExpediente[] = [
  { id: "regimen-fiscal", label: "Régimen fiscal", requerido: true, placeholder: "Ej. General de Ley Personas Morales" },
  {
    id: "fecha-inicio-operaciones",
    label: "Fecha de inicio de operaciones",
    type: "date",
    requerido: true,
  },
  {
    id: "actividad-sat",
    label: "Actividad económica registrada ante el SAT",
    requerido: true,
    placeholder: "Descripción según constancia de situación fiscal",
  },
  {
    id: "registro-publico",
    label: "Folio en el Registro Público de Comercio",
    placeholder: "Número de folio mercantil o equivalente",
  },
  {
    id: "datos-notario",
    label: "Datos del notario y escritura",
    multiline: true,
    placeholder: "Nombre del notario, número de escritura y fecha",
  },
  {
    id: "obligaciones-fiscales",
    label: "Obligaciones fiscales registradas",
    multiline: true,
    placeholder: "IVA, ISR, DIOT, Contabilidad electrónica, etc.",
  },
]

const PERFIL_OPERACION_CAMPOS: CampoExpediente[] = [
  {
    id: "origen-fondos",
    label: "Origen de los recursos",
    requerido: true,
    multiline: true,
    placeholder: "Describe la procedencia lícita del patrimonio y de los fondos que operará.",
  },
  {
    id: "destino-fondos",
    label: "Destino habitual de los recursos",
    requerido: true,
    multiline: true,
    placeholder: "Uso previsto de los recursos dentro de la relación comercial.",
  },
  {
    id: "productos-servicios",
    label: "Productos o servicios contratados",
    multiline: true,
    placeholder: "Detalla los servicios que recibirá y su finalidad.",
  },
  {
    id: "montos-frecuencia",
    label: "Montos y frecuencia estimada",
    multiline: true,
    placeholder: "Rango de importes y periodicidad de operaciones.",
  },
  {
    id: "medios-pago",
    label: "Medios de pago utilizados",
    multiline: true,
    placeholder: "Transferencias bancarias, efectivo, cheques, criptomonedas, etc.",
  },
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

interface PersonaReportada {
  id: string
  tipo: (typeof PERSONA_TIPO_OPCIONES)[number]["value"]
  denominacion: string
  fechaConstitucion: string
  rfc: string
  curp: string
  pais: string
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

const CLIENTES_STORAGE_KEY = "actividades_vulnerables_clientes"
const EXPEDIENTE_DETALLE_STORAGE_KEY = "kyc_expedientes_detalle"

function generarIdTemporal() {
  return Math.random().toString(36).slice(2, 10)
}

function crearPersonaBase(): PersonaReportada {
  return {
    id: generarIdTemporal(),
    tipo: "persona_moral",
    denominacion: "",
    fechaConstitucion: "",
    rfc: "",
    curp: "",
    pais: "MX",
    giro: "",
    rolRelacion: "Cliente",
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

function crearPersonaDemostracion(): PersonaReportada {
  const base = crearPersonaBase()
  return {
    ...base,
    denominacion: "Cliente Demostrativo, S.A. de C.V.",
    fechaConstitucion: "2022-01-15",
    rfc: "DEM220115AB1",
    pais: "MX",
    giro: "Servicios de consultoría de cumplimiento",
    representante: {
      ...base.representante,
      nombre: "Laura",
      apellidoPaterno: "Ejemplo",
      apellidoMaterno: "Control",
      fechaNacimiento: "1989-09-03",
      rfc: "EJCL890903AB1",
      curp: "EJCL890903MDFJRL08",
    },
    domicilio: {
      ...base.domicilio,
      codigoPostal: "06100",
      entidad: "Ciudad de México",
      municipio: "Cuauhtémoc",
      colonia: "Condesa",
      calle: "Av. Ejemplo",
      numeroExterior: "123",
      numeroInterior: "",
    },
    contacto: {
      ...base.contacto,
      telefono: "5555555555",
      correo: "demo@plataforma.mx",
    },
    identificacion: {
      ...base.identificacion,
      tipo: "INE",
      numero: "DEM1234567",
      fechaVencimiento: "2027-12-31",
    },
    participacion: {
      ...base.participacion,
      porcentajeCapital: "100",
      origenRecursos: "Capital social declarado para escenario de prueba.",
      esPep: "no",
      detallePep: "",
    },
  }
}

interface ExpedienteResumen {
  rfc: string
  nombre: string
  tipoCliente: string
  detalleTipoCliente?: string
}

interface ExpedienteDetalle extends ExpedienteResumen {
  responsable?: string
  claveSujetoObligado?: string
  claveActividadVulnerable?: string
  identificacion?: Record<string, string>
  datosFiscales?: Record<string, string>
  perfilOperaciones?: Record<string, string>
  documentacion?: Record<string, DocumentStatus>
  personas: PersonaReportada[]
  actualizadoEn?: string
}

interface ExpedienteListadoItem extends ExpedienteResumen {
  actualizadoEn?: string
  detalle?: ExpedienteDetalle | null
}

const DEMO_EXPEDIENTE_DETALLE: ExpedienteDetalle = {
  rfc: "DEM991231AA1",
  nombre: "Cliente Demostrativo, S.A. de C.V.",
  tipoCliente: "pm_mexicana",
  detalleTipoCliente: "Sociedad demostrativa",
  responsable: "Área de Cumplimiento Demo",
  claveSujetoObligado: "DEMO12345678",
  claveActividadVulnerable: "demo-servicio-cumplimiento",
  identificacion: {
    nombre: "Cliente Demostrativo, S.A. de C.V.",
    rfc: "DEM991231AA1",
    domicilio: "Av. Ejemplo 123, Col. Condesa, Cuauhtémoc, CDMX",
  },
  datosFiscales: {
    "regimen-fiscal": "General de Ley Personas Morales",
    "actividad-sat": "Servicios de consultoría en gestión",
  },
  perfilOperaciones: {
    "origen-fondos": "Recursos provenientes del capital social demostrativo.",
    "destino-fondos": "Pago de servicios de consultoría ficticios para capacitación.",
  },
  documentacion: {
    "identificacion-oficial": "completo",
    "acta-constitutiva": "completo",
    "comprobante-domicilio": "en-proceso",
  },
  personas: [crearPersonaDemostracion()],
  actualizadoEn: "2024-05-10T16:00:00.000Z",
}

const DEMO_EXPEDIENTE_RESUMEN: ExpedienteResumen = {
  rfc: DEMO_EXPEDIENTE_DETALLE.rfc,
  nombre: DEMO_EXPEDIENTE_DETALLE.nombre,
  tipoCliente: DEMO_EXPEDIENTE_DETALLE.tipoCliente,
  detalleTipoCliente: DEMO_EXPEDIENTE_DETALLE.detalleTipoCliente,
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
    fechaConstitucion:
      typeof raw.fechaConstitucion === "string" ? raw.fechaConstitucion : base.fechaConstitucion,
    rfc: typeof raw.rfc === "string" ? raw.rfc : base.rfc,
    curp: typeof raw.curp === "string" ? raw.curp : base.curp,
    pais:
      typeof raw.pais === "string"
        ? findPaisByNombre(raw.pais)?.code ?? findPaisByCodigo(raw.pais)?.code ?? raw.pais
        : base.pais,
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
      conoceTelefono:
        contactoRaw.conoceTelefono === "no" || contactoRaw.conoceTelefono === "si"
          ? contactoRaw.conoceTelefono
          : base.contacto.conoceTelefono,
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

  return {
    rfc,
    nombre,
    tipoCliente: sanitizeTipoCliente(typeof raw.tipoCliente === "string" ? raw.tipoCliente : undefined),
    detalleTipoCliente:
      typeof raw.detalleTipoCliente === "string" && raw.detalleTipoCliente.trim().length > 0
        ? raw.detalleTipoCliente
        : undefined,
    responsable: typeof raw.responsable === "string" ? raw.responsable : undefined,
    claveSujetoObligado:
      typeof raw.claveSujetoObligado === "string" ? raw.claveSujetoObligado : undefined,
    claveActividadVulnerable:
      typeof raw.claveActividadVulnerable === "string" ? raw.claveActividadVulnerable : undefined,
    identificacion: sanitizeStringMap(raw.identificacion),
    datosFiscales: sanitizeStringMap(raw.datosFiscales),
    perfilOperaciones: sanitizeStringMap(raw.perfilOperaciones),
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
  const [tipoCliente, setTipoCliente] = useState<string>(CLIENTE_TIPOS[0]?.value ?? "")
  const [detalleTipoCliente, setDetalleTipoCliente] = useState<string>("")
  const [responsable, setResponsable] = useState("")
  const [nombreExpediente, setNombreExpediente] = useState("")
  const [claveSujetoObligado, setClaveSujetoObligado] = useState("")
  const [claveActividadVulnerable, setClaveActividadVulnerable] = useState("")
  const [datosIdentificacion, setDatosIdentificacion] = useState<Record<string, string>>({})
  const [datosFiscales, setDatosFiscales] = useState<Record<string, string>>({})
  const [perfilOperaciones, setPerfilOperaciones] = useState<Record<string, string>>({})
  const [documentacionEstado, setDocumentacionEstado] = useState<Record<string, DocumentStatus>>({})
  const [personasReportadas, setPersonasReportadas] = useState<PersonaReportada[]>(() => [crearPersonaBase()])
  const [expedientesResumen, setExpedientesResumen] = useState<ExpedienteResumen[]>([])
  const [expedientesDetalle, setExpedientesDetalle] = useState<Record<string, ExpedienteDetalle>>({})
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState<string | null>(null)
  const [expedientesCargados, setExpedientesCargados] = useState(false)
  const [busquedaExpedientes, setBusquedaExpedientes] = useState<string>("")

  const tipoClienteSeleccionado = useMemo(() => findClienteTipoOption(tipoCliente), [tipoCliente])
  const tipoClienteLabel = useMemo(() => findClienteTipoLabel(tipoCliente), [tipoCliente])
  const tipoClienteResumen = useMemo(
    () => (detalleTipoCliente ? `${tipoClienteLabel} – ${detalleTipoCliente}` : tipoClienteLabel),
    [detalleTipoCliente, tipoClienteLabel],
  )

  const totalCamposIdentificacion = useMemo(
    () => IDENTIFICACION_CAMPOS.reduce((acc, grupo) => acc + grupo.campos.length, 0),
    [],
  )
  const camposIdentificacionCompletos = useMemo(
    () =>
      IDENTIFICACION_CAMPOS.flatMap((grupo) => grupo.campos).filter((campo) => {
        const valor = datosIdentificacion[campo.id]
        return typeof valor === "string" && valor.trim().length > 0
      }).length,
    [datosIdentificacion],
  )

  const totalCamposFiscales = DATOS_FISCALES_CAMPOS.length
  const camposFiscalesCompletos = useMemo(
    () => DATOS_FISCALES_CAMPOS.filter((campo) => datosFiscales[campo.id]?.trim()).length,
    [datosFiscales],
  )

  const totalCamposPerfil = PERFIL_OPERACION_CAMPOS.length
  const camposPerfilCompletos = useMemo(
    () => PERFIL_OPERACION_CAMPOS.filter((campo) => perfilOperaciones[campo.id]?.trim()).length,
    [perfilOperaciones],
  )

  const documentosCompletos = useMemo(
    () => DOCUMENTACION_REQUERIDA.filter((doc) => documentacionEstado[doc.id] === "completo").length,
    [documentacionEstado],
  )

  const progresoGlobal = useMemo(() => {
    const total = totalCamposIdentificacion + totalCamposFiscales + totalCamposPerfil + DOCUMENTACION_REQUERIDA.length
    if (total === 0) return 0
    const completados =
      camposIdentificacionCompletos + camposFiscalesCompletos + camposPerfilCompletos + documentosCompletos
    return Math.min(100, Math.round((completados / total) * 100))
  }, [
    totalCamposIdentificacion,
    totalCamposFiscales,
    totalCamposPerfil,
    camposIdentificacionCompletos,
    camposFiscalesCompletos,
    camposPerfilCompletos,
    documentosCompletos,
  ])

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
    const criterio = normalizarTexto(busquedaExpedientes)
    if (!criterio) return expedientesDisponibles
    return expedientesDisponibles.filter((item) => {
      const nombre = normalizarTexto(item.nombre)
      const rfcNormalizado = normalizarTexto(item.rfc)
      const detalle = normalizarTexto(item.detalleTipoCliente)
      return (
        (nombre && nombre.includes(criterio)) ||
        (rfcNormalizado && rfcNormalizado.includes(criterio)) ||
        (detalle && detalle.includes(criterio))
      )
    })
  }, [busquedaExpedientes, expedientesDisponibles])

  const sinResultadosExpedientes = busquedaExpedientes.trim().length > 0 && expedientesFiltrados.length === 0

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
      setTipoCliente(detalle.tipoCliente ?? (CLIENTE_TIPOS[0]?.value ?? ""))
      setDetalleTipoCliente(detalle.detalleTipoCliente ?? "")
      setResponsable(detalle.responsable ?? "")
      setClaveSujetoObligado(detalle.claveSujetoObligado ?? "")
      setClaveActividadVulnerable(detalle.claveActividadVulnerable ?? "")
      const identificacion = {
        ...detalle.identificacion,
        nombre: detalle.identificacion?.nombre ?? detalle.nombre ?? "",
        rfc: detalle.identificacion?.rfc ?? detalle.rfc ?? "",
      }
      setDatosIdentificacion(identificacion)
      setDatosFiscales({ ...(detalle.datosFiscales ?? {}) })
      setPerfilOperaciones({ ...(detalle.perfilOperaciones ?? {}) })
      setDocumentacionEstado({ ...(detalle.documentacion ?? {}) })
      const personas =
        detalle.personas.length > 0
          ? detalle.personas.map((persona) => ({
              ...persona,
              id: persona.id && persona.id.trim().length > 0 ? persona.id : generarIdTemporal(),
            }))
          : [crearPersonaBase()]
      setPersonasReportadas(personas)
    },
    [setClaveActividadVulnerable, setClaveSujetoObligado, setDatosFiscales, setDatosIdentificacion, setDetalleTipoCliente, setDocumentacionEstado, setNombreExpediente, setPerfilOperaciones, setPersonasReportadas, setResponsable, setTipoCliente],
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
    },
    [setClaveActividadVulnerable, setClaveSujetoObligado, setDatosFiscales, setDatosIdentificacion, setDetalleTipoCliente, setDocumentacionEstado, setNombreExpediente, setPerfilOperaciones, setPersonasReportadas, setResponsable, setTipoCliente],
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

      let resumen: ExpedienteResumen[] = []
      let mapaDetalle = new Map<string, ExpedienteDetalle>()

      try {
        const stored = window.localStorage.getItem(CLIENTES_STORAGE_KEY)
        const parsed = stored ? JSON.parse(stored) : []
        resumen = Array.isArray(parsed)
          ? parsed
              .map((item) => sanitizeClienteResumen(item))
              .filter((item): item is ExpedienteResumen => Boolean(item))
          : []
      } catch (error) {
        console.error("No fue posible leer el catálogo de clientes guardados", error)
        resumen = []
      }

      try {
        const storedDetalle = window.localStorage.getItem(EXPEDIENTE_DETALLE_STORAGE_KEY)
        const parsedDetalle = storedDetalle ? JSON.parse(storedDetalle) : []
        mapaDetalle = new Map<string, ExpedienteDetalle>()
        if (Array.isArray(parsedDetalle)) {
          parsedDetalle.forEach((item) => {
            const sane = sanitizeExpedienteGuardado(item)
            if (sane) {
              mapaDetalle.set(sane.rfc, sane)
            }
          })
        }
      } catch (error) {
        console.error("No fue posible leer el detalle de expedientes guardados", error)
        mapaDetalle = new Map<string, ExpedienteDetalle>()
      }

      if (resumen.length === 0 && mapaDetalle.size === 0) {
        resumen = [DEMO_EXPEDIENTE_RESUMEN]
        mapaDetalle.set(DEMO_EXPEDIENTE_DETALLE.rfc, DEMO_EXPEDIENTE_DETALLE)
      }

      setExpedientesResumen(resumen)
      setExpedientesDetalle(Object.fromEntries(mapaDetalle) as Record<string, ExpedienteDetalle>)
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

    const handleCodigoPostalChange = useCallback(
      (personaId: string, value: string) => {
        setPersonasReportadas((prev) =>
          prev.map((persona) => {
            if (persona.id !== personaId) return persona
            const limpio = value.replace(/[^0-9]/g, "").slice(0, 5)
            if (persona.domicilio.ambito !== "nacional") {
              return {
                ...persona,
                domicilio: { ...persona.domicilio, codigoPostal: limpio },
              }
            }

            const info = limpio.length === 5 ? findCodigoPostalInfo(limpio) : undefined
            const colonias = info?.asentamientos ?? []

            return {
              ...persona,
              domicilio: {
                ...persona.domicilio,
                codigoPostal: limpio,
                pais: "MX",
                entidad: info?.estado ?? persona.domicilio.entidad,
                municipio: info?.municipio ?? persona.domicilio.municipio,
                colonia:
                  colonias.length > 0
                    ? colonias.includes(persona.domicilio.colonia)
                      ? persona.domicilio.colonia
                      : colonias[0]
                    : persona.domicilio.colonia,
              },
            }
          }),
        )
      },
      [],
    )

    const crearNuevoExpediente = useCallback(() => {
      setExpedienteSeleccionado(null)
      setNombreExpediente("")
      setTipoCliente(CLIENTE_TIPOS[0]?.value ?? "")
      setDetalleTipoCliente("")
      setResponsable("")
      setClaveSujetoObligado("")
      setClaveActividadVulnerable("")
      setDatosIdentificacion({})
      setDatosFiscales({})
      setPerfilOperaciones({})
      setDocumentacionEstado({})
      setPersonasReportadas([crearPersonaBase()])
    }, [])

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
    toast({
      title: "Persona añadida",
      description: "Se agregó un nuevo registro para documentar otra persona relacionada.",
    })
  }

  const eliminarPersonaReportada = (id: string) => {
    setPersonasReportadas((prev) => {
      if (prev.length <= 1) {
        toast({
          title: "Acción no disponible",
          description: "Debes conservar al menos una persona registrada en el expediente.",
          variant: "destructive",
        })
        return prev
      }

      const actualizadas = prev.filter((persona) => persona.id !== id)
      toast({
        title: "Persona eliminada",
        description: "Se retiró la persona del expediente único.",
      })
      return actualizadas
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
        responsable,
        claveSujetoObligado,
        claveActividadVulnerable,
        identificacion: { ...datosIdentificacion, nombre, rfc },
        datosFiscales: { ...datosFiscales },
        perfilOperaciones: { ...perfilOperaciones },
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
            <div className="space-y-3">
              <Label>Consultar expediente almacenado</Label>
              <Select
                value={expedienteSeleccionado ?? undefined}
                onValueChange={(value) => cargarExpediente(value)}
                disabled={expedientesDisponibles.length === 0}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecciona un expediente" />
                </SelectTrigger>
                <SelectContent>
                  {expedientesFiltrados.map((item) => (
                    <SelectItem key={item.rfc} value={item.rfc}>
                      {item.nombre} – {item.rfc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="space-y-1">
                <Label htmlFor="busqueda-expedientes" className="text-xs font-medium text-slate-600">
                  Filtrar expedientes guardados
                </Label>
                <Input
                  id="busqueda-expedientes"
                  value={busquedaExpedientes}
                  onChange={(event) => setBusquedaExpedientes(event.target.value)}
                  placeholder="Escribe nombre o RFC"
                />
              </div>
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
            sinResultadosExpedientes ? (
              <p className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No se encontraron expedientes que coincidan con "{busquedaExpedientes}".
              </p>
            ) : (
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
            )
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
            <FileText className="h-5 w-5 text-slate-600" /> Expediente único de identificación
          </CardTitle>
          <CardDescription>
            Centraliza todos los datos y documentos del cliente para que los avisos se prellenan automáticamente al
            registrarlo en actividades vulnerables.
          </CardDescription>
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
                  Información fiscal {camposFiscalesCompletos}/{totalCamposFiscales}
                </Badge>
                <Badge variant="outline" className="bg-white">
                  Perfil transaccional {camposPerfilCompletos}/{totalCamposPerfil}
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
            <UserCheck className="h-5 w-5 text-slate-600" /> Identificación del cliente
          </CardTitle>
          <CardDescription>
            Registra la información oficial y los documentos soporte necesarios para acreditar la identidad del cliente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de cliente</Label>
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
                  <Select value={detalleTipoCliente || undefined} onValueChange={setDetalleTipoCliente}>
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
                        {campo.id === "nacionalidad" ? (
                          <Select
                            value={value}
                            onValueChange={(nuevoValor) =>
                              setDatosIdentificacion((prev) => ({ ...prev, [campo.id]: nuevoValor }))
                            }
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Selecciona país" />
                            </SelectTrigger>
                            <SelectContent>
                              {PAISES.map((pais) => (
                                <SelectItem key={pais.code} value={pais.label}>
                                  {pais.label}
                                </SelectItem>
                              ))}
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
            <Building2 className="h-5 w-5 text-slate-600" /> Información legal y fiscal
          </CardTitle>
          <CardDescription>Datos que deben coincidir con la constancia de situación fiscal y documentos legales.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {DATOS_FISCALES_CAMPOS.map((campo) => {
              const value = datosFiscales[campo.id] ?? ""
              const onChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                setDatosFiscales((prev) => ({ ...prev, [campo.id]: event.target.value }))
              }

              return (
                <div key={campo.id} className="space-y-1 text-sm">
                  <Label className="flex items-center justify-between text-xs font-semibold uppercase text-slate-600">
                    {campo.label}
                    {campo.requerido && <span className="text-rose-500">*</span>}
                  </Label>
                  {campo.multiline ? (
                    <Textarea
                      value={value}
                      onChange={onChange}
                      placeholder={campo.placeholder ?? ""}
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
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="h-5 w-5 text-slate-600" /> Perfil transaccional y uso de servicios
          </CardTitle>
          <CardDescription>
            Define el comportamiento esperado para detectar desviaciones cuando registres operaciones y avisos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {PERFIL_OPERACION_CAMPOS.map((campo) => {
              const value = perfilOperaciones[campo.id] ?? ""
              return (
                <div key={campo.id} className="space-y-1 text-sm">
                  <Label className="flex items-center justify-between text-xs font-semibold uppercase text-slate-600">
                    {campo.label}
                    {campo.requerido && <span className="text-rose-500">*</span>}
                  </Label>
                  <Textarea
                    value={value}
                    onChange={(event) =>
                      setPerfilOperaciones((prev) => ({
                        ...prev,
                        [campo.id]: event.target.value,
                      }))
                    }
                    placeholder={campo.placeholder ?? ""}
                    rows={3}
                  />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-slate-600" /> Documentación requerida
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

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-600" /> Personas relacionadas y beneficiarios
          </CardTitle>
          <CardDescription>
            Registra a la persona objeto del aviso, representantes, apoderados y beneficiarios finales para
            prellenar automáticamente los formularios.
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

            return (
              <div key={persona.id} className="space-y-6 rounded border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-700">Persona {index + 1}</span>
                  <span className="text-xs text-slate-500">{persona.rolRelacion}</span>
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
                  <Label>Tipo de persona</Label>
                  <Select
                    value={persona.tipo}
                    onValueChange={(value) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        tipo: value as PersonaReportada["tipo"],
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERSONA_TIPO_OPCIONES.map((opcion) => (
                        <SelectItem key={opcion.value} value={opcion.value}>
                          {opcion.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Rol dentro del aviso</Label>
                  <Input
                    value={persona.rolRelacion}
                    onChange={(event) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        rolRelacion: event.target.value,
                      }))
                    }
                    placeholder="Cliente, representante, beneficiario, fideicomitente..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nombre o razón social</Label>
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
                  <Label>RFC</Label>
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
                  <Label>CURP</Label>
                  <Input
                    value={persona.curp}
                    onChange={(event) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        curp: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="Para personas físicas"
                  />
                </div>
                <div className="space-y-2">
                  <Label>País de constitución / nacionalidad</Label>
                  <Select
                    value={paisPersonaOption?.code ?? persona.pais}
                    onValueChange={(nuevoPais) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        pais: nuevoPais,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Selecciona país" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAISES.map((pais) => (
                        <SelectItem key={pais.code} value={pais.code}>
                          {pais.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fecha de constitución / nacimiento</Label>
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
                  <Label>Actividad o profesión</Label>
                  <Input
                    value={persona.giro}
                    onChange={(event) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        giro: event.target.value,
                      }))
                    }
                    placeholder="Ej. Servicios profesionales, arrendamiento..."
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <UserCheck className="h-4 w-4" /> Datos del representante o apoderado legal
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Nombre(s)</Label>
                    <Input
                      value={persona.representante.nombre}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          representante: { ...prev.representante, nombre: event.target.value },
                        }))
                      }
                      placeholder="Nombre completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellido paterno</Label>
                    <Input
                      value={persona.representante.apellidoPaterno}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          representante: { ...prev.representante, apellidoPaterno: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellido materno</Label>
                    <Input
                      value={persona.representante.apellidoMaterno}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          representante: { ...prev.representante, apellidoMaterno: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de nacimiento</Label>
                    <Input
                      type="date"
                      value={persona.representante.fechaNacimiento}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          representante: { ...prev.representante, fechaNacimiento: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>RFC</Label>
                    <Input
                      value={persona.representante.rfc}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          representante: { ...prev.representante, rfc: event.target.value.toUpperCase() },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CURP</Label>
                    <Input
                      value={persona.representante.curp}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          representante: { ...prev.representante, curp: event.target.value.toUpperCase() },
                        }))
                      }
                    />
                  </div>
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
                      onClick={() =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          domicilio: {
                            ...prev.domicilio,
                            ambito: opcion.value,
                            pais: opcion.value === "nacional" ? "MX" : prev.domicilio.pais,
                          },
                        }))
                      }
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
                      onValueChange={(nuevoPais) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          domicilio: { ...prev.domicilio, pais: nuevoPais },
                        }))
                      }
                      disabled={persona.domicilio.ambito === "nacional"}
                    >
                      <SelectTrigger className="bg-white" disabled={persona.domicilio.ambito === "nacional"}>
                        <SelectValue placeholder="Selecciona país" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAISES.map((pais) => (
                          <SelectItem key={pais.code} value={pais.code}>
                            {pais.label}
                          </SelectItem>
                        ))}
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
                    <Label>Colonia o localidad</Label>
                    {coloniasDisponibles.length > 0 ? (
                      <Select
                        value={
                          coloniasDisponibles.includes(persona.domicilio.colonia)
                            ? persona.domicilio.colonia
                            : coloniasDisponibles[0] ?? ""
                        }
                        onValueChange={(nuevaColonia) =>
                          actualizarPersonaReportada(persona.id, (prev) => ({
                            ...prev,
                            domicilio: { ...prev.domicilio, colonia: nuevaColonia },
                          }))
                        }
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Selecciona colonia" />
                        </SelectTrigger>
                        <SelectContent>
                          {coloniasDisponibles.map((colonia) => (
                            <SelectItem key={colonia} value={colonia}>
                              {colonia}
                            </SelectItem>
                          ))}
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
                    <Label>¿Se conoce el teléfono?</Label>
                    <div className="flex flex-wrap gap-2">
                      {[{ value: "si", label: "Sí" }, { value: "no", label: "No" }].map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={persona.contacto.conoceTelefono === option.value ? "default" : "outline"}
                          onClick={() =>
                            actualizarPersonaReportada(persona.id, (prev) => ({
                              ...prev,
                              contacto: { ...prev.contacto, conoceTelefono: option.value as RespuestaBinaria },
                            }))
                          }
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
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
                    >
                      <SelectTrigger
                        className="bg-white"
                        disabled={persona.contacto.conocePaisTelefono === "no"}
                      >
                        <SelectValue placeholder="Selecciona código" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAISES.map((pais) => (
                          <SelectItem key={pais.code} value={pais.code}>
                            {pais.code} – {pais.label}
                          </SelectItem>
                        ))}
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
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecciona país" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAISES.map((pais) => (
                          <SelectItem key={pais.code} value={pais.code}>
                            {pais.label}
                          </SelectItem>
                        ))}
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

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Globe2 className="h-4 w-4" /> Participación y origen de recursos
                </div>
                <div className="grid gap-4 md:grid-cols-2">
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
                  <div className="space-y-2">
                    <Label>¿Es persona políticamente expuesta?</Label>
                    <div className="flex flex-wrap gap-2">
                      {[{ value: "si", label: "Sí" }, { value: "no", label: "No" }].map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={persona.participacion.esPep === option.value ? "default" : "outline"}
                          onClick={() =>
                            actualizarPersonaReportada(persona.id, (prev) => ({
                              ...prev,
                              participacion: { ...prev.participacion, esPep: option.value as RespuestaBinaria },
                            }))
                          }
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Origen de los recursos que aporta</Label>
                    <Textarea
                      value={persona.participacion.origenRecursos}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          participacion: { ...prev.participacion, origenRecursos: event.target.value },
                        }))
                      }
                      rows={3}
                    />
                  </div>
                  {persona.participacion.esPep === "si" && (
                    <div className="md:col-span-2 space-y-2">
                      <Label>Detalle del cargo público o parentesco</Label>
                      <Textarea
                        value={persona.participacion.detallePep}
                        onChange={(event) =>
                          actualizarPersonaReportada(persona.id, (prev) => ({
                            ...prev,
                            participacion: { ...prev.participacion, detallePep: event.target.value },
                          }))
                        }
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )})}

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={agregarPersonaReportada} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Añadir otra persona
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
