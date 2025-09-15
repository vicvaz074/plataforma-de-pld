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
  Shield,
  History,
  AlertCircle,
  Info,
  Download,
  Eye,
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

// Preguntas generales iniciales
const preguntasGenerales: ChecklistItem[] = [
  {
    id: "pg-1",
    question: "¿Cuál es la naturaleza de la operación? (seleccionar fracción del art. 17)",
    answer: null,
    required: true,
  },
  {
    id: "pg-2",
    question:
      "¿El monto de la operación es igual o superior al umbral de identificación publicado por el SAT para esa actividad?",
    answer: null,
    required: true,
  },
  {
    id: "pg-3",
    question: "¿El monto de la operación es igual o superior al umbral de aviso aplicable?",
    answer: null,
    required: true,
  },
  {
    id: "pg-4",
    question: "¿La operación se realiza en efectivo, transferencia, cheque o combinación?",
    answer: null,
    required: true,
  },
  {
    id: "pg-5",
    question: "¿Existen operaciones acumuladas con el mismo cliente en el semestre que superen los umbrales?",
    answer: null,
    required: true,
  },
  {
    id: "pg-6",
    question:
      "¿Existen exenciones conforme al art. 27 Bis RCG (ej. operaciones entre empresas del mismo grupo empresarial, primera venta con banca de desarrollo, etc.)?",
    answer: null,
    required: true,
  },
]

// Evidencias requeridas
const evidenciasGenerales = [
  "Identificación oficial del cliente",
  "Comprobante de domicilio",
  "RFC del cliente",
  "Documentación que acredite la operación",
  "Registro de la operación en sistema",
]

const evidenciasEspecificas = [
  "Contrato o documento que ampare la operación",
  "Comprobantes de pago",
  "Documentación adicional según tipo de actividad",
  "Registro fotográfico si aplica",
  "Documentos de terceros involucrados",
]

const evidenciasConservacion = [
  "Respaldo digital de documentos",
  "Sistema de archivo organizado",
  "Registro de accesos y consultas",
  "Procedimiento de conservación documentado",
  "Plan de respaldo y recuperación",
]

export default function ActividadesVulnerablesPage() {
  const { toast } = useToast()
  const [preguntasState, setPreguntasState] = useState<ChecklistItem[]>(preguntasGenerales)
  const [documentos, setDocumentos] = useState<DocumentUpload[]>([])
  const [trazabilidad, setTrazabilidad] = useState<TraceabilityEntry[]>([])
  const [progreso, setProgreso] = useState(0)
  const [activeTab, setActiveTab] = useState("preguntas")

  // Cargar datos del localStorage
  useEffect(() => {
    const savedData = localStorage.getItem("actividades-vulnerables-data")
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
    localStorage.setItem("actividades-vulnerables-data", JSON.stringify(data))
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
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Identificación de Actividades Vulnerables y Umbrales SAT
            </h1>
            <p className="text-muted-foreground">
              Módulo para determinar si la operación constituye una Actividad Vulnerable y los avisos requeridos
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
                <Info className="h-5 w-5" />
                Preguntas Generales Iniciales
              </CardTitle>
              <CardDescription>
                Responde las siguientes preguntas para determinar si la operación constituye una Actividad Vulnerable
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Evidencias Generales */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Evidencias Generales</CardTitle>
                <CardDescription>Documentos requeridos para toda actividad vulnerable</CardDescription>
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

            {/* Evidencias Específicas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Evidencias Específicas</CardTitle>
                <CardDescription>Documentos específicos por tipo de actividad</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasEspecificas.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" onClick={() => cargarDocumento(evidencia)}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Conservación y Trazabilidad */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Conservación y Trazabilidad</CardTitle>
                <CardDescription>Documentos de conservación y control</CardDescription>
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
      </Tabs>
    </div>
  )
}
