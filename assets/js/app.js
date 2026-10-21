(function () {
  'use strict';

  var QR_CELL = 12;
  var QR_MARGIN = 4;

  var config = window.FUNDING_CONFIG || {};

  var LANG = (document.documentElement.lang || 'en').slice(0, 2);

  // Texts the page adds itself. English is the default; the other languages
  // mirror it key by key.
  var STRINGS = {
    en: {
      accepted: 'Accepted: ',
      copied: 'Copied',
      addressCopied: function (name) { return name + ' address copied'; },
      copyFailed: 'Could not copy. Select the address manually.',
      copyAddress: 'Copy address',
      openInWallet: 'Open in wallet',
      downloadQr: 'Download QR',
      notConfigured: 'Not configured yet',
      notPublished: 'Address not published yet.',
      copy: 'Copy',
      viewQr: 'View QR',
      copyLabel: function (name) { return 'Copy the ' + name + ' address'; },
      qrLabel: function (name) { return 'View the ' + name + ' QR code'; },
      qrFor: function (name) { return 'QR code for the ' + name + ' address'; },
      qrFailed: 'Could not generate the QR code',
      thisProject: 'this project',
      support: function (name) { return 'Support ' + name; },
      donate: 'Donate',
      sourceOfPage: 'Source of this page',
      footer: function (license) {
        return license + ' licensed. No analytics or tracking. Donations are voluntary and do not unlock features.';
      }
    },
    es: {
      accepted: 'Aceptados: ',
      copied: 'Copiado',
      addressCopied: function (name) { return 'Dirección de ' + name + ' copiada'; },
      copyFailed: 'No se pudo copiar. Selecciona la dirección manualmente.',
      copyAddress: 'Copiar dirección',
      openInWallet: 'Abrir en la cartera',
      downloadQr: 'Descargar QR',
      notConfigured: 'Aún sin configurar',
      notPublished: 'Dirección aún sin publicar.',
      copy: 'Copiar',
      viewQr: 'Ver QR',
      copyLabel: function (name) { return 'Copiar la dirección de ' + name; },
      qrLabel: function (name) { return 'Ver el código QR de ' + name; },
      qrFor: function (name) { return 'Código QR de la dirección de ' + name; },
      qrFailed: 'No se pudo generar el código QR',
      thisProject: 'este proyecto',
      support: function (name) { return 'Apoya ' + name; },
      donate: 'Donar',
      sourceOfPage: 'Código de esta página',
      footer: function (license) {
        return 'Licenciado bajo ' + license + '. Sin analíticas ni rastreo. Las donaciones son voluntarias y no desbloquean funciones.';
      }
    },
    pt: {
      accepted: 'Aceitos: ',
      copied: 'Copiado',
      addressCopied: function (name) { return 'Endereço de ' + name + ' copiado'; },
      copyFailed: 'Não foi possível copiar. Selecione o endereço manualmente.',
      copyAddress: 'Copiar endereço',
      openInWallet: 'Abrir na carteira',
      downloadQr: 'Baixar QR',
      notConfigured: 'Ainda não configurado',
      notPublished: 'Endereço ainda não publicado.',
      copy: 'Copiar',
      viewQr: 'Ver QR',
      copyLabel: function (name) { return 'Copiar o endereço de ' + name; },
      qrLabel: function (name) { return 'Ver o código QR de ' + name; },
      qrFor: function (name) { return 'Código QR do endereço de ' + name; },
      qrFailed: 'Não foi possível gerar o código QR',
      thisProject: 'este projeto',
      support: function (name) { return 'Apoie o ' + name; },
      donate: 'Doar',
      sourceOfPage: 'Código desta página',
      footer: function (license) {
        return 'Licenciado sob a ' + license + '. Sem análises nem rastreamento. As doações são voluntárias e não liberam recursos.';
      }
    }
  };
  var T = STRINGS[LANG] || STRINGS.en;

  // Translated copies of the texts that live in config.js. Only words are
  // replaced: links, addresses and ids always come from the config itself.
  (function localize() {
    var table = (window.FUNDING_I18N || {})[LANG];
    if (!table) return;
    if (table.summary && config.project) config.project.summary = table.summary;
    (config.platforms || []).forEach(function (platform) {
      var tr = (table.platforms || {})[platform.id];
      if (!tr) return;
      if (tr.description) platform.description = tr.description;
      if (tr.ctaLabel) platform.ctaLabel = tr.ctaLabel;
    });
    (config.wallets || []).forEach(function (wallet) {
      var tr = (table.wallets || {})[wallet.id];
      if (!tr) return;
      if (tr.network) wallet.network = tr.network;
      if (tr.note) wallet.note = tr.note;
    });
  })();

  function svg(viewBox, body, stroke) {
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' +
      viewBox +
      '" fill="' +
      (stroke ? 'none' : 'currentColor') +
      '"' +
      (stroke
        ? ' stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
        : '') +
      ' aria-hidden="true" focusable="false">' +
      body +
      '</svg>'
    );
  }

  var ICONS = {
    github: svg(
      '0 0 24 24',
      '<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>'
    ),
    discord: svg(
      '0 0 24 24',
      '<path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>'
    ),
    kofi: svg(
      '71.7 139 512 396.1',
      '<path d="M313.8 139C403.6 139 426.8 140.1 460.1 143.4C538.2 151.2 583.7 199.4 583.7 268.6L583.7 277.5C583.7 341.8 536.6 394.4 472.9 399.9C467.9 416.5 460.1 433.1 449.6 449.8C425.2 487.5 376.5 535.1 286.7 535.1L269 535.1C195.9 535.1 139.3 503.5 105.5 445.9C75.6 395.5 71.7 339.5 71.7 264.7C71.7 191 116.1 151.1 168.1 144.5C207.4 139.5 256.2 139 313.8 139zM313.8 180.6C253.4 180.6 210.2 181.1 177.5 186.1C131.5 192.8 113.2 218.8 113.2 265.3L113.4 291C114.6 348.3 120.5 388.1 140.9 425.5C167.5 474.8 215.7 493.7 270.6 493.7L287.8 493.7C359.8 493.7 394.8 458.8 414.1 428.3C423.5 412.8 431.8 395.6 436.3 374L439.6 360.2L459.5 360.2C503.8 360.2 542.1 324.2 542.1 278.2L542.1 269.9C542.1 218.4 509.9 191.2 454 184.6C422.4 181.8 403.6 180.7 313.8 180.7zM331 233.2C369.2 233.2 395.8 264.8 395.8 300.2C395.8 332.9 377.5 361.2 353.7 383.3C338.7 398.3 314.4 413.8 297.8 423.8C293.4 426.6 287.8 428.2 281.1 428.2C275.6 428.2 270.6 426.5 265.6 423.8C249 413.8 224.6 398.3 209.1 383.3C187.3 362.5 169.9 336.4 167.8 306.3L167.6 300.2C167.6 264.7 193.1 233.2 231.9 233.2C254.6 233.2 270.7 244.8 281.2 260.9C292.8 244.8 308.4 233.2 331.1 233.2zM453.5 229.3C481.8 229.3 497.3 245.9 497.3 272.5C497.3 299.1 481.8 315.2 453.5 315.2C444.6 315.2 439.7 310.2 439.7 303.5L439.7 240.9C439.7 234.2 444.7 229.3 453.5 229.3z"/>'
    ),
    heart: svg(
      '0 0 16 16',
      '<path d="M4.25 2.5c-1.336 0-2.75 1.164-2.75 3 0 2.15 1.58 4.144 3.365 5.682A20.565 20.565 0 0 0 8 13.393a20.561 20.561 0 0 0 3.135-2.211C12.92 9.644 14.5 7.65 14.5 5.5c0-1.836-1.414-3-2.75-3-1.373 0-2.609.986-3.029 2.456a.75.75 0 0 1-1.442 0C6.859 3.486 5.623 2.5 4.25 2.5Z"/>'
    ),
    btc: svg(
      '0 0 24 24',
      '<path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-.615 2.477c.037.01.084.023.138.043l-.14-.035-.86 3.437c-.065.162-.23.404-.6.313.02.03-.955-.24-.955-.24l-.655 1.51 1.815.45c.34.085.67.174.996.258l-.54 2.19 1.317.328.54-2.17c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.93zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.66-2.65c.744.18 3.137.52 2.745 2.1z"/>'
    ),
    eth: svg(
      '0 0 24 24',
      '<path d="M11.944 17.97 4.58 13.62 11.943 24l7.37-10.38-7.372 4.35zM12.056 0 4.69 12.223l7.365 4.354 7.365-4.35z"/>'
    ),
    xmr: svg(
      '0 0 24 24',
      '<path d="M12 0C5.373 0 0 5.373 0 12c0 1.335.228 2.607.629 3.8h3.585V6.006L12 13.792l7.786-7.786V15.8h3.585c.402-1.192.63-2.465.63-3.799C24 5.373 18.626 0 12 0m-1.629 15.585L6.31 11.522v6.939H2.032C4.153 21.812 7.82 24 12 24s7.847-2.188 9.968-5.539H17.69v-6.939l-4.062 4.063L12 18.309z"/>'
    ),
    sol: svg(
      '0 0 24 24',
      '<path d="m23.8764 18.0313-3.962 4.1393a.9201.9201 0 0 1-.306.2106.9407.9407 0 0 1-.367.0742H.4599a.4689.4689 0 0 1-.2522-.0733.4513.4513 0 0 1-.1696-.1962.4375.4375 0 0 1-.0314-.2545.4438.4438 0 0 1 .117-.2298l3.9649-4.1393a.92.92 0 0 1 .3052-.2102.9407.9407 0 0 1 .3658-.0746H23.54a.4692.4692 0 0 1 .2523.0734.4531.4531 0 0 1 .1697.196.438.438 0 0 1 .0313.2547.4442.4442 0 0 1-.1169.2297zm-3.962-8.3355a.9202.9202 0 0 0-.306-.2106.941.941 0 0 0-.367-.0742H.4599a.4687.4687 0 0 0-.2522.0734.4513.4513 0 0 0-.1696.1961.4376.4376 0 0 0-.0314.2546.444.444 0 0 0 .117.2297l3.9649 4.1394a.9204.9204 0 0 0 .3052.2102c.1154.049.24.0744.3658.0746H23.54a.469.469 0 0 0 .2523-.0734.453.453 0 0 0 .1697-.1961.4382.4382 0 0 0 .0313-.2546.4444.4444 0 0 0-.1169-.2297zM.46 6.7225h18.7815a.9411.9411 0 0 0 .367-.0742.9202.9202 0 0 0 .306-.2106l3.962-4.1394a.4442.4442 0 0 0 .117-.2297.4378.4378 0 0 0-.0314-.2546.453.453 0 0 0-.1697-.196.469.469 0 0 0-.2523-.0734H4.7596a.941.941 0 0 0-.3658.0745.9203.9203 0 0 0-.3052.2102L.1246 5.9687a.4438.4438 0 0 0-.1169.2295.4375.4375 0 0 0 .0312.2544.4512.4512 0 0 0 .1692.196.4689.4689 0 0 0 .2518.0739z"/>'
    ),
    ltc: svg(
      '0 0 24 24',
      '<path d="M12 0a12 12 0 1012 12A12 12 0 0012 0zm-.2617 3.6777h2.584a.3425.3425 0 01.33.4356l-2.0312 6.918 1.9062-.582-.4082 1.3847-1.9238.5605-1.248 4.213h6.6757a.3425.3425 0 01.3282.4374l-.582 2a.4586.4586 0 01-.4395.3301H6.7324l1.7227-5.8223-1.9063.5801.42-1.3613 1.9101-.58 2.4219-8.1798a.4557.4557 0 01.4375-.334Z"/>'
    ),
    trx: svg(
      '6.5 5.2 19.6 21',
      '<g transform="translate(7.5 6.25)"><path d="M14.432 2.663L0 .007 7.595 19.12 18.178 6.225l-3.746-3.562zm-.232 1.17l2.208 2.099-6.038 1.093 3.83-3.192zM9.058 6.806L2.694 1.528l10.402 1.914-4.038 3.364zm-.453.934l-1.038 8.58L1.972 2.237 8.605 7.74zm.96.455l6.687-1.21-7.67 9.343.983-8.133z"/></g>'
    ),
    coin: svg(
      '0 0 24 24',
      '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h5M9.5 14.5h5"/>',
      true
    ),
    copy: svg(
      '0 0 24 24',
      '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
      true
    ),
    check: svg('0 0 24 24', '<path d="M20 6 9 17l-5-5"/>', true),
    qr: svg(
      '0 0 24 24',
      '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><path d="M15 15h2M19 15h2M15 19h2M19 19h2"/>',
      true
    ),
    external: svg(
      '0 0 24 24',
      '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
      true
    ),
    download: svg(
      '0 0 24 24',
      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
      true
    ),
    close: svg('0 0 24 24', '<path d="M18 6 6 18M6 6l12 12"/>', true),
    info: svg(
      '0 0 24 24',
      '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
      true
    )
  };

  var ACCENTS = {
    btc: '#f7931a',
    eth: '#627eea',
    xmr: '#ff6600',
    sol: '#9945ff',
    ltc: '#345d9d',
    trx: '#ef0027'
  };

  var PAY_MARKS = {
    visa: {
      label: 'Visa',
      svg: '<svg aria-hidden="true" focusable="false" id="Ebene_1" data-name="Ebene 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"> <rect width="120" height="80" rx="4" style="fill: #fff"/> <path d="M46.61,24.32,33.26,56.18H24.54L18,30.76c-.41-1.57-.75-2.14-2-2.8a34.65,34.65,0,0,0-8.14-2.71l.2-.93h14a3.84,3.84,0,0,1,3.8,3.25L29.38,46,38,24.32ZM80.75,45.78c0-8.41-11.63-8.86-11.55-12.62,0-1.15,1.11-2.37,3.49-2.67a15.46,15.46,0,0,1,8.13,1.42l1.45-6.76a22.2,22.2,0,0,0-7.71-1.41c-8.15,0-13.88,4.34-13.93,10.54-.05,4.58,4.09,7.14,7.22,8.67s4.28,2.56,4.27,4c0,2.14-2.56,3.07-4.93,3.11a17.23,17.23,0,0,1-8.47-2l-1.49,7a25.05,25.05,0,0,0,9.17,1.7c8.65,0,14.32-4.29,14.35-10.91m21.51,10.4h7.62l-6.65-31.86h-7a3.77,3.77,0,0,0-3.51,2.34L80.32,56.18H89l1.72-4.75h10.57ZM93.06,44.9l4.34-12,2.5,12ZM58.39,24.32,51.57,56.18H43.32l6.83-31.86Z" style="fill: #1434CB"/> </svg>'
    },
    mastercard: {
      label: 'Mastercard',
      svg: '<svg aria-hidden="true" focusable="false" id="Ebene_1" data-name="Ebene 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"> <rect y="0" width="120" height="80" rx="4" ry="4" style="fill: #fff;"/> <g> <rect x="48.38" y="21.01" width="23.25" height="37.98" style="fill: #ff5f00;"/> <path d="M50.77,40c0-7.41,3.4-14.41,9.22-18.99-10.49-8.24-25.67-6.42-33.91,4.07-8.24,10.49-6.42,25.67,4.07,33.91,8.76,6.88,21.09,6.88,29.85,0-5.83-4.58-9.23-11.58-9.22-18.99Z" style="fill: #eb001b;"/> <path d="M96.77,54.97v-.78h.34v-.16h-.8v.16h.32v.78h.15Zm1.55,0v-.94h-.24l-.28,.67-.28-.67h-.24v.94h.17v-.71l.26,.61h.18l.26-.61v.71h.17Z" style="fill: #f79e1b;"/> <path d="M99.08,40c0,13.34-10.81,24.15-24.15,24.15-5.41,0-10.67-1.82-14.93-5.17,10.49-8.24,12.31-23.43,4.07-33.91-1.19-1.51-2.55-2.88-4.07-4.07,10.49-8.24,25.67-6.43,33.91,4.06,3.35,4.26,5.17,9.51,5.17,14.93h0Z" style="fill: #f79e1b;"/> </g> </svg>'
    },
    amex: {
      label: 'American Express',
      svg: '<svg aria-hidden="true" focusable="false" id="Ebene_1" data-name="Ebene 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"> <rect x="48" y="7.34" width="72" height="66" style="fill: #fff;"/> <g> <g> <path d="M109.97,70.99l-5.32-6.13-5.53,6.13h-34.2v-28.55h-10.85l13.52-31.94h13.11l4.71,11V10.5h16.38l2.87,8.25,2.87-8.25h12.49V5.63c0-2.96-2.25-5.29-5.12-5.29H5.12C2.25,.34,0,2.67,0,5.63V74.37c0,2.96,2.25,5.29,5.12,5.29H114.88c2.87,0,5.12-2.33,5.12-5.29v-3.38h-10.03Z" style="fill: #0071ce;"/> <g> <polygon points="111.4 67.6 120 67.6 108.74 55.12 120 42.86 111.6 42.86 104.44 50.89 97.47 42.86 88.87 42.86 100.34 55.33 88.87 67.6 97.27 67.6 104.44 59.56 111.4 67.6" style="fill: #0071ce;"/> <polygon points="75.15 61.89 75.15 58.08 88.67 58.08 88.67 52.37 75.15 52.37 75.15 48.57 88.87 48.57 88.87 42.86 68.6 42.86 68.6 67.6 88.87 67.6 88.87 61.89 75.15 61.89" style="fill: #0071ce;"/> <polygon points="113.65 39.26 119.8 39.26 119.8 14.3 109.97 14.51 104.64 29.95 99.11 14.51 88.87 14.51 88.87 39.26 95.43 39.26 95.43 21.92 101.57 39.26 107.3 39.26 113.65 21.92 113.65 39.26" style="fill: #0071ce;"/> <path d="M78.43,14.51h-8.4l-10.65,24.75h7.17l2.05-4.86h11.06l2.05,4.86h7.37l-10.65-24.75Zm-7.58,14.17l3.28-8.04,3.28,8.04h-6.55Z" style="fill: #0071ce;"/> </g> </g> <polygon points="114.06 54.49 120 61.26 120 47.72 114.06 54.49" style="fill: #0071ce;"/> </g> </svg>'
    },
    paypal: {
      label: 'PayPal',
      svg: '<svg aria-hidden="true" focusable="false" id="Ebene_1" data-name="Ebene 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"> <rect y="0" width="120" height="80" rx="4" ry="4" style="fill: #fff;"/> <g> <path d="M47.39,33.25h-5.53c-.38,0-.7,.28-.76,.65l-2.24,14.19c-.04,.28,.17,.53,.46,.53h2.64c.38,0,.7-.28,.76-.65l.6-3.83c.06-.37,.38-.65,.76-.65h1.75c3.65,0,5.75-1.76,6.3-5.26,.25-1.53,.01-2.73-.71-3.57-.79-.92-2.18-1.41-4.03-1.41Zm.64,5.18c-.3,1.99-1.82,1.99-3.29,1.99h-.84l.59-3.71c.03-.22,.23-.39,.46-.39h.38c1,0,1.94,0,2.43,.57,.29,.34,.38,.84,.27,1.54Z" style="fill: #253b80;"/> <path d="M63.93,38.37h-2.65c-.23,0-.42,.17-.46,.39l-.12,.74-.19-.27c-.57-.83-1.85-1.11-3.13-1.11-2.93,0-5.43,2.22-5.92,5.33-.25,1.55,.11,3.04,.99,4.07,.81,.95,1.96,1.35,3.34,1.35,2.36,0,3.67-1.52,3.67-1.52l-.12,.74c-.04,.28,.17,.53,.45,.53h2.39c.38,0,.7-.28,.76-.65l1.43-9.07c.05-.28-.17-.53-.45-.53Zm-3.69,5.16c-.26,1.51-1.46,2.53-2.99,2.53-.77,0-1.38-.25-1.78-.71-.39-.46-.54-1.13-.42-1.86,.24-1.5,1.46-2.55,2.97-2.55,.75,0,1.36,.25,1.77,.72,.4,.48,.56,1.14,.45,1.87Z" style="fill: #253b80;"/> <path d="M78.05,38.37h-2.66c-.25,0-.49,.13-.64,.34l-3.67,5.41-1.56-5.2c-.1-.33-.4-.55-.74-.55h-2.62c-.32,0-.54,.31-.44,.61l2.93,8.61-2.76,3.89c-.22,.31,0,.73,.38,.73h2.66c.25,0,.49-.12,.63-.33l8.86-12.78c.21-.31,0-.72-.38-.72Z" style="fill: #253b80;"/> <path d="M86.86,33.25h-5.53c-.38,0-.7,.28-.76,.65l-2.24,14.19c-.04,.28,.17,.53,.45,.53h2.84c.26,0,.49-.19,.53-.45l.64-4.02c.06-.37,.38-.65,.76-.65h1.75c3.65,0,5.75-1.76,6.3-5.26,.25-1.53,0-2.73-.71-3.57-.79-.92-2.18-1.41-4.03-1.41Zm.64,5.18c-.3,1.99-1.82,1.99-3.29,1.99h-.83l.59-3.71c.03-.22,.23-.39,.45-.39h.38c1,0,1.94,0,2.43,.57,.29,.34,.38,.84,.27,1.54Z" style="fill: #179bd7;"/> <path d="M103.4,38.37h-2.65c-.23,0-.42,.17-.45,.39l-.12,.74-.19-.27c-.57-.83-1.85-1.11-3.13-1.11-2.93,0-5.43,2.22-5.92,5.33-.25,1.55,.11,3.04,.99,4.07,.81,.95,1.96,1.35,3.34,1.35,2.36,0,3.67-1.52,3.67-1.52l-.12,.74c-.04,.28,.17,.53,.46,.53h2.39c.38,0,.7-.28,.76-.65l1.43-9.07c.04-.28-.17-.53-.46-.53Zm-3.69,5.16c-.25,1.51-1.46,2.53-2.99,2.53-.77,0-1.38-.25-1.78-.71-.39-.46-.54-1.13-.42-1.86,.24-1.5,1.46-2.55,2.97-2.55,.75,0,1.36,.25,1.77,.72,.41,.48,.57,1.14,.45,1.87Z" style="fill: #179bd7;"/> <path d="M106.53,33.64l-2.27,14.45c-.04,.28,.17,.53,.45,.53h2.28c.38,0,.7-.28,.76-.65l2.24-14.19c.04-.28-.17-.53-.45-.53h-2.56c-.23,0-.42,.17-.45,.39Z" style="fill: #179bd7;"/> <path d="M15.88,51.38l.42-2.69-.94-.02h-4.5l3.13-19.83c0-.06,.04-.12,.09-.16,.05-.04,.11-.06,.17-.06h7.59c2.52,0,4.26,.52,5.17,1.56,.43,.49,.7,.99,.83,1.55,.14,.59,.14,1.29,0,2.14v.06s0,.55,0,.55l.43,.24c.36,.19,.64,.41,.86,.66,.36,.42,.6,.94,.7,1.57,.1,.64,.07,1.41-.1,2.28-.19,1-.51,1.87-.93,2.58-.39,.65-.89,1.2-1.48,1.62-.56,.4-1.23,.7-1.99,.9-.73,.19-1.57,.29-2.49,.29h-.59c-.42,0-.83,.15-1.15,.42-.32,.28-.54,.66-.6,1.07l-.04,.24-.75,4.74-.03,.17c0,.06-.02,.08-.05,.1-.02,.02-.05,.03-.08,.03h-3.65Z" style="fill: #253b80;"/> <path d="M28.65,33.99h0c-.02,.14-.05,.29-.08,.45-1,5.14-4.43,6.91-8.8,6.91h-2.23c-.53,0-.99,.39-1.07,.92h0l-1.14,7.23-.32,2.05c-.05,.35,.21,.66,.56,.66h3.95c.47,0,.86-.34,.94-.8l.04-.2,.74-4.72,.05-.26c.07-.46,.47-.8,.94-.8h.59c3.83,0,6.82-1.55,7.7-6.05,.37-1.88,.18-3.45-.79-4.55-.29-.33-.66-.61-1.08-.83Z" style="fill: #179bd7;"/> <path d="M27.6,33.58c-.15-.04-.31-.08-.47-.12-.16-.04-.33-.07-.5-.09-.6-.1-1.26-.14-1.96-.14h-5.95c-.15,0-.29,.03-.41,.09-.27,.13-.48,.39-.53,.71l-1.27,8.02-.04,.23c.08-.53,.53-.92,1.07-.92h2.23c4.37,0,7.8-1.78,8.8-6.91,.03-.15,.06-.3,.08-.45-.25-.13-.53-.25-.82-.35-.07-.02-.15-.05-.22-.07Z" style="fill: #222d65;"/> <path d="M17.78,34.02c.05-.32,.25-.58,.53-.71,.13-.06,.26-.09,.41-.09h5.95c.7,0,1.36,.05,1.96,.14,.17,.03,.34,.06,.5,.09,.16,.04,.32,.08,.47,.12,.08,.02,.15,.05,.22,.07,.3,.1,.57,.21,.82,.35,.3-1.9,0-3.19-1.03-4.36-1.13-1.29-3.18-1.84-5.79-1.84h-7.59c-.53,0-.99,.39-1.07,.92l-3.16,20.04c-.06,.4,.24,.75,.64,.75h4.69l1.18-7.46,1.27-8.02Z" style="fill: #253b80;"/> </g> </svg>'
    },
    applepay: {
      label: 'Apple Pay',
      svg: '<svg aria-hidden="true" focusable="false" id="Ebene_1" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" viewBox="0 0 120 80"> <g id="export-badges"> <g id="production-final" transform="translate(-36.000000, -6018.000000)"> <g id="card_google_pay" transform="translate(36.000000, 6018.000000)"> <path id="Rectangle-11" style="fill-rule:evenodd;clip-rule:evenodd;fill:#FFFFFF;" d="M4,0h112c2.2,0,4,1.8,4,4v72c0,2.2-1.8,4-4,4H4c-2.2,0-4-1.8-4-4V4C0,1.8,1.8,0,4,0z"/> </g> <g transform="translate(0.000000,400.000000) scale(0.100000,-0.100000)"> <path d="M726.4-56417.9c-21.4-5.5-41.9-28.7-45.5-51.8c-1.7-10.4-1.7-10.4,6-10.4c23.4,0,50.1,31.1,47.7,55.6 C733.9-56416.2,733.7-56416,726.4-56417.9z"/> <path d="M903.7-56440.3c-1.9-0.5-10.8-1.7-19.8-2.4l-16.4-1.7v-126.2v-126.2h10.8h10.8v52.8v52.8l28.4,1 c24.1,0.7,30.1,1.7,41.4,7c18.5,8.7,29.9,19.3,37.8,35.4c5.5,11.8,6.5,16.9,6.7,35.4c0,17.8-1,23.6-5.5,33 c-7.5,14.9-23.6,28.9-39.3,34C947.1-56441.7,911.5-56438.4,903.7-56440.3z M956-56467.5c19-9.9,29.1-31.3,26-54.4 c-4.3-33-26.5-49.6-66.2-49.6c-10.4,0-20.5,0.7-22.6,1.4c-3.4,1.2-3.9,8.4-3.9,53.7c0,28.9,0.7,53.2,1.9,54.2 c1,1,13.7,1.4,28.2,1C940.8-56462,947.8-56463.2,956-56467.5z"/> <path d="M623.1-56487c-48.7-12-67.5-74-42.6-140.9c7.5-20.2,25.3-47.9,38.5-59.7c12-10.8,23.1-12,43.4-4.3c16.1,6,34.7,6,48.4,0 c13.2-6,28.2-6,38.1-0.2c9.9,6.3,24.8,26,35.4,47.7c8.9,17.8,10.1,22.4,6.7,22.4c-1.2,0-6.7,4.1-12.5,8.9 c-28.7,24.6-28.9,70.1-0.5,94.9l8.7,7.7l-10.1,9.2c-19,16.6-44.3,21-69.9,11.6c-21-7.9-25.1-7.9-44.6-1.2 C643.6-56484.9,636.1-56483.9,623.1-56487z"/> <path d="M1053.1-56512.3c-11.6-3.1-25.5-9.9-27.2-13c-1.7-2.4,5.1-18.1,7.2-16.9c27.2,14,48.4,16.4,63.6,7.7 c10.1-5.8,19-22.6,19-35.9v-9.9l-23.6-2.6c-13-1.7-29.9-5.3-37.6-8.2c-40-15.4-55.2-61.7-29.6-90.6 c10.4-11.8,23.8-17.6,41.4-17.6c15.4,0,33.7,7,43.8,16.6c2.9,2.7,6,5.1,6.5,5.1c0.7,0,2.2-4.3,2.9-9.9c1.7-9.6,1.7-9.6,11.6-8.9 c7.2,0.5,9.6,1.7,8.9,4.3c-0.2,1.9-1.4,34.4-2.4,72.3c-1.4,65.3-1.7,69.1-7.2,80.2C1117.9-56514,1086.8-56502.9,1053.1-56512.3z M1115.7-56623.4c0-25.1-2.2-31.8-13.7-42.6c-20.2-19.3-52.3-17.8-62.6,2.9c-4.8,9.6-3.9,28.4,1.9,37.8 c8.7,14,34.2,23.6,64.3,24.6l10.1,0.2V-56623.4z"/> <path d="M1160.3-56516.2c0.7-1.2,16.1-40.7,34-87.2l32.3-84.8l-7-14.7c-9.6-20.5-24.3-38.1-39.7-47.5 c-7.5-4.3-13.5-9.2-13.5-10.8c0-5.1,5.5-15.2,8.2-15.2c5.3,0,27,14.2,35.7,23.4c12,12.3,28.9,42.4,40.2,71.8 c5.3,13.2,19.8,50.6,32.3,83.1c12.5,32.5,25.1,64.8,27.9,71.8l5.1,12.5h-11.8h-11.8l-7-18.6c-4.1-10.4-15.7-42.9-26.3-72.3 c-17.6-49.9-22.4-60.2-22.6-49.4c-0.2,2.2-11.8,34.4-26,71.5l-26,67.5l-12.8,0.7C1162.7-56513.8,1159.1-56514.3,1160.3-56516.2z" /> </g> </g> </g> </svg>'
    },
    googlepay: {
      label: 'Google Pay',
      svg: '<svg aria-hidden="true" focusable="false" viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg"> <g id="export-badges" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <g id="production-final" transform="translate(-36.000000, -6018.000000)"> <g id="card_google_pay" transform="translate(36.000000, 6018.000000)"> <rect id="Rectangle-11" fill="#FFFFFF" x="0" y="0" width="120" height="80" rx="4"></rect> <g id="download" transform="translate(18.000000, 25.000000)"> <path d="M39.052,5.27 L39.052,13.436 L44.088,13.436 C45.288,13.436 46.28,13.032 47.064,12.226 C47.87,11.422 48.274,10.462 48.274,9.352 C48.274,8.264 47.87,7.316 47.064,6.508 C46.28,5.682 45.288,5.268 44.088,5.268 L39.052,5.268 L39.052,5.27 Z M39.052,16.31 L39.052,25.782 L36.044,25.782 L36.044,2.396 L44.024,2.396 C46.05,2.396 47.77,3.07 49.188,4.42 C50.628,5.77 51.348,7.414 51.348,9.352 C51.348,11.334 50.628,12.99 49.188,14.316 C47.794,15.646 46.07,16.308 44.022,16.308 L39.052,16.308 L39.052,16.31 Z M54.388,20.884 C54.388,21.668 54.72,22.32 55.386,22.844 C56.05,23.364 56.83,23.626 57.722,23.626 C58.988,23.626 60.114,23.158 61.106,22.224 C62.1,21.286 62.594,20.186 62.594,18.924 C61.656,18.184 60.348,17.814 58.67,17.814 C57.45,17.814 56.43,18.11 55.614,18.698 C54.796,19.286 54.388,20.012 54.388,20.884 Z M58.28,9.254 C60.504,9.254 62.258,9.848 63.546,11.034 C64.83,12.222 65.474,13.85 65.474,15.918 L65.474,25.782 L62.596,25.782 L62.596,23.562 L62.466,23.562 C61.222,25.39 59.566,26.306 57.494,26.306 C55.73,26.306 54.252,25.782 53.064,24.738 C51.876,23.692 51.282,22.386 51.282,20.818 C51.282,19.162 51.908,17.846 53.162,16.866 C54.416,15.886 56.088,15.396 58.182,15.396 C59.966,15.396 61.44,15.722 62.594,16.376 L62.594,15.688 C62.594,14.644 62.18,13.756 61.352,13.028 C60.5542391,12.3101177 59.5151104,11.9194625 58.442,11.934 C56.762,11.934 55.434,12.64 54.452,14.058 L51.804,12.39 C53.264,10.3 55.424,9.254 58.28,9.254 Z M81.986,9.778 L71.946,32.838 L68.84,32.838 L72.568,24.77 L65.964,9.778 L69.234,9.778 L74.008,21.276 L74.072,21.276 L78.716,9.776 L81.986,9.778 Z" id="Shape" fill="#5F6368" fill-rule="nonzero"></path> <path d="M26.896,14.268 C26.896,13.322 26.816,12.408 26.664,11.536 L13.976,11.536 L13.976,16.712 L21.244,16.712 C20.9430287,18.3831748 19.9719035,19.8586493 18.556,20.796 L18.556,24.156 L22.894,24.156 C25.434,21.816 26.896,18.356 26.896,14.268" id="Shape" fill="#4285F4" fill-rule="nonzero"></path> <path d="M13.976,27.4 C17.608,27.4 20.664,26.21 22.894,24.158 L18.556,20.796 C17.35,21.608 15.796,22.082 13.976,22.082 C10.468,22.082 7.488,19.718 6.424,16.534 L1.956,16.534 L1.956,19.996 C4.24184797,24.5371718 8.89197185,27.4022981 13.976,27.402" id="Shape" fill="#34A853" fill-rule="nonzero"></path> <path d="M6.424,16.534 C5.86273911,14.8652626 5.86273911,13.0587374 6.424,11.39 L6.424,7.928 L1.956,7.928 C1.0114615,9.79834617 0.520226421,11.8646851 0.522,13.96 C0.522,16.13 1.042,18.18 1.956,19.994 L6.424,16.532 L6.424,16.534 Z" id="Shape" fill="#FABB05" fill-rule="nonzero"></path> <path d="M13.976,5.842 C15.96,5.842 17.736,6.522 19.136,7.858 L19.136,7.86 L22.976,4.024 C20.648,1.856 17.608,0.524 13.978,0.524 C8.89441559,0.523321579 4.24440402,3.38760491 1.958,7.928 L6.426,11.39 C7.49,8.206 10.47,5.842 13.978,5.842" id="Shape" fill="#E94235" fill-rule="nonzero"></path> <polygon id="Shape" points="0 0 82.57 0 82.57 36 0 36"></polygon> </g> </g> </g> </g> </svg>'
    }
  };

  function payMethods(ids) {
    if (!ids || !ids.length) return '';
    var labels = [];
    var marks = [];
    ids.forEach(function (id) {
      var mark = PAY_MARKS[id];
      if (!mark) return;
      labels.push(mark.label);
      marks.push(
        '<span class="pay-mark pay-mark-' +
          id +
          '" title="' +
          esc(mark.label) +
          '">' +
          mark.svg +
          '</span>'
      );
    });
    if (!marks.length) return '';
    return (
      '<div class="pay-methods" role="img" aria-label="' +
      T.accepted +
      esc(labels.join(', ')) +
      '">' +
      marks.join('') +
      '</div>'
    );
  }

  function $(selector) {
    return document.querySelector(selector);
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(
      /[&<>"']/g,
      function (ch) {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        }[ch];
      }
    );
  }

  function isUnset(value) {
    return !value || /^(YOUR_|REPLACE_)/.test(String(value).trim());
  }

  function githubUrl(value) {
    var text = String(value).trim();
    if (/^https?:\/\//i.test(text)) return text;
    return 'https://github.com/' + text.replace(/^\/+|\/+$/g, '');
  }

  function platformIcon(id) {
    if (id === 'sponsors') return ICONS.github;
    return ICONS[id] || ICONS.heart;
  }

  function chip(href, iconKey, label) {
    return (
      '<a class="chip chip-' +
      iconKey +
      '" href="' +
      esc(href) +
      '" target="_blank" rel="noopener noreferrer">' +
      '<span class="icon" aria-hidden="true">' +
      ICONS[iconKey] +
      '</span><span>' +
      esc(label) +
      '</span></a>'
    );
  }

  function walletUri(wallet) {
    if (isUnset(wallet.address)) return '';
    return wallet.uriScheme
      ? wallet.uriScheme + ':' + wallet.address
      : wallet.address;
  }

  function toast(message) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      el.classList.remove('is-visible');
    }, 2200);
  }

  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(area);
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () {
        if (legacyCopy(text)) return;
        throw new Error('copy-failed');
      });
    }
    return legacyCopy(text)
      ? Promise.resolve()
      : Promise.reject(new Error('copy-failed'));
  }

  function flashCopied(button) {
    if (!button || button.dataset.flashing === '1') return;
    var original = button.innerHTML;
    button.dataset.flashing = '1';
    button.innerHTML =
      '<span class="icon">' + ICONS.check + '</span><span>' + T.copied + '</span>';
    setTimeout(function () {
      button.innerHTML = original;
      delete button.dataset.flashing;
    }, 1600);
  }

  function handleCopy(button, text, label) {
    copyText(text).then(
      function () {
        flashCopied(button);
        toast(T.addressCopied(label));
      },
      function () {
        toast(T.copyFailed);
      }
    );
  }

  function drawQr(canvas, text) {
    if (typeof window.qrcode !== 'function') {
      throw new Error('qrcode-missing');
    }
    var qr = window.qrcode(0, 'M');
    qr.addData(text);
    qr.make();

    var modules = qr.getModuleCount();
    var total = modules + QR_MARGIN * 2;
    var size = total * QR_CELL;

    canvas.width = size;
    canvas.height = size;

    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000000';
    for (var row = 0; row < modules; row++) {
      for (var col = 0; col < modules; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect(
            (col + QR_MARGIN) * QR_CELL,
            (row + QR_MARGIN) * QR_CELL,
            QR_CELL,
            QR_CELL
          );
        }
      }
    }
  }

  var modal = {
    root: null,
    dialog: null,
    lastFocused: null,
    wallet: null
  };

  function focusables() {
    return Array.prototype.filter.call(
      modal.dialog.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ),
      function (el) {
        return el.offsetParent !== null;
      }
    );
  }

  function trapTab(event) {
    var items = focusables();
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onModalKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
    } else if (event.key === 'Tab') {
      trapTab(event);
    }
  }

  function openModal(wallet) {
    var uri = walletUri(wallet);
    if (!uri) return;

    modal.wallet = wallet;
    modal.lastFocused = document.activeElement;

    $('#modal-title').textContent = wallet.name + ' (' + wallet.symbol + ')';
    $('#modal-network').textContent = wallet.network || '';
    $('#modal-address').textContent = wallet.address;

    var canvas = $('#qr-canvas');
    try {
      drawQr(canvas, uri);
      canvas.setAttribute(
        'aria-label',
        T.qrFor(wallet.name)
      );
      $('#modal-download').hidden = false;
    } catch (e) {
      canvas.setAttribute('aria-label', T.qrFailed);
      $('#modal-download').hidden = true;
      toast(T.qrFailed);
    }

    var openLink = $('#modal-open');
    if (wallet.uriScheme) {
      openLink.href = uri;
      openLink.hidden = false;
    } else {
      openLink.hidden = true;
    }

    modal.root.hidden = false;
    document.body.classList.add('modal-open');
    document.addEventListener('keydown', onModalKeydown, true);
    $('#modal-copy').focus();
  }

  function closeModal() {
    if (modal.root.hidden) return;
    modal.root.hidden = true;
    modal.wallet = null;
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', onModalKeydown, true);
    if (modal.lastFocused && modal.lastFocused.focus) {
      modal.lastFocused.focus();
    }
  }

  function setupModal() {
    modal.root = $('#qr-modal');
    modal.dialog = modal.root.querySelector('.modal-dialog');

    $('#modal-close-icon').innerHTML = ICONS.close;

    $('#modal-copy').innerHTML =
      '<span class="icon">' + ICONS.copy + '</span><span>' + T.copyAddress + '</span>';
    $('#modal-open').innerHTML =
      '<span class="icon">' +
      ICONS.external +
      '</span><span>' +
      T.openInWallet +
      '</span>';
    $('#modal-download').innerHTML =
      '<span class="icon">' + ICONS.download + '</span><span>' + T.downloadQr + '</span>';

    Array.prototype.forEach.call(
      modal.root.querySelectorAll('[data-close-modal]'),
      function (el) {
        el.addEventListener('click', closeModal);
      }
    );

    $('#modal-copy').addEventListener('click', function () {
      if (modal.wallet) {
        handleCopy(this, modal.wallet.address, modal.wallet.name);
      }
    });

    $('#modal-download').addEventListener('click', function () {
      if (!modal.wallet) return;
      var link = document.createElement('a');
      link.href = $('#qr-canvas').toDataURL('image/png');
      link.download = modal.wallet.id + '-qr.png';
      link.click();
    });
  }

  function renderHero() {
    var project = config.project || {};
    var name = isUnset(project.name) ? T.thisProject : project.name;

    $('#hero-title').textContent = T.support(name);
    $('#brand-text').textContent = name;
    document.title = T.support(name);

    if (project.summary) {
      $('#hero-summary').textContent = project.summary;
    }
  }

  function renderPlatforms() {
    var platforms = Array.isArray(config.platforms) ? config.platforms : [];
    var container = $('#platforms');
    container.innerHTML = '';
    var shown = 0;

    platforms.forEach(function (platform) {
      if (platform.enabled === false) return;

      var pending = isUnset(platform.url);
      var icon = platformIcon(platform.id);
      var card = document.createElement('article');
      card.className = 'card card-' + platform.id;

      var html =
        '<div class="card-head">' +
        '<span class="card-logo">' +
        icon +
        '</span>' +
        '<div class="card-meta">' +
        '<div class="card-name">' +
        esc(platform.name) +
        '</div>' +
        payMethods(platform.methods) +
        '</div>' +
        '</div>';

      if (platform.description) {
        html += '<p class="card-text">' + esc(platform.description) + '</p>';
      }

      html += '<div class="card-body">';
      if (pending) {
        html += '<span class="badge">' + T.notConfigured + '</span>';
      } else {
        html +=
          '<a class="button button-brand" href="' +
          esc(platform.url) +
          '" target="_blank" rel="noopener noreferrer">' +
          '<span class="icon">' +
          icon +
          '</span><span>' +
          esc(platform.ctaLabel || T.donate) +
          '</span></a>';
      }
      html += '</div>';

      card.innerHTML = html;
      container.appendChild(card);
      shown++;
    });

    $('#platforms-section').hidden = shown === 0;
  }

  function renderWallets() {
    var wallets = Array.isArray(config.wallets) ? config.wallets : [];
    if (!wallets.length) return;

    var container = $('#wallets');
    container.innerHTML = '';

    wallets.forEach(function (wallet) {
      var pending = isUnset(wallet.address);
      var accent = ACCENTS[wallet.id] || 'var(--accent)';
      var card = document.createElement('article');
      card.className = 'card';
      card.style.setProperty('--card-accent', accent);

      var html =
        '<div class="card-head">' +
        '<span class="card-logo">' +
        (ICONS[wallet.id] || ICONS.coin) +
        '</span>' +
        '<div class="card-meta">' +
        '<div class="card-name">' +
        esc(wallet.name) +
        (wallet.symbol ? ' <span class="card-network">' + esc(wallet.symbol) + '</span>' : '') +
        '</div>' +
        '<div class="card-network">' +
        esc(wallet.network || '') +
        '</div>' +
        '</div>' +
        '</div>';

      if (pending) {
        html +=
          '<span class="badge">' + T.notConfigured + '</span>' +
          '<p class="address address-placeholder">' + T.notPublished + '</p>';
      } else {
        html += '<p class="address">' + esc(wallet.address) + '</p>';
        if (wallet.note) {
          html +=
            '<p class="card-note"><span class="icon">' +
            ICONS.info +
            '</span><span>' +
            esc(wallet.note) +
            '</span></p>';
        }
        html +=
          '<div class="card-body">' +
          '<div class="button-row">' +
          '<button type="button" class="button button-primary" data-action="copy">' +
          '<span class="icon">' +
          ICONS.copy +
          '</span><span>' + T.copy + '</span>' +
          '</button>' +
          '<button type="button" class="button button-ghost" data-action="qr">' +
          '<span class="icon">' +
          ICONS.qr +
          '</span><span>' + T.viewQr + '</span>' +
          '</button>' +
          '</div>' +
          '</div>';
      }

      card.innerHTML = html;

      var copyButton = card.querySelector('[data-action="copy"]');
      if (copyButton) {
        copyButton.setAttribute(
          'aria-label',
          T.copyLabel(wallet.name)
        );
        copyButton.addEventListener('click', function () {
          handleCopy(this, wallet.address, wallet.name);
        });
      }

      var qrButton = card.querySelector('[data-action="qr"]');
      if (qrButton) {
        qrButton.setAttribute(
          'aria-label',
          T.qrLabel(wallet.name)
        );
        qrButton.addEventListener('click', function () {
          openModal(wallet);
        });
      }

      container.appendChild(card);
    });

    $('#crypto-section').hidden = false;
  }

  function renderContact() {
    var discord = config.discord || {};
    var slot = $('#discord-chip');
    if (!slot) return;
    if (isUnset(discord.url)) {
      slot.remove();
      return;
    }
    slot.outerHTML = chip(discord.url, 'discord', discord.handle || 'Discord');
  }

  function renderFooter() {
    var project = config.project || {};
    var discord = config.discord || {};
    var chips = [];
    if (!isUnset(project.repo)) {
      chips.push(
        chip(githubUrl(project.repo), 'github', project.name || project.repo)
      );
    }
    if (!isUnset(config.author)) {
      chips.push(
        chip(githubUrl(config.author), 'github', '@' + config.author)
      );
    }
    if (!isUnset(discord.url)) {
      chips.push(chip(discord.url, 'discord', discord.handle || 'Discord'));
    }
    if (!isUnset(config.pageRepo)) {
      chips.push(
        chip(githubUrl(config.pageRepo), 'github', T.sourceOfPage)
      );
    }
    $('#footer-links').innerHTML = chips.join('');
    var license = project.license || 'GPL-3.0';
    $('#footer-text').textContent = T.footer(license);
  }

  setupModal();
  renderHero();
  renderPlatforms();
  renderWallets();
  renderContact();
  renderFooter();
})();
