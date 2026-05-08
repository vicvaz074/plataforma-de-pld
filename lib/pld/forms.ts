export type KycFormType = "persona-fisica" | "persona-moral" | "persona-moral-derecho-publico" | "persona-moral-extranjera"

export interface KycFormSection {
  title: string
  fields: string[]
}

export const KYC_FORM_TEMPLATES: Record<KycFormType, { title: string; code: string; sections: KycFormSection[] }> = {
  "persona-fisica": {
    title: "Formulario de Identificacion - Persona Fisica",
    code: "FI-PLD-FIS",
    sections: [
      { title: "I. Actividad vulnerable", fields: ["Fraccion aplicable", "Tipo de acto u operacion", "Fecha", "Monto", "Forma de pago"] },
      { title: "II. Datos generales", fields: ["Nombre completo", "Fecha de nacimiento", "Nacionalidad", "CURP", "RFC"] },
      { title: "III. Domicilio y contacto", fields: ["Domicilio", "Telefono", "Correo electronico", "Residencia fiscal"] },
      { title: "IV. Identificacion", fields: ["Tipo de identificacion", "Numero", "Autoridad emisora", "Vigencia"] },
      { title: "V. Perfil transaccional", fields: ["Ocupacion", "Origen de recursos", "Destino de recursos", "Monto esperado", "PEP/listas"] },
      { title: "VI. Beneficiario controlador", fields: ["Declaracion de existencia", "Nombre", "RFC/CURP/NIF", "Relacion", "Documentacion soporte"] },
      { title: "VII. Documentacion", fields: ["Identificacion", "Comprobante domicilio", "Constancia fiscal", "Contrato/soporte", "Declaracion bajo protesta"] },
    ],
  },
  "persona-moral": {
    title: "Formulario de Identificacion - Persona Moral",
    code: "FI-PLD-MOR",
    sections: [
      { title: "I. Actividad vulnerable", fields: ["Fraccion aplicable", "Acto u operacion", "Monto", "Forma de pago"] },
      { title: "II. Datos de la persona moral", fields: ["Denominacion", "Fecha de constitucion", "RFC", "Giro", "Objeto social"] },
      { title: "III. Domicilio y contacto", fields: ["Domicilio fiscal", "Telefono", "Correo", "Pais de operaciones"] },
      { title: "IV. Representante legal", fields: ["Nombre", "Cargo", "Poder", "Identificacion", "Vigencia"] },
      { title: "V. Perfil transaccional", fields: ["Actividad economica", "Origen de recursos", "Volumen esperado", "Bancos", "PEP/listas"] },
      { title: "VI. Beneficiario controlador", fields: ["Estructura accionaria", "Nombre(s)", "Porcentaje/control", "RFC/CURP/NIF", "Domicilio"] },
      { title: "VII. Documentacion", fields: ["Acta constitutiva", "Poderes", "CSF", "Comprobante domicilio", "IDs", "Contrato/soporte"] },
    ],
  },
  "persona-moral-derecho-publico": {
    title: "Formulario de Identificacion - Persona Moral de Derecho Publico",
    code: "FI-PLD-PUB",
    sections: [
      { title: "I. Actividad vulnerable", fields: ["Fraccion aplicable", "Acto u operacion", "Monto", "Forma de pago"] },
      { title: "II. Datos de entidad publica", fields: ["Nombre", "RFC", "Naturaleza juridica", "Dependencia/organismo"] },
      { title: "III. Servidor publico actuante", fields: ["Nombre", "Cargo", "Nombramiento", "Facultades"] },
      { title: "IV. Identificacion", fields: ["Documento oficial", "Numero", "Autoridad emisora", "Vigencia"] },
      { title: "V. Perfil y PEP", fields: ["Cargo publico", "Dependencia", "Declaracion PEP", "Validacion por cargos SHCP/UIF"] },
      { title: "VI. Documentacion", fields: ["Existencia legal", "Nombramiento", "Facultades", "Identificacion", "Soporte del acto"] },
    ],
  },
  "persona-moral-extranjera": {
    title: "Formulario de Identificacion - Persona Moral Extranjera",
    code: "FI-PLD-PMEX",
    sections: [
      { title: "I. Actividad vulnerable", fields: ["Fraccion aplicable", "Acto u operacion", "Monto", "Forma de pago"] },
      { title: "II. Datos de la entidad extranjera", fields: ["Denominacion", "Pais de constitucion", "NIF/RFC", "Fecha de constitucion", "Giro"] },
      { title: "III. Domicilio y contacto", fields: ["Domicilio extranjero", "Pais", "Telefono", "Correo"] },
      { title: "IV. Representante", fields: ["Nombre", "Cargo", "Poder/apostilla", "Identificacion"] },
      { title: "V. Perfil transaccional", fields: ["Origen de recursos", "Destino", "Bancos", "Jurisdicciones", "PEP/listas"] },
      { title: "VI. Beneficiario controlador", fields: ["Nombre", "Nacionalidad", "NIF/RFC", "Porcentaje/control", "Domicilio"] },
      { title: "VII. Documentacion", fields: ["Documento constitutivo", "Traduccion/apostilla", "Poderes", "IDs", "Soporte de operacion"] },
    ],
  },
}
