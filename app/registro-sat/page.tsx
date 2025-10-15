"use client"

import { useState, useEffect, useMemo, type ChangeEvent } from "react"
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
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { readFileAsDataUrl } from "@/lib/storage/read-file"
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
  Trash2,
  UserCheck,
  Building2,
  Paperclip,
  X,
  ClipboardList,
  Phone,
  ShieldCheck,
  MapPin,
  UserCog,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
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

interface RequiredDataField {
  id: string
  label: string
  description: string
  required: boolean
  tips?: string[]
}

interface RequiredDataSection {
  id: string
  title: string
  description: string
  icon: LucideIcon
  fields: RequiredDataField[]
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

const datosAltaRegistro: RequiredDataSection[] = [
  {
    id: "identidad-sociedad",
    title: "Identidad de la sociedad",
    description: "Información legal de la persona moral que se registra ante el SAT.",
    icon: ClipboardList,
    fields: [
      {
        id: "identidad-denominacion",
        label: "Denominación o razón social",
        description:
          "Nombre legal completo de la sociedad conforme al acta constitutiva y al RFC.",
        required: true,
        tips: [
          "Incluye el tipo societario (S.A. de C.V., S. de R.L., etc.).",
          "Verifica que coincida con los documentos presentados en el portal del SAT.",
        ],
      },
      {
        id: "identidad-fecha-constitucion",
        label: "Fecha de constitución",
        description: "Fecha en la que se formalizó la constitución ante fedatario público.",
        required: true,
        tips: ["Debe coincidir con la fecha asentada en el acta constitutiva."],
      },
      {
        id: "identidad-pais",
        label: "País de nacionalidad",
        description: "País donde la sociedad fue constituida legalmente.",
        required: true,
      },
    ],
  },
  {
    id: "contacto-sociedad",
    title: "Datos de contacto de la sociedad",
    description: "Medios de localización y persona de contacto del sujeto obligado.",
    icon: Phone,
    fields: [
      {
        id: "contacto-telefonos",
        label: "Teléfonos fijos de contacto",
        description: "Números con clave LADA, extensión y horario de atención.",
        required: true,
        tips: ["Documenta al menos un teléfono principal y uno alterno."],
      },
      {
        id: "contacto-persona",
        label: "Persona de contacto",
        description:
          "Nombre completo de la persona física que atenderá requerimientos en caso de no contar con REC designado.",
        required: true,
        tips: ["Registra apellidos completos sin abreviaturas."],
      },
      {
        id: "contacto-correo",
        label: "Correo electrónico oficial",
        description:
          "Correo habilitado para recibir comunicaciones, informes y alertas relacionadas con PLD.",
        required: true,
        tips: ["Debe coincidir con el registrado en el Buzón Tributario."],
      },
      {
        id: "contacto-movil",
        label: "Teléfonos móviles",
        description: "Número(s) celular para contacto inmediato, en su caso.",
        required: false,
      },
    ],
  },
  {
    id: "actividad-vulnerable",
    title: "Datos de la Actividad Vulnerable",
    description: "Información que acredita el alta y operación de la actividad vulnerable declarada.",
    icon: ShieldCheck,
    fields: [
      {
        id: "actividad-identificacion",
        label: "Actividad(es) vulnerable(s) registrada(s)",
        description:
          "Fracción del artículo 17 de la LFPIORPI seleccionada y descripción de la actividad realizada.",
        required: true,
        tips: ["Guarda evidencia del acuse de selección de fracción en el portal."],
      },
      {
        id: "actividad-fecha-inicio",
        label: "Fecha de primer operación",
        description:
          "Fecha en la que se realizó o realizará por primera vez la actividad vulnerable declarada.",
        required: true,
      },
      {
        id: "actividad-soporte",
        label: "Documento que ampara la actividad",
        description:
          "Datos del registro, autorización, patente o certificado: tipo de documento, autoridad emisora, folio y vigencia.",
        required: true,
        tips: ["Digitaliza el documento completo e identifica su periodo de vigencia."],
      },
      {
        id: "actividad-domicilio",
        label: "Domicilio principal de operaciones",
        description:
          "Ubicación en territorio nacional donde se realizan la mayoría de las actividades vulnerables.",
        required: true,
        tips: [
          "Incluye calle, número exterior e interior, colonia, municipio, ciudad, entidad federativa y código postal.",
          "Verifica que coincida con el domicilio registrado ante el SAT.",
        ],
      },
    ],
  },
  {
    id: "datos-rec",
    title: "Datos del Responsable Encargado de Cumplimiento",
    description: "Información personal del REC designado ante el SAT/UIF.",
    icon: UserCheck,
    fields: [
      {
        id: "rec-nombre",
        label: "Nombre completo del REC",
        description: "Nombre(s) y apellidos sin abreviaturas del representante encargado.",
        required: true,
      },
      {
        id: "rec-fecha-nacimiento",
        label: "Fecha de nacimiento",
        description: "Fecha de nacimiento según identificación oficial.",
        required: true,
      },
      {
        id: "rec-rfc",
        label: "RFC del REC",
        description: "Clave del Registro Federal de Contribuyentes del representante.",
        required: true,
      },
      {
        id: "rec-curp",
        label: "CURP del REC",
        description: "Clave Única de Registro de Población, en caso de contar con ella.",
        required: false,
      },
      {
        id: "rec-nacionalidad",
        label: "País de nacionalidad",
        description: "Nacionalidad del representante encargado de cumplimiento.",
        required: true,
      },
      {
        id: "rec-fecha-aceptacion",
        label: "Fecha de aceptación del cargo",
        description: "Fecha a partir de la cual el REC acepta formalmente la designación.",
        required: true,
        tips: ["Debe coincidir con el acuse de aceptación emitido por el portal PLD."],
      },
    ],
  },
  {
    id: "contacto-rec",
    title: "Contacto del REC",
    description: "Medios de comunicación con la persona designada como REC.",
    icon: UserCog,
    fields: [
      {
        id: "rec-contacto-telefonos",
        label: "Teléfonos del REC",
        description: "Números con clave LADA donde se pueda localizar al REC.",
        required: true,
      },
      {
        id: "rec-contacto-correo",
        label: "Correo electrónico del REC",
        description: "Correo designado para recibir informes, comunicaciones o alertas.",
        required: true,
        tips: ["Debe monitorearse de manera frecuente y contar con respaldo de seguridad."],
      },
      {
        id: "rec-contacto-movil",
        label: "Teléfono móvil del REC",
        description: "Número celular para notificaciones urgentes, en su caso.",
        required: false,
      },
    ],
  },
  {
    id: "domicilio-rec",
    title: "Domicilio del REC",
    description: "Domicilio completo del representante encargado de cumplimiento.",
    icon: MapPin,
    fields: [
      {
        id: "rec-domicilio",
        label: "Domicilio completo",
        description:
          "Calle, número exterior e interior, colonia, municipio o demarcación, ciudad, entidad federativa y código postal.",
        required: true,
        tips: ["Asegúrate de que la información esté actualizada y sea consistente con identificaciones oficiales."],
      },
    ],
  },
]

type DatosChecklistState = Record<string, { completed: boolean; notes: string }>

const datosChecklistIndex = datosAltaRegistro.reduce<
  Record<string, { sectionId: string; sectionTitle: string; field: RequiredDataField }>
>((acc, section) => {
  section.fields.forEach((field) => {
    acc[field.id] = { sectionId: section.id, sectionTitle: section.title, field }
  })
  return acc
}, {})

const createDefaultDatosChecklistState = (): DatosChecklistState =>
  datosAltaRegistro.reduce<DatosChecklistState>((acc, section) => {
    section.fields.forEach((field) => {
      acc[field.id] = { completed: false, notes: "" }
    })
    return acc
  }, {})

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
  const [datosChecklistState, setDatosChecklistState] = useState<DatosChecklistState>(() =>
    createDefaultDatosChecklistState(),
  )
  const [documentoAEliminar, setDocumentoAEliminar] = useState<DocumentUpload | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [activeTab, setActiveTab] = useState("preguntas")
  const [evidenciasPorPregunta, setEvidenciasPorPregunta] = useState<Record<string, string[]>>({})
  const datosChecklistResumen = useMemo(() => {
    const total = datosAltaRegistro.reduce((acc, section) => acc + section.fields.length, 0)
    const completados = datosAltaRegistro.reduce(
      (acc, section) =>
        acc + section.fields.filter((field) => datosChecklistState[field.id]?.completed).length,
      0,
    )
    const progresoDatos = total === 0 ? 0 : Math.round((completados / total) * 100)

    return { total, completados, progreso: progresoDatos }
  }, [datosChecklistState])

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
            id: doc.id ?? Date.now().toString(),
            name: doc.name ?? "",
            type: doc.type ?? "",
            uploadDate: doc.uploadDate ? new Date(doc.uploadDate as unknown as string) : new Date(),
            expiryDate: doc.expiryDate ? new Date(doc.expiryDate as unknown as string) : undefined,
            dataUrl: typeof doc.dataUrl === "string" ? doc.dataUrl : "",
            mimeType: doc.mimeType ?? "application/octet-stream",
            size: typeof doc.size === "number" ? doc.size : 0,
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

      const defaultChecklist = createDefaultDatosChecklistState()
      if (data.datosChecklist && typeof data.datosChecklist === "object") {
        Object.entries(data.datosChecklist as Record<string, unknown>).forEach(([key, value]) => {
          if (!(key in defaultChecklist)) return
          if (typeof value === "object" && value !== null) {
            const registro = value as Record<string, unknown>
            const completedRaw = registro.completed
            const notesRaw = registro.notes

            defaultChecklist[key] = {
              completed: completedRaw === true || completedRaw === "true",
              notes: typeof notesRaw === "string" ? notesRaw : "",
            }
          }
        })
      }

      setPreguntasState(preguntasGuardadas)
      setDocumentos(documentosGuardados as DocumentUpload[])
      setTrazabilidad(trazabilidadGuardada as TraceabilityEntry[])
      setEvidenciasPorPregunta(evidenciasGuardadas)
      setDatosChecklistState(defaultChecklist)
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
      datosChecklist: datosChecklistState,
    }
    localStorage.setItem("registro-sat-data", JSON.stringify(data))
  }, [preguntasState, documentos, trazabilidad, evidenciasPorPregunta, datosChecklistState])

  const actualizarEstatusDatoChecklist = (id: string, completed: boolean) => {
    const estadoActual = datosChecklistState[id] ?? { completed: false, notes: "" }
    if (estadoActual.completed === completed) {
      return
    }

    setDatosChecklistState((prev) => ({
      ...prev,
      [id]: {
        completed,
        notes: prev[id]?.notes ?? "",
      },
    }))

    const info = datosChecklistIndex[id]
    if (!info) {
      return
    }

    setTrazabilidad((prev) => [
      {
        id: Date.now().toString(),
        action: completed ? "Dato marcado como completo" : "Dato marcado como pendiente",
        user: "Usuario actual",
        timestamp: new Date(),
        details: `${info.sectionTitle}: ${info.field.label}`,
        section: "Checklist de Datos",
      },
      ...prev,
    ])

    toast({
      title: completed ? "Dato listo" : "Dato pendiente",
      description: `${info.field.label} en ${info.sectionTitle}`,
    })
  }

  const actualizarNotasDatoChecklist = (id: string, notas: string) => {
    setDatosChecklistState((prev) => ({
      ...prev,
      [id]: {
        completed: prev[id]?.completed ?? false,
        notes: notas,
      },
    }))
  }

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

  const crearDocumentoDesdeArchivo = async (file: File, tipo: string): Promise<DocumentUpload> => {
    const dataUrl = await readFileAsDataUrl(file)
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      name: file.name,
      type: tipo,
      uploadDate: new Date(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      dataUrl,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    }
  }

  const manejarCargaDocumento = async (event: ChangeEvent<HTMLInputElement>, tipo: string) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const documento = await crearDocumentoDesdeArchivo(file, tipo)

      setDocumentos((prev) => [documento, ...prev])
      setTrazabilidad((prev) => [
        {
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
          action: "Documento cargado",
          user: "Usuario actual",
          timestamp: new Date(),
          details: `Documento: ${documento.name} - Tipo: ${tipo}`,
          section: "Carga Documental",
        },
        ...prev,
      ])

      toast({
        title: "Documento cargado",
        description: `El documento ${documento.name} se almacenó en el repositorio digital.`,
      })
    } catch (error) {
      console.error("Error al guardar el archivo", error)
      toast({
        title: "No se pudo cargar el archivo",
        description: "Verifica el formato y vuelve a intentarlo.",
        variant: "destructive",
      })
    } finally {
      event.target.value = ""
    }
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
    setTrazabilidad((prev) => [
      {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        action: "Documento eliminado",
        user: "Usuario actual",
        timestamp: new Date(),
        details: `Documento eliminado: ${documento.name}`,
        section: "Carga Documental",
      },
      ...prev,
    ])

    toast({
      title: "Documento eliminado",
      description: `El documento ${documento.name} fue eliminado correctamente.`,
    })

    cerrarDialogoEliminacion()
  }

  const manejarCargaEvidencia = async (id: string, event: ChangeEvent<HTMLInputElement>) => {
    const archivos = event.target.files
    if (!archivos || archivos.length === 0) {
      return
    }

    try {
      const nuevosDocumentos = await Promise.all(
        Array.from(archivos).map((archivo) => crearDocumentoDesdeArchivo(archivo, `pregunta-${id}`)),
      )

      setDocumentos((prev) => [...nuevosDocumentos, ...prev])
      setEvidenciasPorPregunta((prev) => ({
        ...prev,
        [id]: [...(prev[id] ?? []), ...nuevosDocumentos.map((doc) => doc.name)],
      }))
      setTrazabilidad((prev) => [
        ...nuevosDocumentos.map((doc) => ({
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${doc.id}`,
          action: "Evidencia adjuntada",
          user: "Usuario actual",
          timestamp: new Date(),
          details: `Evidencia ${doc.name} vinculada a la pregunta ${id}`,
          section: "Seguimiento de preguntas",
        })),
        ...prev,
      ])

      toast({
        title: "Evidencia registrada",
        description: `${nuevosDocumentos.length === 1 ? "Se adjuntó" : "Se adjuntaron"} ${
          nuevosDocumentos.length
        } archivo${nuevosDocumentos.length > 1 ? "s" : ""} a la pregunta seleccionada.`,
      })
    } catch (error) {
      console.error("Error al adjuntar evidencias", error)
      toast({
        title: "No se pudieron procesar las evidencias",
        description: "Intenta nuevamente con archivos válidos.",
        variant: "destructive",
      })
    } finally {
      event.target.value = ""
    }
  }

  const eliminarEvidencia = (id: string, nombreArchivo: string) => {
    setEvidenciasPorPregunta((prev) => ({
      ...prev,
      [id]: (prev[id] ?? []).filter((nombre) => nombre !== nombreArchivo),
    }))

    setDocumentos((prev) =>
      prev.filter((doc) => !(doc.type === `pregunta-${id}` && doc.name === nombreArchivo)),
    )

    setTrazabilidad((prev) => [
      {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
        action: "Evidencia eliminada",
        user: "Usuario actual",
        timestamp: new Date(),
        details: `Se retiró ${nombreArchivo} de la pregunta ${id}`,
        section: "Seguimiento de preguntas",
      },
      ...prev,
    ])

    toast({
      title: "Evidencia eliminada",
      description: `${nombreArchivo} se retiró del expediente de la pregunta.`,
    })
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
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="preguntas" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Preguntas Normativas
          </TabsTrigger>
          <TabsTrigger value="datos" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Checklist de Datos
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

        {/* Tab: Checklist de Datos */}
        <TabsContent value="datos" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Datos indispensables para el alta y registro
              </CardTitle>
              <CardDescription>
                Marca cada dato conforme reúnas la información solicitada por el SAT para concluir el alta en el padrón.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-sm font-medium text-muted-foreground">Datos completados</p>
                  <p className="text-2xl font-semibold">{datosChecklistResumen.completados}</p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-sm font-medium text-muted-foreground">Datos pendientes</p>
                  <p className="text-2xl font-semibold">
                    {datosChecklistResumen.total - datosChecklistResumen.completados}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-sm font-medium text-muted-foreground">Total de datos</p>
                  <p className="text-2xl font-semibold">{datosChecklistResumen.total}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Avance del checklist</span>
                  <span className="text-sm font-semibold">{datosChecklistResumen.progreso}%</span>
                </div>
                <Progress value={datosChecklistResumen.progreso} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            {datosAltaRegistro.map((section) => {
              const completados = section.fields.filter(
                (field) => datosChecklistState[field.id]?.completed,
              ).length
              const progresoSeccion = Math.round((completados / section.fields.length) * 100)
              const Icon = section.icon

              return (
                <Card key={section.id}>
                  <CardHeader>
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Icon className="h-5 w-5 text-primary" />
                          {section.title}
                        </CardTitle>
                        <CardDescription>{section.description}</CardDescription>
                      </div>
                      <div className="space-y-2 text-right">
                        <Badge variant="outline">
                          {completados} de {section.fields.length} datos
                        </Badge>
                        <Progress value={progresoSeccion} className="ml-auto h-2 w-32" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {section.fields.map((field) => (
                      <div
                        key={field.id}
                        className="space-y-3 rounded-lg border border-dashed bg-muted/30 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id={`dato-${field.id}`}
                            checked={datosChecklistState[field.id]?.completed ?? false}
                            onCheckedChange={(checked) =>
                              actualizarEstatusDatoChecklist(field.id, checked === true)
                            }
                            className="mt-1"
                          />
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Label htmlFor={`dato-${field.id}`} className="font-medium">
                                {field.label}
                              </Label>
                              <Badge variant={field.required ? "default" : "secondary"}>
                                {field.required ? "Obligatorio" : "Opcional"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{field.description}</p>
                            {field.tips && field.tips.length > 0 && (
                              <ul className="ml-5 list-disc space-y-1 text-xs text-muted-foreground">
                                {field.tips.map((tip) => (
                                  <li key={tip}>{tip}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                        <div className="ml-7 space-y-2">
                          <Label
                            htmlFor={`dato-notas-${field.id}`}
                            className="text-xs font-semibold uppercase text-muted-foreground"
                          >
                            Notas y referencias
                          </Label>
                          <Textarea
                            id={`dato-notas-${field.id}`}
                            value={datosChecklistState[field.id]?.notes ?? ""}
                            onChange={(event) =>
                              actualizarNotasDatoChecklist(field.id, event.target.value)
                            }
                            placeholder="Anota folios, responsables, ubicaciones de archivos o comentarios relevantes."
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )
            })}
          </div>
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
                    <Button size="sm" variant="outline" asChild>
                      <label className="flex cursor-pointer items-center gap-1">
                        <Upload className="h-3 w-3" />
                        <input
                          type="file"
                          className="sr-only"
                          onChange={(event) => manejarCargaDocumento(event, evidencia)}
                        />
                      </label>
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
                    <Button size="sm" variant="outline" asChild>
                      <label className="flex cursor-pointer items-center gap-1">
                        <Upload className="h-3 w-3" />
                        <input
                          type="file"
                          className="sr-only"
                          onChange={(event) => manejarCargaDocumento(event, evidencia)}
                        />
                      </label>
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
                    <Button size="sm" variant="outline" asChild>
                      <label className="flex cursor-pointer items-center gap-1">
                        <Upload className="h-3 w-3" />
                        <input
                          type="file"
                          className="sr-only"
                          onChange={(event) => manejarCargaDocumento(event, evidencia)}
                        />
                      </label>
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
                    <Button size="sm" variant="outline" asChild>
                      <label className="flex cursor-pointer items-center gap-1">
                        <Upload className="h-3 w-3" />
                        <input
                          type="file"
                          className="sr-only"
                          onChange={(event) => manejarCargaDocumento(event, evidencia)}
                        />
                      </label>
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
                    <Button size="sm" variant="outline" asChild>
                      <label className="flex cursor-pointer items-center gap-1">
                        <Upload className="h-3 w-3" />
                        <input
                          type="file"
                          className="sr-only"
                          onChange={(event) => manejarCargaDocumento(event, evidencia)}
                        />
                      </label>
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
                            {doc.size > 0 && ` • ${Math.max(1, Math.round(doc.size / 1024))} KB`}
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
              ¿Deseas eliminar el documento "{documentoAEliminar?.name}"? Esta acción no se puede deshacer y se retirará del
              repositorio digital.
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
