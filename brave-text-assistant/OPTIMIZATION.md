# Otimização de consumo — Texto IA 0.8.0

Revisão em 04/11/2026. A otimização se aplica a OpenAI (Responses e Chat Completions), Gemini Developer API e Claude Messages. Nenhuma troca automática de modelo, truncamento de texto ou redução nova de raciocínio/limite de saída foi introduzida.

## O que mudou

| Caminho | Comportamento |
| --- | --- |
| Revisão inédita | Instruções compactas + texto/instrução completos, nos mesmos campos da API. |
| Automática idêntica concluída | Reaproveita o resultado por até 60s em RAM, sem uma nova chamada. |
| Automática idêntica em andamento | Compartilha o pedido da mesma origem de mensagem, preservando cancelamento. |
| Revisar agora / revisão manual | Consulta nova, mesmo com resultado em memória. |
| Testar Conexão | Consulta nova com frase fixa; pode consumir créditos. |
| Texto, instrução, aba, origem, modelo, chave, modo ou autorização diferentes | Não reaproveita o resultado anterior. |
| Falha, recusa ou saída incompleta | Não armazena o resultado e não faz tentativas automáticas silenciosas. |
| Falha ao salvar diagnóstico | Entrega a revisão válida recebida; não exige uma segunda geração. |

Permanecem a pausa de 2,5s, o cancelamento ao editar e as verificações antes de aplicar. O cache tem até quatro sugestões por escopo e 32 globais, com saída limitada a 32.000 caracteres. A entrada continua limitada a 4.000 caracteres e a instrução a 1.500. Veja [PRIVACY.md](PRIVACY.md).

## Medições locais reproduzíveis

Comparação com o código da 0.7.1, commit 4af816068147778fd30f33bef26ee671cdd7b872:

- Prefixo fixo de instruções: **303 → 181 caracteres**, removendo 122 (40,3%). Inclui regras e separador antes da instrução escolhida; exclui o texto e a instrução variável. As exigências de preservar sentido, fatos, nomes, números e idioma, ignorar comandos do texto e retornar apenas a revisão continuam presentes.
- Cenário simulado, executado separadamente para cada provedor: **10 pedidos automáticos exatamente iguais → 1 chamada de geração**; nove retornos de memória, sem cobrança adicional de geração por esses nove pedidos. Essa é uma contagem de chamadas do cenário de teste, não uma previsão de economia média ou faturamento real.
- Chamadas iguais simultâneas no mesmo contexto: **2 pedidos → 1 chamada**.
- Modelo/parâmetros preservados: OpenAI Responses e Gemini com limite de saída 8.192, OpenAI legado/Claude com 4.096. Esses valores são tetos; não representam consumo obrigatório por chamada. O modo Gemini já escolhido continua sendo respeitado.

**Caracteres não são tokens.** A contagem varia por tokenizador/modelo e o total cobrado depende também de saída, raciocínio, cache e regras comerciais. Não foi medido um percentual real de economia de tokens, qualidade ou latência nas três contas. Os testes usam respostas simuladas.

## Números informados pelas APIs

O diagnóstico da última chamada guarda apenas contagens numéricas válidas, quando fornecidas, além dos dados de conexão já existentes. Reutilização local retorna usage nulo e apiRequest falso, sem simular consumo zero informado pelo provedor ou atualizar o horário da última confirmação de conexão.

- OpenAI: usa input/output/total de Responses ou prompt/completion/total no formato legado; cache/raciocínio ficam em campos separados quando presentes. [Referência Responses](https://developers.openai.com/api/reference/resources/responses/methods/create).
- Claude: soma input_tokens, cache_read_input_tokens e cache_creation_input_tokens na entrada; soma output_tokens no total. [Contabilização do cache](https://platform.claude.com/docs/en/build-with-claude/prompt-caching).
- Gemini: usa promptTokenCount e totalTokenCount; a diferença compõe a saída total, incluindo raciocínio. thoughtsTokenCount e cache ficam separados para evitar dupla contagem. Ausência de informação suficiente retorna métrica desconhecida. [UsageMetadata](https://ai.google.dev/api/generate-content#UsageMetadata).

Não chama um endpoint adicional para contar tokens, não persiste o objeto bruto da API e não estima preço sem conhecer o contrato da conta. Campos ausentes permanecem desconhecidos, sem serem tratados como zero.

## Escolhas de implementação

Não foi acrescentado cache explícito cobrado pelo provedor ou preenchimento artificial de prompts. Seus mínimos de tamanho e custos de escrita exigem medição por modelo/conta; não se deve presumir vantagem para textos curtos. Referências: [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) e [Claude prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching).

Também não foi reduzido o esforço de raciocínio para obter uma economia sem comparação de qualidade. O próprio [guia de esforço do Claude](https://platform.claude.com/docs/en/build-with-claude/effort) descreve a relação entre esforço e capacidade. O usuário mantém o controle do modelo e modo.

O serviço pode ser encerrado pelo navegador e perder o cache antes de 60 segundos. Isso apenas exige uma nova chamada autorizada; não perde preferências por site ou conexão da sessão. [Ciclo do service worker](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).

## Validação

npm run check e npm test. A suíte inclui respostas das três integrações, saída incompleta/malformada/excessiva, privacidade das métricas, limite/expiração do cache, isolamento de aba/origem, invalidação por configurações, cancelamento durante preparação/navegação e reaproveitamento sem nova chamada.

A avaliação com conta real ainda deve comparar os mesmos exemplos nas duas versões, registrando usage, duração e avaliação humana da revisão. Não houve validação nativa do Brave/Win + . nem benchmark real de qualidade, custo ou latência nesta etapa. A interface e os controles existentes foram preservados.
