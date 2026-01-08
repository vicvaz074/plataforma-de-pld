"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import {
  Building2,
  CalendarClock,
  FileText,
  Home,
  Mail,
  MapPin,
  Users,
} from "lucide-react"
import { CLIENTE_TIPOS, findClienteTipoLabel } from "@/lib/data/tipos-cliente"
import { PAISES, findPaisByCodigo } from "@/lib/data/paises"
import {
  findCodigoPostalInfo,
  registerCodigoPostalInfo,
  type CodigoPostalInfo,
} from "@/lib/data/codigos-postales"

const EXPEDIENTE_TIPOS = [
  { value: "persona_moral", label: "Persona Moral" },
  { value: "persona_fisica", label: "Persona Física" },
  { value: "persona_moral_derecho_publico", label: "Persona Moral de Derecho Público" },
  { value: "entidad_financiera", label: "Entidad Financiera / Seguros" },
  { value: "pm_derecho_publico_simplificado", label: "PM de Derecho Público Régimen Simplificado" },
  { value: "embajada_consulado", label: "Embajada, Consulado u Organismo" },
  { value: "fideicomiso", label: "Fideicomiso" },
]

const TIPO_VIALIDAD_OPCIONES = [
  "Calle",
  "Avenida",
  "Boulevard",
  "Calzada",
  "Carretera",
  "Circuito",
  "Privada",
  "Prolongación",
  "Andador",
  "Retorno",
  "Otro",
]

const TIPO_VIALIDAD_PERSONA_FISICA = [
  "AVENIDA",
  "BOULEVARD",
  "CALLE",
  "CALZADA",
  "EJE VIAL",
  "VIA",
]

const TIPO_CLIENTE_PERSONA_FISICA = [
  "Persona Física Mexicana",
  "Persona Física Extranjera",
]

const ACTO_OPERACION_OPCIONES = [
  "Compra/Venta",
  "Arrendamiento",
  "Constitución de fideicomiso",
  "Otorgamiento de crédito",
  "Prestación de servicios",
  "Otro",
]

const ACTO_OPERACION_PERSONA_FISICA = [
  "Fracción I – Juegos con apuesta, concursos o sorteos",
  "Fracción II – Tarjetas de servicios, crédito, prepagadas o instrumentos de valor",
  "Fracción III – Cheques de viajero",
  "Fracción IV – Operaciones de mutuo, préstamos o créditos",
  "Fracción V – Construcción, desarrollo o intermediación inmobiliaria",
  "Fracción V Bis – Recepción de recursos para desarrollo inmobiliario",
  "Fracción VI – Metales preciosos, joyas, relojes",
  "Fracción VII – Subasta o comercialización de obras de arte",
  "Fracción VIII – Comercialización o distribución de vehículos",
  "Fracción IX – Blindaje de vehículos e inmuebles",
  "Fracción X – Traslado o custodia de dinero y valores",
  "Fracción XI – Servicios profesionales",
  "Fracción XII – Servicios de fe pública",
  "Fracción XIII – Recepción de donativos",
  "Fracción XIV – Servicios de comercio exterior",
  "Fracción XV – Derechos personales de uso o goce de inmuebles",
  "Fracción XVI – Intercambio de activos virtuales",
]

const TIPO_INMUEBLE_OPCIONES = [
  "Casa habitación",
  "Departamento",
  "Terreno",
  "Local comercial",
  "Oficina",
  "Nave industrial",
  "Otro",
]

const IDENTIFICACION_OPCIONES = [
  "Credencial para Votar",
  "Pasaporte",
  "Documento que acredita estancia en México",
  "Licencia de Conducir",
  "Cédula Profesional",
  "Cartilla del Servicio Militar",
  "Documento Nacional de Identidad",
]

const AUTORIDAD_IDENTIFICACION_OPCIONES = [
  "Instituto Nacional Electoral",
  "Secretaría de Relaciones Exteriores",
  "Instituto Nacional de Migración",
  "Secretaría de Transportes y Vialidad o equivalente",
  "Secretaría de Educación Pública",
  "Secretaría de la Defensa Nacional",
]

const OCUPACIONES_OPCIONES = [
  "Empleado",
  "Profesional independiente",
  "Empresario",
  "Comerciante",
  "Ama de casa",
  "Estudiante",
  "Jubilado",
  "Servidor público",
  "Otro",
]

const DOCUMENTOS_EUI = [
  "Formulario de Identificación del Cliente",
  "Documento que acredita la celebración del Acto u Operación (contrato, factura, etc.)",
  "Instrumento público que acredite la constitución del Cliente",
  "Constancia de inscripción en el Registro Público del instrumento que acredite su constitución",
  "Constancia de Situación Fiscal (SAT)",
  "Comprobante de domicilio del Cliente",
  "Instrumento que contenga los poderes del representante o apoderado legal",
  "Identificación oficial del representante o apoderado legal",
  "Comprobante de domicilio del representante o apoderado legal",
  "Identificación oficial del Beneficiario Controlador",
  "Constancia CURP (o equivalente) del Beneficiario Controlador",
  "Cédula de Identificación Fiscal o NIF del Beneficiario Controlador",
  "Comprobante de domicilio del Beneficiario Controlador (si no coincide con la ID)",
]

const DOCUMENTOS_EUI_PERSONA_FISICA = [
  "Formulario de Identificación del Cliente",
  "Documento que acredita la celebración del Acto u Operación",
  "Identificación oficial del Cliente",
  "Comprobante de domicilio del Cliente",
  "Identificación oficial del Representante (si aplica)",
  "Comprobante de domicilio del Representante (si aplica)",
]

type RespuestaSiNo = "" | "si" | "no"

interface DireccionState {
  codigoPostal: string
  tipoVialidad: string
  nombreVialidad: string
  numeroExterior: string
  numeroInterior: string
  colonia: string
  alcaldia: string
  ciudad: string
  entidad: string
  pais: string
}

interface ContactoState {
  ladaFijo: string
  telefonoFijo: string
  extension: string
  ladaMovil: string
  telefonoMovil: string
  correo: string
}

interface RepresentanteState {
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  rfc: string
  cargo: string
  paisNacionalidad: string
}

interface IdentificacionState {
  tipo: string
  numero: string
  autoridad: string
  vigencia: string
}

interface BeneficiarioState {
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  fechaNacimiento: string
  paisNacionalidad: string
  paisNacimiento: string
  curp: string
  rfc: string
  porcentajeParticipacion: string
  domicilio: DireccionState
  contacto: ContactoState
  resideExtranjero: RespuestaSiNo
  domicilioCorrespondencia: DireccionState
  identificacion: IdentificacionState
}

interface ExpedienteEuiPersonaMoral {
  fechaRegistro: string
  tipoExpediente: string
  sujetoObligadoId: string
  sujetoObligadoNombre: string
  tipoCliente: string
  tipoActoOperacion: string
  fechaActoOperacion: string
  relacionNegocios: RespuestaSiNo
  cliente: {
    denominacion: string
    fechaConstitucion: string
    paisNacionalidad: string
    rfc: string
    actividad: string
  }
  domicilioCliente: DireccionState
  contactoCliente: ContactoState
  representante: RepresentanteState
  identificacionRepresentante: IdentificacionState
  beneficiario1: BeneficiarioState
  beneficiario2?: BeneficiarioState | null
  inmueble: {
    tipo: string
    valorReferencia: string
    folioReal: string
    ubicacion: DireccionState
  }
  documentacion: Record<string, boolean>
}

interface ExpedienteEuiPersonaFisica {
  fechaRegistro: string
  tipoExpediente: string
  sujetoObligadoNombre: string
  sujetoObligadoRfc: string
  tipoCliente: string
  tipoActoOperacion: string
  fechaActoOperacion: string
  relacionNegocios: RespuestaSiNo
  cliente: {
    nombres: string
    apellidoPaterno: string
    apellidoMaterno: string
    fechaNacimiento: string
    paisNacimiento: string
    paisNacionalidad: string
    curp: string
    rfc: string
    ocupacion: string
  }
  domicilioCliente: DireccionState
  contactoCliente: ContactoState
  actuaRepresentante: string
  representante: {
    nombres: string
    apellidoPaterno: string
    apellidoMaterno: string
    fechaNacimiento: string
    paisNacionalidad: string
    ocupacion: string
    contacto: ContactoState
    identificacion: IdentificacionState
  }
  domicilioCorrespondencia: DireccionState
  identificacionCliente: IdentificacionState
  documentacion: Record<string, boolean>
}

interface ExpedientePersonaResumen {
  id?: string
  tipo?: "persona_moral" | "persona_fisica"
  denominacion?: string
  fechaConstitucion?: string
  rfc?: string
  curp?: string
  pais?: string
  giro?: string
  rolRelacion?: string
  representante?: {
    nombre: string
    apellidoPaterno: string
    apellidoMaterno: string
    rfc: string
    curp: string
  } | null
  domicilio?: {
    codigoPostal?: string
    tipoVialidad?: string
    nombreVialidad?: string
    numeroExterior?: string
    numeroInterior?: string
    colonia?: string
    alcaldia?: string
    entidad?: string
    pais?: string
  } | null
  contacto?: {
    clavePais?: string
    telefono?: string
    correo?: string
  } | null
}

interface ExpedienteDetalle {
  rfc: string
  nombre: string
  tipoCliente?: string
  detalleTipoCliente?: string
  sujetoObligadoId?: string
  sujetoObligadoNombre?: string
  expedienteEui?: ExpedienteEuiPersonaMoral | ExpedienteEuiPersonaFisica
  personas?: ExpedientePersonaResumen[]
  actualizadoEn?: string
}

interface ExpedienteResumen {
  rfc: string
  nombre: string
  tipoCliente: string
}

interface ExpedienteListadoItem extends ExpedienteResumen {
  actualizadoEn?: string
  detalle?: ExpedienteDetalle | null
}

interface SujetoObligadoResumen {
  id: string
  nombre: string
  tipo: string
  actividad: string
  identificacion: {
    rfc: string
    nombre: string
    apellidoPaterno: string
    apellidoMaterno: string
    fechaNacimiento: string
    paisNacionalidad: string
    paisNacimiento: string
    curp: string
  }
  contacto: {
    lada: string
    telefonoFijo: string
    extension: string
    telefonoMovil: string
    correo: string
  }
  domicilio: {
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
}

const EXPEDIENTE_DETALLE_STORAGE_KEY = "kyc_expedientes_detalle"
const SEPOMEX_API_BASE = "https://api.zippopotam.us/mx"
const SEPOMEX_STORAGE_PREFIX = "codigo_postal_cache_"

function createDireccion(pais = "MX"): DireccionState {
  return {
    codigoPostal: "",
    tipoVialidad: "",
    nombreVialidad: "",
    numeroExterior: "",
    numeroInterior: "",
    colonia: "",
    alcaldia: "",
    ciudad: "",
    entidad: "",
    pais,
  }
}

function createContacto(): ContactoState {
  return {
    ladaFijo: "",
    telefonoFijo: "",
    extension: "",
    ladaMovil: "",
    telefonoMovil: "",
    correo: "",
  }
}

function createRepresentante(): RepresentanteState {
  return {
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    rfc: "",
    cargo: "",
    paisNacionalidad: "MX",
  }
}

function createIdentificacion(): IdentificacionState {
  return {
    tipo: "",
    numero: "",
    autoridad: "",
    vigencia: "",
  }
}

function createBeneficiario(): BeneficiarioState {
  return {
    nombres: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    fechaNacimiento: "",
    paisNacionalidad: "MX",
    paisNacimiento: "MX",
    curp: "",
    rfc: "",
    porcentajeParticipacion: "",
    domicilio: createDireccion(),
    contacto: createContacto(),
    resideExtranjero: "",
    domicilioCorrespondencia: createDireccion(),
    identificacion: createIdentificacion(),
  }
}

function todayDateString() {
  return new Date().toISOString().split("T")[0]
}

async function fetchCodigoPostalInfo(codigo: string): Promise<CodigoPostalInfo | undefined> {
  try {
    const response = await fetch(`${SEPOMEX_API_BASE}/${codigo}`)
    if (!response.ok) return undefined
    const data = (await response.json()) as {
      country?: string
      "country abbreviation"?: string
      places?: Array<{
        "place name"?: string
        state?: string
        "province"?: string
        "community"?: string
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

function normalizarBusqueda(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
}

function sanitizeDetalle(raw: any): ExpedienteDetalle | null {
  if (!raw || typeof raw !== "object") return null
  const rfc = typeof raw.rfc === "string" ? raw.rfc : ""
  if (!rfc) return null
  return {
    rfc,
    nombre: typeof raw.nombre === "string" ? raw.nombre : rfc,
    tipoCliente: typeof raw.tipoCliente === "string" ? raw.tipoCliente : undefined,
    detalleTipoCliente: typeof raw.detalleTipoCliente === "string" ? raw.detalleTipoCliente : undefined,
    sujetoObligadoId: typeof raw.sujetoObligadoId === "string" ? raw.sujetoObligadoId : undefined,
    sujetoObligadoNombre: typeof raw.sujetoObligadoNombre === "string" ? raw.sujetoObligadoNombre : undefined,
    expedienteEui: typeof raw.expedienteEui === "object" ? (raw.expedienteEui as ExpedienteEuiPersonaMoral) : undefined,
    personas: Array.isArray(raw.personas) ? (raw.personas as ExpedientePersonaResumen[]) : undefined,
    actualizadoEn: typeof raw.actualizadoEn === "string" ? raw.actualizadoEn : undefined,
  }
}

function buildResumen(detalle: ExpedienteDetalle): ExpedienteResumen {
  return {
    rfc: detalle.rfc,
    nombre: detalle.nombre ?? detalle.rfc,
    tipoCliente: detalle.tipoCliente ?? (CLIENTE_TIPOS[0]?.value ?? ""),
  }
}

function formatearFechaActualizacion(fecha?: string) {
  if (!fecha) return null
  const parsed = new Date(fecha)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
}

function buildPersonasDesdeExpediente(expediente: ExpedienteEuiPersonaMoral): ExpedientePersonaResumen[] {
  const representante = expediente.representante
  return [
    {
      id: `cliente-${expediente.cliente.rfc}`,
      tipo: "persona_moral",
      denominacion: expediente.cliente.denominacion,
      fechaConstitucion: expediente.cliente.fechaConstitucion,
      rfc: expediente.cliente.rfc,
      pais: expediente.cliente.paisNacionalidad,
      giro: expediente.cliente.actividad,
      rolRelacion: "Cliente",
      representante: representante.nombre
        ? {
            nombre: representante.nombre,
            apellidoPaterno: representante.apellidoPaterno,
            apellidoMaterno: representante.apellidoMaterno,
            rfc: representante.rfc,
            curp: "",
          }
        : null,
      domicilio: {
        codigoPostal: expediente.domicilioCliente.codigoPostal,
        tipoVialidad: expediente.domicilioCliente.tipoVialidad,
        nombreVialidad: expediente.domicilioCliente.nombreVialidad,
        numeroExterior: expediente.domicilioCliente.numeroExterior,
        numeroInterior: expediente.domicilioCliente.numeroInterior,
        colonia: expediente.domicilioCliente.colonia,
        alcaldia: expediente.domicilioCliente.alcaldia,
        entidad: expediente.domicilioCliente.entidad,
        pais: expediente.domicilioCliente.pais,
      },
      contacto: {
        clavePais: expediente.domicilioCliente.pais,
        telefono: expediente.contactoCliente.telefonoMovil || expediente.contactoCliente.telefonoFijo,
        correo: expediente.contactoCliente.correo,
      },
    },
  ]
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

function KycExpedienteContent() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [sujetosRegistrados, setSujetosRegistrados] = useState<SujetoObligadoResumen[]>([])
  const [tipoExpediente, setTipoExpediente] = useState<string>(EXPEDIENTE_TIPOS[0]?.value ?? "persona_moral")
  const [sujetoObligadoId, setSujetoObligadoId] = useState("")
  const [sujetoObligadoNombrePf, setSujetoObligadoNombrePf] = useState("")
  const [sujetoObligadoRfcPf, setSujetoObligadoRfcPf] = useState("")
  const [tipoCliente, setTipoCliente] = useState<string>(CLIENTE_TIPOS[0]?.value ?? "")
  const [tipoActoOperacion, setTipoActoOperacion] = useState("")
  const [fechaActoOperacion, setFechaActoOperacion] = useState("")
  const [relacionNegocios, setRelacionNegocios] = useState<RespuestaSiNo>("")
  const [clienteDenominacion, setClienteDenominacion] = useState("")
  const [clienteFechaConstitucion, setClienteFechaConstitucion] = useState("")
  const [clientePais, setClientePais] = useState("MX")
  const [clienteRfc, setClienteRfc] = useState("")
  const [clienteActividad, setClienteActividad] = useState("")
  const [domicilioCliente, setDomicilioCliente] = useState<DireccionState>(() => createDireccion())
  const [contactoCliente, setContactoCliente] = useState<ContactoState>(() => createContacto())
  const [representante, setRepresentante] = useState<RepresentanteState>(() => createRepresentante())
  const [identificacionRepresentante, setIdentificacionRepresentante] = useState<IdentificacionState>(() =>
    createIdentificacion(),
  )
  const [beneficiario1, setBeneficiario1] = useState<BeneficiarioState>(() => createBeneficiario())
  const [tieneBeneficiario2, setTieneBeneficiario2] = useState(false)
  const [beneficiario2, setBeneficiario2] = useState<BeneficiarioState>(() => createBeneficiario())
  const [inmuebleTipo, setInmuebleTipo] = useState("")
  const [inmuebleValor, setInmuebleValor] = useState("")
  const [inmuebleFolio, setInmuebleFolio] = useState("")
  const [ubicacionInmueble, setUbicacionInmueble] = useState<DireccionState>(() => createDireccion())
  const [documentacion, setDocumentacion] = useState<Record<string, boolean>>({})
  const [fechaRegistro, setFechaRegistro] = useState(todayDateString())

  const [tipoClienteFisica, setTipoClienteFisica] = useState(TIPO_CLIENTE_PERSONA_FISICA[0] ?? "")
  const [tipoActoOperacionFisica, setTipoActoOperacionFisica] = useState("")
  const [fechaActoOperacionFisica, setFechaActoOperacionFisica] = useState("")
  const [relacionNegociosFisica, setRelacionNegociosFisica] = useState<RespuestaSiNo>("")
  const [clienteFisicaNombres, setClienteFisicaNombres] = useState("")
  const [clienteFisicaApellidoPaterno, setClienteFisicaApellidoPaterno] = useState("")
  const [clienteFisicaApellidoMaterno, setClienteFisicaApellidoMaterno] = useState("")
  const [clienteFisicaFechaNacimiento, setClienteFisicaFechaNacimiento] = useState("")
  const [clienteFisicaPaisNacimiento, setClienteFisicaPaisNacimiento] = useState("MX")
  const [clienteFisicaPaisNacionalidad, setClienteFisicaPaisNacionalidad] = useState("MX")
  const [clienteFisicaCurp, setClienteFisicaCurp] = useState("")
  const [clienteFisicaRfc, setClienteFisicaRfc] = useState("")
  const [clienteFisicaOcupacion, setClienteFisicaOcupacion] = useState("")
  const [domicilioClienteFisica, setDomicilioClienteFisica] = useState<DireccionState>(() => createDireccion())
  const [contactoClienteFisica, setContactoClienteFisica] = useState<ContactoState>(() => createContacto())
  const [actuaRepresentante, setActuaRepresentante] = useState("")
  const [representanteFisica, setRepresentanteFisica] = useState({
    nombres: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    fechaNacimiento: "",
    paisNacionalidad: "MX",
    ocupacion: "",
    contacto: createContacto(),
    identificacion: createIdentificacion(),
  })
  const [domicilioCorrespondenciaFisica, setDomicilioCorrespondenciaFisica] = useState<DireccionState>(() =>
    createDireccion(),
  )
  const [identificacionClienteFisica, setIdentificacionClienteFisica] = useState<IdentificacionState>(() =>
    createIdentificacion(),
  )
  const [documentacionFisica, setDocumentacionFisica] = useState<Record<string, boolean>>({})

  const [expedientesResumen, setExpedientesResumen] = useState<ExpedienteResumen[]>([])
  const [expedientesDetalle, setExpedientesDetalle] = useState<Record<string, ExpedienteDetalle>>({})
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState<string | null>(null)
  const [expedientesCargados, setExpedientesCargados] = useState(false)
  const [busquedaExpedientes, setBusquedaExpedientes] = useState("")

  const tipoClienteLabel = useMemo(() => findClienteTipoLabel(tipoCliente), [tipoCliente])
  useEffect(() => {
    if (typeof window === "undefined") return
    const savedData = window.localStorage.getItem("registro-sat-data")
    if (!savedData) return
    try {
      const data = JSON.parse(savedData) as {
        sujetosRegistrados?: Array<{
          id?: string
          nombre?: string
          tipo?: string
          actividad?: string
          identificacion?: {
            rfc?: string
            nombre?: string
            apellidoPaterno?: string
            apellidoMaterno?: string
            fecha?: string
            paisNacionalidad?: string
            paisNacimiento?: string
            curp?: string
          }
          contactos?: Array<{
            claveLada?: string
            telefonoFijo?: string
            extension?: string
            telefonoMovil?: string
            correo?: string
          }>
          actividades?: Array<{
            domicilio?: {
              codigoPostal?: string
              tipoVialidad?: string
              nombreVialidad?: string
              numeroExterior?: string
              numeroInterior?: string
              colonia?: string
              alcaldia?: string
              entidad?: string
              pais?: string
            }
          }>
        }>
      }
      const sujetos = Array.isArray(data.sujetosRegistrados)
        ? data.sujetosRegistrados
            .map((item) => ({
              id: typeof item.id === "string" ? item.id : "",
              nombre: typeof item.nombre === "string" ? item.nombre : "",
              tipo: typeof item.tipo === "string" ? item.tipo : "",
              actividad: typeof item.actividad === "string" ? item.actividad : "",
              identificacion: {
                rfc: typeof item.identificacion?.rfc === "string" ? item.identificacion.rfc : "",
                nombre: typeof item.identificacion?.nombre === "string" ? item.identificacion.nombre : "",
                apellidoPaterno:
                  typeof item.identificacion?.apellidoPaterno === "string" ? item.identificacion.apellidoPaterno : "",
                apellidoMaterno:
                  typeof item.identificacion?.apellidoMaterno === "string" ? item.identificacion.apellidoMaterno : "",
                fechaNacimiento: typeof item.identificacion?.fecha === "string" ? item.identificacion.fecha : "",
                paisNacionalidad:
                  typeof item.identificacion?.paisNacionalidad === "string"
                    ? item.identificacion.paisNacionalidad
                    : "MX",
                paisNacimiento:
                  typeof item.identificacion?.paisNacimiento === "string"
                    ? item.identificacion.paisNacimiento
                    : "MX",
                curp: typeof item.identificacion?.curp === "string" ? item.identificacion.curp : "",
              },
              contacto: {
                lada: typeof item.contactos?.[0]?.claveLada === "string" ? item.contactos[0].claveLada : "",
                telefonoFijo:
                  typeof item.contactos?.[0]?.telefonoFijo === "string" ? item.contactos[0].telefonoFijo : "",
                extension: typeof item.contactos?.[0]?.extension === "string" ? item.contactos[0].extension : "",
                telefonoMovil:
                  typeof item.contactos?.[0]?.telefonoMovil === "string" ? item.contactos[0].telefonoMovil : "",
                correo: typeof item.contactos?.[0]?.correo === "string" ? item.contactos[0].correo : "",
              },
              domicilio: {
                codigoPostal:
                  typeof item.actividades?.[0]?.domicilio?.codigoPostal === "string"
                    ? item.actividades[0].domicilio.codigoPostal
                    : "",
                tipoVialidad:
                  typeof item.actividades?.[0]?.domicilio?.tipoVialidad === "string"
                    ? item.actividades[0].domicilio.tipoVialidad
                    : "",
                nombreVialidad:
                  typeof item.actividades?.[0]?.domicilio?.nombreVialidad === "string"
                    ? item.actividades[0].domicilio.nombreVialidad
                    : "",
                numeroExterior:
                  typeof item.actividades?.[0]?.domicilio?.numeroExterior === "string"
                    ? item.actividades[0].domicilio.numeroExterior
                    : "",
                numeroInterior:
                  typeof item.actividades?.[0]?.domicilio?.numeroInterior === "string"
                    ? item.actividades[0].domicilio.numeroInterior
                    : "",
                colonia:
                  typeof item.actividades?.[0]?.domicilio?.colonia === "string"
                    ? item.actividades[0].domicilio.colonia
                    : "",
                alcaldia:
                  typeof item.actividades?.[0]?.domicilio?.alcaldia === "string"
                    ? item.actividades[0].domicilio.alcaldia
                    : "",
                entidad:
                  typeof item.actividades?.[0]?.domicilio?.entidad === "string"
                    ? item.actividades[0].domicilio.entidad
                    : "",
                pais:
                  typeof item.actividades?.[0]?.domicilio?.pais === "string"
                    ? item.actividades[0].domicilio.pais
                    : "MX",
              },
            }))
            .filter((item) => item.id && item.nombre)
        : []
      setSujetosRegistrados(sujetos)
    } catch (error) {
      console.error("No se pudo leer sujetos obligados:", error)
    }
  }, [])

  useEffect(() => {
    if (!sujetoObligadoId) return
    const seleccionado = sujetosRegistrados.find((sujeto) => sujeto.id === sujetoObligadoId)
    if (!seleccionado) return
    const nombre = seleccionado.identificacion.nombre || seleccionado.nombre
    const esPersonaFisica = seleccionado.tipo === "fisica"
    if (esPersonaFisica) {
      setTipoExpediente("persona_fisica")
    } else if (seleccionado.tipo === "moral") {
      setTipoExpediente("persona_moral")
    }
    setClienteDenominacion(nombre)
    setClienteRfc(seleccionado.identificacion.rfc)
    setClientePais(seleccionado.identificacion.paisNacionalidad || "MX")
    setClienteActividad(seleccionado.actividad)
    setSujetoObligadoNombrePf(nombre)
    setSujetoObligadoRfcPf(seleccionado.identificacion.rfc)
    setClienteFisicaPaisNacionalidad(seleccionado.identificacion.paisNacionalidad || "MX")
    if (esPersonaFisica) {
      setClienteFisicaNombres(seleccionado.identificacion.nombre)
      setClienteFisicaApellidoPaterno(seleccionado.identificacion.apellidoPaterno)
      setClienteFisicaApellidoMaterno(seleccionado.identificacion.apellidoMaterno)
      setClienteFisicaFechaNacimiento(seleccionado.identificacion.fechaNacimiento)
      setClienteFisicaPaisNacimiento(seleccionado.identificacion.paisNacimiento || "MX")
      setClienteFisicaCurp(seleccionado.identificacion.curp)
      setClienteFisicaRfc(seleccionado.identificacion.rfc)
    }
    setContactoCliente((prev) => ({
      ...prev,
      ladaFijo: seleccionado.contacto.lada,
      telefonoFijo: seleccionado.contacto.telefonoFijo,
      extension: seleccionado.contacto.extension,
      telefonoMovil: seleccionado.contacto.telefonoMovil,
      correo: seleccionado.contacto.correo,
    }))
    setContactoClienteFisica((prev) => ({
      ...prev,
      ladaFijo: seleccionado.contacto.lada,
      telefonoFijo: seleccionado.contacto.telefonoFijo,
      extension: seleccionado.contacto.extension,
      telefonoMovil: seleccionado.contacto.telefonoMovil,
      correo: seleccionado.contacto.correo,
    }))
    setDomicilioCliente((prev) => ({
      ...prev,
      codigoPostal: seleccionado.domicilio.codigoPostal,
      tipoVialidad: seleccionado.domicilio.tipoVialidad,
      nombreVialidad: seleccionado.domicilio.nombreVialidad,
      numeroExterior: seleccionado.domicilio.numeroExterior,
      numeroInterior: seleccionado.domicilio.numeroInterior,
      colonia: seleccionado.domicilio.colonia,
      alcaldia: seleccionado.domicilio.alcaldia,
      entidad: seleccionado.domicilio.entidad,
      pais: seleccionado.domicilio.pais,
      ciudad: prev.ciudad,
    }))
    setDomicilioClienteFisica((prev) => ({
      ...prev,
      codigoPostal: seleccionado.domicilio.codigoPostal,
      tipoVialidad: seleccionado.domicilio.tipoVialidad,
      nombreVialidad: seleccionado.domicilio.nombreVialidad,
      numeroExterior: seleccionado.domicilio.numeroExterior,
      numeroInterior: seleccionado.domicilio.numeroInterior,
      colonia: seleccionado.domicilio.colonia,
      alcaldia: seleccionado.domicilio.alcaldia,
      entidad: seleccionado.domicilio.entidad,
      pais: seleccionado.domicilio.pais,
      ciudad: prev.ciudad,
    }))
  }, [sujetoObligadoId, sujetosRegistrados])

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedDetalle = window.localStorage.getItem(EXPEDIENTE_DETALLE_STORAGE_KEY)
    if (!storedDetalle) {
      setExpedientesCargados(true)
      return
    }
    try {
      const parsed = JSON.parse(storedDetalle) as unknown[]
      if (!Array.isArray(parsed)) {
        setExpedientesCargados(true)
        return
      }
      const detalleList = parsed
        .map((item) => sanitizeDetalle(item))
        .filter((item): item is ExpedienteDetalle => Boolean(item))
      const mapa = new Map<string, ExpedienteDetalle>()
      detalleList.forEach((detalle) => {
        mapa.set(detalle.rfc, detalle)
      })
      setExpedientesDetalle(Object.fromEntries(mapa))
      setExpedientesResumen(detalleList.map(buildResumen))
    } catch (error) {
      console.error("No se pudo cargar expedientes:", error)
    } finally {
      setExpedientesCargados(true)
    }
  }, [])

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
        ...buildResumen(detalle),
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

  const actualizarDireccionDesdeCodigoPostal = useCallback(
    async (codigo: string, setter: (update: DireccionState) => void, direccionActual: DireccionState) => {
      const limpio = codigo.replace(/[^0-9]/g, "").slice(0, 5)
      let info = limpio.length === 5 ? findCodigoPostalInfo(limpio) : undefined

      if (!info && limpio.length === 5) {
        const cacheKey = `${SEPOMEX_STORAGE_PREFIX}${limpio}`
        const cacheRaw = window.localStorage.getItem(cacheKey)
        if (cacheRaw) {
          try {
            const parsed = JSON.parse(cacheRaw) as CodigoPostalInfo
            if (parsed?.codigo) {
              info = parsed
              registerCodigoPostalInfo(parsed)
            }
          } catch (error) {
            console.error("No se pudo leer cache de código postal:", error)
          }
        }
        if (!info) {
          const fetched = await fetchCodigoPostalInfo(limpio)
          if (fetched) {
            info = fetched
            registerCodigoPostalInfo(fetched)
            window.localStorage.setItem(cacheKey, JSON.stringify(fetched))
          }
        }
      }

      const colonias = info?.asentamientos ?? []
      const coloniaActual = colonias.includes(direccionActual.colonia)
        ? direccionActual.colonia
        : colonias[0] ?? ""

      setter({
        ...direccionActual,
        codigoPostal: limpio,
        colonia: coloniaActual,
        alcaldia: info?.municipio ?? (limpio.length === 5 ? direccionActual.alcaldia : ""),
        ciudad: info?.ciudad ?? (limpio.length === 5 ? direccionActual.ciudad : ""),
        entidad: info?.estado ?? (limpio.length === 5 ? direccionActual.entidad : ""),
        pais: info ? "MX" : direccionActual.pais,
      })
    },
    [],
  )

  const aplicarDetalleEnFormulario = useCallback(
    (detalle: ExpedienteDetalle) => {
      const expediente = detalle.expedienteEui
      if (!expediente) return
      setTipoExpediente(expediente.tipoExpediente)
      setFechaRegistro(expediente.fechaRegistro)

      if (expediente.tipoExpediente === "persona_fisica") {
        const expedienteFisica = expediente as ExpedienteEuiPersonaFisica
        setSujetoObligadoNombrePf(expedienteFisica.sujetoObligadoNombre)
        setSujetoObligadoRfcPf(expedienteFisica.sujetoObligadoRfc)
        setTipoClienteFisica(expedienteFisica.tipoCliente)
        setTipoActoOperacionFisica(expedienteFisica.tipoActoOperacion)
        setFechaActoOperacionFisica(expedienteFisica.fechaActoOperacion)
        setRelacionNegociosFisica(expedienteFisica.relacionNegocios)
        setClienteFisicaNombres(expedienteFisica.cliente.nombres)
        setClienteFisicaApellidoPaterno(expedienteFisica.cliente.apellidoPaterno)
        setClienteFisicaApellidoMaterno(expedienteFisica.cliente.apellidoMaterno)
        setClienteFisicaFechaNacimiento(expedienteFisica.cliente.fechaNacimiento)
        setClienteFisicaPaisNacimiento(expedienteFisica.cliente.paisNacimiento)
        setClienteFisicaPaisNacionalidad(expedienteFisica.cliente.paisNacionalidad)
        setClienteFisicaCurp(expedienteFisica.cliente.curp)
        setClienteFisicaRfc(expedienteFisica.cliente.rfc)
        setClienteFisicaOcupacion(expedienteFisica.cliente.ocupacion)
        setDomicilioClienteFisica(expedienteFisica.domicilioCliente)
        setContactoClienteFisica(expedienteFisica.contactoCliente)
        setActuaRepresentante(expedienteFisica.actuaRepresentante)
        setRepresentanteFisica(expedienteFisica.representante)
        setDomicilioCorrespondenciaFisica(expedienteFisica.domicilioCorrespondencia)
        setIdentificacionClienteFisica(expedienteFisica.identificacionCliente)
        setDocumentacionFisica(expedienteFisica.documentacion)
        return
      }

      const expedienteMoral = expediente as ExpedienteEuiPersonaMoral
      setSujetoObligadoId(expedienteMoral.sujetoObligadoId)
      setTipoCliente(expedienteMoral.tipoCliente)
      setTipoActoOperacion(expedienteMoral.tipoActoOperacion)
      setFechaActoOperacion(expedienteMoral.fechaActoOperacion)
      setRelacionNegocios(expedienteMoral.relacionNegocios)
      setClienteDenominacion(expedienteMoral.cliente.denominacion)
      setClienteFechaConstitucion(expedienteMoral.cliente.fechaConstitucion)
      setClientePais(expedienteMoral.cliente.paisNacionalidad)
      setClienteRfc(expedienteMoral.cliente.rfc)
      setClienteActividad(expedienteMoral.cliente.actividad)
      setDomicilioCliente(expedienteMoral.domicilioCliente)
      setContactoCliente(expedienteMoral.contactoCliente)
      setRepresentante(expedienteMoral.representante)
      setIdentificacionRepresentante(expedienteMoral.identificacionRepresentante)
      setBeneficiario1(expedienteMoral.beneficiario1)
      setBeneficiario2(expedienteMoral.beneficiario2 ?? createBeneficiario())
      setTieneBeneficiario2(Boolean(expedienteMoral.beneficiario2))
      setInmuebleTipo(expedienteMoral.inmueble.tipo)
      setInmuebleValor(expedienteMoral.inmueble.valorReferencia)
      setInmuebleFolio(expedienteMoral.inmueble.folioReal)
      setUbicacionInmueble(expedienteMoral.inmueble.ubicacion)
      setDocumentacion(expedienteMoral.documentacion)
    },
    [],
  )

  const limpiarFormulario = useCallback(() => {
    setTipoExpediente(EXPEDIENTE_TIPOS[0]?.value ?? "persona_moral")
    setSujetoObligadoId("")
    setSujetoObligadoNombrePf("")
    setSujetoObligadoRfcPf("")
    setTipoCliente(CLIENTE_TIPOS[0]?.value ?? "")
    setTipoActoOperacion("")
    setFechaActoOperacion("")
    setRelacionNegocios("")
    setClienteDenominacion("")
    setClienteFechaConstitucion("")
    setClientePais("MX")
    setClienteRfc("")
    setClienteActividad("")
    setDomicilioCliente(createDireccion())
    setContactoCliente(createContacto())
    setRepresentante(createRepresentante())
    setIdentificacionRepresentante(createIdentificacion())
    setBeneficiario1(createBeneficiario())
    setBeneficiario2(createBeneficiario())
    setTieneBeneficiario2(false)
    setInmuebleTipo("")
    setInmuebleValor("")
    setInmuebleFolio("")
    setUbicacionInmueble(createDireccion())
    setDocumentacion({})
    setFechaRegistro(todayDateString())
    setTipoClienteFisica(TIPO_CLIENTE_PERSONA_FISICA[0] ?? "")
    setTipoActoOperacionFisica("")
    setFechaActoOperacionFisica("")
    setRelacionNegociosFisica("")
    setClienteFisicaNombres("")
    setClienteFisicaApellidoPaterno("")
    setClienteFisicaApellidoMaterno("")
    setClienteFisicaFechaNacimiento("")
    setClienteFisicaPaisNacimiento("MX")
    setClienteFisicaPaisNacionalidad("MX")
    setClienteFisicaCurp("")
    setClienteFisicaRfc("")
    setClienteFisicaOcupacion("")
    setDomicilioClienteFisica(createDireccion())
    setContactoClienteFisica(createContacto())
    setActuaRepresentante("")
    setRepresentanteFisica({
      nombres: "",
      apellidoPaterno: "",
      apellidoMaterno: "",
      fechaNacimiento: "",
      paisNacionalidad: "MX",
      ocupacion: "",
      contacto: createContacto(),
      identificacion: createIdentificacion(),
    })
    setDomicilioCorrespondenciaFisica(createDireccion())
    setIdentificacionClienteFisica(createIdentificacion())
    setDocumentacionFisica({})
  }, [])

  useEffect(() => {
    if (!expedientesCargados) return
    const buscar = searchParams?.get("buscar")
    if (!buscar) return
    const coincidencia = expedientesDisponibles.find((item) => item.rfc === buscar)
    if (coincidencia?.detalle) {
      setExpedienteSeleccionado(coincidencia.rfc)
      aplicarDetalleEnFormulario(coincidencia.detalle)
      toast({
        title: "Expediente recuperado",
        description: `Se cargó el expediente para ${coincidencia.nombre}.`,
      })
    }
  }, [aplicarDetalleEnFormulario, expedientesCargados, expedientesDisponibles, searchParams, toast])

  const guardarExpediente = () => {
    if (tipoExpediente === "persona_fisica" && !clienteFisicaRfc.trim()) {
      toast({
        title: "Falta RFC",
        description: "Registra el RFC del cliente para guardar el expediente.",
        variant: "destructive",
      })
      return
    }

    if (tipoExpediente !== "persona_fisica" && !clienteRfc.trim()) {
      toast({
        title: "Falta RFC/NIF",
        description: "Registra el RFC/NIF del cliente para guardar el expediente.",
        variant: "destructive",
      })
      return
    }

    const sujetoSeleccionado = sujetosRegistrados.find((sujeto) => sujeto.id === sujetoObligadoId)

    const fechaActual = todayDateString()
    setFechaRegistro(fechaActual)
    if (tipoExpediente === "persona_fisica") {
      const expedienteEui: ExpedienteEuiPersonaFisica = {
        fechaRegistro: fechaActual,
        tipoExpediente,
        sujetoObligadoNombre: sujetoObligadoNombrePf || sujetoSeleccionado?.nombre || "",
        sujetoObligadoRfc: sujetoObligadoRfcPf || sujetoSeleccionado?.identificacion?.rfc || "",
        tipoCliente: tipoClienteFisica,
        tipoActoOperacion: tipoActoOperacionFisica,
        fechaActoOperacion: fechaActoOperacionFisica,
        relacionNegocios: relacionNegociosFisica,
        cliente: {
          nombres: clienteFisicaNombres,
          apellidoPaterno: clienteFisicaApellidoPaterno,
          apellidoMaterno: clienteFisicaApellidoMaterno,
          fechaNacimiento: clienteFisicaFechaNacimiento,
          paisNacimiento: clienteFisicaPaisNacimiento,
          paisNacionalidad: clienteFisicaPaisNacionalidad,
          curp: clienteFisicaCurp,
          rfc: clienteFisicaRfc.toUpperCase(),
          ocupacion: clienteFisicaOcupacion,
        },
        domicilioCliente: domicilioClienteFisica,
        contactoCliente: contactoClienteFisica,
        actuaRepresentante,
        representante: representanteFisica,
        domicilioCorrespondencia: domicilioCorrespondenciaFisica,
        identificacionCliente: identificacionClienteFisica,
        documentacion: documentacionFisica,
      }

      const detalle: ExpedienteDetalle = {
        rfc: expedienteEui.cliente.rfc,
        nombre: `${expedienteEui.cliente.nombres} ${expedienteEui.cliente.apellidoPaterno} ${expedienteEui.cliente.apellidoMaterno}`.trim() ||
          expedienteEui.cliente.rfc,
        tipoCliente: tipoClienteFisica,
        sujetoObligadoNombre: expedienteEui.sujetoObligadoNombre,
        expedienteEui,
        personas: [
          {
            id: `cliente-${expedienteEui.cliente.rfc}`,
            tipo: "persona_fisica",
            denominacion: `${expedienteEui.cliente.nombres} ${expedienteEui.cliente.apellidoPaterno} ${expedienteEui.cliente.apellidoMaterno}`.trim(),
            rfc: expedienteEui.cliente.rfc,
            curp: expedienteEui.cliente.curp,
            pais: expedienteEui.cliente.paisNacionalidad,
            giro: expedienteEui.cliente.ocupacion,
            rolRelacion: "Cliente",
            domicilio: {
              codigoPostal: expedienteEui.domicilioCliente.codigoPostal,
              tipoVialidad: expedienteEui.domicilioCliente.tipoVialidad,
              nombreVialidad: expedienteEui.domicilioCliente.nombreVialidad,
              numeroExterior: expedienteEui.domicilioCliente.numeroExterior,
              numeroInterior: expedienteEui.domicilioCliente.numeroInterior,
              colonia: expedienteEui.domicilioCliente.colonia,
              alcaldia: expedienteEui.domicilioCliente.alcaldia,
              entidad: expedienteEui.domicilioCliente.entidad,
              pais: expedienteEui.domicilioCliente.pais,
            },
            contacto: {
              clavePais: expedienteEui.domicilioCliente.pais,
              telefono: expedienteEui.contactoCliente.telefonoMovil || expedienteEui.contactoCliente.telefonoFijo,
              correo: expedienteEui.contactoCliente.correo,
            },
          },
        ],
        actualizadoEn: new Date().toISOString(),
      }

      setExpedientesDetalle((prev) => ({ ...prev, [detalle.rfc]: detalle }))
      setExpedientesResumen((prev) => {
        const existing = prev.find((item) => item.rfc === detalle.rfc)
        if (existing) {
          return prev.map((item) => (item.rfc === detalle.rfc ? buildResumen(detalle) : item))
        }
        return [...prev, buildResumen(detalle)]
      })
      setExpedienteSeleccionado(detalle.rfc)

      const almacenados = Object.values({ ...expedientesDetalle, [detalle.rfc]: detalle })
      window.localStorage.setItem(EXPEDIENTE_DETALLE_STORAGE_KEY, JSON.stringify(almacenados))

      toast({
        title: "Expediente guardado",
        description: "El expediente se actualizó correctamente.",
      })
      return
    }

    const expedienteEui: ExpedienteEuiPersonaMoral = {
      fechaRegistro: fechaActual,
      tipoExpediente,
      sujetoObligadoId,
      sujetoObligadoNombre: sujetoSeleccionado?.nombre ?? "",
      tipoCliente,
      tipoActoOperacion,
      fechaActoOperacion,
      relacionNegocios,
      cliente: {
        denominacion: clienteDenominacion,
        fechaConstitucion: clienteFechaConstitucion,
        paisNacionalidad: clientePais,
        rfc: clienteRfc.toUpperCase(),
        actividad: clienteActividad,
      },
      domicilioCliente,
      contactoCliente,
      representante,
      identificacionRepresentante,
      beneficiario1,
      beneficiario2: tieneBeneficiario2 ? beneficiario2 : null,
      inmueble: {
        tipo: inmuebleTipo,
        valorReferencia: inmuebleValor,
        folioReal: inmuebleFolio,
        ubicacion: ubicacionInmueble,
      },
      documentacion,
    }

    const detalle: ExpedienteDetalle = {
      rfc: expedienteEui.cliente.rfc,
      nombre: expedienteEui.cliente.denominacion || expedienteEui.cliente.rfc,
      tipoCliente,
      sujetoObligadoId: expedienteEui.sujetoObligadoId,
      sujetoObligadoNombre: expedienteEui.sujetoObligadoNombre,
      expedienteEui,
      personas: buildPersonasDesdeExpediente(expedienteEui),
      actualizadoEn: new Date().toISOString(),
    }

    setExpedientesDetalle((prev) => ({ ...prev, [detalle.rfc]: detalle }))
    setExpedientesResumen((prev) => {
      const existing = prev.find((item) => item.rfc === detalle.rfc)
      if (existing) {
        return prev.map((item) => (item.rfc === detalle.rfc ? buildResumen(detalle) : item))
      }
      return [...prev, buildResumen(detalle)]
    })
    setExpedienteSeleccionado(detalle.rfc)

    const almacenados = Object.values({ ...expedientesDetalle, [detalle.rfc]: detalle })
    window.localStorage.setItem(EXPEDIENTE_DETALLE_STORAGE_KEY, JSON.stringify(almacenados))

    toast({
      title: "Expediente guardado",
      description: "El expediente se actualizó correctamente.",
    })
  }

  const expedientesTotales = expedientesDisponibles.length

  const infoClienteCodigoPostal =
    domicilioCliente.codigoPostal.length === 5 ? findCodigoPostalInfo(domicilioCliente.codigoPostal) : undefined
  const coloniasCliente = infoClienteCodigoPostal?.asentamientos ?? []

  const infoBeneficiario1CodigoPostal =
    beneficiario1.domicilio.codigoPostal.length === 5
      ? findCodigoPostalInfo(beneficiario1.domicilio.codigoPostal)
      : undefined
  const coloniasBeneficiario1 = infoBeneficiario1CodigoPostal?.asentamientos ?? []

  const infoBeneficiario1Correspondencia =
    beneficiario1.domicilioCorrespondencia.codigoPostal.length === 5
      ? findCodigoPostalInfo(beneficiario1.domicilioCorrespondencia.codigoPostal)
      : undefined
  const coloniasBeneficiario1Correspondencia = infoBeneficiario1Correspondencia?.asentamientos ?? []

  const infoBeneficiario2CodigoPostal =
    beneficiario2.domicilio.codigoPostal.length === 5
      ? findCodigoPostalInfo(beneficiario2.domicilio.codigoPostal)
      : undefined
  const coloniasBeneficiario2 = infoBeneficiario2CodigoPostal?.asentamientos ?? []

  const infoBeneficiario2Correspondencia =
    beneficiario2.domicilioCorrespondencia.codigoPostal.length === 5
      ? findCodigoPostalInfo(beneficiario2.domicilioCorrespondencia.codigoPostal)
      : undefined
  const coloniasBeneficiario2Correspondencia = infoBeneficiario2Correspondencia?.asentamientos ?? []

  const infoUbicacionInmueble =
    ubicacionInmueble.codigoPostal.length === 5
      ? findCodigoPostalInfo(ubicacionInmueble.codigoPostal)
      : undefined
  const coloniasInmueble = infoUbicacionInmueble?.asentamientos ?? []

  const infoClienteFisicaCodigoPostal =
    domicilioClienteFisica.codigoPostal.length === 5
      ? findCodigoPostalInfo(domicilioClienteFisica.codigoPostal)
      : undefined
  const coloniasClienteFisica = infoClienteFisicaCodigoPostal?.asentamientos ?? []

  const infoCorrespondenciaFisica =
    domicilioCorrespondenciaFisica.codigoPostal.length === 5
      ? findCodigoPostalInfo(domicilioCorrespondenciaFisica.codigoPostal)
      : undefined
  const coloniasCorrespondenciaFisica = infoCorrespondenciaFisica?.asentamientos ?? []

  const tipoClienteResumen = tipoClienteLabel

  return (
    <div className="space-y-6">
      <Card className="border-slate-200">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-600" /> Expediente único de identificación
            </CardTitle>
            <CardDescription>
              Captura el Expediente Único de Identificación para persona moral o física y conecta con el sujeto obligado registrado.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={limpiarFormulario}>
              Nuevo expediente
            </Button>
            <Button type="button" size="sm" onClick={guardarExpediente}>
              Guardar expediente
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Tipo de expediente</Label>
              <Select value={tipoExpediente} onValueChange={setTipoExpediente}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecciona tipo" />
                </SelectTrigger>
                <SelectContent>
                  {EXPEDIENTE_TIPOS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha de registro / actualización</Label>
              <Input type="date" value={fechaRegistro} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Sujeto obligado</Label>
              <Select value={sujetoObligadoId} onValueChange={setSujetoObligadoId}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder={sujetosRegistrados.length ? "Selecciona sujeto" : "Sin sujetos registrados"} />
                </SelectTrigger>
                <SelectContent>
                  {sujetosRegistrados.map((sujeto) => (
                    <SelectItem key={sujeto.id} value={sujeto.id}>
                      {sujeto.nombre} · {sujeto.tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sujetosRegistrados.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No hay sujetos obligados registrados. Completa el módulo de alta para habilitar esta selección.
                </p>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            {tipoExpediente === "persona_moral"
              ? "Formulario activo: Persona Moral."
              : tipoExpediente === "persona_fisica"
                ? "Formulario activo: Persona Física."
                : "Por ahora solo están habilitados Persona Moral y Persona Física."}
          </div>
        </CardContent>
      </Card>

      {expedientesTotales > 0 ? (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Expedientes guardados</CardTitle>
            <CardDescription>Recupera un expediente anterior para editarlo o actualizarlo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="max-w-sm"
                placeholder="Buscar por RFC o razón social"
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
                      onClick={() => {
                        setExpedienteSeleccionado(item.rfc)
                        if (item.detalle) aplicarDetalleEnFormulario(item.detalle)
                      }}
                      className={`flex w-full flex-col gap-1 p-3 text-left transition ${
                        seleccionado ? "bg-emerald-100/60" : "hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">{item.nombre}</p>
                          <p className="text-xs text-slate-500">{item.rfc}</p>
                        </div>
                        {actualizado && <span className="text-[11px] text-slate-500">{actualizado}</span>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-slate-200">
                          {findClienteTipoLabel(item.tipoCliente)}
                        </Badge>
                      </div>
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Expedientes guardados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Aún no hay expedientes guardados. Completa el formulario y utiliza “Guardar expediente”.
            </p>
          </CardContent>
        </Card>
      )}

      {tipoExpediente === "persona_fisica" && (
        <>
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-slate-600" /> Sujeto obligado
              </CardTitle>
              <CardDescription>Datos del sujeto obligado vinculados al expediente.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre, denominación o razón social</Label>
                <Input value={sujetoObligadoNombrePf} onChange={(event) => setSujetoObligadoNombrePf(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Registro Federal de Contribuyentes (RFC)</Label>
                <Input value={sujetoObligadoRfcPf} onChange={(event) => setSujetoObligadoRfcPf(event.target.value.toUpperCase())} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-slate-600" /> Tipo de cliente y acto u operación
              </CardTitle>
              <CardDescription>Selecciona el tipo de cliente y la fracción aplicable.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de cliente</Label>
                <Select value={tipoClienteFisica} onValueChange={setTipoClienteFisica}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="---" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_CLIENTE_PERSONA_FISICA.map((opcion) => (
                      <SelectItem key={opcion} value={opcion}>
                        {opcion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de acto u operación</Label>
                <Select value={tipoActoOperacionFisica} onValueChange={setTipoActoOperacionFisica}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="---" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTO_OPERACION_PERSONA_FISICA.map((opcion) => (
                      <SelectItem key={opcion} value={opcion}>
                        {opcion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha de celebración del acto u operación</Label>
                <Input
                  type="date"
                  value={fechaActoOperacionFisica}
                  onChange={(event) => setFechaActoOperacionFisica(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>¿Existe relación de negocios?</Label>
                <Select
                  value={relacionNegociosFisica}
                  onValueChange={(value) => setRelacionNegociosFisica(value as RespuestaSiNo)}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="---" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="si">Sí</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-slate-600" /> Datos de identificación del cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nombre(s)</Label>
                <Input value={clienteFisicaNombres} onChange={(event) => setClienteFisicaNombres(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Apellido paterno</Label>
                <Input
                  value={clienteFisicaApellidoPaterno}
                  onChange={(event) => setClienteFisicaApellidoPaterno(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Apellido materno</Label>
                <Input
                  value={clienteFisicaApellidoMaterno}
                  onChange={(event) => setClienteFisicaApellidoMaterno(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de nacimiento</Label>
                <Input
                  type="date"
                  value={clienteFisicaFechaNacimiento}
                  onChange={(event) => setClienteFisicaFechaNacimiento(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>País de nacimiento</Label>
                <Select value={clienteFisicaPaisNacimiento} onValueChange={setClienteFisicaPaisNacimiento}>
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
                <Label>País de nacionalidad</Label>
                <Select value={clienteFisicaPaisNacionalidad} onValueChange={setClienteFisicaPaisNacionalidad}>
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
                <Label>CURP</Label>
                <Input
                  value={clienteFisicaCurp}
                  onChange={(event) => setClienteFisicaCurp(event.target.value.toUpperCase())}
                  placeholder={tipoClienteFisica === "Persona Física Mexicana" ? "Obligatoria" : "Opcional"}
                />
              </div>
              <div className="space-y-2">
                <Label>RFC</Label>
                <Input value={clienteFisicaRfc} onChange={(event) => setClienteFisicaRfc(event.target.value.toUpperCase())} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Actividad, ocupación, profesión</Label>
                <Select value={clienteFisicaOcupacion} onValueChange={setClienteFisicaOcupacion}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecciona ocupación" />
                  </SelectTrigger>
                  <SelectContent>
                    {OCUPACIONES_OPCIONES.map((opcion) => (
                      <SelectItem key={opcion} value={opcion}>
                        {opcion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-slate-600" /> Domicilio del cliente (residencia)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Código Postal</Label>
                  <Input
                    value={domicilioClienteFisica.codigoPostal}
                    onChange={(event) =>
                      actualizarDireccionDesdeCodigoPostal(event.target.value, setDomicilioClienteFisica, domicilioClienteFisica)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de vialidad</Label>
                  <Select
                    value={domicilioClienteFisica.tipoVialidad}
                    onValueChange={(value) => setDomicilioClienteFisica((prev) => ({ ...prev, tipoVialidad: value }))}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="---" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_VIALIDAD_PERSONA_FISICA.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {tipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nombre de la vialidad</Label>
                  <Input
                    value={domicilioClienteFisica.nombreVialidad}
                    onChange={(event) => setDomicilioClienteFisica((prev) => ({ ...prev, nombreVialidad: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número exterior</Label>
                  <Input
                    value={domicilioClienteFisica.numeroExterior}
                    onChange={(event) => setDomicilioClienteFisica((prev) => ({ ...prev, numeroExterior: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número interior</Label>
                  <Input
                    value={domicilioClienteFisica.numeroInterior}
                    onChange={(event) => setDomicilioClienteFisica((prev) => ({ ...prev, numeroInterior: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Colonia / Urbanización</Label>
                  <Select
                    value={domicilioClienteFisica.colonia}
                    onValueChange={(value) => setDomicilioClienteFisica((prev) => ({ ...prev, colonia: value }))}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="---" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(new Set([...coloniasClienteFisica, domicilioClienteFisica.colonia].filter(Boolean))).map((colonia) => (
                        <SelectItem key={colonia} value={colonia}>
                          {colonia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label>Alcaldía / Municipio</Label>
                  <Input value={domicilioClienteFisica.alcaldia} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad o población</Label>
                  <Input value={domicilioClienteFisica.ciudad} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Entidad / Estado / Provincia</Label>
                  <Input value={domicilioClienteFisica.entidad} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>País</Label>
                  <Input value={findPaisByCodigo(domicilioClienteFisica.pais)?.label ?? domicilioClienteFisica.pais} readOnly />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-slate-600" /> Datos de contacto del cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Clave LADA</Label>
                <Input value={contactoClienteFisica.ladaFijo} onChange={(event) => setContactoClienteFisica((prev) => ({ ...prev, ladaFijo: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono fijo</Label>
                <Input value={contactoClienteFisica.telefonoFijo} onChange={(event) => setContactoClienteFisica((prev) => ({ ...prev, telefonoFijo: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Extensión</Label>
                <Input value={contactoClienteFisica.extension} onChange={(event) => setContactoClienteFisica((prev) => ({ ...prev, extension: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Teléfono móvil</Label>
                <Input value={contactoClienteFisica.telefonoMovil} onChange={(event) => setContactoClienteFisica((prev) => ({ ...prev, telefonoMovil: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Correo electrónico</Label>
                <Input type="email" value={contactoClienteFisica.correo} onChange={(event) => setContactoClienteFisica((prev) => ({ ...prev, correo: event.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-slate-600" /> Actúa mediante representante
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>¿El cliente actúa por cuenta propia o mediante representante?</Label>
                <Select value={actuaRepresentante} onValueChange={setActuaRepresentante}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecciona opción" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="si">Sí, el Cliente actúa por conducto de representante o apoderado legal</SelectItem>
                    <SelectItem value="no">No, el Cliente actúa por cuenta propia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {actuaRepresentante === "si" && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-slate-600" /> Datos del representante o apoderado legal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nombre(s)</Label>
                    <Input value={representanteFisica.nombres} onChange={(event) => setRepresentanteFisica((prev) => ({ ...prev, nombres: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellido paterno</Label>
                    <Input value={representanteFisica.apellidoPaterno} onChange={(event) => setRepresentanteFisica((prev) => ({ ...prev, apellidoPaterno: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellido materno</Label>
                    <Input value={representanteFisica.apellidoMaterno} onChange={(event) => setRepresentanteFisica((prev) => ({ ...prev, apellidoMaterno: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de nacimiento</Label>
                    <Input type="date" value={representanteFisica.fechaNacimiento} onChange={(event) => setRepresentanteFisica((prev) => ({ ...prev, fechaNacimiento: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>País de nacionalidad</Label>
                    <Select value={representanteFisica.paisNacionalidad} onValueChange={(value) => setRepresentanteFisica((prev) => ({ ...prev, paisNacionalidad: value }))}>
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
                    <Label>Actividad, ocupación, profesión</Label>
                    <Select value={representanteFisica.ocupacion} onValueChange={(value) => setRepresentanteFisica((prev) => ({ ...prev, ocupacion: value }))}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecciona ocupación" />
                      </SelectTrigger>
                      <SelectContent>
                        {OCUPACIONES_OPCIONES.map((opcion) => (
                          <SelectItem key={opcion} value={opcion}>
                            {opcion}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-700">Datos de contacto del representante</p>
                  <div className="mt-3 grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Clave LADA</Label>
                      <Input value={representanteFisica.contacto.ladaFijo} onChange={(event) => setRepresentanteFisica((prev) => ({ ...prev, contacto: { ...prev.contacto, ladaFijo: event.target.value } }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Teléfono fijo</Label>
                      <Input value={representanteFisica.contacto.telefonoFijo} onChange={(event) => setRepresentanteFisica((prev) => ({ ...prev, contacto: { ...prev.contacto, telefonoFijo: event.target.value } }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Extensión</Label>
                      <Input value={representanteFisica.contacto.extension} onChange={(event) => setRepresentanteFisica((prev) => ({ ...prev, contacto: { ...prev.contacto, extension: event.target.value } }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Teléfono móvil</Label>
                      <Input value={representanteFisica.contacto.telefonoMovil} onChange={(event) => setRepresentanteFisica((prev) => ({ ...prev, contacto: { ...prev.contacto, telefonoMovil: event.target.value } }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Correo electrónico</Label>
                      <Input type="email" value={representanteFisica.contacto.correo} onChange={(event) => setRepresentanteFisica((prev) => ({ ...prev, contacto: { ...prev.contacto, correo: event.target.value } }))} />
                    </div>
                  </div>
                </div>

                <div className="rounded border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-700">Identificación oficial del representante</p>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Tipo de identificación</Label>
                      <Select
                        value={representanteFisica.identificacion.tipo}
                        onValueChange={(value) => setRepresentanteFisica((prev) => ({ ...prev, identificacion: { ...prev.identificacion, tipo: value } }))}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Selecciona identificación" />
                        </SelectTrigger>
                        <SelectContent>
                          {IDENTIFICACION_OPCIONES.map((opcion) => (
                            <SelectItem key={opcion} value={opcion}>
                              {opcion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Número de identificación</Label>
                      <Input value={representanteFisica.identificacion.numero} onChange={(event) => setRepresentanteFisica((prev) => ({ ...prev, identificacion: { ...prev.identificacion, numero: event.target.value } }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Autoridad que emite</Label>
                      <Select
                        value={representanteFisica.identificacion.autoridad}
                        onValueChange={(value) => setRepresentanteFisica((prev) => ({ ...prev, identificacion: { ...prev.identificacion, autoridad: value } }))}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Selecciona autoridad" />
                        </SelectTrigger>
                        <SelectContent>
                          {AUTORIDAD_IDENTIFICACION_OPCIONES.map((opcion) => (
                            <SelectItem key={opcion} value={opcion}>
                              {opcion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Fecha de vigencia</Label>
                      <Input type="date" value={representanteFisica.identificacion.vigencia} onChange={(event) => setRepresentanteFisica((prev) => ({ ...prev, identificacion: { ...prev.identificacion, vigencia: event.target.value } }))} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {(clienteFisicaPaisNacionalidad !== "MX" || (actuaRepresentante === "si" && representanteFisica.paisNacionalidad !== "MX")) && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-slate-600" /> Domicilio en México para correspondencia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Código Postal</Label>
                    <Input
                      value={domicilioCorrespondenciaFisica.codigoPostal}
                      onChange={(event) =>
                        actualizarDireccionDesdeCodigoPostal(event.target.value, setDomicilioCorrespondenciaFisica, domicilioCorrespondenciaFisica)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de vialidad</Label>
                    <Select
                      value={domicilioCorrespondenciaFisica.tipoVialidad}
                      onValueChange={(value) => setDomicilioCorrespondenciaFisica((prev) => ({ ...prev, tipoVialidad: value }))}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="---" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPO_VIALIDAD_PERSONA_FISICA.map((tipo) => (
                          <SelectItem key={tipo} value={tipo}>
                            {tipo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre de la vialidad</Label>
                    <Input
                      value={domicilioCorrespondenciaFisica.nombreVialidad}
                      onChange={(event) => setDomicilioCorrespondenciaFisica((prev) => ({ ...prev, nombreVialidad: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número exterior</Label>
                    <Input
                      value={domicilioCorrespondenciaFisica.numeroExterior}
                      onChange={(event) => setDomicilioCorrespondenciaFisica((prev) => ({ ...prev, numeroExterior: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número interior</Label>
                    <Input
                      value={domicilioCorrespondenciaFisica.numeroInterior}
                      onChange={(event) => setDomicilioCorrespondenciaFisica((prev) => ({ ...prev, numeroInterior: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Colonia / Urbanización</Label>
                    <Select
                      value={domicilioCorrespondenciaFisica.colonia}
                      onValueChange={(value) => setDomicilioCorrespondenciaFisica((prev) => ({ ...prev, colonia: value }))}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="---" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(new Set([...coloniasCorrespondenciaFisica, domicilioCorrespondenciaFisica.colonia].filter(Boolean))).map((colonia) => (
                          <SelectItem key={colonia} value={colonia}>
                            {colonia}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Municipio</Label>
                    <Input value={domicilioCorrespondenciaFisica.alcaldia} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Ciudad</Label>
                    <Input value={domicilioCorrespondenciaFisica.ciudad} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Entidad</Label>
                    <Input value={domicilioCorrespondenciaFisica.entidad} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>País</Label>
                    <Input value={findPaisByCodigo(domicilioCorrespondenciaFisica.pais)?.label ?? domicilioCorrespondenciaFisica.pais} readOnly />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-slate-600" /> Identificación del cliente (documento oficial)
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de identificación</Label>
                <Select
                  value={identificacionClienteFisica.tipo}
                  onValueChange={(value) => setIdentificacionClienteFisica((prev) => ({ ...prev, tipo: value }))}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecciona identificación" />
                  </SelectTrigger>
                  <SelectContent>
                    {IDENTIFICACION_OPCIONES.map((opcion) => (
                      <SelectItem key={opcion} value={opcion}>
                        {opcion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Número de identificación</Label>
                <Input value={identificacionClienteFisica.numero} onChange={(event) => setIdentificacionClienteFisica((prev) => ({ ...prev, numero: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Autoridad que la emite</Label>
                <Select
                  value={identificacionClienteFisica.autoridad}
                  onValueChange={(value) => setIdentificacionClienteFisica((prev) => ({ ...prev, autoridad: value }))}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecciona autoridad" />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTORIDAD_IDENTIFICACION_OPCIONES.map((opcion) => (
                      <SelectItem key={opcion} value={opcion}>
                        {opcion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha de vigencia</Label>
                <Input type="date" value={identificacionClienteFisica.vigencia} onChange={(event) => setIdentificacionClienteFisica((prev) => ({ ...prev, vigencia: event.target.value }))} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-slate-600" /> Integración del expediente (checklist documental)
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {DOCUMENTOS_EUI_PERSONA_FISICA.map((doc) => (
                <label key={doc} className="flex items-start gap-3 rounded border border-slate-200 bg-white p-3 text-sm">
                  <Checkbox
                    checked={Boolean(documentacionFisica[doc])}
                    onCheckedChange={(value) => setDocumentacionFisica((prev) => ({ ...prev, [doc]: Boolean(value) }))}
                  />
                  <span>{doc}</span>
                </label>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {tipoExpediente === "persona_moral" && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-slate-600" /> Tipo de cliente y acto u operación
            </CardTitle>
            <CardDescription>Define el tipo de cliente y la operación celebrada.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de cliente</Label>
              <Select value={tipoCliente} onValueChange={setTipoCliente}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="---" />
                </SelectTrigger>
                <SelectContent>
                  {CLIENTE_TIPOS.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{tipoClienteResumen}</p>
            </div>
            <div className="space-y-2">
              <Label>Tipo de acto u operación</Label>
              <Select value={tipoActoOperacion} onValueChange={setTipoActoOperacion}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="---" />
                </SelectTrigger>
                <SelectContent>
                  {ACTO_OPERACION_OPCIONES.map((opcion) => (
                    <SelectItem key={opcion} value={opcion}>
                      {opcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha de celebración del acto u operación</Label>
              <Input type="date" value={fechaActoOperacion} onChange={(event) => setFechaActoOperacion(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>¿Existe relación de negocios?</Label>
              <Select value={relacionNegocios} onValueChange={(value) => setRelacionNegocios(value as RespuestaSiNo)}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="---" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="si">Sí</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-600" /> Datos de identificación del cliente (Persona Moral)
          </CardTitle>
          <CardDescription>Información general de la persona moral.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Denominación o razón social</Label>
            <Input value={clienteDenominacion} onChange={(event) => setClienteDenominacion(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Fecha de constitución</Label>
            <Input type="date" value={clienteFechaConstitucion} onChange={(event) => setClienteFechaConstitucion(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>País de nacionalidad</Label>
            <Select value={clientePais} onValueChange={setClientePais}>
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
            <Label>RFC / NIF</Label>
            <Input value={clienteRfc} onChange={(event) => setClienteRfc(event.target.value.toUpperCase())} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Actividad, giro mercantil, actividad u objeto social</Label>
            <Textarea value={clienteActividad} onChange={(event) => setClienteActividad(event.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-slate-600" /> Domicilio del cliente
          </CardTitle>
          <CardDescription>Captura base y autollenado derivado por código postal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Código Postal</Label>
              <Input
                value={domicilioCliente.codigoPostal}
                onChange={(event) =>
                  actualizarDireccionDesdeCodigoPostal(event.target.value, setDomicilioCliente, domicilioCliente)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de vialidad</Label>
              <Select
                value={domicilioCliente.tipoVialidad}
                onValueChange={(value) => setDomicilioCliente((prev) => ({ ...prev, tipoVialidad: value }))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="---" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_VIALIDAD_OPCIONES.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre de la vialidad</Label>
              <Input
                value={domicilioCliente.nombreVialidad}
                onChange={(event) => setDomicilioCliente((prev) => ({ ...prev, nombreVialidad: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Número exterior</Label>
              <Input
                value={domicilioCliente.numeroExterior}
                onChange={(event) => setDomicilioCliente((prev) => ({ ...prev, numeroExterior: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Número interior</Label>
              <Input
                value={domicilioCliente.numeroInterior}
                onChange={(event) => setDomicilioCliente((prev) => ({ ...prev, numeroInterior: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Colonia / Urbanización</Label>
              <Select
                value={domicilioCliente.colonia}
                onValueChange={(value) => setDomicilioCliente((prev) => ({ ...prev, colonia: value }))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="---" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(new Set([...coloniasCliente, domicilioCliente.colonia].filter(Boolean))).map((colonia) => (
                    <SelectItem key={colonia} value={colonia}>
                      {colonia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Alcaldía / Municipio</Label>
              <Input value={domicilioCliente.alcaldia} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Ciudad o población</Label>
              <Input value={domicilioCliente.ciudad} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Entidad, estado, provincia</Label>
              <Input value={domicilioCliente.entidad} readOnly />
            </div>
            <div className="space-y-2">
              <Label>País</Label>
              <Input value={findPaisByCodigo(domicilioCliente.pais)?.label ?? domicilioCliente.pais} readOnly />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-slate-600" /> Datos de contacto del cliente
          </CardTitle>
          <CardDescription>Información directa de contacto.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Lada</Label>
            <Input value={contactoCliente.ladaFijo} onChange={(event) => setContactoCliente((prev) => ({ ...prev, ladaFijo: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Número telefónico (fijo)</Label>
            <Input value={contactoCliente.telefonoFijo} onChange={(event) => setContactoCliente((prev) => ({ ...prev, telefonoFijo: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Extensión</Label>
            <Input value={contactoCliente.extension} onChange={(event) => setContactoCliente((prev) => ({ ...prev, extension: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Lada (móvil)</Label>
            <Input value={contactoCliente.ladaMovil} onChange={(event) => setContactoCliente((prev) => ({ ...prev, ladaMovil: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Número telefónico (móvil)</Label>
            <Input value={contactoCliente.telefonoMovil} onChange={(event) => setContactoCliente((prev) => ({ ...prev, telefonoMovil: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Correo electrónico</Label>
            <Input type="email" value={contactoCliente.correo} onChange={(event) => setContactoCliente((prev) => ({ ...prev, correo: event.target.value }))} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-600" /> Representante o apoderado legal
          </CardTitle>
          <CardDescription>Completa solo si el cliente actúa mediante representante.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nombre(s)</Label>
            <Input value={representante.nombre} onChange={(event) => setRepresentante((prev) => ({ ...prev, nombre: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Apellido paterno</Label>
            <Input value={representante.apellidoPaterno} onChange={(event) => setRepresentante((prev) => ({ ...prev, apellidoPaterno: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Apellido materno</Label>
            <Input value={representante.apellidoMaterno} onChange={(event) => setRepresentante((prev) => ({ ...prev, apellidoMaterno: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>RFC / NIF</Label>
            <Input value={representante.rfc} onChange={(event) => setRepresentante((prev) => ({ ...prev, rfc: event.target.value.toUpperCase() }))} />
          </div>
          <div className="space-y-2">
            <Label>Puesto o cargo</Label>
            <Input value={representante.cargo} onChange={(event) => setRepresentante((prev) => ({ ...prev, cargo: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>País de nacionalidad</Label>
            <Select value={representante.paisNacionalidad} onValueChange={(value) => setRepresentante((prev) => ({ ...prev, paisNacionalidad: value }))}>
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
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-600" /> Identificación del representante o apoderado
          </CardTitle>
          <CardDescription>Datos de identificación del representante.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de identificación</Label>
            <Input value={identificacionRepresentante.tipo} onChange={(event) => setIdentificacionRepresentante((prev) => ({ ...prev, tipo: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Número de identificación</Label>
            <Input value={identificacionRepresentante.numero} onChange={(event) => setIdentificacionRepresentante((prev) => ({ ...prev, numero: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Autoridad que emite</Label>
            <Input value={identificacionRepresentante.autoridad} onChange={(event) => setIdentificacionRepresentante((prev) => ({ ...prev, autoridad: event.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Fecha de vigencia</Label>
            <Input type="date" value={identificacionRepresentante.vigencia} onChange={(event) => setIdentificacionRepresentante((prev) => ({ ...prev, vigencia: event.target.value }))} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-600" /> Beneficiario controlador (1)
          </CardTitle>
          <CardDescription>Datos de identificación del beneficiario controlador principal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre(s)</Label>
              <Input value={beneficiario1.nombres} onChange={(event) => setBeneficiario1((prev) => ({ ...prev, nombres: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Apellido paterno</Label>
              <Input value={beneficiario1.apellidoPaterno} onChange={(event) => setBeneficiario1((prev) => ({ ...prev, apellidoPaterno: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Apellido materno</Label>
              <Input value={beneficiario1.apellidoMaterno} onChange={(event) => setBeneficiario1((prev) => ({ ...prev, apellidoMaterno: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Fecha de nacimiento</Label>
              <Input type="date" value={beneficiario1.fechaNacimiento} onChange={(event) => setBeneficiario1((prev) => ({ ...prev, fechaNacimiento: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>País de nacionalidad</Label>
              <Select value={beneficiario1.paisNacionalidad} onValueChange={(value) => setBeneficiario1((prev) => ({ ...prev, paisNacionalidad: value }))}>
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
              <Label>País de nacimiento</Label>
              <Select value={beneficiario1.paisNacimiento} onValueChange={(value) => setBeneficiario1((prev) => ({ ...prev, paisNacimiento: value }))}>
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
              <Label>CURP o equivalente</Label>
              <Input value={beneficiario1.curp} onChange={(event) => setBeneficiario1((prev) => ({ ...prev, curp: event.target.value.toUpperCase() }))} />
            </div>
            <div className="space-y-2">
              <Label>RFC / NIF</Label>
              <Input value={beneficiario1.rfc} onChange={(event) => setBeneficiario1((prev) => ({ ...prev, rfc: event.target.value.toUpperCase() }))} />
            </div>
            <div className="space-y-2">
              <Label>Porcentaje de participación</Label>
              <Input value={beneficiario1.porcentajeParticipacion} onChange={(event) => setBeneficiario1((prev) => ({ ...prev, porcentajeParticipacion: event.target.value }))} />
            </div>
          </div>

          <div className="rounded border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700">Domicilio del beneficiario (lugar de residencia)</p>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Código Postal</Label>
                <Input
                  value={beneficiario1.domicilio.codigoPostal}
                  onChange={(event) =>
                    actualizarDireccionDesdeCodigoPostal(
                      event.target.value,
                      (direccion) => setBeneficiario1((prev) => ({ ...prev, domicilio: direccion })),
                      beneficiario1.domicilio,
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de vialidad</Label>
                <Select
                  value={beneficiario1.domicilio.tipoVialidad}
                  onValueChange={(value) =>
                    setBeneficiario1((prev) => ({ ...prev, domicilio: { ...prev.domicilio, tipoVialidad: value } }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="---" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_VIALIDAD_OPCIONES.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nombre de la vialidad</Label>
                <Input
                  value={beneficiario1.domicilio.nombreVialidad}
                  onChange={(event) =>
                    setBeneficiario1((prev) => ({
                      ...prev,
                      domicilio: { ...prev.domicilio, nombreVialidad: event.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Número exterior</Label>
                <Input
                  value={beneficiario1.domicilio.numeroExterior}
                  onChange={(event) =>
                    setBeneficiario1((prev) => ({
                      ...prev,
                      domicilio: { ...prev.domicilio, numeroExterior: event.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Número interior</Label>
                <Input
                  value={beneficiario1.domicilio.numeroInterior}
                  onChange={(event) =>
                    setBeneficiario1((prev) => ({
                      ...prev,
                      domicilio: { ...prev.domicilio, numeroInterior: event.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Colonia / Urbanización</Label>
                <Select
                  value={beneficiario1.domicilio.colonia}
                  onValueChange={(value) =>
                    setBeneficiario1((prev) => ({
                      ...prev,
                      domicilio: { ...prev.domicilio, colonia: value },
                    }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="---" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(
                      new Set([...coloniasBeneficiario1, beneficiario1.domicilio.colonia].filter(Boolean)),
                    ).map((colonia) => (
                      <SelectItem key={colonia} value={colonia}>
                        {colonia}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Alcaldía / Municipio</Label>
                <Input value={beneficiario1.domicilio.alcaldia} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Ciudad o población</Label>
                <Input value={beneficiario1.domicilio.ciudad} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Entidad, estado, provincia</Label>
                <Input value={beneficiario1.domicilio.entidad} readOnly />
              </div>
              <div className="space-y-2">
                <Label>País</Label>
                <Input
                  value={findPaisByCodigo(beneficiario1.domicilio.pais)?.label ?? beneficiario1.domicilio.pais}
                  readOnly
                />
              </div>
            </div>
          </div>

          <div className="rounded border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700">Datos de contacto</p>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Lada</Label>
                <Input
                  value={beneficiario1.contacto.ladaFijo}
                  onChange={(event) =>
                    setBeneficiario1((prev) => ({
                      ...prev,
                      contacto: { ...prev.contacto, ladaFijo: event.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Número telefónico (fijo)</Label>
                <Input
                  value={beneficiario1.contacto.telefonoFijo}
                  onChange={(event) =>
                    setBeneficiario1((prev) => ({
                      ...prev,
                      contacto: { ...prev.contacto, telefonoFijo: event.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Extensión</Label>
                <Input
                  value={beneficiario1.contacto.extension}
                  onChange={(event) =>
                    setBeneficiario1((prev) => ({
                      ...prev,
                      contacto: { ...prev.contacto, extension: event.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Lada (móvil)</Label>
                <Input
                  value={beneficiario1.contacto.ladaMovil}
                  onChange={(event) =>
                    setBeneficiario1((prev) => ({
                      ...prev,
                      contacto: { ...prev.contacto, ladaMovil: event.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Número telefónico (móvil)</Label>
                <Input
                  value={beneficiario1.contacto.telefonoMovil}
                  onChange={(event) =>
                    setBeneficiario1((prev) => ({
                      ...prev,
                      contacto: { ...prev.contacto, telefonoMovil: event.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Correo electrónico</Label>
                <Input
                  type="email"
                  value={beneficiario1.contacto.correo}
                  onChange={(event) =>
                    setBeneficiario1((prev) => ({
                      ...prev,
                      contacto: { ...prev.contacto, correo: event.target.value },
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="rounded border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700">Domicilio en México para correspondencia</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>¿Reside en el extranjero?</Label>
                <Select
                  value={beneficiario1.resideExtranjero}
                  onValueChange={(value) =>
                    setBeneficiario1((prev) => ({ ...prev, resideExtranjero: value as RespuestaSiNo }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="---" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="si">Sí</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {beneficiario1.resideExtranjero === "si" && (
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Código Postal</Label>
                  <Input
                    value={beneficiario1.domicilioCorrespondencia.codigoPostal}
                    onChange={(event) =>
                      actualizarDireccionDesdeCodigoPostal(
                        event.target.value,
                        (direccion) =>
                          setBeneficiario1((prev) => ({ ...prev, domicilioCorrespondencia: direccion })),
                        beneficiario1.domicilioCorrespondencia,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de vialidad</Label>
                  <Select
                    value={beneficiario1.domicilioCorrespondencia.tipoVialidad}
                    onValueChange={(value) =>
                      setBeneficiario1((prev) => ({
                        ...prev,
                        domicilioCorrespondencia: { ...prev.domicilioCorrespondencia, tipoVialidad: value },
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="---" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_VIALIDAD_OPCIONES.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {tipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nombre de la vialidad</Label>
                  <Input
                    value={beneficiario1.domicilioCorrespondencia.nombreVialidad}
                    onChange={(event) =>
                      setBeneficiario1((prev) => ({
                        ...prev,
                        domicilioCorrespondencia: {
                          ...prev.domicilioCorrespondencia,
                          nombreVialidad: event.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número exterior</Label>
                  <Input
                    value={beneficiario1.domicilioCorrespondencia.numeroExterior}
                    onChange={(event) =>
                      setBeneficiario1((prev) => ({
                        ...prev,
                        domicilioCorrespondencia: {
                          ...prev.domicilioCorrespondencia,
                          numeroExterior: event.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número interior</Label>
                  <Input
                    value={beneficiario1.domicilioCorrespondencia.numeroInterior}
                    onChange={(event) =>
                      setBeneficiario1((prev) => ({
                        ...prev,
                        domicilioCorrespondencia: {
                          ...prev.domicilioCorrespondencia,
                          numeroInterior: event.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Colonia / Urbanización</Label>
                  <Select
                    value={beneficiario1.domicilioCorrespondencia.colonia}
                    onValueChange={(value) =>
                      setBeneficiario1((prev) => ({
                        ...prev,
                        domicilioCorrespondencia: {
                          ...prev.domicilioCorrespondencia,
                          colonia: value,
                        },
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="---" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(
                        new Set([
                          ...coloniasBeneficiario1Correspondencia,
                          beneficiario1.domicilioCorrespondencia.colonia,
                        ].filter(Boolean)),
                      ).map((colonia) => (
                        <SelectItem key={colonia} value={colonia}>
                          {colonia}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Alcaldía / Municipio</Label>
                  <Input value={beneficiario1.domicilioCorrespondencia.alcaldia} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad o población</Label>
                  <Input value={beneficiario1.domicilioCorrespondencia.ciudad} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Entidad, estado, provincia</Label>
                  <Input value={beneficiario1.domicilioCorrespondencia.entidad} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>País</Label>
                  <Input
                    value={
                      findPaisByCodigo(beneficiario1.domicilioCorrespondencia.pais)?.label ??
                      beneficiario1.domicilioCorrespondencia.pais
                    }
                    readOnly
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700">Identificación del beneficiario</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de identificación</Label>
                <Input
                  value={beneficiario1.identificacion.tipo}
                  onChange={(event) =>
                    setBeneficiario1((prev) => ({
                      ...prev,
                      identificacion: { ...prev.identificacion, tipo: event.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Número de identificación</Label>
                <Input
                  value={beneficiario1.identificacion.numero}
                  onChange={(event) =>
                    setBeneficiario1((prev) => ({
                      ...prev,
                      identificacion: { ...prev.identificacion, numero: event.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Autoridad que emite</Label>
                <Input
                  value={beneficiario1.identificacion.autoridad}
                  onChange={(event) =>
                    setBeneficiario1((prev) => ({
                      ...prev,
                      identificacion: { ...prev.identificacion, autoridad: event.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de vigencia</Label>
                <Input
                  type="date"
                  value={beneficiario1.identificacion.vigencia}
                  onChange={(event) =>
                    setBeneficiario1((prev) => ({
                      ...prev,
                      identificacion: { ...prev.identificacion, vigencia: event.target.value },
                    }))
                  }
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-600" /> Beneficiario controlador (2)
          </CardTitle>
          <CardDescription>Completa solo si existe un segundo beneficiario.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox checked={tieneBeneficiario2} onCheckedChange={(value) => setTieneBeneficiario2(Boolean(value))} />
            <span className="text-sm">Capturar segundo beneficiario</span>
          </div>

          {tieneBeneficiario2 && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre(s)</Label>
                  <Input value={beneficiario2.nombres} onChange={(event) => setBeneficiario2((prev) => ({ ...prev, nombres: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Apellido paterno</Label>
                  <Input value={beneficiario2.apellidoPaterno} onChange={(event) => setBeneficiario2((prev) => ({ ...prev, apellidoPaterno: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Apellido materno</Label>
                  <Input value={beneficiario2.apellidoMaterno} onChange={(event) => setBeneficiario2((prev) => ({ ...prev, apellidoMaterno: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de nacimiento</Label>
                  <Input type="date" value={beneficiario2.fechaNacimiento} onChange={(event) => setBeneficiario2((prev) => ({ ...prev, fechaNacimiento: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>País de nacionalidad</Label>
                  <Select value={beneficiario2.paisNacionalidad} onValueChange={(value) => setBeneficiario2((prev) => ({ ...prev, paisNacionalidad: value }))}>
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
                  <Label>País de nacimiento</Label>
                  <Select value={beneficiario2.paisNacimiento} onValueChange={(value) => setBeneficiario2((prev) => ({ ...prev, paisNacimiento: value }))}>
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
                  <Label>CURP o equivalente</Label>
                  <Input value={beneficiario2.curp} onChange={(event) => setBeneficiario2((prev) => ({ ...prev, curp: event.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-2">
                  <Label>RFC / NIF</Label>
                  <Input value={beneficiario2.rfc} onChange={(event) => setBeneficiario2((prev) => ({ ...prev, rfc: event.target.value.toUpperCase() }))} />
                </div>
                <div className="space-y-2">
                  <Label>Porcentaje de participación</Label>
                  <Input value={beneficiario2.porcentajeParticipacion} onChange={(event) => setBeneficiario2((prev) => ({ ...prev, porcentajeParticipacion: event.target.value }))} />
                </div>
              </div>

              <div className="rounded border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-700">Domicilio del beneficiario (lugar de residencia)</p>
                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Código Postal</Label>
                    <Input
                      value={beneficiario2.domicilio.codigoPostal}
                      onChange={(event) =>
                        actualizarDireccionDesdeCodigoPostal(
                          event.target.value,
                          (direccion) => setBeneficiario2((prev) => ({ ...prev, domicilio: direccion })),
                          beneficiario2.domicilio,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de vialidad</Label>
                    <Select
                      value={beneficiario2.domicilio.tipoVialidad}
                      onValueChange={(value) =>
                        setBeneficiario2((prev) => ({
                          ...prev,
                          domicilio: { ...prev.domicilio, tipoVialidad: value },
                        }))
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="---" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPO_VIALIDAD_OPCIONES.map((tipo) => (
                          <SelectItem key={tipo} value={tipo}>
                            {tipo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre de la vialidad</Label>
                    <Input
                      value={beneficiario2.domicilio.nombreVialidad}
                      onChange={(event) =>
                        setBeneficiario2((prev) => ({
                          ...prev,
                          domicilio: { ...prev.domicilio, nombreVialidad: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número exterior</Label>
                    <Input
                      value={beneficiario2.domicilio.numeroExterior}
                      onChange={(event) =>
                        setBeneficiario2((prev) => ({
                          ...prev,
                          domicilio: { ...prev.domicilio, numeroExterior: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número interior</Label>
                    <Input
                      value={beneficiario2.domicilio.numeroInterior}
                      onChange={(event) =>
                        setBeneficiario2((prev) => ({
                          ...prev,
                          domicilio: { ...prev.domicilio, numeroInterior: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Colonia / Urbanización</Label>
                    <Select
                      value={beneficiario2.domicilio.colonia}
                      onValueChange={(value) =>
                        setBeneficiario2((prev) => ({
                          ...prev,
                          domicilio: { ...prev.domicilio, colonia: value },
                        }))
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="---" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(
                          new Set([...coloniasBeneficiario2, beneficiario2.domicilio.colonia].filter(Boolean)),
                        ).map((colonia) => (
                          <SelectItem key={colonia} value={colonia}>
                            {colonia}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Alcaldía / Municipio</Label>
                    <Input value={beneficiario2.domicilio.alcaldia} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Ciudad o población</Label>
                    <Input value={beneficiario2.domicilio.ciudad} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>Entidad, estado, provincia</Label>
                    <Input value={beneficiario2.domicilio.entidad} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>País</Label>
                    <Input
                      value={findPaisByCodigo(beneficiario2.domicilio.pais)?.label ?? beneficiario2.domicilio.pais}
                      readOnly
                    />
                  </div>
                </div>
              </div>

              <div className="rounded border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-700">Datos de contacto</p>
                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Lada</Label>
                    <Input
                      value={beneficiario2.contacto.ladaFijo}
                      onChange={(event) =>
                        setBeneficiario2((prev) => ({
                          ...prev,
                          contacto: { ...prev.contacto, ladaFijo: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número telefónico (fijo)</Label>
                    <Input
                      value={beneficiario2.contacto.telefonoFijo}
                      onChange={(event) =>
                        setBeneficiario2((prev) => ({
                          ...prev,
                          contacto: { ...prev.contacto, telefonoFijo: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Extensión</Label>
                    <Input
                      value={beneficiario2.contacto.extension}
                      onChange={(event) =>
                        setBeneficiario2((prev) => ({
                          ...prev,
                          contacto: { ...prev.contacto, extension: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Lada (móvil)</Label>
                    <Input
                      value={beneficiario2.contacto.ladaMovil}
                      onChange={(event) =>
                        setBeneficiario2((prev) => ({
                          ...prev,
                          contacto: { ...prev.contacto, ladaMovil: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número telefónico (móvil)</Label>
                    <Input
                      value={beneficiario2.contacto.telefonoMovil}
                      onChange={(event) =>
                        setBeneficiario2((prev) => ({
                          ...prev,
                          contacto: { ...prev.contacto, telefonoMovil: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Correo electrónico</Label>
                    <Input
                      type="email"
                      value={beneficiario2.contacto.correo}
                      onChange={(event) =>
                        setBeneficiario2((prev) => ({
                          ...prev,
                          contacto: { ...prev.contacto, correo: event.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="rounded border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-700">Domicilio en México para correspondencia</p>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>¿Reside en el extranjero?</Label>
                    <Select
                      value={beneficiario2.resideExtranjero}
                      onValueChange={(value) =>
                        setBeneficiario2((prev) => ({ ...prev, resideExtranjero: value as RespuestaSiNo }))
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="---" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="si">Sí</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {beneficiario2.resideExtranjero === "si" && (
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Código Postal</Label>
                      <Input
                        value={beneficiario2.domicilioCorrespondencia.codigoPostal}
                        onChange={(event) =>
                          actualizarDireccionDesdeCodigoPostal(
                            event.target.value,
                            (direccion) =>
                              setBeneficiario2((prev) => ({ ...prev, domicilioCorrespondencia: direccion })),
                            beneficiario2.domicilioCorrespondencia,
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de vialidad</Label>
                      <Select
                        value={beneficiario2.domicilioCorrespondencia.tipoVialidad}
                        onValueChange={(value) =>
                          setBeneficiario2((prev) => ({
                            ...prev,
                            domicilioCorrespondencia: { ...prev.domicilioCorrespondencia, tipoVialidad: value },
                          }))
                        }
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="---" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIPO_VIALIDAD_OPCIONES.map((tipo) => (
                            <SelectItem key={tipo} value={tipo}>
                              {tipo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Nombre de la vialidad</Label>
                      <Input
                        value={beneficiario2.domicilioCorrespondencia.nombreVialidad}
                        onChange={(event) =>
                          setBeneficiario2((prev) => ({
                            ...prev,
                            domicilioCorrespondencia: {
                              ...prev.domicilioCorrespondencia,
                              nombreVialidad: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Número exterior</Label>
                      <Input
                        value={beneficiario2.domicilioCorrespondencia.numeroExterior}
                        onChange={(event) =>
                          setBeneficiario2((prev) => ({
                            ...prev,
                            domicilioCorrespondencia: {
                              ...prev.domicilioCorrespondencia,
                              numeroExterior: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Número interior</Label>
                      <Input
                        value={beneficiario2.domicilioCorrespondencia.numeroInterior}
                        onChange={(event) =>
                          setBeneficiario2((prev) => ({
                            ...prev,
                            domicilioCorrespondencia: {
                              ...prev.domicilioCorrespondencia,
                              numeroInterior: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Colonia / Urbanización</Label>
                      <Select
                        value={beneficiario2.domicilioCorrespondencia.colonia}
                        onValueChange={(value) =>
                          setBeneficiario2((prev) => ({
                            ...prev,
                            domicilioCorrespondencia: {
                              ...prev.domicilioCorrespondencia,
                              colonia: value,
                            },
                          }))
                        }
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="---" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from(
                            new Set([
                              ...coloniasBeneficiario2Correspondencia,
                              beneficiario2.domicilioCorrespondencia.colonia,
                            ].filter(Boolean)),
                          ).map((colonia) => (
                            <SelectItem key={colonia} value={colonia}>
                              {colonia}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Alcaldía / Municipio</Label>
                      <Input value={beneficiario2.domicilioCorrespondencia.alcaldia} readOnly />
                    </div>
                    <div className="space-y-2">
                      <Label>Ciudad o población</Label>
                      <Input value={beneficiario2.domicilioCorrespondencia.ciudad} readOnly />
                    </div>
                    <div className="space-y-2">
                      <Label>Entidad, estado, provincia</Label>
                      <Input value={beneficiario2.domicilioCorrespondencia.entidad} readOnly />
                    </div>
                    <div className="space-y-2">
                      <Label>País</Label>
                      <Input
                        value={
                          findPaisByCodigo(beneficiario2.domicilioCorrespondencia.pais)?.label ??
                          beneficiario2.domicilioCorrespondencia.pais
                        }
                        readOnly
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-700">Identificación del beneficiario</p>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo de identificación</Label>
                    <Input
                      value={beneficiario2.identificacion.tipo}
                      onChange={(event) =>
                        setBeneficiario2((prev) => ({
                          ...prev,
                          identificacion: { ...prev.identificacion, tipo: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número de identificación</Label>
                    <Input
                      value={beneficiario2.identificacion.numero}
                      onChange={(event) =>
                        setBeneficiario2((prev) => ({
                          ...prev,
                          identificacion: { ...prev.identificacion, numero: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Autoridad que emite</Label>
                    <Input
                      value={beneficiario2.identificacion.autoridad}
                      onChange={(event) =>
                        setBeneficiario2((prev) => ({
                          ...prev,
                          identificacion: { ...prev.identificacion, autoridad: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de vigencia</Label>
                    <Input
                      type="date"
                      value={beneficiario2.identificacion.vigencia}
                      onChange={(event) =>
                        setBeneficiario2((prev) => ({
                          ...prev,
                          identificacion: { ...prev.identificacion, vigencia: event.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5 text-slate-600" /> Características del inmueble
          </CardTitle>
          <CardDescription>Datos del inmueble asociado al acto u operación.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de inmueble</Label>
            <Select value={inmuebleTipo} onValueChange={setInmuebleTipo}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="---" />
              </SelectTrigger>
              <SelectContent>
                {TIPO_INMUEBLE_OPCIONES.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor de referencia</Label>
            <Input value={inmuebleValor} onChange={(event) => setInmuebleValor(event.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Folio real o antecedentes registrales</Label>
            <Input value={inmuebleFolio} onChange={(event) => setInmuebleFolio(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-slate-600" /> Ubicación del inmueble
          </CardTitle>
          <CardDescription>Captura base y derivada por código postal.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Código Postal</Label>
              <Input
                value={ubicacionInmueble.codigoPostal}
                onChange={(event) =>
                  actualizarDireccionDesdeCodigoPostal(event.target.value, setUbicacionInmueble, ubicacionInmueble)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de vialidad</Label>
              <Select
                value={ubicacionInmueble.tipoVialidad}
                onValueChange={(value) => setUbicacionInmueble((prev) => ({ ...prev, tipoVialidad: value }))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="---" />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_VIALIDAD_OPCIONES.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>
                      {tipo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre de la vialidad</Label>
              <Input
                value={ubicacionInmueble.nombreVialidad}
                onChange={(event) => setUbicacionInmueble((prev) => ({ ...prev, nombreVialidad: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Número exterior</Label>
              <Input
                value={ubicacionInmueble.numeroExterior}
                onChange={(event) => setUbicacionInmueble((prev) => ({ ...prev, numeroExterior: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Número interior</Label>
              <Input
                value={ubicacionInmueble.numeroInterior}
                onChange={(event) => setUbicacionInmueble((prev) => ({ ...prev, numeroInterior: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Colonia / Urbanización</Label>
              <Select
                value={ubicacionInmueble.colonia}
                onValueChange={(value) => setUbicacionInmueble((prev) => ({ ...prev, colonia: value }))}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="---" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(new Set([...coloniasInmueble, ubicacionInmueble.colonia].filter(Boolean))).map((colonia) => (
                    <SelectItem key={colonia} value={colonia}>
                      {colonia}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Alcaldía / Municipio</Label>
              <Input value={ubicacionInmueble.alcaldia} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Ciudad o población</Label>
              <Input value={ubicacionInmueble.ciudad} readOnly />
            </div>
            <div className="space-y-2">
              <Label>Entidad, estado, provincia</Label>
              <Input value={ubicacionInmueble.entidad} readOnly />
            </div>
            <div className="space-y-2">
              <Label>País</Label>
              <Input value={findPaisByCodigo(ubicacionInmueble.pais)?.label ?? ubicacionInmueble.pais} readOnly />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-600" /> Documentación que integra el EUI – Persona Moral
          </CardTitle>
          <CardDescription>Marca cada documento como presente o no presente.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {DOCUMENTOS_EUI.map((doc) => (
            <label key={doc} className="flex items-start gap-3 rounded border border-slate-200 bg-white p-3 text-sm">
              <Checkbox
                checked={Boolean(documentacion[doc])}
                onCheckedChange={(value) => setDocumentacion((prev) => ({ ...prev, [doc]: Boolean(value) }))}
              />
              <span>{doc}</span>
            </label>
          ))}
        </CardContent>
      </Card>
      )}
    </div>
  )
}
