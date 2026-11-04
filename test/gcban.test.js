import test from "node:test";
import assert from "node:assert/strict";
import { commands } from "../lib/plugins.js";

await import("../plugins/gcban.js");
const gcban = commands.get("gcban")?.exec;
assert.equal(typeof gcban, "function", "gcban command should register");

function makeMessage(overrides = {}) {
  const calls = { added: [], sent: [], reactions: [] };
  const message = {
    from: "120363000000000000@g.us",
    isGroup: true,
    isFromMe: true,
    conn: {
      user: { id: "919000000000@s.whatsapp.net" },
      groupMetadata: async () => ({
        participants: [{ id: "919000000000@s.whatsapp.net", admin: "superadmin" }],
      }),
      groupParticipantsUpdate: async (...args) => calls.added.push(args),
    },
    send: async (text) => calls.sent.push(text),
    react: async (emoji) => calls.reactions.push(emoji),
    ...overrides,
  };
  return { message, calls };
}

test("gcban adds the planned 100 targets and reports progress", async () => {
  const { message, calls } = makeMessage();
  await gcban(message);
  assert.equal(calls.added.length, 100);
  assert.equal(calls.added[0][0], message.from);
  assert.equal(calls.added[0][1].length, 1);
  assert.equal(calls.added[0][2], "add");
  assert.match(calls.sent[0], /GROUP BAN STARTED/);
  assert.deepEqual(calls.reactions, ["😳", "🌝"]);
});

test("gcban rejects a non-group context without attempting updates", async () => {
  const { message, calls } = makeMessage({ from: "919000000000@s.whatsapp.net" });
  await gcban(message);
  assert.equal(calls.added.length, 0);
  assert.match(calls.sent[0], /Provide a group link or run inside a group/i);
});

test("gcban rejects an invalid group link", async () => {
  const { message, calls } = makeMessage();
  await gcban(message, "not-a-group-link");
  assert.equal(calls.added.length, 0);
  assert.match(calls.sent[0], /Invalid group link/i);
});
