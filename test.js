/*
 * Copyright (C) 2026 xViada <https://github.com/xViada>
 * Based on VCam Bypass by xViada — https://github.com/xViada/VCam-Bypass
 * Licensed under the GNU GPL version 3. See LICENSE and ADDITIONAL-TERMS.md.
 */

(function () {
  "use strict";

  const S = self.__vcamShared;
  const CONFIG_KEYS = S.CONFIG_KEYS;
  const DEFAULTS = S.createDefaults();

  const $ = (id) => document.getElementById(id);

  const camV = {
    el: $("camVerdict"),
    title: $("camVerdictTitle"),
    text: $("camVerdictText")
  };
  const micV = {
    el: $("micVerdict"),
    title: $("micVerdictTitle"),
    text: $("micVerdictText")
  };
  const els = {
    camPick: $("camPick"),
    micPick: $("micPick"),
    grant: $("grant"),
    preview: $("preview"),
    camReport: $("camReport"),
    micReport: $("micReport"),
    meterWrap: $("meterWrap"),
    audioCanvas: $("audioCanvas"),
    audioLevel: $("audioLevel"),
    audioLabel: $("audioLabel"),
    deviceList: $("deviceList")
  };

  // Image controls a real webcam exposes through getCapabilities().
  const CAM_CONTROL_KEYS = [
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

  let camStream = null;
  let micStream = null;
  let audioCtx = null;
  let analyser = null;
  let rafId = null;
  let meterResize = null;

  function getConfig() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(DEFAULTS, (s) => resolve(Object.assign({}, DEFAULTS, s || {})));
      } catch (e) {
        resolve(Object.assign({}, DEFAULTS));
      }
    });
  }

  // ---- Verdict helpers ----

  function setVerdict(v, kind, title, text) {
    v.el.className = "status-line" + (kind ? " " + kind : " pending");
    v.title.textContent = title;
    v.text.textContent = text || "";
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

  function shortId(id) {
    if (!id) return "(none)";
    if (id === "default" || id === "communications") return id;
    return id.length > 16 ? id.slice(0, 8) + "\u2026" + id.slice(-6) : id;
  }

  // ---- Stream management ----

  function stopCamStream() {
    if (camStream) {
      try { camStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      camStream = null;
    }
    els.preview.srcObject = null;
  }

  function stopMicStream() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (meterResize) { window.removeEventListener("resize", meterResize); meterResize = null; }
    if (micStream) {
      try { micStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      micStream = null;
    }
    if (audioCtx) {
      try { audioCtx.close(); } catch (e) {}
      audioCtx = null;
      analyser = null;
    }
    const cv = els.audioCanvas;
    const ctx = cv && cv.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
    els.audioLevel.textContent = "\u2014";
    els.meterWrap.classList.remove("active");
  }

  function enumerate() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return Promise.resolve([]);
    }
    return navigator.mediaDevices.enumerateDevices().catch(function () { return []; });
  }

  // ---- Expected mic label (what inject.js presents) ----

  function computeExpectedMicLabel(cfg) {
    const mode = (cfg.micMode || "off").toLowerCase();
    if (mode === "auto") return S.linkedMicLabel(cfg.fakeLabel);
    if (mode === "custom") return (cfg.fakeMicLabel || "").trim() || S.deriveMicLabel(cfg.fakeLabel);
    return null;
  }

  // ---- Device list ----

  function refreshDevices(cfg, preselect) {
    return enumerate().then(function (devices) {
      const cams = devices.filter(function (d) { return d.kind === "videoinput" && d.deviceId; });
      const mics = devices.filter(function (d) { return d.kind === "audioinput" && d.deviceId; });

      // Camera dropdown
      const prevCam = els.camPick.value;
      els.camPick.innerHTML = "";
      cams.forEach(function (d) {
        els.camPick.appendChild(new Option(d.label || "Camera", d.deviceId));
      });

      if (preselect) {
        const fakeCam = cfg.fakeLabel && cams.find(function (d) { return d.label === cfg.fakeLabel; });
        if (fakeCam) els.camPick.value = fakeCam.deviceId;
        else if (prevCam && cams.some(function (d) { return d.deviceId === prevCam; })) els.camPick.value = prevCam;
        else if (cams.length) els.camPick.value = cams[0].deviceId;
      } else if (prevCam && cams.some(function (d) { return d.deviceId === prevCam; })) {
        els.camPick.value = prevCam;
      }

      // Mic dropdown (filter out default/communications pseudo-entries)
      const prevMic = els.micPick.value;
      els.micPick.innerHTML = "";
      const realMics = mics.filter(function (d) {
        return d.deviceId !== "default" && d.deviceId !== "communications";
      });
      realMics.forEach(function (d) {
        els.micPick.appendChild(new Option(d.label || "Microphone", d.deviceId));
      });

      if (preselect) {
        const expectedLabel = computeExpectedMicLabel(cfg);
        const fakeMic = expectedLabel && realMics.find(function (d) { return d.label === expectedLabel; });
        const fakeMic2 = !fakeMic && cfg.fakeMicLabel && realMics.find(function (d) { return d.label === cfg.fakeMicLabel; });
        if (fakeMic) els.micPick.value = fakeMic.deviceId;
        else if (fakeMic2) els.micPick.value = fakeMic2.deviceId;
        else if (prevMic && realMics.some(function (d) { return d.deviceId === prevMic; })) els.micPick.value = prevMic;
        else if (realMics.length) els.micPick.value = realMics[0].deviceId;
      } else if (prevMic && realMics.some(function (d) { return d.deviceId === prevMic; })) {
        els.micPick.value = prevMic;
      }

      renderDeviceList(cams, mics, cfg);
      return { cams: cams, mics: realMics };
    });
  }

  function renderDeviceList(cams, mics, cfg) {
    els.deviceList.innerHTML = "";

    if (!cams.length && !mics.length) {
      const p = document.createElement("p");
      p.className = "empty";
      p.textContent = "No devices detected. Make sure your apps are running, then refresh.";
      els.deviceList.appendChild(p);
      return;
    }

    const expectedMicLabel = computeExpectedMicLabel(cfg);

    if (cams.length) {
      const hCam = document.createElement("p");
      hCam.className = "dl-section";
      hCam.textContent = "Cameras (" + cams.length + ")";
      els.deviceList.appendChild(hCam);
      cams.forEach(function (d) {
        const isFake = cfg.fakeLabel && d.label === cfg.fakeLabel;
        els.deviceList.appendChild(
          kv(d.label || "(no label)", "id " + shortId(d.deviceId), isFake ? "good" : "muted")
        );
      });
    }

    if (mics.length) {
      const hMic = document.createElement("p");
      hMic.className = "dl-section";
      hMic.textContent = "Microphones (" + mics.length + ")";
      els.deviceList.appendChild(hMic);
      mics.forEach(function (d) {
        const isFake =
          (expectedMicLabel && d.label === expectedMicLabel) ||
          (cfg.fakeMicLabel && d.label === cfg.fakeMicLabel);
        els.deviceList.appendChild(
          kv(d.label || "(no label)", "id " + shortId(d.deviceId), isFake ? "good" : "muted")
        );
      });
    }
  }

  function listControls(caps) {
    return CAM_CONTROL_KEYS.filter(function (k) { return caps && caps[k] != null; });
  }

  // ---- Camera test ----

  function runCameraTest() {
    return getConfig().then(function (cfg) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setVerdict(camV, "err", "Not supported", "This browser does not expose camera access.");
        return;
      }
      const chosen = els.camPick.value;
      if (!chosen) {
        setVerdict(
          camV,
          "warn",
          "No camera available",
          "No cameras were detected. Make sure your virtual camera app is running, then refresh."
        );
        return;
      }

      stopCamStream();
      setVerdict(camV, "", "Opening camera\u2026", "Allow access if your browser asks.");

      return navigator.mediaDevices
        .getUserMedia({ video: { deviceId: { exact: chosen } }, audio: false })
        .then(function (stream) {
          camStream = stream;
          els.preview.srcObject = stream;

          const track = stream.getVideoTracks()[0];
          const settings = track && track.getSettings ? track.getSettings() : {};
          const caps = track && track.getCapabilities ? track.getCapabilities() : {};
          const label = track ? track.label : "";

          renderCamReport(label, settings, caps);
          return refreshDevices(cfg, false).then(function () {
            judgeCam(cfg, label, caps);
          });
        })
        .catch(function (e) {
          setVerdict(
            camV,
            "err",
            "Camera could not be opened",
            "Permission was denied or the device is unavailable (" +
              (e && e.name ? e.name : "error") +
              ")."
          );
        });
    });
  }

  function renderCamReport(label, settings, caps) {
    els.camReport.innerHTML = "";
    els.camReport.appendChild(kv("label", label || "(empty)"));
    els.camReport.appendChild(kv("deviceId", shortId(settings.deviceId)));
    els.camReport.appendChild(kv("groupId", shortId(settings.groupId)));
    els.camReport.appendChild(
      kv(
        "resolution",
        (settings.width || "?") +
          " \u00d7 " +
          (settings.height || "?") +
          " @ " +
          (Math.round(settings.frameRate) || "?") +
          " fps"
      )
    );
    els.camReport.appendChild(kv("facingMode", settings.facingMode || "(none)"));

    const controls = listControls(caps);
    els.camReport.appendChild(
      kv(
        "image controls",
        controls.length ? controls.length + " exposed" : "none",
        controls.length ? "good" : "bad"
      )
    );
    if (controls.length) {
      els.camReport.appendChild(kv("\u2937 which", controls.join(", "), "muted"));
    }
  }

  function judgeCam(cfg, label, caps) {
    const controls = listControls(caps);

    if (!cfg.enabled) {
      setVerdict(
        camV,
        "warn",
        "Mask is OFF",
        "The extension is disabled, so the site sees your real device. Enable it in the popup and pick a target webcam."
      );
      return;
    }
    if (!cfg.targetLabel) {
      setVerdict(
        camV,
        "warn",
        "No target webcam selected",
        "Mask is enabled but no webcam is selected, so nothing is being rewritten. Pick a target in the popup."
      );
      return;
    }

    const looksFaked = cfg.fakeLabel && label === cfg.fakeLabel;
    if (looksFaked && controls.length) {
      setVerdict(
        camV,
        "ok",
        "Camera mask is working",
        'The site sees "' +
          label +
          '" with a full physical-webcam capability set (' +
          controls.length +
          " controls). This camera looks real."
      );
      return;
    }
    if (looksFaked) {
      setVerdict(
        camV,
        "warn",
        "Identity masked, but no capabilities",
        'The name is masked as "' +
          label +
          '", but no image controls are exposed. Pick an emulated model in the popup.'
      );
      return;
    }

    setVerdict(
      camV,
      "warn",
      "This camera isn\u2019t the masked one",
      'The active camera reports "' +
        (label || "(empty)") +
        '". Select your masked camera (it appears as "' +
        (cfg.fakeLabel || "the fake name") +
        '") above and run the test again.'
    );
  }

  // ---- Microphone test ----

  function runMicTest() {
    return getConfig().then(function (cfg) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setVerdict(micV, "err", "Not supported", "This browser does not expose microphone access.");
        return;
      }

      const chosen = els.micPick.value;
      if (!chosen) {
        const mode = (cfg.micMode || "off").toLowerCase();
        if (mode === "off") {
          setVerdict(
            micV,
            "info",
            "Mic mask is off",
            "Microphone masking is disabled. The site sees real microphone identities."
          );
        } else {
          setVerdict(
            micV,
            "warn",
            "No microphone available",
            'No microphones were detected. Click "Refresh devices" to scan.'
          );
        }
        return;
      }

      stopMicStream();
      setVerdict(micV, "", "Opening microphone\u2026", "Allow access if your browser asks.");

      return navigator.mediaDevices
        .getUserMedia({ audio: { deviceId: { exact: chosen } } })
        .then(function (stream) {
          micStream = stream;
          startAudioMeter(stream);

          const track = stream.getAudioTracks()[0];
          const settings = track && track.getSettings ? track.getSettings() : {};
          const label = track ? track.label : "";

          renderMicReport(label, settings);
          return refreshDevices(cfg, false).then(function () {
            judgeMic(cfg, label, settings);
          });
        })
        .catch(function (e) {
          setVerdict(
            micV,
            "err",
            "Microphone could not be opened",
            "Permission was denied or the device is unavailable (" +
              (e && e.name ? e.name : "error") +
              ")."
          );
        });
    });
  }

  function startAudioMeter(stream) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);

      const canvas = els.audioCanvas;
      const ctx = canvas.getContext("2d");
      const timeData = new Uint8Array(analyser.fftSize);
      const dpr = window.devicePixelRatio || 1;
      const POINTS = 128;

      function resize() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }
      resize();
      meterResize = resize;
      window.addEventListener("resize", resize);

      function tick() {
        if (!micStream) return;
        analyser.getByteTimeDomainData(timeData);

        const W = canvas.width / dpr;
        const H = canvas.height / dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        const step = Math.max(1, Math.floor(timeData.length / POINTS));
        const sliceW = W / (POINTS - 1);

        // Collect points
        const pts = [];
        let sum = 0;
        for (let i = 0; i < POINTS; i++) {
          const idx = Math.min(i * step, timeData.length - 1);
          const v = (timeData[idx] - 128) / 128;
          sum += v * v;
          pts.push({ x: i * sliceW, y: H / 2 + v * H * 0.38 });
        }
        const rms = Math.sqrt(sum / POINTS);
        const level = Math.min(1, rms * 4.5);

        // Gradient stroke
        const grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, "rgba(91,140,255,0.6)");
        grad.addColorStop(0.5, "rgba(138,108,255,0.8)");
        grad.addColorStop(1, "rgba(74,222,128,0.6)");

        // Glow scales with volume
        ctx.shadowColor = "rgba(91,140,255,0.5)";
        ctx.shadowBlur = 6 + level * 18;
        ctx.lineWidth = 2;
        ctx.strokeStyle = grad;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Smooth bezier curve through points
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i].x + pts[i + 1].x) / 2;
          const my = (pts[i].y + pts[i + 1].y) / 2;
          ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
        }
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();

        // Subtle fill below the line
        ctx.shadowBlur = 0;
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();
        ctx.fillStyle = "rgba(91,140,255," + (0.02 + level * 0.06) + ")";
        ctx.fill();

        const pct = Math.round(level * 100);
        els.audioLevel.textContent = pct + "%";
        els.meterWrap.classList.toggle("active", pct > 3);
        els.audioLabel.textContent =
          pct > 3 ? "Audio detected" : "Speak or make a sound";

        rafId = requestAnimationFrame(tick);
      }
      tick();
    } catch (e) {
      els.audioLabel.textContent = "Audio meter unavailable";
    }
  }

  function renderMicReport(label, settings) {
    els.micReport.innerHTML = "";
    els.micReport.appendChild(kv("label", label || "(empty)"));
    els.micReport.appendChild(kv("deviceId", shortId(settings.deviceId)));
    els.micReport.appendChild(kv("groupId", shortId(settings.groupId)));
    if (settings.sampleRate) {
      els.micReport.appendChild(kv("sampleRate", settings.sampleRate + " Hz"));
    }
    if (settings.channelCount) {
      els.micReport.appendChild(kv("channels", String(settings.channelCount)));
    }
    const features = [];
    if (settings.echoCancellation) features.push("echo cancel");
    if (settings.noiseSuppression) features.push("noise suppress");
    if (settings.autoGainControl) features.push("auto gain");
    els.micReport.appendChild(
      kv("processing", features.length ? features.join(", ") : "none", "muted")
    );
  }

  function judgeMic(cfg, label, settings) {
    const mode = (cfg.micMode || "off").toLowerCase();

    if (mode === "off") {
      setVerdict(
        micV,
        "info",
        "Mic mask is off",
        "Microphone masking is disabled. The site sees your real microphone identity."
      );
      return;
    }

    if (!cfg.enabled) {
      setVerdict(
        micV,
        "warn",
        "Mask is OFF",
        "The extension is disabled, so the site sees your real microphone. Enable it in the popup."
      );
      return;
    }

    if (!cfg.targetMicLabel) {
      setVerdict(
        micV,
        "warn",
        "No target mic selected",
        "Mic masking is on but no microphone is selected as the target. Pick one in the popup."
      );
      return;
    }

    const expectedLabel = computeExpectedMicLabel(cfg);
    const labelMatches = expectedLabel && label === expectedLabel;
    const altMatch = !labelMatches && cfg.fakeMicLabel && label === cfg.fakeMicLabel;

    if (labelMatches || altMatch) {
      if (mode === "auto" && settings.groupId === cfg.fakeGroupId) {
        setVerdict(
          micV,
          "ok",
          "Mic mask is working",
          'The site sees "' +
            label +
            '" with a groupId matching the camera. This mic looks authentic.'
        );
      } else if (mode === "auto") {
        setVerdict(
          micV,
          "ok",
          "Mic identity is masked",
          'The site sees "' +
            label +
            '". The name is masked, but the groupId doesn\u2019t match the camera\u2019s.'
        );
      } else {
        setVerdict(
          micV,
          "ok",
          "Mic mask is working",
          'The site sees "' + label + '" with your custom identity applied.'
        );
      }
      return;
    }

    setVerdict(
      micV,
      "warn",
      "This mic isn\u2019t the masked one",
      'The active mic reports "' +
        (label || "(empty)") +
        '". Select your masked microphone (it should appear as "' +
        (expectedLabel || cfg.fakeMicLabel || "the fake name") +
        '") above.'
    );
  }

  // ---- Initialization ----

  function grantAndList() {
    setVerdict(camV, "", "Requesting access\u2026", "Allow camera and microphone access so device names are visible.");
    setVerdict(micV, "", "Requesting access\u2026", "Waiting for permission grant.");

    return getConfig().then(function (cfg) {
      return S.requestDeviceAccess()
        .then(function () {
          return refreshDevices(cfg, true);
        })
        .then(function (result) {
          const tasks = [];
          if (result.cams && result.cams.length) {
            tasks.push(runCameraTest());
          } else {
            setVerdict(
              camV,
              "warn",
              "No camera available",
              "No cameras were detected. Make sure your virtual camera app is running, then refresh."
            );
          }
          if (result.mics && result.mics.length) {
            tasks.push(runMicTest());
          } else {
            const mode = (cfg.micMode || "off").toLowerCase();
            if (mode === "off") {
              setVerdict(micV, "info", "Mic mask is off", "Microphone masking is disabled.");
            } else {
              setVerdict(micV, "warn", "No microphone available", "No microphones were detected.");
            }
          }
          return Promise.all(tasks);
        })
        .catch(function (e) {
          const msg =
            "Camera/mic permission is required to test (" +
            (e && e.name ? e.name : "error") +
            ").";
          setVerdict(camV, "err", "Access not granted", msg);
          setVerdict(micV, "err", "Access not granted", msg);
        });
    });
  }

  function init() {
    els.camPick.addEventListener("change", function () { runCameraTest(); });
    els.micPick.addEventListener("change", function () { runMicTest(); });
    els.grant.addEventListener("click", function () { grantAndList(); });
    grantAndList();

    try {
      navigator.mediaDevices.addEventListener("devicechange", function () {
        getConfig().then(function (cfg) { refreshDevices(cfg, false); });
      });
    } catch (e) {}

    // Re-run verdicts when the user changes config in the popup.
    try {
      chrome.storage.onChanged.addListener(function (changes, area) {
        if (area === "local" && Object.keys(changes).some(function (k) { return CONFIG_KEYS.has(k); })) {
          getConfig().then(function (cfg) {
            refreshDevices(cfg, false).then(function () {
              if (camStream) runCameraTest();
              if (micStream) runMicTest();
            });
          });
        }
      });
    } catch (e) {}
  }

  window.addEventListener("beforeunload", function () {
    stopCamStream();
    stopMicStream();
  });

  init();
})();
