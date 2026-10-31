import config from "../config.js";
import { Module } from "../lib/plugins.js";

// ─── .pabitra [count] [text] ──────────────────────────────────────────────────
// Sends the same message several times, each one quoting the Pabitra-Bot vCard.
// Safety limits (WhatsApp bans numbers that flood messages): owner only, max MAX, DELAY_MS apart.
const MAX = 20;
const DELAY_MS = 1000;
const DEFAULT_TEXT = "*🩸-[Pᴀʙɪᴛʀᴀ-Bᴏᴛ]-🩸*";

const ownerNumber = String(config.owner || "919641092392").replace(/\D/g, "");

const vcard =
  "BEGIN:VCARD\n" +
  "VERSION:3.0\n" +
  "FN:🌸•𝐏𝐚𝐛𝐢𝐭𝐫𝐚•⌲\n" +
  "ORG:PABITRA-BOT;\n" +
  `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}\n` +
  "END:VCARD";

const vcardReply = {
  key: {
    fromMe: false,
    participant: `${ownerNumber}@s.whatsapp.net`,
    remoteJid: "status@broadcast",
  },
  message: {
    contactMessage: {
      displayName: "⎯꯭̽ꪹ𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ⎯꯭̽💜",
      vcard,
    },
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

Module({
  command: "pabitra",
  package: "fun",
  description: "Send a message several times (owner only). Usage: .pabitra 5 hello",
})(async (message, match) => {
  try {
    if (!(message.isfromMe || message.isFromMe)) {
      return message.conn.sendMessage(
        message.from,
        { text: "_This command is for the owner only_" },
        { quoted: vcardReply, keepQuoted: true }
      );
    }

    const parts = (match || "").trim().split(/\s+/).filter(Boolean);
    const count = parseInt(parts[0], 10) || 5;
    const text = parts.slice(1).join(" ") || DEFAULT_TEXT;

    if (count > MAX) {
      return message.conn.sendMessage(
        message.from,
        { text: `Max ${MAX} messages allowed at once!` },
        { quoted: vcardReply, keepQuoted: true }
      );
    }
    if (count < 1) return;

    for (let i = 0; i < count; i++) {
      await message.conn.sendMessage(
        message.from,
        { text },
        { quoted: vcardReply, keepQuoted: true }
      );
      if (i < count - 1) await sleep(DELAY_MS);
    }
  } catch (err) {
    console.error("[PABITRA]", err?.message || err);
  }
});
