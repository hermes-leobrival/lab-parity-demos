/* Library pages (React, Webflow, Figma) are light only. Undoes p-theme-dark / data-theme=dark set by the theme boots and hides the mode toggle. The stored preference is left alone so other pages keep it. */
(function(){
  var p=location.pathname.replace(/\/+$/,'')||'/';
  if(!/^\/(react\/|react-components\/|react-categories\/|components(\/|$)|categories\/|(new|free|ecommerce|marketing|application|saved|site)-components$|your-library$|figma-library$)/.test(p))return;
  var d=document.documentElement;
  d.setAttribute('data-force-light','');
  var s=document.createElement('style');
  s.textContent='[data-force-light] .mode-switch_wrapper,[data-force-light] [data-mode-toggle]{display:none!important}';
  (document.head||d).appendChild(s);
  function fix(){
    if(d.getAttribute('data-theme')!=='light')d.setAttribute('data-theme','light');
    var b=document.body;
    if(b&&b.classList.contains('p-theme-dark'))b.classList.remove('p-theme-dark');
  }
  fix();
  new MutationObserver(fix).observe(d,{attributes:true,attributeFilter:['data-theme']});
  function watchBody(){
    if(!document.body)return false;
    fix();
    new MutationObserver(fix).observe(document.body,{attributes:true,attributeFilter:['class']});
    return true;
  }
  if(!watchBody()){
    var o=new MutationObserver(function(){if(watchBody())o.disconnect();});
    o.observe(d,{childList:true});
  }
})();