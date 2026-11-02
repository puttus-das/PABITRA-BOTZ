# PABITRA-BOT V50

Developer: 𝐏ᴀʙɪᴛʀᴀ - 𝐏ᴀᴜʟ  
Owner: +919641092392  
[WhatsApp Channel](https://whatsapp.com/channel/0029Vb8RL4F1HspsNlYYOE3e) · [Telegram Group](https://t.me/PABITRA_BOTZ)

## Deploy PABITRA-BOT

The app is a long-running Node.js service. On Heroku, the same app serves the website, pairing API, and media from one URL. The source can also run on Render, Railway, Koyeb, or an Oracle Cloud VM.

[![Deploy to Heroku](https://img.shields.io/badge/Deploy-Heroku-430098?style=for-the-badge&logo=heroku&logoColor=white)](https://heroku.com/deploy?template=https://github.com/puttus-das/PABITRA-BOTZ)
[![Deploy to Render](https://img.shields.io/badge/Deploy-Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://render.com/deploy?repo=https://github.com/puttus-das/PABITRA-BOTZ)
[![Deploy to Railway](https://img.shields.io/badge/Deploy-Railway-7B2CF5?style=for-the-badge&logo=railway&logoColor=white)](https://railway.com/new?template=https://github.com/puttus-das/PABITRA-BOTZ)
[![Deploy to Koyeb](https://img.shields.io/badge/Deploy-Koyeb-121212?style=for-the-badge&logo=koyeb&logoColor=white)](https://app.koyeb.com/)
[![Deploy to Oracle Cloud](https://img.shields.io/badge/Deploy-Oracle%20Cloud-F80000?style=for-the-badge&logo=oracle&logoColor=white)](https://www.oracle.com/cloud/free/)
[![Deploy with Docker](https://img.shields.io/badge/Run-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docs.docker.com/get-started/)

### Recommended setup

1. Choose one backend host and deploy the repository root. Heroku uses `Procfile`; Render's persistent-disk setup is [`render.yaml`](render.yaml), while the sleep/ephemeral free preview is [`render-free.yaml`](render-free.yaml); Railway uses [`railway.json`](railway.json); Koyeb and Oracle Cloud can build the included [`Dockerfile`](Dockerfile).
2. Configure the environment variables below in the provider dashboard. Do not commit tokens, pairing sessions, or database secrets.
3. For persistent WhatsApp logins, mount durable storage at `/data` and set `AUTH_DIR=/data/sessions` and `DATA_DIR=/data/data`. On Railway, create and mount a volume at `/data`. On Oracle Cloud, use a persistent host directory/volume. Render's included blueprint uses a paid persistent disk.
4. The website is included under `website/` and is served by the app at `/`. Its pairing form calls `/pair/:number` on that same Heroku origin; no separate Vercel deployment or API URL is required.

### Platform notes

- **Heroku:** `app.json` defaults to an Eco web dyno. Heroku sleeps Eco web dynos after 30 minutes without web traffic, cycles dynos at least daily, and resets their local filesystem on restart. Code cannot disable those platform rules; 24/7 operation requires a paid always-on dyno. This bot now retries transient WhatsApp reconnects indefinitely by default, but Heroku still needs durable external storage if the WhatsApp login must survive a dyno replacement. See [Eco dyno hours](https://devcenter.heroku.com/articles/eco-dyno-hours) and [dyno restarts](https://devcenter.heroku.com/articles/dyno-restarts).
- **Render:** [`render.yaml`](render.yaml) provisions a paid web service with a `/data` persistent disk. [`render-free.yaml`](render-free.yaml) is only a no-cost preview: it can sleep and its local auth/data are ephemeral, so expect to reconnect WhatsApp after some restarts.
- **Railway:** deploy with the included Dockerfile and `railway.json`, then add a Railway Volume mounted at `/data`. The default free credit may not cover a continuously running service.
- **Koyeb:** create a Docker web service from this repository and use the included Dockerfile. Configure `AUTH_DIR` and `DATA_DIR` to a durable volume if available on your plan. The free instance scales to zero, so it can disconnect the bot.
- **Oracle Cloud:** create an Always Free VM where capacity is available, install Docker, clone this repository, then run the container with a host directory mounted at `/data`. Keep the VM patched and protect SSH credentials. Free VM availability and idle-reclamation policies apply.
- **Vercel:** optional for a separate static frontend. The combined Heroku website and pairing page are served by the long-running app process.

### Environment variables

Set at least `BOT_TOKEN_TELEGRAM` and `TG_GROUP_ID` for Telegram integration. `WEBSITE_URL` is optional and only needed when hosting the frontend on a separate origin; omit it for the same-origin Heroku website. `BOT_PREFIX` defaults to `.`, `PAIR_CODE` defaults to `POBIPAUL` (shown as `POBI-PAUL`), `AUTH_DIR` defaults to `./sessions`, and `DATA_DIR` defaults to `./data`. Transient reconnects retry indefinitely by default; set `RECONNECT_LIMIT` only if you specifically want a finite cap. `PORT` is supplied by most platforms. Set `OFFTELEBOT=true` if you do not want to initialize the Telegram bot.

## Website on Heroku

Deploy the repository root to Heroku. The app serves `website/index.html`, its CSS/JavaScript, images, and MP4 videos automatically, while the pairing form calls the same app's `/pair/:number` endpoint. The homepage is `/`; the JSON status endpoint is `/health`.

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
  -v "$PWD/runtime:/data" \
  pabitra-bot
```

## Project layout

- The repository root is the WhatsApp/Telegram Node.js backend.
- `website/` is the static site served by Express from the same app as the bot and pairing API.
- `render.yaml`, `render-free.yaml`, and `railway.json` provide deployment configuration for those platforms.
- `package-lock.json` pins dependencies for `npm ci`; `.dockerignore` removes Git history, documentation, and local runtime data while keeping the website assets.
- `Dockerfile` is the common container entry point for Docker, Koyeb, Railway, Render, and Oracle Cloud.
- `Procfile` and `app.json` provide Heroku deployment metadata; the site and bot run together in one web process.

© 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ
