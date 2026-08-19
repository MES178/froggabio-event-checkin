// Public runtime configuration. Do not put secrets in this file.
window.LS_CONFIG = Object.freeze({
  eventKey: "ls2026",
  eventLabel: "Life Science — October 6, 2026",
  apiBaseUrl: "https://fgbio.app.n8n.cloud",
  authPath: "/webhook/ls2026/auth",
  rosterPath: "/webhook/ls2026/roster",
  checkinPath: "/webhook/ls2026/checkin",
  rosterRefreshMinutes: 5,
  queueRetryMs: 15000,
});
