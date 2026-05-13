"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, ChevronsUpDown, FileSpreadsheet, ListChecks, PlusCircle, Search } from "lucide-react"

import { InfoHint } from "@/components/pld/info-hint"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  CODIGOS_POSTALES,
  findCodigoPostalInfoInCatalog,
  findSatAddressOption,
  mergeCodigoPostalCatalog,
  type CodigoPostalInfo,
  type CodigoPostalSnapshot,
} from "@/lib/data/codigos-postales"
import {
  buildSatQuestionnaireDedupedFieldView,
  buildSatQuestionnaireFieldView,
  getActionableSatMissingFieldIds,
  isSatFieldManagedByPrimaryCapture,
  type InfoHintContent,
  type SatDynamicOperationForm,
  type SatXlsmField,
} from "@/lib/pld"

interface SatDynamicOperationFormProps {
  form: SatDynamicOperationForm | null
  values: Record<string, string>
  missingRequired: string[]
  onChange: (fieldId: string, value: string) => void
  editedFieldIds?: string[]
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

const normalizeForSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()

const normalizeFieldLabel = (field: SatXlsmField) => normalizeForSearch(`${field.label} ${field.optionListId ?? ""}`)

const isPostalCodeField = (field: SatXlsmField) => /codigo postal|código postal/.test(normalizeFieldLabel(field))

const isNeighborhoodField = (field: SatXlsmField) => /colonia|asentamiento/.test(normalizeFieldLabel(field))

const isStateField = (field: SatXlsmField) => /estado|entidad federativa/.test(normalizeFieldLabel(field))

const isMunicipalityField = (field: SatXlsmField) => /municipio|alcaldia|alcaldía|delegacion|delegación/.test(normalizeFieldLabel(field))

const isCityField = (field: SatXlsmField) => /ciudad|poblacion|población|localidad/.test(normalizeFieldLabel(field))

const isSameAddressScope = (source: SatXlsmField, candidate: SatXlsmField) => {
  if (source.id === candidate.id) return false
  if (source.sheetName !== candidate.sheetName) return false
  if (source.repeatGroup || candidate.repeatGroup) {
    return source.repeatGroup === candidate.repeatGroup && (source.repeatIndex || 1) === (candidate.repeatIndex || 1)
  }
  return source.sectionKind === candidate.sectionKind
}

export function SatDynamicOperationFormView({
  form,
  values,
  missingRequired,
  onChange,
  editedFieldIds = [],
  infoHintContent,
}: SatDynamicOperationFormProps) {
  const [visibleRows, setVisibleRows] = useState<Record<string, number>>({})
  const [activeStepId, setActiveStepId] = useState<NonNullable<SatXlsmField["sectionKind"]>>("alta_sat")
  const [showResolvedFields, setShowResolvedFields] = useState(false)
  const [showOptionalFields, setShowOptionalFields] = useState(false)
  const [postalCatalog, setPostalCatalog] = useState<CodigoPostalInfo[]>(CODIGOS_POSTALES)

  const allFields = useMemo<SatXlsmField[]>(() => {
    if (!form) return []
    const fields = form.sections.flatMap((section) => section.fields)
    const visibleFields = form.templateId.includes("fraccion-v-inmuebles")
      ? fields.filter((field) => field.source === "manual-sat-map")
      : fields
    return visibleFields.map((field) =>
      field.sectionKind ? field : { ...field, sectionKind: "acto_operacion" },
    )
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

  useEffect(() => {
    let mounted = true
    fetch("/data/sat-postal-catalog-mx.json")
      .then((response) => (response.ok ? response.json() : null))
      .then((snapshot: CodigoPostalSnapshot | null) => {
        if (!mounted || !snapshot?.records?.length) return
        setPostalCatalog(mergeCodigoPostalCatalog(CODIGOS_POSTALES, snapshot.records))
      })
      .catch(() => {
        if (mounted) setPostalCatalog(CODIGOS_POSTALES)
      })
    return () => {
      mounted = false
    }
  }, [])

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
  const actionableMissingRequired = getActionableSatMissingFieldIds({
    fields: allFields,
    missingRequiredIds: missingRequired,
  })
  const activeStep = availableSteps.find((step) => step.id === activeStepId) ?? availableSteps[0]
  const activeStepFields = activeStep ? allFields.filter((field) => field.sectionKind === activeStep.id) : []
  const valueFor = (field: SatXlsmField) => values[field.id] ?? form.initialValues[field.id] ?? ""
  const managedByPrimaryCapture = activeStepFields.filter(isSatFieldManagedByPrimaryCapture)
  const questionnaireFields = activeStepFields.filter((field) => !isSatFieldManagedByPrimaryCapture(field))
  const dedupedQuestionnaire = buildSatQuestionnaireDedupedFieldView({
    fields: questionnaireFields,
    values: Object.fromEntries(questionnaireFields.map((field) => [field.id, valueFor(field)])),
    missingRequiredIds: missingRequired,
  })
  const editedSet = new Set(editedFieldIds)
  const editedQuestionnaireFieldIds = dedupedQuestionnaire.fields
    .filter((field) => {
      const duplicateIds = dedupedQuestionnaire.duplicateFieldIdsByRepresentative[field.id] ?? []
      return editedSet.has(field.id) || duplicateIds.some((duplicateId) => editedSet.has(duplicateId))
    })
    .map((field) => field.id)
  const activeStepFieldView = buildSatQuestionnaireFieldView({
    fields: dedupedQuestionnaire.fields,
    values: dedupedQuestionnaire.values,
    initialValues: form.initialValues,
    missingRequiredIds: dedupedQuestionnaire.missingRequiredIds,
    showResolvedFields,
    showOptionalFields,
    editedFieldIds: editedQuestionnaireFieldIds,
  })
  const visibleFieldIds = new Set(activeStepFieldView.visibleFieldIds)
  const visibleActiveStepFields = dedupedQuestionnaire.fields.filter((field) => visibleFieldIds.has(field.id))
  const plainFields = visibleActiveStepFields.filter((field) => !field.repeatGroup)
  const repeatGroupIds = Array.from(
    new Set(visibleActiveStepFields.map((field) => field.repeatGroup).filter(Boolean) as string[]),
  )
  const valueForQuestionnaire = (field: SatXlsmField) => dedupedQuestionnaire.values[field.id] ?? valueFor(field)
  const updateQuestionnaireField = (fieldId: string, value: string) => {
    onChange(fieldId, value)
    for (const duplicateId of dedupedQuestionnaire.duplicateFieldIdsByRepresentative[fieldId] ?? []) {
      onChange(duplicateId, value)
    }
    const field = activeStepFields.find((item) => item.id === fieldId)
    if (!field || !isPostalCodeField(field)) return
    const postalInfo = findCodigoPostalInfoInCatalog(postalCatalog, value)
    if (!postalInfo) return

    for (const relatedField of activeStepFields) {
      if (!isSameAddressScope(field, relatedField)) continue
      const currentValue = values[relatedField.id] ?? form.initialValues[relatedField.id] ?? ""
      if (currentValue.trim()) continue

      if (isStateField(relatedField)) {
        onChange(relatedField.id, findSatAddressOption(relatedField.options ?? [], postalInfo.estado) ?? postalInfo.estado)
      } else if (isMunicipalityField(relatedField)) {
        onChange(relatedField.id, findSatAddressOption(relatedField.options ?? [], postalInfo.municipio) ?? postalInfo.municipio)
      } else if (isCityField(relatedField)) {
        const ciudad = postalInfo.ciudad || postalInfo.municipio
        onChange(relatedField.id, findSatAddressOption(relatedField.options ?? [], ciudad) ?? ciudad)
      } else if (isNeighborhoodField(relatedField) && postalInfo.asentamientos.length === 1) {
        onChange(
          relatedField.id,
          findSatAddressOption(relatedField.options ?? [], postalInfo.asentamientos[0]) ?? postalInfo.asentamientos[0],
        )
      }
    }
  }

  const addRepeatRow = (groupId: string, limit: number) => {
    setVisibleRows((prev) => ({ ...prev, [groupId]: Math.min((prev[groupId] || 1) + 1, limit) }))
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-900">
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            <span className="min-w-0 truncate">Preguntas oficiales del Excel SAT</span>
            {infoHintContent && <InfoHint content={infoHintContent} />}
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
            Captura solo lo pendiente. Los datos ya resueltos se precargan al Excel/XML desde Alta SAT, EUI y operación.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] text-slate-600">
            {form.templateFile}
          </Badge>
          <Badge
            variant="outline"
            className={
              missingRequired.length
                ? "border-amber-200 bg-amber-50 text-[10px] text-amber-700"
                : "border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700"
            }
          >
            {actionableMissingRequired.length
              ? `${actionableMissingRequired.length} pendiente(s) por revisar`
              : "Excel listo"}
          </Badge>
        </div>
      </div>

      {availableSteps.length === 0 ? (
        <div className="m-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
          <p className="font-semibold">No hay preguntas visibles para esta plantilla.</p>
          <p className="mt-1 text-xs leading-relaxed">
            El layout está cargado, pero no expuso campos capturables para esta sección. Revisa la sincronización del XLSM
            o usa los campos operativos de la captura guiada.
          </p>
        </div>
      ) : (
      <div className="grid min-w-0 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-slate-100 bg-slate-50/70 p-4 lg:min-h-[560px] lg:border-b-0 lg:border-r lg:sticky lg:top-16 lg:self-start">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Secciones del Excel</p>
          <div className="mt-3 flex min-w-0 gap-1 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
          {availableSteps.map((step) => {
            const stepFields = allFields.filter((field) => field.sectionKind === step.id)
            const pending = getActionableSatMissingFieldIds({
              fields: stepFields,
              missingRequiredIds: missingRequired.filter((fieldId) => stepFields.some((field) => field.id === fieldId)),
            }).length
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStepId(step.id)}
                className={`group flex min-w-[190px] items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition lg:w-full lg:min-w-0 ${
                  activeStep?.id === step.id
                    ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-600 hover:bg-white/80 hover:text-slate-900"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2 text-xs font-semibold">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      pending > 0
                        ? activeStep?.id === step.id
                          ? "bg-amber-500"
                          : "bg-amber-300"
                        : "bg-emerald-400"
                    }`}
                  />
                  <span className="min-w-0 truncate">{step.title}</span>
                </div>
                  {pending > 0 ? (
                    <Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 text-[10px] text-amber-700">
                      {pending}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">
                      OK
                    </Badge>
                  )}
              </button>
            )
          })}
          </div>
          <div className="mt-4 hidden rounded-lg bg-white/70 p-3 text-[11px] leading-relaxed text-slate-500 lg:block">
            {fieldCount} campos SAT detectados. La referencia técnica queda en cada pregunta.
          </div>
        </aside>

        <main className="min-w-0 px-5 py-5 lg:px-7">
          {activeStep && (
            <>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 items-start gap-2">
                  <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  <div className="min-w-0">
                  <h4 className="text-base font-semibold text-slate-900">{activeStep.title}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{activeStep.description}</p>
                  </div>
                </div>
                <Badge variant="outline" className="w-fit shrink-0 border-slate-200 bg-slate-50 text-[10px] text-slate-600">
                  {dedupedQuestionnaire.fields.length} pregunta(s) visibles
                </Badge>
                </div>

              <div className="mt-5 border-y border-slate-100 py-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">Captura pendiente</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Lo precargado está oculto para reducir ruido.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] text-amber-700">
                      {activeStepFieldView.visibleRequiredMissingCount} pendiente(s)
                    </Badge>
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">
                      {activeStepFieldView.autoFilledCount} precargado(s)
                    </Badge>
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] text-slate-600">
                      {activeStepFieldView.optionalHiddenCount} opcional(es)
                    </Badge>
                    {dedupedQuestionnaire.duplicateHiddenCount > 0 && (
                      <Badge variant="outline" className="border-violet-200 bg-violet-50 text-[10px] text-violet-700">
                        {dedupedQuestionnaire.duplicateHiddenCount} repetido(s) unificado(s)
                      </Badge>
                    )}
                    {managedByPrimaryCapture.length > 0 && (
                      <Badge variant="outline" className="border-sky-200 bg-sky-50 text-[10px] text-sky-700">
                        {managedByPrimaryCapture.length} desde operación
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeStepFieldView.autoFilledCount > 0 && (
                    <Button
                      type="button"
                      variant={showResolvedFields ? "default" : "outline"}
                      size="sm"
                      className={showResolvedFields ? "" : "bg-white shadow-none"}
                      onClick={() => setShowResolvedFields((current) => !current)}
                    >
                      {showResolvedFields ? "Ocultar precargados" : "Editar precargados"}
                    </Button>
                  )}
                  {activeStepFieldView.optionalHiddenCount > 0 && (
                    <Button
                      type="button"
                      variant={showOptionalFields ? "default" : "outline"}
                      size="sm"
                      className={showOptionalFields ? "" : "bg-white shadow-none"}
                      onClick={() => setShowOptionalFields((current) => !current)}
                    >
                      {showOptionalFields ? "Ocultar opcionales" : "Ver opcionales"}
                    </Button>
                  )}
                </div>
              </div>

              {plainFields.length > 0 && (
                <div className="mt-5 grid min-w-0 gap-4">
                  {plainFields.map((field) => (
                    <SatFieldControl
                      key={`${field.sheetName}-${field.cell}-${field.id}`}
                      field={field}
                      value={valueForQuestionnaire(field)}
                      allValues={values}
                      isMissing={dedupedQuestionnaire.missingRequiredIds.includes(field.id)}
                      onChange={updateQuestionnaireField}
                      duplicateCount={dedupedQuestionnaire.duplicateFieldIdsByRepresentative[field.id]?.length ?? 0}
                      postalCatalog={postalCatalog}
                    />
                  ))}
                </div>
              )}

              {visibleActiveStepFields.length === 0 && (
                <div className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-100">
                  <p className="font-semibold">Sección cubierta con datos previos</p>
                  <p className="mt-1 text-xs leading-relaxed text-emerald-800">
                    No hay campos obligatorios pendientes aquí. El Excel SAT se llenará con la información ya registrada.
                  </p>
                </div>
              )}

              <div className="mt-4 space-y-4">
                {repeatGroupIds.map((groupId) => {
                  const groupFields = visibleActiveStepFields.filter((field) => field.repeatGroup === groupId)
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
                    <section key={groupId} className="border-t border-slate-100 pt-5">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                          className="bg-white shadow-none"
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
                            <div key={`${groupId}-${rowIndex}`} className="rounded-xl bg-slate-50/70 p-4">
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-700">
                                  {REPEAT_GROUP_LABELS[groupId] ?? "Fila"} {rowIndex}
                                </span>
                                <Badge variant="outline" className="border-slate-200 bg-white font-mono text-[10px] text-slate-500">
                                  fila SAT {rowFields[0]?.cell.match(/\d+/)?.[0] ?? rowIndex}
                                </Badge>
                              </div>
                              <div className="grid min-w-0 gap-4">
                                {rowFields.map((field) => (
                                  <SatFieldControl
                                    key={`${field.sheetName}-${field.cell}-${field.id}`}
                                    field={field}
                                    value={valueForQuestionnaire(field)}
                                    allValues={values}
                                    isMissing={dedupedQuestionnaire.missingRequiredIds.includes(field.id)}
                                    onChange={updateQuestionnaireField}
                                    duplicateCount={dedupedQuestionnaire.duplicateFieldIdsByRepresentative[field.id]?.length ?? 0}
                                    postalCatalog={postalCatalog}
                                  />
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  )
                })}
              </div>
            </>
          )}
        </main>
      </div>
      )}
    </div>
  )
}

function SatFieldControl({
  field,
  value,
  allValues,
  isMissing,
  onChange,
  duplicateCount = 0,
  postalCatalog,
}: {
  field: SatXlsmField
  value: string
  allValues: Record<string, string>
  isMissing: boolean
  onChange: (fieldId: string, value: string) => void
  duplicateCount?: number
  postalCatalog: CodigoPostalInfo[]
}) {
  const postalInfo = isPostalCodeField(field) ? findCodigoPostalInfoInCatalog(postalCatalog, value) : undefined
  const postalCodeOptions = useMemo(() => postalCatalog.map((item) => item.codigo), [postalCatalog])
  const inferredPostalCode = useMemo(() => {
    if (isPostalCodeField(field)) return value
    const candidates = Object.values(allValues)
      .map((item) => item?.trim().replace(/\D/g, ""))
      .filter((item) => item.length === 5)
    return candidates[0] ?? ""
  }, [allValues, field, value])
  const neighborhoodOptions = useMemo(() => {
    if (!isNeighborhoodField(field)) return []
    const fromCp = inferredPostalCode ? findCodigoPostalInfoInCatalog(postalCatalog, inferredPostalCode)?.asentamientos ?? [] : []
    return Array.from(new Set([...fromCp, value].filter(Boolean)))
  }, [field, inferredPostalCode, postalCatalog, value])
  const options = field.options?.length
    ? field.options
    : isPostalCodeField(field)
      ? Array.from(new Set([...postalCodeOptions, value].filter(Boolean)))
      : neighborhoodOptions
  const isCatalogWithoutResolvedList =
    field.dataType === "catalogo" && options.length === 0 && !isPostalCodeField(field) && !isNeighborhoodField(field)

  return (
    <div
      className={`min-w-0 space-y-2 overflow-hidden border-b pb-4 last:border-b-0 ${
        isMissing ? "border-amber-100 bg-amber-50/60 px-3 py-3" : "border-slate-100"
      }`}
    >
      <Label className="block min-w-0 break-words text-xs leading-relaxed">
        <span>
          {field.label}
          {field.required ? <span className="text-rose-600"> *</span> : null}
        </span>
      </Label>
      {options.length > 0 ? (
        <SatOptionCombobox
          value={value}
          options={options}
          placeholder={isPostalCodeField(field) ? "Busca o captura CP" : "Selecciona opción del Excel SAT"}
          allowCustomValue={isPostalCodeField(field)}
          onChange={(next) => onChange(field.id, next)}
        />
      ) : (
        <>
          <Input
            value={value}
            inputMode={field.dataType === "numero" || field.dataType === "moneda" ? "decimal" : "text"}
            placeholder={field.dataType === "fecha" ? "dd/mm/aaaa" : field.placeholder ?? "Captura valor"}
            className="bg-white"
            onChange={(event) => onChange(field.id, event.target.value)}
          />
          {isCatalogWithoutResolvedList && (
            <p className="text-[11px] leading-relaxed text-amber-700">
              El XLSM marca esta celda como validada, pero no expone un catálogo seleccionable. Captura el valor y revisa
              la plantilla oficial antes de enviar.
            </p>
          )}
        </>
      )}
      {options.length > 0 && (
        <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-700">
          {field.options?.length
            ? `Lista oficial del Excel · ${options.length} opciones`
            : isPostalCodeField(field)
              ? `Catálogo postal local · ${options.length} opciones`
              : `Colonias por CP ${inferredPostalCode || "pendiente"} · ${options.length} opciones`}
        </p>
      )}
      {postalInfo && (
        <p className="text-[11px] leading-relaxed text-slate-500">
          {postalInfo.estado} · {postalInfo.municipio}
          {postalInfo.ciudad ? ` · ${postalInfo.ciudad}` : ""}
        </p>
      )}
      {duplicateCount > 0 && (
        <p className="text-[11px] leading-relaxed text-violet-700">
          Esta captura rellena {duplicateCount + 1} celda(s) equivalentes del XLSM para evitar pedirte el mismo dato dos veces.
        </p>
      )}
      <details className="text-[10px] text-muted-foreground">
        <summary className="cursor-pointer select-none">Ver referencia SAT</summary>
        <p className="mt-1">
          {field.sheetName} · celda {field.cell} ·{" "}
          {field.source === "manual-sat-map" ? "mapeo SAT verificado" : "detectado desde XLSM"}
          {field.optionListId ? ` · lista ${field.optionListId}` : ""}
        </p>
      </details>
    </div>
  )
}

function SatOptionCombobox({
  value,
  options,
  placeholder,
  allowCustomValue = false,
  onChange,
}: {
  value: string
  options: string[]
  placeholder: string
  allowCustomValue?: boolean
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const normalizedQuery = normalizeForSearch(query)
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return options
    return options.filter((option) => normalizeForSearch(option).includes(normalizedQuery))
  }, [normalizedQuery, options])
  const visibleOptions = filteredOptions.slice(0, 80)
  const canUseCustom = allowCustomValue && query.trim().length > 0 && !options.includes(query.trim())

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-10 w-full min-w-0 justify-between gap-2 bg-white px-3 py-2 text-left font-normal"
        >
          <span className={value ? "min-w-0 flex-1 truncate text-slate-800" : "min-w-0 flex-1 truncate text-muted-foreground"}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(560px,calc(100vw-2rem))] p-0">
        <div className="border-b p-2">
          <div className="flex items-center gap-2 rounded-md border bg-white px-2">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar en lista del Excel SAT"
              className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {visibleOptions.length > 0 ? (
            visibleOptions.map((option) => (
              <button
                key={option}
                type="button"
                className="flex w-full min-w-0 items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-emerald-50"
                onClick={() => {
                  onChange(option)
                  setOpen(false)
                  setQuery("")
                }}
              >
                <Check className={`mt-0.5 h-4 w-4 shrink-0 ${value === option ? "text-emerald-700" : "text-transparent"}`} />
                <span className="min-w-0 break-words leading-snug text-slate-700">{option}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">Sin coincidencias en la lista SAT.</div>
          )}
          {canUseCustom && (
            <button
              type="button"
              className="mt-1 flex w-full rounded px-3 py-2 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50"
              onClick={() => {
                onChange(query.trim())
                setOpen(false)
                setQuery("")
              }}
            >
              Usar “{query.trim()}”
            </button>
          )}
        </div>
        <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
          {filteredOptions.length > visibleOptions.length
            ? `Mostrando ${visibleOptions.length} de ${filteredOptions.length}. Escribe para filtrar mas.`
            : `${filteredOptions.length} opcion(es) encontradas.`}
        </div>
      </PopoverContent>
    </Popover>
  )
}
