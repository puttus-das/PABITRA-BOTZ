import os from "os";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { db } from "../lib/client.js";
import { Module, getCommands } from "../lib/plugins.js";
import config from "../config.js";
import { sendPing } from "../lib/pingCore.js";
import { sendButtonCard, audioButton, ownerContactButton, githubRepoButton, BOT_PROMO_TEXT } from "../lib/buttonCards.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const menuImgPath = path.join(__dirname, "bin", "tg_dp.jpg");
const name = config.botName;
const SC = { a:"ᴀ",b:"ʙ",c:"ᴄ",d:"ᴅ",e:"ᴇ",f:"ꜰ",g:"ɢ",h:"ʜ",i:"ɪ",j:"ᴊ",k:"ᴋ",l:"ʟ",m:"ᴍ",n:"ɴ",o:"ᴏ",p:"ᴘ",q:"ǫ",r:"ʀ",s:"ꜱ",t:"ᴛ",u:"ᴜ",v:"ᴠ",w:"ᴡ",x:"x",y:"ʏ",z:"ᴢ" };
const boldCap = (ch) => String.fromCodePoint(0x1d400 + (ch.toUpperCase().charCodeAt(0) - 65));
// "copilot" → "𝐂ᴏᴘɪʟᴏᴛ"  (digits, emoji and symbols stay as they are)
const fancy = (text) =>
  String(text).replace(/[A-Za-z]+/g, (w) => boldCap(w[0]) + [...w.slice(1)].map((c) => SC[c.toLowerCase()] ?? c).join(""));
const runtime = (secs) => {
  const pad = (s) => s.toString().padStart(2, "0");
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
};
// 𝐁𝐨𝐥𝐝 math letters + digits  (A-Z a-z 0-9)
const MB = (t) =>
  String(t).replace(/[A-Za-z0-9]/g, (c) => {
    const n = c.charCodeAt(0);
    if (n >= 65 && n <= 90) return String.fromCodePoint(0x1d400 + n - 65);
    if (n >= 97 && n <= 122) return String.fromCodePoint(0x1d41a + n - 97);
    return String.fromCodePoint(0x1d7ce + n - 48);
  });

// ids of menu cards we sent (so a tap that only carries the button label can be recognised)
const menuCards = new Set();
const rememberCard = (id) => {
  if (!id) return;
  menuCards.add(id);
  if (menuCards.size > 300) menuCards.delete(menuCards.values().next().value);
};


// Build grouped commands from current plugin list (uses snapshot getter)
function buildGroupedCommands() {
  const cmds = getCommands();
  return cmds
    .filter((cmd) => cmd && cmd.command && cmd.command !== "undefined")
    .reduce((acc, cmd) => {
      const pkg = (cmd.package || "uncategorized").toString().toLowerCase();
      if (!acc[pkg]) acc[pkg] = [];
      acc[pkg].push(cmd.command);
      return acc;
    }, {});
}

// Menu command
Module({
  command: "menu",
  package: "general",
  description: "Show all commands or a specific package",
})(async (message, match) => {
  try {
    try { await message.react("📜"); } catch (_) {}
    const now = new Date();
    const dd = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" }).format(now);
    const tt = now.toLocaleTimeString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true }).toUpperCase();
    const isPublic = db.get(message.botnum, "mode", true) === true;
    const userName = message.pushName || "User";
    const usedGB = ((os.totalmem() - os.freemem()) / 1073741824).toFixed(2);
    const totGB = (os.totalmem() / 1073741824).toFixed(2);
    const ram = `${usedGB} / ${totGB} GB`;

    const grouped = buildGroupedCommands();
    const categories = Object.keys(grouped).sort();
    const totalCmds = Object.values(grouped).reduce((n, arr) => n + arr.length, 0);
    const arg = (match || "").trim().toLowerCase();
    const showAll = arg === "all";
    const prefix = config.prefix;
    const pairUrl = "https://t.me/PABITRA_BOTZ";
    const ownerNumber = String(config.owner || "919641092392").replace(/\D/g, "");
    const ownerChatUrl = `https://wa.me/${ownerNumber}`;

    // ── bold blocks ──
    const catBlock = (cat) => {
      let t = `*╭━━━〔 ✦ ${MB(cat.toUpperCase())} ✦ 〕━━━╮*\n`;
      [...grouped[cat]].sort((a, b) => a.localeCompare(b)).forEach((c) => {
        t += `*┃ ◈ ${fancy(c)}*\n`;
      });
      t += `*╰━━━━━━━━━━━━━━━━━━━╯*\n`;
      return t;
    };
    const buildFullList = () => categories.map(catBlock).join("\n");

    const headerBox =
      `*━━⟪ ${name} ⟫━━*\n\n` +
      `*┃  ◈ ᴍᴏᴅᴇ      ➤ ${MB(isPublic ? "PUBLIC" : "PRIVATE")}*\n` +
      `*┃  ◈ ᴘʀᴇғɪx     ➤ ${prefix}*\n` +
      `*┃  ◈ ᴜsᴇʀ       ➤ ${userName}*\n` +
      `*┃  ✦ ᴜᴘᴛɪᴍᴇ    ➤ ${MB(runtime(process.uptime()))}*\n` +
      `*┃  ✦ ᴄᴏᴍᴍᴀɴᴅs ➤ ${MB(totalCmds)}*\n` +
      `*┃  ✦ ʀᴀᴍ       ➤ ${MB(ram)}*`;
    const footer = `\n\n${config.brandLine}`;

    const sendText = (text) =>
      message.conn.sendMessage(message.from, { text: text.trim() }, { quoted: message.gift });

    // ".menu all" → retain the complete text list as a compatibility option.
    if (showAll) return await sendText(headerBox + "\n\n" + buildFullList() + footer);

    const argParts = arg.split(/\s+/).filter(Boolean);
    const firstArg = argParts[0] || "";
    if (arg && firstArg !== "browse" && !grouped[firstArg]) {
      let t = `🍌 *${fancy("package not found")}: ${match}*\n\n*${fancy("available packages")}*:\n`;
      categories.forEach((c) => { t += `*┃ ◈ ${fancy(c)}*\n`; });
      return await sendText(t + footer);
    }

    // ── Screenshot-style product menu or paginated category buttons ──
    let bodyText = headerBox;
    const quickButton = (label, command) => ({
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({ display_text: label, id: `${prefix}${command}` }),
    });
    const ownerButton = {
      name: "cta_url",
      buttonParamsJson: JSON.stringify({ display_text: "📩 Contact Owner", url: ownerChatUrl, merchant_url: ownerChatUrl }),
    };
    const pinnedButtons = [
      quickButton("━[ 𝐏ɪɴɢ ]━", "ping"),
      quickButton("━[ 𝐀ᴜᴅɪᴏ ]━", "audio"),
    ];
    let buttons;
    if (!arg) {
      bodyText = `${headerBox}\n\n*${fancy("AVAILABLE PACKAGES")}*\n` +
        categories.map((category) => `◈ ${fancy(category)} (${grouped[category].length})`).join("\n");
      buttons = [
        quickButton("ᴍᴇɴᴜ ☰", "menu"),
        quickButton("ᴏᴡɴᴇʀ ♛", "owner"),
        quickButton("ᴘɪɴɢ ᯤ", "ping"),
        quickButton("ᴀʟɪᴠᴇ ✆", "alive"),
        quickButton("ᴘʟᴀʏ ▶", "audio"),
        quickButton("ᴠɪᴅᴇᴏ ▷", "musicvideo"),
        quickButton("ᴍᴜsɪᴄ ♬", "audio"),
        { name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: "🔑 Pair Code", url: pairUrl, merchant_url: pairUrl }) },
      ];
    } else if (firstArg === "browse") {
      const pageSize = 2;
      const totalPages = Math.max(1, Math.ceil(categories.length / pageSize));
      const requestedPage = Math.max(1, parseInt(argParts[1], 10) || 1);
      const page = Math.min(requestedPage, totalPages);
      const visible = categories.slice((page - 1) * pageSize, page * pageSize);
      bodyText = `${headerBox}\n\n*${fancy("command categories")} — ${page}/${totalPages}*\n\n` +
        visible.map((c) => `*┃ ◈ ${fancy(c)}*`).join("\n");
      buttons = visible.map((c) => quickButton(`━[ ${fancy(c)} ]━`, `menu ${c} 1`));
      if (page > 1) buttons.push(quickButton("━[ 𝐏ʀᴇᴠ ]━", `menu browse ${page - 1}`));
      if (page < totalPages) buttons.push(quickButton("━[ 𝐍ᴇxᴛ ]━", `menu browse ${page + 1}`));
      buttons.push(...pinnedButtons);
    } else {
      const category = firstArg;
      const commands = [...grouped[category]].sort((a, b) => a.localeCompare(b));
      const pageSize = 2;
      const totalPages = Math.max(1, Math.ceil(commands.length / pageSize));
      const requestedPage = Math.max(1, parseInt(argParts[1], 10) || 1);
      const page = Math.min(requestedPage, totalPages);
      const visible = commands.slice((page - 1) * pageSize, page * pageSize);
      bodyText = `${headerBox}\n\n*${fancy(category)} — ${fancy("commands")} ${page}/${totalPages}*\n\n` +
        visible.map((c) => `*┃ ◈ ${fancy(c)}*`).join("\n");
      buttons = visible.map((c) => quickButton(`━[ ${fancy(c)} ]━`, c));
      if (page > 1) buttons.push(quickButton("━[ 𝐏ʀᴇᴠ ]━", `menu ${category} ${page - 1}`));
      if (page < totalPages) buttons.push(quickButton("━[ 𝐍ᴇxᴛ ]━", `menu ${category} ${page + 1}`));
      buttons.push(...pinnedButtons);
    }

    // Keep the bot DP, branded text and all menu actions together in one card.
    bodyText += `\n\n${BOT_PROMO_TEXT}`;
    buttons.push(githubRepoButton(), ownerButton);
    const sentIds = await sendButtonCard({
      conn: message.conn,
      jid: message.from,
      buttons,
      body: bodyText,
      footer: config.brandLine,
      quoted: message.gift,
      image: fs.existsSync(menuImgPath) ? fs.readFileSync(menuImgPath) : undefined,
    });
    sentIds.forEach(rememberCard);
  } catch (err) {
    console.error("❌ Menu command error:", err);
    await message.conn.sendMessage(message.from, { text: `❌ Error: ${err?.message || err}` });
  }
});

// PING button on the menu card.
// A tap normally arrives as ".ping" (handled by the ping command). Some WhatsApp versions
// deliver only the button label / a template reply instead — catch those here.
Module({ on: "text" })(async (message) => {
  try {
    const body = (message.body || "").trim();
    if (!body) return;
    const prefix = config.prefix;
    if (body.startsWith(prefix)) return; // normal command path already handles it

    const r = message.raw?.message || {};
    const tapId =
      r.templateButtonReplyMessage?.selectedId ||
      r.buttonsResponseMessage?.selectedButtonId ||
      "";
    const isPingId = tapId === `${prefix}ping`;
    const isPingLabel = [fancy("ping"), "ᴘɪɴɢ", "ping"].includes(body.toLowerCase()) || body === fancy("ping");
    const fromMenu = !!(message.quoted?.id && menuCards.has(message.quoted.id));

    if (isPingId || (isPingLabel && fromMenu)) await sendPing(message);
  } catch (e) {
    console.error("[menu] ping tap error:", e?.message || e);
  }
});

// List command
Module({
  command: "list",
  package: "general",
  description: "List all available commands",
})(async (message) => {
  try {
    const aca = getCommands()
      .filter((cmd) => cmd && cmd.command && cmd.command !== "undefined")
      .map((cmd) => cmd.command)
      .join("\n");
    await message.conn.sendMessage(message.from, {
      text: `*List:*\n${aca}`,
    });
  } catch (err) {
    console.error("❌ List command error:", err);
    await message.conn.sendMessage(message.from, {
      text: `❌ Error: ${err?.message || err}`,
    });
  }
});

// Alive command
Module({
  command: "alive",
  package: "general",
  description: "Check if bot is alive",
})(async (message) => {
  try {
    const hostname = os.hostname();
    const time = new Date().toLocaleTimeString("en-ZA", {
      timeZone: "Africa/Johannesburg",
    });
    const ramUsedMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    const ctx = `
*${name}* is online
*Time:* ${time}
*Host:* ${hostname}
*RAM Usage:* ${ramUsedMB} MB
*Uptime:* ${hours}h ${minutes}m ${seconds}s
\n${BOT_PROMO_TEXT}
`;
    const imagePath = path.join(__dirname, "bin", "tg_dp.jpg");
    await sendButtonCard({
      conn: message.conn,
      jid: message.from,
      buttons: [audioButton(), githubRepoButton(), ownerContactButton()],
      body: ctx.trim(),
      footer: config.brandLine,
      quoted: message.gift,
      image: fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : undefined,
    });
  } catch (err) {
    console.error("❌ Alive command error:", err);
    await message.conn.sendMessage(message.from, {
      text: `❌ Error: ${err?.message || err}`,
    });
  }
});
