"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { AlertCircle, CheckCircle2, Info, Plus, Shield, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import {
  calculateThreshold,
  describeThreshold,
  formatCurrency,
  formatUma,
  generateUmaMonths,
  UMA_PERIODS,
  type UmaMonth,
} from "@/lib/uma"
import {
  clientChecklists,
  type ClientChecklist,
  type ClientChecklistItem,
  type ClientTypeId,
} from "@/lib/clientes"
import {
  vulnerableActivities,
  type SubActivity,
  type ThresholdDetail,
  type VulnerableActivity,
} from "@/lib/actividades-vulnerables"

interface OperationEntry {
  id: string
  clienteNombre: string
  clienteRfc: string
  tipoCliente: ClientTypeId
  esMismoGrupo: boolean
  grupoEmpresarial?: string
  actividadDescripcion: string
  tipoOperacion: string
  fecha: string
  periodo: UmaMonth
  moneda: "MXN" | "USD" | "EUR"
  tipoCambio: number
  montoMoneda: number
  montoMx: number
  montoUma?: number
  excedeIdentificacion: boolean
  excedeAviso: boolean
  evidencia: string
  comentarios: string
}

interface ClientSummary {
  rfc: string
  nombre: string
  tipoCliente: ClientTypeId
  grupoEmpresarial?: string
  esMismoGrupo: boolean
  operaciones: OperationEntry[]
  totalUma: number
  maxUma: number
  acumuladoSeisMesesUma: number
  excedeIdentificacion: boolean
  excedeAviso: boolean
}

const monthOptions = generateUmaMonths(2020, 9, 60)
const yearOptions = Array.from(new Set(monthOptions.map((month) => month.year)))

const getDefaultMonth = () => {
  const current = monthOptions.find((month) => {
    const now = new Date()
    return month.year === now.getFullYear() && month.month === now.getMonth() + 1
  })
  if (current) return current
  return monthOptions[0]
}

const cryptoId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

const getActivityByFraction = (fraction: string): VulnerableActivity | undefined =>
  vulnerableActivities.find((activity) => activity.fraccion === fraction)

const getSubActivity = (activity: VulnerableActivity | undefined, key: string): SubActivity | undefined =>
  activity?.actividades.find((sub) => sub.key === key)

const getThreshold = (subActivity: SubActivity | undefined, type: ThresholdDetail["tipo"]) =>
  subActivity?.thresholds.find((threshold) => threshold.tipo === type)

const formatChecklistItem = (item: ClientChecklistItem) =>
  `${item.obligatorio ? "Obligatorio" : "Opcional"} · ${item.label}`

const buildPeriodCode = (month: UmaMonth | null) => {
  if (!month) return ""
  return `${month.year}${String(month.month).padStart(2, "0")}`
}

const getSixMonthWindow = (operations: OperationEntry[], reference: UmaMonth) => {
  const end = new Date(Date.UTC(reference.year, reference.month - 1, 1))
  const start = new Date(end)
  start.setUTCMonth(start.getUTCMonth() - 5)
  return operations.filter((operation) => {
    const operationDate = new Date(operation.fecha)
    return operationDate >= start && operationDate <= end
  })
}

const computeClientSummaries = (
  operations: OperationEntry[],
  subActivity: SubActivity | undefined,
  selectedMonth: UmaMonth | null,
): ClientSummary[] => {
  if (!operations.length || !selectedMonth || !subActivity) return []
  const identification = getThreshold(subActivity, "identificacion")
  const aviso = getThreshold(subActivity, "aviso")

  const map = new Map<string, ClientSummary>()

  operations.forEach((operation) => {
    const key = operation.clienteRfc
    const existing = map.get(key)
    const montoUma = operation.montoUma ?? 0
    if (!existing) {
      const windowOperations = getSixMonthWindow(
        operations.filter((item) => item.clienteRfc === operation.clienteRfc && item.montoUma),
        selectedMonth,
      )
      const acumuladoWindow = windowOperations.reduce((total, item) => total + (item.montoUma ?? 0), 0)
      map.set(key, {
        rfc: operation.clienteRfc,
        nombre: operation.clienteNombre,
        tipoCliente: operation.tipoCliente,
        grupoEmpresarial: operation.grupoEmpresarial,
        esMismoGrupo: operation.esMismoGrupo,
        operaciones: [operation],
        totalUma: montoUma,
        maxUma: montoUma,
        acumuladoSeisMesesUma: acumuladoWindow,
        excedeIdentificacion:
          identification?.uma === "todas" ? true : Boolean(identification && acumuladoWindow >= (identification.uma as number)),
        excedeAviso: Boolean(aviso && acumuladoWindow >= (aviso.uma as number)),
      })
    } else {
      const actualizada: ClientSummary = {
        ...existing,
        operaciones: [...existing.operaciones, operation],
        totalUma: existing.totalUma + montoUma,
        maxUma: Math.max(existing.maxUma, montoUma),
      }
      const windowOperations = getSixMonthWindow(
        [...actualizada.operaciones],
        selectedMonth,
      )
      const acumuladoWindow = windowOperations.reduce((total, item) => total + (item.montoUma ?? 0), 0)
      actualizada.acumuladoSeisMesesUma = acumuladoWindow
      actualizada.excedeIdentificacion =
        identification?.uma === "todas"
          ? true
          : Boolean(identification && acumuladoWindow >= (identification.uma as number))
      actualizada.excedeAviso = Boolean(aviso && acumuladoWindow >= (aviso.uma as number))
      map.set(key, actualizada)
    }
  })

  return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
}

const getSemaforoColor = (summary: ClientSummary, identification: ThresholdDetail | undefined) => {
  if (summary.excedeAviso) return "bg-destructive/10 text-destructive"
  if (summary.excedeIdentificacion || identification?.uma === "todas") return "bg-amber-500/10 text-amber-700"
  return "bg-emerald-500/10 text-emerald-700"
}

const clientTypeLabel = (type: ClientTypeId) => {
  const checklist = clientChecklists.find((item) => item.tipo === type)
  return checklist?.nombre ?? "Cliente"
}

const fractionLabel = (fraction: VulnerableActivity | undefined, subActivity: SubActivity | undefined) => {
  if (!fraction || !subActivity) return "Selecciona una actividad vulnerable"
  return `${fraction.fraccion} · ${fraction.titulo} → ${subActivity.label}`
}

const infoMessages = {
  grupoEmpresarial:
    "Grupo empresarial: conjunto de empresas vinculadas por control directo o indirecto que comparten políticas y procesos. Si el cliente pertenece al mismo grupo, acumula operaciones sólo para efectos del informe 27 BIS cuando el sujeto obligado ya reportó un aviso por otra filial.",
  avisoCero:
    "El informe 27 BIS se presenta cuando no se realizan operaciones reportables en el periodo, aun siendo sujeto obligado. Genera el XML en blanco para cumplir con la obligación.",
}

const initialOperationForm = {
  clienteNombre: "",
  clienteRfc: "",
  tipoCliente: "persona-fisica-nacional" as ClientTypeId,
  esMismoGrupo: false,
  grupoEmpresarial: "",
  tipoOperacion: "",
  fecha: "",
  moneda: "MXN" as OperationEntry["moneda"],
  tipoCambio: 1,
  montoMoneda: 0,
  evidencia: "",
  comentarios: "",
}

type OperationFormState = typeof initialOperationForm

export default function ActividadesVulnerablesPage() {
  const { toast } = useToast()
  const [selectedFraction, setSelectedFraction] = useState<string>(vulnerableActivities[0]?.fraccion ?? "")
  const [selectedSubActivityKey, setSelectedSubActivityKey] = useState<string>(
    vulnerableActivities[0]?.actividades[0]?.key ?? "",
  )
  const [selectedYear, setSelectedYear] = useState<number>(getDefaultMonth().year)
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(getDefaultMonth().key)
  const [operations, setOperations] = useState<OperationEntry[]>([])
  const [operationForm, setOperationForm] = useState<OperationFormState>(initialOperationForm)
  const [selectedClientChecklist, setSelectedClientChecklist] = useState<ClientTypeId>("persona-fisica-nacional")
  const [checklistStatus, setChecklistStatus] = useState<Record<ClientTypeId, Record<string, boolean>>>(() => {
    const base: Record<ClientTypeId, Record<string, boolean>> = {
      "persona-fisica-nacional": {},
      "persona-fisica-extranjera": {},
      "persona-moral-mexicana": {},
      "persona-moral-extranjera": {},
      fideicomiso: {},
      "sociedad-financiera": {},
      "organizacion-sin-fines": {},
      "clientes-alto-riesgo": {},
    }
    return base
  })
  const [observacionesGenerales, setObservacionesGenerales] = useState<string>("")
  const [alertasGeneradas, setAlertasGeneradas] = useState<string[]>([])

  const fraction = useMemo(() => getActivityByFraction(selectedFraction), [selectedFraction])
  const subActivity = useMemo(
    () => getSubActivity(fraction, selectedSubActivityKey) ?? fraction?.actividades[0],
    [fraction, selectedSubActivityKey],
  )
  const identificationThreshold = useMemo(() => getThreshold(subActivity, "identificacion"), [subActivity])
  const avisoThreshold = useMemo(() => getThreshold(subActivity, "aviso"), [subActivity])

  const monthsForYear = useMemo(
    () => monthOptions.filter((month) => month.year === selectedYear),
    [selectedYear],
  )

  const selectedMonth = useMemo(
    () => monthOptions.find((month) => month.key === selectedMonthKey) ?? null,
    [selectedMonthKey],
  )

  const identificationCalculation = useMemo(
    () => calculateThreshold(selectedMonth, identificationThreshold?.uma ?? ("todas" as const)),
    [selectedMonth, identificationThreshold],
  )

  const avisoCalculation = useMemo(
    () => calculateThreshold(selectedMonth, avisoThreshold?.uma ?? ("todas" as const)),
    [selectedMonth, avisoThreshold],
  )

  const clientSummaries = useMemo(
    () => computeClientSummaries(operations, subActivity, selectedMonth),
    [operations, subActivity, selectedMonth],
  )

  const sinUmbral = clientSummaries.filter((summary) => !summary.excedeIdentificacion && !summary.excedeAviso)
  const identificacion = clientSummaries.filter(
    (summary) => (summary.excedeIdentificacion || identificationThreshold?.uma === "todas") && !summary.excedeAviso,
  )
  const aviso = clientSummaries.filter((summary) => summary.excedeAviso)

  const periodCode = buildPeriodCode(selectedMonth)

  const selectedChecklist: ClientChecklist | undefined = useMemo(
    () => clientChecklists.find((item) => item.tipo === selectedClientChecklist),
    [selectedClientChecklist],
  )

  const updateChecklist = (type: ClientTypeId, itemId: string, value: boolean) => {
    setChecklistStatus((prev) => ({
      ...prev,
      [type]: {
        ...(prev[type] ?? {}),
        [itemId]: value,
      },
    }))
  }

  const handleFormChange = <Key extends keyof OperationFormState>(key: Key, value: OperationFormState[Key]) => {
    setOperationForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleAddOperation = () => {
    if (!subActivity || !selectedMonth) {
      toast({ title: "Selecciona actividad y mes", description: "Indica la actividad vulnerable y el periodo de la UMA." })
      return
    }

    if (!selectedMonth.published || !selectedMonth.period) {
      toast({
        title: "UMA pendiente",
        description:
          "El SAT aún no publica la UMA del periodo seleccionado. Selecciona otro mes o espera la actualización oficial.",
        variant: "destructive",
      })
      return
    }

    if (!operationForm.clienteNombre || !operationForm.clienteRfc || !operationForm.fecha) {
      toast({
        title: "Campos obligatorios",
        description: "Captura nombre, RFC y fecha de la operación para continuar.",
        variant: "destructive",
      })
      return
    }

    if (operationForm.moneda !== "MXN" && (!operationForm.tipoCambio || operationForm.tipoCambio <= 0)) {
      toast({ title: "Tipo de cambio requerido", description: "Ingresa el tipo de cambio aplicado a la operación." })
      return
    }

    const montoMoneda = Number(operationForm.montoMoneda)
    if (!montoMoneda || montoMoneda <= 0) {
      toast({ title: "Monto inválido", description: "Captura un monto positivo." })
      return
    }

    const tipoCambio = operationForm.moneda === "MXN" ? 1 : Number(operationForm.tipoCambio)
    const montoMx = montoMoneda * tipoCambio
    const montoUma = selectedMonth.period.daily ? montoMx / selectedMonth.period.daily : undefined

    const identificacionUma =
      identificationThreshold?.uma === "todas" ? undefined : (identificationThreshold?.uma as number | undefined)
    const avisoUma = avisoThreshold?.uma === "todas" ? undefined : (avisoThreshold?.uma as number | undefined)

    const excedeIdentificacion =
      identificationThreshold?.uma === "todas"
        ? true
        : Boolean(montoUma && identificacionUma && montoUma >= identificacionUma)
    const excedeAviso = Boolean(montoUma && avisoUma && montoUma >= avisoUma)

    const entry: OperationEntry = {
      id: cryptoId(),
      clienteNombre: operationForm.clienteNombre.trim(),
      clienteRfc: operationForm.clienteRfc.trim().toUpperCase(),
      tipoCliente: operationForm.tipoCliente,
      esMismoGrupo: operationForm.esMismoGrupo,
      grupoEmpresarial: operationForm.grupoEmpresarial || undefined,
      actividadDescripcion: fractionLabel(fraction, subActivity),
      tipoOperacion: operationForm.tipoOperacion || "Operación registrada",
      fecha: operationForm.fecha,
      periodo: selectedMonth,
      moneda: operationForm.moneda,
      tipoCambio,
      montoMoneda,
      montoMx,
      montoUma,
      excedeIdentificacion,
      excedeAviso,
      evidencia: operationForm.evidencia,
      comentarios: operationForm.comentarios,
    }

    setOperations((prev) => [...prev, entry])
    setOperationForm(initialOperationForm)

    const nuevasAlertas: string[] = []
    if (excedeAviso) {
      nuevasAlertas.push(
        `El cliente ${entry.clienteNombre} supera el umbral de aviso por ${formatUma(avisoThreshold?.uma as number)}.`,
      )
    } else if (excedeIdentificacion || identificationThreshold?.uma === "todas") {
      nuevasAlertas.push(
        `El cliente ${entry.clienteNombre} requiere expediente completo (umbral de identificación alcanzado).`,
      )
    }

    if (nuevasAlertas.length) {
      setAlertasGeneradas((prev) => Array.from(new Set([...prev, ...nuevasAlertas])))
      toast({
        title: "Alerta generada",
        description: nuevasAlertas.join(" "),
      })
    } else {
      toast({ title: "Operación registrada", description: "La operación se guardó para el análisis de umbrales." })
    }
  }

  const handleRemoveOperation = (id: string) => {
    setOperations((prev) => prev.filter((operation) => operation.id !== id))
  }

  const checklistCompletions = useMemo(() => {
    const checklist = selectedChecklist
    if (!checklist) return 0
    const status = checklistStatus[checklist.tipo] ?? {}
    const total = checklist.documentos.length + checklist.datos.length
    const cumplidos = [...checklist.documentos, ...checklist.datos].filter((item) => status[item.id]).length
    return Math.round((cumplidos / total) * 100)
  }, [selectedChecklist, checklistStatus])

  const buildXml = (summary: ClientSummary) => {
    if (!subActivity || !selectedMonth) return ""
    const operaciones = summary.operaciones
      .map((operation) => `      <Operacion>
        <Fecha>${operation.fecha}</Fecha>
        <Tipo>${operation.tipoOperacion}</Tipo>
        <Moneda>${operation.moneda}</Moneda>
        <MontoMoneda>${operation.montoMoneda.toFixed(2)}</MontoMoneda>
        <MontoMXN>${operation.montoMx.toFixed(2)}</MontoMXN>
        <MontoUMA>${(operation.montoUma ?? 0).toFixed(2)}</MontoUMA>
        <TipoCambio>${operation.tipoCambio.toFixed(4)}</TipoCambio>
        <Evidencia>${operation.evidencia || "NA"}</Evidencia>
        <Comentarios>${operation.comentarios || ""}</Comentarios>
      </Operacion>`)
      .join("\n")

    return `<?xml version="1.0" encoding="UTF-8"?>
<AvisoPLD>
  <Encabezado>
    <Periodo>${buildPeriodCode(selectedMonth)}</Periodo>
    <ActividadVulnerable>${subActivity.satCode}</ActividadVulnerable>
    <Fraccion>${fraction?.fraccion}</Fraccion>
    <SubActividad>${subActivity.label}</SubActividad>
  </Encabezado>
  <Cliente>
    <Nombre>${summary.nombre}</Nombre>
    <RFC>${summary.rfc}</RFC>
    <TipoCliente>${clientTypeLabel(summary.tipoCliente)}</TipoCliente>
    <GrupoEmpresarial>${summary.grupoEmpresarial || "No"}</GrupoEmpresarial>
  </Cliente>
  <Operaciones>
${operaciones}
  </Operaciones>
  <Totales>
    <TotalUMA>${summary.totalUma.toFixed(2)}</TotalUMA>
    <AcumuladoSeisMeses>${summary.acumuladoSeisMesesUma.toFixed(2)}</AcumuladoSeisMeses>
    <ExcedeIdentificacion>${summary.excedeIdentificacion}</ExcedeIdentificacion>
    <ExcedeAviso>${summary.excedeAviso}</ExcedeAviso>
  </Totales>
</AvisoPLD>`
  }

  const descargarXml = (summary: ClientSummary) => {
    const xml = buildXml(summary)
    if (!xml) {
      toast({
        title: "Completa los datos",
        description: "Selecciona actividad y periodo válido para generar el XML.",
        variant: "destructive",
      })
      return
    }
    const blob = new Blob([xml], { type: "application/xml" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `aviso-${summary.rfc}-${buildPeriodCode(selectedMonth)}.xml`
    link.click()
    URL.revokeObjectURL(url)
    toast({ title: "XML generado", description: "Archivo listo para carga en el portal del SAT." })
  }

  const generarInformeEnBlanco = () => {
    if (!fraction || !subActivity || !selectedMonth) {
      toast({ title: "Selecciona datos", description: "Define actividad y periodo para el informe." })
      return
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Informe27BIS>
  <Periodo>${buildPeriodCode(selectedMonth)}</Periodo>
  <Actividad>${subActivity.satCode}</Actividad>
  <Descripcion>${subActivity.label}</Descripcion>
  <Operaciones>0</Operaciones>
  <Observaciones>${observacionesGenerales || "Sin operaciones reportables en el periodo."}</Observaciones>
</Informe27BIS>`
    const blob = new Blob([xml], { type: "application/xml" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `informe-27bis-${buildPeriodCode(selectedMonth)}.xml`
    link.click()
    URL.revokeObjectURL(url)
    toast({ title: "Informe 27 BIS", description: "Se generó el archivo en ceros para el periodo seleccionado." })
  }

  const renderChecklist = (title: string, items: ClientChecklistItem[], type: ClientTypeId) => (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-muted-foreground">{title}</h4>
      <div className="space-y-2">
        {items.map((item) => (
          <label
            key={item.id}
            className="flex items-start gap-3 rounded-lg border p-3 text-sm transition hover:border-primary/40"
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={Boolean(checklistStatus[type]?.[item.id])}
              onChange={(event) => updateChecklist(type, item.id, event.target.checked)}
            />
            <span>
              <span className="font-medium">{formatChecklistItem(item)}</span>
              {item.referencia && (
                <span className="block text-xs text-muted-foreground">Referencia: {item.referencia}</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </div>
  )

  const renderAlertas = () => {
    if (!alertasGeneradas.length) return <p className="text-sm text-muted-foreground">No hay alertas activas.</p>
    return (
      <ul className="space-y-2 text-sm">
        {alertasGeneradas.map((alerta) => (
          <li key={alerta} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span>{alerta}</span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
          <CardHeader>
            <CardTitle>Identificación de actividades vulnerables</CardTitle>
            <CardDescription>
              Selecciona la fracción de la LFPIORPI, determina el umbral vigente y genera obligaciones automáticas.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="rounded-lg border border-primary/30 bg-white/50 p-3 text-sm">
              <p className="font-semibold text-primary">Periodo UMA seleccionado</p>
              <p>{selectedMonth?.label ?? "Sin definir"}</p>
              <p className="text-xs text-muted-foreground">
                Las UMA aplican del 1º de febrero al 31 de enero del siguiente año conforme a la publicación oficial del INEGI.
              </p>
            </div>
            <div className="rounded-lg border border-primary/30 bg-white/50 p-3 text-sm">
              <p className="font-semibold text-primary">Código preliminar de aviso</p>
              <p>{periodCode || "Completa la selección del mes"}</p>
              <p className="text-xs text-muted-foreground">
                La nomenclatura utiliza el formato AAAAMM, ej. {periodCode || "202509"}.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Umbral de identificación</CardTitle>
            <CardDescription>{identificationThreshold?.descripcion}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-lg font-semibold text-primary">{describeThreshold(identificationCalculation)}</p>
            {identificationThreshold?.uma !== "todas" && selectedMonth?.period && (
              <p className="text-sm text-muted-foreground">
                Valor UMA diario: {formatCurrency(selectedMonth.period.daily)} · Mensual: {formatCurrency(selectedMonth.period.monthly)} · Anual: {formatCurrency(selectedMonth.period.annual)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Umbral de aviso</CardTitle>
            <CardDescription>{avisoThreshold?.descripcion}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-lg font-semibold text-destructive">{describeThreshold(avisoCalculation)}</p>
            {avisoThreshold?.uma && avisoThreshold.uma !== "todas" && selectedMonth?.period && (
              <p className="text-sm text-muted-foreground">
                Supera este valor para activar la obligación de aviso.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas inmediatas</CardTitle>
            <CardDescription>Seguimiento de umbrales por operación y acumulado.</CardDescription>
          </CardHeader>
          <CardContent>{renderAlertas()}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Configuración de la actividad vulnerable</CardTitle>
            <CardDescription>
              Define la fracción aplicable, subactividad específica y periodo para habilitar la captura de operaciones.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => setOperations([])} className="gap-2">
            <Plus className="h-4 w-4" />
            Añadir actividad vulnerable
          </Button>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          <div className="space-y-3">
            <Label>Fracción de la LFPIORPI</Label>
            <Select
              value={selectedFraction}
              onValueChange={(value) => {
                setSelectedFraction(value)
                const first = getActivityByFraction(value)?.actividades[0]
                if (first) {
                  setSelectedSubActivityKey(first.key)
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona fracción" />
              </SelectTrigger>
              <SelectContent>
                {vulnerableActivities.map((activity) => (
                  <SelectItem key={activity.fraccion} value={activity.fraccion}>
                    {activity.fraccion} · {activity.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{fraction?.referenciaLegal}</p>
          </div>

          <div className="space-y-3">
            <Label>Actividad específica</Label>
            <Select
              value={selectedSubActivityKey}
              onValueChange={(value) => setSelectedSubActivityKey(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona la actividad" />
              </SelectTrigger>
              <SelectContent>
                {fraction?.actividades.map((activity) => (
                  <SelectItem key={activity.key} value={activity.key}>
                    {activity.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" /> Código SAT: {subActivity?.satCode}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Periodo (Mes y año)</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              <Select value={String(selectedYear)} onValueChange={(value) => setSelectedYear(Number(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedMonthKey} onValueChange={(value) => setSelectedMonthKey(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  {monthsForYear.map((month) => (
                    <SelectItem key={month.key} value={month.key}>
                      {month.label}
                      {!month.published && " · UMA pendiente"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!selectedMonth?.published && (
              <p className="text-xs text-destructive">
                La UMA de este periodo no ha sido publicada por el SAT. Las operaciones no generarán cálculo automático.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="operaciones" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="operaciones">Operaciones</TabsTrigger>
          <TabsTrigger value="clientes">Clientes y checklist</TabsTrigger>
          <TabsTrigger value="obligaciones">Obligaciones y avisos</TabsTrigger>
          <TabsTrigger value="uma">Histórico UMA</TabsTrigger>
        </TabsList>

        <TabsContent value="operaciones" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Captura de operaciones</CardTitle>
              <CardDescription>
                Registra cada acto u operación y adjunta la evidencia para validar si supera los umbrales en UMA.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2">
                  <Label>Nombre o razón social del cliente</Label>
                  <Input
                    value={operationForm.clienteNombre}
                    onChange={(event) => handleFormChange("clienteNombre", event.target.value)}
                    placeholder="Ingresa el nombre completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>RFC del cliente</Label>
                  <Input
                    value={operationForm.clienteRfc}
                    onChange={(event) => handleFormChange("clienteRfc", event.target.value.toUpperCase())}
                    placeholder="RFC"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de cliente</Label>
                  <Select
                    value={operationForm.tipoCliente}
                    onValueChange={(value) => {
                      handleFormChange("tipoCliente", value as ClientTypeId)
                      setSelectedClientChecklist(value as ClientTypeId)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientChecklists.map((client) => (
                        <SelectItem key={client.tipo} value={client.tipo}>
                          {client.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    ¿Pertenece al mismo grupo empresarial?
                    <Button
                      size="icon"
                      variant="ghost"
                      type="button"
                      className="h-6 w-6"
                      onClick={() =>
                        toast({
                          title: "Grupo empresarial",
                          description: infoMessages.grupoEmpresarial,
                        })
                      }
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </Label>
                  <Select
                    value={operationForm.esMismoGrupo ? "si" : "no"}
                    onValueChange={(value) => handleFormChange("esMismoGrupo", value === "si")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="si">Sí</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {operationForm.esMismoGrupo && (
                  <div className="space-y-2">
                    <Label>Nombre del grupo empresarial</Label>
                    <Input
                      value={operationForm.grupoEmpresarial}
                      onChange={(event) => handleFormChange("grupoEmpresarial", event.target.value)}
                      placeholder="Ej. Grupo Sanborns"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Tipo de operación</Label>
                  <Input
                    value={operationForm.tipoOperacion}
                    onChange={(event) => handleFormChange("tipoOperacion", event.target.value)}
                    placeholder="Venta de boletos, entrega de premio, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de la operación</Label>
                  <Input
                    type="date"
                    value={operationForm.fecha}
                    onChange={(event) => handleFormChange("fecha", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Moneda</Label>
                  <Select
                    value={operationForm.moneda}
                    onValueChange={(value) => handleFormChange("moneda", value as OperationEntry["moneda"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MXN">MXN</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {operationForm.moneda !== "MXN" && (
                  <div className="space-y-2">
                    <Label>Tipo de cambio aplicado</Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={operationForm.tipoCambio}
                      onChange={(event) => handleFormChange("tipoCambio", Number(event.target.value))}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Monto de la operación ({operationForm.moneda})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={operationForm.montoMoneda}
                    onChange={(event) => handleFormChange("montoMoneda", Number(event.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Evidencia o folio</Label>
                  <Input
                    value={operationForm.evidencia}
                    onChange={(event) => handleFormChange("evidencia", event.target.value)}
                    placeholder="Número de contrato, CFDI, folio interno"
                  />
                </div>
                <div className="space-y-2 md:col-span-2 xl:col-span-3">
                  <Label>Comentarios y observaciones</Label>
                  <Textarea
                    value={operationForm.comentarios}
                    onChange={(event) => handleFormChange("comentarios", event.target.value)}
                    placeholder="Detalla origen de recursos, destino y cualquier indicio relevante para UIF."
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {selectedMonth?.period && (
                    <span>
                      Conversión estimada: {formatCurrency(operationForm.montoMoneda * (operationForm.tipoCambio || 1))} MXN ·{" "}
                      {selectedMonth.period.daily
                        ? ((operationForm.montoMoneda * (operationForm.tipoCambio || 1)) / selectedMonth.period.daily).toFixed(2)
                        : "0.00"}{" "}UMA
                    </span>
                  )}
                </div>
                <Button onClick={handleAddOperation} className="gap-2">
                  <Upload className="h-4 w-4" /> Registrar operación
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Operaciones registradas</CardTitle>
              <CardDescription>Visualiza el semáforo por operación y descarga evidencias cuando sea necesario.</CardDescription>
            </CardHeader>
            <CardContent>
              {operations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay operaciones cargadas. Utiliza el formulario anterior para registrar actos u operaciones del periodo.
                </p>
              ) : (
                <ScrollArea className="max-h-[420px]">
                  <div className="space-y-3">
                    {operations.map((operation) => (
                      <motion.div
                        key={operation.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col gap-2 rounded-lg border p-4 text-sm shadow-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold">{operation.clienteNombre}</p>
                            <p className="text-xs text-muted-foreground">RFC: {operation.clienteRfc}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                operation.excedeAviso
                                  ? "bg-destructive/10 text-destructive"
                                  : operation.excedeIdentificacion
                                    ? "bg-amber-500/10 text-amber-700"
                                    : "bg-emerald-500/10 text-emerald-700"
                              }`}
                            >
                              {operation.excedeAviso
                                ? "Aviso obligatorio"
                                : operation.excedeIdentificacion
                                  ? "Umbral de identificación"
                                  : "Sin obligación"}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveOperation(operation.id)}
                              className="h-8 w-8"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <p className="font-medium">Tipo de operación</p>
                            <p>{operation.tipoOperacion}</p>
                          </div>
                          <div>
                            <p className="font-medium">Fecha</p>
                            <p>{operation.fecha}</p>
                          </div>
                          <div>
                            <p className="font-medium">Monto</p>
                            <p>
                              {formatCurrency(operation.montoMx)} MXN · {(operation.montoUma ?? 0).toFixed(2)} UMA
                            </p>
                          </div>
                          <div>
                            <p className="font-medium">Evidencia</p>
                            <p>{operation.evidencia || "Sin folio"}</p>
                          </div>
                        </div>
                        {operation.comentarios && (
                          <p className="text-xs text-muted-foreground">Comentarios: {operation.comentarios}</p>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clientes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Checklist de identificación y conocimiento del cliente</CardTitle>
              <CardDescription>
                Marca los datos y documentos integrados en el expediente conforme al tipo de cliente seleccionado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-2">
                {clientChecklists.map((client) => (
                  <Button
                    key={client.tipo}
                    variant={selectedClientChecklist === client.tipo ? "default" : "outline"}
                    onClick={() => setSelectedClientChecklist(client.tipo)}
                  >
                    {client.nombre}
                  </Button>
                ))}
              </div>
              {selectedChecklist ? (
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Documentos requeridos</h3>
                    {renderChecklist("Documentación soporte", selectedChecklist.documentos, selectedChecklist.tipo)}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold">Datos obligatorios</h3>
                    {renderChecklist("Datos críticos", selectedChecklist.datos, selectedChecklist.tipo)}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Selecciona un tipo de cliente para visualizar la guía.</p>
              )}
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-semibold text-primary">Nivel de cumplimiento del checklist</p>
                <p>{checklistCompletions || 0}% de los requisitos marcados.</p>
                <p className="text-xs text-muted-foreground">
                  Mantén evidencia digitalizada y conservada al menos por 5 años posteriores a la última operación.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Clasificación por umbrales y semáforo</CardTitle>
              <CardDescription>
                Divide automáticamente a los clientes en función de sus operaciones y acumulados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="space-y-2 rounded-xl border p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Sin obligación
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Clientes que no superan el umbral de identificación en operaciones individuales ni acumuladas.
                  </p>
                  <ul className="space-y-2 text-xs">
                    {sinUmbral.map((summary) => (
                      <li key={summary.rfc} className="rounded-lg bg-emerald-50 p-2">
                        <p className="font-medium">{summary.nombre}</p>
                        <p>RFC: {summary.rfc}</p>
                        <p>Total UMA: {summary.totalUma.toFixed(2)}</p>
                      </li>
                    ))}
                    {sinUmbral.length === 0 && <li>No hay clientes en esta categoría.</li>}
                  </ul>
                </div>
                <div className="space-y-2 rounded-xl border p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                    <Shield className="h-4 w-4" /> Identificación reforzada
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Clientes que superan el umbral de identificación y requieren expediente completo y monitoreo de acumulación
                    a 6 meses.
                  </p>
                  <ul className="space-y-2 text-xs">
                    {identificacion.map((summary) => (
                      <li key={summary.rfc} className="rounded-lg bg-amber-50 p-2">
                        <p className="font-medium">{summary.nombre}</p>
                        <p>RFC: {summary.rfc}</p>
                        <p>Acumulado 6 meses: {summary.acumuladoSeisMesesUma.toFixed(2)} UMA</p>
                      </li>
                    ))}
                    {identificacion.length === 0 && <li>No hay clientes en seguimiento especial.</li>}
                  </ul>
                </div>
                <div className="space-y-2 rounded-xl border p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                    <AlertCircle className="h-4 w-4" /> Aviso obligatorio
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Clientes que superaron el umbral de aviso por importe individual o acumulado. Presenta aviso y reinicia el
                    conteo.
                  </p>
                  <ul className="space-y-2 text-xs">
                    {aviso.map((summary) => (
                      <li key={summary.rfc} className="rounded-lg bg-destructive/10 p-2">
                        <p className="font-medium">{summary.nombre}</p>
                        <p>RFC: {summary.rfc}</p>
                        <p>UMA acumuladas: {summary.acumuladoSeisMesesUma.toFixed(2)}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => descargarXml(summary)}>
                            Descargar XML
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              toast({
                                title: "Seguimiento reiniciado",
                                description:
                                  "Registra la presentación del aviso en tus controles internos para reiniciar la acumulación.",
                              })
                            }
                          >
                            Registrar aviso presentado
                          </Button>
                        </div>
                      </li>
                    ))}
                    {aviso.length === 0 && <li>No hay clientes con obligación de aviso.</li>}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="obligaciones" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Obligaciones aplicables</CardTitle>
              <CardDescription>
                Determina las obligaciones regulatorias según el umbral alcanzado y documenta la evidencia correspondiente.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-xl border bg-emerald-50/40 p-4 text-sm">
                <h3 className="text-base font-semibold text-emerald-700">Sin obligación</h3>
                <ul className="mt-2 space-y-2">
                  <li>Continuar monitoreo mensual.</li>
                  <li>Registrar operación en controles internos.</li>
                  <li>Conservar evidencia mínima (comprobante de pago, contrato).</li>
                </ul>
              </div>
              <div className="rounded-xl border bg-amber-50 p-4 text-sm">
                <h3 className="text-base font-semibold text-amber-700">Identificación</h3>
                <ul className="mt-2 space-y-2">
                  {subActivity?.obligacionesCumplidas.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                  <li>Acumular operaciones durante 6 meses solo si superan el umbral de identificación.</li>
                </ul>
              </div>
              <div className="rounded-xl border bg-destructive/10 p-4 text-sm">
                <h3 className="text-base font-semibold text-destructive">Aviso</h3>
                <ul className="mt-2 space-y-2">
                  {subActivity?.obligacionesAviso.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                  <li>Al presentar el aviso se reinicia la acumulación del cliente.</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Avisos e informes</CardTitle>
              <CardDescription>
                Genera el aviso preliminar con los datos del sujeto obligado o el informe 27 BIS en ceros cuando aplique.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Aviso preliminar</p>
                      <p className="text-xs text-muted-foreground">RFC, periodo y clave de actividad vulnerable.</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {periodCode || "AAAAmm"}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    <p>Clave SAT: {subActivity?.satCode ?? "Selecciona actividad"}</p>
                    <p>Periodo: {periodCode || "Sin definir"}</p>
                    <p>Clientes con aviso: {aviso.length}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {aviso.map((summary) => (
                      <Button key={summary.rfc} size="sm" onClick={() => descargarXml(summary)}>
                        XML {summary.rfc}
                      </Button>
                    ))}
                    {aviso.length === 0 && <p className="text-xs text-muted-foreground">No hay avisos generados.</p>}
                  </div>
                </div>
                <div className="rounded-lg border p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Informe 27 BIS en ceros</p>
                      <p className="text-xs text-muted-foreground">Utiliza cuando seas sujeto obligado sin operaciones reportables.</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toast({ title: "Informe 27 BIS", description: infoMessages.avisoCero })}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    className="mt-3"
                    value={observacionesGenerales}
                    onChange={(event) => setObservacionesGenerales(event.target.value)}
                    placeholder="Observaciones a incluir en el informe en ceros"
                  />
                  <Button className="mt-3" variant="outline" onClick={generarInformeEnBlanco}>
                    Generar XML en blanco
                  </Button>
                </div>
              </div>

              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle>Criterios de la UIF aplicables</CardTitle>
                  <CardDescription>
                    Considera estos lineamientos al evaluar operaciones inusuales y definir alertas.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="grid gap-2 text-sm sm:grid-cols-2">
                    {subActivity?.criteriosUif.map((criterio) => (
                      <li key={criterio} className="rounded-lg bg-muted/40 p-3">
                        {criterio}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="uma" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>UMA publicadas por año</CardTitle>
              <CardDescription>Valores oficiales publicados por INEGI/SAT desde 2020.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {UMA_PERIODS.map((period) => (
                <div key={period.periodLabel} className="rounded-lg border bg-muted/30 p-4 text-sm">
                  <p className="text-xs text-muted-foreground">Vigencia {period.start} al {period.end}</p>
                  <p className="text-lg font-semibold">{period.periodLabel}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    <li>Diaria: {formatCurrency(period.daily)}</li>
                    <li>Mensual: {formatCurrency(period.monthly)}</li>
                    <li>Anual: {formatCurrency(period.annual)}</li>
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico mensual (60 meses)</CardTitle>
              <CardDescription>
                Selecciona un mes para confirmar la UMA disponible o identificar periodos pendientes de publicación.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <div className="grid gap-2 md:grid-cols-2">
                  {monthOptions.map((month) => (
                    <div
                      key={month.key}
                      className={`flex items-center justify-between rounded-lg border p-3 text-sm ${
                        month.published ? "bg-background" : "bg-muted/40"
                      }`}
                    >
                      <div>
                        <p className="font-medium">{month.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {month.period
                            ? `UMA diaria ${formatCurrency(month.period.daily)} · Mensual ${formatCurrency(
                                month.period.monthly,
                              )}`
                            : "Publicación pendiente"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          month.published ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"
                        }`}
                      >
                        {month.published ? "Disponible" : "Pendiente"}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Guía de datos para registro SAT y responsables de cumplimiento</CardTitle>
          <CardDescription>
            Checklist de información institucional obligatoria para mantener la autorización ante el SAT y la UIF.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-sm">
            <p className="font-semibold">Datos del sujeto obligado</p>
            <ul className="space-y-1">
              <li>RFC del sujeto obligado y denominación social.</li>
              <li>Domicilio fiscal y sucursales registradas.</li>
              <li>Reglas internas de prevención de lavado de dinero aprobadas por el órgano de gobierno.</li>
              <li>Datos del representante legal y del oficial de cumplimiento.</li>
            </ul>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-semibold">Responsables y controles</p>
            <ul className="space-y-1">
              <li>Alta en el portal PLD SAT y asignación de usuarios certificados.</li>
              <li>Bitácora de avisos y reportes 27 BIS con acuses XML.</li>
              <li>Plan anual de capacitación y evaluaciones a colaboradores.</li>
              <li>Registro de alertas, reportes de operaciones inusuales y documentación soporte.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
