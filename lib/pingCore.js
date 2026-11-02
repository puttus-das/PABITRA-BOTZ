// Shared ping logic — used by .ping command AND the menu's PING button.
// The pong is sent first; the bot-image Audio action card follows.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import config from "../config.js";
import { sendAudioButtonCard } from "./buttonCards.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PING_IMAGE = path.join(__dirname, "..", "plugins", "bin", "menu.jpg");
const EMOJIS = ["⛅", "👻", "⛄", "👀", "🪁", "🪃", "🎳", "🎀", "🌸", "🍥", "🍓", "🍡", "💗", "🦋", "💫", "💀", "☁️", "🌨️", "🌧️", "🌦️", "🌥️", "🪹", "⚡", "🌟", "🎐", "🏖️", "🪺", "🌊", "🐚", "🪸", "🍒", "🍇", "🍉", "🌻", "🎢", "🚀", "🍫", "💎", "🌋", "🏔️", "⛰️", "🌙", "🪐", "🌲", "🍃", "🍂", "🍁", "🪵", "🍄", "🌿", "🐞", "🐍", "🕊️", "🎃", "🏟️", "🎡", "🥂", "🗿", "⛩️"];

export async function sendPing(message) {
  const start = Date.now();
  try {
    await message.react(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
  } catch (_) {}

  const ping = Date.now() - start;
  const text = `*© ━( 𝐏ᴀʙɪᴛʀᴀ - 𝐁ᴏᴛ⎯꯭̽💜 )━*\n⏱️ ${ping} ms`;

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

  await sendAudioButtonCard(message.conn, message.from, { quoted: message.gift });
}
