/**
 * Extractor estructural de las plantillas XLSM oficiales del SAT.
 *
 * Cada Anexo de la LFPIORPI tiene su propio formato, pero todos comparten la
 * misma gramática de captura:
 *
 * - Las celdas capturables son exactamente las que llevan una `dataValidation`
 *   (lista, longitud de texto, fecha, decimal o entero). Ese conjunto es el
 *   mapa autoritativo de campos; deducirlo por etiquetas produce celdas
 *   desplazadas en los bloques tabulares.
 * - Un bloque repetido se reconoce por la numeración consecutiva 1..N de la
 *   primera columna. El renglón inmediato superior contiene los encabezados y,
 *   cuando existe, el renglón previo agrupa columnas por variante.
 * - Un encabezado que inicia con `*` es obligatorio.
 * - Los renglones de captura sueltos usan la etiqueta a su izquierda.
 *
 * Al derivar la estructura del propio libro se evita mantener a mano un mapa
 * por fracción y se conservan las reglas condicionales que el SAT expresa en
 * los encabezados de grupo (por ejemplo "Inmueble" contra "Otro").
 */

import {
  columnToNumber,
  isRequiredLabel,
  normalizeLabelText,
  numberToColumn,
  optionCode,
  optionLabel,
  rangeBounds,
  slug,
  splitCell,
  stripRequiredMarker,
  type CellMap,
} from "./sat-xlsm-grid"
import type { SatXlsmField, SatXlsmOptionList } from "./types"

export interface SheetDataValidation {
  type: string
  operator?: string
  sqref: string[]
  formula1: string
  optionListId?: string
  inlineOptions?: string[]
}

export interface StructuredSheetInput {
  sheetName: string
  cells: CellMap
  validations: SheetDataValidation[]
  optionLists: SatXlsmOptionList[]
}

interface RepeatBlock {
  id: string
  indexColumn: number
  startRow: number
  endRow: number
  count: number
  /**
   * Renglones entre repeticiones. `1` es la tabla clásica (un encabezado y N
   * renglones); un valor mayor es una ficha completa que se repite, como en el
   * Anexo 16, donde cada operación reproduce sus propios encabezados.
   */
  stride: number
  headerRow?: number
  groupRow?: number
}

interface CellValidation {
  type: string
  operator?: string
  formula1: string
  optionListId?: string
  inlineOptions?: string[]
  /** Número de celdas cubiertas por el rango de origen; desempata solapes. */
  spread: number
}

/** Tipos de validación que marcan una celda como capturable. */
const INPUT_VALIDATION_TYPES = new Set(["list", "textlength", "date", "decimal", "whole", "time"])

/**
 * Rangos de bloqueo: el SAT protege el resto de la hoja con validaciones sin
 * tipo o de cobertura masiva. No representan campos.
 */
const MAX_VALIDATION_CELLS = 2000

const MONEY_LABEL = /monto|importe|valor|precio|contraprestacion|saldo|pago|cantidad pagada/
const COUNT_LABEL = /numero de|cantidad|folio|clave|codigo postal|telefono/
const OTHER_OPTION = /^(otro|otra|otros|otras)\b/
const OTHER_DETAIL_LABEL =
  /(descripcion|especificar|especifique|detalle|cual|indique)/

export function buildStructuredSheetFields(input: StructuredSheetInput): SatXlsmField[] {
  const inputCells = collectInputCells(input.validations, input.cells)
  if (!inputCells.size) return []

  const blocks = detectRepeatBlocks(input.cells, inputCells)
  completeTabularBlocks({ blocks, cells: input.cells, inputCells })
  const optionsById = new Map(input.optionLists.map((list) => [list.id, list.options]))

  const headedRows = findHeadedRows(input.cells, inputCells)

  const fields: SatXlsmField[] = []
  for (const [cell, validation] of inputCells) {
    const { col, row } = splitCell(cell)
    const block = blocks.find((item) => row >= item.startRow && row <= item.endRow)
    const field = block
      ? buildTabularField({ input, cell, col, row, block, validation, optionsById })
      : buildStandaloneField({ input, cell, col, row, validation, optionsById, headedRows })
    if (field) fields.push(field)
  }

  return applyGroupConditions({
    fields: dedupeRepeatedRequirements(fields),
    blocks,
    cells: input.cells,
    sheetName: input.sheetName,
  })
}

/**
 * Dentro de una repetición puede haber varios renglones bajo el mismo
 * encabezado (por ejemplo hasta tres ordenantes por operación en el Anexo 16).
 * Sólo el primero hereda la obligatoriedad; los demás amplían la captura.
 */
function dedupeRepeatedRequirements(fields: SatXlsmField[]): SatXlsmField[] {
  const firstRequiredRow = new Map<string, number>()
  for (const field of fields) {
    if (!field.required || !field.repeatGroup) continue
    const key = `${field.repeatGroup}|${field.repeatIndex ?? 1}|${splitCell(field.cell).col}|${field.label}`
    const row = splitCell(field.cell).row
    const current = firstRequiredRow.get(key)
    if (current === undefined || row < current) firstRequiredRow.set(key, row)
  }

  return fields.map((field) => {
    if (!field.required || !field.repeatGroup) return field
    const key = `${field.repeatGroup}|${field.repeatIndex ?? 1}|${splitCell(field.cell).col}|${field.label}`
    if (firstRequiredRow.get(key) === splitCell(field.cell).row) return field
    return { ...field, required: false }
  })
}

/**
 * Une los rangos de validación en un mapa `celda -> validación`. Cuando una
 * celda aparece en varios rangos gana el más específico (el de menor cobertura),
 * que es el que el SAT usa para afinar catálogos por renglón.
 */
function collectInputCells(
  validations: SheetDataValidation[],
  sheetCells: CellMap,
): Map<string, CellValidation> {
  const cells = new Map<string, CellValidation>()

  for (const validation of validations) {
    const type = validation.type.toLowerCase()
    if (!INPUT_VALIDATION_TYPES.has(type)) continue

    for (const range of validation.sqref) {
      const bounds = rangeBounds(range)
      const spread = (bounds.endRow - bounds.startRow + 1) * (bounds.endCol - bounds.startCol + 1)
      if (spread > MAX_VALIDATION_CELLS) continue

      for (let row = bounds.startRow; row <= bounds.endRow; row += 1) {
        for (let col = bounds.startCol; col <= bounds.endCol; col += 1) {
          const ref = `${numberToColumn(col)}${row}`
          // Algunas plantillas dejan la validación sobre el propio encabezado.
          // Una celda con texto es rótulo, no captura.
          if (sheetCells[ref]?.trim()) continue
          const existing = cells.get(ref)
          const candidate: CellValidation = {
            type,
            operator: validation.operator,
            formula1: validation.formula1,
            optionListId: validation.optionListId,
            inlineOptions: validation.inlineOptions,
            spread,
          }
          if (!existing || preferValidation(candidate, existing)) cells.set(ref, candidate)
        }
      }
    }
  }

  return cells
}

function preferValidation(candidate: CellValidation, existing: CellValidation): boolean {
  // Una lista describe mejor el campo que una restricción de longitud.
  if (candidate.type === "list" && existing.type !== "list") return true
  if (existing.type === "list" && candidate.type !== "list") return false
  return candidate.spread < existing.spread
}

interface RowIndexToken {
  prefix: string
  value: number
}

/**
 * Reconoce la numeración de un bloque repetido. Los Anexos clásicos numeran
 * `1..N` y las plantillas v5.0 de la Fracción XI usan `R01..R15`, así que se
 * admite un prefijo alfabético siempre que se mantenga dentro del bloque.
 */
function parseRowIndexToken(value: string): RowIndexToken | undefined {
  const match = value.trim().match(/^([A-Za-z]{0,3})0*(\d{1,3})$/)
  if (!match) return undefined
  const parsed = Number(match[2])
  if (!Number.isFinite(parsed) || parsed < 1) return undefined
  return { prefix: match[1].toUpperCase(), value: parsed }
}

/**
 * Detecta bloques repetidos por la numeración consecutiva 1..N de la columna
 * índice. El conteo proviene de la numeración, no del rango de validación:
 * varias plantillas extienden la validación algunos renglones de más.
 */
function detectRepeatBlocks(cells: CellMap, inputCells: Map<string, CellValidation>): RepeatBlock[] {
  const indexCells = new Map<number, Map<number, RowIndexToken>>()
  for (const [ref, value] of Object.entries(cells)) {
    const token = parseRowIndexToken(value)
    if (!token) continue
    const { col, row } = splitCell(ref)
    const colNum = columnToNumber(col)
    const byRow = indexCells.get(colNum) ?? new Map<number, RowIndexToken>()
    byRow.set(row, token)
    indexCells.set(colNum, byRow)
  }

  const blocks: RepeatBlock[] = []
  for (const [colNum, byRow] of indexCells) {
    const rows = [...byRow.keys()].sort((a, b) => a - b)
    let index = 0
    while (index < rows.length) {
      const startRow = rows[index]
      const first = byRow.get(startRow)
      if (first?.value !== 1) {
        index += 1
        continue
      }
      // El paso lo fija la distancia al "2". Algunas plantillas dejan huecos en
      // la numeración (Anexo 16), así que la repetición se sigue por el paso y
      // no por la continuidad de las etiquetas.
      const stride = index + 1 < rows.length ? rows[index + 1] - startRow : 0
      if (stride <= 0) {
        index += 1
        continue
      }
      let lastRow = startRow
      let count = 1
      while (true) {
        const nextRow = lastRow + stride
        const labelled = byRow.get(nextRow)
        // La tabla numera cada renglón, así que un hueco marca su final. La
        // ficha repetida numera sólo su encabezado y sí admite huecos.
        const continues = labelled
          ? labelled.prefix === first.prefix && labelled.value === count + 1
          : stride > 1 && repetitionHasInputs(inputCells, nextRow, stride)
        if (!continues) break
        lastRow = nextRow
        count += 1
      }
      index = rows.findIndex((row) => row > lastRow)
      if (index === -1) index = rows.length
      if (count < 2) continue

      const endRow = lastRow + stride - 1
      // La tabla necesita un encabezado común; la ficha repetida trae sus
      // propios rótulos dentro de cada repetición.
      const headerRow = stride === 1 ? findHeaderRow(cells, startRow, colNum) : undefined
      if (stride === 1 && !headerRow) continue

      // Un encabezado completo basta para reconocer la tabla aunque la
      // plantilla haya omitido las validaciones de sus renglones.
      const declaredByHeader = Boolean(headerRow && countLabelsInRow(cells, headerRow, colNum) >= 2)
      if (!declaredByHeader && !repetitionHasInputs(inputCells, startRow, endRow - startRow + 1)) continue

      blocks.push({
        id: "",
        indexColumn: colNum,
        startRow,
        endRow,
        count,
        stride,
        headerRow,
        groupRow: headerRow ? findGroupRow(cells, headerRow, colNum) : undefined,
      })
    }
  }

  blocks.sort((a, b) => a.startRow - b.startRow)
  for (const block of blocks) block.id = buildBlockId(cells, block)
  return blocks
}

/**
 * El encabezado de una tabla declara todas sus columnas capturables, pero
 * algunas plantillas omiten la validación en los renglones de datos (el Anexo 4
 * sólo la deja sobre el encabezado de liquidación). Se completa el bloque para
 * que la tabla no pierda columnas obligatorias.
 */
function completeTabularBlocks(args: {
  blocks: RepeatBlock[]
  cells: CellMap
  inputCells: Map<string, CellValidation>
}): void {
  for (const block of args.blocks) {
    if (block.stride !== 1 || !block.headerRow) continue

    for (const [ref, value] of Object.entries(args.cells)) {
      if (!value.trim()) continue
      const parsed = splitCell(ref)
      if (parsed.row !== block.headerRow) continue
      const colNum = columnToNumber(parsed.col)
      if (colNum <= block.indexColumn) continue

      for (let row = block.startRow; row <= block.endRow; row += 1) {
        const target = `${parsed.col}${row}`
        if (args.inputCells.has(target) || args.cells[target]?.trim()) continue
        args.inputCells.set(target, {
          type: "",
          formula1: "",
          spread: Number.MAX_SAFE_INTEGER,
        })
      }
    }
  }
}

function repetitionHasInputs(
  inputCells: Map<string, CellValidation>,
  startRow: number,
  height: number,
): boolean {
  const endRow = startRow + Math.max(1, height) - 1
  for (const ref of inputCells.keys()) {
    const { row } = splitCell(ref)
    if (row >= startRow && row <= endRow) return true
  }
  return false
}

/** Encabezado: el renglón más cercano por arriba con al menos dos rótulos. */
function findHeaderRow(cells: CellMap, startRow: number, indexColumn: number): number | undefined {
  for (let row = startRow - 1; row >= Math.max(1, startRow - 4); row -= 1) {
    if (countLabelsInRow(cells, row, indexColumn) >= 2) return row
  }
  // Un bloque de una sola columna capturable sigue siendo válido.
  for (let row = startRow - 1; row >= Math.max(1, startRow - 2); row -= 1) {
    if (countLabelsInRow(cells, row, indexColumn) >= 1) return row
  }
  return undefined
}

/**
 * Renglón de agrupación: sobre el encabezado, reparte las columnas en variantes
 * ("Especie", "Inmueble", "Otro"). Sólo cuenta si tiene menos rótulos que el
 * encabezado, de lo contrario es otra tabla.
 */
function findGroupRow(cells: CellMap, headerRow: number, indexColumn: number): number | undefined {
  const headerCount = countLabelsInRow(cells, headerRow, indexColumn)
  const candidate = headerRow - 1
  if (candidate < 1) return undefined
  const candidateCount = countLabelsInRow(cells, candidate, indexColumn)
  if (candidateCount === 0 || candidateCount >= headerCount) return undefined
  return candidate
}

function countLabelsInRow(cells: CellMap, row: number, indexColumn: number): number {
  let count = 0
  for (const [ref, value] of Object.entries(cells)) {
    if (!value.trim()) continue
    const parsed = splitCell(ref)
    if (parsed.row !== row) continue
    if (columnToNumber(parsed.col) <= indexColumn) continue
    if (!isUsefulLabel(value.trim())) continue
    count += 1
  }
  return count
}

function buildBlockId(cells: CellMap, block: RepeatBlock): string {
  const groupLabel = block.groupRow
    ? firstLabelInRow(cells, block.groupRow, block.indexColumn)
    : ""
  const headerLabel = block.headerRow ? firstLabelInRow(cells, block.headerRow, block.indexColumn) : ""
  const base = slug(groupLabel || headerLabel || `bloque-${block.startRow}`)
  return `${base || "bloque"}-r${block.startRow}`
}

function firstLabelInRow(cells: CellMap, row: number, indexColumn: number): string {
  let best: { col: number; value: string } | undefined
  for (const [ref, value] of Object.entries(cells)) {
    if (!value.trim()) continue
    const parsed = splitCell(ref)
    if (parsed.row !== row) continue
    const colNum = columnToNumber(parsed.col)
    if (colNum <= indexColumn) continue
    if (!best || colNum < best.col) best = { col: colNum, value: value.trim() }
  }
  return best?.value ?? ""
}

function buildTabularField(args: {
  input: StructuredSheetInput
  cell: string
  col: string
  row: number
  block: RepeatBlock
  validation: CellValidation
  optionsById: Map<string, string[]>
}): SatXlsmField | undefined {
  const { input, cell, col, row, block, validation, optionsById } = args
  const repeatIndex = Math.floor((row - block.startRow) / block.stride) + 1
  // En una ficha repetida cada renglón se rotula igual que su equivalente en la
  // primera repetición, ya sea con encabezado propio o con uno común arriba del
  // bloque. Resolver sobre esa posición evita arrastrar texto de la ficha previa.
  const referenceRow = row - (repeatIndex - 1) * block.stride
  const header = block.headerRow
    ? input.cells[`${col}${block.headerRow}`]?.trim()
    : findAboveLabel(input.cells, col, referenceRow) || findLeftLabel(input.cells, col, referenceRow)
  if (!header) return undefined

  // Cuando una repetición tiene varios renglones bajo el mismo encabezado, el
  // rótulo de la izquierda los distingue (por ejemplo "ENVIADO" y "RECIBIDO").
  const qualifier = block.headerRow ? "" : findRowQualifier(input.cells, col, referenceRow, header)
  const label = qualifier
    ? `${stripRequiredMarker(qualifier)} · ${stripRequiredMarker(header)}`
    : stripRequiredMarker(header)
  const base = buildField({
    sheetName: input.sheetName,
    cell,
    label,
    validation,
    optionsById,
    // Sólo el primer renglón hereda la obligatoriedad del encabezado: los
    // demás son capacidad adicional del formato.
    required: isRequiredLabel(header) && repeatIndex === 1,
  })

  return {
    ...base,
    id: `${slug(input.sheetName)}.${slug(block.id)}.${slug(label)}${repeatIndex === 1 ? "" : `.${repeatIndex}`}.${cell.toLowerCase()}`,
    repeatGroup: block.id,
    repeatIndex,
    repeatLimit: block.count,
  }
}

/**
 * Renglones de captura cuyo renglón previo funciona realmente como encabezado.
 * Sin esa comprobación, una validación olvidada sobre un renglón separador
 * hereda el rótulo de la captura anterior y crea un campo inexistente.
 */
function findHeadedRows(cells: CellMap, inputCells: Map<string, CellValidation>): Set<number> {
  const columnsByRow = new Map<number, string[]>()
  for (const ref of inputCells.keys()) {
    const { col, row } = splitCell(ref)
    columnsByRow.set(row, [...(columnsByRow.get(row) ?? []), col])
  }

  const headed = new Set<number>()
  for (const [row, columns] of columnsByRow) {
    const labelled = columns.filter((col) => isUsefulLabel(cells[`${col}${row - 1}`]?.trim())).length
    if (labelled >= 2) headed.add(row)
  }
  return headed
}

function buildStandaloneField(args: {
  input: StructuredSheetInput
  cell: string
  col: string
  row: number
  validation: CellValidation
  optionsById: Map<string, string[]>
  headedRows: Set<number>
}): SatXlsmField | undefined {
  const { input, cell, col, row, validation, optionsById, headedRows } = args
  const label =
    findLeftLabel(input.cells, col, row) ||
    (headedRows.has(row) ? findAboveLabel(input.cells, col, row) : "")
  if (!label) return undefined

  return buildField({
    sheetName: input.sheetName,
    cell,
    label: stripRequiredMarker(label),
    validation,
    optionsById,
    required: isRequiredLabel(label),
  })
}

/**
 * Rótulo que la plantilla coloca a la izquierda del renglón para separar dos
 * capturas que comparten encabezado. Se descarta si repite el encabezado.
 */
function findRowQualifier(cells: CellMap, col: string, row: number, header: string): string {
  const candidate = findLeftLabel(cells, col, row)
  if (!candidate) return ""
  if (normalizeLabelText(candidate) === normalizeLabelText(header)) return ""
  if (candidate.length > 40) return ""
  return candidate
}

function findLeftLabel(cells: CellMap, col: string, row: number): string {
  const colNum = columnToNumber(col)
  for (let offset = 1; offset <= 4 && colNum - offset >= 1; offset += 1) {
    const value = cells[`${numberToColumn(colNum - offset)}${row}`]?.trim()
    if (isUsefulLabel(value)) return value
  }
  return ""
}

function findAboveLabel(cells: CellMap, col: string, row: number): string {
  for (let offset = 1; offset <= 2 && row - offset >= 1; offset += 1) {
    const value = cells[`${col}${row - offset}`]?.trim()
    if (isUsefulLabel(value)) return value
  }
  return ""
}

function isUsefulLabel(value?: string): value is string {
  if (!value) return false
  const trimmed = value.trim()
  if (trimmed.length < 3) return false
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return false
  // "R01" numera un renglón del bloque; no es el rótulo de la columna.
  if (parseRowIndexToken(trimmed)) return false
  return true
}

function buildField(args: {
  sheetName: string
  cell: string
  label: string
  validation: CellValidation
  optionsById: Map<string, string[]>
  required: boolean
}): SatXlsmField {
  const { sheetName, cell, label, validation, optionsById, required } = args
  const options = validation.optionListId
    ? optionsById.get(validation.optionListId) || []
    : validation.inlineOptions || []

  return {
    id: `${slug(sheetName)}.${slug(label)}.${cell.toLowerCase()}`,
    label,
    sheetName,
    cell,
    required,
    dataType: inferDataType(validation, label),
    optionListId: validation.type === "list" ? validation.optionListId : undefined,
    options: validation.type === "list" ? options : undefined,
    source: "xlsm-data-validation",
    maxLength: inferMaxLength(validation),
    targetCell: `${sheetName}!${cell}`,
  }
}

function inferDataType(validation: CellValidation, label: string): SatXlsmField["dataType"] {
  if (validation.type === "list") return "catalogo"
  if (validation.type === "date" || validation.type === "time") return "fecha"

  const normalized = normalizeLabelText(label)
  if (validation.type === "decimal") return MONEY_LABEL.test(normalized) ? "moneda" : "numero"
  if (validation.type === "whole") return "numero"

  // textLength: el SAT captura como texto incluso montos con formato.
  if (MONEY_LABEL.test(normalized) && !COUNT_LABEL.test(normalized)) return "moneda"
  if (/^fecha\b|\bfecha de\b/.test(normalized)) return "fecha"
  return "texto"
}

function inferMaxLength(validation: CellValidation): number | undefined {
  if (validation.type !== "textlength") return undefined
  const operator = (validation.operator || "").toLowerCase()
  if (operator && operator !== "lessthanorequal" && operator !== "equal" && operator !== "lessthan") {
    return undefined
  }
  const parsed = Number(validation.formula1)
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined
  return operator === "lessthan" ? parsed - 1 : parsed
}

/**
 * Traduce los encabezados de grupo del SAT a condicionales de captura.
 *
 * Cuando un bloque se divide en variantes ("Inmueble" / "Otro") y algún
 * catálogo del mismo bloque ofrece esas mismas opciones, ese catálogo es el que
 * gobierna: las columnas de cada variante sólo aplican con su opción elegida.
 */
function applyGroupConditions(args: {
  fields: SatXlsmField[]
  blocks: RepeatBlock[]
  cells: CellMap
  sheetName: string
}): SatXlsmField[] {
  let fields = args.fields
  for (const block of args.blocks) {
    if (!block.groupRow) continue
    const groups = readGroupSpans(args.cells, block)
    if (groups.length < 2) continue
    fields = tagBlockGroups(fields, block, groups)
    fields = applyBlockGroupConditions(fields, block, groups)
  }
  return applyOtherDetailConditions(fields)
}

interface GroupSpan {
  name: string
  startCol: number
  endCol: number
}

function readGroupSpans(cells: CellMap, block: RepeatBlock): GroupSpan[] {
  const marks: Array<{ col: number; name: string }> = []
  for (const [ref, value] of Object.entries(cells)) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const parsed = splitCell(ref)
    if (parsed.row !== block.groupRow) continue
    const colNum = columnToNumber(parsed.col)
    if (colNum <= block.indexColumn) continue
    marks.push({ col: colNum, name: trimmed })
  }
  marks.sort((a, b) => a.col - b.col)

  const lastHeaderCol = block.headerRow
    ? lastLabelColumnInRow(cells, block.headerRow, block.indexColumn)
    : block.indexColumn
  return marks.map((mark, index) => ({
    name: mark.name,
    startCol: mark.col,
    endCol: index + 1 < marks.length ? marks[index + 1].col - 1 : lastHeaderCol,
  }))
}

function lastLabelColumnInRow(cells: CellMap, row: number, indexColumn: number): number {
  let last = indexColumn
  for (const [ref, value] of Object.entries(cells)) {
    if (!value.trim()) continue
    const parsed = splitCell(ref)
    if (parsed.row !== row) continue
    const colNum = columnToNumber(parsed.col)
    if (colNum > last) last = colNum
  }
  return last
}

/**
 * Marca a qué variante pertenece cada columna del bloque.
 *
 * El renglón de agrupación separa alternativas que el Anexo pide como
 * excluyentes —"Persona moral" contra "Fideicomiso"— aunque ningún catálogo las
 * gobierne. Conservar el grupo permite que el prellenado sepa que las columnas
 * del fiduciario son del fideicomiso y no del cliente.
 */
function tagBlockGroups(
  fields: SatXlsmField[],
  block: RepeatBlock,
  groups: GroupSpan[],
): SatXlsmField[] {
  return fields.map((field) => {
    if (field.repeatGroup !== block.id || field.conditionalGroup) return field
    const colNum = columnToNumber(splitCell(field.cell).col)
    const group = groups.find((item) => colNum >= item.startCol && colNum <= item.endCol)
    if (!group) return field
    return { ...field, conditionalGroup: slug(group.name) }
  })
}

function applyBlockGroupConditions(
  fields: SatXlsmField[],
  block: RepeatBlock,
  groups: GroupSpan[],
): SatXlsmField[] {
  const blockFields = fields.filter((field) => field.repeatGroup === block.id)
  const resolved = resolveBlockGroupController(blockFields, groups)
  if (!resolved) return fields
  const { controller, matchedGroups } = resolved

  // Cada renglón del bloque se rige por su propio catálogo, no por el del
  // primer renglón: la columna del controlador es la que se mantiene fija.
  const controllerColumn = columnToNumber(splitCell(controller.cell).col)
  const controllerByRow = new Map<number, SatXlsmField>()
  for (const field of blockFields) {
    if (columnToNumber(splitCell(field.cell).col) !== controllerColumn) continue
    controllerByRow.set(field.repeatIndex ?? 1, field)
  }

  return fields.map((field) => {
    if (field.repeatGroup !== block.id) return field
    const rowController = controllerByRow.get(field.repeatIndex ?? 1)
    if (!rowController || field.id === rowController.id) return field
    const colNum = columnToNumber(splitCell(field.cell).col)
    const group = groups.find((item) => colNum >= item.startCol && colNum <= item.endCol)
    if (!group) return field
    const code = matchedGroups.get(group.name)
    if (!code) return field

    const condition = [{ fieldId: rowController.id, equals: [code] }]
    return {
      ...field,
      conditionalGroup: slug(`${block.id}-${group.name}`),
      activeWhen: mergeConditions(field.activeWhen, condition),
      required: false,
      requiredWhen: field.required ? mergeConditions(field.requiredWhen, condition) : field.requiredWhen,
    }
  })
}

/**
 * El catálogo que gobierna un bloque es el que reconoce el mayor número de
 * nombres de grupo entre sus opciones (mínimo dos, para no atar columnas por
 * coincidencias sueltas).
 *
 * Caso aparte: cuando el único grupo reconocible es "Otro" —el resto del
 * renglón suele ser una nota al capturista— manda el primer catálogo del bloque
 * que ofrezca esa opción.
 */
function resolveBlockGroupController(
  blockFields: SatXlsmField[],
  groups: GroupSpan[],
): { controller: SatXlsmField; matchedGroups: Map<string, string> } | undefined {
  let best: { field: SatXlsmField; matched: Map<string, string> } | undefined
  for (const field of blockFields) {
    if (field.dataType !== "catalogo" || !field.options?.length) continue
    const matched = new Map<string, string>()
    for (const group of groups) {
      const code = matchOptionCode(field.options, group.name)
      if (code) matched.set(group.name, code)
    }
    if (matched.size < 2) continue
    if (!best || matched.size > best.matched.size) best = { field, matched }
  }
  if (best) return { controller: best.field, matchedGroups: best.matched }

  const otherGroup = groups.find((group) => OTHER_OPTION.test(normalizeLabelText(group.name)))
  if (!otherGroup) return undefined

  const catalogs = blockFields
    .filter((field) => field.dataType === "catalogo" && findOtherOptionCode(field.options || []))
    .sort((a, b) => columnToNumber(splitCell(a.cell).col) - columnToNumber(splitCell(b.cell).col))
  const controller = catalogs[0]
  if (!controller) return undefined

  const code = findOtherOptionCode(controller.options || [])
  if (!code) return undefined
  return { controller, matchedGroups: new Map([[otherGroup.name, code]]) }
}

function matchOptionCode(options: string[], groupName: string): string | undefined {
  const target = normalizeLabelText(groupName)
  if (!target) return undefined
  for (const option of options) {
    const label = normalizeLabelText(optionLabel(option))
    if (!label) continue
    if (label === target) return optionCode(option)
    // "Otro" contra "Otro (Especificar)".
    if (OTHER_OPTION.test(target) && OTHER_OPTION.test(label)) return optionCode(option)
  }
  return undefined
}

/**
 * Campos de detalle libre ligados a una opción "Otro".
 *
 * El SAT coloca la celda de descripción junto al catálogo que la habilita; se
 * activa sólo cuando la opción elegida es la de "Otro" y entonces es
 * obligatoria, tal como valida la plantilla.
 */
function applyOtherDetailConditions(fields: SatXlsmField[]): SatXlsmField[] {
  const catalogs = fields.filter(
    (field) => field.dataType === "catalogo" && findOtherOptionCode(field.options || []),
  )
  if (!catalogs.length) return fields

  return fields.map((field) => {
    if (field.dataType === "catalogo" || field.activeWhen?.length) return field
    const normalized = normalizeLabelText(field.label)
    if (!OTHER_DETAIL_LABEL.test(normalized)) return field

    const controller = findDetailController(catalogs, field)
    if (!controller) return field
    const code = findOtherOptionCode(controller.options || [])
    if (!code) return field

    const condition = [{ fieldId: controller.id, equals: [code] }]
    return {
      ...field,
      conditionalGroup: slug(`${controller.id}-otro`),
      activeWhen: mergeConditions(field.activeWhen, condition),
      required: false,
      requiredWhen: condition,
    }
  })
}

/**
 * El catálogo dueño de una descripción es el más cercano: mismo bloque y
 * renglón, o el catálogo inmediato superior en captura vertical.
 */
function findDetailController(
  catalogs: SatXlsmField[],
  detail: SatXlsmField,
): SatXlsmField | undefined {
  const detailCell = splitCell(detail.cell)
  const detailCol = columnToNumber(detailCell.col)
  const normalizedDetail = normalizeLabelText(detail.label)

  const candidates = catalogs
    .filter((candidate) => candidate.sheetName === detail.sheetName)
    .filter((candidate) => candidate.repeatGroup === detail.repeatGroup)
    .filter((candidate) => candidate.repeatIndex === detail.repeatIndex)
    .map((candidate) => {
      const cell = splitCell(candidate.cell)
      const sameRow = cell.row === detailCell.row
      const rowDistance = Math.abs(cell.row - detailCell.row)
      const colDistance = Math.abs(columnToNumber(cell.col) - detailCol)
      // La descripción suele nombrar aquello que el catálogo enumera, ya sea en
      // su etiqueta o en el nombre del propio catálogo.
      const sharesLabel = sharesSignificantWord(
        normalizedDetail,
        normalizeLabelText(`${candidate.label} ${candidate.optionListId ?? ""}`),
      )
      const distance = sameRow ? colDistance : rowDistance * 100 + colDistance
      return { candidate, distance, sharesLabel, sameRow, rowDistance }
    })
    .filter((item) => (item.sameRow ? item.distance <= 6 : item.rowDistance <= 2))
    .sort((a, b) => Number(b.sharesLabel) - Number(a.sharesLabel) || a.distance - b.distance)

  const best = candidates[0]
  if (!best) return undefined
  if (best.sharesLabel) return best.candidate
  // Sin parentesco textual basta con que sea el único catálogo con opción
  // "Otro" en el renglón, o que esté en la celda contigua.
  const sameRowCandidates = candidates.filter((item) => item.sameRow)
  if (sameRowCandidates.length === 1 && best.sameRow) return best.candidate
  return best.distance <= 2 ? best.candidate : undefined
}

function sharesSignificantWord(a: string, b: string): boolean {
  const stop = new Set([
    "de",
    "del",
    "la",
    "el",
    "los",
    "las",
    "un",
    "una",
    "y",
    "o",
    "en",
    "por",
    "para",
    "otro",
    "otra",
    "otros",
    "otras",
    "descripcion",
    "especificar",
    "especifique",
    "detalle",
    "cual",
    "indique",
    "tipo",
  ])
  const wordsA = [...new Set(a.split(" ").filter((word) => word.length > 3 && !stop.has(word)))]
  return b
    .split(" ")
    .filter((word) => word.length > 3 && !stop.has(word))
    // Comparación por prefijo para tolerar singular contra plural
    // ("activo virtual" contra "CATALOGO_DE_ACTIVOS_VIRTUALES").
    .some((word) => wordsA.some((other) => word.startsWith(other) || other.startsWith(word)))
}

function findOtherOptionCode(options: string[]): string | undefined {
  for (const option of options) {
    if (OTHER_OPTION.test(normalizeLabelText(optionLabel(option)))) return optionCode(option)
  }
  return undefined
}

function mergeConditions(
  current: SatXlsmField["activeWhen"],
  additions: NonNullable<SatXlsmField["activeWhen"]>,
): NonNullable<SatXlsmField["activeWhen"]> {
  const conditions = [...(current || [])]
  for (const addition of additions) {
    const duplicate = conditions.some(
      (condition) =>
        condition.fieldId === addition.fieldId &&
        condition.equals.length === addition.equals.length &&
        condition.equals.every((value, index) => value === addition.equals[index]),
    )
    if (!duplicate) conditions.push(addition)
  }
  return conditions
}
