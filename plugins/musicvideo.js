import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Module } from "../lib/plugins.js";

// Put your Bangla/any music videos in plugins/bin/music-videos/ (mp4, mkv, webm, mov, 3gp).
// Every tap on the menu's Video button (or .musicvideo) sends one random video from there.
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "bin", "music-videos");
const CAPTION = "*━[ 𝐕ɪᴅᴇᴏ ]━*\n\n*━( 𝐏ᴀʙɪᴛʀᴀ - 𝐁ᴏᴛ⎯꯭̽💜 )━*";
const EXT = /\.(mp4|mkv|webm|mov|3gp)$/i;
const MAX_BYTES = 95 * 1024 * 1024;
let lastPick = "";

function listVideos(dir = DIR, depth = 0) {
  let out = [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && depth < 2) out = out.concat(listVideos(full, depth + 1));
    else if (e.isFile() && EXT.test(e.name)) {
      try {
        const size = fs.statSync(full).size;
        if (size > 1024 && size <= MAX_BYTES) out.push(full);
      } catch {}
    }
  }
  return out;
}

Module({
  command: "musicvideo",
  aliases: ["randommusic", "mv", "musicbutton", "music_video"],
  package: "music",
  description: "Send a random video from the PABITRA music collection",
  usage: ".musicvideo",
})(async (message) => {
  try {
    const files = listVideos();
    console.log(`[MUSICVIDEO] found ${files.length} video(s) in ${DIR}`);
    if (!files.length) {
      return message.conn.sendMessage(
        message.from,
        { text: "❌ Music video collection is empty. Add .mp4 files to plugins/bin/music-videos/" },
        { quoted: message.gift }
      );
    }
    // random pick, never the same clip twice in a row (when there are 2+)
    const pool = files.length > 1 ? files.filter((f) => f !== lastPick) : files;
    const file = pool[Math.floor(Math.random() * pool.length)];
    lastPick = file;
    console.log(`[MUSICVIDEO] selected=${path.basename(file)}`);
    try { await message.react("🎵"); } catch {}
    const payload = {
      video: { url: file },
      mimetype: "video/mp4",
      caption: CAPTION,
      gifPlayback: false,
    };
    try {
      // quote the tap message's safe stand-in (a button-response can't always be quoted)
      await message.conn.sendMessage(message.from, payload, { quoted: message.gift });
    } catch (e) {
      console.error("[musicvideo] send with quote failed, retrying plain:", e?.message || e);
      await message.conn.sendMessage(message.from, payload);
    }
    try { await message.react("✅"); } catch {}
  } catch (error) {
    console.error("[musicvideo]", error?.stack || error);
    try {
      await message.conn.sendMessage(
        message.from,
        { text: `❌ Music video failed: ${error?.message || "unknown error"}` },
        { quoted: message.gift }
      );
    } catch {}
  }
});
