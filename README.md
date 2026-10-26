# Texto IA — GHS Studio

Extensão Brave **0.6.0** para revisar textos com OpenAI (GPT), Google Gemini e Anthropic Claude, usando a chave de API de cada pessoa.

## O que mudou

- Revisão começa após **2,5 segundos sem digitar**, sem a espera fixa anterior de 12 segundos.
- Retomar a digitação recolhe a sugestão e cancela a chamada anterior; respostas antigas não substituem o novo texto.
- **Lembrar chave neste dispositivo** vem desligado. Sem marcar, a conexão fica só na memória da sessão e é descartada ao trocar de IA ou encerrar o Brave.
- Gemini tem modo rápido com configuração de raciocínio compatível com o modelo, incluindo nível mínimo no gemini-3.6-flash.
- Listagem autenticada filtra modelos de texto, especialistas, versões duplicadas e experimentais; Testar modelo confirma a geração.
- Interface com abas Revisar texto e Sua IA, controles explicados e diagnóstico sem texto ou chave.

## Instalação

Extraia brave-text-assistant.zip. Em brave://extensions, ative Modo do desenvolvedor e use Carregar sem compactação na pasta brave-text-assistant.

Para atualizar, substitua os arquivos da mesma pasta, recarregue a extensão e atualize as páginas abertas. A atualização remove as chaves antigas salvas automaticamente do disco, mantendo a conexão ativa na memória da sessão. Marque Lembrar chave neste dispositivo e ative a configuração se quiser persistência.

Veja o [guia de uso](brave-text-assistant/README.md), a [privacidade](brave-text-assistant/PRIVACY.md) e a [revisão de segurança](brave-text-assistant/SECURITY.md). Nenhuma credencial pessoal acompanha o ZIP ou o repositório.

## Desenvolvimento e testes

Node.js 22 ou mais recente. Sem dependências npm de execução ou teste.

- npm run check: manifesto, arquivos, formulário e sintaxe.
- npm test: integrações, filtros, sessão, migração, isolamento de credenciais, cancelamento, seleção segura e tempo de espera com relógio simulado.

Os testes usam respostas simuladas, sem consumir APIs reais. O teste na extensão usa uma frase fixa e pode consumir créditos do provedor. A prévia visual local não foi concluída no ambiente de execução por restrição de acesso a sockets.

Para gerar o ZIP no PowerShell: Compress-Archive -Path brave-text-assistant -DestinationPath brave-text-assistant.zip -Force.

