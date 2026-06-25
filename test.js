(function () {
  "use strict";

  const S = self.__vcamShared;
  const CONFIG_KEYS = S.CONFIG_KEYS;
  const DEFAULTS = S.createDefaults();

  const $ = (id) => document.getElementById(id);

  const els = {
    verdict: $("verdict"),
    verdictIcon: $("verdictIcon"),
    verdictTitle: $("verdictTitle"),
    verdictText: $("verdictText"),
    camPick: $("camPick"),
    grant: $("grant"),
    preview: $("preview"),
    report: $("report"),
    deviceList: $("deviceList")
  };

  // SVG status icons drawn inside the round badge.
  const VERDICT_ICONS = {
    ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    err: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    pending: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>'
  };

  // Image controls a real webcam exposes through getCapabilities(); a bare
  // virtual camera exposes none of them, which is the usual giveaway.
  const CONTROL_KEYS = [
    "brightness",
    "contrast",
    "saturation",
    "sharpness",
    "colorTemperature",
    "exposureTime",
    "exposureMode",
    "whiteBalanceMode",
    "focusMode",
    "focusDistance"
  ];

  let activeStream = null;

  function getConfig() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(DEFAULTS, (s) => resolve(Object.assign({}, DEFAULTS, s || {})));
      } catch (e) {
        resolve(Object.assign({}, DEFAULTS));
      }
    });
  }

  function setVerdict(kind, title, text) {
    const k = kind || "pending";
    els.verdict.className = "card verdict" + (kind ? " " + kind : "");
    els.verdictIcon.className = "v-icon" + (k === "pending" ? " spin" : "");
    els.verdictIcon.innerHTML = VERDICT_ICONS[k] || VERDICT_ICONS.pending;
    els.verdictTitle.textContent = title;
    els.verdictText.textContent = text;
  }

  function kv(label, value, state) {
    const div = document.createElement("div");
    div.className = "kv";
    const k = document.createElement("span");
    k.className = "k";
    k.textContent = label;
    const v = document.createElement("span");
    v.className = "v" + (state ? " " + state : "");
    v.textContent = value;
    div.appendChild(k);
    div.appendChild(v);
    return div;
  }

  function stopStream() {
    if (activeStream) {
      try {
        activeStream.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      activeStream = null;
    }
  }

  function enumerate() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return Promise.resolve([]);
    }
    return navigator.mediaDevices.enumerateDevices().catch(() => []);
  }

  function refreshDevices(cfg, preselect) {
    return enumerate().then((devices) => {
      const cams = devices.filter((d) => d.kind === "videoinput" && d.deviceId);
      const prev = els.camPick.value;

      els.camPick.innerHTML = "";
      cams.forEach((d) => els.camPick.appendChild(new Option(d.label || "Camera", d.deviceId)));

      if (preselect) {
        // Prefer the masked camera, then keep the previous pick, else first.
        const fakeCam = cfg.fakeLabel && cams.find((d) => d.label === cfg.fakeLabel);
        if (fakeCam) els.camPick.value = fakeCam.deviceId;
        else if (prev && cams.some((d) => d.deviceId === prev)) els.camPick.value = prev;
        else if (cams.length) els.camPick.value = cams[0].deviceId;
      } else if (prev && cams.some((d) => d.deviceId === prev)) {
        els.camPick.value = prev;
      }

      renderDeviceList(cams, cfg);
      return cams;
    });
  }

  function renderDeviceList(cams, cfg) {
    els.deviceList.innerHTML = "";
    if (!cams.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "No cameras detected. Make sure your virtual camera app is running, then refresh.";
      els.deviceList.appendChild(p);
      return;
    }
    cams.forEach((d) => {
      const isFake = cfg.fakeLabel && d.label === cfg.fakeLabel;
      els.deviceList.appendChild(
        kv(d.label || "(no label)", "id " + shortId(d.deviceId), isFake ? "good" : "muted")
      );
    });
  }

  function shortId(id) {
    if (!id) return "(none)";
    if (id === "default" || id === "communications") return id;
    return id.length > 16 ? id.slice(0, 8) + "\u2026" + id.slice(-6) : id;
  }

  function listControls(caps) {
    return CONTROL_KEYS.filter((k) => caps && caps[k] != null);
  }

  function runTest() {
    return getConfig().then((cfg) => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setVerdict("err", "Not supported", "This browser does not expose camera access.");
        return;
      }
      const chosen = els.camPick.value;
      if (!chosen) {
        setVerdict(
          "warn",
          "No camera available",
          "No cameras were detected. Make sure your virtual camera app is running, then refresh."
        );
        return;
      }

      stopStream();
      setVerdict("", "Opening camera...", "Allow access if your browser asks.");

      return navigator.mediaDevices
        .getUserMedia({ video: { deviceId: { exact: chosen } }, audio: false })
        .then((stream) => {
          activeStream = stream;
          els.preview.srcObject = stream;

          const track = stream.getVideoTracks()[0];
          const settings = track && track.getSettings ? track.getSettings() : {};
          const caps = track && track.getCapabilities ? track.getCapabilities() : {};
          const label = track ? track.label : "";

          renderReport(label, settings, caps);
          return refreshDevices(cfg, false).then(() => judge(cfg, label, caps));
        })
        .catch((e) => {
          setVerdict(
            "err",
            "Camera could not be opened",
            "Permission was denied or the device is unavailable (" + (e && e.name ? e.name : "error") + ")."
          );
        });
    });
  }

  function renderReport(label, settings, caps) {
    els.report.innerHTML = "";
    els.report.appendChild(kv("label", label || "(empty)"));
    els.report.appendChild(kv("deviceId", shortId(settings.deviceId)));
    els.report.appendChild(kv("groupId", shortId(settings.groupId)));
    els.report.appendChild(
      kv(
        "resolution",
        (settings.width || "?") + " \u00d7 " + (settings.height || "?") + " @ " + (Math.round(settings.frameRate) || "?") + "fps"
      )
    );
    els.report.appendChild(kv("facingMode", settings.facingMode || "(none)"));

    const controls = listControls(caps);
    els.report.appendChild(
      kv(
        "image controls",
        controls.length ? controls.length + " exposed" : "none",
        controls.length ? "good" : "bad"
      )
    );
    if (controls.length) {
      els.report.appendChild(kv("\u2937 which", controls.join(", "), "muted"));
    }
  }

  // Combines the saved config with the live reading to give a clear verdict.
  function judge(cfg, label, caps) {
    const controls = listControls(caps);

    if (!cfg.enabled) {
      setVerdict(
        "warn",
        "Mask is OFF",
        "The extension is disabled, so the site sees your real device. Enable it in the popup and pick a target webcam."
      );
      return;
    }
    if (!cfg.targetLabel) {
      setVerdict(
        "warn",
        "No target webcam selected",
        "Mask is enabled but no webcam is selected, so nothing is being rewritten. Pick a target in the popup."
      );
      return;
    }

    const looksFaked = cfg.fakeLabel && label === cfg.fakeLabel;
    if (looksFaked && controls.length) {
      setVerdict(
        "ok",
        "Mask is working",
        'The site sees "' + label + '" with a full physical-webcam capability set (' + controls.length + " controls). This camera looks real."
      );
      return;
    }
    if (looksFaked) {
      setVerdict(
        "warn",
        "Identity masked, but no capabilities",
        'The name is masked as "' + label + '", but no image controls are exposed. Pick an emulated model in the popup.'
      );
      return;
    }

    setVerdict(
      "warn",
      "This camera isn't the masked one",
      'The active camera reports "' + (label || "(empty)") + '". Select your masked camera (it appears as "' + (cfg.fakeLabel || "the fake name") + '") above and run the test again.'
    );
  }

  function grantAndList() {
    setVerdict("", "Requesting access...", "Allow camera and microphone access so device names are visible.");
    return getConfig().then((cfg) =>
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          stream.getTracks().forEach((t) => t.stop());
          return refreshDevices(cfg, true);
        })
        .then((cams) => {
          if (cams && cams.length) return runTest();
          setVerdict(
            "warn",
            "No camera available",
            "No cameras were detected. Make sure your virtual camera app is running, then refresh."
          );
        })
        .catch((e) => {
          setVerdict(
            "err",
            "Access not granted",
            "Camera/mic permission is required to test (" + (e && e.name ? e.name : "error") + ")."
          );
        })
    );
  }

  function init() {
    els.camPick.addEventListener("change", () => runTest());
    els.grant.addEventListener("click", () => grantAndList());
    grantAndList();

    try {
      navigator.mediaDevices.addEventListener("devicechange", () => {
        getConfig().then((cfg) => refreshDevices(cfg, false));
      });
    } catch (e) {}

    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && Object.keys(changes).some((k) => CONFIG_KEYS.has(k))) {
          getConfig().then((cfg) => refreshDevices(cfg, false));
        }
      });
    } catch (e) {}
  }

  window.addEventListener("beforeunload", stopStream);
  init();
})();
