"use client"

import { Suspense, useEffect, useMemo, useState, type ChangeEvent } from "react"
import { useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import {
  Building2,
  FileText,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react"
import { CLIENTE_TIPOS, findClienteTipoLabel, findClienteTipoOption } from "@/lib/data/tipos-cliente"
import {
  type DocumentStatus,
  type PersonaReportada,
  type RespuestaBinaria,
} from "@/lib/types/expediente"

interface CampoExpediente {
  id: string
  label: string
  requerido?: boolean
  type?: string
  multiline?: boolean
  placeholder?: string
}

interface GrupoIdentificacion {
  id: string
  titulo: string
  descripcion: string
  campos: CampoExpediente[]
}

interface DocumentoRequerido {
  id: string
  titulo: string
  descripcion: string
  obligatorio?: boolean
}

const IDENTIFICACION_CAMPOS: GrupoIdentificacion[] = [
  {
    id: "datos-generales",
    titulo: "Datos generales del cliente",
    descripcion: "Información básica necesaria para identificar plenamente a la persona física o moral.",
    campos: [
      { id: "nombre", label: "Nombre / Razón social", requerido: true, placeholder: "Ej. Grupo Ejemplar, S.A. de C.V." },
      { id: "rfc", label: "RFC", requerido: true, placeholder: "Ej. GEX123456789", type: "text" },
      { id: "curp", label: "CURP", placeholder: "Para personas físicas", type: "text" },
      {
        id: "fecha-constitucion",
        label: "Fecha de constitución / nacimiento",
        type: "date",
        requerido: false,
      },
      { id: "nacionalidad", label: "Nacionalidad", requerido: true, placeholder: "Ej. Mexicana" },
    ],
  },
  {
    id: "contacto-actividad",
    titulo: "Actividad y medios de contacto",
    descripcion: "Datos que permitirán prellenar avisos y verificar la actividad económica declarada.",
    campos: [
      { id: "domicilio", label: "Domicilio completo", requerido: true, multiline: true, placeholder: "Calle, número, colonia, municipio, estado, país" },
      { id: "telefono", label: "Teléfono de contacto", placeholder: "Incluye lada o clave internacional" },
      { id: "correo", label: "Correo electrónico", placeholder: "Ej. cumplimiento@empresa.com", type: "email" },
      { id: "actividad-economica", label: "Actividad económica", requerido: true, placeholder: "Giro comercial o profesional" },
      { id: "origen-recursos", label: "Origen declarado de los recursos", multiline: true },
    ],
  },
  {
    id: "documentos",
    titulo: "Documentos soporte",
    descripcion: "Actas constitutivas, poderes notariales e identificaciones vigentes.",
    campos: [
      { id: "identificacion", label: "Identificación oficial presentada", requerido: true },
      { id: "numero-identificacion", label: "Número de identificación", requerido: true },
      { id: "situacion-fiscal", label: "Constancia de situación fiscal", requerido: true },
      { id: "comprobante", label: "Comprobante de domicilio", requerido: true },
      { id: "documentos-adicionales", label: "Otros documentos relevantes", multiline: true },
    ],
  },
]

const DOCUMENTACION_REQUERIDA: DocumentoRequerido[] = [
  {
    id: "identificacion-oficial",
    titulo: "Identificación oficial vigente",
    descripcion: "INE, pasaporte, cédula profesional o documento migratorio vigente de la persona obligada o representante.",
    obligatorio: true,
  },
  {
    id: "acta-constitutiva",
    titulo: "Acta constitutiva / acta de nacimiento",
    descripcion: "Documento que acredita la creación de la persona moral o la identidad de la persona física.",
    obligatorio: true,
  },
  {
    id: "poder-notarial",
    titulo: "Poderes notariales",
    descripcion: "Poder general o especial que faculta al representante legal para actos de administración.",
  },
  {
    id: "situacion-fiscal",
    titulo: "Constancia de situación fiscal",
    descripcion: "Documento emitido por el SAT con datos de régimen, domicilio fiscal y obligaciones vigentes.",
    obligatorio: true,
  },
  {
    id: "comprobante-domicilio",
    titulo: "Comprobante de domicilio",
    descripcion: "Recibo de servicios, estado de cuenta o constancia de residencia con antigüedad no mayor a 3 meses.",
    obligatorio: true,
  },
  {
    id: "estructura-accionaria",
    titulo: "Estructura accionaria y beneficiarios",
    descripcion: "Relación de accionistas o beneficiarios finales con porcentaje de participación y documentación soporte.",
  },
  {
    id: "declaracion-pep",
    titulo: "Declaración de Personas Políticamente Expuestas",
    descripcion: "Formato firmado donde el cliente manifiesta si es o no PEP y detalla el cargo en su caso.",
  },
]

type DocumentStatus = "pendiente" | "en-proceso" | "completo"

const DOCUMENTO_STATUS: { value: DocumentStatus; label: string; classes: string }[] = [
  { value: "pendiente", label: "Pendiente", classes: "bg-rose-100 text-rose-700" },
  { value: "en-proceso", label: "En revisión", classes: "bg-amber-100 text-amber-700" },
  { value: "completo", label: "Completo", classes: "bg-emerald-100 text-emerald-700" },
]

const DATOS_FISCALES_CAMPOS: CampoExpediente[] = [
  { id: "regimen-fiscal", label: "Régimen fiscal", requerido: true, placeholder: "Ej. General de Ley Personas Morales" },
  {
    id: "fecha-inicio-operaciones",
    label: "Fecha de inicio de operaciones",
    type: "date",
    requerido: true,
  },
  {
    id: "actividad-sat",
    label: "Actividad económica registrada ante el SAT",
    requerido: true,
    placeholder: "Descripción según constancia de situación fiscal",
  },
  {
    id: "registro-publico",
    label: "Folio en el Registro Público de Comercio",
    placeholder: "Número de folio mercantil o equivalente",
  },
  {
    id: "datos-notario",
    label: "Datos del notario y escritura",
    multiline: true,
    placeholder: "Nombre del notario, número de escritura y fecha",
  },
  {
    id: "obligaciones-fiscales",
    label: "Obligaciones fiscales registradas",
    multiline: true,
    placeholder: "IVA, ISR, DIOT, Contabilidad electrónica, etc.",
  },
]

const PERFIL_OPERACION_CAMPOS: CampoExpediente[] = [
  {
    id: "origen-fondos",
    label: "Origen de los recursos",
    requerido: true,
    multiline: true,
    placeholder: "Describe la procedencia lícita del patrimonio y de los fondos que operará.",
  },
  {
    id: "destino-fondos",
    label: "Destino habitual de los recursos",
    requerido: true,
    multiline: true,
    placeholder: "Uso previsto de los recursos dentro de la relación comercial.",
  },
  {
    id: "productos-servicios",
    label: "Productos o servicios contratados",
    multiline: true,
    placeholder: "Detalla los servicios que recibirá y su finalidad.",
  },
  {
    id: "montos-frecuencia",
    label: "Montos y frecuencia estimada",
    multiline: true,
    placeholder: "Rango de importes y periodicidad de operaciones.",
  },
  {
    id: "medios-pago",
    label: "Medios de pago utilizados",
    multiline: true,
    placeholder: "Transferencias bancarias, efectivo, cheques, criptomonedas, etc.",
  },
]

const DOMICILIO_TIPOS = [
  { value: "nacional", label: "Domicilio nacional" },
  { value: "extranjero", label: "Domicilio extranjero" },
]

const PERSONA_TIPO_OPCIONES = [
  { value: "persona_moral", label: "Persona moral" },
  { value: "persona_fisica", label: "Persona física" },
]

const CLIENTES_STORAGE_KEY = "actividades_vulnerables_clientes"
const EXPEDIENTE_DETALLE_STORAGE_KEY = "kyc_expedientes_detalle"

function generarIdTemporal() {
  return Math.random().toString(36).slice(2, 10)
}

function crearPersonaBase(): PersonaReportada {
  return {
    id: generarIdTemporal(),
    tipo: "persona_moral",
    denominacion: "",
    fechaConstitucion: "",
    rfc: "",
    curp: "",
    pais: "México",
    giro: "",
    rolRelacion: "Cliente",
    representante: {
      nombre: "",
      apellidoPaterno: "",
      apellidoMaterno: "",
      fechaNacimiento: "",
      rfc: "",
      curp: "",
    },
    domicilio: {
      ambito: "nacional",
      pais: "México",
      entidad: "",
      municipio: "",
      colonia: "",
      codigoPostal: "",
      calle: "",
      numeroExterior: "",
      numeroInterior: "",
    },
    contacto: {
      conoceTelefono: "si",
      conocePaisTelefono: "si",
      clavePais: "MX",
      telefono: "",
      correo: "",
    },
    identificacion: {
      tipo: "",
      numero: "",
      pais: "México",
      fechaVencimiento: "",
    },
    participacion: {
      porcentajeCapital: "",
      origenRecursos: "",
      esPep: "no",
      detallePep: "",
    },
  }
}

export default function KycExpedientePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-sm text-slate-500">
          <span className="h-3 w-3 animate-pulse rounded-full bg-slate-300" />
          Cargando expediente KYC...
        </div>
      }
    >
      <KycExpedienteContent />
    </Suspense>
  )
}

function obtenerStatusDocumento(value: DocumentStatus | undefined) {
  const fallback = DOCUMENTO_STATUS[0]
  if (!value) return fallback
  return DOCUMENTO_STATUS.find((item) => item.value === value) ?? fallback
}

function KycExpedienteContent() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [tipoCliente, setTipoCliente] = useState<string>(CLIENTE_TIPOS[0]?.value ?? "")
  const [detalleTipoCliente, setDetalleTipoCliente] = useState<string>("")
  const [responsable, setResponsable] = useState("")
  const [nombreExpediente, setNombreExpediente] = useState("")
  const [claveSujetoObligado, setClaveSujetoObligado] = useState("")
  const [claveActividadVulnerable, setClaveActividadVulnerable] = useState("")
  const [datosIdentificacion, setDatosIdentificacion] = useState<Record<string, string>>({})
  const [datosFiscales, setDatosFiscales] = useState<Record<string, string>>({})
  const [perfilOperaciones, setPerfilOperaciones] = useState<Record<string, string>>({})
  const [documentacionEstado, setDocumentacionEstado] = useState<Record<string, DocumentStatus>>({})
  const [personasReportadas, setPersonasReportadas] = useState<PersonaReportada[]>(() => [crearPersonaBase()])

  const tipoClienteSeleccionado = useMemo(() => findClienteTipoOption(tipoCliente), [tipoCliente])
  const tipoClienteLabel = useMemo(() => findClienteTipoLabel(tipoCliente), [tipoCliente])
  const tipoClienteResumen = useMemo(
    () => (detalleTipoCliente ? `${tipoClienteLabel} – ${detalleTipoCliente}` : tipoClienteLabel),
    [detalleTipoCliente, tipoClienteLabel],
  )

  const totalCamposIdentificacion = useMemo(
    () => IDENTIFICACION_CAMPOS.reduce((acc, grupo) => acc + grupo.campos.length, 0),
    [],
  )
  const camposIdentificacionCompletos = useMemo(
    () =>
      IDENTIFICACION_CAMPOS.flatMap((grupo) => grupo.campos).filter((campo) => {
        const valor = datosIdentificacion[campo.id]
        return typeof valor === "string" && valor.trim().length > 0
      }).length,
    [datosIdentificacion],
  )

  const totalCamposFiscales = DATOS_FISCALES_CAMPOS.length
  const camposFiscalesCompletos = useMemo(
    () => DATOS_FISCALES_CAMPOS.filter((campo) => datosFiscales[campo.id]?.trim()).length,
    [datosFiscales],
  )

  const totalCamposPerfil = PERFIL_OPERACION_CAMPOS.length
  const camposPerfilCompletos = useMemo(
    () => PERFIL_OPERACION_CAMPOS.filter((campo) => perfilOperaciones[campo.id]?.trim()).length,
    [perfilOperaciones],
  )

  const documentosCompletos = useMemo(
    () => DOCUMENTACION_REQUERIDA.filter((doc) => documentacionEstado[doc.id] === "completo").length,
    [documentacionEstado],
  )

  const progresoGlobal = useMemo(() => {
    const total = totalCamposIdentificacion + totalCamposFiscales + totalCamposPerfil + DOCUMENTACION_REQUERIDA.length
    if (total === 0) return 0
    const completados =
      camposIdentificacionCompletos + camposFiscalesCompletos + camposPerfilCompletos + documentosCompletos
    return Math.min(100, Math.round((completados / total) * 100))
  }, [
    totalCamposIdentificacion,
    totalCamposFiscales,
    totalCamposPerfil,
    camposIdentificacionCompletos,
    camposFiscalesCompletos,
    camposPerfilCompletos,
    documentosCompletos,
  ])

  useEffect(() => {
    if (!tipoClienteSeleccionado?.requiresDetalle) {
      setDetalleTipoCliente("")
      return
    }

    if (tipoClienteSeleccionado.detalleOpciones) {
      setDetalleTipoCliente((prev) => {
        if (tipoClienteSeleccionado.detalleOpciones?.some((option) => option.value === prev)) {
          return prev
        }
        return ""
      })
    }
  }, [tipoClienteSeleccionado])

  useEffect(() => {
    if (typeof window === "undefined") return

    const parametro = searchParams?.get("buscar")?.trim()
    if (!parametro) return

    try {
      const stored = window.localStorage.getItem(CLIENTES_STORAGE_KEY)
      const detalleStored = window.localStorage.getItem(EXPEDIENTE_DETALLE_STORAGE_KEY)
      const parsedDetalle = detalleStored ? JSON.parse(detalleStored) : []

      const parsed = stored ? (JSON.parse(stored) as Array<Record<string, unknown>>) : []
      const criterio = parametro.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase()
      const coincidencia = Array.isArray(parsed)
        ? parsed.find((item) => {
            if (!item) return false
            const rfc = typeof item.rfc === "string" ? item.rfc : ""
            const nombre = typeof item.nombre === "string" ? item.nombre : ""
            const normalizadoRfc = rfc.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase()
            const normalizadoNombre = nombre.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase()
            return normalizadoRfc === criterio || (normalizadoNombre !== "" && normalizadoNombre === criterio)
          })
        : undefined

      if (!coincidencia) {
        toast({
          title: "Cliente no encontrado",
          description: "No se localizó el cliente en las actividades vulnerables recientes.",
          variant: "destructive",
        })
        return
      }

      const tipoGuardado = typeof coincidencia.tipoCliente === "string" ? coincidencia.tipoCliente : ""
      const detalleGuardado =
        typeof coincidencia.detalleTipoCliente === "string" ? coincidencia.detalleTipoCliente : ""
      const tipoDetectado = findClienteTipoOption(tipoGuardado)
      if (tipoDetectado) {
        setTipoCliente(tipoDetectado.value)
        if (tipoDetectado.requiresDetalle) {
          if (tipoDetectado.detalleOpciones) {
            setDetalleTipoCliente(
              tipoDetectado.detalleOpciones.some((detalle) => detalle.value === detalleGuardado)
                ? detalleGuardado
                : "",
            )
          } else {
            setDetalleTipoCliente(detalleGuardado)
          }
        }
      }

      setDatosIdentificacion((prev) => ({
        ...prev,
        nombre: typeof coincidencia.nombre === "string" ? coincidencia.nombre : prev.nombre ?? "",
        rfc: typeof coincidencia.rfc === "string" ? coincidencia.rfc : prev.rfc ?? "",
      }))
      if (typeof coincidencia.nombre === "string") {
        setNombreExpediente(coincidencia.nombre)
      }

      if (Array.isArray(parsedDetalle)) {
        const detalleCoincidente = parsedDetalle.find((item: any) => {
          if (!item || typeof item !== "object") return false
          const rfc = typeof item.rfc === "string" ? item.rfc : ""
          const nombre = typeof item.nombre === "string" ? item.nombre : ""
          const normalizadoRfc = rfc.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase()
          const normalizadoNombre = nombre.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase()
          return normalizadoRfc === criterio || (normalizadoNombre !== "" && normalizadoNombre === criterio)
        })

        if (detalleCoincidente && typeof detalleCoincidente === "object") {
          const detalleObj = detalleCoincidente as Record<string, unknown>
          if (typeof detalleObj.responsable === "string") setResponsable(detalleObj.responsable)
          if (typeof detalleObj.claveSujetoObligado === "string") setClaveSujetoObligado(detalleObj.claveSujetoObligado)
          if (typeof detalleObj.claveActividadVulnerable === "string")
            setClaveActividadVulnerable(detalleObj.claveActividadVulnerable)
          if (detalleObj.identificacion && typeof detalleObj.identificacion === "object") {
            setDatosIdentificacion((prev) => ({
              ...prev,
              ...(detalleObj.identificacion as Record<string, string>),
            }))
          }
          if (detalleObj.datosFiscales && typeof detalleObj.datosFiscales === "object") {
            setDatosFiscales(detalleObj.datosFiscales as Record<string, string>)
          }
          if (detalleObj.perfilOperaciones && typeof detalleObj.perfilOperaciones === "object") {
            setPerfilOperaciones(detalleObj.perfilOperaciones as Record<string, string>)
          }
          if (detalleObj.documentacion && typeof detalleObj.documentacion === "object") {
            setDocumentacionEstado(detalleObj.documentacion as Record<string, DocumentStatus>)
          }
          if (Array.isArray(detalleObj.personas)) {
            setPersonasReportadas(
              detalleObj.personas.map((item: any) => {
                const base = crearPersonaBase()
                if (!item || typeof item !== "object") return base
                return {
                  ...base,
                  id: typeof item.id === "string" ? item.id : generarIdTemporal(),
                  tipo:
                    PERSONA_TIPO_OPCIONES.some((option) => option.value === item.tipo) && typeof item.tipo === "string"
                      ? item.tipo
                      : base.tipo,
                  denominacion:
                    typeof item.denominacion === "string" ? item.denominacion : base.denominacion,
                  fechaConstitucion:
                    typeof item.fechaConstitucion === "string" ? item.fechaConstitucion : base.fechaConstitucion,
                  rfc: typeof item.rfc === "string" ? item.rfc : base.rfc,
                  curp: typeof item.curp === "string" ? item.curp : base.curp,
                  pais: typeof item.pais === "string" ? item.pais : base.pais,
                  giro: typeof item.giro === "string" ? item.giro : base.giro,
                  rolRelacion:
                    typeof item.rolRelacion === "string" ? item.rolRelacion : base.rolRelacion,
                  representante: {
                    ...base.representante,
                    ...(typeof item.representante === "object" && item.representante
                      ? item.representante
                      : {}),
                  },
                  domicilio: {
                    ...base.domicilio,
                    ...(typeof item.domicilio === "object" && item.domicilio ? item.domicilio : {}),
                  },
                  contacto: {
                    ...base.contacto,
                    ...(typeof item.contacto === "object" && item.contacto ? item.contacto : {}),
                  },
                  identificacion: {
                    ...base.identificacion,
                    ...(typeof item.identificacion === "object" && item.identificacion
                      ? item.identificacion
                      : {}),
                  },
                  participacion: {
                    ...base.participacion,
                    ...(typeof item.participacion === "object" && item.participacion
                      ? item.participacion
                      : {}),
                  },
                }
              }),
            )
          }
        }
      }

      toast({
        title: "Cliente sincronizado",
        description: "Se importó la información capturada previamente en actividades vulnerables.",
      })
    } catch (error) {
      console.error("No fue posible sincronizar el cliente desde actividades vulnerables", error)
    }
  }, [searchParams, toast])

  const actualizarPersonaReportada = (id: string, updater: (persona: PersonaReportada) => PersonaReportada) => {
    setPersonasReportadas((prev) => prev.map((persona) => (persona.id === id ? updater(persona) : persona)))
  }

  const agregarPersonaReportada = () => {
    const nuevaPersona = crearPersonaBase()
    setPersonasReportadas((prev) => [...prev, nuevaPersona])
    toast({
      title: "Persona añadida",
      description: "Se agregó un nuevo registro para documentar otra persona relacionada.",
    })
  }

  const eliminarPersonaReportada = (id: string) => {
    setPersonasReportadas((prev) => {
      if (prev.length <= 1) {
        toast({
          title: "Acción no disponible",
          description: "Debes conservar al menos una persona registrada en el expediente.",
          variant: "destructive",
        })
        return prev
      }

      const actualizadas = prev.filter((persona) => persona.id !== id)
      toast({
        title: "Persona eliminada",
        description: "Se retiró la persona del expediente único.",
      })
      return actualizadas
    })
  }

  const guardarExpediente = () => {
    if (typeof window === "undefined") return

    const nombre = datosIdentificacion.nombre?.trim()
    const rfc = datosIdentificacion.rfc?.trim().toUpperCase()

    if (!nombre || !rfc) {
      toast({
        title: "Información incompleta",
        description: "Captura al menos el nombre o razón social y el RFC para guardar el expediente.",
        variant: "destructive",
      })
      return
    }

    try {
      const resumenCliente = {
        rfc,
        nombre,
        tipoCliente,
        detalleTipoCliente,
      }

      const almacenActual = window.localStorage.getItem(CLIENTES_STORAGE_KEY)
      let listado: any[] = []
      if (almacenActual) {
        try {
          const parsed = JSON.parse(almacenActual)
          if (Array.isArray(parsed)) {
            listado = parsed
          }
        } catch (error) {
          console.warn("No fue posible leer el catálogo de clientes guardados", error)
        }
      }

      const mapa = new Map<string, any>()
      listado.forEach((item) => {
        if (item && typeof item === "object" && typeof item.rfc === "string") {
          mapa.set(item.rfc, item)
        }
      })
      mapa.set(rfc, { ...(mapa.get(rfc) ?? {}), ...resumenCliente })
      window.localStorage.setItem(CLIENTES_STORAGE_KEY, JSON.stringify(Array.from(mapa.values())))

      const detalleExpediente = {
        ...resumenCliente,
        responsable,
        claveSujetoObligado,
        claveActividadVulnerable,
        identificacion: datosIdentificacion,
        datosFiscales,
        perfilOperaciones,
        documentacion: documentacionEstado,
        personas: personasReportadas,
        actualizadoEn: new Date().toISOString(),
      }

      const detalleActual = window.localStorage.getItem(EXPEDIENTE_DETALLE_STORAGE_KEY)
      let expedientes: any[] = []
      if (detalleActual) {
        try {
          const parsed = JSON.parse(detalleActual)
          if (Array.isArray(parsed)) expedientes = parsed
        } catch (error) {
          console.warn("No fue posible leer el detalle de expedientes guardados", error)
        }
      }

      const indiceExistente = expedientes.findIndex(
        (item) => item && typeof item === "object" && typeof item.rfc === "string" && item.rfc === rfc,
      )
      if (indiceExistente >= 0) {
        expedientes[indiceExistente] = { ...expedientes[indiceExistente], ...detalleExpediente }
      } else {
        expedientes.push(detalleExpediente)
      }

      window.localStorage.setItem(EXPEDIENTE_DETALLE_STORAGE_KEY, JSON.stringify(expedientes))

      toast({
        title: "Expediente guardado",
        description: "La información quedó disponible para prellenar avisos en actividades vulnerables.",
      })
    } catch (error) {
      console.error("Error al guardar el expediente", error)
      toast({
        title: "No fue posible guardar",
        description: "Intenta nuevamente o revisa los permisos de almacenamiento del navegador.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-600" /> Expediente único de identificación
          </CardTitle>
          <CardDescription>
            Centraliza todos los datos y documentos del cliente para que los avisos se prellenan automáticamente al
            registrarlo en actividades vulnerables.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre del expediente</Label>
              <Input value={nombreExpediente} onChange={(event) => setNombreExpediente(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Responsable del expediente</Label>
              <Input value={responsable} onChange={(event) => setResponsable(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Clave de sujeto obligado</Label>
              <Input value={claveSujetoObligado} onChange={(event) => setClaveSujetoObligado(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Clave de actividad vulnerable</Label>
              <Input
                value={claveActividadVulnerable}
                onChange={(event) => setClaveActividadVulnerable(event.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Resumen de avance del expediente</p>
                <p className="text-xs text-slate-500">Tipo de cliente: {tipoClienteResumen}</p>
              </div>
              <Badge variant="outline" className="bg-white text-xs font-semibold">
                {progresoGlobal}% completado
              </Badge>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="relative h-2 w-full max-w-xs overflow-hidden rounded bg-slate-200">
                <div
                  className="absolute inset-y-0 left-0 rounded bg-emerald-500 transition-all"
                  style={{ width: `${progresoGlobal}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="bg-white">
                  Identificación {camposIdentificacionCompletos}/{totalCamposIdentificacion}
                </Badge>
                <Badge variant="outline" className="bg-white">
                  Información fiscal {camposFiscalesCompletos}/{totalCamposFiscales}
                </Badge>
                <Badge variant="outline" className="bg-white">
                  Perfil transaccional {camposPerfilCompletos}/{totalCamposPerfil}
                </Badge>
                <Badge variant="outline" className="bg-white">
                  Documentación {documentosCompletos}/{DOCUMENTACION_REQUERIDA.length}
                </Badge>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Guarda el expediente cuando actualices datos clave para mantenerlos disponibles al momento de preparar un
              aviso ante la autoridad.
            </p>
            <div className="mt-4 flex justify-end">
              <Button onClick={guardarExpediente}>Guardar expediente</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-slate-600" /> Identificación del cliente
          </CardTitle>
          <CardDescription>
            Registra la información oficial y los documentos soporte necesarios para acreditar la identidad del cliente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de cliente</Label>
              <Select value={tipoCliente} onValueChange={(value) => setTipoCliente(value)}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Selecciona tipo de cliente" />
                </SelectTrigger>
                <SelectContent>
                  {CLIENTE_TIPOS.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {tipoClienteSeleccionado?.requiresDetalle && (
              <div className="space-y-2">
                <Label>{tipoClienteSeleccionado.detalleLabel ?? "Detalle del tipo de cliente"}</Label>
                {tipoClienteSeleccionado.detalleOpciones ? (
                  <Select value={detalleTipoCliente || undefined} onValueChange={setDetalleTipoCliente}>
                    <SelectTrigger className="bg-white">
                      <SelectValue
                        placeholder={
                          tipoClienteSeleccionado.detallePlaceholder ?? "Selecciona la opción que corresponda"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {tipoClienteSeleccionado.detalleOpciones.map((detalle) => (
                        <SelectItem key={detalle.value} value={detalle.value}>
                          {detalle.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={detalleTipoCliente}
                    onChange={(event) => setDetalleTipoCliente(event.target.value)}
                    placeholder={tipoClienteSeleccionado.detallePlaceholder ?? "Describe la entidad o figura jurídica"}
                  />
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {IDENTIFICACION_CAMPOS.map((grupo) => (
              <div key={grupo.id} className="space-y-3 rounded border bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-700">{grupo.titulo}</p>
                  <Badge variant="outline" className="text-xs">
                    {
                      grupo.campos.filter((campo) => datosIdentificacion[campo.id]?.trim()).length
                    }/{grupo.campos.length}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">{grupo.descripcion}</p>
                <div className="space-y-3">
                  {grupo.campos.map((campo) => {
                    const value = datosIdentificacion[campo.id] ?? ""
                    const onChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                      let nuevoValor = event.target.value
                      if (campo.id === "rfc" || campo.id === "curp") {
                        nuevoValor = nuevoValor.toUpperCase()
                      }
                      setDatosIdentificacion((prev) => ({ ...prev, [campo.id]: nuevoValor }))
                      if (campo.id === "nombre") {
                        setNombreExpediente(nuevoValor)
                      }
                    }

                    return (
                      <div key={campo.id} className="space-y-1 text-sm">
                        <Label className="flex items-center justify-between text-xs font-semibold uppercase text-slate-600">
                          {campo.label}
                          {campo.requerido && <span className="text-rose-500">*</span>}
                        </Label>
                        {campo.multiline ? (
                          <Textarea
                            value={value}
                            onChange={onChange}
                            placeholder={campo.placeholder ?? "Captura la información"}
                            rows={3}
                          />
                        ) : (
                          <Input
                            type={campo.type ?? "text"}
                            value={value}
                            onChange={onChange}
                            placeholder={campo.placeholder ?? ""}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-slate-600" /> Información legal y fiscal
          </CardTitle>
          <CardDescription>Datos que deben coincidir con la constancia de situación fiscal y documentos legales.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {DATOS_FISCALES_CAMPOS.map((campo) => {
              const value = datosFiscales[campo.id] ?? ""
              const onChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                setDatosFiscales((prev) => ({ ...prev, [campo.id]: event.target.value }))
              }

              return (
                <div key={campo.id} className="space-y-1 text-sm">
                  <Label className="flex items-center justify-between text-xs font-semibold uppercase text-slate-600">
                    {campo.label}
                    {campo.requerido && <span className="text-rose-500">*</span>}
                  </Label>
                  {campo.multiline ? (
                    <Textarea
                      value={value}
                      onChange={onChange}
                      placeholder={campo.placeholder ?? ""}
                      rows={3}
                    />
                  ) : (
                    <Input
                      type={campo.type ?? "text"}
                      value={value}
                      onChange={onChange}
                      placeholder={campo.placeholder ?? ""}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe2 className="h-5 w-5 text-slate-600" /> Perfil transaccional y uso de servicios
          </CardTitle>
          <CardDescription>
            Define el comportamiento esperado para detectar desviaciones cuando registres operaciones y avisos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {PERFIL_OPERACION_CAMPOS.map((campo) => {
              const value = perfilOperaciones[campo.id] ?? ""
              return (
                <div key={campo.id} className="space-y-1 text-sm">
                  <Label className="flex items-center justify-between text-xs font-semibold uppercase text-slate-600">
                    {campo.label}
                    {campo.requerido && <span className="text-rose-500">*</span>}
                  </Label>
                  <Textarea
                    value={value}
                    onChange={(event) =>
                      setPerfilOperaciones((prev) => ({
                        ...prev,
                        [campo.id]: event.target.value,
                      }))
                    }
                    placeholder={campo.placeholder ?? ""}
                    rows={3}
                  />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-slate-600" /> Documentación requerida
          </CardTitle>
          <CardDescription>
            Marca el estatus de cada documento para asegurar que el expediente esté listo ante cualquier revisión.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {DOCUMENTACION_REQUERIDA.map((documento) => {
            const estado = obtenerStatusDocumento(documentacionEstado[documento.id])
            return (
              <div key={documento.id} className="space-y-3 rounded border bg-white p-4 text-sm shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-700">{documento.titulo}</p>
                    <p className="text-xs text-slate-500">{documento.descripcion}</p>
                  </div>
                  <Badge className={`${estado.classes} text-xs font-semibold capitalize`}>{estado.label}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DOCUMENTO_STATUS.map((opcion) => (
                    <Button
                      key={opcion.value}
                      type="button"
                      size="sm"
                      variant={estado.value === opcion.value ? "default" : "outline"}
                      onClick={() =>
                        setDocumentacionEstado((prev) => ({
                          ...prev,
                          [documento.id]: opcion.value,
                        }))
                      }
                    >
                      {opcion.label}
                    </Button>
                  ))}
                </div>
                {documento.obligatorio && (
                  <p className="text-[11px] text-rose-500">Documento indispensable para la integración del aviso.</p>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-600" /> Personas relacionadas y beneficiarios
          </CardTitle>
          <CardDescription>
            Registra a la persona objeto del aviso, representantes, apoderados y beneficiarios finales para
            prellenar automáticamente los formularios.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {personasReportadas.map((persona, index) => (
            <div key={persona.id} className="space-y-6 rounded border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-700">Persona {index + 1}</span>
                  <span className="text-xs text-slate-500">{persona.rolRelacion}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => eliminarPersonaReportada(persona.id)}
                  className="text-rose-500 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo de persona</Label>
                  <Select
                    value={persona.tipo}
                    onValueChange={(value) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        tipo: value as PersonaReportada["tipo"],
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERSONA_TIPO_OPCIONES.map((opcion) => (
                        <SelectItem key={opcion.value} value={opcion.value}>
                          {opcion.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Rol dentro del aviso</Label>
                  <Input
                    value={persona.rolRelacion}
                    onChange={(event) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        rolRelacion: event.target.value,
                      }))
                    }
                    placeholder="Cliente, representante, beneficiario, fideicomitente..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nombre o razón social</Label>
                  <Input
                    value={persona.denominacion}
                    onChange={(event) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        denominacion: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>RFC</Label>
                  <Input
                    value={persona.rfc}
                    onChange={(event) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        rfc: event.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>CURP</Label>
                  <Input
                    value={persona.curp}
                    onChange={(event) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        curp: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="Para personas físicas"
                  />
                </div>
                <div className="space-y-2">
                  <Label>País de constitución / nacionalidad</Label>
                  <Input
                    value={persona.pais}
                    onChange={(event) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        pais: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de constitución / nacimiento</Label>
                  <Input
                    type="date"
                    value={persona.fechaConstitucion}
                    onChange={(event) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        fechaConstitucion: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Actividad o profesión</Label>
                  <Input
                    value={persona.giro}
                    onChange={(event) =>
                      actualizarPersonaReportada(persona.id, (prev) => ({
                        ...prev,
                        giro: event.target.value,
                      }))
                    }
                    placeholder="Ej. Servicios profesionales, arrendamiento..."
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <UserCheck className="h-4 w-4" /> Datos del representante o apoderado legal
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Nombre(s)</Label>
                    <Input
                      value={persona.representante.nombre}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          representante: { ...prev.representante, nombre: event.target.value },
                        }))
                      }
                      placeholder="Nombre completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellido paterno</Label>
                    <Input
                      value={persona.representante.apellidoPaterno}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          representante: { ...prev.representante, apellidoPaterno: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Apellido materno</Label>
                    <Input
                      value={persona.representante.apellidoMaterno}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          representante: { ...prev.representante, apellidoMaterno: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha de nacimiento</Label>
                    <Input
                      type="date"
                      value={persona.representante.fechaNacimiento}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          representante: { ...prev.representante, fechaNacimiento: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>RFC</Label>
                    <Input
                      value={persona.representante.rfc}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          representante: { ...prev.representante, rfc: event.target.value.toUpperCase() },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CURP</Label>
                    <Input
                      value={persona.representante.curp}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          representante: { ...prev.representante, curp: event.target.value.toUpperCase() },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <MapPin className="h-4 w-4" /> Domicilio de la persona
                </div>
                <div className="flex flex-wrap gap-2">
                  {DOMICILIO_TIPOS.map((opcion) => (
                    <Button
                      key={opcion.value}
                      type="button"
                      variant={persona.domicilio.ambito === opcion.value ? "default" : "outline"}
                      onClick={() =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          domicilio: {
                            ...prev.domicilio,
                            ambito: opcion.value,
                            pais: opcion.value === "nacional" ? "México" : prev.domicilio.pais,
                          },
                        }))
                      }
                    >
                      {opcion.label}
                    </Button>
                  ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>País</Label>
                    <Input
                      value={persona.domicilio.pais}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          domicilio: { ...prev.domicilio, pais: event.target.value },
                        }))
                      }
                      disabled={persona.domicilio.ambito === "nacional"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Entidad federativa / Estado</Label>
                    <Input
                      value={persona.domicilio.entidad}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          domicilio: { ...prev.domicilio, entidad: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Municipio o delegación</Label>
                    <Input
                      value={persona.domicilio.municipio}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          domicilio: { ...prev.domicilio, municipio: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Colonia o localidad</Label>
                    <Input
                      value={persona.domicilio.colonia}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          domicilio: { ...prev.domicilio, colonia: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Código postal</Label>
                    <Input
                      value={persona.domicilio.codigoPostal}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          domicilio: {
                            ...prev.domicilio,
                            codigoPostal: event.target.value.replace(/[^0-9]/g, ""),
                          },
                        }))
                      }
                      inputMode="numeric"
                      maxLength={10}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Calle</Label>
                    <Input
                      value={persona.domicilio.calle}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          domicilio: { ...prev.domicilio, calle: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número exterior</Label>
                    <Input
                      value={persona.domicilio.numeroExterior}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          domicilio: { ...prev.domicilio, numeroExterior: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número interior</Label>
                    <Input
                      value={persona.domicilio.numeroInterior}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          domicilio: { ...prev.domicilio, numeroInterior: event.target.value },
                        }))
                      }
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Phone className="h-4 w-4" /> Medios de contacto
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>¿Se conoce el teléfono?</Label>
                    <div className="flex flex-wrap gap-2">
                      {[{ value: "si", label: "Sí" }, { value: "no", label: "No" }].map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={persona.contacto.conoceTelefono === option.value ? "default" : "outline"}
                          onClick={() =>
                            actualizarPersonaReportada(persona.id, (prev) => ({
                              ...prev,
                              contacto: { ...prev.contacto, conoceTelefono: option.value as RespuestaBinaria },
                            }))
                          }
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>¿Se conoce la clave de país?</Label>
                    <div className="flex flex-wrap gap-2">
                      {[{ value: "si", label: "Sí" }, { value: "no", label: "No" }].map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={persona.contacto.conocePaisTelefono === option.value ? "default" : "outline"}
                          onClick={() =>
                            actualizarPersonaReportada(persona.id, (prev) => ({
                              ...prev,
                              contacto: { ...prev.contacto, conocePaisTelefono: option.value as RespuestaBinaria },
                            }))
                          }
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Clave de país</Label>
                    <Input
                      value={persona.contacto.clavePais}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          contacto: { ...prev.contacto, clavePais: event.target.value.toUpperCase() },
                        }))
                      }
                      placeholder="Ej. MX, US, CA"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      value={persona.contacto.telefono}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          contacto: {
                            ...prev.contacto,
                            telefono: event.target.value.replace(/[^0-9]/g, ""),
                          },
                        }))
                      }
                      inputMode="tel"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Correo electrónico</Label>
                    <Input
                      type="email"
                      value={persona.contacto.correo}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          contacto: { ...prev.contacto, correo: event.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <FileText className="h-4 w-4" /> Identificación presentada
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo de documento</Label>
                    <Input
                      value={persona.identificacion.tipo}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          identificacion: { ...prev.identificacion, tipo: event.target.value },
                        }))
                      }
                      placeholder="INE, pasaporte, cédula, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número de documento</Label>
                    <Input
                      value={persona.identificacion.numero}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          identificacion: { ...prev.identificacion, numero: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>País de expedición</Label>
                    <Input
                      value={persona.identificacion.pais}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          identificacion: { ...prev.identificacion, pais: event.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vigencia</Label>
                    <Input
                      type="date"
                      value={persona.identificacion.fechaVencimiento}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          identificacion: { ...prev.identificacion, fechaVencimiento: event.target.value },
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Globe2 className="h-4 w-4" /> Participación y origen de recursos
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Porcentaje de participación</Label>
                    <Input
                      value={persona.participacion.porcentajeCapital}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          participacion: { ...prev.participacion, porcentajeCapital: event.target.value },
                        }))
                      }
                      placeholder="Ej. 25%"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>¿Es persona políticamente expuesta?</Label>
                    <div className="flex flex-wrap gap-2">
                      {[{ value: "si", label: "Sí" }, { value: "no", label: "No" }].map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={persona.participacion.esPep === option.value ? "default" : "outline"}
                          onClick={() =>
                            actualizarPersonaReportada(persona.id, (prev) => ({
                              ...prev,
                              participacion: { ...prev.participacion, esPep: option.value as RespuestaBinaria },
                            }))
                          }
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label>Origen de los recursos que aporta</Label>
                    <Textarea
                      value={persona.participacion.origenRecursos}
                      onChange={(event) =>
                        actualizarPersonaReportada(persona.id, (prev) => ({
                          ...prev,
                          participacion: { ...prev.participacion, origenRecursos: event.target.value },
                        }))
                      }
                      rows={3}
                    />
                  </div>
                  {persona.participacion.esPep === "si" && (
                    <div className="md:col-span-2 space-y-2">
                      <Label>Detalle del cargo público o parentesco</Label>
                      <Textarea
                        value={persona.participacion.detallePep}
                        onChange={(event) =>
                          actualizarPersonaReportada(persona.id, (prev) => ({
                            ...prev,
                            participacion: { ...prev.participacion, detallePep: event.target.value },
                          }))
                        }
                        rows={3}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={agregarPersonaReportada} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Añadir otra persona
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
