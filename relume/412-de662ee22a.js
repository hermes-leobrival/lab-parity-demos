/**
 * Landing-page tracker for the Webflow marketing site.
 *
 * Records which marketing landing page a visitor first arrived on, so the
 * signup app can attribute the signup (and the rest of the funnel) to it in
 * PostHog. The marketing site and the app are both served from
 * `www.relume.io` via relume-proxy, so this localStorage value is readable by
 * the app at `/app/signup` (see `frontend/base/posthog.ts` ->
 * `getLandingPage`/`captureLandingPage`).
 *
 * Hosting: this file ships with the account app build (rsbuild copies
 * `frontend/account/public/**` to the dist root), so it is served at
 *   https://www.relume.ai/app/_account/landing-page-tracker.js
 *
 * Add it once, site-wide, in Webflow (Project Settings -> Custom Code ->
 * Footer Code), so it runs on every landing page:
 *   <script defer src="/app/_account/landing-page-tracker.js"></script>
 *
 * The landing page slug is, in priority order:
 *   1. an explicit `?landing_page=<slug>` query param, else
 *   2. a slug derived from the page path (`/ai-website-builder` -> "ai-website-builder", "/" -> "home").
 *
 * First touch wins: once a value is stored it is not overwritten, so the entry
 * page is attributed even if the visitor browses other pages before signing up.
 */
(function () {
  var KEY = 'LANDING_PAGE';

  function deriveSlug() {
    try {
      var param = new URLSearchParams(window.location.search).get(
        'landing_page',
      );
      if (param) return param;
    } catch (e) {
      // URLSearchParams unsupported — fall through to path.
    }
    var path = window.location.pathname.replace(/^\/+|\/+$/g, '');
    return path === '' ? 'home' : path;
  }

  try {
    if (!localStorage.getItem(KEY)) {
      localStorage.setItem(KEY, deriveSlug());
    }
  } catch (e) {
    // localStorage blocked (e.g. private mode) — nothing else we can do.
  }
})();
