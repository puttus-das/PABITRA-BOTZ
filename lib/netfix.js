// Termux / mobile-network fix for "Media upload failed on all hosts"
// Node 20+ tries IPv6 + a very short "happy eyeballs" timeout, which breaks WhatsApp media uploads on many phones.
import dns from "dns";
import net from "net";

try { dns.setDefaultResultOrder("ipv4first"); } catch (_) {}
try { net.setDefaultAutoSelectFamily(false); } catch (_) {}

// Downloads (songs / videos) can take longer than the default 60 s command / 15 s text-plugin limits
process.env.CMD_TASK_TIMEOUT_MS ||= "180000";
process.env.TEXT_TASK_TIMEOUT_MS ||= "180000";
