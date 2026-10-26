# Revisão de segurança — Texto IA 0.6.2

Revisão do código e testes locais em 26/10/2026. Este documento descreve as proteções verificadas e seus limites; não representa uma garantia de ausência de vulnerabilidades nem uma auditoria externa.

## Credenciais e privacidade

- Lembrar chave neste dispositivo começa desligado. A conexão temporária usa chrome.storage.session, em memória, restrito a TRUSTED_CONTEXTS.
- Trocar de provedor descarta a conexão temporária anterior. Encerrar o Brave encerra a sessão. Reabrir apenas o popup ou reiniciar o service worker preserva a conexão da sessão.
- A persistência em chrome.storage.local exige rememberCredentials=true. Desmarcar a opção remove a cópia local imediatamente e preserva só a sessão ativa.
- A atualização move a conexão ativa antiga sem consentimento para memória e remove as credenciais antigas do disco. Perfis explicitamente lembrados são preservados.
- Não há chave da GHS Studio, backend intermediário, analytics ou dependência npm de execução.
- Diagnósticos guardam apenas provedor, modelo, horário, duração, código sanitizado, status HTTP e identificador aleatório da configuração, na sessão. Não guardam chave, texto, resposta, URL visitada ou corpo bruto de erro.

## Fronteiras de confiança

- Consultar/alterar/apagar credenciais, trocar provedor e testar modelos exigem mensagem originada da página sidepanel.html da própria extensão.
- Scripts dos sites recebem só o estado e as preferências públicas. Não recebem perfis com chaves.
- O widget opera em Shadow DOM fechado; conteúdo da página não é usado como instrução privilegiada.
- Chamadas só vão aos três hosts fixos dos provedores, com HTTPS, sem cookies e sem seguir redirecionamentos.
- A CSP permite scripts locais e conexão apenas às APIs declaradas. Recursos públicos se limitam à marca e ao ícone.

## Leitura e aplicação

- Senhas, campos com autocomplete de código de acesso, senha ou cartão, campos desabilitados/somente leitura e elementos marcados com data-texto-ia-ignore são excluídos.
- Seleções de contenteditable precisam estar contidas no editor de origem.
- Texto alterado, seleção inválida, resposta incompleta, recusa ou troca de conexão impede aplicação.
- Retomar a digitação cancela a chamada e invalida respostas antigas, inclusive quando o servidor não respeita o cancelamento.
- Sugestões são inseridas como texto. Não há execução de HTML, scripts ou comandos retornados pela IA.
- A aplicação sem confirmação exige opção explícita e começa desligada.

## Proteção operacional

- Até 4.000 caracteres por texto e 1.500 na instrução.
- Uma chamada por contexto; nova revisão cancela a anterior.
- Espera limitada a 25 segundos na chamada à API e 30 segundos no widget, evitando bloqueio indefinido.
- Respeita a pausa informada por rate limits e sobrecarga. Não há repetição silenciosa de geração nem troca automática de modelo.
- Testes usam credenciais fictícias e respostas simuladas. Há testes específicos de cancelamento, sessão, persistência, fronteiras de mensagem, seleções e marcação maliciosa.

## Limites

O processamento pelo provedor e a retenção na conta dele seguem suas próprias condições. Uma chave explicitamente lembrada fica no perfil do Brave sem criptografia adicional da aplicação; alguém com acesso ao perfil/dispositivo pode acessá-la. Uma chave temporária continua existindo na memória enquanto a sessão está ativa. Dados sensíveis escritos em campos comuns não podem ser identificados de forma infalível: o usuário deve pausar a revisão nesses casos. Cancelar a requisição não garante que o provedor deixe de contabilizar processamento já iniciado.

Antes de distribuir publicamente por loja, revise as exigências de publicação e os termos dos provedores. Uma credencial compartilhada da empresa exigiria outro desenho, com proteção no servidor.



