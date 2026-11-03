import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";
import {
  DEFAULT_IMAGE_URL_KEY,
  setDefaultButtonImageUrl,
} from "../lib/buttonCards.js";

const isOwner = (message) => !!(message?.isFromMe || message?.isfromMe);

Module({
  command: "setimgurl",
  aliases: ["defaultimage"],
  package: "owner",
  description: "Set or clear the global image shown on command cards",
  usage: ".setimgurl <https image URL> | .setimgurl off",
})(async (message, match) => {
  if (!isOwner(message)) return message.send("_This command is for the owner only_");

  const sid = String(message._sessionId || message.botnum || "").trim();
  if (!sid) return message.send("❌ Could not identify this bot session.");

  const value = String(match || "").trim();
  if (!value) {
    const current = await db.getAsync(sid, DEFAULT_IMAGE_URL_KEY, "").catch(() => "");
    return message.send(
      current
        ? `Current default image URL:\n${current}\n\nUse .setimgurl off to clear it.`
        : "No default image is set.\n\nUse .setimgurl https://example.com/image.jpg"
    );
  }

  if (/^(off|clear|remove|none)$/i.test(value)) {
    await db.del(sid, DEFAULT_IMAGE_URL_KEY);
    setDefaultButtonImageUrl(message.conn, "");
    return message.send("✅ Global command-card image cleared.");
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return message.send("❌ Provide a valid image URL, or use .setimgurl off to clear it.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    value.length > 2048
  ) {
    return message.send("❌ Use a public HTTPS image URL (maximum 2048 characters).");
  }

  await db.set(sid, DEFAULT_IMAGE_URL_KEY, url.toString());
  setDefaultButtonImageUrl(message.conn, url.toString());
  return message.send(
    `✅ Global command-card image URL saved.\nIt will appear on command cards when the link serves a valid image (up to 10 MB).\nUse .setimgurl off to clear it.`
  );
});
