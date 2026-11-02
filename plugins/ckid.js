import { Module } from "../lib/plugins.js";
import { sendSingleButtonCards } from "../lib/singleButtonCards.js";

async function sendButtons(message, data) {
  const text = `*${data.title}*\n\n${data.text}\n\n_${data.footer || ""}_`;
  await message.conn.sendMessage(message.from, { text }, { quoted: message.gift });
  await sendSingleButtonCards({
    conn: message.conn,
    jid: message.from,
    buttons: data.buttons,
    body: data.title,
    footer: data.footer || "",
    quoted: message.gift,
  });
}

Module({
  command: "ckid",
  aliases: ["cekid", "getid", "id"],
  description: "Get WhatsApp Group or Channel ID from invite link",
})(async (message, match) => {
  try {
    if (!match) {
      return message.send(
        "❌ Send wp channel/group link 🔗 \n\nExample:\n.checkid https://chat.whatsapp.com/xxxx"
      );
    }

    await message.react("⌛");

    const linkMatch = match.match(
      /https?:\/\/(chat\.whatsapp\.com|whatsapp\.com\/channel)\/[^\s]+/i
    );

    if (!linkMatch) {
      await message.react("❌");
      return message.send("❌ send WhatsApp group / channel link");
    }

    const link = linkMatch[0];
    const url = new URL(link);

    // ================= GROUP =================
    if (url.hostname === "chat.whatsapp.com") {
      const code = url.pathname.replace("/", "");
      const res = await message.client.groupGetInviteInfo(code);
      const id = res.id;

      await message.react("✅");

      return await sendButtons(message, {
        title: "📊 Group Link Analysis",
        text: `🔗 *Link:* ${link}\n🆔 *Group ID:*\n\`${id}\``,
        footer: "*━[ 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ ]━*" ,
        buttons: [
          {
            name: "cta_copy",
            buttonParamsJson: JSON.stringify({
              display_text: "📋 Copy Group ID",
              copy_code: id,
            }),
          },
          {
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "🔗 Open Group Link",
              url: link,
            }),
          },
        ],
      });
    }

    // ================= CHANNEL =================
    if (url.pathname.startsWith("/channel/")) {
      const code = url.pathname.split("/channel/")[1];
      const res = await message.client.newsletterMetadata(
        "invite",
        code,
        "GUEST"
      );
      const id = res.id;

      await message.react("✅");

      return await sendButtons(message, {
        title: "📢 Channel Link Analysis",
        text: `🔗 *Link:* ${link}\n🆔 *Channel ID:*\n\`${id}\``,
        footer: "*━[ 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ ]━*",
        buttons: [
          {
            name: "cta_copy",
            buttonParamsJson: JSON.stringify({
              display_text: "📋 Copy Channel ID",
              copy_code: id,
            }),
          },
          {
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: "🔗 Open Channel Link",
              url: link,
            }),
          },
        ],
      });
    }

    await message.react("❌");
    message.send("❌ Unsupported WhatsApp link");

  } catch (err) {
    console.error("[CHECKID ERROR]", err);
    await message.react("❌");
    message.send("⚠️ Link invalid");
  }
});
