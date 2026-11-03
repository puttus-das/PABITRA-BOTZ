import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const menuImagePath = path.join(__dirname, "menu.jpg");
export function getRandomPhoto() {
  try {
    const dir = path.join(__dirname, "menu");
    const all = fs.readdirSync(dir).filter((x) => /\.(jpe?g|png)$/i.test(x));
    if (all.length) return path.join(dir, all[Math.floor(Math.random() * all.length)]);
  } catch {}
  return menuImagePath;
}
