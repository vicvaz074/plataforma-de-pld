export type RespuestaBinaria = "si" | "no"

export interface ExpedientePersona {
  id: string
  tipo: "persona_fisica" | "persona_moral" | "fideicomiso"
  denominacion: string
  fechaConstitucion: string
  rfc: string
  curp: string
  pais: string
  giro: string
  rolRelacion: string
  representante: {
    nombre: string
    apellidoPaterno: string
    apellidoMaterno: string
    fechaNacimiento: string
    rfc: string
    curp: string
  }
  domicilio: {
    ambito: "nacional" | "extranjero"
    pais: string
    entidad: string
    municipio: string
    colonia: string
    codigoPostal: string
    calle: string
    numeroExterior: string
    numeroInterior: string
  }
  contacto: {
    conoceTelefono: RespuestaBinaria
    conocePaisTelefono: RespuestaBinaria
    clavePais: string
    telefono: string
    correo: string
  }
  identificacion: {
    tipo: string
    numero: string
    pais: string
    fechaVencimiento: string
  }
  participacion: {
    porcentajeCapital: string
    origenRecursos: string
    esPep: RespuestaBinaria
    detallePep: string
  }
}

export interface ExpedienteDetalle {
  rfc: string
  nombre: string
  tipoCliente: string
  detalleTipoCliente?: string
  responsable?: string
  claveSujetoObligado?: string
  claveActividadVulnerable?: string
  identificacion?: Record<string, string>
  datosFiscales?: Record<string, string>
  perfilOperaciones?: Record<string, string>
  documentacion?: Record<string, string>
  personas: ExpedientePersona[]
  actualizadoEn?: string
}

export function sanitizeExpedienteDetalle(raw: any): ExpedienteDetalle | null {
  if (!raw || typeof raw !== "object") return null

  const rfc = typeof raw.rfc === "string" ? raw.rfc.trim().toUpperCase() : ""
  const nombre = typeof raw.nombre === "string" ? raw.nombre.trim() : ""
  if (!rfc || !nombre) return null

  const personasRaw = Array.isArray(raw.personas) ? raw.personas : []
  const personas: ExpedientePersona[] = personasRaw
    .map((persona) => sanitizePersona(persona))
    .filter((persona): persona is ExpedientePersona => Boolean(persona))

  return {
    rfc,
    nombre,
    tipoCliente: typeof raw.tipoCliente === "string" ? raw.tipoCliente : "",
    detalleTipoCliente:
      typeof raw.detalleTipoCliente === "string" && raw.detalleTipoCliente.trim() !== ""
        ? raw.detalleTipoCliente.trim()
        : undefined,
    responsable: typeof raw.responsable === "string" ? raw.responsable : undefined,
    claveSujetoObligado:
      typeof raw.claveSujetoObligado === "string" ? raw.claveSujetoObligado.trim().toUpperCase() : undefined,
    claveActividadVulnerable:
      typeof raw.claveActividadVulnerable === "string"
        ? raw.claveActividadVulnerable.trim().toUpperCase()
        : undefined,
    identificacion: isRecordOfString(raw.identificacion) ? raw.identificacion : undefined,
    datosFiscales: isRecordOfString(raw.datosFiscales) ? raw.datosFiscales : undefined,
    perfilOperaciones: isRecordOfString(raw.perfilOperaciones) ? raw.perfilOperaciones : undefined,
    documentacion: isRecordOfString(raw.documentacion) ? raw.documentacion : undefined,
    personas,
    actualizadoEn: typeof raw.actualizadoEn === "string" ? raw.actualizadoEn : undefined,
  }
}

function sanitizePersona(raw: any): ExpedientePersona | null {
  if (!raw || typeof raw !== "object") return null

  const id = typeof raw.id === "string" ? raw.id : crypto.randomUUID?.() ?? `${Date.now()}`
  const tipo =
    raw.tipo === "persona_fisica" || raw.tipo === "persona_moral" || raw.tipo === "fideicomiso"
      ? raw.tipo
      : "persona_moral"

  const domicilioRaw = raw.domicilio ?? {}
  const contactoRaw = raw.contacto ?? {}
  const representanteRaw = raw.representante ?? {}
  const identificacionRaw = raw.identificacion ?? {}
  const participacionRaw = raw.participacion ?? {}

  return {
    id,
    tipo,
    denominacion: typeof raw.denominacion === "string" ? raw.denominacion : "",
    fechaConstitucion: typeof raw.fechaConstitucion === "string" ? raw.fechaConstitucion : "",
    rfc: typeof raw.rfc === "string" ? raw.rfc : "",
    curp: typeof raw.curp === "string" ? raw.curp : "",
    pais: typeof raw.pais === "string" ? raw.pais : "",
    giro: typeof raw.giro === "string" ? raw.giro : "",
    rolRelacion: typeof raw.rolRelacion === "string" ? raw.rolRelacion : "",
    representante: {
      nombre: typeof representanteRaw.nombre === "string" ? representanteRaw.nombre : "",
      apellidoPaterno:
        typeof representanteRaw.apellidoPaterno === "string" ? representanteRaw.apellidoPaterno : "",
      apellidoMaterno:
        typeof representanteRaw.apellidoMaterno === "string" ? representanteRaw.apellidoMaterno : "",
      fechaNacimiento:
        typeof representanteRaw.fechaNacimiento === "string" ? representanteRaw.fechaNacimiento : "",
      rfc: typeof representanteRaw.rfc === "string" ? representanteRaw.rfc : "",
      curp: typeof representanteRaw.curp === "string" ? representanteRaw.curp : "",
    },
    domicilio: {
      ambito: domicilioRaw.ambito === "extranjero" ? "extranjero" : "nacional",
      pais: typeof domicilioRaw.pais === "string" ? domicilioRaw.pais : "",
      entidad: typeof domicilioRaw.entidad === "string" ? domicilioRaw.entidad : "",
      municipio: typeof domicilioRaw.municipio === "string" ? domicilioRaw.municipio : "",
      colonia: typeof domicilioRaw.colonia === "string" ? domicilioRaw.colonia : "",
      codigoPostal: typeof domicilioRaw.codigoPostal === "string" ? domicilioRaw.codigoPostal : "",
      calle: typeof domicilioRaw.calle === "string" ? domicilioRaw.calle : "",
      numeroExterior:
        typeof domicilioRaw.numeroExterior === "string" ? domicilioRaw.numeroExterior : "",
      numeroInterior:
        typeof domicilioRaw.numeroInterior === "string" ? domicilioRaw.numeroInterior : "",
    },
    contacto: {
      conoceTelefono: contactoRaw.conoceTelefono === "no" ? "no" : "si",
      conocePaisTelefono: contactoRaw.conocePaisTelefono === "no" ? "no" : "si",
      clavePais: typeof contactoRaw.clavePais === "string" ? contactoRaw.clavePais : "",
      telefono: typeof contactoRaw.telefono === "string" ? contactoRaw.telefono : "",
      correo: typeof contactoRaw.correo === "string" ? contactoRaw.correo : "",
    },
    identificacion: {
      tipo: typeof identificacionRaw.tipo === "string" ? identificacionRaw.tipo : "",
      numero: typeof identificacionRaw.numero === "string" ? identificacionRaw.numero : "",
      pais: typeof identificacionRaw.pais === "string" ? identificacionRaw.pais : "",
      fechaVencimiento:
        typeof identificacionRaw.fechaVencimiento === "string" ? identificacionRaw.fechaVencimiento : "",
    },
    participacion: {
      porcentajeCapital:
        typeof participacionRaw.porcentajeCapital === "string" ? participacionRaw.porcentajeCapital : "",
      origenRecursos:
        typeof participacionRaw.origenRecursos === "string" ? participacionRaw.origenRecursos : "",
      esPep: participacionRaw.esPep === "si" ? "si" : "no",
      detallePep: typeof participacionRaw.detallePep === "string" ? participacionRaw.detallePep : "",
    },
  }
}

function isRecordOfString(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object") return false
  return Object.values(value).every((item) => typeof item === "string")
}
