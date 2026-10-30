# EDGY — Game Hub

Uma plataforma PWA **mobile-first** para minijogos entre amigos. Interface minimalista, roxo profundo e gradiente magenta.

## Estado atual — EDGY v31

- Quatro jogos ativos: **Xadrez online, Damas online, Jogo do Galo online (com modo local) e Reflexos**.
- Contas, perfis, fotografias, XP, histórico e replays; a área Histórico fica dentro do Perfil.
- Salas privadas, listagem de partidas abertas e convites internos com notificações na aplicação.
- Um **registo comum de jogos e operações multiplayer** em `edgy-platform.js`, que unifica criação/entrada/cancelamento de salas e resultados. O motor e a validação de cada jogo permanecem separados.
- Interface mobile-first, compatível com GitHub Pages e PWA. Os motores de jogos são carregados apenas quando necessários.
- Os jogos antigos Memória e Quiz já não fazem parte da biblioteca (históricos existentes preservados).

**Produção:** https://bpsbeast.github.io/edgy-game-hub/

## Publicar no GitHub Pages

1. No repositório, abre **Settings → Pages**.
2. Em **Build and deployment**, seleciona **Deploy from a branch**.
3. Seleciona **master** e **/(root)** e guarda.
4. Endereço atual: `https://bpsbeast.github.io/edgy-game-hub/`.

## Renomear repositório (opcional)
No GitHub: **Settings → General → Repository name** → `edgy-game-hub`. Esta alteração é independente do código.

## Tecnologia
HTML + CSS + JavaScript sem compilação, Supabase para autenticação, perfis, salas, convites e persistência, e GitHub Pages para alojamento estático. As regras dos jogos continuam a ser validadas no respetivo backend. O PWA utiliza manifest e service worker.

## Estrutura
- `index.html` — estrutura HTML, com dependências carregadas na ordem correta.
- `base.css` — tipografia, estrutura e estilos base.
- `edgy-theme.css` — design system, layouts responsivos, navegação, lobbies e resultados partilhados.
- `app.js` — navegação, biblioteca, perfil local, Jogo do Galo e Reflexos.
- `edgy-platform.js` — registo de jogos, operações multiplayer comuns e modal de resultado.
- `social.js`, `players.js`, `auth.js` — convites, comunidade, contas e autenticação.
- `chess-online.js`, `checkers-online.js`, `checkers-rules.js` — lógica específica dos jogos.
- `history.js` — histórico e visualização de partidas.
- `manifest.webmanifest`, `icon.svg`, `sw.js` — instalação e cache PWA.
- `tests/smoke.test.mjs` — testes sem dependências (`node --test tests/smoke.test.mjs`).
- `.github/workflows/edgy-validation.yml` — validações automáticas nos commits.

## Desenvolvimento local
Executa um servidor HTTP na pasta do projeto (`python -m http.server 8080`), depois abre `http://localhost:8080`. Não uses `file://` para testar a PWA.

## Segurança / privacidade
O GitHub Pages é público. Não colocar passwords, chaves secretas, tokens de serviço ou dados privados no repositório. A instalação no ecrã inicial depende do navegador e do HTTPS (fornecido pelo Pages).

---
Desenvolvido para diversão entre amigos.

## Ativar contas (Supabase)

1. Cria um projeto Supabase gratuito.
2. Em **SQL Editor**, executa `supabase/setup.sql` após rever as políticas.
3. Em **Authentication**, ativa o fornecedor **Email** e **Anonymous Sign-ins**. Decide se queres exigir confirmação de email.
4. Em **Authentication → URL Configuration**, define a Site URL `https://bpsbeast.github.io/edgy-game-hub/` e inclui-a na lista de URLs de redirecionamento permitidas.
5. Preenche `config.js` com **Project URL** e a chave **anon/publishable** do projeto. São dados públicos; não colocar a chave `service_role` ou qualquer secret no GitHub.
6. Recarrega a aplicação. Se a PWA ainda mostrar a versão anterior, fecha e reabre ou limpa a cache desse site.

Até haver configuração, a EDGY continua em modo local. O login, sincronização e upload de fotos requerem Supabase ativo. O servidor não valida resultados de jogos nesta versão, portanto XP e rankings não são resistentes a manipulações. Não usar este esquema para competições com prémios.

## Testar a autenticação

- Abre a EDGY em modo privado/anónimo do navegador, escolhe **Jogar como convidado** e introduz um nickname. Confirma o novo perfil em Authentication → Users no Supabase.
- Para registar uma conta nova, escolhe **Criar conta**, introduz nickname, email e uma password com pelo menos 8 caracteres, letras e números. Confirma no email e depois faz login.
- Para converter um convidado, usa **Criar conta / Entrar** no perfil: primeiro confirma o email, depois volta ao mesmo navegador/dispositivo e define a password para preservar o perfil.
- O envio de emails de confirmação está sujeito aos limites do serviço de email configurado no Supabase.

A aplicação pública é uma versão experimental para amigos; ainda não há multiplayer online nem proteção anti-fraude das pontuações.

## EDGY v9 — usernames e xadrez online

- Cada perfil tem `display_name` (nome visível, pode repetir-se), `username` (único entre todas as contas, 3 a 20 caracteres, apenas a-z, números e _) e `id` interno UUID.
- O email é único por conta segundo as regras do Supabase Auth; não colocar consultas de existência de email no cliente.
- O campo `@username` pode ser alterado na página Perfil. O Supabase impede duplicados, mesmo com maiúsculas/minúsculas.
- A biblioteca inclui **Xadrez online**: criar sala privada, partilhar código/link, entrar com outra conta ou convidado, jogar por turnos (brancas e pretas) em dispositivos diferentes.
- Motor de regras `chess.js@1.4.0`, com xeque-mate, afogamento, roque, en passant, promoção e empates.
- A verificação das jogadas é feita na Supabase Edge Function `chess-move`. O cliente não tem permissão para atualizar diretamente o estado da partida.
- Quando termina uma partida, o servidor regista duas entradas no histórico (uma por jogador) e atribui XP: vitória 50, empate 20, derrota 10.
- A sincronização utiliza Realtime Postgres Changes, com consulta periódica de contingência. O código da sala concede acesso somente a dois utilizadores autenticados, incluindo contas anónimas.
- O código do jogo está em `chess-online.js`; a função de validação está em `supabase/functions/chess-move/index.ts`.

### Teste rápido com duas sessões
1. Abre a EDGY num dispositivo e inicia sessão.
2. Abre *Xadrez online* → *Criar sala*, copia o link.
3. Abre o link noutro telemóvel/navegador com outra conta ou convidado.
4. Confirma que os nomes aparecem, que as brancas começam e que os dois tabuleiros sincronizam cada movimento.
5. Termina uma partida, depois consulta o histórico e o XP.

**Nota:** a experiência com dois browsers reais ainda deve ser validada pelo utilizador. O serviço de xadrez precisa de Internet; os minijogos locais continuam a funcionar separadamente.

## EDGY v17 — Damas online + material no xadrez

- A biblioteca inclui agora **Damas online** com tabuleiro 8×8 roxo/lavanda e peças rosa/plum; convites por código e URL `?checkers=XXXXXXXX`.
- Variante escolhida: **damas brasileiras 8×8**, com 12 peças por lado; peça normal move-se e captura apenas na diagonal para a frente (variante EDGY personalizada, não o regulamento oficial francês).
- Captura obrigatória, sequência com o **maior número de capturas**, múltiplas capturas, dama voadora e promoção quando a peça termina um movimento na última fila.
- A validação autoritativa das jogadas acontece em `supabase/functions/checkers-action/index.ts`, utilizando o mesmo motor de regras que a interface (`checkers-rules.js`). Os jogadores não têm permissão de atualizar diretamente `checkers_rooms`.
- O resultado das damas é guardado no histórico e atribui XP pelo servidor: vitória 40, empate 15, derrota 5.
- O xadrez apresenta peças capturadas junto de cada jogador e respetiva vantagem de material (peão 1, cavalo 3, bispo 3, torre 5, rainha 9).
- O PWA atualiza para `edgy-v17` e inclui os assets das damas.

**Testes executados:** motor de regras (abertura, capturas obrigatórias, maior número de peças, captura apenas para a frente pelas peças normais, dama voadora, promoção), SQL (criar/entrar na sala, tabuleiro inicial, resultado/XP, rollback), permissões (o cliente não pode escrever no tabuleiro) e sintaxe JavaScript. **A sincronização em dois dispositivos reais ainda precisa de validação manual.**


## EDGY v19 — Damas: captura para a frente e interface

- Peças normais capturam **apenas para a frente**; damas promovidas capturam em ambas as direções, com alcance longo. Mantêm-se a captura obrigatória, a maior captura e as sequências de captura.
- Regra personalizada EDGY 8×8: não corresponde integralmente às damas oficiais francesas/internacionais.
- Modal próprio de desistência e animações de seleção, deslocação após confirmação do servidor, captura e promoção. Respeita movimentos reduzidos.
- Client e Edge Function usam a mesma versão de `checkers-rules.js`; o servidor valida os lances antes de os guardar.

## EDGY v23 — comunidade, salas e convites internos

- Biblioteca visual simplificada: **Xadrez, Damas, Jogo do Galo e Reflexos**. Memória e Quiz foram removidos da navegação e do catálogo, sem apagar os históricos anteriores.
- Ícones brancos e minimalistas para Damas e Reflexos.
- Novo `edgy-theme.css`: painéis e botões retangulares, cores EDGY e rosa reservado a pequenos destaques.
- Nova página **Salas**: combina Xadrez/Damas, nomes dos dois jogadores, estados e ações Retomar/Rever/Convidar/Fechar. O endpoint SQL `edgy_my_rooms` devolve apenas salas onde o utilizador participa.
- Novo `social.js`: sino com contagem de convites, pesquisa de jogadores públicos, aceitar/recusar convites sem links. Os convites são verificados em intervalos de 15 segundos enquanto a app está aberta.
- Os perfis públicos podem iniciar um convite direto a uma nova sala de Xadrez (10+0) ou Damas; convites tradicionais por URL continuam disponíveis.
- Migração `edgy_private_game_invitations_and_combined_room_directory`: tabela `public.edgy_game_invites` com RLS de participantes; sem INSERT/UPDATE direto para o cliente. As operações privilegiadas usam RPCs com `auth.uid()`, confirmação de propriedade da sala e destinatário autorizado.
- Testes SQL transacionais (rollback): criação de sala, envio, receção, aceitação, entrada como segundo jogador, nomes na lista e bloqueio de convites para sala ocupada, em ambos os jogos. Testes de sintaxe JavaScript e consistência dos assets da PWA efetuados. **O visual mobile e a receção de convites em dispositivos reais precisam de teste manual.**

## EDGY v24 — navegação mobile e salas abertas

- No telemóvel, cinco separadores: **Jogos · Jogadores · Início · Salas · Perfil**. Início em destaque no centro; Histórico acessível a partir do Perfil. No desktop, Histórico permanece na barra lateral.
- O sino de convites passou para junto da fotografia no cabeçalho, com indicador de convites pendentes.
- Botões mobile com feedback de toque, animação de seleção, indicador da página ativa e respeito pela opção do sistema de movimento reduzido.
- A página Salas e o resumo do Início mostram apenas salas à espera ou em curso. O Início apresenta até 3 salas, com ligação Ver todas.
- A função SQL edgy_my_rooms(integer) foi atualizada para filtrar partidas terminadas. Estas continuam disponíveis no histórico de partidas.
- Testes: sintaxe JavaScript, sequência dos botões mobile, versão dos assets da PWA e transações SQL revertidas com partidas concluídas e salas de espera.

## EDGY v25 — perfis e desafios

- Perfil público atualizado com cartões de estatísticas retangulares, cabeçalho compacto, atividade recente legível e secções separadas visualmente.
- Perfil pessoal passa a partilhar as mesmas superfícies e controlos planos.
- Em vez dos dois botões separados, cada perfil público apresenta **Desafiar jogador**, que abre um seletor pesquisável de jogos multiplayer. Os jogos compatíveis são definidos num registo central em `social.js`, preparado para futuros jogos com backend online.
- A barra inferior mantém-se com cinco opções e Início ao centro; o ícone central agora é uma casa branca visível dentro de um botão circular, com feedback de toque.
- O sino e a fotografia no topo mantêm o posicionamento aprovado da v24.
- Testes de sintaxe JavaScript, referências da PWA, navegação, modal de desafio e CSS responsive/reduced-motion concluídos; falta teste visual real em dispositivo.

## EDGY v26 — perfis mais compactos e desafios animados

- As estatísticas de jogador foram reorganizadas na ordem **Nível · XP · Partidas** junto do nome, antes da descrição, tanto no perfil público como no perfil pessoal. A área Os teus números, redundante com o resumo do Início, foi removida do perfil pessoal.
- A secção Confrontos contigo apresenta um resumo **Vitórias · Empates · Derrotas** e pode ser expandida para consultar as últimas partidas. Por enquanto estes confrontos diretos referem-se ao Xadrez.
- A introdução da página Jogadores deixou de conter a frase sobre o email.
- O seletor de jogos para desafiar inclui entrada animada, realce de escolha, indicador de preparação da sala e bloqueio contra solicitações duplicadas; respeita preferências de movimento reduzido.
- A barra inferior mobile e o sino de notificações mantiveram o layout da versão anterior.
- JavaScript, referências de cache PWA e principais estados da UI verificados estaticamente. A experiência visual em dispositivos reais ainda deve ser validada.


## EDGY v29 — consolidação e auditoria

- **UI:** removido Histórico do menu do computador (continua acessível no Perfil); botão central mobile redesenhado com o símbolo geométrico EDGY; ecrãs de entrada e criação de salas unificados; Xadrez e Damas usam o mesmo modal de resultado, acessível via teclado e com três estados.
- **Arquitetura:** `edgy-platform.js` define um catálogo de jogos e partilha funções de criar, entrar, carregar e fechar salas, convidar jogadores, responder a convites e mostrar o resultado. Esta camada pode ser reutilizada por futuros jogos online, sem forçar um único formato de tabuleiro ou regras.
- **Manutenção e desempenho:** `index.html` passou a ser uma página de entrada com poucos KB, o CSS e JavaScript foram separados, a folha de estilos é carregada no `head`, código de Memória/Quiz foi removido, consultas obsoletas a salas foram eliminadas e os motores são carregados sob demanda.
- **Validação:** testes estáticos de sintaxe, referências de ficheiros, navegação, estilos, regras das Damas, operações de sala e componentes de resultado; fluxos SQL de criar → convidar → aceitar → entrar nos dois jogos validados em transação com `ROLLBACK`. Foi adicionada integração contínua no GitHub Actions.
- **Limites dos testes:** não existe nesta revisão um teste automatizado de interação visual em dois telemóveis reais nem confirmação aqui do estado de execução do GitHub Actions. A publicação no GitHub Pages e a atualização offline devem ser validadas em dispositivo.

## EDGY v31 — revisão multiplayer e interface

**Funcionalidades entregues**
- Jogo do Galo online com salas privadas, entrada por código, convites internos, turno controlado pelo servidor, deteção de vitória/empate, desistência, histórico de movimentos e replays de partidas terminadas.
- Jogo do Galo local preservado (contra CPU e duas pessoas no mesmo dispositivo).
- Histórico de confrontos entre jogadores agora inclui Xadrez, Damas e Jogo do Galo, com partidas selecionáveis. Replays de Xadrez abrem no Histórico; Damas e Jogo do Galo reabrem a partida com movimentos anteriores.
- Perfil público com animação de entrada em desktop/mobile e proteção contra respostas assíncronas desatualizadas.
- Xadrez mobile: painel de opções e jogadas com acesso melhorado, scroll interno e botões maiores.
- Damas: remoção do botão manual Atualizar; sincronização automática mantida.
- Rodapé fixado ao fundo visual em ecrãs curtos; em ecrãs longos aparece depois do conteúdo, sem se sobrepor aos tabuleiros.
- Metadados dos jogos passam a ter uma única fonte em `edgy-platform.js`. A Biblioteca, filtros, salas e desafios consultam o registo partilhado.
- Novo componente `confirmAction` para avisos consistentes entre jogos. O Jogo do Galo já o usa.

**Segurança e dados**
- Migrações: `supabase/tic_multiplayer.sql`, `tic_shared_invites.sql`, `head_to_head_all_games.sql` e `performance_indexes.sql`.
- O Jogo do Galo tem RLS com leitura apenas pelos participantes e funções privilegiadas no esquema `private`; as RPC públicas são `security invoker`.
- Testes transacionais com ROLLBACK: convite, aceitação, turnos, rejeição de jogadas inválidas, terceiro não autorizado, vitória, empate, desistência, confronto direto e permissões da role `authenticated`.
- O Supabase continua a sinalizar funções `SECURITY DEFINER` antigas em `public` (Xadrez/Damas/convites). Devem ser revistas e migradas de forma incremental antes de uma abertura em grande escala.
- A atribuição de XP nos jogos online ainda não está totalmente consolidada no servidor. Não implementar créditos de XP controlados só pelo cliente.

**Verificação adicional recomendada**
- Dois dispositivos reais, com contas diferentes, para confirmar notificações, replays, estados de rede e UI móvel.
- Rever a execução de `tests/smoke.test.mjs` nas Actions antes de novos lançamentos.
- Após verificar estes fluxos, migrar funções privilegiadas antigas de forma testada, sem afetar partidas existentes.


## EDGY v32 — experiência mobile, perfis e verificações

- **Perfis públicos:** botão `Rever partida` para cada confronto concluído; replays do Xadrez no Histórico, Damas e Jogo do Galo através da partida original. Animações de abertura e fecho com `prefers-reduced-motion`, foco restaurado ao fechar e sobreposição corrigida acima do painel do Xadrez.
- **Xadrez mobile:** os controlos de partida e as jogadas/confrontos estão separados em duas áreas de painel utilizáveis e com scroll; o separador de promoção abre automaticamente quando necessário. A folha aparece acima da navegação inferior.
- **Damas:** botão manual de atualização removido; sincronização por Realtime com polling de contingência.
- **Jogo do Galo online:** nomes dos participantes obtidos por RPC que verifica se o utilizador pertence à sala, eventos Realtime, validação de turnos no servidor, convites partilhados, XP e histórico guardados exatamente uma vez. Replays duplicados são reconciliados pelo ID da sala.
- **Layout:** `footer` ancorado à zona inferior quando há pouco conteúdo; quando a página é longa acompanha o final do conteúdo.
- **Testes:** 15 testes automáticos definidos, verificações estáticas de sintaxe, cache e navegação, e testes transacionais no Supabase (convites, turnos, vitória, desistência, XP e acesso autorizado). Os testes de base de dados foram revertidos sem deixar partidas fictícias.
- **Auditoria pendente:** o Supabase sinaliza 19 funções públicas `SECURITY DEFINER` antigas acessíveis ao role `authenticated`; devem ser revistas/migradas com segurança antes de abrir a aplicação a um público maior. Os avisos sobre acesso anónimo requerem avaliação tendo em conta o modo convidado; a proteção contra passwords divulgadas não está ativa. Quatro índices ainda não apresentam utilização significativa.

**Adicionar um jogo novo:** definir uma entrada em `edgy-platform.js`, criar tabelas e operações autenticadas e validadas no servidor, associar as operações de sala e convites existentes e criar apenas a interface/regras específicas. Não duplicar a gestão de contas, convites ou o modal de resultado.


## EDGY v34 — consistência e controlos mobile

- Jogo do Galo: ecrã de entrada uniformizado com Xadrez/Damas (cabeçalho, cartões de criar/entrar, campos e botões); secção **As tuas salas** usa `EDGY_social.renderRooms` para não duplicar a lógica de listagem. O modo local mantém-se disponível.
- Xadrez no telemóvel: botões de **Partida e opções** e **Jogadas e confrontos** passam para a zona superior, no fluxo normal da página, evitando sobrepor os controlos de revisão das jogadas. O painel de ações continua a abrir por separador e o tabuleiro permanece navegável com scroll.
- Ajustados cabeçalho mobile e dimensão/área tocável dos controlos de histórico; removido posicionamento fixo obsoleto da barra do Xadrez.
- PWA atualizada para a cache `edgy-v34`; acrescidos dois testes de regressão ao conjunto de verificações, agora com 20 testes definidos.
- Falta confirmar manualmente no iPhone e em dois dispositivos os fluxos reais de navegação e jogo depois da publicação.
