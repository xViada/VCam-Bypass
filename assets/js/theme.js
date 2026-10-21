(function () {
  'use strict';

  var KEY = 'funding-theme';

  function icon(body) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      body +
      '</svg>'
    );
  }

  var sun = icon(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>'
  );
  var moon = icon('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>');

  var LABELS = {
    en: ['Switch to light theme', 'Switch to dark theme'],
    es: ['Cambiar al tema claro', 'Cambiar al tema oscuro'],
    pt: ['Mudar para o tema claro', 'Mudar para o tema escuro']
  };

  function themeLabel(isDark) {
    var lang = (document.documentElement.lang || 'en').slice(0, 2);
    return (LABELS[lang] || LABELS.en)[isDark ? 0 : 1];
  }

  function savedTheme() {
    try {
      var saved = localStorage.getItem(KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) {}
    return null;
  }

  function systemTheme() {
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function applyTheme(theme, explicit) {
    var button = document.getElementById('theme-toggle');
    var glyph = document.getElementById('theme-icon');
    if (!button || !glyph) return;
    button.hidden = false;
    if (explicit) {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    var isDark = theme === 'dark';
    glyph.innerHTML = isDark ? sun : moon;
    button.setAttribute('aria-label', themeLabel(isDark));
  }

  applyTheme(savedTheme() || systemTheme(), !!savedTheme());

  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = (savedTheme() || systemTheme()) === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
      try {
        localStorage.setItem(KEY, next);
      } catch (e) {}
    });
  }

  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () {
      if (!savedTheme()) applyTheme(systemTheme(), false);
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  // Closes the language menu when the page is clicked elsewhere or Escape is
  // pressed.
  document.addEventListener('click', function (event) {
    var menus = document.querySelectorAll('details.lang[open]');
    for (var i = 0; i < menus.length; i++) {
      if (!menus[i].contains(event.target)) menus[i].removeAttribute('open');
    }
  });
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var menu = document.querySelector('details.lang[open]');
    if (menu) {
      menu.removeAttribute('open');
      menu.querySelector('summary').focus();
    }
  });
})();
