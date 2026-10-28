/*
 * Copyright (C) 2026 xViada <https://github.com/xViada>
 * Based on VCam Bypass by xViada — https://github.com/xViada/VCam-Bypass
 * Licensed under the GNU GPL version 3. See LICENSE and ADDITIONAL-TERMS.md.
 */

(function (root) {
  "use strict";

  const DEFAULT_FAKE_LABEL = "Integrated Webcam (1bcf:2b95)";
  const DEFAULT_MIC_LABEL = "Internal Microphone (1bcf:2b95)";
  const ID_RE = /^(.+?)\s*\(([0-9a-f]{4}:[0-9a-f]{4})\)\s*$/i;

  const CONFIG_KEYS = new Set([
    "enabled",
    "hideOtherDevices",
    "targetLabel",
    "fakeLabel",
    "fakeDeviceId",
    "fakeGroupId",
    "cameraProfile",
    "cameraCaps",
    "micMode",
    "targetMicLabel",
    "fakeMicLabel",
    "fakeMicDeviceId",
    "fakeMicGroupId"
  ]);

  function randomHex(len) {
    return Array.from(crypto.getRandomValues(new Uint8Array(len / 2)), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");
  }

  function createDefaults() {
    return {
      enabled: false,
      hideOtherDevices: false,
      targetLabel: "",
      fakeLabel: DEFAULT_FAKE_LABEL,
      fakeDeviceId: randomHex(64),
      fakeGroupId: randomHex(64),
      cameraProfile: "generic",
      cameraCaps: null,
      micMode: "off",
      targetMicLabel: "",
      fakeMicLabel: DEFAULT_MIC_LABEL,
      fakeMicDeviceId: randomHex(64),
      fakeMicGroupId: randomHex(64)
    };
  }

  // The mic label logic is mirrored in inject.js, which doesn't load this
  // file; keep the two in step.

  // Custom-mode default: "Internal Microphone (vid:pid)" with the camera's ids.
  function deriveMicLabel(webcamLabel) {
    const m = (webcamLabel || DEFAULT_FAKE_LABEL).trim().match(ID_RE);
    return m ? "Internal Microphone (" + m[2] + ")" : "Internal Microphone";
  }

  // Auto mode: a mic on the same physical device as the camera, e.g.
  // "Microphone (HD Pro Webcam C920) (046d:082d)".
  function linkedMicLabel(webcamLabel) {
    const label = (webcamLabel || "").trim();
    const m = label.match(ID_RE);
    if (m) return "Microphone (" + m[1].trim() + ") (" + m[2] + ")";
    return label ? "Microphone (" + label + ")" : "Microphone";
  }

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

  function mergeDeviceLabels(storageKey, labels) {
    const fresh = labels.filter(Boolean);
    if (!fresh.length) return Promise.resolve();
    return new Promise((resolve) => {
      chrome.storage.local.get({ __availableCameras: [], __availableMics: [] }, (s) => {
        const merged = new Set((s && s[storageKey]) || []);
        const before = merged.size;
        fresh.forEach((l) => merged.add(l));
        if (merged.size !== before) {
          chrome.storage.local.set({ [storageKey]: [...merged] }, resolve);
        } else {
          resolve();
        }
      });
    });
  }

  // Opens and releases the camera and mic so device labels become readable.
  // A combined request fails as a whole when one kind is missing or blocked
  // (a PC with no microphone, say), so each kind is then asked for on its own
  // and the call only fails when neither can be opened.
  function requestDeviceAccess() {
    const open = (c) =>
      navigator.mediaDevices.getUserMedia(c).then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
      });
    const tryOpen = (c) => open(c).then(() => true, () => false);

    return open({ video: true, audio: true }).catch((err) =>
      tryOpen({ video: true }).then((video) =>
        tryOpen({ audio: true }).then((audio) => {
          if (!video && !audio) throw err;
        })
      )
    );
  }

  root.__vcamShared = {
    DEFAULT_FAKE_LABEL,
    DEFAULT_MIC_LABEL,
    ID_RE,
    CONFIG_KEYS,
    randomHex,
    createDefaults,
    deriveMicLabel,
    linkedMicLabel,
    isNewerVersion,
    mergeDeviceLabels,
    requestDeviceAccess
  };
})(typeof self !== "undefined" ? self : this);
