(function () {
  "use strict";

  const randomHex = (len) =>
    Array.from(crypto.getRandomValues(new Uint8Array(len / 2)), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");

  // Fallback only; the stable deviceId/groupId are persisted on install.
  const DEFAULTS = {
    enabled: true,
    targetLabel: "",
    fakeLabel: "Integrated Webcam (1bcf:2b95)",
    fakeDeviceId: randomHex(64),
    fakeGroupId: randomHex(64),
    cameraProfile: "generic",
    cameraCaps: null,
    micMode: "auto",
    targetMicLabel: "",
    fakeMicLabel: "Internal Microphone (1bcf:2b95)",
    fakeMicDeviceId: randomHex(64),
    fakeMicGroupId: randomHex(64)
  };

  function sendConfig(cfg) {
    try {
      window.dispatchEvent(new CustomEvent("vcam:config", { detail: cfg }));
    } catch (e) {}
  }

  function loadAndSend() {
    try {
      chrome.storage.local.get(DEFAULTS, (stored) => {
        if (chrome.runtime && chrome.runtime.lastError) return sendConfig(DEFAULTS);
        sendConfig(Object.assign({}, DEFAULTS, stored || {}));
      });
    } catch (e) {
      sendConfig(DEFAULTS);
    }
  }

  // The ISOLATED world sees the real labels (not the mask), so we collect
  // them here and stash them for the popup's dropdowns.
  function mergeLabels(storageKey, labels) {
    if (!labels.length) return;
    chrome.storage.local.get({ __availableCameras: [], __availableMics: [] }, (s) => {
      const merged = ((s && s[storageKey]) || []).slice();
      const before = merged.length;
      labels.forEach((l) => {
        if (merged.indexOf(l) < 0) merged.push(l);
      });
      if (merged.length !== before) chrome.storage.local.set({ [storageKey]: merged });
    });
  }

  function reportDevices() {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices || !mediaDevices.enumerateDevices) return;
    mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const cams = [];
        const mics = [];
        devices.forEach((d) => {
          if (d.kind === "videoinput" && d.label) cams.push(d.label);
          if (d.kind === "audioinput" && d.label) mics.push(d.label);
        });
        mergeLabels("__availableCameras", cams);
        mergeLabels("__availableMics", mics);
      })
      .catch(() => {});
  }

  loadAndSend();
  reportDevices();
  try {
    navigator.mediaDevices.addEventListener("devicechange", reportDevices);
  } catch (e) {}

  // The MAIN world asks for the config if it ran before us.
  window.addEventListener("vcam:request-config", loadAndSend);

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") loadAndSend();
    });
  } catch (e) {}
})();
