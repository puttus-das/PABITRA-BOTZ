import fs from "fs";
import os from "os";
import path from "path";
import axios from "axios";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { Module } from "../lib/plugins.js";
import { resolveFfmpegPath } from "../lib/resolveFfmpeg.js";

// Menu "Audio" button / .audio — picks a random link from plugins/bin/audio_urls.json
// (mp4 links), pulls out the sound and sends it as an audio message.
// Add or remove links in that JSON file any time.
const LIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "bin", "audio_urls.json");
const MAX_BYTES = 60 * 1024 * 1024;
let last = "";

const loadUrls = () => {
  try {
    const a = JSON.parse(fs.readFileSync(LIST, "utf8"));
    return a.filter((u) => /^https?:\/\//i.test(u));
  } catch (e) {
    console.error("[audio] cannot read audio_urls.json:", e?.message || e);
    return [];
  }
};

const toMp3 = (inFile, outFile) =>
  new Promise((resolve, reject) => {
    const p = spawn(resolveFfmpegPath(), ["-y", "-i", inFile, "-vn", "-c:a", "libmp3lame", "-q:a", "4", outFile], { stdio: "ignore" });
    const t = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("ffmpeg timeout")); }, 90_000);
    p.on("error", (e) => { clearTimeout(t); reject(e); });
    p.on("close", (code) => { clearTimeout(t); code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`)); });
  });

async function fetchAudio(url) {
  const id = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  const inFile = path.join(os.tmpdir(), `aud-${id}.mp4`);
  const outFile = path.join(os.tmpdir(), `aud-${id}.mp3`);
  try {
    const res = await axios.get(url, { responseType: "arraybuffer", timeout: 60_000, maxContentLength: MAX_BYTES, headers: { "User-Agent": "Mozilla/5.0" } });
    const buf = Buffer.from(res.data);
    if (buf.length < 2048) throw new Error("file too small / dead link");
    try {
      fs.writeFileSync(inFile, buf);
      await toMp3(inFile, outFile);
      return { audio: fs.readFileSync(outFile), mimetype: "audio/mpeg" };
    } catch (e) {
      console.warn("[audio] ffmpeg convert failed, sending mp4 as audio:", e?.message || e);
      return { audio: buf, mimetype: "audio/mp4" };
    }
  } finally {
    for (const f of [inFile, outFile]) try { fs.unlinkSync(f); } catch {}
  }
}

Module({
  command: "audio",
  aliases: ["randomaudio", "gan", "audiobutton"],
  package: "music",
  description: "Send a random song (audio) from the PABITRA audio list",
  usage: ".audio",
})(async (message) => {
  try {
    const urls = loadUrls();
    if (!urls.length) {
      return message.conn.sendMessage(message.from, { text: "❌ Audio list is empty. Add links in plugins/bin/audio_urls.json" }, { quoted: message.gift });
    }
    try { await message.react("🎧"); } catch {}
    let tries = 0;
    let lastErr;
    while (tries < 4) {
      tries++;
      const pool = urls.length > 1 ? urls.filter((u) => u !== last) : urls;
      const url = pool[Math.floor(Math.random() * pool.length)];
      last = url;
      console.log(`[AUDIO] try ${tries}: ${url}`);
      try {
        const a = await fetchAudio(url);
        await message.conn.sendMessage(message.from, { audio: a.audio, mimetype: a.mimetype, ptt: false }, { quoted: message.gift });
        try { await message.react("✅"); } catch {}
        return;
      } catch (e) {
        lastErr = e;
        console.warn(`[AUDIO] failed (${url}):`, e?.message || e);
      }
    }
    await message.conn.sendMessage(message.from, { text: `❌ Audio failed: ${lastErr?.message || "all links failed"}` }, { quoted: message.gift });
  } catch (error) {
    console.error("[audio]", error?.stack || error);
  }
});
