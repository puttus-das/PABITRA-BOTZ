import { Module } from "../lib/plugins.js";
import { proto, generateWAMessageFromContent } from "baileys";

/**
 * Mention every group participant through WhatsApp's album message type.
 * Usage: .album
 */
Module({
  command: "album",
  aliases: ["allmention"],
  package: "group",
  description: "Mention all group members with an album message",
})(async (message) => {
  if (!message.isGroup) {
    return message.send("_This command can only be used in groups._");
  }

  try {
    const metadata = await message.conn.groupMetadata(message.from);
    const mentionedJid = (metadata.participants || [])
      .map((participant) => participant.id || participant.jid)
      .filter(Boolean);

    const msg = generateWAMessageFromContent(
      message.from,
      proto.Message.create({
        albumMessage: {
          contextInfo: { mentionedJid },
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
          },
        },
      }),
      {
        userJid: message.conn.user?.id,
        quoted: message.gift,
      }
    );

    await message.conn.relayMessage(message.from, msg.message, {
      messageId: msg.key.id,
    });
  } catch (error) {
    console.error("[album] Failed to mention group members:", error?.message || error);
    await message.send("_Could not send the group album mention._");
  }
});

