"use client"

import { useEffect, useMemo, useState } from "react"
import { jsPDF } from "jspdf"
import * as XLSX from "xlsx"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Archive,
  BellRing,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileText,
  GraduationCap,
  History,
  Info,
  Layers,
  Link2,
  Lock,
  Mail,
  Pen,
  Plus,
  ShieldCheck,
  Upload,
  Users,
  X,
} from "lucide-react"
import * as DialogPrimitive from "@radix-ui/react-dialog"

type AnswerValue = "si" | "no" | "no-aplica"

interface GovernanceQuestion {
  id: string
  submodule: "oficial" | "manuales" | "comite"
  category: string
  question: string
  legalReference: string
  helperText?: string
  answer: AnswerValue | null
  notes?: string
  actionPlan?: string
  evidenceHints: string[]
  relatedDocuments: string[]
  required: boolean
}

interface DocumentRecord {
  id: string
  relatedQuestionId: string
  name: string
  documentType: string
  fileName: string
  mimeType: string
  size: number
  uploadDate: string
  issueDate: string
  expiryDate?: string
  retentionUntil: string
  status: "vigente" | "por-vencer" | "vencido"
  hash: string
  base64: string
  relatedModules: string[]
  notes?: string
  signedBy?: string
  signedAt?: string
}

interface TraceEntry {
  id: string
  action: string
  section: string
  timestamp: string
  user: string
  details?: string
}

interface ManualVersion {
  id: string
  version: number
  folio: string
  uploadedAt: string
  documentId: string
  summary: string
}

interface CommitteeSession {
  id: string
  sessionNumber: string
  sessionDate: string
  attendees: string[]
  agreements: { agreement: string; responsible: string; deadline: string; status: "pendiente" | "en-proceso" | "cerrado" }[]
  notes?: string
  documentId?: string
}

interface AlertSetting {
  id: string
  title: string
  description: string
  targetDate: string
  responsible: string
  channelEmail: boolean
  channelInApp: boolean
  lastReminder?: string
}

interface IntegrationSnapshot {
  capacitacionDocuments: number
  auditoriaHallazgos: number
  monitoreoAlertas: number
  evidenciasResguardadas: number
}

const STORAGE_KEY = "gobernanza-control-data"

const allowedExtensions = ["pdf", "jpg", "jpeg", "xml"]

const requiresIssueWithin12Months = new Set([
  "oficial-capacitacion-1",
  "oficial-capacitacion-2",
])

const defaultAlerts: AlertSetting[] = [
  {
    id: "alert-capacitacion",
    title: "Renovación anual de capacitación del Oficial",
    description: "Recordatorio automático para renovar y cargar la constancia de capacitación (art. 39 RCG).",
    targetDate: new Date(new Date().getFullYear(), 11, 15).toISOString(),
    responsible: "Área de Cumplimiento",
    channelEmail: true,
    channelInApp: true,
  },
  {
    id: "alert-certificado",
    title: "Vencimiento de certificado CNBV",
    description: "Supervisa la vigencia del certificado del Oficial (renovación cada 3 años).",
    targetDate: new Date(new Date().getFullYear() + 1, 5, 30).toISOString(),
    responsible: "Oficial de Cumplimiento",
    channelEmail: true,
    channelInApp: true,
  },
  {
    id: "alert-manual",
    title: "Actualización anual del manual",
    description: "Verifica revisión y aprobación de políticas conforme a reformas vigentes.",
    targetDate: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 45).toISOString(),
    responsible: "Comité de Comunicación y Control",
    channelEmail: false,
    channelInApp: true,
  },
  {
    id: "alert-comite",
    title: "Sesión trimestral del Comité",
    description: "Programa y documenta la sesión ordinaria del Comité de Comunicación y Control.",
    targetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 10).toISOString(),
    responsible: "Secretaría Técnica",
    channelEmail: true,
    channelInApp: true,
  },
]

const questionBank: GovernanceQuestion[] = [
  {
    id: "oficial-designacion-1",
    submodule: "oficial",
    category: "Designación y facultades",
    question: "¿Se designó formalmente al Oficial de Cumplimiento ante el SAT?",
    legalReference: "Art. 20 LFPIORPI y art. 10 RCG",
    helperText: "Carga el acuse del SAT que acredita la designación del Oficial de Cumplimiento.",
    answer: null,
    evidenceHints: ["Acuse SAT de designación del Oficial"],
    relatedDocuments: [],
    required: true,
  },
  {
    id: "oficial-designacion-2",
    submodule: "oficial",
    category: "Designación y facultades",
    question: "¿Se cuenta con el acuse de aceptación del cargo en el Portal PLD?",
    legalReference: "Art. 20 LFPIORPI y reglas de Portal PLD SAT",
    helperText: "Debe adjuntarse el acuse digital generado por el Portal PLD.",
    answer: null,
    evidenceHints: ["Acuse SAT de aceptación en Portal PLD"],
    relatedDocuments: [],
    required: true,
  },
  {
    id: "oficial-designacion-3",
    submodule: "oficial",
    category: "Designación y facultades",
    question: "¿El Oficial de Cumplimiento cuenta con facultades legales suficientes para desempeñar el cargo?",
    legalReference: "Art. 20 LFPIORPI",
    helperText: "Adjunta el poder notarial o acta de asamblea correspondiente.",
    answer: null,
    evidenceHints: ["Poder notarial o acta que acredite facultades", "Identificación oficial vigente"],
    relatedDocuments: [],
    required: true,
  },
  {
    id: "oficial-certificacion-1",
    submodule: "oficial",
    category: "Certificación y competencias",
    question:
      "¿El Oficial de Cumplimiento está certificado en PLD-FT por la CNBV o un organismo reconocido?",
    legalReference: "Regulación secundaria CNBV / CNSF",
    helperText: "Adjunta el certificado vigente emitido por la autoridad competente.",
    answer: null,
    evidenceHints: ["Certificado CNBV vigente", "Constancias de certificaciones equivalentes"],
    relatedDocuments: [],
    required: true,
  },
  {
    id: "oficial-certificacion-2",
    submodule: "oficial",
    category: "Certificación y competencias",
    question: "¿El certificado del Oficial de Cumplimiento se encuentra vigente conforme a la periodicidad exigida?",
    legalReference: "Disposiciones CNBV (vigencia trianual)",
    helperText: "Debe anexarse evidencia de vigencia del certificado (validación o constancia).",
    answer: null,
    evidenceHints: ["Constancia de vigencia", "Validación CNBV"],
    relatedDocuments: [],
    required: true,
  },
  {
    id: "oficial-certificacion-3",
    submodule: "oficial",
    category: "Certificación y competencias",
    question: "¿El Oficial tiene experiencia profesional documentada en materia de PLD-FT?",
    legalReference: "Buenas prácticas CNBV",
    helperText: "Integra el CV y constancias laborales relacionadas con PLD-FT.",
    answer: null,
    evidenceHints: ["Currículum Vitae", "Constancias laborales", "Referencias internas"],
    relatedDocuments: [],
    required: false,
  },
  {
    id: "oficial-capacitacion-1",
    submodule: "oficial",
    category: "Capacitación y actualización",
    question: "¿El Oficial recibió capacitación anual vigente en PLD-FT?",
    legalReference: "Art. 39 RCG",
    helperText: "Carga la constancia de capacitación anual vigente (no mayor a 12 meses).",
    answer: null,
    evidenceHints: ["Constancia de capacitación anual", "Registro histórico de capacitaciones"],
    relatedDocuments: [],
    required: true,
  },
  {
    id: "oficial-capacitacion-2",
    submodule: "oficial",
    category: "Capacitación y actualización",
    question:
      "¿El Oficial ha participado en foros, seminarios o cursos especializados adicionales a la capacitación mínima?",
    legalReference: "Mejores prácticas CNBV",
    helperText: "Incorpora constancias adicionales para acreditar actualización continua.",
    answer: null,
    evidenceHints: ["Constancias de foros o seminarios"],
    relatedDocuments: [],
    required: false,
  },
  {
    id: "manuales-1",
    submodule: "manuales",
    category: "Documentación normativa",
    question:
      "¿La entidad cuenta con un manual de políticas y procedimientos internos elaborado dentro de los primeros 90 días del alta?",
    legalReference: "Art. 37 RCG",
    helperText: "Carga el manual vigente desde el repositorio digital con control de versiones.",
    answer: null,
    evidenceHints: ["Manual vigente", "Control de versiones"],
    relatedDocuments: [],
    required: true,
  },
  {
    id: "manuales-2",
    submodule: "manuales",
    category: "Documentación normativa",
    question: "¿El manual contempla criterios para identificación de clientes, beneficiario controlador y monitoreo?",
    legalReference: "Art. 37 RCG",
    helperText: "Adjunta extractos o índice del manual que evidencien los apartados obligatorios.",
    answer: null,
    evidenceHints: ["Índice o extracto del manual", "Matriz de roles y responsabilidades"],
    relatedDocuments: [],
    required: true,
  },
  {
    id: "manuales-3",
    submodule: "manuales",
    category: "Documentación normativa",
    question: "¿El manual incluye medidas internas de control y mitigación de riesgos de PLD-FT?",
    legalReference: "Art. 37 RCG",
    helperText: "Sube extractos aprobados que describan roles, funciones y segregación de tareas.",
    answer: null,
    evidenceHints: ["Extracto del manual", "Checklist de cumplimiento interno"],
    relatedDocuments: [],
    required: true,
  },
  {
    id: "manuales-4",
    submodule: "manuales",
    category: "Documentación normativa",
    question: "¿El manual se revisa y actualiza al menos una vez al año o ante reformas regulatorias?",
    legalReference: "Art. 37 RCG",
    helperText: "Incorpora versión vigente con control de cambios y fecha de actualización.",
    answer: null,
    evidenceHints: ["Versión vigente con control de cambios", "Historial de revisiones"],
    relatedDocuments: [],
    required: true,
  },
  {
    id: "manuales-5",
    submodule: "manuales",
    category: "Gobernanza",
    question: "¿El manual fue aprobado por la alta dirección o Comité de Comunicación y Control?",
    legalReference: "Art. 37 RCG",
    helperText: "Adjunta el acta o resolución de aprobación.",
    answer: null,
    evidenceHints: ["Acta o resolución de aprobación", "Evidencia de difusión interna"],
    relatedDocuments: [],
    required: true,
  },
  {
    id: "comite-1",
    submodule: "comite",
    category: "Integración del Comité",
    question: "¿La sociedad está obligada a integrar un Comité de Comunicación y Control?",
    legalReference: "Normativa sectorial (≥ 25 empleados)",
    helperText: "Adjunta acta de integración y listado de miembros si aplica.",
    answer: null,
    evidenceHints: ["Acta de integración", "Lista oficial de miembros"],
    relatedDocuments: [],
    required: true,
  },
  {
    id: "comite-2",
    submodule: "comite",
    category: "Integración del Comité",
    question:
      "¿El Comité está conformado por al menos tres integrantes con cargos directivos y representatividad en áreas clave?",
    legalReference: "Normativa sectorial",
    helperText: "Incluye acta constitutiva o nombramientos que acrediten los cargos.",
    answer: null,
    evidenceHints: ["Acta constitutiva del Comité", "Nombramientos"],
    relatedDocuments: [],
    required: true,
  },
  {
    id: "comite-3",
    submodule: "comite",
    category: "Funcionamiento",
    question:
      "¿El Comité celebra sesiones periódicas (al menos trimestrales) para seguimiento de operaciones y reportes?",
    legalReference: "Buenas prácticas UIF",
    helperText: "Carga calendario de sesiones y actas celebradas.",
    answer: null,
    evidenceHints: ["Calendario de sesiones", "Actas de reunión"],
    relatedDocuments: [],
    required: true,
  },
  {
    id: "comite-4",
    submodule: "comite",
    category: "Funcionamiento",
    question: "¿Se documentan formalmente las actas, minutas y lista de asistentes?",
    legalReference: "Normativa sectorial",
    helperText: "Integra actas firmadas, minutas y listas de asistencia digitalizadas.",
    answer: null,
    evidenceHints: ["Actas firmadas", "Listas de asistencia"],
    relatedDocuments: [],
    required: true,
  },
  {
    id: "comite-5",
    submodule: "comite",
    category: "Seguimiento",
    question:
      "¿El Comité emite acuerdos vinculantes y seguimiento documentado a observaciones del Oficial y autoridades?",
    legalReference: "Buenas prácticas UIF",
    helperText: "Adjunta minutas con acuerdos, responsables y plan de acción.",
    answer: null,
    evidenceHints: ["Minutas con acuerdos", "Planes de acción"],
    relatedDocuments: [],
    required: true,
  },
]

const answerOptions: { value: AnswerValue; label: string }[] = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
  { value: "no-aplica", label: "No aplica" },
]

type StoredState = {
  questions: GovernanceQuestion[]
  documents: DocumentRecord[]
  trace: TraceEntry[]
  manualVersions: ManualVersion[]
  committeeSessions: CommitteeSession[]
  alerts: AlertSetting[]
  expedienteCerrado: boolean
}

const submoduleConfig = [
  {
    id: "oficial" as const,
    title: "Oficial de Cumplimiento",
    description:
      "Designación, certificaciones, facultades y capacitación continua del Oficial de Cumplimiento conforme a LFPIORPI.",
  },
  {
    id: "manuales" as const,
    title: "Políticas y Manuales",
    description:
      "Repositorio con control de versiones, aprobaciones y difusión de políticas internas en materia de PLD-FT.",
  },
  {
    id: "comite" as const,
    title: "Comité de Comunicación y Control",
    description:
      "Gestión integral del Comité: integración, sesiones, actas, acuerdos y seguimiento documentado.",
  },
]

function calculateStatusColor(status: DocumentRecord["status"]) {
  if (status === "vigente") return "bg-emerald-100 text-emerald-700"
  if (status === "por-vencer") return "bg-amber-100 text-amber-700"
  return "bg-red-100 text-red-700"
}

function getUserIdentifier() {
  if (typeof window === "undefined") return "usuario@plataforma"
  return localStorage.getItem("userEmail") || localStorage.getItem("userName") || "usuario@plataforma"
}

function formatDate(dateIso?: string) {
  if (!dateIso) return "—"
  return new Date(dateIso).toLocaleDateString("es-MX", { year: "numeric", month: "short", day: "numeric" })
}

function daysBetween(dateIso?: string) {
  if (!dateIso) return Infinity
  const now = new Date()
  const date = new Date(dateIso)
  return Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function base64ToText(data: string) {
  if (typeof window === "undefined") return ""
  try {
    const binary = atob(data)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    const decoder = new TextDecoder("utf-8")
    return decoder.decode(bytes)
  } catch (error) {
    console.error("No se pudo decodificar el archivo", error)
    return ""
  }
}

export default function GobernanzaControlPage() {
  const { toast } = useToast()
  const [questions, setQuestions] = useState<GovernanceQuestion[]>(questionBank)
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [trace, setTrace] = useState<TraceEntry[]>([])
  const [manualVersions, setManualVersions] = useState<ManualVersion[]>([])
  const [committeeSessions, setCommitteeSessions] = useState<CommitteeSession[]>([])
  const [alerts, setAlerts] = useState<AlertSetting[]>(defaultAlerts)
  const [expedienteCerrado, setExpedienteCerrado] = useState(false)
  const [uploadContext, setUploadContext] = useState<{ questionId: string | null; open: boolean }>({
    questionId: null,
    open: false,
  })
  const [viewerDoc, setViewerDoc] = useState<DocumentRecord | null>(null)
  const [signatureDoc, setSignatureDoc] = useState<DocumentRecord | null>(null)
  const [integrationSnapshot, setIntegrationSnapshot] = useState<IntegrationSnapshot | null>(null)
  const [newSessionDraft, setNewSessionDraft] = useState<Omit<CommitteeSession, "id">>({
    sessionNumber: "",
    sessionDate: "",
    attendees: [],
    agreements: [],
    notes: "",
    documentId: undefined,
  })
  const [newAgreementDraft, setNewAgreementDraft] = useState<{ agreement: string; responsible: string; deadline: string }>(
    { agreement: "", responsible: "", deadline: "" },
  )
  const [newAttendee, setNewAttendee] = useState("")
  const [signatureData, setSignatureData] = useState<{ signer: string; notes: string }>({ signer: "", notes: "" })

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return
    try {
      const parsed = JSON.parse(stored) as StoredState
      setQuestions((prev) =>
        questionBank.map((question) => {
          const existing = parsed.questions.find((q) => q.id === question.id)
          return existing ? { ...question, ...existing } : question
        }),
      )
      setDocuments(parsed.documents || [])
      setTrace(parsed.trace || [])
      setManualVersions(parsed.manualVersions || [])
      setCommitteeSessions(parsed.committeeSessions || [])
      setAlerts(parsed.alerts?.length ? parsed.alerts : defaultAlerts)
      setExpedienteCerrado(parsed.expedienteCerrado ?? false)
    } catch (error) {
      console.error("Error cargando módulo de gobernanza", error)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const stateToPersist: StoredState = {
      questions,
      documents,
      trace,
      manualVersions,
      committeeSessions,
      alerts,
      expedienteCerrado,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToPersist))
  }, [questions, documents, trace, manualVersions, committeeSessions, alerts, expedienteCerrado])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const capacitacion = JSON.parse(localStorage.getItem("capacitacion-control-data") || "null")
      const auditoria = JSON.parse(localStorage.getItem("auditoria-verificacion-data") || "null")
      const monitoreo = JSON.parse(localStorage.getItem("monitoreo-operaciones-data") || "null")
      const evidencias = JSON.parse(localStorage.getItem("evidencias-trazabilidad-data") || "null")
      setIntegrationSnapshot({
        capacitacionDocuments: capacitacion?.documentos?.length || 0,
        auditoriaHallazgos: auditoria?.hallazgos?.length || 0,
        monitoreoAlertas: monitoreo?.alertas?.length || 0,
        evidenciasResguardadas: evidencias?.documentos?.length || 0,
      })
    } catch (error) {
      console.warn("No se pudo obtener información de otros módulos", error)
    }
  }, [])

  const complianceRatio = useMemo(() => {
    const totalRequired = questions.filter((q) => q.required).length
    if (!totalRequired) return 0
    const compliant = questions.filter((q) => {
      if (!q.required || q.answer === null) return false
      if (q.answer === "si") return q.relatedDocuments.length > 0
      if (q.answer === "no") return Boolean(q.notes && q.actionPlan)
      if (q.answer === "no-aplica") return Boolean(q.notes)
      return false
    }).length
    return Math.round((compliant / totalRequired) * 100)
  }, [questions])

  const moduleStatus = useMemo(() => {
    if (complianceRatio === 100) return { color: "bg-emerald-500", label: "Cumplimiento total" }
    const nearExpiring = documents.some((doc) => doc.status === "por-vencer")
    if (nearExpiring || complianceRatio >= 70) return { color: "bg-amber-500", label: "Seguimiento requerido" }
    return { color: "bg-red-500", label: "Acciones urgentes" }
  }, [complianceRatio, documents])

  function appendTrace(action: string, section: string, details?: string) {
    const entry: TraceEntry = {
      id: crypto.randomUUID(),
      action,
      section,
      timestamp: new Date().toISOString(),
      user: getUserIdentifier(),
      details,
    }
    setTrace((prev) => [entry, ...prev.slice(0, 199)])
  }

  function handleAnswerChange(questionId: string, answer: AnswerValue) {
    setQuestions((prev) =>
      prev.map((question) =>
        question.id === questionId
          ? {
              ...question,
              answer,
              notes: answer === "si" ? "" : question.notes,
              actionPlan: answer === "si" ? "" : question.actionPlan,
            }
          : question,
      ),
    )
    const section = questionBank.find((q) => q.id === questionId)?.category || ""
    appendTrace(`Actualizó respuesta a "${answer.toUpperCase()}"`, section)
  }

  function handleNotesChange(questionId: string, value: string) {
    setQuestions((prev) =>
      prev.map((question) => (question.id === questionId ? { ...question, notes: value } : question)),
    )
  }

  function handlePlanChange(questionId: string, value: string) {
    setQuestions((prev) =>
      prev.map((question) => (question.id === questionId ? { ...question, actionPlan: value } : question)),
    )
  }

  function openUpload(questionId: string) {
    setUploadContext({ questionId, open: true })
  }

  function closeUpload() {
    setUploadContext({ questionId: null, open: false })
  }

  function evaluateDocumentStatus(issueDate: string, expiryDate?: string): DocumentRecord["status"] {
    if (expiryDate) {
      const days = daysBetween(expiryDate)
      if (days < 0) return "vencido"
      if (days <= 60) return "por-vencer"
      return "vigente"
    }
    const daysSinceIssue = Math.abs(daysBetween(issueDate))
    if (daysSinceIssue > 365) return "vencido"
    if (365 - daysSinceIssue <= 30) return "por-vencer"
    return "vigente"
  }

  async function handleDocumentUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const questionId = uploadContext.questionId
    if (!questionId) return

    const name = String(formData.get("name") || "")
    const documentType = String(formData.get("documentType") || "")
    const issueDate = String(formData.get("issueDate") || "")
    const expiryDate = String(formData.get("expiryDate") || "") || undefined
    const notes = String(formData.get("notes") || "")
    const relatedModules = formData.getAll("relatedModules") as string[]
    const file = (formData.get("file") as File) || null

    if (!file) {
      toast({ title: "Archivo requerido", description: "Selecciona un archivo para continuar", variant: "destructive" })
      return
    }

    const extension = file.name.split(".").pop()?.toLowerCase() || ""
    if (!allowedExtensions.includes(extension)) {
      toast({
        title: "Formato no permitido",
        description: "Solo se admiten archivos PDF, JPG o XML",
        variant: "destructive",
      })
      return
    }

    const issueDateObj = issueDate ? new Date(issueDate) : null
    if (!issueDateObj) {
      toast({ title: "Fecha de emisión requerida", description: "Indica la fecha de emisión del documento" })
      return
    }

    if (requiresIssueWithin12Months.has(questionId)) {
      const today = new Date()
      const months = (today.getFullYear() - issueDateObj.getFullYear()) * 12 + (today.getMonth() - issueDateObj.getMonth())
      if (months > 12) {
        toast({
          title: "Capacitación vencida",
          description: "La constancia debe tener una antigüedad no mayor a 12 meses",
          variant: "destructive",
        })
        return
      }
    }

    const arrayBuffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result
        if (typeof result === "string") {
          const commaIndex = result.indexOf(",")
          resolve(commaIndex > -1 ? result.slice(commaIndex + 1) : result)
        } else {
          reject(new Error("No se pudo convertir el archivo"))
        }
      }
      reader.onerror = () => reject(reader.error || new Error("Error al leer el archivo"))
      reader.readAsDataURL(file)
    })

    const status = evaluateDocumentStatus(issueDateObj.toISOString(), expiryDate)
    const retentionUntil = new Date(issueDateObj)
    retentionUntil.setFullYear(retentionUntil.getFullYear() + 5)

    const record: DocumentRecord = {
      id: crypto.randomUUID(),
      relatedQuestionId: questionId,
      name,
      documentType,
      fileName: file.name,
      mimeType: file.type || `application/${extension}`,
      size: file.size,
      uploadDate: new Date().toISOString(),
      issueDate: issueDateObj.toISOString(),
      expiryDate,
      retentionUntil: retentionUntil.toISOString(),
      status,
      hash,
      base64,
      relatedModules,
      notes,
    }

    setDocuments((prev) => [record, ...prev])
    setQuestions((prev) =>
      prev.map((question) =>
        question.id === questionId
          ? { ...question, relatedDocuments: Array.from(new Set([...question.relatedDocuments, record.id])) }
          : question,
      ),
    )

    if (questionId.startsWith("manuales")) {
      setManualVersions((prev) => {
        const newVersion = prev.length ? prev[0].version + 1 : 1
        const folio = `MAN-${newVersion.toString().padStart(3, "0")}-${new Date().getFullYear()}`
        const versionRecord: ManualVersion = {
          id: crypto.randomUUID(),
          version: newVersion,
          folio,
          uploadedAt: new Date().toISOString(),
          documentId: record.id,
          summary: documentType || "Actualización del manual",
        }
        return [versionRecord, ...prev]
      })
    }

    appendTrace(`Carga de documento "${file.name}"`, questionBank.find((q) => q.id === questionId)?.category || "")
    toast({ title: "Documento cargado", description: "La evidencia se ha almacenado con sello digital." })
    closeUpload()
    event.currentTarget.reset()
  }

  function handleDeleteDocument(documentId: string) {
    const target = documents.find((doc) => doc.id === documentId)
    if (!target) return
    setDocuments((prev) => prev.filter((doc) => doc.id !== documentId))
    setQuestions((prev) =>
      prev.map((question) => ({
        ...question,
        relatedDocuments: question.relatedDocuments.filter((id) => id !== documentId),
      })),
    )
    appendTrace(
      `Eliminó el documento "${target.fileName}"`,
      questionBank.find((q) => q.id === target.relatedQuestionId)?.category || "",
    )
    toast({ title: "Documento eliminado", description: "Se actualizó la evidencia del expediente." })
  }

  function handleDownload(doc: DocumentRecord) {
    const link = document.createElement("a")
    link.href = `data:${doc.mimeType};base64,${doc.base64}`
    link.download = doc.fileName
    link.click()
    appendTrace(
      `Descargó el documento "${doc.fileName}"`,
      questionBank.find((q) => q.id === doc.relatedQuestionId)?.category || "",
    )
  }

  function handleSendReminder(alert: AlertSetting) {
    const now = new Date().toISOString()
    setAlerts((prev) => prev.map((item) => (item.id === alert.id ? { ...item, lastReminder: now } : item)))
    appendTrace(`Envió recordatorio: ${alert.title}`, "Alertas y recordatorios")
    toast({ title: "Recordatorio enviado", description: `Notificación emitida a ${alert.responsible}.` })
  }

  function handleAlertChange(alertId: string, key: keyof AlertSetting, value: string | boolean) {
    setAlerts((prev) => prev.map((alert) => (alert.id === alertId ? { ...alert, [key]: value } : alert)))
  }

  function addAgreement() {
    if (!newAgreementDraft.agreement || !newAgreementDraft.responsible || !newAgreementDraft.deadline) return
    setNewSessionDraft((prev) => ({
      ...prev,
      agreements: [
        ...prev.agreements,
        { ...newAgreementDraft, status: "pendiente" },
      ],
    }))
    setNewAgreementDraft({ agreement: "", responsible: "", deadline: "" })
  }

  function removeAgreement(index: number) {
    setNewSessionDraft((prev) => ({
      ...prev,
      agreements: prev.agreements.filter((_, i) => i !== index),
    }))
  }

  function addAttendee() {
    if (!newAttendee.trim()) return
    setNewSessionDraft((prev) => ({ ...prev, attendees: Array.from(new Set([...prev.attendees, newAttendee.trim()])) }))
    setNewAttendee("")
  }

  function removeAttendee(name: string) {
    setNewSessionDraft((prev) => ({ ...prev, attendees: prev.attendees.filter((attendee) => attendee !== name) }))
  }

  function saveCommitteeSession() {
    if (!newSessionDraft.sessionNumber || !newSessionDraft.sessionDate || !newSessionDraft.attendees.length) {
      toast({
        title: "Información incompleta",
        description: "Captura número de sesión, fecha y asistentes para registrar el acta.",
        variant: "destructive",
      })
      return
    }
    const session: CommitteeSession = {
      id: crypto.randomUUID(),
      ...newSessionDraft,
    }
    setCommitteeSessions((prev) => [session, ...prev])
    appendTrace(`Registró sesión ${session.sessionNumber}`, "Comité de Comunicación y Control")
    toast({ title: "Sesión registrada", description: "La bitácora del Comité se actualizó." })
    setNewSessionDraft({ sessionNumber: "", sessionDate: "", attendees: [], agreements: [], notes: "", documentId: undefined })
  }

  function handleSignatureSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!signatureDoc) return
    if (!signatureData.signer.trim()) {
      toast({
        title: "Firma requerida",
        description: "Indica el nombre de quien firma digitalmente.",
        variant: "destructive",
      })
      return
    }
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === signatureDoc.id
          ? { ...doc, signedBy: signatureData.signer.trim(), signedAt: new Date().toISOString() }
          : doc,
      ),
    )
    appendTrace(
      `Firmó digitalmente "${signatureDoc.fileName}"`,
      questionBank.find((q) => q.id === signatureDoc.relatedQuestionId)?.category || "",
    )
    toast({ title: "Documento firmado", description: "Se registró la firma digital interna." })
    setSignatureDoc(null)
    setSignatureData({ signer: "", notes: "" })
  }

  function getDocumentsForQuestion(questionId: string) {
    return documents.filter((doc) => doc.relatedQuestionId === questionId)
  }

  function canCloseExpediente() {
    return questions.every((question) => {
      if (question.required && question.answer === null) return false
      if (question.answer === "si") return question.relatedDocuments.length > 0
      if (question.answer === "no") return Boolean(question.notes?.trim() && question.actionPlan?.trim())
      if (question.answer === "no-aplica") return Boolean(question.notes?.trim())
      return true
    })
  }

  function handleCloseExpediente() {
    if (!canCloseExpediente()) {
      toast({
        title: "No es posible cerrar",
        description: "Aún faltan evidencias obligatorias o planes de acción por documentar.",
        variant: "destructive",
      })
      return
    }
    setExpedienteCerrado(true)
    appendTrace("Cierre del expediente de Gobernanza", "Resumen del módulo")
    toast({ title: "Expediente cerrado", description: "Se bloquea la edición salvo reapertura manual." })
  }

  function handleExportPDF() {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" })
    doc.setFontSize(14)
    doc.text("Gobernanza y Control Interno - Reporte de Cumplimiento", 40, 40)
    doc.setFontSize(10)
    doc.text(`Fecha de generación: ${formatDate(new Date().toISOString())}`, 40, 60)
    doc.text(`Estatus general: ${moduleStatus.label} (${complianceRatio}%)`, 40, 80)

    let offset = 110
    questions.forEach((question) => {
      if (offset > 760) {
        doc.addPage()
        offset = 60
      }
      doc.setFont(undefined, "bold")
      doc.text(`${question.category} – ${question.question}`, 40, offset, { maxWidth: 515 })
      offset += 14
      doc.setFont(undefined, "normal")
      doc.text(`Respuesta: ${question.answer || "Sin respuesta"}`, 40, offset)
      offset += 12
      if (question.notes) {
        doc.text(`Notas: ${question.notes}`, 40, offset, { maxWidth: 515 })
        offset += 12
      }
      if (question.actionPlan) {
        doc.text(`Plan de acción: ${question.actionPlan}`, 40, offset, { maxWidth: 515 })
        offset += 12
      }
      const docCount = question.relatedDocuments.length
      doc.text(`Evidencias vinculadas: ${docCount}`, 40, offset)
      offset += 18
    })

    doc.save("gobernanza-control.pdf")
    appendTrace("Generó reporte PDF", "Reportes")
  }

  function handleExportExcel() {
    const sheetData = questions.map((question) => ({
      Categoria: question.category,
      Pregunta: question.question,
      Respuesta: question.answer || "Sin respuesta",
      "Notas / Justificación": question.notes || "",
      "Plan de acción": question.actionPlan || "",
      "Documentos ligados": question.relatedDocuments.length,
    }))
    const worksheet = XLSX.utils.json_to_sheet(sheetData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Gobernanza")
    XLSX.writeFile(workbook, "gobernanza-control.xlsx")
    appendTrace("Generó reporte Excel", "Reportes")
  }

  const pendingAlerts = alerts.filter((alert) => daysBetween(alert.targetDate) <= 30)

  const moduleLinkOptions = [
    { id: "capacitacion", label: "Módulo de Capacitación (VII)" },
    { id: "auditoria", label: "Módulo de Auditoría y Verificación (VIII)" },
    { id: "monitoreo", label: "Módulo de Monitoreo de Operaciones (V)" },
    { id: "evidencias", label: "Módulo de Evidencias y Trazabilidad (IX)" },
  ]

  const totalDocuments = documents.length
  const totalSessions = committeeSessions.length

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Gobernanza y Control Interno</CardTitle>
            <CardDescription>
              Repositorio integral para acreditar Oficial de Cumplimiento, manuales internos y Comité de Comunicación y
              Control conforme a LFPIORPI y RCG.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center text-white ${moduleStatus.color}`}>
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Semáforo de cumplimiento</p>
                <p className="font-semibold">{moduleStatus.label}</p>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span>Avance del checklist obligatorio</span>
                <span className="font-semibold">{complianceRatio}%</span>
              </div>
              <Progress value={complianceRatio} />
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Evidencias vigentes: {documents.filter((doc) => doc.status === "vigente").length}
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Por vencer: {documents.filter((doc) => doc.status === "por-vencer").length}
              </span>
              <span className="flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-red-500" /> Vencidas: {documents.filter((doc) => doc.status === "vencido").length}
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-4 w-4 text-blue-500" /> Documentos totales: {totalDocuments}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Alertas próximas</CardTitle>
            <CardDescription>Gestión automática de vencimientos y sesiones pendientes.</CardDescription>
          </CardHeader>
          <CardContent>
            {pendingAlerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay alertas próximas a vencer.</p>
            ) : (
              <ScrollArea className="h-72 pr-2">
                <div className="space-y-3">
                  {pendingAlerts.map((alert) => (
                    <div key={alert.id} className="rounded-lg border p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm flex items-center gap-1">
                          <BellRing className="h-4 w-4" /> {alert.title}
                        </span>
                        <Badge variant="outline" className="flex items-center gap-1 shrink-0">
                          <Clock className="h-3 w-3" /> {formatDate(alert.targetDate)}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">{alert.description}</p>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-muted-foreground">Responsable: {alert.responsible}</span>
                        <Button size="sm" variant="secondary" onClick={() => handleSendReminder(alert)}>
                          Enviar recordatorio
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Integración con módulos</CardTitle>
            <CardDescription>Sincronización automática con capacitación, auditoría y trazabilidad.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Capacitación</span>
              <span>{integrationSnapshot?.capacitacionDocuments ?? 0} constancias</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> Auditoría</span>
              <span>{integrationSnapshot?.auditoriaHallazgos ?? 0} hallazgos</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Activity className="h-4 w-4" /> Monitoreo</span>
              <span>{integrationSnapshot?.monitoreoAlertas ?? 0} alertas</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Archive className="h-4 w-4" /> Resguardo</span>
              <span>{integrationSnapshot?.evidenciasResguardadas ?? 0} documentos</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-wrap gap-3">
        <Button onClick={handleExportPDF} variant="outline" className="flex items-center gap-2">
          <FileText className="h-4 w-4" /> Exportar reporte PDF
        </Button>
        <Button onClick={handleExportExcel} variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" /> Exportar a Excel
        </Button>
        <Button
          onClick={handleCloseExpediente}
          disabled={expedienteCerrado || !canCloseExpediente()}
          className="flex items-center gap-2"
        >
          <Lock className="h-4 w-4" /> {expedienteCerrado ? "Expediente cerrado" : "Cerrar expediente"}
        </Button>
      </section>

      <Tabs defaultValue="oficial" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          {submoduleConfig.map((submodule) => (
            <TabsTrigger key={submodule.id} value={submodule.id} className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              {submodule.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {submoduleConfig.map((submodule) => (
          <TabsContent key={submodule.id} value={submodule.id} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{submodule.title}</CardTitle>
                <CardDescription>{submodule.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-full">
                  <div className="space-y-6">
                    {questions
                      .filter((question) => question.submodule === submodule.id)
                      .map((question) => (
                        <div key={question.id} className="rounded-lg border p-4 space-y-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline">{question.category}</Badge>
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Info className="h-3 w-3" />
                                    {question.legalReference}
                                  </span>
                                </div>
                                <p className="font-medium leading-relaxed">{question.question}</p>
                                {question.helperText && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Info className="h-3 w-3" /> {question.helperText}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                {answerOptions.map((option) => (
                                  <Button
                                    key={option.value}
                                    variant={question.answer === option.value ? "default" : "outline"}
                                    onClick={() => handleAnswerChange(question.id, option.value)}
                                    disabled={expedienteCerrado}
                                  >
                                    {option.label}
                                  </Button>
                                ))}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {question.evidenceHints.map((hint) => (
                                <Badge key={hint} variant="secondary" className="flex items-center gap-1 text-xs">
                                  <FileCheck2 className="h-3 w-3" /> {hint}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {question.answer === "si" && (
                            <div className="space-y-3">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="flex items-center gap-2"
                                onClick={() => openUpload(question.id)}
                                disabled={expedienteCerrado}
                              >
                                <Upload className="h-4 w-4" /> Agregar evidencia
                              </Button>

                              <div className="grid gap-3">
                                {getDocumentsForQuestion(question.id).map((doc) => (
                                  <div key={doc.id} className="rounded-lg border p-3 text-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div>
                                        <p className="font-semibold">{doc.name || doc.fileName}</p>
                                        <p className="text-xs text-muted-foreground">{doc.documentType}</p>
                                      </div>
                                      <Badge className={calculateStatusColor(doc.status)}>{doc.status}</Badge>
                                    </div>
                                    <div className="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
                                      <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Emisión: {formatDate(doc.issueDate)}</span>
                                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Vigencia: {formatDate(doc.expiryDate)}</span>
                                      <span className="flex items-center gap-1"><History className="h-3 w-3" /> Retención hasta: {formatDate(doc.retentionUntil)}</span>
                                      <span className="flex items-center gap-1"><Link2 className="h-3 w-3" /> Vinculado a: {doc.relatedModules.length ? doc.relatedModules.join(", ") : "—"}</span>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      <Button size="sm" variant="outline" className="flex items-center gap-2" onClick={() => setViewerDoc(doc)}>
                                        <Eye className="h-4 w-4" /> Ver
                                      </Button>
                                      <Button size="sm" variant="outline" className="flex items-center gap-2" onClick={() => handleDownload(doc)}>
                                        <Download className="h-4 w-4" /> Descargar
                                      </Button>
                                      <Button size="sm" variant="outline" className="flex items-center gap-2" onClick={() => setSignatureDoc(doc)}>
                                        <Pen className="h-4 w-4" /> {doc.signedAt ? "Actualizar firma" : "Firmar"}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="flex items-center gap-2"
                                        onClick={() => handleDeleteDocument(doc.id)}
                                        disabled={expedienteCerrado}
                                      >
                                        <X className="h-4 w-4" /> Eliminar
                                      </Button>
                                    </div>
                                    {doc.signedAt && (
                                      <p className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
                                        <Check className="h-3 w-3" /> Firmado por {doc.signedBy} el {formatDate(doc.signedAt)}
                                      </p>
                                    )}
                                    {doc.notes && (
                                      <p className="mt-2 text-xs text-muted-foreground">Notas: {doc.notes}</p>
                                    )}
                                  </div>
                                ))}
                                {getDocumentsForQuestion(question.id).length === 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    Aún no se han cargado evidencias. Debe adjuntarse al menos un documento para cerrar el expediente.
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {question.answer === "no" && (
                            <div className="space-y-3">
                              <div className="grid gap-2">
                                <Label>Justificación del incumplimiento</Label>
                                <Textarea
                                  value={question.notes || ""}
                                  onChange={(event) => handleNotesChange(question.id, event.target.value)}
                                  placeholder="Describe las causas del incumplimiento"
                                  disabled={expedienteCerrado}
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label>Plan de acción y responsables</Label>
                                <Textarea
                                  value={question.actionPlan || ""}
                                  onChange={(event) => handlePlanChange(question.id, event.target.value)}
                                  placeholder="Detalla actividades, responsables y plazos para solventar el requisito"
                                  disabled={expedienteCerrado}
                                />
                              </div>
                            </div>
                          )}

                          {question.answer === "no-aplica" && (
                            <div className="grid gap-2">
                              <Label>Notas de no aplicabilidad</Label>
                              <Textarea
                                value={question.notes || ""}
                                onChange={(event) => handleNotesChange(question.id, event.target.value)}
                                placeholder="Documenta por qué el requisito no aplica y adjunta referencias"
                                disabled={expedienteCerrado}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bitácora digital automatizada</CardTitle>
            <CardDescription>Registro con sello de tiempo de todas las acciones realizadas en el módulo.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-72 pr-4">
              <div className="space-y-3 text-sm">
                {trace.length === 0 && <p className="text-muted-foreground">No se han registrado acciones todavía.</p>}
                {trace.map((entry) => (
                  <div key={entry.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {formatDate(entry.timestamp)} • {new Date(entry.timestamp).toLocaleTimeString("es-MX")}
                      </span>
                      <span>{entry.user}</span>
                    </div>
                    <p className="font-medium">{entry.action}</p>
                    {entry.section && <p className="text-xs text-muted-foreground">Sección: {entry.section}</p>}
                    {entry.details && <p className="text-xs text-muted-foreground">{entry.details}</p>}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Control de versiones del manual</CardTitle>
            <CardDescription>El sistema conserva cada versión con folio único y sello de tiempo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {manualVersions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Registra o actualiza el manual para comenzar el control de versiones.
              </p>
            ) : (
              <ScrollArea className="h-72 pr-4">
                <div className="space-y-3 text-sm">
                  {manualVersions.map((version) => {
                    const document = documents.find((doc) => doc.id === version.documentId)
                    return (
                      <div key={version.id} className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">Versión {version.version}</span>
                          <Badge variant="outline">Folio {version.folio}</Badge>
                        </div>
                        <p className="text-muted-foreground text-xs">{version.summary}</p>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
                          <span><History className="inline h-3 w-3" /> {formatDate(version.uploadedAt)}</span>
                          {document && (
                            <Button size="sm" variant="outline" className="flex items-center gap-1" onClick={() => setViewerDoc(document)}>
                              <Eye className="h-3 w-3" /> Ver versión
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
            <p className="text-xs text-muted-foreground">
              Para agregar una nueva versión, carga el documento actualizado en el submódulo de Políticas y Manuales.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Registro digital de sesiones del Comité</CardTitle>
          <CardDescription>Captura número de sesión, asistentes, acuerdos y responsables.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label>Número de sesión</Label>
                <Input
                  value={newSessionDraft.sessionNumber}
                  onChange={(event) => setNewSessionDraft((prev) => ({ ...prev, sessionNumber: event.target.value }))}
                  placeholder="Ej. Ordinaria 01/2024"
                  disabled={expedienteCerrado}
                />
              </div>
              <div className="grid gap-2">
                <Label>Fecha de sesión</Label>
                <Input
                  type="date"
                  value={newSessionDraft.sessionDate}
                  onChange={(event) => setNewSessionDraft((prev) => ({ ...prev, sessionDate: event.target.value }))}
                  disabled={expedienteCerrado}
                />
              </div>
              <div className="grid gap-2">
                <Label>Notas generales</Label>
                <Textarea
                  value={newSessionDraft.notes || ""}
                  onChange={(event) => setNewSessionDraft((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Observaciones relevantes de la sesión"
                  disabled={expedienteCerrado}
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label>Integrantes asistentes</Label>
                <div className="flex gap-2">
                  <Input
                    value={newAttendee}
                    onChange={(event) => setNewAttendee(event.target.value)}
                    placeholder="Nombre y cargo"
                    disabled={expedienteCerrado}
                  />
                  <Button
                    type="button"
                    onClick={addAttendee}
                    disabled={expedienteCerrado || !newAttendee.trim()}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" /> Agregar
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {newSessionDraft.attendees.map((attendee) => (
                    <Badge key={attendee} variant="secondary" className="flex items-center gap-2">
                      <Users className="h-3 w-3" /> {attendee}
                      {!expedienteCerrado && (
                        <button
                          type="button"
                          onClick={() => removeAttendee(attendee)}
                          className="text-xs text-muted-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Acuerdos</Label>
                <div className="grid gap-2">
                  <Input
                    value={newAgreementDraft.agreement}
                    onChange={(event) => setNewAgreementDraft((prev) => ({ ...prev, agreement: event.target.value }))}
                    placeholder="Descripción del acuerdo"
                    disabled={expedienteCerrado}
                  />
                  <Input
                    value={newAgreementDraft.responsible}
                    onChange={(event) => setNewAgreementDraft((prev) => ({ ...prev, responsible: event.target.value }))}
                    placeholder="Responsable"
                    disabled={expedienteCerrado}
                  />
                  <Input
                    type="date"
                    value={newAgreementDraft.deadline}
                    onChange={(event) => setNewAgreementDraft((prev) => ({ ...prev, deadline: event.target.value }))}
                    disabled={expedienteCerrado}
                  />
                  <Button type="button" onClick={addAgreement} disabled={expedienteCerrado} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Agregar acuerdo
                  </Button>
                </div>
                <div className="space-y-2 text-sm">
                  {newSessionDraft.agreements.map((agreement, index) => (
                    <div key={`${agreement.agreement}-${index}`} className="rounded border p-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{agreement.agreement}</span>
                        {!expedienteCerrado && (
                          <button
                            type="button"
                            onClick={() => removeAgreement(index)}
                            className="text-xs text-muted-foreground"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Responsable: {agreement.responsible}</p>
                      <p className="text-xs text-muted-foreground">Plazo: {formatDate(agreement.deadline)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={saveCommitteeSession} disabled={expedienteCerrado}>
              Guardar sesión
            </Button>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Sesiones registradas ({totalSessions})</h4>
            {committeeSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no se ha documentado ninguna sesión.</p>
            ) : (
              <ScrollArea className="h-60 pr-4">
                <div className="space-y-3 text-sm">
                  {committeeSessions.map((session) => (
                    <div key={session.id} className="rounded border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Sesión {session.sessionNumber}</span>
                        <Badge variant="outline">{formatDate(session.sessionDate)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Asistentes: {session.attendees.join(", ")}
                      </p>
                      {session.agreements.length > 0 && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p className="font-medium">Acuerdos:</p>
                          {session.agreements.map((agreement, index) => (
                            <div key={`${agreement.agreement}-${index}`} className="rounded bg-muted p-2">
                              <p>{agreement.agreement}</p>
                              <p>Responsable: {agreement.responsible}</p>
                              <p>Plazo: {formatDate(agreement.deadline)}</p>
                              <p>Estatus: {agreement.status}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {session.notes && <p className="text-xs text-muted-foreground">Notas: {session.notes}</p>}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuración de alertas y recordatorios</CardTitle>
          <CardDescription>
            Personaliza fechas objetivo y canales de notificación para obligaciones críticas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            {alerts.map((alert) => (
              <div key={alert.id} className="rounded border p-4 text-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold flex items-center gap-2">
                      <BellRing className="h-4 w-4" /> {alert.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{alert.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Fecha objetivo</Label>
                    <Input
                      type="date"
                      value={alert.targetDate.slice(0, 10)}
                      onChange={(event) => handleAlertChange(alert.id, "targetDate", event.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-xs">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={alert.channelEmail}
                      onChange={(event) => handleAlertChange(alert.id, "channelEmail", event.target.checked)}
                    />
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> Correo electrónico</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={alert.channelInApp}
                      onChange={(event) => handleAlertChange(alert.id, "channelInApp", event.target.checked)}
                    />
                    <span className="flex items-center gap-1"><BellRing className="h-3 w-3" /> Notificación interna</span>
                  </label>
                  <span className="text-muted-foreground">Responsable: {alert.responsible}</span>
                  {alert.lastReminder && (
                    <span className="text-muted-foreground">Último recordatorio: {formatDate(alert.lastReminder)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>




      <DialogPrimitive.Root open={uploadContext.open} onOpenChange={(open) => (!open ? closeUpload() : null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 bg-black/40 z-50" />
          <DialogPrimitive.Content className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Carga de evidencia</h3>
                  <p className="text-sm text-muted-foreground">
                    Adjunta documentos en formato PDF, JPG o XML. El sistema validará vigencia y hash de integridad.
                  </p>
                </div>
                <DialogPrimitive.Close asChild>
                  <Button variant="ghost" size="icon">
                    <X className="h-4 w-4" />
                  </Button>
                </DialogPrimitive.Close>
              </div>

              <form className="space-y-4" onSubmit={handleDocumentUpload}>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Nombre de la evidencia</Label>
                    <Input name="name" placeholder="Ej. Acuse SAT designación" required />
                  </div>
                  <div className="grid gap-2">
                    <Label>Tipo de documento</Label>
                    <Input name="documentType" placeholder="Selecciona la categoría del documento" required />
                  </div>
                  <div className="grid gap-2">
                    <Label>Fecha de emisión</Label>
                    <Input name="issueDate" type="date" required />
                  </div>
                  <div className="grid gap-2">
                    <Label>Fecha de vigencia (opcional)</Label>
                    <Input name="expiryDate" type="date" />
                  </div>
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Archivo</Label>
                    <Input name="file" type="file" accept=".pdf,.jpg,.jpeg,.xml" required />
                  </div>
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Módulos vinculados</Label>
                    <div className="grid gap-2 md:grid-cols-2">
                      {moduleLinkOptions.map((option) => (
                        <label key={option.id} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="relatedModules" value={option.label} />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Notas internas</Label>
                    <Textarea name="notes" placeholder="Observaciones, folios o responsables de revisión" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <DialogPrimitive.Close asChild>
                    <Button type="button" variant="outline">
                      Cancelar
                    </Button>
                  </DialogPrimitive.Close>
                  <Button type="submit" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" /> Guardar evidencia
                  </Button>
                </div>
              </form>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DialogPrimitive.Root open={Boolean(viewerDoc)} onOpenChange={(open) => (!open ? setViewerDoc(null) : null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <DialogPrimitive.Content className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {viewerDoc && (
              <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b">
                  <div>
                    <h3 className="text-lg font-semibold">Visor de documento</h3>
                    <p className="text-sm text-muted-foreground">{viewerDoc.fileName}</p>
                  </div>
                  <DialogPrimitive.Close asChild>
                    <Button variant="ghost" size="icon" onClick={() => setViewerDoc(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </DialogPrimitive.Close>
                </div>
                <div className="flex-1 overflow-auto">
                  {viewerDoc.mimeType.includes("pdf") ? (
                    <iframe
                      title={viewerDoc.fileName}
                      src={`data:${viewerDoc.mimeType};base64,${viewerDoc.base64}`}
                      className="w-full h-full"
                    />
                  ) : viewerDoc.mimeType.includes("xml") ? (
                    <pre className="p-4 text-xs whitespace-pre-wrap">
                      {base64ToText(viewerDoc.base64)}
                    </pre>
                  ) : (
                    <img
                      src={`data:${viewerDoc.mimeType};base64,${viewerDoc.base64}`}
                      alt={viewerDoc.fileName}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
              </div>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DialogPrimitive.Root open={Boolean(signatureDoc)} onOpenChange={(open) => (!open ? setSignatureDoc(null) : null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50" />
          <DialogPrimitive.Content className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {signatureDoc && (
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Firma digital interna</h3>
                  <DialogPrimitive.Close asChild>
                    <Button variant="ghost" size="icon" onClick={() => setSignatureDoc(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </DialogPrimitive.Close>
                </div>
                <p className="text-sm text-muted-foreground">
                  Confirma el nombre del responsable que revisó el documento y autoriza su incorporación al expediente.
                </p>
                <form className="space-y-4" onSubmit={handleSignatureSubmit}>
                  <div className="grid gap-2">
                    <Label>Nombre del firmante</Label>
                    <Input
                      value={signatureData.signer}
                      onChange={(event) => setSignatureData((prev) => ({ ...prev, signer: event.target.value }))}
                      placeholder="Ej. Oficial de Cumplimiento"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Notas adicionales (opcional)</Label>
                    <Textarea
                      value={signatureData.notes}
                      onChange={(event) => setSignatureData((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="Observaciones o criterios revisados"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <DialogPrimitive.Close asChild>
                      <Button type="button" variant="outline">
                        Cancelar
                      </Button>
                    </DialogPrimitive.Close>
                    <Button type="submit">Firmar documento</Button>
                  </div>
                </form>
              </div>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  )
}
