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
  Users,
  Building,
  Shield,
  Globe,
  FileCheck,
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
  // 1. Identificación del Cliente
  {
    id: "kyc-1",
    question: "¿Se cuenta con procedimientos documentados para la identificación de clientes?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-2",
    question: "¿Se verifica la identidad de todos los clientes antes de establecer la relación de negocios?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-3",
    question: "¿Se obtienen y conservan copias de documentos oficiales de identificación?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-4",
    question: "¿Se verifica la autenticidad de los documentos de identificación presentados?",
    answer: null,
    required: true,
  },

  // 2. Personas Morales
  {
    id: "kyc-5",
    question: "¿Se obtiene y verifica el acta constitutiva de las personas morales?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-6",
    question: "¿Se identifica y documenta a los representantes legales de las personas morales?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-7",
    question: "¿Se verifica que los representantes legales tengan facultades suficientes?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-8",
    question: "¿Se obtiene información sobre la estructura corporativa y accionaria?",
    answer: null,
    required: true,
  },

  // 3. Beneficiario Controlador
  {
    id: "kyc-9",
    question: "¿Se identifica al beneficiario controlador de todas las personas morales?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-10",
    question: "¿Se documenta la cadena de control hasta llegar a la persona física final?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-11",
    question: "¿Se actualiza periódicamente la información del beneficiario controlador?",
    answer: null,
    required: true,
  },

  // 4. Personas Políticamente Expuestas (PEP)
  {
    id: "kyc-12",
    question: "¿Se cuenta con procedimientos para identificar Personas Políticamente Expuestas (PEP)?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-13",
    question: "¿Se consultan listas actualizadas de PEP antes de establecer relaciones de negocios?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-14",
    question: "¿Se aplica debida diligencia reforzada para clientes identificados como PEP?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-15",
    question: "¿Se monitorea de manera continua a los clientes identificados como PEP?",
    answer: null,
    required: true,
  },

  // 5. Fideicomisos
  {
    id: "kyc-16",
    question:
      "¿Se identifica y documenta a todas las partes del fideicomiso (fideicomitente, fiduciario, fideicomisario)?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-17",
    question: "¿Se obtiene copia del contrato de fideicomiso y sus modificaciones?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-18",
    question: "¿Se verifica la identidad del beneficiario controlador del fideicomiso?",
    answer: null,
    required: true,
  },

  // 6. Actualización y Conservación
  {
    id: "kyc-19",
    question: "¿Se actualiza periódicamente la información de los expedientes de clientes?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-20",
    question: "¿Se conservan los expedientes por el plazo mínimo establecido (10 años)?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-21",
    question: "¿Se cuenta con sistemas de respaldo y recuperación de la información?",
    answer: null,
    required: true,
  },
]

// Evidencias requeridas por categoría
const evidenciasGenerales = [
  "Procedimiento de identificación de clientes",
  "Formatos de identificación y documentación",
  "Manual de debida diligencia",
  "Políticas de aceptación de clientes",
  "Registro de clientes rechazados",
]

const evidenciasPersonasFisicas = [
  "Identificación oficial vigente",
  "Comprobante de domicilio",
  "RFC o CURP",
  "Comprobante de ingresos",
  "Formato de identificación del cliente",
]

const evidenciasPersonasMorales = [
  "Acta constitutiva y modificaciones",
  "Poderes del representante legal",
  "Identificación del representante legal",
  "RFC de la persona moral",
  "Comprobante de domicilio fiscal",
  "Estados financieros",
]

const evidenciasPersonasExtranjeras = [
  "Pasaporte vigente",
  "Visa o documento migratorio",
  "Comprobante de domicilio en país de origen",
  "Número de identificación fiscal extranjero",
  "Apostilla o legalización de documentos",
]

const evidenciasFideicomisos = [
  "Contrato de fideicomiso",
  "Identificación del fideicomitente",
  "Identificación del fiduciario",
  "Identificación de fideicomisarios",
  "Poderes y facultades del fiduciario",
]

const evidenciasBeneficiarioControlador = [
  "Estructura accionaria actualizada",
  "Identificación del beneficiario controlador",
  "Cadena de control documentada",
  "Declaración de beneficiario controlador",
  "Actualizaciones periódicas",
]

const evidenciasPEP = [
  "Consulta a listas PEP",
  "Declaración de no ser PEP",
  "Debida diligencia reforzada (si aplica)",
  "Monitoreo continuo de PEP",
  "Aprobación de alta nivel para PEP",
]

const evidenciasActualizacion = [
  "Calendario de actualizaciones",
  "Registros de actualizaciones realizadas",
  "Comunicaciones con clientes",
  "Sistema de alertas de vencimientos",
  "Respaldos de información histórica",
]

// Recomendaciones prácticas
const recomendacionesPracticas = [
  {
    titulo: "Formularios dinámicos según tipo de cliente",
    descripcion:
      "Implementar formularios adaptativos que soliciten información específica según el tipo de cliente (persona física, moral, extranjera, fideicomiso).",
  },
  {
    titulo: "Carga documental obligatoria",
    descripcion:
      "Establecer campos obligatorios de carga documental que no permitan avanzar sin la documentación completa y vigente.",
  },
  {
    titulo: "Beneficiario controlador y PEP",
    descripcion:
      "Automatizar la identificación de beneficiarios controladores y consultas a listas PEP con alertas automáticas.",
  },
  {
    titulo: "Actualización periódica y alertas",
    descripcion:
      "Configurar recordatorios automáticos para actualización de expedientes según periodicidad establecida por tipo de cliente.",
  },
  {
    titulo: "Seguridad y conservación",
    descripcion:
      "Implementar medidas de seguridad robustas para proteger la información sensible y garantizar su conservación por 10 años.",
  },
  {
    titulo: "Soporte a auditorías y verificaciones",
    descripcion:
      "Mantener trazabilidad completa de todas las acciones realizadas en los expedientes para facilitar auditorías internas y externas.",
  },
]

export default function KYCExpedientePage() {
  const { toast } = useToast()
  const [preguntasState, setPreguntasState] = useState<ChecklistItem[]>(preguntasGenerales)
  const [documentos, setDocumentos] = useState<DocumentUpload[]>([])
  const [trazabilidad, setTrazabilidad] = useState<TraceabilityEntry[]>([])
  const [progreso, setProgreso] = useState(0)
  const [activeTab, setActiveTab] = useState("preguntas")

  // Cargar datos del localStorage
  useEffect(() => {
    const savedData = localStorage.getItem("kyc-expediente-data")
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
    localStorage.setItem("kyc-expediente-data", JSON.stringify(data))
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
          <UserCheck className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Identificación y Expediente Único (KYC)</h1>
            <p className="text-muted-foreground">
              Módulo para la verificación de identidad, documentación de clientes y cumplimiento de debida diligencia
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
                <FileCheck className="h-5 w-5" />
                Preguntas Generales del Módulo KYC
              </CardTitle>
              <CardDescription>
                Responde las siguientes preguntas para verificar el cumplimiento de identificación y expediente único
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {/* A. Evidencias Generales */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  A. Evidencias Generales
                </CardTitle>
                <CardDescription>Documentos aplicables a toda relación de negocios</CardDescription>
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

            {/* B. Personas Físicas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  B. Personas Físicas
                </CardTitle>
                <CardDescription>Anexo 3 RCG</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasPersonasFisicas.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" onClick={() => cargarDocumento(evidencia)}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* C. Personas Morales */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  C. Personas Morales
                </CardTitle>
                <CardDescription>Anexos 4 y 4 Bis RCG</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasPersonasMorales.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" onClick={() => cargarDocumento(evidencia)}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* D. Personas Extranjeras */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  D. Personas Extranjeras
                </CardTitle>
                <CardDescription>Anexos 5 y 6 RCG</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasPersonasExtranjeras.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" onClick={() => cargarDocumento(evidencia)}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* E. Fideicomisos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  E. Fideicomisos
                </CardTitle>
                <CardDescription>Anexo 8 RCG</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasFideicomisos.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" onClick={() => cargarDocumento(evidencia)}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* F. Beneficiario Controlador */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  F. Beneficiario Controlador
                </CardTitle>
                <CardDescription>Art. 3 y 12 RCG</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasBeneficiarioControlador.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" onClick={() => cargarDocumento(evidencia)}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* G. Personas Políticamente Expuestas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  G. Personas Políticamente Expuestas
                </CardTitle>
                <CardDescription>PEP</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasPEP.map((evidencia, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{evidencia}</span>
                    <Button size="sm" variant="outline" onClick={() => cargarDocumento(evidencia)}>
                      <Upload className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* H. Actualización y Conservación */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  H. Actualización y Conservación
                </CardTitle>
                <CardDescription>Mantenimiento de expedientes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {evidenciasActualizacion.map((evidencia, index) => (
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
