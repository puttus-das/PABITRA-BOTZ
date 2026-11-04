import test from "node:test";
import assert from "node:assert/strict";
import { buildMenuButtons, buildMenuText } from "../plugins/menu.js";
import config from "../config.js";
import { commands } from "../lib/plugins.js";

test("menu is text-only and exposes three working icon-text buttons", () => {
  const text = buildMenuText({ pushName: "Tester" }, ".");
  const buttons = buildMenuButtons(".");

  assert.match(text, /\.ptag/);
  assert.match(text, /Hang tag/);
  assert.match(text, /Swing tag/);
  assert.match(text, /Price tag/);
  assert.equal(buttons.length, 3);
  assert.deepEqual(buttons.map((button) => JSON.parse(button.buttonParamsJson).id), [
    ".gmenu",
    ".ping",
    ".owner",
  ]);
  assert.ok(buttons.every((button) => JSON.parse(button.buttonParamsJson).display_text));
  assert.equal(config.brandLine, "*⎯꯭̽ꪹ𝐏𝐚𝐛𝐢𝐭𝐫𝐚 𝐏𝐚𝐮𝐥⎯꯭̽💜*");
});

test("menu command sends a text-only interactive card", async () => {
  const relayed = [];
  const menu = commands.get("menu");
  assert.ok(menu);
  await menu.exec({
    from: "123@g.us",
    pushName: "Tester",
    raw: undefined,
    conn: {
      user: { id: "999@s.whatsapp.net" },
      relayMessage: async (jid, payload) => relayed.push({ jid, payload }),
    },
    send: async () => {},
  });
  const card = relayed[0]?.payload?.viewOnceMessage?.message?.interactiveMessage;
  assert.ok(card);
  assert.equal(card.header.hasMediaAttachment, false);
  assert.equal(card.nativeFlowMessage.buttons.length, 3);
  assert.equal(card.footer.text, config.brandLine);
});
