import config from "../config.js";
import { Module } from "../lib/plugins.js";

const ownerNumber = String(config.owner || "").replace(/\D/g, "");
const ownerJid = ownerNumber ? `${ownerNumber}@s.whatsapp.net` : "";

function pureMention(body) {
  // Auto mode should react only when the message is just an @mention, not to
  // tagall commands or ordinary messages that happen to contain a mention.
  return String(body || "").replace(/@[\d\s()+-]+/g, "").trim() === "";
}
function numberJid(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? `${digits}@s.whatsapp.net` : "";
}
async function sendProfile(message, target, automatic = false) {
  if (!target || !ownerJid) return false;
  try {
    const ppUrl = await message.conn.profilePictureUrl(target, "image");
    if (!ppUrl) throw new Error("no profile picture");
    await message.conn.sendMessage(ownerJid, {
      image: { url: ppUrl },
      caption: `🖼️ *Tagged Member Profile*\n\n👤 @${target.split("@")[0]}\n📍 Source: Group mention\n✨ Full quality profile picture`,
      mentions: [target],
    });
    return true;
  } catch (error) {
    console.warn("[mentionpp] profile picture unavailable:", error?.message || error);
    if (!automatic) await message.send("_This user has no accessible profile picture or has restricted it._");
    return false;
  }
}

// Owner/admin can simply send: @member
Module({
  on: "message",
  package: "profile",
  description: "Send a mentioned member's profile picture to the owner inbox",
})(async (message) => {
  if (!message?.isGroup || message.isFromMe === false && !message.isAdmin) return;
  if (!message.mentions?.length || !pureMention(message.body)) return;
  await sendProfile(message, String(message.mentions[0]), true);
});

// Explicit fallback: .mentionpp @user or reply to a member.
Module({
  command: "mentionpp",
  aliases: ["tagpp", "ppmember"],
  package: "profile",
  description: "Send a user's profile picture to the owner inbox",
  usage: ".mentionpp @user | reply to a user",
})(async (message, match) => {
  if (!message.isFromMe && !message.isAdmin) return message.send("_Only the owner or group admins can use this_");
  const target = String(message.mentions?.[0] || message.quoted?.participant || numberJid(match)).trim();
  if (!target) return message.send("_Mention a user or reply to their message_\n\nExample: .mentionpp @user");
  await message.react?.("⏳");
  const ok = await sendProfile(message, target, false);
  await message.react?.(ok ? "✅" : "❌");
  if (ok) await message.reply("✅ Profile picture sent to the owner inbox.");
});
