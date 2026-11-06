(function(){var D=document,M={},B="https://cdn.prod.website-files.com/6177739448baa66404ce1d9c/",
P=B+"6a83e4ebd879d19e4ea0e0e4_icon-doc-pdf18.svg",G=B+"6a83e4e955dfe361dba42fd9_icon-doc-document.svg",
A=B+"6a83e4ea25d59f5ee9814754_icon-doc-data.svg";
function kind(f){var n=(f.name||"").toLowerCase(),e=n.slice(n.lastIndexOf(".")+1),t=f.type||"";
if(e=="svg"||t=="image/svg+xml")return"svg";
if(/^image\//.test(t)||" png jpg jpeg gif webp avif ".indexOf(" "+e+" ")>-1)return"img";
if(e=="pdf")return"pdf";
if(e=="csv")return"data";
return"doc"}
function note(fs){if(!fs)return;for(var i=0;i<fs.length;i++){var f=fs[i];
if(!f||!f.name||M[f.name])continue;var k=kind(f),u=null;
if(k=="img"||k=="svg"){try{u=URL.createObjectURL(f)}catch(x){}}M[f.name]={k:k,u:u}}paint()}
function paint(){[].forEach.call(D.querySelectorAll('[data-relume-intake="chip"]'),function(c){
var n=c.querySelector('[data-relume-intake="chip-name"]'),
p=c.querySelector(".p-composer_attachment-preview"),
g=c.querySelector(".p-composer_attachment-glyph");
if(!n||!p||!g)return;
var r=M[(n.textContent||"").trim()]||{k:"doc",u:null},f=r.k=="img"||r.k=="svg";
g.className="p-composer_attachment-glyph"+(r.k=="img"?" is-img":r.k=="svg"?" is-svg":"");
p.classList.toggle("is-framed",f);p.classList.toggle("is-plate",r.k=="img");
g.style.backgroundImage="url("+(r.u||(r.k=="pdf"?P:r.k=="data"?A:G))+")";
if(!n.title)n.title=(n.textContent||"").trim()})}
D.addEventListener("change",function(e){var t=e.target;
if(t&&t.tagName=="INPUT"&&t.type=="file")note(t.files)},true);
D.addEventListener("drop",function(e){try{note(e.dataTransfer&&e.dataTransfer.files)}catch(x){}},true);
function watch(){[].forEach.call(D.querySelectorAll('[data-relume-intake="chips"]'),function(l){
if(l.__pcw)return;l.__pcw=1;new MutationObserver(paint).observe(l,{childList:true})});paint()}
if(D.readyState!="loading")watch();else D.addEventListener("DOMContentLoaded",watch);
setTimeout(watch,1200);setTimeout(watch,3000)})();