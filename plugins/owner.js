import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { proto, generateWAMessageFromContent, prepareWAMessageMedia } from "baileys";
import config from "../config.js";
import { Module } from "../lib/plugins.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const menuDir = path.join(__dirname, "bin", "menu");
const fallbackImage = path.join(__dirname, "bin", "menu.jpg");

function getOwnerImage() {
  try {
    const images = fs.readdirSync(menuDir).filter((file) => /\.(jpe?g|png)$/i.test(file));
    if (images.length) return path.join(menuDir, images[Math.floor(Math.random() * images.length)]);
  } catch {}
  return fs.existsSync(fallbackImage) ? fallbackImage : null;
}

Module({
  command: "owner",
  package: "general",
  description: "Show owner contact",
})(async (message) => {
  const number = String(config.owner || "").replace(/\D/g, "");
  if (!number) {
    return message.conn.sendMessage(message.from, { text: "Owner contact is not configured." }, { quoted: message.gift });
  }

  const contactUrl = `https://wa.me/${number}`;
  const imagePath = getOwnerImage();
  const P = proto.Message.InteractiveMessage;
  const buttons = [
    {
      name: "cta_url",
      buttonParamsJson: JSON.stringify({
        display_text: "━[ 𝐂ᴏɴᴛᴀᴄᴛ ]━",
        url: contactUrl,
        merchant_url: contactUrl,
      }),
    },
    {
      name: "cta_copy",
      buttonParamsJson: JSON.stringify({
        display_text: "━[ 𝐂ᴏᴘʏ 𝐍ᴜᴍʙᴇʀ ]━",
        id: "owner_number",
        copy_code: `+${number}`,
      }),
    },
    {
      name: "quick_reply",
      buttonParamsJson: JSON.stringify({
        display_text: "━[ 𝐏ᴀɪʀ 𝐂ᴏᴅᴇ ]━",
        id: `${config.prefix}pair`,
      }),
    },
  ];

  try {
    const imageMessage = imagePath
      ? (await prepareWAMessageMedia({ image: fs.readFileSync(imagePath) }, { upload: message.conn.waUploadToServer })).imageMessage
      : null;
    const msg = generateWAMessageFromContent(message.from, {
      viewOnceMessage: {
        message: {
          messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
          interactiveMessage: P.create({
            body: P.Body.create({ text: `*${config.ownerName}*\n\n📞 +${number}\nTap a button to contact, copy the number, or generate a pairing code.` }),
            footer: P.Footer.create({ text: config.ownerName }),
            header: P.Header.create({
              title: config.ownerName,
              hasMediaAttachment: !!imageMessage,
              ...(imageMessage ? { imageMessage } : {}),
            }),
            nativeFlowMessage: P.NativeFlowMessage.create({ buttons }),
          }),
        },
      },
    }, { quoted: message.gift, userJid: message.conn.user?.id });
    await message.conn.relayMessage(message.from, msg.message, { messageId: msg.key.id });
  } catch (error) {
    console.error("[owner] Interactive card failed:", error?.message || error);
    if (imagePath) {
      await message.conn.sendMessage(message.from, {
        image: fs.readFileSync(imagePath),
        caption: `*${config.ownerName}*\nTap the link to chat with the owner: ${contactUrl}`,
      }, { quoted: message.gift });
    } else {
      await message.conn.sendMessage(message.from, {
        text: `*${config.ownerName}*\nhttps://wa.me/${number}`,
      }, { quoted: message.gift });
    }
  }
});
