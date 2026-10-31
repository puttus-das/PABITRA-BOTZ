import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { proto, generateWAMessageFromContent } from "baileys";
import { Module } from "../lib/plugins.js";
import config from "../config.js";

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "bin");
const prefix = () => config.prefix || ".";
// Clickable web piano (tap keys in the browser). Override with PIANO_URL in config.env
const PIANO_URL = process.env.PIANO_URL || "https://claude.ai/artifact/YJQy8k8RTVnJv5TxgpQNNR";

// key -> [button label, file name]
const WHITE = { do: ["Do", "do"], re: ["Re", "re"], mi: ["Mi", "mi"], fa: ["Fa", "fa"], sol: ["Sol", "sol"], la: ["La", "la"], si: ["Si", "si"], do2: ["Do (high)", "do2"] };
const BLACK = { "do#": ["Do#", "dos"], "re#": ["Re#", "res"], "fa#": ["Fa#", "fas"], "sol#": ["Sol#", "sols"], "la#": ["La#", "las"] };
const STRINGS = { e6: ["E (low)", "e6"], a5: ["A", "a5"], d4: ["D", "d4"], g3: ["G", "g3"], b2: ["B", "b2"], e1: ["e (high)", "e1"] };

async function sendButtons(message, text, footer, map, cmd) {
  const P = proto.Message.InteractiveMessage;
  const bizNodes = [{
    tag: "biz", attrs: {},
    content: [{ tag: "interactive", attrs: { type: "native_flow", v: "1" }, content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }] }],
  }];
  if (!message.from.endsWith("@g.us")) bizNodes.push({ tag: "bot", attrs: { biz_bot: "1" } });
  const buttons = Object.entries(map).map(([key, [label]]) => ({
    name: "quick_reply",
    buttonParamsJson: JSON.stringify({ display_text: label, id: `${prefix()}${cmd} ${key}` }),
  }));
  const msg = generateWAMessageFromContent(message.from, {
    viewOnceMessage: { message: {
      messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
      interactiveMessage: P.create({
        body: P.Body.create({ text }),
        footer: P.Footer.create({ text: footer }),
        header: P.Header.create({ hasMediaAttachment: false }),
        nativeFlowMessage: P.NativeFlowMessage.create({ buttons }),
      }),
    } },
  }, { quoted: message.gift, userJid: message.conn.user?.id });
  await message.conn.relayMessage(message.from, msg.message, { messageId: msg.key.id, additionalNodes: bizNodes });
}

async function sendBoard(message, { image, title, cards, cmd }) {
  const conn = message.conn;
  try {
    await conn.sendMessage(message.from, { image: fs.readFileSync(path.join(BIN, image)), caption: title }, { quoted: message.gift });
  } catch (e) { console.error("[piano] image failed:", e?.message || e); }
  for (const [text, map] of cards) {
    try {
      await sendButtons(message, text, "𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ", map, cmd);
    } catch (e) {
      console.error("[piano] buttons failed:", e?.message || e);
      const list = Object.keys(map).map((k) => `${prefix()}${cmd} ${k}`).join("\n");
      await conn.sendMessage(message.from, { text: `${text}\n\n${list}` }, { quoted: message.gift });
    }
  }
}

async function playNote(message, args, dir, map, cmd) {
  const key = String(args || "").trim().toLowerCase().replace(/\s+/g, "");
  const hit = map[key];
  if (!hit) {
    const all = Object.keys(map).join(", ");
    return message.conn.sendMessage(message.from, { text: `❌ Usage: ${prefix()}${cmd} <note>\nNotes: ${all}` }, { quoted: message.gift });
  }
  const file = path.join(BIN, dir, `${hit[1]}.mp3`);
  if (!fs.existsSync(file)) return message.conn.sendMessage(message.from, { text: "❌ Sound file missing: " + file }, { quoted: message.gift });
  await message.conn.sendMessage(message.from, { audio: fs.readFileSync(file), mimetype: "audio/mpeg", ptt: false }, { quoted: message.gift });
}

Module({
  command: "piano",
  package: "music",
  description: "Piano keyboard with playable note buttons",
  usage: ".piano",
})(async (message) => {
  await sendBoard(message, {
    image: "piano.png",
    title: `🎹 *PIANO*\nTap a note button to hear it\n\n👆 Real clickable keys (opens in browser):\n${PIANO_URL}`,
    cmd: "pn",
    cards: [
      ["🎹 *White keys*", Object.fromEntries(Object.entries(WHITE))],
      ["🎹 *Black keys*", Object.fromEntries(Object.entries(BLACK))],
    ],
  });
});

Module({
  command: "pn",
  package: "music",
  description: "Play one piano note, e.g. .pn do  /  .pn fa#",
  usage: ".pn <note>",
})(async (message, args) => {
  await playNote(message, args, "piano", { ...WHITE, ...BLACK }, "pn");
});

Module({
  command: "guitar",
  package: "music",
  description: "Guitar strings with playable buttons",
  usage: ".guitar",
})(async (message) => {
  await sendBoard(message, {
    image: "guitar.png",
    title: "🎸 *GUITAR*\nTap a string to pluck it",
    cmd: "gt",
    cards: [["🎸 *Strings*", STRINGS]],
  });
});

Module({
  command: "gt",
  package: "music",
  description: "Pluck one guitar string, e.g. .gt a5",
  usage: ".gt <string>",
})(async (message, args) => {
  await playNote(message, args, "guitar", STRINGS, "gt");
});
