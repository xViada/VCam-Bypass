(function () {
  "use strict";

  if (window.__vcamMaskInstalled) return;
  window.__vcamMaskInstalled = true;

  // Self-contained on purpose: content scripts injected into the page's MAIN
  // world can't reliably share globals across files, so this file must not
  // depend on shared.js (doing so silently broke masking on real pages).
  const randomHex = (len) =>
    Array.from(crypto.getRandomValues(new Uint8Array(len / 2)), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");

  const ID_RE = /^(.+?)\s*\(([0-9a-f]{4}:[0-9a-f]{4})\)\s*$/i;

  // Read live by the patched functions, so the bridge can refresh it after
  // document_start. IDs here are provisional until the stored config lands.
  const config = {
    enabled: false,
    hideOtherDevices: false,
    targetLabel: "",
    fakeLabel: "Integrated Webcam (1bcf:2b95)",
    fakeDeviceId: randomHex(64),
    fakeGroupId: randomHex(64),
    cameraProfile: "generic",
    cameraCaps: null,
    micMode: "off",
    targetMicLabel: "",
    fakeMicLabel: "Internal Microphone (1bcf:2b95)",
    fakeMicDeviceId: randomHex(64),
    fakeMicGroupId: randomHex(64)
  };

  // Camera capability profiles, injected just before us in the MAIN world. We
  // pull the reference and remove the global so the page can't read it back.
  const VP = (function () {
    try {
      const api = window.__vcamProfiles || null;
      try {
        delete window.__vcamProfiles;
      } catch (e) {}
      return api;
    } catch (e) {
      return null;
    }
  })();

  // The capability profile to present for the masked camera. A fully
  // custom capabilities object (edited in the popup) wins over the presets.
  function resolveCameraProfile() {
    if (config.cameraCaps && typeof config.cameraCaps === "object") {
      return config.cameraCaps;
    }
    if (!VP) return null;
    try {
      return VP.resolve(config.cameraProfile);
    } catch (e) {
      return null;
    }
  }

  // fakeId -> realId, used to translate getUserMedia constraints back.
  let fakeToReal = Object.create(null);
  let fakeMicToReal = Object.create(null);
  let targetRealIds = Object.create(null);
  let targetMicRealIds = Object.create(null);
  let targetMicRealGroupId = null;
  // Real ids of the masked devices, used to pin requests when the rest of the
  // devices are hidden from the page.
  let targetCamRealId = null;
  let targetMicRealId = null;

  window.addEventListener("vcam:config", (ev) => {
    const incoming = ev.detail;
    if (incoming && typeof incoming === "object") Object.assign(config, incoming);
  });
  try {
    window.dispatchEvent(new CustomEvent("vcam:request-config"));
  } catch (e) {}

  const eq = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

  // A target must be explicitly selected; with no selection nothing is masked.
  function isTarget(label) {
    if (!label) return false;
    const target = (config.targetLabel || "").trim();
    return target ? eq(label, target) : false;
  }

  // Anything unrecognized means "leave microphones alone", the same as the
  // default: masking a device the popup never validated is the worse outcome.
  function micMode() {
    const mode = (config.micMode || "off").toLowerCase();
    return mode === "auto" || mode === "custom" ? mode : "off";
  }

  // When on, the page is only allowed to know about the emulated devices.
  function hidingOthers() {
    return !!(config.enabled && config.hideOtherDevices);
  }

  function deriveMicLabel(webcamLabel) {
    const m = (webcamLabel || config.fakeLabel || "").trim().match(ID_RE);
    return m ? "Internal Microphone (" + m[2] + ")" : "Internal Microphone";
  }

  // Label for a mic on the same physical device as the camera, e.g.
  // "Microphone (HD Pro Webcam C920) (046d:082d)".
  function linkedMicLabel(webcamLabel) {
    const label = (webcamLabel || config.fakeLabel || "").trim();
    const m = label.match(ID_RE);
    if (m) return "Microphone (" + m[1].trim() + ") (" + m[2] + ")";
    return label ? "Microphone (" + label + ")" : "Microphone";
  }

  // Both masking modes rewrite the one microphone the user picked as the target;
  // they only differ in the identity it gets.
  function micIdentity() {
    const mode = micMode();
    if (mode === "off") return null;
    if (mode === "custom") {
      return {
        label: (config.fakeMicLabel || "").trim() || deriveMicLabel(config.fakeLabel),
        deviceId: config.fakeMicDeviceId,
        groupId: config.fakeMicGroupId || config.fakeGroupId
      };
    }
    // Auto: pass it off as the emulated camera's built-in mic, which means the
    // camera's own name in the label and its groupId, the way a real webcam with
    // a mic on the same physical device looks.
    return {
      label: linkedMicLabel(config.fakeLabel),
      deviceId: config.fakeMicDeviceId,
      groupId: config.fakeGroupId
    };
  }

  function isMicTargetLabel(label) {
    const target = (config.targetMicLabel || "").trim();
    return !!label && !!target && eq(label, target);
  }

  // "default" / "communications" are Chrome's fixed mirror ids, not real hashes.
  const isPseudoId = (id) => id === "default" || id === "communications";

  // Real groupId of the mic to mask, so the default/communications mirrors
  // of the same device get covered too. Nothing is masked without an explicit
  // target: a mask that borrows whichever mic happens to be around would put a
  // device the user never chose behind the camera's identity.
  function pickMicGroup(devices) {
    const hit = devices.find(
      (d) => d.kind === "audioinput" && isMicTargetLabel(d.label) && d.groupId
    );
    return hit ? hit.groupId : null;
  }

  if (!navigator.mediaDevices) return;
  const md = navigator.mediaDevices;

  // --- enumerateDevices ---
  const origEnumerate = md.enumerateDevices ? md.enumerateDevices.bind(md) : null;

  if (origEnumerate) {
    md.enumerateDevices = function () {
      return origEnumerate().then((devices) => {
        if (!config.enabled) return devices;

        fakeToReal = Object.create(null);
        fakeMicToReal = Object.create(null);
        targetRealIds = Object.create(null);
        targetMicRealIds = Object.create(null);
        targetMicRealGroupId = null;
        targetCamRealId = null;
        targetMicRealId = null;

        const micId = micIdentity();
        if (micId) targetMicRealGroupId = pickMicGroup(devices);

        const entries = devices.map((dev) => {
          if (dev.kind === "videoinput" && isTarget(dev.label)) {
            if (dev.deviceId) {
              targetRealIds[dev.deviceId] = true;
              // Two identical webcams share a label, so the first match wins
              // and stays the one the emulated identity points at.
              if (!targetCamRealId) {
                fakeToReal[config.fakeDeviceId] = dev.deviceId;
                targetCamRealId = dev.deviceId;
              }
            }
            return {
              masked: true,
              info: makeFakeDeviceInfo(dev, {
                kind: "videoinput",
                getLabel: () => config.fakeLabel,
                getDeviceId: () => config.fakeDeviceId,
                getGroupId: () => config.fakeGroupId
              })
            };
          }

          if (
            dev.kind === "audioinput" &&
            micId &&
            targetMicRealGroupId &&
            dev.groupId === targetMicRealGroupId
          ) {
            if (dev.deviceId) {
              targetMicRealIds[dev.deviceId] = true;
              if (!isPseudoId(dev.deviceId) && !targetMicRealId) {
                fakeMicToReal[micId.deviceId] = dev.deviceId;
                targetMicRealId = dev.deviceId;
              }
            }
            return { masked: true, info: makeFakeMicInfo(dev, micId) };
          }

          return { masked: false, info: dev };
        });

        return hideNonMasked(entries);
      });
    };
  }

  // Drops every camera/mic the page has no business seeing, leaving only the
  // emulated ones. A kind is filtered only when it actually has a masked
  // replacement, so a disconnected virtual camera (or a mic mask that is off)
  // never leaves the page with an empty device list.
  function hideNonMasked(entries) {
    if (!hidingOthers()) return entries.map((e) => e.info);

    const maskedKinds = Object.create(null);
    entries.forEach((e) => {
      if (e.masked) maskedKinds[e.info.kind] = true;
    });

    const seen = Object.create(null);
    const out = [];

    entries.forEach((e) => {
      if (!e.masked) {
        if (!maskedKinds[e.info.kind]) out.push(e.info);
        return;
      }
      // Several real devices can collapse onto one emulated identity (two
      // identical webcams, or a device exposing the same mic twice), and no
      // real machine ever repeats a deviceId.
      const id = e.info.deviceId;
      if (id) {
        if (seen[id]) return;
        seen[id] = true;
      }
      out.push(e.info);
    });

    return out;
  }

  // Mimics a MediaDeviceInfo while exposing spoofed values.
  function makeFakeDeviceInfo(realDevice, identity) {
    const obj = {};
    Object.defineProperties(obj, {
      kind: { enumerable: true, get: () => identity.kind },
      label: { enumerable: true, get: () => identity.getLabel() },
      deviceId: { enumerable: true, get: () => identity.getDeviceId() },
      groupId: { enumerable: true, get: () => identity.getGroupId() }
    });
    Object.defineProperty(obj, "toJSON", {
      value: () => ({
        kind: identity.kind,
        label: identity.getLabel(),
        deviceId: identity.getDeviceId(),
        groupId: identity.getGroupId()
      })
    });
    try {
      Object.setPrototypeOf(obj, Object.getPrototypeOf(realDevice));
    } catch (e) {}
    return obj;
  }

  // Pseudo entries keep their fixed id and Chrome's "Default - " prefix so the
  // list still looks native.
  function makeFakeMicInfo(realDev, micId) {
    const prefix =
      realDev.deviceId === "default"
        ? "Default - "
        : realDev.deviceId === "communications"
        ? "Communications - "
        : "";
    const devId = isPseudoId(realDev.deviceId) ? realDev.deviceId : micId.deviceId;
    const label = prefix + micId.label;
    return makeFakeDeviceInfo(realDev, {
      kind: "audioinput",
      getLabel: () => label,
      getDeviceId: () => devId,
      getGroupId: () => micId.groupId
    });
  }

  // --- Constraint translation (fakeId -> real) ---
  function translateConstraintValue(val, map) {
    if (typeof val === "string") return map[val] || val;
    if (val && typeof val === "object") {
      ["exact", "ideal"].forEach((key) => {
        if (typeof val[key] === "string") {
          val[key] = map[val[key]] || val[key];
        } else if (Array.isArray(val[key])) {
          val[key] = val[key].map((v) => (typeof v === "string" ? map[v] || v : v));
        }
      });
    }
    return val;
  }

  function stripFakeGroupId(obj, fakeGroupId) {
    if (!obj || typeof obj !== "object" || !("groupId" in obj)) return;
    const g = obj.groupId;
    if (g === fakeGroupId || (g && (g.exact === fakeGroupId || g.ideal === fakeGroupId))) {
      delete obj.groupId;
    }
  }

  function translateConstraints(constraints) {
    if (!constraints || typeof constraints !== "object") return constraints;
    try {
      const video = constraints.video;
      if (video && typeof video === "object") {
        if ("deviceId" in video) {
          video.deviceId = translateConstraintValue(video.deviceId, fakeToReal);
        }
        stripFakeGroupId(video, config.fakeGroupId);
      }

      const micId = micIdentity();
      const audio = constraints.audio;
      if (micId && audio && typeof audio === "object") {
        if ("deviceId" in audio) {
          audio.deviceId = translateConstraintValue(audio.deviceId, fakeMicToReal);
        }
        stripFakeGroupId(audio, micId.groupId);
      }
    } catch (e) {}
    return constraints;
  }

  // --- Device pinning (only while the other devices are hidden) ---
  // The page has been told the real devices don't exist, so it must not be able
  // to open one: a request that doesn't name a device is pinned to the emulated
  // one instead of falling back to the system default.
  function hasDeviceId(req) {
    if (!req || typeof req !== "object") return false;
    const d = req.deviceId;
    if (!d) return false;
    return typeof d === "string" ? !!d : !!(d.exact || d.ideal);
  }

  function pinConstraints(constraints) {
    if (!hidingOthers()) return constraints;
    const src = constraints && typeof constraints === "object" ? constraints : {};
    let pinned = null;

    const pin = (key, realId) => {
      const req = src[key];
      if (!req || !realId || hasDeviceId(req)) return;
      pinned = pinned || Object.assign({}, src);
      pinned[key] = Object.assign({}, typeof req === "object" ? req : null, {
        deviceId: { exact: realId }
      });
    };

    pin("video", targetCamRealId);
    pin("audio", micIdentity() ? targetMicRealId : null);
    return pinned || constraints;
  }

  // True when a track in the stream comes from a device the page can't see.
  function leaksHiddenDevice(stream) {
    let tracks;
    try {
      tracks = stream && stream.getTracks ? stream.getTracks() : [];
    } catch (e) {
      return false;
    }
    return tracks.some((track) => {
      const id = trackDeviceId(track);
      if (!id) return false;
      if (track.kind === "video") return !!targetCamRealId && !targetRealIds[id];
      return !!targetMicRealId && !!micIdentity() && !targetMicRealIds[id];
    });
  }

  function stopStream(stream) {
    try {
      (stream && stream.getTracks ? stream.getTracks() : []).forEach((t) => t.stop());
    } catch (e) {}
  }

  // Pinning needs the target's real id, which is only known once the page has
  // permission to read device labels, so the first request of a page can still
  // land on a hidden device. Re-resolve afterwards and swap the stream for one
  // from the emulated device.
  function enforceHiding(stream, invoke, constraints) {
    if (!hidingOthers() || !origEnumerate) return Promise.resolve(stream);
    if (targetCamRealId && !leaksHiddenDevice(stream)) return Promise.resolve(stream);

    return md
      .enumerateDevices()
      .catch(() => null)
      .then(() => {
        if (!leaksHiddenDevice(stream)) return stream;
        const pinned = pinConstraints(constraints);
        if (pinned === constraints) return stream;
        return invoke(pinned).then(
          (fresh) => {
            stopStream(stream);
            return fresh;
          },
          () => stream
        );
      });
  }

  // A pinned device can be busy or gone; falling back keeps the page working.
  const PIN_FALLBACK_ERRORS = {
    OverconstrainedError: true,
    NotFoundError: true,
    NotReadableError: true
  };

  function requestStream(invoke, constraints) {
    const pinned = pinConstraints(constraints);
    let p = invoke(pinned);
    if (!p || typeof p.then !== "function") return p;

    if (pinned !== constraints) {
      p = p.catch((err) => {
        if (err && PIN_FALLBACK_ERRORS[err.name]) return invoke(constraints);
        throw err;
      });
    }
    return p.then((stream) => enforceHiding(stream, invoke, constraints));
  }

  // --- getUserMedia ---
  function patchStreamTracks(stream) {
    try {
      (stream.getTracks ? stream.getTracks() : []).forEach(maskTrack);
    } catch (e) {}
    return stream;
  }

  function trackDeviceId(track) {
    try {
      const s = track.getSettings ? track.getSettings() : null;
      return s && s.deviceId ? s.deviceId : null;
    } catch (e) {
      return null;
    }
  }

  function maskTrack(track) {
    if (!track || track.__vcamMasked) return;
    const realDeviceId = trackDeviceId(track);
    if (track.kind === "video") maskVideoTrack(track, realDeviceId);
    else if (track.kind === "audio") maskAudioTrack(track, realDeviceId);
  }

  function maskVideoTrack(track, realDeviceId) {
    if (!isTarget(track.label) && !(realDeviceId && targetRealIds[realDeviceId])) return;
    track.__vcamMasked = true;
    applyTrackMask(track, {
      kind: "video",
      label: config.fakeLabel,
      deviceId: config.fakeDeviceId,
      groupId: config.fakeGroupId
    });
  }

  function maskAudioTrack(track, realDeviceId) {
    const micId = micIdentity();
    if (!micId) return;

    let matched =
      isMicTargetLabel(track.label) || !!(realDeviceId && targetMicRealIds[realDeviceId]);

    if (!matched && targetMicRealGroupId) {
      try {
        const s = track.getSettings ? track.getSettings() : null;
        if (s && s.groupId === targetMicRealGroupId) {
          matched = true;
          if (s.deviceId) {
            targetMicRealIds[s.deviceId] = true;
            if (!isPseudoId(s.deviceId)) fakeMicToReal[micId.deviceId] = s.deviceId;
          }
        }
      } catch (e) {}
    }

    if (!matched) return;
    track.__vcamMasked = true;
    applyTrackMask(track, micId);
  }

  function spoofOutput(out, identity) {
    if (out && typeof out === "object") {
      if ("deviceId" in out) out.deviceId = identity.deviceId;
      if ("groupId" in out) out.groupId = identity.groupId;
    }
    return out;
  }

  function applyTrackMask(track, identity) {
    try {
      Object.defineProperty(track, "label", {
        configurable: true,
        enumerable: true,
        get: () => identity.label
      });
    } catch (e) {}

    if (identity.kind === "video") {
      applyVideoTrackMask(track, identity);
      return;
    }

    ["getSettings", "getCapabilities"].forEach((name) => {
      if (typeof track[name] !== "function") return;
      const orig = track[name].bind(track);
      track[name] = () => spoofOutput(orig(), identity);
    });
  }

  // Video tracks get a full physical-camera surface synthesized from the
  // selected profile, while keeping the real (canvas-verifiable) resolution
  // and frame rate from the underlying stream.
  function applyVideoTrackMask(track, identity) {
    const profile = resolveCameraProfile();
    const origSettings =
      typeof track.getSettings === "function" ? track.getSettings.bind(track) : null;

    const realSettings = () => {
      try {
        return origSettings ? origSettings() : {};
      } catch (e) {
        return {};
      }
    };

    // Wraps a track method: synthesize from the profile when available, else
    // fall back to the real output with just the ids masked.
    const wrap = (name, build) => {
      if (typeof track[name] !== "function") return;
      const orig = track[name].bind(track);
      track[name] = function () {
        if (profile && VP) {
          try {
            return build();
          } catch (e) {}
        }
        let out;
        try {
          out = orig();
        } catch (e) {
          out = {};
        }
        return spoofOutput(out, identity);
      };
    };

    wrap("getSettings", () => VP.buildVideoSettings(profile, realSettings(), identity));
    wrap("getCapabilities", () => VP.buildVideoCapabilities(profile, realSettings(), identity));
  }

  function wrapGetUserMedia(origFn, thisArg) {
    return function (constraints) {
      if (!config.enabled) return origFn.call(thisArg, constraints);
      const invoke = (c) => origFn.call(thisArg, c);
      const p = requestStream(invoke, translateConstraints(constraints));
      return p && typeof p.then === "function" ? p.then(patchStreamTracks) : p;
    };
  }

  if (md.getUserMedia) {
    md.getUserMedia = wrapGetUserMedia(md.getUserMedia.bind(md), md);
  }

  // Legacy callback API still used by a few old sites.
  function patchLegacy(name) {
    const orig = navigator[name];
    if (typeof orig !== "function") return;
    navigator[name] = function (constraints, success, error) {
      if (!config.enabled) return orig.call(navigator, constraints, success, error);
      return orig.call(
        navigator,
        pinConstraints(translateConstraints(constraints)),
        (stream) => {
          patchStreamTracks(stream);
          if (typeof success === "function") success(stream);
        },
        error
      );
    };
  }
  ["getUserMedia", "webkitGetUserMedia", "mozGetUserMedia"].forEach(patchLegacy);

  // --- Prototype-level masking ---
  // Some pages read settings/capabilities straight off the prototype.
  try {
    const TrackProto = window.MediaStreamTrack && window.MediaStreamTrack.prototype;
    if (TrackProto) {
      const maskTrackOutput = (out) => {
        if (!config.enabled || !out || !out.deviceId) return out;
        if (targetRealIds[out.deviceId]) {
          out.deviceId = config.fakeDeviceId;
          if ("groupId" in out) out.groupId = config.fakeGroupId;
          return out;
        }
        const micId = micIdentity();
        if (micId && targetMicRealIds[out.deviceId]) {
          out.deviceId = micId.deviceId;
          if ("groupId" in out) out.groupId = micId.groupId;
        }
        return out;
      };

      const videoIdentity = () => ({
        kind: "video",
        label: config.fakeLabel,
        deviceId: config.fakeDeviceId,
        groupId: config.fakeGroupId
      });

      // For a video target read straight off the prototype, rebuild the whole
      // physical-camera surface from the profile instead of just masking ids.
      const synthVideo = (isCaps, real) => {
        if (!VP) return null;
        const profile = resolveCameraProfile();
        if (!profile) return null;
        try {
          const ident = videoIdentity();
          return isCaps
            ? VP.buildVideoCapabilities(profile, real, ident)
            : VP.buildVideoSettings(profile, real, ident);
        } catch (e) {
          return null;
        }
      };

      const origSettingsProto = TrackProto.getSettings;

      ["getSettings", "getCapabilities"].forEach((name) => {
        const orig = TrackProto[name];
        if (typeof orig !== "function") return;
        const isCaps = name === "getCapabilities";
        TrackProto[name] = function () {
          const out = orig.apply(this, arguments);
          if (!config.enabled) return out;
          try {
            if (out && out.deviceId && targetRealIds[out.deviceId]) {
              const real =
                isCaps && typeof origSettingsProto === "function"
                  ? origSettingsProto.apply(this, [])
                  : out;
              const synth = synthVideo(isCaps, real);
              if (synth) return synth;
            }
            maskTrackOutput(out);
          } catch (e) {}
          return out;
        };
      });
    }
  } catch (e) {}
})();
