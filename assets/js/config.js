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
      address: '13UisxBetuSDtKczhKHTYphcerAnHfT4S9',
      uriScheme: 'bitcoin',
      note: 'Do not send Lightning payments to this address.'
    },
    {
      id: 'eth',
      name: 'Ethereum',
      symbol: 'ETH',
      network: 'Ethereum mainnet (ERC-20)',
      address: '0x97DF2613507290D9b786931aD1866124ad286333',
      uriScheme: 'ethereum',
      note: 'Accepts ETH and ERC-20 tokens on Ethereum mainnet.'
    },
    {
      id: 'xmr',
      name: 'Monero',
      symbol: 'XMR',
      network: 'Monero network',
      address: '44eoEfHGPAi5yzqvihwc4tTk53CeG2CduVqEKppdAgHs3BJYi9o3QTZSDdEmR5m5i4SDrMcHGfTEvBJFmAPjbVvRLfNQ2y2',
      uriScheme: 'monero',
      note: ''
    },
    {
      id: 'sol',
      name: 'Solana',
      symbol: 'SOL',
      network: 'Solana network',
      address: 'FdmiB54uD2tVZKtfpqNWPhNCXWrDuTBk5KoCMySne6Tf',
      uriScheme: 'solana',
      note: 'Accepts SOL and SPL tokens on Solana.'
    },
    {
      id: 'ltc',
      name: 'Litecoin',
      symbol: 'LTC',
      network: 'Litecoin network',
      address: 'LTzrAsDP52KUBkFg3VbWQq8okQAhTv6Sa5',
      uriScheme: 'litecoin',
      note: ''
    },
    {
      id: 'trx',
      name: 'TRON',
      symbol: 'TRX',
      network: 'TRON network (TRC-20)',
      address: 'TSiA9LcQJSnq2ewbN6wgFfeFKygwVSGxNE',
      uriScheme: 'tron',
      note: 'Accepts TRX and TRC-20 tokens on TRON.'
    }
  ]
};
