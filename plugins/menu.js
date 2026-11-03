
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Module } from "../lib/plugins.js";
import config from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMAGE = path.join(__dirname, "bin", "pabitra.jpg");

const BOT_NAME = "𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ";
const OWNER = "APURBO-DAS";
const CONTACT = "91 96410 92392";

Module({
  command: "menu",
  aliases: ["startmenu"],
  package: "general",
  description: "Show PABITRA BOT premium menu"
})(async (message) => {
  try {
    const prefix = config.prefix || ".";

    const caption = `
╭━━━〔 💜 ${BOT_NAME} 〕━━━╮

  ✨ 𝐖ᴇʟᴄᴏᴍᴇ 𝐓ᴏ 𝐏ᴀʙɪᴛʀᴀ

  👤 𝐔sᴇʀ : ${message.pushName || "User"}
  👑 𝐎ᴡɴᴇʀ : ${OWNER}
  📞 𝐂ᴏɴᴛᴀᴄᴛ : ${CONTACT}

╰━━━━━━━━━━━━━━━━━━╯

╭━━〔 ✨ 𝐁ᴏᴛ 𝐈ɴғᴏ ✨ 〕━━╮
┃
┃  🚀 𝐀ᴜᴛᴏᴍᴀᴛᴇ 𝐘ᴏᴜʀ 𝐖ʜᴀᴛsᴀᴘᴘ
┃  ⚡ 𝐅ᴀsᴛ & 𝐒ᴍᴀʀᴛ 𝐑ᴇsᴘᴏɴsᴇ
┃  💎 𝐏ʀᴇᴍɪᴜᴍ 𝐂ᴏᴍᴍᴀɴᴅs
┃
╰━━━━━━━━━━━━━━━━━━╯

     ❤️ 𝐂ʜᴏᴏsᴇ 𝐀 𝐁ᴜᴛᴛᴏɴ 𝐁ᴇʟᴏᴡ

> © SILIGURI-BOY
> EDITZ - APURBO-DAS
`;

    const buttons = [
      {
        buttonId: `${prefix}allmenu`,
        buttonText: {
          displayText: "ᴍᴇɴᴜ"
        },
        type: 1
      },
      {
        buttonId: `${prefix}ping`,
        buttonText: {
          displayText: "ᴘɪɴɢ"
        },
        type: 1
      }
    ];

    const payload = {
      caption,
      footer: BOT_NAME,
      buttons,
      headerType: 6
    };

    if (fs.existsSync(IMAGE)) {
      payload.image = fs.readFileSync(IMAGE);
    } else {
      payload.text = caption;
      delete payload.caption;
      delete payload.buttons;
      delete payload.headerType;
    }

    await message.conn.sendMessage(
      message.from,
      payload,
      { quoted: message.gift }
    );

  } catch (error) {
    console.error("[PABITRA MENU ERROR]", error);

    await message.conn.sendMessage(message.from, {
      text: "❌ Menu could not be sent. Please check the image and button support."
    });
  }
});
