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
    cameraProfile: "generic",
    cameraCaps: null,
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

  const profilesApi = (typeof self !== "undefined" && self.__vcamProfiles) || null;

  const CONTROL_KEYS = [
    ["brightness", "Brightness"],
    ["contrast", "Contrast"],
    ["saturation", "Saturation"],
    ["sharpness", "Sharpness"],
    ["colorTemperature", "Color temp."],
    ["exposureTime", "Exposure time"]
  ];

  function populateCameraProfiles(selected) {
    const sel = $("cameraProfile");
    if (!sel) return;
    const list = profilesApi ? profilesApi.list() : [];
    sel.innerHTML = "";
    list.forEach((p) => sel.appendChild(new Option(p.name, p.id)));
    if (selected === "custom") ensureCustomOption();
    sel.value = selected || "generic";
    if (sel.value !== (selected || "generic")) sel.value = "generic";
  }

  function ensureCustomOption() {
    const sel = $("cameraProfile");
    const has = Array.prototype.some.call(sel.options, (o) => o.value === "custom");
    if (!has) sel.appendChild(new Option("Custom (edited)", "custom"));
  }

  // ----- Capabilities editor -----
  const capControlInputs = {};

  function buildControlInputs() {
    const host = $("capControls");
    if (!host || host.__built) return;
    CONTROL_KEYS.forEach((entry) => {
      const wrap = document.createElement("div");
      wrap.className = "cap-ctrl";
      const lab = document.createElement("label");
      lab.textContent = entry[1];
      wrap.appendChild(lab);
      const grid = document.createElement("div");
      grid.className = "cap-ctrl-fields";
      const ins = {};
      ["min", "max", "step", "def"].forEach((part) => {
        const inp = document.createElement("input");
        inp.type = "number";
        inp.placeholder = part;
        grid.appendChild(inp);
        ins[part] = inp;
      });
      wrap.appendChild(grid);
      host.appendChild(wrap);
      capControlInputs[entry[0]] = ins;
    });
    host.__built = true;
  }

  const capFields = {};
  function capRefs() {
    capFields.facing = $("capFacing");
    capFields.maxWidth = $("capMaxWidth");
    capFields.maxHeight = $("capMaxHeight");
    capFields.maxFrameRate = $("capMaxFrameRate");
    capFields.wbManual = $("capWbManual");
    capFields.expManual = $("capExpManual");
    capFields.autofocus = $("capAutofocus");
    capFields.focusMin = $("capFocusMin");
    capFields.focusMax = $("capFocusMax");
    capFields.focusStep = $("capFocusStep");
    capFields.focusDef = $("capFocusDef");
  }

  let suppressDirty = false;

  function updateFocusVisibility() {
    document.body.classList.toggle("cap-autofocus-visible", !!capFields.autofocus.checked);
  }

  function setQuad(inputs, arr) {
    arr = arr || [0, 0, 0, 0];
    inputs.min.value = arr[0];
    inputs.max.value = arr[1];
    inputs.step.value = arr[2];
    inputs.def.value = arr[3];
  }

  // Loads a profile shape (a preset or a stored custom caps object) into the
  // editor without flagging it as a manual edit.
  function fillCapsForm(p) {
    if (!p) return;
    suppressDirty = true;
    capFields.facing.value = p.facing || "";
    capFields.maxWidth.value = p.maxWidth != null ? p.maxWidth : "";
    capFields.maxHeight.value = p.maxHeight != null ? p.maxHeight : "";
    capFields.maxFrameRate.value = p.maxFrameRate != null ? p.maxFrameRate : "";
    capFields.wbManual.checked = (p.whiteBalanceMode || []).indexOf("manual") >= 0;
    capFields.expManual.checked = (p.exposureMode || []).indexOf("manual") >= 0;
    capFields.autofocus.checked = !!p.focusMode;
    setQuad(
      { min: capFields.focusMin, max: capFields.focusMax, step: capFields.focusStep, def: capFields.focusDef },
      p.focusDistance || [0, 250, 5, 0]
    );
    const c = p.controls || {};
    CONTROL_KEYS.forEach((entry) => setQuad(capControlInputs[entry[0]], c[entry[0]]));
    updateFocusVisibility();
    suppressDirty = false;
  }

  // Keeps a [min, max, step, default] range coherent: min <= max, step >= 0,
  // and default inside [min, max]. An out-of-range value would otherwise be a
  // detectable inconsistency between getSettings() and getCapabilities().
  function clampQuad(min, max, step, def) {
    if (max < min) max = min;
    if (step < 0) step = 0;
    def = Math.min(max, Math.max(min, def));
    return [min, max, step, def];
  }

  function quad(inputs) {
    return clampQuad(
      Number(inputs.min.value) || 0,
      Number(inputs.max.value) || 0,
      Number(inputs.step.value) || 0,
      Number(inputs.def.value) || 0
    );
  }

  // Reads the editor into a full profile shape consumable by profiles.js.
  function collectCaps() {
    const caps = {
      facing: capFields.facing.value || "",
      maxWidth: Math.max(1, Number(capFields.maxWidth.value) || 1280),
      maxHeight: Math.max(1, Number(capFields.maxHeight.value) || 720),
      maxFrameRate: Math.max(1, Number(capFields.maxFrameRate.value) || 30),
      whiteBalanceMode: capFields.wbManual.checked ? ["continuous", "manual"] : ["continuous"],
      exposureMode: capFields.expManual.checked ? ["continuous", "manual"] : ["continuous"],
      controls: {}
    };
    if (capFields.autofocus.checked) {
      caps.focusMode = ["continuous", "manual"];
      caps.focusDistance = clampQuad(
        Number(capFields.focusMin.value) || 0,
        Number(capFields.focusMax.value) || 0,
        Number(capFields.focusStep.value) || 0,
        Number(capFields.focusDef.value) || 0
      );
    }
    CONTROL_KEYS.forEach((entry) => {
      caps.controls[entry[0]] = quad(capControlInputs[entry[0]]);
    });
    return caps;
  }

  function markCustom() {
    if (suppressDirty) return;
    ensureCustomOption();
    $("cameraProfile").value = "custom";
  }

  function bindCapDirty() {
    const els = [
      capFields.facing,
      capFields.maxWidth,
      capFields.maxHeight,
      capFields.maxFrameRate,
      capFields.wbManual,
      capFields.expManual,
      capFields.focusMin,
      capFields.focusMax,
      capFields.focusStep,
      capFields.focusDef
    ];
    CONTROL_KEYS.forEach((entry) => {
      const ins = capControlInputs[entry[0]];
      els.push(ins.min, ins.max, ins.step, ins.def);
    });
    els.forEach((el) => {
      el.addEventListener("input", markCustom);
      el.addEventListener("change", markCustom);
    });
    capFields.autofocus.addEventListener("change", () => {
      updateFocusVisibility();
      markCustom();
    });
  }

  // The profile shape for a given preset id, falling back to the generic webcam.
  function profileShape(id) {
    return profilesApi ? profilesApi.resolve(id) : null;
  }

  // Selecting a model presets the name and loads its full capability set.
  function applyModelToForm(id) {
    const p = profileShape(id);
    if (!p) return;
    if (p.label) fields.fakeLabel.value = p.label;
    fillCapsForm(p);
  }

  const fields = {
    enabled: $("enabled"),
    cameraSelect: $("cameraSelect"),
    cameraProfile: $("cameraProfile"),
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
    auto: "Masks the mic linked to the target camera so sites see a built-in combo.",
    off: "Only the webcam is masked; microphones keep their real identity.",
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
    if (cfg.cameraCaps && typeof cfg.cameraCaps === "object") {
      populateCameraProfiles("custom");
      fillCapsForm(cfg.cameraCaps);
    } else {
      populateCameraProfiles(cfg.cameraProfile || "generic");
      fillCapsForm(profileShape(cfg.cameraProfile || "generic"));
    }
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
      cameraProfile: fields.cameraProfile.value || "generic",
      cameraCaps: (fields.cameraProfile.value || "generic") === "custom" ? collectCaps() : null,
      micMode: fields.micMode.value || "auto",
      targetMicLabel: fields.micSelect.value || "",
      fakeMicLabel: fields.fakeMicLabel.value.trim() || deriveMicLabel(fields.fakeLabel.value),
      fakeMicDeviceId: fields.fakeMicDeviceId.value.trim() || DEFAULTS.fakeMicDeviceId,
      fakeMicGroupId: fields.fakeMicGroupId.value.trim() || DEFAULTS.fakeMicGroupId
    };
  }

  capRefs();
  buildControlInputs();
  bindCapDirty();

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

  // Picking a model presets the name and loads its full capability set, so
  // label and capabilities stay coherent. "Custom" keeps the edited values.
  fields.cameraProfile.addEventListener("change", () => {
    const v = fields.cameraProfile.value;
    if (v !== "custom") applyModelToForm(v);
  });

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
    const data = readForm();
    // Reflect any clamped capability values back into the editor.
    if (data.cameraCaps) fillCapsForm(data.cameraCaps);
    chrome.storage.local.set(data, () => showStatus("Saved. Reload the page to apply."));
  });

  function pickName() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "randomizeName" }, (resp) => {
        resolve((!chrome.runtime.lastError && resp && resp.name) || DEFAULTS.fakeLabel);
      });
    });
  }

  function pickCameraIdentity() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "newCameraIdentity" }, (resp) => {
        if (!chrome.runtime.lastError && resp && resp.name) {
          resolve({ name: resp.name, profile: resp.profile || "generic" });
        } else {
          resolve({ name: DEFAULTS.fakeLabel, profile: "generic" });
        }
      });
    });
  }

  $("newCamIdentity").addEventListener("click", () => {
    pickCameraIdentity().then((id) => {
      fields.fakeLabel.value = id.name;
      fields.fakeDeviceId.value = randomHex(64);
      fields.fakeGroupId.value = randomHex(64);
      populateCameraProfiles(id.profile);
      applyModelToForm(id.profile);
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
