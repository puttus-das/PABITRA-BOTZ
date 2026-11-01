import { Module } from "../lib/plugins.js";

// ─── .pabitra [count] [text] ──────────────────────────────────────────────────
// Sends the same message several times, each one quoting the command message.
// Safety limits (WhatsApp bans numbers that flood messages): owner only, max MAX, DELAY_MS apart.
const MAX = 20;
const DELAY_MS = 1000;
const DEFAULT_TEXT = "*🩸-[Pᴀʙɪᴛʀᴀ-Bᴏᴛ]-🩸*";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

Module({
  command: "pabitra",
  package: "fun",
  description: "Send a message several times (owner only). Usage: .pabitra 5 hello",
})(async (message, match) => {
  try {
    if (!(message.isfromMe || message.isFromMe)) {
      return message.send("_This command is for the owner only_");
    }

    const parts = (match || "").trim().split(/\s+/).filter(Boolean);
    const count = parseInt(parts[0], 10) || 5;
    const text = parts.slice(1).join(" ") || DEFAULT_TEXT;

    if (count > MAX) {
      return message.send(`Max ${MAX} messages allowed at once!`);
    }
    if (count < 1) return;

    for (let i = 0; i < count; i++) {
      await message.reply(text);
      if (i < count - 1) await sleep(DELAY_MS);
    }
  } catch (err) {
    console.error("[PABITRA]", err?.message || err);
  }
});
