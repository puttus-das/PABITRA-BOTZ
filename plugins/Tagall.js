/**
 * plugins/tagall.js
 * PABITRA-BOT — Interactive Image Tagall
 */

import {
  proto,
  generateWAMessageFromContent,
  prepareWAMessageMedia
} from "baileys";

import { Module } from "../lib/plugins.js";

const BOT_NAME = "𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ";

const IMAGE_URL = "https://i.ibb.co/bjDcSnhq/ERFAN-MD.jpg";
const PRICE = "$9999";
const WHATSAPP_URL = "https://wa.me/919641092392";

const P = proto.Message.InteractiveMessage;

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Image upload timeout")),
        ms
      )
    )
  ]);

const normalizeJid = (jid = "") =>
  String(jid).replace(/:\d+@/, "@");

Module({
  command: "tagall",
  aliases: [],
  package: "group",
  description: "Tag all members with image and contact button"
})(async (message, match) => {
  try {
    const conn = message.conn;
    const from = message.from;

    // GROUP CHECK
    if (!from?.endsWith("@g.us")) {
      return message.reply("❌ Group only command!");
    }

    // GROUP METADATA
    const metadata = await conn.groupMetadata(from);
    const participants = metadata.participants || [];

    // Any group member may use .tagall. The bot still needs to be an admin
    // so WhatsApp accepts the group operation reliably.
    const botJid = normalizeJid(conn.user?.id || "");

    const botData = participants.find(
      p => normalizeJid(p.id) === botJid
    );

    if (
      !botData ||
      !["admin", "superadmin"].includes(botData.admin)
    ) {
      return message.reply("❌ Bot must be admin!");
    }

    // GET MEMBERS
    const mentions = participants
      .map(p => p.id)
      .filter(jid => normalizeJid(jid) !== botJid);

    if (!mentions.length) {
      return message.reply("❌ No members found!");
    }

    // CUSTOM MESSAGE
    const customText =
      String(match || "").trim() ||
      "Hello Everyone ❤️";

    // MENTION LIST
    const tagText = mentions
      .map((jid, i) =>
        `${i + 1}. @${jid.split("@")[0]}`
      )
      .join("\n");

    // CAPTION
    const caption = `
╭━━━〔 ${BOT_NAME} 〕━━━╮

${customText}

╭━━〔 PRODUCT DETAILS 〕━━╮
┃
┃ ◈ Name : ${BOT_NAME}
┃ ◈ Price : ${PRICE}
┃ ◈ Items : 100
┃
╰━━━━━━━━━━━━━━━━━━╯

📲 Contact Owner:
919641092392

╭━━━〔 GROUP MEMBERS 〕━━━╮

${tagText}

╰━━━━━━━━━━━━━━━━━━╯

> © 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ
`;

    // DOWNLOAD IMAGE
    const response = await fetch(IMAGE_URL);

    if (!response.ok) {
      throw new Error("Image download failed!");
    }

    const imageBuffer = Buffer.from(
      await response.arrayBuffer()
    );

    // PREPARE IMAGE
    const media = await withTimeout(
      prepareWAMessageMedia(
        { image: imageBuffer },
        { upload: conn.waUploadToServer }
      ),
      60000
    );

    const imageMessage = media.imageMessage;

    // ONLY CONTACT BUTTON
    const buttons = [
      {
        name: "cta_url",
        buttonParamsJson: JSON.stringify({
          display_text: "📲 CONTACT OWNER",
          url: WHATSAPP_URL,
          merchant_url: WHATSAPP_URL
        })
      }
    ];

    // PRODUCT HEADER
    const productHeader = P.Header.create({
      title: BOT_NAME,
      hasMediaAttachment: true,

      productMessage: proto.Message.ProductMessage.create({
        product: proto.Message.ProductMessage.ProductSnapshot.create({
          productImage: imageMessage,
          productId: "9999",
          title: BOT_NAME,
          description: `Group Tagall | ${PRICE}`,
          currencyCode: "USD",
          priceAmount1000: 9999000,
          retailerId: "PABITRA-BOT",
          url: WHATSAPP_URL,
          productImageCount: 1
        }),

        businessOwnerJid:
          conn.user?.id || "0@s.whatsapp.net"
      })
    });

    // INTERACTIVE MESSAGE
    const msg = generateWAMessageFromContent(
      from,
      {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2
            },

            interactiveMessage: P.create({
              body: P.Body.create({
                text: caption
              }),

              footer: P.Footer.create({
                text: BOT_NAME
              }),

              header: productHeader,

              contextInfo: {
                mentionedJid: mentions
              },

              nativeFlowMessage:
                P.NativeFlowMessage.create({
                  buttons
                })
            })
          }
        }
      },
      {
        quoted: message.gift,
        userJid: conn.user?.id
      }
    );

    // BUSINESS NODES
    const bizNodes = [
      {
        tag: "biz",
        attrs: {},
        content: [
          {
            tag: "interactive",
            attrs: {
              type: "native_flow",
              v: "1"
            },
            content: [
              {
                tag: "native_flow",
                attrs: {
                  v: "9",
                  name: "mixed"
                }
              }
            ]
          }
        ]
      }
    ];

    // SEND MESSAGE
    await conn.relayMessage(
      from,
      msg.message,
      {
        messageId: msg.key.id,
        additionalNodes: bizNodes
      }
    );

  } catch (err) {
    console.error("❌ TAGALL ERROR:", err);

    await message.reply(
      `❌ Tagall Error: ${err?.message || err}`
    ).catch(() => {});
  }
});
