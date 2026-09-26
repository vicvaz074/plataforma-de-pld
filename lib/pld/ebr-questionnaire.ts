import { PAISES } from "../data/paises";

export type CashExposure = "alto" | "medio" | "bajo";

export type IncomeSourceId =
  | "asalariado"
  | "propietario"
  | "independiente"
  | "empresario"
  | "arrendamiento"
  | "inversiones"
  | "fideicomiso"
  | "pensionado"
  | "agro"
  | "remesas"
  | "apoyos"
  | "hogar"
  | "estudiante";

export interface EvaluationAnswers {
  nationalityRisk: string;
  nationalityCountryCode: string;
  pep: string;
  bankInstitution: string;
  suspiciousBehaviors: string[];
  incomeSources: IncomeSourceId[];
  cashExposure: CashExposure;
  ngoNonRegulated: string;
  institutionAge: string;
}


export interface ScoredResult {
  total: number;
  max: number;
  percent: number;
  fours: number;
  level: "Bajo" | "Medio" | "Alto" | "Reforzado";
  reason: string;
  details: Array<{ question: string; score: number; answer: string }>;
}


export const NATIONALITY_OPTIONS = [
  { value: "black", label: "País en lista negra", score: 4 },
  { value: "gray_sat", label: "Lista gris o régimen preferente SAT", score: 3 },
  {
    value: "corruption",
    label: "Alto nivel de corrupción (ranking TI, últimos 80)",
    score: 2,
  },
  { value: "other", label: "Todos los demás países", score: 1 },
];

export const PEP_OPTIONS = [
  { value: "pep", label: "Es Persona Políticamente Expuesta", score: 4 },
  {
    value: "first_degree",
    label: "Cónyuge o familiar de primer grado",
    score: 3,
  },
  {
    value: "second_degree",
    label: "Familiar de consanguinidad/afinidad hasta segundo grado",
    score: 2,
  },
  { value: "none", label: "No aplica", score: 1 },
];

export const BANK_OPTIONS = [
  { value: "foreign_only", label: "Solo instituciones extranjeras", score: 3 },
  { value: "mixed", label: "Combinación nacionales y extranjeras", score: 2 },
  { value: "national_only", label: "Solo instituciones nacionales", score: 1 },
];

export const SUSPICIOUS_BEHAVIORS = [
  { value: "pld_process", label: "Pregunta por proceso interno PLD", score: 2 },
  {
    value: "disinterest",
    label: "Compra directa sin interés en el producto o servicio",
    score: 3,
  },
  {
    value: "split_cash",
    label: "Solicita fragmentación y parte en efectivo bajo umbral",
    score: 3,
  },
  { value: "urgent_close", label: "Muestra urgencia injustificada", score: 2 },
  {
    value: "report_threshold",
    label: "Solicita conocer límites de reporte",
    score: 2,
  },
  {
    value: "narrative_inconsistency",
    label: "Ligeras inconsistencias en narrativa (aclaradas)",
    score: 2,
  },
  {
    value: "avoid_id",
    label: "Evita entregar identificación/documentación obligatoria",
    score: 3,
  },
  {
    value: "avoid_ubf",
    label: "Evita información para identificar Beneficiario Final",
    score: 3,
  },
  {
    value: "invoice_change",
    label: "Solicita modificar facturación sin causa razonable",
    score: 3,
  },
];

export const INCOME_SOURCES: Array<{ value: IncomeSourceId; label: string }> = [
  { value: "asalariado", label: "Persona asalariada" },
  { value: "propietario", label: "Propietario, socio o accionista" },
  { value: "independiente", label: "Servicios profesionales o independiente" },
  { value: "empresario", label: "Comerciante o empresario individual" },
  { value: "arrendamiento", label: "Ingresos por arrendamiento" },
  { value: "inversiones", label: "Ingresos por inversiones financieras" },
  { value: "fideicomiso", label: "Beneficiario de fideicomiso" },
  { value: "pensionado", label: "Pensionado o jubilado" },
  { value: "agro", label: "Actividades agropecuarias o extractivas" },
  { value: "remesas", label: "Remesas del extranjero" },
  { value: "apoyos", label: "Apoyos gubernamentales o programas sociales" },
  { value: "hogar", label: "Dedicada al hogar" },
  { value: "estudiante", label: "Estudiante sin actividad económica" },
];

export const CASH_EXPOSURE_OPTIONS = [
  { value: "alto", label: "Giro de alto uso de efectivo" },
  { value: "medio", label: "Giro de uso medio de efectivo" },
  { value: "bajo", label: "Giro de bajo uso de efectivo" },
] as const;

export const NGO_OPTIONS = [
  { value: "yes", label: "Sí", score: 4 },
  { value: "no", label: "No", score: 1 },
];

export const INSTITUTION_AGE_OPTIONS = [
  { value: "private_lt_2", label: "Privada menor de 2 años", score: 4 },
  { value: "private_lt_5", label: "Privada menor de 5 años", score: 3 },
  { value: "private_lt_10", label: "Privada menor de 10 años", score: 2 },
  {
    value: "public_or_mature",
    label: "Pública o privada mayor a 10 años / N/A",
    score: 1,
  },
];

export const initialAnswers: EvaluationAnswers = {
  nationalityRisk: "other",
  nationalityCountryCode: "MX",
  pep: "none",
  bankInstitution: "national_only",
  suspiciousBehaviors: [],
  incomeSources: [],
  cashExposure: "bajo",
  ngoNonRegulated: "no",
  institutionAge: "public_or_mature",
};

export const getOptionScore = (
  value: string,
  options: Array<{ value: string; score: number }>,
) => options.find((option) => option.value === value)?.score ?? 1;

export const getLabel = (
  value: string,
  options: Array<{ value: string; label: string }>,
) => options.find((option) => option.value === value)?.label ?? "N/A";


export const getIncomeRiskScore = (
  incomeSources: IncomeSourceId[],
  cashExposure: CashExposure,
) => {
  const businessSources: IncomeSourceId[] = [
    "propietario",
    "independiente",
    "empresario",
    "arrendamiento",
    "inversiones",
    "fideicomiso",
    "remesas",
    "agro",
  ];
  const salariedSources: IncomeSourceId[] = ["asalariado", "pensionado"];

  const hasBusiness = incomeSources.some((source) =>
    businessSources.includes(source),
  );
  const hasSalaried = incomeSources.some((source) =>
    salariedSources.includes(source),
  );

  if (cashExposure === "alto" && hasBusiness) return 3;
  if (
    (cashExposure === "alto" && hasSalaried) ||
    (cashExposure === "medio" && hasBusiness)
  )
    return 2;
  return 1;
};

export const calculateRisk = (
  answers: EvaluationAnswers,
  includeBankAndBehavior: boolean,
  questionnaireName: string,
): ScoredResult => {
  const countryLabel =
    PAISES.find((pais) => pais.code === answers.nationalityCountryCode)
      ?.label ?? "N/A";

  const details: ScoredResult["details"] = [
    {
      question: `Nacionalidad (${questionnaireName})`,
      score: getOptionScore(answers.nationalityRisk, NATIONALITY_OPTIONS),
      answer: `${countryLabel} / ${getLabel(answers.nationalityRisk, NATIONALITY_OPTIONS)}`,
    },
    {
      question: `PEP o relación con PEP (${questionnaireName})`,
      score: getOptionScore(answers.pep, PEP_OPTIONS),
      answer: getLabel(answers.pep, PEP_OPTIONS),
    },
    {
      question: `Fuentes de ingreso + giro (${questionnaireName})`,
      score: getIncomeRiskScore(answers.incomeSources, answers.cashExposure),
      answer: `${answers.incomeSources.length || 0} fuente(s), giro ${answers.cashExposure}`,
    },
    {
      question: `ONG/beneficencia no regulada (${questionnaireName})`,
      score: getOptionScore(answers.ngoNonRegulated, NGO_OPTIONS),
      answer: getLabel(answers.ngoNonRegulated, NGO_OPTIONS),
    },
    {
      question: `Antigüedad de institución (${questionnaireName})`,
      score: getOptionScore(answers.institutionAge, INSTITUTION_AGE_OPTIONS),
      answer: getLabel(answers.institutionAge, INSTITUTION_AGE_OPTIONS),
    },
  ];

  if (includeBankAndBehavior) {
    details.splice(
      2,
      0,
      {
        question: `Institución bancaria (${questionnaireName})`,
        score: getOptionScore(answers.bankInstitution, BANK_OPTIONS),
        answer: getLabel(answers.bankInstitution, BANK_OPTIONS),
      },
      {
        question: `Acciones observadas (${questionnaireName})`,
        score: Math.max(
          1,
          ...answers.suspiciousBehaviors.map((value) =>
            getOptionScore(value, SUSPICIOUS_BEHAVIORS),
          ),
        ),
        answer: answers.suspiciousBehaviors.length
          ? `${answers.suspiciousBehaviors.length} alerta(s) seleccionada(s)`
          : "Sin alertas",
      },
    );
  }

  const total = details.reduce((sum, detail) => sum + detail.score, 0);
  const max = includeBankAndBehavior ? 25 : 19;
  const percent = Math.round((total / max) * 100);
  const fours = details.filter((detail) => detail.score === 4).length;

  let level: ScoredResult["level"] = "Bajo";
  let reason = "Sin reglas automáticas de alto riesgo";

  if (fours >= 2) {
    level = "Reforzado";
    reason = "Se detectaron dos o más respuestas con puntaje 4";
  } else if (fours === 1) {
    level = "Alto";
    reason = "Regla automática: al menos una respuesta con puntaje 4";
  } else if (percent >= 70) {
    level = "Alto";
    reason = "Puntaje acumulado alto";
  } else if (percent >= 40) {
    level = "Medio";
    reason = "Puntaje acumulado medio";
  }

  return { total, max, percent, fours, level, reason, details };
};


export function normalizeEbrAnswers(value: unknown): EvaluationAnswers {
  const raw = value && typeof value === "object" ? value as Record<string, any> : {};
  return {
    ...initialAnswers,
    ...raw,
    suspiciousBehaviors: Array.isArray(raw?.suspiciousBehaviors) ? raw.suspiciousBehaviors : [],
    incomeSources: Array.isArray(raw?.incomeSources) ? raw.incomeSources : [],
  };
}

/** Read v2 persisted questionnaires using the same scoring as the EBR screen. */
export function summarizeStoredEbrQuestionnaire(value: Record<string, any>) {
  if (!value.clientAnswers || !value.subjectAnswers) return undefined;
  const client = calculateRisk(normalizeEbrAnswers(value.clientAnswers), true, "Cliente");
  const subject = calculateRisk(normalizeEbrAnswers(value.subjectAnswers), true, "Sujeto obligado");
  const beneficiary = value.hasBeneficiaryController
    ? calculateRisk(normalizeEbrAnswers(value.beneficiaryAnswers), false, "Beneficiario controlador")
    : undefined;
  const levels = [client.level, subject.level, beneficiary?.level];
  const pepStatus = value.pepScreening?.status;
  const level = pepStatus === "coincidencia-cargo" || levels.includes("Reforzado") ? "Reforzado"
    : pepStatus === "posible-pep" || levels.includes("Alto") ? "Alto"
    : levels.includes("Medio") ? "Medio" : "Bajo";
  return { level, score: client.total, percent: client.percent };
}
