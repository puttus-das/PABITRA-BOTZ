import { Module } from "../lib/plugins.js";
import { sendPing } from "../lib/pingCore.js";

Module({
  command: "ping",
  package: "mics",
  description: "Replies with the bot latency",
})(async (message) => {
  await sendPing(message);
});
