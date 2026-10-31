// lib/songFetch.js — YouTube link → audio buffer, tries several providers in order.
//   1) ytmp3.gg converter   2) Rabbit API
// Add more providers to PROVIDERS and the csong plugin picks them up automatically.
import axios from "axios";
import { songdl } from "../plugins/bin/ytmp3.js";
import { rabbitAudio } from "../plugins/bin/rabbit.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MIN_BYTES = 20_000; // anything smaller is an error page, not a song

async function download(url, timeout) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout,
    headers: { "User-Agent": UA },
    maxContentLength: 80 * 1024 * 1024,
  });
  const buf = Buffer.from(res.data);
  if (buf.length < MIN_BYTES) throw new Error(`file too small (${buf.length} bytes)`);
  return buf;
}

const PROVIDERS = [
  {
    name: "ytmp3.gg",
    run: async (url, timeout) => {
      const r = await songdl(url, "128kbps");
      return { buffer: await download(r.downloadUrl, timeout), title: r.title };
    },
  },
  {
    name: "rabbit",
    run: async (url, timeout) => {
      const r = await rabbitAudio("song", url);
      const buffer = r.audioBuffer || (await download(r.downloadUrl, timeout));
      if (buffer.length < MIN_BYTES) throw new Error(`file too small (${buffer.length} bytes)`);
      return { buffer, title: r.title };
    },
  },
];

/** @returns {Promise<{buffer: Buffer, title?: string, provider: string}>} */
export async function fetchSongAudio(videoUrl, { timeout = 45_000 } = {}) {
  const errors = [];
  for (const p of PROVIDERS) {
    try {
      const out = await p.run(videoUrl, timeout);
      return { ...out, provider: p.name };
    } catch (e) {
      const why = e?.response?.status ? `HTTP ${e.response.status}` : e?.message || String(e);
      console.warn(`[songFetch] ${p.name} failed: ${why}`);
      errors.push(`${p.name}: ${why}`);
    }
  }
  throw new Error(errors.join(" | ") || "no provider worked");
}

export default fetchSongAudio;
