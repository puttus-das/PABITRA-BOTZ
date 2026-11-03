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
    const imagePath = getRandomPhoto();

    if (!imagePath || !fs.existsSync(imagePath)) {
      throw new Error("Menu image not found: " + imagePath);
    }

    const imageBuffer = fs.readFileSync(imagePath);

    // UPLOAD IMAGE
    const media = await prepareWAMessageMedia(
      {
        image: imageBuffer
      },
      {
        upload: conn.waUploadToServer
      }
    );

    // MENU CAPTION
    const caption = `
╭━━━〔 💜 ${BOT_NAME} 〕━━━╮

✨ 𝐖ᴇʟᴄᴏᴍᴇ 𝐓ᴏ 𝐏ᴀʙɪᴛʀᴀ

👤 𝐔ꜱᴇʀ : ${message.pushName || "User"}
👑 𝐎ᴡɴᴇʀ : ${OWNER}
📞 𝐂ᴏɴᴛᴀᴄᴛ : ${CONTACT}

╰━━━━━━━━━━━━━━━━━━╯

╭━━〔 ✨ 𝐁ᴏᴛ 𝐈ɴғᴏ ✨ 〕━━╮
┃
┃ 🚀 𝐀ᴜᴛᴏᴍᴀᴛᴇ 𝐘ᴏᴜʀ 𝐖ʜᴀᴛꜱᴀᴘᴘ
┃ ⚡ 𝐅ᴀꜱᴛ & 𝐒ᴍᴀʀᴛ 𝐑ᴇꜱᴘᴏɴꜱᴇ
┃ 💎 𝐏ʀᴇᴍɪᴜᴍ 𝐂ᴏᴍᴍᴀɴᴅꜱ
┃
╰━━━━━━━━━━━━━━━━━━╯

❤️ 𝐂ʜᴏᴏꜱᴇ 𝐀 𝐁ᴜᴛᴛᴏɴ 𝐁ᴇʟᴏᴡ

> © 𝐒𝐈𝐋𝐈𝐆𝐔𝐑𝐈-𝐁𝐎𝐘
𝐄𝐃𝐈𝐓𝐙 - 𝐀𝐏𝐔𝐑𝐁𝐎-𝐃𝐀𝐒

© ━( 𝐏ᴀʙɪᴛʀᴀ - 𝐁ᴏᴛ⎯꯭̽💜 )━
`;

    // LEFT + RIGHT BUTTONS
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

    // GENERATE MENU MESSAGE
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

    // PREMIUM PRODUCT CARD
    const businessJid = conn.user.id.replace(
      /:\d+@/,
      "@"
    );

    await conn.sendMessage(jid, {

      product: {
        productImage: imageBuffer,

        productId: "PABITRA-BOT-PREMIUM",

        title: "𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ Premium",

        description:
          "Premium WhatsApp Bot | Smart Commands | PABITRA-BOT",

        currencyCode: "USD",

        priceAmount1000: "999999000",

        retailerId: "PABITRA-BOT",

        productImageCount: 1
      },

      businessOwnerJid: businessJid,

      caption: "💜 Welcome to PABITRA-BOT Premium",

      title: BOT_NAME,

      footer: "© SILIGURI-BOY"

    });

  } catch (error) {

    console.error("[PABITRA MENU ERROR]", error);

    await message.conn.sendMessage(message.from, {
      text: `❌ MENU ERROR\n\n${error.message}`
    });

  }

});
