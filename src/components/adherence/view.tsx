import type { AnalysisState, AnalysisView } from "@/lib/adherence/contracts";
import { failureMessages } from "@/lib/adherence/errors";
import { collectionDate } from "@/lib/format";
import styles from "./adherence.module.css";

export const classificationLabels = { possivel_aderencia: "Possível aderência", fora_do_perfil: "Fora do perfil", precisa_de_revisao: "Precisa de revisão" } as const;
export const analysisStateLabels: Record<AnalysisState, string> = {
  not_configured: "Não analisada · IA não configurada", not_analyzed: "Não analisada", processing: "Processando análise",
  pending_validation: "Pendente de validação", validated: "Evidências aprovadas", rejected: "Validação rejeitada", failed: "Falha na análise", stale: "Análise desatualizada",
};
export function AnalysisStatusBadge({ view }: { view: AnalysisView }) {
  const final = view.state === "validated" && view.stages.evidenceApproved && view.result;
  return <span className={`${styles.badge} ${final ? styles.valid : styles[view.state]}`}>{final ? classificationLabels[view.result!.classification] : analysisStateLabels[view.state]}</span>;
}
export function AdherenceContent({ view }: { view: AnalysisView }) {
  const visibleResult = view.result && ["validated", "pending_validation", "stale", "rejected"].includes(view.state);
  return <>
    <div className={styles.status} role="status" aria-live="polite"><AnalysisStatusBadge view={view}/></div>
    {view.state === "not_configured" ? <p>IA não configurada. A chave do provedor deve ser configurada no servidor.</p> : null}
    {view.state === "not_analyzed" ? <p>Análise com IA ainda não executada. Inicie quando quiser comparar esta oportunidade com o perfil salvo da empresa.</p> : null}
    {view.state === "processing" ? <p>A análise está em processamento. Não é necessário enviar outra solicitação.</p> : null}
    {view.state === "pending_validation" ? <p className={styles.notice}>Resultado preliminar: a estrutura foi aprovada, mas a validação de evidências está pendente. A classificação ainda não é final.</p> : null}
    {view.state === "rejected" ? <p className={styles.notice}>A validação de evidências não aprovou este resultado. Ele não pode ser usado como classificação final.</p> : null}
    {view.state === "stale" ? <p className={styles.notice}>Os dados, o perfil ou a configuração da análise mudaram. O resultado anterior está desatualizado.</p> : null}
    {view.state === "failed" && view.failure ? <p className={styles.failure} role="alert">{failureMessages[view.failure.code]}</p> : null}
    {visibleResult ? <div className={styles.result}>
      <span className={styles.label}>{view.state === "validated" ? "Classificação com evidências aprovadas" : view.state === "stale" ? "Classificação anterior · desatualizada" : "Classificação preliminar"}</span>
      <h3>{classificationLabels[view.result!.classification]}</h3>
      <h4>Justificativa</h4><p>{view.result!.justification}</p>
      <h4>Critérios atendidos</h4>{view.result!.matchedCriteria.length ? <ul>{view.result!.matchedCriteria.map((text, i) => <li key={i}>{text}</li>)}</ul> : <p>Nenhum critério informado pelo modelo.</p>}
      <h4>Critérios conflitantes</h4>{view.result!.conflictingCriteria.length ? <ul>{view.result!.conflictingCriteria.map((text, i) => <li key={i}>{text}</li>)}</ul> : <p>Nenhum conflito informado pelo modelo.</p>}
      <p className={styles.timestamp}>Análise: {collectionDate(view.analyzedAt)} (Brasília)<br/>Modelo: {view.result!.model}</p>
    </div> : null}
    {view.analysisId ? <ol className={styles.stages} aria-label="Etapas de validação da análise"><li>{view.stages.responseReceived ? "Resposta recebida" : "Resposta ainda não recebida"}</li><li>{view.stages.structureApproved ? "Estrutura aprovada" : "Estrutura não aprovada"}</li><li>{view.stages.evidenceApproved ? "Evidências aprovadas" : view.state === "rejected" ? "Evidências reprovadas" : "Evidências não aprovadas"}</li></ol> : null}
    <p className={styles.disclaimer}>Aderência é compatibilidade comercial inicial. A conferência de requisitos e a decisão continuam com você.</p>
  </>;
}
