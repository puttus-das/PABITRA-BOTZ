# PABITRA-BOT V50

Developer: 𝐏ᴀʙɪᴛʀᴀ - 𝐏ᴀᴜʟ  
Owner: +919641092392  
[WhatsApp Channel](https://whatsapp.com/channel/0029Vb8RL4F1HspsNlYYOE3e) · [Telegram Group](https://t.me/PABITRA_BOTZ)

## Deploy PABITRA-BOT

The backend is a long-running Node.js/Docker service. The same source can run on Heroku, Render, Railway, Koyeb, or an Oracle Cloud VM. Click a badge for the provider's deployment flow or setup guide.

[![Deploy to Heroku](https://img.shields.io/badge/Deploy-Heroku-430098?style=for-the-badge&logo=heroku&logoColor=white)](https://heroku.com/deploy?template=https://github.com/puttus-das/PABITRA-BOTZ)
[![Deploy to Render](https://img.shields.io/badge/Deploy-Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://render.com/deploy?repo=https://github.com/puttus-das/PABITRA-BOTZ)
[![Deploy to Railway](https://img.shields.io/badge/Deploy-Railway-7B2CF5?style=for-the-badge&logo=railway&logoColor=white)](https://railway.com/new?template=https://github.com/puttus-das/PABITRA-BOTZ)
[![Deploy to Koyeb](https://img.shields.io/badge/Deploy-Koyeb-121212?style=for-the-badge&logo=koyeb&logoColor=white)](https://app.koyeb.com/)
[![Deploy to Oracle Cloud](https://img.shields.io/badge/Deploy-Oracle%20Cloud-F80000?style=for-the-badge&logo=oracle&logoColor=white)](https://www.oracle.com/cloud/free/)
[![Deploy with Docker](https://img.shields.io/badge/Run-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docs.docker.com/get-started/)

### Recommended setup

1. Choose one backend host and deploy the repository root. Heroku uses `Procfile`; Render uses [`render.yaml`](render.yaml); Railway uses [`railway.json`](railway.json); Koyeb and Oracle Cloud can build the included [`Dockerfile`](Dockerfile).
2. Configure the environment variables below in the provider dashboard. Do not commit tokens, pairing sessions, or database secrets.
3. For persistent WhatsApp logins, mount durable storage at `/data` and set `AUTH_DIR=/data/sessions` and `DATA_DIR=/data/data`. On Railway, create and mount a volume at `/data`. On Oracle Cloud, use a persistent host directory/volume. Render's included blueprint uses a paid persistent disk.
4. Deploy the frontend separately to Vercel using the website deployment button below. Set `website/config.js` to the deployed backend URL and set the backend's `WEBSITE_URL` to the Vercel site origin.

### Platform notes

- **Heroku:** supported through `app.json` and `Procfile`. Standard dyno files are ephemeral, so a redeploy/replacement can lose local WhatsApp credentials. Keep a safe copy or use external durable storage; do not assume local files survive.
- **Render:** [`render.yaml`](render.yaml) provisions a paid web service with a `/data` persistent disk. The free web service sleeps when idle and has no persistent disk, so it is not suitable for a continuously connected bot with local auth files.
- **Railway:** deploy with the included Dockerfile and `railway.json`, then add a Railway Volume mounted at `/data`. The default free credit may not cover a continuously running service.
- **Koyeb:** create a Docker web service from this repository and use the included Dockerfile. Configure `AUTH_DIR` and `DATA_DIR` to a durable volume if available on your plan. The free instance scales to zero, so it can disconnect the bot.
- **Oracle Cloud:** create an Always Free VM where capacity is available, install Docker, clone this repository, then run the container with a host directory mounted at `/data`. Keep the VM patched and protect SSH credentials. Free VM availability and idle-reclamation policies apply.
- **Vercel:** use it for the static website only. The WhatsApp bot requires a persistent, long-running backend process and should not run as a Vercel serverless function.

### Environment variables

Set at least `BOT_TOKEN_TELEGRAM`, `TG_GROUP_ID`, and `WEBSITE_URL` for Telegram integration and website CORS. `BOT_PREFIX` defaults to `.`, `PAIR_CODE` defaults to `POBIPAUL` (shown as `POBI-PAUL`), `AUTH_DIR` defaults to `./sessions`, and `DATA_DIR` defaults to `./data`. `PORT` is supplied by most platforms. Set `OFFTELEBOT=true` if you do not want to initialize the Telegram bot.

## Deploy the website to Vercel

[![Open live website](https://img.shields.io/badge/Open-Live%20Website-53e4ff?style=for-the-badge&logo=vercel&logoColor=white)](https://pabitra-botzdas.vercel.app/)
[![Deploy website to Vercel](https://img.shields.io/badge/Deploy-Website%20to%20Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fputtus-das%2FPABITRA-BOTZ&root-directory=website&project-name=pabitra-botz-website)

Select `website/` as the Vercel root directory. Update `website/config.js` with your live backend URL. The website's pairing form calls the backend's `/pair/:number` endpoint; a Vercel deploy alone does not host the bot backend.

## Pair WhatsApp

After the backend is running and the Telegram bot is configured, add it to your group and send:

```text
/pair +919641092392
```

Or open the website and submit a phone number with country code. In WhatsApp, open **Linked Devices → Link a Device → Link with phone number instead**, then enter the returned code. Never share a pairing code.

## Run with Docker

```sh
docker build -t pabitra-bot .
mkdir -p runtime/sessions runtime/data
docker run -d --name pabitra-bot --restart unless-stopped \
  -p 3000:3000 \
  -e PORT=3000 \
  -e AUTH_DIR=/data/sessions \
  -e DATA_DIR=/data/data \
  -e BOT_TOKEN_TELEGRAM=your_token \
  -e TG_GROUP_ID=your_group_id \
  -e WEBSITE_URL=https://your-site.vercel.app \
  -v "$PWD/runtime:/data" \
  pabitra-bot
```

## Project layout

- The repository root is the WhatsApp/Telegram Node.js backend.
- `website/` is the static Vercel frontend.
- `render.yaml` and `railway.json` provide deployment configuration for those platforms.
- `Dockerfile` is the common container entry point for Docker, Koyeb, Railway, Render, and Oracle Cloud.
- `Procfile` and `app.json` provide Heroku deployment metadata.

© 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ
