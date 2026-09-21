var out=[],panes=document.querySelector('.panes'),bad=[];
document.querySelectorAll('.tabb').forEach(function(x){x.click();
 var p=[].filter.call(document.querySelectorAll('.pane'),function(q){
   return getComputedStyle(q).display!=='none'})[0].getBoundingClientRect();
 out.push(x.dataset.t+':'+Math.round(p.height));
 if(panes.scrollHeight>panes.clientHeight+1) bad.push(x.dataset.t+'+'+(panes.scrollHeight-panes.clientHeight));});
document.querySelector('[data-t=eta]').click();
var sv=document.querySelector('#p-eta svg[viewBox]').getBoundingClientRect();
document.querySelector('[data-t=home]').click();
document.title='RES panes='+out.join(' ')+' same='+(new Set(out.map(function(s){return s.split(':')[1]})).size===1)
 +' paneh='+getComputedStyle(document.documentElement).getPropertyValue('--paneh').trim()
 +' chart='+Math.round(sv.width)+'x'+Math.round(sv.height)
 +' overflow=['+bad.join(',')+'] err='+(window.__e||'none');
