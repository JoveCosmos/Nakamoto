var out=[];
document.querySelectorAll('.tabb').forEach(function(x){x.click();
 var p=[].filter.call(document.querySelectorAll('.pane'),function(q){
   return getComputedStyle(q).display!=='none'})[0].getBoundingClientRect();
 out.push(x.dataset.t+':'+Math.round(p.height));});
document.querySelector('[data-t=home]').click();
document.title='RES vh='+window.innerHeight+' panes='+out.join(' ')
 +' maxVH='+(Math.max.apply(null,out.map(function(s){return +s.split(':')[1]}))/window.innerHeight*100).toFixed(1);
