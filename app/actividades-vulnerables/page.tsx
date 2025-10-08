"use client"

import { useEffect, useMemo, useState } from "react"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  Info,
  LayoutDashboard,
  ListChecks,
  Plus,
  ShieldAlert,
  Users,
} from "lucide-react"

import { actividadesVulnerables } from "@/lib/data/actividades"
import {
  UMA_PERIODS,
  findUmaByMonthYear,
  listAvailableYears,
  listMonthsForYear,
  listUmaByYear,
} from "@/lib/data/uma"

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

const CLIENTE_TIPOS = [
  { value: "pfn", label: "Persona física mexicana" },
  { value: "pfe", label: "Persona física extranjera" },
  { value: "pmn", label: "Persona moral mexicana" },
  { value: "pme", label: "Persona moral extranjera" },
  { value: "fideicomiso", label: "Fideicomiso" },
  { value: "dependencia", label: "Dependencia o entidad pública" },
  { value: "vehiculo", label: "Vehículo corporativo" },
  { value: "otro", label: "Otro sujeto obligado" },
]

const CRITERIO_OPCIONES = [
  { value: "importe", label: "Por importe individual" },
  { value: "acumulado", label: "Por acumulado mensual" },
]

const MONEDA_OPCIONES = [
  { value: "MXN", label: "Peso mexicano (MXN)" },
  { value: "USD", label: "Dólar estadounidense (USD)" },
  { value: "EUR", label: "Euro (EUR)" },
  { value: "Otro", label: "Otra divisa" },
]

const STEPS = [
  {
    key: "actividad",
    titulo: "Actividad vulnerable",
    descripcion: "Selecciona la fracción aplicable y consulta las UMA oficiales por año.",
  },
  {
    key: "cliente",
    titulo: "Perfil del cliente",
    descripcion: "Identifica tipo de cliente, pertenencia a grupo empresarial y datos clave.",
  },
  {
    key: "operacion",
    titulo: "Datos de la operación",
    descripcion: "Registra montos, medio de pago, origen y destino de recursos.",
  },
  {
    key: "obligaciones",
    titulo: "Resultados y obligaciones",
    descripcion: "Consulta el semáforo de umbrales, obligaciones UIF y genera controles.",
  },
] as const

type UmbralStatus = "sin-obligacion" | "identificacion" | "aviso"

type CriterioEvaluacion = "importe" | "acumulado"

interface OperacionCliente {
  id: string
  actividadKey: string
  actividadNombre: string
  fraccion: string
  tipoCliente: string
  cliente: string
  rfc: string
  mismoGrupo: boolean
  periodo: string
  mes: number
  anio: number
  monto: number
  moneda: string
  criterioEvaluacion: CriterioEvaluacion
  fechaOperacion: string
  tipoOperacion: string
  medioPago: string
  actividadEconomica: string
  zonaGeografica: string
  frecuenciaOperaciones: string
  origenRecursos: string
  destinoRecursos: string
  comportamientoInusual: string
  pep: boolean
  evidencia: string
  umaMensual: number
  identificacionUmbralPesos: number
  avisoUmbralPesos: number
  umbralStatus: UmbralStatus
  acumuladoCliente: number
  alerta: string | null
  avisoPresentado: boolean
}

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1

const AVAILABLE_YEARS = listAvailableYears()
const DEFAULT_YEAR = AVAILABLE_YEARS.includes(currentYear)
  ? currentYear
  : AVAILABLE_YEARS[AVAILABLE_YEARS.length - 1] ?? currentYear
const MONTHS_FOR_DEFAULT = listMonthsForYear(DEFAULT_YEAR)
const DEFAULT_MONTH = MONTHS_FOR_DEFAULT.includes(currentMonth)
  ? currentMonth
  : MONTHS_FOR_DEFAULT[MONTHS_FOR_DEFAULT.length - 1] ?? MONTHS_FOR_DEFAULT[0] ?? currentMonth

function formatCurrency(value: number) {
  return value.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  })
}

function monthLabel(month: number) {
  return MONTHS[month - 1] ?? ""
}

function buildPeriodo(year: number, month: number) {
  return `${year}${month.toString().padStart(2, "0")}`
}

function getStatusLabel(status: UmbralStatus) {
  if (status === "aviso") return "Umbral de aviso"
  if (status === "identificacion") return "Umbral de identificación"
  return "Sin obligación"
}

function getStatusColor(status: UmbralStatus) {
  if (status === "aviso") return "bg-red-500"
  if (status === "identificacion") return "bg-amber-500"
  return "bg-emerald-500"
}

function getStatusDescription(status: UmbralStatus) {
  if (status === "aviso") {
    return "Se debe presentar aviso ante el SAT dentro de los 17 días siguientes y reiniciar el conteo de operaciones."
  }
  if (status === "identificacion") {
    return "Se activa la obligación de identificación: integrar expediente, validar documentos y acumular operaciones por 6 meses."
  }
  return "Mantén el monitoreo mensual. Mientras no se rebasa el umbral de identificación no hay obligaciones adicionales."
}

function sanitizeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export default function ActividadesVulnerablesPage() {
  const { toast } = useToast()
  const [view, setView] = useState<"dashboard" | "wizard">("dashboard")
  const [stepIndex, setStepIndex] = useState(0)
  const [actividadKey, setActividadKey] = useState<string>(actividadesVulnerables[0]?.key ?? "")
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(DEFAULT_YEAR)
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(DEFAULT_MONTH)
  const [tipoCliente, setTipoCliente] = useState<string>(CLIENTE_TIPOS[0]?.value ?? "")
  const [mismoGrupo, setMismoGrupo] = useState<string>("no")
  const [clienteNombre, setClienteNombre] = useState("")
  const [rfc, setRfc] = useState("")
  const [moneda, setMoneda] = useState<string>(MONEDA_OPCIONES[0]?.value ?? "MXN")
  const [criterioEvaluacion, setCriterioEvaluacion] = useState<CriterioEvaluacion>("importe")
  const [tipoOperacion, setTipoOperacion] = useState("")
  const [medioPago, setMedioPago] = useState("")
  const [fechaOperacion, setFechaOperacion] = useState(new Date().toISOString().substring(0, 10))
  const [montoOperacion, setMontoOperacion] = useState("")
  const [actividadEconomica, setActividadEconomica] = useState("")
  const [zonaGeografica, setZonaGeografica] = useState("")
  const [frecuenciaOperaciones, setFrecuenciaOperaciones] = useState("")
  const [origenRecursos, setOrigenRecursos] = useState("")
  const [destinoRecursos, setDestinoRecursos] = useState("")
  const [comportamientoInusual, setComportamientoInusual] = useState("")
  const [esPep, setEsPep] = useState<string>("no")
  const [evidencia, setEvidencia] = useState("")
  const [operaciones, setOperaciones] = useState<OperacionCliente[]>([])
  const [avisoPreliminar, setAvisoPreliminar] = useState<OperacionCliente | null>(null)
  const [grupoDialogOpen, setGrupoDialogOpen] = useState(false)

  const actividadSeleccionada = useMemo(
    () => actividadesVulnerables.find((actividad) => actividad.key === actividadKey),
    [actividadKey],
  )

  const mesesDisponibles = useMemo(() => listMonthsForYear(anioSeleccionado), [anioSeleccionado])

  useEffect(() => {
    if (mesesDisponibles.length === 0) return
    if (!mesesDisponibles.includes(mesSeleccionado)) {
      setMesSeleccionado(mesesDisponibles[mesesDisponibles.length - 1])
    }
  }, [mesSeleccionado, mesesDisponibles])

  const umaSeleccionada = useMemo(
    () => findUmaByMonthYear(mesSeleccionado, anioSeleccionado),
    [mesSeleccionado, anioSeleccionado],
  )

  const periodoSeleccionado = useMemo(
    () => buildPeriodo(anioSeleccionado, mesSeleccionado),
    [anioSeleccionado, mesSeleccionado],
  )

  const umbralPesos = useMemo(() => {
    if (!umaSeleccionada || !actividadSeleccionada) return null
    const mensual = umaSeleccionada.monthly
    return {
      identificacion: actividadSeleccionada.identificacionUmbralUma * mensual,
      aviso: actividadSeleccionada.avisoUmbralUma * mensual,
    }
  }, [umaSeleccionada, actividadSeleccionada])

  const umaPorAnio = useMemo(() => listUmaByYear(anioSeleccionado), [anioSeleccionado])

  const rfcNormalizado = rfc.trim().toUpperCase()
  const montoOperacionNumber = Number(montoOperacion.replace(/,/g, ""))
  const montoValido = !Number.isNaN(montoOperacionNumber) && montoOperacionNumber > 0

  const operacionesComparables = useMemo(() => {
    if (!actividadSeleccionada || !rfcNormalizado) return []
    return operaciones.filter(
      (operacion) =>
        operacion.actividadKey === actividadSeleccionada.key &&
        operacion.periodo === periodoSeleccionado &&
        operacion.rfc === rfcNormalizado &&
        !operacion.avisoPresentado,
    )
  }, [actividadSeleccionada, operaciones, periodoSeleccionado, rfcNormalizado])

  const acumuladoPrevio = useMemo(
    () => operacionesComparables.reduce((acc, operacion) => acc + operacion.monto, 0),
    [operacionesComparables],
  )

  const valorReferencia = useMemo(() => {
    if (!montoValido) return 0
    if (criterioEvaluacion === "acumulado") {
      return acumuladoPrevio + montoOperacionNumber
    }
    return montoOperacionNumber
  }, [criterioEvaluacion, acumuladoPrevio, montoOperacionNumber, montoValido])

  const statusSimulado: UmbralStatus = useMemo(() => {
    if (!umbralPesos || !montoValido) return "sin-obligacion"
    if (valorReferencia >= umbralPesos.aviso) return "aviso"
    if (valorReferencia >= umbralPesos.identificacion) return "identificacion"
    return "sin-obligacion"
  }, [montoValido, umbralPesos, valorReferencia])

  const resumenUmbrales = useMemo(() => {
    return operaciones.reduce(
      (acc, operacion) => {
        acc[operacion.umbralStatus] = (acc[operacion.umbralStatus] ?? 0) + 1
        return acc
      },
      {
        "sin-obligacion": 0,
        identificacion: 0,
        aviso: 0,
      } as Record<UmbralStatus, number>,
    )
  }, [operaciones])

  const operacionesAgrupadas = useMemo(() => {
    return operaciones.reduce(
      (acc, operacion) => {
        const lista = acc[operacion.umbralStatus] ?? []
        lista.push(operacion)
        acc[operacion.umbralStatus] = lista
        return acc
      },
      {
        "sin-obligacion": [] as OperacionCliente[],
        identificacion: [] as OperacionCliente[],
        aviso: [] as OperacionCliente[],
      },
    )
  }, [operaciones])

  const operacionesPorFraccion = useMemo(() => {
    const mapa = new Map<string, OperacionCliente[]>()
    operaciones.forEach((operacion) => {
      const existentes = mapa.get(operacion.fraccion) ?? []
      existentes.push(operacion)
      mapa.set(operacion.fraccion, existentes)
    })
    return mapa
  }, [operaciones])

  const documentoRequerido = useMemo(() => {
    if (!actividadSeleccionada) return []
    const clienteKey = (() => {
      switch (tipoCliente) {
        case "pfn":
          return "personaFisica"
        case "pfe":
          return "personaExtranjera"
        case "pmn":
        case "pme":
          return "personaMoral"
        case "fideicomiso":
          return "fideicomiso"
        case "vehiculo":
          return "vehiculo"
        case "dependencia":
          return "autoridad"
        default:
          return "otro"
      }
    })()
    // @ts-expect-error acceso controlado a la propiedad
    return actividadSeleccionada.clienteObligaciones[clienteKey] ?? []
  }, [actividadSeleccionada, tipoCliente])

  const obligacionesTexto = actividadSeleccionada?.obligaciones ?? null

  const handleNextStep = () => {
    if (stepIndex === STEPS.length - 1) return

    if (stepIndex === 0) {
      if (!actividadSeleccionada || !umaSeleccionada) {
        toast({
          title: "Selecciona la actividad",
          description: "Elige una actividad vulnerable y un mes disponible dentro de los 60 meses oficiales.",
          variant: "destructive",
        })
        return
      }
    }

    if (stepIndex === 1) {
      if (!clienteNombre.trim() || !rfcNormalizado) {
        toast({
          title: "Datos del cliente incompletos",
          description: "Captura nombre o razón social y RFC para continuar.",
          variant: "destructive",
        })
        return
      }
    }

    if (stepIndex === 2) {
      if (!montoValido || !tipoOperacion.trim() || !medioPago.trim()) {
        toast({
          title: "Información de la operación",
          description: "Ingresa monto, naturaleza de la operación y medio de pago.",
          variant: "destructive",
        })
        return
      }
      if (!actividadEconomica.trim() || !zonaGeografica.trim()) {
        toast({
          title: "Completa el contexto",
          description: "Describe la actividad del cliente y la zona geográfica donde opera.",
          variant: "destructive",
        })
        return
      }
    }

    setStepIndex((prev) => prev + 1)
  }

  const handlePrevStep = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0))
  }

  const agregarOperacion = () => {
    if (!actividadSeleccionada || !umaSeleccionada || !umbralPesos) {
      toast({
        title: "Información incompleta",
        description: "Selecciona actividad, periodo y asegúrate de contar con UMA vigente.",
        variant: "destructive",
      })
      return
    }

    if (!montoValido) {
      toast({
        title: "Monto inválido",
        description: "El monto debe ser numérico y mayor a cero.",
        variant: "destructive",
      })
      return
    }

    const operacionesPrevias = operaciones.filter(
      (operacion) =>
        operacion.actividadKey === actividadSeleccionada.key &&
        operacion.periodo === periodoSeleccionado &&
        operacion.rfc === rfcNormalizado &&
        !operacion.avisoPresentado,
    )

    const acumuladoPrevioCliente = operacionesPrevias.reduce((acc, operacion) => acc + operacion.monto, 0)
    const comparativo = criterioEvaluacion === "acumulado" ? acumuladoPrevioCliente + montoOperacionNumber : montoOperacionNumber

    let status: UmbralStatus = "sin-obligacion"
    let alerta: string | null = "Sin obligaciones activas. Mantén el monitoreo del calendario mensual."

    if (comparativo >= umbralPesos.aviso) {
      status = "aviso"
      alerta =
        "Supera el umbral de aviso. Presenta aviso dentro de 17 días y reinicia la acumulación." +
        (mismoGrupo === "si"
          ? " El cliente pertenece al mismo grupo empresarial: prepara informe 27 Bis en ceros."
          : "")
    } else if (comparativo >= umbralPesos.identificacion) {
      status = "identificacion"
      alerta = "Supera el umbral de identificación. Integra expediente completo y monitorea el acumulado por 6 meses."
    }

    const nuevaOperacion: OperacionCliente = {
      id: crypto.randomUUID(),
      actividadKey: actividadSeleccionada.key,
      actividadNombre: actividadSeleccionada.nombre,
      fraccion: actividadSeleccionada.fraccion,
      tipoCliente,
      cliente: clienteNombre.trim(),
      rfc: rfcNormalizado,
      mismoGrupo: mismoGrupo === "si",
      periodo: periodoSeleccionado,
      mes: mesSeleccionado,
      anio: anioSeleccionado,
      monto: montoOperacionNumber,
      moneda,
      criterioEvaluacion,
      fechaOperacion,
      tipoOperacion,
      medioPago,
      actividadEconomica,
      zonaGeografica,
      frecuenciaOperaciones,
      origenRecursos,
      destinoRecursos,
      comportamientoInusual,
      pep: esPep === "si",
      evidencia,
      umaMensual: umaSeleccionada.monthly,
      identificacionUmbralPesos: umbralPesos.identificacion,
      avisoUmbralPesos: umbralPesos.aviso,
      umbralStatus: status,
      acumuladoCliente: criterioEvaluacion === "acumulado" ? comparativo : montoOperacionNumber,
      alerta,
      avisoPresentado: false,
    }

    setOperaciones((prev) => [...prev, nuevaOperacion])
    toast({ title: getStatusLabel(status), description: alerta ?? "Operación registrada." })

    setView("dashboard")
    setStepIndex(0)
    setMontoOperacion("")
    setEvidencia("")
    setTipoOperacion("")
    setMedioPago("")
    setFrecuenciaOperaciones("")
    setOrigenRecursos("")
    setDestinoRecursos("")
    setComportamientoInusual("")
  }

  const marcarAvisoPresentado = (id: string) => {
    setOperaciones((prev) =>
      prev.map((operacion) =>
        operacion.id === id
          ? {
              ...operacion,
              avisoPresentado: true,
              alerta: "Aviso presentado ante el SAT. Reinicia el conteo de acumulación desde esta fecha.",
            }
          : operacion,
      ),
    )
  }

  const generarAvisoPreliminar = (operacion: OperacionCliente) => {
    setAvisoPreliminar(operacion)
  }

  const exportarXml = (operacion: OperacionCliente) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<avisoPLD>\n  <periodo>${operacion.periodo}</periodo>\n  <claveActividad>${sanitizeXml(
      operacion.actividadKey,
    ).toUpperCase()}</claveActividad>\n  <fraccion>${sanitizeXml(operacion.fraccion)}</fraccion>\n  <actividad>${sanitizeXml(
      operacion.actividadNombre,
    )}</actividad>\n  <criterio>${operacion.criterioEvaluacion}</criterio>\n  <umaMensual>${operacion.umaMensual.toFixed(2)}</umaMensual>\n  <umbralIdentificacion>${operacion.identificacionUmbralPesos.toFixed(
      2,
    )}</umbralIdentificacion>\n  <umbralAviso>${operacion.avisoUmbralPesos.toFixed(2)}</umbralAviso>\n  <cliente>\n    <nombre>${sanitizeXml(operacion.cliente)}</nombre>\n    <tipo>${sanitizeXml(operacion.tipoCliente)}</tipo>\n    <rfc>${sanitizeXml(operacion.rfc)}</rfc>\n    <mismoGrupo>${operacion.mismoGrupo ? "SI" : "NO"}</mismoGrupo>\n    <pep>${operacion.pep ? "SI" : "NO"}</pep>\n  </cliente>\n  <operacion>\n    <fecha>${operacion.fechaOperacion}</fecha>\n    <monto moneda="${sanitizeXml(operacion.moneda)}">${operacion.monto.toFixed(2)}</monto>\n    <acumulado criterio="${operacion.criterioEvaluacion}">${operacion.acumuladoCliente.toFixed(
      2,
    )}</acumulado>\n    <tipo>${sanitizeXml(operacion.tipoOperacion)}</tipo>\n    <medioPago>${sanitizeXml(operacion.medioPago)}</medioPago>\n    <actividadCliente>${sanitizeXml(operacion.actividadEconomica)}</actividadCliente>\n    <zona>${sanitizeXml(operacion.zonaGeografica)}</zona>\n    <frecuencia>${sanitizeXml(operacion.frecuenciaOperaciones)}</frecuencia>\n    <origenRecursos>${sanitizeXml(operacion.origenRecursos)}</origenRecursos>\n    <destinoRecursos>${sanitizeXml(operacion.destinoRecursos)}</destinoRecursos>\n    <comportamiento>${sanitizeXml(operacion.comportamientoInusual)}</comportamiento>\n    <evidencia>${sanitizeXml(operacion.evidencia)}</evidencia>\n  </operacion>\n</avisoPLD>`

    const blob = new Blob([xml], { type: "application/xml" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `aviso-${operacion.periodo}-${operacion.rfc}.xml`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast({ title: "XML generado", description: "Se descargó el aviso preliminar para revisión." })
  }

  const generarInformeCeros = (operacion: OperacionCliente) => {
    const xml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<informe27Bis>\n  <periodo>${operacion.periodo}</periodo>\n  <sujetoObligado>${sanitizeXml(operacion.rfc)}</sujetoObligado>\n  <actividad>${sanitizeXml(
      operacion.actividadKey,
    ).toUpperCase()}</actividad>\n  <motivo>Cliente del mismo grupo empresarial sin aviso individual. Informe en ceros conforme al artículo 27 Bis.</motivo>\n</informe27Bis>`

    const blob = new Blob([xml], { type: "application/xml" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `informe-27bis-${operacion.periodo}-${operacion.rfc}.xml`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast({ title: "Informe 27 Bis", description: "Se generó el informe en ceros para el grupo empresarial." })
  }

  const irAGestion = () => {
    const section = document.getElementById("gestion-actividades")
    if (section) {
      section.scrollIntoView({ behavior: "smooth" })
    }
  }

  const pasoActual = STEPS[stepIndex]

  return (
    <div className="space-y-6">
      {view === "dashboard" ? (
        <>
          <header className="grid gap-4 lg:grid-cols-2">
            <Card className="border-emerald-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-700">
                  <ShieldAlert className="h-5 w-5" /> Identificación de Actividades Vulnerables y Umbrales SAT
                </CardTitle>
                <CardDescription>
                  Dashboard actualizado con UMAs oficiales mensuales (septiembre 2020 – agosto 2025) para controlar obligaciones
                  de identificación y aviso.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded border bg-emerald-50/70 p-4 text-sm text-emerald-900">
                  <p className="font-semibold">Registra nueva actividad</p>
                  <p className="mt-2">
                    Sigue un flujo guiado paso a paso para determinar umbrales, obligaciones y expedientes conforme a la Ley
                    antilavado.
                  </p>
                  <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700" onClick={() => setView("wizard")}>
                    <Plus className="mr-2 h-4 w-4" /> Nueva actividad vulnerable
                  </Button>
                </div>
                <div className="rounded border bg-white p-4 text-sm">
                  <p className="font-semibold text-slate-700">UMAs por ciclo</p>
                  <div className="mt-3 space-y-2">
                    {UMA_PERIODS.map((periodo) => (
                      <div
                        key={periodo.cycle}
                        className="flex items-center justify-between rounded border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-xs"
                      >
                        <span>
                          {periodo.cycle}: {new Date(periodo.validFrom).toLocaleDateString("es-MX", { month: "short", year: "numeric" })}
                          {" "}-
                          {new Date(periodo.validTo).toLocaleDateString("es-MX", { month: "short", year: "numeric" })}
                        </span>
                        <span className="font-semibold text-emerald-700">{formatCurrency(periodo.monthly)}</span>
                      </div>
                    ))}
                  </div>
                  <Alert className="mt-3 border-emerald-200 bg-emerald-50/80">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Referencia oficial mensual</AlertTitle>
                    <AlertDescription>
                      La UMA aplica del 1.º de febrero al 31 de enero del siguiente año. El historial disponible cubre 60 meses
                      continuos desde septiembre de 2020.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-700">
                  <LayoutDashboard className="h-5 w-5" /> Gestión de actividades registradas
                </CardTitle>
                <CardDescription>Consulta el semáforo de obligaciones y gestiona avisos o informes 27 Bis.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border bg-emerald-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase text-emerald-600">Sin obligación</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-700">{resumenUmbrales["sin-obligacion"]}</p>
                  <p className="text-xs text-muted-foreground">Operaciones por debajo de umbral.</p>
                </div>
                <div className="rounded-xl border bg-amber-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase text-amber-600">Identificación</p>
                  <p className="mt-2 text-2xl font-bold text-amber-700">{resumenUmbrales.identificacion}</p>
                  <p className="text-xs text-muted-foreground">Expediente obligatorio y seguimiento 6 meses.</p>
                </div>
                <div className="rounded-xl border bg-rose-50 p-4 text-center">
                  <p className="text-xs font-semibold uppercase text-rose-600">Aviso</p>
                  <p className="mt-2 text-2xl font-bold text-rose-700">{resumenUmbrales.aviso}</p>
                  <p className="text-xs text-muted-foreground">Aviso SAT en 17 días e informe 27 Bis si aplica.</p>
                </div>
              </CardContent>
              <CardContent>
                <Button variant="outline" onClick={irAGestion} className="w-full">
                  <ListChecks className="mr-2 h-4 w-4" /> Gestionar las actividades registradas
                </Button>
              </CardContent>
            </Card>
          </header>

          <section className="grid gap-6 lg:grid-cols-[2fr,1fr]" id="gestion-actividades">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-600" /> Operaciones segmentadas por obligación
                </CardTitle>
                <CardDescription>Clasificación automática por fracción, estatus de umbral y acumulación mensual.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-3">
                  {[
                    { key: "sin-obligacion" as UmbralStatus, titulo: "Sin obligación" },
                    { key: "identificacion" as UmbralStatus, titulo: "Umbral de identificación" },
                    { key: "aviso" as UmbralStatus, titulo: "Umbral de aviso" },
                  ].map((grupo) => (
                    <div key={grupo.key} className="rounded-lg border bg-white p-3">
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <span className={`inline-flex h-2 w-2 rounded-full ${getStatusColor(grupo.key)}`} />
                        {grupo.titulo}
                      </h4>
                      <div className="mt-2 space-y-2 text-xs">
                        {operacionesAgrupadas[grupo.key].length === 0 ? (
                          <p className="text-muted-foreground">Sin operaciones registradas.</p>
                        ) : (
                          <ScrollArea className="h-40 pr-3">
                            <ul className="space-y-2">
                              {operacionesAgrupadas[grupo.key].map((operacion) => (
                                <li key={operacion.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                                  <p className="font-semibold text-slate-700">{operacion.cliente}</p>
                                  <p className="text-muted-foreground">
                                    {operacion.fraccion} · {monthLabel(operacion.mes)} {operacion.anio}
                                  </p>
                                  <p className="font-medium">{formatCurrency(operacion.monto)}</p>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <Button size="xs" onClick={() => generarAvisoPreliminar(operacion)}>
                                      Previo aviso
                                    </Button>
                                    <Button size="xs" variant="outline" onClick={() => exportarXml(operacion)}>
                                      <Download className="mr-1 h-3 w-3" /> XML
                                    </Button>
                                    {operacion.umbralStatus === "aviso" && !operacion.avisoPresentado && (
                                      <Button size="xs" variant="secondary" onClick={() => marcarAvisoPresentado(operacion.id)}>
                                        Marcar aviso presentado
                                      </Button>
                                    )}
                                    {operacion.umbralStatus === "aviso" && operacion.mismoGrupo && (
                                      <Button size="xs" variant="outline" onClick={() => generarInformeCeros(operacion)}>
                                        Informe 27 Bis
                                      </Button>
                                    )}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </ScrollArea>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">Subdivisión por fracción</h4>
                  <div className="mt-3 space-y-3">
                    {Array.from(operacionesPorFraccion.entries()).map(([fraccion, lista]) => (
                      <div key={fraccion} className="rounded border border-slate-200 bg-white p-3 text-xs">
                        <p className="font-semibold text-slate-700">{fraccion}</p>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          {lista.map((operacion) => (
                            <div key={operacion.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                              <p className="font-semibold text-slate-700">{operacion.actividadNombre}</p>
                              <p className="text-muted-foreground">
                                {operacion.cliente} · {monthLabel(operacion.mes)} {operacion.anio}
                              </p>
                              <Badge className={`mt-2 ${getStatusColor(operacion.umbralStatus)} capitalize text-white`}>
                                {operacion.umbralStatus}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {operacionesPorFraccion.size === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Aún no se registran operaciones. Inicia un nuevo caso para visualizar el seguimiento por fracción.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-700">
                  <Users className="h-5 w-5 text-slate-500" /> Guía para registro SAT y responsables
                </CardTitle>
                <CardDescription>Checklist operativo para preparar avisos, informes y designación de responsables.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-700">
                <div className="rounded border bg-white p-3">
                  <h4 className="font-semibold text-slate-700">Datos del sujeto obligado</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                    <li>RFC y razón social inscritos en el padrón de actividades vulnerables.</li>
                    <li>Clave de actividad vulnerable conforme a catálogo SAT (incluye fracciones I a V Bis).</li>
                    <li>Nombre, correo y teléfono del responsable de cumplimiento y del suplente.</li>
                  </ul>
                </div>
                <div className="rounded border bg-white p-3">
                  <h4 className="font-semibold text-slate-700">Datos por operación</h4>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                    <li>Periodo con nomenclatura AAAAMM (ej. {buildPeriodo(currentYear, currentMonth)}).</li>
                    <li>Montos en MXN o divisa extranjera, especificando tipo de cambio aplicado.</li>
                    <li>Medio de pago (efectivo, transferencia, SPEI, cheque, etc.) y cuenta de origen/destino.</li>
                    <li>Documentos soporte: contratos, estados de cuenta, identificaciones y evidencia de beneficiario final.</li>
                  </ul>
                </div>
                <div className="rounded border bg-white p-3">
                  <h4 className="font-semibold text-slate-700">Alertas y acumulación</h4>
                  <p className="text-muted-foreground">
                    Si se rebasa el umbral de aviso y se presenta el reporte, la acumulación se reinicia. Cuando el cliente forma
                    parte del mismo grupo empresarial y no se presenta aviso individual, genera el informe 27 Bis en ceros.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      ) : (
        <>
          <Card className="border-emerald-200">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-emerald-700">
                    <Building2 className="h-5 w-5" /> Registro guiado de actividad vulnerable
                  </CardTitle>
                  <CardDescription>
                    Sigue los pasos para determinar umbrales en UMA mensual, obligaciones y generación de avisos.
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => setView("dashboard")}>Cerrar</Button>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                {STEPS.map((step, index) => {
                  const isActive = index === stepIndex
                  const isComplete = index < stepIndex
                  return (
                    <div
                      key={step.key}
                      className={`rounded-xl border p-3 text-sm ${
                        isActive
                          ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                          : isComplete
                          ? "border-emerald-200 bg-white text-emerald-700"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide">Paso {index + 1}</p>
                      <p className="mt-1 font-semibold">{step.titulo}</p>
                      <p className="text-xs text-muted-foreground">{step.descripcion}</p>
                    </div>
                  )
                })}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {pasoActual.key === "actividad" && (
                <div className="space-y-6">
                  <div className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Actividad vulnerable</Label>
                        <Select value={actividadKey} onValueChange={setActividadKey}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecciona fracción" />
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
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Año</Label>
                          <Select value={String(anioSeleccionado)} onValueChange={(value) => setAnioSeleccionado(Number(value))}>
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Selecciona año" />
                            </SelectTrigger>
                            <SelectContent>
                              {AVAILABLE_YEARS.map((year) => (
                                <SelectItem key={year} value={String(year)}>
                                  {year}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Mes</Label>
                          <Select value={String(mesSeleccionado)} onValueChange={(value) => setMesSeleccionado(Number(value))}>
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Selecciona mes" />
                            </SelectTrigger>
                            <SelectContent>
                              {mesesDisponibles.map((mes) => (
                                <SelectItem key={mes} value={String(mes)}>
                                  {monthLabel(mes)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="rounded border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900">
                        <p className="font-semibold">Histórico de UMA mensual – {anioSeleccionado}</p>
                        <div className="mt-3 grid gap-2 md:grid-cols-3">
                          {umaPorAnio.map((registro) => (
                            <button
                              key={`${anioSeleccionado}-${registro.month}`}
                              type="button"
                              onClick={() => setMesSeleccionado(registro.month)}
                              className={`rounded border px-3 py-2 text-left text-xs transition ${
                                registro.month === mesSeleccionado
                                  ? "border-emerald-500 bg-white shadow"
                                  : "border-emerald-200 bg-emerald-50"
                              }`}
                            >
                              <p className="font-semibold text-emerald-700">{monthLabel(registro.month)}</p>
                              <p>UMA mensual: {formatCurrency(registro.monthly)}</p>
                              <p className="text-[10px] text-emerald-800">Ciclo {registro.cycle}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-700">
                      <p className="font-semibold">Descripción de la fracción</p>
                      <p className="mt-2 text-muted-foreground">
                        {actividadSeleccionada?.descripcion ?? "Selecciona una actividad para visualizar la descripción."}
                      </p>
                      {umbralPesos && actividadSeleccionada && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Umbral de identificación: {actividadSeleccionada.identificacionUmbralUma.toLocaleString("es-MX")} UMA
                            ({formatCurrency(umbralPesos.identificacion)})
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Umbral de aviso: {actividadSeleccionada.avisoUmbralUma.toLocaleString("es-MX")} UMA
                            ({formatCurrency(umbralPesos.aviso)})
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <Alert className="border-emerald-200 bg-white text-emerald-900">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Calendario de UMA</AlertTitle>
                    <AlertDescription>
                      Las UMA son mensuales. Cada ciclo inicia los primeros 10 días de febrero y concluye el 31 de enero del año
                      siguiente. El módulo controla 60 meses continuos desde septiembre de 2020.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              {pasoActual.key === "cliente" && (
                <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Tipo de cliente</Label>
                        <Select value={tipoCliente} onValueChange={setTipoCliente}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecciona tipo de cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            {CLIENTE_TIPOS.map((cliente) => (
                              <SelectItem key={cliente.value} value={cliente.value}>
                                {cliente.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>¿Pertenece al mismo grupo empresarial?</Label>
                        <div className="flex items-center gap-2">
                          <Select value={mismoGrupo} onValueChange={setMismoGrupo}>
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Selecciona" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no">No</SelectItem>
                              <SelectItem value="si">Sí</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button size="icon" variant="outline" onClick={() => setGrupoDialogOpen(true)}>
                            <Info className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nombre o razón social</Label>
                        <Input value={clienteNombre} onChange={(event) => setClienteNombre(event.target.value)} placeholder="Cliente" />
                      </div>
                      <div className="space-y-2">
                        <Label>RFC</Label>
                        <Input
                          value={rfc}
                          onChange={(event) => setRfc(event.target.value.toUpperCase())}
                          placeholder="RFC"
                          maxLength={13}
                          className="uppercase"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Actividad económica del cliente</Label>
                        <Input
                          value={actividadEconomica}
                          onChange={(event) => setActividadEconomica(event.target.value)}
                          placeholder="Comercialización, servicios profesionales, etc."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Zona geográfica donde opera</Label>
                        <Input
                          value={zonaGeografica}
                          onChange={(event) => setZonaGeografica(event.target.value)}
                          placeholder="Estados, países o regiones"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Frecuencia de operaciones</Label>
                        <Input
                          value={frecuenciaOperaciones}
                          onChange={(event) => setFrecuenciaOperaciones(event.target.value)}
                          placeholder="Mensual, trimestral, única vez, etc."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>¿Es persona políticamente expuesta?</Label>
                        <Select value={esPep} onValueChange={setEsPep}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecciona" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no">No</SelectItem>
                            <SelectItem value="si">Sí</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="rounded border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900">
                    <p className="font-semibold">Checklist documental según tipo de cliente</p>
                    <ScrollArea className="mt-3 h-56 pr-3">
                      <ul className="space-y-2 text-xs">
                        {documentoRequerido.map((documento) => (
                          <li key={documento} className="flex items-start gap-2 rounded border border-emerald-200 bg-white/80 p-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                            <span>{documento}</span>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                </div>
              )}
              {pasoActual.key === "operacion" && (
                <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Monto de la operación (MXN)</Label>
                        <Input
                          value={montoOperacion}
                          onChange={(event) => setMontoOperacion(event.target.value)}
                          placeholder="Ingresa monto"
                          type="number"
                          min={0}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Divisa</Label>
                        <Select value={moneda} onValueChange={setMoneda}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecciona divisa" />
                          </SelectTrigger>
                          <SelectContent>
                            {MONEDA_OPCIONES.map((divisa) => (
                              <SelectItem key={divisa.value} value={divisa.value}>
                                {divisa.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Criterio de evaluación</Label>
                        <Select value={criterioEvaluacion} onValueChange={(value: CriterioEvaluacion) => setCriterioEvaluacion(value)}>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Selecciona criterio" />
                          </SelectTrigger>
                          <SelectContent>
                            {CRITERIO_OPCIONES.map((opcion) => (
                              <SelectItem key={opcion.value} value={opcion.value}>
                                {opcion.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Fecha de operación</Label>
                        <Input type="date" value={fechaOperacion} onChange={(event) => setFechaOperacion(event.target.value)} />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Tipo o naturaleza de la operación</Label>
                        <Input
                          value={tipoOperacion}
                          onChange={(event) => setTipoOperacion(event.target.value)}
                          placeholder="Venta, arrendamiento, entrega de premio, etc."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Medio o forma de pago</Label>
                        <Input
                          value={medioPago}
                          onChange={(event) => setMedioPago(event.target.value)}
                          placeholder="Efectivo, transferencia, cheque, cripto, etc."
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Origen de los recursos</Label>
                        <Input
                          value={origenRecursos}
                          onChange={(event) => setOrigenRecursos(event.target.value)}
                          placeholder="Cuenta bancaria, fondos propios, crédito, etc."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Destino de los recursos</Label>
                        <Input
                          value={destinoRecursos}
                          onChange={(event) => setDestinoRecursos(event.target.value)}
                          placeholder="Compra de inmueble, pago de premio, inversión, etc."
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Comportamiento o actividad inusual</Label>
                      <Textarea
                        value={comportamientoInusual}
                        onChange={(event) => setComportamientoInusual(event.target.value)}
                        placeholder="Describe si existen señales atípicas u observaciones del oficial de cumplimiento."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Evidencia y soporte documental</Label>
                      <Textarea
                        value={evidencia}
                        onChange={(event) => setEvidencia(event.target.value)}
                        placeholder="Contratos, estados de cuenta, folios de transferencia, actas notariales, etc."
                      />
                    </div>
                  </div>
                  <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-700">
                    <p className="font-semibold">Vista previa del semáforo</p>
                    {umbralPesos ? (
                      <div className="mt-4 space-y-3">
                        <div className={`rounded-lg border p-3 text-sm ${statusSimulado === "aviso" ? "border-rose-300 bg-rose-50" : statusSimulado === "identificacion" ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50"}`}>
                          <p className="font-semibold text-slate-700">{getStatusLabel(statusSimulado)}</p>
                          <p className="text-xs text-muted-foreground">{getStatusDescription(statusSimulado)}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            Referencia utilizada: {criterioEvaluacion === "acumulado" ? "Acumulado mensual" : "Importe individual"}
                            {montoValido ? ` (${formatCurrency(valorReferencia)})` : ""}
                          </p>
                        </div>
                        <div className="grid gap-3 text-xs">
                          <div className="rounded border border-emerald-200 bg-emerald-50/70 p-2">
                            <p className="font-semibold text-emerald-700">Umbral identificación</p>
                            <p>{actividadSeleccionada?.identificacionUmbralUma.toLocaleString("es-MX")} UMA – {formatCurrency(umbralPesos.identificacion)}</p>
                          </div>
                          <div className="rounded border border-rose-200 bg-rose-50/70 p-2">
                            <p className="font-semibold text-rose-700">Umbral aviso</p>
                            <p>{actividadSeleccionada?.avisoUmbralUma.toLocaleString("es-MX")} UMA – {formatCurrency(umbralPesos.aviso)}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">Selecciona primero la actividad y el mes para visualizar el semáforo.</p>
                    )}
                  </div>
                </div>
              )}
              {pasoActual.key === "obligaciones" && actividadSeleccionada && umbralPesos && (
                <div className="space-y-6">
                  <div className="grid gap-4 lg:grid-cols-[1.3fr,1fr]">
                    <div className="space-y-4">
                      <Card className="border-slate-200">
                        <CardHeader>
                          <CardTitle>Obligaciones aplicables</CardTitle>
                          <CardDescription>
                            Revisa los umbrales por fracción {actividadSeleccionada.fraccion} – {actividadSeleccionada.nombre} y las obligaciones UIF.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm leading-relaxed">
                          <div className="rounded border bg-slate-50 p-4">
                            <h4 className="font-semibold text-slate-700">Sin superar umbral</h4>
                            <p className="mt-2 text-muted-foreground">{obligacionesTexto?.sinUmbral}</p>
                          </div>
                          <div className="rounded border bg-amber-50 p-4">
                            <h4 className="font-semibold text-amber-700">Umbral de identificación</h4>
                            <p className="mt-2 text-amber-800">{obligacionesTexto?.identificacion}</p>
                          </div>
                          <div className="rounded border bg-rose-50 p-4">
                            <h4 className="font-semibold text-rose-700">Umbral de aviso</h4>
                            <p className="mt-2 text-rose-800">{obligacionesTexto?.aviso}</p>
                          </div>
                          <div className="rounded border bg-indigo-50 p-4 text-indigo-900">
                            <h4 className="font-semibold">Criterios UIF</h4>
                            <ul className="mt-2 list-disc space-y-1 pl-4">
                              {actividadSeleccionada.criteriosUif.map((criterio) => (
                                <li key={criterio}>{criterio}</li>
                              ))}
                            </ul>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-slate-200">
                        <CardHeader>
                          <CardTitle>Resumen previo del aviso</CardTitle>
                          <CardDescription>Genera un aviso preliminar con nomenclatura {periodoSeleccionado} antes de registrarlo.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                          <p>
                            <span className="font-semibold">Cliente:</span> {clienteNombre || "Pendiente"} ({rfcNormalizado || "RFC"})
                          </p>
                          <p>
                            <span className="font-semibold">Periodo:</span> {periodoSeleccionado}
                          </p>
                          <p>
                            <span className="font-semibold">Criterio:</span> {criterioEvaluacion === "acumulado" ? "Acumulado mensual" : "Importe individual"}
                          </p>
                          <p>
                            <span className="font-semibold">Monto considerado:</span> {montoValido ? formatCurrency(valorReferencia) : "Pendiente"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Al presentar el aviso se reinicia la acumulación. Si pertenece al mismo grupo empresarial y no procede aviso individual, genera el informe 27 Bis en ceros.
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={agregarOperacion}>
                              <Plus className="mr-2 h-4 w-4" /> Añadir actividad vulnerable
                            </Button>
                            <Button variant="outline" onClick={handlePrevStep}>
                              <ArrowLeft className="mr-2 h-4 w-4" /> Regresar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="space-y-4">
                      <Card className="border-slate-200">
                        <CardHeader>
                          <CardTitle>Alertas sugeridas</CardTitle>
                          <CardDescription>Define controles y alertas según el umbral alcanzado.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs">
                          <Alert className="border-emerald-200 bg-emerald-50/70 text-emerald-900">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Monitoreo mensual</AlertTitle>
                            <AlertDescription>
                              Las operaciones son acumulables dentro del mismo mes calendario. Marca el aviso como presentado para reiniciar el conteo.
                            </AlertDescription>
                          </Alert>
                          {statusSimulado !== "sin-obligacion" && (
                            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle>Seguimiento reforzado</AlertTitle>
                              <AlertDescription>{getStatusDescription(statusSimulado)}</AlertDescription>
                            </Alert>
                          )}
                          {mismoGrupo === "si" && (
                            <Alert className="border-slate-200 bg-white text-slate-700">
                              <AlertCircle className="h-4 w-4" />
                              <AlertTitle>Grupo empresarial</AlertTitle>
                              <AlertDescription>
                                Cuando el cliente pertenece al mismo grupo empresarial y supera el umbral de aviso, genera el informe 27 Bis en ceros si no se presenta aviso individual.
                              </AlertDescription>
                            </Alert>
                          )}
                        </CardContent>
                      </Card>
                      <Card className="border-slate-200">
                        <CardHeader>
                          <CardTitle>Acciones finales</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-xs text-slate-700">
                          <p>• Reúne documentos de identificación y expedientes conforme al tipo de cliente seleccionado.</p>
                          <p>• Integra evidencia de origen y destino de recursos, así como los folios de transferencias y contratos.</p>
                          <p>• Conserva los XML generados y las constancias de envío ante el SAT o informes 27 Bis.</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={handlePrevStep} disabled={stepIndex === 0}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Anterior
                </Button>
                <Button onClick={handleNextStep} disabled={stepIndex === STEPS.length - 1}>
                  Siguiente <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={grupoDialogOpen} onOpenChange={setGrupoDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Qué es un grupo empresarial?</AlertDialogTitle>
            <AlertDialogDescription>
              Conjunto de empresas que comparten beneficiario controlador, administración común o vínculos de control. Cuando una operación rebasa el umbral de aviso entre entidades del mismo grupo, puede corresponder un informe 27 Bis en ceros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(avisoPreliminar)} onOpenChange={() => setAvisoPreliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vista previa del aviso</AlertDialogTitle>
            <AlertDialogDescription>Verifica los datos antes de generar el XML preliminar.</AlertDialogDescription>
          </AlertDialogHeader>
          {avisoPreliminar && (
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Cliente:</span> {avisoPreliminar.cliente} ({avisoPreliminar.rfc})
              </p>
              <p>
                <span className="font-semibold">Actividad:</span> {avisoPreliminar.fraccion} – {avisoPreliminar.actividadNombre}
              </p>
              <p>
                <span className="font-semibold">Periodo:</span> {avisoPreliminar.periodo}
              </p>
              <p>
                <span className="font-semibold">Monto:</span> {formatCurrency(avisoPreliminar.monto)} ({avisoPreliminar.moneda})
              </p>
              <p>
                <span className="font-semibold">Criterio:</span> {avisoPreliminar.criterioEvaluacion}
              </p>
              <p className="text-xs text-muted-foreground">{avisoPreliminar.alerta}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
            {avisoPreliminar && (
              <AlertDialogAction onClick={() => exportarXml(avisoPreliminar)}>Descargar XML preliminar</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
