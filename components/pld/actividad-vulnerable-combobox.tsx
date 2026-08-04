"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, ChevronsUpDown, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { ActividadVulnerable } from "@/lib/data/actividades"
import { cn } from "@/lib/utils"

export type ActividadVulnerableComboboxProps = {
  id?: string
  ariaLabel?: string
  value: string
  options: readonly ActividadVulnerable[]
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  triggerClassName?: string
  onChange: (value: string) => void
}

function normalizarBusqueda(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
}

export function filterActividadesVulnerables(
  options: readonly ActividadVulnerable[],
  query: string,
) {
  const term = normalizarBusqueda(query)
  if (!term) return options

  return options.filter((actividad) => {
    const searchable = [
      actividad.fraccion,
      actividad.nombre,
      actividad.descripcion,
      actividad.key,
      ...actividad.ejemplosOperaciones.map((ejemplo) => `${ejemplo.titulo} ${ejemplo.descripcion}`),
    ].join(" ")

    return normalizarBusqueda(searchable).includes(term)
  })
}

export function ActividadVulnerableCombobox({
  id,
  ariaLabel,
  value,
  options,
  placeholder = "Busca por fracción o actividad",
  searchPlaceholder = "Filtrar por fracción, nombre o palabra clave",
  disabled,
  triggerClassName,
  onChange,
}: ActividadVulnerableComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selected = options.find((actividad) => actividad.key === value)
  const filteredOptions = useMemo(
    () => filterActividadesVulnerables(options, query),
    [options, query],
  )

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
            "h-11 w-full max-w-none justify-between gap-2 rounded-xl border-slate-200 bg-white px-4 text-left text-[15px] font-normal shadow-sm shadow-slate-100/70",
            triggerClassName,
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            {selected ? `${selected.fraccion} - ${selected.nombre}` : placeholder}
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
              onInput={(event) => setQuery(event.currentTarget.value)}
              placeholder={searchPlaceholder}
              aria-label="Buscar actividad vulnerable"
              className="h-9 pl-8"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto overscroll-contain p-1">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((actividad) => {
              const isSelected = actividad.key === value
              return (
                <button
                  key={actividad.key}
                  type="button"
                  aria-pressed={isSelected}
                  className={cn(
                    "flex w-full min-w-0 items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-slate-100",
                    isSelected ? "bg-emerald-50 text-emerald-900" : "text-slate-700",
                  )}
                  onClick={() => {
                    onChange(actividad.key)
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
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{actividad.fraccion}</span>
                    <span className="line-clamp-2 text-xs leading-relaxed text-slate-500">
                      {actividad.nombre}
                    </span>
                  </span>
                </button>
              )
            })
          ) : (
            <div className="px-3 py-6 text-center text-sm text-slate-500">
              No encontré actividades con ese texto.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
