/* ============================================================================
   card.js — Card Studio controller.

   Draws both faces, reports exactly what the QR encodes (or why it cannot yet),
   and exports PNGs at print resolution.

   THE RULE THIS FILE ENFORCES: a QR is drawn only when PROFILE.siteUrl (or the
   preview override) is a real, public, absolute http(s) URL. Empty values,
   bracketed placeholders, localhost, loopback and private-range addresses are
   all refused, and the card falls back to a visibly-marked pending tile.
   ========================================================================== */

(function () {
  'use strict';

  var P = window.PROFILE;

  var ui = {};
  var state = { dpi: 300, bleed: 0.125, guides: true, override: '', qr: null };

  function $(id) { return document.getElementById(id); }

  /* ------------------------------------------------------------------------
     1. URL validation — the gate between "placeholder" and "functional"
     ------------------------------------------------------------------------ */

  var REASONS = {
    empty:       'No destination set yet.',
    placeholder: 'Still a bracketed placeholder.',
    malformed:   'Not a valid absolute URL.',
    scheme:      'Must start with https:// (or http://).',
    local:       'Development address — a printed card cannot reach it.',
    host:        'Host name has no domain.'
  };

  function validateUrl(raw) {
    var v = String(raw == null ? '' : raw).trim();
    if (!v) { return { ok: false, code: 'empty' }; }
    if (/[\[\]]/.test(v)) { return { ok: false, code: 'placeholder' }; }

    var u;
    try { u = new URL(v); } catch (e) { return { ok: false, code: 'malformed' }; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') { return { ok: false, code: 'scheme' }; }

    var h = u.hostname.toLowerCase();
    var isLocal =
      h === 'localhost' || /\.localhost$/.test(h) || /\.local$/.test(h) ||
      h === '0.0.0.0' || h === '::1' || h === '[::1]' ||
      /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) ||
      /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
    if (isLocal) { return { ok: false, code: 'local' }; }
    if (h.indexOf('.') === -1) { return { ok: false, code: 'host' }; }

    return { ok: true, url: v };
  }

  function activeDestination() {
    var fromOverride = validateUrl(state.override);
    if (fromOverride.ok) { return { source: 'preview', check: fromOverride }; }
    return { source: 'config', check: validateUrl(P.siteUrl) };
  }

  /* ------------------------------------------------------------------------
     2. Render
     ------------------------------------------------------------------------ */

  function cssVars() {
    var b = state.bleed;
    var wIn = 3.5 + 2 * b, hIn = 2.0 + 2 * b;
    var root = document.documentElement.style;

    root.setProperty('--print-w', wIn + 'in');
    root.setProperty('--print-h', hIn + 'in');
    root.setProperty('--card-ratio', String(wIn / hIn));

    /* Guides as percentages so they hold at any preview scale. */
    root.setProperty('--trim-x', (b / wIn * 100) + '%');
    root.setProperty('--trim-y', (b / hIn * 100) + '%');
    root.setProperty('--safe-x', ((b + 0.125) / wIn * 100) + '%');
    root.setProperty('--safe-y', ((b + 0.125) / hIn * 100) + '%');

    var st = $('page-size');
    if (!st) {
      st = document.createElement('style');
      st.id = 'page-size';
      document.head.appendChild(st);
    }
    st.textContent = '@media print{@page{size:' + wIn + 'in ' + hIn + 'in;margin:0;}}';

    return { wIn: wIn, hIn: hIn };
  }

  function render() {
    var dest = activeDestination();
    state.qr = null;

    if (dest.check.ok) {
      try {
        state.qr = window.QR.encode(dest.check.url, {
          ecc: (P.print && P.print.qrEcc) || 'M'
        });
      } catch (e) {
        state.qr = null;
        dest.check = { ok: false, code: 'malformed', detail: e.message };
      }
    }

    var dims = cssVars();
    var opts = { dpi: state.dpi, bleed: state.bleed, profile: P, qr: state.qr };

    var mFront = window.CardRender.render(ui.canvasFront, 'front', opts);
    var mBack  = window.CardRender.render(ui.canvasBack,  'back',  opts);

    [ui.stageFront, ui.stageBack].forEach(function (s) {
      s.setAttribute('data-guides', state.guides ? 'on' : 'off');
    });

    var label = dims.wIn.toFixed(2) + ' x ' + dims.hIn.toFixed(2) + ' in · ' +
                mFront.widthPx + ' x ' + mFront.heightPx + ' px · ' + state.dpi + ' DPI';
    ui.dimFront.textContent = label;
    ui.dimBack.textContent = label;

    renderStatus(dest);
    renderSpec(mBack);
  }

  /* ------------------------------------------------------------------------
     3. Status + specification readouts
     ------------------------------------------------------------------------ */

  function renderStatus(dest) {
    var ok = dest.check.ok;
    ui.status.setAttribute('data-state', ok ? 'ready' : 'pending');

    if (ok) {
      ui.statusValue.className = 'status__value';
      ui.statusValue.textContent = dest.check.url;
      ui.statusNote.textContent = dest.source === 'preview'
        ? 'Preview only — this URL is not saved. Put it in config/profile.js as siteUrl before you print.'
        : 'Read from siteUrl in config/profile.js. Scan-test the printed proof before ordering a full run.';
    } else {
      ui.statusValue.className = 'status__value status__value--none';
      ui.statusValue.textContent = 'QR pending — ' + (REASONS[dest.check.code] || 'unusable value');
      ui.statusNote.innerHTML = 'The card back shows a marked placeholder, not a code. ' +
        'Deploy the landing page, then set <code>siteUrl</code> in <code>config/profile.js</code>.';
    }

    ui.btnQr.disabled = !ok;
  }

  function row(dl, term, value, flag) {
    var d = document.createElement('div');
    d.className = 'spec__row';
    var dt = document.createElement('dt');
    dt.textContent = term;
    var dd = document.createElement('dd');
    dd.textContent = value;
    if (flag) { dd.setAttribute('data-flag', flag); }
    d.appendChild(dt); d.appendChild(dd);
    dl.appendChild(d);
  }

  function renderSpec(mBack) {
    var dl = ui.spec;
    dl.textContent = '';

    var qr = state.qr;
    if (!qr) {
      row(dl, 'QR code', 'Not generated', 'warn');
      row(dl, 'Reason', 'No valid public URL', 'warn');
    } else {
      var m = mBack.qr;
      var mm = m.sizeIn * 25.4;
      row(dl, 'Encodes', qr.text);
      row(dl, 'Symbol version', 'Version ' + qr.version + ' (' + qr.size + ' x ' + qr.size + ' modules)');
      row(dl, 'Error correction', 'Level ' + qr.ecc + (qr.ecc === 'M' ? ' (15% recovery)' : ''));
      row(dl, 'Mask pattern', String(qr.mask));
      row(dl, 'Printed size', mm.toFixed(1) + ' mm (' + m.sizeIn.toFixed(3) + ' in)',
          mm >= 20 ? 'ok' : 'warn');
      row(dl, 'Module size', (m.modPx / state.dpi * 25.4).toFixed(2) + ' mm (' + m.modPx + ' px)');
      row(dl, 'Quiet zone', m.quietModules.toFixed(1) + ' modules',
          m.quietModules >= 4 ? 'ok' : 'warn');
      row(dl, 'Module edges', m.modPx + ' px — whole pixels', 'ok');
    }

    /* The encoder's own test suite, run live. */
    var t = window.QR.selfTest();
    var passed = t.filter(function (x) { return x.pass; }).length;
    row(dl, 'Encoder self-test', passed + ' of ' + t.length + ' passed',
        passed === t.length ? 'ok' : 'warn');

    /* A real decode of the pixels we just drew, where the browser can. */
    row(dl, 'Decode check', 'checking…');
    var lastDd = dl.lastChild.querySelector('dd');
    decodeCheck().then(function (r) {
      if (!r.supported) {
        lastDd.textContent = 'Not supported in this browser';
        lastDd.removeAttribute('data-flag');
      } else if (!state.qr) {
        lastDd.textContent = 'No code to decode';
      } else if (r.found && r.value === state.qr.text) {
        lastDd.textContent = 'Decoded, matches exactly';
        lastDd.setAttribute('data-flag', 'ok');
      } else if (r.found) {
        lastDd.textContent = 'MISMATCH: ' + r.value;
        lastDd.setAttribute('data-flag', 'warn');
      } else {
        lastDd.textContent = 'No code detected';
        lastDd.setAttribute('data-flag', 'warn');
      }
    });
  }

  /* Decode the rendered QR back out of the canvas, using the browser's own
     barcode detector. Unsupported in some browsers — reported, never faked. */
  function decodeCheck() {
    if (!state.qr || !('BarcodeDetector' in window)) {
      return Promise.resolve({ supported: false });
    }
    return window.BarcodeDetector.getSupportedFormats().then(function (f) {
      if (f.indexOf('qr_code') === -1) { return { supported: false }; }
      var c = qrCanvas(12);
      return new window.BarcodeDetector({ formats: ['qr_code'] }).detect(c)
        .then(function (res) {
          return res.length
            ? { supported: true, found: true, value: res[0].rawValue }
            : { supported: true, found: false };
        });
    }).catch(function () { return { supported: false }; });
  }

  /* ------------------------------------------------------------------------
     4. Exports
     ------------------------------------------------------------------------ */

  /* The QR on its own, with a 4-module quiet zone, dark-on-white. */
  function qrCanvas(modPx) {
    var qr = state.qr;
    var quiet = 4;
    var n = qr.size + quiet * 2;
    var c = document.createElement('canvas');
    c.width = c.height = n * modPx;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#161616';
    for (var y = 0; y < qr.size; y++) {
      for (var x = 0; x < qr.size; x++) {
        if (qr.modules[y][x]) {
          ctx.fillRect((x + quiet) * modPx, (y + quiet) * modPx, modPx, modPx);
        }
      }
    }
    return c;
  }

  function toBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('canvas encode failed')); }, 'image/png');
    });
  }

  /* Hand the file over: the claude.ai viewer needs the downloads capability,
     a local file can use an anchor. Both paths report what happened. */
  function save(filename, blob) {
    say('Preparing ' + filename + '…', '');
    var viaHost = (window.claude && typeof window.claude.use === 'function')
      ? window.claude.use('downloads') : Promise.resolve(null);

    return viaHost.then(function (d) {
      if (d) {
        return d.save({ filename: filename, data: blob }).then(function () {
          say('Saved ' + filename, 'ok');
        }, function (err) {
          var code = err && err.code;
          if (code === 'declined') { say('Save cancelled.', ''); }
          else { say('Could not save: ' + (err && err.message ? err.message : code), 'error'); }
        });
      }
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
      say('Saved ' + filename + ' to your downloads folder.', 'ok');
    }).catch(function (e) {
      say('Could not save: ' + e.message, 'error');
    });
  }

  function say(msg, tone) {
    ui.saveStatus.textContent = msg;
    ui.saveStatus.setAttribute('data-tone', tone || '');
  }

  function suffix() {
    return state.dpi + 'dpi-' + (state.bleed > 0 ? 'bleed' : 'trim');
  }

  function exportFace(face) {
    var canvas = document.createElement('canvas');
    window.CardRender.render(canvas, face, {
      dpi: state.dpi, bleed: state.bleed, profile: P, qr: state.qr
    });
    return toBlob(canvas).then(function (b) {
      return save('mahak-jain-card-' + face + '-' + suffix() + '.png', b);
    });
  }

  function exportQr() {
    if (!state.qr) { return; }
    /* Match the card's own module size so the two are identical geometry. */
    var m = window.CardRender.qrMetrics(state.qr, state.dpi, (P.print && P.print.qrSizeIn) || 0.84);
    return toBlob(qrCanvas(m.modPx)).then(function (b) {
      return save('mahak-jain-qr-' + state.dpi + 'dpi.png', b);
    });
  }

  /* ------------------------------------------------------------------------
     5. Wire up
     ------------------------------------------------------------------------ */

  function bind() {
    ui.dpi.addEventListener('change', function () {
      state.dpi = parseInt(this.value, 10) || 300;
      render();
    });
    ui.bleed.addEventListener('change', function () {
      state.bleed = parseFloat(this.value);
      render();
    });
    ui.guides.addEventListener('change', function () {
      state.guides = this.checked;
      [ui.stageFront, ui.stageBack].forEach(function (s) {
        s.setAttribute('data-guides', state.guides ? 'on' : 'off');
      });
    });

    var t = null;
    ui.override.addEventListener('input', function () {
      var v = this.value;
      clearTimeout(t);
      t = setTimeout(function () { state.override = v; render(); }, 250);
    });

    ui.btnFront.addEventListener('click', function () { exportFace('front'); });
    ui.btnBack.addEventListener('click', function () { exportFace('back'); });
    ui.btnQr.addEventListener('click', exportQr);
    ui.btnPrint.addEventListener('click', function () { window.print(); });
  }

  function init() {
    ui = {
      status: $('status'), statusValue: $('status-value'), statusNote: $('status-note'),
      dpi: $('opt-dpi'), bleed: $('opt-bleed'), guides: $('opt-guides'), override: $('opt-url'),
      stageFront: $('stage-front'), stageBack: $('stage-back'),
      canvasFront: $('canvas-front'), canvasBack: $('canvas-back'),
      dimFront: $('dim-front'), dimBack: $('dim-back'),
      spec: $('spec'), saveStatus: $('save-status'),
      btnFront: $('btn-front'), btnBack: $('btn-back'), btnQr: $('btn-qr'), btnPrint: $('btn-print')
    };

    if (!P || !window.QR || !window.CardRender) {
      document.body.textContent = 'A required script did not load (config/profile.js, qr.js or card-render.js).';
      return;
    }

    bind();

    /* Draw once immediately so the page is never blank, then redraw with the
       real faces as soon as they are available. */
    render();

    if (document.fonts && document.fonts.load) {
      Promise.all(window.CardRender.requiredFonts().map(function (f) {
        return document.fonts.load(f, 'MAHAK JAIN abcdefghijklmnopqrstuvwxyz0123456789/&·.');
      })).then(function () { return document.fonts.ready; })
        .then(render)
        .catch(function () { /* fallback faces are already drawn */ });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
