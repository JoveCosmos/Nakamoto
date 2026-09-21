window.dispatchEvent(new Event("resize"));
var root=document.documentElement, ID={home:'p-home',eta:'p-eta',pays:'p-pays'};
var ph=getComputedStyle(root).getPropertyValue('--paneh').trim();
var bb=document.querySelector('.panes').getBoundingClientRect().bottom;
function nm(e){return String(e.getAttribute('class')||e.tagName).split(' ')[0];}
var o=['win='+window.innerHeight+' paneh='+ph];
Object.keys(ID).forEach(function(t){
  document.querySelector('[data-t='+t+']').click();
  var p=document.getElementById(ID[t]), worst=0, who='';
  (function walk(n){Array.prototype.forEach.call(n.children,function(e){
    var cs=getComputedStyle(e), r=e.getBoundingClientRect();
    if(r.height&&r.bottom-bb>worst){worst=r.bottom-bb;who=nm(e);}
    /* content inside a scroller is reachable, not cut */
    if(cs.overflowY!=='auto'&&cs.overflowY!=='scroll') walk(e);});})(p);
  o.push(t+(worst>0.5?' CUT '+Math.round(worst)+'px @'+who:' fits'));
});
document.querySelector('[data-t=home]').click();
document.title='RES '+o.join(' | ');
