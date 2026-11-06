(function(){var D=document;
function tip(s){var t=s.querySelector(".p-composer_tip");
if(!t){t=D.createElement("div");t.className="p-composer_tip";s.appendChild(t)}return t}
function find(e){return e.target&&e.target.closest?e.target.closest(".p-composer_switch.is-compact [data-composer-product]"):null}
function show(e){var tb=find(e);if(!tb)return;
var s=tb.closest(".p-composer_sticky");if(!s)return;
var t=tip(s),sb=s.getBoundingClientRect(),b=tb.getBoundingClientRect();
t.textContent=tb.getAttribute("data-composer-product")=="export"?"Export":"Publish";
t.style.left=(b.left-sb.left+b.width/2)+"px";
t.style.top=(b.top-sb.top-8)+"px";
t.setAttribute("data-show","1")}
function hide(e){var tb=find(e);if(!tb)return;
var s=tb.closest(".p-composer_sticky");if(!s)return;
var t=s.querySelector(".p-composer_tip");if(t)t.removeAttribute("data-show")}
D.addEventListener("mouseover",show,true);D.addEventListener("focusin",show,true);
D.addEventListener("mouseout",hide,true);D.addEventListener("focusout",hide,true)})();