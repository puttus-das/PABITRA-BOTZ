# PABITRA-BOT V50

Developer: 𝐏ᴀʙɪᴛʀᴀ - 𝐏ᴀᴜʟ  
Owner: +919641092392  
WhatsApp Channel: [PABITRA WhatsApp Channel](https://whatsapp.com/channel/0029Vb8RL4F1HspsNlYYOE3e)  
Telegram Group: [PABITRA Telegram Group](https://t.me/PABITRA_BOTZ)

## Live Website

[Open PABITRA-BOT Website](https://pabitra-botzdas.vercel.app/)

## One-click deployment

### Deploy the bot backend to Heroku

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/puttus-das/PABITRA-BOTZ)

This deploys the WhatsApp and Telegram bot backend. The deploy form keeps only three Config Vars: `BOT_TOKEN_TELEGRAM`, `TG_GROUP_ID`, and `WEBSITE_URL`. Never commit tokens, passwords, or WhatsApp session files to GitHub.

### Deploy the website to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fputtus-das%2FPABITRA-BOTZ&root-directory=website&project-name=pabitra-botz-website)

For Vercel, the `website` folder is already selected as the root directory. After the Heroku app is created, edit [`website/config.js`](website/config.js) and replace `YOUR-HEROKU-APP` with the real Heroku URL. Then set the Heroku Config Var `WEBSITE_URL` to the final Vercel URL.

## Telegram pairing

After Heroku is running, add the bot to the configured Telegram group and send:

```text
/pair +919641092392
```

The bot will send the WhatsApp pairing code in Telegram with a copy button. In WhatsApp, open **Linked Devices → Link a Device → Link with phone number instead**, then enter the code.

## Project layout

- The root project is the Heroku Node.js backend.
- `website/` is the static Vercel frontend with the bot DP, menu background, MP4 media, live status, and pairing form.
- `Procfile` starts the Heroku web process.
- `app.json` contains Heroku deployment metadata and safe Config Var descriptions.

© 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ
