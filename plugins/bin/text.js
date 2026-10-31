import crypto from "crypto";

// Group welcome text (use &mention for the new member)
export const WELCOME_TEXTS = [
  `\`𝐇𝐄𝐘𝐘 &mention\` 🔥💜 

*⎯‌᳑⎯꯭⃜ ꯭𔘓⃪꯭[]꯭💀꯭𝐖꯭ᴇ꯭ʟ꯭ᴄ꯭ᴏ꯭ᴍ꯭ᴇ꯭⟶꯭𝐓꯭ᴏ꯭ 𝐎꯭ᴜ꯭ʀ꯭ 𝐆꯭𝐂꯭)꯭ ⟶᯦꯭*
*⎯‌᳑⎯꯭⃜ ꯭𔘓⃪꯭[]꯭🩸꯭𝐈꯭ɴ꯭ᴛ꯭ʀ꯭ᴏ꯭ 𝐖꯭ɪ꯭ᴛ꯭ʜ꯭ 𝐎꯭ɴ꯭ᴇ꯭𝐕꯭ɪ꯭ᴇ꯭ᴡ꯭ 𝐏꯭ɪ꯭ᴄ꯭)꯭ ⟶᯦꯭*

*━( 𝐏ᴀʙɪᴛʀᴀ - 𝐁ᴏᴛ⎯꯭̽💜 )━*`,
];

// Group left text (use &mention for the member who left)
export const GOODBYE_TEXTS = [
  `&mention

*⎯‌᳑⎯꯭⃜ ꯭𔘓⃪꯭[]꯭꯭𝐋꯭ᴇ꯭ғ꯭ᴛ꯭⟶꯭𝐓꯭ᴏ꯭꯭ ʙᴏᴋᴀᴄʜᴜᴅᴀ꯭)꯭ ⟶᯦꯭*
*⎯‌᳑⎯꯭⃜ ꯭𔘓⃪꯭[]꯭💀꯭𝐏꯭ʟ꯭s꯭ 𝐃꯭ᴏ꯭ɴ’ᴛ꯭ 𝐂꯭ᴏ꯭ᴍ꯭ᴇ꯭ 𝐁꯭ᴀ꯭ᴄ꯭ᴋ꯭ 😅)꯭☠️*

*━( 𝐏ᴀʙɪᴛʀᴀ - 𝐁ᴏᴛ⎯꯭̽💜 )━*`,
];

export function pickRandom(arr) {
  const index = crypto.randomInt(0, arr.length);
  return arr[index];
}
