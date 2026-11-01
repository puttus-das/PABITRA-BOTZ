import { execFile } from "child_process";
import { promisify } from "util";
import { Module } from "../lib/plugins.js";

const execFileAsync = promisify(execFile);
const isOwner = (message) => !!(message?.isfromMe || message?.isFromMe);

Module({
  command: "update",
  aliases: ["restart"],
  package: "owner",
  description: "Pull the latest code and restart the complete bot",
  usage: ".update",
})(async (message) => {
  if (!isOwner(message)) return message.send("_This command is for the owner only_");
  try {
    await message.send("⏳ _Checking GitHub for updates..._");
    const { stdout } = await execFileAsync("git", ["pull", "--ff-only"], {
      cwd: process.cwd(),
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const summary = String(stdout || "").trim();
    await message.send(`✅ ${summary || "Repository is up to date."}\n\n♻️ _Restarting the complete bot now..._`);
    setTimeout(() => process.exit(0), 1_500);
  } catch (error) {
    console.error("[update] git pull failed:", error?.message || error);
    await message.send(`❌ _Update failed; bot was not restarted._\n\n${error?.stderr || error?.message || "Unknown error"}`);
  }
});
