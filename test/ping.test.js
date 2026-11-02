import test from "node:test";
import assert from "node:assert/strict";
import { sendPing } from "../lib/pingCore.js";

test("ping sends one card with one audio button and no separate text message", async () => {
  const relayed = [];
  const message = {
    from: "120363000000000000@g.us",
    gift: undefined,
    react: async () => {},
    conn: {
      user: { id: "919641092392@s.whatsapp.net" },
      relayMessage: async (jid, payload) => relayed.push({ jid, payload }),
    },
  };

  await sendPing(message);

  assert.equal(relayed.length, 1);
  const card = relayed[0].payload.viewOnceMessage.message.interactiveMessage;
  assert.match(card.body.text, /ms/);
  assert.equal(card.nativeFlowMessage.buttons.length, 1);
  assert.equal(JSON.parse(card.nativeFlowMessage.buttons[0].buttonParamsJson).display_text, "🎧 Audio");
});
