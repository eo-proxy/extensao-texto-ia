# Privacidade — Texto IA / GHS Studio

A extensão usa a chave de API de cada usuário e envia revisões diretamente à OpenAI, Google ou Anthropic, conforme o provedor ativo. A GHS Studio não recebe chaves ou textos em servidor próprio.

## Leitura e envio

O assistente acompanha o campo ativo. Com geração automática ligada, envia o texto do campo, ou o trecho selecionado, e a instrução após uma pausa na digitação. O envio manual ocorre ao pedir uma sugestão. Não coleta o conteúdo completo das páginas nem o histórico de navegação.

Consultar modelos envia a chave ao endpoint de modelos, sem o texto da página. Testar conexão envia apenas uma frase fixa e pode consumir a API.

## Armazenamento

São salvos no perfil local do Brave: chaves e modelos por provedor, provedor ativo, data do teste bem-sucedido e preferências do botão e da revisão. Os textos revisados não são gravados nesse armazenamento pela extensão; permanecem temporariamente na interface e no campo.

Não há sincronização implementada. O acesso é restrito ao service worker e às páginas da extensão. Os valores não recebem criptografia adicional da aplicação; quem tem acesso ao dispositivo ou perfil pode ter acesso aos dados locais.

## Controle

Você pode pausar a geração, desligar a aplicação automática, ocultar o botão e apagar cada chave. Remover a extensão apaga o armazenamento local. Para invalidar a credencial definitivamente, revogue-a no painel do provedor.

A geração automática vem ligada após configurar a API. A aplicação automática, que substitui o texto sem confirmação, vem desligada.

## Provedores

As revisões usam APIs oficiais e podem gerar cobrança na conta correspondente. Tratamento, retenção e limites dependem das condições e configurações do provedor. A extensão não promete que store:false ou a ausência de histórico local eliminem todos os registros mantidos pelo provedor.

O projeto não implementa publicidade, analytics ou rastreamento de uso.

