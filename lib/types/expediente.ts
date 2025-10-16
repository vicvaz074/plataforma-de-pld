export type RespuestaBinaria = "si" | "no"

export interface PersonaReportada {
  id: string
  tipo: "persona_moral" | "persona_fisica"
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

export type DocumentStatus = "pendiente" | "en-proceso" | "completo"

export interface ExpedienteDetallado {
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
  documentacion?: Record<string, DocumentStatus>
  personas?: PersonaReportada[]
  actualizadoEn?: string
}
