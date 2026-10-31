import axios from "axios";
import { Module } from "../lib/plugins.js";

// ─── .music <Spotify link or song name> ───────────────────────────────────────
// 1) Spotify API  https://jerrycoder.oggyapi.workers.dev/down/spotify?url=<text>
// 2) if it fails / is too slow → sayan-nexuswork /music   3) → Rabbit /api/play
// Sends ONE normal audio message (quoted on the Pabitra-Paul VCard) and never stays silent:
// every step has a short timeout and a failure always ends in a reply.

const SPOTIFY_API = process.env.SPOTIFY_API || "https://jerrycoder.oggyapi.workers.dev/down/spotify";
const SAYAN_API = process.env.MUSIC_API || "https://api.sayan-nexuswork.workers.dev/music";
const RABBIT_API = (process.env.RABBIT_API_BASE || "https://rabbitapi.zone.id").replace(/\/+$/, "") + "/api/play";
const CAPTION = "© 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ";
const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36";

const isHttp = (v) => typeof v === "string" && /^https?:\/\//i.test(v);
const isSpotifyPage = (v) => /^https?:\/\/(open|play)\.spotify\.com\//i.test(v);
const isImageUrl = (v) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(v) || /i\.scdn\.co|ytimg\.com/i.test(v);

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

// understand whatever shape an API answers with
function parseSong(json) {
  const flat = flatten(json);
  const okAudio = (v) => isHttp(v) && !isSpotifyPage(v) && !isImageUrl(v);
  const audio =
    pickKey(flat, ["download", "downloadurl", "download_url", "dl", "audio", "audiourl", "audio_url", "mp3", "link", "url", "result"], okAudio) ||
    flat.find(([, v]) => okAudio(v))?.[1] ||
    null;
  const title = pickKey(flat, ["title", "name", "track", "song"], (v) => typeof v === "string" && !isHttp(v));
  const artist =
    pickKey(flat, ["artist", "artists", "author", "singer", "channel"], (v) => typeof v === "string" && !isHttp(v)) ||
    flat.find(([p, v]) => /(artist|author)/.test(p) && typeof v === "string" && !isHttp(v))?.[1] ||
    null;
  const cover = pickKey(flat, ["cover", "image", "thumbnail", "thumb", "poster", "albumcover"], (v) => isHttp(v));
  return { audio, title, artist, cover };
}

async function getBuffer(url, { tries = 2, timeout = 45_000, min = 1000 } = {}) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout,
        headers: { "User-Agent": UA },
        maxContentLength: 100 * 1024 * 1024,
      });
      const buf = Buffer.from(res.data);
      if (buf.length < min) throw new Error(`file too small (${buf.length} bytes)`);
      return buf;
    } catch (err) {
      lastErr = err;
      console.error(`[MUSIC:DL] try ${i}/${tries}: ${err?.message || err}`);
      if (i < tries) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr;
}

// one API → { audio link, title, artist, cover }
async function askApi(api, params, timeout = 25_000) {
  const res = await axios.get(api, {
    params,
    timeout,
    headers: { "User-Agent": UA, Accept: "application/json, audio/*" },
    responseType: "arraybuffer",
    validateStatus: () => true,
  });
  const type = String(res.headers["content-type"] || "");
  const raw = Buffer.from(res.data);
  if (/^audio\//i.test(type)) return { buffer: raw, title: null, artist: null, cover: null };

  let json;
  try {
    json = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new Error(`unreadable answer (HTTP ${res.status})`);
  }
  const song = parseSong(json);
  if (!song.audio) {
    const msg = json?.message || json?.error || json?.msg;
    throw new Error(msg ? String(msg) : `no download link (HTTP ${res.status})`);
  }
  return song;
}

const SOURCES = [
  ["rabbit", (q) => askApi(RABBIT_API, { q })],
  ["spotify", (q) => askApi(SPOTIFY_API, { url: q })],
  ["sayan", (q) => askApi(SAYAN_API, { query: q })],
];

async function findSong(query) {
  const errors = [];
  for (const [name, ask] of SOURCES) {
    try {
      const song = await ask(query);
      const buffer = song.buffer || (await getBuffer(song.audio, { min: 20_000 }));
      console.log(`[MUSIC] source=${name} title=${song.title || "?"} bytes=${buffer.length}`);
      return { ...song, buffer, source: name };
    } catch (err) {
      const why = err?.code === "ECONNABORTED" ? "timeout" : err?.message || String(err);
      console.error(`[MUSIC] ${name} failed: ${why}`);
      errors.push(`${name}: ${why}`);
    }
  }
  throw new Error(errors.join(" | "));
}

Module({
  command: "music",
  aliases: ["spotify", "sp"],
  package: "downloader",
  description: "Download a song from a Spotify link (or name)",
})(async (message, match) => {
  const query = (match || "").trim();
  const reply = (text) => message.conn.sendMessage(message.from, { text }, { quoted: message.gift });
  if (!query) return reply("*ᴜꜱᴀɢᴇ:* .music <ꜱᴘᴏᴛɪꜰʏ ʟɪɴᴋ ᴏʀ ꜱᴏɴɢ ɴᴀᴍᴇ>");

  try {
    try { await message.react("🎵"); } catch (_) {} // quick sign that the bot got the command
    console.log(`[MUSIC] query=${query}`);
    const song = await findSong(query);
    const title = song.title || "song";

    await message.conn.sendMessage(
      message.from,
      {
        audio: song.buffer,
        mimetype: "audio/mpeg",
        ptt: false,
        fileName: `${title.replace(/[\\/:*?"<>|]/g, "").slice(0, 60) || "song"}.mp3`,
      },
      { quoted: message.gift }
    );
  } catch (err) {
    console.error("[MUSIC]", err?.message || err);
    await reply(`⚠️ ${err?.message || "music failed"}\n\n${CAPTION}`);
  }
});
