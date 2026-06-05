"use strict";

// Fallback used when the webcam name cannot be picked from the usb.ids list.
var DEFAULT_LABEL = "Integrated Webcam (1bcf:2b95)";

// Source list of USB IDs. We try https first, then the plain http URL.
var USB_IDS_URLS = [
  "https://www.linux-usb.org/usb.ids",
  "http://www.linux-usb.org/usb.ids"
];

// Keep only webcam-like devices, and drop other camera types (still/digital
// cameras, camcorders, IP/action/dash cams, scanners, etc.).
var INCLUDE_RE = /(web ?-?cam|webcam|\bcamera\b)/i;
var EXCLUDE_RE = /(camcorder|digital camera|\bdsc\b|\bdslr\b|still camera|\bptp\b|\bmtp\b|ip camera|dash ?cam|action ?cam|document camera|thermal|microscope|scanner|barcode|fingerprint)/i;

// Generates a random hex identifier (64 chars by default, like Chrome's real
// deviceId/groupId values, which are SHA-256 hashes).
function randomHex(len) {
  var bytes = new Uint8Array(len / 2);
  crypto.getRandomValues(bytes);
  var out = "";
  for (var i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

// Parses the usb.ids text into "Name (vendor:product)" entries for webcams.
// Vendor lines have no leading tab; device lines are prefixed with a single tab.
function parseWebcams(text) {
  var lines = text.split(/\r?\n/);
  var vendorId = null;
  var out = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!line || line.charAt(0) === "#") continue;

    var vendor = /^([0-9a-fA-F]{4})\s+(.+)$/.exec(line);
    if (vendor) {
      vendorId = vendor[1].toLowerCase();
      continue;
    }

    var device = /^\t([0-9a-fA-F]{4})\s+(.+)$/.exec(line);
    if (device && vendorId) {
      var productId = device[1].toLowerCase();
      var name = device[2].trim();
      if (INCLUDE_RE.test(name) && !EXCLUDE_RE.test(name)) {
        out.push(name + " (" + vendorId + ":" + productId + ")");
      }
    }
  }
  return out;
}

function fetchWebcamList() {
  var attempt = function (idx) {
    if (idx >= USB_IDS_URLS.length) return Promise.resolve([]);
    return fetch(USB_IDS_URLS[idx], { credentials: "omit" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var list = parseWebcams(text);
        if (list.length) return list;
        return attempt(idx + 1);
      })
      .catch(function () {
        return attempt(idx + 1);
      });
  };
  return attempt(0);
}

function getCachedList() {
  return new Promise(function (resolve) {
    chrome.storage.local.get({ __webcamNames: [] }, function (s) {
      resolve((s && s.__webcamNames) || []);
    });
  });
}

// Returns the webcam list, using the cached copy unless a refresh is forced.
function ensureWebcamList(forceRefresh) {
  var cachedPromise = forceRefresh ? Promise.resolve([]) : getCachedList();
  return cachedPromise.then(function (cached) {
    if (cached.length) return cached;
    return fetchWebcamList().then(function (list) {
      if (list.length) chrome.storage.local.set({ __webcamNames: list });
      return list;
    });
  });
}

// Picks a random webcam name from the list, or the default on any failure.
function pickWebcamName() {
  return ensureWebcamList(false)
    .then(function (list) {
      if (list && list.length) {
        return list[Math.floor(Math.random() * list.length)];
      }
      return DEFAULT_LABEL;
    })
    .catch(function () {
      return DEFAULT_LABEL;
    });
}

// Ensures the persisted identity (deviceId, groupId, fake name) exists. Only
// fills what is missing, so values stay stable across sessions like a real cam.
function ensureDefaults() {
  chrome.storage.local.get(
    ["fakeDeviceId", "fakeGroupId", "fakeLabel"],
    function (stored) {
      var patch = {};
      if (!stored || !stored.fakeDeviceId) patch.fakeDeviceId = randomHex(64);
      if (!stored || !stored.fakeGroupId) patch.fakeGroupId = randomHex(64);

      var needLabel = !stored || !stored.fakeLabel;
      var labelPromise = needLabel
        ? pickWebcamName()
        : Promise.resolve(null);

      labelPromise.then(function (name) {
        if (name) patch.fakeLabel = name;
        if (Object.keys(patch).length) chrome.storage.local.set(patch);
      });
    }
  );
}

chrome.runtime.onInstalled.addListener(ensureDefaults);
chrome.runtime.onStartup.addListener(ensureDefaults);

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (msg && msg.type === "randomizeName") {
    pickWebcamName().then(function (name) {
      sendResponse({ name: name });
    });
    return true;
  }
  if (msg && msg.type === "refreshWebcamList") {
    ensureWebcamList(true).then(function (list) {
      sendResponse({ count: list.length });
    });
    return true;
  }
});
