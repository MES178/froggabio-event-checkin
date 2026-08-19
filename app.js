(() => {
  "use strict";

  const config = window.LS_CONFIG || {};
  const DB_NAME = "froggabio-ls2026-checkin";
  const DB_VERSION = 1;
  const SESSION_KEY = "ls2026_session";
  const state = {
    db: null,
    session: null,
    roster: [],
    queue: [],
    stream: null,
    scanning: false,
    scanBusy: false,
    lastResult: null,
    lastRosterSync: 0,
    deviceId: getDeviceId(),
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    loginView: $("loginView"),
    appView: $("appView"),
    loginForm: $("loginForm"),
    staffPin: $("staffPin"),
    notice: $("notice"),
    connectionChip: $("connectionChip"),
    connectionLabel: $("connectionLabel"),
    rosterCount: $("rosterCount"),
    rosterUpdated: $("rosterUpdated"),
    queueCount: $("queueCount"),
    queueCaption: $("queueCaption"),
    deviceLabel: $("deviceLabel"),
    refreshRoster: $("refreshRoster"),
    camera: $("camera"),
    scanCanvas: $("scanCanvas"),
    scannerPlaceholder: $("scannerPlaceholder"),
    scannerMessage: $("scannerMessage"),
    scannerState: $("scannerState"),
    startScanner: $("startScanner"),
    stopScanner: $("stopScanner"),
    searchForm: $("searchForm"),
    searchInput: $("searchInput"),
    searchResults: $("searchResults"),
    logoutButton: $("logoutButton"),
    resultDialog: $("resultDialog"),
    dialogIcon: $("dialogIcon"),
    dialogEyebrow: $("dialogEyebrow"),
    dialogTitle: $("dialogTitle"),
    dialogMessage: $("dialogMessage"),
    dialogMeta: $("dialogMeta"),
    dialogClose: $("dialogClose"),
    dialogUndo: $("dialogUndo"),
  };

  document.addEventListener("DOMContentLoaded", boot);

  async function boot() {
    els.deviceLabel.textContent = state.deviceId.slice(-6).toUpperCase();
    updateConnection();
    window.addEventListener("online", () => {
      updateConnection();
      syncQueue();
      maybeRefreshRoster();
    });
    window.addEventListener("offline", updateConnection);
    els.loginForm.addEventListener("submit", onLogin);
    els.refreshRoster.addEventListener("click", () => refreshRoster(true));
    els.startScanner.addEventListener("click", startScanner);
    els.stopScanner.addEventListener("click", stopScanner);
    els.searchForm.addEventListener("submit", onSearch);
    els.logoutButton.addEventListener("click", lockDesk);
    els.dialogClose.addEventListener("click", closeDialog);
    els.dialogUndo.addEventListener("click", undoLastCheckin);
    state.db = await openDb();
    state.roster = await readAll("roster");
    state.queue = await readAll("queue");
    renderStats();
    restoreSession();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  function getDeviceId() {
    const key = "ls2026_device_id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = `desk-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key, id);
    }
    return id;
  }

  function apiUrl(path) {
    return `${String(config.apiBaseUrl || "").replace(/\/$/, "")}${path}`;
  }

  function sessionIsValid() {
    return Boolean(state.session?.token && state.session.expiresAt > Date.now());
  }

  function restoreSession() {
    try {
      const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (stored?.token && Number(stored.expiresAt) > Date.now()) {
        state.session = stored;
        showApp();
        maybeRefreshRoster();
        return;
      }
    } catch (_) {
      sessionStorage.removeItem(SESSION_KEY);
    }
    showLogin();
  }

  async function onLogin(event) {
    event.preventDefault();
    const pin = els.staffPin.value.trim();
    if (!pin) return;
    setNotice("Connecting to the event desk…");
    try {
      const result = await fetchJson(apiUrl(config.authPath), {
        method: "POST",
        body: JSON.stringify({ event_key: config.eventKey, pin }),
      });
      const token = result.session_token || result.token;
      const expiresAt = Number(result.expires_at || result.expiresAt || Date.now() + 8 * 60 * 60 * 1000);
      if (!token) throw new Error("The check-in service did not return a session.");
      state.session = { token, expiresAt };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state.session));
      els.staffPin.value = "";
      showApp();
      await refreshRoster(true);
    } catch (error) {
      setNotice(error.message || "Could not open the check-in desk.");
    }
  }

  function showLogin() {
    els.loginView.hidden = false;
    els.appView.hidden = true;
  }

  function showApp() {
    els.loginView.hidden = true;
    els.appView.hidden = false;
    renderStats();
  }

  function lockDesk() {
    stopScanner();
    state.session = null;
    sessionStorage.removeItem(SESSION_KEY);
    showLogin();
    setNotice("The desk is locked on this device.", "success");
  }

  async function refreshRoster(force = false) {
    if (!sessionIsValid()) return showLogin();
    if (!navigator.onLine) {
      setNotice("Offline — using the last roster saved on this device.");
      return;
    }
    if (!force && state.lastRosterSync && Date.now() - state.lastRosterSync < (config.rosterRefreshMinutes || 5) * 60 * 1000) return;
    els.refreshRoster.disabled = true;
    try {
      const result = await fetchJson(apiUrl(config.rosterPath), { headers: authHeaders() });
      const roster = Array.isArray(result) ? result : (result.contacts || result.roster || []);
      if (!Array.isArray(roster)) throw new Error("The roster response was not understood.");
      state.roster = roster.map(normalizeGuest).filter((guest) => guest.token);
      await replaceStore("roster", state.roster);
      state.lastRosterSync = Date.now();
      setNotice(`Roster refreshed — ${state.roster.length} guests available on this device.`, "success");
      renderStats();
    } catch (error) {
      setNotice(state.roster.length ? `Could not refresh. Using the saved roster (${state.roster.length} guests).` : (error.message || "Could not load the roster."));
    } finally {
      els.refreshRoster.disabled = false;
    }
  }

  function maybeRefreshRoster() {
    if (state.session && navigator.onLine) refreshRoster(false);
  }

  function normalizeGuest(raw) {
    const name = raw.name || [raw.firstname, raw.lastname].filter(Boolean).join(" ").trim();
    return {
      token: String(raw.token || raw.ls2026_token || "").trim(),
      shortCode: String(raw.short_code || raw.shortCode || raw.ls2026_short_code || "").trim().toUpperCase(),
      name: name || "Guest",
      firstname: raw.firstname || "",
      lastname: raw.lastname || "",
      email: String(raw.email || "").trim(),
      company: String(raw.company || "").trim(),
      jobtitle: String(raw.jobtitle || "").trim(),
      status: String(raw.status || raw.ls2026_status || "registered").toLowerCase(),
      checkedInAt: raw.checked_in_at || raw.checkedInAt || raw.ls2026_checked_in_at || "",
    };
  }

  async function startScanner() {
    if (!sessionIsValid()) return showLogin();
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerMessage("Camera access is not available on this browser. Use the manual lookup below.");
      return;
    }
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      els.camera.srcObject = state.stream;
      await els.camera.play();
      state.scanning = true;
      els.scannerPlaceholder.hidden = true;
      els.startScanner.disabled = true;
      els.stopScanner.disabled = false;
      els.scannerState.textContent = "Scanning";
      els.scannerState.dataset.state = "scanning";
      setScannerMessage(window.BarcodeDetector ? "Camera ready. Looking for a QR code…" : "Camera ready. Looking for a QR code…");
      scanFrame();
    } catch (error) {
      setScannerMessage(error.name === "NotAllowedError" ? "Camera permission was not granted. Use manual lookup or enable the camera for this site." : "Could not start the camera. Use manual lookup below.");
    }
  }

  function stopScanner() {
    state.scanning = false;
    if (state.stream) state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
    els.camera.srcObject = null;
    els.scannerPlaceholder.hidden = false;
    els.startScanner.disabled = false;
    els.stopScanner.disabled = true;
    els.scannerState.textContent = "Ready";
    delete els.scannerState.dataset.state;
  }

  async function scanFrame() {
    if (!state.scanning || state.scanBusy) return;
    state.scanBusy = true;
    try {
      if (window.BarcodeDetector) {
        const detector = scanFrame.detector || (scanFrame.detector = new BarcodeDetector({ formats: ["qr_code"] }));
        const codes = await detector.detect(els.camera);
        if (codes[0]?.rawValue) await processScannedValue(codes[0].rawValue);
      } else if (window.jsQR && els.camera.videoWidth > 0) {
        const canvas = els.scanCanvas;
        canvas.width = els.camera.videoWidth;
        canvas.height = els.camera.videoHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(els.camera, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
        if (code?.data) await processScannedValue(code.data);
      }
    } catch (_) {
      // A single failed frame must not stop the door scanner.
    } finally {
      state.scanBusy = false;
      if (state.scanning) window.setTimeout(scanFrame, 180);
    }
  }

  async function processScannedValue(rawValue) {
    const token = parseToken(rawValue);
    if (!token) return;
    const guest = state.roster.find((candidate) => candidate.token === token || candidate.shortCode === token.toUpperCase());
    if (!guest) {
      stopScanner();
      openResult({ tone: "warning", title: "Guest not found", message: "This QR code is not in the saved Life Science roster. Verify the event or use manual lookup.", meta: rawValue.slice(0, 120) });
      return;
    }
    stopScanner();
    await checkIn(guest, "qr");
  }

  function parseToken(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw);
      const queryToken = url.searchParams.get("t") || url.searchParams.get("token");
      if (queryToken) return queryToken.trim();
    } catch (_) {}
    const prefixed = raw.match(/^(?:LS2026|LS26)[:/\-]([A-Za-z0-9_-]+)$/i);
    return prefixed ? prefixed[1] : raw;
  }

  function onSearch(event) {
    event.preventDefault();
    const query = els.searchInput.value.trim().toLowerCase();
    if (query.length < 2) {
      renderSearchResults([]);
      return;
    }
    const matches = state.roster.filter((guest) => [guest.name, guest.email, guest.company, guest.shortCode].some((value) => value.toLowerCase().includes(query))).slice(0, 25);
    renderSearchResults(matches);
  }

  function renderSearchResults(matches) {
    els.searchResults.replaceChildren();
    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = state.roster.length ? "No matching guest in the saved roster." : "Load the roster before searching.";
      els.searchResults.append(empty);
      return;
    }
    matches.forEach((guest) => {
      const row = document.createElement("div");
      row.className = "guest-result";
      const info = document.createElement("div");
      info.className = "guest-info";
      const name = document.createElement("p");
      name.className = "guest-name";
      name.textContent = guest.name;
      const detail = document.createElement("p");
      detail.className = "guest-detail";
      detail.textContent = [guest.company, guest.email].filter(Boolean).join(" · ") || "No company or email";
      const code = document.createElement("p");
      code.className = "guest-code";
      code.textContent = guest.shortCode || "NO CODE";
      info.append(name, detail, code);
      const button = document.createElement("button");
      button.className = "button button-secondary";
      button.type = "button";
      button.textContent = guest.status === "attended" ? "Already in" : "Check in";
      button.disabled = guest.status === "attended";
      button.addEventListener("click", () => checkIn(guest, "manual_search"));
      row.append(info, button);
      els.searchResults.append(row);
    });
  }

  async function checkIn(guest, method) {
    const previousStatus = guest.status;
    if (previousStatus === "attended" || guest.checkedInAt) {
      openResult({ tone: "warning", title: guest.name, message: "This guest is already checked in.", meta: formatCheckedIn(guest.checkedInAt) });
      return;
    }
    const checkedInAt = new Date().toISOString();
    const event = { id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, token: guest.token, method, device: state.deviceId, checked_in_at: checkedInAt };
    guest.status = "attended";
    guest.checkedInAt = checkedInAt;
    await put("roster", guest);
    if (!navigator.onLine || !sessionIsValid()) {
      await enqueue(event);
      openResult({ title: guest.name, message: "Checked in on this device. It will sync automatically when the connection returns.", meta: "Offline queue" });
      return;
    }
    try {
      const response = await fetchJson(apiUrl(config.checkinPath), { method: "POST", headers: authHeaders(), body: JSON.stringify({ event_key: config.eventKey, device: state.deviceId, checkins: [event] }) });
      const result = Array.isArray(response?.results) ? response.results[0] : response;
      if (result?.duplicate || result?.status === "already_attended") {
        openResult({ tone: "warning", title: guest.name, message: "This guest was already checked in at another desk.", meta: formatCheckedIn(result.checked_in_at || guest.checkedInAt) });
      } else {
        openResult({ title: guest.name, message: "Check-in recorded.", meta: `${method === "qr" ? "QR scan" : "Manual lookup"} · ${formatTime(checkedInAt)}` });
      }
    } catch (error) {
      await enqueue(event);
      openResult({ title: guest.name, message: "Saved locally. The check-in will sync when the connection returns.", meta: error.message || "Connection unavailable" });
    }
    renderSearchResults([]);
    renderStats();
  }

  async function enqueue(event) {
    await put("queue", event);
    state.queue = await readAll("queue");
    renderStats();
  }

  async function syncQueue() {
    if (!navigator.onLine || !sessionIsValid() || !state.queue.length) return;
    try {
      const response = await fetchJson(apiUrl(config.checkinPath), { method: "POST", headers: authHeaders(), body: JSON.stringify({ event_key: config.eventKey, device: state.deviceId, checkins: state.queue }) });
      const acceptedIds = new Set((response?.results || []).filter((item) => item.accepted !== false).map((item) => item.id).filter(Boolean));
      for (const event of state.queue) if (acceptedIds.has(event.id) || response?.ok === true) await remove("queue", event.id);
      state.queue = await readAll("queue");
      renderStats();
      if (!state.queue.length) setNotice("Offline check-ins synced successfully.", "success");
    } catch (_) {
      window.setTimeout(syncQueue, config.queueRetryMs || 15000);
    }
  }

  function openResult({ tone = "success", title, message, meta }) {
    state.lastResult = { title, message, meta };
    els.dialogIcon.textContent = tone === "warning" ? "!" : "✓";
    els.dialogIcon.dataset.tone = tone;
    els.dialogEyebrow.textContent = tone === "warning" ? "Needs attention" : "Check-in result";
    els.dialogTitle.textContent = title;
    els.dialogMessage.textContent = message;
    els.dialogMeta.textContent = meta || "";
    els.dialogUndo.hidden = tone === "warning";
    if (!els.resultDialog.open) els.resultDialog.showModal();
  }

  function closeDialog() {
    if (els.resultDialog.open) els.resultDialog.close();
  }

  async function undoLastCheckin() {
    // Undo is deliberately local-only until the server supports an audited reversal endpoint.
    closeDialog();
    setNotice("Undo is disabled for this release; ask the event lead to correct an accidental check-in in HubSpot.");
  }

  function authHeaders() {
    return { Authorization: `Bearer ${state.session.token}`, "Content-Type": "application/json" };
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { Accept: "application/json", ...(options.headers || {}) } });
    let payload = null;
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(payload?.message || payload?.error || `Request failed (${response.status})`);
    return payload;
  }

  function setNotice(message, tone = "warning") {
    els.notice.hidden = !message;
    els.notice.textContent = message || "";
    els.notice.dataset.tone = tone;
  }

  function setScannerMessage(message) { els.scannerMessage.textContent = message; }

  function updateConnection() {
    const online = navigator.onLine;
    els.connectionChip.dataset.state = online ? "online" : "offline";
    els.connectionLabel.textContent = online ? "Online" : "Offline";
  }

  function renderStats() {
    els.rosterCount.textContent = state.roster.length;
    els.queueCount.textContent = state.queue.length;
    els.queueCaption.textContent = state.queue.length ? "Will sync when online" : "All clear";
    els.rosterUpdated.textContent = state.lastRosterSync ? `Updated ${formatTime(state.lastRosterSync)}` : (state.roster.length ? "Saved on this device" : "Not loaded yet");
  }

  function formatTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  }

  function formatCheckedIn(value) { return value ? `Checked in at ${formatTime(value)}` : "Already marked attended in HubSpot"; }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("roster")) db.createObjectStore("roster", { keyPath: "token" });
        if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue", { keyPath: "id" });
      };
    });
  }

  function readAll(storeName) {
    return new Promise((resolve, reject) => {
      const request = state.db.transaction(storeName, "readonly").objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  function put(storeName, value) {
    return new Promise((resolve, reject) => {
      const request = state.db.transaction(storeName, "readwrite").objectStore(storeName).put(value);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  function remove(storeName, key) {
    return new Promise((resolve, reject) => {
      const request = state.db.transaction(storeName, "readwrite").objectStore(storeName).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  function replaceStore(storeName, values) {
    return new Promise((resolve, reject) => {
      const transaction = state.db.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      store.clear();
      values.forEach((value) => store.put(value));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
})();
