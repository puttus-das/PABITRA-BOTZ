import { fancyText } from "./fancy.js";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
} from "baileys";
import pino from "pino";
import { gift } from "./serialize.js";
import config from "../config.js";
import path from "path";
import fs from "fs/promises";

const stripLegacyBrand = (text) => String(text)
  .replace(/©\s*(?:𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ|PABITRA-BOT)(?:\s*[💜»*_\-]*)?/gu, "")
  .replace(/Powered by\s+(?:𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ|PABITRA-BOT)(?:\s*[💜»*_\-]*)?/giu, "")
  .replace(/PABITRA-BOT\s*•\s*[^\n]*/g, "")
  .replace(/\n{3,}/g, "\n\n")
  .trimEnd();
const withBrandLine = (text) => {
  const cleaned = stripLegacyBrand(text);
  return cleaned.includes(config.brandLine) ? cleaned : `${cleaned}\n\n${config.brandLine}`;
};

/**
 * Create a Baileys WhatsApp socket for a given session.
 *
 * @param {string} sessionId   - Filesystem-safe session ID (already sanitized by SessionManager)
 * @param {object} [opts]
 * @param {function} [opts.onQR]  - Called with (qrString) whenever a QR code is generated
 * @returns {Promise<WASocket>}
 */
export async function createSocket(sessionId, opts = {}) {
  const { onQR } = opts;

  const sessionsDir = config.AUTH_DIR;
  await fs.mkdir(sessionsDir, { recursive: true });

  const sessionPath = path.join(sessionsDir, sessionId);
  await fs.mkdir(sessionPath, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  console.log(
    `[${sessionId}] Creating socket with Baileys v${version.join(".")}`
  );

  const silentLogger = pino({ level: "silent" });

  const sock = makeWASocket({
    version,
    logger: silentLogger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
    },
    browser: Browsers.macOS("Safari"),
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    keepAliveIntervalMs: 30_000,
    markOnlineOnConnect: true,
    syncFullHistory: false,
  });

  // vCard (contact card) quote on EVERY normal outgoing message from every command.
  // Skipped for reactions, deletes, edits, forwards, status and channels.
  const _rawSend = sock.sendMessage.bind(sock);
  sock.sendMessage = (jid, content, options = {}) => {
    try {
      const special =
        !content ||
        content.react || content.delete || content.edit || content.forward ||
        content.pin || content.poll || content.disappearingMessagesInChat !== undefined;
      const skipJid = typeof jid === "string" && (jid === "status@broadcast" || jid.endsWith("@newsletter"));
      // keepQuoted: true → a command that brings its own quoted card (e.g. .pabitra) keeps it
      const { keepQuoted, ...rest } = options || {};
      options = !special && !skipJid && !keepQuoted ? { ...rest, quoted: gift } : rest;
      // small-caps font on every reply (links, .commands, @numbers, `code` stay untouched)
      if (content && typeof content === "object" && jid !== "status@broadcast") {
        if (content.noFont) {
          const { noFont, ...clean } = content;
          content = clean;
        } else if (typeof content.text === "string" || typeof content.caption === "string") {
          content = { ...content };
          if (typeof content.text === "string") content.text = fancyText(withBrandLine(content.text));
          if (typeof content.caption === "string") content.caption = fancyText(withBrandLine(content.caption));
        }
      }
    } catch (_) { /* never block a send */ }
    return _rawSend(jid, content, options);
  };

  // Tag socket with sessionId (used by lib/index.js and plugins)
  sock.sessionId = sessionId;

  // Persist credentials whenever they change
  sock.ev.on("creds.update", saveCreds);

  // Surface QR code to caller — do NOT handle reconnect logic here.
  // SessionManager owns all connection.update reconnect logic via _handleConnectionUpdate.
  sock.ev.on("connection.update", ({ qr }) => {
    if (qr) {
      console.log(`[${sessionId}] QR code ready`);
      if (typeof onQR === "function") {
        try {
          onQR(qr);
        } catch (e) {
          /* never let onQR crash socket creation */
        }
      }
    }
  });

  return sock;
}
