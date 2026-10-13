# Mahak Jain — visual identity

A written record of the system, so anything made later still looks like it
belongs. Every value below exists in code in
[`../assets/css/tokens.css`](../assets/css/tokens.css) and
[`../assets/js/card-render.js`](../assets/js/card-render.js) — change it there,
not by hand in a layout.

---

## 1. Positioning

The identity has one job: present someone who **combines AI/ML knowledge with
software development skills** — credible to recruiters, startup rooms and
prospective clients alike.

The design direction that follows from that is restraint. An engineer's
identity earns trust through precision, not decoration: Swiss typographic
discipline, generous whitespace, and exactly one accent colour used sparingly.

**Deliberately absent:** robot imagery, circuit-board motifs, neon gradients,
"AI" iconography, stock tech photography. These read as a template; the work
should read as a practice.

---

## 2. Palette

| Role | Name | Hex | Use |
|---|---|---|---|
| Ground | Warm ivory | `#F9F8F6` | Card front, landing page background |
| Type | Near-black | `#161616` | All primary text; the card back's ground |
| Accent | Electric cobalt | `#002FA7` | The focus line, the bar, rules, tags |
| Surface | White | `#FFFFFF` | Link rows, project cards, the QR field |

Tints are opacities of near-black or ivory — never a new hue. This is why the
palette stays at four colours while still supporting a full interface.

### The cobalt rule

Cobalt is the only saturated colour in the system, so it must stay rare. One
cobalt element per composition, at most two:

- **Card front** — the full-bleed left bar, plus the technical-focus line.
- **Card back** — one short rule under *Let's connect*. Nothing else.
- **Landing page** — the left rail, the focus line, link arrows, project tags.

### Contrast, measured

| Pair | Ratio | Verdict |
|---|---|---|
| Near-black on ivory | 16.4 : 1 | AAA |
| Cobalt on ivory | 10.1 : 1 | AAA |
| White on cobalt | 10.7 : 1 | AAA |
| Ivory on near-black | 17.2 : 1 | AAA |
| **Cobalt on near-black** | **1.7 : 1** | **Never use** |

That last row is the reason the card back puts no cobalt *text* on the dark
ground, and the reason the landing page commits to a single light theme instead
of inverting for dark mode — an inversion could not keep the accent without
leaving the palette.

---

## 3. Typography

**Inter** carries everything structural. **Instrument Serif**, italic only,
appears exactly once per surface — on the tagline — as an editorial accent
against the geometric sans. Two faces, two jobs, no ambiguity.

| Role | Face | Weight | Size (card) | Tracking | Case |
|---|---|---|---|---|---|
| Name | Inter | 700 | 23 pt | −0.025 em | UPPER |
| Title | Inter | 500 | 9.2 pt | −0.003 em | Sentence |
| Focus line | Inter | 600 | 6.4 pt | +0.145 em | UPPER |
| Tagline | Instrument Serif *italic* | 400 | 9.5 pt | 0 | Sentence |
| "Let's connect" | Inter | 700 | 13.5 pt | +0.015 em | UPPER |
| "Scan to explore…" | Inter | 500 | 6.2 pt | +0.130 em | UPPER |
| GitHub handle | Inter | 500 | 6.6 pt | +0.045 em | lower |

**Principle:** tracking rises as size falls. Small uppercase needs air to stay
legible in ink; the name is tightened because large caps otherwise look loose.

Fallback stacks are `Helvetica Neue, Arial` and `Georgia, Times New Roman` —
metrically close enough that a failed webfont load degrades rather than breaks.
The renderer auto-shrinks any string that would cross the safe margin, so a
longer title can never overflow the card.

---

## 4. The mark

A 2×2 grid of squares with the top-right square left open.

```
 ███   ┌─┐      three filled  — what is built
 ███   └─┘      one open      — what is next
 ███   ███
 ███   ███
```

Four modules, one gap: a monogram-free mark that reads at 26 px in a browser
tab and at 0.17 in on a card. It carries the "geometric detail" of the system
without becoming an icon.

- On ivory: filled squares cobalt, open square outlined near-black.
- On near-black: filled squares ivory, open square outlined ivory at 40%.

Defined in [`../assets/favicon.svg`](../assets/favicon.svg) and drawn by
`drawMark()` in `card-render.js`.

---

## 5. Composition

### Card front

A left-anchored Swiss column against a full-bleed cobalt bar, with a deliberate
void in the lower right.

The vertical structure is a **two-zone layout**: the mark sits at the top
margin, the name/title/focus block sits above centre, and the tagline is pinned
to the bottom margin. Top margin and bottom margin are both 0.22 in from trim,
so the composition's optical centre lands exactly on the card's centre at
1.125 in — the whitespace is *enclosed* by content, which reads as intent
rather than as an unfinished layout.

### Card back

The front, inverted. Near-black ground, ivory type, the same mark, the same
left margin — and the front's tagline baseline and the back's GitHub-handle
baseline are both at 1.880 in, so the two faces align when the card is flipped.

The QR sits in a white tile, right-aligned to the same content edge the front's
mark uses.

### Landing page

One column, 33 rem maximum. The hero repeats the card's cobalt bar as a 3 px
rail, then the same four lines of identity copy in the same order — someone who
scans the card recognises the page immediately.

Link buttons are **rows on a hairline grid**, not floating rounded cards: five
destinations should read as one object, and the row treatment keeps the Swiss
discipline that a stack of shadowed pills would break. Only the first
destination takes the near-black fill; the rest stay quiet. Border, fill and
shadow are spent by role, not stamped on everything.

---

## 6. Spacing

8 px base on screen. On the card, margins are stated from the **trim** edge:

| Measure | Value |
|---|---|
| Type margin from trim | 0.22 in |
| Printer safe margin from trim | 0.125 in |
| Cobalt bar width from trim | 0.145 in |
| Mark edge | 0.17 in |
| Minimum gap, back text → QR tile | 0.18 in |

Because margins are measured from trim rather than from the bleed edge,
exporting with or without bleed moves the page edge but never the artwork.

---

## 7. Voice

Plain, specific, unembellished. The tagline — *Building with AI, shipping with
code.* — sets the register: two verbs, no adjectives, no claim that cannot be
backed up.

Write what is true now. The identity never states years of experience, employers,
metrics or outcomes; an unfilled placeholder is always better than an invented
credential.
