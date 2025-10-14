"use client"

import { useEffect, useMemo, useState } from "react"
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
import { CheckCircle2, Globe2, MapPin, ShieldCheck, UserCheck } from "lucide-react"

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

const CLIENTE_TIPO_MAP: Record<string, string> = {
  pfn: "Persona física mexicana",
  pfe: "Persona física extranjera",
  pmn: "Persona moral mexicana",
  pme: "Persona moral extranjera",
  fideicomiso: "Fideicomiso",
  dependencia: "Dependencia o entidad pública",
  vehiculo: "Vehículo corporativo",
  otro: "Otro sujeto obligado",
}

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

export default function KycExpedientePage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [tipoCliente, setTipoCliente] = useState("Persona física mexicana")
  const [responsable, setResponsable] = useState("")
  const [datosIdentificacion, setDatosIdentificacion] = useState<Record<string, string>>({})
  const [respuestas, setRespuestas] = useState<Record<string, FactorRespuesta>>({})
  const [alertas, setAlertas] = useState<AlertaRiesgo[]>([])
  const [alertaSeleccionada, setAlertaSeleccionada] = useState<AlertaRiesgo | null>(null)

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
      const tipoLabel = CLIENTE_TIPO_MAP[tipoGuardado] ?? tipoGuardado
      if (tipoLabel) {
        setTipoCliente(tipoLabel)
      }

      setDatosIdentificacion((prev) => ({
        ...prev,
        nombre: typeof coincidencia.nombre === "string" ? coincidencia.nombre : prev.nombre ?? "",
        rfc: typeof coincidencia.rfc === "string" ? coincidencia.rfc : prev.rfc ?? "",
      }))

      toast({
        title: "Cliente sincronizado",
        description: "Se importaron la razón social y el tipo de cliente desde actividades vulnerables.",
      })
    } catch (error) {
      console.error("No fue posible sincronizar el cliente desde actividades vulnerables", error)
    }
  }, [searchParams, toast])

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
              <Badge variant="secondary">{tipoCliente}</Badge>
              {responsable && <Badge variant="outline">Responsable: {responsable}</Badge>}
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
                <Select value={tipoCliente} onValueChange={setTipoCliente}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecciona tipo de cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Persona física mexicana">Persona física mexicana</SelectItem>
                    <SelectItem value="Persona física extranjera">Persona física extranjera</SelectItem>
                    <SelectItem value="Persona moral mexicana">Persona moral mexicana</SelectItem>
                    <SelectItem value="Persona moral extranjera">Persona moral extranjera</SelectItem>
                    <SelectItem value="Fideicomiso">Fideicomiso</SelectItem>
                    <SelectItem value="Dependencia o entidad pública">Dependencia o entidad pública</SelectItem>
                    <SelectItem value="Vehículo corporativo">Vehículo corporativo</SelectItem>
                    <SelectItem value="Otro sujeto obligado">Otro sujeto obligado</SelectItem>
                  </SelectContent>
                </Select>
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
                          onChange={(event) =>
                            setDatosIdentificacion((prev) => ({ ...prev, [campo.id]: event.target.value }))
                          }
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
