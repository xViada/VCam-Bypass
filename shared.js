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

  function deriveMicLabel(webcamLabel, fallbackWebcamLabel, fallbackMicLabel) {
    const m = (webcamLabel || fallbackWebcamLabel || DEFAULT_FAKE_LABEL)
      .trim()
      .match(ID_RE);
    return m ? "Internal Microphone (" + m[2] + ")" : fallbackMicLabel || DEFAULT_MIC_LABEL;
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

  root.__vcamShared = {
    DEFAULT_FAKE_LABEL,
    DEFAULT_MIC_LABEL,
    ID_RE,
    CONFIG_KEYS,
    randomHex,
    createDefaults,
    deriveMicLabel,
    mergeDeviceLabels
  };
})(typeof self !== "undefined" ? self : this);
