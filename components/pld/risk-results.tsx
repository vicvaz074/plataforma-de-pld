"use client"

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { ScoredResult } from "@/lib/pld/ebr-questionnaire"
import type { EbrAssessmentHistory, evaluateInstitutionalRisk } from "@/lib/pld/ebr-assessment"

export interface RiskChartRow { factor: string; points: number; maximum: number; percent: number }
export function buildRiskChartRows(result: ScoredResult): RiskChartRow[] {
  if (!result.complete) return []
  return result.details.map((detail) => ({ factor: detail.question.replace(/\s*\([^)]*\)$/, ""), points: detail.score,
    maximum: detail.maximum, percent: Math.round(detail.score / detail.maximum * 100) }))
}

export function RiskResults({ client, subject, beneficiary, history, distribution, institution }: {
  client: ScoredResult; subject: ScoredResult; beneficiary: ScoredResult | null;
  history: EbrAssessmentHistory[]; distribution: Array<{ level: string; count: number }>;
  institution?: ReturnType<typeof evaluateInstitutionalRisk>;
}) {
  const factors = buildRiskChartRows(client)
  const profiles = [{ factor: "Cliente", percent: client.percent,complete:client.complete }, { factor: "Sujeto obligado", percent: subject.percent,complete:subject.complete },
    ...(beneficiary ? [{ factor: "Beneficiario", percent: beneficiary.percent,complete:beneficiary.complete }] : [])]
  const evolution = history.filter((item) => item.status === "approved").map((item) => ({ date: item.updatedAt.slice(0, 10), percent: item.result.percent, revision: item.revision }))
  return <section className="grid gap-5 lg:grid-cols-2" aria-label="Gráficas de riesgo">
    {institution&&<div className="min-w-0 rounded-xl border p-5 lg:col-span-2"><h3 className="font-semibold">Riesgo institucional: inherente y residual</h3><p className="mt-1 text-xs text-muted-foreground">Metodología interna de cuatro factores. El residual exige controles sustentados y revisados.</p>{institution.inherentPercent!==null?<div className="mt-3 h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={[{factor:"Inherente",percent:institution.inherentPercent},{factor:"Residual",percent:institution.residualPercent}]} layout="vertical"><CartesianGrid strokeDasharray="3 3"/><XAxis type="number" domain={[0,100]} tick={{fontSize:12}}/><YAxis dataKey="factor" type="category" width={84} tick={{fontSize:12}}/><Tooltip/><Bar dataKey="percent" name="Puntaje normalizado" fill="#0f766e" radius={[0,5,5,0]} isAnimationActive={false}/></BarChart></ResponsiveContainer></div>:<p className="mt-3 text-sm text-muted-foreground">Completa los cuatro factores y sus referencias.</p>}<p className="text-sm">Inherente: {institution.inherentScore??"—"}/3 · {institution.inherentLevel} | Residual: {institution.residualScore??"—"}/3 · {institution.residualLevel}</p></div>}
    <div className="min-w-0 rounded-xl border p-5">
      <h3 className="font-semibold">Factores del cliente</h3>
      <p className="mt-1 text-xs text-muted-foreground">Puntaje de metodología, no probabilidad de lavado.</p>
      {factors.length ? <><div className="mt-3 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={factors} layout="vertical" margin={{ left: 0, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" domain={[0, 100]} unit="%" /><YAxis type="category" dataKey="factor" width={140} tick={{fontSize:11}} />
        <Tooltip formatter={(value) => `${value}% del máximo`} /><Bar dataKey="percent" name="Puntaje" fill="#d97706" radius={[0, 5, 5, 0]} isAnimationActive={false}/>
      </BarChart></ResponsiveContainer></div><details className="mt-3 text-sm"><summary className="cursor-pointer">Ver valores</summary><table className="mt-2 w-full text-left"><thead><tr><th>Factor</th><th>Puntos</th><th>Máximo</th></tr></thead><tbody>{factors.map((row) => <tr key={row.factor}><td>{row.factor}</td><td>{row.points}</td><td>{row.maximum}</td></tr>)}</tbody></table></details></>
        : <p className="mt-5 text-sm text-muted-foreground">Completa el cuestionario para visualizar sus factores.</p>}
    </div>
    <div className="min-w-0 rounded-xl border p-5"><h3 className="font-semibold">Perfiles evaluados</h3>
      <p className="mt-1 text-xs text-muted-foreground">Comparación en la misma escala de 0 a 100.</p>
      {profiles.every((profile)=>profile.complete) ? <div className="mt-3 h-60"><ResponsiveContainer width="100%" height="100%"><BarChart data={profiles}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="factor" tick={{fontSize:11}}/><YAxis domain={[0,100]} /><Tooltip /><Bar dataKey="percent" name="Puntaje" fill="#0f766e" radius={[5,5,0,0]} isAnimationActive={false}/></BarChart></ResponsiveContainer></div>
        : <p className="mt-5 text-sm text-muted-foreground">Sin evaluación completa. Los controles documentados se revisan por separado; no reducen automáticamente el riesgo.</p>}
      <div className="mt-3 flex flex-wrap gap-3 text-sm">{profiles.map((row) => <span key={row.factor}>{row.factor}: {row.complete?`${row.percent}%`:"Pendiente"}</span>)}</div>
    </div>
    <div className="min-w-0 rounded-xl border p-5"><h3 className="font-semibold">Evolución aprobada</h3>
      {evolution.length ? <><div className="mt-3 h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={evolution}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis domain={[0,100]} /><Tooltip /><Line dataKey="percent" name="Puntaje" stroke="#0f766e" strokeWidth={2} isAnimationActive={false}/></LineChart></ResponsiveContainer></div><p className="text-xs text-muted-foreground">{evolution.map((row) => `R${row.revision} ${row.date}: ${row.percent}%`).join(" · ")}</p></>
        : <p className="mt-5 text-sm text-muted-foreground">Las revisiones aprobadas aparecerán aquí con su fecha.</p>}
    </div>
    <div className="min-w-0 rounded-xl border p-5"><h3 className="font-semibold">Clientes de esta empresa</h3>
      <div className="mt-3 h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={distribution}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="level" tick={{fontSize:11}}/><YAxis allowDecimals={false}/><Tooltip/><Bar dataKey="count" name="Evaluaciones aprobadas" fill="#6366f1" radius={[5,5,0,0]} isAnimationActive={false}/></BarChart></ResponsiveContainer></div>
      <p className="text-xs text-muted-foreground">{distribution.map((row) => `${row.level}: ${row.count}`).join(" · ")}. Borradores excluidos.</p>
    </div>
  </section>
}
