import axios from "axios";
import config from "../config.js";
import { Module } from "../lib/plugins.js";

// ─── .play / .song <song name or YouTube URL> ────────────────────────────────
// No buttons, no card: the MP3 is sent straight away as a normal audio message,
// quoted on the Pabitra-Paul VCard (message.gift).

const RABBIT = (process.env.RABBIT_API_BASE || "https://rabbitapi.zone.id").replace(/\/+$/, "");
const MUSIC_API = process.env.MUSIC_API || "https://api.sayan-nexuswork.workers.dev/music";
const CAPTION = "© 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ";
const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36";

// ── font: first letter 𝐁𝐨𝐥𝐝, rest ꜱᴍᴀʟʟ-ᴄᴀᴘꜱ ──
const SC = { a:"ᴀ",b:"ʙ",c:"ᴄ",d:"ᴅ",e:"ᴇ",f:"ꜰ",g:"ɢ",h:"ʜ",i:"ɪ",j:"ᴊ",k:"ᴋ",l:"ʟ",m:"ᴍ",n:"ɴ",o:"ᴏ",p:"ᴘ",q:"ǫ",r:"ʀ",s:"ꜱ",t:"ᴛ",u:"ᴜ",v:"ᴠ",w:"ᴡ",x:"x",y:"ʏ",z:"ᴢ" };
const boldCap = (ch) => String.fromCodePoint(0x1d400 + (ch.toUpperCase().charCodeAt(0) - 65));
const fancy = (t) =>
  String(t).replace(/[A-Za-z]+/g, (w) => boldCap(w[0]) + [...w.slice(1)].map((c) => SC[c.toLowerCase()] ?? c).join(""));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms, label) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timed out`)), ms))]);
const isHttp = (v) => typeof v === "string" && /^https?:\/\//i.test(v);
const isImage = (v) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(v) || /ytimg\.com/i.test(v);

// videoId → { title, url(mp3), ... }  (so the Audio button does not need another API call)
const cache = new Map();
const TTL = 30 * 60 * 1000;
const remember = (id, info) => {
  cache.set(id, { ...info, at: Date.now() });
  for (const [k, v] of cache) if (Date.now() - v.at > TTL) cache.delete(k);
};

// ── Rabbit /api/play ──
async function rabbitPlay(q) {
  const res = await axios.get(`${RABBIT}/api/play`, {
    params: { q },
    timeout: 90_000,
    headers: { "User-Agent": UA },
    validateStatus: () => true,
  });
  const j = res.data || {};
  const r = j.result;
  if (!(j.status === true || j.status === "success") || !r || !isHttp(r.url)) {
    throw new Error(j.message || j.error || "Song not found");
  }
  return {
    title: r.title || "Unknown",
    videoId: r.videoId || null,
    duration: r.duration || "N/A",
    views: r.views || "N/A",
    uploaded: r.uploaded || "N/A",
    channel: (typeof r.author === "string" ? r.author : r.author?.name) || r.channel || null,
    thumbnail: r.thumbnail || null,
    url: r.url,
    source: "rabbit",
  };
}

// ── sayan-nexuswork /music?query=  (new API: title, duration, views, channel, thumbnail, url) ──
const firstOf = (objs, keys) => {
  for (const o of objs) {
    if (!o || typeof o !== "object") continue;
    for (const k of keys) if (o[k] != null && o[k] !== "") return o[k];
  }
  return null;
};
async function sayanMusic(query) {
  const res = await axios.get(MUSIC_API, {
    params: { query },
    timeout: 90_000,
    headers: { "User-Agent": UA },
    validateStatus: () => true,
  });
  const j = res.data && typeof res.data === "object" ? res.data : {};
  const scopes = [j, j.result, j.data];
  let link = firstOf(scopes, ["url", "download", "download_url", "downloadUrl", "audio", "link", "mp3"]);
  if (!isHttp(link) || isImage(link)) {
    // last resort: any http link in the answer that is not an image
    const found = [];
    const walk = (o) => {
      if (typeof o === "string") { if (isHttp(o) && !isImage(o)) found.push(o); }
      else if (o && typeof o === "object") Object.values(o).forEach(walk);
    };
    walk(j);
    link = found[0] || null;
  }
  if (!link) throw new Error(j.message || j.error || "Song not found");
  const thumbnail = firstOf(scopes, ["thumbnail", "thumb", "image", "cover"]);
  const videoId =
    firstOf(scopes, ["videoId", "video_id", "id"]) ||
    /\/vi(?:_webp)?\/([\w-]{11})\//.exec(String(thumbnail || ""))?.[1] ||
    null;
  const author = firstOf(scopes, ["channel", "author", "artist", "uploader"]);
  return {
    title: String(firstOf(scopes, ["title", "name"]) || "Unknown"),
    videoId: videoId && String(videoId).length <= 24 ? String(videoId) : null,
    duration: String(firstOf(scopes, ["duration", "timestamp"]) || "N/A"),
    views: String(firstOf(scopes, ["views", "view_count"]) || "N/A"),
    uploaded: String(firstOf(scopes, ["uploaded", "published", "ago", "uploadDate"]) || "N/A"),
    channel: author ? String(typeof author === "object" ? author.name || "" : author) || null : null,
    thumbnail: isHttp(thumbnail) ? thumbnail : null,
    url: link,
    source: "sayan",
  };
}

// Rabbit /api/play is the primary provider; Sayan is a fallback because it can
// intermittently return HTTP 404/500 or an expired audio URL.
async function getInfo(q) {
  try {
    return await rabbitPlay(q);
  } catch (e) {
    console.error("[PLAY] Rabbit failed, trying Sayan:", e?.message || e);
    return sayanMusic(q);
  }
}

// Rabbit /api/song as a last-resort audio source (any http link in the answer that is not an image / YouTube page)
async function rabbitSongUrl(q) {
  const res = await axios.get(`${RABBIT}/api/song`, {
    params: { q },
    timeout: 90_000,
    headers: { "User-Agent": UA },
    validateStatus: () => true,
  });
  const found = [];
  const walk = (o) => {
    if (typeof o === "string") {
      if (isHttp(o) && !isImage(o) && !/youtube\.com|youtu\.be/i.test(o)) found.push(o);
    } else if (o && typeof o === "object") Object.values(o).forEach(walk);
  };
  walk(res.data);
  if (!found.length) throw new Error("song link not found");
  return found[0];
}

async function fetchBuffer(url, { tries = 4, timeout = 120_000, min = 1000 } = {}) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout,
        headers: { "User-Agent": UA },
        maxContentLength: 120 * 1024 * 1024,
      });
      const buf = Buffer.from(res.data);
      if (buf.length < min) throw new Error(`file too small (${buf.length} bytes)`);
      return buf;
    } catch (err) {
      lastErr = err;
      console.error(`[PLAY:DL] try ${i}/${tries}: ${err?.message || err}`);
      if (i < tries) await sleep(2500);
    }
  }
  throw lastErr;
}

// ── .play / .song ──
Module({
  command: "play",
  aliases: ["song", "yta", "ytmp3"],
  package: "downloader",
  description: "Search YouTube and get the song as audio",
})(async (message, match) => {
  const q = (match || "").trim();
  const reply = (text) => message.conn.sendMessage(message.from, { text }, { quoted: message.gift });
  if (!q) return reply(`*${fancy("usage")}:* ${config.prefix}play <${fancy("song name or youtube url")}>`);
  try {
    try { await message.react("🎵"); } catch (_) {}
    const r = await getInfo(q);
    const id = r.videoId || Date.now().toString(36);
    remember(id, r);
    await sendAudio(message, id);
  } catch (err) {
    console.error("[PLAY]", err?.message || err);
    await reply(`⚠️ ${err?.message || "play failed"}\n\n${CAPTION}`);
  }
});

async function sendAudio(message, id) {
  const info = cache.get(id);
  let title = info?.title || "audio";
  let buf = null;

  const attempts = [];
  if (info?.url) attempts.push(["card link", async () => info.url]);
  const realId = /^[\w-]{11}$/.test(id);
  if (realId && info?.source !== "sayan") {
    attempts.push(["music API", async () => (await sayanMusic(`https://youtu.be/${id}`)).url]);
  }
  if (realId && info?.source !== "rabbit") {
    attempts.push(["Rabbit play", async () => (await rabbitPlay(`https://youtu.be/${id}`)).url]);
  }
  if (realId) attempts.push(["Rabbit song", async () => rabbitSongUrl(`https://youtu.be/${id}`)]);

  let lastErr;
  for (const [name, getUrl] of attempts) {
    try {
      const url = await getUrl();
      buf = await fetchBuffer(url, { tries: 2, min: 20_000 });
      break;
    } catch (e) {
      lastErr = e;
      console.error(`[PLAY:AUDIO] ${name} failed: ${e?.message || e}`);
    }
  }
  if (!buf) throw lastErr || new Error("audio failed");

  await message.conn.sendMessage(
    message.from,
    {
      audio: buf,
      mimetype: "audio/mpeg",
      ptt: false,
      fileName: `${title.replace(/[\\/:*?"<>|]/g, "").slice(0, 60) || "audio"}.mp3`,
    },
    { quoted: message.gift }
  );
}
