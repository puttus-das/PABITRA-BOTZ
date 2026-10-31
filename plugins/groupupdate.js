// plugins/welcome-goodbye.js
import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";
import { WELCOME_TEXTS, GOODBYE_TEXTS, pickRandom } from "./bin/text.js";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { jidNormalizedUser } from "baileys";
import { gift } from "../lib/serialize.js";
import { fancyText } from "../lib/fancy.js";
import { getRandomWelcome } from "../lib/welcomeVideos.js";

const FOOT = "*«© 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ 💜»*";
const toggleMsg = (what, on) =>
  `*${on ? "✅" : "❌"} ${fancyText(`${what} ${on ? "Enabled" : "Disabled"} for this Group`)}*\n\n${FOOT}`;
const statusMsg = (what, on) =>
  `*${on ? "✅" : "❌"} ${fancyText(`${what} is ${on ? "ON" : "OFF"} for this Group`)}*\n\n${FOOT}`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BIN = path.join(__dirname, "bin");
const readBin = (f) => {
  try {
    return fs.readFileSync(path.join(BIN, f));
  } catch {
    return null;
  }
};
// a different random video for every new member
const getWelcomeVideo = () => {
  const w = getRandomWelcome();
  if (!w) return null;
  try {
    return fs.readFileSync(w.file);
  } catch {
    return null;
  }
};
let _dp;
const getDp = () => (_dp === undefined ? (_dp = readBin("menu_thumb.jpg")) : _dp);
const BOT_NAME = "𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ";
const PAIR_URL = "https://t.me/PABITRA_BOTZ";

const DEFAULT_GOODBYE = pickRandom(GOODBYE_TEXTS);
const DEFAULT_WELCOME = pickRandom(WELCOME_TEXTS);

/* ---------------- helpers ---------------- */
function toBool(v) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v === "string")
    return ["true", "1", "yes", "on"].includes(v.toLowerCase());
  return Boolean(v);
}

function buildText(template = "", replacements = {}) {
  let text = template || "";
  const wantsPp = text.includes("&pp");
  text = text.replace(/&pp/g, "").trim();
  text = text.replace(/&mention/g, replacements.mentionText || "");
  text = text.replace(/&name/g, replacements.name || "");
  text = text.replace(/&size/g, String(replacements.size ?? ""));
  return { text, wantsPp };
}

async function fetchProfileBuffer(conn, jid) {
  try {
    const getUrl =
      typeof conn.profilePictureUrl === "function"
        ? () => conn.profilePictureUrl(jid, "image").catch(() => null)
        : () => Promise.resolve(null);
    const url = await getUrl();
    if (!url) return null;
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 20000,
    });
    return Buffer.from(res.data);
  } catch (e) {
    console.error(
      "[welcome-goodbye] fetchProfileBuffer error:",
      e?.message || e
    );
    return null;
  }
}

async function sendWelcomeMsg(
  conn,
  groupJid,
  text,
  mentions = [],
  imgBuffer = null,
  videoBuffer = null
) {
  const build = (withMentions) => {
    const m = withMentions ? { mentions } : {};
    if (videoBuffer)
      return { video: videoBuffer, mimetype: "video/mp4", caption: text, ...m };
    if (imgBuffer) return { image: imgBuffer, caption: text, ...m };
    return { text, ...m };
  };
  try {
    await conn.sendMessage(groupJid, build(true));
  } catch (err) {
    console.error(
      "[welcome-goodbye] sendWelcomeMsg primary error:",
      err?.message || err
    );
    // fallback: plain text (no media / no mentions)
    try {
      await conn.sendMessage(groupJid, { text });
    } catch (e) {
      console.error(
        "[welcome-goodbye] sendWelcomeMsg fallback error:",
        e?.message || e
      );
    }
  }
}

// Admin-event message: VCard quote + Pabitra-Bot dp as the small preview thumbnail
async function sendAdminEvent(conn, groupJid, text, mentions = []) {
  const dp = getDp();
  const contextInfo = {
    mentionedJid: mentions,
    ...(dp
      ? {
          externalAdReply: {
            title: BOT_NAME,
            body: "Admin Event",
            thumbnail: dp,
            mediaType: 1,
            renderLargerThumbnail: false,
            showAdAttribution: false,
            sourceUrl: PAIR_URL,
          },
        }
      : {}),
  };
  try {
    await conn.sendMessage(groupJid, { text, mentions, contextInfo }, { quoted: gift });
  } catch (e) {
    console.error("[welcome-goodbye] admin event send error:", e?.message || e);
    try {
      await conn.sendMessage(groupJid, { text, mentions });
    } catch (_) {}
  }
}

/* ---------------- COMMANDS (group-level on/off only) ---------------- */
/*
  Usage (must be sent inside the group):
    .welcome on
    .welcome off
    .goodbye on
    .goodbye off
*/
Module({
  command: "welcome",
  package: "group",
  description:
    "Turn per-group welcome ON or OFF (must be used inside the group).",
})(async (message, match) => {
  // require group context
  const groupJid =
    message.from ||
    message.chat ||
    message.key?.remoteJid ||
    (message.isGroup ? message.isGroup : null);
  if (!groupJid || !groupJid.includes("@g.us")) {
    return await message.send?.(
      "❌ Use this command inside the group to toggle welcome messages."
    );
  }

  // only on/off supported. ignore custom message
  const raw = (match || "").trim().toLowerCase();
  if (!raw) {
    // read current
    const botNumber =
      (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) ||
      "bot";
    const key = `group:${groupJid}:welcome`;
    const cfg = await db.getAsync(botNumber, key, null);
    const status = cfg && typeof cfg === "object" ? toBool(cfg.status) : false;
    return await message.sendreply?.(statusMsg("Welcome", status));
  }

  if (raw !== "on" && raw !== "off") {
    return await message.send?.("❌ Invalid option. Use `on` or `off`.");
  }

  const botNumber =
    (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) ||
    "bot";
  const key = `group:${groupJid}:welcome`;
  const cfg = { status: raw === "on" };
  await db.set(botNumber, key, cfg);
  await message.react?.("✅");
  return await message.send(toggleMsg("Welcome", cfg.status));
});

Module({
  command: "goodbye",
  package: "group",
  description:
    "Turn per-group goodbye ON or OFF (must be used inside the group).",
})(async (message, match) => {
  const groupJid =
    message.from ||
    message.chat ||
    message.key?.remoteJid ||
    (message.isGroup ? message.isGroup : null);
  if (!groupJid || !groupJid.includes("@g.us")) {
    return await message.send?.(
      "❌ Use this command inside the group to toggle goodbye messages."
    );
  }

  const raw = (match || "").trim().toLowerCase();
  if (!raw) {
    const botNumber =
      (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) ||
      "bot";
    const key = `group:${groupJid}:goodbye`;
    const cfg = await db.getAsync(botNumber, key, null);
    const status = cfg && typeof cfg === "object" ? toBool(cfg.status) : false;
    return await message.sendreply?.(statusMsg("Goodbye", status));
  }

  if (raw !== "on" && raw !== "off") {
    return await message.send?.("❌ Invalid option. Use `on` or `off`.");
  }

  const botNumber =
    (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) ||
    "bot";
  const key = `group:${groupJid}:goodbye`;
  const cfg = { status: raw === "on" };
  await db.set(botNumber, key, cfg);
  await message.react?.("✅");
  return await message.send(toggleMsg("Goodbye", cfg.status));
});

/* ---------------- EVENT: group-participants.update ---------------- */
Module({ on: "group-participants.update" })(async (_msg, event, conn) => {
  try {
    if (
      !event ||
      !event.id ||
      !event.action ||
      !Array.isArray(event.participants)
    )
      return;
    const groupJid = event.id;
    const groupName =
      event.groupName ||
      (event.groupMetadata && event.groupMetadata.subject) ||
      "";
    const groupSize =
      typeof event.groupSize === "number"
        ? event.groupSize
        : event.groupMetadata && Array.isArray(event.groupMetadata.participants)
        ? event.groupMetadata.participants.length
        : event.groupMetadata && event.groupMetadata.participants
        ? event.groupMetadata.participants.length
        : 0;

    // compute botNumber same as commands
    const botNumber =
      (conn?.user?.id && String(conn.user.id).split(":")[0]) || "bot";
    const action = String(event.action).toLowerCase();
    const botJidFull = jidNormalizedUser(conn?.user?.id);

    for (const p of event.participants) {
      const participantJid = jidNormalizedUser(
        typeof p === "string" ? p : p.id || p.jid || ""
      );
      if (!participantJid) continue;
      if (botJidFull && participantJid === botJidFull) continue; // skip bot itself

      // WELCOME (add/invite/join)
      if (action === "add" || action === "invite" || action === "joined") {
        const key = `group:${groupJid}:welcome`;
        const cfgRaw = await db.getAsync(botNumber, key, null);
        const enabled =
          cfgRaw && typeof cfgRaw === "object" ? toBool(cfgRaw.status) : false;
        if (!enabled) continue;

        const mentionText = `@${participantJid.split("@")[0]}`;
        const replacements = { mentionText, name: groupName, size: groupSize };
        const { text, wantsPp } = buildText(DEFAULT_WELCOME, replacements);

        let imgBuf = null;
        if (wantsPp) imgBuf = await fetchProfileBuffer(conn, participantJid);

        try {
          await sendWelcomeMsg(
            conn,
            groupJid,
            text,
            [participantJid],
            imgBuf,
            getWelcomeVideo()
          );
        } catch (e) {
          console.error(
            "[welcome-goodbye] error sending welcome:",
            e?.message || e
          );
        }
      }

      // GOODBYE (remove/leave/left/kicked)
      if (
        action === "remove" ||
        action === "leave" ||
        action === "left" ||
        action === "kicked"
      ) {
        const key = `group:${groupJid}:goodbye`;
        const cfgRaw = await db.getAsync(botNumber, key, null);
        const enabled =
          cfgRaw && typeof cfgRaw === "object" ? toBool(cfgRaw.status) : false;
        if (!enabled) continue;

        const mentionText = `@${participantJid.split("@")[0]}`;
        const replacements = { mentionText, name: groupName, size: groupSize };
        const { text, wantsPp } = buildText(DEFAULT_GOODBYE, replacements);

        let imgBuf = null;
        if (wantsPp) imgBuf = await fetchProfileBuffer(conn, participantJid);

        try {
          await sendWelcomeMsg(conn, groupJid, text, [participantJid], imgBuf);
        } catch (e) {
          console.error(
            "[welcome-goodbye] error sending goodbye:",
            e?.message || e
          );
        }
      }

      // PROMOTE / DEMOTE
      if (action === "promote" || action === "demote") {
        const actor = event.actor || event.author || event.by || null;
        const actorText = actor ? `@${String(actor).split("@")[0].split(":")[0]}` : "Admin";
        const targetText = `@${participantJid.split("@")[0]}`;
        let gName = groupName;
        if (!gName) {
          try {
            gName = (await conn.groupMetadata(groupJid))?.subject || "";
          } catch (_) {}
        }
        const sendText =
          action === "promote"
            ? `爱 👑 𝐏ʀᴏᴍᴏᴛᴇᴅ ᴛᴏ 𝐀ᴅᴍɪɴ 爱\n\n` +
              `爱 ${targetText} ɪs ɴᴏᴡ ɢʀᴏᴜᴘ ᴀᴅᴍɪɴ 爱\n\n` +
              `爱 «© 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ» 爱`
            : `爱 〔 𝐀ᴅᴍɪɴ 𝐄ᴠᴇɴᴛ 〕 爱\n\n` +
              `爱 ${actorText} 𝐡ᴀs ᴅᴇᴍᴏᴛᴇᴅ ${targetText} 爱\n\n` +
              `爱 𝐆ʀᴏᴜᴘ: ${gName} 爱`;
        const mentions = [actor, participantJid].filter(Boolean);
        await sendAdminEvent(conn, groupJid, sendText, mentions);
      }
    }
  } catch (err) {
    console.error(
      "[welcome-goodbye] event handler error:",
      err?.message || err
    );
  }
});
