import os from "os";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { db } from "../lib/client.js";
import { Module, getCommands } from "../lib/plugins.js";
import config from "../config.js";
import { sendButtonCard } from "../lib/buttonCards.js";
import { sendPing } from "../lib/pingCore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_NAME = "𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ";
const OWNER_NAME = "𝐀ᴘᴜʀʙᴏ-𝐃ᴀs";
const OWNER_NUMBER = "919641092392";
const ADDRESS = "SILIGURI-BOY";
const VERSION = "3:0";

const MENU_IMAGE_DIR = path.join(__dirname, "bin", "menu");
const FALLBACK_IMAGE = path.join(__dirname, "bin", "menu.jpg");
let lastImage = "";

function pickMenuImage() {
  try {
    const files = fs.readdirSync(MENU_IMAGE_DIR)
      .filter((file) => /\.(jpe?g|png|webp)$/i.test(file));

    const choices = files.length > 1
      ? files.filter((file) => file !== lastImage)
      : files;

    if (choices.length) {
      lastImage = choices[Math.floor(Math.random() * choices.length)];
      return fs.readFileSync(path.join(MENU_IMAGE_DIR, lastImage));
    }
  } catch (error) {
    console.warn("[menu] Random menu image unavailable:", error?.message || error);
  }

  try {
    return fs.existsSync(FALLBACK_IMAGE)
      ? fs.readFileSync(FALLBACK_IMAGE)
      : null;
  } catch {
    return null;
  }
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

function getGroupedCommands() {
  return getCommands()
    .filter((cmd) => cmd?.command && cmd.command !== "undefined")
    .reduce((groups, cmd) => {
      const category = String(cmd.package || "uncategorized").toLowerCase();
      (groups[category] ||= []).push(cmd.command);
      return groups;
    }, {});
}

function makeMenuButtons(prefix) {
  const ownerUrl = `https://wa.me/${String(
    config.owner || OWNER_NUMBER
  ).replace(/\D/g, "")}`;

  return [
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "ᴘɪɴɢ ᯤ",
        id: `${prefix}ping`,
      }),
    },
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "ᴀʟɪᴠᴇ ✆",
        id: `${prefix}alive`,
      }),
    },
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "ᴠɪᴅᴇᴏ ▶",
        id: `${prefix}video`,
      }),
    },
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "ᴍᴜsɪᴄ ♬",
        id: `${prefix}music`,
      }),
    },
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "ᴘʟᴀʏ ▶",
        id: `${prefix}play`,
      }),
    },
    {
      name: "cta_url",
      buttonParamsJson: JSON.stringify({
        display_text: "ᴄᴏɴᴛᴀᴄᴛ ☎",
        url: ownerUrl,
        merchant_url: ownerUrl,
      }),
    },
  ];
}

function buildCategoryText(groups) {
  return Object.keys(groups).sort().map((category) => {
    const commands = [...groups[category]].sort(
      (a, b) => a.localeCompare(b)
    );

    return [
      `╭━━〔 ${category.toUpperCase()} 〕━━╮`,
      ...commands.map((command) => `┃ ◈ ${command}`),
      "╰━━━━━━━━━━━━━━╯",
    ].join("\n");
  }).join("\n\n");
}

// MENU COMMAND
Module({
  command: "menu",
  package: "general",
  description: "Show PABITRA-BOT menu",
})(async (message, match) => {
  try {
    try {
      await message.react("📜");
    } catch {}

    const prefix = config.prefix || ".";
    const groups = getGroupedCommands();
    const categories = Object.keys(groups).sort();

    const totalCommands = Object.values(groups)
      .reduce((sum, commands) => sum + commands.length, 0);

    const isPublic = db.get(message.botnum, "mode", true) === true;
    const mode = isPublic ? "PUBLIC" : "PRIVATE";

    const ramUsed = (
      (os.totalmem() - os.freemem()) / 1073741824
    ).toFixed(2);

    const ramTotal = (
      os.totalmem() / 1073741824
    ).toFixed(2);

    const uptime = formatUptime(process.uptime());

    const header = [
      "-♡+━[ 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ ]━+•",
      "+𝐎ɴʟɪɴᴇ+𝐓ʏᴘᴇ+",
      "",
      "╭──────────────╮",
      `│ Bot Name : ${BOT_NAME}`,
      `│ Owner    : ${OWNER_NAME}`,
      `│ Contact  : ${OWNER_NUMBER}`,
      `│ Address  : ${ADDRESS}`,
      `│ Version  : ${VERSION}`,
      `│ Mode     : ${mode}`,
      `│ Prefix   : ${prefix}`,
      `│ Uptime   : ${uptime}`,
      `│ Plugins  : ${categories.length}`,
      `│ Commands : ${totalCommands}`,
      `│ RAM      : ${ramUsed}/${ramTotal} GB`,
      "╰──────────────╯",
    ].join("\n");

    const footer =
      "♡ Select an option below.\n\n© 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ";

    const argument = String(match || "").trim().toLowerCase();

    if (argument === "all") {
      return await message.conn.sendMessage(
        message.from,
        {
          text: `${header}\n\n${buildCategoryText(groups)}\n\n${footer}`,
        },
        { quoted: message.gift }
      );
    }

    if (argument) {
      if (groups[argument]) {
        return await message.conn.sendMessage(
          message.from,
          {
            text: `${header}\n\n${buildCategoryText({
              [argument]: groups[argument],
            })}\n\n${footer}`,
          },
          { quoted: message.gift }
        );
      }

      return await message.conn.sendMessage(
        message.from,
        {
          text: `Package not found: ${argument}\n\nAvailable: ${categories.join(", ")}`,
        },
        { quoted: message.gift }
      );
    }

    const image = pickMenuImage();
    const buttons = makeMenuButtons(prefix);

    await sendButtonCard({
      conn: message.conn,
      jid: message.from,
      buttons,
      body: `${header}\n\n${footer}`,
      footer: BOT_NAME,
      quoted: message.gift,
      userJid: message.conn.user?.id,
      ...(image ? { image, imageMaxDimension: 900 } : {}),
    });

  } catch (error) {
    console.error("[menu] Menu command failed:", error);

    await message.conn.sendMessage(
      message.from,
      {
        text: `❌ Menu Error: ${error?.message || error}`,
      },
      { quoted: message.gift }
    );
  }
});

// PING BUTTON HANDLER
Module({ on: "text" })(async (message) => {
  try {
    const prefix = config.prefix || ".";
    const body = String(message.body || "").trim().toLowerCase();

    if (
      body === `${prefix}ping` ||
      body === "ᴘɪɴɢ ᯤ" ||
      body === "ping"
    ) {
      await sendPing(message);
    }
  } catch (error) {
    console.error("[menu] Ping button error:", error?.message || error);
  }
});

// LIST COMMAND
Module({
  command: "list",
  package: "general",
  description: "List all available commands",
})(async (message) => {
  try {
    const commands = getCommands()
      .filter((cmd) => cmd?.command && cmd.command !== "undefined")
      .map((cmd) => cmd.command)
      .sort();

    await message.conn.sendMessage(
      message.from,
      {
        text:
          `╭━━〔 PABITRA COMMANDS 〕━━╮\n` +
          `${commands.map((cmd) => `┃ ◈ ${cmd}`).join("\n")}\n` +
          `╰━━━━━━━━━━━━━━━━━━╯`,
      },
      { quoted: message.gift }
    );

  } catch (error) {
    console.error("[menu] List command error:", error);
  }
});

// ALIVE COMMAND
Module({
  command: "alive",
  package: "general",
  description: "Check if PABITRA-BOT is online",
})(async (message) => {
  try {
    const usedMB = (
      process.memoryUsage().heapUsed / 1024 / 1024
    ).toFixed(1);

    const text = [
      `♡ ${BOT_NAME} IS ONLINE`,
      "",
      `Owner: ${OWNER_NAME}`,
      `Uptime: ${formatUptime(process.uptime())}`,
      `RAM: ${usedMB} MB`,
      `Mode: ${
        db.get(message.botnum, "mode", true) === true
          ? "PUBLIC"
          : "PRIVATE"
      }`,
      "",
      "© 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ",
    ].join("\n");

    const image = pickMenuImage();

    await message.conn.sendMessage(
      message.from,
      image
        ? { image, caption: text }
        : { text },
      { quoted: message.gift }
    );

  } catch (error) {
    console.error("[menu] Alive command error:", error);

    await message.conn.sendMessage(
      message.from,
      {
        text: `❌ Alive Error: ${error?.message || error}`,
      },
      { quoted: message.gift }
    );
  }
});
