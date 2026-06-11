"use strict";

// Used when no name can be picked from the usb.ids list.
const DEFAULT_LABEL = "Integrated Webcam (1bcf:2b95)";

const USB_IDS_URLS = [
  "https://www.linux-usb.org/usb.ids",
  "http://www.linux-usb.org/usb.ids"
];

// Keep webcam-like entries, drop other camera types (still/IP/action cams,
// scanners, etc.).
const INCLUDE_RE = /(web ?-?cam|webcam|\bcamera\b)/i;
const EXCLUDE_RE = /(camcorder|digital camera|\bdsc\b|\bdslr\b|still camera|\bptp\b|\bmtp\b|ip camera|dash ?cam|action ?cam|document camera|thermal|microscope|scanner|barcode|fingerprint)/i;

// 64-char hex by default, matching Chrome's SHA-256 deviceId/groupId format.
const randomHex = (len) =>
  Array.from(crypto.getRandomValues(new Uint8Array(len / 2)), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");

// usb.ids has vendor lines (no indent) followed by tab-indented device lines.
function parseWebcams(text) {
  const out = [];
  let vendorId = null;

  text.split(/\r?\n/).forEach((line) => {
    if (!line || line.charAt(0) === "#") return;

    const vendor = /^([0-9a-fA-F]{4})\s+(.+)$/.exec(line);
    if (vendor) {
      vendorId = vendor[1].toLowerCase();
      return;
    }

    const device = /^\t([0-9a-fA-F]{4})\s+(.+)$/.exec(line);
    if (device && vendorId) {
      const name = device[2].trim();
      if (INCLUDE_RE.test(name) && !EXCLUDE_RE.test(name)) {
        out.push(name + " (" + vendorId + ":" + device[1].toLowerCase() + ")");
      }
    }
  });

  return out;
}

// Tries each URL in order until one yields a non-empty list.
function fetchWebcamList() {
  const attempt = (idx) => {
    if (idx >= USB_IDS_URLS.length) return Promise.resolve([]);
    return fetch(USB_IDS_URLS[idx], { credentials: "omit" })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then((text) => parseWebcams(text))
      .then((list) => (list.length ? list : attempt(idx + 1)))
      .catch(() => attempt(idx + 1));
  };
  return attempt(0);
}

function getCachedList() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ __webcamNames: [] }, (s) => resolve((s && s.__webcamNames) || []));
  });
}

function ensureWebcamList(forceRefresh) {
  const cached = forceRefresh ? Promise.resolve([]) : getCachedList();
  return cached.then((list) => {
    if (list.length) return list;
    return fetchWebcamList().then((fresh) => {
      if (fresh.length) chrome.storage.local.set({ __webcamNames: fresh });
      return fresh;
    });
  });
}

function pickWebcamName() {
  return ensureWebcamList(false)
    .then((list) => (list.length ? list[Math.floor(Math.random() * list.length)] : DEFAULT_LABEL))
    .catch(() => DEFAULT_LABEL);
}

// Fills only the missing identity fields so values stay stable across sessions.
function ensureDefaults() {
  chrome.storage.local.get(["fakeDeviceId", "fakeGroupId", "fakeLabel"], (stored) => {
    const patch = {};
    if (!stored || !stored.fakeDeviceId) patch.fakeDeviceId = randomHex(64);
    if (!stored || !stored.fakeGroupId) patch.fakeGroupId = randomHex(64);

    const labelPromise =
      !stored || !stored.fakeLabel ? pickWebcamName() : Promise.resolve(null);

    labelPromise.then((name) => {
      if (name) patch.fakeLabel = name;
      if (Object.keys(patch).length) chrome.storage.local.set(patch);
    });
  });
}

const GITHUB_REPO = "xViada/VCam-Bypass";
const RELEASES_API = "https://api.github.com/repos/" + GITHUB_REPO + "/releases/latest";

function parseVersion(v) {
  const m = String(v || "")
    .trim()
    .replace(/^v/i, "")
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [+m[1], +m[2], +m[3]];
}

function isNewerVersion(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

function setUpdateBadge(show) {
  if (show) {
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

function checkForUpdate() {
  const current = chrome.runtime.getManifest().version;

  return fetch(RELEASES_API, {
    credentials: "omit",
    headers: { Accept: "application/vnd.github+json" }
  })
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then((data) => {
      const latest = String(data.tag_name || "").replace(/^v/i, "");
      const releaseUrl =
        data.html_url || "https://github.com/" + GITHUB_REPO + "/releases/latest";
      const updateAvailable = isNewerVersion(latest, current);

      chrome.storage.local.set({
        __updateCheck: {
          checkedAt: Date.now(),
          currentVersion: current,
          latestVersion: latest,
          updateAvailable,
          releaseUrl
        }
      });

      setUpdateBadge(updateAvailable);
    })
    .catch(() => {});
}

function onBoot() {
  ensureDefaults();
  checkForUpdate();
}

chrome.runtime.onInstalled.addListener(onBoot);
chrome.runtime.onStartup.addListener(onBoot);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "randomizeName") {
    pickWebcamName().then((name) => sendResponse({ name }));
    return true;
  }
  if (msg && msg.type === "refreshWebcamList") {
    ensureWebcamList(true).then((list) => sendResponse({ count: list.length }));
    return true;
  }
});
