(function () {
  "use strict";

  function randomHex(len) {
    var bytes = new Uint8Array(len / 2);
    crypto.getRandomValues(bytes);
    var out = "";
    for (var i = 0; i < bytes.length; i++) {
      out += bytes[i].toString(16).padStart(2, "0");
    }
    return out;
  }

  // The final deviceId/groupId are persisted by the service worker on install.
  // These are just a random fallback in case storage does not have them yet.
  var DEFAULTS = {
    enabled: true,
    targetLabel: "",
    fakeLabel: "Integrated Webcam (1bcf:2b95)",
    fakeDeviceId: randomHex(64),
    fakeGroupId: randomHex(64)
  };

  function sendConfig(cfg) {
    try {
      window.dispatchEvent(new CustomEvent("vcam:config", { detail: cfg }));
    } catch (e) {}
  }

  function loadAndSend() {
    try {
      chrome.storage.local.get(DEFAULTS, function (stored) {
        if (chrome.runtime && chrome.runtime.lastError) {
          sendConfig(DEFAULTS);
          return;
        }
        sendConfig(Object.assign({}, DEFAULTS, stored || {}));
      });
    } catch (e) {
      sendConfig(DEFAULTS);
    }
  }

  // Collects the real webcam names visible on this page (where camera permission
  // has already been granted) and accumulates them in storage so the popup can
  // offer them in the dropdown. It uses the ISOLATED world's native navigator,
  // so it sees the real labels (not the disguise from inject.js).
  function reportCameras() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return;
    }
    navigator.mediaDevices
      .enumerateDevices()
      .then(function (devices) {
        var cams = [];
        devices.forEach(function (d) {
          if (d.kind === "videoinput" && d.label) cams.push(d.label);
        });
        if (!cams.length) return;
        chrome.storage.local.get({ __availableCameras: [] }, function (s) {
          var merged = ((s && s.__availableCameras) || []).slice();
          var changed = false;
          cams.forEach(function (c) {
            if (merged.indexOf(c) < 0) {
              merged.push(c);
              changed = true;
            }
          });
          if (changed) chrome.storage.local.set({ __availableCameras: merged });
        });
      })
      .catch(function () {});
  }

  // Send the config as soon as the bridge loads.
  loadAndSend();
  reportCameras();
  try {
    navigator.mediaDevices.addEventListener("devicechange", reportCameras);
  } catch (e) {}

  // The MAIN world can request the config if it started before the bridge.
  window.addEventListener("vcam:request-config", loadAndSend);

  // Re-send the config whenever it changes from the popup.
  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === "local") loadAndSend();
    });
  } catch (e) {}
})();
