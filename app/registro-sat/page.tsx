"use client"

import { ChangeEvent, useEffect, useState } from "react"
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
import { cn } from "@/lib/utils"
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  FileText,
  History,
  AlertCircle,
  Info,
  Download,
  Eye,
  UserCheck,
  Building2,
  UploadCloud,
  Trash2,
} from "lucide-react"
import { motion } from "framer-motion"

// Tipos de datos para el módulo
interface ChecklistItem {
  id: string
  section: string
  question: string
  answer: "si" | "no" | "no-aplica" | null
  required: boolean
  notes?: string
  lastUpdated?: Date
  siAction?: string
  noAction?: string
  noAplicaAction?: string
}

interface DocumentUpload {
  id: string
  name: string
  type: string
  uploadDate: Date
  expiryDate?: Date
  status: "vigente" | "por-vencer" | "vencido"
  url?: string
}

interface TraceabilityEntry {
  id: string
  action: string
  user: string
  timestamp: Date
  details: string
  section: string
}

type AnswerValue = Exclude<ChecklistItem["answer"], null>

interface EvidenceFile {
  id: string
  questionId: string
  answer: AnswerValue
  name: string
  uploadedAt: Date
}

const answerOptions: { value: AnswerValue; label: string }[] = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
  { value: "no-aplica", label: "No Aplica" },
]

const answerMetadata: Record<AnswerValue, { label: string; icon: typeof CheckCircle2; highlight: string; defaultBorder: string; iconColor: string }> = {
  si: {
    label: "Sí",
    icon: CheckCircle2,
    highlight: "border-green-500 bg-green-50",
    defaultBorder: "border-border bg-background",
    iconColor: "text-green-600",
  },
  no: {
    label: "No",
    icon: AlertTriangle,
    highlight: "border-red-500 bg-red-50",
    defaultBorder: "border-border bg-background",
    iconColor: "text-red-600",
  },
  "no-aplica": {
    label: "No Aplica",
    icon: Info,
    highlight: "border-blue-500 bg-blue-50",
    defaultBorder: "border-border bg-background",
    iconColor: "text-blue-600",
  },
}

// Preguntas generales del módulo
const preguntasGenerales: ChecklistItem[] = [
  // 1. Alta en el Padrón de Actividades Vulnerables
  {
    id: "rg-1",
    section: "Alta en el Padrón de Actividades Vulnerables",
    question:
      "¿El alta en el Portal PLD del SAT se realizó dentro del plazo legal (antes de iniciar operaciones o a más tardar dentro de los 30 días posteriores)?",
    answer: null,
    required: true,
    siAction: "La plataforma debe solicitar adjuntar el acuse digital de alta expedido por el SAT.",
    noAction:
      "La plataforma debe abrir un campo para explicar la causa del retraso y adjuntar evidencia del trámite posterior.",
  },
  {
    id: "rg-2",
    section: "Alta en el Padrón de Actividades Vulnerables",
    question:
      "¿El trámite de alta se efectuó utilizando la e.firma (FIEL) vigente del representante legal?",
    answer: null,
    required: true,
    siAction: "La plataforma debe permitir adjuntar el acuse de validación de FIEL vigente.",
    noAction:
      "La plataforma debe requerir evidencia de la renovación o aclaración de la FIEL ante el SAT y registrar el seguimiento.",
  },
  {
    id: "rg-3",
    section: "Alta en el Padrón de Actividades Vulnerables",
    question:
      "¿Se seleccionó correctamente la fracción de Actividad Vulnerable del art. 17 LFPIORPI que corresponde a la operación?",
    answer: null,
    required: true,
    siAction: "La plataforma debe solicitar la captura del portal o acuse que confirme la fracción seleccionada.",
    noAction:
      "La plataforma debe generar una nota de corrección y pedir evidencia del trámite de modificación ante el SAT.",
  },

  // 2. Representante Encargada de Cumplimiento (REC)
  {
    id: "rg-4",
    section: "Representante Encargada de Cumplimiento (REC)",
    question:
      "¿La empresa designó formalmente a la Representante Encargada de Cumplimiento en términos del art. 20 LFPIORPI?",
    answer: null,
    required: true,
    siAction: "La plataforma debe requerir el acuse de designación emitido por el SAT.",
    noAction:
      "La plataforma debe habilitar un campo para justificar y adjuntar evidencia del trámite pendiente de designación.",
  },
  {
    id: "rg-5",
    section: "Representante Encargada de Cumplimiento (REC)",
    question: "¿El REC aceptó formalmente el cargo en el Portal SAT y se encuentra vigente?",
    answer: null,
    required: true,
    siAction: "La plataforma debe permitir adjuntar el acuse de aceptación del REC.",
    noAction: "La plataforma debe solicitar evidencia de la actualización del REC en trámite.",
  },
  {
    id: "rg-6",
    section: "Representante Encargada de Cumplimiento (REC)",
    question:
      "¿El REC cuenta con constancia de capacitación anual emitida por institución acreditada?",
    answer: null,
    required: true,
    siAction: "La plataforma debe solicitar adjuntar la constancia o diploma vigente de capacitación.",
    noAction: "La plataforma debe pedir evidencia del programa de capacitación pendiente para el REC.",
  },
  {
    id: "rg-7",
    section: "Representante Encargada de Cumplimiento (REC)",
    question:
      "¿Se cuenta con un respaldo documental del poder o nombramiento que faculte al REC para representar a la empresa ante SAT/UIF?",
    answer: null,
    required: true,
    siAction: "La plataforma debe requerir adjuntar la copia certificada o poder notarial correspondiente.",
    noAction:
      "La plataforma debe generar un requerimiento interno para obtener el poder o nombramiento del REC.",
  },

  // 3. Actualizaciones y Modificaciones
  {
    id: "rg-8",
    section: "Actualizaciones y Modificaciones",
    question:
      "¿Se han realizado actualizaciones de datos (domicilio, representante, actividad) en el Portal PLD en un plazo no mayor a 30 días naturales de ocurrido el cambio?",
    answer: null,
    required: true,
    siAction: "La plataforma debe solicitar el acuse de actualización emitido por el portal PLD.",
    noAction:
      "La plataforma debe habilitar un campo de justificación y requerir evidencia del trámite de actualización pendiente.",
  },
  {
    id: "rg-9",
    section: "Actualizaciones y Modificaciones",
    question: "¿Se encuentra actualizado el domicilio fiscal y de operación en el portal?",
    answer: null,
    required: true,
    siAction: "La plataforma debe permitir adjuntar el acuse de modificación del domicilio.",
    noAction: "La plataforma debe registrar una nota de pendiente y generar recordatorio de actualización.",
  },
  {
    id: "rg-10",
    section: "Actualizaciones y Modificaciones",
    question: "¿Se actualizó el registro en caso de suspensión o baja de actividades vulnerables?",
    answer: null,
    required: true,
    siAction: "La plataforma debe solicitar el acuse de baja emitido por el SAT.",
    noAction:
      "La plataforma debe habilitar un campo para justificar la falta de actualización y adjuntar evidencia.",
  },

  // 4. Buzón Tributario y Notificaciones
  {
    id: "rg-11",
    section: "Buzón Tributario y Notificaciones",
    question: "¿El Buzón Tributario de la empresa está habilitado y vinculado al registro PLD?",
    answer: null,
    required: true,
    siAction: "La plataforma debe solicitar la captura de configuración del Buzón Tributario vinculado.",
    noAction: "La plataforma debe registrar la nota de cumplimiento pendiente y programar seguimiento.",
  },
  {
    id: "rg-12",
    section: "Buzón Tributario y Notificaciones",
    question:
      "¿Se tiene un procedimiento documentado para revisar semanalmente notificaciones relacionadas con PLD?",
    answer: null,
    required: true,
    siAction: "La plataforma debe solicitar el registro de revisiones semanales del Buzón Tributario.",
    noAction: "La plataforma debe generar la tarea de elaborar y adjuntar el procedimiento documentado.",
  },
  {
    id: "rg-13",
    section: "Buzón Tributario y Notificaciones",
    question:
      "¿Se respondió en plazo (máximo 10 días hábiles) a notificaciones electrónicas del SAT relacionadas con el padrón?",
    answer: null,
    required: true,
    siAction: "La plataforma debe pedir adjuntar el acuse de respuesta emitido dentro del plazo legal.",
    noAction:
      "La plataforma debe requerir evidencia del requerimiento pendiente y generar una alerta de seguimiento.",
  },

  // 5. Evidencias y Conservación
  {
    id: "rg-14",
    section: "Evidencias y Conservación",
    question:
      "¿Se conserva en repositorio interno (físico o digital) la documentación soporte de alta y actualizaciones?",
    answer: null,
    required: true,
    siAction:
      "La plataforma debe solicitar adjuntar el listado de documentos resguardados en el repositorio interno.",
    noAction: "La plataforma debe levantar una nota de incumplimiento y programar acciones correctivas.",
  },
  {
    id: "rg-15",
    section: "Evidencias y Conservación",
    question:
      "¿Se verificó que los acuses digitales SAT tengan sello digital y código de verificación?",
    answer: null,
    required: true,
    siAction:
      "La plataforma debe requerir adjuntar la validación del sello digital y código de verificación.",
    noAction:
      "La plataforma debe registrar un hallazgo y generar seguimiento para validar los acuses digitales.",
  },
]

// Evidencias requeridas por categoría
const evidenciasAltaPadron = [
  "Acuse digital de alta en el Portal PLD (SAT) con sello electrónico.",
  "Captura de pantalla del portal SAT donde conste la actividad vulnerable registrada.",
  "Constancia de RFC del sujeto obligado.",
  "Copia vigente de la e.firma (FIEL) utilizada para el trámite.",
  "Acta constitutiva (en caso de persona moral).",
  "Comprobante de domicilio fiscal registrado en el portal.",
]

const evidenciasREC = [
  "Acuse de designación de REC emitido por el SAT.",
  "Acuse de aceptación de REC en el Portal PLD.",
  "Identificación oficial vigente del REC.",
  "Poder notarial o documento equivalente que acredite facultades para representar a la empresa ante SAT/UIF.",
  "Constancia de capacitación anual del REC.",
]

const evidenciasActualizaciones = [
  "Acuse de actualización de datos en el Portal PLD (ej. cambio de domicilio, actividad, representante).",
  "Comprobante de baja o suspensión de actividad vulnerable, si aplica.",
  "Historial de acuses de modificaciones realizadas en el padrón.",
]

const evidenciasBuzonTributario = [
  "Captura de configuración del Buzón Tributario vinculado al registro PLD.",
  "Acuse de recepción de notificación electrónica SAT relacionada con PLD.",
  "Acuse de respuesta enviada al SAT dentro del plazo legal (10 días hábiles).",
  "Bitácora interna de revisiones periódicas del Buzón Tributario.",
]

const evidenciasConservacion = [
  "Repositorio digital interno con respaldo de todos los acuses emitidos por el SAT.",
  "Registro de fecha y hora del alta inicial.",
  "Bitácora de cambios de representante o domicilio.",
  "Control de versiones de cada trámite realizado.",
]

// Recomendaciones prácticas
const recomendacionesPracticas = [
  {
    titulo: "Automatización del alta",
    descripcion:
      "La plataforma debe incluir un submódulo guiado para el llenado del Portal PLD con checklist de RFC, FIEL, acta constitutiva y poderes, e integrar la carga obligatoria del acuse digital validando sello electrónico.",
  },
  {
    titulo: "Gestión del Representante Encargado de Cumplimiento",
    descripcion:
      "La plataforma debe habilitar un formulario específico para el REC que solicite acuse de designación, aceptación electrónica, constancia anual de capacitación y poder notarial, con alertas automáticas para renovaciones.",
  },
  {
    titulo: "Control de notificaciones electrónicas",
    descripcion:
      "La plataforma debe mostrar un tablero con alertas del Buzón Tributario, registrar acuses de lectura y respuesta dentro de 10 días hábiles y calendarizar recordatorios periódicos de revisión.",
  },
  {
    titulo: "Trazabilidad documental",
    descripcion:
      "La plataforma debe mantener una bitácora digital con fecha de alta, folio SAT, representante registrado y acuses, además de un control de versiones para cada modificación posterior.",
  },
]

export default function RegistroSATPage() {
  const { toast } = useToast()
  const [preguntasState, setPreguntasState] = useState<ChecklistItem[]>(preguntasGenerales)
  const [documentos, setDocumentos] = useState<DocumentUpload[]>([])
  const [trazabilidad, setTrazabilidad] = useState<TraceabilityEntry[]>([])
  const [progreso, setProgreso] = useState(0)
  const [activeTab, setActiveTab] = useState("preguntas")
  const [evidencias, setEvidencias] = useState<Record<string, EvidenceFile[]>>({})

  // Cargar datos del localStorage
  useEffect(() => {
    const savedData = localStorage.getItem("registro-sat-data")
    if (!savedData) return

    try {
      const data = JSON.parse(savedData)

      const storedPreguntas = Array.isArray(data.preguntas) ? data.preguntas : []
      const preguntasGuardadas = preguntasGenerales.map((preguntaBase) => {
        const stored = storedPreguntas.find((item: Partial<ChecklistItem>) => item.id === preguntaBase.id)
        if (!stored) {
          return preguntaBase
        }

        return {
          ...preguntaBase,
          answer: (stored.answer as ChecklistItem["answer"]) ?? preguntaBase.answer,
          notes: stored.notes ?? preguntaBase.notes,
          lastUpdated: stored.lastUpdated ? new Date(stored.lastUpdated) : undefined,
        }
      })

      const documentosGuardados = Array.isArray(data.documentos)
        ? data.documentos.map((doc: Partial<DocumentUpload>) => ({
            ...doc,
            id: doc.id ?? Date.now().toString(),
            name: doc.name ?? "",
            type: doc.type ?? "",
            uploadDate: doc.uploadDate ? new Date(doc.uploadDate) : new Date(),
            expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : undefined,
            status: (doc.status as DocumentUpload["status"]) ?? "vigente",
          }))
        : []

      const trazabilidadGuardada = Array.isArray(data.trazabilidad)
        ? data.trazabilidad.map((entry: Partial<TraceabilityEntry>) => ({
            id: entry.id ?? Date.now().toString(),
            action: entry.action ?? "Acción registrada",
            user: entry.user ?? "Usuario",
            timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
            details: entry.details ?? "",
            section: entry.section ?? "Preguntas Generales",
          }))
        : []

      const evidenciasGuardadas: Record<string, EvidenceFile[]> = data.evidencias
        ? Object.fromEntries(
            Object.entries(data.evidencias as Record<string, Partial<EvidenceFile>[]>)
              .filter(([, archivos]) => Array.isArray(archivos))
              .map(([questionId, archivos]) => [
                questionId,
                (archivos as Partial<EvidenceFile>[]).map((archivo) => ({
                  id: archivo.id ?? `${questionId}-${Date.now()}`,
                  questionId,
                  answer: (archivo.answer as AnswerValue) ?? "si",
                  name: archivo.name ?? "Evidencia",
                  uploadedAt: archivo.uploadedAt ? new Date(archivo.uploadedAt) : new Date(),
                })),
              ]),
          )
        : {}

      setPreguntasState(preguntasGuardadas)
      setDocumentos(documentosGuardados as DocumentUpload[])
      setTrazabilidad(trazabilidadGuardada as TraceabilityEntry[])
      setEvidencias(evidenciasGuardadas)
    } catch (error) {
      console.error("Error al cargar datos:", error)
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
    const data = {
      preguntas: preguntasState,
      documentos,
      trazabilidad,
      evidencias: Object.fromEntries(
        Object.entries(evidencias).map(([questionId, archivos]) => [
          questionId,
          archivos.map((archivo) => ({
            ...archivo,
            uploadedAt: archivo.uploadedAt.toISOString(),
          })),
        ]),
      ),
    }
    localStorage.setItem("registro-sat-data", JSON.stringify(data))
  }, [preguntasState, documentos, trazabilidad, evidencias])

  // Actualizar respuesta de pregunta
  const actualizarRespuesta = (id: string, answer: AnswerValue) => {
    const preguntaActual = preguntasState.find((p) => p.id === id)

    setPreguntasState((prev) =>
      prev.map((pregunta) => (pregunta.id === id ? { ...pregunta, answer, lastUpdated: new Date() } : pregunta)),
    )

    // Agregar entrada de trazabilidad
    registrarAccionTrazabilidad({
      action: "Respuesta actualizada",
      user: "Usuario actual",
      details: preguntaActual
        ? `${preguntaActual.section}: ${preguntaActual.question} - Respuesta: ${formatAnswer(answer)}`
        : `Pregunta ${id} - Respuesta: ${formatAnswer(answer)}`,
      section: preguntaActual?.section ?? "Preguntas Generales",
    })

    toast({
      title: "Respuesta guardada",
      description: "La respuesta ha sido registrada correctamente.",
    })
  }

  const registrarAccionTrazabilidad = (entrada: Omit<TraceabilityEntry, "id" | "timestamp"> & { timestamp?: Date }) => {
    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      timestamp: entrada.timestamp ?? new Date(),
      ...entrada,
    }

    setTrazabilidad((prev) => [nuevaEntrada, ...prev])
  }

  const handleEvidenceUpload = (
    questionId: string,
    answer: AnswerValue,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const nuevosArchivos: EvidenceFile[] = Array.from(files).map((file) => ({
      id: `${questionId}-${answer}-${Date.now()}-${file.name}`,
      questionId,
      answer,
      name: file.name,
      uploadedAt: new Date(),
    }))

    setEvidencias((prev) => {
      const existentes = prev[questionId] ?? []
      return {
        ...prev,
        [questionId]: [...existentes, ...nuevosArchivos],
      }
    })

    const pregunta = preguntasState.find((p) => p.id === questionId)
    registrarAccionTrazabilidad({
      action: "Evidencia cargada",
      user: "Usuario actual",
      details: `${pregunta?.question ?? "Pregunta"} - ${files.length} archivo(s) adjuntado(s)` ,
      section: pregunta?.section ?? "Preguntas Generales",
    })

    toast({
      title: "Evidencia cargada",
      description: files.length === 1 ? `Se adjuntó ${files[0].name}.` : `Se adjuntaron ${files.length} archivos.`,
    })

    event.target.value = ""
  }

  const handleEvidenceRemoval = (questionId: string, evidenceId: string) => {
    setEvidencias((prev) => {
      const existentes = prev[questionId] ?? []
      return {
        ...prev,
        [questionId]: existentes.filter((archivo) => archivo.id !== evidenceId),
      }
    })

    const pregunta = preguntasState.find((p) => p.id === questionId)
    registrarAccionTrazabilidad({
      action: "Evidencia eliminada",
      user: "Usuario actual",
      details: `${pregunta?.question ?? "Pregunta"} - Evidencia eliminada`,
      section: pregunta?.section ?? "Preguntas Generales",
    })

    toast({
      title: "Evidencia eliminada",
      description: "Se eliminó la evidencia seleccionada.",
    })
  }

  // Simular carga de documento
  const cargarDocumento = (tipo: string) => {
    const nuevoDocumento: DocumentUpload = {
      id: Date.now().toString(),
      name: `Documento_${tipo}_${Date.now()}.pdf`,
      type: tipo,
      uploadDate: new Date(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año
      status: "vigente",
    }

    setDocumentos((prev) => [...prev, nuevoDocumento])

    // Agregar entrada de trazabilidad
    registrarAccionTrazabilidad({
      action: "Documento cargado",
      user: "Usuario actual",
      details: `Documento: ${nuevoDocumento.name} - Tipo: ${tipo}`,
      section: "Carga Documental",
    })

    toast({
      title: "Documento cargado",
      description: `El documento ${nuevoDocumento.name} ha sido cargado exitosamente.`,
    })
  }

  const formatAnswer = (answer: ChecklistItem["answer"]) => {
    switch (answer) {
      case "si":
        return "Sí"
      case "no":
        return "No"
      case "no-aplica":
        return "No Aplica"
      default:
        return "Sin respuesta"
    }
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

  const normalizarDescripcionRequisito = (texto: string) =>
    texto.replace(/^[Ll]a plataforma debe\s*/u, "").trim()

  const obtenerRequisitosEvidencia = (pregunta: ChecklistItem) => {
    const requisitos: { answer: AnswerValue; description: string }[] = []

    if (pregunta.siAction) {
      requisitos.push({ answer: "si", description: pregunta.siAction })
    }

    if (pregunta.noAction) {
      requisitos.push({ answer: "no", description: pregunta.noAction })
    }

    if (pregunta.noAplicaAction) {
      requisitos.push({ answer: "no-aplica", description: pregunta.noAplicaAction })
    }

    return requisitos
  }

  const formatearFechaCorta = (fecha: Date) =>
    fecha.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })

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

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Registro y Alta ante el SAT</h1>
            <p className="text-muted-foreground">
              Módulo para asegurar el registro formal en el padrón de Actividades Vulnerables y designación del REC
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
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
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
          <TabsTrigger value="recomendaciones" className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Recomendaciones
          </TabsTrigger>
        </TabsList>

        {/* Tab: Preguntas Normativas */}
        <TabsContent value="preguntas" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                Preguntas Generales del Módulo
              </CardTitle>
              <CardDescription>
                Responde las siguientes preguntas para verificar el cumplimiento del registro ante el SAT
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {preguntasState.map((pregunta, index) => (
                <motion.div
                  key={pregunta.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="space-y-5 rounded-lg border bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <Badge variant="secondary" className="text-xs font-normal uppercase tracking-wide">
                        {pregunta.section}
                      </Badge>
                      <Label className="text-sm font-semibold leading-relaxed">
                        {index + 1}. {pregunta.question}
                        {pregunta.required && <span className="ml-1 text-red-500">*</span>}
                      </Label>
                    </div>
                    {pregunta.lastUpdated && (
                      <Badge variant="outline" className="flex items-center gap-1 text-xs">
                        <Clock className="h-3.5 w-3.5" />
                        {pregunta.lastUpdated.toLocaleString()}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {answerOptions.map(({ value, label }) => (
                      <Button
                        key={value}
                        variant={pregunta.answer === value ? "default" : "outline"}
                        size="sm"
                        onClick={() => actualizarRespuesta(pregunta.id, value)}
                        className={pregunta.answer === value ? getAnswerColor(value) : ""}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Evidencias requeridas</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {obtenerRequisitosEvidencia(pregunta).map((requisito) => {
                        const meta = answerMetadata[requisito.answer]
                        const Icono = meta.icon
                        const archivos = (evidencias[pregunta.id] ?? []).filter(
                          (archivo) => archivo.answer === requisito.answer,
                        )

                        return (
                          <div
                            key={`${pregunta.id}-${requisito.answer}`}
                            className={cn(
                              "flex flex-col gap-3 rounded-lg border p-3",
                              pregunta.answer === requisito.answer ? meta.highlight : meta.defaultBorder,
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <Icono
                                className={cn(
                                  "mt-0.5 h-4 w-4",
                                  pregunta.answer === requisito.answer ? meta.iconColor : "text-muted-foreground",
                                )}
                              />
                              <div className="space-y-1">
                                <p className="text-sm font-medium">Respuesta {meta.label}</p>
                                <p className="text-sm text-muted-foreground">
                                  {normalizarDescripcionRequisito(requisito.description)}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="space-y-1">
                                <Label
                                  htmlFor={`${pregunta.id}-${requisito.answer}-upload`}
                                  className="text-xs font-medium uppercase text-muted-foreground"
                                >
                                  Subir evidencia
                                </Label>
                                <Input
                                  id={`${pregunta.id}-${requisito.answer}-upload`}
                                  type="file"
                                  multiple
                                  onChange={(event) => handleEvidenceUpload(pregunta.id, requisito.answer, event)}
                                />
                              </div>

                              {archivos.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-muted-foreground">Archivos adjuntos</p>
                                  <ul className="space-y-2 text-sm">
                                    {archivos.map((archivo) => (
                                      <li
                                        key={archivo.id}
                                        className="flex items-center justify-between gap-2 rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 px-2 py-1.5"
                                      >
                                        <div className="flex items-center gap-2">
                                          <UploadCloud className="h-4 w-4 text-muted-foreground" />
                                          <div className="space-y-0.5">
                                            <p className="font-medium leading-none">{archivo.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                              Cargado el {formatearFechaCorta(archivo.uploadedAt)}
                                            </p>
                                          </div>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleEvidenceRemoval(pregunta.id, archivo.id)}
                                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          <span className="sr-only">Eliminar evidencia</span>
                                        </Button>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}

                      {obtenerRequisitosEvidencia(pregunta).length === 0 && (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          No se definieron evidencias para esta pregunta.
                        </div>
                      )}
                    </div>
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
                          const { value } = e.target
                          setPreguntasState((prev) =>
                            prev.map((p) =>
                              p.id === pregunta.id ? { ...p, notes: value, lastUpdated: new Date() } : p,
                            ),
                          )
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

        {/* Tab: Carga Documental */}
        <TabsContent value="documentos" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* A. Alta en el Padrón */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">A. Alta en el Padrón</CardTitle>
                <CardDescription>Documentos del alta en Actividades Vulnerables</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasAltaPadron.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" onClick={() => cargarDocumento(evidencia)}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* B. Designación REC */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">B. Designación REC</CardTitle>
                <CardDescription>Documentos del Representante Encargado</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasREC.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" onClick={() => cargarDocumento(evidencia)}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* C. Actualizaciones */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">C. Actualizaciones</CardTitle>
                <CardDescription>Modificaciones y actualizaciones</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasActualizaciones.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" onClick={() => cargarDocumento(evidencia)}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* D. Buzón Tributario */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">D. Buzón Tributario</CardTitle>
                <CardDescription>Notificaciones y comunicaciones</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasBuzonTributario.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" onClick={() => cargarDocumento(evidencia)}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* E. Conservación */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">E. Conservación</CardTitle>
                <CardDescription>Trazabilidad y conservación</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasConservacion.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" onClick={() => cargarDocumento(evidencia)}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
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
                          <div className="font-medium">{doc.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Subido: {doc.uploadDate.toLocaleDateString()}
                            {doc.expiryDate && ` • Vence: ${doc.expiryDate.toLocaleDateString()}`}
                          </div>
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
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Download className="h-4 w-4" />
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
        </TabsContent>

        {/* Tab: Bitácora de Trazabilidad */}
        <TabsContent value="trazabilidad" className="space-y-6">
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

        {/* Tab: Recomendaciones Prácticas */}
        <TabsContent value="recomendaciones" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {recomendacionesPracticas.map((recomendacion, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Info className="h-5 w-5 text-primary" />
                    {recomendacion.titulo}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{recomendacion.descripcion}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
