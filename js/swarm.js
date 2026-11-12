/* Swarm — one draw call of ink dots that morphs between forms.
   Plain WebGL, no library. Forms come from forms.js; where the swarm sits
   and what it becomes is described by "keys" that main.js reads off the
   page (data-swarm attributes) and scrubs with the scroll position. */
(function () {
  'use strict';

  var VERT = [
    'precision highp float;',
    'attribute vec3 aA;',
    'attribute vec3 aB;',
    'attribute vec4 aRnd;',
    'uniform float uMix, uTime, uIntro, uScale, uSize, uCamZ, uAlpha, uForce, uRadius, uCalm;',
    'uniform mat3 uRot;',
    'uniform mat4 uProj;',
    'uniform vec2 uOffset, uMouse;',
    'varying float vAlpha;',
    'varying float vSpot;',
    'void main(){',
    '  float stag = 0.55;',
    '  float m = clamp(uMix * (1.0 + stag) - aRnd.x * stag, 0.0, 1.0);',
    '  m = m * m * (3.0 - 2.0 * m);',
    '  vec3 dir = normalize(aRnd.xyz * 2.0 - 1.0 + 0.0001);',
    '  vec3 p = mix(aA, aB, m);',
    // dots leave the surface, arc, and land again
    '  p += dir * sin(m * 3.14159265) * (0.18 + 0.5 * aRnd.w) * uCalm;',
    // breathing
    '  p += 0.011 * uCalm * vec3(sin(uTime * 0.7 + aRnd.x * 40.0), cos(uTime * 0.6 + aRnd.y * 40.0), sin(uTime * 0.5 + aRnd.z * 40.0));',
    // arrival: dust settling into the first form
    '  float it = clamp(uIntro * 1.6 - aRnd.y * 0.6, 0.0, 1.0);',
    '  it = 1.0 - pow(1.0 - it, 3.0);',
    '  p += dir * (1.6 + 3.2 * aRnd.w) * (1.0 - it);',
    '  vec3 w = uRot * p * uScale;',
    '  w.xy += uOffset;',
    // the pointer parts the dots
    '  vec2 d = w.xy - uMouse;',
    '  float f = smoothstep(uRadius, 0.0, length(d)) * uForce;',
    '  w.xy += normalize(d + 0.0001) * f * 0.34;',
    '  w.z += f * (aRnd.z - 0.5) * 0.9;',
    '  vec4 mv = vec4(w.xy, w.z - uCamZ, 1.0);',
    '  gl_Position = uProj * mv;',
    '  gl_PointSize = uSize * (0.5 + aRnd.y * 0.95) * (uCamZ / -mv.z);',
    '  vSpot = step(0.962, aRnd.w);',
    '  vAlpha = uAlpha * it * mix(1.0, 0.5, smoothstep(0.0, 1.6, -w.z));',
    '}'
  ].join('\n');

  var FRAG = [
    'precision mediump float;',
    'uniform vec3 uInk, uSpot;',
    'varying float vAlpha;',
    'varying float vSpot;',
    'void main(){',
    '  float d = length(gl_PointCoord - 0.5);',
    '  float a = smoothstep(0.5, 0.34, d) * vAlpha;',
    '  gl_FragColor = vec4(mix(uInk, uSpot, vSpot) * a, a);',
    '}'
  ].join('\n');

  var DEFAULTS = { x: 0, y: 0, size: 0.7, yaw: 0, pitch: 0, tilt: 0, spin: 0, sway: 0.2, alpha: 1, dot: 1 };
  var NUM = ['x', 'y', 'size', 'yaw', 'pitch', 'tilt', 'spin', 'sway', 'alpha', 'dot'];

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function Swarm(canvas, opts) {
    opts = opts || {};
    this.canvas = canvas;
    var gl = this.gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL unavailable');

    this.count = opts.count || 26000;
    this.fov = 34 * Math.PI / 180;
    this.camZ = 6;
    this.forms = {};
    this.keys = [];
    this.t = 0; this.tTarget = 0;
    this.intro = 0;
    this.calm = 1;
    this.spinAngle = 0;
    this.ink = [0.07, 0.066, 0.058]; this.inkTarget = this.ink.slice();
    this.spot = opts.spot || [1, 0.29, 0.11];
    this.pointer = { x: 0, y: 0, sx: 0, sy: 0, force: 0, inside: false };
    this.narrow = false;
    this.lost = false;

    var prog = this.prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    var self = this;
    this.loc = {};
    ['aA', 'aB', 'aRnd'].forEach(function (n) { self.loc[n] = gl.getAttribLocation(prog, n); });
    ['uMix', 'uTime', 'uIntro', 'uScale', 'uSize', 'uCamZ', 'uAlpha', 'uForce', 'uRadius', 'uCalm', 'uRot', 'uProj', 'uOffset', 'uMouse', 'uInk', 'uSpot']
      .forEach(function (n) { self.loc[n] = gl.getUniformLocation(prog, n); });

    var rnd = new Float32Array(this.count * 4);
    for (var i = 0; i < rnd.length; i++) rnd[i] = Math.random();
    this.rndBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rndBuf);
    gl.bufferData(gl.ARRAY_BUFFER, rnd, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.loc.aRnd);
    gl.vertexAttribPointer(this.loc.aRnd, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.loc.aA);
    gl.enableVertexAttribArray(this.loc.aB);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); self.lost = true; });

    this.onMove = function (e) {
      var p = self.pointer;
      var nx = (e.clientX / window.innerWidth) * 2 - 1, ny = -((e.clientY / window.innerHeight) * 2 - 1);
      var sp = Math.hypot(nx - p.x, ny - p.y);
      p.x = nx; p.y = ny; p.inside = true;
      p.force = Math.min(1, p.force + sp * 3.5);
    };
    window.addEventListener('pointermove', this.onMove, { passive: true });
    document.addEventListener('pointerleave', function () { self.pointer.inside = false; });

    this.resize();
  }

  Swarm.prototype.addForm = function (name, data) {
    var gl = this.gl;
    if (data.length !== this.count * 3) {
      // resample to the swarm's particle count
      var fixed = new Float32Array(this.count * 3), m = data.length / 3;
      for (var i = 0; i < this.count; i++) {
        var j = (i % m) * 3;
        fixed[i * 3] = data[j]; fixed[i * 3 + 1] = data[j + 1]; fixed[i * 3 + 2] = data[j + 2];
      }
      data = fixed;
    }
    var buf = (this.forms[name] && this.forms[name]) || gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    this.forms[name] = buf;
  };

  Swarm.prototype.setKeys = function (keys) {
    this.rawKeys = keys;
    this.applyKeys();
  };

  Swarm.prototype.applyKeys = function () {
    var narrow = this.narrow;
    this.keys = (this.rawKeys || []).map(function (k) {
      var out = {}, n;
      for (n in DEFAULTS) out[n] = DEFAULTS[n];
      for (n in k) if (n !== 'm') out[n] = k[n];
      if (narrow && k.m) for (n in k.m) out[n] = k.m[n];
      return out;
    });
  };

  Swarm.prototype.setInk = function (rgb, instant) {
    this.inkTarget = rgb.slice();
    if (instant) this.ink = rgb.slice();
  };

  Swarm.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.dpr = dpr; this.w = w; this.h = h;
    this.aspect = w / h;
    this.hh = this.camZ * Math.tan(this.fov / 2);       // half the visible height at z = 0
    var wasNarrow = this.narrow;
    this.narrow = w < 820;
    if (wasNarrow !== this.narrow) this.applyKeys();
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    var f = 1 / Math.tan(this.fov / 2), near = 0.1, far = 60;
    this.proj = new Float32Array([
      f / this.aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) / (near - far), -1,
      0, 0, (2 * far * near) / (near - far), 0
    ]);
  };

  function rotation(yaw, pitch, tilt) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(pitch), sx = Math.sin(pitch), cz = Math.cos(tilt), sz = Math.sin(tilt);
    // R = Rz(tilt) * Rx(pitch) * Ry(yaw), column-major
    var a = [cy, 0, -sy, 0, 1, 0, sy, 0, cy];
    var b = [1, 0, 0, 0, cx, sx, 0, -sx, cx];
    var c = [cz, sz, 0, -sz, cz, 0, 0, 0, 1];
    return mul(c, mul(b, a));
  }
  function mul(a, b) {
    var o = new Float32Array(9);
    for (var col = 0; col < 3; col++) for (var row = 0; row < 3; row++) {
      o[col * 3 + row] = a[row] * b[col * 3] + a[3 + row] * b[col * 3 + 1] + a[6 + row] * b[col * 3 + 2];
    }
    return o;
  }

  Swarm.prototype.render = function (time, dt) {
    var gl = this.gl, L = this.loc, keys = this.keys;
    if (this.lost || !keys.length) return;
    dt = Math.min(dt, 0.05);

    this.t += (this.tTarget - this.t) * (1 - Math.exp(-dt * 5.5));
    var t = Math.max(0, Math.min(keys.length - 1, this.t));
    var i0 = Math.min(keys.length - 1, Math.floor(t)), i1 = Math.min(keys.length - 1, i0 + 1);
    var mixv = t - i0, A = keys[i0], B = keys[i1];
    var e = mixv * mixv * (3 - 2 * mixv);
    var k = {};
    for (var n = 0; n < NUM.length; n++) k[NUM[n]] = A[NUM[n]] + (B[NUM[n]] - A[NUM[n]]) * e;

    var bufA = this.forms[A.form], bufB = this.forms[B.form];
    if (!bufA || !bufB) return;

    var p = this.pointer;
    p.sx += (p.x - p.sx) * (1 - Math.exp(-dt * 4));
    p.sy += (p.y - p.sy) * (1 - Math.exp(-dt * 4));
    p.force += ((p.inside ? 0.22 : 0) - p.force) * (1 - Math.exp(-dt * 2.2));

    for (var c = 0; c < 3; c++) this.ink[c] += (this.inkTarget[c] - this.ink[c]) * (1 - Math.exp(-dt * 5));

    this.spinAngle += dt * k.spin * this.calm;
    var yaw = k.yaw + this.spinAngle + Math.sin(time * 0.23) * k.sway * this.calm + p.sx * 0.3 * this.calm;
    var pitch = k.pitch + Math.sin(time * 0.17 + 1.3) * k.sway * 0.35 * this.calm - p.sy * 0.2 * this.calm;

    gl.clear(gl.COLOR_BUFFER_BIT);
    if (k.alpha < 0.004) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, bufA); gl.vertexAttribPointer(L.aA, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufB); gl.vertexAttribPointer(L.aB, 3, gl.FLOAT, false, 0, 0);

    var hw = this.hh * this.aspect;
    gl.uniform1f(L.uMix, mixv);
    gl.uniform1f(L.uTime, time);
    gl.uniform1f(L.uIntro, this.intro);
    gl.uniform1f(L.uScale, k.size * this.hh);
    gl.uniform1f(L.uSize, Math.max(1.4, this.h * 0.0032) * this.dpr * k.dot);
    gl.uniform1f(L.uCamZ, this.camZ);
    gl.uniform1f(L.uAlpha, k.alpha);
    gl.uniform1f(L.uForce, p.force * this.calm);
    gl.uniform1f(L.uRadius, this.hh * 0.42);
    gl.uniform1f(L.uCalm, this.calm);
    gl.uniformMatrix3fv(L.uRot, false, rotation(yaw, pitch, k.tilt));
    gl.uniformMatrix4fv(L.uProj, false, this.proj);
    gl.uniform2f(L.uOffset, k.x * hw, k.y * this.hh);
    gl.uniform2f(L.uMouse, p.sx * hw, p.sy * this.hh);
    gl.uniform3fv(L.uInk, this.ink);
    gl.uniform3fv(L.uSpot, this.spot);
    gl.drawArrays(gl.POINTS, 0, this.count);
  };

  window.USSwarm = Swarm;
})();
