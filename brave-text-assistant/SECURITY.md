# Revisão de segurança — Texto IA 0.8.0

Revisão do código e testes automatizados locais em 04/11/2026, orientados pela skill secure-code-guardian v1.1.0. A skill fornece um roteiro de análise e implementação; não é um scanner automático. Este documento registra os controles verificados e seus limites.

## Resultado desta etapa

A inspeção e os testes locais não identificaram envio de chaves/textos para destinos adicionais aos três provedores configurados. Isso descreve o código e os cenários exercitados; não comprova ausência total de vazamentos em qualquer ambiente.

Foram corrigidos/reforçados:

- Registro do trabalho antes de aguardar permissão/hash, permitindo cancelamento durante a preparação sem iniciar a API.
- Verificação de aba, frame e origem antes de compartilhar uma revisão em andamento; a confirmação após a resposta continua obrigatória.
- Limite de 32.000 caracteres da sugestão e descarte de blocos de resposta que não são texto.
- Cache temporário com limite de volume, prazo fixo, separação por contexto e descarte ao navegar, fechar aba, alterar configuração/site ou revogar acesso.
- Falhas de gravação do diagnóstico não descartam uma revisão válida já recebida, evitando forçar outra chamada.
- Contagens de consumo extraídas por lista de campos numéricos; nenhum objeto bruto do provedor é persistido.

## Modelo de ameaças

A fronteira principal separa os sites visitados do popup/serviço que detêm as chaves. Foram considerados mensagens com origem forjada, compartilhamento entre abas/sites, resposta maliciosa da API, texto desatualizado, gravação involuntária de dados e chamadas duplicadas cobradas. As políticas de entrada, saída, autorização e rede abaixo limitam essas superfícies.

O modelo pode ignorar instruções de revisão; o prompt não é uma barreira de segurança suficiente. Não recebe ferramentas e a saída é aplicada como texto. Aplicação automática segue opcional e desligada por padrão. Um site autorizado já pode ler seu próprio campo; a extensão não protege esse conteúdo do próprio site ou de quem controla o perfil/dispositivo.

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
- Diagnósticos guardam apenas provedor, modelo, revisão, horário, duração e códigos sanitizados. Podem incluir contagens numéricas de tokens validadas, sem textos, chaves, URLs ou respostas brutas.

## Conteúdo e execução

- Sugestões são inseridas como texto; não há execução de HTML retornado pela IA. O HTML do robô é um template fixo com recursos da própria extensão; rótulos de sites usam textContent.
- Campos de senha, código de acesso, cartão, somente leitura e data-texto-ia-ignore são excluídos. Conteúdo sensível em campos comuns não é reconhecido de forma infalível.
- A aplicação automática exige uma escolha explícita, desligada por padrão. Texto/seleção alterados e campos removidos ou bloqueados impedem aplicação.
- Desfazer mantém somente a última alteração em memória e valida campo, texto e formatação. Edições posteriores invalidam a restauração. Não grava o original em disco nem o reenvia à API.
- Apagar/enviar o conteúdo cancela a revisão e recolhe o painel. A observação de limpeza programática fica limitada ao campo em revisão ou exibido e para quando não é necessária ou a página fica oculta.

## Cache e consumo

O cache guarda somente resultados concluídos e identificadores SHA-256 em RAM, por até 60 segundos sem renovar o prazo na leitura. Não grava texto original/chave, não usa armazenamento persistente e não compartilha entre abas/origens/configurações. O hash não anonimiza o conteúdo; sua função é comparar pedidos. Há no máximo quatro resultados por escopo e 32 globais. O serviço pode encerrar antes do prazo e descartar tudo.

A autorização/permissão e a revisão da configuração são verificadas inclusive para resultados em cache. Falhas, recusas e respostas incompletas não entram. Alterar texto/instrução/modelo/chave/modo/site produz uma chave distinta; alterações de configuração, escolhas por site e navegação descartam resultados. Chamadas manuais e testes não reutilizam resultados. Cancelar uma chamada compartilhada invalida todos os seus participantes.

## Rede e manifesto

- Há um único ponto de fetch da aplicação, restrito aos três provedores fixos. Chaves seguem em cabeçalhos, nunca em parâmetros de URL. Os pedidos omitem cookies e recusam redirecionamentos.
- A CSP permite scripts locais, bloqueia objetos e restringe conexões aos hosts oficiais configurados. Não permite eval ou scripts remotos.
- Não há externally_connectable, código exposto em web_accessible_resources, execução no mundo MAIN, armazenamento sincronizado, analytics ou backend da GHS Studio.
- As permissões continuam limitadas a activeTab, scripting e storage, com hosts opcionais para as APIs. Os scripts de conteúdo continuam declarados apenas para páginas HTTP/HTTPS.

## Validação e limites

147 testes automatizados passaram nesta revisão. Cobrem limites/expiração/descarte do cache, deduplicação nos três provedores, métricas numéricas, cancelamento durante a preparação e após navegação, falha do diagnóstico, além de autorização por site, persistência/reinício, isolamento de origens/abas, corrida ao desativar/reativar, bloqueio antes da rede, mensagens forjadas, entrada HTML, privacidade do diagnóstico, armazenamento, cancelamento, Desfazer e política do manifesto. A conferência de empacotamento compara os arquivos do ZIP com os fontes. O projeto não possui dependências npm de execução.

Não foi realizado teste ponta a ponta com uma conta real de cada provedor ou em todos os navegadores. Editores complexos podem precisar de adaptação. As proteções observadas e os testes locais não constituem garantia de ausência total de vulnerabilidades nem auditoria externa.

As APIs recebem os textos cuja revisão foi autorizada e seguem as próprias políticas de retenção/cobrança. Cancelar uma chamada não garante estorno de processamento já iniciado. Assinatura do aplicativo de conversa e uso da API são serviços distintos.
