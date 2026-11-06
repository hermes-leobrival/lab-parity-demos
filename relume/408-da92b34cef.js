(function(){var D=document;
var xs=D.createElement("style");
xs.textContent='.p-composer_form.is-collapsed.is-url-mode{min-height:48px}'
+'.p-composer_form .p-composer_attachments{padding-left:0}';
D.head.appendChild(xs);
function wmfix(form){var ta=form.querySelector(".p-composer_form-input");if(!ta)return;
var at=form.querySelector(".p-composer_attachments");
if(at){var g=parseFloat(getComputedStyle(form).rowGap)||0,m=g?-g+"px":"0px";
if(at.style.marginBottom!==m)at.style.marginBottom=m}
var t=(ta.offsetTop+(parseFloat(getComputedStyle(ta).paddingTop)||0))+"px";
[].forEach.call(form.children,function(e){if(!e.style)return;
if(e.classList.contains("p-composer_wm-static")||(e.hasAttribute("data-anim")&&e.style.top)){
if(e.style.top!==t)e.style.top=t}})}
function all(){[].forEach.call(D.querySelectorAll(".p-composer_form"),wmfix)}
function clear(r){var n=0,b,c;
while((b=r.querySelector('[data-relume-intake="chip-remove"]'))&&n++<60){
c=r.querySelectorAll('[data-relume-intake="chip"]').length;b.click();
if(r.querySelectorAll('[data-relume-intake="chip"]').length>=c)break}}
D.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;
var tab=t.closest('[data-composer-tab="url"]');if(!tab)return;
var r=tab.closest('[data-relume-intake="root"]');if(r)clear(r)},true);
addEventListener("resize",all);
function watch(){[].forEach.call(D.querySelectorAll('[data-relume-intake="chips"]'),function(l){
if(l.__pcf)return;l.__pcf=1;new MutationObserver(all).observe(l,{childList:true})});all()}
if(D.readyState!="loading")watch();else D.addEventListener("DOMContentLoaded",watch);
setTimeout(watch,1500);setTimeout(watch,3200)})();