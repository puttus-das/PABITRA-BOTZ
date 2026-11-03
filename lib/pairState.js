// lib/pairState.js — remembers who asked for a pairing code, so the
// "Bot connected successfully" card can be sent where the request was made.
const TTL_MS = 10 * 60 * 1000;
const pending = new Map(); // digits -> { at, sock, chat }

/** @param {string} digits  number being paired (= session id)
 *  @param {{sock?: any, chat?: string}} from  socket + chat that received the request (optional) */
export function markPairing(digits, { sock = null, chat = null } = {}) {
  pending.set(String(digits), { at: Date.now(), sock, chat });
}

/** returns and clears the pending request (null when none / expired) */
export function takePairing(digits) {
  const key = String(digits);
  const p = pending.get(key);
  pending.delete(key);
  if (!p || Date.now() - p.at > TTL_MS) return null;
  return p;
}
