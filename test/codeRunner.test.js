import test from "node:test";
import assert from "node:assert/strict";
import { parseCrmReplayBuffer, parseRunInput } from "../plugins/codeRunner.js";
import "../plugins/inspect.js";
import { commands } from "../lib/plugins.js";

test("run parser normalizes supported languages and optional stdin", () => {
  const parsed = parseRunInput('python print("hello")\n--stdin--\nworld\n');
  assert.deepEqual(parsed, {
    language: "python",
    code: 'print("hello")',
    stdin: "world",
  });
});

test("run parser rejects missing, unsupported, or empty source", () => {
  assert.equal(parseRunInput(""), null);
  assert.equal(parseRunInput("python"), null);
  assert.equal(parseRunInput("php echo 1"), null);
});

test("CRM replay parser accepts only same-chat text replay JSON", () => {
  const payload = Buffer.from(JSON.stringify({
    format: "PABITRA_CRM_REPLAY",
    version: 1,
    source: { chat: "123@g.us" },
    message: { type: "text", text: "hello" },
  }));
  assert.deepEqual(parseCrmReplayBuffer(payload, "123@g.us"), { text: "hello" });
  assert.throws(() => parseCrmReplayBuffer(payload, "other@g.us"), /অন্য chat/);
});

test("run command is owner-only and CRM replay command is registered", async () => {
  const run = commands.get("run");
  assert.ok(run);
  assert.equal(commands.has("crm"), true);
  assert.equal(commands.has("inspect"), true);
  const replies = [];
  await run.exec({
    isFromMe: false,
    sender: "000000000000@s.whatsapp.net",
    send: async (text) => replies.push(String(text)),
  }, 'python print("blocked")');
  assert.match(replies[0], /owner|শুধু owner/i);
});
