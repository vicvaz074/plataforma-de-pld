"use client"

import { useMemo, useState } from "react"
import { useLanguage } from "@/lib/LanguageContext"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, CalendarClock, ClipboardCheck, FileText, ShieldCheck, TrendingUp } from "lucide-react"
import { translations } from "@/lib/translations"

interface RiskFactor {
  id: string
  name: string
  description: string
  weight: number
  score: number
}

const scoreOptions = [
  { value: "1", label: "Bajo (1)" },
  { value: "2", label: "Bajo-Medio (2)" },
  { value: "3", label: "Medio (3)" },
  { value: "4", label: "Medio-Alto (4)" },
  { value: "5", label: "Alto (5)" },
]

const initialRiskFactors: RiskFactor[] = [
  {
    id: "rf-01",
    name: "Perfil del cliente",
    description: "Actividad económica, jurisdicción, estructura accionaria y antecedentes.",
    weight: 30,
    score: 3,
  },
  {
    id: "rf-02",
    name: "Producto o servicio",
    description: "Nivel de exposición, complejidad operativa y tipo de transacción.",
    weight: 25,
    score: 2,
  },
  {
    id: "rf-03",
    name: "Canal de distribución",
    description: "Presencial, digital, intermediarios y controles de autenticación.",
    weight: 20,
    score: 3,
  },
  {
    id: "rf-04",
    name: "Operación y volumen",
    description: "Frecuencia, montos y señales de transacciones inusuales.",
    weight: 15,
    score: 4,
  },
  {
    id: "rf-05",
    name: "Historial de cumplimiento",
    description: "Alertas previas, hallazgos de auditoría y observaciones regulatorias.",
    weight: 10,
    score: 2,
  },
]

const mitigationActions = [
  {
    id: "mt-01",
    title: "Reforzar monitoreo transaccional",
    description: "Activar reglas de alerta para operaciones recurrentes y montos atípicos.",
    owner: "Oficial de Cumplimiento",
    dueDate: "30 Oct 2024",
    status: "En progreso",
  },
  {
    id: "mt-02",
    title: "Actualizar expediente y documentación",
    description: "Revalidar KYC, domicilio fiscal y beneficiario controlador.",
    owner: "Equipo de KYC",
    dueDate: "15 Nov 2024",
    status: "Pendiente",
  },
  {
    id: "mt-03",
    title: "Capacitación focalizada",
    description: "Sesión interna sobre señales de riesgo y tipologías relevantes.",
    owner: "Capital Humano",
    dueDate: "05 Dic 2024",
    status: "Programado",
  },
]

const monitoringUpdates = [
  {
    id: "up-01",
    title: "Revisión trimestral completada",
    description: "Se validaron 12 alertas y se cerraron sin observaciones.",
    date: "20 Sep 2024",
  },
  {
    id: "up-02",
    title: "Auditoría interna",
    description: "Observación menor sobre soporte documental; plan de acción en curso.",
    date: "15 Aug 2024",
  },
  {
    id: "up-03",
    title: "Actualización de matriz",
    description: "Se ajustaron ponderaciones para operaciones digitales.",
    date: "30 Jul 2024",
  },
]

export default function EbrPage() {
  const { language } = useLanguage()
  const t = translations[language]
  const [riskFactors, setRiskFactors] = useState<RiskFactor[]>(initialRiskFactors)

  const totalWeight = useMemo(
    () => riskFactors.reduce((sum, factor) => sum + factor.weight, 0),
    [riskFactors],
  )

  const totalScore = useMemo(
    () => riskFactors.reduce((sum, factor) => sum + factor.weight * factor.score, 0),
    [riskFactors],
  )

  const scorePercent = useMemo(() => {
    const maxScore = totalWeight * 5
    return Math.round((totalScore / maxScore) * 100)
  }, [totalScore, totalWeight])

  const riskLevel = useMemo(() => {
    if (scorePercent < 35) return "Bajo"
    if (scorePercent < 70) return "Medio"
    return "Alto"
  }, [scorePercent])

  const riskBadgeStyles = {
    Bajo: "bg-emerald-100 text-emerald-700",
    Medio: "bg-amber-100 text-amber-700",
    Alto: "bg-rose-100 text-rose-700",
  }

  const updateRiskScore = (id: string, value: string) => {
    setRiskFactors((prev) =>
      prev.map((factor) => (factor.id === id ? { ...factor, score: Number(value) } : factor)),
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">{t.ebrTitle}</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">{t.ebrSubtitle}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Descargar reporte
          </Button>
          <Button>
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Guardar evaluación
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Nivel de riesgo</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              {riskLevel}
              <Badge className={riskBadgeStyles[riskLevel as keyof typeof riskBadgeStyles]}>{scorePercent}%</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Resultado ponderado de la matriz actual.</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avance de evaluación</CardDescription>
            <CardTitle className="text-2xl">{scorePercent}% completado</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={scorePercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">Última actualización: 03 Oct 2024</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Próxima revisión</CardDescription>
            <CardTitle className="text-2xl">15 Dic 2024</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <CalendarClock className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Calendario anual de seguimiento.</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Evidencias activas</CardDescription>
            <CardTitle className="text-2xl">18 documentos</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Soportes cargados y aprobados.</span>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="matriz" className="space-y-6">
        <TabsList className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
          <TabsTrigger value="matriz">Matriz de riesgo</TabsTrigger>
          <TabsTrigger value="mitigacion">Plan de mitigación</TabsTrigger>
          <TabsTrigger value="seguimiento">Seguimiento</TabsTrigger>
        </TabsList>

        <TabsContent value="matriz" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Matriz de evaluación</CardTitle>
              <CardDescription>Actualiza el puntaje de cada factor para recalcular el riesgo global.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {riskFactors.map((factor) => (
                <div
                  key={factor.id}
                  className="rounded-lg border border-border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900">{factor.name}</p>
                    <p className="text-sm text-muted-foreground">{factor.description}</p>
                  </div>
                  <div className="flex flex-col gap-2 md:items-end">
                    <span className="text-xs text-muted-foreground">Peso: {factor.weight}%</span>
                    <Select value={String(factor.score)} onValueChange={(value) => updateRiskScore(factor.id, value)}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        {scoreOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}

              <div className="rounded-lg bg-muted/50 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Puntaje ponderado total</p>
                  <p className="text-2xl font-semibold text-gray-900">{scorePercent}%</p>
                </div>
                <Badge className={riskBadgeStyles[riskLevel as keyof typeof riskBadgeStyles]}>
                  Riesgo {riskLevel}
                </Badge>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">Observaciones clave</p>
                <Textarea
                  placeholder="Documenta hallazgos relevantes, supuestos y fuentes de información."
                  className="min-h-[120px]"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mitigacion" className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            {mitigationActions.map((action) => (
              <Card key={action.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{action.title}</CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Responsable</span>
                    <span className="font-medium text-gray-900">{action.owner}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Fecha límite</span>
                    <span className="font-medium text-gray-900">{action.dueDate}</span>
                  </div>
                  <Badge variant="secondary" className="w-fit">
                    {action.status}
                  </Badge>
                  <Button variant="outline" size="sm" className="w-full">
                    Actualizar estatus
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="seguimiento" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Registro de seguimiento</CardTitle>
              <CardDescription>Histórico de revisiones, auditorías y ajustes a la matriz.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {monitoringUpdates.map((update, index) => (
                  <div key={update.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-3 w-3 rounded-full bg-primary" />
                      {index !== monitoringUpdates.length - 1 && <div className="h-full w-px bg-border" />}
                    </div>
                    <div className="pb-6">
                      <p className="text-sm text-muted-foreground">{update.date}</p>
                      <p className="font-medium text-gray-900">{update.title}</p>
                      <p className="text-sm text-muted-foreground">{update.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-dashed border-border p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Pendiente de revisión anual</p>
                  <p className="text-sm text-muted-foreground">
                    Debe realizarse una validación completa de la metodología y evidencias antes del 15 Dic 2024.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

