import { Module } from "../lib/plugins.js";
import config from "../config.js";
import { sendButtonCard } from "../lib/buttonCards.js";

const BOT_NAME = "𝐏ᴀʙɪᴛʀᴀ 𝐏ᴀᴜʟ";
const OWNER = "𝐏ᴀʙɪᴛʀᴀ 𝐏ᴀᴜʟ";
const CONTACT = "91 96410 92392";

const button = (prefix, label, command) => ({
  name: "quick_reply",
  buttonParamsJson: JSON.stringify({
    display_text: label,
    id: `${prefix}${command}`,
  }),
});

export function buildMenuText(message = {}, prefix = ".") {
  const user = String(message.pushName || "User").trim() || "User";
  return [
    `╭━━━〔 💜 ${BOT_NAME} 〕━━━╮`,
    "┃",
    "┃ ✨ 𝐖ᴇʟᴄᴏᴍᴇ 𝐓ᴏ 𝐏ᴀʙɪᴛʀᴀ",
    `┃ 👤 𝐔ꜱᴇʀ : ${user}`,
    `┃ 👑 𝐎ᴡɴᴇʀ : ${OWNER}`,
    `┃ 📞 𝐂ᴏɴᴛᴀᴄᴛ : ${CONTACT}`,
    "┃",
    "┃ ⚡ 𝐐ᴜɪᴄᴋ 𝐀ᴄᴛɪᴏɴꜱ",
    `┃ • ${prefix}ping  — bot status`,
    `┃ • ${prefix}owner — owner contact`,
    `┃ • ${prefix}gmenu — group commands`,
    "┃",
    "┃ 👥 𝐆ʀᴏᴜᴘ & 𝐓ᴀɢ",
    `┃ • ${prefix}tagall — mention everyone`,
    `┃ • ${prefix}ptag — hidden personal tag`,
    `┃ • ${prefix}tagadmins — mention admins`,
    `┃ • ${prefix}totag — tag by reply`,
    `┃ • ${prefix}everyone — group tag`,
    `┃ • ${prefix}rank — member rank / price tag`,
    "┃",
    "┃ 🎭 𝐓ᴀɢ 𝐒ᴛʏʟᴇꜱ",
    "┃ • Hang tag / hidden tag",
    "┃ • Swing tag / mention style",
    "┃ • Price tag / rank card",
    "┃",
    "┃ 🛠️ 𝐓ᴏᴏʟꜱ",
    `┃ • ${prefix}menu — this menu`,
    `┃ • ${prefix}font — fancy fonts`,
    `┃ • ${prefix}run — owner code runner`,
    `┃ • ${prefix}crm — message replay info`,
    "┃",
    "╰━━━━━━━━━━━━━━━━━━╯",
    "",
    "👇 𝐂ʜᴏᴏsᴇ 𝐀ɴ 𝐈ᴄᴏɴ-𝐓ᴇxᴛ 𝐁ᴜᴛᴛᴏɴ",
  ].join("\n");
}

export function buildMenuButtons(prefix = ".") {
  return [
    button(prefix, "📚 Commands", "gmenu"),
    button(prefix, "⚡ Ping", "ping"),
    button(prefix, "👑 Owner", "owner"),
  ];
}

Module({
  command: "menu",
  aliases: ["startmenu", "allmenu"],
  package: "general",
  description: "Show the PABITRA command menu",
  usage: ".menu",
})(async (message) => {
  try {
    const prefix = config.prefix || ".";
    await sendButtonCard({
      conn: message.conn,
      jid: message.from,
      body: buildMenuText(message, prefix),
      footer: config.brandLine,
      buttons: buildMenuButtons(prefix),
      quoted: message.raw,
      userJid: message.conn.user?.id,
    });
  } catch (error) {
    console.error("[PABITRA MENU ERROR]", error?.message || error);
    await message.send(`❌ Menu failed: ${error?.message || "WhatsApp rejected the menu"}`);
  }
});
