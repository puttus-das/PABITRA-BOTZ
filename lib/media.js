import axios from "axios";

// Shared song / video helpers (used by the Telegram bot in bot.js).
// APIs: Rabbit /api/play, sayan-nexuswork /music + /video, Spotify (jerrycoder) — same ones the WhatsApp plugins use.

export const CAPTION = "© 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ";

const RABBIT = (process.env.RABBIT_API_BASE || "https://rabbitapi.zone.id").replace(/\/+$/, "");
const MUSIC_API = process.env.MUSIC_API || "https://api.sayan-nexuswork.workers.dev/music";
const VIDEO_API = process.env.VIDEO_API || "https://api.sayan-nexuswork.workers.dev/video";
const SPOTIFY_API = process.env.SPOTIFY_API || "https://jerrycoder.oggyapi.workers.dev/down/spotify";
const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36";

// ── font: first letter 𝐁𝐨𝐥𝐝, rest ꜱᴍᴀʟʟ-ᴄᴀᴘꜱ ──
const SC = { a:"ᴀ",b:"ʙ",c:"ᴄ",d:"ᴅ",e:"ᴇ",f:"ꜰ",g:"ɢ",h:"ʜ",i:"ɪ",j:"ᴊ",k:"ᴋ",l:"ʟ",m:"ᴍ",n:"ɴ",o:"ᴏ",p:"ᴘ",q:"ǫ",r:"ʀ",s:"ꜱ",t:"ᴛ",u:"ᴜ",v:"ᴠ",w:"ᴡ",x:"x",y:"ʏ",z:"ᴢ" };
const boldCap = (ch) => String.fromCodePoint(0x1d400 + (ch.toUpperCase().charCodeAt(0) - 65));
export const fancy = (t) =>
  String(t).replace(/[A-Za-z]+/g, (w) => boldCap(w[0]) + [...w.slice(1)].map((c) => SC[c.toLowerCase()] ?? c).join(""));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isHttp = (v) => typeof v === "string" && /^https?:\/\//i.test(v);
const isImage = (v) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(v) || /ytimg\.com|i\.scdn\.co/i.test(v);
const isSpotifyPage = (v) => /^https?:\/\/(open|play)\.spotify\.com\//i.test(v);
const isYtPage = (v) => /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(v);

export async function fetchBuffer(url, { tries = 3, timeout = 90_000, min = 1000 } = {}) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout,
        headers: { "User-Agent": UA },
        maxContentLength: 49 * 1024 * 1024, // Telegram bots can upload up to 50 MB
      });
      const buf = Buffer.from(res.data);
      if (buf.length < min) throw new Error(`file too small (${buf.length} bytes)`);
      return buf;
    } catch (err) {
      lastErr = err;
      console.error(`[media:DL] try ${i}/${tries}: ${err?.message || err}`);
      if (i < tries) await sleep(2000);
    }
  }
  throw lastErr;
}

// ── generic JSON understanding ──
function flatten(obj, prefix = "", out = []) {
  if (obj == null) return out;
  if (typeof obj === "string" || typeof obj === "number") out.push([prefix.toLowerCase(), obj]);
  else if (Array.isArray(obj)) obj.forEach((v, i) => flatten(v, `${prefix}.${i}`, out));
  else if (typeof obj === "object") for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}
const lastKey = (p) => p.split(".").filter((s) => !/^\d+$/.test(s)).pop() || "";
const pickKey = (flat, keys, test = () => true) => {
  for (const k of keys) {
    const hit = flat.find(([p, v]) => lastKey(p) === k && test(v));
    if (hit) return hit[1];
  }
  return null;
};
function parseSong(json) {
  const flat = flatten(json);
  const ok = (v) => isHttp(v) && !isSpotifyPage(v) && !isImage(v);
  const audio =
    pickKey(flat, ["download", "downloadurl", "download_url", "dl", "audio", "audiourl", "audio_url", "mp3", "link", "url", "result"], ok) ||
    flat.find(([, v]) => ok(v))?.[1] ||
    null;
  const title = pickKey(flat, ["title", "name", "track", "song"], (v) => typeof v === "string" && !isHttp(v));
  const artist =
    pickKey(flat, ["artist", "artists", "author", "singer", "channel"], (v) => typeof v === "string" && !isHttp(v)) ||
    flat.find(([p, v]) => /(artist|author)/.test(p) && typeof v === "string" && !isHttp(v))?.[1] ||
    null;
  const cover = pickKey(flat, ["cover", "image", "thumbnail", "thumb", "poster", "albumcover"], isHttp);
  return { audio, title, artist, cover };
}
async function askApi(api, params, timeout = 25_000) {
  const res = await axios.get(api, {
    params,
    timeout,
    headers: { "User-Agent": UA, Accept: "application/json, audio/*" },
    responseType: "arraybuffer",
    validateStatus: () => true,
  });
  const raw = Buffer.from(res.data);
  if (/^audio\//i.test(String(res.headers["content-type"] || ""))) return { buffer: raw, title: null, artist: null, cover: null };
  let json;
  try {
    json = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new Error(`unreadable answer (HTTP ${res.status})`);
  }
  const song = parseSong(json);
  if (!song.audio) throw new Error(String(json?.message || json?.error || json?.msg || `no download link (HTTP ${res.status})`));
  return song;
}

// ── .play / .song details ──
const cache = new Map(); // videoId → info
const TTL = 30 * 60 * 1000;
export const remember = (id, info) => {
  cache.set(id, { ...info, at: Date.now() });
  for (const [k, v] of cache) if (Date.now() - v.at > TTL) cache.delete(k);
};
export const recall = (id) => cache.get(id);

const firstOf = (objs, keys) => {
  for (const o of objs) {
    if (!o || typeof o !== "object") continue;
    for (const k of keys) if (o[k] != null && o[k] !== "") return o[k];
  }
  return null;
};

export async function rabbitPlay(q) {
  const res = await axios.get(`${RABBIT}/api/play`, { params: { q }, timeout: 90_000, headers: { "User-Agent": UA }, validateStatus: () => true });
  const j = res.data || {};
  const r = j.result;
  if (!(j.status === true || j.status === "success") || !r || !isHttp(r.url)) throw new Error(j.message || j.error || "Song not found");
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

export async function sayanMusic(query) {
  const res = await axios.get(MUSIC_API, { params: { query }, timeout: 90_000, headers: { "User-Agent": UA }, validateStatus: () => true });
  const j = res.data && typeof res.data === "object" ? res.data : {};
  const scopes = [j, j.result, j.data];
  let link = firstOf(scopes, ["url", "download", "download_url", "downloadUrl", "audio", "link", "mp3"]);
  if (!isHttp(link) || isImage(link)) {
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

export async function getInfo(q) {
  try {
    return await rabbitPlay(q);
  } catch (e) {
    console.error("[media] Rabbit failed, trying Sayan:", e?.message || e);
    return sayanMusic(q);
  }
}

async function rabbitSongUrl(q) {
  const res = await axios.get(`${RABBIT}/api/song`, { params: { q }, timeout: 90_000, headers: { "User-Agent": UA }, validateStatus: () => true });
  const found = [];
  const walk = (o) => {
    if (typeof o === "string") { if (isHttp(o) && !isImage(o) && !isYtPage(o)) found.push(o); }
    else if (o && typeof o === "object") Object.values(o).forEach(walk);
  };
  walk(res.data);
  if (!found.length) throw new Error("song link not found");
  return found[0];
}

// Audio button: card link → other API → Rabbit /api/song
export async function audioFor(id) {
  const info = recall(id);
  const attempts = [];
  if (info?.url) attempts.push(["card link", async () => info.url]);
  if (info?.source !== "sayan") attempts.push(["music API", async () => (await sayanMusic(`https://youtu.be/${id}`)).url]);
  if (info?.source !== "rabbit") attempts.push(["Rabbit play", async () => (await rabbitPlay(`https://youtu.be/${id}`)).url]);
  attempts.push(["Rabbit song", async () => rabbitSongUrl(`https://youtu.be/${id}`)]);
  let lastErr;
  for (const [name, getUrl] of attempts) {
    try {
      return { buffer: await fetchBuffer(await getUrl(), { tries: 2, min: 20_000 }), title: info?.title || "audio", artist: info?.channel || null };
    } catch (e) {
      lastErr = e;
      console.error(`[media:AUDIO] ${name} failed: ${e?.message || e}`);
    }
  }
  throw lastErr || new Error("audio failed");
}

// Video button: sayan /video (YouTube link first, title as backup)
export async function videoFor(id) {
  const info = recall(id);
  let lastErr;
  for (const q of [`https://youtu.be/${id}`, info?.title].filter(Boolean)) {
    try {
      const res = await axios.get(VIDEO_API, { params: { query: q }, timeout: 120_000, headers: { "User-Agent": UA }, validateStatus: () => true });
      const j = res.data || {};
      const link = [j.url, j.download, j.download_url, j.video, j.result?.url, j.result?.download, j.data?.url].find((v) => isHttp(v) && !isImage(v));
      if (!link) throw new Error(j.message || j.error || "Video link not found");
      return { buffer: await fetchBuffer(link, { tries: 3, min: 20_000 }), title: info?.title || "video" };
    } catch (e) {
      lastErr = e;
      console.error("[media:VIDEO]", q, e?.message || e);
    }
  }
  throw lastErr || new Error("video failed");
}

// /music: Spotify API → sayan → Rabbit (first that works)
export async function findSong(query) {
  const sources = [
    ["spotify", () => askApi(SPOTIFY_API, { url: query })],
    ["sayan", () => askApi(MUSIC_API, { query })],
    ["rabbit", () => askApi(`${RABBIT}/api/play`, { q: query })],
  ];
  const errors = [];
  for (const [name, ask] of sources) {
    try {
      const song = await ask();
      const buffer = song.buffer || (await fetchBuffer(song.audio, { tries: 2, min: 20_000 }));
      console.log(`[media] music source=${name} title=${song.title || "?"}`);
      return { ...song, buffer };
    } catch (err) {
      const why = err?.code === "ECONNABORTED" ? "timeout" : err?.message || String(err);
      console.error(`[media] music ${name} failed: ${why}`);
      errors.push(`${name}: ${why}`);
    }
  }
  throw new Error(errors.join(" | "));
}
