import axios from "axios";
import { downloadEliteAudio } from "../plugins/play.js";
import config from "../config.js";

export const CAPTION = `© ${config.botName}`;
const BASE = (process.env.ELITE_API_BASE || "https://eliteprotech-apis.zone.id").replace(/\/+$/, "");
const UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36";
const cache = new Map();
const TTL = 30 * 60 * 1000;
const isHttp = (v) => typeof v === "string" && /^https?:\/\//i.test(v);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const fancy = (t) => String(t);
export const remember = (id, info) => {
  cache.set(id, { ...info, at: Date.now() });
  for (const [k, v] of cache) if (Date.now() - v.at > TTL) cache.delete(k);
};
export const recall = (id) => cache.get(id);

function apiError(data, status) {
  return data?.error?.message || data?.error || data?.message || data?.msg || `Elite API returned HTTP ${status}`;
}
async function elite(path, params = {}, responseType = "json") {
  const res = await axios.get(`${BASE}${path}`, {
    params,
    responseType,
    timeout: 120_000,
    headers: { "User-Agent": UA, Accept: "application/json, audio/*, video/*" },
    validateStatus: () => true,
    maxContentLength: 120 * 1024 * 1024,
  });
  if (res.status < 200 || res.status >= 300) throw new Error(apiError(res.data, res.status));
  return res;
}

function firstUrl(value, keys = []) {
  if (!value) return null;
  if (typeof value === "string") return isHttp(value) ? value : null;
  if (Array.isArray(value)) for (const item of value) { const found = firstUrl(item, keys); if (found) return found; }
  if (typeof value !== "object") return null;
  for (const key of keys) if (isHttp(value[key])) return value[key];
  for (const item of Object.values(value)) { const found = firstUrl(item, keys); if (found) return found; }
  return null;
}

function normaliseVideo(item) {
  if (!item || typeof item !== "object") return null;
  const id = item.id || item.videoId || /(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/i.exec(item.url || "")?.[1];
  return {
    videoId: id || null,
    url: item.url || (id ? `https://www.youtube.com/watch?v=${id}` : null),
    title: item.title || item.name || "Unknown title",
    channel: typeof item.author === "object" ? item.author?.name : item.author,
    artist: typeof item.author === "object" ? item.author?.name : item.author,
    duration: item.duration || "N/A",
    views: item.views || "N/A",
    uploaded: item.uploaded || "N/A",
    thumbnail: item.thumbnail || item.image || null,
  };
}

export async function searchElite(query) {
  const res = await elite("/search/ytsearch", { q: query });
  const payload = res.data?.results?.videos || res.data?.videos || res.data?.results || res.data?.data;
  const first = Array.isArray(payload) ? normaliseVideo(payload[0]) : null;
  if (!first?.url) throw new Error(apiError(res.data, res.status) || "No YouTube result found");
  return first;
}

export async function fetchBuffer(url, { tries = 2, timeout = 90_000, min = 1000 } = {}) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await axios.get(url, { responseType: "arraybuffer", timeout, headers: { "User-Agent": UA }, maxContentLength: 120 * 1024 * 1024 });
      const buffer = Buffer.from(res.data);
      if (buffer.length < min) throw new Error(`file too small (${buffer.length} bytes)`);
      return buffer;
    } catch (err) {
      lastErr = err;
      if (i < tries) await sleep(1200);
    }
  }
  throw lastErr;
}

export async function eliteAudio(url) {
  return downloadEliteAudio(url);
}

export async function getInfo(query) {
  const info = await searchElite(query);
  remember(info.videoId || Date.now().toString(36), info);
  return info;
}

export async function findSong(query) {
  const info = await searchElite(query);
  const buffer = await eliteAudio(info.url);
  return { ...info, buffer, source: "eliteprotech" };
}

export async function audioFor(id) {
  const info = recall(id) || await searchElite(`https://youtu.be/${id}`);
  return { buffer: await eliteAudio(info.url), title: info.title || "audio", artist: info.artist || info.channel || null };
}

export async function videoFor(id) {
  const info = recall(id) || await searchElite(`https://youtu.be/${id}`);
  const res = await elite("/download/ytmp4", { url: info.url });
  const videoUrl = firstUrl(res.data, ["url", "download", "downloadUrl", "download_url", "video", "mp4"]);
  if (!videoUrl) throw new Error(apiError(res.data, res.status) || "Elite MP4 download link not found");
  return { buffer: await fetchBuffer(videoUrl, { tries: 2, min: 20_000 }), title: info.title || "video" };
}
