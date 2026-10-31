// plugins/ptag.js — .ptag <text>  (Personal Tag)
// Tags everyone in the group. The message then EDITS ITSELF live: whoever reads it,
// their name appears in the "Seen by" list — one after another, as people open the chat.
//
// How it works: WhatsApp tells the sender who read a group message (read receipts).
// The bot listens to those receipts and edits the message (WhatsApp allows ~15 min of edits).
// Limits: people with "Read receipts" switched OFF in their privacy settings never show up.
import { Module } from "../lib/plugins.js";
import { fancyText } from "../lib/fancy.js";

const WATCH_MS = 14 * 60 * 1000; // stop before WhatsApp's 15-minute edit window closes
const EDIT_DEBOUNCE_MS = 4000; // gather names that arrive together into one edit
const MIN_EDIT_GAP_MS = 6000; // never edit more often than this
const MAX_NAMES = 40; // names listed inside the message (the counter shows everyone)
const MAX_WATCHERS = 10;
const watchers = new Set();

const userPart = (jid) => String(jid || "").split("@")[0].split(":")[0];
const baseJid = (jid) => {
  const s = String(jid || "");
  const [u, d] = s.split("@");
  return u ? `${u.split(":")[0]}@${d}` : "";
};

Module({
  command: "ptag",
  aliases: ["personaltag", "seentag"],
  package: "group",
  description: "Tag everyone — the message shows live who has seen it",
  usage: ".ptag <text>",
})(async (m, match) => {
  if (!m.isGroup) return m.send("-!!•- Group only •۵♡༏༏ 👥");
  await m.loadGroupInfo();
  if (!m.isFromMe && !m.isAdmin) return m.send("-!!•- Only admins can use .ptag •۵♡༏༏ 🔒");
  if (watchers.size >= MAX_WATCHERS) return m.send("-!!•- Too many live tags running, try again in a few minutes ⏳");

  const conn = m.conn;
  const text = String(match || "").trim() || "👋";

  const md = await conn.groupMetadata(m.from);
  const myUsers = new Set([userPart(conn.user?.id), userPart(conn.user?.lid), userPart(m.sender)].filter(Boolean));

  // every participant id (and its phone / LID twin) → one canonical id
  const canon = new Map();
  const members = [];
  for (const p of md.participants || []) {
    const id = baseJid(p.id);
    if (!id || myUsers.has(userPart(id)) || myUsers.has(userPart(p.phoneNumber)) || myUsers.has(userPart(p.lid))) continue;
    members.push(id);
    for (const a of [p.id, p.phoneNumber, p.lid]) if (a) canon.set(baseJid(a), id);
  }
  if (!members.length) return m.send("-!!•- No members found ❌");

  const total = members.length;
  const seen = new Map(); // canonical id → time

  const render = (closed) => {
    const ids = [...seen.keys()];
    const list = ids.slice(0, MAX_NAMES).map((id, i) => `${i + 1}. @${userPart(id)}`);
    if (ids.length > MAX_NAMES) list.push(`+${ids.length - MAX_NAMES} more`);
    return (
      `-!!•- ${fancyText("Personal Tag")} •۵♡༏༏ 🔔\n\n` +
      `${text}\n\n` +
      `-!!•- ${fancyText("Seen by")} •۵♡༏༏ (${ids.length}/${total}) 👁️\n` +
      `${list.length ? list.join("\n") : "—"}` +
      (closed ? `\n\n-!!•- ${fancyText(ids.length >= total ? "Everyone has seen this" : "Live tracking ended")} ${ids.length >= total ? "🎉" : "⏱️"}` : "") +
      `\n\n-!!•- 𝐏ᴀʙɪᴛʀᴀ-𝐁ᴏᴛ 💜`
    );
  };

  // mentions = everyone → everyone gets the notification
  const sent = await conn.sendMessage(m.from, { text: render(false), mentions: members, noFont: true });
  if (!sent?.key?.id) return m.send("-!!•- Could not send the tag ❌");

  // remove the command message itself (own message → delete for everyone)
  try {
    const key = m.key || m.raw?.key;
    if (m.isFromMe && key) await conn.sendMessage(m.from, { delete: key });
  } catch {}

  let timer = null;
  let lastEdit = 0;
  let finished = false;

  const flush = async (closed = false) => {
    timer = null;
    lastEdit = Date.now();
    try {
      await conn.sendMessage(m.from, { text: render(closed), mentions: members, edit: sent.key, noFont: true });
    } catch (e) {
      console.error("[ptag] edit failed:", e?.message || e);
    }
  };

  const stop = async () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    clearTimeout(killer);
    try {
      (conn.ev.off || conn.ev.removeListener).call(conn.ev, "message-receipt.update", onReceipt);
    } catch {}
    watchers.delete(stop);
    await flush(true);
  };

  const schedule = () => {
    if (timer || finished) return;
    const wait = Math.max(EDIT_DEBOUNCE_MS, MIN_EDIT_GAP_MS - (Date.now() - lastEdit));
    timer = setTimeout(() => flush(false), wait);
  };

  function onReceipt(updates) {
    if (finished) return;
    let changed = false;
    for (const u of updates || []) {
      if (u?.key?.id !== sent.key.id) continue;
      const r = u.receipt || {};
      if (!r.readTimestamp && !r.playedTimestamp) continue; // delivered only, not read yet
      const id = canon.get(baseJid(r.userJid));
      if (id && !seen.has(id)) {
        seen.set(id, Date.now());
        changed = true;
      }
    }
    if (!changed) return;
    if (seen.size >= total) setTimeout(stop, EDIT_DEBOUNCE_MS); // everyone read it
    else schedule();
  }

  conn.ev.on("message-receipt.update", onReceipt);
  const killer = setTimeout(stop, WATCH_MS);
  watchers.add(stop);
});
