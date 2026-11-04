import os from "os";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { proto, generateWAMessageFromContent, prepareWAMessageMedia } from "baileys";
import { Module, getCommands } from "../lib/plugins.js";
import config from "../config.js";
import { db } from "../lib/client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MENU_DIR = path.join(__dirname, "bin", "menu");
const FALLBACK_IMAGE = path.join(__dirname, "bin", "menu.jpg");
const FALLBACK_THUMB = path.join(__dirname, "bin", "menu_thumb.jpg");
const BOT_NAME = "𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ";
const PAIR_URL = "https://t.me/PABITRA_BOTZ";
const IMAGE_CACHE = new Map();
let lastImage = "";

const SMALL_CAPS = {
  a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ", f: "ꜰ", g: "ɢ", h: "ʜ",
  i: "ɪ", j: "ᴊ", k: "ᴋ", l: "ʟ", m: "ᴍ", n: "ɴ", o: "ᴏ", p: "ᴘ",
  q: "ǫ", r: "ʀ", s: "ꜱ", t: "ᴛ", u: "ᴜ", v: "ᴠ", w: "ᴡ", x: "x",
  y: "ʏ", z: "ᴢ",
};

const fancy = (value) => String(value).replace(/[A-Za-z]+/g, (word) => {
  const first = String.fromCodePoint(0x1d400 + word.charCodeAt(0) - 65);
  return first + [...word.slice(1)].map((c) => SMALL_CAPS[c.toLowerCase()] || c).join("");
});

const bold = (value) => String(value).replace(/[A-Za-z0-9]/g, (c) => {
  const n = c.charCodeAt(0);
  if (n >= 65 && n <= 90) return String.fromCodePoint(0x1d400 + n - 65);
  if (n >= 97 && n <= 122) return String.fromCodePoint(0x1d41a + n - 97);
  return String.fromCodePoint(0x1d7ce + n - 48);
});

const runtime = (seconds) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(Math.floor(seconds / 3600))}h ${pad(Math.floor(seconds / 60) % 60)}m ${pad(Math.floor(seconds % 60))}s`;
};

export function pickMenuImage() {
  let files = [];
  try {
    files = fs.readdirSync(MENU_DIR).filter((file) => /\.(jpe?g|png)$/i.test(file));
  } catch (_) {}
  if (!files.length) return FALLBACK_IMAGE;
  const pool = files.length > 1 ? files.filter((file) => file !== lastImage) : files;
  lastImage = pool[Math.floor(Math.random() * pool.length)];
  return path.join(MENU_DIR, lastImage);
}

function groupedCommands() {
  return getCommands()
    .filter((plugin) => plugin?.command && plugin.command !== "undefined")
    .reduce((groups, plugin) => {
      const category = String(plugin.package || "uncategorized").toLowerCase();
      (groups[category] ||= []).push(plugin.command);
      return groups;
    }, {});
}

function makeButton(displayText, id) {
  return {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({ display_text: displayText, id }),
  };
}

export function buildMenuButtons(prefix = ".", owner = "919641092392") {
  const ownerUrl = `https://wa.me/${String(owner).replace(/\D/g, "")}`;
  return [
    makeButton("━[ 𝐏ɪɴɢ ]━", `${prefix}ping`),
    {
      name: "cta_url",
      buttonParamsJson: JSON.stringify({ display_text: "━[ 𝐎ᴡɴᴇʀ ]━", url: ownerUrl, merchant_url: ownerUrl }),
    },
    {
      name: "cta_url",
      buttonParamsJson: JSON.stringify({ display_text: "━[ 𝐏ᴀɪʀ 𝐂ᴏᴅᴇ ]━", url: PAIR_URL, merchant_url: PAIR_URL }),
    },
    makeButton("━[ 𝐕ɪᴅᴇᴏ ]━", `${prefix}musicvideo`),
    makeButton("━[ 𝐀ᴜᴅɪᴏ ]━", `${prefix}audio`),
  ];
}

export function buildMenuText(message = {}, prefix = ".") {
  const groups = groupedCommands();
  const categories = Object.keys(groups).sort();
  const total = Object.values(groups).reduce((sum, items) => sum + items.length, 0);
  const user = String(message.pushName || "User");
  let mode = true;
  try { mode = db.get(message.botnum, "mode", true) === true; } catch (_) {}
  const used = ((os.totalmem() - os.freemem()) / 1073741824).toFixed(2);
  const totalMemory = (os.totalmem() / 1073741824).toFixed(2);
  const blocks = categories.map((category) => {
    const commands = [...new Set(groups[category])].sort();
    return `*╭━━━〔 ✦ ${bold(category.toUpperCase())} ✦ 〕━━━╮*\n${commands.map((cmd) => `*┃ ◈ ${fancy(cmd)}*`).join("\n")}\n*╰━━━━━━━━━━━━━━━━━━━╯*`;
  });
  const header = [
    `*━━⟪ ${BOT_NAME} ⟫━━*`,
    "",
    `*┃ ◈ ᴍᴏᴅᴇ      ➤ ${bold(mode ? "PUBLIC" : "PRIVATE")}*`,
    `*┃ ◈ ᴘʀᴇғɪx     ➤ ${prefix}*`,
    `*┃ ◈ ᴜsᴇʀ       ➤ ${user}*`,
    `*┃ ✦ ᴜᴘᴛɪᴍᴇ    ➤ ${bold(runtime(process.uptime()))}*`,
    `*┃ ✦ ᴄᴏᴍᴍᴀɴᴅs ➤ ${bold(total)}*`,
    `*┃ ✦ ʀᴀᴍ       ➤ ${bold(`${used} / ${totalMemory} GB`)}*`,
  ].join("\n");
  return `${header}\n\n${blocks.join("\n\n")}\n\n${config.brandLine}`;
}

async function readMenuImage(conn, imagePath) {
  const cached = IMAGE_CACHE.get(imagePath);
  if (cached && Date.now() - cached.createdAt < 6 * 60 * 60 * 1000) return cached.message;
  try {
    const buffer = fs.readFileSync(imagePath);
    if (typeof conn?.waUploadToServer !== "function") return null;
    const media = await prepareWAMessageMedia({ image: buffer }, { upload: conn.waUploadToServer });
    if (media?.imageMessage) IMAGE_CACHE.set(imagePath, { message: media.imageMessage, createdAt: Date.now() });
    return media?.imageMessage || null;
  } catch (error) {
    console.error("[PABITRA MENU IMAGE]", error?.message || error);
    return null;
  }
}

Module({
  command: "menu",
  aliases: ["startmenu", "allmenu"],
  package: "general",
  description: "Show the dynamic random-image PABITRA menu",
  usage: ".menu",
})(async (message, match = "") => {
  try {
    const prefix = config.prefix || ".";
    const imagePath = pickMenuImage();
    const imageMessage = await readMenuImage(message.conn, imagePath);
    const body = buildMenuText(message, prefix);
    const requested = String(match || "").trim().toLowerCase();

    if (requested && requested !== "all") {
      const groups = groupedCommands();
      if (groups[requested]) {
        const text = `*╭━━━〔 ✦ ${bold(requested.toUpperCase())} ✦ 〕━━━╮*\n${[...new Set(groups[requested])].sort().map((cmd) => `*┃ ◈ ${fancy(cmd)}*`).join("\n")}\n*╰━━━━━━━━━━━━━━━━━━━╯*\n\n${config.brandLine}`;
        return message.conn.sendMessage(message.from, { text }, { quoted: message.gift });
      }
    }

    if (!imageMessage) {
      return message.conn.sendMessage(message.from, { text: body }, { quoted: message.gift });
    }

    const P = proto.Message.InteractiveMessage;
    const productHeader = P.Header.create({
      title: BOT_NAME,
      hasMediaAttachment: true,
      productMessage: proto.Message.ProductMessage.create({
        product: proto.Message.ProductMessage.ProductSnapshot.create({
          productImage: imageMessage,
          productId: "PABITRA-MENU",
          title: BOT_NAME,
          description: "PABITRA BOT command menu",
          currencyCode: "USD",
          priceAmount1000: 99999000,
          retailerId: "PABITRA-BOT",
          url: PAIR_URL,
          productImageCount: 1,
        }),
        businessOwnerJid: message.botJid || message.conn.user?.id || "0@s.whatsapp.net",
      }),
    });
    const bizNodes = [{ tag: "biz", attrs: {}, content: [{ tag: "interactive", attrs: { type: "native_flow", v: "1" }, content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }] }] }];
    if (!String(message.from).endsWith("@g.us")) bizNodes.push({ tag: "bot", attrs: { biz_bot: "1" } });
    const generated = generateWAMessageFromContent(message.from, {
      viewOnceMessage: { message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage: P.create({
          body: P.Body.create({ text: body }),
          footer: P.Footer.create({ text: config.brandLine }),
          header: productHeader,
          nativeFlowMessage: P.NativeFlowMessage.create({ buttons: buildMenuButtons(prefix, config.owner) }),
        }),
      } },
    }, { quoted: message.gift, userJid: message.conn.user?.id });
    await message.conn.relayMessage(message.from, generated.message, { messageId: generated.key.id, additionalNodes: bizNodes });
  } catch (error) {
    console.error("[PABITRA MENU ERROR]", error?.message || error);
    await message.send(`❌ Menu failed: ${error?.message || "WhatsApp rejected the menu"}`);
  }
});
