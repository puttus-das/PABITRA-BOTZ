import axios from "axios";
import fs from "fs";
import os from "os";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import config from "../config.js";
import { Module } from "../lib/plugins.js";

// EliteProTech is the only provider used by .play/.song now.
const BASE = (process.env.ELITE_API_BASE || "https://eliteprotech-apis.zone.id").replace(/\/+$/, "");
const RABBIT_BASE = (process.env.RABBIT_API_BASE || "https://rabbitapi.zone.id").replace(/\/+$/, "");
const UA = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36";
const CAPTION = "© 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ";
const clean = (value) => String(value || "").trim();
ffmpeg.setFfmpegPath(ffmpegPath.path);

function errorText(data, status) {
  if (typeof data === "string") return data.slice(0, 250);
  return data?.error?.message || data?.error || data?.message || data?.msg || `Elite API returned HTTP ${status}`;
}

async function eliteGet(path, params = {}, options = {}) {
  const response = await axios.get(`${BASE}${path}`, {
    params,
    timeout: options.timeout || 90_000,
    responseType: options.responseType || "json",
    headers: { "User-Agent": UA, Accept: "application/json, audio/*, video/*" },
    validateStatus: () => true,
    maxContentLength: 120 * 1024 * 1024,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(errorText(response.data, response.status));
  }
  return response;
}

async function rabbitGet(route, params = {}) {
  const response = await axios.get(`${RABBIT_BASE}/api/${route}`, {
    params,
    timeout: 90_000,
    headers: { "User-Agent": UA, Accept: "application/json" },
    validateStatus: () => true,
    maxContentLength: 120 * 1024 * 1024,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(response.data?.message || response.data?.error || `RabbitAPI ${route} returned HTTP ${response.status}`);
  }
  if (response.data?.success === false || response.data?.status === false) {
    throw new Error(response.data?.message || response.data?.error || `RabbitAPI ${route} failed`);
  }
  return response.data;
}

function rabbitResult(data) {
  const result = data?.result;
  if (!result || typeof result !== "object") throw new Error("RabbitAPI returned no song result");
  const audioUrl = result.mp3 || result.audio || result.download || result.url;
  if (typeof audioUrl !== "string" || !/^https:\/\//i.test(audioUrl)) {
    throw new Error("RabbitAPI did not return a valid audio link");
  }
  return { ...result, audioUrl };
}

async function getRabbitSong(query, route = "play") {
  const data = await rabbitGet(route, { q: query });
  return rabbitResult(data);
}

async function sendRabbitSong(message, query, route = "play") {
  const song = await getRabbitSong(query, route);
  await message.conn.sendMessage(
    message.from,
    {
      audio: { url: song.audioUrl },
      mimetype: "audio/mpeg",
      ptt: false,
      fileName: `${String(song.title || query).replace(/[\\/:*?"<>|\r\n]/g, " ").slice(0, 90) || "song"}.mp3`,
      caption: `🎵 *${song.title || query}*${song.duration ? `\n⏱ ${song.duration}` : ""}\n${CAPTION}`,
    },
    { quoted: message.gift }
  );
}

async function sendRabbitVideo(message, videoUrl) {
  if (!/^https?:\/\/(?:www\.)?(?:youtube\.com|m\.youtube\.com|youtu\.be)\//i.test(videoUrl)) {
    throw new Error("Please provide a YouTube or youtu.be URL.");
  }
  const data = await rabbitGet("dwnall", { url: videoUrl });
  const result = data?.result;
  if (!result || typeof result !== "object") throw new Error("RabbitAPI returned no video result");
  const videoUrlToSend = [result.hd, result.ss, result.video, result.url]
    .find((value) => typeof value === "string" && /^https:\/\//i.test(value));
  if (!videoUrlToSend) throw new Error("RabbitAPI did not return an HD/SD video link");
  await message.conn.sendMessage(
    message.from,
    {
      video: { url: videoUrlToSend },
      caption: `🎬 *${result.title || "YouTube video"}*\n${CAPTION}`,
    },
    { quoted: message.gift }
  );
}

function isHttp(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function findUrl(value, keys = []) {
  if (!value) return null;
  if (typeof value === "string") return isHttp(value) ? value : null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findUrl(item, keys);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  for (const key of keys) {
    if (isHttp(value[key])) return value[key];
  }
  for (const item of Object.values(value)) {
    const found = findUrl(item, keys);
    if (found) return found;
  }
  return null;
}

function videoIdFromUrl(value) {
  const match = String(value || "").match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/i);
  return match?.[1] || null;
}

function normaliseVideo(item) {
  if (!item || typeof item !== "object") return null;
  return {
    id: item.id || item.videoId || videoIdFromUrl(item.url),
    url: item.url || (item.id || item.videoId ? `https://www.youtube.com/watch?v=${item.id || item.videoId}` : null),
    title: item.title || item.name || "Unknown title",
    author: typeof item.author === "object" ? item.author?.name : item.author,
    duration: item.duration || "N/A",
    thumbnail: item.thumbnail || item.image,
  };
}

async function searchVideo(query) {
  const response = await eliteGet("/search/ytsearch", { q: query });
  const payload = response.data?.results?.videos || response.data?.videos || response.data?.results || response.data?.data;
  const list = Array.isArray(payload) ? payload : [];
  const first = normaliseVideo(list[0]);
  if (!first?.url) throw new Error(errorText(response.data, response.status) || "No YouTube result found");
  return first;
}

async function downloadEliteAudio(videoUrl) {
  try {
    const response = await eliteGet("/download/ytdown", { url: videoUrl, format: "mp3" }, { responseType: "arraybuffer" });
    const type = String(response.headers["content-type"] || "");
    const raw = Buffer.from(response.data);
    if (/^audio\//i.test(type) || raw.length > 20_000 && !/json|text|html/i.test(type)) return raw;
    let data;
    try { data = JSON.parse(raw.toString("utf8")); } catch { throw new Error("Elite MP3 endpoint returned an unreadable response"); }
    const downloadUrl = findUrl(data, ["url", "download", "downloadUrl", "download_url", "audio", "mp3", "link"]);
    if (!downloadUrl) throw new Error(errorText(data, response.status) || "Elite MP3 download link not found");
    const audio = await axios.get(downloadUrl, { responseType: "arraybuffer", timeout: 120_000, headers: { "User-Agent": UA }, maxContentLength: 120 * 1024 * 1024 });
    const buffer = Buffer.from(audio.data);
    if (buffer.length < 20_000) throw new Error("Elite MP3 file was empty or too small");
    return buffer;
  } catch (mp3Error) {
    console.warn("[ELITE] ytdown failed, converting ytmp4 to MP3:", mp3Error?.message || mp3Error);
    const response = await eliteGet("/download/ytmp4", { url: videoUrl });
    const videoUrlResult = findUrl(response.data, ["url", "download", "downloadUrl", "download_url", "video", "mp4"]);
    if (!videoUrlResult) throw mp3Error;
    const video = await axios.get(videoUrlResult, { responseType: "arraybuffer", timeout: 120_000, headers: { "User-Agent": UA }, maxContentLength: 120 * 1024 * 1024 });
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const input = path.join(os.tmpdir(), `pabitra-${stamp}.mp4`);
    const output = path.join(os.tmpdir(), `pabitra-${stamp}.mp3`);
    fs.writeFileSync(input, video.data);
    try {
      await new Promise((resolve, reject) => ffmpeg(input).noVideo().audioCodec("libmp3lame").audioBitrate(128).format("mp3").on("end", resolve).on("error", reject).save(output));
      return fs.readFileSync(output);
    } finally {
      fs.rmSync(input, { force: true });
      fs.rmSync(output, { force: true });
    }
  }
}

async function sendSong(message, query) {
  const video = await searchVideo(query);
  const buffer = await downloadEliteAudio(video.url);
  await message.conn.sendMessage(
    message.from,
    {
      audio: buffer,
      mimetype: "audio/mpeg",
      ptt: false,
      fileName: `${video.title.replace(/[\\/:*?"<>|]/g, "").slice(0, 60) || "song"}.mp3`,
    },
    { quoted: message.gift }
  );
}

Module({
  command: "play",
  aliases: ["yta"],
  package: "downloader",
  description: "Search and download a song through RabbitAPI",
})(async (message, match) => {
  const query = clean(match);
  const reply = (text) => message.conn.sendMessage(message.from, { text }, { quoted: message.gift });
  if (!query) return reply(`*${config.prefix}play <song name or YouTube URL>*`);
  try {
    await message.react?.("🎵");
    try {
      await sendRabbitSong(message, query, "play");
    } catch (rabbitError) {
      console.warn("[RABBIT:PLAY] Falling back to EliteProTech:", rabbitError?.message || rabbitError);
      await sendSong(message, query);
    }
    await message.react?.("✅");
  } catch (error) {
    console.error("[RABBIT:PLAY]", error?.message || error);
    await reply(`⚠️ Song download failed: ${error?.message || "try again later"}\n\n${CAPTION}`);
  }
});

Module({
  command: "song",
  package: "downloader",
  description: "Search and download a song using RabbitAPI",
  usage: ".song <song name or YouTube URL>",
})(async (message, match) => {
  const query = clean(match);
  if (!query) return message.send(`*${config.prefix}song <song name or YouTube URL>*`);
  try {
    await message.react?.("🎵");
    try {
      await sendRabbitSong(message, query, "song");
    } catch (rabbitError) {
      console.warn("[RABBIT:SONG] Falling back to EliteProTech:", rabbitError?.message || rabbitError);
      await sendSong(message, query);
    }
    await message.react?.("✅");
  } catch (error) {
    console.error("[RABBIT:SONG]", error?.message || error);
    await message.send(`⚠️ Song download failed: ${error?.message || "try again later"}\n\n${CAPTION}`);
  }
});

Module({
  command: "dwnall",
  aliases: ["rabbitvideo"],
  package: "downloader",
  description: "Download SD/HD video from a YouTube URL using RabbitAPI",
  usage: ".dwnall <YouTube URL>",
})(async (message, match) => {
  const url = clean(match);
  if (!url) return message.send(`*${config.prefix}dwnall <YouTube URL>*`);
  try {
    await message.react?.("🎬");
    await sendRabbitVideo(message, url);
    await message.react?.("✅");
  } catch (error) {
    console.error("[RABBIT:DWNLALL]", error?.message || error);
    await message.send(`⚠️ Video download failed: ${error?.message || "try again later"}\n\n${CAPTION}`);
    await message.react?.("❌");
  }
});

// Explicit API command for a direct YouTube URL.
Module({
  command: "ytdown",
  package: "downloader",
  description: "Download a YouTube URL as MP3 through EliteProTech",
})(async (message, match) => {
  const url = clean(match);
  if (!/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url)) {
    return message.send("Usage: .ytdown https://youtu.be/VIDEO_ID");
  }
  try {
    await message.react?.("🎵");
    const buffer = await downloadEliteAudio(url);
    await message.conn.sendMessage(message.from, { audio: buffer, mimetype: "audio/mpeg", ptt: false, fileName: "pabitra-song.mp3" }, { quoted: message.gift });
    await message.react?.("✅");
  } catch (error) {
    console.error("[ELITE:YTDOWN]", error?.message || error);
    await message.send(`⚠️ Elite MP3 download failed: ${error?.message || "try again later"}\n\n${CAPTION}`);
  }
});

export { searchVideo as searchEliteVideo, downloadEliteAudio, getRabbitSong as searchRabbitSong };
