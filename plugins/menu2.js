import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateWAMessageFromContent } from "baileys";
import config from "../config.js";
import { Module } from "../lib/plugins.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const thumbnailPath = path.join(__dirname, "bin", "menu2-thumb.jpg");

Module({
  command: "menu2",
  package: "general",
  description: "Show the classic location menu with Ping and Alive buttons",
  usage: ".menu2",
})(async (message) => {
  const chat = message.from;
  if (!chat) return message.send("Could not determine this chat.");

  try {
    const payload = {
      buttonsMessage: {
        buttons: [
          {
            buttonId: `${config.prefix}ping`,
            buttonText: { displayText: "ᴘɪɴɢ ᯤ" },
            type: 1,
          },
          {
            buttonId: `${config.prefix}alive`,
            buttonText: { displayText: "ᴀʟɪᴠᴇ ✆" },
            type: 1,
          },
        ],
        locationMessage: {
          degreesLatitude: 0,
          degreesLongitude: 0,
          name: "PABITRA-BOT",
          address: "Owner: PABITRA-PAUL | Contact: +91 96410 92392",
          jpegThumbnail: fs.readFileSync(thumbnailPath),
        },
      },
    };

    const outgoing = generateWAMessageFromContent(chat, payload, {
      quoted: message.gift,
      userJid: message.conn.user?.id,
    });
    await message.conn.relayMessage(chat, outgoing.message, {
      messageId: outgoing.key.id,
    });
  } catch (error) {
    console.error("[menu2] Failed to send legacy button card:", error?.message || error);
    await message.send(
      `*Ping and Alive menu*\nUse ${config.prefix}ping or ${config.prefix}alive.`,
    );
  }
});
