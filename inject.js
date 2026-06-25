(function () {
  "use strict";

  if (window.__vcamMaskInstalled) return;
  window.__vcamMaskInstalled = true;

  const randomHex = (len) =>
    Array.from(crypto.getRandomValues(new Uint8Array(len / 2)), (b) =>
      b.toString(16).padStart(2, "0")
    ).join("");

  // Read live by the patched functions, so the bridge can refresh it after
  // document_start. IDs here are provisional until the stored config lands.
  const config = {
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

  const VIRTUAL_CAM_RE = /(ivcam|e2esoft|obs|virtual\s*cam|virtualcam|snap\s*camera|snapcam|manycam|xsplit|droidcam|epoccam|nvidia\s*broadcast|streamlabs|camtwist|iriun|reincubate|camo|splitcam|youcam|altercam|webcamoid|akvcam|vtube|mmhmm|prism\s*live)/i;

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

  const ID_RE = /^(.+?)\s*\(([0-9a-f]{4}:[0-9a-f]{4})\)\s*$/i;

  // fakeId -> realId, used to translate getUserMedia constraints back.
  let fakeToReal = Object.create(null);
  let fakeMicToReal = Object.create(null);
  let targetRealIds = Object.create(null);
  let targetMicRealIds = Object.create(null);
  let targetMicRealGroupId = null;

  window.addEventListener("vcam:config", (ev) => {
    const incoming = ev.detail;
    if (incoming && typeof incoming === "object") Object.assign(config, incoming);
  });
  try {
    window.dispatchEvent(new CustomEvent("vcam:request-config"));
  } catch (e) {}

  const eq = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const isVirtualCam = (label) => !!label && VIRTUAL_CAM_RE.test(label);

  // Auto mode matches any known virtual camera; otherwise match the picked label.
  function isTarget(label) {
    if (!label) return false;
    const target = (config.targetLabel || "").trim();
    return target ? eq(label, target) : isVirtualCam(label);
  }

  function micMode() {
    const mode = (config.micMode || "auto").toLowerCase();
    return mode === "off" || mode === "custom" ? mode : "auto";
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
    // Auto: same physical device as the camera -> share its groupId.
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
  // of the same device get covered too.
  function pickMicGroup(devices, camTarget) {
    const mics = devices.filter((d) => d.kind === "audioinput");

    if (micMode() === "custom") {
      const hit = mics.find((d) => isMicTargetLabel(d.label) && d.groupId);
      return hit ? hit.groupId : null;
    }

    if (camTarget && camTarget.groupId && mics.some((d) => d.groupId === camTarget.groupId)) {
      return camTarget.groupId;
    }

    const real = mics.find((d) => d.groupId && d.deviceId && !isPseudoId(d.deviceId));
    if (real) return real.groupId;

    const any = mics.find((d) => d.groupId);
    return any ? any.groupId : null;
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

        const camTarget =
          devices.find((d) => d.kind === "videoinput" && isTarget(d.label)) || null;

        const micId = micIdentity();
        if (micId) targetMicRealGroupId = pickMicGroup(devices, camTarget);

        return devices.map((dev) => {
          if (dev.kind === "videoinput" && isTarget(dev.label)) {
            if (dev.deviceId) {
              fakeToReal[config.fakeDeviceId] = dev.deviceId;
              targetRealIds[dev.deviceId] = true;
            }
            return makeFakeDeviceInfo(dev, {
              kind: "videoinput",
              getLabel: () => config.fakeLabel,
              getDeviceId: () => config.fakeDeviceId,
              getGroupId: () => config.fakeGroupId
            });
          }

          if (
            dev.kind === "audioinput" &&
            micId &&
            targetMicRealGroupId &&
            dev.groupId === targetMicRealGroupId
          ) {
            if (dev.deviceId) {
              targetMicRealIds[dev.deviceId] = true;
              if (!isPseudoId(dev.deviceId)) fakeMicToReal[micId.deviceId] = dev.deviceId;
            }
            return makeFakeMicInfo(dev, micId);
          }

          return dev;
        });
      });
    };
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
      (micMode() === "custom" && isMicTargetLabel(track.label)) ||
      !!(realDeviceId && targetMicRealIds[realDeviceId]);

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
      const p = origFn.call(thisArg, translateConstraints(constraints));
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
        translateConstraints(constraints),
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
