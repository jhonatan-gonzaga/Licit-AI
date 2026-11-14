"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { parseRouteId } from "@/lib/domain";
import { createAdherenceService } from "@/lib/server/adherence";

export type ReviewActionState = { message: string; saved: boolean };
export async function saveHumanReview(_previous: ReviewActionState, form: FormData): Promise<ReviewActionState> {
  const id = parseRouteId(form.get("id"));
  const parsed = z.object({ analysisId: z.uuid(), decision: z.enum(["agree", "disagree"]), note: z.string().trim().max(1000) }).safeParse({
    analysisId: form.get("analysisId"), decision: form.get("decision"), note: form.get("note"),
  });
  if (!id || !parsed.success) return { message: "Dados da revisão inválidos.", saved: false };
  const { analysisId, decision, note } = parsed.data;
  if (decision === "disagree" && !note) return { message: "Explique a discordância na observação.", saved: false };
  try {
    const service = createAdherenceService();
    service.review(id, analysisId, decision, note);
    revalidatePath(`/oportunidades/${encodeURIComponent(id)}`);
    return { message: "Revisão salva.", saved: true };
  } catch {
    return { message: "Não foi possível salvar a revisão. Atualize a página e tente novamente.", saved: false };
  }
}
