(function (root) {
  "use strict";

  // Capability profiles for real, common webcams. The numbers mirror what
  // Chrome's MediaStreamTrack.getCapabilities()/getSettings() expose for the
  // actual hardware (UVC control ranges, native resolutions, frame rates).
  //
  // The whole point is to look EXACTLY like a popular real camera: a virtual
  // camera normally exposes only width/height/frameRate/aspectRatio/resizeMode
  // and NO image controls (brightness, contrast, exposure, focus...), which is
  // an instant giveaway. Each profile re-creates that missing surface.
  //
  // Control format: [min, max, step, default]. facing "" => external USB cam
  // (facingMode reports []), "user" => integrated front camera.
  const PROFILES = [
    {
      id: "generic",
      name: "Generic webcam",
      label: null, // keeps whatever fake name is configured
      facing: "",
      maxWidth: 1920,
      maxHeight: 1080,
      maxFrameRate: 30,
      whiteBalanceMode: ["continuous", "manual"],
      exposureMode: ["continuous", "manual"],
      controls: {
        brightness: [0, 255, 1, 128],
        contrast: [0, 255, 1, 128],
        saturation: [0, 255, 1, 128],
        sharpness: [0, 255, 1, 128],
        colorTemperature: [2000, 6500, 10, 4000],
        exposureTime: [3, 2047, 1, 156]
      }
    },
    {
      id: "logitech_c920",
      name: "Logitech C920 (1080p)",
      label: "HD Pro Webcam C920 (046d:082d)",
      facing: "",
      maxWidth: 1920,
      maxHeight: 1080,
      maxFrameRate: 30,
      whiteBalanceMode: ["continuous", "manual"],
      exposureMode: ["continuous", "manual"],
      focusMode: ["continuous", "manual"],
      focusDistance: [0, 250, 5, 0],
      controls: {
        brightness: [0, 255, 1, 128],
        contrast: [0, 255, 1, 128],
        saturation: [0, 255, 1, 128],
        sharpness: [0, 255, 1, 128],
        colorTemperature: [2000, 6500, 10, 4000],
        exposureTime: [3, 2047, 1, 250]
      }
    },
    {
      id: "logitech_c922",
      name: "Logitech C922 Pro (1080p/720p60)",
      label: "C922 Pro Stream Webcam (046d:085c)",
      facing: "",
      maxWidth: 1920,
      maxHeight: 1080,
      maxFrameRate: 60,
      whiteBalanceMode: ["continuous", "manual"],
      exposureMode: ["continuous", "manual"],
      focusMode: ["continuous", "manual"],
      focusDistance: [0, 250, 5, 0],
      controls: {
        brightness: [0, 255, 1, 128],
        contrast: [0, 255, 1, 128],
        saturation: [0, 255, 1, 128],
        sharpness: [0, 255, 1, 128],
        colorTemperature: [2000, 6500, 10, 4000],
        exposureTime: [3, 2047, 1, 250]
      }
    },
    {
      id: "logitech_brio",
      name: "Logitech BRIO (4K)",
      label: "Logitech BRIO (046d:086b)",
      facing: "",
      maxWidth: 4096,
      maxHeight: 2160,
      maxFrameRate: 90,
      whiteBalanceMode: ["continuous", "manual"],
      exposureMode: ["continuous", "manual"],
      focusMode: ["continuous", "manual"],
      focusDistance: [0, 250, 5, 0],
      controls: {
        brightness: [0, 255, 1, 128],
        contrast: [0, 255, 1, 128],
        saturation: [0, 255, 1, 128],
        sharpness: [0, 255, 1, 128],
        colorTemperature: [2000, 7500, 10, 4000],
        exposureTime: [3, 2047, 1, 250]
      }
    },
    {
      id: "microsoft_lifecam_hd3000",
      name: "Microsoft LifeCam HD-3000 (720p)",
      label: "Microsoft\u00ae LifeCam HD-3000 (045e:0779)",
      facing: "",
      maxWidth: 1280,
      maxHeight: 720,
      maxFrameRate: 30,
      whiteBalanceMode: ["continuous", "manual"],
      exposureMode: ["continuous", "manual"],
      controls: {
        brightness: [30, 255, 1, 133],
        contrast: [0, 10, 1, 5],
        saturation: [0, 200, 1, 83],
        sharpness: [0, 50, 1, 25],
        colorTemperature: [2800, 10000, 10, 4500],
        exposureTime: [5, 20000, 1, 156]
      }
    },
    {
      id: "integrated_webcam",
      name: "Integrated laptop webcam (720p)",
      label: "Integrated Webcam (1bcf:2b95)",
      facing: "user",
      maxWidth: 1280,
      maxHeight: 720,
      maxFrameRate: 30,
      whiteBalanceMode: ["continuous", "manual"],
      exposureMode: ["continuous", "manual"],
      controls: {
        brightness: [0, 255, 1, 128],
        contrast: [0, 255, 1, 32],
        saturation: [0, 255, 1, 32],
        sharpness: [0, 255, 1, 24],
        colorTemperature: [2800, 6500, 10, 4600],
        exposureTime: [3, 2047, 1, 156]
      }
    }
  ];

  const BY_ID = Object.create(null);
  PROFILES.forEach((p) => {
    BY_ID[p.id] = p;
  });

  const isNum = (v) => typeof v === "number" && isFinite(v);
  const range = (a) => (a ? { max: a[1], min: a[0], step: a[2] } : null);
  const def = (a) => (a ? a[3] : null);
  const pickMode = (modes) =>
    modes && modes.length ? (modes.indexOf("continuous") >= 0 ? "continuous" : modes[0]) : null;

  function get(id) {
    return (id && BY_ID[id]) || null;
  }

  // Resolves the configured profile id, falling back to the generic webcam
  // profile for unknown or legacy values.
  function resolve(id) {
    return get(id) || get("generic");
  }

  function list() {
    return PROFILES.map((p) => ({ id: p.id, name: p.name, label: p.label }));
  }

  // A random curated profile that has a real label, for "new identity".
  function pickRandom() {
    const named = PROFILES.filter((p) => p.label);
    return named[Math.floor(Math.random() * named.length)] || get("generic");
  }

  // Synthesizes a getCapabilities() result. Resolution/frame-rate maxima come
  // from the profile but are bumped to cover the real stream (so the actual,
  // canvas-verifiable values always fall inside the advertised range).
  function buildVideoCapabilities(profile, real, identity) {
    profile = profile || get("generic");
    real = real || {};
    const c = profile.controls || {};
    const maxW = Math.max(profile.maxWidth, isNum(real.width) ? real.width : 0);
    const maxH = Math.max(profile.maxHeight, isNum(real.height) ? real.height : 0);
    const maxF = Math.max(profile.maxFrameRate, isNum(real.frameRate) ? real.frameRate : 0);

    const caps = {};
    caps.aspectRatio = { max: maxW, min: 1 / maxH };
    if (c.brightness) caps.brightness = range(c.brightness);
    if (c.colorTemperature) caps.colorTemperature = range(c.colorTemperature);
    if (c.contrast) caps.contrast = range(c.contrast);
    caps.deviceId = identity.deviceId;
    if (profile.exposureMode) caps.exposureMode = profile.exposureMode.slice();
    if (c.exposureTime) caps.exposureTime = range(c.exposureTime);
    caps.facingMode = profile.facing ? [profile.facing] : [];
    if (profile.focusDistance) caps.focusDistance = range(profile.focusDistance);
    if (profile.focusMode) caps.focusMode = profile.focusMode.slice();
    caps.frameRate = { max: maxF, min: 1 };
    caps.groupId = identity.groupId;
    caps.height = { max: maxH, min: 1 };
    caps.resizeMode = ["none", "crop-and-scale"];
    if (c.saturation) caps.saturation = range(c.saturation);
    if (c.sharpness) caps.sharpness = range(c.sharpness);
    if (profile.whiteBalanceMode) caps.whiteBalanceMode = profile.whiteBalanceMode.slice();
    caps.width = { max: maxW, min: 1 };
    return caps;
  }

  // Synthesizes a getSettings() result. Real width/height/frameRate/aspectRatio
  // are preserved (a site can measure them from the actual frames); only the
  // identity and the control current values are added/overridden.
  function buildVideoSettings(profile, real, identity) {
    profile = profile || get("generic");
    real = real || {};
    const c = profile.controls || {};
    const width = isNum(real.width) ? real.width : profile.maxWidth;
    const height = isNum(real.height) ? real.height : profile.maxHeight;
    const frameRate = isNum(real.frameRate) ? real.frameRate : profile.maxFrameRate;

    const s = {};
    if (height) s.aspectRatio = width / height;
    if (c.brightness) s.brightness = def(c.brightness);
    if (c.colorTemperature) s.colorTemperature = def(c.colorTemperature);
    if (c.contrast) s.contrast = def(c.contrast);
    s.deviceId = identity.deviceId;
    if (profile.exposureMode) s.exposureMode = pickMode(profile.exposureMode);
    if (c.exposureTime) s.exposureTime = def(c.exposureTime);
    if (profile.facing) s.facingMode = profile.facing;
    if (profile.focusDistance) s.focusDistance = def(profile.focusDistance);
    if (profile.focusMode) s.focusMode = pickMode(profile.focusMode);
    s.frameRate = frameRate;
    s.groupId = identity.groupId;
    s.height = height;
    s.resizeMode = typeof real.resizeMode === "string" ? real.resizeMode : "none";
    if (c.saturation) s.saturation = def(c.saturation);
    if (c.sharpness) s.sharpness = def(c.sharpness);
    if (profile.whiteBalanceMode) s.whiteBalanceMode = pickMode(profile.whiteBalanceMode);
    s.width = width;
    return s;
  }

  root.__vcamProfiles = {
    get: get,
    resolve: resolve,
    list: list,
    pickRandom: pickRandom,
    buildVideoCapabilities: buildVideoCapabilities,
    buildVideoSettings: buildVideoSettings
  };
})(typeof self !== "undefined" ? self : this);
