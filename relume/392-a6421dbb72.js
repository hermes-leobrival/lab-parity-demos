/* ==========================================================================
   relume-anim.js — motion layer for the Publish site (/publish-dev/*)
   One module. Waits for DOM ready, feature-detects, no-ops silently when a
   target is absent, and never lets one feature's failure take down another
   (each is wrapped). Re-runs itself on DOM growth, so content that arrives
   later inherits everything — see the rescan section at the bottom.

   Selector policy: Webflow's semantic classes are read ONCE here to stamp
   data-anim hooks; every CSS rule and every later lookup keys off the hook.
   Webflow structural classes that are unavoidable (they are the component's
   own state contract) are marked STRUCTURAL below.
   ========================================================================== */
(function () {
  'use strict';

  var THEME_KEY = 'relume-color-mode';   // same key the site-level script uses
  var DARK_CLASS = 'p-theme-dark';       // same class — one theme system, not two

  /* ---- Composer watermark strings: edit this array ---------------------- */
  var PLACEHOLDERS = [
    'Describe your business...',
    'Drop in your notes, brief or a URL...',
    "Tell Relume what you're building..."
  ];
  // The composer is the page's primary action, so it takes focus on load and
  // shows a live caret. preventScroll keeps the hero from jumping.
  var AUTOFOCUS_COMPOSER = true;
  var PLACEHOLDER_INTERVAL = 3000;  // Aceternity: 3s between strings
  var PLACEHOLDER_FADE = 300;       // Aceternity: 0.3s linear

  /* ---- Hover card placeholder content ----------------------------------
     Swap in real data later either by editing DEFAULT_PROFILE / PROFILES, or
     by putting data-hc-name / data-hc-handle / data-hc-bio / data-hc-meta /
     data-hc-avatar attributes on the avatar element itself — those win.      */
  var DEFAULT_PROFILE = {
    name: 'Relume member',
    role: 'Relume',
    bio: 'Placeholder bio. Swap this for real profile copy via the data-hc-* attributes or the PROFILES map.',
    meta: 'Joined 4 years ago'
  };
  var PROFILES = {
    'navbar': { name: 'Your account', role: 'Signed in', bio: 'Manage your projects, billing and workspace settings.', meta: '' }
  };
  // Pro badge glyph, exported from the NOVA design system. Applied as a mask so
  // it takes the badge's own text colour and stays right in both themes.
  var PRO_ICON = 'https://cdn.prod.website-files.com/6177739448baa66404ce1d9c/6a7c29dd3620683e02c3d59c_relume-hc-icon-pro.svg';
  // The team mark on staff avatars — the Avatar_v2 asset from the design file,
  // not a font glyph standing in for it.
  var TEAM_MARK = 'https://cdn.prod.website-files.com/6177739448baa66404ce1d9c/6a7c39f7d60da35820dd3054_relume-hc-team-mark.png';

  var reduced = function () {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };
  var coarse = function () {
    return window.matchMedia && window.matchMedia('(hover: none)').matches;
  };

  function each(list, fn) { Array.prototype.forEach.call(list || [], fn); }

  /* ---- Opt-in / opt-out vocabulary --------------------------------------
     Everything below also binds itself to the design system's own classes, so
     a new section built from existing components inherits its motion with no
     markup at all. data-relume-fx is the escape hatch for the cases the class
     names cannot express — a brand new component, or a one-off. Set it from
     the Designer's custom-attributes panel; no code change is needed.

       data-relume-fx="trail"        border trail around this container
       data-relume-fx="dither"       dither shader over the images inside
       data-relume-fx="text-effect"  per-character reveal of this text
       data-relume-fx="blur-fade"    blur + fade this container's children in
       data-relume-fx="grow"         hover grow / press shrink
       data-relume-fx="none"         opt this element and its subtree OUT

     Space separated, so data-relume-fx="trail dither" applies both.          */
  function fx(name) {
    return document.querySelectorAll('[data-relume-fx~="' + name + '"]');
  }
  function optedOut(el) {
    return !!(el && el.closest && el.closest('[data-relume-fx~="none"]'));
  }
  // Collect the class-driven targets and the opt-in ones as one list, minus
  // anything inside an opted-out subtree.
  function targets(selector, fxName) {
    var seen = [], out = [];
    var add = function (el) {
      if (seen.indexOf(el) !== -1 || optedOut(el)) return;
      seen.push(el); out.push(el);
    };
    if (selector) each(document.querySelectorAll(selector), add);
    if (fxName) each(fx(fxName), add);
    return out;
  }

  function safe(name, fn) {
    try { fn(); } catch (err) {
      if (window.console && console.warn) console.warn('[relume-anim] ' + name + ' skipped:', err);
    }
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* ======================================================================
     Dotted-link underline placement
     The moving dots have to land exactly where the browser paints the native
     dotted underline, or the hand-off on hover reads as the underline jumping
     down. An em-based offset cannot do that for both cases: an inline link's
     absolute child is measured from the font's content box (18px tall here),
     while a block footer link's is measured from the padding box — line-height
     plus 4px padding, 25.5px — so one shared value sits ~8px lower there.
     That was the "big gap" in the footer.
     So the offset is measured per link, from the text baseline, and written to
     a custom property the stylesheet reads.
     ====================================================================== */
  var UNDERLINE_OFFSET = 0.13;   // matches the native text-underline-offset: 13%
  var DOT_STRIP = 2;             // height of the dot strip, px
  var measureCtx = null;

  function placeDots(a) {
    var cs = window.getComputedStyle(a);
    var fs = parseFloat(cs.fontSize);
    if (!fs) return;

    // The text node's own rect is the font content box — unlike the element
    // box it is identical for inline and block links.
    var textNode = null;
    for (var n = a.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && n.textContent.trim()) { textNode = n; break; }
    }
    if (!textNode) return;
    var range = document.createRange();
    range.selectNodeContents(textNode);
    var tr = range.getBoundingClientRect();
    range.detach && range.detach();
    if (!tr.height) return;

    // Where the baseline sits inside that box comes from the font's own
    // ascent/descent rather than a guessed ratio.
    if (!measureCtx) {
      try { measureCtx = document.createElement('canvas').getContext('2d'); } catch (e) { return; }
    }
    if (!measureCtx) return;
    measureCtx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var m = measureCtx.measureText('Hxy');
    var asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
    if (!asc || !desc) return;                       // older engines keep the CSS default

    var baseline = tr.top + tr.height * (asc / (asc + desc));
    var underlineY = baseline + fs * UNDERLINE_OFFSET + (fs * 0.12) / 2;   // + half the native thickness
    var bottom = a.getBoundingClientRect().bottom - underlineY - DOT_STRIP / 2;
    a.style.setProperty('--ra-dot-bottom', bottom.toFixed(2) + 'px');
  }

  // force = re-measure everything (fonts swapped, viewport changed). Without
  // it only links that have never been measured are touched, which keeps a
  // rescan on a busy page from re-running canvas text metrics for every link
  // on the page each time something unrelated mutates.
  function placeAllDots(force) {
    each(document.querySelectorAll('a[data-anim-dotlink]'), function (a) {
      if (!force && a.style.getPropertyValue('--ra-dot-bottom')) return;
      safe('dotlink-place', function () { placeDots(a); });
    });
  }
  function placeAllDotsForced() { placeAllDots(true); }

  /* ======================================================================
     0. Hooks — stamp data-anim onto targets so nothing else selects on
        Webflow class names.
     ====================================================================== */
  function stampHooks() {
    // Buttons. EVERY .p-button gets motion regardless of colour variant —
    // is-ai ("Start for free"), is-blue, is-inverse ("Get Pro") and is-tertiary
    // all included, so no button in a row behaves differently from its
    // neighbour. Only the shape distinction matters here:
    //   icon-only -> square, gentler scale so a glyph cannot clip
    //   secondary -> outlined
    //   everything else -> filled
    // .p-button-link (the invisible overlay anchor) and .p-button-text (the
    // label) are children, not buttons, so they are never hooked — scaling
    // them as well would compound the transform.
    each(targets('.p-button.is-icon-only'), function (el) {
      el.setAttribute('data-anim', 'btn-icon');
    });
    each(targets('.p-button.is-secondary'), function (el) {
      if (!el.hasAttribute('data-anim')) el.setAttribute('data-anim', 'btn-secondary');
    });
    each(targets('.p-button'), function (el) {
      if (!el.hasAttribute('data-anim')) el.setAttribute('data-anim', 'btn-primary');
    });
    // Mirror the disabled state so CSS can suppress motion on it.
    each(document.querySelectorAll('[data-anim^="btn-"]'), function (el) {
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') {
        el.setAttribute('data-anim-disabled', 'true');
      }
    });

    // Dotted-underline links. .p-text-style-link already carries the pink
    // dotted underline; footer links get the same treatment on hover only.
    // Excluded: .has-badge (its badge would sit inside the underline), and the
    // social/tooltip icon links, which have no text to underline.
    each(targets('.p-text-style-link', 'dot-link'), function (el) {
      if (el.tagName === 'A') el.setAttribute('data-anim-dotlink', '');
    });
    each(targets('.p-footer_link:not(.has-badge)'), function (el) {
      el.setAttribute('data-anim-dotlink', '');
      el.setAttribute('data-dotlink-block', '');
    });
    placeAllDots();

    // The same press/grow on everything else that is clickable, via a separate
    // attribute so it can coexist with data-anim (dropdown items are already
    // stagger targets).
    each(targets(
      '.p-navbar_link, .navbar5_dropdown-toggle, .navbar5_dropdown-link, .p-showcase_card-likes',
      'grow'
    ), function (el) {
      el.setAttribute('data-anim-grow', '');
    });

    // Dropdowns. STRUCTURAL: .w-dropdown / .w-dropdown-list / w--open are
    // Webflow's own open-state contract — the whole point of task 5 is to
    // animate off them, so they cannot be replaced by a private hook.
    each(targets('.w-dropdown .w-dropdown-list'), function (list) {
      list.setAttribute('data-anim', 'dropdown-list');
      var group = list.querySelector('.navbar5_dropdown-link-list') || list;
      each(group.children, function (child) {
        child.setAttribute('data-anim', 'dropdown-item');
      });
    });

    // Composers. There is more than one on the page (hero and final CTA) and
    // they share id="brief", so getElementById would only ever reach the
    // first — every one is collected by class instead.
    each(targets('.p-composer_form-input', 'composer'), function (input) {
      input.setAttribute('data-anim', 'composer-input');
      var form = input.closest('form') || input.parentElement;
      if (form) form.setAttribute('data-anim', 'composer-form');
    });
  }

  /* ======================================================================
     1. Composer watermark — cycling placeholder
        A real overlay, not the input value: the field is never written to, so
        Webflow validation and the GET submit to relume.io are untouched.
        The host is a <textarea>, whose native placeholder cannot be animated,
        so an absolutely positioned overlay inside the form is used.
     ====================================================================== */
  function initComposer() {
    if (!PLACEHOLDERS.length) return;
    each(document.querySelectorAll('[data-anim="composer-input"]'), function (input) {
      var form = input.closest('[data-anim="composer-form"]') || input.closest('form');
      if (!form) return;
      // Idempotent: a rescan must not stack a second watermark on a composer
      // that already has one.
      if (form.querySelector('[data-anim="watermark"]')) return;
      // Only the hero composer takes focus on load. Focusing the one in the
      // final CTA as well is impossible anyway (one active element), and
      // whichever ran last would win — which would be the wrong one.
      var takesFocus = !!input.closest('.p-hero-header_component');
      safe('composer:' + (takesFocus ? 'hero' : 'cta'), function () {
        setupComposer(input, form, takesFocus);
      });
    });
  }

  function setupComposer(input, form, takesFocus) {

    var native = input.getAttribute('placeholder') || '';
    // Screen readers lose nothing: the original placeholder becomes the label.
    if (native && !input.getAttribute('aria-label')) input.setAttribute('aria-label', native);
    input.setAttribute('placeholder', '');

    var wrap = document.createElement('div');
    wrap.setAttribute('data-anim', 'watermark');
    wrap.setAttribute('aria-hidden', 'true');   // decorative; aria-label carries the meaning

    // Two stacked lines so the outgoing string can leave while the next one
    // arrives, exactly as AnimatePresence does in the reference.
    var lines = [document.createElement('div'), document.createElement('div')];
    each(lines, function (line) {
      line.setAttribute('data-anim', 'watermark-line');
      line.setAttribute('data-state', 'below');
      wrap.appendChild(line);
    });

    // Stand-in caret for the empty, focused state. CSS cannot set caret width,
    // so the native one is hidden and this 1.5px bar takes its place; it lives
    // inside the watermark, which is already parked on the text origin and
    // already disappears the moment anything is typed.
    var caret = document.createElement('div');
    caret.setAttribute('data-anim', 'caret');
    caret.setAttribute('aria-hidden', 'true');
    wrap.appendChild(caret);

    form.appendChild(wrap);

    function setFocused(on) {
      wrap.setAttribute('data-focused', on ? 'true' : 'false');
      // Only suppress the native caret while ours is the one on screen.
      if (on && !input.value) input.setAttribute('data-caret', 'custom');
      else input.removeAttribute('data-caret');
    }
    input.addEventListener('focus', function () { setFocused(true); });
    input.addEventListener('blur', function () { setFocused(false); });

    // Match the textarea's own text box so there is zero visual shift from the
    // native placeholder, and zero layout shift between strings.
    function sync() {
      var cs = window.getComputedStyle(input);
      wrap.style.top = (input.offsetTop + parseFloat(cs.paddingTop || 0)) + 'px';
      wrap.style.left = (input.offsetLeft + parseFloat(cs.paddingLeft || 0)) + 'px';
      wrap.style.width = (input.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0)) + 'px';
      wrap.style.height = cs.lineHeight;
      wrap.style.font = cs.font;
      wrap.style.fontSize = cs.fontSize;
      wrap.style.fontFamily = cs.fontFamily;
      wrap.style.fontWeight = cs.fontWeight;
      wrap.style.lineHeight = cs.lineHeight;
      wrap.style.letterSpacing = cs.letterSpacing;
      wrap.style.textAlign = cs.textAlign;
    }

    var index = 0;
    var front = 0;
    var timer = null;

    function show(i, animate) {
      var incoming = lines[front];
      var outgoing = lines[1 - front];
      incoming.textContent = PLACEHOLDERS[i];
      if (!animate) {
        outgoing.setAttribute('data-state', 'below');
        incoming.setAttribute('data-state', 'enter');
        return;
      }
      // Park the incoming line below with no transition, then release it, so
      // the browser has a real start value to animate from.
      incoming.style.transition = 'none';
      incoming.setAttribute('data-state', 'below');
      /* force style flush */ void incoming.offsetHeight;
      incoming.style.transition = '';
      incoming.setAttribute('data-state', 'enter');
      outgoing.setAttribute('data-state', 'above');
    }

    function tick() {
      index = (index + 1) % PLACEHOLDERS.length;
      front = 1 - front;
      show(index, true);
    }

    function start() {
      if (timer || input.value) return;
      wrap.setAttribute('data-hidden', 'false');
      sync();
      show(index, false);
      // Reduced motion: show one string, never cycle. Cycling text is itself
      // motion, so the honest degradation is to stop moving entirely.
      if (reduced()) return;
      timer = window.setInterval(tick, PLACEHOLDER_INTERVAL + PLACEHOLDER_FADE);
    }

    function stop() {
      if (timer) { window.clearInterval(timer); timer = null; }
      wrap.setAttribute('data-hidden', 'true');
    }

    function sync_state() {
      if (input.value) stop(); else start();
      // Hand the caret back to the browser as soon as there is real text.
      setFocused(document.activeElement === input);
    }
    input.addEventListener('input', sync_state);
    // Autofill and programmatic changes do not fire input reliably.
    input.addEventListener('change', sync_state);

    window.addEventListener('resize', sync);
    if (window.ResizeObserver) { try { new ResizeObserver(sync).observe(input); } catch (e) {} }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sync).catch(function () {});

    if (input.value) stop(); else start();

    // Focus the composer so the caret is already blinking and the visitor can
    // type straight away. preventScroll stops the browser scrolling the hero
    // out of frame; the watermark keeps cycling because it only stops on input,
    // not on focus. Skipped on touch, where focusing would throw up the
    // keyboard and cover the page before anyone asked for it.
    if (AUTOFOCUS_COMPOSER && takesFocus && !coarse()) {
      try { input.focus({ preventScroll: true }); }
      catch (e) { /* older browsers: no options arg — not worth a scroll jump */ }
    }
    // Set the caret state from the actual focus, not from the focus event: a
    // programmatic focus() does not reliably dispatch one when the window
    // itself is unfocused, which left the caret hidden on load.
    setFocused(document.activeElement === input);
  }

  /* ======================================================================
     2. Day/night theme toggle
        Drives the SAME switch the site already uses (body.p-theme-dark +
        html[data-theme] + the same localStorage key) — no parallel system.
        The site-level footer script also binds this element; its handler is
        suppressed on this page only, from the capture phase, so the two
        cannot double-toggle each other. Nothing site-wide is edited.
     ====================================================================== */
  function initTheme() {
    var toggle = document.getElementById('p-mode-toggle') || document.querySelector('.mode-switch_wrapper');
    if (!toggle) return;

    // The wrapper carries aria-hidden="true", which hides the control from
    // assistive tech entirely. The inner anchor is already focusable, so it
    // becomes the button and the wrapper stops hiding it.
    toggle.removeAttribute('aria-hidden');
    var control = toggle.querySelector('a, button') || toggle;
    if (control === toggle && !toggle.hasAttribute('tabindex')) {
      toggle.setAttribute('tabindex', '0');
    }
    control.setAttribute('role', 'button');

    function isDark() { return document.body.classList.contains(DARK_CLASS); }

    function paint() {
      var dark = isDark();
      var icon = toggle.querySelector('.p-icon');
      if (icon) icon.textContent = dark ? 'icon-mode-dark' : 'icon-mode-light';
      control.setAttribute('aria-pressed', dark ? 'true' : 'false');
      control.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    }

    function apply(mode) {
      var dark = mode === 'dark';
      document.body.classList.toggle(DARK_CLASS, dark);
      document.documentElement.setAttribute('data-theme', mode);
      paint();
      try { localStorage.setItem(THEME_KEY, mode); } catch (e) {}
    }

    function setTheme(mode) {
      // Animate UI theme-toggler: View Transition + clip-path wipe, with an
      // instant, fully-applied fallback everywhere it is unsupported.
      if (reduced() || typeof document.startViewTransition !== 'function') {
        apply(mode);
        return;
      }
      var vt;
      try { vt = document.startViewTransition(function () { apply(mode); }); }
      catch (e) { apply(mode); return; }

      vt.ready.then(function () {
        document.documentElement.animate(
          { clipPath: ['inset(0 100% 0 0)', 'inset(0 0 0 0)'] },
          { duration: 700, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' }
        );
      }).catch(function () { /* transition skipped — theme is already applied */ });
    }

    function activate(event) {
      event.preventDefault();
      setTheme(isDark() ? 'light' : 'dark');
    }

    // Capture phase on document: this runs before any listener bound on the
    // toggle itself, so stopping propagation here reliably retires the
    // site-level handler without touching site-level code or the DOM node.
    document.addEventListener('click', function (event) {
      if (!event.target || !event.target.closest) return;
      if (!event.target.closest('#p-mode-toggle, .mode-switch_wrapper')) return;
      event.stopImmediatePropagation();
      activate(event);
    }, true);

    // Anchors fire click on Enter but not on Space.
    control.addEventListener('keydown', function (event) {
      if (event.key === ' ' || event.key === 'Spacebar') { activate(event); }
    });

    paint();
  }

  /* ======================================================================
     3. Avatar hover cards
        Generated from a JS template rather than built as a Webflow component:
        the avatars live inside three different component definitions and a CMS
        collection list, so a component would have to be inserted (and kept in
        sync) in several places, and inserting markup into CMS items risks
        shifting their layout. One template keeps structure in one file and
        leaves the Designer untouched.
        Positioning is a ~30-line flip + clamp, so Floating UI is not warranted.
     ====================================================================== */
  var OPEN_DELAY = 700;   // Radix default
  var CLOSE_DELAY = 300;  // Radix default
  var SIDE_OFFSET = 8;

  /* Per-group open delay.
     Radix's 700 is tuned for dense inline links, where an accidental open is
     expensive. The footer roster is ~24 deliberate targets in a row and the
     same wait reads as lag — worse, every avatar charges it again, so scanning
     the team is 700ms per face. Scoped by the data-hc-key the binder already
     stamps ('footer', 'navbar'); everything unkeyed keeps the Radix default.

     Resolution order, cheapest override first:
       1. data-hc-delay on the trigger, or on any ancestor of it
       2. OPEN_DELAY_BY_KEY[data-hc-key]
       3. OPEN_DELAY
     The attribute is there so a value can be tried from the Designer's
     custom-attributes panel without shipping a new build of this file. It is
     read at hover time, not at bind time, so it also applies to avatars wired
     up by a later pass (CMS load, tab switch). */
  var OPEN_DELAY_BY_KEY = { footer: 200 };

  function hcDelayAttr(el) {
    var host = el.hasAttribute('data-hc-delay')
      ? el
      : (el.closest ? el.closest('[data-hc-delay]') : null);
    if (!host) return null;
    var n = parseInt(host.getAttribute('data-hc-delay'), 10);
    return isNaN(n) ? null : Math.max(0, n);
  }

  function openDelayFor(el) {
    var attr = hcDelayAttr(el);
    if (attr !== null) return attr;
    var key = el.getAttribute('data-hc-key');
    var byKey = key && OPEN_DELAY_BY_KEY.hasOwnProperty(key)
      ? OPEN_DELAY_BY_KEY[key]
      : null;
    return typeof byKey === 'number' ? byKey : OPEN_DELAY;
  }

  var hcBind = null;   // set once the single shared card exists

  function initHoverCards() {
    // An avatar's frame (ring, badge, crop) lives on its wrapper, so the
    // wrapper is what hovers and what grows — scaling the <img> alone slides
    // the photo out from under its own frame. Only promote to the wrapper when
    // it actually hugs the image; .p-navbar_avatar sits in the whole actions
    // bar, and growing that would take the adjacent buttons with it.
    var FRAME_MAX = 72;   // an avatar frame is a small box, never a layout region

    function frameFor(img) {
      var p = img.parentElement;
      if (!p) return img;
      var pw = p.offsetWidth, ph = p.offsetHeight;
      // Nothing laid out yet (the auth-gated navbar avatar sits in a hidden
      // block) — promoting there would scale the whole actions bar, taking
      // Log in and Start for free with it.
      if (!pw || !ph) return img;

      // The parent's own size is the test, not the image's. Showcase portraits
      // are lazy-loaded and still report 0x0 well after they scroll into view,
      // so measuring the image left them stuck on the <img> and the container
      // fill and grow never applied. The image is only used as a secondary
      // check when it has actually been measured.
      var iw = img.offsetWidth, ih = img.offsetHeight;
      var frameSized = pw <= FRAME_MAX && ph <= FRAME_MAX;
      var hugsImage = (iw && ih) ? (pw <= iw * 1.5 + 8 && ph <= ih * 1.5 + 8) : true;
      return (frameSized && hugsImage) ? p : img;
    }

    var selectors = [
      ['.p-navbar_avatar', 'navbar'],
      ['.p-showcase_profile-image', null],
      ['.p-showcase-hero_avatar-image', null],
      // Footer staff. Their markup already holds the real person — the dead
      // tooltip block below the photo — so the card is populated from it.
      ['.p-footer_member-photo', 'footer'],
      // The designer's name is a link to the same person as the avatar beside
      // it, so it opens the same card.
      ['.p-showcase_card-designer a', null]
    ];

    var triggers = [];
    each(selectors, function (pair) {
      each(targets(pair[0], pair[1] === null ? 'hovercard' : null), function (node) {
        var el = node.tagName === 'IMG' ? frameFor(node) : node;
        if (el.getAttribute('data-anim') === 'hovercard-trigger') return;
        el.setAttribute('data-anim', 'hovercard-trigger');
        el.setAttribute('data-anim-grow', '');   // same subtle grow as the buttons
        if (pair[1]) el.setAttribute('data-hc-key', pair[1]);
        // The footer sits at the bottom of the page, so its card belongs above.
        if (pair[1] === 'footer') el.setAttribute('data-hc-side', 'top');
        triggers.push(el);
      });
    });

    // A later pass (CMS load, tab switch, a section added in the Designer)
    // only ever brings NEW avatars. The card, its listeners and its timers are
    // built once and reused — building a second card would leave two of them
    // fighting over the same trigger.
    if (hcBind) { each(triggers, hcBind); return; }
    if (!triggers.length) return;

    var card = document.createElement('div');
    card.setAttribute('data-anim', 'hovercard');
    card.setAttribute('role', 'tooltip');
    card.id = 'ra-hovercard';
    card.hidden = true;
    // Structure mirrors the NOVA "Profile Preview" component (10441:265705):
    // head row (avatar + team badge, name + Pro badge, role, link button),
    // then bio, then the joined line.
    card.innerHTML =
      '<div class="ra-hc__head">' +
        '<div class="ra-hc__person">' +
          '<div class="ra-hc__avatar">' +
            '<img class="ra-hc__avatar-img" alt="" />' +
            '<span class="ra-hc__avatar-badge"><img alt="" /><span class="p-icon"></span></span>' +
          '</div>' +
          '<div class="ra-hc__meta">' +
            '<span class="ra-hc__name"></span>' +
            '<div class="ra-hc__role"></div>' +
          '</div>' +
        '</div>' +
        '<a class="ra-hc__link" target="_blank" rel="noopener noreferrer"><span class="p-icon">icon-link</span></a>' +
      '</div>' +
      '<p class="ra-hc__bio"></p>' +
      // Footer row (10443:265865): joined date left, Pro badge right.
      '<div class="ra-hc__meta-row">' +
        '<p class="ra-hc__joined"></p>' +
        '<span class="ra-hc__pro"><i class="ra-hc__pro-icon" aria-hidden="true"></i>Pro</span>' +
      '</div>';
    var proIcon = card.querySelector('.ra-hc__pro-icon');
    proIcon.style.webkitMaskImage = 'url("' + PRO_ICON + '")';
    proIcon.style.maskImage = 'url("' + PRO_ICON + '")';

    document.body.appendChild(card);

    var openTimer = null, closeTimer = null, active = null, overCard = false;

    // The demo projects on the homepage are built by Relume staff, and those
    // same people are already on the page in the footer roster with their real
    // role, bio, socials and joined date. Matching a card's designer against
    // that roster gives the demo cards the identical profile the footer shows —
    // one card, one data source — instead of the "Site designer" placeholder.
    // Built on first hover so the CMS roster has certainly rendered.
    var rosterIndex = null;
    function rosterMember(name) {
      if (!name) return null;
      if (!rosterIndex) {
        rosterIndex = {};
        each(document.querySelectorAll('.p-footer_team-member'), function (m) {
          var n = m.querySelector('.p-footer_member_tooltip_card-wrapper .text-size-small');
          var k = n && n.textContent.trim().toLowerCase();
          if (k && !rosterIndex[k]) rosterIndex[k] = m;
        });
      }
      return rosterIndex[name.trim().toLowerCase()] || null;
    }

    // A showcase card already carries the real person: their name is the link
    // text and their face is the profile image. Read those rather than showing
    // "Relume member" next to a photo of someone specific.
    function fromCard(el) {
      var card = el.closest('.p-showcase_card');
      if (!card) return {};

      // Hovering the team mark itself is a different subject: the team is
      // promoted to the main avatar and the card describes the account, not
      // the person who happens to sit behind it.
      if (el === card.querySelector('.p-showcase-hero_avatar-image') ||
          el.querySelector && el.querySelector('.p-showcase-hero_avatar-image')) {
        var badge = card.querySelector('.p-showcase-hero_avatar-image');
        return {
          name: (badge && badge.getAttribute('alt')) || 'Team account',
          role: 'Team Account',
          meta: 'Relume team account',
          avatar: badge ? (badge.currentSrc || badge.src) : undefined,
          teamAvatar: '',      // it IS the team — nothing to overlay
          links: []
        };
      }

      var link = card.querySelector('.p-showcase_card-designer a');
      var photo = card.querySelector('.p-showcase_profile-image');
      var team = card.querySelector('.p-showcase-hero_avatar-image');
      var title = card.querySelector('.p-showcase_card-designer h3');
      var name = link && link.textContent.trim();
      var href = link && link.getAttribute('href');

      // Staff member? Show the footer's profile verbatim, keeping only the
      // card's own imagery — the coloured tile and the team mark it already
      // renders are the same treatment, and re-reading them avoids a flash of
      // a different photo between the two surfaces.
      var mate = rosterMember(name);
      if (mate) {
        var staff = fromFooter(mate);
        if (photo) staff.avatar = photo.currentSrc || photo.src;
        if (team) staff.teamAvatar = team.currentSrc || team.src;
        return staff;
      }

      return {
        name: name || undefined,
        role: 'Site designer',
        meta: title ? 'Built ' + title.textContent.trim() : undefined,
        avatar: photo ? (photo.currentSrc || photo.src) : undefined,
        teamAvatar: team ? (team.currentSrc || team.src) : undefined,
        links: href && href !== '#' ? [{ href: href, label: 'their profile' }] : []
      };
    }

    // Footer staff already ship their own details in a tooltip block that never
    // renders (its Webflow interaction is registered but never fires, so the
    // markup just sits there at display:none). Reading it means the card shows
    // the real person — name, role and socials — with nothing to maintain.
    // "Joined 4 years ago" from the Teams collection's Joined date. Years and
    // months only — days and time are deliberately dropped, and a month is
    // counted whole so "3 years 11 months" never rounds up to 4 years.
    function joinedLabel(node) {
      var raw = node && node.textContent.trim();
      if (!raw) return '';
      var then = new Date(raw);
      if (isNaN(then.getTime())) return '';
      var now = new Date();
      var months = (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
      if (now.getDate() < then.getDate()) months -= 1;   // month not yet complete
      if (months < 0) return '';
      var y = Math.floor(months / 12), m = months % 12;
      var unit = function (n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); };
      if (y && m) return 'Joined ' + unit(y, 'year') + ', ' + unit(m, 'month') + ' ago';
      if (y) return 'Joined ' + unit(y, 'year') + ' ago';
      if (m) return 'Joined ' + unit(m, 'month') + ' ago';
      return 'Joined this month';
    }

    function fromFooter(el) {
      var member = el.closest('.p-footer_team-member');
      if (!member) return {};
      var lines = member.querySelectorAll('.p-footer_member_tooltip_card-wrapper .text-size-small');
      var name = lines[0] && lines[0].textContent.trim();
      var role = lines[1] && lines[1].textContent.trim();
      return {
        name: name || undefined,
        // The design's second line is role plus affiliation ("Co-founder · Relume").
        role: role ? role + ' · Relume' : 'Relume',
        meta: joinedLabel(member.querySelector('[data-hc-field="joined"]')),
        // Everyone in the roster is on a Relume account, so the badge shows.
        pro: true,
        // Bio comes from the Teams collection's Description field, bound to a
        // hidden element inside the tooltip block. Left undefined when absent
        // so the shared default copy still shows rather than a blank line.
        bio: (function () {
          var b = member.querySelector('[data-hc-field="bio"]');
          var t = b && b.textContent.trim();
          return t || undefined;
        })(),
        // Everyone in the roster is Relume staff, so they all carry the mark.
        teamAvatar: TEAM_MARK,
        avatar: (function () { var i = member.querySelector('.p-footer_member-photo'); return i ? (i.currentSrc || i.src) : undefined; })(),
        links: [].map.call(member.querySelectorAll('.p-footer_member_tooltip-link'), function (a) {
          return { href: a.href, label: /linkedin/i.test(a.href) ? 'LinkedIn' : /(^|\.)x\.com|twitter/i.test(a.href) ? 'X' : 'Link' };
        })
      };
    }

    function dataFor(el) {
      var key = el.getAttribute('data-hc-key');
      var base = (key && PROFILES[key]) || DEFAULT_PROFILE;
      var card = key === 'footer' ? fromFooter(el) : fromCard(el);
      // The trigger may be an avatar's wrapper rather than the <img> itself,
      // so fall back to whichever image sits inside it.
      var ownImg = el.tagName === 'IMG' ? el : el.querySelector('img');

      // Carry the source container's fill onto the card. Team photos are
      // transparent cut-outs sitting on a coloured tile (#98eafd on the footer
      // roster, the same token the design names) — without it the portrait
      // floats on the card. Anything on a transparent container, like a
      // showcase logo, gets nothing, which is what stops the blue box.
      var frameFill = (function () {
        var bg = getComputedStyle(el).backgroundColor;
        if (!bg) return '';
        var t = bg.replace(/\s/g, '');
        return (t === 'transparent' || /,0\)$/.test(t)) ? '' : bg;
      })();
      return {
        name: el.getAttribute('data-hc-name') || card.name || base.name,
        role: el.getAttribute('data-hc-role') || card.role || base.role,
        bio: el.getAttribute('data-hc-bio') || (card.bio !== undefined ? card.bio : base.bio),
        meta: el.getAttribute('data-hc-meta') || card.meta || base.meta,
        avatar: el.getAttribute('data-hc-avatar') || card.avatar ||
                (ownImg ? ownImg.currentSrc || ownImg.src : ''),
        teamAvatar: el.getAttribute('data-hc-team') ||
                    (card.teamAvatar !== undefined ? card.teamAvatar : '') || '',
        teamGlyph: el.getAttribute('data-hc-team-glyph') || card.teamGlyph || '',
        frameFill: el.getAttribute('data-hc-frame') || frameFill,
        pro: el.hasAttribute('data-hc-pro') || !!card.pro,
        links: card.links || []
      };
    }

    function show(node, on) { node.style.display = on ? '' : 'none'; }

    function fill(el) {
      var d = dataFor(el);

      var img = card.querySelector('.ra-hc__avatar-img');
      if (d.avatar) { img.src = d.avatar; show(img, true); } else { show(img, false); }
      img.style.backgroundColor = d.frameFill || '';

      // The 20px overlapping badge is the team mark: a company avatar where one
      // exists (showcase cards), otherwise the Relume glyph for staff.
      var badge = card.querySelector('.ra-hc__avatar-badge');
      var badgeImg = badge.querySelector('img');
      var badgeGlyph = badge.querySelector('.p-icon');
      if (d.teamAvatar) {
        badgeImg.src = d.teamAvatar;
        show(badgeImg, true); show(badgeGlyph, false); show(badge, true);
        badge.removeAttribute('data-glyph');
      } else if (d.teamGlyph) {
        badgeGlyph.textContent = d.teamGlyph;
        show(badgeImg, false); show(badgeGlyph, true); show(badge, true);
        badge.setAttribute('data-glyph', 'true');
      } else {
        show(badge, false);
      }

      card.querySelector('.ra-hc__name').textContent = d.name;
      card.querySelector('.ra-hc__role').textContent = d.role || '';
      show(card.querySelector('.ra-hc__role'), !!d.role);

      // No data source marks anyone as Pro yet, so the badge stays off unless
      // a trigger opts in with data-hc-pro.
      show(card.querySelector('.ra-hc__pro'), !!d.pro);

      var bio = card.querySelector('.ra-hc__bio');
      bio.textContent = d.bio || '';
      show(bio, !!d.bio);

      var joined = card.querySelector('.ra-hc__joined');
      joined.textContent = d.meta || '';
      show(joined, !!d.meta);
      // The footer row exists for either child; hide it only when both are out.
      show(card.querySelector('.ra-hc__meta-row'), !!(d.meta || d.pro));

      // One link button, per the design. The first link the source offered
      // wins; with none, the button is not rendered at all.
      var link = card.querySelector('.ra-hc__link');
      var primary = d.links && d.links[0];
      if (primary) {
        link.href = primary.href;
        link.setAttribute('aria-label', d.name + ' on ' + primary.label);
        show(link, true);
      } else {
        link.removeAttribute('href');
        show(link, false);
      }

      card.setAttribute('aria-label', d.name);
    }

    function place(el) {
      var t = el.getBoundingClientRect();
      // offsetWidth/Height, not getBoundingClientRect: the card is measured
      // while it still carries the scale(0.5) start state, and a rect would
      // report the *scaled* box — half-size collision maths and a card that
      // never flips when it should.
      var cw = card.offsetWidth;
      var ch = card.offsetHeight;
      var wantTop = el.getAttribute('data-hc-side') === 'top';
      var roomAbove = t.top - SIDE_OFFSET - ch > 8;
      var roomBelow = t.bottom + SIDE_OFFSET + ch < window.innerHeight - 8;
      // Honour a declared side (footer avatars open upwards), but still flip if
      // that side has no room — a card off-screen is worse than one below.
      var side = wantTop ? (roomAbove || !roomBelow ? 'top' : 'bottom')
                         : (!roomBelow && roomAbove ? 'top' : 'bottom');
      var top = side === 'top' ? t.top - SIDE_OFFSET - ch : t.bottom + SIDE_OFFSET;
      var left = t.left + t.width / 2 - cw / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - cw - 8));
      card.style.top = Math.round(top) + 'px';
      card.style.left = Math.round(left) + 'px';
      card.style.transformOrigin = side === 'bottom' ? 'top center' : 'bottom center';
      card.setAttribute('data-side', side);
    }

    function open(el) {
      active = el;
      fill(el);
      card.hidden = false;
      card.style.visibility = 'hidden';
      place(el);                      // measure with content in place
      card.style.visibility = '';
      void card.offsetHeight;         // flush so the enter has a start value
      card.setAttribute('data-state', 'open');

      // The avatar is fetched lazily, so the card can grow taller right after
      // it is placed. A card flipped above its trigger would then be measured
      // short and end up overlapping it — re-place once layout settles.
      // offsetWidth/Height are layout values, so measuring mid-scale is safe.
      requestAnimationFrame(function () { if (active === el) place(el); });
      var avatar = card.querySelector('.ra-hc__avatar');
      if (avatar && avatar.src && !avatar.complete) {
        avatar.addEventListener('load', function () { if (active === el) place(el); }, { once: true });
      }

      var host = el.closest('a, button') || el;
      host.setAttribute('aria-describedby', card.id);
    }

    function close() {
      if (!active) return;
      var host = active.closest('a, button') || active;
      host.removeAttribute('aria-describedby');
      card.removeAttribute('data-state');
      active = null;
      var hide = function () { if (!active) card.hidden = true; };
      if (reduced()) hide(); else window.setTimeout(hide, 380);
    }

    function scheduleOpen(el) {
      window.clearTimeout(closeTimer);
      window.clearTimeout(openTimer);
      openTimer = window.setTimeout(function () { open(el); }, openDelayFor(el));
    }
    function scheduleClose() {
      window.clearTimeout(openTimer);
      window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(function () { if (!overCard) close(); }, CLOSE_DELAY);
    }

    function bindTrigger(el) {
      var host = el.closest('a, button') || el;
      if (host === el && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');

      if (!coarse()) {
        el.addEventListener('mouseenter', function () { scheduleOpen(el); });
        el.addEventListener('mouseleave', scheduleClose);
      } else {
        // Touch: a long press opens the card. A normal tap is never
        // intercepted, so a profile link still navigates.
        var pressTimer = null, opened = false;
        el.addEventListener('pointerdown', function (ev) {
          if (ev.pointerType === 'mouse') return;
          opened = false;
          pressTimer = window.setTimeout(function () { opened = true; open(el); }, 500);
        });
        var cancel = function () { window.clearTimeout(pressTimer); };
        el.addEventListener('pointerup', cancel);
        el.addEventListener('pointercancel', cancel);
        el.addEventListener('pointermove', cancel);
        el.addEventListener('click', function (ev) {
          if (opened) { ev.preventDefault(); ev.stopPropagation(); opened = false; }
        });
      }

      host.addEventListener('focus', function () { scheduleOpen(el); });
      host.addEventListener('blur', scheduleClose);
    }

    each(triggers, bindTrigger);
    hcBind = bindTrigger;   // later passes reuse this card and just wire new avatars

    card.addEventListener('mouseenter', function () { overCard = true; window.clearTimeout(closeTimer); });
    card.addEventListener('mouseleave', function () { overCard = false; scheduleClose(); });

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && active) { window.clearTimeout(openTimer); close(); }
    });
    // A card pinned to fixed coordinates must not drift away from its trigger.
    window.addEventListener('scroll', function () { if (active) place(active); }, { passive: true });
    window.addEventListener('resize', function () { if (active) place(active); });
    // Touch: tapping elsewhere dismisses.
    document.addEventListener('pointerdown', function (ev) {
      if (!active) return;
      if (card.contains(ev.target) || active.contains(ev.target) || ev.target === active) return;
      close();
    }, true);
  }

  /* ======================================================================
     6. Motion-Primitives TextEffect — per-character reveal
        Ported from their registry source: stagger 0.03s per character,
        0.3s per segment, revealed on scroll rather than on mount because
        these taglines run the whole length of the page.
     ====================================================================== */
  var CHAR_STAGGER = 0.03;   // defaultStaggerTimes.char
  var BLUR_STAGGER = 0.05;   // defaultContainerVariants staggerChildren

  // One observer for everything that reveals, so a long page does not end up
  // with dozens of them. Reveal is one-way: once seen, it stays.
  var revealObserver = ('IntersectionObserver' in window)
    ? new IntersectionObserver(function (entries, obs) {
        each(entries, function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute('data-state', 'visible');
          obs.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.01 })
    : null;

  function reveal(el) {
    if (!revealObserver) { el.setAttribute('data-state', 'visible'); return; }
    revealObserver.observe(el);
  }

  // Safety net. These effects start their targets at opacity 0, so anything
  // that arms but never receives its intersection callback would stay
  // invisible — an element parked inside a collapsed tab or a variant that is
  // display:none at init never intersects anything. A few seconds in, reveal
  // whatever is on screen and still waiting. Content is never left hidden
  // because an observer did not fire.
  function revealSafetyNet() {
    var sweep = function () {
      each(document.querySelectorAll('[data-anim="text-effect"]:not([data-state]), [data-anim="blur-fade"]:not([data-state])'), function (el) {
        if (el.offsetParent === null) return;                 // genuinely hidden — leave it armed
        if (el.getBoundingClientRect().top > window.innerHeight) return;  // still below the fold
        el.setAttribute('data-state', 'visible');
      });
    };
    window.setTimeout(sweep, 2500);
    window.addEventListener('load', function () { window.setTimeout(sweep, 400); });
  }

  function initTextEffect() {
    var nodes = targets('.p-tagline-large', 'text-effect');
    if (!nodes.length) return;

    each(nodes, function (el) {
      if (el.getAttribute('data-anim') === 'text-effect') return;

      // Large taglines only. .p-tagline-large is the base class that every
      // size variant builds on, so the small (10px footer column headings)
      // and xlarge (17px) variants carry it too — matching on it alone swept
      // them in. Written as "any other p-tagline- size class disqualifies it"
      // so a future variant is excluded without another edit here.
      // An explicit data-relume-fx="text-effect" is a deliberate choice and
      // overrides the size filter.
      var explicit = el.matches('[data-relume-fx~="text-effect"]');
      var isOtherSize = !explicit && [].some.call(el.classList, function (c) {
        return c.indexOf('p-tagline-') === 0 && c !== 'p-tagline-large';
      });
      if (isOtherSize) return;

      // Only plain-text taglines are split; anything carrying markup is left
      // alone rather than having its structure rebuilt underneath it.
      if (el.children.length) return;
      var text = el.textContent;
      if (!text || !text.trim()) return;

      el.setAttribute('data-anim', 'text-effect');

      // Reduced motion: no split, no reveal — the text simply stays as it is.
      if (reduced()) { el.setAttribute('data-state', 'visible'); return; }

      // The split is invisible to assistive tech: the element keeps the full
      // string as its label and the per-character spans are hidden from it.
      el.setAttribute('aria-label', text.trim());

      var frag = document.createDocumentFragment();
      var index = 0;
      // Split on whitespace but keep it, so spacing survives the rebuild.
      each(text.split(/(\s+)/), function (chunk) {
        if (!chunk) return;
        var word = document.createElement('span');
        word.className = 'ra-word';
        word.setAttribute('aria-hidden', 'true');
        each(chunk.split(''), function (ch) {
          var c = document.createElement('span');
          c.className = 'ra-char';
          c.textContent = ch;
          c.style.transitionDelay = (index * CHAR_STAGGER).toFixed(3) + 's';
          index++;
          word.appendChild(c);
        });
        frag.appendChild(word);
      });

      el.textContent = '';
      el.appendChild(frag);
      reveal(el);
    });
  }

  /* ======================================================================
     7. Blur fade — hero elements
        Same "blur" preset values as the TextEffect port (opacity + a 12px
        blur), applied per element. The tagline block is skipped: it is already
        animating character by character, and running both would fight.
     ====================================================================== */
  function initBlurFade() {
    // Any hero on any page, plus anything opted in from the Designer. Both go
    // through the same routine, so a new section behaves like the hero does.
    each(targets('.p-hero-header_component', 'blur-fade'), function (host) {
      safe('blur-fade:group', function () { blurFadeGroup(host); });
    });
  }

  function blurFadeGroup(host) {
    // The hero's real content blocks sit under the max-width wrapper.
    var group = host.querySelector('.p-max-width-xlarge') || host.firstElementChild || host;
    var items = [];
    each(group.children, function (child) {
      if (child.querySelector('.p-tagline-large') || child.classList.contains('p-tagline-large')) return;
      // Already armed by an earlier pass — re-stamping would re-observe it and
      // stack a second transitionend listener.
      if (child.getAttribute('data-anim') === 'blur-fade') return;
      items.push(child);
    });
    if (!items.length) return;

    each(items, function (el, i) {
      el.setAttribute('data-anim', 'blur-fade');
      if (reduced()) { el.setAttribute('data-state', 'visible'); return; }
      el.style.transitionDelay = (i * BLUR_STAGGER).toFixed(3) + 's';
      // Drop the filter once it has served its purpose — a lingering
      // filter:blur(0) still creates a stacking and containing block.
      el.addEventListener('transitionend', function (ev) {
        if (ev.propertyName === 'filter') el.setAttribute('data-done', 'true');
      });
      reveal(el);
    });
  }

  /* ======================================================================
     10. Border trail on the composer
     ====================================================================== */
  function initBorderTrail() {
    each(targets('[data-anim="composer-form"]', 'trail'), function (host) {
      if (host.querySelector('[data-anim="trail-mask"]')) return;
      host.setAttribute('data-anim-trail', 'on');
      var mask = document.createElement('div');
      mask.setAttribute('data-anim', 'trail-mask');
      mask.setAttribute('aria-hidden', 'true');
      var trail = document.createElement('div');
      trail.setAttribute('data-anim', 'trail');
      mask.appendChild(trail);
      host.appendChild(mask);
    });
  }

  /* ======================================================================
     11. Dialog enter animation — motion only
         The dialogs already have a complete implementation in the page's own
         code: trigger, focus trap, Escape, backdrop click and scroll lock, all
         driven by an .is-open class. Nothing here binds a single listener —
         a second open/close would double-handle every one of those. This only
         stamps hooks so the stylesheet can restyle the existing open state to
         the motion-primitives values.
     ====================================================================== */
  function initDialogs() {
    each(targets('.p-dialog', 'dialog'), function (dialog) {
      dialog.setAttribute('data-anim', 'dialog');
      var panel = dialog.querySelector('.p-dialog_panel');
      if (panel) panel.setAttribute('data-anim', 'dialog-panel');
    });
  }

  /* ======================================================================
     12. Dither shader
         Raw WebGL2 — an ordered 4x4 Bayer dither. Written directly rather
         than pulled from a library: the whole effect is one small fragment
         shader, and three.js would be ~600KB for it.
         Opt in per section with data-relume-fx="dither"; the testimonial
         portrait is wired by default.
     ====================================================================== */
  var DITHER_VERT =
    '#version 300 es\nin vec2 p;out vec2 vUv;void main(){vUv=p*0.5+0.5;vUv.y=1.0-vUv.y;gl_Position=vec4(p,0.0,1.0);}';

  var DITHER_FRAG =
    '#version 300 es\nprecision highp float;\n' +
    'in vec2 vUv;out vec4 frag;\n' +
    'uniform sampler2D uTex;uniform float uAmount;uniform float uScale;uniform float uLevels;\n' +
    'uniform vec2 uBox;uniform vec2 uImg;\n' +
    'float bayer(vec2 q){int x=int(mod(q.x,4.0));int y=int(mod(q.y,4.0));int i=y*4+x;' +
    'float m[16]=float[16](0.0,8.0,2.0,10.0,12.0,4.0,14.0,6.0,3.0,11.0,1.0,9.0,15.0,7.0,13.0,5.0);' +
    'return m[i]/16.0-0.5;}\n' +
    'void main(){\n' +
    ' float boxA=uBox.x/uBox.y, imgA=uImg.x/uImg.y;\n' +
    ' vec2 uv=vUv; vec2 s=vec2(1.0);\n' +
    ' if(imgA>boxA){ s.x=boxA/imgA; } else { s.y=imgA/boxA; }\n' +
    ' uv=(uv-0.5)*s+0.5;\n' +               // cover, matching object-fit on the image
    // Snap the sample to the dither cell before quantising. Without this the
    // threshold is applied to full-resolution pixels and the pattern comes out
    // as fine noise you have to lean in to see; with it, each cell is one flat
    // tone and the result reads as an actual dither.
    ' vec2 cells=max(uBox/uScale,vec2(1.0));\n' +
    ' vec2 guv=(floor(uv*cells)+0.5)/cells;\n' +
    ' vec4 c=texture(uTex,guv);\n' +
    ' float t=bayer(floor(gl_FragCoord.xy/uScale));\n' +
    ' vec3 d=floor(c.rgb*uLevels+t)/uLevels;\n' +
    ' frag=vec4(mix(c.rgb,d,uAmount),c.a);\n' +
    '}';

  function buildDither(img) {
    var host = img.parentElement;
    if (!host || host.querySelector('[data-anim="dither"]')) return;

    var canvas = document.createElement('canvas');
    canvas.setAttribute('data-anim', 'dither');
    canvas.setAttribute('aria-hidden', 'true');
    var gl = null;
    try { gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false }); } catch (e) {}
    if (!gl) return;                                   // no WebGL2: the plain image stays

    host.setAttribute('data-anim', 'dither-host');
    // Sit directly on top of the image and NOTHING else. The wrapper also holds
    // overlays that belong above the photo — the @handle link here is
    // z-index:2 — so appending to the end at a fixed z-index painted the shader
    // over them. Inserting immediately after the image and matching its own
    // z-index puts the canvas above the image on DOM order alone, and leaves
    // every overlay above it untouched.
    var imgZ = window.getComputedStyle(img).zIndex;
    if (imgZ && imgZ !== 'auto') canvas.style.zIndex = imgZ;
    host.insertBefore(canvas, img.nextSibling);

    function shader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, DITHER_VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, DITHER_FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    var U = {
      amount: gl.getUniformLocation(prog, 'uAmount'),
      scale: gl.getUniformLocation(prog, 'uScale'),
      levels: gl.getUniformLocation(prog, 'uLevels'),
      box: gl.getUniformLocation(prog, 'uBox'),
      img: gl.getUniformLocation(prog, 'uImg')
    };
    var loaded = false, natural = [1, 1];

    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = img.clientWidth || host.clientWidth, h = img.clientHeight || host.clientHeight;
      if (!w || !h) return false;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.box, canvas.width, canvas.height);
      return true;
    }

    // Both tunable per section from CSS, so the look can be dialled in the
    // Designer without touching this file:
    //   --ra-dither-cell   size of one dither cell in CSS px (default 3)
    //   --ra-dither-levels tones per channel (default 5)
    // Chosen by rendering the real portrait at its real 540x500 size: at 2px
    // cells the pattern is too fine to read as anything, and at 3 levels the
    // channels quantise far enough apart to throw green and magenta speckle
    // across skin. 3px / 5 levels is visibly a dither and still a photograph.
    function cssNumber(prop, fallback) {
      var v = parseFloat(window.getComputedStyle(host).getPropertyValue(prop));
      return (v && v > 0) ? v : fallback;
    }

    function draw() {
      if (!loaded || !size()) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      gl.uniform1f(U.amount, 1);
      gl.uniform1f(U.scale, cssNumber('--ra-dither-cell', 3) * dpr);
      gl.uniform1f(U.levels, cssNumber('--ra-dither-levels', 5));
      gl.uniform2f(U.img, natural[0], natural[1]);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    var src = img.currentSrc || img.src;
    var loader = new Image();
    loader.crossOrigin = 'anonymous';
    loader.onload = function () {
      natural = [loader.naturalWidth || 1, loader.naturalHeight || 1];
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, loader);
      loaded = true;
      draw();
    };
    loader.onerror = function () { canvas.remove(); };   // tainted or missing: leave the image alone
    loader.src = src;

    window.addEventListener('resize', draw);
    if (window.ResizeObserver) { try { new ResizeObserver(draw).observe(host); } catch (e) {} }
  }

  function initDither() {
    if (reduced()) return;
    var imgs = [];
    // Opt-in hook for any section, plus the testimonial portrait by default.
    each(targets('[data-relume-fx~="dither"] img, .p-testimonial_client-image'), function (i) { imgs.push(i); });
    each(imgs, function (img) {
      if (img.hasAttribute('data-ra-dither-armed')) return;   // idempotent across rescans
      img.setAttribute('data-ra-dither-armed', '');
      // Do not wait on the display image. These are loading="lazy", so a
      // portrait below the fold may not fire load for a long time — and the
      // texture is fetched by an own CORS-enabled loader anyway, which only
      // needs the src. The canvas is sized from CSS, which is already known.
      var src = img.currentSrc || img.getAttribute('src');
      if (src) { safe('dither', function () { buildDither(img); }); return; }
      img.addEventListener('load', function () {
        safe('dither', function () { buildDither(img); });
      }, { once: true });
    });
  }

  /* ======================================================================
     13. Rescan — the reason this keeps working on content that did not exist
         at load. Every routine above is idempotent (it skips anything already
         stamped), so the whole set can simply be run again whenever the DOM
         grows: a CMS list finishing, a tab or accordion opening, a Finsweet /
         Jetboost filter re-rendering, a modal's contents mounting, or a whole
         section added in the Designer.

         The observer is disconnected for the duration of the pass, so the
         nodes this module inserts generate no records and cannot feed back
         into a loop.
     ====================================================================== */
  var RESCAN_DELAY = 150;    // coalesce a burst of insertions into one pass
  var RESCAN_FLOOR = 500;    // and never run passes closer together than this
  var observer = null, rescanTimer = null, lastScan = 0;
  var OBSERVE = { childList: true, subtree: true };

  function scanOnce() {
    safe('hooks', stampHooks);
    safe('composer', initComposer);
    safe('hovercards', initHoverCards);
    safe('text-effect', initTextEffect);
    safe('blur-fade', initBlurFade);
    safe('border-trail', initBorderTrail);
    safe('dialogs', initDialogs);
    safe('dither', initDither);
  }

  function rescan() {
    lastScan = +new Date();
    if (observer) observer.disconnect();
    safe('rescan', scanOnce);
    if (observer) { observer.takeRecords(); observer.observe(document.body, OBSERVE); }
  }

  // An animation loop or a ticker can mutate the DOM continuously. Hold the
  // pass rate to RESCAN_FLOOR so a chatty neighbour cannot turn this into a
  // busy loop; nothing is lost, the pass just lands a beat later.
  function queueRescan() {
    var wait = Math.max(RESCAN_DELAY, RESCAN_FLOOR - (+new Date() - lastScan));
    window.clearTimeout(rescanTimer);
    rescanTimer = window.setTimeout(rescan, wait);
  }

  function watchDom() {
    if (!window.MutationObserver || !document.body) return;
    observer = new MutationObserver(function (records) {
      var worth = false;
      for (var i = 0; i < records.length && !worth; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          if (added[j].nodeType === 1) { worth = true; break; }
        }
      }
      if (!worth) return;
      queueRescan();
    });
    observer.observe(document.body, OBSERVE);
  }

  /* ====================================================================== */
  ready(function () {
    scanOnce();
    safe('theme', initTheme);            // one global binding — never rescanned
    safe('reveal-safety-net', revealSafetyNet);
    safe('watch-dom', watchDom);
    // Font swaps and breakpoint changes both move the baseline.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeAllDotsForced).catch(function () {});
    window.addEventListener('resize', placeAllDotsForced);
    // Late-loading images and embeds settle after load; one more pass catches
    // anything that arrived without touching the DOM tree.
    window.addEventListener('load', function () { window.setTimeout(rescan, 200); });
    document.documentElement.setAttribute('data-relume-anim', 'ready');
  });

  // Public API, for page code that swaps content without mutating the DOM in a
  // way the observer sees (or that wants to force a pass immediately).
  window.RelumeAnim = {
    version: '1.4.0',
    rescan: rescan,
    placeDots: placeAllDotsForced
  };
})();
