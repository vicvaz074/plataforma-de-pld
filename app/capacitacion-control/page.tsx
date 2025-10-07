"use client"

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { differenceInDays, format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { jsPDF } from "jspdf"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { readFileAsDataUrl } from "@/lib/storage/read-file"
import {
  AlertTriangle,
  BellRing,
  BookOpenCheck,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  History,
  ListChecks,
  ShieldCheck,
  Upload,
  UserCheck,
  Users,
} from "lucide-react"


type DocumentCategory =
  | "plan"
  | "asistencia"
  | "temario"
  | "material"
  | "constancia"
  | "evaluacion"
  | "oficial"
  | "checklist"

interface DocumentRecord {
  id: string
  name: string
  category: DocumentCategory
  dataUrl: string
  fileType: string
  size: number
  uploadedAt: string
  uploadedBy: string
  sessionId?: string
  employeeId?: string
  checklistQuestionId?: string
  notes?: string
}

interface TrainingPlanScheduleItem {
  id: string
  month: string
  topic: string
  audience: string
}

interface TrainingPlan {
  year: string
  approvedBy: string
  approvalDate: string
  objectives: string
  coverage: string
  planDocumentId?: string
  schedule: TrainingPlanScheduleItem[]
  createdAt: string
  updatedAt: string
}

interface TrainingSession {
  id: string
  title: string
  date: string
  modality: string
  durationHours: number
  topicsSummary: string
  attendanceDocumentId?: string
  temarioDocumentId?: string
  materialsDocumentIds: string[]
  evaluationApplied: boolean
  evaluationDocumentId?: string
  attendees: string[]
  observations?: string
  createdAt: string
  createdBy: string
}

interface TrainingHistoryEntry {
  sessionId: string
  sessionTitle: string
  date: string
  certificateId?: string
}

interface EmployeeRecord {
  id: string
  name: string
  role: string
  department: string
  hireDate: string
  criticalRole: boolean
  lastTrainingDate?: string
  needsInitialTraining: boolean
  certificates: string[]
  history: TrainingHistoryEntry[]
}

interface OfficialCompliance {
  name: string
  lastCertificationDate?: string
  certificateDocumentId?: string
}

interface TraceabilityEntry {
  id: string
  action: string
  details: string
  user: string
  timestamp: string
  sessionId?: string
  employeeId?: string
  documentId?: string
}

type ChecklistAnswerValue = "si" | "no" | "pendiente"

interface ChecklistAnswer {
  answer: ChecklistAnswerValue
  notes: string
  evidenceId?: string
}

interface ChecklistQuestion {
  id: string
  section: "A" | "B" | "C" | "D" | "E"
  title: string
  question: string
  recommendedCategories: DocumentCategory[]
  evidenceLabel: string
}

const checklistQuestions: ChecklistQuestion[] = [
  {
    id: "a1",
    section: "A",
    title: "Planificación",
    question: "¿Existe un plan anual de capacitación en PLD-FT aprobado por la Dirección/Comité?",
    recommendedCategories: ["plan"],
    evidenceLabel: "Plan anual con calendario",
  },
  {
    id: "b1",
    section: "B",
    title: "Ejecución",
    question: "¿El personal operativo recibió capacitación vigente en el último año?",
    recommendedCategories: ["asistencia", "constancia"],
    evidenceLabel: "Lista de asistencia y constancias",
  },
  {
    id: "b2",
    section: "B",
    title: "Ejecución",
    question: "¿El Representante de Cumplimiento recibió su capacitación anual obligatoria?",
    recommendedCategories: ["oficial"],
    evidenceLabel: "Constancia del Oficial de Cumplimiento",
  },
  {
    id: "c1",
    section: "C",
    title: "Alcance",
    question:
      "¿Se capacitó a todo el personal involucrado en actividades vulnerables (comercial, jurídico, operativo)?",
    recommendedCategories: ["asistencia"],
    evidenceLabel: "Listas de participantes",
  },
  {
    id: "c2",
    section: "C",
    title: "Alcance",
    question: "¿Se incluyó en la capacitación a nuevos empleados en un plazo razonable desde su ingreso?",
    recommendedCategories: ["constancia"],
    evidenceLabel: "Constancia de inducción",
  },
  {
    id: "d1",
    section: "D",
    title: "Evaluación",
    question: "¿Se aplicaron evaluaciones o pruebas de conocimiento para medir efectividad de la capacitación?",
    recommendedCategories: ["evaluacion"],
    evidenceLabel: "Resultados de exámenes o rúbricas",
  },
  {
    id: "d2",
    section: "D",
    title: "Evaluación",
    question: "¿Se documentaron temarios y materiales utilizados?",
    recommendedCategories: ["temario", "material"],
    evidenceLabel: "Temarios, manuales o presentaciones",
  },
  {
    id: "e1",
    section: "E",
    title: "Seguimiento",
    question: "¿Se conserva un historial de cumplimiento de capacitación por empleado?",
    recommendedCategories: ["constancia"],
    evidenceLabel: "Registro digital con fechas y constancias",
  },
]

interface PersistedState {
  trainingPlan: TrainingPlan | null
  sessions: TrainingSession[]
  employees: EmployeeRecord[]
  documents: DocumentRecord[]
  officialCompliance: OfficialCompliance
  traceability: TraceabilityEntry[]
  checklistAnswers: Record<string, ChecklistAnswer>
  moduleClosed: boolean
}

const STORAGE_KEY = "pld-training-module"

const defaultState: PersistedState = {
  trainingPlan: null,
  sessions: [],
  employees: [],
  documents: [],
  officialCompliance: { name: "" },
  traceability: [],
  checklistAnswers: {},
  moduleClosed: false,
}

const formatDisplayDate = (date: string) => {
  try {
    return format(parseISO(date), "dd 'de' MMMM yyyy", { locale: es })
  } catch (error) {
    return date
  }
}

export default function CapacitacionControlPage() {
  const [state, setState] = useState<PersistedState>(defaultState)
  const [isHydrated, setIsHydrated] = useState(false)
  const [planForm, setPlanForm] = useState({
    year: "",
    approvedBy: "",
    approvalDate: "",
    objectives: "",
    coverage: "",
    schedule: [{ id: `sched-${Date.now()}`, month: "", topic: "", audience: "" }],
    planDocumentId: "",
  })
  const [sessionForm, setSessionForm] = useState({
    title: "",
    date: "",
    modality: "Presencial",
    durationHours: "",
    topicsSummary: "",
    attendanceDocumentId: "",
    temarioDocumentId: "",
    materialsDocumentIds: [] as string[],
    evaluationApplied: false,
    evaluationDocumentId: "",
    attendees: [] as string[],
    observations: "",
  })
  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    role: "",
    department: "",
    hireDate: "",
    criticalRole: false,
  })
  const [officialForm, setOfficialForm] = useState({
    name: "",
    lastCertificationDate: "",
  })
  const [closingNotes, setClosingNotes] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as PersistedState
        setState({
          ...defaultState,
          ...parsed,
          officialCompliance: parsed.officialCompliance ?? { name: "" },
          traceability: parsed.traceability ?? [],
          checklistAnswers: parsed.checklistAnswers ?? {},
        })
      } catch (error) {
        console.error("Error al leer el estado persistido", error)
      }
    }
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state, isHydrated])

  useEffect(() => {
    if (!state.trainingPlan) return
    setPlanForm({
      year: state.trainingPlan.year,
      approvedBy: state.trainingPlan.approvedBy,
      approvalDate: state.trainingPlan.approvalDate,
      objectives: state.trainingPlan.objectives,
      coverage: state.trainingPlan.coverage,
      schedule:
        state.trainingPlan.schedule.length > 0
          ? state.trainingPlan.schedule.map((item) => ({ ...item }))
          : [{ id: `sched-${Date.now()}`, month: "", topic: "", audience: "" }],
      planDocumentId: state.trainingPlan.planDocumentId ?? "",
    })
  }, [state.trainingPlan])

  useEffect(() => {
    setOfficialForm({
      name: state.officialCompliance.name,
      lastCertificationDate: state.officialCompliance.lastCertificationDate ?? "",
    })
  }, [state.officialCompliance.name, state.officialCompliance.lastCertificationDate])

  const registerTrace = (entry: Omit<TraceabilityEntry, "id" | "timestamp" | "user">) => {
    setState((prev) => ({
      ...prev,
      traceability: [
        {
          id: `trace-${Date.now()}`,
          timestamp: new Date().toISOString(),
          user: "Oficial de Cumplimiento",
          ...entry,
        },
        ...prev.traceability,
      ],
    }))
  }

  const storeDocument = async (
    file: File,
    category: DocumentCategory,
    options?: { sessionId?: string; employeeId?: string; checklistQuestionId?: string },
  ) => {
    const dataUrl = await readFileAsDataUrl(file)
    const documentId = `doc-${Date.now()}`
    const newDocument: DocumentRecord = {
      id: documentId,
      name: file.name,
      category,
      dataUrl,
      fileType: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: "Oficial de Cumplimiento",
      ...options,
    }

    setState((prev) => ({
      ...prev,
      documents: [newDocument, ...prev.documents],
    }))

    registerTrace({
      action: `Documento cargado (${category})`,
      details: file.name + " registrado en la bitácora digital de capacitación.",
      documentId,
    })

    toast({
      title: "Documento cargado",
      description: file.name + " se almacenó con sello de tiempo y responsable.",
    })

    return documentId
  }

  const handleDocumentUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    category: DocumentCategory,
    options?: { sessionId?: string; employeeId?: string; checklistQuestionId?: string },
  ) => {
    const file = event.target.files?.[0]
    if (!file) return undefined

    const documentId = await storeDocument(file, category, options)
    event.target.value = ""
    return documentId
  }

  const handlePlanScheduleChange = (index: number, field: keyof TrainingPlanScheduleItem, value: string) => {
    setPlanForm((prev) => {
      const updated = [...prev.schedule]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, schedule: updated }
    })
  }

  const addScheduleRow = () => {
    setPlanForm((prev) => ({
      ...prev,
      schedule: [...prev.schedule, { id: `sched-${Date.now()}`, month: "", topic: "", audience: "" }],
    }))
  }

  const removeScheduleRow = (id: string) => {
    setPlanForm((prev) => ({
      ...prev,
      schedule: prev.schedule.filter((item) => item.id !== id),
    }))
  }

  const handlePlanSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const filteredSchedule = planForm.schedule.filter((item) => item.month || item.topic || item.audience)
    const newPlan: TrainingPlan = {
      year: planForm.year,
      approvedBy: planForm.approvedBy,
      approvalDate: planForm.approvalDate,
      objectives: planForm.objectives,
      coverage: planForm.coverage,
      planDocumentId: planForm.planDocumentId || state.trainingPlan?.planDocumentId,
      schedule: filteredSchedule,
      createdAt: state.trainingPlan?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setState((prev) => ({
      ...prev,
      trainingPlan: newPlan,
    }))

    registerTrace({
      action: "Plan anual actualizado",
      details: "Plan " + planForm.year + " guardado con calendario detallado.",
    })

    toast({
      title: "Plan de capacitación guardado",
      description: "El plan anual quedó registrado con los módulos y audiencias definidos.",
    })
  }

  const handlePlanDocumentUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const documentId = await handleDocumentUpload(event, "plan")
    if (!documentId) return
    setPlanForm((prev) => ({ ...prev, planDocumentId: documentId }))
    setState((prev) => ({
      ...prev,
      trainingPlan: prev.trainingPlan ? { ...prev.trainingPlan, planDocumentId: documentId } : prev.trainingPlan,
    }))
  }

  const updateDocumentsWithSessionId = (documentIds: string[], sessionId: string) => {
    if (documentIds.length === 0) return
    setState((prev) => ({
      ...prev,
      documents: prev.documents.map((document) =>
        documentIds.includes(document.id) ? { ...document, sessionId } : document,
      ),
    }))
  }

  const handleSessionSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!sessionForm.title || !sessionForm.date || !sessionForm.durationHours) {
      toast({
        title: "Datos incompletos",
        description: "Captura el título, la fecha y la duración de la sesión antes de guardar.",
        variant: "destructive",
      })
      return
    }

    const sessionId = `session-${Date.now()}`
    const newSession: TrainingSession = {
      id: sessionId,
      title: sessionForm.title,
      date: sessionForm.date,
      modality: sessionForm.modality,
      durationHours: Number(sessionForm.durationHours),
      topicsSummary: sessionForm.topicsSummary,
      attendanceDocumentId: sessionForm.attendanceDocumentId || undefined,
      temarioDocumentId: sessionForm.temarioDocumentId || undefined,
      materialsDocumentIds: sessionForm.materialsDocumentIds,
      evaluationApplied: sessionForm.evaluationApplied,
      evaluationDocumentId: sessionForm.evaluationDocumentId || undefined,
      attendees: sessionForm.attendees,
      observations: sessionForm.observations || undefined,
      createdAt: new Date().toISOString(),
      createdBy: "Oficial de Cumplimiento",
    }

    setState((prev) => ({
      ...prev,
      sessions: [newSession, ...prev.sessions],
    }))

    const documentsToUpdate = [
      sessionForm.attendanceDocumentId,
      sessionForm.temarioDocumentId,
      sessionForm.evaluationDocumentId,
      ...sessionForm.materialsDocumentIds,
    ].filter(Boolean) as string[]

    updateDocumentsWithSessionId(documentsToUpdate, sessionId)

    if (sessionForm.attendees.length > 0) {
      setState((prev) => ({
        ...prev,
        employees: prev.employees.map((employee) => {
          if (!sessionForm.attendees.includes(employee.id)) return employee
          const updatedHistory: TrainingHistoryEntry[] = [
            {
              sessionId,
              sessionTitle: sessionForm.title,
              date: sessionForm.date,
              certificateId: employee.certificates.at(-1),
            },
            ...employee.history,
          ]

          return {
            ...employee,
            lastTrainingDate: sessionForm.date,
            needsInitialTraining: false,
            history: updatedHistory,
          }
        }),
      }))
    }

    registerTrace({
      action: "Sesión registrada",
      details:
        sessionForm.title +
        " (" +
        sessionForm.modality +
        ") con " +
        sessionForm.attendees.length +
        " asistentes.",
      sessionId,
    })

    toast({
      title: "Sesión guardada",
      description: "La sesión quedó registrada con sus materiales y asistentes vinculados.",
    })

    setSessionForm({
      title: "",
      date: "",
      modality: "Presencial",
      durationHours: "",
      topicsSummary: "",
      attendanceDocumentId: "",
      temarioDocumentId: "",
      materialsDocumentIds: [],
      evaluationApplied: false,
      evaluationDocumentId: "",
      attendees: [],
      observations: "",
    })
  }

  const handleMaterialUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return
    const uploadedIds: string[] = []
    for (const file of Array.from(files)) {
      const documentId = await storeDocument(file, "material")
      uploadedIds.push(documentId)
    }
    setSessionForm((prev) => ({
      ...prev,
      materialsDocumentIds: [...prev.materialsDocumentIds, ...uploadedIds],
    }))
    event.target.value = ""

    toast({
      title: "Materiales cargados",
      description: "Los archivos se asociarán automáticamente a la sesión al guardarla.",
    })
  }

  const handleEmployeeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!employeeForm.name || !employeeForm.role || !employeeForm.hireDate) {
      toast({
        title: "Datos incompletos",
        description: "Completa el nombre, puesto y fecha de ingreso del colaborador.",
        variant: "destructive",
      })
      return
    }

    const employeeId = `employee-${Date.now()}`
    const newEmployee: EmployeeRecord = {
      id: employeeId,
      name: employeeForm.name,
      role: employeeForm.role,
      department: employeeForm.department,
      hireDate: employeeForm.hireDate,
      criticalRole: employeeForm.criticalRole,
      needsInitialTraining: true,
      certificates: [],
      history: [],
    }

    setState((prev) => ({
      ...prev,
      employees: [newEmployee, ...prev.employees],
    }))

    registerTrace({
      action: "Nuevo empleado registrado",
      details: employeeForm.name + " marcado con capacitación inicial pendiente.",
      employeeId,
    })

    toast({
      title: "Empleado añadido",
      description: "Se generó un recordatorio automático para la capacitación de inducción.",
    })

    setEmployeeForm({
      name: "",
      role: "",
      department: "",
      hireDate: "",
      criticalRole: false,
    })
  }

  const handleCertificateUpload = async (event: ChangeEvent<HTMLInputElement>, employeeId: string) => {
    const documentId = await handleDocumentUpload(event, "constancia", { employeeId })
    if (!documentId) return

    setState((prev) => ({
      ...prev,
      employees: prev.employees.map((employee) => {
        if (employee.id !== employeeId) return employee
        return {
          ...employee,
          certificates: [documentId, ...employee.certificates],
          needsInitialTraining: false,
          lastTrainingDate: employee.lastTrainingDate ?? new Date().toISOString(),
        }
      }),
    }))

    registerTrace({
      action: "Constancia asociada",
      details: "Se vinculó constancia individual al expediente del empleado " + employeeId + ".",
      employeeId,
      documentId,
    })

    toast({
      title: "Constancia registrada",
      description: "El documento quedó ligado al historial del colaborador.",
    })
  }

  const handleOfficialCertificateUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const documentId = await handleDocumentUpload(event, "oficial")
    if (!documentId) return

    setState((prev) => ({
      ...prev,
      officialCompliance: {
        ...prev.officialCompliance,
        certificateDocumentId: documentId,
        lastCertificationDate: prev.officialCompliance.lastCertificationDate ?? new Date().toISOString(),
      },
    }))

    registerTrace({
      action: "Constancia del Oficial cargada",
      details: "Se acreditó la capacitación anual del Representante de Cumplimiento.",
      documentId,
    })
  }

  const handleChecklistAnswer = (questionId: string, value: ChecklistAnswerValue) => {
    setState((prev) => ({
      ...prev,
      checklistAnswers: {
        ...prev.checklistAnswers,
        [questionId]: {
          answer: value,
          notes: prev.checklistAnswers[questionId]?.notes ?? "",
          evidenceId: prev.checklistAnswers[questionId]?.evidenceId,
        },
      },
    }))
  }

  const handleChecklistNotes = (questionId: string, notes: string) => {
    setState((prev) => ({
      ...prev,
      checklistAnswers: {
        ...prev.checklistAnswers,
        [questionId]: {
          answer: prev.checklistAnswers[questionId]?.answer ?? "pendiente",
          notes,
          evidenceId: prev.checklistAnswers[questionId]?.evidenceId,
        },
      },
    }))
  }

  const handleChecklistEvidence = async (event: ChangeEvent<HTMLInputElement>, question: ChecklistQuestion) => {
    const documentId = await handleDocumentUpload(event, "checklist", { checklistQuestionId: question.id })
    if (!documentId) return

    setState((prev) => ({
      ...prev,
      checklistAnswers: {
        ...prev.checklistAnswers,
        [question.id]: {
          answer: prev.checklistAnswers[question.id]?.answer ?? "si",
          notes: prev.checklistAnswers[question.id]?.notes ?? "",
          evidenceId: documentId,
        },
      },
    }))
  }

  const handleOfficialFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setState((prev) => ({
      ...prev,
      officialCompliance: {
        ...prev.officialCompliance,
        name: officialForm.name,
        lastCertificationDate: officialForm.lastCertificationDate,
      },
    }))

    registerTrace({
      action: "Datos del Oficial actualizados",
      details:
        "Se registró certificación de " +
        officialForm.name +
        " con fecha " +
        (officialForm.lastCertificationDate || "sin captura") +
        ".",
    })

    toast({
      title: "Oficial actualizado",
      description: "Se guardó la información de capacitación del Representante de Cumplimiento.",
    })
  }

  const handleModuleClosure = () => {
    if (!officialCertificateValid) {
      toast({
        title: "Constancia del Oficial requerida",
        description: "No es posible cerrar el módulo sin la constancia vigente del Oficial de Cumplimiento.",
        variant: "destructive",
      })
      return
    }

    setState((prev) => ({
      ...prev,
      moduleClosed: true,
    }))

    registerTrace({
      action: "Módulo cerrado",
      details: closingNotes ? "Cierre del módulo con notas: " + closingNotes : "Cierre del módulo sin observaciones adicionales.",
    })

    toast({
      title: "Módulo cerrado",
      description: "Se registró el cierre del módulo con trazabilidad completa.",
    })
  }

  const exportReport = (formatType: "pdf" | "excel") => {
    if (formatType === "pdf") {
      const doc = new jsPDF({ orientation: "portrait", unit: "pt" })
      let y = 40
      doc.setFont("helvetica", "bold")
      doc.setFontSize(16)
      doc.text("Reporte de Capacitación y Control Interno", 40, y)
      y += 30
      doc.setFontSize(11)
      doc.setFont("helvetica", "normal")

      const addLine = (text: string) => {
        const lines = doc.splitTextToSize(text, 515)
        lines.forEach((line) => {
          if (y > 760) {
            doc.addPage()
            y = 40
          }
          doc.text(line, 40, y)
          y += 18
        })
      }

      addLine(
        "Plan anual: " +
          (state.trainingPlan
            ? state.trainingPlan.year + " aprobado por " + state.trainingPlan.approvedBy
            : "No registrado"),
      )
      addLine("Sesiones registradas: " + state.sessions.length)
      state.sessions.slice(0, 20).forEach((session) => {
        addLine(
          "• " +
            session.title +
            " (" +
            formatDisplayDate(session.date) +
            ") - " +
            session.modality +
            ", asistentes: " +
            session.attendees.length,
        )
      })
      addLine("Colaboradores registrados: " + state.employees.length)
      state.employees.slice(0, 25).forEach((employee) => {
        const status = employee.needsInitialTraining
          ? "Pendiente de inducción"
          : employee.lastTrainingDate
          ? "Última capacitación: " + formatDisplayDate(employee.lastTrainingDate)
          : "Capacitación registrada sin fecha"
        addLine("• " + employee.name + " (" + employee.role + ") - " + status)
      })

      doc.save("reporte-capacitacion-control.pdf")
    } else {
      const header = ["Tipo", "Nombre", "Fecha", "Detalle"].join(",")
      const rows: string[] = [header]

      if (state.trainingPlan) {
        rows.push([
          "Plan",
          "Plan " + state.trainingPlan.year,
          state.trainingPlan.approvalDate,
          state.trainingPlan.objectives.replace(/\n/g, " "),
        ].join(","))
      }

      state.sessions.forEach((session) => {
        rows.push([
          "Sesión",
          session.title.replace(/,/g, ";"),
          session.date,
          session.modality + " | " + session.attendees.length + " asistentes",
        ].join(","))
      })

      state.employees.forEach((employee) => {
        rows.push([
          "Empleado",
          employee.name.replace(/,/g, ";"),
          employee.lastTrainingDate ?? "Sin registro",
          employee.needsInitialTraining ? "Inducción pendiente" : "Capacitación vigente",
        ].join(","))
      })

      const csvContent = rows.join("\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", "reporte-capacitacion-control.csv")
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }

    registerTrace({
      action: "Reporte exportado (" + formatType.toUpperCase() + ")",
      details: "Se generó un reporte para visitas de verificación.",
    })

    toast({
      title: "Reporte exportado",
      description: "Se generó el archivo en formato " + formatType.toUpperCase() + " para auditoría externa.",
    })
  }

  const officialCertificateValid = useMemo(() => {
    if (!state.officialCompliance.lastCertificationDate) return false
    const diff = differenceInDays(new Date(), new Date(state.officialCompliance.lastCertificationDate))
    return diff <= 365
  }, [state.officialCompliance.lastCertificationDate])

  const employeesWithUpcomingExpiry = useMemo(() => {
    const today = new Date()
    return state.employees.filter((employee) => {
      if (!employee.lastTrainingDate) return employee.criticalRole
      const diff = differenceInDays(today, new Date(employee.lastTrainingDate))
      return employee.criticalRole && diff >= 320 && diff <= 365
    })
  }, [state.employees])

  const employeesOverdue = useMemo(
    () =>
      state.employees.filter((employee) => {
        if (!employee.lastTrainingDate) return false
        const diff = differenceInDays(new Date(), new Date(employee.lastTrainingDate))
        return diff > 365
      }),
    [state.employees],
  )

  const upcomingSessions = useMemo(() => {
    const now = new Date()
    return state.sessions
      .filter((session) => {
        const sessionDate = new Date(session.date)
        const diff = differenceInDays(sessionDate, now)
        return diff >= 0 && diff <= 30
      })
      .sort((a, b) => (a.date > b.date ? 1 : -1))
  }, [state.sessions])

  const alerts = useMemo(() => {
    const items: { id: string; type: "warning" | "info" | "success"; message: string }[] = []

    if (!state.trainingPlan) {
      items.push({ id: "plan", type: "warning", message: "Registra el plan anual de capacitación para iniciar el módulo." })
    }

    if (!officialCertificateValid) {
      items.push({
        id: "oficial",
        type: "warning",
        message: "La constancia del Oficial de Cumplimiento vencerá o no está registrada. Actualízala para cerrar el módulo.",
      })
    }

    state.employees
      .filter((employee) => employee.needsInitialTraining)
      .forEach((employee) => {
        items.push({
          id: "induccion-" + employee.id,
          type: "info",
          message: employee.name +
            " requiere capacitación de inducción desde " +
            formatDisplayDate(employee.hireDate) +
            ".",
        })
      })

    employeesWithUpcomingExpiry.forEach((employee) => {
      items.push({
        id: "vencimiento-" + employee.id,
        type: "warning",
        message: "La capacitación de " + employee.name + " vencerá pronto. Programa sesión antes de cumplir 12 meses.",
      })
    })

    employeesOverdue.forEach((employee) => {
      items.push({
        id: "atraso-" + employee.id,
        type: "warning",
        message: employee.name + " tiene capacitación vencida. Registra sesión o constancia actualizada.",
      })
    })

    upcomingSessions.forEach((session) => {
      items.push({
        id: "sesion-" + session.id,
        type: "success",
        message: "Sesión próxima: " + session.title + " el " + formatDisplayDate(session.date) + " (" + session.modality + ").",
      })
    })

    return items
  }, [state.trainingPlan, officialCertificateValid, state.employees, employeesWithUpcomingExpiry, employeesOverdue, upcomingSessions])

  const checklistCompletion = useMemo(() => {
    const total = checklistQuestions.length
    const answered = checklistQuestions.filter((question) => state.checklistAnswers[question.id]?.answer !== undefined).length
    return total === 0 ? 0 : Math.round((answered / total) * 100)
  }, [state.checklistAnswers])

  const employeesFullyCompliant = useMemo(
    () => state.employees.filter((employee) => !employee.needsInitialTraining && !!employee.lastTrainingDate).length,
    [state.employees],
  )

  const moduleProgress = useMemo(() => {
    const checkpoints = [
      state.trainingPlan ? 1 : 0,
      state.sessions.length > 0 ? 1 : 0,
      employeesFullyCompliant === state.employees.length && state.employees.length > 0 ? 1 : 0,
      officialCertificateValid ? 1 : 0,
    ]
    const scored = checkpoints.reduce((sum, item) => sum + item, 0)
    return Math.round((scored / checkpoints.length) * 100)
  }, [state.trainingPlan, state.sessions.length, employeesFullyCompliant, state.employees.length, officialCertificateValid])

  const generalEvidenceChecklist = [
    "Plan anual de capacitación en PLD-FT (documento con calendario).",
    "Programa o temario oficial del curso.",
    "Materiales de apoyo (manuales, presentaciones, videos).",
    "Listas de asistencia firmadas o electrónicas.",
    "Constancias de capacitación emitidas a empleados.",
    "Constancia de capacitación anual del Representante de Cumplimiento.",
    "Evaluaciones aplicadas y resultados.",
    "Registro histórico de capacitación por empleado.",
  ]

  const specificEvidenceChecklist = [
    { label: "Personal operativo", description: "Listas de asistencia y constancias individuales." },
    { label: "Oficial de Cumplimiento", description: "Constancia de capacitación anual especializada." },
    { label: "Nuevos empleados", description: "Constancia de inducción en PLD-FT." },
  ]

  const renderDocumentLink = (documentId?: string) => {
    if (!documentId) return null
    const document = state.documents.find((doc) => doc.id === documentId)
    if (!document) return null
    return (
      <a key={document.id} href={document.dataUrl} download={document.name} className="text-sm text-primary underline">
        {document.name}
      </a>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Capacitación y Control Interno</h1>
            <p className="text-muted-foreground">
              Garantiza que todo el personal involucrado en Actividades Vulnerables reciba capacitación periódica en PLD-FT,
              documentando evidencias, constancias y evaluaciones conforme al art. 39 de las RCG.
            </p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Función dentro de la plataforma</CardTitle>
            <CardDescription>
              Integra el plan anual, la ejecución de sesiones, la trazabilidad documental y las alertas para mantener personal capacitado.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold">Capacidades principales</h4>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                <li>Planear, registrar y dar seguimiento a capacitación operativa y directiva.</li>
                <li>Integración con el expediente del Oficial de Cumplimiento y auditoría interna.</li>
                <li>Conservación de evidencias con sello de tiempo y usuario responsable.</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Conexiones con otros módulos</h4>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                <li>
                  <strong>Módulo II (Registro SAT):</strong> seguimiento a la constancia anual del Oficial.
                </li>
                <li>
                  <strong>Módulo VIII (Auditoría):</strong> las evidencias se reutilizan en verificaciones internas.
                </li>
                <li>
                  <strong>Módulo X (Gobernanza):</strong> acredita la obligación estructural de contar con personal capacitado.
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Progreso del módulo</h3>
                <p className="text-sm text-muted-foreground">
                  {moduleProgress}% completado • Checklist respondido al {checklistCompletion}%
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">{moduleProgress}%</div>
                <p className="text-xs text-muted-foreground">Validaciones automáticas activas</p>
              </div>
            </div>
            <Progress value={moduleProgress} className="h-2" />
            <div className="mt-4 grid gap-3 md:grid-cols-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`h-4 w-4 ${state.trainingPlan ? "text-green-600" : "text-muted-foreground"}`} />
                <span>Plan anual cargado</span>
              </div>
              <div className="flex items-center gap-2">
                <ListChecks className={`h-4 w-4 ${state.sessions.length > 0 ? "text-green-600" : "text-muted-foreground"}`} />
                <span>Sesiones registradas</span>
              </div>
              <div className="flex items-center gap-2">
                <Users
                  className={`h-4 w-4 ${
                    employeesFullyCompliant === state.employees.length && state.employees.length > 0
                      ? "text-green-600"
                      : "text-muted-foreground"
                  }`}
                />
                <span>Personal actualizado</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className={`h-4 w-4 ${officialCertificateValid ? "text-green-600" : "text-destructive"}`} />
                <span>Constancia del Oficial</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-primary" /> Alertas y recordatorios
            </CardTitle>
            <CardDescription>Validación automática de fechas y pendientes críticos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Sin alertas pendientes.
              </div>
            ) : (
              <ul className="space-y-2 text-sm">
                {alerts.map((alert) => (
                  <li
                    key={alert.id}
                    className={`flex items-start gap-2 rounded-md border px-3 py-2 ${
                      alert.type === "warning"
                        ? "border-amber-200 bg-amber-50"
                        : alert.type === "success"
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-blue-200 bg-blue-50"
                    }`}
                  >
                    {alert.type === "warning" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                    ) : alert.type === "success" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                    ) : (
                      <BellRing className="mt-0.5 h-4 w-4 text-blue-600" />
                    )}
                    <span>{alert.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" /> Plan anual de capacitación
          </CardTitle>
          <CardDescription>
            Captura el plan anual aprobado por la Dirección/Comité, incluyendo objetivos, cobertura y calendario.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handlePlanSubmit}>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="plan-year">Año</Label>
                <Input
                  id="plan-year"
                  value={planForm.year}
                  onChange={(event) => setPlanForm((prev) => ({ ...prev, year: event.target.value }))}
                  placeholder="2025"
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="approved-by">Aprobado por</Label>
                <Input
                  id="approved-by"
                  value={planForm.approvedBy}
                  onChange={(event) => setPlanForm((prev) => ({ ...prev, approvedBy: event.target.value }))}
                  placeholder="Dirección / Comité"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="approval-date">Fecha de aprobación</Label>
                <Input
                  id="approval-date"
                  type="date"
                  value={planForm.approvalDate}
                  onChange={(event) => setPlanForm((prev) => ({ ...prev, approvalDate: event.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="objectives">Objetivos</Label>
                <Textarea
                  id="objectives"
                  value={planForm.objectives}
                  onChange={(event) => setPlanForm((prev) => ({ ...prev, objectives: event.target.value }))}
                  placeholder="Describe los objetivos del programa de capacitación en PLD-FT"
                  className="min-h-[120px]"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coverage">Cobertura</Label>
                <Textarea
                  id="coverage"
                  value={planForm.coverage}
                  onChange={(event) => setPlanForm((prev) => ({ ...prev, coverage: event.target.value }))}
                  placeholder="Áreas, perfiles y alcance del plan anual"
                  className="min-h-[120px]"
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Calendario tentativo</Label>
                <Button type="button" variant="outline" size="sm" onClick={addScheduleRow}>
                  Agregar actividad
                </Button>
              </div>
              <div className="space-y-3">
                {planForm.schedule.map((item, index) => (
                  <div key={item.id} className="grid gap-3 md:grid-cols-4 rounded-md border p-3">
                    <div className="space-y-1">
                      <Label className="text-xs uppercase text-muted-foreground">Mes</Label>
                      <Input
                        value={item.month}
                        onChange={(event) => handlePlanScheduleChange(index, "month", event.target.value)}
                        placeholder="Marzo"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs uppercase text-muted-foreground">Tema</Label>
                      <Input
                        value={item.topic}
                        onChange={(event) => handlePlanScheduleChange(index, "topic", event.target.value)}
                        placeholder="Identificación de operaciones inusuales"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs uppercase text-muted-foreground">Audiencia</Label>
                      <Input
                        value={item.audience}
                        onChange={(event) => handlePlanScheduleChange(index, "audience", event.target.value)}
                        placeholder="Personal operativo"
                      />
                    </div>
                    {planForm.schedule.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="md:col-span-4 justify-self-end"
                        onClick={() => removeScheduleRow(item.id)}
                      >
                        Eliminar
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Evidencia documental</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handlePlanDocumentUpload} />
                {renderDocumentLink(planForm.planDocumentId)}
              </div>
              <p className="text-xs text-muted-foreground">
                Sube el plan anual en PDF/JPG para conservar la evidencia de aprobación.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="submit">Guardar plan anual</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5" /> Registro de sesiones y materiales
          </CardTitle>
          <CardDescription>
            Formularios dinámicos para adjuntar listas de asistencia, temarios, materiales y evaluaciones por sesión.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-5" onSubmit={handleSessionSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="session-title">Nombre de la sesión</Label>
                <Input
                  id="session-title"
                  value={sessionForm.title}
                  onChange={(event) => setSessionForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Capacitación anual PLD"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="session-date">Fecha</Label>
                <Input
                  id="session-date"
                  type="date"
                  value={sessionForm.date}
                  onChange={(event) => setSessionForm((prev) => ({ ...prev, date: event.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="session-modality">Modalidad</Label>
                <Select
                  value={sessionForm.modality}
                  onValueChange={(value) => setSessionForm((prev) => ({ ...prev, modality: value }))}
                >
                  <SelectTrigger id="session-modality">
                    <SelectValue placeholder="Selecciona modalidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Presencial">Presencial</SelectItem>
                    <SelectItem value="Virtual">Virtual</SelectItem>
                    <SelectItem value="Híbrida">Híbrida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="session-duration">Duración (horas)</Label>
                <Input
                  id="session-duration"
                  type="number"
                  min={1}
                  step="0.5"
                  value={sessionForm.durationHours}
                  onChange={(event) => setSessionForm((prev) => ({ ...prev, durationHours: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Evaluación aplicada</Label>
                <div className="flex items-center gap-2 text-sm">
                  <Checkbox
                    id="evaluation-applied"
                    checked={sessionForm.evaluationApplied}
                    onCheckedChange={(checked) =>
                      setSessionForm((prev) => ({ ...prev, evaluationApplied: Boolean(checked) }))
                    }
                  />
                  <Label htmlFor="evaluation-applied" className="font-normal">
                    Se aplicó evaluación de conocimiento
                  </Label>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-topics">Resumen de temas</Label>
              <Textarea
                id="session-topics"
                value={sessionForm.topicsSummary}
                onChange={(event) => setSessionForm((prev) => ({ ...prev, topicsSummary: event.target.value }))}
                placeholder="Normatividad vigente, identificación de operaciones inusuales, uso de la plataforma PLD-FT..."
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Lista de asistencia</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={async (event) => {
                    const documentId = await handleDocumentUpload(event, "asistencia")
                    if (!documentId) return
                    setSessionForm((prev) => ({ ...prev, attendanceDocumentId: documentId }))
                  }}
                />
                {renderDocumentLink(sessionForm.attendanceDocumentId)}
              </div>
              <div className="space-y-2">
                <Label>Temario</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={async (event) => {
                    const documentId = await handleDocumentUpload(event, "temario")
                    if (!documentId) return
                    setSessionForm((prev) => ({ ...prev, temarioDocumentId: documentId }))
                  }}
                />
                {renderDocumentLink(sessionForm.temarioDocumentId)}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Materiales (PDF/JPG)</Label>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={handleMaterialUpload} />
              {sessionForm.materialsDocumentIds.length > 0 && (
                <div className="flex flex-wrap gap-2 text-sm">
                  {sessionForm.materialsDocumentIds.map((documentId) => (
                    <Badge key={documentId} variant="secondary">
                      {state.documents.find((doc) => doc.id === documentId)?.name ?? documentId}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {sessionForm.evaluationApplied && (
              <div className="space-y-2">
                <Label>Resultados de evaluación</Label>
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={async (event) => {
                    const documentId = await handleDocumentUpload(event, "evaluacion")
                    if (!documentId) return
                    setSessionForm((prev) => ({ ...prev, evaluationDocumentId: documentId }))
                  }}
                />
                {renderDocumentLink(sessionForm.evaluationDocumentId)}
              </div>
            )}

            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea
                value={sessionForm.observations}
                onChange={(event) => setSessionForm((prev) => ({ ...prev, observations: event.target.value }))}
                placeholder="Notas relevantes, hallazgos, compromisos de seguimiento..."
              />
            </div>

            <div className="space-y-2">
              <Label>Selecciona asistentes registrados en la plataforma</Label>
              {state.employees.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Agrega colaboradores en la sección de "Historial por empleado" para poder marcarlos como asistentes.
                </p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {state.employees.map((employee) => (
                    <label key={employee.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                      <Checkbox
                        checked={sessionForm.attendees.includes(employee.id)}
                        onCheckedChange={(checked) => {
                          setSessionForm((prev) => ({
                            ...prev,
                            attendees: checked
                              ? [...prev.attendees, employee.id]
                              : prev.attendees.filter((id) => id !== employee.id),
                          }))
                        }}
                      />
                      <span>
                        {employee.name} – {employee.role}
                        {employee.criticalRole && <Badge className="ml-2" variant="outline">Clave</Badge>}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button type="submit">Guardar sesión</Button>
            </div>
          </form>

          {state.sessions.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <History className="h-5 w-5" /> Sesiones registradas
              </h3>
              <div className="space-y-3">
                {state.sessions.map((session) => (
                  <Card key={session.id} className="border-dashed">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="font-semibold">{session.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {formatDisplayDate(session.date)} • {session.modality} • {session.durationHours} horas
                          </p>
                        </div>
                        <Badge variant={session.evaluationApplied ? "default" : "secondary"}>
                          {session.evaluationApplied ? "Evaluación aplicada" : "Sin evaluación"}
                        </Badge>
                      </div>
                      {session.topicsSummary && <p className="text-sm">{session.topicsSummary}</p>}
                      <div className="grid gap-2 text-sm md:grid-cols-2">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4" /> {session.attendees.length} asistentes
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" /> Registrada el {formatDisplayDate(session.createdAt)}
                        </div>
                      </div>
                      <div className="grid gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" /> Lista de asistencia: {renderDocumentLink(session.attendanceDocumentId) || "Sin cargar"}
                        </div>
                        <div className="flex items-center gap-2">
                          <BookOpenCheck className="h-4 w-4" /> Temario: {renderDocumentLink(session.temarioDocumentId) || "Sin cargar"}
                        </div>
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4" /> Evaluaciones: {renderDocumentLink(session.evaluationDocumentId) || "No aplica"}
                        </div>
                        {session.materialsDocumentIds.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Upload className="h-4 w-4" /> Materiales:
                            <div className="flex flex-wrap gap-2">
                              {session.materialsDocumentIds.map((documentId) => renderDocumentLink(documentId))}
                            </div>
                          </div>
                        )}
                      </div>
                      {session.observations && <p className="text-sm text-muted-foreground">{session.observations}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Historial por empleado y constancias
          </CardTitle>
          <CardDescription>
            Registra colaboradores, controla alertas de inducción y conserva el historial digital de constancias.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-4" onSubmit={handleEmployeeSubmit}>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="employee-name">Nombre completo</Label>
                <Input
                  id="employee-name"
                  value={employeeForm.name}
                  onChange={(event) => setEmployeeForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Nombre y apellidos"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee-role">Puesto</Label>
                <Input
                  id="employee-role"
                  value={employeeForm.role}
                  onChange={(event) => setEmployeeForm((prev) => ({ ...prev, role: event.target.value }))}
                  placeholder="Ej. Analista de cumplimiento"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee-department">Área</Label>
                <Input
                  id="employee-department"
                  value={employeeForm.department}
                  onChange={(event) => setEmployeeForm((prev) => ({ ...prev, department: event.target.value }))}
                  placeholder="Operaciones / Jurídico"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee-hire-date">Fecha de ingreso</Label>
                <Input
                  id="employee-hire-date"
                  type="date"
                  value={employeeForm.hireDate}
                  onChange={(event) => setEmployeeForm((prev) => ({ ...prev, hireDate: event.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Checkbox
                id="employee-critical"
                checked={employeeForm.criticalRole}
                onCheckedChange={(checked) => setEmployeeForm((prev) => ({ ...prev, criticalRole: Boolean(checked) }))}
              />
              <Label htmlFor="employee-critical" className="font-normal">
                Marcar como personal clave (generará alertas priorizadas)
              </Label>
            </div>
            <div className="flex justify-end">
              <Button type="submit">Agregar colaborador</Button>
            </div>
          </form>

          {state.employees.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no se han registrado empleados. Añade personal para generar historial individual y asociar constancias.
            </p>
          ) : (
            <div className="space-y-3">
              {state.employees.map((employee) => (
                <Card key={employee.id}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="font-semibold flex items-center gap-2">
                          {employee.name}
                          {employee.criticalRole && <Badge variant="outline">Clave</Badge>}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {employee.role} • {employee.department || "Sin área"}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p>Ingreso: {formatDisplayDate(employee.hireDate)}</p>
                        <p>
                          Última capacitación: {employee.lastTrainingDate ? formatDisplayDate(employee.lastTrainingDate) : "Sin registro"}
                        </p>
                        <p className={employee.needsInitialTraining ? "text-amber-600" : "text-emerald-600"}>
                          {employee.needsInitialTraining ? "Inducción pendiente" : "Capacitación vigente"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(event) => handleCertificateUpload(event, employee.id)}
                      />
                      <span className="text-muted-foreground">
                        Adjunta constancia individual: se asociará automáticamente al expediente del empleado.
                      </span>
                    </div>

                    <div>
                      <h5 className="text-sm font-semibold">Constancias registradas</h5>
                      {employee.certificates.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin constancias cargadas.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 text-sm">
                          {employee.certificates.map((documentId) => renderDocumentLink(documentId))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h5 className="text-sm font-semibold">Historial de capacitación</h5>
                      {employee.history.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin sesiones vinculadas.</p>
                      ) : (
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {employee.history.map((historyItem) => (
                            <li key={historyItem.sessionId + historyItem.date}>
                              {formatDisplayDate(historyItem.date)} • {historyItem.sessionTitle}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Constancia del Oficial de Cumplimiento
          </CardTitle>
          <CardDescription>
            Valida automáticamente la constancia anual del Oficial y bloquea el cierre del módulo si está vencida.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-4 md:grid-cols-3" onSubmit={handleOfficialFormSubmit}>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="official-name">Nombre del Oficial de Cumplimiento</Label>
              <Input
                id="official-name"
                value={officialForm.name}
                onChange={(event) => setOfficialForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nombre completo"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="official-date">Fecha de última capacitación</Label>
              <Input
                id="official-date"
                type="date"
                value={officialForm.lastCertificationDate}
                onChange={(event) => setOfficialForm((prev) => ({ ...prev, lastCertificationDate: event.target.value }))}
                required
              />
            </div>
            <div className="md:col-span-3 flex items-center gap-3">
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleOfficialCertificateUpload} />
              {renderDocumentLink(state.officialCompliance.certificateDocumentId)}
              <span className="text-xs text-muted-foreground">
                Sube la constancia anual del Oficial de Cumplimiento (PDF/JPG).
              </span>
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit">Guardar información del Oficial</Button>
            </div>
          </form>
          <div className={`rounded-md border p-3 text-sm ${officialCertificateValid ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            {officialCertificateValid ? (
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> Constancia vigente. Se permite el cierre del módulo.
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-4 w-4" /> La constancia está vencida o no se ha registrado. Actualízala para completar el módulo.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" /> Checklist con evidencias
          </CardTitle>
          <CardDescription>
            Responde las preguntas de control y adjunta evidencia digital conforme al checklist mejorado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {checklistQuestions.map((question) => {
            const answer = state.checklistAnswers[question.id]?.answer ?? "pendiente"
            const notes = state.checklistAnswers[question.id]?.notes ?? ""
            const evidenceId = state.checklistAnswers[question.id]?.evidenceId

            return (
              <Card key={question.id} className="border-dashed">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">Sección {question.section} – {question.title}</p>
                      <h4 className="font-semibold">{question.question}</h4>
                    </div>
                    <Select value={answer} onValueChange={(value) => handleChecklistAnswer(question.id, value as ChecklistAnswerValue)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="si">Sí</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2 text-sm">
                    <Label className="text-xs uppercase text-muted-foreground">Evidencia recomendada</Label>
                    <p className="text-muted-foreground">{question.evidenceLabel}</p>
                    <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => handleChecklistEvidence(event, question)} />
                    {renderDocumentLink(evidenceId)}
                  </div>
                  <div className="space-y-2">
                    <Label>Notas</Label>
                    <Textarea
                      value={notes}
                      onChange={(event) => handleChecklistNotes(question.id, event.target.value)}
                      placeholder="Describe evidencias, hallazgos o acciones de seguimiento"
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Listado de evidencias requeridas
          </CardTitle>
          <CardDescription>
            Consulta rápida de documentos que deben integrarse en el módulo de capacitación.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold">Generales</h4>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {generalEvidenceChecklist.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold">Específicas por perfil</h4>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {specificEvidenceChecklist.map((item) => (
                <li key={item.label}>
                  <span className="font-semibold text-foreground">{item.label}:</span> {item.description}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Trazabilidad y bitácora de acciones
          </CardTitle>
          <CardDescription>
            Registra cada carga documental, actualización y exportación con sello de tiempo y usuario responsable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state.traceability.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no existen acciones registradas en la bitácora.</p>
          ) : (
            <ScrollArea className="h-64">
              <ul className="space-y-3 text-sm">
                {state.traceability.map((entry) => (
                  <li key={entry.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{entry.action}</p>
                      <span className="text-xs text-muted-foreground">{formatDisplayDate(entry.timestamp)}</span>
                    </div>
                    <p className="text-muted-foreground">{entry.details}</p>
                    <p className="text-xs text-muted-foreground mt-1">Responsable: {entry.user}</p>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" /> Exportar y cerrar módulo
          </CardTitle>
          <CardDescription>
            Genera reportes en PDF/Excel para auditorías y cierra el módulo una vez acreditada la constancia del Oficial.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => exportReport("pdf")}>
              Exportar reporte PDF
            </Button>
            <Button type="button" variant="outline" onClick={() => exportReport("excel")}>
              Exportar reporte Excel
            </Button>
          </div>
          <div className="space-y-2">
            <Label>Notas de cierre</Label>
            <Textarea
              value={closingNotes}
              onChange={(event) => setClosingNotes(event.target.value)}
              placeholder="Describe hallazgos, acciones pendientes o acuerdos del Comité de Comunicación y Control."
            />
          </div>
          <Button type="button" onClick={handleModuleClosure} disabled={!officialCertificateValid}>
            Cerrar módulo
          </Button>
          {state.moduleClosed && (
            <p className="text-sm text-emerald-600">
              El módulo se cerró correctamente y quedó registrado en la trazabilidad.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
