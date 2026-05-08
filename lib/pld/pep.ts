import type { PepCargo, PepScreeningInput, PepScreeningResult } from "./types"

export const PEP_CARGOS_SOURCE =
  "SHCP/UIF cargos publicos politicamente expuestos: https://www.secciones.hacienda.gob.mx/work/models/SHCP/UIF/cargos_publicos_politicamente_expuestos.csv"

export const pepCargoFixtures: PepCargo[] = [
  {
    tipoAdministracionPublica: "CENTRAL",
    entidadAdministracionPublica: "No aplica",
    dependencia: "SECRETARÍA DE COMUNICACIONES Y TRANSPORTES",
    cargo: "DIRECTOR GENERAL DEL INSTITUTO MEXICANO DEL TRANSPORTE",
  },
  {
    tipoAdministracionPublica: "CENTRAL",
    entidadAdministracionPublica: "No aplica",
    dependencia: "SECRETARÍA DE ECONOMÍA",
    cargo: "MIEMBROS DEL PLENO DE LA COMISIÓN FEDERAL DE COMPETENCIA",
  },
]

export function matchPepCargo(input: PepScreeningInput, catalog: PepCargo[] = pepCargoFixtures): PepScreeningResult {
  const cargoNeedle = normalizeText(input.cargo)
  const dependenciaNeedle = normalizeText(input.dependencia)

  if (!cargoNeedle && !dependenciaNeedle) {
    return {
      status: "requiere-datos",
      requiresHumanReview: true,
      matches: [],
      source: PEP_CARGOS_SOURCE,
      checkedAt: new Date().toISOString(),
      note: "Captura cargo y dependencia para realizar validacion asistida contra el catalogo publico de cargos PEP.",
    }
  }

  const matches = catalog.filter((item) => {
    const cargoMatch = cargoNeedle ? normalizeText(item.cargo).includes(cargoNeedle) || cargoNeedle.includes(normalizeText(item.cargo)) : true
    const dependenciaMatch = dependenciaNeedle
      ? normalizeText(item.dependencia).includes(dependenciaNeedle) || dependenciaNeedle.includes(normalizeText(item.dependencia))
      : true

    return cargoMatch && dependenciaMatch
  })

  if (matches.length > 0) {
    return {
      status: "coincidencia-cargo",
      requiresHumanReview: true,
      matches,
      source: PEP_CARGOS_SOURCE,
      checkedAt: new Date().toISOString(),
      note:
        "Coincidencia con cargo publico considerado PEP. No equivale a validacion nominativa; requiere evidencia, declaracion del cliente y revision humana.",
    }
  }

  const possibleMatches = catalog.filter((item) => {
    const normalizedCargo = normalizeText(item.cargo)
    const normalizedDependency = normalizeText(item.dependencia)
    const tokenMatch = cargoNeedle
      .split(" ")
      .filter((token) => token.length > 4)
      .some((token) => normalizedCargo.includes(token))

    return tokenMatch || (dependenciaNeedle.length > 0 && normalizedDependency.includes(dependenciaNeedle))
  })

  return {
    status: possibleMatches.length > 0 ? "posible-pep" : "sin-coincidencia",
    requiresHumanReview: possibleMatches.length > 0,
    matches: possibleMatches.slice(0, 10),
    source: PEP_CARGOS_SOURCE,
    checkedAt: new Date().toISOString(),
    note:
      possibleMatches.length > 0
        ? "Existen coincidencias parciales; documentar criterio de descarte o confirmacion."
        : "Sin coincidencia en el catalogo publico de cargos. Esto no descarta una consulta formal UIF cuando sea aplicable.",
  }
}

export function normalizeText(value?: string): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
}
