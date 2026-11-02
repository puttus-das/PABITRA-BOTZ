import { Module } from "../lib/plugins.js";
import { sendSingleButtonCards } from "../lib/singleButtonCards.js";

Module({
  command: "btpn",
  package: "mics",
  description: "Replies with the bot latency",
})(async (message) => {
  const start = Date.now();

  const emojis = [
    "⛅","👻","⛄","👀","🪁","🪃","🎳","🎀","🌸","🍥","🍓","🍡","💗","🦋","💫",
    "💀","☁️","🌨️","🌧️","🌦️","🌥️","⚡","🌟","🎐","🏖️","🌊","🐚","🍒","🍇",
    "🍉","🌻","🎢","🚀","🍫","💎","🌋","🏔️","🌙","🪐","🌲","🍃","🍂","🍁",
    "🍄","🌿","🐞","🐍","🕊️","🎃","🎡","🥂","🗿","⛩️"
  ];

  const emoji = emojis[Math.floor(Math.random() * emojis.length)];
  await message.react(emoji);

  const latency = Date.now() - start;

  await message.conn.sendMessage(
    message.from,
    { text: `*${emoji} } Ꭾ❤️‍🩹ŇᎶ: ${latency} ๓Ş*`, contextInfo: { mentionedJid: [message.sender] } },
    { quoted: message.gift }
  );
  await sendSingleButtonCards({
    conn: message.conn,
    jid: message.from,
    buttons: [
      { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "✅ Alive", id: ".alive" }) },
      { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "👑 Owner", id: ".owner" }) },
    ],
    body: "Ping actions",
    footer: "*━[ 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ ]━*",
    quoted: message.gift,
  });
});
