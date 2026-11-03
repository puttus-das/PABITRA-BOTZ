// plugins/codeRunner.js
// PABITRA-BOT — Code Runner + WhatsApp file runner + CRM replay
// Code files run on Wandbox sandbox, NOT inside the bot process.

import { Module } from "../lib/plugins.js";

const API_BASE = "https://wandbox.org/api";
const API_TIMEOUT_MS = 25000;
const MAX_CODE_CHARS = 12000;
const MAX_FILE_BYTES = 64000;
const MAX_OUTPUT_CHARS = 3200;
const OWNER_NUMBER = process.env.OWNER_NUMBER || "919641092392";

const LANGUAGES = {
  python: {
    name: "Python",
    extensions: [".py"],
    aliases: ["py"],
  },
  javascript: {
    name: "JavaScript",
    extensions: [".js", ".mjs", ".cjs"],
    aliases: ["js", "node"],
  },
  cpp: {
    name: "C++",
    extensions: [".cpp", ".cc", ".cxx"],
    aliases: ["c++", "cxx"],
  },
  c: {
    name: "C",
    extensions: [".c"],
    aliases: [],
  },
  go: {
    name: "Go",
    extensions: [".go"],
    aliases: ["golang"],
  },
  ruby: {
    name: "Ruby",
    extensions: [".rb"],
    aliases: ["rb"],
  },
};

const cleanNumber = (value) =>
  String(value || "").replace(/\D/g, "");

function isOwner(message) {
  if (message?.isFromMe || message?.isfromMe) return true;

  const sender = cleanNumber(message?.sender);
  const owner = cleanNumber(OWNER_NUMBER);

  return Boolean(sender && owner && sender === owner);
}

function getLanguage(input) {
  const value = String(input || "").toLowerCase().trim();

  for (const [key, config] of Object.entries(LANGUAGES)) {
    if (key === value || config.aliases.includes(value)) {
      return key;
    }
  }

  return null;
}

export function parseRunInput(input) {
  const raw = String(input || "").trim();
  const firstSpace = raw.search(/\s/);

  if (!raw || firstSpace === -1) return null;

  const languageText = raw.slice(0, firstSpace).toLowerCase();
  const code = raw.slice(firstSpace + 1).trim();

  const language = getLanguage(languageText);

  if (!language || !code) return null;
  if (code.length > MAX_CODE_CHARS) return null;

  const marker = "\n--stdin--\n";
  const markerIndex = code.indexOf(marker);

  if (markerIndex === -1) {
    return { language, code, stdin: "" };
  }

  return {
    language,
    code: code.slice(0, markerIndex).trim(),
    stdin: code.slice(markerIndex + marker.length),
  };
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`API error: HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

let compilerCache = null;
let compilerCacheTime = 0;

async function getCompilers() {
  if (compilerCache && Date.now() - compilerCacheTime < 10 * 60 * 1000) {
    return compilerCache;
  }

  const data = await fetchJson(`${API_BASE}/list.json`);

  if (!Array.isArray(data)) {
    throw new Error("Compiler list পাওয়া যায়নি।");
  }

  compilerCache = data;
  compilerCacheTime = Date.now();

  return data;
}

function pickCompiler(compilers, language) {
  const wanted = LANGUAGES[language]?.name?.toLowerCase();

  const matches = compilers.filter((compiler) => {
    return String(compiler.language || "").toLowerCase() === wanted;
  });

  if (!matches.length) {
    throw new Error(`${LANGUAGES[language]?.name || language} compiler পাওয়া যায়নি।`);
  }

  return matches[0];
}

function trimOutput(value) {
  const text = String(value || "").trim();

  if (!text) return "(কোনো output নেই)";
  if (text.length <= MAX_OUTPUT_CHARS) return text;

  return text.slice(0, MAX_OUTPUT_CHARS) + "\n... output কেটে দেওয়া হয়েছে।";
}

async function executeCode({ language, code, stdin = "" }) {
  if (!LANGUAGES[language]) {
    throw new Error("এই language support করে না।");
  }

  if (!code || code.length > MAX_CODE_CHARS) {
    throw new Error("Code খালি অথবা limit-এর বেশি।");
  }

  const compilers = await getCompilers();
  const compiler = pickCompiler(compilers, language);

  const result = await fetchJson(`${API_BASE}/compile.json`, {
    method: "POST",
    body: JSON.stringify({
      compiler: compiler.name,
      code,
      stdin,
      options: "",
      "compiler-option-raw": "",
      "runtime-option-raw": "",
    }),
  });

  const output = [
    result.program_output,
    result.program_error,
    result.compiler_output,
    result.compiler_message,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    compiler: compiler.name,
    status: result.status || "",
    output: trimOutput(output),
    signal: result.signal || "",
  };
}

function getExtension(fileName) {
  const name = String(fileName || "").toLowerCase();
  const index = name.lastIndexOf(".");

  return index >= 0 ? name.slice(index) : "";
}

function languageFromFile(fileName) {
  const extension = getExtension(fileName);

  for (const [language, config] of Object.entries(LANGUAGES)) {
    if (config.extensions.includes(extension)) return language;
  }

  return null;
}

async function downloadQuotedFile(message) {
  const quoted = message?.quoted;

  if (!quoted || typeof quoted.download !== "function") {
    throw new Error("কোনো document file-এর reply দাও।");
  }

  const buffer = await quoted.download();

  if (!buffer) {
    throw new Error("ফাইল download করা যায়নি।");
  }

  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  if (!data.length || data.length > MAX_FILE_BYTES) {
    throw new Error("ফাইল খালি অথবা 64 KB-এর বেশি।");
  }

  return data;
}

// Only accepts the JSON format created by the PABITRA .crm plugin.
export function parseCrmReplayBuffer(buffer, currentChat) {
  if (!Buffer.isBuffer(buffer) || buffer.length > MAX_FILE_BYTES) {
    throw new Error("CRM file invalid অথবা খুব বড়।");
  }

  let data;

  try {
    data = JSON.parse(buffer.toString("utf8"));
  } catch {
    throw new Error("CRM JSON file পড়া যায়নি।");
  }

  if (
    data?.format !== "PABITRA_CRM_REPLAY" ||
    data?.version !== 1
  ) {
    throw new Error("এটি PABITRA CRM replay file নয়।");
  }

  if (data?.source?.chat !== currentChat) {
    throw new Error("এই CRM file অন্য chat-এর।");
  }

  if (
    data?.message?.type !== "text" ||
    typeof data?.message?.text !== "string"
  ) {
    throw new Error("এই CRM file-এ supported text message নেই।");
  }

  const text = data.message.text.trim();

  if (!text || text.length > 4000) {
    throw new Error("CRM message খালি অথবা খুব বড়।");
  }

  return { text };
}

async function tryCrmReplay(message) {
  const quoted = message?.quoted;

  if (quoted?.type !== "documentMessage") return false;

  const fileName = quoted?.msg?.fileName || "";

  if (fileName !== "PABITRA-CRM-REPLAY.json") return false;

  const buffer = await downloadQuotedFile(message);
  const replay = parseCrmReplayBuffer(buffer, message.from);

  await message.conn.sendMessage(message.from, {
    text: replay.text,
  });

  await message.send("✅ CRM text replay করা হয়েছে।");
  return true;
}

async function tryRunCodeFile(message) {
  const quoted = message?.quoted;

  if (quoted?.type !== "documentMessage") return false;

  const fileName = quoted?.msg?.fileName || "";
  const language = languageFromFile(fileName);

  if (!language) return false;

  const buffer = await downloadQuotedFile(message);
  const code = buffer.toString("utf8");

  if (!code.trim()) {
    throw new Error("Code file খালি।");
  }

  if (code.length > MAX_CODE_CHARS) {
    throw new Error("Code file 12,000 characters-এর বেশি।");
  }

  await message.send(`⏳ *${fileName}* রান হচ্ছে...`);

  const result = await executeCode({
    language,
    code,
  });

  await message.send(
    `╭─「 *PABITRA RUNNER* 」\n` +
    `│ File: ${fileName}\n` +
    `│ Language: ${LANGUAGES[language].name}\n` +
    `│ Compiler: ${result.compiler}\n` +
    `╰──────────────\n\n` +
    `*OUTPUT:*\n\`\`\`\n${result.output}\n\`\`\``
  );

  return true;
}

Module({
  command: "run",
  aliases: ["code", "coderun", "execute"],
  package: "tools",
  description: "Run code or supported WhatsApp code files (owner only)",
  usage: ".run python print('Hello') | Reply to a code file with .run",
})(async (message, match) => {
  try {
    if (!isOwner(message)) {
      return message.send("⛔ এই command শুধু owner ব্যবহার করতে পারবে।");
    }

    // 1. CRM replay file
    if (message?.quoted?.type === "documentMessage") {
      const fileName = message.quoted?.msg?.fileName || "";

      if (fileName === "PABITRA-CRM-REPLAY.json") {
        await tryCrmReplay(message);
        return;
      }

      // 2. Supported code file
      if (languageFromFile(fileName)) {
        await tryRunCodeFile(message);
        return;
      }
    }

    // 3. Normal inline code
    const parsed = parseRunInput(match);

    if (!parsed) {
      return message.send(
        `*PABITRA RUNNER*\n\n` +
        `*Text code:*\n` +
        `.run python print("Hello")\n\n` +
        `*File run:*\n` +
        `WhatsApp-এ .py / .js / .cpp / .c / .go / .rb file-এ reply দিয়ে .run লেখো।\n\n` +
        `*CRM replay:*\n` +
        `PABITRA-CRM-REPLAY.json file-এ reply দিয়ে .run লেখো।\n\n` +
        `*Languages:*\n` +
        `.languages`
      );
    }

    await message.send("⏳ Code রান হচ্ছে...");

    const result = await executeCode(parsed);

    return message.send(
      `╭─「 *PABITRA RUNNER* 」\n` +
      `│ Language: ${LANGUAGES[parsed.language].name}\n` +
      `│ Compiler: ${result.compiler}\n` +
      `╰──────────────\n\n` +
      `*OUTPUT:*\n\`\`\`\n${result.output}\n\`\`\``
    );
  } catch (error) {
    console.error("[PABITRA RUNNER]", error);

    return message.send(
      `❌ *Run failed:*\n${String(error?.message || error).slice(0, 700)}`
    );
  }
});

Module({
  command: "languages",
  aliases: ["langs"],
  package: "tools",
  description: "Show supported code runner languages",
})(async (message) => {
  if (!isOwner(message)) {
    return message.send("⛔ এই command শুধু owner ব্যবহার করতে পারবে।");
  }

  return message.send(
    `*PABITRA RUNNER LANGUAGES*\n\n` +
    `• Python (.py)\n` +
    `• JavaScript (.js, .mjs, .cjs)\n` +
    `• C++ (.cpp, .cc, .cxx)\n` +
    `• C (.c)\n` +
    `• Go (.go)\n` +
    `• Ruby (.rb)\n\n` +
    `Code file-এ reply দিয়ে .run লেখো।`
  );
});
