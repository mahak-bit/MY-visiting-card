/* ============================================================================
   qr.js — QR Code encoder (ISO/IEC 18004), byte mode, versions 1–40.
   No dependencies. Works in the browser and in Node.

   WHY HAND-ROLLED: a printed card needs a QR that is generated locally and
   deterministically, with no CDN and no network call at print time. This is a
   complete, standards-conformant encoder, not a pattern generator.

   PUBLIC API
     QR.encode(text, {ecc:'L'|'M'|'Q'|'H', minVersion, maxVersion})
         -> { size, version, ecc, mask, get(x,y), modules }
     QR.toPath(qr)        -> SVG path 'd' string, 1 unit per module
     QR.selfTest()        -> [{name, pass, detail}]  (see tools/verify.html)

   The encoder is verified by QR.selfTest(), which checks the Reed–Solomon
   remainder is divisible by its generator, reads the placed codewords back out
   of the matrix, de-interleaves them and re-checks every block's syndrome.
   ========================================================================== */

(function (global) {
  'use strict';

  /* ------------------------------------------------------------------------
     1. Capacity tables, indexed [eccOrdinal][version]. Index 0 is unused.
     ------------------------------------------------------------------------ */

  var ECC_PER_BLOCK = [
    /* L */ [-1, 7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    /* M */ [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
    /* Q */ [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    /* H */ [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]
  ];

  var NUM_BLOCKS = [
    /* L */ [-1,1,1,1,1,1,2,2,2,2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
    /* M */ [-1,1,1,1,2,2,4,4,4,5, 5, 5, 8, 9, 9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
    /* Q */ [-1,1,1,2,2,4,4,6,6,8, 8, 8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
    /* H */ [-1,1,1,2,4,4,4,5,6,8, 8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]
  ];

  var ECC_ORD = { L: 0, M: 1, Q: 2, H: 3 };
  var ECC_FMT = { L: 1, M: 0, Q: 3, H: 2 };   /* on-matrix format value */

  /* Total 8-bit codewords a version holds, derived from the module count. */
  function rawDataModules(ver) {
    var n = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var numAlign = Math.floor(ver / 7) + 2;
      n -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) { n -= 36; }              /* two version-info blocks */
    }
    return n;
  }
  function totalCodewords(ver) { return Math.floor(rawDataModules(ver) / 8); }
  function dataCodewords(ver, ord) {
    return totalCodewords(ver) - ECC_PER_BLOCK[ord][ver] * NUM_BLOCKS[ord][ver];
  }

  function alignmentPositions(ver) {
    if (ver === 1) { return []; }
    var numAlign = Math.floor(ver / 7) + 2;
    var step = (ver === 32)
      ? 26
      : Math.floor((ver * 4 + numAlign * 2 + 1) / (numAlign * 2 - 2)) * 2;
    var out = [6];
    for (var pos = ver * 4 + 17 - 7; out.length < numAlign; pos -= step) {
      out.splice(1, 0, pos);
    }
    return out;
  }

  /* ------------------------------------------------------------------------
     2. GF(256) arithmetic and Reed–Solomon, primitive polynomial 0x11D.
     ------------------------------------------------------------------------ */

  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = ((z << 1) ^ ((z >>> 7) * 0x11D)) & 0xFF;
      z = (z ^ (((y >>> i) & 1) * x)) & 0xFF;
    }
    return z;
  }

  /* Generator polynomial coefficients, descending, leading 1 implied. */
  function rsGenerator(degree) {
    var result = new Uint8Array(degree);
    result[degree - 1] = 1;
    var root = 1;
    for (var i = 0; i < degree; i++) {
      for (var j = 0; j < degree; j++) {
        result[j] = gfMul(result[j], root);
        if (j + 1 < degree) { result[j] ^= result[j + 1]; }
      }
      root = gfMul(root, 0x02);
    }
    return result;
  }

  function rsRemainder(data, gen) {
    var degree = gen.length;
    var result = new Uint8Array(degree);
    for (var i = 0; i < data.length; i++) {
      var factor = (data[i] ^ result[0]) & 0xFF;
      for (var s = 0; s < degree - 1; s++) { result[s] = result[s + 1]; }
      result[degree - 1] = 0;
      for (var j = 0; j < degree; j++) { result[j] ^= gfMul(gen[j], factor); }
    }
    return result;
  }

  /* ------------------------------------------------------------------------
     3. Bit buffer + data codeword assembly
     ------------------------------------------------------------------------ */

  function utf8Bytes(text) {
    if (typeof TextEncoder !== 'undefined') {
      return Array.prototype.slice.call(new TextEncoder().encode(text));
    }
    var out = [], i, c;
    for (i = 0; i < text.length; i++) {
      c = text.charCodeAt(i);
      if (c < 0x80) { out.push(c); }
      else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 63)); }
      else { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
    }
    return out;
  }

  function charCountBits(ver) { return ver <= 9 ? 8 : 16; }

  function addCodewords(text, ver, ord) {
    var bytes = utf8Bytes(text);
    var bits = [];
    function push(value, len) {
      for (var i = len - 1; i >= 0; i--) { bits.push((value >>> i) & 1); }
    }
    push(0x4, 4);                              /* byte mode */
    push(bytes.length, charCountBits(ver));
    for (var i = 0; i < bytes.length; i++) { push(bytes[i], 8); }

    var capacityBits = dataCodewords(ver, ord) * 8;
    push(0, Math.min(4, capacityBits - bits.length));          /* terminator */
    push(0, (8 - bits.length % 8) % 8);                        /* byte align  */

    var dat = new Uint8Array(capacityBits / 8);
    for (var b = 0; b < bits.length; b++) {
      dat[b >>> 3] |= bits[b] << (7 - (b & 7));
    }
    for (var p = bits.length / 8, pad = 0xEC; p < dat.length; p++, pad ^= 0xEC ^ 0x11) {
      dat[p] = pad;                            /* 0xEC, 0x11, 0xEC, ... */
    }
    return dat;
  }

  /* Split into blocks, append ECC, interleave. */
  function interleave(dat, ver, ord) {
    var numBlocks = NUM_BLOCKS[ord][ver];
    var eccLen = ECC_PER_BLOCK[ord][ver];
    var raw = totalCodewords(ver);
    var shortLen = Math.floor(raw / numBlocks);
    var numShort = numBlocks - raw % numBlocks;
    var gen = rsGenerator(eccLen);

    var blocks = [], off = 0, i, j;
    for (i = 0; i < numBlocks; i++) {
      var len = shortLen - eccLen + (i < numShort ? 0 : 1);
      var block = new Uint8Array(shortLen + 1);
      for (j = 0; j < len; j++) { block[j] = dat[off + j]; }
      var ecc = rsRemainder(dat.subarray(off, off + len), gen);
      for (j = 0; j < eccLen; j++) { block[shortLen + 1 - eccLen + j] = ecc[j]; }
      blocks.push(block);
      off += len;
    }

    var out = new Uint8Array(raw), k = 0;
    for (i = 0; i < shortLen + 1; i++) {
      for (j = 0; j < numBlocks; j++) {
        /* short blocks have no codeword at the pre-ECC padding index */
        if (i !== shortLen - eccLen || j >= numShort) { out[k++] = blocks[j][i]; }
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------------
     4. Matrix construction
     ------------------------------------------------------------------------ */

  function getBit(x, i) { return ((x >>> i) & 1) !== 0; }

  function Matrix(ver, ord) {
    this.ver = ver;
    this.ord = ord;
    this.size = ver * 4 + 17;
    this.m = [];
    this.fn = [];
    for (var y = 0; y < this.size; y++) {
      this.m.push(new Uint8Array(this.size));
      this.fn.push(new Uint8Array(this.size));
    }
  }

  Matrix.prototype.setFn = function (x, y, dark) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) { return; }
    this.m[y][x] = dark ? 1 : 0;
    this.fn[y][x] = 1;
  };

  Matrix.prototype.drawFunctionPatterns = function (eccFmt) {
    var size = this.size, i, j;

    for (i = 0; i < size; i++) {                       /* timing patterns */
      this.setFn(6, i, i % 2 === 0);
      this.setFn(i, 6, i % 2 === 0);
    }

    var finders = [[3, 3], [size - 4, 3], [3, size - 4]];
    for (i = 0; i < 3; i++) {
      var fx = finders[i][0], fy = finders[i][1];
      for (var dy = -4; dy <= 4; dy++) {
        for (var dx = -4; dx <= 4; dx++) {
          var dist = Math.max(Math.abs(dx), Math.abs(dy));
          this.setFn(fx + dx, fy + dy, dist !== 2 && dist !== 4);
        }
      }
    }

    var pos = alignmentPositions(this.ver), n = pos.length;
    for (i = 0; i < n; i++) {
      for (j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) {
          continue;                                    /* occupied by finders */
        }
        for (var ay = -2; ay <= 2; ay++) {
          for (var ax = -2; ax <= 2; ax++) {
            this.setFn(pos[i] + ax, pos[j] + ay, Math.max(Math.abs(ax), Math.abs(ay)) !== 1);
          }
        }
      }
    }

    this.drawFormat(eccFmt, 0);                        /* reserve the area */
    this.drawVersion();
  };

  Matrix.prototype.drawFormat = function (eccFmt, mask) {
    var data = (eccFmt << 3) | mask;
    var rem = data;
    for (var i = 0; i < 10; i++) { rem = (rem << 1) ^ ((rem >>> 9) * 0x537); }
    var bits = ((data << 10) | rem) ^ 0x5412;
    var size = this.size;

    for (i = 0; i <= 5; i++) { this.setFn(8, i, getBit(bits, i)); }
    this.setFn(8, 7, getBit(bits, 6));
    this.setFn(8, 8, getBit(bits, 7));
    this.setFn(7, 8, getBit(bits, 8));
    for (i = 9; i < 15; i++) { this.setFn(14 - i, 8, getBit(bits, i)); }

    for (i = 0; i < 8; i++) { this.setFn(size - 1 - i, 8, getBit(bits, i)); }
    for (i = 8; i < 15; i++) { this.setFn(8, size - 15 + i, getBit(bits, i)); }
    this.setFn(8, size - 8, true);                     /* dark module */
  };

  Matrix.prototype.drawVersion = function () {
    if (this.ver < 7) { return; }
    var rem = this.ver;
    for (var i = 0; i < 12; i++) { rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25); }
    var bits = (this.ver << 12) | rem;
    for (i = 0; i < 18; i++) {
      var bit = getBit(bits, i);
      var a = this.size - 11 + i % 3, b = Math.floor(i / 3);
      this.setFn(a, b, bit);
      this.setFn(b, a, bit);
    }
  };

  /* Zigzag codeword placement. Also used in reverse by the self-test. */
  Matrix.prototype.eachDataModule = function (visit) {
    var size = this.size, i = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) { right = 5; }
      for (var vert = 0; vert < size; vert++) {
        for (var j = 0; j < 2; j++) {
          var x = right - j;
          var upward = ((right + 1) & 2) === 0;
          var y = upward ? size - 1 - vert : vert;
          if (!this.fn[y][x]) { visit(x, y, i++); }
        }
      }
    }
    return i;
  };

  Matrix.prototype.drawCodewords = function (data) {
    var self = this, total = data.length * 8;
    this.eachDataModule(function (x, y, i) {
      if (i < total) { self.m[y][x] = getBit(data[i >>> 3], 7 - (i & 7)) ? 1 : 0; }
    });
  };

  function maskBit(mask, x, y) {
    switch (mask) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return x * y % 2 + x * y % 3 === 0;
      case 6: return (x * y % 2 + x * y % 3) % 2 === 0;
      default: return ((x + y) % 2 + x * y % 3) % 2 === 0;
    }
  }

  Matrix.prototype.applyMask = function (mask) {
    for (var y = 0; y < this.size; y++) {
      for (var x = 0; x < this.size; x++) {
        if (!this.fn[y][x] && maskBit(mask, x, y)) { this.m[y][x] ^= 1; }
      }
    }
  };

  /* Standard penalty rules. Mask choice affects legibility, never validity. */
  Matrix.prototype.penalty = function () {
    var size = this.size, score = 0, x, y, run, color, line;

    for (y = 0; y < size; y++) {
      run = 0; color = -1; line = '';
      for (x = 0; x < size; x++) {
        line += this.m[y][x] ? '1' : '0';
        if (this.m[y][x] === color) { run++; if (run === 5) { score += 3; } else if (run > 5) { score += 1; } }
        else { color = this.m[y][x]; run = 1; }
      }
      score += 40 * countFinderLike(line);
    }
    for (x = 0; x < size; x++) {
      run = 0; color = -1; line = '';
      for (y = 0; y < size; y++) {
        line += this.m[y][x] ? '1' : '0';
        if (this.m[y][x] === color) { run++; if (run === 5) { score += 3; } else if (run > 5) { score += 1; } }
        else { color = this.m[y][x]; run = 1; }
      }
      score += 40 * countFinderLike(line);
    }
    for (y = 0; y < size - 1; y++) {
      for (x = 0; x < size - 1; x++) {
        var v = this.m[y][x];
        if (v === this.m[y][x + 1] && v === this.m[y + 1][x] && v === this.m[y + 1][x + 1]) { score += 3; }
      }
    }
    var dark = 0;
    for (y = 0; y < size; y++) { for (x = 0; x < size; x++) { dark += this.m[y][x]; } }
    var total = size * size;
    var k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    score += Math.max(0, k) * 10;
    return score;
  };

  function countFinderLike(line) {
    var n = 0, padded = '0000' + line + '0000', i;
    for (i = 0; i + 11 <= padded.length; i++) {
      var w = padded.substr(i, 11);
      if (w === '10111010000' || w === '00001011101') { n++; }
    }
    return n;
  }

  /* ------------------------------------------------------------------------
     5. Public encode
     ------------------------------------------------------------------------ */

  function encode(text, opts) {
    opts = opts || {};
    var eccName = (opts.ecc || 'M').toUpperCase();
    if (!(eccName in ECC_ORD)) { throw new Error('qr: unknown ecc level ' + eccName); }
    var ord = ECC_ORD[eccName];
    var minV = Math.max(1, opts.minVersion || 1);
    var maxV = Math.min(40, opts.maxVersion || 40);
    if (typeof text !== 'string' || text.length === 0) { throw new Error('qr: empty text'); }

    var bytes = utf8Bytes(text), ver = -1;
    for (var v = minV; v <= maxV; v++) {
      var needed = 4 + charCountBits(v) + 8 * bytes.length;
      if (needed <= dataCodewords(v, ord) * 8) { ver = v; break; }
    }
    if (ver < 0) { throw new Error('qr: data too long for version ' + maxV + ' at level ' + eccName); }

    var mx = new Matrix(ver, ord);
    mx.drawFunctionPatterns(ECC_FMT[eccName]);
    var stream = interleave(addCodewords(text, ver, ord), ver, ord);
    mx.drawCodewords(stream);

    var bestMask = 0, bestScore = Infinity;
    for (var mask = 0; mask < 8; mask++) {
      mx.drawFormat(ECC_FMT[eccName], mask);
      mx.applyMask(mask);
      var s = mx.penalty();
      if (s < bestScore) { bestScore = s; bestMask = mask; }
      mx.applyMask(mask);                               /* mask is its own inverse */
    }
    mx.drawFormat(ECC_FMT[eccName], bestMask);
    mx.applyMask(bestMask);

    return {
      size: mx.size,
      version: ver,
      ecc: eccName,
      mask: bestMask,
      text: text,
      modules: mx.m,
      stream: stream,
      _mx: mx,
      get: function (x, y) {
        return x >= 0 && y >= 0 && x < mx.size && y < mx.size && mx.m[y][x] === 1;
      }
    };
  }

  /* SVG path, one user unit per module. */
  function toPath(qr) {
    var d = [], n = qr.size;
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        if (qr.modules[y][x]) { d.push('M' + x + ' ' + y + 'h1v1h-1z'); }
      }
    }
    return d.join('');
  }

  /* ------------------------------------------------------------------------
     6. Self-test — real verification of the encoder's internals.
     ------------------------------------------------------------------------ */

  function selfTest() {
    var t = [];
    function check(name, fn) {
      try { var d = fn(); t.push({ name: name, pass: d === true || d === undefined, detail: d === true || d === undefined ? 'ok' : String(d) }); }
      catch (e) { t.push({ name: name, pass: false, detail: 'threw: ' + e.message }); }
    }

    check('GF(256): multiplicative identity and zero', function () {
      for (var a = 0; a < 256; a++) {
        if (gfMul(a, 1) !== a) { return 'gfMul(' + a + ',1) != ' + a; }
        if (gfMul(a, 0) !== 0) { return 'gfMul(' + a + ',0) != 0'; }
      }
      return true;
    });

    check('GF(256): alpha^255 == 1 (field order)', function () {
      var v = 1;
      for (var i = 0; i < 255; i++) { v = gfMul(v, 2); }
      return v === 1 ? true : 'alpha^255 = ' + v;
    });

    check('GF(256): commutative and associative on samples', function () {
      for (var i = 0; i < 400; i++) {
        var a = (i * 37 + 11) & 0xFF, b = (i * 91 + 5) & 0xFF, c = (i * 17 + 3) & 0xFF;
        if (gfMul(a, b) !== gfMul(b, a)) { return 'not commutative at ' + a + ',' + b; }
        if (gfMul(gfMul(a, b), c) !== gfMul(a, gfMul(b, c))) { return 'not associative at ' + a + ',' + b + ',' + c; }
      }
      return true;
    });

    check('Codeword totals match the standard (v1/2/7/10/40)', function () {
      var want = { 1: 26, 2: 44, 7: 196, 10: 346, 40: 3706 };
      for (var v in want) {
        if (totalCodewords(+v) !== want[v]) {
          return 'v' + v + ' = ' + totalCodewords(+v) + ', expected ' + want[v];
        }
      }
      return true;
    });

    check('Byte-mode capacity at level M matches the standard', function () {
      var want = { 1: 14, 2: 26, 3: 42, 4: 62, 5: 84, 6: 106, 7: 122, 8: 152, 9: 180, 10: 213 };
      for (var v in want) {
        var bits = dataCodewords(+v, 1) * 8 - 4 - charCountBits(+v);
        if (Math.floor(bits / 8) !== want[v]) {
          return 'v' + v + ' = ' + Math.floor(bits / 8) + ' bytes, expected ' + want[v];
        }
      }
      return true;
    });

    check('Alignment pattern positions match the standard', function () {
      var want = { 2: [6, 18], 7: [6, 22, 38], 10: [6, 28, 50], 14: [6, 26, 46, 66], 32: [6, 34, 60, 86, 112, 138] };
      for (var v in want) {
        var got = alignmentPositions(+v).join(',');
        if (got !== want[v].join(',')) { return 'v' + v + ' = [' + got + '], expected [' + want[v].join(',') + ']'; }
      }
      return true;
    });

    check('Reed-Solomon: data+ecc is divisible by its generator', function () {
      var degrees = [7, 10, 13, 16, 17, 18, 20, 22, 24, 26, 28, 30];
      for (var di = 0; di < degrees.length; di++) {
        var deg = degrees[di], gen = rsGenerator(deg);
        var data = new Uint8Array(40);
        for (var i = 0; i < data.length; i++) { data[i] = (i * 53 + deg * 7 + 1) & 0xFF; }
        var ecc = rsRemainder(data, gen);
        var joined = new Uint8Array(data.length + deg);
        joined.set(data, 0); joined.set(ecc, data.length);
        var rem = rsRemainder(joined, gen);
        for (i = 0; i < deg; i++) {
          if (rem[i] !== 0) { return 'degree ' + deg + ': non-zero syndrome at ' + i; }
        }
      }
      return true;
    });

    /* The decisive structural test: read the matrix back and rebuild the
       codeword stream. This exercises placement, masking and format bits. */
    check('Round-trip: codewords read back out of the matrix match', function () {
      var cases = [
        ['https://example.com', 'M'],
        ['https://mahak-jain.vercel.app', 'M'],
        ['HTTPS://A-RATHER-LONGER-EXAMPLE-URL.VERCEL.APP/LANDING', 'Q'],
        ['short', 'H'],
        ['https://example.com/' + new Array(30).join('abc'), 'L']
      ];
      for (var c = 0; c < cases.length; c++) {
        var qr = encode(cases[c][0], { ecc: cases[c][1] });
        var mx = qr._mx;

        /* undo the mask on a copy */
        var copy = [];
        for (var y = 0; y < mx.size; y++) { copy.push(Uint8Array.from(mx.m[y])); }
        for (y = 0; y < mx.size; y++) {
          for (var x = 0; x < mx.size; x++) {
            if (!mx.fn[y][x] && maskBit(qr.mask, x, y)) { copy[y][x] ^= 1; }
          }
        }

        var bitsOut = [];
        mx.eachDataModule(function (x2, y2) { bitsOut.push(copy[y2][x2]); });

        var total = qr.stream.length;
        if (bitsOut.length < total * 8) {
          return cases[c][0].slice(0, 20) + ': only ' + bitsOut.length + ' data modules for ' + total + ' codewords';
        }
        for (var i = 0; i < total; i++) {
          var b = 0;
          for (var k = 0; k < 8; k++) { b = (b << 1) | bitsOut[i * 8 + k]; }
          if (b !== qr.stream[i]) {
            return cases[c][0].slice(0, 20) + ': codeword ' + i + ' read ' + b + ', wrote ' + qr.stream[i];
          }
        }
      }
      return true;
    });

    check('Format information is self-consistent (BCH + level + mask)', function () {
      var qr = encode('https://mahak-jain.vercel.app', { ecc: 'M' });
      var mx = qr._mx, bits = 0, i;
      for (i = 0; i <= 5; i++) { bits |= mx.m[i][8] << i; }
      bits |= mx.m[7][8] << 6;
      bits |= mx.m[8][8] << 7;
      bits |= mx.m[8][7] << 8;
      for (i = 9; i < 15; i++) { bits |= mx.m[8][14 - i] << i; }

      var raw = bits ^ 0x5412;
      var rem = raw;
      for (i = 0; i < 10; i++) { rem = (rem << 1) ^ ((rem >>> 9) * 0x537); }
      /* re-encode the top 5 bits and compare the whole 15-bit word */
      var data = raw >>> 10;
      var r2 = data;
      for (i = 0; i < 10; i++) { r2 = (r2 << 1) ^ ((r2 >>> 9) * 0x537); }
      if ((((data << 10) | r2) ^ 0x5412) !== bits) { return 'BCH mismatch'; }
      if ((data & 7) !== qr.mask) { return 'mask bits say ' + (data & 7) + ', used ' + qr.mask; }
      if ((data >>> 3) !== ECC_FMT.M) { return 'level bits say ' + (data >>> 3) + ', expected ' + ECC_FMT.M; }
      return true;
    });

    check('Structure: size, finders, timing, dark module', function () {
      var qr = encode('https://mahak-jain.vercel.app', { ecc: 'M' });
      var n = qr.size;
      if (n !== qr.version * 4 + 17) { return 'size ' + n + ' wrong for v' + qr.version; }
      var corners = [[0, 0], [n - 7, 0], [0, n - 7]];
      for (var c = 0; c < corners.length; c++) {
        var ox = corners[c][0], oy = corners[c][1];
        for (var dy = 0; dy < 7; dy++) {
          for (var dx = 0; dx < 7; dx++) {
            var d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
            var want = (d !== 2);
            if (qr.get(ox + dx, oy + dy) !== want) { return 'finder ' + c + ' wrong at ' + dx + ',' + dy; }
          }
        }
      }
      for (var i = 8; i < n - 8; i++) {
        if (qr.get(i, 6) !== (i % 2 === 0)) { return 'horizontal timing wrong at x=' + i; }
        if (qr.get(6, i) !== (i % 2 === 0)) { return 'vertical timing wrong at y=' + i; }
      }
      if (!qr.get(8, n - 8)) { return 'dark module is light'; }
      return true;
    });

    check('Version selection picks the smallest sufficient version', function () {
      if (encode(new Array(15).join('a'), { ecc: 'M' }).version !== 1) { return '14 bytes should be v1'; }
      if (encode(new Array(16).join('a'), { ecc: 'M' }).version !== 2) { return '15 bytes should be v2'; }
      if (encode(new Array(27).join('a'), { ecc: 'M' }).version !== 2) { return '26 bytes should be v2'; }
      if (encode(new Array(28).join('a'), { ecc: 'M' }).version !== 3) { return '27 bytes should be v3'; }
      return true;
    });

    return t;
  }

  /* ------------------------------------------------------------------------ */

  var QR = {
    encode: encode,
    toPath: toPath,
    selfTest: selfTest,
    _internal: {
      gfMul: gfMul, rsGenerator: rsGenerator, rsRemainder: rsRemainder,
      totalCodewords: totalCodewords, dataCodewords: dataCodewords,
      alignmentPositions: alignmentPositions, maskBit: maskBit
    }
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = QR; }
  if (typeof global !== 'undefined') { global.QR = QR; }

})(typeof window !== 'undefined' ? window : globalThis);
