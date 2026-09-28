/** Acuerdo 115/2026, DOF 07/08/2026, transitorios I-XII.
 * Consulta 28/09/2026. This calendar is not an assertion of implementation. */
export const RCG_2026_SOURCE = "https://www.pld.hacienda.gob.mx/work/models/PLD/documentos/reforma_rcg_dof070826.pdf"
export const RCG_2026_REVIEWED_AT = "2026-09-28"
export const RCG_2026_MILESTONES = [
  { id: "general", label: "Entrada en vigor general", date: "2026-11-30", foundation: "Transitorio primero", detail: "Sin anticipar las excepciones de los demás transitorios." },
  { id: "ebr", label: "EBR institucional", date: "2027-03-01", foundation: "Transitorio segundo", detail: "Disponible previo requerimiento; información del año anterior o desde el inicio de actividad." },
  { id: "manual", label: "Manual de sujetos existentes comprendidos en el transitorio", date: "2027-03-01", foundation: "Transitorio tercero", detail: "Incluir la metodología institucional de riesgos." },
  { id: "cliente-bc", label: "Riesgo del cliente, conocimiento y beneficiario controlador", date: "2027-03-01", foundation: "Transitorio cuarto", detail: "Capítulos III Bis, III Ter y III Quinquies para actos desde esta fecha." },
  { id: "avisos", label: "Nuevos tipos de avisos", date: null, foundation: "Transitorio quinto", detail: "Seis meses después de la entrada en vigor de la resolución que modifique expresamente los formatos. No suspende las obligaciones actuales." },
  { id: "personal", label: "Selección de personal", date: "2027-03-01", foundation: "Transitorio sexto", detail: "Aplicable a nuevas contrataciones desde esta fecha." },
  { id: "capacitacion", label: "Primer periodo anual de capacitación", date: "2027-01-01", foundation: "Transitorio séptimo", detail: "Periodo del 1 de enero al 31 de diciembre de 2027." },
  { id: "auditoria", label: "Primer periodo anual de auditoría", date: "2028-01-01", foundation: "Transitorio octavo", detail: "Periodo 2028; emisión conforme al artículo 50, a más tardar el último día hábil de marzo siguiente." },
  { id: "automatizacion", label: "Mecanismos automatizados", date: "2027-06-01", foundation: "Transitorio noveno", detail: "A más tardar esta fecha; información de actos desde entonces." },
  { id: "pep", label: "Consulta oficial de PEP", date: "2027-08-30", foundation: "Transitorio décimo", detail: "Nueve meses después de la entrada en vigor general; no equivale a una integración ya disponible." },
] as const

export function regulatoryMilestoneStatus(date: string | null, asOf: string): "programado" | "fecha-alcanzada" | "pendiente-resolucion" {
  if (!date) return "pendiente-resolucion"
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(Date.parse(asOf))) throw new Error("Fecha de consulta inválida")
  return asOf >= date ? "fecha-alcanzada" : "programado"
}

export const AUDIT_2026_SECTIONS = [
  "Presentación", "Objeto", "Volumen de información y muestreo", "Proceso de auditoría",
  "Hallazgos", "Resultados de cumplimiento", "Acciones correctivas y recomendaciones de mejora",
] as const

// New IDs prevent old CNBV/SITI confirmations from becoming confirmations of
// different obligations. The original storage record remains readable.
export const AUDIT_2026_CHECKLIST = [
  ...AUDIT_2026_SECTIONS.map((label, i) => ({ id: "rcg2026-seccion-" + (i + 1), label })),
  { id: "seguimiento", label: "Seguimiento a hallazgos del informe anterior" },
  { id: "acciones", label: "Cada hallazgo contiene acción, responsable y plazo" },
  { id: "evidencia", label: "Resultados sustentados con evidencia documental" },
  { id: "rcg2026-independencia", label: "Independencia y requisitos del auditor verificados según auditoría interna o externa" },
  { id: "rcg2026-certificacion", label: "Auditor externo: certificación UIF vigente y demás requisitos del artículo 45; documentar si no aplica" },
  { id: "rcg2026-entrega", label: "Dictamen entregado al órgano o persona correspondiente y disponible al SAT previo requerimiento" },
  { id: "rcg2026-conservacion", label: "Conservación del dictamen y soporte por al menos cinco años (artículo 51)" },
] as const
