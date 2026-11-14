# Progresso da frente de evidências e revisão

## T01 — Ambiente e branch

Branch local `feat/evidence-review` criada a partir de `main` limpo. O projeto usa Node 22.23.2 (`.nvmrc`) e as dependências instaladas.

## T02 — Pontos de integração

- `src/lib/analysis.ts` e `src/lib/adherence/contracts.ts`: esquema público, saída do modelo e interfaces `EvidenceValidator`/`EvidencePromptSection`.
- `src/lib/adherence/prompt.ts` e `service.ts`: composição das instruções, hash de entrada, geração e revalidação.
- `src/lib/server/adherence.ts`: único ponto de composição do provedor, prompt e validador.
- `src/lib/adherence/repository.ts`: resultado completo e snapshot analisado ficam no servidor.
- `src/components/adherence/panel.tsx`: ponto `children` para evidências e revisão; o resultado completo não deve ir ao cliente.
- `src/app/oportunidades/[id]/page.tsx`: carrega registro e compõe a interface.

Faltam seção de prompt de evidências, validador real, registro de revisão, ações e painel. O cliente de IA existente será reutilizado.
