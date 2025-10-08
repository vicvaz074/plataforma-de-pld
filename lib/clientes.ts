export type ClientTypeId =
  | "persona-fisica-nacional"
  | "persona-fisica-extranjera"
  | "persona-moral-mexicana"
  | "persona-moral-extranjera"
  | "fideicomiso"
  | "sociedad-financiera"
  | "organizacion-sin-fines"
  | "clientes-alto-riesgo"

export interface ClientChecklistItem {
  id: string
  label: string
  obligatorio: boolean
  referencia?: string
}

export interface ClientChecklist {
  tipo: ClientTypeId
  nombre: string
  descripcion: string
  documentos: ClientChecklistItem[]
  datos: ClientChecklistItem[]
}

export const clientChecklists: ClientChecklist[] = [
  {
    tipo: "persona-fisica-nacional",
    nombre: "Persona física mexicana",
    descripcion: "Clientes con nacionalidad mexicana y residencia fiscal en territorio nacional.",
    documentos: [
      {
        id: "identificacion-oficial",
        label: "Identificación oficial vigente (INE, pasaporte mexicano o cédula profesional)",
        obligatorio: true,
        referencia: "Artículo 18, fracción I LFPIORPI",
      },
      {
        id: "comprobante-domicilio",
        label: "Comprobante de domicilio reciente (≤ 3 meses)",
        obligatorio: true,
      },
      {
        id: "constancia-situacion-fiscal",
        label: "Constancia de situación fiscal y opinión de cumplimiento positiva",
        obligatorio: true,
      },
      {
        id: "acta-nacimiento",
        label: "Acta de nacimiento o CURP en caso de aclaraciones de identidad",
        obligatorio: false,
      },
    ],
    datos: [
      { id: "rfc", label: "RFC", obligatorio: true },
      { id: "curp", label: "CURP", obligatorio: true },
      { id: "telefono", label: "Teléfono y correo electrónico", obligatorio: true },
      { id: "actividad-economica", label: "Declaración de actividad económica y origen de recursos", obligatorio: true },
      { id: "pep", label: "Declaración PEP y beneficiario controlador", obligatorio: true },
    ],
  },
  {
    tipo: "persona-fisica-extranjera",
    nombre: "Persona física extranjera",
    descripcion: "Clientes con nacionalidad distinta a la mexicana y residencia en el extranjero o en México.",
    documentos: [
      {
        id: "pasaporte",
        label: "Pasaporte vigente o documento migratorio expedido por INM",
        obligatorio: true,
      },
      {
        id: "comprobante-domicilio-extranjero",
        label: "Comprobante de domicilio en país de residencia (apostillado en su caso)",
        obligatorio: true,
      },
      {
        id: "registro-fiscal-extranjero",
        label: "Registro fiscal o número de identificación fiscal del país de origen",
        obligatorio: true,
      },
      {
        id: "permiso-inm",
        label: "Permiso de estancia o visa vigente para operar en México",
        obligatorio: false,
      },
    ],
    datos: [
      { id: "rfc-generico", label: "RFC genérico o clave asignada por el SAT", obligatorio: true },
      { id: "telefono-internacional", label: "Teléfono y correo con dominios verificados", obligatorio: true },
      { id: "actividad-extranjera", label: "Declaración de actividad económica y origen de fondos", obligatorio: true },
      { id: "pep", label: "Declaración PEP y verificación en listas internacionales", obligatorio: true },
    ],
  },
  {
    tipo: "persona-moral-mexicana",
    nombre: "Persona moral mexicana",
    descripcion: "Sociedades constituidas conforme a las leyes mexicanas.",
    documentos: [
      { id: "acta-constitutiva", label: "Acta constitutiva protocolizada y poderes vigentes", obligatorio: true },
      { id: "estatutos", label: "Estatutos sociales actualizados", obligatorio: true },
      { id: "rppc", label: "Constancia de inscripción en el Registro Público de Comercio", obligatorio: true },
      { id: "identificacion-representante", label: "Identificación oficial del representante legal", obligatorio: true },
      { id: "estructura-accionaria", label: "Estructura accionaria y beneficiarios finales", obligatorio: true },
    ],
    datos: [
      { id: "rfc", label: "RFC de la sociedad", obligatorio: true },
      { id: "domicilio-fiscal", label: "Domicilio fiscal verificado", obligatorio: true },
      { id: "objeto-social", label: "Objeto social y actividad económica preponderante", obligatorio: true },
      { id: "informacion-bancaria", label: "Información bancaria y cuentas autorizadas", obligatorio: true },
      { id: "grupo-empresarial", label: "Declaración de pertenencia a grupo empresarial", obligatorio: true },
    ],
  },
  {
    tipo: "persona-moral-extranjera",
    nombre: "Persona moral extranjera",
    descripcion: "Entidades constituidas en el extranjero con operaciones en México.",
    documentos: [
      { id: "documentos-constitutivos", label: "Documentos constitutivos apostillados o legalizados", obligatorio: true },
      { id: "certificado-existencia", label: "Certificado de existencia legal vigente", obligatorio: true },
      { id: "identificacion-representante", label: "Identificación del representante y poderes legalizados", obligatorio: true },
      { id: "domicilio-extranjero", label: "Comprobante de domicilio de la matriz", obligatorio: true },
      { id: "estructura-beneficiarios", label: "Declaración de beneficiarios finales y controladores", obligatorio: true },
    ],
    datos: [
      { id: "rfc-temporal", label: "RFC genérico o clave asignada", obligatorio: true },
      { id: "pais-origen", label: "País de incorporación y regulación aplicable", obligatorio: true },
      { id: "actividad-global", label: "Descripción de actividad global y operaciones en México", obligatorio: true },
      { id: "banco-corresponsal", label: "Información de bancos corresponsales utilizados", obligatorio: false },
      { id: "grupo-empresarial", label: "Declaración de grupo empresarial y subsidiarias", obligatorio: true },
    ],
  },
  {
    tipo: "fideicomiso",
    nombre: "Fideicomiso",
    descripcion: "Fideicomisos administrados por el sujeto obligado o donde actúe como fiduciario o comité técnico.",
    documentos: [
      { id: "contrato-fideicomiso", label: "Contrato de fideicomiso y modificaciones", obligatorio: true },
      { id: "identificacion-fiduciarios", label: "Identificación de fideicomitente, fiduciario y fideicomisario", obligatorio: true },
      { id: "reglas-gobierno", label: "Reglas de gobierno corporativo y facultades del comité técnico", obligatorio: true },
      { id: "aviso-prevencion", label: "Registro ante la UIF cuando aplique", obligatorio: false },
    ],
    datos: [
      { id: "rfc-fideicomiso", label: "RFC del fideicomiso", obligatorio: true },
      { id: "objeto-fideicomiso", label: "Objeto del fideicomiso y origen de los recursos", obligatorio: true },
      { id: "cuentas-bancarias", label: "Cuentas bancarias vinculadas", obligatorio: true },
      { id: "beneficiarios-finales", label: "Identificación de beneficiarios finales", obligatorio: true },
    ],
  },
  {
    tipo: "sociedad-financiera",
    nombre: "Sociedades financieras no reguladas",
    descripcion: "SOFOM ENR, SOFIPOs u otras entidades que realizan actividades vulnerables complementarias.",
    documentos: [
      { id: "registro-condusef", label: "Inscripción ante CONDUSEF o CNBV según aplique", obligatorio: true },
      { id: "manual-pld", label: "Manual de PLD/CFT autorizado", obligatorio: true },
      { id: "identificacion-representante", label: "Identificación de representantes y apoderados", obligatorio: true },
      { id: "opiniones-fiscales", label: "Opinión de cumplimiento fiscal y laboral", obligatorio: true },
    ],
    datos: [
      { id: "rfc", label: "RFC de la entidad", obligatorio: true },
      { id: "estructura-accionaria", label: "Estructura accionaria y beneficiarios finales", obligatorio: true },
      { id: "matriz-riesgo", label: "Matriz de riesgos institucional", obligatorio: true },
      { id: "operaciones-relevantes", label: "Volumen proyectado de operaciones relevantes", obligatorio: true },
    ],
  },
  {
    tipo: "organizacion-sin-fines",
    nombre: "Organizaciones sin fines de lucro",
    descripcion: "Asociaciones civiles, fundaciones y organizaciones religiosas.",
    documentos: [
      { id: "acta-constitutiva", label: "Acta constitutiva y estatutos", obligatorio: true },
      { id: "registro-donatarias", label: "Autorización como donataria (en su caso)", obligatorio: false },
      { id: "identificacion-representante", label: "Identificación de representantes y patronos", obligatorio: true },
      { id: "control-donativos", label: "Políticas de control de donativos y apoyos", obligatorio: true },
    ],
    datos: [
      { id: "rfc", label: "RFC", obligatorio: true },
      { id: "programas", label: "Descripción de programas y beneficiarios", obligatorio: true },
      { id: "origen-donativos", label: "Origen de donativos y aportaciones", obligatorio: true },
      { id: "transparencia", label: "Informes de transparencia y uso de recursos", obligatorio: true },
    ],
  },
  {
    tipo: "clientes-alto-riesgo",
    nombre: "Clientes de alto riesgo",
    descripcion: "Segmento especial que requiere debida diligencia reforzada (PEP, operaciones internacionales, activos virtuales).",
    documentos: [
      { id: "identificacion-reforzada", label: "Identificación oficial reforzada y verificación biométrica", obligatorio: true },
      { id: "origen-recursos", label: "Declaración y evidencia documental de origen de recursos", obligatorio: true },
      { id: "referencias-bancarias", label: "Referencias bancarias y comerciales", obligatorio: true },
      { id: "autorizaciones-compliance", label: "Autorizaciones internas de la Unidad de Cumplimiento", obligatorio: true },
    ],
    datos: [
      { id: "perfil-transaccional", label: "Perfil transaccional aprobado y límites de operación", obligatorio: true },
      { id: "monitoreo-intensivo", label: "Plan de monitoreo transaccional intensivo", obligatorio: true },
      { id: "pep", label: "Declaración y validación PEP internacional", obligatorio: true },
      { id: "reportes-extraordinarios", label: "Compromiso de entregar reportes extraordinarios cuando se requiera", obligatorio: true },
    ],
  },
]
