var bar=document.querySelector('.brandbar'),panes=document.querySelector('.panes'),g=[],bad=[];
document.querySelectorAll('.tabb').forEach(function(x){x.click();
 var b=bar.getBoundingClientRect();
 var pane=[].filter.call(document.querySelectorAll('.pane'),function(q){
   return getComputedStyle(q).display!=='none'})[0];
 var first=pane.querySelector('.w,.pw').getBoundingClientRect();
 g.push(x.dataset.t+':'+Math.round(first.top-b.bottom));
 if(panes.scrollHeight>panes.clientHeight+1) bad.push(x.dataset.t+'+'+(panes.scrollHeight-panes.clientHeight));});
document.querySelector('[data-t=home]').click();
var t=[].map.call(document.querySelectorAll('.tabb'),function(x){return x.dataset.title||x.textContent.trim()});
document.title='RES gaps='+g.join(' ')+' titles='+t.join('|')+' overflow=['+bad.join(',')+'] err='+(window.__e||'none');
