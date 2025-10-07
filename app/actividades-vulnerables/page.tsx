"use client"

import { ChangeEvent, useEffect, useRef, useState } from "react"
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
  Shield,
  History,
  AlertCircle,
  Info,
  Download,
  Eye,
  Trash2,
} from "lucide-react"
import { motion } from "framer-motion"

// Tipos de datos para el módulo
type ChecklistAnswer = string | null

interface ChecklistItem {
  id: string
  question: string
  required: boolean
  answer: ChecklistAnswer
  type?: "boolean" | "selection"
  options?: { value: string; label: string }[]
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
  size?: number
  mimeType?: string
  content?: string
}

interface TraceabilityEntry {
  id: string
  action: string
  user: string
  timestamp: Date
  details: string
  section: string
}

const actividadesCatalog = [
  {
    value: "fraccion-i",
    label: "Fracción I – Juegos con apuesta, concursos o sorteos",
    identificacion: "Identificación obligatoria cuando el monto sea ≥ 325 UMA ($36,770.50).",
    aviso: "Aviso obligatorio si premios, apuestas o concursos exceden 645 UMA ($72,975.30).",
  },
  {
    value: "fraccion-ii",
    label: "Fracción II – Tarjetas de servicios, crédito o prepagadas",
    identificacion:
      "Identificación por adquisiciones o recargas de tarjetas de crédito/servicios ≥ 805 UMA ($91,077.70) o tarjetas prepagadas/vales ≥ 645 UMA ($72,975.30).",
    aviso:
      "Aviso obligatorio por montos ≥ 1,285 UMA ($145,384.90) en tarjetas de crédito/servicios o ≥ 645 UMA en tarjetas prepagadas/vales.",
  },
  {
    value: "fraccion-iii",
    label: "Fracción III – Emisión o comercialización de cheques de viajero (no financieros)",
    identificacion: "Identificación conforme a umbrales aplicables publicados por el SAT.",
    aviso: "Aviso conforme a umbrales aplicables publicados por el SAT.",
  },
  {
    value: "fraccion-iv",
    label: "Fracción IV – Operaciones de mutuo, garantía, préstamos o créditos",
    identificacion: "Identificación obligatoria en todos los préstamos o créditos.",
    aviso: "Aviso obligatorio por montos ≥ 1,605 UMA ($181,589.70).",
  },
  {
    value: "fraccion-v",
    label: "Fracción V – Construcción, desarrollo e intermediación en bienes inmuebles",
    identificacion: "Identificación obligatoria en todas las operaciones de inmuebles.",
    aviso: "Aviso obligatorio por montos ≥ 8,025 UMA ($907,948.50).",
  },
  {
    value: "fraccion-vi",
    label: "Fracción VI – Comercialización de metales y piedras preciosas, joyas o relojes",
    identificacion: "Identificación obligatoria por montos ≥ 805 UMA ($91,077.70).",
    aviso: "Aviso obligatorio por montos ≥ 1,605 UMA ($181,589.70).",
  },
  {
    value: "fraccion-vii",
    label: "Fracción VII – Subasta o comercialización de obras de arte",
    identificacion: "Identificación obligatoria por montos ≥ 2,410 UMA ($272,667.40).",
    aviso: "Aviso obligatorio por montos ≥ 4,815 UMA ($544,769.10).",
  },
  {
    value: "fraccion-viii",
    label: "Fracción VIII – Comercialización o distribución de vehículos",
    identificacion: "Identificación obligatoria por montos ≥ 3,210 UMA ($363,179.40).",
    aviso: "Aviso obligatorio por montos ≥ 6,420 UMA ($726,358.80).",
  },
  {
    value: "fraccion-ix",
    label: "Fracción IX – Servicios de blindaje de vehículos o inmuebles",
    identificacion: "Identificación obligatoria por contratos ≥ 2,410 UMA ($272,667.40).",
    aviso: "Aviso obligatorio por contratos ≥ 4,815 UMA ($544,769.10).",
  },
  {
    value: "fraccion-x",
    label: "Fracción X – Servicios de traslado o custodia de dinero o valores",
    identificacion: "Identificación obligatoria en todos los traslados o custodia de valores.",
    aviso:
      "Aviso obligatorio cuando no sea posible determinar el monto o cuando sea ≥ 3,210 UMA ($363,179.40).",
  },
  {
    value: "fraccion-xi",
    label:
      "Fracción XI – Servicios profesionales independientes en operaciones financieras específicas",
    identificacion:
      "Identificación obligatoria al realizar operaciones en nombre del cliente (inmuebles, administración de activos, cuentas, sociedades/fideicomisos).",
    aviso:
      "Aviso cuando la operación financiera realizada en nombre del cliente así lo requiera conforme a la normatividad aplicable.",
  },
  {
    value: "fraccion-xii",
    label: "Fracción XII – Servicios de fe pública (notarios, corredores públicos)",
    identificacion: "Identificación conforme a los supuestos aplicables del art. 17.",
    aviso: "Aviso conforme a los supuestos aplicables del art. 17.",
  },
  {
    value: "fraccion-xiii",
    label: "Fracción XIII – Recepción de donativos por asociaciones y sociedades sin fines de lucro",
    identificacion: "Identificación obligatoria por donativos ≥ 1,605 UMA ($181,589.70).",
    aviso: "Aviso obligatorio por donativos ≥ 3,210 UMA ($363,179.40).",
  },
  {
    value: "fraccion-xiv",
    label: "Fracción XIV – Servicios de comercio exterior en mercancías específicas",
    identificacion: "Identificación conforme a umbrales aplicables publicados por el SAT.",
    aviso: "Aviso conforme a umbrales aplicables publicados por el SAT.",
  },
  {
    value: "fraccion-xv",
    label: "Fracción XV – Constitución de derechos de uso o goce de bienes inmuebles",
    identificacion: "Identificación obligatoria por valores ≥ 1,605 UMA ($181,589.70).",
    aviso: "Aviso obligatorio por valores ≥ 3,210 UMA ($363,179.40).",
  },
  {
    value: "fraccion-xvi",
    label: "Fracción XVI – Intercambio de activos virtuales (no reconocidos por Banxico)",
    identificacion: "Identificación obligatoria en todas las operaciones con activos virtuales.",
    aviso: "Aviso obligatorio por montos ≥ 210 UMA ($23,759.40).",
  },
]

type ActividadKey = (typeof actividadesCatalog)[number]["value"]

const basePreguntasGenerales: Omit<ChecklistItem, "answer" | "notes" | "lastUpdated">[] = [
  {
    id: "pg-1",
    question: "¿Cuál es la naturaleza de la operación? (Selecciona la fracción del art. 17)",
    required: true,
    type: "selection",
    options: actividadesCatalog.map((actividad) => ({
      value: actividad.value,
      label: actividad.label,
    })),
  },
  {
    id: "pg-2",
    question:
      "¿El monto de la operación es igual o superior al umbral de identificación publicado por el SAT para esa actividad?",
    required: true,
  },
  {
    id: "pg-3",
    question: "¿El monto de la operación es igual o superior al umbral de aviso aplicable?",
    required: true,
  },
  {
    id: "pg-4",
    question: "¿Cuál es el medio de pago de la operación?",
    required: true,
    type: "selection",
    options: [
      { value: "efectivo", label: "Efectivo" },
      { value: "transferencia", label: "Transferencia" },
      { value: "cheque", label: "Cheque" },
      { value: "tarjeta", label: "Tarjeta" },
      { value: "combinacion", label: "Combinación de medios" },
    ],
  },
  {
    id: "pg-5",
    question: "¿Existen operaciones acumuladas con el mismo cliente en el semestre que superen los umbrales?",
    required: true,
  },
  {
    id: "pg-6",
    question:
      "¿Existen exenciones conforme al art. 27 Bis RCG (ej. operaciones entre empresas del mismo grupo empresarial, primera venta con banca de desarrollo, etc.)?",
    required: true,
  },
]

const createPreguntasGenerales = (): ChecklistItem[] =>
  basePreguntasGenerales.map((pregunta) => ({ ...pregunta, answer: null }))

const preguntasEspecificasCatalog: Partial<
  Record<
    ActividadKey,
    Omit<ChecklistItem, "answer" | "notes" | "lastUpdated">[]
  >
> = {
  "fraccion-i": [
    {
      id: "f1-q1",
      question: "¿El cliente participa en un evento con monto ≥ 325 UMA ($36,770.50)?",
      required: true,
    },
    {
      id: "f1-q2",
      question: "¿El monto de premios, apuestas o concursos excede 645 UMA ($72,975.30)?",
      required: true,
    },
    {
      id: "f1-q3",
      question: "¿Se cuenta con identificación del participante y forma de pago documentada?",
      required: true,
    },
  ],
  "fraccion-ii": [
    {
      id: "f2-q1",
      question: "¿El cliente adquirió o recargó tarjeta de crédito o servicios por ≥ 805 UMA ($91,077.70)?",
      required: true,
    },
    {
      id: "f2-q2",
      question: "¿El monto excede el umbral de aviso de 1,285 UMA ($145,384.90)?",
      required: true,
    },
    {
      id: "f2-q3",
      question: "¿Se vendieron tarjetas prepagadas, vales o monederos por ≥ 645 UMA ($72,975.30)?",
      required: true,
    },
  ],
  "fraccion-iv": [
    {
      id: "f4-q1",
      question: "¿Se otorgó préstamo o crédito (con o sin garantía)?",
      required: true,
    },
    {
      id: "f4-q2",
      question: "¿El monto excede 1,605 UMA ($181,589.70)?",
      required: true,
    },
  ],
  "fraccion-v": [
    {
      id: "f5-q1",
      question: "¿La operación corresponde a compraventa, desarrollo o intermediación de bienes inmuebles?",
      required: true,
    },
    {
      id: "f5-q2",
      question: "¿El monto excede 8,025 UMA ($907,948.50) para presentar aviso?",
      required: true,
    },
  ],
  "fraccion-vi": [
    {
      id: "f6-q1",
      question: "¿La operación fue por ≥ 805 UMA ($91,077.70)?",
      required: true,
    },
    {
      id: "f6-q2",
      question: "¿El monto supera 1,605 UMA ($181,589.70)?",
      required: true,
    },
  ],
  "fraccion-vii": [
    {
      id: "f7-q1",
      question: "¿El valor de la subasta o compraventa es ≥ 2,410 UMA ($272,667.40)?",
      required: true,
    },
    {
      id: "f7-q2",
      question: "¿El monto supera 4,815 UMA ($544,769.10)?",
      required: true,
    },
  ],
  "fraccion-viii": [
    {
      id: "f8-q1",
      question: "¿Se vendió o distribuyó un vehículo con valor ≥ 3,210 UMA ($363,179.40)?",
      required: true,
    },
    {
      id: "f8-q2",
      question: "¿El monto supera 6,420 UMA ($726,358.80)?",
      required: true,
    },
  ],
  "fraccion-ix": [
    {
      id: "f9-q1",
      question: "¿El contrato de blindaje tiene un valor ≥ 2,410 UMA ($272,667.40)?",
      required: true,
    },
    {
      id: "f9-q2",
      question: "¿El monto supera 4,815 UMA ($544,769.10)?",
      required: true,
    },
  ],
  "fraccion-x": [
    {
      id: "f10-q1",
      question: "¿La operación corresponde a servicios de traslado o custodia de valores?",
      required: true,
    },
    {
      id: "f10-q2",
      question: "¿No es posible determinar el monto de la operación?",
      required: true,
    },
    {
      id: "f10-q3",
      question: "Si el monto es conocido, ¿es ≥ 3,210 UMA ($363,179.40)?",
      required: true,
    },
  ],
  "fraccion-xi": [
    {
      id: "f11-q1",
      question:
        "¿El profesionista realizó operaciones en nombre del cliente (inmuebles, administración de recursos, manejo de cuentas o constitución/administración de sociedades o fideicomisos)?",
      required: true,
    },
    {
      id: "f11-q2",
      question: "¿La operación realizada en nombre del cliente requiere aviso conforme a la normatividad financiera aplicable?",
      required: true,
    },
  ],
  "fraccion-xiii": [
    {
      id: "f13-q1",
      question: "¿El donativo recibido es ≥ 1,605 UMA ($181,589.70)?",
      required: true,
    },
    {
      id: "f13-q2",
      question: "¿El monto del donativo supera 3,210 UMA ($363,179.40)?",
      required: true,
    },
  ],
  "fraccion-xv": [
    {
      id: "f15-q1",
      question: "¿Se otorgó un derecho de uso o goce (arrendamiento/usufructo) por valor ≥ 1,605 UMA ($181,589.70)?",
      required: true,
    },
    {
      id: "f15-q2",
      question: "¿El monto supera 3,210 UMA ($363,179.40)?",
      required: true,
    },
  ],
  "fraccion-xvi": [
    {
      id: "f16-q1",
      question: "¿Se realizó una operación con activos virtuales?",
      required: true,
    },
    {
      id: "f16-q2",
      question: "¿El monto de la transacción es ≥ 210 UMA ($23,759.40)?",
      required: true,
    },
  ],
}

const createPreguntasEspecificas = (fraccion: ActividadKey): ChecklistItem[] =>
  (preguntasEspecificasCatalog[fraccion] || []).map((pregunta) => ({
    ...pregunta,
    answer: null,
  }))

// Evidencias requeridas
const evidenciasGenerales = [
  "Identificación oficial vigente del cliente (INE, pasaporte, FM2/FM3, tarjeta de residente)",
  "Comprobante de domicilio no mayor a 3 meses (recibo de servicios, estado de cuenta, predial)",
  "RFC y CURP (constancia de situación fiscal o documento oficial)",
  "Declaración firmada sobre beneficiario controlador",
  "Comprobante del medio de pago (transferencia, cheque, tarjeta o efectivo)",
  "Contrato o documento que ampare la operación",
]

const evidenciasPorFraccion: Partial<Record<ActividadKey, string[]>> = {
  "fraccion-i": [
    "Registro de participación o boleto",
    "Identificación del participante",
    "Comprobante de pago de la apuesta o entrega del premio",
  ],
  "fraccion-ii": [
    "Contrato o solicitud de emisión de la tarjeta",
    "Identificación del adquirente o usuario",
    "Comprobante de carga o compra de tarjetas, vales o monederos",
  ],
  "fraccion-iv": [
    "Contrato de mutuo o crédito",
    "Identificación del acreditado",
    "Garantías que soporten la operación (si existen)",
    "Comprobante de desembolso de recursos",
  ],
  "fraccion-v": [
    "Contrato de compraventa o intermediación",
    "Escritura pública o avalúo",
    "Identificación de comprador y vendedor",
    "Comprobante de pago de la operación",
  ],
  "fraccion-vi": [
    "Factura de venta",
    "Identificación del comprador",
    "Comprobante de pago cuando exceda el umbral",
  ],
  "fraccion-vii": [
    "Contrato de compraventa o factura",
    "Documento de subasta, en su caso",
    "Identificación del comprador",
    "Comprobante de pago",
  ],
  "fraccion-viii": [
    "Factura o contrato de compraventa del vehículo",
    "Identificación del comprador",
    "Comprobante de pago",
    "Tarjeta de circulación o documento equivalente (si aplica)",
  ],
  "fraccion-ix": [
    "Contrato de prestación de servicios de blindaje",
    "Identificación del contratante",
    "Comprobante de pago",
  ],
  "fraccion-x": [
    "Contrato de custodia o traslado",
    "Guía de traslado o póliza de custodia",
    "Identificación del contratante",
  ],
  "fraccion-xi": [
    "Contrato de prestación de servicios profesionales",
    "Identificación del cliente",
    "Documento que acredite la operación realizada en nombre del cliente (escritura, contrato bancario, acta societaria)",
  ],
  "fraccion-xiii": [
    "Acta de aceptación del donativo",
    "Identificación del donante",
    "Comprobante de transferencia o entrega del donativo",
  ],
  "fraccion-xv": [
    "Contrato de arrendamiento o usufructo",
    "Identificación del arrendatario o usuario",
    "Comprobante de pago",
  ],
  "fraccion-xvi": [
    "Contrato o términos de servicio con el usuario",
    "Identificación del usuario",
    "Comprobante de la transacción (wallet, exchange, recibo digital)",
  ],
}

const evidenciasConservacion = [
  "Adjuntar cada evidencia al expediente digital del cliente",
  "Permitir marcado de verificación y carga de archivo por evidencia",
  "Generar folio único por operación con fecha de carga y usuario responsable",
  "Registrar el estado del expediente (completo o incompleto)",
  "Mantener bitácora de accesos y descargas",
  "Contar con plan de respaldo y recuperación de información",
]

export default function ActividadesVulnerablesPage() {
  const { toast } = useToast()
  const [preguntasState, setPreguntasState] = useState<ChecklistItem[]>(() => createPreguntasGenerales())
  const [preguntasEspecificasState, setPreguntasEspecificasState] =
    useState<Partial<Record<ActividadKey, ChecklistItem[]>>>({})
  const [selectedFraccion, setSelectedFraccion] = useState<ActividadKey | null>(null)
  const [documentos, setDocumentos] = useState<DocumentUpload[]>([])
  const [trazabilidad, setTrazabilidad] = useState<TraceabilityEntry[]>([])
  const [progreso, setProgreso] = useState(0)
  const [activeTab, setActiveTab] = useState("preguntas")
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [pendingDocumentType, setPendingDocumentType] = useState<string | null>(null)
  const [documentoAEliminar, setDocumentoAEliminar] = useState<DocumentUpload | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  // Cargar datos del localStorage
  useEffect(() => {
    const savedData = localStorage.getItem("actividades-vulnerables-data")
    if (savedData) {
      try {
        const data = JSON.parse(savedData)
        const savedPreguntas: ChecklistItem[] = data.preguntas || []
        const mergedPreguntas = createPreguntasGenerales().map((basePregunta) => {
          const storedPregunta = savedPreguntas.find((pregunta: ChecklistItem) => pregunta.id === basePregunta.id)
          if (!storedPregunta) {
            return basePregunta
          }
          return {
            ...basePregunta,
            answer: storedPregunta.answer ?? null,
            notes: storedPregunta.notes,
            lastUpdated: storedPregunta.lastUpdated ? new Date(storedPregunta.lastUpdated) : undefined,
          }
        })
        setPreguntasState(mergedPreguntas)

        const savedSpecific: Partial<Record<ActividadKey, ChecklistItem[]>> =
          data.preguntasEspecificasState || {}
        const mergedSpecific: Partial<Record<ActividadKey, ChecklistItem[]>> = {}

        Object.keys(preguntasEspecificasCatalog).forEach((key) => {
          const typedKey = key as ActividadKey
          const base = createPreguntasEspecificas(typedKey)
          const storedList = savedSpecific[typedKey] || []
          mergedSpecific[typedKey] = base.map((basePregunta) => {
            const storedPregunta = storedList.find((pregunta) => pregunta.id === basePregunta.id)
            if (!storedPregunta) {
              return basePregunta
            }
            return {
              ...basePregunta,
              answer: storedPregunta.answer ?? null,
              notes: storedPregunta.notes,
              lastUpdated: storedPregunta.lastUpdated ? new Date(storedPregunta.lastUpdated) : undefined,
            }
          })
        })

        Object.keys(savedSpecific).forEach((key) => {
          const typedKey = key as ActividadKey
          if (!mergedSpecific[typedKey] && Array.isArray(savedSpecific[typedKey])) {
            mergedSpecific[typedKey] = (savedSpecific[typedKey] || []).map((pregunta) => ({
              ...pregunta,
              answer: pregunta.answer ?? null,
              lastUpdated: pregunta.lastUpdated ? new Date(pregunta.lastUpdated) : undefined,
            }))
          }
        })

        setPreguntasEspecificasState(mergedSpecific)

        const savedFraccion = data.selectedFraccion
        if (typeof savedFraccion === "string" && actividadesCatalog.some((actividad) => actividad.value === savedFraccion)) {
          setSelectedFraccion(savedFraccion as ActividadKey)
        } else {
          const fraccionFromPreguntas = mergedPreguntas.find((pregunta) => pregunta.id === "pg-1")?.answer
          if (fraccionFromPreguntas && actividadesCatalog.some((actividad) => actividad.value === fraccionFromPreguntas)) {
            setSelectedFraccion(fraccionFromPreguntas as ActividadKey)
          }
        }

        const savedDocumentos: DocumentUpload[] = data.documentos || []
        setDocumentos(
          savedDocumentos.map((doc) => ({
            ...doc,
            uploadDate: doc.uploadDate ? new Date(doc.uploadDate) : new Date(),
            expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : undefined,
          })),
        )

        const savedTrazabilidad: TraceabilityEntry[] = data.trazabilidad || []
        setTrazabilidad(
          savedTrazabilidad.map((entry) => ({
            ...entry,
            timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(),
          })),
        )
      } catch (error) {
        console.error("Error al cargar datos:", error)
      }
    }
  }, [])

  // Calcular progreso
  useEffect(() => {
    const preguntasEspecificasSeleccionadas =
      selectedFraccion && preguntasEspecificasState[selectedFraccion]
        ? preguntasEspecificasState[selectedFraccion]!
        : []
    const totalPreguntas = preguntasState.length + preguntasEspecificasSeleccionadas.length
    if (totalPreguntas === 0) {
      setProgreso(0)
      return
    }
    const preguntasRespondidas =
      preguntasState.filter((p) => p.answer !== null).length +
      preguntasEspecificasSeleccionadas.filter((p) => p.answer !== null).length
    const nuevoProgreso = Math.round((preguntasRespondidas / totalPreguntas) * 100)
    setProgreso(nuevoProgreso)
  }, [preguntasState, preguntasEspecificasState, selectedFraccion])

  // Asegurar catálogo específico cargado para la fracción seleccionada
  useEffect(() => {
    if (!selectedFraccion) return
    setPreguntasEspecificasState((prev) => {
      if (prev[selectedFraccion]) {
        return prev
      }
      return {
        ...prev,
        [selectedFraccion]: createPreguntasEspecificas(selectedFraccion),
      }
    })
  }, [selectedFraccion])

  // Guardar datos en localStorage
  useEffect(() => {
    const data = {
      preguntas: preguntasState,
      documentos,
      trazabilidad,
      selectedFraccion,
      preguntasEspecificasState,
    }
    localStorage.setItem("actividades-vulnerables-data", JSON.stringify(data))
  }, [preguntasState, documentos, trazabilidad, selectedFraccion, preguntasEspecificasState])

  // Actualizar respuesta de pregunta general
  const actualizarRespuestaGeneral = (id: string, answer: ChecklistAnswer) => {
    const pregunta = preguntasState.find((item) => item.id === id)

    setPreguntasState((prev) =>
      prev.map((preguntaItem) =>
        preguntaItem.id === id ? { ...preguntaItem, answer, lastUpdated: new Date() } : preguntaItem,
      ),
    )

    if (id === "pg-1") {
      const esActividadValida =
        typeof answer === "string" && actividadesCatalog.some((actividad) => actividad.value === answer)
      setSelectedFraccion(esActividadValida ? (answer as ActividadKey) : null)
    }

    if (pregunta) {
      const nuevaEntrada: TraceabilityEntry = {
        id: Date.now().toString(),
        action: "Respuesta actualizada",
        user: "Usuario actual",
        timestamp: new Date(),
        details: `Pregunta: ${pregunta.question.substring(0, 80)}... - Respuesta: ${answer ?? "Sin respuesta"}`,
        section: "Preguntas Generales",
      }
      setTrazabilidad((prev) => [nuevaEntrada, ...prev])
    }

    toast({
      title: "Respuesta guardada",
      description: "La respuesta ha sido registrada correctamente.",
    })
  }

  const actualizarRespuestaEspecifica = (fraccion: ActividadKey, id: string, answer: ChecklistAnswer) => {
    const preguntasActuales = preguntasEspecificasState[fraccion] || createPreguntasEspecificas(fraccion)
    const pregunta = preguntasActuales.find((item) => item.id === id)

    setPreguntasEspecificasState((prev) => {
      const current = prev[fraccion] || createPreguntasEspecificas(fraccion)
      const updated = current.map((item) =>
        item.id === id ? { ...item, answer, lastUpdated: new Date() } : item,
      )
      return {
        ...prev,
        [fraccion]: updated,
      }
    })

    if (pregunta) {
      const actividadLabel =
        actividadesCatalog.find((actividad) => actividad.value === fraccion)?.label || "Preguntas Específicas"
      const nuevaEntrada: TraceabilityEntry = {
        id: Date.now().toString(),
        action: "Respuesta actualizada",
        user: "Usuario actual",
        timestamp: new Date(),
        details: `Pregunta: ${pregunta.question.substring(0, 80)}... - Respuesta: ${answer ?? "Sin respuesta"}`,
        section: actividadLabel,
      }
      setTrazabilidad((prev) => [nuevaEntrada, ...prev])
    }

    toast({
      title: "Respuesta guardada",
      description: "La respuesta ha sido registrada correctamente.",
    })
  }

  const actualizarNotasGeneral = (id: string, notes: string) => {
    setPreguntasState((prev) =>
      prev.map((pregunta) =>
        pregunta.id === id ? { ...pregunta, notes, lastUpdated: new Date() } : pregunta,
      ),
    )
  }

  const actualizarNotasEspecificas = (fraccion: ActividadKey, id: string, notes: string) => {
    setPreguntasEspecificasState((prev) => {
      const current = prev[fraccion] || createPreguntasEspecificas(fraccion)
      const updated = current.map((pregunta) =>
        pregunta.id === id ? { ...pregunta, notes, lastUpdated: new Date() } : pregunta,
      )
      return {
        ...prev,
        [fraccion]: updated,
      }
    })
  }

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"))
      reader.readAsDataURL(file)
    })

  const cargarDocumento = (tipo: string) => {
    setPendingDocumentType(tipo)
    fileInputRef.current?.click()
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
    setDocumentos((prev) => prev.filter((item) => item.id !== documento.id))

    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: "Documento eliminado",
      user: "Usuario actual",
      timestamp: new Date(),
      details: `Documento eliminado: ${documento.name}`,
      section: "Carga Documental",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])

    toast({
      title: "Documento eliminado",
      description: `El documento ${documento.name} fue eliminado correctamente.`,
    })

    cerrarDialogoEliminacion()
  }

  const procesarArchivo = async (event: ChangeEvent<HTMLInputElement>) => {
    const archivo = event.target.files?.[0]
    if (!archivo) {
      return
    }

    const tipoDocumento = pendingDocumentType ?? "Documento"

    try {
      const contenido = await fileToDataUrl(archivo)
      const nuevoDocumento: DocumentUpload = {
        id: Date.now().toString(),
        name: archivo.name,
        type: tipoDocumento,
        uploadDate: new Date(),
        status: "vigente",
        size: archivo.size,
        mimeType: archivo.type,
        content: contenido,
      }

      setDocumentos((prev) => [...prev, nuevoDocumento])

      const nuevaEntrada: TraceabilityEntry = {
        id: Date.now().toString(),
        action: "Documento cargado",
        user: "Usuario actual",
        timestamp: new Date(),
        details: `Documento: ${nuevoDocumento.name} - Tipo: ${tipoDocumento}`,
        section: "Carga Documental",
      }
      setTrazabilidad((prev) => [nuevaEntrada, ...prev])

      toast({
        title: "Documento cargado",
        description: `El documento ${nuevoDocumento.name} ha sido cargado exitosamente.`,
      })
    } catch (error) {
      console.error(error)
      toast({
        title: "Error al cargar",
        description: "Ocurrió un problema al procesar el archivo seleccionado.",
        variant: "destructive",
      })
    } finally {
      setPendingDocumentType(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const verDocumento = (doc: DocumentUpload) => {
    if (!doc.content) {
      toast({
        title: "Documento no disponible",
        description: "El archivo seleccionado no cuenta con contenido para visualizarse.",
        variant: "destructive",
      })
      return
    }

    const nuevaVentana = window.open(doc.content, "_blank")
    if (!nuevaVentana) {
      toast({
        title: "No se pudo abrir el documento",
        description: "Permite las ventanas emergentes para visualizar el archivo.",
        variant: "destructive",
      })
    }
  }

  const descargarDocumento = (doc: DocumentUpload) => {
    if (!doc.content) {
      toast({
        title: "Documento no disponible",
        description: "El archivo seleccionado no cuenta con contenido para descargarse.",
        variant: "destructive",
      })
      return
    }

    const enlace = document.createElement("a")
    enlace.href = doc.content
    enlace.download = doc.name
    enlace.click()
  }

  // Obtener color según respuesta
  const getAnswerColor = (answer: ChecklistAnswer) => {
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

  const buildThresholdStatus = (
    type: "identificacion" | "aviso",
    answer: ChecklistAnswer,
  ) => {
    if (type === "identificacion") {
      if (answer === "si") {
        return {
          key: "identificacion",
          title: "Requiere identificación del cliente",
          description:
            "El monto rebasa el umbral de identificación establecido para la actividad seleccionada.",
          color: "border-amber-200 bg-amber-50",
          icon: AlertTriangle,
          iconClassName: "text-amber-600",
        }
      }
      if (answer === "no") {
        return {
          key: "identificacion",
          title: "Sin obligación adicional de identificación",
          description: "El monto no rebasa el umbral de identificación.",
          color: "border-green-200 bg-green-50",
          icon: CheckCircle2,
          iconClassName: "text-green-600",
        }
      }
      return {
        key: "identificacion",
        title: "Identificación pendiente de determinar",
        description: "Completa la evaluación para definir si debe identificarse al cliente.",
        color: "border-slate-200 bg-slate-50",
        icon: Info,
        iconClassName: "text-slate-600",
      }
    }

    if (answer === "si") {
      return {
        key: "aviso",
        title: "Aviso obligatorio a la UIF vía SAT",
        description: "El monto rebasa el umbral de aviso para la fracción seleccionada.",
        color: "border-red-200 bg-red-50",
        icon: AlertCircle,
        iconClassName: "text-red-600",
      }
    }
    if (answer === "no") {
      return {
        key: "aviso",
        title: "Sin obligación de aviso",
        description: "El monto no rebasa el umbral de aviso correspondiente.",
        color: "border-green-200 bg-green-50",
        icon: CheckCircle2,
        iconClassName: "text-green-600",
      }
    }
    return {
      key: "aviso",
      title: "Aviso pendiente de determinar",
      description: "Responde las preguntas de umbral para conocer si procede el aviso.",
      color: "border-slate-200 bg-slate-50",
      icon: Info,
      iconClassName: "text-slate-600",
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

  const formatFileSize = (size?: number) => {
    if (!size && size !== 0) return ""
    if (size === 0) return "0 B"

    const unidades = ["B", "KB", "MB", "GB", "TB"]
    let valor = size
    let indice = 0

    while (valor >= 1024 && indice < unidades.length - 1) {
      valor /= 1024
      indice += 1
    }

    const decimales = valor < 10 && indice > 0 ? 1 : 0
    return `${valor.toFixed(decimales)} ${unidades[indice]}`
  }

  const preguntasEspecificasSeleccionadas =
    selectedFraccion && preguntasEspecificasState[selectedFraccion]
      ? preguntasEspecificasState[selectedFraccion]!
      : []
  const preguntasGeneralesRespondidas = preguntasState.filter((p) => p.answer !== null).length
  const preguntasEspecificasRespondidas = preguntasEspecificasSeleccionadas.filter((p) => p.answer !== null).length
  const totalPreguntas = preguntasState.length + preguntasEspecificasSeleccionadas.length

  const selectedActividadConfig = selectedFraccion
    ? actividadesCatalog.find((actividad) => actividad.value === selectedFraccion)
    : undefined
  const selectedEvidenciasEspecificas = selectedFraccion
    ? evidenciasPorFraccion[selectedFraccion] || []
    : []

  const respuestaIdentificacion = preguntasState.find((pregunta) => pregunta.id === "pg-2")?.answer ?? null
  const respuestaAviso = preguntasState.find((pregunta) => pregunta.id === "pg-3")?.answer ?? null
  const thresholdStatuses = [
    buildThresholdStatus("identificacion", respuestaIdentificacion),
    buildThresholdStatus("aviso", respuestaAviso),
  ]

  return (
    <div className="container mx-auto py-6 space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={procesarArchivo}
      />
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
                  {preguntasGeneralesRespondidas + preguntasEspecificasRespondidas} de {totalPreguntas} preguntas
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

                  {pregunta.type === "selection" ? (
                    <Select
                      value={pregunta.answer ?? undefined}
                      onValueChange={(value) => actualizarRespuestaGeneral(pregunta.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una opción" />
                      </SelectTrigger>
                      <SelectContent>
                        {pregunta.options?.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {["si", "no", "no-aplica"].map((option) => (
                        <Button
                          key={option}
                          variant={pregunta.answer === option ? "default" : "outline"}
                          size="sm"
                          onClick={() => actualizarRespuestaGeneral(pregunta.id, option)}
                          className={pregunta.answer === option ? getAnswerColor(option) : ""}
                        >
                          {option === "si" ? "Sí" : option === "no" ? "No" : "No aplica"}
                        </Button>
                      ))}
                    </div>
                  )}

                  {pregunta.answer && (
                    <div className="space-y-2">
                      <Label htmlFor={`notes-${pregunta.id}`} className="text-sm">
                        Notas adicionales (opcional)
                      </Label>
                      <Textarea
                        id={`notes-${pregunta.id}`}
                        placeholder="Agregar observaciones o detalles adicionales..."
                        value={pregunta.notes || ""}
                        onChange={(e) => actualizarNotasGeneral(pregunta.id, e.target.value)}
                        className="min-h-[80px]"
                      />
                    </div>
                  )}
                </motion.div>
              ))}
            </CardContent>
          </Card>

          {selectedActividadConfig && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Reglas y Umbrales de la Actividad Seleccionada
                </CardTitle>
                <CardDescription>
                  Catálogo normativo dinámico vinculado a los umbrales oficiales publicados por el SAT.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-semibold">{selectedActividadConfig.label}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    <li>{selectedActividadConfig.identificacion}</li>
                    <li>{selectedActividadConfig.aviso}</li>
                  </ul>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {thresholdStatuses.map((status) => {
                    const StatusIcon = status.icon
                    return (
                      <div
                        key={status.key}
                        className={`flex items-start gap-3 rounded-lg border p-4 ${status.color}`}
                      >
                        <StatusIcon className={`h-5 w-5 ${status.iconClassName}`} />
                        <div>
                          <p className="font-medium">{status.title}</p>
                          <p className="text-sm text-muted-foreground">{status.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {selectedFraccion && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Preguntas Específicas por Actividad Vulnerable
                </CardTitle>
                <CardDescription>
                  Validaciones automáticas de umbrales para {selectedActividadConfig?.label || "la actividad seleccionada"}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {preguntasEspecificasSeleccionadas.length > 0 ? (
                  preguntasEspecificasSeleccionadas.map((pregunta, index) => (
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

                      <div className="flex flex-wrap gap-2">
                        {["si", "no", "no-aplica"].map((option) => (
                          <Button
                            key={option}
                            variant={pregunta.answer === option ? "default" : "outline"}
                            size="sm"
                            onClick={() => actualizarRespuestaEspecifica(selectedFraccion!, pregunta.id, option)}
                            className={pregunta.answer === option ? getAnswerColor(option) : ""}
                          >
                            {option === "si" ? "Sí" : option === "no" ? "No" : "No aplica"}
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
                            placeholder="Registrar evidencia o contexto adicional..."
                            value={pregunta.notes || ""}
                            onChange={(e) =>
                              actualizarNotasEspecificas(selectedFraccion!, pregunta.id, e.target.value)
                            }
                            className="min-h-[80px]"
                          />
                        </div>
                      )}
                    </motion.div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                    No hay preguntas específicas adicionales para esta fracción. Continúa con la evaluación general.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Carga Documental */}
        <TabsContent value="documentos" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Evidencias Generales */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Evidencias Generales</CardTitle>
                <CardDescription>Documentos mínimos para cualquier actividad vulnerable del art. 17.</CardDescription>
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
                <CardDescription>
                  Documentación adicional alineada a la fracción seleccionada del catálogo normativo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedFraccion ? (
                  selectedEvidenciasEspecificas.length > 0 ? (
                    selectedEvidenciasEspecificas.map((evidencia, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <span className="text-sm">{evidencia}</span>
                        <Button size="sm" variant="outline" onClick={() => cargarDocumento(evidencia)}>
                          <Upload className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      La fracción seleccionada no tiene evidencias adicionales específicas registradas.
                    </p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Selecciona una actividad vulnerable para mostrar las evidencias requeridas.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Conservación y Trazabilidad */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Conservación y Trazabilidad</CardTitle>
                <CardDescription>
                  Controles para expedientes digitales con folio, responsable y estado de integración.
                </CardDescription>
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
                          <div className="text-xs text-muted-foreground">
                            {doc.type}
                            {doc.size ? ` • ${formatFileSize(doc.size)}` : ""}
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
                        <Button size="sm" variant="ghost" onClick={() => verDocumento(doc)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => descargarDocumento(doc)}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => solicitarEliminacionDocumento(doc)}
                          className="text-destructive hover:text-destructive focus-visible:ring-destructive"
                          aria-label={`Eliminar ${doc.name}`}
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
            <AlertDialogTitle>Eliminar documento</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Deseas eliminar el documento "{documentoAEliminar?.name}"? Esta acción no se puede deshacer y se eliminará del
              expediente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cerrarDialogoEliminacion}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarEliminacionDocumento}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
