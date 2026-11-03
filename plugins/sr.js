import { Module } from "../lib/plugins.js";

Module({
  command: "sr",
  package: "mics",
  description: "React to a replied-to message with a circle",
  usage: ".sr (reply to a message)",
})(async (message) => {
  const quoted = message?.quoted;
  if (!quoted?.key?.id) {
    return message.send("Reply to a message first, then type .sr");
  }

  try {
    await message.conn.sendMessage(message.from, {
      react: {
        text: "⭕",
        key: quoted.key,
      },
    });
  } catch (error) {
    console.error("[sr] Reaction failed:", error?.message || error);
    await message.send("Could not react to that message. Please try again.");
  }
});
