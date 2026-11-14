"use client";
import { useActionState } from "react";
import { saveHumanReview } from "@/app/oportunidades/[id]/review-actions";
import type { HumanReview } from "@/lib/adherence/repository";
import styles from "./adherence.module.css";

export function ReviewPanel({ opportunityId, analysisId, current, reviews }: {
  opportunityId: string; analysisId: string; current: boolean;
  reviews: HumanReview[];
}) {
  const [state, action, pending] = useActionState(saveHumanReview, { message: "", saved: false });
  return <div className={styles.review}>
    {current ? <form action={action} className={styles.reviewForm}>
      <h3>Sua revisão</h3><p>Esta decisão é sua e não altera a resposta original da IA. Sem login, o registro não confirma sua identidade.</p>
      <input type="hidden" name="id" value={opportunityId}/><input type="hidden" name="analysisId" value={analysisId}/>
      <label htmlFor="review-note">Observação ou correção</label><textarea id="review-note" name="note" maxLength={1000} rows={3}/>
      <div className={styles.reviewButtons}><button type="submit" name="decision" value="agree" disabled={pending} className="button button-secondary">Concordo</button><button type="submit" name="decision" value="disagree" disabled={pending} className="button button-secondary">Discordo</button></div>
      {state.message ? <p role="status">{state.message}</p> : null}
    </form> : <p>Revisão indisponível: resultado preliminar ou desatualizado.</p>}
    {reviews.length ? <><h3>Histórico de revisão</h3><ul>{reviews.map((review) => <li key={review.id}><strong>{review.decision === "agree" ? "Concordou" : "Discordou"}</strong> · {new Date(review.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}{review.note ? <p>{review.note}</p> : null}</li>)}</ul></> : null}
  </div>;
}
