var out=[];
document.querySelectorAll('.tabb').forEach(function(x){x.click();
 var p=[].filter.call(document.querySelectorAll('.pane'),function(q){
   return getComputedStyle(q).display!=='none'})[0];
 var inner=p.firstElementChild.getBoundingClientRect();
 out.push(x.dataset.t+':'+Math.round(inner.width)+'x'+Math.round(inner.height)
  +'@'+Math.round(inner.left));});
document.querySelector('[data-t=home]').click();
document.title='RES '+out.join(' ')+' same='+(new Set(out.map(function(s){return s.split(':')[1]})).size===1);
