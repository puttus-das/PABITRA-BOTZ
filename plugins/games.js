import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { proto, generateWAMessageFromContent, prepareWAMessageMedia } from "baileys";
import { Module } from "../lib/plugins.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const menuDir = path.join(__dirname, "bin", "menu");
function randomImage() {
  try {
    const files = fs.readdirSync(menuDir).filter((f) => /\.(jpe?g|png)$/i.test(f));
    return files.length ? path.join(menuDir, files[Math.floor(Math.random() * files.length)]) : null;
  } catch { return null; }
}
const button = (id, label) => ({ name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: label, id: `. ${id}`.replace(". ", ".") }) });

Module({
  command: "game",
  aliases: ["games"],
  package: "games",
  description: "Open the mini-games button menu",
})(async (message) => {
  const imagePath = randomImage();
  try {
    const P = proto.Message.InteractiveMessage;
    const imageMessage = imagePath
      ? (await prepareWAMessageMedia({ image: fs.readFileSync(imagePath) }, { upload: message.conn.waUploadToServer })).imageMessage
      : null;
    const msg = generateWAMessageFromContent(message.from, {
      viewOnceMessage: { message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        interactiveMessage: P.create({
          body: P.Body.create({ text: "🎮 *PABITRA GAME ZONE*\nChoose a game below." }),
          footer: P.Footer.create({ text: "Fast • Fun • Button Games" }),
          header: P.Header.create({ hasMediaAttachment: !!imageMessage, ...(imageMessage ? { imageMessage } : {}) }),
          nativeFlowMessage: P.NativeFlowMessage.create({ buttons: [
            button("dice", "🎲 DICE"),
            button("coin", "🪙 COIN FLIP"),
            button("rps rock", "✊ ROCK"),
            button("rps paper", "✋ PAPER"),
            button("rps scissors", "✌️ SCISSORS"),
          ] }),
        }),
      } },
    }, { quoted: message.gift, userJid: message.conn.user?.id });
    await message.conn.relayMessage(message.from, msg.message, { messageId: msg.key.id });
  } catch {
    await message.send("🎮 .dice | .coin | .rps rock/paper/scissors");
  }
});

Module({ command: "dice", package: "games", description: "Roll a dice" })(async (message) => {
  const roll = Math.floor(Math.random() * 6) + 1;
  await message.reply(`🎲 *Dice Roll*\n\nYou got: *${roll}*`);
});

Module({ command: "coin", aliases: ["flip"], package: "games", description: "Flip a coin" })(async (message) => {
  await message.reply(`🪙 *Coin Flip*\n\nResult: *${Math.random() < 0.5 ? "HEADS" : "TAILS"}*`);
});

Module({ command: "rps", package: "games", description: "Play rock paper scissors" })(async (message, match) => {
  const choices = ["rock", "paper", "scissors"];
  const user = String(match || "").trim().toLowerCase();
  if (!choices.includes(user)) return message.send("_Usage: .rps rock | paper | scissors_");
  const bot = choices[Math.floor(Math.random() * choices.length)];
  const win = (user === "rock" && bot === "scissors") || (user === "paper" && bot === "rock") || (user === "scissors" && bot === "paper");
  const result = user === bot ? "DRAW" : win ? "YOU WIN" : "BOT WINS";
  await message.reply(`🎮 *Rock Paper Scissors*\n\nYou: ${user}\nBot: ${bot}\n\n🏆 *${result}*`);
});
