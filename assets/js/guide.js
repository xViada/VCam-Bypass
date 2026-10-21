(function () {
  'use strict';

  var root = document.getElementById('gd');
  if (!root) return;

  var reduceMotion =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var main = root.querySelector('.gd-main');
  var stage = root.querySelector('.gd-stage');
  var view = root.querySelector('.gd-view');
  var popup = root.querySelector('.gp');
  var cursor = root.querySelector('.gd-cursor');
  var address = root.querySelector('.gd-address-text');
  var scroller = root.querySelector('.xt-scroll');
  var micHint = root.querySelector('.gp-hint');
  var meter = root.querySelector('.xt-meter');
  var pauseButton = document.getElementById('gd-pause');
  var stepButtons = root.querySelectorAll('.gd-step');
  var captionNum = root.querySelector('.gd-caption-num');
  var captionTitle = root.querySelector('.gd-caption-title');
  var captionText = root.querySelector('.gd-caption-text');

  root.classList.add('is-js');

  var ADDRESS = {
    site: 'meet.example.com',
    request: 'chrome-extension://vcam-bypass/request.html',
    test: 'chrome-extension://vcam-bypass/test.html'
  };

  var DEFAULTS = {
    target: 'Select a webcam',
    model: 'Generic webcam',
    micmode: 'Off',
    micsel: 'Select a microphone'
  };

  var HINT_OFF = 'Only the webcam is masked; microphones keep their real identity.';
  var HINT_AUTO =
    "The mic you pick is masked as the emulated camera's built-in one: matching name, same groupId.";

  var CAMERA = 'HD Pro Webcam C920 (046d:082d)';
  var MIC = 'Microphone (HD Pro Webcam C920) (046d:082d)';

  // Where each step starts, used when a step button is clicked.
  var STEP_AT = { 1: 600, 2: 7800, 3: 10300, 4: 13000, 5: 17800, 6: 22400 };
  var LOOP = 33200;
  var STEPS = 6;

  var scale = 1;
  var viewHeight = 0;
  var cursorTarget = null;
  var scrollTarget = null;

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

  function target(name) {
    return root.querySelector('[data-t="' + name + '"]');
  }

  // ---------- Layout ----------

  // The stage has a fixed design size and is scaled to fit the column. Below
  // 640px it switches to a taller, narrower design so the text stays readable.
  function layout() {
    var avail = main.clientWidth;
    var narrow = avail < 640;
    var w = narrow ? 480 : 900;
    var h = narrow ? 640 : 620;
    scale = Math.min(1, avail / w);
    root.classList.toggle('is-narrow', narrow);
    root.style.setProperty('--w', w + 'px');
    root.style.setProperty('--h', h + 'px');
    root.style.setProperty('--s', scale);
    viewHeight = view.clientHeight;

    root.style.setProperty('--gp-s', Math.min(1, (viewHeight - 16) / popup.offsetHeight));

    // Each menu opens right under its own select. The microphone picker only
    // takes up room once the mask is on.
    var micOn = root.classList.contains('is-mic-on');
    root.classList.add('is-mic-on');
    root.querySelectorAll('.gp-menu').forEach(function (menu) {
      var select = menu.parentNode.querySelector('.gp-select');
      menu.style.top = select.offsetTop + select.offsetHeight + 2 + 'px';
    });
    root.classList.toggle('is-mic-on', micOn);
  }

  // ---------- Scene helpers ----------

  function scene(name) {
    root.setAttribute('data-scene', name);
    address.textContent = ADDRESS[name];
  }

  function moveTo(name) {
    cursorTarget = name;
    var el = name && target(name);
    if (!el) return;
    var box = stage.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    // The arrow tip sits at roughly (4, 3) inside the 22px cursor.
    var x = (r.left - box.left) / scale + Math.min(r.width / scale * 0.5, 60) - 4;
    var y = (r.top - box.top) / scale + (r.height / scale) * 0.55 - 3;
    cursor.style.setProperty('--x', x + 'px');
    cursor.style.setProperty('--y', y + 'px');
  }

  function rest() {
    cursorTarget = null;
    var box = stage.getBoundingClientRect();
    cursor.style.setProperty('--x', (box.width / scale) * 0.55 + 'px');
    cursor.style.setProperty('--y', (box.height / scale) * 0.7 + 'px');
  }

  function click() {
    cursor.classList.remove('is-click');
    void cursor.offsetWidth;
    cursor.classList.add('is-click');
  }

  function hover(name, on) {
    target(name).classList.toggle('is-hover', on !== false);
  }

  function clearHover() {
    root.querySelectorAll('.is-hover').forEach(function (el) {
      el.classList.remove('is-hover');
    });
  }

  function menu(name, open) {
    root.querySelector('[data-menu="' + name + '"]').classList.toggle('is-open', open);
    target(name).classList.toggle('is-focused', open);
    if (!open) {
      root.querySelectorAll('[data-menu="' + name + '"] li').forEach(function (li) {
        li.classList.remove('is-hover');
      });
    }
  }

  function value(name, text) {
    target(name).querySelector('.gp-value').textContent = text;
  }

  function setClass(name, on) {
    root.classList.toggle(name, on);
  }

  // Narrow screens show the current step as a caption under the animation.
  function setCaption(n) {
    var button = stepButtons[n - 1];
    captionNum.textContent = n;
    captionTitle.innerHTML = button.querySelector('.gd-step-title').innerHTML;
    captionText.innerHTML = button.querySelector('.gd-step-text').innerHTML;
  }

  function setStep(step) {
    setCaption(step || 1);
    stepButtons.forEach(function (button) {
      var n = Number(button.getAttribute('data-step'));
      button.classList.toggle('is-active', n === step);
      button.classList.toggle('is-done', n < step);
      if (n === step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
  }

  // Scrolls the test page so the named block sits at the top of the window.
  function scrollTest(name) {
    scrollTarget = name;
    var y = 0;
    if (name) {
      var el = target(name);
      var max = Math.max(0, scroller.offsetHeight - viewHeight);
      y = Math.max(0, Math.min(el.offsetTop - 12, max));
    }
    scroller.style.setProperty('--sy', -y + 'px');
  }

  function verdict(which, kind, title, text) {
    var box = root.querySelector('[data-v="' + which + '"]');
    box.className = 'xt-verdict ' + kind;
    box.querySelector('.xt-vtitle').textContent = title;
    box.querySelector('.xt-vtext').textContent = text;
  }

  function testPending() {
    root.setAttribute('data-cam', 'pending');
    root.setAttribute('data-mic', 'pending');
    meter.classList.remove('is-active');
    meter.querySelector('.xt-meter-hint').textContent = 'Speak or make a sound';
    meter.querySelector('.xt-meter-level').textContent = '—';
    verdict('cam', 'pending', 'Preparing camera test…', 'Grant camera access when your browser asks.');
    verdict('mic', 'pending', 'Preparing mic test…', 'Grant microphone access when your browser asks.');
  }

  function camOk() {
    root.setAttribute('data-cam', 'ok');
    verdict(
      'cam',
      'ok',
      'Camera mask is working',
      'The site sees "' + CAMERA + '" with a full physical-webcam capability set (10 controls). This camera looks real.'
    );
  }

  function micOk() {
    root.setAttribute('data-mic', 'ok');
    meter.classList.add('is-active');
    meter.querySelector('.xt-meter-hint').textContent = 'Audio detected';
    meter.querySelector('.xt-meter-level').textContent = '38%';
    verdict(
      'mic',
      'ok',
      'Mic mask is working',
      'The site sees "' + MIC + '" with a groupId matching the camera. This mic looks authentic.'
    );
  }

  function reset() {
    scene('site');
    root.setAttribute('data-site', 'idle');
    root.classList.remove(
      'is-popup-open',
      'is-switch-on',
      'is-eye-on',
      'is-saved',
      'is-cursor',
      'is-mic-on',
      'is-perm',
      'is-granted'
    );
    ['target', 'model', 'micmode', 'micsel'].forEach(function (name) {
      menu(name, false);
      value(name, DEFAULTS[name]);
    });
    clearHover();
    target('detect').textContent = 'Detect devices (grant permission)';
    micHint.textContent = HINT_OFF;
    testPending();
    scrollTest(null);
    setStep(0);
    rest();
  }

  // The whole walkthrough as [ms, action]. Every action only sets state, so
  // seek() can replay them all to jump to any point.
  var ACTIONS = [
    [0, reset],
    [300, function () { root.setAttribute('data-site', 'blocked'); }],
    [500, function () { setClass('is-cursor', true); }],

    // 1. Detect devices
    [600, function () { setStep(1); moveTo('ext'); }],
    [1500, function () { click(); setClass('is-popup-open', true); }],
    [2300, function () { moveTo('detect'); }],
    [3000, function () { click(); hover('detect'); }],
    [3250, function () { clearHover(); }],
    [3350, function () { setClass('is-popup-open', false); scene('request'); setClass('is-perm', true); }],
    [4100, function () { moveTo('allow'); }],
    [4900, function () { hover('allow'); }],
    [5000, function () { click(); setClass('is-perm', false); setClass('is-granted', true); clearHover(); }],
    [6400, function () {
      scene('site');
      setClass('is-granted', false);
      target('detect').textContent = 'Detect more devices';
      moveTo('ext');
    }],
    [7100, function () { click(); setClass('is-popup-open', true); }],

    // 2. Target webcam
    [7800, function () { setStep(2); moveTo('target'); }],
    [8500, function () { click(); menu('target', true); }],
    [9000, function () { moveTo('target-pick'); }],
    [9400, function () { hover('target-pick'); }],
    [9700, function () { click(); value('target', 'OBS Virtual Camera'); menu('target', false); }],

    // 3. Emulated model
    [10300, function () { setStep(3); moveTo('model'); }],
    [11000, function () { click(); menu('model', true); }],
    [11500, function () { moveTo('model-pick'); }],
    [11900, function () { hover('model-pick'); }],
    [12200, function () { click(); value('model', 'Logitech C920 (1080p)'); menu('model', false); }],

    // 4. Microphone
    [13000, function () { setStep(4); moveTo('micmode'); }],
    [13700, function () { click(); menu('micmode', true); }],
    [14200, function () { moveTo('micmode-pick'); }],
    [14600, function () { hover('micmode-pick'); }],
    [14900, function () {
      click();
      value('micmode', 'Auto');
      menu('micmode', false);
      setClass('is-mic-on', true);
      micHint.textContent = HINT_AUTO;
    }],
    [15500, function () { moveTo('micsel'); }],
    [16100, function () { click(); menu('micsel', true); }],
    [16600, function () { moveTo('micsel-pick'); }],
    [17000, function () { hover('micsel-pick'); }],
    [17300, function () { click(); value('micsel', 'Microphone (Realtek Audio)'); menu('micsel', false); }],

    // 5. Enable, hide the other devices, save
    [17800, function () { setStep(5); moveTo('switch'); }],
    [18400, function () { click(); setClass('is-switch-on', true); }],
    [18900, function () { moveTo('eye'); }],
    [19500, function () { click(); setClass('is-eye-on', true); }],
    [20000, function () { moveTo('save'); }],
    [20600, function () { click(); hover('save'); setClass('is-saved', true); }],
    [20800, function () { clearHover(); }],
    [22000, function () { setClass('is-saved', false); }],

    // 6. Verify
    [22400, function () { setStep(6); moveTo('test'); }],
    [23000, function () { click(); hover('test'); }],
    [23300, function () { clearHover(); setClass('is-popup-open', false); scene('test'); testPending(); scrollTest(null); }],
    [24300, camOk],
    [24600, micOk],
    [25300, function () { scrollTest('camreport'); }],
    [26700, function () { scrollTest('mic'); }],

    // Still step 6: back on the site, reload
    [28900, function () { scene('site'); moveTo('reload'); }],
    [29700, function () { click(); hover('reload'); root.setAttribute('data-site', 'ok'); }],
    [29950, function () { clearHover(); }]
  ];

  // ---------- Playback ----------

  var time = 0;
  var paused = false;
  var visible = false;
  var last = 0;

  function runUpTo(from, to) {
    ACTIONS.forEach(function (action) {
      if (action[0] >= from && action[0] < to) action[1]();
    });
  }

  // Applies every action up to and including `at` instantly, then carries on.
  function seek(at) {
    root.classList.add('no-motion');
    runUpTo(0, at + 1);
    time = at + 1;
    if (reduceMotion) setClass('is-cursor', false);
    void root.offsetWidth;
    root.classList.remove('no-motion');
  }

  function progress() {
    var current = 0;
    for (var n = 1; n <= STEPS; n++) if (time >= STEP_AT[n]) current = n;
    if (!current) return;
    var from = STEP_AT[current];
    var to = current < STEPS ? STEP_AT[current + 1] : LOOP;
    stepButtons[current - 1].style.setProperty('--p', Math.min(1, (time - from) / (to - from)));
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
      progress();
    }
    window.requestAnimationFrame(frame);
  }

  function onResize() {
    root.classList.add('no-motion');
    layout();
    if (cursorTarget) moveTo(cursorTarget);
    else rest();
    if (scrollTarget) scrollTest(scrollTarget);
    void root.offsetWidth;
    root.classList.remove('no-motion');
  }

  stepButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var step = Number(button.getAttribute('data-step'));
      stepButtons.forEach(function (b) { b.style.removeProperty('--p'); });
      if (reduceMotion) {
        // No animation: show the state right after the step is done.
        seek((step === STEPS ? LOOP : STEP_AT[step + 1]) - 1);
        setStep(step);
        return;
      }
      seek(STEP_AT[step]);
      progress();
    });
  });

  pauseButton.hidden = reduceMotion;
  pauseButton.addEventListener('click', function () {
    paused = !paused;
    pauseButton.setAttribute('aria-pressed', String(paused));
    pauseButton.setAttribute('aria-label', document.documentElement.lang === 'es'
      ? (paused ? 'Reproducir animación' : 'Pausar animación')
      : (paused ? 'Play animation' : 'Pause animation'));
  });

  onVisible(root, function (isVisible) {
    visible = isVisible;
  });

  window.addEventListener('resize', onResize);
  layout();

  // A smooth, repeating waveform for the test page's audio meter. Its period is
  // 400 units, the distance the animation slides it by.
  (function wave() {
    var d = '';
    for (var x = 0; x <= 800; x += 4) {
      var swell = 0.6 + 0.4 * Math.sin((x * 2 * Math.PI) / 400);
      var y = 50 + 26 * swell * Math.sin((x * 2 * Math.PI) / 56);
      d += (x ? 'L' : 'M') + x + ' ' + y.toFixed(1);
    }
    root.querySelector('.xt-wave-path').setAttribute('d', d);
  })();

  if (reduceMotion) {
    seek(STEP_AT[2] - 1);
    setStep(1);
  } else {
    seek(0);
    window.requestAnimationFrame(frame);
  }
})();
