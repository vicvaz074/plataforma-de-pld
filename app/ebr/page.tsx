"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
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
  calculateRisk, emptyEbrAnswers as initialAnswers, normalizeEbrAnswers,
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
import { RiskReviewPlan } from "@/components/pld/risk-review-plan";
import { RiskEvidencePicker } from "@/components/pld/risk-evidence-picker";
import { EBR_METHODOLOGY, EMPTY_TRANSACTIONAL_PROFILE, EMPTY_EBR_REVIEW_PLAN, EMPTY_INSTITUTIONAL_FACTORS, INSTITUTIONAL_LABELS, evaluateInstitutionalRisk, consolidateEbrResults, evaluateTransactionalProfile,getEbrReviewPlanMissing, reviseEbrControl, transitionEbrAssessment,transitionInstitutionalAssessment,
  type EbrAssessmentHistory, type EbrControlReview, type EbrSourceSnapshot, type EbrWorkflowStatus, type EbrReviewPlan, type TransactionalProfile, type InstitutionalFactor } from "@/lib/pld/ebr-assessment";
import { parseMoneyToCents, centsToDecimalString } from "@/lib/pld/money";
import { getModuleStorage, flushModuleStorage, getPilotSession, getActiveCompany, canWriteModuleStorage, captureModuleScope, assertModuleScope, isModuleScopeCurrent } from "@/lib/pilot/module-storage";
import { ebrPepReviewBasis, ebrApprovalView, retainUnchangedPepScreeningDate, currentStoredEbrRisk, findCurrentEbrWhois } from "@/lib/pld/ebr-review-state";
import { assertPepSearchResponse } from "@/lib/pld/record-shapes";
import { sessionCan } from "@/lib/pilot/contracts";
const RiskResults = dynamic(() => import("@/components/pld/risk-results").then((module) => module.RiskResults), { ssr: false });

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
  revision?: number;
  workflow?: { status: EbrWorkflowStatus; methodologyVersion: string; approvedBy?: string; approvedAt?: string };
  history?: EbrAssessmentHistory[];
  transactionalProfile?: TransactionalProfile;
  controls?: EbrControlReview[];
  sources?: EbrSourceSnapshot[];
  methodologyAccepted?: boolean;
  pepWhoisSnapshot?: PepSearchResponse;
  pepReviewBasis?: string;
  institutionalFactors?: InstitutionalFactor[];
  reviewPlan?:EbrReviewPlan;
  archivedAt?:string;
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
  const loadedInstitutionRef = useRef("");

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
  const [transactionalProfile, setTransactionalProfile] = useState<TransactionalProfile>(EMPTY_TRANSACTIONAL_PROFILE);
  const [reviewPlan,setReviewPlan]=useState<EbrReviewPlan>(EMPTY_EBR_REVIEW_PLAN);
  const [methodologyAccepted, setMethodologyAccepted] = useState(false);
  const [sources, setSources] = useState<EbrSourceSnapshot[]>([]);
  const [sourceNote, setSourceNote] = useState("");
  const [controls, setControls] = useState<EbrControlReview[]>([]);
  const [institutionalFactors,setInstitutionalFactors]=useState<InstitutionalFactor[]>(EMPTY_INSTITUTIONAL_FACTORS);
  const [institutionalStored,setInstitutionalStored]=useState<Partial<ReturnType<typeof transitionInstitutionalAssessment>>>({});
  const [institutionalReviewPlan,setInstitutionalReviewPlan]=useState<EbrReviewPlan>(EMPTY_EBR_REVIEW_PLAN);
  const [institutionalSources,setInstitutionalSources]=useState<EbrSourceSnapshot[]>([]);
  const [institutionalSourceNote,setInstitutionalSourceNote]=useState("");
  const [institutionalMethodologyAccepted,setInstitutionalMethodologyAccepted]=useState(false);
  const [storageValid,setStorageValid]=useState(true);
  const institutionalRisk=useMemo(()=>evaluateInstitutionalRisk(institutionalFactors,controls),[institutionalFactors,controls]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const load = () => {
    setStorageValid(true);
    try {
      setExpedientes(
        readExpedienteRecords(getModuleStorage()).map(getIntegrationClient).filter((item): item is IntegrationClient => Boolean(item)),
      );
    } catch (_error) {
      setExpedientes([]);
    }

    try {
      setOperaciones(
        loadStoredPldOperations(getModuleStorage(), { persistMigration: false }).operations
          .filter((item) => item.lifecycle.status === "active" && item.captureStatus !== "draft"),
      );
    } catch (_error) {
      setOperaciones([]);
    }

    try {
      const raw = getModuleStorage().getItem(EBR_STORAGE_KEY);
      const evaluations = normalizeEbrEvaluations(raw ? JSON.parse(raw) : {});
      setEvaluacionesGuardadas(Object.fromEntries(evaluations.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).map((item) => [item.clientId, item as StoredEvaluation])));
    } catch (_error) {
      setEvaluacionesGuardadas({});
      setStorageValid(false);
    }
    try{
      const raw=getModuleStorage().getItem("ebr-institutional-assessment");
      if(raw&&raw!==loadedInstitutionRef.current){const saved=JSON.parse(raw);if(!saved||typeof saved!=="object"||Array.isArray(saved))throw new Error("Formato institucional inválido");loadedInstitutionRef.current=raw;setInstitutionalStored(saved);setInstitutionalFactors(saved.institutionalFactors??EMPTY_INSTITUTIONAL_FACTORS);setControls(saved.controls??[]);setInstitutionalReviewPlan(saved.reviewPlan??EMPTY_EBR_REVIEW_PLAN);setInstitutionalSources(saved.sources??[]);setInstitutionalMethodologyAccepted(saved.methodologyAccepted===true);}
    }catch{setStorageValid(false);}

    try {
      const raw = getModuleStorage().getItem(PEP_SEARCH_HISTORY_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as PepSearchResponse[]) : [];
      if (!Array.isArray(parsed)) throw new Error("El historial PEP no contiene una colección válida.");
      parsed.forEach(assertPepSearchResponse);
      setPepWhoisHistory(parsed);
    } catch (_error) {
      setPepWhoisHistory([]);
      setStorageValid(false);
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
  const identifierAmbiguous=Boolean(clienteActual?.identifier&&clientesDisponibles.filter((item)=>item.identifier===clienteActual.identifier).length>1);
  const savedEvaluation = useMemo(() => findClientEbrEvaluation(Object.values(evaluacionesGuardadas), clienteActual,{allowLegacyIdentifierMatch:Boolean(clienteActual?.identifier&&!identifierAmbiguous)}) as StoredEvaluation | null, [evaluacionesGuardadas, clienteActual,identifierAmbiguous]);
  const changedSinceSaved=Boolean(savedEvaluation&&JSON.stringify({clientAnswers,subjectAnswers,hasBeneficiaryController,beneficiaryAnswers,transactionalProfile,reviewPlan,controls,institutionalFactors,sources,notes,methodologyAccepted})!==JSON.stringify({clientAnswers:savedEvaluation.clientAnswers,subjectAnswers:savedEvaluation.subjectAnswers,hasBeneficiaryController:savedEvaluation.hasBeneficiaryController,beneficiaryAnswers:savedEvaluation.beneficiaryAnswers,transactionalProfile:savedEvaluation.transactionalProfile,reviewPlan:savedEvaluation.reviewPlan??EMPTY_EBR_REVIEW_PLAN,controls:savedEvaluation.controls,institutionalFactors:savedEvaluation.institutionalFactors,sources:savedEvaluation.sources,notes:savedEvaluation.notes,methodologyAccepted:savedEvaluation.methodologyAccepted}));
  const historicalReviewPending=savedEvaluation?.workflow?.status==="approved"&&(!reviewPlan.nextReviewAt||!institutionalReviewPlan.nextReviewAt||reviewPlan.nextReviewAt<=new Date().toISOString().slice(0,10)||institutionalReviewPlan.nextReviewAt<=new Date().toISOString().slice(0,10));

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
      setTransactionalProfile(EMPTY_TRANSACTIONAL_PROFILE); setReviewPlan(EMPTY_EBR_REVIEW_PLAN); setMethodologyAccepted(false); setSources([]);
      return;
    }

    setClientAnswers(normalizeEbrAnswers(stored.clientAnswers));
    setSubjectAnswers(normalizeEbrAnswers(stored.subjectAnswers));
    setHasBeneficiaryController(Boolean(stored.hasBeneficiaryController));
    setBeneficiaryAnswers(normalizeEbrAnswers(stored.beneficiaryAnswers));
    setPepCargo(stored.pepCargo ?? "");
    setPepDependencia(stored.pepDependencia ?? "");
    setNotes(stored.notes);
    setTransactionalProfile(stored.transactionalProfile ?? EMPTY_TRANSACTIONAL_PROFILE);
    setReviewPlan(stored.reviewPlan??EMPTY_EBR_REVIEW_PLAN);
    setMethodologyAccepted(stored.methodologyAccepted === true);
    setSources(stored.sources ?? []);
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
    const current = matchPepCargo({
      nombre: expedienteActual?.nombre,
      cargo: pepCargo,
      dependencia: pepDependencia,
      relacion: hasBeneficiaryController ? "beneficiario-controlador" : "cliente",
    });
    return savedEvaluation?.pepCargo === pepCargo && savedEvaluation?.pepDependencia === pepDependencia && savedEvaluation?.hasBeneficiaryController === hasBeneficiaryController
      ? retainUnchangedPepScreeningDate(current, savedEvaluation.pepScreening) : current;
  }, [expedienteActual?.nombre, hasBeneficiaryController, pepCargo, pepDependencia, savedEvaluation]);

  const pepWhoisActual = useMemo(() => {
    const expedienteNombre = normalizeName(expedienteActual?.nombre);
    if (!expedienteNombre) return null;
    try { return findCurrentEbrWhois(pepWhoisHistory,clienteSeleccionado); } catch { return null; }
  }, [expedienteActual?.nombre, pepWhoisHistory, clienteSeleccionado]);

  const finalLevel = useMemo(() => {
    const today=new Date().toISOString();
    if (!clienteActual || !evaluateTransactionalProfile(transactionalProfile,[]).complete || !institutionalRisk.complete || !methodologyAccepted || !institutionalMethodologyAccepted || !sources.length || !institutionalSources.length || getEbrReviewPlanMissing(reviewPlan,today).length || getEbrReviewPlanMissing(institutionalReviewPlan,today).length) return "Pendiente";
    return consolidateEbrResults([clientResult, subjectResult, beneficiaryResult], pepWhoisActual?.status || pepScreening?.status);
  }, [clienteActual, clientResult, subjectResult, beneficiaryResult, pepScreening?.status, pepWhoisActual?.status,transactionalProfile,institutionalRisk.complete,methodologyAccepted,institutionalMethodologyAccepted,sources.length,institutionalSources.length,reviewPlan,institutionalReviewPlan]);
  const pepReviewBasis = ebrPepReviewBasis({ identity: clienteActual ? { id: clienteActual.id, nombre: clienteActual.nombre, identifier: clienteActual.identifier, rfc: clienteActual.rfc, identifiers: clienteActual.identifiers } : null, cargo: pepCargo, dependencia: pepDependencia, screening: pepScreening, whois: pepWhoisActual });
  const approvalView = ebrApprovalView({ saved: savedEvaluation, changed: changedSinceSaved, pepReviewBasis, reviewOverdue: historicalReviewPending || !storageValid, preliminaryLevel: finalLevel, preliminaryPercent: finalLevel === "Pendiente" ? 0 : Math.max(clientResult.percent, subjectResult.percent, beneficiaryResult?.percent || 0) });
  const { isCurrentApproved } = approvalView;
  const displayLevel = approvalView.level as typeof finalLevel;
  const displayedStatus=changedSinceSaved||approvalView.sourceChanged?"cambios sin aprobar":savedEvaluation?.workflow?.status==="approved"&&approvalView.reviewPending?"aprobación histórica; revisión actual pendiente":({draft:"borrador",review:"en revisión",approved:"aprobada"}[savedEvaluation?.workflow?.status as EbrWorkflowStatus]||"borrador");

  const riskBadgeStyles = {
    Pendiente: "bg-slate-100 text-slate-700",
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

  const saveEvaluation = async (status: EbrWorkflowStatus = "draft") => {
    const scope = captureModuleScope();
    if (!clienteActual || typeof window === "undefined") return;
    if (!storageValid) {toast({title:"Datos por recuperar",description:"No se sobrescribió la evaluación ilegible. Revisa el respaldo o recarga desde el servidor.",variant:"destructive"});return;}
    if (!canWriteModuleStorage(EBR_STORAGE_KEY)) {toast({title:"Acceso de consulta",description:"Tu perfil no permite modificar evaluaciones.",variant:"destructive"});return;}
    try {
    const session = getPilotSession();
    const actor = session?.user.name || getModuleStorage().getItem("userName") || "Usuario local";
    const company = getActiveCompany();
    const canApprove = sessionCan(session, company, "ebr", "approve");
    const workflow = transitionEbrAssessment({ status, actor, at: new Date().toISOString(), canApprove, clientAnswers, subjectAnswers,
      beneficiaryAnswers: hasBeneficiaryController ? beneficiaryAnswers : undefined, transactionalProfile, controls, methodologyAccepted,
      sources, institutionalFactors, reviewPlan, previous: savedEvaluation ?? undefined, pepStatus: pepWhoisActual?.status || pepScreening?.status });
    const updated: StoredEvaluation = {
      schemaVersion: 3,
      rfc: clienteActual.rfc,
      ...workflow,
      clientAnswers,
      subjectAnswers,
      hasBeneficiaryController,
      beneficiaryAnswers,
      pepCargo,
      pepDependencia,
      pepScreening: pepScreening ?? undefined,
      notes,
      updatedAt: new Date().toISOString(),
      transactionalProfile, reviewPlan, controls, sources, methodologyAccepted, institutionalFactors,
      pepWhoisSnapshot: pepWhoisActual ?? undefined,
      pepReviewBasis,
    };
      const institutionRecord={id:company?.id||"institution",...transitionInstitutionalAssessment({status,canApprove,actor,at:updated.updatedAt,institutionalFactors,controls,sources:institutionalSources,methodologyAccepted:institutionalMethodologyAccepted,reviewPlan:institutionalReviewPlan,previous:institutionalStored})};
      saveClientEbrEvaluation(scope.storage, clienteActual, updated);
      scope.storage.setItem("ebr-institutional-assessment",JSON.stringify(institutionRecord));
      await flushModuleStorage(scope);
      assertModuleScope(scope);
      const next = Object.fromEntries(normalizeEbrEvaluations(JSON.parse(scope.storage.getItem(EBR_STORAGE_KEY) || "{}")).map((item) => [item.clientId, item]));
      setInstitutionalStored(institutionRecord);
      setEvaluacionesGuardadas(next as Record<string, StoredEvaluation>);
      toast({ title: status === "approved" ? "Evaluación aprobada" : status === "review" ? "Enviada a revisión" : "Borrador guardado", description: "Se conserva la versión y sus fuentes." });
    } catch (error) {
      if (!isModuleScopeCurrent(scope)) return;
      toast({ title: "No se pudo guardar", description: error instanceof Error ? error.message : "Revisa el almacenamiento local.", variant: "destructive" });
    }
  };

  const saveInstitutionalEvaluation=async(status:EbrWorkflowStatus)=>{
    const scope = captureModuleScope();
    if(!storageValid||!canWriteModuleStorage("ebr-institutional-assessment"))return;
    try{
      const session=getPilotSession(),company=getActiveCompany();
      const record={id:company?.id||"institution",...transitionInstitutionalAssessment({status,actor:session?.user.id||"Usuario local",at:new Date().toISOString(),canApprove:sessionCan(session,company,"ebr","approve"),institutionalFactors,controls,sources:institutionalSources,methodologyAccepted:institutionalMethodologyAccepted,reviewPlan:institutionalReviewPlan,previous:institutionalStored})};
      scope.storage.setItem("ebr-institutional-assessment",JSON.stringify(record));
      await flushModuleStorage(scope);assertModuleScope(scope);setInstitutionalStored(JSON.parse(scope.storage.getItem("ebr-institutional-assessment") || "null"));
      toast({title:status==="approved"?"EBR institucional aprobada":"Borrador institucional guardado",description:"Se conservó por empresa, independientemente de sus clientes."});
    }catch(error){if (isModuleScopeCurrent(scope)) toast({title:"No se pudo guardar",description:error instanceof Error?error.message:"Revisa la evaluación institucional.",variant:"destructive"});}
  };

  const deleteEvaluation = async () => {
    const scope = captureModuleScope();
    if (!clienteActual || typeof window === "undefined") return;
    if (!sessionCan(getPilotSession(),getActiveCompany(),"ebr","archive")) return;
    try {
      if(!savedEvaluation)return;
      const next = saveClientEbrEvaluation(scope.storage, clienteActual, {...savedEvaluation,archivedAt:new Date().toISOString(),archivedBy:getPilotSession()?.user.id,riskSummary:undefined});
      await flushModuleStorage(scope);assertModuleScope(scope);
      setEvaluacionesGuardadas(next as Record<string, StoredEvaluation>);
      toast({title:"Evaluación archivada",description:"El historial permanece disponible en el registro."});
    } catch (error) {
      if (!isModuleScopeCurrent(scope)) return;
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
    addLine(`Resumen ejecutivo: ${isCurrentApproved?"Riesgo aprobado":"Resultado preliminar"} ${displayLevel} (${approvalView.percent}%).`);
    if (approvalView.historicalApproved && !isCurrentApproved) addLine(`Aprobación histórica conservada: ${approvalView.historicalApproved.level} (${approvalView.historicalApproved.percent}%). Los datos actuales requieren revisión.`);
    addLine(`Estado: ${displayedStatus}. Metodología: ${EBR_METHODOLOGY.id}. No representa una probabilidad de lavado.`);
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
    addLine("\nGráfica de factores del cliente (misma escala de la pantalla)", 12);
    if (clientResult.complete) for (const factor of clientResult.details) {
      addLine(`${factor.question}: ${factor.score}/${factor.maximum}`, 9);
      if (y > pageHeight - 60) { doc.addPage(); y = 54; }
      doc.setFillColor(217, 119, 6); doc.rect(margin, y, contentWidth * factor.score / factor.maximum, 7, "F"); y += 23;
    }
    addLine("\nFuentes y evidencia", 12);
    addLine(`Riesgo institucional inherente: ${institutionalRisk.inherentScore??"Pendiente"}/3 (${institutionalRisk.inherentLevel}). Residual: ${institutionalRisk.residualScore??"Pendiente"}/3 (${institutionalRisk.residualLevel}).`);
    for(const item of [{label:"Inherente",percent:institutionalRisk.inherentPercent},{label:"Residual",percent:institutionalRisk.residualPercent}]){if(item.percent===null)continue;addLine(`${item.label}: ${item.percent}% del máximo`,9);if(y>pageHeight-60){doc.addPage();y=54;}doc.setFillColor(15,118,110);doc.rect(margin,y,contentWidth*item.percent/100,7,"F");y+=23;}
    institutionalFactors.forEach((factor)=>addLine(`${INSTITUTIONAL_LABELS[factor.key]}: ${factor.score??"Pendiente"}/3. ${factor.rationale}. Evidencia: ${factor.evidenceId||"Pendiente"}`,9));
    sources.forEach((source) => addLine(`${source.consultedAt}: ${source.label} ${source.result || ""}`, 9));
    addLine("\nPlan de revisión del cliente",12);
    addLine(`Próxima revisión definida por la empresa: ${reviewPlan.nextReviewAt||"Pendiente"}.`,9);
    reviewPlan.actions.forEach((action)=>addLine(`${action.title}. Responsable: ${action.ownerId||"Pendiente"}. Fecha: ${action.dueAt||"Pendiente"}. ${action.status==="completed"?"Cerrada":"Abierta"}. Evidencia: ${action.evidenceId||"Sin referencia"}.`,9));
    addLine("\nPlan de revisión institucional",12);
    addLine(`Próxima revisión definida por la empresa: ${institutionalReviewPlan.nextReviewAt||"Pendiente"}.`,9);
    institutionalReviewPlan.actions.forEach((action)=>addLine(`${action.title}. Responsable: ${action.ownerId||"Pendiente"}. Fecha: ${action.dueAt||"Pendiente"}. ${action.status==="completed"?"Cerrada":"Abierta"}. Evidencia: ${action.evidenceId||"Sin referencia"}.`,9));
    institutionalSources.forEach((source)=>addLine(`Fuente institucional ${source.consultedAt}: ${source.label}`,9));
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
          <Button onClick={() => saveEvaluation("draft")} disabled={!clienteActual || !canWriteModuleStorage(EBR_STORAGE_KEY)}>
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Guardar borrador
          </Button>
          <Button variant="outline" onClick={() => saveEvaluation("review")} disabled={!clienteActual || finalLevel === "Pendiente" || !canWriteModuleStorage(EBR_STORAGE_KEY)}>Enviar a revisión</Button>
          <Button onClick={() => saveEvaluation("approved")} disabled={!clienteActual || !canWriteModuleStorage(EBR_STORAGE_KEY) || !sessionCan(getPilotSession(), getActiveCompany(), "ebr", "approve")}>Aprobar</Button>
          <Button
            variant="destructive"
            onClick={deleteEvaluation}
            disabled={!savedEvaluation || !sessionCan(getPilotSession(),getActiveCompany(),"ebr","archive")}
          >
            Archivar evaluación
          </Button>
        </div>
      </div>

      <details className="rounded-xl border bg-slate-50 p-4 text-sm"><summary className="cursor-pointer font-medium">Metodología y fuentes</summary><div className="mt-3 space-y-2"><p>{EBR_METHODOLOGY.note}</p><a className="underline" href={EBR_METHODOLOGY.source} target="_blank" rel="noreferrer">Acuerdo 115/2026 · consulta {EBR_METHODOLOGY.reviewedAt}</a><p>La clasificación se mantiene pendiente hasta completar las respuestas. La aprobación conserva sus datos y fuentes; modificar respuestas crea otra revisión.</p></div></details>

      <Card>
        <CardHeader>
          <CardTitle>Conexión con expediente y operaciones</CardTitle>
          {identifierAmbiguous&&<p role="status" className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Varios clientes comparten este identificador. Las evaluaciones y operaciones se vinculan únicamente por su ID estable; un registro histórico sin vínculo requiere asignación manual y no se reutilizará automáticamente.</p>}
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
            <CardDescription>{isCurrentApproved?"Riesgo aprobado del cliente":"Resultado preliminar · sin aprobación"}</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {displayLevel}
              <Badge className={riskBadgeStyles[displayLevel]}>
                {approvalView.percent}%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Integra Cliente, Sujeto Obligado y Beneficiario Controlador.
            {approvalView.historicalApproved && !isCurrentApproved && <p className="mt-2">Aprobación histórica: {approvalView.historicalApproved.level} ({approvalView.historicalApproved.percent}%). Revisión actual pendiente.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Cliente</CardDescription>
            <CardTitle className="text-2xl">
              {clientResult.complete ? `${clientResult.total}/${clientResult.max}` : "Sin evaluar"}
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
              {subjectResult.complete ? `${subjectResult.total}/${subjectResult.max}` : "Sin evaluar"}
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

      <Card>
        <CardHeader><CardTitle>Perfil transaccional y revisión</CardTitle><CardDescription>Lo esperado y lo observado se conservan en cada revisión.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          {!storageValid&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">Hay datos EBR ilegibles. Se bloquearon los guardados para conservar el registro original.</p>}
          <details className="rounded-xl border p-4" open>
            <summary className="cursor-pointer text-sm font-medium">Evaluación institucional de la empresa</summary>
            <p className="mt-2 text-xs text-muted-foreground">Pesos de la metodología interna: clientes 30%, productos 30%, canales 20%, geografía 20%. Documenta el juicio y vincula una versión recuperable de evidencia de esta empresa.</p>
            <div className="mt-3 space-y-3">{institutionalFactors.map((factor,index)=><div key={factor.key} className="grid gap-2 rounded-lg border p-3 md:grid-cols-3">
              <div><Label>{INSTITUTIONAL_LABELS[factor.key]}</Label><Select value={factor.score===null?"unknown":String(factor.score)} onValueChange={(value)=>setInstitutionalFactors((prev)=>prev.map((item,i)=>i===index?{...item,score:value==="unknown"?null:Number(value) as 1|2|3}:item))}><SelectTrigger aria-label={`Riesgo ${INSTITUTIONAL_LABELS[factor.key]}`}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="unknown">Sin evaluar</SelectItem><SelectItem value="1">Bajo · 1</SelectItem><SelectItem value="2">Medio · 2</SelectItem><SelectItem value="3">Alto · 3</SelectItem></SelectContent></Select></div>
              <Input aria-label={`Fundamento ${INSTITUTIONAL_LABELS[factor.key]}`} placeholder="Juicio y factores observados" value={factor.rationale} onChange={(event)=>setInstitutionalFactors((prev)=>prev.map((item,i)=>i===index?{...item,rationale:event.target.value}:item))}/>
              <RiskEvidencePicker label={`Evidencia ${INSTITUTIONAL_LABELS[factor.key]}`} value={factor.evidence} legacyReference={factor.evidenceId} onChange={(evidence)=>setInstitutionalFactors((old)=>old.map((item,i)=>i===index?{...item,evidence,evidenceId:evidence.fileVersionId}:item))}/>
            </div>)}</div>
            <p className="mt-3 text-sm">Inherente: {institutionalRisk.inherentLevel} · Residual: {institutionalRisk.residualLevel}</p>
          </details>
          <RiskReviewPlan value={institutionalReviewPlan} onChange={setInstitutionalReviewPlan} scope="institucional"/>
          <div className="space-y-2"><Label htmlFor="ebr-institutional-source">Fuente institucional o manual adoptado</Label><div className="flex gap-2"><Input id="ebr-institutional-source" value={institutionalSourceNote} onChange={(event)=>setInstitutionalSourceNote(event.target.value)} placeholder="Documento, versión y revisión"/><Button variant="outline" type="button" disabled={!institutionalSourceNote.trim()} onClick={()=>{setInstitutionalSources((old)=>[...old,{id:crypto.randomUUID(),label:institutionalSourceNote.trim(),consultedAt:new Date().toISOString()}]);setInstitutionalSourceNote("");}}>Añadir fuente institucional</Button></div><ul className="text-xs text-muted-foreground">{institutionalSources.map((source)=><li key={source.id}>{source.label} · {formatDate(source.consultedAt)}</li>)}</ul></div>
          <label className="flex items-start gap-2 text-sm"><Checkbox checked={institutionalMethodologyAccepted} onCheckedChange={(value)=>setInstitutionalMethodologyAccepted(value===true)}/><span>La empresa adoptó esta metodología institucional y documentó su versión en el manual.</span></label>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" disabled={!canWriteModuleStorage("ebr-institutional-assessment")} onClick={()=>saveInstitutionalEvaluation("draft")}>Guardar borrador institucional</Button>
            <Button variant="outline" disabled={!canWriteModuleStorage("ebr-institutional-assessment")||!sessionCan(getPilotSession(),getActiveCompany(),"ebr","approve")} onClick={()=>saveInstitutionalEvaluation("approved")}>Aprobar institucional</Button>
            <span className="text-xs text-muted-foreground">Revisión institucional {institutionalStored.revision||0} · {institutionalStored.workflow?.status==="approved"?"aprobada (modificar requiere nueva revisión)":institutionalStored.workflow?.status==="review"?"en revisión":"borrador"}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="ebr-expected-amount">Monto mensual esperado (MXN)</Label><Input id="ebr-expected-amount" inputMode="decimal" placeholder="0.00" value={transactionalProfile.expectedMonthlyAmountCents === null ? "" : centsToDecimalString(transactionalProfile.expectedMonthlyAmountCents)} onChange={(event) => { const parsed = parseMoneyToCents(event.target.value, {allowZero:true}); setTransactionalProfile((prev) => ({...prev, expectedMonthlyAmountCents:parsed.ok ? parsed.cents : null})); }}/></div>
            <div className="space-y-2"><Label htmlFor="ebr-expected-count">Operaciones al mes</Label><Input id="ebr-expected-count" inputMode="numeric" value={transactionalProfile.expectedMonthlyCount ?? ""} onChange={(event) => setTransactionalProfile((prev) => ({...prev, expectedMonthlyCount:/^\d+$/.test(event.target.value) ? Number(event.target.value) : null}))}/></div>
            {([{key:"originOfFunds",label:"Origen de recursos"},{key:"destinationOfFunds",label:"Destino de recursos"},{key:"channels",label:"Canales"},{key:"instrument",label:"Instrumentos monetarios"}] as const).map((item) => <div className="space-y-2" key={item.key}><Label htmlFor={`ebr-${item.key}`}>{item.label}</Label><Input id={`ebr-${item.key}`} value={transactionalProfile[item.key]} onChange={(event) => setTransactionalProfile((prev) => ({...prev,[item.key]:event.target.value}))}/></div>)}
          </div>
          {evaluateTransactionalProfile(transactionalProfile, operacionesCliente).alerts.length > 0 && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Hay {evaluateTransactionalProfile(transactionalProfile, operacionesCliente).alerts.length} periodo(s) por encima del perfil declarado. Documenta su análisis; esta señal no sustituye el cálculo del aviso.</p>}
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer text-sm font-medium">Controles y evidencia</summary>
            <div className="mt-3 space-y-3">
              {controls.map((control, index) => <div key={control.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-3">
                <Input aria-label="Nombre del control" value={control.label} onChange={(event) => setControls((prev) => prev.map((item,i) => i === index ? reviseEbrControl(item,{label:event.target.value}) : item))}/>
                <Select value={control.effectiveness} onValueChange={(effectiveness: EbrControlReview["effectiveness"]) => setControls((prev) => prev.map((item,i) => i === index ? {...item,effectiveness,reviewedBy:getPilotSession()?.user.id || "Usuario local",reviewedAt:new Date().toISOString()} : item))}>
                  <SelectTrigger aria-label="Efectividad"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="unknown">Sin revisar</SelectItem><SelectItem value="absent">No implementado</SelectItem><SelectItem value="partial">Parcial</SelectItem><SelectItem value="effective">Efectivo</SelectItem></SelectContent>
                </Select>
                <RiskEvidencePicker label={`Evidencia control ${index+1}`} value={control.evidence} legacyReference={control.evidenceId} onChange={(evidence)=>setControls((old)=>old.map((item,i)=>i===index?reviseEbrControl(item,{evidenceId:evidence.fileVersionId,evidence}):item))}/>
              </div>)}
              <Button variant="outline" type="button" onClick={() => setControls((prev) => [...prev,{id:crypto.randomUUID(),label:"",effectiveness:"unknown",evidenceId:"",reviewedBy:"",reviewedAt:""}])}>Añadir control</Button>
              <p className="text-xs text-muted-foreground">La reducción mostrada es una propuesta de esta metodología interna y sólo procede con controles sustentados y revisados. Editar un control o su evidencia reinicia la revisión.</p>
            </div>
          </details>
          <RiskReviewPlan value={reviewPlan} onChange={setReviewPlan} scope="cliente"/>
          <div className="space-y-2"><Label htmlFor="ebr-source">Fuente o evidencia consultada</Label><div className="flex gap-2"><Input id="ebr-source" value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} placeholder="Documento, versión de fuente y conclusión"/><Button variant="outline" type="button" disabled={!sourceNote.trim()} onClick={() => {setSources((prev) => [...prev,{id:crypto.randomUUID(),label:sourceNote.trim(),consultedAt:new Date().toISOString()}]);setSourceNote("");}}>Añadir</Button></div><ul className="space-y-1 text-xs text-muted-foreground">{sources.map((source) => <li key={source.id}>{source.label} · {formatDate(source.consultedAt)}</li>)}</ul></div>
          <label className="flex items-start gap-2 text-sm"><Checkbox checked={methodologyAccepted} onCheckedChange={(value) => setMethodologyAccepted(value === true)}/><span>La empresa adoptó y documentó esta versión de metodología en su manual. Registrar la referencia en Fuentes.</span></label>
          <p className="text-xs text-muted-foreground">Estado: {displayedStatus} · Versión {savedEvaluation?.revision || 0}</p>
        </CardContent>
      </Card>

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
          <RiskResults client={clientResult} subject={subjectResult} beneficiary={beneficiaryResult} history={savedEvaluation?.history ?? []} institution={institutionalRisk}
            distribution={["Bajo","Medio","Alto","Reforzado"].map((level) => ({level,count:storageValid ? Object.values(evaluacionesGuardadas).filter((item) => currentStoredEbrRisk(item,expedientes.find((client) => client.id === (item.expedienteId || item.clientId)) ?? null,pepWhoisHistory)?.level === level).length : 0}))}/>
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
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <QuestionSelect
          label={`1) Nivel de riesgo de nacionalidad (${titlePrefix})`}
          value={answers.nationalityRisk}
          options={NATIONALITY_OPTIONS}
          onChange={(value) => setAnswers((prev)=>({...prev,nationalityRisk:value,geographyReviewed:false}))}
        />
        <div className="space-y-2">
          <Label>País de nacionalidad ({titlePrefix})</Label>
          <CountryCombobox
            value={answers.nationalityCountryCode}
            onChange={(value) =>
              setAnswers((prev) => ({
                ...prev,
                nationalityCountryCode: value,
                nationalityRisk:getNationalityRiskByCountry(PAISES.find((country)=>country.code===value)?.label),geographyReviewed:false,
              }))
            }
            placeholder="Busca y selecciona país"
          />
          <p className="text-xs text-muted-foreground">
            Sugerencia del catálogo histórico. Coteja la jurisdicción con las fuentes vigentes y documenta la consulta antes de confirmar.
          </p>
          <label className="flex items-start gap-2 text-xs"><Checkbox checked={answers.geographyReviewed===true} onCheckedChange={(value)=>setAnswers((prev)=>({...prev,geographyReviewed:value===true}))}/><span>Verifiqué las fuentes geográficas y registré su fecha y referencia.</span></label>
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
              <label className="mb-2 flex items-center gap-2 text-sm"><Checkbox checked={answers.behaviorReviewed === true} onCheckedChange={(checked) => setAnswers((prev) => ({...prev,behaviorReviewed:checked === true}))}/><span>Revisé las señales de comportamiento, incluso si no hay coincidencias.</span></label>
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
