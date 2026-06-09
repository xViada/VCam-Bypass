![VCam Bypass icon](icons/extension_icon128.png)

# VCam Bypass (Chrome extension)

A Manifest V3 extension that makes **any virtual camera** (OBS Virtual
Camera, ManyCam, DroidCam, iVCam, Snap Camera, etc.) appear to any website as a **normal
physical webcam**, by rewriting the device info the browser exposes: `label`,
`deviceId`, `groupId` and the data from `getSettings()` / `getCapabilities()`.
It can do the same for the **microphone**, so a built-in webcam + mic combo
stays consistent (see [Microphone](#microphone)).

Everything happens inside the page context (JavaScript). It does not modify the
operating system or the actual video.

## How it works

- `inject.js` runs in the **MAIN world** (page context) at `document_start` and
  patches:
  - `navigator.mediaDevices.enumerateDevices()`: it rewrites the target device's
    `label`, `deviceId` and `groupId` to physical-webcam values. The target is
    the one you picked in the dropdown, or any known virtual camera in **Auto**
    mode.
  - `navigator.mediaDevices.getUserMedia()` (and the legacy variants): translates
    the fake `deviceId` in the constraints back to the real one before requesting
    the stream, then disguises the video tracks (`label`, `getSettings`,
    `getCapabilities`). When mic disguise is on, audio devices/tracks are
    rewritten the same way.
  - `MediaStreamTrack.prototype.getSettings` / `getCapabilities` to mask the real
    `deviceId` on any track.
- `bridge.js` runs in the **ISOLATED world**, reads the config from
  `chrome.storage.local` and sends it to `inject.js` via a `CustomEvent`. It also
  collects the real webcam names visible on the page and stores them for the popup.
- `background.js` is a service worker that, on install, generates and persists
  random, stable `deviceId`/`groupId` values and picks a random webcam name from
  the usb.ids list (with a fallback default).
- `popup.html` / `popup.js` provide the configuration UI.
- `request.html` / `request.js` is a page that requests camera permission to read
  the real camera names.

## Installation (load unpacked)

1. Make sure the virtual camera you want to disguise is **installed and running**
   so its device exists.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select this project folder.
5. (Optional) Pin the extension and open its popup to pick the target webcam,
   or adjust the fake name, `deviceId`, and `groupId`.

## Usage

![VCam Bypass popup](docs/images/popup.png)

- After installing or changing the config in the popup, **reload the page** where
  you use the camera so the changes take effect.
- In the site's camera selector, the virtual camera will appear with the fake name
  (by default `Integrated Webcam (1bcf:2b95)`, the `name (vendor:product)` format
  Chrome uses for real USB webcams).

## Configuration (popup)

- **Enabled**: turns the disguise on/off without uninstalling.
- **Target webcam**: dropdown with the available webcams to choose which one to
  act on. If left on **Auto**, it detects known virtual cameras by name. The list
  is filled in two ways:
  - Automatically, from sites where you have already granted camera permission
    (collected by `bridge.js`).
  - With the **Detect cameras** button, which opens an extension tab where Chrome
    does show the permission dialog. After clicking **Allow**, the names appear in the
    dropdown.

![Camera permisions popup](docs/images/permissions.png)   

- **Fake name (label)**: the name sites will see, in Chrome's real
  `name (vendor:product)` format. On install (and on **Reset**) it is picked
  randomly from the webcam entries of the
  [usb.ids](http://www.linux-usb.org/usb.ids) list (downloaded and parsed by
  `background.js`, keeping only webcam-like devices). If the download or parsing
  fails, it falls back to `Integrated Webcam (1bcf:2b95)`.
- **Fake deviceId** and **Fake groupId**: the identifiers that get exposed. They
  are generated **randomly (64-char hex)** on install (via `background.js`) and
  stored in `storage`, just like Chrome's real `deviceId`/`groupId` (SHA-256),
  which stay stable. The **Reset** button generates new ones.

### Microphone

The **Mic disguise** dropdown controls how microphones are handled:

- **Auto (linked to camera)** *(default)*: disguises the mic that belongs to the
  same physical device as the target camera (shares its `groupId`). It reuses the
  camera's fake `groupId` and a matching label (e.g.
  `Microphone (Integrated Webcam) (1bcf:2b95)`) so sites see a real built-in
  webcam + mic combo. If the camera has no linked mic (e.g. a virtual camera), it
  falls back to the system's default microphone.
- **Off (video only)**: leaves microphones untouched.
- **Custom (pick a mic)**: disguise a specific microphone with your own fake name,
  `deviceId` and `groupId`.

Real mic names are detected together with cameras (the **Detect cameras** button
and granted pages request mic permission too).

## Structure

- `manifest.json` - MV3 definition and content-script registration.
- `inject.js` - patches the mediaDevices APIs (MAIN world).
- `bridge.js` - bridge between `chrome.storage` and the page (ISOLATED world).
- `background.js` - service worker that persists random deviceId/groupId and picks a random webcam name from usb.ids.
- `popup.html` / `popup.js` - configuration UI.
- `request.html` / `request.js` - page that requests camera and microphone permission and detects the real names.

## Disclaimer

This software is provided **for educational and research purposes only**. The
author (**xViada**) is **not responsible** for any use, misuse, or consequences
arising from the use of this extension. You are solely responsible for ensuring
that your use complies with applicable laws, terms of service, and policies of
the websites or services you interact with. Use at your own risk.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 [xViada](https://github.com/xViada).
