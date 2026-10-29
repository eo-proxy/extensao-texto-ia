# Texto IA — GHS Studio

Extensão **0.6.6** para revisar textos com OpenAI (GPT), Google Gemini e Anthropic Claude, usando a chave de API de cada pessoa.

## Interface

- Texto inicial e descrições das opções mais diretos.
- Abas Revisar texto e Configuração em uma janela de tamanho fixo, com cabeçalho e rodapé sempre visíveis e rolagem só no conteúdo.
- Indicador Conectado verde após confirmação e Desconectado vermelho quando não confirmado ou com falha.
- Diagnóstico verde para sucesso e vermelho para falha da configuração atual.
- Controle compacto e centralizado com o símbolo de desligar e Encerrar Conexão logo abaixo.
- Desfazer sugestão no robô e em Revisar texto restaura a última aplicação, incluindo correções automáticas.
- A revisão após 2,5 segundos, o cancelamento ao digitar e o salvamento opcional continuam disponíveis.

## Instalação e navegadores

Extraia texto-ia.zip e carregue a pasta brave-text-assistant pela página de extensões do navegador, com Modo do desenvolvedor ativado. O nome histórico da pasta permite atualizar instalações existentes sem renomeá-las.

O pacote utiliza APIs Chromium, com compatibilidade técnica esperada em Brave, Chrome e Edge atuais, e potencialmente Opera/Vivaldi. Firefox, Safari e navegadores móveis não estão cobertos pelo pacote atual. Consulte a [matriz de compatibilidade e os limites da verificação](brave-text-assistant/COMPATIBILITY.md). Não houve confirmação nativa de todos os navegadores nesta revisão.

brave-text-assistant.zip é uma cópia idêntica do pacote para manter o fluxo de atualização anterior.

## Uso, privacidade e segurança

Consulte o [guia de uso](brave-text-assistant/README.md), a [privacidade](brave-text-assistant/PRIVACY.md) e a [revisão de segurança](brave-text-assistant/SECURITY.md). Nenhuma credencial pessoal acompanha os pacotes ou o repositório.

Lembrar chave neste dispositivo vem desligado. Sem marcar, os dados ficam na memória da sessão. Uma configuração lembrada recebe o estado Conectado somente após uma confirmação anterior válida; uma falha atual muda o indicador para Desconectado. O estado não é um monitoramento contínuo da API.

## Desenvolvimento

Node.js 22 ou mais recente, sem dependências npm.

- npm run check: valida manifesto, arquivos, formulário e sintaxe.
- npm test: verifica as integrações, sessão, cancelamento, segurança e estados visuais com respostas simuladas.

Para gerar o pacote no PowerShell: Compress-Archive -Path brave-text-assistant -DestinationPath texto-ia.zip -Force.
