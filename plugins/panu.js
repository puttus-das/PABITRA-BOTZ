import axios from "axios";
import { Module } from "../lib/plugins.js";

// .panu sends one video per command, in order.
// After the 35th video, it starts again from the 1st.
const PANU_VIDEOS = [
  // Original 10 videos
  "https://spider-avik.zone.id/file/iwn3ex.mp4",
  "https://spider-avik.zone.id/file/k6yv9h.mp4",
  "https://spider-avik.zone.id/file/vluslq.mp4",
  "https://spider-avik.zone.id/file/ppulgg.mp4",
  "https://spider-avik.zone.id/file/lpsa0g.mp4",
  "https://spider-avik.zone.id/file/h3nlqi.mp4",
  "https://spider-avik.zone.id/file/y1oo0h.mp4",
  "https://spider-avik.zone.id/file/732gvu.mp4",
  "https://spider-avik.zone.id/file/m2b9lj.mp4",
  "https://spider-avik.zone.id/file/mc3vd6.mp4",

  // Added 25 videos
  "https://spider-avik.zone.id/file/6s59pl.mp4",
  "https://spider-avik.zone.id/file/k6p3p4.mp4",
  "https://spider-avik.zone.id/file/2fafhi.mp4",
  "https://spider-avik.zone.id/file/2ciwju.mp4",
  "https://spider-avik.zone.id/file/kujhuw.mp4",
  "https://spider-avik.zone.id/file/hs5svh.mp4",
  "https://spider-avik.zone.id/file/agtqes.mp4",
  "https://spider-avik.zone.id/file/mwmwxx.mp4",
  "https://spider-avik.zone.id/file/hpwzno.mp4",
  "https://spider-avik.zone.id/file/o863tu.mp4",
  "https://spider-avik.zone.id/file/0g5uyn.mp4",
  "https://spider-avik.zone.id/file/dqwwmj.mp4",
  "https://spider-avik.zone.id/file/02dh18.mp4",
  "https://spider-avik.zone.id/file/p5oii4.mp4",
  "https://spider-avik.zone.id/file/taxvq6.mp4",
  "https://spider-avik.zone.id/file/7bi0vc.mp4",
  "https://spider-avik.zone.id/file/jm0edv.mp4",
  "https://spider-avik.zone.id/file/zr6oij.mp4",
  "https://spider-avik.zone.id/file/eez8da.mp4",
  "https://spider-avik.zone.id/file/g159nh.mp4",
  "https://spider-avik.zone.id/file/45ptf4.mp4",
  "https://spider-avik.zone.id/file/sezg7d.mp4",
  "https://spider-avik.zone.id/file/djxt1q.mp4",
  "https://spider-avik.zone.id/file/mfwbgb.mp4",
  "https://spider-avik.zone.id/file/3advij.mp4",
];

let panuIndex = 0;

async function checkVideo(url) {
  try {
    const res = await axios.head(url, {
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    return res.status >= 200 && res.status < 400;
  } catch {
    // Some hosts block HEAD requests.
    // Let WhatsApp try sending the URL anyway.
    return true;
  }
}

Module({
  command: "panu",
  aliases: ["panuvideo", "3x", "hot", "sexy", "xnxx", "xxx"],
  package: "fun",
  description: "Send one PANU video at a time",
})(async (message) => {
  const totalVideos = PANU_VIDEOS.length;
  const url = PANU_VIDEOS[panuIndex];
  const number = panuIndex + 1;

  // Move to the next video.
  // After the last video, restart from the first.
  panuIndex = (panuIndex + 1) % totalVideos;

  try {
    await message.react("⏳");

    const available = await checkVideo(url);

    if (!available) {
      await message.react("❌");
      return message.send(
        `⚠️ PANU video ${number}/${totalVideos} is unavailable right now.`
      );
    }

    await message.send({
      video: { url },
      mimetype: "video/mp4",
      fileName: `panu-${number}.mp4`,
      caption:
        `🎬 3X HOT VIDEO ${number}/${totalVideos}\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `⚡ Powered By ⎯꯭̽ꪹ𝐏𝐀𝐁𝐈𝐓𝐑𝐀-𝐁𝐎𝐓⎯꯭̽💜`,
    });

    await message.react("✅");
  } catch (err) {
    console.error("[PANU]", err?.message || err);

    await message.react("❌");

    return message.send(
      `⚠️ Failed to send HOT video ${number}/${totalVideos}. Try .xxx again.`
    );
  }
});
