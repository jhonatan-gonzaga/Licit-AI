import "server-only";
import { getStore } from "./store";
import { OpenAIAdherenceProvider } from "../adherence/openai-provider";
import { AdherenceRepository } from "../adherence/repository";
import { OpportunityAdherenceService, type AdherenceIntegrations } from "../adherence/service";
import { evidencePrompt } from "../adherence/evidence-prompt";
import { evidenceValidator } from "../adherence/evidence";

// Único ponto de composição da aplicação. Colegas integram os adaptadores reais aqui.
export function createAdherenceService(integrations: AdherenceIntegrations = {}): OpportunityAdherenceService {
  return new OpportunityAdherenceService(new AdherenceRepository(getStore()), new OpenAIAdherenceProvider(), { evidencePrompt, evidenceValidator, ...integrations });
}
