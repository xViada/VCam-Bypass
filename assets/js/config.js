// donate/index.html repeats this data so the page is readable without
// JavaScript. Update both when an address or link changes.
window.FUNDING_CONFIG = {
  project: {
    name: 'VCam Bypass',
    summary:
      'Donations are voluntary. They go into the time the project takes: ' +
      'new masking methods, webcam profiles, and bug fixes.',
    repo: 'xViada/VCam-Bypass',
    license: 'GPL-3.0'
  },
  author: 'xViada',
  discord: {
    url: 'https://discordapp.com/users/675421408612057089',
    handle: '_Viada'
  },
  pageRepo: 'https://github.com/xViada/VCam-Bypass/tree/gh-pages',
  platforms: [
    {
      id: 'sponsors',
      name: 'GitHub Sponsors',
      methods: ['visa', 'mastercard', 'amex'],
      description:
        'The simplest option: card payments handled by GitHub, ' +
        'one-time or monthly, and cancellable at any time.',
      url: 'https://github.com/sponsors/xViada',
      ctaLabel: 'Sponsor on GitHub'
    },
    {
      id: 'kofi',
      name: 'Ko-fi',
      methods: ['visa', 'mastercard', 'amex', 'applepay', 'googlepay', 'paypal'],
      description:
        'Send a one-off tip or become a monthly member. ' +
        'Ko-fi takes no cut from donations.',
      url: 'https://ko-fi.com/Y8Y21TF3N2',
      ctaLabel: 'Donate on Ko-fi'
    }
  ],
  wallets: [
    {
      id: 'btc',
      name: 'Bitcoin',
      symbol: 'BTC',
      network: 'Bitcoin network (on-chain)',
      address: '16p49pVZQ4T7kQjAvh14ZUmKkSuEQAPC9r',
      uriScheme: 'bitcoin',
      note: 'Do not send Lightning payments to this address.'
    },
    {
      id: 'eth',
      name: 'Ethereum',
      symbol: 'ETH',
      network: 'Ethereum mainnet (ERC-20)',
      address: '0x008C602cA8cb0AB85AE966F3F41434e9A74281Dc',
      uriScheme: 'ethereum',
      note: 'Accepts ETH and ERC-20 tokens on Ethereum mainnet.'
    },
    {
      id: 'xmr',
      name: 'Monero',
      symbol: 'XMR',
      network: 'Monero network',
      address: '492LAboJAgf44q7nUDkj4KWMgXYMNj46XS7cuRo1pHtZ1fk9okcwZMLdyb3pYNwDFsPs8wgBvTfCw2HuoQCrVXZT7hhU2HP',
      uriScheme: 'monero',
      note: ''
    },
    {
      id: 'sol',
      name: 'Solana',
      symbol: 'SOL',
      network: 'Solana network',
      address: 'AebvVuof9gp3ty2FntjPAncYq7RJivqeVt3HT5Cvo6RF',
      uriScheme: 'solana',
      note: 'Accepts SOL and SPL tokens on Solana.'
    },
    {
      id: 'ltc',
      name: 'Litecoin',
      symbol: 'LTC',
      network: 'Litecoin network',
      address: 'LYLeS47aHU3wQJMtER3WXiuBPMaiV2G8A7',
      uriScheme: 'litecoin',
      note: ''
    },
    {
      id: 'trx',
      name: 'TRON',
      symbol: 'TRX',
      network: 'TRON network (TRC-20)',
      address: 'TJTVK7br1Cn7vic4Es4fJF9aHTzxb5jgu3',
      uriScheme: 'tron',
      note: 'Accepts TRX and TRC-20 tokens on TRON.'
    }
  ]
};

// Translations of the texts above, keyed by language and by platform or wallet
// id. Links, addresses and ids are never translated.
window.FUNDING_I18N = {
  es: {
    summary:
      'Las donaciones son voluntarias. Se destinan al tiempo que exige el proyecto: ' +
      'nuevos métodos de enmascaramiento, perfiles de webcam y corrección de errores.',
    platforms: {
      sponsors: {
        description:
          'La opción más sencilla: pagos con tarjeta gestionados por GitHub, ' +
          'únicos o mensuales, y cancelables en cualquier momento.',
        ctaLabel: 'Patrocinar en GitHub'
      },
      kofi: {
        description:
          'Envía una propina puntual o hazte miembro mensual. ' +
          'Ko-fi no se queda ninguna comisión de las donaciones.',
        ctaLabel: 'Donar en Ko-fi'
      }
    },
    wallets: {
      btc: { network: 'Red Bitcoin (on-chain)', note: 'No envíes pagos Lightning a esta dirección.' },
      eth: {
        network: 'Red principal de Ethereum (ERC-20)',
        note: 'Acepta ETH y tokens ERC-20 en la red principal de Ethereum.'
      },
      xmr: { network: 'Red Monero' },
      sol: { network: 'Red Solana', note: 'Acepta SOL y tokens SPL en Solana.' },
      ltc: { network: 'Red Litecoin' },
      trx: { network: 'Red TRON (TRC-20)', note: 'Acepta TRX y tokens TRC-20 en TRON.' }
    }
  },
  pt: {
    summary:
      'As doações são voluntárias. Elas vão para o tempo que o projeto exige: ' +
      'novos métodos de mascaramento, perfis de webcam e correção de bugs.',
    platforms: {
      sponsors: {
        description:
          'A opção mais simples: pagamentos com cartão processados pelo GitHub, ' +
          'únicos ou mensais, e canceláveis a qualquer momento.',
        ctaLabel: 'Patrocinar no GitHub'
      },
      kofi: {
        description:
          'Envie uma gorjeta única ou torne-se membro mensal. ' +
          'O Ko-fi não fica com nenhuma parte das doações.',
        ctaLabel: 'Doar no Ko-fi'
      }
    },
    wallets: {
      btc: { network: 'Rede Bitcoin (on-chain)', note: 'Não envie pagamentos Lightning para este endereço.' },
      eth: {
        network: 'Rede principal do Ethereum (ERC-20)',
        note: 'Aceita ETH e tokens ERC-20 na rede principal do Ethereum.'
      },
      xmr: { network: 'Rede Monero' },
      sol: { network: 'Rede Solana', note: 'Aceita SOL e tokens SPL na Solana.' },
      ltc: { network: 'Rede Litecoin' },
      trx: { network: 'Rede TRON (TRC-20)', note: 'Aceita TRX e tokens TRC-20 na TRON.' }
    }
  }
};
