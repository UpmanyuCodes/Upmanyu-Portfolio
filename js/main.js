/* main.js — everything that moves.
   Needs (loaded before this, all deferred): gsap, ScrollTrigger, SplitText, Lenis, forms.js, swarm.js
   Sections:
     1  setup            5  scroll animations     9  cursor + magnetic
     2  smooth scroll    6  gallery + marquee    10  page transitions
     3  swarm            7  frame loop           11  small things (clock, copy, lightbox)
     4  loader + intro   8  nav + menu           12  boot */
(function () {
  'use strict';

  // ── 1  setup ──────────────────────────────────────────────
  var root = document.documentElement, body = document.body;
  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger, SplitText = window.SplitText;

  if (!gsap || !ScrollTrigger) { root.classList.add('failsafe'); return; }
  window.__siteBooted = true;       // tells boot.js the libraries arrived
  gsap.registerPlugin(ScrollTrigger);
  if (SplitText) gsap.registerPlugin(SplitText);

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };

  var reduced = root.classList.contains('reduced');
  var firstVisit = root.classList.contains('first-visit');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var isNarrow = function () { return window.innerWidth < 820; };

  var PAPER = [0.925, 0.91, 0.875], INK = [0.071, 0.067, 0.059];
  var baseTheme = root.getAttribute('data-theme') || 'paper';
  var curTheme = baseTheme;
  var page = body.getAttribute('data-page') || '';

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  // ── 2  smooth scroll ──────────────────────────────────────
  var lenis = null;
  if (window.Lenis && !reduced) {
    lenis = new window.Lenis({ lerp: 0.1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  // ── 3  swarm ──────────────────────────────────────────────
  var swarm = null, anchors = [], themeZones = [];

  function loadPortrait(src, crop, n) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var timer = setTimeout(function () { reject(new Error('portrait timeout')); }, 5000);
      img.onload = function () {
        clearTimeout(timer);
        try { resolve(window.USForms.portrait(img, n, crop)); } catch (e) { reject(e); }
      };
      img.onerror = function () { clearTimeout(timer); reject(new Error('portrait failed')); };
      img.src = src;
    });
  }

  function setupSwarm() {
    var canvas = $('.stage'), els = $$('[data-swarm]');
    if (!canvas || !els.length || !window.USSwarm || !window.USForms) return Promise.resolve();
    try {
      swarm = new window.USSwarm(canvas, { count: isNarrow() ? 13000 : 30000 });
    } catch (e) {
      canvas.style.display = 'none'; swarm = null;
      return Promise.resolve();
    }
    var F = window.USForms, n = swarm.count, keys = [], jobs = [], made = {};
    els.forEach(function (el) {
      var k;
      try { k = JSON.parse(el.getAttribute('data-swarm')); } catch (e) { return; }
      keys.push(k); anchors.push({ el: el, fig: el.querySelector('[data-fig]') });
      if (made[k.form]) return;
      made[k.form] = true;
      if (k.form === 'portrait') {
        jobs.push(loadPortrait(k.src, k.crop, n).then(function (d) { swarm.addForm('portrait', d); })
          .catch(function () { swarm.addForm('portrait', F.orrery(n)); }));
      } else if (k.form.indexOf('glyph:') === 0) {
        swarm.addForm(k.form, F.glyph(k.form.slice(6), n, "'Host Grotesk', 'Helvetica Neue', Arial, sans-serif"));
      } else if (F[k.form]) {
        swarm.addForm(k.form, F[k.form](n));
      } else {
        swarm.addForm(k.form, F.dust(n));
      }
    });
    swarm.setKeys(keys);
    swarm.setInk(curTheme === 'ink' ? PAPER : INK, true);
    if (reduced) { swarm.intro = 1; swarm.calm = 0; }
    return Promise.all(jobs);
  }

  function measure() {
    var sy = window.scrollY;
    anchors.forEach(function (a) {
      var r = a.el.getBoundingClientRect();
      a.top = r.top + sy; a.bottom = r.bottom + sy;
    });
    themeZones = $$('body [data-theme]').map(function (el) {
      var r = el.getBoundingClientRect();
      return { top: r.top + sy, bottom: r.bottom + sy, theme: el.getAttribute('data-theme') };
    });
    measureGallery();
    marquees.forEach(function (m) { m.w = m.set.offsetWidth; });
  }

  // ── 4  loader + intro ─────────────────────────────────────
  function intro() {
    window.__siteReady = true;
    root.classList.remove('is-loading');
    if (lenis) lenis.start();
    initScrollAnimations();

    var lines = $$('[data-lines="intro"] .hl__in');
    if (lines.length) {
      gsap.set(lines, { visibility: 'visible', yPercent: 115, rotate: 2.5, transformOrigin: '0% 100%' });
      gsap.to(lines, { yPercent: 0, rotate: 0, duration: 1.5, ease: 'expo.out', stagger: 0.1, delay: 0.1 });
    }
    if (swarm && !reduced) gsap.to(swarm, { intro: 1, duration: 2.8, ease: 'power2.out' });
    gsap.from('.nav > *', { y: -24, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.07, delay: 0.35, clearProps: 'transform,opacity' });
  }

  function playLoader(ready) {
    var loader = $('.loader');
    if (!loader) { ready.then(intro); return; }
    var count = $('[data-count]', loader), bar = $('.loader__bar', loader), words = $('.loader__words > div', loader);
    var total = words ? words.children.length : 1;
    var o = { v: 0 }, step = -1, started = performance.now();
    var paint = function () {
      if (count) count.textContent = ('00' + Math.round(o.v)).slice(-3);
      if (bar) bar.style.transform = 'scaleX(' + (o.v / 100) + ')';
      var s = Math.min(total - 1, Math.floor(o.v / (100 / total)));
      if (words && s !== step) { step = s; gsap.to(words, { yPercent: -(100 / total) * s, duration: 0.6, ease: 'expo.out' }); }
    };
    var crawl = gsap.to(o, { v: 74, duration: 2.6, ease: 'power1.out', onUpdate: paint });
    ready.then(function () {
      var wait = Math.max(0, 1300 - (performance.now() - started)) / 1000;
      gsap.delayedCall(wait, function () {
        crawl.kill();
        gsap.to(o, {
          v: 100, duration: 0.85, ease: 'power2.inOut', onUpdate: paint,
          onComplete: function () {
            gsap.to(loader, {
              clipPath: 'inset(0% 0% 100% 0%)', duration: 1.15, ease: 'expo.inOut', delay: 0.25,
              onStart: function () { gsap.delayedCall(0.35, intro); },
              onComplete: function () { loader.style.display = 'none'; }
            });
            gsap.to($('.loader__mid', loader), { y: -60, opacity: 0, duration: 0.8, ease: 'power3.in', delay: 0.1 });
          }
        });
      });
    });
  }

  function playArrival(ready) {
    var curtain = $('.curtain');
    if (!curtain) { ready.then(intro); return; }
    gsap.set(curtain, { y: 0, yPercent: 0 });
    ready.then(function () {
      gsap.to(curtain, { yPercent: -101, duration: 0.95, ease: 'expo.inOut', onStart: function () { gsap.delayedCall(0.3, intro); } });
    });
  }

  // ── 5  scroll animations ──────────────────────────────────
  function inFirstView(el) { return el.getBoundingClientRect().top < window.innerHeight; }

  function initScrollAnimations() {
    if (reduced) return;

    // paragraphs and headings: each line rises out of a mask
    $$('[data-split]').forEach(function (el) {
      var early = inFirstView(el);
      if (!SplitText) { el.style.visibility = 'visible'; return; }
      try {
        SplitText.create(el, {
          type: 'lines', mask: 'lines', linesClass: 'line', autoSplit: true,
          onSplit: function (self) {
            gsap.set(el, { visibility: 'visible' });
            // things already on screen just play; the rest wait for the scroll
            return gsap.from(self.lines, {
              yPercent: 118, duration: 1.3, ease: 'expo.out', stagger: 0.08, delay: early ? 0.45 : 0,
              scrollTrigger: early ? null : { trigger: el, start: 'top 90%', once: true }
            });
          }
        });
      } catch (e) { el.style.visibility = 'visible'; }
    });

    // statement: words ink in as you read
    $$('[data-scrub]').forEach(function (el) {
      if (!SplitText) { el.style.visibility = 'visible'; return; }
      try {
        var s = SplitText.create(el, { type: 'words', wordsClass: 'w' });
        gsap.set(el, { visibility: 'visible' });
        gsap.fromTo(s.words, { opacity: 0.13 }, {
          opacity: 1, ease: 'none', stagger: 0.08,
          scrollTrigger: { trigger: el, start: 'top 84%', end: 'bottom 52%', scrub: 0.5 }
        });
      } catch (e) { el.style.visibility = 'visible'; }
    });

    // pre-broken display lines (footer, page heads further down)
    $$('[data-lines]').forEach(function (el) {
      if (el.getAttribute('data-lines') === 'intro') return;
      var ins = $$('.hl__in', el);
      gsap.set(ins, { visibility: 'visible' });
      gsap.from(ins, {
        yPercent: 115, duration: 1.45, ease: 'expo.out', stagger: 0.1,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    // everything else: a short rise
    $$('[data-reveal]').forEach(function (el) {
      var early = inFirstView(el);
      var sibs = el.parentElement ? $$(':scope > [data-reveal]', el.parentElement) : [el];
      var order = Math.max(0, sibs.indexOf(el));
      gsap.set(el, { visibility: 'visible' });
      gsap.from(el, {
        y: 30, opacity: 0, duration: 1.25, ease: 'expo.out', delay: (early ? 0.65 : 0) + order * 0.07,
        scrollTrigger: early ? null : { trigger: el, start: 'top 96%', once: true }
      });
    });

    // images drift inside their frames
    $$('[data-parallax]').forEach(function (img) {
      var amt = parseFloat(img.getAttribute('data-parallax')) || 8;
      gsap.fromTo(img, { yPercent: -amt }, {
        yPercent: amt, ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });

    // frames open like a shutter
    $$('[data-unveil]').forEach(function (el) {
      gsap.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    // hairlines draw themselves
    $$('.rule').forEach(function (el) {
      gsap.from(el, { scaleX: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 95%', once: true } });
    });
  }

  // ── 6  gallery + marquee ──────────────────────────────────
  var gal = $('.gallery'), track = $('.gallery__track'), galCount = $('[data-gallery-count]');
  var cards = gal ? $$('.card', gal) : [], galTop = 0, galTravel = 0, galX = 0, galSkew = 0, galIndex = -1;

  function measureGallery() {
    if (!gal || !track) return;
    if (isNarrow() || reduced) {
      gal.style.height = ''; track.style.transform = ''; galTravel = 0;
      cards.forEach(function (c) { c.style.transform = ''; });
      return;
    }
    galTravel = Math.max(0, track.scrollWidth - window.innerWidth);
    gal.style.height = (window.innerHeight + galTravel) + 'px';
    galTop = gal.getBoundingClientRect().top + window.scrollY;
    cards.forEach(function (c) { c._mid = c.offsetLeft + c.offsetWidth / 2; });
  }

  function driveGallery(sy) {
    if (!galTravel) return;
    var x = -clamp01((sy - galTop) / galTravel) * galTravel;
    var v = x - galX; galX = x;
    galSkew += (Math.max(-4, Math.min(4, v * 0.07)) - galSkew) * 0.14;
    track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
    var mid = window.innerWidth / 2 - x, best = 0, dist = Infinity;
    for (var i = 0; i < cards.length; i++) {
      cards[i].style.transform = 'skewX(' + galSkew.toFixed(3) + 'deg)';
      var d = Math.abs(cards[i]._mid - mid);
      if (d < dist) { dist = d; best = i; }
    }
    if (best !== galIndex && galCount) { galIndex = best; galCount.textContent = ('0' + (best + 1)).slice(-2); }
  }

  var marquees = $$('[data-marquee]').map(function (row) {
    var set = row.firstElementChild;
    row.appendChild(set.cloneNode(true));
    row.appendChild(set.cloneNode(true));
    return { row: row, set: set, dir: parseFloat(row.getAttribute('data-marquee')) || 1, x: 0, w: 0 };
  });

  function driveMarquees(vel, dt) {
    for (var i = 0; i < marquees.length; i++) {
      var m = marquees[i];
      if (!m.w) continue;
      m.x -= (0.7 + Math.min(40, Math.abs(vel)) * 0.32) * m.dir * dt * 60;
      if (m.x <= -m.w) m.x += m.w;
      if (m.x > 0) m.x -= m.w;
      m.row.style.transform = 'translate3d(' + m.x.toFixed(2) + 'px,0,0)';
    }
  }

  // ── 7  frame loop ─────────────────────────────────────────
  var nav = $('.nav'), lastY = 0, themeMeta = $('meta[name="theme-color"]');

  function frame(time, delta) {
    var sy = window.scrollY, vh = window.innerHeight, vc = sy + vh * 0.5, dt = Math.min(0.05, delta / 1000);
    var vel = sy - lastY, i;

    if (swarm) {
      var t = 0, w = vh * 0.36;
      for (i = 0; i < anchors.length - 1; i++) {
        var b = (anchors[i].bottom + anchors[i + 1].top) / 2;
        var u = clamp01((vc - (b - w)) / (2 * w));
        t += u * u * (3 - 2 * u);
      }
      swarm.tTarget = t;
      swarm.render(time, dt);
      // a caption only shows while its own figure is on stage
      for (i = 0; i < anchors.length; i++) {
        if (!anchors[i].fig) continue;
        var near = (1 - clamp01(Math.abs(swarm.t - i) * 3.2)) * swarm.intro;
        anchors[i].fig.style.opacity = near.toFixed(3);
      }
    }

    var th = baseTheme;
    for (i = 0; i < themeZones.length; i++) {
      if (vc >= themeZones[i].top && vc < themeZones[i].bottom) th = themeZones[i].theme;
    }
    if (th !== curTheme) {
      curTheme = th;
      root.setAttribute('data-theme', th);
      if (swarm) swarm.setInk(th === 'ink' ? PAPER : INK);
      if (themeMeta) themeMeta.setAttribute('content', th === 'ink' ? '#12110f' : '#ece8df');
    }

    if (nav && !menuOpen) {
      if (vel > 3 && sy > vh * 0.5) nav.classList.add('is-hidden');
      else if (vel < -3 || sy < 40) nav.classList.remove('is-hidden');
    }

    driveGallery(sy);
    if (!reduced) driveMarquees(vel, dt);
    lastY = sy;
  }

  // ── 8  nav + menu ─────────────────────────────────────────
  var menu = $('.menu'), toggle = $('.nav__toggle'), menuOpen = false;

  function setMenu(open) {
    menuOpen = open;
    if (menu) menu.classList.toggle('is-open', open);
    body.classList.toggle('menu-open', open);
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(open));
      var s = $('span', toggle); if (s) s.textContent = open ? 'Close' : 'Menu';
    }
    if (lenis) { if (open) lenis.stop(); else lenis.start(); }
  }
  if (toggle) toggle.addEventListener('click', function () { setMenu(!menuOpen); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (menuOpen) setMenu(false); closeLightbox(); }
  });

  $$('.nav__link, .menu__links a').forEach(function (a) {
    var file = (a.getAttribute('href') || '').replace('.html', '');
    if ((file === 'index' && page === 'home') || file === page) a.setAttribute('aria-current', 'page');
  });

  // ── 9  cursor + magnetic ──────────────────────────────────
  if (finePointer && !reduced) {
    var cur = $('.cursor'), curLabel = $('.cursor__label');
    if (cur) {
      var cx = gsap.quickTo(cur, 'x', { duration: 0.4, ease: 'power3' });
      var cy = gsap.quickTo(cur, 'y', { duration: 0.4, ease: 'power3' });
      window.addEventListener('pointermove', function (e) { cx(e.clientX); cy(e.clientY); cur.classList.add('is-on'); }, { passive: true });
      document.addEventListener('pointerover', function (e) {
        var lab = e.target.closest && e.target.closest('[data-cursor]');
        var link = e.target.closest && e.target.closest('a, button');
        cur.classList.toggle('is-label', !!lab);
        cur.classList.toggle('is-link', !lab && !!link);
        if (lab && curLabel) curLabel.textContent = lab.getAttribute('data-cursor');
      });
      root.addEventListener('pointerleave', function () { cur.classList.remove('is-on'); });
    }
    $$('[data-magnetic]').forEach(function (el) {
      var mx = gsap.quickTo(el, 'x', { duration: 0.9, ease: 'elastic.out(1, 0.45)' });
      var my = gsap.quickTo(el, 'y', { duration: 0.9, ease: 'elastic.out(1, 0.45)' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        mx((e.clientX - (r.left + r.width / 2)) * 0.32);
        my((e.clientY - (r.top + r.height / 2)) * 0.42);
      });
      el.addEventListener('pointerleave', function () { mx(0); my(0); });
    });
  }

  // ── 10  page transitions ──────────────────────────────────
  var NAMES = { index: 'Home', projects: 'Projects', design: 'Design', about: 'About', contact: 'Contact' };
  var leaving = false;

  document.addEventListener('click', function (e) {
    var top = e.target.closest && e.target.closest('[data-top]');
    if (top) {
      e.preventDefault();
      if (lenis) lenis.scrollTo(0, { duration: 1.6 }); else window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
      return;
    }
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    var href = a.getAttribute('href');
    if (!href || a.target === '_blank' || a.hasAttribute('download') || a.hasAttribute('data-zoom')) return;
    if (/^(https?:|mailto:|tel:|#)/i.test(href)) return;
    var file = href.split('/').pop().split('#')[0].split('?')[0].replace('.html', '');
    if (!NAMES[file]) return;

    e.preventDefault();
    if (leaving) return;
    if ((file === 'index' && page === 'home') || file === page) {
      if (menuOpen) setMenu(false);
      if (lenis) lenis.scrollTo(0, { duration: 1.4 }); else window.scrollTo(0, 0);
      return;
    }
    var curtain = $('.curtain');
    if (reduced || !curtain) { window.location.href = href; return; }

    leaving = true;
    var label = $('.curtain__label span', curtain);
    if (label) label.textContent = NAMES[file];
    gsap.set(curtain, { y: 0, yPercent: 101 });
    gsap.to(curtain, { yPercent: 0, duration: 0.8, ease: 'expo.inOut', onComplete: function () { window.location.href = href; } });
    if (label) gsap.fromTo(label, { yPercent: 110 }, { yPercent: 0, duration: 0.8, ease: 'expo.out', delay: 0.3 });
    if (swarm) gsap.to(swarm, { intro: 0, duration: 0.8, ease: 'power2.in' });
  });

  // back/forward cache: never come back to a drawn curtain
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    leaving = false;
    var curtain = $('.curtain');
    if (curtain) gsap.set(curtain, { yPercent: -101 });
    if (swarm) swarm.intro = 1;
    if (lenis) lenis.start();
  });

  // ── 11  small things ──────────────────────────────────────
  function tick() {
    var s;
    try {
      s = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    } catch (e) { return; }
    $$('[data-clock]').forEach(function (el) { el.textContent = s; });
  }
  tick(); setInterval(tick, 15000);

  $$('[data-copy]').forEach(function (btn) {
    var out = $('[data-copy-label]', btn) || btn, original = out.textContent;
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var done = function () { out.textContent = 'Copied'; setTimeout(function () { out.textContent = original; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { });
    });
  });

  var lightbox = null;
  function closeLightbox() {
    if (!lightbox || !lightbox.classList.contains('is-open')) return;
    lightbox.classList.remove('is-open');
    if (lenis) lenis.start();
  }
  document.addEventListener('click', function (e) {
    var z = e.target.closest && e.target.closest('[data-zoom]');
    if (!z) { if (lightbox && e.target.closest('.lightbox')) closeLightbox(); return; }
    e.preventDefault();
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.className = 'lightbox';
      lightbox.setAttribute('data-cursor', 'Close');
      lightbox.innerHTML = '<img alt="" /><p class="label"></p>';
      body.appendChild(lightbox);
    }
    var img = $('img', z);
    $('img', lightbox).src = z.getAttribute('href') || (img && img.src);
    $('img', lightbox).alt = img ? img.alt : '';
    $('p', lightbox).textContent = z.getAttribute('data-zoom') || '';
    void lightbox.offsetWidth;
    lightbox.classList.add('is-open');
    if (lenis) lenis.stop();
  });

  // ── 12  boot ──────────────────────────────────────────────
  var resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (swarm) swarm.resize();
      measure();
      ScrollTrigger.refresh();
    }, 160);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('load', function () { measure(); ScrollTrigger.refresh(); });
  if (window.ResizeObserver) {
    var lastH = 0;
    new ResizeObserver(function () {
      var h = body.scrollHeight;
      if (Math.abs(h - lastH) > 4) { lastH = h; measure(); }
    }).observe(body);
  }

  var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  var capped = function (p, ms) {
    return Promise.race([p, new Promise(function (res) { setTimeout(res, ms); })]);
  };

  var ready = capped(fontsReady, 2500)
    .then(function () { return capped(setupSwarm(), 4000); })
    .catch(function () { })
    .then(function () { measure(); gsap.ticker.add(frame); });

  root.classList.add('is-loading');
  try { sessionStorage.setItem('us-seen', '1'); } catch (e) { }

  if (reduced) {
    $$('.loader, .curtain').forEach(function (el) { el.style.display = 'none'; });
    ready.then(intro);
  } else if (firstVisit) {
    playLoader(ready);
  } else {
    playArrival(ready);
  }
})();
