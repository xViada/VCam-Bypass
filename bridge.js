/*
 * Copyright (C) 2026 xViada <https://github.com/xViada>
 * Based on VCam Bypass by xViada — https://github.com/xViada/VCam-Bypass
 * Licensed under the GNU GPL version 3. See LICENSE and ADDITIONAL-TERMS.md.
 */

(function () {
  "use strict";

  // shared.js runs just before us in the same content-script entry, so its
  // global is available here. The ISOLATED world is invisible to the page,
  // unlike the MAIN world inject.js lives in.
  const S = self.__vcamShared;

  // Fallback only; the stable deviceId/groupId are persisted on install.
  const DEFAULTS = S.createDefaults();

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
        S.mergeDeviceLabels("__availableCameras", cams);
        S.mergeDeviceLabels("__availableMics", mics);
      })
      .catch(() => {});
  }

  // Content scripts never run on our own pages, so being on one means
  // test.html loaded this file next to inject.js, in the same world: the
  // labels it would see there are the masked ones, not the real ones.
  let onOwnPage = false;
  try {
    onOwnPage = location.href.indexOf(chrome.runtime.getURL("")) === 0;
  } catch (e) {}

  loadAndSend();
  if (!onOwnPage) {
    reportDevices();
    try {
      navigator.mediaDevices.addEventListener("devicechange", reportDevices);
    } catch (e) {}
  }

  // The MAIN world asks for the config if it ran before us.
  window.addEventListener("vcam:request-config", loadAndSend);

  // Only keys that affect the mask; changes to anything else (device lists,
  // update-check metadata) shouldn't trigger a re-send.
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && Object.keys(changes).some((k) => S.CONFIG_KEYS.has(k))) {
        loadAndSend();
      }
    });
  } catch (e) {}
})();
