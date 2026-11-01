import axios from "axios";
import { Jimp } from "jimp";
import { Module } from "../lib/plugins.js";

const MAX_MEMBERS = 36;
const GRID = 6;
const TILE = 180;
const CANVAS = GRID * TILE;

async function getAvatar(conn, jid) {
  try {
    const url = await conn.profilePictureUrl(jid, "image");
    if (!url) return null;
    const response = await axios.get(url, { responseType: "arraybuffer", timeout: 12_000 });
    return Buffer.from(response.data);
  } catch {
    return null;
  }
}

async function roundAvatar(buffer) {
  const image = await Jimp.read(buffer);
  const size = Math.min(image.bitmap.width, image.bitmap.height);
  const x = Math.floor((image.bitmap.width - size) / 2);
  const y = Math.floor((image.bitmap.height - size) / 2);
  const avatar = image.crop({ x, y, w: size, h: size }).resize({ w: TILE, h: TILE });
  const radius = TILE / 2;
  avatar.scan((px, py, idx) => {
    const dx = px + 0.5 - radius;
    const dy = py + 0.5 - radius;
    if (dx * dx + dy * dy > radius * radius) avatar.bitmap.data[idx + 3] = 0;
  });
  return avatar;
}

Module({
  command: "groupdp",
  aliases: ["memberpp", "roundpp", "gppall"],
  package: "group",
  description: "Create a round profile-picture collage from group members",
  usage: ".groupdp",
})(async (message) => {
  if (!message.isGroup) return message.send("_This command works in groups only_");
  await message.loadGroupInfo();
  if (!message.isAdmin && !message.isfromMe) return message.send("_Only group admins can change the group picture_");
  if (!message.isBotAdmin && !message.isfromMe) return message.send("_Bot must be a group admin_");
  try {
    await message.react?.("⏳");
    const metadata = await message.conn.groupMetadata(message.from);
    const participants = (metadata?.participants || []).slice(0, MAX_MEMBERS);
    if (!participants.length) return message.send("_No group members found_");
    const canvas = new Jimp({ width: CANVAS, height: CANVAS, color: 0xff101820 });
    let added = 0;
    for (let i = 0; i < participants.length; i++) {
      const buffer = await getAvatar(message.conn, participants[i].id);
      if (!buffer) continue;
      try {
        const avatar = await roundAvatar(buffer);
        const col = added % GRID;
        const row = Math.floor(added / GRID);
        canvas.composite(avatar, col * TILE, row * TILE);
        added++;
      } catch (error) {
        console.warn("[groupdp] avatar skipped:", error?.message || error);
      }
    }
    if (!added) return message.send("_Could not load any member profile pictures_");
    const output = await canvas.getBuffer("image/jpeg", { quality: 90 });
    await message.setPp(message.from, output);
    await message.reply(`✅ *Round Group DP Updated*\n\n🖼️ ${added} member profile pictures added\n📐 ${added > GRID ? "6×6" : `${added} avatar`} mosaic`);
    await message.react?.("✅");
  } catch (error) {
    console.error("[groupdp] failed:", error?.message || error);
    await message.react?.("❌");
    await message.send(`❌ Group DP failed: ${error?.message || "try again later"}`);
  }
});
