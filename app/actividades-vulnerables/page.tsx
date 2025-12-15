"use client"

import Link from "next/link"
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { CIUDADES_MEXICO, findCodigoPostalInfo } from "@/lib/data/codigos-postales"
import { demoFraccionXV } from "@/lib/demo/fraccion-xv"
import { PAISES, findPaisByCodigo, findPaisByNombre } from "@/lib/data/paises"

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

function normalizarBusqueda(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
}

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

const MONEDAS = [
  { value: "MXN", label: "Peso mexicano (MXN)" },
  { value: "USD", label: "Dólar estadounidense (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "CAD", label: "Dólar canadiense (CAD)" },
  { value: "GBP", label: "Libra esterlina (GBP)" },
  { value: "JPY", label: "Yen japonés (JPY)" },
  { value: "CHF", label: "Franco suizo (CHF)" },
  { value: "BRL", label: "Real brasileño (BRL)" },
  { value: "OTRA", label: "Otra divisa (especificar)" },
]

const ACTIVIDAD_INMUEBLES_KEY = "fraccion-xv-uso-goce"

const ALERTA_TIPOS = [
  { value: "0", label: "Sin alerta" },
  { value: "521", label: "Operación inusual (521)" },
  { value: "522", label: "Operación interna preocupante (522)" },
]

const PRIORIDAD_AVISO_OPCIONES = [
  { value: "1", label: "Prioridad normal" },
  { value: "2", label: "Prioridad alta" },
]

const INMUEBLE_OPERACIONES = [
  { value: "501", label: "501 – Contrato de arrendamiento" },
  { value: "502", label: "502 – Cesión de derechos de uso o goce" },
  { value: "503", label: "503 – Renovación o prórroga de contrato" },
]

const FIGURA_CLIENTE_OPTIONS = [
  { value: "1", label: "Arrendatario" },
  { value: "2", label: "Comodatorio" },
  { value: "3", label: "Cesionario" },
]

const FIGURA_SUJETO_OBLIGADO_OPTIONS = [
  { value: "1", label: "Arrendador" },
  { value: "2", label: "Administrador" },
  { value: "3", label: "Fideicomitente" },
]

const TIPO_INMUEBLE_OPTIONS = [
  { value: "casa", label: "Casa habitación" },
  { value: "departamento", label: "Departamento" },
  { value: "oficina", label: "Oficina" },
  { value: "local", label: "Local comercial" },
  { value: "terreno", label: "Terreno" },
  { value: "industrial", label: "Nave industrial" },
]

const TIPO_INMUEBLE_CODIGOS: Record<string, string> = {
  casa: "1",
  departamento: "2",
  oficina: "3",
  local: "4",
  terreno: "5",
  industrial: "6",
}

const FORMA_PAGO_OPTIONS = [
  { value: "1", label: "Transferencia bancaria" },
  { value: "2", label: "Cheque" },
  { value: "3", label: "Efectivo" },
  { value: "4", label: "Otro instrumento" },
]

const INSTRUMENTO_MONETARIO_OPTIONS = [
  { value: "1", label: "Cuenta propia" },
  { value: "2", label: "Cuenta de tercero" },
  { value: "3", label: "Medio no bancarizado" },
]

const ALERTA_DEFAULT = ALERTA_TIPOS[0]?.value ?? "0"
const PRIORIDAD_DEFAULT = PRIORIDAD_AVISO_OPCIONES[0]?.value ?? "1"

const INMUEBLE_FORM_DEFAULT: DatosInmuebleFormState = {
  fechaInicio: "",
  fechaFin: "",
  tipoInmueble: "",
  valorAvaluo: "",
  folioReal: "",
  pais: "MX",
  entidad: "",
  municipio: "",
  ciudad: "",
  colonia: "",
  codigoPostal: "",
  calle: "",
  numeroExterior: "",
  numeroInterior: "",
}

const LIQUIDACION_FORM_DEFAULT: DatosLiquidacionFormState = {
  fechaPago: "",
  formaPago: "",
  instrumento: "",
}

const BENEFICIARIO_FORM_DEFAULT: BeneficiarioFormState = {
  tipo: "persona_fisica",
  nombre: "",
  apellidoPaterno: "",
  apellidoMaterno: "",
  fechaNacimiento: "",
  rfc: "",
  curp: "",
  pais: "MX",
}

const CONTRAPARTE_FORM_DEFAULT: ContraparteFormState = {
  tipo: "persona_fisica",
  nombre: "",
  apellidoPaterno: "",
  apellidoMaterno: "",
  fechaNacimiento: "",
  rfc: "",
  pais: "MX",
}

const INSTRUMENTO_FORM_DEFAULT: InstrumentoPublicoFormState = {
  numero: "",
  fecha: "",
  notario: "",
  entidad: "",
  valorAvaluo: "",
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

interface RepresentanteAviso {
  nombre?: string
  apellidoPaterno?: string
  apellidoMaterno?: string
  fechaNacimiento?: string
  rfc?: string
  curp?: string
  pais?: string
}

interface DomicilioAviso {
  ambito?: "nacional" | "extranjero"
  pais?: string
  entidad?: string
  municipio?: string
  ciudad?: string
  colonia?: string
  codigoPostal?: string
  calle?: string
  numeroExterior?: string
  numeroInterior?: string
}

interface PersonaAvisoOperacion {
  tipo: "persona_fisica" | "persona_moral"
  denominacion?: string
  fechaConstitucion?: string
  pais?: string
  giro?: string
  nombre?: string
  apellidoPaterno?: string
  apellidoMaterno?: string
  fechaNacimiento?: string
  rfc?: string
  curp?: string
  representante?: RepresentanteAviso | null
  domicilio?: DomicilioAviso | null
  contacto?: {
    clavePais?: string
    telefono?: string
    correo?: string
  } | null
}

interface DatosInmuebleOperacion {
  codigoOperacion: string
  fechaInicio: string
  fechaFin: string
  tipoInmueble: string
  valorAvaluo: string
  folioReal: string
  pais: string
  entidad: string
  municipio: string
  ciudad?: string
  colonia: string
  codigoPostal: string
  calle: string
  numeroExterior: string
  numeroInterior?: string
}

interface DatosLiquidacionOperacion {
  fechaPago: string
  formaPago: string
  instrumento: string
  moneda: string
  monedaDescripcion: string
  monto: number
}

interface BeneficiarioControladorOperacion {
  tipo: "persona_fisica" | "persona_moral"
  nombre?: string
  apellidoPaterno?: string
  apellidoMaterno?: string
  fechaNacimiento?: string
  rfc?: string
  curp?: string
  pais?: string
}

interface ContraparteOperacion {
  tipo: "persona_fisica" | "persona_moral"
  nombre?: string
  apellidoPaterno?: string
  apellidoMaterno?: string
  fechaNacimiento?: string
  rfc?: string
  pais?: string
}

interface InstrumentoPublicoOperacion {
  numero: string
  fecha: string
  notario: string
  entidad: string
  valorAvaluo: string
}

interface DatosInmuebleFormState {
  fechaInicio: string
  fechaFin: string
  tipoInmueble: string
  valorAvaluo: string
  folioReal: string
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

interface DatosLiquidacionFormState {
  fechaPago: string
  formaPago: string
  instrumento: string
}

interface BeneficiarioFormState {
  tipo: "persona_fisica" | "persona_moral"
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  fechaNacimiento: string
  rfc: string
  curp: string
  pais: string
}

interface ContraparteFormState {
  tipo: "persona_fisica" | "persona_moral"
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  fechaNacimiento: string
  rfc: string
  pais: string
}

interface InstrumentoPublicoFormState {
  numero: string
  fecha: string
  notario: string
  entidad: string
  valorAvaluo: string
}

interface ExpedientePersona {
  id?: string
  tipo?: "persona_moral" | "persona_fisica"
  denominacion?: string
  fechaConstitucion?: string
  rfc?: string
  curp?: string
  pais?: string
  giro?: string
  rolRelacion?: string
  representante?: RepresentanteAviso | null
  domicilio?: DomicilioAviso | null
  contacto?: {
    conoceTelefono?: string
    conocePaisTelefono?: string
    clavePais?: string
    telefono?: string
    correo?: string
  } | null
}

interface ExpedienteDetalle {
  rfc: string
  nombre?: string
  tipoCliente?: string
  detalleTipoCliente?: string
  responsable?: string
  claveSujetoObligado?: string
  claveActividadVulnerable?: string
  identificacion?: Record<string, string>
  datosFiscales?: Record<string, string>
  perfilOperaciones?: Record<string, string>
  documentacion?: Record<string, string>
  personas?: ExpedientePersona[]
  actualizadoEn?: string
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
  referenciaAviso?: string
  alertaCodigo?: string
  alertaDescripcion?: string
  prioridadAviso?: string
  claveSujetoObligado?: string
  claveActividadVulnerable?: string
  expedienteReferenciado?: string
  personaExpedienteId?: string
  personaAviso?: PersonaAvisoOperacion | null
  inmueble?: DatosInmuebleOperacion | null
  liquidacion?: DatosLiquidacionOperacion | null
  beneficiario?: BeneficiarioControladorOperacion | null
  contraparte?: ContraparteOperacion | null
  instrumento?: InstrumentoPublicoOperacion | null
  figuraCliente?: string
  figuraSujetoObligado?: string
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

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1
const START_WINDOW = new Date(2020, 8, 1) // septiembre 2020

const CLIENTES_STORAGE_KEY = "actividades_vulnerables_clientes"
const EXPEDIENTE_DETALLE_STORAGE_KEY = "kyc_expedientes_detalle"
const NUEVO_CLIENTE_VALUE = "__nuevo__"
const MANUAL_EXPEDIENTE_VALUE = "__manual__"

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
  const found = MONEDAS.find((moneda) => moneda.value === value)
  return found ? found.label : value
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function formatFechaXml(value: string | undefined) {
  if (!value) return ""
  return value.replace(/-/g, "")
}

function formatNumberXml(value: number | string | undefined) {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value.toFixed(2)
  }
  const parsed = Number(value)
  if (Number.isNaN(parsed)) {
    return "0.00"
  }
  return parsed.toFixed(2)
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

  const monto = Number(raw.monto) || 0

  const personaAviso = sanitizePersonaAviso(raw.personaAviso)
  const inmueble = sanitizeInmueble(raw.inmueble)
  const liquidacion = sanitizeLiquidacion(raw.liquidacion, moneda, monedaDescripcion, monto)
  const beneficiario = sanitizeBeneficiario(raw.beneficiario)
  const contraparte = sanitizeContraparte(raw.contraparte)
  const instrumento = sanitizeInstrumento(raw.instrumento)

  const documentosRaw = Array.isArray(raw.documentosSoporte) ? raw.documentosSoporte : []
  const documentosSoporte = documentosRaw
    .map((doc) => sanitizeDocumento(doc))
    .filter((doc): doc is DocumentoSoporte => Boolean(doc))

  const requisitosChecklist = buildChecklist(actividad, tipoCliente, raw.requisitosChecklist)

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
    monto,
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
    referenciaAviso: typeof raw.referenciaAviso === "string" ? raw.referenciaAviso : undefined,
    alertaCodigo: typeof raw.alertaCodigo === "string" ? raw.alertaCodigo : undefined,
    alertaDescripcion:
      typeof raw.alertaDescripcion === "string" ? raw.alertaDescripcion : undefined,
    prioridadAviso: typeof raw.prioridadAviso === "string" ? raw.prioridadAviso : undefined,
    claveSujetoObligado:
      typeof raw.claveSujetoObligado === "string" ? raw.claveSujetoObligado : undefined,
    claveActividadVulnerable:
      typeof raw.claveActividadVulnerable === "string" ? raw.claveActividadVulnerable : undefined,
    expedienteReferenciado:
      typeof raw.expedienteReferenciado === "string" ? raw.expedienteReferenciado : undefined,
    personaExpedienteId:
      typeof raw.personaExpedienteId === "string" ? raw.personaExpedienteId : undefined,
    personaAviso: personaAviso ?? null,
    inmueble: inmueble ?? null,
    liquidacion: liquidacion ?? null,
    beneficiario: beneficiario ?? null,
    contraparte: contraparte ?? null,
    instrumento: instrumento ?? null,
    figuraCliente: typeof raw.figuraCliente === "string" ? raw.figuraCliente : undefined,
    figuraSujetoObligado:
      typeof raw.figuraSujetoObligado === "string" ? raw.figuraSujetoObligado : undefined,
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

function sanitizeExpedientePersona(raw: any): ExpedientePersona | null {
  if (!raw || typeof raw !== "object") return null

  const tipo = raw.tipo === "persona_fisica" || raw.tipo === "persona_moral" ? raw.tipo : undefined
  const representanteRaw = raw.representante
  const representante: RepresentanteAviso | null =
    representanteRaw && typeof representanteRaw === "object"
      ? {
          nombre: typeof representanteRaw.nombre === "string" ? representanteRaw.nombre : undefined,
          apellidoPaterno:
            typeof representanteRaw.apellidoPaterno === "string" ? representanteRaw.apellidoPaterno : undefined,
          apellidoMaterno:
            typeof representanteRaw.apellidoMaterno === "string" ? representanteRaw.apellidoMaterno : undefined,
          fechaNacimiento:
            typeof representanteRaw.fechaNacimiento === "string" ? representanteRaw.fechaNacimiento : undefined,
          rfc: typeof representanteRaw.rfc === "string" ? representanteRaw.rfc : undefined,
          curp: typeof representanteRaw.curp === "string" ? representanteRaw.curp : undefined,
        }
      : null

  const domicilioRaw = raw.domicilio
  const domicilio: DomicilioAviso | null =
    domicilioRaw && typeof domicilioRaw === "object"
      ? {
          ambito: domicilioRaw.ambito === "extranjero" ? "extranjero" : "nacional",
          pais:
            typeof domicilioRaw.pais === "string"
              ? findPaisByNombre(domicilioRaw.pais)?.code ??
                findPaisByCodigo(domicilioRaw.pais)?.code ??
                domicilioRaw.pais
              : undefined,
          entidad: typeof domicilioRaw.entidad === "string" ? domicilioRaw.entidad : undefined,
          municipio: typeof domicilioRaw.municipio === "string" ? domicilioRaw.municipio : undefined,
          ciudad: typeof domicilioRaw.ciudad === "string" ? domicilioRaw.ciudad : undefined,
          colonia: typeof domicilioRaw.colonia === "string" ? domicilioRaw.colonia : undefined,
          codigoPostal: typeof domicilioRaw.codigoPostal === "string" ? domicilioRaw.codigoPostal : undefined,
          calle: typeof domicilioRaw.calle === "string" ? domicilioRaw.calle : undefined,
          numeroExterior:
            typeof domicilioRaw.numeroExterior === "string" ? domicilioRaw.numeroExterior : undefined,
          numeroInterior:
            typeof domicilioRaw.numeroInterior === "string" ? domicilioRaw.numeroInterior : undefined,
        }
      : null

  const contactoRaw = raw.contacto
  const contacto =
    contactoRaw && typeof contactoRaw === "object"
      ? {
          conoceTelefono:
            typeof contactoRaw.conoceTelefono === "string" ? contactoRaw.conoceTelefono : undefined,
          conocePaisTelefono:
            typeof contactoRaw.conocePaisTelefono === "string" ? contactoRaw.conocePaisTelefono : undefined,
          clavePais:
            typeof contactoRaw.clavePais === "string"
              ? findPaisByNombre(contactoRaw.clavePais)?.code ??
                findPaisByCodigo(contactoRaw.clavePais)?.code ??
                contactoRaw.clavePais
              : undefined,
          telefono: typeof contactoRaw.telefono === "string" ? contactoRaw.telefono : undefined,
          correo: typeof contactoRaw.correo === "string" ? contactoRaw.correo : undefined,
        }
      : null

  return {
    id: typeof raw.id === "string" ? raw.id : undefined,
    tipo,
    denominacion: typeof raw.denominacion === "string" ? raw.denominacion : undefined,
    fechaConstitucion:
      typeof raw.fechaConstitucion === "string" ? raw.fechaConstitucion : undefined,
    rfc: typeof raw.rfc === "string" ? raw.rfc : undefined,
    curp: typeof raw.curp === "string" ? raw.curp : undefined,
    pais:
      typeof raw.pais === "string"
        ? findPaisByNombre(raw.pais)?.code ?? findPaisByCodigo(raw.pais)?.code ?? raw.pais
        : undefined,
    giro: typeof raw.giro === "string" ? raw.giro : undefined,
    rolRelacion: typeof raw.rolRelacion === "string" ? raw.rolRelacion : undefined,
    representante,
    domicilio,
    contacto,
  }
}

function sanitizeExpediente(raw: any): ExpedienteDetalle | null {
  if (!raw || typeof raw !== "object") return null

  const rfc = typeof raw.rfc === "string" ? raw.rfc : ""
  if (!rfc) return null

  const personasRaw = Array.isArray(raw.personas) ? raw.personas : []
  const personas = personasRaw
    .map((item) => sanitizeExpedientePersona(item))
    .filter((item): item is ExpedientePersona => Boolean(item))

  return {
    rfc,
    nombre: typeof raw.nombre === "string" ? raw.nombre : undefined,
    tipoCliente: typeof raw.tipoCliente === "string" ? normalizarTipoCliente(raw.tipoCliente) : undefined,
    detalleTipoCliente:
      typeof raw.detalleTipoCliente === "string" ? raw.detalleTipoCliente : undefined,
    responsable: typeof raw.responsable === "string" ? raw.responsable : undefined,
    claveSujetoObligado:
      typeof raw.claveSujetoObligado === "string" ? raw.claveSujetoObligado : undefined,
    claveActividadVulnerable:
      typeof raw.claveActividadVulnerable === "string" ? raw.claveActividadVulnerable : undefined,
    identificacion: typeof raw.identificacion === "object" ? raw.identificacion ?? undefined : undefined,
    datosFiscales: typeof raw.datosFiscales === "object" ? raw.datosFiscales ?? undefined : undefined,
    perfilOperaciones:
      typeof raw.perfilOperaciones === "object" ? raw.perfilOperaciones ?? undefined : undefined,
    documentacion:
      typeof raw.documentacion === "object" ? raw.documentacion ?? undefined : undefined,
    personas,
    actualizadoEn: typeof raw.actualizadoEn === "string" ? raw.actualizadoEn : undefined,
  }
}

function buildPersonaAvisoFromExpediente(persona: ExpedientePersona | null | undefined): PersonaAvisoOperacion | null {
  if (!persona) return null
  const tipo = persona.tipo === "persona_fisica" ? "persona_fisica" : "persona_moral"

  if (tipo === "persona_moral") {
    return {
      tipo,
      denominacion: persona.denominacion ?? persona.rfc ?? "Persona moral",
      fechaConstitucion: persona.fechaConstitucion,
      pais: persona.pais,
      giro: persona.giro,
      rfc: persona.rfc,
      curp: persona.curp,
      representante: persona.representante ?? null,
      domicilio: persona.domicilio ?? null,
      contacto:
        persona.contacto
          ? {
              clavePais: persona.contacto.clavePais,
              telefono: persona.contacto.telefono,
              correo: persona.contacto.correo,
            }
          : null,
    }
  }

  const nombreCompleto = persona.denominacion?.split(" ") ?? []
  const nombre = persona.representante?.nombre ?? nombreCompleto[0] ?? ""
  const apellidoPaterno =
    persona.representante?.apellidoPaterno ?? nombreCompleto.slice(1).join(" ") ?? ""

  return {
    tipo,
    nombre,
    apellidoPaterno,
    apellidoMaterno: persona.representante?.apellidoMaterno,
    fechaNacimiento: persona.representante?.fechaNacimiento,
    rfc: persona.rfc,
    curp: persona.curp,
    pais: persona.pais,
    domicilio: persona.domicilio ?? null,
    contacto:
      persona.contacto
        ? {
            clavePais: persona.contacto.clavePais,
            telefono: persona.contacto.telefono,
            correo: persona.contacto.correo,
          }
        : null,
  }
}

function sanitizePersonaAviso(raw: any): PersonaAvisoOperacion | null {
  if (!raw || typeof raw !== "object") return null

  const tipo = raw.tipo === "persona_fisica" || raw.tipo === "persona_moral" ? raw.tipo : null
  if (!tipo) return null

  const representanteRaw = raw.representante
  const representante: RepresentanteAviso | null =
    representanteRaw && typeof representanteRaw === "object"
      ? {
          nombre: typeof representanteRaw.nombre === "string" ? representanteRaw.nombre : undefined,
          apellidoPaterno:
            typeof representanteRaw.apellidoPaterno === "string" ? representanteRaw.apellidoPaterno : undefined,
          apellidoMaterno:
            typeof representanteRaw.apellidoMaterno === "string" ? representanteRaw.apellidoMaterno : undefined,
          fechaNacimiento:
            typeof representanteRaw.fechaNacimiento === "string" ? representanteRaw.fechaNacimiento : undefined,
          rfc: typeof representanteRaw.rfc === "string" ? representanteRaw.rfc : undefined,
          curp: typeof representanteRaw.curp === "string" ? representanteRaw.curp : undefined,
          pais:
            typeof representanteRaw.pais === "string"
              ? findPaisByNombre(representanteRaw.pais)?.code ??
                findPaisByCodigo(representanteRaw.pais)?.code ??
                representanteRaw.pais
              : undefined,
        }
      : null

  const domicilioRaw = raw.domicilio
  const domicilio: DomicilioAviso | null =
    domicilioRaw && typeof domicilioRaw === "object"
      ? {
          ambito: domicilioRaw.ambito === "extranjero" ? "extranjero" : "nacional",
          pais:
            typeof domicilioRaw.pais === "string"
              ? findPaisByNombre(domicilioRaw.pais)?.code ??
                findPaisByCodigo(domicilioRaw.pais)?.code ??
                domicilioRaw.pais
              : undefined,
          entidad: typeof domicilioRaw.entidad === "string" ? domicilioRaw.entidad : undefined,
          municipio: typeof domicilioRaw.municipio === "string" ? domicilioRaw.municipio : undefined,
          colonia: typeof domicilioRaw.colonia === "string" ? domicilioRaw.colonia : undefined,
          codigoPostal: typeof domicilioRaw.codigoPostal === "string" ? domicilioRaw.codigoPostal : undefined,
          calle: typeof domicilioRaw.calle === "string" ? domicilioRaw.calle : undefined,
          numeroExterior:
            typeof domicilioRaw.numeroExterior === "string" ? domicilioRaw.numeroExterior : undefined,
          numeroInterior:
            typeof domicilioRaw.numeroInterior === "string" ? domicilioRaw.numeroInterior : undefined,
        }
      : null

  const contactoRaw = raw.contacto
  const contacto =
    contactoRaw && typeof contactoRaw === "object"
      ? {
          clavePais:
            typeof contactoRaw.clavePais === "string"
              ? findPaisByNombre(contactoRaw.clavePais)?.code ??
                findPaisByCodigo(contactoRaw.clavePais)?.code ??
                contactoRaw.clavePais
              : undefined,
          telefono: typeof contactoRaw.telefono === "string" ? contactoRaw.telefono : undefined,
          correo: typeof contactoRaw.correo === "string" ? contactoRaw.correo : undefined,
        }
      : null

  return {
    tipo,
    denominacion: typeof raw.denominacion === "string" ? raw.denominacion : undefined,
    fechaConstitucion:
      typeof raw.fechaConstitucion === "string" ? raw.fechaConstitucion : undefined,
    pais:
      typeof raw.pais === "string"
        ? findPaisByNombre(raw.pais)?.code ?? findPaisByCodigo(raw.pais)?.code ?? raw.pais
        : undefined,
    giro: typeof raw.giro === "string" ? raw.giro : undefined,
    nombre: typeof raw.nombre === "string" ? raw.nombre : undefined,
    apellidoPaterno: typeof raw.apellidoPaterno === "string" ? raw.apellidoPaterno : undefined,
    apellidoMaterno: typeof raw.apellidoMaterno === "string" ? raw.apellidoMaterno : undefined,
    fechaNacimiento:
      typeof raw.fechaNacimiento === "string" ? raw.fechaNacimiento : undefined,
    rfc: typeof raw.rfc === "string" ? raw.rfc : undefined,
    curp: typeof raw.curp === "string" ? raw.curp : undefined,
    representante,
    domicilio,
    contacto,
  }
}

function sanitizeInmueble(raw: any): DatosInmuebleOperacion | null {
  if (!raw || typeof raw !== "object") return null

  const codigoOperacion = typeof raw.codigoOperacion === "string" ? raw.codigoOperacion : ""
  const tipoInmueble = typeof raw.tipoInmueble === "string" ? raw.tipoInmueble : ""
  const codigoPostal = typeof raw.codigoPostal === "string" ? raw.codigoPostal : ""
  if (!codigoOperacion || !tipoInmueble || !codigoPostal) return null

  return {
    codigoOperacion,
    fechaInicio: typeof raw.fechaInicio === "string" ? raw.fechaInicio : "",
    fechaFin: typeof raw.fechaFin === "string" ? raw.fechaFin : "",
    tipoInmueble,
    valorAvaluo: typeof raw.valorAvaluo === "string" ? raw.valorAvaluo : "",
    folioReal: typeof raw.folioReal === "string" ? raw.folioReal : "",
    pais: typeof raw.pais === "string" ? raw.pais : "MX",
    entidad: typeof raw.entidad === "string" ? raw.entidad : "",
    municipio: typeof raw.municipio === "string" ? raw.municipio : "",
    ciudad: typeof raw.ciudad === "string" ? raw.ciudad : undefined,
    colonia: typeof raw.colonia === "string" ? raw.colonia : "",
    codigoPostal,
    calle: typeof raw.calle === "string" ? raw.calle : "",
    numeroExterior: typeof raw.numeroExterior === "string" ? raw.numeroExterior : "",
    numeroInterior: typeof raw.numeroInterior === "string" ? raw.numeroInterior : undefined,
  }
}

function sanitizeLiquidacion(
  raw: any,
  fallbackMoneda: string,
  fallbackDescripcion: string,
  monto: number,
): DatosLiquidacionOperacion | null {
  if (!raw || typeof raw !== "object") return null

  const fechaPago = typeof raw.fechaPago === "string" ? raw.fechaPago : ""
  const formaPago = typeof raw.formaPago === "string" ? raw.formaPago : ""
  const instrumento = typeof raw.instrumento === "string" ? raw.instrumento : ""
  if (!fechaPago || !formaPago || !instrumento) return null

  return {
    fechaPago,
    formaPago,
    instrumento,
    moneda: typeof raw.moneda === "string" ? raw.moneda : fallbackMoneda,
    monedaDescripcion:
      typeof raw.monedaDescripcion === "string" ? raw.monedaDescripcion : fallbackDescripcion,
    monto: typeof raw.monto === "number" && !Number.isNaN(raw.monto) ? raw.monto : monto,
  }
}

function sanitizeBeneficiario(raw: any): BeneficiarioControladorOperacion | null {
  if (!raw || typeof raw !== "object") return null
  const tipo = raw.tipo === "persona_fisica" || raw.tipo === "persona_moral" ? raw.tipo : null
  if (!tipo) return null
  return {
    tipo,
    nombre: typeof raw.nombre === "string" ? raw.nombre : undefined,
    apellidoPaterno: typeof raw.apellidoPaterno === "string" ? raw.apellidoPaterno : undefined,
    apellidoMaterno: typeof raw.apellidoMaterno === "string" ? raw.apellidoMaterno : undefined,
    fechaNacimiento: typeof raw.fechaNacimiento === "string" ? raw.fechaNacimiento : undefined,
    rfc: typeof raw.rfc === "string" ? raw.rfc : undefined,
    curp: typeof raw.curp === "string" ? raw.curp : undefined,
    pais: typeof raw.pais === "string" ? raw.pais : undefined,
  }
}

function sanitizeContraparte(raw: any): ContraparteOperacion | null {
  if (!raw || typeof raw !== "object") return null
  const tipo = raw.tipo === "persona_fisica" || raw.tipo === "persona_moral" ? raw.tipo : null
  if (!tipo) return null
  return {
    tipo,
    nombre: typeof raw.nombre === "string" ? raw.nombre : undefined,
    apellidoPaterno: typeof raw.apellidoPaterno === "string" ? raw.apellidoPaterno : undefined,
    apellidoMaterno: typeof raw.apellidoMaterno === "string" ? raw.apellidoMaterno : undefined,
    fechaNacimiento: typeof raw.fechaNacimiento === "string" ? raw.fechaNacimiento : undefined,
    rfc: typeof raw.rfc === "string" ? raw.rfc : undefined,
    pais: typeof raw.pais === "string" ? raw.pais : undefined,
  }
}

function sanitizeInstrumento(raw: any): InstrumentoPublicoOperacion | null {
  if (!raw || typeof raw !== "object") return null
  const numero = typeof raw.numero === "string" ? raw.numero : ""
  const fecha = typeof raw.fecha === "string" ? raw.fecha : ""
  const notario = typeof raw.notario === "string" ? raw.notario : ""
  const entidad = typeof raw.entidad === "string" ? raw.entidad : ""
  const valorAvaluo = typeof raw.valorAvaluo === "string" ? raw.valorAvaluo : ""
  if (!numero && !fecha && !notario && !entidad && !valorAvaluo) return null
  return { numero, fecha, notario, entidad, valorAvaluo }
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
  const [expedientesDetalle, setExpedientesDetalle] = useState<Record<string, ExpedienteDetalle>>({})
  const [expedientesListo, setExpedientesListo] = useState(false)
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState<string | null>(null)
  const [personaExpedienteSeleccionada, setPersonaExpedienteSeleccionada] = useState<string>("")
  const [personaAvisoActual, setPersonaAvisoActual] = useState<PersonaAvisoOperacion | null>(null)
  const [codigoOperacionInmueble, setCodigoOperacionInmueble] = useState<string>("")
  const [figuraClienteInmueble, setFiguraClienteInmueble] = useState<string>("")
  const [figuraSujetoObligadoInmueble, setFiguraSujetoObligadoInmueble] = useState<string>("")
  const [referenciaAviso, setReferenciaAviso] = useState<string>("")
  const [alertaCodigo, setAlertaCodigo] = useState<string>(ALERTA_DEFAULT)
  const [alertaDescripcion, setAlertaDescripcion] = useState<string>("")
  const [prioridadAviso, setPrioridadAviso] = useState<string>(PRIORIDAD_DEFAULT)
  const [claveSujetoObligado, setClaveSujetoObligado] = useState<string>("")
  const [claveActividad, setClaveActividad] = useState<string>("")
  const [coloniasDisponibles, setColoniasDisponibles] = useState<string[]>([])
  const [inmuebleForm, setInmuebleForm] = useState<DatosInmuebleFormState>(() => ({ ...INMUEBLE_FORM_DEFAULT }))
  const [liquidacionForm, setLiquidacionForm] = useState<DatosLiquidacionFormState>(
    () => ({ ...LIQUIDACION_FORM_DEFAULT }),
  )
  const [beneficiarioForm, setBeneficiarioForm] = useState<BeneficiarioFormState>(
    () => ({ ...BENEFICIARIO_FORM_DEFAULT }),
  )
  const [contraparteForm, setContraparteForm] = useState<ContraparteFormState>(
    () => ({ ...CONTRAPARTE_FORM_DEFAULT }),
  )
  const [instrumentoForm, setInstrumentoForm] = useState<InstrumentoPublicoFormState>(
    () => ({ ...INSTRUMENTO_FORM_DEFAULT }),
  )
  const [operaciones, setOperaciones] = useState<OperacionCliente[]>([])
  const [operacionesCargadas, setOperacionesCargadas] = useState(false)
  const [clientesGuardados, setClientesGuardados] = useState<ClienteGuardado[]>([])
  const [clientesGuardadosListo, setClientesGuardadosListo] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string | null>(null)
  const [avisoPreliminar, setAvisoPreliminar] = useState<OperacionCliente | null>(null)
  const [infoGrupoOpen, setInfoGrupoOpen] = useState(false)
  const [infoTipoClienteOpen, setInfoTipoClienteOpen] = useState(false)
  const [actividadInfoKey, setActividadInfoKey] = useState<string | null>(null)
  const [infoModal, setInfoModal] = useState<InfoModalKey | null>(null)
  const [tabActiva, setTabActiva] = useState<"resumen" | "captura" | "seguimiento" | "explorar">("resumen")
  const [registroModo, setRegistroModo] = useState<"consulta" | "nuevo">("consulta")
  const [expedienteConsultaId, setExpedienteConsultaId] = useState<string | null>(null)
  const [sujetoConsulta, setSujetoConsulta] = useState<string>("")
  const [relacionNegocios, setRelacionNegocios] = useState(false)
  const [relacionNegociosOpen, setRelacionNegociosOpen] = useState(false)
  const [sujetoObligadoOperacion, setSujetoObligadoOperacion] = useState<string>("")
  const [clienteOperacionSeleccionado, setClienteOperacionSeleccionado] = useState<string>("")
  const [actividadOperacionSeleccionada, setActividadOperacionSeleccionada] = useState<string>("")
  const [anioOperacionCaptura, setAnioOperacionCaptura] = useState<number>(currentYear)
  const [mesOperacionCaptura, setMesOperacionCaptura] = useState<number>(currentMonth)
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
  const [busquedaActividad, setBusquedaActividad] = useState("")
  const [busquedaClienteGuardado, setBusquedaClienteGuardado] = useState("")
  const [busquedaCiudadInmueble, setBusquedaCiudadInmueble] = useState("")
  const [busquedaColoniaInmueble, setBusquedaColoniaInmueble] = useState("")
  const demoCargaRef = useRef(false)

  const actualizarInmuebleForm = useCallback(
    (campo: keyof DatosInmuebleFormState, valor: string) => {
      setInmuebleForm((prev) => ({ ...prev, [campo]: valor }))
    },
    [],
  )

  const actualizarLiquidacionForm = useCallback(
    (campo: keyof DatosLiquidacionFormState, valor: string) => {
      setLiquidacionForm((prev) => ({ ...prev, [campo]: valor }))
    },
    [],
  )

  const actualizarBeneficiarioForm = useCallback(
    (campo: keyof BeneficiarioFormState, valor: string) => {
      setBeneficiarioForm((prev) => ({ ...prev, [campo]: valor }))
    },
    [],
  )

  const actualizarContraparteForm = useCallback(
    (campo: keyof ContraparteFormState, valor: string) => {
      setContraparteForm((prev) => ({ ...prev, [campo]: valor }))
    },
    [],
  )

  const actualizarInstrumentoForm = useCallback(
    (campo: keyof InstrumentoPublicoFormState, valor: string) => {
      setInstrumentoForm((prev) => ({ ...prev, [campo]: valor }))
    },
    [],
  )

  const tipoClienteSeleccionado = useMemo(
    () => obtenerOpcionTipoCliente(tipoCliente),
    [tipoCliente],
  )

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
    if (!operacionesCargadas) return
    if (typeof window === "undefined") return

    window.localStorage.setItem(OPERACIONES_STORAGE_KEY, JSON.stringify(operaciones))
  }, [operaciones, operacionesCargadas])

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const stored = window.localStorage.getItem(EXPEDIENTE_DETALLE_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as unknown
        if (Array.isArray(parsed)) {
          const sane = parsed
            .map((item) => sanitizeExpediente(item))
            .filter((item): item is ExpedienteDetalle => Boolean(item))
          if (sane.length > 0) {
            const mapa = new Map<string, ExpedienteDetalle>()
            sane.forEach((expediente) => {
              mapa.set(expediente.rfc, expediente)
            })
            setExpedientesDetalle(Object.fromEntries(mapa))
          }
        }
      }
    } catch (error) {
      console.error("No fue posible leer el detalle de expedientes", error)
    } finally {
      setExpedientesListo(true)
    }
  }, [])

  useEffect(() => {
    if (availableYears.length === 0) return
    if (!availableYears.includes(anioSeleccionado)) {
      setAnioSeleccionado(availableYears[availableYears.length - 1])
    }
  }, [availableYears, anioSeleccionado])

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
      moneda: MONEDAS.some((item) => item.value === operacionEnEdicion.moneda)
        ? operacionEnEdicion.moneda
        : "OTRA",
      monedaPersonalizadaCodigo:
        MONEDAS.some((item) => item.value === operacionEnEdicion.moneda)
          ? ""
          : operacionEnEdicion.moneda,
      monedaPersonalizadaDescripcion:
        MONEDAS.some((item) => item.value === operacionEnEdicion.moneda)
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

  const esActividadInmuebles = useMemo(
    () => actividadSeleccionada?.key === ACTIVIDAD_INMUEBLES_KEY,
    [actividadSeleccionada],
  )

  const expedienteActual = useMemo(
    () => (expedienteSeleccionado ? expedientesDetalle[expedienteSeleccionado] ?? null : null),
    [expedienteSeleccionado, expedientesDetalle],
  )

  const expedienteConsultaActual = useMemo(
    () => (expedienteConsultaId ? expedientesDetalle[expedienteConsultaId] ?? null : null),
    [expedienteConsultaId, expedientesDetalle],
  )

  const expedientesDisponibles = useMemo(
    () =>
      Object.values(expedientesDetalle).sort((a, b) =>
        (a.nombre ?? a.rfc).localeCompare(b.nombre ?? b.rfc, "es"),
      ),
    [expedientesDetalle],
  )

  const fechaBaseExpediente = expedienteActual?.actualizadoEn
  const fechaBaseConsulta = expedienteConsultaActual?.actualizadoEn

  const siguienteRevisionAnual = useMemo(() => {
    if (!relacionNegocios) return null
    const fechaBase = fechaBaseConsulta ?? fechaBaseExpediente
    if (!fechaBase) return null
    const fecha = new Date(fechaBase)
    fecha.setFullYear(fecha.getFullYear() + 1)
    return fecha.toISOString().substring(0, 10)
  }, [fechaBaseConsulta, fechaBaseExpediente, relacionNegocios])

  const sujetosObligadosDisponibles = useMemo(() => {
    const mapa = new Map<string, string>()
    expedientesDisponibles.forEach((expediente) => {
      const clave = expediente.claveSujetoObligado ?? expediente.rfc
      const etiquetaBase = expediente.nombre ?? expediente.rfc
      if (!mapa.has(clave)) {
        mapa.set(clave, expediente.claveSujetoObligado ? `${expediente.claveSujetoObligado} – ${etiquetaBase}` : etiquetaBase)
      }
    })
    return Array.from(mapa.entries()).map(([value, label]) => ({ value, label }))
  }, [expedientesDisponibles])

  const clientesPorSujetoObligado = useMemo(
    () =>
      expedientesDisponibles
        .filter((expediente) => {
          if (!sujetoObligadoOperacion) return true
          return (expediente.claveSujetoObligado ?? expediente.rfc) === sujetoObligadoOperacion
        })
        .map((expediente) => ({
          value: expediente.rfc,
          label: expediente.nombre ?? expediente.rfc,
          actividad: expediente.claveActividadVulnerable,
        })),
    [expedientesDisponibles, sujetoObligadoOperacion],
  )

  const actividadesRegistradasCliente = useMemo(() => {
    const expedienteCliente = expedientesDisponibles.find(
      (expediente) => expediente.rfc === clienteOperacionSeleccionado,
    )
    if (!expedienteCliente?.claveActividadVulnerable) return []
    const actividad = actividadesVulnerables.find(
      (item) => item.key === expedienteCliente.claveActividadVulnerable,
    )
    return actividad ? [actividad] : []
  }, [clienteOperacionSeleccionado, expedientesDisponibles])

  const actividadOperacionDetalle = useMemo(
    () =>
      actividadesRegistradasCliente.find(
        (actividad) => actividad.key === actividadOperacionSeleccionada,
      ) ?? actividadesRegistradasCliente[0],
    [actividadOperacionSeleccionada, actividadesRegistradasCliente],
  )

  const personasExpediente = expedienteActual?.personas ?? []

  const personasExpedienteOpciones = useMemo(
    () =>
      personasExpediente.map((persona, index) => {
        const baseId =
          persona.id && persona.id.trim().length > 0
            ? persona.id
            : `${persona.rfc ?? persona.denominacion ?? index}`
        const id = baseId || `persona-${index}`
        const nombreRepresentante = persona.representante?.nombre
          ? `${persona.representante.nombre} ${persona.representante.apellidoPaterno ?? ""}`.trim()
          : ""
        const labelBase =
          persona.denominacion && persona.denominacion.trim().length > 0
            ? persona.denominacion
            : nombreRepresentante || persona.rfc || `Persona ${index + 1}`
        return { id, label: labelBase, persona }
      }),
    [personasExpediente],
  )

  const personaExpedienteSeleccionadaInfo = useMemo(
    () =>
      personasExpedienteOpciones.find((option) => option.id === personaExpedienteSeleccionada) ??
      personasExpedienteOpciones[0],
    [personasExpedienteOpciones, personaExpedienteSeleccionada],
  )

  const personaExpediente = personaExpedienteSeleccionadaInfo?.persona ?? null

  useEffect(() => {
    if (personasExpedienteOpciones.length === 0) {
      if (personaExpedienteSeleccionada !== "") {
        setPersonaExpedienteSeleccionada("")
      }
      return
    }

    if (!personaExpedienteSeleccionada) {
      setPersonaExpedienteSeleccionada(personasExpedienteOpciones[0].id)
      return
    }

    if (!personasExpedienteOpciones.some((option) => option.id === personaExpedienteSeleccionada)) {
      setPersonaExpedienteSeleccionada(personasExpedienteOpciones[0].id)
    }
  }, [personasExpedienteOpciones, personaExpedienteSeleccionada])

  useEffect(() => {
    if (!personaExpediente) {
      setPersonaAvisoActual(null)
      setClienteNombre("")
      setRfc("")
      setColoniasDisponibles([])
      setInmuebleForm((prev) => ({
        ...prev,
        pais: INMUEBLE_FORM_DEFAULT.pais,
        entidad: "",
        municipio: "",
        ciudad: "",
        colonia: "",
        codigoPostal: "",
        calle: "",
        numeroExterior: "",
        numeroInterior: "",
      }))
      setBeneficiarioForm((prev) => ({
        ...prev,
        nombre: "",
        apellidoPaterno: "",
        apellidoMaterno: "",
        fechaNacimiento: "",
        rfc: "",
        curp: "",
        pais: BENEFICIARIO_FORM_DEFAULT.pais,
      }))
      return
    }

    const personaAviso = buildPersonaAvisoFromExpediente(personaExpediente)
    setPersonaAvisoActual(personaAviso)

    const nombreCliente = personaAviso
      ? personaAviso.tipo === "persona_moral"
        ? personaAviso.denominacion ?? ""
        : [personaAviso.nombre, personaAviso.apellidoPaterno, personaAviso.apellidoMaterno]
            .filter((parte) => typeof parte === "string" && parte.trim().length > 0)
            .join(" ")
      : ""
    setClienteNombre(nombreCliente)

    const rfcPersona = personaAviso?.rfc ?? expedienteActual?.rfc ?? ""
    setRfc(rfcPersona ? rfcPersona.toUpperCase() : "")

    const domicilio = personaAviso?.domicilio ?? null
    if (domicilio) {
      setInmuebleForm((prev) => ({
        ...prev,
        pais: domicilio.pais ?? prev.pais ?? INMUEBLE_FORM_DEFAULT.pais,
        entidad: domicilio.entidad ?? "",
        municipio: domicilio.municipio ?? "",
        ciudad: domicilio.ciudad ?? "",
        colonia: domicilio.colonia ?? "",
        codigoPostal: domicilio.codigoPostal ?? "",
        calle: domicilio.calle ?? "",
        numeroExterior: domicilio.numeroExterior ?? "",
        numeroInterior: domicilio.numeroInterior ?? "",
      }))

      if (domicilio.codigoPostal) {
        const info = findCodigoPostalInfo(domicilio.codigoPostal)
        setColoniasDisponibles(info?.asentamientos ?? [])
        if (info?.ciudad) {
          setInmuebleForm((prev) => ({
            ...prev,
            ciudad: prev.ciudad || info.ciudad || "",
          }))
        }
      } else {
        setColoniasDisponibles([])
      }
    } else {
      setInmuebleForm((prev) => ({
        ...prev,
        pais: INMUEBLE_FORM_DEFAULT.pais,
        entidad: "",
        municipio: "",
        colonia: "",
        codigoPostal: "",
        calle: "",
        numeroExterior: "",
        numeroInterior: "",
      }))
      setColoniasDisponibles([])
    }

    if (personaAviso?.representante) {
      setBeneficiarioForm((prev) => ({
        ...prev,
        tipo: "persona_fisica",
        nombre: personaAviso.representante?.nombre ?? "",
        apellidoPaterno: personaAviso.representante?.apellidoPaterno ?? "",
        apellidoMaterno: personaAviso.representante?.apellidoMaterno ?? "",
        fechaNacimiento: personaAviso.representante?.fechaNacimiento ?? "",
        rfc: personaAviso.representante?.rfc ?? "",
        curp: personaAviso.representante?.curp ?? "",
        pais: personaAviso.representante?.pais ?? BENEFICIARIO_FORM_DEFAULT.pais,
      }))
    } else {
      setBeneficiarioForm((prev) => ({
        ...prev,
        nombre: "",
        apellidoPaterno: "",
        apellidoMaterno: "",
        fechaNacimiento: "",
        rfc: "",
        curp: "",
        pais: BENEFICIARIO_FORM_DEFAULT.pais,
      }))
    }

    if (expedienteActual?.tipoCliente) {
      setTipoCliente(expedienteActual.tipoCliente)
    }
    if (expedienteActual?.detalleTipoCliente) {
      setDetalleTipoCliente(expedienteActual.detalleTipoCliente)
    }
    if (expedienteActual?.claveSujetoObligado) {
      setClaveSujetoObligado(expedienteActual.claveSujetoObligado)
    }
    if (expedienteActual?.claveActividadVulnerable) {
      setClaveActividad(expedienteActual.claveActividadVulnerable)
    }
  }, [personaExpediente, expedienteActual])

  useEffect(() => {
    if (clientesPorSujetoObligado.length === 0) {
      setClienteOperacionSeleccionado("")
      return
    }

    if (!clientesPorSujetoObligado.some((cliente) => cliente.value === clienteOperacionSeleccionado)) {
      setClienteOperacionSeleccionado(clientesPorSujetoObligado[0].value)
    }
  }, [clientesPorSujetoObligado, clienteOperacionSeleccionado])

  useEffect(() => {
    if (actividadesRegistradasCliente.length === 0) {
      if (actividadOperacionSeleccionada !== "") {
        setActividadOperacionSeleccionada("")
      }
      return
    }

    if (!actividadOperacionSeleccionada) {
      setActividadOperacionSeleccionada(actividadesRegistradasCliente[0].key)
      return
    }

    if (!actividadesRegistradasCliente.some((actividad) => actividad.key === actividadOperacionSeleccionada)) {
      setActividadOperacionSeleccionada(actividadesRegistradasCliente[0].key)
    }
  }, [actividadOperacionSeleccionada, actividadesRegistradasCliente])

  useEffect(() => {
    if (!inmuebleForm.codigoPostal) {
      if (coloniasDisponibles.length > 0) {
        setColoniasDisponibles([])
      }
      return
    }

    const info = findCodigoPostalInfo(inmuebleForm.codigoPostal)
    if (!info) {
      if (coloniasDisponibles.length > 0) {
        setColoniasDisponibles([])
      }
      return
    }

    setColoniasDisponibles(info.asentamientos)
    setInmuebleForm((prev) => ({
      ...prev,
      entidad: prev.entidad || info.estado,
      municipio: prev.municipio || info.municipio,
      ciudad: prev.ciudad || info.ciudad || "",
      colonia: info.asentamientos.includes(prev.colonia)
        ? prev.colonia
        : info.asentamientos[0] ?? prev.colonia,
    }))
  }, [inmuebleForm.codigoPostal, coloniasDisponibles.length])

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

  const actividadesFiltradas = useMemo(() => {
    const termino = normalizarBusqueda(busquedaActividad)
    if (!termino) return actividadesVulnerables
    return actividadesVulnerables.filter((actividad) => {
      const texto = normalizarBusqueda(
        `${actividad.fraccion} ${actividad.nombre} ${actividad.descripcion}`,
      )
      return texto.includes(termino)
    })
  }, [busquedaActividad])

  const clientesGuardadosFiltrados = useMemo(() => {
    const termino = normalizarBusqueda(busquedaClienteGuardado)
    if (!termino) return clientesGuardados
    return clientesGuardados.filter((cliente) => {
      const texto = normalizarBusqueda(
        `${cliente.nombre} ${cliente.rfc} ${cliente.detalleTipoCliente ?? ""}`,
      )
      return texto.includes(termino)
    })
  }, [clientesGuardados, busquedaClienteGuardado])

  const coloniasFiltradasInmueble = useMemo(() => {
    const termino = normalizarBusqueda(busquedaColoniaInmueble)
    const base = coloniasDisponibles
    let lista = termino
      ? base.filter((colonia) => normalizarBusqueda(colonia).includes(termino))
      : base
    if (
      inmuebleForm.colonia &&
      base.includes(inmuebleForm.colonia) &&
      !lista.includes(inmuebleForm.colonia)
    ) {
      lista = [inmuebleForm.colonia, ...lista]
    }
    return lista
  }, [busquedaColoniaInmueble, coloniasDisponibles, inmuebleForm.colonia])

  const ciudadesFiltradasInmueble = useMemo(() => {
    if (inmuebleForm.pais !== "MX") {
      return []
    }
    const termino = normalizarBusqueda(busquedaCiudadInmueble)
    const base = CIUDADES_MEXICO
    let lista = termino
      ? base.filter((ciudad) => normalizarBusqueda(ciudad).includes(termino))
      : base
    if (inmuebleForm.ciudad && !lista.includes(inmuebleForm.ciudad)) {
      lista = [inmuebleForm.ciudad, ...lista]
    }
    return Array.from(new Set(lista))
  }, [busquedaCiudadInmueble, inmuebleForm.ciudad, inmuebleForm.pais])

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
    const baseCompleto =
      Boolean(clienteNombre.trim()) &&
      Boolean(rfc.trim()) &&
      Boolean(tipoOperacion.trim()) &&
      Boolean(montoOperacion.trim()) &&
      (!tipoClienteSeleccionado?.requiresDetalle || Boolean(detalleTipoCliente.trim()))

    if (!baseCompleto) return false

    if (esActividadInmuebles) {
      const camposInmuebleCompletos =
        Boolean(codigoOperacionInmueble) &&
        Boolean(figuraClienteInmueble) &&
        Boolean(figuraSujetoObligadoInmueble) &&
        Boolean(referenciaAviso.trim()) &&
        Boolean(claveSujetoObligado.trim()) &&
        Boolean(claveActividad.trim()) &&
        Boolean(inmuebleForm.tipoInmueble.trim()) &&
        Boolean(inmuebleForm.codigoPostal.trim()) &&
        Boolean(inmuebleForm.pais.trim()) &&
        Boolean(inmuebleForm.entidad.trim()) &&
        Boolean(inmuebleForm.municipio.trim()) &&
        Boolean(inmuebleForm.ciudad.trim()) &&
        Boolean(inmuebleForm.colonia.trim()) &&
        Boolean(inmuebleForm.calle.trim()) &&
        Boolean(inmuebleForm.numeroExterior.trim()) &&
        Boolean(liquidacionForm.fechaPago.trim()) &&
        Boolean(liquidacionForm.formaPago.trim()) &&
        Boolean(liquidacionForm.instrumento.trim()) &&
        Boolean(beneficiarioForm.nombre.trim()) &&
        Boolean(beneficiarioForm.apellidoPaterno.trim()) &&
        Boolean(beneficiarioForm.pais.trim())

      return camposInmuebleCompletos
    }

    return true
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
  esActividadInmuebles,
  codigoOperacionInmueble,
  figuraClienteInmueble,
  figuraSujetoObligadoInmueble,
  referenciaAviso,
  inmuebleForm,
  liquidacionForm,
  beneficiarioForm,
  claveSujetoObligado,
  claveActividad,
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
  setCodigoOperacionInmueble("")
  setFiguraClienteInmueble("")
  setFiguraSujetoObligadoInmueble("")
  setReferenciaAviso("")
  setAlertaCodigo(ALERTA_DEFAULT)
  setAlertaDescripcion("")
  setPrioridadAviso(PRIORIDAD_DEFAULT)
  setInmuebleForm({ ...INMUEBLE_FORM_DEFAULT })
  setLiquidacionForm({ ...LIQUIDACION_FORM_DEFAULT })
  setBeneficiarioForm({ ...BENEFICIARIO_FORM_DEFAULT })
  setContraparteForm({ ...CONTRAPARTE_FORM_DEFAULT })
  setInstrumentoForm({ ...INSTRUMENTO_FORM_DEFAULT })
  setColoniasDisponibles([])
  if (!expedienteSeleccionado) {
    setClaveSujetoObligado("")
    setClaveActividad("")
  }
}

const DEMO_EVIDENCIA_DESCRIPCION =
  "Contrato marco de arrendamiento 2025 firmado con Corporativo Norte S.A."

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

const cargarDemoFraccionXV = () => {
  const demo = demoFraccionXV

  if (
    operaciones.some((operacion) => operacion.referenciaAviso === demo.inmueble.referenciaAviso)
  ) {
    setTabActiva("seguimiento")
    toast({
      title: "Demo ya registrada",
      description: "Elimina la operación demo existente para volver a generarla.",
    })
    return
  }

  setTabActiva("captura")
  setPasoActual(0)
  limpiarFormulario()
  setActividadKey(demo.actividadKey)
  setActividadInfoKey(demo.actividadKey)
  setAnioSeleccionado(demo.periodo.anio)
  setMesSeleccionado(demo.periodo.mes)
  setFechaOperacion(demo.periodo.fechaOperacion)
  setTipoOperacion(demo.cliente.tipoOperacion)
  setMontoOperacion(demo.cliente.monto)
  setMoneda(demo.cliente.moneda)
  setClienteNombre(demo.cliente.nombre)
  setRfc(demo.cliente.rfc)
  setTipoCliente(demo.cliente.tipo)
  setDetalleTipoCliente(demo.cliente.detalle)
  setMismoGrupo(demo.cliente.mismoGrupo ? "si" : "no")
  setEvidencia(DEMO_EVIDENCIA_DESCRIPCION)
  setCodigoOperacionInmueble(demo.inmueble.codigoOperacion)
  setFiguraClienteInmueble(demo.inmueble.figuraCliente)
  setFiguraSujetoObligadoInmueble(demo.inmueble.figuraSujetoObligado)
  setReferenciaAviso(demo.inmueble.referenciaAviso)
  setAlertaCodigo(demo.inmueble.alertaCodigo)
  setAlertaDescripcion(demo.inmueble.alertaDescripcion ?? "")
  setPrioridadAviso(demo.inmueble.prioridadAviso)
  setClaveSujetoObligado(demo.inmueble.claveSujetoObligado)
  setClaveActividad(demo.inmueble.claveActividad)
  setInmuebleForm({
    fechaInicio: demo.periodo.fechaInicioContrato,
    fechaFin: demo.periodo.fechaFinContrato,
    tipoInmueble: demo.inmueble.tipoInmueble,
    valorAvaluo: demo.inmueble.valorAvaluo,
    folioReal: demo.inmueble.folioReal,
    pais: demo.inmueble.pais,
    entidad: demo.inmueble.entidad,
    municipio: demo.inmueble.municipio,
    ciudad: demo.inmueble.ciudad,
    colonia: demo.inmueble.colonia,
    codigoPostal: demo.inmueble.codigoPostal,
    calle: demo.inmueble.calle,
    numeroExterior: demo.inmueble.numeroExterior,
    numeroInterior: demo.inmueble.numeroInterior,
  })
  const infoCodigo = findCodigoPostalInfo(demo.inmueble.codigoPostal)
  setColoniasDisponibles(infoCodigo?.asentamientos ?? [])
  setLiquidacionForm({
    fechaPago: demo.periodo.fechaPago,
    formaPago: demo.liquidacion.formaPago,
    instrumento: demo.liquidacion.instrumento,
  })
  setBeneficiarioForm({
    tipo: demo.beneficiario.tipo,
    nombre: demo.beneficiario.nombre,
    apellidoPaterno: demo.beneficiario.apellidoPaterno,
    apellidoMaterno: demo.beneficiario.apellidoMaterno,
    fechaNacimiento: demo.beneficiario.fechaNacimiento,
    rfc: demo.beneficiario.rfc,
    curp: demo.beneficiario.curp,
    pais: demo.beneficiario.pais,
  })
  setContraparteForm({
    tipo: demo.contraparte.tipo,
    nombre: demo.contraparte.nombre,
    apellidoPaterno: demo.contraparte.apellidoPaterno,
    apellidoMaterno: demo.contraparte.apellidoMaterno,
    fechaNacimiento: demo.contraparte.fechaNacimiento,
    rfc: demo.contraparte.rfc,
    pais: demo.contraparte.pais,
  })
  setInstrumentoForm({
    numero: demo.instrumento.numero,
    fecha: demo.instrumento.fecha,
    notario: demo.instrumento.notario,
    entidad: demo.instrumento.entidad,
    valorAvaluo: demo.instrumento.valorAvaluo,
  })
  setPersonaAvisoActual(demoFraccionXV.personaAviso as PersonaAvisoOperacion)
  setPersonaExpedienteSeleccionada("")
  setAvisoPreliminar(null)

  demoCargaRef.current = true
  setTimeout(() => {
    agregarOperacion()
    toast({
      title: "Demo cargada",
      description: "Se agregó una operación de ejemplo de la Fracción XV para fines de demostración.",
    })
  }, 150)
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

  const personaAvisoSnapshot = personaAvisoActual
    ? { ...personaAvisoActual }
    : buildPersonaAvisoFromExpediente(personaExpediente)

  let inmuebleOperacion: DatosInmuebleOperacion | null = null
  let liquidacionOperacion: DatosLiquidacionOperacion | null = null
  let beneficiarioOperacion: BeneficiarioControladorOperacion | null = null
  let contraparteOperacion: ContraparteOperacion | null = null
  let instrumentoOperacion: InstrumentoPublicoOperacion | null = null

  if (esActividadInmuebles) {
    inmuebleOperacion = {
      codigoOperacion: codigoOperacionInmueble,
      fechaInicio: inmuebleForm.fechaInicio,
      fechaFin: inmuebleForm.fechaFin,
      tipoInmueble: inmuebleForm.tipoInmueble,
      valorAvaluo: inmuebleForm.valorAvaluo,
      folioReal: inmuebleForm.folioReal,
      pais: inmuebleForm.pais,
      entidad: inmuebleForm.entidad,
      municipio: inmuebleForm.municipio,
      ciudad: inmuebleForm.ciudad || undefined,
      colonia: inmuebleForm.colonia,
      codigoPostal: inmuebleForm.codigoPostal,
      calle: inmuebleForm.calle,
      numeroExterior: inmuebleForm.numeroExterior,
      numeroInterior: inmuebleForm.numeroInterior.trim() ? inmuebleForm.numeroInterior : undefined,
    }

    liquidacionOperacion = {
      fechaPago: liquidacionForm.fechaPago,
      formaPago: liquidacionForm.formaPago,
      instrumento: liquidacionForm.instrumento,
      moneda: monedaCodigoFinal,
      monedaDescripcion: monedaDescripcionFinal,
      monto,
    }

    beneficiarioOperacion = {
      tipo: beneficiarioForm.tipo,
      nombre: beneficiarioForm.nombre,
      apellidoPaterno: beneficiarioForm.apellidoPaterno,
      apellidoMaterno: beneficiarioForm.apellidoMaterno,
      fechaNacimiento: beneficiarioForm.fechaNacimiento,
      rfc: beneficiarioForm.rfc,
      curp: beneficiarioForm.curp,
      pais: beneficiarioForm.pais,
    }

    contraparteOperacion = {
      tipo: contraparteForm.tipo,
      nombre: contraparteForm.nombre,
      apellidoPaterno: contraparteForm.apellidoPaterno,
      apellidoMaterno: contraparteForm.apellidoMaterno,
      fechaNacimiento: contraparteForm.fechaNacimiento,
      rfc: contraparteForm.rfc,
      pais: contraparteForm.pais,
    }

    if (
      instrumentoForm.numero.trim() ||
      instrumentoForm.fecha.trim() ||
      instrumentoForm.notario.trim() ||
      instrumentoForm.entidad.trim() ||
      instrumentoForm.valorAvaluo.trim()
    ) {
      instrumentoOperacion = {
        numero: instrumentoForm.numero,
        fecha: instrumentoForm.fecha,
        notario: instrumentoForm.notario,
        entidad: instrumentoForm.entidad,
        valorAvaluo: instrumentoForm.valorAvaluo,
      }
    }
  }

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
  const omitirToast = demoCargaRef.current

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
    referenciaAviso: esActividadInmuebles ? referenciaAviso.trim() : undefined,
    alertaCodigo: esActividadInmuebles ? alertaCodigo : undefined,
    alertaDescripcion:
      esActividadInmuebles && alertaDescripcion.trim().length > 0
        ? alertaDescripcion.trim()
        : undefined,
    prioridadAviso: esActividadInmuebles ? prioridadAviso : undefined,
    claveSujetoObligado: claveSujetoObligado.trim() || undefined,
    claveActividadVulnerable: claveActividad.trim() || undefined,
    expedienteReferenciado: expedienteSeleccionado ?? undefined,
    personaExpedienteId: personaExpedienteSeleccionada || undefined,
    personaAviso: personaAvisoSnapshot ?? null,
    inmueble: inmuebleOperacion,
    liquidacion: liquidacionOperacion,
    beneficiario: beneficiarioOperacion,
    contraparte: contraparteOperacion,
    instrumento: instrumentoOperacion,
    figuraCliente: esActividadInmuebles ? figuraClienteInmueble : undefined,
    figuraSujetoObligado: esActividadInmuebles ? figuraSujetoObligadoInmueble : undefined,
  }

  actualizarOperaciones((prev) => [...prev, nuevaOperacion])
  registrarClienteGuardado({
    rfc: nuevaOperacion.rfc,
    nombre: nuevaOperacion.cliente,
    tipoCliente: nuevaOperacion.tipoCliente,
    mismoGrupo: nuevaOperacion.mismoGrupo,
    detalleTipoCliente: nuevaOperacion.detalleTipoCliente,
  })

  if (!omitirToast) {
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
  }

  setPasoActual(0)
  limpiarFormulario()
  setTabActiva("seguimiento")
  setClienteCalendario(nuevaOperacion.rfc)
  setAnioCalendario(nuevaOperacion.anio)
  setMesCalendario(nuevaOperacion.mes)
  setDiaSeleccionado(normalizeDateKey(nuevaOperacion.fechaOperacion))
  demoCargaRef.current = false
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

function descargarXml(contenido: string, nombre: string) {
  const blob = new Blob([contenido], { type: "application/xml" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = nombre
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function generarXmlInmueble(operacion: OperacionCliente): string | null {
  const persona = operacion.personaAviso
  const inmueble = operacion.inmueble
  const liquidacion = operacion.liquidacion
  if (!persona || !inmueble || !liquidacion) {
    return null
  }

  const periodo = operacion.periodo || buildPeriodo(operacion.anio, operacion.mes)
  const claveSujeto = operacion.claveSujetoObligado?.trim() || operacion.rfc
  const claveActividad = operacion.claveActividadVulnerable?.trim() || "INM"
  const referencia = operacion.referenciaAviso?.trim() || operacion.id
  const prioridad = operacion.prioridadAviso ?? PRIORIDAD_DEFAULT
  const alertaTipo = operacion.alertaCodigo ?? ALERTA_DEFAULT
  const alertaDescripcion = operacion.alertaDescripcion?.trim()
  const domicilio = persona.domicilio
  const telefono = persona.contacto?.telefono
  const claveTelefono = persona.contacto?.clavePais ?? persona.pais ?? "MX"
  const beneficiario = operacion.beneficiario
  const contraparte = operacion.contraparte
  const instrumento = operacion.instrumento
  const tipoDomicilio = domicilio?.ambito === "extranjero" ? "extranjero" : "nacional"
  const tipoInmuebleCodigo = TIPO_INMUEBLE_CODIGOS[inmueble.tipoInmueble] ?? inmueble.tipoInmueble

  const personaXml = persona.tipo === "persona_moral"
    ? `      <tipo_persona>
        <persona_moral>
          <denominacion_razon>${escapeXml(persona.denominacion ?? persona.rfc ?? "")}</denominacion_razon>
          ${persona.fechaConstitucion ? `<fecha_constitucion>${formatFechaXml(persona.fechaConstitucion)}</fecha_constitucion>` : ""}
          <pais_nacionalidad>${escapeXml((persona.pais ?? "MX").toUpperCase())}</pais_nacionalidad>
          ${persona.giro ? `<giro_mercantil>${escapeXml(persona.giro)}</giro_mercantil>` : ""}
          ${persona.representante ? `          <representante_apoderado>
            <nombre>${escapeXml(persona.representante.nombre ?? "")}</nombre>
            <apellido_paterno>${escapeXml(persona.representante.apellidoPaterno ?? "")}</apellido_paterno>
            <apellido_materno>${escapeXml(persona.representante.apellidoMaterno ?? "")}</apellido_materno>
            ${persona.representante.fechaNacimiento ? `<fecha_nacimiento>${formatFechaXml(persona.representante.fechaNacimiento)}</fecha_nacimiento>` : ""}
            ${persona.representante.rfc ? `<rfc>${escapeXml(persona.representante.rfc)}</rfc>` : ""}
          </representante_apoderado>` : ""}
        </persona_moral>
      </tipo_persona>`
    : `      <tipo_persona>
        <persona_fisica>
          <nombre>${escapeXml(persona.nombre ?? "")}</nombre>
          <apellido_paterno>${escapeXml(persona.apellidoPaterno ?? "")}</apellido_paterno>
          <apellido_materno>${escapeXml(persona.apellidoMaterno ?? "")}</apellido_materno>
          ${persona.fechaNacimiento ? `<fecha_nacimiento>${formatFechaXml(persona.fechaNacimiento)}</fecha_nacimiento>` : ""}
          <pais_nacionalidad>${escapeXml((persona.pais ?? "MX").toUpperCase())}</pais_nacionalidad>
          ${persona.rfc ? `<rfc>${escapeXml(persona.rfc)}</rfc>` : ""}
          ${persona.curp ? `<curp>${escapeXml(persona.curp)}</curp>` : ""}
        </persona_fisica>
      </tipo_persona>`

  const domicilioXml = domicilio
    ? `      <tipo_domicilio>
        <${tipoDomicilio}>
          ${domicilio.colonia ? `<colonia>${escapeXml(domicilio.colonia)}</colonia>` : ""}
          ${domicilio.calle ? `<calle>${escapeXml(domicilio.calle)}</calle>` : ""}
          ${domicilio.numeroExterior ? `<numero_exterior>${escapeXml(domicilio.numeroExterior)}</numero_exterior>` : ""}
          ${domicilio.numeroInterior ? `<numero_interior>${escapeXml(domicilio.numeroInterior)}</numero_interior>` : ""}
          ${domicilio.codigoPostal ? `<codigo_postal>${escapeXml(domicilio.codigoPostal)}</codigo_postal>` : ""}
          ${domicilio.entidad ? `<entidad_federativa>${escapeXml(domicilio.entidad)}</entidad_federativa>` : ""}
          ${domicilio.municipio ? `<municipio>${escapeXml(domicilio.municipio)}</municipio>` : ""}
          ${domicilio.ciudad ? `<ciudad>${escapeXml(domicilio.ciudad)}</ciudad>` : ""}
          ${domicilio.pais ? `<pais>${escapeXml(domicilio.pais.toUpperCase())}</pais>` : ""}
        </${tipoDomicilio}>
      </tipo_domicilio>`
    : ""

  const telefonoXml = telefono
    ? `      <telefono>
        ${claveTelefono ? `<clave_pais>${escapeXml(claveTelefono.toUpperCase())}</clave_pais>` : ""}
        <numero_telefono>${escapeXml(telefono)}</numero_telefono>
      </telefono>`
    : ""

  const beneficiarioXml = beneficiario
    ? `      <dueno_beneficiario>
        <tipo_persona>
          <persona_${beneficiario.tipo === "persona_moral" ? "moral" : "fisica"}>
            <nombre>${escapeXml(beneficiario.nombre ?? "")}</nombre>
            <apellido_paterno>${escapeXml(beneficiario.apellidoPaterno ?? "")}</apellido_paterno>
            <apellido_materno>${escapeXml(beneficiario.apellidoMaterno ?? "")}</apellido_materno>
            ${beneficiario.fechaNacimiento ? `<fecha_nacimiento>${formatFechaXml(beneficiario.fechaNacimiento)}</fecha_nacimiento>` : ""}
            ${beneficiario.rfc ? `<rfc>${escapeXml(beneficiario.rfc)}</rfc>` : ""}
            ${beneficiario.curp ? `<curp>${escapeXml(beneficiario.curp)}</curp>` : ""}
            ${beneficiario.pais ? `<pais_nacionalidad>${escapeXml(beneficiario.pais.toUpperCase())}</pais_nacionalidad>` : ""}
          </persona_${beneficiario.tipo === "persona_moral" ? "moral" : "fisica"}>
        </tipo_persona>
      </dueno_beneficiario>`
    : ""

  const contraparteXml = contraparte
    ? `      <datos_contraparte>
        <tipo_persona>
          <persona_${contraparte.tipo === "persona_moral" ? "moral" : "fisica"}>
            <nombre>${escapeXml(contraparte.nombre ?? "")}</nombre>
            <apellido_paterno>${escapeXml(contraparte.apellidoPaterno ?? "")}</apellido_paterno>
            <apellido_materno>${escapeXml(contraparte.apellidoMaterno ?? "")}</apellido_materno>
            ${contraparte.fechaNacimiento ? `<fecha_nacimiento>${formatFechaXml(contraparte.fechaNacimiento)}</fecha_nacimiento>` : ""}
            ${contraparte.rfc ? `<rfc>${escapeXml(contraparte.rfc)}</rfc>` : ""}
            ${contraparte.pais ? `<pais_nacionalidad>${escapeXml(contraparte.pais.toUpperCase())}</pais_nacionalidad>` : ""}
          </persona_${contraparte.tipo === "persona_moral" ? "moral" : "fisica"}>
        </tipo_persona>
      </datos_contraparte>`
    : ""

  const instrumentoXml = instrumento
    ? `      <contrato_instrumento_publico>
        <datos_instrumento_publico>
          ${instrumento.numero ? `<numero_instrumento_publico>${escapeXml(instrumento.numero)}</numero_instrumento_publico>` : ""}
          ${instrumento.fecha ? `<fecha_instrumento_publico>${formatFechaXml(instrumento.fecha)}</fecha_instrumento_publico>` : ""}
          ${instrumento.notario ? `<notario_instrumento_publico>${escapeXml(instrumento.notario)}</notario_instrumento_publico>` : ""}
          ${instrumento.entidad ? `<entidad_instrumento_publico>${escapeXml(instrumento.entidad)}</entidad_instrumento_publico>` : ""}
          ${instrumento.valorAvaluo ? `<valor_avaluo_catastral>${formatNumberXml(instrumento.valorAvaluo)}</valor_avaluo_catastral>` : ""}
        </datos_instrumento_publico>
      </contrato_instrumento_publico>`
    : ""

  const alertaDescripcionXml = alertaDescripcion
    ? `      <descripcion>${escapeXml(alertaDescripcion)}</descripcion>`
    : ""

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<archivo xmlns="http://www.uif.shcp.gob.mx/recepcion/inm" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.uif.shcp.gob.mx/recepcion/inm inm.xsd">
  <informe>
    <mes_reportado>${escapeXml(periodo)}</mes_reportado>
    <sujeto_obligado>
      <clave_sujeto_obligado>${escapeXml(claveSujeto)}</clave_sujeto_obligado>
      <clave_actividad>${escapeXml(claveActividad)}</clave_actividad>
    </sujeto_obligado>
    <aviso>
      <referencia_aviso>${escapeXml(referencia)}</referencia_aviso>
      <prioridad>${escapeXml(prioridad)}</prioridad>
      <alerta>
        <tipo_alerta>${escapeXml(alertaTipo)}</tipo_alerta>
${alertaDescripcionXml ? `        ${alertaDescripcionXml}\n` : ""}      </alerta>
      <persona_aviso>
${personaXml}\n${domicilioXml ? `${domicilioXml}\n` : ""}${telefonoXml ? `${telefonoXml}\n` : ""}      </persona_aviso>
${beneficiarioXml ? `${beneficiarioXml}\n` : ""}      <detalle_operaciones>
        <datos_operacion>
          <fecha_operacion>${formatFechaXml(operacion.fechaOperacion)}</fecha_operacion>
          <tipo_operacion>${escapeXml(inmueble.codigoOperacion)}</tipo_operacion>
          <figura_cliente>${escapeXml(operacion.figuraCliente ?? "")}</figura_cliente>
          <figura_so>${escapeXml(operacion.figuraSujetoObligado ?? "")}</figura_so>
${contraparteXml ? `${contraparteXml}\n` : ""}          <caracteristicas_inmueble>
            <tipo_inmueble>${escapeXml(tipoInmuebleCodigo)}</tipo_inmueble>
            ${inmueble.ciudad ? `<ciudad>${escapeXml(inmueble.ciudad)}</ciudad>` : ""}
            <valor_pactado>${formatNumberXml(operacion.monto)}</valor_pactado>
            ${inmueble.colonia ? `<colonia>${escapeXml(inmueble.colonia)}</colonia>` : ""}
            ${inmueble.calle ? `<calle>${escapeXml(inmueble.calle)}</calle>` : ""}
            ${inmueble.numeroExterior ? `<numero_exterior>${escapeXml(inmueble.numeroExterior)}</numero_exterior>` : ""}
            ${inmueble.numeroInterior ? `<numero_interior>${escapeXml(inmueble.numeroInterior)}</numero_interior>` : ""}
            ${inmueble.codigoPostal ? `<codigo_postal>${escapeXml(inmueble.codigoPostal)}</codigo_postal>` : ""}
            ${inmueble.valorAvaluo ? `<valor_avaluo>${formatNumberXml(inmueble.valorAvaluo)}</valor_avaluo>` : ""}
            ${inmueble.folioReal ? `<folio_real>${escapeXml(inmueble.folioReal)}</folio_real>` : ""}
          </caracteristicas_inmueble>
${instrumentoXml ? `${instrumentoXml}\n` : ""}          <datos_liquidacion>
            <fecha_pago>${formatFechaXml(liquidacion.fechaPago)}</fecha_pago>
            <forma_pago>${escapeXml(liquidacion.formaPago)}</forma_pago>
            <instrumento_monetario>${escapeXml(liquidacion.instrumento)}</instrumento_monetario>
            <moneda>${escapeXml(liquidacion.moneda)}</moneda>
            <monto_operacion>${formatNumberXml(liquidacion.monto)}</monto_operacion>
          </datos_liquidacion>
        </datos_operacion>
      </detalle_operaciones>
    </aviso>
  </informe>
</archivo>`

  return xml
}

const exportarXml = (operacion: OperacionCliente) => {
  if (operacion.actividadKey === ACTIVIDAD_INMUEBLES_KEY) {
    const xmlInmueble = generarXmlInmueble(operacion)
    if (xmlInmueble) {
      descargarXml(xmlInmueble, `aviso-inmuebles-${operacion.periodo}-${operacion.rfc}.xml`)
      toast({
        title: "XML de inmuebles generado",
        description: "Se descargó el archivo con la estructura del portal del SAT.",
      })
      return
    }
  }

  const xmlBasico = `<?xml version="1.0" encoding="UTF-8"?>\n<avisoPLD>\n  <periodo>${escapeXml(operacion.periodo)}</periodo>\n  <actividad>${escapeXml(operacion.actividadKey)}</actividad>\n  <claveActividad>${escapeXml(operacion.actividadKey.toUpperCase())}</claveActividad>\n  <sujetoObligado>${escapeXml(operacion.rfc)}</sujetoObligado>\n  <cliente>\n    <nombre>${escapeXml(operacion.cliente)}</nombre>\n    <tipoCliente>${escapeXml(operacion.tipoCliente)}</tipoCliente>\n    <mismoGrupo>${operacion.mismoGrupo ? "SI" : "NO"}</mismoGrupo>\n  </cliente>\n  <operacion>\n    <fecha>${escapeXml(operacion.fechaOperacion)}</fecha>\n    <monto moneda=\"${escapeXml(operacion.moneda)}\">${formatNumberXml(operacion.monto)}</monto>\n    <tipo>${escapeXml(operacion.tipoOperacion)}</tipo>\n    <evidencia>${escapeXml(operacion.evidencia)}</evidencia>\n  </operacion>\n</avisoPLD>`

  descargarXml(xmlBasico, `aviso-${operacion.periodo}-${operacion.rfc}.xml`)

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
  if (MONEDAS.some((item) => item.value === operacion.moneda)) {
    setMoneda(operacion.moneda)
    setMonedaPersonalizadaCodigo("")
    setMonedaPersonalizadaDescripcion("")
  } else {
    setMoneda("OTRA")
    setMonedaPersonalizadaCodigo(operacion.moneda)
    const descripcion = operacion.monedaDescripcion.split(" – ")[1] ?? ""
    setMonedaPersonalizadaDescripcion(descripcion)
  }
  setFechaOperacion(new Date().toISOString().substring(0, 10))
  setEvidencia(operacion.evidencia)
  setMontoOperacion("")
  setReferenciaAviso(operacion.referenciaAviso ?? "")
  setAlertaCodigo(operacion.alertaCodigo ?? ALERTA_DEFAULT)
  setAlertaDescripcion(operacion.alertaDescripcion ?? "")
  setPrioridadAviso(operacion.prioridadAviso ?? PRIORIDAD_DEFAULT)
  setClaveSujetoObligado(operacion.claveSujetoObligado ?? "")
  setClaveActividad(operacion.claveActividadVulnerable ?? "")
  setCodigoOperacionInmueble(operacion.inmueble?.codigoOperacion ?? "")
  setFiguraClienteInmueble(operacion.figuraCliente ?? "")
  setFiguraSujetoObligadoInmueble(operacion.figuraSujetoObligado ?? "")
  setInmuebleForm(
    operacion.inmueble
      ? {
          fechaInicio: operacion.inmueble.fechaInicio,
          fechaFin: operacion.inmueble.fechaFin,
          tipoInmueble: operacion.inmueble.tipoInmueble,
          valorAvaluo: operacion.inmueble.valorAvaluo,
          folioReal: operacion.inmueble.folioReal,
          pais: operacion.inmueble.pais,
          entidad: operacion.inmueble.entidad,
          municipio: operacion.inmueble.municipio,
          ciudad: operacion.inmueble.ciudad ?? "",
          colonia: operacion.inmueble.colonia,
          codigoPostal: operacion.inmueble.codigoPostal,
          calle: operacion.inmueble.calle,
          numeroExterior: operacion.inmueble.numeroExterior,
          numeroInterior: operacion.inmueble.numeroInterior ?? "",
        }
      : { ...INMUEBLE_FORM_DEFAULT },
  )
  setLiquidacionForm(
    operacion.liquidacion
      ? {
          fechaPago: operacion.liquidacion.fechaPago,
          formaPago: operacion.liquidacion.formaPago,
          instrumento: operacion.liquidacion.instrumento,
        }
      : { ...LIQUIDACION_FORM_DEFAULT },
  )
  setBeneficiarioForm(
    operacion.beneficiario
      ? {
          tipo: operacion.beneficiario.tipo,
          nombre: operacion.beneficiario.nombre ?? "",
          apellidoPaterno: operacion.beneficiario.apellidoPaterno ?? "",
          apellidoMaterno: operacion.beneficiario.apellidoMaterno ?? "",
          fechaNacimiento: operacion.beneficiario.fechaNacimiento ?? "",
          rfc: operacion.beneficiario.rfc ?? "",
          curp: operacion.beneficiario.curp ?? "",
          pais: operacion.beneficiario.pais ?? "MX",
        }
      : { ...BENEFICIARIO_FORM_DEFAULT },
  )
  setContraparteForm(
    operacion.contraparte
      ? {
          tipo: operacion.contraparte.tipo,
          nombre: operacion.contraparte.nombre ?? "",
          apellidoPaterno: operacion.contraparte.apellidoPaterno ?? "",
          apellidoMaterno: operacion.contraparte.apellidoMaterno ?? "",
          fechaNacimiento: operacion.contraparte.fechaNacimiento ?? "",
          rfc: operacion.contraparte.rfc ?? "",
          pais: operacion.contraparte.pais ?? "MX",
        }
      : { ...CONTRAPARTE_FORM_DEFAULT },
  )
  setInstrumentoForm(
    operacion.instrumento
      ? {
          numero: operacion.instrumento.numero,
          fecha: operacion.instrumento.fecha,
          notario: operacion.instrumento.notario,
          entidad: operacion.instrumento.entidad,
          valorAvaluo: operacion.instrumento.valorAvaluo,
        }
      : { ...INSTRUMENTO_FORM_DEFAULT },
  )
  if (operacion.inmueble?.codigoPostal) {
    const info = findCodigoPostalInfo(operacion.inmueble.codigoPostal)
    setColoniasDisponibles(info?.asentamientos ?? [])
  } else {
    setColoniasDisponibles([])
  }
  if (operacion.expedienteReferenciado) {
    setExpedienteSeleccionado(operacion.expedienteReferenciado)
  }
  if (operacion.personaExpedienteId) {
    setPersonaExpedienteSeleccionada(operacion.personaExpedienteId)
  }
  if (operacion.personaAviso) {
    setPersonaAvisoActual(operacion.personaAviso)
  }
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
              Registro de actos y operaciones
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">Tablero operativo de Registro de actos y operaciones</h1>
            <p className="text-sm text-slate-600">
              Organiza la consulta de expedientes de identificación, la creación de nuevos expedientes y la captura mensual de actos u operaciones con los sujetos obligados y clientes registrados.
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-600" /> Registro de actos y operaciones
              </CardTitle>
              <CardDescription>
                Reestructura el módulo en dos opciones: consulta de expedientes de identificación existentes o creación de un
                nuevo expediente antes de capturar operaciones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={registroModo} onValueChange={(value) => setRegistroModo(value as "consulta" | "nuevo")}
                className="space-y-4"
              >
                <TabsList className="grid w-full gap-2 rounded-xl bg-emerald-50 p-1 sm:grid-cols-2">
                  <TabsTrigger value="consulta" className="text-sm">Opción 1: Consulta expediente de identificación</TabsTrigger>
                  <TabsTrigger value="nuevo" className="text-sm">Opción 2: Crear nuevo expediente</TabsTrigger>
                </TabsList>

                <TabsContent value="consulta" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>¿Quién es el sujeto obligado?</Label>
                      <Select value={sujetoConsulta} onValueChange={setSujetoConsulta}>
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Selecciona un sujeto obligado" />
                        </SelectTrigger>
                        <SelectContent>
                          {sujetosObligadosDisponibles.length > 0 ? (
                            sujetosObligadosDisponibles.map((opcion) => (
                              <SelectItem key={opcion.value} value={opcion.value}>
                                {opcion.label}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-muted-foreground">Sin expedientes cargados</div>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Confirma si ya existe un expediente dado de alta antes de continuar con la captura.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Expediente de identificación</Label>
                      <Select
                        value={expedienteConsultaId ?? ""}
                        onValueChange={(valor) => setExpedienteConsultaId(valor)}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Selecciona un expediente" />
                        </SelectTrigger>
                        <SelectContent>
                          {expedientesDisponibles.length > 0 ? (
                            expedientesDisponibles.map((expediente) => (
                              <SelectItem key={expediente.rfc} value={expediente.rfc}>
                                {expediente.nombre ?? expediente.rfc}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-muted-foreground">No hay expedientes en memoria</div>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Consulta el expediente antes de registrar actos u operaciones.</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Documentos y datos a requerir (Anexo 3)</Label>
                      <ScrollArea className="h-24 rounded border bg-slate-50 p-3 text-xs text-slate-700">
                        <ul className="space-y-1 list-disc pl-4">
                          <li>Identificación oficial vigente del cliente y del representante.</li>
                          <li>Comprobantes de domicilio y datos de contacto.</li>
                          <li>Información fiscal y perfil transaccional declarado.</li>
                          <li>Documentos que acrediten la actividad vulnerable registrada.</li>
                        </ul>
                      </ScrollArea>
                    </div>
                    <div className="space-y-2">
                      <Label>Cargar identificación del sujeto obligado</Label>
                      <Input type="file" className="bg-white" />
                      <p className="text-xs text-muted-foreground">Carga rápida de la identificación para mantener el expediente completo.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                    <Checkbox
                      id="relacion-negocios"
                      checked={relacionNegocios}
                      onCheckedChange={(valor) => setRelacionNegocios(Boolean(valor))}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="relacion-negocios">¿La actividad vulnerable constituye una relación de negocios?</Label>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>Si es afirmativa, se debe actualizar el expediente al menos una vez al año.</span>
                        <Button variant="link" className="h-auto p-0 text-emerald-700" onClick={() => setRelacionNegociosOpen(true)}>
                          ¿Qué es relación de negocios?
                        </Button>
                      </div>
                      {relacionNegocios && (
                        <p className="text-xs text-emerald-700">
                          Fecha de alta conocida: {fechaBaseConsulta ?? fechaBaseExpediente ?? "Sin registrar"}. Próxima revisión:
                          {" "}
                          {siguienteRevisionAnual ?? "programar actualización anual"}.
                        </p>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="nuevo" className="space-y-4">
                  <p className="text-sm text-slate-700">
                    Crea un nuevo expediente de identificación antes de capturar operaciones. Este módulo te guía para reunir los
                    documentos del anexo 3 y vincular la actividad vulnerable correspondiente.
                  </p>
                  <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-semibold">Pasos sugeridos</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-4">
                      <li>Define el sujeto obligado responsable y selecciona la fracción aplicable.</li>
                      <li>Integra la documentación de identificación y datos fiscales del cliente.</li>
                      <li>Confirma si existe relación de negocios y establece la vigencia anual.</li>
                    </ol>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button asChild>
                      <Link href="/kyc-expediente">Crear expediente de identificación</Link>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setTabActiva("captura")
                        setPasoActual(0)
                      }}
                    >
                      Continuar a la captura guiada
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-emerald-600" /> Capturar operaciones del mes
              </CardTitle>
              <CardDescription>
                Define el sujeto obligado que reportará, el cliente relacionado y limita las actividades vulnerables a las que ya
                están vinculados en el expediente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>¿Qué sujeto obligado va a capturar la operación?</Label>
                  <Select
                    value={sujetoObligadoOperacion}
                    onValueChange={(value) => {
                      setSujetoObligadoOperacion(value)
                      setClienteOperacionSeleccionado("")
                    }}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Selecciona un sujeto obligado" />
                    </SelectTrigger>
                    <SelectContent>
                      {sujetosObligadosDisponibles.length > 0 ? (
                        sujetosObligadosDisponibles.map((opcion) => (
                          <SelectItem key={opcion.value} value={opcion.value}>
                            {opcion.label}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Carga un expediente primero</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Selecciona al cliente del sujeto obligado</Label>
                  <Select value={clienteOperacionSeleccionado} onValueChange={setClienteOperacionSeleccionado}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Elige un cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientesPorSujetoObligado.length > 0 ? (
                        clientesPorSujetoObligado.map((cliente) => (
                          <SelectItem key={cliente.value} value={cliente.value}>
                            {cliente.label}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Sin clientes vinculados</div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>¿Respecto de qué actividad vulnerable vas a registrar la operación?</Label>
                  <Select
                    value={actividadOperacionSeleccionada}
                    onValueChange={setActividadOperacionSeleccionada}
                    disabled={actividadesRegistradasCliente.length === 0}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Actividad vinculada en expediente" />
                    </SelectTrigger>
                    <SelectContent>
                      {actividadesRegistradasCliente.length > 0 ? (
                        actividadesRegistradasCliente.map((actividad) => (
                          <SelectItem key={actividad.key} value={actividad.key}>
                            {actividad.fraccion} – {actividad.nombre}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Solo aparecen actividades registradas en el expediente del cliente.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>¿Con qué cliente realizaste la operación?</Label>
                  <Input
                    value={
                      clienteOperacionSeleccionado
                        ? clientesPorSujetoObligado.find((cliente) => cliente.value === clienteOperacionSeleccionado)?.label ?? ""
                        : ""
                    }
                    readOnly
                    placeholder="Cliente seleccionado"
                  />
                  <p className="text-xs text-muted-foreground">La selección proviene del expediente activo del sujeto obligado.</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Año de la operación</Label>
                  <Select value={anioOperacionCaptura.toString()} onValueChange={(value) => setAnioOperacionCaptura(Number(value))}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Selecciona año" />
                    </SelectTrigger>
                    <SelectContent>
                      {(availableYears.length > 0 ? availableYears : [anioOperacionCaptura]).map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mes al que corresponde la operación</Label>
                  <Select value={mesOperacionCaptura.toString()} onValueChange={(value) => setMesOperacionCaptura(Number(value))}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Selecciona mes" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((mes, index) => (
                        <SelectItem key={mes} value={(index + 1).toString()}>
                          {mes}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold">Vista previa antes de enviar</p>
                <p>
                  Cliente: {clienteOperacionSeleccionado
                    ? clientesPorSujetoObligado.find((cliente) => cliente.value === clienteOperacionSeleccionado)?.label ?? "Pendiente"
                    : "Pendiente"}
                </p>
                <p>
                  Actividad vulnerable: {actividadOperacionDetalle
                    ? `${actividadOperacionDetalle.fraccion} – ${actividadOperacionDetalle.nombre}`
                    : "Selecciona una actividad registrada"}
                </p>
                <p>
                  Periodo: {MONTHS[mesOperacionCaptura - 1]} {anioOperacionCaptura}. Sujeto obligado: {" "}
                  {sujetoObligadoOperacion || "sin definir"}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    if (actividadOperacionDetalle) {
                      setActividadKey(actividadOperacionDetalle.key)
                      setActividadInfoKey(actividadOperacionDetalle.key)
                    }
                    setAnioSeleccionado(anioOperacionCaptura)
                    setMesSeleccionado(mesOperacionCaptura)
                    setTabActiva("captura")
                    setPasoActual(0)
                  }}
                  disabled={!clienteOperacionSeleccionado || !actividadOperacionDetalle}
                >
                  Sincronizar con la captura guiada
                </Button>
                <p className="text-xs text-muted-foreground">
                  Solo se muestran actividades vulnerables registradas en el expediente del cliente.
                </p>
              </div>
            </CardContent>
          </Card>

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
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={cargarDemoFraccionXV}>
                    Cargar demo Fracción XV
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={limpiarFormulario}>
                    Limpiar campos
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Actividad vulnerable</Label>
                    <Select
                      value={actividadKey}
                      onValueChange={(value) => {
                        setActividadKey(value)
                        setActividadInfoKey(value)
                      }}
                      onOpenChange={(open) => {
                        if (open) {
                          setBusquedaActividad("")
                        }
                      }}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecciona una actividad" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <Input
                            autoFocus
                            placeholder="Buscar actividad..."
                            value={busquedaActividad}
                            onChange={(event) => setBusquedaActividad(event.target.value)}
                          />
                        </div>
                        {actividadesFiltradas.length > 0 ? (
                          actividadesFiltradas.map((actividad) => (
                            <SelectItem key={actividad.key} value={actividad.key}>
                              {actividad.fraccion} – {actividad.nombre}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            Sin coincidencias
                          </div>
                        )}
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
                <div className="rounded border border-emerald-200 bg-emerald-50/40 p-4 space-y-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">Vincula expediente único</p>
                      <p className="text-xs text-emerald-700">
                        Reutiliza los datos capturados en el expediente para agilizar el cuestionario del aviso.
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="w-fit border-emerald-200 bg-white text-[11px] uppercase tracking-wide text-emerald-700"
                    >
                      {expedientesDisponibles.length > 0
                        ? `${expedientesDisponibles.length} expediente${
                            expedientesDisponibles.length === 1 ? "" : "s"
                          } disponibles`
                        : "Sin expedientes sincronizados"}
                    </Badge>
                  </div>

                  {expedientesDisponibles.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Expediente relacionado</Label>
                        <Select
                          value={expedienteSeleccionado ?? ""}
                          onValueChange={(value) => {
                            if (value === MANUAL_EXPEDIENTE_VALUE) {
                              setExpedienteSeleccionado(null)
                              setPersonaExpedienteSeleccionada("")
                              setPersonaAvisoActual(null)
                              return
                            }

                            setExpedienteSeleccionado(value)
                          }}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecciona expediente" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={MANUAL_EXPEDIENTE_VALUE}>Capturar manualmente</SelectItem>
                            {expedientesDisponibles.map((expediente) => (
                              <SelectItem key={expediente.rfc} value={expediente.rfc}>
                                {expediente.nombre ?? expediente.rfc}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {expedienteSeleccionado && personasExpedienteOpciones.length > 0 && (
                        <div className="space-y-2">
                          <Label>Persona reportada del expediente</Label>
                          <Select
                            value={personaExpedienteSeleccionada}
                            onValueChange={(value) => setPersonaExpedienteSeleccionada(value)}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Selecciona persona" />
                            </SelectTrigger>
                            <SelectContent>
                              {personasExpedienteOpciones.map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded border border-dashed border-emerald-200 bg-white p-4 text-xs text-emerald-700">
                      {expedientesListo
                        ? "Aún no se han guardado expedientes en el módulo correspondiente. Captura manualmente los datos del cliente."
                        : "Sincronizando expedientes guardados…"}
                    </div>
                  )}

                  {personaAvisoActual && (
                    <div className="rounded border border-emerald-100 bg-white p-3 text-xs text-slate-700">
                      <p className="font-semibold text-emerald-700">Datos recuperados del expediente</p>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <p>
                          <span className="font-semibold">Nombre o razón social:</span>{" "}
                          {personaAvisoActual.tipo === "persona_moral"
                            ? personaAvisoActual.denominacion ?? "Sin denominación"
                            : [
                                personaAvisoActual.nombre,
                                personaAvisoActual.apellidoPaterno,
                                personaAvisoActual.apellidoMaterno,
                              ]
                                .filter((parte) => typeof parte === "string" && parte.trim().length > 0)
                                .join(" ") || "Sin nombre registrado"}
                        </p>
                        <p>
                          <span className="font-semibold">RFC:</span> {personaAvisoActual.rfc ?? expedienteActual?.rfc ?? "Sin RFC"}
                        </p>
                        <p>
                          <span className="font-semibold">País de nacionalidad:</span>{" "}
                          {personaAvisoActual.pais
                            ? findPaisByCodigo(personaAvisoActual.pais)?.label ?? personaAvisoActual.pais
                            : "No especificado"}
                        </p>
                        <p>
                          <span className="font-semibold">Código postal:</span>{" "}
                          {personaAvisoActual.domicilio?.codigoPostal ?? "Sin domicilio"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

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
                            value={detalleTipoCliente}
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
                        onOpenChange={(open) => {
                          if (open) {
                            setBusquedaClienteGuardado("")
                          }
                        }}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Selecciona un cliente guardado" />
                        </SelectTrigger>
                        <SelectContent>
                          <div className="p-2">
                            <Input
                              autoFocus
                              placeholder="Buscar cliente..."
                              value={busquedaClienteGuardado}
                              onChange={(event) => setBusquedaClienteGuardado(event.target.value)}
                            />
                          </div>
                          {clientesGuardadosFiltrados.length > 0 ? (
                            clientesGuardadosFiltrados.map((cliente) => (
                              <SelectItem key={cliente.rfc} value={cliente.rfc}>
                                {cliente.nombre} ({cliente.rfc}
                                {cliente.detalleTipoCliente ? ` – ${cliente.detalleTipoCliente}` : ""})
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              Sin coincidencias
                            </div>
                          )}
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
                    {esActividadInmuebles ? (
                      <div className="space-y-2">
                        <Select
                          value={codigoOperacionInmueble}
                          onValueChange={(value) => {
                            setCodigoOperacionInmueble(value)
                            if (value === "otro") {
                              setTipoOperacion("")
                              return
                            }
                            const operacionSeleccionada = INMUEBLE_OPERACIONES.find(
                              (operacion) => operacion.value === value,
                            )
                            setTipoOperacion(operacionSeleccionada?.label ?? "")
                          }}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecciona código UIF" />
                          </SelectTrigger>
                          <SelectContent>
                            {INMUEBLE_OPERACIONES.map((operacion) => (
                              <SelectItem key={operacion.value} value={operacion.value}>
                                {operacion.label}
                              </SelectItem>
                            ))}
                            <SelectItem value="otro">Otra operación (especificar)</SelectItem>
                          </SelectContent>
                        </Select>
                        {codigoOperacionInmueble === "otro" && (
                          <Input
                            placeholder="Describe la operación"
                            value={tipoOperacion}
                            onChange={(event) => setTipoOperacion(event.target.value)}
                          />
                        )}
                        {codigoOperacionInmueble && codigoOperacionInmueble !== "otro" && (
                          <p className="text-[11px] text-muted-foreground">
                            Se utilizará el código {codigoOperacionInmueble} al generar el archivo XML para la UIF.
                          </p>
                        )}
                      </div>
                    ) : (
                      <Input
                        placeholder="Ejemplo: Compra de inmueble"
                        value={tipoOperacion}
                        onChange={(event) => setTipoOperacion(event.target.value)}
                      />
                    )}
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
                        {MONEDAS.map((item) => (
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

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Clave del sujeto obligado</Label>
                    <Input
                      placeholder="Ejemplo: OGA751212G56"
                      value={claveSujetoObligado}
                      onChange={(event) => setClaveSujetoObligado(event.target.value.toUpperCase())}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Refiere a la clave asignada por la UIF en el padrón de actividades vulnerables.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Clave de actividad vulnerable</Label>
                    <Input
                      placeholder="Ejemplo: INM"
                      value={claveActividad}
                      onChange={(event) => setClaveActividad(event.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Referencia interna del aviso</Label>
                    <Input
                      placeholder="Folio o referencia del aviso"
                      value={referenciaAviso}
                      onChange={(event) => setReferenciaAviso(event.target.value.toUpperCase())}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Prioridad del aviso</Label>
                    <Select value={prioridadAviso} onValueChange={(value) => setPrioridadAviso(value)}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecciona prioridad" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORIDAD_AVISO_OPCIONES.map((opcion) => (
                          <SelectItem key={opcion.value} value={opcion.value}>
                            {opcion.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de alerta</Label>
                    <Select
                      value={alertaCodigo}
                      onValueChange={(value) => {
                        setAlertaCodigo(value)
                        if (value === ALERTA_DEFAULT) {
                          setAlertaDescripcion("")
                        }
                      }}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecciona tipo de alerta" />
                      </SelectTrigger>
                      <SelectContent>
                        {ALERTA_TIPOS.map((alerta) => (
                          <SelectItem key={alerta.value} value={alerta.value}>
                            {alerta.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-3">
                    <Label>Descripción de la alerta (opcional)</Label>
                    <Textarea
                      placeholder="Describe el motivo de la alerta o contexto adicional"
                      value={alertaDescripcion}
                      onChange={(event) => setAlertaDescripcion(event.target.value)}
                      disabled={alertaCodigo === ALERTA_DEFAULT}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Se incorporará al XML cuando selecciones un tipo de alerta distinto de "Sin alerta".
                    </p>
                  </div>
                </div>

                {esActividadInmuebles && (
                  <div className="space-y-6">
                    <div className="rounded border bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Building2 className="h-5 w-5 text-emerald-600" />
                        <h4 className="text-sm font-semibold">Datos del inmueble reportado</h4>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Registra la ubicación y características del inmueble objeto del contrato de uso o goce.
                      </p>

                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Figura del cliente</Label>
                          <Select
                            value={figuraClienteInmueble}
                            onValueChange={(value) => setFiguraClienteInmueble(value)}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Selecciona figura" />
                            </SelectTrigger>
                            <SelectContent>
                              {FIGURA_CLIENTE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Figura del sujeto obligado</Label>
                          <Select
                            value={figuraSujetoObligadoInmueble}
                            onValueChange={(value) => setFiguraSujetoObligadoInmueble(value)}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Selecciona figura" />
                            </SelectTrigger>
                            <SelectContent>
                              {FIGURA_SUJETO_OBLIGADO_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Tipo de inmueble</Label>
                          <Select
                            value={inmuebleForm.tipoInmueble}
                            onValueChange={(value) => actualizarInmuebleForm("tipoInmueble", value)}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Selecciona tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              {TIPO_INMUEBLE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Fecha de inicio del arrendamiento</Label>
                          <Input
                            type="date"
                            value={inmuebleForm.fechaInicio}
                            onChange={(event) => actualizarInmuebleForm("fechaInicio", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Fecha de término del arrendamiento</Label>
                          <Input
                            type="date"
                            value={inmuebleForm.fechaFin}
                            onChange={(event) => actualizarInmuebleForm("fechaFin", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Valor avalúo o catastral</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={inmuebleForm.valorAvaluo}
                            onChange={(event) => actualizarInmuebleForm("valorAvaluo", event.target.value)}
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Folio real o antecedentes registrales</Label>
                          <Input
                            placeholder="Número de folio real"
                            value={inmuebleForm.folioReal}
                            onChange={(event) => actualizarInmuebleForm("folioReal", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>País</Label>
                          <Select
                            value={inmuebleForm.pais}
                            onValueChange={(value) => actualizarInmuebleForm("pais", value)}
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
                          <Label>Entidad federativa</Label>
                          <Input
                            placeholder="Estado o provincia"
                            value={inmuebleForm.entidad}
                            onChange={(event) => actualizarInmuebleForm("entidad", event.target.value)}
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Municipio o delegación</Label>
                          <Input
                            placeholder="Municipio"
                            value={inmuebleForm.municipio}
                            onChange={(event) => actualizarInmuebleForm("municipio", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Ciudad</Label>
                          {inmuebleForm.pais === "MX" ? (
                            <Select
                              value={inmuebleForm.ciudad}
                              onValueChange={(value) => actualizarInmuebleForm("ciudad", value)}
                              onOpenChange={(open) => {
                                if (open) {
                                  setBusquedaCiudadInmueble("")
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
                                    value={busquedaCiudadInmueble}
                                    onChange={(event) => setBusquedaCiudadInmueble(event.target.value)}
                                  />
                                </div>
                                {ciudadesFiltradasInmueble.length > 0 ? (
                                  ciudadesFiltradasInmueble.map((ciudad) => (
                                    <SelectItem key={ciudad} value={ciudad}>
                                      {ciudad}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="px-3 py-2 text-sm text-muted-foreground">
                                    Sin coincidencias
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              placeholder="Ciudad"
                              value={inmuebleForm.ciudad}
                              onChange={(event) => actualizarInmuebleForm("ciudad", event.target.value)}
                            />
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label>Código postal</Label>
                          <Input
                            placeholder="Ejemplo: 66260"
                            inputMode="numeric"
                            maxLength={5}
                            value={inmuebleForm.codigoPostal}
                            onChange={(event) => {
                              const value = event.target.value.replace(/\D/g, "")
                              actualizarInmuebleForm("codigoPostal", value)
                            }}
                          />
                          <p className="text-[11px] text-muted-foreground">
                            Completa los 5 dígitos para autocompletar entidad, municipio y colonias registradas.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label>Colonia o asentamiento</Label>
                          {coloniasDisponibles.length > 0 ? (
                            <Select
                              value={inmuebleForm.colonia}
                              onValueChange={(value) => actualizarInmuebleForm("colonia", value)}
                              onOpenChange={(open) => {
                                if (open) {
                                  setBusquedaColoniaInmueble("")
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
                                    value={busquedaColoniaInmueble}
                                    onChange={(event) => setBusquedaColoniaInmueble(event.target.value)}
                                  />
                                </div>
                                {coloniasFiltradasInmueble.length > 0 ? (
                                  coloniasFiltradasInmueble.map((colonia) => (
                                    <SelectItem key={colonia} value={colonia}>
                                      {colonia}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <div className="px-3 py-2 text-sm text-muted-foreground">
                                    Sin coincidencias
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              placeholder="Colonia o asentamiento"
                              value={inmuebleForm.colonia}
                              onChange={(event) => actualizarInmuebleForm("colonia", event.target.value)}
                            />
                          )}
                          <p className="text-[11px] text-muted-foreground">
                            {inmuebleForm.codigoPostal.length === 5
                              ? coloniasDisponibles.length > 0
                                ? "Selecciona una colonia del catálogo del SEPOMEX."
                                : "No encontramos colonias para este código postal, captura manualmente."
                              : "Ingresa el código postal para mostrar el catálogo de colonias."}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Calle, avenida o vía</Label>
                          <Input
                            placeholder="Nombre de la calle"
                            value={inmuebleForm.calle}
                            onChange={(event) => actualizarInmuebleForm("calle", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Número exterior</Label>
                          <Input
                            placeholder="Número exterior"
                            value={inmuebleForm.numeroExterior}
                            onChange={(event) => actualizarInmuebleForm("numeroExterior", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Número interior</Label>
                          <Input
                            placeholder="Número interior (opcional)"
                            value={inmuebleForm.numeroInterior}
                            onChange={(event) => actualizarInmuebleForm("numeroInterior", event.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded border bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Layers className="h-5 w-5 text-emerald-600" />
                        <h4 className="text-sm font-semibold">Datos de la liquidación</h4>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Define la fecha y forma en que se liquidó la contraprestación del contrato.
                      </p>
                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Fecha de pago</Label>
                          <Input
                            type="date"
                            value={liquidacionForm.fechaPago}
                            onChange={(event) => actualizarLiquidacionForm("fechaPago", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Forma de pago</Label>
                          <Select
                            value={liquidacionForm.formaPago}
                            onValueChange={(value) => actualizarLiquidacionForm("formaPago", value)}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Selecciona forma" />
                            </SelectTrigger>
                            <SelectContent>
                              {FORMA_PAGO_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Instrumento monetario utilizado</Label>
                          <Select
                            value={liquidacionForm.instrumento}
                            onValueChange={(value) => actualizarLiquidacionForm("instrumento", value)}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Selecciona instrumento" />
                            </SelectTrigger>
                            <SelectContent>
                              {INSTRUMENTO_MONETARIO_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        El monto y la moneda se tomarán de los campos generales capturados arriba.
                      </p>
                    </div>

                    <div className="rounded border bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Users className="h-5 w-5 text-emerald-600" />
                        <h4 className="text-sm font-semibold">Beneficiario controlador o dueño beneficiario</h4>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Identifica a la persona que obtiene el beneficio o ejerce control sobre la persona reportada.
                      </p>
                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Tipo de persona</Label>
                          <Select
                            value={beneficiarioForm.tipo}
                            onValueChange={(value) =>
                              actualizarBeneficiarioForm(
                                "tipo",
                                value as BeneficiarioFormState["tipo"],
                              )
                            }
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Selecciona tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="persona_fisica">Persona física</SelectItem>
                              <SelectItem value="persona_moral">Persona moral</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>
                            {beneficiarioForm.tipo === "persona_moral"
                              ? "Denominación o razón social"
                              : "Nombre(s)"}
                          </Label>
                          <Input
                            placeholder={
                              beneficiarioForm.tipo === "persona_moral"
                                ? "Nombre completo de la persona moral"
                                : "Nombre(s)"
                            }
                            value={beneficiarioForm.nombre}
                            onChange={(event) => actualizarBeneficiarioForm("nombre", event.target.value)}
                          />
                        </div>
                        {beneficiarioForm.tipo === "persona_fisica" && (
                          <>
                            <div className="space-y-2">
                              <Label>Apellido paterno</Label>
                              <Input
                                value={beneficiarioForm.apellidoPaterno}
                                onChange={(event) =>
                                  actualizarBeneficiarioForm("apellidoPaterno", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Apellido materno</Label>
                              <Input
                                value={beneficiarioForm.apellidoMaterno}
                                onChange={(event) =>
                                  actualizarBeneficiarioForm("apellidoMaterno", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Fecha de nacimiento</Label>
                              <Input
                                type="date"
                                value={beneficiarioForm.fechaNacimiento}
                                onChange={(event) =>
                                  actualizarBeneficiarioForm("fechaNacimiento", event.target.value)
                                }
                              />
                            </div>
                          </>
                        )}
                        <div className="space-y-2">
                          <Label>RFC</Label>
                          <Input
                            value={beneficiarioForm.rfc}
                            onChange={(event) =>
                              actualizarBeneficiarioForm("rfc", event.target.value.toUpperCase())
                            }
                          />
                        </div>
                        {beneficiarioForm.tipo === "persona_fisica" && (
                          <div className="space-y-2">
                            <Label>CURP</Label>
                            <Input
                              value={beneficiarioForm.curp}
                              onChange={(event) =>
                                actualizarBeneficiarioForm("curp", event.target.value.toUpperCase())
                              }
                            />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>País de nacionalidad</Label>
                          <Select
                            value={beneficiarioForm.pais}
                            onValueChange={(value) => actualizarBeneficiarioForm("pais", value)}
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
                      </div>
                    </div>

                    <div className="rounded border bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700">
                        <ShieldAlert className="h-5 w-5 text-emerald-600" />
                        <h4 className="text-sm font-semibold">Datos de la contraparte</h4>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Captura la información de la persona que actúa como contraparte en la operación de arrendamiento.
                      </p>
                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Tipo de persona</Label>
                          <Select
                            value={contraparteForm.tipo}
                            onValueChange={(value) =>
                              actualizarContraparteForm("tipo", value as ContraparteFormState["tipo"])
                            }
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Selecciona tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="persona_fisica">Persona física</SelectItem>
                              <SelectItem value="persona_moral">Persona moral</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>
                            {contraparteForm.tipo === "persona_moral"
                              ? "Denominación o razón social"
                              : "Nombre(s)"}
                          </Label>
                          <Input
                            value={contraparteForm.nombre}
                            onChange={(event) => actualizarContraparteForm("nombre", event.target.value)}
                          />
                        </div>
                        {contraparteForm.tipo === "persona_fisica" && (
                          <>
                            <div className="space-y-2">
                              <Label>Apellido paterno</Label>
                              <Input
                                value={contraparteForm.apellidoPaterno}
                                onChange={(event) =>
                                  actualizarContraparteForm("apellidoPaterno", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Apellido materno</Label>
                              <Input
                                value={contraparteForm.apellidoMaterno}
                                onChange={(event) =>
                                  actualizarContraparteForm("apellidoMaterno", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Fecha de nacimiento</Label>
                              <Input
                                type="date"
                                value={contraparteForm.fechaNacimiento}
                                onChange={(event) =>
                                  actualizarContraparteForm("fechaNacimiento", event.target.value)
                                }
                              />
                            </div>
                          </>
                        )}
                        <div className="space-y-2">
                          <Label>RFC</Label>
                          <Input
                            value={contraparteForm.rfc}
                            onChange={(event) =>
                              actualizarContraparteForm("rfc", event.target.value.toUpperCase())
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>País de nacionalidad</Label>
                          <Select
                            value={contraparteForm.pais}
                            onValueChange={(value) => actualizarContraparteForm("pais", value)}
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
                      </div>
                    </div>

                    <div className="rounded border bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-700">
                        <FileText className="h-5 w-5 text-emerald-600" />
                        <h4 className="text-sm font-semibold">Instrumento público</h4>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Completa estos datos si la operación se formalizó mediante escritura o instrumento ante fedatario.
                      </p>
                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Número de instrumento</Label>
                          <Input
                            value={instrumentoForm.numero}
                            onChange={(event) => actualizarInstrumentoForm("numero", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Fecha del instrumento</Label>
                          <Input
                            type="date"
                            value={instrumentoForm.fecha}
                            onChange={(event) => actualizarInstrumentoForm("fecha", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Número de notario o corredor</Label>
                          <Input
                            value={instrumentoForm.notario}
                            onChange={(event) => actualizarInstrumentoForm("notario", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Entidad federativa del fedatario</Label>
                          <Input
                            value={instrumentoForm.entidad}
                            onChange={(event) => actualizarInstrumentoForm("entidad", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Valor del avalúo en el instrumento</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={instrumentoForm.valorAvaluo}
                            onChange={(event) => actualizarInstrumentoForm("valorAvaluo", event.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

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

      <Dialog open={relacionNegociosOpen} onOpenChange={setRelacionNegociosOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Qué es una relación de negocios?</DialogTitle>
            <DialogDescription>
              Es el vínculo continuo entre el sujeto obligado y su cliente, en el que se realizan actos u operaciones de forma
              recurrente. Cuando la actividad vulnerable deriva de una relación de negocios, el expediente debe revisarse al
              menos una vez al año.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-slate-700">
            <p>
              Usa esta marca para identificar expedientes con seguimiento anual y documenta cada actualización de información y
              documentos soporte.
            </p>
            <p>
              La plataforma calculará la fecha de la próxima revisión con base en la última actualización registrada del
              expediente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRelacionNegociosOpen(false)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                          value={datosEdicion.detalleTipoCliente || ""}
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
                      {MONEDAS.map((item) => (
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
