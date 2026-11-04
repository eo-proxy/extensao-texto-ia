# Compatibilidade de navegadores — Texto IA 0.8.1

Contrato do manifesto e testes locais reconferidos em 04/11/2026. A matriz de portabilidade conserva a pesquisa documental de 26/10/2026. A extensão é um pacote Manifest V3 para navegadores de computador baseados em Chromium. Não é um pacote universal para todos os navegadores.

| Navegador | Mesmo pacote | Verificação realizada nesta versão |
| --- | --- | --- |
| Brave | Sim, em versão atual | Contrato de APIs e testes automatizados; uso anterior relatado pelo usuário. A interface desta versão não foi confirmada em sessão real. |
| Google Chrome | Compatibilidade técnica esperada em versão atual | Manifesto e APIs conferidos. Sem teste nativo nesta revisão. |
| Microsoft Edge | Compatibilidade técnica esperada em versão atual | APIs conferidas na documentação da Microsoft. A tentativa com perfil isolado do Edge 156 não produziu uma captura ou resultado verificável, então o funcionamento real não foi confirmado. |
| Vivaldi | Compatibilidade técnica esperada em versão atual | A documentação oficial admite extensões Chromium e instalação de pasta. Sem teste nativo nesta revisão. |
| Opera / Opera GX | Compatibilidade técnica esperada em versão atual | Mesma base Chromium, sujeito ao suporte às APIs da versão instalada. Sem teste nativo nesta revisão. |
| Firefox | Não com este pacote | O manifesto atual depende de background.service_worker; o Firefox usa uma implementação de background diferente. Precisa de adaptação e testes próprios. |
| Safari | Não diretamente | Exige conversão/empacotamento e validação específicos da Apple. Este projeto ainda não inclui esse pacote. |
| Navegadores de celular | Não verificados | Não há suporte móvel declarado nesta distribuição. |

## Requisitos conferidos

- Manifest V3, service worker como módulo e popup local.
- runtime.sendMessage/onMessage, tabs.query/sendMessage e scripting.executeScript.
- tabs.onUpdated/onRemoved descartam cache e chamadas ao navegar/fechar a aba, sem acrescentar a permissão tabs. [Referência Chrome](https://developer.chrome.com/docs/extensions/reference/api/tabs). O cache em RAM pode desaparecer quando o serviço é encerrado; isso não impede uma nova revisão. [Ciclo do serviço](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle).
- storage.local, storage.session e setAccessLevel com TRUSTED_CONTEXTS.
- permissions.contains/request e eventos de permissão.
- Permissões de host opcionais limitadas às três APIs.
- CSP com scripts locais e conexões limitadas aos provedores.
- Nenhuma API exclusiva do Brave, caminho de instalação de navegador ou integração nativa dentro da extensão.
- O mínimo declarado é Chrome/Chromium 102, exigido pelo armazenamento de sessão e controle de acesso. Para uso real, mantenha o navegador atualizado.

A revisão estática e os testes de contrato não substituem testes dentro de cada navegador. Publicação em uma loja também exige atender às regras dela.

## Instalação no computador

Extraia texto-ia.zip. A pasta interna brave-text-assistant mantém o nome histórico para não alterar instalações existentes; esse nome não restringe o navegador.

| Navegador | Página para instalar |
| --- | --- |
| Brave | brave://extensions |
| Chrome | chrome://extensions |
| Edge | edge://extensions |
| Opera | Menu > Extensões |
| Vivaldi | Menu > Ferramentas > Extensões |

Ative Modo do desenvolvedor, escolha Carregar sem compactação / Load unpacked e selecione a pasta que contém manifest.json. Na atualização, recarregue a extensão e as páginas abertas.

## Roteiro para validar em um navegador real

1. Carregar o pacote em um perfil separado, sem importar dados pessoais.
2. Confirmar abertura do popup, abas Revisar texto e Configuração e status inicial Desconectado.
3. Conectar uma API com chave pessoal, autorizar o host e executar Testar Conexão.
4. Conferir indicador e diagnóstico verdes na resposta positiva e vermelhos em uma falha.
5. Digitar em textarea e contenteditable e verificar início após 2,5 segundos de pausa.
6. Voltar a digitar durante uma chamada e confirmar cancelamento e descarte de respostas antigas.
7. Aplicar ou descartar, testar ocultar/mostrar o robô e testar memória de sessão e salvamento opcional.

Testes com conta real podem consumir a API e devem usar apenas conteúdo de exemplo.

## Fontes oficiais

- [Microsoft: portar extensões Chrome](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/port-chrome-extension).
- [Microsoft: APIs de extensões suportadas](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support).
- [Chrome: armazenamento e controle de acesso](https://developer.chrome.com/docs/extensions/reference/api/storage).
- [Mozilla: implementação de background](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background).
- [Apple: empacotar Web Extensions para Safari](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari).
- [Vivaldi: extensões e instalação manual](https://help.vivaldi.com/desktop/appearance-customization/extensions/).
