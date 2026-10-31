import { Module } from "../lib/plugins.js";
import { searchEliteVideo, downloadEliteAudio } from "./play.js";

const CAPTION = "© 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ";

Module({
  command: "music",
  aliases: ["spotify", "sp"],
  package: "downloader",
  description: "Download a song through EliteProTech",
})(async (message, match) => {
  const query = String(match || "").trim();
  const reply = (text) => message.conn.sendMessage(message.from, { text }, { quoted: message.gift });
  if (!query) return reply("*ᴜꜱᴀɢᴇ:* .music <song name or YouTube URL>");

  try {
    await message.react?.("🎵");
    const video = await searchEliteVideo(query);
    const buffer = await downloadEliteAudio(video.url);
    await message.conn.sendMessage(
      message.from,
      {
        audio: buffer,
        mimetype: "audio/mpeg",
        ptt: false,
        fileName: `${video.title.replace(/[\\/:*?"<>|]/g, "").slice(0, 60) || "song"}.mp3`,
        caption: CAPTION,
      },
      { quoted: message.gift }
    );
    await message.react?.("✅");
  } catch (error) {
    console.error("[ELITE:MUSIC]", error?.message || error);
    await reply(`⚠️ Elite music download failed: ${error?.message || "try again later"}\n\n${CAPTION}`);
  }
});
