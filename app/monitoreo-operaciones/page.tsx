"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
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
  BookOpenCheck,
  Globe,
  Filter,
  ExternalLink,
} from "lucide-react"
import { motion } from "framer-motion"
import { readFileAsDataUrl } from "@/lib/storage/read-file"
import jsPDF from "jspdf"
import * as XLSX from "xlsx"
import { actividadesVulnerables } from "@/lib/data/actividades"
import { normativasMonitoreo } from "@/lib/data/normativas"

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
  dataUrl: string
  mimeType: string
  size: number
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
  subjectId: string
  subjectName: string
  clientName: string
  clientType: "persona-fisica" | "persona-moral"
  clientId: string
  semester: string
  periodoAno: string
  periodoMes: string
  amount: number
  classification: "relevante" | "inusual" | "interna-preocupante"
  evidences: string[]
  profileAligned: boolean
  relacionNegocios: boolean
  registeredBy: string
  createdAt: Date
  activityKey: string
  activityName: string
  operationDate: Date
}

interface ClienteExpediente {
  id: string
  nombre: string
  tipo: OperationRecord["clientType"]
  actividades: string[]
  relacionNegocios: boolean
  altaExpediente: Date
  documentos: DocumentUpload[]
}

interface SujetoObligadoExpediente {
  id: string
  nombre: string
  tipo: "persona-fisica" | "persona-moral" | "fideicomiso"
  actividadVulnerable: string
  clientes: ClienteExpediente[]
}

interface MonitoreoStorageData {
  preguntas: ChecklistItem[]
  documentos: DocumentUpload[]
  trazabilidad: TraceabilityEntry[]
  operaciones: OperationRecord[]
  sujetos: SujetoObligadoExpediente[]
}

interface OperationFormState {
  subjectId: string
  clientId: string
  clientName: string
  clientType: OperationRecord["clientType"]
  semester: string
  periodoAno: string
  periodoMes: string
  amount: string
  classification: OperationRecord["classification"]
  evidences: string[]
  profileAligned: boolean
  relacionNegocios: boolean
  activityKey: string
  operationDate: string
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

const sujetosBase: SujetoObligadoExpediente[] = [
  {
    id: "sujeto-demo",
    nombre: "Operaciones Patrimoniales Demo",
    tipo: "persona-moral",
    actividadVulnerable: "Servicios inmobiliarios fracción XV",
    clientes: [
      {
        id: "cliente-demo",
        nombre: "Cliente inicial",
        tipo: "persona-fisica",
        actividades: [actividadesVulnerables[0]?.key ?? ""],
        relacionNegocios: true,
        altaExpediente: new Date(),
        documentos: [],
      },
    ],
  },
]

export default function MonitoreoOperacionesPage() {
  const { toast } = useToast()
  const currentYear = new Date().getFullYear()
  const actividadesMapa = useMemo(() => {
    const mapa = new Map(actividadesVulnerables.map((actividad) => [actividad.key, actividad]))
    return mapa
  }, [])
  const semestresDisponibles = useMemo(() => {
    const semestres: string[] = []
    for (let year = currentYear; year >= currentYear - 4; year -= 1) {
      semestres.push(`1er semestre ${year}`)
      semestres.push(`2º semestre ${year}`)
    }
    return semestres
  }, [currentYear])
  const aniosDisponibles = useMemo(
    () => Array.from({ length: 5 }, (_, index) => (currentYear - index).toString()),
    [currentYear],
  )
  const mesesDisponibles = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ]
  const createInitialFormState = (): OperationFormState => ({
    subjectId: sujetosBase[0]?.id ?? "",
    clientId: sujetosBase[0]?.clientes[0]?.id ?? "",
    clientName: "",
    clientType: "persona-fisica",
    semester: semestresDisponibles[0] ?? "",
    periodoAno: aniosDisponibles[0] ?? currentYear.toString(),
    periodoMes: mesesDisponibles[new Date().getMonth()],
    amount: "",
    classification: "relevante",
    profileAligned: true,
    relacionNegocios: true,
    evidences: [],
    activityKey: actividadesVulnerables[0]?.key ?? "",
    operationDate: new Date().toISOString().substring(0, 10),
  })
  const [preguntasState, setPreguntasState] = useState<ChecklistItem[]>(preguntasGenerales)
  const [documentos, setDocumentos] = useState<DocumentUpload[]>([])
  const [trazabilidad, setTrazabilidad] = useState<TraceabilityEntry[]>([])
  const [operaciones, setOperaciones] = useState<OperationRecord[]>([])
  const [sujetos, setSujetos] = useState<SujetoObligadoExpediente[]>(sujetosBase)
  const [progreso, setProgreso] = useState(0)
  const [activeTab, setActiveTab] = useState("preguntas")
  const [ultimoScreening, setUltimoScreening] = useState<Date | null>(null)
  const [ultimaSincronizacionKyc, setUltimaSincronizacionKyc] = useState<Date | null>(null)
  const [ultimoEnvioUif, setUltimoEnvioUif] = useState<Date | null>(null)
  const [formOperacion, setFormOperacion] = useState<OperationFormState>(() => createInitialFormState())
  const [filtros, setFiltros] = useState({
    search: "",
    actividad: "todas",
    tipoCliente: "todos",
    anio: "todos",
  })
  const [sujetoConsultaId, setSujetoConsultaId] = useState<string>(sujetosBase[0]?.id ?? "")
  const [clienteConsultaId, setClienteConsultaId] = useState<string>(sujetosBase[0]?.clientes[0]?.id ?? "")
  const [nuevoSujeto, setNuevoSujeto] = useState({
    nombre: "",
    tipo: "persona-moral" as SujetoObligadoExpediente["tipo"],
    actividadVulnerable: "",
    clienteNombre: "",
    clienteTipo: "persona-fisica" as OperationRecord["clientType"],
    clienteActividad: actividadesVulnerables[0]?.key ?? "",
    relacionNegocios: true,
  })
  const [documentoIdentificacion, setDocumentoIdentificacion] = useState<DocumentUpload | null>(null)

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
              subjectId: op.subjectId ?? "sujeto-desconocido",
              subjectName: op.subjectName ?? "Sujeto sin clasificar",
              clientId: op.clientId ?? "cliente-desconocido",
              activityKey: op.activityKey ?? "",
              activityName:
                op.activityName ?? actividadesMapa.get(op.activityKey ?? "")?.nombre ?? "Sin clasificar",
              createdAt: op.createdAt ? new Date(op.createdAt) : new Date(),
              periodoAno: op.periodoAno ?? new Date().getFullYear().toString(),
              periodoMes: op.periodoMes ?? mesesDisponibles[new Date().getMonth()],
              relacionNegocios: op.relacionNegocios ?? true,
              operationDate: op.operationDate ? new Date(op.operationDate) : new Date(op.createdAt ?? Date.now()),
            })),
          )
        }
        if (data.sujetos) {
          setSujetos(
            data.sujetos.map((sujeto) => ({
              ...sujeto,
              clientes: sujeto.clientes.map((cliente) => ({
                ...cliente,
                altaExpediente: new Date(cliente.altaExpediente),
                documentos: cliente.documentos.map((doc) => ({
                  ...doc,
                  uploadDate: new Date(doc.uploadDate),
                })),
              })),
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

  // Guardar datos en localStorage
  const guardarDatos = (override?: Partial<MonitoreoStorageData>) => {
    const data: MonitoreoStorageData = {
      preguntas: override?.preguntas ?? preguntasState,
      documentos: override?.documentos ?? documentos,
      trazabilidad: override?.trazabilidad ?? trazabilidad,
      operaciones: override?.operaciones ?? operaciones,
      sujetos: override?.sujetos ?? sujetos,
    }
    localStorage.setItem("monitoreo-operaciones-data", JSON.stringify(data))
  }

  const crearDocumento = async (file: File, type = "identificacion") => {
    const dataUrl = await readFileAsDataUrl(file)
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      name: file.name,
      type,
      uploadDate: new Date(),
      dataUrl,
      mimeType: file.type,
      size: file.size,
    } satisfies DocumentUpload
  }

  const manejarCargaIdentificacion = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const documento = await crearDocumento(file, "identificacion")
      setDocumentoIdentificacion(documento)
      toast({
        title: "Documento cargado",
        description: `${file.name} identificado como evidencia de Anexo 3.`,
      })
    } catch (error) {
      console.error(error)
      toast({
        title: "No se pudo cargar",
        description: "Vuelve a intentar con un PDF o imagen válida.",
        variant: "destructive",
      })
    } finally {
      event.target.value = ""
    }
  }

  const registrarNuevoSujeto = () => {
    if (!nuevoSujeto.nombre.trim() || !nuevoSujeto.actividadVulnerable.trim() || !nuevoSujeto.clienteNombre.trim()) {
      toast({
        title: "Faltan datos",
        description: "Captura nombre, actividad vulnerable y el cliente inicial.",
        variant: "destructive",
      })
      return
    }

    const cliente: ClienteExpediente = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      nombre: nuevoSujeto.clienteNombre.trim(),
      tipo: nuevoSujeto.clienteTipo,
      actividades: [nuevoSujeto.clienteActividad],
      relacionNegocios: nuevoSujeto.relacionNegocios,
      altaExpediente: new Date(),
      documentos: documentoIdentificacion ? [documentoIdentificacion] : [],
    }

    const sujeto: SujetoObligadoExpediente = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      nombre: nuevoSujeto.nombre.trim(),
      tipo: nuevoSujeto.tipo,
      actividadVulnerable: nuevoSujeto.actividadVulnerable.trim(),
      clientes: [cliente],
    }

    const listaSujetos = [sujeto, ...sujetos]
    setSujetos(listaSujetos)
    setSujetoConsultaId(sujeto.id)
    setClienteConsultaId(cliente.id)
    setNuevoSujeto({
      nombre: "",
      tipo: nuevoSujeto.tipo,
      actividadVulnerable: "",
      clienteNombre: "",
      clienteTipo: nuevoSujeto.clienteTipo,
      clienteActividad: actividadesVulnerables[0]?.key ?? "",
      relacionNegocios: true,
    })
    setDocumentoIdentificacion(null)
    guardarDatos({ sujetos: listaSujetos })
    toast({
      title: "Expediente creado",
      description: "El sujeto obligado y su expediente inicial quedaron disponibles para consulta.",
    })
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

  const handleDocumentUpload = async (event: ChangeEvent<HTMLInputElement>, tipo: string) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const dataUrl = await readFileAsDataUrl(file)
      const nuevoDocumento: DocumentUpload = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        name: file.name,
        type: tipo,
        uploadDate: new Date(),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        dataUrl,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      }

      const updatedDocumentos = [nuevoDocumento, ...documentos]

      setDocumentos(updatedDocumentos)
      guardarDatos({ documentos: updatedDocumentos })

      registrarAccion(
        "Documento cargado",
        "Carga Documental",
        `Documento: ${nuevoDocumento.name} - Tipo: ${tipo}`,
      )

      toast({
        title: "Documento cargado",
        description: `El documento ${nuevoDocumento.name} se almacenó en el expediente digital.`,
      })
    } catch (error) {
      console.error("Error al almacenar el archivo", error)
      toast({
        title: "No se pudo cargar el archivo",
        description: "Intenta nuevamente con un archivo válido.",
        variant: "destructive",
      })
    } finally {
      event.target.value = ""
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
    setFormOperacion((prev) => {
      const actualizado: OperationFormState = {
        ...prev,
        [field]: value as any,
        ...(field === "classification" ? { evidences: [] } : {}),
      }

      if (field === "subjectId") {
        actualizado.clientId = ""
      }

      if (field === "clientId") {
        const sujeto = sujetos.find((item) => item.id === (actualizado.subjectId || formOperacion.subjectId))
        const cliente = sujeto?.clientes.find((item) => item.id === value)
        actualizado.clientName = cliente?.nombre ?? actualizado.clientName
        actualizado.clientType = cliente?.tipo ?? actualizado.clientType
        actualizado.relacionNegocios = cliente?.relacionNegocios ?? actualizado.relacionNegocios
        if (cliente?.actividades.length) {
          actualizado.activityKey = cliente.actividades[0]
        }
      }

      return actualizado
    })
  }

  const registrarOperacion = () => {
    const sujetoSeleccion = sujetos.find((sujeto) => sujeto.id === formOperacion.subjectId)
    const clienteSeleccion = sujetoSeleccion?.clientes.find((cliente) => cliente.id === formOperacion.clientId)
    const monto = Number(formOperacion.amount)
    const actividadSeleccionada =
      actividadesMapa.get(formOperacion.activityKey) ??
      (clienteSeleccion ? actividadesMapa.get(clienteSeleccion.actividades[0]) : undefined)
    const fechaOperacion = formOperacion.operationDate ? new Date(formOperacion.operationDate) : null
    if (
      !sujetoSeleccion ||
      !clienteSeleccion ||
      !formOperacion.periodoAno ||
      !formOperacion.periodoMes ||
      !formOperacion.semester ||
      Number.isNaN(monto) ||
      monto <= 0 ||
      !actividadSeleccionada ||
      !fechaOperacion ||
      Number.isNaN(fechaOperacion.getTime())
    ) {
      toast({
        title: "Datos incompletos",
        description: "Completa la información de la operación antes de registrarla.",
        variant: "destructive",
      })
      return
    }

    const nuevaOperacion: OperationRecord = {
      id: Date.now().toString(),
      subjectId: sujetoSeleccion.id,
      subjectName: sujetoSeleccion.nombre,
      clientId: clienteSeleccion.id,
      clientName: clienteSeleccion.nombre,
      clientType: clienteSeleccion.tipo,
      semester: formOperacion.semester,
      periodoAno: formOperacion.periodoAno,
      periodoMes: formOperacion.periodoMes,
      amount: monto,
      classification: formOperacion.classification,
      evidences: formOperacion.evidences,
      profileAligned: formOperacion.profileAligned,
      relacionNegocios: formOperacion.relacionNegocios,
      registeredBy: "Usuario actual",
      createdAt: new Date(),
      activityKey: actividadSeleccionada.key,
      activityName: actividadSeleccionada.nombre,
      operationDate: fechaOperacion,
    }

    const updatedOperaciones = [nuevaOperacion, ...operaciones]
    setOperaciones(updatedOperaciones)
    guardarDatos({ operaciones: updatedOperaciones })

    registrarAccion(
      "Operación registrada",
      "Automatización Semestral",
      `Cliente: ${nuevaOperacion.clientName} • ${formatCurrency(nuevaOperacion.amount)} • ${nuevaOperacion.semester} • ${nuevaOperacion.activityName}`,
    )

    toast({
      title: "Operación acumulada",
      description: "La operación se integró al cálculo semestral y a la bitácora.",
    })

    setFormOperacion({
      ...createInitialFormState(),
      clientType: clienteSeleccion.tipo,
      classification: formOperacion.classification,
      semester: formOperacion.semester,
      activityKey: actividadSeleccionada.key,
      operationDate: formOperacion.operationDate,
      subjectId: formOperacion.subjectId,
      clientId: formOperacion.clientId,
    })
  }

  const operacionesFiltradas = useMemo(() => {
    return operaciones.filter((operacion) => {
      const coincideBusqueda = filtros.search
        ? `${operacion.clientName} ${operacion.activityName}`
            .toLowerCase()
            .includes(filtros.search.toLowerCase())
        : true
      const coincideActividad =
        filtros.actividad === "todas" || operacion.activityKey === filtros.actividad
      const coincideTipo =
        filtros.tipoCliente === "todos" || operacion.clientType === filtros.tipoCliente
      const coincideAnio =
        filtros.anio === "todos" || operacion.operationDate.getFullYear().toString() === filtros.anio
      return coincideBusqueda && coincideActividad && coincideTipo && coincideAnio
    })
    }, [filtros, operaciones])

  const sujetoOperacion = useMemo(
    () => sujetos.find((sujeto) => sujeto.id === formOperacion.subjectId) ?? null,
    [formOperacion.subjectId, sujetos],
  )
  const clientesDisponibles = sujetoOperacion?.clientes ?? []
  const clienteOperacion = useMemo(
    () => clientesDisponibles.find((cliente) => cliente.id === formOperacion.clientId) ?? null,
    [clientesDisponibles, formOperacion.clientId],
  )
  const actividadesCliente = clienteOperacion?.actividades ?? []
  const sujetoConsulta = useMemo(
    () => sujetos.find((sujeto) => sujeto.id === sujetoConsultaId) ?? sujetos[0] ?? null,
    [sujetoConsultaId, sujetos],
  )
  const clienteConsulta = useMemo(
    () => sujetoConsulta?.clientes.find((cliente) => cliente.id === clienteConsultaId) ?? sujetoConsulta?.clientes[0] ?? null,
    [clienteConsultaId, sujetoConsulta],
  )

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

    operacionesFiltradas.forEach((operacion) => {
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
  }, [operacionesFiltradas])

  const operacionesInusuales = useMemo(
    () => operacionesFiltradas.filter((operacion) => operacion.classification === "inusual"),
    [operacionesFiltradas],
  )

  const operacionesInternas = useMemo(
    () => operacionesFiltradas.filter((operacion) => operacion.classification === "interna-preocupante"),
    [operacionesFiltradas],
  )

  const operacionesPerfilDesalineado = useMemo(
    () => operacionesFiltradas.filter((operacion) => !operacion.profileAligned),
    [operacionesFiltradas],
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
    if (operacionesFiltradas.length === 0) {
      toast({
        title: "Sin operaciones a exportar",
        description: "Aplica diferentes filtros o registra nuevas operaciones antes de exportar.",
        variant: "destructive",
      })
      return
    }

    if (tipo === "Excel") {
      const hoja = XLSX.utils.json_to_sheet(
        operacionesFiltradas.map((operacion) => ({
          Cliente: operacion.clientName,
          Actividad: operacion.activityName,
          "Tipo de cliente": operacion.clientType === "persona-fisica" ? "Persona física" : "Persona moral",
          Semestre: operacion.semester,
          "Fecha de operación": operacion.operationDate.toISOString().substring(0, 10),
          Clasificación: operacion.classification,
          Monto: operacion.amount,
          "Perfil alineado": operacion.profileAligned ? "Sí" : "No",
        })),
      )
      const libro = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(libro, hoja, "Operaciones")
      XLSX.writeFile(libro, "monitoreo-operaciones.xlsx")
    } else {
      const doc = new jsPDF()
      doc.setFontSize(14)
      doc.text("Reporte de monitoreo de operaciones", 14, 20)
      doc.setFontSize(10)
      doc.text(`Generado el ${new Date().toLocaleString("es-MX")}`, 14, 28)

      let posicionY = 36
      operacionesFiltradas.forEach((operacion, index) => {
        const lineas = [
          `${index + 1}. ${operacion.clientName} • ${operacion.activityName}`,
          `Monto: ${formatCurrency(operacion.amount)} | Semestre: ${operacion.semester} | Fecha: ${operacion.operationDate.toLocaleDateString("es-MX")}`,
          `Clasificación: ${operacion.classification.replace("-", " ")} | Tipo cliente: ${
            operacion.clientType === "persona-fisica" ? "Persona física" : "Persona moral"
          } | Perfil alineado: ${operacion.profileAligned ? "Sí" : "No"}`,
        ]

        lineas.forEach((linea) => {
          doc.text(linea, 14, posicionY)
          posicionY += 6
          if (posicionY > 270) {
            doc.addPage()
            posicionY = 20
          }
        })

        posicionY += 2
      })

      doc.save("monitoreo-operaciones.pdf")
    }

    registrarAccion(
      `Exportación ${tipo}`,
      "Auditoría",
      `Se generó un reporte ${tipo.toUpperCase()} con las operaciones monitoreadas (${operacionesFiltradas.length} registros).`,
    )
    toast({
      title: `Reporte ${tipo} generado`,
      description: "Descarga completa. Conservar durante el mismo periodo de cinco años.",
    })
  }

  const evidenciasClasificacionActuales = evidenciasClasificacion[formOperacion.classification]

  const totalOperaciones = operacionesFiltradas.length

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Activity className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Registro de actos y operaciones</h1>
            <p className="text-muted-foreground">
              Define quién es el sujeto obligado, consulta su expediente de identificación y captura operaciones mensuales
              ligadas a las actividades vulnerables registradas.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Expedientes de identificación
            </CardTitle>
            <CardDescription>
              Opción 1: consulta un expediente existente iniciando con la pregunta clave "¿Quién es el sujeto obligado?".
              Opción 2: registra un nuevo expediente sin revisar anexos manualmente.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Opción 1 · Consulta expediente</p>
                  <p className="text-xs text-muted-foreground">Selecciona el sujeto obligado y su cliente para ver los datos cargados.</p>
                </div>
                <Badge variant="secondary">Consulta</Badge>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>¿Quién es el sujeto obligado?</Label>
                  <Select value={sujetoConsulta?.id} onValueChange={(value) => setSujetoConsultaId(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona sujeto obligado" />
                    </SelectTrigger>
                    <SelectContent>
                      {sujetos.map((sujeto) => (
                        <SelectItem key={sujeto.id} value={sujeto.id}>
                          {sujeto.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cliente registrado en su expediente</Label>
                  <Select
                    value={clienteConsulta?.id}
                    onValueChange={(value) => setClienteConsultaId(value)}
                    disabled={!sujetoConsulta}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {sujetoConsulta?.clientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {sujetoConsulta && clienteConsulta && (
                  <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{sujetoConsulta.tipo.replace("-", " ")}</Badge>
                      <Badge variant="outline">Relación de negocios: {clienteConsulta.relacionNegocios ? "Sí" : "No"}</Badge>
                      <Badge variant="secondary">Alta: {clienteConsulta.altaExpediente.toLocaleDateString("es-MX")}</Badge>
                    </div>
                    <p className="text-sm font-semibold">Actividad vulnerable</p>
                    <p className="text-sm text-muted-foreground">{sujetoConsulta.actividadVulnerable}</p>
                    <div>
                      <p className="text-sm font-semibold">Documentos (Anexo 3)</p>
                      <ul className="list-disc pl-5 text-sm text-muted-foreground">
                        {clienteConsulta.documentos.length === 0 && <li>Sin documentos cargados.</li>}
                        {clienteConsulta.documentos.map((doc) => (
                          <li key={doc.id} className="break-words">
                            {doc.name} · {doc.uploadDate.toLocaleDateString("es-MX")}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {clienteConsulta.relacionNegocios && (
                      <p className="text-xs text-muted-foreground">
                        La relación de negocios exige actualizar el expediente cada año. Última alta: {clienteConsulta.altaExpediente.toLocaleDateString("es-MX")}.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Opción 2 · Crear nuevo expediente</p>
                  <p className="text-xs text-muted-foreground">Captura el sujeto obligado y un cliente sin consultar anexos.</p>
                </div>
                <Badge variant="outline">Nuevo</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre del sujeto obligado</Label>
                  <Input
                    value={nuevoSujeto.nombre}
                    onChange={(event) => setNuevoSujeto((prev) => ({ ...prev, nombre: event.target.value }))}
                    placeholder="Razón social o nombre"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={nuevoSujeto.tipo}
                    onValueChange={(value: SujetoObligadoExpediente["tipo"]) =>
                      setNuevoSujeto((prev) => ({ ...prev, tipo: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="persona-fisica">Persona física</SelectItem>
                      <SelectItem value="persona-moral">Persona moral</SelectItem>
                      <SelectItem value="fideicomiso">Fideicomiso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Actividad vulnerable a registrar</Label>
                  <Textarea
                    value={nuevoSujeto.actividadVulnerable}
                    onChange={(event) => setNuevoSujeto((prev) => ({ ...prev, actividadVulnerable: event.target.value }))}
                    placeholder="Describe la fracción y la actividad vulnerable"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cliente inicial</Label>
                  <Input
                    value={nuevoSujeto.clienteNombre}
                    onChange={(event) => setNuevoSujeto((prev) => ({ ...prev, clienteNombre: event.target.value }))}
                    placeholder="Cliente vinculado al expediente"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de cliente</Label>
                  <Select
                    value={nuevoSujeto.clienteTipo}
                    onValueChange={(value: OperationRecord["clientType"]) =>
                      setNuevoSujeto((prev) => ({ ...prev, clienteTipo: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="persona-fisica">Persona física</SelectItem>
                      <SelectItem value="persona-moral">Persona moral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Actividad vulnerable del cliente</Label>
                  <Select
                    value={nuevoSujeto.clienteActividad}
                    onValueChange={(value) => setNuevoSujeto((prev) => ({ ...prev, clienteActividad: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona actividad" />
                    </SelectTrigger>
                    <SelectContent>
                      {actividadesVulnerables.map((actividad) => (
                        <SelectItem key={actividad.key} value={actividad.key}>
                          {actividad.fraccion} – {actividad.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Checkbox
                      checked={nuevoSujeto.relacionNegocios}
                      onCheckedChange={(checked) =>
                        setNuevoSujeto((prev) => ({ ...prev, relacionNegocios: checked === true }))
                      }
                    />
                    ¿La actividad vulnerable constituye relación de negocios?
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label>Identificación del sujeto (Anexo 3)</Label>
                  <Button variant="outline" className="w-full" asChild>
                    <label className="flex cursor-pointer items-center justify-center gap-2">
                      <Upload className="h-4 w-4" />
                      Cargar documento
                      <input type="file" className="sr-only" onChange={manejarCargaIdentificacion} />
                    </label>
                  </Button>
                  {documentoIdentificacion && (
                    <p className="text-xs text-muted-foreground">{documentoIdentificacion.name}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={registrarNuevoSujeto}>Registrar expediente</Button>
                <Button variant="ghost" onClick={() => setDocumentoIdentificacion(null)}>
                  Limpiar documento
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros transversales y ventana de cinco años
            </CardTitle>
            <CardDescription>
              Aplica criterios que impactan todas las vistas del módulo. Los resultados y exportaciones respetan la misma
              ventana de conservación de cinco años.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="filtro-busqueda">Buscar cliente o actividad</Label>
                <Input
                  id="filtro-busqueda"
                  placeholder="Ej. nombre del cliente o fracción"
                  value={filtros.search}
                  onChange={(event) => setFiltros((prev) => ({ ...prev, search: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Actividad vulnerable</Label>
                <Select
                  value={filtros.actividad}
                  onValueChange={(value) => setFiltros((prev) => ({ ...prev, actividad: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las actividades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las actividades</SelectItem>
                    {actividadesVulnerables.map((actividad) => (
                      <SelectItem key={actividad.key} value={actividad.key}>
                        {actividad.fraccion} – {actividad.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de cliente</Label>
                <Select
                  value={filtros.tipoCliente}
                  onValueChange={(value) => setFiltros((prev) => ({ ...prev, tipoCliente: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los tipos</SelectItem>
                    <SelectItem value="persona-fisica">Persona física</SelectItem>
                    <SelectItem value="persona-moral">Persona moral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Año natural</Label>
                <Select value={filtros.anio} onValueChange={(value) => setFiltros((prev) => ({ ...prev, anio: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Últimos cinco años" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Últimos cinco años</SelectItem>
                    {aniosDisponibles.map((anio) => (
                      <SelectItem key={anio} value={anio}>
                        {anio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <Badge variant="secondary">{totalOperaciones} operaciones visibles</Badge>
              <Badge variant="outline">Filtro de {filtros.anio === "todos" ? "5 años" : `año ${filtros.anio}`}</Badge>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFiltros({ search: "", actividad: "todas", tipoCliente: "todos", anio: "todos" })}
            >
              Limpiar filtros
            </Button>
            <Button type="button" variant="outline" onClick={() => exportarReporte("PDF")}>
              Exportar PDF
            </Button>
            <Button type="button" variant="outline" onClick={() => exportarReporte("Excel")}>
              Exportar Excel
            </Button>
          </CardFooter>
        </Card>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpenCheck className="h-5 w-5 text-primary" />
              Normativa conectada con actividades vulnerables
            </CardTitle>
            <CardDescription>
              Consulta rápidamente la autoridad aplicable, criterios y repositorios para alinear monitoreo y actividades
              vulnerables.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Este módulo comparte criterios con el tablero de actividades vulnerables para garantizar que la
                  clasificación de operaciones, la documentación y la exportación digital se mantengan sincronizadas.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Operaciones filtradas: {totalOperaciones}</Badge>
                  <Badge variant="outline">Ventana mínima: 5 años</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href="/actividades-vulnerables">Abrir módulo de actividades</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/marco-normativo-aplicable">Repositorio normativo interno</Link>
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                {normativasMonitoreo.map((norma) => (
                  <div key={norma.id} className="space-y-2 rounded-lg border border-primary/20 bg-white p-4 text-sm">
                    <div>
                      <p className="font-semibold text-primary">{norma.autoridad}</p>
                      <p className="text-xs text-muted-foreground">{norma.descripcion}</p>
                    </div>
                    <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                      {norma.criteriosClave.map((criterio) => (
                        <li key={criterio}>{criterio}</li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Link
                        href={norma.repositorio.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 px-3 py-1 text-primary hover:bg-primary/10"
                      >
                        <ExternalLink className="h-3 w-3" /> {norma.repositorio.nombre}
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-primary">
                      {norma.referenciasInternacionales.map((referencia) => (
                        <Link
                          key={`${norma.id}-${referencia.nombre}`}
                          href={referencia.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 hover:bg-primary/20"
                        >
                          <Globe className="h-3 w-3" /> {referencia.nombre}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="preguntas" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Expedientes y checklist
          </TabsTrigger>
          <TabsTrigger value="acumulacion" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Registro de actos y operaciones
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
                  Captura de actos y operaciones
                </CardTitle>
                <CardDescription>
                  Registra operaciones con periodo mensual, sujeto obligado identificado y vinculación con la actividad
                  vulnerable que consta en el expediente.
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
                      <Label>Sujeto obligado</Label>
                      <Select
                        value={formOperacion.subjectId}
                        onValueChange={(value) => actualizarFormulario("subjectId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona sujeto obligado" />
                        </SelectTrigger>
                        <SelectContent>
                          {sujetos.map((sujeto) => (
                            <SelectItem key={sujeto.id} value={sujeto.id}>
                              {sujeto.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Cliente del expediente</Label>
                      <Select
                        value={formOperacion.clientId}
                        onValueChange={(value) => actualizarFormulario("clientId", value)}
                        disabled={!sujetoOperacion}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {clientesDisponibles.map((cliente) => (
                            <SelectItem key={cliente.id} value={cliente.id}>
                              {cliente.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Actividad vulnerable vinculada</Label>
                      <Select
                        value={formOperacion.activityKey}
                        onValueChange={(value) => actualizarFormulario("activityKey", value)}
                        disabled={actividadesCliente.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona actividad registrada" />
                        </SelectTrigger>
                        <SelectContent>
                          {actividadesCliente.map((actividadKey) => {
                            const actividad = actividadesMapa.get(actividadKey)
                            if (!actividad) return null
                            return (
                              <SelectItem key={actividad.key} value={actividad.key}>
                                {actividad.fraccion} – {actividad.nombre}
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                      {actividadesCliente.length === 0 && (
                        <p className="text-xs text-muted-foreground">Solo aparecen actividades del expediente; agrega clientes para ver más opciones.</p>
                      )}
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
                      <Label>Periodo (año y mes)</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={formOperacion.periodoAno}
                          onValueChange={(value) => actualizarFormulario("periodoAno", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Año" />
                          </SelectTrigger>
                          <SelectContent>
                            {aniosDisponibles.map((anio) => (
                              <SelectItem key={anio} value={anio}>
                                {anio}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={formOperacion.periodoMes}
                          onValueChange={(value) => actualizarFormulario("periodoMes", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Mes" />
                          </SelectTrigger>
                          <SelectContent>
                            {mesesDisponibles.map((mes) => (
                              <SelectItem key={mes} value={mes}>
                                {mes}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fecha-operacion">Fecha de operación</Label>
                      <Input
                        id="fecha-operacion"
                        type="date"
                        value={formOperacion.operationDate}
                        max={new Date().toISOString().substring(0, 10)}
                        onChange={(event) => actualizarFormulario("operationDate", event.target.value)}
                        required
                      />
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
                      <Label>Relación de negocios</Label>
                      <div className="flex items-center gap-2 rounded-md border p-3">
                        <Checkbox
                          id="relacion"
                          checked={formOperacion.relacionNegocios}
                          onCheckedChange={(checked) => actualizarFormulario("relacionNegocios", checked === true)}
                        />
                        <div className="flex items-center gap-2 text-sm">
                          <Label htmlFor="relacion" className="text-sm">
                            ¿Constituye relación de negocios?
                          </Label>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline">¿Qué es?</Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Relación de negocios</DialogTitle>
                              </DialogHeader>
                              <p className="text-sm text-muted-foreground">
                                Marca "Sí" cuando existe continuidad con el cliente. La plataforma marcará que el expediente debe
                                actualizarse cada año a partir de la fecha de alta.
                              </p>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
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

                  <div className="space-y-2 rounded-lg border p-4">
                    <p className="text-sm font-semibold">Vista previa antes de enviar</p>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        Sujeto obligado: {sujetoOperacion?.nombre ?? "Selecciona un sujeto"} · Cliente: {clienteOperacion?.nombre ?? "Selecciona cliente"}
                      </p>
                      <p>
                        Actividad: {actividadesMapa.get(formOperacion.activityKey)?.nombre ?? "Sin actividad"}
                      </p>
                      <p>
                        Periodo: {formOperacion.periodoMes} {formOperacion.periodoAno} · Semestre: {formOperacion.semester}
                      </p>
                      <p>
                        Monto: {formatCurrency(Number(formOperacion.amount) || 0)} · Clasificación: {formOperacion.classification.replace("-", " ")}
                      </p>
                    </div>
                  </div>

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
                    {operacionesAgrupadas.map((grupo) => {
                      const actividadesGrupo = Array.from(
                        new Set(grupo.operaciones.map((operacion) => operacion.activityName)),
                      )
                      return (
                        <div key={`${grupo.clientName}-${grupo.semester}`} className="space-y-3 rounded-lg border p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h3 className="font-semibold">
                                {grupo.clientName} · {grupo.semester}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                Tipo: {grupo.clientType === "persona-fisica" ? "Persona física" : "Persona moral"}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                {actividadesGrupo.map((actividad) => (
                                  <Badge key={actividad} variant="outline">
                                    {actividad}
                                  </Badge>
                                ))}
                              </div>
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
                                <div>
                                  <div className="font-medium">
                                    {formatCurrency(operacion.amount)} · {operacion.classification.replace("-", " ")}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="secondary">{operacion.activityName}</Badge>
                                    <span>Fecha: {operacion.operationDate.toLocaleDateString("es-MX")}</span>
                                  </div>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  Registrada el {operacion.createdAt.toLocaleDateString("es-MX")} por {operacion.registeredBy}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
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
              <CardDescription>
                Resumen de banderas por inusualidad, fraccionamiento e incidencias internas considerando los filtros activos.
              </CardDescription>
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
                    <Button size="sm" variant="outline" asChild>
                      <label className="flex cursor-pointer items-center gap-1">
                        <Upload className="mr-1 h-3 w-3" />
                        Cargar
                        <input
                          type="file"
                          className="sr-only"
                          onChange={(event) => handleDocumentUpload(event, evidencia.id)}
                        />
                      </label>
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
                      <Button size="sm" variant="ghost" asChild>
                        <label className="flex cursor-pointer items-center gap-1">
                          <Upload className="h-3 w-3" />
                          <input
                            type="file"
                            className="sr-only"
                            onChange={(event) => handleDocumentUpload(event, item.id)}
                          />
                        </label>
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
                      <Button size="sm" variant="ghost" asChild>
                        <label className="flex cursor-pointer items-center gap-1">
                          <Upload className="h-3 w-3" />
                          <input
                            type="file"
                            className="sr-only"
                            onChange={(event) => handleDocumentUpload(event, item.id)}
                          />
                        </label>
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
                      <Button size="sm" variant="ghost" asChild>
                        <label className="flex cursor-pointer items-center gap-1">
                          <Upload className="h-3 w-3" />
                          <input
                            type="file"
                            className="sr-only"
                            onChange={(event) => handleDocumentUpload(event, item.id)}
                          />
                        </label>
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
                        <Button size="sm" variant="ghost" asChild>
                          <label className="flex cursor-pointer items-center gap-1">
                            <Upload className="h-3 w-3" />
                            <input
                              type="file"
                              className="sr-only"
                              onChange={(event) => handleDocumentUpload(event, item.id)}
                            />
                          </label>
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
                        <Button size="sm" variant="ghost" asChild>
                          <a
                            href={doc.dataUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1"
                          >
                            <Eye className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <a href={doc.dataUrl} download={doc.name} className="flex items-center gap-1">
                            <Download className="h-4 w-4" />
                          </a>
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
              {documentos.filter((doc) => getDocumentStatus(doc) !== "vigente").length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-green-500" />
                  Todos los documentos están vigentes.
                </div>
              ) : (
                <div className="space-y-4">
                  {documentos
                    .filter((doc) => getDocumentStatus(doc) !== "vigente")
                    .map((doc) => (
                      <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="h-5 w-5 text-amber-500" />
                          <div>
                            <div className="font-medium">{doc.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {getDocumentStatus(doc) === "vencido"
                                ? "Documento vencido"
                                : `Vence el ${doc.expiryDate?.toLocaleDateString()}`}
                            </div>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          Gestionar renovación
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
              <CardDescription>
                Reportes exportables con filtros aplicados y registro cronológico de al menos 5 años.
              </CardDescription>
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
