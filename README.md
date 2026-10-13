# Mahak Jain — personal branding system

A visiting card and a link-in-bio landing page sharing one visual identity, one
configuration file, and one QR code.

Plain HTML, CSS and JavaScript. No build step, no framework, no dependencies —
open any file directly in a browser, or deploy the folder as-is.

---

## 1. The one file you edit

Everything editable lives in **[`config/profile.js`](config/profile.js)**:
your links, your projects, and the QR destination. The landing page and both
card faces read from it, so you never have to search the codebase to change a
URL.

```
config/profile.js
├── name / title / focus / tagline   the identity copy
├── intro                            the landing page paragraph
├── siteUrl                     ←←←  THE QR DESTINATION (see §4)
├── links[]                          the five buttons; '' means unconfigured
├── projects[]                       placeholders until you fill them in
└── print.qrEcc / print.qrSizeIn      QR error correction and printed size
```

### Still to fill in

These were left as editable placeholders because inventing them would have put
false information on your card and page:

| Field | Where |
|---|---|
| Portfolio URL | `links[0].url` |
| LinkedIn URL | `links[1].url` |
| Instagram URL | `links[3].url` |
| Email address | `links[4].url` |
| Three projects | `projects[]` |
| **Landing page URL** | **`siteUrl`** — set this after you deploy |

GitHub (`https://github.com/mahak-bit`) is already configured — it is the one
URL you supplied.

An empty URL is never a broken link: the landing page renders that button as a
visibly inert row marked *Not configured*, so a recruiter never lands on a dead
page.

---

## 2. Project layout

```
.
├── index.html                  the landing page (deploy root)
├── vercel.json                 static hosting config + cache headers
├── config/
│   └── profile.js              ← single source of truth
├── assets/
│   ├── favicon.svg             the brand mark
│   ├── css/
│   │   ├── tokens.css          palette, type, spacing — every brand value
│   │   ├── site.css            landing page
│   │   ├── card.css            card studio (screen)
│   │   └── card-print.css      dedicated print stylesheet
│   └── js/
│       ├── qr.js               QR encoder (ISO/IEC 18004) + its test suite
│       ├── card-render.js      the card artwork: one geometry definition
│       ├── card.js             card studio controller + PNG export
│       └── app.js              renders the landing page from the config
├── card/
│   └── card.html               Card Studio — preview, verify, print, export
├── tools/
│   ├── verify.html             run the QR encoder's tests before printing
│   ├── export.sh               regenerate everything in dist/
│   ├── export-face.html        build helper: one card face at 1:1 pixels
│   └── preview-mobile.html     build helper: true 390px phone render
├── dist/                       generated artwork (safe to delete and rebuild)
├── brand/
│   └── BRAND-GUIDELINES.md     the identity system, written down
└── print/
    └── PRINT-SPEC.md           what to send a printer, and what to ask for
```

---

## 3. Running it locally

Open the files directly — `index.html` and `card/card.html` both work over
`file://`. For the landing page it is slightly better to serve them, so that
relative paths and fonts behave exactly as they will in production:

```bash
# any one of these, from the project root
npx serve .
python -m http.server 8000
```

Then visit `http://localhost:8000` (landing page) and
`http://localhost:8000/card/card.html` (Card Studio).

---

## 4. Deploy, then make the QR real — in this order

The QR code is deliberately **not** finished yet, because a QR code cannot be
built before the URL it points to exists. Until `siteUrl` is set, the card back
prints a clearly-marked `QR PENDING` tile — never a decorative pattern
pretending to be scannable.

### Step 1 — deploy

```bash
npm i -g vercel        # once
cd <this folder>
vercel login           # opens your browser; needs YOUR account
vercel --prod
```

Vercel will print the live URL, e.g. `https://visiting-xxxx.vercel.app`.
There is nothing to configure: `vercel.json` already declares this as a static
site.

> GitHub Pages, Netlify and Cloudflare Pages work identically — any static host
> will serve this folder unchanged.

### Step 2 — confirm the URL actually loads

Open it in a browser. Check the five link buttons behave as you expect.

### Step 3 — put it in the config

```js
siteUrl: 'https://your-real-url.vercel.app',
```

### Step 4 — verify the encoder

Open [`tools/verify.html`](tools/verify.html). Every row must read **PASS**.
It runs the encoder's test suite and then decodes a generated code back to
confirm the symbol carries the exact string.

### Step 5 — check the card

Open [`card/card.html`](card/card.html). The status strip at the top should now
show your URL, and the *QR specification* panel reports the symbol version,
printed size in millimetres, and quiet zone in modules.

### Step 6 — scan a printed proof

Print one card, scan it with your phone, confirm it opens your page. **Do this
before ordering a full run.** No amount of on-screen verification substitutes
for a phone reading real ink.

---

## 5. Exporting artwork

### Everything at once (recommended)

```bash
bash tools/export.sh
```

Regenerates every file in `dist/` — both faces at 300 and 600 DPI, with and
without bleed, the two landing-page previews, and the print-ready PDF. It
drives a headless Edge or Chrome, so run it while online (the fonts are fetched
from Google Fonts).

Re-run it after any change to `config/profile.js` — in particular after you set
`siteUrl`, which is what turns the `QR PENDING` tile into a real code.

### Or one file at a time

All exports are also available by hand from **[`card/card.html`](card/card.html)**.

| Button | Output |
|---|---|
| Print both faces → PDF | Two-page PDF, one face per page, exact card size |
| Download front PNG | `mahak-jain-card-front-300dpi-bleed.png` |
| Download back PNG | `mahak-jain-card-back-300dpi-bleed.png` |
| Download QR PNG | The QR alone, with a 4-module quiet zone |

Switch **Resolution** to 600 DPI for noticeably crisper small type, and
**Page size** to *trimmed* if your printer asks for artwork without bleed.

For the PDF, set the browser print dialog to **Margins: None**, **Scale: 100%**
and **Background graphics: on**. Full detail in
[`print/PRINT-SPEC.md`](print/PRINT-SPEC.md).

---

## 6. Honest limits

- **Colour is RGB, not CMYK.** Browsers cannot export CMYK, so these files are
  not separated for press. The cobalt `#002FA7` is a saturated blue that sits
  outside a chunk of the CMYK gamut and *will* shift when converted. Ask your
  printer to convert and send you a proof, or to match a spot colour. See
  `print/PRINT-SPEC.md`.
- **PNG and PDF output is raster**, rendered at the DPI you select. At 300 DPI
  this meets normal print specification; at 600 DPI small type is excellent.
- **Fonts load from Google Fonts.** Export while online, or the card falls back
  to Helvetica/Arial and Georgia and the metrics shift slightly.
- **Nothing here claims experience, employment or results.** The projects
  section and four of the five links are placeholders by design.
