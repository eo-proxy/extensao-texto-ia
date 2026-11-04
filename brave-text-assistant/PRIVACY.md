# Privacidade — Texto IA / GHS Studio

A extensão usa a chave da pessoa e envia a revisão diretamente à API escolhida: OpenAI, Google Gemini ou Anthropic. A GHS Studio não recebe chaves ou textos em servidor próprio.

## Chaves: você decide se quer lembrar

Lembrar chave neste dispositivo vem desligado. Nesse modo, os dados de conexão ficam apenas em chrome.storage.session, na memória do navegador. Eles continuam disponíveis ao fechar e reabrir o popup, mas são descartados ao trocar de IA ou encerrar o Brave.

Marcar a opção e ativar a configuração permite guardar chave, modelo e modo da revisão no perfil local do Brave. Desmarcar remove a cópia permanente imediatamente, mantendo apenas a conexão ativa na sessão. Remover a extensão apaga o armazenamento da extensão. Revogue a chave também no provedor para invalidá-la definitivamente.

As configurações antigas que eram salvas automaticamente são removidas do armazenamento permanente na atualização. A conexão ativa pode continuar na memória até uma troca de provedor ou encerramento do navegador.

O acesso ao armazenamento local e de sessão é restrito às páginas da extensão e ao service worker. Chaves lembradas não recebem criptografia adicional da aplicação. Quem tem acesso ao dispositivo/perfil pode acessar os dados locais.

## Escolhas por site

A extensão pergunta antes de ativar a revisão em cada origem de site. A escolha fica no armazenamento local da extensão, restrito a TRUSTED_CONTEXTS, até ser alterada ou até limpar/remover a extensão. São guardados apenas protocolo, domínio/porta, ativado/desativado e um identificador de revisão; caminhos, parâmetros, títulos de páginas e textos não fazem parte desse registro. A lista não é sincronizada ou enviada a servidores.

Sites sem decisão ou desativados não permitem leitura para revisão, aplicação de novas sugestões ou geração na API. Desfazer uma alteração anterior continua sendo uma ação local e explícita. O robô continua acessível para mudar a escolha. O cancelamento não reverte processamento que o provedor já tenha iniciado.

## Texto enviado

Em um site autorizado e com revisão automática ligada, após 2,5 segundos sem digitar o campo ativo ou trecho selecionado e a instrução são enviados ao provedor ativo. O prazo é o início da chamada, não uma garantia do tempo de resposta. Retomar a digitação cancela a chamada e descarta a sugestão anterior.

A geração automática vem ligada depois da configuração. Aplicar sem confirmação vem desligado. Você pode pausar as revisões ou ocultar o robô. Campos de senha, códigos de acesso e cartão identificados por autocomplete são excluídos, assim como elementos marcados data-texto-ia-ignore. Informações sensíveis em campos comuns não são reconhecidas de forma infalível.

Não coleta o conteúdo completo das páginas ou o histórico de navegação. As revisões não são armazenadas no disco pela extensão; permanecem temporariamente na interface/campo e na memória temporária descrita abaixo.

## Reaproveitamento temporário

Revisões concluídas podem ficar na memória do serviço da extensão por até 60 segundos, sem prolongar esse prazo quando usadas. O cache mantém a sugestão e um identificador SHA-256 da combinação exata de texto, instrução, modelo e configuração; o texto original e a chave não são gravados nesse cache. O identificador não é uma forma de anonimização nem é enviado a servidores.

O limite é de quatro sugestões por escopo (aba, frame e origem) e 32 no total, com até 32.000 caracteres por sugestão. Não usa disco, chrome.storage, sincronização ou backend. Reiniciar/encerrar o serviço descarta esse cache, possivelmente antes dos 60 segundos.

Navegar/fechar a aba, mudar o site/provedor/configuração ou revogar uma permissão limpa os resultados afetados. Toda reutilização reconfirma a escolha do site e a configuração/permissão atuais. Revisões automáticas idênticas em andamento podem compartilhar uma única chamada; cancelar um desses pedidos cancela o trabalho compartilhado. Revisão manual e Testar Conexão fazem nova consulta.

## Desfazer

Para permitir Desfazer sugestão, a última versão anterior à aplicação fica temporariamente na memória do script daquela página, incluindo os nós originais de editores ricos. Não é enviada ao provedor durante a restauração nem gravada em disco. Uma nova aplicação substitui esse registro; uma edição posterior o invalida. Recarregar ou fechar a página descarta o registro.

## Modelos, teste e diagnóstico

Consultar modelos envia a chave ao endpoint oficial da conta e filtra modelos de texto. Listar não comprova saldo, cota ou acesso de geração. Testar Conexão usa uma frase fixa e pode ter cobrança.

O diagnóstico da sessão contém apenas provedor, modelo, horário, duração, código sanitizado, HTTP status e identificador aleatório da configuração. Não contém chaves, prompts, respostas, URL da página ou o erro bruto. Quando a API fornece contagens válidas, inclui também números de tokens de entrada, saída, total, cache e raciocínio disponíveis. Campos desconhecidos permanecem ausentes ou nulos; não são estimativas de preço. O registro desaparece ao encerrar a sessão.

## Provedor e cobrança

A conta do provedor é responsável pelas cotas, pelo faturamento e pela retenção dos dados processados. A extensão não promete que store:false elimine todos os registros do provedor. Cancelar uma chamada não garante a reversão de processamento ou cobrança já iniciados.

Não há publicidade, analytics, sincronização ou rastreamento de uso implementados.
