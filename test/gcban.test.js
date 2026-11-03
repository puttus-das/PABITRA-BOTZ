import test from "node:test";
import assert from "node:assert/strict";
import { commands } from "../lib/plugins.js";

await import("../plugins/gcban.js");
const gcban = commands.get("gcban")?.exec;
assert.equal(typeof gcban, "function", "gcban command should register");

function makeMessage(overrides = {}) {
  const calls = { removed: [], sent: [], replies: [] };
  const target = "919999999999@s.whatsapp.net";
  const message = {
    isGroup: true,
    isAdmin: true,
    isFromMe: false,
    isBotAdmin: true,
    mentions: [target],
    quoted: null,
    groupOwner: "919111111111@s.whatsapp.net",
    groupAdmins: [],
    groupMetadata: {
      participants: [{ id: target, admin: null }],
    },
    conn: {
      user: { id: "919000000000@s.whatsapp.net" },
      groupParticipantsUpdate: async (...args) => calls.removed.push(args),
    },
    loadGroupInfo: async () => {},
    send: async (text) => calls.sent.push(text),
    reply: async (text, options) => calls.replies.push({ text, options }),
    react: async () => {},
    ...overrides,
  };
  return { message, calls, target };
}

test("gcban removes exactly one mentioned non-admin from the current group", async () => {
  const { message, calls, target } = makeMessage();
  await gcban(message);
  assert.deepEqual(calls.removed, [[message.from, [target], "remove"]]);
  assert.equal(calls.replies.length, 1);
  assert.deepEqual(calls.replies[0].options.mentions, [target]);
});

test("gcban rejects a non-group context", async () => {
  const { message, calls } = makeMessage({ isGroup: false });
  await gcban(message);
  assert.equal(calls.removed.length, 0);
  assert.match(calls.sent[0], /only works in a group/i);
});

test("gcban rejects multiple targets", async () => {
  const { message, calls } = makeMessage({
    mentions: ["919999999999@s.whatsapp.net", "919888888888@s.whatsapp.net"],
    groupMetadata: {
      participants: [
        { id: "919999999999@s.whatsapp.net" },
        { id: "919888888888@s.whatsapp.net" },
      ],
    },
  });
  await gcban(message);
  assert.equal(calls.removed.length, 0);
  assert.match(calls.sent[0], /Usage:/);
});

test("gcban never removes an admin", async () => {
  const { message, calls } = makeMessage({
    groupMetadata: {
      participants: [{ id: "919999999999@s.whatsapp.net", admin: "admin" }],
    },
  });
  await gcban(message);
  assert.equal(calls.removed.length, 0);
  assert.match(calls.sent[0], /Admins cannot be removed/i);
});
