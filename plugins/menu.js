import os from "os";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { db } from "../lib/client.js";
import { Module, getCommands } from "../lib/plugins.js";
import config from "../config.js";
import { sendPing } from "../lib/pingCore.js";
import {
  sendButtonCard,
  ownerContactButton,
  githubRepoButton,
  BOT_PROMO_TEXT,
} from "../lib/buttonCards.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MENU_DIR = path.join(__dirname, "bin", "menu");
const FALLBACK_IMAGE = path.join(__dirname, "bin", "menu.jpg");

const BOT_NAME = "━\\[ 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ \\]━";
const OWNER_NAME = "━\\[ 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ \\]━";
const CONTACT = "919641092392";
const ADDRESS = "SILIGURI-BOY";
const VERSION = "3:0";
const PAGE_SIZE = 6;

const SC = {
  a:"ᴀ",b:"ʙ",c:"ᴄ",d:"ᴅ",e:"ᴇ",f:"ꜰ",g:"ɢ",h:"ʜ",
  i:"ɪ",j:"ᴊ",k:"ᴋ",l:"ʟ",m:"ᴍ",n:"ɴ",o:"ᴏ",p:"ᴘ",
  q:"ǫ",r:"ʀ",s:"ꜱ",t:"ᴛ",u:"ᴜ",v:"ᴠ",w:"ᴡ",x:"x",y:"ʏ",z:"ᴢ"
};

const fancy = (value) =>
  String(value).replace(/[A-Za-z]+/g, (word) =>
    String.fromCodePoint(
      0x1d400 + word[0].toUpperCase().charCodeAt(0) - 65
    ) +
    [...word.slice(1)].map((c) => SC[c.toLowerCase()] || c).join("")
  );

const runtime = (seconds) => {
  const pad = (n) => String(n).padStart(2, "0");

  return `${pad(Math.floor(seconds / 3600))}h ${
    pad(Math.floor((seconds % 3600) / 60))
  }m ${pad(Math.floor(seconds % 60))}s`;
};

// Random image from GitHub repository's local image folder
function getRandomMenuImage() {
  try {
    const files = fs.readdirSync(MENU_DIR).filter((file) =>
      /\.(jpe?g|png|webp)$/i.test(file)
    );

    if (files.length) {
      const random = files[Math.floor(Math.random() * files.length)];
      return path.join(MENU_DIR, random);
    }
  } catch (error) {
    console.log("[MENU IMAGE]", error.message);
  }

  return fs.existsSync(FALLBACK_IMAGE) ? FALLBACK_IMAGE : null;
}

// Group all commands
function getGroupedCommands() {
  return getCommands()
    .filter((plugin) => plugin?.command)
    .reduce((groups, plugin) => {
      const category = String(
        plugin.package || "uncategorized"
      ).toLowerCase();

      (groups[category] ||= []).push(plugin.command);
      return groups;
    }, {});
}

function quickButton(prefix, label, command) {
  return {
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({
      display_text: label,
      id: `${prefix}${command}`,
    }),
  };
}

// Location-style card
async function sendLocationCard(message, info) {
  const prefix = config.prefix || ".";

  const contentText =
    `-♡+━[ 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ ]━+•\n` +
    `+𝐎ɴʟɪɴᴇ+𝐓ʏᴘᴇ+\n\n` +
    `👑 *Bot Name*  ➜ ${BOT_NAME}\n` +
    `♛ *Owner Name* ➜ ${OWNER_NAME}\n` +
    `☎ *Contact*    ➜ +${CONTACT}\n` +
    `📍 *Address*    ➜ ${ADDRESS}\n` +
    `🚀 *Version*    ➜ ${VERSION}\n` +
    `🔐 *Mode*       ➜ ${info.mode}\n\n` +
    `🧩 *Total Plugins*  ➜ ${info.pluginCount}\n` +
    `⌘ *Total Commands* ➜ ${info.commandCount}\n` +
    `⏱ *Uptime*         ➜ ${runtime(process.uptime())}\n\n` +
    `✦ *${info.pageLabel || "MAIN MENU"}* ✦\n\n` +
    BOT_PROMO_TEXT;

  const payload = {
    buttonsMessage: {
      buttons: [
        {
          buttonId: `${prefix}ping`,
          buttonText: { displayText: "ᴘɪɴɢ ᯤ" },
          type: 1,
        },
        {
          buttonId: `${prefix}alive`,
          buttonText: { displayText: "ᴀʟɪᴠᴇ ✆" },
          type: 1,
        },
        {
          buttonId: `${prefix}video`,
          buttonText: { displayText: "ᴠɪᴅᴇᴏ ▶" },
          type: 1,
        },
      ],

      locationMessage: {
        degreesLatitude: 0,
        degreesLongitude: 0,
        name: BOT_NAME,
        address: ADDRESS,
      },

      contentText,
      footerText: config.brandLine || "© PABITRA-BOT",
      headerType: 6,
    },
  };

  return message.conn.relayMessage(
    message.from,
    payload,
    {}
  );
}

// MAIN MENU
Module({
  command: "menu",
  package: "general",
  description: "PABITRA-BOT Location Menu",
})(async (message, match) => {
  try {
    try {
      await message.react("📜");
    } catch {}

    const prefix = config.prefix || ".";
    const grouped = getGroupedCommands();
    const categories = Object.keys(grouped).sort();

    const plugins = getCommands();

    const pluginCount = plugins.length;

    const commandCount = plugins.filter(
      (plugin) => plugin?.command
    ).length;

    const mode =
      db.get(message.botnum, "mode", true) === true
        ? "PUBLIC"
        : "PRIVATE";

    const args = String(match || "")
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    const action = args[0] || "";
    const requestedPage = Math.max(
      1,
      Number.parseInt(args[1], 10) || 1
    );

    const info = {
      mode,
      pluginCount,
      commandCount,
    };

    // Random GitHub image
    const imagePath = getRandomMenuImage();

    if (imagePath) {
      await message.conn.sendMessage(
        message.from,
        {
          image: fs.readFileSync(imagePath),
          caption:
            `*━[ 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ ]━*\n` +
            `+𝐎ɴʟɪɴᴇ+𝐓ʏᴘᴇ+\n` +
            `${config.brandLine || ""}`,
        },
        { quoted: message.gift }
      );
    }

    // MAIN PAGE
    if (!action) {
      await sendLocationCard(message, info);

      await sendButtonCard({
        conn: message.conn,
        jid: message.from,

        buttons: [
          quickButton(prefix, "ᴄᴏɴᴛᴀᴄᴛ ☎", "owner"),
          quickButton(prefix, "📂 BROWSE", "menu browse 1"),
          githubRepoButton(),
        ],

        body:
          `*PABITRA-BOT PRODUCT CARD*\n\n` +
          `*Product:* PABITRA-BOT\n` +
          `*Price:* $99999\n\n` +
          `Choose an option below.`,

        footer: config.brandLine,
        quoted: message.gift,
      });

      return;
    }

    // CATEGORY BROWSER
    if (action === "browse") {
      const totalPages = Math.max(
        1,
        Math.ceil(categories.length / PAGE_SIZE)
      );

      const page = Math.min(requestedPage, totalPages);

      const visible = categories.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE
      );

      await sendLocationCard(message, {
        ...info,
        pageLabel: `CATEGORIES ${page}/${totalPages}`,
      });

      const buttons = visible.map((category) =>
        quickButton(
          prefix,
          `◈ ${fancy(category)}`,
          `menu ${category} 1`
        )
      );

      if (page > 1) {
        buttons.push(
          quickButton(
            prefix,
            "◀ PREVIOUS",
            `menu browse ${page - 1}`
          )
        );
      }

      if (page < totalPages) {
        buttons.push(
          quickButton(
            prefix,
            "NEXT ▶",
            `menu browse ${page + 1}`
          )
        );
      }

      buttons.push(
        quickButton(prefix, "☎ CONTACT", "owner")
      );

      await sendButtonCard({
        conn: message.conn,
        jid: message.from,
        buttons,

        body:
          `*COMMAND CATEGORIES*\n` +
          `Page ${page}/${totalPages}\n\n` +
          visible
            .map((category) =>
              `◈ ${fancy(category)} (${grouped[category].length})`
            )
            .join("\n"),

        footer: config.brandLine,
        quoted: message.gift,
      });

      return;
    }

    // PACKAGE NOT FOUND
    if (!grouped[action]) {
      const available = categories
        .map((category) => `◈ ${fancy(category)}`)
        .join("\n");

      return message.conn.sendMessage(
        message.from,
        {
          text:
            `*Package not found.*\n\n` +
            `*Available packages:*\n${available}\n\n` +
            `Use ${prefix}menu browse`,
        },
        { quoted: message.gift }
      );
    }

    // CATEGORY COMMANDS
    const commands = [...grouped[action]].sort(
      (a, b) => a.localeCompare(b)
    );

    const totalPages = Math.max(
      1,
      Math.ceil(commands.length / PAGE_SIZE)
    );

    const page = Math.min(requestedPage, totalPages);

    const visible = commands.slice(
      (page - 1) * PAGE_SIZE,
      page * PAGE_SIZE
    );

    await sendLocationCard(message, {
      ...info,
      pageLabel: `${action.toUpperCase()} ${page}/${totalPages}`,
    });

    const buttons = visible.map((command) =>
      quickButton(
        prefix,
        `━[ ${fancy(command)} ]━`,
        command
      )
    );

    if (page > 1) {
      buttons.push(
        quickButton(
          prefix,
          "◀ PREVIOUS",
          `menu ${action} ${page - 1}`
        )
      );
    }

    if (page < totalPages) {
      buttons.push(
        quickButton(
          prefix,
          "NEXT ▶",
          `menu ${action} ${page + 1}`
        )
      );
    }

    buttons.push(
      quickButton(prefix, "⌂ MENU", "menu")
    );

    await sendButtonCard({
      conn: message.conn,
      jid: message.from,
      buttons,

      body:
        `*${fancy(action)} COMMANDS*\n` +
        `Page ${page}/${totalPages}\n\n` +
        visible
          .map((command) => `◈ ${fancy(command)}`)
          .join("\n"),

      footer: config.brandLine,
      quoted: message.gift,
    });

  } catch (error) {
    console.error("[MENU ERROR]", error);

    await message.conn.sendMessage(
      message.from,
      {
        text: `❌ Menu error: ${error?.message || error}`,
      },
      { quoted: message.gift }
    );
  }
});

// PING BUTTON FALLBACK
Module({ on: "text" })(async (message) => {
  try {
    const body = String(message.body || "")
      .trim()
      .toLowerCase();

    if (!body || body.startsWith(config.prefix || ".")) {
      return;
    }

    const raw = message.raw?.message || {};

    const selected =
      raw.buttonsResponseMessage?.selectedButtonId ||
      raw.templateButtonReplyMessage?.selectedId ||
      "";

    if (
      selected === `${config.prefix || "."}ping` ||
      body === "ping" ||
      body === "ᴘɪɴɢ ᯤ"
    ) {
      await sendPing(message);
    }
  } catch (error) {
    console.error("[MENU PING]", error);
  }
});

// LIST COMMAND
Module({
  command: "list",
  package: "general",
  description: "List all commands",
})(async (message) => {
  try {
    const commands = getCommands()
      .filter((plugin) => plugin?.command)
      .map((plugin) => plugin.command)
      .join("\n");

    await message.conn.sendMessage(
      message.from,
      { text: `*PABITRA-BOT COMMAND LIST*\n\n${commands}` },
      { quoted: message.gift }
    );
  } catch (error) {
    await message.conn.sendMessage(message.from, {
      text: `❌ ${error.message}`,
    });
  }
});

// ALIVE COMMAND
Module({
  command: "alive",
  package: "general",
  description: "Check bot status",
})(async (message) => {
  try {
    const ram = (
      process.memoryUsage().heapUsed /
      1024 /
      1024
    ).toFixed(2);

    const text =
      `*${BOT_NAME}*\n\n` +
      `🟢 Status: ONLINE\n` +
      `👑 Owner: ${OWNER_NAME}\n` +
      `☎ Contact: +${CONTACT}\n` +
      `📍 Address: ${ADDRESS}\n` +
      `🚀 Version: ${VERSION}\n` +
      `🔐 Mode: ${
        db.get(message.botnum, "mode", true) === true
          ? "PUBLIC"
          : "PRIVATE"
      }\n\n` +
      `🧩 Plugins: ${getCommands().length}\n` +
      `⌘ Commands: ${
        getCommands().filter((plugin) => plugin?.command).length
      }\n` +
      `⏱ Uptime: ${runtime(process.uptime())}\n` +
      `💾 RAM: ${ram} MB\n\n` +
      BOT_PROMO_TEXT;

    const imagePath = getRandomMenuImage();

    await message.conn.sendMessage(
      message.from,
      {
        ...(imagePath
          ? { image: fs.readFileSync(imagePath) }
          : {}),
        text,
      },
      { quoted: message.gift }
    );

    await sendButtonCard({
      conn: message.conn,
      jid: message.from,
      buttons: [
        ownerContactButton(),
        githubRepoButton(),
      ],
      body: "*PABITRA-BOT ONLINE*",
      footer: config.brandLine,
      quoted: message.gift,
    });

  } catch (error) {
    console.error("[ALIVE ERROR]", error);

    await message.conn.sendMessage(message.from, {
      text: `❌ ${error?.message || error}`,
    });
  }
});
