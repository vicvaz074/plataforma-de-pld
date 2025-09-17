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
  Activity,
  TrendingUp,
  Shield,
  Search,
  Target,
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
  // A. Acumulación semestral (art. 19 RCG)
  {
    id: "mo-1",
    question: "¿Se cuenta con sistema automatizado para acumular operaciones semestralmente?",
    answer: null,
    required: true,
  },
  {
    id: "mo-2",
    question: "¿Se identifican automáticamente los umbrales de $8,025 USD para personas físicas?",
    answer: null,
    required: true,
  },
  {
    id: "mo-3",
    question: "¿Se identifican automáticamente los umbrales de $16,050 USD para personas morales?",
    answer: null,
    required: true,
  },
  {
    id: "mo-4",
    question: "¿Se genera alerta automática al alcanzar el 80% del umbral semestral?",
    answer: null,
    required: true,
  },
  {
    id: "mo-5",
    question: "¿Se documenta la acumulación de operaciones por cliente y período?",
    answer: null,
    required: true,
  },

  // B. Operaciones inusuales
  {
    id: "mo-6",
    question: "¿Se cuenta con criterios documentados para identificar operaciones inusuales?",
    answer: null,
    required: true,
  },
  {
    id: "mo-7",
    question: "¿Se monitorean patrones de comportamiento atípicos de los clientes?",
    answer: null,
    required: true,
  },
  {
    id: "mo-8",
    question: "¿Se evalúan operaciones inconsistentes con el perfil del cliente?",
    answer: null,
    required: true,
  },
  {
    id: "mo-9",
    question: "¿Se documenta la justificación de operaciones clasificadas como inusuales?",
    answer: null,
    required: true,
  },

  // C. Fraccionamiento
  {
    id: "mo-10",
    question: "¿Se cuenta con sistema para detectar fraccionamiento de operaciones?",
    answer: null,
    required: true,
  },
  {
    id: "mo-11",
    question: "¿Se monitorean múltiples operaciones del mismo cliente en períodos cortos?",
    answer: null,
    required: true,
  },
  {
    id: "mo-12",
    question: "¿Se identifican operaciones fraccionadas entre personas relacionadas?",
    answer: null,
    required: true,
  },
  {
    id: "mo-13",
    question: "¿Se documenta la investigación de posibles fraccionamientos detectados?",
    answer: null,
    required: true,
  },

  // D. Operaciones internas preocupantes
  {
    id: "mo-14",
    question: "¿Se monitorean operaciones realizadas por empleados y funcionarios?",
    answer: null,
    required: true,
  },
  {
    id: "mo-15",
    question: "¿Se identifican conflictos de interés en operaciones internas?",
    answer: null,
    required: true,
  },
  {
    id: "mo-16",
    question: "¿Se evalúan operaciones de personas relacionadas con la empresa?",
    answer: null,
    required: true,
  },
  {
    id: "mo-17",
    question: "¿Se documenta el análisis de operaciones internas preocupantes?",
    answer: null,
    required: true,
  },

  // E. Validación contra listas
  {
    id: "mo-18",
    question: "¿Se consultan automáticamente las listas de personas bloqueadas?",
    answer: null,
    required: true,
  },
  {
    id: "mo-19",
    question: "¿Se verifica contra listas de Personas Políticamente Expuestas (PEP)?",
    answer: null,
    required: true,
  },
  {
    id: "mo-20",
    question: "¿Se consultan listas de sanciones internacionales (OFAC, ONU, UE)?",
    answer: null,
    required: true,
  },
  {
    id: "mo-21",
    question: "¿Se documenta el resultado de todas las consultas a listas?",
    answer: null,
    required: true,
  },
  {
    id: "mo-22",
    question: "¿Se actualiza la información de listas de forma periódica?",
    answer: null,
    required: true,
  },
]

// Evidencias requeridas por categoría
const evidenciasGenerales = [
  "Manual de procedimientos de monitoreo",
  "Configuración de umbrales y parámetros",
  "Reportes de acumulación semestral",
  "Registro de alertas generadas",
  "Evidencia de seguimiento a alertas",
]

const evidenciasOperacionesInusuales = [
  "Criterios de identificación documentados",
  "Reportes de operaciones inusuales detectadas",
  "Análisis y justificación de operaciones",
  "Evidencia de investigación realizada",
  "Registro de decisiones tomadas",
]

const evidenciasFraccionamiento = [
  "Algoritmos de detección de fraccionamiento",
  "Reportes de operaciones fraccionadas",
  "Análisis de patrones detectados",
  "Investigación de casos identificados",
  "Documentación de medidas adoptadas",
]

const evidenciasOperacionesInternas = [
  "Políticas de operaciones internas",
  "Registro de operaciones de empleados",
  "Análisis de conflictos de interés",
  "Investigación de operaciones preocupantes",
  "Medidas correctivas implementadas",
]

const evidenciasValidacionListas = [
  "Configuración de listas consultadas",
  "Reportes de consultas realizadas",
  "Registro de coincidencias encontradas",
  "Análisis de falsos positivos",
  "Evidencia de actualizaciones de listas",
]

// Recomendaciones prácticas
const recomendacionesPracticas = [
  {
    titulo: "Automatización de acumulación semestral",
    descripcion:
      "Implementar sistemas que calculen automáticamente la acumulación de operaciones por cliente y generen alertas al aproximarse a los umbrales establecidos por la normativa.",
  },
  {
    titulo: "Alertas inteligentes",
    descripcion:
      "Configurar alertas basadas en inteligencia artificial que identifiquen patrones sospechosos y operaciones inusuales según el perfil de riesgo de cada cliente.",
  },
  {
    titulo: "Formulario dinámico de clasificación",
    descripcion:
      "Desarrollar formularios que se adapten según el tipo de operación detectada y permitan documentar adecuadamente el análisis y las decisiones tomadas.",
  },
  {
    titulo: "Carga documental y trazabilidad",
    descripcion:
      "Mantener registro completo de todas las operaciones monitoreadas, análisis realizados y decisiones tomadas para fines de auditoría y cumplimiento.",
  },
  {
    titulo: "Integración con otros módulos",
    descripcion:
      "Conectar el sistema de monitoreo con los módulos de KYC, beneficiario controlador y reportes para tener una visión integral del riesgo del cliente.",
  },
  {
    titulo: "Auditoría y conservación",
    descripcion:
      "Establecer procesos de auditoría interna del sistema de monitoreo y conservar toda la documentación por los períodos establecidos en la normativa.",
  },
]

export default function MonitoreoOperacionesPage() {
  const { toast } = useToast()
  const [preguntasState, setPreguntasState] = useState<ChecklistItem[]>(preguntasGenerales)
  const [documentos, setDocumentos] = useState<DocumentUpload[]>([])
  const [trazabilidad, setTrazabilidad] = useState<TraceabilityEntry[]>([])
  const [progreso, setProgreso] = useState(0)
  const [activeTab, setActiveTab] = useState("preguntas")

  // Cargar datos del localStorage
  useEffect(() => {
    const savedData = localStorage.getItem("monitoreo-operaciones-data")
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
    localStorage.setItem("monitoreo-operaciones-data", JSON.stringify(data))
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
          <Activity className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Monitoreo y Acumulación de Operaciones</h1>
            <p className="text-muted-foreground">
              Módulo para vigilar en tiempo real y de manera acumulada las operaciones de los clientes
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
                <TrendingUp className="h-5 w-5" />
                Preguntas de Control del Monitoreo de Operaciones
              </CardTitle>
              <CardDescription>
                Responde las siguientes preguntas para verificar el cumplimiento del sistema de monitoreo y acumulación
                de operaciones
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {/* A. Generales */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  A. Generales
                </CardTitle>
                <CardDescription>Documentos generales del sistema</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasGenerales.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" onClick={() => cargarDocumento(evidencia)}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* B. Operaciones inusuales */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  B. Operaciones inusuales
                </CardTitle>
                <CardDescription>Detección y análisis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasOperacionesInusuales.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" onClick={() => cargarDocumento(evidencia)}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* C. Fraccionamiento */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  C. Fraccionamiento
                </CardTitle>
                <CardDescription>Detección de operaciones fraccionadas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasFraccionamiento.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" onClick={() => cargarDocumento(evidencia)}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* D. Operaciones internas preocupantes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  D. Operaciones internas preocupantes
                </CardTitle>
                <CardDescription>Monitoreo interno</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasOperacionesInternas.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" onClick={() => cargarDocumento(evidencia)}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* E. Validación en listas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  E. Validación en listas
                </CardTitle>
                <CardDescription>Consultas a listas restrictivas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasValidacionListas.map((evidencia, index) => (
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
