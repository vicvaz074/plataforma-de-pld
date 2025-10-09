"use client"

import { useMemo, useState } from "react"
import { addBusinessDays, differenceInBusinessDays, differenceInCalendarDays, format, formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Download, FileCheck, FileWarning, ShieldAlert, UploadCloud } from "lucide-react"
import jsPDF from "jspdf"

interface EvidenceFile {
  id: string
  fileName: string
  fileSize: number
  fileType: string
  uploadedAt: Date
  url: string
}

type ControlAnswer = "si" | "no" | "na" | ""

type ControlCategory = "lineamientos" | "auditorias" | "observaciones" | "planes"

interface ControlQuestion {
  id: string
  category: ControlCategory
  question: string
  evidenceHint: string
  relatedArticle?: string
}

interface ControlResponse {
  answer: ControlAnswer
  evidences: EvidenceFile[]
}

interface LineamientoVersion {
  version: string
  date: Date
  approvedBy: string
  notes?: string
}

interface InternalAuditRecord {
  id: string
  date: Date
  scope: string[]
  findings: string
  responsible: string
  status: "Cerrado" | "En seguimiento" | "Abierto"
  followUpDue?: Date
}

interface AuthorityRequest {
  id: string
  authority: "SAT" | "UIF"
  receivedAt: Date
  dueDate: Date
  respondedAt?: Date
  status: "Pendiente" | "En progreso" | "Cerrado"
  responsible: string
  documents: string[]
}

interface ActionPlan {
  id: string
  source: string
  action: string
  responsible: string
  deadline: Date
  status: "En seguimiento" | "Cerrado" | "Pendiente"
  progress: number
}

const controlQuestions: ControlQuestion[] = [
  {
    id: "lineamientos-90-dias",
    category: "lineamientos",
    question:
      "¿Se elaboró e integró el documento de lineamientos internos dentro del plazo de 90 días establecido en el art. 37 RCG?",
    evidenceHint: "Documento de lineamientos internos fechado y aprobado",
    relatedArticle: "Art. 37 RCG",
  },
  {
    id: "lineamientos-actualizacion",
    category: "lineamientos",
    question:
      "¿Se actualizan los lineamientos internos al menos una vez al año o cuando hay cambios normativos relevantes?",
    evidenceHint: "Versión vigente con control de cambios",
  },
  {
    id: "auditoria-periodica",
    category: "auditorias",
    question: "¿Se realizan auditorías internas periódicas a los procesos PLD-FT?",
    evidenceHint: "Informe de auditoría interna",
  },
  {
    id: "auditoria-modulos",
    category: "auditorias",
    question:
      "¿La auditoría revisa específicamente el cumplimiento de los módulos operativos (KYC, Monitoreo, Reportes UIF)?",
    evidenceHint: "Checklists de auditoría por módulo",
  },
  {
    id: "observaciones-recibidas",
    category: "observaciones",
    question: "¿Se han recibido observaciones o requerimientos de información por parte del SAT/UIF?",
    evidenceHint: "Requerimiento oficial recibido",
    relatedArticle: "Art. 9 RCG",
  },
  {
    id: "observaciones-respuesta",
    category: "observaciones",
    question:
      "¿Se dio respuesta dentro de los plazos establecidos en la normativa (art. 9 RCG)?",
    evidenceHint: "Acuse de respuesta SAT/UIF",
    relatedArticle: "Art. 9 RCG",
  },
  {
    id: "plan-accion-documento",
    category: "planes",
    question: "¿Se elaboró un plan de acción para solventar observaciones internas o externas?",
    evidenceHint: "Documento del plan de acción con responsables y plazos",
  },
  {
    id: "plan-accion-seguimiento",
    category: "planes",
    question: "¿Se da seguimiento periódico al plan hasta su cierre?",
    evidenceHint: "Reporte de avance",
  },
]

const acceptedMimeTypes = ["application/pdf", "image/jpeg"]

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

const sortByRecentDate = <T,>(items: T[], getDate: (item: T) => Date) =>
  [...items].sort((a, b) => getDate(b).getTime() - getDate(a).getTime())

export default function AuditoriaVerificacionPage() {
  const { toast } = useToast()
  const [responses, setResponses] = useState<Record<string, ControlResponse>>(() =>
    Object.fromEntries(
      controlQuestions.map((question) => [question.id, { answer: "", evidences: [] }])
    )
  )

  const [lineamientosVersions, setLineamientosVersions] = useState<LineamientoVersion[]>([
    {
      version: "1.0",
      date: new Date("2023-06-15"),
      approvedBy: "Comité de Comunicación y Control",
      notes: "Versión inicial de los lineamientos internos.",
    },
    {
      version: "1.1",
      date: new Date("2024-02-02"),
      approvedBy: "Oficial de Cumplimiento",
      notes: "Actualización por reforma de las RCG en enero 2024.",
    },
  ])

  const [newVersion, setNewVersion] = useState({ version: "", date: "", approvedBy: "", notes: "" })

  const [auditLog, setAuditLog] = useState<InternalAuditRecord[]>([
    {
      id: "AUD-2024-Q1",
      date: new Date("2024-03-25"),
      scope: ["KYC", "Monitoreo", "Reportes UIF"],
      findings: "Hallazgos menores en conciliación de operaciones inusuales. Plan de acción asignado.",
      responsible: "Auditor Interno",
      status: "Cerrado",
      followUpDue: new Date("2024-04-15"),
    },
    {
      id: "AUD-2023-Q3",
      date: new Date("2023-09-10"),
      scope: ["Beneficiario Controlador", "Capacitación"],
      findings: "Se solicitaron refuerzos de capacitación al personal de mesa de control.",
      responsible: "Auditor Externo",
      status: "Cerrado",
    },
  ])

  const [newAudit, setNewAudit] = useState({
    id: "",
    date: "",
    scope: "",
    findings: "",
    responsible: "",
    followUpDue: "",
  })

  const [authorityRequests, setAuthorityRequests] = useState<AuthorityRequest[]>([
    {
      id: "SAT-2024-01",
      authority: "SAT",
      receivedAt: new Date("2024-05-20"),
      dueDate: addBusinessDays(new Date("2024-05-20"), 10),
      status: "En progreso",
      responsible: "Oficial de Cumplimiento",
      documents: ["Oficio SAT del 20/05/2024"],
    },
    {
      id: "UIF-2023-11",
      authority: "UIF",
      receivedAt: new Date("2023-11-08"),
      dueDate: addBusinessDays(new Date("2023-11-08"), 10),
      respondedAt: new Date("2023-11-21"),
      status: "Cerrado",
      responsible: "Dirección Jurídica",
      documents: ["Oficio UIF 11/2023", "Acuse UIF 21/11/2023"],
    },
  ])

  const [newRequest, setNewRequest] = useState({
    id: "",
    authority: "SAT",
    receivedAt: "",
    respondedAt: "",
    documents: "",
    responsible: "",
  })

  const [actionPlans, setActionPlans] = useState<ActionPlan[]>([
    {
      id: "PA-2024-01",
      source: "Auditoría interna AUD-2024-Q1",
      action: "Actualizar matriz de conciliación de operaciones inusuales y capacitar al equipo.",
      responsible: "Coordinación de Cumplimiento",
      deadline: new Date("2024-04-30"),
      status: "En seguimiento",
      progress: 60,
    },
    {
      id: "PA-2023-05",
      source: "Observación UIF-2023-11",
      action: "Documentar justificación de operaciones relevantes de octubre 2023.",
      responsible: "Mesa de Control",
      deadline: new Date("2023-12-15"),
      status: "Cerrado",
      progress: 100,
    },
  ])

  const [newActionPlan, setNewActionPlan] = useState({
    id: "",
    source: "",
    action: "",
    responsible: "",
    deadline: "",
  })

  const answeredQuestions = useMemo(
    () =>
      Object.values(responses).filter((response) => response.answer && response.answer !== "").length,
    [responses]
  )

  const progressValue = useMemo(
    () => Math.round((answeredQuestions / controlQuestions.length) * 100),
    [answeredQuestions]
  )

  const latestLineamiento = useMemo(
    () => sortByRecentDate(lineamientosVersions, (item) => item.date)[0],
    [lineamientosVersions]
  )

  const lastAudit = useMemo(() => sortByRecentDate(auditLog, (item) => item.date)[0], [auditLog])

  const overdueAuthorityRequests = useMemo(
    () =>
      authorityRequests.filter(
        (request) =>
          request.status !== "Cerrado" &&
          differenceInBusinessDays(new Date(), request.dueDate) > 0,
      ),
    [authorityRequests]
  )

  const upcomingDeadlines = useMemo(
    () =>
      authorityRequests.filter((request) => {
        if (request.status === "Cerrado") return false
        const businessDaysRemaining = differenceInBusinessDays(request.dueDate, new Date())
        return businessDaysRemaining >= 0 && businessDaysRemaining <= 2
      }),
    [authorityRequests]
  )

  const auditCompliant = useMemo(() => {
    if (!lastAudit) return false
    return differenceInCalendarDays(new Date(), lastAudit.date) <= 365
  }, [lastAudit])

  const lineamientosNeedUpdate = useMemo(() => {
    if (!latestLineamiento) return false
    return differenceInCalendarDays(new Date(), latestLineamiento.date) > 365
  }, [latestLineamiento])

  const allEvidences = useMemo(
    () =>
      Object.entries(responses).flatMap(([questionId, response]) =>
        response.evidences.map((evidence) => ({ ...evidence, questionId }))
      ),
    [responses]
  )

  const handleAnswerChange = (questionId: string, answer: ControlAnswer) => {
    setResponses((prev) => ({ ...prev, [questionId]: { ...prev[questionId], answer } }))
  }

  const handleEvidenceUpload = (questionId: string, fileList: FileList | null) => {
    if (!fileList?.length) return

    const files = Array.from(fileList)
    const invalidFiles = files.filter((file) => !acceptedMimeTypes.includes(file.type))

    if (invalidFiles.length) {
      toast({
        title: "Formato no permitido",
        description: "Solo se aceptan archivos PDF o JPG.",
        variant: "destructive",
      })
      return
    }

    const evidences = files.map<EvidenceFile>((file) => ({
      id: crypto.randomUUID(),
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      uploadedAt: new Date(),
      url: URL.createObjectURL(file),
    }))

    setResponses((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        evidences: [...prev[questionId].evidences, ...evidences],
      },
    }))

    toast({
      title: "Evidencia cargada",
      description: `${files.length} archivo(s) agregado(s) con sello de tiempo.`,
    })
  }

  const removeEvidence = (questionId: string, evidenceId: string) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        evidences: prev[questionId].evidences.filter((evidence) => evidence.id !== evidenceId),
      },
    }))
  }

  const handleAddLineamientoVersion = () => {
    if (!newVersion.version || !newVersion.date || !newVersion.approvedBy) {
      toast({
        title: "Campos incompletos",
        description: "Captura versión, fecha y aprobador para registrar la actualización.",
        variant: "destructive",
      })
      return
    }

    const version: LineamientoVersion = {
      version: newVersion.version,
      date: new Date(newVersion.date),
      approvedBy: newVersion.approvedBy,
      notes: newVersion.notes || undefined,
    }

    setLineamientosVersions((prev) => sortByRecentDate([...prev, version], (item) => item.date))
    setNewVersion({ version: "", date: "", approvedBy: "", notes: "" })
    toast({
      title: "Versión registrada",
      description: "Se actualizó el control de versiones de lineamientos internos.",
    })
  }

  const handleAddAudit = () => {
    if (!newAudit.id || !newAudit.date || !newAudit.scope || !newAudit.findings || !newAudit.responsible) {
      toast({
        title: "Campos incompletos",
        description: "Completa ID, fecha, alcance, hallazgos y responsable de la auditoría.",
        variant: "destructive",
      })
      return
    }

    const record: InternalAuditRecord = {
      id: newAudit.id,
      date: new Date(newAudit.date),
      scope: newAudit.scope.split(",").map((item) => item.trim()).filter(Boolean),
      findings: newAudit.findings,
      responsible: newAudit.responsible,
      status: "En seguimiento",
      followUpDue: newAudit.followUpDue ? new Date(newAudit.followUpDue) : undefined,
    }

    setAuditLog((prev) => sortByRecentDate([...prev, record], (item) => item.date))
    setNewAudit({ id: "", date: "", scope: "", findings: "", responsible: "", followUpDue: "" })
    toast({ title: "Auditoría registrada", description: "La bitácora de auditorías fue actualizada." })
  }

  const handleAddRequest = () => {
    if (!newRequest.id || !newRequest.receivedAt || !newRequest.responsible) {
      toast({
        title: "Campos incompletos",
        description: "Incluye folio, fecha de recepción y responsable para registrar la observación.",
        variant: "destructive",
      })
      return
    }

    const receivedAt = new Date(newRequest.receivedAt)
    const request: AuthorityRequest = {
      id: newRequest.id,
      authority: newRequest.authority as "SAT" | "UIF",
      receivedAt,
      dueDate: addBusinessDays(receivedAt, 10),
      respondedAt: newRequest.respondedAt ? new Date(newRequest.respondedAt) : undefined,
      status: newRequest.respondedAt ? "Cerrado" : "Pendiente",
      responsible: newRequest.responsible,
      documents: newRequest.documents
        ? newRequest.documents.split(",").map((item) => item.trim()).filter(Boolean)
        : [],
    }

    setAuthorityRequests((prev) => sortByRecentDate([...prev, request], (item) => item.receivedAt))
    setNewRequest({ id: "", authority: "SAT", receivedAt: "", respondedAt: "", documents: "", responsible: "" })
    toast({
      title: "Observación registrada",
      description: "Se agregaron los plazos de respuesta y documentación asociada.",
    })
  }

  const updateRequestStatus = (requestId: string, status: AuthorityRequest["status"]) => {
    setAuthorityRequests((prev) =>
      prev.map((request) =>
        request.id === requestId
          ? {
              ...request,
              status,
              respondedAt: status === "Cerrado" ? new Date() : request.respondedAt,
            }
          : request
      )
    )
  }

  const handleAddActionPlan = () => {
    if (!newActionPlan.id || !newActionPlan.source || !newActionPlan.action || !newActionPlan.responsible || !newActionPlan.deadline) {
      toast({
        title: "Campos incompletos",
        description: "Completa folio, origen, acción, responsable y fecha compromiso.",
        variant: "destructive",
      })
      return
    }

    const plan: ActionPlan = {
      id: newActionPlan.id,
      source: newActionPlan.source,
      action: newActionPlan.action,
      responsible: newActionPlan.responsible,
      deadline: new Date(newActionPlan.deadline),
      status: "Pendiente",
      progress: 0,
    }

    setActionPlans((prev) => sortByRecentDate([...prev, plan], (item) => item.deadline))
    setNewActionPlan({ id: "", source: "", action: "", responsible: "", deadline: "" })
    toast({ title: "Plan de acción creado", description: "Ahora puedes dar seguimiento a su cumplimiento." })
  }

  const updatePlanStatus = (planId: string, status: ActionPlan["status"]) => {
    setActionPlans((prev) =>
      prev.map((plan) =>
        plan.id === planId
          ? {
              ...plan,
              status,
              progress: status === "Cerrado" ? 100 : plan.progress,
            }
          : plan
      )
    )
  }

  const updatePlanProgress = (planId: string, progress: number) => {
    setActionPlans((prev) =>
      prev.map((plan) => (plan.id === planId ? { ...plan, progress: Math.min(Math.max(progress, 0), 100) } : plan))
    )
  }

  const exportAuditsToExcel = () => {
    const header = "ID,Fecha,Alcance,Hallazgos,Responsable,Estatus\n"
    const rows = auditLog
      .map((record) =>
        [
          record.id,
          format(record.date, "yyyy-MM-dd"),
          record.scope.join(" | "),
          record.findings.replace(/\n/g, " "),
          record.responsible,
          record.status,
        ].join(","),
      )
      .join("\n")

    const csvContent = `${header}${rows}`
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", "auditorias-internas.csv")
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportAuditsToPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" })
    doc.setFontSize(14)
    doc.text("Informe de Auditorías Internas", 14, 18)

    doc.setFontSize(10)
    const startY = 28
    const columnWidths = [30, 30, 60, 120, 40, 30]
    const headers = ["ID", "Fecha", "Alcance", "Hallazgos", "Responsable", "Estatus"]

    let currentY = startY

    doc.setFont(undefined, "bold")
    headers.forEach((header, index) => {
      doc.text(header, 14 + columnWidths.slice(0, index).reduce((acc, width) => acc + width, 0), currentY)
    })

    doc.setFont(undefined, "normal")
    currentY += 8

    auditLog.forEach((record) => {
      const values = [
        record.id,
        format(record.date, "dd/MM/yyyy"),
        record.scope.join(" | "),
        record.findings,
        record.responsible,
        record.status,
      ]

      values.forEach((value, index) => {
        const text = doc.splitTextToSize(String(value), columnWidths[index] - 4)
        doc.text(text, 14 + columnWidths.slice(0, index).reduce((acc, width) => acc + width, 0), currentY)
      })

      currentY += 10
      if (currentY > 190) {
        doc.addPage()
        currentY = 20
      }
    })

    doc.save("auditorias-internas.pdf")
  }

  const renderQuestions = (category: ControlCategory) => (
    <div className="space-y-6">
      {controlQuestions
        .filter((question) => question.category === category)
        .map((question) => {
          const response = responses[question.id]

          return (
            <Card key={question.id} className="border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">{question.question}</CardTitle>
                <CardDescription>
                  {question.evidenceHint}
                  {question.relatedArticle ? ` · ${question.relatedArticle}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  {(["si", "no", "na"] as ControlAnswer[]).map((option) => (
                    <Button
                      key={option}
                      variant={response.answer === option ? "default" : "outline"}
                      className="capitalize"
                      onClick={() => handleAnswerChange(question.id, option)}
                      type="button"
                    >
                      {option === "si" ? "Sí" : option === "no" ? "No" : "No aplica"}
                    </Button>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Carga de evidencia (PDF/JPG)</p>
                      <p className="text-xs text-muted-foreground">
                        Asocia la documentación correspondiente. Todas las cargas incluyen sello de tiempo automático.
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary">
                      <UploadCloud className="h-4 w-4" />
                      Adjuntar archivos
                      <input
                        type="file"
                        accept=".pdf,image/jpeg"
                        multiple
                        className="hidden"
                        onChange={(event) => handleEvidenceUpload(question.id, event.target.files)}
                      />
                    </label>
                  </div>

                  {response.evidences.length > 0 && (
                    <div className="space-y-2 rounded-md border bg-muted/30 p-4">
                      <p className="text-sm font-semibold">Evidencias asociadas</p>
                      <div className="space-y-3">
                        {response.evidences.map((evidence) => (
                          <div
                            key={evidence.id}
                            className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-medium">{evidence.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(evidence.uploadedAt, "dd/MM/yyyy HH:mm", { locale: es })} · {formatBytes(evidence.fileSize)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <a
                                href={evidence.url}
                                download={evidence.fileName}
                                className="text-xs font-medium text-primary hover:underline"
                              >
                                Descargar
                              </a>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => removeEvidence(question.id, evidence.id)}
                              >
                                Eliminar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
    </div>
  )

  return (
    <div className="container mx-auto space-y-8 pb-16 pt-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Auditoría y Verificación Interna</h1>
        <p className="max-w-3xl text-muted-foreground">
          Supervisa el cumplimiento documental y operativo del programa PLD-FT, registra lineamientos internos, auditorías, observaciones de autoridades y planes de acción con trazabilidad completa.
        </p>
      </div>

      <Alert className="border-primary/40 bg-primary/10">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Obligaciones clave</AlertTitle>
        <AlertDescription>
          Lineamientos internos actualizados dentro de los 90 días (art. 37 RCG) y atención a requerimientos de SAT/UIF en plazos máximos de 10 días hábiles (art. 9 RCG). Configura recordatorios y conserva la evidencia en este módulo.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Estado general del módulo</CardTitle>
          <CardDescription>Checklist dinámico, alertas automáticas y trazabilidad documental de auditoría interna.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
            <p className="text-sm font-medium text-muted-foreground">Avance del checklist</p>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-semibold">{progressValue}%</span>
              <Badge variant={progressValue === 100 ? "default" : "secondary"}>{answeredQuestions}/{controlQuestions.length} preguntas</Badge>
            </div>
            <Progress value={progressValue} className="h-2" />
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
            <p className="text-sm font-medium text-muted-foreground">Última actualización de lineamientos</p>
            {latestLineamiento ? (
              <div>
                <p className="text-base font-semibold">
                  {format(latestLineamiento.date, "dd 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
                <p className="text-xs text-muted-foreground">Aprobado por {latestLineamiento.approvedBy}</p>
                <Badge
                  className="mt-2"
                  variant={lineamientosNeedUpdate ? "destructive" : "default"}
                >
                  {lineamientosNeedUpdate ? "Actualización requerida" : "En regla"}
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin versiones registradas.</p>
            )}
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
            <p className="text-sm font-medium text-muted-foreground">Auditoría interna</p>
            {lastAudit ? (
              <div>
                <p className="text-base font-semibold">{lastAudit.id}</p>
                <p className="text-xs text-muted-foreground">
                  {format(lastAudit.date, "dd/MM/yyyy")} · {lastAudit.scope.join(", ")}
                </p>
                <Badge className="mt-2" variant={auditCompliant ? "default" : "destructive"}>
                  {auditCompliant ? "Vigente" : "Programar revisión"}
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Registra la primera auditoría interna.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="lineamientos" className="space-y-6">
        <TabsList className="flex flex-wrap justify-start gap-2">
          <TabsTrigger value="lineamientos">Lineamientos internos</TabsTrigger>
          <TabsTrigger value="auditorias">Auditorías internas</TabsTrigger>
          <TabsTrigger value="observaciones">Observaciones SAT/UIF</TabsTrigger>
          <TabsTrigger value="planes">Planes de acción</TabsTrigger>
        </TabsList>

        <TabsContent value="lineamientos" className="space-y-6">
          {renderQuestions("lineamientos")}

          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle>Control de versiones de lineamientos</CardTitle>
              <CardDescription>Actualiza y conserva el historial completo de lineamientos internos con trazabilidad.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Input
                  placeholder="Versión (ej. 1.2)"
                  value={newVersion.version}
                  onChange={(event) => setNewVersion((prev) => ({ ...prev, version: event.target.value }))}
                />
                <Input
                  type="date"
                  value={newVersion.date}
                  onChange={(event) => setNewVersion((prev) => ({ ...prev, date: event.target.value }))}
                />
                <Input
                  placeholder="Aprobado por"
                  value={newVersion.approvedBy}
                  onChange={(event) => setNewVersion((prev) => ({ ...prev, approvedBy: event.target.value }))}
                />
                <Input
                  placeholder="Notas (opcional)"
                  value={newVersion.notes}
                  onChange={(event) => setNewVersion((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>
              <Button type="button" onClick={handleAddLineamientoVersion} className="w-full md:w-auto">
                Registrar actualización
              </Button>

              <div className="space-y-3">
                {lineamientosVersions.map((version) => (
                  <div
                    key={`${version.version}-${version.date.toISOString()}`}
                    className="rounded-md border border-border/60 bg-muted/30 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">Versión {version.version}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(version.date, "dd/MM/yyyy", { locale: es })} · {version.approvedBy}
                        </p>
                      </div>
                      <Badge variant="secondary">Histórico</Badge>
                    </div>
                    {version.notes && (
                      <p className="mt-2 text-sm text-muted-foreground">{version.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auditorias" className="space-y-6">
          {renderQuestions("auditorias")}

          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle>Bitácora de auditorías internas</CardTitle>
              <CardDescription>Registra revisiones periódicas y seguimiento a hallazgos críticos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  placeholder="ID auditoría"
                  value={newAudit.id}
                  onChange={(event) => setNewAudit((prev) => ({ ...prev, id: event.target.value }))}
                />
                <Input
                  type="date"
                  value={newAudit.date}
                  onChange={(event) => setNewAudit((prev) => ({ ...prev, date: event.target.value }))}
                />
                <Input
                  placeholder="Responsable"
                  value={newAudit.responsible}
                  onChange={(event) => setNewAudit((prev) => ({ ...prev, responsible: event.target.value }))}
                />
                <Input
                  placeholder="Alcance (separa con comas)"
                  value={newAudit.scope}
                  onChange={(event) => setNewAudit((prev) => ({ ...prev, scope: event.target.value }))}
                />
                <Textarea
                  placeholder="Hallazgos relevantes"
                  value={newAudit.findings}
                  onChange={(event) => setNewAudit((prev) => ({ ...prev, findings: event.target.value }))}
                  className="md:col-span-2"
                />
                <Input
                  type="date"
                  value={newAudit.followUpDue}
                  onChange={(event) => setNewAudit((prev) => ({ ...prev, followUpDue: event.target.value }))}
                  placeholder="Fecha compromiso"
                />
              </div>
              <Button type="button" onClick={handleAddAudit} className="w-full md:w-auto">
                Registrar auditoría
              </Button>

              <div className="space-y-4">
                {auditLog.map((record) => (
                  <div
                    key={record.id}
                    className="rounded-md border border-border/60 bg-muted/30 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{record.id}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(record.date, "dd/MM/yyyy", { locale: es })} · Alcance: {record.scope.join(", ")}
                        </p>
                      </div>
                      <Badge variant={record.status === "Cerrado" ? "default" : "secondary"}>{record.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm">{record.findings}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Responsable: {record.responsible}</p>
                    {record.followUpDue && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Seguimiento comprometido al {format(record.followUpDue, "dd/MM/yyyy", { locale: es })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">Exporta la bitácora para visitas de verificación SAT/UIF.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={exportAuditsToExcel}>
                  <Download className="mr-2 h-4 w-4" /> Exportar Excel
                </Button>
                <Button type="button" onClick={exportAuditsToPdf}>
                  <Download className="mr-2 h-4 w-4" /> Exportar PDF
                </Button>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="observaciones" className="space-y-6">
          {renderQuestions("observaciones")}

          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle>Observaciones y requerimientos SAT/UIF</CardTitle>
              <CardDescription>Control de vencimientos de 10 días hábiles y documentación de respuestas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  placeholder="Folio"
                  value={newRequest.id}
                  onChange={(event) => setNewRequest((prev) => ({ ...prev, id: event.target.value }))}
                />
                <Select
                  value={newRequest.authority}
                  onValueChange={(value) => setNewRequest((prev) => ({ ...prev, authority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Autoridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAT">SAT</SelectItem>
                    <SelectItem value="UIF">UIF</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={newRequest.receivedAt}
                  onChange={(event) => setNewRequest((prev) => ({ ...prev, receivedAt: event.target.value }))}
                />
                <Input
                  placeholder="Documentos (separa con comas)"
                  value={newRequest.documents}
                  onChange={(event) => setNewRequest((prev) => ({ ...prev, documents: event.target.value }))}
                  className="md:col-span-2"
                />
                <Input
                  placeholder="Responsable"
                  value={newRequest.responsible}
                  onChange={(event) => setNewRequest((prev) => ({ ...prev, responsible: event.target.value }))}
                />
                <Input
                  type="date"
                  value={newRequest.respondedAt}
                  onChange={(event) => setNewRequest((prev) => ({ ...prev, respondedAt: event.target.value }))}
                  placeholder="Fecha de respuesta"
                />
              </div>
              <Button type="button" onClick={handleAddRequest} className="w-full md:w-auto">
                Registrar observación
              </Button>

              <div className="space-y-4">
                {authorityRequests.map((request) => {
                  const overdue = request.status !== "Cerrado" && differenceInBusinessDays(new Date(), request.dueDate) > 0
                  const dueIn = differenceInBusinessDays(request.dueDate, new Date())

                  return (
                    <div
                      key={request.id}
                      className="rounded-md border border-border/60 bg-muted/30 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{request.id} · {request.authority}</p>
                          <p className="text-xs text-muted-foreground">
                            Recibido el {format(request.receivedAt, "dd/MM/yyyy", { locale: es })} · vence {format(request.dueDate, "dd/MM/yyyy", { locale: es })}
                          </p>
                        </div>
                        <Badge variant={overdue ? "destructive" : "secondary"}>{request.status}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Responsable: {request.responsible} · Documentos: {request.documents.join(", ") || "Sin adjuntar"}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {request.respondedAt ? (
                          <span>
                            Respondido el {format(request.respondedAt, "dd/MM/yyyy", { locale: es })} ({formatDistanceToNow(request.respondedAt, { addSuffix: true, locale: es })})
                          </span>
                        ) : (
                          <span>
                            {overdue
                              ? `Vencido hace ${Math.abs(differenceInBusinessDays(new Date(), request.dueDate))} día(s) hábil(es)`
                              : `Restan ${dueIn} día(s) hábil(es)`}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateRequestStatus(request.id, "En progreso")}
                        >
                          Marcar en seguimiento
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => updateRequestStatus(request.id, "Cerrado")}
                        >
                          Cerrar requerimiento
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="planes" className="space-y-6">
          {renderQuestions("planes")}

          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle>Planes de acción y seguimiento</CardTitle>
              <CardDescription>Documenta responsables, plazos y avances hasta el cierre de cada observación.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Folio"
                  value={newActionPlan.id}
                  onChange={(event) => setNewActionPlan((prev) => ({ ...prev, id: event.target.value }))}
                />
                <Input
                  placeholder="Origen de la observación"
                  value={newActionPlan.source}
                  onChange={(event) => setNewActionPlan((prev) => ({ ...prev, source: event.target.value }))}
                />
                <Textarea
                  placeholder="Acción a realizar"
                  value={newActionPlan.action}
                  onChange={(event) => setNewActionPlan((prev) => ({ ...prev, action: event.target.value }))}
                  className="md:col-span-2"
                />
                <Input
                  placeholder="Responsable"
                  value={newActionPlan.responsible}
                  onChange={(event) => setNewActionPlan((prev) => ({ ...prev, responsible: event.target.value }))}
                />
                <Input
                  type="date"
                  value={newActionPlan.deadline}
                  onChange={(event) => setNewActionPlan((prev) => ({ ...prev, deadline: event.target.value }))}
                />
              </div>
              <Button type="button" onClick={handleAddActionPlan} className="w-full md:w-auto">
                Registrar plan de acción
              </Button>

              <div className="space-y-4">
                {actionPlans.map((plan) => {
                  const overdue = plan.status !== "Cerrado" && differenceInCalendarDays(new Date(), plan.deadline) > 0

                  return (
                    <div
                      key={plan.id}
                      className="rounded-md border border-border/60 bg-muted/30 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{plan.id}</p>
                          <p className="text-xs text-muted-foreground">Origen: {plan.source}</p>
                        </div>
                        <Badge variant={overdue ? "destructive" : "secondary"}>{plan.status}</Badge>
                      </div>
                      <p className="mt-2 text-sm">{plan.action}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Responsable: {plan.responsible} · Compromiso {format(plan.deadline, "dd/MM/yyyy", { locale: es })}
                      </p>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span>Avance</span>
                          <span>{plan.progress}%</span>
                        </div>
                        <Progress value={plan.progress} className="h-2" />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updatePlanStatus(plan.id, "En seguimiento")}
                        >
                          Marcar en seguimiento
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => updatePlanStatus(plan.id, "Cerrado")}
                        >
                          Cerrar plan
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={plan.progress}
                          onChange={(event) => updatePlanProgress(plan.id, Number(event.target.value))}
                          className="w-24"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Alertas automáticas</CardTitle>
            <CardDescription>Recordatorios basados en fechas de auditorías, lineamientos y observaciones.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lineamientosNeedUpdate ? (
              <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                <FileWarning className="h-4 w-4" />
                <AlertTitle>Actualiza lineamientos internos</AlertTitle>
                <AlertDescription>
                  Han transcurrido más de 12 meses desde la última versión ({latestLineamiento && format(latestLineamiento.date, "dd/MM/yyyy")}). Genera una nueva versión y documenta los cambios.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-emerald-500/40 bg-emerald-500/10">
                <FileCheck className="h-4 w-4" />
                <AlertTitle>Lineamientos vigentes</AlertTitle>
                <AlertDescription>
                  La última actualización cumple con la periodicidad anual. Programa la próxima revisión para mantener cumplimiento continuo.
                </AlertDescription>
              </Alert>
            )}

            {auditCompliant ? (
              <Alert className="border-emerald-500/40 bg-emerald-500/10">
                <FileCheck className="h-4 w-4" />
                <AlertTitle>Auditoría interna vigente</AlertTitle>
                <AlertDescription>
                  La auditoría {lastAudit?.id} cubrió los módulos críticos hace {lastAudit ? formatDistanceToNow(lastAudit.date, { addSuffix: true, locale: es }) : "poco"}.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                <FileWarning className="h-4 w-4" />
                <AlertTitle>Programa una auditoría</AlertTitle>
                <AlertDescription>
                  No se han registrado auditorías en los últimos 12 meses. Agenda una revisión y documenta el alcance.
                </AlertDescription>
              </Alert>
            )}

            {upcomingDeadlines.map((request) => (
              <Alert key={request.id} className="border-amber-500/40 bg-amber-500/10">
                <FileWarning className="h-4 w-4" />
                <AlertTitle>Plazo próximo a vencer</AlertTitle>
                <AlertDescription>
                  {request.id} ({request.authority}) vence en {differenceInBusinessDays(request.dueDate, new Date())} día(s) hábil(es). Responsable: {request.responsible}.
                </AlertDescription>
              </Alert>
            ))}

            {overdueAuthorityRequests.map((request) => (
              <Alert key={`${request.id}-overdue`} variant="destructive" className="border-destructive/50 bg-destructive/10">
                <FileWarning className="h-4 w-4" />
                <AlertTitle>Respuesta vencida</AlertTitle>
                <AlertDescription>
                  {request.id} excedió el plazo de 10 días hábiles. Prioriza la integración y carga de evidencia para cierre.
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Repositorio digital central</CardTitle>
            <CardDescription>Conserva lineamientos, informes, evidencias y planes de acción con sello de tiempo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Evidencias del checklist</p>
              {allEvidences.length ? (
                <div className="space-y-2 max-h-60 overflow-y-auto rounded-md border bg-muted/30 p-3">
                  {allEvidences.map((evidence) => (
                    <div key={evidence.id} className="rounded-md border border-border/60 bg-background p-3">
                      <p className="text-sm font-medium">{evidence.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        Pregunta: {controlQuestions.find((question) => question.id === evidence.questionId)?.question ?? ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Cargado el {format(evidence.uploadedAt, "dd/MM/yyyy HH:mm", { locale: es })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aún no hay documentos cargados.</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold">Historial resumido</p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>{auditLog.length} auditoría(s) registradas</li>
                <li>{authorityRequests.length} observación(es) de autoridades en seguimiento</li>
                <li>{actionPlans.length} plan(es) de acción activos</li>
                <li>{lineamientosVersions.length} versión(es) de lineamientos conservadas</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
