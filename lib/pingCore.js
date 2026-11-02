// Shared ping logic — used by .ping command AND the menu's PING button.
import config from "../config.js";
import { sendButtonCard, audioButton } from "./buttonCards.js";

const EMOJIS = ["⛅", "👻", "⛄", "👀", "🪁", "🪃", "🎳", "🎀", "🌸", "🍥", "🍓", "🍡", "💗", "🦋", "💫", "💀", "☁️", "🌨️", "🌧️", "🌦️", "🌥️", "🪹", "⚡", "🌟", "🎐", "🏖️", "🪺", "🌊", "🐚", "🪸", "🍒", "🍇", "🍉", "🌻", "🎢", "🚀", "🍫", "💎", "🌋", "🏔️", "⛰️", "🌙", "🪐", "🌲", "🍃", "🍂", "🍁", "🪵", "🍄", "🌿", "🐞", "🐍", "🕊️", "🎃", "🏟️", "🎡", "🥂", "🗿", "⛩️"];

export async function sendPing(message) {
  const start = Date.now();
  try {
    await message.react(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
  } catch (_) {}

  const ping = Date.now() - start;
  const text = `*© ━( 𝐏ᴀʙɪᴛʀᴀ - 𝐁ᴏᴛ⎯꯭̽💜 )━*\n⏱️ ${ping} ms`;
  await message.conn.sendMessage(message.from, { text }, { quoted: message.gift });
  await sendButtonCard({
    conn: message.conn,
    jid: message.from,
    buttons: [audioButton()],
    body: "🎧 Audio",
    footer: config.brandLine,
    quoted: message.gift,
  });
}
