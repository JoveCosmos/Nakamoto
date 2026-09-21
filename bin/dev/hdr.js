var panes=document.querySelector('.panes'),bar=document.querySelector('.brandbar');
var tops=[],gaps=[],bad=[];
document.querySelectorAll('.tabb').forEach(function(x){x.click();
 var b=bar.getBoundingClientRect();
 var pane=[].filter.call(document.querySelectorAll('.pane'),function(q){
   return getComputedStyle(q).display!=='none'})[0];
 var first=pane.querySelector('.w,.pw').getBoundingClientRect();
 tops.push(Math.round(b.top)); gaps.push(Math.round(first.top-b.bottom));
 if(panes.scrollHeight>panes.clientHeight+1) bad.push(x.dataset.t);});
document.querySelector('[data-t=home]').click();
document.title='RES headerTop=['+tops.join(',')+'] gapToContent=['+gaps.join(',')
 +'] overflow=['+bad.join(',')+'] err='+(window.__e||'none');
