// plugins/pair.js — .pair <number>  → WhatsApp pairing code (same system as Telegram /pair)
// The code comes with a [Copy Code] button. Fixed code: PAIR_CODE env or POBIPAUL (POBI-PAUL).
import { Module } from "../lib/plugins.js";
import { manager } from "../lib/client.js";
import { markPairing } from "../lib/pairState.js";
import { proto, generateWAMessageFromContent } from "baileys";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const PAIR_CODE = (process.env.PAIR_CODE || "POBIPAUL").toUpperCase();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAIR_IMAGE = path.join(__dirname, "bin", "connect", "pabitra-v17.jpg");
const COOLDOWN_MS = 30_000; // per user
const MAX_PARALLEL = 3; // pairings running at the same time
const lastTry = new Map();
let inFlight = 0;

const fmtCode = (raw) => {
  const s = String(raw || "").replace(/\s+/g, "");
  return s.match(/.{1,4}/g)?.join("-") || s;
};

// wait until the new session is connected (same idea as the Telegram /pair)
function waitForSessionOpen(sessionId, timeoutMs = 22_000) {
  return new Promise((resolve, reject) => {
    if (manager.isRunning(sessionId)) return resolve();
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Connection timeout"));
    }, timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      manager.removeListener("connected", onConn);
      manager.removeListener("session.deleted", onDel);
    }
    function onConn(sid) {
      if (sid === sessionId) {
        cleanup();
        resolve();
      }
    }
    function onDel(sid) {
      if (sid === sessionId) {
        cleanup();
        reject(new Error("Session deleted before connecting"));
      }
    }
    manager.on("connected", onConn);
    manager.on("session.deleted", onDel);
  });
}

const successText = (digits, code) =>
  `-!!•- 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ ᴘᴀɪʀɪɴɢ •۵♡༏༏ 🔗\n` +
  `-!!•- ᴘᴀɪʀ ᴄᴏᴅᴇ ɢᴇɴᴇʀᴀᴛᴇᴅ •۵♡༏༏ ✅\n\n` +
  `-!!•- ɴᴜᴍʙᴇʀ •۵♡༏༏: +${digits} 📱\n` +
  `-!!•- ᴄᴏᴅᴇ •۵♡༏༏: *${code}* 🔑\n\n` +
  `_ᴏᴘᴇɴ ᴡʜᴀᴛsᴀᴘᴘ → ʟɪɴᴋᴇᴅ ᴅᴇᴠɪᴄᴇs → ʟɪɴᴋ ᴀ ᴅᴇᴠɪᴄᴇ → ᴇɴᴛᴇʀ ᴛʜɪs ᴄᴏᴅᴇ._\n\n` +
  `-!!•- 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ •۵♡༏༏ 💜`;

// code message with a [Copy Code] button; plain text if the button card is refused
async function sendCode(message, digits, code) {
  const text = successText(digits, code);
  // Send the branded image and pairing text together as a photo caption.
  try {
    if (fs.existsSync(PAIR_IMAGE)) {
      await message.conn.sendMessage(message.from, {
        image: fs.readFileSync(PAIR_IMAGE),
        caption: text,
        mimetype: "image/jpeg",
      }, { quoted: message.gift });
    } else {
      await message.conn.sendMessage(message.from, { text, noFont: true }, { quoted: message.gift });
    }
  } catch (e) {
    console.error("[pair] image caption failed:", e?.message || e);
    await message.conn.sendMessage(message.from, { text, noFont: true }, { quoted: message.gift });
  }
  // Preserve the existing copy-code button in a separate compact card.
  try {
    const P = proto.Message.InteractiveMessage;
    const msg = generateWAMessageFromContent(message.from, {
      viewOnceMessage: { message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage: P.create({
          body: P.Body.create({ text: `*𝐏ᴀɪʀɪɴɢ ᴄᴏᴅᴇ: ${code}*` }),
          footer: P.Footer.create({ text: "𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ" }),
          header: P.Header.create({ hasMediaAttachment: false }),
          nativeFlowMessage: P.NativeFlowMessage.create({ buttons: [{
            name: "cta_copy",
            buttonParamsJson: JSON.stringify({ display_text: "━[ 𝐂ᴏᴘʏ 𝐂ᴏᴅᴇ ]━", id: "copy_code", copy_code: code }),
          }] }),
        }),
      } },
    }, { quoted: message.gift, userJid: message.conn.user?.id });
    const bizNodes = [{ tag: "biz", attrs: {}, content: [{ tag: "interactive", attrs: { type: "native_flow", v: "1" }, content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }] }] }];
    if (!message.from.endsWith("@g.us")) bizNodes.push({ tag: "bot", attrs: { biz_bot: "1" } });
    await message.conn.relayMessage(message.from, msg.message, { messageId: msg.key.id, additionalNodes: bizNodes });
  } catch (e) {
    console.error("[pair] copy button unavailable:", e?.message || e);
  }
}

Module({
  command: "pair",
  package: "tools",
  aliases: ["getpair"],
  description: "Get a WhatsApp pairing code for a number",
  usage: ".pair 919876543210",
})(async (message, match) => {
  const digits = String(match || "").replace(/\D/g, "");

  if (!/^[0-9]{8,15}$/.test(digits)) {
    return message.send(
      `*-!!•- 𝐏ᴀɪʀɪɴɢ •۵♡༏༏ 🔗*\n\n` +
        `*-!!•- 𝐔ꜱᴀɢᴇ •۵♡༏༏: .pair 919876543210 📱*\n` +
        `*-!!•- 𝐒ᴇɴᴅ ᴛʜᴇ ɴᴜᴍʙᴇʀ ᴡɪᴛʜ ᴄᴏᴜɴᴛʀʏ ᴄᴏᴅᴇ,*\n` +
        `*ɴᴏ + ᴏʀ ꜱᴘᴀᴄᴇꜱ ɴᴇᴇᴅᴇᴅ.*\n\n` +
        `> © 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ`
    );
  }

  // spam protection (the owner is not limited)
  const who = message.sender || message.from;
  if (!message.isFromMe) {
    const wait = COOLDOWN_MS - (Date.now() - (lastTry.get(who) || 0));
    if (wait > 0) {
      return message.send(`-!!•- Please wait ${Math.ceil(wait / 1000)}s and try again ⏳`);
    }
  }
  if (inFlight >= MAX_PARALLEL) {
    return message.send(`-!!•- Server is busy, try again in a minute ⏳`);
  }
  if (manager.isRunning(digits)) {
    return message.send(`-!!•- +${digits} is already connected ✅`);
  }

  lastTry.set(who, Date.now());
  markPairing(digits, { sock: message.conn, chat: message.from }); // "connected" card goes back to this chat
  inFlight++;
  try {
    await message.react?.("⏳");

    const sock = await manager.start(digits);
    if (!sock) throw new Error("Socket creation failed, try again");

    try {
      await waitForSessionOpen(digits, 22_000);
    } catch (e) {
      console.warn(`[pair] waitForSessionOpen: ${e.message}`); // requestPairingCode may still work
    }

    if (typeof sock.requestPairingCode !== "function") {
      throw new Error("Pairing not supported — socket version may be outdated");
    }
    const rawCode = await sock.requestPairingCode(digits, PAIR_CODE);
    if (!rawCode) throw new Error("No pair code returned");

    await sendCode(message, digits, fmtCode(rawCode));
    await message.react?.("✅");
  } catch (err) {
    console.error("[pair] failed:", err?.message || err);
    await message.react?.("❌");
    await message.send(
      `-!!•- Pairing failed •۵♡༏༏ ❌\n\n` +
        `-!!•- Number •۵♡༏༏: +${digits} 📱\n` +
        `-!!•- Reason •۵♡༏༏: ${String(err?.message || err)}\n\n` +
        `-!!•- Try again with .pair ${digits} 🔁`
    );
  } finally {
    inFlight--;
  }
});
