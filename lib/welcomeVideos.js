// lib/welcomeVideos.js — random welcome video for WhatsApp + Telegram
// Every new member gets a different video (shuffle-bag: no repeats until all were used).
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "plugins", "bin", "welcome");

let _list = null;
let _bag = [];
let _last = -1;

function load() {
  if (_list) return _list;
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(DIR, "meta.json"), "utf8"));
    _list = meta
      .map((m) => ({
        file: path.join(DIR, m.file),
        thumb: m.thumb ? path.join(DIR, m.thumb) : null,
        width: m.width,
        height: m.height,
        duration: m.duration,
      }))
      .filter((m) => fs.existsSync(m.file));
  } catch {
    _list = [];
  }
  return _list;
}

// returns { file, thumb, width, height, duration } or null when no video exists
export function getRandomWelcome() {
  const list = load();
  if (!list.length) return null;
  if (!_bag.length) {
    _bag = list.map((_, i) => i);
    for (let i = _bag.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [_bag[i], _bag[j]] = [_bag[j], _bag[i]];
    }
    // don't start a new round with the video that ended the last one
    if (_bag.length > 1 && _bag[_bag.length - 1] === _last) {
      [_bag[0], _bag[_bag.length - 1]] = [_bag[_bag.length - 1], _bag[0]];
    }
  }
  _last = _bag.pop();
  return list[_last];
}

export default getRandomWelcome;
