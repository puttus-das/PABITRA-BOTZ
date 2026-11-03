import { Module } from "../lib/plugins.js";
import {
  sendButtonCard,
  audioButton,
  ownerContactButton,
  githubRepoButton,
  BOT_PROMO_TEXT
} from "../lib/buttonCards.js";
import { getTheme } from "../Themes/themes.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const theme = getTheme();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Menu DP folder
const MENU_DIR = path.join(__dirname, "bin", "menu");
const FALLBACK_IMAGE = path.join(__dirname, "bin", "tg_dp.jpg");

// Random Menu image picker
function getTagallImage() {
  try {
    const images = fs.readdirSync(MENU_DIR)
      .filter((file) => /\.(jpe?g|png)$/i.test(file));

    if (images.length > 0) {
      const selected =
        images[Math.floor(Math.random() * images.length)];

      return fs.readFileSync(
        path.join(MENU_DIR, selected)
      );
    }
  } catch (err) {
    console.error("[Tagall] Menu image error:", err.message);
  }

  try {
    if (fs.existsSync(FALLBACK_IMAGE)) {
      return fs.readFileSync(FALLBACK_IMAGE);
    }
  } catch (err) {
    console.error("[Tagall] Fallback image error:", err.message);
  }

  return undefined;
}

// ===============================
// TAG ALL MEMBERS
// ===============================

Module({
  command: "tagall",
  package: "group",
  description: "Tag all group members with image card"
})(async (m, text) => {
  if (!m.isGroup) return m.send(theme.isGroup);

  await m.loadGroupInfo();

  try {
    const conn = m.conn;
    const from = m.from;

    const groupMetadata = await conn.groupMetadata(from);
    const participants = groupMetadata.participants || [];
    const groupName = groupMetadata.subject || "Unknown Group";

    const totalMembers = participants.length;

    if (totalMembers === 0) {
      return m.sendreply("❌ No members found in this group.");
    }

    const msgText = text?.trim() || "ATTENTION EVERYONE";

    const emojis = [
      "⚡", "✨", "🎖️", "💎", "🔱",
      "💗", "❤‍🩹", "👻", "🌟", "🪄",
      "🎋", "🪼", "🍿", "👀", "👑",
      "🦋", "🐋", "🌻", "🌸", "🔥",
      "🍉", "🍧", "🍨", "🍦", "🧃",
      "🪀", "🎾", "🪇", "🎲", "🎡",
      "🧸", "🎀", "🎈", "🩵", "♥️",
      "🚩", "🏖️", "🎏", "🫐", "🍓",
      "💋", "🍄", "🎐", "🍇", "🐍",
      "🪻", "🪸", "💀"
    ];

    const getEmoji = () =>
      emojis[Math.floor(Math.random() * emojis.length)];

    // Separate admins and members
    const admins = participants.filter(
      (p) => p.admin === "admin" || p.admin === "superadmin"
    );

    const others = participants.filter(
      (p) => !admins.includes(p)
    );

    // Tag message design
    let tagText =
      `*╭━━〔 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ 〕━━╮*\n` +
      `*┃ ◈ GROUP : ${groupName}*\n` +
      `*┃ ◈ MEMBERS : ${totalMembers}*\n` +
      `*┃ ◈ MESSAGE : ${msgText}*\n` +
      `*╰━━━━━━━━━━━━━━━━━━╯*\n\n` +
      `╭┈─「 ɦเ αℓℓ ƒɾเεɳ∂ร 🥰 」┈❍\n`;

    for (const p of others) {
      const number = p.id.split("@")[0];
      tagText += `│ ${getEmoji()} @${number}\n`;
    }

    // Include admins too
    for (const p of admins) {
      const number = p.id.split("@")[0];
      tagText += `│ 👑 @${number}\n`;
    }

    tagText +=
      `╰────────────❍\n\n` +
      `${BOT_PROMO_TEXT}`;

    // All member mentions
    const mentions = participants.map((p) => p.id);

    // Get random Menu DP
    const image = getTagallImage();

    // Send image card with buttons
    await sendButtonCard({
      conn,
      jid: from,

      buttons: [
        audioButton(),
        githubRepoButton(),
        ownerContactButton()
      ],

      body: tagText,
      quoted: m.raw,
      image,
      imageMaxDimension: 1024,
      mentions
    });

  } catch (err) {
    console.error("tagall error:", err);
    m.sendreply("❌ An error occurred while tagging members.");
  }
});


// ===============================
// TAG ALL ADMINS
// ===============================

Module({
  command: "admin",
  package: "group",
  description: "Tag all group admins"
})(async (m, text) => {
  await m.loadGroupInfo(m.from);

  if (!m.isGroup) return m.send(theme.isGroup);

  try {
    const conn = m.conn;
    const from = m.from;

    const groupMetadata = await conn.groupMetadata(from);
    const participants = groupMetadata.participants || [];
    const groupName = groupMetadata.subject || "Unknown Group";

    const admins = participants.filter(
      (p) => p.admin === "admin" || p.admin === "superadmin"
    );

    const totalAdmins = admins.length;

    if (totalAdmins === 0) {
      return await m.sendReply("❌ No admins found in this group.");
    }

    const msgText = text?.trim() || "ATTENTION ADMINS";

    const emojis = [
      "⚡", "✨", "🎖️", "💎", "🔱",
      "💗", "👻", "🌟", "🪄", "🍿",
      "👀", "👑", "🦋", "🌻", "🌸",
      "🔥", "🍉", "🍓", "🎀", "🎈"
    ];

    const getEmoji = () =>
      emojis[Math.floor(Math.random() * emojis.length)];

    let tagText =
      `*╭━━〔 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ 〕━━╮*\n` +
      `*┃ ◈ GROUP : ${groupName}*\n` +
      `*┃ ◈ ADMINS : ${totalAdmins}*\n` +
      `*┃ ◈ MESSAGE : ${msgText}*\n` +
      `*╰━━━━━━━━━━━━━━━━━━╯*\n\n` +
      `╭┈─「 αℓℓ α∂ɱเɳร 👑 」┈❍\n`;

    for (const admin of admins) {
      const number = admin.id.split("@")[0];
      tagText += `│ ${getEmoji()} @${number}\n`;
    }

    tagText += "╰────────────❍";

    const mentions = admins.map((a) => a.id);

    await conn.sendMessage(
      from,
      {
        text: tagText,
        mentions
      },
      { quoted: m.raw }
    );

  } catch (err) {
    console.error("admin tag error:", err);
    await m.sendReply("❌ An error occurred while tagging admins.");
  }
});


// ===============================
// RANDOM TAG
// ===============================

Module({
  command: "rtag",
  package: "group",
  description: "Tag random members"
})(async (m, text) => {
  if (!m.isGroup) return m.send(theme.isGroup);

  await m.loadGroupInfo();

  try {
    const count = parseInt(text) || 5;
    const participants = m.groupParticipants || [];

    const shuffled = [...participants].sort(
      () => 0.5 - Math.random()
    );

    const selected = shuffled.slice(
      0,
      Math.min(count, participants.length)
    );

    let tagText = `🎲 *Random ${selected.length} Members*\n\n`;
    const mentions = [];

    for (const p of selected) {
      const number = p.id.split("@")[0];
      tagText += `✨ @${number}\n`;
      mentions.push(p.id);
    }

    await m.send({
      text: tagText,
      mentions
    });

  } catch (err) {
    await m.reply("❌ Error: " + err.message);
  }
});


// ===============================
// HIDE TAG
// ===============================

Module({
  command: "hidetag",
  package: "group",
  description: "Tag all without showing names"
})(async (m, text) => {
  if (!m.isGroup) return m.send(theme.isGroup);

  await m.loadGroupInfo();

  if (!m.isAdmin && !m.isFromMe) {
    return m.send(theme.isAdmin);
  }

  try {
    const message =
      text || "📢 Everyone has been tagged!";

    const mentions = m.groupParticipants.map(
      (p) => p.id
    );

    await m.send({
      text: message,
      mentions
    });

    await m.react("👻");

  } catch (err) {
    await m.reply("❌ Error: " + err.message);
  }
});
