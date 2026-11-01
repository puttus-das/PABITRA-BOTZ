// Shared ping logic — used by .ping command AND the menu's PING button.
// The pong is a vCard-quoted card with an ━[ Audio ]━ button under it:
// tapping it sends one random song from plugins/bin/audio_urls.json (.audio).
import { proto, generateWAMessageFromContent } from "baileys";
import config from "../config.js";

const EMOJIS = ["⛅","👻","⛄","👀","🪁","🪃","🎳","🎀","🌸","🍥","🍓","🍡","💗","🦋","💫","💀","☁️","🌨️","🌧️","🌦️","🌥️","🪹","⚡","🌟","🎐","🏖️","🪺","🌊","🐚","🪸","🍒","🍇","🍉","🌻","🎢","🚀","🍫","💎","🌋","🏔️","⛰️","🌙","🪐","🌲","🍃","🍂","🍁","🪵","🍄","🌿","🐞","🐍","🕊️","🎃","🏟️","🎡","🥂","🗿","⛩️"];

export async function sendPing(message) {
  const start = Date.now();
  // react is best-effort: it must NEVER stop the pong (reacting to a button-tap message can fail)
  try {
    await message.react(EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
  } catch (_) {}
  const ping = Date.now() - start;
  const text = `*━[ 𝐏ᴀʙɪᴛʀᴀ - ${ping} 𝐁ᴏᴛ⎯꯭̽💜 ]━*`;
  const prefix = config.prefix || ".";

  // 1) pong card with the Audio button (vCard quote = message.gift)
  try {
    const P = proto.Message.InteractiveMessage;
    const bizNodes = [
      {
        tag: "biz",
        attrs: {},
        content: [
          {
            tag: "interactive",
            attrs: { type: "native_flow", v: "1" },
            content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }],
          },
        ],
      },
    ];
    if (!message.from.endsWith("@g.us")) bizNodes.push({ tag: "bot", attrs: { biz_bot: "1" } });

    const msg = generateWAMessageFromContent(
      message.from,
      {
        viewOnceMessage: {
          message: {
            messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
            interactiveMessage: P.create({
              body: P.Body.create({ text }),
              footer: P.Footer.create({ text: config.ownerName }),
              header: P.Header.create({ hasMediaAttachment: false }),
              contextInfo: { mentionedJid: [message.sender] },
              nativeFlowMessage: P.NativeFlowMessage.create({
                buttons: [
                  {
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({ display_text: "━[ 𝐀ᴜᴅɪᴏ ]━", id: `${prefix}audio` }),
                  },
                ],
              }),
            }),
          },
        },
      },
      { quoted: message.gift, userJid: message.conn.user?.id }
    );
    await message.conn.relayMessage(message.from, msg.message, {
      messageId: msg.key.id,
      additionalNodes: bizNodes,
    });
    return;
  } catch (e) {
    console.error("[ping] button card failed, sending plain pong:", e?.message || e);
  }

  // 2) fallback: plain pong
  const payload = { text, contextInfo: { mentionedJid: [message.sender] } };
  try {
    await message.conn.sendMessage(message.from, payload, { quoted: message.gift });
  } catch (e) {
    console.error("[ping] quoted send failed, retrying plain:", e?.message || e);
    await message.conn.sendMessage(message.from, payload);
  }
}
