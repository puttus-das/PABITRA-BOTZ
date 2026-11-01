import os from "os";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { db } from "../lib/client.js";
import { Module, getCommands } from "../lib/plugins.js";
import config from "../config.js";
import { proto, generateWAMessageFromContent, prepareWAMessageMedia } from "baileys";
import { sendPing } from "../lib/pingCore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const menuImgPath = path.join(__dirname, "bin", "menu.jpg");
const menuThumbPath = path.join(__dirname, "bin", "menu_thumb.jpg");
let _menuThumb = null;
const getMenuThumb = () => {
  if (_menuThumb) return _menuThumb;
  const f = fs.existsSync(menuThumbPath) ? menuThumbPath : menuImgPath;
  try { _menuThumb = fs.readFileSync(f); } catch { _menuThumb = null; }
  return _menuThumb;
};
// Keep the existing menu DP files and choose a different old image on each
// home-menu request. The newer optional DP is intentionally not used here.
const MENU_DIR = path.join(__dirname, "bin", "menu");
let _lastMenuImg = "";
const menuMediaCache = new Map(); // image path → { m: imageMessage, t: uploadedAt }
const pickMenuImg = () => {
  try {
    const menuDirImages = fs.readdirSync(MENU_DIR)
      .filter((x) => /\.(jpe?g|png)$/i.test(x))
      .filter((x) => x !== "menu-pabitra-new.jpg")
      .map((x) => path.join(MENU_DIR, x));
    const oldImages = ["menu.jpg", "menu_pabitra_old.jpg", "menu2-thumb.jpg", "menu_thumb.jpg"]
      .map((x) => path.join(__dirname, "bin", x))
      .filter((x) => fs.existsSync(x));
    const all = [...new Set([...menuDirImages, ...oldImages])];
    const pool = all.length > 1 ? all.filter((x) => x !== _lastMenuImg) : all;
    if (pool.length) {
      _lastMenuImg = pool[Math.floor(Math.random() * pool.length)];
      return _lastMenuImg;
    }
  } catch {}
  return menuImgPath;
};
const legacyButton = (buttonId, displayText) => ({
  buttonId: `${config.prefix}${buttonId}`,
  buttonText: { displayText },
  type: 1,
});
async function sendLegacyButtonsMenu(message) {
  const chat = message.from;
  if (!chat) return message.send("Could not determine this chat.");
  const imagePath = pickMenuImg();
  const thumbnail = fs.existsSync(imagePath) ? fs.readFileSync(imagePath) : getMenuThumb();
  const isPublic = db.get(message.botnum, "mode", true) === true;
  const totalCommands = getCommands().filter((cmd) => cmd?.command && cmd.command !== "undefined").length;
  const menuText =
`┌────〔 ✨ *${name}* ✨ 〕────┐
│ 👋 ɢᴏᴏᴅ ᴍᴏʀɴɪɴɢ
│ 👑 *ᴏᴡɴᴇʀ*    ➜ ${config.ownerName}
│ ⚙️ *ᴘʀᴇғɪx*   ➜ ${config.prefix}
│ 🔒 *ᴍᴏᴅᴇ*     ➜ ${isPublic ? "ᴘᴜʙʟɪᴄ" : "ᴘʀɪᴠᴀᴛᴇ"}
│ 🧩 *ᴘʟᴜɢɪɴs*  ➜ ${totalCommands}
│ 🏷️ *ᴠᴇʀsɪᴏɴ*  ➜ 3.0.0
└────────────────────────┘`;
  const payload = {
    buttonsMessage: {
      buttons: [
        legacyButton("ping", "ᴘɪɴɢ ᯤ"),
        legacyButton("alive", "ᴀʟɪᴠᴇ ✆"),
      ],
      locationMessage: {
        degreesLatitude: 0,
        degreesLongitude: 0,
        name,
        address: config.ownerName,
        jpegThumbnail: thumbnail,
      },
      contentText: menuText,
      footerText: `𝐏𝐨ᴡᴇʀᴇᴅ 𝐁ʏ ${name}`,
      headerType: 6,
    },
  };
  try {
    const outgoing = generateWAMessageFromContent(chat, payload, {
      quoted: message.gift,
      userJid: message.conn.user?.id,
    });
    await message.conn.relayMessage(chat, outgoing.message, {
      messageId: outgoing.key.id,
    });
    rememberCard(outgoing.key.id);
  } catch (error) {
    console.error("[menu] ButtonsMessage menu failed:", error?.message || error);
    await message.send("Use .ping, .alive, or .owner.");
  }
}
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
// never wait minutes on a stuck media upload — give up after `ms` and fall back
const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} upload timed out (${ms / 1000}s)`)), ms)),
  ]);
const readMore = String.fromCharCode(8206).repeat(4001);

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
    const footer = `\n\n> © ${name}\n*~_Made with love by ${name}_~*`;

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

    // Randomly alternate between the new location-buttons menu and the previous
    // interactive button menu. Category browsing always keeps pagination.
    if (!arg) {
      if (Math.random() < 0.5) return await sendLegacyButtonsMenu(message);
    }

    // ── Menu cards: home actions or paginated category/command buttons ──
    const P = proto.Message.InteractiveMessage;
    const ownerUrl = `https://wa.me/${String(config.owner).replace(/\D/g, "")}`;
    let bodyText = `${headerBox}\n${readMore}\n${buildFullList().trim()}${footer}`;
    const quickButton = (label, command) => ({
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({ display_text: label, id: `${prefix}${command}` }),
    });
    const pinnedButtons = [
      quickButton("━[ 𝐏ɪɴɢ ]━", "ping"),
      quickButton("━[ 𝐀ᴜᴅɪᴏ ]━", "audio"),
    ];
    let buttons;
    if (!arg) {
      buttons = [
        { name: "cta_url", buttonParamsJson: JSON.stringify({ display_text: config.ownerName, url: ownerUrl, merchant_url: ownerUrl }) },
        ...pinnedButtons,
        quickButton("━[ 𝐕ɪᴅᴇᴏ ]━", "musicvideo"),
        quickButton("━[ 𝐌ᴜsɪᴄ ]━", "music"),
        quickButton("━[ 𝐀ɪ ]━", "gpt"),
        quickButton("━[ 𝐆ᴀᴍᴇ ]━", "game"),
        quickButton("━[ 𝐑ᴀɴᴋ ]━", "rank"),
        quickButton("━[ 𝐀ʟʟ 𝐂ᴍᴅs ]━", "menu browse 1"),
      ];
    } else if (firstArg === "browse") {
      const pageSize = 2;
      const totalPages = Math.max(1, Math.ceil(categories.length / pageSize));
      const requestedPage = Math.max(1, parseInt(argParts[1], 10) || 1);
      const page = Math.min(requestedPage, totalPages);
      const visible = categories.slice((page - 1) * pageSize, page * pageSize);
      bodyText = `${headerBox}\n\n*${fancy("command categories")} — ${page}/${totalPages}*\n\n` +
        visible.map((c) => `*┃ ◈ ${fancy(c)}*`).join("\n") + footer;
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
        visible.map((c) => `*┃ ◈ ${fancy(c)}*`).join("\n") + footer;
      buttons = visible.map((c) => quickButton(`━[ ${fancy(c)} ]━`, c));
      if (page > 1) buttons.push(quickButton("━[ 𝐏ʀᴇᴠ ]━", `menu ${category} ${page - 1}`));
      if (page < totalPages) buttons.push(quickButton("━[ 𝐍ᴇxᴛ ]━", `menu ${category} ${page + 1}`));
      buttons.push(...pinnedButtons);
    }

    const bizNodes = [
      {
        tag: "biz",
        attrs: {},
        content: [
          {
            tag: "interactive",
            attrs: { type: "native_flow", v: "1" },
            content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }],
          },
        ],
      },
    ];
    if (!message.from.endsWith("@g.us")) bizNodes.push({ tag: "bot", attrs: { biz_bot: "1" } });

    // random dp — uploaded once per image and reused, so the menu comes fast
    const imgPath = pickMenuImg();
    let imageMessage = null;
    const cached = menuMediaCache.get(imgPath);
    if (cached && Date.now() - cached.t < 6 * 3600 * 1000) {
      imageMessage = cached.m;
    } else {
      try {
        const media = await withTimeout(
          prepareWAMessageMedia({ image: fs.readFileSync(imgPath) }, { upload: message.conn.waUploadToServer }),
          60_000,
          "image"
        );
        imageMessage = media.imageMessage;
        menuMediaCache.set(imgPath, { m: imageMessage, t: Date.now() });
      } catch (e) {
        console.error("❌ Menu image upload failed, using thumbnail card:", e?.message || e);
      }
    }

    // product-card header: dp + name + $99999 + "🛒 100 items"; the product link is the Telegram group
    const productHeader = () =>
      P.Header.create({
        title: name,
        hasMediaAttachment: true,
        productMessage: proto.Message.ProductMessage.create({
          product: proto.Message.ProductMessage.ProductSnapshot.create({
            productImage: imageMessage,
            productId: "99999",
            title: name,
            description: name,
            currencyCode: "USD",
            priceAmount1000: 99999000,
            retailerId: "PABITRA-BOT",
            url: pairUrl,
            productImageCount: 100,
          }),
          businessOwnerJid: message.botJid || "0@s.whatsapp.net",
        }),
      });
    const plainHeader = () =>
      P.Header.create({
        hasMediaAttachment: !!imageMessage,
        ...(imageMessage ? { imageMessage } : {}),
      });

    // no newsletter / forwarded label on the menu
    const relayCard = async (header, useThumbCard) => {
      const msg = generateWAMessageFromContent(
        message.from,
        {
          viewOnceMessage: {
            message: {
              messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
              interactiveMessage: P.create({
                body: P.Body.create({ text: bodyText }),
                footer: P.Footer.create({ text: name }),
                header,
                contextInfo: useThumbCard
                  ? {
                      externalAdReply: {
                        title: `${name} • Online`,
                        body: `Type ${prefix}menu <package> for more`,
                        thumbnail: getMenuThumb(),
                        mediaType: 1,
                        renderLargerThumbnail: true,
                        showAdAttribution: false,
                        sourceUrl: pairUrl,
                      },
                    }
                  : {},
                nativeFlowMessage: P.NativeFlowMessage.create({ buttons }),
              }),
            },
          },
        },
        { quoted: message.gift, userJid: message.conn.user?.id }
      );
      await message.conn.relayMessage(message.from, msg.message, {
        messageId: msg.key.id,
        additionalNodes: bizNodes,
      });
      rememberCard(msg.key.id);
    };

    let sent = false;
    if (imageMessage) {
      try {
        await relayCard(plainHeader(), false);
        sent = true;
      } catch (e) {
        console.error("❌ Image menu failed, trying product card:", e?.message || e);
        try {
          await relayCard(productHeader(), false);
          sent = true;
        } catch (e2) {
          console.error("❌ Product menu failed:", e2?.message || e2);
        }
      }
    } else {
      try {
        await relayCard(plainHeader(), true);
        sent = true;
      } catch (e) {
        console.error("❌ Thumbnail menu failed:", e?.message || e);
      }
    }
    if (!sent) await sendText(headerBox + "\n\n" + buildFullList() + footer);
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
`;
    await message.conn.sendMessage(message.from, {
      image: fs.readFileSync(pickMenuImg()),
      caption: ctx + `\n> © ${name}`,
    });
  } catch (err) {
    console.error("❌ Alive command error:", err);
    await message.conn.sendMessage(message.from, {
      text: `❌ Error: ${err?.message || err}`,
    });
  }
});
