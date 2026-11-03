import fs from "fs";

import {
  proto,
  generateWAMessageFromContent,
  prepareWAMessageMedia
} from "baileys";

import { Module } from "../lib/plugins.js";
import config from "../config.js";
import { getRandomPhoto } from "./bin/menu_img.js";

const BOT_NAME = "𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ";
const OWNER = "𝐀𝐏𝐔𝐑𝐁𝐎-𝐃𝐀𝐒";
const CONTACT = "91 96410 92392";

Module({
  command: "menu",
  aliases: ["startmenu"],
  package: "general",
  description: "PABITRA BOT premium image menu"
})(async (message) => {
  try {
    const conn = message.conn;
    const jid = message.from;
    const prefix = config.prefix || ".";

    // RANDOM MENU IMAGE
    let imagePath = getRandomPhoto();

    if (!imagePath || !fs.existsSync(imagePath)) {
      imagePath = new URL(
        "./bin/menu.jpg",
        import.meta.url
      ).pathname;
    }

    if (!fs.existsSync(imagePath)) {
      throw new Error("Menu image not found!");
    }

    const imageBuffer = fs.readFileSync(imagePath);

    // IMAGE UPLOAD
    const media = await prepareWAMessageMedia(
      { image: imageBuffer },
      { upload: conn.waUploadToServer }
    );

    if (!media?.imageMessage) {
      throw new Error("Image upload failed!");
    }

    // MENU CAPTION
    const caption = `
╭━━━〔 💜 ${BOT_NAME} 〕━━━╮

  ✨ 𝐖ᴇʟᴄᴏᴍᴇ 𝐓ᴏ 𝐏ᴀʙɪᴛʀᴀ

  👤 𝐔ꜱᴇʀ : ${message.pushName || "User"}
  👑 𝐎ᴡɴᴇʀ : ${OWNER}
  📞 𝐂ᴏɴᴛᴀᴄᴛ : ${CONTACT}

     ❤️ 𝐂ʜᴏᴏsᴇ 𝐀 𝐁ᴜᴛᴛᴏɴ 𝐁ᴇʟᴏᴡ

> © 𝐒𝐈𝐋𝐈𝐆𝐔𝐑𝐈-𝐁𝐎𝐘
> 𝐄𝐃𝐈𝐓𝐙 - 𝐀𝐏𝐔𝐑𝐁𝐎-𝐃𝐀𝐒

*© ━( 𝐏ᴀʙɪᴛʀᴀ - 𝐁ᴏᴛ⎯꯭̽💜 )━*
`;

    // THREE NATIVE FLOW BUTTONS
    const buttons = [
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "ᴍᴇɴᴜ",
          id: `${prefix}allmenu`
        })
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "ᴘɪɴɢ",
          id: `${prefix}ping`
        })
      },
      {
        name: "quick_reply",
        buttonParamsJson: JSON.stringify({
          display_text: "ᴏᴡɴᴇʀ",
          id: `${prefix}owner`
        })
      }
    ];

    const I = proto.Message.InteractiveMessage;

    const interactiveMessage = I.create({
      body: I.Body.create({
        text: caption
      }),

      footer: I.Footer.create({
        text: BOT_NAME
      }),

      header: I.Header.create({
        title: BOT_NAME,
        hasMediaAttachment: true,
        imageMessage: media.imageMessage
      }),

      nativeFlowMessage: I.NativeFlowMessage.create({
        buttons
      })
    });

    // GENERATE MESSAGE
    const generated = generateWAMessageFromContent(
      jid,
      {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2
            },
            interactiveMessage
          }
        }
      },
      {
        userJid: conn.user?.id
      }
    );

    // SEND MENU
    await conn.relayMessage(
      jid,
      generated.message,
      {
        messageId: generated.key.id
      }
    );

    console.log("[PABITRA MENU] Sent successfully!");

  } catch (error) {
    console.error("[PABITRA MENU ERROR]", error);

    await message.conn.sendMessage(message.from, {
      text: `❌ MENU ERROR\n\n${error.message}`
    });
  }
});
