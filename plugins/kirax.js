import axios from "axios";
import { Module } from "../lib/plugins.js";

const API_BASE = (process.env.KIRAX_API_BASE || "https://kiraxmd-api.vercel.app").replace(/\/+$/, "");
const REQUEST_TIMEOUT = 60_000;
const CAPTION = "*━( 𝐏ᴀʙɪᴛʀᴀ - 𝐁ᴏᴛ⎯꯭̽💜 )━*";

const HELP = [
  "*Kirax API commands*",
  ".kirax ai <question>",
  ".kirax fb <Facebook video URL>",
  ".kirax upscale <image URL>",
  ".kirax apk <app name>",
  ".kirax anime <type>",
  ".kirax latin <ID or search words>",
  ".kirax play <song name>",
  "",
  "Standalone forms also work: .kiraxai, .kiraxfb, .kiraxupscale, .kiraxapk, .kiraxanime, .kiraxlatin, .kiraxplay",
].join("\n");

function getPublicUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return null;
    if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return null;
    const private172 = host.match(/^172\.(\d+)\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function apiError(data, status) {
  if (typeof data === "string") return data.replace(/\s+/g, " ").slice(0, 220);
  return data?.error?.message || data?.error || data?.message || data?.msg || `Kirax API returned HTTP ${status}`;
}

async function apiGet(route, params, options = {}) {
  const response = await axios.get(`${API_BASE}/api/${route}`, {
    params,
    timeout: options.timeout || REQUEST_TIMEOUT,
    responseType: options.responseType || "json",
    maxContentLength: options.maxContentLength || 25 * 1024 * 1024,
    validateStatus: () => true,
    headers: { Accept: options.accept || "application/json", "User-Agent": "PABITRA-BOT/1.0" },
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(apiError(response.data, response.status));
  }
  return response;
}

function stringifyResult(value, maxLength = 3300) {
  let text;
  if (typeof value === "string") text = value;
  else {
    try {
      text = JSON.stringify(value, null, 2);
    } catch {
      text = String(value);
    }
  }
  if (!text) return "The API returned an empty response.";
  return text.length > maxLength ? `${text.slice(0, maxLength - 18)}\n… (truncated)` : text;
}

function isApiFailure(data) {
  return data && typeof data === "object" && (data.status === false || data.success === false);
}

function collectLinks(value, key = "", found = [], seen = new Set()) {
  if (typeof value === "string") {
    if (/(url|link|download|video|mp4|audio|mp3|image|file|result)/i.test(key)) {
      const url = getPublicUrl(value);
      if (url && !seen.has(url)) {
        seen.add(url);
        found.push({ url, label: key });
      }
    }
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectLinks(item, key, found, seen);
    return found;
  }
  if (value && typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value)) {
      collectLinks(childValue, childKey, found, seen);
    }
  }
  return found;
}

function requireArgument(arg, usage) {
  const value = String(arg || "").trim();
  if (!value) throw new Error(`Usage: ${usage}`);
  return value;
}

async function runAI(message, arg) {
  const query = requireArgument(arg, ".kirax ai <question>");
  const { data } = await apiGet("ai", { q: query });
  if (isApiFailure(data)) throw new Error(apiError(data, 200));
  const result = data?.result ?? data?.answer ?? data?.response ?? data;
  return message.send(stringifyResult(result));
}

async function runFacebook(message, arg) {
  const input = requireArgument(arg, ".kirax fb <Facebook video URL>");
  const url = getPublicUrl(input);
  if (!url || !/(^|\.)((facebook\.com)|(fb\.watch))$/i.test(new URL(url).hostname)) {
    throw new Error("Please provide a valid public Facebook or fb.watch video URL.");
  }
  const { data } = await apiGet("fb", { url });
  if (isApiFailure(data)) throw new Error(apiError(data, 200));
  const links = collectLinks(data).filter(({ url: link }) => !/facebook\.com|fb\.watch/i.test(new URL(link).hostname));
  const chosen = links.find(({ label }) => /hd|720|1080|download|video|mp4/i.test(label)) || links[0];
  if (!chosen) return message.send(stringifyResult(data));
  try {
    await message.send({ video: { url: chosen.url }, caption: CAPTION });
  } catch (error) {
    console.warn("[Kirax FB] media send failed:", error?.message || error);
    await message.send(`Facebook video link:\n${chosen.url}`);
  }
}

async function runUpscale(message, arg) {
  const input = requireArgument(arg, ".kirax upscale <public image URL>");
  const url = getPublicUrl(input);
  if (!url) throw new Error("Please provide a valid public HTTP/HTTPS image URL.");
  const response = await apiGet("upscale", { url }, { responseType: "arraybuffer", accept: "image/*, application/json" });
  const contentType = String(response.headers["content-type"] || "");
  const body = Buffer.from(response.data);
  if (/^image\//i.test(contentType)) {
    return message.send({ image: body, caption: CAPTION });
  }
  let data;
  try {
    data = JSON.parse(body.toString("utf8"));
  } catch {
    throw new Error("The upscale API returned an unsupported response.");
  }
  if (isApiFailure(data)) throw new Error(apiError(data, response.status));
  const image = collectLinks(data).find(({ label }) => /image|url|link|download|result/i.test(label));
  if (!image) return message.send(stringifyResult(data));
  try {
    return await message.send({ image: { url: image.url }, caption: CAPTION });
  } catch (error) {
    console.warn("[Kirax upscale] image send failed:", error?.message || error);
    return message.send(`Upscaled image:\n${image.url}`);
  }
}

async function runApk(message, arg) {
  const query = requireArgument(arg, ".kirax apk <app name>");
  const { data } = await apiGet("apk", { q: query });
  if (isApiFailure(data)) throw new Error(apiError(data, 200));
  const result = data?.result;
  if (!result || typeof result !== "object") return message.send(stringifyResult(data));
  const download = getPublicUrl(result.download_link || result.downloadUrl || result.url || "");
  const lines = [
    `*${result.name || query}*`,
    result.size ? `Size: ${result.size}` : null,
    result.version ? `Version: ${result.version}` : null,
    download ? `Download: ${download}` : null,
  ].filter(Boolean);
  return message.send(lines.join("\n") || stringifyResult(data));
}

async function runAnime(message, arg) {
  const type = requireArgument(arg, ".kirax anime <type>");
  const { data } = await apiGet("anime", { type });
  if (isApiFailure(data)) throw new Error(apiError(data, 200));
  return message.send(stringifyResult(data?.result ?? data));
}

async function runLatin(message, arg) {
  const value = requireArgument(arg, ".kirax latin <ID or search words>");
  const params = /^\d+$/.test(value) ? { id: value } : { q: value };
  const { data } = await apiGet("latin", params);
  if (isApiFailure(data)) throw new Error(apiError(data, 200));
  if (Array.isArray(data?.result) && data.result.length === 0) {
    return message.send("No matching Latin phrase was found.");
  }
  return message.send(stringifyResult(data?.result ?? data));
}

async function runPlay(message, arg) {
  const query = requireArgument(arg, ".kirax play <song name>");
  const { data } = await apiGet("play", { q: query });
  if (isApiFailure(data)) throw new Error(apiError(data, 200));
  const result = data?.result;
  const audioUrl = getPublicUrl(result?.mp3 || result?.audio || result?.download || "");
  if (!audioUrl) return message.send(stringifyResult(data));
  const title = String(result?.title || query).replace(/[\r\n]/g, " ").slice(0, 120);
  try {
    await message.send({ audio: { url: audioUrl }, mimetype: "audio/mpeg", fileName: `${title}.mp3`, caption: CAPTION });
  } catch (error) {
    console.warn("[Kirax play] audio send failed:", error?.message || error);
    await message.send(`*${title}*\n${audioUrl}`);
  }
}

const handlers = { ai: runAI, fb: runFacebook, upscale: runUpscale, apk: runApk, anime: runAnime, latin: runLatin, play: runPlay };

async function execute(message, service, arg) {
  const handler = handlers[String(service || "").toLowerCase()];
  if (!handler) return message.send(HELP);
  try {
    try { await message.react?.("⏳"); } catch {}
    await handler(message, arg);
    try { await message.react?.("✅"); } catch {}
  } catch (error) {
    console.error(`[Kirax ${service}]`, error?.message || error);
    await message.send(`⚠️ ${error?.message || "Kirax API request failed. Please try again later."}`);
    try { await message.react?.("❌"); } catch {}
  }
}

Module({
  command: "kirax",
  package: "kirax",
  description: "Use Kirax AI, Facebook, image, APK, anime, Latin, and music APIs",
  usage: ".kirax <ai|fb|upscale|apk|anime|latin|play> <input>",
})(async (message, match) => {
  const input = String(match || "").trim();
  const split = input.match(/^(\S+)\s*([\s\S]*)$/);
  if (!split) return message.send(HELP);
  await execute(message, split[1], split[2]);
});

for (const [service, handler] of Object.entries(handlers)) {
  Module({
    command: `kirax${service}`,
    package: "kirax",
    description: `Kirax ${service} API`,
    usage: `.kirax${service} <input>`,
  })(async (message, match) => execute(message, service, match));
}
