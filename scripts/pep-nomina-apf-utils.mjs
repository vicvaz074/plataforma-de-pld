export function parseNominaApfRecord(row, indexes, fallbackInstitution = "") {
  const nombre = cell(row, indexes.nombre)
  const fallback = String(fallbackInstitution ?? "").trim()

  if (!row.length) {
    return {
      nombre: "",
      institucion: fallback,
      puesto: "",
    }
  }

  const salaryStartIndex = findSalaryStartIndex(row)
  const middleEnd = salaryStartIndex > 0 ? salaryStartIndex : row.length
  const middleCells = row.slice(Math.max(1, indexes.institucion), middleEnd)
  const splitIndex = findInstitutionSplitIndex(middleCells, fallback)
  const puestoCells = splitIndex >= 0 ? middleCells.slice(splitIndex) : row.slice(indexes.puesto, middleEnd)

  return {
    nombre,
    institucion: fallback || cell(row, indexes.institucion),
    puesto: puestoCells.join(",").trim(),
  }
}

export function parseCsv(text) {
  const rows = []
  let cellValue = ""
  let row = []
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]

    if (char === '"' && quoted && next === '"') {
      cellValue += '"'
      index += 1
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === "," && !quoted) {
      row.push(cellValue)
      cellValue = ""
      continue
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1
      row.push(cellValue)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      cellValue = ""
      continue
    }
    cellValue += char
  }

  if (cellValue || row.length) {
    row.push(cellValue)
    if (row.some((value) => value.trim())) rows.push(row)
  }

  return rows
}

export function normalizeNominaValue(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bPORTUARI[AO]\b/gi, "PORTUARIO")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
}

function findSalaryStartIndex(row) {
  for (let index = row.length - 2; index >= 1; index -= 1) {
    if (isNumeric(row[index]) && isNumeric(row[index + 1])) return index
  }
  return -1
}

function findInstitutionSplitIndex(cells, fallbackInstitution) {
  const expected = normalizeNominaValue(fallbackInstitution)
  if (!expected) return -1

  for (let index = 1; index <= cells.length; index += 1) {
    const candidate = normalizeNominaValue(cells.slice(0, index).join(","))
    if (candidate === expected) return index
  }

  return -1
}

function isNumeric(value) {
  return /^-?\d+(\.\d+)?$/.test(String(value ?? "").trim())
}

function cell(row, index) {
  return index >= 0 ? String(row[index] ?? "").trim() : ""
}
