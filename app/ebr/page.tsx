"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { jsPDF } from "jspdf";
import {
  AlertTriangle,
  CircleHelp,
  ClipboardCheck,
  FileText,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/lib/LanguageContext";
import { PAISES } from "@/lib/data/paises";
import { translations } from "@/lib/translations";

interface ExpedienteDetalle {
  rfc: string;
  nombre: string;
  tipoCliente?: string;
}

interface OperacionCliente {
  id: string;
  rfc: string;
  cliente: string;
  fechaOperacion: string;
}

type CashExposure = "alto" | "medio" | "bajo";

type IncomeSourceId =
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

interface EvaluationAnswers {
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

interface StoredEvaluation {
  rfc: string;
  clientAnswers: EvaluationAnswers;
  subjectAnswers: EvaluationAnswers;
  hasBeneficiaryController: boolean;
  beneficiaryAnswers: EvaluationAnswers;
  notes: string;
  updatedAt: string;
}

interface ScoredResult {
  total: number;
  max: number;
  percent: number;
  fours: number;
  level: "Bajo" | "Medio" | "Alto" | "Reforzado";
  reason: string;
  details: Array<{ question: string; score: number; answer: string }>;
}

const EXPEDIENTE_DETALLE_STORAGE_KEY = "kyc_expedientes_detalle";
const OPERACIONES_STORAGE_KEY = "actividades_vulnerables_operaciones";
const EBR_STORAGE_KEY = "ebr_evaluaciones";

const NATIONALITY_OPTIONS = [
  { value: "black", label: "País en lista negra", score: 4 },
  { value: "gray_sat", label: "Lista gris o régimen preferente SAT", score: 3 },
  {
    value: "corruption",
    label: "Alto nivel de corrupción (ranking TI, últimos 80)",
    score: 2,
  },
  { value: "other", label: "Todos los demás países", score: 1 },
];

const PEP_OPTIONS = [
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

const BANK_OPTIONS = [
  { value: "foreign_only", label: "Solo instituciones extranjeras", score: 3 },
  { value: "mixed", label: "Combinación nacionales y extranjeras", score: 2 },
  { value: "national_only", label: "Solo instituciones nacionales", score: 1 },
];

const SUSPICIOUS_BEHAVIORS = [
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

const INCOME_SOURCES: Array<{ value: IncomeSourceId; label: string }> = [
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

const CASH_EXPOSURE_OPTIONS = [
  { value: "alto", label: "Giro de alto uso de efectivo" },
  { value: "medio", label: "Giro de uso medio de efectivo" },
  { value: "bajo", label: "Giro de bajo uso de efectivo" },
] as const;

const NGO_OPTIONS = [
  { value: "yes", label: "Sí", score: 4 },
  { value: "no", label: "No", score: 1 },
];

const INSTITUTION_AGE_OPTIONS = [
  { value: "private_lt_2", label: "Privada menor de 2 años", score: 4 },
  { value: "private_lt_5", label: "Privada menor de 5 años", score: 3 },
  { value: "private_lt_10", label: "Privada menor de 10 años", score: 2 },
  {
    value: "public_or_mature",
    label: "Pública o privada mayor a 10 años / N/A",
    score: 1,
  },
];

const initialAnswers: EvaluationAnswers = {
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

const getOptionScore = (
  value: string,
  options: Array<{ value: string; score: number }>,
) => options.find((option) => option.value === value)?.score ?? 1;

const getLabel = (
  value: string,
  options: Array<{ value: string; label: string }>,
) => options.find((option) => option.value === value)?.label ?? "N/A";

const normalizeCountryName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/['`´]/g, "")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const COUNTRY_BLACKLIST = new Set(
  ["Corea del Norte", "Irán", "Myanmar"].map(normalizeCountryName),
);

const COUNTRY_GREYLIST = new Set(
  [
    "Argelia",
    "Angola",
    "Bolivia",
    "Bulgaria",
    "Camerún",
    "Costa de Marfil",
    "República Democrática del Congo",
    "Haití",
    "Kenia",
    "Kuwait",
    "República Democrática Popular Lao",
    "Líbano",
    "Mónaco",
    "Namibia",
    "Nepal",
    "Papúa Nueva Guinea",
    "Sudán del Sur",
    "Siria",
    "Venezuela",
    "Vietnam",
    "Islas Vírgenes (Reino Unido)",
    "Yemen",
  ].map(normalizeCountryName),
);

const COUNTRY_HIGH_CORRUPTION = new Set(
  [
    "Anguila",
    "Antigua y Barbuda",
    "Antillas Neerlandesas",
    "Archipiélago de Svalbard",
    "Aruba",
    "Ascensión",
    "Barbados",
    "Belice",
    "Bermudas",
    "Brunei Darussalam",
    "Campione D Italia",
    "Commonwealth de Dominica",
    "Commonwealth de las Bahamas",
    "Emiratos Árabes Unidos",
    "Estado de Bahrein",
    "Estado de Kuwait",
    "Estado de Qatar",
    "Estado Independiente de Samoa Occidental",
    "Estado Libre Asociado de Puerto Rico",
    "Gibraltar",
    "Granada",
    "Groenlandia",
    "Guam",
    "Hong Kong",
    "Isla Caimán",
    "Isla de Christmas",
    "Isla de Norfolk",
    "Isla de San Pedro y Miguelón",
    "Isla del Hombre",
    "Isla Qeshm",
    "Islas Azores",
    "Islas Canarias",
    "Islas Cook",
    "Islas de Cocos o Kelling",
    "Islas de Guernesey, Jersey, Alderney, Isla Great Sark, Herm, Little Sark, Brechou, Jethou",
    "Lihou (Islas del Canal)",
    "Islas Malvinas",
    "Islas Pacífico",
    "Islas Salomón",
    "Islas Turcas y Caicos",
    "Islas Vírgenes Británicas",
    "Islas Vírgenes de Estados Unidos de América",
    "Kiribati",
    "Labuán",
    "Macao",
    "Madeira",
    "Malta",
    "Montserrat",
    "Nevis",
    "Niue",
    "Patau",
    "Pitcairn",
    "Polinesia Francesa",
    "Principado de Andorra",
    "Principado de Liechtenstein",
    "Principado de Mónaco",
    "Reino de Swazilandia",
    "Reino de Tonga",
    "Reino Hachemita de Jordania",
    "República de Albania",
    "República de Angola",
    "República de Cabo Verde",
    "República de Costa Rica",
    "República de Chipre",
    "República de Djibouti",
    "República de Guyana",
    "República de Honduras",
    "República de las Islas Marshall",
    "República de Liberia",
    "República de Maldivas",
    "República de Mauricio",
    "República de Nauru",
    "República de Panamá",
    "República de Seychelles",
    "República de Trinidad y Tobago",
    "República de Túnez",
    "República de Vanuatu",
    "República del Yemen",
    "República Oriental del Uruguay",
    "República Socialista Democrática de Sri Lanka",
    "Samoa Americana",
    "San Kitts",
    "San Vicente y las Granadinas",
    "Santa Elena",
    "Santa Lucía",
    "Serenísima República de San Marino",
    "Sultanía de Omán",
    "Tokelau",
    "Trieste",
    "Tristán de Cunha",
    "Tuvalu",
    "Zona Especial Canaria",
    "Zona Libre Ostrava",
  ].map(normalizeCountryName),
);

const getNationalityRiskByCountry = (countryName?: string) => {
  const normalizedCountry = normalizeCountryName(countryName ?? "");

  if (!normalizedCountry) return "other";
  if (COUNTRY_BLACKLIST.has(normalizedCountry)) return "black";
  if (COUNTRY_GREYLIST.has(normalizedCountry)) return "gray_sat";
  if (COUNTRY_HIGH_CORRUPTION.has(normalizedCountry)) return "corruption";
  return "other";
};

const getIncomeRiskScore = (
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

const calculateRisk = (
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

const formatDate = (dateValue: string) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

export default function EbrPage() {
  const { language } = useLanguage();
  const t = translations[language];

  const [expedientes, setExpedientes] = useState<ExpedienteDetalle[]>([]);
  const [operaciones, setOperaciones] = useState<OperacionCliente[]>([]);
  const [evaluacionesGuardadas, setEvaluacionesGuardadas] = useState<
    Record<string, StoredEvaluation>
  >({});
  const [clienteSeleccionado, setClienteSeleccionado] = useState("");

  const [clientAnswers, setClientAnswers] =
    useState<EvaluationAnswers>(initialAnswers);
  const [subjectAnswers, setSubjectAnswers] =
    useState<EvaluationAnswers>(initialAnswers);
  const [hasBeneficiaryController, setHasBeneficiaryController] =
    useState(false);
  const [beneficiaryAnswers, setBeneficiaryAnswers] =
    useState<EvaluationAnswers>(initialAnswers);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(EXPEDIENTE_DETALLE_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as ExpedienteDetalle[]) : [];
      setExpedientes(
        Array.isArray(parsed) ? parsed.filter((item) => item?.rfc) : [],
      );
    } catch (_error) {
      setExpedientes([]);
    }

    try {
      const raw = window.localStorage.getItem(OPERACIONES_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as OperacionCliente[]) : [];
      setOperaciones(
        Array.isArray(parsed)
          ? parsed.filter((item) => item?.id && item?.rfc)
          : [],
      );
    } catch (_error) {
      setOperaciones([]);
    }

    try {
      const raw = window.localStorage.getItem(EBR_STORAGE_KEY);
      const parsed = raw
        ? (JSON.parse(raw) as Record<string, StoredEvaluation>)
        : {};
      setEvaluacionesGuardadas(parsed);
    } catch (_error) {
      setEvaluacionesGuardadas({});
    }
  }, []);

  const clientesDisponibles = useMemo(() => {
    const map = new Map<string, { rfc: string; nombre: string }>();
    expedientes.forEach((item) =>
      map.set(item.rfc, { rfc: item.rfc, nombre: item.nombre }),
    );
    operaciones.forEach((item) => {
      if (!map.has(item.rfc)) {
        map.set(item.rfc, { rfc: item.rfc, nombre: item.cliente || item.rfc });
      }
    });
    return Array.from(map.values());
  }, [expedientes, operaciones]);

  useEffect(() => {
    if (clienteSeleccionado || clientesDisponibles.length === 0) return;
    setClienteSeleccionado(clientesDisponibles[0].rfc);
  }, [clienteSeleccionado, clientesDisponibles]);

  useEffect(() => {
    if (!clienteSeleccionado) return;
    const stored = evaluacionesGuardadas[clienteSeleccionado];
    if (!stored) {
      setClientAnswers(initialAnswers);
      setSubjectAnswers(initialAnswers);
      setHasBeneficiaryController(false);
      setBeneficiaryAnswers(initialAnswers);
      setNotes("");
      return;
    }

    setClientAnswers(stored.clientAnswers ?? initialAnswers);
    setSubjectAnswers(stored.subjectAnswers ?? initialAnswers);
    setHasBeneficiaryController(stored.hasBeneficiaryController);
    setBeneficiaryAnswers(stored.beneficiaryAnswers ?? initialAnswers);
    setNotes(stored.notes);
  }, [clienteSeleccionado, evaluacionesGuardadas]);

  const expedienteActual = useMemo(
    () => expedientes.find((item) => item.rfc === clienteSeleccionado) ?? null,
    [expedientes, clienteSeleccionado],
  );

  const operacionesCliente = useMemo(
    () => operaciones.filter((item) => item.rfc === clienteSeleccionado),
    [operaciones, clienteSeleccionado],
  );

  const clientResult = useMemo(
    () => calculateRisk(clientAnswers, true, "Cliente"),
    [clientAnswers],
  );
  const subjectResult = useMemo(
    () => calculateRisk(subjectAnswers, true, "Sujeto obligado"),
    [subjectAnswers],
  );
  const beneficiaryResult = useMemo(
    () =>
      hasBeneficiaryController
        ? calculateRisk(beneficiaryAnswers, false, "Beneficiario controlador")
        : null,
    [hasBeneficiaryController, beneficiaryAnswers],
  );

  const finalLevel = useMemo(() => {
    const levels = [
      clientResult.level,
      subjectResult.level,
      beneficiaryResult?.level,
    ].filter(Boolean) as ScoredResult["level"][];
    if (levels.includes("Reforzado")) return "Reforzado";
    if (levels.includes("Alto")) return "Alto";
    if (levels.includes("Medio")) return "Medio";
    return "Bajo";
  }, [clientResult.level, subjectResult.level, beneficiaryResult?.level]);

  const riskBadgeStyles = {
    Bajo: "bg-emerald-100 text-emerald-700",
    Medio: "bg-amber-100 text-amber-700",
    Alto: "bg-orange-100 text-orange-700",
    Reforzado: "bg-rose-100 text-rose-700",
  };

  const savedEvaluation = evaluacionesGuardadas[clienteSeleccionado];

  const toggleMultiValue = (
    current: string[],
    value: string,
    onChange: (next: string[]) => void,
  ) => {
    if (current.includes(value))
      onChange(current.filter((item) => item !== value));
    else onChange([...current, value]);
  };

  const saveEvaluation = () => {
    if (!clienteSeleccionado || typeof window === "undefined") return;
    const updated: StoredEvaluation = {
      rfc: clienteSeleccionado,
      clientAnswers,
      subjectAnswers,
      hasBeneficiaryController,
      beneficiaryAnswers,
      notes,
      updatedAt: new Date().toISOString(),
    };
    const next = { ...evaluacionesGuardadas, [clienteSeleccionado]: updated };
    setEvaluacionesGuardadas(next);
    window.localStorage.setItem(EBR_STORAGE_KEY, JSON.stringify(next));
  };

  const deleteEvaluation = () => {
    if (!clienteSeleccionado || typeof window === "undefined") return;
    const next = { ...evaluacionesGuardadas };
    delete next[clienteSeleccionado];
    setEvaluacionesGuardadas(next);
    window.localStorage.setItem(EBR_STORAGE_KEY, JSON.stringify(next));
    setClientAnswers(initialAnswers);
    setSubjectAnswers(initialAnswers);
    setHasBeneficiaryController(false);
    setBeneficiaryAnswers(initialAnswers);
    setNotes("");
  };

  const exportPdfReport = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "a4",
    });
    const margin = 40;
    const lineHeight = 15;
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = doc.internal.pageSize.getWidth() - margin * 2;
    let y = 54;

    const addLine = (text: string, font = 10) => {
      doc.setFontSize(font);
      const lines = doc.splitTextToSize(text, contentWidth);
      if (y + lines.length * lineHeight > pageHeight - 40) {
        doc.addPage();
        y = 54;
      }
      doc.text(lines, margin, y);
      y += lines.length * lineHeight + 4;
    };

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 68, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("Reporte EBR - Cliente y Sujeto Obligado", margin, 34);
    doc.setFontSize(10);
    doc.text(
      `Cliente: ${expedienteActual?.nombre ?? "Sin nombre"} | RFC: ${clienteSeleccionado || "N/A"}`,
      margin,
      50,
    );

    y = 90;
    doc.setTextColor(31, 41, 55);
    addLine(`Resumen ejecutivo: Riesgo final ${finalLevel}.`);
    addLine(
      `Cliente: ${clientResult.level} (${clientResult.percent}%). Regla: ${clientResult.reason}.`,
    );
    addLine(
      `Sujeto obligado: ${subjectResult.level} (${subjectResult.percent}%). Regla: ${subjectResult.reason}.`,
    );
    if (beneficiaryResult) {
      addLine(
        `Beneficiario controlador: ${beneficiaryResult.level} (${beneficiaryResult.percent}%). Regla: ${beneficiaryResult.reason}.`,
      );
    }

    addLine("\nDetalle por cuestionario", 12);
    clientResult.details.forEach((item) =>
      addLine(`- ${item.question}: ${item.answer}. Puntaje ${item.score}.`),
    );
    subjectResult.details.forEach((item) =>
      addLine(`- ${item.question}: ${item.answer}. Puntaje ${item.score}.`),
    );
    if (beneficiaryResult) {
      beneficiaryResult.details.forEach((item) =>
        addLine(`- ${item.question}: ${item.answer}. Puntaje ${item.score}.`),
      );
    }

    addLine("\nObservaciones", 12);
    addLine(notes || "Sin observaciones");
    doc.save(`ebr-${clienteSeleccionado || "cliente"}.pdf`);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">{t.ebrTitle}</h1>
          <p className="text-muted-foreground mt-2 max-w-3xl">
            Evaluación integrada con cuestionarios separados para Cliente y
            Sujeto Obligado, lista de países y consolidación del perfil.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/actividades-vulnerables">
              <FileText className="mr-2 h-4 w-4" />
              Ver operaciones
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/kyc-expediente">
              <ShieldCheck className="mr-2 h-4 w-4" />
              Ver expediente
            </Link>
          </Button>
          <Button onClick={saveEvaluation}>
            <ClipboardCheck className="mr-2 h-4 w-4" />
            {savedEvaluation ? "Actualizar evaluación" : "Guardar evaluación"}
          </Button>
          <Button
            variant="destructive"
            onClick={deleteEvaluation}
            disabled={!savedEvaluation}
          >
            Borrar evaluación
          </Button>
        </div>
      </div>

      <Card className="border-blue-100 bg-blue-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <CircleHelp className="h-5 w-5" />
            Metodología y reglas automáticas
          </CardTitle>
          <CardDescription className="text-blue-800">
            Si hay 1 respuesta de 4 puntos =&gt; Alto. Si hay 2 o más respuestas
            de 4 puntos =&gt; Reforzado.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-blue-900 space-y-1">
          <p>1) Contesta cuestionario de Cliente.</p>
          <p>2) Contesta cuestionario de Sujeto Obligado.</p>
          <p>
            3) Si existe Beneficiario Controlador, activa su sección y completa
            preguntas 1,2,5,6,7,8.
          </p>
          <p>
            4) El reporte integra los tres perfiles con conclusión consolidada.
          </p>
          <a
            href="https://www.gob.mx/cms/uploads/attachment/file/1035629/Listas_de_reg_menes_fiscales_preferentes.pdf"
            target="_blank"
            rel="noreferrer"
            className="inline-block pt-1 underline"
          >
            Referencia SAT: regímenes fiscales preferentes
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conexión con expediente y operaciones</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Cliente seleccionado</Label>
            <Select
              value={clienteSeleccionado}
              onValueChange={setClienteSeleccionado}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientesDisponibles.map((cliente) => (
                  <SelectItem key={cliente.rfc} value={cliente.rfc}>
                    {cliente.nombre} ({cliente.rfc})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase text-muted-foreground">
              Expediente
            </p>
            <p className="font-medium">
              {expedienteActual?.nombre ?? "Pendiente"}
            </p>
            <p className="text-sm text-muted-foreground">
              {expedienteActual?.tipoCliente ?? "Sin tipo"}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase text-muted-foreground">
              Operaciones vinculadas
            </p>
            <p className="font-medium">{operacionesCliente.length}</p>
            <p className="text-sm text-muted-foreground">
              Guardada:{" "}
              {savedEvaluation ? formatDate(savedEvaluation.updatedAt) : "No"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Riesgo final consolidado</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {finalLevel}
              <Badge className={riskBadgeStyles[finalLevel]}>
                {Math.max(clientResult.percent, subjectResult.percent)}%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Integra Cliente, Sujeto Obligado y Beneficiario Controlador.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Cliente</CardDescription>
            <CardTitle className="text-2xl">
              {clientResult.total}/{clientResult.max}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={clientResult.percent} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Sujeto obligado</CardDescription>
            <CardTitle className="text-2xl">
              {subjectResult.total}/{subjectResult.max}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={subjectResult.percent} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Beneficiario controlador</CardDescription>
            <CardTitle className="text-2xl">
              {hasBeneficiaryController
                ? (beneficiaryResult?.level ?? "-")
                : "No aplica"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {hasBeneficiaryController
              ? `Puntaje ${beneficiaryResult?.total}/${beneficiaryResult?.max}`
              : "Termina cuestionario"}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="cuestionarios" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cuestionarios">Cuestionarios</TabsTrigger>
          <TabsTrigger value="reporte">Reporte y resumen</TabsTrigger>
        </TabsList>

        <TabsContent value="cuestionarios" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cuestionario del Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <QuestionnaireForm
                answers={clientAnswers}
                setAnswers={setClientAnswers}
                includeBankAndBehavior
                titlePrefix="Cliente"
                toggleMultiValue={toggleMultiValue}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cuestionario del Sujeto Obligado</CardTitle>
            </CardHeader>
            <CardContent>
              <QuestionnaireForm
                answers={subjectAnswers}
                setAnswers={setSubjectAnswers}
                includeBankAndBehavior
                titlePrefix="Sujeto obligado"
                toggleMultiValue={toggleMultiValue}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Beneficiario Controlador</CardTitle>
              <CardDescription>
                Si no existe, aquí concluye el flujo adicional.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={hasBeneficiaryController}
                  onCheckedChange={(checked) =>
                    setHasBeneficiaryController(Boolean(checked))
                  }
                />
                <p className="text-sm">Existe Beneficiario Controlador</p>
              </div>

              {hasBeneficiaryController ? (
                <QuestionnaireForm
                  answers={beneficiaryAnswers}
                  setAnswers={setBeneficiaryAnswers}
                  includeBankAndBehavior={false}
                  titlePrefix="Beneficiario controlador"
                  toggleMultiValue={toggleMultiValue}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Observaciones clave</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                className="min-h-[120px]"
                placeholder="Documenta evidencia, fuentes y medidas de mitigación."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reporte" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumen del perfil consolidado</CardTitle>
              <CardDescription>
                Resultado por cliente, sujeto obligado y beneficiario
                controlador.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ResultCard
                title="Cliente"
                result={clientResult}
                riskBadgeStyles={riskBadgeStyles}
              />
              <ResultCard
                title="Sujeto obligado"
                result={subjectResult}
                riskBadgeStyles={riskBadgeStyles}
              />
              {beneficiaryResult ? (
                <ResultCard
                  title="Beneficiario controlador"
                  result={beneficiaryResult}
                  riskBadgeStyles={riskBadgeStyles}
                />
              ) : null}

              <div className="rounded-lg border border-dashed p-4">
                <p className="text-sm font-medium">Conclusión</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nivel final del expediente: <strong>{finalLevel}</strong>.
                  Aplicar controles de acuerdo con el nivel más alto detectado.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {notes || "Sin observaciones registradas."}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                <div>
                  <p className="font-medium">Exportación</p>
                  <p className="text-sm text-muted-foreground">
                    Incluye detalle por cuestionario y resumen ejecutivo.
                  </p>
                </div>
                <Button variant="outline" onClick={exportPdfReport}>
                  <FileText className="mr-2 h-4 w-4" />
                  Exportar PDF
                </Button>
              </div>

              {clientResult.fours > 0 ||
              subjectResult.fours > 0 ||
              (beneficiaryResult?.fours ?? 0) > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
                  <p className="text-sm text-amber-800">
                    Se detectaron respuestas con 4 puntos. Revisar debida
                    diligencia reforzada.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QuestionnaireForm({
  answers,
  setAnswers,
  includeBankAndBehavior,
  titlePrefix,
  toggleMultiValue,
}: {
  answers: EvaluationAnswers;
  setAnswers: (updater: (prev: EvaluationAnswers) => EvaluationAnswers) => void;
  includeBankAndBehavior: boolean;
  titlePrefix: string;
  toggleMultiValue: (
    current: string[],
    value: string,
    onChange: (next: string[]) => void,
  ) => void;
}) {
  const [countrySearch, setCountrySearch] = useState("");

  const filteredCountries = useMemo(() => {
    const query = normalizeCountryName(countrySearch);
    if (!query) return PAISES;
    const queryTerms = query.split(" ");

    return PAISES.filter((pais) =>
      queryTerms.every((term) => {
        const normalizedLabel = normalizeCountryName(pais.label);
        const normalizedCode = normalizeCountryName(pais.code);

        return (
          normalizedLabel.includes(term) || normalizedCode.includes(term)
        );
      }),
    );
  }, [countrySearch]);

  useEffect(() => {
    const countryName =
      PAISES.find((pais) => pais.code === answers.nationalityCountryCode)?.label ??
      "";
    const automaticRisk = getNationalityRiskByCountry(countryName);

    if (answers.nationalityRisk !== automaticRisk) {
      setAnswers((prev) => ({ ...prev, nationalityRisk: automaticRisk }));
    }
  }, [answers.nationalityCountryCode, answers.nationalityRisk, setAnswers]);

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <QuestionSelect
          label={`1) Nivel de riesgo de nacionalidad (${titlePrefix})`}
          value={answers.nationalityRisk}
          options={NATIONALITY_OPTIONS}
          onChange={() => undefined}
          disabled
        />
        <div className="space-y-2">
          <Label>País de nacionalidad ({titlePrefix})</Label>
          <Input
            value={countrySearch}
            onChange={(event) => setCountrySearch(event.target.value)}
            placeholder="Buscar país"
          />
          <Select
            value={answers.nationalityCountryCode}
            onValueChange={(value) =>
              setAnswers((prev) => ({
                ...prev,
                nationalityCountryCode: value,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecciona país" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <div className="max-h-72 overflow-y-auto">
                {filteredCountries.length > 0 ? (
                  filteredCountries.map((pais) => (
                    <SelectItem key={pais.code} value={pais.code}>
                      {pais.label}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-2 text-sm text-muted-foreground">
                    No se encontraron países
                  </div>
                )}
              </div>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            El nivel de riesgo se asigna automáticamente según el país
            seleccionado. Si el país no pertenece a una lista especial, se
            clasifica como "Todos los demás países".
          </p>
        </div>
      </div>

      <QuestionSelect
        label={`2) PEP o relación con PEP (${titlePrefix})`}
        value={answers.pep}
        options={PEP_OPTIONS}
        onChange={(value) => setAnswers((prev) => ({ ...prev, pep: value }))}
      />

      {includeBankAndBehavior ? (
        <>
          <QuestionSelect
            label={`3) Institución bancaria (${titlePrefix})`}
            value={answers.bankInstitution}
            options={BANK_OPTIONS}
            onChange={(value) =>
              setAnswers((prev) => ({ ...prev, bankInstitution: value }))
            }
          />
          <div className="space-y-2">
            <Label>4) Acciones observadas ({titlePrefix})</Label>
            <div className="grid gap-2 rounded-md border p-3">
              {SUSPICIOUS_BEHAVIORS.map((behavior) => (
                <label
                  key={behavior.value}
                  className="flex items-start gap-2 text-sm"
                >
                  <Checkbox
                    checked={answers.suspiciousBehaviors.includes(
                      behavior.value,
                    )}
                    onCheckedChange={() =>
                      toggleMultiValue(
                        answers.suspiciousBehaviors,
                        behavior.value,
                        (next) =>
                          setAnswers((prev) => ({
                            ...prev,
                            suspiciousBehaviors: next,
                          })),
                      )
                    }
                  />
                  <span>{behavior.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              El puntaje toma la alerta de mayor severidad seleccionada.
            </p>
          </div>
        </>
      ) : null}

      <div className="space-y-2">
        <Label>5) Fuentes de ingresos ({titlePrefix})</Label>
        <div className="grid gap-2 rounded-md border p-3 md:grid-cols-2">
          {INCOME_SOURCES.map((source) => (
            <label
              key={source.value}
              className="flex items-start gap-2 text-sm"
            >
              <Checkbox
                checked={answers.incomeSources.includes(source.value)}
                onCheckedChange={() =>
                  toggleMultiValue(
                    answers.incomeSources,
                    source.value,
                    (next) =>
                      setAnswers((prev) => ({
                        ...prev,
                        incomeSources: next as IncomeSourceId[],
                      })),
                  )
                }
              />
              <span>{source.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>6) Giro por uso de efectivo ({titlePrefix})</Label>
        <Select
          value={answers.cashExposure}
          onValueChange={(value: CashExposure) =>
            setAnswers((prev) => ({ ...prev, cashExposure: value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecciona nivel" />
          </SelectTrigger>
          <SelectContent>
            {CASH_EXPOSURE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <QuestionSelect
        label={`7) ONG/beneficencia no regulada (${titlePrefix})`}
        value={answers.ngoNonRegulated}
        options={NGO_OPTIONS}
        onChange={(value) =>
          setAnswers((prev) => ({ ...prev, ngoNonRegulated: value }))
        }
      />
      <QuestionSelect
        label={`8) Fecha de creación de la institución (${titlePrefix})`}
        value={answers.institutionAge}
        options={INSTITUTION_AGE_OPTIONS}
        onChange={(value) =>
          setAnswers((prev) => ({ ...prev, institutionAge: value }))
        }
      />
    </div>
  );
}

function ResultCard({
  title,
  result,
  riskBadgeStyles,
}: {
  title: string;
  result: ScoredResult;
  riskBadgeStyles: Record<string, string>;
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase text-muted-foreground">{title}</p>
      <div className="mt-2 flex items-center gap-2">
        <Badge className={riskBadgeStyles[result.level]}>{result.level}</Badge>
        <p className="font-semibold">
          {result.total}/{result.max}
        </p>
      </div>
      <p className="text-sm text-muted-foreground mt-2">{result.reason}</p>
    </div>
  );
}

function QuestionSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Selecciona" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
