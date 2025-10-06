"use client"

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
} from "lucide-react"
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

// Preguntas generales del módulo
const preguntasGenerales: ChecklistItem[] = [
  // 1. Alta en el Padrón de Actividades Vulnerables
  {
    id: "rg-1",
    question:
      "Alta en el Padrón de Actividades Vulnerables.\n¿El alta en el Portal PLD del SAT se realizó dentro del plazo legal (antes de iniciar operaciones o a más tardar dentro de los 30 días posteriores)?\n• Sí → adjuntar acuse digital de alta\n• No → explicar causa y evidenciar trámite posterior",
    answer: null,
    required: true,
  },
  {
    id: "rg-2",
    question:
      "Alta en el Padrón de Actividades Vulnerables.\n¿El trámite de alta se efectuó utilizando la e.firma (FIEL) vigente del representante legal?\n• Sí → adjuntar acuse de validación de FIEL\n• No → adjuntar evidencia de renovación o aclaración ante SAT",
    answer: null,
    required: true,
  },
  {
    id: "rg-3",
    question:
      "Alta en el Padrón de Actividades Vulnerables.\n¿Se seleccionó correctamente la fracción de Actividad Vulnerable del art. 17 LFPIORPI que corresponde a la operación?\n• Sí → adjuntar captura del portal o acuse\n• No → levantar nota de corrección y evidencia del trámite de modificación",
    answer: null,
    required: true,
  },

  // 2. Representante Encargada de Cumplimiento (REC)
  {
    id: "rg-4",
    question:
      "Representante Encargada de Cumplimiento.\n¿La empresa designó formalmente a la Representante Encargada de Cumplimiento en términos del art. 20 LFPIORPI?\n• Sí → adjuntar acuse de designación\n• No → justificar y anexar evidencia de trámite pendiente",
    answer: null,
    required: true,
  },
  {
    id: "rg-5",
    question:
      "Representante Encargada de Cumplimiento.\n¿El REC aceptó formalmente el cargo en el Portal SAT y se encuentra vigente?\n• Sí → adjuntar acuse de aceptación\n• No → adjuntar evidencia de actualización en trámite",
    answer: null,
    required: true,
  },
  {
    id: "rg-6",
    question:
      "Representante Encargada de Cumplimiento.\n¿El REC cuenta con constancia de capacitación anual emitida por institución acreditada?\n• Sí → adjuntar constancia o diploma vigente\n• No → adjuntar evidencia de programa de capacitación pendiente",
    answer: null,
    required: true,
  },
  {
    id: "rg-7",
    question:
      "Representante Encargada de Cumplimiento.\n¿Se cuenta con un respaldo documental del poder o nombramiento que faculte al REC para representar a la empresa ante SAT/UIF?\n• Sí → adjuntar copia certificada o poder notarial\n• No → generar requerimiento interno",
    answer: null,
    required: true,
  },

  // 3. Actualizaciones y Modificaciones
  {
    id: "rg-8",
    question:
      "Actualizaciones y Modificaciones.\n¿Se han realizado actualizaciones de datos (domicilio, representante, actividad) en el Portal PLD en un plazo no mayor a 30 días naturales de ocurrido el cambio?\n• Sí → adjuntar acuse de actualización\n• No → justificar y adjuntar evidencia de trámite pendiente",
    answer: null,
    required: true,
  },
  {
    id: "rg-9",
    question:
      "Actualizaciones y Modificaciones.\n¿Se encuentra actualizado el domicilio fiscal y de operación en el portal?\n• Sí → adjuntar acuse de modificación\n• No → nota de pendiente",
    answer: null,
    required: true,
  },
  {
    id: "rg-10",
    question:
      "Actualizaciones y Modificaciones.\n¿Se actualizó el registro en caso de suspensión o baja de actividades vulnerables?\n• Sí → adjuntar acuse de baja\n• No → justificar",
    answer: null,
    required: true,
  },

  // 4. Buzón Tributario y Notificaciones
  {
    id: "rg-11",
    question:
      "Buzón Tributario y Notificaciones.\n¿El Buzón Tributario de la empresa está habilitado y vinculado al registro PLD?\n• Sí → adjuntar captura de configuración\n• No → nota de cumplimiento pendiente",
    answer: null,
    required: true,
  },
  {
    id: "rg-12",
    question:
      "Buzón Tributario y Notificaciones.\n¿Se tiene un procedimiento documentado para revisar semanalmente notificaciones relacionadas con PLD?\n• Sí → adjuntar registro de revisiones\n• No → elaborar procedimiento",
    answer: null,
    required: true,
  },
  {
    id: "rg-13",
    question:
      "Buzón Tributario y Notificaciones.\n¿Se respondió en plazo (máximo 10 días hábiles) a notificaciones electrónicas del SAT relacionadas con el padrón?\n• Sí → adjuntar acuse de respuesta\n• No → adjuntar evidencia del requerimiento pendiente",
    answer: null,
    required: true,
  },

  // 5. Evidencias y Conservación
  {
    id: "rg-14",
    question:
      "Evidencias y Conservación.\n¿Se conserva en repositorio interno (físico o digital) la documentación soporte de alta y actualizaciones?\n• Sí → adjuntar listado de documentos resguardados\n• No → levantar nota de incumplimiento",
    answer: null,
    required: true,
  },
  {
    id: "rg-15",
    question:
      "Evidencias y Conservación.\n¿Se verificó que los acuses digitales SAT tengan sello digital y código de verificación?\n• Sí → adjuntar validación\n• No → registrar hallazgo",
    answer: null,
    required: true,
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

  // Cargar datos del localStorage
  useEffect(() => {
    const savedData = localStorage.getItem("registro-sat-data")
    if (savedData) {
      try {
        const data = JSON.parse(savedData)
        setPreguntasState(data.preguntas || preguntasGenerales)
        setDocumentos(data.documentos || [])
        setTrazabilidad(data.trazabilidad || [])
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

  // Guardar datos en localStorage
  const guardarDatos = () => {
    const data = {
      preguntas: preguntasState,
      documentos,
      trazabilidad,
    }
    localStorage.setItem("registro-sat-data", JSON.stringify(data))
  }

  // Actualizar respuesta de pregunta
  const actualizarRespuesta = (id: string, answer: "si" | "no" | "no-aplica", notes?: string) => {
    setPreguntasState((prev) =>
      prev.map((pregunta) => (pregunta.id === id ? { ...pregunta, answer, notes, lastUpdated: new Date() } : pregunta)),
    )

    // Agregar entrada de trazabilidad
    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: "Respuesta actualizada",
      user: "Usuario actual",
      timestamp: new Date(),
      details: `Pregunta: ${preguntasState.find((p) => p.id === id)?.question.substring(0, 50)}... - Respuesta: ${answer}`,
      section: "Preguntas Generales",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])

    guardarDatos()

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

    guardarDatos()

    toast({
      title: "Documento cargado",
      description: `El documento ${nuevoDocumento.name} ha sido cargado exitosamente.`,
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
                    {["si", "no", "no-aplica"].map((option) => (
                      <Button
                        key={option}
                        variant={pregunta.answer === option ? "default" : "outline"}
                        size="sm"
                        onClick={() => actualizarRespuesta(pregunta.id, option as any)}
                        className={pregunta.answer === option ? getAnswerColor(option as any) : ""}
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
