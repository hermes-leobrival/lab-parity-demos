(function(){var D=document;function init(){[].forEach.call(D.querySelectorAll("[data-composer-tabs]"),function(tabs){if(tabs.dataset.ct)return;tabs.dataset.ct=1;var form=tabs.closest(".p-composer_form"),wrap=tabs.closest(".p-composer_wrapper");if(!form)return;var inp=form.querySelector(".p-composer_form-input"),col=form.classList.contains("is-collapsed");function wm(){var f=form.querySelector("[data-composer-watermark]");if(f)return f;var o=null;[].forEach.call(form.children,function(c){if(!c.className&&c.tagName=="DIV"&&c.children.length>1&&/top:\s*\d+px/.test(c.getAttribute("style")||""))o=c});if(o)o.setAttribute("data-composer-watermark","");return o}var st=D.createElement("div");st.className="p-composer_wm-static";st.textContent="http://";form.appendChild(st);if(inp){var g=function(){form.classList.toggle("is-filled",!!inp.value.length)};inp.addEventListener("input",g);g()}var hp=form.parentNode.querySelector(".p-text-size-medium");if(hp&&!hp.classList.contains("p-composer_helper-prompt")){hp.classList.add("p-composer_helper-prompt");var hu=D.createElement("div");hu.className=hp.className.replace("p-composer_helper-prompt","")+" p-composer_helper-url";hu.textContent="By generating, you confirm you have permission to use this website";hp.parentNode.insertBefore(hu,hp.nextSibling)}function set(m){var u=m=="url";wm();form.classList.toggle("is-url-mode",u);if(wrap)wrap.classList.toggle("is-url-mode-wrap",u);if(!col&&inp){inp.classList.toggle("is-url-mode",u);inp.style.removeProperty("height");inp.style.removeProperty("min-height");inp.style.removeProperty("max-height");inp.style.removeProperty("flex-grow");form.style.removeProperty("min-height")}[].forEach.call(tabs.querySelectorAll("[data-composer-tab]"),function(t){var on=t.getAttribute("data-composer-tab")==m;t.classList.toggle("is-active",on);t.setAttribute("aria-selected",on?"true":"false")})}[].forEach.call(tabs.querySelectorAll("[data-composer-tab]"),function(t){function go(e){e.preventDefault();set(t.getAttribute("data-composer-tab"))}t.addEventListener("click",go);t.addEventListener("keydown",function(e){if(e.key=="Enter"||e.key==" ")go(e)})})})}D.readyState=="loading"?D.addEventListener("DOMContentLoaded",init):init()})();
(function(){var D=document,Q="[data-composer-products],[data-composer-tabs]",s=D.createElement("style");s.textContent=':root{--pce:cubic-bezier(.22,1,.36,1)}[data-relume-intake="attach"]>.p-button{transition:opacity .22s ease-out,transform .24s var(--pce)}.p-intake-hook.is-disabled>.p-button{opacity:0;visibility:hidden;pointer-events:none;transform:scale(.92);transition:opacity .22s ease-out,transform .24s var(--pce),visibility 0s linear .22s}.p-composer_actions [data-relume-intake="attach"] .p-icon{-webkit-mask-size:9.11px 14px;mask-size:9.11px 14px}[data-composer-products],[data-composer-tabs]{position:relative}.p-composer_fx-thumb{position:absolute;z-index:0;top:0;left:0;width:var(--pcw,0);height:var(--pch,0);border-radius:var(--_publish-radii---xs,4px);background:var(--_publish-colors---background--secondary,#fff);transform:translate3d(var(--pcx,0),var(--pcy,0),0);transition:transform .34s var(--pce),width .34s var(--pce),opacity .18s ease-out;pointer-events:none}[data-fx] .p-composer_switch-tab,[data-fx] .p-composer_tab{position:relative;z-index:1;transition:color .22s ease-out,background-color .22s ease-out}[data-fx] .p-composer_switch-tab.is-active,[data-fx] .p-composer_tab.is-active{background-color:transparent}@media(max-width:767px){.p-hero-header_content{min-width:0}.p-composer_switch-targets{display:none}.p-composer_actions .p-button.is-icon-only{width:34px;height:34px;padding:9px}}@media(max-width:359px){.p-composer_switch-label{display:none}}@media(prefers-reduced-motion:reduce){.p-composer_fx-thumb,[data-relume-intake="attach"]>.p-button{transition:none!important}}';D.head.appendChild(s);function mk(c){if(c.__fx)return c.__fx;var t=D.createElement("div");t.className="p-composer_fx-thumb";t.setAttribute("aria-hidden","true");c.insertBefore(t,c.firstChild);return c.__fx=t}function sy(c,a){var t=mk(c),e=c.querySelector("[data-composer-product].is-active,[data-composer-tab].is-active");if(!e)return void(t.style.opacity=0);var b=c.getBoundingClientRect(),r=e.getBoundingClientRect();if(!r.width)return void(t.style.opacity=0);if(!a)t.style.transition="none";var S=t.style;S.setProperty("--pcx",(r.left-b.left)+"px");S.setProperty("--pcy",(r.top-b.top)+"px");S.setProperty("--pcw",r.width+"px");S.setProperty("--pch",r.height+"px");S.opacity=1;if(!a){t.getBoundingClientRect();S.removeProperty("transition")}c.setAttribute("data-fx","")}function al(a){[].forEach.call(D.querySelectorAll(Q),function(c){sy(c,a)})}function bd(c){if(c.__fb)return;c.__fb=1;new MutationObserver(function(){sy(c,1)}).observe(c,{subtree:true,attributes:true,attributeFilter:["class"]});if(window.ResizeObserver)new ResizeObserver(function(){sy(c,0)}).observe(c);sy(c,0)}function it(){[].forEach.call(D.querySelectorAll(Q),bd)}D.readyState!="loading"?it():D.addEventListener("DOMContentLoaded",it);addEventListener("load",it);addEventListener("resize",function(){al(0)});if(D.fonts&&D.fonts.ready)D.fonts.ready.then(function(){al(0)});setTimeout(it,1200);setTimeout(it,3000)})();
/* Composer variant: Export (pages listed in P). Adds no new site-script slot;
   ships inside ComposerTabsJS. Everything keys off [data-composer-variant],
   which this stamps onto each composer root on those pages, so the same
   variant can later be applied by hand to a composer anywhere. */
(function(){var D=document,P=["6a7dfff64aa007bace86b27c"],V="data-composer-variant",
PROMPTWM="Describe your project...",URLWM="http://",IMPORT="Import",
HELPURL="By importing, you confirm you have permission to use this website",
c='[data-composer-variant="export"] [data-relume-intake="attach"],[data-composer-variant="export"] .p-composer_attachments{display:none}'
/* attach is gone for good here, so the row has one child and space-between
   would pin it left - push it right, as the homepage did before it started
   reserving the attach box. */
+'[data-composer-variant="export"] .p-composer_actions{justify-content:flex-end}'
/* The Prompt/URL toggle is removed outright here - this composer is prompt-only,
   so display:none is safe for the same reason it is on the attach button above:
   there is no tab state left to swap between, so it cannot cause the tab-swap
   layout shift documented in rules/composer.md. ComposerInputRules re-measures
   the narrowed actions row on input and resize, and the collapsed bar gains text
   room rather than losing it, so the watermark width budget only improves. */
+'[data-composer-variant="export"] [data-composer-tabs]{display:none}'
+'[data-composer-variant="export"] .p-composer_wm-static{display:none}'
/* relume-anim owns a rotating watermark ([data-anim="watermark"], two
   cross-fading lines) plus its typing caret, both painted at the textarea's
   text origin at z-index 1. This variant uses the native placeholder instead,
   so leaving them on stacks three strings on the same pixel. Neither sets
   display inline, so a plain specific rule wins - do NOT reach for !important
   here, per rules/composer.md. */
+'[data-composer-variant="export"] [data-anim="watermark"],[data-composer-variant="export"] [data-anim="caret"]{display:none}'
+'[data-composer-variant="export"] .p-composer_form.is-collapsed::after{display:none}'
+'@media(max-width:767px){[data-composer-variant="export"] .p-composer_form.is-url-mode:not(.is-collapsed) .p-button.is-ai::after{content:"Import"}'
/* the collapsed bar gives the actions row 165px of a ~184px field, leaving
   164px of text room at 375 - 3px short of the watermark. The trailing pad
   on a nowrap scrolling field buys nothing, so reclaim it. */
+'[data-composer-variant="export"] .p-composer_form.is-collapsed .p-composer_form-input{padding-right:0}}';
var s=D.createElement("style");s.textContent=c;D.head.appendChild(s);
function on(){return P.indexOf(D.documentElement.getAttribute("data-wf-page"))>-1}
function stamp(){if(!on())return;[].forEach.call(D.querySelectorAll('[data-relume-intake="root"]'),function(r){
if(!r.getAttribute(V))r.setAttribute(V,"export")})}
function apply(f){var t=f.querySelector(".p-composer_form-input");if(!t)return;
var u=f.classList.contains("is-url-mode");
var w=u?URLWM:PROMPTWM;if(t.placeholder!==w)t.placeholder=w;
/* ComposerTabsJS builds the URL helper row and writes "By generating..."; it is
   only ever shown in URL mode, so this variant just relabels it. Re-applied on
   every pass because that row is created after our first run. */
var r=f.closest('[data-relume-intake="root"]'),h=r&&r.querySelector(".p-composer_helper-url");
if(h&&h.textContent!==HELPURL)h.textContent=HELPURL;
var b=f.querySelector(".p-button.is-ai .p-button-text");if(!b)return;
if(!b.dataset.pcTx)b.dataset.pcTx=(b.textContent||"").trim();
var x=u?IMPORT:b.dataset.pcTx;if(b.textContent!==x)b.textContent=x}
function bind(f){if(!f.__pcv){f.__pcv=1;
new MutationObserver(function(){apply(f)}).observe(f,{attributes:true,attributeFilter:["class"]})}
apply(f)}
function all(){stamp();[].forEach.call(D.querySelectorAll('[data-composer-variant="export"] .p-composer_form'),bind)}
D.readyState!="loading"?all():D.addEventListener("DOMContentLoaded",all);
addEventListener("load",all);setTimeout(all,1200);setTimeout(all,3000)})();


/* Export submit -> the app's create route.
   ONE owner for both export composers: the Export page (stamped
   [data-composer-variant="export"] above) and the homepage's Publish/Export
   switch (read live from the active [data-composer-product], because that one
   changes after load). ComposerHomeJS used to intercept the homepage case and
   no longer does - keep this the only copy of the URL.

   Capture phase + stopImmediatePropagation because the intake bridge binds a
   bubble-phase listener on the submit element itself. The bridge ALSO submits
   on Enter in the prompt field, so that is intercepted here too - catching only
   clicks is what let Enter silently fall through to the Publish path.

   An empty field is deliberately NOT intercepted: it falls through to the
   bridge, which blocks it and shows "Add a description or an attachment to get
   started." rather than navigating to a create route with no brief. */
(function(){var D=document,U="https://www.relume.ai/app/project/create";
function root(e){return e&&e.closest?e.closest('[data-relume-intake="root"]'):null}
function isExport(r){if(!r)return false;
if(r.getAttribute("data-composer-variant")=="export")return true;
var s=r.querySelector("[data-composer-products]");
if(!s)return false;
var a=s.querySelector("[data-composer-product].is-active");
return !!a&&a.getAttribute("data-composer-product")=="export"}
function go(e,r){var i=r.querySelector('[data-relume-intake="prompt"]'),v=i&&i.value?i.value.trim():"";
if(!v)return;
e.preventDefault();e.stopPropagation();
if(e.stopImmediatePropagation)e.stopImmediatePropagation();
location.href=U+"?brief="+encodeURIComponent(v)}
D.addEventListener("click",function(e){var h=e.target&&e.target.closest&&e.target.closest('[data-relume-intake="submit"]');
if(!h)return;var r=root(h);if(isExport(r))go(e,r)},true);
D.addEventListener("keydown",function(e){if(e.key!="Enter"||e.shiftKey)return;
var p=e.target&&e.target.closest&&e.target.closest('[data-relume-intake="prompt"]');
if(!p)return;var r=root(p);if(isExport(r))go(e,r)},true)})();
