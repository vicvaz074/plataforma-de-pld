"use client"

import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react"
import { CheckCircle2, ChevronsUpDown, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface SearchableSelectValueLabelOption {
  value: string
  label: string
  keywords?: readonly string[]
}

export type SearchableSelectOption = string | SearchableSelectValueLabelOption

export interface SearchableSelectProps {
  id?: string
  ariaLabel?: string
  value: string
  options: readonly SearchableSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string
  disabled?: boolean
  triggerClassName?: string
  onChange: (value: string) => void
}

export function normalizeSearchableSelectText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
}

export function normalizeSearchableSelectOptions(
  options: readonly SearchableSelectOption[],
): SearchableSelectValueLabelOption[] {
  const normalized: SearchableSelectValueLabelOption[] = []
  const seenValues = new Set<string>()

  options.forEach((option) => {
    const normalizedOption =
      typeof option === "string"
        ? { value: option, label: option }
        : {
            value: option.value,
            label: option.label,
            ...(option.keywords ? { keywords: option.keywords } : {}),
          }

    if (seenValues.has(normalizedOption.value)) return
    seenValues.add(normalizedOption.value)
    normalized.push(normalizedOption)
  })

  return normalized
}

export function filterSearchableSelectOptions(
  options: readonly SearchableSelectOption[],
  query: string,
): SearchableSelectValueLabelOption[] {
  const normalizedOptions = normalizeSearchableSelectOptions(options)
  const term = normalizeSearchableSelectText(query)
  if (!term) return normalizedOptions

  return normalizedOptions.filter((option) =>
    normalizeSearchableSelectText(
      [option.label, option.value, ...(option.keywords ?? [])].join(" "),
    ).includes(term),
  )
}

export function getSearchableSelectSelectionLabel(
  options: readonly SearchableSelectOption[],
  value: string,
) {
  if (!value) return ""
  return normalizeSearchableSelectOptions(options).find((option) => option.value === value)?.label ?? value
}

export function getSearchableSelectSelectionIndex(
  options: readonly SearchableSelectOption[],
  value: string,
) {
  if (!value) return -1
  return normalizeSearchableSelectOptions(options).findIndex((option) => option.value === value)
}

export function SearchableSelect({
  id,
  ariaLabel,
  value,
  options,
  placeholder = "Selecciona una opción",
  searchPlaceholder = "Buscar opción",
  emptyLabel = "No hay coincidencias.",
  disabled,
  triggerClassName,
  onChange,
}: SearchableSelectProps) {
  const generatedId = useId()
  const listboxId = `${id || generatedId}-listbox`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(-1)
  const normalizedOptions = useMemo(() => normalizeSearchableSelectOptions(options), [options])
  const filteredOptions = useMemo(() => {
    const term = normalizeSearchableSelectText(query)
    if (!term) return normalizedOptions
    return normalizedOptions.filter((option) =>
      normalizeSearchableSelectText(
        [option.label, option.value, ...(option.keywords ?? [])].join(" "),
      ).includes(term),
    )
  }, [normalizedOptions, query])
  const selectedLabel =
    normalizedOptions.find((option) => option.value === value)?.label ?? value
  const resolvedActiveIndex =
    activeIndex < 0 || filteredOptions.length === 0
      ? -1
      : Math.min(activeIndex, filteredOptions.length - 1)
  const activeOption =
    resolvedActiveIndex >= 0 ? filteredOptions[resolvedActiveIndex] : undefined

  useEffect(() => {
    if (!open || resolvedActiveIndex < 0) return
    document
      .getElementById(`${listboxId}-option-${resolvedActiveIndex}`)
      ?.scrollIntoView({ block: "nearest" })
  }, [listboxId, open, resolvedActiveIndex])

  const resetSearch = () => {
    setQuery("")
    setActiveIndex(-1)
  }

  const setSelectedOptionActive = () => {
    setActiveIndex(getSearchableSelectSelectionIndex(options, value))
  }

  const selectOption = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
    resetSearch()
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (filteredOptions.length === 0) {
      if (event.key === "Escape") setOpen(false)
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((current) => (current + 1) % filteredOptions.length)
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((current) =>
        current < 0 ? filteredOptions.length - 1 : (current - 1 + filteredOptions.length) % filteredOptions.length,
      )
      return
    }

    if (event.key === "Home") {
      event.preventDefault()
      setActiveIndex(0)
      return
    }

    if (event.key === "End") {
      event.preventDefault()
      setActiveIndex(filteredOptions.length - 1)
      return
    }

    if (event.key === "Enter" && activeOption) {
      event.preventDefault()
      selectOption(activeOption.value)
      return
    }

    if (event.key === "Escape") setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) setSelectedOptionActive()
        else resetSearch()
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-label={ariaLabel}
          disabled={disabled}
          onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
            event.preventDefault()
            setOpen(true)
            const selectedIndex = getSearchableSelectSelectionIndex(options, value)
            setActiveIndex(
              selectedIndex >= 0
                ? selectedIndex
                : event.key === "ArrowUp"
                  ? normalizedOptions.length - 1
                  : 0,
            )
          }}
          className={cn(
            "h-10 w-full min-w-0 justify-between gap-2 bg-white px-3 text-left font-normal",
            triggerClassName,
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              selectedLabel ? "text-slate-800" : "text-muted-foreground",
            )}
            title={selectedLabel || undefined}
          >
            {selectedLabel || placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[360px] w-[--radix-popover-trigger-width] overflow-hidden p-0"
      >
        <div className="border-b p-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              role="searchbox"
              aria-label={searchPlaceholder}
              aria-controls={listboxId}
              aria-activedescendant={
                activeOption ? `${listboxId}-option-${resolvedActiveIndex}` : undefined
              }
              className="h-9 pl-8"
              autoFocus
            />
          </div>
        </div>
        <div
          id={listboxId}
          className="max-h-72 space-y-1 overflow-y-auto overscroll-contain p-1"
          role="listbox"
          aria-label={ariaLabel || "Opciones disponibles"}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => {
              const isSelected = option.value === value
              const isActive = index === resolvedActiveIndex

              return (
                <button
                  id={`${listboxId}-option-${index}`}
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={-1}
                  className={cn(
                    "flex w-full min-w-0 items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected && "bg-emerald-50 text-emerald-900",
                    isActive && !isSelected && "bg-slate-100 text-slate-900",
                    !isSelected && !isActive && "text-slate-700",
                  )}
                  onMouseMove={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onClick={() => selectOption(option.value)}
                >
                  <CheckCircle2
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      isSelected ? "text-emerald-600" : "text-transparent",
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 break-words leading-relaxed">{option.label}</span>
                </button>
              )
            })
          ) : (
            <div className="px-3 py-6 text-center text-sm text-slate-500">{emptyLabel}</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
