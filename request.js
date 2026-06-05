(function () {
  "use strict";

  var statusEl = document.getElementById("status");
  var listEl = document.getElementById("list");

  function setStatus(msg, color) {
    statusEl.textContent = msg;
    statusEl.style.color = color || "#f0f0f0";
  }

  function storeCameras(labels) {
    return new Promise(function (resolve) {
      chrome.storage.local.get({ __availableCameras: [] }, function (s) {
        var merged = ((s && s.__availableCameras) || []).slice();
        labels.forEach(function (l) {
          if (l && merged.indexOf(l) < 0) merged.push(l);
        });
        chrome.storage.local.set({ __availableCameras: merged }, resolve);
      });
    });
  }

  function requestAndDetect() {
    setStatus("Requesting permission...");
    listEl.innerHTML = "";

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("This browser does not support camera access.", "#e06c75");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then(function (stream) {
        stream.getTracks().forEach(function (t) {
          t.stop();
        });
        return navigator.mediaDevices.enumerateDevices();
      })
      .then(function (devices) {
        var cams = [];
        devices.forEach(function (d) {
          if (d.kind === "videoinput" && d.label) cams.push(d.label);
        });
        return storeCameras(cams).then(function () {
          if (cams.length) {
            setStatus("Permission granted. Detected cameras:", "#6cc070");
            var ul = document.createElement("ul");
            cams.forEach(function (c) {
              var li = document.createElement("li");
              li.textContent = c;
              ul.appendChild(li);
            });
            listEl.appendChild(ul);
            var hint = document.createElement("p");
            hint.textContent =
              "You can now close this tab and pick the camera in the popup.";
            listEl.appendChild(hint);
          } else {
            setStatus(
              "Permission granted but no named cameras were detected.",
              "#e5c07b"
            );
          }
        });
      })
      .catch(function (e) {
        setStatus(
          "Permission was not granted (" + (e && e.name ? e.name : "error") + ").",
          "#e06c75"
        );
      });
  }

  document.getElementById("retry").addEventListener("click", requestAndDetect);
  requestAndDetect();
})();
