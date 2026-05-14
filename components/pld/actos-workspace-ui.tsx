"use client"

import { AlertCircle, CheckCircle2, ExternalLink, FileSpreadsheet } from "lucide-react"

import { InfoHint } from "@/components/pld/info-hint"
import type {
  BlockingReasonsView,
  InfoHintContent,
  OperationalWizardStepDiagnostics,
  RegulatorySourceChipDefinition,
  WizardStepStatus,
} from "@/lib/pld"
import { cn } from "@/lib/utils"

export interface OperationalProgressStep {
  id: number | string
  titulo: string
  descripcion: string
}

interface RegulatorySourceChipProps {
  chip: RegulatorySourceChipDefinition
}

export function RegulatorySourceChip({ chip }: RegulatorySourceChipProps) {
  const className = cn(
    "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none",
    chip.tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : chip.tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-slate-200 bg-white text-slate-700",
  )

  const content = (
    <>
      <span className="truncate">{chip.label}</span>
      {chip.sourceUrl && <ExternalLink className="h-3 w-3 shrink-0" />}
    </>
  )

  if (!chip.sourceUrl) {
    return (
      <span className={className} title={chip.detail}>
        {content}
      </span>
    )
  }

  return (
    <a className={className} href={chip.sourceUrl} title={chip.detail} target="_blank" rel="noreferrer">
      {content}
    </a>
  )
}

interface BlockingReasonsCalloutProps {
  view: BlockingReasonsView
  className?: string
}

export function BlockingReasonsCallout({ view, className }: BlockingReasonsCalloutProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 text-sm",
        view.hasBlockers ? "border-amber-200 bg-amber-50 text-amber-950" : "border-emerald-200 bg-emerald-50 text-emerald-950",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {view.hasBlockers ? (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{view.title}</p>
          <p className={cn("mt-1 text-xs", view.hasBlockers ? "text-amber-800" : "text-emerald-800")}>
            {view.subtitle}
          </p>
          {view.hasBlockers && (
            <ul className="mt-3 space-y-2">
              {view.items.map((item) => (
                <li key={item.id} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span className="min-w-0 break-words text-xs leading-relaxed">
                    <span className="font-semibold">{item.label}:</span> {item.action}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

interface OperationalProgressRailProps {
  steps: OperationalProgressStep[]
  diagnostics: OperationalWizardStepDiagnostics[]
  currentStep: number
  onSelectStep?: (stepIndex: number) => void
}

export function OperationalProgressRail({ steps, diagnostics, currentStep, onSelectStep }: OperationalProgressRailProps) {
  return (
    <nav className="rounded-2xl bg-slate-50/80 p-2 lg:sticky lg:top-20">
      <div className="px-2 pb-2 pt-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Progreso</p>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
        {steps.map((step, index) => {
          const status = diagnostics[index]?.status ?? "missing"
          const active = currentStep === index
          const disabled = !onSelectStep
          const firstReason = diagnostics[index]?.reasons[0]
          return (
            <button
              key={step.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectStep?.(index)}
              className={cn(
                "group flex min-w-[160px] items-center gap-2 rounded-xl px-2.5 py-2 text-left transition lg:w-full lg:min-w-0",
                active ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-white/80 hover:text-slate-950",
                disabled && "cursor-default hover:bg-transparent",
              )}
              title={`${step.titulo}: ${step.descripcion}${firstReason ? ` · Falta: ${firstReason.label}` : ""}`}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  getStepDotClass(status, active),
                )}
              >
                {status === "complete" ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-xs font-semibold">{step.titulo}</span>
                <span
                  className={cn(
                    "mt-0.5 block truncate text-[10px]",
                    status === "blocked" ? "text-amber-700" : status === "complete" ? "text-emerald-700" : "text-slate-500",
                  )}
                >
                  {firstReason ? firstReason.label : getStepLabel(status)}
                </span>
              </span>
              {active && <span className="hidden h-6 w-0.5 shrink-0 rounded-full bg-emerald-500 lg:block" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

interface SatOutputSummaryPanelProps {
  clienteNombre: string
  rfc: string
  actividadFraccion: string
  actividadNombre: string
  salidaLabel: string
  fechaLimiteLabel: string
  evidenciaLabel: string
  missingCriticalCount: number
  workbookStatusLabel: string
  blockersView: BlockingReasonsView
  salidaInfo: InfoHintContent
  evidenciaInfo: InfoHintContent
}

export function SatOutputSummaryPanel({
  clienteNombre,
  rfc,
  actividadFraccion,
  actividadNombre,
  salidaLabel,
  fechaLimiteLabel,
  evidenciaLabel,
  missingCriticalCount,
  workbookStatusLabel,
  blockersView,
  salidaInfo,
  evidenciaInfo,
}: SatOutputSummaryPanelProps) {
  const blockersPreview = blockersView.items.slice(0, 4)
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
      <div className="grid min-w-0 divide-y divide-slate-100 text-sm lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:divide-x lg:divide-y-0">
        <div className="min-w-0 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Estado de captura</p>
          <p className="mt-1 truncate font-semibold text-slate-950">{clienteNombre || "Sin cliente seleccionado"}</p>
          <p className="truncate text-xs text-slate-500">{rfc || "RFC pendiente"}</p>
        </div>
        <SummaryRow label="Actividad" value={actividadFraccion || "Sin fracción"} detail={actividadNombre || "Selecciona actividad"} />
        <div className="min-w-0 p-4">
          <div className="flex items-center gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Salida SAT</p>
            <InfoHint content={salidaInfo} />
          </div>
          <p className="mt-1 truncate font-semibold text-slate-950">{salidaLabel}</p>
          <p className="truncate text-xs text-slate-500">{fechaLimiteLabel}</p>
        </div>
        <div className="min-w-0 p-4">
          <div className="flex items-center gap-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Evidencia / XLSM</p>
            <InfoHint content={evidenciaInfo} />
          </div>
          <p className="mt-1 truncate font-semibold text-slate-950">
            {evidenciaLabel} · {workbookStatusLabel}
          </p>
          <p className="truncate text-xs text-slate-500">
            <FileSpreadsheet className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
            {missingCriticalCount} crítico(s) pendientes
          </p>
        </div>
      </div>
      {blockersView.hasBlockers ? (
        <div className="flex min-w-0 flex-col gap-2 border-t border-amber-100 bg-amber-50/70 px-4 py-3 text-xs text-amber-900 md:flex-row md:items-center">
          <span className="shrink-0 font-semibold">Qué falta:</span>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {blockersPreview.map((item) => (
              <span key={item.id} className="max-w-full truncate rounded-full bg-white px-2 py-1 text-[11px] ring-1 ring-amber-100">
                {item.label}
              </span>
            ))}
            {blockersView.items.length > blockersPreview.length && (
              <span className="rounded-full bg-white px-2 py-1 text-[11px] ring-1 ring-amber-100">
                +{blockersView.items.length - blockersPreview.length}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="border-t border-emerald-100 bg-emerald-50/70 px-4 py-2 text-xs font-semibold text-emerald-800">
          {blockersView.title}
        </div>
      )}
    </section>
  )
}

function SummaryRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 truncate font-semibold text-slate-900">{value}</p>
      <p className="truncate text-xs text-slate-500">{detail}</p>
    </div>
  )
}

function getStepLabel(status: WizardStepStatus) {
  if (status === "complete") return "Listo"
  if (status === "review") return "Revisar"
  if (status === "blocked") return "Falta"
  return "Pendiente"
}

function getStepDotClass(status: WizardStepStatus, active: boolean) {
  if (status === "complete") return "border-emerald-200 bg-emerald-600 text-white"
  if (status === "review") return "border-sky-200 bg-sky-50 text-sky-700"
  if (status === "blocked") return "border-amber-200 bg-amber-50 text-amber-700"
  if (active) return "border-emerald-200 bg-emerald-50 text-emerald-700"
  return "border-slate-200 bg-white text-slate-500"
}
