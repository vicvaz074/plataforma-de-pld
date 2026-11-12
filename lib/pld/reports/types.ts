export interface ReportMetric { label: string; value: string; note?: string }
export interface ReportBar {
  label: string
  value: number | null
  max?: number
  valueLabel?: string
  tone?: "primary" | "accent" | "muted" | "success"
}
export interface ReportTableColumn { label: string; width?: number; align?: "left" | "right" }
export interface ReportSection {
  title: string
  paragraphs?: string[]
  bars?: ReportBar[]
  table?: { columns: ReportTableColumn[]; rows: Array<Array<string | number | null>>; emptyMessage?: string }
  note?: string
}
export interface ProfessionalReport {
  title: string
  subtitle?: string
  scopeLabel?: string
  period?: string
  summary: string[]
  metrics?: ReportMetric[]
  sections: ReportSection[]
  sources?: string[]
  disclaimers?: string[]
  filename: string
}
export interface ProfessionalReportContext {
  company: { name: string; rfc: string }
  generatedBy: string
  generatedAt: string | Date
}
