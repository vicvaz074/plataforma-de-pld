"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  ExternalLink,
  FileText,
  GitBranch,
  ListFilter,
  Search,
  ShieldCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLanguage } from "@/lib/LanguageContext"
import {
  filterNormativeDocuments,
  filterNormativeObligations,
  groupObligationsByModule,
  LEGAL_AUTHORITIES,
  LEGAL_SECTORS,
  LEGAL_SOURCE_REVIEWED_AT,
  LEGAL_STATUSES,
  normativeDocuments,
  normativeObligations,
  normativeUpdates,
  type NormativeAuthority,
  type NormativeSector,
  type NormativeStatus,
  type OperationalStatus,
} from "@/lib/pld/legal-framework"
import { translations } from "@/lib/translations"

const statusLabel: Record<NormativeStatus, string> = {
  vigente: "Vigente",
  reformado: "Reformado",
  pendiente_rcg: "Pendiente RCG",
  criterio_sat: "Criterio SAT",
  referencia_sectorial: "Referencia sectorial",
  internacional: "Internacional",
}

const statusTone: Record<NormativeStatus, string> = {
  vigente: "border-emerald-200 bg-emerald-50 text-emerald-700",
  reformado: "border-orange-200 bg-orange-50 text-orange-700",
  pendiente_rcg: "border-amber-200 bg-amber-50 text-amber-800",
  criterio_sat: "border-sky-200 bg-sky-50 text-sky-700",
  referencia_sectorial: "border-slate-200 bg-slate-50 text-slate-700",
  internacional: "border-violet-200 bg-violet-50 text-violet-700",
}

const operationalLabel: Record<OperationalStatus, string> = {
  vigente: "Activo",
  parcial: "En integracion",
  pendiente_rcg: "Pendiente RCG",
  referencia: "Referencia",
}

const operationalTone: Record<OperationalStatus, string> = {
  vigente: "border-emerald-200 bg-emerald-50 text-emerald-700",
  parcial: "border-orange-200 bg-orange-50 text-orange-700",
  pendiente_rcg: "border-amber-200 bg-amber-50 text-amber-800",
  referencia: "border-slate-200 bg-slate-50 text-slate-700",
}

const sectorTone: Record<NormativeSector, string> = {
  "Actividades Vulnerables": "bg-orange-50 text-orange-700",
  "Sistema financiero": "bg-sky-50 text-sky-700",
  "Legislacion secundaria": "bg-slate-100 text-slate-700",
  Internacional: "bg-violet-50 text-violet-700",
}

export default function MarcoNormativoAplicablePage() {
  const { language } = useLanguage()
  const t = translations[language]
  const [query, setQuery] = useState("")
  const [sector, setSector] = useState<NormativeSector | "todos">("todos")
  const [authority, setAuthority] = useState<NormativeAuthority | "todos">("todos")
  const [status, setStatus] = useState<NormativeStatus | "todos">("todos")
  const [obligationQuery, setObligationQuery] = useState("")

  const filteredDocuments = useMemo(
    () =>
      filterNormativeDocuments(normativeDocuments, {
        query,
        sector,
        authority,
        status,
      }),
    [authority, query, sector, status],
  )

  const filteredObligations = useMemo(
    () => filterNormativeObligations(normativeObligations, obligationQuery),
    [obligationQuery],
  )

  const obligationsByModule = useMemo(
    () => Object.entries(groupObligationsByModule(filteredObligations)),
    [filteredObligations],
  )

  const documentIndex = useMemo(
    () => new Map(normativeDocuments.map((document) => [document.id, document])),
    [],
  )

  const resetFilters = () => {
    setQuery("")
    setSector("todos")
    setAuthority("todos")
    setStatus("todos")
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <header className="border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Marco legal PLD Mexico</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal sm:text-3xl">{t.compiladoLeyes}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Biblioteca normativa y mapa operativo para Actividades Vulnerables, sistema financiero y referencias internacionales PLD/FT.
            </p>
          </div>
          <div className="min-w-0 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Ultima revision normativa</p>
            <p className="mt-1 text-lg font-semibold text-slate-950">{LEGAL_SOURCE_REVIEWED_AT}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Fuentes oficiales SAT, SPPLD, DOF, UIF, CNBV, CNSF, CONSAR y GAFI/ONU.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 border-y border-slate-200 py-4 sm:grid-cols-3">
          <Metric icon={BookOpen} label="Documentos" value={normativeDocuments.length} />
          <Metric icon={GitBranch} label="Obligaciones mapeadas" value={normativeObligations.length} />
          <Metric icon={CalendarDays} label="Reformas y criterios" value={normativeUpdates.length} />
        </div>
      </header>

      <section className="border-b border-slate-200 py-5">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <CalendarDays className="h-4 w-4 text-orange-600" />
          Linea de tiempo 2025-2026
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-5">
          {normativeUpdates.map((update) => (
            <article key={update.id} className="min-w-0 border-l-2 border-orange-200 pl-3">
              <p className="text-xs font-semibold text-orange-700">{update.date}</p>
              <h2 className="mt-1 break-words text-sm font-semibold leading-5 text-slate-950">{update.title}</h2>
              <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-600">{update.impact}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <StatusBadge status={update.status} />
                <Link href={update.sourceUrl} target="_blank" className="shrink-0 text-xs font-medium text-orange-700 hover:text-orange-800">
                  Fuente
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <Tabs defaultValue="biblioteca" className="mt-6">
        <TabsList className="grid h-auto w-full grid-cols-2 bg-slate-100 p-1 lg:w-[520px]">
          <TabsTrigger value="biblioteca" className="gap-2 data-[state=active]:bg-white">
            <BookOpen className="h-4 w-4" />
            Biblioteca normativa
          </TabsTrigger>
          <TabsTrigger value="mapa" className="gap-2 data-[state=active]:bg-white">
            <GitBranch className="h-4 w-4" />
            Mapa operativo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="biblioteca" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
            <aside className="h-fit border-b border-slate-200 pb-4 lg:border-b-0 lg:border-r lg:pr-5">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <ListFilter className="h-4 w-4 text-orange-600" />
                Filtros
              </div>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Buscar</label>
                  <div className="flex items-center gap-2 rounded-md border bg-white px-3">
                    <Search className="h-4 w-4 shrink-0 text-slate-400" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="PEP, 27 Bis, CNBV..."
                      className="h-10 border-0 px-0 shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>

                <FilterGroup
                  label="Sector"
                  options={["todos", ...LEGAL_SECTORS]}
                  value={sector}
                  onChange={(value) => setSector(value as NormativeSector | "todos")}
                />
                <FilterGroup
                  label="Autoridad"
                  options={["todos", ...LEGAL_AUTHORITIES]}
                  value={authority}
                  onChange={(value) => setAuthority(value as NormativeAuthority | "todos")}
                />
                <FilterGroup
                  label="Estado"
                  options={["todos", ...LEGAL_STATUSES]}
                  value={status}
                  getLabel={(value) => (value === "todos" ? "Todos" : statusLabel[value as NormativeStatus])}
                  onChange={(value) => setStatus(value as NormativeStatus | "todos")}
                />

                <Button type="button" variant="outline" className="w-full justify-center bg-white" onClick={resetFilters}>
                  Limpiar filtros
                </Button>
              </div>
            </aside>

            <section className="min-w-0">
              <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-normal">Biblioteca normativa</h2>
                  <p className="text-sm text-slate-500">{filteredDocuments.length} documento(s) encontrados de {normativeDocuments.length}.</p>
                </div>
                <p className="text-xs text-slate-500">Enlaces oficiales; sin llamadas runtime externas.</p>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="hidden grid-cols-[1.3fr_160px_150px_130px] gap-4 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
                  <span>Documento</span>
                  <span>Autoridad</span>
                  <span>Sector</span>
                  <span>Estado</span>
                </div>
                {filteredDocuments.length > 0 ? (
                  filteredDocuments.map((document) => <DocumentRow key={document.id} document={document} />)
                ) : (
                  <div className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-950">Sin coincidencias</p>
                    <p className="mt-1 text-sm text-slate-500">Prueba con otra palabra o limpia los filtros.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="mapa" className="mt-6">
          <section className="grid gap-6 lg:grid-cols-[300px_1fr]">
            <aside className="h-fit border-b border-slate-200 pb-4 lg:border-b-0 lg:border-r lg:pr-5">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <ShieldCheck className="h-4 w-4 text-orange-600" />
                Lectura operativa
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Cada obligacion conecta un fundamento con el modulo donde se trabaja. No cambia reglas ejecutables; solo hace visible el mapa normativo.
              </p>
              <div className="mt-4 space-y-2">
                {(["vigente", "parcial", "pendiente_rcg", "referencia"] as OperationalStatus[]).map((item) => (
                  <div key={item} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-600">{operationalLabel[item]}</span>
                    <OperationalBadge status={item} />
                  </div>
                ))}
              </div>
            </aside>

            <div className="min-w-0">
              <div className="flex flex-col gap-3 pb-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-normal">Mapa operativo de cumplimiento</h2>
                  <p className="text-sm text-slate-500">Alta SAT, EUI, Actos, EBR, Evidencias, Avisos, Capacitacion, Auditoria y Gobernanza.</p>
                </div>
                <div className="flex w-full items-center gap-2 rounded-md border bg-white px-3 lg:w-80">
                  <Search className="h-4 w-4 shrink-0 text-slate-400" />
                  <Input
                    value={obligationQuery}
                    onChange={(event) => setObligationQuery(event.target.value)}
                    placeholder="Buscar obligacion o modulo"
                    className="h-10 border-0 px-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                {obligationsByModule.length > 0 ? (
                  obligationsByModule.map(([module, obligations]) => (
                    <section key={module} className="border-t border-slate-200 first:border-t-0">
                      <div className="flex flex-col gap-1 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="font-semibold text-slate-950">{module}</h3>
                        <span className="text-xs text-slate-500">{obligations.length} obligacion(es)</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {obligations.map((obligation) => (
                          <article key={obligation.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_220px]">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <OperationalBadge status={obligation.status} />
                                {obligation.tags.slice(0, 3).map((tag) => (
                                  <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                              <p className="mt-2 break-words text-sm font-medium leading-6 text-slate-950">{obligation.obligation}</p>
                              <p className="mt-1 break-words text-xs leading-5 text-slate-500">{obligation.foundation}</p>
                              <p className="mt-2 break-words text-sm leading-6 text-slate-600">{obligation.impact}</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {obligation.sourceDocumentIds.map((id) => {
                                  const source = documentIndex.get(id)
                                  if (!source) return null
                                  return (
                                    <Link
                                      key={id}
                                      href={source.url}
                                      target="_blank"
                                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-orange-200 hover:text-orange-700"
                                    >
                                      <FileText className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{source.title}</span>
                                    </Link>
                                  )
                                })}
                              </div>
                            </div>
                            <div className="flex items-start lg:justify-end">
                              <Button asChild variant="outline" className="w-full justify-between bg-white text-orange-700 hover:text-orange-800 lg:w-48">
                                <Link href={obligation.moduleHref}>
                                  Abrir modulo
                                  <ArrowRight className="h-4 w-4" />
                                </Link>
                              </Button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))
                ) : (
                  <div className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-950">Sin obligaciones encontradas</p>
                    <p className="mt-1 text-sm text-slate-500">Prueba con otra palabra clave.</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </main>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: number }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold text-slate-950">{value}</p>
        <p className="truncate text-xs text-slate-500">{label}</p>
      </div>
    </div>
  )
}

function FilterGroup({
  label,
  options,
  value,
  getLabel = (item) => (item === "todos" ? "Todos" : item),
  onChange,
}: {
  label: string
  options: string[]
  value: string
  getLabel?: (value: string) => string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-2 lg:block lg:space-y-2">
        {options.map((option) => {
          const active = value === option
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={`w-auto rounded-full border px-3 py-1.5 text-left text-xs transition lg:w-full lg:rounded-md ${
                active
                  ? "border-orange-300 bg-orange-50 font-medium text-orange-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-700"
              }`}
            >
              <span className="line-clamp-2">{getLabel(option)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DocumentRow({ document }: { document: (typeof normativeDocuments)[number] }) {
  return (
    <details className="group border-t border-slate-200 first:border-t-0">
      <summary className="grid cursor-pointer gap-3 px-4 py-4 transition hover:bg-slate-50 lg:grid-cols-[1.3fr_160px_150px_130px] lg:items-center">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold leading-6 text-slate-950">{document.title}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{document.operationalImpact}</p>
        </div>
        <span className="text-sm text-slate-600">{document.authority}</span>
        <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${sectorTone[document.sector]}`}>{document.sector}</span>
        <StatusBadge status={document.status} />
      </summary>
      <div className="grid gap-4 border-t border-slate-100 bg-slate-50/60 px-4 py-4 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0">
          <p className="break-words text-sm leading-6 text-slate-700">{document.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">Tipo: {document.hierarchy}</span>
            {document.lastReform ? <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">Reforma: {document.lastReform}</span> : null}
            <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600">Revision: {document.reviewedAt}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {document.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="min-w-0 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Modulos relacionados</p>
            <p className="mt-1 break-words text-sm leading-6 text-slate-700">{document.relatedModules.join(", ")}</p>
          </div>
          <Button asChild className="w-full justify-between bg-[#F7941D] text-white hover:bg-[#D97808]">
            <Link href={document.url} target="_blank">
              Abrir fuente oficial
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </details>
  )
}

function StatusBadge({ status }: { status: NormativeStatus }) {
  return (
    <Badge variant="outline" className={`w-fit ${statusTone[status]}`}>
      {statusLabel[status]}
    </Badge>
  )
}

function OperationalBadge({ status }: { status: OperationalStatus }) {
  return (
    <Badge variant="outline" className={`w-fit ${operationalTone[status]}`}>
      {operationalLabel[status]}
    </Badge>
  )
}
