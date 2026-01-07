"use client"

import { useEffect, useMemo, useState, type ChangeEvent } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { actividadesVulnerables } from "@/lib/data/actividades"
import { PAISES } from "@/lib/data/paises"
import { readFileAsDataUrl } from "@/lib/storage/read-file"
import { cn } from "@/lib/utils"
import { Building2, ClipboardList, FileText, Paperclip, ShieldCheck, Upload, UserCog } from "lucide-react"
import type { LucideIcon } from "lucide-react"

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
  appliesTo: SubjectType[]
}

type SubjectType = "none" | "fisica" | "moral" | "fideicomiso"
type RegistroDocumentKey = "detalle" | "acuse" | "aceptacion"

interface DocumentUpload {
  id: string
  name: string
  type: string
  uploadDate: Date
  dataUrl: string
  mimeType: string
  size: number
}

interface SujetoRegistrado {
  id: string
  nombre: string
  tipo: SubjectType
  actividad: string
  creadoEn: Date
  documentos: Record<RegistroDocumentKey, DocumentUpload | null>
  checklistCampos: string[]
  registroCompleto: boolean
  identificacion: IdentificacionSujeto
  contactos: ContactoSujeto[]
  actividades: ActividadSujeto[]
  representante: RepresentanteCumplimiento | null
}

type DatosChecklistState = Record<string, { completed: boolean; notes: string }>

interface IdentificacionSujeto {
  fecha: string
  rfc: string
  nombre: string
  apellidoPaterno: string
  paisNacionalidad: string
  paisNacimiento: string
  curp: string
}

interface ContactoSujeto {
  nombreCompleto: string
  claveLada: string
  telefonoFijo: string
  extension: string
  telefonoMovil: string
  correo: string
}

interface DomicilioActividad {
  codigoPostal: string
  tipoVialidad: string
  nombreVialidad: string
  numeroExterior: string
  numeroInterior: string
  colonia: string
  alcaldia: string
  entidad: string
  pais: string
}

interface ActividadSujeto {
  actividadKey: string
  fechaPrimera: string
  cuentaRegistro: "" | "si" | "no"
  tipoDocumento: string
  autoridadDocumento: string
  folioDocumento: string
  periodoDocumento: string
  domicilio: DomicilioActividad
}

interface RepresentanteCumplimiento {
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  fechaNacimiento: string
  rfc: string
  curp: string
  paisNacionalidad: string
  fechaDesignacion: string
  fechaAceptacion: string
  contacto: {
    claveLada: string
    telefonoFijo: string
    extension: string
    telefonoMovil: string
    correo: string
  }
  certificacion: {
    respuesta: "" | "si" | "no"
    tipoDocumento: string
    autoridadDocumento: string
    folioDocumento: string
    periodoDocumento: string
  }
}

const datosAltaRegistro: RequiredDataSection[] = [
  {
    id: "actividad-vulnerable",
    title: "Actividad vulnerable declarada",
    description: "Pregunta central del checklist: ¿qué actividad vulnerable realizarás?",
    icon: ShieldCheck,
    appliesTo: ["fisica", "moral", "fideicomiso"],
    fields: [
      {
        id: "actividad-descripcion",
        label: "Actividad vulnerable a realizar",
        description: "Describe la fracción seleccionada y la operación que se realizará.",
        required: true,
        tips: ["Redacta la fracción del artículo 17 y el giro concreto."],
      },
      {
        id: "actividad-ubicacion",
        label: "Domicilio donde se ejecuta la actividad",
        description: "Dirección completa para identificar el lugar de operaciones.",
        required: true,
      },
    ],
  },
  {
    id: "persona-fisica-identificacion",
    title: "Identificación de persona física (Anexo 1)",
    description: "Datos solicitados por el SAT para sujetos obligados personas físicas.",
    icon: ClipboardList,
    appliesTo: ["fisica"],
    fields: [
      {
        id: "pf-nombre",
        label: "Nombre completo",
        description: "Tal como aparece en la identificación oficial y RFC.",
        required: true,
      },
      {
        id: "pf-rfc",
        label: "RFC",
        description: "Clave de RFC activa con homoclave.",
        required: true,
      },
      {
        id: "pf-curp",
        label: "CURP",
        description: "Identificador de población asociado a la persona física.",
        required: true,
      },
      {
        id: "pf-domicilio",
        label: "Domicilio fiscal",
        description: "Calle, número, colonia, municipio y código postal.",
        required: true,
      },
    ],
  },
  {
    id: "persona-moral-identidad",
    title: "Identidad de la persona moral (Anexo 2)",
    description: "Datos societarios para el alta de sujetos obligados personas morales.",
    icon: Building2,
    appliesTo: ["moral"],
    fields: [
      {
        id: "pm-denominacion",
        label: "Denominación o razón social",
        description: "Nombre legal completo conforme al acta constitutiva.",
        required: true,
      },
      {
        id: "pm-rfc",
        label: "RFC de la sociedad",
        description: "Registro Federal de Contribuyentes activo.",
        required: true,
      },
      {
        id: "pm-representante",
        label: "Representante legal",
        description: "Nombre completo y cargo del representante acreditado.",
        required: true,
      },
      {
        id: "pm-domicilio",
        label: "Domicilio fiscal",
        description: "Domicilio registrado ante el SAT para la sociedad.",
        required: true,
      },
    ],
  },
  {
    id: "fideicomiso-datos",
    title: "Datos del fideicomiso",
    description: "Información clave para sujetos obligados constituidos como fideicomiso.",
    icon: ClipboardList,
    appliesTo: ["fideicomiso"],
    fields: [
      {
        id: "fid-nombre",
        label: "Nombre del fideicomiso",
        description: "Denominación utilizada en el contrato de fideicomiso.",
        required: true,
      },
      {
        id: "fid-fiduciario",
        label: "Fiduciario",
        description: "Institución fiduciaria responsable.",
        required: true,
      },
      {
        id: "fid-fideicomitente",
        label: "Fideicomitente y fideicomisario",
        description: "Identifica a quienes aportan y reciben beneficios.",
        required: true,
      },
    ],
  },
  {
    id: "rec-datos",
    title: "Datos del encargado de cumplimiento",
    description: "Información del representante o encargado designado.",
    icon: UserCog,
    appliesTo: ["moral", "fideicomiso"],
    fields: [
      {
        id: "rec-nombre",
        label: "Nombre completo",
        description: "Persona designada ante el SAT/UIF.",
        required: true,
      },
      {
        id: "rec-correo",
        label: "Correo de contacto",
        description: "Medio oficial para recibir notificaciones.",
        required: true,
      },
      {
        id: "rec-telefono",
        label: "Teléfono de contacto",
        description: "Número directo o con extensión.",
        required: false,
      },
    ],
  },
]

const evidenciasRecomendadas = [
  {
    id: "acta-constitutiva",
    label: "Acta constitutiva",
    descripcion: "Evidencia recomendada pero no obligatoria.",
  },
  {
    id: "situacion-fiscal",
    label: "Constancia de situación fiscal",
    descripcion: "Refuerza la identificación del sujeto obligado.",
  },
  {
    id: "comprobante-domicilio",
    label: "Comprobante de domicilio",
    descripcion: "Factura o estado de cuenta reciente (opcional).",
  },
]

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

const createDefaultIdentificacion = (): IdentificacionSujeto => ({
  fecha: "",
  rfc: "",
  nombre: "",
  apellidoPaterno: "",
  paisNacionalidad: "",
  paisNacimiento: "",
  curp: "",
})

const createDefaultContacto = (): ContactoSujeto => ({
  nombreCompleto: "",
  claveLada: "",
  telefonoFijo: "",
  extension: "",
  telefonoMovil: "",
  correo: "",
})

const createDefaultDomicilio = (): DomicilioActividad => ({
  codigoPostal: "",
  tipoVialidad: "",
  nombreVialidad: "",
  numeroExterior: "",
  numeroInterior: "",
  colonia: "",
  alcaldia: "",
  entidad: "",
  pais: "México",
})

const createDefaultActividad = (): ActividadSujeto => ({
  actividadKey: "",
  fechaPrimera: "",
  cuentaRegistro: "",
  tipoDocumento: "",
  autoridadDocumento: "",
  folioDocumento: "",
  periodoDocumento: "",
  domicilio: createDefaultDomicilio(),
})

const createDefaultRepresentante = (): RepresentanteCumplimiento => ({
  nombre: "",
  apellidoPaterno: "",
  apellidoMaterno: "",
  fechaNacimiento: "",
  rfc: "",
  curp: "",
  paisNacionalidad: "",
  fechaDesignacion: "",
  fechaAceptacion: "",
  contacto: {
    claveLada: "",
    telefonoFijo: "",
    extension: "",
    telefonoMovil: "",
    correo: "",
  },
  certificacion: {
    respuesta: "",
    tipoDocumento: "",
    autoridadDocumento: "",
    folioDocumento: "",
    periodoDocumento: "",
  },
})

const tiposSujetos: { value: SubjectType; label: string }[] = [
  { value: "none", label: "---" },
  { value: "fisica", label: "Persona física" },
  { value: "moral", label: "Persona moral" },
  { value: "fideicomiso", label: "Fideicomiso" },
]

const opcionesDocumento = ["Registro", "Autorización", "Patente", "Certificado", "Otro"]
const opcionesAutoridad = ["SAT", "SHCP", "CNBV", "UIF", "Otra"]

const normalizarTexto = (valor: unknown) => (typeof valor === "string" ? valor : "")

const construirNombreSujeto = (tipo: SubjectType, identificacion: IdentificacionSujeto) => {
  if (tipo === "fisica") {
    return [identificacion.nombre.trim(), identificacion.apellidoPaterno.trim()].filter(Boolean).join(" ")
  }
  return identificacion.nombre.trim()
}

const obtenerEtiquetaFecha = (tipo: SubjectType) => {
  if (tipo === "fisica") return "Fecha de Nacimiento"
  if (tipo === "moral") return "Fecha de Constitución"
  if (tipo === "fideicomiso") return "Fecha de Constitución"
  return "Fecha"
}

const obtenerEtiquetaNombre = (tipo: SubjectType) => {
  if (tipo === "fisica") return "Nombre(s) (sin abreviaturas)"
  if (tipo === "moral") return "Denominación o Razón Social"
  if (tipo === "fideicomiso") return "Denominación"
  return "Nombre"
}

export default function RegistroSATPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("nuevo")
  const [tipoSujeto, setTipoSujeto] = useState<SubjectType>("none")
  const [identificacion, setIdentificacion] = useState<IdentificacionSujeto>(() => createDefaultIdentificacion())
  const [contactos, setContactos] = useState<ContactoSujeto[]>(() =>
    Array.from({ length: 3 }, () => createDefaultContacto()),
  )
  const [actividades, setActividades] = useState<ActividadSujeto[]>(() =>
    Array.from({ length: 5 }, () => createDefaultActividad()),
  )
  const [representante, setRepresentante] = useState<RepresentanteCumplimiento>(() => createDefaultRepresentante())
  const [documentosRegistro, setDocumentosRegistro] = useState<
    Record<RegistroDocumentKey, DocumentUpload | null>
  >({
    detalle: null,
    acuse: null,
    aceptacion: null,
  })
  const [documentos, setDocumentos] = useState<DocumentUpload[]>([])
  const [sujetosRegistrados, setSujetosRegistrados] = useState<SujetoRegistrado[]>([])
  const [sujetoSeleccionadoId, setSujetoSeleccionadoId] = useState<string | null>(null)
  const [sujetoEnEdicionId, setSujetoEnEdicionId] = useState<string | null>(null)
  const [datosChecklistState, setDatosChecklistState] = useState<DatosChecklistState>(() =>
    createDefaultDatosChecklistState(),
  )

  const seccionesAplicables = useMemo(() => {
    if (tipoSujeto === "none") return []
    return datosAltaRegistro.filter((section) => section.appliesTo.includes(tipoSujeto))
  }, [tipoSujeto])

  const datosChecklistResumen = useMemo(() => {
    const total = seccionesAplicables.reduce((acc, section) => acc + section.fields.length, 0)
    const completados = seccionesAplicables.reduce(
      (acc, section) => acc + section.fields.filter((field) => datosChecklistState[field.id]?.completed).length,
      0,
    )
    const progreso = total === 0 ? 0 : Math.round((completados / total) * 100)
    return { total, completados, progreso }
  }, [datosChecklistState, seccionesAplicables])

  const catalogoActividades = useMemo(
    () =>
      new Map(
        actividadesVulnerables.map((actividad) => [
          actividad.key,
          `${actividad.fraccion} · ${actividad.nombre}`,
        ]),
      ),
    [],
  )

  const nombreSujeto = construirNombreSujeto(tipoSujeto, identificacion)

  const resumenActividades = useMemo(() => {
    const seleccionadas = actividades
      .map((actividad) => catalogoActividades.get(actividad.actividadKey))
      .filter((actividad): actividad is string => Boolean(actividad))
    return seleccionadas.join("; ")
  }, [actividades, catalogoActividades])

  useEffect(() => {
    const savedData = localStorage.getItem("registro-sat-data")
    if (!savedData) return

    try {
      const data = JSON.parse(savedData)

      const documentosGuardados = Array.isArray(data.documentos)
        ? data.documentos.map((doc: Partial<DocumentUpload>) => ({
            id: doc.id ?? Date.now().toString(),
            name: doc.name ?? "",
            type: doc.type ?? "",
            uploadDate: doc.uploadDate ? new Date(doc.uploadDate as unknown as string) : new Date(),
            dataUrl: typeof doc.dataUrl === "string" ? doc.dataUrl : "",
            mimeType: doc.mimeType ?? "application/octet-stream",
            size: typeof doc.size === "number" ? doc.size : 0,
          }))
        : []

      const checklist = createDefaultDatosChecklistState()
      if (data.datosChecklist && typeof data.datosChecklist === "object") {
        Object.entries(data.datosChecklist as Record<string, unknown>).forEach(([key, value]) => {
          if (typeof value === "object" && value !== null && key in checklist) {
            const registro = value as Record<string, unknown>
            checklist[key] = {
              completed: registro.completed === true || registro.completed === "true",
              notes: typeof registro.notes === "string" ? registro.notes : "",
            }
          }
        })
      }

      const sujetosCargados = Array.isArray(data.sujetosRegistrados)
        ? data.sujetosRegistrados.map((item: Partial<SujetoRegistrado>) => {
            const detalle = item.documentos?.detalle
              ? {
                  ...item.documentos.detalle,
                  uploadDate: new Date(item.documentos.detalle.uploadDate as unknown as string),
                }
              : null

            const acuse = item.documentos?.acuse
              ? {
                  ...item.documentos.acuse,
                  uploadDate: new Date(item.documentos.acuse.uploadDate as unknown as string),
                }
              : null

            const aceptacion = item.documentos?.aceptacion
              ? {
                  ...item.documentos.aceptacion,
                  uploadDate: new Date(item.documentos.aceptacion.uploadDate as unknown as string),
                }
              : null

            const registroCompleto =
              item.registroCompleto === true || (detalle !== null && acuse !== null && aceptacion !== null)

            return {
              id: item.id ?? crypto.randomUUID(),
              nombre: item.nombre ?? "",
              tipo: (item.tipo as SubjectType) ?? "moral",
              actividad: item.actividad ?? "",
              creadoEn: item.creadoEn ? new Date(item.creadoEn as unknown as string) : new Date(),
              checklistCampos: Array.isArray(item.checklistCampos)
                ? item.checklistCampos.map((campo) => String(campo))
                : [],
              documentos: {
                detalle,
                acuse,
                aceptacion,
              },
              registroCompleto,
              identificacion:
                item.identificacion && typeof item.identificacion === "object"
                  ? {
                      fecha: normalizarTexto((item.identificacion as Record<string, unknown>).fecha),
                      rfc: normalizarTexto((item.identificacion as Record<string, unknown>).rfc),
                      nombre: normalizarTexto((item.identificacion as Record<string, unknown>).nombre),
                      apellidoPaterno: normalizarTexto((item.identificacion as Record<string, unknown>).apellidoPaterno),
                      paisNacionalidad: normalizarTexto((item.identificacion as Record<string, unknown>).paisNacionalidad),
                      paisNacimiento: normalizarTexto((item.identificacion as Record<string, unknown>).paisNacimiento),
                      curp: normalizarTexto((item.identificacion as Record<string, unknown>).curp),
                    }
                  : createDefaultIdentificacion(),
              contactos: Array.isArray(item.contactos)
                ? item.contactos.map((contacto: Record<string, unknown>) => ({
                    nombreCompleto: normalizarTexto(contacto.nombreCompleto),
                    claveLada: normalizarTexto(contacto.claveLada),
                    telefonoFijo: normalizarTexto(contacto.telefonoFijo),
                    extension: normalizarTexto(contacto.extension),
                    telefonoMovil: normalizarTexto(contacto.telefonoMovil),
                    correo: normalizarTexto(contacto.correo),
                  }))
                : Array.from({ length: 3 }, () => createDefaultContacto()),
              actividades: Array.isArray(item.actividades)
                ? item.actividades.map((actividad: Record<string, unknown>) => ({
                    actividadKey: normalizarTexto(actividad.actividadKey),
                    fechaPrimera: normalizarTexto(actividad.fechaPrimera),
                    cuentaRegistro: normalizarTexto(actividad.cuentaRegistro) as "" | "si" | "no",
                    tipoDocumento: normalizarTexto(actividad.tipoDocumento),
                    autoridadDocumento: normalizarTexto(actividad.autoridadDocumento),
                    folioDocumento: normalizarTexto(actividad.folioDocumento),
                    periodoDocumento: normalizarTexto(actividad.periodoDocumento),
                    domicilio: {
                      codigoPostal: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.codigoPostal),
                      tipoVialidad: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.tipoVialidad),
                      nombreVialidad: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.nombreVialidad),
                      numeroExterior: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.numeroExterior),
                      numeroInterior: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.numeroInterior),
                      colonia: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.colonia),
                      alcaldia: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.alcaldia),
                      entidad: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.entidad),
                      pais:
                        normalizarTexto((actividad.domicilio as Record<string, unknown>)?.pais) ||
                        createDefaultDomicilio().pais,
                    },
                  }))
                : Array.from({ length: 5 }, () => createDefaultActividad()),
              representante:
                item.representante && typeof item.representante === "object"
                  ? {
                      ...createDefaultRepresentante(),
                      nombre: normalizarTexto((item.representante as Record<string, unknown>).nombre),
                      apellidoPaterno: normalizarTexto((item.representante as Record<string, unknown>).apellidoPaterno),
                      apellidoMaterno: normalizarTexto((item.representante as Record<string, unknown>).apellidoMaterno),
                      fechaNacimiento: normalizarTexto((item.representante as Record<string, unknown>).fechaNacimiento),
                      rfc: normalizarTexto((item.representante as Record<string, unknown>).rfc),
                      curp: normalizarTexto((item.representante as Record<string, unknown>).curp),
                      paisNacionalidad: normalizarTexto(
                        (item.representante as Record<string, unknown>).paisNacionalidad,
                      ),
                      fechaDesignacion: normalizarTexto(
                        (item.representante as Record<string, unknown>).fechaDesignacion,
                      ),
                      fechaAceptacion: normalizarTexto(
                        (item.representante as Record<string, unknown>).fechaAceptacion,
                      ),
                      contacto: {
                        claveLada: normalizarTexto(
                          ((item.representante as Record<string, unknown>).contacto as Record<string, unknown>)?.claveLada,
                        ),
                        telefonoFijo: normalizarTexto(
                          ((item.representante as Record<string, unknown>).contacto as Record<string, unknown>)
                            ?.telefonoFijo,
                        ),
                        extension: normalizarTexto(
                          ((item.representante as Record<string, unknown>).contacto as Record<string, unknown>)?.extension,
                        ),
                        telefonoMovil: normalizarTexto(
                          ((item.representante as Record<string, unknown>).contacto as Record<string, unknown>)
                            ?.telefonoMovil,
                        ),
                        correo: normalizarTexto(
                          ((item.representante as Record<string, unknown>).contacto as Record<string, unknown>)?.correo,
                        ),
                      },
                      certificacion: {
                        respuesta: normalizarTexto(
                          ((item.representante as Record<string, unknown>).certificacion as Record<string, unknown>)
                            ?.respuesta,
                        ) as "" | "si" | "no",
                        tipoDocumento: normalizarTexto(
                          ((item.representante as Record<string, unknown>).certificacion as Record<string, unknown>)
                            ?.tipoDocumento,
                        ),
                        autoridadDocumento: normalizarTexto(
                          ((item.representante as Record<string, unknown>).certificacion as Record<string, unknown>)
                            ?.autoridadDocumento,
                        ),
                        folioDocumento: normalizarTexto(
                          ((item.representante as Record<string, unknown>).certificacion as Record<string, unknown>)
                            ?.folioDocumento,
                        ),
                        periodoDocumento: normalizarTexto(
                          ((item.representante as Record<string, unknown>).certificacion as Record<string, unknown>)
                            ?.periodoDocumento,
                        ),
                      },
                    }
                  : null,
            }
          })
        : []

      const documentosRegistroGuardados =
        data.documentosRegistro && typeof data.documentosRegistro === "object"
          ? (Object.entries(data.documentosRegistro) as [RegistroDocumentKey, Partial<DocumentUpload>][]).reduce<
              Record<RegistroDocumentKey, DocumentUpload | null>
            >((acc, [key, value]) => {
              acc[key] = value
                ? {
                    id: value.id ?? crypto.randomUUID(),
                    name: value.name ?? "",
                    type: value.type ?? key,
                    uploadDate: value.uploadDate ? new Date(value.uploadDate as unknown as string) : new Date(),
                    dataUrl: typeof value.dataUrl === "string" ? value.dataUrl : "",
                    mimeType: value.mimeType ?? "application/octet-stream",
                    size: typeof value.size === "number" ? value.size : 0,
                  }
                : null
              return acc
            }, { detalle: null, acuse: null, aceptacion: null })
          : { detalle: null, acuse: null, aceptacion: null }

      const identificacionRaw = (data.identificacion ?? {}) as Record<string, unknown>
      const identificacionCargada: IdentificacionSujeto = {
        fecha: normalizarTexto(identificacionRaw.fecha),
        rfc: normalizarTexto(identificacionRaw.rfc),
        nombre: normalizarTexto(identificacionRaw.nombre),
        apellidoPaterno: normalizarTexto(identificacionRaw.apellidoPaterno),
        paisNacionalidad: normalizarTexto(identificacionRaw.paisNacionalidad),
        paisNacimiento: normalizarTexto(identificacionRaw.paisNacimiento),
        curp: normalizarTexto(identificacionRaw.curp),
      }

      const contactosCargados = Array.isArray(data.contactos)
        ? data.contactos.map((contacto: Record<string, unknown>) => ({
            nombreCompleto: normalizarTexto(contacto.nombreCompleto),
            claveLada: normalizarTexto(contacto.claveLada),
            telefonoFijo: normalizarTexto(contacto.telefonoFijo),
            extension: normalizarTexto(contacto.extension),
            telefonoMovil: normalizarTexto(contacto.telefonoMovil),
            correo: normalizarTexto(contacto.correo),
          }))
        : []

      const contactosNormalizados = Array.from({ length: 3 }, (_, index) =>
        contactosCargados[index] ? { ...createDefaultContacto(), ...contactosCargados[index] } : createDefaultContacto(),
      )

      const actividadesCargadas = Array.isArray(data.actividades)
        ? data.actividades.map((actividad: Record<string, unknown>) => ({
            actividadKey: normalizarTexto(actividad.actividadKey),
            fechaPrimera: normalizarTexto(actividad.fechaPrimera),
            cuentaRegistro: normalizarTexto(actividad.cuentaRegistro) as "" | "si" | "no",
            tipoDocumento: normalizarTexto(actividad.tipoDocumento),
            autoridadDocumento: normalizarTexto(actividad.autoridadDocumento),
            folioDocumento: normalizarTexto(actividad.folioDocumento),
            periodoDocumento: normalizarTexto(actividad.periodoDocumento),
            domicilio: {
              codigoPostal: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.codigoPostal),
              tipoVialidad: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.tipoVialidad),
              nombreVialidad: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.nombreVialidad),
              numeroExterior: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.numeroExterior),
              numeroInterior: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.numeroInterior),
              colonia: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.colonia),
              alcaldia: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.alcaldia),
              entidad: normalizarTexto((actividad.domicilio as Record<string, unknown>)?.entidad),
              pais:
                normalizarTexto((actividad.domicilio as Record<string, unknown>)?.pais) ||
                createDefaultDomicilio().pais,
            },
          }))
        : []

      const actividadesNormalizadas = Array.from({ length: 5 }, (_, index) =>
        actividadesCargadas[index]
          ? { ...createDefaultActividad(), ...actividadesCargadas[index] }
          : createDefaultActividad(),
      )

      const representanteRaw = (data.representante ?? {}) as Record<string, unknown>
      const representanteCargado: RepresentanteCumplimiento = {
        ...createDefaultRepresentante(),
        nombre: normalizarTexto(representanteRaw.nombre),
        apellidoPaterno: normalizarTexto(representanteRaw.apellidoPaterno),
        apellidoMaterno: normalizarTexto(representanteRaw.apellidoMaterno),
        fechaNacimiento: normalizarTexto(representanteRaw.fechaNacimiento),
        rfc: normalizarTexto(representanteRaw.rfc),
        curp: normalizarTexto(representanteRaw.curp),
        paisNacionalidad: normalizarTexto(representanteRaw.paisNacionalidad),
        fechaDesignacion: normalizarTexto(representanteRaw.fechaDesignacion),
        fechaAceptacion: normalizarTexto(representanteRaw.fechaAceptacion),
        contacto: {
          claveLada: normalizarTexto((representanteRaw.contacto as Record<string, unknown>)?.claveLada),
          telefonoFijo: normalizarTexto((representanteRaw.contacto as Record<string, unknown>)?.telefonoFijo),
          extension: normalizarTexto((representanteRaw.contacto as Record<string, unknown>)?.extension),
          telefonoMovil: normalizarTexto((representanteRaw.contacto as Record<string, unknown>)?.telefonoMovil),
          correo: normalizarTexto((representanteRaw.contacto as Record<string, unknown>)?.correo),
        },
        certificacion: {
          respuesta: normalizarTexto((representanteRaw.certificacion as Record<string, unknown>)?.respuesta) as
            | ""
            | "si"
            | "no",
          tipoDocumento: normalizarTexto((representanteRaw.certificacion as Record<string, unknown>)?.tipoDocumento),
          autoridadDocumento: normalizarTexto((representanteRaw.certificacion as Record<string, unknown>)?.autoridadDocumento),
          folioDocumento: normalizarTexto((representanteRaw.certificacion as Record<string, unknown>)?.folioDocumento),
          periodoDocumento: normalizarTexto((representanteRaw.certificacion as Record<string, unknown>)?.periodoDocumento),
        },
      }

      setDocumentos(documentosGuardados as DocumentUpload[])
      setDatosChecklistState(checklist)
      setSujetosRegistrados(sujetosCargados as SujetoRegistrado[])
      setSujetoSeleccionadoId(sujetosCargados[0]?.id ?? null)
      setTipoSujeto((data.tipoSujeto as SubjectType) ?? "none")
      setIdentificacion(identificacionCargada)
      setContactos(contactosNormalizados)
      setActividades(actividadesNormalizadas)
      setRepresentante(representanteCargado)
      setDocumentosRegistro(documentosRegistroGuardados)
    } catch (error) {
      console.error("Error al cargar datos de registro SAT", error)
    }
  }, [])

  useEffect(() => {
    const data = {
      documentos,
      datosChecklist: datosChecklistState,
      sujetosRegistrados,
      tipoSujeto,
      identificacion,
      contactos,
      actividades,
      representante,
      documentosRegistro,
    }
    localStorage.setItem("registro-sat-data", JSON.stringify(data))
  }, [
    documentos,
    datosChecklistState,
    sujetosRegistrados,
    tipoSujeto,
    identificacion,
    contactos,
    actividades,
    representante,
    documentosRegistro,
  ])

  const crearDocumentoDesdeArchivo = async (file: File, tipo: string): Promise<DocumentUpload> => {
    const dataUrl = await readFileAsDataUrl(file)
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      name: file.name,
      type: tipo,
      uploadDate: new Date(),
      dataUrl,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
    }
  }

  const actualizarEstatusDatoChecklist = (id: string, completed: boolean) => {
    setDatosChecklistState((prev) => ({
      ...prev,
      [id]: {
        completed,
        notes: prev[id]?.notes ?? "",
      },
    }))
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

  const obtenerChecklistDesdeCamposConfirmados = (
    camposConfirmados: string[],
    tipo: SubjectType,
  ): DatosChecklistState => {
    const checklist = createDefaultDatosChecklistState()

    datosAltaRegistro
      .filter((section) => section.appliesTo.includes(tipo))
      .flatMap((section) => section.fields)
      .forEach((field) => {
        if (camposConfirmados.includes(field.label)) {
          checklist[field.id] = {
            completed: true,
            notes: checklist[field.id]?.notes ?? "",
          }
        }
      })

    return checklist
  }

  const camposObligatoriosCapturados = Boolean(
    tipoSujeto !== "none" && nombreSujeto.trim() && resumenActividades.trim(),
  )
  const documentosRequeridosCompletos =
    !!documentosRegistro.detalle && !!documentosRegistro.acuse && !!documentosRegistro.aceptacion

  const limpiarFormulario = () => {
    setIdentificacion(createDefaultIdentificacion())
    setContactos(Array.from({ length: 3 }, () => createDefaultContacto()))
    setActividades(Array.from({ length: 5 }, () => createDefaultActividad()))
    setRepresentante(createDefaultRepresentante())
    setDocumentosRegistro({ detalle: null, acuse: null, aceptacion: null })
    setDatosChecklistState(createDefaultDatosChecklistState())
    setSujetoEnEdicionId(null)
  }

  const registrarSujeto = (
    docs: Record<RegistroDocumentKey, DocumentUpload | null>,
    opciones?: { permitirIncompleto?: boolean },
  ) => {
    if (tipoSujeto === "none" || !nombreSujeto.trim() || !resumenActividades.trim()) return false

    const registroCompleto = !!(docs.detalle && docs.acuse && docs.aceptacion)
    if (!registroCompleto && !opciones?.permitirIncompleto) return false

    const camposChecklist = datosAltaRegistro
      .filter((section) => section.appliesTo.includes(tipoSujeto))
      .flatMap((section) => section.fields)
      .filter((field) => datosChecklistState[field.id]?.completed)
      .map((field) => field.label)

    const sujetoExistente = sujetosRegistrados.find((item) => item.id === sujetoEnEdicionId)
    const nuevoSujeto: SujetoRegistrado = {
      id: sujetoExistente?.id ?? (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
      nombre: nombreSujeto.trim(),
      tipo: tipoSujeto,
      actividad: resumenActividades.trim(),
      creadoEn: sujetoExistente?.creadoEn ?? new Date(),
      checklistCampos: camposChecklist,
      documentos: {
        detalle: docs.detalle,
        acuse: docs.acuse,
        aceptacion: docs.aceptacion,
      },
      registroCompleto,
      identificacion,
      contactos,
      actividades,
      representante: tipoSujeto === "moral" || tipoSujeto === "fideicomiso" ? representante : null,
    }

    setSujetosRegistrados((prev) => {
      const existenteIndex = sujetoExistente
        ? prev.findIndex((item) => item.id === sujetoExistente.id)
        : prev.findIndex((item) => item.nombre === nuevoSujeto.nombre && item.tipo === tipoSujeto)
      if (existenteIndex >= 0) {
        const copia = [...prev]
        copia[existenteIndex] = nuevoSujeto
        return copia
      }
      return [nuevoSujeto, ...prev]
    })
    setSujetoSeleccionadoId(nuevoSujeto.id)
    setDocumentosRegistro({ detalle: null, acuse: null, aceptacion: null })
    setSujetoEnEdicionId(null)

    toast({
      title: sujetoExistente
        ? "Sujeto obligado actualizado"
        : registroCompleto
          ? "Sujeto obligado registrado"
          : "Registro guardado incompleto",
      description: sujetoExistente
        ? "Los datos y documentos del sujeto se guardaron con los cambios realizados."
        : registroCompleto
          ? "Los documentos de detalle, acuse y aceptación registraron al sujeto automáticamente."
          : "Los documentos obligatorios están pendientes. Completa el expediente para finalizar el alta.",
    })
    return registroCompleto
  }

  const registrarSujetoManual = () => {
    if (!camposObligatoriosCapturados) {
      toast({
        title: "Faltan datos clave",
        description: "Selecciona el tipo de sujeto, completa la identificación y agrega al menos una actividad vulnerable.",
        variant: "destructive",
      })
      return
    }

    const registroCompleto = registrarSujeto(documentosRegistro, { permitirIncompleto: true })
    setActiveTab("registrados")

    if (registroCompleto) {
      limpiarFormulario()
    }
  }

  const manejarCargaDocumentoRegistro = async (
    event: ChangeEvent<HTMLInputElement>,
    tipoDoc: RegistroDocumentKey,
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const documento = await crearDocumentoDesdeArchivo(file, tipoDoc)
      setDocumentos((prev) => [documento, ...prev])
      setDocumentosRegistro((prev) => {
        const actualizado = { ...prev, [tipoDoc]: documento }
        registrarSujeto(actualizado)
        return actualizado
      })

      toast({
        title: `Documento ${tipoDoc === "detalle" ? "detalle" : tipoDoc} cargado`,
        description: `${file.name} se agregó a la carpeta de alta y registro.`,
      })
    } catch (error) {
      console.error("Error al guardar archivo", error)
      toast({
        title: "No se pudo cargar el archivo",
        description: "Verifica el formato y vuelve a intentarlo.",
        variant: "destructive",
      })
    } finally {
      event.target.value = ""
    }
  }

  const iniciarEdicionSujeto = () => {
    if (!sujetoSeleccionado) return

    setTipoSujeto(sujetoSeleccionado.tipo)
    setIdentificacion(sujetoSeleccionado.identificacion ?? createDefaultIdentificacion())
    setContactos(
      sujetoSeleccionado.contactos?.length
        ? sujetoSeleccionado.contactos
        : Array.from({ length: 3 }, () => createDefaultContacto()),
    )
    setActividades(
      sujetoSeleccionado.actividades?.length
        ? sujetoSeleccionado.actividades
        : Array.from({ length: 5 }, () => createDefaultActividad()),
    )
    setRepresentante(sujetoSeleccionado.representante ?? createDefaultRepresentante())
    setDocumentosRegistro(sujetoSeleccionado.documentos)
    setDatosChecklistState(
      obtenerChecklistDesdeCamposConfirmados(sujetoSeleccionado.checklistCampos, sujetoSeleccionado.tipo),
    )
    setSujetoEnEdicionId(sujetoSeleccionado.id)
    setActiveTab("nuevo")

    toast({
      title: "Edición en curso",
      description: "Actualiza los datos y vuelve a guardar para mantener los cambios.",
    })
  }

  const cancelarEdicion = () => {
    setSujetoEnEdicionId(null)
    limpiarFormulario()
  }

  const eliminarSujetoSeleccionado = () => {
    if (!sujetoSeleccionado) return

    const confirmar = window.confirm(
      "¿Deseas eliminar este sujeto obligado? Esta acción no se puede deshacer.",
    )
    if (!confirmar) return

    const idEliminar = sujetoSeleccionado.id

    setSujetosRegistrados((prev) => {
      const actualizados = prev.filter((item) => item.id !== idEliminar)
      const siguienteSeleccion = actualizados[0]?.id ?? null
      setSujetoSeleccionadoId((seleccionActual) => {
        if (seleccionActual && seleccionActual !== idEliminar) return seleccionActual
        return siguienteSeleccion
      })
      return actualizados
    })

    if (sujetoEnEdicionId === idEliminar) {
      cancelarEdicion()
    }

    toast({
      title: "Sujeto eliminado",
      description: "El registro se eliminó de la lista de sujetos obligados.",
    })
  }

  const manejarCargaDocumento = async (event: ChangeEvent<HTMLInputElement>, tipo: string) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const documento = await crearDocumentoDesdeArchivo(file, tipo)
      setDocumentos((prev) => [documento, ...prev])
      toast({
        title: "Documento cargado",
        description: `El documento ${documento.name} se almacenó como evidencia opcional.`,
      })
    } catch (error) {
      console.error("Error al guardar archivo", error)
      toast({
        title: "No se pudo cargar el archivo",
        description: "Verifica el formato y vuelve a intentarlo.",
        variant: "destructive",
      })
    } finally {
      event.target.value = ""
    }
  }

  const actualizarIdentificacionCampo = (campo: keyof IdentificacionSujeto, valor: string) => {
    setIdentificacion((prev) => ({ ...prev, [campo]: valor }))
  }

  const actualizarContactoCampo = (index: number, campo: keyof ContactoSujeto, valor: string) => {
    setContactos((prev) =>
      prev.map((contacto, idx) => (idx === index ? { ...contacto, [campo]: valor } : contacto)),
    )
  }

  const actualizarActividadCampo = (index: number, campo: keyof ActividadSujeto, valor: string) => {
    setActividades((prev) =>
      prev.map((actividad, idx) => (idx === index ? { ...actividad, [campo]: valor } : actividad)),
    )
  }

  const actualizarDomicilioActividadCampo = (index: number, campo: keyof DomicilioActividad, valor: string) => {
    setActividades((prev) =>
      prev.map((actividad, idx) =>
        idx === index ? { ...actividad, domicilio: { ...actividad.domicilio, [campo]: valor } } : actividad,
      ),
    )
  }

  const actualizarRepresentanteCampo = (campo: keyof RepresentanteCumplimiento, valor: string) => {
    setRepresentante((prev) => ({ ...prev, [campo]: valor }))
  }

  const actualizarRepresentanteContactoCampo = (
    campo: keyof RepresentanteCumplimiento["contacto"],
    valor: string,
  ) => {
    setRepresentante((prev) => ({ ...prev, contacto: { ...prev.contacto, [campo]: valor } }))
  }

  const actualizarRepresentanteCertificacionCampo = (
    campo: keyof RepresentanteCumplimiento["certificacion"],
    valor: string,
  ) => {
    setRepresentante((prev) => ({ ...prev, certificacion: { ...prev.certificacion, [campo]: valor } }))
  }

  const sujetoSeleccionado = sujetosRegistrados.find((item) => item.id === sujetoSeleccionadoId)
  const documentosCompletados = (Object.values(documentosRegistro).filter(Boolean) as DocumentUpload[]).length
  const enEdicion = Boolean(sujetoEnEdicionId)

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Alta y Registro ante el SAT</h1>
              <p className="text-muted-foreground">
                Gestiona sujetos obligados, carga automática de detalle, acuse y aceptación, y checklist guiado por anexos.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Sesión guardada en este navegador
            </Badge>
            <Badge variant="secondary">Registro ágil y responsivo</Badge>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="sm:col-span-2 xl:col-span-1">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">Sujetos obligados registrados</p>
              <p className="text-3xl font-bold">{sujetosRegistrados.length}</p>
              <p className="text-xs text-muted-foreground">Cada carga con detalle, acuse y aceptación crea un registro.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 pt-6">
              <p className="text-sm text-muted-foreground">Avance del checklist</p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-3xl font-bold">{datosChecklistResumen.progreso}%</p>
                <Progress value={datosChecklistResumen.progreso} className="h-2 flex-1" />
              </div>
              <p className="text-xs text-muted-foreground">
                {datosChecklistResumen.completados} de {datosChecklistResumen.total} datos listos
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-2 pt-6">
              <p className="text-sm text-muted-foreground">Documentos del alta cargados</p>
              <p className="text-3xl font-bold">{documentosCompletados} / 3</p>
              <p className="text-xs text-muted-foreground">Detalle, acuse y aceptación de designación.</p>
            </CardContent>
          </Card>
          <Card className="sm:col-span-2 xl:col-span-1">
            <CardContent className="space-y-2 pt-6">
              <p className="text-sm font-semibold">Guía rápida</p>
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                <li>Selecciona el tipo de sujeto y completa la identificación.</li>
                <li>Adjunta detalle, acuse y aceptación (botones abajo).</li>
                <li>Usa el botón Registrar sujeto para confirmar.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="registrados" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Sujetos registrados
          </TabsTrigger>
          <TabsTrigger value="nuevo" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Registrar nuevo sujeto obligado
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registrados" className="space-y-4">
          <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Sujetos obligados registrados
                </CardTitle>
                <CardDescription>
                  Selecciona un registro para ver la información cargada y confirmar si el expediente está completo.
                </CardDescription>
                {sujetosRegistrados.length === 0 && (
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                    <span>No hay registros aún.</span>
                  <Button size="sm" onClick={() => setActiveTab("nuevo")}>
                    Comenzar un registro
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-1">
                {sujetosRegistrados.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Aún no hay sujetos obligados registrados. Ingresa los datos iniciales y agrega documentos cuando los tengas.
                  </p>
                ) : (
                  <ScrollArea className="h-[320px] pr-4">
                    <div className="space-y-2">
                      {sujetosRegistrados.map((sujeto) => (
                        <button
                          key={sujeto.id}
                          onClick={() => setSujetoSeleccionadoId(sujeto.id)}
                          className={cn(
                            "w-full rounded-lg border p-3 text-left transition hover:border-primary",
                            sujetoSeleccionadoId === sujeto.id ? "border-primary bg-primary/5" : "border-muted",
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <p className="font-semibold">{sujeto.nombre}</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs text-muted-foreground capitalize">{sujeto.tipo}</p>
                                <Badge variant={sujeto.registroCompleto ? "secondary" : "destructive"}>
                                  {sujeto.registroCompleto ? "Completo" : "Incompleto"}
                                </Badge>
                              </div>
                            </div>
                            <Badge variant="outline">{sujeto.creadoEn.toLocaleDateString()}</Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{sujeto.actividad}</p>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>

              <div className="lg:col-span-2">
                {sujetoSeleccionado ? (
                    <div className="space-y-4 rounded-lg border p-4">
                      <div className="flex flex-wrap items-center gap-3 justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Sujeto obligado</p>
                          <p className="text-2xl font-semibold">{sujetoSeleccionado.nombre}</p>
                          <p className="text-sm text-muted-foreground capitalize">{sujetoSeleccionado.tipo}</p>
                        </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={sujetoSeleccionado.registroCompleto ? "secondary" : "destructive"}>
                          {sujetoSeleccionado.registroCompleto ? "Completo" : "Incompleto"}
                        </Badge>
                        <Badge variant="secondary">
                          Registrado {sujetoSeleccionado.creadoEn.toLocaleDateString()}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={iniciarEdicionSujeto}>
                          Editar
                        </Button>
                        <Button variant="destructive" size="sm" onClick={eliminarSujetoSeleccionado}>
                          Eliminar
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-semibold">Actividad vulnerable registrada</p>
                      <p className="text-sm text-muted-foreground">{sujetoSeleccionado.actividad}</p>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-semibold">Documentos cargados</p>
                      <div className="grid gap-3 md:grid-cols-3">
                        {(Object.entries(sujetoSeleccionado.documentos) as [RegistroDocumentKey, DocumentUpload | null][]).map(
                          ([key, doc]) => (
                            <div key={key} className="rounded-lg border p-3 space-y-1">
                              <p className="text-xs text-muted-foreground uppercase">{key}</p>
                              {doc ? (
                                <>
                                  <p className="font-medium break-words">{doc.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {doc.uploadDate.toLocaleDateString()} · {(doc.size / 1024).toFixed(1)} KB
                                  </p>
                                </>
                              ) : (
                                <p className="text-sm text-muted-foreground">Pendiente de carga</p>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    </div>

                    {sujetoSeleccionado.checklistCampos.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">Datos confirmados del checklist</p>
                        <div className="flex flex-wrap gap-2">
                          {sujetoSeleccionado.checklistCampos.map((campo) => (
                            <Badge key={campo} variant="outline">
                              {campo}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border p-6 text-muted-foreground">
                    Selecciona un sujeto obligado para ver sus documentos y datos registrados.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nuevo" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle>Datos iniciales</CardTitle>
                <CardDescription>
                  Selecciona el tipo de sujeto obligado para habilitar los campos de identificación, contacto y actividades.
                </CardDescription>
              </div>
              {enEdicion && <Badge variant="outline">Editando sujeto</Badge>}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tipo-sujeto">Tipo de Sujeto Obligado</Label>
                  <Select value={tipoSujeto} onValueChange={(value) => setTipoSujeto(value as SubjectType)}>
                    <SelectTrigger id="tipo-sujeto">
                      <SelectValue placeholder="---" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {tiposSujetos.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  Si seleccionas "---", el resto del formulario no aplica. Al elegir un tipo se habilitan los datos de identificación,
                  contacto y actividades vulnerables requeridas.
                </div>
              </div>
              {tipoSujeto === "none" && (
                <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Selecciona un tipo de sujeto obligado para habilitar el resto del formulario.
                </div>
              )}
            </CardContent>
          </Card>
          {tipoSujeto !== "none" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Datos de identificación del Sujeto Obligado</CardTitle>
                  <CardDescription>Captura la información principal del sujeto obligado según su tipo.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="fecha-identificacion">{obtenerEtiquetaFecha(tipoSujeto)}</Label>
                    <Input
                      id="fecha-identificacion"
                      type="date"
                      value={identificacion.fecha}
                      onChange={(event) => actualizarIdentificacionCampo("fecha", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rfc-sujeto">Registro Federal de Contribuyentes (RFC)</Label>
                    <Input
                      id="rfc-sujeto"
                      value={identificacion.rfc}
                      onChange={(event) => actualizarIdentificacionCampo("rfc", event.target.value.toUpperCase())}
                      placeholder="RFC con homoclave"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nombre-sujeto">{obtenerEtiquetaNombre(tipoSujeto)}</Label>
                    <Input
                      id="nombre-sujeto"
                      value={identificacion.nombre}
                      onChange={(event) => actualizarIdentificacionCampo("nombre", event.target.value)}
                      placeholder="Captura el nombre o denominación"
                    />
                  </div>
                  {tipoSujeto === "fisica" && (
                    <div className="space-y-2">
                      <Label htmlFor="apellido-paterno">Apellido Paterno</Label>
                      <Input
                        id="apellido-paterno"
                        value={identificacion.apellidoPaterno}
                        onChange={(event) => actualizarIdentificacionCampo("apellidoPaterno", event.target.value)}
                        placeholder="Apellido paterno"
                      />
                    </div>
                  )}
                  {(tipoSujeto === "fisica" || tipoSujeto === "fideicomiso") && (
                    <div className="space-y-2">
                      <Label htmlFor="pais-nacionalidad">País de Nacionalidad</Label>
                      <Select
                        value={identificacion.paisNacionalidad}
                        onValueChange={(value) => actualizarIdentificacionCampo("paisNacionalidad", value)}
                      >
                        <SelectTrigger id="pais-nacionalidad">
                          <SelectValue placeholder="Selecciona un país" />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {PAISES.map((pais) => (
                            <SelectItem key={pais.code} value={pais.code}>
                              {pais.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {tipoSujeto === "fisica" && (
                    <div className="space-y-2">
                      <Label htmlFor="pais-nacimiento">País de Nacimiento</Label>
                      <Select
                        value={identificacion.paisNacimiento}
                        onValueChange={(value) => actualizarIdentificacionCampo("paisNacimiento", value)}
                      >
                        <SelectTrigger id="pais-nacimiento">
                          <SelectValue placeholder="Selecciona un país" />
                        </SelectTrigger>
                        <SelectContent position="popper">
                          {PAISES.map((pais) => (
                            <SelectItem key={pais.code} value={pais.code}>
                              {pais.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {tipoSujeto === "fisica" && (
                    <div className="space-y-2">
                      <Label htmlFor="curp-sujeto">Clave Única de Registro de Población (CURP)</Label>
                      <Input
                        id="curp-sujeto"
                        value={identificacion.curp}
                        onChange={(event) => actualizarIdentificacionCampo("curp", event.target.value.toUpperCase())}
                        placeholder="CURP"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Datos de contacto del Sujeto Obligado</CardTitle>
                  <CardDescription>Captura hasta tres personas de contacto con los mismos campos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {contactos.map((contacto, index) => (
                    <div key={`contacto-${index}`} className="space-y-4 rounded-lg border p-4">
                      <p className="text-sm font-semibold">Persona {index + 1}</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`contacto-nombre-${index}`}>Nombre completo de la persona contacto</Label>
                          <Input
                            id={`contacto-nombre-${index}`}
                            value={contacto.nombreCompleto}
                            onChange={(event) => actualizarContactoCampo(index, "nombreCompleto", event.target.value)}
                          />
                        </div>
                        <div className="grid gap-4 md:grid-cols-3 md:col-span-2">
                          <div className="space-y-2">
                            <Label htmlFor={`contacto-lada-${index}`}>Clave LADA</Label>
                            <Input
                              id={`contacto-lada-${index}`}
                              value={contacto.claveLada}
                              onChange={(event) => actualizarContactoCampo(index, "claveLada", event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`contacto-fijo-${index}`}>Número Telefónico Fijo</Label>
                            <Input
                              id={`contacto-fijo-${index}`}
                              value={contacto.telefonoFijo}
                              onChange={(event) => actualizarContactoCampo(index, "telefonoFijo", event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`contacto-ext-${index}`}>Extensión (en su caso)</Label>
                            <Input
                              id={`contacto-ext-${index}`}
                              value={contacto.extension}
                              onChange={(event) => actualizarContactoCampo(index, "extension", event.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`contacto-movil-${index}`}>Número Telefónico Móvil</Label>
                          <Input
                            id={`contacto-movil-${index}`}
                            value={contacto.telefonoMovil}
                            onChange={(event) => actualizarContactoCampo(index, "telefonoMovil", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`contacto-correo-${index}`}>Correo Electrónico</Label>
                          <Input
                            id={`contacto-correo-${index}`}
                            type="email"
                            value={contacto.correo}
                            onChange={(event) => actualizarContactoCampo(index, "correo", event.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Actividad Vulnerable</CardTitle>
                  <CardDescription>Captura hasta cinco bloques con actividad vulnerable y domicilio nacional.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {actividades.map((actividad, index) => {
                    const registroSi = actividad.cuentaRegistro === "si"
                    return (
                      <div key={`actividad-${index}`} className="space-y-4 rounded-lg border p-4">
                        <p className="text-sm font-semibold">Actividad Vulnerable ({index + 1})</p>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`actividad-clave-${index}`}>Actividad Vulnerable que pretende realizar</Label>
                            <Select
                              value={actividad.actividadKey}
                              onValueChange={(value) => actualizarActividadCampo(index, "actividadKey", value)}
                            >
                              <SelectTrigger id={`actividad-clave-${index}`}>
                                <SelectValue placeholder="Selecciona una actividad" />
                              </SelectTrigger>
                              <SelectContent position="popper">
                                {actividadesVulnerables.map((item) => (
                                  <SelectItem key={item.key} value={item.key}>
                                    {item.fraccion} · {item.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`actividad-fecha-${index}`}>
                              Fecha en que se realizó por primera vez la Actividad Vulnerable
                            </Label>
                            <Input
                              id={`actividad-fecha-${index}`}
                              type="date"
                              value={actividad.fechaPrimera}
                              onChange={(event) => actualizarActividadCampo(index, "fechaPrimera", event.target.value)}
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor={`actividad-registro-${index}`}>
                              ¿Cuenta con registro / autorización / patente o certificado para realizar la Actividad Vulnerable?
                            </Label>
                            <Select
                              value={actividad.cuentaRegistro}
                              onValueChange={(value) => actualizarActividadCampo(index, "cuentaRegistro", value)}
                            >
                              <SelectTrigger id={`actividad-registro-${index}`}>
                                <SelectValue placeholder="Selecciona una opción" />
                              </SelectTrigger>
                              <SelectContent position="popper">
                                <SelectItem value="si">Sí</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {registroSi && (
                          <div className="grid gap-4 md:grid-cols-2 rounded-lg border border-dashed p-4">
                            <div className="space-y-2">
                              <Label htmlFor={`actividad-doc-tipo-${index}`}>Tipo de Documento</Label>
                              <Select
                                value={actividad.tipoDocumento}
                                onValueChange={(value) => actualizarActividadCampo(index, "tipoDocumento", value)}
                              >
                                <SelectTrigger id={`actividad-doc-tipo-${index}`}>
                                  <SelectValue placeholder="Selecciona" />
                                </SelectTrigger>
                                <SelectContent position="popper">
                                  {opcionesDocumento.map((opcion) => (
                                    <SelectItem key={opcion} value={opcion}>
                                      {opcion}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`actividad-doc-autoridad-${index}`}>Autoridad que lo emite</Label>
                              <Select
                                value={actividad.autoridadDocumento}
                                onValueChange={(value) => actualizarActividadCampo(index, "autoridadDocumento", value)}
                              >
                                <SelectTrigger id={`actividad-doc-autoridad-${index}`}>
                                  <SelectValue placeholder="Selecciona" />
                                </SelectTrigger>
                                <SelectContent position="popper">
                                  {opcionesAutoridad.map((opcion) => (
                                    <SelectItem key={opcion} value={opcion}>
                                      {opcion}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`actividad-doc-folio-${index}`}>Número o Folio de identificación</Label>
                              <Input
                                id={`actividad-doc-folio-${index}`}
                                value={actividad.folioDocumento}
                                onChange={(event) => actualizarActividadCampo(index, "folioDocumento", event.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`actividad-doc-periodo-${index}`}>Periodo que ampara el registro</Label>
                              <Input
                                id={`actividad-doc-periodo-${index}`}
                                value={actividad.periodoDocumento}
                                onChange={(event) => actualizarActividadCampo(index, "periodoDocumento", event.target.value)}
                                placeholder="YYYY-MM-DD o rango"
                              />
                            </div>
                          </div>
                        )}

                        <div className="space-y-4 rounded-lg border border-dashed p-4">
                          <p className="text-sm font-semibold">
                            Domicilio en Territorio Nacional donde lleva a cabo la Actividad Vulnerable ({index + 1})
                          </p>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor={`domicilio-cp-${index}`}>Código Postal</Label>
                              <Input
                                id={`domicilio-cp-${index}`}
                                value={actividad.domicilio.codigoPostal}
                                onChange={(event) =>
                                  actualizarDomicilioActividadCampo(index, "codigoPostal", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`domicilio-tipo-${index}`}>Tipo de Vialidad</Label>
                              <Input
                                id={`domicilio-tipo-${index}`}
                                value={actividad.domicilio.tipoVialidad}
                                onChange={(event) =>
                                  actualizarDomicilioActividadCampo(index, "tipoVialidad", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`domicilio-nombre-${index}`}>Nombre de la Vialidad</Label>
                              <Input
                                id={`domicilio-nombre-${index}`}
                                value={actividad.domicilio.nombreVialidad}
                                onChange={(event) =>
                                  actualizarDomicilioActividadCampo(index, "nombreVialidad", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`domicilio-ext-${index}`}>Número Exterior</Label>
                              <Input
                                id={`domicilio-ext-${index}`}
                                value={actividad.domicilio.numeroExterior}
                                onChange={(event) =>
                                  actualizarDomicilioActividadCampo(index, "numeroExterior", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`domicilio-int-${index}`}>Número Interior</Label>
                              <Input
                                id={`domicilio-int-${index}`}
                                value={actividad.domicilio.numeroInterior}
                                onChange={(event) =>
                                  actualizarDomicilioActividadCampo(index, "numeroInterior", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`domicilio-colonia-${index}`}>Colonia / Urbanización</Label>
                              <Input
                                id={`domicilio-colonia-${index}`}
                                value={actividad.domicilio.colonia}
                                onChange={(event) =>
                                  actualizarDomicilioActividadCampo(index, "colonia", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`domicilio-alcaldia-${index}`}>Alcaldía / Municipio</Label>
                              <Input
                                id={`domicilio-alcaldia-${index}`}
                                value={actividad.domicilio.alcaldia}
                                placeholder="Se completa con el CP"
                                disabled
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`domicilio-entidad-${index}`}>Entidad / Estado / Provincia</Label>
                              <Input
                                id={`domicilio-entidad-${index}`}
                                value={actividad.domicilio.entidad}
                                placeholder="Se completa con el CP"
                                disabled
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`domicilio-pais-${index}`}>País</Label>
                              <Input id={`domicilio-pais-${index}`} value={actividad.domicilio.pais} disabled />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              {(tipoSujeto === "moral" || tipoSujeto === "fideicomiso") && (
                <Card>
                  <CardHeader>
                    <CardTitle>Representante Encargado de Cumplimiento</CardTitle>
                    <CardDescription>Se captura únicamente para personas morales y fideicomisos.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <p className="text-sm font-semibold">Datos del Representante Encargado de Cumplimiento</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="rec-nombres">Nombre(s) (sin abreviaturas)</Label>
                          <Input
                            id="rec-nombres"
                            value={representante.nombre}
                            onChange={(event) => actualizarRepresentanteCampo("nombre", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-apellido-paterno">Apellido Paterno</Label>
                          <Input
                            id="rec-apellido-paterno"
                            value={representante.apellidoPaterno}
                            onChange={(event) => actualizarRepresentanteCampo("apellidoPaterno", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-apellido-materno">Apellido Materno</Label>
                          <Input
                            id="rec-apellido-materno"
                            value={representante.apellidoMaterno}
                            onChange={(event) => actualizarRepresentanteCampo("apellidoMaterno", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-fecha-nacimiento">Fecha de Nacimiento</Label>
                          <Input
                            id="rec-fecha-nacimiento"
                            type="date"
                            value={representante.fechaNacimiento}
                            onChange={(event) => actualizarRepresentanteCampo("fechaNacimiento", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-rfc">RFC</Label>
                          <Input
                            id="rec-rfc"
                            value={representante.rfc}
                            onChange={(event) => actualizarRepresentanteCampo("rfc", event.target.value.toUpperCase())}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-curp">CURP</Label>
                          <Input
                            id="rec-curp"
                            value={representante.curp}
                            onChange={(event) => actualizarRepresentanteCampo("curp", event.target.value.toUpperCase())}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-pais">País de Nacionalidad</Label>
                          <Select
                            value={representante.paisNacionalidad}
                            onValueChange={(value) => actualizarRepresentanteCampo("paisNacionalidad", value)}
                          >
                            <SelectTrigger id="rec-pais">
                              <SelectValue placeholder="Selecciona un país" />
                            </SelectTrigger>
                            <SelectContent position="popper">
                              {PAISES.map((pais) => (
                                <SelectItem key={pais.code} value={pais.code}>
                                  {pais.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-fecha-designacion">Fecha de Designación</Label>
                          <Input
                            id="rec-fecha-designacion"
                            type="date"
                            value={representante.fechaDesignacion}
                            onChange={(event) => actualizarRepresentanteCampo("fechaDesignacion", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-fecha-aceptacion">Fecha de Aceptación de la Designación</Label>
                          <Input
                            id="rec-fecha-aceptacion"
                            type="date"
                            value={representante.fechaAceptacion}
                            onChange={(event) => actualizarRepresentanteCampo("fechaAceptacion", event.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm font-semibold">Datos de contacto del Representante Encargado de Cumplimiento</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="rec-lada">Clave LADA</Label>
                          <Input
                            id="rec-lada"
                            value={representante.contacto.claveLada}
                            onChange={(event) => actualizarRepresentanteContactoCampo("claveLada", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-telefono">Número Telefónico Fijo</Label>
                          <Input
                            id="rec-telefono"
                            value={representante.contacto.telefonoFijo}
                            onChange={(event) => actualizarRepresentanteContactoCampo("telefonoFijo", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-extension">Extensión (en su caso)</Label>
                          <Input
                            id="rec-extension"
                            value={representante.contacto.extension}
                            onChange={(event) => actualizarRepresentanteContactoCampo("extension", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-movil">Número Telefónico Móvil</Label>
                          <Input
                            id="rec-movil"
                            value={representante.contacto.telefonoMovil}
                            onChange={(event) => actualizarRepresentanteContactoCampo("telefonoMovil", event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rec-correo">Correo Electrónico</Label>
                          <Input
                            id="rec-correo"
                            type="email"
                            value={representante.contacto.correo}
                            onChange={(event) => actualizarRepresentanteContactoCampo("correo", event.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm font-semibold">Credenciales del Representante Encargado de Cumplimiento</p>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="rec-certificacion">
                            ¿El Representante Encargado de Cumplimiento cuenta con Certificación en materia de PLD/FT?
                          </Label>
                          <Select
                            value={representante.certificacion.respuesta}
                            onValueChange={(value) =>
                              actualizarRepresentanteCertificacionCampo("respuesta", value)
                            }
                          >
                            <SelectTrigger id="rec-certificacion">
                              <SelectValue placeholder="Selecciona una opción" />
                            </SelectTrigger>
                            <SelectContent position="popper">
                              <SelectItem value="si">Sí</SelectItem>
                              <SelectItem value="no">No</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {representante.certificacion.respuesta === "si" && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="rec-cert-tipo">Tipo de Documento</Label>
                              <Select
                                value={representante.certificacion.tipoDocumento}
                                onValueChange={(value) =>
                                  actualizarRepresentanteCertificacionCampo("tipoDocumento", value)
                                }
                              >
                                <SelectTrigger id="rec-cert-tipo">
                                  <SelectValue placeholder="Selecciona" />
                                </SelectTrigger>
                                <SelectContent position="popper">
                                  {opcionesDocumento.map((opcion) => (
                                    <SelectItem key={opcion} value={opcion}>
                                      {opcion}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="rec-cert-autoridad">Autoridad que lo emite</Label>
                              <Select
                                value={representante.certificacion.autoridadDocumento}
                                onValueChange={(value) =>
                                  actualizarRepresentanteCertificacionCampo("autoridadDocumento", value)
                                }
                              >
                                <SelectTrigger id="rec-cert-autoridad">
                                  <SelectValue placeholder="Selecciona" />
                                </SelectTrigger>
                                <SelectContent position="popper">
                                  {opcionesAutoridad.map((opcion) => (
                                    <SelectItem key={opcion} value={opcion}>
                                      {opcion}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="rec-cert-folio">Número o Folio de identificación</Label>
                              <Input
                                id="rec-cert-folio"
                                value={representante.certificacion.folioDocumento}
                                onChange={(event) =>
                                  actualizarRepresentanteCertificacionCampo("folioDocumento", event.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="rec-cert-periodo">Periodo que ampara el registro</Label>
                              <Input
                                id="rec-cert-periodo"
                                value={representante.certificacion.periodoDocumento}
                                onChange={(event) =>
                                  actualizarRepresentanteCertificacionCampo("periodoDocumento", event.target.value)
                                }
                                placeholder="YYYY-MM-DD o rango"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <CardTitle>Documentos obligatorios del alta</CardTitle>
                <CardDescription>
                  Carga detalle, acuse y aceptación de designación de encargado. Si faltan, podrás guardar el registro y quedará
                  marcado como incompleto.
                </CardDescription>
              </div>
              <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
                <Button className="w-full md:w-auto" onClick={registrarSujetoManual} disabled={!camposObligatoriosCapturados}>
                  {enEdicion ? "Actualizar sujeto obligado" : "Registrar sujeto obligado"}
                </Button>
                {enEdicion && (
                  <Button variant="ghost" className="w-full md:w-auto" onClick={cancelarEdicion}>
                    Cancelar edición
                  </Button>
                )}
                <p className="text-xs text-muted-foreground text-left md:text-right">
                  Se confirmará el registro y el formulario quedará listo para el siguiente sujeto.
                </p>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {(
                [
                  { id: "detalle", label: "Detalle de alta" },
                  { id: "acuse", label: "Acuse del SAT" },
                  { id: "aceptacion", label: "Aceptación de designación" },
                ] as { id: RegistroDocumentKey; label: string }[]
              ).map((doc) => {
                const documento = documentosRegistro[doc.id]
                return (
                  <div key={doc.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{doc.label}</p>
                        <p className="text-xs text-muted-foreground">PDF o XML</p>
                      </div>
                      <Badge variant={documento ? "default" : "outline"}>
                        {documento ? "Cargado" : "Pendiente"}
                      </Badge>
                    </div>
                    <Button variant="outline" className="w-full" asChild>
                      <label className="flex cursor-pointer items-center justify-center gap-2">
                        <Upload className="h-4 w-4" />
                        {documento ? "Reemplazar archivo" : "Subir archivo"}
                        <input
                          type="file"
                          className="sr-only"
                          onChange={(event) => manejarCargaDocumentoRegistro(event, doc.id)}
                        />
                      </label>
                    </Button>
                    {documento && (
                      <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                          <Paperclip className="h-3.5 w-3.5" />
                          <span className="truncate" title={documento.name}>
                            {documento.name}
                          </span>
                        </div>
                        <p>{documento.uploadDate.toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                )
              })}
              <div className="md:col-span-3 grid gap-3 rounded-lg border bg-muted/40 p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <ClipboardList className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold">Checklist listo para múltiples registros</p>
                    <p className="text-sm text-muted-foreground">
                      Reutiliza el checklist para cada sujeto. Al registrar, el formulario se limpia para iniciar el siguiente.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant={camposObligatoriosCapturados ? "default" : "outline"}>Datos capturados</Badge>
                  <Badge variant={documentosRequeridosCompletos ? "default" : "outline"}>Documentos listos</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checklist guiado por anexos</CardTitle>
              <CardDescription>
                Marca los datos solicitados por el anexo correspondiente para evitar consultar las reglas manualmente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Avance</span>
                  <span className="text-sm font-semibold">{datosChecklistResumen.progreso}%</span>
                </div>
                <Progress value={datosChecklistResumen.progreso} className="h-2" />
              </div>

              <div className="space-y-4">
                {seccionesAplicables.map((section) => {
                  const completados = section.fields.filter((field) => datosChecklistState[field.id]?.completed).length
                  const progresoSeccion = Math.round((completados / section.fields.length) * 100)
                  const Icon = section.icon

                  return (
                    <Card key={section.id} className="border-dashed">
                      <CardHeader className="pb-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <Icon className="h-5 w-5 text-primary" />
                              {section.title}
                            </CardTitle>
                            <CardDescription>{section.description}</CardDescription>
                          </div>
                          <Badge variant="outline">{progresoSeccion}%</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {section.fields.map((field) => (
                          <div
                            key={field.id}
                            className="space-y-3 rounded-lg border border-dashed bg-muted/30 p-4"
                          >
                            <div className="flex items-start gap-3">
                              <Checkbox
                                id={`dato-${field.id}`}
                                checked={datosChecklistState[field.id]?.completed ?? false}
                                onCheckedChange={(checked) => actualizarEstatusDatoChecklist(field.id, checked === true)}
                                className="mt-1"
                              />
                              <div className="flex-1 space-y-1">
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
                                onChange={(event) => actualizarNotasDatoChecklist(field.id, event.target.value)}
                                placeholder="Anota folios, responsables o ubicación del respaldo."
                              />
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evidencia documental recomendada</CardTitle>
              <CardDescription>
                No es obligatoria, pero ayuda a completar el expediente de alta y registro (acta, situación fiscal, domicilio).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {evidenciasRecomendadas.map((doc) => (
                <div key={doc.id} className="space-y-3 rounded-lg border p-4">
                  <div className="space-y-1">
                    <p className="font-semibold">{doc.label}</p>
                    <p className="text-sm text-muted-foreground">{doc.descripcion}</p>
                  </div>
                  <Button variant="outline" className="w-full" asChild>
                    <label className="flex cursor-pointer items-center justify-center gap-2">
                      <Upload className="h-4 w-4" />
                      Adjuntar
                      <input
                        type="file"
                        className="sr-only"
                        onChange={(event) => manejarCargaDocumento(event, doc.id)}
                      />
                    </label>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
          </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
