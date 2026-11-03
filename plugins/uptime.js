
// Alive command with Audio Button
Module({
  command: "alive",
  package: "general",
  description: "Check if bot is alive"
})(async (message) => {
  try {
    const hostname = os.hostname();
    const time = new Date().toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
    });

    const ramUsedMB = (
      process.memoryUsage().heapUsed / 1024 / 1024
    ).toFixed(2);

    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    const ctx = `
*${name}* is online 🟢

*Time:* ${time}
*Host:* ${hostname}
*RAM Usage:* ${ramUsedMB} MB
*Uptime:* ${days}d ${hours}h ${minutes}m ${seconds}s

> © 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ
`;

    const img = fs.readFileSync(pickMenuImg());

    const media = await prepareWAMessageMedia(
      { image: img },
      { upload: message.conn.waUploadToServer }
    );

    const P = proto.Message.InteractiveMessage;

    const msg = generateWAMessageFromContent(
      message.from,
      {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2,
            },
            interactiveMessage: P.create({
              body: P.Body.create({ text: ctx }),
              footer: P.Footer.create({ text: name }),
              header: P.Header.create({
                hasMediaAttachment: true,
                imageMessage: media.imageMessage,
              }),
              nativeFlowMessage: P.NativeFlowMessage.create({
                buttons: [
                  {
                    name: "quick_reply",
                    buttonParamsJson: JSON.stringify({
                      display_text: "━[ 🎧 𝐀ᴜᴅɪᴏ ]━",
                      id: `${config.prefix}audio`,
                    }),
                  },
                ],
              }),
            }),
          },
        },
      },
      {
        quoted: message.gift,
        userJid: message.conn.user?.id,
      }
    );

    await message.conn.relayMessage(
      message.from,
      msg.message,
      { messageId: msg.key.id }
    );

  } catch (err) {
    console.error("❌ Alive command error:", err);

    await message.conn.sendMessage(message.from, {
      text: `❌ Error: ${err?.message || err}`,
    });
  }
});
