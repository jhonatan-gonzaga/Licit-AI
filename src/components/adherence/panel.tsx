"use client";
import { useActionState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { runAdherenceAction } from "@/app/oportunidades/[id]/analysis-actions";
import type { AnalysisView } from "@/lib/adherence/contracts";
import { failureMessages } from "@/lib/adherence/errors";
import { Icon } from "../icon";
import { AdherenceContent } from "./view";
import styles from "./adherence.module.css";

export function AdherencePanel({ opportunityId, view, children }: { opportunityId: string; view: AnalysisView; children?: ReactNode }) {
  const [actionState, action, pending] = useActionState(runAdherenceAction, { failure: null });
  const router = useRouter();
  useEffect(() => {
    if (view.state !== "processing") return;
    // Apenas consulta o estado. Navegação e polling nunca executam chamadas ao modelo.
    const interval = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(interval);
  }, [view.state, router]);
  const busy = pending || view.state === "processing";
  const displayedView = pending ? { ...view, state: "processing" as const, result: null } : view;
  return <section className={`panel ${styles.panel}`} aria-labelledby="adherence-heading" aria-busy={busy}>
    <div className={styles.heading}><Icon name="sparkles" size={20}/><h2 id="adherence-heading">Análise de aderência</h2></div>
    <AdherenceContent view={displayedView}/>
    <form action={action} className={styles.actions}>
      <input type="hidden" name="id" value={opportunityId}/>
      {view.analysisId ? <input type="hidden" name="analysisId" value={view.analysisId}/> : null}
      {view.state !== "pending_validation" ? <button name="operation" value="analyze" className="button button-primary" disabled={busy || !view.configured}><Icon name={busy ? "refresh" : "sparkles"} size={16} className={busy ? "spin" : undefined}/>{busy ? "Analisando…" : view.state === "failed" ? "Tentar novamente" : view.state === "stale" ? "Analisar dados atuais" : view.state === "rejected" ? "Analisar novamente" : "Analisar aderência"}</button> : null}
      {(view.state === "pending_validation" || view.state === "rejected") ? <button name="operation" value="validate" className="button button-secondary" disabled={busy || !view.canValidate}>Validar resultado armazenado</button> : null}
      {view.state === "pending_validation" && !view.canValidate ? <p className={styles.integrationNote}>A validação de evidências não foi concluída. O resultado permanece preliminar.</p> : null}
    </form>
    {actionState.failure ? <p role="alert" className={styles.failure}>{failureMessages[actionState.failure.code]}</p> : null}
    {/* Ponto de composição: painéis de evidências e revisão humana do colega 1. */}
    {children}
  </section>;
}
