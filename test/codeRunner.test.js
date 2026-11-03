import test from "node:test";
import assert from "node:assert/strict";
import { formatRunResult, parseRunInput } from "../plugins/codeRunner.js";
import "../plugins/inspect.js";
import { commands } from "../lib/plugins.js";

test("run parser preserves multiline code and optional stdin", () => {
  const parsed = parseRunInput('python print("hello")\n--stdin--\nworld\n');
  assert.deepEqual(parsed, {
    language: "python",
    code: 'print("hello")',
    stdin: "world\n",
  });
});

test("run parser rejects missing language or source", () => {
  assert.equal(parseRunInput(""), null);
  assert.equal(parseRunInput("python"), null);
});

test("run result includes real stdout and clean no-output state", () => {
  assert.match(formatRunResult({ status: "0", program_output: "2\n" }, "Python"), /Output:\n2/);
  assert.match(formatRunResult({ status: "0", program_output: "" }, "Python"), /finished with no output/);
});

test("run result exposes compiler and runtime errors and caps output", () => {
  const failure = formatRunResult({ status: "1", compiler_error: "Syntax error", program_error: "trace" }, "Python");
  assert.match(failure, /⚠️ Python/);
  assert.match(failure, /Syntax error/);
  assert.match(failure, /trace/);
  const large = formatRunResult({ status: "0", program_output: "x".repeat(5000) });
  assert.ok(large.length < 3300);
  assert.match(large, /output truncated/);
});

test("run command is owner-only and CRM replay command is removed", async () => {
  const run = commands.get("run");
  assert.ok(run);
  assert.equal(commands.has("crm"), false);
  assert.equal(commands.has("inspect"), true);
  const replies = [];
  await run.exec({
    isFromMe: false,
    sender: "000000000000@s.whatsapp.net",
    send: async (text) => replies.push(String(text)),
  }, 'python print("blocked")');
  assert.match(replies[0], /owner-only/i);
});
