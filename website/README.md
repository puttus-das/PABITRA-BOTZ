# PABITRA-BOT V50 Website

This is a static Vercel frontend for the Heroku bot backend.

1. Deploy the root repository to Heroku first.
2. Edit `config.js` and replace `YOUR-HEROKU-APP` with the Heroku app URL.
3. In Vercel, import `puttus-das/PABITRA-BOTZ` and set **Root Directory** to `website`.
4. Deploy the project.
5. Set Heroku Config Var `WEBSITE_URL` to the final Vercel URL and restart the dyno.

The Telegram `/pair +country-code-number` command remains the primary pairing flow. The website form calls the same Heroku `/pair/:num` endpoint.
