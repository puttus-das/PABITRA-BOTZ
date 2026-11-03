/**
 * plugins/alive.js
 * PABITRA-BOT — Interactive Alive Card
 */

import os from "os";

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

const runtime = (seconds) => {
  const pad = (n) => String(n).padStart(2, "0");

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
};

Module({
  command: "alive",
  aliases: ["online", "status"],
  package: "general",
  description: "Show bot alive interactive card"
})(async (message) => {
  try {
    const conn = message.conn;
    const from = message.from;

    // SYSTEM INFORMATION
    const hostname = os.hostname();

    const totalRAM = os.totalmem();
    const freeRAM = os.freemem();
    const usedRAM = totalRAM - freeRAM;

    const ramUsed = (usedRAM / 1073741824).toFixed(2);
    const ramTotal = (totalRAM / 1073741824).toFixed(2);

    const uptime = runtime(process.uptime());

    const cpu = os.cpus()?.[0]?.model || "Unknown";

    const time = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });

    // CAPTION
    const caption = `
╭━━━〔 ${BOT_NAME} 〕━━━╮

🟢 Status : ONLINE

╭━━〔 BOT INFORMATION 〕━━╮
┃
┃ ◈ Bot : ${BOT_NAME}
┃ ◈ Status : Active
┃ ◈ Time : ${time}
┃ ◈ Uptime : ${uptime}
┃
╰━━━━━━━━━━━━━━━━━━╯

╭━━〔 SYSTEM INFORMATION 〕━━╮
┃
┃ ◈ Host : ${hostname}
┃ ◈ RAM : ${ramUsed} / ${ramTotal} GB
┃ ◈ CPU : ${cpu}
┃ ◈ Platform : ${os.platform()}
┃
╰━━━━━━━━━━━━━━━━━━╯

╭━━〔 PRODUCT DETAILS 〕━━╮
┃
┃ ◈ Name : ${BOT_NAME}
┃ ◈ Price : ${PRICE}
┃ ◈ Items : 100
┃
╰━━━━━━━━━━━━━━━━━━╯

📲 Contact Owner:
919641092392

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

    // CONTACT BUTTON ONLY
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
    const header = P.Header.create({
      title: BOT_NAME,
      hasMediaAttachment: true,

      productMessage: proto.Message.ProductMessage.create({
        product: proto.Message.ProductMessage.ProductSnapshot.create({
          productImage: imageMessage,
          productId: "9999",
          title: BOT_NAME,
          description: `Alive Status | ${PRICE}`,
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

              header,

              contextInfo: {},

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

    // SEND
    await conn.relayMessage(
      from,
      msg.message,
      {
        messageId: msg.key.id,
        additionalNodes: bizNodes
      }
    );

  } catch (err) {
    console.error("❌ ALIVE ERROR:", err);

    await message.reply(
      `❌ Alive Error: ${err?.message || err}`
    ).catch(() => {});
  }
});
