/* Relume animation runtime v15 — boots any number of [data-relume-anim]
   instances from one shared engine. Loads Three.js deps once per page.

   The engine sizes its renderer and camera once, at init, and has no resize
   path of its own, so a browser resize would otherwise leave the artwork drawn
   for the old box. Each instance is therefore restartable: on a settled stage
   resize the running instance is retired (its animation loop and window
   listeners are cut) and a fresh one is started at the new size. */
(function () {
  if (window.__RELUME_RT__) return;
  window.__RELUME_RT__ = 15;

  /* ---- frame-loop ownership -----------------------------------------------
     The engine calls requestAnimationFrame as a BARE global, so the per-instance
     proxy further down never saw it and retire() could not actually stop a
     running instance. Every stage resize therefore left that instance's
     animate() and text-overlay loops running forever against a detached canvas,
     holding its whole three.js scene and its WebGL context alive. Measured
     before this fix: +2 permanent loops per resize, monotonic, never released.

     Tagging fixes it without touching the engine. RAF_OWNER names the instance
     whose code is executing right now; it is set around the factory call and
     re-established for the duration of every callback that instance scheduled,
     so ownership propagates down a self-rescheduling loop of any depth. A
     retired owner's callbacks are neither scheduled nor run.

     Callbacks scheduled by anything else - GSAP, Webflow, lottie, the
     scroll-driver in bootOne - carry a null owner and pass straight through.
     The native handle is returned unchanged so cancelAnimationFrame still
     works.

     v15 - OFFSCREEN PARK. The viewport gate only delays BOOT; once booted, every
     instance's engine loop rendered a full WebGL frame at 60fps for the rest of
     the visit, onscreen or not, which ate the main thread and dragged interaction
     latency (INP) on long scrolls. An owner with a `parked` array is offscreen:
     its frame requests are held there instead of being scheduled, and replayed
     under the same owner when it scrolls back into view. The scene and its WebGL
     context stay alive, so nothing rebuilds and the art resumes where it stopped. */
  var RAF_OWNER = null;
  var rafNative = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (cb) {
    var owner = RAF_OWNER;
    if (owner && owner.retired) return 0;
    if (owner && owner.parked) { owner.parked.push(cb); return 0; }
    return rafNative(function (ts) {
      if (owner && owner.retired) return;
      if (owner && owner.parked) { owner.parked.push(cb); return; }
      var prev = RAF_OWNER;
      RAF_OWNER = owner;
      try { cb(ts); } finally { RAF_OWNER = prev; }
    });
  };

  /* Removing a canvas from the DOM does NOT release its WebGL context. Browsers
     cap live contexts (~16) and force-kill the oldest when that cap is passed,
     which is what makes the artwork randomly go blank after a handful of
     resizes. loseContext() hands it back immediately instead.

     No explicit renderer/geometry/material/texture dispose() is needed: the
     factory is invoked once per instance, so every one of those objects lives in
     that instance's own closure. Once its frame loops are dead nothing reaches
     the closure any more and the whole graph is collectable. That per-instance
     isolation is also why losing this context cannot affect a sibling. */
  function park(owner) {
    if (owner && !owner.retired && !owner.parked) owner.parked = [];
  }
  function unpark(owner) {
    if (!owner || !owner.parked) return;
    var held = owner.parked;
    owner.parked = null;
    if (owner.retired) return;
    var prev = RAF_OWNER;
    RAF_OWNER = owner;
    try {
      for (var i = 0; i < held.length; i++) window.requestAnimationFrame(held[i]);
    } finally { RAF_OWNER = prev; }
  }

  function releaseCanvas(cv) {
    try {
      var gl = cv.getContext('webgl2') || cv.getContext('webgl') ||
               cv.getContext('experimental-webgl');
      if (!gl) return;                    /* 2-D overlay canvas: nothing to free */
      var ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    } catch (e) {}
  }

  var DEPS = [
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/lines/LineSegmentsGeometry.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/lines/LineGeometry.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/lines/LineMaterial.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/lines/LineSegments2.js',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/geometries/RoundedBoxGeometry.js'
  ];

  var depsReady = false, depsLoading = false, waiters = [];

  function loadSeq(list, i, done) {
    if (i >= list.length) return done();
    var s = document.createElement('script');
    s.src = list[i];
    s.onload = function () { loadSeq(list, i + 1, done); };
    s.onerror = function () { loadSeq(list, i + 1, done); };
    document.head.appendChild(s);
  }

  function ensureDeps(cb) {
    if (depsReady) return cb();
    waiters.push(cb);
    if (depsLoading) return;
    depsLoading = true;
    loadSeq(DEPS, 0, function () {
      depsReady = true;
      var w = waiters; waiters = [];
      for (var i = 0; i < w.length; i++) w[i]();
    });
  }

  function factoryFn() {
    return window.__RELUME_EMBED_FACTORY4__ ||
           window.__RELUME_EMBED_FACTORY3__ ||
           window.__RELUME_EMBED_FACTORY__;
  }

  function bootOne(host, cfg) {
    var stage = host.querySelector('[data-relume-stage]');
    if (!stage) return;
    var scrollMode = host.hasAttribute('data-relume-scroll') || cfg.scrollDriven === true;
    /* How much of a full revolution the ring turns as the section crosses the
       viewport. data-relume-scroll="0.9" => 90% of a turn. Defaults to 1. */
    var turns = parseFloat(host.getAttribute('data-relume-scroll'));
    if (!isFinite(turns) || turns <= 0) turns = 1;

    /* Binding the ring straight to scroll position makes it stop dead the
       instant the wheel stops. Instead chase the scroll position with an
       exponential ease, so the ring keeps turning briefly and decelerates into
       a stop. data-relume-ease is the catch-up fraction per 60fps frame:
       lower = longer, softer glide. */
    var ease = parseFloat(host.getAttribute('data-relume-ease'));
    if (!isFinite(ease) || ease <= 0 || ease > 1) ease = 0.09;

    function rawProgress() {
      var r = host.getBoundingClientRect();
      var vh = window.innerHeight || 1;
      var total = vh + r.height;
      var p = total ? (vh - r.top) / total : 0;
      return p < 0 ? 0 : (p > 1 ? 1 : p);
    }

    var eased = rawProgress(), lastTs = null;
    /* Owner for this host's own scroll-driver loop, so it parks with the art. */
    var hostOwner = { retired: false, parked: null };
    var onscreen = true;
    if (scrollMode) {
      var prevHostOwner = RAF_OWNER;
      RAF_OWNER = hostOwner;
      /* Uses the rAF timestamp (not performance.now()) so the step is driven by
         real frame deltas and stays consistent at 60Hz and 120Hz alike. */
      window.requestAnimationFrame(function step(ts) {
        var target = rawProgress();
        if (lastTs === null) { eased = target; }
        else {
          var dt = (ts - lastTs) / 1000;
          if (dt > 0.1) dt = 0.1;
          eased += (target - eased) * (1 - Math.pow(1 - ease, dt * 60));
        }
        lastTs = ts;
        window.requestAnimationFrame(step);
      });
      RAF_OWNER = prevHostOwner;
    }

    var toast = document.createElement('div');
    toast.style.display = 'none';
    host.appendChild(toast);

    var live = null;

    function proxies(inst) {
      var W = new Proxy(window, {
        get: function (t, p) {
          if (p === '__EMBED__') return cfg;
          /* A retired instance must stop painting: drop its next frame request
             instead of chaining another one. */
          if (p === 'requestAnimationFrame') return function (cb) {
            if (inst.retired) return 0;
            return window.requestAnimationFrame(cb);
          };
          /* The engine's scrollFrac() is scrollY / (documentHeight - innerHeight).
             On a long page that spreads one rotation across the WHOLE document, so
             the art barely moves while the section is on screen. Feed it a
             synthetic scrollY so the fraction sweeps 0 -> 1 as this section
             crosses the viewport instead. */
          if (scrollMode && p === 'scrollY') {
            var denom = Math.max(1, document.documentElement.scrollHeight - (stage.clientHeight || 1));
            return eased * turns * denom;
          }
          if (p === 'innerWidth') return stage.clientWidth || 1;
          if (p === 'innerHeight') return stage.clientHeight || 1;
          if (p === 'addEventListener') return function (ty, fn, o) {
            var wrapped = function (e) {
              if (inst.retired) return;
              if (ty.indexOf('pointer') === 0 || ty.indexOf('mouse') === 0) {
                var r = stage.getBoundingClientRect();
                return fn.call(this, new Proxy(e, {
                  get: function (te, tp) {
                    if (tp === 'clientX') return e.clientX - r.left;
                    if (tp === 'clientY') return e.clientY - r.top;
                    var v = Reflect.get(te, tp);
                    return typeof v === 'function' ? v.bind(te) : v;
                  }
                }));
              }
              return fn.call(this, e);
            };
            inst.listeners.push([ty, wrapped, o]);
            return t.addEventListener(ty, wrapped, o);
          };
          var v = Reflect.get(t, p);
          return typeof v === 'function' ? v.bind(t) : v;
        },
        set: function (t, p, v) { t[p] = v; return true; },
        has: function (t, p) { return p in t; }
      });

      /* The engine paints document.body (background colour, "embed-mode" class).
         Point it at the host so it can only ever style its own box. */
      var D = new Proxy(document, {
        get: function (t, p) {
          if (p === 'body') return host;
          if (p === 'getElementById') return function (id) {
            if (id === 'stage') return stage;
            if (id === 'toast') return toast;
            return t.getElementById(id);
          };
          var v = Reflect.get(t, p);
          return typeof v === 'function' ? v.bind(t) : v;
        },
        set: function (t, p, v) { t[p] = v; return true; }
      });

      return { W: W, D: D };
    }

    function start() {
      var f = factoryFn();
      if (!f) return;
      var inst = { retired: false, parked: onscreen ? null : [], listeners: [], w: stage.clientWidth, h: stage.clientHeight };
      live = inst;
      var px = proxies(inst);
      var prevOwner = RAF_OWNER;
      RAF_OWNER = inst;
      try { f(px.W, px.D); }
      catch (err) { host.setAttribute('data-relume-error', String(err && err.message || err)); }
      finally { RAF_OWNER = prevOwner; }
    }

    function retire() {
      if (!live) return;
      live.retired = true;
      for (var i = 0; i < live.listeners.length; i++) {
        var l = live.listeners[i];
        try { window.removeEventListener(l[0], l[1], l[2]); } catch (e) {}
      }
      live = null;
      var kids = [].slice.call(stage.children);
      for (var j = 0; j < kids.length; j++) {
        if (kids[j].tagName !== 'CANVAS') continue;
        releaseCanvas(kids[j]);
        stage.removeChild(kids[j]);
      }
    }

    var timer = null;
    function onResize() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        timer = null;
        var w = stage.clientWidth, h = stage.clientHeight;
        if (!w || !h) return;
        if (live && Math.abs(w - live.w) < 2 && Math.abs(h - live.h) < 2) return;
        retire();
        start();
      }, 200);
    }

    if (window.ResizeObserver) new ResizeObserver(onResize).observe(stage);
    window.addEventListener('resize', onResize);
    if (window.IntersectionObserver) {
      /* The margin starts the loop just before the art scrolls in. */
      new IntersectionObserver(function (entries) {
        onscreen = entries[entries.length - 1].isIntersecting;
        if (onscreen) { lastTs = null; unpark(hostOwner); unpark(live); }
        else { park(hostOwner); park(live); }
      }, { rootMargin: '200px 0px' }).observe(host);
    }

    start();
  }

  function bootAll() {
    var hosts = document.querySelectorAll('[data-relume-anim]');
    for (var i = 0; i < hosts.length; i++) {
      (function (host) {
        if (host.__rlBooted) return;
        var key = host.getAttribute('data-relume-anim');
        var cfg = (window.__RELUME_CFG__ || {})[key];
        if (!cfg) return;
        if (!factoryFn()) return;

        var stage = host.querySelector('[data-relume-stage]');
        if (!stage) return;

        /* The engine builds its camera and scale once, at init — booting at zero
           size yields a permanently blank canvas. Wait for real layout first. */
        if (!stage.clientWidth || !stage.clientHeight) {
          if (!host.__rlWatch && window.ResizeObserver) {
            host.__rlWatch = new ResizeObserver(function () {
              if (stage.clientWidth && stage.clientHeight) {
                host.__rlWatch.disconnect();
                host.__rlWatch = null;
                bootAll();
              }
            });
            host.__rlWatch.observe(stage);
          }
          return;
        }

        host.__rlBooted = 1;
        ensureDeps(function () { bootOne(host, cfg); });
      })(hosts[i]);
    }
  }

  window.__RELUME_BOOT__ = bootAll;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAll);
  }
  bootAll();
  var n = 0, iv = setInterval(function () {
    bootAll();
    if (++n > 60) clearInterval(iv);
  }, 100);
})();
