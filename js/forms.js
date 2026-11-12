/* Forms — procedural point clouds for the stipple swarm.
   Every generator returns a Float32Array of n * 3 coordinates that fit
   roughly inside a unit sphere. Shading is done the way an engraver would
   do it: more dots where the surface turns away from the light. */
(function () {
  'use strict';

  var TAU = Math.PI * 2;

  // ---- small maths -------------------------------------------------------
  function mulberry(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function norm(v) {
    var l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function rotX(p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; }
  function rotY(p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; }
  function rotZ(p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; }
  function randDir(r) {
    var z = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - z * z);
    return [s * Math.cos(a), s * Math.sin(a), z];
  }
  function smooth(a, b, x) {
    var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  // ---- point container ---------------------------------------------------
  function Cloud(n, seed) {
    this.n = n;
    this.i = 0;
    this.a = new Float32Array(n * 3);
    this.r = mulberry(seed);
  }
  Cloud.prototype.push = function (p) {
    if (this.i >= this.n) return false;
    var k = this.i * 3;
    this.a[k] = p[0]; this.a[k + 1] = p[1]; this.a[k + 2] = p[2];
    this.i++;
    return true;
  };
  Cloud.prototype.left = function () { return this.n - this.i; };
  // pad with copies of existing points, then shuffle so that particle
  // indices carry no structure (keeps morphs from moving in bands)
  Cloud.prototype.done = function () {
    var a = this.a, n = this.n, r = this.r, i, j, k, t;
    var filled = Math.max(1, this.i);
    for (i = this.i; i < n; i++) {
      j = Math.floor(r() * filled) * 3;
      a[i * 3] = a[j]; a[i * 3 + 1] = a[j + 1]; a[i * 3 + 2] = a[j + 2];
    }
    for (i = n - 1; i > 0; i--) {
      j = Math.floor(r() * (i + 1));
      for (k = 0; k < 3; k++) { t = a[i * 3 + k]; a[i * 3 + k] = a[j * 3 + k]; a[j * 3 + k] = t; }
    }
    return a;
  };

  // sphere whose dot density follows the shadow
  function shadedSphere(c, center, rad, count, L, gamma, floor) {
    var r = c.r, made = 0, guard = count * 60;
    gamma = gamma || 1.7; floor = floor == null ? 0.05 : floor;
    while (made < count && guard-- > 0) {
      var d = randDir(r);
      if (d[2] < -0.22) continue;                       // the far side stays empty
      var b = Math.max(0, dot(d, L));
      if (r() < floor + (1 - floor) * Math.pow(1 - b, gamma)) {
        if (!c.push([center[0] + d[0] * rad, center[1] + d[1] * rad, center[2] + d[2] * rad])) return;
        made++;
      }
    }
  }
  function line(c, a, b, count, jitter) {
    var r = c.r;
    jitter = jitter || 0;
    for (var i = 0; i < count; i++) {
      var t = r();
      c.push([
        a[0] + (b[0] - a[0]) * t + (r() - 0.5) * jitter,
        a[1] + (b[1] - a[1]) * t + (r() - 0.5) * jitter,
        a[2] + (b[2] - a[2]) * t + (r() - 0.5) * jitter
      ]);
    }
  }

  // ---- Fig. 0 — orrery ---------------------------------------------------
  function orrery(n) {
    var c = new Cloud(n, 11), r = c.r;
    var L = norm([-0.62, 0.5, 0.6]);
    var tilt = function (p) { return rotZ(rotX(p, 1.12), -0.26); };
    var i, a, R, j;

    shadedSphere(c, [0, 0, 0], 0.4, Math.floor(n * 0.38), L, 1.8, 0.04);

    var rings = [0.66, 0.96, 1.26];
    var perRing = [0.07, 0.085, 0.1];
    rings.forEach(function (rad, k) {
      var count = Math.floor(n * perRing[k]);
      for (i = 0; i < count; i++) {
        a = r() * TAU; j = (r() - 0.5) * 0.007;
        c.push(tilt([(rad + j) * Math.cos(a), (r() - 0.5) * 0.007, (rad + j) * Math.sin(a)]));
      }
    });

    // bodies riding the rings
    [[0.66, 0.85, 0.05], [0.96, 3.75, 0.088], [1.26, 5.45, 0.064]].forEach(function (pl) {
      var centre = tilt([pl[0] * Math.cos(pl[1]), 0, pl[0] * Math.sin(pl[1])]);
      shadedSphere(c, centre, pl[2], Math.floor(n * 0.055), L, 1.5, 0.12);
    });

    // graduation ticks on the outer ring, like an astrolabe
    var ticks = 72, perTick = Math.floor((n * 0.085) / ticks);
    for (i = 0; i < ticks; i++) {
      a = (i / ticks) * TAU;
      var len = i % 6 === 0 ? 0.085 : 0.04;
      for (j = 0; j < perTick; j++) {
        R = 1.3 + r() * len;
        c.push(tilt([R * Math.cos(a), 0, R * Math.sin(a)]));
      }
    }

    // the axis the whole thing turns on
    line(c, tilt([0, 0.43, 0]), tilt([0, 0.66, 0]), Math.floor(n * 0.01), 0.004);
    line(c, tilt([0, -0.43, 0]), tilt([0, -0.66, 0]), Math.floor(n * 0.01), 0.004);

    // stray specks
    while (c.left() > 0) {
      var d = randDir(r), rr = 0.5 + r() * 1.1;
      c.push([d[0] * rr, d[1] * rr * 0.7, d[2] * rr]);
    }
    return c.done();
  }

  // ---- Fig. 1 — ocean surface with sample pins ---------------------------
  function wave(n) {
    var c = new Cloud(n, 23), r = c.r;
    var L = norm([-0.9, 0.36, 0.22]);
    var rows = 34, x, z, e = 0.01;
    var h = function (px, pz) {
      return 0.15 * Math.sin(2.1 * px + 1.2 * pz) +
        0.085 * Math.sin(4.3 * px - 2.4 * pz + 1.7) +
        0.04 * Math.sin(8.1 * px + 4.3 * pz + 0.6);
    };
    var tilt = function (p) { return rotX(p, 0.52); };
    var target = Math.floor(n * 0.9), guard = n * 60;
    while (c.i < target && guard-- > 0) {
      z = -1 + 2 * (Math.floor(r() * rows) / (rows - 1));
      x = (r() * 2 - 1) * 1.6;
      var dx = (h(x + e, z) - h(x - e, z)) / (2 * e);
      var dz = (h(x, z + e) - h(x, z - e)) / (2 * e);
      var b = Math.max(0, dot(norm([-dx, 1, -dz]), L));
      var fade = 1 - smooth(1.25, 1.6, Math.abs(x));
      if (r() < (0.07 + 0.93 * (1 - smooth(0.1, 0.6, b))) * fade) {
        c.push(tilt([x, h(x, z) - 0.05, z]));
      }
    }
    // sample pins: where the model was asked for a reading
    var pins = [[-1.05, -0.5, 0.34], [-0.42, 0.35, 0.5], [0.1, -0.62, 0.26], [0.55, 0.1, 0.62], [1.05, -0.25, 0.4], [-0.75, 0.7, 0.22], [0.9, 0.72, 0.3]];
    var per = Math.floor(c.left() / pins.length);
    pins.forEach(function (p) {
      var base = h(p[0], p[1]) - 0.05, i;
      for (i = 0; i < per * 0.55; i++) c.push(tilt([p[0], base + r() * p[2], p[1]]));
      for (i = 0; i < per * 0.45; i++) {
        var d = randDir(r), rr = 0.028;
        c.push(tilt([p[0] + d[0] * rr, base + p[2] + d[1] * rr, p[1] + d[2] * rr]));
      }
    });
    return c.done();
  }

  // ---- Fig. 2 — two strands, joined ---------------------------------------
  function helix(n) {
    var c = new Cloud(n, 31), r = c.r;
    var H = 1.18, R = 0.44, K = 3.9, i, y, th, d;
    var strand = Math.floor(n * 0.28);
    for (var s = 0; s < 2; s++) {
      for (i = 0; i < strand; i++) {
        y = (r() * 2 - 1) * H; th = y * K + s * Math.PI; d = randDir(r);
        c.push([R * Math.cos(th) + d[0] * 0.03, y + d[1] * 0.03, R * Math.sin(th) + d[2] * 0.03]);
      }
    }
    var rungs = 19, per = Math.floor((n * 0.24) / rungs), nodes = Math.floor((n * 0.2) / (rungs * 2));
    for (var k = 0; k < rungs; k++) {
      y = -H + (2 * H) * ((k + 0.5) / rungs); th = y * K;
      var A = [R * Math.cos(th), y, R * Math.sin(th)];
      var B = [-A[0], y, -A[2]];
      line(c, A, B, per, 0.008);
      for (i = 0; i < nodes; i++) {
        d = randDir(r); c.push([A[0] + d[0] * 0.052, A[1] + d[1] * 0.052, A[2] + d[2] * 0.052]);
        d = randDir(r); c.push([B[0] + d[0] * 0.052, B[1] + d[1] * 0.052, B[2] + d[2] * 0.052]);
      }
    }
    return c.done();
  }

  // ---- Fig. 3 — the Moon, shaded relief -----------------------------------
  function moon(n) {
    var c = new Cloud(n, 47), r = c.r;
    var L = norm([-0.66, 0.4, 0.64]);
    var craters = [], i;
    // a few named-size basins first, then the small stuff
    var sizes = [0.34, 0.27, 0.23, 0.2, 0.17, 0.15];
    while (craters.length < 40) {
      var cd = randDir(r);
      if (cd[2] < 0.05) continue;                       // near side only
      var k = craters.length;
      craters.push({ c: cd, r: k < sizes.length ? sizes[k] : 0.04 + Math.pow(r(), 2.2) * 0.1 });
    }
    var k1 = randDir(r), k2 = randDir(r);

    // limb: the outline an engraver would ink first
    var limb = Math.floor(n * 0.05);
    for (i = 0; i < limb; i++) {
      var a = r() * TAU, rr = 0.96 + (r() - 0.5) * 0.008;
      c.push([Math.cos(a) * rr, Math.sin(a) * rr, 0]);
    }

    var guard = n * 90;
    while (c.i < n && guard-- > 0) {
      var p = randDir(r);
      if (p[2] < -0.12) continue;
      var px = 0, py = 0, pz = 0;
      for (i = 0; i < craters.length; i++) {
        var cr = craters[i], cs = dot(p, cr.c);
        if (cs < 0.55) continue;
        var u = Math.acos(Math.min(1, cs)) / cr.r;
        if (u > 1.28) continue;
        var t = norm([p[0] * cs - cr.c[0], p[1] * cs - cr.c[1], p[2] * cs - cr.c[2]]);
        // bowl floor is flat, walls are steep, the rim falls away outside
        var slope = u < 0.55 ? -0.3 * u : u < 0.95 ? -2.6 * (u - 0.42) : 1.9 * (1 - (u - 0.95) / 0.33);
        px += t[0] * slope; py += t[1] * slope; pz += t[2] * slope;
      }
      var nn = norm([p[0] + px, p[1] + py, p[2] + pz]);
      var mare = 0.5 + 0.5 * Math.sin(dot(p, k1) * 2.9 + 1.0) * Math.sin(dot(p, k2) * 2.2 + 2.0);
      var albedo = 1 - 0.38 * smooth(0.52, 0.8, mare);
      var b = Math.min(1, Math.max(0, dot(nn, L)) * 1.15) * albedo;
      if (r() < 0.01 + 0.62 * Math.pow(1 - b, 1.7)) c.push([p[0] * 0.96, p[1] * 0.96, p[2] * 0.96]);
    }
    return c.done();
  }

  // ---- Fig. 4 — a stack of documents, indexed -----------------------------
  function pages(n) {
    var c = new Cloud(n, 59), r = c.r;
    var W = 1.02, H = 1.42, sheets = 6, i, k;
    var share = [0.46, 0.14, 0.12, 0.1, 0.09, 0.09];
    for (var s = 0; s < sheets; s++) {
      var ox = s * 0.085 - 0.21, oy = s * 0.052 - 0.13, oz = 0.28 - s * 0.115, rot = s * 0.034;
      var put = function (x, y) { var p = rotZ([x, y, 0], rot); c.push([p[0] + ox, p[1] + oy, oz]); };
      var count = Math.floor(n * share[s]);
      var edge = Math.floor(count * (s === 0 ? 0.3 : 0.8));
      for (i = 0; i < edge; i++) {
        var t = r() * 2 * (W + H);
        if (t < W) put(-W / 2 + t, H / 2);
        else if (t < W + H) put(W / 2, H / 2 - (t - W));
        else if (t < 2 * W + H) put(W / 2 - (t - W - H), -H / 2);
        else put(-W / 2, -H / 2 + (t - 2 * W - H));
      }
      var rest = count - edge;
      if (s === 0) {
        // heading, a stamped index number, then ragged lines of text
        var lens = [0.42, 0.78, 0.7, 0.74, 0.5, 0, 0.76, 0.66, 0.72, 0.3, 0, 0.74, 0.58];
        var total = 0; lens.forEach(function (l) { total += l; });
        var head = Math.floor(rest * 0.16), stamp = Math.floor(rest * 0.12), body = rest - head - stamp;
        for (i = 0; i < head; i++) put(-W / 2 + 0.11 + r() * 0.46, H / 2 - 0.15 - r() * 0.05);
        for (i = 0; i < stamp; i++) put(W / 2 - 0.25 + r() * 0.14, H / 2 - 0.11 - r() * 0.14);
        for (k = 0; k < lens.length; k++) {
          var m = Math.floor(body * (lens[k] / total));
          for (i = 0; i < m; i++) put(-W / 2 + 0.11 + r() * lens[k], H / 2 - 0.36 - k * 0.078 + (r() - 0.5) * 0.008);
        }
      } else {
        for (i = 0; i < rest; i++) put(-W / 2 + 0.11 + r() * (0.3 + 0.4 * ((s * 7) % 3) / 2), H / 2 - 0.045);
      }
    }
    return c.done();
  }

  // ---- pen-tool curve on an artboard --------------------------------------
  function bezier(n) {
    var c = new Cloud(n, 67), r = c.r, i, t;
    var P = [[-1.15, -0.42], [-0.3, -1.2], [0.3, 1.2], [1.15, 0.42]];
    var at = function (u) {
      var v = 1 - u;
      return [
        v * v * v * P[0][0] + 3 * v * v * u * P[1][0] + 3 * v * u * u * P[2][0] + u * u * u * P[3][0],
        v * v * v * P[0][1] + 3 * v * v * u * P[1][1] + 3 * v * u * u * P[2][1] + u * u * u * P[3][1]
      ];
    };
    var curve = Math.floor(n * 0.44);
    for (i = 0; i < curve; i++) {
      var q = at(r()), d = randDir(r);
      c.push([q[0] + d[0] * 0.022, q[1] + d[1] * 0.022, 0.14 + d[2] * 0.022]);
    }
    // handles
    line(c, [P[0][0], P[0][1], 0.14], [P[1][0], P[1][1], 0.14], Math.floor(n * 0.045), 0.004);
    line(c, [P[3][0], P[3][1], 0.14], [P[2][0], P[2][1], 0.14], Math.floor(n * 0.045), 0.004);
    var knob = Math.floor(n * 0.035);
    [P[1], P[2]].forEach(function (h) {
      for (i = 0; i < knob; i++) { t = r() * TAU; c.push([h[0] + Math.cos(t) * 0.05, h[1] + Math.sin(t) * 0.05, 0.14]); }
    });
    [P[0], P[3]].forEach(function (h) {
      for (i = 0; i < knob; i++) {
        t = r() * 4; var s = 0.055, e = (t % 1) * 2 * s - s;
        var xy = t < 1 ? [e, s] : t < 2 ? [s, e] : t < 3 ? [e, -s] : [-s, e];
        c.push([h[0] + xy[0], h[1] + xy[1], 0.14]);
      }
    });
    // artboard frame + dot grid behind
    var fw = 1.42, fh = 0.98, frame = Math.floor(n * 0.08);
    for (i = 0; i < frame; i++) {
      t = r() * 2 * (2 * fw + 2 * fh);
      var x, y;
      if (t < 2 * fw) { x = -fw + t; y = fh; }
      else if (t < 2 * fw + 2 * fh) { x = fw; y = fh - (t - 2 * fw); }
      else if (t < 4 * fw + 2 * fh) { x = fw - (t - 2 * fw - 2 * fh); y = -fh; }
      else { x = -fw; y = -fh + (t - 4 * fw - 2 * fh); }
      c.push([x, y, -0.3]);
    }
    while (c.left() > 0) {
      var gx = Math.round((r() * 2 - 1) * 8) / 8 * 1.3, gy = Math.round((r() * 2 - 1) * 5) / 5 * 0.86;
      c.push([gx + (r() - 0.5) * 0.012, gy + (r() - 0.5) * 0.012, -0.3]);
    }
    return c.done();
  }

  // ---- loose dust ----------------------------------------------------------
  function dust(n) {
    var c = new Cloud(n, 71), r = c.r;
    while (c.left() > 0) c.push([(r() * 2 - 1) * 2.6, (r() * 2 - 1) * 1.5, (r() * 2 - 1) * 1.3]);
    return c.done();
  }

  // ---- extruded lettering --------------------------------------------------
  function glyph(text, n, font) {
    var c = new Cloud(n, 83), r = c.r, S = 360;
    var cv = document.createElement('canvas'); cv.width = S * 2; cv.height = S;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S * 2, S);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '600 ' + Math.floor(S * 0.72) + 'px ' + (font || 'sans-serif');
    var m = ctx.measureText(text);
    var asc = m.actualBoundingBoxAscent || S * 0.5, desc = m.actualBoundingBoxDescent || 0;
    ctx.fillText(text, S, S / 2 + (asc - desc) / 2);
    var px = ctx.getImageData(0, 0, S * 2, S).data, w = S * 2;
    var inside = [], edge = [], x, y, minX = w, maxX = 0, minY = S, maxY = 0;
    var on = function (ix, iy) { return ix >= 0 && iy >= 0 && ix < w && iy < S && px[(iy * w + ix) * 4] > 127; };
    for (y = 0; y < S; y++) for (x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      inside.push(x, y);
      if (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1)) edge.push(x, y);
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (!inside.length) return dust(n);
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    var sc = 2.1 / Math.max(maxX - minX, (maxY - minY) * 1.25), depth = 0.3;
    var pick = function (arr, zf) {
      var k = Math.floor(r() * (arr.length / 2)) * 2;
      c.push([(arr[k] + r() - 0.5 - cx) * sc, -(arr[k + 1] + r() - 0.5 - cy) * sc, zf()]);
    };
    var front = Math.floor(n * 0.3), back = Math.floor(n * 0.12), i;
    for (i = 0; i < front; i++) pick(inside, function () { return depth / 2; });
    for (i = 0; i < back; i++) pick(inside, function () { return -depth / 2; });
    while (c.left() > 0) pick(edge, function () { return (r() - 0.5) * depth; });
    return c.done();
  }

  // ---- a portrait, light picked out of the dark ---------------------------
  // crop = [x, y, w, h] as fractions of the source image
  function portrait(img, n, crop) {
    crop = crop || [0, 0, 1, 1];
    var sw = img.naturalWidth * crop[2], sh = img.naturalHeight * crop[3];
    var H = 300, W = Math.round(H * sw / sh);
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, img.naturalWidth * crop[0], img.naturalHeight * crop[1], sw, sh, 0, 0, W, H);
    var px = ctx.getImageData(0, 0, W, H).data;       // throws on file:// — caller falls back
    var c = new Cloud(n, 97), r = c.r, guard = n * 400;
    var sc = 2.1 / H;
    while (c.i < n && guard-- > 0) {
      var x = r() * W, y = r() * H, k = ((y | 0) * W + (x | 0)) * 4;
      var lum = (px[k] * 0.3 + px[k + 1] * 0.59 + px[k + 2] * 0.11) / 255;
      if (r() < Math.pow(lum, 1.35) * 1.15) {
        c.push([(x - W / 2) * sc, -(y - H / 2) * sc, (lum - 0.4) * 0.34]);
      }
    }
    return c.done();
  }

  window.USForms = {
    orrery: orrery, wave: wave, helix: helix, moon: moon, pages: pages,
    bezier: bezier, dust: dust, glyph: glyph, portrait: portrait
  };
})();
