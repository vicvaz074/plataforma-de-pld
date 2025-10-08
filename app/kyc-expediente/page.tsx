"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { AlertCircle, Building, CheckCircle2, Info, Map, Shield, UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import {
  clientChecklists,
  type ClientChecklist,
  type ClientChecklistItem,
  type ClientTypeId,
} from "@/lib/clientes"

const riskLevels = {
  bajo: { label: "Bajo", color: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  medio: { label: "Medio", color: "bg-amber-500/10 text-amber-700 border-amber-200" },
  alto: { label: "Alto", color: "bg-destructive/10 text-destructive border-destructive/40" },
}

type RiskLevel = keyof typeof riskLevels

type RiskFactorKey =
  | "actividad"
  | "montoFrecuencia"
  | "geografia"
  | "divisa"
  | "origenRecursos"
  | "naturalezaOperacion"
  | "comportamiento"
  | "pep"

interface RiskFactor {
  key: RiskFactorKey
  label: string
  description: string
  recommendations: string
}

const riskFactors: RiskFactor[] = [
  {
    key: "actividad",
    label: "Actividad del cliente",
    description: "Evaluar la naturaleza del negocio y la exposición inherente al lavado de dinero.",
    recommendations: "Documentar giros económicos, licencias y relación con actividades vulnerables.",
  },
  {
    key: "montoFrecuencia",
    label: "Monto y frecuencia de operaciones",
    description: "Identificar patrones de operación vs. perfil declarado (ingresos, frecuencia, límites).",
    recommendations: "Establecer límites transaccionales y alertas por comportamiento atípico.",
  },
  {
    key: "geografia",
    label: "Zona geográfica",
    description: "Considerar zonas de riesgo, fronteras, puertos, corredores logísticos o zonas de alta incidencia.",
    recommendations: "Verificar presencia en listas de la UIF y reportes de riesgo geográfico.",
  },
  {
    key: "divisa",
    label: "Tipo de divisa",
    description: "Uso de monedas distintas al MXN, operaciones en USD/EUR u otras divisas digitales.",
    recommendations: "Aplicar controles adicionales cuando existan conversiones frecuentes o uso de activos virtuales.",
  },
  {
    key: "origenRecursos",
    label: "Origen y destino de los recursos",
    description: "Identificar la fuente lícita de fondos y el destino final de las operaciones.",
    recommendations: "Solicitar documentación soporte y validar contra estados financieros o declaraciones fiscales.",
  },
  {
    key: "naturalezaOperacion",
    label: "Naturaleza de las operaciones",
    description: "Clasificar el tipo de operación (contado, transferencias, fideicomisos, efectivo).",
    recommendations: "Documentar contratos, justificantes y cadenas de valor.",
  },
  {
    key: "comportamiento",
    label: "Comportamiento inusual",
    description: "Registrar operaciones fuera del perfil, alertas internas, consultas UIF o incidencias previas.",
    recommendations: "Implementar monitoreo continuo y escalamiento al oficial de cumplimiento.",
  },
  {
    key: "pep",
    label: "Personas políticamente expuestas",
    description: "Determinar si el cliente o beneficiarios finales son PEP nacionales o extranjeros.",
    recommendations: "Aplicar debida diligencia reforzada, aprobar por alta dirección y monitorear transacciones.",
  },
]

interface ClientRiskProfile {
  id: string
  nombre: string
  tipoCliente: ClientTypeId
  identificacionCompleta: boolean
  documentosValidados: number
  datosValidados: number
  riesgoIdentificacion: RiskLevel
  riesgoConocimiento: RiskLevel
  factores: Record<RiskFactorKey, RiskLevel>
  observaciones: string
  alertas: string[]
  pepDeclarado: boolean
}

const defaultFactorState: Record<RiskFactorKey, RiskLevel> = {
  actividad: "bajo",
  montoFrecuencia: "bajo",
  geografia: "bajo",
  divisa: "bajo",
  origenRecursos: "bajo",
  naturalezaOperacion: "bajo",
  comportamiento: "bajo",
  pep: "bajo",
}

const randomId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2))

export default function KycExpedientePage() {
  const { toast } = useToast()
  const [clientName, setClientName] = useState("")
  const [clientType, setClientType] = useState<ClientTypeId>("persona-fisica-nacional")
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
  const [factorState, setFactorState] = useState<Record<RiskFactorKey, RiskLevel>>(defaultFactorState)
  const [observacionesIdentificacion, setObservacionesIdentificacion] = useState("")
  const [observacionesConocimiento, setObservacionesConocimiento] = useState("")
  const [clientes, setClientes] = useState<ClientRiskProfile[]>([])
  const [alertas, setAlertas] = useState<string[]>([])

  const selectedChecklist: ClientChecklist | undefined = useMemo(
    () => clientChecklists.find((item) => item.tipo === clientType),
    [clientType],
  )

  const checklistProgress = useMemo(() => {
    if (!selectedChecklist) return { docs: 0, datos: 0, completado: 0 }
    const status = checklistStatus[clientType] ?? {}
    const totalDocs = selectedChecklist.documentos.length
    const totalDatos = selectedChecklist.datos.length
    const docsCumplidos = selectedChecklist.documentos.filter((item) => status[item.id]).length
    const datosCumplidos = selectedChecklist.datos.filter((item) => status[item.id]).length
    const total = totalDocs + totalDatos
    const completado = total === 0 ? 0 : Math.round(((docsCumplidos + datosCumplidos) / total) * 100)
    return { docs: docsCumplidos / Math.max(totalDocs || 1, 1), datos: datosCumplidos / Math.max(totalDatos || 1, 1), completado }
  }, [clientType, checklistStatus, selectedChecklist])

  const overallRiskConocimiento: RiskLevel = useMemo(() => {
    if (Object.values(factorState).some((value) => value === "alto")) return "alto"
    if (Object.values(factorState).some((value) => value === "medio")) return "medio"
    return "bajo"
  }, [factorState])

  const identificationRisk: RiskLevel = useMemo(() => {
    if (checklistProgress.completado === 100) return "bajo"
    if (checklistProgress.completado >= 60) return "medio"
    return "alto"
  }, [checklistProgress])

  const pepDeclarado = factorState.pep !== "bajo"

  const updateChecklist = (id: string, value: boolean) => {
    setChecklistStatus((prev) => ({
      ...prev,
      [clientType]: {
        ...(prev[clientType] ?? {}),
        [id]: value,
      },
    }))
  }

  const updateRiskFactor = (key: RiskFactorKey, value: RiskLevel) => {
    setFactorState((prev) => ({ ...prev, [key]: value }))
  }

  const renderChecklistGroup = (title: string, items: ClientChecklistItem[]) => (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-muted-foreground">{title}</h4>
      <div className="space-y-2">
        {items.map((item) => (
          <label key={item.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
            <Checkbox
              checked={Boolean(checklistStatus[clientType]?.[item.id])}
              onCheckedChange={(checked) => updateChecklist(item.id, Boolean(checked))}
            />
            <span>
              <span className="font-medium">{item.label}</span>
              {item.obligatorio && <Badge className="ml-2" variant="secondary">Obligatorio</Badge>}
              {item.referencia && (
                <span className="block text-xs text-muted-foreground">Referencia: {item.referencia}</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </div>
  )

  const agregarCliente = () => {
    if (!clientName.trim()) {
      toast({ title: "Captura el nombre del cliente", variant: "destructive" })
      return
    }

    const checklist = selectedChecklist
    if (!checklist) {
      toast({ title: "Selecciona el tipo de cliente", variant: "destructive" })
      return
    }

    const documentosValidados = checklist.documentos.filter((item) => checklistStatus[clientType]?.[item.id]).length
    const datosValidados = checklist.datos.filter((item) => checklistStatus[clientType]?.[item.id]).length

    const nuevoPerfil: ClientRiskProfile = {
      id: randomId(),
      nombre: clientName.trim(),
      tipoCliente: clientType,
      identificacionCompleta: checklistProgress.completado === 100,
      documentosValidados,
      datosValidados,
      riesgoIdentificacion: identificationRisk,
      riesgoConocimiento: overallRiskConocimiento,
      factores: factorState,
      observaciones: [observacionesIdentificacion, observacionesConocimiento].filter(Boolean).join(" | "),
      alertas: [],
      pepDeclarado,
    }

    const nuevasAlertas: string[] = []
    if (overallRiskConocimiento === "alto") {
      nuevasAlertas.push(`Riesgo alto detectado en conocimiento del cliente ${nuevoPerfil.nombre}. Ejecutar monitoreo inmediato.`)
    }
    if (identificationRisk !== "bajo") {
      nuevasAlertas.push(
        `Expediente de identificación incompleto para ${nuevoPerfil.nombre}. Completa documentación antes de operar.`,
      )
    }
    if (pepDeclarado) {
      nuevasAlertas.push(`Cliente ${nuevoPerfil.nombre} declarado como PEP. Aplicar debida diligencia reforzada.`)
    }

    nuevoPerfil.alertas = nuevasAlertas
    setClientes((prev) => [nuevoPerfil, ...prev])
    if (nuevasAlertas.length) {
      setAlertas((prev) => Array.from(new Set([...nuevasAlertas, ...prev])))
    }

    toast({ title: "Perfil KYC guardado", description: "Se registró el expediente con la evaluación de riesgo." })

    setClientName("")
    setChecklistStatus((prev) => ({ ...prev, [clientType]: {} }))
    setFactorState(defaultFactorState)
    setObservacionesIdentificacion("")
    setObservacionesConocimiento("")
  }

  const renderRiskFactorSelect = (factor: RiskFactor) => (
    <div key={factor.key} className="space-y-2 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{factor.label}</p>
          <p className="text-xs text-muted-foreground">{factor.description}</p>
        </div>
        <Badge className={riskLevels[factorState[factor.key]].color}>{riskLevels[factorState[factor.key]].label}</Badge>
      </div>
      <Select value={factorState[factor.key]} onValueChange={(value) => updateRiskFactor(factor.key, value as RiskLevel)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(riskLevels) as RiskLevel[]).map((level) => (
            <SelectItem key={level} value={level}>
              {riskLevels[level].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{factor.recommendations}</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardHeader>
          <CardTitle>Expediente KYC</CardTitle>
          <CardDescription>
            Separa identificación y conocimiento del cliente para aplicar la metodología de enfoque basado en riesgo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-primary/30 bg-white/60 p-3 text-sm">
            <p className="font-semibold text-primary">Cliente en evaluación</p>
            <p>{clientName || "Sin capturar"}</p>
            <p className="text-xs text-muted-foreground">Tipo: {selectedChecklist?.nombre ?? "Selecciona"}</p>
          </div>
          <div className="rounded-lg border border-primary/30 bg-white/60 p-3 text-sm">
            <p className="font-semibold text-primary">Riesgo identificación</p>
            <Badge className={riskLevels[identificationRisk].color}>{riskLevels[identificationRisk].label}</Badge>
            <p className="text-xs text-muted-foreground">Documentos completos: {checklistProgress.completado}%</p>
          </div>
          <div className="rounded-lg border border-primary/30 bg-white/60 p-3 text-sm">
            <p className="font-semibold text-primary">Riesgo conocimiento</p>
            <Badge className={riskLevels[overallRiskConocimiento].color}>{riskLevels[overallRiskConocimiento].label}</Badge>
            <p className="text-xs text-muted-foreground">PEP: {pepDeclarado ? "Sí" : "No"}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="identificacion" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="identificacion">Identificación del cliente</TabsTrigger>
          <TabsTrigger value="conocimiento">Conocimiento del cliente</TabsTrigger>
        </TabsList>

        <TabsContent value="identificacion" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Datos de identificación</CardTitle>
              <CardDescription>
                Captura información básica y documentación soporte para integrar el expediente conforme a la LFPIORPI.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nombre o razón social</Label>
                  <Input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Cliente" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de cliente</Label>
                  <Select value={clientType} onValueChange={(value) => setClientType(value as ClientTypeId)}>
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
              </div>
              {selectedChecklist ? (
                <div className="grid gap-6 lg:grid-cols-2">
                  {renderChecklistGroup("Documentos obligatorios", selectedChecklist.documentos)}
                  {renderChecklistGroup("Datos obligatorios", selectedChecklist.datos)}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Selecciona el tipo de cliente para visualizar la checklist.</p>
              )}
              <div className="space-y-2">
                <Label>Notas de identificación</Label>
                <Textarea
                  value={observacionesIdentificacion}
                  onChange={(event) => setObservacionesIdentificacion(event.target.value)}
                  placeholder="Observaciones sobre documentos, discrepancias o validaciones externas"
                />
              </div>
              <div className="rounded-lg border bg-muted/20 p-4 text-sm">
                <p className="font-semibold">Estado del expediente</p>
                <motion.div
                  layout
                  className={`mt-2 h-2 rounded-full ${
                    identificationRisk === "alto"
                      ? "bg-gradient-to-r from-red-500 via-orange-400 to-yellow-300"
                      : identificationRisk === "medio"
                        ? "bg-gradient-to-r from-yellow-400 via-amber-400 to-emerald-300"
                        : "bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-300"
                  }`}
                  style={{ width: `${Math.max(checklistProgress.completado, 10)}%` }}
                />
                <p className="text-xs text-muted-foreground">
                  Sustituimos las barras tradicionales por gradientes dinámicos para visualizar el avance de forma moderna.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conocimiento" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Factores de riesgo del conocimiento del cliente</CardTitle>
              <CardDescription>
                Evalúa cada factor conforme a la metodología de enfoque basado en riesgo y documenta la justificación.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                {riskFactors.map((factor) => renderRiskFactorSelect(factor))}
              </div>
              <div className="space-y-2">
                <Label>Notas de conocimiento</Label>
                <Textarea
                  value={observacionesConocimiento}
                  onChange={(event) => setObservacionesConocimiento(event.target.value)}
                  placeholder="Justificación de la calificación de riesgo, validaciones adicionales o seguimiento requerido"
                />
              </div>
              <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/20 p-4 text-sm">
                <div>
                  <p className="font-semibold">Nivel de riesgo calculado</p>
                  <Badge className={riskLevels[overallRiskConocimiento].color}>
                    {riskLevels[overallRiskConocimiento].label}
                  </Badge>
                </div>
                <div className="flex flex-col text-xs text-muted-foreground">
                  <span>El nivel más alto asignado a un factor determina el riesgo general.</span>
                  <span>Genera alertas inmediatas cuando el riesgo sea medio o alto.</span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    const mensaje = `Alerta generada para ${clientName || "cliente"}: riesgo ${riskLevels[overallRiskConocimiento].label}`
                    setAlertas((prev) => [mensaje, ...prev])
                    toast({ title: "Alerta en tiempo real", description: mensaje })
                  }}
                >
                  Emitir alerta inmediata
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap gap-3">
        <Button className="gap-2" onClick={agregarCliente}>
          <UserPlus className="h-4 w-4" /> Guardar perfil KYC
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => {
            setFactorState(defaultFactorState)
            setChecklistStatus((prev) => ({ ...prev, [clientType]: {} }))
            setObservacionesIdentificacion("")
            setObservacionesConocimiento("")
            toast({ title: "Formulario reiniciado" })
          }}
        >
          Limpiar formulario
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Mapa de riesgo por cliente</CardTitle>
            <CardDescription>
              Visualiza la distribución de clientes por nivel de riesgo con colores gradientes en tiempo real.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {clientes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no se han registrado expedientes KYC.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {clientes.map((cliente) => (
                  <motion.div
                    key={cliente.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`space-y-2 rounded-xl border p-4 ${riskLevels[cliente.riesgoConocimiento].color}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{cliente.nombre}</p>
                        <p className="text-xs text-muted-foreground">{clientChecklists.find((c) => c.tipo === cliente.tipoCliente)?.nombre}</p>
                      </div>
                      <Badge variant="outline" className={riskLevels[cliente.riesgoIdentificacion].color}>
                        Identificación {riskLevels[cliente.riesgoIdentificacion].label}
                      </Badge>
                    </div>
                    <p className="text-xs">Riesgo conocimiento: {riskLevels[cliente.riesgoConocimiento].label}</p>
                    <p className="text-xs text-muted-foreground">{cliente.observaciones || "Sin observaciones adicionales"}</p>
                    {cliente.alertas.length > 0 && (
                      <ul className="space-y-1 text-xs text-destructive">
                        {cliente.alertas.map((alerta) => (
                          <li key={alerta}>• {alerta}</li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas en tiempo real</CardTitle>
            <CardDescription>Acciones a ejecutar cuando se detectan riesgos elevados.</CardDescription>
          </CardHeader>
          <CardContent>
            {alertas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay alertas activas.</p>
            ) : (
              <ScrollArea className="h-64">
                <ul className="space-y-2 text-sm">
                  {alertas.map((alerta, index) => (
                    <li key={`${alerta}-${index}`} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <span>{alerta}</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Metodología de enfoque basado en riesgo</CardTitle>
          <CardDescription>
            Guía para clasificar clientes en bajo, medio o alto riesgo considerando identificación y conocimiento.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4 text-sm">
            <h4 className="font-semibold text-emerald-700">Riesgo bajo</h4>
            <ul className="mt-2 space-y-1">
              <li>Expediente completo y validado con fuentes oficiales.</li>
              <li>Operaciones congruentes con perfil económico.</li>
              <li>Sin coincidencias en listas restrictivas ni alertas internas.</li>
            </ul>
          </div>
          <div className="rounded-lg border p-4 text-sm">
            <h4 className="font-semibold text-amber-700">Riesgo medio</h4>
            <ul className="mt-2 space-y-1">
              <li>Documentación en proceso de validación.</li>
              <li>Operaciones crecientes o nuevos productos.</li>
              <li>Presencia en zonas geográficas de vigilancia o actividades vulnerables.</li>
            </ul>
          </div>
          <div className="rounded-lg border p-4 text-sm">
            <h4 className="font-semibold text-destructive">Riesgo alto</h4>
            <ul className="mt-2 space-y-1">
              <li>Clientes PEP o beneficiarios finales complejos.</li>
              <li>Uso intensivo de efectivo, activos virtuales o transferencias internacionales.</li>
              <li>Alertas previas, reportes UIF o coincidencias con listas restrictivas.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
