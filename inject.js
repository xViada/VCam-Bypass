(function () {
  "use strict";

  if (window.__vcamDisguiseInstalled) return;
  window.__vcamDisguiseInstalled = true;

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
    micMode: "auto",
    targetMicLabel: "",
    fakeMicLabel: "Internal Microphone (1bcf:2b95)",
    fakeMicDeviceId: randomHex(64),
    fakeMicGroupId: randomHex(64)
  };

  const VIRTUAL_CAM_RE = /(ivcam|e2esoft|obs|virtual\s*cam|virtualcam|snap\s*camera|snapcam|manycam|xsplit|droidcam|epoccam|nvidia\s*broadcast|streamlabs|camtwist|iriun|reincubate|camo|splitcam|youcam|altercam|webcamoid|akvcam|vtube|mmhmm|prism\s*live)/i;

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

  // Real groupId of the mic to disguise, so the default/communications mirrors
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
      (stream.getTracks ? stream.getTracks() : []).forEach(disguiseTrack);
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

  function disguiseTrack(track) {
    if (!track || track.__vcamDisguised) return;
    const realDeviceId = trackDeviceId(track);
    if (track.kind === "video") disguiseVideoTrack(track, realDeviceId);
    else if (track.kind === "audio") disguiseAudioTrack(track, realDeviceId);
  }

  function disguiseVideoTrack(track, realDeviceId) {
    if (!isTarget(track.label) && !(realDeviceId && targetRealIds[realDeviceId])) return;
    track.__vcamDisguised = true;
    applyTrackDisguise(track, {
      label: config.fakeLabel,
      deviceId: config.fakeDeviceId,
      groupId: config.fakeGroupId
    });
  }

  function disguiseAudioTrack(track, realDeviceId) {
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
    track.__vcamDisguised = true;
    applyTrackDisguise(track, micId);
  }

  function spoofOutput(out, identity) {
    if (out && typeof out === "object") {
      if ("deviceId" in out) out.deviceId = identity.deviceId;
      if ("groupId" in out) out.groupId = identity.groupId;
    }
    return out;
  }

  function applyTrackDisguise(track, identity) {
    try {
      Object.defineProperty(track, "label", {
        configurable: true,
        enumerable: true,
        get: () => identity.label
      });
    } catch (e) {}

    ["getSettings", "getCapabilities"].forEach((name) => {
      if (typeof track[name] !== "function") return;
      const orig = track[name].bind(track);
      track[name] = () => spoofOutput(orig(), identity);
    });
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

      ["getSettings", "getCapabilities"].forEach((name) => {
        const orig = TrackProto[name];
        if (typeof orig !== "function") return;
        TrackProto[name] = function () {
          const out = orig.apply(this, arguments);
          try {
            maskTrackOutput(out);
          } catch (e) {}
          return out;
        };
      });
    }
  } catch (e) {}
})();
