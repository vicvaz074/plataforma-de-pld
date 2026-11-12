import { normalizeExpedienteIdentifiers, validateExpedienteIdentifiers, type ExpedienteIdentifiers } from "./expediente-eui"

export function resolveOperationClientIdentity(input: {
  expedienteId?: string | null; clientId?: string | null; tipoCliente: string; rfcText?: string;
  identifiers?: Partial<ExpedienteIdentifiers> | null;
  persona?: { rfc?: string; nif?: string; curp?: string } | null;
}) {
  const text = input.rfcText?.trim().toUpperCase() || ""
  const identifiers = normalizeExpedienteIdentifiers({
    rfc: input.persona?.rfc || input.identifiers?.rfc || (/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(text) ? text : ""),
    curp: input.persona?.curp || input.identifiers?.curp || (/^[A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(text) ? text : ""),
    nif: input.persona?.nif || input.identifiers?.nif || (/extranj|visitante/.test(input.tipoCliente) && text && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(text) ? text : ""),
  })
  const error = validateExpedienteIdentifiers(identifiers, input.tipoCliente.startsWith("pf"))
  const key = input.expedienteId ? `expediente:${input.expedienteId}` : input.clientId ? `cliente:${input.clientId}` : ""
  return { identifiers, key, error: error || (!key ? "Selecciona un cliente existente o crea explícitamente uno nuevo." : null) }
}
