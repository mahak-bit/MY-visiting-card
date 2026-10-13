/* ============================================================================
   card-render.js — the visiting card, drawn from ONE geometry definition.

   WHY ONE RENDERER: screen preview, print output and the 300/600 DPI PNG
   exports are the same code at different scales. There is no second layout to
   drift out of sync, so what you approve on screen is what the printer gets.

   COORDINATES: every number below is in INCHES, measured from the top-left of
   the BLEED box (3.75 x 2.25). The trim edge sits 0.125in inside that; the
   safe area another 0.125in inside the trim. Rendering at a smaller bleed
   simply translates the origin, so the artwork and its margins never move
   relative to the trim.
   ========================================================================== */

(function (global) {
  'use strict';

  /* ------------------------------------------------------------------------
     Geometry
     ------------------------------------------------------------------------ */

  var GEO = {
    fullBleed: 0.125,     /* bleed the artwork is designed for, per side */
    trimW: 3.5,           /* standard business card, landscape           */
    trimH: 2.0,
    margin: 0.22,         /* type margin, measured in from the TRIM edge */
    safe:   0.125,        /* printer safe margin, in from the TRIM edge  */
    barW:   0.145,        /* cobalt bar width, measured in from the trim */
    mark:   0.17,         /* brand mark edge length                      */
    gutter: 0.18          /* minimum gap between the back's text and QR  */
  };

  GEO.W = GEO.trimW + 2 * GEO.fullBleed;        /* 3.75 */
  GEO.H = GEO.trimH + 2 * GEO.fullBleed;        /* 2.25 */

  /* Horizontal anchors (bleed coordinates) */
  var X = {
    barEnd:       GEO.fullBleed + GEO.barW,                  /* 0.270 */
    frontLeft:    GEO.fullBleed + GEO.barW + 0.26,           /* 0.530 */
    backLeft:     GEO.fullBleed + GEO.margin,                /* 0.345 */
    contentRight: GEO.W - GEO.fullBleed - GEO.margin         /* 3.405 */
  };

  /* Baselines (bleed coordinates). The front's tagline and the back's GitHub
     handle share the baseline at 1.880 — the two faces align when stacked. */
  var Y = {
    markTop:   GEO.fullBleed + GEO.margin,                   /* 0.345 */
    name:      0.995,
    rule:      1.095,
    title:     1.250,
    focus:     1.410,
    tagline:   1.880,

    connect:   1.045,
    backRule:  1.135,
    scan:      1.300,
    handle:    1.880
  };

  var COLOR = {
    ivory:  '#F9F8F6',
    ink:    '#161616',
    cobalt: '#002FA7',
    white:  '#FFFFFF',
    ink20:  'rgba(22,22,22,0.20)',
    ink56:  'rgba(22,22,22,0.56)',
    ink72:  'rgba(22,22,22,0.72)',
    ivory40:'rgba(249,248,246,0.40)',
    ivory62:'rgba(249,248,246,0.62)',
    ivory72:'rgba(249,248,246,0.72)'
  };

  var SANS  = "'Inter', 'Helvetica Neue', Arial, sans-serif";
  var SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif";

  /* Type specs. size is in POINTS; tracking is in EM. */
  var TYPE = {
    name:    { family: SANS,  weight: 700, size: 23,   tracking: -0.025, caps: true  },
    title:   { family: SANS,  weight: 500, size: 9.2,  tracking: -0.003 },
    focus:   { family: SANS,  weight: 600, size: 6.4,  tracking: 0.145,  caps: true  },
    tagline: { family: SERIF, weight: 400, size: 9.5,  tracking: 0,      style: 'italic' },
    connect: { family: SANS,  weight: 700, size: 13.5, tracking: 0.015,  caps: true  },
    scan:    { family: SANS,  weight: 500, size: 6.2,  tracking: 0.130,  caps: true  },
    handle:  { family: SANS,  weight: 500, size: 6.6,  tracking: 0.045 },
    qrLabel: { family: SANS,  weight: 700, size: 7,    tracking: 0.120,  caps: true  },
    qrHint:  { family: SANS,  weight: 500, size: 5,    tracking: 0.02 },
    qrPath:  { family: SANS,  weight: 600, size: 5,    tracking: 0.02 }
  };

  /* The fonts the renderer needs, as CSS font shorthands for document.fonts. */
  function requiredFonts() {
    var out = [];
    for (var k in TYPE) {
      var f = TYPE[k];
      out.push((f.style ? f.style + ' ' : '') + f.weight + ' 16px ' +
               (f.family === SERIF ? "'Instrument Serif'" : "'Inter'"));
    }
    return out;
  }

  /* ------------------------------------------------------------------------
     Text helpers — tracking, measuring, auto-fitting
     ------------------------------------------------------------------------ */

  function applyFont(ctx, f, dpi) {
    var px = f.size * dpi / 72;
    ctx.font = (f.style ? f.style + ' ' : '') + f.weight + ' ' + px + 'px ' + f.family;
    var tr = (f.tracking || 0) * px;
    /* Chromium exposes ctx.letterSpacing and keeps kerning; fall back to
       per-character placement where it is missing. */
    if ('letterSpacing' in ctx) {
      ctx.letterSpacing = tr + 'px';
      ctx.__manualTrack = 0;
    } else {
      ctx.__manualTrack = tr;
    }
    ctx.__tr = tr;
    return tr;
  }

  function measure(ctx, s) {
    if (ctx.__manualTrack) {
      var w = 0;
      for (var i = 0; i < s.length; i++) { w += ctx.measureText(s[i]).width; }
      return w + ctx.__manualTrack * Math.max(0, s.length - 1);
    }
    /* Chromium adds the spacing after the final glyph too; discount it. */
    return ctx.measureText(s).width - ctx.__tr;
  }

  function drawText(ctx, s, x, y) {
    if (!ctx.__manualTrack) { ctx.fillText(s, x, y); return; }
    var cx = x;
    for (var i = 0; i < s.length; i++) {
      ctx.fillText(s[i], cx, y);
      cx += ctx.measureText(s[i]).width + ctx.__manualTrack;
    }
  }

  /* Shrink the face until the string fits, so a longer config value can never
     cross the safe margin. Returns the size actually used. */
  function fitFont(ctx, f, s, maxW, dpi) {
    var spec = { family: f.family, weight: f.weight, size: f.size,
                 tracking: f.tracking, style: f.style, caps: f.caps };
    for (var i = 0; i < 48; i++) {
      applyFont(ctx, spec, dpi);
      if (measure(ctx, s) <= maxW) { break; }
      spec.size *= 0.975;
    }
    return spec;
  }

  function run(ctx, key, text, x, y, color, maxW, dpi, align) {
    if (!text) { return 0; }
    var f = TYPE[key];
    var s = f.caps ? String(text).toUpperCase() : String(text);
    fitFont(ctx, f, s, maxW, dpi);
    var w = measure(ctx, s);
    ctx.fillStyle = color;
    drawText(ctx, s, align === 'right' ? x - w : x, y);
    return w;
  }

  /* ------------------------------------------------------------------------
     Brand mark: a 2x2 module grid, one square left open.
     ------------------------------------------------------------------------ */

  function drawMark(ctx, x, y, size, fill, stroke, dpi) {
    var u = size / 24, sq = 10 * u, sw = Math.max(1, 2.4 * u);
    ctx.fillStyle = fill;
    ctx.fillRect(x,             y,             sq, sq);   /* top-left     */
    ctx.fillRect(x,             y + 14 * u,    sq, sq);   /* bottom-left  */
    ctx.fillRect(x + 14 * u,    y + 14 * u,    sq, sq);   /* bottom-right */
    ctx.strokeStyle = stroke;                             /* top-right: open */
    ctx.lineWidth = sw;
    ctx.strokeRect(x + 14 * u + sw / 2, y + sw / 2, sq - sw, sq - sw);
  }

  /* ------------------------------------------------------------------------
     QR placement
     ------------------------------------------------------------------------ */

  /* Module size is snapped to a whole device pixel: a fractional module edge
     is the usual cause of a printed code that scans unreliably. */
  function qrMetrics(qr, dpi, targetIn) {
    var targetPx = targetIn * dpi;
    var modPx = Math.max(2, Math.round(targetPx / qr.size));
    var qrPx = modPx * qr.size;
    /* Quiet zone: the standard's 4 modules, and never less than 0.10in. */
    var quietPx = Math.max(4 * modPx, Math.round(0.10 * dpi));
    return {
      modPx: modPx,
      qrPx: qrPx,
      quietPx: quietPx,
      tilePx: qrPx + 2 * quietPx,
      sizeIn: qrPx / dpi,
      quietIn: quietPx / dpi,
      quietModules: quietPx / modPx
    };
  }

  function drawQr(ctx, qr, originPx, modPx) {
    ctx.fillStyle = COLOR.ink;
    for (var y = 0; y < qr.size; y++) {
      var row = qr.modules[y];
      for (var x = 0; x < qr.size; x++) {
        if (row[x]) {
          ctx.fillRect(originPx.x + x * modPx, originPx.y + y * modPx, modPx, modPx);
        }
      }
    }
  }

  /* Honest stand-in while PROFILE.siteUrl is empty. Deliberately NOT a
     QR-like pattern: nothing here could be mistaken for a scannable code. */
  function drawQrPending(ctx, tile, dpi, I) {
    ctx.fillStyle = COLOR.white;
    ctx.fillRect(tile.x, tile.y, tile.size, tile.size);

    var inset = I(0.055);
    ctx.strokeStyle = COLOR.ink20;
    ctx.lineWidth = Math.max(1, I(0.008));
    if (ctx.setLineDash) { ctx.setLineDash([I(0.035), I(0.025)]); }
    ctx.strokeRect(tile.x + inset, tile.y + inset, tile.size - 2 * inset, tile.size - 2 * inset);
    if (ctx.setLineDash) { ctx.setLineDash([]); }

    var cx = tile.x + tile.size / 2;
    var maxW = tile.size - 2 * inset - I(0.06);

    var f = TYPE.qrLabel, s = 'QR PENDING';
    fitFont(ctx, f, s, maxW, dpi);
    ctx.fillStyle = COLOR.ink;
    drawText(ctx, s, cx - measure(ctx, s) / 2, tile.y + tile.size / 2 - I(0.045));

    f = TYPE.qrHint; s = 'SET siteUrl IN';
    fitFont(ctx, f, s, maxW, dpi);
    ctx.fillStyle = COLOR.ink56;
    drawText(ctx, s, cx - measure(ctx, s) / 2, tile.y + tile.size / 2 + I(0.075));

    f = TYPE.qrPath; s = 'config/profile.js';
    fitFont(ctx, f, s, maxW, dpi);
    ctx.fillStyle = COLOR.ink;
    drawText(ctx, s, cx - measure(ctx, s) / 2, tile.y + tile.size / 2 + I(0.165));
  }

  /* ------------------------------------------------------------------------
     The two faces
     ------------------------------------------------------------------------ */

  function drawFront(ctx, dpi, P, I) {
    /* ground */
    ctx.fillStyle = COLOR.ivory;
    ctx.fillRect(I(-0.2), I(-0.2), I(GEO.W + 0.4), I(GEO.H + 0.4));

    /* full-bleed cobalt bar: the identity's strongest single gesture */
    ctx.fillStyle = COLOR.cobalt;
    ctx.fillRect(I(-0.2), I(-0.2), I(X.barEnd + 0.2), I(GEO.H + 0.4));

    /* brand mark, top right */
    drawMark(ctx, I(X.contentRight - GEO.mark), I(Y.markTop), I(GEO.mark),
             COLOR.cobalt, COLOR.ink, dpi);

    var maxW = I(X.contentRight - X.frontLeft);
    var left = I(X.frontLeft);

    run(ctx, 'name',  P.name,  left, I(Y.name),  COLOR.ink,    maxW, dpi);

    /* hairline with a cobalt leading segment */
    var th = Math.max(1, I(0.0085));
    ctx.fillStyle = COLOR.cobalt;
    ctx.fillRect(left, I(Y.rule), I(0.21), th);
    ctx.fillStyle = COLOR.ink20;
    ctx.fillRect(left + I(0.21), I(Y.rule), I(0.95 - 0.21), th);

    run(ctx, 'title',   P.title,   left, I(Y.title),   COLOR.ink,    maxW, dpi);
    run(ctx, 'focus',   P.focus,   left, I(Y.focus),   COLOR.cobalt, maxW, dpi);
    run(ctx, 'tagline', P.tagline, left, I(Y.tagline), COLOR.ink72,  maxW, dpi);
  }

  function drawBack(ctx, dpi, P, qr, I) {
    /* ground */
    ctx.fillStyle = COLOR.ink;
    ctx.fillRect(I(-0.2), I(-0.2), I(GEO.W + 0.4), I(GEO.H + 0.4));

    /* --- QR tile, right-aligned to the content edge, vertically centred --- */
    var tileSizePx, met = null;
    if (qr) {
      met = qrMetrics(qr, dpi, (P.print && P.print.qrSizeIn) || 0.84);
      tileSizePx = met.tilePx;
    } else {
      tileSizePx = I(1.11);
    }
    var tile = {
      x: I(X.contentRight) - tileSizePx,
      y: I(GEO.H / 2) - tileSizePx / 2,
      size: tileSizePx
    };

    if (qr && met) {
      ctx.fillStyle = COLOR.white;
      ctx.fillRect(tile.x, tile.y, tile.size, tile.size);
      drawQr(ctx, qr, { x: tile.x + met.quietPx, y: tile.y + met.quietPx }, met.modPx);
    } else {
      drawQrPending(ctx, tile, dpi, I);
    }

    /* --- left text column ------------------------------------------------- */
    var left = I(X.backLeft);
    var maxW = tile.x - left - I(GEO.gutter);

    drawMark(ctx, left, I(Y.markTop), I(GEO.mark), COLOR.ivory, COLOR.ivory40, dpi);

    /* Typographic apostrophe (U+2019), not a straight quote. */
    run(ctx, 'connect', 'Let’s connect', left, I(Y.connect), COLOR.ivory, maxW, dpi);

    ctx.fillStyle = COLOR.cobalt;
    ctx.fillRect(left, I(Y.backRule), I(0.22), Math.max(1, I(0.014)));

    run(ctx, 'scan',   'Scan to explore my work', left, I(Y.scan),   COLOR.ivory72, maxW, dpi);
    run(ctx, 'handle', P.githubHandle,            left, I(Y.handle), COLOR.ivory62, maxW, dpi);
  }

  /* ------------------------------------------------------------------------
     Public entry point
     ------------------------------------------------------------------------ */

  /**
   * Draw a face onto a canvas.
   * @param {HTMLCanvasElement} canvas
   * @param {'front'|'back'} face
   * @param {object} opts  { dpi, bleed, profile, qr }
   *   dpi    device pixels per inch (300 for print, 600 for extra-crisp type)
   *   bleed  inches of bleed per side to include (0.125 for press, 0 for trim)
   *   qr     a QR.encode() result, or null to draw the pending placeholder
   * @returns {object} metrics describing what was drawn
   */
  function render(canvas, face, opts) {
    opts = opts || {};
    var dpi   = opts.dpi || 300;
    var bleed = opts.bleed == null ? GEO.fullBleed : opts.bleed;
    var P     = opts.profile || global.PROFILE;
    var qr    = opts.qr || null;

    var wIn = GEO.trimW + 2 * bleed;
    var hIn = GEO.trimH + 2 * bleed;

    canvas.width  = Math.round(wIn * dpi);
    canvas.height = Math.round(hIn * dpi);

    var ctx = canvas.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* Shift so artwork keeps its position relative to the TRIM edge. */
    var off = (bleed - GEO.fullBleed) * dpi;
    ctx.translate(off, off);

    var I = function (inches) { return inches * dpi; };
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    if (face === 'back') { drawBack(ctx, dpi, P, qr, I); }
    else { drawFront(ctx, dpi, P, I); }

    ctx.restore();

    return {
      face: face, dpi: dpi, bleed: bleed,
      widthPx: canvas.width, heightPx: canvas.height,
      widthIn: wIn, heightIn: hIn,
      qr: qr ? qrMetrics(qr, dpi, (P.print && P.print.qrSizeIn) || 0.84) : null
    };
  }

  global.CardRender = {
    render: render,
    GEO: GEO, X: X, Y: Y, COLOR: COLOR, TYPE: TYPE,
    qrMetrics: qrMetrics,
    requiredFonts: requiredFonts
  };

})(typeof window !== 'undefined' ? window : globalThis);
