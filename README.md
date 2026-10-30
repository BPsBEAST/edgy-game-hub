# EDGY — Game Hub

Uma plataforma PWA **mobile-first** para minijogos entre amigos. Interface minimalista, roxo profundo e gradiente magenta.

## Primeira versão
- Homepage, biblioteca, perfil de convidado e histórico local
- Jogo do Galo (contra computador ou no mesmo dispositivo)
- Memória, Quiz e teste de reflexos
- Pontos XP e recordes guardados no navegador
- Instalação no telemóvel (PWA) e funcionamento offline após a primeira visita

> **Nota:** esta primeira versão não tem contas reais nem partidas online. Os dados são locais ao dispositivo. Autenticação e salas multiplayer serão acrescentadas com Supabase quando for configurado. Não confundir um perfil de convidado com uma conta online.

## Publicar no GitHub Pages

1. No repositório, abre **Settings → Pages**.
2. Em **Build and deployment**, seleciona **Deploy from a branch**.
3. Seleciona **master** e **/(root)** e guarda.
4. Depois da publicação, o endereço será `https://BPsBEAST.github.io/BPs/` (ou `https://BPsBEAST.github.io/edgy-game-hub/` se renomeares o repositório).

## Renomear repositório (opcional)
No GitHub: **Settings → General → Repository name** → `edgy-game-hub`. Esta alteração é independente do código.

## Tecnologia
HTML + CSS + JavaScript (sem build), manifest PWA, service worker. GitHub Pages é alojamento estático, pelo que não aloja servidores de jogos nem bases de dados. Para login, perfis partilhados e partidas online será necessário um backend externo, como o Supabase.

## Estrutura
- `index.html` — aplicação
- `index.html` inclui CSS e JavaScript para facilitar o alojamento estático e a edição inicial
- `manifest.webmanifest` — instalação PWA
- `sw.js` — cache e offline
- `icon.svg` — ícone da aplicação

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
