import { ExpedientePersona } from "./expedientes"

export type PersonaTipoAviso = "persona_fisica" | "persona_moral" | "fideicomiso"

export interface PersonaFisicaForm {
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string
  fechaNacimiento: string
  rfc: string
  curp: string
  paisNacionalidad: string
  paisNacimiento: string
  actividadEconomica: string
  tipoIdentificacion: string
  identificacionOtro: string
  autoridadIdentificacion: string
  numeroIdentificacion: string
}

export interface PersonaMoralForm {
  denominacion: string
  fechaConstitucion: string
  rfc: string
  paisNacionalidad: string
  giroMercantil: string
  representante: PersonaFisicaForm
}

export interface PersonaFideicomisoForm {
  denominacion: string
  rfc: string
  identificador: string
  apoderado: PersonaFisicaForm
}

export interface PersonaAvisoForm {
  tipo: PersonaTipoAviso
  fisica: PersonaFisicaForm
  moral: PersonaMoralForm
  fideicomiso: PersonaFideicomisoForm
}

export interface DomicilioNacionalForm {
  colonia: string
  calle: string
  numeroExterior: string
  numeroInterior: string
  codigoPostal: string
  estado: string
  municipio: string
}

export interface DomicilioExtranjeroForm {
  pais: string
  estadoProvincia: string
  ciudad: string
  colonia: string
  calle: string
  numeroExterior: string
  numeroInterior: string
  codigoPostal: string
}

export interface DomicilioAvisoForm {
  tipo: "nacional" | "extranjero"
  nacional: DomicilioNacionalForm
  extranjero: DomicilioExtranjeroForm
}

export interface TelefonoAvisoForm {
  clavePais: string
  numero: string
  correo: string
}

export interface PersonaAvisoSeccion {
  persona: PersonaAvisoForm
  domicilio: DomicilioAvisoForm
  telefono: TelefonoAvisoForm
}

export interface ModificatorioAvisoForm {
  habilitado: boolean
  folio: string
  descripcion: string
}

export interface AlertaAvisoForm {
  habilitado: boolean
  tipo: string
  descripcion: string
}

export interface InstrumentoDetalleForm {
  institucion: string
  numeroCuenta: string
  numeroDocumento: string
  numeroTarjeta: string
  paisOrigen: string
  claveRastreo: string
  folioInterno: string
}

export interface LiquidacionNumerarioForm {
  fechaPago: string
  formaPago: string
  instrumentoMonetario: string
  moneda: string
  monto: string
  detalle: InstrumentoDetalleForm
}

export interface LiquidacionEspecieForm {
  valorBien: string
  moneda: string
  tipoBien: string
  tipoInmueble: string
  codigoPostal: string
  folioReal: string
  descripcionBien: string
}

export interface CaracteristicasInmuebleForm {
  tipoInmueble: string
  valorPactado: string
  colonia: string
  calle: string
  numeroExterior: string
  numeroInterior: string
  codigoPostal: string
  dimensionTerreno: string
  dimensionConstruido: string
  folioReal: string
}

export interface ContratoInstrumentoForm {
  numeroInstrumento: string
  fechaInstrumento: string
  notario: string
  entidad: string
  valorAvaluo: string
}

export interface DetalleOperacionForm {
  fechaOperacion: string
  figuraCliente: string
  figuraSujetoObligado: string
  tipoSucursal: "propia" | "operador"
  sucursalPropia: {
    codigoPostal: string
    nombre: string
  }
  sucursalOperador: {
    nombre: string
    codigoPostal: string
    establecimiento: string
  }
  tipoOperacion: string
  lineaNegocio: string
  medioOperacion: string
  numeroBoletos: string
  contraparte: PersonaAvisoSeccion
  caracteristicasInmueble: CaracteristicasInmuebleForm
  contratoInstrumento: ContratoInstrumentoForm
  liquidacionNumerario: LiquidacionNumerarioForm
  liquidacionEspecie: LiquidacionEspecieForm
}

export interface InmuebleAvisoForm {
  mesReportado: string
  claveEntidadColegiada: string
  claveSujetoObligado: string
  claveActividad: string
  referenciaAviso: string
  modificatorio: ModificatorioAvisoForm
  prioridad: string
  alerta: AlertaAvisoForm
  personaAviso: PersonaAvisoSeccion
  beneficiario: {
    habilitado: boolean
    datos: PersonaAvisoSeccion
  }
  detalleOperacion: DetalleOperacionForm
}

export interface CodigoPostalInfo {
  estado: string
  municipio: string
  colonias: string[]
}

export function createInmuebleAvisoFormDefaults(): InmuebleAvisoForm {
  return {
    mesReportado: "",
    claveEntidadColegiada: "",
    claveSujetoObligado: "",
    claveActividad: "",
    referenciaAviso: "",
    modificatorio: {
      habilitado: false,
      folio: "",
      descripcion: "",
    },
    prioridad: "1",
    alerta: {
      habilitado: false,
      tipo: "",
      descripcion: "",
    },
    personaAviso: createPersonaAvisoSeccion(),
    beneficiario: {
      habilitado: false,
      datos: createPersonaAvisoSeccion(),
    },
    detalleOperacion: {
      fechaOperacion: "",
      figuraCliente: "",
      figuraSujetoObligado: "",
      tipoSucursal: "propia",
      sucursalPropia: { codigoPostal: "", nombre: "" },
      sucursalOperador: { nombre: "", codigoPostal: "", establecimiento: "" },
      tipoOperacion: "",
      lineaNegocio: "",
      medioOperacion: "",
      numeroBoletos: "",
      contraparte: createPersonaAvisoSeccion(),
      caracteristicasInmueble: {
        tipoInmueble: "",
        valorPactado: "",
        colonia: "",
        calle: "",
        numeroExterior: "",
        numeroInterior: "",
        codigoPostal: "",
        dimensionTerreno: "",
        dimensionConstruido: "",
        folioReal: "",
      },
      contratoInstrumento: {
        numeroInstrumento: "",
        fechaInstrumento: "",
        notario: "",
        entidad: "",
        valorAvaluo: "",
      },
      liquidacionNumerario: {
        fechaPago: "",
        formaPago: "",
        instrumentoMonetario: "",
        moneda: "MXN",
        monto: "",
        detalle: {
          institucion: "",
          numeroCuenta: "",
          numeroDocumento: "",
          numeroTarjeta: "",
          paisOrigen: "",
          claveRastreo: "",
          folioInterno: "",
        },
      },
      liquidacionEspecie: {
        valorBien: "",
        moneda: "MXN",
        tipoBien: "",
        tipoInmueble: "",
        codigoPostal: "",
        folioReal: "",
        descripcionBien: "",
      },
    },
  }
}

function createPersonaAvisoSeccion(): PersonaAvisoSeccion {
  return {
    persona: {
      tipo: "persona_moral",
      fisica: {
        nombre: "",
        apellidoPaterno: "",
        apellidoMaterno: "",
        fechaNacimiento: "",
        rfc: "",
        curp: "",
        paisNacionalidad: "MX",
        paisNacimiento: "MX",
        actividadEconomica: "",
        tipoIdentificacion: "",
        identificacionOtro: "",
        autoridadIdentificacion: "",
        numeroIdentificacion: "",
      },
      moral: {
        denominacion: "",
        fechaConstitucion: "",
        rfc: "",
        paisNacionalidad: "MX",
        giroMercantil: "",
        representante: {
          nombre: "",
          apellidoPaterno: "",
          apellidoMaterno: "",
          fechaNacimiento: "",
          rfc: "",
          curp: "",
          paisNacionalidad: "MX",
          paisNacimiento: "MX",
          actividadEconomica: "",
          tipoIdentificacion: "",
          identificacionOtro: "",
          autoridadIdentificacion: "",
          numeroIdentificacion: "",
        },
      },
      fideicomiso: {
        denominacion: "",
        rfc: "",
        identificador: "",
        apoderado: {
          nombre: "",
          apellidoPaterno: "",
          apellidoMaterno: "",
          fechaNacimiento: "",
          rfc: "",
          curp: "",
          paisNacionalidad: "MX",
          paisNacimiento: "MX",
          actividadEconomica: "",
          tipoIdentificacion: "",
          identificacionOtro: "",
          autoridadIdentificacion: "",
          numeroIdentificacion: "",
        },
      },
    },
    domicilio: {
      tipo: "nacional",
      nacional: {
        colonia: "",
        calle: "",
        numeroExterior: "",
        numeroInterior: "",
        codigoPostal: "",
        estado: "",
        municipio: "",
      },
      extranjero: {
        pais: "",
        estadoProvincia: "",
        ciudad: "",
        colonia: "",
        calle: "",
        numeroExterior: "",
        numeroInterior: "",
        codigoPostal: "",
      },
    },
    telefono: {
      clavePais: "MX",
      numero: "",
      correo: "",
    },
  }
}

export function normalizeCodigoPostal(codigo: string) {
  const digits = codigo.replace(/\D/g, "")
  if (digits.length >= 5) {
    return digits.slice(0, 12)
  }
  return digits
}

function formatFecha(value: string) {
  if (!value) return ""
  return value.replace(/-/g, "")
}

function splitNombreCompleto(nombre: string) {
  const partes = nombre.trim().split(/\s+/)
  if (partes.length === 0) {
    return { nombre: "", apellidoPaterno: "", apellidoMaterno: "" }
  }
  if (partes.length === 1) {
    return { nombre: partes[0], apellidoPaterno: "", apellidoMaterno: "" }
  }
  if (partes.length === 2) {
    return { nombre: partes[0], apellidoPaterno: partes[1], apellidoMaterno: "" }
  }
  const apellidoMaterno = partes.pop() ?? ""
  const apellidoPaterno = partes.pop() ?? ""
  const nombreRestante = partes.join(" ")
  return { nombre: nombreRestante, apellidoPaterno, apellidoMaterno }
}

export function mergeExpedientePersona(
  seccion: PersonaAvisoSeccion,
  persona: ExpedientePersona,
): PersonaAvisoSeccion {
  const base = structuredClone(seccion)
  if (persona.tipo === "persona_fisica") {
    base.persona.tipo = "persona_fisica"
    const nombres = splitNombreCompleto(persona.denominacion)
    base.persona.fisica = {
      ...base.persona.fisica,
      nombre: nombres.nombre || base.persona.fisica.nombre,
      apellidoPaterno: nombres.apellidoPaterno || base.persona.fisica.apellidoPaterno,
      apellidoMaterno: nombres.apellidoMaterno || base.persona.fisica.apellidoMaterno,
      fechaNacimiento: formatFecha(persona.fechaConstitucion) || base.persona.fisica.fechaNacimiento,
      rfc: persona.rfc || base.persona.fisica.rfc,
      curp: persona.curp || base.persona.fisica.curp,
      paisNacionalidad: persona.pais || base.persona.fisica.paisNacionalidad,
      paisNacimiento: persona.pais || base.persona.fisica.paisNacimiento,
      actividadEconomica: persona.giro || base.persona.fisica.actividadEconomica,
      tipoIdentificacion: persona.identificacion.tipo || base.persona.fisica.tipoIdentificacion,
      autoridadIdentificacion:
        persona.identificacion.pais || base.persona.fisica.autoridadIdentificacion,
      numeroIdentificacion:
        persona.identificacion.numero || base.persona.fisica.numeroIdentificacion,
      identificacionOtro: base.persona.fisica.identificacionOtro,
    }
  } else if (persona.tipo === "fideicomiso") {
    base.persona.tipo = "fideicomiso"
    base.persona.fideicomiso = {
      ...base.persona.fideicomiso,
      denominacion: persona.denominacion || base.persona.fideicomiso.denominacion,
      rfc: persona.rfc || base.persona.fideicomiso.rfc,
      identificador: persona.giro || base.persona.fideicomiso.identificador,
      apoderado: {
        ...base.persona.fideicomiso.apoderado,
        ...splitNombreCompleto(persona.representante.nombre),
        fechaNacimiento:
          formatFecha(persona.representante.fechaNacimiento) ||
          base.persona.fideicomiso.apoderado.fechaNacimiento,
        rfc: persona.representante.rfc || base.persona.fideicomiso.apoderado.rfc,
        curp: persona.representante.curp || base.persona.fideicomiso.apoderado.curp,
        paisNacionalidad:
          persona.pais || base.persona.fideicomiso.apoderado.paisNacionalidad,
        paisNacimiento:
          persona.pais || base.persona.fideicomiso.apoderado.paisNacimiento,
        actividadEconomica:
          persona.giro || base.persona.fideicomiso.apoderado.actividadEconomica,
        tipoIdentificacion:
          persona.identificacion.tipo || base.persona.fideicomiso.apoderado.tipoIdentificacion,
        autoridadIdentificacion:
          persona.identificacion.pais || base.persona.fideicomiso.apoderado.autoridadIdentificacion,
        numeroIdentificacion:
          persona.identificacion.numero || base.persona.fideicomiso.apoderado.numeroIdentificacion,
        identificacionOtro: base.persona.fideicomiso.apoderado.identificacionOtro,
      },
    }
  } else {
    base.persona.tipo = "persona_moral"
    base.persona.moral = {
      ...base.persona.moral,
      denominacion: persona.denominacion || base.persona.moral.denominacion,
      fechaConstitucion: formatFecha(persona.fechaConstitucion) || base.persona.moral.fechaConstitucion,
      rfc: persona.rfc || base.persona.moral.rfc,
      paisNacionalidad: persona.pais || base.persona.moral.paisNacionalidad,
      giroMercantil: persona.giro || base.persona.moral.giroMercantil,
      representante: {
        ...base.persona.moral.representante,
        ...splitNombreCompleto(persona.representante.nombre),
        fechaNacimiento:
          formatFecha(persona.representante.fechaNacimiento) ||
          base.persona.moral.representante.fechaNacimiento,
        rfc: persona.representante.rfc || base.persona.moral.representante.rfc,
        curp: persona.representante.curp || base.persona.moral.representante.curp,
        paisNacionalidad:
          persona.pais || base.persona.moral.representante.paisNacionalidad,
        paisNacimiento:
          persona.pais || base.persona.moral.representante.paisNacimiento,
        actividadEconomica:
          persona.giro || base.persona.moral.representante.actividadEconomica,
        tipoIdentificacion:
          persona.identificacion.tipo || base.persona.moral.representante.tipoIdentificacion,
        autoridadIdentificacion:
          persona.identificacion.pais || base.persona.moral.representante.autoridadIdentificacion,
        numeroIdentificacion:
          persona.identificacion.numero || base.persona.moral.representante.numeroIdentificacion,
        identificacionOtro: base.persona.moral.representante.identificacionOtro,
      },
    }
  }

  if (persona.domicilio.ambito === "extranjero") {
    base.domicilio.tipo = "extranjero"
    base.domicilio.extranjero = {
      ...base.domicilio.extranjero,
      pais: persona.domicilio.pais || base.domicilio.extranjero.pais,
      estadoProvincia: persona.domicilio.entidad || base.domicilio.extranjero.estadoProvincia,
      ciudad: persona.domicilio.municipio || base.domicilio.extranjero.ciudad,
      colonia: persona.domicilio.colonia || base.domicilio.extranjero.colonia,
      calle: persona.domicilio.calle || base.domicilio.extranjero.calle,
      numeroExterior: persona.domicilio.numeroExterior || base.domicilio.extranjero.numeroExterior,
      numeroInterior: persona.domicilio.numeroInterior || base.domicilio.extranjero.numeroInterior,
      codigoPostal: persona.domicilio.codigoPostal || base.domicilio.extranjero.codigoPostal,
    }
  } else {
    base.domicilio.tipo = "nacional"
    base.domicilio.nacional = {
      ...base.domicilio.nacional,
      colonia: persona.domicilio.colonia || base.domicilio.nacional.colonia,
      calle: persona.domicilio.calle || base.domicilio.nacional.calle,
      numeroExterior: persona.domicilio.numeroExterior || base.domicilio.nacional.numeroExterior,
      numeroInterior: persona.domicilio.numeroInterior || base.domicilio.nacional.numeroInterior,
      codigoPostal: persona.domicilio.codigoPostal || base.domicilio.nacional.codigoPostal,
      estado: persona.domicilio.entidad || base.domicilio.nacional.estado,
      municipio: persona.domicilio.municipio || base.domicilio.nacional.municipio,
    }
  }

  base.telefono = {
    ...base.telefono,
    clavePais: persona.contacto.clavePais || base.telefono.clavePais,
    numero: persona.contacto.telefono || base.telefono.numero,
    correo: persona.contacto.correo || base.telefono.correo,
  }

  return base
}
