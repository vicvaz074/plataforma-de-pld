"use client"

import Link from "next/link"
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import {
  OperationalProgressRail,
  RegulatorySourceChip,
  SatOutputSummaryPanel,
} from "@/components/pld/actos-workspace-ui"
import { InfoHint } from "@/components/pld/info-hint"
import { SatDynamicOperationFormView } from "@/components/pld/sat-dynamic-operation-form"
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronsUpDown,
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
  Search,
  ShieldAlert,
  Trash2,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react"
import type { ActividadVulnerable } from "@/lib/data/actividades"
import { actividadesVulnerables } from "@/lib/data/actividades"
import { cn } from "@/lib/utils"
import {
  centsToDecimalString,
  centsToMoney,
  coerceLegacyMoneyToCents,
  formatMoneyFromCents,
  parseMoneyToCents,
} from "@/lib/pld/money"
import {
  createStoredPldOperation,
  deleteOrCancelStoredPldOperation,
  editStoredPldOperation,
  markStoredPldOperationPresented,
  recalculateStoredPldOperationsChronologically,
  sanitizeStoredPldOperation,
  storedPldSubjectIdentity,
  type StoredPldOperationV3,
} from "@/lib/pld/stored-operations"
import { UMA_MONTHS, findUmaByMonthYear } from "@/lib/data/uma"
import { CLIENTE_TIPOS, type ClienteTipoOption } from "@/lib/data/tipos-cliente"
import { CIUDADES_MEXICO, findCodigoPostalInfo } from "@/lib/data/codigos-postales"
import { demoFraccionXV } from "@/lib/demo/fraccion-xv"
import { PAISES, findPaisByCodigo, findPaisByNombre } from "@/lib/data/paises"
import {
  createLegacyExpedienteId,
  getPrimaryExpedienteIdentifier,
  normalizeExpedienteIdentifiers,
  validateExpedienteIdentifiers,
  type ExpedienteIdentifiers,
} from "@/lib/pld/expediente-eui"
import {
  buildChecklistFromRequirements,
  buildDefaultPldTenants,
  buildPldOperationalCase,
  classifyAvisoSalida,
  detectRecurringPaymentReview,
  evaluarOperacionVulnerable,
  evaluateOperationalEvidenceDecision,
  evaluatePldEbrMethodology,
  evaluateEvidenceChecklist,
  generateSatXml,
  generateSatOutputPackage,
  getAcumulacionRuleForActividad,
  getActionableSatMissingFieldIds,
  chooseSatTipoOperacionField,
  getDocumentRequirementsForCliente,
  getFixedSatTipoOperacion,
  matchPepCargo,
  PLD_ACTIVE_TENANT_STORAGE_KEY,
  PLD_TENANTS_STORAGE_KEY,
  buildSatDynamicOperationForm,
  buildBlockingReasonsView,
  buildOperationalStepDiagnostics,
  buildOperationalMonitoringView,
  buildRegulatorySourceDisplay,
  resolveSatFormatoForActividad,
  resolveSatTemplateForActividad,
  expandSatFieldValuesForDuplicateFields,
  isSatXlsmFieldRequired,
  pruneInactiveSatFieldValues,
  removeLinkedSatPackage,
  satFieldValuesToWorkbookCells,
  sanitizePldTenant,
  upsertLinkedSatPackage,
  type AvisoSalidaTipo,
  type DocumentRequirement,
  type EvidenceChecklistEvaluation,
  type InfoHintContent,
  type OperationalWizardStepDiagnostics,
  type PepScreeningResult,
  type SatDynamicOperationForm,
  type SatOutputKind,
  type SatOutputPackage,
  type SatXlsmLayout,
} from "@/lib/pld"

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

function getSujetoObligadoIdentityKey(
  sujeto?: { id?: string; rfc?: string; clave?: string; nombre?: string } | null,
) {
  return storedPldSubjectIdentity(sujeto ?? undefined)
}

function getSujetoObligadoOptionValueFromSnapshot(
  sujeto?: { id?: string; rfc?: string; clave?: string; nombre?: string } | null,
) {
  if (sujeto?.id) return `tenant:${sujeto.id}`
  const identity = getSujetoObligadoIdentityKey(sujeto)
  return identity === "sin-sujeto" ? "" : `sujeto:${identity}`
}

function hasRealSatOutput(
  operacion: Pick<OperacionCliente, "avisoSalidaTipo" | "umbralStatus" | "sospecha24h">,
) {
  if (
    operacion.avisoSalidaTipo === "aviso_normal" ||
    operacion.avisoSalidaTipo === "informe_27_bis" ||
    operacion.avisoSalidaTipo === "aviso_24h"
  ) {
    return true
  }
  if (operacion.avisoSalidaTipo === "sin_salida" || operacion.avisoSalidaTipo === "informe_ceros") {
    return false
  }
  return operacion.umbralStatus === "aviso" || Boolean(operacion.sospecha24h)
}

function getOperacionRecencyTimestamp(operacion: OperacionCliente) {
  const timestamp = Date.parse(operacion.updatedAt || operacion.createdAt || operacion.fechaOperacion)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function normalizarFraccion(valor: string) {
  return normalizarBusqueda(
    valor
      .replace(/^fraccion\s+/i, "")
      .replace(/^fracción\s+/i, "")
      .trim(),
  )
}

function resolveActividadPorClave(clave: string | undefined) {
  if (!clave) return null
  const normalizada = normalizarBusqueda(clave)
  return (
    actividadesVulnerables.find((actividad) => normalizarBusqueda(actividad.key) === normalizada) ??
    actividadesVulnerables.find((actividad) => normalizarBusqueda(actividad.fraccion) === normalizada) ??
    actividadesVulnerables.find(
      (actividad) => normalizarFraccion(actividad.fraccion) === normalizarFraccion(clave),
    )
  )
}

type ActividadVulnerableComboboxProps = {
  value: string
  options: ActividadVulnerable[]
  placeholder?: string
  disabled?: boolean
  triggerClassName?: string
  onChange: (value: string) => void
}

function ActividadVulnerableCombobox({
  value,
  options,
  placeholder = "Busca por fracción o actividad",
  disabled,
  triggerClassName,
  onChange,
}: ActividadVulnerableComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selected = options.find((actividad) => actividad.key === value)
  const filteredOptions = useMemo(() => {
    const term = normalizarBusqueda(query)
    if (!term) return options
    return options.filter((actividad) => {
      const searchable = [
        actividad.fraccion,
        actividad.nombre,
        actividad.descripcion,
        actividad.key,
        ...actividad.ejemplosOperaciones.map((ejemplo) => `${ejemplo.titulo} ${ejemplo.descripcion}`),
      ].join(" ")
      return normalizarBusqueda(searchable).includes(term)
    })
  }, [options, query])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("h-10 w-full max-w-none justify-between gap-2 bg-white px-3 text-left font-normal", triggerClassName)}
        >
          <span className="min-w-0 flex-1 truncate">
            {selected ? `${selected.fraccion} - ${selected.nombre}` : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[360px] w-[--radix-popover-trigger-width] overflow-hidden p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onInput={(event) => setQuery(event.currentTarget.value)}
              placeholder="Filtrar por fracción, nombre o palabra clave"
              className="h-9 pl-8"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto overscroll-contain p-1">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((actividad) => {
              const isSelected = actividad.key === value
              return (
                <button
                  key={actividad.key}
                  type="button"
                  className={`flex w-full min-w-0 items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-slate-100 ${
                    isSelected ? "bg-emerald-50 text-emerald-900" : "text-slate-700"
                  }`}
                  onClick={() => {
                    onChange(actividad.key)
                    setOpen(false)
                    setQuery("")
                  }}
                >
                  <CheckCircle2
                    className={`mt-0.5 h-4 w-4 shrink-0 ${isSelected ? "text-emerald-600" : "text-transparent"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{actividad.fraccion}</span>
                    <span className="line-clamp-2 text-xs leading-relaxed text-slate-500">{actividad.nombre}</span>
                  </span>
                </button>
              )
            })
          ) : (
            <div className="px-3 py-6 text-center text-sm text-slate-500">
              No encontré actividades con ese texto.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

type SearchableOptionComboboxProps = {
  value: string
  options: string[]
  placeholder: string
  searchPlaceholder?: string
  disabled?: boolean
  emptyLabel?: string
  onChange: (value: string) => void
}

function SearchableOptionCombobox({
  value,
  options,
  placeholder,
  searchPlaceholder = "Buscar opción",
  disabled,
  emptyLabel = "Sin opciones",
  onChange,
}: SearchableOptionComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const uniqueOptions = useMemo(() => Array.from(new Set(options.filter(Boolean))), [options])
  const filteredOptions = useMemo(() => {
    const term = normalizarBusqueda(query)
    if (!term) return uniqueOptions
    return uniqueOptions.filter((option) => normalizarBusqueda(option).includes(term))
  }, [query, uniqueOptions])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-10 w-full justify-between gap-2 bg-white px-3 text-left font-normal"
        >
          <span className="min-w-0 flex-1 truncate">{value || placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[360px] w-[--radix-popover-trigger-width] overflow-hidden p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onInput={(event) => setQuery(event.currentTarget.value)}
              placeholder={searchPlaceholder}
              className="h-9 pl-8"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto overscroll-contain p-1">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const isSelected = option === value
              return (
                <button
                  key={option}
                  type="button"
                  className={`flex w-full min-w-0 items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-slate-100 ${
                    isSelected ? "bg-emerald-50 text-emerald-900" : "text-slate-700"
                  }`}
                  onClick={() => {
                    onChange(option)
                    setOpen(false)
                    setQuery("")
                  }}
                >
                  <CheckCircle2
                    className={`mt-0.5 h-4 w-4 shrink-0 ${isSelected ? "text-emerald-600" : "text-transparent"}`}
                  />
                  <span className="min-w-0 flex-1 line-clamp-2 text-xs leading-relaxed">{option}</span>
                </button>
              )
            })
          ) : (
            <div className="px-3 py-6 text-center text-sm text-slate-500">{emptyLabel}</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
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
  valorCatastral: "",
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
  fechaConstitucion: "",
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
  valorCatastral: "",
}

const STEPS = [
  {
    id: 0,
    titulo: "Contexto",
    descripcion: "Sujeto, periodo y UMA.",
  },
  {
    id: 1,
    titulo: "Formato SAT",
    descripcion: "Fracción, plantilla y reglas.",
  },
  {
    id: 2,
    titulo: "Cliente/EUI",
    descripcion: "Expediente, RFC, relación y datos base.",
  },
  {
    id: 3,
    titulo: "Beneficiario controlador",
    descripcion: "Datos y confirmación del beneficiario controlador.",
  },
  {
    id: 4,
    titulo: "Operación",
    descripcion: "Monto, pago, acumulación y umbral.",
  },
  {
    id: 5,
    titulo: "Riesgo",
    descripcion: "EBR y señales de alerta.",
  },
  {
    id: 6,
    titulo: "Evidencias",
    descripcion: "Checklist mínimo y justificaciones.",
  },
  {
    id: 7,
    titulo: "Salida",
    descripcion: "Excel, XML y trazabilidad.",
  },
]

const OPERATIVE_FLOW_STAGES = ["Alta SAT", "EUI", "Operación", "Riesgo", "Evidencia", "Salida SAT"]

const ACTOS_INFO_HINTS: Record<string, InfoHintContent> = {
  salidaSat: {
    id: "salida-sat",
    title: "Salida SAT sugerida",
    summary: "La plataforma calcula la salida con base en actividad, umbral, acumulación, 27 Bis y alertas 24h.",
    body: [
      "La salida se sugiere automáticamente para evitar que el usuario elija entre aviso normal, informe en ceros, 27 Bis o aviso 24 horas sin contexto.",
      "Si el responsable de cumplimiento necesita corregirla, debe dejar motivo y trazabilidad en Avisos e Informes.",
    ],
  },
  aviso24h: {
    id: "aviso-24h",
    title: "Aviso de 24 horas",
    summary: "Se usa ante indicios o sospecha y no espera a que el expediente documental esté completo.",
    body: [
      "Debe documentarse la narrativa: qué ocurrió, cuándo se conoció el indicio, fuente de la alerta y acciones tomadas.",
      "La evidencia incompleta no debe retrasar el aviso, pero queda como pendiente de cierre interno.",
    ],
  },
  evidenciaCritica: {
    id: "evidencia-critica",
    title: "Evidencia crítica",
    summary: "Permite guardar avances, pero bloquea el cierre si falta documento o justificación válida.",
  },
  xlsmSat: {
    id: "xlsm-sat",
    title: "Campos del Excel SAT",
    summary: "Estos campos vienen del XLSM oficial y alimentan el Excel rellenado y el XML.",
  },
}

type UmbralStatus = "sin-obligacion" | "identificacion" | "aviso"

type InfoModalKey = "umbral-identificacion" | "umbral-aviso" | "uma-validacion"

const OPERACIONES_STORAGE_KEY = "actividades_vulnerables_operaciones"
const SAT_OUTPUT_PACKAGES_STORAGE_KEY = "pld-sat-output-packages"

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
    "Preparar aviso ante la Secretaría a más tardar el día 17 del mes inmediato siguiente.",
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
      "En algunas fracciones el aviso procede por la simple realización de la actividad, mientras que en otras se activa cuando el monto individual o acumulado rebasa el umbral correspondiente. El aviso ordinario debe presentarse a más tardar el día 17 del mes inmediato siguiente, incluyendo detalle del acto, participantes y soportes documentales.",
    ],
  },
  "uma-validacion": {
    title: "Validación de UMAs por año",
    body: [
      "Del 1 de febrero de 2026 al 31 de enero de 2027, la UMA vigente es de $117.31 MXN diarios y $3,566.22 MXN mensuales. Los montos en pesos del módulo se calculan automáticamente a partir del año y mes seleccionados.",
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
  nif?: string
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
  valorAvaluoCentavos?: number
  valorCatastral: string
  valorCatastralCentavos?: number
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
  montoCentavos?: number
}

interface BeneficiarioControladorOperacion {
  tipo: "persona_fisica" | "persona_moral"
  nombre?: string
  apellidoPaterno?: string
  apellidoMaterno?: string
  fechaNacimiento?: string
  fechaConstitucion?: string
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
  valorAvaluoCentavos?: number
  valorCatastral: string
  valorCatastralCentavos?: number
}

interface DatosInmuebleFormState {
  fechaInicio: string
  fechaFin: string
  tipoInmueble: string
  valorAvaluo: string
  valorCatastral: string
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
  fechaConstitucion: string
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
  valorCatastral: string
}

interface ExpedientePersona {
  id?: string
  tipo?: "persona_moral" | "persona_fisica"
  denominacion?: string
  nombre?: string
  apellidoPaterno?: string
  apellidoMaterno?: string
  fechaNacimiento?: string
  fechaConstitucion?: string
  rfc?: string
  nif?: string
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
  schemaVersion: number
  expedienteId: string
  rfc: string
  identifiers: ExpedienteIdentifiers
  activityKey?: string
  activityLabel?: string
  ocupacion?: {
    code: string
    label: string
  }
  operationContext?: {
    tipoActoOperacion?: string
    fechaActoOperacion?: string
    relacionNegocios?: string
  }
  nombre?: string
  tipoCliente?: string
  detalleTipoCliente?: string
  responsable?: string
  sujetoObligadoId?: string
  sujetoObligadoNombre?: string
  sujetoObligadoRfc?: string
  claveSujetoObligado?: string
  claveActividadVulnerable?: string
  identificacion?: Record<string, string>
  datosFiscales?: Record<string, string>
  perfilOperaciones?: Record<string, string>
  documentacion?: Record<string, string>
  personas?: ExpedientePersona[]
  beneficiariosControladores?: ExpedientePersona[]
  expedienteEui?: Record<string, any>
  actualizadoEn?: string
}

interface OperacionCliente {
  schemaVersion?: number
  id: string
  montoCentavos?: number
  revision?: number
  createdAt?: string
  updatedAt?: string
  lifecycle?: {
    status: "active" | "cancelled"
    cancelledAt?: string
    cancelledBy?: string
    cancellationReason?: string
    archivedAt?: string
  }
  submission?: {
    status: "not-required" | "pending" | "presented" | "correction-pending" | "cancelled"
    wasEverPresented: boolean
    presentedAt?: string
    presentedBy?: string
    reference?: string
    packageId?: string
    correctionReason?: string
    updatedAt: string
  }
  history?: Array<{
    id: string
    revision: number
    at: string
    action: "created" | "migrated" | "updated" | "recalculated" | "presented" | "submission-status-changed" | "deleted" | "cancelled"
    reason?: string
    before?: Record<string, unknown>
    after?: Record<string, unknown>
  }>
  sujetoObligado?: {
    id?: string
    rfc?: string
    nombre?: string
    clave?: string
  }
  estadoOperacion?: "active" | "cancelled"
  identificacionUmbralCentavos?: number
  avisoUmbralCentavos?: number
  acumuladoClienteCentavos?: number
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
  sospecha24h?: boolean
  avisoSalidaTipo?: AvisoSalidaTipo
  avisoSalidaLabel?: string
  avisoSalidaDescripcion?: string
  evidenciaCanClose?: boolean
  evidenciaFaltantesCriticos?: number
  evidenciaFaltantesOpcionales?: number
  acumulacionAplica?: boolean
  acumulacionRegla?: string
  acumulacionRazon?: string
  claveSujetoObligado?: string
  claveActividadVulnerable?: string
  expedienteReferenciado?: string
  expedienteIdentifiers?: ExpedienteIdentifiers
  expedienteEui?: Record<string, any>
  personaExpedienteId?: string
  personaAviso?: PersonaAvisoOperacion | null
  inmueble?: DatosInmuebleOperacion | null
  liquidacion?: DatosLiquidacionOperacion | null
  beneficiario?: BeneficiarioControladorOperacion | null
  contraparte?: ContraparteOperacion | null
  instrumento?: InstrumentoPublicoOperacion | null
  figuraCliente?: string
  figuraSujetoObligado?: string
  pepCargo?: string
  pepDependencia?: string
  pepScreening?: PepScreeningResult
  satTemplateId?: string
  satTemplateFile?: string
  satTemplateVariant?: string
  satFieldValues?: Record<string, string>
  satCellValues?: Record<string, string>
  satMissingRequiredFields?: string[]
  satWorkbookStatus?: "pendiente" | "borrador_bloqueado" | "listo"
  pagoRecurrenteMeses?: number
  pagoRecurrenteMensualidad?: number
  pagoRecurrenteMensualidadCentavos?: number
  posibleFalsoPositivo?: boolean
  falsoPositivoRazon?: string
}

interface ClienteGuardado {
  rfc: string
  nombre: string
  tipoCliente: string
  mismoGrupo: boolean
  detalleTipoCliente?: string
}

interface DocumentoSoporte {
  id: string
  requisito: string
  notas: string
  archivoNombre?: string
  archivoContenido?: string
  fechaRegistro: string
}

interface DraftEvidenceUpload {
  id: string
  requisitoId: string
  requisitoLabel: string
  archivoNombre: string
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

function buildReusableSatFieldValues(values?: Record<string, string>) {
  if (!values) return {}
  return Object.fromEntries(
    Object.entries(values).filter(([fieldId]) => {
      const normalized = fieldId.toLowerCase()
      return !(
        normalized.includes("periodo") ||
        normalized.includes("fecha") ||
        normalized.includes("monto") ||
        normalized.includes("valor_pactado") ||
        normalized.includes("referencia")
      )
    }),
  )
}

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
  if (value === undefined) return "0.00"
  const parsed = parseMoneyToCents(value, { allowZero: true })
  return parsed.ok ? parsed.decimal : "0.00"
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
  const requirements = getDocumentRequirementsForCliente(normalizarTipoCliente(tipoCliente), actividad.key)
  return buildChecklistFromRequirements(requirements, existente)
}

function buildJustificacionesEvidencia(documentos: DocumentoSoporte[] = []) {
  return documentos.reduce<Record<string, string>>((acc, documento) => {
    if (documento.notas.trim()) {
      acc[documento.requisito] = documento.notas.trim()
    }
    return acc
  }, {})
}

function buildDocumentosJustificados(
  justifications: Record<string, string>,
  requirements: DocumentRequirement[],
) {
  return Object.entries(justifications)
    .map(([requisitoId, notas]) => {
      const notasLimpias = notas.trim()
      if (!notasLimpias) return null

      const requisito = requirements.find((item) => item.id === requisitoId)
      return {
        id: `just-${requisitoId}-${Date.now()}`,
        requisito: requisito?.label ?? requisitoId,
        notas: notasLimpias,
        fechaRegistro: new Date().toISOString().substring(0, 10),
      } satisfies DocumentoSoporte
    })
    .filter((item): item is DocumentoSoporte => Boolean(item))
}

function toSatOutputKind(tipo: AvisoSalidaTipo | undefined, fallback: SatOutputKind = "aviso_normal") {
  if (
    tipo === "aviso_normal" ||
    tipo === "informe_ceros" ||
    tipo === "informe_27_bis" ||
    tipo === "aviso_24h"
  ) {
    return tipo
  }
  return fallback
}

function evaluarEvidenciaOperacion(operacion: Pick<
  OperacionCliente,
  "actividadKey" | "tipoCliente" | "requisitosChecklist" | "documentosSoporte"
>): EvidenceChecklistEvaluation {
  const requirements = getDocumentRequirementsForCliente(operacion.tipoCliente, operacion.actividadKey)
  return evaluateEvidenceChecklist({
    requirements,
    completed: operacion.requisitosChecklist,
    justifications: buildJustificacionesEvidencia(operacion.documentosSoporte),
  })
}

function formatSalidaTipo(tipo: AvisoSalidaTipo) {
  if (tipo === "aviso_normal") return "Layout normal"
  if (tipo === "informe_ceros") return "Informe en ceros"
  if (tipo === "informe_27_bis") return "Informe 27 Bis"
  if (tipo === "aviso_24h") return "Aviso 24 horas"
  return "Sin salida"
}

function formatSatWorkbookStatus(status: "pendiente" | "borrador_bloqueado" | "listo", missingCount: number) {
  if (status === "listo") return "Excel listo"
  if (status === "borrador_bloqueado") return `${missingCount} campo(s) pendiente(s)`
  return "Pendiente de layout"
}

function getMonitoringLaneClass(status: UmbralStatus | "todos", active: boolean) {
  const base = active ? "ring-2 ring-offset-1" : "hover:border-slate-300"
  if (status === "aviso") return `${base} border-rose-200 bg-rose-50 text-rose-800 ${active ? "ring-rose-200" : ""}`
  if (status === "identificacion") return `${base} border-amber-200 bg-amber-50 text-amber-800 ${active ? "ring-amber-200" : ""}`
  if (status === "sin-obligacion") return `${base} border-emerald-200 bg-emerald-50 text-emerald-800 ${active ? "ring-emerald-200" : ""}`
  return `${base} border-slate-200 bg-slate-50 text-slate-800 ${active ? "ring-slate-200" : ""}`
}

function getMonitoringStatusBadge(status: UmbralStatus) {
  if (status === "aviso") return "border-rose-200 bg-rose-50 text-rose-700"
  if (status === "identificacion") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-emerald-200 bg-emerald-50 text-emerald-700"
}

function obtenerAlertaPorStatus(status: UmbralStatus) {
  if (status === "aviso") {
    return "Supera el umbral de aviso. Preparar aviso para el día 17 del mes inmediato siguiente y cerrar la ventana de acumulación."
  }
  if (status === "identificacion") {
    return "Supera el umbral de identificación. Integrar expediente y aplicar acumulación solo cuando RCG Art. 19 corresponda."
  }
  return null
}

function recalcularOperaciones(lista: OperacionCliente[], recordHistory = false) {
  const canonical = lista
    .map((operacion) => sanitizeStoredPldOperation(operacion))
    .filter((operacion): operacion is StoredPldOperationV3 => Boolean(operacion))

  return recalculateStoredPldOperationsChronologically(canonical, { recordHistory })
    .map((operacion) => sanitizeOperacion(operacion))
    .filter((operacion): operacion is OperacionCliente => Boolean(operacion))
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

function formatDateForSatWorkbook(value: string) {
  if (!value) return ""
  const [year, month, day] = value.split("-")
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function paisSatOption(value?: string) {
  const normalized = (value || "MX").trim().toUpperCase()
  if (!normalized || normalized === "MX" || normalized === "MEXICO" || normalized === "MÉXICO") return "MEXICO,MX"
  const pais = findPaisByCodigo(normalized) ?? findPaisByNombre(value || "")
  return pais ? `${pais.label.toUpperCase()},${pais.code}` : value || ""
}

function monedaSatOption(value: string) {
  const normalized = value.trim().toUpperCase()
  if (!normalized || normalized === "MXN") return "1,Peso mexicano"
  if (normalized === "USD") return "2,Dólar estadounidense"
  return value
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
  const cents = Number.isSafeInteger(operacion.montoCentavos)
    ? operacion.montoCentavos ?? 0
    : coerceLegacyMoneyToCents(operacion.monto)
  return `${formatMoneyFromCents(cents, { currency: currencyCode })} (${operacion.monedaDescripcion})`
}

function isOperacionCancelada(operacion: OperacionCliente) {
  return operacion.lifecycle?.status === "cancelled" || operacion.estadoOperacion === "cancelled"
}

function getOperacionLifecycleLabel(operacion: OperacionCliente) {
  if (isOperacionCancelada(operacion)) return "Cancelada"
  if (operacion.submission?.status === "correction-pending") return "Corrección pendiente"
  if (operacion.submission?.wasEverPresented || operacion.avisoPresentado) return "Presentada"
  return getStatusLabel(operacion.umbralStatus)
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

  const canonical = sanitizeStoredPldOperation(raw)
  if (!canonical) return null
  raw = canonical

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

  const montoCentavos = Number.isSafeInteger(raw.montoCentavos)
    ? Number(raw.montoCentavos)
    : coerceLegacyMoneyToCents(raw.monto)
  const monto = centsToMoney(montoCentavos)
  const fechaOperacion =
    typeof raw.fechaOperacion === "string"
      ? raw.fechaOperacion
      : new Date().toISOString().substring(0, 10)

  const personaAviso = sanitizePersonaAviso(raw.personaAviso)
  const inmueble = sanitizeInmueble(raw.inmueble)
  const liquidacion = sanitizeLiquidacion(raw.liquidacion, moneda, monedaDescripcion, monto)
  const beneficiario = sanitizeBeneficiario(raw.beneficiario)
  const contraparte = sanitizeContraparte(raw.contraparte)
  const instrumento = sanitizeInstrumento(raw.instrumento)

  const documentosRaw: unknown[] = Array.isArray(raw.documentosSoporte) ? raw.documentosSoporte : []
  const documentosSoporte = documentosRaw
    .map((doc) => sanitizeDocumento(doc))
    .filter((doc): doc is DocumentoSoporte => Boolean(doc))

  const requisitosChecklist = buildChecklist(actividad, tipoCliente, raw.requisitosChecklist)
  const evidenciaEvaluada = evaluateEvidenceChecklist({
    requirements: getDocumentRequirementsForCliente(tipoCliente, actividad.key),
    completed: requisitosChecklist,
    justifications: buildJustificacionesEvidencia(documentosSoporte),
  })
  const statusSanitizado = (raw.umbralStatus as UmbralStatus) ?? "sin-obligacion"
  const salidaSanitizada = classifyAvisoSalida({
    status: statusSanitizado,
    fechaOperacion,
    supuesto27Bis: Boolean(raw.mismoGrupo) && statusSanitizado === "aviso",
    sospecha24h: Boolean(raw.sospecha24h),
    evidenceCanClose: evidenciaEvaluada.canClose,
  })
  const acumulacionRule = getAcumulacionRuleForActividad(actividad.key)
  const satFieldValuesSanitizados =
    raw.satFieldValues && typeof raw.satFieldValues === "object"
      ? Object.fromEntries(
          Object.entries(raw.satFieldValues as Record<string, unknown>)
            .filter(([key, value]) => typeof key === "string" && typeof value === "string")
            .map(([key, value]) => [key, value as string]),
        )
      : undefined
  const satCellValuesSanitizados =
    raw.satCellValues && typeof raw.satCellValues === "object"
      ? Object.fromEntries(
          Object.entries(raw.satCellValues as Record<string, unknown>)
            .filter(([key, value]) => typeof key === "string" && typeof value === "string")
            .map(([key, value]) => [key, value as string]),
        )
      : undefined

  return {
    schemaVersion: 3,
    id,
    montoCentavos,
    revision: Number.isInteger(raw.revision) && raw.revision > 0 ? raw.revision : 1,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    lifecycle: { ...raw.lifecycle },
    estadoOperacion: raw.estadoOperacion,
    submission: { ...raw.submission },
    history: (
      Array.isArray(raw.history)
        ? raw.history.filter((event: unknown) => Boolean(event && typeof event === "object"))
        : []
    ) as NonNullable<OperacionCliente["history"]>,
    sujetoObligado: raw.sujetoObligado ? { ...raw.sujetoObligado } : undefined,
    actividadKey: actividad.key,
    actividadNombre:
      typeof raw.actividadNombre === "string"
        ? raw.actividadNombre
        : `${actividad.fraccion} – ${actividad.nombre}`,
    satTemplateId: typeof raw.satTemplateId === "string" ? raw.satTemplateId : undefined,
    satTemplateFile: typeof raw.satTemplateFile === "string" ? raw.satTemplateFile : undefined,
    satTemplateVariant: typeof raw.satTemplateVariant === "string" ? raw.satTemplateVariant : undefined,
    satFieldValues: satFieldValuesSanitizados,
    satCellValues: satCellValuesSanitizados,
    satMissingRequiredFields: Array.isArray(raw.satMissingRequiredFields)
      ? raw.satMissingRequiredFields.filter((item: unknown): item is string => typeof item === "string")
      : undefined,
    satWorkbookStatus:
      raw.satWorkbookStatus === "listo" || raw.satWorkbookStatus === "borrador_bloqueado" || raw.satWorkbookStatus === "pendiente"
        ? raw.satWorkbookStatus
        : undefined,
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
    fechaOperacion,
    tipoOperacion: typeof raw.tipoOperacion === "string" ? raw.tipoOperacion : "",
    evidencia: typeof raw.evidencia === "string" ? raw.evidencia : "",
    umaDiaria: Number(raw.umaDiaria) || 0,
    identificacionUmbralPesos: Number(raw.identificacionUmbralPesos) || 0,
    identificacionUmbralCentavos: Number.isSafeInteger(raw.identificacionUmbralCentavos)
      ? Number(raw.identificacionUmbralCentavos)
      : coerceLegacyMoneyToCents(raw.identificacionUmbralPesos),
    avisoUmbralPesos: Number(raw.avisoUmbralPesos) || 0,
    avisoUmbralCentavos: Number.isSafeInteger(raw.avisoUmbralCentavos)
      ? Number(raw.avisoUmbralCentavos)
      : coerceLegacyMoneyToCents(raw.avisoUmbralPesos),
    umbralStatus: statusSanitizado,
    acumuladoCliente: Number(raw.acumuladoCliente) || Number(raw.monto) || 0,
    acumuladoClienteCentavos: Number.isSafeInteger(raw.acumuladoClienteCentavos)
      ? Number(raw.acumuladoClienteCentavos)
      : coerceLegacyMoneyToCents(raw.acumuladoCliente, montoCentavos),
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
    sospecha24h: Boolean(raw.sospecha24h),
    avisoSalidaTipo:
      typeof raw.avisoSalidaTipo === "string" ? (raw.avisoSalidaTipo as AvisoSalidaTipo) : salidaSanitizada.tipo,
    avisoSalidaLabel:
      typeof raw.avisoSalidaLabel === "string" ? raw.avisoSalidaLabel : salidaSanitizada.label,
    avisoSalidaDescripcion:
      typeof raw.avisoSalidaDescripcion === "string" ? raw.avisoSalidaDescripcion : salidaSanitizada.descripcion,
    evidenciaCanClose: evidenciaEvaluada.canClose,
    evidenciaFaltantesCriticos: evidenciaEvaluada.missingCritical.length,
    evidenciaFaltantesOpcionales: evidenciaEvaluada.missingOptional.length,
    acumulacionAplica: acumulacionRule.applies,
    acumulacionRegla: acumulacionRule.source,
    acumulacionRazon: acumulacionRule.rationale,
    claveSujetoObligado:
      typeof raw.claveSujetoObligado === "string" ? raw.claveSujetoObligado : undefined,
    claveActividadVulnerable:
      typeof raw.claveActividadVulnerable === "string" ? raw.claveActividadVulnerable : undefined,
    expedienteReferenciado:
      typeof raw.expedienteReferenciado === "string" ? raw.expedienteReferenciado : undefined,
    expedienteIdentifiers:
      raw.expedienteIdentifiers && typeof raw.expedienteIdentifiers === "object"
        ? normalizeExpedienteIdentifiers(raw.expedienteIdentifiers)
        : undefined,
    expedienteEui:
      raw.expedienteEui && typeof raw.expedienteEui === "object"
        ? { ...raw.expedienteEui }
        : undefined,
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
    pepCargo: typeof raw.pepCargo === "string" ? raw.pepCargo : undefined,
    pepDependencia: typeof raw.pepDependencia === "string" ? raw.pepDependencia : undefined,
    pepScreening:
      raw.pepScreening && typeof raw.pepScreening === "object"
        ? ({ ...raw.pepScreening } as PepScreeningResult)
        : undefined,
    pagoRecurrenteMeses: Number(raw.pagoRecurrenteMeses) > 0 ? Number(raw.pagoRecurrenteMeses) : undefined,
    pagoRecurrenteMensualidad:
      Number.isSafeInteger(raw.pagoRecurrenteMensualidadCentavos)
        ? centsToMoney(Number(raw.pagoRecurrenteMensualidadCentavos))
        : Number(raw.pagoRecurrenteMensualidad) > 0
          ? Number(raw.pagoRecurrenteMensualidad)
          : undefined,
    pagoRecurrenteMensualidadCentavos: Number.isSafeInteger(raw.pagoRecurrenteMensualidadCentavos)
      ? Number(raw.pagoRecurrenteMensualidadCentavos)
      : raw.pagoRecurrenteMensualidad !== undefined
        ? coerceLegacyMoneyToCents(raw.pagoRecurrenteMensualidad)
        : undefined,
    posibleFalsoPositivo: Boolean(raw.posibleFalsoPositivo),
    falsoPositivoRazon: typeof raw.falsoPositivoRazon === "string" ? raw.falsoPositivoRazon : undefined,
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
          municipio:
            typeof domicilioRaw.municipio === "string"
              ? domicilioRaw.municipio
              : typeof domicilioRaw.alcaldia === "string"
                ? domicilioRaw.alcaldia
                : undefined,
          ciudad: typeof domicilioRaw.ciudad === "string" ? domicilioRaw.ciudad : undefined,
          colonia: typeof domicilioRaw.colonia === "string" ? domicilioRaw.colonia : undefined,
          codigoPostal: typeof domicilioRaw.codigoPostal === "string" ? domicilioRaw.codigoPostal : undefined,
          calle:
            typeof domicilioRaw.calle === "string"
              ? domicilioRaw.calle
              : typeof domicilioRaw.nombreVialidad === "string"
                ? [domicilioRaw.tipoVialidad, domicilioRaw.nombreVialidad]
                    .filter((item) => typeof item === "string" && item.trim())
                    .join(" ")
                : undefined,
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
    nombre: typeof raw.nombre === "string" ? raw.nombre : undefined,
    apellidoPaterno: typeof raw.apellidoPaterno === "string" ? raw.apellidoPaterno : undefined,
    apellidoMaterno: typeof raw.apellidoMaterno === "string" ? raw.apellidoMaterno : undefined,
    fechaNacimiento: typeof raw.fechaNacimiento === "string" ? raw.fechaNacimiento : undefined,
    fechaConstitucion:
      typeof raw.fechaConstitucion === "string" ? raw.fechaConstitucion : undefined,
    rfc: typeof raw.rfc === "string" ? raw.rfc : undefined,
    nif: typeof raw.nif === "string" ? raw.nif : undefined,
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

function buildExpedientePersonaFromEui(raw: any): ExpedientePersona | null {
  if (!raw || typeof raw !== "object" || !raw.cliente || typeof raw.cliente !== "object") return null
  const cliente = raw.cliente
  const tipo = raw.tipoExpediente === "persona_fisica" ? "persona_fisica" : "persona_moral"
  const denominacion =
    tipo === "persona_fisica"
      ? [cliente.nombres, cliente.apellidoPaterno, cliente.apellidoMaterno]
          .filter((item) => typeof item === "string" && item.trim())
          .join(" ")
      : typeof cliente.denominacion === "string"
        ? cliente.denominacion
        : typeof cliente.nombre === "string"
          ? cliente.nombre
          : ""
  const domicilio = raw.domicilioCliente && typeof raw.domicilioCliente === "object"
    ? raw.domicilioCliente
    : null
  const contacto = raw.contactoCliente && typeof raw.contactoCliente === "object"
    ? raw.contactoCliente
    : null

  return sanitizeExpedientePersona({
    id: `cliente-${raw.expedienteId || cliente.rfc || cliente.nif || cliente.curp || "eui"}`,
    tipo,
    denominacion,
    nombre: cliente.nombres,
    apellidoPaterno: cliente.apellidoPaterno,
    apellidoMaterno: cliente.apellidoMaterno,
    fechaNacimiento: cliente.fechaNacimiento,
    fechaConstitucion: cliente.fechaConstitucion,
    rfc: cliente.rfc,
    nif: cliente.nif,
    curp: cliente.curp,
    pais: cliente.paisNacionalidad || cliente.paisNacimiento,
    giro: cliente.ocupacion || cliente.actividad,
    rolRelacion: "Cliente",
    representante: raw.representante,
    domicilio,
    contacto: contacto
      ? {
          clavePais: contacto.clavePais || domicilio?.pais,
          telefono: contacto.telefonoMovil || contacto.telefonoFijo || contacto.telefono,
          correo: contacto.correo,
        }
      : null,
  })
}

function buildBeneficiarioPersonaFromEui(raw: any, index: number): ExpedientePersona | null {
  if (!raw || typeof raw !== "object") return null
  return sanitizeExpedientePersona({
    id: typeof raw.id === "string" ? raw.id : `beneficiario-eui-${index}`,
    tipo: raw.tipo === "persona_moral" ? "persona_moral" : "persona_fisica",
    denominacion:
      typeof raw.denominacion === "string"
        ? raw.denominacion
        : [raw.nombres, raw.apellidoPaterno, raw.apellidoMaterno]
            .filter((item) => typeof item === "string" && item.trim())
            .join(" "),
    nombre: raw.nombres || raw.nombre,
    apellidoPaterno: raw.apellidoPaterno,
    apellidoMaterno: raw.apellidoMaterno,
    fechaNacimiento: raw.fechaNacimiento,
    rfc: raw.rfc,
    nif: raw.nif,
    curp: raw.curp,
    pais: raw.pais || raw.paisNacionalidad,
    giro: raw.giro,
    rolRelacion: raw.rolRelacion || "Beneficiario controlador",
    domicilio: raw.domicilio,
    contacto: raw.contacto,
  })
}

function sanitizeExpediente(raw: any): ExpedienteDetalle | null {
  if (!raw || typeof raw !== "object") return null

  const expedienteEui =
    raw.expedienteEui && typeof raw.expedienteEui === "object"
      ? raw.expedienteEui
      : undefined
  const clienteEui =
    expedienteEui?.cliente && typeof expedienteEui.cliente === "object"
      ? expedienteEui.cliente
      : {}
  const identifiers = normalizeExpedienteIdentifiers({
    rfc:
      typeof raw.identifiers?.rfc === "string"
        ? raw.identifiers.rfc
        : typeof raw.rfc === "string"
          ? raw.rfc
          : clienteEui.rfc,
    nif:
      typeof raw.identifiers?.nif === "string"
        ? raw.identifiers.nif
        : clienteEui.nif,
    curp:
      typeof raw.identifiers?.curp === "string"
        ? raw.identifiers.curp
        : clienteEui.curp,
  })
  const primaryIdentifier = getPrimaryExpedienteIdentifier(identifiers)
  const nombre =
    typeof raw.nombre === "string" && raw.nombre.trim()
      ? raw.nombre
      : typeof clienteEui.denominacion === "string"
        ? clienteEui.denominacion
        : typeof clienteEui.nombre === "string"
          ? clienteEui.nombre
          : [clienteEui.nombres, clienteEui.apellidoPaterno, clienteEui.apellidoMaterno]
              .filter((item) => typeof item === "string" && item.trim())
              .join(" ")
  if (!nombre && !primaryIdentifier) return null
  const expedienteId =
    typeof raw.expedienteId === "string" && raw.expedienteId.trim()
      ? raw.expedienteId
      : typeof expedienteEui?.expedienteId === "string" && expedienteEui.expedienteId.trim()
        ? expedienteEui.expedienteId
        : createLegacyExpedienteId(primaryIdentifier, nombre)
  const activityKey =
    typeof raw.activityKey === "string" && raw.activityKey
      ? raw.activityKey
      : typeof expedienteEui?.activityKey === "string" && expedienteEui.activityKey
        ? expedienteEui.activityKey
        : typeof raw.claveActividadVulnerable === "string"
          ? raw.claveActividadVulnerable
          : undefined

  const personasRaw: unknown[] = Array.isArray(raw.personas) ? raw.personas : []
  const personasSanitizadas = personasRaw
    .map((item) => sanitizeExpedientePersona(item))
    .filter((item): item is ExpedientePersona => Boolean(item))
  const personaEui = buildExpedientePersonaFromEui(expedienteEui)
  const personas = personasSanitizadas.length > 0
    ? personasSanitizadas
    : personaEui
      ? [personaEui]
      : []
  const beneficiariosRaw: unknown[] = Array.isArray(raw.beneficiariosControladores)
    ? raw.beneficiariosControladores
    : [expedienteEui?.beneficiario1, expedienteEui?.beneficiario2].filter(Boolean)
  const beneficiariosControladores = beneficiariosRaw
    .map((item, index) => buildBeneficiarioPersonaFromEui(item, index))
    .filter((item): item is ExpedientePersona => Boolean(item))

  return {
    schemaVersion: Number(raw.schemaVersion) || 1,
    expedienteId,
    rfc: identifiers.rfc,
    identifiers,
    activityKey,
    activityLabel:
      typeof raw.activityLabel === "string"
        ? raw.activityLabel
        : typeof expedienteEui?.activityLabel === "string"
          ? expedienteEui.activityLabel
          : undefined,
    ocupacion:
      raw.ocupacion && typeof raw.ocupacion === "object"
        ? {
            code: typeof raw.ocupacion.code === "string" ? raw.ocupacion.code : "",
            label: typeof raw.ocupacion.label === "string" ? raw.ocupacion.label : "",
          }
        : typeof clienteEui.ocupacion === "string" && clienteEui.ocupacion
          ? { code: clienteEui.ocupacion, label: clienteEui.ocupacion }
          : typeof clienteEui.actividad === "string" && clienteEui.actividad
            ? { code: clienteEui.actividad, label: clienteEui.actividad }
            : undefined,
    operationContext: {
      tipoActoOperacion:
        typeof raw.operationContext?.tipoActoOperacion === "string"
          ? raw.operationContext.tipoActoOperacion
          : typeof expedienteEui?.tipoActoOperacion === "string"
            ? expedienteEui.tipoActoOperacion
            : undefined,
      fechaActoOperacion:
        typeof raw.operationContext?.fechaActoOperacion === "string"
          ? raw.operationContext.fechaActoOperacion
          : typeof expedienteEui?.fechaActoOperacion === "string"
            ? expedienteEui.fechaActoOperacion
            : undefined,
      relacionNegocios:
        typeof raw.operationContext?.relacionNegocios === "string"
          ? raw.operationContext.relacionNegocios
          : typeof expedienteEui?.relacionNegocios === "string"
            ? expedienteEui.relacionNegocios
            : undefined,
    },
    nombre: nombre || primaryIdentifier || "Expediente sin nombre",
    tipoCliente: typeof raw.tipoCliente === "string" ? normalizarTipoCliente(raw.tipoCliente) : undefined,
    detalleTipoCliente:
      typeof raw.detalleTipoCliente === "string" ? raw.detalleTipoCliente : undefined,
    responsable: typeof raw.responsable === "string" ? raw.responsable : undefined,
    sujetoObligadoId:
      typeof raw.sujetoObligadoId === "string"
        ? raw.sujetoObligadoId
        : typeof raw.expedienteEui?.sujetoObligadoId === "string"
          ? raw.expedienteEui.sujetoObligadoId
          : undefined,
    sujetoObligadoNombre:
      typeof raw.sujetoObligadoNombre === "string"
        ? raw.sujetoObligadoNombre
        : typeof raw.expedienteEui?.sujetoObligadoNombre === "string"
          ? raw.expedienteEui.sujetoObligadoNombre
          : undefined,
    sujetoObligadoRfc:
      typeof raw.sujetoObligadoRfc === "string"
        ? raw.sujetoObligadoRfc
        : typeof raw.expedienteEui?.sujetoObligadoRfc === "string"
          ? raw.expedienteEui.sujetoObligadoRfc
          : undefined,
    claveSujetoObligado:
      typeof raw.claveSujetoObligado === "string" ? raw.claveSujetoObligado : undefined,
    claveActividadVulnerable:
      activityKey,
    identificacion: typeof raw.identificacion === "object" ? raw.identificacion ?? undefined : undefined,
    datosFiscales: typeof raw.datosFiscales === "object" ? raw.datosFiscales ?? undefined : undefined,
    perfilOperaciones:
      typeof raw.perfilOperaciones === "object" ? raw.perfilOperaciones ?? undefined : undefined,
    documentacion:
      typeof raw.documentacion === "object" ? raw.documentacion ?? undefined : undefined,
    personas,
    beneficiariosControladores,
    expedienteEui,
    actualizadoEn: typeof raw.actualizadoEn === "string" ? raw.actualizadoEn : undefined,
  }
}

function buildPersonaAvisoFromExpediente(persona: ExpedientePersona | null | undefined): PersonaAvisoOperacion | null {
  if (!persona) return null
  const tipo = persona.tipo === "persona_fisica" ? "persona_fisica" : "persona_moral"

  if (tipo === "persona_moral") {
    return {
      tipo,
      denominacion: persona.denominacion ?? persona.rfc ?? persona.nif ?? "Persona moral",
      fechaConstitucion: persona.fechaConstitucion,
      pais: persona.pais,
      giro: persona.giro,
      rfc: persona.rfc,
      nif: persona.nif,
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

  const nombreCompleto = persona.denominacion?.split(/\s+/).filter(Boolean) ?? []
  const nombre = persona.nombre ?? nombreCompleto[0] ?? ""
  const apellidoPaterno = persona.apellidoPaterno ?? nombreCompleto[1] ?? ""

  return {
    tipo,
    nombre,
    apellidoPaterno,
    apellidoMaterno: persona.apellidoMaterno ?? nombreCompleto.slice(2).join(" "),
    fechaNacimiento: persona.fechaNacimiento,
    rfc: persona.rfc,
    nif: persona.nif,
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
          municipio:
            typeof domicilioRaw.municipio === "string"
              ? domicilioRaw.municipio
              : typeof domicilioRaw.alcaldia === "string"
                ? domicilioRaw.alcaldia
                : undefined,
          colonia: typeof domicilioRaw.colonia === "string" ? domicilioRaw.colonia : undefined,
          codigoPostal: typeof domicilioRaw.codigoPostal === "string" ? domicilioRaw.codigoPostal : undefined,
          calle:
            typeof domicilioRaw.calle === "string"
              ? domicilioRaw.calle
              : typeof domicilioRaw.nombreVialidad === "string"
                ? [domicilioRaw.tipoVialidad, domicilioRaw.nombreVialidad]
                    .filter((item) => typeof item === "string" && item.trim())
                    .join(" ")
                : undefined,
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
    nif: typeof raw.nif === "string" ? raw.nif : undefined,
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
  const valorAvaluo =
    typeof raw.valorAvaluo === "string" || typeof raw.valorAvaluo === "number"
      ? String(raw.valorAvaluo)
      : ""
  const valorAvaluoParseado = valorAvaluo
    ? parseMoneyToCents(valorAvaluo, { allowZero: true })
    : null
  const valorCatastral =
    typeof raw.valorCatastral === "string" || typeof raw.valorCatastral === "number"
      ? String(raw.valorCatastral)
      : ""
  const valorCatastralParseado = valorCatastral
    ? parseMoneyToCents(valorCatastral, { allowZero: true })
    : null

  return {
    codigoOperacion,
    fechaInicio: typeof raw.fechaInicio === "string" ? raw.fechaInicio : "",
    fechaFin: typeof raw.fechaFin === "string" ? raw.fechaFin : "",
    tipoInmueble,
    valorAvaluo: valorAvaluoParseado?.ok ? valorAvaluoParseado.decimal : valorAvaluo,
    valorAvaluoCentavos: Number.isSafeInteger(raw.valorAvaluoCentavos)
      ? Number(raw.valorAvaluoCentavos)
      : valorAvaluoParseado?.ok
        ? valorAvaluoParseado.cents
        : undefined,
    valorCatastral: valorCatastralParseado?.ok
      ? valorCatastralParseado.decimal
      : valorCatastral,
    valorCatastralCentavos: Number.isSafeInteger(raw.valorCatastralCentavos)
      ? Number(raw.valorCatastralCentavos)
      : valorCatastralParseado?.ok
        ? valorCatastralParseado.cents
        : undefined,
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
    montoCentavos: Number.isSafeInteger(raw.montoCentavos)
      ? Number(raw.montoCentavos)
      : coerceLegacyMoneyToCents(raw.monto, coerceLegacyMoneyToCents(monto)),
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
    fechaConstitucion:
      typeof raw.fechaConstitucion === "string" ? raw.fechaConstitucion : undefined,
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
  const valorAvaluo =
    typeof raw.valorAvaluo === "string" || typeof raw.valorAvaluo === "number"
      ? String(raw.valorAvaluo)
      : ""
  const valorCatastral =
    typeof raw.valorCatastral === "string" || typeof raw.valorCatastral === "number"
      ? String(raw.valorCatastral)
      : ""
  if (!numero && !fecha && !notario && !entidad && !valorAvaluo && !valorCatastral) return null
  const valorAvaluoParseado = valorAvaluo
    ? parseMoneyToCents(valorAvaluo, { allowZero: true })
    : null
  const valorCatastralParseado = valorCatastral
    ? parseMoneyToCents(valorCatastral, { allowZero: true })
    : null
  return {
    numero,
    fecha,
    notario,
    entidad,
    valorAvaluo: valorAvaluoParseado?.ok ? valorAvaluoParseado.decimal : valorAvaluo,
    valorAvaluoCentavos: Number.isSafeInteger(raw.valorAvaluoCentavos)
      ? Number(raw.valorAvaluoCentavos)
      : valorAvaluoParseado?.ok
        ? valorAvaluoParseado.cents
        : undefined,
    valorCatastral: valorCatastralParseado?.ok
      ? valorCatastralParseado.decimal
      : valorCatastral,
    valorCatastralCentavos: Number.isSafeInteger(raw.valorCatastralCentavos)
      ? Number(raw.valorCatastralCentavos)
      : valorCatastralParseado?.ok
        ? valorCatastralParseado.cents
        : undefined,
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
  const [sospecha24h, setSospecha24h] = useState(false)
  const [tipoOperacion, setTipoOperacion] = useState<string>("")
  const [moneda, setMoneda] = useState<string>("MXN")
  const [monedaPersonalizadaCodigo, setMonedaPersonalizadaCodigo] = useState<string>("")
  const [monedaPersonalizadaDescripcion, setMonedaPersonalizadaDescripcion] = useState<string>("")
  const [fechaOperacion, setFechaOperacion] = useState<string>(new Date().toISOString().substring(0, 10))
  const [pagoRecurrenteMeses, setPagoRecurrenteMeses] = useState<string>("1")
  const [pagoRecurrenteMensualidad, setPagoRecurrenteMensualidad] = useState<string>("")
  const [pagoRecurrenteNota, setPagoRecurrenteNota] = useState<string>("")
  const [evidencia, setEvidencia] = useState<string>("")
  const [tenantState, setTenantState] = useState(() => buildDefaultPldTenants("tenant-demo-pld"))
  const [tenantsLoaded, setTenantsLoaded] = useState(false)
  const [draftEvidenceChecklist, setDraftEvidenceChecklist] = useState<Record<string, boolean>>({})
  const [draftEvidenceJustifications, setDraftEvidenceJustifications] = useState<Record<string, string>>({})
  const [draftEvidenceFiles, setDraftEvidenceFiles] = useState<Record<string, string>>({})
  const [draftEvidenceUploads, setDraftEvidenceUploads] = useState<DraftEvidenceUpload[]>([])
  const [expedientesDetalle, setExpedientesDetalle] = useState<Record<string, ExpedienteDetalle>>({})
  const [expedientesListo, setExpedientesListo] = useState(false)
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState<string | null>(null)
  const [personaExpedienteSeleccionada, setPersonaExpedienteSeleccionada] = useState<string>("")

  const [personaAvisoActual, setPersonaAvisoActual] = useState<PersonaAvisoOperacion | null>(null)
  const [editandoDatosEui, setEditandoDatosEui] = useState(false)
  const [datosEuiConfirmados, setDatosEuiConfirmados] = useState(false)
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
  const [operacionesStorageValido, setOperacionesStorageValido] = useState(true)
  const [clientesGuardados, setClientesGuardados] = useState<ClienteGuardado[]>([])
  const [clientesGuardadosListo, setClientesGuardadosListo] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string | null>(null)
  const [infoGrupoOpen, setInfoGrupoOpen] = useState(false)
  const [infoTipoClienteOpen, setInfoTipoClienteOpen] = useState(false)
  const [actividadInfoKey, setActividadInfoKey] = useState<string | null>(null)
  const [infoModal, setInfoModal] = useState<InfoModalKey | null>(null)
  const [tabActiva, setTabActiva] = useState<"resumen" | "captura" | "seguimiento" | "explorar">("resumen")
  const [relacionNegocios, setRelacionNegocios] = useState(false)
  const [relacionNegociosOpen, setRelacionNegociosOpen] = useState(false)
  const [pepCargoCliente, setPepCargoCliente] = useState("")
  const [pepDependenciaCliente, setPepDependenciaCliente] = useState("")
  const [pepRelacionCliente, setPepRelacionCliente] = useState("cliente")
  const [sujetoObligadoOperacion, setSujetoObligadoOperacion] = useState<string>("")
  const [clienteOperacionSeleccionado, setClienteOperacionSeleccionado] = useState<string>("")
  const [actividadOperacionSeleccionada, setActividadOperacionSeleccionada] = useState<string>("")
  const [anioOperacionCaptura, setAnioOperacionCaptura] = useState<number>(currentYear)
  const [mesOperacionCaptura, setMesOperacionCaptura] = useState<number>(currentMonth)
  const [clienteCalendario, setClienteCalendario] = useState<string | null>(null)
  const [mesCalendario, setMesCalendario] = useState<number>(currentMonth)
  const [anioCalendario, setAnioCalendario] = useState<number>(currentYear)
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null)
  const [seguimientoFiltro, setSeguimientoFiltro] = useState<"todos" | UmbralStatus>("todos")
  const [busquedaOperaciones, setBusquedaOperaciones] = useState("")
  const [filtroActividadOperaciones, setFiltroActividadOperaciones] = useState("todas")
  const [filtroPeriodoOperaciones, setFiltroPeriodoOperaciones] = useState("todos")
  const [filtroEstadoOperaciones, setFiltroEstadoOperaciones] = useState("todos")
  const [operacionEditandoId, setOperacionEditandoId] = useState<string | null>(null)
  const [motivoCorreccion, setMotivoCorreccion] = useState("")
  const [operacionParaEliminar, setOperacionParaEliminar] = useState<OperacionCliente | null>(null)
  const [motivoCancelacion, setMotivoCancelacion] = useState("")
  const [operacionDocumentos, setOperacionDocumentos] = useState<OperacionCliente | null>(null)
  const [nuevoDocumento, setNuevoDocumento] = useState({
    requisito: "",
    notas: "",
    archivoNombre: "",
    archivoContenido: "",
    fechaRegistro: new Date().toISOString().substring(0, 10),
  })
  const [busquedaClienteGuardado, setBusquedaClienteGuardado] = useState("")
  const [busquedaCiudadInmueble, setBusquedaCiudadInmueble] = useState("")
  const [busquedaColoniaInmueble, setBusquedaColoniaInmueble] = useState("")
  const [satTemplateVariantId, setSatTemplateVariantId] = useState<string>("")
  const [satFieldValues, setSatFieldValues] = useState<Record<string, string>>({})
  const [satLayouts, setSatLayouts] = useState<Record<string, SatXlsmLayout>>({})
  const [satLayoutsLoaded, setSatLayoutsLoaded] = useState(false)
  const demoCargaRef = useRef(false)
  const preserveSatValuesOnActivityChangeRef = useRef(false)
  const satEditInitializationRef = useRef<string | null>(null)
  const primaryBeneficiarySatFieldIdsRef = useRef<Set<string>>(new Set())

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
      setBeneficiarioForm((prev) => {
        if (campo === "tipo" && valor === "persona_moral") {
          return {
            ...prev,
            tipo: "persona_moral",
            apellidoPaterno: "",
            apellidoMaterno: "",
            fechaNacimiento: "",
            curp: "",
          }
        }
        if (campo === "tipo" && valor === "persona_fisica") {
          return { ...prev, tipo: "persona_fisica", fechaConstitucion: "" }
        }
        return { ...prev, [campo]: valor }
      })
      setSatFieldValues((current) =>
        Object.fromEntries(
          Object.entries(current).filter(
            ([fieldId]) => !primaryBeneficiarySatFieldIdsRef.current.has(fieldId),
          ),
        ),
      )
      setDatosEuiConfirmados(false)
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

  const actualizarSatField = useCallback((fieldId: string, value: string) => {
    const normalizedFieldId = normalizarBusqueda(fieldId)
    setSatFieldValues((prev) => {
      const next = { ...prev, [fieldId]: value }
      const selectedCode = value.split(/[,|]/)[0]?.trim()
      const isTipoActoSelector =
        normalizedFieldId.includes("tipo-de-acto-realizado") ||
        normalizedFieldId.endsWith(".f17") ||
        normalizedFieldId.endsWith("!f17")

      if (isTipoActoSelector && selectedCode !== "9") {
        Object.keys(next).forEach((candidateId) => {
          const normalizedCandidateId = normalizarBusqueda(candidateId)
          if (
            normalizedCandidateId.includes("descripcion-tipo-de-acto-otro") ||
            normalizedCandidateId.endsWith(".f18") ||
            normalizedCandidateId.endsWith("!f18")
          ) {
            delete next[candidateId]
          }
        })
      }
      return next
    })

    if (normalizedFieldId.includes("beneficiario")) {
      setDatosEuiConfirmados(false)
    }

    if (fieldId === "acto.tipo_operacion") setTipoOperacion(value)
    if (fieldId === "inmueble.valor_pactado" || fieldId === "pago.monto") setMontoOperacion(value)
    if (fieldId === "acto.figura_cliente") setFiguraClienteInmueble(value)
    if (fieldId === "acto.figura_sujeto_obligado") setFiguraSujetoObligadoInmueble(value)
    if (fieldId === "persona_aviso.referencia") setReferenciaAviso(value)
    if (fieldId === "persona_aviso.prioridad") setPrioridadAviso(value)
    if (fieldId === "persona_aviso.tipo_alerta") setAlertaCodigo(value)
    if (fieldId === "persona_aviso.descripcion_alerta") setAlertaDescripcion(value)
    if (fieldId === "persona_aviso.pm.razon_social" || fieldId === "persona_aviso.pf.nombre") setClienteNombre(value)
    if (fieldId === "persona_aviso.pm.rfc" || fieldId === "persona_aviso.pf.rfc") setRfc(value.toUpperCase())

    const inmuebleMap: Record<string, keyof DatosInmuebleFormState> = {
      "inmueble.tipo_bien": "tipoInmueble",
      "inmueble.codigo_postal": "codigoPostal",
      "inmueble.estado": "entidad",
      "inmueble.municipio": "municipio",
      "inmueble.calle": "calle",
      "inmueble.numero_exterior": "numeroExterior",
      "inmueble.numero_interior": "numeroInterior",
      "inmueble.colonia": "colonia",
      "inmueble.folio_real": "folioReal",
    }
    const inmuebleCampo = inmuebleMap[fieldId]
    if (inmuebleCampo) setInmuebleForm((prev) => ({ ...prev, [inmuebleCampo]: value }))

    const liquidacionMap: Record<string, keyof DatosLiquidacionFormState> = {
      "pago.fecha": "fechaPago",
      "pago.forma_pago": "formaPago",
      "pago.instrumento_monetario": "instrumento",
    }
    const liquidacionCampo = liquidacionMap[fieldId]
    if (liquidacionCampo) setLiquidacionForm((prev) => ({ ...prev, [liquidacionCampo]: value }))

    const beneficiarioMap: Record<string, keyof BeneficiarioFormState> = {
      "beneficiario.pf.nombre": "nombre",
      "beneficiario.pf.apellido_paterno": "apellidoPaterno",
      "beneficiario.pf.apellido_materno": "apellidoMaterno",
      "beneficiario.pf.fecha_nacimiento": "fechaNacimiento",
      "beneficiario.pf.rfc": "rfc",
      "beneficiario.pf.curp": "curp",
      "beneficiario.pf.pais_nacionalidad": "pais",
      "beneficiario.pm.razon_social": "nombre",
      "beneficiario.pm.fecha_constitucion": "fechaConstitucion",
      "beneficiario.pm.rfc": "rfc",
      "beneficiario.pm.pais_nacionalidad": "pais",
    }
    const beneficiarioCampo = beneficiarioMap[fieldId]
    if (beneficiarioCampo) {
      setBeneficiarioForm((prev) => ({ ...prev, [beneficiarioCampo]: value }))
    }

    const contraparteMap: Record<string, keyof ContraparteFormState> = {
      "contraparte.pf.nombre": "nombre",
      "contraparte.pf.apellido_paterno": "apellidoPaterno",
      "contraparte.pf.apellido_materno": "apellidoMaterno",
      "contraparte.pf.fecha_nacimiento": "fechaNacimiento",
      "contraparte.pf.rfc": "rfc",
      "contraparte.pf.pais_nacionalidad": "pais",
      "contraparte.pm.razon_social": "nombre",
      "contraparte.pm.rfc": "rfc",
      "contraparte.pm.pais_nacionalidad": "pais",
    }
    const contraparteCampo = contraparteMap[fieldId]
    if (contraparteCampo) setContraparteForm((prev) => ({ ...prev, [contraparteCampo]: value }))

    const instrumentoMap: Record<string, keyof InstrumentoPublicoFormState> = {
      "instrumento.fecha": "fecha",
      "instrumento.numero": "numero",
      "instrumento.notario": "notario",
      "instrumento.entidad": "entidad",
      "instrumento.valor_avaluo": "valorAvaluo",
    }
    const instrumentoCampo = instrumentoMap[fieldId]
    if (instrumentoCampo) setInstrumentoForm((prev) => ({ ...prev, [instrumentoCampo]: value }))
    if (normalizedFieldId.includes("valor-catastral") || normalizedFieldId.includes("valor_catastral")) {
      setInmuebleForm((prev) => ({ ...prev, valorCatastral: value }))
      setInstrumentoForm((prev) => ({ ...prev, valorCatastral: value }))
    }
  }, [])

  const tipoClienteSeleccionado = useMemo(
    () => obtenerOpcionTipoCliente(tipoCliente),
    [tipoCliente],
  )

  const activeTenant = useMemo(
    () =>
      tenantState.tenants.find((tenant) => tenant.id === tenantState.activeTenantId) ??
      tenantState.tenants[0],
    [tenantState],
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
      const stored = window.localStorage.getItem(PLD_TENANTS_STORAGE_KEY)
      const activeTenantRaw = window.localStorage.getItem(PLD_ACTIVE_TENANT_STORAGE_KEY)
      let activeTenantId = activeTenantRaw
      if (activeTenantRaw) {
        try {
          const parsedActiveTenant = JSON.parse(activeTenantRaw) as unknown
          if (typeof parsedActiveTenant === "string") {
            activeTenantId = parsedActiveTenant
          }
        } catch (_error) {
          activeTenantId = activeTenantRaw
        }
      }
      if (!stored) return

      const parsed = JSON.parse(stored) as { tenants?: unknown[]; activeTenantId?: unknown }
      if (!Array.isArray(parsed.tenants)) return

      const tenants = parsed.tenants.map((tenant, index) =>
        sanitizePldTenant(tenant, `tenant-${index + 1}`),
      )
      if (tenants.length === 0) return

      const resolvedActiveTenant =
        typeof activeTenantId === "string" && tenants.some((tenant) => tenant.id === activeTenantId)
          ? activeTenantId
          : typeof parsed.activeTenantId === "string" && tenants.some((tenant) => tenant.id === parsed.activeTenantId)
            ? parsed.activeTenantId
            : tenants[0].id

      setTenantState({
        schemaVersion: 1,
        activeTenantId: resolvedActiveTenant,
        tenants,
      })
    } catch (_error) {
      // Mantener el sujeto obligado demo si los datos locales no son legibles.
    } finally {
      setTenantsLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (!tenantsLoaded) return
    if (typeof window === "undefined") return

    window.localStorage.setItem(PLD_TENANTS_STORAGE_KEY, JSON.stringify(tenantState))
    window.localStorage.setItem(PLD_ACTIVE_TENANT_STORAGE_KEY, tenantState.activeTenantId)
  }, [tenantState, tenantsLoaded])

  useEffect(() => {
    if (preserveSatValuesOnActivityChangeRef.current) {
      preserveSatValuesOnActivityChangeRef.current = false
      return
    }
    setSatTemplateVariantId("")
    setSatFieldValues({})
  }, [actividadKey])

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
      setOperacionesStorageValido(true)
    } catch (_error) {
      // ignorar errores de parseo y continuar con estado vacío
      setOperacionesStorageValido(false)
    } finally {
      setOperacionesCargadas(true)
    }
  }, [])

  useEffect(() => {
    if (!operacionesCargadas || !operacionesStorageValido) return
    if (typeof window === "undefined") return

    try {
      window.localStorage.setItem(OPERACIONES_STORAGE_KEY, JSON.stringify(operaciones))
    } catch (error) {
      console.error("No fue posible persistir las operaciones PLD", error)
    }
  }, [operaciones, operacionesCargadas, operacionesStorageValido])

  useEffect(() => {
    if (!operacionesCargadas || !operacionesStorageValido || typeof window === "undefined") return

    let existingPackages: SatOutputPackage[] = []
    try {
      const stored = window.localStorage.getItem(SAT_OUTPUT_PACKAGES_STORAGE_KEY)
      const parsed = stored ? JSON.parse(stored) : []
      existingPackages = Array.isArray(parsed)
        ? parsed.filter((item): item is SatOutputPackage => Boolean(item && typeof item === "object"))
        : []
    } catch (_error) {
      existingPackages = []
    }

    let nextPackages = [...existingPackages]

    for (const operacion of operaciones) {
      const outputKind = toSatOutputKind(operacion.avisoSalidaTipo, "aviso_normal")
      const isReportable =
        operacion.avisoSalidaTipo === "aviso_normal" ||
        operacion.avisoSalidaTipo === "informe_27_bis" ||
        operacion.avisoSalidaTipo === "aviso_24h" ||
        operacion.umbralStatus === "aviso"
      const everPresented = Boolean(operacion.submission?.wasEverPresented || operacion.avisoPresentado)

      if (!isReportable) {
        if (!everPresented) {
          nextPackages = removeLinkedSatPackage(nextPackages, operacion.id)
        }
        continue
      }
      if (isOperacionCancelada(operacion)) continue

      const tenantBase =
        tenantState.tenants.find(
          (tenant) =>
            tenant.id === operacion.sujetoObligado?.id ||
            (operacion.sujetoObligado?.rfc && tenant.rfc === operacion.sujetoObligado.rfc),
        ) ?? activeTenant ?? buildDefaultPldTenants("tenant-demo-pld").tenants[0]
      const tenant = {
        ...tenantBase,
        id: operacion.sujetoObligado?.id || tenantBase.id,
        rfc: operacion.sujetoObligado?.rfc || tenantBase.rfc,
        razonSocial: operacion.sujetoObligado?.nombre || tenantBase.razonSocial,
      }
      const operationalCase = buildPldOperationalCase({
        tenant,
        periodo: operacion.periodo,
        actividadKey: operacion.actividadKey,
        clienteId: operacion.rfc,
        clienteNombre: operacion.cliente,
        clienteRfc: operacion.rfc,
        tipoCliente: operacion.tipoCliente,
        fechaOperacion: operacion.fechaOperacion,
        montoMxn: centsToMoney(
          operacion.montoCentavos ?? coerceLegacyMoneyToCents(operacion.monto),
        ),
        montoCentavos:
          operacion.montoCentavos ?? coerceLegacyMoneyToCents(operacion.monto),
        formaPago: operacion.liquidacion?.formaPago ?? operacion.monedaDescripcion,
        sospecha24h: Boolean(operacion.sospecha24h),
        supuesto27Bis: operacion.mismoGrupo && operacion.umbralStatus === "aviso",
        alertaCodigo: operacion.alertaCodigo,
        alertaDescripcion: operacion.alertaDescripcion,
        suspicionNarrative: operacion.alertaDescripcion || operacion.evidencia,
        completedEvidence: operacion.requisitosChecklist,
        evidenceJustifications: buildJustificacionesEvidencia(operacion.documentosSoporte),
        satTemplateId: operacion.satTemplateId,
        satTemplateFile: operacion.satTemplateFile,
        satTemplateVariant: operacion.satTemplateVariant,
        satFieldValues: operacion.satFieldValues,
        satCellValues: operacion.satCellValues,
        satMissingRequiredFields: operacion.satMissingRequiredFields,
        satWorkbookStatus: operacion.satWorkbookStatus,
        actor: tenant.representanteCumplimiento.nombre,
      })
      operationalCase.satOutputStatus = {
        ...operationalCase.satOutputStatus,
        kind: outputKind,
        label: operacion.avisoSalidaLabel || operationalCase.satOutputStatus.label,
        descripcion:
          operacion.avisoSalidaDescripcion || operationalCase.satOutputStatus.descripcion,
      }
      const generated = generateSatOutputPackage(operationalCase, {
        sourceOperationId: operacion.id,
        sourceOperationRevision: operacion.revision ?? 1,
        updatedAt: operacion.updatedAt,
      })
      nextPackages = upsertLinkedSatPackage(nextPackages, generated)
    }

    const currentSerialized = JSON.stringify(existingPackages)
    const nextSerialized = JSON.stringify(nextPackages)
    if (currentSerialized !== nextSerialized) {
      window.localStorage.setItem(SAT_OUTPUT_PACKAGES_STORAGE_KEY, nextSerialized)
    }
  }, [activeTenant, operaciones, operacionesCargadas, operacionesStorageValido, tenantState.tenants])

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
              mapa.set(expediente.expedienteId, expediente)
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
    if (!operacionDocumentos) return

    const actualizada = operaciones.find((operacion) => operacion.id === operacionDocumentos.id)
    if (actualizada && actualizada !== operacionDocumentos) {
      setOperacionDocumentos(actualizada)
    }
  }, [operaciones, operacionDocumentos])

  const actividadSeleccionada = useMemo(
    () => actividadesVulnerables.find((actividad) => actividad.key === actividadKey),
    [actividadKey],
  )

  const expedienteActual = useMemo(
    () => (expedienteSeleccionado ? expedientesDetalle[expedienteSeleccionado] ?? null : null),
    [expedienteSeleccionado, expedientesDetalle],
  )

  const sujetoObligadoSnapshotActual = useMemo(() => {
    const operacionEditada = operaciones.find((operacion) => operacion.id === operacionEditandoId)
    const sujetoGuardado = operacionEditada?.sujetoObligado
    if (
      sujetoGuardado &&
      getSujetoObligadoOptionValueFromSnapshot(sujetoGuardado) === sujetoObligadoOperacion
    ) {
      return { ...sujetoGuardado }
    }

    const tenantId = sujetoObligadoOperacion.startsWith("tenant:")
      ? sujetoObligadoOperacion.slice("tenant:".length)
      : ""
    const tenantSeleccionado = tenantState.tenants.find((tenant) => tenant.id === tenantId)
    if (tenantSeleccionado) {
      return {
        id: tenantSeleccionado.id,
        rfc: tenantSeleccionado.rfc,
        nombre: tenantSeleccionado.razonSocial,
      }
    }

    const expedienteOptionValue = (expediente: ExpedienteDetalle) =>
      getSujetoObligadoOptionValueFromSnapshot({
        id: expediente.sujetoObligadoId,
        rfc: expediente.sujetoObligadoRfc,
        nombre: expediente.sujetoObligadoNombre,
        clave: expediente.claveSujetoObligado,
      }) || `expediente:${normalizarBusqueda(expediente.expedienteId)}`
    const expedienteSujeto =
      (expedienteActual && expedienteOptionValue(expedienteActual) === sujetoObligadoOperacion
        ? expedienteActual
        : null) ??
      Object.values(expedientesDetalle).find((expediente) => {
        return expedienteOptionValue(expediente) === sujetoObligadoOperacion
      })

    if (expedienteSujeto) {
      return {
        id: expedienteSujeto.sujetoObligadoId,
        rfc: expedienteSujeto.sujetoObligadoRfc,
        nombre: expedienteSujeto.sujetoObligadoNombre,
        clave: expedienteSujeto.claveSujetoObligado,
      }
    }

    return activeTenant
      ? {
          id: activeTenant.id,
          rfc: activeTenant.rfc,
          nombre: activeTenant.razonSocial,
        }
      : undefined
  }, [
    activeTenant,
    expedienteActual,
    expedientesDetalle,
    operacionEditandoId,
    operaciones,
    sujetoObligadoOperacion,
    tenantState.tenants,
  ])

  const tenantOperacionalActual = useMemo(() => {
    const base =
      tenantState.tenants.find(
        (tenant) =>
          tenant.id === sujetoObligadoSnapshotActual?.id ||
          Boolean(sujetoObligadoSnapshotActual?.rfc && tenant.rfc === sujetoObligadoSnapshotActual.rfc),
      ) ?? activeTenant ?? buildDefaultPldTenants("tenant-demo-pld").tenants[0]
    if (!base) return null
    return {
      ...base,
      id: sujetoObligadoSnapshotActual?.id || base.id,
      rfc: sujetoObligadoSnapshotActual?.rfc || base.rfc,
      razonSocial: sujetoObligadoSnapshotActual?.nombre || base.razonSocial,
    }
  }, [activeTenant, sujetoObligadoSnapshotActual, tenantState.tenants])

  const requisitosDocumentalesActuales = useMemo<DocumentRequirement[]>(
    () => getDocumentRequirementsForCliente(tipoCliente, actividadSeleccionada?.key),
    [tipoCliente, actividadSeleccionada?.key],
  )
  const soporteOperacionRequirement = useMemo(
    () =>
      requisitosDocumentalesActuales.find((requisito) => requisito.id === "operacion-soporte") ?? {
        id: "operacion-soporte",
        label: "Soporte del acto u operacion.",
      },
    [requisitosDocumentalesActuales],
  )
  const formaPagoRequirement = useMemo(
    () =>
      requisitosDocumentalesActuales.find((requisito) => requisito.id === "operacion-forma-pago") ?? {
        id: "operacion-forma-pago",
        label: "Evidencia de forma de pago.",
      },
    [requisitosDocumentalesActuales],
  )

  const acumulacionRuleActual = useMemo(
    () => (actividadSeleccionada ? getAcumulacionRuleForActividad(actividadSeleccionada.key) : null),
    [actividadSeleccionada],
  )

  const esActividadInmuebles = useMemo(
    () => actividadSeleccionada?.key === ACTIVIDAD_INMUEBLES_KEY,
    [actividadSeleccionada],
  )

  const operacionesReutilizables = useMemo(
    () =>
      operaciones
        .filter((operacion) => operacion.actividadKey === actividadKey)
        .filter((operacion) => !rfc.trim() || operacion.rfc === rfc.trim().toUpperCase())
        .sort((a, b) => toDate(b.fechaOperacion).getTime() - toDate(a.fechaOperacion).getTime())
        .slice(0, 3),
    [actividadKey, operaciones, rfc],
  )

  const satFormatoActual = useMemo(() => {
    if (!actividadSeleccionada) return null
    try {
      return resolveSatFormatoForActividad(actividadSeleccionada.key)
    } catch (_error) {
      return null
    }
  }, [actividadSeleccionada])

  const satTemplateActual = useMemo(() => {
    if (!actividadSeleccionada) return null
    try {
      return resolveSatTemplateForActividad(actividadSeleccionada.key, satTemplateVariantId || undefined)
    } catch (_error) {
      return null
    }
  }, [actividadSeleccionada, satTemplateVariantId])

  const satLayoutActual = useMemo(
    () => (satTemplateActual ? satLayouts[satTemplateActual.templateId] ?? null : null),
    [satLayouts, satTemplateActual],
  )

  const satDynamicFormActual = useMemo<SatDynamicOperationForm | null>(() => {
    if (!satTemplateActual || !satLayoutActual) return null
    return buildSatDynamicOperationForm({
      template: satTemplateActual,
      layout: satLayoutActual,
      variantId: satTemplateVariantId || undefined,
      prefill: {
        periodo: buildPeriodo(anioSeleccionado, mesSeleccionado),
        sujetoObligadoRfc: sujetoObligadoSnapshotActual?.rfc,
        tenantRfc: sujetoObligadoSnapshotActual?.rfc,
        referenciaAviso: referenciaAviso.trim(),
        prioridadAviso,
        alertaCodigo,
        alertaDescripcion,
        figuraCliente: figuraClienteInmueble,
        figuraSujetoObligado: figuraSujetoObligadoInmueble,
        tipoOperacion,
        fechaOperacion: formatDateForSatWorkbook(fechaOperacion),
        montoMxn: (() => {
          const parsed = parseMoneyToCents(montoOperacion, { allowZero: sospecha24h })
          return parsed.ok ? parsed.decimal : ""
        })(),
        formaPago: liquidacionForm.formaPago,
        instrumentoMonetario: liquidacionForm.instrumento,
        monedaSat: monedaSatOption(moneda === "OTRA" ? monedaPersonalizadaCodigo.trim().toUpperCase() || "MXN" : moneda),
        moneda: monedaSatOption(moneda === "OTRA" ? monedaPersonalizadaCodigo.trim().toUpperCase() || "MXN" : moneda),
        codigoPostal: inmuebleForm.codigoPostal,
        tipoInmueble: inmuebleForm.tipoInmueble,
        estadoInmueble: inmuebleForm.entidad,
        municipioInmueble: inmuebleForm.municipio,
        calleInmueble: inmuebleForm.calle,
        numeroExteriorInmueble: inmuebleForm.numeroExterior,
        numeroInteriorInmueble: inmuebleForm.numeroInterior,
        coloniaInmueble: inmuebleForm.colonia,
        terrenoM2: "",
        inmuebleM2: "",
        folioReal: inmuebleForm.folioReal,
        inmuebleValorCatastral: (() => {
          const parsed = parseMoneyToCents(inmuebleForm.valorCatastral, { allowZero: true })
          return parsed.ok ? parsed.decimal : ""
        })(),
        instrumentoFecha: instrumentoForm.fecha,
        instrumentoNumero: instrumentoForm.numero,
        instrumentoNotario: instrumentoForm.notario,
        instrumentoEntidad: instrumentoForm.entidad,
        instrumentoValorAvaluo: (() => {
          const parsed = parseMoneyToCents(instrumentoForm.valorAvaluo, { allowZero: true })
          return parsed.ok ? parsed.decimal : ""
        })(),
        instrumentoValorCatastral: (() => {
          const parsed = parseMoneyToCents(instrumentoForm.valorCatastral, { allowZero: true })
          return parsed.ok ? parsed.decimal : ""
        })(),
        clienteNombre,
        clienteNombrePf: personaAvisoActual?.nombre,
        clienteApellidoPaterno: personaAvisoActual?.apellidoPaterno,
        clienteApellidoMaterno: personaAvisoActual?.apellidoMaterno,
        clienteRazonSocial: personaAvisoActual?.denominacion,
        clienteRfc: personaAvisoActual?.rfc ?? expedienteActual?.identifiers.rfc ?? "",
        clienteFechaNacimiento: personaAvisoActual?.fechaNacimiento,
        clienteFechaConstitucion: personaAvisoActual?.fechaConstitucion,
        clienteCurp: personaAvisoActual?.curp,
        clientePais: paisSatOption(personaAvisoActual?.pais),
        clienteGiro: personaAvisoActual?.giro,
        clienteActividadEconomica: personaAvisoActual?.giro,
        clienteOcupacion:
          expedienteActual?.ocupacion?.code && expedienteActual?.ocupacion?.label
            ? `${expedienteActual.ocupacion.code},${expedienteActual.ocupacion.label}`
            : expedienteActual?.ocupacion?.code || expedienteActual?.ocupacion?.label,
        clienteEstado: personaAvisoActual?.domicilio?.entidad,
        clienteMunicipio: personaAvisoActual?.domicilio?.municipio,
        clienteCiudad: personaAvisoActual?.domicilio?.ciudad,
        clienteColonia: personaAvisoActual?.domicilio?.colonia,
        clienteCalle: personaAvisoActual?.domicilio?.calle,
        clienteNumeroExterior: personaAvisoActual?.domicilio?.numeroExterior,
        clienteNumeroInterior: personaAvisoActual?.domicilio?.numeroInterior,
        clienteCodigoPostal: personaAvisoActual?.domicilio?.codigoPostal,
        clientePaisTelefono: paisSatOption(personaAvisoActual?.contacto?.clavePais),
        clienteTelefono: personaAvisoActual?.contacto?.telefono,
        clienteCorreo: personaAvisoActual?.contacto?.correo,
        representanteNombre: personaAvisoActual?.representante?.nombre,
        representanteApellidoPaterno: personaAvisoActual?.representante?.apellidoPaterno,
        representanteApellidoMaterno: personaAvisoActual?.representante?.apellidoMaterno,
        representanteFechaNacimiento: personaAvisoActual?.representante?.fechaNacimiento,
        representanteRfc: personaAvisoActual?.representante?.rfc,
        representanteCurp: personaAvisoActual?.representante?.curp,
        beneficiarioTipoPersonaSat: beneficiarioForm.tipo,
        beneficiarioPfNombre:
          beneficiarioForm.tipo === "persona_fisica" ? beneficiarioForm.nombre : undefined,
        beneficiarioPfApellidoPaterno:
          beneficiarioForm.tipo === "persona_fisica" ? beneficiarioForm.apellidoPaterno : undefined,
        beneficiarioPfApellidoMaterno:
          beneficiarioForm.tipo === "persona_fisica" ? beneficiarioForm.apellidoMaterno : undefined,
        beneficiarioPfFechaNacimiento:
          beneficiarioForm.tipo === "persona_fisica" ? beneficiarioForm.fechaNacimiento : undefined,
        beneficiarioPfRfc:
          beneficiarioForm.tipo === "persona_fisica" ? beneficiarioForm.rfc : undefined,
        beneficiarioPfCurp:
          beneficiarioForm.tipo === "persona_fisica" ? beneficiarioForm.curp : undefined,
        beneficiarioPfPais:
          beneficiarioForm.tipo === "persona_fisica"
            ? paisSatOption(beneficiarioForm.pais)
            : undefined,
        beneficiarioPmRazonSocial:
          beneficiarioForm.tipo === "persona_moral" ? beneficiarioForm.nombre : undefined,
        beneficiarioPmFechaConstitucion:
          beneficiarioForm.tipo === "persona_moral" ? beneficiarioForm.fechaConstitucion : undefined,
        beneficiarioPmRfc:
          beneficiarioForm.tipo === "persona_moral" ? beneficiarioForm.rfc : undefined,
        beneficiarioPmPais:
          beneficiarioForm.tipo === "persona_moral"
            ? paisSatOption(beneficiarioForm.pais)
            : undefined,
        contraparteNombre: contraparteForm.nombre,
        contraparteApellidoPaterno: contraparteForm.apellidoPaterno,
        contraparteApellidoMaterno: contraparteForm.apellidoMaterno,
        contraparteFechaNacimiento: contraparteForm.fechaNacimiento,
        contraparteRfc: contraparteForm.rfc,
        contrapartePais: paisSatOption(contraparteForm.pais),
      },
    })
  }, [
    sujetoObligadoSnapshotActual?.rfc,
    alertaCodigo,
    alertaDescripcion,
    anioSeleccionado,
    beneficiarioForm,
    clienteNombre,
    contraparteForm,
    fechaOperacion,
    figuraClienteInmueble,
    figuraSujetoObligadoInmueble,
    instrumentoForm,
    inmuebleForm.codigoPostal,
    inmuebleForm.calle,
    inmuebleForm.colonia,
    inmuebleForm.entidad,
    inmuebleForm.folioReal,
    inmuebleForm.municipio,
    inmuebleForm.numeroExterior,
    inmuebleForm.numeroInterior,
    inmuebleForm.tipoInmueble,
    inmuebleForm.valorAvaluo,
    inmuebleForm.valorCatastral,
    liquidacionForm.formaPago,
    liquidacionForm.instrumento,
    mesSeleccionado,
    moneda,
    monedaPersonalizadaCodigo,
    montoOperacion,
    personaAvisoActual,
    expedienteActual,
    prioridadAviso,
    referenciaAviso,
    rfc,
    satLayoutActual,
    satTemplateActual,
    satTemplateVariantId,
    tipoOperacion,
  ])

  const tipoOperacionSatField = useMemo(() => {
    const fields = satDynamicFormActual?.sections.flatMap((section) => section.fields) ?? []
    return chooseSatTipoOperacionField(fields)
  }, [satDynamicFormActual])

  const fixedTipoOperacionSat = useMemo(
    () => getFixedSatTipoOperacion(satTemplateActual?.templateId),
    [satTemplateActual?.templateId],
  )

  const tipoOperacionOptions = useMemo(() => {
    const satOptions = tipoOperacionSatField?.options ?? []
    if (satOptions.length > 0) return Array.from(new Set(satOptions.filter(Boolean)))
    return []
  }, [tipoOperacionSatField])

  useEffect(() => {
    if (!fixedTipoOperacionSat || tipoOperacion === fixedTipoOperacionSat) return
    setTipoOperacion(fixedTipoOperacionSat)
  }, [fixedTipoOperacionSat, tipoOperacion])

  const satAllFieldsActual = useMemo(
    () => satDynamicFormActual?.sections.flatMap((section) => section.fields) ?? [],
    [satDynamicFormActual],
  )

  useEffect(() => {
    primaryBeneficiarySatFieldIdsRef.current = new Set(
      satAllFieldsActual
        .filter((field) => field.sectionKind === "beneficiario_controlador")
        .filter((field) => !field.repeatIndex || field.repeatIndex === 1)
        .filter((field) => {
          const semantic = normalizarBusqueda(`${field.id} ${field.label}`)
          return !semantic.includes("fiduciario") && !semantic.includes("fideicomiso")
        })
        .map((field) => field.id),
    )
  }, [satAllFieldsActual])

  useEffect(() => {
    if (!operacionEditandoId) {
      satEditInitializationRef.current = null
      return
    }
    if (!satDynamicFormActual) return

    const signature = `${operacionEditandoId}:${satDynamicFormActual.templateId}`
    if (satEditInitializationRef.current === signature) return
    satEditInitializationRef.current = signature

    const managedFieldIds = new Set(Object.keys(satDynamicFormActual.initialValues))
    satAllFieldsActual.forEach((field) => {
      if (
        field.sectionKind === "alta_sat" ||
        field.sectionKind === "persona_objeto" ||
        field.sectionKind === "beneficiario_controlador"
      ) {
        managedFieldIds.add(field.id)
      }
    })
    setSatFieldValues((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([fieldId]) => !managedFieldIds.has(fieldId)),
      ),
    )
  }, [operacionEditandoId, satAllFieldsActual, satDynamicFormActual])

  const satRawEffectiveFieldValues = useMemo(
    () => ({
      ...(satDynamicFormActual?.initialValues ?? {}),
      ...satFieldValues,
    }),
    [satDynamicFormActual, satFieldValues],
  )

  const satEffectiveFieldValues = useMemo(
    () => {
      const expandedValues = expandSatFieldValuesForDuplicateFields({
        fields: satAllFieldsActual,
        values: satRawEffectiveFieldValues,
      })
      return pruneInactiveSatFieldValues({
        fields: satAllFieldsActual,
        values: expandedValues,
      })
    },
    [satAllFieldsActual, satRawEffectiveFieldValues],
  )

  const satEffectiveCellValues = useMemo(
    () => (satLayoutActual ? satFieldValuesToWorkbookCells(satEffectiveFieldValues, satLayoutActual) : {}),
    [satEffectiveFieldValues, satLayoutActual],
  )

  const satMissingRequiredFields = useMemo(() => {
    if (!satDynamicFormActual) return []
    const missingRequiredIds = satAllFieldsActual
      .filter((field) => isSatXlsmFieldRequired(field, satEffectiveFieldValues))
      .filter((field) => !(satEffectiveFieldValues[field.id] ?? "").trim())
      .map((field) => field.id)
    return getActionableSatMissingFieldIds({
      fields: satAllFieldsActual,
      missingRequiredIds,
      values: satEffectiveFieldValues,
    })
  }, [satAllFieldsActual, satDynamicFormActual, satEffectiveFieldValues])

  const beneficiarioSatMissingFields = useMemo(() => {
    const missingRequiredIds = new Set(satMissingRequiredFields)
    return satAllFieldsActual.filter(
      (field) => field.sectionKind === "beneficiario_controlador" && missingRequiredIds.has(field.id),
    )
  }, [satAllFieldsActual, satMissingRequiredFields])

  const satWorkbookStatusActual = useMemo<"pendiente" | "borrador_bloqueado" | "listo">(() => {
    if (!satDynamicFormActual) return "pendiente"
    return satMissingRequiredFields.length > 0 ? "borrador_bloqueado" : "listo"
  }, [satDynamicFormActual, satMissingRequiredFields.length])

  useEffect(() => {
    if (!satTemplateActual) return
    if (satLayouts[satTemplateActual.templateId]) {
      setSatLayoutsLoaded(true)
      return
    }

    let cancelled = false
    setSatLayoutsLoaded(false)
    fetch(`/data/sat-xlsm-layouts/${satTemplateActual.templateId}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`No fue posible cargar layout SAT: ${response.status}`)
        return response.json()
      })
      .then((layout: SatXlsmLayout) => {
        if (cancelled) return
        setSatLayouts((prev) => ({ ...prev, [layout.templateId]: layout }))
      })
      .catch(() => {
        if (!cancelled) {
          setSatLayouts((prev) => {
            const next = { ...prev }
            delete next[satTemplateActual.templateId]
            return next
          })
        }
      })
      .finally(() => {
        if (!cancelled) setSatLayoutsLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [satLayouts, satTemplateActual])

  const expedientesDisponibles = useMemo(
    () =>
      Object.values(expedientesDetalle).sort((a, b) =>
        (a.nombre ?? getPrimaryExpedienteIdentifier(a.identifiers) ?? a.expedienteId).localeCompare(
          b.nombre ?? getPrimaryExpedienteIdentifier(b.identifiers) ?? b.expedienteId,
          "es",
        ),
      ),
    [expedientesDetalle],
  )

  const fechaBaseExpediente = expedienteActual?.actualizadoEn

  const siguienteRevisionAnual = useMemo(() => {
    if (!relacionNegocios) return null
    const fechaBase = fechaBaseExpediente
    if (!fechaBase) return null
    const fecha = new Date(fechaBase)
    fecha.setFullYear(fecha.getFullYear() + 1)
    return fecha.toISOString().substring(0, 10)
  }, [fechaBaseExpediente, relacionNegocios])

  const resolveSujetoObligadoOptionValue = useCallback(
    (expediente: ExpedienteDetalle) => {
      const matchingTenant = tenantState.tenants.find((tenant) => {
        const tenantTokens = [
          tenant.id,
          tenant.rfc,
          tenant.razonSocial,
          tenant.nombreComercial,
        ].filter((item): item is string => Boolean(item))
        const expedienteTokens = [
          expediente.sujetoObligadoId,
          expediente.sujetoObligadoRfc,
          expediente.sujetoObligadoNombre,
          expediente.claveSujetoObligado,
        ].filter((item): item is string => Boolean(item))

        return expedienteTokens.some((expedienteToken) =>
          tenantTokens.some((tenantToken) => normalizarBusqueda(tenantToken) === normalizarBusqueda(expedienteToken)),
        )
      })

      if (matchingTenant) return `tenant:${matchingTenant.id}`

      return (
        getSujetoObligadoOptionValueFromSnapshot({
          id: expediente.sujetoObligadoId,
          rfc: expediente.sujetoObligadoRfc,
          nombre: expediente.sujetoObligadoNombre,
          clave: expediente.claveSujetoObligado,
        }) || `expediente:${normalizarBusqueda(expediente.expedienteId)}`
      )
    },
    [tenantState.tenants],
  )

  const sujetosObligadosDisponibles = useMemo(() => {
    const mapa = new Map<string, { value: string; label: string; expedientesCount: number }>()
    tenantState.tenants.forEach((tenant) => {
      mapa.set(`tenant:${tenant.id}`, {
        value: `tenant:${tenant.id}`,
        label: `${tenant.razonSocial} · RFC ${tenant.rfc}`,
        expedientesCount: 0,
      })
    })

    expedientesDisponibles.forEach((expediente) => {
      const clave = resolveSujetoObligadoOptionValue(expediente)
      const existing = mapa.get(clave)
      if (existing) {
        mapa.set(clave, {
          ...existing,
          expedientesCount: existing.expedientesCount + 1,
        })
      } else {
        const label =
          expediente.sujetoObligadoNombre ??
          expediente.sujetoObligadoRfc ??
          expediente.claveSujetoObligado ??
          "Sujeto obligado sin nombre"
        mapa.set(clave, {
          value: clave,
          label,
          expedientesCount: 1,
        })
      }
    })
    const operacionEditada = operaciones.find((operacion) => operacion.id === operacionEditandoId)
    const sujetoGuardado = operacionEditada?.sujetoObligado
    const sujetoGuardadoValue = getSujetoObligadoOptionValueFromSnapshot(sujetoGuardado)
    if (sujetoGuardado && sujetoGuardadoValue) {
      mapa.set(sujetoGuardadoValue, {
        value: sujetoGuardadoValue,
        label:
          [sujetoGuardado.nombre, sujetoGuardado.rfc ? `RFC ${sujetoGuardado.rfc}` : ""]
            .filter(Boolean)
            .join(" · ") || "Sujeto obligado conservado en la operación",
        expedientesCount: mapa.get(sujetoGuardadoValue)?.expedientesCount ?? 0,
      })
    }
    return Array.from(mapa.values())
      .filter(
        (opcion) =>
          opcion.expedientesCount > 0 ||
          opcion.value === `tenant:${activeTenant?.id}` ||
          opcion.value === sujetoGuardadoValue,
      )
      .sort((a, b) => a.label.localeCompare(b.label, "es"))
  }, [
    activeTenant?.id,
    expedientesDisponibles,
    operacionEditandoId,
    operaciones,
    resolveSujetoObligadoOptionValue,
    tenantState.tenants,
  ])

  const clientesPorSujetoObligado = useMemo(
    () =>
      expedientesDisponibles
        .filter((expediente) => {
          if (!sujetoObligadoOperacion) return true
          return resolveSujetoObligadoOptionValue(expediente) === sujetoObligadoOperacion
        })
        .map((expediente) => ({
          value: expediente.expedienteId,
          label:
            expediente.nombre ??
            getPrimaryExpedienteIdentifier(expediente.identifiers) ??
            expediente.expedienteId,
          actividad: expediente.activityKey ?? expediente.claveActividadVulnerable,
        })),
    [expedientesDisponibles, resolveSujetoObligadoOptionValue, sujetoObligadoOperacion],
  )

  const sujetoObligadoContexto = useMemo(
    () => sujetosObligadosDisponibles.find((opcion) => opcion.value === sujetoObligadoOperacion) ?? null,
    [sujetoObligadoOperacion, sujetosObligadosDisponibles],
  )

  const actividadRegistroOperacion = useMemo(() => {
    if (!clienteOperacionSeleccionado) {
      return { actividades: [], tieneRegistro: false }
    }
    const expedienteCliente = expedientesDisponibles.find(
      (expediente) => expediente.expedienteId === clienteOperacionSeleccionado,
    )
    if (!expedienteCliente) {
      return { actividades: [], tieneRegistro: false }
    }
    if (expedienteCliente.claveActividadVulnerable) {
      const actividad = resolveActividadPorClave(expedienteCliente.claveActividadVulnerable)
      return {
        actividades: actividad ? [actividad] : [],
        tieneRegistro: Boolean(actividad),
      }
    }

    return { actividades: actividadesVulnerables, tieneRegistro: false }
  }, [clienteOperacionSeleccionado, expedientesDisponibles])

  const actividadesRegistradasCliente = actividadRegistroOperacion.actividades

  const expedienteClienteOperacion = useMemo(
    () =>
      expedientesDisponibles.find(
        (expediente) => expediente.expedienteId === clienteOperacionSeleccionado,
      ) ?? null,
    [clienteOperacionSeleccionado, expedientesDisponibles],
  )

  const actividadOperacionDetalle = useMemo(
    () =>
      actividadesRegistradasCliente.find(
        (actividad) => actividad.key === actividadOperacionSeleccionada,
      ) ?? actividadesRegistradasCliente[0],
    [actividadOperacionSeleccionada, actividadesRegistradasCliente],
  )

  const personasExpedienteOpciones = useMemo(
    () => {
      const personasExpediente = expedienteActual?.personas ?? []
      return personasExpediente.map((persona, index) => {
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
      })
    },
    [expedienteActual?.personas],
  )

  const personaExpedienteSeleccionadaInfo = useMemo(
    () =>
      personasExpedienteOpciones.find((option) => option.id === personaExpedienteSeleccionada) ??
      personasExpedienteOpciones[0],
    [personasExpedienteOpciones, personaExpedienteSeleccionada],
  )

  const personaExpediente = personaExpedienteSeleccionadaInfo?.persona ?? null

  const sincronizarDatosConExpediente = useCallback(() => {
    if (!expedienteActual || !personaAvisoActual || typeof window === "undefined") return

    const identifiers = normalizeExpedienteIdentifiers({
      rfc: personaAvisoActual.rfc,
      nif: personaAvisoActual.nif,
      curp: personaAvisoActual.curp,
    })
    const identifierError = validateExpedienteIdentifiers(
      identifiers,
      personaAvisoActual.tipo === "persona_fisica",
    )
    if (identifierError) {
      toast({
        title: "Revisa los identificadores",
        description: identifierError,
        variant: "destructive",
      })
      return
    }
    const denominacion =
      personaAvisoActual.tipo === "persona_moral"
        ? personaAvisoActual.denominacion ?? clienteNombre
        : [
            personaAvisoActual.nombre,
            personaAvisoActual.apellidoPaterno,
            personaAvisoActual.apellidoMaterno,
          ]
            .filter(Boolean)
            .join(" ")
    const personaActualizada: ExpedientePersona = {
      ...(personaExpediente ?? {}),
      id: personaExpedienteSeleccionadaInfo?.id,
      tipo: personaAvisoActual.tipo,
      denominacion,
      nombre: personaAvisoActual.nombre,
      apellidoPaterno: personaAvisoActual.apellidoPaterno,
      apellidoMaterno: personaAvisoActual.apellidoMaterno,
      fechaNacimiento: personaAvisoActual.fechaNacimiento,
      fechaConstitucion: personaAvisoActual.fechaConstitucion,
      rfc: identifiers.rfc,
      nif: identifiers.nif,
      curp: identifiers.curp,
      pais: personaAvisoActual.pais,
      giro: personaAvisoActual.giro,
      representante: personaAvisoActual.representante,
      domicilio: personaAvisoActual.domicilio,
      contacto: personaAvisoActual.contacto,
    }
    const personas = (expedienteActual.personas ?? []).some(
      (persona) => persona.id === personaActualizada.id,
    )
      ? (expedienteActual.personas ?? []).map((persona) =>
          persona.id === personaActualizada.id ? personaActualizada : persona,
        )
      : [...(expedienteActual.personas ?? []), personaActualizada]
    const beneficiarioActualizado: ExpedientePersona = {
      ...(expedienteActual.beneficiariosControladores?.[0] ?? {}),
      id:
        expedienteActual.beneficiariosControladores?.[0]?.id ??
        `beneficiario-${expedienteActual.expedienteId}-1`,
      tipo: beneficiarioForm.tipo,
      denominacion:
        beneficiarioForm.tipo === "persona_moral"
          ? beneficiarioForm.nombre
          : [
              beneficiarioForm.nombre,
              beneficiarioForm.apellidoPaterno,
              beneficiarioForm.apellidoMaterno,
            ]
              .filter(Boolean)
              .join(" "),
      nombre: beneficiarioForm.nombre,
      apellidoPaterno: beneficiarioForm.apellidoPaterno,
      apellidoMaterno: beneficiarioForm.apellidoMaterno,
      fechaNacimiento: beneficiarioForm.fechaNacimiento,
      fechaConstitucion: beneficiarioForm.fechaConstitucion,
      rfc: beneficiarioForm.rfc,
      curp: beneficiarioForm.curp,
      pais: beneficiarioForm.pais,
      rolRelacion: "Beneficiario controlador",
    }
    const beneficiariosControladores = beneficiarioForm.nombre.trim()
      ? [
          beneficiarioActualizado,
          ...(expedienteActual.beneficiariosControladores?.slice(1) ?? []),
        ]
      : expedienteActual.beneficiariosControladores ?? []
    const actualizadoEn = new Date().toISOString()
    let rawRecords: any[] = []
    try {
      const rawStored = window.localStorage.getItem(EXPEDIENTE_DETALLE_STORAGE_KEY)
      const storedRecords = rawStored ? JSON.parse(rawStored) : []
      rawRecords = Array.isArray(storedRecords) ? storedRecords : []
    } catch (_error) {
      toast({
        title: "No se pudo leer el expediente",
        description: "Los datos locales no tienen un formato válido. Abre el expediente y vuelve a guardarlo.",
        variant: "destructive",
      })
      return
    }
    const baseRaw =
      rawRecords.find(
        (item: any) =>
          item?.expedienteId === expedienteActual.expedienteId ||
          (expedienteActual.rfc && item?.rfc === expedienteActual.rfc),
      ) ?? expedienteActual
    const expedienteEui = baseRaw.expedienteEui && typeof baseRaw.expedienteEui === "object"
      ? baseRaw.expedienteEui
      : {}
    const clienteEui = expedienteEui.cliente && typeof expedienteEui.cliente === "object"
      ? expedienteEui.cliente
      : {}
    const updatedRaw = {
      ...baseRaw,
      schemaVersion: 2,
      expedienteId: expedienteActual.expedienteId,
      rfc: identifiers.rfc,
      identifiers,
      activityKey: expedienteActual.activityKey,
      activityLabel: expedienteActual.activityLabel,
      nombre: denominacion,
      personas,
      beneficiariosControladores,
      operationContext: {
        tipoActoOperacion: tipoOperacion,
        fechaActoOperacion: fechaOperacion,
        relacionNegocios: relacionNegocios ? "si" : "no",
      },
      actualizadoEn,
      expedienteEui: {
        ...expedienteEui,
        schemaVersion: 2,
        expedienteId: expedienteActual.expedienteId,
        activityKey: expedienteActual.activityKey,
        activityLabel: expedienteActual.activityLabel,
        identifiers,
        tipoActoOperacion: tipoOperacion,
        fechaActoOperacion: fechaOperacion,
        relacionNegocios: relacionNegocios ? "si" : "no",
        cliente: {
          ...clienteEui,
          denominacion:
            personaAvisoActual.tipo === "persona_moral" ? denominacion : clienteEui.denominacion,
          nombres:
            personaAvisoActual.tipo === "persona_fisica" ? personaAvisoActual.nombre : clienteEui.nombres,
          apellidoPaterno:
            personaAvisoActual.tipo === "persona_fisica"
              ? personaAvisoActual.apellidoPaterno
              : clienteEui.apellidoPaterno,
          apellidoMaterno:
            personaAvisoActual.tipo === "persona_fisica"
              ? personaAvisoActual.apellidoMaterno
              : clienteEui.apellidoMaterno,
          rfc: identifiers.rfc,
          nif: identifiers.nif,
          curp: identifiers.curp,
        },
      },
    }
    const updatedRecords = rawRecords.some(
      (item: any) =>
        item?.expedienteId === expedienteActual.expedienteId ||
        (expedienteActual.rfc && item?.rfc === expedienteActual.rfc),
    )
      ? rawRecords.map((item: any) =>
          item?.expedienteId === expedienteActual.expedienteId ||
          (expedienteActual.rfc && item?.rfc === expedienteActual.rfc)
            ? updatedRaw
            : item,
        )
      : [...rawRecords, updatedRaw]
    try {
      window.localStorage.setItem(EXPEDIENTE_DETALLE_STORAGE_KEY, JSON.stringify(updatedRecords))
    } catch (_error) {
      toast({
        title: "No se pudo sincronizar",
        description: "El almacenamiento local no está disponible o no tiene espacio suficiente.",
        variant: "destructive",
      })
      return
    }
    const sanitized = sanitizeExpediente(updatedRaw)
    if (sanitized) {
      setExpedientesDetalle((current) => ({
        ...current,
        [sanitized.expedienteId]: sanitized,
      }))
    }
    setRfc(getPrimaryExpedienteIdentifier(identifiers))
    setEditandoDatosEui(false)
    setDatosEuiConfirmados(true)
    toast({
      title: "Expediente sincronizado",
      description: "Los cambios se guardaron en el Expediente único y en el borrador del acto.",
    })
  }, [
    beneficiarioForm,
    clienteNombre,
    expedienteActual,
    fechaOperacion,
    personaAvisoActual,
    personaExpediente,
    personaExpedienteSeleccionadaInfo?.id,
    relacionNegocios,
    tipoOperacion,
    toast,
  ])

  const confirmarBeneficiarioControlador = useCallback(() => {
    const nombreCompleto = beneficiarioForm.nombre.trim()
    const identificador =
      beneficiarioForm.tipo === "persona_moral"
        ? beneficiarioForm.rfc.trim()
        : beneficiarioForm.rfc.trim() || beneficiarioForm.curp.trim()

    if (!nombreCompleto || !identificador) {
      toast({
        title: "Beneficiario incompleto",
        description:
          beneficiarioForm.tipo === "persona_moral"
            ? "Captura la razón social y el RFC o NIF del beneficiario controlador."
            : "Captura el nombre y al menos RFC, NIF o CURP del beneficiario controlador.",
        variant: "destructive",
      })
      return
    }

    if (beneficiarioSatMissingFields.length > 0) {
      toast({
        title: "Beneficiario incompleto para el formato SAT",
        description: `Completa: ${beneficiarioSatMissingFields.map((field) => field.label).join(", ")}.`,
        variant: "destructive",
      })
      return
    }

    if (expedienteActual && personaAvisoActual) {
      sincronizarDatosConExpediente()
      return
    }

    setDatosEuiConfirmados(true)
    toast({
      title: "Beneficiario confirmado",
      description: "Los datos quedarán guardados en el snapshot de esta operación.",
    })
  }, [
    beneficiarioForm,
    beneficiarioSatMissingFields,
    expedienteActual,
    personaAvisoActual,
    sincronizarDatosConExpediente,
    toast,
  ])

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
    setEditandoDatosEui(false)
    if (!personaExpediente) {
      setPersonaAvisoActual(null)
      setClienteNombre(expedienteActual?.nombre ?? "")
      setRfc(
        expedienteActual
          ? getPrimaryExpedienteIdentifier(expedienteActual.identifiers).toUpperCase()
          : "",
      )
      setBeneficiarioForm((prev) => ({
        ...prev,
        nombre: "",
        apellidoPaterno: "",
        apellidoMaterno: "",
        fechaNacimiento: "",
        fechaConstitucion: "",
        rfc: "",
        curp: "",
        pais: BENEFICIARIO_FORM_DEFAULT.pais,
      }))
      if (expedienteActual?.tipoCliente) {
        setTipoCliente(expedienteActual.tipoCliente)
      }
      if (expedienteActual?.detalleTipoCliente) {
        setDetalleTipoCliente(expedienteActual.detalleTipoCliente)
      }
      if (expedienteActual?.claveSujetoObligado) {
        setClaveSujetoObligado(expedienteActual.claveSujetoObligado)
      }
      if (expedienteActual?.activityKey || expedienteActual?.claveActividadVulnerable) {
        const expedienteActivityKey =
          expedienteActual.activityKey ?? expedienteActual.claveActividadVulnerable ?? ""
        setActividadKey(expedienteActivityKey)
        setClaveActividad(expedienteActivityKey)
      }
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

    const identificadorPersona =
      personaAviso?.rfc ||
      personaAviso?.nif ||
      personaAviso?.curp ||
      (expedienteActual ? getPrimaryExpedienteIdentifier(expedienteActual.identifiers) : "")
    setRfc(identificadorPersona ? identificadorPersona.toUpperCase() : "")

    const beneficiarioExpediente = expedienteActual?.beneficiariosControladores?.[0]
    if (beneficiarioExpediente) {
      const beneficiarioEsMoral = beneficiarioExpediente.tipo === "persona_moral"
      const nombreCompleto = beneficiarioExpediente.denominacion?.split(/\s+/).filter(Boolean) ?? []
      setBeneficiarioForm((prev) => ({
        ...prev,
        tipo: beneficiarioEsMoral ? "persona_moral" : "persona_fisica",
        nombre: beneficiarioEsMoral
          ? beneficiarioExpediente.denominacion ?? beneficiarioExpediente.nombre ?? ""
          : beneficiarioExpediente.nombre ?? nombreCompleto[0] ?? "",
        apellidoPaterno: beneficiarioEsMoral
          ? ""
          : beneficiarioExpediente.apellidoPaterno ?? nombreCompleto[1] ?? "",
        apellidoMaterno: beneficiarioEsMoral
          ? ""
          : beneficiarioExpediente.apellidoMaterno ?? nombreCompleto.slice(2).join(" "),
        fechaNacimiento: beneficiarioEsMoral ? "" : beneficiarioExpediente.fechaNacimiento ?? "",
        fechaConstitucion: beneficiarioEsMoral ? beneficiarioExpediente.fechaConstitucion ?? "" : "",
        rfc: beneficiarioExpediente.rfc ?? beneficiarioExpediente.nif ?? "",
        curp: beneficiarioEsMoral ? "" : beneficiarioExpediente.curp ?? "",
        pais: beneficiarioExpediente.pais ?? BENEFICIARIO_FORM_DEFAULT.pais,
      }))
    } else {
      setBeneficiarioForm((prev) => ({
        ...prev,
        nombre: "",
        apellidoPaterno: "",
        apellidoMaterno: "",
        fechaNacimiento: "",
        fechaConstitucion: "",
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
    if (expedienteActual?.activityKey || expedienteActual?.claveActividadVulnerable) {
      const expedienteActivityKey =
        expedienteActual.activityKey ?? expedienteActual.claveActividadVulnerable ?? ""
      setActividadKey(expedienteActivityKey)
      setClaveActividad(expedienteActivityKey)
    }
    if (expedienteActual?.operationContext?.tipoActoOperacion) {
      setTipoOperacion(expedienteActual.operationContext.tipoActoOperacion)
    }
    if (expedienteActual?.operationContext?.fechaActoOperacion) {
      setFechaOperacion(expedienteActual.operationContext.fechaActoOperacion)
    }
    if (expedienteActual?.operationContext?.relacionNegocios) {
      setRelacionNegocios(expedienteActual.operationContext.relacionNegocios === "si")
    }
  }, [personaExpediente, expedienteActual])

  useEffect(() => {
    setDatosEuiConfirmados(false)
  }, [expedienteSeleccionado, personaExpedienteSeleccionada])

  useEffect(() => {
    if (sujetosObligadosDisponibles.length === 0) {
      if (sujetoObligadoOperacion) {
        setSujetoObligadoOperacion("")
      }
      return
    }

    if (sujetosObligadosDisponibles.some((sujeto) => sujeto.value === sujetoObligadoOperacion)) {
      return
    }

    const activeTenantValue = activeTenant?.id ? `tenant:${activeTenant.id}` : ""
    const defaultSujeto =
      sujetosObligadosDisponibles.find((sujeto) => sujeto.value === activeTenantValue) ??
      sujetosObligadosDisponibles[0]
    setSujetoObligadoOperacion(defaultSujeto.value)
  }, [activeTenant?.id, sujetoObligadoOperacion, sujetosObligadosDisponibles])

  useEffect(() => {
    const clienteActualDisponible = clientesPorSujetoObligado.some(
      (cliente) => cliente.value === clienteOperacionSeleccionado,
    )

    if (clientesPorSujetoObligado.length === 0) {
      if (clienteOperacionSeleccionado) {
        setClienteOperacionSeleccionado("")
      }
      if (expedienteSeleccionado) {
        setExpedienteSeleccionado(null)
      }
      setPersonaExpedienteSeleccionada("")
      setPersonaAvisoActual(null)
      return
    }

    if (clienteActualDisponible) {
      return
    }

    if (clientesPorSujetoObligado.length === 1) {
      setClienteOperacionSeleccionado(clientesPorSujetoObligado[0].value)
      return
    }

    if (clienteOperacionSeleccionado) {
      setClienteOperacionSeleccionado("")
    }
    if (expedienteSeleccionado) {
      setExpedienteSeleccionado(null)
    }
    setPersonaExpedienteSeleccionada("")
    setPersonaAvisoActual(null)
  }, [clienteOperacionSeleccionado, clientesPorSujetoObligado, expedienteSeleccionado])

  useEffect(() => {
    if (!clienteOperacionSeleccionado || expedienteSeleccionado === clienteOperacionSeleccionado) return
    const existeExpediente = expedientesDisponibles.some(
      (expediente) => expediente.expedienteId === clienteOperacionSeleccionado,
    )
    if (!existeExpediente) return
    setExpedienteSeleccionado(clienteOperacionSeleccionado)
    setPersonaExpedienteSeleccionada("")
    setPersonaAvisoActual(null)
  }, [clienteOperacionSeleccionado, expedienteSeleccionado, expedientesDisponibles])

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
    return operaciones.filter(
      (operacion) =>
        operacion.actividadKey === actividadSeleccionada.key &&
        operacion.rfc.toUpperCase() === rfc.trim().toUpperCase() &&
        getSujetoObligadoIdentityKey(operacion.sujetoObligado) ===
          getSujetoObligadoIdentityKey(sujetoObligadoSnapshotActual) &&
        operacion.id !== operacionEditandoId &&
        !isOperacionCancelada(operacion) &&
        !operacion.avisoPresentado,
    )
  }, [
    actividadSeleccionada,
    operacionEditandoId,
    operaciones,
    rfc,
    sujetoObligadoSnapshotActual,
  ])

  const pepScreeningCliente = useMemo(() => {
    if (!pepCargoCliente.trim() && !pepDependenciaCliente.trim()) return null

    return matchPepCargo({
      nombre: clienteNombre,
      cargo: pepCargoCliente,
      dependencia: pepDependenciaCliente,
      relacion: pepRelacionCliente as "cliente" | "beneficiario-controlador" | "representante" | "familiar" | "socio" | "otro",
    })
  }, [clienteNombre, pepCargoCliente, pepDependenciaCliente, pepRelacionCliente])

  const montoOperacionParseado = useMemo(
    () => parseMoneyToCents(montoOperacion, { allowZero: sospecha24h }),
    [montoOperacion, sospecha24h],
  )
  const montoOperacionCentavos = montoOperacionParseado.ok ? montoOperacionParseado.cents : 0
  const montoOperacionNumero = centsToMoney(montoOperacionCentavos)

  const evaluacionActual = useMemo(() => {
    if (!actividadSeleccionada || !umaSeleccionada || !umbralPesos) return null
    const monto = montoOperacionNumero
    if ((!montoOperacionParseado.ok || monto <= 0) && sospecha24h) {
      const salida = classifyAvisoSalida({
        status: "aviso",
        fechaOperacion,
        sospecha24h: true,
        evidenceCanClose: true,
      })
      return {
        status: "aviso" as UmbralStatus,
        alerta: "Aviso de 24 horas por indicios o sospecha. Documentar hechos y evidencia disponible.",
        acumulado: 0,
        acumulacionAplica: false,
        acumulacionRazon: "El aviso de 24 horas no depende de acumulacion semestral ni de cierre documental.",
        acumulacionAdvertencia: undefined,
        acumulacionFuente: "RCG art. 27",
        monto: 0,
        periodo: buildPeriodo(anioSeleccionado, mesSeleccionado),
        fechaLimiteAviso: undefined,
        operacionesConsideradas: 0,
        obligaciones: [
          "Presentar aviso dentro de las 24 horas siguientes al conocimiento del indicio.",
          "Conservar narrativa de hechos, fuente de la alerta y evidencia disponible.",
        ],
        salida,
      }
    }
    if (!montoOperacionParseado.ok || monto <= 0) return null
    const resultado = evaluarOperacionVulnerable({
      actividadKey: actividadSeleccionada.key,
      clienteKey: rfc.trim().toUpperCase(),
      fechaOperacion,
      montoMxn: monto,
      operacionesHistoricas: operacionesRelacionadas.map((operacion) => ({
        id: operacion.id,
        actividadKey: operacion.actividadKey,
        clienteKey: operacion.rfc.toUpperCase(),
        fechaOperacion: operacion.fechaOperacion,
        montoMxn: centsToMoney(
          operacion.montoCentavos ?? coerceLegacyMoneyToCents(operacion.monto),
        ),
      })),
    })
    const alerta = obtenerAlertaPorStatus(resultado.status)
    const salida = classifyAvisoSalida({
      status: resultado.status,
      fechaOperacion,
      supuesto27Bis: mismoGrupo === "si" && resultado.status === "aviso",
      sospecha24h,
      evidenceCanClose: true,
    })

    return {
      status: resultado.status,
      alerta,
      acumulado: resultado.acumulacion.montoAcumuladoMxn,
      acumulacionAplica: resultado.acumulacion.rule.applies,
      acumulacionRazon: resultado.acumulacion.rule.rationale,
      acumulacionAdvertencia: resultado.acumulacion.rule.warning,
      acumulacionFuente: resultado.acumulacion.rule.source,
      monto,
      periodo: buildPeriodo(anioSeleccionado, mesSeleccionado),
      fechaLimiteAviso: resultado.fechaLimiteAviso,
      operacionesConsideradas: resultado.acumulacion.operacionesConsideradas.length,
      obligaciones: resultado.obligaciones,
      salida,
    }
  }, [
    actividadSeleccionada,
    umaSeleccionada,
    umbralPesos,
    montoOperacionNumero,
    montoOperacionParseado.ok,
    operacionesRelacionadas,
    anioSeleccionado,
    mesSeleccionado,
    fechaOperacion,
    mismoGrupo,
    rfc,
    sospecha24h,
  ])

  const controlesEvaluacion = useMemo(() => {
    if (!evaluacionActual) return []
    return CONTROLES_ARTICULO_17[evaluacionActual.status] ?? []
  }, [evaluacionActual])

  const pagoRecurrenteMensualidadParseado = useMemo(
    () =>
      pagoRecurrenteMensualidad.trim()
        ? parseMoneyToCents(pagoRecurrenteMensualidad, { allowZero: false })
        : null,
    [pagoRecurrenteMensualidad],
  )

  const revisionPagoRecurrente = useMemo(
    () =>
      detectRecurringPaymentReview({
        actividadKey: actividadSeleccionada?.key ?? "",
        mesesCubiertos: Number(pagoRecurrenteMeses) || 1,
        montoMxn: montoOperacionNumero,
        mensualidadEsperadaMxn:
          pagoRecurrenteMensualidadParseado?.ok
            ? centsToMoney(pagoRecurrenteMensualidadParseado.cents)
            : undefined,
        salidaTipo: evaluacionActual?.salida.tipo ?? evaluacionActual?.status,
      }),
    [
      actividadSeleccionada?.key,
      evaluacionActual?.salida.tipo,
      evaluacionActual?.status,
      montoOperacionNumero,
      pagoRecurrenteMensualidadParseado,
      pagoRecurrenteMeses,
    ],
  )

  const satOutputKindActual = useMemo<SatOutputKind>(() => {
    if (sospecha24h) return "aviso_24h"
    if (mismoGrupo === "si" && evaluacionActual?.status === "aviso") return "informe_27_bis"
    if (evaluacionActual?.salida.tipo) {
      return toSatOutputKind(evaluacionActual.salida.tipo, "informe_ceros")
    }
    return evaluacionActual?.status === "aviso" ? "aviso_normal" : "informe_ceros"
  }, [evaluacionActual, mismoGrupo, sospecha24h])

  const evidenceDecisionActual = useMemo(
    () =>
      evaluateOperationalEvidenceDecision({
        tipoCliente,
        actividadKey: actividadSeleccionada?.key,
        completed: draftEvidenceChecklist,
        justifications: draftEvidenceJustifications,
        outputKind: satOutputKindActual,
        suspicionNarrative: alertaDescripcion || evidencia,
      }),
    [
      tipoCliente,
      actividadSeleccionada,
      draftEvidenceChecklist,
      draftEvidenceJustifications,
      satOutputKindActual,
      alertaDescripcion,
      evidencia,
    ],
  )

  const ebrMetodologiaActual = useMemo(
    () =>
      evaluatePldEbrMethodology({
        actividadKey: actividadSeleccionada?.key ?? "fraccion-v-inmuebles",
        cliente: {
          tipoPersona: tipoCliente,
          actividadEconomica: actividadSeleccionada?.nombre,
          pepStatus:
            pepScreeningCliente?.status === "coincidencia-cargo"
              ? "coincidencia_alta"
              : pepScreeningCliente?.status === "posible-pep"
                ? "posible_coincidencia"
              : undefined,
          beneficiarioControladorIdentificado:
            tipoCliente.startsWith("pf") ||
            Boolean(beneficiarioForm.nombre.trim()),
          listasRestrictivas: "sin-coincidencia",
          congruenciaTransaccional:
            evaluacionActual?.status === "aviso" || sospecha24h ? "inusual" : "esperada",
        },
        productoServicio: {
          altoValor: montoOperacionNumero >= 500000,
          portabilidad:
            actividadSeleccionada?.key.includes("vehiculos") ||
            actividadSeleccionada?.key.includes("metales") ||
            actividadSeleccionada?.key.includes("activos-virtuales"),
          efectivo: liquidacionForm.formaPago === "3" || tipoOperacion.toLowerCase().includes("efectivo"),
          transferibilidad:
            actividadSeleccionada?.key.includes("vehiculos") ||
            actividadSeleccionada?.key.includes("metales") ||
            actividadSeleccionada?.key.includes("activos-virtuales"),
          anonimato: sospecha24h || !rfc.trim(),
        },
        canal: {
          tipo: "presencial",
          intermediario: Boolean(personaAvisoActual?.representante || instrumentoForm.notario.trim()),
        },
        geografia: {
          zonaRiesgo: sospecha24h
            ? "alta_incidencia"
            : inmuebleForm.entidad &&
                ["Baja California", "Sonora", "Chihuahua", "Coahuila", "Nuevo León", "Tamaulipas", "Quintana Roo", "Chiapas"].includes(
                  inmuebleForm.entidad,
                )
              ? "fronteriza"
              : "ordinaria",
          frontera: Boolean(
            inmuebleForm.entidad &&
              ["Baja California", "Sonora", "Chihuahua", "Coahuila", "Nuevo León", "Tamaulipas", "Quintana Roo", "Chiapas"].includes(
                inmuebleForm.entidad,
              ),
          ),
        },
        controles: {
          gobiernoCorporativo: tenantOperacionalActual?.responsablesInternos.length ? "media" : "baja",
          representanteCumplimiento: tenantOperacionalActual?.representanteCumplimiento.nombre ? "alta" : "baja",
          manualPld: tenantOperacionalActual?.manual.version ? "alta" : "baja",
          capacitacion: "media",
          monitoreoAutomatizado: "media",
          auditoria: "media",
          kyc: clienteNombre && rfc ? "media" : "baja",
          beneficiarioControlador: tipoCliente.startsWith("pf") || beneficiarioForm.nombre.trim() ? "media" : "baja",
          resguardoDocumental: evidenceDecisionActual.canClose ? "alta" : "media",
          presentacionAvisos: evaluacionActual ? "media" : "baja",
        },
      }),
    [
      tenantOperacionalActual,
      actividadSeleccionada,
      beneficiarioForm.nombre,
      clienteNombre,
      evidenceDecisionActual.canClose,
      evaluacionActual,
      inmuebleForm.entidad,
      instrumentoForm.notario,
      liquidacionForm.formaPago,
      montoOperacionNumero,
      pepScreeningCliente,
      personaAvisoActual,
      rfc,
      sospecha24h,
      tipoCliente,
      tipoOperacion,
    ],
  )

  const operationalCasePreview = useMemo(() => {
    if (!tenantOperacionalActual || !actividadSeleccionada || !clienteNombre.trim() || !rfc.trim() || !evaluacionActual) {
      return null
    }

    return buildPldOperationalCase({
      tenant: tenantOperacionalActual,
      periodo: buildPeriodo(anioSeleccionado, mesSeleccionado),
      actividadKey: actividadSeleccionada.key,
      clienteId: rfc.trim().toUpperCase(),
      clienteNombre: clienteNombre.trim(),
      clienteRfc: rfc.trim().toUpperCase(),
      tipoCliente,
      fechaOperacion,
      montoMxn: montoOperacionNumero,
      montoCentavos: montoOperacionCentavos,
      formaPago: moneda === "OTRA" ? monedaPersonalizadaCodigo.trim().toUpperCase() || "OTRA" : moneda,
      sospecha24h,
      supuesto27Bis: mismoGrupo === "si" && evaluacionActual.status === "aviso",
      alertaCodigo,
      alertaDescripcion,
      suspicionNarrative: alertaDescripcion || evidencia,
      completedEvidence: draftEvidenceChecklist,
      evidenceJustifications: draftEvidenceJustifications,
      satTemplateId: satTemplateActual?.templateId,
      satTemplateFile: satTemplateActual?.officialXlsmName,
      satTemplateVariant: satTemplateVariantId || satTemplateActual?.templateId,
      satFieldValues: satEffectiveFieldValues,
      satCellValues: satEffectiveCellValues,
      satMissingRequiredFields,
      satWorkbookStatus: satWorkbookStatusActual,
      actor: tenantOperacionalActual.representanteCumplimiento.nombre,
    })
  }, [
    tenantOperacionalActual,
    actividadSeleccionada,
    alertaCodigo,
    alertaDescripcion,
    anioSeleccionado,
    clienteNombre,
    draftEvidenceChecklist,
    draftEvidenceJustifications,
    evidencia,
    evaluacionActual,
    fechaOperacion,
    mesSeleccionado,
    mismoGrupo,
    moneda,
    monedaPersonalizadaCodigo,
    montoOperacionNumero,
    rfc,
    satEffectiveCellValues,
    satEffectiveFieldValues,
    satMissingRequiredFields,
    satTemplateActual,
    satTemplateVariantId,
    satWorkbookStatusActual,
    sospecha24h,
    tipoCliente,
  ])

  const checklistEntriesOperacion = useMemo(
    () => (operacionDocumentos ? Object.entries(operacionDocumentos.requisitosChecklist) : []),
    [operacionDocumentos],
  )
  const requisitosOperacion = useMemo(
    () =>
      operacionDocumentos
        ? getDocumentRequirementsForCliente(operacionDocumentos.tipoCliente, operacionDocumentos.actividadKey)
        : [],
    [operacionDocumentos],
  )
  const requisitosOperacionPorLabel = useMemo(
    () =>
      requisitosOperacion.reduce<Record<string, DocumentRequirement>>((acc, requisito) => {
        acc[requisito.label] = requisito
        return acc
      }, {}),
    [requisitosOperacion],
  )
  const evaluacionEvidenciaOperacion = useMemo(
    () => (operacionDocumentos ? evaluarEvidenciaOperacion(operacionDocumentos) : null),
    [operacionDocumentos],
  )
  const salidaOperacionDocumentos = useMemo(
    () =>
      operacionDocumentos
        ? classifyAvisoSalida({
            status: operacionDocumentos.umbralStatus,
            fechaOperacion: operacionDocumentos.fechaOperacion,
            supuesto27Bis: operacionDocumentos.mismoGrupo && operacionDocumentos.umbralStatus === "aviso",
            sospecha24h: Boolean(operacionDocumentos.sospecha24h),
            evidenceCanClose: evaluacionEvidenciaOperacion?.canClose,
          })
        : null,
    [operacionDocumentos, evaluacionEvidenciaOperacion],
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
  const evidenciasRegistradasOperacion = operacionDocumentos?.documentosSoporte.length ?? 0
  const checklistPendientesOperacion = Math.max(
    checklistTotalesOperacion - checklistCompletadosOperacion,
    0,
  )

  const operacionesActivas = useMemo(
    () => operaciones.filter((operacion) => !isOperacionCancelada(operacion)),
    [operaciones],
  )

  const resumenUmbrales = useMemo(() => {
    const acumulados = operacionesActivas.reduce(
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
  }, [operacionesActivas])

  const resumenSalidas = useMemo(() => {
    const acumulados = operacionesActivas.reduce(
      (acc, operacion) => {
        const tipo = operacion.avisoSalidaTipo ?? "sin_salida"
        acc[tipo] = (acc[tipo] ?? 0) + 1
        return acc
      },
      {} as Record<AvisoSalidaTipo, number>,
    )

    return {
      avisoNormal: acumulados.aviso_normal ?? 0,
      informe27Bis: acumulados.informe_27_bis ?? 0,
      aviso24h: acumulados.aviso_24h ?? 0,
      sinSalida: acumulados.sin_salida ?? 0,
      informeCeros:
        (acumulados.aviso_normal ?? 0) + (acumulados.informe_27_bis ?? 0) + (acumulados.aviso_24h ?? 0) === 0
          ? 1
          : 0,
    }
  }, [operacionesActivas])

  const seguimientoMonitoringView = useMemo(
    () =>
      buildOperationalMonitoringView({
        operations: operacionesActivas.map((operacion) => ({
          umbralStatus: operacion.umbralStatus,
          alerta: operacion.alerta,
          alertaResuelta: operacion.alertaResuelta,
        })),
      }),
    [operacionesActivas],
  )

  const hayFiltrosOperaciones = Boolean(
    busquedaOperaciones.trim() ||
      filtroActividadOperaciones !== "todas" ||
      filtroPeriodoOperaciones !== "todos" ||
      filtroEstadoOperaciones !== "todos",
  )

  const actividadesFiltroOperaciones = useMemo(
    () =>
      Array.from(
        new Map(
          operaciones.map((operacion) => [
            operacion.actividadKey,
            { value: operacion.actividadKey, label: operacion.actividadNombre },
          ]),
        ).values(),
      ).sort((a, b) => a.label.localeCompare(b.label, "es")),
    [operaciones],
  )

  const periodosFiltroOperaciones = useMemo(
    () => Array.from(new Set(operaciones.map((operacion) => operacion.periodo).filter(Boolean))).sort().reverse(),
    [operaciones],
  )

  const operacionesFiltradas = useMemo(() => {
    const query = normalizarBusqueda(busquedaOperaciones)
    const queryTerms = query.split(" ").filter(Boolean)
    return [...operaciones]
      .filter((operacion) => {
        if (filtroActividadOperaciones !== "todas" && operacion.actividadKey !== filtroActividadOperaciones) {
          return false
        }
        if (filtroPeriodoOperaciones !== "todos" && operacion.periodo !== filtroPeriodoOperaciones) {
          return false
        }
        if (filtroEstadoOperaciones !== "todos") {
          const cancelada = isOperacionCancelada(operacion)
          const coincideEstado =
            filtroEstadoOperaciones === "cancelled"
              ? cancelada
              : filtroEstadoOperaciones === "presented"
                ? !cancelada &&
                  operacion.submission?.status !== "correction-pending" &&
                  Boolean(operacion.submission?.wasEverPresented || operacion.avisoPresentado)
                : filtroEstadoOperaciones === "correction_pending"
                  ? !cancelada && operacion.submission?.status === "correction-pending"
                  : !cancelada && operacion.umbralStatus === filtroEstadoOperaciones
          if (!coincideEstado) return false
        }
        if (queryTerms.length === 0) return true
        const searchable = normalizarBusqueda(
          [
            operacion.cliente,
            operacion.rfc,
            operacion.tipoOperacion,
            operacion.actividadNombre,
            operacion.periodo,
            operacion.periodo?.replace(/^(\d{4})(\d{2})$/, "$1-$2"),
            operacion.referenciaAviso,
          ]
            .filter(Boolean)
            .join(" "),
        )
        return queryTerms.every((term) => searchable.includes(term))
      })
      .sort((a, b) => getOperacionRecencyTimestamp(b) - getOperacionRecencyTimestamp(a))
  }, [
    busquedaOperaciones,
    filtroActividadOperaciones,
    filtroEstadoOperaciones,
    filtroPeriodoOperaciones,
    operaciones,
  ])

  const operacionesSeguimiento = useMemo(() => {
    const priority: Record<UmbralStatus, number> = {
      aviso: 0,
      identificacion: 1,
      "sin-obligacion": 2,
    }

    return operacionesFiltradas
      .filter((operacion) => !isOperacionCancelada(operacion))
      .filter((operacion) => seguimientoFiltro === "todos" || operacion.umbralStatus === seguimientoFiltro)
      .sort((a, b) => {
        const byPriority = priority[a.umbralStatus] - priority[b.umbralStatus]
        if (byPriority !== 0) return byPriority
        return getOperacionRecencyTimestamp(b) - getOperacionRecencyTimestamp(a)
      })
  }, [operacionesFiltradas, seguimientoFiltro])

  const operacionesRecientes = useMemo(() => {
    return hayFiltrosOperaciones ? operacionesFiltradas : operacionesFiltradas.slice(0, 5)
  }, [hayFiltrosOperaciones, operacionesFiltradas])

  const operacionEnEdicionCompleta = useMemo(
    () => operaciones.find((operacion) => operacion.id === operacionEditandoId) ?? null,
    [operacionEditandoId, operaciones],
  )

  const clientesRegistrados = useMemo(() => {
    const mapa = new Map<string, { rfc: string; nombre: string }>()
    operacionesActivas.forEach((operacion) => {
      if (!mapa.has(operacion.rfc)) {
        mapa.set(operacion.rfc, { rfc: operacion.rfc, nombre: operacion.cliente })
      }
    })
    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  }, [operacionesActivas])

  const operacionesClienteSeleccionado = useMemo(() => {
    if (!clienteCalendario) return []
    return operacionesActivas
      .filter((operacion) => operacion.rfc === clienteCalendario)
      .sort((a, b) => toDate(a.fechaOperacion).getTime() - toDate(b.fechaOperacion).getTime())
  }, [clienteCalendario, operacionesActivas])

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
      operacionesActivas
        .filter((operacion) => operacion.alerta && !operacion.alertaResuelta)
        .sort((a, b) => toDate(b.fechaOperacion).getTime() - toDate(a.fechaOperacion).getTime()),
    [operacionesActivas],
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

const wizardStepDiagnostics = useMemo<OperationalWizardStepDiagnostics[]>(
  () =>
    STEPS.map((_, index) =>
      buildOperationalStepDiagnostics({
        stepIndex: index,
        hasActiveTenant: Boolean(tenantOperacionalActual),
        hasUma: Boolean(umaSeleccionada),
        hasActividad: Boolean(actividadKey),
        hasSatFormato: Boolean(satFormatoActual),
        clienteNombre,
        rfc,
        tipoClienteRequiresDetalle: Boolean(tipoClienteSeleccionado?.requiresDetalle),
        detalleTipoCliente,
        tipoOperacion,
        montoOperacion,
        sospecha24h,
        esActividadInmuebles,
        satWorkbookStatus: satWorkbookStatusActual,
        satMissingRequiredFields,
        evidenceCanSave: evidenceDecisionActual.canSave,
        evidenceCanClose: evidenceDecisionActual.canClose,
        evidenceMissingCriticalLabels: evidenceDecisionActual.missingCritical.map((item) => item.label),
        alertaNarrativa: alertaDescripcion || evidencia,
        hasEvaluacion: Boolean(evaluacionActual),
      }),
    ),
  [
    tenantOperacionalActual,
    actividadKey,
    satFormatoActual,
    umaSeleccionada,
    clienteNombre,
    rfc,
    tipoOperacion,
    montoOperacion,
    sospecha24h,
    evaluacionActual,
    evidenceDecisionActual,
    alertaDescripcion,
    evidencia,
    tipoClienteSeleccionado,
    detalleTipoCliente,
    esActividadInmuebles,
    satWorkbookStatusActual,
    satMissingRequiredFields,
  ],
)
const pasoDiagnostics = wizardStepDiagnostics[pasoActual]
const beneficiarioCompleto = Boolean(
  beneficiarioForm.nombre.trim() &&
    (beneficiarioForm.tipo === "persona_moral"
      ? beneficiarioForm.rfc.trim()
      : beneficiarioForm.rfc.trim() || beneficiarioForm.curp.trim()) &&
    beneficiarioSatMissingFields.length === 0,
)
const requiereConfirmacionBeneficiario = pasoActual === 3
const pasoValido =
  (pasoDiagnostics?.canContinue ?? false) &&
  (!requiereConfirmacionBeneficiario || (beneficiarioCompleto && datosEuiConfirmados))
const blockingReasonsView = useMemo(
  () =>
    buildBlockingReasonsView({
      title: "Qué falta para avanzar",
      reasons: pasoDiagnostics?.reasons ?? [],
    }),
  [pasoDiagnostics],
)
const acumulacionSourceDisplay = useMemo(
  () =>
    acumulacionRuleActual
      ? buildRegulatorySourceDisplay({
          primarySource: acumulacionRuleActual.source,
          rationale: acumulacionRuleActual.rationale,
          warning: acumulacionRuleActual.warning,
          sourceUrl: acumulacionRuleActual.sourceUrl,
        })
      : null,
  [acumulacionRuleActual],
)
const satWorkbookStatusLabel = useMemo(
  () => formatSatWorkbookStatus(satWorkbookStatusActual, satMissingRequiredFields.length),
  [satWorkbookStatusActual, satMissingRequiredFields.length],
)
const contextClienteLabel = useMemo(
  () =>
    clienteOperacionSeleccionado
      ? clientesPorSujetoObligado.find((cliente) => cliente.value === clienteOperacionSeleccionado)?.label ??
        clienteNombre
      : clienteNombre,
  [clienteOperacionSeleccionado, clienteNombre, clientesPorSujetoObligado],
)
const contextActividadSeleccionada = actividadOperacionDetalle ?? actividadSeleccionada ?? null
const contextSatFormato = useMemo(
  () => (contextActividadSeleccionada ? resolveSatFormatoForActividad(contextActividadSeleccionada.key) : null),
  [contextActividadSeleccionada],
)
const contextMissingReasons = useMemo(() => {
  const reasons: Array<{ id: string; label: string; description: string; step: number }> = []

  if (!tenantOperacionalActual) {
    reasons.push({
      id: "context-tenant",
      label: "Sujeto obligado",
      description: "Carga o confirma el sujeto obligado que reportará.",
      step: 0,
    })
  }
  if (!umaSeleccionada) {
    reasons.push({
      id: "context-periodo",
      label: "Periodo",
      description: "Selecciona un mes con UMA vigente.",
      step: 0,
    })
  }
  if (!clienteOperacionSeleccionado && !expedienteSeleccionado && !clienteNombre.trim()) {
    reasons.push({
      id: "context-cliente",
      label: "Cliente/EUI",
      description: "Selecciona un expediente o captura el cliente.",
      step: 2,
    })
  }
  if (!contextActividadSeleccionada) {
    reasons.push({
      id: "context-actividad",
      label: "Actividad vulnerable",
      description: "Selecciona la fracción o subformato SAT aplicable.",
      step: 1,
    })
  }
  if (contextActividadSeleccionada && !contextSatFormato) {
    reasons.push({
      id: "context-formato",
      label: "Formato SAT",
      description: "Resuelve la plantilla oficial para la fracción seleccionada.",
      step: 1,
    })
  }

  return reasons
}, [
  tenantOperacionalActual,
  clienteNombre,
  clienteOperacionSeleccionado,
  contextActividadSeleccionada,
  contextSatFormato,
  expedienteSeleccionado,
  umaSeleccionada,
])
const firstIncompleteStep = useMemo(
  () => wizardStepDiagnostics.findIndex((diagnostic) => !diagnostic.canContinue),
  [wizardStepDiagnostics],
)
const captureContextStatus =
  contextMissingReasons.length > 0 ? "Falta" : firstIncompleteStep === -1 ? "Completo" : "Revisar"

const sincronizarContextoOperacion = () => {
  if (clienteOperacionSeleccionado && expedienteSeleccionado !== clienteOperacionSeleccionado) {
    setExpedienteSeleccionado(clienteOperacionSeleccionado)
    setPersonaExpedienteSeleccionada("")
    setPersonaAvisoActual(null)
  }
  if (contextActividadSeleccionada && actividadKey !== contextActividadSeleccionada.key) {
    setActividadKey(contextActividadSeleccionada.key)
    setActividadInfoKey(contextActividadSeleccionada.key)
  }
  setAnioSeleccionado(anioOperacionCaptura)
  setMesSeleccionado(mesOperacionCaptura)
}

const continuarCapturaDesdeContexto = () => {
  sincronizarContextoOperacion()
  const targetStep = contextMissingReasons[0]?.step ?? (firstIncompleteStep >= 0 ? firstIncompleteStep : pasoActual)
  setPasoActual(targetStep)
}

const limpiarClienteSeleccionado = () => {
  setClienteSeleccionado(null)
  setClienteNombre("")
  setRfc("")
  setDetalleTipoCliente("")
  setPepCargoCliente("")
  setPepDependenciaCliente("")
  setPepRelacionCliente("cliente")
}

const limpiarFormulario = () => {
  setOperacionEditandoId(null)
  setMotivoCorreccion("")
  setDatosEuiConfirmados(false)
  setMontoOperacion("")
  setTipoOperacion("")
  setEvidencia("")
  limpiarClienteSeleccionado()
  setMismoGrupo("no")
  setSospecha24h(false)
  setMoneda("MXN")
  setMonedaPersonalizadaCodigo("")
  setMonedaPersonalizadaDescripcion("")
  setFechaOperacion(new Date().toISOString().substring(0, 10))
  setPagoRecurrenteMeses("1")
  setPagoRecurrenteMensualidad("")
  setPagoRecurrenteNota("")
  setDetalleTipoCliente("")
  setCodigoOperacionInmueble("")
  setFiguraClienteInmueble("")
  setFiguraSujetoObligadoInmueble("")
  setReferenciaAviso("")
  setAlertaCodigo(ALERTA_DEFAULT)
  setAlertaDescripcion("")
  setPrioridadAviso(PRIORIDAD_DEFAULT)
  setDraftEvidenceChecklist({})
  setDraftEvidenceJustifications({})
  setDraftEvidenceFiles({})
  setDraftEvidenceUploads([])
  setInmuebleForm({ ...INMUEBLE_FORM_DEFAULT })
  setLiquidacionForm({ ...LIQUIDACION_FORM_DEFAULT })
  setBeneficiarioForm({ ...BENEFICIARIO_FORM_DEFAULT })
  setContraparteForm({ ...CONTRAPARTE_FORM_DEFAULT })
  setInstrumentoForm({ ...INSTRUMENTO_FORM_DEFAULT })
  setColoniasDisponibles([])
  setSatFieldValues({})
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
  setPagoRecurrenteMeses("1")
  setPagoRecurrenteMensualidad(demo.cliente.monto)
  setPagoRecurrenteNota("")
  setMoneda(demo.cliente.moneda)
  setClienteNombre(demo.cliente.nombre)
  setRfc(demo.cliente.rfc)
  setTipoCliente(demo.cliente.tipo)
  setDetalleTipoCliente(demo.cliente.detalle)
  setMismoGrupo(demo.cliente.mismoGrupo ? "si" : "no")
  setSospecha24h(false)
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
    valorCatastral: "",
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
    fechaConstitucion: "",
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
    valorCatastral: "",
  })
  setPersonaAvisoActual(demoFraccionXV.personaAviso as PersonaAvisoOperacion)
  setPersonaExpedienteSeleccionada("")

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
  setOperacionesStorageValido(true)
  setOperaciones((prev) => recalcularOperaciones(modifier(prev), true))
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
  setSospecha24h(false)
}

const agregarOperacion = () => {
  const operacionExistente = operacionEditandoId
    ? operaciones.find((operacion) => operacion.id === operacionEditandoId) ?? null
    : null

  if (!actividadSeleccionada || !umaSeleccionada || !umbralPesos) {
    toast({
      title: "Información incompleta",
      description: "Selecciona la actividad, año, mes y verifica que existan UMAs disponibles.",
      variant: "destructive",
    })
    return
  }

  if (!clienteNombre || !rfc || !tipoOperacion || (!sospecha24h && !montoOperacion)) {
    toast({
      title: "Faltan datos",
      description: sospecha24h
        ? "Completa la información del cliente, RFC y narrativa de la alerta."
        : "Completa la información del cliente, RFC, tipo de operación y monto.",
      variant: "destructive",
    })
    return
  }

  if (!beneficiarioCompleto || !datosEuiConfirmados) {
    toast({
      title: "Beneficiario pendiente",
      description: "Completa y confirma el beneficiario controlador en el paso 4 antes de guardar.",
      variant: "destructive",
    })
    return
  }

  if (
    operacionExistente &&
    (operacionExistente.submission?.wasEverPresented || operacionExistente.avisoPresentado) &&
    motivoCorreccion.trim().length < 5
  ) {
    toast({
      title: "Motivo de corrección requerido",
      description: "Describe por qué se modifica una operación que ya fue presentada.",
      variant: "destructive",
    })
    return
  }

  const montoParseado =
    sospecha24h && !montoOperacion.trim()
      ? ({ ok: true, cents: 0, decimal: "0.00" } as const)
      : parseMoneyToCents(montoOperacion, { allowZero: sospecha24h })
  if (!montoParseado.ok) {
    toast({
      title: "Monto inválido",
      description: montoParseado.message,
      variant: "destructive",
    })
    return
  }
  const monto = centsToMoney(montoParseado.cents)

  const valorAvaluoInmuebleParseado =
    esActividadInmuebles && inmuebleForm.valorAvaluo.trim()
      ? parseMoneyToCents(inmuebleForm.valorAvaluo, { allowZero: true })
      : null
  const valorCatastralInmuebleParseado =
    esActividadInmuebles && inmuebleForm.valorCatastral.trim()
      ? parseMoneyToCents(inmuebleForm.valorCatastral, { allowZero: true })
      : null
  const valorAvaluoInstrumentoParseado =
    esActividadInmuebles && instrumentoForm.valorAvaluo.trim()
      ? parseMoneyToCents(instrumentoForm.valorAvaluo, { allowZero: true })
      : null
  const valorCatastralInstrumentoParseado =
    esActividadInmuebles && instrumentoForm.valorCatastral.trim()
      ? parseMoneyToCents(instrumentoForm.valorCatastral, { allowZero: true })
      : null
  const montosOpcionales = [
    ["Avalúo del inmueble", valorAvaluoInmuebleParseado],
    ["Valor catastral del inmueble", valorCatastralInmuebleParseado],
    ["Valor de avalúo", valorAvaluoInstrumentoParseado],
    ["Valor catastral", valorCatastralInstrumentoParseado],
    ["Mensualidad esperada", esActividadInmuebles ? pagoRecurrenteMensualidadParseado : null],
  ] as const
  const montoOpcionalInvalido = montosOpcionales.find(([, parsed]) => parsed && !parsed.ok)
  if (montoOpcionalInvalido) {
    const [label, parsed] = montoOpcionalInvalido
    toast({
      title: `${label} inválido`,
      description: parsed && !parsed.ok ? parsed.message : "Revisa el valor capturado.",
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

  if (beneficiarioForm.nombre.trim()) {
    beneficiarioOperacion = {
      tipo: beneficiarioForm.tipo,
      nombre: beneficiarioForm.nombre,
      apellidoPaterno: beneficiarioForm.apellidoPaterno,
      apellidoMaterno: beneficiarioForm.apellidoMaterno,
      fechaNacimiento: beneficiarioForm.fechaNacimiento,
      fechaConstitucion: beneficiarioForm.fechaConstitucion,
      rfc: beneficiarioForm.rfc,
      curp: beneficiarioForm.curp,
      pais: beneficiarioForm.pais,
    }
  }

  if (esActividadInmuebles && !sospecha24h) {
    inmuebleOperacion = {
      codigoOperacion: codigoOperacionInmueble,
      fechaInicio: inmuebleForm.fechaInicio,
      fechaFin: inmuebleForm.fechaFin,
      tipoInmueble: inmuebleForm.tipoInmueble,
      valorAvaluo: valorAvaluoInmuebleParseado?.ok
        ? valorAvaluoInmuebleParseado.decimal
        : "",
      valorAvaluoCentavos: valorAvaluoInmuebleParseado?.ok
        ? valorAvaluoInmuebleParseado.cents
        : undefined,
      valorCatastral: valorCatastralInmuebleParseado?.ok
        ? valorCatastralInmuebleParseado.decimal
        : "",
      valorCatastralCentavos: valorCatastralInmuebleParseado?.ok
        ? valorCatastralInmuebleParseado.cents
        : undefined,
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
      montoCentavos: montoParseado.cents,
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
      instrumentoForm.valorAvaluo.trim() ||
      instrumentoForm.valorCatastral.trim()
    ) {
      instrumentoOperacion = {
        numero: instrumentoForm.numero,
        fecha: instrumentoForm.fecha,
        notario: instrumentoForm.notario,
        entidad: instrumentoForm.entidad,
        valorAvaluo: valorAvaluoInstrumentoParseado?.ok
          ? valorAvaluoInstrumentoParseado.decimal
          : "",
        valorAvaluoCentavos: valorAvaluoInstrumentoParseado?.ok
          ? valorAvaluoInstrumentoParseado.cents
          : undefined,
        valorCatastral: valorCatastralInstrumentoParseado?.ok
          ? valorCatastralInstrumentoParseado.decimal
          : "",
        valorCatastralCentavos: valorCatastralInstrumentoParseado?.ok
          ? valorCatastralInstrumentoParseado.cents
          : undefined,
      }
    }
  }

  const status: UmbralStatus = evaluacionActual?.status ?? "sin-obligacion"
  const acumuladoCliente = evaluacionActual?.acumulado ?? monto
  const alerta = obtenerAlertaPorStatus(status)
  const omitirToast = demoCargaRef.current
  const requisitosChecklist = {
    ...buildChecklist(actividadSeleccionada, tipoCliente),
    ...draftEvidenceChecklist,
  }
  const documentosJustificados = buildDocumentosJustificados(
    draftEvidenceJustifications,
    requisitosDocumentalesActuales,
  )
  const requisitosConCargaRapida = new Set(draftEvidenceUploads.map((upload) => upload.requisitoId))
  const documentosCargaRapida = draftEvidenceUploads.map((upload) => ({
    id: upload.id,
    requisito: upload.requisitoLabel,
    notas: evidencia.trim() || draftEvidenceJustifications[upload.requisitoId]?.trim() || "Archivo cargado en captura guiada.",
    archivoNombre: upload.archivoNombre,
    archivoContenido: upload.archivoContenido,
    fechaRegistro: upload.fechaRegistro,
  }) satisfies DocumentoSoporte)
  const documentosArchivos = Object.entries(draftEvidenceFiles)
    .filter(([requisitoId]) => !requisitosConCargaRapida.has(requisitoId))
    .filter(([, archivoNombre]) => archivoNombre.trim())
    .map(([requisitoId, archivoNombre]) => {
      const requisito = requisitosDocumentalesActuales.find((item) => item.id === requisitoId)
      return {
        id: `file-${requisitoId}-${Date.now()}`,
        requisito: requisito?.label ?? requisitoId,
        notas: draftEvidenceJustifications[requisitoId]?.trim() || "Archivo asociado en captura guiada.",
        archivoNombre,
        fechaRegistro: new Date().toISOString().substring(0, 10),
      } satisfies DocumentoSoporte
    })
  const evidenciaEvaluada = evaluateEvidenceChecklist({
    requirements: getDocumentRequirementsForCliente(tipoCliente, actividadSeleccionada.key),
    completed: requisitosChecklist,
    justifications: draftEvidenceJustifications,
  })
  const evidenciaDecision = evaluateOperationalEvidenceDecision({
    tipoCliente,
    actividadKey: actividadSeleccionada.key,
    completed: requisitosChecklist,
    justifications: draftEvidenceJustifications,
    outputKind: toSatOutputKind(
      evaluacionActual?.salida.tipo,
      sospecha24h ? "aviso_24h" : mismoGrupo === "si" && status === "aviso" ? "informe_27_bis" : "aviso_normal",
    ),
    suspicionNarrative: alertaDescripcion || evidencia,
  })
  const salidaOperacion = classifyAvisoSalida({
    status,
    fechaOperacion,
    supuesto27Bis: mismoGrupo === "si" && status === "aviso",
    sospecha24h,
    evidenceCanClose: evidenciaDecision.canClose,
  })
  const acumulacionRule = getAcumulacionRuleForActividad(actividadSeleccionada.key)

  const ahora = new Date().toISOString()
  const operacionId = operacionExistente?.id ?? crypto.randomUUID()
  const fuePresentada = Boolean(operacionExistente?.submission?.wasEverPresented || operacionExistente?.avisoPresentado)
  let nuevaOperacion: OperacionCliente = {
    ...(operacionExistente ?? {}),
    schemaVersion: 3,
    id: operacionId,
    montoCentavos: montoParseado.cents,
    revision: (operacionExistente?.revision ?? 0) + 1,
    createdAt: operacionExistente?.createdAt ?? ahora,
    updatedAt: ahora,
    lifecycle: { status: "active" },
    estadoOperacion: "active",
    submission: {
      ...(operacionExistente?.submission ?? {}),
      status:
        fuePresentada
          ? "correction-pending"
          : status === "aviso"
            ? "pending"
            : "not-required",
      wasEverPresented: fuePresentada,
      presentedAt: operacionExistente?.submission?.presentedAt,
      correctionReason: fuePresentada ? motivoCorreccion.trim() : undefined,
      updatedAt: ahora,
    },
    history: [...(operacionExistente?.history ?? [])],
    sujetoObligado: {
      id: sujetoObligadoSnapshotActual?.id,
      rfc: sujetoObligadoSnapshotActual?.rfc,
      nombre: sujetoObligadoSnapshotActual?.nombre,
      clave: sujetoObligadoSnapshotActual?.clave,
    },
    actividadKey: actividadSeleccionada.key,
    actividadNombre: `${actividadSeleccionada.fraccion} – ${actividadSeleccionada.nombre}`,
    satTemplateId: satTemplateActual?.templateId,
    satTemplateFile: satTemplateActual?.officialXlsmName,
    satTemplateVariant: satTemplateVariantId || satTemplateActual?.templateId,
    satFieldValues: satEffectiveFieldValues,
    satCellValues: satEffectiveCellValues,
    satMissingRequiredFields,
    satWorkbookStatus: satWorkbookStatusActual,
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
    identificacionUmbralCentavos: coerceLegacyMoneyToCents(umbralPesos.identificacion),
    avisoUmbralPesos: umbralPesos.aviso,
    avisoUmbralCentavos: coerceLegacyMoneyToCents(umbralPesos.aviso),
    umbralStatus: status,
    acumuladoCliente,
    acumuladoClienteCentavos: coerceLegacyMoneyToCents(acumuladoCliente),
    alerta,
    avisoPresentado: operacionExistente?.avisoPresentado ?? false,
    alertaResuelta: operacionExistente?.alertaResuelta ?? (alerta ? false : true),
    documentosSoporte:
      operacionExistente && documentosCargaRapida.length + documentosArchivos.length + documentosJustificados.length === 0
        ? operacionExistente.documentosSoporte
        : [...documentosCargaRapida, ...documentosArchivos, ...documentosJustificados],
    requisitosChecklist,
    kycIntegrado: operacionExistente?.kycIntegrado ?? false,
    referenciaAviso: esActividadInmuebles ? referenciaAviso.trim() : undefined,
    alertaCodigo: esActividadInmuebles ? alertaCodigo : undefined,
    alertaDescripcion:
      esActividadInmuebles && alertaDescripcion.trim().length > 0
        ? alertaDescripcion.trim()
        : undefined,
    prioridadAviso: esActividadInmuebles ? prioridadAviso : undefined,
    sospecha24h,
    avisoSalidaTipo: salidaOperacion.tipo,
    avisoSalidaLabel: salidaOperacion.label,
    avisoSalidaDescripcion: salidaOperacion.descripcion,
    evidenciaCanClose: evidenciaDecision.canClose,
    evidenciaFaltantesCriticos: evidenciaEvaluada.missingCritical.length,
    evidenciaFaltantesOpcionales: evidenciaEvaluada.missingOptional.length,
    acumulacionAplica: acumulacionRule.applies,
    acumulacionRegla: acumulacionRule.source,
    acumulacionRazon: acumulacionRule.rationale,
    claveSujetoObligado: claveSujetoObligado.trim() || undefined,
    claveActividadVulnerable: claveActividad.trim() || undefined,
    expedienteReferenciado: expedienteSeleccionado ?? undefined,
    expedienteIdentifiers: expedienteActual?.identifiers,
    expedienteEui: expedienteActual?.expedienteEui,
    personaExpedienteId: personaExpedienteSeleccionada || undefined,
    personaAviso: personaAvisoSnapshot ?? null,
    inmueble: inmuebleOperacion,
    liquidacion: liquidacionOperacion,
    beneficiario: beneficiarioOperacion,
    contraparte: contraparteOperacion,
    instrumento: instrumentoOperacion,
    figuraCliente: esActividadInmuebles ? figuraClienteInmueble : undefined,
    figuraSujetoObligado: esActividadInmuebles ? figuraSujetoObligadoInmueble : undefined,
    pepCargo: pepCargoCliente.trim() || operacionExistente?.pepCargo || undefined,
    pepDependencia: pepDependenciaCliente.trim() || operacionExistente?.pepDependencia || undefined,
    pepScreening: pepScreeningCliente ?? operacionExistente?.pepScreening ?? undefined,
    pagoRecurrenteMeses: esActividadInmuebles ? Number(pagoRecurrenteMeses) || 1 : undefined,
    pagoRecurrenteMensualidad:
      esActividadInmuebles && pagoRecurrenteMensualidadParseado?.ok
        ? centsToMoney(pagoRecurrenteMensualidadParseado.cents)
        : undefined,
    pagoRecurrenteMensualidadCentavos:
      esActividadInmuebles && pagoRecurrenteMensualidadParseado?.ok
        ? pagoRecurrenteMensualidadParseado.cents
        : undefined,
    posibleFalsoPositivo: revisionPagoRecurrente.requiresReview,
    falsoPositivoRazon:
      revisionPagoRecurrente.requiresReview
        ? pagoRecurrenteNota.trim() || revisionPagoRecurrente.message
        : undefined,
  }

  const canonicalOperacion = operacionExistente
    ? (() => {
        const stored = sanitizeStoredPldOperation(operacionExistente)
        if (!stored) return null
        const result = editStoredPldOperation(stored, nuevaOperacion as any, {
          at: ahora,
          actor: sujetoObligadoSnapshotActual?.nombre,
          correctionReason: motivoCorreccion.trim() || undefined,
        })
        if (!result.ok) {
          toast({
            title: "No fue posible guardar la corrección",
            description: result.message,
            variant: "destructive",
          })
          return null
        }
        return result.operation
      })()
    : createStoredPldOperation(nuevaOperacion as any, {
        at: ahora,
        actor: sujetoObligadoSnapshotActual?.nombre,
        sujetoObligado: sujetoObligadoSnapshotActual,
      })
  if (!canonicalOperacion) return

  const operacionNormalizada = sanitizeOperacion(canonicalOperacion)
  if (!operacionNormalizada) {
    toast({
      title: "Operación inválida",
      description: "No fue posible normalizar el registro antes de persistirlo.",
      variant: "destructive",
    })
    return
  }
  nuevaOperacion = operacionNormalizada

  actualizarOperaciones((prev) =>
    operacionExistente
      ? prev.map((operacion) => (operacion.id === operacionExistente.id ? nuevaOperacion : operacion))
      : [...prev, nuevaOperacion],
  )
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
        title: operacionExistente ? "Operación actualizada" : "Operación registrada",
        description: operacionExistente
          ? "Se guardó la nueva revisión sobre el mismo registro."
          : "Se registró la operación sin obligaciones activas.",
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
  const operacion = operaciones.find((item) => item.id === id)
  if (!operacion) return

  const evidenciaEvaluada = evaluarEvidenciaOperacion(operacion)
  if (!evidenciaEvaluada.canClose) {
    toast({
      title: "Evidencia crítica pendiente",
      description: `No se puede cerrar el aviso: faltan ${evidenciaEvaluada.missingCritical.length} requisito(s) críticos o una justificación documental.`,
      variant: "destructive",
    })
    return
  }

  const presentadoEn = new Date().toISOString()
  const stored = sanitizeStoredPldOperation(operacion)
  if (!stored) return
  const result = markStoredPldOperationPresented(stored, {
    at: presentadoEn,
    actor: operacion.sujetoObligado?.nombre,
    reference: operacion.referenciaAviso,
    packageId: `satpkg-${operacion.id}`,
  })
  if (!result.ok) {
    toast({ title: "No fue posible presentar", description: result.message, variant: "destructive" })
    return
  }
  const actualizada = sanitizeOperacion({
    ...result.operation,
    alerta: "Aviso marcado como presentado. Reiniciar acumulación a partir de esta fecha.",
    alertaResuelta: true,
  })
  if (!actualizada) return

  actualizarOperaciones((prev) =>
    prev.map((item) => (item.id === id ? actualizada : item)),
  )

  toast({
    title: "Aviso actualizado",
    description: "Se marcó la operación como atendida ante la autoridad.",
  })
}

const abrirEdicionOperacion = (operacion: OperacionCliente) => {
  reutilizarDatosCliente(operacion, "editar")
}

const solicitarEliminarOperacion = (operacion: OperacionCliente) => {
  setOperacionParaEliminar(operacion)
  setMotivoCancelacion("")
}

const confirmarEliminarOCancelarOperacion = () => {
  if (!operacionParaEliminar) return

  const fuePresentada = Boolean(
    operacionParaEliminar.submission?.wasEverPresented || operacionParaEliminar.avisoPresentado,
  )
  if (fuePresentada && motivoCancelacion.trim().length < 5) {
    toast({
      title: "Motivo requerido",
      description: "Las operaciones presentadas sólo pueden cancelarse con un motivo de trazabilidad.",
      variant: "destructive",
    })
    return
  }

  const canonicalOperations = operaciones
    .map((operacion) => sanitizeStoredPldOperation(operacion))
    .filter((operacion): operacion is StoredPldOperationV3 => Boolean(operacion))
  const result = deleteOrCancelStoredPldOperation(
    canonicalOperations,
    operacionParaEliminar.id,
    {
      confirmed: true,
      at: new Date().toISOString(),
      actor: operacionParaEliminar.sujetoObligado?.nombre,
      reason: motivoCancelacion.trim() || undefined,
    },
  )
  if (!result.ok) {
    toast({ title: "No fue posible actualizar", description: result.message, variant: "destructive" })
    return
  }

  const operacionesActualizadas = result.operations
    .map((operacion) => sanitizeOperacion(operacion))
    .filter((operacion): operacion is OperacionCliente => Boolean(operacion))
  actualizarOperaciones(() => operacionesActualizadas)

  if (result.action === "cancelled") {
    toast({
      title: "Operación cancelada",
      description: "Se conservó el registro y su trazabilidad por haber sido presentado.",
    })
  } else {
    if (typeof window !== "undefined") {
      try {
        const stored = window.localStorage.getItem(SAT_OUTPUT_PACKAGES_STORAGE_KEY)
        const packages = stored ? JSON.parse(stored) : []
        if (Array.isArray(packages)) {
          window.localStorage.setItem(
            SAT_OUTPUT_PACKAGES_STORAGE_KEY,
            JSON.stringify(removeLinkedSatPackage(packages, operacionParaEliminar.id)),
          )
        }
      } catch (_error) {
        // La operación sigue eliminándose; un paquete corrupto no debe bloquear el CRUD local.
      }
    }
    toast({
      title: "Operación eliminada",
      description: "Se retiró el borrador y cualquier paquete SAT vinculado por ID.",
    })
  }

  setOperacionParaEliminar(null)
  setMotivoCancelacion("")
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
          ${instrumento.valorAvaluo ? `<valor_avaluo>${instrumento.valorAvaluoCentavos !== undefined ? centsToDecimalString(instrumento.valorAvaluoCentavos) : formatNumberXml(instrumento.valorAvaluo)}</valor_avaluo>` : ""}
          ${instrumento.valorCatastral ? `<valor_catastral>${instrumento.valorCatastralCentavos !== undefined ? centsToDecimalString(instrumento.valorCatastralCentavos) : formatNumberXml(instrumento.valorCatastral)}</valor_catastral>` : ""}
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
            <valor_pactado>${centsToDecimalString(operacion.montoCentavos ?? coerceLegacyMoneyToCents(operacion.monto))}</valor_pactado>
            ${inmueble.colonia ? `<colonia>${escapeXml(inmueble.colonia)}</colonia>` : ""}
            ${inmueble.calle ? `<calle>${escapeXml(inmueble.calle)}</calle>` : ""}
            ${inmueble.numeroExterior ? `<numero_exterior>${escapeXml(inmueble.numeroExterior)}</numero_exterior>` : ""}
            ${inmueble.numeroInterior ? `<numero_interior>${escapeXml(inmueble.numeroInterior)}</numero_interior>` : ""}
            ${inmueble.codigoPostal ? `<codigo_postal>${escapeXml(inmueble.codigoPostal)}</codigo_postal>` : ""}
            ${inmueble.valorAvaluo ? `<valor_avaluo>${inmueble.valorAvaluoCentavos !== undefined ? centsToDecimalString(inmueble.valorAvaluoCentavos) : formatNumberXml(inmueble.valorAvaluo)}</valor_avaluo>` : ""}
            ${inmueble.valorCatastral ? `<valor_catastral>${inmueble.valorCatastralCentavos !== undefined ? centsToDecimalString(inmueble.valorCatastralCentavos) : formatNumberXml(inmueble.valorCatastral)}</valor_catastral>` : ""}
            ${inmueble.folioReal ? `<folio_real>${escapeXml(inmueble.folioReal)}</folio_real>` : ""}
          </caracteristicas_inmueble>
${instrumentoXml ? `${instrumentoXml}\n` : ""}          <datos_liquidacion>
            <fecha_pago>${formatFechaXml(liquidacion.fechaPago)}</fecha_pago>
            <forma_pago>${escapeXml(liquidacion.formaPago)}</forma_pago>
            <instrumento_monetario>${escapeXml(liquidacion.instrumento)}</instrumento_monetario>
            <moneda>${escapeXml(liquidacion.moneda)}</moneda>
            <monto_operacion>${centsToDecimalString(operacion.montoCentavos ?? coerceLegacyMoneyToCents(liquidacion.monto))}</monto_operacion>
          </datos_liquidacion>
        </datos_operacion>
      </detalle_operaciones>
    </aviso>
  </informe>
</archivo>`

  return xml
}

const exportarXml = (operacion: OperacionCliente) => {
  if (!hasRealSatOutput(operacion)) {
    toast({
      title: "Sin salida SAT descargable",
      description:
        operacion.umbralStatus === "identificacion"
          ? "Esta operación sólo requiere identificación y no genera un XML de aviso."
          : "Este registro es interno y no genera un XML de aviso.",
    })
    return
  }

  const tenantBase =
    tenantState.tenants.find(
      (tenant) =>
        tenant.id === operacion.sujetoObligado?.id ||
        Boolean(operacion.sujetoObligado?.rfc && tenant.rfc === operacion.sujetoObligado.rfc),
    ) ?? activeTenant ?? buildDefaultPldTenants("tenant-demo-pld").tenants[0]
  const tenant = {
    ...tenantBase,
    id: operacion.sujetoObligado?.id || tenantBase.id,
    rfc: operacion.sujetoObligado?.rfc || tenantBase.rfc,
    razonSocial: operacion.sujetoObligado?.nombre || tenantBase.razonSocial,
  }
  const salida = classifyAvisoSalida({
    status: operacion.umbralStatus,
    fechaOperacion: operacion.fechaOperacion,
    supuesto27Bis: operacion.mismoGrupo && operacion.umbralStatus === "aviso",
    sospecha24h: Boolean(operacion.sospecha24h),
    evidenceCanClose: operacion.evidenciaCanClose,
  })
  const operationalCase = buildPldOperationalCase({
    tenant,
    periodo: operacion.periodo,
    actividadKey: operacion.actividadKey,
    clienteId: operacion.rfc,
    clienteNombre: operacion.cliente,
    clienteRfc: operacion.rfc,
    tipoCliente: operacion.tipoCliente,
    fechaOperacion: operacion.fechaOperacion,
    montoMxn: centsToMoney(
      operacion.montoCentavos ?? coerceLegacyMoneyToCents(operacion.monto),
    ),
    montoCentavos:
      operacion.montoCentavos ?? coerceLegacyMoneyToCents(operacion.monto),
    formaPago: operacion.liquidacion?.formaPago ?? operacion.monedaDescripcion,
    sospecha24h: Boolean(operacion.sospecha24h),
    supuesto27Bis: operacion.mismoGrupo && operacion.umbralStatus === "aviso",
    alertaCodigo: operacion.alertaCodigo,
    alertaDescripcion: operacion.alertaDescripcion,
    suspicionNarrative: operacion.alertaDescripcion || operacion.evidencia,
    completedEvidence: operacion.requisitosChecklist,
    evidenceJustifications: buildJustificacionesEvidencia(operacion.documentosSoporte),
    satTemplateId: operacion.satTemplateId,
    satTemplateFile: operacion.satTemplateFile,
    satTemplateVariant: operacion.satTemplateVariant,
    satFieldValues: operacion.satFieldValues,
    satCellValues: operacion.satCellValues,
    satMissingRequiredFields: operacion.satMissingRequiredFields,
    satWorkbookStatus: operacion.satWorkbookStatus,
    actor: tenant.representanteCumplimiento.nombre,
  })
  operationalCase.satOutputStatus = {
    ...operationalCase.satOutputStatus,
    kind: toSatOutputKind(salida.tipo, operationalCase.satOutputStatus.kind),
    label: salida.label,
    descripcion: salida.descripcion,
    fechaLimite: salida.fechaLimite,
  }
  const generated = generateSatXml(operationalCase)

  if (!generated.valid) {
    toast({
      title: "XML incompleto",
      description: generated.errors.join(" "),
      variant: "destructive",
    })
    return
  }

  descargarXml(generated.xml, generated.fileName)

  toast({
    title: "XML SAT local generado",
    description: generated.warnings[0],
  })
}

const reutilizarDatosCliente = (operacion: OperacionCliente, modo: "reusar" | "editar" = "reusar") => {
  setTabActiva("captura")
  preserveSatValuesOnActivityChangeRef.current = true
  setActividadKey(operacion.actividadKey)
  setActividadInfoKey(operacion.actividadKey)
  setSatTemplateVariantId(operacion.satTemplateVariant ?? operacion.satTemplateId ?? "")
  setAnioSeleccionado(modo === "editar" ? operacion.anio : currentYear)
  setMesSeleccionado(modo === "editar" ? operacion.mes : currentMonth)
  setAnioOperacionCaptura(modo === "editar" ? operacion.anio : currentYear)
  setMesOperacionCaptura(modo === "editar" ? operacion.mes : currentMonth)
  setActividadOperacionSeleccionada(operacion.actividadKey)
  setTipoCliente(operacion.tipoCliente)
  setDetalleTipoCliente(operacion.detalleTipoCliente ?? "")
  setClienteNombre(operacion.cliente)
  setRfc(operacion.rfc)
  setPepCargoCliente(modo === "editar" ? operacion.pepCargo ?? "" : "")
  setPepDependenciaCliente(modo === "editar" ? operacion.pepDependencia ?? "" : "")
  setPepRelacionCliente("cliente")
  setMismoGrupo(operacion.mismoGrupo ? "si" : "no")
  setSospecha24h(Boolean(operacion.sospecha24h))
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
  setFechaOperacion(
    modo === "editar" ? operacion.fechaOperacion : new Date().toISOString().substring(0, 10),
  )
  setEvidencia(operacion.evidencia)
  setDraftEvidenceChecklist(modo === "editar" ? { ...operacion.requisitosChecklist } : {})
  setDraftEvidenceJustifications({})
  setDraftEvidenceFiles({})
  setDraftEvidenceUploads([])
  setMontoOperacion(
    operacion.montoCentavos !== undefined
      ? centsToDecimalString(operacion.montoCentavos)
      : String(operacion.monto || ""),
  )
  setPagoRecurrenteMeses(String(operacion.pagoRecurrenteMeses ?? 1))
  setPagoRecurrenteMensualidad(
    operacion.pagoRecurrenteMensualidadCentavos !== undefined
      ? centsToDecimalString(operacion.pagoRecurrenteMensualidadCentavos)
      : operacion.pagoRecurrenteMensualidad
        ? String(operacion.pagoRecurrenteMensualidad)
        : centsToDecimalString(operacion.montoCentavos ?? coerceLegacyMoneyToCents(operacion.monto)),
  )
  setPagoRecurrenteNota(operacion.falsoPositivoRazon ?? "")
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
          valorCatastral: operacion.inmueble.valorCatastral ?? "",
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
          fechaConstitucion: operacion.beneficiario.fechaConstitucion ?? "",
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
          valorCatastral: operacion.instrumento.valorCatastral ?? "",
        }
      : { ...INSTRUMENTO_FORM_DEFAULT },
  )
  if (operacion.inmueble?.codigoPostal) {
    const info = findCodigoPostalInfo(operacion.inmueble.codigoPostal)
    setColoniasDisponibles(info?.asentamientos ?? [])
  } else {
    setColoniasDisponibles([])
  }
  const expedienteOperacion = operacion.expedienteReferenciado
    ? expedientesDetalle[operacion.expedienteReferenciado] ?? null
    : null
  setExpedienteSeleccionado(expedienteOperacion?.expedienteId ?? null)
  setClienteOperacionSeleccionado(expedienteOperacion?.expedienteId ?? "")
  setPersonaExpedienteSeleccionada(operacion.personaExpedienteId ?? "")
  setPersonaAvisoActual(operacion.personaAviso ?? null)

  const tenantSujeto = tenantState.tenants.find(
    (tenant) =>
      tenant.id === operacion.sujetoObligado?.id ||
      Boolean(operacion.sujetoObligado?.rfc && tenant.rfc === operacion.sujetoObligado.rfc),
  )
  const sujetoOperacionValue = tenantSujeto
    ? `tenant:${tenantSujeto.id}`
    : expedienteOperacion
      ? resolveSujetoObligadoOptionValue(expedienteOperacion)
      : getSujetoObligadoOptionValueFromSnapshot(operacion.sujetoObligado) ||
        (activeTenant?.id ? `tenant:${activeTenant.id}` : "")
  setSujetoObligadoOperacion(sujetoOperacionValue)
  setSatFieldValues(
    modo === "editar"
      ? { ...(operacion.satFieldValues ?? {}) }
      : buildReusableSatFieldValues(operacion.satFieldValues),
  )
  setDatosEuiConfirmados(Boolean(operacion.beneficiario?.nombre))
  setPasoActual(modo === "editar" ? 0 : 1)
  if (modo === "editar") {
    setOperacionEditandoId(operacion.id)
    setMotivoCorreccion("")
    toast({
      title: "Edición completa activada",
      description: "Revisa el asistente y guarda; se conservará el mismo folio interno.",
    })
  } else {
    setOperacionEditandoId(null)
    setMotivoCorreccion("")
    toast({
      title: "Plantilla reutilizada",
      description: "Se copió la operación base. Ajusta fecha, monto o meses cubiertos antes de guardar el nuevo periodo.",
    })
  }
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
  const operacion = operaciones.find((item) => item.id === operacionId)
  if (valor && operacion) {
    const evidenciaEvaluada = evaluarEvidenciaOperacion(operacion)
    if (!evidenciaEvaluada.canClose) {
      toast({
        title: "Checklist documental incompleto",
        description: `Puedes guardar avances, pero para cerrar el expediente faltan ${evidenciaEvaluada.missingCritical.length} requisito(s) críticos.`,
        variant: "destructive",
      })
      return
    }
  }

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

const manejarArchivosEvidenciaRapida = (
  requisitoId: string,
  requisitoLabel: string,
  event: ChangeEvent<HTMLInputElement>,
) => {
  const archivos = Array.from(event.target.files ?? [])
  if (archivos.length === 0) return

  const nombresExistentes = draftEvidenceUploads
    .filter((upload) => upload.requisitoId === requisitoId)
    .map((upload) => upload.archivoNombre)
  const nombres = [...nombresExistentes, ...archivos.map((archivo) => archivo.name)]

  setDraftEvidenceChecklist((prev) => ({ ...prev, [requisitoId]: true }))
  setDraftEvidenceFiles((prev) => ({ ...prev, [requisitoId]: nombres.join(", ") }))

  archivos.forEach((archivo) => {
    const uploadBase: DraftEvidenceUpload = {
      id: typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-${archivo.name}`,
      requisitoId,
      requisitoLabel,
      archivoNombre: archivo.name,
      fechaRegistro: new Date().toISOString().substring(0, 10),
    }
    const lector = new FileReader()
    lector.onload = () => {
      setDraftEvidenceUploads((prev) => [
        ...prev,
        {
          ...uploadBase,
          archivoContenido: typeof lector.result === "string" ? lector.result : undefined,
        },
      ])
    }
    lector.readAsDataURL(archivo)
  })

  event.target.value = ""
}

const eliminarEvidenciaRapida = (uploadId: string) => {
  const upload = draftEvidenceUploads.find((item) => item.id === uploadId)
  const nextUploads = draftEvidenceUploads.filter((item) => item.id !== uploadId)
  setDraftEvidenceUploads(nextUploads)

  if (!upload) return

  const remainingNames = nextUploads
    .filter((item) => item.requisitoId === upload.requisitoId)
    .map((item) => item.archivoNombre)
  setDraftEvidenceFiles((prev) => {
    const next = { ...prev }
    if (remainingNames.length > 0) {
      next[upload.requisitoId] = remainingNames.join(", ")
    } else {
      delete next[upload.requisitoId]
    }
    return next
  })
  if (remainingNames.length === 0) {
    setDraftEvidenceChecklist((prev) => ({ ...prev, [upload.requisitoId]: false }))
  }
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
  () => evaluacionActual?.salida.tipo === "informe_27_bis",
  [evaluacionActual],
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
    <div className="space-y-6 overflow-hidden">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
              <ShieldAlert className="h-4 w-4" />
              Actos y operaciones
            </div>
            <h1 className="text-xl font-semibold text-slate-950">Tablero operativo</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
              Registra operaciones, valida umbrales y prepara la salida SAT desde un flujo guiado.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Button
              onClick={() => {
                setTabActiva("captura")
                setPasoActual(0)
                setActividadInfoKey(actividadKey)
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Registrar operación
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
        <div className="mt-5 flex min-w-0 flex-wrap items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
          {OPERATIVE_FLOW_STAGES.map((stage, index) => (
            <div key={stage} className="flex min-w-0 items-center gap-2">
              <span className="inline-flex max-w-[150px] items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700">
                <span className="truncate">{stage}</span>
              </span>
              {index < OPERATIVE_FLOW_STAGES.length - 1 && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />}
            </div>
          ))}
        </div>
      </section>

      <Tabs value={tabActiva} onValueChange={(value) => setTabActiva(value as typeof tabActiva)} className="space-y-6">
        <TabsList className="!grid !h-auto w-full grid-cols-1 gap-2 rounded-xl border bg-white p-1 sm:grid-cols-2 xl:grid-cols-4">
          <TabsTrigger value="resumen" className="w-full !whitespace-normal text-center text-sm leading-tight">Resumen ejecutivo</TabsTrigger>
          <TabsTrigger value="captura" className="w-full !whitespace-normal text-center text-sm leading-tight">Captura guiada</TabsTrigger>
          <TabsTrigger value="seguimiento" className="w-full !whitespace-normal text-center text-sm leading-tight">Seguimiento y calendario</TabsTrigger>
          <TabsTrigger value="explorar" className="w-full !whitespace-normal text-center text-sm leading-tight">Explorar fracciones</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  <h2 className="text-base font-semibold text-slate-950">Vista del periodo</h2>
                </div>
                <p className="mt-1 max-w-2xl text-sm text-slate-600">
                  Semáforo de obligaciones, UMA vigente y salidas SAT listas para revisión.
                </p>
              </div>
              <Button
                className="shrink-0"
                onClick={() => {
                  setTabActiva("captura")
                  setPasoActual(0)
                  setActividadInfoKey(actividadKey)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Registrar operación
              </Button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              {[
                { label: "Sin obligación", value: resumenUmbrales.sinObligacion, tone: "text-emerald-700 bg-emerald-50 border-emerald-100" },
                { label: "Identificación", value: resumenUmbrales.identificacion, tone: "text-amber-700 bg-amber-50 border-amber-100" },
                { label: "Aviso SAT", value: resumenUmbrales.aviso, tone: "text-rose-700 bg-rose-50 border-rose-100" },
                { label: "Layout", value: resumenSalidas.avisoNormal, tone: "text-slate-800 bg-slate-50 border-slate-100" },
                { label: "Ceros / 27 Bis", value: resumenSalidas.informeCeros + resumenSalidas.informe27Bis, tone: "text-slate-800 bg-slate-50 border-slate-100" },
                { label: "24 horas", value: resumenSalidas.aviso24h, tone: "text-slate-800 bg-slate-50 border-slate-100" },
              ].map((item) => (
                <div key={item.label} className={`rounded-xl border p-4 ${item.tone}`}>
                  <p className="truncate text-xs font-semibold uppercase tracking-wide opacity-80">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
                {OPERATIVE_FLOW_STAGES.map((stage, index) => (
                  <div key={stage} className="flex min-w-0 items-center gap-2">
                    <Badge variant="outline" className="max-w-[145px] bg-white">
                      <span className="truncate">{stage}</span>
                    </Badge>
                    {index < OPERATIVE_FLOW_STAGES.length - 1 && <ArrowRight className="h-3 w-3 shrink-0 text-slate-300" />}
                  </div>
                ))}
              </div>
              {umaSeleccionada && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <span className="font-semibold">UMA diaria:</span> {formatCurrency(umaSeleccionada.daily)} ·{" "}
                  {monthLabel(umaSeleccionada.month)} {umaSeleccionada.year}
                </div>
              )}
            </div>
          </section>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-slate-600" /> Últimos registros capturados
              </CardTitle>
              <CardDescription>
                Busca, filtra y administra operaciones sin salir del resumen.
              </CardDescription>
              <div className="grid gap-3 pt-3 lg:grid-cols-[minmax(240px,1fr)_220px_180px_180px_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    className="pl-9"
                    value={busquedaOperaciones}
                    onChange={(event) => setBusquedaOperaciones(event.target.value)}
                    placeholder="Cliente, RFC, operación o referencia"
                    aria-label="Buscar operaciones"
                  />
                </div>
                <Select value={filtroActividadOperaciones} onValueChange={setFiltroActividadOperaciones}>
                  <SelectTrigger className="bg-white" aria-label="Filtrar por actividad">
                    <SelectValue placeholder="Actividad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las actividades</SelectItem>
                    {actividadesFiltroOperaciones.map((actividad) => (
                      <SelectItem key={actividad.value} value={actividad.value}>
                        {actividad.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filtroPeriodoOperaciones} onValueChange={setFiltroPeriodoOperaciones}>
                  <SelectTrigger className="bg-white" aria-label="Filtrar por periodo">
                    <SelectValue placeholder="Periodo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los periodos</SelectItem>
                    {periodosFiltroOperaciones.map((periodo) => (
                      <SelectItem key={periodo} value={periodo}>{periodo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filtroEstadoOperaciones} onValueChange={setFiltroEstadoOperaciones}>
                  <SelectTrigger className="bg-white" aria-label="Filtrar por estado">
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los estados</SelectItem>
                    <SelectItem value="aviso">Aviso</SelectItem>
                    <SelectItem value="identificacion">Identificación</SelectItem>
                    <SelectItem value="sin-obligacion">Sin obligación</SelectItem>
                    <SelectItem value="presented">Presentadas</SelectItem>
                    <SelectItem value="correction_pending">Corrección pendiente</SelectItem>
                    <SelectItem value="cancelled">Canceladas</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!hayFiltrosOperaciones}
                  onClick={() => {
                    setBusquedaOperaciones("")
                    setFiltroActividadOperaciones("todas")
                    setFiltroPeriodoOperaciones("todos")
                    setFiltroEstadoOperaciones("todos")
                  }}
                >
                  Limpiar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {operacionesRecientes.length === 0 ? (
                <div className="rounded border bg-slate-50 p-4 text-sm text-slate-600">
                  {hayFiltrosOperaciones
                    ? "No hay operaciones que coincidan con la búsqueda y filtros seleccionados."
                    : "Aún no hay registros disponibles. Inicia la captura guiada para evaluar tu primera operación."}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    {hayFiltrosOperaciones
                      ? `${operacionesRecientes.length} resultado(s)`
                      : `Mostrando ${operacionesRecientes.length} de ${operaciones.length} registro(s)`}
                  </p>
                  {operacionesRecientes.map((operacion) => (
                    <div
                      key={operacion.id}
                      className={cn(
                        "rounded-lg border bg-white p-3 text-sm",
                        isOperacionCancelada(operacion) && "border-slate-200 bg-slate-50 opacity-75",
                      )}
                    >
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
                          <Badge variant="outline" className="bg-slate-50">
                            {formatSalidaTipo(operacion.avisoSalidaTipo ?? "sin_salida")}
                          </Badge>
                          <span
                            className={cn(
                              "inline-flex items-center gap-2 rounded-full px-2 py-0.5 text-xs font-medium text-white",
                              isOperacionCancelada(operacion)
                                ? "bg-slate-500"
                                : getStatusColor(operacion.umbralStatus),
                            )}
                          >
                            {getOperacionLifecycleLabel(operacion)}
                          </span>
                          <span className="font-semibold text-slate-700">{formatMontoOperacion(operacion)}</span>
                          {!isOperacionCancelada(operacion) ? (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => abrirEdicionOperacion(operacion)}>
                                Editar
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                onClick={() => solicitarEliminarOperacion(operacion)}
                                aria-label={operacion.submission?.wasEverPresented || operacion.avisoPresentado ? "Cancelar operación" : "Eliminar operación"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : null}
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
          {operacionEnEdicionCompleta ? (
            <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">Editando operación existente</p>
                    <Badge variant="outline" className="border-sky-200 bg-white text-sky-700">
                      Revisión {operacionEnEdicionCompleta.revision ?? 1}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-sky-800">
                    {operacionEnEdicionCompleta.cliente} · {operacionEnEdicionCompleta.id}. El guardado conservará este ID.
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={limpiarFormulario}>
                  Cancelar edición
                </Button>
              </div>
              {(operacionEnEdicionCompleta.submission?.wasEverPresented || operacionEnEdicionCompleta.avisoPresentado) ? (
                <div className="mt-4 space-y-2">
                  <Label htmlFor="motivo-correccion">Motivo de corrección *</Label>
                  <Textarea
                    id="motivo-correccion"
                    value={motivoCorreccion}
                    onChange={(event) => setMotivoCorreccion(event.target.value)}
                    placeholder="Describe el ajuste y la evidencia que lo sustenta."
                  />
                  <p className="text-xs text-sky-800">
                    Al guardar se conservará el antes/después y la salida SAT pasará a corrección pendiente.
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}
          <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
            <div className="border-b border-emerald-100 bg-emerald-50/60 px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-950">Contexto de operación</h2>
                    <Badge
                      variant="outline"
                      className={
                        captureContextStatus === "Completo"
                          ? "border-emerald-200 bg-white text-emerald-700"
                          : captureContextStatus === "Revisar"
                            ? "border-sky-200 bg-white text-sky-700"
                            : "border-amber-200 bg-white text-amber-700"
                      }
                    >
                      {captureContextStatus}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    Define una sola vez sujeto, periodo, expediente y actividad. El wizard reutiliza este contexto.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={cargarDemoFraccionXV}>
                    Cargar demo
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={limpiarFormulario}>
                    Limpiar
                  </Button>
                  <Button type="button" size="sm" onClick={continuarCapturaDesdeContexto}>
                    Continuar captura
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-x-5 gap-y-4 lg:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <div className="flex h-5 items-center justify-between gap-2">
                    <Label className="text-[13px] font-semibold text-slate-800">Sujeto obligado</Label>
                  </div>
                  {sujetosObligadosDisponibles.length > 0 ? (
                    <Select
                      value={sujetoObligadoOperacion}
                      onValueChange={(value) => {
                        setSujetoObligadoOperacion(value)
                        setClienteOperacionSeleccionado("")
                        setExpedienteSeleccionado(null)
                        setPersonaExpedienteSeleccionada("")
                        setPersonaAvisoActual(null)
                      }}
                    >
                      <SelectTrigger
                        className="h-11 min-w-0 rounded-xl border-slate-200 bg-white px-4 text-[15px] shadow-sm shadow-slate-100/70 [&>span]:min-w-0 [&>span]:truncate"
                        title={sujetoObligadoContexto?.label ?? activeTenant?.razonSocial ?? "Selecciona sujeto"}
                      >
                        <SelectValue placeholder={activeTenant?.razonSocial ?? "Selecciona sujeto"} />
                      </SelectTrigger>
                      <SelectContent className="max-w-[min(760px,calc(100vw-2rem))]">
                        {sujetosObligadosDisponibles.map((opcion) => (
                          <SelectItem key={opcion.value} value={opcion.value} className="max-w-full">
                            <span className="block max-w-[min(680px,calc(100vw-5rem))] truncate">
                              {opcion.label} · {opcion.expedientesCount} EUI
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
                      <p className="truncate font-medium">{activeTenant?.razonSocial ?? "Demo PLD Multi-cliente"}</p>
                      <p className="truncate text-xs text-slate-500">RFC {activeTenant?.rfc ?? "pendiente"}</p>
                    </div>
                  )}
                </div>

                <div className="min-w-0 space-y-2">
                  <div className="flex h-5 items-center justify-between gap-2">
                    <Label className="text-[13px] font-semibold text-slate-800">Periodo</Label>
                    <span className="truncate text-[11px] font-medium text-slate-400">{buildPeriodo(anioOperacionCaptura, mesOperacionCaptura)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={anioOperacionCaptura.toString()}
                      onValueChange={(value) => {
                        const year = Number(value)
                        setAnioOperacionCaptura(year)
                        setAnioSeleccionado(year)
                      }}
                    >
                      <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white px-4 text-[15px] shadow-sm shadow-slate-100/70">
                        <SelectValue placeholder="Año" />
                      </SelectTrigger>
                      <SelectContent>
                        {(availableYears.length > 0 ? availableYears : [anioOperacionCaptura]).map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={mesOperacionCaptura.toString()}
                      onValueChange={(value) => {
                        const month = Number(value)
                        setMesOperacionCaptura(month)
                        setMesSeleccionado(month)
                      }}
                    >
                      <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-white px-4 text-[15px] shadow-sm shadow-slate-100/70">
                        <SelectValue placeholder="Mes" />
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

                <div className="min-w-0 space-y-2">
                  <div className="flex h-5 items-center justify-between gap-2">
                    <Label className="text-[13px] font-semibold text-slate-800">Cliente/EUI</Label>
                    <span className="truncate text-[11px] font-medium text-slate-400">
                      {clientesPorSujetoObligado.length === 1
                        ? "selección automática"
                        : clientesPorSujetoObligado.length > 1
                          ? `${clientesPorSujetoObligado.length} expedientes`
                          : "sin EUI"}
                    </span>
                  </div>
                  <Select
                    value={clienteOperacionSeleccionado}
                    onValueChange={(value) => {
                      setClienteOperacionSeleccionado(value)
                      setExpedienteSeleccionado(value)
                      setPersonaExpedienteSeleccionada("")
                      setPersonaAvisoActual(null)
                    }}
                  >
                    <SelectTrigger className="h-11 min-w-0 rounded-xl border-slate-200 bg-white px-4 text-[15px] shadow-sm shadow-slate-100/70 [&>span]:min-w-0 [&>span]:truncate">
                      <SelectValue placeholder="Selecciona expediente" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {clientesPorSujetoObligado.length > 0 ? (
                        clientesPorSujetoObligado.map((cliente) => (
                          <SelectItem key={cliente.value} value={cliente.value}>
                            {cliente.label}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Sin expedientes vinculados</div>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="line-clamp-1 text-xs text-slate-500">
                    {clientesPorSujetoObligado.length === 0
                      ? "Este sujeto obligado todavía no tiene expedientes EUI vinculados."
                      : clientesPorSujetoObligado.length === 1
                        ? "1 expediente disponible; se selecciona automáticamente."
                        : `${clientesPorSujetoObligado.length} expedientes disponibles para este sujeto obligado.`}
                  </p>
                </div>

                <div className="min-w-0 space-y-2">
                  <div className="flex h-5 items-center justify-between gap-2">
                    <Label className="text-[13px] font-semibold text-slate-800">Actividad vulnerable</Label>
                    <span className="truncate text-[11px] font-medium text-slate-400">
                      {contextActividadSeleccionada?.fraccion ?? "fracción pendiente"}
                    </span>
                  </div>
                  <ActividadVulnerableCombobox
                    value={actividadOperacionSeleccionada || actividadKey}
                    options={actividadesRegistradasCliente.length > 0 ? actividadesRegistradasCliente : actividadesVulnerables}
                    placeholder="Busca fracción o actividad"
                    disabled={(actividadesRegistradasCliente.length > 0 ? actividadesRegistradasCliente : actividadesVulnerables).length === 0}
                    triggerClassName="h-11 rounded-xl border-slate-200 px-4 text-[15px] shadow-sm shadow-slate-100/70"
                    onChange={(value) => {
                      setActividadOperacionSeleccionada(value)
                      setActividadKey(value)
                      setActividadInfoKey(value)
                    }}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="min-w-0 rounded-xl border bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">EUI</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                    {contextClienteLabel || "Pendiente"}
                  </p>
                  <p className="truncate text-xs text-slate-500">{rfc || clienteOperacionSeleccionado || "Selecciona cliente"}</p>
                </div>
                <div className="min-w-0 rounded-xl border bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Formato</p>
                  <p
                    className="mt-1 line-clamp-2 break-all text-xs font-semibold leading-snug text-slate-900"
                    title={satTemplateActual?.officialXlsmName ?? contextSatFormato?.nombre ?? "Pendiente"}
                  >
                    {satTemplateActual?.officialXlsmName ?? contextSatFormato?.nombre ?? "Pendiente"}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">{contextActividadSeleccionada?.fraccion ?? "Sin fracción"}</p>
                </div>
                <div className="min-w-0 rounded-xl border bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Salida preliminar</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">{formatSalidaTipo(satOutputKindActual)}</p>
                  <p className="line-clamp-2 text-xs leading-snug text-slate-500">{satWorkbookStatusLabel}</p>
                </div>
                <label className="flex min-w-0 items-start gap-3 rounded-xl border bg-slate-50 p-3 text-sm">
                  <Checkbox
                    checked={relacionNegocios}
                    onCheckedChange={(valor) => setRelacionNegocios(Boolean(valor))}
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-900">Relación de negocios</span>
                    <button
                      type="button"
                      className="truncate text-left text-xs text-emerald-700 underline-offset-2 hover:underline"
                      onClick={() => setRelacionNegociosOpen(true)}
                    >
                      {relacionNegocios
                        ? `Revisión ${siguienteRevisionAnual ?? "por programar"}`
                        : "Marcar si aplica"}
                    </button>
                  </span>
                </label>
              </div>

              {contextMissingReasons.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">Qué falta para iniciar sin fricción</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {contextMissingReasons.map((reason) => (
                      <Badge key={reason.id} variant="outline" className="border-amber-200 bg-white text-amber-800">
                        {reason.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  <span className="font-semibold">Contexto listo. Continúa con el primer paso operativo pendiente.</span>
                  <span className="text-xs">
                    {MONTHS[mesOperacionCaptura - 1]} {anioOperacionCaptura} · {contextActividadSeleccionada?.nombre}
                  </span>
                </div>
              )}
            </div>
          </section>

          <SatOutputSummaryPanel
            clienteNombre={clienteNombre}
            rfc={rfc}
            actividadFraccion={actividadSeleccionada?.fraccion ?? ""}
            actividadNombre={actividadSeleccionada?.nombre ?? ""}
            salidaLabel={formatSalidaTipo(satOutputKindActual)}
            fechaLimiteLabel={
              operationalCasePreview?.satOutputStatus.fechaLimite
                ? `Límite ${formatDateDisplay(operationalCasePreview.satOutputStatus.fechaLimite)}`
                : "Sin fecha ordinaria"
            }
            evidenciaLabel={evidenceDecisionActual.canClose ? "Lista para cierre" : "Pendiente"}
            missingCriticalCount={evidenceDecisionActual.missingCritical.length}
            workbookStatusLabel={satWorkbookStatusLabel}
            blockersView={blockingReasonsView}
            salidaInfo={ACTOS_INFO_HINTS.salidaSat}
            evidenciaInfo={ACTOS_INFO_HINTS.evidenciaCritica}
          />

          <div className="grid gap-4 lg:grid-cols-[170px_minmax(0,1fr)] lg:items-start">
            <OperationalProgressRail
              steps={STEPS}
              diagnostics={wizardStepDiagnostics}
              currentStep={pasoActual}
              onSelectStep={setPasoActual}
            />

            <div className="min-w-0 space-y-4">
              {pasoActual === 0 && (
                <Card className="border-slate-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-slate-600" /> Contexto confirmado
                    </CardTitle>
                    <CardDescription>
                      Este paso resume lo que ya definiste arriba. Cambia datos en “Contexto de operación” si hace falta.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sujeto obligado</p>
                        <p className="mt-1 line-clamp-2 break-words font-semibold leading-snug text-slate-900">
                          {tenantOperacionalActual?.razonSocial ?? "Demo PLD Multi-cliente"}
                        </p>
                        <p className="text-xs text-slate-500">
                          RFC {tenantOperacionalActual?.rfc ?? "pendiente"} · {tenantOperacionalActual?.representanteCumplimiento.nombre ?? "Responsable pendiente"}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Periodo y UMA</p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {monthLabel(mesSeleccionado)} {anioSeleccionado}
                        </p>
                        <p className="text-xs text-slate-500">
                          {umaSeleccionada ? `UMA diaria ${formatCurrency(umaSeleccionada.daily)}` : "UMA pendiente"}
                        </p>
                      </div>
                      <div className="rounded-xl border bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actividad vulnerable</p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {actividadSeleccionada ? `${actividadSeleccionada.fraccion} · ${actividadSeleccionada.nombre}` : "Pendiente"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {acumulacionSourceDisplay?.chips.map((chip) => (
                            <RegulatorySourceChip key={chip.id} chip={chip} />
                          ))}
                          {acumulacionSourceDisplay && (
                            <InfoHint
                              content={{
                                id: "acumulacion-fuente",
                                title: acumulacionRuleActual?.applies ? "Acumula seis meses" : "No acumula seis meses",
                                summary: acumulacionSourceDisplay.summary,
                                body: acumulacionSourceDisplay.detail.split("\n").filter(Boolean),
                                sourceLabel: acumulacionSourceDisplay.chips.find((chip) => chip.sourceUrl)?.label,
                                sourceUrl: acumulacionSourceDisplay.chips.find((chip) => chip.sourceUrl)?.sourceUrl,
                              }}
                            />
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl border bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Formato SAT</p>
                        <p
                          className="mt-1 line-clamp-2 break-all font-semibold leading-snug text-slate-900"
                          title={satTemplateActual?.officialXlsmName ?? satFormatoActual?.nombre ?? "Pendiente"}
                        >
                          {satTemplateActual?.officialXlsmName ?? satFormatoActual?.nombre ?? "Pendiente"}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-500">
                          {satWorkbookStatusLabel}
                        </p>
                      </div>
                    </div>

                    {contextMissingReasons.length > 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <p className="font-semibold">Completa el contexto antes de avanzar</p>
                        <ul className="mt-2 space-y-1">
                          {contextMissingReasons.map((reason) => (
                            <li key={reason.id}>
                              <span className="font-semibold">{reason.label}:</span> {reason.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                        <p className="font-semibold">Contexto completo</p>
                        <p className="mt-1 text-emerald-800">
                          El siguiente paso usará este contexto para precargar EUI, plantilla XLSM y salida SAT.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

          {pasoActual === 5 && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-slate-600" /> Paso 6. EBR y señales de alerta
                </CardTitle>
                <CardDescription>
                  Aplica la metodología generalizada de riesgo: clientes 30%, producto/servicio 30%, canal 20% y geografía 20%.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded border bg-white p-4 text-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Riesgo inherente</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-800">
                      {ebrMetodologiaActual.inherent.level}
                    </p>
                    <p className="text-xs text-muted-foreground">Score {ebrMetodologiaActual.inherent.score.toFixed(2)}</p>
                  </div>
                  <div className="rounded border bg-white p-4 text-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Riesgo residual</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-800">
                      {ebrMetodologiaActual.residual.level}
                    </p>
                    <p className="text-xs text-muted-foreground">Score {ebrMetodologiaActual.residual.score.toFixed(2)}</p>
                  </div>
                  <div className="rounded border bg-slate-50 p-4 text-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Plan de mitigación</p>
                    <p className="mt-2 font-semibold text-slate-800">
                      {ebrMetodologiaActual.actionPlan[0]?.priority}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ebrMetodologiaActual.actionPlan[0]?.action}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  {ebrMetodologiaActual.factors.map((factor) => (
                    <div key={factor.key} className="rounded border bg-white p-3 text-xs text-slate-700">
                      <p className="font-semibold">{factor.label}</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{factor.score.toFixed(2)}</p>
                      <p className="text-muted-foreground">Peso {Math.round(ebrMetodologiaActual.weights[factor.key] * 100)}%</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3 rounded border bg-white p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="sospecha24h"
                        checked={sospecha24h}
                        onCheckedChange={(checked) => setSospecha24h(Boolean(checked))}
                      />
                      <div>
                        <div className="flex items-center gap-1">
                          <Label htmlFor="sospecha24h" className="font-semibold">
                            Activar aviso de 24 horas
                          </Label>
                          <InfoHint content={ACTOS_INFO_HINTS.aviso24h} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Úsalo ante indicios o sospecha, incluso si el acto no se celebró. No se retrasa por evidencia incompleta.
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Narrativa de hechos, indicio o señal de alerta</Label>
                      <Textarea
                        value={alertaDescripcion}
                        onChange={(event) => setAlertaDescripcion(event.target.value)}
                        placeholder="Describe qué ocurrió, fuente del indicio, fecha de conocimiento y acciones tomadas."
                        rows={5}
                      />
                      {sospecha24h && alertaDescripcion.trim().length < 20 && (
                        <p className="text-xs text-amber-700">
                          El aviso de 24 horas requiere narrativa mínima antes de continuar.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded border bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-semibold">Controles mitigantes aplicados</p>
                    <div className="mt-3 grid gap-2">
                      {ebrMetodologiaActual.controls.slice(0, 6).map((control) => (
                        <div key={control.key} className="flex items-center justify-between rounded border bg-white px-3 py-2 text-xs">
                          <span>{control.label}</span>
                          <Badge variant="outline">{control.effectiveness}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {pasoActual === 6 && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="h-5 w-5 text-slate-600" /> Paso 7. Evidencias junto al requisito
                </CardTitle>
                <CardDescription>
                  Marca documentos recibidos, asocia archivos por requisito y justifica faltantes críticos cuando proceda.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded border bg-white p-4 text-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Estado de cierre</p>
                    <p className="mt-2 text-xl font-semibold text-slate-800">
                      {evidenceDecisionActual.canClose
                        ? "Completo"
                        : evidenceDecisionActual.canContinueForSatOutput
                          ? "Continúa por 24h"
                          : "Bloqueado para cierre"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Guardado permitido; cierre solo con críticos cubiertos o justificados.
                    </p>
                  </div>
                  <div className="rounded border bg-white p-4 text-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Críticos pendientes</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-800">
                      {evidenceDecisionActual.missingCritical.length}
                    </p>
                  </div>
                  <div className="rounded border bg-white p-4 text-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Opcionales pendientes</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-800">
                      {evidenceDecisionActual.missingOptional.length}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {requisitosDocumentalesActuales.map((requisito) => {
                    const checked = Boolean(draftEvidenceChecklist[requisito.id])
                    const justificacion = draftEvidenceJustifications[requisito.id] ?? ""
                    const fileName = draftEvidenceFiles[requisito.id] ?? ""
                    const covered = checked || Boolean(justificacion.trim())
                    return (
                      <div
                        key={requisito.id}
                        className={`rounded border p-4 ${
                          covered
                            ? "border-emerald-200 bg-emerald-50/40"
                            : requisito.critical
                              ? "border-amber-200 bg-amber-50/40"
                              : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                          <div className="space-y-2">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                id={`req-${requisito.id}`}
                                checked={checked}
                                onCheckedChange={(value) =>
                                  setDraftEvidenceChecklist((prev) => ({
                                    ...prev,
                                    [requisito.id]: Boolean(value),
                                  }))
                                }
                              />
                              <div>
                                <Label htmlFor={`req-${requisito.id}`} className="font-semibold">
                                  {requisito.label}
                                </Label>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  <Badge variant="outline">{requisito.category}</Badge>
                                  {requisito.critical && <Badge className="bg-amber-600">Crítico</Badge>}
                                  <Badge variant="outline">{requisito.source}</Badge>
                                </div>
                              </div>
                            </div>
                            <Textarea
                              value={justificacion}
                              onChange={(event) =>
                                setDraftEvidenceJustifications((prev) => ({
                                  ...prev,
                                  [requisito.id]: event.target.value,
                                }))
                              }
                              placeholder="Justificación, cotejo u observación mínima si no hay documento completo."
                              rows={2}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Archivo asociado</Label>
                            <Input
                              type="file"
                              accept=".pdf,image/*"
                              onChange={(event) => {
                                const file = event.target.files?.[0]
                                setDraftEvidenceFiles((prev) => ({
                                  ...prev,
                                  [requisito.id]: file?.name ?? "",
                                }))
                                if (file) {
                                  setDraftEvidenceChecklist((prev) => ({
                                    ...prev,
                                    [requisito.id]: true,
                                  }))
                                }
                              }}
                            />
                            <p className="text-xs text-muted-foreground">
                              {fileName || "Sin archivo seleccionado en este lote."}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {!evidenceDecisionActual.canClose && (
                  <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <p className="font-semibold">Qué falta para cerrar</p>
                    <ul className="mt-2 list-disc space-y-1 pl-4">
                      {evidenceDecisionActual.closingBlockedReasons.slice(0, 5).map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {pasoActual === 2 && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-slate-600" /> Paso 3. Cliente, expediente único de identificación y datos base
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
                              <SelectItem key={expediente.expedienteId} value={expediente.expedienteId}>
                                {expediente.nombre ??
                                  getPrimaryExpedienteIdentifier(expediente.identifiers) ??
                                  expediente.expedienteId}
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
                          <span className="font-semibold">RFC / NIF / CURP:</span>{" "}
                          {personaAvisoActual.rfc ||
                            personaAvisoActual.nif ||
                            personaAvisoActual.curp ||
                            (expedienteActual
                              ? getPrimaryExpedienteIdentifier(expedienteActual.identifiers)
                              : "") ||
                            "Sin identificador"}
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

                {operacionesReutilizables.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">Operaciones reutilizables</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Usa una operación anterior como plantilla. Se conserva cliente, EUI, SAT y evidencia base; fecha y periodo se actualizan.
                        </p>
                      </div>
                      <Badge variant="outline" className="w-fit bg-slate-50 text-xs">
                        {operacionesReutilizables.length} disponible(s)
                      </Badge>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {operacionesReutilizables.map((operacion) => (
                        <button
                          key={operacion.id}
                          type="button"
                          className="flex min-w-0 flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/60 md:flex-row md:items-center md:justify-between"
                          onClick={() => reutilizarDatosCliente(operacion)}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-800">
                              {operacion.tipoOperacion || operacion.actividadNombre}
                            </span>
                            <span className="mt-1 block truncate text-xs text-slate-500">
                              {operacion.periodo} · {operacion.cliente} · {formatMontoOperacion(operacion)}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-semibold text-emerald-700">
                            Usar como plantilla
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {expedienteSeleccionado && clienteNombre && rfc && (
                  <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold">Cliente/EUI precargado</p>
                      <p className="mt-1 truncate text-emerald-800">
                        {clienteNombre} · RFC {rfc} · {formatTipoClienteLabel(tipoCliente, detalleTipoCliente)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 bg-white"
                      onClick={() => {
                        setExpedienteSeleccionado(null)
                        setPersonaExpedienteSeleccionada("")
                        setPersonaAvisoActual(null)
                      }}
                    >
                      Cambiar datos
                    </Button>
                  </div>
                )}

                <div className={`${expedienteSeleccionado && clienteNombre && rfc ? "hidden" : "grid"} gap-4 md:grid-cols-3`}>
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
                    <Label>Identificador (RFC, NIF o CURP)</Label>
                    <Input
                      placeholder="Identificador del cliente"
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
                    <label className="flex items-start gap-2 rounded border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-800">
                      <Checkbox
                        checked={sospecha24h}
                        onCheckedChange={(checked) => setSospecha24h(Boolean(checked))}
                        className="mt-0.5"
                      />
                      <span>
                        Activar aviso de 24 horas por indicios, lista o sospecha. Documentar hechos y no esperar al cierre documental.
                      </span>
                    </label>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de operación</Label>
                    {fixedTipoOperacionSat ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{fixedTipoOperacionSat}</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                          Valor fijo del XLSM oficial para este formato; no requiere captura ni texto libre.
                        </p>
                      </div>
                    ) : tipoOperacionOptions.length > 0 ? (
                      <div className="space-y-2">
                        <SearchableOptionCombobox
                          value={tipoOperacion}
                          options={tipoOperacionOptions}
                          placeholder="Selecciona opción SAT"
                          searchPlaceholder="Buscar tipo de operación"
                          emptyLabel="Sin tipos de operación disponibles"
                          onChange={(value) => {
                            setTipoOperacion(value)
                            const satCode = value.match(/^\s*([^,\s]+)/)?.[1] ?? ""
                            setCodigoOperacionInmueble(satCode)
                            if (tipoOperacionSatField) {
                              actualizarSatField(tipoOperacionSatField.id, value)
                            }
                          }}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Lista tomada del desplegable del XLSM oficial para esta fracción.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Input
                          placeholder="Ejemplo: Compra de inmueble"
                          value={tipoOperacion}
                          onChange={(event) => {
                            setTipoOperacion(event.target.value)
                            if (tipoOperacionSatField) {
                              actualizarSatField(tipoOperacionSatField.id, event.target.value)
                            }
                          }}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Este XLSM no expone un desplegable oficial para este campo; se permite captura libre y se valida en el cuestionario SAT.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Monto</Label>
                    <Input
                      placeholder="0.00"
                      type="text"
                      inputMode="decimal"
                      value={montoOperacion}
                      onChange={(event) => {
                        const value = event.target.value
                        setMontoOperacion(value)
                        const parsed = parseMoneyToCents(value, { allowZero: sospecha24h })
                        if (!parsed.ok) return
                        setSatFieldValues((current) =>
                          Object.fromEntries(
                            Object.entries(current).map(([fieldId, fieldValue]) => {
                              const normalized = normalizarBusqueda(fieldId)
                              const isSurface = /superficie|terreno|construccion|m2/.test(normalized)
                              const isAmount = /monto|importe|contraprestacion|valor-pactado|precio-pactado/.test(normalized)
                              return isAmount && !isSurface ? [fieldId, parsed.decimal] : [fieldId, fieldValue]
                            }),
                          ),
                        )
                      }}
                      aria-invalid={Boolean(montoOperacion && !montoOperacionParseado.ok)}
                    />
                    {montoOperacion && !montoOperacionParseado.ok ? (
                      <p className="text-xs text-rose-600">{montoOperacionParseado.message}</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Acepta 10000000, 10,000,000 o 10,000,000.00; máximo dos decimales.
                      </p>
                    )}
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
                      onChange={(event) => {
                        const value = event.target.value
                        setFechaOperacion(value)
                        if (operacionEditandoId) {
                          const [year, month] = value.split("-").map(Number)
                          if (year && month) {
                            setAnioSeleccionado(year)
                            setMesSeleccionado(month)
                            setAnioOperacionCaptura(year)
                            setMesOperacionCaptura(month)
                          }
                        }
                      }}
                    />
                  </div>
                  {esActividadInmuebles && (
                    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 md:col-span-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <Label className="text-sm font-semibold text-slate-900">Pago recurrente de arrendamiento</Label>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">
                            Úsalo cuando un pago cubre varios meses. No apaga la obligación; marca revisión para evitar falsos positivos operativos.
                          </p>
                        </div>
                        {revisionPagoRecurrente.requiresReview && (
                          <Badge variant="outline" className="w-fit border-amber-200 bg-amber-50 text-xs text-amber-700">
                            Requiere revisión
                          </Badge>
                        )}
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Meses cubiertos por el pago</Label>
                          <Select value={pagoRecurrenteMeses} onValueChange={setPagoRecurrenteMeses}>
                            <SelectTrigger className="bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6].map((meses) => (
                                <SelectItem key={meses} value={String(meses)}>
                                  {meses} mes{meses === 1 ? "" : "es"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Mensualidad esperada</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="Opcional"
                            value={pagoRecurrenteMensualidad}
                            onChange={(event) => setPagoRecurrenteMensualidad(event.target.value)}
                          />
                        </div>
                        <div className="space-y-2 md:col-span-3">
                          <Label>Nota de revisión</Label>
                          <Input
                            placeholder="Ej. Pago tardío de enero a marzo conforme al contrato de arrendamiento."
                            value={pagoRecurrenteNota}
                            onChange={(event) => setPagoRecurrenteNota(event.target.value)}
                          />
                        </div>
                      </div>
                      {revisionPagoRecurrente.requiresReview && (
                        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                          {revisionPagoRecurrente.message} Equivalente mensual:{" "}
                          {formatCurrency(revisionPagoRecurrente.monthlyEquivalentMxn ?? 0)}.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <Label className="text-sm font-semibold text-slate-900">Evidencia inicial</Label>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          Adjunta soporte de la operación y forma de pago desde aquí. El checklist detallado queda en Evidencias.
                        </p>
                      </div>
                      <Badge variant="outline" className="w-fit bg-white text-xs">
                        {draftEvidenceUploads.length} archivo(s)
                      </Badge>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {[
                        {
                          requirement: soporteOperacionRequirement,
                          title: "Soporte del acto",
                          hint: "Contrato, instrumento, pedido, factura o documento equivalente.",
                        },
                        {
                          requirement: formaPagoRequirement,
                          title: "Forma de pago",
                          hint: "Comprobante, SPEI, estado de cuenta, recibo o liquidación.",
                        },
                      ].map((item) => {
                        const uploaded = draftEvidenceUploads.filter(
                          (upload) => upload.requisitoId === item.requirement.id,
                        )
                        return (
                          <div key={item.requirement.id} className="rounded-lg border bg-white p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-800">{item.title}</p>
                                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{item.hint}</p>
                              </div>
                              <Badge variant="outline" className="shrink-0 bg-slate-50 text-[10px]">
                                {uploaded.length || "Pendiente"}
                              </Badge>
                            </div>
                            <div className="mt-3">
                              <Label
                                htmlFor={`quick-evidence-${item.requirement.id}`}
                                className="inline-flex cursor-pointer items-center rounded-md border bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                Subir archivos
                              </Label>
                              <input
                                id={`quick-evidence-${item.requirement.id}`}
                                type="file"
                                accept=".pdf,image/*,.xml,.xlsx,.xlsm"
                                multiple
                                className="sr-only"
                                onChange={(event) =>
                                  manejarArchivosEvidenciaRapida(
                                    item.requirement.id,
                                    item.requirement.label,
                                    event,
                                  )
                                }
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {draftEvidenceUploads.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {draftEvidenceUploads.map((upload) => (
                          <span
                            key={upload.id}
                            className="inline-flex max-w-full items-center gap-2 rounded-full border bg-white px-2.5 py-1 text-xs text-slate-700"
                          >
                            <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="max-w-[220px] truncate">{upload.archivoNombre}</span>
                            <button
                              type="button"
                              className="text-slate-400 hover:text-rose-600"
                              onClick={() => eliminarEvidenciaRapida(upload.id)}
                              aria-label={`Quitar ${upload.archivoNombre}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Descripción breve</Label>
                      <Textarea
                        placeholder="Ej. Contrato preliminar, comprobante SPEI y CFDI de anticipo."
                        value={evidencia}
                        onChange={(event) => setEvidencia(event.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                {!satDynamicFormActual && (
                  <>
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
                  </>
                )}

                <SatDynamicOperationFormView
                  form={satDynamicFormActual}
                  values={satEffectiveFieldValues}
                  missingRequired={satMissingRequiredFields}
                  onChange={actualizarSatField}
                  editedFieldIds={Object.keys(satFieldValues)}
                  infoHintContent={ACTOS_INFO_HINTS.xlsmSat}
                  sectionKinds={[
                    "alta_sat",
                    "persona_objeto",
                    "acto_operacion",
                    "contraparte",
                    "instrumento",
                    "liquidacion",
                  ]}
                />

                {false && esActividadInmuebles && (
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
                          <Label>Valor de avalúo</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={inmuebleForm.valorAvaluo}
                            onChange={(event) => actualizarInmuebleForm("valorAvaluo", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Valor catastral</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={inmuebleForm.valorCatastral}
                            onChange={(event) => actualizarInmuebleForm("valorCatastral", event.target.value)}
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
                            type="text"
                            inputMode="decimal"
                            value={instrumentoForm.valorAvaluo}
                            onChange={(event) => actualizarInstrumentoForm("valorAvaluo", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Valor catastral</Label>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={instrumentoForm.valorCatastral}
                            onChange={(event) => actualizarInstrumentoForm("valorCatastral", event.target.value)}
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
                            ? "La operación no supera umbrales, monitorear acumulado por cliente y ventana SAT."
                            : evaluacionActual.status === "identificacion"
                              ? "Integra expediente completo, valida listas y conserva evidencia."
                              : `Prepara aviso ante el SAT${evaluacionActual.fechaLimiteAviso ? ` antes del ${formatDateDisplay(evaluacionActual.fechaLimiteAviso)}` : ""} o informe 27 Bis según el grupo empresarial.`}
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
                        <div className="space-y-1 rounded border border-slate-200 bg-white p-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {formatSalidaTipo(evaluacionActual.salida.tipo)}
                          </p>
                          <p>{evaluacionActual.salida.descripcion}</p>
                          <p className="text-muted-foreground">
                            {evaluacionActual.acumulacionRazon}
                          </p>
                        </div>
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
                      La operación rebasa el umbral de aviso y el cliente pertenece al mismo grupo empresarial. Clasificar como informe 27 Bis, no como informe en ceros ordinario, preservando evidencia documental.
                    </p>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">Datos SAT mínimos</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        El sistema ya valida lo esencial para aviso: RFC, periodo, actividad, operación, pago y evidencia.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["RFC", "Periodo", "Actividad", "Operación", "Pago", "Evidencia"].map((item) => (
                        <Badge key={item} variant="outline" className="bg-slate-50">
                          {item}
                        </Badge>
                      ))}
                      <InfoHint
                        content={{
                          id: "datos-minimos-aviso-sat",
                          title: "Datos requeridos para aviso SAT",
                          summary: "Resumen operativo de los datos que alimentan el Excel y XML SAT.",
                          body: [
                            `Periodo en formato AAAAMM: ${evaluacionActual?.periodo ?? buildPeriodo(anioSeleccionado, mesSeleccionado)}.`,
                            "RFC del sujeto obligado y del cliente o usuario.",
                            "Clave de actividad vulnerable y subformato SAT cuando aplique.",
                            "Detalle del acto u operación, monto, moneda, forma de pago y evidencia documental.",
                            "Representante legal, encargado de cumplimiento, medios de contacto y alta en el padrón se toman de Alta SAT/EUI cuando estén disponibles.",
                          ],
                        }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {pasoActual === 1 && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-600" /> Formato SAT y reglas de salida
                  {actividadSeleccionada?.fraccion && (
                    <Badge variant="outline" className="bg-slate-50 text-xs">
                      {actividadSeleccionada.fraccion}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Revisa la decisión base de la operación. Los detalles normativos quedan disponibles sin saturar la captura.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actividad seleccionada</p>
                      <h3 className="mt-1 text-lg font-semibold leading-tight text-slate-950">
                        {actividadSeleccionada?.nombre ?? "Actividad pendiente"}
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">
                        {actividadSeleccionada?.descripcion ?? "Selecciona una fracción para resolver reglas y plantilla SAT."}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Badge variant="outline" className="bg-white">
                        {satOutputKindActual === "aviso_24h" ? "Revisión urgente" : formatSalidaTipo(satOutputKindActual)}
                      </Badge>
                      <InfoHint
                        content={{
                          id: "salida-sat-paso-actividad",
                          title: "Salida SAT sugerida",
                          summary: "La plataforma calcula una salida preliminar con umbral, acumulación, grupo empresarial y sospecha 24h.",
                          body: [
                            "Aviso normal: operación objeto de aviso al día 17 del mes inmediato siguiente.",
                            "Informe en ceros: periodo sin operaciones objeto de aviso ni supuestos 27 Bis.",
                            "Informe 27 Bis: supuesto exceptuado conforme a reglas aplicables, con evidencia.",
                            "Aviso 24 horas: indicios o sospecha; no debe retrasarse por evidencia incompleta.",
                          ],
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="min-w-0 rounded-xl border bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Umbrales</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">Identificación y aviso</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 bg-slate-50">
                        UMA
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-2 text-sm">
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Identificación</p>
                        <p className="mt-0.5 line-clamp-2 font-medium text-slate-900">{umbralTexto.identificacion ?? "No aplica"}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Aviso</p>
                        <p className="mt-0.5 line-clamp-2 font-medium text-slate-900">{umbralTexto.aviso ?? "No aplica"}</p>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`min-w-0 rounded-xl border p-4 ${
                      acumulacionRuleActual?.applies
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-amber-200 bg-amber-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acumulación</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {acumulacionRuleActual?.applies ? "Acumula seis meses" : "No acumula seis meses"}
                        </p>
                      </div>
                      {acumulacionSourceDisplay && (
                        <InfoHint
                          content={{
                            id: "acumulacion-paso-actividad",
                            title: acumulacionRuleActual?.applies ? "Acumula seis meses" : "No acumula seis meses",
                            summary: acumulacionSourceDisplay.visibleWarning || acumulacionSourceDisplay.summary,
                            body: acumulacionSourceDisplay.detail.split("\n").filter(Boolean),
                            sourceLabel: acumulacionSourceDisplay.chips.find((chip) => chip.sourceUrl)?.label,
                            sourceUrl: acumulacionSourceDisplay.chips.find((chip) => chip.sourceUrl)?.sourceUrl,
                          }}
                        />
                      )}
                    </div>
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-700">
                      {acumulacionSourceDisplay?.visibleWarning || acumulacionSourceDisplay?.summary || "Selecciona actividad para evaluar acumulación."}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {acumulacionSourceDisplay?.chips.map((chip) => (
                        <RegulatorySourceChip key={chip.id} chip={chip} />
                      ))}
                    </div>
                  </div>

                  <div className="min-w-0 rounded-xl border bg-white p-4 md:col-span-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Formato SAT</p>
                        <p
                          className="mt-1 line-clamp-2 break-all text-sm font-semibold leading-snug text-slate-900"
                          title={satTemplateActual?.officialXlsmName ?? satFormatoActual?.nombre ?? "Pendiente"}
                        >
                          {satTemplateActual?.officialXlsmName ?? satFormatoActual?.nombre ?? "Pendiente"}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={satWorkbookStatusActual === "listo" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}
                      >
                        {satWorkbookStatusActual === "listo" ? "Listo" : "Borrador"}
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-slate-500">
                      {satLayoutActual
                        ? `${satLayoutActual.sections.length} hoja(s) y ${satLayoutActual.optionLists.length} lista(s) oficiales.`
                        : satLayoutsLoaded
                          ? "Layout pendiente de sincronización local."
                          : "Cargando layout cacheado..."}
                    </p>
                    {satTemplateActual?.requiresVariantSelection && (
                      <div className="mt-3 space-y-1">
                        <Label className="text-xs">Subformato SAT</Label>
                        <Select
                          value={satTemplateVariantId || satTemplateActual.templateId}
                          onValueChange={(value) => {
                            setSatTemplateVariantId(value)
                            setSatFieldValues({})
                          }}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecciona subformato" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {satTemplateActual.variants.map((variant) => (
                              <SelectItem key={variant.templateId} value={variant.templateId}>
                                {variant.label} · {variant.officialXlsmName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {satFormatoActual ? (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <a className="inline-flex items-center gap-1 rounded-full border bg-slate-50 px-2.5 py-1 text-slate-700 hover:bg-slate-100" href={satFormatoActual.avisoUrl ?? satFormatoActual.satPageUrl} target="_blank" rel="noreferrer">
                          Plantilla oficial <ExternalLink className="h-3 w-3" />
                        </a>
                        <a className="inline-flex items-center gap-1 rounded-full border bg-slate-50 px-2.5 py-1 text-slate-700 hover:bg-slate-100" href={satFormatoActual.informeCerosUrl ?? satFormatoActual.satPageUrl} target="_blank" rel="noreferrer">
                          Informe en ceros <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ) : (
                      <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Revisa el manifiesto SAT antes de generar salida.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">Decisión operativa siguiente</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        Captura la operación; el sistema recalculará salida SAT con monto, forma de pago, evidencia, grupo empresarial y señales de alerta.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(satFormatoActual?.outputModes ?? [satOutputKindActual]).map((kind) => (
                        <Badge key={kind} variant="outline" className="bg-slate-50">
                          {formatSalidaTipo(kind)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {pasoActual === 3 && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-slate-600" /> Paso 4. Beneficiario controlador
                </CardTitle>
                <CardDescription>
                  Revisa los datos prellenados, corrige únicamente lo necesario y confirma el beneficiario controlador.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-emerald-950">Beneficiario controlador</p>
                        <Badge
                          variant="outline"
                          className={
                            datosEuiConfirmados
                              ? "border-emerald-200 bg-white text-emerald-700"
                              : "border-amber-200 bg-white text-amber-700"
                          }
                        >
                          {datosEuiConfirmados ? "Confirmado" : "Pendiente de confirmar"}
                        </Badge>
                        {expedienteActual?.beneficiariosControladores?.length ? (
                          <Badge variant="outline" className="bg-white text-slate-600">Prellenado desde EUI</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-emerald-800">
                        La confirmación se reinicia automáticamente si modificas cualquier dato.
                      </p>
                    </div>
                    <Button type="button" size="sm" onClick={confirmarBeneficiarioControlador}>
                      {datosEuiConfirmados ? "Confirmado" : "Confirmar beneficiario controlador"}
                    </Button>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Tipo de persona</Label>
                      <Select
                        value={beneficiarioForm.tipo}
                        onValueChange={(value: "persona_fisica" | "persona_moral") =>
                          actualizarBeneficiarioForm("tipo", value)
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
                      <Label>{beneficiarioForm.tipo === "persona_moral" ? "Razón social" : "Nombre"}</Label>
                      <Input
                        value={beneficiarioForm.nombre}
                        onChange={(event) => actualizarBeneficiarioForm("nombre", event.target.value)}
                        placeholder={beneficiarioForm.tipo === "persona_moral" ? "Razón social" : "Nombre(s)"}
                      />
                    </div>
                    {beneficiarioForm.tipo === "persona_fisica" ? (
                      <>
                        <div className="space-y-2">
                          <Label>Apellido paterno</Label>
                          <Input
                            value={beneficiarioForm.apellidoPaterno}
                            onChange={(event) => actualizarBeneficiarioForm("apellidoPaterno", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Apellido materno</Label>
                          <Input
                            value={beneficiarioForm.apellidoMaterno}
                            onChange={(event) => actualizarBeneficiarioForm("apellidoMaterno", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Fecha de nacimiento</Label>
                          <Input
                            type="date"
                            value={beneficiarioForm.fechaNacimiento}
                            onChange={(event) => actualizarBeneficiarioForm("fechaNacimiento", event.target.value)}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Label>Fecha de constitución</Label>
                        <Input
                          type="date"
                          value={beneficiarioForm.fechaConstitucion}
                          onChange={(event) => actualizarBeneficiarioForm("fechaConstitucion", event.target.value)}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>RFC o NIF</Label>
                      <Input
                        value={beneficiarioForm.rfc}
                        onChange={(event) => actualizarBeneficiarioForm("rfc", event.target.value.toUpperCase())}
                      />
                    </div>
                    {beneficiarioForm.tipo === "persona_fisica" ? (
                      <div className="space-y-2">
                        <Label>CURP</Label>
                        <Input
                          value={beneficiarioForm.curp}
                          onChange={(event) => actualizarBeneficiarioForm("curp", event.target.value.toUpperCase())}
                        />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label>País o nacionalidad</Label>
                      <Select
                        value={beneficiarioForm.pais}
                        onValueChange={(value) => actualizarBeneficiarioForm("pais", value)}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Selecciona país" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAISES.map((pais) => (
                            <SelectItem key={pais.code} value={pais.code}>{pais.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {!beneficiarioCompleto ? (
                    <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {beneficiarioSatMissingFields.length > 0
                        ? `Completa los datos obligatorios del formato SAT: ${beneficiarioSatMissingFields
                            .map((field) => field.label)
                            .join(", ")}.`
                        : "Captura el nombre o razón social y al menos un identificador antes de confirmar."}
                    </p>
                  ) : null}
                </div>

                {satAllFieldsActual.some((field) => field.sectionKind === "beneficiario_controlador") ? (
                  <SatDynamicOperationFormView
                    form={satDynamicFormActual}
                    values={satEffectiveFieldValues}
                    missingRequired={satMissingRequiredFields}
                    onChange={actualizarSatField}
                    editedFieldIds={Object.keys(satFieldValues)}
                    infoHintContent={ACTOS_INFO_HINTS.xlsmSat}
                    sectionKinds={["beneficiario_controlador"]}
                  />
                ) : null}

              </CardContent>
            </Card>
          )}

          {pasoActual === 4 && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-slate-600" /> Paso 5. Operación, forma de pago y umbral
                </CardTitle>
                <CardDescription>
                  Revisa el cálculo con ventana de acumulación SAT de hasta seis meses antes de guardar.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="rounded border bg-white p-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Monto actual</p>
                  <p className="mt-2 text-xl font-semibold text-slate-800">
                    {montoOperacionParseado.ok
                      ? formatMoneyFromCents(montoOperacionParseado.cents, {
                          currency: moneda === "OTRA" ? monedaPersonalizadaCodigo || "MXN" : moneda,
                        })
                      : "$0.00"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{tipoOperacion || "Tipo de operación pendiente"}</p>
                </div>
                <div className="rounded border bg-white p-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Acumulación RCG Art. 19</p>
                  <p className="mt-2 text-xl font-semibold text-slate-800">
                    {evaluacionActual ? formatCurrency(evaluacionActual.acumulado) : "$0.00"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {evaluacionActual?.acumulacionAplica
                      ? `${evaluacionActual.operacionesConsideradas} operación(es) consideradas en seis meses.`
                      : "No acumula seis meses bajo RCG Art. 19; evaluar aviso directo o registro interno."}
                  </p>
                  {evaluacionActual?.acumulacionAdvertencia && (
                    <p className="mt-2 text-xs text-amber-700">{evaluacionActual.acumulacionAdvertencia}</p>
                  )}
                </div>
                <div className="rounded border bg-white p-4 text-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Salida regulatoria</p>
                  <p className="mt-2 text-xl font-semibold text-slate-800">
                    {evaluacionActual ? formatSalidaTipo(evaluacionActual.salida.tipo) : "Sin evaluación"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {evaluacionActual?.salida.fechaLimite
                      ? `Fecha límite: ${formatDateDisplay(evaluacionActual.salida.fechaLimite)}`
                      : evaluacionActual?.salida.descripcion ?? "Sin fecha de aviso ordinario."}
                  </p>
                </div>
                {revisionPagoRecurrente.requiresReview && (
                  <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 md:col-span-3">
                    <p className="font-semibold">Posible falso positivo operativo</p>
                    <p className="mt-1 text-xs leading-relaxed">
                      {revisionPagoRecurrente.message} Documenta contrato, meses cubiertos y soporte de pago antes de cerrar.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {pasoActual === 7 && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 text-slate-600" /> Paso 8. Salida SAT, XML y trazabilidad
                </CardTitle>
                <CardDescription>
                  Confirma el resultado de la evaluación, genera avisos preliminares y exporta XML para revisión interna.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded border bg-white p-4 text-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Salida sugerida</p>
                    <p className="mt-2 font-semibold text-slate-800">
                      {operationalCasePreview?.satOutputStatus.label ?? evaluacionActual?.salida.label ?? "Pendiente"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {operationalCasePreview?.satOutputStatus.fechaLimite
                        ? `Límite ${formatDateDisplay(operationalCasePreview.satOutputStatus.fechaLimite)}`
                        : "Sin fecha ordinaria calculada."}
                    </p>
                  </div>
                  <div className="rounded border bg-white p-4 text-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Formato SAT</p>
                    <p className="mt-2 font-semibold text-slate-800">
                      {satTemplateActual?.officialXlsmName ?? satFormatoActual?.plantillaAvisoNombre ?? satFormatoActual?.nombre ?? "Pendiente"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {satFormatoActual?.fraccion} · {satWorkbookStatusActual === "listo" ? "Excel listo" : `${satMissingRequiredFields.length} campo(s) SAT pendiente(s)`}
                    </p>
                  </div>
                  <div className="rounded border bg-white p-4 text-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Evidencia</p>
                    <p className="mt-2 font-semibold text-slate-800">
                      {evidenceDecisionActual.canClose ? "Lista para cierre" : "Pendiente de cierre"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {evidenceDecisionActual.missingCritical.length} crítico(s) · {evidenceDecisionActual.missingOptional.length} opcional(es)
                    </p>
                  </div>
                  <div className="rounded border bg-white p-4 text-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Riesgo residual</p>
                    <p className="mt-2 font-semibold text-slate-800">{ebrMetodologiaActual.residual.level}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ebrMetodologiaActual.actionPlan[0]?.priority}
                    </p>
                  </div>
                </div>

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
                        {montoOperacionParseado.ok
                          ? formatMoneyFromCents(montoOperacionParseado.cents, {
                              currency:
                                moneda === "OTRA"
                                  ? monedaPersonalizadaCodigo.trim().toUpperCase() || "MXN"
                                  : moneda,
                            })
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
                        {operacionEditandoId ? "Guardar cambios" : "Guardar operación y semáforo"}
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
                  {operacionEditandoId ? "Guardar cambios" : "Guardar caso operativo PLD"}
                </Button>
              )}
            </div>
          </div>
            </div>

          </div>
        </TabsContent>

        <TabsContent value="seguimiento" className="space-y-8">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-0 xl:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="border-b border-slate-100 p-5 xl:border-b-0 xl:border-r">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Semáforo</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-950">Operaciones</h2>
                  </div>
                  <div className="shrink-0 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-right text-emerald-800">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                      Total
                    </span>
                    <span className="block text-xl font-semibold leading-none">
                      {seguimientoMonitoringView.totalOperations}
                    </span>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <button
                    type="button"
                    onClick={() => setSeguimientoFiltro("todos")}
                    className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left transition ${getMonitoringLaneClass("todos", seguimientoFiltro === "todos")}`}
                  >
                    <span className="text-sm font-semibold">Todos</span>
                    <span className="text-lg font-semibold">{operacionesActivas.length}</span>
                  </button>
                  {seguimientoMonitoringView.lanes.map((lane) => (
                    <button
                      key={lane.status}
                      type="button"
                      onClick={() => setSeguimientoFiltro(lane.status)}
                      className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${getMonitoringLaneClass(lane.status, seguimientoFiltro === lane.status)}`}
                    >
                      <span className={`h-9 w-1.5 rounded-full ${lane.status === "aviso" ? "bg-rose-500" : lane.status === "identificacion" ? "bg-amber-500" : "bg-emerald-500"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{lane.label}</span>
                        <span className="block truncate text-xs opacity-75">{lane.primaryAction}</span>
                      </span>
                      <span className="text-lg font-semibold">{lane.count}</span>
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-amber-50 px-3 py-2 text-amber-800">
                    <span className="block font-semibold">{seguimientoMonitoringView.activeAlerts}</span>
                    <span>Alertas</span>
                  </div>
                  <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-800">
                    <span className="block font-semibold">{seguimientoMonitoringView.resolvedAlerts}</span>
                    <span>Atendidas</span>
                  </div>
                </div>
              </aside>

              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prioridad actual</p>
                    <p className="truncate text-sm text-slate-600">
                      {seguimientoFiltro === "todos" ? "Todos los casos" : getStatusLabel(seguimientoFiltro)}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setTabActiva("captura")}>
                    <Plus className="mr-1 h-4 w-4" /> Nueva
                  </Button>
                </div>

                {operacionesSeguimiento.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <ListChecks className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-slate-700">Sin casos en este filtro</p>
                    <p className="mt-1 text-xs text-slate-500">Cambia de semáforo o registra una operación.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {operacionesSeguimiento.map((operacion) => (
                      <article
                        key={operacion.id}
                        className="group grid gap-3 px-5 py-4 transition hover:bg-slate-50 lg:grid-cols-[minmax(0,1fr)_auto]"
                      >
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className={`h-10 w-1.5 shrink-0 rounded-full ${operacion.umbralStatus === "aviso" ? "bg-rose-500" : operacion.umbralStatus === "identificacion" ? "bg-amber-500" : "bg-emerald-500"}`} />
                            <div className="min-w-0">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <h3 className="truncate text-base font-semibold text-slate-950">{operacion.cliente}</h3>
                                <Badge variant="outline" className={getMonitoringStatusBadge(operacion.umbralStatus)}>
                                  {getStatusLabel(operacion.umbralStatus)}
                                </Badge>
                                <Badge variant="outline" className="bg-white text-slate-600">
                                  {operacion.periodo}
                                </Badge>
                              </div>
                              <p className="mt-1 truncate text-xs text-slate-500">
                                {operacion.rfc} · {formatSalidaTipo(operacion.avisoSalidaTipo ?? "sin_salida")} · {formatMontoOperacion(operacion)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 pl-4 sm:pl-6">
                            <Badge variant="outline" className={operacion.evidenciaCanClose ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                              Evidencia {operacion.evidenciaCanClose ? "lista" : `${operacion.evidenciaFaltantesCriticos ?? 0}`}
                            </Badge>
                            <Badge variant="outline" className="bg-slate-50 text-slate-700">
                              {operacion.acumulacionAplica ? "6 meses" : "No acumula"}
                            </Badge>
                            <Badge variant="outline" className="bg-white text-slate-600">
                              {operacion.actividadNombre.replace(/^Fracción\s+/i, "F. ")}
                            </Badge>
                          </div>

                          {operacion.alerta && (
                            <details className="mt-3 pl-4 text-xs text-slate-600 sm:pl-6">
                              <summary className="cursor-pointer font-medium text-amber-700">Ver alerta</summary>
                              <p className="mt-2 break-words rounded-xl bg-amber-50 px-3 py-2 text-amber-900">
                                {operacion.alerta}
                              </p>
                            </details>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pl-4 sm:pl-6 lg:justify-end lg:pl-0">
                          <Button size="sm" onClick={() => reutilizarDatosCliente(operacion)}>
                            Reusar
                          </Button>
                          {operacion.umbralStatus === "aviso" && !operacion.avisoPresentado && (
                            <Button size="sm" variant="outline" onClick={() => marcarAvisoPresentado(operacion.id)}>
                              Presentado
                            </Button>
                          )}
                          {hasRealSatOutput(operacion) ? (
                            <Button size="icon" variant="outline" onClick={() => exportarXml(operacion)} title="Descargar XML" aria-label="Descargar XML">
                              <Download className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button size="icon" variant="outline" onClick={() => abrirDocumentosOperacion(operacion)} title="Evidencias" aria-label="Evidencias">
                            <Paperclip className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => abrirEdicionOperacion(operacion)}>
                            Editar
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            onClick={() => solicitarEliminarOperacion(operacion)}
                            aria-label={operacion.submission?.wasEverPresented || operacion.avisoPresentado ? "Cancelar operación" : "Eliminar operación"}
                            title={operacion.submission?.wasEverPresented || operacion.avisoPresentado ? "Cancelar operación" : "Eliminar operación"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="border-b border-slate-100 p-5 lg:border-b-0 lg:border-r">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alertas</p>
                <div className="mt-3 flex items-end gap-3">
                  <span className="text-4xl font-semibold tracking-tight text-amber-700">{alertasActivas.length}</span>
                  <span className="pb-1 text-sm text-slate-500">activas</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all"
                    style={{
                      width: `${Math.min(100, Math.round((alertasActivas.length / Math.max(1, alertasActivas.length + alertasResueltas.length)) * 100))}%`,
                    }}
                  />
                </div>
                <p className="mt-3 text-xs text-slate-500">{alertasResueltas.length} gestionada(s)</p>
              </div>

              <div className="min-w-0">
                {alertasActivas.length === 0 ? (
                  <div className="flex items-center gap-3 px-5 py-8 text-sm text-slate-500">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    Sin alertas pendientes.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {alertasActivas.map((operacion) => (
                      <article key={operacion.id} className="grid gap-3 px-5 py-4 transition hover:bg-amber-50/30 md:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                              <AlertCircle className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-semibold text-slate-950">{operacion.cliente}</h3>
                              <p className="truncate text-xs text-slate-500">{operacion.rfc} · {formatMontoOperacion(operacion)}</p>
                            </div>
                          </div>
                          {operacion.alerta && (
                            <details className="mt-3 text-xs text-slate-600">
                              <summary className="cursor-pointer font-medium text-amber-700">Ver detalle</summary>
                              <p className="mt-2 break-words rounded-xl bg-amber-50 px-3 py-2 text-amber-900">
                                {operacion.alerta}
                              </p>
                            </details>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 md:justify-end">
                          <Button size="sm" onClick={() => reutilizarDatosCliente(operacion)}>Reusar</Button>
                          <Button size="sm" variant="outline" onClick={() => actualizarEstadoAlerta(operacion.id, true)}>
                            Atendida
                          </Button>
                          <Button size="icon" variant="outline" onClick={() => abrirDocumentosOperacion(operacion)} title="Evidencias" aria-label="Evidencias">
                            <Paperclip className="h-4 w-4" />
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                {alertasResueltas.length > 0 && (
                  <div className="border-t border-slate-100 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recientes</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {alertasResueltas.slice(0, 5).map((operacion) => (
                        <button
                          key={operacion.id}
                          type="button"
                          onClick={() => actualizarEstadoAlerta(operacion.id, false)}
                          className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 transition hover:bg-emerald-100"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{operacion.cliente}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

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
                      {WEEK_DAYS.map((dia, index) => (
                        <span key={`${dia}-${index}`}>{dia}</span>
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
                        {salidaOperacionDocumentos && (
                          <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-700">
                            {formatSalidaTipo(salidaOperacionDocumentos.tipo)}
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
                        <div className="rounded border border-slate-200 bg-slate-50 p-2">
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">Regla de acumulación</p>
                          <p className="mt-1 font-medium text-slate-700">
                            {operacionDocumentos.acumulacionAplica ? "Acumula seis meses" : "No acumula seis meses"}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {operacionDocumentos.acumulacionRazon ?? "Criterio RCG Art. 19 pendiente de calcular."}
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
                        {evaluacionEvidenciaOperacion && (
                          <p
                            className={
                              evaluacionEvidenciaOperacion.canClose
                                ? "text-emerald-700"
                                : "text-amber-700"
                            }
                          >
                            {evaluacionEvidenciaOperacion.canClose
                              ? "Listo para cierre interno."
                              : `${evaluacionEvidenciaOperacion.missingCritical.length} evidencia(s) crítica(s) pendientes bloquean cierre.`}
                          </p>
                        )}
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
                            {checklistEntriesOperacion.map(([requisito, completado]) => {
                              const metadata = requisitosOperacionPorLabel[requisito]
                              return (
                              <label
                                key={requisito}
                                className="flex items-start gap-2 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"
                              >
                                <Checkbox
                                  checked={completado}
                                  onCheckedChange={() => alternarRequisitoChecklist(operacionDocumentos.id, requisito)}
                                  className="mt-0.5"
                                />
                                <span className="space-y-1">
                                  <span className="block font-medium text-slate-700">
                                    {requisito}
                                    {metadata?.critical ? " *" : ""}
                                  </span>
                                  {metadata?.source && (
                                    <span className="block text-[11px] text-muted-foreground">{metadata.source}</span>
                                  )}
                                </span>
                              </label>
                            )})}
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
                              size="sm"
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
        open={Boolean(operacionParaEliminar)}
        onOpenChange={(open) => {
          if (!open) {
            setOperacionParaEliminar(null)
            setMotivoCancelacion("")
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {operacionParaEliminar?.submission?.wasEverPresented || operacionParaEliminar?.avisoPresentado
                ? "Cancelar operación presentada"
                : "Eliminar operación"}
            </DialogTitle>
            <DialogDescription>
              {operacionParaEliminar?.submission?.wasEverPresented || operacionParaEliminar?.avisoPresentado
                ? "La operación se archivará y conservará su historial, folio y paquete SAT para trazabilidad."
                : "Se eliminará el borrador y su paquete SAT vinculado. Esta acción no elimina el cliente reutilizable."}
            </DialogDescription>
          </DialogHeader>
          {operacionParaEliminar?.submission?.wasEverPresented || operacionParaEliminar?.avisoPresentado ? (
            <div className="space-y-2">
              <Label htmlFor="motivo-cancelacion">Motivo de cancelación *</Label>
              <Textarea
                id="motivo-cancelacion"
                value={motivoCancelacion}
                onChange={(event) => setMotivoCancelacion(event.target.value)}
                placeholder="Describe el motivo y la evidencia relacionada."
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOperacionParaEliminar(null)
                setMotivoCancelacion("")
              }}
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmarEliminarOCancelarOperacion}
            >
              {operacionParaEliminar?.submission?.wasEverPresented || operacionParaEliminar?.avisoPresentado
                ? "Cancelar y conservar trazabilidad"
                : "Eliminar operación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
