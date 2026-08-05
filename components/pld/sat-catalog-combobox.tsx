"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, ChevronsUpDown, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { SatEuiCatalogOption } from "@/lib/pld/expediente-eui"
import { cn } from "@/lib/utils"

export type SatCatalogComboboxProps = {
  id?: string
  ariaLabel?: string
  value: string
  options: readonly SatEuiCatalogOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string
  disabled?: boolean
  triggerClassName?: string
  onChange: (value: string) => void
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
}

export function formatSatCatalogOption(option: SatEuiCatalogOption) {
  return `${option.code} · ${option.label}`
}

export function filterSatCatalogOptions(
  options: readonly SatEuiCatalogOption[],
  query: string,
) {
  const term = normalizeSearch(query)
  if (!term) return options

  return options.filter((option) =>
    normalizeSearch(`${option.code} ${option.label} ${option.value}`).includes(term),
  )
}

export function getSatCatalogSelectionLabel(
  options: readonly SatEuiCatalogOption[],
  value: string,
) {
  if (!value) return ""
  const selected = options.find((option) => option.value === value)
  return selected ? formatSatCatalogOption(selected) : value
}

export function SatCatalogCombobox({
  id,
  ariaLabel,
  value,
  options,
  placeholder = "Selecciona una opción del catálogo SAT",
  searchPlaceholder = "Buscar por código o descripción",
  emptyLabel = "No hay coincidencias en el catálogo SAT.",
  disabled,
  triggerClassName,
  onChange,
}: SatCatalogComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const filteredOptions = useMemo(
    () => filterSatCatalogOptions(options, query),
    [options, query],
  )
  const selectedLabel = getSatCatalogSelectionLabel(options, value)

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setQuery("")
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
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
          >
            {selectedLabel || placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[360px] w-[--radix-popover-trigger-width] overflow-hidden p-0"
      >
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Buscar en catálogo SAT"
              className="h-9 pl-8"
              autoFocus
            />
          </div>
        </div>
        <div
          className="max-h-72 space-y-1 overflow-y-auto overscroll-contain p-1"
          role="listbox"
          aria-label={ariaLabel || "Opciones del catálogo SAT"}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={cn(
                    "flex w-full min-w-0 items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-slate-100",
                    isSelected ? "bg-emerald-50 text-emerald-900" : "text-slate-700",
                  )}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                    setQuery("")
                  }}
                >
                  <CheckCircle2
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      isSelected ? "text-emerald-600" : "text-transparent",
                    )}
                  />
                  <span className="min-w-0 flex-1 leading-relaxed">
                    <span className="font-semibold">{option.code}</span>
                    <span className="text-slate-500"> · {option.label}</span>
                  </span>
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
