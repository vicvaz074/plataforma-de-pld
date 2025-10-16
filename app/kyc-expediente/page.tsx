"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  Globe2,
  Mail,
  MapPin,
  Phone,
  PlayCircle,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react"
import { CLIENTE_TIPOS, findClienteTipoLabel, findClienteTipoOption } from "@/lib/data/tipos-cliente"

const IDENTIFICACION_CAMPOS = [
  {
    id: "datos-generales",
    titulo: "Datos generales",
    descripcion: "Identificación oficial, RFC, CURP y comprobante de domicilio vigente.",
    campos: [
      { id: "nombre", label: "Nombre / Razón social", requerido: true },
      { id: "rfc", label: "RFC", requerido: true },
      { id: "curp", label: "CURP", requerido: false },
      { id: "domicilio", label: "Domicilio", requerido: true },
    ],
  },
  {
    id: "documentos",
    titulo: "Documentos soporte",
    descripcion: "Actas constitutivas, poderes notariales, estados financieros o identificaciones, según el tipo de cliente.",
    campos: [
      { id: "identificacion", label: "Identificación oficial", requerido: true },
      { id: "comprobante", label: "Comprobante de domicilio", requerido: true },
      { id: "situacion-fiscal", label: "Constancia de situación fiscal", requerido: true },
      { id: "documentos-adicionales", label: "Documentos adicionales", requerido: false },
    ],
  },
]

const FACTORES_RIESGO = [
  {
    id: "actividad",
    titulo: "Actividad del cliente",
    descripcion: "Giro comercial o profesional y su vinculación con actividades vulnerables.",
    categoria: "actividad",
  },
  {
    id: "monto-frecuencia",
    titulo: "Monto y frecuencia",
    descripcion: "Volumen transaccional habitual y operaciones extraordinarias.",
    categoria: "actividad",
  },
  {
    id: "geografia",
    titulo: "Zona geográfica",
    descripcion: "Países o entidades federativas donde opera o tiene vínculos comerciales.",
    categoria: "cliente",
  },
  {
    id: "divisa",
    titulo: "Tipo de divisa",
    descripcion: "Monedas utilizadas de manera recurrente en las operaciones.",
    categoria: "cliente",
  },
  {
    id: "origen-destino",
    titulo: "Origen y destino de recursos",
    descripcion: "Procedencia del capital y destino de los fondos.",
    categoria: "cliente",
  },
  {
    id: "naturaleza-operaciones",
    titulo: "Naturaleza de las operaciones",
    descripcion: "Forma de pago, instrumentos financieros y contrapartes.",
    categoria: "actividad",
  },
  {
    id: "comportamiento",
    titulo: "Comportamiento inusual",
    descripcion: "Alertas por operaciones atípicas o inconsistentes con el perfil.",
    categoria: "cliente",
  },
  {
    id: "pep",
    titulo: "Personas políticamente expuestas",
    descripcion: "Determinación de exposición pública o vínculos con PEPs.",
    categoria: "cliente",
  },
]

const RISK_LEVELS = [
  { value: "bajo", label: "Bajo", color: "bg-emerald-100 text-emerald-700" },
  { value: "medio", label: "Medio", color: "bg-amber-100 text-amber-700" },
  { value: "alto", label: "Alto", color: "bg-rose-100 text-rose-700" },
]

const RISK_BANDS: Record<string, { label: string; gradient: string; description: string }> = {
  bajo: {
    label: "Riesgo bajo",
    gradient: "bg-gradient-to-r from-emerald-200 via-emerald-100 to-white",
    description: "Perfil alineado con documentación completa y operaciones consistentes.",
  },
  medio: {
    label: "Riesgo medio",
    gradient: "bg-gradient-to-r from-amber-200 via-amber-100 to-white",
    description: "Requiere seguimiento adicional, validación de origen de recursos y monitoreo reforzado.",
  },
  alto: {
    label: "Riesgo alto",
    gradient: "bg-gradient-to-r from-rose-200 via-rose-100 to-white",
    description: "Aplicar debida diligencia reforzada, aprobación de alta dirección y revisión continua.",
  },
}

type RiskValue = (typeof RISK_LEVELS)[number]["value"]

const CLIENTES_STORAGE_KEY = "actividades_vulnerables_clientes"

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
}

interface FactorRespuesta {
  valor: RiskValue
  comentario: string
}

interface AlertaRiesgo {
  id: string
  factor: string
  nivel: RiskValue
  descripcion: string
  fecha: string
}

const CLIENTE_COLORES: Record<RiskValue, string> = {
  bajo: "bg-emerald-500",
  medio: "bg-amber-500",
  alto: "bg-rose-500",
}

const MESES_AVISO = [
  { value: "01", label: "Enero" },
  { value: "02", label: "Febrero" },
  { value: "03", label: "Marzo" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Mayo" },
  { value: "06", label: "Junio" },
  { value: "07", label: "Julio" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
]

const ALERTA_OPCIONES = [
  "SIN ALERTA",
  "Operación inusual",
  "Operación relevante",
  "Operación interna preocupante",
]

const PERSONA_TIPO_OPCIONES = [
  { value: "persona_moral", label: "Persona moral" },
  { value: "persona_fisica", label: "Persona física" },
]

const DOMICILIO_TIPOS = [
  { value: "nacional", label: "Nacional" },
  { value: "extranjero", label: "Extranjera" },
]

type RespuestaBinaria = "si" | "no"

interface PersonaReportada {
  id: string
  tipo: (typeof PERSONA_TIPO_OPCIONES)[number]["value"]
  denominacion: string
  fechaConstitucion: string
  rfc: string
  pais: string
  giro: string
  representante: {
    nombre: string
    apellidoPaterno: string
    apellidoMaterno: string
    fechaNacimiento: string
    rfc: string
    curp: string
  }
  domicilio: {
    ambito: (typeof DOMICILIO_TIPOS)[number]["value"]
    pais: string
    entidad: string
    municipio: string
    colonia: string
    codigoPostal: string
    calle: string
    numeroExterior: string
    numeroInterior: string
  }
  contacto: {
    conoceTelefono: RespuestaBinaria
    conocePaisTelefono: RespuestaBinaria
    clavePais: string
    telefono: string
    correo: string
  }
  alerta: {
    motivo: string
    descripcion: string
  }
}

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
    pais: "MEXICO",
    giro: "",
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
      clavePais: "MEXICO",
      telefono: "",
      correo: "",
    },
    alerta: {
      motivo: ALERTA_OPCIONES[0] ?? "SIN ALERTA",
      descripcion: "",
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

function KycExpedienteContent() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [tipoCliente, setTipoCliente] = useState<string>(CLIENTE_TIPOS[0]?.value ?? "")
  const [detalleTipoCliente, setDetalleTipoCliente] = useState<string>("")
  const [responsable, setResponsable] = useState("")
  const [nombreExpediente, setNombreExpediente] = useState("")
  const [claveSujetoObligado, setClaveSujetoObligado] = useState("")
  const [claveActividadVulnerable, setClaveActividadVulnerable] = useState("")
  const [periodoAviso, setPeriodoAviso] = useState<{ mes: string; anio: string }>({ mes: "", anio: "" })
  const [mesAviso, setMesAviso] = useState("")
  const [reportaOperaciones, setReportaOperaciones] = useState<RespuestaBinaria>("no")
  const [grupoEmpresarial, setGrupoEmpresarial] = useState<RespuestaBinaria>("no")
  const [datosIdentificacion, setDatosIdentificacion] = useState<Record<string, string>>({})
  const [respuestas, setRespuestas] = useState<Record<string, FactorRespuesta>>({})
  const [alertas, setAlertas] = useState<AlertaRiesgo[]>([])
  const [personasReportadas, setPersonasReportadas] = useState<PersonaReportada[]>(() => [crearPersonaBase()])
  const [alertaSeleccionada, setAlertaSeleccionada] = useState<AlertaRiesgo | null>(null)

  const tipoClienteSeleccionado = useMemo(() => findClienteTipoOption(tipoCliente), [tipoCliente])
  const tipoClienteLabel = useMemo(() => findClienteTipoLabel(tipoCliente), [tipoCliente])
  const tipoClienteResumen = useMemo(
    () => (detalleTipoCliente ? `${tipoClienteLabel} – ${detalleTipoCliente}` : tipoClienteLabel),
    [detalleTipoCliente, tipoClienteLabel],
  )
  const mesAvisoDescripcion = useMemo(() => {
    if (!periodoAviso.anio || !periodoAviso.mes) return ""
    const mes = MESES_AVISO.find((item) => item.value === periodoAviso.mes)
    return mes ? `${mes.label} ${periodoAviso.anio}` : periodoAviso.anio
  }, [periodoAviso])

  useEffect(() => {
    if (periodoAviso.anio && periodoAviso.mes) {
      setMesAviso(`${periodoAviso.anio}${periodoAviso.mes}`)
    } else {
      setMesAviso("")
    }
  }, [periodoAviso])

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
      if (!stored) return

      const parsed = JSON.parse(stored) as Array<{
        rfc?: string
        nombre?: string
        tipoCliente?: string
        detalleTipoCliente?: string
      }>

      const criterio = normalizeText(parametro)
      const coincidencia = parsed.find((item) => {
        if (!item) return false
        const rfc = typeof item.rfc === "string" ? normalizeText(item.rfc) : ""
        const nombre = typeof item.nombre === "string" ? normalizeText(item.nombre) : ""
        return rfc === criterio || (nombre !== "" && nombre === criterio)
      })

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

      toast({
        title: "Cliente sincronizado",
        description: "Se importaron la razón social y el tipo de cliente desde actividades vulnerables.",
      })
    } catch (error) {
      console.error("No fue posible sincronizar el cliente desde actividades vulnerables", error)
    }
  }, [searchParams, toast])

  const actualizarPersonaReportada = (
    id: string,
    updater: (persona: PersonaReportada) => PersonaReportada,
  ) => {
    setPersonasReportadas((prev) => prev.map((persona) => (persona.id === id ? updater(persona) : persona)))
  }

  const agregarPersonaReportada = () => {
    const nuevaPersona = crearPersonaBase()
    setPersonasReportadas((prev) => [...prev, nuevaPersona])
    toast({
      title: "Persona añadida",
      description: "Se creó un espacio adicional para capturar otra persona reportada.",
    })
  }

  const eliminarPersonaReportada = (id: string) => {
    setPersonasReportadas((prev) => {
      if (prev.length <= 1) {
        toast({
          title: "Acción no disponible",
          description: "Debes conservar al menos una persona reportada en el aviso.",
          variant: "destructive",
        })
        return prev
      }

      const actualizadas = prev.filter((persona) => persona.id !== id)
      toast({
        title: "Persona eliminada",
        description: "Se retiró la persona del aviso mensual.",
      })
      return actualizadas
    })
  }

  const nivelIdentificacion = useMemo<RiskValue>(() => {
    const totalCampos = IDENTIFICACION_CAMPOS.flatMap((grupo) => grupo.campos).length
    const completados = IDENTIFICACION_CAMPOS.flatMap((grupo) => grupo.campos).filter(
      (campo) => datosIdentificacion[campo.id]?.trim(),
    ).length

    if (completados === totalCampos) return "bajo"
    if (completados >= totalCampos * 0.6) return "medio"
    return "alto"
  }, [datosIdentificacion])

  const nivelConocimiento = useMemo<RiskValue>(() => {
    const factoresEvaluados = FACTORES_RIESGO.map((factor) => respuestas[factor.id]?.valor).filter(Boolean) as RiskValue[]
    if (factoresEvaluados.length === 0) return "alto"
    const puntaje = factoresEvaluados.reduce((acc, nivel) => {
      if (nivel === "alto") return acc + 3
      if (nivel === "medio") return acc + 2
      return acc + 1
    }, 0)
    const promedio = puntaje / factoresEvaluados.length
    if (promedio >= 2.5) return "alto"
    if (promedio >= 1.7) return "medio"
    return "bajo"
  }, [respuestas])

  const nivelIntegral = useMemo<RiskValue>(() => {
    if (nivelIdentificacion === "alto" || nivelConocimiento === "alto") return "alto"
    if (nivelIdentificacion === "medio" || nivelConocimiento === "medio") return "medio"
    return "bajo"
  }, [nivelIdentificacion, nivelConocimiento])

  const matrizCalor = useMemo(
    () => [
      { seccion: "Identificación", nivel: nivelIdentificacion },
      { seccion: "Conocimiento", nivel: nivelConocimiento },
      { seccion: "Riesgo integral", nivel: nivelIntegral },
    ],
    [nivelIdentificacion, nivelConocimiento, nivelIntegral],
  )

  const divisionEnfoque = useMemo(() => {
    const agrupado: Record<"cliente" | "actividad", RiskValue[]> = { cliente: [], actividad: [] }
    FACTORES_RIESGO.forEach((factor) => {
      const respuesta = respuestas[factor.id]
      if (respuesta) {
        agrupado[factor.categoria as "cliente" | "actividad"].push(respuesta.valor)
      }
    })

    const calcularNivel = (valores: RiskValue[]): RiskValue => {
      if (valores.some((valor) => valor === "alto")) return "alto"
      if (valores.some((valor) => valor === "medio")) return "medio"
      if (valores.length === 0) return "alto"
      return "bajo"
    }

    return {
      cliente: calcularNivel(agrupado.cliente),
      actividad: calcularNivel(agrupado.actividad),
    }
  }, [respuestas])

  const generarAlerta = (factorId: string) => {
    const factor = FACTORES_RIESGO.find((item) => item.id === factorId)
    const respuesta = respuestas[factorId]
    if (!factor || !respuesta) {
      toast({
        title: "Información incompleta",
        description: "Selecciona un nivel de riesgo y agrega comentarios para generar la alerta.",
        variant: "destructive",
      })
      return
    }

    const nuevaAlerta: AlertaRiesgo = {
      id: crypto.randomUUID(),
      factor: factor.titulo,
      nivel: respuesta.valor,
      descripcion: respuesta.comentario,
      fecha: new Date().toISOString(),
    }

    setAlertas((prev) => [nuevaAlerta, ...prev])
    toast({
      title: "Alerta generada",
      description: `Se creó una alerta inmediata para el factor ${factor.titulo}.`,
    })
  }

  const actualizarRespuesta = (factorId: string, campo: keyof FactorRespuesta, valor: string) => {
    setRespuestas((prev) => {
      const actual = prev[factorId] ?? { valor: "medio", comentario: "" }
      return {
        ...prev,
        [factorId]: {
          ...actual,
          [campo]: campo === "valor" ? (valor as RiskValue) : valor,
        },
      }
    })
  }

  const guardarEvaluacion = () => {
    toast({
      title: "Evaluación guardada",
      description: "Se actualizó el expediente KYC con la segmentación de riesgo basada en metodología EBR.",
    })
  }

  const bandaActual = RISK_BANDS[nivelIntegral]

  return (
    <div className="space-y-8">
      <section className={`rounded-xl border p-6 shadow-sm ${bandaActual.gradient}`}>
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Mapa integral de riesgo por cliente</h1>
            <p className="mt-1 text-sm text-slate-600">
              Clasificación automática para identificación y conocimiento del cliente bajo el enfoque basado en riesgo (EBR).
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {tipoClienteResumen && <Badge variant="secondary">{tipoClienteResumen}</Badge>}
              {responsable && <Badge variant="outline">Responsable: {responsable}</Badge>}
              {mesAviso && <Badge variant="outline">Periodo: {mesAviso}</Badge>}
              <Badge variant="outline" className="capitalize">
                Operaciones: {reportaOperaciones === "si" ? "Se reportan" : "Sin operaciones"}
              </Badge>
              <Badge className={CLIENTE_COLORES[nivelIntegral] + " text-white"}>{bandaActual.label}</Badge>
            </div>
          </div>
          <div className="min-w-[240px] rounded-lg border border-white/50 bg-white/70 p-4 text-sm text-slate-700">
            <p className="font-semibold">Recomendaciones inmediatas</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Documentar revisiones reforzadas cuando el riesgo sea medio o alto.</li>
              <li>Generar alertas inmediatas para desviaciones inusuales detectadas.</li>
              <li>Actualizar matrices de riesgo al registrar nuevas operaciones relevantes.</li>
            </ul>
          </div>
        </div>
      </section>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-600" /> Datos del aviso mensual
          </CardTitle>
          <CardDescription>
            Captura los campos obligatorios del expediente único para preparar el envío ante la UIF.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nombre, denominación o razón social</Label>
              <Input
                value={nombreExpediente}
                onChange={(event) => {
                  const value = event.target.value
                  setNombreExpediente(value)
                  setDatosIdentificacion((prev) => ({ ...prev, nombre: value }))
                }}
                placeholder="Ej. Grupo Empresarial del Norte, S.A. de C.V."
              />
            </div>
            <div className="space-y-2">
              <Label>Clave de quien realiza la actividad vulnerable</Label>
              <Input
                value={claveSujetoObligado}
                onChange={(event) => setClaveSujetoObligado(event.target.value.toUpperCase())}
                placeholder="Ej. CL123456"
              />
            </div>
            <div className="space-y-2">
              <Label>Clave de la actividad vulnerable</Label>
              <Input
                value={claveActividadVulnerable}
                onChange={(event) => setClaveActividadVulnerable(event.target.value.toUpperCase())}
                placeholder="Ej. I11"
              />
            </div>
            <div className="space-y-2">
              <Label>Mes al que corresponde el aviso</Label>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr),auto]">
                <Select
                  value={periodoAviso.mes || undefined}
                  onValueChange={(value) => setPeriodoAviso((prev) => ({ ...prev, mes: value }))}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecciona el mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {MESES_AVISO.map((mes) => (
                      <SelectItem key={mes.value} value={mes.value}>
                        {mes.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={periodoAviso.anio}
                  onChange={(event) => {
                    const value = event.target.value.replace(/[^0-9]/g, "").slice(0, 4)
                    setPeriodoAviso((prev) => ({ ...prev, anio: value }))
                  }}
                  placeholder="Año"
                  inputMode="numeric"
                  maxLength={4}
                  className="bg-white"
                />
              </div>
              {(mesAvisoDescripcion || mesAviso) && (
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  {mesAvisoDescripcion || "Selecciona mes y año"}
                  {mesAviso && (
                    <Badge variant="outline" className="font-mono">
                      {mesAviso}
                    </Badge>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <Label>¿Se van a reportar operaciones?</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "no" as RespuestaBinaria, label: "No, informe sin operaciones" },
                { value: "si" as RespuestaBinaria, label: "Sí, capturar operaciones" },
              ].map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={reportaOperaciones === option.value ? "default" : "outline"}
                  onClick={() => setReportaOperaciones(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Selecciona «Sí» cuando el aviso mensual incluirá operaciones relevantes, inusuales o internas preocupantes.
            </p>
          </div>

          <div className="space-y-3">
            <Label>¿Pertenece al mismo grupo empresarial?</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "si" as RespuestaBinaria, label: "Sí" },
                { value: "no" as RespuestaBinaria, label: "No" },
              ].map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={grupoEmpresarial === option.value ? "default" : "outline"}
                  onClick={() => setGrupoEmpresarial(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Esta respuesta determina si aplica el envío en ceros del artículo 27 Bis para entidades del mismo grupo.
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
            <p className="flex items-center gap-2 font-semibold text-amber-900">
              <ShieldAlert className="h-4 w-4" /> ¿El envío del informe corresponde al artículo 27 Bis de las Reglas de Carácter
              General de la LFPIORPI?
            </p>
            <p className="mt-2">
              {grupoEmpresarial === "si"
                ? "Sí. Al pertenecer al mismo grupo empresarial procede el informe 27 Bis en ceros por las operaciones del periodo."
                : "No. Debe presentarse el aviso individual detallando las operaciones realizadas en el periodo."}
            </p>
            <p className="mt-2 text-[11px] text-amber-700">
              Puedes actualizar la respuesta desde el apartado de grupo empresarial para mantener coherencia en el expediente.
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[1.3fr,1fr]">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-slate-600" /> Identificación del cliente
            </CardTitle>
            <CardDescription>
              Datos y documentos para validar la identidad y la estructura corporativa del cliente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de cliente</Label>
                <Select
                  value={tipoCliente}
                  onValueChange={(value) => {
                    setTipoCliente(value)
                  }}
                >
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
                {tipoClienteSeleccionado?.requiresDetalle && (
                  <div className="space-y-2 text-sm">
                    <Label>{tipoClienteSeleccionado.detalleLabel ?? "Detalle del tipo de cliente"}</Label>
                    {tipoClienteSeleccionado.detalleOpciones ? (
                      <Select
                        value={detalleTipoCliente || undefined}
                        onValueChange={setDetalleTipoCliente}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue
                            placeholder={
                              tipoClienteSeleccionado.detallePlaceholder ??
                              "Selecciona la opción que corresponda"
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
                        placeholder={
                          tipoClienteSeleccionado.detallePlaceholder ??
                          "Describe la entidad o figura jurídica"
                        }
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      Ajusta el detalle conforme al catálogo de sujetos obligados o dependencias aplicables.
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Responsable del expediente</Label>
                <Input value={responsable} onChange={(event) => setResponsable(event.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {IDENTIFICACION_CAMPOS.map((grupo) => (
                <div key={grupo.id} className="space-y-3 rounded border bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-700">{grupo.titulo}</p>
                    <Badge variant="outline" className="text-xs">
                      {grupo.campos.filter((campo) => datosIdentificacion[campo.id]?.trim()).length}/
                      {grupo.campos.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">{grupo.descripcion}</p>
                  <div className="space-y-3">
                    {grupo.campos.map((campo) => (
                      <div key={campo.id} className="space-y-1 text-sm">
                        <Label className="flex items-center justify-between text-xs font-semibold uppercase text-slate-600">
                          {campo.label}
                          {campo.requerido && <span className="text-rose-500">*</span>}
                        </Label>
                        <Input
                          value={datosIdentificacion[campo.id] ?? ""}
                          onChange={(event) => {
                            const value = event.target.value
                            setDatosIdentificacion((prev) => ({ ...prev, [campo.id]: value }))
                            if (campo.id === "nombre") {
                              setNombreExpediente(value)
                            }
                          }}
                          placeholder="Captura información o referencia documental"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border bg-white p-4 text-sm text-slate-700">
              <p className="font-semibold">Resultado identificación</p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`inline-flex h-3 w-3 rounded-full ${CLIENTE_COLORES[nivelIdentificacion]}`} />
                <span className="font-semibold uppercase">{RISK_BANDS[nivelIdentificacion].label}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {RISK_BANDS[nivelIdentificacion].description}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-slate-600" /> Mapa de calor EBR
            </CardTitle>
            <CardDescription>Visualiza los niveles de riesgo por sección y el resultado integral.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {matrizCalor.map((item) => (
              <div
                key={item.seccion}
                className={`rounded-lg border px-3 py-2 text-sm shadow-sm ${RISK_BANDS[item.nivel].gradient}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{item.seccion}</span>
                  <span className={`text-xs font-semibold uppercase ${CLIENTE_COLORES[item.nivel]} text-white px-2 py-1 rounded`}>
                    {item.nivel}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">{RISK_BANDS[item.nivel].description}</p>
              </div>
            ))}

            <div className="rounded-lg border bg-slate-50 p-4 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">Segmentación EBR</p>
              <p className="mt-2">
                Riesgo del cliente: <strong className="capitalize">{divisionEnfoque.cliente}</strong> · Riesgo de la actividad: {" "}
                <strong className="capitalize">{divisionEnfoque.actividad}</strong>
              </p>
              <p className="mt-2">
                Ajusta la periodicidad de actualización del expediente según el nivel integral y registra el dictamen del oficial de
                cumplimiento.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-600" /> Datos de identificación de la(s) persona(s) objeto del aviso
          </CardTitle>
          <CardDescription>
            Captura los datos del cliente, su representante y la información de contacto para integrar el expediente en línea con
            el SAT.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-600">
            <p>
              Instrucciones: captura los datos del cliente o usuario (persona física, moral o fideicomiso) con quien se realizó la
              operación. Si debes reportar más de una persona, utiliza el botón «Agregar persona reportada».
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="flex items-center gap-1"
                onClick={() =>
                  toast({
                    title: "Videotutorial",
                    description: "Próximamente podrás consultar el tutorial paso a paso dentro del portal.",
                  })
                }
              >
                <PlayCircle className="h-4 w-4" /> Videotutorial
              </Button>
              <Button
                type="button"
                size="sm"
                variant="link"
                className="px-0"
                onClick={() =>
                  toast({
                    title: "¿Qué es una alerta?",
                    description:
                      "Es una señal que indica operaciones inusuales, relevantes o internas preocupantes que deben analizarse y, en su caso, reportarse.",
                    duration: 6000,
                  })
                }
              >
                ¿Qué es una alerta?
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            {personasReportadas.map((persona, index) => {
              const esPersonaMoral = persona.tipo === "persona_moral"
              const etiquetaDenominacion = esPersonaMoral ? "Denominación o razón social" : "Nombre(s)"
              const etiquetaFecha = esPersonaMoral ? "Fecha de constitución" : "Fecha de nacimiento"
              const puedeEliminar = personasReportadas.length > 1

              return (
                <div key={persona.id} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800">Persona reportada #{index + 1}</p>
                      <p className="text-xs text-muted-foreground">Completa la información conforme al formato oficial de avisos.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {persona.tipo === "persona_moral" ? "Persona moral" : "Persona física"}
                      </Badge>
                      <Badge variant="outline" className="uppercase">{persona.alerta.motivo}</Badge>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => eliminarPersonaReportada(persona.id)}
                        disabled={!puedeEliminar}
                        aria-label="Eliminar persona reportada"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Building2 className="h-4 w-4" /> Datos de la persona reportada
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>¿El cliente o usuario objeto del presente aviso es?</Label>
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
                          <Label>{etiquetaDenominacion}</Label>
                          <Input
                            value={persona.denominacion}
                            onChange={(event) =>
                              actualizarPersonaReportada(persona.id, (prev) => ({
                                ...prev,
                                denominacion: event.target.value,
                              }))
                            }
                            placeholder={esPersonaMoral ? "Ej. Johnson Controls ASC Systems" : "Ej. Minerva Mireya"}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{etiquetaFecha}</Label>
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
                          <Label>Registro Federal de Contribuyentes</Label>
                          <Input
                            value={persona.rfc}
                            onChange={(event) =>
                              actualizarPersonaReportada(persona.id, (prev) => ({
                                ...prev,
                                rfc: event.target.value.toUpperCase(),
                              }))
                            }
                            placeholder="Ej. AME8307251NA"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>País de nacionalidad</Label>
                          <Input
                            value={persona.pais}
                            onChange={(event) =>
                              actualizarPersonaReportada(persona.id, (prev) => ({
                                ...prev,
                                pais: event.target.value,
                              }))
                            }
                            placeholder="Ej. México"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Giro mercantil</Label>
                          <Input
                            value={persona.giro}
                            onChange={(event) =>
                              actualizarPersonaReportada(persona.id, (prev) => ({
                                ...prev,
                                giro: event.target.value,
                              }))
                            }
                            placeholder="Ej. Industria - Maquinaria y equipo"
                          />
                        </div>
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
                        <MapPin className="h-4 w-4" /> Domicilio de la persona reportada
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
                          <Label>Entidad federativa</Label>
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
                          <Label>Delegación o municipio</Label>
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
                          <Label>Colonia</Label>
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
                                domicilio: { ...prev.domicilio, codigoPostal: event.target.value.replace(/[^0-9]/g, "") },
                              }))
                            }
                            inputMode="numeric"
                            maxLength={10}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Calle, avenida o vía</Label>
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
                        <Phone className="h-4 w-4" /> Contacto y notificaciones
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>¿Conoce el teléfono de la persona reportada?</Label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { value: "si" as RespuestaBinaria, label: "Sí" },
                              { value: "no" as RespuestaBinaria, label: "No" },
                            ].map((option) => (
                              <Button
                                key={option.value}
                                type="button"
                                variant={persona.contacto.conoceTelefono === option.value ? "default" : "outline"}
                                onClick={() =>
                                  actualizarPersonaReportada(persona.id, (prev) => ({
                                    ...prev,
                                    contacto: {
                                      ...prev.contacto,
                                      conoceTelefono: option.value,
                                      telefono: option.value === "no" ? "" : prev.contacto.telefono,
                                    },
                                  }))
                                }
                              >
                                {option.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>¿Conoce el país del número telefónico?</Label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { value: "si" as RespuestaBinaria, label: "Sí" },
                              { value: "no" as RespuestaBinaria, label: "No" },
                            ].map((option) => (
                              <Button
                                key={option.value}
                                type="button"
                                variant={persona.contacto.conocePaisTelefono === option.value ? "default" : "outline"}
                                onClick={() =>
                                  actualizarPersonaReportada(persona.id, (prev) => ({
                                    ...prev,
                                    contacto: {
                                      ...prev.contacto,
                                      conocePaisTelefono: option.value,
                                      clavePais: option.value === "no" ? "" : prev.contacto.clavePais,
                                    },
                                  }))
                                }
                              >
                                {option.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Clave del país del número telefónico</Label>
                          <Input
                            value={persona.contacto.clavePais}
                            onChange={(event) =>
                              actualizarPersonaReportada(persona.id, (prev) => ({
                                ...prev,
                                contacto: { ...prev.contacto, clavePais: event.target.value },
                              }))
                            }
                            disabled={persona.contacto.conocePaisTelefono === "no"}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Número telefónico</Label>
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
                            disabled={persona.contacto.conoceTelefono === "no"}
                            inputMode="numeric"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Mail className="h-4 w-4" /> Correo electrónico
                          </Label>
                          <Input
                            type="email"
                            value={persona.contacto.correo}
                            onChange={(event) =>
                              actualizarPersonaReportada(persona.id, (prev) => ({
                                ...prev,
                                contacto: { ...prev.contacto, correo: event.target.value },
                              }))
                            }
                            placeholder="correo@dominio.com"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <ShieldCheck className="h-4 w-4" /> Alertas relacionadas con el aviso
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Alerta por la que realiza el aviso</Label>
                          <Select
                            value={persona.alerta.motivo}
                            onValueChange={(value) =>
                              actualizarPersonaReportada(persona.id, (prev) => ({
                                ...prev,
                                alerta: { ...prev.alerta, motivo: value },
                              }))
                            }
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ALERTA_OPCIONES.map((opcion) => (
                                <SelectItem key={opcion} value={opcion}>
                                  {opcion}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Descripción de la alerta</Label>
                          <Textarea
                            value={persona.alerta.descripcion}
                            onChange={(event) =>
                              actualizarPersonaReportada(persona.id, (prev) => ({
                                ...prev,
                                alerta: { ...prev.alerta, descripcion: event.target.value },
                              }))
                            }
                            placeholder="Describe el contexto, señales detectadas y acciones tomadas."
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <Button type="button" variant="outline" className="w-full md:w-auto" onClick={agregarPersonaReportada}>
            <Plus className="mr-2 h-4 w-4" /> Agregar persona reportada
          </Button>
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[1.3fr,1fr]">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-slate-600" /> Conocimiento del cliente
            </CardTitle>
            <CardDescription>
              Evalúa cada factor de riesgo y genera alertas inmediatas para operaciones inusuales.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[520px] pr-4">
              <div className="space-y-4">
                {FACTORES_RIESGO.map((factor) => {
                  const respuesta = respuestas[factor.id]
                  return (
                    <div key={factor.id} className="rounded-lg border bg-white p-4 text-sm shadow-sm">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold text-slate-700">{factor.titulo}</p>
                          <p className="text-xs text-slate-500">{factor.descripcion}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={respuesta?.valor ?? "medio"}
                            onValueChange={(value) => actualizarRespuesta(factor.id, "valor", value)}
                          >
                            <SelectTrigger className="w-32 bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {RISK_LEVELS.map((nivel) => (
                                <SelectItem key={nivel.value} value={nivel.value}>
                                  {nivel.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" onClick={() => generarAlerta(factor.id)}>
                            Generar alerta
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        className="mt-3"
                        placeholder="Describe el riesgo identificado, controles aplicados y fecha de la última revisión."
                        value={respuesta?.comentario ?? ""}
                        onChange={(event) => actualizarRespuesta(factor.id, "comentario", event.target.value)}
                      />
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-slate-600" /> Alertas y acciones inmediatas
            </CardTitle>
            <CardDescription>
              Consolida alertas generadas y define próximas acciones para el oficial de cumplimiento.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded border bg-slate-50 p-3 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">Acciones sugeridas</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Solicitar evidencia adicional para operaciones clasificadas como riesgo medio o alto.</li>
                <li>Actualizar matriz de monitoreo con indicadores cuantitativos y cualitativos.</li>
                <li>Escalar alertas a la alta dirección cuando involucren jurisdicciones de alto riesgo o PEPs.</li>
              </ul>
            </div>

            <div className="rounded border bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-700">Alertas generadas</p>
                <Badge variant="outline">{alertas.length}</Badge>
              </div>
              <ScrollArea className="mt-3 h-48 pr-3">
                <div className="space-y-3 text-xs text-slate-600">
                  {alertas.length === 0 && <p>No se han generado alertas.</p>}
                  {alertas.map((alerta) => (
                    <button
                      key={alerta.id}
                      type="button"
                      onClick={() => setAlertaSeleccionada(alerta)}
                      className="w-full rounded border border-slate-200 bg-slate-50 p-2 text-left hover:border-slate-400"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">{alerta.factor}</span>
                        <span className={`rounded px-2 py-0.5 text-xs capitalize text-white ${CLIENTE_COLORES[alerta.nivel]}`}>
                          {alerta.nivel}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {new Date(alerta.fecha).toLocaleString("es-MX")}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">{alerta.descripcion}</p>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <Button className="w-full" onClick={guardarEvaluacion}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Guardar evaluación EBR
            </Button>
          </CardContent>
        </Card>
      </section>

      <AlertDialog open={Boolean(alertaSeleccionada)} onOpenChange={() => setAlertaSeleccionada(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Detalle de alerta generada</AlertDialogTitle>
          </AlertDialogHeader>
          {alertaSeleccionada && (
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Factor:</span> {alertaSeleccionada.factor}
              </p>
              <p>
                <span className="font-semibold">Nivel de riesgo:</span> {alertaSeleccionada.nivel.toUpperCase()}
              </p>
              <p>
                <span className="font-semibold">Fecha:</span> {new Date(alertaSeleccionada.fecha).toLocaleString("es-MX")}
              </p>
              <p>
                <span className="font-semibold">Descripción:</span> {alertaSeleccionada.descripcion}
              </p>
            </div>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
