"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useLanguage } from "@/lib/LanguageContext"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, CalendarClock, ClipboardCheck, FileText, ShieldCheck, TrendingUp } from "lucide-react"
import { translations } from "@/lib/translations"

interface RiskFactor {
  id: string
  name: string
  description: string
  weight: number
  score: number
}

interface ExpedienteDetalle {
  rfc: string
  nombre: string
  tipoCliente?: string
  actualizadoEn?: string
}

interface OperacionCliente {
  id: string
  rfc: string
  cliente: string
  actividadNombre: string
  tipoOperacion: string
  monto: number
  fechaOperacion: string
  umbralStatus?: "sin-obligacion" | "identificacion" | "aviso"
  alerta?: string | null
  avisoPresentado?: boolean
  documentosSoporte?: Array<{ id: string }>
}

interface StoredEvaluation {
  rfc: string
  riskFactors: RiskFactor[]
  notes: string
  updatedAt: string
}

const EXPEDIENTE_DETALLE_STORAGE_KEY = "kyc_expedientes_detalle"
const OPERACIONES_STORAGE_KEY = "actividades_vulnerables_operaciones"
const EBR_STORAGE_KEY = "ebr_evaluaciones"

const scoreOptions = [
  { value: "1", label: "Bajo (1)" },
  { value: "2", label: "Bajo-Medio (2)" },
  { value: "3", label: "Medio (3)" },
  { value: "4", label: "Medio-Alto (4)" },
  { value: "5", label: "Alto (5)" },
]

const initialRiskFactors: RiskFactor[] = [
  {
    id: "rf-01",
    name: "Perfil del cliente",
    description: "Actividad económica, jurisdicción, estructura accionaria y antecedentes.",
    weight: 30,
    score: 3,
  },
  {
    id: "rf-02",
    name: "Producto o servicio",
    description: "Nivel de exposición, complejidad operativa y tipo de transacción.",
    weight: 25,
    score: 2,
  },
  {
    id: "rf-03",
    name: "Canal de distribución",
    description: "Presencial, digital, intermediarios y controles de autenticación.",
    weight: 20,
    score: 3,
  },
  {
    id: "rf-04",
    name: "Operación y volumen",
    description: "Frecuencia, montos y señales de transacciones inusuales.",
    weight: 15,
    score: 4,
  },
  {
    id: "rf-05",
    name: "Historial de cumplimiento",
    description: "Alertas previas, hallazgos de auditoría y observaciones regulatorias.",
    weight: 10,
    score: 2,
  },
]

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)

const safeDate = (value?: string) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const buildRiskFactorsFromData = (operaciones: OperacionCliente[], expediente?: ExpedienteDetalle | null) => {
  const totalMonto = operaciones.reduce((sum, operacion) => sum + (Number.isFinite(operacion.monto) ? operacion.monto : 0), 0)
  const alertas = operaciones.filter((operacion) => Boolean(operacion.alerta) || operacion.umbralStatus === "aviso")
  const tieneIdentificacion = operaciones.some((operacion) => operacion.umbralStatus === "identificacion")
  const actividadesUnicas = new Set(operaciones.map((operacion) => operacion.actividadNombre)).size
  const tipoCliente = expediente?.tipoCliente?.toLowerCase() ?? ""

  const perfilScore = tipoCliente.includes("moral") ? 3 : tipoCliente.includes("fideicomiso") ? 4 : 2
  const productoScore = actividadesUnicas >= 3 ? 4 : actividadesUnicas === 2 ? 3 : 2
  const canalScore = operaciones.length >= 6 ? 4 : operaciones.length >= 3 ? 3 : 2
  const volumenScore = totalMonto >= 1000000 ? 5 : totalMonto >= 500000 ? 4 : totalMonto >= 100000 ? 3 : 2
  const cumplimientoScore = alertas.length > 0 ? 4 : tieneIdentificacion ? 3 : 2

  return initialRiskFactors.map((factor) => {
    switch (factor.id) {
      case "rf-01":
        return { ...factor, score: perfilScore }
      case "rf-02":
        return { ...factor, score: productoScore }
      case "rf-03":
        return { ...factor, score: canalScore }
      case "rf-04":
        return { ...factor, score: volumenScore }
      case "rf-05":
        return { ...factor, score: cumplimientoScore }
      default:
        return factor
    }
  })
}

export default function EbrPage() {
  const { language } = useLanguage()
  const t = translations[language]
  const [expedientes, setExpedientes] = useState<ExpedienteDetalle[]>([])
  const [operaciones, setOperaciones] = useState<OperacionCliente[]>([])
  const [evaluacionesGuardadas, setEvaluacionesGuardadas] = useState<Record<string, StoredEvaluation>>({})
  const [clienteSeleccionado, setClienteSeleccionado] = useState("")
  const [riskFactors, setRiskFactors] = useState<RiskFactor[]>(initialRiskFactors)
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const storedExpedientes = window.localStorage.getItem(EXPEDIENTE_DETALLE_STORAGE_KEY)
      if (storedExpedientes) {
        const parsed = JSON.parse(storedExpedientes) as unknown
        if (Array.isArray(parsed)) {
          const clean = parsed.filter((item): item is ExpedienteDetalle => Boolean(item?.rfc))
          setExpedientes(clean)
        }
      }
    } catch (_error) {
      setExpedientes([])
    }

    try {
      const storedOperaciones = window.localStorage.getItem(OPERACIONES_STORAGE_KEY)
      if (storedOperaciones) {
        const parsed = JSON.parse(storedOperaciones) as unknown
        if (Array.isArray(parsed)) {
          const clean = parsed.filter((item): item is OperacionCliente => Boolean(item?.id && item?.rfc))
          setOperaciones(clean)
        }
      }
    } catch (_error) {
      setOperaciones([])
    }

    try {
      const storedEvaluaciones = window.localStorage.getItem(EBR_STORAGE_KEY)
      if (storedEvaluaciones) {
        const parsed = JSON.parse(storedEvaluaciones) as Record<string, StoredEvaluation>
        setEvaluacionesGuardadas(parsed ?? {})
      }
    } catch (_error) {
      setEvaluacionesGuardadas({})
    }
  }, [])

  const clientesDisponibles = useMemo(() => {
    const mapa = new Map<string, { rfc: string; nombre: string }>()
    expedientes.forEach((expediente) => {
      if (!expediente?.rfc) return
      mapa.set(expediente.rfc, { rfc: expediente.rfc, nombre: expediente.nombre })
    })
    operaciones.forEach((operacion) => {
      if (!operacion?.rfc) return
      if (mapa.has(operacion.rfc)) return
      mapa.set(operacion.rfc, { rfc: operacion.rfc, nombre: operacion.cliente || operacion.rfc })
    })
    return Array.from(mapa.values())
  }, [expedientes, operaciones])

  useEffect(() => {
    if (clienteSeleccionado) return
    if (clientesDisponibles.length === 0) return
    setClienteSeleccionado(clientesDisponibles[0].rfc)
  }, [clienteSeleccionado, clientesDisponibles])

  const expedienteActual = useMemo(
    () => expedientes.find((expediente) => expediente.rfc === clienteSeleccionado) ?? null,
    [expedientes, clienteSeleccionado],
  )

  const operacionesCliente = useMemo(
    () => operaciones.filter((operacion) => operacion.rfc === clienteSeleccionado),
    [operaciones, clienteSeleccionado],
  )

  const ultimoMovimiento = useMemo(() => {
    const fechas = operacionesCliente.map((operacion) => safeDate(operacion.fechaOperacion)).filter(Boolean) as Date[]
    const fechaExpediente = safeDate(expedienteActual?.actualizadoEn)
    if (fechaExpediente) fechas.push(fechaExpediente)
    if (fechas.length === 0) return null
    return new Date(Math.max(...fechas.map((fecha) => fecha.getTime())))
  }, [operacionesCliente, expedienteActual])

  const fechaRevision = useMemo(() => addDays(ultimoMovimiento ?? new Date(), 90), [ultimoMovimiento])

  useEffect(() => {
    if (!clienteSeleccionado) return
    const stored = evaluacionesGuardadas[clienteSeleccionado]
    if (stored) {
      setRiskFactors(stored.riskFactors)
      setNotes(stored.notes)
      return
    }

    setRiskFactors(buildRiskFactorsFromData(operacionesCliente, expedienteActual))
    setNotes("")
  }, [clienteSeleccionado, evaluacionesGuardadas, operacionesCliente, expedienteActual])

  const totalWeight = useMemo(
    () => riskFactors.reduce((sum, factor) => sum + factor.weight, 0),
    [riskFactors],
  )

  const totalScore = useMemo(
    () => riskFactors.reduce((sum, factor) => sum + factor.weight * factor.score, 0),
    [riskFactors],
  )

  const scorePercent = useMemo(() => {
    const maxScore = totalWeight * 5
    return Math.round((totalScore / maxScore) * 100)
  }, [totalScore, totalWeight])

  const riskLevel = useMemo(() => {
    if (scorePercent < 35) return "Bajo"
    if (scorePercent < 70) return "Medio"
    return "Alto"
  }, [scorePercent])

  const riskBadgeStyles = {
    Bajo: "bg-emerald-100 text-emerald-700",
    Medio: "bg-amber-100 text-amber-700",
    Alto: "bg-rose-100 text-rose-700",
  }

  const updateRiskScore = (id: string, value: string) => {
    setRiskFactors((prev) =>
      prev.map((factor) => (factor.id === id ? { ...factor, score: Number(value) } : factor)),
    )
  }

  const totalDocumentos = useMemo(
    () =>
      operacionesCliente.reduce(
        (sum, operacion) => sum + (operacion.documentosSoporte ? operacion.documentosSoporte.length : 0),
        0,
      ),
    [operacionesCliente],
  )

  const mitigacionBaseDate = useMemo(() => addDays(new Date(), 14), [])
  const mitigationActions = useMemo(
    () => [
      {
        id: "mt-01",
        title: "Reforzar monitoreo transaccional",
        description: "Activar reglas de alerta para operaciones recurrentes y montos atípicos.",
        owner: "Oficial de Cumplimiento",
        dueDate: formatDate(addDays(mitigacionBaseDate, 15)),
        status: operacionesCliente.some((operacion) => operacion.umbralStatus === "aviso") ? "En progreso" : "Pendiente",
      },
      {
        id: "mt-02",
        title: "Actualizar expediente y documentación",
        description: "Revalidar KYC, domicilio fiscal y beneficiario controlador.",
        owner: "Equipo de KYC",
        dueDate: formatDate(addDays(mitigacionBaseDate, 30)),
        status: expedienteActual ? "En progreso" : "Pendiente",
      },
      {
        id: "mt-03",
        title: "Capacitación focalizada",
        description: "Sesión interna sobre señales de riesgo y tipologías relevantes.",
        owner: "Capital Humano",
        dueDate: formatDate(addDays(mitigacionBaseDate, 45)),
        status: "Programado",
      },
    ],
    [mitigacionBaseDate, operacionesCliente, expedienteActual],
  )

  const monitoringUpdates = useMemo(
    () => [
      {
        id: "up-01",
        title: "Revisión de alertas y umbrales",
        description: `${operacionesCliente.length} operaciones analizadas para el cliente seleccionado.`,
        date: formatDate(addDays(new Date(), -45)),
      },
      {
        id: "up-02",
        title: "Sincronización con EUI",
        description: expedienteActual
          ? `Expediente actualizado para ${expedienteActual.nombre}.`
          : "Sin expediente vinculado; se requiere completar el EUI.",
        date: formatDate(addDays(new Date(), -25)),
      },
      {
        id: "up-03",
        title: "Ajuste de matriz",
        description: "Se recalcularon ponderaciones con base en evidencia operativa.",
        date: formatDate(addDays(new Date(), -10)),
      },
    ],
    [operacionesCliente.length, expedienteActual],
  )

  const saveEvaluation = () => {
    if (!clienteSeleccionado) return
    const updated: StoredEvaluation = {
      rfc: clienteSeleccionado,
      riskFactors,
      notes,
      updatedAt: new Date().toISOString(),
    }
    const next = { ...evaluacionesGuardadas, [clienteSeleccionado]: updated }
    setEvaluacionesGuardadas(next)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EBR_STORAGE_KEY, JSON.stringify(next))
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">{t.ebrTitle}</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">{t.ebrSubtitle}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/actividades-vulnerables">
              <FileText className="mr-2 h-4 w-4" />
              Ver operaciones
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/kyc-expediente">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Ver expediente
            </Link>
          </Button>
          <Button onClick={saveEvaluation}>
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Guardar evaluación
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Conexión con expedientes y operaciones</CardTitle>
          <CardDescription>
            La EBR reutiliza el expediente único y las operaciones registradas para construir la matriz de riesgo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">Cliente seleccionado</p>
            <Select value={clienteSeleccionado} onValueChange={setClienteSeleccionado}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientesDisponibles.map((cliente) => (
                  <SelectItem key={cliente.rfc} value={cliente.rfc}>
                    {cliente.nombre} ({cliente.rfc})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {clienteSeleccionado
                ? `${operacionesCliente.length} operaciones vinculadas`
                : "Sin cliente seleccionado"}
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">Expediente EUI</p>
            <p className="text-base font-medium text-gray-900">
              {expedienteActual ? expedienteActual.nombre : "Pendiente de integración"}
            </p>
            <p className="text-xs text-muted-foreground">
              {expedienteActual?.tipoCliente ?? "Sin tipo definido"}
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">Operaciones recientes</p>
            <p className="text-base font-medium text-gray-900">{operacionesCliente.length}</p>
            <p className="text-xs text-muted-foreground">
              {ultimoMovimiento ? `Último movimiento: ${formatDate(ultimoMovimiento)}` : "Sin operaciones aún"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Nivel de riesgo</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              {riskLevel}
              <Badge className={riskBadgeStyles[riskLevel as keyof typeof riskBadgeStyles]}>{scorePercent}%</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Resultado ponderado de la matriz actual.</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avance de evaluación</CardDescription>
            <CardTitle className="text-2xl">{scorePercent}% completado</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={scorePercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Última actualización: {formatDate(ultimoMovimiento ?? new Date())}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Próxima revisión</CardDescription>
            <CardTitle className="text-2xl">{formatDate(fechaRevision)}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <CalendarClock className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Calendario anual de seguimiento.</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Evidencias activas</CardDescription>
            <CardTitle className="text-2xl">{totalDocumentos} documentos</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Soportes cargados y aprobados.</span>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="matriz" className="space-y-6">
        <TabsList className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
          <TabsTrigger value="matriz">Matriz de riesgo</TabsTrigger>
          <TabsTrigger value="mitigacion">Plan de mitigación</TabsTrigger>
          <TabsTrigger value="seguimiento">Seguimiento</TabsTrigger>
        </TabsList>

        <TabsContent value="matriz" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Matriz de evaluación</CardTitle>
              <CardDescription>Actualiza el puntaje de cada factor para recalcular el riesgo global.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {riskFactors.map((factor) => (
                <div
                  key={factor.id}
                  className="rounded-lg border border-border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900">{factor.name}</p>
                    <p className="text-sm text-muted-foreground">{factor.description}</p>
                  </div>
                  <div className="flex flex-col gap-2 md:items-end">
                    <span className="text-xs text-muted-foreground">Peso: {factor.weight}%</span>
                    <Select value={String(factor.score)} onValueChange={(value) => updateRiskScore(factor.id, value)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        {scoreOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}

              <div className="rounded-lg bg-muted/50 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Puntaje ponderado total</p>
                  <p className="text-2xl font-semibold text-gray-900">{scorePercent}%</p>
                </div>
                <Badge className={riskBadgeStyles[riskLevel as keyof typeof riskBadgeStyles]}>
                  Riesgo {riskLevel}
                </Badge>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">Observaciones clave</p>
                <Textarea
                  placeholder="Documenta hallazgos relevantes, supuestos y fuentes de información."
                  className="min-h-[120px]"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mitigacion" className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            {mitigationActions.map((action) => (
              <Card key={action.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{action.title}</CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Responsable</span>
                    <span className="font-medium text-gray-900">{action.owner}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Fecha límite</span>
                    <span className="font-medium text-gray-900">{action.dueDate}</span>
                  </div>
                  <Badge variant="secondary" className="w-fit">
                    {action.status}
                  </Badge>
                  <Button variant="outline" size="sm" className="w-full">
                    Actualizar estatus
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="seguimiento" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Registro de seguimiento</CardTitle>
              <CardDescription>Histórico de revisiones, auditorías y ajustes a la matriz.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {monitoringUpdates.map((update, index) => (
                  <div key={update.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-3 w-3 rounded-full bg-primary" />
                      {index !== monitoringUpdates.length - 1 && <div className="h-full w-px bg-border" />}
                    </div>
                    <div className="pb-6">
                      <p className="text-sm text-muted-foreground">{update.date}</p>
                      <p className="font-medium text-gray-900">{update.title}</p>
                      <p className="text-sm text-muted-foreground">{update.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-dashed border-border p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Pendiente de revisión anual</p>
                  <p className="text-sm text-muted-foreground">
                    Debe realizarse una validación completa de la metodología y evidencias antes del{" "}
                    {formatDate(addDays(fechaRevision, 90))}.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
