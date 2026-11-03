// lib/resolveFfmpeg.js — find a working ffmpeg binary (Termux, Linux, Docker, Windows)
import { execSync } from "child_process";
import { createRequire } from "module";

let cached = null;

export function resolveFfmpegPath() {
  if (cached) return cached;
  const require = createRequire(import.meta.url);

  // 1) explicit override
  if (process.env.FFMPEG_PATH) return (cached = process.env.FFMPEG_PATH);

  // 2) ffmpeg installed on the system (Termux: pkg install ffmpeg)
  try {
    const cmd = process.platform === "win32" ? "where ffmpeg" : "command -v ffmpeg";
    const found = execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().split(/\r?\n/)[0].trim();
    if (found) return (cached = found);
  } catch {}

  // 3) binary shipped with @ffmpeg-installer/ffmpeg
  try {
    const p = require("@ffmpeg-installer/ffmpeg")?.path;
    if (p) return (cached = p);
  } catch {}

  return (cached = "ffmpeg");
}

export default resolveFfmpegPath;
