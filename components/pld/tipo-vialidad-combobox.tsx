"use client"

import { Input } from "@/components/ui/input"
import { SearchableSelect } from "@/components/pld/searchable-select"
import {
  EXPEDIENTE_TIPOS_VIALIDAD,
  EXPEDIENTE_TIPO_VIALIDAD_OTRO,
  applyExpedienteTipoVialidadCustomValue,
  applyExpedienteTipoVialidadSelection,
  getExpedienteTipoVialidadCustomValue,
  getExpedienteTipoVialidadSelection,
  type ExpedienteTipoVialidad,
} from "@/lib/pld/expediente-address-catalogs"

interface TipoVialidadComboboxProps {
  id?: string
  ariaLabel?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function TipoVialidadCombobox({
  id,
  ariaLabel = "Tipo de vialidad",
  value,
  onChange,
  disabled,
}: TipoVialidadComboboxProps) {
  const selection = getExpedienteTipoVialidadSelection(value)
  const customValue = getExpedienteTipoVialidadCustomValue(value)
  const customInputId = id ? `${id}-otro` : undefined

  return (
    <div className="space-y-2">
      <SearchableSelect
        id={id}
        ariaLabel={ariaLabel}
        value={selection}
        options={EXPEDIENTE_TIPOS_VIALIDAD}
        placeholder="Selecciona el tipo de vialidad"
        searchPlaceholder="Buscar tipo de vialidad"
        emptyLabel="No hay tipos de vialidad que coincidan."
        disabled={disabled}
        onChange={(nextSelection) =>
          onChange(
            applyExpedienteTipoVialidadSelection(
              value,
              nextSelection as ExpedienteTipoVialidad,
            ),
          )
        }
      />

      {selection === EXPEDIENTE_TIPO_VIALIDAD_OTRO ? (
        <Input
          id={customInputId}
          value={customValue}
          disabled={disabled}
          aria-label={`${ariaLabel}: especifica otro`}
          placeholder="Especifica el tipo de vialidad"
          onChange={(event) =>
            onChange(applyExpedienteTipoVialidadCustomValue(event.target.value))
          }
        />
      ) : null}
    </div>
  )
}
