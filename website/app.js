const DEFAULT_API_URL = "https://niloyy-4b8c614a0da0.herokuapp.com";
const configuredApiUrl = String(window.PABITRA_API_URL || "").trim();
const API_URL = String(
  configuredApiUrl && !configuredApiUrl.includes("YOUR-HEROKU-APP")
    ? configuredApiUrl
    : DEFAULT_API_URL
).replace(/\/$/, "");
const $ = (selector) => document.querySelector(selector);
const sessionCount = $("#sessionCount");
const pluginCount = $("#pluginCount");
const apiState = $("#apiState");

async function refreshStatus() {
  try {
    const [healthResponse, sessionsResponse, pluginsResponse] = await Promise.all([
      fetch(`${API_URL}/`),
      fetch(`${API_URL}/sessions`),
      fetch(`${API_URL}/plugins`),
    ]);
    const health = await healthResponse.json();
    const sessions = await sessionsResponse.json();
    const plugins = await pluginsResponse.json();
    apiState.textContent = health.ok ? "online" : "offline";
    sessionCount.textContent = sessions.sessions?.length ?? 0;
    pluginCount.textContent = plugins.total ?? 0;
  } catch {
    apiState.textContent = "offline";
    sessionCount.textContent = "—";
    pluginCount.textContent = "—";
  }
}

$("#pairForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = $("#pairResult");
  const button = event.currentTarget.querySelector("button");
  const phone = $("#phone").value.replace(/\D/g, "");
  result.hidden = false;
  if (phone.length < 6 || phone.length > 15) {
    result.textContent = "Enter a valid country-code number, for example 919812345678.";
    return;
  }
  button.disabled = true;
  button.textContent = "Generating…";
  result.textContent = "Connecting to the bot backend…";
  try {
    const response = await fetch(`${API_URL}/pair/${phone}`);
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Pairing failed");
    result.innerHTML = `Your WhatsApp code:<br><code>${data.code}</code><br><small>Open WhatsApp → Linked Devices → Link with phone number instead.</small>`;
  } catch (error) {
    result.textContent = error.message || "Pairing failed. Use Telegram /pair instead.";
  } finally {
    button.disabled = false;
    button.textContent = "Get code";
  }
});

refreshStatus();
setInterval(refreshStatus, 30000);
