# Print specification — visiting card

What to export, what to send a printer, and what to ask them for.

---

## 1. Dimensions

| | Inches | Millimetres | Pixels @300 DPI | Pixels @600 DPI |
|---|---|---|---|---|
| **Trim** (finished card) | 3.500 × 2.000 | 88.9 × 50.8 | 1050 × 600 | 2100 × 1200 |
| **Bleed** (artwork) | 3.750 × 2.250 | 95.25 × 57.15 | 1125 × 675 | 2250 × 1350 |
| Bleed per side | 0.125 | 3.175 | 37.5 | 75 |
| Safe margin from trim | 0.125 | 3.175 | 37.5 | 75 |
| **Safe area** | 3.250 × 1.750 | 82.55 × 44.45 | 975 × 525 | 1950 × 1050 |

Orientation is **landscape**. Two separate layouts: front and back.

All type sits at least 0.22 in from the trim line — 0.095 in inside the safe
margin — so nothing important is at risk from cutting tolerance. The renderer
shrinks any over-long string rather than letting it cross that boundary.

---

## 2. Exporting

Everything comes from **`../card/card.html`**.

### PDF (two pages, one face per page)

1. Set **Page size** to *3.75 × 2.25 in — with 0.125 in bleed*.
2. Click **Print both faces → PDF**.
3. In the browser print dialog:
   - Destination: **Save as PDF**
   - Margins: **None**
   - Scale: **100%** — never *Fit to page*, which silently rescales the card
   - Headers and footers: **off**
   - **Background graphics: ON** — without it the ivory and near-black grounds
     drop out and you get white cards
4. Save as `mahak-jain-card.pdf`.

Page 1 is the front, page 2 is the back.

### PNG (300 or 600 DPI)

1. Choose **Resolution**.
2. **Download front PNG** / **Download back PNG**.

Filenames encode the settings, e.g.
`mahak-jain-card-front-300dpi-bleed.png`.

Use 600 DPI if your printer accepts it — the small tracked type on the back
benefits visibly.

### QR on its own

**Download QR PNG** gives the symbol at the same module size used on the card,
with a 4-module quiet zone, dark-on-white. Useful if a printer wants to place
it themselves, or for a slide or email signature.

---

## 3. Colour — read this before ordering

**These files are RGB. They are not CMYK-separated, and they are not press-ready
in the strict sense.** A browser cannot export CMYK; claiming otherwise would be
false.

What this means in practice:

- **`#002FA7` will shift.** It is a saturated blue that sits partly outside the
  CMYK gamut. A naive conversion comes back duller and slightly purple.
- Near-black `#161616` should be printed as a **rich black**, not 100% K alone,
  or the card back will look washed and grey.

### What to tell your printer

> Artwork is supplied in RGB at 300 DPI (or 600) with 0.125 in bleed.
> Please convert to your press profile and send me a proof before the run.
>
> The blue is `#002FA7`. I care about it — please either match it as a spot
> colour or show me the closest CMYK build you can achieve.
>
> The dark ground is `#161616`; please build it as a rich black.

Two routes, pick one:

| Route | Cost | Fidelity |
|---|---|---|
| **Spot colour** (ask for the closest match to `#002FA7`) | Higher | Exact, consistent across runs |
| **CMYK process** | Standard | Noticeably duller blue |

A commonly suggested starting build is around **C 100 / M 85 / Y 0 / K 10** —
treat that as a conversation starter with your printer, not a specification.
Gamut mapping depends entirely on their press, paper and profile, so let them
convert and judge from the proof.

**Do not pick a Pantone number from a screen.** Match it from a physical swatch
book under the printer's lighting, or let them propose one.

---

## 4. The QR code

| Property | Value |
|---|---|
| Printed size | ≈ 21 mm square (`print.qrSizeIn`, default 0.84 in) |
| Quiet zone | ≥ 4 modules, and never less than 0.10 in |
| Error correction | Level M — 15% recovery |
| Colours | Near-black `#161616` on white `#FFFFFF` |
| Module edges | Snapped to whole pixels at the export resolution |

### Non-negotiables

- **Never scale it non-uniformly.** It is square and must stay square.
- **Never place it on the near-black ground.** It needs the white tile; the
  layout already provides one.
- **Never reduce it below ~20 mm** or tighten the quiet zone to gain space.
- **Never invert it.** Dark modules on a light field, always.
- Avoid heavy texture or linen stock under the code. Uncoated smooth or matte
  laminate both scan well; high-gloss can throw glare into a phone camera.

The module size is deliberately snapped to a whole device pixel — a fractional
module edge is the most common cause of a printed code that scans unreliably.
The Card Studio reports the module size in millimetres so you can confirm it.

### Before the run

1. `../tools/verify.html` — every row must read **PASS**.
2. Card Studio's *QR specification* panel — printed size ≥ 20 mm, quiet zone
   ≥ 4 modules.
3. **Print one card and scan it with a phone.** This is the only test that
   counts. On-screen verification cannot measure ink spread, contrast or glare.

---

## 5. Stock and finish

Not prescriptive — but the design assumes a flat, matte surface and rewards
good paper.

| | Suggestion | Why |
|---|---|---|
| Weight | 350–400 gsm | The card should feel substantial |
| Finish | Uncoated or matte laminate | Suits ivory; keeps the QR readable |
| Avoid | High gloss, linen, heavy texture | Glare and texture both hurt scanning |
| Printing | Both sides, full bleed | The back is a solid dark ground |

A near-black flood on the back is ink-heavy. Ask whether they recommend a
slightly heavier stock to prevent show-through, and expect the dark side to
show handling marks more than the ivory side — matte laminate helps.

---

## 6. Pre-flight checklist

- [ ] `siteUrl` in `config/profile.js` is the real, live, public URL
- [ ] That URL opens correctly in a browser
- [ ] `tools/verify.html` — all checks PASS
- [ ] Card Studio status strip shows the right URL, not *QR pending*
- [ ] Printed QR size ≥ 20 mm, quiet zone ≥ 4 modules
- [ ] Title reads exactly **AI/ML Engineer & Software Developer**
- [ ] Focus line reads exactly **AI/ML · PYTHON · WEB APPLICATIONS**
- [ ] Exported at 300 DPI or higher, with bleed
- [ ] Background graphics were ON when the PDF was made
- [ ] Printer has been asked for a proof
- [ ] A printed proof has been scanned with a phone
