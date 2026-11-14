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

## T03 — Contrato de partida para integração

`modelOutputSchema` contém `classification`, `justification`, `matchedCriteria`, `conflictingCriteria`, `evidence` e `missingInformation`; a versão atual é `adherence-proposal.v1`. Cada evidência usa `field: "description"` e `excerpt` literal. Nenhum outro campo pode ser citado nesta versão, inclusive `additionalInformation` e anexos. O servidor preenche ID, modelo, data, versão do perfil, prompt e hashes. `opportunityHash` representa a projeção analisada, enquanto `sourceRecordHash` preserva o hash integral do registro de origem. O contrato já comporta a primeira entrega sem ampliar campos.

Este documento é o handoff versionado para a equipe; mudanças nos campos citáveis exigem nova versão do esquema e testes de integração.

## T04 — Revisão do esquema

`analysisResultSchema` exige classificação do domínio, justificativa limitada, até 20 evidências literais de `description` e até 30 lacunas. `modelOutputSchema` acrescenta listas limitadas de critérios e usa `.strict()`, recusando metadados enviados pelo modelo. O servidor valida o resultado novamente após adicionar modelo, data, perfil, ID e hash. Não há lacuna de formato para esta entrega; nenhum campo ou versão foi alterado.
