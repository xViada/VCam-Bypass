(function () {
  "use strict";

  // Inline SVGs (extension CSP forbids inline handlers, so everything is built
  // here in an external script).
  const ICONS = {
    gif:
      '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m10 9 5 3-5 3z"/></svg>',
    screenshot:
      '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.6-3.6a2 2 0 0 0-2.8 0L6 20"/></svg>'
  };

  const LABELS = { gif: "GIF / clip", screenshot: "Screenshot" };

  function assetUrl(src) {
    try {
      return chrome.runtime.getURL(src);
    } catch (e) {
      return src;
    }
  }

  function buildPlaceholder(kind, label) {
    const ph = document.createElement("div");
    ph.className = "ph";

    const icon = document.createElement("span");
    icon.innerHTML = ICONS[kind] || ICONS.screenshot;
    ph.appendChild(icon.firstChild);

    const badge = document.createElement("span");
    badge.className = "kind";
    badge.textContent = LABELS[kind] || LABELS.screenshot;
    ph.appendChild(badge);

    if (label) {
      const p = document.createElement("p");
      p.textContent = label;
      ph.appendChild(p);
    }
    return ph;
  }

  document.querySelectorAll(".media").forEach((el) => {
    const src = el.getAttribute("data-src");
    const kind = el.getAttribute("data-kind") || "screenshot";
    const label = el.getAttribute("data-label") || "";

    el.appendChild(buildPlaceholder(kind, label));

    if (!src) return;
    const url = assetUrl(src);
    // Swap in the real asset only once it actually loads, so missing files just
    // keep the styled placeholder instead of showing a broken image.
    const probe = new Image();
    probe.onload = () => {
      el.style.backgroundImage = "url('" + url.replace(/'/g, "%27") + "')";
      el.classList.add("has-img");
    };
    probe.src = url;
  });
})();
