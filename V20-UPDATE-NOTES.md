# PABITRA-BOT V20

- NEW `.bot` / `.sim` command (plugins/bot.js): `.bot` = random Bangla greeting with mention, `.bot <text>` = chat reply. Replying to a bot message continues the chat. The auto chatbot (flirt.js) skips those replies so you never get double answers.
- FIX menu buttons (Ping / Music): button taps are now decoded for every WhatsApp format (interactive, template, buttons, list). If only the label arrives, it is mapped back to `.ping` / `.musicvideo`. Taps print `[BTN]` lines in the console.
- FIX Music button: sends one random video from `plugins/bin/music-videos/` (mp4/mkv/webm/mov/3gp, sub-folders too, never the same clip twice in a row). Just drop more videos in that folder.
- Ping / music replies now retry without the quote if WhatsApp rejects it.

## V20.1
- Menu: new `━[ 𝐀ᴜᴅɪᴏ ]━` button (below Music) and `.audio` command. Picks a random link from `plugins/bin/audio_urls.json` (52 mp4 links), extracts the sound with ffmpeg and sends it as audio. Dead links are skipped (up to 4 tries). Edit the JSON to add/remove links.
- Flirt chatbot: no more vCard quote. It now quotes the user's own message and @mentions them in groups.
- Flirt chatbot: when the API is down/off-topic it uses the built-in mood-aware Bengali engine (plugins/bin/flirt_engine.js) instead of a generic line, so replies match the message. API timeout cut from 18s to 8s.
