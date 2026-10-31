import axios from "axios";
import { Module } from "../lib/plugins.js";

const BASE = "https://eliteprotech-apis.zone.id";
const TIMEOUT = 35_000;
const clean = (s) => String(s || "").trim();
const short = (v, n = 3500) => {
  if (typeof v === "string") return v.slice(0, n);
  try { return JSON.stringify(v, null, 2).slice(0, n); } catch { return String(v).slice(0, n); }
};
async function getApi(path, params) {
  const { data } = await axios.get(`${BASE}${path}`, { params, timeout: TIMEOUT, headers: { Accept: "application/json", "User-Agent": "PABITRA-BOT-V17" } });
  if (data?.status === false) throw new Error(data?.message || data?.error || "API returned status=false");
  return data?.result ?? data?.results ?? data;
}
async function reply(message, title, work) {
  try {
    await message.react?.("⏳");
    const result = await work();
    const output = short(result);
    await message.conn.sendMessage(message.from, { text: `*${title}*\n\n${output}\n\n> © 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ` }, { quoted: message.gift });
    await message.react?.("✅");
  } catch (e) {
    console.error(`[eliteapi:${title}]`, e?.message || e);
    await message.react?.("❌");
    await message.send(`❌ ${title}: ${e?.response?.data?.message || e?.message || "API request failed"}`);
  }
}
const need = (m, value, usage) => value || m.send(`*Usage:* ${usage}`);

Module({ command: "font", aliases: ["fancyfont"], package: "eliteapi", description: "Convert text into many decorative fonts", usage: ".font hello" })(async (m, q) => {
  const text = clean(q); if (!text) return need(m, false, ".font your text");
  await reply(m, "𝐅ᴏɴᴛ 𝐒ᴛʏʟᴇꜱ", () => getApi("/fun/font", { text }));
});
Module({ command: "fbapi", aliases: ["elitefb"], package: "eliteapi", description: "Fetch Facebook video details/download response", usage: ".fbapi https://facebook.com/..." })(async (m, q) => {
  const url = clean(q); if (!/^https?:\/\//i.test(url)) return need(m, false, ".fbapi Facebook URL");
  await reply(m, "𝐅ᴀᴄᴇʙᴏᴏᴋ 𝐃ᴏᴡɴʟᴏᴀᴅ", () => getApi("/download/facebook", { url, link: url }));
});
Module({ command: "igdl", aliases: ["instagramdl"], package: "eliteapi", description: "Fetch Instagram media details/download response", usage: ".igdl https://instagram.com/..." })(async (m, q) => {
  const url = clean(q); if (!/^https?:\/\//i.test(url)) return need(m, false, ".igdl Instagram URL");
  await reply(m, "𝐈ɴꜱᴛᴀɢʀᴀᴍ 𝐃ᴏᴡɴʟᴏᴀᴅ", () => getApi("/download/instagram", { url, link: url }));
});
Module({ command: "applemusic", aliases: ["amsearch"], package: "eliteapi", description: "Search Apple Music", usage: ".applemusic song name" })(async (m, q) => {
  const query = clean(q); if (!query) return need(m, false, ".applemusic song name");
  await reply(m, "𝐀ᴘᴘʟᴇ 𝐌ᴜsɪᴄ 𝐒ᴇᴀʀᴄʜ", () => getApi("/search/applemusic", { query, q: query, text: query }));
});
Module({ command: "ytsearch", aliases: ["yts"], package: "eliteapi", description: "Search YouTube videos", usage: ".ytsearch query" })(async (m, q) => {
  const query = clean(q); if (!query) return need(m, false, ".ytsearch query");
  await reply(m, "𝐘ᴏᴜTᴜʙᴇ 𝐒ᴇᴀʀᴄʜ", () => getApi("/search/ytsearch", { query, q: query, text: query }));
});
Module({ command: "tiktokstalk", aliases: ["ttstalk"], package: "eliteapi", description: "Look up a public TikTok profile", usage: ".tiktokstalk username" })(async (m, q) => {
  const username = clean(q).replace(/^@/, ""); if (!username) return need(m, false, ".tiktokstalk username");
  await reply(m, "𝐓ɪᴋTᴏᴋ 𝐏ʀᴏғɪʟᴇ", () => getApi("/search/tiktokstalk", { username, user: username, text: username }));
});
Module({ command: "askai", aliases: ["eliteai", "chatgpt"], package: "eliteapi", description: "Ask the EliteProTech ChatGPT endpoint", usage: ".askai your question" })(async (m, q) => {
  const prompt = clean(q); if (!prompt) return need(m, false, ".askai your question");
  await reply(m, "𝐀ɪ 𝐑ᴇsᴘᴏɴsᴇ", async () => {
    const attempts = [
      () => axios.get(`${BASE}/ai/chatgpt`, { params: { text: prompt, prompt, message: prompt, q: prompt }, timeout: TIMEOUT, headers: { Accept: "application/json" } }),
      () => axios.post(`${BASE}/ai/chatgpt`, { text: prompt, prompt, message: prompt }, { timeout: TIMEOUT, headers: { "Content-Type": "application/json", Accept: "application/json" } }),
    ];
    let lastError;
    for (const request of attempts) {
      try {
        const { data } = await request();
        const answer = data?.result?.response ?? data?.result?.answer ?? data?.result?.text ?? data?.response ?? data?.answer ?? data?.text ?? data?.message ?? data?.content ?? data?.choices?.[0]?.message?.content ?? data?.result ?? data;
        if (typeof answer === "string" && answer.trim()) return answer.trim();
        if (answer && typeof answer === "object") return answer;
        throw new Error(data?.error || data?.message || "ChatGPT API returned an empty response");
      } catch (e) { lastError = e; }
    }
    throw new Error(lastError?.response?.data?.message || lastError?.message || "ChatGPT API request failed");
  });
});
Module({ command: "apiexample", package: "eliteapi", description: "Test the EliteProTech example POST endpoint", usage: ".apiexample hello" })(async (m, q) => {
  const messageText = clean(q) || "hello";
  await reply(m, "𝐀ᴘɪ 𝐄xᴀᴍᴘʟᴇ", async () => {
    const { data } = await axios.post(`${BASE}/example`, { name: "PABITRA-BOT", message: messageText }, { timeout: TIMEOUT, headers: { "Content-Type": "application/json" } });
    if (data?.status === false) throw new Error(data?.message || "API returned status=false");
    return data?.result ?? data;
  });
});
