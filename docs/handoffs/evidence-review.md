# Handoff — evidências e revisão humana

Branch `feat/evidence-review`. O contrato de saída existente permanece igual: `evidence` cita somente `description` e `missingInformation` enumera lacunas. `OUTPUT_SCHEMA_VERSION` continua `adherence-proposal.v1`. Os hashes de esquema, prompt e entradas já versionam a análise; a seção nova usa `evidence.v1`.

## Funcionamento

- `src/lib/adherence/evidence-prompt.ts` fornece instruções para a mesma chamada que classifica a oportunidade; `src/lib/adherence/evidence.ts` fornece um `EvidenceValidator` local. Cada trecho precisa ocorrer literalmente na descrição preservada no snapshot da análise. Classificação conclusiva sem citação é rejeitada. `precisa_de_revisao` sem citação exige ao menos uma lacuna. O validador verifica a presença do trecho, não a verdade da conclusão comercial.
- `src/lib/server/adherence.ts` conecta prompt e validador em todas as leituras e ações. A nova seção muda o hash do prompt; resultados gerados sem ela ficam desatualizados. A revalidação de uma resposta compatível usa o resultado salvo, sem nova chamada ao modelo.
- `adherence-002-review` cria `adherence_reviews` sem modificar a migração anterior. Cada revisão guarda ID da análise, hash das entradas, concordância ou discordância, observação e data. A resposta da IA não é alterada. A ação só aceita análise atual com evidências aprovadas; discordar exige observação. Não há login, portanto o registro não comprova identidade de revisor.
- A página de detalhes mostra citações, lacunas e histórico; as ações de revisão ficam disponíveis apenas para análise atual validada. Resposta bruta e snapshots permanecem no servidor.

## Verificação e limites

`npm run check` e `npm run smoke` verificam software local. `tests/evidence.test.ts` cobre presença literal e ausência de suporte; `tests/adherence.test.ts` verifica migração e persistência da revisão. `docs/evaluations/evidence-cases.json` registra cinco oportunidades reais com trechos propostos e revisão humana pendente. Sem chave API, não houve chamada a modelo nem avaliação de qualidade. Uma instrução maliciosa nos dados é tratada como texto pelo prompt, mas a resistência do modelo ainda exige avaliação com chamadas reais.

Um fluxo HTTP isolado foi conferido com banco temporário e resposta simulada: a página exibiu trechos e formulário; discordância sem observação retornou erro e não gravou; concordância gravou uma revisão; após alterar o perfil, a página ocultou o formulário, preservou o histórico e rejeitou o envio antigo sem criar outra revisão.

Uma citação literal pode existir e ainda ser irrelevante; revisão humana continua necessária. `additionalInformation`, anexos e itens não são fontes citáveis nesta versão. Ampliar campos exige nova versão do contrato, prompt e testes. A revisão fica restrita ao uso local atual, sem autenticação.

## Falha encontrada e corrigida

Na separação do painel de revisão, o TypeScript detectou propriedades removidas da interface mas ainda usadas na desestruturação. A assinatura foi corrigida antes do commit T17; o typecheck voltou a passar.

## Pendente de avaliação cruzada

T20 exige os cinco casos preparados por outro integrante. Esses casos ainda não estão disponíveis nesta máquina. A seção de divergências será acrescentada após recebê-los; por isso este handoff é preliminar e T21 continua pendente.
