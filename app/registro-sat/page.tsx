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
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
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
  Building2,
  Paperclip,
  X,
  ListChecks,
  Bell,
  CalendarClock,
  Inbox,
  ClipboardList,
  CalendarDays,
  RefreshCcw,
  FileCheck,
} from "lucide-react"
import { motion } from "framer-motion"

// Tipos de datos para el módulo
type AnswerValue = "si" | "no" | "no-aplica"

interface ChecklistRequirement {
  requiresEvidence?: boolean
  evidenceHints?: string[]
  evidenceHelperText?: string
  notesLabel?: string
  notesPlaceholder?: string
  helperText?: string
}

type ChecklistRequirements = Partial<Record<AnswerValue, ChecklistRequirement>>

interface ChecklistItem {
  id: string
  section: string
  question: string
  answer: AnswerValue | null
  required: boolean
  notes?: string
  lastUpdated?: Date
  requirements?: ChecklistRequirements
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

interface PasoAltaPortal {
  id: string
  titulo: string
  descripcion: string
  checklist: {
    id: string
    label: string
    helperText?: string
    required?: boolean
  }[]
}

interface AcuseSATState {
  fileName: string | null
  uploadDate: Date | null
  selloDigital: string
  validado: boolean
}

interface RECFormState {
  nombre: string
  correo: string
  telefono: string
  fechaDesignacion: string
  fechaUltimaCapacitacion: string
  acuseDesignacion: string | null
  acuseAceptacion: string | null
  constanciaCapacitacion: string | null
  poderNotarial: string | null
  observaciones: string
  ultimaActualizacion?: string
}

type EstadoNotificacion = "pendiente" | "contestada" | "vencida"

interface NotificacionElectronica {
  id: string
  asunto: string
  fechaRecepcion: string
  fechaLimite: string
  acuseLectura?: string
  acuseRespuesta?: string
  estado: EstadoNotificacion
}

interface RecordatorioBuzon {
  id: string
  fechaRevision: string
  descripcion: string
}

interface RegistroAltaState {
  fechaAlta: string
  folioSAT: string
  representante: string
  acuses: string[]
}

interface ControlVersion {
  id: string
  fecha: string
  tipoCambio: string
  detalle: string
}

const answerOptions: { value: AnswerValue; label: string }[] = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
  { value: "no-aplica", label: "No Aplica" },
]

const defaultRequirements: ChecklistRequirements = {
  si: {
    requiresEvidence: true,
    evidenceHints: [],
    evidenceHelperText:
      "Adjunta los archivos que respalden el cumplimiento. Puedes seleccionar varios documentos.",
    notesLabel: "Comentarios sobre la evidencia",
    notesPlaceholder: "Agrega folios, responsables o aclaraciones relacionadas con los archivos cargados.",
    helperText:
      "Esta información se guardará automáticamente para mantener trazabilidad sobre la documentación presentada.",
  },
  no: {
    requiresEvidence: false,
    notesLabel: "Justificación y acciones pendientes",
    notesPlaceholder: "Describe el motivo de la respuesta negativa y los pasos para regularizar la situación.",
    helperText:
      "Documenta la causa del incumplimiento y las acciones previstas para atender el requisito.",
  },
  "no-aplica": {
    requiresEvidence: false,
    notesLabel: "Notas sobre no aplicabilidad",
    notesPlaceholder: "Explica por qué este requisito no aplica en la operación.",
    helperText: "Deja constancia de la justificación de no aplicabilidad para futuras revisiones.",
  },
}

const createRequirements = (
  overrides: Partial<Record<AnswerValue, Partial<ChecklistRequirement>>>,
): ChecklistRequirements =>
  (Object.keys(defaultRequirements) as AnswerValue[]).reduce((acc, answer) => {
    const baseRequirement = defaultRequirements[answer] ?? {}
    const override = overrides[answer] ?? {}

    acc[answer] = {
      ...baseRequirement,
      ...override,
      requiresEvidence: override.requiresEvidence ?? baseRequirement.requiresEvidence,
      evidenceHints: override.evidenceHints ?? baseRequirement.evidenceHints,
      evidenceHelperText: override.evidenceHelperText ?? baseRequirement.evidenceHelperText,
      notesLabel: override.notesLabel ?? baseRequirement.notesLabel,
      notesPlaceholder: override.notesPlaceholder ?? baseRequirement.notesPlaceholder,
      helperText: override.helperText ?? baseRequirement.helperText,
    }

    return acc
  }, {} as ChecklistRequirements)

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
    requirements: createRequirements({
      si: {
        evidenceHints: ["Acuse digital de alta expedido por el SAT."],
      },
      no: {
        requiresEvidence: true,
        evidenceHints: ["Comprobante del trámite posterior presentado ante el SAT."],
        notesLabel: "Causa del retraso y acciones correctivas",
        notesPlaceholder:
          "Detalla el motivo del incumplimiento y los folios o gestiones realizadas para regularizar el alta.",
        helperText:
          "Incluye evidencia del trámite posterior y describe los plazos comprometidos para concluirlo.",
      },
    }),
  },
  {
    id: "rg-2",
    section: "Alta en el Padrón de Actividades Vulnerables",
    question:
      "¿El trámite de alta se efectuó utilizando la e.firma (FIEL) vigente del representante legal?",
    answer: null,
    required: true,
    requirements: createRequirements({
      si: {
        evidenceHints: ["Acuse de validación de e.firma (FIEL) vigente del representante legal."],
      },
      no: {
        requiresEvidence: true,
        evidenceHints: ["Comprobante de renovación de e.firma o aclaración ingresada ante el SAT."],
        notesLabel: "Motivo de falta de FIEL vigente",
        notesPlaceholder:
          "Describe la situación de la e.firma, folios de renovación o aclaraciones presentadas ante el SAT.",
        helperText:
          "Adjunta la evidencia del trámite de renovación o la aclaración ingresada ante la autoridad fiscal.",
      },
    }),
  },
  {
    id: "rg-3",
    section: "Alta en el Padrón de Actividades Vulnerables",
    question:
      "¿Se seleccionó correctamente la fracción de Actividad Vulnerable del art. 17 LFPIORPI que corresponde a la operación?",
    answer: null,
    required: true,
    requirements: createRequirements({
      si: {
        evidenceHints: [
          "Captura del portal o acuse que confirme la fracción de Actividad Vulnerable seleccionada.",
        ],
      },
      no: {
        requiresEvidence: true,
        evidenceHints: ["Nota de corrección presentada y evidencia del trámite de modificación."],
        notesLabel: "Corrección requerida",
        notesPlaceholder:
          "Explica la fracción correcta e incluye detalles del trámite de modificación ante el SAT.",
        helperText:
          "Anexa la nota de corrección levantada y el soporte del trámite de modificación enviado.",
      },
    }),
  },

  // 2. Representante Encargada de Cumplimiento (REC)
  {
    id: "rg-4",
    section: "Representante Encargada de Cumplimiento (REC)",
    question:
      "¿La empresa designó formalmente a la Representante Encargada de Cumplimiento en términos del art. 20 LFPIORPI?",
    answer: null,
    required: true,
    requirements: createRequirements({
      si: {
        evidenceHints: ["Acuse de designación de la REC emitido por el SAT."],
      },
      no: {
        requiresEvidence: true,
        evidenceHints: ["Comprobante del trámite pendiente de designación ante el SAT."],
        notesLabel: "Situación de la designación del REC",
        notesPlaceholder:
          "Describe la razón de la falta de designación y los pasos o folios del trámite en curso.",
        helperText:
          "Adjunta evidencia del trámite pendiente o documentación interna que respalde la gestión.",
      },
    }),
  },
  {
    id: "rg-5",
    section: "Representante Encargada de Cumplimiento (REC)",
    question: "¿El REC aceptó formalmente el cargo en el Portal SAT y se encuentra vigente?",
    answer: null,
    required: true,
    requirements: createRequirements({
      si: {
        evidenceHints: ["Acuse de aceptación del REC en el Portal PLD del SAT."],
      },
      no: {
        requiresEvidence: true,
        evidenceHints: ["Constancia del trámite de actualización del REC en proceso."],
        notesLabel: "Actualización del REC pendiente",
        notesPlaceholder:
          "Detalla el motivo por el cual no se ha aceptado el cargo y adjunta folios del trámite de actualización.",
        helperText:
          "Incluye evidencia de la gestión de actualización o de la respuesta esperada del SAT.",
      },
    }),
  },
  {
    id: "rg-6",
    section: "Representante Encargada de Cumplimiento (REC)",
    question:
      "¿El REC cuenta con constancia de capacitación anual emitida por institución acreditada?",
    answer: null,
    required: true,
    requirements: createRequirements({
      si: {
        evidenceHints: ["Constancia o diploma vigente de capacitación anual del REC."],
      },
      no: {
        requiresEvidence: true,
        evidenceHints: ["Programa, convocatoria o constancia provisional de capacitación en trámite."],
        notesLabel: "Plan de capacitación pendiente",
        notesPlaceholder:
          "Describe el estatus de la capacitación anual, fechas programadas y responsables de su cumplimiento.",
        helperText:
          "Adjunta evidencia del programa o de la gestión para obtener la constancia de capacitación.",
      },
    }),
  },
  {
    id: "rg-7",
    section: "Representante Encargada de Cumplimiento (REC)",
    question:
      "¿Se cuenta con un respaldo documental del poder o nombramiento que faculte al REC para representar a la empresa ante SAT/UIF?",
    answer: null,
    required: true,
    requirements: createRequirements({
      si: {
        evidenceHints: [
          "Copia certificada o poder notarial que faculte al REC para representar a la empresa ante SAT/UIF.",
        ],
      },
      no: {
        requiresEvidence: true,
        evidenceHints: ["Requerimiento interno emitido para formalizar el poder o nombramiento."],
        notesLabel: "Regularización del poder del REC",
        notesPlaceholder:
          "Registra la situación actual y los pasos para obtener el poder o nombramiento correspondiente.",
        helperText:
          "Carga el requerimiento interno o la evidencia del trámite para formalizar las facultades del REC.",
      },
    }),
  },

  // 3. Actualizaciones y Modificaciones
  {
    id: "rg-8",
    section: "Actualizaciones y Modificaciones",
    question:
      "¿Se han realizado actualizaciones de datos (domicilio, representante, actividad) en el Portal PLD en un plazo no mayor a 30 días naturales de ocurrido el cambio?",
    answer: null,
    required: true,
    requirements: createRequirements({
      si: {
        evidenceHints: ["Acuse de actualización de datos emitido por el Portal PLD del SAT."],
      },
      no: {
        requiresEvidence: true,
        evidenceHints: ["Comprobante del trámite pendiente de actualización presentado ante el SAT."],
        notesLabel: "Actualización de datos pendiente",
        notesPlaceholder:
          "Detalla la modificación requerida, la fecha del cambio y los folios del trámite en curso.",
        helperText:
          "Adjunta evidencia del trámite pendiente o de la gestión interna para completar la actualización.",
      },
    }),
  },
  {
    id: "rg-9",
    section: "Actualizaciones y Modificaciones",
    question: "¿Se encuentra actualizado el domicilio fiscal y de operación en el portal?",
    answer: null,
    required: true,
    requirements: createRequirements({
      si: {
        evidenceHints: ["Acuse de modificación o confirmación del domicilio registrado en el portal."],
      },
      no: {
        notesLabel: "Pendiente de actualización de domicilio",
        notesPlaceholder:
          "Registra la situación del domicilio y los pasos programados para actualizarlo en el portal.",
        helperText:
          "Documenta la fecha prevista para la actualización y a los responsables de la gestión.",
      },
    }),
  },
  {
    id: "rg-10",
    section: "Actualizaciones y Modificaciones",
    question: "¿Se actualizó el registro en caso de suspensión o baja de actividades vulnerables?",
    answer: null,
    required: true,
    requirements: createRequirements({
      si: {
        evidenceHints: ["Acuse de baja o suspensión de actividades vulnerables emitido por el SAT."],
      },
      no: {
        notesLabel: "Justificación de ausencia de baja",
        notesPlaceholder:
          "Explica por qué no se ha actualizado la baja o suspensión y los pasos siguientes para regularizarla.",
        helperText:
          "Documenta las gestiones pendientes y los responsables de realizar la actualización correspondiente.",
      },
    }),
  },

  // 4. Buzón Tributario y Notificaciones
  {
    id: "rg-11",
    section: "Buzón Tributario y Notificaciones",
    question: "¿El Buzón Tributario de la empresa está habilitado y vinculado al registro PLD?",
    answer: null,
    required: true,
    requirements: createRequirements({
      si: {
        evidenceHints: ["Captura o acuse de configuración del Buzón Tributario vinculado al registro PLD."],
      },
      no: {
        notesLabel: "Pendiente de habilitar Buzón Tributario",
        notesPlaceholder:
          "Describe las acciones necesarias para habilitar y vincular el Buzón Tributario con el registro PLD.",
        helperText:
          "Registra responsables y fechas objetivo para concluir la habilitación del buzón.",
      },
    }),
  },
  {
    id: "rg-12",
    section: "Buzón Tributario y Notificaciones",
    question:
      "¿Se tiene un procedimiento documentado para revisar semanalmente notificaciones relacionadas con PLD?",
    answer: null,
    required: true,
    requirements: createRequirements({
      si: {
        evidenceHints: ["Procedimiento documentado o bitácora de revisiones semanales del Buzón Tributario."],
      },
      no: {
        notesLabel: "Elaboración de procedimiento pendiente",
        notesPlaceholder:
          "Describe el estatus del procedimiento y los responsables de documentarlo para su aprobación.",
        helperText:
          "Registra los pasos para documentar el procedimiento y la fecha objetivo de implementación.",
      },
    }),
  },
  {
    id: "rg-13",
    section: "Buzón Tributario y Notificaciones",
    question:
      "¿Se respondió en plazo (máximo 10 días hábiles) a notificaciones electrónicas del SAT relacionadas con el padrón?",
    answer: null,
    required: true,
    requirements: createRequirements({
      si: {
        evidenceHints: ["Acuse de respuesta emitido dentro del plazo legal correspondiente."],
      },
      no: {
        requiresEvidence: true,
        evidenceHints: ["Requerimiento pendiente y evidencia de la respuesta en elaboración."],
        notesLabel: "Gestión de respuesta pendiente",
        notesPlaceholder:
          "Detalla la notificación sin atender, los motivos del retraso y el plan para responder en tiempo.",
        helperText:
          "Adjunta el requerimiento recibido y cualquier evidencia del seguimiento interno para responderlo.",
      },
    }),
  },

  // 5. Evidencias y Conservación
  {
    id: "rg-14",
    section: "Evidencias y Conservación",
    question:
      "¿Se conserva en repositorio interno (físico o digital) la documentación soporte de alta y actualizaciones?",
    answer: null,
    required: true,
    requirements: createRequirements({
      si: {
        evidenceHints: ["Listado o inventario de documentos resguardados en el repositorio interno."],
      },
      no: {
        notesLabel: "Nota de incumplimiento registrada",
        notesPlaceholder:
          "Describe los documentos faltantes, responsables y fecha objetivo para completar el repositorio.",
        helperText:
          "Documenta la nota de incumplimiento y el plan de acción para resguardar la documentación.",
      },
    }),
  },
  {
    id: "rg-15",
    section: "Evidencias y Conservación",
    question:
      "¿Se verificó que los acuses digitales SAT tengan sello digital y código de verificación?",
    answer: null,
    required: true,
    requirements: createRequirements({
      si: {
        evidenceHints: ["Validación o constancia del sello digital y código de verificación de los acuses."],
      },
      no: {
        notesLabel: "Registro del hallazgo",
        notesPlaceholder:
          "Describe el hallazgo detectado, acuses involucrados y acciones para obtener la validación correspondiente.",
        helperText:
          "Anota el seguimiento para validar los acuses y asegurar su autenticidad ante futuras revisiones.",
      },
    }),
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

const pasosAltaPortal: PasoAltaPortal[] = [
  {
    id: "preparacion",
    titulo: "Preparación documental obligatoria",
    descripcion:
      "Valida que la documentación base esté vigente y completa antes de iniciar el trámite en el Portal PLD.",
    checklist: [
      {
        id: "rfc",
        label: "RFC vigente del sujeto obligado",
        helperText: "Descarga la constancia actualizada directamente del portal SAT.",
        required: true,
      },
      {
        id: "fiel",
        label: "Certificados de e.firma (FIEL) activos",
        helperText: "Verifica vigencia y contraseña para firmar el envío.",
        required: true,
      },
      {
        id: "acta",
        label: "Acta constitutiva y modificaciones",
        helperText: "Adjunta la versión protocolizada más reciente.",
        required: true,
      },
      {
        id: "poderes",
        label: "Poderes notariales del representante legal",
        helperText: "Confirma que el poder contenga facultades para actos de administración y representación ante SAT/UIF.",
        required: true,
      },
    ],
  },
  {
    id: "configuracion",
    titulo: "Configuración del Portal PLD",
    descripcion:
      "Revisa accesos, roles y checklist interno antes del llenado del formulario digital.",
    checklist: [
      {
        id: "usuarios",
        label: "Usuarios y roles dados de alta en el Portal PLD",
        helperText: "Confirma que el REC y auxiliares tengan credenciales activas.",
      },
      {
        id: "buzon",
        label: "Buzón Tributario vinculado y verificado",
        helperText: "Registra correo y teléfono autorizados para notificaciones.",
      },
      {
        id: "representante",
        label: "Datos del representante legal coinciden con acta y RFC",
      },
    ],
  },
  {
    id: "captura",
    titulo: "Captura de información",
    descripcion:
      "Completa cada sección del portal asegurando consistencia con la documentación soporte.",
    checklist: [
      {
        id: "actividad",
        label: "Selección correcta de la actividad vulnerable",
        helperText: "Corrobora fracción aplicable conforme a la Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita.",
      },
      {
        id: "domicilio",
        label: "Domicilio fiscal y sucursales registrados",
      },
      {
        id: "procedimientos",
        label: "Carga de manuales y procedimientos internos cuando el portal lo solicite",
      },
    ],
  },
  {
    id: "envio",
    titulo: "Envío y resguardo",
    descripcion:
      "Realiza el envío con la e.firma y resguarda el acuse digital con sello electrónico.",
    checklist: [
      {
        id: "firma",
        label: "Firma electrónica exitosa y acuse descargado",
        required: true,
      },
      {
        id: "validacion",
        label: "Validación del sello digital y código de barras del acuse",
        helperText: "Utiliza el verificador de documentos SAT para confirmar autenticidad.",
        required: true,
      },
      {
        id: "resguardo",
        label: "Respaldo del acuse en repositorio interno",
      },
    ],
  },
]

const addBusinessDays = (startDate: Date, businessDays: number) => {
  const date = new Date(startDate)
  let addedDays = 0

  while (addedDays < businessDays) {
    date.setDate(date.getDate() + 1)
    const day = date.getDay()
    if (day !== 0 && day !== 6) {
      addedDays += 1
    }
  }

  return date
}

const formatISODate = (value: string) => {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString()
}

const createEmptyRecForm = (): RECFormState => ({
  nombre: "",
  correo: "",
  telefono: "",
  fechaDesignacion: "",
  fechaUltimaCapacitacion: "",
  acuseDesignacion: null,
  acuseAceptacion: null,
  constanciaCapacitacion: null,
  poderNotarial: null,
  observaciones: "",
})

export default function RegistroSATPage() {
  const { toast } = useToast()
  const [preguntasState, setPreguntasState] = useState<ChecklistItem[]>(preguntasGenerales)
  const [documentos, setDocumentos] = useState<DocumentUpload[]>([])
  const [trazabilidad, setTrazabilidad] = useState<TraceabilityEntry[]>([])
  const [progreso, setProgreso] = useState(0)
  const [activeTab, setActiveTab] = useState("preguntas")
  const [evidenciasPorPregunta, setEvidenciasPorPregunta] = useState<Record<string, string[]>>({})
  const [pasosChecklist, setPasosChecklist] = useState<Record<string, boolean>>({})
  const [acuseSAT, setAcuseSAT] = useState<AcuseSATState>({
    fileName: null,
    uploadDate: null,
    selloDigital: "",
    validado: false,
  })
  const [acuseSATError, setAcuseSATError] = useState<string | null>(null)
  const [recForm, setRecForm] = useState<RECFormState>(createEmptyRecForm())
  const [notificacionesElectronicas, setNotificacionesElectronicas] = useState<NotificacionElectronica[]>([])
  const [recordatoriosBuzon, setRecordatoriosBuzon] = useState<RecordatorioBuzon[]>([])
  const [registroAlta, setRegistroAlta] = useState<RegistroAltaState>({
    fechaAlta: "",
    folioSAT: "",
    representante: "",
    acuses: [],
  })
  const [controlVersiones, setControlVersiones] = useState<ControlVersion[]>([])
  const [nuevoAcuseRegistro, setNuevoAcuseRegistro] = useState("")
  const [nuevoCambio, setNuevoCambio] = useState<{ tipoCambio: string; detalle: string }>({
    tipoCambio: "",
    detalle: "",
  })
  const [notificacionDraft, setNotificacionDraft] = useState({
    asunto: "",
    fechaRecepcion: "",
    acuseLectura: "",
    acuseRespuesta: "",
  })
  const [recordatorioDraft, setRecordatorioDraft] = useState({
    fechaRevision: "",
    descripcion: "Revisión periódica del Buzón Tributario",
  })

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

      const checklistGuardado =
        data.pasosChecklist && typeof data.pasosChecklist === "object"
          ? Object.entries(data.pasosChecklist as Record<string, unknown>).reduce<Record<string, boolean>>(
              (acc, [key, value]) => {
                acc[key] = Boolean(value)
                return acc
              },
              {},
            )
          : {}

      const acuseGuardado: AcuseSATState = {
        fileName: typeof data.acuseSAT?.fileName === "string" ? data.acuseSAT.fileName : null,
        uploadDate:
          data.acuseSAT?.uploadDate && typeof data.acuseSAT.uploadDate === "string"
            ? new Date(data.acuseSAT.uploadDate)
            : null,
        selloDigital: typeof data.acuseSAT?.selloDigital === "string" ? data.acuseSAT.selloDigital : "",
        validado: Boolean(data.acuseSAT?.validado),
      }

      const recGuardado: RECFormState = {
        ...createEmptyRecForm(),
        ...(typeof data.recForm === "object" && data.recForm
          ? {
              nombre: typeof data.recForm.nombre === "string" ? data.recForm.nombre : "",
              correo: typeof data.recForm.correo === "string" ? data.recForm.correo : "",
              telefono: typeof data.recForm.telefono === "string" ? data.recForm.telefono : "",
              fechaDesignacion:
                typeof data.recForm.fechaDesignacion === "string" ? data.recForm.fechaDesignacion : "",
              fechaUltimaCapacitacion:
                typeof data.recForm.fechaUltimaCapacitacion === "string"
                  ? data.recForm.fechaUltimaCapacitacion
                  : "",
              acuseDesignacion:
                typeof data.recForm.acuseDesignacion === "string" ? data.recForm.acuseDesignacion : null,
              acuseAceptacion:
                typeof data.recForm.acuseAceptacion === "string" ? data.recForm.acuseAceptacion : null,
              constanciaCapacitacion:
                typeof data.recForm.constanciaCapacitacion === "string"
                  ? data.recForm.constanciaCapacitacion
                  : null,
              poderNotarial:
                typeof data.recForm.poderNotarial === "string" ? data.recForm.poderNotarial : null,
              observaciones:
                typeof data.recForm.observaciones === "string" ? data.recForm.observaciones : "",
              ultimaActualizacion:
                typeof data.recForm.ultimaActualizacion === "string"
                  ? data.recForm.ultimaActualizacion
                  : undefined,
            }
          : {}),
      }

      const notificacionesGuardadas = Array.isArray(data.notificacionesElectronicas)
        ? data.notificacionesElectronicas.map((item: Partial<NotificacionElectronica>) => ({
            id: item.id ?? Date.now().toString(),
            asunto: item.asunto ?? "",
            fechaRecepcion: item.fechaRecepcion ?? "",
            fechaLimite: item.fechaLimite ?? "",
            acuseLectura: item.acuseLectura,
            acuseRespuesta: item.acuseRespuesta,
            estado: (item.estado as EstadoNotificacion) ?? "pendiente",
          }))
        : []

      const recordatoriosGuardados = Array.isArray(data.recordatoriosBuzon)
        ? data.recordatoriosBuzon.map((item: Partial<RecordatorioBuzon>) => ({
            id: item.id ?? Date.now().toString(),
            fechaRevision: item.fechaRevision ?? "",
            descripcion: item.descripcion ?? "",
          }))
        : []

      const registroAltaGuardado: RegistroAltaState = {
        fechaAlta: typeof data.registroAlta?.fechaAlta === "string" ? data.registroAlta.fechaAlta : "",
        folioSAT: typeof data.registroAlta?.folioSAT === "string" ? data.registroAlta.folioSAT : "",
        representante:
          typeof data.registroAlta?.representante === "string" ? data.registroAlta.representante : "",
        acuses: Array.isArray(data.registroAlta?.acuses)
          ? (data.registroAlta?.acuses as unknown[]).map((acuse) => String(acuse))
          : [],
      }

      const versionesGuardadas = Array.isArray(data.controlVersiones)
        ? data.controlVersiones.map((item: Partial<ControlVersion>) => ({
            id: item.id ?? Date.now().toString(),
            fecha: item.fecha ?? new Date().toISOString(),
            tipoCambio: item.tipoCambio ?? "",
            detalle: item.detalle ?? "",
          }))
        : []

      setPreguntasState(preguntasGuardadas)
      setDocumentos(documentosGuardados as DocumentUpload[])
      setTrazabilidad(trazabilidadGuardada as TraceabilityEntry[])
      setEvidenciasPorPregunta(evidenciasGuardadas)
      setPasosChecklist(checklistGuardado)
      setAcuseSAT(acuseGuardado)
      setRecForm(recGuardado)
      setNotificacionesElectronicas(notificacionesGuardadas as NotificacionElectronica[])
      setRecordatoriosBuzon(recordatoriosGuardados as RecordatorioBuzon[])
      setRegistroAlta(registroAltaGuardado)
      setControlVersiones(versionesGuardadas as ControlVersion[])
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
      pasosChecklist,
      acuseSAT: {
        ...acuseSAT,
        uploadDate: acuseSAT.uploadDate ? acuseSAT.uploadDate.toISOString() : null,
      },
      recForm,
      notificacionesElectronicas,
      recordatoriosBuzon,
      registroAlta,
      controlVersiones,
    }
    localStorage.setItem("registro-sat-data", JSON.stringify(data))
  }, [
    preguntasState,
    documentos,
    trazabilidad,
    evidenciasPorPregunta,
    pasosChecklist,
    acuseSAT,
    recForm,
    notificacionesElectronicas,
    recordatoriosBuzon,
    registroAlta,
    controlVersiones,
  ])

  const totalChecklistItems = pasosAltaPortal.reduce(
    (acc, paso) => acc + paso.checklist.length,
    0,
  )
  const checklistCompletados = Object.values(pasosChecklist).filter(Boolean).length
  const checklistProgreso = totalChecklistItems
    ? Math.round((checklistCompletados / totalChecklistItems) * 100)
    : 0

  const toggleChecklistItem = (stepId: string, itemId: string) => {
    const key = `${stepId}-${itemId}`
    const paso = pasosAltaPortal.find((item) => item.id === stepId)
    const checklistItem = paso?.checklist.find((item) => item.id === itemId)
    let seMarco = false

    setPasosChecklist((prev) => {
      const nextValue = !(prev[key] ?? false)
      seMarco = nextValue
      if (nextValue) {
        return {
          ...prev,
          [key]: true,
        }
      }

      const { [key]: _omit, ...rest } = prev
      return rest
    })

    if (seMarco && paso && checklistItem) {
      const nuevaEntrada: TraceabilityEntry = {
        id: Date.now().toString(),
        action: "Checklist actualizado",
        user: "Usuario actual",
        timestamp: new Date(),
        details: `${paso.titulo}: ${checklistItem.label}`,
        section: "Automatización del Alta",
      }
      setTrazabilidad((prev) => [nuevaEntrada, ...prev])
    }
  }

  const handleAcuseFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setAcuseSAT((prev) => ({
      ...prev,
      fileName: file?.name ?? null,
      uploadDate: file ? new Date() : prev.uploadDate,
      validado: false,
    }))
    setAcuseSATError(null)
  }

  const handleAcuseSelloChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value.toUpperCase()
    setAcuseSAT((prev) => ({
      ...prev,
      selloDigital: value,
      validado: false,
    }))
    if (acuseSATError) {
      setAcuseSATError(null)
    }
  }

  const obtenerEstadoNotificacion = (
    notificacion: Pick<NotificacionElectronica, "fechaLimite" | "acuseRespuesta">,
  ): EstadoNotificacion => {
    if (notificacion.acuseRespuesta) {
      return "contestada"
    }

    if (notificacion.fechaLimite && new Date(notificacion.fechaLimite).getTime() < Date.now()) {
      return "vencida"
    }

    return "pendiente"
  }

  const handleValidarAcuse = () => {
    if (!acuseSAT.fileName) {
      setAcuseSATError("Adjunta el acuse digital emitido por el SAT.")
      return
    }

    const selloNormalizado = acuseSAT.selloDigital.replace(/\s+/g, "")
    if (selloNormalizado.length < 20 || !/^[A-Z0-9]+$/.test(selloNormalizado)) {
      setAcuseSATError("El sello digital debe contener al menos 20 caracteres alfanuméricos válidos.")
      setAcuseSAT((prev) => ({ ...prev, validado: false }))
      return
    }

    setAcuseSAT((prev) => ({
      ...prev,
      selloDigital: selloNormalizado,
      validado: true,
      uploadDate: prev.uploadDate ?? new Date(),
    }))
    setAcuseSATError(null)

    const fileName = acuseSAT.fileName
    if (fileName) {
      setDocumentos((prev) => {
        if (prev.some((doc) => doc.name === fileName)) {
          return prev
        }
        const nuevoDocumento: DocumentUpload = {
          id: Date.now().toString(),
          name: fileName,
          type: "Acuse digital SAT",
          uploadDate: new Date(),
          status: "vigente",
        }
        return [nuevoDocumento, ...prev]
      })

      setRegistroAlta((prev) => {
        if (prev.acuses.includes(fileName)) {
          return prev
        }
        return {
          ...prev,
          acuses: [...prev.acuses, fileName],
        }
      })

      const nuevaEntrada: TraceabilityEntry = {
        id: Date.now().toString(),
        action: "Acuse validado",
        user: "Usuario actual",
        timestamp: new Date(),
        details: `Se validó el acuse ${fileName} con sello ${selloNormalizado.slice(0, 12)}...`,
        section: "Alta en el Portal PLD",
      }
      setTrazabilidad((prev) => [nuevaEntrada, ...prev])

      toast({
        title: "Acuse validado",
        description: "El sello digital fue verificado y el documento quedó registrado.",
      })
    }
  }

  type RecFileField = "acuseDesignacion" | "acuseAceptacion" | "constanciaCapacitacion" | "poderNotarial"

  const handleRecInputChange = (field: keyof RECFormState, value: string) => {
    setRecForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleRecFileChange = (field: RecFileField, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setRecForm((prev) => ({
      ...prev,
      [field]: file?.name ?? null,
    }))
  }

  const guardarRecForm = () => {
    const camposObligatorios: Array<keyof RECFormState> = [
      "nombre",
      "correo",
      "telefono",
      "fechaDesignacion",
      "fechaUltimaCapacitacion",
    ]

    const archivosObligatorios: RecFileField[] = [
      "acuseDesignacion",
      "acuseAceptacion",
      "constanciaCapacitacion",
      "poderNotarial",
    ]

    const faltantes = camposObligatorios.filter((campo) => !recForm[campo])
    const archivosFaltantes = archivosObligatorios.filter((campo) => !recForm[campo])

    if (faltantes.length > 0 || archivosFaltantes.length > 0) {
      toast({
        title: "Información incompleta",
        description: "Completa la información del REC y adjunta las evidencias obligatorias.",
        variant: "destructive",
      })
      return
    }

    const actualizacion = new Date().toISOString()
    setRecForm((prev) => ({
      ...prev,
      ultimaActualizacion: actualizacion,
    }))

    if (recForm.fechaDesignacion) {
      const proximaRenovacion = new Date(recForm.fechaDesignacion)
      proximaRenovacion.setFullYear(proximaRenovacion.getFullYear() + 1)
      const fechaRevision = proximaRenovacion.toISOString().slice(0, 10)
      setRecordatoriosBuzon((prev) => {
        if (
          prev.some(
            (recordatorio) =>
              recordatorio.descripcion.includes("Renovación del REC") && recordatorio.fechaRevision === fechaRevision,
          )
        ) {
          return prev
        }

        const nuevoRecordatorio: RecordatorioBuzon = {
          id: `${Date.now()}-rec`,
          fechaRevision,
          descripcion: "Renovación del REC y actualización de designación",
        }
        return [nuevoRecordatorio, ...prev]
      })
    }

    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: "REC actualizado",
      user: "Usuario actual",
      timestamp: new Date(),
      details: `Se registró/actualizó la designación del REC ${recForm.nombre}.`,
      section: "Gestión del REC",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])

    toast({
      title: "REC guardado",
      description: "La información del representante encargado quedó registrada con sus evidencias.",
    })
  }

  const registrarNotificacion = () => {
    if (!notificacionDraft.asunto || !notificacionDraft.fechaRecepcion) {
      toast({
        title: "Datos incompletos",
        description: "Captura el asunto y la fecha de recepción de la notificación electrónica.",
        variant: "destructive",
      })
      return
    }

    const fechaRecepcion = new Date(notificacionDraft.fechaRecepcion)
    const fechaLimite = addBusinessDays(fechaRecepcion, 10)

    const nuevaNotificacion: NotificacionElectronica = {
      id: Date.now().toString(),
      asunto: notificacionDraft.asunto,
      fechaRecepcion: notificacionDraft.fechaRecepcion,
      fechaLimite: fechaLimite.toISOString(),
      acuseLectura: notificacionDraft.acuseLectura || undefined,
      acuseRespuesta: notificacionDraft.acuseRespuesta || undefined,
      estado: obtenerEstadoNotificacion({
        fechaLimite: fechaLimite.toISOString(),
        acuseRespuesta: notificacionDraft.acuseRespuesta || undefined,
      }),
    }

    setNotificacionesElectronicas((prev) => [nuevaNotificacion, ...prev])
    setNotificacionDraft({ asunto: "", fechaRecepcion: "", acuseLectura: "", acuseRespuesta: "" })

    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: "Notificación registrada",
      user: "Usuario actual",
      timestamp: new Date(),
      details: `Se registró el aviso "${nuevaNotificacion.asunto}" con plazo al ${formatISODate(
        nuevaNotificacion.fechaLimite,
      )}.`,
      section: "Buzón Tributario",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])

    toast({
      title: "Notificación registrada",
      description: "Se generó el seguimiento con plazo de 10 días hábiles.",
    })
  }

  const actualizarNotificacionCampo = (
    id: string,
    field: "acuseLectura" | "acuseRespuesta",
    value: string,
  ) => {
    setNotificacionesElectronicas((prev) =>
      prev.map((notificacion) => {
        if (notificacion.id !== id) return notificacion
        const updated = {
          ...notificacion,
          [field]: value ? value : undefined,
        }
        return {
          ...updated,
          estado: obtenerEstadoNotificacion(updated),
        }
      }),
    )

    if (value) {
      const detalle =
        field === "acuseLectura"
          ? `Se registró acuse de lectura ${value}.`
          : `Se registró acuse de respuesta ${value}.`
      const nuevaEntrada: TraceabilityEntry = {
        id: Date.now().toString(),
        action: "Seguimiento de notificación",
        user: "Usuario actual",
        timestamp: new Date(),
        details: detalle,
        section: "Buzón Tributario",
      }
      setTrazabilidad((prev) => [nuevaEntrada, ...prev])
    }
  }

  const diasRestantes = (fechaLimite: string) => {
    if (!fechaLimite) return null
    const limite = new Date(fechaLimite)
    const hoy = new Date()
    const diff = Math.ceil((limite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  const agregarRecordatorio = () => {
    if (!recordatorioDraft.fechaRevision) {
      toast({
        title: "Fecha obligatoria",
        description: "Define la fecha para el recordatorio del Buzón Tributario.",
        variant: "destructive",
      })
      return
    }

    const nuevoRecordatorio: RecordatorioBuzon = {
      id: Date.now().toString(),
      fechaRevision: recordatorioDraft.fechaRevision,
      descripcion: recordatorioDraft.descripcion,
    }

    setRecordatoriosBuzon((prev) => [nuevoRecordatorio, ...prev])
    setRecordatorioDraft((prev) => ({ ...prev, fechaRevision: "" }))

    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: "Recordatorio programado",
      user: "Usuario actual",
      timestamp: new Date(),
      details: `Recordatorio del buzón para el ${formatISODate(nuevoRecordatorio.fechaRevision)}: ${
        nuevoRecordatorio.descripcion
      }`,
      section: "Buzón Tributario",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])

    toast({
      title: "Recordatorio agregado",
      description: "Se calendarizó la revisión periódica del buzón.",
    })
  }

  const eliminarRecordatorio = (id: string) => {
    setRecordatoriosBuzon((prev) => prev.filter((recordatorio) => recordatorio.id !== id))
  }

  const actualizarRegistroAltaCampo = (field: keyof RegistroAltaState, value: string) => {
    setRegistroAlta((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const guardarRegistroAlta = () => {
    if (!registroAlta.fechaAlta || !registroAlta.folioSAT || !registroAlta.representante) {
      toast({
        title: "Datos del alta incompletos",
        description: "Captura la fecha de alta, folio SAT y representante registrado.",
        variant: "destructive",
      })
      return
    }

    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: "Alta documentada",
      user: "Usuario actual",
      timestamp: new Date(),
      details: `Alta con folio ${registroAlta.folioSAT} y representante ${registroAlta.representante}.`,
      section: "Trazabilidad documental",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])

    toast({
      title: "Registro del alta guardado",
      description: "La bitácora conserva los datos clave del folio y representante.",
    })
  }

  const agregarAcuseRegistro = () => {
    const acuse = nuevoAcuseRegistro.trim()
    if (!acuse) {
      toast({
        title: "Acuse requerido",
        description: "Indica el folio o referencia del acuse a registrar.",
        variant: "destructive",
      })
      return
    }

    setRegistroAlta((prev) => {
      if (prev.acuses.includes(acuse)) {
        return prev
      }
      return {
        ...prev,
        acuses: [...prev.acuses, acuse],
      }
    })
    setNuevoAcuseRegistro("")

    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: "Acuse incorporado",
      user: "Usuario actual",
      timestamp: new Date(),
      details: `Se agregó el acuse ${acuse} al expediente del alta.`,
      section: "Trazabilidad documental",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])
  }

  const eliminarAcuseRegistro = (acuse: string) => {
    setRegistroAlta((prev) => ({
      ...prev,
      acuses: prev.acuses.filter((item) => item !== acuse),
    }))
  }

  const registrarCambioVersion = () => {
    if (!nuevoCambio.tipoCambio || !nuevoCambio.detalle.trim()) {
      toast({
        title: "Información incompleta",
        description: "Selecciona el tipo de modificación y describe el cambio realizado.",
        variant: "destructive",
      })
      return
    }

    const nuevaVersion: ControlVersion = {
      id: Date.now().toString(),
      fecha: new Date().toISOString(),
      tipoCambio: nuevoCambio.tipoCambio,
      detalle: nuevoCambio.detalle.trim(),
    }

    setControlVersiones((prev) => [nuevaVersion, ...prev])
    setNuevoCambio({ tipoCambio: "", detalle: "" })

    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: "Cambio documentado",
      user: "Usuario actual",
      timestamp: new Date(),
      details: `${nuevoCambio.tipoCambio}: ${nuevoCambio.detalle.trim()}`,
      section: "Control de versiones",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])

    toast({
      title: "Versión registrada",
      description: "Se documentó la modificación en el padrón de actividades vulnerables.",
    })
  }

  const recFechaDesignacion = recForm.fechaDesignacion ? new Date(recForm.fechaDesignacion) : null
  const recRenovacionDate =
    recFechaDesignacion && !Number.isNaN(recFechaDesignacion.getTime())
      ? (() => {
          const date = new Date(recFechaDesignacion)
          date.setFullYear(date.getFullYear() + 1)
          return date
        })()
      : null
  const diasParaRenovacion = recRenovacionDate
    ? Math.ceil((recRenovacionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null
  const capacitacionDate = recForm.fechaUltimaCapacitacion
    ? new Date(recForm.fechaUltimaCapacitacion)
    : null
  const diasDesdeCapacitacion = capacitacionDate
    ? Math.ceil((Date.now() - capacitacionDate.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const capacitacionPorVencer = diasDesdeCapacitacion !== null && diasDesdeCapacitacion >= 335
  const capacitacionVencida = diasDesdeCapacitacion !== null && diasDesdeCapacitacion > 365

  const notificacionesPendientes = notificacionesElectronicas.filter(
    (notificacion) => notificacion.estado !== "contestada",
  )
  const notificacionesVencidas = notificacionesElectronicas.filter(
    (notificacion) => notificacion.estado === "vencida",
  )

  // Actualizar respuesta de pregunta
  const actualizarRespuesta = (id: string, answer: AnswerValue) => {
    const preguntaActual = preguntasState.find((p) => p.id === id)
    const requerimientoSeleccionado = preguntaActual?.requirements?.[answer]

    setPreguntasState((prev) =>
      prev.map((pregunta) => (pregunta.id === id ? { ...pregunta, answer, lastUpdated: new Date() } : pregunta)),
    )

    setEvidenciasPorPregunta((prev) => {
      if (requerimientoSeleccionado?.requiresEvidence) {
        return {
          ...prev,
          [id]: prev[id] ?? [],
        }
      }

      if (prev[id]) {
        const { [id]: _omit, ...rest } = prev
        return rest
      }

      return prev
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
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-primary" />
                Guía paso a paso del Portal PLD
              </CardTitle>
              <CardDescription>
                Completa la lista de verificación documental para automatizar el alta ante el SAT.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">Progreso del checklist</p>
                  <p className="text-xs text-muted-foreground">
                    Elementos completados: {checklistCompletados} de {totalChecklistItems}
                  </p>
                </div>
                <div className="w-full max-w-xs">
                  <Progress value={checklistProgreso} className="h-2" />
                  <p className="mt-1 text-xs text-muted-foreground text-right">{checklistProgreso}% completado</p>
                </div>
              </div>
              <div className="space-y-4">
                {pasosAltaPortal.map((paso, index) => {
                  const completado = paso.checklist.every(
                    (item) => pasosChecklist[`${paso.id}-${item.id}`],
                  )

                  return (
                    <div key={paso.id} className="space-y-4 rounded-lg border p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-2">
                          <Badge variant="secondary" className="w-fit uppercase text-xs">
                            Paso {index + 1}
                          </Badge>
                          <div>
                            <h4 className="text-base font-semibold">{paso.titulo}</h4>
                            <p className="text-sm text-muted-foreground">{paso.descripcion}</p>
                          </div>
                        </div>
                        <Badge
                          variant={completado ? "default" : "outline"}
                          className="flex items-center gap-1"
                        >
                          {completado ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <Clock className="h-3.5 w-3.5" />
                          )}
                          {completado ? "Completado" : "Pendiente"}
                        </Badge>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {paso.checklist.map((item) => {
                          const key = `${paso.id}-${item.id}`
                          const checked = pasosChecklist[key] ?? false

                          return (
                            <label
                              key={item.id}
                              className="flex items-start gap-3 rounded-lg border p-3 transition hover:border-primary"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleChecklistItem(paso.id, item.id)}
                              />
                              <div className="space-y-1">
                                <p className="text-sm font-medium leading-snug">
                                  {item.label}
                                  {item.required && <span className="ml-1 text-destructive">*</span>}
                                </p>
                                {item.helperText && (
                                  <p className="text-xs text-muted-foreground">{item.helperText}</p>
                                )}
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
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
              {preguntasState.map((pregunta, index) => {
                const requirement = pregunta.answer ? pregunta.requirements?.[pregunta.answer] : undefined
                const showEvidenceUpload = Boolean(requirement?.requiresEvidence)
                const evidenceList = requirement?.evidenceHints ?? []

                return (
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
                      Seguimiento de respuesta
                    </p>
                    {pregunta.answer ? (
                      <div className="space-y-4 rounded-lg border border-dashed bg-muted/20 p-4">
                        <div className="space-y-3">
                          <Badge variant="outline" className="w-fit capitalize">
                            Respuesta: {formatAnswer(pregunta.answer)}
                          </Badge>
                          {evidenceList.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Evidencias esperadas</p>
                              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                                {evidenceList.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div
                          className={cn(
                            "grid gap-4",
                            showEvidenceUpload ? "lg:grid-cols-2" : "lg:grid-cols-1",
                          )}
                        >
                          {showEvidenceUpload && (
                            <div className="space-y-3">
                              <Label htmlFor={`evidencia-${pregunta.id}`}>Carga de evidencia</Label>
                              <Input
                                id={`evidencia-${pregunta.id}`}
                                type="file"
                                multiple
                                onChange={(event) => manejarCargaEvidencia(pregunta.id, event)}
                              />
                              {requirement?.evidenceHelperText && (
                                <p className="text-xs text-muted-foreground">
                                  {requirement.evidenceHelperText}
                                </p>
                              )}
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
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="space-y-3">
                            <Label htmlFor={`notas-${pregunta.id}`}>
                              {requirement?.notesLabel ?? "Observaciones y referencias"}
                            </Label>
                            <Textarea
                              id={`notas-${pregunta.id}`}
                              placeholder={
                                requirement?.notesPlaceholder ??
                                "Describe información relevante para esta respuesta."
                              }
                              value={pregunta.notes ?? ""}
                              onChange={(event) => actualizarNotasPregunta(pregunta.id, event.target.value)}
                              className="min-h-[120px]"
                            />
                            <p className="text-xs text-muted-foreground">
                              {requirement?.helperText ??
                                "Esta información se guardará automáticamente para dar seguimiento."}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm italic text-muted-foreground">
                        Selecciona una respuesta para habilitar los campos de seguimiento.
                      </p>
                    )}
                  </div>
                  </motion.div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Carga Documental */}
        <TabsContent value="documentos" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileCheck className="h-5 w-5 text-primary" />
                  Acuse digital obligatorio
                </CardTitle>
                <CardDescription>
                  Carga y valida el acuse emitido por el SAT con su sello digital.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="acuse-sat-file">Archivo del acuse (PDF o XML)</Label>
                  <Input
                    id="acuse-sat-file"
                    type="file"
                    accept=".pdf,.xml"
                    onChange={handleAcuseFileChange}
                  />
                  {acuseSAT.fileName && (
                    <p className="text-xs text-muted-foreground">
                      Archivo seleccionado: {acuseSAT.fileName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acuse-sat-sello">Sello digital</Label>
                  <Textarea
                    id="acuse-sat-sello"
                    value={acuseSAT.selloDigital}
                    onChange={handleAcuseSelloChange}
                    placeholder="Pega el sello digital tal como aparece en el acuse del SAT"
                    className="min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se comprobará que el sello tenga el formato alfanumérico requerido y se registrará en la bitácora.
                  </p>
                </div>
                {acuseSATError && (
                  <Alert variant="destructive">
                    <AlertTitle>Validación pendiente</AlertTitle>
                    <AlertDescription>{acuseSATError}</AlertDescription>
                  </Alert>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={handleValidarAcuse}>
                    Validar sello digital
                  </Button>
                  {acuseSAT.validado && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      Acuse validado
                    </Badge>
                  )}
                  {acuseSAT.uploadDate && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Registrado el {acuseSAT.uploadDate.toLocaleDateString()}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Gestión del Representante Encargado de Cumplimiento
                </CardTitle>
                <CardDescription>
                  Registra los datos y evidencias del REC con seguimiento automático de renovaciones.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="rec-nombre">Nombre completo</Label>
                    <Input
                      id="rec-nombre"
                      value={recForm.nombre}
                      onChange={(event) => handleRecInputChange("nombre", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rec-correo">Correo electrónico</Label>
                    <Input
                      id="rec-correo"
                      type="email"
                      value={recForm.correo}
                      onChange={(event) => handleRecInputChange("correo", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rec-telefono">Teléfono</Label>
                    <Input
                      id="rec-telefono"
                      value={recForm.telefono}
                      onChange={(event) => handleRecInputChange("telefono", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rec-designacion">Fecha de designación</Label>
                    <Input
                      id="rec-designacion"
                      type="date"
                      value={recForm.fechaDesignacion}
                      onChange={(event) => handleRecInputChange("fechaDesignacion", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rec-capacitacion">Fecha de última capacitación anual</Label>
                    <Input
                      id="rec-capacitacion"
                      type="date"
                      value={recForm.fechaUltimaCapacitacion}
                      onChange={(event) =>
                        handleRecInputChange("fechaUltimaCapacitacion", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rec-acuse-designacion">Acuse de designación</Label>
                    <Input
                      id="rec-acuse-designacion"
                      type="file"
                      onChange={(event) => handleRecFileChange("acuseDesignacion", event)}
                    />
                    {recForm.acuseDesignacion && (
                      <p className="text-xs text-muted-foreground">{recForm.acuseDesignacion}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rec-acuse-aceptacion">Acuse de aceptación electrónica</Label>
                    <Input
                      id="rec-acuse-aceptacion"
                      type="file"
                      onChange={(event) => handleRecFileChange("acuseAceptacion", event)}
                    />
                    {recForm.acuseAceptacion && (
                      <p className="text-xs text-muted-foreground">{recForm.acuseAceptacion}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rec-constancia">Constancia anual de capacitación</Label>
                    <Input
                      id="rec-constancia"
                      type="file"
                      onChange={(event) => handleRecFileChange("constanciaCapacitacion", event)}
                    />
                    {recForm.constanciaCapacitacion && (
                      <p className="text-xs text-muted-foreground">{recForm.constanciaCapacitacion}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rec-poder">Poder notarial vigente</Label>
                    <Input
                      id="rec-poder"
                      type="file"
                      onChange={(event) => handleRecFileChange("poderNotarial", event)}
                    />
                    {recForm.poderNotarial && (
                      <p className="text-xs text-muted-foreground">{recForm.poderNotarial}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rec-observaciones">Observaciones y alcance del REC</Label>
                  <Textarea
                    id="rec-observaciones"
                    value={recForm.observaciones}
                    onChange={(event) => handleRecInputChange("observaciones", event.target.value)}
                    placeholder="Incluye notas sobre facultades, cobertura geográfica o suplencias."
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={guardarRecForm}>
                    Guardar información del REC
                  </Button>
                  {recForm.ultimaActualizacion && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Actualizado el {formatISODate(recForm.ultimaActualizacion)}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
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
                Alertas automáticas de vencimientos
              </CardTitle>
              <CardDescription>Vigencia de documentos críticos del alta ante el SAT</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                      <div key={doc.id} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                        <div className="flex items-center gap-3">
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
              {acuseSAT.validado ? (
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertTitle>Acuse digital verificado</AlertTitle>
                  <AlertDescription>
                    El acuse del SAT se encuentra cargado y validado con sello digital.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Acuse pendiente de validación</AlertTitle>
                  <AlertDescription>
                    Registra el acuse digital del alta y valida su sello electrónico para cerrar el proceso.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {recRenovacionDate && diasParaRenovacion !== null && diasParaRenovacion <= 60 && (
            <Alert variant={diasParaRenovacion < 0 ? "destructive" : "default"}>
              <Bell className="h-4 w-4" />
              <AlertTitle>
                Renovación del REC {diasParaRenovacion < 0 ? "vencida" : "próxima"}
              </AlertTitle>
              <AlertDescription>
                {diasParaRenovacion < 0
                  ? `La designación del REC venció el ${recRenovacionDate.toLocaleDateString()}. Actualiza la información cuanto antes.`
                  : `La designación del REC vence el ${recRenovacionDate.toLocaleDateString()}. Restan ${diasParaRenovacion} días para renovar.`}
              </AlertDescription>
            </Alert>
          )}

          {capacitacionDate && (capacitacionPorVencer || capacitacionVencida) && (
            <Alert variant={capacitacionVencida ? "destructive" : "default"}>
              <Bell className="h-4 w-4" />
              <AlertTitle>
                Constancia anual del REC {capacitacionVencida ? "vencida" : "por vencer"}
              </AlertTitle>
              <AlertDescription>
                {capacitacionVencida
                  ? `Han transcurrido ${diasDesdeCapacitacion ?? 0} días desde la última capacitación registrada. Adjunta la constancia vigente.`
                  : `La última capacitación se registró hace ${diasDesdeCapacitacion ?? 0} días. Programa la constancia antes de cumplir el año.`}
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="h-5 w-5 text-primary" />
                Tablero del Buzón Tributario
              </CardTitle>
              <CardDescription>
                Controla acuses de lectura y respuesta con plazo legal de 10 días hábiles.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="notif-asunto">Asunto de la notificación</Label>
                    <Input
                      id="notif-asunto"
                      value={notificacionDraft.asunto}
                      onChange={(event) =>
                        setNotificacionDraft((prev) => ({ ...prev, asunto: event.target.value }))
                      }
                      placeholder="Ej. Requerimiento de información PLD"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notif-recepcion">Fecha de recepción</Label>
                    <Input
                      id="notif-recepcion"
                      type="date"
                      value={notificacionDraft.fechaRecepcion}
                      onChange={(event) =>
                        setNotificacionDraft((prev) => ({
                          ...prev,
                          fechaRecepcion: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notif-lectura">Acuse de lectura</Label>
                    <Input
                      id="notif-lectura"
                      value={notificacionDraft.acuseLectura}
                      onChange={(event) =>
                        setNotificacionDraft((prev) => ({
                          ...prev,
                          acuseLectura: event.target.value,
                        }))
                      }
                      placeholder="Folio o referencia del acuse"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notif-respuesta">Acuse de respuesta</Label>
                    <Input
                      id="notif-respuesta"
                      value={notificacionDraft.acuseRespuesta}
                      onChange={(event) =>
                        setNotificacionDraft((prev) => ({
                          ...prev,
                          acuseRespuesta: event.target.value,
                        }))
                      }
                      placeholder="Folio de la respuesta enviada"
                    />
                  </div>
                  <Button type="button" onClick={registrarNotificacion} className="w-full sm:w-auto">
                    Registrar notificación
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Se calcula automáticamente la fecha límite de atención considerando 10 días hábiles a partir de la recepción.
                  </p>
                  {notificacionesVencidas.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTitle>Notificaciones vencidas</AlertTitle>
                      <AlertDescription>
                        {notificacionesVencidas.length === 1
                          ? "Existe una notificación vencida sin respuesta registrada."
                          : `Existen ${notificacionesVencidas.length} notificaciones vencidas.`}
                      </AlertDescription>
                    </Alert>
                  )}
                  {notificacionesPendientes.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Hay {notificacionesPendientes.length} notificaciones en seguimiento activo.
                    </p>
                  )}
                </div>
                <div className="space-y-4">
                  {notificacionesElectronicas.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                      No hay notificaciones registradas.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {notificacionesElectronicas.map((notificacion) => {
                        const dias = diasRestantes(notificacion.fechaLimite)
                        const estadoVariant =
                          notificacion.estado === "contestada"
                            ? "secondary"
                            : notificacion.estado === "vencida"
                              ? "destructive"
                              : "outline"

                        return (
                          <div key={notificacion.id} className="space-y-3 rounded-lg border p-4">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="font-semibold">{notificacion.asunto}</p>
                                <p className="text-xs text-muted-foreground">
                                  Recibida el {formatISODate(notificacion.fechaRecepcion)} • Límite: {" "}
                                  {formatISODate(notificacion.fechaLimite)}
                                </p>
                              </div>
                              <Badge variant={estadoVariant}>{notificacion.estado}</Badge>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="space-y-1">
                                <Label className="text-xs uppercase text-muted-foreground">Acuse de lectura</Label>
                                <Input
                                  value={notificacion.acuseLectura ?? ""}
                                  onChange={(event) =>
                                    actualizarNotificacionCampo(
                                      notificacion.id,
                                      "acuseLectura",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Ingresa folio de lectura"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs uppercase text-muted-foreground">Acuse de respuesta</Label>
                                <Input
                                  value={notificacion.acuseRespuesta ?? ""}
                                  onChange={(event) =>
                                    actualizarNotificacionCampo(
                                      notificacion.id,
                                      "acuseRespuesta",
                                      event.target.value,
                                    )
                                  }
                                  placeholder="Ingresa folio de respuesta"
                                />
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {dias === null
                                ? "Sin fecha límite calculada"
                                : dias < 0
                                  ? `Vencida hace ${Math.abs(dias)} días`
                                  : `Restan ${dias} días naturales para responder`}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                Recordatorios de revisión del buzón
              </CardTitle>
              <CardDescription>Calendariza la supervisión periódica del Buzón Tributario.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="recordatorio-fecha">Próxima revisión</Label>
                    <Input
                      id="recordatorio-fecha"
                      type="date"
                      value={recordatorioDraft.fechaRevision}
                      onChange={(event) =>
                        setRecordatorioDraft((prev) => ({
                          ...prev,
                          fechaRevision: event.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recordatorio-descripcion">Descripción</Label>
                    <Textarea
                      id="recordatorio-descripcion"
                      value={recordatorioDraft.descripcion}
                      onChange={(event) =>
                        setRecordatorioDraft((prev) => ({
                          ...prev,
                          descripcion: event.target.value,
                        }))
                      }
                      rows={3}
                    />
                  </div>
                  <Button type="button" onClick={agregarRecordatorio} className="w-full sm:w-auto">
                    Agregar recordatorio
                  </Button>
                </div>
                <div className="space-y-3">
                  {recordatoriosBuzon.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                      No se han programado recordatorios.
                    </div>
                  ) : (
                    recordatoriosBuzon.map((recordatorio) => (
                      <div key={recordatorio.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <CalendarDays className="h-5 w-5 text-primary" />
                          <div>
                            <p className="text-sm font-medium">{formatISODate(recordatorio.fechaRevision)}</p>
                            <p className="text-xs text-muted-foreground">{recordatorio.descripcion}</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => eliminarRecordatorio(recordatorio.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Bitácora de Trazabilidad */}
        <TabsContent value="trazabilidad" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Registro documental del alta
                </CardTitle>
                <CardDescription>Conserva folio SAT, representante y acuses asociados.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="registro-fecha">Fecha de alta</Label>
                    <Input
                      id="registro-fecha"
                      type="date"
                      value={registroAlta.fechaAlta}
                      onChange={(event) => actualizarRegistroAltaCampo("fechaAlta", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registro-folio">Folio SAT</Label>
                    <Input
                      id="registro-folio"
                      value={registroAlta.folioSAT}
                      onChange={(event) => actualizarRegistroAltaCampo("folioSAT", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registro-representante">Representante registrado</Label>
                    <Input
                      id="registro-representante"
                      value={registroAlta.representante}
                      onChange={(event) =>
                        actualizarRegistroAltaCampo("representante", event.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={nuevoAcuseRegistro}
                    onChange={(event) => setNuevoAcuseRegistro(event.target.value)}
                    placeholder="Folio o referencia de acuse emitido por el SAT"
                  />
                  <Button type="button" variant="outline" onClick={agregarAcuseRegistro}>
                    Agregar acuse
                  </Button>
                </div>
                {registroAlta.acuses.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Acuses registrados</p>
                    <div className="flex flex-wrap gap-2">
                      {registroAlta.acuses.map((acuse) => (
                        <Badge key={acuse} variant="secondary" className="flex items-center gap-1">
                          <Paperclip className="h-3.5 w-3.5" />
                          <span>{acuse}</span>
                          <button
                            type="button"
                            onClick={() => eliminarAcuseRegistro(acuse)}
                            className="rounded-full p-1 text-muted-foreground transition hover:bg-muted"
                            aria-label={`Eliminar ${acuse}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <Button type="button" onClick={guardarRegistroAlta} className="w-full sm:w-auto">
                  Guardar datos del alta
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCcw className="h-5 w-5 text-primary" />
                  Control de versiones del padrón
                </CardTitle>
                <CardDescription>Documenta cambios de domicilio, actividad o representante.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de modificación</Label>
                  <Select
                    value={nuevoCambio.tipoCambio}
                    onValueChange={(value) => setNuevoCambio((prev) => ({ ...prev, tipoCambio: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una opción" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cambio de domicilio">Cambio de domicilio</SelectItem>
                      <SelectItem value="Cambio de actividad vulnerable">Cambio de actividad vulnerable</SelectItem>
                      <SelectItem value="Cambio de representante">Cambio de representante</SelectItem>
                      <SelectItem value="Actualización de datos generales">Actualización de datos generales</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Detalle del cambio</Label>
                  <Textarea
                    value={nuevoCambio.detalle}
                    onChange={(event) => setNuevoCambio((prev) => ({ ...prev, detalle: event.target.value }))}
                    placeholder="Describe qué se modificó y la fecha de entrada en vigor."
                    rows={4}
                  />
                </div>
                <Button type="button" onClick={registrarCambioVersion} className="w-full sm:w-auto">
                  Registrar modificación
                </Button>
                <div className="space-y-3">
                  {controlVersiones.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Las actualizaciones realizadas aparecerán aquí con su sello de tiempo.
                    </p>
                  ) : (
                    controlVersiones.map((version) => (
                      <div key={version.id} className="space-y-1 rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{version.tipoCambio}</span>
                          <Badge variant="outline">{formatISODate(version.fecha)}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{version.detalle}</p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Bitácora de trazabilidad con sello de tiempo
              </CardTitle>
              <CardDescription>Registro completo de todas las acciones realizadas en el módulo.</CardDescription>
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
