// Shared ping logic — used by .ping command AND the menu's PING button.
// The pong is sent first; a separate one-button card follows for .audio.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import config from "../config.js";
import { sendSingleButtonCards } from "./singleButtonCards.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PING_IMAGE = path.join(__dirname, "..", "plugins", "bin", "menu.jpg");
const EMOJIS = ["⛅", "👻", "⛄", "👀", "🪁", "🪃", "🎳", "🎀", "🌸", "🍥", "🍓", "🍡", "💗", "🦋", "💫", "💀", "☁️", "🌨️", "🌧️", "🌦️", "🌥️", "🪹", "⚡", "🌟", "🎐", "🏖️", "🪺", "🌊", "🐚", "🪸", "🍒", "🍇", "🍉", "🌻", "🎢", "🚀", "🍫", "💎", "🌋", "🏔️", "⛰️", "🌙", "🪐", "🌲", "🍃", "🍂", "🍁", "🪵", "🍄", "🌿", "🐞", "🐍", "🕊️", "🎃", "🏟️", "🎡", "🥂", "🗿", "⛩️"];

export async function sendPing(message) {
  const start = Date.now();
  try {
    await message.react(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
  } catch (_) {}

  const ping = Date.now() - start;
  const text = `*━( 𝐏ᴀʙɪᴛʀᴀ ${ping} 𝐁ᴏᴛ⎯꯭̽💜 )━*`;

  // Send the pong as its own message before the audio action appears.
  try {
    if (fs.existsSync(PING_IMAGE)) {
      await message.conn.sendMessage(
        message.from,
        { image: fs.readFileSync(PING_IMAGE), caption: text },
        { quoted: message.gift }
      );
    } else {
      await message.conn.sendMessage(message.from, { text }, { quoted: message.gift });
    }
  } catch (error) {
    console.error("[ping] image/text send failed; retrying as text:", error?.message || error);
    await message.conn.sendMessage(message.from, { text }, { quoted: message.gift });
  }

  await sendSingleButtonCards({
    conn: message.conn,
    jid: message.from,
    buttons: [{
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "━[ 𝐀ᴜᴅɪᴏ ]━",
        id: `${config.prefix || "."}audio`,
      }),
    }],
    body: "🎧 Tap below to get audio",
    footer: config.ownerName,
    quoted: message.gift,
  });
}
