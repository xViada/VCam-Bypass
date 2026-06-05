(function () {
  "use strict";

  if (window.__vcamDisguiseInstalled) return;
  window.__vcamDisguiseInstalled = true;

  function randomHex(len) {
    var bytes = new Uint8Array(len / 2);
    crypto.getRandomValues(bytes);
    var out = "";
    for (var i = 0; i < bytes.length; i++) {
      out += bytes[i].toString(16).padStart(2, "0");
    }
    return out;
  }

  // Live configuration: the patched functions read it dynamically, so the bridge
  // can update it after document_start. The ids here are provisional until the
  // persisted config arrives; the service worker generates and stores stable
  // deviceId/groupId values per installation.
  var config = {
    enabled: true,
    targetLabel: "",
    fakeLabel: "Integrated Webcam (1bcf:2b95)",
    fakeDeviceId: randomHex(64),
    fakeGroupId: randomHex(64)
  };

  // Known virtual camera name patterns, used for "Auto" target detection.
  var VIRTUAL_CAM_RE = /(ivcam|e2esoft|obs|virtual\s*cam|virtualcam|snap\s*camera|snapcam|manycam|xsplit|droidcam|epoccam|nvidia\s*broadcast|streamlabs|camtwist|iriun|reincubate|camo|splitcam|youcam|altercam|webcamoid|akvcam|vtube|mmhmm|prism\s*live)/i;

  // Map fakeDeviceId -> realDeviceId, to translate constraints in getUserMedia.
  var fakeToReal = Object.create(null);
  // Set of real deviceIds that belong to the disguised camera (to match tracks).
  var targetRealIds = Object.create(null);

  // Listen for the config sent by the bridge (ISOLATED world).
  window.addEventListener("vcam:config", function (ev) {
    try {
      var incoming = ev.detail;
      if (incoming && typeof incoming === "object") {
        for (var k in incoming) {
          if (Object.prototype.hasOwnProperty.call(incoming, k)) {
            config[k] = incoming[k];
          }
        }
      }
    } catch (e) {}
  });
  // Ask the bridge for the current config as early as possible.
  try {
    window.dispatchEvent(new CustomEvent("vcam:request-config"));
  } catch (e) {}

  function isVirtualCam(label) {
    return !!label && VIRTUAL_CAM_RE.test(label);
  }

  // Whether a device label is the disguise target. If the user picked one in the
  // dropdown (targetLabel) we match by exact label; otherwise "Auto" mode matches
  // any known virtual camera.
  function isTarget(label) {
    if (!label) return false;
    var target = (config.targetLabel || "").trim();
    if (target) {
      return label.trim().toLowerCase() === target.toLowerCase();
    }
    return isVirtualCam(label);
  }

  if (!navigator.mediaDevices) {
    return;
  }

  var md = navigator.mediaDevices;

  // --- enumerateDevices ---------------------------------------------------
  var origEnumerate = md.enumerateDevices ? md.enumerateDevices.bind(md) : null;

  if (origEnumerate) {
    md.enumerateDevices = function () {
      return origEnumerate().then(function (devices) {
        if (!config.enabled) return devices;

        var result = [];
        for (var i = 0; i < devices.length; i++) {
          var dev = devices[i];

          if (dev.kind === "videoinput" && isTarget(dev.label)) {
            // Record mappings so we can translate constraints later.
            if (dev.deviceId) {
              fakeToReal[config.fakeDeviceId] = dev.deviceId;
              targetRealIds[dev.deviceId] = true;
            }
            result.push(makeFakeDeviceInfo(dev));
            continue;
          }

          result.push(dev);
        }
        return result;
      });
    };
  }

  // Builds an object that mimics a MediaDeviceInfo but with spoofed data.
  function makeFakeDeviceInfo(realDevice) {
    var fake = {
      kind: "videoinput",
      label: config.fakeLabel,
      deviceId: config.fakeDeviceId,
      groupId: config.fakeGroupId
    };

    var obj = {};
    Object.defineProperties(obj, {
      kind: { enumerable: true, get: function () { return fake.kind; } },
      label: { enumerable: true, get: function () { return config.fakeLabel; } },
      deviceId: { enumerable: true, get: function () { return config.fakeDeviceId; } },
      groupId: { enumerable: true, get: function () { return config.fakeGroupId; } }
    });
    Object.defineProperty(obj, "toJSON", {
      enumerable: false,
      value: function () {
        return {
          kind: "videoinput",
          label: config.fakeLabel,
          deviceId: config.fakeDeviceId,
          groupId: config.fakeGroupId
        };
      }
    });

    // Look right for instanceof / Object.prototype.toString checks.
    try {
      Object.setPrototypeOf(obj, Object.getPrototypeOf(realDevice));
    } catch (e) {}

    return obj;
  }

  // --- Constraint translation (fake deviceId -> real) ---------------------
  function translateConstraintValue(val) {
    if (typeof val === "string") {
      return fakeToReal[val] || val;
    }
    if (val && typeof val === "object") {
      ["exact", "ideal"].forEach(function (key) {
        if (typeof val[key] === "string") {
          val[key] = fakeToReal[val[key]] || val[key];
        } else if (Array.isArray(val[key])) {
          val[key] = val[key].map(function (v) {
            return typeof v === "string" ? fakeToReal[v] || v : v;
          });
        }
      });
    }
    return val;
  }

  function translateConstraints(constraints) {
    if (!constraints || typeof constraints !== "object") return constraints;
    try {
      if (constraints.video && typeof constraints.video === "object") {
        if ("deviceId" in constraints.video) {
          constraints.video.deviceId = translateConstraintValue(
            constraints.video.deviceId
          );
        }
        if ("groupId" in constraints.video) {
          // We do not translate the real groupId; drop the fake one so the
          // request does not break.
          var g = constraints.video.groupId;
          if (
            g === config.fakeGroupId ||
            (g && (g.exact === config.fakeGroupId || g.ideal === config.fakeGroupId))
          ) {
            delete constraints.video.groupId;
          }
        }
      }
    } catch (e) {}
    return constraints;
  }

  // --- getUserMedia -------------------------------------------------------
  function patchStreamTracks(stream) {
    try {
      var tracks = stream.getVideoTracks ? stream.getVideoTracks() : [];
      for (var i = 0; i < tracks.length; i++) {
        disguiseTrack(tracks[i]);
      }
    } catch (e) {}
    return stream;
  }

  function disguiseTrack(track) {
    if (!track || track.__vcamDisguised) return;

    var realDeviceId = null;
    try {
      var s = track.getSettings ? track.getSettings() : null;
      if (s && s.deviceId) realDeviceId = s.deviceId;
    } catch (e) {}

    var matchesByLabel = isTarget(track.label);
    var matchesById = realDeviceId && targetRealIds[realDeviceId];

    if (!matchesByLabel && !matchesById) return;
    track.__vcamDisguised = true;

    // label
    try {
      Object.defineProperty(track, "label", {
        configurable: true,
        enumerable: true,
        get: function () { return config.fakeLabel; }
      });
    } catch (e) {}

    // getSettings
    if (typeof track.getSettings === "function") {
      var origSettings = track.getSettings.bind(track);
      track.getSettings = function () {
        var out = origSettings();
        if (out && typeof out === "object") {
          if ("deviceId" in out) out.deviceId = config.fakeDeviceId;
          if ("groupId" in out) out.groupId = config.fakeGroupId;
        }
        return out;
      };
    }

    // getCapabilities
    if (typeof track.getCapabilities === "function") {
      var origCaps = track.getCapabilities.bind(track);
      track.getCapabilities = function () {
        var out = origCaps();
        if (out && typeof out === "object") {
          if ("deviceId" in out) out.deviceId = config.fakeDeviceId;
          if ("groupId" in out) out.groupId = config.fakeGroupId;
        }
        return out;
      };
    }
  }

  function wrapGetUserMedia(origFn, thisArg) {
    return function (constraints) {
      if (!config.enabled) {
        return origFn.call(thisArg, constraints);
      }
      var translated = translateConstraints(constraints);
      var p = origFn.call(thisArg, translated);
      if (p && typeof p.then === "function") {
        return p.then(function (stream) {
          return patchStreamTracks(stream);
        });
      }
      return p;
    };
  }

  // Modern promise-based API.
  if (md.getUserMedia) {
    md.getUserMedia = wrapGetUserMedia(md.getUserMedia.bind(md), md);
  }

  // Legacy callback-based API (some old sites).
  function patchLegacy(name) {
    var orig = navigator[name];
    if (typeof orig !== "function") return;
    navigator[name] = function (constraints, success, error) {
      if (!config.enabled) {
        return orig.call(navigator, constraints, success, error);
      }
      var translated = translateConstraints(constraints);
      return orig.call(
        navigator,
        translated,
        function (stream) {
          try { patchStreamTracks(stream); } catch (e) {}
          if (typeof success === "function") success(stream);
        },
        error
      );
    };
  }
  patchLegacy("getUserMedia");
  patchLegacy("webkitGetUserMedia");
  patchLegacy("mozGetUserMedia");

  // --- Global video track masking ----------------------------------------
  // Some pages read settings/capabilities from the prototype without going
  // through our stream; cover those cases at the prototype level.
  try {
    var TrackProto = window.MediaStreamTrack && window.MediaStreamTrack.prototype;
    if (TrackProto) {
      var protoGetSettings = TrackProto.getSettings;
      if (typeof protoGetSettings === "function") {
        TrackProto.getSettings = function () {
          var out = protoGetSettings.apply(this, arguments);
          try {
            if (
              config.enabled &&
              out &&
              out.deviceId &&
              targetRealIds[out.deviceId]
            ) {
              out.deviceId = config.fakeDeviceId;
              if ("groupId" in out) out.groupId = config.fakeGroupId;
            }
          } catch (e) {}
          return out;
        };
      }

      var protoGetCaps = TrackProto.getCapabilities;
      if (typeof protoGetCaps === "function") {
        TrackProto.getCapabilities = function () {
          var out = protoGetCaps.apply(this, arguments);
          try {
            if (
              config.enabled &&
              out &&
              out.deviceId &&
              targetRealIds[out.deviceId]
            ) {
              out.deviceId = config.fakeDeviceId;
              if ("groupId" in out) out.groupId = config.fakeGroupId;
            }
          } catch (e) {}
          return out;
        };
      }
    }
  } catch (e) {}
})();
