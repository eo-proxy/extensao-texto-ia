# Texto IA — GHS Studio · 0.8.0

Assistente de revisão para navegadores Chromium de computador com OpenAI (GPT), Google Gemini e Anthropic Claude. Cada pessoa utiliza sua própria chave de API. A GHS Studio não recebe os textos em servidor próprio.

## Instalar e atualizar

1. Extraia o ZIP em uma pasta permanente.
2. Abra a página de extensões: brave://extensions no Brave, chrome://extensions no Chrome ou edge://extensions no Edge. Ative Modo do desenvolvedor e use Carregar sem compactação.
3. Selecione a pasta brave-text-assistant, que contém manifest.json.
4. Para atualizar uma instalação existente, substitua os arquivos da mesma pasta e clique em Recarregar. Atualize também as abas e janelas de sites instalados como aplicativo.
5. Abra o ícone da extensão e entre na aba Configuração.

Remover a extensão apaga seu armazenamento. O ZIP não contém chaves ou dados pessoais.

A janela mantém o mesmo tamanho ao alternar entre Revisar texto e Configuração. O cabeçalho, as abas e o rodapé ficam fixos; conteúdos maiores rolam apenas na área central. Ao trocar de aba, o conteúdo volta ao início.

## Conexão

1. Escolha OpenAI, Gemini ou Claude. O link Criar chave abre o painel oficial correspondente; as instruções detalhadas ficam em Como conectar.
2. Cole sua chave. Marque Lembrar chave neste dispositivo somente se quiser guardá-la no perfil local.
3. Clique em Salvar, acima do botão Encerrar Conexão. O modelo pode ficar vazio na primeira etapa.
4. Se necessário, clique em Autorizar acesso. A conexão já foi preparada na sessão antes do aviso, que pode fechar a janela.
5. Use Consultar modelos, logo abaixo do campo de modelo, e escolha uma opção da conta, ou informe um ID manualmente.
6. Clique em Salvar para ativar, ou em Testar Conexão para ativar e confirmar uma geração com frase de exemplo. O teste pode consumir créditos.
7. O botão Testar Conexão fica ao lado do diagnóstico. O cabeçalho fica verde com Conectado depois de uma confirmação válida. Sem confirmação ou após falha atual, mostra Desconectado em vermelho. O diagnóstico da conexão atual fica verde em sucesso e vermelho em falha.

As APIs de modelos nem sempre confirmam permissão de geração, saldo ou cota. Não é possível comprovar isso apenas pela lista. O teste real confirma somente que o modelo respondeu naquele momento.

### Sem lembrar a chave — padrão

A conexão fica apenas em chrome.storage.session, na memória do navegador. Fechar e reabrir o popup ou reiniciar o service worker mantém a sessão. Trocar de provedor descarta a conexão temporária anterior; encerrar o navegador descarta a sessão.

Não há retenção de rascunhos de chave/modelo ao alternar o seletor. As configurações antigas salvas automaticamente são retiradas do disco na atualização. A conexão ativa antiga pode continuar apenas na memória até trocar de IA ou encerrar o navegador.

### Lembrar a chave — opcional

Marque Lembrar chave neste dispositivo e clique em Salvar. Os perfis lembrados ficam separados por provedor no perfil do Brave. Desmarcar remove a cópia permanente imediatamente e mantém apenas a conexão ativa da sessão. Encerrar Conexão remove ambas as cópias.

## Escolher os sites

Na primeira visita a um endereço de site, o robô pergunta se você quer ativar a revisão. Sim, ativar permite usar a IA; Não mantém a revisão desativada. A escolha é salva no dispositivo, inclusive ao reiniciar o navegador.

Para mudar a decisão, abra o robô e marque ou desmarque Usar IA neste site. A mesma opção existe em Revisar texto. O ícone continua acessível nos sites desativados. O botão global Mostrar robô na página controla a exibição geral.

A decisão vale para todas as páginas do mesmo endereço base (origem: protocolo, domínio e porta), sem salvar caminhos ou parâmetros. Subdomínios, HTTP/HTTPS e portas diferentes têm decisões independentes. Limpar os dados da extensão ou removê-la apaga as escolhas; trocar de provedor ou encerrar a conexão não apaga essa lista.

A extensão aguarda a primeira decisão antes de ler ou enviar revisões. Depois de ativar, digite para iniciar a revisão automática. Desativar cancela revisões pendentes e invalida respostas antigas.

## Revisar texto

- O robô de 40 × 40 px pode ser arrastado.
- Com Revisar ao parar de digitar ligado, uma chamada começa 2,5 segundos depois da última entrada, para texto não vazio de até 4.000 caracteres.
- A sugestão chega depois da resposta do provedor; 2,5 segundos é o início da chamada, não uma garantia de resposta.
- Apagar ou enviar o texto recolhe o painel, inclusive quando o site limpa o campo sem disparar input.
- Digitar novamente fecha o painel, descarta a sugestão anterior, cancela a chamada e reinicia os 2,5 segundos.
- Aplicar ou Descartar recolhe o painel que abriu sozinho. Se o usuário o abriu depois de digitar, ele permanece aberto após a decisão.
- Aplicar sem confirmação vem desligado. Quando ligado, substitui o texto assim que a IA termina, sem um clique adicional.
- Pedidos automáticos idênticos podem reaproveitar uma revisão por até 60 segundos, somente em memória e na mesma aba/site/configuração. Texto ou instrução diferentes geram uma chamada nova.
- Revisar agora sempre consulta a API novamente. No popup, Revisar um campo manualmente inclui instrução e seleção de trecho.
- Pausar a revisão ou ocultar o botão impede chamadas automáticas naquela página.
- Respostas de texto desatualizado, incompletas, bloqueadas ou de outra conexão não são aplicadas.
- Há limite de 1.500 caracteres na instrução. Campos protegidos por senha, autocomplete de acesso/cartão, somente leitura ou data-texto-ia-ignore são excluídos.

## Desfazer uma sugestão

Depois de aplicar, abra o robô flutuante ou a aba Revisar texto e clique em Desfazer sugestão para restaurar o texto anterior. Funciona também com Aplicar sem confirmação e revisões de trechos selecionados.

Há um nível de desfazer: uma nova aplicação substitui a anterior. Uma edição posterior, o envio/limpeza do campo, sua remoção ou bloqueio desativa a restauração para preservar o conteúdo atual. O texto anterior fica somente na memória daquela página; recarregar ou fechar a página descarta a possibilidade de desfazer. A restauração não faz outra chamada de IA.

## Gemini: modelo, demora e erros

Usa [generateContent](https://ai.google.dev/api/generate-content) com x-goog-api-key da [Gemini Developer API](https://ai.google.dev/gemini-api/docs/generate-content/api-key). Aceita IDs com ou sem o prefixo models/. Não usa Vertex AI ou JSON de conta de serviço.

O modo Rápido reduz o raciocínio apenas nos modelos com configuração conhecida:

- gemini-3.6-flash, gemini-3.5-flash-lite e gemini-3-flash-preview: thinkingLevel minimal.
- gemini-3.8-flash, gemini-3.1-pro, gemini-3-pro e gemini-4-argon: thinkingLevel low.
- Gemini 2.5 Flash: thinkingBudget 0; Gemini 2.5 Pro: thinkingBudget 128.
- Modelos desconhecidos não recebem esses parâmetros. Padrão do modelo preserva os parâmetros nativos.

Essa configuração segue o [guia de raciocínio do Google](https://ai.google.dev/gemini-api/docs/generate-content/thinking). Ela pode reduzir latência; não resolve cotas ou indisponibilidade do serviço.

429 indica limite/cota. 503 indica sobrecarga temporária. A extensão mostra códigos separados, respeita pausas informadas pela API e não repete silenciosamente uma geração. Os [limites variam por projeto e modelo](https://ai.google.dev/gemini-api/docs/rate-limits), e os [guias do Google](https://ai.google.dev/gemini-api/docs/troubleshooting) descrevem esses erros. Não é possível afirmar a causa de uma falha específica sem o código do erro.

## Lista de modelos

A lista é consultada no endpoint oficial com a chave da própria conta e paginada. Não é uma lista fixa de modelos escolhidos pela GHS Studio.

- OpenAI: candidatos de texto GPT e séries de raciocínio, excluindo áudio, imagem, pesquisa, embeddings, Codex e outras funções específicas.
- Gemini: modelos que anunciam generateContent, excluindo áudio, imagem, live, embeddings, robótica e computer use.
- Claude: modelos de texto retornados pela chave, excluindo retirados e variantes especializadas filtradas.
- Versões datadas duplicadas são ocultadas quando o alias equivalente também existe.
- Modelos preview/experimentais ficam ocultos por padrão e podem ser incluídos pela checkbox antes da consulta.
- Modelos rápidos aparecem primeiro. A escolha continua sendo do usuário; não há troca automática por outro modelo.

## Outras integrações

OpenAI usa Responses para modelos atuais e Chat Completions para os antigos que exigem esse formato. Crie a chave na [plataforma OpenAI](https://platform.openai.com/api-keys) e confira permissões e cobrança. [Referência de texto](https://developers.openai.com/api/docs/guides/text).

Claude usa a Messages API direta, autenticação Bearer, versão explícita e a chave da [Claude Console](https://platform.claude.com/settings/keys). Não aceita chaves de Bedrock ou Vertex AI. [Autenticação](https://platform.claude.com/docs/en/manage-claude/authentication).

Acesso ao aplicativo de conversa não configura a API nesta extensão. Disponibilidade, saldo e cobrança são controlados por cada provedor.

## Consumo de tokens

As três integrações usam instruções enxutas e evitam pedidos automáticos duplicados. O diagnóstico guarda os números de tokens informados pela API quando disponíveis, sem textos ou chaves. A extensão não faz chamadas extras para contar tokens nem troca seu modelo. Veja [OPTIMIZATION.md](OPTIMIZATION.md) para as medições, controles e limites.

## Segurança e limites

Leia [PRIVACY.md](PRIVACY.md) e [SECURITY.md](SECURITY.md). As proteções foram verificadas em código e testes locais, sem garantia de ausência total de vulnerabilidades. Chaves lembradas ficam no perfil sem criptografia adicional da aplicação; use a sessão temporária se não quiser a cópia permanente.

Não há suporte a brave://, lojas de extensões e páginas protegidas. Alguns editores complexos, iframes ou canvas exigem adaptação. Cancelar a chamada não garante estorno de processamento já iniciado pelo provedor. A instalação é local e não tem atualização automática por loja.


## Compatibilidade

Consulte [COMPATIBILITY.md](COMPATIBILITY.md) antes de distribuir para outro navegador. O pacote Chromium atual não é instalável diretamente no Firefox ou Safari.

## Emojis e composição do teclado

A revisão acompanha o estado isComposing informado pela entrada do navegador. Uma entrada confirmada encerra um estado antigo de composição mesmo se compositionend não tiver chegado. Eventos de teclado fora de composição e o retorno à página também permitem retomar a revisão, mantendo a pausa de 2,5 segundos e o cancelamento de respostas antigas.

Enquanto a entrada indica composição ativa, a revisão automática continua pausada para não processar texto incompleto. Foram usados testes locais de sequências de eventos; o painel nativo Win + . não foi exercitado nesta validação. Referência: [UI Events — isComposing](https://www.w3.org/TR/uievents/#dom-inputevent-iscomposing).
