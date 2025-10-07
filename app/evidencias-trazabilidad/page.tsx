"use client"

import { useEffect, useMemo, useState } from "react"
import { jsPDF } from "jspdf"
import { addYears, differenceInMonths, format } from "date-fns"
import { es } from "date-fns/locale"
import {
  Archive,
  BellRing,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  FolderOpen,
  History,
  Layers,
  ShieldCheck,
  Upload,
} from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/components/ui/use-toast"

type ModuleKey =
  | "kyc"
  | "beneficiario"
  | "monitoreo"
  | "reportes"
  | "capacitacion"
  | "auditoria"

interface EvidenceRequirement {
  id: string
  label: string
  mandatory: boolean
  description?: string
}

interface EvidenceModule {
  id: ModuleKey
  title: string
  description: string
  submodules: { id: string; label: string }[]
  requirements: EvidenceRequirement[]
}

interface VersionEntry {
  version: number
  timestamp: string
  user: string
  changeNote: string
}

interface EvidenceDocument {
  id: string
  expedienteId: string
  module: ModuleKey
  submodule: string
  documentType: string
  title: string
  notes?: string
  uploadDate: string
  documentDate: string
  user: string
  fileName: string
  fileSize: number
  fileType: string
  fileData: string
  version: number
  versionHistory: VersionEntry[]
  archived: boolean
}

interface TraceLogEntry {
  id: string
  documentId: string
  expedienteId: string
  module: ModuleKey
  action: "upload" | "view" | "download" | "archive"
  timestamp: string
  user: string
  details: string
}

const MODULES: EvidenceModule[] = [
  {
    id: "kyc",
    title: "KYC y Expedientes",
    description:
      "Control de identificaciones, comprobantes y documentación soporte de conocimiento del cliente.",
    submodules: [
      { id: "persona-fisica", label: "Persona Física" },
      { id: "persona-moral", label: "Persona Moral" },
      { id: "persona-extranjera", label: "Persona Extranjera" },
      { id: "fideicomiso", label: "Fideicomiso" },
    ],
    requirements: [
      {
        id: "identificacion-oficial",
        label: "Identificación oficial vigente",
        mandatory: true,
        description: "INE, pasaporte o documento migratorio.",
      },
      {
        id: "comprobante-domicilio",
        label: "Comprobante de domicilio &lt; 3 meses",
        mandatory: true,
      },
      {
        id: "rfc-curp",
        label: "Constancia RFC/CURP",
        mandatory: true,
      },
      {
        id: "estructura-societaria",
        label: "Estructura societaria/organigrama",
        mandatory: false,
      },
    ],
  },
  {
    id: "beneficiario",
    title: "Beneficiario Controlador",
    description: "Documentos y declaraciones que acreditan el control efectivo.",
    submodules: [
      { id: "declaracion", label: "Declaraciones" },
      { id: "actas", label: "Actas y soportes" },
    ],
    requirements: [
      { id: "declaracion-beneficiario", label: "Declaración firmada", mandatory: true },
      { id: "identificacion-beneficiario", label: "Identificación beneficiario", mandatory: true },
      {
        id: "organigrama-control",
        label: "Organigrama control efectivo",
        mandatory: false,
      },
    ],
  },
  {
    id: "monitoreo",
    title: "Monitoreo de Operaciones",
    description: "Evidencias de reportes de acumulación y dictámenes de operaciones.",
    submodules: [
      { id: "reportes-acumulacion", label: "Reportes semestrales" },
      { id: "dictamen-inusual", label: "Dictámenes operaciones inusuales" },
    ],
    requirements: [
      { id: "reporte-semestral", label: "Reporte semestral vigente", mandatory: true },
      { id: "dictamen-inusual", label: "Dictamen de operación inusual", mandatory: true },
    ],
  },
  {
    id: "reportes",
    title: "Reportes UIF",
    description: "Evidencias presentadas ante la UIF/SAT con folio y sello digital.",
    submodules: [
      { id: "relevante", label: "Operaciones relevantes" },
      { id: "inusual", label: "Operaciones inusuales" },
      { id: "interna", label: "Operaciones internas preocupantes" },
    ],
    requirements: [
      { id: "acuse-presentacion", label: "Acuse con sello digital", mandatory: true },
      { id: "dictamen-oficial", label: "Dictamen oficial cumplimiento", mandatory: true },
    ],
  },
  {
    id: "capacitacion",
    title: "Capacitación",
    description: "Constancias, listas de asistencia y planes anuales.",
    submodules: [
      { id: "plan-anual", label: "Plan anual" },
      { id: "listas", label: "Listas de asistencia" },
      { id: "materiales", label: "Materiales de curso" },
    ],
    requirements: [
      { id: "plan-capacitacion", label: "Plan anual aprobado", mandatory: true },
      { id: "constancias", label: "Constancias emitidas", mandatory: true },
    ],
  },
  {
    id: "auditoria",
    title: "Auditoría y Seguimiento",
    description: "Planes de acción, informes y atención a observaciones.",
    submodules: [
      { id: "plan-auditoria", label: "Plan de auditoría" },
      { id: "informes", label: "Informes y hallazgos" },
      { id: "seguimiento", label: "Seguimiento a observaciones" },
    ],
    requirements: [
      { id: "informe-auditoria", label: "Informe anual de auditoría", mandatory: true },
      { id: "plan-accion", label: "Plan de acción y seguimiento", mandatory: true },
    ],
  },
]

const RETENTION_YEARS = 5
const RETENTION_ALERT_MONTHS = 6

const STORAGE_KEYS = {
  documents: "pld-evidences-documents",
  logs: "pld-evidences-logs",
}

const randomId = () => crypto.randomUUID()

export default function EvidenciasTrazabilidadPage() {
  const { toast } = useToast()

  const [selectedModule, setSelectedModule] = useState<ModuleKey>("kyc")
  const [documents, setDocuments] = useState<EvidenceDocument[]>([])
  const [logs, setLogs] = useState<TraceLogEntry[]>([])
  const [formState, setFormState] = useState({
    expedienteId: "",
    submodule: "",
    documentType: "",
    title: "",
    documentDate: "",
    user: "",
    notes: "",
    file: null as File | null,
  })
  const [selectedExpediente, setSelectedExpediente] = useState<string>("")
  const [showOnlyAlerts, setShowOnlyAlerts] = useState(false)
  const [sessionOperator, setSessionOperator] = useState("")

  useEffect(() => {
    const storedDocs = localStorage.getItem(STORAGE_KEYS.documents)
    const storedLogs = localStorage.getItem(STORAGE_KEYS.logs)
    if (storedDocs) {
      setDocuments(JSON.parse(storedDocs))
    }
    if (storedLogs) {
      setLogs(JSON.parse(storedLogs))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.documents, JSON.stringify(documents))
  }, [documents])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs))
  }, [logs])

  const expedienteMap = useMemo(() => {
    const map = new Map<string, EvidenceDocument[]>()
    documents.forEach((doc) => {
      if (!map.has(doc.expedienteId)) {
        map.set(doc.expedienteId, [])
      }
      map.get(doc.expedienteId)!.push(doc)
    })
    return map
  }, [documents])

  const dashboardStats = useMemo(() => {
    const expedientes = Array.from(expedienteMap.entries())
    const totalExpedientes = expedientes.length
    let complete = 0
    let documentsExpiring = 0

    expedientes.forEach(([_, docs]) => {
      const modulesStatus = MODULES.map((module) => {
        const moduleDocs = docs.filter((doc) => doc.module === module.id && !doc.archived)
        const missing = module.requirements.filter((req) =>
          req.mandatory
            ? !moduleDocs.some((doc) => doc.documentType === req.id && !doc.archived)
            : false,
        )
        return missing.length === 0
      })
      if (modulesStatus.every(Boolean)) {
        complete += 1
      }

      docs.forEach((doc) => {
        if (doc.archived) return
        const monthsToExpire = getMonthsToRetentionLimit(doc.documentDate)
        if (monthsToExpire >= 0 && monthsToExpire <= RETENTION_ALERT_MONTHS) {
          documentsExpiring += 1
        }
      })
    })

    return {
      totalExpedientes,
      complete,
      completionRate: totalExpedientes === 0 ? 0 : Math.round((complete / totalExpedientes) * 100),
      documentsExpiring,
      totalDocuments: documents.filter((doc) => !doc.archived).length,
    }
  }, [documents, expedienteMap])

  const expedientesWithAlerts = useMemo(() => {
    return Array.from(expedienteMap.entries()).map(([expedienteId, docs]) => {
      const missingByModule = MODULES.map((module) => {
        const moduleDocs = docs.filter((doc) => doc.module === module.id && !doc.archived)
        const missing = module.requirements.filter((req) =>
          req.mandatory ? !moduleDocs.some((doc) => doc.documentType === req.id) : false,
        )
        return { module, missing }
      })

      const documentsAboutToExpire = docs.filter((doc) => {
        if (doc.archived) return false
        const monthsToExpire = getMonthsToRetentionLimit(doc.documentDate)
        return monthsToExpire >= 0 && monthsToExpire <= RETENTION_ALERT_MONTHS
      })

      return {
        expedienteId,
        missingByModule,
        documentsAboutToExpire,
      }
    })
  }, [expedienteMap])

  const filteredExpedientes = showOnlyAlerts
    ? expedientesWithAlerts.filter(
        (expediente) =>
          expediente.documentsAboutToExpire.length > 0 ||
          expediente.missingByModule.some((status) => status.missing.length > 0),
      )
    : expedientesWithAlerts

  const handleFormChange = (field: keyof typeof formState, value: string | File | null) => {
    setFormState((prev) => ({ ...prev, [field]: value }))
  }

  const handleUpload = () => {
    if (
      !formState.file ||
      !formState.documentType ||
      !formState.expedienteId ||
      !formState.submodule ||
      !formState.documentDate ||
      !formState.user
    ) {
      toast({
        title: "Campos incompletos",
        description: "Completa todos los campos obligatorios y adjunta el documento.",
        variant: "destructive",
      })
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const fileData = reader.result as string
      const timestamp = new Date().toISOString()

      const existingDoc = documents.find(
        (doc) =>
          doc.expedienteId === formState.expedienteId &&
          doc.module === selectedModule &&
          doc.documentType === formState.documentType &&
          !doc.archived,
      )

      if (existingDoc) {
        const version = existingDoc.version + 1
        const newVersionEntry: VersionEntry = {
          version: existingDoc.version,
          timestamp,
          user: formState.user,
          changeNote: "Nueva versión cargada",
        }

        const updatedDoc: EvidenceDocument = {
          ...existingDoc,
          id: randomId(),
          fileName: formState.file!.name,
          fileSize: formState.file!.size,
          fileType: formState.file!.type,
          fileData,
          uploadDate: timestamp,
          documentDate: formState.documentDate,
          notes: formState.notes,
          user: formState.user,
          version,
          versionHistory: [newVersionEntry, ...existingDoc.versionHistory],
        }

        setDocuments((prev) => [updatedDoc, ...prev.filter((doc) => doc.id !== existingDoc.id)])
        registerLog(updatedDoc.id, "upload", updatedDoc, "Actualización de documento existente", formState.user)
      } else {
        const newDoc: EvidenceDocument = {
          id: randomId(),
          expedienteId: formState.expedienteId,
          module: selectedModule,
          submodule: formState.submodule,
          documentType: formState.documentType,
          title: formState.title || formState.file.name,
          notes: formState.notes,
          uploadDate: timestamp,
          documentDate: formState.documentDate,
          user: formState.user,
          fileName: formState.file.name,
          fileSize: formState.file.size,
          fileType: formState.file.type,
          fileData,
          version: 1,
          versionHistory: [],
          archived: false,
        }

        setDocuments((prev) => [newDoc, ...prev])
        registerLog(newDoc.id, "upload", newDoc, "Carga inicial de documento", formState.user)
      }

      toast({
        title: "Documento cargado",
        description: "La evidencia se ha guardado con sello de tiempo y versión activa.",
      })

      setFormState({
        expedienteId: "",
        submodule: "",
        documentType: "",
        title: "",
        documentDate: "",
        user: "",
        notes: "",
        file: null,
      })
    }

    reader.readAsDataURL(formState.file)
  }

  const registerLog = (
    documentId: string,
    action: TraceLogEntry["action"],
    doc: EvidenceDocument,
    details: string,
    performedBy?: string,
  ) => {
    const newLog: TraceLogEntry = {
      id: randomId(),
      documentId,
      expedienteId: doc.expedienteId,
      module: doc.module,
      action,
      timestamp: new Date().toISOString(),
      user: performedBy || sessionOperator || doc.user,
      details,
    }
    setLogs((prev) => [newLog, ...prev])
  }

  const handleDownload = (doc: EvidenceDocument) => {
    const link = document.createElement("a")
    link.href = doc.fileData
    link.download = doc.fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    registerLog(doc.id, "download", doc, "Descarga de evidencia", sessionOperator)
  }

  const handleArchive = (doc: EvidenceDocument) => {
    const archiveState = !doc.archived
    setDocuments((prev) => prev.map((item) => (item.id === doc.id ? { ...item, archived: archiveState } : item)))
    registerLog(
      doc.id,
      "archive",
      { ...doc, archived: archiveState },
      archiveState ? "Documento archivado" : "Documento reactivado",
      sessionOperator,
    )
  }

  const getMonthsToRetentionLimit = (documentDate: string) => {
    const creationDate = new Date(documentDate)
    const limitDate = addYears(creationDate, RETENTION_YEARS)
    const now = new Date()
    return Math.floor(differenceInMonths(limitDate, now))
  }

  const getRetentionStatus = (doc: EvidenceDocument) => {
    const months = getMonthsToRetentionLimit(doc.documentDate)
    if (months < 0) {
      return { label: "Vencido", variant: "destructive" as const, className: "" }
    }
    if (months <= RETENTION_ALERT_MONTHS) {
      return {
        label: `Por vencer (${months} meses)`,
        variant: "outline" as const,
        className: "border-amber-500 text-amber-600 bg-amber-100",
      }
    }
    return { label: "Vigente", variant: "default" as const, className: "" }
  }

  const exportExpedienteAsCSV = (expedienteId: string) => {
    const docs = expedienteMap.get(expedienteId) || []
    if (docs.length === 0) {
      toast({
        title: "Sin evidencias",
        description: "Este expediente no tiene documentos registrados para exportar.",
        variant: "destructive",
      })
      return
    }

    const rows = [
      [
        "Expediente",
        "Módulo",
        "Submódulo",
        "Tipo de documento",
        "Título",
        "Usuario",
        "Fecha documento",
        "Fecha carga",
        "Versión",
        "Estado conservación",
      ],
      ...docs.map((doc) => [
        expedienteId,
        getModuleName(doc.module),
        doc.submodule,
        doc.documentType,
        doc.title,
        doc.user,
        format(new Date(doc.documentDate), "dd/MM/yyyy"),
        format(new Date(doc.uploadDate), "dd/MM/yyyy HH:mm"),
        doc.version.toString(),
        getRetentionStatus(doc).label,
      ]),
    ]
    const csvContent = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `expediente-${expedienteId}.csv`
    link.click()
    registerLog(docs[0].id, "download", docs[0], "Exportación CSV expediente", sessionOperator)
  }

  const exportExpedienteAsPDF = (expedienteId: string) => {
    const docs = expedienteMap.get(expedienteId) || []
    if (docs.length === 0) {
      toast({
        title: "Sin evidencias",
        description: "Este expediente no tiene documentos registrados para exportar.",
        variant: "destructive",
      })
      return
    }

    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" })
    doc.setFontSize(16)
    doc.text(`Expediente ${expedienteId}`, 40, 50)
    doc.setFontSize(11)
    doc.text(
      `Fecha de emisión: ${format(new Date(), "dd 'de' MMMM 'de' yyyy HH:mm", { locale: es })}`,
      40,
      70,
    )

    let currentY = 100

    docs.forEach((evidence) => {
      if (currentY > 730) {
        doc.addPage()
        currentY = 60
      }
      doc.setFont(undefined, "bold")
      doc.text(`${getModuleName(evidence.module)} - ${evidence.title}`, 40, currentY)
      currentY += 18
      doc.setFont(undefined, "normal")
      const details = [
        `Submódulo: ${evidence.submodule}`,
        `Tipo: ${evidence.documentType}`,
        `Usuario: ${evidence.user}`,
        `Fecha del documento: ${format(new Date(evidence.documentDate), "dd/MM/yyyy")}`,
        `Fecha de carga: ${format(new Date(evidence.uploadDate), "dd/MM/yyyy HH:mm")}`,
        `Versión: ${evidence.version}`,
        `Conservación: ${getRetentionStatus(evidence).label}`,
      ]
      details.forEach((detail) => {
        doc.text(detail, 40, currentY)
        currentY += 16
      })
      if (evidence.notes) {
        doc.text(`Notas: ${evidence.notes}`, 40, currentY)
        currentY += 16
      }
      currentY += 10
    })

    doc.save(`expediente-${expedienteId}.pdf`)
    registerLog(docs[0].id, "download", docs[0], "Exportación PDF expediente", sessionOperator)
  }

  const getModuleName = (key: ModuleKey) => MODULES.find((module) => module.id === key)?.title || key

  const getExpedienteProgress = (expedienteId: string) => {
    const docs = expedienteMap.get(expedienteId) || []
    let totalRequired = 0
    let covered = 0
    MODULES.forEach((module) => {
      const moduleDocs = docs.filter((doc) => doc.module === module.id && !doc.archived)
      module.requirements.forEach((req) => {
        if (req.mandatory) {
          totalRequired += 1
          if (moduleDocs.some((doc) => doc.documentType === req.id)) {
            covered += 1
          }
        }
      })
    })
    if (totalRequired === 0) return 0
    return Math.round((covered / totalRequired) * 100)
  }

  const documentsByModule = useMemo(() => {
    return documents.filter((doc) => doc.module === selectedModule && !doc.archived)
  }, [documents, selectedModule])

  const traceabilityForModule = useMemo(() => {
    return logs.filter((log) => log.module === selectedModule)
  }, [logs, selectedModule])

  const lastAccessForDocument = (documentId: string) => {
    const lastLog = logs.find((log) => log.documentId === documentId)
    return lastLog ? format(new Date(lastLog.timestamp), "dd/MM/yyyy HH:mm") : "Sin registros"
  }

  const handleViewDocument = (documentId: string) => {
    const doc = documents.find((item) => item.id === documentId)
    if (doc) {
      registerLog(doc.id, "view", doc, "Consulta de evidencia", sessionOperator)
      setSelectedExpediente(doc.expedienteId)
    }
  }

  const uniqueExpedientes = useMemo(() => Array.from(expedienteMap.keys()), [expedienteMap])

  return (
    <div className="space-y-6 pb-10">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold">
              <Layers className="h-6 w-6" /> Evidencias y Trazabilidad
            </CardTitle>
            <CardDescription>
              Repositorio centralizado con sellos de tiempo, control de versiones y trazabilidad completa
              conforme al art. 25 de la LFPIORPI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-3 text-muted-foreground">
              <p>
                Objetivo: asegurar disponibilidad, integridad y trazabilidad de la documentación requerida
                para acreditar cumplimiento y facilitar auditorías internas, visitas SAT/UIF y verificaciones
                externas.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Centraliza evidencias de todos los módulos normativos con conservación mínima de 5 años.</li>
                <li>Control técnico mediante sellos de tiempo, versiones y logs de accesos certificados.</li>
                <li>Dashboard de alertas y exportaciones para carpetas digitales por cliente o módulo.</li>
              </ul>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="session-operator" className="text-xs font-semibold uppercase tracking-wide">
                Responsable en sesión
              </Label>
              <Input
                id="session-operator"
                placeholder="Nombre del responsable que realiza cargas y consultas"
                value={sessionOperator}
                onChange={(event) => setSessionOperator(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Se utilizará para sellar bitácoras de descarga, consulta y exportación dentro del módulo.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>Dashboard normativo</CardTitle>
            <CardDescription>Indicadores en tiempo real del repositorio documental.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">Expedientes totales</span>
              <span>{dashboardStats.totalExpedientes}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Expedientes completos</span>
              <span className="flex items-center gap-2">
                {dashboardStats.complete}
                <Badge variant="outline">{dashboardStats.completionRate}%</Badge>
              </span>
            </div>
            <div className="flex items-center justify-between text-amber-600">
              <span className="font-medium">Documentos por vencer</span>
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> {dashboardStats.documentsExpiring}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-medium">Documentos activos</span>
              <span>{dashboardStats.totalDocuments}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={selectedModule} onValueChange={(value) => setSelectedModule(value as ModuleKey)}>
        <TabsList className="flex-wrap">
          {MODULES.map((module) => (
            <TabsTrigger key={module.id} value={module.id} className="text-xs md:text-sm">
              {module.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {MODULES.map((module) => (
          <TabsContent key={module.id} value={module.id} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Upload className="h-5 w-5" /> Formularios dinámicos de carga
                  </CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="expedienteId">Expediente / Cliente</Label>
                      <Input
                        id="expedienteId"
                        placeholder="ID de cliente o expediente"
                        value={formState.expedienteId}
                        onChange={(event) => handleFormChange("expedienteId", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="submodule">Submódulo</Label>
                      <select
                        id="submodule"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={formState.submodule}
                        onChange={(event) => handleFormChange("submodule", event.target.value)}
                      >
                        <option value="">Selecciona submódulo</option>
                        {module.submodules.map((submodule) => (
                          <option key={submodule.id} value={submodule.label}>
                            {submodule.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="documentType">Tipo de documento requerido</Label>
                      <select
                        id="documentType"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={formState.documentType}
                        onChange={(event) => handleFormChange("documentType", event.target.value)}
                      >
                        <option value="">Selecciona tipo de documento</option>
                        {module.requirements.map((req) => (
                          <option key={req.id} value={req.id}>
                            {req.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="documentDate">Fecha del documento</Label>
                      <Input
                        id="documentDate"
                        type="date"
                        value={formState.documentDate}
                        onChange={(event) => handleFormChange("documentDate", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">Título o descripción</Label>
                      <Input
                        id="title"
                        placeholder="Ej. Identificación oficial Juan Pérez"
                        value={formState.title}
                        onChange={(event) => handleFormChange("title", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user">Usuario responsable</Label>
                      <Input
                        id="user"
                        placeholder="Oficial de cumplimiento"
                        value={formState.user}
                        onChange={(event) => handleFormChange("user", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="notes">Notas o metadatos adicionales</Label>
                      <Textarea
                        id="notes"
                        placeholder="Observaciones, folios SAT/UIF, número de contrato, etc."
                        value={formState.notes}
                        onChange={(event) => handleFormChange("notes", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="file">Adjuntar evidencia</Label>
                      <Input
                        id="file"
                        type="file"
                        onChange={(event) => handleFormChange("file", event.target.files?.[0] || null)}
                      />
                      <p className="text-xs text-muted-foreground">
                        El archivo se guarda con sello de tiempo y control de versiones automático.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={handleUpload}>Guardar evidencia</Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CheckCircle2 className="h-5 w-5" /> Validación automática
                  </CardTitle>
                  <CardDescription>
                    Revisiones en tiempo real de documentos obligatorios y alertas por caducidad.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {module.requirements.map((req) => {
                      const hasDocument = documentsByModule.some(
                        (doc) => doc.documentType === req.id && doc.expedienteId === formState.expedienteId,
                      )
                      const alertLabel = req.mandatory ? "Faltante" : "Opcional"
                      return (
                        <div
                          key={req.id}
                          className="flex items-start justify-between rounded-lg border p-3 text-sm"
                        >
                          <div>
                            <p className="font-medium">{req.label}</p>
                            {req.description && <p className="text-xs text-muted-foreground">{req.description}</p>}
                          </div>
                          <Badge variant={hasDocument ? "default" : req.mandatory ? "destructive" : "outline"}>
                            {hasDocument ? "Registrado" : alertLabel}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Se monitorea la conservación mínima de cinco años y se alertará 6 meses antes del vencimiento.
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
              <Card className="md:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5" /> Evidencias registradas
                  </CardTitle>
                  <CardDescription>Control técnico de seguridad y trazabilidad documental.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ScrollArea className="h-[360px] pr-4">
                    <div className="space-y-4">
                      {documentsByModule.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No hay evidencias cargadas en este módulo.</p>
                      ) : (
                        documentsByModule.map((doc) => {
                          const retentionStatus = getRetentionStatus(doc)
                          return (
                            <div key={doc.id} className="space-y-3 rounded-lg border p-3 text-sm">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-semibold">{doc.title}</p>
                                  <p className="text-xs text-muted-foreground">{doc.submodule}</p>
                                </div>
                                <Badge
                                  variant={retentionStatus.variant}
                                  className={retentionStatus.className}
                                >
                                  {retentionStatus.label}
                                </Badge>
                              </div>
                              <div className="grid gap-1 text-xs text-muted-foreground">
                                <p>Expediente: {doc.expedienteId}</p>
                                <p>Fecha documento: {format(new Date(doc.documentDate), "dd/MM/yyyy")}</p>
                                <p>Fecha carga: {format(new Date(doc.uploadDate), "dd/MM/yyyy HH:mm")}</p>
                                <p>Versión activa: {doc.version}</p>
                                <p>Último acceso: {lastAccessForDocument(doc.id)}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 pt-2">
                                <Button size="sm" variant="outline" onClick={() => handleDownload(doc)}>
                                  <Download className="mr-2 h-4 w-4" /> Descargar
                                </Button>
                                <Button
                                  size="sm"
                                  variant={doc.archived ? "secondary" : "outline"}
                                  onClick={() => handleArchive(doc)}
                                >
                                  <Archive className="mr-2 h-4 w-4" /> {doc.archived ? "Reactivar" : "Archivar"}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleViewDocument(doc.id)}>
                                  <History className="mr-2 h-4 w-4" /> Bitácora
                                </Button>
                              </div>
                              {doc.versionHistory.length > 0 && (
                                <div className="rounded-md bg-muted/40 p-2 text-xs">
                                  <p className="font-semibold">Historial de versiones:</p>
                                  <ul className="mt-1 space-y-1">
                                    {doc.versionHistory.map((version) => (
                                      <li key={version.timestamp} className="flex items-center justify-between">
                                        <span>
                                          v{version.version} – {format(new Date(version.timestamp), "dd/MM/yyyy HH:mm")}
                                        </span>
                                        <span>{version.user}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShieldCheck className="h-5 w-5" /> Logs y trazabilidad
                  </CardTitle>
                  <CardDescription>Registro cronológico de cargas, descargas y consultas.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[360px] pr-4">
                    <div className="space-y-3 text-xs">
                      {traceabilityForModule.length === 0 ? (
                        <p className="text-muted-foreground">Sin movimientos registrados.</p>
                      ) : (
                        traceabilityForModule.map((log) => (
                          <div key={log.id} className="rounded-lg border p-3">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{log.action.toUpperCase()}</span>
                              <span className="text-muted-foreground">
                                {format(new Date(log.timestamp), "dd/MM/yyyy HH:mm")}
                              </span>
                            </div>
                            <p>Expediente: {log.expedienteId}</p>
                            <p>Usuario: {log.user}</p>
                            <p className="text-muted-foreground">{log.details}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BellRing className="h-5 w-5" /> Checklist con evidencias
            </CardTitle>
            <CardDescription>
              Seguimiento de documentos obligatorios, vencimientos y respaldos por expediente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Checkbox
                  id="alerts-only"
                  checked={showOnlyAlerts}
                  onCheckedChange={(value) => setShowOnlyAlerts(Boolean(value))}
                />
                <Label htmlFor="alerts-only" className="text-sm">
                  Mostrar únicamente expedientes con alertas
                </Label>
              </div>
              <div className="text-xs text-muted-foreground">
                Conservación mínima {RETENTION_YEARS} años • Alertas a {RETENTION_ALERT_MONTHS} meses del vencimiento
              </div>
            </div>
            <ScrollArea className="h-[360px] pr-4">
              <div className="space-y-4">
                {filteredExpedientes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin expedientes registrados todavía.</p>
                ) : (
                  filteredExpedientes.map((expediente) => (
                    <div key={expediente.expedienteId} className="rounded-lg border p-4 text-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">Expediente {expediente.expedienteId}</p>
                          <p className="text-xs text-muted-foreground">
                            Avance total: {getExpedienteProgress(expediente.expedienteId)}%
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => exportExpedienteAsPDF(expediente.expedienteId)}
                          >
                            <FileText className="mr-2 h-4 w-4" /> PDF
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => exportExpedienteAsCSV(expediente.expedienteId)}
                          >
                            <Download className="mr-2 h-4 w-4" /> Excel
                          </Button>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2 text-xs">
                        {expediente.missingByModule.map((status) => (
                          <div key={status.module.id} className="rounded-md border p-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{status.module.title}</span>
                              <Badge variant={status.missing.length === 0 ? "outline" : "destructive"}>
                                {status.missing.length === 0 ? "Completo" : `${status.missing.length} faltantes`}
                              </Badge>
                            </div>
                            {status.missing.length > 0 && (
                              <ul className="mt-2 list-disc space-y-1 pl-4">
                                {status.missing.map((missing) => (
                                  <li key={missing.id}>{missing.label}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>

                      {expediente.documentsAboutToExpire.length > 0 && (
                        <div className="mt-3 rounded-md border border-amber-500 bg-amber-100/30 p-3 text-xs text-amber-700">
                          <p className="font-semibold">Documentos por vencer:</p>
                          <ul className="mt-1 space-y-1">
                            {expediente.documentsAboutToExpire.map((doc) => (
                              <li key={doc.id}>
                                {doc.title} – vence el {format(addYears(new Date(doc.documentDate), RETENTION_YEARS), "dd/MM/yyyy")}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FolderOpen className="h-5 w-5" /> Carpeta digital por expediente
            </CardTitle>
            <CardDescription>
              Vista consolidada de documentos listos para entregarse en visita de verificación.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="expediente-select">Selecciona expediente</Label>
              <select
                id="expediente-select"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedExpediente}
                onChange={(event) => setSelectedExpediente(event.target.value)}
              >
                <option value="">Selecciona expediente</option>
                {uniqueExpedientes.map((expediente) => (
                  <option key={expediente} value={expediente}>
                    {expediente}
                  </option>
                ))}
              </select>
            </div>

            {selectedExpediente ? (
              <div className="space-y-3 text-sm">
                {(expedienteMap.get(selectedExpediente) || []).map((doc) => (
                  <div key={doc.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">{getModuleName(doc.module)}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleDownload(doc)}>
                        <Download className="mr-2 h-4 w-4" /> Descargar
                      </Button>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                      <p>Fecha documento: {format(new Date(doc.documentDate), "dd/MM/yyyy")}</p>
                      <p>Fecha carga: {format(new Date(doc.uploadDate), "dd/MM/yyyy HH:mm")}</p>
                      <p>Versión: {doc.version}</p>
                    </div>
                  </div>
                ))}
                <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                  Conservación activa por {RETENTION_YEARS} años con opción de archivo histórico por expediente.
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Selecciona un expediente para ver su carpeta digital.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
