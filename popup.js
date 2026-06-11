(function () {
  "use strict";

  const randomHex = (len) =>
    Array.from(crypto.getRandomValues(new Uint8Array(len / 2)), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");

  // Fallback config; real ids come from the service worker on install.
  const DEFAULTS = {
    enabled: true,
    targetLabel: "",
    fakeLabel: "Integrated Webcam (1bcf:2b95)",
    fakeDeviceId: randomHex(64),
    fakeGroupId: randomHex(64),
    micMode: "auto",
    targetMicLabel: "",
    fakeMicLabel: "Internal Microphone (1bcf:2b95)",
    fakeMicDeviceId: randomHex(64),
    fakeMicGroupId: randomHex(64)
  };

  function deriveMicLabel(webcamLabel) {
    const m = (webcamLabel || DEFAULTS.fakeLabel).trim().match(/^(.+?)\s*\(([0-9a-f]{4}:[0-9a-f]{4})\)\s*$/i);
    return m ? "Internal Microphone (" + m[2] + ")" : DEFAULTS.fakeMicLabel;
  }

  const $ = (id) => document.getElementById(id);

  const fields = {
    enabled: $("enabled"),
    cameraSelect: $("cameraSelect"),
    fakeLabel: $("fakeLabel"),
    fakeDeviceId: $("fakeDeviceId"),
    fakeGroupId: $("fakeGroupId"),
    micMode: $("micMode"),
    micSelect: $("micSelect"),
    fakeMicLabel: $("fakeMicLabel"),
    fakeMicDeviceId: $("fakeMicDeviceId"),
    fakeMicGroupId: $("fakeMicGroupId")
  };

  const detectBtn = $("detect");
  const statusEl = $("status");
  const micModeHint = $("micModeHint");
  const updateModalText = $("updateModalText");
  const updateModalUpdate = $("updateModalUpdate");
  const updateModalLater = $("updateModalLater");
  const headerUpdate = $("headerUpdate");
  const headerUpdateText = $("headerUpdateText");
  let updateReleaseUrl = "https://github.com/xViada/VCam-Bypass/releases/latest";

  function openReleasePage() {
    if (chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url: updateReleaseUrl });
    else window.open(updateReleaseUrl, "_blank");
  }

  const MIC_HINTS = {
    auto: "Disguises the mic linked to the target camera so sites see a built-in combo.",
    off: "Only the webcam is disguised; microphones keep their real identity.",
    custom: "Pick a specific mic and set its fake label and IDs. Match the camera groupId if a site cross-checks both."
  };

  function showStatus(msg, isError) {
    statusEl.textContent = msg;
    statusEl.style.color = isError ? "#e06c75" : "#6cc070";
    setTimeout(() => {
      statusEl.textContent = "";
    }, 2400);
  }

  function getStoredList(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get({ [key]: [] }, (s) => resolve((s && s[key]) || []));
    });
  }

  function enumerate() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return Promise.resolve([]);
    }
    return navigator.mediaDevices.enumerateDevices().catch(() => []);
  }

  function populateDeviceSelect(selectEl, storageKey, kind, selectedLabel, emptyLabel) {
    return Promise.all([getStoredList(storageKey), enumerate()]).then(([stored, devices]) => {
      const labels = {};
      stored.forEach((l) => {
        if (l) labels[l] = true;
      });
      devices.forEach((d) => {
        if (d.kind === kind && d.label) labels[d.label] = true;
      });

      selectEl.innerHTML = "";
      selectEl.appendChild(new Option(emptyLabel, ""));
      Object.keys(labels).forEach((label) => selectEl.appendChild(new Option(label, label)));

      if (selectedLabel && !labels[selectedLabel]) {
        selectEl.appendChild(new Option(selectedLabel + " (saved)", selectedLabel));
      }

      selectEl.value = selectedLabel || "";
      return Object.keys(labels).length;
    });
  }

  function populateCameras(selectedLabel) {
    return populateDeviceSelect(
      fields.cameraSelect,
      "__availableCameras",
      "videoinput",
      selectedLabel,
      "Auto (detect virtual cameras)"
    ).then((count) => {
      detectBtn.textContent = count ? "Detect more devices" : "Detect devices (grant permission)";
    });
  }

  function populateMics(selectedLabel) {
    return populateDeviceSelect(
      fields.micSelect,
      "__availableMics",
      "audioinput",
      selectedLabel,
      "Select a microphone"
    );
  }

  function updateMicModeUi() {
    const mode = fields.micMode.value || "auto";
    document.body.classList.toggle("mic-custom-visible", mode === "custom");
    micModeHint.textContent = MIC_HINTS[mode] || MIC_HINTS.auto;
  }

  function dismissUpdateModal() {
    chrome.storage.local.get({ __updateCheck: null }, (stored) => {
      const latest = stored.__updateCheck && stored.__updateCheck.latestVersion;
      document.body.classList.remove("update-modal-open");
      if (latest) chrome.storage.local.set({ __updateBannerDismissed: latest });
    });
  }

  function applyUpdateModal(updateCheck, dismissedVersion) {
    const info = updateCheck || {};
    const available = !!info.updateAvailable && !!info.latestVersion;
    const modalOpen = available && info.latestVersion !== dismissedVersion;

    document.body.classList.toggle("update-available", available);
    document.body.classList.toggle("update-modal-open", modalOpen);

    if (!available) return;

    updateModalText.innerHTML =
      "A <b>new version</b> of VCam Bypass is ready. Update now to get the latest improvements and fixes.";
    headerUpdateText.textContent = "New update available";
    updateReleaseUrl =
      info.releaseUrl || "https://github.com/xViada/VCam-Bypass/releases/latest";
  }

  function loadUpdateModal() {
    chrome.storage.local.get(
      { __updateCheck: null, __updateBannerDismissed: "" },
      (stored) => {
        applyUpdateModal(stored.__updateCheck, stored.__updateBannerDismissed || "");
      }
    );
  }

  function applyToForm(cfg) {
    fields.enabled.checked = !!cfg.enabled;
    fields.fakeLabel.value = cfg.fakeLabel || "";
    fields.fakeDeviceId.value = cfg.fakeDeviceId || "";
    fields.fakeGroupId.value = cfg.fakeGroupId || "";
    fields.micMode.value = cfg.micMode || "auto";
    fields.fakeMicLabel.value = cfg.fakeMicLabel || "";
    fields.fakeMicDeviceId.value = cfg.fakeMicDeviceId || "";
    fields.fakeMicGroupId.value = cfg.fakeMicGroupId || "";
    populateCameras(cfg.targetLabel || "");
    populateMics(cfg.targetMicLabel || "");
    updateMicModeUi();
  }

  function readForm() {
    return {
      enabled: fields.enabled.checked,
      targetLabel: fields.cameraSelect.value || "",
      fakeLabel: fields.fakeLabel.value.trim() || DEFAULTS.fakeLabel,
      fakeDeviceId: fields.fakeDeviceId.value.trim() || DEFAULTS.fakeDeviceId,
      fakeGroupId: fields.fakeGroupId.value.trim() || DEFAULTS.fakeGroupId,
      micMode: fields.micMode.value || "auto",
      targetMicLabel: fields.micSelect.value || "",
      fakeMicLabel: fields.fakeMicLabel.value.trim() || deriveMicLabel(fields.fakeLabel.value),
      fakeMicDeviceId: fields.fakeMicDeviceId.value.trim() || DEFAULTS.fakeMicDeviceId,
      fakeMicGroupId: fields.fakeMicGroupId.value.trim() || DEFAULTS.fakeMicGroupId
    };
  }

  chrome.storage.local.get(DEFAULTS, (stored) => {
    applyToForm(Object.assign({}, DEFAULTS, stored || {}));
  });

  loadUpdateModal();

  updateModalUpdate.addEventListener("click", () => {
    openReleasePage();
    dismissUpdateModal();
  });

  headerUpdate.addEventListener("click", (e) => {
    e.preventDefault();
    openReleasePage();
  });

  updateModalLater.addEventListener("click", dismissUpdateModal);

  detectBtn.addEventListener("click", () => {
    const url = chrome.runtime.getURL("request.html");
    if (chrome.tabs && chrome.tabs.create) chrome.tabs.create({ url });
    else window.open(url, "_blank");
    showStatus("Grant permission in the opened tab, then come back here.");
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.__availableCameras) populateCameras(fields.cameraSelect.value);
    if (changes.__availableMics) populateMics(fields.micSelect.value);
    if (changes.__updateCheck || changes.__updateBannerDismissed) {
      chrome.storage.local.get(
        { __updateCheck: null, __updateBannerDismissed: "" },
        (stored) => {
          applyUpdateModal(stored.__updateCheck, stored.__updateBannerDismissed || "");
        }
      );
    }
  });

  fields.enabled.addEventListener("change", () => {
    chrome.storage.local.set({ enabled: fields.enabled.checked });
  });

  fields.micMode.addEventListener("change", updateMicModeUi);

  const advancedToggle = $("advancedToggle");
  advancedToggle.addEventListener("click", () => {
    const visible = document.body.classList.toggle("advanced-ids-visible");
    advancedToggle.setAttribute("aria-expanded", String(visible));
  });

  const advancedMicToggle = $("advancedMicToggle");
  advancedMicToggle.addEventListener("click", () => {
    const visible = document.body.classList.toggle("advanced-mic-ids-visible");
    advancedMicToggle.setAttribute("aria-expanded", String(visible));
  });

  $("save").addEventListener("click", () => {
    chrome.storage.local.set(readForm(), () => showStatus("Saved. Reload the page to apply."));
  });

  function pickName() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "randomizeName" }, (resp) => {
        resolve((!chrome.runtime.lastError && resp && resp.name) || DEFAULTS.fakeLabel);
      });
    });
  }

  $("newCamIdentity").addEventListener("click", () => {
    pickName().then((name) => {
      fields.fakeLabel.value = name;
      fields.fakeDeviceId.value = randomHex(64);
      fields.fakeGroupId.value = randomHex(64);
      showStatus("New camera identity. Save to apply.");
    });
  });

  $("newMicIdentity").addEventListener("click", () => {
    pickName().then((name) => {
      fields.fakeMicLabel.value = deriveMicLabel(name);
      fields.fakeMicDeviceId.value = randomHex(64);
      fields.fakeMicGroupId.value = randomHex(64);
      showStatus("New mic identity. Save to apply.");
    });
  });
})();
