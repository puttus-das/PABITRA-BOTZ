import axios from "axios";
import { Module } from "../lib/plugins.js";

// ─── .video <name or YouTube URL> ─────────────────────────────────────────────
// API: https://api.sayan-nexuswork.workers.dev/video?query=<text>
// Sends ONLY the video (with the VCard quote + "*━( 𝐏ᴀʙɪᴛʀᴀ - 𝐁ᴏᴛ⎯꯭̽💜 )━*" caption). No extra messages.

const API = "https://api.sayan-nexuswork.workers.dev/video";
const CAPTION = "*━( 𝐏ᴀʙɪᴛʀᴀ - 𝐁ᴏᴛ⎯꯭̽💜 )━*";
const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36";

const URL_KEYS = ["download", "downloadurl", "download_url", "dl", "video", "videourl", "video_url", "mp4", "url", "link", "result"];
const TITLE_KEYS = ["title", "name", "filename"];

const isHttp = (v) => typeof v === "string" && /^https?:\/\//i.test(v);
const isImage = (v) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(v) || /ytimg\.com/i.test(v);
const isYtPage = (v) => /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(v);

function flatten(obj, prefix = "", out = []) {
  if (obj == null) return out;
  if (typeof obj === "string" || typeof obj === "number") out.push([prefix.toLowerCase(), obj]);
  else if (Array.isArray(obj)) obj.forEach((v, i) => flatten(v, `${prefix}.${i}`, out));
  else if (typeof obj === "object") for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}
const lastKey = (p) => p.split(".").filter((s) => !/^\d+$/.test(s)).pop() || "";

function extractVideo(json) {
  const flat = flatten(json);
  const ok = (v) => isHttp(v) && !isImage(v) && !isYtPage(v);
  let url = null;
  for (const key of URL_KEYS) {
    const hit = flat.find(([p, v]) => lastKey(p) === key && ok(v));
    if (hit) { url = hit[1]; break; }
  }
  if (!url) url = flat.find(([, v]) => ok(v))?.[1] || null;
  let title = null;
  for (const key of TITLE_KEYS) {
    const hit = flat.find(([p, v]) => lastKey(p) === key && typeof v === "string" && !isHttp(v));
    if (hit) { title = hit[1]; break; }
  }
  return { url, title };
}

async function getBuffer(url, tries = 4) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 120_000,
        headers: { "User-Agent": UA },
        maxContentLength: 120 * 1024 * 1024,
      });
      const buf = Buffer.from(res.data);
      if (buf.length < 20_000) throw new Error(`file too small (${buf.length} bytes)`);
      return buf;
    } catch (err) {
      lastErr = err;
      console.error(`[VIDEO:DL] try ${i}/${tries}: ${err?.message || err}`);
      if (i < tries) await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw lastErr;
}

async function fetchVideo(query) {
  const res = await axios.get(API, {
    params: { query },
    responseType: "arraybuffer",
    timeout: 120_000,
    headers: { "User-Agent": UA, Accept: "application/json, video/*" },
    validateStatus: () => true,
  });
  const type = String(res.headers["content-type"] || "");
  const raw = Buffer.from(res.data);

  // the API sent the video file itself
  if (/^video\//i.test(type) || /octet-stream/i.test(type)) return { buffer: raw, title: null };

  let json;
  try {
    json = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new Error(`API sent an unreadable response (HTTP ${res.status})`);
  }
  const { url, title } = extractVideo(json);
  if (!url) {
    const msg = json?.message || json?.error || json?.response?.message;
    throw new Error(msg ? String(msg) : "API did not return a video link");
  }
  return { buffer: await getBuffer(url), title };
}

Module({
  command: "video",
  aliases: ["vid"],
  package: "downloader",
  description: "Download a video by name or YouTube URL",
})(async (message, match) => {
  const query = (match || "").trim();
  if (!query) {
    return message.conn.sendMessage(
      message.from,
      { text: "*ᴜꜱᴀɢᴇ:* .video <ɴᴀᴍᴇ ᴏʀ ʏᴏᴜᴛᴜʙᴇ ᴜʀʟ>" },
      { quoted: message.gift }
    );
  }
  try {
    const { buffer, title } = await fetchVideo(query);
    const fileName = `${(title || "video").replace(/[\\/:*?"<>|]/g, "").slice(0, 60) || "video"}.mp4`;
    try {
      await message.conn.sendMessage(
        message.from,
        { video: buffer, mimetype: "video/mp4", caption: CAPTION },
        { quoted: message.gift }
      );
    } catch (e) {
      // too big for a video message / upload problem → send the same file as a document
      console.error("[VIDEO:SEND] video failed, sending as document:", e?.message || e);
      await message.conn.sendMessage(
        message.from,
        { document: buffer, mimetype: "video/mp4", fileName, caption: CAPTION },
        { quoted: message.gift }
      );
    }
  } catch (err) {
    console.error("[VIDEO]", err?.message || err);
    await message.conn.sendMessage(
      message.from,
      { text: `⚠️ ${err?.message || "video failed"}\n\n${CAPTION}` },
      { quoted: message.gift }
    );
  }
});
