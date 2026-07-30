export type RegistroSubjectType = "none" | "fisica" | "moral" | "fideicomiso"

export type RegistroChecklistStatus = "complete" | "missing" | "not-applicable"

export interface RegistroChecklistIdentificacion {
  fecha?: string
  rfc?: string
  nombre?: string
  apellidoPaterno?: string
  paisNacionalidad?: string
  paisNacimiento?: string
  curp?: string
}

export interface RegistroChecklistContacto {
  nombreCompleto?: string
  claveLada?: string
  telefonoFijo?: string
  telefonoMovil?: string
  correo?: string
}

export interface RegistroChecklistDomicilio {
  codigoPostal?: string
  tipoVialidad?: string
  nombreVialidad?: string
  numeroExterior?: string
  colonia?: string
  alcaldia?: string
  entidad?: string
  pais?: string
}

export interface RegistroChecklistActividad {
  actividadKey?: string
  fechaPrimera?: string
  cuentaRegistro?: "" | "si" | "no"
  tipoDocumento?: string
  autoridadDocumento?: string
  folioDocumento?: string
  periodoDocumento?: string
  domicilio?: RegistroChecklistDomicilio
}

export interface RegistroChecklistRepresentante {
  nombre?: string
  apellidoPaterno?: string
  fechaNacimiento?: string
  rfc?: string
  curp?: string
  paisNacionalidad?: string
  fechaDesignacion?: string
  fechaAceptacion?: string
  contacto?: RegistroChecklistContacto
  certificacion?: {
    respuesta?: "" | "si" | "no"
    tipoDocumento?: string
    autoridadDocumento?: string
    folioDocumento?: string
    periodoDocumento?: string
  }
}

export interface RegistroChecklistInput {
  tipoSujeto: RegistroSubjectType
  identificacion: RegistroChecklistIdentificacion
  contactos: RegistroChecklistContacto[]
  actividades: RegistroChecklistActividad[]
  representante?: RegistroChecklistRepresentante | null
  documentos: {
    detalle?: unknown
    acuse?: unknown
    aceptacion?: unknown
  }
  actividadLabels?: Record<string, string>
}

export interface RegistroChecklistItem {
  id: string
  sectionId: "identificacion" | "contacto" | "actividades" | "representante" | "documentos"
  label: string
  description: string
  required: boolean
  status: RegistroChecklistStatus
  source: string
  valueSummary: string
  missingFields: string[]
  targetId?: string
}

export interface RegistroChecklistSection {
  id: RegistroChecklistItem["sectionId"]
  title: string
  description: string
  items: RegistroChecklistItem[]
}

export interface RegistroChecklistResult {
  sections: RegistroChecklistSection[]
  items: RegistroChecklistItem[]
  summary: {
    total: number
    complete: number
    missing: number
    notApplicable: number
    progress: number
  }
  dataComplete: boolean
  documentsComplete: boolean
  overallComplete: boolean
}

export function separateLegacyRegistroDocuments<T extends { id?: string }>(
  documents: { detalle: T | null; acuse: T | null; aceptacion: T | null },
): {
  detalle: T | null
  acuse: T | null
  aceptacion: T | null
} {
  if (
    documents.acuse &&
    documents.aceptacion &&
    documents.acuse.id &&
    documents.acuse.id === documents.aceptacion.id
  ) {
    return { ...documents, aceptacion: null }
  }
  return documents
}

interface RequiredValue {
  label: string
  value: unknown
  targetId: string
}

const hasValue = (value: unknown) =>
  typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined

const summarize = (values: unknown[]) =>
  values
    .filter(hasValue)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join(" · ")

const buildRequiredItem = ({
  id,
  sectionId,
  label,
  description,
  source,
  values,
  valueSummary,
}: {
  id: string
  sectionId: RegistroChecklistItem["sectionId"]
  label: string
  description: string
  source: string
  values: RequiredValue[]
  valueSummary?: string
}): RegistroChecklistItem => {
  const missing = values.filter(({ value }) => !hasValue(value))
  return {
    id,
    sectionId,
    label,
    description,
    required: true,
    status: missing.length === 0 ? "complete" : "missing",
    source,
    valueSummary: missing.length === 0 ? valueSummary ?? summarize(values.map(({ value }) => value)) : "",
    missingFields: missing.map(({ label: fieldLabel }) => fieldLabel),
    targetId: missing[0]?.targetId ?? values[0]?.targetId,
  }
}

const buildConditionalItem = ({
  active,
  ...item
}: Parameters<typeof buildRequiredItem>[0] & { active: boolean }): RegistroChecklistItem => {
  if (active) return buildRequiredItem(item)
  return {
    id: item.id,
    sectionId: item.sectionId,
    label: item.label,
    description: item.description,
    required: false,
    status: "not-applicable",
    source: item.source,
    valueSummary: "No aplica según la respuesta capturada.",
    missingFields: [],
    targetId: item.values[0]?.targetId,
  }
}

const buildDocumentItem = ({
  id,
  label,
  description,
  document,
  targetId,
  applicable = true,
}: {
  id: string
  label: string
  description: string
  document: unknown
  targetId: string
  applicable?: boolean
}): RegistroChecklistItem => {
  if (!applicable) {
    return {
      id,
      sectionId: "documentos",
      label,
      description,
      required: false,
      status: "not-applicable",
      source: "Tipo de sujeto obligado",
      valueSummary: "No aplica para este tipo de sujeto.",
      missingFields: [],
      targetId,
    }
  }

  return {
    id,
    sectionId: "documentos",
    label,
    description,
    required: true,
    status: document ? "complete" : "missing",
    source: "Documentos del alta",
    valueSummary: document ? "Archivo cargado" : "",
    missingFields: document ? [] : [label],
    targetId,
  }
}

const sectionMetadata: Record<
  RegistroChecklistItem["sectionId"],
  Pick<RegistroChecklistSection, "title" | "description">
> = {
  identificacion: {
    title: "Identificación del sujeto obligado",
    description: "Se valida directamente con la información capturada en el alta.",
  },
  contacto: {
    title: "Contacto principal",
    description: "Se reconoce cualquiera de las personas de contacto que esté completa.",
  },
  actividades: {
    title: "Actividades vulnerables",
    description: "Cada actividad y su domicilio se revisan por separado.",
  },
  representante: {
    title: "Representante encargado de cumplimiento",
    description: "Aplica a personas morales y fideicomisos.",
  },
  documentos: {
    title: "Documentos del alta",
    description: "Detalle, acuse y aceptación se controlan como evidencias distintas.",
  },
}

const buildSections = (items: RegistroChecklistItem[]): RegistroChecklistSection[] =>
  (Object.keys(sectionMetadata) as RegistroChecklistItem["sectionId"][])
    .map((id) => ({
      id,
      ...sectionMetadata[id],
      items: items.filter((item) => item.sectionId === id),
    }))
    .filter((section) => section.items.length > 0)

/**
 * Evaluador UI del alta SAT.
 *
 * Fuente consultada el 2026-07-30: Resolución de Alta y Registro, anexos A y B,
 * publicada en el portal oficial de Actividades Vulnerables del SAT.
 * https://www.sat.gob.mx/minisitio/ActividadesVulnerables/documentos/Normateca/Nacional/LFPIORPI/ResolucionAltayRegistro.pdf
 *
 * El evaluador no sustituye al formato oficial: únicamente refleja, sin
 * duplicar captura, los campos que esta pantalla ya conserva.
 */
export function evaluateRegistroChecklist(input: RegistroChecklistInput): RegistroChecklistResult {
  if (input.tipoSujeto === "none") {
    return {
      sections: [],
      items: [],
      summary: { total: 0, complete: 0, missing: 0, notApplicable: 0, progress: 0 },
      dataComplete: false,
      documentsComplete: false,
      overallComplete: false,
    }
  }

  const items: RegistroChecklistItem[] = []
  const identificacion = input.identificacion
  const esFisica = input.tipoSujeto === "fisica"
  const requiereRepresentante = input.tipoSujeto === "moral" || input.tipoSujeto === "fideicomiso"

  items.push(
    buildRequiredItem({
      id: "identificacion-principal",
      sectionId: "identificacion",
      label: "Identificación principal",
      description: esFisica
        ? "Nombre, apellido, fecha de nacimiento y RFC."
        : "Denominación, fecha de constitución y RFC.",
      source: "Datos de identificación",
      values: [
        {
          label: esFisica ? "Fecha de nacimiento" : "Fecha de constitución",
          value: identificacion.fecha,
          targetId: "fecha-identificacion",
        },
        {
          label: esFisica ? "Nombre" : "Denominación",
          value: identificacion.nombre,
          targetId: "nombre-sujeto",
        },
        ...(esFisica
          ? [
              {
                label: "Apellido paterno",
                value: identificacion.apellidoPaterno,
                targetId: "apellido-paterno",
              },
            ]
          : []),
        { label: "RFC", value: identificacion.rfc, targetId: "rfc-sujeto" },
      ],
      valueSummary: summarize([identificacion.nombre, identificacion.apellidoPaterno, identificacion.rfc]),
    }),
  )

  if (esFisica) {
    items.push(
      buildRequiredItem({
        id: "identificacion-origen",
        sectionId: "identificacion",
        label: "Nacionalidad y nacimiento",
        description: "País de nacionalidad y país de nacimiento de la persona física.",
        source: "Datos de identificación",
        values: [
          {
            label: "País de nacionalidad",
            value: identificacion.paisNacionalidad,
            targetId: "pais-nacionalidad",
          },
          {
            label: "País de nacimiento",
            value: identificacion.paisNacimiento,
            targetId: "pais-nacimiento",
          },
        ],
      }),
    )
    items.push({
      id: "identificacion-curp",
      sectionId: "identificacion",
      label: "CURP",
      description: "Se reconoce cuando fue proporcionada; no bloquea el alta si no se cuenta con ella.",
      required: false,
      status: hasValue(identificacion.curp) ? "complete" : "not-applicable",
      source: "Datos de identificación",
      valueSummary: hasValue(identificacion.curp) ? String(identificacion.curp).trim() : "No proporcionada.",
      missingFields: [],
      targetId: "curp-sujeto",
    })
  }

  const contactoCompleto = input.contactos.find(
    (contacto) =>
      hasValue(contacto.nombreCompleto) &&
      hasValue(contacto.correo) &&
      (hasValue(contacto.telefonoFijo) || hasValue(contacto.telefonoMovil)),
  )
  const primerContactoParcial =
    input.contactos.find(
      (contacto) =>
        hasValue(contacto.nombreCompleto) ||
        hasValue(contacto.correo) ||
        hasValue(contacto.telefonoFijo) ||
        hasValue(contacto.telefonoMovil),
    ) ?? input.contactos[0]
  const contactoBase = contactoCompleto ?? primerContactoParcial
  const contactoIndex = contactoBase ? Math.max(0, input.contactos.indexOf(contactoBase)) : 0
  const contactoEvaluado = contactoBase ?? {}
  const telefonoContacto = contactoEvaluado.telefonoFijo || contactoEvaluado.telefonoMovil

  items.push(
    buildRequiredItem({
      id: "contacto-principal",
      sectionId: "contacto",
      label: "Persona de contacto",
      description: "Nombre, correo y al menos un teléfono fijo o móvil.",
      source: `Persona de contacto ${contactoIndex + 1}`,
      values: [
        {
          label: "Nombre completo",
          value: contactoEvaluado.nombreCompleto,
          targetId: `contacto-nombre-${contactoIndex}`,
        },
        {
          label: "Correo electrónico",
          value: contactoEvaluado.correo,
          targetId: `contacto-correo-${contactoIndex}`,
        },
        {
          label: "Teléfono fijo o móvil",
          value: telefonoContacto,
          targetId: `contacto-movil-${contactoIndex}`,
        },
      ],
      valueSummary: summarize([contactoEvaluado.nombreCompleto, contactoEvaluado.correo, telefonoContacto]),
    }),
  )

  const actividades = input.actividades.length > 0 ? input.actividades : [{}]
  actividades.forEach((actividad, index) => {
    const numero = index + 1
    const actividadLabel =
      (actividad.actividadKey && input.actividadLabels?.[actividad.actividadKey]) || actividad.actividadKey || ""

    items.push(
      buildRequiredItem({
        id: `actividad-${index}-declaracion`,
        sectionId: "actividades",
        label: `Actividad ${numero}: declaración`,
        description: "Fracción, fecha de inicio y respuesta sobre registro o autorización.",
        source: `Actividad vulnerable ${numero}`,
        values: [
          {
            label: "Actividad vulnerable",
            value: actividad.actividadKey,
            targetId: `actividad-clave-${index}`,
          },
          {
            label: "Fecha de primera operación",
            value: actividad.fechaPrimera,
            targetId: `actividad-fecha-${index}`,
          },
          {
            label: "Respuesta sobre registro o autorización",
            value: actividad.cuentaRegistro,
            targetId: `actividad-registro-${index}`,
          },
        ],
        valueSummary: summarize([actividadLabel, actividad.fechaPrimera]),
      }),
    )

    items.push(
      buildConditionalItem({
        active: actividad.cuentaRegistro === "si",
        id: `actividad-${index}-autorizacion`,
        sectionId: "actividades",
        label: `Actividad ${numero}: autorización`,
        description: "Datos del documento cuando se indicó que sí cuenta con registro, patente o autorización.",
        source: `Actividad vulnerable ${numero}`,
        values: [
          {
            label: "Tipo de documento",
            value: actividad.tipoDocumento,
            targetId: `actividad-doc-tipo-${index}`,
          },
          {
            label: "Autoridad emisora",
            value: actividad.autoridadDocumento,
            targetId: `actividad-doc-autoridad-${index}`,
          },
          {
            label: "Folio",
            value: actividad.folioDocumento,
            targetId: `actividad-doc-folio-${index}`,
          },
          {
            label: "Periodo",
            value: actividad.periodoDocumento,
            targetId: `actividad-doc-periodo-${index}`,
          },
        ],
      }),
    )

    const domicilio = actividad.domicilio ?? {}
    items.push(
      buildRequiredItem({
        id: `actividad-${index}-domicilio`,
        sectionId: "actividades",
        label: `Actividad ${numero}: domicilio`,
        description: "Domicilio nacional donde se realiza esta actividad vulnerable.",
        source: `Domicilio de la actividad ${numero}`,
        values: [
          { label: "Código postal", value: domicilio.codigoPostal, targetId: `domicilio-cp-${index}` },
          { label: "Tipo de vialidad", value: domicilio.tipoVialidad, targetId: `domicilio-tipo-${index}` },
          {
            label: "Nombre de vialidad",
            value: domicilio.nombreVialidad,
            targetId: `domicilio-nombre-${index}`,
          },
          { label: "Número exterior", value: domicilio.numeroExterior, targetId: `domicilio-ext-${index}` },
          { label: "Colonia", value: domicilio.colonia, targetId: `domicilio-colonia-${index}` },
          { label: "Alcaldía o municipio", value: domicilio.alcaldia, targetId: `domicilio-cp-${index}` },
          { label: "Entidad", value: domicilio.entidad, targetId: `domicilio-cp-${index}` },
          { label: "País", value: domicilio.pais, targetId: `domicilio-pais-${index}` },
        ],
        valueSummary: summarize([
          domicilio.nombreVialidad,
          domicilio.numeroExterior,
          domicilio.colonia,
          domicilio.codigoPostal,
        ]),
      }),
    )
  })

  if (requiereRepresentante) {
    const representante = input.representante ?? {}
    const representanteContacto = representante.contacto ?? {}
    const representanteTelefono =
      representanteContacto.telefonoFijo || representanteContacto.telefonoMovil

    items.push(
      buildRequiredItem({
        id: "representante-identificacion",
        sectionId: "representante",
        label: "Identificación y designación",
        description: "Identidad, RFC, nacionalidad y fechas de designación y aceptación.",
        source: "Representante encargado de cumplimiento",
        values: [
          { label: "Nombre", value: representante.nombre, targetId: "rec-nombres" },
          {
            label: "Apellido paterno",
            value: representante.apellidoPaterno,
            targetId: "rec-apellido-paterno",
          },
          {
            label: "Fecha de nacimiento",
            value: representante.fechaNacimiento,
            targetId: "rec-fecha-nacimiento",
          },
          { label: "RFC", value: representante.rfc, targetId: "rec-rfc" },
          {
            label: "País de nacionalidad",
            value: representante.paisNacionalidad,
            targetId: "rec-pais",
          },
          {
            label: "Fecha de designación",
            value: representante.fechaDesignacion,
            targetId: "rec-fecha-designacion",
          },
          {
            label: "Fecha de aceptación",
            value: representante.fechaAceptacion,
            targetId: "rec-fecha-aceptacion",
          },
        ],
        valueSummary: summarize([
          representante.nombre,
          representante.apellidoPaterno,
          representante.rfc,
        ]),
      }),
    )
    items.push(
      buildRequiredItem({
        id: "representante-contacto",
        sectionId: "representante",
        label: "Contacto del representante",
        description: "Correo y al menos un teléfono fijo o móvil.",
        source: "Representante encargado de cumplimiento",
        values: [
          {
            label: "Correo electrónico",
            value: representanteContacto.correo,
            targetId: "rec-correo",
          },
          {
            label: "Teléfono fijo o móvil",
            value: representanteTelefono,
            targetId: "rec-movil",
          },
        ],
        valueSummary: summarize([representanteContacto.correo, representanteTelefono]),
      }),
    )

    const certificacion = representante.certificacion ?? {}
    items.push(
      buildRequiredItem({
        id: "representante-certificacion-respuesta",
        sectionId: "representante",
        label: "Certificación PLD/FT",
        description: "Confirmación de si cuenta o no con certificación.",
        source: "Credenciales del representante",
        values: [
          {
            label: "Respuesta de certificación",
            value: certificacion.respuesta,
            targetId: "rec-certificacion",
          },
        ],
        valueSummary: certificacion.respuesta === "si" ? "Sí" : certificacion.respuesta === "no" ? "No" : "",
      }),
    )
    items.push(
      buildConditionalItem({
        active: certificacion.respuesta === "si",
        id: "representante-certificacion-datos",
        sectionId: "representante",
        label: "Datos de la certificación",
        description: "Documento, autoridad, folio y periodo de la certificación declarada.",
        source: "Credenciales del representante",
        values: [
          {
            label: "Tipo de documento",
            value: certificacion.tipoDocumento,
            targetId: "rec-cert-tipo",
          },
          {
            label: "Autoridad emisora",
            value: certificacion.autoridadDocumento,
            targetId: "rec-cert-autoridad",
          },
          { label: "Folio", value: certificacion.folioDocumento, targetId: "rec-cert-folio" },
          { label: "Periodo", value: certificacion.periodoDocumento, targetId: "rec-cert-periodo" },
        ],
      }),
    )
  }

  items.push(
    buildDocumentItem({
      id: "documento-detalle",
      label: "Detalle de alta",
      description: "Detalle emitido para el alta o actualización.",
      document: input.documentos.detalle,
      targetId: "documento-detalle-card",
    }),
    buildDocumentItem({
      id: "documento-acuse",
      label: "Acuse del SAT",
      description: "Acuse de recepción emitido por el SAT.",
      document: input.documentos.acuse,
      targetId: "documento-acuse-card",
    }),
    buildDocumentItem({
      id: "documento-aceptacion",
      label: "Aceptación de designación",
      description: "Evidencia de aceptación del representante encargado de cumplimiento.",
      document: input.documentos.aceptacion,
      targetId: "documento-aceptacion-card",
      applicable: requiereRepresentante,
    }),
  )

  const requiredApplicable = items.filter((item) => item.required && item.status !== "not-applicable")
  const complete = requiredApplicable.filter((item) => item.status === "complete").length
  const missing = requiredApplicable.filter((item) => item.status === "missing").length
  const dataItems = requiredApplicable.filter((item) => item.sectionId !== "documentos")
  const documentItems = requiredApplicable.filter((item) => item.sectionId === "documentos")
  const dataComplete = dataItems.length > 0 && dataItems.every((item) => item.status === "complete")
  const documentsComplete =
    documentItems.length > 0 && documentItems.every((item) => item.status === "complete")

  return {
    sections: buildSections(items),
    items,
    summary: {
      total: requiredApplicable.length,
      complete,
      missing,
      notApplicable: items.filter((item) => item.status === "not-applicable").length,
      progress:
        requiredApplicable.length === 0 ? 0 : Math.round((complete / requiredApplicable.length) * 100),
    },
    dataComplete,
    documentsComplete,
    overallComplete: dataComplete && documentsComplete,
  }
}
