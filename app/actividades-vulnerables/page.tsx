"use client"

import Link from "next/link"
import { type ChangeEvent, useEffect, useMemo, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Info,
  Layers,
  ListChecks,
  Paperclip,
  PlayCircle,
  Plus,
  ShieldAlert,
  Trash2,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react"
import type { ActividadVulnerable } from "@/lib/data/actividades"
import { actividadesVulnerables } from "@/lib/data/actividades"
import { UMA_MONTHS, findUmaByMonthYear } from "@/lib/data/uma"
import { CLIENTE_TIPOS, type ClienteTipoOption } from "@/lib/data/tipos-cliente"
import {
  ENTIDADES_FEDERATIVAS,
  FIGURA_CLIENTE_OPCIONES,
  FIGURA_SUJETO_OBLIGADO_OPCIONES,
  FORMAS_PAGO,
  INSTRUMENTOS_MONETARIOS,
  MONEDAS_EXTENDIDAS,
  PAISES,
  PAISES_TELEFONO,
  TIPOS_INMUEBLE,
  TIPOS_OPERACION_INMUEBLE,
  type CatalogOption,
} from "@/lib/data/catalogos"
import { buscarCodigoPostal } from "@/lib/data/postal-mx"

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

const WEEK_DAYS = ["L", "M", "M", "J", "V", "S", "D"]

const LEGACY_CLIENTE_TIPO_MAP: Record<string, ClienteTipoOption["value"]> = {
  pfn: "pf_residente",
  pfe: "pf_visitante",
  pmn: "pm_mexicana",
  pme: "pm_extranjera",
  fideicomiso: "fideicomiso",
  dependencia: "pm_derecho_publico",
  vehiculo: "entidad_financiera",
  otro: "entidad_financiera",
}

const STEPS = [
  {
    id: 0,
    titulo: "Actividad y periodo",
    descripcion: "Selecciona la fracción aplicable y el mes de análisis (UMAs oficiales desde septiembre 2020).",
  },
  {
    id: 1,
    titulo: "Cliente y operación",
    descripcion: "Captura datos del cliente, clasifica el tipo y determina el monto a validar contra el umbral.",
  },
  {
    id: 2,
    titulo: "Resultado y obligaciones",
    descripcion: "Visualiza automáticamente las obligaciones aplicables, genera avisos o informe 27 Bis.",
  },
]

type UmbralStatus = "sin-obligacion" | "identificacion" | "aviso"

type InfoModalKey = "umbral-identificacion" | "umbral-aviso" | "uma-validacion"

const OPERACIONES_STORAGE_KEY = "actividades_vulnerables_operaciones"
const EXPEDIENTE_DETALLE_STORAGE_KEY = "kyc_expedientes_detalle"

const CONTROLES_ARTICULO_17: Record<UmbralStatus, string[]> = {
  "sin-obligacion": [
    "Conservar registro de operaciones y responsables durante al menos cinco años.",
    "Designar oficial de cumplimiento y mantener políticas de identificación actualizadas.",
    "Aplicar monitoreo transaccional básico y listas restrictivas internas.",
  ],
  identificacion: [
    "Integrar expediente único con documentación de identificación completa.",
    "Verificar listas de personas bloqueadas y reportar coincidencias inmediatas.",
    "Aplicar medidas reforzadas de debida diligencia y validar beneficiario final.",
  ],
  aviso: [
    "Generar aviso ante la Unidad de Inteligencia Financiera dentro de los 17 días hábiles.",
    "Adjuntar soportes documentales y conservar acuse de envío o informe 27 Bis.",
    "Suspender el cómputo de acumulación hasta confirmar atención del aviso.",
  ],
}

const INFO_MODAL_CONTENT: Record<InfoModalKey, { title: string; body: string[] }> = {
  "umbral-identificacion": {
    title: "¿Qué es el umbral de identificación?",
    body: [
      "Algunas de las Actividades Vulnerables del artículo 17 de la Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita se consideran como tales por el simple hecho de su realización; en otras, la obligación surge cuando el monto rebasa el umbral previsto.",
      "El umbral de identificación se determina multiplicando la UMA diaria vigente del periodo seleccionado por el número de UMAs que la ley asigna a cada fracción. Al rebasarlo se debe integrar expediente completo, validar listas y monitorear al cliente durante los seis meses siguientes.",
    ],
  },
  "umbral-aviso": {
    title: "¿Cuándo se genera el umbral de aviso?",
    body: [
      "Quienes realizan Actividades Vulnerables deben presentar avisos ante la Secretaría de Hacienda y Crédito Público cuando las operaciones de sus clientes superan los montos que establece la LFPIORPI.",
      "En algunas fracciones el aviso procede por la simple realización de la actividad, mientras que en otras se activa cuando el monto acumulado rebasa el umbral correspondiente. El aviso debe enviarse dentro de los 17 días posteriores, incluyendo detalle del acto, participantes y soportes documentales.",
    ],
  },
  "uma-validacion": {
    title: "Validación de UMAs por año",
    body: [
      "El valor diario de la UMA para 2025 es de $113.14 MXN conforme al decreto publicado por el INEGI el 10 de enero de 2025. Los montos en pesos del módulo se calculan automáticamente a partir del año y mes seleccionados.",
      "Selecciona un año diferente para verificar cómo cambian los umbrales con base en la UMA vigente de cada ciclo (1.º de febrero al 31 de enero). Así puedes validar obligaciones históricas y proyectar escenarios futuros con información consistente.",
    ],
  },
}

interface OperacionCliente {
  id: string
  actividadKey: string
  actividadNombre: string
  tipoCliente: string
  detalleTipoCliente?: string
  cliente: string
  rfc: string
  mismoGrupo: boolean
  periodo: string
  mes: number
  anio: number
  monto: number
  moneda: string
  monedaDescripcion: string
  fechaOperacion: string
  tipoOperacion: string
  evidencia: string
  umaDiaria: number
  identificacionUmbralPesos: number
  avisoUmbralPesos: number
  umbralStatus: UmbralStatus
  acumuladoCliente: number
  alerta: string | null
  avisoPresentado: boolean
  alertaResuelta: boolean
  documentosSoporte: DocumentoSoporte[]
  requisitosChecklist: Record<string, boolean>
  kycIntegrado: boolean
  cuestionarioInmueble?: CuestionarioInmuebleForm
}

interface ClienteGuardado {
  rfc: string
  nombre: string
  tipoCliente: string
  mismoGrupo: boolean
  detalleTipoCliente?: string
}

type FormularioEdicion = {
  cliente: string
  rfc: string
  tipoCliente: string
  mismoGrupo: "si" | "no"
  tipoOperacion: string
  monto: string
  moneda: string
  monedaPersonalizadaCodigo: string
  monedaPersonalizadaDescripcion: string
  fechaOperacion: string
  evidencia: string
  detalleTipoCliente: string
}

interface DocumentoSoporte {
  id: string
  requisito: string
  notas: string
  archivoNombre?: string
  archivoContenido?: string
  fechaRegistro: string
}

type PersonaAvisoTipo = "persona_moral" | "persona_fisica"
type DomicilioAmbito = "nacional" | "extranjero"

interface PersonaAvisoForm {
  tipoPersona: PersonaAvisoTipo
  denominacionRazon: string
  fechaConstitucion: string
  rfc: string
  nacionalidad: string
  giro: string
  representante: {
    nombre: string
    apellidoPaterno: string
    apellidoMaterno: string
    fechaNacimiento: string
    rfc: string
    curp: string
  }
  domicilio: {
    ambito: DomicilioAmbito
    pais: string
    entidad: string
    municipio: string
    colonia: string
    codigoPostal: string
    calle: string
    numeroExterior: string
    numeroInterior: string
  }
  telefono: string
  clavePaisTelefono: string
  correoElectronico: string
}

interface BeneficiarioControladorForm {
  tipoPersona: PersonaAvisoTipo
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  fechaNacimiento: string
  rfc: string
  curp: string
  paisNacionalidad: string
}

interface ContraparteOperacionForm {
  tipoPersona: PersonaAvisoTipo
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  fechaNacimiento: string
  rfc: string
  paisNacionalidad: string
}

interface UbicacionInmuebleForm {
  codigoPostal: string
  estado: string
  municipio: string
  colonia: string
  calle: string
  numeroExterior: string
  numeroInterior: string
}

interface CaracteristicasInmuebleForm {
  tipoInmueble: string
  valorPactado: string
  dimensionTerreno: string
  dimensionConstruida: string
  folioReal: string
  ubicacion: UbicacionInmuebleForm
}

interface InstrumentoPublicoForm {
  numero: string
  fecha: string
  notario: string
  entidad: string
  valorAvaluo: string
}

interface LiquidacionInmuebleForm {
  fechaPago: string
  formaPago: string
  instrumentoMonetario: string
  moneda: string
  montoOperacion: string
}

interface DatosOperacionInmuebleForm {
  fechaOperacion: string
  tipoOperacion: string
  figuraCliente: string
  figuraSujetoObligado: string
  fechaInicio: string
  fechaTermino: string
  caracteristicas: CaracteristicasInmuebleForm
  instrumento: InstrumentoPublicoForm
  liquidacion: LiquidacionInmuebleForm
  contraparte: ContraparteOperacionForm
}

interface CuestionarioInmuebleForm {
  referenciaAviso: string
  prioridad: string
  alertaTipo: string
  alertaDescripcion: string
  claveSujetoObligado: string
  claveActividad: string
  personaReportada: PersonaAvisoForm
  incluirBeneficiario: boolean
  beneficiario: BeneficiarioControladorForm
  datosOperacion: DatosOperacionInmuebleForm
  incluirContraparte: boolean
}

interface ExpedienteDetalle {
  rfc: string
  nombre?: string
  claveSujetoObligado?: string
  claveActividadVulnerable?: string
  identificacion?: Record<string, string>
  datosFiscales?: Record<string, string>
  perfilOperaciones?: Record<string, string>
  documentacion?: Record<string, unknown>
  personas?: Array<Record<string, any>>
}

function crearUbicacionInmuebleBase(): UbicacionInmuebleForm {
  return {
    codigoPostal: "",
    estado: "",
    municipio: "",
    colonia: "",
    calle: "",
    numeroExterior: "",
    numeroInterior: "",
  }
}

function crearPersonaAvisoBase(): PersonaAvisoForm {
  return {
    tipoPersona: "persona_moral",
    denominacionRazon: "",
    fechaConstitucion: "",
    rfc: "",
    nacionalidad: "MX",
    giro: "",
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
    telefono: "",
    clavePaisTelefono: "52",
    correoElectronico: "",
  }
}

function crearBeneficiarioControladorBase(): BeneficiarioControladorForm {
  return {
    tipoPersona: "persona_fisica",
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    fechaNacimiento: "",
    rfc: "",
    curp: "",
    paisNacionalidad: "MX",
  }
}

function crearContraparteOperacionBase(): ContraparteOperacionForm {
  return {
    tipoPersona: "persona_fisica",
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    fechaNacimiento: "",
    rfc: "",
    paisNacionalidad: "MX",
  }
}

function crearDatosOperacionInmuebleBase(): DatosOperacionInmuebleForm {
  return {
    fechaOperacion: new Date().toISOString().substring(0, 10),
    tipoOperacion: "501",
    figuraCliente: "2",
    figuraSujetoObligado: "1",
    fechaInicio: "",
    fechaTermino: "",
    caracteristicas: {
      tipoInmueble: "1",
      valorPactado: "",
      dimensionTerreno: "",
      dimensionConstruida: "",
      folioReal: "",
      ubicacion: crearUbicacionInmuebleBase(),
    },
    instrumento: {
      numero: "",
      fecha: "",
      notario: "",
      entidad: "",
      valorAvaluo: "",
    },
    liquidacion: {
      fechaPago: "",
      formaPago: "1",
      instrumentoMonetario: "1",
      moneda: "MXN",
      montoOperacion: "",
    },
    contraparte: crearContraparteOperacionBase(),
  }
}

function crearCuestionarioInmuebleBase(): CuestionarioInmuebleForm {
  return {
    referenciaAviso: "",
    prioridad: "1",
    alertaTipo: "521",
    alertaDescripcion: "",
    claveSujetoObligado: "",
    claveActividad: "INM",
    personaReportada: crearPersonaAvisoBase(),
    incluirBeneficiario: false,
    beneficiario: crearBeneficiarioControladorBase(),
    datosOperacion: crearDatosOperacionInmuebleBase(),
    incluirContraparte: false,
  }
}

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1
const START_WINDOW = new Date(2020, 8, 1) // septiembre 2020

const CLIENTES_STORAGE_KEY = "actividades_vulnerables_clientes"
const NUEVO_CLIENTE_VALUE = "__nuevo__"

function normalizarTipoCliente(value: string) {
  const option = CLIENTE_TIPOS.find((tipo) => tipo.value === value)
  if (option) {
    return option.value
  }
  return LEGACY_CLIENTE_TIPO_MAP[value] ?? value
}

function obtenerOpcionTipoCliente(value: string) {
  return CLIENTE_TIPOS.find((tipo) => tipo.value === value)
}

const TIPO_CLIENTE_OBLIGACIONES: Record<string, keyof ActividadVulnerable["clienteObligaciones"]> = {
  pf_residente: "personaFisica",
  pf_visitante: "personaExtranjera",
  pm_mexicana: "personaMoral",
  pm_extranjera: "personaExtranjera",
  entidad_financiera: "otro",
  fideicomiso: "fideicomiso",
  organismo_internacional: "autoridad",
  pm_derecho_publico: "autoridad",
  pm_derecho_publico_simplificado: "autoridad",
  // valores legados
  pfn: "personaFisica",
  pfe: "personaExtranjera",
  pmn: "personaMoral",
  pme: "personaExtranjera",
  dependencia: "autoridad",
  vehiculo: "vehiculo",
  otro: "otro",
}

function ordenarClientesGuardados(clientes: ClienteGuardado[]) {
  return [...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
}

function getMonedaLabel(value: string) {
  const found = MONEDAS_EXTENDIDAS.find((moneda) => moneda.value === value)
  return found ? found.label : value
}

function formatTipoClienteLabel(value: string, detalle?: string) {
  const option = obtenerOpcionTipoCliente(normalizarTipoCliente(value))
  const base = option ? option.label : value
  return detalle ? `${base} – ${detalle}` : base
}

function formatDateDisplay(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function buildChecklist(
  actividad: ActividadVulnerable,
  tipoCliente: string,
  existente?: Record<string, boolean>,
) {
  const tipoNormalizado = normalizarTipoCliente(tipoCliente)
  const key =
    TIPO_CLIENTE_OBLIGACIONES[tipoNormalizado as keyof typeof TIPO_CLIENTE_OBLIGACIONES] ??
    TIPO_CLIENTE_OBLIGACIONES[tipoCliente as keyof typeof TIPO_CLIENTE_OBLIGACIONES] ??
    "otro"
  const requisitosBase = actividad.clienteObligaciones[key]
  const checklist: Record<string, boolean> = {}

  requisitosBase.forEach((item) => {
    checklist[item] = existente?.[item] ?? false
  })

  return checklist
}

function obtenerAlertaPorStatus(status: UmbralStatus) {
  if (status === "aviso") {
    return "Supera el umbral de aviso. Preparar aviso en 17 días y suspender acumulación."
  }
  if (status === "identificacion") {
    return "Supera el umbral de identificación. Integrar expediente y vigilar acumulación por 6 meses."
  }
  return null
}

function recalcularOperaciones(lista: OperacionCliente[]) {
  const acumulados = new Map<string, number>()

  return lista.map((operacion) => {
    const key = `${operacion.actividadKey}-${operacion.periodo}-${operacion.rfc}`
    const acumuladoPrevio = acumulados.get(key) ?? 0

    if (operacion.avisoPresentado) {
      const statusPresentado: UmbralStatus =
        operacion.monto >= operacion.avisoUmbralPesos
          ? "aviso"
          : operacion.monto >= operacion.identificacionUmbralPesos
            ? "identificacion"
            : "sin-obligacion"

      acumulados.set(key, 0)

      return {
        ...operacion,
        acumuladoCliente: operacion.monto,
        umbralStatus: statusPresentado,
        alerta: operacion.alerta ?? obtenerAlertaPorStatus(statusPresentado),
        alertaResuelta: true,
      }
    }

    const nuevoAcumulado = acumuladoPrevio + operacion.monto

    let status: UmbralStatus = "sin-obligacion"
    if (nuevoAcumulado >= operacion.avisoUmbralPesos) {
      status = "aviso"
    } else if (nuevoAcumulado >= operacion.identificacionUmbralPesos) {
      status = "identificacion"
    }

    acumulados.set(key, nuevoAcumulado)

    const alertaCalculada = obtenerAlertaPorStatus(status)
    let alertaResuelta = operacion.alertaResuelta

    if (!alertaCalculada) {
      alertaResuelta = true
    } else if (operacion.alerta !== alertaCalculada) {
      alertaResuelta = false
    }

    return {
      ...operacion,
      acumuladoCliente: nuevoAcumulado,
      umbralStatus: status,
      alerta: alertaCalculada,
      alertaResuelta,
    }
  })
}

function formatCurrency(value: number, currency = "MXN") {
  try {
    return value.toLocaleString("es-MX", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    })
  } catch (_error) {
    return `${value.toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currency}`
  }
}

function monthLabel(month: number) {
  return MONTHS[month - 1] ?? ""
}

function buildPeriodo(year: number, month: number) {
  return `${year}${month.toString().padStart(2, "0")}`
}

function getStatusLabel(status: UmbralStatus) {
  if (status === "aviso") return "Aviso obligatorio"
  if (status === "identificacion") return "Identificación obligatoria"
  return "Sin obligación"
}

function getStatusColor(status: UmbralStatus) {
  if (status === "aviso") return "bg-red-500"
  if (status === "identificacion") return "bg-amber-500"
  return "bg-emerald-500"
}

function formatUmbralTexto(uma: number, pesos: number) {
  if (uma === 0) {
    return "Siempre"
  }
  return `${formatCurrency(pesos)} (${uma.toLocaleString("es-MX")} UMA)`
}

function formatMontoOperacion(operacion: OperacionCliente) {
  const currencyCode = operacion.moneda && operacion.moneda.length === 3 ? operacion.moneda : "MXN"
  return `${formatCurrency(operacion.monto, currencyCode)} (${operacion.monedaDescripcion})`
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function formatDateToXml(value: string) {
  if (!value) return ""
  if (/^\d{8}$/.test(value)) return value
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.replace(/-/g, "")
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const year = date.getFullYear().toString().padStart(4, "0")
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return `${year}${month}${day}`
}

function formatMontoXml(value: string | number) {
  const numero = typeof value === "number" ? value : Number.parseFloat(value.replace(/,/g, ""))
  if (Number.isNaN(numero)) return "0.00"
  return numero.toFixed(2)
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

function normalizarTextoComparacion(valor: string) {
  return valor.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase()
}

function buscarCodigoPaisPorNombre(nombre: string) {
  const criterio = normalizarTextoComparacion(nombre)
  const encontrado = PAISES.find((pais) => normalizarTextoComparacion(pais.label) === criterio)
  return encontrado?.value ?? "MX"
}

function buildInmuebleXml(operacion: OperacionCliente) {
  if (!operacion.cuestionarioInmueble) {
    return ""
  }

  const data = operacion.cuestionarioInmueble
  const persona = data.personaReportada
  const beneficiario = data.incluirBeneficiario ? data.beneficiario : null
  const datos = data.datosOperacion
  const contraparte = data.incluirContraparte ? datos.contraparte : null

  const periodo = operacion.periodo || buildPeriodo(operacion.anio, operacion.mes)
  const referencia = data.referenciaAviso.trim() || `AV-${operacion.id.slice(0, 8).toUpperCase()}`
  const prioridad = data.prioridad.trim() || "1"
  const claveActividad = (data.claveActividad || operacion.actividadKey).toUpperCase()
  const claveSujeto = data.claveSujetoObligado || operacion.rfc

  const personaNombreTokens = persona.denominacionRazon.trim().split(/\s+/)
  const personaNombre = personaNombreTokens.shift() ?? ""
  const personaApellidoPaterno = personaNombreTokens.shift() ?? ""
  const personaApellidoMaterno = personaNombreTokens.join(" ")

  const repr = persona.representante
  const domicilio = persona.domicilio
  const ubicacionInmueble = datos.caracteristicas.ubicacion

  const telefono = persona.telefono.trim()
  const correo = persona.correoElectronico.trim()

  const counterNombreTokens = contraparte?.nombre?.trim().split(/\s+/) ?? []
  const counterNombre = contraparte ? counterNombreTokens.shift() ?? contraparte.nombre : ""
  const counterApellidoPaterno = contraparte
    ? contraparte.apellidoPaterno || counterNombreTokens.shift() || ""
    : ""
  const counterApellidoMaterno = contraparte
    ? contraparte.apellidoMaterno || counterNombreTokens.join(" ")
    : ""

  const tag = (nombre: string, valor: string | undefined, nivel: number) => {
    if (!valor || valor.trim() === "") return ""
    return `${"  ".repeat(nivel)}<${nombre}>${escapeXml(valor.trim())}</${nombre}>\n`
  }

  let xml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
  xml +=
    '<archivo xmlns="http://www.uif.shcp.gob.mx/recepcion/inm" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.uif.shcp.gob.mx/recepcion/inm inm.xsd">\n'
  xml += "  <informe>\n"
  xml += tag("mes_reportado", periodo, 2)
  xml += "    <sujeto_obligado>\n"
  xml += tag("clave_sujeto_obligado", claveSujeto, 3)
  xml += tag("clave_actividad", claveActividad, 3)
  xml += "    </sujeto_obligado>\n"
  xml += "    <aviso>\n"
  xml += tag("referencia_aviso", referencia, 3)
  xml += tag("prioridad", prioridad, 3)
  xml += "      <alerta>\n"
  xml += tag("tipo_alerta", data.alertaTipo || "521", 4)
  if (data.alertaDescripcion.trim()) {
    xml += tag("descripcion_alerta", data.alertaDescripcion, 4)
  }
  xml += "      </alerta>\n"
  xml += "      <persona_aviso>\n"
  xml += "        <tipo_persona>\n"
  if (persona.tipoPersona === "persona_moral") {
    xml += "          <persona_moral>\n"
    xml += tag("denominacion_razon", persona.denominacionRazon, 5)
    xml += tag("fecha_constitucion", formatDateToXml(persona.fechaConstitucion), 5)
    xml += tag("pais_nacionalidad", persona.nacionalidad || "MX", 5)
    xml += tag("giro_mercantil", persona.giro || "", 5)
    if (
      repr.nombre.trim() ||
      repr.apellidoPaterno.trim() ||
      repr.apellidoMaterno.trim() ||
      repr.fechaNacimiento.trim() ||
      repr.rfc.trim()
    ) {
      xml += "            <representante_apoderado>\n"
      xml += tag("nombre", repr.nombre, 6)
      xml += tag("apellido_paterno", repr.apellidoPaterno, 6)
      xml += tag("apellido_materno", repr.apellidoMaterno, 6)
      xml += tag("fecha_nacimiento", formatDateToXml(repr.fechaNacimiento), 6)
      xml += tag("rfc", repr.rfc, 6)
      xml += "            </representante_apoderado>\n"
    }
    xml += "          </persona_moral>\n"
  } else {
    xml += "          <persona_fisica>\n"
    xml += tag("nombre", personaNombre, 5)
    xml += tag("apellido_paterno", personaApellidoPaterno, 5)
    xml += tag("apellido_materno", personaApellidoMaterno, 5)
    xml += tag("fecha_nacimiento", formatDateToXml(persona.fechaConstitucion), 5)
    xml += tag("rfc", persona.rfc, 5)
    xml += tag("pais_nacionalidad", persona.nacionalidad || "MX", 5)
    xml += "          </persona_fisica>\n"
  }
  xml += "        </tipo_persona>\n"
  xml += "        <tipo_domicilio>\n"
  if (domicilio.ambito === "nacional") {
    xml += "          <nacional>\n"
    xml += tag("colonia", domicilio.colonia, 5)
    xml += tag("calle", domicilio.calle, 5)
    xml += tag("numero_exterior", domicilio.numeroExterior, 5)
    xml += tag("numero_interior", domicilio.numeroInterior, 5)
    xml += tag("codigo_postal", domicilio.codigoPostal, 5)
    xml += tag("municipio", domicilio.municipio, 5)
    xml += tag("entidad_federativa", domicilio.entidad, 5)
    xml += "          </nacional>\n"
  } else {
    xml += "          <extranjero>\n"
    xml += tag("pais", domicilio.pais || persona.nacionalidad || "MX", 5)
    const direccion = `${domicilio.calle} ${domicilio.numeroExterior}`.trim()
    xml += tag("direccion", direccion || domicilio.colonia || "", 5)
    xml += "          </extranjero>\n"
  }
  xml += "        </tipo_domicilio>\n"
  if (telefono) {
    xml += "        <telefono>\n"
    xml += tag("numero_telefono", telefono, 5)
    xml += "        </telefono>\n"
  }
  if (correo) {
    xml += tag("correo_electronico", correo, 4)
  }
  xml += "      </persona_aviso>\n"

  if (beneficiario) {
    xml += "      <dueno_beneficiario>\n"
    xml += "        <tipo_persona>\n"
    if (beneficiario.tipoPersona === "persona_moral") {
      xml += "          <persona_moral>\n"
      xml += tag("denominacion_razon", beneficiario.nombre, 6)
      xml += tag("pais_nacionalidad", beneficiario.paisNacionalidad || "MX", 6)
      xml += "          </persona_moral>\n"
    } else {
      xml += "          <persona_fisica>\n"
      xml += tag("nombre", beneficiario.nombre, 6)
      xml += tag("apellido_paterno", beneficiario.apellidoPaterno, 6)
      xml += tag("apellido_materno", beneficiario.apellidoMaterno, 6)
      xml += tag("fecha_nacimiento", formatDateToXml(beneficiario.fechaNacimiento), 6)
      xml += tag("rfc", beneficiario.rfc, 6)
      xml += tag("pais_nacionalidad", beneficiario.paisNacionalidad || "MX", 6)
      xml += "          </persona_fisica>\n"
    }
    xml += "        </tipo_persona>\n"
    xml += "      </dueno_beneficiario>\n"
  }

  xml += "      <detalle_operaciones>\n"
  xml += "        <datos_operacion>\n"
  xml += tag("fecha_operacion", formatDateToXml(datos.fechaOperacion), 6)
  xml += tag("tipo_operacion", datos.tipoOperacion, 6)
  xml += tag("figura_cliente", datos.figuraCliente, 6)
  xml += tag("figura_so", datos.figuraSujetoObligado, 6)

  if (contraparte) {
    xml += "          <datos_contraparte>\n"
    xml += "            <tipo_persona>\n"
    if (contraparte.tipoPersona === "persona_moral") {
      xml += "              <persona_moral>\n"
      xml += tag("denominacion_razon", contraparte.nombre, 8)
      xml += tag("pais_nacionalidad", contraparte.paisNacionalidad || "MX", 8)
      xml += "              </persona_moral>\n"
    } else {
      xml += "              <persona_fisica>\n"
      xml += tag("nombre", counterNombre, 8)
      xml += tag("apellido_paterno", contraparte.apellidoPaterno || counterApellidoPaterno, 8)
      xml += tag("apellido_materno", contraparte.apellidoMaterno || counterApellidoMaterno, 8)
      xml += tag("fecha_nacimiento", formatDateToXml(contraparte.fechaNacimiento), 8)
      xml += tag("rfc", contraparte.rfc, 8)
      xml += tag("pais_nacionalidad", contraparte.paisNacionalidad || "MX", 8)
      xml += "              </persona_fisica>\n"
    }
    xml += "            </tipo_persona>\n"
    xml += "          </datos_contraparte>\n"
  }

  xml += "          <caracteristicas_inmueble>\n"
  xml += tag("tipo_inmueble", datos.caracteristicas.tipoInmueble, 8)
  xml += tag("valor_pactado", formatMontoXml(datos.caracteristicas.valorPactado), 8)
  xml += tag("colonia", ubicacionInmueble.colonia, 8)
  xml += tag("calle", ubicacionInmueble.calle, 8)
  xml += tag("numero_exterior", ubicacionInmueble.numeroExterior, 8)
  xml += tag("numero_interior", ubicacionInmueble.numeroInterior, 8)
  xml += tag("codigo_postal", ubicacionInmueble.codigoPostal, 8)
  xml += tag("dimension_terreno", datos.caracteristicas.dimensionTerreno, 8)
  xml += tag("dimension_construido", datos.caracteristicas.dimensionConstruida, 8)
  xml += tag("folio_real", datos.caracteristicas.folioReal, 8)
  xml += "          </caracteristicas_inmueble>\n"

  xml += "          <contrato_instrumento_publico>\n"
  xml += "            <datos_instrumento_publico>\n"
  xml += tag("numero_instrumento_publico", datos.instrumento.numero, 8)
  xml += tag("fecha_instrumento_publico", formatDateToXml(datos.instrumento.fecha), 8)
  xml += tag("notario_instrumento_publico", datos.instrumento.notario, 8)
  xml += tag("entidad_instrumento_publico", datos.instrumento.entidad, 8)
  xml += tag("valor_avaluo_catastral", formatMontoXml(datos.instrumento.valorAvaluo), 8)
  xml += "            </datos_instrumento_publico>\n"
  xml += "          </contrato_instrumento_publico>\n"

  xml += "          <datos_liquidacion>\n"
  xml += tag("fecha_pago", formatDateToXml(datos.liquidacion.fechaPago), 8)
  xml += tag("forma_pago", datos.liquidacion.formaPago, 8)
  xml += tag("instrumento_monetario", datos.liquidacion.instrumentoMonetario, 8)
  xml += tag("moneda", datos.liquidacion.moneda, 8)
  xml += tag("monto_operacion", formatMontoXml(datos.liquidacion.montoOperacion), 8)
  xml += "          </datos_liquidacion>\n"
  xml += "        </datos_operacion>\n"
  xml += "      </detalle_operaciones>\n"
  xml += "    </aviso>\n"
  xml += "  </informe>\n"
  xml += "</archivo>\n"

  return xml
}

function sanitizeDocumento(raw: any): DocumentoSoporte | null {
  if (!raw || typeof raw !== "object") return null
  const id = typeof raw.id === "string" ? raw.id : typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`
  const requisito = typeof raw.requisito === "string" ? raw.requisito : "Documento adjunto"
  const notas = typeof raw.notas === "string" ? raw.notas : ""
  const archivoNombre = typeof raw.archivoNombre === "string" ? raw.archivoNombre : undefined
  const archivoContenido = typeof raw.archivoContenido === "string" ? raw.archivoContenido : undefined
  const fechaRegistro =
    typeof raw.fechaRegistro === "string" ? raw.fechaRegistro : new Date().toISOString().substring(0, 10)

  return { id, requisito, notas, archivoNombre, archivoContenido, fechaRegistro }
}

function sanitizeCuestionarioInmueble(raw: any): CuestionarioInmuebleForm | undefined {
  if (!raw || typeof raw !== "object") return undefined

  const base = crearCuestionarioInmuebleBase()

  const personaRaw =
    typeof raw.personaReportada === "object" && raw.personaReportada
      ? (raw.personaReportada as Record<string, any>)
      : typeof raw.persona === "object" && raw.persona
        ? (raw.persona as Record<string, any>)
        : {}
  const persona: PersonaAvisoForm = {
    ...base.personaReportada,
    tipoPersona:
      personaRaw.tipoPersona === "persona_fisica" || personaRaw.tipoPersona === "persona_moral"
        ? personaRaw.tipoPersona
        : base.personaReportada.tipoPersona,
    denominacionRazon:
      typeof personaRaw.denominacionRazon === "string"
        ? personaRaw.denominacionRazon
        : base.personaReportada.denominacionRazon,
    fechaConstitucion:
      typeof personaRaw.fechaConstitucion === "string"
        ? personaRaw.fechaConstitucion
        : base.personaReportada.fechaConstitucion,
    rfc: typeof personaRaw.rfc === "string" ? personaRaw.rfc : base.personaReportada.rfc,
    nacionalidad:
      typeof personaRaw.nacionalidad === "string"
        ? personaRaw.nacionalidad
        : base.personaReportada.nacionalidad,
    giro: typeof personaRaw.giro === "string" ? personaRaw.giro : base.personaReportada.giro,
    representante: {
      ...base.personaReportada.representante,
      ...(typeof personaRaw.representante === "object" && personaRaw.representante
        ? (personaRaw.representante as Record<string, any>)
        : {}),
    },
    domicilio: {
      ...base.personaReportada.domicilio,
      ...(typeof personaRaw.domicilio === "object" && personaRaw.domicilio
        ? (personaRaw.domicilio as Record<string, any>)
        : {}),
    },
    telefono: typeof personaRaw.telefono === "string" ? personaRaw.telefono : base.personaReportada.telefono,
    clavePaisTelefono:
      typeof personaRaw.clavePaisTelefono === "string"
        ? personaRaw.clavePaisTelefono
        : base.personaReportada.clavePaisTelefono,
    correoElectronico:
      typeof personaRaw.correoElectronico === "string"
        ? personaRaw.correoElectronico
        : base.personaReportada.correoElectronico,
  }

  const beneficiarioRaw =
    typeof raw.beneficiario === "object" && raw.beneficiario
      ? (raw.beneficiario as Record<string, any>)
      : {}
  const beneficiario: BeneficiarioControladorForm = {
    ...base.beneficiario,
    tipoPersona:
      beneficiarioRaw.tipoPersona === "persona_fisica" || beneficiarioRaw.tipoPersona === "persona_moral"
        ? beneficiarioRaw.tipoPersona
        : base.beneficiario.tipoPersona,
    nombre: typeof beneficiarioRaw.nombre === "string" ? beneficiarioRaw.nombre : base.beneficiario.nombre,
    apellidoPaterno:
      typeof beneficiarioRaw.apellidoPaterno === "string"
        ? beneficiarioRaw.apellidoPaterno
        : base.beneficiario.apellidoPaterno,
    apellidoMaterno:
      typeof beneficiarioRaw.apellidoMaterno === "string"
        ? beneficiarioRaw.apellidoMaterno
        : base.beneficiario.apellidoMaterno,
    fechaNacimiento:
      typeof beneficiarioRaw.fechaNacimiento === "string"
        ? beneficiarioRaw.fechaNacimiento
        : base.beneficiario.fechaNacimiento,
    rfc: typeof beneficiarioRaw.rfc === "string" ? beneficiarioRaw.rfc : base.beneficiario.rfc,
    curp: typeof beneficiarioRaw.curp === "string" ? beneficiarioRaw.curp : base.beneficiario.curp,
    paisNacionalidad:
      typeof beneficiarioRaw.paisNacionalidad === "string"
        ? beneficiarioRaw.paisNacionalidad
        : base.beneficiario.paisNacionalidad,
  }

  const datosOperacionRaw =
    typeof raw.datosOperacion === "object" && raw.datosOperacion
      ? (raw.datosOperacion as Record<string, any>)
      : {}

  const caracteristicasRaw =
    typeof datosOperacionRaw.caracteristicas === "object" && datosOperacionRaw.caracteristicas
      ? (datosOperacionRaw.caracteristicas as Record<string, any>)
      : {}
  const ubicacionRaw =
    typeof caracteristicasRaw.ubicacion === "object" && caracteristicasRaw.ubicacion
      ? (caracteristicasRaw.ubicacion as Record<string, any>)
      : {}

  const instrumentoRaw =
    typeof datosOperacionRaw.instrumento === "object" && datosOperacionRaw.instrumento
      ? (datosOperacionRaw.instrumento as Record<string, any>)
      : {}
  const liquidacionRaw =
    typeof datosOperacionRaw.liquidacion === "object" && datosOperacionRaw.liquidacion
      ? (datosOperacionRaw.liquidacion as Record<string, any>)
      : {}
  const contraparteRaw =
    typeof datosOperacionRaw.contraparte === "object" && datosOperacionRaw.contraparte
      ? (datosOperacionRaw.contraparte as Record<string, any>)
      : {}

  const datosOperacion: DatosOperacionInmuebleForm = {
    ...base.datosOperacion,
    fechaOperacion:
      typeof datosOperacionRaw.fechaOperacion === "string"
        ? datosOperacionRaw.fechaOperacion
        : base.datosOperacion.fechaOperacion,
    tipoOperacion:
      typeof datosOperacionRaw.tipoOperacion === "string"
        ? datosOperacionRaw.tipoOperacion
        : base.datosOperacion.tipoOperacion,
    figuraCliente:
      typeof datosOperacionRaw.figuraCliente === "string"
        ? datosOperacionRaw.figuraCliente
        : base.datosOperacion.figuraCliente,
    figuraSujetoObligado:
      typeof datosOperacionRaw.figuraSujetoObligado === "string"
        ? datosOperacionRaw.figuraSujetoObligado
        : base.datosOperacion.figuraSujetoObligado,
    fechaInicio:
      typeof datosOperacionRaw.fechaInicio === "string"
        ? datosOperacionRaw.fechaInicio
        : base.datosOperacion.fechaInicio,
    fechaTermino:
      typeof datosOperacionRaw.fechaTermino === "string"
        ? datosOperacionRaw.fechaTermino
        : base.datosOperacion.fechaTermino,
    caracteristicas: {
      ...base.datosOperacion.caracteristicas,
      tipoInmueble:
        typeof caracteristicasRaw.tipoInmueble === "string"
          ? caracteristicasRaw.tipoInmueble
          : base.datosOperacion.caracteristicas.tipoInmueble,
      valorPactado:
        typeof caracteristicasRaw.valorPactado === "string"
          ? caracteristicasRaw.valorPactado
          : base.datosOperacion.caracteristicas.valorPactado,
      dimensionTerreno:
        typeof caracteristicasRaw.dimensionTerreno === "string"
          ? caracteristicasRaw.dimensionTerreno
          : base.datosOperacion.caracteristicas.dimensionTerreno,
      dimensionConstruida:
        typeof caracteristicasRaw.dimensionConstruida === "string"
          ? caracteristicasRaw.dimensionConstruida
          : base.datosOperacion.caracteristicas.dimensionConstruida,
      folioReal:
        typeof caracteristicasRaw.folioReal === "string"
          ? caracteristicasRaw.folioReal
          : base.datosOperacion.caracteristicas.folioReal,
      ubicacion: {
        ...base.datosOperacion.caracteristicas.ubicacion,
        ...ubicacionRaw,
      },
    },
    instrumento: {
      ...base.datosOperacion.instrumento,
      numero: typeof instrumentoRaw.numero === "string" ? instrumentoRaw.numero : base.datosOperacion.instrumento.numero,
      fecha: typeof instrumentoRaw.fecha === "string" ? instrumentoRaw.fecha : base.datosOperacion.instrumento.fecha,
      notario:
        typeof instrumentoRaw.notario === "string" ? instrumentoRaw.notario : base.datosOperacion.instrumento.notario,
      entidad:
        typeof instrumentoRaw.entidad === "string" ? instrumentoRaw.entidad : base.datosOperacion.instrumento.entidad,
      valorAvaluo:
        typeof instrumentoRaw.valorAvaluo === "string"
          ? instrumentoRaw.valorAvaluo
          : base.datosOperacion.instrumento.valorAvaluo,
    },
    liquidacion: {
      ...base.datosOperacion.liquidacion,
      fechaPago:
        typeof liquidacionRaw.fechaPago === "string"
          ? liquidacionRaw.fechaPago
          : base.datosOperacion.liquidacion.fechaPago,
      formaPago:
        typeof liquidacionRaw.formaPago === "string"
          ? liquidacionRaw.formaPago
          : base.datosOperacion.liquidacion.formaPago,
      instrumentoMonetario:
        typeof liquidacionRaw.instrumentoMonetario === "string"
          ? liquidacionRaw.instrumentoMonetario
          : base.datosOperacion.liquidacion.instrumentoMonetario,
      moneda:
        typeof liquidacionRaw.moneda === "string"
          ? liquidacionRaw.moneda
          : base.datosOperacion.liquidacion.moneda,
      montoOperacion:
        typeof liquidacionRaw.montoOperacion === "string"
          ? liquidacionRaw.montoOperacion
          : base.datosOperacion.liquidacion.montoOperacion,
    },
    contraparte: {
      ...base.datosOperacion.contraparte,
      tipoPersona:
        contraparteRaw.tipoPersona === "persona_fisica" || contraparteRaw.tipoPersona === "persona_moral"
          ? contraparteRaw.tipoPersona
          : base.datosOperacion.contraparte.tipoPersona,
      nombre:
        typeof contraparteRaw.nombre === "string"
          ? contraparteRaw.nombre
          : base.datosOperacion.contraparte.nombre,
      apellidoPaterno:
        typeof contraparteRaw.apellidoPaterno === "string"
          ? contraparteRaw.apellidoPaterno
          : base.datosOperacion.contraparte.apellidoPaterno,
      apellidoMaterno:
        typeof contraparteRaw.apellidoMaterno === "string"
          ? contraparteRaw.apellidoMaterno
          : base.datosOperacion.contraparte.apellidoMaterno,
      fechaNacimiento:
        typeof contraparteRaw.fechaNacimiento === "string"
          ? contraparteRaw.fechaNacimiento
          : base.datosOperacion.contraparte.fechaNacimiento,
      rfc:
        typeof contraparteRaw.rfc === "string"
          ? contraparteRaw.rfc
          : base.datosOperacion.contraparte.rfc,
      paisNacionalidad:
        typeof contraparteRaw.paisNacionalidad === "string"
          ? contraparteRaw.paisNacionalidad
          : base.datosOperacion.contraparte.paisNacionalidad,
    },
  }

  return {
    ...base,
    referenciaAviso:
      typeof raw.referenciaAviso === "string" ? raw.referenciaAviso : base.referenciaAviso,
    prioridad:
      typeof raw.prioridad === "string" ? raw.prioridad : base.prioridad,
    alertaTipo:
      typeof raw.alertaTipo === "string" ? raw.alertaTipo : base.alertaTipo,
    alertaDescripcion:
      typeof raw.alertaDescripcion === "string" ? raw.alertaDescripcion : base.alertaDescripcion,
    claveSujetoObligado:
      typeof raw.claveSujetoObligado === "string" ? raw.claveSujetoObligado : base.claveSujetoObligado,
    claveActividad:
      typeof raw.claveActividad === "string" ? raw.claveActividad : base.claveActividad,
    personaReportada: persona,
    incluirBeneficiario: Boolean(raw.incluirBeneficiario),
    beneficiario,
    datosOperacion,
    incluirContraparte: Boolean(raw.incluirContraparte),
  }
}

function sanitizeOperacion(raw: any): OperacionCliente | null {
  if (!raw || typeof raw !== "object") return null

  const actividad = actividadesVulnerables.find((item) => item.key === raw.actividadKey)
  if (!actividad) return null

  const id = typeof raw.id === "string" ? raw.id : typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`
  const tipoCliente =
    typeof raw.tipoCliente === "string"
      ? normalizarTipoCliente(raw.tipoCliente)
      : CLIENTE_TIPOS[0]?.value ?? "pf_residente"
  const moneda = typeof raw.moneda === "string" ? raw.moneda : "MXN"
  const monedaDescripcion =
    typeof raw.monedaDescripcion === "string" ? raw.monedaDescripcion : getMonedaLabel(moneda)

  const documentosRaw = Array.isArray(raw.documentosSoporte) ? raw.documentosSoporte : []
  const documentosSoporte = documentosRaw
    .map((doc) => sanitizeDocumento(doc))
    .filter((doc): doc is DocumentoSoporte => Boolean(doc))

  const requisitosChecklist = buildChecklist(actividad, tipoCliente, raw.requisitosChecklist)

  const cuestionarioInmueble = sanitizeCuestionarioInmueble(
    (raw.cuestionarioInmueble as any) ?? raw.detalleInmueble ?? raw.inmuebleDetalle ?? raw.inmueble,
  )

  return {
    id,
    actividadKey: actividad.key,
    actividadNombre:
      typeof raw.actividadNombre === "string"
        ? raw.actividadNombre
        : `${actividad.fraccion} – ${actividad.nombre}`,
    tipoCliente,
    detalleTipoCliente:
      typeof raw.detalleTipoCliente === "string" && raw.detalleTipoCliente.trim().length > 0
        ? raw.detalleTipoCliente.trim()
        : undefined,
    cliente: typeof raw.cliente === "string" ? raw.cliente : "Cliente sin nombre",
    rfc: typeof raw.rfc === "string" ? raw.rfc : "RFC",
    mismoGrupo: Boolean(raw.mismoGrupo),
    periodo: typeof raw.periodo === "string" ? raw.periodo : "",
    mes: Number(raw.mes) || currentMonth,
    anio: Number(raw.anio) || currentYear,
    monto: Number(raw.monto) || 0,
    moneda,
    monedaDescripcion,
    fechaOperacion:
      typeof raw.fechaOperacion === "string"
        ? raw.fechaOperacion
        : new Date().toISOString().substring(0, 10),
    tipoOperacion: typeof raw.tipoOperacion === "string" ? raw.tipoOperacion : "",
    evidencia: typeof raw.evidencia === "string" ? raw.evidencia : "",
    umaDiaria: Number(raw.umaDiaria) || 0,
    identificacionUmbralPesos: Number(raw.identificacionUmbralPesos) || 0,
    avisoUmbralPesos: Number(raw.avisoUmbralPesos) || 0,
    umbralStatus: (raw.umbralStatus as UmbralStatus) ?? "sin-obligacion",
    acumuladoCliente: Number(raw.acumuladoCliente) || Number(raw.monto) || 0,
    alerta: typeof raw.alerta === "string" ? raw.alerta : obtenerAlertaPorStatus(raw.umbralStatus),
    avisoPresentado: Boolean(raw.avisoPresentado),
    alertaResuelta: Boolean(raw.alertaResuelta),
    documentosSoporte,
    requisitosChecklist,
    kycIntegrado: Boolean(raw.kycIntegrado),
    ...(cuestionarioInmueble ? { cuestionarioInmueble } : {}),
  }
}

function sanitizeClienteGuardado(raw: any): ClienteGuardado | null {
  if (!raw || typeof raw !== "object") return null

  const rfc = typeof raw.rfc === "string" ? raw.rfc : ""
  const nombre = typeof raw.nombre === "string" ? raw.nombre : ""
  if (!rfc || !nombre) {
    return null
  }

  const tipo =
    typeof raw.tipoCliente === "string"
      ? normalizarTipoCliente(raw.tipoCliente)
      : CLIENTE_TIPOS[0]?.value ?? "pf_residente"

  const detalle =
    typeof raw.detalleTipoCliente === "string" ? raw.detalleTipoCliente.trim() : ""

  return {
    rfc,
    nombre,
    tipoCliente: tipo,
    mismoGrupo: Boolean(raw.mismoGrupo),
    detalleTipoCliente: detalle || undefined,
  }
}

function toDate(value: string | Date) {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  }

  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) {
    return new Date()
  }

  return new Date(year, month - 1, day)
}

function normalizeDateKey(value: string | Date) {
  const date = toDate(value)
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getCalendarSeverityClass(operaciones: OperacionCliente[]) {
  if (operaciones.some((operacion) => operacion.umbralStatus === "aviso")) {
    return "bg-rose-500"
  }
  if (operaciones.some((operacion) => operacion.umbralStatus === "identificacion")) {
    return "bg-amber-500"
  }
  return "bg-emerald-500"
}

export default function ActividadesVulnerablesPage() {
  const { toast } = useToast()
  const [pasoActual, setPasoActual] = useState(0)
  const [actividadKey, setActividadKey] = useState<string>(actividadesVulnerables[0]?.key ?? "")
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(currentYear)
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(currentMonth)
  const [montoOperacion, setMontoOperacion] = useState<string>("")
  const [tipoCliente, setTipoCliente] = useState<string>(CLIENTE_TIPOS[0]?.value ?? "")
  const [detalleTipoCliente, setDetalleTipoCliente] = useState<string>("")
  const [clienteNombre, setClienteNombre] = useState<string>("")
  const [rfc, setRfc] = useState<string>("")
  const [mismoGrupo, setMismoGrupo] = useState<string>("no")
  const [tipoOperacion, setTipoOperacion] = useState<string>("")
  const [moneda, setMoneda] = useState<string>("MXN")
  const [monedaPersonalizadaCodigo, setMonedaPersonalizadaCodigo] = useState<string>("")
  const [monedaPersonalizadaDescripcion, setMonedaPersonalizadaDescripcion] = useState<string>("")
  const [fechaOperacion, setFechaOperacion] = useState<string>(new Date().toISOString().substring(0, 10))
  const [evidencia, setEvidencia] = useState<string>("")
  const [operaciones, setOperaciones] = useState<OperacionCliente[]>([])
  const [operacionesCargadas, setOperacionesCargadas] = useState(false)
  const [clientesGuardados, setClientesGuardados] = useState<ClienteGuardado[]>([])
  const [clientesGuardadosListo, setClientesGuardadosListo] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string | null>(null)
  const [avisoPreliminar, setAvisoPreliminar] = useState<OperacionCliente | null>(null)
  const [cuestionarioInmueble, setCuestionarioInmueble] = useState<CuestionarioInmuebleForm>(
    crearCuestionarioInmuebleBase(),
  )
  const [expedientesDetalle, setExpedientesDetalle] = useState<ExpedienteDetalle[]>([])
  const [expedienteCoincidente, setExpedienteCoincidente] = useState<ExpedienteDetalle | null>(null)

  const actualizarPersonaReportada = (updater: (persona: PersonaAvisoForm) => PersonaAvisoForm) => {
    setCuestionarioInmueble((prev) => ({
      ...prev,
      personaReportada: updater(structuredCloneSafe(prev.personaReportada)),
    }))
  }

  const actualizarBeneficiario = (
    updater: (beneficiario: BeneficiarioControladorForm) => BeneficiarioControladorForm,
  ) => {
    setCuestionarioInmueble((prev) => ({
      ...prev,
      beneficiario: updater(structuredCloneSafe(prev.beneficiario)),
    }))
  }

  const actualizarDatosOperacion = (
    updater: (datos: DatosOperacionInmuebleForm) => DatosOperacionInmuebleForm,
  ) => {
    setCuestionarioInmueble((prev) => ({
      ...prev,
      datosOperacion: updater(structuredCloneSafe(prev.datosOperacion)),
    }))
  }
  const [infoGrupoOpen, setInfoGrupoOpen] = useState(false)
  const [infoTipoClienteOpen, setInfoTipoClienteOpen] = useState(false)
  const [actividadInfoKey, setActividadInfoKey] = useState<string | null>(null)
  const [infoModal, setInfoModal] = useState<InfoModalKey | null>(null)
  const [tabActiva, setTabActiva] = useState<"resumen" | "captura" | "seguimiento" | "explorar">("resumen")
  const [clienteCalendario, setClienteCalendario] = useState<string | null>(null)
  const [mesCalendario, setMesCalendario] = useState<number>(currentMonth)
  const [anioCalendario, setAnioCalendario] = useState<number>(currentYear)
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null)
  const [operacionEnEdicion, setOperacionEnEdicion] = useState<OperacionCliente | null>(null)
  const [datosEdicion, setDatosEdicion] = useState<FormularioEdicion>({
    cliente: "",
    rfc: "",
    tipoCliente: CLIENTE_TIPOS[0]?.value ?? "",
    mismoGrupo: "no",
    tipoOperacion: "",
    monto: "",
    moneda: "MXN",
    monedaPersonalizadaCodigo: "",
    monedaPersonalizadaDescripcion: "",
    fechaOperacion: new Date().toISOString().substring(0, 10),
    evidencia: "",
    detalleTipoCliente: "",
  })
  const [operacionPorEliminar, setOperacionPorEliminar] = useState<OperacionCliente | null>(null)
  const [operacionDocumentos, setOperacionDocumentos] = useState<OperacionCliente | null>(null)
  const [nuevoDocumento, setNuevoDocumento] = useState({
    requisito: "",
    notas: "",
    archivoNombre: "",
    archivoContenido: "",
    fechaRegistro: new Date().toISOString().substring(0, 10),
  })

  const tipoClienteSeleccionado = useMemo(
    () => obtenerOpcionTipoCliente(tipoCliente),
    [tipoCliente],
  )

  const cuestionarioInmuebleValido = useMemo(() => {
    if (!esActividadInmueble) return true

    const persona = cuestionarioInmueble.personaReportada
    const domicilioPersona = persona.domicilio
    const datos = cuestionarioInmueble.datosOperacion
    const ubicacionInmueble = datos.caracteristicas.ubicacion
    const liquidacion = datos.liquidacion

    const personaValida =
      persona.denominacionRazon.trim().length > 0 &&
      persona.rfc.trim().length > 0 &&
      persona.nacionalidad.trim().length > 0 &&
      domicilioPersona.codigoPostal.trim().length === 5 &&
      domicilioPersona.calle.trim().length > 0 &&
      domicilioPersona.numeroExterior.trim().length > 0

    const operacionValida =
      datos.fechaOperacion.trim().length > 0 &&
      datos.tipoOperacion.trim().length > 0 &&
      datos.figuraCliente.trim().length > 0 &&
      datos.figuraSujetoObligado.trim().length > 0 &&
      datos.caracteristicas.tipoInmueble.trim().length > 0 &&
      datos.caracteristicas.valorPactado.trim().length > 0 &&
      ubicacionInmueble.codigoPostal.trim().length === 5 &&
      ubicacionInmueble.calle.trim().length > 0 &&
      ubicacionInmueble.numeroExterior.trim().length > 0 &&
      liquidacion.fechaPago.trim().length > 0 &&
      liquidacion.formaPago.trim().length > 0 &&
      liquidacion.instrumentoMonetario.trim().length > 0 &&
      liquidacion.moneda.trim().length > 0 &&
      liquidacion.montoOperacion.trim().length > 0

    const beneficiarioValido = !cuestionarioInmueble.incluirBeneficiario
      ? true
      : cuestionarioInmueble.beneficiario.nombre.trim().length > 0 &&
        cuestionarioInmueble.beneficiario.apellidoPaterno.trim().length > 0 &&
        cuestionarioInmueble.beneficiario.paisNacionalidad.trim().length > 0

    const contraparteValida = !cuestionarioInmueble.incluirContraparte
      ? true
      : cuestionarioInmueble.datosOperacion.contraparte.nombre.trim().length > 0 &&
        cuestionarioInmueble.datosOperacion.contraparte.apellidoPaterno.trim().length > 0

    const claveSujeto = cuestionarioInmueble.claveSujetoObligado.trim().length > 0
    const claveActividad = cuestionarioInmueble.claveActividad.trim().length > 0

    return personaValida && operacionValida && beneficiarioValido && contraparteValida && claveSujeto && claveActividad
  }, [cuestionarioInmueble, esActividadInmueble])

  const coloniasPersona = useMemo(() => {
    if (!esActividadInmueble) return []
    const info = buscarCodigoPostal(cuestionarioInmueble.personaReportada.domicilio.codigoPostal.trim())
    return info?.colonias ?? []
  }, [cuestionarioInmueble.personaReportada.domicilio.codigoPostal, esActividadInmueble])

  const coloniasInmueble = useMemo(() => {
    if (!esActividadInmueble) return []
    const info = buscarCodigoPostal(
      cuestionarioInmueble.datosOperacion.caracteristicas.ubicacion.codigoPostal.trim(),
    )
    return info?.colonias ?? []
  }, [cuestionarioInmueble.datosOperacion.caracteristicas.ubicacion.codigoPostal, esActividadInmueble])

  const umaVentana = useMemo(() => {
    const filtered = UMA_MONTHS.filter((entry) => {
      const fecha = new Date(entry.year, entry.month - 1, 1)
      return fecha >= START_WINDOW
    })

    if (filtered.length >= 60) {
      return filtered.slice(-60)
    }

    const faltantes = 60 - filtered.length
    if (faltantes <= 0) {
      return filtered
    }

    const anteriores = UMA_MONTHS.filter((entry) => {
      const fecha = new Date(entry.year, entry.month - 1, 1)
      return fecha < START_WINDOW
    }).slice(-faltantes)

    return [...anteriores, ...filtered]
  }, [])

  const actividadesPorFraccion = useMemo(() => {
    return actividadesVulnerables.reduce(
      (acc, actividad) => {
        const lista = acc.get(actividad.fraccion) ?? []
        lista.push(actividad)
        acc.set(actividad.fraccion, lista)
        return acc
      },
      new Map<string, ActividadVulnerable[]>(),
    )
  }, [])

  const availableYears = useMemo(
    () => Array.from(new Set(umaVentana.map((entry) => entry.year))).sort((a, b) => a - b),
    [umaVentana],
  )

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const stored = window.localStorage.getItem(OPERACIONES_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as unknown
        if (Array.isArray(parsed)) {
          const sane = parsed
            .map((item) => sanitizeOperacion(item))
            .filter((item): item is OperacionCliente => Boolean(item))
          if (sane.length > 0) {
            setOperaciones(recalcularOperaciones(sane))
          }
        }
      }
    } catch (_error) {
      // ignorar errores de parseo y continuar con estado vacío
    } finally {
      setOperacionesCargadas(true)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const stored = window.localStorage.getItem(EXPEDIENTE_DETALLE_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as unknown
        if (Array.isArray(parsed)) {
          const sane = parsed.filter(
            (item): item is ExpedienteDetalle =>
              Boolean(item) && typeof item === "object" && typeof (item as any).rfc === "string",
          )
          setExpedientesDetalle(sane)
        }
      }
    } catch (error) {
      console.warn("No fue posible leer los expedientes guardados", error)
    }
  }, [])

  useEffect(() => {
    if (!operacionesCargadas) return
    if (typeof window === "undefined") return

    window.localStorage.setItem(OPERACIONES_STORAGE_KEY, JSON.stringify(operaciones))
  }, [operaciones, operacionesCargadas])

  useEffect(() => {
    if (!rfc.trim()) {
      setExpedienteCoincidente(null)
      return
    }

    const criterio = normalizarTextoComparacion(rfc)
    const encontrado = expedientesDetalle.find(
      (item) => normalizarTextoComparacion(item.rfc ?? "") === criterio,
    )
    setExpedienteCoincidente(encontrado ?? null)
  }, [rfc, expedientesDetalle])

  useEffect(() => {
    if (availableYears.length === 0) return
    if (!availableYears.includes(anioSeleccionado)) {
      setAnioSeleccionado(availableYears[availableYears.length - 1])
    }
  }, [availableYears, anioSeleccionado])

  useEffect(() => {
    if (!esActividadInmueble) return
    if (!expedienteCoincidente) return

    setCuestionarioInmueble((prev) => {
      const actualizado = structuredCloneSafe(prev)

      if (
        !actualizado.claveSujetoObligado.trim() &&
        typeof expedienteCoincidente.claveSujetoObligado === "string"
      ) {
        actualizado.claveSujetoObligado = expedienteCoincidente.claveSujetoObligado
      }
      if (
        !actualizado.claveActividad.trim() &&
        typeof expedienteCoincidente.claveActividadVulnerable === "string"
      ) {
        actualizado.claveActividad = expedienteCoinciente.claveActividadVulnerable
      }

      const identificacion = expedienteCoincidente.identificacion ?? {}
      const persona = actualizado.personaReportada

      if (!persona.denominacionRazon.trim()) {
        const nombreIdentificacion =
          typeof identificacion.nombre === "string"
            ? identificacion.nombre
            : typeof expedienteCoincidente.nombre === "string"
              ? expedienteCoincidente.nombre
              : ""
        if (nombreIdentificacion) {
          persona.denominacionRazon = nombreIdentificacion
        }
      }
      if (!persona.rfc.trim() && typeof expedienteCoincidente.rfc === "string") {
        persona.rfc = expedienteCoincidente.rfc
      }
      if (!persona.fechaConstitucion && typeof identificacion["fecha-constitucion"] === "string") {
        persona.fechaConstitucion = identificacion["fecha-constitucion"]
      }
      if (typeof identificacion.nacionalidad === "string" && persona.nacionalidad === "MX") {
        persona.nacionalidad = buscarCodigoPaisPorNombre(identificacion.nacionalidad)
      }
      if (!persona.giro && typeof identificacion["actividad-economica"] === "string") {
        persona.giro = identificacion["actividad-economica"]
      }

      const personasLista = Array.isArray(expedienteCoincidente.personas)
        ? expedienteCoincidente.personas
        : []
      const personaRolCliente = personasLista.find((item) => {
        if (!item || typeof item !== "object") return false
        const rol = typeof (item as any).rolRelacion === "string" ? (item as any).rolRelacion : ""
        return normalizarTextoComparacion(rol).includes("cliente")
      }) as Record<string, any> | undefined
      const personaReferencia = (personaRolCliente ?? personasLista[0]) as Record<string, any> | undefined

      if (personaReferencia) {
        if (
          typeof personaReferencia.tipo === "string" &&
          (personaReferencia.tipo === "persona_fisica" || personaReferencia.tipo === "persona_moral")
        ) {
          persona.tipoPersona = personaReferencia.tipo
        }
        if (!persona.denominacionRazon.trim()) {
          const denominacion =
            typeof personaReferencia.denominacion === "string"
              ? personaReferencia.denominacion
              : typeof personaReferencia.nombre === "string"
                ? `${personaReferencia.nombre} ${personaReferencia.apellidoPaterno ?? ""}`.trim()
                : ""
          if (denominacion) {
            persona.denominacionRazon = denominacion
          }
        }
        if (!persona.giro && typeof personaReferencia.giro === "string") {
          persona.giro = personaReferencia.giro
        }
        if (persona.tipoPersona === "persona_moral" && personaReferencia.representante) {
          const rep = personaReferencia.representante as Record<string, any>
          if (typeof rep.nombre === "string") persona.representante.nombre = rep.nombre
          if (typeof rep.apellidoPaterno === "string") persona.representante.apellidoPaterno = rep.apellidoPaterno
          if (typeof rep.apellidoMaterno === "string") persona.representante.apellidoMaterno = rep.apellidoMaterno
          if (typeof rep.fechaNacimiento === "string") persona.representante.fechaNacimiento = rep.fechaNacimiento
          if (typeof rep.rfc === "string") persona.representante.rfc = rep.rfc
          if (typeof rep.curp === "string") persona.representante.curp = rep.curp
        }
        if (personaReferencia.domicilio && typeof personaReferencia.domicilio === "object") {
          const dom = personaReferencia.domicilio as Record<string, any>
          if (typeof dom.codigoPostal === "string") persona.domicilio.codigoPostal = dom.codigoPostal
          if (typeof dom.entidad === "string") persona.domicilio.entidad = dom.entidad
          if (typeof dom.municipio === "string") persona.domicilio.municipio = dom.municipio
          if (typeof dom.colonia === "string") persona.domicilio.colonia = dom.colonia
          if (typeof dom.calle === "string") persona.domicilio.calle = dom.calle
          if (typeof dom.numeroExterior === "string") persona.domicilio.numeroExterior = dom.numeroExterior
          if (typeof dom.numeroInterior === "string") persona.domicilio.numeroInterior = dom.numeroInterior
        }
        if (personaReferencia.contacto && typeof personaReferencia.contacto === "object") {
          const contacto = personaReferencia.contacto as Record<string, any>
          if (typeof contacto.telefono === "string" && !persona.telefono) {
            persona.telefono = contacto.telefono
          }
          if (typeof contacto.clavePais === "string") {
            persona.clavePaisTelefono = contacto.clavePais
          }
          if (typeof contacto.correo === "string" && !persona.correoElectronico) {
            persona.correoElectronico = contacto.correo
          }
        }
      }

      return actualizado
    })
  }, [expedienteCoincidente, esActividadInmueble])

  useEffect(() => {
    if (!esActividadInmueble) return
    if (!clienteNombre.trim() && !rfc.trim()) return

    setCuestionarioInmueble((prev) => {
      const actualizado = structuredCloneSafe(prev)
      if (!actualizado.personaReportada.denominacionRazon.trim() && clienteNombre.trim()) {
        actualizado.personaReportada.denominacionRazon = clienteNombre.trim()
      }
      if (rfc.trim()) {
        actualizado.personaReportada.rfc = rfc.trim().toUpperCase()
      }
      return actualizado
    })
  }, [clienteNombre, rfc, esActividadInmueble])

  useEffect(() => {
    if (!esActividadInmueble) return

    setCuestionarioInmueble((prev) => {
      const actualizado = structuredCloneSafe(prev)
      actualizado.datosOperacion.fechaOperacion = fechaOperacion
      if (montoOperacion.trim()) {
        actualizado.datosOperacion.caracteristicas.valorPactado = montoOperacion.trim()
        actualizado.datosOperacion.liquidacion.montoOperacion = montoOperacion.trim()
      }
      if (fechaOperacion) {
        actualizado.datosOperacion.liquidacion.fechaPago =
          actualizado.datosOperacion.liquidacion.fechaPago || fechaOperacion
      }
      const monedaCodigo =
        moneda === "OTRA"
          ? monedaPersonalizadaCodigo.trim().length === 3
            ? monedaPersonalizadaCodigo.trim().toUpperCase()
            : actualizado.datosOperacion.liquidacion.moneda
          : moneda
      if (monedaCodigo) {
        actualizado.datosOperacion.liquidacion.moneda = monedaCodigo
      }
      return actualizado
    })
  }, [esActividadInmueble, fechaOperacion, montoOperacion, moneda, monedaPersonalizadaCodigo])

  useEffect(() => {
    if (!esActividadInmueble) return

    const codigoPersona = cuestionarioInmueble.personaReportada.domicilio.codigoPostal.trim()
    const infoPersona = codigoPersona.length === 5 ? buscarCodigoPostal(codigoPersona) : undefined

    const codigoInmueble = cuestionarioInmueble.datosOperacion.caracteristicas.ubicacion.codigoPostal.trim()
    const infoInmueble = codigoInmueble.length === 5 ? buscarCodigoPostal(codigoInmueble) : undefined

    if (!infoPersona && !infoInmueble) return

    setCuestionarioInmueble((prev) => {
      const actualizado = structuredCloneSafe(prev)

      if (infoPersona) {
        const domicilio = actualizado.personaReportada.domicilio
        if (!domicilio.entidad) domicilio.entidad = infoPersona.estado
        if (!domicilio.municipio) domicilio.municipio = infoPersona.municipio
        if (!infoPersona.colonias.includes(domicilio.colonia)) {
          domicilio.colonia = infoPersona.colonias[0] ?? domicilio.colonia
        }
      }

      if (infoInmueble) {
        const ubicacion = actualizado.datosOperacion.caracteristicas.ubicacion
        if (!ubicacion.estado) ubicacion.estado = infoInmueble.estado
        if (!ubicacion.municipio) ubicacion.municipio = infoInmueble.municipio
        if (!infoInmueble.colonias.includes(ubicacion.colonia)) {
          ubicacion.colonia = infoInmueble.colonias[0] ?? ubicacion.colonia
        }
      }

      return actualizado
    })
  }, [cuestionarioInmueble.personaReportada.domicilio.codigoPostal, cuestionarioInmueble.datosOperacion.caracteristicas.ubicacion.codigoPostal, esActividadInmueble])

  useEffect(() => {
    if (operaciones.length === 0) {
      setClienteCalendario(null)
      setDiaSeleccionado(null)
      return
    }

    if (clienteCalendario && operaciones.some((operacion) => operacion.rfc === clienteCalendario)) {
      return
    }

    const ultimaOperacion = operaciones[operaciones.length - 1]
    setClienteCalendario(ultimaOperacion.rfc)
    setMesCalendario(ultimaOperacion.mes)
    setAnioCalendario(ultimaOperacion.anio)
    setDiaSeleccionado(normalizeDateKey(ultimaOperacion.fechaOperacion))
  }, [operaciones, clienteCalendario])

  useEffect(() => {
    if (!clienteCalendario) {
      return
    }

    const operacionesCliente = operaciones.filter((operacion) => operacion.rfc === clienteCalendario)
    if (operacionesCliente.length === 0) {
      setDiaSeleccionado(null)
      return
    }

    const ultimaOperacion = operacionesCliente[operacionesCliente.length - 1]
    setMesCalendario(ultimaOperacion.mes)
    setAnioCalendario(ultimaOperacion.anio)
    setDiaSeleccionado(normalizeDateKey(ultimaOperacion.fechaOperacion))
  }, [clienteCalendario, operaciones])

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const stored = window.localStorage.getItem(CLIENTES_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as unknown
        if (Array.isArray(parsed)) {
          const sane = parsed
            .map((item) => sanitizeClienteGuardado(item))
            .filter((item): item is ClienteGuardado => Boolean(item))
          setClientesGuardados(ordenarClientesGuardados(sane))
        }
      }
    } catch (_error) {
      // ignorar errores de parseo de almacenamiento local
    } finally {
      setClientesGuardadosListo(true)
    }
  }, [])

  useEffect(() => {
    if (!clientesGuardadosListo) return
    if (typeof window === "undefined") return

    window.localStorage.setItem(CLIENTES_STORAGE_KEY, JSON.stringify(clientesGuardados))
  }, [clientesGuardados, clientesGuardadosListo])

  useEffect(() => {
    if (operaciones.length === 0) return

    setClientesGuardados((prev) => {
      const mapa = new Map(prev.map((cliente) => [cliente.rfc, cliente]))
      let actualizado = false

      operaciones.forEach((operacion) => {
        const datos: ClienteGuardado = {
          rfc: operacion.rfc,
          nombre: operacion.cliente,
          tipoCliente: operacion.tipoCliente,
          mismoGrupo: operacion.mismoGrupo,
          detalleTipoCliente: operacion.detalleTipoCliente,
        }
        const existente = mapa.get(operacion.rfc)
        if (
          !existente ||
          existente.nombre !== datos.nombre ||
          existente.tipoCliente !== datos.tipoCliente ||
          existente.mismoGrupo !== datos.mismoGrupo ||
          (existente.detalleTipoCliente ?? "") !== (datos.detalleTipoCliente ?? "")
        ) {
          mapa.set(operacion.rfc, datos)
          actualizado = true
        }
      })

      if (!actualizado) {
        return prev
      }

      return ordenarClientesGuardados(Array.from(mapa.values()))
    })
  }, [operaciones])

  useEffect(() => {
    if (!operacionEnEdicion) return

    setDatosEdicion({
      cliente: operacionEnEdicion.cliente,
      rfc: operacionEnEdicion.rfc,
      tipoCliente: operacionEnEdicion.tipoCliente,
      mismoGrupo: operacionEnEdicion.mismoGrupo ? "si" : "no",
      tipoOperacion: operacionEnEdicion.tipoOperacion,
      monto: operacionEnEdicion.monto.toString(),
    moneda: MONEDAS_EXTENDIDAS.some((item) => item.value === operacionEnEdicion.moneda)
        ? operacionEnEdicion.moneda
        : "OTRA",
      monedaPersonalizadaCodigo:
        MONEDAS_EXTENDIDAS.some((item) => item.value === operacionEnEdicion.moneda)
          ? ""
          : operacionEnEdicion.moneda,
      monedaPersonalizadaDescripcion:
        MONEDAS_EXTENDIDAS.some((item) => item.value === operacionEnEdicion.moneda)
          ? ""
          : operacionEnEdicion.monedaDescripcion.split(" – ")[1] ?? operacionEnEdicion.monedaDescripcion,
      fechaOperacion: operacionEnEdicion.fechaOperacion,
      evidencia: operacionEnEdicion.evidencia,
      detalleTipoCliente: operacionEnEdicion.detalleTipoCliente ?? "",
    })
  }, [operacionEnEdicion])

  useEffect(() => {
    if (!operacionDocumentos) return

    const actualizada = operaciones.find((operacion) => operacion.id === operacionDocumentos.id)
    if (actualizada && actualizada !== operacionDocumentos) {
      setOperacionDocumentos(actualizada)
    }
  }, [operaciones, operacionDocumentos])

  const mesesDisponibles = useMemo(
    () =>
      umaVentana
        .filter((entry) => entry.year === anioSeleccionado)
        .map((entry) => entry.month)
        .sort((a, b) => a - b),
    [anioSeleccionado, umaVentana],
  )

  const actividadSeleccionada = useMemo(
    () => actividadesVulnerables.find((actividad) => actividad.key === actividadKey),
    [actividadKey],
  )

  const esActividadInmueble = useMemo(
    () => actividadSeleccionada?.key === "fraccion-xv-uso-goce",
    [actividadSeleccionada?.key],
  )

  const umaSeleccionada = useMemo(() => {
    const encontrada = umaVentana.find(
      (entry) => entry.month === mesSeleccionado && entry.year === anioSeleccionado,
    )
    return encontrada ?? findUmaByMonthYear(mesSeleccionado, anioSeleccionado)
  }, [mesSeleccionado, anioSeleccionado, umaVentana])

  const umbralPesos = useMemo(() => {
    if (!umaSeleccionada || !actividadSeleccionada) {
      return null
    }
    const diaria = umaSeleccionada.daily
    return {
      identificacion: actividadSeleccionada.identificacionUmbralUma * diaria,
      aviso: actividadSeleccionada.avisoUmbralUma * diaria,
    }
  }, [umaSeleccionada, actividadSeleccionada])

  const umbralTexto = useMemo(() => {
    if (!actividadSeleccionada || !umbralPesos) {
      return { identificacion: null, aviso: null }
    }
    return {
      identificacion: formatUmbralTexto(
        actividadSeleccionada.identificacionUmbralUma,
        umbralPesos.identificacion,
      ),
      aviso: formatUmbralTexto(actividadSeleccionada.avisoUmbralUma, umbralPesos.aviso),
    }
  }, [actividadSeleccionada, umbralPesos])

  const operacionesRelacionadas = useMemo(() => {
    if (!actividadSeleccionada) return []
    const periodo = buildPeriodo(anioSeleccionado, mesSeleccionado)
    return operaciones.filter(
      (operacion) =>
        operacion.actividadKey === actividadSeleccionada.key &&
        operacion.periodo === periodo &&
        operacion.rfc.toUpperCase() === rfc.trim().toUpperCase() &&
        !operacion.avisoPresentado,
    )
  }, [actividadSeleccionada, anioSeleccionado, mesSeleccionado, operaciones, rfc])

  const evaluacionActual = useMemo(() => {
    if (!actividadSeleccionada || !umaSeleccionada || !umbralPesos) return null
    const monto = Number(montoOperacion)
    if (!monto || Number.isNaN(monto) || monto <= 0) return null
    const acumuladoPrevio = operacionesRelacionadas.reduce((acc, operacion) => acc + operacion.monto, 0)
    const acumulado = acumuladoPrevio + monto
    let status: UmbralStatus = "sin-obligacion"

    if (acumulado >= umbralPesos.aviso) {
      status = "aviso"
    } else if (acumulado >= umbralPesos.identificacion) {
      status = "identificacion"
    }

    const alerta = obtenerAlertaPorStatus(status)

    return {
      status,
      alerta,
      acumulado,
      monto,
      periodo: buildPeriodo(anioSeleccionado, mesSeleccionado),
    }
  }, [actividadSeleccionada, umaSeleccionada, umbralPesos, montoOperacion, operacionesRelacionadas, anioSeleccionado, mesSeleccionado])

  const controlesEvaluacion = useMemo(() => {
    if (!evaluacionActual) return []
    return CONTROLES_ARTICULO_17[evaluacionActual.status] ?? []
  }, [evaluacionActual])

  const checklistEntriesOperacion = useMemo(
    () => (operacionDocumentos ? Object.entries(operacionDocumentos.requisitosChecklist) : []),
    [operacionDocumentos],
  )
  const checklistTotalesOperacion = checklistEntriesOperacion.length
  const checklistCompletadosOperacion = useMemo(
    () => checklistEntriesOperacion.filter(([, completado]) => completado).length,
    [checklistEntriesOperacion],
  )
  const checklistProgresoOperacion = useMemo(
    () =>
      !operacionDocumentos
        ? 0
        : checklistTotalesOperacion > 0
          ? Math.round((checklistCompletadosOperacion / checklistTotalesOperacion) * 100)
          : 100,
    [operacionDocumentos, checklistTotalesOperacion, checklistCompletadosOperacion],
  )
  const controlesOperacion = useMemo(
    () => (operacionDocumentos ? CONTROLES_ARTICULO_17[operacionDocumentos.umbralStatus] ?? [] : []),
    [operacionDocumentos],
  )
  const tipoClienteOperacionLabel = useMemo(
    () =>
      operacionDocumentos
        ? formatTipoClienteLabel(
            operacionDocumentos.tipoCliente,
            operacionDocumentos.detalleTipoCliente,
          )
        : "",
    [operacionDocumentos],
  )
  const tipoClienteEdicionSeleccionado = useMemo(
    () => obtenerOpcionTipoCliente(datosEdicion.tipoCliente),
    [datosEdicion.tipoCliente],
  )
  const evidenciasRegistradasOperacion = operacionDocumentos?.documentosSoporte.length ?? 0
  const checklistPendientesOperacion = Math.max(
    checklistTotalesOperacion - checklistCompletadosOperacion,
    0,
  )

  const resumenUmbrales = useMemo(() => {
    const acumulados = operaciones.reduce(
      (acc, operacion) => {
        acc[operacion.umbralStatus] = (acc[operacion.umbralStatus] ?? 0) + 1
        return acc
      },
      {} as Record<UmbralStatus, number>,
    )

    return {
      sinObligacion: acumulados["sin-obligacion"] ?? 0,
      identificacion: acumulados["identificacion"] ?? 0,
      aviso: acumulados["aviso"] ?? 0,
    }
  }, [operaciones])

  const operacionesAgrupadas = useMemo(() => {
    const mapa = new Map<UmbralStatus, OperacionCliente[]>()
    operaciones.forEach((operacion) => {
      const lista = mapa.get(operacion.umbralStatus) ?? []
      lista.push(operacion)
      mapa.set(operacion.umbralStatus, lista)
    })
    return mapa
  }, [operaciones])

  const operacionesRecientes = useMemo(() => {
    return [...operaciones]
      .sort((a, b) => toDate(b.fechaOperacion).getTime() - toDate(a.fechaOperacion).getTime())
      .slice(0, 5)
  }, [operaciones])

  const clientesRegistrados = useMemo(() => {
    const mapa = new Map<string, { rfc: string; nombre: string }>()
    operaciones.forEach((operacion) => {
      if (!mapa.has(operacion.rfc)) {
        mapa.set(operacion.rfc, { rfc: operacion.rfc, nombre: operacion.cliente })
      }
    })
    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  }, [operaciones])

  const operacionesClienteSeleccionado = useMemo(() => {
    if (!clienteCalendario) return []
    return operaciones
      .filter((operacion) => operacion.rfc === clienteCalendario)
      .sort((a, b) => toDate(a.fechaOperacion).getTime() - toDate(b.fechaOperacion).getTime())
  }, [clienteCalendario, operaciones])

  const operacionesCalendario = useMemo(() => {
    if (!clienteCalendario) return []
    return operacionesClienteSeleccionado.filter(
      (operacion) => operacion.mes === mesCalendario && operacion.anio === anioCalendario,
    )
  }, [clienteCalendario, operacionesClienteSeleccionado, mesCalendario, anioCalendario])

  const calendarioDias = useMemo(() => {
    if (!clienteCalendario) return []

    const mapaPorDia = new Map<string, OperacionCliente[]>()
    operacionesClienteSeleccionado.forEach((operacion) => {
      const clave = normalizeDateKey(operacion.fechaOperacion)
      const lista = mapaPorDia.get(clave) ?? []
      lista.push(operacion)
      mapaPorDia.set(clave, lista)
    })

    const base = new Date(anioCalendario, mesCalendario - 1, 1)
    const offset = (base.getDay() + 6) % 7
    const inicio = new Date(base.getFullYear(), base.getMonth(), base.getDate() - offset)

    return Array.from({ length: 42 }, (_, index) => {
      const fecha = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + index)
      const clave = normalizeDateKey(fecha)
      return {
        clave,
        dia: fecha.getDate(),
        esMesActual: fecha.getMonth() === mesCalendario - 1 && fecha.getFullYear() === anioCalendario,
        operaciones: mapaPorDia.get(clave) ?? [],
      }
    })
  }, [clienteCalendario, operacionesClienteSeleccionado, anioCalendario, mesCalendario])

  const operacionesDiaSeleccionado = useMemo(() => {
    if (!diaSeleccionado) return []
    return operacionesClienteSeleccionado.filter(
      (operacion) => normalizeDateKey(operacion.fechaOperacion) === diaSeleccionado,
    )
  }, [diaSeleccionado, operacionesClienteSeleccionado])

  const alertasActivas = useMemo(
    () =>
      operaciones
        .filter((operacion) => operacion.alerta && !operacion.alertaResuelta)
        .sort((a, b) => toDate(b.fechaOperacion).getTime() - toDate(a.fechaOperacion).getTime()),
    [operaciones],
  )

  const alertasResueltas = useMemo(
    () =>
      operaciones
        .filter((operacion) => operacion.alerta && operacion.alertaResuelta)
        .sort((a, b) => toDate(b.fechaOperacion).getTime() - toDate(a.fechaOperacion).getTime()),
    [operaciones],
  )

  useEffect(() => {
    if (!clienteCalendario) {
      return
    }

    if (calendarioDias.length === 0) {
      setDiaSeleccionado(null)
      return
    }

    const diaExiste = diaSeleccionado
      ? calendarioDias.some((dia) => dia.clave === diaSeleccionado)
      : false

    if (diaExiste) {
      return
    }

    const primerDiaConOperaciones = calendarioDias.find((dia) => dia.operaciones.length > 0)
    if (primerDiaConOperaciones) {
      setDiaSeleccionado(primerDiaConOperaciones.clave)
      return
    }

    const diaMesActual = calendarioDias.find((dia) => dia.esMesActual)
    setDiaSeleccionado(diaMesActual ? diaMesActual.clave : calendarioDias[0]?.clave ?? null)
  }, [clienteCalendario, calendarioDias, diaSeleccionado])

const pasoValido = useMemo(() => {
  if (pasoActual === 0) {
    return Boolean(actividadKey && umaSeleccionada)
  }
  if (pasoActual === 1) {
    return (
      Boolean(clienteNombre.trim()) &&
      Boolean(rfc.trim()) &&
      Boolean(tipoOperacion.trim()) &&
      Boolean(montoOperacion.trim()) &&
      (!tipoClienteSeleccionado?.requiresDetalle || Boolean(detalleTipoCliente.trim())) &&
      (!esActividadInmueble || cuestionarioInmuebleValido)
    )
  }
  if (pasoActual === 2) {
    return Boolean(evaluacionActual)
  }
  return false
}, [
  pasoActual,
  actividadKey,
  umaSeleccionada,
  clienteNombre,
  rfc,
  tipoOperacion,
  montoOperacion,
  evaluacionActual,
  tipoClienteSeleccionado,
  detalleTipoCliente,
  esActividadInmueble,
  cuestionarioInmuebleValido,
])

const limpiarClienteSeleccionado = () => {
  setClienteSeleccionado(null)
  setClienteNombre("")
  setRfc("")
  setDetalleTipoCliente("")
}

const limpiarFormulario = () => {
  setMontoOperacion("")
  setTipoOperacion("")
  setEvidencia("")
  limpiarClienteSeleccionado()
  setMismoGrupo("no")
  setMoneda("MXN")
  setMonedaPersonalizadaCodigo("")
  setMonedaPersonalizadaDescripcion("")
  setFechaOperacion(new Date().toISOString().substring(0, 10))
  setDetalleTipoCliente("")
  setCuestionarioInmueble(crearCuestionarioInmuebleBase())
}

const registrarClienteGuardado = (cliente: ClienteGuardado) => {
  setClientesGuardados((prev) => {
    const existente = prev.find((item) => item.rfc === cliente.rfc)
    if (existente) {
      if (
        existente.nombre === cliente.nombre &&
        existente.tipoCliente === cliente.tipoCliente &&
        existente.mismoGrupo === cliente.mismoGrupo &&
        (existente.detalleTipoCliente ?? "") === (cliente.detalleTipoCliente ?? "")
      ) {
        return prev
      }
      return ordenarClientesGuardados(
        prev.map((item) => (item.rfc === cliente.rfc ? { ...item, ...cliente } : item)),
      )
    }

    return ordenarClientesGuardados([...prev, cliente])
  })
}

const actualizarOperaciones = (
  modifier: (operacionesActuales: OperacionCliente[]) => OperacionCliente[],
) => {
  setOperaciones((prev) => recalcularOperaciones(modifier(prev)))
}

const manejarSeleccionClienteGuardado = (valor: string) => {
  if (valor === NUEVO_CLIENTE_VALUE) {
    limpiarClienteSeleccionado()
    return
  }

  const guardado = clientesGuardados.find((cliente) => cliente.rfc === valor)
  if (!guardado) {
    limpiarClienteSeleccionado()
    return
  }

  setClienteSeleccionado(guardado.rfc)
  setClienteNombre(guardado.nombre)
  setRfc(guardado.rfc)
  setTipoCliente(guardado.tipoCliente)
  setDetalleTipoCliente(guardado.detalleTipoCliente ?? "")
  setMismoGrupo(guardado.mismoGrupo ? "si" : "no")
}

const agregarOperacion = () => {
  if (!actividadSeleccionada || !umaSeleccionada || !umbralPesos) {
    toast({
      title: "Información incompleta",
      description: "Selecciona la actividad, año, mes y verifica que existan UMAs disponibles.",
      variant: "destructive",
    })
    return
  }

  if (!clienteNombre || !rfc || !tipoOperacion || !montoOperacion) {
    toast({
      title: "Faltan datos",
      description: "Completa la información del cliente, RFC, tipo de operación y monto.",
      variant: "destructive",
    })
    return
  }

  const monto = Number(montoOperacion)
  if (Number.isNaN(monto) || monto <= 0) {
    toast({
      title: "Monto inválido",
      description: "El monto debe ser numérico y mayor a cero.",
      variant: "destructive",
    })
    return
  }

  if (tipoClienteSeleccionado?.requiresDetalle && !detalleTipoCliente.trim()) {
    toast({
      title: "Detalle requerido",
      description: "Indica el tipo específico de entidad para el cliente seleccionado.",
      variant: "destructive",
    })
    return
  }

  let monedaCodigoFinal = moneda
  let monedaDescripcionFinal = getMonedaLabel(moneda)

  if (moneda === "OTRA") {
    const codigoLimpio = monedaPersonalizadaCodigo.trim().toUpperCase()
    if (!codigoLimpio || codigoLimpio.length !== 3) {
      toast({
        title: "Código de moneda requerido",
        description: "Ingresa el código ISO de tres letras para la divisa personalizada.",
        variant: "destructive",
      })
      return
    }

    monedaCodigoFinal = codigoLimpio
    const descripcionLimpia = monedaPersonalizadaDescripcion.trim()
    monedaDescripcionFinal = descripcionLimpia
      ? `${codigoLimpio} – ${descripcionLimpia}`
      : `${codigoLimpio} – Divisa personalizada`
  }

  const periodo = buildPeriodo(anioSeleccionado, mesSeleccionado)
  const detalleClienteNormalizado =
    tipoClienteSeleccionado?.requiresDetalle && detalleTipoCliente.trim().length > 0
      ? detalleTipoCliente.trim()
      : undefined

  const operacionesPrevias = operaciones.filter(
    (operacion) =>
      operacion.actividadKey === actividadSeleccionada.key &&
      operacion.periodo === periodo &&
      operacion.rfc.toUpperCase() === rfc.trim().toUpperCase() &&
      !operacion.avisoPresentado,
  )

  const acumuladoPrevio = operacionesPrevias.reduce((acc, operacion) => acc + operacion.monto, 0)
  const acumuladoCliente = acumuladoPrevio + monto

  let status: UmbralStatus = "sin-obligacion"

  if (acumuladoCliente >= umbralPesos.aviso) {
    status = "aviso"
  } else if (acumuladoCliente >= umbralPesos.identificacion) {
    status = "identificacion"
  }

  const alerta = obtenerAlertaPorStatus(status)

  const cuestionarioInmuebleSnapshot = esActividadInmueble
    ? structuredCloneSafe(cuestionarioInmueble)
    : undefined

  const nuevaOperacion: OperacionCliente = {
    id: crypto.randomUUID(),
    actividadKey: actividadSeleccionada.key,
    actividadNombre: `${actividadSeleccionada.fraccion} – ${actividadSeleccionada.nombre}`,
    tipoCliente,
    detalleTipoCliente: detalleClienteNormalizado,
    cliente: clienteNombre.trim(),
    rfc: rfc.trim().toUpperCase(),
    mismoGrupo: mismoGrupo === "si",
    periodo,
    mes: mesSeleccionado,
    anio: anioSeleccionado,
    monto,
    moneda: monedaCodigoFinal,
    monedaDescripcion: monedaDescripcionFinal,
    fechaOperacion,
    tipoOperacion,
    evidencia,
    umaDiaria: umaSeleccionada.daily,
    identificacionUmbralPesos: umbralPesos.identificacion,
    avisoUmbralPesos: umbralPesos.aviso,
    umbralStatus: status,
    acumuladoCliente,
    alerta,
    avisoPresentado: false,
    alertaResuelta: alerta ? false : true,
    documentosSoporte: [],
    requisitosChecklist: buildChecklist(actividadSeleccionada, tipoCliente),
    kycIntegrado: false,
    ...(cuestionarioInmuebleSnapshot ? { cuestionarioInmueble: cuestionarioInmuebleSnapshot } : {}),
  }

  actualizarOperaciones((prev) => [...prev, nuevaOperacion])
  registrarClienteGuardado({
    rfc: nuevaOperacion.rfc,
    nombre: nuevaOperacion.cliente,
    tipoCliente: nuevaOperacion.tipoCliente,
    mismoGrupo: nuevaOperacion.mismoGrupo,
    detalleTipoCliente: nuevaOperacion.detalleTipoCliente,
  })

  if (status !== "sin-obligacion") {
    toast({
      title: getStatusLabel(status),
      description: alerta ?? "Revisar obligaciones aplicables.",
    })
  } else {
    toast({
      title: "Operación registrada",
      description: "Se registró la operación sin obligaciones activas.",
    })
  }

  setPasoActual(0)
  limpiarFormulario()
  setTabActiva("seguimiento")
  setClienteCalendario(nuevaOperacion.rfc)
  setAnioCalendario(nuevaOperacion.anio)
  setMesCalendario(nuevaOperacion.mes)
  setDiaSeleccionado(normalizeDateKey(nuevaOperacion.fechaOperacion))
}

const marcarAvisoPresentado = (id: string) => {
  actualizarOperaciones((prev) =>
    prev.map((operacion) =>
      operacion.id === id
        ? {
            ...operacion,
            avisoPresentado: true,
            alerta: "Aviso marcado como presentado. Reiniciar acumulación a partir de esta fecha.",
            alertaResuelta: true,
          }
        : operacion,
    ),
  )

  toast({
    title: "Aviso actualizado",
    description: "Se marcó la operación como atendida ante la autoridad.",
  })
}

const abrirEdicionOperacion = (operacion: OperacionCliente) => {
  setOperacionEnEdicion(operacion)
}

const guardarOperacionEditada = () => {
  if (!operacionEnEdicion) return

  if (
    !datosEdicion.cliente.trim() ||
    !datosEdicion.rfc.trim() ||
    !datosEdicion.tipoOperacion.trim() ||
    !datosEdicion.monto.trim()
  ) {
    toast({
      title: "Faltan datos",
      description: "Completa el nombre, RFC, tipo de operación y monto antes de guardar.",
      variant: "destructive",
    })
    return
  }

  const monto = Number(datosEdicion.monto)
  if (Number.isNaN(monto) || monto <= 0) {
    toast({
      title: "Monto inválido",
      description: "El monto debe ser numérico y mayor a cero.",
      variant: "destructive",
    })
    return
  }

  if (tipoClienteEdicionSeleccionado?.requiresDetalle && !datosEdicion.detalleTipoCliente.trim()) {
    toast({
      title: "Detalle requerido",
      description: "Especifica el tipo de entidad o detalle solicitado para este tipo de cliente.",
      variant: "destructive",
    })
    return
  }

  const rfcNormalizado = datosEdicion.rfc.trim().toUpperCase()

  let monedaCodigoFinal = datosEdicion.moneda
  let monedaDescripcionFinal = getMonedaLabel(datosEdicion.moneda)

  if (datosEdicion.moneda === "OTRA") {
    const codigoLimpio = datosEdicion.monedaPersonalizadaCodigo.trim().toUpperCase()
    if (!codigoLimpio || codigoLimpio.length !== 3) {
      toast({
        title: "Código de moneda requerido",
        description: "Define el código ISO de tres letras para la divisa personalizada.",
        variant: "destructive",
      })
      return
    }

    monedaCodigoFinal = codigoLimpio
    const descripcionLimpia = datosEdicion.monedaPersonalizadaDescripcion.trim()
    monedaDescripcionFinal = descripcionLimpia
      ? `${codigoLimpio} – ${descripcionLimpia}`
      : `${codigoLimpio} – Divisa personalizada`
  }

  const detalleClienteNormalizado =
    tipoClienteEdicionSeleccionado?.requiresDetalle && datosEdicion.detalleTipoCliente.trim().length > 0
      ? datosEdicion.detalleTipoCliente.trim()
      : undefined

  const operacionActualizada: OperacionCliente = {
    ...operacionEnEdicion,
    cliente: datosEdicion.cliente.trim(),
    rfc: rfcNormalizado,
    tipoCliente: datosEdicion.tipoCliente,
    detalleTipoCliente: detalleClienteNormalizado,
    mismoGrupo: datosEdicion.mismoGrupo === "si",
    tipoOperacion: datosEdicion.tipoOperacion.trim(),
    monto,
    moneda: monedaCodigoFinal,
    monedaDescripcion: monedaDescripcionFinal,
    fechaOperacion: datosEdicion.fechaOperacion,
    evidencia: datosEdicion.evidencia,
  }

  const actividadReferencia = actividadesVulnerables.find(
    (item) => item.key === operacionActualizada.actividadKey,
  )
  if (actividadReferencia) {
    operacionActualizada.requisitosChecklist = buildChecklist(
      actividadReferencia,
      operacionActualizada.tipoCliente,
      operacionActualizada.requisitosChecklist,
    )
  }

  actualizarOperaciones((prev) =>
    prev.map((operacion) => (operacion.id === operacionEnEdicion.id ? operacionActualizada : operacion)),
  )

  registrarClienteGuardado({
    rfc: operacionActualizada.rfc,
    nombre: operacionActualizada.cliente,
    tipoCliente: operacionActualizada.tipoCliente,
    mismoGrupo: operacionActualizada.mismoGrupo,
    detalleTipoCliente: operacionActualizada.detalleTipoCliente,
  })

  setOperacionEnEdicion(null)

  toast({
    title: "Operación actualizada",
    description: "Se guardaron los cambios de la operación seleccionada.",
  })
}

const cancelarEdicionOperacion = () => {
  setOperacionEnEdicion(null)
}

const solicitarEliminacionOperacion = (operacion: OperacionCliente) => {
  setOperacionPorEliminar(operacion)
}

const confirmarEliminacionOperacion = () => {
  if (!operacionPorEliminar) return

  const id = operacionPorEliminar.id
  actualizarOperaciones((prev) => prev.filter((operacion) => operacion.id !== id))
  setOperacionPorEliminar(null)

  toast({
    title: "Operación eliminada",
    description: "Se eliminó la operación del seguimiento.",
  })
}

const actualizarEstadoAlerta = (id: string, resuelta: boolean) => {
  actualizarOperaciones((prev) =>
    prev.map((operacion) =>
      operacion.id === id
        ? {
            ...operacion,
            alertaResuelta: resuelta,
          }
        : operacion,
    ),
  )

  toast({
    title: resuelta ? "Alerta gestionada" : "Alerta reabierta",
    description: resuelta
      ? "Se marcó la alerta como atendida."
      : "La alerta se reactivó para dar seguimiento pendiente.",
  })
}

const generarAvisoPreliminar = (operacion: OperacionCliente) => {
  setAvisoPreliminar(operacion)
}

const exportarXml = (operacion: OperacionCliente) => {
  const xml = operacion.cuestionarioInmueble
    ? buildInmuebleXml(operacion)
    : `<?xml version="1.0" encoding="UTF-8"?>\n<avisoPLD>\n  <periodo>${operacion.periodo}</periodo>\n  <actividad>${operacion.actividadKey}</actividad>\n  <claveActividad>${operacion.actividadKey.toUpperCase()}</claveActividad>\n  <sujetoObligado>${operacion.rfc}</sujetoObligado>\n  <cliente>\n    <nombre>${escapeXml(operacion.cliente)}</nombre>\n    <tipoCliente>${escapeXml(operacion.tipoCliente)}</tipoCliente>\n    <mismoGrupo>${operacion.mismoGrupo ? "SI" : "NO"}</mismoGrupo>\n  </cliente>\n  <operacion>\n    <fecha>${operacion.fechaOperacion}</fecha>\n    <monto moneda="${operacion.moneda}">${operacion.monto.toFixed(2)}</monto>\n    <tipo>${escapeXml(operacion.tipoOperacion)}</tipo>\n    <evidencia>${escapeXml(operacion.evidencia)}</evidencia>\n  </operacion>\n</avisoPLD>`

  const blob = new Blob([xml], { type: "application/xml" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `aviso-${operacion.periodo}-${operacion.rfc}.xml`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  toast({
    title: "XML generado",
    description: "Se descargó el archivo XML preliminar para revisión.",
  })
}

const reutilizarDatosCliente = (operacion: OperacionCliente) => {
  setTabActiva("captura")
  setActividadKey(operacion.actividadKey)
  setActividadInfoKey(operacion.actividadKey)
  setAnioSeleccionado(operacion.anio)
  setMesSeleccionado(operacion.mes)
  setTipoCliente(operacion.tipoCliente)
  setDetalleTipoCliente(operacion.detalleTipoCliente ?? "")
  setClienteNombre(operacion.cliente)
  setRfc(operacion.rfc)
  setMismoGrupo(operacion.mismoGrupo ? "si" : "no")
  setTipoOperacion(operacion.tipoOperacion)
  if (MONEDAS_EXTENDIDAS.some((item) => item.value === operacion.moneda)) {
    setMoneda(operacion.moneda)
    setMonedaPersonalizadaCodigo("")
    setMonedaPersonalizadaDescripcion("")
  } else {
    setMoneda("OTRA")
    setMonedaPersonalizadaCodigo(operacion.moneda)
    const descripcion = operacion.monedaDescripcion.split(" – ")[1] ?? ""
    setMonedaPersonalizadaDescripcion(descripcion)
  }
  if (operacion.cuestionarioInmueble) {
    setCuestionarioInmueble(structuredCloneSafe(operacion.cuestionarioInmueble))
  } else if (esActividadInmueble) {
    setCuestionarioInmueble(crearCuestionarioInmuebleBase())
  }
  setFechaOperacion(new Date().toISOString().substring(0, 10))
  setEvidencia(operacion.evidencia)
  setMontoOperacion("")
  setPasoActual(1)
  toast({
    title: "Datos precargados",
    description: "Actualiza el monto y confirma la nueva operación del cliente seleccionado.",
  })
}

const abrirDocumentosOperacion = (operacion: OperacionCliente) => {
  setOperacionDocumentos(operacion)
  setNuevoDocumento({
    requisito: "",
    notas: "",
    archivoNombre: "",
    archivoContenido: "",
    fechaRegistro: new Date().toISOString().substring(0, 10),
  })
}

const cerrarDocumentosOperacion = () => {
  setOperacionDocumentos(null)
  setNuevoDocumento({
    requisito: "",
    notas: "",
    archivoNombre: "",
    archivoContenido: "",
    fechaRegistro: new Date().toISOString().substring(0, 10),
  })
}

const alternarRequisitoChecklist = (operacionId: string, requisito: string) => {
  actualizarOperaciones((prev) =>
    prev.map((operacion) =>
      operacion.id === operacionId
        ? {
            ...operacion,
            requisitosChecklist: {
              ...operacion.requisitosChecklist,
              [requisito]: !operacion.requisitosChecklist[requisito],
            },
          }
        : operacion,
    ),
  )
}

const marcarKycIntegrado = (operacionId: string, valor: boolean) => {
  actualizarOperaciones((prev) =>
    prev.map((operacion) =>
      operacion.id === operacionId
        ? {
            ...operacion,
            kycIntegrado: valor,
          }
        : operacion,
    ),
  )

  toast({
    title: valor ? "Expediente KYC vinculado" : "Seguimiento pendiente",
    description: valor
      ? "Se marcó la integración del expediente KYC actualizado."
      : "Se reactivó la tarea de actualización del expediente KYC.",
  })
}

const manejarArchivoDocumento = (event: ChangeEvent<HTMLInputElement>) => {
  const archivo = event.target.files?.[0]
  if (!archivo) {
    setNuevoDocumento((prev) => ({ ...prev, archivoNombre: "", archivoContenido: "" }))
    return
  }

  const lector = new FileReader()
  lector.onload = () => {
    setNuevoDocumento((prev) => ({
      ...prev,
      archivoNombre: archivo.name,
      archivoContenido: typeof lector.result === "string" ? lector.result : "",
    }))
  }
  lector.readAsDataURL(archivo)
  event.target.value = ""
}

const agregarDocumentoSoporte = () => {
  if (!operacionDocumentos) return

  const requisito = nuevoDocumento.requisito.trim()
  if (!requisito) {
    toast({
      title: "Selecciona un requisito",
      description: "Elige o describe el requisito al que corresponde la evidencia.",
      variant: "destructive",
    })
    return
  }

  const documento: DocumentoSoporte = {
    id: typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`,
    requisito,
    notas: nuevoDocumento.notas.trim(),
    archivoNombre: nuevoDocumento.archivoNombre || undefined,
    archivoContenido: nuevoDocumento.archivoContenido || undefined,
    fechaRegistro: nuevoDocumento.fechaRegistro,
  }

  actualizarOperaciones((prev) =>
    prev.map((operacion) =>
      operacion.id === operacionDocumentos.id
        ? {
            ...operacion,
            documentosSoporte: [...operacion.documentosSoporte, documento],
          }
        : operacion,
    ),
  )

  setNuevoDocumento({
    requisito: "",
    notas: "",
    archivoNombre: "",
    archivoContenido: "",
    fechaRegistro: new Date().toISOString().substring(0, 10),
  })

  toast({
    title: "Evidencia registrada",
    description: "Se guardó la evidencia local para el requisito seleccionado.",
  })
}

const eliminarDocumentoSoporte = (operacionId: string, documentoId: string) => {
  actualizarOperaciones((prev) =>
    prev.map((operacion) =>
      operacion.id === operacionId
        ? {
            ...operacion,
            documentosSoporte: operacion.documentosSoporte.filter((doc) => doc.id !== documentoId),
          }
        : operacion,
    ),
  )

  toast({
    title: "Evidencia eliminada",
    description: "Se removió el documento de la operación seleccionada.",
  })
}

const obligacionesTexto = actividadSeleccionada?.obligaciones ?? null

const requiereInforme27Bis = useMemo(
  () => evaluacionActual?.status === "aviso" && mismoGrupo === "si",
  [evaluacionActual, mismoGrupo],
)

const avanzar = () => {
  if (pasoActual < STEPS.length - 1 && pasoValido) {
    setPasoActual((prev) => prev + 1)
  }
}

const retroceder = () => {
  if (pasoActual > 0) {
    setPasoActual((prev) => prev - 1)
  }
}

const cambiarMesCalendario = (delta: number) => {
  let nuevoMes = mesCalendario + delta
  let nuevoAnio = anioCalendario

  if (nuevoMes < 1) {
    nuevoMes = 12
    nuevoAnio -= 1
  } else if (nuevoMes > 12) {
    nuevoMes = 1
    nuevoAnio += 1
  }

  setMesCalendario(nuevoMes)
  setAnioCalendario(nuevoAnio)
}

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/60 p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              <ShieldAlert className="h-4 w-4" />
              Monitor de actividades vulnerables
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">Tablero operativo de Actividades Vulnerables</h1>
            <p className="text-sm text-slate-600">
              Organiza la captura guiada, el seguimiento de obligaciones y la exploración normativa en un solo espacio dividido por áreas.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={() => {
                setTabActiva("captura")
                setPasoActual(0)
                setActividadInfoKey(actividadKey)
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Nueva evaluación
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setTabActiva("seguimiento")
                if (operaciones.length === 0) {
                  toast({
                    title: "Sin registros",
                    description: "Aún no existen actividades registradas. Inicia una nueva evaluación.",
                  })
                }
              }}
            >
              <ListChecks className="mr-2 h-4 w-4" /> Seguimiento activo
            </Button>
          </div>
        </div>
      </section>

      <Tabs value={tabActiva} onValueChange={setTabActiva} className="space-y-6">
        <TabsList className="grid w-full gap-2 rounded-xl border bg-white p-1 sm:grid-cols-4">
          <TabsTrigger value="resumen" className="text-sm">Resumen ejecutivo</TabsTrigger>
          <TabsTrigger value="captura" className="text-sm">Captura guiada</TabsTrigger>
          <TabsTrigger value="seguimiento" className="text-sm">Seguimiento y calendario</TabsTrigger>
          <TabsTrigger value="explorar" className="text-sm">Explorar fracciones</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-6">
          <section className="grid gap-4 lg:grid-cols-3">
            <Card className="border-slate-200 lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" /> Resumen de obligaciones activas
                </CardTitle>
                <CardDescription>Supervisión del semáforo mensual y acumulados por estatus.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border bg-emerald-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase text-emerald-600">Sin obligación</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-700">{resumenUmbrales.sinObligacion}</p>
                  <p className="text-xs text-muted-foreground">Operaciones bajo umbral.</p>
                </div>
                <div className="rounded-xl border bg-amber-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase text-amber-600">Identificación</p>
                  <p className="mt-2 text-2xl font-bold text-amber-700">{resumenUmbrales.identificacion}</p>
                  <p className="text-xs text-muted-foreground">Expediente completo y monitoreo.</p>
                </div>
                <div className="rounded-xl border bg-rose-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase text-rose-600">Aviso SAT</p>
                  <p className="mt-2 text-2xl font-bold text-rose-700">{resumenUmbrales.aviso}</p>
                  <p className="text-xs text-muted-foreground">Aviso en 17 días o informe 27 Bis.</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-emerald-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-700">
                  <ShieldAlert className="h-5 w-5" /> UMA vigente seleccionada
                </CardTitle>
                <CardDescription>Valor diario oficial según el mes y año elegidos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                {umaSeleccionada ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Periodo</p>
                        <p className="text-lg font-semibold text-slate-800">
                          {monthLabel(umaSeleccionada.month)} {umaSeleccionada.year}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-wide text-emerald-600">UMA diaria</p>
                        <p className="text-2xl font-bold text-emerald-700">
                          {formatCurrency(umaSeleccionada.daily)}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Vigente del {formatDateDisplay(umaSeleccionada.validFrom)} al
                      {" "}
                      {formatDateDisplay(umaSeleccionada.validTo)}.
                    </p>
                    <p className="rounded border border-emerald-200 bg-emerald-50/70 p-2 text-xs text-emerald-800">
                      Multiplica la UMA diaria por el número de UMAs de la fracción para obtener el monto en pesos y
                      determinar obligaciones.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-600">
                    Selecciona un mes disponible para mostrar el valor diario de la UMA correspondiente.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-slate-600" /> Últimos registros capturados
              </CardTitle>
              <CardDescription>Visualiza rápidamente las operaciones más recientes y su semáforo.</CardDescription>
            </CardHeader>
            <CardContent>
              {operacionesRecientes.length === 0 ? (
                <div className="rounded border bg-slate-50 p-4 text-sm text-slate-600">
                  Aún no hay registros disponibles. Inicia la captura guiada para evaluar tu primera operación.
                </div>
              ) : (
                <div className="space-y-3">
                  {operacionesRecientes.map((operacion) => (
                    <div key={operacion.id} className="rounded-lg border bg-white p-3 text-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-slate-800">{operacion.cliente}</p>
                          <p className="text-xs text-slate-500">{operacion.actividadNombre}</p>
                          <p className="text-xs text-slate-500">
                            {formatTipoClienteLabel(operacion.tipoCliente, operacion.detalleTipoCliente)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="outline" className="bg-white">
                            {monthLabel(operacion.mes)} {operacion.anio}
                          </Badge>
                          <span
                            className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs font-medium text-white ${getStatusColor(operacion.umbralStatus)}`}
                          >
                            {getStatusLabel(operacion.umbralStatus)}
                          </span>
                          <span className="font-semibold text-slate-700">{formatMontoOperacion(operacion)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="captura" className="space-y-4">
          <Card className="border-emerald-200">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                {STEPS.map((step, index) => {
                  const activo = pasoActual === index
                  const completado = pasoActual > index
                  return (
                    <div
                      key={step.id}
                      className={`flex flex-1 items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
                        activo
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : completado
                            ? "border-emerald-200 bg-white text-emerald-600"
                            : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      <div
                        className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                          activo
                            ? "bg-emerald-500 text-white"
                            : completado
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold">{step.titulo}</p>
                        <p className="text-xs text-slate-500">{step.descripcion}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {pasoActual === 0 && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-600" /> Paso 1. Actividad vulnerable y periodo
                </CardTitle>
                <CardDescription>
                  Selecciona la fracción aplicable y define el mes y año a evaluar. Las UMAs se muestran agrupadas por ciclo oficial del SAT.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Actividad vulnerable</Label>
                    <Select
                      value={actividadKey}
                      onValueChange={(value) => {
                        setActividadKey(value)
                        setActividadInfoKey(value)
                      }}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecciona una actividad" />
                      </SelectTrigger>
                      <SelectContent>
                        {actividadesVulnerables.map((actividad) => (
                          <SelectItem key={actividad.key} value={actividad.key}>
                            {actividad.fraccion} – {actividad.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Año
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => setInfoModal("uma-validacion")}
                        aria-label="Información sobre UMA por año"
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </Label>
                    <Select
                      value={anioSeleccionado.toString()}
                      onValueChange={(value) => {
                        const year = Number(value)
                        setAnioSeleccionado(year)
                        const meses = umaVentana
                          .filter((entry) => entry.year === year)
                          .map((entry) => entry.month)
                          .sort((a, b) => a - b)
                        if (!meses.includes(mesSeleccionado)) {
                          setMesSeleccionado(meses[0] ?? 1)
                        }
                      }}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecciona año" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableYears.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Mes</Label>
                    <Select
                      value={mesSeleccionado.toString()}
                      onValueChange={(value) => setMesSeleccionado(Number(value))}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecciona mes" />
                      </SelectTrigger>
                      <SelectContent>
                        {mesesDisponibles.map((mes) => (
                          <SelectItem key={mes} value={mes.toString()}>
                            {monthLabel(mes)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded border bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">UMA del mes seleccionado</p>
                      <p className="text-xs text-muted-foreground">
                        Se utiliza el valor diario vigente para calcular automáticamente los umbrales en pesos.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 rounded border border-emerald-200 bg-white p-4 text-sm text-slate-700">
                    {umaSeleccionada ? (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">Periodo</p>
                            <p className="text-lg font-semibold text-slate-800">
                              {monthLabel(umaSeleccionada.month)} {umaSeleccionada.year}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs uppercase tracking-wide text-emerald-600">UMA diaria</p>
                            <p className="text-2xl font-bold text-emerald-700">
                              {formatCurrency(umaSeleccionada.daily)}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Vigencia del {formatDateDisplay(umaSeleccionada.validFrom)} al {" "}
                          {formatDateDisplay(umaSeleccionada.validTo)}.
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-slate-600">
                        No se encontró UMA para este periodo. Selecciona un mes disponible en el catálogo.
                      </p>
                    )}
                  </div>
                </div>

                {actividadInfoKey && (
                  <div className="rounded border bg-white p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-700">
                          {actividadSeleccionada?.fraccion} – {actividadSeleccionada?.nombre}
                        </p>
                        <p className="text-sm text-muted-foreground">{actividadSeleccionada?.descripcion}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setActividadInfoKey(null)}
                        aria-label="Cerrar detalles"
                      >
                        <ArrowRight className="h-4 w-4 rotate-180" />
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded border bg-emerald-50 p-3 text-xs text-emerald-800">
                        <p className="font-semibold">Umbrales en UMA</p>
                        <p>Identificación: {actividadSeleccionada?.identificacionUmbralUma.toLocaleString("es-MX")}</p>
                        <p>Aviso: {actividadSeleccionada?.avisoUmbralUma.toLocaleString("es-MX")}</p>
                      </div>
                      <div className="rounded border bg-slate-50 p-3 text-xs text-slate-700">
                        <p className="font-semibold">Criterios UIF</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4">
                          {actividadSeleccionada?.criteriosUif.map((criterio) => (
                            <li key={criterio}>{criterio}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {pasoActual === 1 && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-slate-600" /> Paso 2. Datos del cliente y operación
                </CardTitle>
                <CardDescription>
                  Clasifica el tipo de cliente, define si pertenece al mismo grupo empresarial y captura los datos necesarios para la validación del umbral.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Tipo de cliente
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-600 hover:text-slate-900"
                        onClick={() => setInfoTipoClienteOpen(true)}
                        aria-label="Información sobre tipos de cliente"
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </Label>
                    <Select
                      value={tipoCliente}
                      onValueChange={(value) => {
                        setTipoCliente(value)
                        const option = obtenerOpcionTipoCliente(value)
                        if (!option?.requiresDetalle) {
                          setDetalleTipoCliente("")
                        }
                      }}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecciona tipo de cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {CLIENTE_TIPOS.map((tipo) => (
                          <SelectItem key={tipo.value} value={tipo.value}>
                            {tipo.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {tipoClienteSeleccionado?.requiresDetalle && (
                      <div className="space-y-2">
                        <Label>
                          {tipoClienteSeleccionado.detalleLabel ?? "Detalle del tipo de cliente"}
                        </Label>
                        {tipoClienteSeleccionado.detalleOpciones ? (
                          <Select
                            value={detalleTipoCliente || undefined}
                            onValueChange={(value) => setDetalleTipoCliente(value)}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue
                                placeholder={
                                  tipoClienteSeleccionado.detallePlaceholder ??
                                  "Selecciona la opción que corresponda"
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
                            placeholder={
                              tipoClienteSeleccionado.detallePlaceholder ?? "Describe la entidad o sociedad"
                            }
                            value={detalleTipoCliente}
                            onChange={(event) => setDetalleTipoCliente(event.target.value)}
                          />
                        )}
                        <p className="text-xs text-muted-foreground">
                          Especifica el giro o naturaleza de la entidad seleccionada para personalizar los
                          requisitos.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre o razón social</Label>
                    {clientesGuardados.length > 0 && (
                      <Select
                        value={clienteSeleccionado ?? NUEVO_CLIENTE_VALUE}
                        onValueChange={manejarSeleccionClienteGuardado}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Selecciona un cliente guardado" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientesGuardados.map((cliente) => (
                            <SelectItem key={cliente.rfc} value={cliente.rfc}>
                              {cliente.nombre} ({cliente.rfc}
                              {cliente.detalleTipoCliente ? ` – ${cliente.detalleTipoCliente}` : ""})
                            </SelectItem>
                          ))}
                          <SelectItem value={NUEVO_CLIENTE_VALUE}>Añadir cliente nuevo…</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Input
                      list="clientes-guardados"
                      placeholder="Ejemplo: Grupo Alfa S.A. de C.V."
                      value={clienteNombre}
                      onChange={(event) => {
                        if (clienteSeleccionado) {
                          setClienteSeleccionado(null)
                        }
                        setClienteNombre(event.target.value)
                      }}
                    />
                    {clientesGuardados.length > 0 && (
                      <>
                        <datalist id="clientes-guardados">
                          {clientesGuardados.map((cliente) => (
                            <option key={cliente.rfc} value={cliente.nombre} />
                          ))}
                        </datalist>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="justify-start px-2 text-xs"
                          onClick={() => {
                            limpiarClienteSeleccionado()
                          }}
                        >
                          Añadir otro cliente
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>RFC</Label>
                    <Input
                      placeholder="RFC del cliente"
                      value={rfc}
                      onChange={(event) => {
                        if (clienteSeleccionado) {
                          setClienteSeleccionado(null)
                        }
                        setRfc(event.target.value.toUpperCase())
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>¿Pertenece al mismo grupo empresarial?</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "si", label: "Sí" },
                        { value: "no", label: "No" },
                      ].map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={mismoGrupo === option.value ? "default" : "outline"}
                          onClick={() => setMismoGrupo(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start text-xs"
                      onClick={() => setInfoGrupoOpen(true)}
                    >
                      <Info className="mr-2 h-4 w-4" /> ¿Cómo identificar el mismo grupo?
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de operación</Label>
                    <Input
                      placeholder="Ejemplo: Compra de inmueble"
                      value={tipoOperacion}
                      onChange={(event) => setTipoOperacion(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monto</Label>
                    <Input
                      placeholder="0.00"
                      type="number"
                      min="0"
                      step="0.01"
                      value={montoOperacion}
                      onChange={(event) => setMontoOperacion(event.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Moneda</Label>
                    <Select
                      value={moneda}
                      onValueChange={(value) => {
                        setMoneda(value)
                        if (value !== "OTRA") {
                          setMonedaPersonalizadaCodigo("")
                          setMonedaPersonalizadaDescripcion("")
                        }
                      }}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecciona moneda" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONEDAS_EXTENDIDAS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {moneda === "OTRA" && (
                      <div className="space-y-2 rounded border border-dashed border-emerald-200 bg-emerald-50/60 p-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-emerald-700">Código ISO de la divisa</Label>
                          <Input
                            placeholder="Ejemplo: AUD"
                            value={monedaPersonalizadaCodigo}
                            onChange={(event) => setMonedaPersonalizadaCodigo(event.target.value.toUpperCase())}
                            maxLength={3}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-emerald-700">Descripción</Label>
                          <Input
                            placeholder="Nombre de la divisa"
                            value={monedaPersonalizadaDescripcion}
                            onChange={(event) => setMonedaPersonalizadaDescripcion(event.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de la operación</Label>
                    <Input
                      type="date"
                      value={fechaOperacion}
                      max={new Date().toISOString().substring(0, 10)}
                      onChange={(event) => setFechaOperacion(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Evidencia o comentarios</Label>
                    <Textarea
                      placeholder="Describe brevemente la evidencia documental"
                      value={evidencia}
                      onChange={(event) => setEvidencia(event.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded border bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-700">Resultado preliminar</h4>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 text-sm text-slate-600">
                      <p>
                        <span className="font-semibold">Umbral de identificación:</span> {umbralTexto.identificacion ?? "-"}
                      </p>
                      <p>
                        <span className="font-semibold">Umbral de aviso:</span> {umbralTexto.aviso ?? "-"}
                      </p>
                      <p>
                        <span className="font-semibold">Acumulado:</span> {evaluacionActual ? formatCurrency(evaluacionActual.acumulado) : "0.00"}
                      </p>
                      {evaluacionActual && (
                        <Badge
                          variant="outline"
                          className={`border-0 ${
                            evaluacionActual.status === "aviso"
                              ? "bg-rose-500/10 text-rose-600"
                              : evaluacionActual.status === "identificacion"
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-emerald-500/10 text-emerald-600"
                          }`}
                        >
                          {getStatusLabel(evaluacionActual.status)}
                        </Badge>
                      )}
                    </div>
                    {evaluacionActual && (
                      <div className="space-y-2 text-xs text-slate-600">
                        <p>
                          {evaluacionActual.status === "sin-obligacion"
                            ? "La operación no supera umbrales, monitorear acumulado mensual."
                            : evaluacionActual.status === "identificacion"
                              ? "Integra expediente completo, valida listas y conserva evidencia."
                              : "Prepara aviso ante el SAT o informe 27 Bis según el grupo empresarial."}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setInfoModal(evaluacionActual.status === "aviso" ? "umbral-aviso" : "umbral-identificacion")}
                        >
                          <Info className="mr-2 h-4 w-4" /> Más información sobre el umbral
                        </Button>
                        {evaluacionActual.alerta && (
                          <div className="flex items-start gap-2 rounded bg-amber-50 p-2 text-amber-800">
                            <AlertCircle className="mt-0.5 h-4 w-4" />
                            <span>{evaluacionActual.alerta}</span>
                          </div>
                        )}
                        {controlesEvaluacion.length > 0 && (
                          <div className="space-y-1 rounded border border-emerald-100 bg-emerald-50/60 p-2 text-emerald-800">
                            <p className="text-[11px] font-semibold uppercase tracking-wide">Controles aplicables</p>
                            <ul className="list-disc space-y-1 pl-4">
                              {controlesEvaluacion.map((control) => (
                                <li key={control}>{control}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {evaluacionActual.status !== "sin-obligacion" && (
                          <Button size="sm" variant="ghost" className="justify-start px-2" asChild>
                            <Link href="/kyc-expediente" className="flex items-center gap-2">
                              <ExternalLink className="h-4 w-4" /> Abrir módulo KYC vinculado
                            </Link>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 rounded border bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-semibold">Criterios UIF aplicables</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      {actividadSeleccionada?.criteriosUif.map((criterio) => (
                        <li key={criterio}>{criterio}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Ejemplo: {actividadSeleccionada?.fraccion} – {actividadSeleccionada?.ejemplosOperaciones[0]?.titulo}: {actividadSeleccionada?.ejemplosOperaciones[0]?.descripcion}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {obligacionesTexto && (
                    <>
                      <div
                        className={`rounded border p-3 text-sm ${
                          evaluacionActual?.status === "sin-obligacion" ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white"
                        }`}
                      >
                        <p className="font-semibold">Sin obligación</p>
                        <p className="mt-1 text-slate-600">{obligacionesTexto.sinUmbral}</p>
                      </div>
                      <div
                        className={`rounded border p-3 text-sm ${
                          evaluacionActual?.status === "identificacion" ? "border-amber-400 bg-amber-50/70" : "border-slate-200 bg-white"
                        }`}
                      >
                        <p className="font-semibold">Identificación</p>
                        <p className="mt-1 text-slate-600">{obligacionesTexto.identificacion}</p>
                      </div>
                      <div
                        className={`rounded border p-3 text-sm ${
                          evaluacionActual?.status === "aviso" ? "border-rose-400 bg-rose-50" : "border-slate-200 bg-white"
                        }`}
                      >
                        <p className="font-semibold">Aviso SAT</p>
                        <p className="mt-1 text-slate-600">{obligacionesTexto.aviso}</p>
                      </div>
                    </>
                  )}
                </div>

                {requiereInforme27Bis && (
                  <div className="rounded border border-emerald-400 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <p className="font-semibold">Informe 27 Bis</p>
                    <p>
                      La operación rebasa el umbral de aviso y el cliente pertenece al mismo grupo empresarial. Preparar informe en ceros (27 Bis) en lugar del aviso directo, preservando evidencia documental.
                    </p>
                  </div>
                )}

                {esActividadInmueble && (
                  <Card className="border-emerald-300">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-emerald-800">
                        <Building2 className="h-5 w-5" /> Cuestionario específico – Derechos de uso y goce de inmuebles
                      </CardTitle>
                      <CardDescription>
                        Prellena los datos requeridos por la UIF para el XML de la fracción XV. Los campos se actualizan con la
                        información del expediente único cuando está disponible.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                      <section className="space-y-3">
                        <h4 className="text-sm font-semibold text-emerald-700">Datos generales del aviso</h4>
                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="space-y-2">
                            <Label>Referencia del aviso</Label>
                            <Input
                              value={cuestionarioInmueble.referenciaAviso}
                              onChange={(event) =>
                                setCuestionarioInmueble((prev) => ({
                                  ...prev,
                                  referenciaAviso: event.target.value.toUpperCase(),
                                }))
                              }
                              placeholder="Ej. REF15454FG454"
                              className="uppercase"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Prioridad del aviso</Label>
                            <Select
                              value={cuestionarioInmueble.prioridad}
                              onValueChange={(value) =>
                                setCuestionarioInmueble((prev) => ({ ...prev, prioridad: value }))
                              }
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Selecciona prioridad" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1 – Ordinario</SelectItem>
                                <SelectItem value="2">2 – Relevante</SelectItem>
                                <SelectItem value="3">3 – Urgente</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Clave del sujeto obligado</Label>
                            <Input
                              value={cuestionarioInmueble.claveSujetoObligado}
                              onChange={(event) =>
                                setCuestionarioInmueble((prev) => ({
                                  ...prev,
                                  claveSujetoObligado: event.target.value.toUpperCase(),
                                }))
                              }
                              placeholder="Ej. OGA751212G56"
                              className="uppercase"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Clave de actividad vulnerable</Label>
                            <Input
                              value={cuestionarioInmueble.claveActividad}
                              onChange={(event) =>
                                setCuestionarioInmueble((prev) => ({
                                  ...prev,
                                  claveActividad: event.target.value.toUpperCase(),
                                }))
                              }
                              placeholder="Ej. INM"
                              className="uppercase"
                            />
                          </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="space-y-2">
                            <Label>Tipo de alerta</Label>
                            <Input
                              value={cuestionarioInmueble.alertaTipo}
                              onChange={(event) =>
                                setCuestionarioInmueble((prev) => ({
                                  ...prev,
                                  alertaTipo: event.target.value.toUpperCase(),
                                }))
                              }
                              placeholder="Ej. 521"
                              className="uppercase"
                            />
                          </div>
                          <div className="md:col-span-2 space-y-2">
                            <Label>Descripción de la alerta</Label>
                            <Textarea
                              value={cuestionarioInmueble.alertaDescripcion}
                              onChange={(event) =>
                                setCuestionarioInmueble((prev) => ({
                                  ...prev,
                                  alertaDescripcion: event.target.value,
                                }))
                              }
                              placeholder="Describe la razón por la cual se genera el aviso o seguimiento"
                              rows={3}
                            />
                          </div>
                        </div>
                      </section>

                      <section className="space-y-4 rounded border border-emerald-200 bg-emerald-50/50 p-4">
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold text-emerald-800">Datos de la persona reportada</h4>
                          <p className="text-xs text-emerald-700">
                            Se prellenan con el expediente KYC cuando coincide el RFC. Puedes ajustar cualquier dato antes de
                            generar el XML.
                          </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="space-y-2">
                            <Label>Tipo de persona</Label>
                            <Select
                              value={cuestionarioInmueble.personaReportada.tipoPersona}
                              onValueChange={(value) =>
                                actualizarPersonaReportada((persona) => ({ ...persona, tipoPersona: value as PersonaAvisoTipo }))
                              }
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Selecciona tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="persona_moral">Persona moral</SelectItem>
                                <SelectItem value="persona_fisica">Persona física</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label>{
                              cuestionarioInmueble.personaReportada.tipoPersona === "persona_moral"
                                ? "Denominación o razón social"
                                : "Nombre completo"
                            }</Label>
                            <Input
                              value={cuestionarioInmueble.personaReportada.denominacionRazon}
                              onChange={(event) =>
                                actualizarPersonaReportada((persona) => ({
                                  ...persona,
                                  denominacionRazon: event.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="space-y-2">
                            <Label>
                              {cuestionarioInmueble.personaReportada.tipoPersona === "persona_moral"
                                ? "Fecha de constitución"
                                : "Fecha de nacimiento"}
                            </Label>
                            <Input
                              type="date"
                              value={cuestionarioInmueble.personaReportada.fechaConstitucion}
                              onChange={(event) =>
                                actualizarPersonaReportada((persona) => ({
                                  ...persona,
                                  fechaConstitucion: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>RFC</Label>
                            <Input
                              value={cuestionarioInmueble.personaReportada.rfc}
                              onChange={(event) =>
                                actualizarPersonaReportada((persona) => ({
                                  ...persona,
                                  rfc: event.target.value.toUpperCase(),
                                }))
                              }
                              className="uppercase"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>País de nacionalidad</Label>
                            <Select
                              value={cuestionarioInmueble.personaReportada.nacionalidad}
                              onValueChange={(value) =>
                                actualizarPersonaReportada((persona) => ({ ...persona, nacionalidad: value }))
                              }
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Selecciona país" />
                              </SelectTrigger>
                              <SelectContent>
                                {PAISES.map((pais) => (
                                  <SelectItem key={pais.value} value={pais.value}>
                                    {pais.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Giro mercantil / ocupación</Label>
                            <Input
                              value={cuestionarioInmueble.personaReportada.giro}
                              onChange={(event) =>
                                actualizarPersonaReportada((persona) => ({
                                  ...persona,
                                  giro: event.target.value,
                                }))
                              }
                              placeholder="Ej. Industria - maquinaria y equipo"
                            />
                          </div>
                        </div>
                        {cuestionarioInmueble.personaReportada.tipoPersona === "persona_moral" && (
                          <div className="grid gap-4 md:grid-cols-5">
                            <div className="space-y-2">
                              <Label>Nombre del representante</Label>
                              <Input
                                value={cuestionarioInmueble.personaReportada.representante.nombre}
                                onChange={(event) =>
                                  actualizarPersonaReportada((persona) => ({
                                    ...persona,
                                    representante: { ...persona.representante, nombre: event.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Apellido paterno</Label>
                              <Input
                                value={cuestionarioInmueble.personaReportada.representante.apellidoPaterno}
                                onChange={(event) =>
                                  actualizarPersonaReportada((persona) => ({
                                    ...persona,
                                    representante: {
                                      ...persona.representante,
                                      apellidoPaterno: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Apellido materno</Label>
                              <Input
                                value={cuestionarioInmueble.personaReportada.representante.apellidoMaterno}
                                onChange={(event) =>
                                  actualizarPersonaReportada((persona) => ({
                                    ...persona,
                                    representante: {
                                      ...persona.representante,
                                      apellidoMaterno: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Fecha de nacimiento</Label>
                              <Input
                                type="date"
                                value={cuestionarioInmueble.personaReportada.representante.fechaNacimiento}
                                onChange={(event) =>
                                  actualizarPersonaReportada((persona) => ({
                                    ...persona,
                                    representante: {
                                      ...persona.representante,
                                      fechaNacimiento: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>RFC del representante</Label>
                              <Input
                                value={cuestionarioInmueble.personaReportada.representante.rfc}
                                onChange={(event) =>
                                  actualizarPersonaReportada((persona) => ({
                                    ...persona,
                                    representante: {
                                      ...persona.representante,
                                      rfc: event.target.value.toUpperCase(),
                                    },
                                  }))
                                }
                                className="uppercase"
                              />
                            </div>
                          </div>
                        )}
                        <div className="space-y-3 rounded border border-emerald-200 bg-white p-4">
                          <h5 className="text-sm font-semibold text-emerald-700">Domicilio de la persona reportada</h5>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label>Ámbito</Label>
                              <Select
                                value={cuestionarioInmueble.personaReportada.domicilio.ambito}
                                onValueChange={(value) =>
                                  actualizarPersonaReportada((persona) => ({
                                    ...persona,
                                    domicilio: { ...persona.domicilio, ambito: value as DomicilioAmbito },
                                  }))
                                }
                              >
                                <SelectTrigger className="bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="nacional">Nacional</SelectItem>
                                  <SelectItem value="extranjero">Extranjero</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Código postal</Label>
                              <Input
                                value={cuestionarioInmueble.personaReportada.domicilio.codigoPostal}
                                onChange={(event) =>
                                  actualizarPersonaReportada((persona) => ({
                                    ...persona,
                                    domicilio: {
                                      ...persona.domicilio,
                                      codigoPostal: event.target.value.replace(/[^0-9]/g, "").slice(0, 5),
                                    },
                                  }))
                                }
                                inputMode="numeric"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>País</Label>
                              <Select
                                value={cuestionarioInmueble.personaReportada.domicilio.pais}
                                onValueChange={(value) =>
                                  actualizarPersonaReportada((persona) => ({
                                    ...persona,
                                    domicilio: { ...persona.domicilio, pais: value },
                                  }))
                                }
                              >
                                <SelectTrigger className="bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PAISES.map((pais) => (
                                    <SelectItem key={pais.value} value={pais.value}>
                                      {pais.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {cuestionarioInmueble.personaReportada.domicilio.ambito === "nacional" && (
                            <div className="grid gap-4 md:grid-cols-3">
                              <div className="space-y-2">
                                <Label>Entidad federativa</Label>
                                <Select
                                  value={cuestionarioInmueble.personaReportada.domicilio.entidad}
                                  onValueChange={(value) =>
                                    actualizarPersonaReportada((persona) => ({
                                      ...persona,
                                      domicilio: { ...persona.domicilio, entidad: value },
                                    }))
                                  }
                                >
                                  <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="Selecciona entidad" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ENTIDADES_FEDERATIVAS.map((entidad) => (
                                      <SelectItem key={entidad.value} value={entidad.value}>
                                        {entidad.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Municipio o alcaldía</Label>
                                <Input
                                  value={cuestionarioInmueble.personaReportada.domicilio.municipio}
                                  onChange={(event) =>
                                    actualizarPersonaReportada((persona) => ({
                                      ...persona,
                                      domicilio: { ...persona.domicilio, municipio: event.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Colonia</Label>
                                <Select
                                  value={cuestionarioInmueble.personaReportada.domicilio.colonia}
                                  onValueChange={(value) =>
                                    actualizarPersonaReportada((persona) => ({
                                      ...persona,
                                      domicilio: { ...persona.domicilio, colonia: value },
                                    }))
                                  }
                                >
                                  <SelectTrigger className="bg-white">
                                    <SelectValue placeholder="Selecciona colonia" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {coloniasPersona.length === 0 ? (
                                      <SelectItem value={cuestionarioInmueble.personaReportada.domicilio.colonia || ""}>
                                        {cuestionarioInmueble.personaReportada.domicilio.colonia || "Sin catálogo"}
                                      </SelectItem>
                                    ) : (
                                      coloniasPersona.map((colonia) => (
                                        <SelectItem key={colonia} value={colonia}>
                                          {colonia}
                                        </SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label>Calle, avenida o vía</Label>
                              <Input
                                value={cuestionarioInmueble.personaReportada.domicilio.calle}
                                onChange={(event) =>
                                  actualizarPersonaReportada((persona) => ({
                                    ...persona,
                                    domicilio: { ...persona.domicilio, calle: event.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Número exterior</Label>
                              <Input
                                value={cuestionarioInmueble.personaReportada.domicilio.numeroExterior}
                                onChange={(event) =>
                                  actualizarPersonaReportada((persona) => ({
                                    ...persona,
                                    domicilio: { ...persona.domicilio, numeroExterior: event.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Número interior</Label>
                              <Input
                                value={cuestionarioInmueble.personaReportada.domicilio.numeroInterior}
                                onChange={(event) =>
                                  actualizarPersonaReportada((persona) => ({
                                    ...persona,
                                    domicilio: { ...persona.domicilio, numeroInterior: event.target.value },
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label>Teléfono</Label>
                              <div className="flex gap-2">
                                <Select
                                  value={cuestionarioInmueble.personaReportada.clavePaisTelefono}
                                  onValueChange={(value) =>
                                    actualizarPersonaReportada((persona) => ({
                                      ...persona,
                                      clavePaisTelefono: value,
                                    }))
                                  }
                                >
                                  <SelectTrigger className="w-28 bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PAISES_TELEFONO.map((clave) => (
                                      <SelectItem key={clave.value} value={clave.value}>
                                        {clave.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  value={cuestionarioInmueble.personaReportada.telefono}
                                  onChange={(event) =>
                                    actualizarPersonaReportada((persona) => ({
                                      ...persona,
                                      telefono: event.target.value.replace(/[^0-9]/g, ""),
                                    }))
                                  }
                                  placeholder="5552572500"
                                />
                              </div>
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label>Correo electrónico</Label>
                              <Input
                                type="email"
                                value={cuestionarioInmueble.personaReportada.correoElectronico}
                                onChange={(event) =>
                                  actualizarPersonaReportada((persona) => ({
                                    ...persona,
                                    correoElectronico: event.target.value,
                                  }))
                                }
                                placeholder="correo@empresa.com"
                              />
                            </div>
                          </div>
                        </div>
                      </section>

                      <section className="space-y-4 rounded border border-emerald-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold text-emerald-700">Beneficiario controlador</h4>
                            <p className="text-xs text-muted-foreground">
                              Registra a la persona física que recibe el beneficio final. Marca la casilla si aplica para este
                              aviso.
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-emerald-700">
                            <Checkbox
                              id="beneficiario-activo"
                              checked={cuestionarioInmueble.incluirBeneficiario}
                              onCheckedChange={(checked) =>
                                setCuestionarioInmueble((prev) => ({
                                  ...prev,
                                  incluirBeneficiario: Boolean(checked),
                                }))
                              }
                            />
                            <Label htmlFor="beneficiario-activo">Incluir beneficiario controlador</Label>
                          </div>
                        </div>
                        {cuestionarioInmueble.incluirBeneficiario ? (
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label>Nombre(s)</Label>
                              <Input
                                value={cuestionarioInmueble.beneficiario.nombre}
                                onChange={(event) =>
                                  actualizarBeneficiario((beneficiario) => ({
                                    ...beneficiario,
                                    nombre: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Apellido paterno</Label>
                              <Input
                                value={cuestionarioInmueble.beneficiario.apellidoPaterno}
                                onChange={(event) =>
                                  actualizarBeneficiario((beneficiario) => ({
                                    ...beneficiario,
                                    apellidoPaterno: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Apellido materno</Label>
                              <Input
                                value={cuestionarioInmueble.beneficiario.apellidoMaterno}
                                onChange={(event) =>
                                  actualizarBeneficiario((beneficiario) => ({
                                    ...beneficiario,
                                    apellidoMaterno: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Fecha de nacimiento</Label>
                              <Input
                                type="date"
                                value={cuestionarioInmueble.beneficiario.fechaNacimiento}
                                onChange={(event) =>
                                  actualizarBeneficiario((beneficiario) => ({
                                    ...beneficiario,
                                    fechaNacimiento: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>RFC</Label>
                              <Input
                                value={cuestionarioInmueble.beneficiario.rfc}
                                onChange={(event) =>
                                  actualizarBeneficiario((beneficiario) => ({
                                    ...beneficiario,
                                    rfc: event.target.value.toUpperCase(),
                                  }))
                                }
                                className="uppercase"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>CURP</Label>
                              <Input
                                value={cuestionarioInmueble.beneficiario.curp}
                                onChange={(event) =>
                                  actualizarBeneficiario((beneficiario) => ({
                                    ...beneficiario,
                                    curp: event.target.value.toUpperCase(),
                                  }))
                                }
                                className="uppercase"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>País de nacionalidad</Label>
                              <Select
                                value={cuestionarioInmueble.beneficiario.paisNacionalidad}
                                onValueChange={(value) =>
                                  actualizarBeneficiario((beneficiario) => ({
                                    ...beneficiario,
                                    paisNacionalidad: value,
                                  }))
                                }
                              >
                                <SelectTrigger className="bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PAISES.map((pais) => (
                                    <SelectItem key={pais.value} value={pais.value}>
                                      {pais.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Marca la casilla para capturar la información de la persona que ejerce el control o beneficio final
                            de la operación.
                          </p>
                        )}
                      </section>

                      <section className="space-y-4 rounded border border-slate-200 bg-white p-4">
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold text-slate-700">Datos de la operación y del inmueble</h4>
                          <p className="text-xs text-muted-foreground">
                            Indica las características del arrendamiento o derecho de uso, así como la liquidación registrada.
                          </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="space-y-2">
                            <Label>Fecha de la operación</Label>
                            <Input
                              type="date"
                              value={cuestionarioInmueble.datosOperacion.fechaOperacion}
                              onChange={(event) =>
                                actualizarDatosOperacion((datos) => ({
                                  ...datos,
                                  fechaOperacion: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Tipo de operación</Label>
                            <Select
                              value={cuestionarioInmueble.datosOperacion.tipoOperacion}
                              onValueChange={(value) =>
                                actualizarDatosOperacion((datos) => ({ ...datos, tipoOperacion: value }))
                              }
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Selecciona" />
                              </SelectTrigger>
                              <SelectContent>
                                {TIPOS_OPERACION_INMUEBLE.map((opcion) => (
                                  <SelectItem key={opcion.value} value={opcion.value}>
                                    {opcion.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Figura del cliente</Label>
                            <Select
                              value={cuestionarioInmueble.datosOperacion.figuraCliente}
                              onValueChange={(value) =>
                                actualizarDatosOperacion((datos) => ({ ...datos, figuraCliente: value }))
                              }
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Selecciona" />
                              </SelectTrigger>
                              <SelectContent>
                                {FIGURA_CLIENTE_OPCIONES.map((opcion) => (
                                  <SelectItem key={opcion.value} value={opcion.value}>
                                    {opcion.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Figura del sujeto obligado</Label>
                            <Select
                              value={cuestionarioInmueble.datosOperacion.figuraSujetoObligado}
                              onValueChange={(value) =>
                                actualizarDatosOperacion((datos) => ({ ...datos, figuraSujetoObligado: value }))
                              }
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Selecciona" />
                              </SelectTrigger>
                              <SelectContent>
                                {FIGURA_SUJETO_OBLIGADO_OPCIONES.map((opcion) => (
                                  <SelectItem key={opcion.value} value={opcion.value}>
                                    {opcion.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Fecha de inicio del contrato</Label>
                            <Input
                              type="date"
                              value={cuestionarioInmueble.datosOperacion.fechaInicio}
                              onChange={(event) =>
                                actualizarDatosOperacion((datos) => ({
                                  ...datos,
                                  fechaInicio: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Fecha de término</Label>
                            <Input
                              type="date"
                              value={cuestionarioInmueble.datosOperacion.fechaTermino}
                              onChange={(event) =>
                                actualizarDatosOperacion((datos) => ({
                                  ...datos,
                                  fechaTermino: event.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="space-y-3 rounded border border-slate-200 bg-slate-50/60 p-4">
                          <h5 className="text-sm font-semibold text-slate-700">Características del inmueble</h5>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label>Tipo de inmueble</Label>
                              <Select
                                value={cuestionarioInmueble.datosOperacion.caracteristicas.tipoInmueble}
                                onValueChange={(value) =>
                                  actualizarDatosOperacion((datos) => ({
                                    ...datos,
                                    caracteristicas: { ...datos.caracteristicas, tipoInmueble: value },
                                  }))
                                }
                              >
                                <SelectTrigger className="bg-white">
                                  <SelectValue placeholder="Selecciona" />
                                </SelectTrigger>
                                <SelectContent>
                                  {TIPOS_INMUEBLE.map((tipo) => (
                                    <SelectItem key={tipo.value} value={tipo.value}>
                                      {tipo.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Valor pactado</Label>
                              <Input
                                value={cuestionarioInmueble.datosOperacion.caracteristicas.valorPactado}
                                onChange={(event) =>
                                  actualizarDatosOperacion((datos) => ({
                                    ...datos,
                                    caracteristicas: {
                                      ...datos.caracteristicas,
                                      valorPactado: event.target.value,
                                    },
                                  }))
                                }
                                placeholder="Ej. 5820000.12"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Folio real o antecedente</Label>
                              <Input
                                value={cuestionarioInmueble.datosOperacion.caracteristicas.folioReal}
                                onChange={(event) =>
                                  actualizarDatosOperacion((datos) => ({
                                    ...datos,
                                    caracteristicas: {
                                      ...datos.caracteristicas,
                                      folioReal: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label>Dimensión del terreno (m²)</Label>
                              <Input
                                value={cuestionarioInmueble.datosOperacion.caracteristicas.dimensionTerreno}
                                onChange={(event) =>
                                  actualizarDatosOperacion((datos) => ({
                                    ...datos,
                                    caracteristicas: {
                                      ...datos.caracteristicas,
                                      dimensionTerreno: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Dimensión construida (m²)</Label>
                              <Input
                                value={cuestionarioInmueble.datosOperacion.caracteristicas.dimensionConstruida}
                                onChange={(event) =>
                                  actualizarDatosOperacion((datos) => ({
                                    ...datos,
                                    caracteristicas: {
                                      ...datos.caracteristicas,
                                      dimensionConstruida: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Valor de avalúo / catastral</Label>
                              <Input
                                value={cuestionarioInmueble.datosOperacion.instrumento.valorAvaluo}
                                onChange={(event) =>
                                  actualizarDatosOperacion((datos) => ({
                                    ...datos,
                                    instrumento: {
                                      ...datos.instrumento,
                                      valorAvaluo: event.target.value,
                                    },
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label>Código postal</Label>
                              <Input
                                value={cuestionarioInmueble.datosOperacion.caracteristicas.ubicacion.codigoPostal}
                                onChange={(event) =>
                                  actualizarDatosOperacion((datos) => ({
                                    ...datos,
                                    caracteristicas: {
                                      ...datos.caracteristicas,
                                      ubicacion: {
                                        ...datos.caracteristicas.ubicacion,
                                        codigoPostal: event.target.value.replace(/[^0-9]/g, "").slice(0, 5),
                                      },
                                    },
                                  }))
                                }
                                inputMode="numeric"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Estado</Label>
                              <Input
                                value={cuestionarioInmueble.datosOperacion.caracteristicas.ubicacion.estado}
                                onChange={(event) =>
                                  actualizarDatosOperacion((datos) => ({
                                    ...datos,
                                    caracteristicas: {
                                      ...datos.caracteristicas,
                                      ubicacion: {
                                        ...datos.caracteristicas.ubicacion,
                                        estado: event.target.value,
                                      },
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Municipio</Label>
                              <Input
                                value={cuestionarioInmueble.datosOperacion.caracteristicas.ubicacion.municipio}
                                onChange={(event) =>
                                  actualizarDatosOperacion((datos) => ({
                                    ...datos,
                                    caracteristicas: {
                                      ...datos.caracteristicas,
                                      ubicacion: {
                                        ...datos.caracteristicas.ubicacion,
                                        municipio: event.target.value,
                                      },
                                    },
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label>Colonia</Label>
                              <Select
                                value={cuestionarioInmueble.datosOperacion.caracteristicas.ubicacion.colonia}
                                onValueChange={(value) =>
                                  actualizarDatosOperacion((datos) => ({
                                    ...datos,
                                    caracteristicas: {
                                      ...datos.caracteristicas,
                                      ubicacion: { ...datos.caracteristicas.ubicacion, colonia: value },
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger className="bg-white">
                                  <SelectValue placeholder="Selecciona colonia" />
                                </SelectTrigger>
                                <SelectContent>
                                  {coloniasInmueble.length === 0 ? (
                                    <SelectItem
                                      value={cuestionarioInmueble.datosOperacion.caracteristicas.ubicacion.colonia || ""}
                                    >
                                      {cuestionarioInmueble.datosOperacion.caracteristicas.ubicacion.colonia || "Sin catálogo"}
                                    </SelectItem>
                                  ) : (
                                    coloniasInmueble.map((colonia) => (
                                      <SelectItem key={colonia} value={colonia}>
                                        {colonia}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Calle</Label>
                              <Input
                                value={cuestionarioInmueble.datosOperacion.caracteristicas.ubicacion.calle}
                                onChange={(event) =>
                                  actualizarDatosOperacion((datos) => ({
                                    ...datos,
                                    caracteristicas: {
                                      ...datos.caracteristicas,
                                      ubicacion: { ...datos.caracteristicas.ubicacion, calle: event.target.value },
                                    },
                                  }))
                                }
                              />
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <Label>Número exterior</Label>
                                <Input
                                  value={cuestionarioInmueble.datosOperacion.caracteristicas.ubicacion.numeroExterior}
                                  onChange={(event) =>
                                    actualizarDatosOperacion((datos) => ({
                                      ...datos,
                                      caracteristicas: {
                                        ...datos.caracteristicas,
                                        ubicacion: {
                                          ...datos.caracteristicas.ubicacion,
                                          numeroExterior: event.target.value,
                                        },
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Número interior</Label>
                                <Input
                                  value={cuestionarioInmueble.datosOperacion.caracteristicas.ubicacion.numeroInterior}
                                  onChange={(event) =>
                                    actualizarDatosOperacion((datos) => ({
                                      ...datos,
                                      caracteristicas: {
                                        ...datos.caracteristicas,
                                        ubicacion: {
                                          ...datos.caracteristicas.ubicacion,
                                          numeroInterior: event.target.value,
                                        },
                                      },
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-4">
                          <div className="space-y-2">
                            <Label>Número de instrumento público</Label>
                            <Input
                              value={cuestionarioInmueble.datosOperacion.instrumento.numero}
                              onChange={(event) =>
                                actualizarDatosOperacion((datos) => ({
                                  ...datos,
                                  instrumento: { ...datos.instrumento, numero: event.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Fecha del instrumento</Label>
                            <Input
                              type="date"
                              value={cuestionarioInmueble.datosOperacion.instrumento.fecha}
                              onChange={(event) =>
                                actualizarDatosOperacion((datos) => ({
                                  ...datos,
                                  instrumento: { ...datos.instrumento, fecha: event.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Número de notario</Label>
                            <Input
                              value={cuestionarioInmueble.datosOperacion.instrumento.notario}
                              onChange={(event) =>
                                actualizarDatosOperacion((datos) => ({
                                  ...datos,
                                  instrumento: { ...datos.instrumento, notario: event.target.value },
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Entidad del instrumento</Label>
                            <Input
                              value={cuestionarioInmueble.datosOperacion.instrumento.entidad}
                              onChange={(event) =>
                                actualizarDatosOperacion((datos) => ({
                                  ...datos,
                                  instrumento: { ...datos.instrumento, entidad: event.target.value },
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Checkbox
                              id="contraparte-activa"
                              checked={cuestionarioInmueble.incluirContraparte}
                              onCheckedChange={(checked) =>
                                setCuestionarioInmueble((prev) => ({
                                  ...prev,
                                  incluirContraparte: Boolean(checked),
                                }))
                              }
                            />
                            <span>Agregar datos de contraparte o arrendador relacionado</span>
                          </Label>
                          {cuestionarioInmueble.incluirContraparte && (
                            <div className="grid gap-4 md:grid-cols-3">
                              <div className="space-y-2">
                                <Label>Tipo de persona</Label>
                                <Select
                                  value={cuestionarioInmueble.datosOperacion.contraparte.tipoPersona}
                                  onValueChange={(value) =>
                                    actualizarDatosOperacion((datos) => ({
                                      ...datos,
                                      contraparte: { ...datos.contraparte, tipoPersona: value as PersonaAvisoTipo },
                                    }))
                                  }
                                >
                                  <SelectTrigger className="bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="persona_fisica">Persona física</SelectItem>
                                    <SelectItem value="persona_moral">Persona moral</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Nombre o razón social</Label>
                                <Input
                                  value={cuestionarioInmueble.datosOperacion.contraparte.nombre}
                                  onChange={(event) =>
                                    actualizarDatosOperacion((datos) => ({
                                      ...datos,
                                      contraparte: { ...datos.contraparte, nombre: event.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Apellido paterno</Label>
                                <Input
                                  value={cuestionarioInmueble.datosOperacion.contraparte.apellidoPaterno}
                                  onChange={(event) =>
                                    actualizarDatosOperacion((datos) => ({
                                      ...datos,
                                      contraparte: {
                                        ...datos.contraparte,
                                        apellidoPaterno: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Apellido materno</Label>
                                <Input
                                  value={cuestionarioInmueble.datosOperacion.contraparte.apellidoMaterno}
                                  onChange={(event) =>
                                    actualizarDatosOperacion((datos) => ({
                                      ...datos,
                                      contraparte: {
                                        ...datos.contraparte,
                                        apellidoMaterno: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Fecha de nacimiento / constitución</Label>
                                <Input
                                  type="date"
                                  value={cuestionarioInmueble.datosOperacion.contraparte.fechaNacimiento}
                                  onChange={(event) =>
                                    actualizarDatosOperacion((datos) => ({
                                      ...datos,
                                      contraparte: {
                                        ...datos.contraparte,
                                        fechaNacimiento: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>RFC</Label>
                                <Input
                                  value={cuestionarioInmueble.datosOperacion.contraparte.rfc}
                                  onChange={(event) =>
                                    actualizarDatosOperacion((datos) => ({
                                      ...datos,
                                      contraparte: {
                                        ...datos.contraparte,
                                        rfc: event.target.value.toUpperCase(),
                                      },
                                    }))
                                  }
                                  className="uppercase"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>País de nacionalidad</Label>
                                <Select
                                  value={cuestionarioInmueble.datosOperacion.contraparte.paisNacionalidad}
                                  onValueChange={(value) =>
                                    actualizarDatosOperacion((datos) => ({
                                      ...datos,
                                      contraparte: { ...datos.contraparte, paisNacionalidad: value },
                                    }))
                                  }
                                >
                                  <SelectTrigger className="bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PAISES.map((pais) => (
                                      <SelectItem key={pais.value} value={pais.value}>
                                        {pais.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3 rounded border border-emerald-200 bg-emerald-50/60 p-4">
                          <h5 className="text-sm font-semibold text-emerald-700">Datos de liquidación</h5>
                          <div className="grid gap-4 md:grid-cols-4">
                            <div className="space-y-2">
                              <Label>Fecha de pago</Label>
                              <Input
                                type="date"
                                value={cuestionarioInmueble.datosOperacion.liquidacion.fechaPago}
                                onChange={(event) =>
                                  actualizarDatosOperacion((datos) => ({
                                    ...datos,
                                    liquidacion: { ...datos.liquidacion, fechaPago: event.target.value },
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Forma de pago</Label>
                              <Select
                                value={cuestionarioInmueble.datosOperacion.liquidacion.formaPago}
                                onValueChange={(value) =>
                                  actualizarDatosOperacion((datos) => ({
                                    ...datos,
                                    liquidacion: { ...datos.liquidacion, formaPago: value },
                                  }))
                                }
                              >
                                <SelectTrigger className="bg-white">
                                  <SelectValue placeholder="Selecciona" />
                                </SelectTrigger>
                                <SelectContent>
                                  {FORMAS_PAGO.map((forma) => (
                                    <SelectItem key={forma.value} value={forma.value}>
                                      {forma.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Instrumento monetario</Label>
                              <Select
                                value={cuestionarioInmueble.datosOperacion.liquidacion.instrumentoMonetario}
                                onValueChange={(value) =>
                                  actualizarDatosOperacion((datos) => ({
                                    ...datos,
                                    liquidacion: { ...datos.liquidacion, instrumentoMonetario: value },
                                  }))
                                }
                              >
                                <SelectTrigger className="bg-white">
                                  <SelectValue placeholder="Selecciona" />
                                </SelectTrigger>
                                <SelectContent>
                                  {INSTRUMENTOS_MONETARIOS.map((instrumento) => (
                                    <SelectItem key={instrumento.value} value={instrumento.value}>
                                      {instrumento.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Moneda</Label>
                              <Select
                                value={cuestionarioInmueble.datosOperacion.liquidacion.moneda}
                                onValueChange={(value) =>
                                  actualizarDatosOperacion((datos) => ({
                                    ...datos,
                                    liquidacion: { ...datos.liquidacion, moneda: value },
                                  }))
                                }
                              >
                                <SelectTrigger className="bg-white">
                                  <SelectValue placeholder="Selecciona" />
                                </SelectTrigger>
                                <SelectContent>
                                  {MONEDAS_EXTENDIDAS.map((monedaOption) => (
                                    <SelectItem key={monedaOption.value} value={monedaOption.value}>
                                      {monedaOption.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Monto liquidado</Label>
                            <Input
                              value={cuestionarioInmueble.datosOperacion.liquidacion.montoOperacion}
                              onChange={(event) =>
                                actualizarDatosOperacion((datos) => ({
                                  ...datos,
                                  liquidacion: {
                                    ...datos.liquidacion,
                                    montoOperacion: event.target.value,
                                  },
                                }))
                              }
                              placeholder="Ej. 234234344.00"
                            />
                          </div>
                        </div>
                      </section>
                    </CardContent>
                  </Card>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded border bg-white p-4 text-sm text-slate-700">
                    <p className="font-semibold">Datos requeridos para aviso SAT</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      <li>RFC del sujeto obligado y del cliente.</li>
                      <li>Periodo con nomenclatura AAAAMM (ej. {evaluacionActual?.periodo ?? buildPeriodo(anioSeleccionado, mesSeleccionado)}).</li>
                      <li>Clave de actividad vulnerable conforme al catálogo oficial del SAT.</li>
                      <li>Detalle del acto u operación, forma de pago, moneda y evidencia documental.</li>
                    </ul>
                  </div>
                  <div className="space-y-2 rounded border bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-semibold">Guía de registro SAT y responsables</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      <li>Datos del representante legal y encargado de cumplimiento.</li>
                      <li>Documento que acredite representación y RFC activo.</li>
                      <li>Medios de contacto y domicilio fiscal del sujeto obligado.</li>
                      <li>Designación de responsable de avisos, alta en el padrón de actividades vulnerables.</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {pasoActual === 2 && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-slate-600" /> Paso 3. Resultado del umbral y obligaciones aplicables
                </CardTitle>
                <CardDescription>
                  Confirma el resultado de la evaluación, genera avisos preliminares y exporta XML para revisión interna.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3 rounded border bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-semibold">Resumen del registro</p>
                    <ul className="space-y-1 text-xs">
                      <li>
                        <span className="font-semibold">Cliente:</span> {clienteNombre || "Sin registrar"} ({rfc || "RFC pendiente"})
                      </li>
                      <li>
                        <span className="font-semibold">Tipo de cliente:</span> {formatTipoClienteLabel(
                          tipoCliente,
                          tipoClienteSeleccionado?.requiresDetalle ? detalleTipoCliente : undefined,
                        )}
                      </li>
                      <li>
                        <span className="font-semibold">Periodo:</span> {monthLabel(mesSeleccionado)} {anioSeleccionado}
                      </li>
                      <li>
                        <span className="font-semibold">Monto:</span>{" "}
                        {montoOperacion
                          ? formatCurrency(
                              Number(montoOperacion),
                              moneda === "OTRA"
                                ? monedaPersonalizadaCodigo.trim().toUpperCase() || "MXN"
                                : moneda,
                            )
                          : "0.00"}{" "}
                        {moneda === "OTRA"
                          ? `${monedaPersonalizadaCodigo.trim().toUpperCase()}${
                              monedaPersonalizadaDescripcion.trim()
                                ? ` – ${monedaPersonalizadaDescripcion.trim()}`
                                : ""
                            }`
                          : getMonedaLabel(moneda)}
                      </li>
                      <li>
                        <span className="font-semibold">Actividad:</span> {actividadSeleccionada?.fraccion} – {actividadSeleccionada?.nombre}
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-3 rounded border bg-white p-4 text-sm text-slate-700">
                    <p className="font-semibold">Recomendaciones</p>
                    <p className="text-xs text-muted-foreground">
                      Genera un aviso preliminar para revisar la información con el responsable de cumplimiento antes de cargarla en el portal del SAT.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!evaluacionActual}
                        onClick={() => {
                          if (!evaluacionActual) return
                          toast({
                            title: "Previsualización lista",
                            description: "Verifica los datos antes de enviar el aviso al SAT.",
                          })
                        }}
                      >
                        Vista previa
                      </Button>
                      <Button type="button" onClick={agregarOperacion} disabled={!pasoValido}>
                        Guardar operación y semáforo
                      </Button>
                    </div>
                    {controlesEvaluacion.length > 0 && (
                      <div className="space-y-1 rounded border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-emerald-800">
                        <p className="font-semibold uppercase tracking-wide">Controles aplicables</p>
                        <ul className="list-disc space-y-1 pl-4">
                          {controlesEvaluacion.map((control) => (
                            <li key={control}>{control}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setPasoActual(0)
                  limpiarFormulario()
                  setTabActiva("resumen")
                }}
              >
                Cancelar
              </Button>
              {pasoActual > 0 && (
                <Button variant="outline" onClick={retroceder}>
                  Regresar
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {pasoActual < STEPS.length - 1 && (
                <Button onClick={avanzar} disabled={!pasoValido}>
                  Siguiente
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
              {pasoActual === STEPS.length - 1 && (
                <Button onClick={agregarOperacion} disabled={!pasoValido}>
                  Añadir actividad vulnerable
                </Button>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="seguimiento" className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-slate-600" /> Seguimiento de operaciones por semáforo
              </CardTitle>
              <CardDescription>
                Clasifica a los clientes según los umbrales alcanzados y gestiona la generación de avisos o informes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 lg:grid-cols-3">
                {["sin-obligacion", "identificacion", "aviso"].map((status) => (
                  <Card key={status} className="border-slate-200">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <span className={`inline-flex h-3 w-3 rounded-full ${getStatusColor(status as UmbralStatus)}`} />
                        {getStatusLabel(status as UmbralStatus)}
                      </CardTitle>
                      <CardDescription>
                        {(operacionesAgrupadas.get(status as UmbralStatus) ?? []).length} operaciones
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-64 pr-3">
                        <div className="space-y-3 text-xs">
                          {(operacionesAgrupadas.get(status as UmbralStatus) ?? []).map((operacion) => (
                            <div key={operacion.id} className="rounded border border-slate-200/80 bg-white p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold text-slate-700">{operacion.cliente}</p>
                                <Badge variant="outline">{operacion.periodo}</Badge>
                              </div>
                              <p className="mt-1 text-slate-600">RFC: {operacion.rfc}</p>
                              <p className="text-slate-600">
                                Tipo de cliente: {formatTipoClienteLabel(
                                  operacion.tipoCliente,
                                  operacion.detalleTipoCliente,
                                )}
                              </p>
                              <p className="text-slate-600">Actividad: {operacion.actividadNombre}</p>
                              <p className="text-slate-600">Monto acumulado: {formatCurrency(operacion.acumuladoCliente)}</p>
                              <p className="text-slate-600">Operación: {operacion.tipoOperacion}</p>
                              {operacion.alerta && (
                                <div className="mt-2 flex items-center gap-2 rounded bg-amber-50 p-2 text-amber-800">
                                  <AlertCircle className="h-4 w-4" />
                                  <span>{operacion.alerta}</span>
                                </div>
                              )}
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Button size="sm" onClick={() => reutilizarDatosCliente(operacion)}>
                                  Reutilizar datos
                                </Button>
                                {status === "aviso" && !operacion.avisoPresentado && (
                                  <Button size="sm" variant="outline" onClick={() => marcarAvisoPresentado(operacion.id)}>
                                    Marcar aviso presentado
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => generarAvisoPreliminar(operacion)}>
                                  Generar aviso preliminar
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => exportarXml(operacion)}>
                                  <Download className="mr-1 h-4 w-4" /> XML
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => abrirDocumentosOperacion(operacion)}>
                                  <Paperclip className="mr-1 h-4 w-4" /> Evidencias
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => abrirEdicionOperacion(operacion)}>
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => solicitarEliminacionOperacion(operacion)}
                                >
                                  Eliminar
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600" /> Centro de alertas operativas
              </CardTitle>
              <CardDescription>Gestiona los recordatorios generados por cruces con los umbrales.</CardDescription>
            </CardHeader>
            <CardContent>
              {alertasActivas.length === 0 && alertasResueltas.length === 0 ? (
                <div className="rounded border bg-slate-50 p-4 text-sm text-slate-600">
                  No se han generado alertas todavía. Registra operaciones para activar el monitoreo.
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3 rounded-lg border bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-700">Alertas activas</h4>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700">
                        {alertasActivas.length}
                      </Badge>
                    </div>
                    {alertasActivas.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No hay alertas pendientes.</p>
                    ) : (
                      <div className="space-y-3 text-xs text-slate-600">
                        {alertasActivas.map((operacion) => (
                          <div
                            key={operacion.id}
                            className="space-y-2 rounded border border-amber-200 bg-amber-50/70 p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-slate-800">{operacion.cliente}</p>
                              <Badge variant="outline">{getStatusLabel(operacion.umbralStatus)}</Badge>
                            </div>
                            <p className="text-slate-600">RFC: {operacion.rfc}</p>
                            <p className="text-slate-600">Monto: {formatMontoOperacion(operacion)}</p>
                            {operacion.alerta && (
                              <div className="flex items-start gap-2 rounded bg-white/60 p-2 text-amber-800">
                                <AlertCircle className="mt-0.5 h-4 w-4" />
                                <span>{operacion.alerta}</span>
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              <Button size="sm" onClick={() => reutilizarDatosCliente(operacion)}>
                                Capturar nueva operación
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => actualizarEstadoAlerta(operacion.id, true)}
                              >
                                Marcar como atendida
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => abrirDocumentosOperacion(operacion)}
                              >
                                <Paperclip className="mr-1 h-4 w-4" /> Evidencias
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 rounded-lg border bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-slate-700">Alertas gestionadas</h4>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                        {alertasResueltas.length}
                      </Badge>
                    </div>
                    {alertasResueltas.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Aún no se han atendido alertas.</p>
                    ) : (
                      <div className="space-y-3 text-xs text-slate-600">
                        {alertasResueltas.map((operacion) => (
                          <div
                            key={operacion.id}
                            className="space-y-2 rounded border border-emerald-200 bg-emerald-50/70 p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-slate-800">{operacion.cliente}</p>
                              <Badge variant="outline">{getStatusLabel(operacion.umbralStatus)}</Badge>
                            </div>
                            <p className="text-slate-600">RFC: {operacion.rfc}</p>
                            <p className="text-slate-600">Monto: {formatMontoOperacion(operacion)}</p>
                            {operacion.alerta && (
                              <div className="flex items-start gap-2 rounded bg-white/60 p-2 text-emerald-800">
                                <CheckCircle2 className="mt-0.5 h-4 w-4" />
                                <span>{operacion.alerta}</span>
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => actualizarEstadoAlerta(operacion.id, false)}
                              >
                                Reabrir alerta
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => abrirDocumentosOperacion(operacion)}
                              >
                                <Paperclip className="mr-1 h-4 w-4" /> Evidencias
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-slate-600" /> Calendario de operaciones por cliente
              </CardTitle>
              <CardDescription>Ubica visualmente las fechas con operaciones registradas y navega por mes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
                  <div className="w-full md:w-72">
                    <Label className="text-xs font-semibold uppercase text-slate-500">Cliente registrado</Label>
                    <Select
                      value={clienteCalendario ?? ""}
                      onValueChange={(value) => setClienteCalendario(value)}
                      disabled={clientesRegistrados.length === 0}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecciona un cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clientesRegistrados.map((cliente) => (
                          <SelectItem key={cliente.rfc} value={cliente.rfc}>
                            {cliente.nombre} ({cliente.rfc})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <Badge variant="outline" className="bg-white text-slate-700">
                      {monthLabel(mesCalendario)} {anioCalendario}
                    </Badge>
                    <span>{operacionesCalendario.length} {operacionesCalendario.length === 1 ? "operación" : "operaciones"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => cambiarMesCalendario(-1)}
                    aria-label="Mes anterior"
                    disabled={clientesRegistrados.length === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-[140px] text-center text-sm font-semibold text-slate-700">
                    {monthLabel(mesCalendario)} {anioCalendario}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => cambiarMesCalendario(1)}
                    aria-label="Mes siguiente"
                    disabled={clientesRegistrados.length === 0}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {clientesRegistrados.length === 0 ? (
                <div className="rounded border bg-slate-50 p-4 text-sm text-slate-600">
                  Registra una operación para activar el calendario mensual por cliente.
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
                  <div className="space-y-2">
                    <div className="grid grid-cols-7 text-center text-xs font-semibold uppercase text-slate-500">
                      {WEEK_DAYS.map((dia) => (
                        <span key={dia}>{dia}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {calendarioDias.map((dia) => (
                        <button
                          key={dia.clave}
                          type="button"
                          onClick={() => setDiaSeleccionado(dia.clave)}
                          className={`flex min-h-[82px] flex-col items-start justify-between rounded-lg border px-2 py-2 text-left text-xs transition ${
                            dia.esMesActual ? "bg-white text-slate-700" : "bg-slate-50 text-slate-400"
                          } ${
                            diaSeleccionado === dia.clave
                              ? "border-emerald-500 ring-2 ring-emerald-200"
                              : "border-slate-200 hover:border-emerald-300"
                          }`}
                        >
                          <span className="text-sm font-semibold">{dia.dia}</span>
                          {dia.operaciones.length > 0 && (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${getCalendarSeverityClass(dia.operaciones)}`}>
                              {dia.operaciones.length} {dia.operaciones.length === 1 ? "operación" : "operaciones"}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3 rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
                    <h4 className="font-semibold text-slate-700">
                      {diaSeleccionado
                        ? `Detalle ${toDate(diaSeleccionado).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}`
                        : "Selecciona un día"}
                    </h4>
                    {operacionesDiaSeleccionado.length === 0 ? (
                      <p className="text-xs text-slate-500">No hay operaciones registradas en la fecha seleccionada.</p>
                    ) : (
                      <div className="space-y-2 text-xs text-slate-600">
                        {operacionesDiaSeleccionado.map((operacion) => (
                          <div key={operacion.id} className="rounded border border-slate-200 bg-white p-2">
                            <p className="font-semibold text-slate-700">{operacion.cliente}</p>
                            <p>Actividad: {operacion.actividadNombre}</p>
                            <p>
                              Tipo: {formatTipoClienteLabel(operacion.tipoCliente, operacion.detalleTipoCliente)}
                            </p>
                            <p>Monto: {formatMontoOperacion(operacion)}</p>
                            <p>Estado: {getStatusLabel(operacion.umbralStatus)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-slate-600" /> Seguimiento y acumulación
              </CardTitle>
              <CardDescription>Controla operaciones acumulables por cliente hasta 6 meses posteriores al umbral de identificación.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Una vez superado el umbral de identificación, se deben monitorear las operaciones del mismo cliente durante los 6 meses siguientes. Solo se acumulan aquellas operaciones que individualmente superan el umbral de identificación. Cuando se marca el aviso como presentado, se reinicia el seguimiento acumulado.
              </p>
              <div className="grid gap-3">
                <div className="rounded border bg-slate-50 p-3">
                  <h4 className="font-semibold text-slate-700">Alertas por acumulación</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    <li>Semáforo verde: sin obligación activa.</li>
                    <li>Semáforo ámbar: identificar y preparar controles documentales.</li>
                    <li>Semáforo rojo: preparar aviso SAT o informe 27 Bis según corresponda.</li>
                  </ul>
                </div>
                <div className="rounded border bg-white p-3">
                  <h4 className="font-semibold text-slate-700">Controles sugeridos</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    <li>Validación de listas restrictivas y PEPs.</li>
                    <li>Confirmación bancaria de origen de recursos.</li>
                    <li>Checklist de documentación completo y vigente.</li>
                    <li>Bitácora de comunicación con el cliente.</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="explorar" className="space-y-6">
          <section className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-slate-600" /> Fracciones y actividades registradas
                </CardTitle>
                <CardDescription>
                  Consulta cada subsección de la ley y sus actividades vulnerables correspondientes para orientar nuevos registros.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-72 pr-4">
                  <div className="space-y-4 text-sm">
                    {Array.from(actividadesPorFraccion.entries())
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([fraccion, actividades]) => (
                        <div key={fraccion} className="rounded border bg-white p-3">
                          <h4 className="font-semibold text-slate-700">{fraccion}</h4>
                          <ul className="mt-2 space-y-1 text-slate-600">
                            {actividades.map((actividad) => (
                              <li key={actividad.key} className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-medium text-slate-700">{actividad.nombre}</p>
                                  <p className="text-xs text-muted-foreground">{actividad.descripcion}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setActividadKey(actividad.key)
                                    setActividadInfoKey(actividad.key)
                                    setTabActiva("captura")
                                  }}
                                >
                                  <ArrowRight className="h-4 w-4" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-slate-600" /> Validación de datos y documentos
                </CardTitle>
                <CardDescription>
                  Confirma el cumplimiento documental previo a la integración del expediente o a la generación del aviso.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p>
                  Verifica que los datos recabados coincidan con la documentación soporte (RFC, identificación oficial, comprobante de domicilio y evidencia de operaciones).
                </p>
                <p>
                  Los avisos o informes deben conservar evidencia digital y física, incluyendo contratos, estados de cuenta, medios de pago, CFDI y documentación del beneficiario final.
                </p>
              </CardContent>
            </Card>
          </section>
        </TabsContent>
      </Tabs>

      <Dialog
        open={infoModal !== null}
        onOpenChange={(open) => {
          if (!open) {
            setInfoModal(null)
          }
        }}
      >
        <DialogContent>
          {infoModal && (
            <>
              <DialogHeader>
                <DialogTitle>{INFO_MODAL_CONTENT[infoModal].title}</DialogTitle>
                <DialogDescription>
                  <div className="space-y-3 text-left text-slate-600">
                    {INFO_MODAL_CONTENT[infoModal].body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setInfoModal(null)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(operacionDocumentos)}
        onOpenChange={(open) => {
          if (!open) {
            cerrarDocumentosOperacion()
          }
        }}
      >
        <DialogContent className="flex h-[90vh] max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-[960px]">
          {operacionDocumentos && (
            <div className="flex h-full min-h-0 flex-col">
              <DialogHeader className="border-b bg-slate-50 p-6">
                <DialogTitle>Requisitos y evidencias vinculadas</DialogTitle>
                <DialogDescription>
                  Administra la documentación soporte para {operacionDocumentos.cliente} ({operacionDocumentos.rfc}).
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid min-h-0 gap-6 lg:grid-cols-[300px,minmax(0,1fr)] xl:grid-cols-[320px,minmax(0,1fr)]">
                  <aside className="space-y-4">
                    <div className="rounded-lg border bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`${getStatusColor(operacionDocumentos.umbralStatus)} border-transparent text-white`}
                        >
                          {getStatusLabel(operacionDocumentos.umbralStatus)}
                        </Badge>
                        <Badge variant="outline" className="text-slate-700">
                          Periodo {operacionDocumentos.periodo}
                        </Badge>
                        {tipoClienteOperacionLabel && (
                          <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-700">
                            {tipoClienteOperacionLabel}
                          </Badge>
                        )}
                        {operacionDocumentos.mismoGrupo && (
                          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                            Mismo grupo empresarial
                          </Badge>
                        )}
                      </div>
                      <div className="mt-4 grid gap-3 text-xs text-slate-600">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">Cliente</p>
                          <p className="text-sm font-medium text-slate-700">{operacionDocumentos.cliente}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">RFC</p>
                            <p className="font-medium uppercase text-slate-700">{operacionDocumentos.rfc}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Fecha de operación</p>
                            <p className="font-medium text-slate-700">{operacionDocumentos.fechaOperacion}</p>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Monto de operación</p>
                            <p className="font-semibold text-slate-800">{formatMontoOperacion(operacionDocumentos)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Acumulado del cliente</p>
                            <p className="font-semibold text-slate-800">
                              {formatCurrency(operacionDocumentos.acumuladoCliente, operacionDocumentos.moneda)}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">Tipo de operación</p>
                          <p className="font-medium text-slate-700">
                            {operacionDocumentos.tipoOperacion || "Sin clasificación específica"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0 rounded-lg border bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-slate-700">Progreso documental</h4>
                        <Badge variant="outline" className="text-xs text-slate-600">
                          {checklistProgresoOperacion}% completo
                        </Badge>
                      </div>
                      <Progress value={checklistProgresoOperacion} className="mt-3 h-2" />
                      <div className="mt-3 space-y-1 text-xs text-slate-600">
                        {checklistTotalesOperacion > 0 ? (
                          <>
                            <p>
                              {checklistCompletadosOperacion} de {checklistTotalesOperacion} requisitos validados.
                            </p>
                            {checklistPendientesOperacion > 0 && (
                              <p className="text-amber-600">
                                {checklistPendientesOperacion} requisito(s) pendientes de seguimiento.
                              </p>
                            )}
                          </>
                        ) : (
                          <p>Esta fracción no tiene checklist documental adicional para este cliente.</p>
                        )}
                        <p>
                          Evidencias cargadas: {" "}
                          <span className="font-semibold text-slate-700">{evidenciasRegistradasOperacion}</span>
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-2 rounded border border-emerald-200 bg-emerald-50 p-3">
                        <Checkbox
                          checked={operacionDocumentos.kycIntegrado}
                          onCheckedChange={(checked) =>
                            marcarKycIntegrado(operacionDocumentos.id, Boolean(checked))
                          }
                          className="mt-0.5"
                        />
                        <div className="space-y-1 text-xs text-slate-600">
                          <p className="font-semibold text-slate-700">Expediente KYC actualizado</p>
                          <p>Marca esta casilla cuando el expediente esté integrado con la evidencia más reciente.</p>
                          <Button variant="link" size="sm" className="px-0" asChild>
                            <Link href={`/kyc-expediente?buscar=${operacionDocumentos.rfc}`}>
                              <ExternalLink className="mr-1 h-3 w-3" /> Abrir expediente KYC
                            </Link>
                          </Button>
                        </div>
                      </div>

                      {controlesOperacion.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-700">Controles del artículo 17</p>
                          <ScrollArea className="mt-2 max-h-40 pr-2">
                            <ul className="list-disc space-y-2 pl-4 text-xs text-slate-600">
                              {controlesOperacion.map((control) => (
                                <li key={control}>{control}</li>
                              ))}
                            </ul>
                          </ScrollArea>
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            Actualiza la información cuando se atienda el aviso o se complete la debida diligencia reforzada.
                          </p>
                        </div>
                      )}
                    </div>
                  </aside>

                  <div className="min-w-0 space-y-6 text-sm text-slate-700">
                    <div className="rounded-lg border bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-slate-700">Checklist documental</h4>
                        {checklistTotalesOperacion > 0 && (
                          <Badge variant="outline" className="text-xs text-slate-600">
                            {checklistCompletadosOperacion}/{checklistTotalesOperacion}
                          </Badge>
                        )}
                      </div>
                      {checklistTotalesOperacion === 0 ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Esta fracción no tiene requisitos específicos adicionales para el tipo de cliente seleccionado.
                        </p>
                      ) : (
                        <ScrollArea className="mt-3 max-h-60 pr-2">
                          <div className="space-y-2">
                            {checklistEntriesOperacion.map(([requisito, completado]) => (
                              <label
                                key={requisito}
                                className="flex items-start gap-2 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"
                              >
                                <Checkbox
                                  checked={completado}
                                  onCheckedChange={() => alternarRequisitoChecklist(operacionDocumentos.id, requisito)}
                                  className="mt-0.5"
                                />
                                <span>{requisito}</span>
                              </label>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </div>

                    <div className="rounded-lg border bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-slate-700">Registrar nueva evidencia</h4>
                        {checklistTotalesOperacion > 0 && (
                          <p className="text-xs text-muted-foreground">Selecciona un requisito para prellenar el campo.</p>
                        )}
                      </div>
                      {checklistTotalesOperacion > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {checklistEntriesOperacion.map(([requisito]) => (
                            <Button
                              key={requisito}
                              type="button"
                              size="xs"
                              variant="outline"
                              onClick={() => setNuevoDocumento((prev) => ({ ...prev, requisito }))}
                            >
                              {requisito}
                            </Button>
                          ))}
                        </div>
                      )}
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-500">Requisito vinculado</Label>
                          <Input
                            placeholder="Describe el requisito"
                            value={nuevoDocumento.requisito}
                            onChange={(event) =>
                              setNuevoDocumento((prev) => ({ ...prev, requisito: event.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-500">Fecha de registro</Label>
                          <Input
                            type="date"
                            value={nuevoDocumento.fechaRegistro}
                            max={new Date().toISOString().substring(0, 10)}
                            onChange={(event) =>
                              setNuevoDocumento((prev) => ({ ...prev, fechaRegistro: event.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="mt-4 space-y-1">
                        <Label className="text-xs text-slate-500">Notas</Label>
                        <Textarea
                          placeholder="Detalle de la evidencia o comentarios de revisión"
                          value={nuevoDocumento.notas}
                          onChange={(event) =>
                            setNuevoDocumento((prev) => ({ ...prev, notas: event.target.value }))
                          }
                        />
                      </div>
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1 text-xs text-slate-600">
                          <Label className="text-slate-500">Archivo digital (opcional)</Label>
                          <Input type="file" accept="application/pdf,image/*" onChange={manejarArchivoDocumento} />
                          {nuevoDocumento.archivoNombre && (
                            <p className="text-[11px] text-muted-foreground">
                              Archivo seleccionado: {nuevoDocumento.archivoNombre}
                            </p>
                          )}
                        </div>
                        <Button onClick={agregarDocumentoSoporte}>
                          <Upload className="mr-2 h-4 w-4" /> Guardar evidencia
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-slate-700">Evidencias registradas</h4>
                        <Badge variant="outline" className="text-xs text-slate-600">
                          {evidenciasRegistradasOperacion} {" "}
                          {evidenciasRegistradasOperacion === 1 ? "documento" : "documentos"}
                        </Badge>
                      </div>
                      {evidenciasRegistradasOperacion === 0 ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Aún no se han cargado evidencias para esta operación.
                        </p>
                      ) : (
                        <ScrollArea className="mt-3 max-h-[260px] pr-2">
                          <div className="space-y-3 text-xs text-slate-600">
                            {operacionDocumentos.documentosSoporte.map((documento) => (
                              <div
                                key={documento.id}
                                className="rounded border border-slate-200 bg-slate-50 p-3 shadow-sm"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="space-y-1">
                                    <p className="font-semibold text-slate-700">{documento.requisito}</p>
                                    <p className="text-muted-foreground">Registrado el {documento.fechaRegistro}</p>
                                    {documento.notas && (
                                      <p className="text-slate-600">{documento.notas}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {documento.archivoContenido && documento.archivoNombre && (
                                      <Button variant="outline" size="sm" asChild>
                                        <a href={documento.archivoContenido} download={documento.archivoNombre}>
                                          <Download className="mr-2 h-4 w-4" /> Descargar
                                        </a>
                                      </Button>
                                    )}
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => eliminarDocumentoSoporte(operacionDocumentos.id, documento.id)}
                                      aria-label="Eliminar evidencia"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter className="border-t bg-slate-50 p-4">
                <Button variant="outline" onClick={cerrarDocumentosOperacion}>
                  Cerrar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={infoTipoClienteOpen} onOpenChange={setInfoTipoClienteOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Tipos de cliente disponibles</DialogTitle>
            <DialogDescription>
              Elige la categoría que represente la naturaleza jurídica o migratoria del cliente para
              ajustar los requisitos y controles aplicables.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-700">
            {CLIENTE_TIPOS.map((tipo) => (
              <div key={tipo.value} className="rounded border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-800">{tipo.label}</p>
                <p className="mt-1 text-xs text-slate-600">{tipo.descripcion}</p>
                {tipo.requiresDetalle && (
                  <p className="mt-2 text-xs font-medium text-emerald-700">
                    Requiere detalle adicional: {tipo.detalleLabel ?? "Especifica el tipo de entidad"}.
                  </p>
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="border-t bg-slate-50 p-4">
            <Button variant="outline" onClick={() => setInfoTipoClienteOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={infoGrupoOpen} onOpenChange={setInfoGrupoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Qué significa mismo grupo empresarial?</AlertDialogTitle>
            <AlertDialogDescription>
              Se considera que pertenece al mismo grupo empresarial cuando existe control común, coincidencia accionaria relevante o participación mayoritaria que implique dirección o administración conjunta. En esos casos, si se supera el umbral de aviso, procede el informe 27 Bis en ceros en lugar de un aviso por operación individual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Cerrar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(operacionEnEdicion)}
        onOpenChange={(open) => {
          if (!open) {
            cancelarEdicionOperacion()
          }
        }}
      >
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Editar operación</DialogTitle>
            <DialogDescription>
              Ajusta los datos capturados para mantener actualizado el seguimiento del cliente.
            </DialogDescription>
          </DialogHeader>
          {operacionEnEdicion && (
            <div className="space-y-4 text-sm text-slate-700">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Input
                    value={datosEdicion.cliente}
                    onChange={(event) =>
                      setDatosEdicion((prev) => ({ ...prev, cliente: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>RFC</Label>
                  <Input
                    value={datosEdicion.rfc}
                    onChange={(event) =>
                      setDatosEdicion((prev) => ({ ...prev, rfc: event.target.value.toUpperCase() }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de cliente</Label>
                  <Select
                    value={datosEdicion.tipoCliente}
                    onValueChange={(value) =>
                      setDatosEdicion((prev) => ({
                        ...prev,
                        tipoCliente: value,
                        detalleTipoCliente: obtenerOpcionTipoCliente(value)?.requiresDetalle
                          ? prev.detalleTipoCliente
                          : "",
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Selecciona tipo de cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIENTE_TIPOS.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {tipoClienteEdicionSeleccionado?.requiresDetalle && (
                    <div className="space-y-2 text-sm">
                      <Label>
                        {tipoClienteEdicionSeleccionado.detalleLabel ?? "Detalle del tipo de cliente"}
                      </Label>
                      {tipoClienteEdicionSeleccionado.detalleOpciones ? (
                        <Select
                          value={datosEdicion.detalleTipoCliente || undefined}
                          onValueChange={(value) =>
                            setDatosEdicion((prev) => ({
                              ...prev,
                              detalleTipoCliente: value,
                            }))
                          }
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue
                              placeholder={
                                tipoClienteEdicionSeleccionado.detallePlaceholder ??
                                "Selecciona la opción que corresponda"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {tipoClienteEdicionSeleccionado.detalleOpciones.map((detalle) => (
                              <SelectItem key={detalle.value} value={detalle.value}>
                                {detalle.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={datosEdicion.detalleTipoCliente}
                          onChange={(event) =>
                            setDatosEdicion((prev) => ({
                              ...prev,
                              detalleTipoCliente: event.target.value,
                            }))
                          }
                          placeholder={
                            tipoClienteEdicionSeleccionado.detallePlaceholder ??
                            "Ej. Afianzadora estatal"
                          }
                        />
                      )}
                      <p className="text-xs text-muted-foreground">
                        Detalla el giro o naturaleza exacta del cliente para conservar el contexto de la
                        operación.
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>¿Pertenece al mismo grupo?</Label>
                  <div className="flex items-center gap-2">
                    {[{ value: "si", label: "Sí" }, { value: "no", label: "No" }].map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={datosEdicion.mismoGrupo === option.value ? "default" : "outline"}
                        onClick={() => setDatosEdicion((prev) => ({ ...prev, mismoGrupo: option.value }))}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de operación</Label>
                  <Input
                    value={datosEdicion.tipoOperacion}
                    onChange={(event) =>
                      setDatosEdicion((prev) => ({ ...prev, tipoOperacion: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monto</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={datosEdicion.monto}
                    onChange={(event) =>
                      setDatosEdicion((prev) => ({ ...prev, monto: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Select
                    value={datosEdicion.moneda}
                    onValueChange={(value) =>
                      setDatosEdicion((prev) => ({
                        ...prev,
                        moneda: value,
                        monedaPersonalizadaCodigo: value === "OTRA" ? prev.monedaPersonalizadaCodigo : "",
                        monedaPersonalizadaDescripcion:
                          value === "OTRA" ? prev.monedaPersonalizadaDescripcion : "",
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Selecciona moneda" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONEDAS_EXTENDIDAS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {datosEdicion.moneda === "OTRA" && (
                    <div className="space-y-2 rounded border border-dashed border-emerald-200 bg-emerald-50/60 p-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-emerald-700">Código ISO de la divisa</Label>
                        <Input
                          value={datosEdicion.monedaPersonalizadaCodigo}
                          maxLength={3}
                          onChange={(event) =>
                            setDatosEdicion((prev) => ({
                              ...prev,
                              monedaPersonalizadaCodigo: event.target.value.toUpperCase(),
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-emerald-700">Descripción</Label>
                        <Input
                          value={datosEdicion.monedaPersonalizadaDescripcion}
                          onChange={(event) =>
                            setDatosEdicion((prev) => ({
                              ...prev,
                              monedaPersonalizadaDescripcion: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Fecha de la operación</Label>
                  <Input
                    type="date"
                    value={datosEdicion.fechaOperacion}
                    max={new Date().toISOString().substring(0, 10)}
                    onChange={(event) =>
                      setDatosEdicion((prev) => ({ ...prev, fechaOperacion: event.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Evidencia o comentarios</Label>
                <Textarea
                  value={datosEdicion.evidencia}
                  onChange={(event) =>
                    setDatosEdicion((prev) => ({ ...prev, evidencia: event.target.value }))
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={cancelarEdicionOperacion}>
              Cancelar
            </Button>
            <Button onClick={guardarOperacionEditada}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(operacionPorEliminar)}
        onOpenChange={(open) => {
          if (!open) {
            setOperacionPorEliminar(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar operación</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción quitará la operación del tablero y actualizará los acumulados del cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {operacionPorEliminar && (
            <div className="space-y-1 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Cliente:</span> {operacionPorEliminar.cliente} ({operacionPorEliminar.rfc})
              </p>
              <p>
                <span className="font-semibold">Periodo:</span> {operacionPorEliminar.periodo}
              </p>
              <p>
                <span className="font-semibold">Monto:</span> {formatCurrency(operacionPorEliminar.monto)} {" "}
                {operacionPorEliminar.moneda}
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarEliminacionOperacion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(avisoPreliminar)} onOpenChange={() => setAvisoPreliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aviso preliminar</AlertDialogTitle>
            <AlertDialogDescription>
              Información generada para revisión interna antes de cargar en el portal del SAT.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {avisoPreliminar && (
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Cliente:</span> {avisoPreliminar.cliente} ({avisoPreliminar.rfc})
              </p>
              <p>
                <span className="font-semibold">Periodo:</span> {avisoPreliminar.periodo}
              </p>
              <p>
                <span className="font-semibold">Actividad:</span> {avisoPreliminar.actividadNombre}
              </p>
              <p>
                <span className="font-semibold">Monto:</span> {formatMontoOperacion(avisoPreliminar)}
              </p>
              <p>
                <span className="font-semibold">Operación:</span> {avisoPreliminar.tipoOperacion}
              </p>
              <p>
                <span className="font-semibold">Evidencia:</span> {avisoPreliminar.evidencia || "Sin comentarios"}
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
            {avisoPreliminar && (
              <AlertDialogAction onClick={() => exportarXml(avisoPreliminar)}>Descargar XML</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
