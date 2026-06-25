(function () {
  "use strict";

  const mergeDeviceLabels = self.__vcamShared.mergeDeviceLabels;

  const statusEl = document.getElementById("status");
  const listEl = document.getElementById("list");

  function setStatus(msg, color) {
    statusEl.textContent = msg;
    statusEl.style.color = color || "#f0f0f0";
  }

  function renderGroup(title, items) {
    if (!items.length) return;
    const heading = document.createElement("p");
    heading.textContent = title;
    heading.style.margin = "12px 0 4px";
    listEl.appendChild(heading);

    const ul = document.createElement("ul");
    items.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      ul.appendChild(li);
    });
    listEl.appendChild(ul);
  }

  function requestAndDetect() {
    setStatus("Requesting permission...");
    listEl.innerHTML = "";

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("This browser does not support media access.", "#e06c75");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        return navigator.mediaDevices.enumerateDevices();
      })
      .then((devices) => {
        const cams = [];
        const mics = [];
        devices.forEach((d) => {
          if (d.kind === "videoinput" && d.label) cams.push(d.label);
          if (d.kind === "audioinput" && d.label) mics.push(d.label);
        });

        return Promise.all([
          mergeDeviceLabels("__availableCameras", cams),
          mergeDeviceLabels("__availableMics", mics)
        ]).then(() => {
          if (!cams.length && !mics.length) {
            setStatus("Permission granted but no named devices were detected.", "#e5c07b");
            return;
          }
          setStatus("Permission granted. Detected devices:", "#6cc070");
          renderGroup("Cameras:", cams);
          renderGroup("Microphones:", mics);

          const hint = document.createElement("p");
          hint.textContent = "You can now close this tab and pick devices in the popup.";
          listEl.appendChild(hint);
        });
      })
      .catch((e) => {
        setStatus("Permission was not granted (" + (e && e.name ? e.name : "error") + ").", "#e06c75");
      });
  }

  document.getElementById("retry").addEventListener("click", requestAndDetect);
  requestAndDetect();
})();
