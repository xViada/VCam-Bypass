/*
 * Copyright (C) 2026 xViada <https://github.com/xViada>
 * Based on VCam Bypass by xViada — https://github.com/xViada/VCam-Bypass
 * Licensed under the GNU GPL version 3. See LICENSE and ADDITIONAL-TERMS.md.
 */

"use strict";

importScripts("shared.js", "profiles.js");

const { randomHex, isNewerVersion, DEFAULT_FAKE_LABEL } = self.__vcamShared;

// Fills only the missing identity fields so values stay stable across sessions.
function ensureDefaults() {
  chrome.storage.local.get(
    [
      "fakeDeviceId",
      "fakeGroupId",
      "fakeLabel",
      "cameraProfile",
      "fakeMicDeviceId",
      "fakeMicGroupId"
    ],
    (stored) => {
      const patch = {};
      if (!stored || !stored.fakeDeviceId) patch.fakeDeviceId = randomHex(64);
      if (!stored || !stored.fakeGroupId) patch.fakeGroupId = randomHex(64);
      if (!stored || !stored.fakeMicDeviceId) patch.fakeMicDeviceId = randomHex(64);
      if (!stored || !stored.fakeMicGroupId) patch.fakeMicGroupId = randomHex(64);
      if (!stored || !stored.cameraProfile || stored.cameraProfile === "auto") {
        const p = self.__vcamProfiles.pickRandom();
        patch.cameraProfile = p.id;
        if (p.label && (!stored || !stored.fakeLabel)) {
          patch.fakeLabel = p.label;
        }
      }

      if ((!stored || !stored.fakeLabel) && !patch.fakeLabel) {
        patch.fakeLabel = DEFAULT_FAKE_LABEL;
      }

      if (Object.keys(patch).length) chrome.storage.local.set(patch);
      chrome.storage.local.remove("__webcamNames");
    }
  );
}

const GITHUB_REPO = "xViada/VCam-Bypass";
const RELEASES_API = "https://api.github.com/repos/" + GITHUB_REPO + "/releases/latest";

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
    .catch(() => {
      // Keep the last known result, but only while it is still ahead of the
      // running version: after an update it would flag the installed release.
      chrome.storage.local.get({ __updateCheck: null }, (s) => {
        const info = s && s.__updateCheck;
        setUpdateBadge(!!info && isNewerVersion(info.latestVersion, current));
      });
    });
}

function onBoot() {
  ensureDefaults();
  checkForUpdate();
}

chrome.runtime.onInstalled.addListener(onBoot);
chrome.runtime.onStartup.addListener(onBoot);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "newCameraIdentity") {
    const p = self.__vcamProfiles.pickRandom();
    sendResponse({ name: p.label || DEFAULT_FAKE_LABEL, profile: p.id });
    return false;
  }
});
