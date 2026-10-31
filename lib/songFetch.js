// YouTube link → EliteProTech MP3 buffer.
import { eliteAudio } from "./media.js";

export async function fetchSongAudio(videoUrl) {
  const buffer = await eliteAudio(videoUrl);
  return { buffer, title: "song", provider: "eliteprotech" };
}

export default fetchSongAudio;
