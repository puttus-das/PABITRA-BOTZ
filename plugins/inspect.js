import { Module } from "../lib/plugins.js";
import { getContentType } from "baileys";

const isOwner = (message) => !!(message.isfromMe || message.isFromMe);

Module({
  command: "inspect",
  aliases: ["msginfo"],
  package: "tools",
  description: "Show message information — owner only, optionally reply to a message",
})(async (message) => {
  if (!isOwner(message)) return message.send("_This command is for the owner only_");
  const quoted = message.quoted;
  const info = {
    type: quoted ? quoted.type : getContentType(message.raw?.message) || "unknown",
    chat: message.from,
    group: !!message.isGroup,
    id: (quoted ? quoted.id : message.id) || null,
    sender: (quoted ? quoted.participant : message.sender) || null,
    fromMe: quoted ? !!quoted.fromMe : true,
    text: ((quoted ? quoted.body : message.body) || "").slice(0, 200),
  };
  await message.send(
    `*📋 Message Info*${quoted ? " _(replied message)_" : ""}\n\n` +
      `• Type   : ${info.type}\n` +
      `• Chat   : ${info.chat}\n` +
      `• Group  : ${info.group ? "yes" : "no"}\n` +
      `• ID     : ${info.id || "n/a"}\n` +
      `• Sender : ${info.sender || "n/a"}\n` +
      `• FromMe : ${info.fromMe ? "yes" : "no"}\n` +
      `• Text   : ${info.text || "(none)"}`
  );
});
