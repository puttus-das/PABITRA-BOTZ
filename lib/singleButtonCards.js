import { proto, generateWAMessageFromContent } from "baileys";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Send one interactive card per action. Keeping exactly one button in each
 * NativeFlowMessage prevents WhatsApp from grouping choices side-by-side.
 */
export async function sendSingleButtonCards({
  conn,
  jid,
  buttons = [],
  body = "Choose an option",
  footer = "",
  quoted,
  userJid,
  delayMs = 120,
}) {
  if (!conn || !jid || !Array.isArray(buttons) || buttons.length === 0) return [];

  const sent = [];
  const P = proto.Message.InteractiveMessage;
  const bizNodes = [
    {
      tag: "biz",
      attrs: {},
      content: [
        {
          tag: "interactive",
          attrs: { type: "native_flow", v: "1" },
          content: [{ tag: "native_flow", attrs: { v: "9", name: "mixed" } }],
        },
      ],
    },
  ];
  if (!String(jid).endsWith("@g.us")) {
    bizNodes.push({ tag: "bot", attrs: { biz_bot: "1" } });
  }

  for (let index = 0; index < buttons.length; index += 1) {
    const button = buttons[index];
    const msg = generateWAMessageFromContent(
      jid,
      {
        viewOnceMessage: {
          message: {
            messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
            interactiveMessage: P.create({
              body: P.Body.create({ text: body }),
              footer: P.Footer.create({ text: footer }),
              header: P.Header.create({ hasMediaAttachment: false }),
              nativeFlowMessage: P.NativeFlowMessage.create({ buttons: [button] }),
            }),
          },
        },
      },
      { ...(quoted ? { quoted } : {}), userJid: userJid || conn.user?.id }
    );
    await conn.relayMessage(jid, msg.message, {
      messageId: msg.key.id,
      additionalNodes: bizNodes,
    });
    sent.push(msg.key.id);
    if (delayMs > 0 && index < buttons.length - 1) await pause(delayMs);
  }
  return sent;
}
