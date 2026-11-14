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

## T07 — Política de validação literal

`approved` exige que cada trecho não vazio seja uma substring literal, sensível a maiúsculas, do `description` armazenado no snapshot da análise. Campo diferente de `description`, texto ausente ou citação inventada recebem `rejected` com `evidence_not_found`. Classificação conclusiva sem citação recebe `rejected` com `evidence_missing`. `precisa_de_revisao` sem citação só pode receber `approved` quando explicita ao menos uma lacuna em `missingInformation`; a aprovação atesta a política de evidências, não a conclusão comercial nem uma revisão humana. Exceções, timeout e retorno inválido do adaptador recebem `unavailable`, permanecendo `pending_validation` com `validator_unavailable` ou `validator_invalid_response`. Os limites de listas e textos são validados antes, por `modelOutputSchema`. O validador literal não determina se uma citação sustenta semanticamente a conclusão; essa limitação requer revisão humana.

## T11 — Estados da integração

A suíte `tests/adherence.test.ts` passou cobrindo `pending_validation`, `validated`, `rejected`, `stale`, revalidação sem nova geração e invalidação por alteração de perfil, oportunidade, prompt, esquema e versão do validador. O estado `validated` representa aprovação das evidências; revisão humana fica em registro separado.
