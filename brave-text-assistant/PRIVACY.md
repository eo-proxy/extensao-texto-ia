# Privacidade — Texto IA / GHS Studio

A extensão usa a chave da pessoa e envia a revisão diretamente à API escolhida: OpenAI, Google Gemini ou Anthropic. A GHS Studio não recebe chaves ou textos em servidor próprio.

## Chaves: você decide se quer lembrar

Lembrar chave neste dispositivo vem desligado. Nesse modo, os dados de conexão ficam apenas em chrome.storage.session, na memória do navegador. Eles continuam disponíveis ao fechar e reabrir o popup, mas são descartados ao trocar de IA ou encerrar o Brave.

Marcar a opção e ativar a configuração permite guardar chave, modelo e modo da revisão no perfil local do Brave. Desmarcar remove a cópia permanente imediatamente, mantendo apenas a conexão ativa na sessão. Remover a extensão apaga o armazenamento da extensão. Revogue a chave também no provedor para invalidá-la definitivamente.

As configurações antigas que eram salvas automaticamente são removidas do armazenamento permanente na atualização. A conexão ativa pode continuar na memória até uma troca de provedor ou encerramento do navegador.

O acesso ao armazenamento local e de sessão é restrito às páginas da extensão e ao service worker. Chaves lembradas não recebem criptografia adicional da aplicação. Quem tem acesso ao dispositivo/perfil pode acessar os dados locais.

## Texto enviado

Com revisão automática ligada, após 2,5 segundos sem digitar o campo ativo ou trecho selecionado e a instrução são enviados ao provedor ativo. O prazo é o início da chamada, não uma garantia do tempo de resposta. Retomar a digitação cancela a chamada e descarta a sugestão anterior.

A geração automática vem ligada depois da configuração. Aplicar sem confirmação vem desligado. Você pode pausar as revisões ou ocultar o robô. Campos de senha, códigos de acesso e cartão identificados por autocomplete são excluídos, assim como elementos marcados data-texto-ia-ignore. Informações sensíveis em campos comuns não são reconhecidas de forma infalível.

Não coleta o conteúdo completo das páginas ou o histórico de navegação. As revisões não são armazenadas no disco pela extensão; permanecem temporariamente na interface/campo e na memória da chamada.

## Modelos, teste e diagnóstico

Consultar modelos envia a chave ao endpoint oficial da conta e filtra modelos de texto. Listar não comprova saldo, cota ou acesso de geração. Testar modelo usa uma frase fixa e pode ter cobrança.

O diagnóstico da sessão contém apenas provedor, modelo, horário, duração, código sanitizado e HTTP status. Não contém chaves, prompts, respostas, URL da página ou o erro bruto. Ele desaparece ao encerrar a sessão.

## Provedor e cobrança

A conta do provedor é responsável pelas cotas, pelo faturamento e pela retenção dos dados processados. A extensão não promete que store:false elimine todos os registros do provedor. Cancelar uma chamada não garante a reversão de processamento ou cobrança já iniciados.

Não há publicidade, analytics, sincronização ou rastreamento de uso implementados.

