var tabs=[],bad=[],panes=document.querySelector('.panes'),bar=document.querySelector('.brandbar');
var tops=[];
document.querySelectorAll('.tabb').forEach(function(x){x.click();
 tabs.push(x.dataset.t);
 tops.push(Math.round(bar.getBoundingClientRect().top));
 if(panes.scrollHeight>panes.clientHeight+1) bad.push(x.dataset.t+'+'+(panes.scrollHeight-panes.clientHeight));});
document.querySelector('[data-t=eta]').click();
var pn=document.querySelectorAll('#p-eta .panel');
var cols=getComputedStyle(document.querySelector('.duo2')).gridTemplateColumns.split(' ').length;
var svgs=document.querySelectorAll('#p-eta svg[viewBox]');
var h=[].map.call(pn,function(x){return Math.round(x.getBoundingClientRect().height)});
document.querySelector('[data-t=home]').click();
document.title='RES tabs='+tabs.join(',')+' headerTop='+(new Set(tops).size===1?'same '+tops[0]:tops.join('/'))
 +' panels='+pn.length+' cols='+cols+' charts='+svgs.length+' panelH='+h.join('/')
 +' overflow=['+bad.join(',')+'] err='+(window.__e||'none');
