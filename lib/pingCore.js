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
  const text = `*━( 𝐏ᴀʙɪᴛʀᴀ  ${ping}  𝐁ᴏᴛ⎯꯭̽💜 )━*`;
  await sendButtonCard({
    conn: message.conn,
    jid: message.from,
    buttons: [audioButton()],
    body: text,
    footer: config.brandLine,
    quoted: message.gift,
  });
}
