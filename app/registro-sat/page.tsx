"use client"

import { useState, useEffect, type ChangeEvent } from "react"
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
  Paperclip,
  X,
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

const answerOptions: { value: AnswerValue; label: string }[] = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
  { value: "no-aplica", label: "No Aplica" },
]

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
    siAction: "Adjunta el acuse digital de alta expedido por el SAT.",
    noAction:
      "Explica la causa del retraso y adjunta evidencia del trámite posterior (acuse, folio o captura del trámite).",
  },
  {
    id: "rg-2",
    section: "Alta en el Padrón de Actividades Vulnerables",
    question:
      "¿El trámite de alta se efectuó utilizando la e.firma (FIEL) vigente del representante legal?",
    answer: null,
    required: true,
    siAction: "Adjunta el acuse de validación de la e.firma vigente.",
    noAction:
      "Sube la evidencia de renovación o aclaración de la e.firma presentada ante el SAT y documenta el seguimiento.",
  },
  {
    id: "rg-3",
    section: "Alta en el Padrón de Actividades Vulnerables",
    question:
      "¿Se seleccionó correctamente la fracción de Actividad Vulnerable del art. 17 LFPIORPI que corresponde a la operación?",
    answer: null,
    required: true,
    siAction: "Carga la captura del portal o el acuse que confirme la fracción seleccionada.",
    noAction:
      "Adjunta la nota de corrección y la evidencia del trámite de modificación presentado ante el SAT.",
  },

  // 2. Representante Encargada de Cumplimiento (REC)
  {
    id: "rg-4",
    section: "Representante Encargada de Cumplimiento (REC)",
    question:
      "¿La empresa designó formalmente a la Representante Encargada de Cumplimiento en términos del art. 20 LFPIORPI?",
    answer: null,
    required: true,
    siAction: "Sube el acuse de designación emitido por el SAT.",
    noAction:
      "Describe la situación y adjunta evidencia del trámite pendiente de designación.",
  },
  {
    id: "rg-5",
    section: "Representante Encargada de Cumplimiento (REC)",
    question: "¿El REC aceptó formalmente el cargo en el Portal SAT y se encuentra vigente?",
    answer: null,
    required: true,
    siAction: "Adjunta el acuse de aceptación del REC vigente.",
    noAction: "Proporciona evidencia del trámite de actualización del REC que se encuentra en curso.",
  },
  {
    id: "rg-6",
    section: "Representante Encargada de Cumplimiento (REC)",
    question:
      "¿El REC cuenta con constancia de capacitación anual emitida por institución acreditada?",
    answer: null,
    required: true,
    siAction: "Carga la constancia o diploma vigente de capacitación del REC.",
    noAction: "Adjunta el programa de capacitación pendiente o evidencia del curso programado.",
  },
  {
    id: "rg-7",
    section: "Representante Encargada de Cumplimiento (REC)",
    question:
      "¿Se cuenta con un respaldo documental del poder o nombramiento que faculte al REC para representar a la empresa ante SAT/UIF?",
    answer: null,
    required: true,
    siAction: "Sube la copia certificada o poder notarial que faculta al REC.",
    noAction:
      "Adjunta la evidencia del trámite para obtener el poder o nombramiento actualizado del REC.",
  },

  // 3. Actualizaciones y Modificaciones
  {
    id: "rg-8",
    section: "Actualizaciones y Modificaciones",
    question:
      "¿Se han realizado actualizaciones de datos (domicilio, representante, actividad) en el Portal PLD en un plazo no mayor a 30 días naturales de ocurrido el cambio?",
    answer: null,
    required: true,
    siAction: "Adjunta el acuse de actualización emitido por el portal PLD.",
    noAction:
      "Describe el motivo de la falta de actualización y adjunta evidencia del trámite pendiente.",
  },
  {
    id: "rg-9",
    section: "Actualizaciones y Modificaciones",
    question: "¿Se encuentra actualizado el domicilio fiscal y de operación en el portal?",
    answer: null,
    required: true,
    siAction: "Carga el acuse de modificación del domicilio registrado ante el portal PLD.",
    noAction: "Adjunta evidencia del trámite de actualización de domicilio en proceso.",
  },
  {
    id: "rg-10",
    section: "Actualizaciones y Modificaciones",
    question: "¿Se actualizó el registro en caso de suspensión o baja de actividades vulnerables?",
    answer: null,
    required: true,
    siAction: "Sube el acuse de baja emitido por el SAT.",
    noAction:
      "Explica la razón de la falta de actualización y agrega evidencia del trámite correspondiente.",
  },

  // 4. Buzón Tributario y Notificaciones
  {
    id: "rg-11",
    section: "Buzón Tributario y Notificaciones",
    question: "¿El Buzón Tributario de la empresa está habilitado y vinculado al registro PLD?",
    answer: null,
    required: true,
    siAction: "Adjunta la captura de configuración del Buzón Tributario vinculado.",
    noAction: "Describe la situación actual y agrega evidencia del seguimiento para habilitar el Buzón Tributario.",
  },
  {
    id: "rg-12",
    section: "Buzón Tributario y Notificaciones",
    question:
      "¿Se tiene un procedimiento documentado para revisar semanalmente notificaciones relacionadas con PLD?",
    answer: null,
    required: true,
    siAction: "Adjunta el registro o procedimiento que respalde la revisión semanal del Buzón Tributario.",
    noAction: "Documenta el plan para elaborar el procedimiento y agrega evidencia de su implementación.",
  },
  {
    id: "rg-13",
    section: "Buzón Tributario y Notificaciones",
    question:
      "¿Se respondió en plazo (máximo 10 días hábiles) a notificaciones electrónicas del SAT relacionadas con el padrón?",
    answer: null,
    required: true,
    siAction: "Sube el acuse de respuesta emitido dentro del plazo legal.",
    noAction:
      "Adjunta evidencia del requerimiento pendiente y describe el plan de seguimiento.",
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
      "Adjunta el listado de documentos resguardados en el repositorio interno (físico o digital).",
    noAction: "Describe el incumplimiento y agrega evidencia del plan de acciones correctivas.",
  },
  {
    id: "rg-15",
    section: "Evidencias y Conservación",
    question:
      "¿Se verificó que los acuses digitales SAT tengan sello digital y código de verificación?",
    answer: null,
    required: true,
    siAction:
      "Carga la validación del sello digital y código de verificación de los acuses SAT.",
    noAction:
      "Registra el hallazgo e incorpora evidencia del seguimiento para validar los acuses digitales.",
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
  const [evidenciasPorPregunta, setEvidenciasPorPregunta] = useState<Record<string, string[]>>({})

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

      const evidenciasGuardadas =
        data.evidenciasPorPregunta && typeof data.evidenciasPorPregunta === "object"
          ? Object.entries(data.evidenciasPorPregunta as Record<string, unknown>).reduce<Record<string, string[]>>(
              (acc, [key, value]) => {
                if (Array.isArray(value)) {
                  acc[key] = value.map((item) => String(item))
                }
                return acc
              },
              {},
            )
          : {}

      setPreguntasState(preguntasGuardadas)
      setDocumentos(documentosGuardados as DocumentUpload[])
      setTrazabilidad(trazabilidadGuardada as TraceabilityEntry[])
      setEvidenciasPorPregunta(evidenciasGuardadas)
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
      evidenciasPorPregunta,
    }
    localStorage.setItem("registro-sat-data", JSON.stringify(data))
  }, [preguntasState, documentos, trazabilidad, evidenciasPorPregunta])

  // Actualizar respuesta de pregunta
  const actualizarRespuesta = (id: string, answer: AnswerValue) => {
    const preguntaActual = preguntasState.find((p) => p.id === id)

    setPreguntasState((prev) =>
      prev.map((pregunta) => (pregunta.id === id ? { ...pregunta, answer, lastUpdated: new Date() } : pregunta)),
    )

    setEvidenciasPorPregunta((prev) => {
      if (answer !== "si") {
        if (!prev[id]) {
          return prev
        }

        const { [id]: _omit, ...rest } = prev
        return rest
      }

      return {
        ...prev,
        [id]: prev[id] ?? [],
      }
    })

    // Agregar entrada de trazabilidad
    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: "Respuesta actualizada",
      user: "Usuario actual",
      timestamp: new Date(),
      details: preguntaActual
        ? `${preguntaActual.section}: ${preguntaActual.question} - Respuesta: ${formatAnswer(answer)}`
        : `Pregunta ${id} - Respuesta: ${formatAnswer(answer)}`,
      section: preguntaActual?.section ?? "Preguntas Generales",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])

    toast({
      title: "Respuesta guardada",
      description: "La respuesta ha sido registrada correctamente.",
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
    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: "Documento cargado",
      user: "Usuario actual",
      timestamp: new Date(),
      details: `Documento: ${nuevoDocumento.name} - Tipo: ${tipo}`,
      section: "Carga Documental",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])

    toast({
      title: "Documento cargado",
      description: `El documento ${nuevoDocumento.name} ha sido cargado exitosamente.`,
    })
  }

  const obtenerRequerimientoPorRespuesta = (pregunta: ChecklistItem) => {
    switch (pregunta.answer) {
      case "si":
        return pregunta.siAction
      case "no":
        return pregunta.noAction
      case "no-aplica":
        return pregunta.noAplicaAction
      default:
        return undefined
    }
  }

  const requiereEvidencia = (pregunta: ChecklistItem) => pregunta.answer === "si"

  const manejarCargaEvidencia = (id: string, event: ChangeEvent<HTMLInputElement>) => {
    const archivos = event.target.files
    if (!archivos || archivos.length === 0) {
      return
    }

    const nombres = Array.from(archivos).map((archivo) => archivo.name)

    setEvidenciasPorPregunta((prev) => ({
      ...prev,
      [id]: [...(prev[id] ?? []), ...nombres],
    }))

    toast({
      title: "Evidencia registrada",
      description: `${nombres.length === 1 ? "Se agregó" : "Se agregaron"} ${nombres.length} archivo${
        nombres.length > 1 ? "s" : ""
      } a la pregunta seleccionada.`,
    })

    event.target.value = ""
  }

  const eliminarEvidencia = (id: string, nombreArchivo: string) => {
    setEvidenciasPorPregunta((prev) => ({
      ...prev,
      [id]: (prev[id] ?? []).filter((nombre) => nombre !== nombreArchivo),
    }))
  }

  const actualizarNotasPregunta = (id: string, notas: string) => {
    setPreguntasState((prev) =>
      prev.map((pregunta) =>
        pregunta.id === id ? { ...pregunta, notes: notas, lastUpdated: new Date() } : pregunta,
      ),
    )
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
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Gestión de evidencia y seguimiento
                    </p>
                    {pregunta.answer ? (
                      <div className="space-y-4 rounded-lg border border-dashed bg-muted/20 p-4">
                        <div className="space-y-3">
                          <Badge variant="outline" className="w-fit capitalize">
                            Respuesta: {formatAnswer(pregunta.answer)}
                          </Badge>
                          {obtenerRequerimientoPorRespuesta(pregunta) ? (
                            <div className="space-y-1">
                              <p className="text-sm font-medium">Documentación solicitada</p>
                              <p className="text-sm text-muted-foreground">
                                {obtenerRequerimientoPorRespuesta(pregunta)}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No se registraron evidencias específicas para esta respuesta.
                            </p>
                          )}
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="space-y-3">
                            <Label htmlFor={`evidencia-${pregunta.id}`}>
                              {pregunta.answer === "si" ? "Sube la evidencia obligatoria" : "Carga de evidencia"}
                            </Label>
                            <Input
                              id={`evidencia-${pregunta.id}`}
                              type="file"
                              multiple
                              onChange={(event) => manejarCargaEvidencia(pregunta.id, event)}
                              required={pregunta.answer === "si"}
                            />
                            <p
                              className={cn(
                                "text-xs",
                                pregunta.answer === "si" ? "text-destructive" : "text-muted-foreground",
                              )}
                            >
                              {pregunta.answer === "si"
                                ? "Es obligatorio adjuntar evidencia cuando la respuesta es Sí. Puedes seleccionar varios documentos."
                                : "Adjunta los archivos que respalden el cumplimiento. Puedes seleccionar varios documentos."}
                            </p>
                            {Boolean((evidenciasPorPregunta[pregunta.id] ?? []).length) && (
                              <div className="flex flex-wrap gap-2">
                                {(evidenciasPorPregunta[pregunta.id] ?? []).map((archivo) => (
                                  <div
                                    key={`${pregunta.id}-${archivo}`}
                                    className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs"
                                  >
                                    <Paperclip className="h-3.5 w-3.5" />
                                    <span className="max-w-[160px] truncate" title={archivo}>
                                      {archivo}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => eliminarEvidencia(pregunta.id, archivo)}
                                      className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                      aria-label={`Eliminar ${archivo}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="space-y-2 rounded-lg border border-dashed bg-background/80 p-3">
                                <p className="text-sm font-medium">Seguimiento automático programado</p>
                                <p className="text-sm text-muted-foreground">
                                  {obtenerRequerimientoPorRespuesta(pregunta) ??
                                    "No se registraron acciones específicas para esta respuesta."}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="space-y-3">
                            <Label htmlFor={`notas-${pregunta.id}`}>
                              {requiereEvidencia(pregunta)
                                ? "Observaciones y referencias"
                                : "Notas de seguimiento"
                              }
                            </Label>
                            <Textarea
                              id={`notas-${pregunta.id}`}
                              placeholder={
                                requiereEvidencia(pregunta)
                                  ? "Describe el contexto de la evidencia, folios, responsables o próximos pasos."
                                  : "Registra indicaciones para la plataforma o responsables asignados."
                              }
                              value={pregunta.notes ?? ""}
                              onChange={(event) => actualizarNotasPregunta(pregunta.id, event.target.value)}
                              className="min-h-[120px]"
                            />
                            <p className="text-xs text-muted-foreground">
                              {requiereEvidencia(pregunta)
                                ? "Esta información se guardará automáticamente para dar seguimiento a la acción documental."
                                : "La plataforma conservará estas notas para coordinar el flujo de acciones requerido."
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm italic text-muted-foreground">
                        Selecciona una respuesta para habilitar la gestión de evidencias y seguimiento.
                      </p>
                    )}
                  </div>
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
