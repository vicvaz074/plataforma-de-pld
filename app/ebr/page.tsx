"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { jsPDF } from "jspdf"
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

interface RiskOption {
  value: string
  label: string
  score: number
}

interface RiskQuestion {
  id: string
  name: string
  description: string
  group: "caracteristicas" | "zonas"
  options: RiskOption[]
  selectedValue: string
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
  riskQuestions: RiskQuestion[]
  notes: string
  updatedAt: string
}

const EXPEDIENTE_DETALLE_STORAGE_KEY = "kyc_expedientes_detalle"
const OPERACIONES_STORAGE_KEY = "actividades_vulnerables_operaciones"
const EBR_STORAGE_KEY = "ebr_evaluaciones"

const sectorEconomicoOptions: RiskOption[] = [
  { value: "agropecuario", label: "Agropecuario (1)", score: 1 },
  { value: "comercio", label: "Comercio minorista (1)", score: 1 },
  { value: "manufactura", label: "Manufactura (2)", score: 2 },
  { value: "servicios-profesionales", label: "Servicios profesionales (2)", score: 2 },
  { value: "inmobiliario", label: "Inmobiliario (3)", score: 3 },
  { value: "juegos-apuestas", label: "Juegos y apuestas (3)", score: 3 },
  { value: "metales", label: "Metales/preciosos (3)", score: 3 },
  { value: "criptoactivos", label: "Criptoactivos (3)", score: 3 },
]

const countryOptions: RiskOption[] = [
  { value: "mexico", label: "México (1)", score: 1 },
  { value: "canada", label: "Canadá (1)", score: 1 },
  { value: "estados-unidos", label: "Estados Unidos (1)", score: 1 },
  { value: "espana", label: "España (1)", score: 1 },
  { value: "alemania", label: "Alemania (1)", score: 1 },
  { value: "brasil", label: "Brasil (2)", score: 2 },
  { value: "colombia", label: "Colombia (2)", score: 2 },
  { value: "argentina", label: "Argentina (2)", score: 2 },
  { value: "peru", label: "Perú (2)", score: 2 },
  { value: "chile", label: "Chile (2)", score: 2 },
  { value: "rusia", label: "Rusia (3)", score: 3 },
  { value: "venezuela", label: "Venezuela (3)", score: 3 },
  { value: "nigeria", label: "Nigeria (3)", score: 3 },
  { value: "afganistan", label: "Afganistán (3)", score: 3 },
  { value: "siria", label: "Siria (3)", score: 3 },
  { value: "corea-norte", label: "Corea del Norte (4)", score: 4 },
  { value: "iran", label: "Irán (4)", score: 4 },
  { value: "myanmar", label: "Myanmar (4)", score: 4 },
]

const initialRiskQuestions: RiskQuestion[] = [
  {
    id: "so-tipo",
    name: "Tipo de SO",
    description: "Figura legal y complejidad de la estructura del sujeto obligado.",
    group: "caracteristicas",
    options: [
      { value: "fisica", label: "Persona física (1)", score: 1 },
      { value: "moral-nacional", label: "Persona moral nacional (2)", score: 2 },
      { value: "moral-extranjera", label: "Persona moral extranjera o fideicomiso (3)", score: 3 },
    ],
    selectedValue: "fisica",
  },
  {
    id: "so-constitucion",
    name: "Fecha de Constitución o Nacimiento",
    description: "Antigüedad del sujeto obligado.",
    group: "caracteristicas",
    options: [
      { value: "mas-5", label: "Más de 5 años (1)", score: 1 },
      { value: "1-5", label: "Entre 1 y 5 años (2)", score: 2 },
      { value: "menos-1", label: "Menos de 1 año (3)", score: 3 },
    ],
    selectedValue: "mas-5",
  },
  {
    id: "so-edad",
    name: "Edad del SO, apoderado o representante legal",
    description: "Rango etario del apoderado o representante legal.",
    group: "caracteristicas",
    options: [
      { value: "mayor-25", label: "Mayor o igual a 25 años (1)", score: 1 },
      { value: "18-24", label: "Entre 18 y 24 años (2)", score: 2 },
      { value: "menor-18", label: "Menor de 18 o sin validar (3)", score: 3 },
    ],
    selectedValue: "mayor-25",
  },
  {
    id: "so-sector",
    name: "Sector Económico",
    description: "Nivel de exposición del sector a riesgos LA/FT.",
    group: "caracteristicas",
    options: sectorEconomicoOptions,
    selectedValue: "agropecuario",
  },
  {
    id: "so-domicilios",
    name: "Domicilios Virtuales",
    description: "Nivel de operación remota o digital del sujeto obligado.",
    group: "caracteristicas",
    options: [
      { value: "sin", label: "Sin domicilios virtuales (1)", score: 1 },
      { value: "parcial", label: "Uso parcial de domicilios virtuales (2)", score: 2 },
      { value: "principal", label: "Operación principalmente virtual (3)", score: 3 },
    ],
    selectedValue: "sin",
  },
  {
    id: "so-destino",
    name: "Destino de los Recursos",
    description: "Finalidad y destino operativo de los recursos.",
    group: "caracteristicas",
    options: [
      { value: "propio", label: "Operación propia/local (1)", score: 1 },
      { value: "mixto", label: "Destino mixto (2)", score: 2 },
      { value: "terceros", label: "Transferencias a terceros o exterior (3)", score: 3 },
    ],
    selectedValue: "propio",
  },
  {
    id: "so-pep",
    name: "Persona Políticamente Expuesta",
    description: "Condición PEP del sujeto obligado o su representante legal.",
    group: "caracteristicas",
    options: [
      { value: "no", label: "No PEP (1)", score: 1 },
      { value: "nacional", label: "PEP nacional (2)", score: 2 },
      { value: "extranjera", label: "PEP extranjero o de alto perfil (3)", score: 3 },
    ],
    selectedValue: "no",
  },
  {
    id: "so-nacionalidad",
    name: "País de Nacionalidad",
    description: "Jurisdicción de nacionalidad y riesgo geográfico.",
    group: "zonas",
    options: countryOptions,
    selectedValue: "mexico",
  },
  {
    id: "so-residencia",
    name: "País de Residencia",
    description: "Residencia fiscal o habitual y riesgo geográfico.",
    group: "zonas",
    options: countryOptions,
    selectedValue: "mexico",
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

const getSelectedOption = (question: RiskQuestion) =>
  question.options.find((option) => option.value === question.selectedValue) ?? question.options[0]

const getMaxScore = (question: RiskQuestion) =>
  question.options.reduce((max, option) => (option.score > max ? option.score : max), 0)

export default function EbrPage() {
  const { language } = useLanguage()
  const t = translations[language]
  const [expedientes, setExpedientes] = useState<ExpedienteDetalle[]>([])
  const [operaciones, setOperaciones] = useState<OperacionCliente[]>([])
  const [evaluacionesGuardadas, setEvaluacionesGuardadas] = useState<Record<string, StoredEvaluation>>({})
  const [clienteSeleccionado, setClienteSeleccionado] = useState("")
  const [riskQuestions, setRiskQuestions] = useState<RiskQuestion[]>(initialRiskQuestions)
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
      setRiskQuestions(stored.riskQuestions)
      setNotes(stored.notes)
      return
    }

    setRiskQuestions(initialRiskQuestions)
    setNotes("")
  }, [clienteSeleccionado, evaluacionesGuardadas, operacionesCliente, expedienteActual])

  const savedEvaluation = evaluacionesGuardadas[clienteSeleccionado]

  const totalScore = useMemo(
    () => riskQuestions.reduce((sum, question) => sum + getSelectedOption(question).score, 0),
    [riskQuestions],
  )

  const maxScore = useMemo(
    () => riskQuestions.reduce((sum, question) => sum + getMaxScore(question), 0),
    [riskQuestions],
  )

  const scorePercent = useMemo(() => {
    if (!maxScore) return 0
    return Math.round((totalScore / maxScore) * 100)
  }, [totalScore, maxScore])

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
    setRiskQuestions((prev) =>
      prev.map((question) => (question.id === id ? { ...question, selectedValue: value } : question)),
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
      riskQuestions,
      notes,
      updatedAt: new Date().toISOString(),
    }
    const next = { ...evaluacionesGuardadas, [clienteSeleccionado]: updated }
    setEvaluacionesGuardadas(next)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EBR_STORAGE_KEY, JSON.stringify(next))
    }
  }

  const exportPdfReport = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" })
    const marginX = 40
    const pageHeight = doc.internal.pageSize.getHeight()
    const contentWidth = doc.internal.pageSize.getWidth() - marginX * 2
    let cursorY = 56
    const lineHeight = 18

    const nombre = expedienteActual?.nombre ?? "Sin expediente asociado"
    const rfc = clienteSeleccionado || "Sin RFC"
    const ultimaActualizacion = savedEvaluation?.updatedAt
      ? formatDate(new Date(savedEvaluation.updatedAt))
      : formatDate(new Date())

    const ensureSpace = (space: number) => {
      if (cursorY + space <= pageHeight - 40) return
      doc.addPage()
      cursorY = 56
    }

    doc.setFillColor(17, 24, 39)
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 64, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.text("Reporte EBR - Perfil del Sujeto Obligado", marginX, 40)
    doc.setFontSize(10)
    doc.text(`Generado: ${ultimaActualizacion}`, marginX, 56)

    doc.setTextColor(31, 41, 55)
    cursorY = 86

    doc.setFontSize(12)
    doc.text("Identificación del sujeto obligado", marginX, cursorY)
    cursorY += lineHeight
    doc.setFontSize(10)
    doc.text(`Nombre: ${nombre}`, marginX, cursorY)
    cursorY += lineHeight
    doc.text(`RFC: ${rfc}`, marginX, cursorY)
    cursorY += lineHeight
    doc.text(`Nivel de riesgo: ${riskLevel} (${scorePercent}%)`, marginX, cursorY)
    cursorY += lineHeight
    doc.text(`Puntaje total: ${totalScore} / ${maxScore}`, marginX, cursorY)
    cursorY += 24

    ensureSpace(40)
    doc.setFontSize(12)
    doc.text("Detalle de respuestas", marginX, cursorY)
    cursorY += 12
    doc.setDrawColor(209, 213, 219)
    doc.line(marginX, cursorY, marginX + contentWidth, cursorY)
    cursorY += 12

    doc.setFontSize(10)
    riskQuestions.forEach((question) => {
      const option = getSelectedOption(question)
      const questionText = `${question.name}`
      const answerText = option.label
      const questionLines = doc.splitTextToSize(questionText, contentWidth * 0.45)
      const answerLines = doc.splitTextToSize(answerText, contentWidth * 0.5)
      const rowHeight = Math.max(questionLines.length, answerLines.length) * 14 + 10
      ensureSpace(rowHeight + 12)

      doc.setFillColor(243, 244, 246)
      doc.rect(marginX, cursorY - 8, contentWidth, rowHeight, "F")
      doc.setTextColor(31, 41, 55)
      doc.text(questionLines, marginX + 8, cursorY + 6)
      doc.setTextColor(55, 65, 81)
      doc.text(answerLines, marginX + contentWidth * 0.5, cursorY + 6)
      cursorY += rowHeight + 6
    })

    ensureSpace(80)
    doc.setTextColor(31, 41, 55)
    doc.setFontSize(12)
    doc.text("Observaciones", marginX, cursorY)
    cursorY += 12
    doc.setDrawColor(209, 213, 219)
    doc.line(marginX, cursorY, marginX + contentWidth, cursorY)
    cursorY += 16
    doc.setFontSize(10)
    const notesLines = doc.splitTextToSize(notes || "Sin observaciones.", contentWidth)
    doc.text(notesLines, marginX, cursorY)

    doc.save(`ebr-${rfc}.pdf`)
  }

  const deleteEvaluation = () => {
    if (!clienteSeleccionado) return
    if (!evaluacionesGuardadas[clienteSeleccionado]) return
    const next = { ...evaluacionesGuardadas }
    delete next[clienteSeleccionado]
    setEvaluacionesGuardadas(next)
    setRiskQuestions(initialRiskQuestions)
    setNotes("")
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
            {savedEvaluation ? "Actualizar evaluación" : "Guardar evaluación"}
          </Button>
          <Button variant="destructive" onClick={deleteEvaluation} disabled={!savedEvaluation}>
            Borrar evaluación
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
            <div className="rounded-lg border border-border p-4 md:col-span-3">
              <p className="text-sm text-muted-foreground">Evaluación guardada</p>
              <p className="text-base font-medium text-gray-900">
                {savedEvaluation ? "Disponible para edición" : "Sin evaluación guardada"}
              </p>
              <p className="text-xs text-muted-foreground">
                {savedEvaluation ? `Última actualización: ${formatDate(new Date(savedEvaluation.updatedAt))}` : ""}
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
          <TabsTrigger value="matriz">Perfil del sujeto obligado</TabsTrigger>
          <TabsTrigger value="mitigacion">Plan de mitigación</TabsTrigger>
          <TabsTrigger value="seguimiento">Seguimiento</TabsTrigger>
        </TabsList>

        <TabsContent value="matriz" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Perfil de Riesgo del Sujeto Obligado</CardTitle>
              <CardDescription>
                Captura las preguntas clave del sujeto obligado con puntajes de 1 a 3; los países
                Corea del Norte, Irán y Myanmar se califican con 4 puntos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm text-muted-foreground">Nombre del Sujeto Obligado</p>
                <p className="text-base font-medium text-gray-900">
                  {expedienteActual?.nombre ?? "Sin expediente asociado"}
                </p>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Características del Sujeto Obligado</p>
                    <p className="text-sm text-muted-foreground">
                      Perfil operativo, legal y de cumplimiento del sujeto obligado.
                    </p>
                  </div>
                  {riskQuestions
                    .filter((question) => question.group === "caracteristicas")
                    .map((question) => (
                      <div
                        key={question.id}
                        className="rounded-lg border border-border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="space-y-1">
                          <p className="font-medium text-gray-900">{question.name}</p>
                          <p className="text-sm text-muted-foreground">{question.description}</p>
                        </div>
                        <div className="flex flex-col gap-2 md:items-end">
                          <span className="text-xs text-muted-foreground">
                            Puntaje: {getSelectedOption(question).score}
                          </span>
                          <Select
                            value={question.selectedValue}
                            onValueChange={(value) => updateRiskScore(question.id, value)}
                          >
                            <SelectTrigger className="w-[220px]">
                              <SelectValue placeholder="Selecciona" />
                            </SelectTrigger>
                            <SelectContent>
                              {question.options.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Zonas y Áreas Geográficas en que opera el Sujeto Obligado
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Países de nacionalidad y residencia con mayor exposición geográfica.
                    </p>
                  </div>
                  {riskQuestions
                    .filter((question) => question.group === "zonas")
                    .map((question) => (
                      <div
                        key={question.id}
                        className="rounded-lg border border-border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="space-y-1">
                          <p className="font-medium text-gray-900">{question.name}</p>
                          <p className="text-sm text-muted-foreground">{question.description}</p>
                        </div>
                        <div className="flex flex-col gap-2 md:items-end">
                          <span className="text-xs text-muted-foreground">
                            Puntaje: {getSelectedOption(question).score}
                          </span>
                          <Select
                            value={question.selectedValue}
                            onValueChange={(value) => updateRiskScore(question.id, value)}
                          >
                            <SelectTrigger className="w-[220px]">
                              <SelectValue placeholder="Selecciona" />
                            </SelectTrigger>
                            <SelectContent>
                              {question.options.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="rounded-lg bg-muted/50 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Puntaje total</p>
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

          <Card className="overflow-hidden border-border/60">
            <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-700 text-white">
              <CardTitle className="text-lg">Reporte EBR</CardTitle>
              <CardDescription className="text-slate-200">
                Consolida el perfil del sujeto obligado y genera un PDF para auditorías y seguimiento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Sujeto obligado</p>
                  <p className="text-base font-semibold text-gray-900">
                    {expedienteActual?.nombre ?? "Sin expediente asociado"}
                  </p>
                  <p className="text-xs text-muted-foreground">{clienteSeleccionado || "Sin RFC"}</p>
                </div>
                <div className="rounded-lg border border-border bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Resultado</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className={riskBadgeStyles[riskLevel as keyof typeof riskBadgeStyles]}>
                      Riesgo {riskLevel}
                    </Badge>
                    <span className="text-sm font-semibold text-gray-900">{scorePercent}%</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {savedEvaluation ? `Actualizado: ${formatDate(new Date(savedEvaluation.updatedAt))}` : "Sin guardar"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-white p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Puntaje</p>
                  <p className="text-base font-semibold text-gray-900">
                    {totalScore} / {maxScore} puntos
                  </p>
                  <p className="text-xs text-muted-foreground">Referencia sobre el máximo posible.</p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">Resumen de respuestas</p>
                  <span className="text-xs text-muted-foreground">{riskQuestions.length} respuestas</span>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {riskQuestions.map((question) => {
                    const option = getSelectedOption(question)
                    return (
                      <div key={`summary-${question.id}`} className="rounded-lg border border-border bg-white p-3">
                        <p className="text-xs font-semibold text-gray-900">{question.name}</p>
                        <p className="text-sm text-muted-foreground">{option.label}</p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border p-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">Exportación</p>
                  <p className="text-xs text-muted-foreground">
                    Descarga el reporte con detalle de preguntas y observaciones.
                  </p>
                </div>
                <Button variant="outline" onClick={exportPdfReport}>
                  <FileText className="mr-2 h-4 w-4" />
                  Exportar reporte PDF
                </Button>
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
