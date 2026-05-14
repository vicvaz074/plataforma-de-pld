export function parseCurrentConagoGovernors(content, asOfDate = new Date().toISOString().slice(0, 10)) {
  const markdownGovernors = parseMarkdownGovernors(content, asOfDate)
  if (markdownGovernors.length) return markdownGovernors

  const text = decodeHtml(stripTags(content))
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  const governors = []
  const asOf = new Date(`${asOfDate}T00:00:00.000Z`)

  for (let index = 0; index < lines.length - 2; index += 1) {
    const nameLine = lines[index].replace(/^#+\s*/, "")
    const dateLine = lines[index + 1]
    const stateLine = lines[index + 2]
    const period = parsePeriod(dateLine)

    if (!period || !isLikelyPersonName(nameLine) || !isWithinPeriod(asOf, period)) continue

    governors.push({
      name: cleanName(nameLine),
      state: stateLine,
      periodStart: period.start,
      periodEnd: period.end,
    })
  }

  return uniqueByNameAndState(governors)
}

function parseMarkdownGovernors(content, asOfDate) {
  const asOf = new Date(`${asOfDate}T00:00:00.000Z`)
  const governors = []
  const matches = String(content ?? "").matchAll(
    /####\s+\[([^\]]+)\]\([^)]+\)\s+(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})[\s\S]*?\[([A-ZÁÉÍÓÚÜÑ][^\]]+)\]\(https?:\/\/www\.conago\.org\.mx\/entidadesfederativas\/detalle\/[^)]+\)/g,
  )

  for (const match of matches) {
    const period = parsePeriod(`${match[2]} a ${match[3]}`)
    if (!period || !isWithinPeriod(asOf, period)) continue
    governors.push({
      name: cleanName(match[1]),
      state: match[4].trim(),
      periodStart: period.start,
      periodEnd: period.end,
    })
  }

  return uniqueByNameAndState(governors)
}

function parsePeriod(value) {
  const match = String(value ?? "").match(/(\d{2})\/(\d{2})\/(\d{4})\s+a\s+(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return null
  const [, startDay, startMonth, startYear, endDay, endMonth, endYear] = match
  return {
    start: `${startYear}-${startMonth}-${startDay}`,
    end: `${endYear}-${endMonth}-${endDay}`,
  }
}

function isWithinPeriod(date, period) {
  return date >= new Date(`${period.start}T00:00:00.000Z`) && date <= new Date(`${period.end}T23:59:59.999Z`)
}

function isLikelyPersonName(value) {
  return /[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+/.test(value) && !/LISTADO|GOBERNADORES|TODOS|Image/i.test(value)
}

function cleanName(value) {
  return String(value ?? "")
    .replace(/^(?:Mtra?|Mtro|Dra?|Dr|Lic|C\.P|Ing|Arq)\.?\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

function uniqueByNameAndState(governors) {
  const map = new Map()
  for (const governor of governors) {
    map.set(`${normalize(governor.name)}-${normalize(governor.state)}`, governor)
  }
  return [...map.values()]
}

function stripTags(value) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
}

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&aacute;/g, "á")
    .replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&Aacute;/g, "Á")
    .replace(/&Eacute;/g, "É")
    .replace(/&Iacute;/g, "Í")
    .replace(/&Oacute;/g, "Ó")
    .replace(/&Uacute;/g, "Ú")
    .replace(/&ntilde;/g, "ñ")
    .replace(/&Ntilde;/g, "Ñ")
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
}
