import { buildPldOperationalCase } from "../pld/operational-flow"
import { evaluarOperacionVulnerable, classifyAvisoSalida } from "../pld/operations"
import { createStoredPldOperation } from "../pld/stored-operations"
import { generateSatOutputPackage } from "../pld/sat-outputs"
import { resolveOperationFinance } from "../pld/operation-finance"
import type { PldTenant, SatOutputPackage } from "../pld/types"

export const PRESENTATION_ACTIVITY = "fraccion-xv-uso-goce"
export const PRESENTATION_TEMPLATE = "sat-fraccion-xv-arrendamiento"
export const PRESENTATION_CUTOFF = "2026-09-28T12:00:00-06:00"
export const PRESENTATION_CLIENT_ID = "eui-demo-lago-verde"
export const PRESENTATION_CLIENT_RFC = "DLV190624M32"
export const PRESENTATION_CLIENT_NAME = "Desarrollos Lago Verde, S.A.P.I. de C.V."
export const PRESENTATION_EVIDENCE = {
  "pm-acta-constitutiva": true, "pm-rfc-constancia": true, "pm-domicilio": true,
  "pm-poderes-representante": true, "pm-identificacion-representante": true,
  "pm-beneficiario-controlador": true, "operacion-soporte": true, "operacion-forma-pago": true,
}

/** Three authored cases. Deliberately independent of the 40-template QA filler. */
export function buildPresentationCases(tenant: PldTenant, referenceDate: Date) {
  const historical: Array<{ id: string; actividadKey: string; clienteKey: string; fechaOperacion: string; montoMxn: number }> = []
  const packages: SatOutputPackage[] = []
  const cases = [
    { amount: 40_000, property: "8,Oficina", title: "Oficina administrativa", street: "OFICINAS DEMO", number: "101" },
    { amount: 200_000, property: "9,Bodega comercial", title: "Bodega comercial", street: "BODEGAS DEMO", number: "202" },
    { amount: 400_000, property: "11,Nave industrial", title: "Nave industrial", street: "PARQUE INDUSTRIAL DEMO", number: "303" },
  ]
  const operations = cases.map((seed, index) => {
    const date = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - 2 + index, 5))
    const fechaOperacion = date.toISOString().slice(0, 10)
    const periodo = fechaOperacion.slice(0, 7).replace("-", "")
    const reference = `DEMO${periodo}${index + 1}`
    const id = `op-demo-renta-${index + 1}`
    const amount = seed.amount.toFixed(2)
    const result = evaluarOperacionVulnerable({ actividadKey: PRESENTATION_ACTIVITY, clienteKey: PRESENTATION_CLIENT_RFC,
      fechaOperacion, montoMxn: seed.amount, operacionesHistoricas: historical })
    historical.push({ id, actividadKey: PRESENTATION_ACTIVITY, clienteKey: PRESENTATION_CLIENT_RFC, fechaOperacion, montoMxn: seed.amount })
    const output = classifyAvisoSalida({ status: result.status, fechaOperacion })
    const finance = resolveOperationFinance({ amountText: amount, currency: "MXN" })
    if (!finance.ok) throw new Error(finance.error)
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
    const values: Record<string, string> = {
      "persona_objeto.tipo_persona": "persona_moral", "persona_objeto.ambito_domicilio": "nacional",
      "beneficiario.tipo_persona": "persona_fisica",
      "persona_aviso.sujeto_obligado_rfc": tenant.rfc, "persona_aviso.periodo": periodo,
      "persona_aviso.referencia": reference, "persona_aviso.prioridad": "1,NORMAL", "persona_aviso.tipo_alerta": "100,Sin alerta.",
      "persona_aviso.pm.razon_social": PRESENTATION_CLIENT_NAME, "persona_aviso.pm.fecha_constitucion": "2019-06-24",
      "persona_aviso.pm.rfc": PRESENTATION_CLIENT_RFC, "persona_aviso.pm.pais_nacionalidad": "MEXICO,MX",
      "persona_aviso.pm.giro_mercantil": "NO APLICA||1000000",
      "persona_aviso.representante.nombre": "Daniel", "persona_aviso.representante.apellido_paterno": "Herrera",
      "persona_aviso.representante.apellido_materno": "Cruz", "persona_aviso.representante.fecha_nacimiento": "1982-04-12",
      "persona_aviso.representante.rfc": "HECD820412L98",
      "persona_aviso.domicilio_nacional.codigo_postal": "66220", "persona_aviso.domicilio_nacional.colonia": "RESIDENCIAL SAN AGUSTIN",
      "persona_aviso.domicilio_nacional.calle": "CALZADA DEL VALLE", "persona_aviso.domicilio_nacional.numero_exterior": "512",
      "persona_aviso.contacto.pais_telefono": "MEXICO,MX", "persona_aviso.contacto.telefono": "8120405500",
      "persona_aviso.contacto.correo": "administracion@lagoverde.demo",
      "beneficiario.pf.nombre": "Adriana", "beneficiario.pf.apellido_paterno": "Luna", "beneficiario.pf.apellido_materno": "Paredes",
      "beneficiario.pf.fecha_nacimiento": "1979-06-22", "beneficiario.pf.rfc": "LUPA7906228V4",
      "beneficiario.pf.curp": "LUPA790622MNLNRD03", "beneficiario.pf.pais_nacionalidad": "MEXICO,MX",
      "acto.fecha_operacion": fechaOperacion, "acto.tipo_operacion": "1501,Arrendamiento de inmuebles",
      "inmueble.tipo_bien": seed.property, "inmueble.valor_referencia": "10000000.00",
      "inmueble.codigo_postal": "66220", "inmueble.colonia": "RESIDENCIAL SAN AGUSTIN", "inmueble.calle": seed.street,
      "inmueble.numero_exterior": seed.number, "inmueble.folio_real": `DEMO2026${index + 1}`,
      "inmueble.fecha_inicio": `${fechaOperacion.slice(0, 7)}-01`, "inmueble.fecha_termino": end,
      "pago.fecha": fechaOperacion, "pago.forma_pago": "1,Contado", "pago.instrumento_monetario": "8,Transferencia Interbancaria",
      "pago.moneda": "1,Peso mexicano", "pago.monto": amount,
    }
    // Explicit cell map for the selected official XV worksheet. Do not use the
    // generic XML fallback (it does not carry this beneficiary table).
    const cellMap: Record<string, string> = {
      "persona_aviso.sujeto_obligado_rfc": "C4", "persona_aviso.periodo": "C5", "persona_aviso.referencia": "C6",
      "persona_aviso.prioridad": "E6", "persona_aviso.tipo_alerta": "C7",
      "persona_aviso.pm.razon_social": "B33", "persona_aviso.pm.fecha_constitucion": "C33", "persona_aviso.pm.rfc": "D33",
      "persona_aviso.pm.pais_nacionalidad": "E33", "persona_aviso.pm.giro_mercantil": "F33",
      "persona_aviso.representante.nombre": "B46", "persona_aviso.representante.apellido_paterno": "C46",
      "persona_aviso.representante.apellido_materno": "D46", "persona_aviso.representante.fecha_nacimiento": "E46", "persona_aviso.representante.rfc": "F46",
      "persona_aviso.domicilio_nacional.codigo_postal": "B60", "persona_aviso.domicilio_nacional.colonia": "E60",
      "persona_aviso.domicilio_nacional.calle": "F60", "persona_aviso.domicilio_nacional.numero_exterior": "G60",
      "persona_aviso.contacto.pais_telefono": "B86", "persona_aviso.contacto.telefono": "C86", "persona_aviso.contacto.correo": "D86",
    }
    const satCellValues: Record<string, string> = {}
    for (const [key, cell] of Object.entries(cellMap)) satCellValues[`Persona Objeto del aviso!${cell}`] = values[key].toUpperCase()
    const put = (sheet: string, fields: Record<string, string>) => {
      for (const [cell, key] of Object.entries(fields)) satCellValues[`${sheet}!${cell}`] = values[key].toUpperCase()
    }
    put("Beneficiario controlador", { B5: "beneficiario.pf.nombre", C5: "beneficiario.pf.apellido_paterno", D5: "beneficiario.pf.apellido_materno",
      E5: "beneficiario.pf.fecha_nacimiento", F5: "beneficiario.pf.rfc", G5: "beneficiario.pf.curp", H5: "beneficiario.pf.pais_nacionalidad" })
    put("Acto u operación", { C4: "acto.fecha_operacion", C5: "acto.tipo_operacion", B12: "inmueble.tipo_bien", C12: "inmueble.valor_referencia",
      D12: "inmueble.codigo_postal", G12: "inmueble.colonia", H12: "inmueble.calle", I12: "inmueble.numero_exterior", K12: "inmueble.folio_real",
      L12: "inmueble.fecha_inicio", M12: "inmueble.fecha_termino", B27: "pago.fecha", C27: "pago.forma_pago",
      D27: "pago.instrumento_monetario", E27: "pago.moneda", F27: "pago.monto" })
    const operation = createStoredPldOperation({
      id, actividadKey: PRESENTATION_ACTIVITY, actividadNombre: "Fracción XV · Uso o goce de inmuebles",
      tipoCliente: "pm_mexicana", cliente: PRESENTATION_CLIENT_NAME, rfc: PRESENTATION_CLIENT_RFC,
      identificadores: { rfc: PRESENTATION_CLIENT_RFC }, expedienteReferenciado: PRESENTATION_CLIENT_ID,
      personaExpedienteId: `cliente-${PRESENTATION_CLIENT_RFC}`,
      fechaOperacion, periodo, montoCentavos: finance.montoCentavos, monto: seed.amount, finance: finance.finance,
      moneda: "MXN", monedaDescripcion: "Peso mexicano (MXN)", captureStatus: "complete", mismoGrupo: false,
      tipoOperacion: `DEMO ${index + 1} · ${seed.title}`, evidencia: "Caso ficticio: contrato y transferencia simulados; sin presentación ante SAT.",
      umaDiaria: result.uma.diario, identificacionUmbralPesos: result.identificacionUmbralMxn,
      avisoUmbralPesos: result.avisoUmbralMxn, umbralStatus: result.status, acumuladoCliente: result.acumulacion.montoAcumuladoMxn,
      avisoSalidaTipo: output.tipo, avisoSalidaLabel: output.label, avisoSalidaDescripcion: output.descripcion,
      avisoPresentado: false, alertaResuelta: result.status !== "aviso", referenciaAviso: reference,
      requisitosChecklist: PRESENTATION_EVIDENCE, kycIntegrado: true,
      satTemplateId: PRESENTATION_TEMPLATE, satTemplateVariant: PRESENTATION_TEMPLATE,
      satTemplateFile: "Arrendamiento_v4_5.xlsm", satFieldValues: values, satCellValues,
      satMissingRequiredFields: [], satWorkbookStatus: "listo",
      liquidacion: { fechaPago: fechaOperacion, formaPago: "1,Contado", instrumento: "8", instrumentoMonetario: "8,Transferencia Interbancaria",
        moneda: "1,Peso mexicano", monto: amount, montoCentavos: finance.montoCentavos },
      inmueble: { codigoOperacion: "1501", tipoInmueble: seed.property.split(",")[0], tipo: seed.property, valorReferencia: "10000000.00", codigoPostal: "66220", colonia: "RESIDENCIAL SAN AGUSTIN",
        calle: seed.street, numeroExterior: seed.number, folioReal: values["inmueble.folio_real"],
        fechaInicio: values["inmueble.fecha_inicio"], fechaFin: end, fechaTermino: end, pais: "MX", entidad: "Nuevo León", municipio: "San Pedro Garza García" },
      beneficiario: { tipo: "persona_fisica", nombre: "Adriana", apellidoPaterno: "Luna", apellidoMaterno: "Paredes",
        fechaNacimiento: "1979-06-22", pais: "MX", curp: "LUPA790622MNLNRD03", rfc: "LUPA7906228V4", identificado: true }, demoSeed: true,
    }, { at: referenceDate.toISOString(), actor: "Demo ficticia", sujetoObligado: { id: tenant.id, rfc: tenant.rfc, nombre: tenant.razonSocial } })
    if (!operation) throw new Error(`No se pudo construir el caso demo ${id}`)
    if (result.status === "aviso") {
      const operationalCase = buildPldOperationalCase({ tenant, periodo, actividadKey: PRESENTATION_ACTIVITY,
        clienteId: PRESENTATION_CLIENT_ID, clienteNombre: PRESENTATION_CLIENT_NAME, clienteRfc: PRESENTATION_CLIENT_RFC,
        tipoCliente: "pm_mexicana", fechaOperacion, montoMxn: seed.amount, montoCentavos: finance.montoCentavos,
        captureStatus: "complete", finance: finance.finance, formaPago: "1,Contado", completedEvidence: PRESENTATION_EVIDENCE,
        satTemplateId: PRESENTATION_TEMPLATE, satTemplateVariant: PRESENTATION_TEMPLATE, satTemplateFile: "Arrendamiento_v4_5.xlsm",
        satFieldValues: values, satCellValues, satMissingRequiredFields: [], satWorkbookStatus: "listo", actor: "Demo ficticia" })
      const satPackage = generateSatOutputPackage(operationalCase, { sourceOperationId: id, sourceOperationRevision: 1, updatedAt: referenceDate.toISOString() })
      packages.push({ ...satPackage, createdAt: referenceDate.toISOString() })
    }
    return operation
  })
  return { operations, packages }
}
