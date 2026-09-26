"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { jsPDF } from "jspdf";
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  CircleHelp,
  ClipboardCheck,
  FileText,
  Search,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { matchPepCargo, normalizeName, PEP_SEARCH_HISTORY_STORAGE_KEY, type PepScreeningResult, type PepSearchResponse } from "@/lib/pld";
import { translations } from "@/lib/translations";
import {
  BANK_OPTIONS, CASH_EXPOSURE_OPTIONS, INCOME_SOURCES, INSTITUTION_AGE_OPTIONS,
  NATIONALITY_OPTIONS, NGO_OPTIONS, PEP_OPTIONS, SUSPICIOUS_BEHAVIORS,
  calculateRisk, initialAnswers, normalizeEbrAnswers,
  type CashExposure, type EvaluationAnswers, type IncomeSourceId, type ScoredResult,
} from "@/lib/pld/ebr-questionnaire";
import { loadStoredPldOperations, type StoredPldOperationV3 } from "@/lib/pld/stored-operations";
import {
  buildIntegrationClients,
  findClientEbrEvaluation,
  getIntegrationClient,
  matchesIntegrationClient,
  normalizeEbrEvaluations,
  PLD_INTEGRATION_EVENT,
  readExpedienteRecords,
  saveClientEbrEvaluation,
  type IntegrationClient,
} from "@/lib/pld/integration-records";
import { useToast } from "@/components/ui/use-toast";
import { SearchableSelect } from "@/components/pld/searchable-select";

type ExpedienteDetalle = IntegrationClient;
type OperacionCliente = StoredPldOperationV3;


interface StoredEvaluation {
  schemaVersion?: number;
  clientId?: string;
  expedienteId?: string;
  riskSummary?: { level: string; score: number; percent: number };
  rfc: string;
  clientAnswers: EvaluationAnswers;
  subjectAnswers: EvaluationAnswers;
  hasBeneficiaryController: boolean;
  beneficiaryAnswers: EvaluationAnswers;
  pepCargo?: string;
  pepDependencia?: string;
  pepScreening?: PepScreeningResult;
  notes: string;
  updatedAt: string;
}


const EXPEDIENTE_DETALLE_STORAGE_KEY = "kyc_expedientes_detalle";
const OPERACIONES_STORAGE_KEY = "actividades_vulnerables_operaciones";
const EBR_STORAGE_KEY = "ebr_evaluaciones";


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
  const { toast } = useToast();
  const { language } = useLanguage();
  const t = translations[language];

  const [expedientes, setExpedientes] = useState<ExpedienteDetalle[]>([]);
  const [operaciones, setOperaciones] = useState<OperacionCliente[]>([]);
  const [evaluacionesGuardadas, setEvaluacionesGuardadas] = useState<
    Record<string, StoredEvaluation>
  >({});
  const [pepWhoisHistory, setPepWhoisHistory] = useState<PepSearchResponse[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState("");
  const loadedEvaluationRef = useRef("");

  const [clientAnswers, setClientAnswers] =
    useState<EvaluationAnswers>(initialAnswers);
  const [subjectAnswers, setSubjectAnswers] =
    useState<EvaluationAnswers>(initialAnswers);
  const [hasBeneficiaryController, setHasBeneficiaryController] =
    useState(false);
  const [beneficiaryAnswers, setBeneficiaryAnswers] =
    useState<EvaluationAnswers>(initialAnswers);
  const [pepCargo, setPepCargo] = useState("");
  const [pepDependencia, setPepDependencia] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const load = () => {
    try {
      setExpedientes(
        readExpedienteRecords(window.localStorage).map(getIntegrationClient).filter((item): item is IntegrationClient => Boolean(item)),
      );
    } catch (_error) {
      setExpedientes([]);
    }

    try {
      setOperaciones(
        loadStoredPldOperations(window.localStorage, { persistMigration: false }).operations
          .filter((item) => item.lifecycle.status === "active" && item.captureStatus !== "draft"),
      );
    } catch (_error) {
      setOperaciones([]);
    }

    try {
      const raw = window.localStorage.getItem(EBR_STORAGE_KEY);
      const evaluations = normalizeEbrEvaluations(raw ? JSON.parse(raw) : {});
      setEvaluacionesGuardadas(Object.fromEntries(evaluations.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).map((item) => [item.clientId, item as StoredEvaluation])));
    } catch (_error) {
      setEvaluacionesGuardadas({});
    }

    try {
      const raw = window.localStorage.getItem(PEP_SEARCH_HISTORY_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as PepSearchResponse[]) : [];
      setPepWhoisHistory(Array.isArray(parsed) ? parsed : []);
    } catch (_error) {
      setPepWhoisHistory([]);
    }
    };
    const onStorage = (event: StorageEvent) => {
      if (!event.key || [EXPEDIENTE_DETALLE_STORAGE_KEY, OPERACIONES_STORAGE_KEY, EBR_STORAGE_KEY, PEP_SEARCH_HISTORY_STORAGE_KEY].includes(event.key)) load();
    };
    load();
    window.addEventListener("storage", onStorage);
    window.addEventListener(PLD_INTEGRATION_EVENT, load);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PLD_INTEGRATION_EVENT, load);
    };
  }, []);

  const clientesDisponibles = useMemo(() => buildIntegrationClients(expedientes, operaciones), [expedientes, operaciones]);
  const clienteActual = useMemo(() => clientesDisponibles.find((item) => item.id === clienteSeleccionado) ?? null, [clientesDisponibles, clienteSeleccionado]);
  const savedEvaluation = useMemo(() => findClientEbrEvaluation(Object.values(evaluacionesGuardadas), clienteActual) as StoredEvaluation | null, [evaluacionesGuardadas, clienteActual]);

  useEffect(() => {
    if (clientesDisponibles.some((item) => item.id === clienteSeleccionado)) return;
    setClienteSeleccionado(clientesDisponibles[0]?.id ?? "");
  }, [clienteSeleccionado, clientesDisponibles]);

  useEffect(() => {
    if (!clienteSeleccionado) return;
    const stored = savedEvaluation;
    const loadedKey = `${clienteSeleccionado}:${JSON.stringify(stored)}`;
    if (loadedEvaluationRef.current === loadedKey) return;
    loadedEvaluationRef.current = loadedKey;
    if (!stored) {
      setClientAnswers(initialAnswers);
      setSubjectAnswers(initialAnswers);
      setHasBeneficiaryController(false);
      setBeneficiaryAnswers(initialAnswers);
      setPepCargo("");
      setPepDependencia("");
      setNotes("");
      return;
    }

    setClientAnswers(normalizeEbrAnswers(stored.clientAnswers));
    setSubjectAnswers(normalizeEbrAnswers(stored.subjectAnswers));
    setHasBeneficiaryController(Boolean(stored.hasBeneficiaryController));
    setBeneficiaryAnswers(normalizeEbrAnswers(stored.beneficiaryAnswers));
    setPepCargo(stored.pepCargo ?? "");
    setPepDependencia(stored.pepDependencia ?? "");
    setNotes(stored.notes);
  }, [clienteSeleccionado, savedEvaluation]);

  const expedienteActual = useMemo(
    () => expedientes.find((item) => item.id === clienteSeleccionado) ?? null,
    [expedientes, clienteSeleccionado],
  );

  const operacionesCliente = useMemo(
    () => clienteActual ? operaciones.filter((item) => matchesIntegrationClient(item, clienteActual)) : [],
    [operaciones, clienteActual],
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

  const pepScreening = useMemo(() => {
    if (!pepCargo.trim() && !pepDependencia.trim()) return null;
    return matchPepCargo({
      nombre: expedienteActual?.nombre,
      cargo: pepCargo,
      dependencia: pepDependencia,
      relacion: hasBeneficiaryController ? "beneficiario-controlador" : "cliente",
    });
  }, [expedienteActual?.nombre, hasBeneficiaryController, pepCargo, pepDependencia]);

  const pepWhoisActual = useMemo(() => {
    const expedienteNombre = normalizeName(expedienteActual?.nombre);
    if (!expedienteNombre) return null;
    return (
      pepWhoisHistory.find((item) => normalizeName(item.query.nombre) === expedienteNombre) ??
      null
    );
  }, [expedienteActual?.nombre, pepWhoisHistory]);

  const finalLevel = useMemo(() => {
    if (pepWhoisActual?.status === "coincidencia_alta" || pepWhoisActual?.status === "requiere_revision") return "Reforzado";
    if (pepWhoisActual?.status === "posible_coincidencia") return "Alto";
    if (pepScreening?.status === "coincidencia-cargo") return "Reforzado";
    if (pepScreening?.status === "posible-pep") return "Alto";
    const levels = [
      clientResult.level,
      subjectResult.level,
      beneficiaryResult?.level,
    ].filter(Boolean) as ScoredResult["level"][];
    if (levels.includes("Reforzado")) return "Reforzado";
    if (levels.includes("Alto")) return "Alto";
    if (levels.includes("Medio")) return "Medio";
    return "Bajo";
  }, [clientResult.level, subjectResult.level, beneficiaryResult?.level, pepScreening?.status, pepWhoisActual?.status]);

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
    if (!clienteActual || typeof window === "undefined") return;
    const updated: StoredEvaluation = {
      schemaVersion: 2,
      rfc: clienteActual.rfc,
      riskSummary: { level: finalLevel, score: clientResult.total, percent: clientResult.percent },
      clientAnswers,
      subjectAnswers,
      hasBeneficiaryController,
      beneficiaryAnswers,
      pepCargo,
      pepDependencia,
      pepScreening: pepScreening ?? undefined,
      notes,
      updatedAt: new Date().toISOString(),
    };
    try {
      const next = saveClientEbrEvaluation(window.localStorage, clienteActual, updated);
      setEvaluacionesGuardadas(next as Record<string, StoredEvaluation>);
      toast({ title: "Evaluación guardada", description: "El resultado está disponible en Avisos e informes." });
    } catch (error) {
      toast({ title: "No se pudo guardar", description: error instanceof Error ? error.message : "Revisa el almacenamiento local.", variant: "destructive" });
    }
  };

  const deleteEvaluation = () => {
    if (!clienteActual || typeof window === "undefined") return;
    try {
      const next = saveClientEbrEvaluation(window.localStorage, clienteActual, null);
      setEvaluacionesGuardadas(next as Record<string, StoredEvaluation>);
    } catch (error) {
      toast({ title: "No se pudo eliminar", description: error instanceof Error ? error.message : "Revisa el almacenamiento local.", variant: "destructive" });
      return;
    }
    setClientAnswers(initialAnswers);
    setSubjectAnswers(initialAnswers);
    setHasBeneficiaryController(false);
    setBeneficiaryAnswers(initialAnswers);
    setPepCargo("");
    setPepDependencia("");
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
      `Cliente: ${clienteActual?.nombre ?? "Sin nombre"} | Identificador: ${clienteActual?.identifier || "N/A"}`,
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
    if (pepScreening) {
      addLine(`Validacion PEP por cargos SHCP/UIF: ${pepScreening.status}. ${pepScreening.note}`);
      pepScreening.matches.slice(0, 3).forEach((match) => {
        addLine(`- ${match.cargo} | ${match.dependencia}`, 8);
      });
    }
    if (pepWhoisActual) {
      addLine(`WhoIs PEP local-first: ${pepWhoisActual.status}. ${pepWhoisActual.recommendation}`);
      pepWhoisActual.results.slice(0, 3).forEach((match) => {
        addLine(`- ${match.entity.name} | ${match.source} | score ${match.score}`, 8);
      });
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
            <SearchableSelect
              ariaLabel="Cliente seleccionado"
              value={clienteSeleccionado}
              onChange={setClienteSeleccionado}
              options={clientesDisponibles.map((client) => ({ value: client.id, label: `${client.nombre} (${client.identifier})` }))}
              placeholder="Selecciona un cliente"
              searchPlaceholder="Buscar nombre, RFC, NIF o CURP"
            />
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
	              <CardTitle>Validación PEP por cargos oficiales</CardTitle>
	              <CardDescription>
	                Consulta asistida contra el catálogo público SHCP/UIF de cargos políticamente expuestos. No sustituye la revisión humana ni la consulta formal UIF cuando aplique.
	              </CardDescription>
	            </CardHeader>
	            <CardContent className="space-y-4">
	              <div className="grid gap-4 md:grid-cols-2">
	                <div className="space-y-2">
	                  <Label>Cargo público</Label>
	                  <Input
	                    value={pepCargo}
	                    onChange={(event) => setPepCargo(event.target.value)}
	                    placeholder="Ej. Director General"
	                  />
	                </div>
	                <div className="space-y-2">
	                  <Label>Dependencia o entidad</Label>
	                  <Input
	                    value={pepDependencia}
	                    onChange={(event) => setPepDependencia(event.target.value)}
	                    placeholder="Ej. Secretaría de Comunicaciones y Transportes"
	                  />
	                </div>
	              </div>
		              {pepScreening ? (
		                <div className="rounded-lg border bg-slate-50 p-4 text-sm">
	                  <div className="flex flex-wrap items-center gap-2">
	                    <Badge
	                      className={
	                        pepScreening.status === "coincidencia-cargo"
	                          ? "bg-rose-100 text-rose-700"
	                          : pepScreening.status === "posible-pep"
	                            ? "bg-amber-100 text-amber-700"
	                            : "bg-emerald-100 text-emerald-700"
	                      }
	                    >
	                      {pepScreening.status}
	                    </Badge>
	                    <span className="text-xs text-muted-foreground">
	                      Requiere revisión humana: {pepScreening.requiresHumanReview ? "sí" : "no"}
	                    </span>
	                  </div>
	                  <p className="mt-2 text-muted-foreground">{pepScreening.note}</p>
	                  <div className="mt-3 grid gap-2">
	                    {pepScreening.matches.slice(0, 3).map((match) => (
	                      <div key={`${match.dependencia}-${match.cargo}`} className="rounded border bg-white p-2 text-xs">
	                        <p className="font-semibold">{match.cargo}</p>
	                        <p>{match.dependencia}</p>
	                      </div>
	                    ))}
	                  </div>
	                </div>
		              ) : (
		                <p className="text-sm text-muted-foreground">
		                  Captura cargo y dependencia cuando el cliente, representante o beneficiario controlador declare o sugiera vínculo con servicio público.
		                </p>
		              )}
                  <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">WhoIs PEP local-first</p>
                        <p className="text-muted-foreground">
                          {pepWhoisActual
                            ? `Último resultado: ${pepWhoisActual.status}.`
                            : "Sin consulta nominal guardada para este expediente."}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href="/pep-whois">Abrir WhoIs PEP</Link>
                      </Button>
                    </div>
                    {pepWhoisActual ? (
                      <p className="mt-3 text-xs text-muted-foreground">{pepWhoisActual.recommendation}</p>
                    ) : null}
                  </div>
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

		              {pepScreening ? (
		                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
	                  <p className="text-sm font-medium">PEP por cargo oficial SHCP/UIF</p>
	                  <p className="mt-1 text-sm text-muted-foreground">
	                    Estado: <strong>{pepScreening.status}</strong>. {pepScreening.note}
	                  </p>
		                </div>
		              ) : null}

                  {pepWhoisActual ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium">WhoIs PEP local-first</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Estado: <strong>{pepWhoisActual.status}</strong>. {pepWhoisActual.recommendation}
                      </p>
                    </div>
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
          <CountryCombobox
            value={answers.nationalityCountryCode}
            onChange={(value) =>
              setAnswers((prev) => ({
                ...prev,
                nationalityCountryCode: value,
              }))
            }
            placeholder="Busca y selecciona país"
          />
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

function CountryCombobox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedCountry = PAISES.find((pais) => pais.code === value);
  const normalizedQuery = normalizeCountryName(query);

  const filteredCountries = useMemo(() => {
    if (!normalizedQuery) return PAISES;
    const queryTerms = normalizedQuery.split(" ");

    return PAISES.filter((pais) =>
      queryTerms.every((term) => {
        const normalizedLabel = normalizeCountryName(pais.label);
        const normalizedCode = normalizeCountryName(pais.code);

        return (
          normalizedLabel.includes(term) || normalizedCode.includes(term)
        );
      }),
    );
  }, [normalizedQuery]);

  const visibleCountries = filteredCountries.slice(0, 80);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-auto min-h-10 w-full min-w-0 justify-between gap-2 bg-white px-3 py-2 text-left font-normal"
        >
          <span
            className={
              selectedCountry
                ? "min-w-0 flex-1 truncate text-slate-800"
                : "min-w-0 flex-1 truncate text-muted-foreground"
            }
          >
            {selectedCountry
              ? `${selectedCountry.label} · ${selectedCountry.code}`
              : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(560px,calc(100vw-2rem))] p-0"
      >
        <div className="border-b p-2">
          <div className="flex items-center gap-2 rounded-md border bg-white px-2">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar país o código ISO"
              className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {visibleCountries.length > 0 ? (
            visibleCountries.map((pais) => (
              <button
                key={pais.code}
                type="button"
                className="flex w-full min-w-0 items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-orange-50"
                onClick={() => {
                  onChange(pais.code);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <Check
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    value === pais.code ? "text-orange-700" : "text-transparent"
                  }`}
                />
                <span className="min-w-0 flex-1 break-words leading-snug text-slate-700">
                  {pais.label}
                </span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  {pais.code}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No se encontraron países.
            </div>
          )}
        </div>
        <div className="border-t px-3 py-2 text-[11px] text-muted-foreground">
          {filteredCountries.length > visibleCountries.length
            ? `Mostrando ${visibleCountries.length} de ${filteredCountries.length}. Escribe para filtrar.`
            : `${filteredCountries.length} país(es) encontrados.`}
        </div>
      </PopoverContent>
    </Popover>
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
