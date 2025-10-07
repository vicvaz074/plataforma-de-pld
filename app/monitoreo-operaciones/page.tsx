"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
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
  Activity,
  TrendingUp,
  Shield,
  Search,
  Target,
  Calculator,
  BellRing,
  Link2,
  Archive,
  BarChart3,
  ListChecks,
  FileSpreadsheet,
  UserCheck,
} from "lucide-react"
import { persistFile, openStoredFile, downloadStoredFile, getStoredFile } from "@/lib/files"
import { AlertRecord, resolveAlert, syncDocumentAlerts } from "@/lib/alerts"
import { motion } from "framer-motion"

// Tipos de datos para el módulo
interface ChecklistItem {
  id: string
  question: string
  answer: "si" | "no" | "no-aplica" | null
  required: boolean
  notes?: string
  lastUpdated?: Date
}

interface DocumentUpload {
  id: string
  name: string
  type: string
  uploadDate: Date
  expiryDate?: Date
  status: "vigente" | "por-vencer" | "vencido"
  fileId: string
  fileName: string
  fileSize: number
  fileType: string
}

interface TraceabilityEntry {
  id: string
  action: string
  user: string
  timestamp: Date
  details: string
  section: string
}

interface OperationRecord {
  id: string
  clientName: string
  clientType: "persona-fisica" | "persona-moral"
  semester: string
  amount: number
  classification: "relevante" | "inusual" | "interna-preocupante"
  evidences: string[]
  profileAligned: boolean
  registeredBy: string
  createdAt: Date
}

interface MonitoreoStorageData {
  preguntas: ChecklistItem[]
  documentos: DocumentUpload[]
  trazabilidad: TraceabilityEntry[]
  operaciones: OperationRecord[]
}

// Preguntas generales del módulo
const preguntasGenerales: ChecklistItem[] = [
  // A. Acumulación semestral (art. 19 RCG)
  {
    id: "mo-1",
    question: "¿Se verificó si el cliente realizó múltiples operaciones en el semestre que, sumadas, superan los umbrales?",
    answer: null,
    required: true,
  },
  {
    id: "mo-2",
    question: "¿Se documentó la metodología usada para el cálculo acumulado?",
    answer: null,
    required: true,
  },

  // B. Operaciones inusuales
  {
    id: "mo-3",
    question: "¿La operación se aparta del perfil económico, profesional o transaccional declarado en KYC?",
    answer: null,
    required: true,
  },
  {
    id: "mo-4",
    question: "¿Existen operaciones sin justificación económica aparente?",
    answer: null,
    required: true,
  },

  // C. Fraccionamiento
  {
    id: "mo-5",
    question: "¿Se detectó intento de fraccionamiento para evitar umbrales de aviso?",
    answer: null,
    required: true,
  },

  // D. Operaciones internas preocupantes
  {
    id: "mo-6",
    question: "¿Existen indicios de que personal interno autorizó, ejecutó o toleró operaciones irregulares?",
    answer: null,
    required: true,
  },

  // E. Validación contra listas
  {
    id: "mo-7",
    question: "¿Se verificó si el cliente aparece en listas restrictivas (UIF, ONU, OFAC, etc.)?",
    answer: null,
    required: true,
  },
]

// Evidencias requeridas por categoría
const evidenciasGenerales = [
  { id: "contrato", label: "Contrato o documento que ampare la operación." },
  { id: "comprobante-pago", label: "Comprobante de pago (transferencia, cheque, recibo de efectivo)." },
  { id: "factura", label: "Factura o comprobante fiscal digital (CFDI)." },
  { id: "estado-cuenta", label: "Estado de cuenta bancario relacionado." },
  { id: "reporte-semestral", label: "Reporte semestral de acumulación de operaciones." },
]

const evidenciasClasificacion: Record<
  OperationRecord["classification"] | "validacion-listas",
  { id: string; label: string }[]
> = {
  relevante: [],
  inusual: [
    { id: "dictamen-cumplimiento", label: "Dictamen del área de cumplimiento." },
    { id: "analisis-perfil", label: "Evidencia de análisis de perfil vs operación." },
  ],
  "interna-preocupante": [
    { id: "acta-investigacion", label: "Acta de investigación interna." },
    { id: "testimonio-personal", label: "Testimonio/documentación de personal involucrado." },
  ],
  "validacion-listas": [
    { id: "reporte-screening", label: "Reporte de screening en listas restrictivas." },
  ],
}

const evidenciasFraccionamiento = [
  { id: "reporte-vinculadas", label: "Reporte de operaciones vinculadas por cliente/periodo." },
]

export default function MonitoreoOperacionesPage() {
  const { toast } = useToast()
  const initialFormState = {
    clientName: "",
    clientType: "persona-fisica" as OperationRecord["clientType"],
    semester: "",
    amount: "",
    classification: "relevante" as OperationRecord["classification"],
    profileAligned: true,
    evidences: [] as string[],
  }
  const [preguntasState, setPreguntasState] = useState<ChecklistItem[]>(preguntasGenerales)
  const [documentos, setDocumentos] = useState<DocumentUpload[]>([])
  const [trazabilidad, setTrazabilidad] = useState<TraceabilityEntry[]>([])
  const [operaciones, setOperaciones] = useState<OperationRecord[]>([])
  const [progreso, setProgreso] = useState(0)
  const [activeTab, setActiveTab] = useState("preguntas")
  const [ultimoScreening, setUltimoScreening] = useState<Date | null>(null)
  const [ultimaSincronizacionKyc, setUltimaSincronizacionKyc] = useState<Date | null>(null)
  const [ultimoEnvioUif, setUltimoEnvioUif] = useState<Date | null>(null)
  const [formOperacion, setFormOperacion] = useState(initialFormState)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [pendingUpload, setPendingUpload] = useState<{ type: string; name?: string } | null>(null)
  const [documentAlerts, setDocumentAlerts] = useState<AlertRecord[]>([])

  const actualizarAlertas = useCallback(
    (docs: DocumentUpload[]) => {
      const alerts = syncDocumentAlerts({
        module: "monitoreo-operaciones",
        documents: docs.map((doc) => ({
          id: doc.id,
          name: doc.name,
          dueDate: doc.expiryDate ?? null,
        })),
      })
      setDocumentAlerts(
        alerts.filter(
          (alert) =>
            alert.module === "monitoreo-operaciones" &&
            alert.category === "document-expiry" &&
            alert.status === "open",
        ),
      )
    },
    [],
  )

  // Cargar datos del localStorage
  useEffect(() => {
    const savedData = localStorage.getItem("monitoreo-operaciones-data")
    if (savedData) {
      try {
        const data: Partial<MonitoreoStorageData> = JSON.parse(savedData)
        if (data.preguntas) {
          setPreguntasState(
            data.preguntas.map((pregunta) => ({
              ...pregunta,
              lastUpdated: pregunta.lastUpdated ? new Date(pregunta.lastUpdated) : undefined,
            })),
          )
        }
        if (data.documentos) {
          setDocumentos(
            data.documentos.map((doc) => ({
              ...doc,
              uploadDate: new Date(doc.uploadDate),
              expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : undefined,
            })),
          )
        }
        if (data.trazabilidad) {
          setTrazabilidad(
            data.trazabilidad.map((entry) => ({
              ...entry,
              timestamp: new Date(entry.timestamp),
            })),
          )
        }
        if (data.operaciones) {
          setOperaciones(
            data.operaciones.map((op) => ({
              ...op,
              createdAt: new Date(op.createdAt),
            })),
          )
        }
      } catch (error) {
        console.error("Error al cargar datos:", error)
      }
    }
  }, [])

  // Calcular progreso
  useEffect(() => {
    const totalPreguntas = preguntasState.length
    const preguntasRespondidas = preguntasState.filter((p) => p.answer !== null).length
    const nuevoProgreso = Math.round((preguntasRespondidas / totalPreguntas) * 100)
    setProgreso(nuevoProgreso)
  }, [preguntasState])

  useEffect(() => {
    actualizarAlertas(documentos)
  }, [documentos, actualizarAlertas])

  // Guardar datos en localStorage
  const guardarDatos = (override?: Partial<MonitoreoStorageData>) => {
    const data: MonitoreoStorageData = {
      preguntas: override?.preguntas ?? preguntasState,
      documentos: override?.documentos ?? documentos,
      trazabilidad: override?.trazabilidad ?? trazabilidad,
      operaciones: override?.operaciones ?? operaciones,
    }
    localStorage.setItem("monitoreo-operaciones-data", JSON.stringify(data))
  }

  const registrarAccion = (action: string, section: string, details: string) => {
    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action,
      user: "Usuario actual",
      timestamp: new Date(),
      details,
      section,
    }
    const updatedTrazabilidad = [nuevaEntrada, ...trazabilidad]
    setTrazabilidad(updatedTrazabilidad)
    guardarDatos({ trazabilidad: updatedTrazabilidad })
    return nuevaEntrada
  }

  // Actualizar respuesta de pregunta
  const actualizarRespuesta = (id: string, answer: "si" | "no" | "no-aplica", notes?: string) => {
    const updatedPreguntas = preguntasState.map((pregunta) =>
      pregunta.id === id ? { ...pregunta, answer, notes, lastUpdated: new Date() } : pregunta,
    )

    const preguntaSeleccionada = preguntasState.find((p) => p.id === id)
    setPreguntasState(updatedPreguntas)
    guardarDatos({ preguntas: updatedPreguntas })

    registrarAccion(
      "Respuesta actualizada",
      "Preguntas Normativas",
      `Pregunta: ${preguntaSeleccionada?.question.substring(0, 70) ?? ""} - Respuesta: ${answer}`,
    )

    toast({
      title: "Respuesta guardada",
      description: "La respuesta ha sido registrada correctamente.",
    })
  }

  const solicitarCargaDocumento = (tipo: string, nombrePersonalizado?: string) => {
    setPendingUpload({ type: tipo, name: nombrePersonalizado })
    fileInputRef.current?.click()
  }

  const manejarArchivoSeleccionado = async (event: ChangeEvent<HTMLInputElement>) => {
    const archivo = event.target.files?.[0]
    if (!archivo || !pendingUpload) {
      setPendingUpload(null)
      event.target.value = ""
      return
    }

    try {
      const vencimiento = new Date()
      vencimiento.setFullYear(vencimiento.getFullYear() + 1)

      const registroArchivo = await persistFile(archivo, {
        module: "monitoreo-operaciones",
        tags: [pendingUpload.type],
        expiresAt: vencimiento,
      })

      const nuevoDocumento: DocumentUpload = {
        id: registroArchivo.id,
        name: pendingUpload.name ?? archivo.name,
        type: pendingUpload.type,
        uploadDate: new Date(registroArchivo.uploadedAt),
        expiryDate: vencimiento,
        status: "vigente",
        fileId: registroArchivo.id,
        fileName: registroArchivo.name,
        fileSize: registroArchivo.size,
        fileType: registroArchivo.type,
      }

      const updatedDocumentos = [...documentos, nuevoDocumento]
      setDocumentos(updatedDocumentos)
      guardarDatos({ documentos: updatedDocumentos })

      registrarAccion(
        "Documento cargado",
        "Carga Documental",
        `Documento: ${nuevoDocumento.name} (${archivo.name}) - Tipo: ${pendingUpload.type}`,
      )

      toast({
        title: "Documento cargado",
        description: `El documento ${nuevoDocumento.name} ha sido almacenado correctamente.`,
      })
    } catch (error) {
      console.error("Error al guardar documento", error)
      toast({
        title: "Error al guardar",
        description: "No se pudo almacenar el documento seleccionado. Intenta nuevamente.",
        variant: "destructive",
      })
    } finally {
      setPendingUpload(null)
      event.target.value = ""
    }
  }

  const manejarVisualizacionDocumento = async (documento: DocumentUpload) => {
    const registro = getStoredFile(documento.fileId)
    if (!registro) {
      toast({
        title: "Archivo no disponible",
        description: "No encontramos el archivo en el almacenamiento local.",
        variant: "destructive",
      })
      return
    }

    try {
      await openStoredFile(registro)
      registrarAccion("Documento visualizado", "Carga Documental", `Documento: ${documento.name}`)
    } catch (error) {
      console.error("Error al abrir documento", error)
      toast({
        title: "No se pudo abrir",
        description: "Ocurrió un error al intentar abrir el archivo.",
        variant: "destructive",
      })
    }
  }

  const manejarDescargaDocumento = (documento: DocumentUpload) => {
    const registro = getStoredFile(documento.fileId)
    if (!registro) {
      toast({
        title: "Archivo no disponible",
        description: "No encontramos el archivo en el almacenamiento local.",
        variant: "destructive",
      })
      return
    }

    downloadStoredFile(registro)
    registrarAccion("Documento descargado", "Carga Documental", `Documento: ${documento.name}`)
  }

  const manejarResolucionAlerta = (alerta: AlertRecord) => {
    resolveAlert(alerta.id)
    actualizarAlertas(documentos)
    registrarAccion("Alerta gestionada", "Alertas documentales", `Alerta atendida: ${alerta.title}`)
    toast({
      title: "Alerta actualizada",
      description: "Se marcó la alerta como atendida.",
    })
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

  const obtenerUmbral = (tipo: OperationRecord["clientType"]) =>
    tipo === "persona-fisica" ? 8025 : 16050

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" }).format(value)

  const toggleEvidence = (id: string) => {
    setFormOperacion((prev) => {
      const existe = prev.evidences.includes(id)
      const evidences = existe ? prev.evidences.filter((item) => item !== id) : [...prev.evidences, id]
      return { ...prev, evidences }
    })
  }

  const actualizarFormulario = (
    field: keyof typeof formOperacion,
    value: string | boolean | OperationRecord["classification"] | OperationRecord["clientType"],
  ) => {
    setFormOperacion((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "classification" ? { evidences: [] } : {}),
    }))
  }

  const registrarOperacion = () => {
    const monto = Number(formOperacion.amount)
    if (!formOperacion.clientName || !formOperacion.semester || Number.isNaN(monto) || monto <= 0) {
      toast({
        title: "Datos incompletos",
        description: "Completa la información de la operación antes de registrarla.",
        variant: "destructive",
      })
      return
    }

    const nuevaOperacion: OperationRecord = {
      id: Date.now().toString(),
      clientName: formOperacion.clientName,
      clientType: formOperacion.clientType,
      semester: formOperacion.semester,
      amount: monto,
      classification: formOperacion.classification,
      evidences: formOperacion.evidences,
      profileAligned: formOperacion.profileAligned,
      registeredBy: "Usuario actual",
      createdAt: new Date(),
    }

    const updatedOperaciones = [nuevaOperacion, ...operaciones]
    setOperaciones(updatedOperaciones)
    guardarDatos({ operaciones: updatedOperaciones })

    registrarAccion(
      "Operación registrada",
      "Automatización Semestral",
      `Cliente: ${nuevaOperacion.clientName} • ${formatCurrency(nuevaOperacion.amount)} • ${nuevaOperacion.semester}`,
    )

    toast({
      title: "Operación acumulada",
      description: "La operación se integró al cálculo semestral y a la bitácora.",
    })

    setFormOperacion({ ...initialFormState, clientType: formOperacion.clientType, classification: formOperacion.classification })
  }

  const operacionesAgrupadas = useMemo(() => {
    const mapa = new Map<
      string,
      {
        clientName: string
        clientType: OperationRecord["clientType"]
        semester: string
        total: number
        operaciones: OperationRecord[]
      }
    >()

    operaciones.forEach((operacion) => {
      const key = `${operacion.clientName}-${operacion.clientType}-${operacion.semester}`
      if (!mapa.has(key)) {
        mapa.set(key, {
          clientName: operacion.clientName,
          clientType: operacion.clientType,
          semester: operacion.semester,
          total: 0,
          operaciones: [],
        })
      }
      const registro = mapa.get(key)!
      registro.total += operacion.amount
      registro.operaciones.push(operacion)
    })

    return Array.from(mapa.values()).map((registro) => {
      const umbral = obtenerUmbral(registro.clientType)
      return {
        ...registro,
        umbral,
        porcentaje: Math.min(100, Math.round((registro.total / umbral) * 100)),
        excede: registro.total >= umbral,
        alerta80: registro.total >= umbral * 0.8,
      }
    })
  }, [operaciones])

  const operacionesInusuales = useMemo(
    () => operaciones.filter((operacion) => operacion.classification === "inusual"),
    [operaciones],
  )

  const operacionesInternas = useMemo(
    () => operaciones.filter((operacion) => operacion.classification === "interna-preocupante"),
    [operaciones],
  )

  const operacionesPerfilDesalineado = useMemo(
    () => operaciones.filter((operacion) => !operacion.profileAligned),
    [operaciones],
  )

  const posiblesFraccionamientos = useMemo(() => {
    return operacionesAgrupadas.filter((grupo) => {
      if (grupo.operaciones.length < 2) return false
      const umbral = grupo.umbral
      const total = grupo.total
      const todasMenoresAlUmbral = grupo.operaciones.every((operacion) => operacion.amount < umbral)
      const sumaCercanaAlUmbral = total >= umbral * 0.9
      return todasMenoresAlUmbral && sumaCercanaAlUmbral
    })
  }, [operacionesAgrupadas])

  const documentosPorTipo = useMemo(() => {
    const mapa = new Map<string, DocumentUpload[]>()
    documentos.forEach((doc) => {
      const lista = mapa.get(doc.type) ?? []
      mapa.set(doc.type, [...lista, doc])
    })
    return mapa
  }, [documentos])

  const evidenciaDisponible = (id: string) => documentosPorTipo.has(id)

  const ejecutarScreening = () => {
    const ahora = new Date()
    setUltimoScreening(ahora)
    registrarAccion("Screening ejecutado", "Validación de Listas", "Se actualizó el screening en listas restrictivas.")
    toast({
      title: "Screening completado",
      description: "Se actualizó la verificación en listas restrictivas.",
    })
  }

  const sincronizarConKyc = () => {
    const ahora = new Date()
    setUltimaSincronizacionKyc(ahora)
    registrarAccion(
      "Cruce con KYC",
      "Integraciones",
      "Se sincronizó el perfil transaccional contra el expediente KYC.",
    )
    toast({
      title: "Cruce KYC exitoso",
      description: "Se actualizó la información del expediente del cliente.",
    })
  }

  const enviarAvisoUif = () => {
    const ahora = new Date()
    setUltimoEnvioUif(ahora)
    registrarAccion(
      "Aviso UIF preparado",
      "Reportes Regulatorios",
      "Se preparó la información acumulada para el módulo de reportes UIF.",
    )
    toast({
      title: "Aviso listo",
      description: "La información fue enviada al módulo de reportes UIF.",
    })
  }

  const exportarReporte = (tipo: "PDF" | "Excel") => {
    const tipoEnMayusculas = tipo.toUpperCase()
    registrarAccion(
      `Exportación ${tipo}`,
      "Auditoría",
      `Se generó un reporte ${tipoEnMayusculas} con las operaciones monitoreadas.`,
    )
    toast({
      title: `Reporte ${tipo} generado`,
      description: "Disponible para descarga y conservación digital.",
    })
  }

  const semestresDisponibles = [
    "1er semestre 2024",
    "2º semestre 2024",
    "1er semestre 2025",
    "2º semestre 2025",
  ]

  const evidenciasClasificacionActuales = evidenciasClasificacion[formOperacion.classification]

  const totalOperaciones = operaciones.length

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Activity className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Monitoreo y Acumulación de Operaciones</h1>
            <p className="text-muted-foreground">
              Vigila en tiempo real y de manera acumulada las operaciones de los clientes para identificar actos sujetos a
              identificación, integración o aviso conforme a la LFPIORPI y las RCG.
            </p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-medium">Progreso del Módulo</h3>
                <p className="text-sm text-muted-foreground">
                  {preguntasState.filter((p) => p.answer !== null).length} de {preguntasState.length} preguntas respondidas
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Descripción general del módulo
            </CardTitle>
            <CardDescription>
              El módulo consolida operaciones por semestre (art. 19 RCG) y clasifica alertas relevantes, inusuales e
              internas preocupantes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <p>
                  El objetivo es sumar operaciones por cliente dentro del semestre calendario y generar avisos automáticos
                  cuando se superen los umbrales legales para identificación o reporte.
                </p>
                <div>
                  <h4 className="text-sm font-semibold mb-2">Clasificaciones supervisadas</h4>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    <li>Operaciones relevantes que superan los umbrales específicos.</li>
                    <li>Operaciones inusuales que se apartan del perfil transaccional del cliente.</li>
                    <li>Operaciones internas preocupantes autorizadas o toleradas por personal interno.</li>
                  </ul>
                </div>
              </div>
              <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="font-medium">Umbrales semestrales</span>
                </div>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  <li>Personas físicas: {formatCurrency(8025)}.</li>
                  <li>Personas morales: {formatCurrency(16050)}.</li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  Los registros alimentan al módulo de Reportes UIF y a la gobernanza de cumplimiento para garantizar la
                  conservación digital mínima de 5 años.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
        onChange={manejarArchivoSeleccionado}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="preguntas" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Checklist normativo
          </TabsTrigger>
          <TabsTrigger value="acumulacion" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Automatización semestral
          </TabsTrigger>
          <TabsTrigger value="documentos" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Evidencias y archivos
          </TabsTrigger>
          <TabsTrigger value="alertas" className="flex items-center gap-2">
            <BellRing className="h-4 w-4" />
            Alertas e integraciones
          </TabsTrigger>
          <TabsTrigger value="trazabilidad" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Bitácora
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preguntas" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Preguntas de control reforzadas
              </CardTitle>
              <CardDescription>
                Verifica que la plataforma documente la acumulación semestral, la detección de operaciones inusuales y la
                verificación contra listas restrictivas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {preguntasState.map((pregunta, index) => (
                <motion.div
                  key={pregunta.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="space-y-4 rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <Label className="text-sm font-medium">
                        {index + 1}. {pregunta.question}
                        {pregunta.required && <span className="ml-1 text-red-500">*</span>}
                      </Label>
                    </div>
                    {pregunta.lastUpdated && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="mr-1 h-3 w-3" />
                        {pregunta.lastUpdated.toLocaleDateString()}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {["si", "no", "no-aplica"].map((option) => (
                      <Button
                        key={option}
                        variant={pregunta.answer === option ? "default" : "outline"}
                        size="sm"
                        onClick={() => actualizarRespuesta(pregunta.id, option as any)}
                        className={pregunta.answer === option ? getAnswerColor(option as any) : ""}
                      >
                        {option === "si" ? "Sí" : option === "no" ? "No" : "No aplica"}
                      </Button>
                    ))}
                  </div>

                  {pregunta.answer && (
                    <div className="space-y-2">
                      <Label htmlFor={`notes-${pregunta.id}`} className="text-sm">
                        Evidencia o justificación (opcional)
                      </Label>
                      <Textarea
                        id={`notes-${pregunta.id}`}
                        placeholder="Describe hallazgos, criterios aplicados o referencias documentales."
                        value={pregunta.notes || ""}
                        onChange={(e) => {
                          const updated = preguntasState.map((p) =>
                            p.id === pregunta.id ? { ...p, notes: e.target.value } : p,
                          )
                          setPreguntasState(updated)
                          guardarDatos({ preguntas: updated })
                        }}
                        className="min-h-[80px]"
                      />
                    </div>
                  )}
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="acumulacion" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Motor de acumulación semestral
                </CardTitle>
                <CardDescription>
                  Registra operaciones para sumar automáticamente los montos por cliente y semestre, con alertas por
                  umbral.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    registrarOperacion()
                  }}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="cliente">Cliente</Label>
                      <Input
                        id="cliente"
                        placeholder="Nombre o razón social"
                        value={formOperacion.clientName}
                        onChange={(e) => actualizarFormulario("clientName", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de cliente</Label>
                      <Select
                        value={formOperacion.clientType}
                        onValueChange={(value: OperationRecord["clientType"]) =>
                          actualizarFormulario("clientType", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="persona-fisica">Persona física</SelectItem>
                          <SelectItem value="persona-moral">Persona moral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Semestre calendario</Label>
                      <Select
                        value={formOperacion.semester}
                        onValueChange={(value) => actualizarFormulario("semester", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona semestre" />
                        </SelectTrigger>
                        <SelectContent>
                          {semestresDisponibles.map((semestre) => (
                            <SelectItem key={semestre} value={semestre}>
                              {semestre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="monto">Monto de la operación</Label>
                      <Input
                        id="monto"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={formOperacion.amount}
                        onChange={(e) => actualizarFormulario("amount", e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Clasificación</Label>
                      <Select
                        value={formOperacion.classification}
                        onValueChange={(value: OperationRecord["classification"]) =>
                          actualizarFormulario("classification", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Clasificación" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="relevante">Operación relevante</SelectItem>
                          <SelectItem value="inusual">Operación inusual</SelectItem>
                          <SelectItem value="interna-preocupante">Operación interna preocupante</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Validación contra perfil KYC</Label>
                      <div className="flex items-center gap-2 rounded-md border p-3">
                        <Checkbox
                          id="perfil"
                          checked={formOperacion.profileAligned}
                          onCheckedChange={(checked) =>
                            actualizarFormulario("profileAligned", Boolean(checked))
                          }
                        />
                        <Label htmlFor="perfil" className="text-sm">
                          La operación corresponde al perfil económico declarado
                        </Label>
                      </div>
                    </div>
                  </div>

                  {evidenciasClasificacionActuales.length > 0 && (
                    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                      <div className="flex items-center gap-2">
                        <ListChecks className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold">Evidencias obligatorias para esta clasificación</span>
                      </div>
                      <div className="space-y-2">
                        {evidenciasClasificacionActuales.map((evidencia) => (
                          <label key={evidencia.id} className="flex items-center gap-3 text-sm">
                            <Checkbox
                              checked={formOperacion.evidences.includes(evidencia.id)}
                              onCheckedChange={() => toggleEvidence(evidencia.id)}
                            />
                            {evidencia.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Umbral aplicable: {formatCurrency(obtenerUmbral(formOperacion.clientType))}
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => setFormOperacion({ ...initialFormState })}>
                        Limpiar
                      </Button>
                      <Button type="submit">Registrar operación</Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Acumulación por cliente y semestre
                </CardTitle>
                <CardDescription>Consulta el total acumulado y las alertas de umbral.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {operacionesAgrupadas.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Aún no se registran operaciones. Integra movimientos para calcular la acumulación semestral.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {operacionesAgrupadas.map((grupo) => (
                      <div key={`${grupo.clientName}-${grupo.semester}`} className="space-y-3 rounded-lg border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">
                              {grupo.clientName} · {grupo.semester}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Tipo: {grupo.clientType === "persona-fisica" ? "Persona física" : "Persona moral"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">Total {formatCurrency(grupo.total)}</Badge>
                            <Badge variant="outline">Umbral {formatCurrency(grupo.umbral)}</Badge>
                            {grupo.excede ? (
                              <Badge className="bg-red-500 text-white hover:bg-red-500">Aviso requerido</Badge>
                            ) : grupo.alerta80 ? (
                              <Badge className="bg-amber-500 text-white hover:bg-amber-500">80% del umbral</Badge>
                            ) : (
                              <Badge variant="secondary">Dentro de umbral</Badge>
                            )}
                          </div>
                        </div>
                        <div className="grid gap-2 text-sm">
                          {grupo.operaciones.map((operacion) => (
                            <div
                              key={operacion.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 p-2"
                            >
                              <span>
                                {formatCurrency(operacion.amount)} · {operacion.classification.replace("-", " ")}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Registrada el {operacion.createdAt.toLocaleDateString()} por {operacion.registeredBy}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BellRing className="h-5 w-5" />
                Alertas inteligentes
              </CardTitle>
              <CardDescription>Resumen de banderas por inusualidad, fraccionamiento e incidencias internas.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Operaciones inusuales</span>
                    <Badge variant={operacionesInusuales.length > 0 ? "destructive" : "secondary"}>
                      {operacionesInusuales.length}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Comparadas contra el perfil KYC y dictámenes de cumplimiento.
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Posible fraccionamiento</span>
                    <Badge variant={posiblesFraccionamientos.length > 0 ? "destructive" : "secondary"}>
                      {posiblesFraccionamientos.length}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Detecta múltiples operaciones inferiores al umbral en el mismo semestre.
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Internas preocupantes</span>
                    <Badge variant={operacionesInternas.length > 0 ? "destructive" : "secondary"}>
                      {operacionesInternas.length}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Seguimiento a personal interno involucrado en operaciones irregulares.
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Fuera de perfil declarado</span>
                    <Badge variant={operacionesPerfilDesalineado.length > 0 ? "destructive" : "secondary"}>
                      {operacionesPerfilDesalineado.length}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Operaciones marcadas como no alineadas al perfil económico del cliente.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documentos" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5" />
                  Evidencias generales obligatorias
                </CardTitle>
                <CardDescription>
                  Carga documental de contrato, comprobantes y reportes semestrales vinculados a la operación.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasGenerales.map((evidencia) => (
                  <div key={evidencia.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <Checkbox checked={evidenciaDisponible(evidencia.id)} disabled />
                      <span className="text-sm">{evidencia.label}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => solicitarCargaDocumento(evidencia.id, `${evidencia.id}.pdf`)}
                    >
                      <Upload className="mr-1 h-3 w-3" />
                      Cargar
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Evidencias específicas por clasificación
                </CardTitle>
                <CardDescription>
                  Documentos requeridos para operaciones inusuales, fraccionamiento, internas y validación en listas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="space-y-2">
                  <h4 className="font-semibold">Operaciones inusuales</h4>
                  {evidenciasClasificacion.inusual.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded border p-2">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={evidenciaDisponible(item.id)} disabled />
                        <span>{item.label}</span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => solicitarCargaDocumento(item.id)}>
                        <Upload className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Fraccionamiento</h4>
                  {evidenciasFraccionamiento.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded border p-2">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={evidenciaDisponible(item.id)} disabled />
                        <span>{item.label}</span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => solicitarCargaDocumento(item.id)}>
                        <Upload className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Operaciones internas preocupantes</h4>
                  {evidenciasClasificacion["interna-preocupante"].map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded border p-2">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={evidenciaDisponible(item.id)} disabled />
                        <span>{item.label}</span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => solicitarCargaDocumento(item.id)}>
                        <Upload className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Validación en listas</h4>
                  {evidenciasClasificacion["validacion-listas"].map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded border p-2">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={evidenciaDisponible(item.id)} disabled />
                        <span>{item.label}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => solicitarCargaDocumento(item.id)}>
                          <Upload className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={ejecutarScreening}>
                          <Search className="mr-1 h-3 w-3" />
                          Screening
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documentos cargados
              </CardTitle>
              <CardDescription>Repositorio centralizado con estado de vigencia y trazabilidad.</CardDescription>
            </CardHeader>
            <CardContent>
              {documentos.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Aún no se han cargado documentos. Adjunta los soportes requeridos para cada operación monitoreada.
                </div>
              ) : (
                <div className="space-y-3">
                  {documentos.map((doc) => (
                    <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{doc.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Subido: {doc.uploadDate.toLocaleDateString()}
                            {doc.expiryDate && ` • Vence: ${doc.expiryDate.toLocaleDateString()}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
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
                        <Button size="sm" variant="ghost" onClick={() => manejarVisualizacionDocumento(doc)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => manejarDescargaDocumento(doc)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alertas" className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Alertas documentales
          </CardTitle>
          <CardDescription>Vigencia y renovaciones pendientes de los soportes cargados.</CardDescription>
        </CardHeader>
        <CardContent>
          {documentAlerts.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-green-500" />
              Todos los documentos están vigentes.
            </div>
          ) : (
            <div className="space-y-4">
              {documentAlerts.map((alerta) => (
                <div key={alerta.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <div>
                      <div className="font-medium">{alerta.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {alerta.dueDate
                          ? `Vence el ${new Date(alerta.dueDate).toLocaleDateString()}`
                          : alerta.description}
                      </div>
                      <div className="text-xs text-muted-foreground">{alerta.description}</div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => manejarResolucionAlerta(alerta)}>
                    Marcar como atendida
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
                <Link2 className="h-5 w-5" />
                Integración con otros módulos
              </CardTitle>
              <CardDescription>Sincroniza información con KYC, Reportes UIF y screening en listas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <div className="font-medium">Cruce con expediente KYC</div>
                  <div className="text-xs text-muted-foreground">
                    {ultimaSincronizacionKyc
                      ? `Última sincronización: ${ultimaSincronizacionKyc.toLocaleString()}`
                      : "Pendiente de sincronización"}
                  </div>
                </div>
                <Button size="sm" onClick={sincronizarConKyc}>
                  <UserCheck className="mr-1 h-4 w-4" />
                  Ejecutar cruce
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <div className="font-medium">Preparación de aviso UIF</div>
                  <div className="text-xs text-muted-foreground">
                    {ultimoEnvioUif
                      ? `Última preparación: ${ultimoEnvioUif.toLocaleString()}`
                      : "Pendiente de preparación"}
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={enviarAvisoUif}>
                  <Target className="mr-1 h-4 w-4" />
                  Enviar al módulo UIF
                </Button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <div className="font-medium">Screening en listas restrictivas</div>
                  <div className="text-xs text-muted-foreground">
                    {ultimoScreening
                      ? `Última validación: ${ultimoScreening.toLocaleString()}`
                      : "Sin validaciones registradas"}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={ejecutarScreening}>
                  <Search className="mr-1 h-4 w-4" />
                  Ejecutar screening
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5" />
                Auditoría y conservación
              </CardTitle>
              <CardDescription>Reportes exportables y registro cronológico de al menos 5 años.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span>Operaciones registradas</span>
                  <Badge variant="outline">{totalOperaciones}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Cada registro conserva usuario, fecha y clasificación para auditorías internas y visitas de verificación.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => exportarReporte("PDF")}>Exportar PDF</Button>
                <Button variant="outline" onClick={() => exportarReporte("Excel")}>Exportar Excel</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trazabilidad" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Bitácora de trazabilidad
              </CardTitle>
              <CardDescription>
                Seguimiento cronológico de respuestas, cargas documentales y registros automáticos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {trazabilidad.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Aún no hay acciones registradas. Cada operación o documento quedará trazado aquí.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {trazabilidad.map((entry) => (
                      <div key={entry.id} className="flex items-start gap-4 rounded-lg border p-4">
                        <div className="rounded-full bg-primary/10 p-2">
                          <Clock className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{entry.action}</span>
                            <Badge variant="outline">{entry.section}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{entry.details}</p>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span>Usuario: {entry.user}</span>
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
    </div>
  )
}
