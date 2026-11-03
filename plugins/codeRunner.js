import { Module } from "../lib/plugins.js";

const API_BASE = (process.env.CODE_RUNNER_API_BASE || "https://wandbox.org/api").replace(/\/+$/, "");
const API_TIMEOUT_MS = 25_000;
const MAX_CODE_CHARS = 12_000;
const MAX_OUTPUT_CHARS = 3_200;
const LANGUAGE_ALIASES = new Map([
  ["py", "python"], ["python3", "python"],
  ["js", "javascript"], ["node", "javascript"], ["nodejs", "javascript"],
  ["ts", "typescript"],
  ["cpp", "c++"], ["cxx", "c++"], ["c plus plus", "c++"],
  ["golang", "go"], ["rb", "ruby"], ["sh", "bash"], ["shell", "bash"],
]);

let compilerCache = { expiresAt: 0, compilers: [] };

function normalizeLanguage(value) {
  const raw = String(value || "").trim().toLowerCase();
  return LANGUAGE_ALIASES.get(raw) || raw;
}

export function parseRunInput(input) {
  const match = String(input || "").match(/^([^\s]+)(?:\s+|\r?\n)([\s\S]+)$/);
  if (!match) return null;
  let code = match[2];
  let stdin = "";
  const marker = /\r?\n--stdin--\r?\n/;
  const split = code.match(marker);
  if (split && split.index !== undefined) {
    stdin = code.slice(split.index + split[0].length);
    code = code.slice(0, split.index);
  }
  return { language: match[1], code: code.trimEnd(), stdin };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "User-Agent": "PABITRA-BOTZ-CodeRunner/1.0",
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; }
  catch { throw new Error(`Code service returned invalid data (HTTP ${response.status})`); }
  if (!response.ok) throw new Error(data?.message || data?.error || `Code service HTTP ${response.status}`);
  return data;
}

async function getCompilers() {
  if (compilerCache.expiresAt > Date.now() && compilerCache.compilers.length) return compilerCache.compilers;
  const data = await fetchJson(`${API_BASE}/list.json`);
  if (!Array.isArray(data) || !data.length) throw new Error("Code service returned no available languages");
  compilerCache = { expiresAt: Date.now() + 10 * 60_000, compilers: data };
  return data;
}

function pickCompiler(compilers, language) {
  const query = normalizeLanguage(language);
  const exact = compilers.find((compiler) => String(compiler.name || "").toLowerCase() === query);
  if (exact) return exact;

  const candidates = compilers.filter((compiler) => normalizeLanguage(compiler.language) === query);
  if (!candidates.length) return null;
  return candidates.find((compiler) => compiler.version && !/head|experimental/i.test(`${compiler.name} ${compiler.version}`)) || candidates[0];
}

export function formatRunResult(result, compilerName = "") {
  const compile = String(result?.compiler_error || result?.compiler_output || "").trim();
  const stdout = String(result?.program_output || "").trimEnd();
  const stderr = String(result?.program_error || "").trim();
  const status = String(result?.status ?? "");
  const sections = [];
  if (compile) sections.push(`Compile output:\n${compile}`);
  if (stdout) sections.push(`Output:\n${stdout}`);
  if (stderr) sections.push(`Error output:\n${stderr}`);
  if (!sections.length) sections.push(status === "0" ? "Program finished with no output." : `Program finished with status ${status || "unknown"}.`);
  const exit = result?.signal ? `signal ${result.signal}` : result?.status !== undefined ? `status ${result.status}` : "status unknown";
  const header = `${status === "0" ? "✅" : "⚠️"} ${compilerName || result?.compiler || "Code"} finished (${exit})`;
  let text = `${header}\n\n${sections.join("\n\n")}`;
  if (text.length > MAX_OUTPUT_CHARS) text = `${text.slice(0, MAX_OUTPUT_CHARS)}\n\n…output truncated…`;
  return text;
}

function isOwner(message) {
  if (message?.isFromMe || message?.isfromMe) return true;
  const owner = String(process.env.OWNER_NUMBER || "919641092392").replace(/\D/g, "");
  const sender = String(message?.sender || "").split("@")[0].replace(/\D/g, "");
  return !!owner && sender === owner;
}

Module({
  command: "run",
  aliases: ["code", "coderun", "execute"],
  package: "tools",
  description: "Run code in an isolated sandbox (owner only)",
  usage: ".run <language> <code> | .languages",
})(async (message, match) => {
  if (!isOwner(message)) return message.send("_This code runner is owner-only._");
  const parsed = parseRunInput(match);
  if (!parsed || !parsed.code.trim()) {
    return message.send(`Usage: ${process.env.BOT_PREFIX || "."}run <language> <code>\nExample: .run python print(1 + 1)\nUse .languages to list supported languages.\nFor stdin, add a line containing --stdin-- after your code.`);
  }
  if (parsed.code.length > MAX_CODE_CHARS || parsed.stdin.length > 2_000) {
    return message.send(`Code/input too long. Limits: ${MAX_CODE_CHARS} code characters and 2000 stdin characters.`);
  }

  try {
    const compilers = await getCompilers();
    const compiler = pickCompiler(compilers, parsed.language);
    if (!compiler) return message.send(`Unsupported language: ${parsed.language}\nUse .languages to see available languages.`);
    const result = await fetchJson(`${API_BASE}/compile.json`, {
      method: "POST",
      body: JSON.stringify({
        compiler: compiler.name,
        code: parsed.code,
        stdin: parsed.stdin,
        options: "",
        "compiler-option-raw": "",
        "runtime-option-raw": "",
      }),
    });
    await message.send(formatRunResult(result, `${compiler.language || parsed.language} (${compiler.name})`));
  } catch (error) {
    console.error("[CODE-RUNNER]", error?.message || error);
    await message.send(`Code run failed: ${error?.message || "the sandbox service is unavailable"}`);
  }
});

Module({
  command: "languages",
  aliases: ["langs"],
  package: "tools",
  description: "List languages available in the code sandbox (owner only)",
})(async (message, match) => {
  if (!isOwner(message)) return message.send("_This command is owner-only._");
  try {
    const compilers = await getCompilers();
    const seen = new Set();
    const entries = [];
    for (const compiler of compilers) {
      const language = String(compiler.language || compiler.name || "").trim();
      const key = normalizeLanguage(language);
      if (!key || seen.has(key)) continue;
      const preferred = pickCompiler(compilers, key) || compiler;
      seen.add(key);
      entries.push(`• ${language}: ${preferred.name}`);
    }
    const text = `Sandbox languages (${entries.length}):\n${entries.join("\n")}\n\nExample: .run python print("Hello")`;
    const chunks = [];
    let chunk = "";
    for (const line of text.split("\n")) {
      if ((chunk + "\n" + line).length > 3_200) {
        chunks.push(chunk);
        chunk = line;
      } else chunk += `${chunk ? "\n" : ""}${line}`;
    }
    if (chunk) chunks.push(chunk);
    for (const part of chunks) await message.send(part);
  } catch (error) {
    console.error("[CODE-RUNNER:LANGUAGES]", error?.message || error);
    await message.send(`Could not load languages: ${error?.message || "the sandbox service is unavailable"}`);
  }
});
