export interface ExpedientePersona {
  id?: string
  tipo?: string
  rolRelacion?: string
  denominacion?: string
  nombre?: string
  apellidoPaterno?: string
  apellidoMaterno?: string
  fechaConstitucion?: string
  fechaNacimiento?: string
  rfc?: string
  curp?: string
  pais?: string
  giro?: string
  representante?: {
    nombre?: string
    apellidoPaterno?: string
    apellidoMaterno?: string
    fechaNacimiento?: string
    rfc?: string
    curp?: string
  }
  domicilio?: {
    ambito?: string
    pais?: string
    entidad?: string
    municipio?: string
    colonia?: string
    codigoPostal?: string
    calle?: string
    numeroExterior?: string
    numeroInterior?: string
    ciudad?: string
  }
  contacto?: {
    clavePais?: string
    telefono?: string
    correo?: string
  }
  identificacion?: {
    tipo?: string
    numero?: string
    pais?: string
    fechaVencimiento?: string
  }
  participacion?: {
    porcentajeCapital?: string
    origenRecursos?: string
    esPep?: string
    detallePep?: string
  }
}

export interface ExpedienteDetalle {
  rfc: string
  nombre: string
  tipoCliente?: string
  detalleTipoCliente?: string
  claveSujetoObligado?: string
  claveActividadVulnerable?: string
  identificacion?: Record<string, string>
  datosFiscales?: Record<string, string>
  perfilOperaciones?: Record<string, string>
  documentacion?: Record<string, unknown>
  personas?: ExpedientePersona[]
  actualizadoEn?: string
}
