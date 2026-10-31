// lib/connectCards.js — cards sent when a bot connects on WhatsApp
//  • activated card  : image + "Bot is activated by Puttus-Bot" + [Menu] [Owner] [Pair Code]
//  • connected card  : image + "Bot connected successfully" + [Pair Code]
// Tapping the picture opens the owner's inbox (externalAdReply → wa.me/<owner>).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { proto, generateWAMessageFromContent } from "baileys";
import config from "../config.js";
import { fancyText } from "./fancy.js";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "plugins", "bin", "connect");
const PAIR_URL = process.env.PAIR_LINK || "https://t.me/PABITRA_BOTZ";
const ownerUrl = () => `https://wa.me/${String(config.owner).replace(/\D/g, "")}`;
const readImg = (name) => {
  try {
    return fs.readFileSync(path.join(DIR, name));
  } catch {
    return null;
  }
};

const urlButton = (label, url) => ({
  name: "cta_url",
  buttonParamsJson: JSON.stringify({ display_text: label, url, merchant_url: url }),
});
const pairButton = () => urlButton("━[ 𝐏ᴀɪʀ 𝐂ᴏᴅᴇ ]━", PAIR_URL);

async function sendCard(sock, jid, { text, buttons, image }) {
  const thumb = readImg("pabitra-v17.jpg") || readImg(image);
  // The picture and caption are one WhatsApp message (not only a tiny preview thumbnail).
  if (thumb) {
    await sock.sendMessage(jid, { image: thumb, caption: text, mimetype: "image/jpeg" });
  } else {
    await sock.sendMessage(jid, { text });
  }
  // Preserve all existing interactive actions in a separate button card.
  const P = proto.Message.InteractiveMessage;
  const msg = generateWAMessageFromContent(jid, {
    viewOnceMessage: { message: {
      messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
      interactiveMessage: P.create({
        body: P.Body.create({ text: "━[ 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ ]━ 💜" }),
        footer: P.Footer.create({ text: "𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ" }),
        header: P.Header.create({ hasMediaAttachment: false }),
        nativeFlowMessage: P.NativeFlowMessage.create({ buttons }),
      }),
    } },
  }, { userJid: sock.user?.id });
  const bizNodes = [{ tag: "biz", attrs: {}, content: [{ tag: "interactive", attrs: { type: "native_flow", v: "1" }, content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }] }] }];
  if (!jid.endsWith("@g.us")) bizNodes.push({ tag: "bot", attrs: { biz_bot: "1" } });
  await sock.relayMessage(jid, msg.message, { messageId: msg.key.id, additionalNodes: bizNodes });
}

/** first login: branded image + activated text + Menu / Owner / Pair Code */
export function sendActivatedCard(sock, jid, prefix = ".") {
  return sendCard(sock, jid, {
    image: "activated.jpg",
    text: `*${fancyText("Bot is activated by PABITRA-BOT")}*`,
    buttons: [
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({ display_text: "━[ 𝐌ᴇɴᴜ ]━", id: `${prefix}menu` }),
      },
      urlButton("━[ 𝐎ᴡɴᴇʀ ]━", ownerUrl()),
      pairButton(),
    ],
  });
}

/** "Bot connected successfully" — image 2 + small Pair Code button */
export function sendConnectedCard(sock, jid, digits) {
  return sendCard(sock, jid, {
    image: "connected.jpg",
    text:
      `-!!•- 𝐁ᴏᴛ ᴄᴏɴɴᴇᴄᴛᴇᴅ sᴜᴄᴄᴇssғᴜʟʟʏ •۵♡༏༏ ✅\n\n` +
      `-!!•- ɴᴜᴍʙᴇʀ •۵♡༏༏: +${digits} 📱\n` +
      `-!!•- ᴛʜᴇ ʙᴏᴛ ɪs ɴᴏᴡ ᴏɴʟɪɴᴇ ᴀɴᴅ ʀᴇᴀᴅʏ ᴛᴏ ᴜsᴇ •۵♡༏༏ 🤖\n\n` +
      `*𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ* 💜`,
    buttons: [pairButton()],
  });
}

/**
 * Send the "connected" card everywhere it belongs:
 *  • the connected number's own inbox (new session)
 *  • the chat where .pair was requested — DM or group (requesting bot)
 *  • the person's personal inbox (requesting bot), if that is a different chat
 */
export async function sendConnectedEverywhere(newSock, selfJid, digits, info) {
  const sent = new Set();
  const trySend = async (sock, jid) => {
    if (!sock || !jid) return;
    const key = `${sock === newSock ? "new" : "req"}:${jid}`;
    if (sent.has(key)) return;
    sent.add(key);
    try {
      await sendConnectedCard(sock, jid, digits);
    } catch (e) {
      console.error(`[connectCards] send to ${jid} failed:`, e?.message || e);
    }
  };
  await trySend(newSock, selfJid);
  if (info?.sock) {
    await trySend(info.sock, info.chat);
    await trySend(info.sock, `${digits}@s.whatsapp.net`);
  }
}
