(function () {
  'use strict';

  var reduceMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Calls fn(isVisible) whenever el scrolls in or out of view.
  function onVisible(el, fn) {
    if (!('IntersectionObserver' in window)) {
      fn(true);
      return;
    }
    new IntersectionObserver(
      function (entries) {
        fn(entries[0].isIntersecting);
      },
      { threshold: 0.3 }
    ).observe(el);
  }

  // ---------- How it works ----------

  function howItWorks() {
    var root = document.getElementById('demo');
    if (!root) return;

    var browser = root.querySelector('.browser');
    var popup = root.querySelector('.vp');
    var cursor = root.querySelector('.demo-cursor');
    var caption = document.getElementById('demo-caption');
    var count = document.getElementById('demo-count');
    var pauseButton = document.getElementById('demo-pause');
    var stepButtons = root.querySelectorAll('.demo-step');

    var lang = (document.documentElement.lang || 'en').slice(0, 2);
    var TEXTS = {
      en: {
        before: 'Websites can tell your camera is virtual.',
        1: 'Open VCam Bypass and pick the virtual camera you use.',
        2: 'Choose the real webcam it should look like.',
        3: 'Turn it on and save, then reload the page.',
        after: 'Same video, new identity: the site now sees a real webcam.',
        play: 'Play animation',
        pause: 'Pause animation'
      },
      es: {
        before: 'Las webs pueden saber que tu cámara es virtual.',
        1: 'Abre VCam Bypass y elige la cámara virtual que usas.',
        2: 'Elige la webcam real a la que debe parecerse.',
        3: 'Actívala y guarda, luego recarga la página.',
        after: 'Mismo vídeo, nueva identidad: ahora la web ve una webcam real.',
        play: 'Reproducir animación',
        pause: 'Pausar animación'
      },
      pt: {
        before: 'Os sites conseguem saber que sua câmera é virtual.',
        1: 'Abra o VCam Bypass e escolha a câmera virtual que você usa.',
        2: 'Escolha a webcam real com que ela deve se parecer.',
        3: 'Ative e salve, depois recarregue a página.',
        after: 'Mesmo vídeo, nova identidade: agora o site vê uma webcam real.',
        play: 'Reproduzir animação',
        pause: 'Pausar animação'
      }
    };
    var TEXT = TEXTS[lang] || TEXTS.en;
    var CAPTIONS = TEXT;

    // Where each step starts, used when a step button is clicked.
    var STEP_AT = { 1: 1800, 2: 5700, 3: 8100 };
    // Right after Save, before the popup closes.
    var SAVED_AT = 10100;
    var LOOP = 16500;

    var cursorTarget = null;
    var countTimer = 0;
    var captionTimer = 0;

    function target(name) {
      return root.querySelector('[data-demo-target="' + name + '"]');
    }

    function moveTo(name) {
      cursorTarget = name;
      var el = name && target(name);
      if (!el) return;
      var box = browser.getBoundingClientRect();
      var r = el.getBoundingClientRect();
      // The arrow tip sits at roughly (4, 3) inside the 22px cursor.
      var x = r.left - box.left + Math.min(r.width * 0.5, 60) - 4;
      var y = r.top - box.top + r.height * 0.55 - 3;
      cursor.style.setProperty('--x', x + 'px');
      cursor.style.setProperty('--y', y + 'px');
    }

    function rest() {
      cursorTarget = null;
      var box = browser.getBoundingClientRect();
      cursor.style.setProperty('--x', box.width * 0.42 + 'px');
      cursor.style.setProperty('--y', box.height * 0.62 + 'px');
    }

    function click() {
      cursor.classList.remove('is-click');
      void cursor.offsetWidth;
      cursor.classList.add('is-click');
    }

    function setCaption(key) {
      var text = CAPTIONS[key];
      // Cancel a fade still in flight so it can't write an older caption.
      window.clearTimeout(captionTimer);
      caption.classList.remove('is-changing');
      if (caption.textContent === text) return;
      if (root.classList.contains('no-motion')) {
        caption.textContent = text;
        return;
      }
      caption.classList.add('is-changing');
      captionTimer = window.setTimeout(function () {
        caption.textContent = text;
        caption.classList.remove('is-changing');
      }, 250);
    }

    function setStep(step) {
      stepButtons.forEach(function (button) {
        var n = Number(button.getAttribute('data-step'));
        button.classList.toggle('is-active', n === step);
        button.classList.toggle('is-done', step === 'done' || n < step);
        if (n === step) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
    }

    function menu(name, open) {
      root.querySelector('[data-menu="' + name + '"]').classList.toggle('is-open', open);
      root.querySelector('[data-demo-menu="' + name + '"]').classList.toggle('is-focused', open);
      if (!open) {
        root.querySelectorAll('[data-menu="' + name + '"] li').forEach(function (li) {
          li.classList.remove('is-hover');
        });
      }
    }

    function hover(name) {
      target(name).classList.add('is-hover');
    }

    function choose(name, full) {
      var value = target(name).querySelector('.vp-value');
      value.textContent = value.getAttribute(full ? 'data-full' : 'data-empty');
    }

    function setCount(to, animate) {
      window.clearInterval(countTimer);
      var from = Number(count.textContent);
      if (!animate || from === to) {
        count.textContent = to;
        return;
      }
      countTimer = window.setInterval(function () {
        from += from < to ? 1 : -1;
        count.textContent = from;
        if (from === to) window.clearInterval(countTimer);
      }, 65);
    }

    function reset() {
      root.setAttribute('data-scene', 'before');
      root.classList.remove('is-popup-open', 'is-switch-on', 'is-saved', 'is-cursor');
      menu('target', false);
      menu('model', false);
      choose('target', false);
      choose('model', false);
      target('save').classList.remove('is-pressed');
      setCount(2, false);
      setStep(0);
      setCaption('before');
      rest();
    }

    var ACTIONS = [
      [0, reset],
      [900, function () { root.classList.add('is-cursor'); }],
      [1800, function () { moveTo('ext'); }],
      [2600, function () { click(); root.classList.add('is-popup-open'); setStep(1); setCaption(1); }],
      [3300, function () { moveTo('target'); }],
      [4000, function () { click(); menu('target', true); }],
      [4500, function () { moveTo('target-pick'); }],
      [4900, function () { hover('target-pick'); }],
      [5200, function () { click(); choose('target', true); menu('target', false); }],
      [5700, function () { setStep(2); setCaption(2); moveTo('model'); }],
      [6400, function () { click(); menu('model', true); }],
      [6900, function () { moveTo('model-pick'); }],
      [7300, function () { hover('model-pick'); }],
      [7600, function () { click(); choose('model', true); menu('model', false); }],
      [8100, function () { setStep(3); setCaption(3); moveTo('switch'); }],
      [8800, function () { click(); root.classList.add('is-switch-on'); }],
      [9300, function () { moveTo('save'); }],
      [10000, function () { click(); target('save').classList.add('is-pressed'); root.classList.add('is-saved'); }],
      [10200, function () { target('save').classList.remove('is-pressed'); }],
      [11400, function () { root.classList.remove('is-popup-open', 'is-saved'); rest(); }],
      [11800, function () {
        root.setAttribute('data-scene', 'after');
        root.classList.remove('is-cursor');
        setStep('done');
        setCaption('after');
        setCount(12, !root.classList.contains('no-motion'));
      }]
    ];

    var time = 0;
    var paused = false;
    var visible = false;
    var last = 0;

    function runUpTo(from, to) {
      ACTIONS.forEach(function (action) {
        if (action[0] >= from && action[0] < to) action[1]();
      });
    }

    // Applies every action before `at` instantly, then carries on from there.
    function seek(at) {
      at = Math.max(at, 1);
      root.classList.add('no-motion');
      runUpTo(0, at);
      time = at;
      if (reduceMotion) root.classList.remove('is-cursor');
      void root.offsetWidth;
      root.classList.remove('no-motion');
    }

    function frame(now) {
      var dt = last ? Math.min(now - last, 100) : 0;
      last = now;
      if (!paused && visible && !document.hidden) {
        var next = time + dt;
        runUpTo(time, next);
        time = next;
        if (time >= LOOP) {
          time = 0;
          runUpTo(0, 1);
          time = 1;
        }
      }
      window.requestAnimationFrame(frame);
    }

    function scalePopup() {
      var room = browser.clientWidth - 20;
      root.style.setProperty('--vp-scale', Math.min(1, room / popup.offsetWidth));
    }

    function onResize() {
      scalePopup();
      root.classList.add('no-motion');
      if (cursorTarget) moveTo(cursorTarget);
      else rest();
      void root.offsetWidth;
      root.classList.remove('no-motion');
    }

    stepButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        var step = Number(button.getAttribute('data-step'));
        if (reduceMotion) {
          // No animation: show the state right after the step is done.
          var end = step === 3 ? SAVED_AT : STEP_AT[step + 1];
          seek(end);
          setStep(step);
          setCaption(step);
          return;
        }
        seek(STEP_AT[step]);
      });
    });

    pauseButton.hidden = reduceMotion;
    pauseButton.addEventListener('click', function () {
      paused = !paused;
      pauseButton.setAttribute('aria-pressed', String(paused));
      pauseButton.setAttribute('aria-label', paused ? TEXT.play : TEXT.pause);
    });

    onVisible(root, function (isVisible) {
      visible = isVisible;
    });

    window.addEventListener('resize', onResize);
    scalePopup();

    if (reduceMotion) {
      seek(LOOP);
    } else {
      seek(0);
      window.requestAnimationFrame(frame);
    }
  }

  // ---------- Features ----------

  function features() {
    var root = document.getElementById('feat');
    if (!root) return;

    var items = root.querySelectorAll('.feat-item');
    var rows = root.querySelector('.feat-rows');
    var camLabel = document.getElementById('feat-cam-label');
    var camId = document.getElementById('feat-cam-id');
    var micLabel = document.getElementById('feat-mic-label');
    var micId = document.getElementById('feat-mic-id');

    var CAMERAS = [
      'HD Pro Webcam C920 (046d:082d)',
      'C922 Pro Stream Webcam (046d:085c)',
      'Logitech BRIO (046d:086b)',
      'Microsoft® LifeCam HD-3000 (045e:0779)'
    ];
    var ORDER = Array.prototype.map.call(items, function (item) {
      return item.getAttribute('data-feature');
    });
    var DWELL = 3600;

    var current = '';
    var timers = [];
    var autoTimer = 0;
    var hovering = false;
    var visible = false;

    function later(fn, ms) {
      timers.push(window.setTimeout(fn, ms));
    }

    // Same naming the extension uses for a masked mic.
    function micFor(camera) {
      var m = camera.match(/^(.*) \(([0-9a-f]{4}:[0-9a-f]{4})\)$/);
      return 'Microphone (' + m[1] + ') (' + m[2] + ')';
    }

    function swapText(el, text) {
      if (el.textContent === text) return;
      el.classList.add('is-changing');
      later(function () {
        el.textContent = text;
        el.classList.remove('is-changing');
      }, 200);
    }

    function hex(n) {
      var out = '';
      for (var i = 0; i < n; i++) out += '0123456789abcdef'[Math.floor(Math.random() * 16)];
      return out;
    }

    function shortId() {
      return hex(12) + '…' + hex(3);
    }

    function scramble(el) {
      var finalId = shortId();
      var ticks = 0;
      var timer = window.setInterval(function () {
        ticks += 1;
        el.textContent = ticks < 10 ? shortId() : finalId;
        if (ticks >= 10) window.clearInterval(timer);
      }, 55);
      timers.push(timer);
    }

    function clearTimers() {
      timers.forEach(function (t) {
        window.clearTimeout(t);
        window.clearInterval(t);
      });
      timers = [];
    }

    function show(name) {
      if (name === current) return;
      current = name;
      clearTimers();

      root.setAttribute('data-feature', name);
      root.classList.remove('is-hiding');
      items.forEach(function (item) {
        var on = item.getAttribute('data-feature') === name;
        item.classList.toggle('is-active', on);
        item.setAttribute('aria-pressed', String(on));
      });
      // A swap cut short by clearTimers would leave its label faded out.
      camLabel.classList.remove('is-changing');
      micLabel.classList.remove('is-changing');
      swapText(camLabel, CAMERAS[0]);
      swapText(micLabel, micFor(CAMERAS[0]));

      if (name === 'profiles') {
        var i = 0;
        var cycle = function () {
          i = (i + 1) % CAMERAS.length;
          swapText(camLabel, CAMERAS[i]);
          swapText(micLabel, micFor(CAMERAS[i]));
          later(cycle, 850);
        };
        later(cycle, 700);
      } else if (name === 'mic') {
        swapText(micLabel, micLabel.getAttribute('data-real'));
        later(function () {
          swapText(micLabel, micFor(CAMERAS[0]));
        }, 1100);
      } else if (name === 'hide') {
        later(function () {
          root.classList.add('is-hiding');
        }, 700);
      } else if (name === 'identity') {
        later(function () {
          scramble(camId);
          scramble(micId);
        }, 400);
      }
    }

    function schedule() {
      window.clearTimeout(autoTimer);
      if (reduceMotion || hovering || !visible || document.hidden) return;
      autoTimer = window.setTimeout(function () {
        show(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]);
        schedule();
      }, DWELL);
    }

    items.forEach(function (item) {
      var name = item.getAttribute('data-feature');
      item.addEventListener('click', function () {
        show(name);
      });
      item.addEventListener('mouseenter', function () {
        show(name);
      });
      item.addEventListener('focus', function () {
        show(name);
      });
    });

    var list = root.querySelector('.feat-list');
    list.addEventListener('mouseenter', function () {
      hovering = true;
      schedule();
    });
    list.addEventListener('mouseleave', function () {
      hovering = false;
      schedule();
    });

    // Keep the card height steady while the other devices collapse.
    function lockHeight() {
      var hiding = root.classList.contains('is-hiding');
      root.classList.add('is-measuring');
      root.classList.remove('is-hiding');
      rows.style.minHeight = '';
      rows.style.minHeight = rows.offsetHeight + 'px';
      root.classList.toggle('is-hiding', hiding);
      void rows.offsetHeight;
      root.classList.remove('is-measuring');
    }

    onVisible(root, function (isVisible) {
      visible = isVisible;
      schedule();
    });
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('resize', lockHeight);

    show(ORDER[0]);
    lockHeight();
    schedule();
  }

  // ---------- Installation ----------

  function installation() {
    var root = document.getElementById('inst');
    if (!root) return;

    var items = root.querySelectorAll('.inst-item');
    var LAST = items.length;
    var DWELL = 2700;

    // Levels are cumulative (by step 3 Developer mode is already on). Step 3
    // walks through three: the card appears, the puzzle menu opens, it's pinned.
    var PHASES = { 1: [1], 2: [2], 3: [3, 4, 5] };
    var PHASE_AT = [700, 1900, 2700];
    var MAX_LEVEL = 5;

    var step = 0;
    var phaseTimers = [];
    var autoTimer = 0;
    var hovering = false;
    var visible = false;

    function setLevel(level) {
      for (var i = 1; i <= MAX_LEVEL; i++) root.classList.toggle('is-l' + i, i <= level);
    }

    function show(n) {
      if (n === step) return;
      step = n;
      phaseTimers.forEach(window.clearTimeout);
      phaseTimers = [];
      root.setAttribute('data-step', String(n));
      items.forEach(function (item) {
        var on = Number(item.getAttribute('data-step')) === n;
        item.classList.toggle('is-active', on);
        var head = item.querySelector('.inst-head');
        if (on) head.setAttribute('aria-current', 'step');
        else head.removeAttribute('aria-current');
      });
      // Show the step's starting state first, then what it changes.
      var levels = PHASES[n];
      setLevel(levels[0] - 1);
      levels.forEach(function (level, i) {
        phaseTimers.push(window.setTimeout(function () {
          setLevel(level);
        }, reduceMotion ? 0 : PHASE_AT[i]));
      });
    }

    function schedule() {
      window.clearTimeout(autoTimer);
      if (reduceMotion || hovering || !visible || document.hidden) return;
      autoTimer = window.setTimeout(function () {
        show((step % LAST) + 1);
        schedule();
      }, PHASE_AT[PHASES[step].length - 1] + DWELL);
    }

    items.forEach(function (item) {
      var n = Number(item.getAttribute('data-step'));
      var head = item.querySelector('.inst-head');
      head.addEventListener('click', function () {
        show(n);
      });
      head.addEventListener('focus', function () {
        show(n);
      });
      item.addEventListener('mouseenter', function () {
        show(n);
      });
    });

    var list = root.querySelector('.inst-list');
    list.addEventListener('mouseenter', function () {
      hovering = true;
      schedule();
    });
    list.addEventListener('mouseleave', function () {
      hovering = false;
      schedule();
    });

    onVisible(root, function (isVisible) {
      visible = isVisible;
      schedule();
    });
    document.addEventListener('visibilitychange', schedule);

    show(1);
    schedule();
  }

  // Points the download button at the latest release zip. If GitHub can't be
  // reached the button keeps linking to the releases page.
  function latestRelease() {
    var link = document.getElementById('download-latest');
    if (!link || !window.fetch) return;

    var KEY = 'vcam-latest-release';

    function apply(release) {
      if (!release || !release.tag) return;
      document.getElementById('download-label').textContent = ({ es: 'Descargar ', pt: 'Baixar ' }[(document.documentElement.lang || '').slice(0, 2)] || 'Download ') + release.tag;
      var heroVersion = document.getElementById('hero-version');
      if (heroVersion) heroVersion.hidden = false;
      if (release.url) link.href = release.url;
      document.querySelectorAll('[data-release-version]').forEach(function (el) {
        el.textContent = release.tag.replace(/^v/, '');
      });
      if (release.file) {
        document.querySelectorAll('[data-release-file]').forEach(function (el) {
          el.textContent = release.file;
        });
        document.querySelectorAll('[data-release-folder]').forEach(function (el) {
          el.textContent = release.file.replace(/\.zip$/i, '');
        });
      }
    }

    try {
      var cached = JSON.parse(sessionStorage.getItem(KEY));
      if (cached) {
        apply(cached);
        return;
      }
    } catch (e) {}

    fetch('https://api.github.com/repos/xViada/VCam-Bypass/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' }
    })
      .then(function (response) {
        if (!response.ok) throw new Error(response.status);
        return response.json();
      })
      .then(function (data) {
        var zip = (data.assets || []).filter(function (asset) {
          return /\.zip$/i.test(asset.name);
        })[0];
        var release = {
          tag: data.tag_name,
          url: zip ? zip.browser_download_url : '',
          file: zip ? zip.name : ''
        };
        apply(release);
        try {
          sessionStorage.setItem(KEY, JSON.stringify(release));
        } catch (e) {}
      })
      .catch(function () {});
  }

  // Shows the star count and the current version in the hero. Both stay hidden
  // if GitHub can't be reached.
  function heroStats() {
    var stars = document.getElementById('hero-stars');
    if (!stars || !window.fetch) return;

    var KEY = 'vcam-repo-stats';

    function apply(stats) {
      if (!stats) return;
      if (stats.stars > 0) {
        stars.textContent = stats.stars >= 1000
          ? (stats.stars / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
          : String(stats.stars);
        stars.hidden = false;
      }
    }

    try {
      var cached = JSON.parse(sessionStorage.getItem(KEY));
      if (cached) {
        apply(cached);
        return;
      }
    } catch (e) {}

    fetch('https://api.github.com/repos/xViada/VCam-Bypass', {
      headers: { Accept: 'application/vnd.github+json' }
    })
      .then(function (response) {
        if (!response.ok) throw new Error(response.status);
        return response.json();
      })
      .then(function (data) {
        var stats = { stars: Number(data.stargazers_count) || 0 };
        apply(stats);
        try {
          sessionStorage.setItem(KEY, JSON.stringify(stats));
        } catch (e) {}
      })
      .catch(function () {});
  }

  howItWorks();
  features();
  installation();
  latestRelease();
  heroStats();
})();
