# Texto IA — GHS Studio

Extensão **0.8.1** para revisar textos com OpenAI (GPT), Google Gemini e Anthropic Claude, usando a chave de API de cada pessoa.

## Correção 0.8.1

Corrige Illegal invocation ao preparar o cache depois da resposta da API. Os temporizadores usam explicitamente o contexto global do navegador. Os testes agora reproduzem a exigência de contexto que o Node não impõe, cobrindo criação, cancelamento e geração nas três integrações. A validação segue local, com respostas simuladas.

## Economia de chamadas e segurança

A versão 0.8.0 usa instruções menores nos três provedores e reaproveita revisões automáticas exatamente iguais por até 60 segundos em memória. Revisar agora, revisão manual e Testar Conexão consultam a API novamente. Modelo, texto completo, limites de saída e pausa de 2,5 segundos foram preservados.

Em teste simulado, dez pedidos automáticos idênticos fizeram uma chamada por provedor. Isso não representa uma redução geral de 90% da conta: textos diferentes continuam gerando novas chamadas. Consulte as [medições e limites](brave-text-assistant/OPTIMIZATION.md).

A revisão orientada pela skill secure-code-guardian conferiu mensagens, chaves, rede, campos e armazenamento. Foram reforçados o cancelamento durante a preparação, a validação antes de compartilhar pedidos e os limites das respostas. O [relatório de segurança](brave-text-assistant/SECURITY.md) registra a validação local e o que ainda depende de testes reais.

## Interface

- Recuperação da revisão automática após inserir emojis pelo teclado do sistema.

- Escolha salva por site: o robô pergunta na primeira visita, e a checkbox Usar IA neste site permite mudar a decisão.
- Sites sem autorização não enviam revisões à API. Apagar ou enviar o texto recolhe a sugestão.

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
