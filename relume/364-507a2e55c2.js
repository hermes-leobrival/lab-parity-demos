
(function () {
/*
 * The cascade loop.
 *
 * Plain JS with no imports, deliberately: this exact file is both imported by
 * `sites_stack.tsx` and inlined verbatim into the Webflow bundle by
 * `webflow/build_embed.mjs`. The bundle carries no React, so a loop written
 * inside a `useEffect` would simply not ship — and two hand-kept copies of an
 * animation is how they drift.
 *
 * ## The motion
 *
 * Structurally this is `reactbits`' CardSwap, whose slot function is already
 * this frame's geometry — `x: i * distX, y: -i * distY, zIndex: total - i`, which
 * is exactly the Figma cascade's 48-right / 82-up / descending stack. Every
 * tick the front card leaves, the remaining six each promote one slot forward,
 * and the departed card returns to the back.
 *
 * The *feel* is `skiper17`: a card going away does not merely translate, it
 * recedes — tipping and shrinking as it accelerates out (that component uses
 * `scale: 0.7, rotation: 5` over a whole scroll; the same gesture over 620ms
 * wants far less, so it is 0.96 and -2.5deg).
 *
 * Three things it does deliberately:
 *
 *   - **It never fades anything.** The exiting card leaves by travelling past
 *     the frame's clip. A card at partial opacity would show the card wrapper's
 *     pink through it, which is the same hazard the Publish hero hit when it
 *     cross-faded two stacked frames.
 *   - **Only `transform` is animated.** Position, size and radius stay in
 *     layout, so a tick costs the compositor a transform and nothing else.
 *   - **At rest every card sits on exactly the Figma numbers.** The dwell
 *     between ticks is the approved static composition, unaltered.
 */

/**
 * Milliseconds between swaps, including the swap itself.
 *
 * Measured on the published page, the visible motion occupies ~920ms of this and
 * the front card then holds still for ~850-960ms. (Motion settles sooner than
 * the durations suggest: easeOutExpo covers 97% of its distance in half its
 * time, so the tail is sub-pixel.) Shortening the cycle shortens the
 * dwell and nothing else; the motion keeps its own durations, which is what
 * stops "a bit quicker" turning into "frantic". It also sets how long the shot
 * sits before its first swap, which is the wait a viewer notices most.
 */
const CYCLE_MS = 2400;
/** The front card's exit. Ease-in, so it accelerates away. */
const DROP_MS = 620;
/** A promotion, per card. Ease-out, so it settles rather than arrives. */
const PROMOTE_MS = 900;
/**
 * Promotions start this far through the drop rather than after it. Waiting for
 * the drop to finish reads as two separate events; overlapping them reads as
 * one. CardSwap uses 0.45 for its non-elastic preset, which is the right feel
 * here too.
 */
const PROMOTE_OVERLAP = 0.45;
/** Stagger between the six promotions, so the cascade ripples. */
const STAGGER_MS = 55;

/**
 * Starts the loop. Returns a function that stops it and restores the static
 * cascade.
 *
 * @param {HTMLElement} frame The `.frame` element; its children are the cards.
 * @param {{animated: string, exiting: string, teleporting: string}} classes
 *   The CSS-module class names, which are hashed and so cannot be hard-coded.
 * @returns {() => void} cleanup
 */
function startCascade(frame, classes) {
  const cards = /** @type {HTMLElement[]} */ ([...frame.children]);
  if (cards.length < 2) {
    return () => {};
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const timers = new Set();
  /** Front-first, exactly like CardSwap's `order` ref. */
  let order = cards.map((_, i) => i);
  let running = false;
  let visible = false;

  const after = (ms, fn) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  };

  const clearTimers = () => {
    timers.forEach((id) => window.clearTimeout(id));
    timers.clear();
  };

  const setSlot = (el, slot) => {
    el.style.setProperty('--s', String(slot));
  };

  const tick = () => {
    const [front, ...rest] = order;
    const exiting = cards[front];

    // 1. The front card accelerates away, below the frame's clip.
    exiting.classList.remove(classes.teleporting);
    exiting.classList.add(classes.exiting);

    // 2. Part-way through that, everyone behind promotes one slot forward.
    after(Math.round(DROP_MS * PROMOTE_OVERLAP), () => {
      rest.forEach((cardIndex, slot) => {
        const el = cards[cardIndex];
        el.style.setProperty('--d', `${slot * STAGGER_MS}ms`);
        setSlot(el, slot);
      });
    });

    // 3. Once it is out of frame, the exiting card returns to the back slot.
    //    Both where it lands and where it came from are outside the clip, so the
    //    jump is never seen — and it is a jump, not a transition, because
    //    animating it back across the frame is exactly what must not happen.
    after(DROP_MS + 20, () => {
      exiting.classList.add(classes.teleporting);
      exiting.classList.remove(classes.exiting);
      exiting.style.setProperty('--d', '0ms');
      setSlot(exiting, cards.length - 1);
      /*
       * Let the jump land, then allow transitions back — on the next frame
       * rather than by reading `offsetWidth`. Reading it would force a
       * synchronous layout of the whole document, and this shot sits on a page
       * with a very large DOM; a rAF costs nothing and is just as ordered.
       */
      requestAnimationFrame(() => {
        exiting.classList.remove(classes.teleporting);
      });
    });

    order = [...rest, front];
  };

  const start = () => {
    if (running || reduced.matches || !visible) {
      return;
    }
    running = true;
    cards.forEach((el) => el.classList.add(classes.animated));
    const loop = () => {
      tick();
      after(CYCLE_MS, loop);
    };
    // A beat before the first swap, so the shot is read before it moves.
    after(CYCLE_MS, loop);
  };

  const stop = () => {
    if (!running) {
      return;
    }
    running = false;
    clearTimers();
    cards.forEach((el) => {
      el.classList.remove(classes.animated, classes.exiting, classes.teleporting);
      el.style.removeProperty('--d');
    });
    // Leave the cascade wherever it had got to, in its resting arrangement:
    // `order` is already the current front-first order.
    order.forEach((cardIndex, slot) => setSlot(cards[cardIndex], slot));
  };

  /*
   * Off-screen and background tabs do not animate. A marketing page has a lot
   * of other work to do, and a compositor loop nobody is looking at is the kind
   * of thing that shows up as jank somewhere else entirely.
   */
  const observer =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(
          (entries) => {
            visible = entries.some((e) => e.isIntersecting);
            if (visible && !document.hidden) {
              start();
            } else {
              stop();
            }
          },
          { threshold: 0.15 },
        )
      : null;

  if (observer) {
    observer.observe(frame);
  } else {
    visible = true;
    start();
  }

  const onVisibility = () => {
    if (document.hidden) {
      stop();
    } else if (visible) {
      start();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  const onReducedChange = () => {
    if (reduced.matches) {
      stop();
    } else if (visible && !document.hidden) {
      start();
    }
  };
  reduced.addEventListener('change', onReducedChange);

  return () => {
    stop();
    if (observer) {
      observer.disconnect();
    }
    document.removeEventListener('visibilitychange', onVisibility);
    reduced.removeEventListener('change', onReducedChange);
  };
}


  // The card this replaces is an instance of the "Icon + Tagline Card"
  // component, which has ten instances across the site and exposes no slot
  // prop — so there is nowhere inside the instance to put an embed. Instead the
  // embed sits at page level and adopts the slot from outside: it finds the
  // image, hides it, and mounts itself in the image's place.
  //
  // Every step fails safe. If the markup ever moves, nothing is found, nothing
  // is hidden, and the page keeps the image it has today rather than showing a
  // hole where the shot should be.
  function findImage() {
    var row = document.querySelector('.p-engine_row');
    if (!row) return null;

    // Both columns of this row currently share one placeholder image
    // (testing-asset-1.png), so unlike the Plan card there is nothing in the
    // src to match on. Match the card by its heading instead — that is the
    // thing that actually identifies the column — and fall back to the second
    // child, which is where the "Assembled, not generated" card lives today.
    var cards = row.children;
    for (var i = 0; i < cards.length; i++) {
      var h = cards[i].querySelector('h1,h2,h3,h4,h5,h6');
      if (h && h.textContent.indexOf('Assembled, not generated') !== -1) {
        return cards[i].querySelector('img.icon-tagline_card-image');
      }
    }
    return cards[1] ? cards[1].querySelector('img.icon-tagline_card-image') : null;
  }

  function mount() {
    var img = findImage();
    if (!img || img.dataset.rssAdopted) return;
    img.dataset.rssAdopted = '1';

    // Hidden, not removed: restoring the original is clearing this one property.
    img.style.display = 'none';

    var host = document.createElement('div');
    host.setAttribute('data-relume-sites-stack', '');
    host.className = 'rss';
    img.parentNode.insertBefore(host, img.nextSibling);

    var style = document.createElement('style');
    style.textContent = ".rss{display:block;position:relative;z-index:1;width:100%}\n.rss .frontend-base-marketing-sites_stack-sites_stack__frame{--u: .174825cqi; aspect-ratio: 572 / 454; isolation: isolate; background: none; width: 100%; position: relative; overflow: clip; container-type: inline-size;}\n.rss .frontend-base-marketing-sites_stack-sites_stack__frame, .rss .frontend-base-marketing-sites_stack-sites_stack__frame *, .rss .frontend-base-marketing-sites_stack-sites_stack__frame ::before, .rss .frontend-base-marketing-sites_stack-sites_stack__frame ::after{box-sizing: border-box;}\n.rss .frontend-base-marketing-sites_stack-sites_stack__card{z-index: calc(7 - var(--s)); width: calc(403 * var(--u)); height: calc(235 * var(--u)); border-radius: calc(4.839 * var(--u)); transform: translate3d(calc((46 + 48 * var(--s)) * var(--u)), calc((187 - 82 * var(--s)) * var(--u)), 0); position: absolute; top: 0px; left: 0px; overflow: clip;}\n.rss .frontend-base-marketing-sites_stack-sites_stack__cardAnimated{transition-behavior: normal; transition-duration: 0.9s; transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1); transition-property: transform; transition-delay: var(--d, 0s); will-change: transform;}\n.rss .frontend-base-marketing-sites_stack-sites_stack__cardExiting{z-index: 8; transform: translate3d(calc(-2 * var(--u)), calc(487 * var(--u)), 0) scale(.96) rotate(-2.5deg); transition: transform 0.62s cubic-bezier(0.55, 0, 1, 0.45);}\n.rss .frontend-base-marketing-sites_stack-sites_stack__cardTeleporting{transition: none;}\n.rss .frontend-base-marketing-sites_stack-sites_stack__image{object-fit: cover; pointer-events: none; width: 100%; max-width: none; height: 100%; display: block;}";
    document.head.appendChild(style);

    host.innerHTML = "<div class=\"frontend-base-marketing-sites_stack-sites_stack__frame\" aria-hidden=\"true\" data-node-id=\"2342:395267\"><div class=\"frontend-base-marketing-sites_stack-sites_stack__card\" style=\"--s: 0;\"><img class=\"frontend-base-marketing-sites_stack-sites_stack__image\" alt=\"\" loading=\"eager\" decoding=\"async\" draggable=\"false\" src=\"https://cdn.prod.website-files.com/6177739448baa66404ce1d9c/6a7e5ae296a2d08c93e9abab_engine-sites-1-v2.webp\"></div><div class=\"frontend-base-marketing-sites_stack-sites_stack__card\" style=\"--s: 1;\"><img class=\"frontend-base-marketing-sites_stack-sites_stack__image\" alt=\"\" loading=\"eager\" decoding=\"async\" draggable=\"false\" src=\"https://cdn.prod.website-files.com/6177739448baa66404ce1d9c/6a7e5ae3b34ff53b7ef646d2_engine-sites-2-v2.webp\"></div><div class=\"frontend-base-marketing-sites_stack-sites_stack__card\" style=\"--s: 2;\"><img class=\"frontend-base-marketing-sites_stack-sites_stack__image\" alt=\"\" loading=\"eager\" decoding=\"async\" draggable=\"false\" src=\"https://cdn.prod.website-files.com/6177739448baa66404ce1d9c/6a7e5ae5de0b847e818d67c8_engine-sites-3-v2.webp\"></div><div class=\"frontend-base-marketing-sites_stack-sites_stack__card\" style=\"--s: 3;\"><img class=\"frontend-base-marketing-sites_stack-sites_stack__image\" alt=\"\" loading=\"eager\" decoding=\"async\" draggable=\"false\" src=\"https://cdn.prod.website-files.com/6177739448baa66404ce1d9c/6a7e5ae6df88482267f48c58_engine-sites-4-v2.webp\"></div><div class=\"frontend-base-marketing-sites_stack-sites_stack__card\" style=\"--s: 4;\"><img class=\"frontend-base-marketing-sites_stack-sites_stack__image\" alt=\"\" loading=\"eager\" decoding=\"async\" draggable=\"false\" src=\"https://cdn.prod.website-files.com/6177739448baa66404ce1d9c/6a7e5ae60300baf06b6c044d_engine-sites-5-v2.webp\"></div><div class=\"frontend-base-marketing-sites_stack-sites_stack__card\" style=\"--s: 5;\"><img class=\"frontend-base-marketing-sites_stack-sites_stack__image\" alt=\"\" loading=\"eager\" decoding=\"async\" draggable=\"false\" src=\"https://cdn.prod.website-files.com/6177739448baa66404ce1d9c/6a7e5ae750aa9ce1987c26a9_engine-sites-6-v2.webp\"></div><div class=\"frontend-base-marketing-sites_stack-sites_stack__card\" style=\"--s: 6;\"><img class=\"frontend-base-marketing-sites_stack-sites_stack__image\" alt=\"\" loading=\"eager\" decoding=\"async\" draggable=\"false\" src=\"https://cdn.prod.website-files.com/6177739448baa66404ce1d9c/6a7e5ae7c69842c3184ca3eb_engine-sites-7-v2.webp\"></div></div>";

    // The frame is the mount's only child; its children are the seven cards.
    var frame = host.firstElementChild;
    if (frame) startCascade(frame, {"animated":"frontend-base-marketing-sites_stack-sites_stack__cardAnimated","exiting":"frontend-base-marketing-sites_stack-sites_stack__cardExiting","teleporting":"frontend-base-marketing-sites_stack-sites_stack__cardTeleporting"});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
