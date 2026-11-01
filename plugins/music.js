import { Module } from "../lib/plugins.js";
import {
  searchEliteVideo,
  downloadEliteAudio,
  searchRabbitSong,
} from "./play.js";

const CAPTION = "© 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ";
const clean = (value) => String(value || "").trim();

Module({
  command: "music",
  aliases: ["spotify", "sp"],
  package: "downloader",
  description: "Download a song through RabbitAPI and mention the requester",
  usage: ".music <song name or YouTube URL>",
})(async (message, match) => {
  const query = clean(match);
  if (!query) return message.send("*ᴜꜱᴀɢᴇ:* .music <song name or YouTube URL>");

  try {
    await message.react?.("🎵");

    let audio;
    let title = query;
    let duration = "";
    let rabbitAudioUrl = "";

    try {
      const song = await searchRabbitSong(query, "play");
      title = song.title || query;
      duration = song.duration || "";
      rabbitAudioUrl = song.audioUrl;
    } catch (rabbitError) {
      console.warn("[RABBIT:MUSIC] Falling back to EliteProTech:", rabbitError?.message || rabbitError);
      const video = await searchEliteVideo(query);
      title = video.title || query;
      duration = video.duration || "";
      audio = await downloadEliteAudio(video.url);
    }

    const requester = String(message.sender || "");
    const mentionJid = requester.includes("@") ? requester : "";
    const mentionNumber = mentionJid.split("@")[0].replace(/\D/g, "");
    const mentionName = mentionNumber || String(message.pushName || "there").replace(/[\r\n@]/g, "");
    const mentionText = `🎵 @${mentionName}, your song is ready: *${title}*${duration ? ` (${duration})` : ""}`;
    const mentionMessage = await message.reply(mentionText, {
      mentions: mentionJid ? [mentionJid] : [],
    });

    await message.conn.sendMessage(
      message.from,
      {
        audio: rabbitAudioUrl ? { url: rabbitAudioUrl } : audio,
        mimetype: "audio/mpeg",
        ptt: false,
        fileName: `${String(title).replace(/[\\/:*?"<>|\r\n]/g, " ").slice(0, 90) || "song"}.mp3`,
        caption: CAPTION,
      },
      { quoted: mentionMessage?.key || message.raw }
    );
    await message.react?.("✅");
  } catch (error) {
    console.error("[RABBIT:MUSIC]", error?.message || error);
    await message.send(`⚠️ Music download failed: ${error?.message || "try again later"}\n\n${CAPTION}`);
  }
});
