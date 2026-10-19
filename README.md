# VCam Bypass site

Static site for [VCam Bypass](https://github.com/xViada/VCam-Bypass). The root
is a short landing page, `guide/` explains how to use the extension, and
`donate/` lists the ways to fund the project (GitHub Sponsors and
cryptocurrency wallets with QR codes). The donate page is meant to be linked
from the `custom` field in `FUNDING.yml`, which does not accept crypto
addresses directly.

No build, no dependencies, no server-side code: HTML, CSS, and JavaScript
uploaded as-is to GitHub Pages.

## Setup

Edit **only** [`assets/js/config.js`](assets/js/config.js) and replace the
uppercase values:

| Field | Purpose |
| --- | --- |
| `project.name` | Project name, used in the donate header and page title |
| `project.summary` | Donate page lede. The same sentence is also written in `donate/index.html` |
| `project.repo` | Project repository (`user/repo`), linked from the footer |
| `project.license` | Project license. The shared footer states it as GPL-3.0 |
| `author` | GitHub username of the maintainer, linked from the footer |
| `pageRepo` | Source of this page. A full URL, or `user/repo`. Leave as `REPLACE_PAGE_REPO` to hide the link |
| `platforms[].url` | Donation link (GitHub Sponsors, Ko-fi); a `REPLACE_` value shows the card as not configured |
| `platforms[].id` | Picks the logo and brand colour (`sponsors`, `kofi`) |
| `platforms[].methods` | Payment badges: `visa`, `mastercard`, `amex`, `paypal`, `applepay`, `googlepay` |
| `wallets[].address` | Receiving address for each coin |
| `wallets[].network` | Specific network; be explicit to avoid lost transfers |
| `wallets[].uriScheme` | URI and QR scheme (`bitcoin`, `ethereum`, `monero`, `solana`, `litecoin`, `tron`) |

Any wallet whose address still starts with `REPLACE_` is shown as
"Not configured yet", so you can publish the page before every address is ready.

`donate/index.html` repeats the platforms, addresses, and footer so the page
still shows them when JavaScript is off. QR codes are the part that needs
JavaScript. After editing `config.js`, copy the same values into that HTML
file.

### Adding another coin

Copy a block in the `wallets` array. The icon is resolved from `id` (`btc`,
`eth`, `xmr`, `sol`, `ltc`, and `trx` have their own logos; anything else uses
a generic coin icon).

```js
{
  id: 'doge',
  name: 'Dogecoin',
  symbol: 'DOGE',
  network: 'Dogecoin network',
  address: 'YOUR_ADDRESS',
  uriScheme: 'dogecoin',
  note: ''
}
```

## Publish on GitHub Pages

The site is the orphan `gh-pages` branch of
[xViada/VCam-Bypass](https://github.com/xViada/VCam-Bypass). `master` stays
the extension. The two branches do not share history, and the default branch
stays `master`.

Published URLs:

- https://xviada.github.io/VCam-Bypass/
- https://xviada.github.io/VCam-Bypass/guide/
- https://xviada.github.io/VCam-Bypass/donate/

Publish from a separate clone so the extension checkout stays untouched.
On Windows PowerShell:

```powershell
git clone --no-checkout https://github.com/xViada/VCam-Bypass.git vcam-pages-publish
Set-Location vcam-pages-publish
git checkout --orphan gh-pages
git rm -rf .
robocopy C:\path\to\this\folder . /E /NFL /NDL /NJH /NJS
git add -A
git status
git commit -m "Publish the VCam Bypass site."
git push -u origin gh-pages
```

`git status` should list `.nojekyll`, `index.html`, `guide/`, `donate/`,
`assets/`, and `docs/`. It should not list `manifest.json` or `inject.js`.
`robocopy` copies `.nojekyll`. A PowerShell `Copy-Item *` skips names that
start with a dot, and without `.nojekyll` GitHub Pages runs Jekyll.

In the repository: **Settings → Pages → Build and deployment → Deploy from a
branch**. Choose `gh-pages` and the `/ (root)` folder.

Later updates go in that `gh-pages` clone: copy the changed files, commit, and
push. Do not merge `gh-pages` into `master`.

No GitHub Action is needed because there is nothing to compile.

## Link it from FUNDING.yml

`FUNDING.yml` is read from the default branch (`master`), not from `gh-pages`.
In the `VCam-Bypass` repository, create `.github/FUNDING.yml`:

```yaml
github: [xViada]
custom: ["https://xviada.github.io/VCam-Bypass/donate/"]
```

## Local development

Opening `index.html` in the browser shows the landing page. Open
`donate/index.html` for the funding page. The only difference on `file://` is
that the browser does not expose the modern clipboard API, so the copy button
falls back to `document.execCommand`. On Pages, served over HTTPS, the modern
API is used.

To serve it over HTTP locally, either of these:

```bash
python -m http.server 8000
npx serve .
```

## Structure

```
index.html                 landing page
guide/index.html           usage guide
donate/index.html          funding page
assets/css/styles.css      styles, light/dark theme, responsive layout
assets/js/config.js        funding data
assets/js/app.js           donate cards, copy, and QR modal
assets/js/theme.js         light/dark toggle, shared by every page
assets/vendor/qrcode.js    QR generator by Kazuhiko Arase (MIT)
assets/favicon.png         tab icon
.nojekyll                  stops Pages from processing the site with Jekyll
```

## Notes

- **Payment badges.** Card and wallet marks are inlined from
  [payrexx/payment-logos](https://github.com/payrexx/payment-logos) (CC0).
  No third-party requests at runtime. QR codes are computed in the browser, so
  addresses are never sent to a third party.
- **Relative paths.** The landing page references `assets/...`. The guide and
  the funding page reference `../assets/...`, so all three work on
  `user.github.io` and in a project subdirectory.
- **Footer.** Home, guide, and donate share the same footer, including the
  link to this page's source (`pageRepo`).
- **QR contents.** Encoded as `scheme:address` (for example `bitcoin:bc1...`)
  so wallet apps recognize the destination when scanning. If you leave
  `uriScheme` empty, the QR contains the address as plain text.
- **Check addresses after editing them.** Copy them from your wallet, never by
  hand, and confirm on the published page that they match character for
  character.

## License

This page is free to use. `assets/vendor/qrcode.js` is by Kazuhiko Arase under
the MIT license; it is included unmodified and keeps its copyright header.
