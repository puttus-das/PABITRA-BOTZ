import { Module } from "../lib/plugins.js";

const sameJid = (message, a, b) => {
  if (!a || !b) return false;
  if (typeof message.areJidsSame === "function") {
    try {
      return message.areJidsSame(a, b);
    } catch {}
  }
  return String(a).split("@")[0].split(":")[0] === String(b).split("@")[0].split(":")[0];
};

Module({
  command: "gcban",
  package: "group",
  description: "Remove one mentioned/replied member from the current group",
  usage: ".gcban @member (or reply to their message with .gcban)",
})(async (message) => {
  try {
    if (!message.isGroup) return message.send("❌ This command only works in a group.");
    await message.loadGroupInfo?.();

    if (!message.isAdmin && !message.isFromMe && !message.isfromMe) {
      return message.send("❌ Only a group admin or bot owner can use this command.");
    }
    if (!message.isBotAdmin) {
      return message.send("❌ The bot must be a group admin to remove a member.");
    }

    const targets = [
      ...(Array.isArray(message.mentions) ? message.mentions : []),
      message.quoted?.participant,
    ].filter(Boolean);
    const uniqueTargets = [...new Map(targets.map((jid) => [String(jid), jid])).values()];
    if (uniqueTargets.length !== 1) {
      return message.send("Usage: .gcban @member\nOr reply to one member's message with .gcban.");
    }

    const target = uniqueTargets[0];
    const metadata = message.groupMetadata || await message.conn.groupMetadata(message.from);
    const participants = metadata?.participants || [];
    const member = participants.find((participant) => sameJid(message, participant.id, target));
    if (!member) return message.send("❌ That user is not a member of this group.");

    const botJid = message.conn?.user?.id;
    if (sameJid(message, target, botJid)) {
      return message.send("❌ The bot cannot remove itself with this command.");
    }
    if (sameJid(message, target, message.groupOwner)) {
      return message.send("❌ The group owner cannot be removed.");
    }
    const targetIsAdmin =
      member.admin === "admin" ||
      member.admin === "superadmin" ||
      member.isAdmin === true ||
      (message.groupAdmins || []).some((adminJid) => sameJid(message, adminJid, target));
    if (targetIsAdmin) {
      return message.send("❌ Admins cannot be removed with this command.");
    }

    await message.react?.("⏳");
    await message.conn.groupParticipantsUpdate(message.from, [target], "remove");
    await message.react?.("✅");
    return message.reply(`✅ Removed @${String(target).split("@")[0]} from this group.`, {
      mentions: [target],
    });
  } catch (error) {
    console.error("[gcban]", error?.message || error);
    try {
      await message.react?.("❌");
    } catch {}
    return message.send("❌ Could not remove that member. Check that the bot is an admin and try again.");
  }
});
