import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import FormData from "form-data";
import { WELCOME_TEXTS, GOODBYE_TEXTS } from "./plugins/bin/text.js";
import { getRandomWelcome } from "./lib/welcomeVideos.js";
import { markPairing } from "./lib/pairState.js";
import { CAPTION, getInfo, remember, audioFor, videoFor, findSong, fetchBuffer } from "./lib/media.js";
import { fancyText } from "./lib/fancy.js";
import config from "./config.js";

const __dirname_tg = path.dirname(fileURLToPath(import.meta.url));
const TG_DP_PATH = path.join(__dirname_tg, "plugins", "bin", "tg_dp.jpg");
const BOT_NAME = config.botName;
// welcome videos live in plugins/bin/welcome (random one per new member, thumbnails ≤320px)

export default async function initializeTelegramBot(manager) {
  // ── CONFIGURATION ─────────────────────────────────────────────────────────────
  const ALLOWED_GROUP_ID = Number(process.env.TG_GROUP_ID) || -1004364269870;
  const GROUP_INVITE_LINK = process.env.TG_GROUP_LINK || "https://t.me/PABITRA_BOTZ";
  const WA_CHANNEL_LINK = process.env.WA_CHANNEL_LINK || "https://whatsapp.com/channel/0029Vb8RL4F1HspsNlYYOE3e";
  const PAIR_COOLDOWN_MS = 30_000;
  // Telegram user IDs allowed to use the dangerous admin tools (/s /as /d). Empty = those tools are disabled.
  // Find your ID with /id and start the bot with TG_ADMIN_IDS=123456789
  const ADMIN_IDS = (process.env.TG_ADMIN_IDS || "").split(/[,\s]+/).filter(Boolean);
  // Fixed custom pairing code (8 chars A-Z/0-9)
  const PAIR_CODE = (process.env.PAIR_CODE || "POBIPAUL").toUpperCase();

  const BOT_TOKEN = process.env.BOT_TOKEN_TELEGRAM || process.env.BOT_TOKEN || "";

  if (!BOT_TOKEN) {
    console.warn("❌ [bot.js] BOT_TOKEN missing — Skipping Telegram bot.");
    return null;
  }

  const RAILWAY_URL = process.env.RAILWAY_STATIC_URL || process.env.WEBHOOK_BASE_URL || "";
  const USE_WEBHOOK = Boolean(RAILWAY_URL);

  const { default: TelegramBot } = await import("node-telegram-bot-api");

  const tbot = new TelegramBot(
    BOT_TOKEN,
    USE_WEBHOOK ? { polling: false } : { polling: { interval: 3000, params: { timeout: 30 } } }
  );

  tbot.on("polling_error", (e) => console.error("❗ [bot.js] Polling error:", e?.message || e));
  tbot.on("webhook_error", (e) => console.error("❗ [bot.js] Webhook error:", e?.message || e));

  let botId = null;
  try {
    const me = await tbot.getMe();
    botId = me.id;
    tbot.botId = me.id;
    tbot.botUsername = me.username;
    console.log(`🤖 [bot.js] @${me.username} (${me.id}) — Mode: ${USE_WEBHOOK ? "Webhook" : "Polling"}`);
  } catch (e) {
    console.warn("⚠️ [bot.js] getMe failed:", e?.message);
  }

  tbot
    .setMyCommands([
      { command: "start", description: fancyText("Welcome") },
      { command: "menu", description: fancyText("Show all commands") },
      { command: "pair", description: fancyText("Get a WhatsApp pairing code") },
      { command: "ping", description: fancyText("Check the bot") },
      { command: "play", description: fancyText("Send a song (direct audio)") },
      { command: "song", description: fancyText("Send a song (direct audio)") },
      { command: "music", description: fancyText("Direct song (name or Spotify link)") },
      { command: "id", description: fancyText("Your Telegram ID") },
    ])
    .catch(() => {});

  const pairCooldown = new Map();

  // ── HELPER UTILITIES & STYLING ────────────────────────────────────────────────
  const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function isoToFlag(iso) {
    if (!iso || iso.length !== 2) return "🏳️";
    const A = 0x1f1e6;
    return [...iso.toUpperCase()].map((c) => String.fromCodePoint(A + c.charCodeAt(0) - 65)).join("");
  }

  function fmtCode(raw) {
    const s = String(raw || "").replace(/\s+/g, "");
    return s.match(/.{1,4}/g)?.join("-") || s;
  }

  function isPrivate(msg) {
    return msg?.chat?.type === "private";
  }

  function isAllowedGroup(msg) {
    try {
      if (!msg?.chat || msg.chat.type === "private") return false;
      return String(msg.chat.id) === String(ALLOWED_GROUP_ID);
    } catch {
      return false;
    }
  }

  function isAnonymousAdmin(msg) {
    return !!(msg?.sender_chat && msg?.chat && String(msg.sender_chat.id) === String(msg.chat.id));
  }

  async function isAdmin(msg) {
    try {
      if (!msg?.chat || msg.chat.type === "private") return false;
      if (isAnonymousAdmin(msg)) return true;
      if (!msg.from) return false;
      const member = await tbot.getChatMember(msg.chat.id, msg.from.id);
      return member?.status === "creator" || member?.status === "administrator";
    } catch {
      return false;
    }
  }

  function safeReply(chatId, text, opts = {}) {
    return tbot.sendMessage(chatId, text, { parse_mode: "HTML", ...opts }).catch((e) => {
      console.error("[bot.js] sendMessage failed:", e?.message);
    });
  }

  function safeEdit(chatId, msgId, text, opts = {}) {
    return tbot.editMessageText(text, {
      chat_id: chatId,
      message_id: msgId,
      parse_mode: "HTML",
      ...opts,
    }).catch(() => {});
  }

  // Font visible Telegram text without corrupting HTML tags, URLs, or code.
  const f = (text) => String(text).split(/(<[^>]*>)/g).map((part) =>
    part.startsWith("<") && part.endsWith(">") ? part : fancyText(part)
  ).join("");

  // edits a photo's caption (falls back to editing plain text)
  function safeEditCaption(chatId, msgId, text, opts = {}) {
    return tbot
      .editMessageCaption(text, { chat_id: chatId, message_id: msgId, parse_mode: "HTML", ...opts })
      .catch(() => safeEdit(chatId, msgId, text, opts));
  }

  // Pabitra-Bot dp image + caption (text only if the image cannot be sent)
  let dpBuffer = null;
  async function sendDp(chatId, caption, opts = {}) {
    try {
      if (!dpBuffer) dpBuffer = fs.readFileSync(TG_DP_PATH);
      return await tbot.sendPhoto(
        chatId,
        dpBuffer,
        { caption, parse_mode: "HTML", ...opts },
        { filename: "pabitra-bot.jpg", contentType: "image/jpeg" }
      );
    } catch (e) {
      console.error("[bot.js] sendPhoto failed, sending text:", e?.message);
      return safeReply(chatId, caption, opts);
    }
  }

  function waitForSessionOpen(sessionId, timeoutMs = 25_000) {
    return new Promise((resolve, reject) => {
      if (manager.isRunning(sessionId)) return resolve();

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Connection timeout"));
      }, timeoutMs);

      function cleanup() {
        clearTimeout(timer);
        manager.removeListener("connected", onConn);
        manager.removeListener("session.deleted", onDel);
      }

      function onConn(sid) {
        if (sid === sessionId) {
          cleanup();
          resolve();
        }
      }

      function onDel(sid) {
        if (sid === sessionId) {
          cleanup();
          reject(new Error("Session deleted before connecting"));
        }
      }

      manager.on("connected", onConn);
      manager.on("session.deleted", onDel);
    });
  }

  // ── COUNTRY DATA MAP ──────────────────────────────────────────────────────────
  const CALLING_CODE_MAP = {
    1: { iso: "US", name: "United States/Canada" },
    7: { iso: "RU", name: "Russia/Kazakhstan" },
    20: { iso: "EG", name: "Egypt" },
    27: { iso: "ZA", name: "South Africa" },
    30: { iso: "GR", name: "Greece" },
    31: { iso: "NL", name: "Netherlands" },
    32: { iso: "BE", name: "Belgium" },
    33: { iso: "FR", name: "France" },
    34: { iso: "ES", name: "Spain" },
    36: { iso: "HU", name: "Hungary" },
    39: { iso: "IT", name: "Italy" },
    40: { iso: "RO", name: "Romania" },
    41: { iso: "CH", name: "Switzerland" },
    43: { iso: "AT", name: "Austria" },
    44: { iso: "GB", name: "United Kingdom" },
    45: { iso: "DK", name: "Denmark" },
    46: { iso: "SE", name: "Sweden" },
    47: { iso: "NO", name: "Norway" },
    48: { iso: "PL", name: "Poland" },
    49: { iso: "DE", name: "Germany" },
    51: { iso: "PE", name: "Peru" },
    52: { iso: "MX", name: "Mexico" },
    53: { iso: "CU", name: "Cuba" },
    54: { iso: "AR", name: "Argentina" },
    55: { iso: "BR", name: "Brazil" },
    56: { iso: "CL", name: "Chile" },
    57: { iso: "CO", name: "Colombia" },
    58: { iso: "VE", name: "Venezuela" },
    60: { iso: "MY", name: "Malaysia" },
    61: { iso: "AU", name: "Australia" },
    62: { iso: "ID", name: "Indonesia" },
    63: { iso: "PH", name: "Philippines" },
    64: { iso: "NZ", name: "New Zealand" },
    65: { iso: "SG", name: "Singapore" },
    66: { iso: "TH", name: "Thailand" },
    81: { iso: "JP", name: "Japan" },
    82: { iso: "KR", name: "South Korea" },
    84: { iso: "VN", name: "Vietnam" },
    86: { iso: "CN", name: "China" },
    90: { iso: "TR", name: "Turkey" },
    91: { iso: "IN", name: "India" },
    92: { iso: "PK", name: "Pakistan" },
    93: { iso: "AF", name: "Afghanistan" },
    94: { iso: "LK", name: "Sri Lanka" },
    95: { iso: "MM", name: "Myanmar" },
    98: { iso: "IR", name: "Iran" },
    211: { iso: "SS", name: "South Sudan" },
    212: { iso: "MA", name: "Morocco" },
    213: { iso: "DZ", name: "Algeria" },
    216: { iso: "TN", name: "Tunisia" },
    218: { iso: "LY", name: "Libya" },
    220: { iso: "GM", name: "Gambia" },
    221: { iso: "SN", name: "Senegal" },
    233: { iso: "GH", name: "Ghana" },
    234: { iso: "NG", name: "Nigeria" },
    254: { iso: "KE", name: "Kenya" },
    255: { iso: "TZ", name: "Tanzania" },
    256: { iso: "UG", name: "Uganda" },
    260: { iso: "ZM", name: "Zambia" },
    263: { iso: "ZW", name: "Zimbabwe" },
    351: { iso: "PT", name: "Portugal" },
    353: { iso: "IE", name: "Ireland" },
    358: { iso: "FI", name: "Finland" },
    380: { iso: "UA", name: "Ukraine" },
    420: { iso: "CZ", name: "Czech Republic" },
    421: { iso: "SK", name: "Slovakia" },
    500: { iso: "FK", name: "Falkland Islands" },
    501: { iso: "BZ", name: "Belize" },
    502: { iso: "GT", name: "Guatemala" },
    505: { iso: "NI", name: "Nicaragua" },
    506: { iso: "CR", name: "Costa Rica" },
    507: { iso: "PA", name: "Panama" },
    591: { iso: "BO", name: "Bolivia" },
    593: { iso: "EC", name: "Ecuador" },
    595: { iso: "PY", name: "Paraguay" },
    598: { iso: "UY", name: "Uruguay" },
    670: { iso: "TL", name: "East Timor" },
    673: { iso: "BN", name: "Brunei" },
    675: { iso: "PG", name: "Papua New Guinea" },
    679: { iso: "FJ", name: "Fiji" },
    850: { iso: "KP", name: "North Korea" },
    852: { iso: "HK", name: "Hong Kong" },
    853: { iso: "MO", name: "Macau" },
    855: { iso: "KH", name: "Cambodia" },
    856: { iso: "LA", name: "Laos" },
    880: { iso: "BD", name: "Bangladesh" },
    886: { iso: "TW", name: "Taiwan" },
    960: { iso: "MV", name: "Maldives" },
    961: { iso: "LB", name: "Lebanon" },
    962: { iso: "JO", name: "Jordan" },
    963: { iso: "SY", name: "Syria" },
    964: { iso: "IQ", name: "Iraq" },
    965: { iso: "KW", name: "Kuwait" },
    966: { iso: "SA", name: "Saudi Arabia" },
    967: { iso: "YE", name: "Yemen" },
    968: { iso: "OM", name: "Oman" },
    971: { iso: "AE", name: "UAE" },
    972: { iso: "IL", name: "Israel" },
    973: { iso: "BH", name: "Bahrain" },
    974: { iso: "QA", name: "Qatar" },
    975: { iso: "BT", name: "Bhutan" },
    977: { iso: "NP", name: "Nepal" },
    992: { iso: "TJ", name: "Tajikistan" },
    993: { iso: "TM", name: "Turkmenistan" },
    994: { iso: "AZ", name: "Azerbaijan" },
    995: { iso: "GE", name: "Georgia" },
    996: { iso: "KG", name: "Kyrgyzstan" },
    998: { iso: "UZ", name: "Uzbekistan" },
    1242: { iso: "BS", name: "Bahamas" },
    1246: { iso: "BB", name: "Barbados" },
    1345: { iso: "KY", name: "Cayman Islands" },
    1868: { iso: "TT", name: "Trinidad and Tobago" },
    1876: { iso: "JM", name: "Jamaica" },
  };

  const SORTED_CODES = Object.keys(CALLING_CODE_MAP)
    .map(Number)
    .sort((a, b) => String(b).length - String(a).length || b - a);

  function detectCountry(digits) {
    if (!digits) return null;
    let clean = digits.startsWith("00") ? digits.slice(2) : digits;
    for (const code of SORTED_CODES) {
      if (clean.startsWith(String(code))) {
        const info = CALLING_CODE_MAP[code];
        return { callingCode: code, iso: info.iso, name: info.name };
      }
    }
    return null;
  }

  // ── MESSAGE BUILDERS ──────────────────────────────────────────────────────────
  function buildPairSuccessMessage(rawArg, rawCode, countryInfo) {
    const code = fmtCode(rawCode);
    const flag = countryInfo ? isoToFlag(countryInfo.iso) : "🌍";
    const country = countryInfo
      ? `${flag} <b>${esc(countryInfo.name)}</b> (+${countryInfo.callingCode})`
      : `🌍 <i>${f("country unknown")}</i>`;

    const text = [
      `[ ♡ <b>${BOT_NAME}</b> ]`,
      ``,
      `• 📱 <b>${f("number")}:</b> <code>${esc(rawArg)}</code>`,
      `• 🌐 <b>${f("country")}:</b> ${country}`,
      `• 🔑 <b>${f("code")}:</b> <code>${esc(code)}</code>`,
      ``,
      `[ <b>${f("session connection")}</b> 🎀 ]`,
      ``,
      `📌 <b>${f("how to link")}:</b>`,
      `• ${f("whatsapp")} → ${f("settings")} → ${f("linked devices")}`,
      `• ${f("link a device")} → ${f("enter the code above")}`,
      ``,
      `⏰ <i>${f("code expires in about 60 seconds")}</i>`,
    ].join("\n");

    const reply_markup = {
      inline_keyboard: [
        [{ text: `📋 ${f("copy code")} • ${code}`, copy_text: { text: code } }],
        [{ text: `🔵 ${f("join channel")}`, url: WA_CHANNEL_LINK }],
        [{ text: `💬 ${f("telegram group")}`, url: GROUP_INVITE_LINK }],
      ],
    };

    return { text, reply_markup };
  }

  function buildHelpMessage() {
    return [
      `📋 <b>${BOT_NAME} ${f("menu")}</b>`,
      `──────────────────────`,
      `🚀 /start — ${f("open the welcome")}`,
      `🔑 <code>/pair +919641092392</code> — ${f("get a pairing code")}`,
      `🏓 /ping — ${f("check bot speed")}`,
      `▶️ <code>/play name</code> — ${f("direct song")}`,
      `🎶 <code>/song name</code> — ${f("direct song")}`,
      `🎵 <code>/music name or spotify link</code> — ${f("direct song")}`,
      `🆔 /id — ${f("your telegram id")}`,
      `📋 /menu — ${f("this menu")}`,
    ].join("\n");
  }

  // ── CORE PAIRING CONTROLLER ───────────────────────────────────────────────────
  async function doPair(chatId, rawArg, replyToId) {
    const digits = rawArg.replace(/\D/g, "");
    const countryInfo = detectCountry(digits);
    const flag = countryInfo ? isoToFlag(countryInfo.iso) : "☁️";
    const countryName = countryInfo?.name || "Unknown";

    const loadingMsg = await safeReply(
      chatId,
      [
        `⏳ <b>${f("generating pair code")}...</b>`,
        ``,
        `📱 <b>${f("number")}:</b> <code>${esc(rawArg)}</code>`,
        countryInfo
          ? `${flag} ${esc(countryName)} (+${countryInfo.callingCode})`
          : `🌍 <i>${f("country not detected - trying anyway")}</i>`,
        ``,
        `🔄 <i>${f("please wait a moment")}...</i>`,
      ].join("\n"),
      { reply_to_message_id: replyToId }
    );

    let rawCode = null;
    try {
      markPairing(digits);
      const sock = await manager.start(digits);
      if (!sock) throw new Error("Socket creation failed");

      try {
        await waitForSessionOpen(digits, 22_000);
      } catch (e) {
        console.warn(`[bot.js] waitForSessionOpen: ${e.message}`);
      }

      if (typeof sock.requestPairingCode !== "function") {
        throw new Error("Pairing not supported — socket version may be outdated");
      }
      rawCode = await sock.requestPairingCode(digits, PAIR_CODE);
    } catch (err) {
      if (loadingMsg?.message_id) {
        await tbot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
      }
      return safeReply(
        chatId,
        [
          `❌ <b>${f("pairing failed")}</b>`,
          ``,
          `📱 <b>${f("number")}:</b> <code>${esc(rawArg)}</code>`,
          `💬 <b>${f("reason")}:</b> <i>${esc(String(err?.message || err))}</i>`,
          ``,
          `🔁 <i>${f("try again with")} /pair +${esc(digits)}</i>`,
        ].join("\n"),
        { reply_to_message_id: replyToId }
      );
    }

    if (loadingMsg?.message_id) {
      await tbot.deleteMessage(chatId, loadingMsg.message_id).catch(() => {});
    }

    if (!rawCode) {
      return safeReply(chatId, `❌ <b>${f("no pair code returned - please try again")}</b>`, {
        reply_to_message_id: replyToId,
      });
    }

    const { text, reply_markup } = buildPairSuccessMessage(rawArg, rawCode, countryInfo);
    // dp image + caption + [COPY CODE] [JOIN CHANNEL] buttons
    const pairMsg = await sendDp(chatId, text, {
      reply_to_message_id: replyToId,
      reply_markup,
    });

    if (pairMsg?.message_id) {
      const WATCH_TIMEOUT_MS = 5 * 60 * 1000;
      const msgId = pairMsg.message_id;
      const displayNum = `+${digits}`;

      const connectedText = [
        `❤️‍🩹 <b>${f("pabitra-bot connected")}!</b>`,
        ``,
        `✅ <b>${f("successfully linked")}!</b>`,
        ``,
        `📱 <b>${f("number")}:</b> <code>${esc(displayNum)}</code>`,
        countryInfo
          ? `${flag} <b>${esc(countryInfo.name)}</b> (+${countryInfo.callingCode})`
          : `🌍 <i>${f("country unknown")}</i>`,
      ].join("\n");

      const failedText = [
        `😴 <b>${f("pairing unsuccessful")}</b>`,
        ``,
        `⏰ <b>${f("timed out - code was not used")}.</b>`,
        ``,
        `📱 <b>${f("number")}:</b> <code>${esc(displayNum)}</code>`,
        ``,
        `🔁 <b>${f("please try again")}:</b>`,
        `<code>/pair ${esc(displayNum)}</code>`,
      ].join("\n");

      const connectedKeyboard = { inline_keyboard: [[{ text: `🔵 ${f("join channel")}`, url: WA_CHANNEL_LINK }]] };

      (async () => {
        try {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
              cleanup();
              reject(new Error("timeout"));
            }, WATCH_TIMEOUT_MS);

            function cleanup() {
              clearTimeout(timer);
              manager.removeListener("connected", onConn);
              manager.removeListener("session.deleted", onDel);
            }

            function onConn(sid) {
              if (sid === digits) {
                cleanup();
                resolve("connected");
              }
            }

            function onDel(sid) {
              if (sid === digits) {
                cleanup();
                reject(new Error("deleted"));
              }
            }

            manager.on("connected", onConn);
            manager.on("session.deleted", onDel);
          });

          await safeEditCaption(chatId, msgId, connectedText, {
            reply_markup: connectedKeyboard,
            disable_web_page_preview: true,
          });
        } catch (reason) {
          await safeEditCaption(chatId, msgId, failedText, {
            reply_markup: connectedKeyboard,
            disable_web_page_preview: true,
          });
        }
      })();
    }

    return pairMsg;
  }

  // ── GROUP WELCOME / LEFT (video + mention) ────────────────────────────────────
  const tgName = (u) =>
    [u?.first_name, u?.last_name].filter(Boolean).join(" ").trim() || u?.username || "User";
  const tgMention = (u) => `<a href="tg://user?id=${u.id}">${esc(tgName(u).slice(0, 64))}</a>`;

  // WhatsApp-style template (&mention, `mono`, *bold*) -> Telegram HTML
  function tgHtml(template, mentionHtml) {
    const MARK = "\u0000M\u0000";
    let t = esc(String(template).replace(/&mention/g, MARK));
    t = t.replace(/`([^`]*)`/g, (_, x) =>
      x.split(MARK).map((part) => (part.trim() ? `<code>${part}</code>` : "")).join(MARK)
    );
    t = t.replace(/\*([^*\n]+)\*/g, "<b>$1</b>");
    return t.split(MARK).join(mentionHtml);
  }

  // sendVideo straight through the Bot API so the thumbnail + size are set exactly
  async function sendTgWelcomeVideo(chatId, caption) {
    const w = getRandomWelcome();
    if (!w) return safeReply(chatId, caption);
    try {
      const fd = new FormData();
      fd.append("chat_id", String(chatId));
      fd.append("caption", caption);
      fd.append("parse_mode", "HTML");
      fd.append("supports_streaming", "true");
      fd.append("width", String(w.width));
      fd.append("height", String(w.height));
      fd.append("duration", String(w.duration));
      fd.append("video", fs.createReadStream(w.file), { filename: "welcome.mp4", contentType: "video/mp4" });
      if (w.thumb && fs.existsSync(w.thumb))
        fd.append("thumbnail", fs.createReadStream(w.thumb), { filename: "thumb.jpg", contentType: "image/jpeg" });
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, fd, {
        headers: fd.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 120_000,
      });
    } catch (e) {
      console.error("[bot.js] welcome sendVideo failed:", e?.response?.data?.description || e?.message);
      try {
        await tbot.sendVideo(chatId, w.file, {
          caption,
          parse_mode: "HTML",
          supports_streaming: true,
          width: w.width,
          height: w.height,
          duration: w.duration,
        });
      } catch (e2) {
        console.error("[bot.js] welcome fallback failed:", e2?.message);
        await safeReply(chatId, caption);
      }
    }
  }

  async function sendTgWelcome(msg) {
    if (!isAllowedGroup(msg)) return;
    for (const u of msg.new_chat_members || []) {
      if (!u || u.is_bot) continue;
      await sendTgWelcomeVideo(msg.chat.id, tgHtml(WELCOME_TEXTS[0], tgMention(u)));
    }
  }

  async function sendTgLeft(msg) {
    const u = msg?.left_chat_member;
    if (!u || u.is_bot || !isAllowedGroup(msg)) return;
    await safeReply(msg.chat.id, tgHtml(GOODBYE_TEXTS[0], tgMention(u)));
  }

  tbot.on("left_chat_member", (msg) => {
    sendTgLeft(msg).catch((e) => console.error("[bot.js] left_chat_member error:", e?.message));
  });

  // ── GROUP RESTRICTIONS & JOIN ACTIONS ─────────────────────────────────────────
  tbot.on("new_chat_members", async (msg) => {
    try {
      if (!msg?.new_chat_members || !botId) return;
      const addedBot = msg.new_chat_members.some((m) => m.id === botId);
      if (!addedBot) {
        await sendTgWelcome(msg);
        return;
      }

      if (!isAllowedGroup(msg)) {
        await safeReply(
          msg.chat.id,
          `❌ <b>Unauthorized Group</b>\n\nThis bot only works in the official group.\n\n👉 ${GROUP_INVITE_LINK}`
        );
        await tbot.leaveChat(msg.chat.id).catch(() => {});
      } else {
        await safeReply(msg.chat.id, `🎉 <b>${BOT_NAME} is ready!</b>\n\n${f("Use /help to see available commands.")}`);
      }
    } catch (e) {
      console.error("[bot.js] new_chat_members error:", e);
    }
  });

  async function redirectToGroup(chatId, replyToId) {
    return tbot.sendMessage(
      chatId,
      [
        `🌸 <b>${f("group only feature")}</b>`,
        ``,
        `👉 <b>${f("this command works only in the official group")}.</b>`,
        `${f("click below to join and use")} <code>/pair</code> ${f("there")}.`,
      ].join("\n"),
      {
        parse_mode: "HTML",
        reply_to_message_id: replyToId,
        reply_markup: {
          inline_keyboard: [[{ text: `🌷 ${f("join official group")}`, url: GROUP_INVITE_LINK }]],
        },
      }
    ).catch(() => {});
  }

  // ── COMMAND PARSER ───────────────────────────────────────────────────────────
  function parseCmd(msg) {
    if (!msg?.text) return null;
    const entities = msg.entities || [];
    if (entities.length > 0 && entities[0].type === "bot_command" && entities[0].offset === 0) {
      const raw = msg.text.slice(0, entities[0].length);
      const cmd = raw.split(/[@\s]/)[0].replace(/^\//, "").toLowerCase();
      const args = msg.text.slice(entities[0].length).trim();
      return { cmd, args };
    }
    if (!msg.text.startsWith("/")) return null;
    const [rawCmd, ...rest] = msg.text.trim().split(/\s+/);
    return {
      cmd: rawCmd.split("@")[0].replace(/^\//, "").toLowerCase(),
      args: rest.join(" ").trim(),
    };
  }

  // ── NEW COMMANDS (welcome, menu, ping, id, play, song, music) ─────────────────
  const PING_TEXT = BOT_NAME;
  const canUse = (msg) => isPrivate(msg) || isAllowedGroup(msg);
  const safeName = (t, fallback) => (String(t || fallback).replace(/[\\/:*?"<>|]/g, "").slice(0, 60) || fallback);

  const mainKeyboard = () => ({
    inline_keyboard: [
      [
        { text: `📋 ${f("menu")}`, callback_data: "cmd:menu" },
        { text: `🏓 ${f("ping")}`, callback_data: "cmd:ping" },
      ],
      [
        { text: `🔑 ${f("pair")}`, callback_data: "cmd:pair" },
        { text: `🎵 ${f("music")}`, callback_data: "cmd:music" },
      ],
      [
        { text: `🔵 ${f("channel")}`, url: WA_CHANNEL_LINK },
        { text: `💬 ${f("group")}`, url: GROUP_INVITE_LINK },
      ],
    ],
  });
  const menuKeyboard = () => ({
    inline_keyboard: [
      [
        { text: `🏓 ${f("ping")}`, callback_data: "cmd:ping" },
        { text: `🔑 ${f("pair")}`, callback_data: "cmd:pair" },
      ],
      [
        { text: `▶️ ${f("play")}`, callback_data: "cmd:play" },
        { text: `🎶 ${f("song")}`, callback_data: "cmd:song" },
        { text: `🎵 ${f("music")}`, callback_data: "cmd:music" },
      ],
      [
        { text: `🔵 ${f("channel")}`, url: WA_CHANNEL_LINK },
        { text: `💬 ${f("group")}`, url: GROUP_INVITE_LINK },
      ],
    ],
  });

  const welcomeCaption = () =>
    [
      `✨ <b>${f("welcome to")} ${BOT_NAME}</b>`,
      ``,
      `⚡ <b>${f("fast & secure whatsapp pairing + music bot")}</b>`,
      ``,
      `📜 <b>${f("commands")}</b>`,
      `🚀 /start — ${f("open this menu")}`,
      `📋 /menu — ${f("show all commands")}`,
      `🔑 <code>/pair +919876543210</code> — ${f("get a pairing code")}`,
      `🏓 /ping — ${f("check bot latency")}`,
      `▶️ <code>/play name</code> — ${f("direct song")}`,
      `🎵 <code>/music name</code> — ${f("direct song")}`,
      ``,
      `🔑 ${f("send")} /pair ${f("right here in the group")}.`,
    ].join("\n");

  async function sendPlayCard(chatId, replyId, query) {
    const wait = await safeReply(chatId, `🔎 <i>${f("searching")}...</i>`, { reply_to_message_id: replyId });
    try {
      const info = await getInfo(query);
      const id = info.videoId || Date.now().toString(36);
      remember(id, info);

      const caption = [
        `<b>– ( ${f("youtube play")} )</b>`,
        `──────────────`,
        `🍉 <b>${f("title")}:</b> ${esc(info.title)}`,
        info.channel ? `🍃 <b>${f("channel")}:</b> ${esc(info.channel)}` : null,
        `🕐 <b>${f("duration")}:</b> ${esc(info.duration)}`,
        `🍓 <b>${f("views")}:</b> ${esc(info.views)}`,
        `🍼 <b>${f("uploaded")}:</b> ${esc(info.uploaded)}`,
        info.videoId ? `🏝️ <b>${f("video id")}:</b> <code>${esc(info.videoId)}</code>` : null,
        ``,
        `❄️ <b>${f("select download format")}</b>`,
      ]
        .filter((l) => l !== null)
        .join("\n");

      const reply_markup = {
        inline_keyboard: [
          [
            { text: `🎧 ${f("audio")}`, callback_data: `ytA:${id}` },
            { text: `🎬 ${f("video")}`, callback_data: `ytV:${id}` },
          ],
        ],
      };

      let thumb = null;
      for (const u of [info.thumbnail, info.videoId && `https://i.ytimg.com/vi/${info.videoId}/hqdefault.jpg`].filter(Boolean)) {
        try {
          thumb = await fetchBuffer(u, { tries: 2, timeout: 20_000, min: 500 });
          break;
        } catch (_) {}
      }

      if (wait?.message_id) await tbot.deleteMessage(chatId, wait.message_id).catch(() => {});
      if (thumb) {
        try {
          return await tbot.sendPhoto(chatId, thumb, { caption, parse_mode: "HTML", reply_markup, reply_to_message_id: replyId }, { filename: "thumb.jpg", contentType: "image/jpeg" });
        } catch (e) {
          console.error("[bot.js] play card photo failed:", e?.message);
        }
      }
      return safeReply(chatId, caption, { reply_markup, reply_to_message_id: replyId });
    } catch (err) {
      console.error("[bot.js] play failed:", err?.message || err);
      if (wait?.message_id) await tbot.deleteMessage(chatId, wait.message_id).catch(() => {});
      return safeReply(chatId, `⚠️ ${esc(err?.message || "play failed")}\n\n${CAPTION}`, { reply_to_message_id: replyId });
    }
  }

  async function sendMusic(chatId, replyId, query) {
    const wait = await safeReply(chatId, `🎵 <i>${f("searching")}...</i>`, { reply_to_message_id: replyId });
    try {
      tbot.sendChatAction(chatId, "upload_voice").catch(() => {});
      const song = await findSong(query);
      if (wait?.message_id) await tbot.deleteMessage(chatId, wait.message_id).catch(() => {});
      return await tbot.sendAudio(
        chatId,
        song.buffer,
        { caption: CAPTION, title: song.title || query, performer: song.artist || undefined, reply_to_message_id: replyId },
        { filename: `${safeName(song.title, "song")}.mp3`, contentType: "audio/mpeg" }
      );
    } catch (err) {
      console.error("[bot.js] music failed:", err?.message || err);
      if (wait?.message_id) await tbot.deleteMessage(chatId, wait.message_id).catch(() => {});
      return safeReply(chatId, `⚠️ ${esc(err?.message || "music failed")}\n\n${CAPTION}`, { reply_to_message_id: replyId });
    }
  }

  // returns true when the command was handled here
  async function handleExtra(msg, cmd, args, chatId, replyId) {
    // dangerous admin tools: only the Telegram IDs listed in TG_ADMIN_IDS
    if (["s", "as", "d"].includes(cmd)) {
      if (!canUse(msg)) return true;
      const uid = String(msg.from?.id || "");
      if (!ADMIN_IDS.includes(uid)) {
        await safeReply(
          chatId,
          `🔒 <b>${f("this admin tool is disabled")}</b>\n${f("your id")}: <code>${esc(uid)}</code>\n<i>${f("add it to")} TG_ADMIN_IDS ${f("to enable")}</i>`,
          { reply_to_message_id: replyId }
        );
        return true;
      }
      return false; // allowed → the original handler below runs
    }

    if (!["start", "menu", "help", "ping", "id", "play", "song", "music"].includes(cmd)) return false;
    if (!canUse(msg)) return true;

    if (cmd === "start") {
      await sendDp(chatId, welcomeCaption(), { reply_to_message_id: replyId, reply_markup: mainKeyboard() });
      return true;
    }
    if (cmd === "menu" || cmd === "help") {
      await sendDp(chatId, buildHelpMessage(), { reply_to_message_id: replyId, reply_markup: menuKeyboard() });
      return true;
    }
    if (cmd === "ping") {
      await safeReply(chatId, PING_TEXT, { reply_to_message_id: replyId });
      return true;
    }
    if (cmd === "id") {
      await safeReply(
        chatId,
        `🆔 <b>${f("your id")}:</b> <code>${esc(msg.from?.id || "")}</code>\n💬 <b>${f("chat id")}:</b> <code>${esc(chatId)}</code>`,
        { reply_to_message_id: replyId }
      );
      return true;
    }
    if (cmd === "play" || cmd === "song" || cmd === "music") {
      const q = (args || "").trim();
      if (!q) {
        await safeReply(chatId, `*️⃣ <b>${f("usage")}:</b> <code>/${cmd} ${cmd === "music" ? f("song name or spotify link") : f("song name")}</code>`, {
          reply_to_message_id: replyId,
        });
        return true;
      }
      await sendMusic(chatId, replyId, q); // direct audio — no card, no buttons
      return true;
    }
    return false;
  }

  // buttons: cmd:* (menu shortcuts) and ytA / ytV (audio / video of a /play card)
  async function handleCallbackExtra(query) {
    const { data, message } = query;
    const chatId = message.chat.id;
    const replyId = message.message_id;
    const fake = { chat: message.chat, from: query.from };
    if (!canUse(fake)) return true;

    if (data.startsWith("cmd:")) {
      const what = data.slice(4);
      if (what === "menu") await sendDp(chatId, buildHelpMessage(), { reply_markup: menuKeyboard() });
      else if (what === "ping") await safeReply(chatId, PING_TEXT);
      else if (what === "pair")
        await safeReply(chatId, `🔑 <b>${f("send in the official group")}:</b>\n<code>/pair +919876543210</code>`);
      else if (what === "play" || what === "song")
        await safeReply(chatId, `▶️ <b>${f("send")}:</b> <code>/${what} ${f("song name")}</code>`);
      else if (what === "music")
        await safeReply(chatId, `🎵 <b>${f("send")}:</b> <code>/music ${f("song name or spotify link")}</code>`);
      return true;
    }

    if (data.startsWith("ytA:") || data.startsWith("ytV:")) {
      const isAudio = data.startsWith("ytA:");
      const id = data.slice(4);
      try {
        tbot.sendChatAction(chatId, isAudio ? "upload_voice" : "upload_video").catch(() => {});
        if (isAudio) {
          const a = await audioFor(id);
          await tbot.sendAudio(
            chatId,
            a.buffer,
            { caption: CAPTION, title: a.title, performer: a.artist || undefined, reply_to_message_id: replyId },
            { filename: `${safeName(a.title, "audio")}.mp3`, contentType: "audio/mpeg" }
          );
        } else {
          const v = await videoFor(id);
          await tbot.sendVideo(
            chatId,
            v.buffer,
            { caption: CAPTION, supports_streaming: true, reply_to_message_id: replyId },
            { filename: `${safeName(v.title, "video")}.mp4`, contentType: "video/mp4" }
          );
        }
      } catch (err) {
        console.error(`[bot.js] ${isAudio ? "audio" : "video"} button failed:`, err?.message || err);
        await safeReply(chatId, `⚠️ ${esc(isAudio ? "Audio" : "Video")} ${f("failed")}: ${esc(err?.message || "error")}\n\n${CAPTION}`, {
          reply_to_message_id: replyId,
        });
      }
      return true;
    }
    return false;
  }

  // ── COMMAND ROUTER ───────────────────────────────────────────────────────────
  async function handleCommand(msg) {
    const parsed = parseCmd(msg);
    if (!parsed) return;
    const { cmd, args } = parsed;
    const chatId = msg.chat.id;
    const replyId = msg.message_id;

    console.log(`[bot.js] /${cmd} from ${msg.from?.id || msg.sender_chat?.id} in ${chatId}`);

    if (await handleExtra(msg, cmd, args, chatId, replyId)) return;

    // /start
    if (cmd === "start") {
      if (isPrivate(msg)) return redirectToGroup(chatId, replyId);
      if (!isAllowedGroup(msg)) return;
      return safeReply(
        chatId,
        [
      `✨ <b>${BOT_NAME}</b>`,
          ``,
          `⚡ <b>Fast & secure WhatsApp pairing system.</b>`,
          ``,
          `📌 <b>Generate your pair code:</b>`,
          `<code>/pair +919641092392</code>`,
          ``,
          `📖 <b>See all commands:</b> <code>/help</code>`,
        ].join("\n"),
        { reply_to_message_id: replyId }
      );
    }

    // /help
    if (cmd === "help") {
      if (isPrivate(msg)) return redirectToGroup(chatId, replyId);
      if (!isAllowedGroup(msg)) return;
      return safeReply(chatId, buildHelpMessage(), { reply_to_message_id: replyId });
    }

    // /s (Execute on Single Session)
    if (cmd === "s") {
      const spaceIdx = (args || "").indexOf(" ");
      if (spaceIdx === -1) {
        return safeReply(
          chatId,
          [
            `❓ <b>Usage:</b>`,
            `<code>/s 919641092392 sock.sendMessage('jid', { text: 'hi' })</code>`,
            `<code>/s 919641092392 sock.user</code>`,
          ].join("\n"),
          { reply_to_message_id: replyId }
        );
      }

      const sid = args.slice(0, spaceIdx).trim().replace(/\D/g, "");
      const code = args.slice(spaceIdx + 1).trim();

      if (!sid || !code) {
        return safeReply(chatId, `❌ <b>Missing session ID or code.</b>`, { reply_to_message_id: replyId });
      }

      const entry = manager.sessions.get(sid);
      if (!entry?.sock) {
        const allSids = [...(manager.sessions?.keys() || [])].map((s) => `<code>${esc(s)}</code>`).join(", ");
        return safeReply(
          chatId,
          [`❌ <b>Session Not Found:</b> <code>${esc(sid)}</code>`, `📋 Available: ${allSids || "none"}`].join("\n"),
          { reply_to_message_id: replyId }
        );
      }

      const sock = entry.sock;
      const sessionUser = sock.user?.name || sock.user?.id?.split(":")?.[0] || sid;
      const isHealthy = entry.healthy ?? entry.status === "open";

      const statusMsg = await safeReply(
        chatId,
        [
          `⏳ <b>Executing...</b>`,
          `📱 <code>${esc(sid)}</code> (${esc(sessionUser)}) ${isHealthy ? "🟢" : "🔴"}`,
          `📟 <code>${esc(code.slice(0, 300))}</code>`,
        ].join("\n"),
        { reply_to_message_id: replyId }
      );

      const startTime = Date.now();
      try {
        const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;
        const fn = new AsyncFn("sock", `return await (${code})`);

        const result = await Promise.race([
          fn(sock),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Execution timed out (30s)")), 30_000)),
        ]);

        const execMs = Date.now() - startTime;
        let resultStr = "";
        let typeSummary = "";

        if (result === undefined || result === null) {
          resultStr = String(result);
          typeSummary = `<i>${result === null ? "null" : "undefined"}</i>`;
        } else if (Buffer.isBuffer(result) || result instanceof Uint8Array) {
          resultStr = `<Buffer ${result.byteLength} bytes>`;
          typeSummary = `📦 Buffer — ${result.byteLength} bytes`;
        } else if (Array.isArray(result)) {
          resultStr = JSON.stringify(result, null, 2);
          typeSummary = `📋 Array — ${result.length} items`;
        } else if (typeof result === "object") {
          resultStr = JSON.stringify(result, null, 2);
          typeSummary = `🗂 Object — ${Object.keys(result).length} keys`;
        } else {
          resultStr = String(result);
          typeSummary = `${typeof result}`;
        }

        if (statusMsg?.message_id) await tbot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

        const header = [
          `✅ <b>Done!</b>  📱 <code>${esc(sid)}</code> (${esc(sessionUser)})`,
          `📊 <b>Type:</b> ${typeSummary}`,
          `⚡ <b>Time:</b> ${execMs}ms`,
        ].join("\n");

        if (resultStr.length <= 3000) {
          return safeReply(chatId, `${header}\n\n📤 <b>Result:</b>\n<pre>${esc(resultStr)}</pre>`, {
            reply_to_message_id: replyId,
          });
        }

        const tmpPath = path.join(os.tmpdir(), `s_${sid}_${Date.now()}.json`);
        try {
          await fs.promises.writeFile(tmpPath, resultStr, "utf8");
          await tbot.sendDocument(chatId, tmpPath, {
            caption: header,
            parse_mode: "HTML",
            reply_to_message_id: replyId,
          });
        } finally {
          fs.promises.unlink(tmpPath).catch(() => {});
        }
      } catch (err) {
        if (statusMsg?.message_id) await tbot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
        return safeReply(
          chatId,
          `❌ <b>Error on <code>${esc(sid)}</code></b> (${Date.now() - startTime}ms)\n💬 <code>${esc(err?.message || err)}</code>`,
          { reply_to_message_id: replyId }
        );
      }
    }

    // /as (Execute on All Sessions)
    if (cmd === "as") {
      const code = (args || "").trim();
      if (!code) {
        return safeReply(
          chatId,
          `❓ <b>Usage:</b>\n<code>/as sock.sendMessage('jid', { text: 'hi' })</code>`,
          { reply_to_message_id: replyId }
        );
      }

      const allEntries = [...manager.sessions.entries()].filter(
        ([, entry]) => entry?.sock && (entry.healthy === true || entry.status === "connected" || entry.status === "open")
      );

      const statusMsg = await safeReply(
        chatId,
        `⏳ <b>Running on ALL sessions...</b>\n🔢 Total: <b>${allEntries.length}</b>`,
        { reply_to_message_id: replyId }
      );

      const startTime = Date.now();
      const AsyncFn = Object.getPrototypeOf(async function () {}).constructor;

      const results = await Promise.allSettled(
        allEntries.map(async ([sid, entry]) => {
          const fn = new AsyncFn("sock", `return await (${code})`);
          const result = await Promise.race([
            fn(entry.sock),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout 30s")), 30_000)),
          ]);
          return { sid, result };
        })
      );

      const execMs = Date.now() - startTime;
      if (statusMsg?.message_id) await tbot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

      let successCount = 0;
      let failCount = 0;
      const lines = [];

      results.forEach((r, i) => {
        const sid = allEntries[i][0];
        if (r.status === "fulfilled") {
          successCount++;
          lines.push(`✅ <code>${esc(sid)}</code>`);
        } else {
          failCount++;
          lines.push(`❌ <code>${esc(sid)}</code> — <i>${esc(r.reason?.message || "Error")}</i>`);
        }
      });

      const summary = [
        `📊 <b>All Sessions Done!</b> (${execMs}ms)`,
        `✅ Success: <b>${successCount}</b> | ❌ Failed: <b>${failCount}</b>`,
        ``,
        ...lines,
      ].join("\n");

      return safeReply(chatId, summary, { reply_to_message_id: replyId });
    }

    // /ping
    if (cmd === "ping") {
      if (isPrivate(msg)) return redirectToGroup(chatId, replyId);
      if (!isAllowedGroup(msg)) return;
      const start = Date.now();
      const m = await safeReply(chatId, "🏓 Pong!", { reply_to_message_id: replyId });
      return safeEdit(chatId, m.message_id, `🏓 <b>Pong!</b>\n⚡ <b>${Date.now() - start}ms</b>`);
    }

    // /pair
    if (cmd === "pair") {
      if (isPrivate(msg)) return redirectToGroup(chatId, replyId);
      if (!isAllowedGroup(msg)) return;

      if (!args) {
        return safeReply(
          chatId,
          `🛑 <b>Usage:</b>\n<code>/pair +919641092392</code>`,
          { reply_to_message_id: replyId }
        );
      }

      const digits = args.replace(/\D/g, "");
      if (!digits || digits.length < 6) {
        return safeReply(
          chatId,
          `❌ <b>Invalid number.</b> <code>/pair +919641092392</code>`,
          { reply_to_message_id: replyId }
        );
      }

      const userId = msg.from?.id || msg.sender_chat?.id;
      const lastPair = pairCooldown.get(userId) || 0;
      const remaining = PAIR_COOLDOWN_MS - (Date.now() - lastPair);

      if (remaining > 0) {
        return safeReply(
          chatId,
          `⏳ <b>Please wait ${Math.ceil(remaining / 1000)}s before requesting again.</b>`,
          { reply_to_message_id: replyId }
        );
      }
      pairCooldown.set(userId, Date.now());

      return doPair(chatId, args, replyId);
    }

    // /reactp
    if (cmd === "reactp") {
      if (!isAllowedGroup(msg) && !isPrivate(msg)) return;

      const parts = (args || "").trim().split(/\s+/);
      const postLink = parts[0];

      if (!postLink || !postLink.startsWith("https://whatsapp.com/channel/")) {
        return safeReply(
          chatId,
          `❓ <b>Usage:</b>\n<code>/reactp https://whatsapp.com/channel/0029Vb8RL4F1HspsNlYYOE3e/123 🍉👀</code>`,
          { reply_to_message_id: replyId }
        );
      }

      const emojiList = parts.slice(1).join("").match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu) || ["🔥"];
      const chosenEmoji = emojiList[Math.floor(Math.random() * emojiList.length)];

      const conns = manager.getAllConnections?.() || [];
      const active = conns.find((c) => c.healthy);
      if (!active) {
        return safeReply(chatId, `❌ <b>No active WhatsApp session found.</b>`, { reply_to_message_id: replyId });
      }

      await safeReply(chatId, `⏳ <b>Reacting...</b>\n🎲 <b>Picked:</b> ${chosenEmoji}`, {
        reply_to_message_id: replyId,
      });

      try {
        const msgNumber = parseInt(postLink.split("/").pop());
        const info = await active.connection.newsletterInfo(postLink);
        const msgs = await active.connection.newsletterFetchMessages(info.id, 20);
        const targetMsg = msgs.find((m) => m.newsletterServerId === msgNumber);

        if (!targetMsg) {
          return safeReply(chatId, `❌ <b>Post not found.</b>`, { reply_to_message_id: replyId });
        }

        await active.connection.newsletterReactMessage(info.id, targetMsg.key.id, chosenEmoji);
        return safeReply(chatId, `✅ <b>Reacted!</b>\n📌 Post: #${msgNumber}\n🎯 Emoji: ${chosenEmoji}`, {
          reply_to_message_id: replyId,
        });
      } catch (err) {
        return safeReply(chatId, `❌ <b>Failed:</b> <i>${esc(err?.message || err)}</i>`, {
          reply_to_message_id: replyId,
        });
      }
    }

    // /sessions
    if (cmd === "sessions" || cmd === "session") {
      if (!isAllowedGroup(msg)) return;
      if (!(await isAdmin(msg))) return safeReply(chatId, `🚫 <b>Admins Only</b>`, { reply_to_message_id: replyId });

      const conns = manager.getAllConnections?.() || [];
      if (conns.length === 0) {
        return safeReply(chatId, `🌙 <b>No Active Sessions</b>`, { reply_to_message_id: replyId });
      }

      const connected = conns.filter((c) => c.healthy).length;
      let text = `🧩 <b>ACTIVE SESSIONS</b> (${connected}/${conns.length} Online)\n\n`;

      conns.forEach((c, i) => {
        const sid = c.sessionId || c.file_path || "unknown";
        const dot = c.healthy ? "🟢" : "🔴";
        text += `${dot} <b>${i + 1}.</b> <code>${esc(sid)}</code>\n`;
      });

      return safeReply(chatId, text, { reply_to_message_id: replyId, disable_web_page_preview: true });
    }

    // /status
    if (cmd === "status") {
      if (!isAllowedGroup(msg)) return;
      if (!(await isAdmin(msg))) return safeReply(chatId, `🚫 <b>Admins Only</b>`, { reply_to_message_id: replyId });

      const conns = manager.getAllConnections?.() || [];
      const online = conns.filter((c) => c.healthy).length;
      const upSec = Math.floor(process.uptime());
      const memMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

      return safeReply(
        chatId,
        [
          `📊 <b>${BOT_NAME} ${f("status")}</b>`,
          `⏰ Uptime: <code>${Math.floor(upSec / 3600)}h ${Math.floor((upSec % 3600) / 60)}m</code>`,
          `💾 Memory: <code>${memMb} MB</code>`,
          `🔌 Sessions: 🟢 <b>${online}</b> / <b>${conns.length}</b>`,
        ].join("\n"),
        { reply_to_message_id: replyId }
      );
    }

    // /d (Terminal Exec)
    if (cmd === "d") {
      if (!isAllowedGroup(msg)) return;
      if (!(await isAdmin(msg))) return safeReply(chatId, `🚫 <b>Admins Only</b>`, { reply_to_message_id: replyId });

      const rawCmd = (args || "").trim();
      if (!rawCmd) return safeReply(chatId, `ℹ️ <b>Usage:</b> <code>/d ls -la</code>`, { reply_to_message_id: replyId });

      await safeReply(chatId, `⚙️ <b>Executing:</b> <code>${esc(rawCmd)}</code>`, { reply_to_message_id: replyId });

      const lines = [];
      const child = spawn("bash", ["-lc", rawCmd], { env: process.env });

      const pushLines = (chunk, src) => {
        chunk.toString().split(/\r?\n/).forEach((ln) => {
          if (ln && lines.length < 50) lines.push(src === "err" ? `[ERR] ${ln}` : ln);
        });
      };

      child.stdout.on("data", (c) => pushLines(c, "out"));
      child.stderr.on("data", (c) => pushLines(c, "err"));

      child.on("close", async () => {
        const payload = lines.join("\n").trim();
        if (!payload) return safeReply(chatId, `⚠️ <b>No output produced.</b>`, { reply_to_message_id: replyId });
        return safeReply(chatId, `<pre>${esc(payload)}</pre>`, { reply_to_message_id: replyId });
      });

      return;
    }
  }

  // ── CALLBACK QUERY HANDLER ───────────────────────────────────────────────────
  tbot.on("callback_query", async (query) => {
    const { data, id, message } = query;
    if (!data || !message?.chat?.id) return;

    try {
      await tbot.answerCallbackQuery(id).catch(() => {});
      if (await handleCallbackExtra(query)) return;
      if (data.startsWith("repairr:")) {
        const digits = data.split(":")[1];
        if (!digits) return;

        const userId = query.from?.id;
        const lastPair = pairCooldown.get(userId) || 0;
        if (PAIR_COOLDOWN_MS - (Date.now() - lastPair) > 0) return;

        pairCooldown.set(userId, Date.now());
        return doPair(message.chat.id, `+${digits}`, message.message_id);
      }
    } catch (e) {
      console.error("[bot.js] Callback query error:", e);
    }
  });

  // ── MESSAGE LISTENER ─────────────────────────────────────────────────────────
  tbot.on("message", async (msg) => {
    try {
      await handleCommand(msg);
    } catch (e) {
      console.error("[bot.js] handleCommand error:", e);
    }
  });

  // ── WEBHOOK / POLLING BOOT ───────────────────────────────────────────────────
  if (USE_WEBHOOK) {
    try {
      const hookPath = `/bot${BOT_TOKEN}`;
      const webhookUrl = `${RAILWAY_URL.replace(/\/$/, "")}${hookPath}`;
      await tbot.setWebHook(webhookUrl);
      console.log("[bot.js] ✅ Webhook set:", webhookUrl);
    } catch (e) {
      console.error("[bot.js] Webhook setup failed:", e?.message);
    }
  } else {
    console.log("[bot.js] ℹ️ Polling mode active.");
  }

  tbot.cleanup = async () => {
    try {
      if (USE_WEBHOOK) await tbot.deleteWebHook().catch(() => {});
      else await tbot.stopPolling().catch(() => {});
      console.log("[bot.js] 🛑 Bot stopped cleanly.");
    } catch {}
  };

  try {
    global.tbot = tbot;
  } catch {}

  return tbot;
}
