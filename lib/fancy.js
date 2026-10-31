// lib/fancy.js — turns plain English letters into the 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ style font
// Capital letter -> bold (𝐀), small letter -> small-caps (ᴀ). Digits/emoji/other scripts untouched.
const SC = {
  a: "ᴀ", b: "ʙ", c: "ᴄ", d: "ᴅ", e: "ᴇ", f: "ꜰ", g: "ɢ", h: "ʜ", i: "ɪ", j: "ᴊ",
  k: "ᴋ", l: "ʟ", m: "ᴍ", n: "ɴ", o: "ᴏ", p: "ᴘ", q: "ǫ", r: "ʀ", s: "ꜱ", t: "ᴛ",
  u: "ᴜ", v: "ᴠ", w: "ᴡ", x: "x", y: "ʏ", z: "ᴢ",
};
const bold = (ch) => String.fromCodePoint(0x1d400 + (ch.charCodeAt(0) - 65));

// pieces that must stay exactly as they are (copyable / technical)
const PROTECT =
  /```[\s\S]*?```|`[^`\n]*`|https?:\/\/\S+|www\.\S+|\S+@\S+|@\d+|[\w-]+(?:\.[\w-]+)+|(?<![\w])[.!/#$][A-Za-z][\w-]*/g;

const styleLetters = (s) =>
  s.replace(/[A-Za-z]/g, (c) => (c >= "A" && c <= "Z" ? bold(c) : SC[c]));

export function fancyText(text) {
  if (typeof text !== "string" || !text) return text;
  let out = "";
  let last = 0;
  for (const m of text.matchAll(PROTECT)) {
    out += styleLetters(text.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + styleLetters(text.slice(last));
}

export default fancyText;
