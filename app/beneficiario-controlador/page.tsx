"use client"
import { DocumentLink } from "@/components/pld/document-link"
import { getModuleStorage, canWriteModuleStorage, captureModuleScope, assertModuleScope, isModuleScopeCurrent } from "@/lib/pilot/module-storage"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  FileText,
  History,
  AlertCircle,
  Download,
  Eye,
  UserCheck,
  Building,
  Shield,
  Network,
  BellRing,
  Lock,
  ShieldCheck,
  GitBranch,
  UserCog,
  ListChecks,
  Trash2,
} from "lucide-react"
import { motion } from "framer-motion"
import { parseStoredObject } from "@/lib/pld/module-continuity"
import { beneficiaryReviewSignature } from "@/lib/pld/beneficiary-review"
import { notifyPldIntegrationChange } from "@/lib/pld/integration-records"
import { getIntegrationClient, type IntegrationClient } from "@/lib/pld/integration-records"
import { readClientProfile, mergeClientProfile, appendClientProfileDocument } from "@/lib/pld/client-module-profiles"
import { SearchableSelect } from "@/components/pld/searchable-select"
import { readFileAsDataUrl } from "@/lib/storage/read-file"
import { flushModuleStorage } from "@/lib/pilot/module-storage"

// Tipos de datos para el módulo
interface ChecklistItem {
  id: string
  question: string
  answer: "si" | "no" | "no-aplica" | null
  required: boolean
  notes?: string
  lastUpdated?: Date
  requiredDocuments?: string[]
}

interface DocumentUpload {
  id: string
  name: string
  type: string
  uploadDate: Date
  expiryDate?: Date
  status: "vigente" | "por-vencer" | "vencido"
  url?: string
  sha256?: string
  archived?: boolean
  category: string
}

interface TraceabilityEntry {
  id: string
  action: string
  user: string
  timestamp: Date
  details: string
  section: string
}

interface PropertyChainEntry {
  id: string
  entityName: string
  country: string
  participation: string
  level: number
}

interface ScreeningResult {
  id: string
  bcName: string
  list: string
  status: "sin-coincidencias" | "coincidencia-potencial"
  source: string
  checkedAt: Date
  observations?: string
}

interface DeclarationHistoryEntry {
  id: string
  folio: string
  date: Date
  user: string
  notes?: string
}

// Preguntas generales del módulo
const preguntasGenerales: ChecklistItem[] = [
  {
    id: "bc-1",
    question: "¿El cliente declaró por escrito la existencia o inexistencia de beneficiario controlador?",
    answer: null,
    required: true,
    requiredDocuments: ["Declaración firmada del cliente sobre existencia/inexistencia de beneficiario controlador."],
  },
  {
    id: "bc-2",
    // LFPIORPI art. 3 III b) ii), reforma DOF 16-07-2025; consulta 11-11-2026.
    question: "¿Se identificó a quien ejerce el voto respecto de más del 25% del capital social, directa o indirectamente?",
    answer: null,
    required: true,
    requiredDocuments: ["Acta de socios / libro de registro de acciones actualizado."],
  },
  {
    id: "bc-3",
    question: "¿Existe persona con facultad de imponer decisiones o control societario sin tener mayoría accionaria?",
    answer: null,
    required: true,
    requiredDocuments: ["Organigrama y actas de asamblea que acrediten el control efectivo."],
  },
  {
    id: "bc-4",
    question: "¿Se identificaron controladores indirectos (a través de sociedades intermedias)?",
    answer: null,
    required: true,
    requiredDocuments: ["Cadena de propiedad documentada hasta la persona física final."],
  },
  {
    id: "bc-5",
    question: "¿Se recabaron los datos mínimos de identificación del beneficiario controlador?",
    answer: null,
    required: true,
    requiredDocuments: [
      "Formato oficial del SAT/UIF con datos mínimos del beneficiario controlador.",
      "Identificación oficial vigente, comprobante de domicilio, CURP y RFC (si aplica).",
    ],
  },
  {
    id: "bc-6",
    question: "¿Se actualizó la información del beneficiario controlador en el último año (art. 21 RCG)?",
    answer: null,
    required: true,
    requiredDocuments: ["Constancia de actualización anual de beneficiario controlador."],
  },
  {
    id: "bc-7",
    question: "¿Se documentaron cambios recientes en la estructura accionaria o en el control societario?",
    answer: null,
    required: true,
    requiredDocuments: ["Actas modificatorias y libros sociales con la actualización de la estructura."],
  },
]

// Evidencias requeridas por categoría
const evidenciasDeclaracion = [
  "Declaración firmada del cliente sobre existencia/inexistencia de beneficiario controlador.",
  "Formato oficial del SAT/UIF con datos mínimos del beneficiario controlador.",
  "Carta bajo protesta de decir verdad por inexistencia de beneficiario controlador identificable.",
]

const evidenciasDocumentacionSocietaria = [
  "Acta constitutiva y estatutos sociales vigentes inscritos en RPC.",
  "Actas de asamblea o modificatorias con registro de accionistas.",
  "Libro de socios o acciones actualizado.",
  "Organigrama societario que muestre cadena de control y beneficiario final.",
  "Documentación de cadena de propiedad hasta llegar a la persona física final (si aplica).",
]

const evidenciasIdentificacionBC = [
  "Identificación oficial vigente (INE, pasaporte o documento equivalente).",
  "CURP y RFC del beneficiario controlador (si aplica).",
  "Comprobante de domicilio con antigüedad ≤ 3 meses.",
  "Declaración de actividad u ocupación.",
  "Porcentaje de participación o medio de control (directo o indirecto).",
]

const evidenciasValidaciones = [
  "Constancia de actualización anual de beneficiario controlador.",
  "Evidencia de modificación accionaria reciente (acta de asamblea extraordinaria).",
  "Resultados de screening en listas PEP y listas restrictivas (UIF, OFAC, ONU).",
]

const evidenciasConservacion = [
  "Respaldo digital del expediente completo de beneficiario controlador.",
  "Bitácora de declaraciones anteriores con fecha y folio único.",
  "Registro de usuario interno que validó cada evidencia.",
]
export default function BeneficiarioControladorPage() {
  const [clients, setClients] = useState<IntegrationClient[]>([])
  const [selectedClient, setSelectedClient] = useState("")
  const [loadError, setLoadError] = useState("")
  useEffect(() => {
    try {
      const values = JSON.parse(getModuleStorage().getItem("kyc_expedientes_detalle") || "[]")
      if (!Array.isArray(values)) throw new Error("La colección de expedientes no es válida.")
      const items = values.map(getIntegrationClient).filter((client): client is IntegrationClient => Boolean(client))
      setClients(items)
      if (items.length === 1) setSelectedClient(items[0].id)
    } catch (error) { setLoadError(error instanceof Error ? error.message : "No se pudieron recuperar los expedientes.") }
  }, [])
  return <div className="space-y-4"><Card><CardContent className="space-y-2 pt-5" data-pld-context="browse"><Label>Expediente del cliente</Label><SearchableSelect value={selectedClient} onChange={setSelectedClient} options={clients.map((client) => ({ value: client.id, label: `${client.nombre} · ${client.identifier}` }))} placeholder="Selecciona expediente" />{loadError && <p role="alert" className="text-sm text-destructive">{loadError}</p>}{!selectedClient && <p className="text-sm text-muted-foreground">Selecciona el cliente para revisar su declaración. Los registros históricos sin vínculo se conservan para asignación.</p>}</CardContent></Card>{selectedClient && <BeneficiarioClientProfile key={selectedClient} clientId={selectedClient} />}</div>
}

function BeneficiarioClientProfile({ clientId }: { clientId: string }) {
  const { toast } = useToast()
  const [preguntasState, setPreguntasState] = useState<ChecklistItem[]>(preguntasGenerales)
  const [documentos, setDocumentos] = useState<DocumentUpload[]>([])
  const [trazabilidad, setTrazabilidad] = useState<TraceabilityEntry[]>([])
  const [progreso, setProgreso] = useState(0)
  const [activeTab, setActiveTab] = useState("preguntas")
  const [clientType, setClientType] = useState<"fisica" | "moral" | "fideicomiso" | null>(null)
  const [propertyChain, setPropertyChain] = useState<PropertyChainEntry[]>([])
  const [screeningResults, setScreeningResults] = useState<ScreeningResult[]>([])
  const [declaraciones, setDeclaraciones] = useState<DeclarationHistoryEntry[]>([])
  const [lastBCUpdate, setLastBCUpdate] = useState<Date | null>(null)
  const [folioCounter, setFolioCounter] = useState(1)
  const [bcScreeningName, setBcScreeningName] = useState("")
  const [bcScreeningList, setBcScreeningList] = useState("UIF")
  const [screeningObservation, setScreeningObservation] = useState("")
  const [declarationNotes, setDeclarationNotes] = useState("")
  const [documentoAEliminar, setDocumentoAEliminar] = useState<DocumentUpload | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [storageReady, setStorageReady] = useState(false)
  const [validation, setValidation] = useState<{ validatedAt: string; signature: string } | null>(null)
  const currentReviewSignature = beneficiaryReviewSignature({
    preguntas: preguntasState, documentos,
    clientType, propertyChain, screeningResults, declaraciones, lastBCUpdate,
  })
  const isValidated = Boolean(validation && validation.signature === currentReviewSignature)

  // Cargar datos del getModuleStorage()
  useEffect(() => {
    const savedData = getModuleStorage().getItem("beneficiario-controlador-data")
    if (savedData) {
      try {
        const data = readClientProfile(savedData, clientId)
        if (Array.isArray(data.preguntas)) {
          setPreguntasState(
            preguntasGenerales.map((pregunta) => {
              const saved = data.preguntas.find((item: ChecklistItem) => item.id === pregunta.id)
              return saved
                ? {
                    ...pregunta,
                    ...saved,
                    lastUpdated: saved.lastUpdated ? new Date(saved.lastUpdated) : undefined,
                  }
                : pregunta
            }),
          )
        }
        if (Array.isArray(data.documentos)) {
          setDocumentos(
            data.documentos.map((doc: DocumentUpload) => ({
              ...doc,
              uploadDate: doc.uploadDate ? new Date(doc.uploadDate) : new Date(),
              expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : undefined,
              category: doc.category || "otros",
            })),
          )
        }
        if (Array.isArray(data.trazabilidad)) {
          setTrazabilidad(
            data.trazabilidad.map((entry: TraceabilityEntry) => ({
              ...entry,
              timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
            })),
          )
        }
        if (data.clientType) {
          setClientType(data.clientType)
        }
        if (Array.isArray(data.propertyChain)) {
          setPropertyChain(data.propertyChain)
        }
        if (Array.isArray(data.screeningResults)) {
          setScreeningResults(
            data.screeningResults.map((result: ScreeningResult) => ({
              ...result,
              checkedAt: result.checkedAt ? new Date(result.checkedAt) : new Date(),
            })),
          )
        }
        if (Array.isArray(data.declaraciones)) {
          setDeclaraciones(
            data.declaraciones.map((declaration: DeclarationHistoryEntry) => ({
              ...declaration,
              date: declaration.date ? new Date(declaration.date) : new Date(),
            })),
          )
        }
        if (data.lastBCUpdate) {
          setLastBCUpdate(new Date(data.lastBCUpdate))
        }
        if (typeof data.folioCounter === "number") {
          setFolioCounter(data.folioCounter)
        }
        if (typeof data.validation?.validatedAt === "string" && typeof data.validation?.signature === "string") setValidation(data.validation)
        setStorageReady(true)
      } catch (error) {
        console.error("Error al cargar datos:", error)
        toast({ title: "No se pudo cargar el expediente", description: "Se conservó la información original; no se guardarán cambios hasta recuperar el registro local.", variant: "destructive" })
      }
    } else setStorageReady(true)
  }, [])

  // Calcular progreso
  useEffect(() => {
    const totalPreguntas = preguntasState.length
    const preguntasRespondidas = preguntasState.filter((p) => p.answer !== null).length
    const nuevoProgreso = Math.round((preguntasRespondidas / totalPreguntas) * 100)
    setProgreso(nuevoProgreso)
  }, [preguntasState])

  // Guardar datos en getModuleStorage()
  useEffect(() => {
    if (!storageReady || !canWriteModuleStorage("beneficiario-controlador-data")) return
    const data = {
      preguntas: preguntasState,
      documentos,
      trazabilidad,
      clientType,
      propertyChain,
      screeningResults,
      declaraciones,
      lastBCUpdate,
      folioCounter,
      validation,
    }
    try {
      const scope = captureModuleScope()
      scope.storage.setItem("beneficiario-controlador-data", JSON.stringify(mergeClientProfile(scope.storage.getItem("beneficiario-controlador-data"), clientId, data)))
      void flushModuleStorage(scope).then(() => {
        if (!isModuleScopeCurrent(scope)) return
        const canonical = readClientProfile(scope.storage.getItem("beneficiario-controlador-data"), clientId)
        if (Array.isArray(canonical.declaraciones)) setDeclaraciones((previous) => {
          // Do not replace a declaration added while this request was in flight.
          if (JSON.stringify(previous) !== JSON.stringify(data.declaraciones)) return previous
          const restored = canonical.declaraciones.map((entry: DeclarationHistoryEntry) => ({ ...entry, date: new Date(entry.date) }))
          return JSON.stringify(previous) === JSON.stringify(restored) ? previous : restored
        })
        notifyPldIntegrationChange("beneficiario-controlador-data")
      }).catch(() => {
        if (isModuleScopeCurrent(scope)) toast({ title: "Cambios pendientes de guardar", description: "No se confirmó el guardado del beneficiario. Mantén esta página abierta y vuelve a intentarlo.", variant: "destructive" })
      })
    } catch {
      toast({ title: "No se pudo guardar el expediente", description: "Los cambios no se han conservado. Revisa el almacenamiento local antes de salir.", variant: "destructive" })
    }
  }, [
    preguntasState,
    documentos,
    trazabilidad,
    clientType,
    propertyChain,
    screeningResults,
    declaraciones,
    lastBCUpdate,
    folioCounter,
    storageReady,
    validation,
    toast,
  ])

  // Actualizar respuesta de pregunta
  const actualizarRespuesta = (id: string, answer: "si" | "no" | "no-aplica", notes?: string) => {
    setPreguntasState((prev) =>
      prev.map((pregunta) => (pregunta.id === id ? { ...pregunta, answer, notes, lastUpdated: new Date() } : pregunta)),
    )

    // Agregar entrada de trazabilidad
    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: "Respuesta actualizada",
      user: getModuleStorage().getItem("userEmail") || "Usuario en sesión",
      timestamp: new Date(),
      details: `Pregunta: ${preguntasState.find((p) => p.id === id)?.question.substring(0, 50)}... - Respuesta: ${answer}`,
      section: "Preguntas Generales",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])

    toast({
      title: "Respuesta actualizada",
      description: "El estado de guardado muestra si el cambio ya quedó conservado.",
    })
  }

  const cargarDocumento = (tipo: string, category: string, _expiryDays = 0) => {
    const scope = captureModuleScope()
    const input = document.createElement("input")
    input.type = "file"; input.accept = ".pdf,.png,.jpg,.jpeg,.xml"
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file || !storageReady || !isModuleScopeCurrent(scope)) return
      if (file.size > 20 * 1024 * 1024 || !/\.(pdf|png|jpe?g|xml)$/i.test(file.name)) {
        toast({ title: "Archivo no admitido", description: "Usa PDF, imagen o XML de hasta 20 MB.", variant: "destructive" }); return
      }
      try {
        const url = await readFileAsDataUrl(file)
        assertModuleScope(scope)
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))).map((value) => value.toString(16).padStart(2, "0")).join("")
        assertModuleScope(scope)
        const now = new Date()
        const actor = scope.storage.getItem("userEmail") || scope.storage.getItem("userName") || "Usuario en sesión"
        const uploaded: DocumentUpload = { id: crypto.randomUUID(), name: file.name, type: tipo,
          uploadDate: now, status: "vigente", category, url, sha256: hash,
          expiryDate: undefined }
        const data = appendClientProfileDocument(scope.storage, "beneficiario-controlador-data", clientId, uploaded,
          { id: crypto.randomUUID(), action: "Documento cargado", user: actor, timestamp: now, details: file.name, section: "Carga documental" })
        setDocumentos(data.documentos.map((doc: DocumentUpload) => ({ ...doc, uploadDate: new Date(doc.uploadDate), expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : undefined })))
        setTrazabilidad(data.trazabilidad.map((entry: TraceabilityEntry) => ({ ...entry, timestamp: new Date(entry.timestamp) }))); setValidation(null)
        await flushModuleStorage(scope)
        assertModuleScope(scope)
        const canonical = readClientProfile(scope.storage.getItem("beneficiario-controlador-data"), clientId)
        setDocumentos((canonical.documentos || []).map((doc: DocumentUpload) => ({ ...doc, uploadDate: new Date(doc.uploadDate), expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : undefined })))
        toast({ title: "Documento guardado", description: "El archivo y su hash quedaron vinculados al expediente." })
      } catch (error) { if (isModuleScopeCurrent(scope)) toast({title:"No se guardó el archivo",description:error instanceof Error ? error.message : "Conserva el documento y reintenta.",variant:"destructive"}) }
    }
    input.click()
  }

  const solicitarEliminacionDocumento = (doc: DocumentUpload) => {
    setDocumentoAEliminar(doc)
    setIsDeleteDialogOpen(true)
  }

  const cerrarDialogoEliminacion = () => {
    setIsDeleteDialogOpen(false)
    setDocumentoAEliminar(null)
  }

  const confirmarEliminacionDocumento = () => {
    if (!documentoAEliminar) {
      return
    }

    const documento = documentoAEliminar
    setDocumentos((prev) => prev.map((item) => item.id === documento.id ? { ...item, archived: true } : item))

    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: "Documento archivado",
      user: getModuleStorage().getItem("userEmail") || "Usuario en sesión",
      timestamp: new Date(),
      details: `Documento archivado, archivo e historial conservados: ${documento.name}`,
      section: "Carga Documental",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])

    toast({
      title: "Documento archivado",
      description: `El documento ${documento.name} y su historial se conservan. Revisa el estado de guardado.`,
    })

    cerrarDialogoEliminacion()
  }

  // Obtener color según respuesta
  const getAnswerColor = (answer: ChecklistItem["answer"]) => {
    switch (answer) {
      case "si":
        return "text-green-600 bg-green-50"
      case "no":
        return "text-red-600 bg-red-50"
      case "no-aplica":
        return "text-gray-600 bg-gray-50"
      default:
        return "text-gray-400 bg-gray-50"
    }
  }

  // Obtener estado de documento
  const getDocumentStatus = (doc: DocumentUpload) => {
    if (!doc.expiryDate) return "vigente"

    const now = new Date()
    const expiry = new Date(doc.expiryDate)
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilExpiry < 0) return "vencido"
    if (daysUntilExpiry <= 30) return "por-vencer"
    return "vigente"
  }

  const isBeneficiarioControladorObligatorio = clientType === "moral" || clientType === "fideicomiso"
  const hasDeclaracionDocumento = documentos.some((doc) => doc.category === "declaracion" && !doc.archived && Boolean(doc.url))
  const daysSinceUpdate = lastBCUpdate ? Math.floor((Date.now() - lastBCUpdate.getTime()) / (1000 * 60 * 60 * 24)) : null
  const needsAnnualReminder = !lastBCUpdate || (daysSinceUpdate !== null && daysSinceUpdate > 365)
  const declaracionPendiente = isBeneficiarioControladorObligatorio && !hasDeclaracionDocumento
  const ultimaDeclaracion = declaraciones.length > 0 ? declaraciones[0] : null
  const ultimoScreening = screeningResults.length > 0 ? screeningResults[0] : null

  const generarFolio = () => {
    const year = new Date().getFullYear()
    return `BC-${year}-${folioCounter.toString().padStart(4, "0")}`
  }

  const registrarDeclaracion = () => {
    const nuevaDeclaracion: DeclarationHistoryEntry = {
      id: Date.now().toString(),
      folio: generarFolio(),
      date: new Date(),
      user: getModuleStorage().getItem("userEmail") || "Usuario en sesión",
      notes: declarationNotes || undefined,
    }

    setDeclaraciones((prev) => [nuevaDeclaracion, ...prev])
    setFolioCounter((prev) => prev + 1)
    setDeclarationNotes("")

    setTrazabilidad((prev) => [
      {
        id: Date.now().toString(),
        action: "Declaración registrada",
        user: getModuleStorage().getItem("userEmail") || "Usuario en sesión",
        timestamp: new Date(),
        details: `Se registró la declaración folio ${nuevaDeclaracion.folio}`,
        section: "Declaraciones",
      },
      ...prev,
    ])

    toast({
      title: "Declaración registrada",
      description: `Se generó el folio ${nuevaDeclaracion.folio} para la declaración del beneficiario controlador.`,
    })
  }

  const addPropertyChainEntry = () => {
    const nuevoNivel = propertyChain.length + 1
    const nuevaEntidad: PropertyChainEntry = {
      id: Date.now().toString(),
      entityName: "",
      country: "",
      participation: "",
      level: nuevoNivel,
    }
    setPropertyChain((prev) => [...prev, nuevaEntidad])
    setTrazabilidad((prev) => [
      {
        id: Date.now().toString(),
        action: "Cadena de propiedad actualizada",
        user: getModuleStorage().getItem("userEmail") || "Usuario en sesión",
        timestamp: new Date(),
        details: `Se agregó el nivel ${nuevoNivel} a la cadena de propiedad`,
        section: "Cadena de Propiedad",
      },
      ...prev,
    ])
  }

  const updatePropertyChainEntry = (id: string, field: keyof PropertyChainEntry, value: string | number) => {
    setPropertyChain((prev) => prev.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry)))
  }

  const removePropertyChainEntry = (id: string) => {
    const entry = propertyChain.find((item) => item.id === id)
    setPropertyChain((prev) =>
      prev
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, level: index + 1 })),
    )
    if (entry) {
      setTrazabilidad((prev) => [
        {
          id: Date.now().toString(),
          action: "Cadena de propiedad actualizada",
          user: getModuleStorage().getItem("userEmail") || "Usuario en sesión",
          timestamp: new Date(),
          details: `Se eliminó el nivel ${entry.level} (${entry.entityName || "Sin nombre"}) de la cadena de propiedad`,
          section: "Cadena de Propiedad",
        },
        ...prev,
      ])
    }
  }

  const ejecutarScreening = (status: ScreeningResult["status"]) => {
    if (!bcScreeningName.trim()) {
      toast({
        title: "Falta información",
        description: "Debes indicar el nombre del beneficiario controlador para registrar la consulta realizada.",
        variant: "destructive",
      })
      return
    }

    const nuevoResultado: ScreeningResult = {
      id: Date.now().toString(),
      bcName: bcScreeningName.trim(),
      list: bcScreeningList,
      status,
      source: `Verificación manual registrada por el usuario · lista ${bcScreeningList}`,
      checkedAt: new Date(),
      observations: screeningObservation || undefined,
    }

    setScreeningResults((prev) => [nuevoResultado, ...prev])
    setBcScreeningName("")
    setScreeningObservation("")

    setTrazabilidad((prev) => [
      {
        id: Date.now().toString(),
        action: "Verificación manual registrada",
        user: getModuleStorage().getItem("userEmail") || "Usuario en sesión",
        timestamp: new Date(),
        details: `Resultado ${status === "sin-coincidencias" ? "sin coincidencias" : "coincidencia potencial"} para ${nuevoResultado.bcName}`,
        section: "Screening",
      },
      ...prev,
    ])

    toast({
      title: "Screening registrado",
      description: `Se documentó el resultado que indicaste para ${bcScreeningList}. Esta acción no consulta servicios externos.`,
    })
  }

  const cerrarExpediente = async () => {
    const scope = captureModuleScope()
    if (!storageReady || !clientType || preguntasState.some((question) => question.required && question.answer === null)) {
      toast({ title: "Revisión incompleta", description: "Selecciona el tipo de cliente y responde los controles obligatorios antes de validar.", variant: "destructive" })
      return
    }
    if (isBeneficiarioControladorObligatorio && !hasDeclaracionDocumento) {
      toast({
        title: "No es posible cerrar el expediente",
        description: "Debes adjuntar la declaración del beneficiario controlador antes de cerrar.",
        variant: "destructive",
      })
      return
    }

    const nextTrace: TraceabilityEntry[] = [
      {
        id: crypto.randomUUID(),
        action: "Expediente validado",
        user: getModuleStorage().getItem("userEmail") || "Usuario en sesión",
        timestamp: new Date(),
        details: "Revisión interna registrada por el usuario; no sustituye una validación de autoridad.",
        section: "Control de Expediente",
      },
      ...trazabilidad,
    ]
    try {
      // Server-stamped declaration history is part of the reviewed content.
      // Finish pending writes before signing that exact version, not its local precursor.
      await flushModuleStorage(scope)
      assertModuleScope(scope)
      const current = readClientProfile(scope.storage.getItem("beneficiario-controlador-data"), clientId)
      const data = { ...current, trazabilidad: nextTrace, validation: { validatedAt: new Date().toISOString(), signature: beneficiaryReviewSignature(current) } }
      scope.storage.setItem("beneficiario-controlador-data",JSON.stringify(mergeClientProfile(scope.storage.getItem("beneficiario-controlador-data"),clientId,data)))
      await flushModuleStorage(scope)
      assertModuleScope(scope)
      const canonical = readClientProfile(scope.storage.getItem("beneficiario-controlador-data"), clientId)
      setValidation(canonical.validation ?? null)
      setDeclaraciones((previous) => JSON.stringify(previous) === JSON.stringify(declaraciones) ? (canonical.declaraciones || []).map((entry: DeclarationHistoryEntry) => ({ ...entry, date: new Date(entry.date) })) : previous)
      setTrazabilidad((canonical.trazabilidad || []).map((entry: TraceabilityEntry) => ({ ...entry, timestamp: new Date(entry.timestamp) })))
      if (!canonical.validation) { toast({ title: "Revisión pendiente", description: "El expediente cambió durante el guardado; confirma la versión actual.", variant: "destructive" }); return }
      toast({title:"Expediente validado",description:"Se conservó la revisión interna. Los cambios posteriores requerirán una nueva confirmación."})
    } catch (error) { if (isModuleScopeCurrent(scope)) toast({title:"No se confirmó la revisión",description:error instanceof Error ? error.message : "Mantén la página abierta y reintenta.",variant:"destructive"}) }
  }

  const registrarActualizacionBC = () => {
    const fecha = new Date()
    setLastBCUpdate(fecha)
    setTrazabilidad((prev) => [
      {
        id: Date.now().toString(),
        action: "Actualización anual registrada",
        user: getModuleStorage().getItem("userEmail") || "Usuario en sesión",
        timestamp: fecha,
        details: "Se actualizó la información del beneficiario controlador conforme al art. 21 RCG.",
        section: "Actualización",
      },
      ...prev,
    ])

    toast({
      title: "Actualización registrada",
      description: "Se documentó la fecha de actualización anual del beneficiario controlador.",
    })
  }

  const handleClientTypeChange = (value: "fisica" | "moral" | "fideicomiso") => {
    setClientType(value)
    setTrazabilidad((prev) => [
      {
        id: Date.now().toString(),
        action: "Tipo de cliente actualizado",
        user: getModuleStorage().getItem("userEmail") || "Usuario en sesión",
        timestamp: new Date(),
        details: `Se seleccionó cliente ${value === "fisica" ? "persona física" : value === "moral" ? "persona moral" : "fideicomiso"}.`,
        section: "Clasificación de Cliente",
      },
      ...prev,
    ])
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Network className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Beneficiario Controlador</h1>
            <p className="text-muted-foreground">
              Identifica a la(s) persona(s) física(s) que, directa o indirectamente, obtienen el beneficio o ejercen el
              control efectivo sobre el cliente a través de participaciones, facultades de decisión u otros medios de
              control de facto. La información debe recabarse en toda relación de negocios, actualizarse al menos una vez
              al año y conservarse con su evidencia documental.
            </p>
          </div>
        </div>

        {/* Progreso general */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-medium">Progreso del Módulo</h3>
                <p className="text-sm text-muted-foreground">
                  {preguntasState.filter((p) => p.answer !== null).length} de {preguntasState.length} preguntas
                  respondidas
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{progreso}%</div>
                <div className="text-sm text-muted-foreground">Completado</div>
              </div>
            </div>
            <Progress value={progreso} className="h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Tabs principales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Configuración del expediente
          </CardTitle>
          <CardDescription>
            Selecciona el tipo de cliente para activar los controles obligatorios del beneficiario controlador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Tipo de cliente</Label>
              <Select
                value={clientType ?? ""}
                onValueChange={(value) => handleClientTypeChange(value as "fisica" | "moral" | "fideicomiso")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una opción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fisica">Persona física</SelectItem>
                  <SelectItem value="moral">Persona moral</SelectItem>
                  <SelectItem value="fideicomiso">Fideicomiso</SelectItem>
                </SelectContent>
              </Select>
              <div className="rounded-lg border p-3 bg-muted/40 flex items-start gap-3">
                <Shield className="h-4 w-4 mt-1 text-primary" />
                <div className="text-sm text-muted-foreground">
                  {clientType === "fisica" && (
                    <span>
                      Para personas físicas la declaración de beneficiario controlador es opcional, pero se recomienda
                      documentar la titularidad real cuando existan terceros con control.
                    </span>
                  )}
                  {(clientType === "moral" || clientType === "fideicomiso") && (
                    <span>
                      La plataforma marcará como obligatoria la sección de beneficiario controlador y exigirá la
                      declaración firmada antes de cerrar el expediente.
                    </span>
                  )}
                  {!clientType && <span>Selecciona un tipo de cliente para ver los requisitos aplicables.</span>}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-medium">Seguimiento normativo</Label>
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Última actualización anual
                  </div>
                  <Badge variant={needsAnnualReminder ? "destructive" : "default"}>
                    {lastBCUpdate ? lastBCUpdate.toLocaleDateString() : "Sin registro"}
                  </Badge>
                </div>
                {needsAnnualReminder ? (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <BellRing className="h-4 w-4 mt-0.5 text-amber-500" />
                    <span>
                      Programa la actualización anual del beneficiario controlador. Este aviso permanecerá visible hasta
                      registrar una nueva fecha; no se envían notificaciones externas.
                    </span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    La actualización se encuentra al día conforme al artículo 21 de las Reglas de Carácter General.
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={registrarActualizacionBC}>
                    <Clock className="h-4 w-4 mr-2" /> Registrar actualización
                  </Button>
                  <Button size="sm" data-pld-action="approve" onClick={cerrarExpediente} disabled={isValidated || !storageReady}>
                    <Lock className="h-4 w-4 mr-2" /> {isValidated ? "Revisión interna confirmada" : "Validar expediente"}
                  </Button>
                </div>
                {validation && <p className="text-xs text-muted-foreground">{isValidated ? `Confirmado el ${new Date(validation.validatedAt).toLocaleString()}` : "El expediente cambió después de la última revisión. Confirma nuevamente."}</p>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="preguntas" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Preguntas Normativas
          </TabsTrigger>
          <TabsTrigger value="documentos" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Carga Documental
          </TabsTrigger>
          <TabsTrigger value="alertas" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alertas de Vencimiento
          </TabsTrigger>
          <TabsTrigger value="trazabilidad" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Bitácora de Trazabilidad
          </TabsTrigger>
        </TabsList>

        {/* Tab: Preguntas Normativas */}
        <TabsContent value="preguntas" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Preguntas de Control del Beneficiario Controlador
              </CardTitle>
              <CardDescription>
                Responde las siguientes preguntas para verificar el cumplimiento de identificación del beneficiario
                controlador
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {preguntasState.map((pregunta, index) => (
                <motion.div
                  key={pregunta.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-4 p-4 border rounded-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Label className="text-sm font-medium">
                        {index + 1}. {pregunta.question}
                        {pregunta.required && <span className="text-red-500 ml-1">*</span>}
                      </Label>
                    </div>
                    {pregunta.lastUpdated && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {pregunta.lastUpdated.toLocaleDateString()}
                      </Badge>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {(["si", "no", "no-aplica"] as const).map((option) => (
                      <Button
                        key={option}
                        variant={pregunta.answer === option ? "default" : "outline"}
                        size="sm"
                        onClick={() => actualizarRespuesta(pregunta.id, option)}
                        className={
                          pregunta.answer === option ? getAnswerColor(option) : ""
                        }
                      >
                        {option === "si" ? "Sí" : option === "no" ? "No" : "No Aplica"}
                      </Button>
                    ))}
                  </div>

                  {pregunta.answer && (
                    <div className="space-y-2">
                      <Label htmlFor={`notes-${pregunta.id}`} className="text-sm">
                        Notas adicionales (opcional)
                      </Label>
                      <Textarea
                        id={`notes-${pregunta.id}`}
                        placeholder="Agregar observaciones o detalles adicionales..."
                        value={pregunta.notes || ""}
                        onChange={(e) => {
                          setPreguntasState((prev) =>
                            prev.map((p) => (p.id === pregunta.id ? { ...p, notes: e.target.value } : p)),
                          )
                        }}
                        className="min-h-[80px]"
                      />
                    </div>
                  )}

                  {pregunta.requiredDocuments && pregunta.requiredDocuments.length > 0 && (
                    <div className="border rounded-lg p-3 bg-muted/40 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase">
                        <ListChecks className="h-4 w-4 text-primary" /> Evidencia requerida
                      </div>
                      <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                        {pregunta.requiredDocuments.map((doc, index) => (
                          <li key={index}>{doc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Carga Documental */}
        <TabsContent value="documentos" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {/* A. Declaración y acreditación */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  A. Declaración y acreditación
                </CardTitle>
                <CardDescription>Documentos de declaración del BC</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasDeclaracion.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" aria-label={`Cargar ${evidencia}`} onClick={() => cargarDocumento(evidencia, "declaracion")}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* B. Documentación societaria */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  B. Documentación societaria
                </CardTitle>
                <CardDescription>Estructura corporativa</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasDocumentacionSocietaria.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" aria-label={`Cargar ${evidencia}`} onClick={() => cargarDocumento(evidencia, "documentacion")}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* C. Identificación del Beneficiario Controlador (BC) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  C. Identificación del BC
                </CardTitle>
                <CardDescription>Datos del beneficiario controlador</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasIdentificacionBC.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" aria-label={`Cargar ${evidencia}`} onClick={() => cargarDocumento(evidencia, "identificacion")}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* D. Validaciones y actualización */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  D. Validaciones y actualización
                </CardTitle>
                <CardDescription>Verificaciones realizadas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasValidaciones.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" aria-label={`Cargar ${evidencia}`} onClick={() => cargarDocumento(evidencia, "validaciones", evidencia.includes("actualización") ? 365 : 180)}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* E. Conservación y trazabilidad */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  E. Conservación y trazabilidad
                </CardTitle>
                <CardDescription>Mantenimiento de registros</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasConservacion.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" aria-label={`Cargar ${evidencia}`} onClick={() => cargarDocumento(evidencia, "conservacion", 0)}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Cadenas de propiedad */}
            <Card className="md:col-span-2 lg:col-span-3 xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  Cadenas de propiedad
                </CardTitle>
                <CardDescription>Documenta organigramas y sociedades intermedias</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => cargarDocumento("Organigrama societario", "organigrama", 0)}
                  >
                    <Upload className="h-3 w-3 mr-2" /> Cargar organigrama
                  </Button>
                  <Button size="sm" onClick={addPropertyChainEntry}>
                    <GitBranch className="h-3 w-3 mr-2" /> Añadir nivel intermedio
                  </Button>
                </div>

                {propertyChain.length === 0 ? (
                  <div className="text-sm text-muted-foreground bg-muted/40 border rounded-lg p-4">
                    Registra cada sociedad intermedia, país de constitución y porcentaje de participación hasta llegar a la
                    persona física final.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {propertyChain.map((entry) => (
                      <div key={entry.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary">Nivel {entry.level}</Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removePropertyChainEntry(entry.id)}
                            aria-label="Eliminar nivel"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="space-y-1">
                            <Label className="text-xs uppercase text-muted-foreground">Entidad / sociedad</Label>
                            <Input
                              placeholder="Nombre legal"
                              value={entry.entityName}
                              onChange={(e) => updatePropertyChainEntry(entry.id, "entityName", e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs uppercase text-muted-foreground">País</Label>
                            <Input
                              placeholder="País de constitución"
                              value={entry.country}
                              onChange={(e) => updatePropertyChainEntry(entry.id, "country", e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs uppercase text-muted-foreground">Participación (%)</Label>
                            <Input
                              placeholder="Ej. 45%"
                              value={entry.participation}
                              onChange={(e) => updatePropertyChainEntry(entry.id, "participation", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Lista de documentos cargados */}
          {documentos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Documentos Cargados</CardTitle>
                <CardDescription>Lista de documentos subidos al sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {documentos.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{doc.name} {doc.archived && <Badge variant="outline">Archivado</Badge>}</div>
                          <div className="text-sm text-muted-foreground">
                            Subido: {doc.uploadDate.toLocaleDateString()}
                            {doc.expiryDate && ` • Vence: ${doc.expiryDate.toLocaleDateString()}`}
                          </div>
                          <Badge variant="outline" className="mt-1 capitalize">
                            {doc.category.replace(/-/g, " ")}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={
                            getDocumentStatus(doc) === "vigente"
                              ? "default"
                              : getDocumentStatus(doc) === "por-vencer"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {getDocumentStatus(doc) === "vigente"
                            ? "Vigente"
                            : getDocumentStatus(doc) === "por-vencer"
                              ? "Por vencer"
                              : "Vencido"}
                        </Badge>
                        {doc.url ? <><Button size="sm" variant="ghost" asChild><DocumentLink href={doc.url} target="_blank" rel="noreferrer" aria-label={`Ver ${doc.name}`}><Eye className="h-4 w-4" /></DocumentLink></Button><Button size="sm" variant="ghost" asChild><DocumentLink href={doc.url} download={doc.name} aria-label={`Descargar ${doc.name}`}><Download className="h-4 w-4" /></DocumentLink></Button></> : <Badge variant="outline">Archivo pendiente</Badge>}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => solicitarEliminacionDocumento(doc)}
                          disabled={doc.archived}
                          className="text-destructive hover:text-destructive focus-visible:ring-destructive"
                          aria-label={`Archivar ${doc.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Alertas de Vencimiento */}
        <TabsContent value="alertas" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Alertas Automáticas de Vencimientos
              </CardTitle>
              <CardDescription>Sistema de alertas para documentos próximos a vencer</CardDescription>
            </CardHeader>
            <CardContent>
              {documentos.filter((doc) => getDocumentStatus(doc) !== "vigente").length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <h3 className="font-medium mb-2">Todos los documentos están vigentes</h3>
                  <p>No hay documentos próximos a vencer o vencidos</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {documentos
                    .filter((doc) => getDocumentStatus(doc) !== "vigente")
                    .map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg bg-amber-50">
                        <div className="flex items-center space-x-3">
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                          <div>
                            <div className="font-medium">{doc.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {getDocumentStatus(doc) === "vencido"
                                ? "Documento vencido"
                                : `Vence el ${doc.expiryDate?.toLocaleDateString()}`}
                            </div>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          Renovar documento
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Estado de cumplimiento obligatorio
              </CardTitle>
              <CardDescription>Validación automática de requisitos críticos del beneficiario controlador</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between border rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Declaración del beneficiario controlador</p>
                    <p className="text-sm text-muted-foreground">
                      La plataforma bloquea el cierre del expediente si no se adjunta la declaración firmada.
                    </p>
                  </div>
                </div>
                <Badge variant={declaracionPendiente ? "destructive" : "default"}>
                  {declaracionPendiente ? "Pendiente" : "Completo"}
                </Badge>
              </div>
              <div className="flex items-start justify-between border rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Actualización anual registrada</p>
                    <p className="text-sm text-muted-foreground">
                      {lastBCUpdate
                        ? `Última actualización documentada el ${lastBCUpdate.toLocaleDateString()}.`
                        : "No se ha documentado la actualización anual del beneficiario controlador."}
                    </p>
                  </div>
                </div>
                <Badge variant={needsAnnualReminder ? "secondary" : "default"}>
                  {needsAnnualReminder ? "Recordar" : "Al día"}
                </Badge>
              </div>
              <div className="flex items-start justify-between border rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Screening en listas restrictivas</p>
                    <p className="text-sm text-muted-foreground">
                      {ultimoScreening
                        ? `Última revisión manual (${ultimoScreening.list}) registrada el ${ultimoScreening.checkedAt.toLocaleDateString()}.`
                        : "Registra al menos una verificación en listas UIF, OFAC u ONU para documentar el control continuo."}
                    </p>
                  </div>
                </div>
                <Badge variant={ultimoScreening ? "default" : "secondary"}>
                  {ultimoScreening ? (ultimoScreening.status === "sin-coincidencias" ? "Sin coincidencias" : "Revisar") : "Pendiente"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Registro de verificación manual (UIF / OFAC / ONU / PEP)
              </CardTitle>
              <CardDescription>Documenta consultas realizadas fuera de esta pantalla. Los resultados los proporciona el usuario; no se consulta automáticamente ninguna lista.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Nombre del beneficiario controlador</Label>
                    <Input
                      placeholder="Nombre completo"
                      value={bcScreeningName}
                      onChange={(e) => setBcScreeningName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Lista consultada</Label>
                    <Select value={bcScreeningList} onValueChange={setBcScreeningList}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una lista" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UIF">UIF</SelectItem>
                        <SelectItem value="OFAC">OFAC</SelectItem>
                        <SelectItem value="ONU">ONU</SelectItem>
                        <SelectItem value="PEP">PEP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Observaciones</Label>
                    <Textarea
                      placeholder="Resultados relevantes, coincidencias parciales, acciones de seguimiento..."
                      value={screeningObservation}
                      onChange={(e) => setScreeningObservation(e.target.value)}
                      className="min-h-[120px]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => ejecutarScreening("sin-coincidencias")}>
                      <ShieldCheck className="h-4 w-4 mr-2" /> Registrar sin coincidencias
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => ejecutarScreening("coincidencia-potencial")}>
                      <AlertCircle className="h-4 w-4 mr-2 text-amber-500" /> Registrar coincidencia potencial
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Historial de screening</h4>
                    <Badge variant="secondary">{screeningResults.length} registros</Badge>
                  </div>
                  <ScrollArea className="h-[260px] border rounded-lg">
                    <div className="p-4 space-y-3">
                      {screeningResults.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-8">
                          No se han documentado screenings.
                        </div>
                      ) : (
                        screeningResults.map((result) => (
                          <div key={result.id} className="border rounded-lg p-3 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{result.bcName}</span>
                              <Badge variant={result.status === "sin-coincidencias" ? "default" : "destructive"}>
                                {result.status === "sin-coincidencias" ? "Sin coincidencias" : "Revisar"}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Lista: {result.list} • {result.checkedAt.toLocaleString()}
                            </div>
                            {result.observations && (
                              <p className="text-sm text-muted-foreground">{result.observations}</p>
                            )}
                            <p className="text-xs text-muted-foreground">Fuente: {result.source}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Bitácora de Trazabilidad */}
        <TabsContent value="trazabilidad" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Historial de declaraciones del beneficiario controlador
              </CardTitle>
              <CardDescription>Genera folios y documenta la validación interna de cada declaración</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Notas del folio</Label>
                    <Textarea
                      placeholder="Detalle de la declaración, controles aplicados, responsable interno..."
                      value={declarationNotes}
                      onChange={(e) => setDeclarationNotes(e.target.value)}
                      className="min-h-[120px]"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary">{declaraciones.length} folios generados</Badge>
                    <Button size="sm" onClick={registrarDeclaracion}>
                      <FileText className="h-4 w-4 mr-2" /> Registrar declaración
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Bitácora</h4>
                    {ultimaDeclaracion && (
                      <Badge variant="outline">Último folio: {ultimaDeclaracion.folio}</Badge>
                    )}
                  </div>
                  <ScrollArea className="h-[220px] border rounded-lg">
                    <div className="p-4 space-y-3">
                      {declaraciones.length === 0 ? (
                        <div className="text-sm text-muted-foreground text-center py-6">
                          No se han registrado declaraciones.
                        </div>
                      ) : (
                        declaraciones.map((declaracion) => (
                          <div key={declaracion.id} className="border rounded-lg p-3 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">Folio {declaracion.folio}</span>
                              <Badge variant="outline">{declaracion.date.toLocaleDateString()}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">Validó: {declaracion.user}</p>
                            {declaracion.notes && (
                              <p className="text-sm text-muted-foreground">{declaracion.notes}</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Bitácora de Trazabilidad con Sello de Tiempo
              </CardTitle>
              <CardDescription>Registro completo de todas las acciones realizadas en el módulo</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {trazabilidad.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4" />
                    <h3 className="font-medium mb-2">Sin actividad registrada</h3>
                    <p>Las acciones realizadas aparecerán aquí</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {trazabilidad.map((entry) => (
                      <div key={entry.id} className="flex items-start space-x-4 p-4 border rounded-lg">
                        <div className="bg-primary/10 rounded-full p-2">
                          <Clock className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium">{entry.action}</span>
                            <Badge variant="outline">{entry.section}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{entry.details}</p>
                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <span>Usuario: {entry.user}</span>
                            <span>•</span>
                            <span>{entry.timestamp.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            cerrarDialogoEliminacion()
          } else {
            setIsDeleteDialogOpen(true)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivar documento</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Deseas archivar el documento "{documentoAEliminar?.name}"? El archivo y su historial se conservan; dejará de contar como documento activo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cerrarDialogoEliminacion}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarEliminacionDocumento}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive"
            >
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
