"use client"

import { useMemo, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  AlertTriangle,
  CheckCircle2,
  FileText,
  Globe2,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react"

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
  },
  {
    id: "monto-frecuencia",
    titulo: "Monto y frecuencia",
    descripcion: "Volumen transaccional habitual y operaciones extraordinarias.",
  },
  {
    id: "geografia",
    titulo: "Zona geográfica",
    descripcion: "Países o entidades federativas donde opera o tiene vínculos comerciales.",
  },
  {
    id: "divisa",
    titulo: "Tipo de divisa",
    descripcion: "Monedas utilizadas de manera recurrente en las operaciones.",
  },
  {
    id: "origen-destino",
    titulo: "Origen y destino de recursos",
    descripcion: "Procedencia del capital y destino de los fondos.",
  },
  {
    id: "naturaleza-operaciones",
    titulo: "Naturaleza de las operaciones",
    descripcion: "Forma de pago, instrumentos financieros y contrapartes.",
  },
  {
    id: "comportamiento",
    titulo: "Comportamiento inusual",
    descripcion: "Alertas por operaciones atípicas o inconsistentes con el perfil.",
  },
  {
    id: "pep",
    titulo: "Personas políticamente expuestas",
    descripcion: "Determinación de exposición pública o vínculos con PEPs.",
  },
]

const RISK_LEVELS = [
  { value: "bajo", label: "Bajo", color: "bg-emerald-100 text-emerald-700" },
  { value: "medio", label: "Medio", color: "bg-amber-100 text-amber-700" },
  { value: "alto", label: "Alto", color: "bg-rose-100 text-rose-700" },
]

type RiskValue = (typeof RISK_LEVELS)[number]["value"]

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
  const [tipoCliente, setTipoCliente] = useState("Persona física mexicana")
  const [responsable, setResponsable] = useState("")
  const [datosIdentificacion, setDatosIdentificacion] = useState<Record<string, string>>({})
  const [respuestas, setRespuestas] = useState<Record<string, FactorRespuesta>>({})
  const [alertas, setAlertas] = useState<AlertaRiesgo[]>([])
  const [alertaSeleccionada, setAlertaSeleccionada] = useState<AlertaRiesgo | null>(null)

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

  const matrizCalor = useMemo(() => {
    const data = [
      { seccion: "Identificación", nivel: nivelIdentificacion },
      { seccion: "Conocimiento", nivel: nivelConocimiento },
    ]
    return data
  }, [nivelIdentificacion, nivelConocimiento])

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
      description: `${factor.titulo} clasificado como riesgo ${respuesta.valor}.`,
    })
  }

  const riesgoIntegral = useMemo<RiskValue>(() => {
    if (nivelIdentificacion === "alto" || nivelConocimiento === "alto") return "alto"
    if (nivelIdentificacion === "medio" || nivelConocimiento === "medio") return "medio"
    return "bajo"
  }, [nivelIdentificacion, nivelConocimiento])

  return (
    <div className="space-y-6">
      <header className="grid gap-4 lg:grid-cols-2">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-700">
              <ShieldCheck className="h-5 w-5 text-emerald-600" /> Módulo KYC – Identificación & Conocimiento
            </CardTitle>
            <CardDescription>
              Integra expedientes conforme a la Ley Federal antilavado y evalúa el riesgo con enfoque basado en riesgo (EBR).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded border bg-emerald-50 p-4 text-sm">
              <p className="font-semibold text-emerald-700">Identificación</p>
              <p className="mt-2 text-emerald-800">
                Recaba y verifica los documentos obligatorios para acreditar identidad, domicilio y representación.
              </p>
            </div>
            <div className="rounded border bg-blue-50 p-4 text-sm">
              <p className="font-semibold text-blue-700">Conocimiento del cliente</p>
              <p className="mt-2 text-blue-800">
                Evalúa actividad, montos, geografía, comportamiento y PEP para determinar el riesgo residual.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-700">
              <Users className="h-5 w-5 text-slate-500" /> Datos del expediente
            </CardTitle>
            <CardDescription>Captura responsable, tipo de cliente y nivel de riesgo integral.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <Label>Tipo de cliente</Label>
              <Input value={tipoCliente} onChange={(event) => setTipoCliente(event.target.value)} placeholder="Persona física, moral, fideicomiso…" />
            </div>
            <div className="space-y-2 text-sm">
              <Label>Responsable del expediente</Label>
              <Input value={responsable} onChange={(event) => setResponsable(event.target.value)} placeholder="Nombre del oficial de cumplimiento" />
            </div>
            <div className="rounded-xl border bg-white p-4 text-sm">
              <p className="text-xs font-semibold uppercase text-slate-500">Riesgo integral</p>
              <div className="mt-2 flex items-center gap-3">
                <span className={`inline-flex h-3 w-3 rounded-full ${CLIENTE_COLORES[riesgoIntegral]}`}></span>
                <span className="text-base font-semibold capitalize">{riesgoIntegral}</span>
                <Badge variant="outline" className="border-slate-300 text-slate-600">
                  Identificación: {nivelIdentificacion}
                </Badge>
                <Badge variant="outline" className="border-slate-300 text-slate-600">
                  Conocimiento: {nivelConocimiento}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle className="text-emerald-700">Bloque 1 – Identificación</CardTitle>
            <CardDescription>
              Captura de datos y documentación soporte para validar identidad y representación.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {IDENTIFICACION_CAMPOS.map((grupo) => (
              <div key={grupo.id} className="rounded border border-emerald-100 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-emerald-700">{grupo.titulo}</h3>
                    <p className="text-sm text-muted-foreground">{grupo.descripcion}</p>
                  </div>
                  <Badge variant="outline" className="border-emerald-200 text-emerald-600">
                    {grupo.campos.filter((campo) => datosIdentificacion[campo.id]?.trim()).length}/{grupo.campos.length}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {grupo.campos.map((campo) => (
                    <div key={campo.id} className="space-y-1">
                      <Label className="text-sm">
                        {campo.label}
                        {campo.requerido && <span className="text-rose-500"> *</span>}
                      </Label>
                      <Input
                        value={datosIdentificacion[campo.id] ?? ""}
                        onChange={(event) =>
                          setDatosIdentificacion((prev) => ({
                            ...prev,
                            [campo.id]: event.target.value,
                          }))
                        }
                        placeholder={campo.label}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-600" /> Checklist documental
            </CardTitle>
            <CardDescription>
              Verifica que todos los documentos obligatorios estén completos y vigentes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[420px] pr-4">
              <ul className="space-y-2 text-sm">
                {IDENTIFICACION_CAMPOS.flatMap((grupo) => grupo.campos).map((campo) => (
                  <li
                    key={campo.id}
                    className={`flex items-center gap-2 rounded border p-2 ${datosIdentificacion[campo.id]?.trim() ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600"}`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {campo.label}
                      {campo.requerido && " (requerido)"}
                    </span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-700">Bloque 2 – Conocimiento del cliente</CardTitle>
            <CardDescription>
              Evalúa factores de riesgo con un mapa de calor que prioriza la atención inmediata.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {FACTORES_RIESGO.map((factor) => (
              <div key={factor.id} className="rounded border border-blue-100 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-blue-700">{factor.titulo}</h3>
                    <p className="text-sm text-muted-foreground">{factor.descripcion}</p>
                  </div>
                  {respuestas[factor.id]?.valor && (
                    <Badge className={`capitalize ${RISK_LEVELS.find((level) => level.value === respuestas[factor.id]?.valor)?.color}`}>
                      {respuestas[factor.id]?.valor}
                    </Badge>
                  )}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr,2fr]">
                  <div className="space-y-2">
                    <Label>Nivel de riesgo</Label>
                    <Select
                      value={respuestas[factor.id]?.valor}
                      onValueChange={(value: RiskValue) =>
                        setRespuestas((prev) => ({
                          ...prev,
                          [factor.id]: {
                            valor: value,
                            comentario: prev[factor.id]?.comentario ?? "",
                          },
                        }))
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecciona riesgo" />
                      </SelectTrigger>
                      <SelectContent>
                        {RISK_LEVELS.map((nivel) => (
                          <SelectItem key={nivel.value} value={nivel.value}>
                            {nivel.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Comentario y soporte</Label>
                    <Textarea
                      value={respuestas[factor.id]?.comentario ?? ""}
                      onChange={(event) =>
                        setRespuestas((prev) => ({
                          ...prev,
                          [factor.id]: {
                            valor: prev[factor.id]?.valor ?? "medio",
                            comentario: event.target.value,
                          },
                        }))
                      }
                      placeholder="Describe actividad, evidencias y controles aplicados."
                    />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => generarAlerta(factor.id)}>
                    Generar alerta inmediata
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-slate-600" /> Mapa de calor de riesgo
            </CardTitle>
            <CardDescription>
              Visualiza la madurez del expediente por bloque y atención prioritaria.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {matrizCalor.map((item) => (
                <div key={item.seccion} className="flex items-center justify-between rounded border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex h-3 w-3 rounded-full ${CLIENTE_COLORES[item.nivel]}`}></span>
                    <p className="font-semibold text-slate-700">{item.seccion}</p>
                  </div>
                  <Badge className={`capitalize ${RISK_LEVELS.find((nivel) => nivel.value === item.nivel)?.color}`}>
                    {item.nivel}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="rounded border bg-white p-4 text-sm text-slate-700">
              <p className="font-semibold">Metodología EBR</p>
              <p className="mt-2 text-muted-foreground">
                Combina controles de identificación y conocimiento para definir planes de acción diferenciados. El nivel integral determina periodicidad de actualización documental y monitoreo transaccional.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-600" /> Alertas generadas
            </CardTitle>
            <CardDescription>Seguimiento inmediato a factores de riesgo identificados.</CardDescription>
          </CardHeader>
          <CardContent>
            {alertas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay alertas registradas aún.</p>
            ) : (
              <ScrollArea className="h-72 pr-4">
                <ul className="space-y-3 text-sm">
                  {alertas.map((alerta) => (
                    <li
                      key={alerta.id}
                      className="rounded border border-slate-200 bg-white p-3 hover:border-emerald-300"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-slate-700">{alerta.factor}</p>
                        <Badge className={`capitalize ${RISK_LEVELS.find((nivel) => nivel.value === alerta.nivel)?.color}`}>
                          {alerta.nivel}
                        </Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">{alerta.descripcion}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Generada el {new Date(alerta.fecha).toLocaleString("es-MX")}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setAlertaSeleccionada(alerta)}>
                          Ver detalle
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-slate-600" /> Plan de acción
            </CardTitle>
            <CardDescription>Define acciones por nivel de riesgo y periodicidad de actualización.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <div className="rounded border bg-emerald-50 p-3">
              <h4 className="font-semibold text-emerald-700">Riesgo bajo</h4>
              <p>Actualización documental anual, monitoreo transaccional estándar y revisión de listas cada 6 meses.</p>
            </div>
            <div className="rounded border bg-amber-50 p-3">
              <h4 className="font-semibold text-amber-700">Riesgo medio</h4>
              <p>Actualización documental semestral, monitoreo reforzado y validación mensual de listas restrictivas.</p>
            </div>
            <div className="rounded border bg-rose-50 p-3">
              <h4 className="font-semibold text-rose-700">Riesgo alto</h4>
              <p>Actualización trimestral, autorización senior y monitoreo transaccional continuo con reportes excepcionales.</p>
            </div>
            <div className="rounded border bg-white p-3">
              <h4 className="font-semibold text-slate-700">Personas políticamente expuestas</h4>
              <p className="text-muted-foreground">
                Requieren aprobación de alta dirección, origen de recursos documentado y monitoreo reforzado independientemente del nivel calculado.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <AlertDialog open={Boolean(alertaSeleccionada)} onOpenChange={() => setAlertaSeleccionada(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Detalle de alerta</AlertDialogTitle>
            <AlertDialogDescription>
              Información registrada para escalamiento y atención inmediata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {alertaSeleccionada && (
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Factor:</span> {alertaSeleccionada.factor}
              </p>
              <p>
                <span className="font-semibold">Nivel:</span> {alertaSeleccionada.nivel}
              </p>
              <p>
                <span className="font-semibold">Descripción:</span> {alertaSeleccionada.descripcion}
              </p>
              <p>
                <span className="font-semibold">Fecha:</span> {new Date(alertaSeleccionada.fecha).toLocaleString("es-MX")}
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
            <AlertDialogAction>Cargar evidencia</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
