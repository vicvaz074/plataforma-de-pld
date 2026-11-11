"use client"
import { DocumentLink } from "@/components/pld/document-link"
import { resolveSafeDocumentHref } from "@/lib/pld/document-links"
import { serializeCsv } from "@/lib/pld/csv"
import { getModuleStorage, canWriteModuleStorage, getPilotSession, getActiveCompany, captureModuleScope, assertModuleScope, isModuleScopeCurrent, type ModuleScope } from "@/lib/pilot/module-storage"
import { sessionCan } from "@/lib/pilot/contracts"

import { useEffect, useMemo, useRef, useState } from "react"
import { jsPDF } from "jspdf"
import { differenceInMonths, format } from "date-fns"
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
import { buildAuditEvidenceLinks, buildOperationalEvidenceLinks, mergeExternalEvidence, parseStoredArray, resolveEvidenceSource, type EvidenceSourceReference } from "@/lib/pld/module-continuity"
import { notifyPldIntegrationChange, PLD_INTEGRATION_EVENT } from "@/lib/pld/integration-records"
import { GENERAL_RETENTION_YEARS, getEvidenceRetention, snapshotEvidenceVersion, type EvidenceVersionSnapshot } from "@/lib/pld/evidence-lifecycle"
import { readFileAsDataUrl } from "@/lib/storage/read-file"
import { PldImportDialog } from "@/components/pld/import-dialog"
import { flushModuleStorage } from "@/lib/pilot/module-storage"
import { parsePldCalendarDate } from "@/lib/pld/calendar-date"

type ModuleKey =
  | "kyc"
  | "beneficiario"
  | "gobernanza"
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

interface VersionEntry extends EvidenceVersionSnapshot {}

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
  fileData?: string
  sha256?: string
  activityDate?: string
  auditDeliveredAt?: string
  auditPeriodYear?: number
  activityKey?: string
  legalHold?: boolean
  reviewStatus?: "pending" | "approved" | "rejected"
  reviewNote?: string
  reviewedHash?: string
  reviewedAt?: string
  version: number
  versionHistory: VersionEntry[]
  archived: boolean
  source?: "manual" | "gobernanza" | "beneficiario" | "capacitacion" | "kyc" | "actos" | "sat" | "auditoria"
  sourceId?: string
  sourceRevision?: string
  sourceReference?: EvidenceSourceReference
  sourceOverride?: boolean
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
    id: "gobernanza",
    title: "Gobernanza",
    description: "Oficial de cumplimiento, comité y manuales.",
    submodules: [
      { id: "oficial", label: "Oficial de Cumplimiento" },
      { id: "manuales", label: "Manuales" },
      { id: "comite", label: "Comité" },
    ],
    requirements: [],
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

const RETENTION_YEARS = GENERAL_RETENTION_YEARS
const RETENTION_ALERT_MONTHS = 6

const STORAGE_KEYS = {
  documents: "pld-evidences-documents",
  logs: "pld-evidences-logs",
  snapshot: "evidencias-trazabilidad-data",
}

const randomId = () => crypto.randomUUID()

const normalizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

const findRequirementIdByLabel = (module: EvidenceModule, label: string) => {
  const normalized = normalizeText(label)
  return (
    module.requirements.find((req) => normalizeText(req.label) === normalized)?.id ||
    module.requirements.find((req) => normalizeText(label).includes(normalizeText(req.label)))?.id
  )
}

const mapCapacitacionRequirement = (category: string) => {
  if (category === "plan") return "plan-capacitacion"
  return "constancias"
}

export default function EvidenciasTrazabilidadPage() {
  const { toast } = useToast()

  const [selectedModule, setSelectedModule] = useState<ModuleKey>("kyc")
  const [documents, setDocuments] = useState<EvidenceDocument[]>([])
  const [logs, setLogs] = useState<TraceLogEntry[]>([])
  const [storageReady, setStorageReady] = useState(false)
  const [formState, setFormState] = useState({
    expedienteId: "",
    submodule: "",
    documentType: "",
    title: "",
    documentDate: "",
    activityDate: "",
    auditPeriodYear: "",
    user: "",
    notes: "",
    file: null as File | null,
  })
  const [selectedExpediente, setSelectedExpediente] = useState<string>("")
  const [showOnlyAlerts, setShowOnlyAlerts] = useState(false)
  const [sessionOperator, setSessionOperator] = useState("")
  const [lastSync, setLastSync] = useState<string>("")
  const loadedEvidenceLink = useRef("")
  useEffect(() => {
    if (!storageReady) return
    const id = new URLSearchParams(window.location.search).get("document")
    if (!id || loadedEvidenceLink.current === id) return
    const linked = id && documents.find((document) => document.id === id)
    if (!linked) return
    loadedEvidenceLink.current = id
    setSelectedModule(linked.module); setSelectedExpediente(linked.expedienteId)
    const timer = window.setTimeout(() => document.getElementById(`evidence-${linked.id}`)?.scrollIntoView({ block: "center" }), 0)
    return () => window.clearTimeout(timer)
  }, [storageReady, documents])
  const canReview = getPilotSession() ? sessionCan(getPilotSession(), getActiveCompany(), "evidencias", "approve") : process.env.NEXT_PUBLIC_PLD_MODE === "demo"

  const getMonthsToRetentionLimit = (doc: EvidenceDocument) => {
    const retention = getEvidenceRetention(doc)
    if (!retention.endsAt) return Number.POSITIVE_INFINITY
    const limitDate = new Date(retention.endsAt)
    const now = new Date()
    return Math.floor(differenceInMonths(limitDate, now))
  }

  const getRetentionStatus = (doc: EvidenceDocument) => {
    const retention = getEvidenceRetention(doc)
    if (retention.status === "legal-hold") return { label: "Conservación por proceso abierto", variant: "outline" as const, className: "" }
    if (retention.status === "start-required") return { label: "Fecha inicial de conservación pendiente", variant: "outline" as const, className: "" }
    if (retention.status === "review-required") return { label: "Conservación: revisión específica XIV", variant: "outline" as const, className: "" }
    const months = getMonthsToRetentionLimit(doc)
    if (months < 0) {
      return { label: "Plazo mínimo cumplido; conservar hasta revisión", variant: "outline" as const, className: "" }
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

  const getModuleName = (key: ModuleKey) => MODULES.find((module) => module.id === key)?.title || key

  useEffect(() => {
    try {
    setSessionOperator(getModuleStorage().getItem("userEmail") || getModuleStorage().getItem("userName") || "Usuario en sesión")
    const storedDocs = getModuleStorage().getItem(STORAGE_KEYS.documents)
    const storedLogs = getModuleStorage().getItem(STORAGE_KEYS.logs)
    if (storedDocs) {
      const parsed = parseStoredArray(storedDocs) as EvidenceDocument[]
      setDocuments(
        parsed.map((doc) => ({
          ...doc,
          source: doc.source ?? "manual",
          sourceId: doc.sourceId ?? doc.id,
          versionHistory: Array.isArray(doc.versionHistory) ? doc.versionHistory : [],
        })),
      )
    }
    if (storedLogs) {
      setLogs(parseStoredArray(storedLogs) as TraceLogEntry[])
    }
    setStorageReady(true)
    } catch {
      toast({ title: "No se pudo cargar el repositorio", description: "Los documentos y logs originales se conservaron sin sobrescribir. Revisa la copia local.", variant: "destructive" })
    }
  }, [])

  useEffect(() => {
    if (!storageReady || !canWriteModuleStorage(STORAGE_KEYS.documents)) return
    try {
      getModuleStorage().setItem(STORAGE_KEYS.documents, JSON.stringify(documents))
      getModuleStorage().setItem(STORAGE_KEYS.logs, JSON.stringify(logs))
      getModuleStorage().setItem(STORAGE_KEYS.snapshot, JSON.stringify({ documentos: documents, logs }))
      notifyPldIntegrationChange(STORAGE_KEYS.documents)
    } catch {
      toast({ title: "No se pudo guardar la evidencia", description: "No salgas de esta página sin respaldar los cambios. El almacenamiento local no está disponible o está lleno.", variant: "destructive" })
    }
  }, [storageReady, documents, logs, toast])

  const syncExternalEvidence = () => {
    if (!storageReady) return
    const externalDocs: EvidenceDocument[] = []

    const gobernanzaRaw = getModuleStorage().getItem("gobernanza-control-data")
    if (gobernanzaRaw) {
      try {
        const gobernanzaParsed = JSON.parse(gobernanzaRaw)
        if (Array.isArray(gobernanzaParsed.documents)) {
          gobernanzaParsed.documents.forEach((doc: any) => {
            if (!doc) return
            const moduleConfig = MODULES.find((module) => module.id === "gobernanza")
            const submodule = doc.relatedModules?.[0] || doc.documentType || "Gobernanza"
            externalDocs.push({
              id: `gobernanza-${doc.id}`,
              expedienteId: doc.relatedQuestionId || "Gobernanza",
              module: "gobernanza",
              submodule,
              documentType:
                (moduleConfig
                  ? findRequirementIdByLabel(moduleConfig, doc.documentType || doc.name || "") || doc.documentType
                  : doc.documentType) || "documento",
              title: doc.name || doc.fileName || "Documento",
              notes: doc.notes,
              uploadDate: doc.uploadDate || new Date().toISOString(),
              documentDate: doc.issueDate || doc.uploadDate || new Date().toISOString(),
              user: doc.signedBy || "Gobernanza",
              fileName: doc.fileName || doc.name || "documento",
              fileSize: doc.size || 0,
              fileType: doc.mimeType || "application/pdf",
              fileData: doc.base64 ? (/^(?:data:|\/api\/)/.test(doc.base64) ? doc.base64 : `data:${doc.mimeType};base64,${doc.base64}`) : undefined,
              sha256: doc.hash,
              version: 1,
              versionHistory: [],
              archived: Boolean(doc.archived),
              source: "gobernanza",
              sourceId: doc.id,
            })
          })
        }
      } catch (error) {
        console.error("Error al sincronizar gobernanza", error)
      }
    }

    const beneficiarioRaw = getModuleStorage().getItem("beneficiario-controlador-data")
    if (beneficiarioRaw) {
      try {
        const beneficiarioParsed = JSON.parse(beneficiarioRaw)
        const beneficiaryDocuments = beneficiarioParsed.profiles
          ? Object.entries(beneficiarioParsed.profiles).flatMap(([expedienteId, value]) => {
              const profile = value as { documentos?: Record<string, any>[] }
              return Array.isArray(profile.documentos) ? profile.documentos.map((doc) => ({ ...doc, expedienteId })) : []
            })
          : Array.isArray(beneficiarioParsed.documentos) ? beneficiarioParsed.documentos : []
        if (beneficiaryDocuments.length) {
          const moduleConfig = MODULES.find((module) => module.id === "beneficiario")
          beneficiaryDocuments.forEach((doc: any) => {
            if (!doc) return
            const mappedType =
              moduleConfig && typeof doc.type === "string"
                ? findRequirementIdByLabel(moduleConfig, doc.type) || doc.type
                : doc.type || "documento"
            externalDocs.push({
              id: `beneficiario-${doc.expedienteId || "legacy"}-${doc.id}`,
              expedienteId: doc.expedienteId || "Beneficiario sin expediente asignado",
              module: "beneficiario",
              submodule: doc.category || "General",
              documentType: mappedType,
              title: doc.name || doc.type || "Documento",
              notes: doc.notes,
              uploadDate: doc.uploadDate ? new Date(doc.uploadDate).toISOString() : new Date().toISOString(),
              documentDate: doc.uploadDate ? new Date(doc.uploadDate).toISOString() : new Date().toISOString(),
              user: "Beneficiario Controlador",
              fileName: doc.name || doc.type || "documento",
              fileSize: 0,
              fileType: "application/pdf",
              fileData: doc.url,
              sha256: doc.sha256,
              version: 1,
              versionHistory: [],
              archived: Boolean(doc.archived),
              source: "beneficiario",
              sourceId: `${doc.expedienteId || "legacy"}-${doc.id}`,
            })
          })
        }
      } catch (error) {
        console.error("Error al sincronizar beneficiario controlador", error)
      }
    }

    const capacitacionRaw =
      getModuleStorage().getItem("pld-training-module") || getModuleStorage().getItem("capacitacion-control-data")
    if (capacitacionRaw) {
      try {
        const capacitacionParsed = JSON.parse(capacitacionRaw)
        if (Array.isArray(capacitacionParsed.documents)) {
          capacitacionParsed.documents.forEach((doc: any) => {
            if (!doc) return
            const mappedType = mapCapacitacionRequirement(doc.category || "")
            externalDocs.push({
              id: `capacitacion-${doc.id}`,
              expedienteId: doc.sessionId || doc.employeeId || "Capacitación",
              module: "capacitacion",
              submodule: doc.category || "Capacitación",
              documentType: mappedType,
              title: doc.name || "Documento",
              notes: doc.notes,
              uploadDate: doc.uploadedAt || new Date().toISOString(),
              documentDate: doc.uploadedAt || new Date().toISOString(),
              user: doc.uploadedBy || "Capacitación",
              fileName: doc.name || "documento",
              fileSize: doc.size || 0,
              fileType: doc.fileType || "application/pdf",
              fileData: doc.dataUrl,
              sha256: doc.sha256,
              version: 1,
              versionHistory: [],
              archived: false,
              source: "capacitacion",
              sourceId: doc.id,
            })
          })
        }
      } catch (error) {
        console.error("Error al sincronizar capacitación", error)
      }
    }

    const now = new Date().toISOString()
    externalDocs.push(...buildOperationalEvidenceLinks(getModuleStorage(), now))
    externalDocs.push(...buildAuditEvidenceLinks(getModuleStorage(),now))
    setDocuments((prev) => mergeExternalEvidence(prev, externalDocs, now))
    setLastSync(now)
  }

  useEffect(() => {
    if (typeof window === "undefined" || !storageReady) return
    syncExternalEvidence()
    const sourceKeys = ["gobernanza-control-data", "beneficiario-controlador-data", "pld-training-module", "capacitacion-control-data", "kyc_expedientes_detalle", "actividades_vulnerables_operaciones", "pld-sat-output-packages","auditoria-verificacion-workflow"]
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || sourceKeys.includes(event.key)) syncExternalEvidence()
    }
    const handleIntegration = (event: Event) => { if (sourceKeys.includes((event as CustomEvent).detail?.key)) syncExternalEvidence() }
    window.addEventListener("storage", handleStorage)
    window.addEventListener(PLD_INTEGRATION_EVENT, handleIntegration)
    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener(PLD_INTEGRATION_EVENT, handleIntegration)
    }
  }, [storageReady])

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
        const monthsToExpire = getMonthsToRetentionLimit(doc)
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
        const monthsToExpire = getMonthsToRetentionLimit(doc)
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

  const commitEvidence = async (scope: ModuleScope, update: (documents: EvidenceDocument[], logs: TraceLogEntry[]) => { documents: EvidenceDocument[]; logs: TraceLogEntry[] }) => {
    assertModuleScope(scope)
    const latestDocuments = parseStoredArray(scope.storage.getItem(STORAGE_KEYS.documents)) as EvidenceDocument[]
    const latestLogs = parseStoredArray(scope.storage.getItem(STORAGE_KEYS.logs)) as TraceLogEntry[]
    const next = update(latestDocuments, latestLogs)
    scope.storage.setItem(STORAGE_KEYS.documents, JSON.stringify(next.documents))
    scope.storage.setItem(STORAGE_KEYS.logs, JSON.stringify(next.logs))
    scope.storage.setItem(STORAGE_KEYS.snapshot, JSON.stringify({ documentos: next.documents, logs: next.logs }))
    // Failed saves remain pending for retry/conflict recovery. Never roll a
    // pre-await snapshot back into a newer company or a concurrent edit.
    await flushModuleStorage(scope)
    assertModuleScope(scope)
    setDocuments(parseStoredArray(scope.storage.getItem(STORAGE_KEYS.documents)) as EvidenceDocument[])
    setLogs(parseStoredArray(scope.storage.getItem(STORAGE_KEYS.logs)) as TraceLogEntry[])
    notifyPldIntegrationChange(STORAGE_KEYS.documents)
  }

  const handleUpload = async () => {
    const scope = captureModuleScope()
    if (!storageReady || !formState.file || !formState.documentType || !formState.expedienteId || !formState.submodule || !formState.documentDate) {
      toast({ title: "Campos incompletos", description: "Selecciona expediente, tipo, fecha y archivo antes de guardar.", variant: "destructive" })
      return
    }
    const selectedFile = formState.file
    if (selectedFile.size > 20 * 1024 * 1024 || !/\.(pdf|png|jpe?g|webp|xml|xlsx|xlsm|docx)$/i.test(selectedFile.name)) {
      toast({ title: "Archivo no admitido", description: "Usa PDF, imagen, XML, Excel o DOCX de hasta 20 MB.", variant: "destructive" })
      return
    }
    try {
      const fileData = await readFileAsDataUrl(selectedFile)
      assertModuleScope(scope)
      const digest = await crypto.subtle.digest("SHA-256", await selectedFile.arrayBuffer())
      assertModuleScope(scope)
      const sha256 = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
      const timestamp = new Date().toISOString()
      const actor = scope.storage.getItem("userEmail") || scope.storage.getItem("userName") || formState.user || "Usuario en sesión"
      await commitEvidence(scope, (documents, logs) => {
      const existing = documents.find((doc) => doc.expedienteId === formState.expedienteId && doc.module === selectedModule && doc.documentType === formState.documentType && !doc.archived)
      const id = existing?.id || randomId()
      const next: EvidenceDocument = {
        ...(existing || {}), id, expedienteId: formState.expedienteId, module: selectedModule,
        submodule: formState.submodule, documentType: formState.documentType, title: formState.title || selectedFile.name,
        notes: formState.notes, uploadDate: timestamp, documentDate: formState.documentDate,
        activityDate: selectedModule === "auditoria" ? undefined : formState.activityDate || undefined,
        auditDeliveredAt: selectedModule === "auditoria" ? formState.activityDate || undefined : undefined,
        auditPeriodYear: selectedModule === "auditoria" && formState.auditPeriodYear ? Number(formState.auditPeriodYear) : undefined,
        user: actor, fileName: selectedFile.name, fileSize: selectedFile.size,
        fileType: selectedFile.type || "application/octet-stream", fileData, sha256,
        version: (existing?.version || 0) + 1,
        versionHistory: existing ? [snapshotEvidenceVersion(existing), ...existing.versionHistory] : [],
        archived: false, source: existing?.source || "manual", sourceId: existing?.sourceId || id,
        sourceOverride: Boolean(existing?.source && existing.source !== "manual"), reviewStatus: "pending", reviewNote: undefined, reviewedHash: undefined, reviewedAt: undefined,
      }
      const log: TraceLogEntry = { id: randomId(), documentId: id, expedienteId: next.expedienteId, module: next.module, action: "upload", timestamp, user: actor, details: existing ? "Nueva versión: archivo anterior conservado" : "Carga inicial de documento" }
      return { documents: [next, ...documents.filter((doc) => doc.id !== id)], logs: [log, ...logs] }
      })
      assertModuleScope(scope)
      toast({ title: "Evidencia guardada", description: "Archivo conservado con hash, historial y revisión pendiente." })
      setFormState({ expedienteId: "", submodule: "", documentType: "", title: "", documentDate: "", activityDate: "", auditPeriodYear: "", user: "", notes: "", file: null })
    } catch (error) {
      if (isModuleScopeCurrent(scope)) toast({ title: "No se guardó la evidencia", description: error instanceof Error ? error.message : "Conserva el archivo y vuelve a intentarlo.", variant: "destructive" })
    }
  }

  const restoreVersion = async (doc: EvidenceDocument, version: VersionEntry) => {
    const scope = captureModuleScope()
    if (!version.fileData) return
    const actor = scope.storage.getItem("userEmail") || scope.storage.getItem("userName") || "Usuario en sesión"
    const timestamp = new Date().toISOString()
    try {
    await commitEvidence(scope, (documents, logs) => {
    const latest = documents.find((item) => item.id === doc.id)
    if (!latest) throw new Error("La evidencia ya no está disponible; recarga el repositorio.")
    doc = latest
    const restored: EvidenceDocument = { ...doc, fileData: version.fileData, fileName: version.fileName || doc.fileName,
      fileSize: version.fileSize ?? doc.fileSize, fileType: version.fileType || doc.fileType, sha256: version.sha256,
      documentDate: version.documentDate || doc.documentDate, version: doc.version + 1, uploadDate: timestamp,
      versionHistory: [snapshotEvidenceVersion(doc, "Restauración de v" + version.version), ...doc.versionHistory],
      reviewStatus: "pending", reviewNote: undefined, reviewedHash: undefined, reviewedAt: undefined, user: actor }
      return { documents: documents.map((item) => item.id === doc.id ? restored : item), logs: [{id: randomId(),documentId:doc.id,expedienteId:doc.expedienteId,module:doc.module,action:"upload",timestamp,user:actor,details:"Restaurada v" + version.version + " como nueva versión"}, ...logs] }
      })
      assertModuleScope(scope)
      toast({ title: "Versión restaurada", description: "La restauración creó una versión nueva; las anteriores se conservan." })
    } catch (error) { if (isModuleScopeCurrent(scope)) toast({ title: "No se restauró", description: error instanceof Error ? error.message : "Reintenta guardar.", variant:"destructive" }) }
  }

  const reviewEvidence = async (doc: EvidenceDocument, status: "approved" | "rejected") => {
    const scope = captureModuleScope()
    if (!canReview || !doc.sha256) return
    const note = status === "rejected" ? window.prompt("Motivo de rechazo")?.trim() : "Archivo revisado"
    if (!note) return
    const actor = scope.storage.getItem("userEmail") || "Usuario en sesión"
    const at = new Date().toISOString()
    try {
      await commitEvidence(scope, (documents, logs) => {
        const latest = documents.find((item) => item.id === doc.id)
        if (!latest || latest.fileData !== doc.fileData || latest.sha256 !== doc.sha256 || latest.version !== doc.version) throw new Error("La versión cambió; revisa la evidencia actual antes de decidir.")
        return { documents: documents.map((item) => item.id === doc.id ? { ...item, reviewStatus: status, reviewNote: note, reviewedHash: doc.sha256, reviewedAt: at } : item), logs: [{ id:randomId(),documentId:doc.id,expedienteId:doc.expedienteId,module:doc.module,action:"view",timestamp:at,user:actor,details:`Revisión ${status}: ${note}` }, ...logs] }
      })
      assertModuleScope(scope)
      toast({title:status === "approved" ? "Revisión aprobada" : "Revisión rechazada",description:"La decisión corresponde al hash de esta versión."})
    } catch (error) { if (isModuleScopeCurrent(scope)) toast({title:"No se guardó la revisión",description:error instanceof Error ? error.message : "Reintenta.",variant:"destructive"}) }
  }

  const registerLog = (
    documentId: string,
    action: TraceLogEntry["action"],
    doc: EvidenceDocument,
    details: string,
    performedBy?: string,
  ) => {
    if (!canWriteModuleStorage(STORAGE_KEYS.logs)) return
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
    let fileData = doc.fileData
    try { if (!fileData && doc.sourceReference) fileData = resolveEvidenceSource(getModuleStorage(), doc.sourceReference) } catch { /* keep the metadata even when the source is unavailable */ }
    const safeHref = resolveSafeDocumentHref(fileData, { mode: getPilotSession() ? "cloud" : process.env.NEXT_PUBLIC_PLD_MODE === "demo" ? "demo" : "cloud",
      companyId: getActiveCompany()?.id, origin: window.location.origin, purpose: "download",
      generated: !doc.fileData && Boolean(doc.sourceReference && ["record", "sat-xml"].includes(doc.sourceReference.kind)) })
    if (!safeHref) {
      toast({
        title: "Archivo no disponible",
        description: "No se encontró una referencia documental segura en el módulo de origen. Vuelve a cargar el archivo; la referencia y su historial se conservan.",
        variant: "destructive",
      })
      return
    }
    const link = document.createElement("a")
    link.href = safeHref
    link.download = doc.fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    registerLog(doc.id, "download", doc, "Descarga de evidencia", sessionOperator)
  }

  const handleArchive = async (doc: EvidenceDocument) => {
    const scope = captureModuleScope()
    const archiveState = !doc.archived
    if (!window.confirm(archiveState ? "¿Archivar esta evidencia? El archivo y sus versiones se conservarán." : "¿Reactivar esta evidencia?")) return
    const log: TraceLogEntry = { id:randomId(),documentId:doc.id,expedienteId:doc.expedienteId,module:doc.module,action:"archive",
      timestamp:new Date().toISOString(),user:sessionOperator || getModuleStorage().getItem("userEmail") || "Usuario en sesión",details:archiveState ? "Documento archivado" : "Documento reactivado" }
    try {
      await commitEvidence(scope, (documents, logs) => ({ documents: documents.map((item) => item.id === doc.id ? {...item,archived:archiveState} : item), logs: [log,...logs] }))
      assertModuleScope(scope)
      toast({title:archiveState ? "Documento archivado" : "Documento reactivado",description:"Archivo, versiones y bitácora conservados."})
    } catch (error) { if (isModuleScopeCurrent(scope)) toast({title:"No se guardó el cambio",description:error instanceof Error ? error.message : "Reintenta sin cerrar la página.",variant:"destructive"}) }
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
        format(parsePldCalendarDate(doc.documentDate), "dd/MM/yyyy"),
        format(new Date(doc.uploadDate), "dd/MM/yyyy HH:mm"),
        doc.version.toString(),
        getRetentionStatus(doc).label,
      ]),
    ]
    const csvContent = serializeCsv(rows)
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
      doc.setFont("helvetica", "bold")
      doc.text(`${getModuleName(evidence.module)} - ${evidence.title}`, 40, currentY)
      currentY += 18
      doc.setFont("helvetica", "normal")
      const details = [
        `Submódulo: ${evidence.submodule}`,
        `Tipo: ${evidence.documentType}`,
        `Usuario: ${evidence.user}`,
        `Fecha del documento: ${format(parsePldCalendarDate(evidence.documentDate), "dd/MM/yyyy")}`,
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

  const integrationSummary = useMemo(() => {
    const summary = documents.reduce(
      (acc, doc) => {
        if (doc.source && doc.source !== "manual") {
          acc[doc.source] = (acc[doc.source] || 0) + 1
        }
        return acc
      },
      {} as Record<string, number>,
    )
    const totalExternal = Object.values(summary).reduce((total, count) => total + count, 0)
    return { summary, totalExternal }
  }, [documents])

  return (
    <div className="space-y-6 pb-10">
      <div className="grid items-start gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-bold">
              <Layers className="h-6 w-6" /> Evidencias y Trazabilidad
            </CardTitle>
            <CardDescription>
              Repositorio centralizado con sellos de tiempo y trazabilidad.
            </CardDescription>
            <PldImportDialog destination="evidence" onComplete={() => window.location.reload()} />
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-2">
              <Label htmlFor="session-operator" className="text-xs font-semibold uppercase tracking-wide">
                Responsable en sesión
              </Label>
              <Input
                id="session-operator"
                placeholder="Nombre del responsable que realiza cargas y consultas"
                value={sessionOperator}
                readOnly
              />
              <p className="text-xs text-muted-foreground">
                Se usa para bitácoras de descarga, consulta y exportación.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>Dashboard normativo</CardTitle>
            <CardDescription>Indicadores clave y sincronización.</CardDescription>
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
            <div className="rounded-lg border p-3 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Evidencias sincronizadas</span>
                <span className="font-semibold text-foreground">{integrationSummary.totalExternal}</span>
              </div>
              <div className="mt-2 grid gap-1">
                {Object.entries(integrationSummary.summary).length === 0 ? (
                  <span>Sin integraciones activas.</span>
                ) : (
                  Object.entries(integrationSummary.summary).map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between">
                      <span className="capitalize">{source}</span>
                      <span>{count}</span>
                    </div>
                  ))
                )}
              </div>
              <Button size="sm" variant="outline" className="mt-3 w-full" onClick={syncExternalEvidence}>
                Sincronizar evidencias
              </Button>
              {lastSync && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Última sync: {format(new Date(lastSync), "dd/MM/yyyy HH:mm")}
                </p>
              )}
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
                      <Label htmlFor="activityDate">{selectedModule === "auditoria" ? "Fecha de entrega del dictamen" : "Fecha del acto u operación"}</Label>
                      <Input id="activityDate" type="date" value={formState.activityDate} onChange={(event) => handleFormChange("activityDate", event.target.value)} />
                      <p className="text-xs text-muted-foreground">Determina el inicio del plazo de conservación; si falta, se conserva y queda pendiente de revisión.</p>
                    </div>
                    {selectedModule === "auditoria" && <div className="space-y-2"><Label htmlFor="auditPeriodYear">Ejercicio auditado</Label><Input id="auditPeriodYear" inputMode="numeric" value={formState.auditPeriodYear} onChange={(event)=>handleFormChange("auditPeriodYear",event.target.value)} placeholder="Ej. 2028" /><p className="text-xs text-muted-foreground">La regla específica del Acuerdo 115/2026 comienza con el periodo 2028. Sin un ejercicio aplicable, el plazo queda sujeto a revisión.</p></div>}
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
                    Conservación según tipo y fundamento: normalmente diez años; dictamen de auditoría y soporte del régimen aplicable a partir del periodo 2028, cinco desde su entrega. Sin fecha o régimen confirmado queda en revisión. No se elimina ningún archivo automáticamente.
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
                  <CardDescription>Documentos activos y conectados.</CardDescription>
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
                            <div key={doc.id} id={`evidence-${doc.id}`} className="space-y-3 rounded-lg border p-3 text-sm">
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
                                <p>Fecha documento: {format(parsePldCalendarDate(doc.documentDate), "dd/MM/yyyy")}</p>
                                <p>Fecha carga: {format(new Date(doc.uploadDate), "dd/MM/yyyy HH:mm")}</p>
                                <p>Versión activa: {doc.version}</p>
                                <p>Último acceso: {lastAccessForDocument(doc.id)}</p>
                                {doc.source && doc.source !== "manual" && (
                                  <p>Origen: {doc.source}</p>
                                )}
                                {!doc.fileData && <p className="text-amber-600">{doc.sourceReference?.kind === "record" ? "Registro vinculado; no acredita documentación cargada" : doc.sourceReference ? "Archivo vinculado al módulo de origen" : "Archivo pendiente"}</p>}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 pt-2">
                                {doc.fileData && <Button size="sm" variant="outline" asChild><DocumentLink href={doc.fileData} target="_blank" rel="noreferrer">Ver archivo</DocumentLink></Button>}
                                <Button size="sm" variant="outline" onClick={() => handleDownload(doc)}>
                                  <Download className="mr-2 h-4 w-4" /> {doc.sourceReference?.kind === "record" ? "Exportar registro JSON" : "Descargar"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={doc.archived ? "secondary" : "outline"}
                                  data-pld-action="archive"
                                  onClick={() => void handleArchive(doc)}
                                >
                                  <Archive className="mr-2 h-4 w-4" /> {doc.archived ? "Reactivar" : "Archivar"}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleViewDocument(doc.id)}>
                                  <History className="mr-2 h-4 w-4" /> Bitácora
                                </Button>
                                {canReview && doc.sha256 && <><Button size="sm" variant="outline" onClick={() => reviewEvidence(doc, "approved")}>Aprobar</Button><Button size="sm" variant="outline" onClick={() => reviewEvidence(doc, "rejected")}>Rechazar</Button></>}
                                {doc.reviewStatus && <Badge variant="outline">{doc.reviewStatus === "approved" ? "Revisado" : doc.reviewStatus === "rejected" ? "Rechazado" : "Por revisar"}</Badge>}
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
                                        {version.fileData ? <div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => handleDownload({ ...doc, fileData: version.fileData, fileName: version.fileName || doc.fileName })}>Descargar v{version.version}</Button><Button size="sm" variant="ghost" onClick={() => restoreVersion(doc, version)}>Restaurar</Button></div> : <span>Archivo histórico no disponible</span>}
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
                  data-pld-context="browse"
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
                            data-pld-action="download"
                            onClick={() => exportExpedienteAsPDF(expediente.expedienteId)}
                          >
                            <FileText className="mr-2 h-4 w-4" /> PDF
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            data-pld-action="download"
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
                                {doc.title} – {getEvidenceRetention(doc).endsAt ? `plazo mínimo hasta ${format(new Date(getEvidenceRetention(doc).endsAt!), "dd/MM/yyyy")}` : "inicio de conservación pendiente"}
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
                      <p>Fecha documento: {format(parsePldCalendarDate(doc.documentDate), "dd/MM/yyyy")}</p>
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
