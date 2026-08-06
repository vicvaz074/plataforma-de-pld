"use client"

import { Input } from "@/components/ui/input"
import {
  SearchableSelect,
  normalizeSearchableSelectOptions,
  normalizeSearchableSelectText,
  type SearchableSelectOption,
  type SearchableSelectProps,
} from "@/components/pld/searchable-select"
import { cn } from "@/lib/utils"

type SearchableSelectWithOtherBaseProps = Omit<
  SearchableSelectProps,
  "value" | "onChange"
> & {
  value: string
  otherValue: string
  onChange: (value: string) => void
  otherInputId?: string
  otherInputAriaLabel?: string
  otherInputPlaceholder?: string
  otherInputClassName?: string
}

type EmbeddedOtherProps = {
  otherText?: never
  onOtherTextChange?: never
}

type SeparateOtherProps = {
  otherText: string
  onOtherTextChange: (value: string) => void
}

export type SearchableSelectWithOtherProps = SearchableSelectWithOtherBaseProps &
  (EmbeddedOtherProps | SeparateOtherProps)

function findNormalizedOptionValue(
  options: readonly SearchableSelectOption[],
  value: string,
) {
  const normalizedValue = normalizeSearchableSelectText(value)
  if (!normalizedValue) return ""

  return (
    normalizeSearchableSelectOptions(options).find(
      (option) =>
        normalizeSearchableSelectText(option.value) === normalizedValue ||
        normalizeSearchableSelectText(option.label) === normalizedValue,
    )?.value ?? ""
  )
}

export function getSearchableSelectWithOtherSelection(
  options: readonly SearchableSelectOption[],
  value: string,
  otherValue: string,
) {
  if (!value.trim()) return ""

  return findNormalizedOptionValue(options, value) || otherValue
}

export function getEmbeddedSearchableSelectOtherText(
  options: readonly SearchableSelectOption[],
  value: string,
) {
  if (!value.trim()) return ""
  return findNormalizedOptionValue(options, value) ? "" : value
}

export function applyEmbeddedSearchableSelectSelection(
  options: readonly SearchableSelectOption[],
  currentValue: string,
  nextSelection: string,
  otherValue: string,
) {
  const canonicalSelection = findNormalizedOptionValue(options, nextSelection)
  const canonicalOtherValue =
    findNormalizedOptionValue(options, otherValue) || otherValue

  if (
    normalizeSearchableSelectText(canonicalSelection || nextSelection) !==
    normalizeSearchableSelectText(canonicalOtherValue)
  ) {
    return canonicalSelection || nextSelection
  }

  return (
    getEmbeddedSearchableSelectOtherText(options, currentValue) ||
    canonicalOtherValue
  )
}

export function applyEmbeddedSearchableSelectOtherText(
  otherText: string,
  otherValue: string,
) {
  return otherText.trim() ? otherText : otherValue
}

export function applySeparateSearchableSelectSelection(
  options: readonly SearchableSelectOption[],
  nextSelection: string,
  otherValue: string,
) {
  const canonicalSelection = findNormalizedOptionValue(options, nextSelection)
  const canonicalOtherValue =
    findNormalizedOptionValue(options, otherValue) || otherValue
  const value = canonicalSelection || nextSelection

  return {
    value,
    clearOtherText:
      normalizeSearchableSelectText(value) !==
      normalizeSearchableSelectText(canonicalOtherValue),
  }
}

export function SearchableSelectWithOther({
  id,
  ariaLabel,
  value,
  options,
  otherValue,
  onChange,
  otherText,
  onOtherTextChange,
  otherInputId,
  otherInputAriaLabel,
  otherInputPlaceholder = "Especifica otra opción",
  otherInputClassName,
  disabled,
  ...selectProps
}: SearchableSelectWithOtherProps) {
  const isSeparateMode =
    typeof otherText === "string" && typeof onOtherTextChange === "function"
  const selection = getSearchableSelectWithOtherSelection(
    options,
    value,
    otherValue,
  )
  const canonicalOtherValue =
    findNormalizedOptionValue(options, otherValue) || otherValue
  const isOtherSelected =
    normalizeSearchableSelectText(selection) ===
    normalizeSearchableSelectText(canonicalOtherValue)
  const resolvedOtherText = isSeparateMode
    ? otherText
    : getEmbeddedSearchableSelectOtherText(options, value)
  const resolvedOtherInputId = otherInputId ?? (id ? `${id}-other` : undefined)

  return (
    <div className="space-y-2">
      <SearchableSelect
        {...selectProps}
        id={id}
        ariaLabel={ariaLabel}
        value={selection}
        options={options}
        disabled={disabled}
        onChange={(nextSelection) => {
          if (isSeparateMode) {
            const transition = applySeparateSearchableSelectSelection(
              options,
              nextSelection,
              otherValue,
            )
            onChange(transition.value)
            if (transition.clearOtherText) onOtherTextChange("")
            return
          }

          onChange(
            applyEmbeddedSearchableSelectSelection(
              options,
              value,
              nextSelection,
              otherValue,
            ),
          )
        }}
      />

      {isOtherSelected ? (
        <Input
          id={resolvedOtherInputId}
          value={resolvedOtherText}
          disabled={disabled}
          aria-label={
            otherInputAriaLabel ??
            `${ariaLabel || "Opción seleccionada"}: especifica otra opción`
          }
          placeholder={otherInputPlaceholder}
          className={cn(otherInputClassName)}
          onChange={(event) => {
            const nextOtherText = event.target.value
            if (isSeparateMode) {
              if (value !== canonicalOtherValue) onChange(canonicalOtherValue)
              onOtherTextChange(nextOtherText)
              return
            }

            onChange(
              applyEmbeddedSearchableSelectOtherText(
                nextOtherText,
                canonicalOtherValue,
              ),
            )
          }}
        />
      ) : null}
    </div>
  )
}
