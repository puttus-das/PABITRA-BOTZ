// lib/boldify.js — text styles used by the csong plugin
import { fancyText } from "./fancy.js";

// Pabitra-Bot font: Capital → 𝐀 (bold), small → ᴀ (small caps)
export const monoCaps = (text) => fancyText(String(text));

// Bold sans-serif (𝗦𝗼𝗻𝗴). Non-Latin scripts (Hindi, Bengali…) have no bold form and stay untouched.
export function sansBold(text) {
  return [...String(text)]
    .map((ch) => {
      const c = ch.codePointAt(0);
      if (c >= 65 && c <= 90) return String.fromCodePoint(0x1d5d4 + (c - 65));
      if (c >= 97 && c <= 122) return String.fromCodePoint(0x1d5ee + (c - 97));
      if (c >= 48 && c <= 57) return String.fromCodePoint(0x1d7ec + (c - 48));
      return ch;
    })
    .join("");
}
