import axios from "axios";

// ─── Rabbit API (rabbitapi.zone.id) ──────────────────────────────────────────
// Endpoints:
//   GET /api/play  → song name / YouTube URL
//   GET /api/song  → song name / YouTube URL
// Error when query is missing: { status: 400, response: { message: "Enter song name or YouTube URL" } }

const BASE = (process.env.RABBIT_API_BASE || "https://rabbitapi.zone.id").replace(/\/+$/, "");
const PARAM_CANDIDATES = ["query", "q", "text", "name", "url", "song"];
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// remember which query-param name worked for each endpoint
const workingParam = {};

const URL_KEYS = ["download", "downloadurl", "download_url", "dl", "dlink", "mp3", "audio", "audiourl", "audio_url", "link", "url", "result"];
const TITLE_KEYS = ["title", "name", "filename"];
const THUMB_KEYS = ["thumbnail", "thumb", "image", "cover", "poster"];
const DURATION_KEYS = ["duration", "timestamp", "length"];
const AUTHOR_KEYS = ["author", "channel", "artist", "uploader"];

function flatten(obj, prefix = "", out = []) {
  if (obj == null) return out;
  if (typeof obj === "string" || typeof obj === "number") {
    out.push([prefix.toLowerCase(), obj]);
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, `${prefix}.${i}`, out));
  } else if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}

const lastKey = (p) => p.split(".").filter((s) => !/^\d+$/.test(s)).pop() || "";

function pick(flat, keys, test = () => true) {
  for (const key of keys) {
    const hit = flat.find(([p, v]) => lastKey(p) === key && test(v));
    if (hit) return hit[1];
  }
  return null;
}

const isHttp = (v) => typeof v === "string" && /^https?:\/\//i.test(v);
const isImage = (v) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(v) || /ytimg\.com|i\.ytimg|googleusercontent/i.test(v);
const isYtPage = (v) => /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(v);

function parsePayload(json) {
  const flat = flatten(json?.response ?? json);

  // download link: prefer audio-ish keys, skip images and plain youtube pages
  const downloadUrl =
    pick(flat, URL_KEYS, (v) => isHttp(v) && !isImage(v) && !isYtPage(v)) ||
    flat.find(([, v]) => isHttp(v) && !isImage(v) && !isYtPage(v))?.[1] ||
    null;

  return {
    downloadUrl,
    title: pick(flat, TITLE_KEYS, (v) => typeof v === "string" && !isHttp(v)),
    thumbnail: pick(flat, THUMB_KEYS, isHttp),
    duration: pick(flat, DURATION_KEYS),
    author:
      pick(flat, AUTHOR_KEYS, (v) => typeof v === "string" && !isHttp(v)) ||
      flat.find(
        ([p, v]) =>
          AUTHOR_KEYS.some((k) => p.split(".").includes(k)) &&
          typeof v === "string" &&
          !isHttp(v)
      )?.[1] ||
      null,
  };
}

function isMissingQueryError(json) {
  const msg = json?.response?.message || json?.message || "";
  return /enter song name|youtube url/i.test(String(msg));
}

async function callOnce(endpoint, param, input) {
  const res = await axios.get(`${BASE}/api/${endpoint}`, {
    params: { [param]: input },
    headers: { "User-Agent": UA, Accept: "application/json, audio/*" },
    responseType: "arraybuffer",
    timeout: 90_000,
    validateStatus: () => true,
  });

  const type = String(res.headers["content-type"] || "");

  // API returned the audio file directly
  if (/^audio\//i.test(type) || /octet-stream/i.test(type)) {
    return { audioBuffer: Buffer.from(res.data), title: null };
  }

  let json;
  try {
    json = JSON.parse(Buffer.from(res.data).toString("utf8"));
  } catch {
    throw new Error(`Rabbit API sent an unreadable response (HTTP ${res.status})`);
  }
  return { json, httpStatus: res.status };
}

/**
 * @param {"play"|"song"} endpoint
 * @param {string} input  song name or YouTube URL
 * @returns {{ downloadUrl?, audioBuffer?, title, thumbnail, duration, author }}
 */
export async function rabbitAudio(endpoint, input) {
  const order = workingParam[endpoint]
    ? [workingParam[endpoint], ...PARAM_CANDIDATES.filter((p) => p !== workingParam[endpoint])]
    : PARAM_CANDIDATES;

  let lastErr = "Rabbit API failed";

  for (const param of order) {
    const r = await callOnce(endpoint, param, input);

    if (r.audioBuffer) {
      workingParam[endpoint] = param;
      return { audioBuffer: r.audioBuffer, title: null, thumbnail: null, duration: null, author: null };
    }

    const { json } = r;
    if (isMissingQueryError(json)) continue; // wrong param name → try next

    const ok =
      json?.status === 200 ||
      json?.status === true ||
      json?.success === true ||
      json?.response?.status === true ||
      json?.response?.success === true ||
      !!json?.result;
    if (!ok) {
      lastErr = json?.response?.message || json?.message || lastErr;
      continue;
    }

    const parsed = parsePayload(json);
    if (!parsed.downloadUrl) {
      lastErr =
        "Rabbit API did not return a download link. Keys: " +
        Object.keys(json?.result ?? json?.response ?? json ?? {}).join(",");
      continue;
    }
    workingParam[endpoint] = param;
    return parsed;
  }

  throw new Error(lastErr);
}
