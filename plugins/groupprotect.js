// plugins/groupprotect.js — Complete Group Protection Suite
// AntiLink, AntiBot, AntiSticker, AntiWord, AntiGhost, Full Warn System

import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";
import { fancyText } from "../lib/fancy.js";

const MODE_ICON = { delete: "🗑️", kick: "👢", warn: "⚠️" };
// status card: ━「 🔗 𝐀ɴᴛɪʟɪɴᴋ 」━ …
function protectCard({ icon, title, on, mode, cmd, extra = "", usage }) {
  const m = String(mode || "delete").toLowerCase();
  const lines = usage || [
    ["🟢", `.${cmd} ${fancyText("on")}`],
    ["🔴", `.${cmd} ${fancyText("off")}`],
    ["👢", `.${cmd} ${fancyText("kick")}`],
    ["⚠️", `.${cmd} ${fancyText("warn")}`],
    ["🗑️", `.${cmd} ${fancyText("delete")}`],
  ];
  return (
    `*━「 ${icon} ${fancyText(title)} 」━*\n` +
    `*┃ 📊 ${fancyText("Status")}: ${on ? "✅" : "❌"} ${fancyText(on ? "On" : "Off")}*\n` +
    `*┃ 🛡️ ${fancyText("Mode")}: ${MODE_ICON[m] || "🛡️"} ${fancyText(m[0].toUpperCase() + m.slice(1))}*\n` +
    extra +
    `\n*┃ 📌 ${fancyText("Usage")}:*\n` +
    lines.map(([e, t]) => `*┃ ${e} ${t}*`).join("\n") +
    `\n\n«© 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ 💜»`
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBotNum(conn) {
  const raw = conn?.user?.id || conn?.user?.jid || "";
  return String(raw).split("@")[0].split(":")[0].replace(/\D/g, "") || null;
}

function gKey(feature, groupJid) {
  return `${feature}:${groupJid}`;
}

function isOwner(message) {
  return !!(message.isFromMe || message.isfromMe);
}

function isAdminOrOwner(message) {
  // NOTE: only the SENDER being admin counts (the bot being admin must not let everyone configure)
  return isOwner(message) || !!(message.isAdmin || message.isGroupAdmin);
}

// digits only, without device suffix / domain → "919641092392"
const numOf = (jid) =>
  String(jid || "")
    .split("@")[0]
    .split(":")[0]
    .replace(/\D/g, "");

/**
 * FIX: message.isAdmin / message.isBotAdmin are only filled in AFTER loadGroupInfo().
 * The old code never called it, so isBotAdmin was always false and every anti-* feature
 * silently did nothing. This loads the metadata and also matches LID <-> phone-number ids.
 */
async function loadAdminInfo(message) {
  if (!message?.isGroup) return message;
  try {
    await message.loadGroupInfo?.();
  } catch {}

  const admins = new Set();
  for (const p of message.groupParticipants || []) {
    if (!p) continue;
    const adm = p.isAdmin === true || p.admin === "admin" || p.admin === "superadmin";
    if (!adm) continue;
    for (const k of [typeof p === "string" ? p : p.id, p.jid, p.phoneNumber, p.lid]) {
      const n = numOf(k);
      if (n) admins.add(n);
    }
  }

  const senderNums = [message.sender, message.key?.participant, message.key?.participantAlt]
    .map(numOf)
    .filter(Boolean);
  const botNums = [message.conn?.user?.id, message.conn?.user?.lid, message.botJid]
    .map(numOf)
    .filter(Boolean);

  if (!message.isAdmin) message.isAdmin = senderNums.some((n) => admins.has(n));
  if (!message.isBotAdmin) message.isBotAdmin = botNums.some((n) => admins.has(n));
  return message;
}

async function checkAdmin(message) {
  await loadAdminInfo(message);
  if (!isAdminOrOwner(message)) {
    await message.send("❌ _Only group admins can use this command_");
    return false;
  }
  return true;
}

async function deleteMsg(message) {
  try {
    await message.conn.sendMessage(message.from, { delete: message.key });
  } catch {
    try {
      await message.send({ delete: message.key });
    } catch {}
  }
}

function getSender(message) {
  return (
    message.sender ||
    message.key?.participant ||
    message.quoted?.sender ||
    message.key?.remoteJid ||
    null
  );
}

function dbGet(botNum, key, fallback) {
  const val = db.get(botNum, key);
  return val !== undefined && val !== null ? val : fallback;
}

async function applyAction(message, senderJid, reason, action, botNum, silent = false) {
  const senderNum = (senderJid || "").split("@")[0];
  const warnKey = gKey(`warn:${senderJid}`, message.from);

  await deleteMsg(message);

  if (action === "delete") {
    if (!silent)
      await message
        .send(`⚠️ @${senderNum} — ${reason}`, { mentions: [senderJid] })
        .catch(() => {});
    return;
  }

  if (action === "warn") {
    const prev = dbGet(botNum, warnKey, 0);
    const warns = (Number(prev) || 0) + 1;
    db.setHot(botNum, warnKey, warns);

    if (warns >= 3) {
      db.delHot(botNum, warnKey);
      await message
        .send(
          `🚫 @${senderNum} — ${reason}\n*3/3 Warnings reached — Removing!*`,
          { mentions: [senderJid] }
        )
        .catch(() => {});
      await new Promise((r) => setTimeout(r, 500));
      await kickUser(message.conn, message.from, senderJid);
    } else {
      await message
        .send(`⚠️ *Warning ${warns}/3* — @${senderNum}: ${reason}`, {
          mentions: [senderJid],
        })
        .catch(() => {});
    }
    return;
  }

  // kick (default)
  await message
    .send(`🚫 @${senderNum} — ${reason}. *Removing...*`, {
      mentions: [senderJid],
    })
    .catch(() => {});
  await new Promise((r) => setTimeout(r, 500));
  await kickUser(message.conn, message.from, senderJid);
}

async function kickUser(conn, groupJid, jid) {
  try {
    await conn.groupParticipantsUpdate(groupJid, [jid], "remove");
  } catch {}
}

// ══════════════════════════════════════════════════════════════════════════════
// ── ANTILINK ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const LINK_REGEX =
  /(https?:\/\/[^\s]+|www\.[^\s]+|chat\.whatsapp\.com\/[^\s]+|wa\.me\/[^\s]+|whatsapp\.com\/channel\/[^\s]+|t\.me\/[^\s]+|telegram\.me\/[^\s]+|discord\.gg\/[^\s]+|bit\.ly\/[^\s]+|youtu\.be\/[^\s]+)/i;

Module({
  command: "antilink",
  package: "group",
  description: "Block links in group. .antilink on/off/kick/warn/delete",
})(async (message, match) => {
  if (!(await checkAdmin(message))) return;
  if (!message.isGroup) return message.send("❌ _Groups only_");

  const botNum = getBotNum(message.conn);
  if (!botNum) return message.send("❌ Bot number not found.");

  const input = (match || "").trim().toLowerCase();
  const enabledKey = `antilink:${message.from}:enabled`;
  const modeKey = `antilink:${message.from}:mode`;

  if (!input) {
    const on = dbGet(botNum, enabledKey, false) === true;
    const mode = dbGet(botNum, modeKey, "delete");
    return message.send(protectCard({ icon: "🔗", title: "Antilink", on, mode, cmd: "antilink" }));
  }
  if (input === "on") {
    db.setHot(botNum, enabledKey, true);
    if (!db.get(botNum, modeKey)) db.setHot(botNum, modeKey, "delete");
    return message.send("✅ *AntiLink ON*");
  }
  if (input === "off") {
    db.setHot(botNum, enabledKey, false);
    return message.send("✅ *AntiLink OFF*");
  }
  if (["kick", "warn", "delete"].includes(input)) {
    db.setHot(botNum, modeKey, input);
    db.setHot(botNum, enabledKey, true);
    return message.send(`✅ *AntiLink mode: ${input.toUpperCase()}*`);
  }
  return message.send("Usage: .antilink on/off/kick/warn/delete");
});

// AntiLink enforcement
Module({
  on: "text",
  package: "group",
  description: "AntiLink enforcement",
})(async (message) => {
  try {
    if (!message?.isGroup) return;
    if (isOwner(message)) return;

    const body = message.body || message.text || "";
    if (!body) return;
    if (!LINK_REGEX.test(body)) return;

    const botNum = getBotNum(message.conn);
    if (!botNum) return;

    const enabledKey = `antilink:${message.from}:enabled`;
    if (dbGet(botNum, enabledKey, false) !== true) return;
    await loadAdminInfo(message);
    if (message.isAdmin || message.isGroupAdmin) return; // admins are never punished
    if (!message.isBotAdmin) return;

    const mode = dbGet(botNum, `antilink:${message.from}:mode`, "delete");
    const senderJid = getSender(message);
    if (!senderJid) return;

    await applyAction(
      message,
      senderJid,
      "Links are not allowed here",
      String(mode),
      botNum
    );
  } catch {}
});

// ══════════════════════════════════════════════════════════════════════════════
// ── ANTIBOT ──────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// Bot JID patterns: multi-device suffix :xx@ or known bot ranges
function isBotJid(jid) {
  if (!jid) return false;
  // Multi-device linked devices always have :N@ suffix
  if (/:\d+@s\.whatsapp\.net$/.test(jid)) return true;
  // Known bot number ranges (uncomment if needed)
  // const num = jid.split("@")[0].split(":")[0];
  // if (num.startsWith("1800") || num.startsWith("1888")) return true;
  return false;
}

Module({
  command: "antibot",
  package: "group",
  description: "Block bots from joining. .antibot on/off/kick/warn/delete",
})(async (message, match) => {
  if (!(await checkAdmin(message))) return;
  if (!message.isGroup) return message.send("❌ _Groups only_");

  const botNum = getBotNum(message.conn);
  if (!botNum) return message.send("❌ Bot number not found.");

  const input = (match || "").trim().toLowerCase();
  const enabledKey = gKey("antibot:enabled", message.from);
  const modeKey = gKey("antibot:mode", message.from);

  if (!input) {
    const on = dbGet(botNum, enabledKey, false) === true;
    const mode = dbGet(botNum, modeKey, "kick");
    return message.send(protectCard({ icon: "🤖", title: "Antibot", on, mode, cmd: "antibot" }));
  }
  if (input === "on") {
    db.setHot(botNum, enabledKey, true);
    if (!db.get(botNum, modeKey)) db.setHot(botNum, modeKey, "kick");
    return message.send("✅ *AntiBot ON*");
  }
  if (input === "off") {
    db.setHot(botNum, enabledKey, false);
    return message.send("✅ *AntiBot OFF*");
  }
  if (["kick", "warn", "delete"].includes(input)) {
    db.setHot(botNum, modeKey, input);
    db.setHot(botNum, enabledKey, true);
    return message.send(`✅ *AntiBot mode: ${input.toUpperCase()}*`);
  }
  return message.send("Usage: .antibot on/off/kick/warn/delete");
});

// AntiBot enforcement — group-participants.update
Module({
  on: "group-participants.update",
  package: "group",
  description: "AntiBot enforcement on join",
})(async (message, event, sock) => {
  try {
    // event object: { id: groupJid, action: "add"|"remove", participants: [...] }
    const groupJid = event?.id || message?.from;
    const action = event?.action || message?.action;
    const parts = event?.participants || message?.participants || [];
    const conn = sock || message?.conn;

    if (action !== "add") return;
    if (!conn?.user?.id) return;

    const botNum = conn.user.id.split("@")[0].split(":")[0].replace(/\D/g, "");
    const enabledKey = gKey("antibot:enabled", groupJid);
    if (dbGet(botNum, enabledKey, false) !== true) return;

    const mode = dbGet(botNum, gKey("antibot:mode", groupJid), "kick");

    for (const jid of parts) {
      if (!isBotJid(jid)) continue;
      // Don't kick yourself
      const selfNum = conn.user.id.split(":")[0];
      if (jid.startsWith(selfNum)) continue;

      const num = jid.split("@")[0].split(":")[0];

      if (mode === "kick") {
        await conn
          .groupParticipantsUpdate(groupJid, [jid], "remove")
          .catch(() => {});
        await conn
          .sendMessage(groupJid, {
            text: `🤖 Bot *@${num}* was detected and removed.`,
            mentions: [jid],
          })
          .catch(() => {});
      } else {
        await conn
          .sendMessage(groupJid, {
            text: `⚠️ Bot *@${num}* detected. Please review.`,
            mentions: [jid],
          })
          .catch(() => {});
      }
    }
  } catch {}
});

// ══════════════════════════════════════════════════════════════════════════════
// ── ANTISTICKER ──────────────────────────────────════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════

Module({
  command: "antisticker",
  package: "group",
  description: "Block stickers in group. .antisticker on/off/kick/warn/delete",
})(async (message, match) => {
  if (!(await checkAdmin(message))) return;
  if (!message.isGroup) return message.send("❌ _Groups only_");

  const botNum = getBotNum(message.conn);
  if (!botNum) return message.send("❌ Bot number not found.");

  const input = (match || "").trim().toLowerCase();
  const enabledKey = gKey("antisticker:enabled", message.from);
  const modeKey = gKey("antisticker:mode", message.from);

  if (!input) {
    const on = dbGet(botNum, enabledKey, false) === true;
    const mode = dbGet(botNum, modeKey, "delete");
    return message.send(protectCard({ icon: "🎭", title: "Antisticker", on, mode, cmd: "antisticker" }));
  }
  if (input === "on") {
    db.setHot(botNum, enabledKey, true);
    if (!db.get(botNum, modeKey)) db.setHot(botNum, modeKey, "delete");
    return message.send("✅ *AntiSticker ON*");
  }
  if (input === "off") {
    db.setHot(botNum, enabledKey, false);
    return message.send("✅ *AntiSticker OFF*");
  }
  if (["kick", "warn", "delete"].includes(input)) {
    db.setHot(botNum, modeKey, input);
    db.setHot(botNum, enabledKey, true);
    return message.send(`✅ *AntiSticker mode: ${input.toUpperCase()}*`);
  }
  return message.send("Usage: .antisticker on/off/kick/warn/delete");
});

// AntiSticker enforcement — must use "message" or "sticker" event, NOT "text"
Module({
  on: "message",
  package: "group",
  description: "AntiSticker enforcement",
})(async (message) => {
  try {
    if (!message?.isGroup) return;
    if (isOwner(message)) return;

    // Detect sticker by type
    const mtype = message.type || message.mtype || "";
    const isSticker =
      mtype === "stickerMessage" ||
      !!message.raw?.message?.stickerMessage ||
      !!message.message?.stickerMessage;

    if (!isSticker) return;

    const botNum = getBotNum(message.conn);
    if (!botNum) return;

    const enabledKey = gKey("antisticker:enabled", message.from);
    if (dbGet(botNum, enabledKey, false) !== true) return;
    await loadAdminInfo(message);
    if (message.isAdmin || message.isGroupAdmin) return; // admins are never punished
    if (!message.isBotAdmin) return;

    const mode = dbGet(
      botNum,
      gKey("antisticker:mode", message.from),
      "delete"
    );
    const senderJid = getSender(message);
    if (!senderJid) return;

    await applyAction(
      message,
      senderJid,
      "Stickers are not allowed here",
      String(mode),
      botNum,
      true // delete mode: just delete the sticker, no warning message
    );
  } catch {}
});

// ══════════════════════════════════════════════════════════════════════════════
// ── ANTIWORD ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

Module({
  command: "antiword",
  package: "group",
  description:
    "Block words in group. .antiword add/remove/list/on/off/kick/warn/delete",
})(async (message, match) => {
  if (!(await checkAdmin(message))) return;
  if (!message.isGroup) return message.send("❌ _Groups only_");

  const botNum = getBotNum(message.conn);
  if (!botNum) return message.send("❌ Bot number not found.");

  const input = (match || "").trim().toLowerCase();
  const enabledKey = gKey("antiword:enabled", message.from);
  const modeKey = gKey("antiword:mode", message.from);
  const wordsKey = gKey("antiword:words", message.from);

  if (!input) {
    const on = dbGet(botNum, enabledKey, false) === true;
    const mode = dbGet(botNum, modeKey, "delete");
    const words = dbGet(botNum, wordsKey, []);
    return message.send(
      protectCard({
        icon: "🔤",
        title: "Antiword",
        on,
        mode,
        cmd: "antiword",
        extra: `*┃ 📝 ${fancyText("Words")} (${words.length}): ${words.length ? words.join(", ") : fancyText("none")}*
`,
        usage: [
          ["➕", `.antiword ${fancyText("add")} <${fancyText("word")}>`],
          ["➖", `.antiword ${fancyText("remove")} <${fancyText("word")}>`],
          ["📋", `.antiword ${fancyText("list")}`],
          ["🟢", `.antiword ${fancyText("on")}`],
          ["🔴", `.antiword ${fancyText("off")}`],
          ["👢", `.antiword ${fancyText("kick")} / ${fancyText("warn")} / ${fancyText("delete")}`],
        ],
      })
    );
  }

  if (input === "on") {
    db.setHot(botNum, enabledKey, true);
    return message.send("✅ *AntiWord ON*");
  }
  if (input === "off") {
    db.setHot(botNum, enabledKey, false);
    return message.send("✅ *AntiWord OFF*");
  }
  if (["kick", "warn", "delete"].includes(input)) {
    db.setHot(botNum, modeKey, input);
    db.setHot(botNum, enabledKey, true);
    return message.send(`✅ *AntiWord mode: ${input.toUpperCase()}*`);
  }
  if (input === "list") {
    const words = dbGet(botNum, wordsKey, []);
    return message.send(
      `📋 *Blocked Words (${words.length}):*\n` +
        (words.length
          ? words.map((w, i) => `${i + 1}. ${w}`).join("\n")
          : "None")
    );
  }

  const spaceIdx = input.indexOf(" ");
  const sub = spaceIdx !== -1 ? input.slice(0, spaceIdx) : input;
  const word =
    spaceIdx !== -1
      ? (match || "")
          .trim()
          .slice(spaceIdx + 1)
          .trim()
          .toLowerCase()
      : "";

  if (sub === "add") {
    if (!word)
      return message.send(
        "❌ _Provide a word to block. Example: .antiword add badword_"
      );
    const words = dbGet(botNum, wordsKey, []);
    if (words.includes(word))
      return message.send(`ℹ️ _"${word}" already blocked_`);
    words.push(word);
    db.setHot(botNum, wordsKey, words);
    db.setHot(botNum, enabledKey, true);
    return message.send(`✅ Word blocked: \`${word}\``);
  }
  if (sub === "remove") {
    if (!word)
      return message.send(
        "❌ _Provide a word to remove. Example: .antiword remove badword_"
      );
    let words = dbGet(botNum, wordsKey, []);
    if (!words.includes(word))
      return message.send(`ℹ️ _"${word}" not in list_`);
    words = words.filter((w) => w !== word);
    db.setHot(botNum, wordsKey, words);
    return message.send(`✅ Word removed: \`${word}\``);
  }

  return message.send(
    "Usage: .antiword add <word> | remove <word> | list | on/off/kick/warn/delete"
  );
});

// AntiWord enforcement
Module({
  on: "text",
  package: "group",
  description: "AntiWord enforcement",
})(async (message) => {
  try {
    if (!message?.isGroup) return;
    if (isOwner(message)) return;

    const body = message.body || message.text || "";
    if (!body) return;

    const botNum = getBotNum(message.conn);
    if (!botNum) return;

    const enabledKey = gKey("antiword:enabled", message.from);
    if (dbGet(botNum, enabledKey, false) !== true) return;
    await loadAdminInfo(message);
    if (message.isAdmin || message.isGroupAdmin) return; // admins are never punished
    if (!message.isBotAdmin) return;

    const words = dbGet(botNum, gKey("antiword:words", message.from), []);
    if (!words.length) return;

    const lbody = body.toLowerCase();
    const matched = words.find((w) => lbody.includes(w.toLowerCase()));
    if (!matched) return;

    const mode = dbGet(botNum, gKey("antiword:mode", message.from), "delete");
    const senderJid = getSender(message);
    if (!senderJid) return;

    await applyAction(
      message,
      senderJid,
      `Blocked word: "${matched}"`,
      String(mode),
      botNum
    );
  } catch {}
});

// ══════════════════════════════════════════════════════════════════════════════
// ── WARN SYSTEM ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

Module({
  command: "warn",
  package: "group",
  description: "Warn a user (3 warns = kick). .warn @user [reason]",
})(async (message, match) => {
  try {
    if (!(await checkAdmin(message))) return;
    if (!message.isGroup) return message.send("❌ _Groups only_");
    if (!message.isBotAdmin)
      return message.send("❌ _Bot must be admin to warn users_");

    const senderJid =
      message.mentions?.[0] ||
      message.quoted?.sender ||
      message.quoted?.participant ||
      message.quoted?.key?.participant;

    if (!senderJid) return message.send("❌ _Tag or reply to a user to warn_");
    if (
      isOwner({
        key: { participant: senderJid },
        isFromMe: senderJid === message.conn?.user?.id,
      })
    ) {
      return message.send("❌ _Cannot warn the bot owner_");
    }

    const botNum = getBotNum(message.conn);
    if (!botNum) return message.send("❌ Bot number not found.");

    const reason =
      (match || "").replace(/@\d+/g, "").trim() || "Rule violation";
    const warnKey = gKey(`warn:${senderJid}`, message.from);
    const prev = dbGet(botNum, warnKey, 0);
    const warns = (Number(prev) || 0) + 1;
    db.setHot(botNum, warnKey, warns);

    const num = senderJid.split("@")[0];

    if (warns >= 3) {
      db.delHot(botNum, warnKey);
      await message.send(
        `🚫 @${num} — *3/3 Warnings reached!*\nReason: ${reason}\n\n_Removing from group..._`,
        { mentions: [senderJid] }
      );
      await new Promise((r) => setTimeout(r, 600));
      await kickUser(message.conn, message.from, senderJid);
    } else {
      await message.send(
        `⚠️ *Warning ${warns}/3* for @${num}\n📝 Reason: ${reason}`,
        { mentions: [senderJid] }
      );
    }
    await message.react("✅");
  } catch {
    await message.react("❌");
    await message.send("❌ _Failed to warn user_");
  }
});

Module({
  command: "warnreset",
  package: "group",
  aliases: ["resetwarn", "clearwarn"],
  description: "Reset warns for a user. .warnreset @user",
})(async (message) => {
  if (!(await checkAdmin(message))) return;
  if (!message.isGroup) return message.send("❌ _Groups only_");

  const senderJid =
    message.mentions?.[0] ||
    message.quoted?.sender ||
    message.quoted?.participant ||
    message.quoted?.key?.participant;

  if (!senderJid) return message.send("❌ _Tag or reply to a user_");

  const botNum = getBotNum(message.conn);
  if (!botNum) return message.send("❌ Bot number not found.");

  db.delHot(botNum, gKey(`warn:${senderJid}`, message.from));
  await message.react("✅");
  return message.send(`✅ Warnings cleared for @${senderJid.split("@")[0]}`, {
    mentions: [senderJid],
  });
});

Module({
  command: "warncount",
  package: "group",
  aliases: ["warns", "checkwarn"],
  description: "Check warns for a user. .warncount @user",
})(async (message) => {
  if (!message.isGroup) return message.send("❌ _Groups only_");

  const senderJid =
    message.mentions?.[0] ||
    message.quoted?.sender ||
    message.quoted?.participant ||
    message.quoted?.key?.participant;

  if (!senderJid) return message.send("❌ _Tag or reply to a user_");

  const botNum = getBotNum(message.conn);
  if (!botNum) return message.send("❌ Bot number not found.");

  const warns =
    Number(dbGet(botNum, gKey(`warn:${senderJid}`, message.from), 0)) || 0;
  return message.send(
    `⚠️ *Warn Count for @${senderJid.split("@")[0]}:* ${warns}/3`,
    { mentions: [senderJid] }
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// ── ANTIGHOST ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

Module({
  command: "antighost",
  package: "group",
  aliases: ["antifake"],
  description: "Enable/disable antighost. .antighost on/off",
})(async (message, match) => {
  if (!(await checkAdmin(message))) return;
  if (!message.isGroup) return message.send("❌ _Groups only_");

  const botNum = getBotNum(message.conn);
  if (!botNum) return message.send("❌ Bot number not found.");

  const input = (match || "").trim().toLowerCase();
  const key = gKey("antighost:enabled", message.from);

  if (input === "on") {
    db.setHot(botNum, key, true);
    return message.send(
      "✅ *AntiGhost ON*\n_Members who ghost will be warned_"
    );
  }
  if (input === "off") {
    db.setHot(botNum, key, false);
    return message.send("✅ *AntiGhost OFF*");
  }

  const on = dbGet(botNum, key, false) === true;
  return message.send(
    `👻 *AntiGhost*\n> Status: ${
      on ? "✅ ON" : "❌ OFF"
    }\n\nUse: .antighost on/off`
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// ── PROTECTION STATUS ────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

Module({
  command: "protection",
  package: "group",
  aliases: ["gpstatus", "groupprotect"],
  description: "Show all group protection settings",
})(async (message) => {
  if (!message.isGroup) return message.send("❌ _Groups only_");

  const botNum = getBotNum(message.conn);
  if (!botNum) return message.send("❌ Bot number not found.");
  const g = message.from;

  const flag = (k) => (dbGet(botNum, k, false) === true ? "✅" : "❌");
  const mode = (k) => dbGet(botNum, k, "—") || "—";

  return message.send(
    `🛡️ *Group Protection Status*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🔗 AntiLink:    ${flag(`antilink:${g}:enabled`)} │ Mode: ${mode(
        `antilink:${g}:mode`
      )}\n` +
      `🤖 AntiBot:     ${flag(gKey("antibot:enabled", g))} │ Mode: ${mode(
        gKey("antibot:mode", g)
      )}\n` +
      `🎭 AntiSticker: ${flag(gKey("antisticker:enabled", g))} │ Mode: ${mode(
        gKey("antisticker:mode", g)
      )}\n` +
      `🔤 AntiWord:    ${flag(gKey("antiword:enabled", g))} │ Mode: ${mode(
        gKey("antiword:mode", g)
      )}\n` +
      `👻 AntiGhost:   ${flag(gKey("antighost:enabled", g))}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*Commands:*\n` +
      `.antilink | .antibot | .antisticker | .antiword | .antighost | .warn | .protection`
  );
});
