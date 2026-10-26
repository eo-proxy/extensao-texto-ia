# Texto IA — GHS Studio

Extensão Brave Manifest V3, versão **0.5.0**. Revisa o campo ativo com a chave de API do próprio usuário. Não exige servidor da GHS Studio ou dependências para instalar.

## Instalar ou atualizar

1. Extraia o ZIP em uma pasta permanente.
2. Abra brave://extensions, ative **Modo do desenvolvedor** e escolha **Carregar sem compactação**.
3. Selecione a pasta **brave-text-assistant** que contém manifest.json.
4. Para atualizar, substitua os arquivos na mesma pasta e clique em **Recarregar**. Isso preserva as configurações; remover a extensão apaga o armazenamento.
5. Atualize as páginas e janelas de sites instalados como aplicativo.
6. Abra o ícone da extensão. Cada pessoa configura sua própria chave; o ZIP não contém credenciais.

A instalação é local, sem atualização automática por loja. Para compartilhar, envie o ZIP e estas instruções.

## Configurar sua IA

O guia, os campos e os links oficiais mudam conforme o provedor escolhido.

1. Escolha OpenAI (GPT), Google Gemini ou Anthropic Claude.
2. Use **Criar chave** para obter a credencial no painel oficial.
3. Cole a chave e clique em **Salvar e usar este provedor**. O ID do modelo pode ficar vazio nesta etapa.
4. Clique em **Autorizar acesso no Brave**. Se o aviso fechar a janela, reabra-a: a chave já está salva.
5. Use **Consultar modelos** e escolha um modelo de texto, ou informe o ID manualmente.
6. Clique em **Testar conexão**. Esse botão salva o modelo e gera uma resposta com uma frase fixa. Pode haver cobrança de API.
7. O rodapé mostra **conexão testada** somente após uma geração bem-sucedida. Listar modelos não confirma saldo ou cota de geração.

As configurações dos três provedores ficam separadas. O seletor permite editar outro provedor; **Salvar**, **Consultar modelos** ou **Testar conexão** salva os campos e ativa o provedor selecionado nas próximas revisões. Apagar sua chave preserva os demais provedores.

### OpenAI (GPT)

- Crie a chave do projeto em [API keys](https://platform.openai.com/api-keys).
- Confira o faturamento e as permissões da chave na plataforma.
- Usa Responses API para modelos atuais e Chat Completions para modelos antigos desse formato.
- A API de modelos não informa a compatibilidade com todos os endpoints. A extensão filtra candidatos de texto; confirme com **Testar conexão**.
- Chaves restritas podem impedir a listagem. Nesse caso, informe o ID manualmente.
- [Documentação oficial](https://developers.openai.com/api/docs/guides/text).

### Google Gemini

- Crie a chave em [Google AI Studio](https://aistudio.google.com/apikey), no projeto Google Cloud escolhido.
- Se o projeto não aparecer, importe-o em Projects e confira as permissões para criar chaves.
- Usa a **Gemini Developer API**, com x-goog-api-key e generateContent, sem Vertex AI.
- Não é necessário preencher Project ID, enviar JSON de credenciais ou configurar uma conta de serviço manualmente.
- Aceita o ID simples ou com o prefixo models/, que é normalizado.
- Lista modelos Gemini com suporte a generateContent, filtrando variantes dedicadas a imagem, áudio e embeddings.
- Cotas, regiões e cobrança dependem do projeto. Chaves antigas irrestritas ou bloqueadas podem ser recusadas; confira as orientações atuais do Google.
- [Guia das chaves](https://ai.google.dev/gemini-api/docs/generate-content/api-key), [generateContent](https://ai.google.dev/api/generate-content), [modelos](https://ai.google.dev/api/models).

### Anthropic Claude

- Crie a chave na [Claude Console](https://platform.claude.com/settings/keys), no workspace escolhido, e confira créditos e limites.
- Usa Messages API direta, autenticação Bearer e versão explícita da API.
- Chaves de Bedrock ou Vertex AI não são aceitas nesta integração.
- [Autenticação](https://platform.claude.com/docs/en/manage-claude/authentication), [Messages API](https://platform.claude.com/docs/en/api/messages/create), [modelos](https://platform.claude.com/docs/en/api/models/list).

Entrar no ChatGPT, Gemini ou Claude no navegador não configura a chave nesta extensão. Confira a disponibilidade e o faturamento da API no painel de cada provedor.

## Uso diário

- O botão de **40 × 40 pixels** mostra só o robô e a lupa. Arraste para mover.
- A geração automática vem ligada. Lê textarea e contenteditable a partir de 40 caracteres, após 2,8 segundos de pausa. Há pelo menos 12 segundos entre chamadas automáticas por página.
- Escolha Profissional, Técnico ou Corrigir; use Gerar agora para revisão manual.
- **Aplicar sugestões automaticamente** vem desligado. Revise e escolha Aplicar ou Descartar. O painel que abriu sozinho volta a minimizar; o painel aberto pelo usuário permanece aberto.
- Ao ligar a aplicação automática, o texto é inserido sem confirmação e o painel mantém seu estado.
- Se o texto mudar durante a geração, a sugestão antiga não é aplicada. Respostas bloqueadas ou incompletas também não são aplicadas.
- A extensão retoma o agendamento ao voltar à página.
- Desligue **Automático** para pausar os envios. Ocultar o botão também para as sugestões naquela página.
- Limite: 4.000 caracteres por revisão e 1.500 na instrução.

## Dados e privacidade

Leia [PRIVACY.md](PRIVACY.md).

- Chaves e modelos ficam em chrome.storage.local do perfil, separados por provedor, sem sincronização nem criptografia adicional da aplicação.
- O armazenamento é restrito às páginas da extensão e ao service worker. O código dos sites recebe só o estado e as preferências públicas.
- Não há chave da GHS Studio no pacote, servidor intermediário, analytics ou coleta do conteúdo completo das páginas.
- O campo ou trecho selecionado é enviado diretamente à API ativa, que o processa segundo suas condições.
- Erros são traduzidos sem exibir a resposta bruta da API ou a chave.
- Apague a chave na extensão e revogue-a no provedor para cancelar seu uso.
- Este modo usa uma chave pessoal por instalação. Uma credencial da empresa compartilhada exigiria servidor e proteção das chaves fora do navegador.

## Limitações e verificação

- Não funciona em brave://, lojas de extensões e páginas protegidas.
- Alguns editores complexos, iframes e canvas podem exigir adaptações.
- Estar na lista não garante acesso ao modelo: saldo, região, permissões e cotas variam.
- Fontes oficiais conferidas em **26/10/2026**. Os testes usam respostas simuladas; não foram feitas chamadas pagas com chaves reais nesta revisão.
- Não troca de modelo nem repete silenciosamente uma chamada após erro.

