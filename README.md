# PABITRA-BOT

![PABITRA-BOT profile image](plugins/bin/tg_dp.jpg)

**⎯꯭̽ꪹ𝐏𝐚𝐛𝐢𝐭𝐫𝐚 𝐏𝐚𝐮𝐥⎯꯭̽💜**

Developer: 𝐏ᴀʙɪᴛʀᴀ - 𝐏ᴀᴜʟ  
Owner: +919641092392  
[WhatsApp Channel](https://whatsapp.com/channel/0029Vb8RL4F1HspsNlYYOE3e) · [Telegram Group](https://t.me/PABITRA_BOTZ)

## Deploy and pair

The bot is a long-running Node.js process. Choose one backend host; the bundled website and pairing API can be served from the same backend URL.

[![Deploy to Heroku](https://img.shields.io/badge/Deploy-Heroku-430098?style=for-the-badge&logo=heroku&logoColor=white)](https://heroku.com/deploy?template=https://github.com/puttus-das/PABITRA-BOTZ)
[![Deploy website to Vercel](https://img.shields.io/badge/Deploy-Website%20to%20Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fputtus-das%2FPABITRA-BOTZ)
[![Heroku pair instructions](https://img.shields.io/badge/Pair%20on-Heroku-430098?style=for-the-badge&logo=heroku&logoColor=white)](#pair-whatsapp-on-heroku)
[![Deploy to Render](https://img.shields.io/badge/Deploy-Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)](https://render.com/deploy?repo=https://github.com/puttus-das/PABITRA-BOTZ)
[![Deploy to Railway](https://img.shields.io/badge/Deploy-Railway-7B2CF5?style=for-the-badge&logo=railway&logoColor=white)](https://railway.com/new?template=https://github.com/puttus-das/PABITRA-BOTZ)
[![Deploy to Koyeb](https://img.shields.io/badge/Deploy-Koyeb-121212?style=for-the-badge&logo=koyeb&logoColor=white)](https://app.koyeb.com/)
[![Deploy to Oracle Cloud](https://img.shields.io/badge/Deploy-Oracle%20Cloud-F80000?style=for-the-badge&logo=oracle&logoColor=white)](https://www.oracle.com/cloud/free/)
[![Run with Docker](https://img.shields.io/badge/Run-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://docs.docker.com/get-started/)

### Heroku account and uptime

Heroku app code cannot prevent Heroku from deleting an inactive account. Heroku currently defines an account as inactive when its owner has not logged in to the Dashboard, CLI, or API for 365 days **and** has not used a paid resource for 6 months. Log in to Heroku periodically and keep your account and billing in good standing. See [Heroku account management](https://devcenter.heroku.com/articles/account-management).

This repository's [`app.json`](app.json) uses an Eco web dyno by default. Eco web dynos sleep after 30 minutes without web traffic, so that setting does not promise 24/7 bot uptime. For an always-on dyno, choose a paid Basic dyno in Heroku; this can add recurring charges. Do not use a keep-alive pinger as a substitute: Heroku says monitoring pingers can keep Eco dynos awake and consume the shared monthly Eco hours. See [Eco dyno hours](https://devcenter.heroku.com/articles/eco-dyno-hours).

Heroku also restarts dynos at least daily and discards local filesystem changes on restart. That is separate from account/app deletion. WhatsApp session files stored only on the dyno can be lost, so use durable external session storage or be prepared to pair again after a restart. See [Heroku dyno restarts](https://devcenter.heroku.com/articles/dyno-restarts).

### Vercel

The Vercel button opens the repository import flow. Set the Vercel project **Root Directory** to `website` to deploy the static website only. The WhatsApp/Telegram bot must run on a persistent backend such as Heroku; Vercel Functions have execution-duration limits and are not a replacement for this continuously running bot process. If the website is hosted separately, set `window.PABITRA_API_URL` in [`website/config.js`](website/config.js) to your backend's public origin so the pairing form reaches the correct API. See [Vercel Express deployment](https://vercel.com/docs/frameworks/backend/express) and [Vercel Function limits](https://vercel.com/docs/functions/limitations).

### Pair WhatsApp on Heroku

The **Pair on Heroku** button above opens this section. A README cannot use one fixed pair URL for every deployment because Heroku assigns each app its own name. After deploying, open your app's home page at `https://<your-heroku-app-name>.herokuapp.com/` and submit a phone number with its country code. You can also add the bot to your Telegram group and send:

```text
/pair +919641092392
```

On WhatsApp, open **Linked Devices → Link a Device → Link with phone number instead**, then enter the returned code. Never share a pairing code.

## Other deployment options

- **Render:** [`render.yaml`](render.yaml) provisions a paid service with a persistent `/data` disk. [`render-free.yaml`](render-free.yaml) is only a no-cost preview; it may sleep and its local auth/data are ephemeral.
- **Railway:** deploy with the included Dockerfile and [`railway.json`](railway.json), then add a Railway Volume mounted at `/data`. Free credits may not cover a continuously running bot.
- **Koyeb:** create a Docker web service from this repository. Configure `AUTH_DIR` and `DATA_DIR` to use durable storage if your plan supports it.
- **Oracle Cloud:** run the included Docker image on a VM and mount a persistent host directory at `/data`. VM availability and idle-reclamation policies apply.

## Configuration

Set `BOT_TOKEN_TELEGRAM` and `TG_GROUP_ID` for Telegram integration. `BOT_PREFIX` defaults to `.`, `PAIR_CODE` defaults to `POBIPAUL` (shown as `POBI-PAUL`), `AUTH_DIR` defaults to `./sessions`, and `DATA_DIR` defaults to `./data`. `PORT` is supplied by most platforms. Set `OFFTELEBOT=true` if you do not want to initialize the Telegram bot. Plugin responses use the fixed signature `*⎯꯭̽ꪹ𝐏𝐚𝐛𝐢𝐭𝐫𝐚 𝐏𝐚𝐮𝐥⎯꯭̽💜*`.

For persistent WhatsApp logins, mount durable storage at `/data` and set `AUTH_DIR=/data/sessions` and `DATA_DIR=/data/data`. On Railway, create and mount a volume at `/data`. Heroku's dyno filesystem is ephemeral, so local files alone do not survive dyno restarts.

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

- The repository root contains the WhatsApp/Telegram backend.
- `website/` contains the static website, served by the backend or deployable separately.
- `Procfile` and `app.json` provide Heroku deployment metadata.
- `Dockerfile`, `render.yaml`, `render-free.yaml`, and `railway.json` provide other deployment configurations.
- `package-lock.json` pins dependencies for `npm ci`.

**⎯꯭̽ꪹ𝐏𝐚𝐛𝐢𝐭𝐫𝐚 𝐏𝐚𝐮𝐥⎯꯭̽💜**
