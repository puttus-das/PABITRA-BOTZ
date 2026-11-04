import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildMenuButtons, buildMenuText, pickMenuImage } from "../plugins/menu.js";
import config from "../config.js";

test("menu uses the attached dynamic layout and requested branding", () => {
  const text = buildMenuText({ pushName: "Tester" }, ".");
  assert.match(text, /𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ/);
  assert.match(text, /ᴍᴏᴅᴇ/);
  assert.match(text, /ᴄᴏᴍᴍᴀɴᴅs/);
  assert.match(text, /𝐏𝐚𝐛𝐢𝐭𝐫𝐚 𝐏𝐚𝐮𝐥/);
  assert.equal(config.brandLine, "*⎯꯭̽ꪹ𝐏𝐚𝐛𝐢𝐭𝐫𝐚 𝐏𝐚𝐮𝐥⎯꯭̽💜*");
});

test("menu chooses an existing local image and exposes five buttons", () => {
  const selected = new Set();
  for (let i = 0; i < 8; i++) selected.add(pickMenuImage());
  assert.ok([...selected].every((file) => fs.existsSync(file)));

  const buttons = buildMenuButtons(".", "919641092392");
  assert.equal(buttons.length, 5);
  const params = buttons.map((button) => JSON.parse(button.buttonParamsJson));
  assert.equal(params[0].id, ".ping");
  assert.equal(params[3].id, ".musicvideo");
  assert.equal(params[4].id, ".audio");
  assert.match(params[0].display_text, /𝐏ɪɴɢ/);
  assert.equal(buttons[1].name, "cta_url");
  assert.equal(buttons[2].name, "cta_url");
});
