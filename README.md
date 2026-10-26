# Texto IA — GHS Studio

Extensão Brave para revisar textos com **OpenAI (GPT), Google Gemini e Anthropic Claude**, usando a chave de API de cada pessoa.

Versão **0.5.0**. Interface em português, tema escuro e botão compacto com o robô e a lupa da GHS Studio.

## Instalação

Extraia brave-text-assistant.zip, abra brave://extensions e use **Carregar sem compactação** na pasta brave-text-assistant. Para atualizar a instalação existente, recarregue a extensão e as páginas abertas.

Consulte o [guia dos provedores e de instalação](brave-text-assistant/README.md) e a [explicação de privacidade](brave-text-assistant/PRIVACY.md). Nenhuma credencial pessoal acompanha o repositório ou ZIP.

## Desenvolvimento

Node.js 22 ou mais recente. A extensão e os testes não exigem bibliotecas npm.

- npm run check: verifica manifesto, arquivos, formulário e sintaxe.
- npm test: verifica as APIs, erros, migração, permissões, isolamento das chaves, formulário e fluxos do widget.

Fontes oficiais conferidas em 26/10/2026. Os testes usam respostas simuladas e não consomem as APIs. Para confirmar uma conta real, use **Testar conexão** na extensão, com uma frase fixa e possível cobrança.

## Arquivos

- brave-text-assistant/: extensão instalável.
- tests/: verificações sem credenciais reais.
- scripts/: conferência do pacote.
- brave-text-assistant.zip: pacote para instalação local.

Para gerar o ZIP no PowerShell: Compress-Archive -Path brave-text-assistant -DestinationPath brave-text-assistant.zip -Force.

