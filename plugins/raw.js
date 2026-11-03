import { proto, generateWAMessageFromContent, jidNormalizedUser } from "baileys";
import { Module } from "../lib/plugins.js";

const MAX_TEXT = 18_000;
const isOwner = (message) => !!(message?.isfromMe || message?.isFromMe);

function getQuoted(message) {
  const quoted = message?.quoted;
  if (!quoted?.type || quoted.msg == null) return null;
  return quoted;
}

function toRawObject(quoted) {
  const content = proto.Message.create({ [quoted.type]: quoted.msg });
  return proto.Message.toObject(content, {
    bytes: String,
    longs: String,
    enums: String,
    defaults: false,
  });
}

function rawJson(quoted) {
  const object = toRawObject(quoted);
  return JSON.stringify(object, null, 2);
}

function trimOutput(text) {
  if (text.length <= MAX_TEXT) return text;
  return `${text.slice(0, MAX_TEXT)}\n\n… (truncated; use .raw with a JID to relay the full quoted message)`;
}

function resolveTarget(value) {
  const input = String(value || "").trim();
  if (/^\d{5,20}$/.test(input)) return `${input}@s.whatsapp.net`;
  if (/^\d{5,20}@s\.whatsapp\.net$/i.test(input) || /^[\d-]{5,40}@g\.us$/i.test(input)) {
    return jidNormalizedUser(input);
  }
  throw new Error("Give a phone number or a WhatsApp JID ending in @s.whatsapp.net or @g.us.");
}

async function relayQuoted(message, target, quoted) {
  const msg = proto.Message.create({ [quoted.type]: quoted.msg });
  const outgoing = generateWAMessageFromContent(target, msg, {
    userJid: message.conn?.user?.id,
  });
  await message.conn.relayMessage(target, outgoing.message, {
    messageId: outgoing.key.id,
  });
}

Module({
  command: "raw",
  package: "tools",
  description: "Inspect or relay a replied-to message's raw content",
  usage: ".raw | .raw -snipp | .raw <jid>",
})(async (message, match) => {
  const quoted = getQuoted(message);
  if (!quoted) {
    return message.send(
      "Reply to a message first!\n\n" +
      `Reply to a message → type ${".raw"}\n` +
      `Reply to a message → type ${".raw <jid>"} (owner only; send to another chat)\n` +
      `Reply to a message → type ${".rawjson"} (view raw JSON)\n` +
      `Reply to a message → type ${".raw -snipp"} (rich code card)\n\n` +
      "Supports buttons, media, stickers, text, and other message types."
    );
  }

  const arg = String(match || "").trim();
  if (arg && !/^-snipp$/i.test(arg)) {
    if (!isOwner(message)) return message.send("Only the bot owner can relay a quoted message to another chat.");
    try {
      const target = resolveTarget(arg);
      await relayQuoted(message, target, quoted);
      return message.send(`Raw message sent to ${target}.`);
    } catch (error) {
      console.error("[raw:relay]", error?.message || error);
      return message.send(`Could not relay the message: ${error?.message || "unknown error"}`);
    }
  }

  try {
    const json = trimOutput(rawJson(quoted));
    if (/^-snipp$/i.test(arg)) {
      const code = `\u0060\u0060\u0060json\n${json}\n\u0060\u0060\u0060`;
      return message.send({ text: `*Raw message snippet*\n\n${code}`, noFont: true });
    }
    return message.send({ text: json, noFont: true });
  } catch (error) {
    console.error("[raw]", error?.message || error);
    return message.send(`Could not read the quoted message: ${error?.message || "unknown error"}`);
  }
});

Module({
  command: "rawjson",
  package: "tools",
  description: "View JSON for a replied-to message",
  usage: ".rawjson",
})(async (message) => {
  const quoted = getQuoted(message);
  if (!quoted) return message.send("Reply to a message first, then type .rawjson");
  try {
    return message.send({ text: trimOutput(rawJson(quoted)), noFont: true });
  } catch (error) {
    console.error("[rawjson]", error?.message || error);
    return message.send(`Could not read the quoted message: ${error?.message || "unknown error"}`);
  }
});
