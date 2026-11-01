import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { proto, generateWAMessageFromContent, prepareWAMessageMedia } from "baileys";
import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const menuDir = path.join(__dirname, "bin", "menu");
const runtime = new Map();
const KEY = (jid) => `rank:${jid}`;

function scopeFor(message) {
  return String(message.botnum || message.conn?.user?.id || "bot").split("@")[0];
}
function menuImage() {
  try {
    const files = fs.readdirSync(menuDir).filter((f) => /\.(jpe?g|png)$/i.test(f));
    if (files.length) return path.join(menuDir, files[Math.floor(Math.random() * files.length)]);
  } catch {}
  return null;
}
function freshRecord() {
  return { counts: Object.create(null), names: Object.create(null), updatedAt: Date.now() };
}
function mergeRecord(base, extra) {
  const out = freshRecord();
  for (const [jid, count] of Object.entries(base?.counts || {})) out.counts[jid] = Number(count) || 0;
  for (const [jid, name] of Object.entries(base?.names || {})) out.names[jid] = String(name || "User");
  for (const [jid, count] of Object.entries(extra?.counts || {})) out.counts[jid] = Math.max(out.counts[jid] || 0, Number(count) || 0);
  for (const [jid, name] of Object.entries(extra?.names || {})) out.names[jid] = String(name || out.names[jid] || "User");
  out.updatedAt = Date.now();
  return out;
}

// Count all incoming group messages without adding another visible command.
Module({ on: "message", package: "rank" })(async (message) => {
  if (!message?.isGroup || message.isFromMe || !message.sender) return;
  const group = String(message.from);
  let record = runtime.get(group);
  if (!record) {
    record = mergeRecord(db.get(scopeFor(message), KEY(group), freshRecord()), null);
    runtime.set(group, record);
  }
  const jid = String(message.sender);
  record.counts[jid] = (record.counts[jid] || 0) + 1;
  record.names[jid] = message.pushName || record.names[jid] || "User";
  record.updatedAt = Date.now();
  // Persist periodically; the in-memory counter keeps the hot message path fast.
  if (record.counts[jid] % 10 === 0) db.set(scopeFor(message), KEY(group), record).catch(() => {});
});

async function sendRankCard(message, rows, title) {
  const imagePath = menuImage();
  try {
    const P = proto.Message.InteractiveMessage;
    const imageMessage = imagePath
      ? (await prepareWAMessageMedia({ image: fs.readFileSync(imagePath) }, { upload: message.conn.waUploadToServer })).imageMessage
      : null;
    const text = `${title}\n\n${rows.length ? rows.map((row, i) => `${i + 1}. @${row.jid.split("@")[0]} — *${row.count} msgs*`).join("\n") : "No activity recorded yet."}`;
    const msg = generateWAMessageFromContent(message.from, {
      viewOnceMessage: { message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage: P.create({
          body: P.Body.create({ text }),
          footer: P.Footer.create({ text: "PABITRA-BOT • Group Leaderboard" }),
          header: P.Header.create({ hasMediaAttachment: !!imageMessage, ...(imageMessage ? { imageMessage } : {}) }),
          nativeFlowMessage: P.NativeFlowMessage.create({ buttons: [
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "🔄 REFRESH", id: ".rank" }) },
            { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "👤 MY RANK", id: ".rank me" }) },
          ] }),
        }),
      } },
    }, { quoted: message.raw || message.gift, userJid: message.conn.user?.id });
    await message.conn.relayMessage(message.from, msg.message, { messageId: msg.key.id });
  } catch (error) {
    console.error("[rank] card failed:", error?.message || error);
    await message.reply(`${title}\n\n${rows.map((row, i) => `${i + 1}. @${row.jid.split("@")[0]} — ${row.count} msgs`).join("\n") || "No activity recorded yet."}`, { mentions: rows.map((r) => r.jid) });
  }
}

Module({
  command: "rank",
  aliases: ["leaderboard", "topmembers", "myrank"],
  package: "rank",
  description: "Show the group activity leaderboard",
  usage: ".rank | .rank me | .rank reset",
})(async (message, match) => {
  if (!message.isGroup) return message.send("_Rank works inside a group only_");
  await message.loadGroupInfo();
  const arg = String(match || "").trim().toLowerCase();
  const scope = scopeFor(message);
  if (arg === "reset") {
    if (!message.isAdmin && !message.isfromMe) return message.send("_Only group admins can reset the leaderboard_");
    runtime.delete(message.from);
    await db.set(scope, KEY(message.from), freshRecord());
    return message.reply("✅ *Group leaderboard reset successfully*");
  }
  const saved = db.get(scope, KEY(message.from), freshRecord());
  const record = mergeRecord(saved, runtime.get(message.from));
  runtime.set(message.from, record);
  await db.set(scope, KEY(message.from), record);
  const participants = (message.groupParticipants || []).map((p) => String(p.id || p.jid || ""));
  const allowed = participants.length ? new Set(participants) : null;
  const rows = Object.entries(record.counts)
    .filter(([jid]) => !allowed || allowed.has(jid))
    .map(([jid, count]) => ({ jid, count: Number(count) || 0, name: record.names[jid] || "User" }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  if (arg === "me") {
    const jid = String(message.sender || "");
    const all = Object.entries(record.counts).sort((a, b) => b[1] - a[1]);
    const position = all.findIndex(([id]) => id === jid) + 1;
    return message.reply(`👤 *Your Rank*\n\n@${jid.split("@")[0]}\n🏆 Position: *${position || "unranked"}*\n💬 Messages: *${record.counts[jid] || 0}*`, { mentions: jid ? [jid] : [] });
  }
  await sendRankCard(message, rows, `🏆 *${message.groupMetadata?.subject || "Group"} Leaderboard*`);
});
