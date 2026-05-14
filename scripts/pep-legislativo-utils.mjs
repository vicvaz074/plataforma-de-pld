export function parseSenadoMembers(content) {
  const text = decodeHtml(stripTags(content))
  const senMatches = [...text.matchAll(/\bSen\.\s+([A-ZÁÉÍÓÚÜÑ][^\n\r#\[]+?)(?=\s{2,}|\n|Av\.|$)/gi)]
  const tableMatches = [
    ...String(content ?? "").matchAll(/\b\d{1,3}\[([A-ZÁÉÍÓÚÜÑ][^\]]+?,\s+[A-ZÁÉÍÓÚÜÑ][^\]]+?)\]\(https?:\/\/www\.senado\.gob\.mx\/66\/senador\/\d+\)/g),
    ...text.matchAll(
      /\b\d{1,3}\s+(?:\|\s*)?([A-ZÁÉÍÓÚÜÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ.'’\s-]+,\s+[A-ZÁÉÍÓÚÜÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ.'’\s-]+?)(?=\s+(?:\||MORENA|PAN|PRI|PVEM|PT|MC|Sin Grupo|Junta|Secretario|Presidente|Integrante|$))/g,
    ),
  ]

  return uniqueMembers(
    [...senMatches, ...tableMatches].map((match) => ({
      name: cleanPersonName(match[1]),
      chamber: "senado",
    })),
  )
}

export function parseDiputadosMembers(content) {
  const anchorMatches = [...String(content ?? "").matchAll(/curricula\.php\?dipt=\d+[^>]*>\s*\d{1,3}\s+([^<]+?)\s*<\/a>/gi)]
  const text = decodeHtml(stripTags(content))
  const textMatches = [...text.matchAll(/\b\d{1,3}\s+([A-ZÁÉÍÓÚÜÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ.'’\s-]+?)(?=\s+(?:Aguascalientes|Baja California|Baja California Sur|Campeche|Chiapas|Chihuahua|Ciudad de México|Coahuila|Colima|Durango|Guanajuato|Guerrero|Hidalgo|Jalisco|México|Michoacán|Morelos|Nayarit|Nuevo León|Oaxaca|Puebla|Querétaro|Queretaro|Quintana Roo|Qintana Roo|San Luis Potosí|Sinaloa|Sonora|Tabasco|Tamaulipas|Tlaxcala|Veracruz|Yucatán|Zacatecas)\b)/g)]

  return uniqueMembers(
    [...anchorMatches, ...textMatches].map((match) => ({
      name: cleanPersonName(match[1]),
      chamber: "diputados",
    })),
  )
}

function uniqueMembers(members) {
  const byName = new Map()
  for (const member of members) {
    if (!member.name || member.name.length < 6) continue
    const key = normalizeName(member.name)
    if (!byName.has(key)) byName.set(key, member)
  }
  return [...byName.values()]
}

function cleanPersonName(value) {
  const cleaned = String(value ?? "")
    .replace(/^Sen\.\s+/i, "")
    .replace(/\]\([^)]+\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/[|•]+$/g, "")
    .trim()

  return cleaned.includes(",") ? reverseCatalogName(cleaned) : cleaned
}

function reverseCatalogName(value) {
  const [apellidos, nombres] = String(value).split(",").map((part) => part.trim())
  return [nombres, apellidos].filter(Boolean).join(" ")
}

function stripTags(value) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
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
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
}
