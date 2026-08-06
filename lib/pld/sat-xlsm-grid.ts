/**
 * Utilidades de rejilla para las plantillas XLSM del SAT.
 *
 * Se mantienen aisladas de la extracción y del llenado para que tanto
 * `sat-xlsm.ts` como `sat-xlsm-structure.ts` compartan una sola
 * implementación de direccionamiento de celdas.
 */

export type CellMap = Record<string, string>

export function splitCell(cell: string): { col: string; row: number } {
  const match = cell.match(/^([A-Z]+)(\d+)$/i)
  return {
    col: (match?.[1] || "A").toUpperCase(),
    row: Number(match?.[2] || 1),
  }
}

export function columnToNumber(col: string): number {
  return col
    .toUpperCase()
    .split("")
    .reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0)
}

export function numberToColumn(input: number): string {
  let n = Math.max(1, input)
  let result = ""
  while (n > 0) {
    const remainder = (n - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    n = Math.floor((n - remainder) / 26)
  }
  return result
}

export function expandRange(range: string): string[] {
  const [start, end = start] = range.replace(/\$/g, "").split(":")
  const a = splitCell(start.toUpperCase())
  const b = splitCell(end.toUpperCase())
  const cells: string[] = []
  for (let row = a.row; row <= b.row; row += 1) {
    for (let col = columnToNumber(a.col); col <= columnToNumber(b.col); col += 1) {
      cells.push(`${numberToColumn(col)}${row}`)
    }
  }
  return cells
}

export function rangeBounds(range: string): {
  startRow: number
  endRow: number
  startCol: number
  endCol: number
} {
  const [start, end = start] = range.replace(/\$/g, "").split(":")
  const a = splitCell(start.toUpperCase())
  const b = splitCell(end.toUpperCase())
  return {
    startRow: Math.min(a.row, b.row),
    endRow: Math.max(a.row, b.row),
    startCol: Math.min(columnToNumber(a.col), columnToNumber(b.col)),
    endCol: Math.max(columnToNumber(a.col), columnToNumber(b.col)),
  }
}

export function stripRequiredMarker(label: string): string {
  return label.replace(/^\*\s*/, "").replace(/\s+/g, " ").trim()
}

export function isRequiredLabel(label: string): boolean {
  return label.trim().startsWith("*")
}

export function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function normalizeLabelText(value: string): string {
  return stripRequiredMarker(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** Código de catálogo SAT: `"99,Otro"` -> `"99"`, `"ETIQUETA||123"` -> `"123"`. */
export function optionCode(option: string): string {
  const pipe = option.split("||")
  if (pipe.length > 1) return pipe[pipe.length - 1].trim()
  const comma = option.indexOf(",")
  return comma > 0 ? option.slice(0, comma).trim() : option.trim()
}

/** Etiqueta legible de una opción de catálogo SAT. */
export function optionLabel(option: string): string {
  const pipe = option.split("||")
  if (pipe.length > 1) return pipe.slice(0, -1).join("||").trim()
  const comma = option.indexOf(",")
  return comma > 0 ? option.slice(comma + 1).trim() : option.trim()
}
