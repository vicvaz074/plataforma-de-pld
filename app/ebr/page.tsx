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
import { translations } from "@/lib/translations";

interface ExpedienteDetalle {
  rfc: string;
  nombre: string;
  tipoCliente?: string;
  actualizadoEn?: string;
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
  nationality: string;
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
  answers: EvaluationAnswers;
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
    label: "Alto nivel de corrupción (Top 80 final TI)",
    score: 2,
  },
  { value: "other", label: "Otros países", score: 1 },
];

const PEP_OPTIONS = [
  { value: "pep", label: "Es Persona Políticamente Expuesta", score: 4 },
  {
    value: "first_degree",
    label: "Cónyuge o familiar en primer grado",
    score: 3,
  },
  {
    value: "second_degree",
    label: "Familiar de consanguinidad/afinidad segundo grado",
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
    label: "Compra directa sin interés en el producto",
    score: 3,
  },
  {
    value: "split_cash",
    label: "Solicita fragmentación y pago en efectivo",
    score: 3,
  },
  { value: "urgent_close", label: "Muestra urgencia injustificada", score: 2 },
  {
    value: "report_threshold",
    label: "Solicita conocer umbrales de reporte",
    score: 2,
  },
  {
    value: "narrative_inconsistency",
    label: "Inconsistencias ligeras en narrativa",
    score: 2,
  },
  {
    value: "avoid_id",
    label: "Evita identificación/documentación obligatoria",
    score: 3,
  },
  {
    value: "avoid_ubf",
    label: "Evita información de Beneficiario Final",
    score: 3,
  },
  {
    value: "invoice_change",
    label: "Solicita modificar facturación sin causa",
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
  { value: "private_lt_2", label: "Privada con menos de 2 años", score: 4 },
  { value: "private_lt_5", label: "Privada con menos de 5 años", score: 3 },
  { value: "private_lt_10", label: "Privada con menos de 10 años", score: 2 },
  {
    value: "public_or_mature",
    label: "Pública o privada mayor a 10 años / N/A",
    score: 1,
  },
];

const initialAnswers: EvaluationAnswers = {
  nationality: "other",
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
): ScoredResult => {
  const details: ScoredResult["details"] = [
    {
      question: "Nacionalidad del cliente",
      score: getOptionScore(answers.nationality, NATIONALITY_OPTIONS),
      answer:
        NATIONALITY_OPTIONS.find(
          (option) => option.value === answers.nationality,
        )?.label ?? "N/A",
    },
    {
      question: "PEP o relación con PEP",
      score: getOptionScore(answers.pep, PEP_OPTIONS),
      answer:
        PEP_OPTIONS.find((option) => option.value === answers.pep)?.label ??
        "N/A",
    },
    {
      question: "Fuentes de ingresos + giro",
      score: getIncomeRiskScore(answers.incomeSources, answers.cashExposure),
      answer: `${answers.incomeSources.length || 0} fuente(s), giro ${answers.cashExposure}`,
    },
    {
      question: "ONG/beneficencia no regulada",
      score: getOptionScore(answers.ngoNonRegulated, NGO_OPTIONS),
      answer:
        NGO_OPTIONS.find((option) => option.value === answers.ngoNonRegulated)
          ?.label ?? "N/A",
    },
    {
      question: "Antigüedad de institución",
      score: getOptionScore(answers.institutionAge, INSTITUTION_AGE_OPTIONS),
      answer:
        INSTITUTION_AGE_OPTIONS.find(
          (option) => option.value === answers.institutionAge,
        )?.label ?? "N/A",
    },
  ];

  if (includeBankAndBehavior) {
    details.splice(
      2,
      0,
      {
        question: "Institución bancaria",
        score: getOptionScore(answers.bankInstitution, BANK_OPTIONS),
        answer:
          BANK_OPTIONS.find(
            (option) => option.value === answers.bankInstitution,
          )?.label ?? "N/A",
      },
      {
        question: "Acciones observadas del cliente",
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

  const [answers, setAnswers] = useState<EvaluationAnswers>(initialAnswers);
  const [hasBeneficiaryController, setHasBeneficiaryController] =
    useState(false);
  const [beneficiaryAnswers, setBeneficiaryAnswers] =
    useState<EvaluationAnswers>(initialAnswers);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedExpedientes = window.localStorage.getItem(
        EXPEDIENTE_DETALLE_STORAGE_KEY,
      );
      const parsed = storedExpedientes
        ? (JSON.parse(storedExpedientes) as ExpedienteDetalle[])
        : [];
      setExpedientes(
        Array.isArray(parsed) ? parsed.filter((item) => item?.rfc) : [],
      );
    } catch (_error) {
      setExpedientes([]);
    }

    try {
      const storedOperaciones = window.localStorage.getItem(
        OPERACIONES_STORAGE_KEY,
      );
      const parsed = storedOperaciones
        ? (JSON.parse(storedOperaciones) as OperacionCliente[])
        : [];
      setOperaciones(
        Array.isArray(parsed)
          ? parsed.filter((item) => item?.id && item?.rfc)
          : [],
      );
    } catch (_error) {
      setOperaciones([]);
    }

    try {
      const storedEvaluaciones = window.localStorage.getItem(EBR_STORAGE_KEY);
      const parsed = storedEvaluaciones
        ? (JSON.parse(storedEvaluaciones) as Record<string, StoredEvaluation>)
        : {};
      setEvaluacionesGuardadas(parsed);
    } catch (_error) {
      setEvaluacionesGuardadas({});
    }
  }, []);

  const clientesDisponibles = useMemo(() => {
    const mapa = new Map<string, { rfc: string; nombre: string }>();
    expedientes.forEach((expediente) =>
      mapa.set(expediente.rfc, {
        rfc: expediente.rfc,
        nombre: expediente.nombre,
      }),
    );
    operaciones.forEach((operacion) => {
      if (!mapa.has(operacion.rfc)) {
        mapa.set(operacion.rfc, {
          rfc: operacion.rfc,
          nombre: operacion.cliente || operacion.rfc,
        });
      }
    });
    return Array.from(mapa.values());
  }, [expedientes, operaciones]);

  useEffect(() => {
    if (clienteSeleccionado || clientesDisponibles.length === 0) return;
    setClienteSeleccionado(clientesDisponibles[0].rfc);
  }, [clienteSeleccionado, clientesDisponibles]);

  useEffect(() => {
    if (!clienteSeleccionado) return;
    const stored = evaluacionesGuardadas[clienteSeleccionado];
    if (!stored) {
      setAnswers(initialAnswers);
      setHasBeneficiaryController(false);
      setBeneficiaryAnswers(initialAnswers);
      setNotes("");
      return;
    }

    setAnswers(stored.answers);
    setHasBeneficiaryController(stored.hasBeneficiaryController);
    setBeneficiaryAnswers(stored.beneficiaryAnswers ?? initialAnswers);
    setNotes(stored.notes);
  }, [clienteSeleccionado, evaluacionesGuardadas]);

  const expedienteActual = useMemo(
    () =>
      expedientes.find(
        (expediente) => expediente.rfc === clienteSeleccionado,
      ) ?? null,
    [expedientes, clienteSeleccionado],
  );

  const operacionesCliente = useMemo(
    () =>
      operaciones.filter((operacion) => operacion.rfc === clienteSeleccionado),
    [operaciones, clienteSeleccionado],
  );

  const mainResult = useMemo(() => calculateRisk(answers, true), [answers]);
  const beneficiaryResult = useMemo(
    () =>
      hasBeneficiaryController
        ? calculateRisk(beneficiaryAnswers, false)
        : null,
    [hasBeneficiaryController, beneficiaryAnswers],
  );

  const finalLevel = useMemo(() => {
    const levels = [mainResult.level, beneficiaryResult?.level].filter(
      Boolean,
    ) as ScoredResult["level"][];
    if (levels.includes("Reforzado")) return "Reforzado";
    if (levels.includes("Alto")) return "Alto";
    if (levels.includes("Medio")) return "Medio";
    return "Bajo";
  }, [mainResult, beneficiaryResult]);

  const riskBadgeStyles = {
    Bajo: "bg-emerald-100 text-emerald-700",
    Medio: "bg-amber-100 text-amber-700",
    Alto: "bg-orange-100 text-orange-700",
    Reforzado: "bg-rose-100 text-rose-700",
  };

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
      answers,
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
    setAnswers(initialAnswers);
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
    doc.text("Reporte EBR - Evaluación Basada en Riesgo", margin, 34);
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
      `Perfil principal: ${mainResult.level} (${mainResult.percent}%). Regla: ${mainResult.reason}.`,
    );
    if (beneficiaryResult) {
      addLine(
        `Perfil beneficiario controlador: ${beneficiaryResult.level} (${beneficiaryResult.percent}%). Regla: ${beneficiaryResult.reason}.`,
      );
    }

    addLine("\nDetalle del perfil principal", 12);
    mainResult.details.forEach((detail) =>
      addLine(
        `- ${detail.question}: ${detail.answer}. Puntaje ${detail.score}.`,
      ),
    );

    if (beneficiaryResult) {
      addLine("\nDetalle del beneficiario controlador", 12);
      beneficiaryResult.details.forEach((detail) =>
        addLine(
          `- ${detail.question}: ${detail.answer}. Puntaje ${detail.score}.`,
        ),
      );
    }

    addLine("\nObservaciones", 12);
    addLine(notes || "Sin observaciones");

    doc.save(`ebr-${clienteSeleccionado || "cliente"}.pdf`);
  };

  const savedEvaluation = evaluacionesGuardadas[clienteSeleccionado];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">{t.ebrTitle}</h1>
          <p className="text-muted-foreground mt-2 max-w-3xl">
            Metodología EBR fortalecida con reglas automáticas, orientación paso
            a paso y reporte ejecutivo del perfil.
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
            Guía rápida de metodología
          </CardTitle>
          <CardDescription className="text-blue-800">
            Regla general: si existe una respuesta con 4 puntos el riesgo es
            automático Alto; con dos o más respuestas de 4 puntos, el nivel pasa
            a Reforzado.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-blue-900 space-y-1">
          <p>1) Completa las 8 preguntas del perfil principal.</p>
          <p>
            2) Si existe beneficiario controlador, activa la segunda parte y
            responde preguntas 1, 2, 5, 6, 7 y 8.
          </p>
          <p>
            3) El reporte resume nivel, motivos automáticos, detalle por
            pregunta y observaciones.
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
            <CardDescription>Riesgo final</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {finalLevel}
              <Badge className={riskBadgeStyles[finalLevel]}>
                {mainResult.percent}%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {mainResult.reason}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Perfil principal</CardDescription>
            <CardTitle className="text-2xl">
              {mainResult.total}/{mainResult.max}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={mainResult.percent} className="h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Reglas automáticas</CardDescription>
            <CardTitle className="text-2xl">
              {mainResult.fours} respuesta(s) de 4
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {mainResult.fours >= 2
              ? "Aplicó reforzado"
              : mainResult.fours === 1
                ? "Aplicó alto automático"
                : "Sin automático"}
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

      <Tabs defaultValue="cuestionario" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cuestionario">Cuestionario EBR</TabsTrigger>
          <TabsTrigger value="reporte">Reporte y resumen</TabsTrigger>
        </TabsList>

        <TabsContent value="cuestionario" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Primera parte: perfil principal</CardTitle>
              <CardDescription>
                Completa cada pregunta según la metodología definida.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <QuestionSelect
                label="1) Nacionalidad del cliente"
                value={answers.nationality}
                options={NATIONALITY_OPTIONS}
                onChange={(value) =>
                  setAnswers((prev) => ({ ...prev, nationality: value }))
                }
              />
              <QuestionSelect
                label="2) PEP o relación con PEP"
                value={answers.pep}
                options={PEP_OPTIONS}
                onChange={(value) =>
                  setAnswers((prev) => ({ ...prev, pep: value }))
                }
              />
              <QuestionSelect
                label="3) Institución bancaria que utiliza"
                value={answers.bankInstitution}
                options={BANK_OPTIONS}
                onChange={(value) =>
                  setAnswers((prev) => ({ ...prev, bankInstitution: value }))
                }
              />

              <div className="space-y-2">
                <Label>
                  4) Acciones observadas del cliente (puedes seleccionar varias)
                </Label>
                <p className="text-xs text-muted-foreground">
                  El puntaje de esta pregunta toma la alerta de mayor gravedad
                  seleccionada.
                </p>
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
              </div>

              <div className="space-y-2">
                <Label>5) Fuentes de ingresos (selección múltiple)</Label>
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
                <Label>6) Giro de negocio por nivel de uso de efectivo</Label>
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
                <p className="text-xs text-muted-foreground">
                  La puntuación se calcula automáticamente combinando fuente de
                  ingresos y nivel de uso de efectivo.
                </p>
              </div>

              <QuestionSelect
                label="7) ONG/beneficencia no regulada"
                value={answers.ngoNonRegulated}
                options={NGO_OPTIONS}
                onChange={(value) =>
                  setAnswers((prev) => ({ ...prev, ngoNonRegulated: value }))
                }
              />
              <QuestionSelect
                label="8) Fecha de creación de la institución"
                value={answers.institutionAge}
                options={INSTITUTION_AGE_OPTIONS}
                onChange={(value) =>
                  setAnswers((prev) => ({ ...prev, institutionAge: value }))
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Segunda parte: beneficiario controlador</CardTitle>
              <CardDescription>
                Si no existe, el cuestionario termina aquí.
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
                <p className="text-sm">Existe un beneficiario controlador</p>
              </div>

              {hasBeneficiaryController ? (
                <div className="grid gap-4 rounded-lg border border-dashed p-4">
                  <QuestionSelect
                    label="1) Nacionalidad del beneficiario"
                    value={beneficiaryAnswers.nationality}
                    options={NATIONALITY_OPTIONS}
                    onChange={(value) =>
                      setBeneficiaryAnswers((prev) => ({
                        ...prev,
                        nationality: value,
                      }))
                    }
                  />
                  <QuestionSelect
                    label="2) PEP o relación con PEP"
                    value={beneficiaryAnswers.pep}
                    options={PEP_OPTIONS}
                    onChange={(value) =>
                      setBeneficiaryAnswers((prev) => ({ ...prev, pep: value }))
                    }
                  />
                  <div className="space-y-2">
                    <Label>5) Fuentes de ingresos</Label>
                    <div className="grid gap-2 rounded-md border p-3 md:grid-cols-2">
                      {INCOME_SOURCES.map((source) => (
                        <label
                          key={source.value}
                          className="flex items-start gap-2 text-sm"
                        >
                          <Checkbox
                            checked={beneficiaryAnswers.incomeSources.includes(
                              source.value,
                            )}
                            onCheckedChange={() =>
                              toggleMultiValue(
                                beneficiaryAnswers.incomeSources,
                                source.value,
                                (next) =>
                                  setBeneficiaryAnswers((prev) => ({
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
                    <Label>6) Giro por uso de efectivo</Label>
                    <Select
                      value={beneficiaryAnswers.cashExposure}
                      onValueChange={(value: CashExposure) =>
                        setBeneficiaryAnswers((prev) => ({
                          ...prev,
                          cashExposure: value,
                        }))
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
                    label="7) ONG/beneficencia no regulada"
                    value={beneficiaryAnswers.ngoNonRegulated}
                    options={NGO_OPTIONS}
                    onChange={(value) =>
                      setBeneficiaryAnswers((prev) => ({
                        ...prev,
                        ngoNonRegulated: value,
                      }))
                    }
                  />
                  <QuestionSelect
                    label="8) Fecha de creación de la institución"
                    value={beneficiaryAnswers.institutionAge}
                    options={INSTITUTION_AGE_OPTIONS}
                    onChange={(value) =>
                      setBeneficiaryAnswers((prev) => ({
                        ...prev,
                        institutionAge: value,
                      }))
                    }
                  />
                </div>
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
                placeholder="Documenta sustento, fuentes externas y decisiones de mitigación."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reporte" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Resumen del perfil</CardTitle>
              <CardDescription>
                Visión ejecutiva para auditoría y toma de decisiones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Perfil principal
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className={riskBadgeStyles[mainResult.level]}>
                      {mainResult.level}
                    </Badge>
                    <p className="font-semibold">
                      {mainResult.total}/{mainResult.max}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {mainResult.reason}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase text-muted-foreground">
                    Beneficiario controlador
                  </p>
                  {beneficiaryResult ? (
                    <>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge
                          className={riskBadgeStyles[beneficiaryResult.level]}
                        >
                          {beneficiaryResult.level}
                        </Badge>
                        <p className="font-semibold">
                          {beneficiaryResult.total}/{beneficiaryResult.max}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        {beneficiaryResult.reason}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No aplica
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-dashed p-4">
                <p className="text-sm font-medium">Conclusión consolidada</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  El nivel final del expediente es <strong>{finalLevel}</strong>{" "}
                  considerando la regla automática y ambos cuestionarios.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {notes || "Sin observaciones registradas."}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
                <div>
                  <p className="font-medium">Exportación del reporte</p>
                  <p className="text-sm text-muted-foreground">
                    Incluye resumen del perfil, reglas activadas y detalle de
                    respuestas.
                  </p>
                </div>
                <Button variant="outline" onClick={exportPdfReport}>
                  <FileText className="mr-2 h-4 w-4" />
                  Exportar PDF
                </Button>
              </div>

              {mainResult.fours > 0 || (beneficiaryResult?.fours ?? 0) > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
                  <p className="text-sm text-amber-800">
                    Se detectaron respuestas de nivel 4. Verifica aplicación de
                    debida diligencia reforzada y monitoreo incrementado.
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

function QuestionSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
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
