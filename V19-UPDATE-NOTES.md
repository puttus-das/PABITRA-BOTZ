# PABITRA-BOT V19

- Updated the WhatsApp text chatbot: private-chat auto replies default to ON; group replies are smart/mention/reply triggered by default. Use `.flirt all` in a group to reply to every message in that group, `.flirt off` to disable, `.flirt dm on/off` for private chats.
- Chatbot attempts the supplied EliteProTech `/ai/chatgpt` endpoint using GET and POST request shapes, keeps a short per-chat conversation context, and falls back to a local contextual reply if the endpoint is unreachable or returns an unsupported response.
- `.askai` now tries both GET and POST request formats and has `.chatgpt` as an alias.
- Improved `.musicvideo`/Music menu button handler: validates available MP4 files, chooses a random clip, sends it quoted to the triggering message, and logs the selected file/errors.
- Existing `.play`, `.song`, `.music`, menu buttons, plugins, and media files are retained.

## Important testing note
The EliteProTech host could not be resolved from the build environment, so live API availability and its exact response schema could not be verified here. The bot includes GET/POST compatibility attempts and a chatbot fallback. Test `.askai hello` on the device after deployment.
