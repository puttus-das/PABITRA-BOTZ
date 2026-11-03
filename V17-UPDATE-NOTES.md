# PABITRA-BOT V17 update notes

- Existing `.play`, `.song`, and `.music` plugins were preserved.
- Added `.musicvideo` (`.randommusic`, `.mv` aliases), which sends one random uploaded MP4.
- Added `━[𝐌ᴜsɪᴄ - 🐞]━` as an extra menu button; the original Ping, Owner and Pair Code buttons remain.
- Added EliteProTech API commands: `.font`, `.fbapi`, `.igdl`, `.applemusic`, `.ytsearch`, `.tiktokstalk`, `.askai`, `.apiexample`.
- Pairing and activation cards use the supplied PABITRA artwork.
- Chatbot replies are contextual, friendly, quoted and mention the sender. Romantic roleplay was replaced with friendly chat.
- Telegram token is no longer hardcoded. Set `BOT_TOKEN_TELEGRAM` in the host environment. Revoke any token that was previously exposed in a public ZIP/repository and use a new one.
- GStatus code was reviewed and media metadata handling improved; real WhatsApp delivery still requires a live test on a connected group.

## API note
The API host documents a `status/result` JSON response format. Some endpoints require parameters not shown in the URLs originally supplied; the plugin sends common aliases (`url/link`, `query/q/text`, `username/user/text`). If a particular endpoint returns a parameter error, use its dashboard's exact parameter name.
