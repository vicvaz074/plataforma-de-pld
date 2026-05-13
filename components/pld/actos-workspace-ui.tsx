"use client"

import { AlertCircle, CheckCircle2, ExternalLink, FileSpreadsheet } from "lucide-react"

import { InfoHint } from "@/components/pld/info-hint"
import { Badge } from "@/components/ui/badge"
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
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b bg-slate-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Progreso operativo</p>
      </div>
      <div className="divide-y">
        {steps.map((step, index) => {
          const status = diagnostics[index]?.status ?? "missing"
          const active = currentStep === index
          const disabled = !onSelectStep
          return (
            <button
              key={step.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectStep?.(index)}
              className={cn(
                "flex w-full items-start gap-3 px-4 py-3 text-left transition",
                active ? "bg-emerald-50" : "bg-white hover:bg-slate-50",
                disabled && "cursor-default hover:bg-white",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  getStepDotClass(status, active),
                )}
              >
                {status === "complete" ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <span className="font-medium text-slate-900">{step.titulo}</span>
                  <Badge variant="outline" className={cn("shrink-0 text-[10px]", getStepBadgeClass(status))}>
                    {getStepLabel(status)}
                  </Badge>
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">{step.descripcion}</span>
                {diagnostics[index]?.reasons[0] && (
                  <span className="mt-1 block truncate text-[11px] text-amber-700">
                    Falta: {diagnostics[index].reasons[0].label}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
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
  return (
    <aside className="space-y-3 lg:sticky lg:top-6">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumen de captura</p>
        </div>
        <div className="space-y-4 p-4 text-sm">
          <SummaryRow label="Cliente" value={clienteNombre || "Sin seleccionar"} detail={rfc || "RFC pendiente"} />
          <SummaryRow
            label="Actividad"
            value={actividadFraccion || "Sin fracción"}
            detail={actividadNombre || "Selecciona actividad"}
          />
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Salida SAT</p>
              <InfoHint content={salidaInfo} />
            </div>
            <p className="mt-1 font-semibold text-slate-900">{salidaLabel}</p>
            <p className="mt-1 text-xs text-slate-600">{fechaLimiteLabel}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-lg border bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Evidencia</p>
                <InfoHint content={evidenciaInfo} />
              </div>
              <p className="mt-1 font-semibold text-slate-900">{evidenciaLabel}</p>
              <p className="text-xs text-slate-500">{missingCriticalCount} crítico(s) pendientes</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                XLSM SAT
              </div>
              <p className="mt-1 font-semibold text-slate-900">{workbookStatusLabel}</p>
              <p className="text-xs text-slate-500">Misma base para Excel y XML.</p>
            </div>
          </div>
        </div>
      </div>
      <BlockingReasonsCallout view={blockersView} />
    </aside>
  )
}

function SummaryRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
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

function getStepBadgeClass(status: WizardStepStatus) {
  if (status === "complete") return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (status === "review") return "border-sky-200 bg-sky-50 text-sky-700"
  if (status === "blocked") return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-slate-200 bg-white text-slate-500"
}

function getStepDotClass(status: WizardStepStatus, active: boolean) {
  if (status === "complete") return "border-emerald-200 bg-emerald-600 text-white"
  if (status === "review") return "border-sky-200 bg-sky-50 text-sky-700"
  if (status === "blocked") return "border-amber-200 bg-amber-50 text-amber-700"
  if (active) return "border-emerald-200 bg-emerald-50 text-emerald-700"
  return "border-slate-200 bg-white text-slate-500"
}
