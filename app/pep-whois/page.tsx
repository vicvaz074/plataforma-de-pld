"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Database, FileCheck2, History, Search, ShieldAlert, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import pepCargosData from "@/public/data/pep-cargos-mx.json"
import pepOpenSanctionsData from "@/public/data/pep-open-sanctions-mx.json"
import pepPersonasData from "@/public/data/pep-personas-mx.json"
import pepReviewQueueData from "@/public/data/pep-review-queue.json"
import pepSourcesData from "@/public/data/pep-sources-mx.json"
import {
  getPepSearchHistoryItemKey,
  normalizeName,
  PEP_INTERNAL_STORAGE_KEY,
  PEP_SEARCH_HISTORY_CLEAR_ALL,
  PEP_SEARCH_HISTORY_STORAGE_KEY,
  removePepSearchHistoryItem,
  searchPep,
} from "@/lib/pld/pep"
import type {
  PepCargo,
  PepEntity,
  PepInternalRecord,
  PepPersonRecord,
  PepRelacion,
  PepReviewQueueItem,
  PepSearchQuery,
  PepSearchResponse,
  PepSearchResult,
  PepSourceRecord,
  PepWhoIsStatus,
} from "@/lib/pld/types"

type Decision = PepInternalRecord["decision"]

const cargosSnapshot = pepCargosData as unknown as { sourceUrl: string; syncedAt: string; count: number; cargos: PepCargo[] }
const openSanctionsSnapshot = pepOpenSanctionsData as unknown as {
  sourceId: string
  sourceLabel: string
  sourceUrl: string
  syncedAt: string
  count: number
  license?: string
  entities: PepEntity[]
}
const personasSnapshot = pepPersonasData as unknown as {
  syncedAt: string
  count: number
  coverage?: {
    totalCargos: number
    cargosConTitular: number
    cargosSinTitular: number
    cargosVerificadosSinTitular?: number
    cargosPendientesRevision?: number
    personasResueltas: number
  }
  personas: PepPersonRecord[]
}
const sourcesSnapshot = pepSourcesData as unknown as {
  generatedAt: string
  count: number
  sources: PepSourceRecord[]
  health?: { fresh: number; stale: number }
}
const reviewQueueSnapshot = pepReviewQueueData as unknown as {
  generatedAt: string
  count: number
  warnings?: string[]
  reviewQueue: PepReviewQueueItem[]
}

const RELATION_OPTIONS: Array<{ value: PepRelacion; label: string }> = [
  { value: "cliente", label: "Cliente" },
  { value: "beneficiario-controlador", label: "Beneficiario controlador" },
  { value: "representante", label: "Representante" },
  { value: "familiar", label: "Familiar" },
  { value: "socio", label: "Socio" },
  { value: "otro", label: "Otro" },
]

const DECISION_OPTIONS: Array<{ value: Decision; label: string }> = [
  { value: "confirmado_pep", label: "Confirmar PEP" },
  { value: "falso_positivo", label: "Falso positivo" },
  { value: "relacionado_pep", label: "Relacionado con PEP" },
  { value: "requiere_revision", label: "Requiere revisión" },
]

const STATUS_COPY: Record<PepWhoIsStatus, { label: string; className: string }> = {
  coincidencia_alta: { label: "Coincidencia alta", className: "border-rose-200 bg-rose-50 text-rose-700" },
  posible_coincidencia: { label: "Posible coincidencia", className: "border-amber-200 bg-amber-50 text-amber-800" },
  requiere_revision: { label: "Requiere revisión", className: "border-sky-200 bg-sky-50 text-sky-700" },
  sin_coincidencia: { label: "Sin coincidencia", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
}

const VERDICT_COPY: Record<PepWhoIsStatus, { title: string; message: string; className: string }> = {
  coincidencia_alta: {
    title: "PEP: sí, coincidencia alta",
    message: "La persona aparece en una fuente nominal o base interna cargada. Revisa cargo y fuente antes de cerrar.",
    className: "border-rose-200 bg-rose-50 text-rose-950",
  },
  posible_coincidencia: {
    title: "PEP: posible coincidencia",
    message: "Hay coincidencia parcial. Documenta descarte o confirmación con evidencia.",
    className: "border-amber-200 bg-amber-50 text-amber-950",
  },
  requiere_revision: {
    title: "PEP: requiere revisión",
    message: "La base interna o la información capturada exige revisión humana.",
    className: "border-sky-200 bg-sky-50 text-sky-950",
  },
  sin_coincidencia: {
    title: "PEP: no encontrado en fuentes cargadas",
    message: "No hay coincidencias activas en el snapshot local. Conserva evidencia de la consulta.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-950",
  },
}

const SAMPLE_NAMES = [
  "Marcelo Ebrard Casaubón",
  "Mariana Imaz Sheinbaum",
  "Vicente Fox Quesada",
  "Felipe Calderón Hinojosa",
  "Alberto Mendoza Díaz",
  "Claudia Sheinbaum Pardo",
]

const EMPTY_QUERY: PepSearchQuery = {
  nombre: "",
  cargo: "",
  dependencia: "",
  fechaNacimiento: "",
  pais: "mx",
  relacion: "cliente",
}

export default function PepWhoIsPage() {
  const [query, setQuery] = useState<PepSearchQuery>(EMPTY_QUERY)
  const [response, setResponse] = useState<PepSearchResponse | null>(null)
  const [internalRecords, setInternalRecords] = useState<PepInternalRecord[]>([])
  const [history, setHistory] = useState<PepSearchResponse[]>([])
  const [selectedResultId, setSelectedResultId] = useState("")
  const [decision, setDecision] = useState<Decision>("requiere_revision")
  const [decisionEvidence, setDecisionEvidence] = useState("")
  const [relatedPepName, setRelatedPepName] = useState("")
  const [nextReviewAt, setNextReviewAt] = useState("")
  const [manualName, setManualName] = useState("")
  const [manualEvidence, setManualEvidence] = useState("")
  const [manualDecision, setManualDecision] = useState<Decision>("confirmado_pep")
  const [manualRelation, setManualRelation] = useState<PepRelacion>("cliente")
  const [manualRelatedPep, setManualRelatedPep] = useState("")

  useEffect(() => {
    setInternalRecords(readInternalRecords())
    setHistory(readSearchHistory())
  }, [])

  const selectedResult = useMemo(() => {
    if (!response?.results.length) return null
    return response.results.find((result) => result.entity.id === selectedResultId) ?? response.results[0]
  }, [response, selectedResultId])

  const evidenceReady = decisionEvidence.trim().length >= 15
  const manualReady = manualName.trim().length >= 5 && manualEvidence.trim().length >= 15

  function updateQuery<K extends keyof PepSearchQuery>(key: K, value: PepSearchQuery[K]) {
    setQuery((prev) => ({ ...prev, [key]: value }))
  }

  function runSearch() {
    const next = searchPep(
      normalizeQuery(query),
      {
        personRecords: personasSnapshot.personas,
        cargos: cargosSnapshot.cargos,
        internalRecords,
        snapshots: [
          {
            sourceId: "pep-personas-mx",
            sourceLabel: "PEP México titulares resueltos local-first",
            sourceUrl: "local://public/data/pep-personas-mx.json",
            syncedAt: personasSnapshot.syncedAt,
            count: personasSnapshot.count,
            entities: personasSnapshot.personas,
          },
          {
            sourceId: "opensanctions",
            sourceLabel: openSanctionsSnapshot.sourceLabel,
            sourceUrl: openSanctionsSnapshot.sourceUrl,
            syncedAt: openSanctionsSnapshot.syncedAt,
            count: openSanctionsSnapshot.count,
            license: openSanctionsSnapshot.license,
            entities: openSanctionsSnapshot.entities,
          },
        ],
      },
      new Date().toISOString(),
    )
    setResponse(next)
    setSelectedResultId(next.results[0]?.entity.id ?? "")
    const nextHistory = [next, ...history].slice(0, 20)
    setHistory(nextHistory)
    persistSearchHistory(nextHistory)
  }

  function saveDecision() {
    const subjectName = selectedResult?.entity.name || query.nombre?.trim()
    if (!subjectName || !evidenceReady) return

    const record: PepInternalRecord = {
      id: makeId("pep-review"),
      schemaVersion: 1,
      subjectName,
      normalizedSubjectName: normalizeName(subjectName),
      decision,
      sourceEntityId: selectedResult?.source === "internal" ? selectedResult.reviewDecision?.sourceEntityId : selectedResult?.entity.id,
      relation: query.relacion ?? "cliente",
      relatedPepName: decision === "relacionado_pep" ? relatedPepName.trim() || selectedResult?.entity.name : undefined,
      evidence: decisionEvidence.trim(),
      decidedBy: getCurrentUser(),
      decidedAt: new Date().toISOString(),
      nextReviewAt: nextReviewAt || undefined,
    }

    persistInternalRecords([record, ...internalRecords])
    setInternalRecords((prev) => [record, ...prev])
    setDecisionEvidence("")
    setRelatedPepName("")
    setNextReviewAt("")
  }

  function saveManualRecord() {
    if (!manualReady) return
    const record: PepInternalRecord = {
      id: makeId("pep-internal"),
      schemaVersion: 1,
      subjectName: manualName.trim(),
      normalizedSubjectName: normalizeName(manualName),
      decision: manualDecision,
      relation: manualRelation,
      relatedPepName: manualDecision === "relacionado_pep" ? manualRelatedPep.trim() || undefined : undefined,
      evidence: manualEvidence.trim(),
      decidedBy: getCurrentUser(),
      decidedAt: new Date().toISOString(),
      nextReviewAt: undefined,
    }
    persistInternalRecords([record, ...internalRecords])
    setInternalRecords((prev) => [record, ...prev])
    setManualName("")
    setManualEvidence("")
    setManualRelatedPep("")
  }

  function deleteRecord(id: string) {
    const next = internalRecords.filter((record) => record.id !== id)
    persistInternalRecords(next)
    setInternalRecords(next)
  }

  function deleteHistoryItem(item: PepSearchResponse) {
    const next = removePepSearchHistoryItem(history, getPepSearchHistoryItemKey(item))
    persistSearchHistory(next)
    setHistory(next)
  }

  function clearHistory() {
    const next = removePepSearchHistoryItem(history, PEP_SEARCH_HISTORY_CLEAR_ALL)
    persistSearchHistory(next)
    setHistory(next)
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <section className="flex flex-col gap-4 border-b pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 text-orange-700">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-normal">WhoIs PEP</h1>
              <p className="text-sm text-muted-foreground">Escribe un nombre y la plataforma revisará PEP nominales, posibles familiares/asociados y fuentes locales cargadas.</p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <SourcePill label="Titulares resueltos" value={`${personasSnapshot.count} personas`} />
          <SourcePill label="SHCP/UIF cargos" value={`${cargosSnapshot.count} cargos`} />
          <SourcePill label="Pendientes" value={`${reviewQueueSnapshot.count} revisiones`} tone={reviewQueueSnapshot.count ? "warning" : "ok"} />
          <SourcePill label="Base interna" value={`${internalRecords.length} decisiones`} tone={internalRecords.length ? "info" : "neutral"} />
        </div>
      </section>

      <Tabs defaultValue="buscar" className="space-y-5">
        <TabsList className="grid h-auto w-full grid-cols-3 lg:w-[560px]">
          <TabsTrigger value="buscar" className="gap-2">
            <Search className="h-4 w-4" /> Buscar
          </TabsTrigger>
          <TabsTrigger value="base-interna" className="gap-2">
            <Database className="h-4 w-4" /> Base interna
          </TabsTrigger>
          <TabsTrigger value="historial" className="gap-2">
            <History className="h-4 w-4" /> Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="buscar" className="space-y-5">
          <DataHealthPanel />
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Buscar persona</CardTitle>
              <CardDescription>La búsqueda ignora acentos y compara nombre, alias, apellidos poco comunes y decisiones internas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
                <Input
                  className="h-12 text-base"
                  value={query.nombre ?? ""}
                  onChange={(event) => updateQuery("nombre", event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") runSearch()
                  }}
                  placeholder="Ej. Alberto Mendoza Diaz"
                />
                <Button className="h-12 w-full max-w-none bg-[#F7941D] text-white hover:bg-[#D97808]" onClick={runSearch}>
                  Buscar PEP
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_NAMES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setQuery((prev) => ({ ...prev, nombre: name }))
                    }}
                    className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-slate-50"
                  >
                    {name}
                  </button>
                ))}
              </div>
              <details className="rounded-lg border bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-medium">Opciones avanzadas</summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Fecha de nacimiento</Label>
                    <Input type="date" value={query.fechaNacimiento ?? ""} onChange={(event) => updateQuery("fechaNacimiento", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Relación</Label>
                    <Select value={query.relacion ?? "cliente"} onValueChange={(value) => updateQuery("relacion", value as PepRelacion)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cargo público</Label>
                    <Input value={query.cargo ?? ""} onChange={(event) => updateQuery("cargo", event.target.value)} placeholder="Ej. Director General" />
                  </div>
                  <div className="space-y-2">
                    <Label>Dependencia o entidad</Label>
                    <Input
                      value={query.dependencia ?? ""}
                      onChange={(event) => updateQuery("dependencia", event.target.value)}
                      placeholder="Ej. Secretaría de Infraestructura, Comunicaciones y Transportes"
                    />
                  </div>
                </div>
              </details>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">Resultado</CardTitle>
                    <CardDescription>La decisión final permanece a cargo del Oficial de Cumplimiento.</CardDescription>
                  </div>
                  {response ? <StatusBadge status={response.status} /> : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {response ? (
                  <>
                    <VerdictCard response={response} />
                    {response.results.length > 0 ? (
                      <div className="space-y-3">
                        {response.results.map((result) => (
                          <ResultCard
                            key={result.entity.id}
                            result={result}
                            active={selectedResult?.entity.id === result.entity.id}
                            onSelect={() => setSelectedResultId(result.entity.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <EmptyState text="Sin coincidencias activas en las fuentes cargadas." />
                    )}
                    {response.appliedDecisions.length > 0 ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                        <p className="font-medium">Decisiones internas aplicadas</p>
                        {response.appliedDecisions.map((item) => (
                          <p key={item.id} className="mt-1 text-xs">
                            {decisionLabel(item.decision)}: {item.evidence}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <EmptyState text="Ejecuta una consulta para ver coincidencias y recomendaciones." />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Decisión humana</CardTitle>
                <CardDescription>La evidencia queda en la base interna local y se aplicará en futuras consultas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Decisión</Label>
                    <Select value={decision} onValueChange={(value) => setDecision(value as Decision)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DECISION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Próxima revisión</Label>
                    <Input type="date" value={nextReviewAt} onChange={(event) => setNextReviewAt(event.target.value)} />
                  </div>
                </div>
                {decision === "relacionado_pep" ? (
                  <div className="space-y-2">
                    <Label>PEP relacionado</Label>
                    <Input value={relatedPepName} onChange={(event) => setRelatedPepName(event.target.value)} placeholder="Nombre de la PEP relacionada" />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label>Evidencia / criterio</Label>
                  <Textarea value={decisionEvidence} onChange={(event) => setDecisionEvidence(event.target.value)} placeholder="Fuente, documento o criterio de descarte/confirmación" />
                </div>
                <Button className="w-full max-w-none bg-[#F7941D] text-white hover:bg-[#D97808]" disabled={(!selectedResult && !query.nombre?.trim()) || !evidenceReady} onClick={saveDecision}>
                  Guardar decisión
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="base-interna" className="grid gap-5 lg:grid-cols-[420px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Alta manual</CardTitle>
              <CardDescription>Registro local migrable a Postgres en la siguiente fase.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={manualName} onChange={(event) => setManualName(event.target.value)} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Decisión</Label>
                  <Select value={manualDecision} onValueChange={(value) => setManualDecision(value as Decision)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DECISION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Relación</Label>
                  <Select value={manualRelation} onValueChange={(value) => setManualRelation(value as PepRelacion)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {manualDecision === "relacionado_pep" ? (
                <div className="space-y-2">
                  <Label>PEP relacionado</Label>
                  <Input value={manualRelatedPep} onChange={(event) => setManualRelatedPep(event.target.value)} />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Evidencia</Label>
                <Textarea value={manualEvidence} onChange={(event) => setManualEvidence(event.target.value)} />
              </div>
              <Button className="w-full max-w-none bg-[#F7941D] text-white hover:bg-[#D97808]" disabled={!manualReady} onClick={saveManualRecord}>
                Guardar en base interna
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Decisiones internas</CardTitle>
              <CardDescription>{internalRecords.length} registros locales con trazabilidad.</CardDescription>
            </CardHeader>
            <CardContent>
              {internalRecords.length > 0 ? (
                <div className="grid gap-3">
                  {internalRecords.map((record) => (
                    <div key={record.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{record.subjectName}</p>
                          <p className="text-xs text-muted-foreground">
                            {decisionLabel(record.decision)} · {relationLabel(record.relation)} · {new Date(record.decidedAt).toLocaleDateString("es-MX")}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => deleteRecord(record.id)}>
                          Eliminar
                        </Button>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{record.evidence}</p>
                      {record.relatedPepName ? <p className="mt-2 text-xs">Relacionado con: {record.relatedPepName}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="No hay decisiones internas guardadas." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">Historial de consultas</CardTitle>
                  <CardDescription>Últimas consultas guardadas en este navegador.</CardDescription>
                </div>
                {history.length > 0 ? (
                  <Button variant="outline" size="sm" onClick={clearHistory} className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Borrar todo
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {history.length > 0 ? (
                <div className="grid gap-3">
                  {history.map((item) => (
                    <div key={getPepSearchHistoryItemKey(item)} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.query.nombre || item.query.cargo || "Consulta PEP"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(item.checkedAt).toLocaleString("es-MX")}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={item.status} />
                          <Button variant="ghost" size="sm" onClick={() => deleteHistoryItem(item)} className="gap-2 text-muted-foreground">
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{item.recommendation}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="Aún no hay consultas registradas." />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function VerdictCard({ response }: { response: PepSearchResponse }) {
  const copy = VERDICT_COPY[response.status]
  const top = response.results[0]
  const firstPosition = top?.entity.positions?.[0]

  return (
    <div className={`rounded-lg border p-5 ${copy.className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold">{copy.title}</p>
          <p className="mt-1 text-sm opacity-85">{copy.message}</p>
        </div>
        <StatusBadge status={response.status} />
      </div>
      {top ? (
        <div className="mt-4 rounded-lg bg-white/70 p-4">
          <p className="text-sm uppercase text-muted-foreground">Persona encontrada</p>
          <p className="mt-1 text-xl font-semibold">{top.entity.name}</p>
          {firstPosition ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Cargo</p>
                <p className="font-medium">{firstPosition.cargo}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Dependencia</p>
                <p className="font-medium">{firstPosition.dependencia ?? "No especificada"}</p>
              </div>
            </div>
          ) : null}
          <p className="mt-3 text-xs text-muted-foreground">
            Fuente: {top.entity.sourceLabel} · Score {top.score}/100 · Consulta {new Date(response.checkedAt).toLocaleString("es-MX")}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs opacity-80">Consulta {new Date(response.checkedAt).toLocaleString("es-MX")}</p>
      )}
      <p className="mt-4 text-sm font-medium">{response.recommendation}</p>
    </div>
  )
}

function DataHealthPanel() {
  const coverage = personasSnapshot.coverage
  const staleSources = sourcesSnapshot.sources.filter((source) => source.status === "stale" || source.status === "error")
  const resolvedPct = coverage?.totalCargos ? Math.round((coverage.cargosConTitular / coverage.totalCargos) * 1000) / 10 : 0
  const topPending = reviewQueueSnapshot.reviewQueue.slice(0, 3)

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Database className="h-5 w-5" /> Salud de datos PEP
          </CardTitle>
          <CardDescription>Snapshot local-first generado por scripts. No realiza consultas externas desde el navegador.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Cargos mapeados" value={`${coverage?.totalCargos ?? cargosSnapshot.count}`} />
          <Metric label="Con titular" value={`${coverage?.cargosConTitular ?? 0} (${resolvedPct}%)`} />
          <Metric label="Verificados sin titular" value={`${coverage?.cargosVerificadosSinTitular ?? 0}`} tone="info" />
          <Metric label="Pendientes" value={`${coverage?.cargosPendientesRevision ?? reviewQueueSnapshot.count}`} tone={reviewQueueSnapshot.count ? "danger" : "ok"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5" /> Revisión y límites
          </CardTitle>
          <CardDescription>Los cargos sin titular nominal quedan justificados sin fingir coincidencia por nombre.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {topPending.length > 0 ? (
            topPending.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{item.label}</p>
                  <Badge variant="outline">{item.priority}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.recommendation}</p>
              </div>
            ))
          ) : (
            <EmptyState text="Sin revisiones pendientes en el snapshot actual." />
          )}
          <p className="text-xs text-muted-foreground">
            Actualizado: {new Date(personasSnapshot.syncedAt).toLocaleString("es-MX")} · Pendientes totales: {reviewQueueSnapshot.count}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function ResultCard({ result, active, onSelect }: { result: PepSearchResult; active: boolean; onSelect: () => void }) {
  const firstPosition = result.entity.positions?.[0]

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-4 text-left transition-colors ${active ? "border-orange-300 bg-orange-50/70" : "hover:bg-slate-50"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{result.entity.name}</p>
          <p className="text-xs text-muted-foreground">
            {firstPosition?.cargo ? `${firstPosition.cargo} · ` : ""}
            {result.entity.sourceLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{result.score}/100</Badge>
          <StatusBadge status={result.status} />
        </div>
      </div>
      {result.entity.positions?.length ? (
        <div className="mt-3 grid gap-2">
          {result.entity.positions.slice(0, 2).map((position) => (
            <div key={`${position.cargo}-${position.dependencia ?? ""}`} className="rounded border bg-white p-2 text-xs">
              <p className="font-medium">{position.cargo}</p>
              {position.dependencia ? <p className="text-muted-foreground">{position.dependencia}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {result.matchedFields.map((field) => (
          <Badge key={field} variant="secondary">
            {field}
          </Badge>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{result.note}</p>
    </button>
  )
}

function StatusBadge({ status }: { status: PepWhoIsStatus }) {
  const item = STATUS_COPY[status]
  return (
    <Badge variant="outline" className={item.className}>
      {item.label}
    </Badge>
  )
}

function SourcePill({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "info" | "ok" | "warning" }) {
  const toneClass =
    tone === "info"
      ? "border-sky-200 bg-sky-50"
      : tone === "ok"
        ? "border-emerald-200 bg-emerald-50"
        : tone === "warning"
          ? "border-amber-200 bg-amber-50"
          : "bg-white"
  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  )
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "ok" | "danger" | "info" }) {
  const className =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-950"
      : tone === "danger"
        ? "border-rose-200 bg-rose-50 text-rose-950"
        : tone === "info"
          ? "border-sky-200 bg-sky-50 text-sky-950"
          : "border-slate-200 bg-white"

  return (
    <div className={`rounded-lg border p-3 ${className}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-[150px] flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      <FileCheck2 className="mb-3 h-8 w-8 text-slate-400" />
      {text}
    </div>
  )
}

function normalizeQuery(query: PepSearchQuery): PepSearchQuery {
  return {
    nombre: query.nombre?.trim() || undefined,
    cargo: query.cargo?.trim() || undefined,
    dependencia: query.dependencia?.trim() || undefined,
    fechaNacimiento: query.fechaNacimiento || undefined,
    pais: query.pais?.trim() || undefined,
    relacion: query.relacion ?? "cliente",
  }
}

function readInternalRecords(): PepInternalRecord[] {
  if (typeof window === "undefined") return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PEP_INTERNAL_STORAGE_KEY) || "[]")
    return Array.isArray(parsed) ? parsed.filter(isPepInternalRecord) : []
  } catch {
    return []
  }
}

function persistInternalRecords(records: PepInternalRecord[]) {
  window.localStorage.setItem(PEP_INTERNAL_STORAGE_KEY, JSON.stringify(records))
}

function readSearchHistory(): PepSearchResponse[] {
  if (typeof window === "undefined") return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PEP_SEARCH_HISTORY_STORAGE_KEY) || "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistSearchHistory(history: PepSearchResponse[]) {
  if (history.length === 0) {
    window.localStorage.removeItem(PEP_SEARCH_HISTORY_STORAGE_KEY)
    return
  }
  window.localStorage.setItem(PEP_SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(history))
}

function isPepInternalRecord(value: unknown): value is PepInternalRecord {
  const record = value as Partial<PepInternalRecord>
  return Boolean(record?.schemaVersion === 1 && record.subjectName && record.decision && record.evidence)
}

function getCurrentUser(): string {
  if (typeof window === "undefined") return "usuario-local"
  return window.localStorage.getItem("userEmail") || window.localStorage.getItem("userName") || "usuario-local"
}

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function decisionLabel(decision: Decision): string {
  return DECISION_OPTIONS.find((option) => option.value === decision)?.label ?? decision
}

function relationLabel(relation: PepRelacion): string {
  return RELATION_OPTIONS.find((option) => option.value === relation)?.label ?? relation
}
