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
- `styles.css` — tema e responsividade
- `app.js` — navegação, jogos e progresso local
- `manifest.webmanifest` — instalação PWA
- `sw.js` — cache e offline
- `icon.svg` — ícone da aplicação

## Desenvolvimento local
Executa um servidor HTTP na pasta do projeto (`python -m http.server 8080`), depois abre `http://localhost:8080`. Não uses `file://` para testar a PWA.

## Segurança / privacidade
O GitHub Pages é público. Não colocar passwords, chaves secretas, tokens de serviço ou dados privados no repositório. A instalação no ecrã inicial depende do navegador e do HTTPS (fornecido pelo Pages).

---
Desenvolvido para diversão entre amigos.