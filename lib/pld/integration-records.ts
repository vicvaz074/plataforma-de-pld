import {
  createLegacyExpedienteId,
  EXPEDIENTE_EUI_SCHEMA_VERSION,
  getPrimaryExpedienteIdentifier,
  normalizeExpedienteIdentifiers,
  type ExpedienteIdentifiers,
} from "./expediente-eui"
import type { PldTenant } from "./types"
import { summarizeStoredEbrQuestionnaire } from "./ebr-questionnaire"

export const PLD_INTEGRATION_EVENT = "pld-integration-change"
export const EXPEDIENTES_STORAGE_KEY = "kyc_expedientes_detalle"
export const EBR_EVALUATIONS_STORAGE_KEY = "ebr_evaluaciones"
export type IntegrationRecord = Record<string, any>
export interface IntegrationStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const record = (value: unknown): IntegrationRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as IntegrationRecord : {}
const text = (value: unknown) => typeof value === "string" ? value.trim() : ""

export function notifyPldIntegrationChange(key: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PLD_INTEGRATION_EVENT, { detail: { key } }))
  }
}

/** Read failures must never become an empty collection that is written back. */
export function readExpedienteRecords(storage: Pick<IntegrationStorage, "getItem">): IntegrationRecord[] {
  const raw = storage.getItem(EXPEDIENTES_STORAGE_KEY)
  if (!raw) return []
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error("El almacenamiento de expedientes no contiene una lista válida.")
  if (parsed.some((item) => !item || typeof item !== "object" || Array.isArray(item))) {
    throw new Error("Hay un registro de expediente inválido. Revisa la copia local antes de guardar.")
  }
  return parsed as IntegrationRecord[]
}

export interface IntegrationClient {
  id: string
  expedienteId?: string
  nombre: string
  rfc: string
  identifiers: ExpedienteIdentifiers
  identifier: string
  tipoCliente?: string
  actualizadoEn?: string
  sujetoObligadoId?: string
  sujetoObligadoRfc?: string
}

export function getIntegrationClient(value: unknown): IntegrationClient | null {
  const raw = record(value)
  const eui = record(raw.expedienteEui)
  const persona = record(raw.personaAviso)
  const cliente = record(eui.cliente)
  const rawIdentifiers = record(raw.identifiers)
  const euiIdentifiers = record(eui.identifiers)
  const identifiers = normalizeExpedienteIdentifiers({
    rfc: rawIdentifiers.rfc ?? euiIdentifiers.rfc ?? persona.rfc ?? cliente.rfc ?? raw.rfc,
    nif: rawIdentifiers.nif ?? euiIdentifiers.nif ?? persona.nif ?? cliente.nif,
    curp: rawIdentifiers.curp ?? euiIdentifiers.curp ?? persona.curp ?? cliente.curp,
  })
  const identifier = getPrimaryExpedienteIdentifier(identifiers)
  const expedienteId = text(raw.expedienteId || raw.expedienteReferenciado || eui.expedienteId)
  const nombre = text(raw.nombre || raw.cliente || cliente.denominacion || cliente.nombre) ||
    [cliente.nombres, cliente.apellidoPaterno, cliente.apellidoMaterno].filter(Boolean).join(" ")
  if (!expedienteId && !identifier && !nombre) return null
  return {
    id: expedienteId || createLegacyExpedienteId(identifier, nombre),
    expedienteId: expedienteId || undefined,
    nombre: nombre || identifier,
    rfc: identifiers.rfc,
    identifiers,
    identifier,
    tipoCliente: text(raw.tipoCliente) || undefined,
    actualizadoEn: text(raw.actualizadoEn) || undefined,
    sujetoObligadoId: text(raw.sujetoObligadoId || eui.sujetoObligadoId) || undefined,
    sujetoObligadoRfc: text(raw.sujetoObligadoRfc || eui.sujetoObligadoRfc) || undefined,
  }
}

export function matchesIntegrationClient(value: unknown, client: IntegrationClient): boolean {
  const candidate = getIntegrationClient(value)
  if (!candidate) return false
  if (candidate.expedienteId && client.expedienteId) return candidate.expedienteId === client.expedienteId
  return Boolean(candidate.identifier && candidate.identifier === client.identifier)
}

export function buildIntegrationClients(expedientes: unknown[], operations: unknown[]): IntegrationClient[] {
  const clients = expedientes.map(getIntegrationClient).filter((item): item is IntegrationClient => Boolean(item))
  for (const operation of operations) {
    const client = getIntegrationClient(operation)
    if (client && !clients.some((existing) => matchesIntegrationClient(operation, existing))) clients.push(client)
  }
  return clients
}

export class ExpedienteConflictError extends Error {
  constructor() {
    super("El expediente cambió en otra vista. Vuelve a abrirlo antes de guardar para conservar esos cambios.")
    this.name = "ExpedienteConflictError"
  }
}

export function mergeExpedienteRecords(
  records: IntegrationRecord[],
  incoming: IntegrationRecord,
  options: { expectedUpdatedAt?: string } = {},
): IntegrationRecord[] {
  const id = text(incoming.expedienteId)
  if (!id) throw new Error("El expediente requiere un ID estable para guardar.")
  let index = records.findIndex((item) => text(item.expedienteId || item.expedienteEui?.expedienteId) === id)
  if (index < 0) {
    // Only an unambiguous record without an ID may be migrated by identifier.
    const legacy = records.map((item, candidateIndex) => ({ item, candidateIndex })).filter(({ item }) => {
      if (text(item.expedienteId || item.expedienteEui?.expedienteId)) return false
      return getIntegrationClient(item)?.id === id
    })
    if (legacy.length === 1) index = legacy[0].candidateIndex
  }
  const previous = index >= 0 ? records[index] : undefined
  if (previous && options.expectedUpdatedAt !== undefined && text(previous.actualizadoEn) !== options.expectedUpdatedAt) {
    throw new ExpedienteConflictError()
  }
  const merged = {
    ...previous,
    ...incoming,
    schemaVersion: Math.max(EXPEDIENTE_EUI_SCHEMA_VERSION, Number(previous?.schemaVersion) || 0, Number(incoming.schemaVersion) || 0),
    expedienteEui: incoming.expedienteEui ? {
      ...record(previous?.expedienteEui),
      ...record(incoming.expedienteEui),
      schemaVersion: Math.max(EXPEDIENTE_EUI_SCHEMA_VERSION, Number(previous?.expedienteEui?.schemaVersion) || 0, Number(incoming.expedienteEui?.schemaVersion) || 0),
    } : previous?.expedienteEui,
  }
  return index < 0 ? [...records, merged] : records.map((item, i) => i === index ? merged : item)
}

export function saveExpedienteRecord(storage: IntegrationStorage, incoming: IntegrationRecord, options: { expectedUpdatedAt?: string } = {}) {
  const merged = mergeExpedienteRecords(readExpedienteRecords(storage), incoming, options)
  storage.setItem(EXPEDIENTES_STORAGE_KEY, JSON.stringify(merged))
  notifyPldIntegrationChange(EXPEDIENTES_STORAGE_KEY)
  return merged
}

function euiAddress(previous: unknown, next: unknown) {
  const address = record(next)
  return {
    codigoPostal: "", tipoVialidad: "", nombreVialidad: "", numeroExterior: "", numeroInterior: "", colonia: "", alcaldia: "", ciudad: "", entidad: "", pais: "",
    ...record(previous), ...address,
    ...(address.calle !== undefined ? { nombreVialidad: address.calle } : {}),
    ...(address.municipio !== undefined ? { alcaldia: address.municipio } : {}),
  }
}

function euiContact(previous: unknown, next: unknown) {
  const contact = record(next)
  const old = record(previous)
  return {
    ...record({ lada: "", telefonoFijo: "", extension: "", ladaMovil: "", telefonoMovil: "", correo: "" }),
    ...old, ...contact,
    ...(contact.clavePais !== undefined ? { pais: contact.clavePais } : {}),
    ...(contact.telefono !== undefined
      ? old.telefonoMovil ? { telefonoMovil: contact.telefono } : { telefonoFijo: contact.telefono }
      : {}),
  }
}

/** Update both the reusable summaries and the EUI form; its documents stay intact. */
export function buildExpedienteFromActo(baseRaw: IntegrationRecord, input: {
  expedienteId: string
  identifiers: Partial<ExpedienteIdentifiers>
  persona: IntegrationRecord
  beneficiariosControladores: IntegrationRecord[]
  operationContext: IntegrationRecord
  updatedAt: string
}): IntegrationRecord {
  const eui = record(baseRaw.expedienteEui)
  const cliente = record(eui.cliente)
  const persona = input.persona
  const identifiers = normalizeExpedienteIdentifiers(input.identifiers)
  const nombre = text(persona.denominacion) || [persona.nombre, persona.apellidoPaterno, persona.apellidoMaterno].filter(Boolean).join(" ")
  const personas = Array.isArray(baseRaw.personas) ? baseRaw.personas : []
  const oldBeneficiaries = [eui.beneficiario1, eui.beneficiario2]
  const beneficiaries = input.beneficiariosControladores.map((beneficiary, i) => {
    const previous = record(oldBeneficiaries[i])
    return {
      apellidoPaterno: "", apellidoMaterno: "", fechaNacimiento: "", paisNacimiento: "", curp: "", rfc: "", porcentajeParticipacion: "", resideExtranjero: "",
      ...previous, ...beneficiary,
      nombres: beneficiary.nombre ?? beneficiary.nombres ?? previous.nombres ?? "",
      paisNacionalidad: beneficiary.pais ?? beneficiary.paisNacionalidad ?? previous.paisNacionalidad ?? "",
      domicilio: euiAddress(previous.domicilio, beneficiary.domicilio),
      contacto: euiContact(previous.contacto, beneficiary.contacto),
      domicilioCorrespondencia: euiAddress(previous.domicilioCorrespondencia, undefined),
      identificacion: { tipo: "", numero: "", autoridad: "", vigencia: "", ...record(previous.identificacion) },
    }
  })
  const representative = record(persona.representante)
  const matchingPerson = personas.findIndex((item, i) => persona.id ? item.id === persona.id : i === 0)
  const emptyBeneficiary = {
    nombres: "", apellidoPaterno: "", apellidoMaterno: "", fechaNacimiento: "", paisNacionalidad: "", paisNacimiento: "", curp: "", rfc: "", porcentajeParticipacion: "", resideExtranjero: "",
    domicilio: euiAddress(undefined, undefined), contacto: euiContact(undefined, undefined), domicilioCorrespondencia: euiAddress(undefined, undefined),
    identificacion: { tipo: "", numero: "", autoridad: "", vigencia: "" },
  }
  return {
    ...baseRaw,
    schemaVersion: Math.max(EXPEDIENTE_EUI_SCHEMA_VERSION, Number(baseRaw.schemaVersion) || 0),
    expedienteId: input.expedienteId,
    identifiers,
    rfc: identifiers.rfc,
    nombre,
    personas: matchingPerson >= 0 ? personas.map((item, i) => i === matchingPerson ? { ...item, ...persona } : item) : [...personas, persona],
    beneficiariosControladores: input.beneficiariosControladores,
    ocupacion: persona.giro !== undefined ? { code: persona.giro, label: persona.giro } : baseRaw.ocupacion,
    operationContext: { ...record(baseRaw.operationContext), ...input.operationContext },
    actualizadoEn: input.updatedAt,
    expedienteEui: {
      fechaRegistro: input.updatedAt.slice(0, 10),
      tipoExpediente: persona.tipo === "persona_fisica" ? "persona_fisica" : persona.tipo === "fideicomiso" ? "fideicomiso" : "persona_moral",
      tipoCliente: baseRaw.tipoCliente,
      activityKey: baseRaw.activityKey,
      activityLabel: baseRaw.activityLabel,
      sujetoObligadoId: baseRaw.sujetoObligadoId,
      sujetoObligadoNombre: baseRaw.sujetoObligadoNombre,
      sujetoObligadoRfc: baseRaw.sujetoObligadoRfc,
      documentacion: {},
      identificacionRepresentante: { tipo: "", numero: "", autoridad: "", vigencia: "" },
      identificacionCliente: { tipo: "", numero: "", autoridad: "", vigencia: "" },
      actuaRepresentante: "",
      domicilioCorrespondencia: euiAddress(undefined, undefined),
      ...eui,
      schemaVersion: Math.max(EXPEDIENTE_EUI_SCHEMA_VERSION, Number(eui.schemaVersion) || 0),
      expedienteId: input.expedienteId,
      identifiers,
      ...input.operationContext,
      cliente: {
        ...record({ denominacion: "", nombres: "", nombre: "", apellidoPaterno: "", apellidoMaterno: "", paisNacimiento: "", ocupacion: "", actividad: "" }),
        ...cliente, ...identifiers,
        ...(persona.tipo === "persona_fisica" ? {
          nombres: persona.nombre ?? cliente.nombres,
          apellidoPaterno: persona.apellidoPaterno ?? cliente.apellidoPaterno,
          apellidoMaterno: persona.apellidoMaterno ?? cliente.apellidoMaterno,
          ocupacion: persona.giro ?? cliente.ocupacion,
        } : { denominacion: nombre, nombre, actividad: persona.giro ?? cliente.actividad }),
        fechaNacimiento: persona.fechaNacimiento ?? cliente.fechaNacimiento ?? "",
        fechaConstitucion: persona.fechaConstitucion ?? cliente.fechaConstitucion ?? "",
        paisNacionalidad: persona.pais ?? cliente.paisNacionalidad ?? "",
      },
      domicilioCliente: euiAddress(eui.domicilioCliente, persona.domicilio),
      contactoCliente: euiContact(eui.contactoCliente, persona.contacto),
      representante: {
        nombre: "", apellidoPaterno: "", apellidoMaterno: "", rfc: "", cargo: "",
        ...record(eui.representante), ...representative,
        nombres: representative.nombre ?? representative.nombres ?? eui.representante?.nombres ?? "",
        paisNacionalidad: representative.pais ?? representative.paisNacionalidad ?? eui.representante?.paisNacionalidad ?? "",
      },
      ...(persona.tipo === "fideicomiso" ? { fideicomiso: {
        ...record(eui.fideicomiso),
        fiduciarioDenominacion: persona.fiduciarioDenominacion ?? eui.fideicomiso?.fiduciarioDenominacion,
        fiduciarioRfc: persona.fiduciarioRfc ?? eui.fideicomiso?.fiduciarioRfc,
        identificador: persona.identificadorFideicomiso ?? eui.fideicomiso?.identificador,
      } } : {}),
      beneficiario1: beneficiaries[0] ?? emptyBeneficiary,
      beneficiario2: beneficiaries[1] ?? null,
    },
  }
}

export interface IntegrationSubject {
  id: string
  nombre: string
  rfc: string
  clave?: string
  activityKeys: string[]
  source: "registro" | "tenant" | "expediente"
  aliasIds?: string[]
}

export function readPldSubjects(storage: Pick<IntegrationStorage, "getItem">): IntegrationSubject[] {
  const subjects: IntegrationSubject[] = []
  const read = (key: string) => {
    try { return JSON.parse(storage.getItem(key) || "null") } catch { return null }
  }
  const add = (subject: IntegrationSubject) => {
    if (!subject.id && !subject.rfc) return
    const current = subjects.find((item) => Boolean(subject.id && item.id === subject.id) || Boolean(subject.rfc && item.rfc === subject.rfc))
    if (!current) subjects.push(subject)
    else {
      current.rfc ||= subject.rfc
      current.nombre ||= subject.nombre
      current.aliasIds = Array.from(new Set([...(current.aliasIds ?? []), subject.id].filter((id) => id && id !== current.id)))
      current.activityKeys = Array.from(new Set([...current.activityKeys, ...subject.activityKeys]))
    }
  }
  const registro = record(read("registro-sat-data"))
  for (const value of Array.isArray(registro.sujetosRegistrados) ? registro.sujetosRegistrados : []) {
    const subject = record(value)
    add({ id: text(subject.id), nombre: text(subject.nombre), rfc: text(subject.identificacion?.rfc).toUpperCase(), source: "registro",
      activityKeys: (Array.isArray(subject.actividades) ? subject.actividades : []).map((activity: unknown) => text(record(activity).actividadKey)).filter(Boolean) })
  }
  const tenants = record(read("pld-tenants"))
  for (const value of Array.isArray(tenants.tenants) ? tenants.tenants : []) {
    const subject = record(value)
    add({ id: text(subject.id), nombre: text(subject.razonSocial), rfc: text(subject.rfc).toUpperCase(), source: "tenant",
      activityKeys: (Array.isArray(subject.actividades) ? subject.actividades : []).map((activity: unknown) => text(record(activity).actividadKey)).filter(Boolean) })
  }
  const expedientes = read(EXPEDIENTES_STORAGE_KEY)
  for (const value of Array.isArray(expedientes) ? expedientes : []) {
    const raw = record(value)
    const eui = record(raw.expedienteEui)
    add({ id: text(raw.sujetoObligadoId || eui.sujetoObligadoId), nombre: text(raw.sujetoObligadoNombre || eui.sujetoObligadoNombre),
      rfc: text(raw.sujetoObligadoRfc || eui.sujetoObligadoRfc).toUpperCase(), clave: text(raw.claveSujetoObligado) || undefined,
      activityKeys: [text(raw.activityKey || eui.activityKey)].filter(Boolean), source: "expediente" })
  }
  return subjects
}

export function resolvePldSubject(snapshot: { id?: string; rfc?: string; nombre?: string; clave?: string }, subjects: IntegrationSubject[]) {
  const match = subjects.find((item) => Boolean(snapshot.id && (item.id === snapshot.id || item.aliasIds?.includes(snapshot.id)))) ??
    subjects.find((item) => Boolean(snapshot.rfc && item.rfc === snapshot.rfc.toUpperCase()))
  return match ? { ...snapshot, id: match.id || snapshot.id, rfc: match.rfc || snapshot.rfc, nombre: match.nombre || snapshot.nombre, clave: match.clave || snapshot.clave } : { ...snapshot }
}

export function matchesIntegrationSubject(value: unknown, subject: Pick<IntegrationSubject, "id" | "rfc" | "aliasIds">): boolean {
  const raw = record(value)
  const snapshot = record(raw.sujetoObligado)
  const eui = record(raw.expedienteEui)
  const id = text(snapshot.id || raw.sujetoObligadoId || eui.sujetoObligadoId || raw.tenantId)
  const rfc = text(snapshot.rfc || raw.sujetoObligadoRfc || eui.sujetoObligadoRfc || raw.tenantRfc).toUpperCase()
  return Boolean(subject.id && (id === subject.id || subject.aliasIds?.includes(id))) || Boolean(subject.rfc && rfc === subject.rfc)
}

/** Structural adapter only: do not invent registration, dates, policies or people. */
export function integrationSubjectToTenant(subject: IntegrationSubject): PldTenant {
  return {
    id: subject.id || subject.rfc,
    schemaVersion: 1,
    rfc: subject.rfc,
    razonSocial: subject.nombre,
    representanteCumplimiento: { nombre: "" },
    responsablesInternos: [],
    actividades: subject.activityKeys.map((actividadKey) => ({ actividadKey, altaSppldActiva: false })),
    manual: { version: "", vigenteDesde: "", proximaRevision: "" },
    ebr: { metodologiaVersion: "", ultimaRevision: "", proximaRevision: "" },
    policies: { conservaAnios: 0, noGuardarEfirma: true, requiereCotejo: false },
  }
}

/** Support the legacy array and the current per-client map without dropping either. */
export function normalizeEbrEvaluations(raw: unknown): IntegrationRecord[] {
  const entries = Array.isArray(raw) ? raw.map((value) => ["", value] as const) : Object.entries(record(raw))
  return entries.flatMap(([key, value]) => {
    const item = record(value)
    if (!Object.keys(item).length) return []
    const identity = text(item.expedienteId || item.clientId || item.rfc || key)
    return identity ? [{ ...item, clientId: text(item.clientId) || identity, rfc: text(item.rfc), notes: text(item.notes), updatedAt: text(item.updatedAt),
      riskSummary: item.riskSummary ?? summarizeStoredEbrQuestionnaire(item),
    }] : []
  })
}

export function findClientEbrEvaluation(evaluations: IntegrationRecord[], client: IntegrationClient | null) {
  if (!client) return null
  const exact = evaluations.filter((item) => item.expedienteId === client.id || item.clientId === client.id)
  const matching = exact.length ? exact : evaluations.filter((item) => !item.expedienteId && Boolean(client.identifier && (item.rfc === client.identifier || item.clientId === client.identifier)))
  return matching.sort((a, b) => text(b.updatedAt).localeCompare(text(a.updatedAt)))[0] ?? null
}

export function saveClientEbrEvaluation(storage: IntegrationStorage, client: IntegrationClient, evaluation: IntegrationRecord | null) {
  const raw = storage.getItem(EBR_EVALUATIONS_STORAGE_KEY)
  const parsed = raw ? JSON.parse(raw) : {}
  if (parsed === null || typeof parsed !== "object") throw new Error("El almacenamiento EBR no tiene un formato válido.")
  const evaluations = normalizeEbrEvaluations(parsed)
  const existing = findClientEbrEvaluation(evaluations, client)
  const next = evaluations.filter((item) => item !== existing)
  if (evaluation) next.push({ ...existing, ...evaluation, clientId: client.id, expedienteId: client.expedienteId, rfc: client.rfc, identifiers: client.identifiers })
  const mapped: Record<string, IntegrationRecord> = {}
  for (const [index, item] of next.entries()) {
    const base = text(item.expedienteId || item.clientId || item.rfc) || `legacy-${index}`
    const key = Object.hasOwn(mapped, base) ? `${base}:history:${index}` : base
    mapped[key] = item
  }
  storage.setItem(EBR_EVALUATIONS_STORAGE_KEY, JSON.stringify(mapped))
  notifyPldIntegrationChange(EBR_EVALUATIONS_STORAGE_KEY)
  return mapped
}
