import type { SatXlsmField } from "./types"

const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
const personKeys: Record<string, string> = {
  "nombre(s)": "nombre", nombre: "nombre", "apellido paterno": "apellidoPaterno", "apellido materno": "apellidoMaterno",
  "fecha de nacimiento": "fechaNacimiento", "fecha de constitucion": "fechaConstitucion", rfc: "rfc", nif: "nif", curp: "curp",
  "pais de nacionalidad": "pais", "denominacion o razon social": "denominacion", "razon social": "denominacion",
  "actividad economica": "giro", "giro mercantil": "giro", "denominacion fiduciario": "fiduciarioDenominacion",
  "identificador del fideicomiso": "identificadorFideicomiso",
}
const addressKeys: Record<string, string> = {"codigo postal": "codigoPostal", estado: "entidad", "estado o provincia": "entidad", "municipio/delegacion": "municipio", "ciudad o poblacion": "ciudad", colonia: "colonia", "calle, avenida o via": "calle", "numero exterior": "numeroExterior", "numero interior": "numeroInterior", pais: "pais"}
const contactKeys: Record<string, string> = {"numero de telefono": "telefono", "correo electronico": "correo", "clave del pais": "clavePais"}

/** Only the first client row is reusable in EUI. Subject RFC, other people and property addresses are not client data. */
export function applySatPersonEdit<T extends {tipo: string}>(persona: T, field: SatXlsmField, value: string): T {
  if (field.sectionKind !== "persona_objeto" || (field.repeatIndex || 1) !== 1) return persona
  const scope = normalized(`${field.repeatGroup || ""} ${field.id}`)
  const label = normalized(field.label)
  const current = persona as T & Record<string, any>
  const nested = (key: string, property: string, extra: Record<string, string> = {}) => ({...persona, [key]: {...current[key], ...extra, [property]: value}})
  if (/domicilio/.test(scope) && addressKeys[label]) return nested("domicilio", addressKeys[label], {ambito: /internacional|extranjero/.test(scope) ? "extranjero" : "nacional"})
  if (/representante|representate|apoderado/.test(scope) && personKeys[label]) return nested("representante", personKeys[label])
  if ((/contacto|clave-del-pais/.test(scope)) && contactKeys[label]) return nested("contacto", contactKeys[label])
  if (!/persona-fisica|persona-moral|persona_objeto_pf|persona_objeto_pm|persona_aviso\.(pf|pm|fideicomiso)/.test(scope)) return persona
  const property = personKeys[label]
  if (!property) return persona
  // Fiduciary RFC uses the adjacent column in the PM/fideicomiso block, not the client's RFC.
  if (label === "rfc" && current.tipo === "fideicomiso" && /\.h\d+$/.test(field.id)) return {...persona, fiduciarioRfc: value}
  return {...persona, [property]: value}
}

export function applySatBeneficiaryEdit<T extends {tipo: string}>(beneficiary: T, field: SatXlsmField, value: string): T {
  if (field.sectionKind !== "beneficiario_controlador" || (field.repeatIndex || 1) !== 1) return beneficiary
  const property = personKeys[normalized(field.label)]
  if (!property) return beneficiary
  return {...beneficiary, [property === "denominacion" ? "nombre" : property]: value}
}
