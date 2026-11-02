import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  proto,
  generateWAMessageFromContent,
  prepareWAMessageMedia,
} from "baileys";
import config from "../config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOT_IMAGE_PATH = path.join(__dirname, "..", "plugins", "bin", "tg_dp.jpg");
let botImageBuffer;
const preparedImages = new WeakMap();

function getBotImage() {
  try {
    if (!botImageBuffer) botImageBuffer = fs.readFileSync(BOT_IMAGE_PATH);
    return botImageBuffer;
  } catch {
    return null;
  }
}

async function prepareImage(conn, image) {
  if (!image || typeof conn?.waUploadToServer !== "function") return null;
  let cached = preparedImages.get(conn);
  if (cached && Date.now() - cached.createdAt < 30 * 60 * 1000) return cached.imageMessage;
  try {
    const prepared = await prepareWAMessageMedia({ image }, { upload: conn.waUploadToServer });
    cached = { imageMessage: prepared.imageMessage, createdAt: Date.now() };
    preparedImages.set(conn, cached);
    return cached.imageMessage;
  } catch (error) {
    console.error("[buttonCards] image preparation failed:", error?.message || error);
    return null;
  }
}

function compactButton(button) {
  if (!button?.buttonParamsJson) return button;
  try {
    const params = JSON.parse(button.buttonParamsJson);
    const label = String(params.display_text || "")
      .replace(/[━⎯]+/g, "")
      .replace(/[\[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (label) params.display_text = [...label].slice(0, 18).join("");
    return { ...button, buttonParamsJson: JSON.stringify(params) };
  } catch {
    return button;
  }
}

/** Send all supplied quick actions together in one compact interactive message. */
export async function sendButtonCard({
  conn,
  jid,
  buttons = [],
  body = "Choose an option",
  footer = config.brandLine,
  quoted,
  userJid,
  image,
}) {
  if (!conn || !jid || !Array.isArray(buttons) || buttons.length === 0) return [];

  const P = proto.Message.InteractiveMessage;
  const imageMessage = await prepareImage(conn, image);
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
  if (!String(jid).endsWith("@g.us")) {
    bizNodes.push({ tag: "bot", attrs: { biz_bot: "1" } });
  }

  const msg = generateWAMessageFromContent(
    jid,
    {
      viewOnceMessage: {
        message: {
          messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
          interactiveMessage: P.create({
            body: P.Body.create({ text: body }),
            footer: P.Footer.create({ text: footer }),
            header: P.Header.create({
              hasMediaAttachment: !!imageMessage,
              ...(imageMessage ? { imageMessage } : {}),
            }),
            nativeFlowMessage: P.NativeFlowMessage.create({
              buttons: buttons.map(compactButton),
            }),
          }),
        },
      },
    },
    { ...(quoted ? { quoted } : {}), userJid: userJid || conn.user?.id }
  );
  await conn.relayMessage(jid, msg.message, {
    messageId: msg.key.id,
    additionalNodes: bizNodes,
  });
  return [msg.key.id];
}

export function audioButton(prefix = config.prefix || ".") {
  return {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({ display_text: "🎧 Audio", id: `${prefix}audio` }),
  };
}

export async function sendAudioButtonCard(conn, jid, { quoted, body = "🎧 Audio" } = {}) {
  return sendButtonCard({
    conn,
    jid,
    buttons: [audioButton()],
    body,
    footer: config.brandLine,
    quoted,
    image: getBotImage(),
  });
}
