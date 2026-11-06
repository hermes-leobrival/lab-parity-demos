/* ShowcaseCardLikes v2.1 — registered in Webflow as ShowcaseCardLikes.
 *
 * This file owns BOTH counters that appear in the bottom-left of a showcase
 * family card, because they occupy the same element and would otherwise fight
 * over it:
 *
 *   Site of the Month card  ->  like count, clickable  (the original behaviour)
 *   Demo project card       ->  clone count, READ ONLY (Nova templates API)
 *
 * A demo card is marked with data-count-kind="clones" on the counter, set on the
 * Demo Project Card component. The like path skips those outright — no click
 * handler, no role=button, no aria-pressed — so a clone count cannot be toggled.
 *
 * The count shown is always  CMS base (already in the HTML) + server delta,
 * so the number never flashes: the base paints server-side, and the delta only
 * ever adjusts it upward once the fetch lands.
 *
 * If ENDPOINT is unreachable — not deployed yet, offline, blocked — every path
 * falls back to the old localStorage behaviour rather than breaking the heart.
 * That is what makes this safe to publish before the worker exists.
 */
(function () {
  /* Empty until the worker is deployed, which keeps the server path dormant
   * rather than firing a request at a host that does not exist yet. Turn it on
   * by setting window.__RELUME_LIKES_ENDPOINT before this script runs (one line
   * of page custom code), or by hardcoding the URL here and re-registering. */
  var ENDPOINT = window.__RELUME_LIKES_ENDPOINT || '';
  var LS_LIKED = 'relume-sotm-likes';     // same key as v1, so existing likes carry over
  var LS_VISITOR = 'relume-visitor-id';

  function rd() { try { return JSON.parse(localStorage.getItem(LS_LIKED)) || {}; } catch (e) { return {}; } }
  function wr(s) { try { localStorage.setItem(LS_LIKED, JSON.stringify(s)); } catch (e) {} }

  /* Stable per-browser id. Not authentication — it is the difference between
   * "a refresh does not farm likes" and nothing, and that is all it claims. */
  function visitor() {
    try {
      var v = localStorage.getItem(LS_VISITOR);
      if (!/^[a-z0-9-]{8,64}$/.test(v || '')) {
        v = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2)).toLowerCase();
        localStorage.setItem(LS_VISITOR, v);
      }
      return v;
    } catch (e) { return ''; }
  }

  function slugify(s) {
    return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  /* Which collection the card came from. The demo fork carries .is-demo on its
   * pinned buttons and avatar tile; anything else is a Site of the Month.
   * Namespacing matters: without it a demo project and a winner sharing a title
   * would share one counter. */
  function idFor(el) {
    var card = el.closest('.p-showcase_card');
    if (!card) return '';
    var t = card.querySelector('.p-showcase_card-designer h3');
    var key = slugify(t && t.textContent);
    if (!key) return '';
    var col = card.querySelector('.is-demo') ? 'demo' : 'sotm';
    return col + ':' + key;
  }

  function paint(el, liked, delta) {
    var icon = el.querySelector('.p-icon');
    var out = el.querySelector('.p-showcase_likes-total');
    var base = parseInt(el.getAttribute('data-like-base'), 10) || 0;
    var total = base + (typeof delta === 'number' ? delta : (liked ? 1 : 0));

    if (icon) icon.textContent = liked ? 'icon-heart-filled' : 'icon-heart';
    /* A bare 0 reads as broken, so at zero the heart stands alone. */
    if (out) { out.textContent = String(total); out.style.display = total === 0 ? 'none' : ''; }
    el.setAttribute('aria-pressed', liked ? 'true' : 'false');
    el.setAttribute('aria-label', (liked ? 'Unlike' : 'Like') + ' this site');
  }

  /* ---- clone counts -------------------------------------------------------
   * The template uuid is not stamped on the card as an attribute — Webflow
   * cannot bind a CMS field into a custom attribute's value (only into text or
   * a link). It IS in the duplicate URL the Clone site button already points at,
   * so that href is the source of truth and no extra plumbing is needed.
   *
   * NOTE ON CORS: the API echoes an allow-origin header for relume.ai and
   * staging.relume.ai but NOT for the .webflow.io staging host, so on a Webflow
   * preview this fetch is blocked by the browser and the CMS-rendered Clone
   * Count stays on screen. That is the intended fallback, not a bug. */
  var NOVA = window.__RELUME_NOVA_API || 'https://staging-apis.relume.io';
  var TEMPLATE_RE = /\/template\/([0-9a-f-]{36})/i;

  function templateIdFor(counter) {
    var card = counter.closest('.p-showcase_card');
    if (!card) return '';
    var links = card.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var m = TEMPLATE_RE.exec(links[i].getAttribute('href') || '');
      if (m) return m[1];
    }
    return '';
  }

  function label(el, n) {
    var v = parseInt(String(n || '').replace(/\D/g, ''), 10);
    if (isNaN(v)) return;
    el.setAttribute('aria-label', v === 1 ? '1 duplicate' : v + ' duplicates');
  }

  function initClones(counters) {
    /* Several cards can point at one template, so group by id and fetch each
     * once rather than per card. */
    var byId = {};
    counters.forEach(function (el) {
      el.setAttribute('data-like-ready', '1');   // keeps the like path off it
      el.removeAttribute('role');
      el.removeAttribute('tabindex');
      el.removeAttribute('aria-pressed');
      /* Label it from whatever is already on screen, so the counter is still
       * announced when the fetch never lands (see the CORS note above). */
      label(el, (el.querySelector('.p-showcase_likes-total') || {}).textContent);
      var id = templateIdFor(el);
      if (!id) return;
      (byId[id] = byId[id] || []).push(el);
    });

    Object.keys(byId).forEach(function (id) {
      fetch(NOVA + '/nova/templates/' + id + '/clones')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d || typeof d.cloneCount !== 'number') return;
          byId[id].forEach(function (el) {
            var out = el.querySelector('.p-showcase_likes-total');
            if (out) out.textContent = String(d.cloneCount);
            label(el, d.cloneCount);
          });
        })
        .catch(function () { /* blocked or offline: the CMS value stands */ });
    });
  }

  function init() {
    var all = [].slice.call(document.querySelectorAll('.p-showcase_card-likes'))
      .filter(function (el) { return !el.getAttribute('data-like-ready'); });

    var clones = all.filter(function (el) { return el.getAttribute('data-count-kind') === 'clones'; });
    if (clones.length) initClones(clones);

    var cards = all.filter(function (el) { return el.getAttribute('data-count-kind') !== 'clones'; });
    if (!cards.length) return;

    var vid = visitor();
    var local = rd();
    var state = {};   // id -> {delta, liked}

    cards.forEach(function (el) {
      el.setAttribute('data-like-ready', '1');
      var out = el.querySelector('.p-showcase_likes-total');
      /* Captured once, before anything is repainted: this is the CMS value the
       * server rendered, and every later total is computed from it. */
      el.setAttribute('data-like-base', String(parseInt(((out && out.textContent) || '0').replace(/\D/g, ''), 10) || 0));
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');

      var id = idFor(el);
      el.setAttribute('data-like-id', id);
      paint(el, !!local[id], local[id] ? 1 : 0);

      function toggle(e) {
        e.preventDefault(); e.stopPropagation();
        if (!id) return;
        var st = state[id] || { delta: local[id] ? 1 : 0, liked: !!local[id] };
        var on = !st.liked;

        // Optimistic: the heart responds now, the server confirms after.
        var guess = { delta: st.delta + (on ? 1 : -1), liked: on };
        state[id] = guess;
        paint(el, on, guess.delta);

        var s = rd(); if (on) { s[id] = 1; } else { delete s[id]; } wr(s); local = s;

        if (!vid || !ENDPOINT) return;   // no storage or no server: stay local
        fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: id, visitor: vid, on: on }),
        })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) {
            if (!d || typeof d.delta !== 'number') return;
            state[id] = { delta: d.delta, liked: !!d.liked };
            paint(el, !!d.liked, d.delta);
          })
          .catch(function () { /* offline: the optimistic paint and localStorage stand */ });
      }

      el.addEventListener('click', toggle);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') toggle(e); });
    });

    // One request for every card on the page.
    var ids = cards.map(function (el) { return el.getAttribute('data-like-id'); }).filter(Boolean);
    if (!ids.length || !vid || !ENDPOINT) return;

    fetch(ENDPOINT + '?ids=' + encodeURIComponent(ids.join(',')), { headers: { 'x-visitor-id': vid } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        var liked = {};
        (d.liked || []).forEach(function (k) { liked[k] = 1; });
        cards.forEach(function (el) {
          var id = el.getAttribute('data-like-id');
          if (!id) return;
          var delta = Number((d.deltas || {})[id]) || 0;
          /* The server is authoritative for whether THIS visitor liked it, so a
           * stale localStorage flag from another device gets corrected here. */
          state[id] = { delta: delta, liked: !!liked[id] };
          paint(el, !!liked[id], delta);
        });
      })
      .catch(function () { /* endpoint absent: localStorage paint already stands */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
