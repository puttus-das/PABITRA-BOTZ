import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import { Jimp } from "jimp";
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
  let thumbnail = image;
  try {
    if (Buffer.isBuffer(image) || image instanceof Uint8Array) {
      const bitmap = await Jimp.read(image);
      const { width, height } = bitmap.bitmap;
      const scale = Math.min(1, 640 / Math.max(width, height));
      if (scale < 1) {
        bitmap.resize({ w: Math.max(1, Math.round(width * scale)), h: Math.max(1, Math.round(height * scale)) });
      }
      thumbnail = await bitmap.getBuffer("image/jpeg", { quality: 78 });
    }
  } catch (error) {
    console.warn("[buttonCards] thumbnail conversion skipped:", error?.message || error);
  }
  const key = createHash("sha1").update(Buffer.isBuffer(thumbnail) ? thumbnail : Buffer.from(String(thumbnail))).digest("hex");
  let cache = preparedImages.get(conn);
  if (!cache) {
    cache = new Map();
    preparedImages.set(conn, cache);
  }
  const cached = cache.get(key);
  if (cached && Date.now() - cached.createdAt < 30 * 60 * 1000) return cached.imageMessage;
  try {
    const prepared = await prepareWAMessageMedia({ image: thumbnail }, { upload: conn.waUploadToServer });
    cache.set(key, { imageMessage: prepared.imageMessage, createdAt: Date.now() });
    while (cache.size > 12) cache.delete(cache.keys().next().value);
    return prepared.imageMessage;
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

export function ownerContactButton() {
  const phone = String(config.owner || "919641092392").replace(/\D/g, "");
  const url = `https://wa.me/${phone}`;
  return {
    name: "cta_url",
    buttonParamsJson: JSON.stringify({ display_text: "📩 Contact Owner", url, merchant_url: url }),
  };
}

export async function sendAudioButtonCard(conn, jid, { quoted, body = "🎧 Audio" } = {}) {
  return sendButtonCard({
    conn,
    jid,
    buttons: [audioButton(), ownerContactButton()],
    body,
    footer: config.brandLine,
    quoted,
    image: getBotImage(),
  });
}
