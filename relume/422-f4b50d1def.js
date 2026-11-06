/* publish-hero-video v5 (script 1.0.4)
   Inline muted autoplay loop with a centre play button; clicking it opens a
   lightbox player with controls and sound.

   Markup contract (Webflow HTML Embed) -- this script owns everything else:

     <style> ... box CSS for .phv / .phv_inline ... </style>
     <div class="phv" data-hero-video data-hero-video-full="<full-res url>">
       <video class="phv_inline" width="1920" height="1080" src="<loop url>"
              autoplay muted loop playsinline preload="metadata"></video>
     </div>

   The embed owns the box: size, aspect-ratio, radius, overflow and the
   :has() height override ship in its <style>, so the Designer canvas -- which
   never runs this script -- lays the hero out correctly. This script owns the
   play button, the lightbox and the visibility pause, and nothing else.

   Swapping the inline loop for a lighter encode is a src change in the embed;
   data-hero-video-full is what the lightbox plays. If the attribute is absent
   the lightbox reuses the inline source.

   Site-level script: self-guards and no-ops on pages with no [data-hero-video].

   1.0.4 - LAZY LOOP. The inline loop may carry data-src instead of src (plus a
   poster and preload="none", no autoplay attribute). Its bytes then wait for
   the window load event, so the loop no longer competes with the page's own CSS,
   fonts and scripts for bandwidth on a phone - the old 22 MB loop downloading
   during load was the single biggest drag on mobile LCP. The poster holds the
   frame until then. Under prefers-reduced-motion the loop is never fetched at
   all (the poster is the still), and the lightbox still plays the full file.
   A plain src keeps the old eager behaviour, so markup and script can ship in
   either order.
*/
(function (w, d) {
  'use strict';

  if (d.documentElement.dataset.phvReady) return;
  d.documentElement.dataset.phvReady = '1';

  var CSS = [
    /* The box CSS for .phv / .phv_inline, and the :has() override that frees
       .p-hero-header_image-wrapper from the mobile block's fixed height, are
       NOT here. They live in the HTML Embed alongside the markup, because
       registered scripts do not run in the Designer canvas and an unstyled
       <video> renders at its intrinsic 1920x1080 and blows out the hero.
       See rules/hero-video.md. Everything below is behaviour-only CSS that
       has no meaning without this script, so it stays. */

    /* --- play button --------------------------------------------------- */
    '.phv_play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);',
    'width:88px;height:88px;padding:0;border:0;border-radius:999px;cursor:pointer;',
    'display:flex;align-items:center;justify-content:center;color:#101010;',
    'background:rgba(255,255,255,.92);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);',
    'box-shadow:0 8px 32px rgba(0,0,0,.24);',
    /* Hidden until the asset is hovered. Opacity rather than display so the
       button stays focusable for keyboard users. */
    'opacity:0;transition:opacity .2s ease,transform .2s ease,background-color .2s ease}',
    '.phv:hover .phv_play{opacity:1}',
    '.phv_play:focus-visible{opacity:1;outline:3px solid #00b8ed;outline-offset:4px}',
    '.phv_play:hover{transform:translate(-50%,-50%) scale(1.06);background:#fff}',
    /* Touch devices never hover, so the affordance must always be visible. */
    '@media (hover:none){.phv_play{opacity:1}}',
    /* No margin nudge: the icon path below is centred within its own viewBox. */
    '.phv_play svg{display:block;width:30px;height:30px;fill:currentColor}',
    '@media (max-width:700px){.phv_play{width:64px;height:64px}',
    '.phv_play svg{width:22px;height:22px}}',

    /* --- lightbox ------------------------------------------------------ */
    '.phv_lb{position:fixed;inset:0;z-index:2147483000;display:flex;',
    'align-items:center;justify-content:center;padding:24px;',
    'background:rgba(0,0,0,.82);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);',
    'opacity:0;transition:opacity .24s ease}',
    '.phv_lb[hidden]{display:none}',
    '.phv_lb[data-open="true"]{opacity:1}',
    '.phv_dialog{position:relative;width:min(1200px,100%);aspect-ratio:16/9;',
    'border-radius:12px;overflow:hidden;background:#000;',
    'box-shadow:0 24px 80px rgba(0,0,0,.5);',
    'opacity:0;transform:scale(.94);transition:opacity .24s ease,transform .24s ease}',
    '.phv_lb[data-open="true"] .phv_dialog{opacity:1;transform:none}',
    '.phv_dialog video{display:block;width:100%;height:100%;background:#000}',
    '.phv_close{position:absolute;top:12px;right:12px;z-index:2;',
    'width:36px;height:36px;padding:0;border:0;border-radius:999px;cursor:pointer;',
    'display:flex;align-items:center;justify-content:center;',
    'background:rgba(0,0,0,.55);color:#fff;font:400 20px/1 sans-serif;',
    'transition:background-color .2s ease}',
    '.phv_close:hover{background:rgba(0,0,0,.8)}',
    '.phv_close:focus-visible{outline:3px solid #00b8ed;outline-offset:3px}',
    '@media (max-width:700px){.phv_lb{padding:16px}}',

    '@media (prefers-reduced-motion:reduce){',
    '.phv_lb,.phv_dialog,.phv_play{transition:none}}'
  ].join('');

  /* The triangle's own bounding box is centred on (12,12) inside the viewBox --
     x runs 5.5 to 18.5, y runs 4.7 to 19.3 -- so flex centring alone lands it
     dead centre with no margin correction. */
  var PLAY_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M5.5 6.1a1.6 1.6 0 0 1 2.42-1.37l9.6 5.9a1.6 1.6 0 0 1 0 2.74l-9.6 5.9A1.6 1.6 0 0 1 5.5 17.9Z"/>' +
    '</svg>';

  function injectCSS() {
    var s = d.createElement('style');
    s.setAttribute('data-phv', '');
    s.textContent = CSS;
    d.head.appendChild(s);
  }

  var reduceMotion = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var lb = null;          // lightbox singleton
  var activeHost = null;  // host that opened it
  var lastFocus = null;
  var lbOpen = false;     // so the visibility observer does not fight the lightbox

  function buildLightbox() {
    var el = d.createElement('div');
    el.className = 'phv_lb';
    el.hidden = true;
    el.innerHTML =
      '<div class="phv_dialog" role="dialog" aria-modal="true" aria-label="Video player">' +
      '<button class="phv_close" type="button" aria-label="Close video">&#10005;</button>' +
      '<video playsinline controls preload="none"></video>' +
      '</div>';

    var dialog = el.querySelector('.phv_dialog');
    var closeBtn = el.querySelector('.phv_close');
    var video = el.querySelector('video');

    // Backdrop click closes; clicks inside the dialog must not bubble out.
    el.addEventListener('click', function (e) { if (e.target === el) close(); });
    dialog.addEventListener('click', function (e) { e.stopPropagation(); });
    closeBtn.addEventListener('click', close);

    d.body.appendChild(el);
    return { el: el, dialog: dialog, closeBtn: closeBtn, video: video };
  }

  function onKeydown(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab' || !lb) return;

    // Minimal focus trap: keep Tab inside the dialog.
    var focusable = lb.dialog.querySelectorAll('button, video[controls]');
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function lockScroll(on) {
    var body = d.body;
    if (on) {
      var gap = w.innerWidth - d.documentElement.clientWidth;
      body.dataset.phvPrevOverflow = body.style.overflow || '';
      body.dataset.phvPrevPad = body.style.paddingRight || '';
      body.style.overflow = 'hidden';
      if (gap > 0) body.style.paddingRight = gap + 'px';
    } else {
      body.style.overflow = body.dataset.phvPrevOverflow || '';
      body.style.paddingRight = body.dataset.phvPrevPad || '';
      delete body.dataset.phvPrevOverflow;
      delete body.dataset.phvPrevPad;
    }
  }

  function open(host) {
    if (!lb) lb = buildLightbox();
    activeHost = host;
    lastFocus = d.activeElement;

    var inline = host.querySelector('.phv_inline');
    var full = host.getAttribute('data-hero-video-full') ||
               (inline && (inline.currentSrc || inline.src));
    if (!full) return;

    if (lb.video.getAttribute('src') !== full) lb.video.setAttribute('src', full);
    lb.video.muted = false;
    lb.video.currentTime = 0;

    lbOpen = true;
    lb.el.hidden = false;
    // Force a reflow so the opening transition actually runs.
    void lb.el.offsetWidth;
    lb.el.dataset.open = 'true';

    var p = lb.video.play();
    if (p && p.catch) p.catch(function () { /* user can hit the controls */ });

    if (inline) inline.pause();
    lockScroll(true);
    d.addEventListener('keydown', onKeydown, true);
    lb.closeBtn.focus();
  }

  function close() {
    if (!lb || lb.el.hidden) return;
    lbOpen = false;
    lb.el.dataset.open = 'false';
    lb.video.pause();

    var finish = function () {
      lb.el.hidden = true;
      // Drop the source so the decoder and buffer are released.
      lb.video.removeAttribute('src');
      lb.video.load();
    };
    if (reduceMotion) finish();
    else w.setTimeout(finish, 240);

    lockScroll(false);
    d.removeEventListener('keydown', onKeydown, true);

    if (activeHost && !reduceMotion) {
      var inline = activeHost.querySelector('.phv_inline');
      if (inline) { var p = inline.play(); if (p && p.catch) p.catch(function () {}); }
    }
    // Prefer the element that opened the lightbox; fall back to the play button
    // so focus never lands back on <body>.
    var restore = (lastFocus && lastFocus.focus && lastFocus !== d.body)
      ? lastFocus
      : (activeHost && activeHost.querySelector('.phv_play'));
    if (restore && restore.focus) restore.focus();
    activeHost = null;
  }

  /* Chrome only pauses muted background media when the whole tab is hidden, not
     when the hero has been scrolled past. At 4K that is a lot of decode for
     something nobody is looking at, so stop it once it leaves the viewport. */
  function watchVisibility(host, inline) {
    if (!w.IntersectionObserver || reduceMotion) return;
    new w.IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        host.dataset.phvVisible = entry.isIntersecting ? '1' : '0';
        if (lbOpen) return;
        // A lazy loop has nothing to play until its src lands after load.
        if (!inline.getAttribute('src')) return;
        if (entry.isIntersecting) {
          var p = inline.play();
          if (p && p.catch) p.catch(function () {});
        } else if (!inline.paused) {
          inline.pause();
        }
      });
    }, { threshold: 0.1 }).observe(host);
  }

  function afterLoad(fn) {
    if (d.readyState === 'complete') w.setTimeout(fn, 0);
    else w.addEventListener('load', function () { w.setTimeout(fn, 0); }, { once: true });
  }

  function initHost(host) {
    if (host.dataset.phvBound) return;
    host.dataset.phvBound = '1';

    var inline = host.querySelector('.phv_inline');

    // Autoplay only sticks when muted + playsinline are already on the element.
    if (inline) {
      inline.muted = true;
      var lazySrc = inline.getAttribute('data-src');
      if (reduceMotion) {
        inline.removeAttribute('autoplay');
        inline.pause();
      } else if (lazySrc && !inline.getAttribute('src')) {
        afterLoad(function () {
          inline.setAttribute('src', lazySrc);
          // Only start it if the hero is still on screen; the observer below
          // resumes it when it scrolls back in.
          if (host.dataset.phvVisible === '0' || lbOpen) return;
          var p = inline.play();
          if (p && p.catch) p.catch(function () { /* poster frame stands in */ });
        });
      } else {
        var p = inline.play();
        if (p && p.catch) p.catch(function () { /* poster frame stands in */ });
      }
    }

    var btn = d.createElement('button');
    btn.className = 'phv_play';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Play video with sound');
    btn.innerHTML = PLAY_ICON;
    btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); open(host); });
    host.appendChild(btn);

    // The whole frame is a click target, but the button is the a11y control.
    host.addEventListener('click', function () { open(host); });

    if (inline) watchVisibility(host, inline);
  }

  function init() {
    var hosts = d.querySelectorAll('[data-hero-video]');
    if (!hosts.length) return;
    injectCSS();
    Array.prototype.forEach.call(hosts, initHost);
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init);
  else init();
})(window, document);
