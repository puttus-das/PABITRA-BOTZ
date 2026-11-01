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
  let stashed = false;
  try {
    await message.send("⏳ _Checking for updates..._");
    const { stdout: dirtyFiles } = await execFileAsync("git", ["status", "--porcelain", "--untracked-files=no"], {
      cwd: process.cwd(),
      timeout: 30_000,
      maxBuffer: 512 * 1024,
    });
    if (String(dirtyFiles || "").trim()) {
      await execFileAsync("git", ["stash", "push", "-m", `pabitra-auto-update-${Date.now()}`], {
        cwd: process.cwd(),
        timeout: 60_000,
        maxBuffer: 512 * 1024,
      });
      stashed = true;
    }
    const { stdout } = await execFileAsync("git", ["pull", "--ff-only"], {
      cwd: process.cwd(),
      timeout: 120_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const summary = String(stdout || "");
    const updated = /already up[- ]to[- ]date/i.test(summary)
      ? "Repository is up to date."
      : "Repository updated successfully.";
    const stashNote = stashed
      ? "\n\n🧳 _Local tracked changes were stashed safely before updating._"
      : "";
    await message.send(`✅ ${updated}${stashNote}\n\n♻️ _Restarting the complete bot now..._`);
    setTimeout(() => process.exit(0), 1_500);
  } catch (error) {
    console.error("[update] git pull failed:", error?.message || error);
    if (stashed) {
      try {
        await execFileAsync("git", ["stash", "pop"], {
          cwd: process.cwd(),
          timeout: 60_000,
          maxBuffer: 512 * 1024,
        });
      } catch (restoreError) {
        console.error("[update] failed to restore pre-update stash:", restoreError?.message || restoreError);
      }
    }
    await message.send("❌ _Update failed; bot was not restarted._\n\n_Check the server logs for details._");
  }
});
