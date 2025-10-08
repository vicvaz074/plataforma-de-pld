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
  AlertCircle,
  Building2,
  CheckCircle2,
  Download,
  FileText,
  Info,
  Plus,
  ShieldAlert,
  TrendingUp,
  Users,
} from "lucide-react"
import { actividadesVulnerables } from "@/lib/data/actividades"
import {
  UMA_PERIODS,
  findUmaByMonthYear,
  listAvailableYears,
  listMonthsForYear,
} from "@/lib/data/uma"

const MONTHS = [
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

const CLIENTE_TIPOS = [
  { value: "pfn", label: "Persona física mexicana" },
  { value: "pfe", label: "Persona física extranjera" },
  { value: "pmn", label: "Persona moral mexicana" },
  { value: "pme", label: "Persona moral extranjera" },
  { value: "fideicomiso", label: "Fideicomiso" },
  { value: "dependencia", label: "Dependencia o entidad pública" },
  { value: "vehiculo", label: "Vehículo corporativo" },
  { value: "otro", label: "Otro sujeto obligado" },
]

type UmbralStatus = "sin-obligacion" | "identificacion" | "aviso"

interface OperacionCliente {
  id: string
  actividadKey: string
  actividadNombre: string
  tipoCliente: string
  cliente: string
  rfc: string
  mismoGrupo: boolean
  periodo: string
  mes: number
  anio: number
  monto: number
  moneda: string
  fechaOperacion: string
  tipoOperacion: string
  evidencia: string
  umaDiaria: number
  identificacionUmbralPesos: number
  avisoUmbralPesos: number
  umbralStatus: UmbralStatus
  acumuladoCliente: number
  alerta: string | null
  avisoPresentado: boolean
}

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1

function formatCurrency(value: number) {
  return value.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  })
}

function monthLabel(month: number) {
  return MONTHS[month - 1] ?? ""
}

function buildPeriodo(year: number, month: number) {
  return `${year}${month.toString().padStart(2, "0")}`
}

function getStatusLabel(status: UmbralStatus) {
  if (status === "aviso") return "Aviso obligatorio"
  if (status === "identificacion") return "Identificación obligatoria"
  return "Sin obligación"
}

function getStatusColor(status: UmbralStatus) {
  if (status === "aviso") return "bg-red-500"
  if (status === "identificacion") return "bg-amber-500"
  return "bg-emerald-500"
}

export default function ActividadesVulnerablesPage() {
  const { toast } = useToast()
  const [actividadKey, setActividadKey] = useState<string>(actividadesVulnerables[0]?.key ?? "")
  const [anioSeleccionado, setAnioSeleccionado] = useState<number>(currentYear)
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(currentMonth)
  const [montoOperacion, setMontoOperacion] = useState<string>("")
  const [tipoCliente, setTipoCliente] = useState<string>(CLIENTE_TIPOS[0]?.value ?? "")
  const [clienteNombre, setClienteNombre] = useState<string>("")
  const [rfc, setRfc] = useState<string>("")
  const [mismoGrupo, setMismoGrupo] = useState<string>("no")
  const [tipoOperacion, setTipoOperacion] = useState<string>("")
  const [moneda, setMoneda] = useState<string>("MXN")
  const [fechaOperacion, setFechaOperacion] = useState<string>(new Date().toISOString().substring(0, 10))
  const [evidencia, setEvidencia] = useState<string>("")
  const [operaciones, setOperaciones] = useState<OperacionCliente[]>([])
  const [avisoPreliminar, setAvisoPreliminar] = useState<OperacionCliente | null>(null)

  const actividadSeleccionada = useMemo(
    () => actividadesVulnerables.find((actividad) => actividad.key === actividadKey),
    [actividadKey],
  )

  const umaSeleccionada = useMemo(() => findUmaByMonthYear(mesSeleccionado, anioSeleccionado), [mesSeleccionado, anioSeleccionado])

  const umbralPesos = useMemo(() => {
    if (!umaSeleccionada || !actividadSeleccionada) {
      return null
    }
    const diaria = umaSeleccionada.daily
    return {
      identificacion: actividadSeleccionada.identificacionUmbralUma * diaria,
      aviso: actividadSeleccionada.avisoUmbralUma * diaria,
    }
  }, [umaSeleccionada, actividadSeleccionada])

  const resumenUmbrales = useMemo(() => {
    const acumulados = operaciones.reduce(
      (acc, operacion) => {
        acc[operacion.umbralStatus] = (acc[operacion.umbralStatus] ?? 0) + 1
        return acc
      },
      {} as Record<UmbralStatus, number>,
    )

    return {
      sinObligacion: acumulados["sin-obligacion"] ?? 0,
      identificacion: acumulados["identificacion"] ?? 0,
      aviso: acumulados["aviso"] ?? 0,
    }
  }, [operaciones])

  const operacionesAgrupadas = useMemo(() => {
    const mapa = new Map<UmbralStatus, OperacionCliente[]>()
    operaciones.forEach((operacion) => {
      const lista = mapa.get(operacion.umbralStatus) ?? []
      lista.push(operacion)
      mapa.set(operacion.umbralStatus, lista)
    })
    return mapa
  }, [operaciones])

  const availableYears = useMemo(() => listAvailableYears(), [])

  const mesesDisponibles = useMemo(() => listMonthsForYear(anioSeleccionado), [anioSeleccionado])

  const documentoRequerido = useMemo(() => {
    if (!actividadSeleccionada) return []

    const clienteKey = (() => {
      switch (tipoCliente) {
        case "pfn":
          return "personaFisica"
        case "pfe":
          return "personaExtranjera"
        case "pmn":
          return "personaMoral"
        case "pme":
          return "personaMoral"
        case "fideicomiso":
          return "fideicomiso"
        case "vehiculo":
          return "vehiculo"
        case "dependencia":
          return "autoridad"
        default:
          return "otro"
      }
    })()

    // @ts-expect-error – acceso controlado a la propiedad
    return actividadSeleccionada.clienteObligaciones[clienteKey] ?? []
  }, [actividadSeleccionada, tipoCliente])

  const agregarOperacion = () => {
    if (!actividadSeleccionada || !umaSeleccionada || !umbralPesos) {
      toast({
        title: "Información incompleta",
        description: "Selecciona la actividad, año, mes y verifica que existan UMAs disponibles.",
        variant: "destructive",
      })
      return
    }

    if (!clienteNombre || !rfc || !tipoOperacion || !montoOperacion) {
      toast({
        title: "Faltan datos",
        description: "Completa la información del cliente, RFC, tipo de operación y monto.",
        variant: "destructive",
      })
      return
    }

    const monto = Number(montoOperacion)
    if (Number.isNaN(monto) || monto <= 0) {
      toast({
        title: "Monto inválido",
        description: "El monto debe ser numérico y mayor a cero.",
        variant: "destructive",
      })
      return
    }

    const periodo = buildPeriodo(anioSeleccionado, mesSeleccionado)

    const operacionesPrevias = operaciones.filter(
      (operacion) =>
        operacion.actividadKey === actividadSeleccionada.key &&
        operacion.periodo === periodo &&
        operacion.rfc.toUpperCase() === rfc.trim().toUpperCase() &&
        !operacion.avisoPresentado,
    )

    const acumuladoPrevio = operacionesPrevias.reduce((acc, operacion) => acc + operacion.monto, 0)
    const acumuladoCliente = acumuladoPrevio + monto

    let status: UmbralStatus = "sin-obligacion"
    let alerta: string | null = null

    if (acumuladoCliente >= umbralPesos.aviso) {
      status = "aviso"
      alerta = "Supera el umbral de aviso. Preparar aviso de 17 días y suspender acumulación." 
    } else if (acumuladoCliente >= umbralPesos.identificacion) {
      status = "identificacion"
      alerta = "Supera el umbral de identificación. Integrar expediente y vigilar acumulación por 6 meses."
    }

    const nuevaOperacion: OperacionCliente = {
      id: crypto.randomUUID(),
      actividadKey: actividadSeleccionada.key,
      actividadNombre: `${actividadSeleccionada.fraccion} – ${actividadSeleccionada.nombre}`,
      tipoCliente,
      cliente: clienteNombre.trim(),
      rfc: rfc.trim().toUpperCase(),
      mismoGrupo: mismoGrupo === "si",
      periodo,
      mes: mesSeleccionado,
      anio: anioSeleccionado,
      monto,
      moneda,
      fechaOperacion,
      tipoOperacion,
      evidencia,
      umaDiaria: umaSeleccionada.daily,
      identificacionUmbralPesos: umbralPesos.identificacion,
      avisoUmbralPesos: umbralPesos.aviso,
      umbralStatus: status,
      acumuladoCliente,
      alerta,
      avisoPresentado: false,
    }

    setOperaciones((prev) => [...prev, nuevaOperacion])

    if (status !== "sin-obligacion") {
      toast({
        title: getStatusLabel(status),
        description: alerta ?? "Revisar obligaciones aplicables.",
      })
    } else {
      toast({
        title: "Operación registrada",
        description: "Se registró la operación sin obligaciones activas.",
      })
    }
  }

  const marcarAvisoPresentado = (id: string) => {
    setOperaciones((prev) =>
      prev.map((operacion) =>
        operacion.id === id
          ? {
              ...operacion,
              avisoPresentado: true,
              alerta: "Aviso marcado como presentado. Reiniciar acumulación a partir de esta fecha.",
            }
          : operacion,
      ),
    )
  }

  const generarAvisoPreliminar = (operacion: OperacionCliente) => {
    setAvisoPreliminar(operacion)
  }

  const exportarXml = (operacion: OperacionCliente) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<avisoPLD>\n  <periodo>${operacion.periodo}</periodo>\n  <actividad>${operacion.actividadKey}</actividad>\n  <claveActividad>${operacion.actividadKey.toUpperCase()}</claveActividad>\n  <sujetoObligado>${operacion.rfc}</sujetoObligado>\n  <cliente>\n    <nombre>${operacion.cliente}</nombre>\n    <tipoCliente>${operacion.tipoCliente}</tipoCliente>\n    <mismoGrupo>${operacion.mismoGrupo ? "SI" : "NO"}</mismoGrupo>\n  </cliente>\n  <operacion>\n    <fecha>${operacion.fechaOperacion}</fecha>\n    <monto moneda="${operacion.moneda}">${operacion.monto.toFixed(2)}</monto>\n    <tipo>${operacion.tipoOperacion}</tipo>\n    <evidencia>${operacion.evidencia.replace(/&/g, "&amp;")}</evidencia>\n  </operacion>\n</avisoPLD>`

    const blob = new Blob([xml], { type: "application/xml" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `aviso-${operacion.periodo}-${operacion.rfc}.xml`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast({
      title: "XML generado",
      description: "Se descargó el archivo XML preliminar para revisión.",
    })
  }

  const obligacionesTexto = actividadSeleccionada?.obligaciones ?? null

  return (
    <div className="space-y-6">
      <header className="grid gap-4 lg:grid-cols-2">
        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700">
              <ShieldAlert className="h-5 w-5" /> Identificación de Actividades Vulnerables y Umbrales SAT
            </CardTitle>
            <CardDescription>
              Plataforma actualizada con UMAs oficiales (2020-2024) para evaluar obligaciones de identificación y aviso conforme a la Ley Federal para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">UMAs vigentes por ciclo</p>
              <div className="mt-2 space-y-1 text-sm">
                {UMA_PERIODS.map((periodo) => (
                  <div key={periodo.cycle} className="flex items-center justify-between rounded border px-3 py-1 text-xs">
                    <span>{periodo.cycle} ({new Date(periodo.validFrom).toLocaleDateString("es-MX", { month: "short", year: "numeric" })} - {new Date(periodo.validTo).toLocaleDateString("es-MX", { month: "short", year: "numeric" })})</span>
                    <span className="font-semibold">{formatCurrency(periodo.daily)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded border bg-emerald-50/60 p-4 text-sm leading-relaxed text-emerald-900">
              <p className="font-semibold">Criterios clave</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>UMAs aplican del 1 de febrero al 31 de enero del año siguiente.</li>
                <li>La acumulación es mensual por cliente y operación; al presentar aviso reinicia el conteo.</li>
                <li>Operaciones del mismo grupo empresarial deben evaluarse para informe 27 Bis en caso de no presentar aviso.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-slate-600" /> Resumen de umbrales
            </CardTitle>
            <CardDescription>Seguimiento automático de obligaciones por operación y acumulado mensual.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border bg-emerald-50 p-3 text-center">
              <p className="text-xs font-semibold uppercase text-emerald-600">Sin obligación</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{resumenUmbrales.sinObligacion}</p>
              <p className="text-xs text-muted-foreground">No supera umbral de identificación.</p>
            </div>
            <div className="rounded-xl border bg-amber-50 p-3 text-center">
              <p className="text-xs font-semibold uppercase text-amber-600">Identificación</p>
              <p className="mt-2 text-2xl font-bold text-amber-700">{resumenUmbrales.identificacion}</p>
              <p className="text-xs text-muted-foreground">Requiere expediente y monitoreo 6 meses.</p>
            </div>
            <div className="rounded-xl border bg-rose-50 p-3 text-center">
              <p className="text-xs font-semibold uppercase text-rose-600">Aviso SAT</p>
              <p className="mt-2 text-2xl font-bold text-rose-700">{resumenUmbrales.aviso}</p>
              <p className="text-xs text-muted-foreground">Aviso en 17 días y controles reforzados.</p>
            </div>
          </CardContent>
        </Card>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-600" /> Cuestionario inicial
            </CardTitle>
            <CardDescription>
              Define la actividad vulnerable, periodo de análisis y datos del cliente para obtener el umbral aplicable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Actividad vulnerable</Label>
                <Select value={actividadKey} onValueChange={setActividadKey}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecciona una actividad" />
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
                <Label>Año</Label>
                <Select
                  value={anioSeleccionado.toString()}
                  onValueChange={(value) => {
                    const year = Number(value)
                    setAnioSeleccionado(year)
                    const meses = listMonthsForYear(year)
                    if (!meses.includes(mesSeleccionado)) {
                      setMesSeleccionado(meses[0] ?? 1)
                    }
                  }}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecciona año" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mes</Label>
                <Select value={mesSeleccionado.toString()} onValueChange={(value) => setMesSeleccionado(Number(value))}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecciona mes" />
                  </SelectTrigger>
                  <SelectContent>
                    {mesesDisponibles.map((mes) => (
                      <SelectItem key={mes} value={mes.toString()}>
                        {monthLabel(mes)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monto de la operación (MXN)</Label>
                <Input value={montoOperacion} onChange={(event) => setMontoOperacion(event.target.value)} placeholder="0.00" />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de cliente</Label>
                <Select value={tipoCliente} onValueChange={setTipoCliente}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecciona tipo de cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENTE_TIPOS.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>¿Forma parte del mismo grupo empresarial? <Info className="inline h-4 w-4 text-slate-500" /></Label>
                <Select value={mismoGrupo} onValueChange={setMismoGrupo}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Selecciona una opción" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No</SelectItem>
                    <SelectItem value="si">Sí</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Si pertenece al mismo grupo empresarial y se supera el umbral de aviso, debe presentarse informe 27 Bis en ceros cuando no corresponda aviso individual.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Nombre o razón social del cliente</Label>
                <Input value={clienteNombre} onChange={(event) => setClienteNombre(event.target.value)} placeholder="Nombre del cliente" />
              </div>
              <div className="space-y-2">
                <Label>RFC</Label>
                <Input value={rfc} onChange={(event) => setRfc(event.target.value.toUpperCase())} placeholder="RFC" maxLength={13} className="uppercase" />
              </div>
              <div className="space-y-2">
                <Label>Tipo o naturaleza de la operación</Label>
                <Input value={tipoOperacion} onChange={(event) => setTipoOperacion(event.target.value)} placeholder="Venta de boleto, entrega de premio, arrendamiento, etc." />
              </div>
              <div className="space-y-2">
                <Label>Fecha de realización</Label>
                <Input type="date" value={fechaOperacion} onChange={(event) => setFechaOperacion(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Input value={moneda} onChange={(event) => setMoneda(event.target.value.toUpperCase())} maxLength={3} />
              </div>
              <div className="space-y-2">
                <Label>Evidencia y soporte</Label>
                <Textarea value={evidencia} onChange={(event) => setEvidencia(event.target.value)} placeholder="Detalle del contrato, número de transferencia, folio de recibo, etc." />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={agregarOperacion} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="mr-2 h-4 w-4" /> Añadir actividad vulnerable
              </Button>
              {umbralPesos && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                    Identificación: {formatCurrency(umbralPesos.identificacion)}
                  </Badge>
                  <Badge variant="outline" className="border-rose-200 text-rose-700">
                    Aviso: {formatCurrency(umbralPesos.aviso)}
                  </Badge>
                  <span>UMA diaria aplicada: {umaSeleccionada?.daily.toFixed(2)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700">
              <Users className="h-5 w-5" /> Checklist documental por tipo de cliente
            </CardTitle>
            <CardDescription>
              Documentación exigible para integrar expediente conforme al umbral alcanzado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[380px] pr-4">
              <ul className="space-y-2 text-sm">
                {documentoRequerido.map((documento) => (
                  <li key={documento} className="flex items-start gap-2 rounded border border-emerald-200/70 bg-white/60 p-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                    <span>{documento}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      </section>

      {actividadSeleccionada && (
        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Obligaciones aplicables</CardTitle>
              <CardDescription>
                Reglas específicas según el umbral alcanzado para {actividadSeleccionada.fraccion} – {actividadSeleccionada.nombre}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-relaxed">
              {obligacionesTexto && (
                <>
                  <div className="rounded border bg-slate-50 p-4">
                    <h4 className="font-semibold text-slate-700">Sin rebasar umbral</h4>
                    <p className="mt-2 text-muted-foreground">{obligacionesTexto.sinUmbral}</p>
                  </div>
                  <div className="rounded border bg-amber-50 p-4">
                    <h4 className="font-semibold text-amber-700">Umbral de identificación</h4>
                    <p className="mt-2 text-amber-800">{obligacionesTexto.identificacion}</p>
                  </div>
                  <div className="rounded border bg-rose-50 p-4">
                    <h4 className="font-semibold text-rose-700">Umbral de aviso</h4>
                    <p className="mt-2 text-rose-800">{obligacionesTexto.aviso}</p>
                  </div>
                </>
              )}
              <div className="rounded border bg-indigo-50 p-4 text-indigo-900">
                <h4 className="font-semibold">Criterios UIF</h4>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {actividadSeleccionada.criteriosUif.map((criterio) => (
                    <li key={criterio}>{criterio}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle>Ejemplos y guía de operación</CardTitle>
              <CardDescription>
                Utiliza la nomenclatura oficial de periodo (AAAAMM) para clasificar actos u operaciones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="rounded border bg-white p-4">
                <h4 className="font-semibold text-slate-700">Ejemplos</h4>
                <ul className="mt-2 space-y-2">
                  {actividadSeleccionada.ejemplosOperaciones.map((ejemplo) => (
                    <li key={ejemplo.titulo} className="rounded border border-slate-200/80 bg-slate-50 p-3">
                      <p className="font-semibold text-slate-700">{ejemplo.titulo}</p>
                      <p className="text-muted-foreground">{ejemplo.descripcion}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded border bg-emerald-50 p-4 text-emerald-900">
                <h4 className="font-semibold">Guía SAT y registro</h4>
                <p>
                  Para el registro de responsables ante el SAT es necesario contar con e.firma vigente, constancia de situación fiscal y datos del apoderado o representante legal. Se recomienda cargar identificación, comprobante de domicilio, actas constitutivas (si aplican) y carta de designación de encargado de cumplimiento.
                </p>
              </div>
              <div className="rounded border bg-blue-50 p-4 text-blue-900">
                <h4 className="font-semibold">Datos mínimos para aviso</h4>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>RFC del sujeto obligado y del cliente.</li>
                  <li>Periodo en nomenclatura AAAAMM.</li>
                  <li>Clave de actividad vulnerable y tipo de operación.</li>
                  <li>Monto, moneda, forma de pago, origen y destino de recursos.</li>
                  <li>Identificación de beneficiario final y documentación soporte.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-700">Control de operaciones y alertas</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="border-slate-300 text-slate-600">
              Total operaciones: {operaciones.length}
            </Badge>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {["sin-obligacion", "identificacion", "aviso"].map((status) => (
            <Card key={status} className="border-slate-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <span
                    className={`inline-flex h-3 w-3 rounded-full ${getStatusColor(status as UmbralStatus)}`}
                  ></span>
                  {getStatusLabel(status as UmbralStatus)}
                </CardTitle>
                <CardDescription>
                  {(operacionesAgrupadas.get(status as UmbralStatus) ?? []).length} operaciones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 pr-3">
                  <div className="space-y-3 text-xs">
                    {(operacionesAgrupadas.get(status as UmbralStatus) ?? []).map((operacion) => (
                      <div key={operacion.id} className="rounded border border-slate-200/80 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-slate-700">{operacion.cliente}</p>
                          <Badge variant="outline">{operacion.periodo}</Badge>
                        </div>
                        <p className="mt-1 text-slate-600">RFC: {operacion.rfc}</p>
                        <p className="text-slate-600">Monto acumulado: {formatCurrency(operacion.acumuladoCliente)}</p>
                        <p className="text-slate-600">Operación: {operacion.tipoOperacion}</p>
                        {operacion.alerta && (
                          <div className="mt-2 flex items-center gap-2 rounded bg-amber-50 p-2 text-amber-800">
                            <AlertCircle className="h-4 w-4" />
                            <span>{operacion.alerta}</span>
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {status === "aviso" && !operacion.avisoPresentado && (
                            <Button size="sm" variant="outline" onClick={() => marcarAvisoPresentado(operacion.id)}>
                              Marcar aviso presentado
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => generarAvisoPreliminar(operacion)}>
                            Generar aviso preliminar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => exportarXml(operacion)}>
                            <Download className="mr-1 h-4 w-4" /> XML
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-slate-600" /> Seguimiento y acumulación
            </CardTitle>
            <CardDescription>Controla operaciones acumulables por cliente hasta 6 meses posteriores al umbral de identificación.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Una vez superado el umbral de identificación, se deben monitorear las operaciones del mismo cliente durante los 6 meses siguientes. Solo se acumulan aquellas operaciones que individualmente superan el umbral de identificación. Cuando se marca el aviso como presentado, se reinicia el seguimiento acumulado.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded border bg-slate-50 p-3">
                <h4 className="font-semibold text-slate-700">Alertas por acumulación</h4>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>Semáforo verde: sin obligación activa.</li>
                  <li>Semáforo ámbar: identificar y preparar controles documentales.</li>
                  <li>Semáforo rojo: preparar aviso SAT o informe 27 Bis según corresponda.</li>
                </ul>
              </div>
              <div className="rounded border bg-white p-3">
                <h4 className="font-semibold text-slate-700">Controles sugeridos</h4>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>Validación de listas restrictivas y PEPs.</li>
                  <li>Confirmación bancaria de origen de recursos.</li>
                  <li>Checklist de documentación completo y vigente.</li>
                  <li>Bitácora de comunicación con el cliente.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Clasificación posterior</CardTitle>
            <CardDescription>
              Segmenta clientes conforme al semáforo de obligaciones una vez evaluadas sus operaciones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded border bg-emerald-50 p-3">
              <h4 className="font-semibold text-emerald-700">Clientes sin obligación</h4>
              <p>Operaciones individuales por debajo del umbral. No se acumulan para aviso.</p>
            </div>
            <div className="rounded border bg-amber-50 p-3">
              <h4 className="font-semibold text-amber-700">Clientes con obligación de identificación</h4>
              <p>Requieren expediente completo, análisis de riesgo y monitoreo por 6 meses.</p>
            </div>
            <div className="rounded border bg-rose-50 p-3">
              <h4 className="font-semibold text-rose-700">Clientes con obligación de aviso</h4>
              <p>Se genera aviso conforme al artículo 23 del Reglamento y se detiene la acumulación del periodo.</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <AlertDialog open={Boolean(avisoPreliminar)} onOpenChange={() => setAvisoPreliminar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aviso preliminar</AlertDialogTitle>
            <AlertDialogDescription>
              Información generada para revisión interna antes de cargar en el portal del SAT.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {avisoPreliminar && (
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-semibold">Periodo:</span> {avisoPreliminar.periodo}
              </p>
              <p>
                <span className="font-semibold">Actividad:</span> {avisoPreliminar.actividadNombre}
              </p>
              <p>
                <span className="font-semibold">Cliente:</span> {avisoPreliminar.cliente} ({avisoPreliminar.rfc})
              </p>
              <p>
                <span className="font-semibold">Monto:</span> {formatCurrency(avisoPreliminar.monto)} {avisoPreliminar.moneda}
              </p>
              <p>
                <span className="font-semibold">Tipo de operación:</span> {avisoPreliminar.tipoOperacion}
              </p>
              <p>
                <span className="font-semibold">Evidencia:</span> {avisoPreliminar.evidencia || "Sin especificar"}
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cerrar</AlertDialogCancel>
            {avisoPreliminar && (
              <AlertDialogAction onClick={() => exportarXml(avisoPreliminar)}>
                <Download className="mr-1 h-4 w-4" /> Descargar XML
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
