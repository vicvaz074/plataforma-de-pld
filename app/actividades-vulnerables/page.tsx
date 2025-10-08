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
  ArrowRight,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  Info,
  Layers,
  ListChecks,
  PlayCircle,
  Plus,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react"
import type { ActividadVulnerable } from "@/lib/data/actividades"
import { actividadesVulnerables } from "@/lib/data/actividades"
import { UMA_MONTHS, UMA_PERIODS, findUmaByMonthYear } from "@/lib/data/uma"

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

interface OperacionCliente {
  id: string
  actividadKey: string
  actividadNombre: string
  tipoCliente: string
  cliente: string
  rfc: string
  mismoGrupo: boolean
  periodo: string
  mes: number
  anio: number
  monto: number
  moneda: string
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
}

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1
const START_WINDOW = new Date(2020, 8, 1) // septiembre 2020
type UmaMonthEntry = (typeof UMA_MONTHS)[number]

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
  if (status === "aviso") return "Aviso obligatorio"
  if (status === "identificacion") return "Identificación obligatoria"
  return "Sin obligación"
}

function getStatusColor(status: UmbralStatus) {
  if (status === "aviso") return "bg-red-500"
  if (status === "identificacion") return "bg-amber-500"
  return "bg-emerald-500"
}

export default function ActividadesVulnerablesPage() {
  const { toast } = useToast()
  const [wizardActivo, setWizardActivo] = useState(false)
  const [pasoActual, setPasoActual] = useState(0)
  const [actividadKey, setActividadKey] = useState<string>(actividadesVulnerables[0]?.key ?? "")
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(currentYear)
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(currentMonth)
  const [montoOperacion, setMontoOperacion] = useState<string>("")
  const [tipoCliente, setTipoCliente] = useState<string>(CLIENTE_TIPOS[0]?.value ?? "")
  const [clienteNombre, setClienteNombre] = useState<string>("")
  const [rfc, setRfc] = useState<string>("")
  const [mismoGrupo, setMismoGrupo] = useState<string>("no")
  const [tipoOperacion, setTipoOperacion] = useState<string>("")
  const [moneda, setMoneda] = useState<string>("MXN")
  const [fechaOperacion, setFechaOperacion] = useState<string>(new Date().toISOString().substring(0, 10))
  const [evidencia, setEvidencia] = useState<string>("")
  const [operaciones, setOperaciones] = useState<OperacionCliente[]>([])
  const [avisoPreliminar, setAvisoPreliminar] = useState<OperacionCliente | null>(null)
  const [infoGrupoOpen, setInfoGrupoOpen] = useState(false)
  const [actividadInfoKey, setActividadInfoKey] = useState<string | null>(null)

  const umaVentana = useMemo(() => {
    const filtered = UMA_MONTHS.filter((entry) => {
      const fecha = new Date(entry.year, entry.month - 1, 1)
      return fecha >= START_WINDOW
    })

    if (filtered.length >= 60) {
      return filtered.slice(0, 60)
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

  const umaVentanaAgrupada = useMemo(() => {
    return umaVentana.reduce((acc, entry) => {
      const registros = acc.get(entry.year) ?? []
      registros.push(entry)
      acc.set(entry.year, registros)
      return acc
    }, new Map<number, UmaMonthEntry[]>())
  }, [umaVentana])

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
    if (availableYears.length === 0) return
    if (!availableYears.includes(anioSeleccionado)) {
      setAnioSeleccionado(availableYears[availableYears.length - 1])
    }
  }, [availableYears, anioSeleccionado])

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
    let alerta: string | null = null

    if (acumulado >= umbralPesos.aviso) {
      status = "aviso"
      alerta = "Supera el umbral de aviso. Preparar aviso en 17 días y suspender acumulación."
    } else if (acumulado >= umbralPesos.identificacion) {
      status = "identificacion"
      alerta = "Supera el umbral de identificación. Integrar expediente y vigilar acumulación por 6 meses."
    }

    return {
      status,
      alerta,
      acumulado,
      monto,
      periodo: buildPeriodo(anioSeleccionado, mesSeleccionado),
    }
  }, [actividadSeleccionada, umaSeleccionada, umbralPesos, montoOperacion, operacionesRelacionadas, anioSeleccionado, mesSeleccionado])

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

  const documentoRequerido = useMemo(() => {
    if (!actividadSeleccionada) return []

    const clienteKey = (() => {
      switch (tipoCliente) {
        case "pfn":
          return "personaFisica"
        case "pfe":
          return "personaExtranjera"
        case "pmn":
          return "personaMoral"
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

    // @ts-expect-error – acceso controlado a la propiedad
    return actividadSeleccionada.clienteObligaciones[clienteKey] ?? []
  }, [actividadSeleccionada, tipoCliente])

  const pasoValido = useMemo(() => {
    if (pasoActual === 0) {
      return Boolean(actividadKey && umaSeleccionada)
    }
    if (pasoActual === 1) {
      return (
        Boolean(clienteNombre.trim()) &&
        Boolean(rfc.trim()) &&
        Boolean(tipoOperacion.trim()) &&
        Boolean(montoOperacion.trim())
      )
    }
    if (pasoActual === 2) {
      return Boolean(evaluacionActual)
    }
    return false
  }, [pasoActual, actividadKey, umaSeleccionada, clienteNombre, rfc, tipoOperacion, montoOperacion, evaluacionActual])

  const limpiarFormulario = () => {
    setMontoOperacion("")
    setTipoOperacion("")
    setEvidencia("")
    setClienteNombre("")
    setRfc("")
    setMismoGrupo("no")
    setMoneda("MXN")
    setFechaOperacion(new Date().toISOString().substring(0, 10))
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

    const periodo = buildPeriodo(anioSeleccionado, mesSeleccionado)

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
    let alerta: string | null = null

    if (acumuladoCliente >= umbralPesos.aviso) {
      status = "aviso"
      alerta = "Supera el umbral de aviso. Preparar aviso de 17 días y suspender acumulación."
    } else if (acumuladoCliente >= umbralPesos.identificacion) {
      status = "identificacion"
      alerta = "Supera el umbral de identificación. Integrar expediente y vigilar acumulación por 6 meses."
    }

    const nuevaOperacion: OperacionCliente = {
      id: crypto.randomUUID(),
      actividadKey: actividadSeleccionada.key,
      actividadNombre: `${actividadSeleccionada.fraccion} – ${actividadSeleccionada.nombre}`,
      tipoCliente,
      cliente: clienteNombre.trim(),
      rfc: rfc.trim().toUpperCase(),
      mismoGrupo: mismoGrupo === "si",
      periodo,
      mes: mesSeleccionado,
      anio: anioSeleccionado,
      monto,
      moneda,
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
    }

    setOperaciones((prev) => [...prev, nuevaOperacion])

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

    setWizardActivo(false)
    setPasoActual(0)
    limpiarFormulario()
  }

  const marcarAvisoPresentado = (id: string) => {
    setOperaciones((prev) =>
      prev.map((operacion) =>
        operacion.id === id
          ? {
              ...operacion,
              avisoPresentado: true,
              alerta: "Aviso marcado como presentado. Reiniciar acumulación a partir de esta fecha.",
            }
          : operacion,
      ),
    )
  }

  const generarAvisoPreliminar = (operacion: OperacionCliente) => {
    setAvisoPreliminar(operacion)
  }

  const exportarXml = (operacion: OperacionCliente) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<avisoPLD>\n  <periodo>${operacion.periodo}</periodo>\n  <actividad>${operacion.actividadKey}</actividad>\n  <claveActividad>${operacion.actividadKey.toUpperCase()}</claveActividad>\n  <sujetoObligado>${operacion.rfc}</sujetoObligado>\n  <cliente>\n    <nombre>${operacion.cliente}</nombre>\n    <tipoCliente>${operacion.tipoCliente}</tipoCliente>\n    <mismoGrupo>${operacion.mismoGrupo ? "SI" : "NO"}</mismoGrupo>\n  </cliente>\n  <operacion>\n    <fecha>${operacion.fechaOperacion}</fecha>\n    <monto moneda="${operacion.moneda}">${operacion.monto.toFixed(2)}</monto>\n    <tipo>${operacion.tipoOperacion}</tipo>\n    <evidencia>${operacion.evidencia.replace(/&/g, "&amp;")}</evidencia>\n  </operacion>\n</avisoPLD>`

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

  return (
    <div className="space-y-8">
      <header className="grid gap-4 lg:grid-cols-3">
        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700">
              <ShieldAlert className="h-5 w-5" /> Identificación de Actividades Vulnerables y Umbrales SAT
            </CardTitle>
            <CardDescription>
              UMAs oficiales por ciclo (del 1.º de febrero al 31 de enero) y umbrales por fracción para identificar obligaciones de
              identificación y aviso.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Ciclos UMA vigentes</p>
              <div className="mt-2 space-y-1 text-xs">
                {UMA_PERIODS.map((periodo) => (
                  <div key={periodo.cycle} className="flex items-center justify-between rounded border px-3 py-1">
                    <span>
                      {periodo.cycle} ({new Date(periodo.validFrom).toLocaleDateString("es-MX", {
                        month: "short",
                        year: "numeric",
                      })} 
                      - {new Date(periodo.validTo).toLocaleDateString("es-MX", { month: "short", year: "numeric" })})
                    </span>
                    <span className="font-semibold">{formatCurrency(periodo.daily)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded border bg-emerald-50/70 p-3 text-sm text-emerald-900">
              <p className="font-semibold">Ventana histórica</p>
              <p>
                Se incluyen 60 meses continuos desde septiembre de 2020 para alinear la evaluación mensual con las obligaciones de la
                Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" /> Resumen de umbrales
            </CardTitle>
            <CardDescription>Seguimiento automático de obligaciones por operación y acumulado mensual.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border bg-emerald-50 p-3 text-center">
              <p className="text-xs font-semibold uppercase text-emerald-600">Sin obligación</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{resumenUmbrales.sinObligacion}</p>
              <p className="text-xs text-muted-foreground">No supera umbral de identificación.</p>
            </div>
            <div className="rounded-xl border bg-amber-50 p-3 text-center">
              <p className="text-xs font-semibold uppercase text-amber-600">Identificación</p>
              <p className="mt-2 text-2xl font-bold text-amber-700">{resumenUmbrales.identificacion}</p>
              <p className="text-xs text-muted-foreground">Requiere expediente y monitoreo 6 meses.</p>
            </div>
            <div className="rounded-xl border bg-rose-50 p-3 text-center">
              <p className="text-xs font-semibold uppercase text-rose-600">Aviso SAT</p>
              <p className="mt-2 text-2xl font-bold text-rose-700">{resumenUmbrales.aviso}</p>
              <p className="text-xs text-muted-foreground">Aviso en 17 días y controles reforzados.</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Gestión de actividades vulnerables
            </CardTitle>
            <CardDescription>Administra nuevas evaluaciones o retoma registros previos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full"
              onClick={() => {
                setWizardActivo(true)
                setPasoActual(0)
                setActividadInfoKey(actividadKey)
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Registrar nueva actividad vulnerable
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (operaciones.length === 0) {
                  toast({
                    title: "Sin registros",
                    description: "Aún no existen actividades registradas. Inicia una nueva evaluación.",
                  })
                } else {
                  toast({
                    title: "Registros disponibles",
                    description: "Desplázate a la sección de seguimiento para gestionar avisos y acumulaciones.",
                  })
                }
              }}
            >
              <Layers className="mr-2 h-4 w-4" /> Gestionar registros existentes
            </Button>
            <div className="rounded border bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              <p>
                Las operaciones del mismo grupo empresarial que superen el umbral de aviso deben analizarse para determinar si procede
                aviso o informe 27 Bis en ceros.
              </p>
            </div>
          </CardContent>
        </Card>
      </header>

      {wizardActivo && (
        <section className="space-y-4">
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
                  Selecciona la fracción aplicable y define el mes y año a evaluar. Las UMAs se muestran agrupadas por ciclo oficial del
                  SAT.
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
                    <Label>Año</Label>
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
                      <p className="text-sm font-semibold text-slate-700">UMAs por año</p>
                      <p className="text-xs text-muted-foreground">
                        Cada UMA es válida del 1.º de febrero al 31 de enero del año siguiente. Consulta los valores diarios, mensuales y
                        anuales aplicables.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {Array.from(umaVentanaAgrupada.entries())
                      .sort((a, b) => a[0] - b[0])
                      .map(([year, registros]) => (
                      <div key={year} className="rounded border bg-white p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{year}</span>
                          <span className="text-muted-foreground">
                            UMA diaria {formatCurrency(registros[0]?.daily ?? 0)}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          {registros.map((registro) => (
                            <div
                              key={`${year}-${registro.month}`}
                              className={`rounded border px-2 py-1 text-center ${
                                registro.month === mesSeleccionado && registro.year === anioSeleccionado
                                  ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-50"
                              }`}
                            >
                              <p className="font-semibold">{monthLabel(registro.month).slice(0, 3)}</p>
                              <p>{formatCurrency(registro.monthly)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
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
                  Clasifica el tipo de cliente, define si pertenece al mismo grupo empresarial y captura los datos necesarios para la
                  validación del umbral.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo de cliente</Label>
                    <Select value={tipoCliente} onValueChange={setTipoCliente}>
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
                  </div>
                  <div className="space-y-2">
                    <Label>
                      ¿Forma parte del mismo grupo empresarial?
                      <Button
                        size="icon"
                        variant="ghost"
                        className="ml-2 h-6 w-6"
                        onClick={() => setInfoGrupoOpen(true)}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </Label>
                    <Select value={mismoGrupo} onValueChange={setMismoGrupo}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecciona una opción" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="si">Sí</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre del cliente / responsable</Label>
                    <Input value={clienteNombre} onChange={(event) => setClienteNombre(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>RFC</Label>
                    <Input value={rfc} onChange={(event) => setRfc(event.target.value.toUpperCase())} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de operación</Label>
                    <Input
                      value={tipoOperacion}
                      onChange={(event) => setTipoOperacion(event.target.value)}
                      placeholder="Venta de boletos, entrega de premio, preventa, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monto de la operación (MXN)</Label>
                    <Input
                      value={montoOperacion}
                      onChange={(event) => setMontoOperacion(event.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de realización</Label>
                    <Input type="date" value={fechaOperacion} onChange={(event) => setFechaOperacion(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Moneda</Label>
                    <Select value={moneda} onValueChange={setMoneda}>
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecciona moneda" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MXN">MXN</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Evidencia documental o notas internas</Label>
                    <Textarea
                      value={evidencia}
                      onChange={(event) => setEvidencia(event.target.value)}
                      placeholder="Describe la evidencia de la operación (contratos, comprobantes bancarios, CFDI, etc.)."
                    />
                  </div>
                </div>

                <div className="rounded border bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold">Checklist documental según tipo de cliente</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {documentoRequerido.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
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
                  Confirma el semáforo de obligaciones, determina si aplica aviso o informe y genera la documentación preliminar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3 rounded border bg-white p-4">
                    <p className="text-sm font-semibold text-slate-700">Evaluación automática</p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-3 w-3 rounded-full ${getStatusColor(evaluacionActual?.status ?? "sin-obligacion")}`} />
                      <span className="text-sm font-semibold text-slate-700">
                        {evaluacionActual ? getStatusLabel(evaluacionActual.status) : "Captura los datos para evaluar"}
                      </span>
                    </div>
                    {evaluacionActual && umbralPesos && (
                      <div className="space-y-2 text-sm text-slate-600">
                        <p>
                          Monto individual: <span className="font-semibold">{formatCurrency(evaluacionActual.monto)}</span>
                        </p>
                        <p>
                          Acumulado mensual cliente: {" "}
                          <span className="font-semibold">{formatCurrency(evaluacionActual.acumulado)}</span>
                        </p>
                        <p>
                          Umbral identificación: {formatCurrency(umbralPesos.identificacion)} ({actividadSeleccionada?.identificacionUmbralUma.toLocaleString("es-MX")} UMA)
                        </p>
                        <p>
                          Umbral aviso: {formatCurrency(umbralPesos.aviso)} ({actividadSeleccionada?.avisoUmbralUma.toLocaleString("es-MX")} UMA)
                        </p>
                        {evaluacionActual.alerta && (
                          <div className="flex items-start gap-2 rounded bg-amber-50 p-2 text-amber-800">
                            <AlertCircle className="mt-0.5 h-4 w-4" />
                            <span>{evaluacionActual.alerta}</span>
                          </div>
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
                      La operación rebasa el umbral de aviso y el cliente pertenece al mismo grupo empresarial. Preparar informe en ceros
                      (27 Bis) en lugar del aviso directo, preservando evidencia documental.
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

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => { setWizardActivo(false); setPasoActual(0) }}>
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
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
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
              <Building2 className="h-5 w-5 text-slate-600" /> Seguimiento y acumulación
            </CardTitle>
            <CardDescription>Controla operaciones acumulables por cliente hasta 6 meses posteriores al umbral de identificación.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Una vez superado el umbral de identificación, se deben monitorear las operaciones del mismo cliente durante los 6 meses
              siguientes. Solo se acumulan aquellas operaciones que individualmente superan el umbral de identificación. Cuando se marca
              el aviso como presentado, se reinicia el seguimiento acumulado.
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
      </section>

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
                    <p className="font-semibold text-slate-700">{fraccion}</p>
                    <ul className="mt-2 space-y-2">
                      {actividades.map((actividad) => (
                        <li key={actividad.key} className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-700">{actividad.nombre}</p>
                            <p className="text-xs text-muted-foreground">{actividad.descripcion}</p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setWizardActivo(true)
                              setPasoActual(0)
                              setActividadKey(actividad.key)
                              setActividadInfoKey(actividad.key)
                            }}
                          >
                            <Plus className="h-4 w-4" />
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
              Verifica que los datos recabados coincidan con la documentación soporte (RFC, identificación oficial, comprobante de
              domicilio y evidencia de operaciones).
            </p>
            <p>
              Los avisos o informes deben conservar evidencia digital y física, incluyendo contratos, estados de cuenta, medios de pago,
              CFDI y documentación del beneficiario final.
            </p>
          </CardContent>
        </Card>
      </section>

      <AlertDialog open={infoGrupoOpen} onOpenChange={setInfoGrupoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Qué significa mismo grupo empresarial?</AlertDialogTitle>
            <AlertDialogDescription>
              Se considera que pertenece al mismo grupo empresarial cuando existe control común, coincidencia accionaria relevante o
              participación mayoritaria que implique dirección o administración conjunta. En esos casos, si se supera el umbral de
              aviso, procede el informe 27 Bis en ceros en lugar de un aviso por operación individual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Cerrar</AlertDialogAction>
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
                <span className="font-semibold">Monto:</span> {formatCurrency(avisoPreliminar.monto)} ({avisoPreliminar.moneda})
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
