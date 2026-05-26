# 🤖 DARK BOT

Bot profissional do WhatsApp com Dashboard moderno.

- **Bot:** DARK BOT
- **Dono:** Dark Net (+244 945 280 380)
- **Número do Bot:** +244 949 926 074
- **Stack:** Node.js · Baileys · Express · EJS · MongoDB · Cloudinary · Socket.IO

## ✨ Funcionalidades (MVP)

- ✅ Conexão WhatsApp via **QR Code** e **Pair Code (8 dígitos)** pelo dashboard
- ✅ Dashboard moderno (tema dark, glassmorphism, responsivo)
- ✅ Login do **Dono** e dos **Usuários** (Free / Premium)
- ✅ Dono com controle total: criar/editar/deletar comandos, mídias, usuários
- ✅ Sistema de **hospedagem de mídias** (fotos, vídeos, GIFs, áudios) via Cloudinary
- ✅ **Editor de comandos** com vínculo a mídias, variáveis dinâmicas, submenus e símbolos
- ✅ **Stickers com marca d'água** (nome do bot, dono, usuário e grupo nos metadados)
- ✅ Eventos em tempo real via Socket.IO (status, QR, pair code)
- ✅ Pronto para deploy no **Render Free** + **GitHub**

## 🚀 Deploy no Render Free + GitHub

### 1. Pré-requisitos (contas grátis)

- **GitHub:** https://github.com
- **MongoDB Atlas (free 512MB):** https://www.mongodb.com/cloud/atlas
- **Cloudinary (free 25GB):** https://cloudinary.com
- **Render (free):** https://render.com

### 2. Configurar MongoDB Atlas

1. Crie um cluster gratuito (M0)
2. Em **Database Access** → crie um usuário e senha
3. Em **Network Access** → libere `0.0.0.0/0` (todos os IPs)
4. Copie a **connection string** (algo como `mongodb+srv://user:pass@cluster0.xxx.mongodb.net/darkbot`)

### 3. Configurar Cloudinary

1. Crie a conta
2. No Dashboard, copie: `Cloud Name`, `API Key`, `API Secret`

### 4. Subir para o GitHub

```bash
cd dark-bot
git init
git add .
git commit -m "DARK BOT inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/dark-bot.git
git push -u origin main
```

### 5. Deploy no Render

1. Em https://dashboard.render.com → **New +** → **Web Service**
2. Conecte seu GitHub e selecione o repositório `dark-bot`
3. Configurações:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. Adicione as **Environment Variables** (veja `.env.example`):
   - `SESSION_SECRET` (qualquer string aleatória longa)
   - `OWNER_NAME` = `Dark Net`
   - `OWNER_NUMBER` = `244945280380`
   - `BOT_NAME` = `DARK BOT`
   - `BOT_NUMBER` = `244949926074`
   - `OWNER_USERNAME` = `darknet`
   - `OWNER_PASSWORD` = (sua senha forte)
   - `MONGODB_URI` = (do MongoDB Atlas)
   - `CLOUDINARY_CLOUD_NAME` = ...
   - `CLOUDINARY_API_KEY` = ...
   - `CLOUDINARY_API_SECRET` = ...
   - `APP_URL` = `https://dark-bot.onrender.com`
5. Clique **Create Web Service**

### 6. Primeiro acesso

1. Acesse `https://seu-app.onrender.com`
2. Faça login com `darknet` / sua senha
3. Vá em **Conectar Bot** → escolha QR Code OU Pair Code
4. Pronto! 🎉

## 💻 Rodar localmente

```bash
git clone https://github.com/SEU_USUARIO/dark-bot.git
cd dark-bot
cp .env.example .env   # edite suas variáveis
npm install
npm start
```

Acesse: http://localhost:3000

## 📦 Estrutura

```
dark-bot/
├── src/
│   ├── bot/              # Lógica do WhatsApp (Baileys)
│   │   ├── whatsapp.js   # Conexão + QR/Pair Code
│   │   ├── commandHandler.js
│   │   ├── mediaHandler.js
│   │   └── stickerMaker.js
│   ├── database/         # MongoDB
│   ├── routes/           # Rotas Express (auth, dashboard, api)
│   ├── middleware/
│   ├── views/            # EJS templates
│   ├── public/           # CSS, JS estáticos
│   ├── config.js
│   └── index.js          # Entry point
├── data/auth/            # Sessão WhatsApp (não comitar)
├── package.json
├── render.yaml
└── .env.example
```

## 🎮 Comandos nativos

- `!menu` ou `!help` — lista todos os comandos
- `!ping` — testa o bot
- `!dono` — info do dono
- `!sticker` (em imagem/vídeo) ou `!s` — cria sticker com marca d'água

## 🛠️ Variáveis dinâmicas (nos comandos)

- `{user}` — nome de quem enviou
- `{number}` — número de quem enviou
- `{bot}` — nome do bot
- `{owner}` — nome do dono
- `{group}` — nome do grupo
- `{prefix}` — prefixo (padrão: `!`)

## ⚠️ Limitações do Render Free

- **Sleep após 15min** sem requisições → o bot pode desconectar. Soluções:
  - Use um pinger gratuito (UptimeRobot, Cron-job.org) batendo em `/health` a cada 10min
  - Ou upgrade para o plano Starter ($7/mês)
- **Disco efêmero:** a sessão do WhatsApp em `data/auth/` se perde a cada deploy/restart → você precisará reconectar (escanear QR ou usar Pair Code novamente). Em versões futuras, podemos salvar a sessão criptografada no MongoDB.

## 📋 Próximos passos (não MVP)

- [ ] Download de áudio/vídeo do YouTube/TikTok com auto-descarte
- [ ] Sessão Baileys persistida no MongoDB (resiste a restarts)
- [ ] Editor de submenus drag-and-drop
- [ ] Webhook de pagamentos para Premium
- [ ] Multi-bot (várias instâncias)

## 📞 Contato

- **Dono:** Dark Net — wa.me/244945280380
- **Bot:** wa.me/244949926074

---
Feito com 💜 para Dark Net
