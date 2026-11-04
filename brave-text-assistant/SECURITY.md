# Revisão de segurança — Texto IA 0.7.0

Revisão do código e testes automatizados locais em 04/11/2026, orientados pela skill secure-code-guardian v1.1.0. A skill fornece um roteiro de análise e implementação; não é um scanner automático. Este documento registra os controles verificados e seus limites.

## Superfícies verificadas

- Mensagens entre a página, scripts isolados, popup e serviço da extensão.
- Leitura e substituição de campos, sugestões retornadas pela IA e restauração por Desfazer.
- Chaves pessoais, persistência opcional, escolhas por site, diagnósticos e pacotes de distribuição.
- Endereços de destino, cabeçalhos, redirecionamentos e política de scripts/conexões do manifesto.

## Controles por site

- Sites novos ficam sem autorização até uma escolha explícita. Sim e Não são gravados separadamente em chrome.storage.local e sobrevivem a reinícios; limpar os dados ou remover a extensão apaga a lista.
- A identidade do site é derivada dos metadados do navegador. Um script não escolhe a origem por parâmetro de mensagem e não consegue alterar decisões de outro site.
- A chave inclui somente a origem HTTP/HTTPS (protocolo, domínio e porta). Não guarda caminhos, parâmetros, títulos ou textos. Credenciais embutidas na URL e outros protocolos são recusados.
- O serviço exige autorização antes de chamar a API e verifica novamente a revisão da escolha antes do envio e após a resposta. Desativar cancela os trabalhos daquele site. Reativar não valida uma resposta antiga.
- A geração manual fica vinculada à aba e à origem onde o texto foi lido. Ler/aplicar pelo popup reconfirma a autorização atual, inclusive no script da página.
- Eventos artificiais não acionam Sim/Não ou a checkbox do robô. As decisões são mantidas quando a conexão com um provedor é encerrada.

## Mensagens e dados privados

- Mensagens de outras extensões são recusadas. Operações de chave, provedor, diagnóstico e conexão exigem o popup da própria extensão.
- Leitura, aplicação e Desfazer via mensagem no script da página também exigem o popup da própria extensão. Scripts de frames e origens inconsistentes são recusados pelo serviço.
- A configuração pública revela apenas os dados necessários ao robô e a escolha do site atual; não revela chaves nem a lista dos demais sites.
- O armazenamento local e o da sessão são restritos a TRUSTED_CONTEXTS. Chaves são temporárias por padrão; a cópia permanente exige Lembrar chave neste dispositivo.
- Chaves lembradas ficam no perfil sem criptografia adicional da aplicação. Quem controla o dispositivo/perfil pode acessar esses dados; a sessão temporária evita a cópia permanente.
- Diagnósticos guardam apenas provedor, modelo, revisão, horário, duração e códigos sanitizados. Não contêm textos, chaves, URLs ou respostas brutas.

## Conteúdo e execução

- Sugestões são inseridas como texto; não há execução de HTML retornado pela IA. O HTML do robô é um template fixo com recursos da própria extensão; rótulos de sites usam textContent.
- Campos de senha, código de acesso, cartão, somente leitura e data-texto-ia-ignore são excluídos. Conteúdo sensível em campos comuns não é reconhecido de forma infalível.
- A aplicação automática exige uma escolha explícita, desligada por padrão. Texto/seleção alterados e campos removidos ou bloqueados impedem aplicação.
- Desfazer mantém somente a última alteração em memória e valida campo, texto e formatação. Edições posteriores invalidam a restauração. Não grava o original em disco nem o reenvia à API.
- Apagar/enviar o conteúdo cancela a revisão e recolhe o painel. A observação de limpeza programática fica limitada ao campo em revisão ou exibido e para quando não é necessária ou a página fica oculta.

## Rede e manifesto

- Há um único ponto de fetch da aplicação, restrito aos três provedores fixos. Chaves seguem em cabeçalhos, nunca em parâmetros de URL. Os pedidos omitem cookies e recusam redirecionamentos.
- A CSP permite scripts locais, bloqueia objetos e restringe conexões aos hosts oficiais configurados. Não permite eval ou scripts remotos.
- Não há externally_connectable, código exposto em web_accessible_resources, execução no mundo MAIN, armazenamento sincronizado, analytics ou backend da GHS Studio.
- As permissões continuam limitadas a activeTab, scripting e storage, com hosts opcionais para as APIs. Os scripts de conteúdo continuam declarados apenas para páginas HTTP/HTTPS.

## Validação e limites

Testes cobrem autorização por site, persistência/reinício, isolamento de origens/abas, corrida ao desativar/reativar, bloqueio antes da rede, mensagens forjadas, entrada HTML, privacidade do diagnóstico, armazenamento, cancelamento, Desfazer e política do manifesto. A conferência de empacotamento compara os arquivos do ZIP com os fontes. O projeto não possui dependências npm de execução.

Não foi realizado teste ponta a ponta com uma conta real de cada provedor ou em todos os navegadores. Editores complexos podem precisar de adaptação. As proteções observadas e os testes locais não constituem garantia de ausência total de vulnerabilidades nem auditoria externa.

As APIs recebem os textos cuja revisão foi autorizada e seguem as próprias políticas de retenção/cobrança. Cancelar uma chamada não garante estorno de processamento já iniciado. Assinatura do aplicativo de conversa e uso da API são serviços distintos.
