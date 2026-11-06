/* Publish/Export product switch (homepage). Submit is NOT handled here any
   more: the export redirect moved into ComposerTabsJS v1.2.5 so the Export
   page and this switch share one implementation and one URL. */
(function(){var D=document;
function root(e){return e.closest('[data-relume-intake="root"]')}
function sw(r){return r?r.querySelector("[data-composer-products]"):null}
function prod(r){var s=sw(r);if(!s)return null;
var a=s.querySelector("[data-composer-product].is-active");
return a?a.getAttribute("data-composer-product"):"publish"}
function clr(r){var n=0,b,c;
while((b=r.querySelector('[data-relume-intake="chip-remove"]'))&&n++<60){
c=r.querySelectorAll('[data-relume-intake="chip"]').length;b.click();
if(r.querySelectorAll('[data-relume-intake="chip"]').length>=c)break}}
function apply(r){var p=prod(r),ex=p=="export";
r.setAttribute("data-composer-product",p);
var a=r.querySelector('[data-relume-intake="attach"]');
if(a)a.classList.toggle("is-disabled",ex);
if(ex)clr(r)}
function set(r,p){var s=sw(r);if(!s)return;
[].forEach.call(s.querySelectorAll("[data-composer-product]"),function(t){
var on=t.getAttribute("data-composer-product")==p;
t.classList.toggle("is-active",on);t.setAttribute("aria-selected",on?"true":"false")});
apply(r)}
D.addEventListener("click",function(e){var t=e.target.closest&&e.target.closest("[data-composer-product]");
if(!t||!t.closest("[data-composer-products]"))return;
var r=root(t);if(r)set(r,t.getAttribute("data-composer-product"))},true);
function init(){[].forEach.call(D.querySelectorAll("[data-composer-products]"),function(s){
var r=root(s);if(r)apply(r)})}
if(D.readyState!="loading")init();else D.addEventListener("DOMContentLoaded",init);
setTimeout(init,1200)})();