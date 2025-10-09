"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
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
  Users,
  Building,
  Shield,
  Globe,
  FileCheck,
  Calendar,
  Bell,
  ClipboardList,
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
  options?: ChecklistOption[]
  selectedOptions?: string[]
  evidenceNote?: string
}

interface ChecklistOption {
  id: string
  label: string
  validityDays?: number
}

interface DocumentUpload {
  id: string
  name: string
  type: string
  uploadDate: Date
  expiryDate?: Date
  status: "vigente" | "por-vencer" | "vencido"
  url?: string
  category?: string
}

interface TraceabilityEntry {
  id: string
  action: string
  user: string
  timestamp: Date
  details: string
  section: string
}

interface ClientFormField {
  id: string
  label: string
  options: ChecklistOption[]
  evidenceNote: string
}

interface ClientFormSection {
  id: string
  title: string
  description: string
  fields: ClientFormField[]
}

type ClientTypeKey = "personaFisica" | "personaMoral" | "personaExtranjera" | "fideicomiso"

interface ScreeningData {
  declaration: "si" | "no" | "no-aplica" | null
  type?: "nacional" | "extranjero"
  sourceOfFunds?: string
  lastScreening?: string
  listsChecked: string[]
}

interface ExpedienteInfo {
  lastUpdate?: string
  nextUpdate?: string
  retentionAcknowledged: boolean
  roleBasedAccess?: boolean
  timestampedRepository?: boolean
  lockedOnClosure?: boolean
}

// Preguntas generales del módulo alineadas al nuevo listado normativo
const preguntasGenerales: ChecklistItem[] = [
  // 1. Identificación del Cliente
  {
    id: "kyc-1",
    question: "¿Se obtuvo y archivó la identificación oficial vigente del cliente?",
    answer: null,
    required: true,
    options: [
      { id: "ine", label: "INE" },
      { id: "pasaporte", label: "Pasaporte" },
      { id: "documento-migratorio", label: "Documento migratorio (FM2/FM3 o tarjeta de residente)" },
      { id: "otro", label: "Otro" },
    ],
    evidenceNote: "Evidencia: copia digital legible y vigente de identificación",
  },
  {
    id: "kyc-2",
    question: "¿El comprobante de domicilio corresponde a documento expedido en los últimos 3 meses?",
    answer: null,
    required: true,
    options: [
      { id: "recibo-servicios", label: "Recibo de servicios (agua, luz, teléfono, predial)", validityDays: 90 },
      { id: "estado-cuenta", label: "Estado de cuenta bancario", validityDays: 90 },
      {
        id: "constancia-residencia",
        label: "Constancia de residencia emitida por autoridad competente",
        validityDays: 90,
      },
    ],
    evidenceNote: "Evidencia: copia digital con fecha visible",
  },
  {
    id: "kyc-3",
    question: "¿Se recabó y verificó el RFC y CURP (si aplica)?",
    answer: null,
    required: true,
    options: [
      { id: "constancia-fiscal", label: "Constancia de situación fiscal SAT" },
      { id: "curp", label: "Documento oficial de CURP" },
    ],
    evidenceNote: "Evidencia: constancia fiscal o captura de portal SAT",
  },

  // 2. Personas Morales
  {
    id: "kyc-5",
    question: "¿Se obtuvo acta constitutiva y estatutos sociales vigentes inscritos en RPC?",
    answer: null,
    required: true,
    options: [
      { id: "acta-constitutiva", label: "Sí, adjuntar copia certificada" },
      { id: "acta-pendiente", label: "No, levantar nota de pendiente" },
    ],
  },
  {
    id: "kyc-6",
    question: "¿Se cuenta con el poder notarial del representante legal?",
    answer: null,
    required: true,
    options: [
      { id: "poder-general", label: "General para actos de administración" },
      { id: "poder-especial", label: "Especial" },
    ],
    evidenceNote: "Evidencia: copia certificada del poder",
  },
  {
    id: "kyc-7",
    question: "¿Se obtuvo identificación vigente del representante legal?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-8",
    question: "¿Se identificó la estructura societaria y lista de socios/accionistas vigentes?",
    answer: null,
    required: true,
  },

  // 3. Beneficiario Controlador
  {
    id: "kyc-9",
    question: "¿Se recabó declaración firmada sobre existencia de beneficiario controlador?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-10",
    question:
      "¿Se identificó a las personas con participación directa o indirecta ≥ 50% o con control efectivo?",
    answer: null,
    required: true,
    options: [
      { id: "organigrama", label: "Sí, adjuntar organigrama" },
      { id: "acta-socios", label: "Sí, adjuntar acta de socios/accionistas" },
      { id: "no-aplica", label: "No aplica" },
    ],
  },
  {
    id: "kyc-11",
    question: "¿Se actualizó la información de beneficiario controlador en el último año?",
    answer: null,
    required: true,
  },

  // 4. Personas Políticamente Expuestas (PEP)
  {
    id: "kyc-12",
    question: "¿El cliente declaró ser PEP o familiar cercano de PEP?",
    answer: null,
    required: true,
    options: [
      { id: "pep-nacional", label: "Sí, nacional" },
      { id: "pep-extranjero", label: "Sí, extranjero" },
      { id: "pep-no", label: "No" },
    ],
  },
  {
    id: "kyc-13",
    question: "¿Se documentó la fuente de recursos en caso de PEP?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-14",
    question: "¿Se integró evidencia adicional de control reforzado para clientes PEP?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-15",
    question: "¿Se documentó el resultado del screening en listas restrictivas y de PEP?",
    answer: null,
    required: true,
  },

  // 5. Fideicomisos
  {
    id: "kyc-16",
    question:
      "¿Se obtuvo contrato de fideicomiso inscrito en RPC y se identificaron las partes con documentos vigentes?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-17",
    question: "¿Se identificaron fideicomitente, fiduciario y fideicomisario con RFC correspondiente?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-18",
    question: "¿Se recabó información del beneficiario final del fideicomiso?",
    answer: null,
    required: true,
  },

  // 6. Actualización y Conservación
  {
    id: "kyc-19",
    question: "¿El expediente KYC está completo y digitalizado conforme al anexo aplicable?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-20",
    question: "¿Se actualizó la información del cliente dentro del plazo anual o cuando hubo cambios?",
    answer: null,
    required: true,
  },
  {
    id: "kyc-21",
    question: "¿Se conserva la documentación mínima de 5 años conforme a LFPIORPI?",
    answer: null,
    required: true,
  },
]

// Evidencias requeridas por categoría
const evidenciasGenerales = [
  "Identificación oficial vigente (INE, pasaporte, FM2/FM3, tarjeta de residente)",
  "Comprobante de domicilio ≤ 3 meses",
  "RFC (constancia de situación fiscal SAT)",
  "CURP (para personas físicas)",
  "Declaración firmada de beneficiario controlador",
  "Captura o reporte de screening en listas restrictivas y PEP",
]

const evidenciasPersonasFisicas = [
  "Identificación oficial vigente",
  "CURP",
  "RFC",
  "Comprobante de domicilio ≤ 3 meses",
  "Ocupación o actividad económica",
  "Declaración sobre beneficiario controlador (si aplica)",
]

const evidenciasPersonasMorales = [
  "Acta constitutiva y estatutos inscritos en RPC",
  "Poder notarial vigente del representante legal",
  "Identificación oficial del representante legal",
  "Comprobante de domicilio fiscal y/o social",
  "Lista de socios o accionistas",
  "Organigrama societario actualizado",
  "Declaración de beneficiario controlador",
]

const evidenciasPersonasExtranjeras = [
  "Identificación oficial válida en su país",
  "Pasaporte vigente",
  "Documento migratorio FM2/FM3 o tarjeta de residencia",
  "Comprobante de domicilio en México o en el extranjero",
  "RFC (si aplica)",
  "Declaración de beneficiario controlador",
]

const evidenciasFideicomisos = [
  "Contrato de fideicomiso inscrito en RPC",
  "Identificación oficial de fideicomitente",
  "Identificación oficial de fiduciario",
  "Identificación oficial de fideicomisario",
  "RFC de las partes",
  "Declaración de beneficiario controlador del fideicomiso",
  "Documentos que acrediten aportaciones o derechos fideicomitidos",
]

const evidenciasBeneficiarioControlador = [
  "Declaración firmada sobre la existencia de beneficiario controlador",
  "Organigrama societario",
  "Actas de socios o asamblea donde conste participación",
  "Identificación oficial del beneficiario controlador",
  "Evidencia de actualización anual de la información",
]

const evidenciasPEP = [
  "Declaración del cliente sobre condición de PEP",
  "Identificación del PEP o familiar cercano",
  "Declaración sobre origen de los recursos",
  "Evidencias adicionales de control reforzado",
]

const evidenciasActualizacion = [
  "Checklist de expediente completo firmado por área de cumplimiento",
  "Registro de fecha de apertura del expediente",
  "Registro de última actualización anual",
  "Bitácora de modificaciones",
  "Evidencia de conservación mínima de 5 años",
]

const clientTypeForms: Record<ClientTypeKey, { label: string; sections: ClientFormSection[] }> = {
  personaFisica: {
    label: "Persona Física",
    sections: [
      {
        id: "pf-identificacion",
        title: "Identificación del Cliente",
        description: "Captura y valida la documentación obligatoria para personas físicas (Anexo 3 RCG)",
        fields: [
          {
            id: "pf-identificacion",
            label: "Identificación oficial vigente",
            options: [
              { id: "pf-ine", label: "INE" },
              { id: "pf-pasaporte", label: "Pasaporte" },
              { id: "pf-residente", label: "Tarjeta de residente" },
            ],
            evidenceNote: "Adjuntar identificación vigente",
          },
          {
            id: "pf-curp-rfc",
            label: "CURP y RFC",
            options: [
              { id: "pf-curp", label: "CURP" },
              { id: "pf-rfc", label: "RFC" },
            ],
            evidenceNote: "Agregar constancia fiscal o documento oficial",
          },
          {
            id: "pf-domicilio",
            label: "Comprobante de domicilio ≤ 3 meses",
            options: [
              { id: "pf-recibo", label: "Recibo de servicios", validityDays: 90 },
              { id: "pf-estado-cuenta", label: "Estado de cuenta", validityDays: 90 },
            ],
            evidenceNote: "Subir comprobante con fecha visible",
          },
          {
            id: "pf-actividad",
            label: "Ocupación o actividad económica",
            options: [
              { id: "pf-declaracion", label: "Declaración firmada" },
              { id: "pf-constancia", label: "Constancia emitida" },
            ],
            evidenceNote: "Documentar origen de recursos",
          },
        ],
      },
    ],
  },
  personaMoral: {
    label: "Persona Moral",
    sections: [
      {
        id: "pm-constitucion",
        title: "Documentación Legal",
        description: "Documentos obligatorios de constitución y representación (Anexos 4 y 4 Bis RCG)",
        fields: [
          {
            id: "pm-acta",
            label: "Acta constitutiva y estatutos vigentes",
            options: [
              { id: "pm-acta", label: "Acta constitutiva certificada" },
              { id: "pm-estatutos", label: "Estatutos actualizados" },
            ],
            evidenceNote: "Adjuntar documentos inscritos en RPC",
          },
          {
            id: "pm-poder",
            label: "Poder notarial del representante legal",
            options: [
              { id: "pm-general", label: "General para actos de administración" },
              { id: "pm-especial", label: "Especial (especificar)" },
            ],
            evidenceNote: "Subir copia certificada del poder",
          },
          {
            id: "pm-representante",
            label: "Identificación vigente del representante legal",
            options: [
              { id: "pm-ine", label: "INE" },
              { id: "pm-pasaporte", label: "Pasaporte" },
            ],
            evidenceNote: "Agregar identificación vigente",
          },
          {
            id: "pm-accionistas",
            label: "Lista de socios/accionistas y organigrama",
            options: [
              { id: "pm-lista", label: "Lista actualizada de socios" },
              { id: "pm-organigrama", label: "Organigrama societario" },
            ],
            evidenceNote: "Cargar documentos que acrediten la estructura",
          },
        ],
      },
    ],
  },
  personaExtranjera: {
    label: "Persona Extranjera",
    sections: [
      {
        id: "pe-documentos",
        title: "Documentos de identificación",
        description: "Documentación requerida para personas extranjeras (Anexos 5 y 6 RCG)",
        fields: [
          {
            id: "pe-identificacion",
            label: "Identificación oficial válida en su país",
            options: [
              { id: "pe-id", label: "Identificación oficial del país de origen" },
            ],
            evidenceNote: "Agregar identificación vigente",
          },
          {
            id: "pe-pasaporte",
            label: "Pasaporte vigente",
            options: [
              { id: "pe-pasaporte", label: "Pasaporte" },
            ],
            evidenceNote: "Adjuntar pasaporte con vigencia activa",
          },
          {
            id: "pe-migratorio",
            label: "Documento migratorio o tarjeta de residencia",
            options: [
              { id: "pe-fm2", label: "FM2/FM3" },
              { id: "pe-residente", label: "Tarjeta de residencia" },
            ],
            evidenceNote: "Cargar documento migratorio vigente",
          },
          {
            id: "pe-domicilio",
            label: "Comprobante de domicilio",
            options: [
              { id: "pe-mx", label: "Domicilio en México" },
              { id: "pe-extranjero", label: "Domicilio en el extranjero" },
            ],
            evidenceNote: "Adjuntar comprobante con vigencia ≤ 3 meses",
          },
        ],
      },
    ],
  },
  fideicomiso: {
    label: "Fideicomiso",
    sections: [
      {
        id: "fid-documentos",
        title: "Documentación del fideicomiso",
        description: "Documentos obligatorios conforme al Anexo 8 RCG",
        fields: [
          {
            id: "fid-contrato",
            label: "Contrato de fideicomiso inscrito en RPC",
            options: [
              { id: "fid-contrato", label: "Contrato inscrito" },
            ],
            evidenceNote: "Adjuntar contrato vigente",
          },
          {
            id: "fid-partes",
            label: "Identificación de las partes (fideicomitente, fiduciario, fideicomisario)",
            options: [
              { id: "fid-fideicomitente", label: "Identificación fideicomitente" },
              { id: "fid-fiduciario", label: "Identificación fiduciario" },
              { id: "fid-fideicomisario", label: "Identificación fideicomisario" },
            ],
            evidenceNote: "Subir identificaciones vigentes",
          },
          {
            id: "fid-rfc",
            label: "RFC de las partes",
            options: [
              { id: "fid-rfc-fideicomitente", label: "RFC fideicomitente" },
              { id: "fid-rfc-fiduciario", label: "RFC fiduciario" },
              { id: "fid-rfc-fideicomisario", label: "RFC fideicomisario" },
            ],
            evidenceNote: "Incorporar constancias fiscales",
          },
          {
            id: "fid-beneficiario",
            label: "Declaración de beneficiario controlador",
            options: [
              { id: "fid-declaracion", label: "Declaración firmada" },
            ],
            evidenceNote: "Adjuntar declaración de beneficiario controlador",
          },
        ],
      },
    ],
  },
}

const listasRestrictivas = ["UIF", "OFAC", "ONU", "EU", "PEP"]

const documentoVigencias: Record<string, number> = {
  "Comprobante de domicilio ≤ 3 meses": 90,
  "Comprobante de domicilio en México o en el extranjero": 90,
  "Comprobante de domicilio ≤ 3 meses (recibo de servicios, estado de cuenta, constancia de residencia)": 90,
}

export default function KYCExpedientePage() {
  const { toast } = useToast()
  const [preguntasState, setPreguntasState] = useState<ChecklistItem[]>(
    preguntasGenerales.map((pregunta) => ({ ...pregunta, selectedOptions: pregunta.selectedOptions ?? [] })),
  )
  const [documentos, setDocumentos] = useState<DocumentUpload[]>([])
  const [trazabilidad, setTrazabilidad] = useState<TraceabilityEntry[]>([])
  const [progreso, setProgreso] = useState(0)
  const [activeTab, setActiveTab] = useState("formularios")
  const [clientType, setClientType] = useState<ClientTypeKey>("personaFisica")
  const [formResponses, setFormResponses] = useState<Record<string, string[]>>({})
  const [screeningData, setScreeningData] = useState<ScreeningData>({
    declaration: null,
    listsChecked: [],
  })
  const [expedienteInfo, setExpedienteInfo] = useState<ExpedienteInfo>({
    retentionAcknowledged: false,
    roleBasedAccess: true,
    timestampedRepository: true,
    lockedOnClosure: false,
  })

  // Cargar datos del localStorage
  useEffect(() => {
    const savedData = localStorage.getItem("kyc-expediente-data")
    if (savedData) {
      try {
        const data = JSON.parse(savedData)

        if (data.preguntas) {
          setPreguntasState(
            data.preguntas.map((pregunta: ChecklistItem) => ({
              ...pregunta,
              lastUpdated: pregunta.lastUpdated ? new Date(pregunta.lastUpdated) : undefined,
              selectedOptions: pregunta.selectedOptions ?? [],
            })),
          )
        }

        if (data.documentos) {
          setDocumentos(
            data.documentos.map((doc: DocumentUpload) => ({
              ...doc,
              uploadDate: new Date(doc.uploadDate),
              expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : undefined,
            })),
          )
        }

        if (data.trazabilidad) {
          setTrazabilidad(
            data.trazabilidad.map((entry: TraceabilityEntry) => ({
              ...entry,
              timestamp: new Date(entry.timestamp),
            })),
          )
        }

        if (data.clientType) {
          setClientType(data.clientType)
        }

        if (data.formResponses) {
          setFormResponses(data.formResponses)
        }

        if (data.screeningData) {
          setScreeningData((prev) => ({
            ...prev,
            ...data.screeningData,
            listsChecked: data.screeningData.listsChecked || [],
          }))
        }

        if (data.expedienteInfo) {
          setExpedienteInfo((prev) => ({
            ...prev,
            ...data.expedienteInfo,
          }))
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
    const data = {
      preguntas: preguntasState,
      documentos,
      trazabilidad,
      clientType,
      formResponses,
      screeningData,
      expedienteInfo,
    }
    localStorage.setItem("kyc-expediente-data", JSON.stringify(data))
  }, [preguntasState, documentos, trazabilidad, clientType, formResponses, screeningData, expedienteInfo])

  // Actualizar respuesta de pregunta
  const actualizarRespuesta = (id: string, answer: "si" | "no" | "no-aplica", notes?: string) => {
    const preguntaReferencia = preguntasState.find((p) => p.id === id)

    setPreguntasState((prev) =>
      prev.map((pregunta) =>
        pregunta.id === id
          ? {
              ...pregunta,
              answer,
              notes: notes ?? pregunta.notes,
              lastUpdated: new Date(),
            }
          : pregunta,
      ),
    )

    // Agregar entrada de trazabilidad
    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: "Respuesta actualizada",
      user: "Usuario actual",
      timestamp: new Date(),
      details: `Pregunta: ${preguntaReferencia?.question.substring(0, 80)} - Respuesta: ${answer}`,
      section: "Preguntas normativas",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])

    toast({
      title: "Respuesta guardada",
      description: "La respuesta ha sido registrada correctamente.",
    })
  }

  const toggleChecklistOption = (questionId: string, option: ChecklistOption) => {
    const preguntaReferencia = preguntasState.find((p) => p.id === questionId)
    const wasSelected = preguntaReferencia?.selectedOptions?.includes(option.id)

    setPreguntasState((prev) =>
      prev.map((pregunta) => {
        if (pregunta.id !== questionId) return pregunta

        const current = new Set(pregunta.selectedOptions ?? [])
        if (current.has(option.id)) {
          current.delete(option.id)
        } else {
          current.add(option.id)
        }

        return {
          ...pregunta,
          selectedOptions: Array.from(current),
          lastUpdated: new Date(),
        }
      }),
    )

    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: wasSelected ? "Opción desmarcada" : "Opción marcada",
      user: "Usuario actual",
      timestamp: new Date(),
      details: `Pregunta: ${preguntaReferencia?.question.substring(0, 80)} - Opción: ${option.label}`,
      section: "Preguntas normativas",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])
  }

  const handleFormOptionToggle = (
    fieldId: string,
    option: ChecklistOption,
    sectionTitle: string,
    fieldLabel: string,
  ) => {
    const currentSelections = formResponses[fieldId] ?? []
    const wasSelected = currentSelections.includes(option.id)

    setFormResponses((prev) => {
      const updated = new Set(prev[fieldId] ?? [])
      if (updated.has(option.id)) {
        updated.delete(option.id)
      } else {
        updated.add(option.id)
      }

      return {
        ...prev,
        [fieldId]: Array.from(updated),
      }
    })

    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: wasSelected ? "Opción desmarcada" : "Opción seleccionada",
      user: "Usuario actual",
      timestamp: new Date(),
      details: `Formulario (${sectionTitle}) - Campo: ${fieldLabel} - Opción: ${option.label}`,
      section: "Formularios dinámicos",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])
  }

  // Simular carga de documento
  const cargarDocumento = (tipo: string, validityDays?: number, category?: string) => {
    const resolvedValidityDays =
      validityDays ??
      documentoVigencias[tipo] ??
      (tipo.toLowerCase().includes("≤ 3 meses") || tipo.toLowerCase().includes("<= 3 meses") ? 90 : undefined)

    const nuevoDocumento: DocumentUpload = {
      id: Date.now().toString(),
      name: `Documento_${tipo}_${Date.now()}.pdf`,
      type: tipo,
      uploadDate: new Date(),
      expiryDate: resolvedValidityDays
        ? new Date(Date.now() + resolvedValidityDays * 24 * 60 * 60 * 1000)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      status: "vigente",
      category,
    }

    setDocumentos((prev) => [...prev, nuevoDocumento])

    // Agregar entrada de trazabilidad
    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: "Documento cargado",
      user: "Usuario actual",
      timestamp: new Date(),
      details: `Documento: ${nuevoDocumento.name} - Tipo: ${tipo}${category ? ` - Categoría: ${category}` : ""}`,
      section: category ?? "Carga documental",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])

    toast({
      title: "Documento cargado",
      description: `El documento ${nuevoDocumento.name} ha sido cargado exitosamente.`,
    })
  }

  const actualizarExpedienteInfo = (
    field: keyof ExpedienteInfo,
    value: string | boolean | undefined,
    actionLabel: string,
  ) => {
    setExpedienteInfo((prev) => ({
      ...prev,
      [field]: value,
    }))

    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: actionLabel,
      user: "Usuario actual",
      timestamp: new Date(),
      details: `Campo ${field} actualizado a ${typeof value === "boolean" ? (value ? "Sí" : "No") : value ?? ""}`,
      section: "Actualización y conservación",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])
  }

  const actualizarDeclaracionPep = (value: ScreeningData["declaration"], type?: ScreeningData["type"]) => {
    setScreeningData((prev) => ({
      ...prev,
      declaration: value,
      type: type ?? prev.type,
    }))

    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: "Declaración PEP actualizada",
      user: "Usuario actual",
      timestamp: new Date(),
      details: `Declaración PEP: ${value ?? "sin respuesta"}${type ? ` - Tipo: ${type}` : ""}`,
      section: "Beneficiario controlador y PEP",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])
  }

  const toggleListaRestrictiva = (lista: string) => {
    const wasSelected = screeningData.listsChecked.includes(lista)
    setScreeningData((prev) => ({
      ...prev,
      listsChecked: wasSelected
        ? prev.listsChecked.filter((item) => item !== lista)
        : [...prev.listsChecked, lista],
    }))

    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: wasSelected ? "Lista removida" : "Lista consultada",
      user: "Usuario actual",
      timestamp: new Date(),
      details: `Lista: ${lista}`,
      section: "Beneficiario controlador y PEP",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])
  }

  const registrarFuenteRecursos = (valor: string) => {
    setScreeningData((prev) => ({
      ...prev,
      sourceOfFunds: valor,
    }))
  }

  const registrarFechaScreening = (valor: string) => {
    setScreeningData((prev) => ({
      ...prev,
      lastScreening: valor,
    }))
  }

  const manejarGeneracionExpediente = () => {
    toast({
      title: "Expediente generado",
      description: "Se generó un expediente digital con índice automático para auditorías.",
    })

    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: "Expediente PDF generado",
      user: "Usuario actual",
      timestamp: new Date(),
      details: "Se emitió expediente completo en PDF para atención a auditorías",
      section: "Soporte a auditorías",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])
  }

  const programarAlertaActualizacion = () => {
    toast({
      title: "Alerta programada",
      description: "Se configuró la alerta automática para la actualización anual del expediente.",
    })

    const nuevaEntrada: TraceabilityEntry = {
      id: Date.now().toString(),
      action: "Alerta de actualización programada",
      user: "Usuario actual",
      timestamp: new Date(),
      details: "Se registró recordatorio para actualización anual del expediente KYC",
      section: "Actualización y conservación",
    }
    setTrazabilidad((prev) => [nuevaEntrada, ...prev])
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

  const evidenciasPorTipo = useMemo(() => {
    const base = new Set<string>(evidenciasGenerales)

    switch (clientType) {
      case "personaFisica":
        evidenciasPersonasFisicas.forEach((item) => base.add(item))
        break
      case "personaMoral":
        evidenciasPersonasMorales.forEach((item) => base.add(item))
        evidenciasBeneficiarioControlador.forEach((item) => base.add(item))
        break
      case "personaExtranjera":
        evidenciasPersonasExtranjeras.forEach((item) => base.add(item))
        break
      case "fideicomiso":
        evidenciasFideicomisos.forEach((item) => base.add(item))
        evidenciasBeneficiarioControlador.forEach((item) => base.add(item))
        break
    }

    return Array.from(base)
  }, [clientType])

  const expedienteStatus = useMemo(() => {
    const requiredSet = new Set(evidenciasPorTipo)
    const uploaded = documentos.filter((doc) => requiredSet.has(doc.type))
    const uploadedTypes = new Set(uploaded.map((doc) => doc.type))
    const missing = evidenciasPorTipo.filter((doc) => !uploadedTypes.has(doc))

    if (missing.length > 0) {
      return "critico"
    }

    if (uploaded.some((doc) => getDocumentStatus(doc) === "vencido")) {
      return "critico"
    }

    if (uploaded.some((doc) => getDocumentStatus(doc) === "por-vencer")) {
      return "pendiente"
    }

    return "completo"
  }, [documentos, evidenciasPorTipo])

  const expedienteStatusConfig: Record<
    "completo" | "pendiente" | "critico",
    { label: string; className: string }
  > = {
    completo: {
      label: "Semáforo: expediente completo",
      className: "border-green-200 bg-green-50 text-green-700",
    },
    pendiente: {
      label: "Semáforo: faltantes próximos a vencer",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    critico: {
      label: "Semáforo: faltantes críticos",
      className: "border-red-200 bg-red-50 text-red-700",
    },
  }

  const completionRate = useMemo(() => {
    if (evidenciasPorTipo.length === 0) return 0
    const requiredSet = new Set(evidenciasPorTipo)
    const uploadedTypes = new Set(documentos.filter((doc) => requiredSet.has(doc.type)).map((doc) => doc.type))
    return Math.round((uploadedTypes.size / evidenciasPorTipo.length) * 100)
  }, [documentos, evidenciasPorTipo])

  const documentosVencidos = useMemo(
    () => documentos.filter((doc) => getDocumentStatus(doc) === "vencido").length,
    [documentos],
  )

  const documentosPorVencer = useMemo(
    () => documentos.filter((doc) => getDocumentStatus(doc) === "por-vencer").length,
    [documentos],
  )

  const pepDetectados = screeningData.declaration === "si" ? 1 : 0

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
            <div
              className={`mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${expedienteStatusConfig[expedienteStatus].className}`}
            >
              <Target className="h-3 w-3" />
              {expedienteStatusConfig[expedienteStatus].label}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="formularios" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Formularios dinámicos
          </TabsTrigger>
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

        {/* Tab: Formularios dinámicos */}
        <TabsContent value="formularios" className="space-y-6">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Selecciona el tipo de cliente
              </CardTitle>
              <CardDescription>
                Configura formularios específicos conforme a los anexos de las RCG.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(Object.entries(clientTypeForms) as [ClientTypeKey, { label: string }][]).map(
                  ([key, value]) => (
                    <Button
                      key={key}
                      variant={clientType === key ? "default" : "outline"}
                      onClick={() => setClientType(key)}
                    >
                      {value.label}
                    </Button>
                  ),
                )}
              </div>
              <div
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${expedienteStatusConfig[expedienteStatus].className}`}
              >
                <Target className="h-4 w-4" />
                {expedienteStatusConfig[expedienteStatus].label}
              </div>
            </CardContent>
          </Card>

          {clientTypeForms[clientType].sections.map((section) => (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  {section.title}
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {section.fields.map((field) => (
                  <div key={field.id} className="space-y-3 rounded-lg border p-4">
                    <div className="flex flex-col gap-2">
                      <Label className="text-sm font-medium">{field.label}</Label>
                      <div className="space-y-2">
                        {field.options.map((option) => {
                          const checkboxId = `${field.id}-${option.id}`
                          const checked = (formResponses[field.id] || []).includes(option.id)
                          return (
                            <div
                              key={option.id}
                              className="flex flex-col gap-3 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <Checkbox
                                  id={checkboxId}
                                  checked={checked}
                                  onCheckedChange={() =>
                                    handleFormOptionToggle(field.id, option, section.title, field.label)
                                  }
                                />
                                <Label htmlFor={checkboxId} className="text-sm">
                                  {option.label}
                                </Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    cargarDocumento(option.label, option.validityDays, section.title)
                                  }
                                >
                                  <Upload className="h-3 w-3" />
                                  Adjuntar evidencia
                                </Button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">{field.evidenceNote}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Submódulo Beneficiario Controlador
              </CardTitle>
              <CardDescription>Captura obligatoria del beneficiario controlador y documentación soporte.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {["si", "no"].map((value) => (
                  <Button
                    key={value}
                    variant={screeningData.declaration === (value === "si" ? "si" : "no") ? "default" : "outline"}
                    onClick={() => actualizarDeclaracionPep(value === "si" ? "si" : "no")}
                  >
                    {value === "si" ? "Existe beneficiario controlador" : "No se identificó"}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {evidenciasBeneficiarioControlador.map((evidencia, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="justify-between"
                    onClick={() => cargarDocumento(evidencia, undefined, "Beneficiario controlador")}
                  >
                    {evidencia}
                    <Upload className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Submódulo Personas Políticamente Expuestas (PEP)
              </CardTitle>
              <CardDescription>Gestión de declaraciones, screening y documentación reforzada.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "si", label: "Cliente PEP" },
                  { value: "no", label: "Cliente no PEP" },
                  { value: "no-aplica", label: "No aplica" },
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={screeningData.declaration === option.value ? "default" : "outline"}
                    onClick={() => actualizarDeclaracionPep(option.value as ScreeningData["declaration"])}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              {screeningData.declaration === "si" && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={screeningData.type === "nacional" ? "default" : "outline"}
                    onClick={() => actualizarDeclaracionPep("si", "nacional")}
                  >
                    PEP nacional
                  </Button>
                  <Button
                    variant={screeningData.type === "extranjero" ? "default" : "outline"}
                    onClick={() => actualizarDeclaracionPep("si", "extranjero")}
                  >
                    PEP extranjero
                  </Button>
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fecha-screening">Fecha de último screening</Label>
                  <Input
                    id="fecha-screening"
                    type="date"
                    value={screeningData.lastScreening || ""}
                    onChange={(event) => {
                      registrarFechaScreening(event.target.value)
                      setTrazabilidad((prev) => [
                        {
                          id: Date.now().toString(),
                          action: "Screening actualizado",
                          user: "Usuario actual",
                          timestamp: new Date(),
                          details: `Fecha registrada: ${event.target.value}`,
                          section: "Beneficiario controlador y PEP",
                        },
                        ...prev,
                      ])
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Listas consultadas</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {listasRestrictivas.map((lista) => {
                      const listaId = `lista-${lista}`
                      return (
                        <div key={lista} className="flex items-center gap-2 rounded-md border px-3 py-2">
                          <Checkbox
                            id={listaId}
                            checked={screeningData.listsChecked.includes(lista)}
                            onCheckedChange={() => toggleListaRestrictiva(lista)}
                          />
                          <Label htmlFor={listaId} className="text-xs">
                            {lista}
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fuente-recursos">Fuente de recursos (en caso de PEP)</Label>
                <Textarea
                  id="fuente-recursos"
                  value={screeningData.sourceOfFunds || ""}
                  onChange={(event) => registrarFuenteRecursos(event.target.value)}
                  placeholder="Describe la evidencia del origen de los recursos"
                  onBlur={(event) =>
                    setTrazabilidad((prev) => [
                      {
                        id: Date.now().toString(),
                        action: "Fuente de recursos registrada",
                        user: "Usuario actual",
                        timestamp: new Date(),
                        details: `Detalle capturado: ${event.target.value}`,
                        section: "Beneficiario controlador y PEP",
                      },
                      ...prev,
                    ])
                  }
                />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {evidenciasPEP.map((evidencia, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="justify-between"
                    onClick={() => cargarDocumento(evidencia, undefined, "Gestión PEP")}
                  >
                    {evidencia}
                    <Upload className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Seguridad documental y conservación
              </CardTitle>
              <CardDescription>Controla accesos, sellos de tiempo y bloqueo documental por 5 años.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Control de accesos por roles</p>
                    <p className="text-xs text-muted-foreground">Restringe visualización según área.</p>
                  </div>
                  <Switch
                    checked={expedienteInfo.roleBasedAccess}
                    onCheckedChange={(checked) =>
                      actualizarExpedienteInfo("roleBasedAccess", checked, "Control de accesos actualizado")
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Repositorio con sello de tiempo</p>
                    <p className="text-xs text-muted-foreground">Indexación automática por cliente.</p>
                  </div>
                  <Switch
                    checked={expedienteInfo.timestampedRepository}
                    onCheckedChange={(checked) =>
                      actualizarExpedienteInfo("timestampedRepository", checked, "Sello de tiempo actualizado")
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Bloqueo documental al cierre</p>
                    <p className="text-xs text-muted-foreground">Garantiza conservación mínima de 5 años.</p>
                  </div>
                  <Switch
                    checked={expedienteInfo.lockedOnClosure}
                    onCheckedChange={(checked) =>
                      actualizarExpedienteInfo("lockedOnClosure", checked, "Bloqueo documental actualizado")
                    }
                  />
                </div>
              </div>
              <Button onClick={manejarGeneracionExpediente} variant="outline" className="gap-2">
                <Download className="h-4 w-4" /> Generar expediente completo en PDF
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

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

                  {pregunta.options && pregunta.options.length > 0 && (
                    <div className="space-y-2">
                      {pregunta.options.map((option) => {
                        const checkboxId = `${pregunta.id}-${option.id}`
                        const checked = pregunta.selectedOptions?.includes(option.id)
                        return (
                          <div
                            key={option.id}
                            className="flex flex-col gap-3 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={checkboxId}
                                checked={checked}
                                onCheckedChange={() => toggleChecklistOption(pregunta.id, option)}
                              />
                              <Label htmlFor={checkboxId} className="text-sm">
                                {option.label}
                              </Label>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cargarDocumento(option.label, option.validityDays, "Preguntas normativas")}
                            >
                              <Upload className="h-3 w-3" /> Adjuntar evidencia
                            </Button>
                          </div>
                        )
                      })}
                      {pregunta.evidenceNote && (
                        <p className="text-xs text-muted-foreground">{pregunta.evidenceNote}</p>
                      )}
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
                        onChange={(e) => {
                          const value = e.target.value
                          setPreguntasState((prev) =>
                            prev.map((p) =>
                              p.id === pregunta.id
                                ? { ...p, notes: value, lastUpdated: new Date() }
                                : p,
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" /> Dashboard de cumplimiento documental
              </CardTitle>
              <CardDescription>
                Métricas clave del expediente: avance, vencimientos y detecciones PEP.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">% Expediente completo</p>
                  <p className="text-2xl font-semibold">{completionRate}%</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Documentos por vencer (30 días)</p>
                  <p className="text-2xl font-semibold">{documentosPorVencer}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Documentos vencidos</p>
                  <p className="text-2xl font-semibold">{documentosVencidos}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">PEP detectados</p>
                  <p className="text-2xl font-semibold">{pepDetectados}</p>
                </div>
              </div>
            </CardContent>
          </Card>

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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cargarDocumento(evidencia, documentoVigencias[evidencia], "Evidencias generales")}
                    >
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        cargarDocumento(evidencia, documentoVigencias[evidencia], "Personas físicas")
                      }
                    >
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        cargarDocumento(evidencia, documentoVigencias[evidencia], "Personas morales")
                      }
                    >
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        cargarDocumento(evidencia, documentoVigencias[evidencia], "Personas extranjeras")
                      }
                    >
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        cargarDocumento(evidencia, documentoVigencias[evidencia], "Fideicomisos")
                      }
                    >
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cargarDocumento(evidencia, documentoVigencias[evidencia], "Beneficiario controlador")}
                    >
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cargarDocumento(evidencia, documentoVigencias[evidencia], "Gestión PEP")}
                    >
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        cargarDocumento(evidencia, documentoVigencias[evidencia], "Actualización y conservación")
                      }
                    >
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
                <Calendar className="h-5 w-5" />
                Actualización periódica del expediente
              </CardTitle>
              <CardDescription>
                Configura recordatorios y controla la conservación mínima de 5 años.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fecha-ultima-actualizacion">Fecha última actualización</Label>
                  <Input
                    id="fecha-ultima-actualizacion"
                    type="date"
                    value={expedienteInfo.lastUpdate || ""}
                    onChange={(event) =>
                      actualizarExpedienteInfo(
                        "lastUpdate",
                        event.target.value,
                        "Registro de última actualización",
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fecha-proxima-actualizacion">Próxima actualización programada</Label>
                  <Input
                    id="fecha-proxima-actualizacion"
                    type="date"
                    value={expedienteInfo.nextUpdate || ""}
                    onChange={(event) =>
                      actualizarExpedienteInfo(
                        "nextUpdate",
                        event.target.value,
                        "Programación de próxima actualización",
                      )
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Conservación mínima de 5 años</p>
                  <p className="text-xs text-muted-foreground">Bloquea la eliminación de documentos al cerrar la relación.</p>
                </div>
                <Switch
                  checked={expedienteInfo.retentionAcknowledged}
                  onCheckedChange={(checked) =>
                    actualizarExpedienteInfo(
                      "retentionAcknowledged",
                      checked,
                      "Confirmación de conservación a 5 años",
                    )
                  }
                />
              </div>
              <Button className="gap-2" onClick={programarAlertaActualizacion}>
                <Bell className="h-4 w-4" /> Programar alerta anual automática
              </Button>
            </CardContent>
          </Card>

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
