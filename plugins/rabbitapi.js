import axios from "axios";
import FormData from "form-data";
import { Module } from "../lib/plugins.js";

const BASE = "https://rabbitapi.zone.id";
const TIMEOUT = 60_000;
const clean = (value) => String(value || "").trim();
const isOwner = (message) => !!(message?.isfromMe || message?.isFromMe);

function responseError(data, fallback) {
  return data?.message || data?.error || data?.detail || fallback;
}

function getMediaMessage(message) {
  if (message?.quoted?.download) return message.quoted;
  if (message?.download && /^imageMessage|videoMessage|audioMessage|documentMessage|stickerMessage$/.test(message.type || "")) return message;
  return null;
}

function extensionFor(media) {
  const mime = media?.content?.mimetype || media?.msg?.mimetype || "";
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("gif")) return ".gif";
  if (mime.includes("video")) return ".mp4";
  if (mime.includes("audio")) return ".mp3";
  return ".jpg";
}

async function downloadMedia(message) {
  const media = getMediaMessage(message);
  if (!media) return null;
  const buffer = await media.download();
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  const mime = media?.content?.mimetype || media?.msg?.mimetype || "image/jpeg";
  return { buffer, mime, ext: extensionFor(media) };
}

Module({
  command: "upload",
  aliases: ["rabbitupload", "rupload"],
  package: "rabbitapi",
  description: "Upload replied media to Rabbit CDN",
  usage: ".upload (reply to media)",
})(async (message) => {
  try {
    const media = await downloadMedia(message);
    if (!media) return message.send("_Reply to an image, video, audio, or document with .upload_");
    if (media.buffer.length > 100 * 1024 * 1024) return message.send("_File too large (maximum 100 MB)_");
    await message.react?.("⏳");
    const form = new FormData();
    form.append("file", media.buffer, { filename: `rabbit-${Date.now()}${media.ext}`, contentType: media.mime });
    const { data } = await axios.post(`${BASE}/api/upload`, form, {
      headers: form.getHeaders(), timeout: TIMEOUT, maxContentLength: Infinity, maxBodyLength: Infinity,
    });
    if (data?.success === false || (!data?.url && !data?.result?.url)) throw new Error(responseError(data, "Upload failed"));
    const url = data.url || data.result?.url || data.result?.link;
    await message.send(`*Rabbit Upload Success*\n\n🔗 ${url}`);
    await message.react?.("✅");
  } catch (error) {
    console.error("[rabbitapi:upload]", error?.message || error);
    await message.react?.("❌");
    await message.send(`❌ Upload failed: ${responseError(error?.response?.data, error?.message || "API request failed")}`);
  }
});

Module({
  command: "shorten",
  aliases: ["rshort", "rabbitshort"],
  package: "rabbitapi",
  description: "Shorten a URL with RabbitXMD",
  usage: ".shorten https://example.com",
})(async (message, match) => {
  try {
    const url = clean(match || message.quoted?.text || message.quoted?.body);
    if (!/^https?:\/\//i.test(url)) return message.send("_Usage: .shorten https://example.com_");
    await message.react?.("⏳");
    const { data } = await axios.get(`${BASE}/api/shorten`, { params: { url }, timeout: TIMEOUT });
    if (data?.success === false) throw new Error(responseError(data, "Could not shorten URL"));
    const short = data?.result?.url || data?.result?.short || data?.url || data?.short;
    if (!short) throw new Error(responseError(data, "Shortener returned no URL"));
    await message.send(`*Rabbit Short URL*\n\n🔗 ${short}\n\n_Original:_ ${data?.result?.original || url}`);
    await message.react?.("✅");
  } catch (error) {
    console.error("[rabbitapi:shorten]", error?.message || error);
    await message.react?.("❌");
    await message.send(`❌ Shorten failed: ${responseError(error?.response?.data, error?.message || "API request failed")}`);
  }
});

Module({
  command: "fullpp",
  aliases: ["rabbitpp"],
  package: "rabbitapi",
  description: "Set a replied image as WhatsApp full profile picture",
  usage: ".fullpp <WhatsApp number> (reply to image)",
})(async (message, match) => {
  if (!isOwner(message)) return message.send("_This command is for the owner only_");
  try {
    const phone = clean(match).replace(/\D/g, "");
    if (!/^[0-9]{7,15}$/.test(phone)) return message.send("_Usage: .fullpp 919xxxxxxxxx (reply to an image)_");
    const media = await downloadMedia(message);
    if (!media || !media.mime.startsWith("image/")) return message.send("_Reply to an image with .fullpp <number>_");
    await message.react?.("⏳");
    const imageBase64 = `data:${media.mime};base64,${media.buffer.toString("base64")}`;
    const { data } = await axios.post(`${BASE}/api/neuropair/pair`, { phone, imageBase64 }, { timeout: TIMEOUT });
    if (!data?.success || !data?.pair_code) throw new Error(responseError(data, "Full-PP pairing failed"));
    await message.send(`*Rabbit Full PP*\n\n📱 Number: ${phone}\n🔐 Pair code: *${data.pair_code}*\n\nWhatsApp → Linked devices → Link a device → Link with phone number, then enter this code.\n\n_The service will update the profile picture after pairing._`);
    await message.react?.("✅");
  } catch (error) {
    console.error("[rabbitapi:fullpp]", error?.message || error);
    await message.react?.("❌");
    await message.send(`❌ Full-PP failed: ${responseError(error?.response?.data, error?.message || "API request failed")}`);
  }
});
