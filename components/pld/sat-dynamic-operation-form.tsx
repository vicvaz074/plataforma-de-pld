"use client"

import { useEffect, useMemo, useState } from "react"
import { FileSpreadsheet, ListChecks, PlusCircle } from "lucide-react"

import { InfoHint } from "@/components/pld/info-hint"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { InfoHintContent, SatDynamicOperationForm, SatXlsmField } from "@/lib/pld"

interface SatDynamicOperationFormProps {
  form: SatDynamicOperationForm | null
  values: Record<string, string>
  missingRequired: string[]
  onChange: (fieldId: string, value: string) => void
  infoHintContent?: InfoHintContent
}

const SAT_STEPS: Array<{
  id: NonNullable<SatXlsmField["sectionKind"]>
  title: string
  description: string
}> = [
  {
    id: "alta_sat",
    title: "Alta SAT y periodo",
    description: "Datos generales, referencia, alerta y prioridad del aviso.",
  },
  {
    id: "persona_objeto",
    title: "Persona objeto del aviso",
    description: "Cliente o usuario reportado, representante, domicilio y contacto.",
  },
  {
    id: "beneficiario_controlador",
    title: "Beneficiario controlador",
    description: "Dueño beneficiario o estructura de control conforme al layout SAT.",
  },
  {
    id: "acto_operacion",
    title: "Acto u operación",
    description: "Datos de la operación y bienes objeto del aviso.",
  },
  {
    id: "contraparte",
    title: "Contraparte",
    description: "Persona física, moral o fideicomiso contraparte cuando aplique.",
  },
  {
    id: "instrumento",
    title: "Instrumento o contrato",
    description: "Instrumento público, avalúo o contrato relacionado.",
  },
  {
    id: "liquidacion",
    title: "Liquidación e instrumentos",
    description: "Forma de pago, instrumento monetario, moneda y montos.",
  },
]

const REPEAT_GROUP_LABELS: Record<string, string> = {
  persona_objeto_pf: "Persona física",
  persona_objeto_pm: "Persona moral o fideicomiso",
  persona_objeto_representante: "Representante o apoderado",
  persona_objeto_domicilio_nacional: "Domicilio nacional",
  persona_objeto_domicilio_internacional: "Domicilio internacional",
  persona_objeto_contacto: "Contacto",
  beneficiario_controlador_pf: "Persona física",
  beneficiario_controlador_pm: "Persona moral o fideicomiso",
  contraparte_pf: "Persona física",
  contraparte_pm: "Persona moral o fideicomiso",
  inmuebles: "Inmueble",
  pagos: "Liquidación",
}

export function SatDynamicOperationFormView({
  form,
  values,
  missingRequired,
  onChange,
  infoHintContent,
}: SatDynamicOperationFormProps) {
  const [visibleRows, setVisibleRows] = useState<Record<string, number>>({})
  const [activeStepId, setActiveStepId] = useState<NonNullable<SatXlsmField["sectionKind"]>>("alta_sat")

  const allFields = useMemo(() => {
    if (!form) return []
    const fields = form.sections.flatMap((section) => section.fields)
    return form.templateId.includes("fraccion-v-inmuebles")
      ? fields.filter((field) => field.source === "manual-sat-map")
      : fields
  }, [form])

  const availableSteps = useMemo(
    () => SAT_STEPS.filter((step) => allFields.some((field) => field.sectionKind === step.id)),
    [allFields],
  )

  useEffect(() => {
    if (availableSteps.length && !availableSteps.some((step) => step.id === activeStepId)) {
      setActiveStepId(availableSteps[0].id)
    }
  }, [activeStepId, availableSteps])

  if (!form) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        No hay layout XLSM cacheado para esta actividad. Ejecuta la sincronización SAT antes de generar Excel
        rellenado.
      </div>
    )
  }

  const missingSet = new Set(missingRequired)
  const fieldCount = allFields.length
  const activeStep = availableSteps.find((step) => step.id === activeStepId) ?? availableSteps[0]
  const activeStepFields = activeStep ? allFields.filter((field) => field.sectionKind === activeStep.id) : []
  const plainFields = activeStepFields.filter((field) => !field.repeatGroup)
  const repeatGroupIds = Array.from(
    new Set(activeStepFields.map((field) => field.repeatGroup).filter(Boolean) as string[]),
  )

  const valueFor = (field: SatXlsmField) => values[field.id] ?? form.initialValues[field.id] ?? ""

  const addRepeatRow = (groupId: string, limit: number) => {
    setVisibleRows((prev) => ({ ...prev, [groupId]: Math.min((prev[groupId] || 1) + 1, limit) }))
  }

  return (
    <div className="min-w-0 space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            Cuestionario SAT desde XLSM oficial
            {infoHintContent && <InfoHint content={infoHintContent} />}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Las preguntas, celdas y desplegables vienen de {form.templateFile}. Lo capturado aquí rellena el Excel y el
            XML SAT.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="bg-white">
            {form.sections.length} hoja(s)
          </Badge>
          <Badge variant="outline" className="bg-white">
            {fieldCount} campo(s) SAT
          </Badge>
          <Badge
            variant="outline"
            className={
              missingRequired.length
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }
          >
            {missingRequired.length ? `${missingRequired.length} obligatorio(s) pendiente(s)` : "Excel listo"}
          </Badge>
        </div>
      </div>

      <div className="grid min-w-0 gap-3 lg:grid-cols-[220px,minmax(0,1fr)]">
        <div className="min-w-0 space-y-2">
          {availableSteps.map((step) => {
            const stepFields = allFields.filter((field) => field.sectionKind === step.id)
            const pending = stepFields.filter((field) => missingSet.has(field.id)).length
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStepId(step.id)}
                className={`w-full rounded border p-3 text-left transition ${
                  activeStep?.id === step.id
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-white hover:border-emerald-200"
                }`}
              >
                <div className="flex min-w-0 items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                  <span className="min-w-0 truncate">{step.title}</span>
                  {pending > 0 ? (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] text-amber-700">
                      {pending}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">
                      OK
                    </Badge>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <div className="min-w-0 rounded border bg-white p-4 shadow-sm">
          {activeStep && (
            <>
              <div className="flex items-start gap-2">
                <ListChecks className="mt-0.5 h-4 w-4 text-emerald-700" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">{activeStep.title}</h4>
                  <p className="mt-1 text-xs text-muted-foreground">{activeStep.description}</p>
                </div>
              </div>

              {plainFields.length > 0 && (
                <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {plainFields.map((field) => (
                    <SatFieldControl
                      key={`${field.sheetName}-${field.cell}-${field.id}`}
                      field={field}
                      value={valueFor(field)}
                      isMissing={missingSet.has(field.id)}
                      onChange={onChange}
                    />
                  ))}
                </div>
              )}

              <div className="mt-4 space-y-4">
                {repeatGroupIds.map((groupId) => {
                  const groupFields = activeStepFields.filter((field) => field.repeatGroup === groupId)
                  const rowIndexes = Array.from(
                    new Set(groupFields.map((field) => field.repeatIndex || 1)),
                  ).sort((a, b) => a - b)
                  const maxFilledRow = Math.max(
                    1,
                    ...groupFields
                      .filter((field) => valueFor(field).trim())
                      .map((field) => field.repeatIndex || 1),
                  )
                  const limit = Math.max(...rowIndexes)
                  const visibleCount = Math.min(Math.max(visibleRows[groupId] || 1, maxFilledRow), limit)
                  const visibleIndexes = rowIndexes.filter((index) => index <= visibleCount)

                  return (
                    <div key={groupId} className="rounded border border-slate-200 bg-slate-50/70 p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-xs font-semibold text-slate-700">
                            {REPEAT_GROUP_LABELS[groupId] ?? groupId}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Agrega otra fila solo si el aviso requiere registrar mas de un elemento.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="bg-white"
                          disabled={visibleCount >= limit}
                          onClick={() => addRepeatRow(groupId, limit)}
                        >
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Agregar fila
                        </Button>
                      </div>

                      <div className="mt-3 space-y-3">
                        {visibleIndexes.map((rowIndex) => {
                          const rowFields = groupFields.filter((field) => (field.repeatIndex || 1) === rowIndex)
                          return (
                            <div key={`${groupId}-${rowIndex}`} className="rounded border bg-white p-3">
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-700">
                                  {REPEAT_GROUP_LABELS[groupId] ?? "Fila"} {rowIndex}
                                </span>
                                <Badge variant="outline" className="font-mono text-[10px]">
                                  fila SAT {rowFields[0]?.cell.match(/\d+/)?.[0] ?? rowIndex}
                                </Badge>
                              </div>
                              <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {rowFields.map((field) => (
                                  <SatFieldControl
                                    key={`${field.sheetName}-${field.cell}-${field.id}`}
                                    field={field}
                                    value={valueFor(field)}
                                    isMissing={missingSet.has(field.id)}
                                    onChange={onChange}
                                  />
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SatFieldControl({
  field,
  value,
  isMissing,
  onChange,
}: {
  field: SatXlsmField
  value: string
  isMissing: boolean
  onChange: (fieldId: string, value: string) => void
}) {
  const datalistId = `sat-options-${field.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`
  const options = field.options || []

  return (
    <div
      className={`min-w-0 space-y-1 overflow-hidden rounded border p-3 ${
        isMissing ? "border-amber-200 bg-amber-50/70" : "border-slate-200 bg-white"
      }`}
    >
      <Label className="block min-w-0 break-words text-xs leading-relaxed">
        <span>
          {field.label}
          {field.required ? <span className="text-rose-600"> *</span> : null}
        </span>
      </Label>
      {options.length > 0 && options.length <= 120 ? (
        <Select value={value} onValueChange={(next) => onChange(field.id, next)}>
          <SelectTrigger className="min-w-0 bg-white">
            <SelectValue placeholder="Selecciona opción SAT" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={`${field.id}-${option}`} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : options.length > 0 ? (
        <>
          <Input
            value={value}
            list={datalistId}
            placeholder="Busca o captura opción SAT"
            onChange={(event) => onChange(field.id, event.target.value)}
          />
          <datalist id={datalistId}>
            {options.map((option) => (
              <option key={`${field.id}-${option}`} value={option} />
            ))}
          </datalist>
        </>
      ) : (
        <Input
          value={value}
          inputMode={field.dataType === "numero" || field.dataType === "moneda" ? "decimal" : "text"}
          placeholder={field.dataType === "fecha" ? "dd/mm/aaaa" : field.placeholder ?? "Captura valor"}
          onChange={(event) => onChange(field.id, event.target.value)}
        />
      )}
      <details className="text-[10px] text-muted-foreground">
        <summary className="cursor-pointer">Ver referencia SAT</summary>
        <p className="mt-1">
          {field.sheetName} · celda {field.cell} ·{" "}
          {field.source === "manual-sat-map" ? "mapeo SAT verificado" : "detectado desde XLSM"}
          {field.optionListId ? ` · lista ${field.optionListId}` : ""}
        </p>
      </details>
    </div>
  )
}
