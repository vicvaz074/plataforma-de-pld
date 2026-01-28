"use client"

import type { ChangeEvent } from "react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ClipboardList,
  Clock,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  FileUp,
  History,
  Link2,
  ListChecks,
  RefreshCcw,
  Shield,
  UserCheck,
  Users,
} from "lucide-react"

interface ChecklistQuestion {
  id: string
  section: "A" | "B" | "C"
  title: string
  question: string
  evidenceYes?: string
  evidenceNo?: string
}

interface ChecklistState {
  answer: "si" | "no" | "no-aplica" | null
  notes: string
}

interface EvidenceItem {
  id: string
  label: string
  description: string
  mandatory?: boolean
}

interface DocumentUpload {
  id: string
  name: string
  type: string
  uploadedBy: string
  uploadedAt: Date
  relatedNotice: string
}

interface TraceabilityEntry {
  id: string
  action: string
  user: string
  timestamp: Date
  details: string
  noticeId: string
}

interface RegistroSujetoResumen {
  id: string
  nombre: string
  rfc: string
  tipo: string
  actividad: string
  creadoEn: Date
  registroCompleto: boolean
  representante?: string | null
}

interface ExpedienteResumen {
  rfc: string
  nombre: string
  tipoCliente?: string
  actualizadoEn?: string
}

interface OperacionResumen {
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
}

interface EvaluacionEbrResumen {
  rfc: string
  updatedAt: string
  notes: string
  riskQuestions?: Array<{
    options: Array<{ value: string; score: number }>
    selectedValue: string
  }>
  clientProfile?: {
    tipoCliente?: string
    paisResidencia?: string
    sectorEconomico?: string
  }
}

const checklistQuestions: ChecklistQuestion[] = [
  {
    id: "a1",
    section: "A",
    title: "Avisos obligatorios",
    question: "¿Se generó aviso por operación relevante que superó los umbrales?",
    evidenceYes: "Acuse de presentación SAT",
    evidenceNo: "Nota de justificación",
  },
  {
    id: "a2",
    section: "A",
    title: "Avisos obligatorios",
    question:
      "¿Se reportó la operación inusual dentro de las 24 horas siguientes a su detección, conforme al art. 27 RCG?",
    evidenceYes: "Acuse de aviso y dictamen del Oficial de Cumplimiento",
    evidenceNo: "Nota de incumplimiento",
  },
  {
    id: "a3",
    section: "A",
    title: "Avisos obligatorios",
    question: "¿Se reportó operación interna preocupante conforme a los lineamientos de la autoridad?",
    evidenceYes: "Acuse SAT y acta interna de investigación",
    evidenceNo: "Registro de seguimiento pendiente",
  },
  {
    id: "b1",
    section: "B",
    title: "Plazos y confirmación",
    question: "¿Se presentó cada aviso dentro del plazo legal?",
    evidenceYes: "Acuse con sello digital y fecha",
    evidenceNo: "Análisis de desviación de plazo",
  },
  {
    id: "b2",
    section: "B",
    title: "Plazos y confirmación",
    question: "¿Se cuenta con confirmación de recepción del SAT/UIF (folio y fecha)?",
    evidenceYes: "Comprobante de confirmación",
    evidenceNo: "Seguimiento para obtener confirmación",
  },
  {
    id: "c1",
    section: "C",
    title: "Listas y validaciones",
    question:
      "¿El cliente, usuario o beneficiario controlador aparece en listas del art. 38 RCG (UIF, ONU, OFAC, etc.)?",
    evidenceYes: "Reporte de screening y dictamen del Oficial",
    evidenceNo: "Registro negativo de screening",
  },
  {
    id: "c2",
    section: "C",
    title: "Listas y validaciones",
    question: "¿Se documentó dictamen interno de análisis de riesgo antes del envío del aviso?",
    evidenceYes: "Dictamen firmado por el Oficial de Cumplimiento",
    evidenceNo: "Plan de acción para completar dictamen",
  },
]

const generalEvidence: EvidenceItem[] = [
  {
    id: "acuse-sat",
    label: "Acuse SAT",
    description: "Acuse SAT de presentación del aviso con sello digital.",
    mandatory: true,
  },
  {
    id: "folio-uif",
    label: "Folio UIF",
    description: "Folio de confirmación de recepción de la UIF.",
    mandatory: true,
  },
  {
    id: "dictamen-oficial",
    label: "Dictamen del Oficial",
    description: "Dictamen del Oficial de Cumplimiento con firma electrónica o digital.",
    mandatory: true,
  },
  {
    id: "reporte-interno",
    label: "Reporte interno",
    description: "Reporte interno que motivó el aviso (análisis de perfil transaccional).",
  },
]

const specificEvidence: Record<string, EvidenceItem[]> = {
  relevante: [
    {
      id: "contrato",
      label: "Contrato o factura",
      description: "Contrato, factura o comprobante que ampare la operación relevante.",
      mandatory: true,
    },
    {
      id: "estado-cuenta",
      label: "Estado de cuenta",
      description: "Estado de cuenta o comprobante bancario que demuestre la operación.",
    },
  ],
  inusual: [
    {
      id: "reporte-monitoreo",
      label: "Reporte de monitoreo",
      description: "Reporte de monitoreo que detectó la irregularidad.",
      mandatory: true,
    },
    {
      id: "analisis-perfil",
      label: "Análisis de perfil",
      description: "Evidencia de análisis del perfil económico del cliente vs. la operación.",
    },
  ],
  interna: [
    {
      id: "acta-investigacion",
      label: "Acta de investigación",
      description: "Acta interna de investigación o reporte del Comité de Comunicación y Control.",
      mandatory: true,
    },
    {
      id: "evidencia-personal",
      label: "Evidencia de participación",
      description: "Evidencia de participación o tolerancia de personal interno.",
    },
  ],
}

const timelineLabels = {
  detection: "Detección",
  preparation: "Preparación",
  submission: "Envío",
  acknowledgement: "Acuse recibido",
}

const operationTypeLabels: Record<OperationType, string> = {
  relevante: "Operación relevante",
  inusual: "Operación inusual",
  interna: "Operación interna preocupante",
}

type OperationType = "relevante" | "inusual" | "interna"

type NoticeFormState = {
  detectionDate: string
  detectionTime: string
  preparationDate: string
  preparationTime: string
  submissionDate: string
  submissionTime: string
  acknowledgementDate: string
  acknowledgementTime: string
  folio: string
  digitalSeal: string
}

const initialNoticeForm: NoticeFormState = {
  detectionDate: "",
  detectionTime: "",
  preparationDate: "",
  preparationTime: "",
  submissionDate: "",
  submissionTime: "",
  acknowledgementDate: "",
  acknowledgementTime: "",
  folio: "",
  digitalSeal: "",
}

const initialTraceability: TraceabilityEntry[] = [
  {
    id: "t1",
    action: "Aviso relevante presentado",
    user: "María Fernández",
    timestamp: new Date("2024-03-15T11:25:00"),
    details: "Aviso AR-2024-0315 enviado al SAT y acuse recibido.",
    noticeId: "AR-2024-0315",
  },
  {
    id: "t2",
    action: "Dictamen de operación inusual",
    user: "Oficial de Cumplimiento",
    timestamp: new Date("2024-04-02T09:10:00"),
    details: "Dictamen emitido para OI-2024-0402 previo a envío del aviso.",
    noticeId: "OI-2024-0402",
  },
  {
    id: "t3",
    action: "Carga de evidencia interna",
    user: "Carlos López",
    timestamp: new Date("2024-04-18T14:42:00"),
    details: "Acta de investigación por operación interna preocupante IP-2024-0418.",
    noticeId: "IP-2024-0418",
  },
]

const initialDocuments: DocumentUpload[] = [
  {
    id: "d1",
    name: "Acuse_AR-2024-0315.pdf",
    type: "Acuse SAT",
    uploadedBy: "María Fernández",
    uploadedAt: new Date("2024-03-15T11:30:00"),
    relatedNotice: "AR-2024-0315",
  },
  {
    id: "d2",
    name: "Dictamen_OI-2024-0402.pdf",
    type: "Dictamen Oficial",
    uploadedBy: "Oficial de Cumplimiento",
    uploadedAt: new Date("2024-04-02T09:12:00"),
    relatedNotice: "OI-2024-0402",
  },
  {
    id: "d3",
    name: "Reporte_Screening_OI-2024-0402.pdf",
    type: "Reporte de screening",
    uploadedBy: "María Fernández",
    uploadedAt: new Date("2024-04-02T09:20:00"),
    relatedNotice: "OI-2024-0402",
  },
]

const REGISTRO_STORAGE_KEY = "registro-sat-data"
const EXPEDIENTE_STORAGE_KEY = "kyc_expedientes_detalle"
const OPERACIONES_STORAGE_KEY = "actividades_vulnerables_operaciones"
const EBR_STORAGE_KEY = "ebr_evaluaciones"

export default function AvisosInformesPage() {
  const { toast } = useToast()
  const [selectedTab, setSelectedTab] = useState("aviso")
  const [selectedOperationType, setSelectedOperationType] = useState<OperationType>("relevante")
  const [noticeForm, setNoticeForm] = useState<NoticeFormState>(initialNoticeForm)
  const [checklistState, setChecklistState] = useState<Record<string, ChecklistState>>(() =>
    Object.fromEntries(checklistQuestions.map((question) => [question.id, { answer: null, notes: "" }])),
  )
  const [evidenceState, setEvidenceState] = useState<Record<string, boolean>>({})
  const [documentUploads, setDocumentUploads] = useState<DocumentUpload[]>(initialDocuments)
  const [traceabilityEntries, setTraceabilityEntries] = useState<TraceabilityEntry[]>(initialTraceability)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [sujetosRegistro, setSujetosRegistro] = useState<RegistroSujetoResumen[]>([])
  const [expedientesEui, setExpedientesEui] = useState<ExpedienteResumen[]>([])
  const [operaciones, setOperaciones] = useState<OperacionResumen[]>([])
  const [evaluacionesEbr, setEvaluacionesEbr] = useState<EvaluacionEbrResumen[]>([])
  const [selectedRfc, setSelectedRfc] = useState<string>("")
  const [selectedOperacionId, setSelectedOperacionId] = useState<string>("")

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const loadIntegrationData = useCallback(() => {
    if (typeof window === "undefined") return

    const registroRaw = window.localStorage.getItem(REGISTRO_STORAGE_KEY)
    if (registroRaw) {
      try {
        const parsed = JSON.parse(registroRaw) as Record<string, unknown>
        const sujetos = Array.isArray(parsed.sujetosRegistrados)
          ? parsed.sujetosRegistrados
              .map((item) => {
                if (!item || typeof item !== "object") return null
                const record = item as Record<string, unknown>
                const identificacion = (record.identificacion ?? {}) as Record<string, unknown>
                const representante = record.representante as Record<string, unknown> | null | undefined
                const nombreRepresentante = representante
                  ? [representante.nombre, representante.apellidoPaterno, representante.apellidoMaterno]
                      .filter((value) => typeof value === "string" && value.trim().length > 0)
                      .join(" ")
                  : null

                return {
                  id: typeof record.id === "string" ? record.id : crypto.randomUUID(),
                  nombre: typeof record.nombre === "string" ? record.nombre : "",
                  rfc: typeof identificacion.rfc === "string" ? identificacion.rfc : "",
                  tipo: typeof record.tipo === "string" ? record.tipo : "",
                  actividad: typeof record.actividad === "string" ? record.actividad : "",
                  creadoEn: record.creadoEn ? new Date(record.creadoEn as string) : new Date(),
                  registroCompleto: record.registroCompleto === true,
                  representante: nombreRepresentante,
                }
              })
              .filter((item): item is RegistroSujetoResumen => Boolean(item?.rfc))
          : []
        setSujetosRegistro(sujetos)
      } catch (error) {
        console.error("Error al leer alta y registro", error)
        setSujetosRegistro([])
      }
    } else {
      setSujetosRegistro([])
    }

    const expedientesRaw = window.localStorage.getItem(EXPEDIENTE_STORAGE_KEY)
    if (expedientesRaw) {
      try {
        const parsed = JSON.parse(expedientesRaw)
        const expedientes = Array.isArray(parsed)
          ? parsed
              .map((item) => {
                if (!item || typeof item !== "object") return null
                const record = item as Record<string, unknown>
                return {
                  rfc: typeof record.rfc === "string" ? record.rfc : "",
                  nombre: typeof record.nombre === "string" ? record.nombre : "",
                  tipoCliente: typeof record.tipoCliente === "string" ? record.tipoCliente : undefined,
                  actualizadoEn: typeof record.actualizadoEn === "string" ? record.actualizadoEn : undefined,
                }
              })
              .filter((item): item is ExpedienteResumen => Boolean(item?.rfc))
          : []
        setExpedientesEui(expedientes)
      } catch (error) {
        console.error("Error al leer expedientes", error)
        setExpedientesEui([])
      }
    } else {
      setExpedientesEui([])
    }

    const operacionesRaw = window.localStorage.getItem(OPERACIONES_STORAGE_KEY)
    if (operacionesRaw) {
      try {
        const parsed = JSON.parse(operacionesRaw)
        const operacionesParsed = Array.isArray(parsed)
          ? parsed
              .map((item) => {
                if (!item || typeof item !== "object") return null
                const record = item as Record<string, unknown>
                return {
                  id: typeof record.id === "string" ? record.id : crypto.randomUUID(),
                  rfc: typeof record.rfc === "string" ? record.rfc : "",
                  cliente: typeof record.cliente === "string" ? record.cliente : "",
                  actividadNombre: typeof record.actividadNombre === "string" ? record.actividadNombre : "",
                  tipoOperacion: typeof record.tipoOperacion === "string" ? record.tipoOperacion : "",
                  monto: typeof record.monto === "number" ? record.monto : 0,
                  fechaOperacion: typeof record.fechaOperacion === "string" ? record.fechaOperacion : "",
                  umbralStatus:
                    record.umbralStatus === "sin-obligacion" ||
                    record.umbralStatus === "identificacion" ||
                    record.umbralStatus === "aviso"
                      ? record.umbralStatus
                      : undefined,
                  alerta: typeof record.alerta === "string" ? record.alerta : null,
                  avisoPresentado: record.avisoPresentado === true,
                }
              })
              .filter((item): item is OperacionResumen => Boolean(item?.rfc))
          : []
        setOperaciones(operacionesParsed)
      } catch (error) {
        console.error("Error al leer operaciones", error)
        setOperaciones([])
      }
    } else {
      setOperaciones([])
    }

    const ebrRaw = window.localStorage.getItem(EBR_STORAGE_KEY)
    if (ebrRaw) {
      try {
        const parsed = JSON.parse(ebrRaw)
        const evaluaciones = Array.isArray(parsed)
          ? parsed
              .map((item) => {
                if (!item || typeof item !== "object") return null
                const record = item as Record<string, unknown>
                return {
                  rfc: typeof record.rfc === "string" ? record.rfc : "",
                  updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
                  notes: typeof record.notes === "string" ? record.notes : "",
                  riskQuestions: Array.isArray(record.riskQuestions)
                    ? (record.riskQuestions as EvaluacionEbrResumen["riskQuestions"])
                    : undefined,
                  clientProfile:
                    record.clientProfile && typeof record.clientProfile === "object"
                      ? (record.clientProfile as EvaluacionEbrResumen["clientProfile"])
                      : undefined,
                }
              })
              .filter((item): item is EvaluacionEbrResumen => Boolean(item?.rfc))
          : []
        setEvaluacionesEbr(evaluaciones)
      } catch (error) {
        console.error("Error al leer evaluaciones EBR", error)
        setEvaluacionesEbr([])
      }
    } else {
      setEvaluacionesEbr([])
    }
  }, [])

  useEffect(() => {
    loadIntegrationData()
  }, [loadIntegrationData])

  const totalChecklist = checklistQuestions.length
  const answeredChecklist = useMemo(
    () => Object.values(checklistState).filter((state) => state.answer !== null).length,
    [checklistState],
  )

  const sujetosDisponibles = useMemo(() => {
    const map = new Map<string, { rfc: string; nombre: string; fuente: string }>()

    sujetosRegistro.forEach((sujeto) => {
      if (!sujeto.rfc) return
      map.set(sujeto.rfc, { rfc: sujeto.rfc, nombre: sujeto.nombre, fuente: "Alta y registro" })
    })

    expedientesEui.forEach((expediente) => {
      if (!expediente.rfc) return
      if (!map.has(expediente.rfc)) {
        map.set(expediente.rfc, {
          rfc: expediente.rfc,
          nombre: expediente.nombre,
          fuente: "Expediente único",
        })
      }
    })

    operaciones.forEach((operacion) => {
      if (!operacion.rfc) return
      if (!map.has(operacion.rfc)) {
        map.set(operacion.rfc, {
          rfc: operacion.rfc,
          nombre: operacion.cliente || "Cliente sin nombre",
          fuente: "Actos y operaciones",
        })
      }
    })

    return Array.from(map.values())
  }, [expedientesEui, operaciones, sujetosRegistro])

  useEffect(() => {
    if (selectedRfc) return
    const primerRfc = sujetosDisponibles[0]?.rfc
    if (primerRfc) {
      setSelectedRfc(primerRfc)
    }
  }, [selectedRfc, sujetosDisponibles])

  const detectionDateTime = useMemo(() => buildDate(noticeForm.detectionDate, noticeForm.detectionTime), [
    noticeForm.detectionDate,
    noticeForm.detectionTime,
  ])
  const submissionDateTime = useMemo(() => buildDate(noticeForm.submissionDate, noticeForm.submissionTime), [
    noticeForm.submissionDate,
    noticeForm.submissionTime,
  ])

  const acknowledgementDateTime = useMemo(
    () => buildDate(noticeForm.acknowledgementDate, noticeForm.acknowledgementTime),
    [noticeForm.acknowledgementDate, noticeForm.acknowledgementTime],
  )

  const preparationDateTime = useMemo(() => buildDate(noticeForm.preparationDate, noticeForm.preparationTime), [
    noticeForm.preparationDate,
    noticeForm.preparationTime,
  ])

  const hoursSinceDetection = useMemo(() =>
    detectionDateTime ? (currentTime.getTime() - detectionDateTime.getTime()) / (1000 * 60 * 60) : null,
  [currentTime, detectionDateTime])

  const deadlineDateTime = useMemo(() => {
    if (!detectionDateTime) return null

    const deadlineHours = selectedOperationType === "inusual" ? 24 : 72
    return new Date(detectionDateTime.getTime() + deadlineHours * 60 * 60 * 1000)
  }, [detectionDateTime, selectedOperationType])

  const hoursUntilDeadline = useMemo(() =>
    deadlineDateTime ? (deadlineDateTime.getTime() - currentTime.getTime()) / (1000 * 60 * 60) : null,
  [currentTime, deadlineDateTime])

  const submissionWithinDeadline = useMemo(() => {
    if (!submissionDateTime || !deadlineDateTime) return null
    return submissionDateTime.getTime() <= deadlineDateTime.getTime()
  }, [deadlineDateTime, submissionDateTime])

  const folioAndSealValid = noticeForm.folio.trim().length > 0 && noticeForm.digitalSeal.trim().length > 0

  const requiredEvidence = useMemo(() => {
    const specifics = specificEvidence[selectedOperationType] ?? []
    return [...generalEvidence, ...specifics]
  }, [selectedOperationType])

  const operacionesFiltradas = useMemo(
    () => operaciones.filter((operacion) => (selectedRfc ? operacion.rfc === selectedRfc : true)),
    [operaciones, selectedRfc],
  )

  useEffect(() => {
    if (!operacionesFiltradas.length) {
      setSelectedOperacionId("")
      return
    }

    if (!operacionesFiltradas.some((operacion) => operacion.id === selectedOperacionId)) {
      setSelectedOperacionId(operacionesFiltradas[0].id)
    }
  }, [operacionesFiltradas, selectedOperacionId])

  const evaluacionSeleccionada = useMemo(() => {
    if (!selectedRfc) return null
    const evaluations = evaluacionesEbr.filter((item) => item.rfc === selectedRfc)
    if (evaluations.length === 0) return null
    return evaluations
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
  }, [evaluacionesEbr, selectedRfc])

  const sujetoRegistroSeleccionado = useMemo(
    () => sujetosRegistro.find((sujeto) => sujeto.rfc === selectedRfc) ?? null,
    [selectedRfc, sujetosRegistro],
  )

  const expedienteSeleccionado = useMemo(
    () => expedientesEui.find((expediente) => expediente.rfc === selectedRfc) ?? null,
    [expedientesEui, selectedRfc],
  )

  const operacionesStats = useMemo(() => {
    const total = operacionesFiltradas.length
    const avisos = operacionesFiltradas.filter((op) => op.umbralStatus === "aviso").length
    const alertas = operacionesFiltradas.filter((op) => op.alerta).length
    const pendientesAviso = operacionesFiltradas.filter((op) => op.umbralStatus === "aviso" && !op.avisoPresentado).length
    return { total, avisos, alertas, pendientesAviso }
  }, [operacionesFiltradas])

  const cumplimientoRegistro = useMemo(() => {
    if (!sujetoRegistroSeleccionado) return null
    return sujetoRegistroSeleccionado.registroCompleto
  }, [sujetoRegistroSeleccionado])

  const evidenceCompletion = useMemo(() => {
    const totalRequired = requiredEvidence.length
    const completed = requiredEvidence.filter((item) => evidenceState[item.id]).length
    return totalRequired > 0 ? Math.round((completed / totalRequired) * 100) : 0
  }, [evidenceState, requiredEvidence])

  const riskScore = useMemo(() => {
    if (!evaluacionSeleccionada?.riskQuestions) return null
    return evaluacionSeleccionada.riskQuestions.reduce((acc, question) => {
      const option = question.options.find((item) => item.value === question.selectedValue)
      return acc + (option?.score ?? 0)
    }, 0)
  }, [evaluacionSeleccionada])

  const riskLevel = useMemo(() => {
    if (riskScore === null) return null
    if (riskScore <= 12) return "Bajo"
    if (riskScore <= 20) return "Medio"
    return "Alto"
  }, [riskScore])

  const alerts = useMemo(() => {
    const items: { type: "warning" | "danger" | "info"; title: string; description: string }[] = []

    if (selectedOperationType === "inusual" && hoursSinceDetection !== null) {
      if (hoursSinceDetection >= 24) {
        items.push({
          type: "danger",
          title: "Plazo de 24 horas excedido",
          description: "La operación inusual supera el plazo máximo legal. Priorizar regularización.",
        })
      } else if (hoursSinceDetection >= 20) {
        items.push({
          type: "warning",
          title: "Plazo próximo a vencer",
          description: "Han transcurrido más de 20 horas desde la detección. Enviar el aviso antes de 24 horas.",
        })
      }
    }

    if (hoursUntilDeadline !== null) {
      if (hoursUntilDeadline < 0) {
        items.push({
          type: "danger",
          title: "Aviso fuera de plazo",
          description: "El aviso se encuentra fuera del plazo legal calculado para este tipo de operación.",
        })
      } else if (hoursUntilDeadline <= 6) {
        items.push({
          type: "warning",
          title: "Aviso próximo al vencimiento",
          description: "Restan menos de 6 horas para el vencimiento del plazo legal.",
        })
      }
    }

    if (!folioAndSealValid) {
      items.push({
        type: "warning",
        title: "Validación de folio o sello pendiente",
        description: "Carga el folio UIF y el sello digital del acuse SAT para completar el registro.",
      })
    }

    if (!acknowledgementDateTime) {
      items.push({
        type: "info",
        title: "Confirmación UIF pendiente",
        description: "Registra la fecha y hora del acuse de recepción para cerrar el ciclo del aviso.",
      })
    }

    return items
  }, [acknowledgementDateTime, folioAndSealValid, hoursSinceDetection, hoursUntilDeadline, selectedOperationType])

  const timeline = useMemo(() => {
    const entries: { key: keyof NoticeFormState; label: string; date?: Date }[] = [
      { key: "detectionDate", label: timelineLabels.detection, date: detectionDateTime ?? undefined },
      { key: "preparationDate", label: timelineLabels.preparation, date: preparationDateTime ?? undefined },
      { key: "submissionDate", label: timelineLabels.submission, date: submissionDateTime ?? undefined },
      { key: "acknowledgementDate", label: timelineLabels.acknowledgement, date: acknowledgementDateTime ?? undefined },
    ]

    return entries
  }, [acknowledgementDateTime, detectionDateTime, preparationDateTime, submissionDateTime])

  const bitacoraUsuarios = useMemo(
    () =>
      traceabilityEntries
        .slice()
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .map((entry) => ({
          ...entry,
          formattedDate: formatDate(entry.timestamp),
        })),
    [traceabilityEntries],
  )

  const handleChecklistAnswer = (questionId: string, answer: "si" | "no" | "no-aplica") => {
    setChecklistState((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        answer,
      },
    }))
  }

  const handleChecklistNotes = (questionId: string, notes: string) => {
    setChecklistState((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        notes,
      },
    }))
  }

  const handleEvidenceToggle = (id: string, value: boolean) => {
    setEvidenceState((prev) => ({
      ...prev,
      [id]: value,
    }))
  }

  const handleNoticeFormChange = (field: keyof NoticeFormState, value: string) => {
    setNoticeForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>, type: string) => {
    const file = event.target.files?.[0]
    if (!file) return

    const newDocument: DocumentUpload = {
      id: `doc-${Date.now()}`,
      name: file.name,
      type,
      uploadedBy: "Usuario actual",
      uploadedAt: new Date(),
      relatedNotice: operationTypeLabels[selectedOperationType],
    }

    setDocumentUploads((prev) => [newDocument, ...prev])
    setTraceabilityEntries((prev) => [
      {
        id: `trace-${Date.now()}`,
        action: `Carga de ${type.toLowerCase()}`,
        user: "Usuario actual",
        timestamp: new Date(),
        details: `${file.name} asociado a ${operationTypeLabels[selectedOperationType]}.`,
        noticeId: operationTypeLabels[selectedOperationType],
      },
      ...prev,
    ])

    toast({
      title: "Documento cargado",
      description: `${file.name} se registró correctamente en la bitácora de evidencias.`,
    })
  }

  const downloadReport = (fileName: string, content: string, mimeType = "text/csv") => {
    const blob = new Blob([content], { type: mimeType })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = fileName
    link.click()
    window.URL.revokeObjectURL(url)
  }

  const handleDownloadConsolidated = () => {
    const rows = [
      ["RFC", "Cliente", "Tipo cliente", "Registro completo", "Operaciones", "Alertas", "Avisos pendientes", "Riesgo EBR"],
      ...sujetosDisponibles.map((sujeto) => {
        const ops = operaciones.filter((op) => op.rfc === sujeto.rfc)
        const alertas = ops.filter((op) => op.alerta).length
        const pendientes = ops.filter((op) => op.umbralStatus === "aviso" && !op.avisoPresentado).length
        const registro = sujetosRegistro.find((item) => item.rfc === sujeto.rfc)
        const expediente = expedientesEui.find((item) => item.rfc === sujeto.rfc)
        const ebr = evaluacionesEbr
          .filter((item) => item.rfc === sujeto.rfc)
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
        const score = ebr?.riskQuestions
          ? ebr.riskQuestions.reduce((acc, question) => {
              const option = question.options.find((item) => item.value === question.selectedValue)
              return acc + (option?.score ?? 0)
            }, 0)
          : null

        return [
          sujeto.rfc,
          sujeto.nombre,
          registro?.tipo ?? expediente?.tipoCliente ?? "",
          registro?.registroCompleto ? "Sí" : "No",
          String(ops.length),
          String(alertas),
          String(pendientes),
          score === null ? "Sin evaluación" : `${score}`,
        ]
      }),
    ]

    const content = rows.map((row) => row.map((value) => `"${value}"`).join(",")).join("\n")
    downloadReport(`reporte-consolidado-avisos-${new Date().toISOString().slice(0, 10)}.csv`, content)
    toast({ title: "Reporte generado", description: "Se descargó el reporte consolidado de avisos y operaciones." })
  }

  const handleDownloadOperacionesAviso = () => {
    const rows = [
      ["RFC", "Cliente", "Actividad", "Tipo operación", "Monto", "Fecha", "Umbral", "Alerta"],
      ...operaciones
        .filter((op) => op.umbralStatus === "aviso")
        .map((op) => [
          op.rfc,
          op.cliente,
          op.actividadNombre,
          op.tipoOperacion,
          formatCurrency(op.monto),
          op.fechaOperacion,
          op.umbralStatus ?? "",
          op.alerta ?? "",
        ]),
    ]

    const content = rows.map((row) => row.map((value) => `"${value}"`).join(",")).join("\n")
    downloadReport(`reporte-operaciones-aviso-${new Date().toISOString().slice(0, 10)}.csv`, content)
    toast({ title: "Reporte generado", description: "Se descargó el reporte de operaciones con obligación de aviso." })
  }

  const handleDownloadBitacora = () => {
    const rows = [
      ["Acción", "Usuario", "Fecha", "Detalle", "Aviso"],
      ...traceabilityEntries.map((entry) => [
        entry.action,
        entry.user,
        formatDate(entry.timestamp),
        entry.details,
        entry.noticeId,
      ]),
    ]

    const content = rows.map((row) => row.map((value) => `"${value}"`).join(",")).join("\n")
    downloadReport(`bitacora-avisos-${new Date().toISOString().slice(0, 10)}.csv`, content)
    toast({ title: "Bitácora exportada", description: "Se descargó la bitácora completa de avisos." })
  }

  const handlePrefillFromOperacion = () => {
    const operacion = operacionesFiltradas.find((item) => item.id === selectedOperacionId)
    if (!operacion) return

    const tipo = mapOperationToNoticeType(operacion)
    const fechaOperacion = parseLocalDate(operacion.fechaOperacion)

    setSelectedOperationType(tipo)
    if (fechaOperacion) {
      setNoticeForm((prev) => ({
        ...prev,
        detectionDate: toDateInput(fechaOperacion),
        detectionTime: toTimeInput(fechaOperacion),
      }))
    }
    setSelectedTab("aviso")

    setTraceabilityEntries((prev) => [
      {
        id: `prefill-${Date.now()}`,
        action: "Aviso precargado desde operación",
        user: "Usuario actual",
        timestamp: new Date(),
        details: `Se generó aviso desde la operación ${operacion.tipoOperacion} (${operacion.id}).`,
        noticeId: operationTypeLabels[tipo],
      },
      ...prev,
    ])

    toast({
      title: "Aviso precargado",
      description: `Se sincronizó la operación para iniciar el aviso ${operationTypeLabels[tipo].toLowerCase()}.`,
    })
  }

  const resetNoticeForm = () => {
    setNoticeForm(initialNoticeForm)
    setEvidenceState({})
    toast({
      title: "Formulario reiniciado",
      description: "Se limpió la información del aviso para registrar un nuevo caso.",
    })
  }

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-10 w-10 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Avisos e informes</h1>
          <p className="text-muted-foreground">
            Gestión integral de avisos relevantes, inusuales e internos preocupantes ante la UIF a través del Portal SAT.
          </p>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="integraciones" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Integraciones
          </TabsTrigger>
          <TabsTrigger value="reportes" className="flex items-center gap-2">
            <FileUp className="h-4 w-4" /> Reportes
          </TabsTrigger>
          <TabsTrigger value="aviso" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" /> Aviso
          </TabsTrigger>
          <TabsTrigger value="trazabilidad" className="flex items-center gap-2">
            <History className="h-4 w-4" /> Trazabilidad
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integraciones" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Vinculación con otros módulos</CardTitle>
              <CardDescription>
                Sincroniza datos reales de Alta y registro, Expediente único, Actos y operaciones y EBR para preparar avisos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Cliente / RFC en seguimiento</p>
                    <p className="text-xs text-muted-foreground">
                      Selecciona un RFC y revisa expediente, operaciones y riesgo.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => {
                      loadIntegrationData()
                      toast({
                        title: "Datos actualizados",
                        description: "Se recargó la información desde los demás módulos.",
                      })
                    }}
                  >
                    <RefreshCcw className="h-4 w-4" /> Actualizar datos
                  </Button>
                </div>
              </div>

              {sujetosDisponibles.length === 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>No hay datos vinculados</AlertTitle>
                  <AlertDescription>
                    Carga información en Alta y registro, Expediente único o Actos y operaciones para habilitar la sincronización.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cliente-rfc">Selecciona un cliente</Label>
                  <Select value={selectedRfc} onValueChange={setSelectedRfc}>
                    <SelectTrigger id="cliente-rfc">
                      <SelectValue placeholder="Selecciona un RFC" />
                    </SelectTrigger>
                    <SelectContent>
                      {sujetosDisponibles.map((sujeto) => (
                        <SelectItem key={sujeto.rfc} value={sujeto.rfc}>
                          {sujeto.rfc} · {sujeto.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 rounded-lg border p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Sujeto en Alta y registro</span>
                    <Badge variant={cumplimientoRegistro ? "default" : "outline"}>
                      {cumplimientoRegistro ? "Registro completo" : "Pendiente"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Expediente único</span>
                    <Badge variant={expedienteSeleccionado ? "default" : "outline"}>
                      {expedienteSeleccionado ? "Disponible" : "Sin expediente"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Operaciones registradas</span>
                    <span className="font-semibold">{operacionesStats.total}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Alertas activas</span>
                    <span className="font-semibold">{operacionesStats.alertas}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  <CardTitle>Alta y registro</CardTitle>
                </div>
                <CardDescription>Datos base del sujeto obligado y estatus documental.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sujetoRegistroSeleccionado ? (
                  <div className="space-y-3 rounded-lg border p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{sujetoRegistroSeleccionado.nombre}</span>
                      <Badge variant={sujetoRegistroSeleccionado.registroCompleto ? "default" : "outline"}>
                        {sujetoRegistroSeleccionado.registroCompleto ? "Completo" : "En progreso"}
                      </Badge>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">RFC</p>
                        <p>{sujetoRegistroSeleccionado.rfc}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Tipo de sujeto</p>
                        <p className="capitalize">{sujetoRegistroSeleccionado.tipo}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Actividad vulnerable</p>
                        <p>{sujetoRegistroSeleccionado.actividad || "Sin actividad"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Fecha de alta</p>
                        <p>{formatDate(sujetoRegistroSeleccionado.creadoEn)}</p>
                      </div>
                    </div>
                    {sujetoRegistroSeleccionado.representante && (
                      <p className="text-xs text-muted-foreground">
                        Representante: {sujetoRegistroSeleccionado.representante}
                      </p>
                    )}
                  </div>
                ) : (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Sin datos de alta</AlertTitle>
                    <AlertDescription>
                      No se encontró registro en Alta y registro para este RFC.
                    </AlertDescription>
                  </Alert>
                )}
                <Button asChild variant="outline" className="w-full justify-center gap-2">
                  <Link href="/registro-sat">
                    <Database className="h-4 w-4" /> Ir a Alta y registro
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <CardTitle>Expediente único de identificación</CardTitle>
                </div>
                <CardDescription>Último expediente disponible y fecha de actualización.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {expedienteSeleccionado ? (
                  <div className="space-y-3 rounded-lg border p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{expedienteSeleccionado.nombre}</span>
                      <Badge variant="outline">{expedienteSeleccionado.tipoCliente ?? "Sin tipo"}</Badge>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">RFC</p>
                        <p>{expedienteSeleccionado.rfc}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Actualizado en</p>
                        <p>{expedienteSeleccionado.actualizadoEn ? formatDate(new Date(expedienteSeleccionado.actualizadoEn)) : "Sin fecha"}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Expediente pendiente</AlertTitle>
                    <AlertDescription>
                      El expediente único no se encuentra disponible para este RFC.
                    </AlertDescription>
                  </Alert>
                )}
                <Button asChild variant="outline" className="w-full justify-center gap-2">
                  <Link href="/kyc-expediente">
                    <FileText className="h-4 w-4" /> Ir a Expediente único
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  <CardTitle>Actos y operaciones</CardTitle>
                </div>
                <CardDescription>Operaciones con umbrales y alertas para activar avisos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 rounded-lg border p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Operaciones con aviso</span>
                    <span className="font-semibold">{operacionesStats.avisos}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Avisos pendientes</span>
                    <span className="font-semibold">{operacionesStats.pendientesAviso}</span>
                  </div>
                </div>

                {operacionesFiltradas.length > 0 ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="operacion-select">Selecciona operación</Label>
                      <Select value={selectedOperacionId} onValueChange={setSelectedOperacionId}>
                        <SelectTrigger id="operacion-select">
                          <SelectValue placeholder="Selecciona operación" />
                        </SelectTrigger>
                        <SelectContent>
                          {operacionesFiltradas.map((operacion) => (
                            <SelectItem key={operacion.id} value={operacion.id}>
                              {operacion.tipoOperacion} · {formatCurrency(operacion.monto)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      {operacionesFiltradas.slice(0, 3).map((operacion) => (
                        <div key={operacion.id} className="rounded-md border p-3 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{operacion.tipoOperacion}</span>
                            <Badge variant={operacion.umbralStatus === "aviso" ? "destructive" : "outline"}>
                              {operacion.umbralStatus ?? "Sin umbral"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{operacion.actividadNombre}</p>
                          <div className="mt-2 flex items-center justify-between text-xs">
                            <span>{formatCurrency(operacion.monto)}</span>
                            <span>{operacion.fechaOperacion}</span>
                          </div>
                          {operacion.alerta && (
                            <p className="mt-2 text-xs text-amber-600">Alerta: {operacion.alerta}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Sin operaciones vinculadas</AlertTitle>
                    <AlertDescription>
                      Registra operaciones en el módulo de Actos y operaciones para habilitar avisos automáticos.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="default" className="w-full gap-2" onClick={handlePrefillFromOperacion}>
                    <BellRing className="h-4 w-4" /> Generar aviso
                  </Button>
                  <Button asChild variant="outline" className="w-full gap-2">
                    <Link href="/actividades-vulnerables">
                      <Activity className="h-4 w-4" /> Ir a Actos y operaciones
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle>Evaluación Basada en Riesgo (EBR)</CardTitle>
                </div>
                <CardDescription>Consulta el último nivel de riesgo registrado.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {evaluacionSeleccionada ? (
                  <div className="space-y-3 rounded-lg border p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Riesgo {riskLevel ?? ""}</span>
                      <Badge variant={riskLevel === "Alto" ? "destructive" : riskLevel === "Medio" ? "secondary" : "outline"}>
                        {riskScore ?? "Sin score"}
                      </Badge>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Última actualización</p>
                        <p>{evaluacionSeleccionada.updatedAt ? formatDate(new Date(evaluacionSeleccionada.updatedAt)) : "Sin fecha"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Sector económico</p>
                        <p className="capitalize">{evaluacionSeleccionada.clientProfile?.sectorEconomico ?? "Sin definir"}</p>
                      </div>
                    </div>
                    {evaluacionSeleccionada.notes && (
                      <p className="text-xs text-muted-foreground">Notas: {evaluacionSeleccionada.notes}</p>
                    )}
                  </div>
                ) : (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>EBR pendiente</AlertTitle>
                    <AlertDescription>
                      Realiza la evaluación EBR para este RFC y obtén el nivel de riesgo integrado.
                    </AlertDescription>
                  </Alert>
                )}
                <Button asChild variant="outline" className="w-full justify-center gap-2">
                  <Link href="/ebr">
                    <Shield className="h-4 w-4" /> Ir a evaluación EBR
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reportes" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Reportes consolidados</CardTitle>
                <CardDescription>
                  Exporta información cruzada entre módulos para auditorías o revisiones regulatorias.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start gap-2" onClick={handleDownloadConsolidated}>
                  <Download className="h-4 w-4" /> Reporte consolidado por cliente
                </Button>
                <Button variant="secondary" className="w-full justify-start gap-2" onClick={handleDownloadOperacionesAviso}>
                  <Download className="h-4 w-4" /> Operaciones con obligación de aviso
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2" onClick={handleDownloadBitacora}>
                  <Download className="h-4 w-4" /> Bitácora completa de avisos
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Indicadores de cumplimiento</CardTitle>
                <CardDescription>
                  Supervisa elementos críticos antes de presentar un aviso.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 rounded-lg border p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Clientes con registro completo</span>
                    <span className="font-semibold">
                      {sujetosRegistro.filter((sujeto) => sujeto.registroCompleto).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Clientes con expediente actualizado</span>
                    <span className="font-semibold">{expedientesEui.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Operaciones con alerta</span>
                    <span className="font-semibold">{operaciones.filter((op) => op.alerta).length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Evaluaciones EBR capturadas</span>
                    <span className="font-semibold">{evaluacionesEbr.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="aviso" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Tipo de aviso</CardTitle>
                <CardDescription>
                  Selecciona el tipo de aviso y valida el avance operativo antes de enviar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  {Object.entries(operationTypeLabels).map(([key, label]) => (
                    <div
                      key={key}
                      className={`rounded-lg border p-4 transition ${
                        selectedOperationType === key ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{label}</span>
                        <Badge variant={selectedOperationType === key ? "default" : "outline"}>
                          {selectedOperationType === key ? "Seleccionado" : "Disponible"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {key === "relevante" && "Avisos por operaciones que superan los umbrales establecidos por la normativa."}
                        {key === "inusual" && "Reportes de operaciones que se apartan del perfil transaccional del cliente."}
                        {key === "interna" && "Alertas por operaciones detectadas en personal interno o sistemas."}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Avance del checklist</CardTitle>
                      <CardDescription>
                        {answeredChecklist} de {totalChecklist} preguntas respondidas.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Progress value={(answeredChecklist / totalChecklist) * 100} className="h-2" />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Evidencias registradas</CardTitle>
                      <CardDescription>
                        {evidenceCompletion}% de evidencias requeridas completadas para la operación actual.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Progress value={evidenceCompletion} className="h-2" />
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {alerts.map((alert, index) => (
                <Alert
                  key={`${alert.title}-${index}`}
                  variant={alert.type === "danger" ? "destructive" : "default"}
                  className={alert.type === "warning" ? "border-amber-300 bg-amber-50" : undefined}
                >
                  {alert.type === "danger" && <AlertCircle className="h-4 w-4" />}
                  {alert.type === "warning" && <AlertTriangle className="h-4 w-4" />}
                  {alert.type === "info" && <Clock className="h-4 w-4" />}
                  <AlertTitle>{alert.title}</AlertTitle>
                  <AlertDescription>{alert.description}</AlertDescription>
                </Alert>
              ))}

              {alerts.length === 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Sin alertas críticas</AlertTitle>
                  <AlertDescription>
                    No hay vencimientos próximos ni validaciones pendientes para los datos registrados.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Formulario operativo de aviso</CardTitle>
              <CardDescription>
                Completa fechas, folios y evidencia clave para enviar el aviso sin campos redundantes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tipo-operacion">Tipo de operación</Label>
                  <Select
                    value={selectedOperationType}
                    onValueChange={(value: OperationType) => {
                      setSelectedOperationType(value)
                      setEvidenceState({})
                      toast({
                        title: "Tipo de operación actualizado",
                        description: `${operationTypeLabels[value]} seleccionado. Verifica las evidencias requeridas.`,
                      })
                    }}
                  >
                    <SelectTrigger id="tipo-operacion">
                      <SelectValue placeholder="Selecciona tipo de operación" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevante">Operación relevante</SelectItem>
                      <SelectItem value="inusual">Operación inusual</SelectItem>
                      <SelectItem value="interna">Operación interna preocupante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="folio">Folio UIF</Label>
                  <Input
                    id="folio"
                    value={noticeForm.folio}
                    placeholder="Ej. OI-2024-0402"
                    onChange={(event) => handleNoticeFormChange("folio", event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Registra el folio asignado por la UIF. Campo obligatorio para validar el aviso.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sello-digital">Sello digital del acuse SAT</Label>
                  <Textarea
                    id="sello-digital"
                    value={noticeForm.digitalSeal}
                    placeholder="Pega aquí el sello digital emitido por el SAT"
                    rows={3}
                    onChange={(event) => handleNoticeFormChange("digitalSeal", event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    La validación automática confirmará que el aviso cuenta con folio y sello digital cargados.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deteccion">Fecha y hora de detección</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      id="deteccion"
                      type="date"
                      value={noticeForm.detectionDate}
                      onChange={(event) => handleNoticeFormChange("detectionDate", event.target.value)}
                    />
                    <Input
                      type="time"
                      value={noticeForm.detectionTime}
                      onChange={(event) => handleNoticeFormChange("detectionTime", event.target.value)}
                    />
                  </div>
                  {selectedOperationType === "inusual" && hoursSinceDetection !== null && (
                    <p className="text-xs text-muted-foreground">
                      Han transcurrido <span className="font-semibold">{hoursSinceDetection.toFixed(1)} horas</span> desde la
                      detección.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <BellRing className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">Validación automática de plazos</h3>
                  </div>
                  <div className="grid gap-3 text-sm">
                    <DateTimeField
                      label="Fecha y hora de preparación"
                      dateValue={noticeForm.preparationDate}
                      timeValue={noticeForm.preparationTime}
                      onDateChange={(value) => handleNoticeFormChange("preparationDate", value)}
                      onTimeChange={(value) => handleNoticeFormChange("preparationTime", value)}
                    />
                    <DateTimeField
                      label="Fecha y hora de envío"
                      dateValue={noticeForm.submissionDate}
                      timeValue={noticeForm.submissionTime}
                      onDateChange={(value) => handleNoticeFormChange("submissionDate", value)}
                      onTimeChange={(value) => handleNoticeFormChange("submissionTime", value)}
                    />
                    <DateTimeField
                      label="Fecha y hora de acuse"
                      dateValue={noticeForm.acknowledgementDate}
                      timeValue={noticeForm.acknowledgementTime}
                      onDateChange={(value) => handleNoticeFormChange("acknowledgementDate", value)}
                      onTimeChange={(value) => handleNoticeFormChange("acknowledgementTime", value)}
                    />
                  </div>
                  <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                    {deadlineDateTime ? (
                      <>
                        Plazo legal estimado: <strong>{formatDate(deadlineDateTime)}</strong>.
                        {submissionWithinDeadline !== null && (
                          <span className="ml-1">
                            {submissionWithinDeadline ? (
                              <span className="text-green-600"> Aviso enviado dentro del plazo legal.</span>
                            ) : (
                              <span className="text-red-600"> Aviso fuera del plazo legal.</span>
                            )}
                          </span>
                        )}
                        {hoursUntilDeadline !== null && hoursUntilDeadline > 0 && (
                          <span className="ml-1">
                            Restan {hoursUntilDeadline.toFixed(1)} horas para el vencimiento.
                          </span>
                        )}
                      </>
                    ) : (
                      "Registra la fecha y hora de detección para calcular automáticamente los plazos." )}
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">Evidencias obligatorias</h3>
                  </div>
                  <div className="space-y-3">
                    {requiredEvidence.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 rounded-md border p-3">
                        <Checkbox
                          id={item.id}
                          checked={!!evidenceState[item.id]}
                          onCheckedChange={(checked) => handleEvidenceToggle(item.id, Boolean(checked))}
                        />
                        <div>
                          <Label htmlFor={item.id} className="font-medium">
                            {item.label}
                          </Label>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                          {item.mandatory && <Badge className="mt-1">Obligatorio</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <UploadField label="Acuse SAT" onChange={(event) => handleFileUpload(event, "Acuse SAT")} />
                <UploadField label="Dictamen del Oficial" onChange={(event) => handleFileUpload(event, "Dictamen Oficial")} />
                <UploadField label="Comprobantes bancarios" onChange={(event) => handleFileUpload(event, "Comprobante bancario")} />
                <UploadField label="Reporte de screening" onChange={(event) => handleFileUpload(event, "Reporte de screening")} />
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Documentos registrados</h3>
                </div>
                <div className="space-y-3 text-sm">
                  {documentUploads.map((doc) => (
                    <div key={doc.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">{doc.type}</p>
                        </div>
                        <Badge variant="outline">{doc.relatedNotice}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Cargado por {doc.uploadedBy} el {formatDate(doc.uploadedAt)}.
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <Alert className={folioAndSealValid ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}>
                {folioAndSealValid ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertTriangle className="h-4 w-4" />}
                <AlertTitle>Validación de folio y sello digital</AlertTitle>
                <AlertDescription>
                  {folioAndSealValid
                    ? "El aviso cuenta con folio UIF y sello digital registrado."
                    : "Agrega el folio UIF y pega el sello digital del acuse SAT para completar la validación."}
                </AlertDescription>
              </Alert>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <History className="h-4 w-4" />
                  <span>La bitácora registrará cada actualización con sello de tiempo y usuario responsable.</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetNoticeForm}>
                    Reiniciar formulario
                  </Button>
                  <Button
                    onClick={() => {
                      toast({
                        title: "Aviso guardado",
                        description: "Se registró el avance del aviso y se actualizó la trazabilidad.",
                      })
                      setTraceabilityEntries((prev) => [
                        {
                          id: `save-${Date.now()}`,
                          action: `Actualización de ${operationTypeLabels[selectedOperationType].toLowerCase()}`,
                          user: "Usuario actual",
                          timestamp: new Date(),
                          details: `Se guardaron fechas y validaciones del aviso con folio ${noticeForm.folio || "pendiente"}.`,
                          noticeId: operationTypeLabels[selectedOperationType],
                        },
                        ...prev,
                      ])
                    }}
                  >
                    Guardar avance
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklist mínimo</CardTitle>
              <CardDescription>
                Responde únicamente los controles normativos clave para completar el envío.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {checklistQuestions.map((question) => {
                const state = checklistState[question.id]
                return (
                  <div key={question.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Badge variant="outline">Sección {question.section}</Badge>
                        <h3 className="mt-2 text-base font-semibold">{question.question}</h3>
                        <p className="text-sm text-muted-foreground">
                          Evidencia sugerida: {state.answer === "si" ? question.evidenceYes : question.evidenceNo}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {[
                          ["si", "Sí"],
                          ["no", "No"],
                          ["no-aplica", "No aplica"],
                        ].map(([value, label]) => (
                          <Button
                            key={value}
                            variant={state.answer === value ? "default" : "outline"}
                            onClick={() => handleChecklistAnswer(question.id, value as ChecklistState["answer"])}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <Label htmlFor={`notes-${question.id}`}>Notas o evidencia vinculada</Label>
                      <Textarea
                        id={`notes-${question.id}`}
                        value={state.notes}
                        onChange={(event) => handleChecklistNotes(question.id, event.target.value)}
                        placeholder="Describe la evidencia cargada, folios o justificaciones correspondientes."
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="trazabilidad" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Registro cronológico del aviso</CardTitle>
              <CardDescription>
                Visualiza fechas clave desde la detección hasta el acuse de recepción.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  {timeline.map((entry, index) => (
                    <div key={entry.key} className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-background">
                        <span className="text-sm font-semibold">{index + 1}</span>
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium">{entry.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {entry.date ? formatDate(entry.date) : "Sin registrar"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <BellRing className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">Alertas automáticas</h3>
                  </div>
                  <ul className="mt-3 space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <AlertTriangle className="mt-1 h-4 w-4 text-amber-500" />
                      <span>Recordatorios para avisos que restan menos de 6 horas para su vencimiento legal.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Clock className="mt-1 h-4 w-4 text-primary" />
                      <span>Seguimiento de tiempo transcurrido desde la detección de operaciones inusuales.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="mt-1 h-4 w-4 text-green-500" />
                      <span>Confirmación automática cuando se registra folio UIF y acuse SAT.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">Bitácora de usuarios internos</h3>
                </div>
                <div className="mt-3 space-y-3 text-sm">
                  {bitacoraUsuarios.map((entry) => (
                    <div key={entry.id} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{entry.user}</span>
                        <Badge variant="outline">{entry.noticeId}</Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">{entry.action}</p>
                      <p className="text-xs text-muted-foreground">{entry.formattedDate}</p>
                      <p className="mt-2 text-xs">{entry.details}</p>
                    </div>
                  ))}
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function buildDate(date?: string, time?: string) {
  if (!date || !time) return null
  const combined = new Date(`${date}T${time}`)
  return Number.isNaN(combined.getTime()) ? null : combined
}

function parseLocalDate(raw: string) {
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function toDateInput(date: Date) {
  return date.toISOString().split("T")[0]
}

function toTimeInput(date: Date) {
  return date.toTimeString().slice(0, 5)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(value)
}

function mapOperationToNoticeType(operacion: OperacionResumen): OperationType {
  const tipoOperacion = operacion.tipoOperacion.toLowerCase()
  if (tipoOperacion.includes("inusual")) return "inusual"
  if (tipoOperacion.includes("interna")) return "interna"
  if (operacion.umbralStatus === "aviso") return "relevante"
  return "relevante"
}

function formatDate(date: Date) {
  return date.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

type DateTimeFieldProps = {
  label: string
  dateValue: string
  timeValue: string
  onDateChange: (value: string) => void
  onTimeChange: (value: string) => void
}

function DateTimeField({ label, dateValue, timeValue, onDateChange, onTimeChange }: DateTimeFieldProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input type="date" value={dateValue} onChange={(event) => onDateChange(event.target.value)} />
        <Input type="time" value={timeValue} onChange={(event) => onTimeChange(event.target.value)} />
      </div>
    </div>
  )
}

type UploadFieldProps = {
  label: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

function UploadField({ label, onChange }: UploadFieldProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="file" onChange={onChange} />
      <p className="text-xs text-muted-foreground">
        Sube el documento correspondiente en formato PDF o imagen y quedará registrado en la bitácora.
      </p>
    </div>
  )
}
