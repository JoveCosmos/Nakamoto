document.querySelector('[data-t=pays]').click();
var out=[];
document.querySelectorAll('#p-pays .ptw').forEach(function(w){
 var cap=w.previousElementSibling.innerText.replace(/\s+/g,' ');
 var r=w.querySelector('tbody tr');
 out.push(cap+' ['+[].map.call(r.children,function(c){return c.innerText.trim()}).join('/')+']');});
var panes=document.querySelector('.panes');
var cols=getComputedStyle(document.querySelector('.duotab')).gridTemplateColumns.split(' ').length;
document.getElementById('qbtn').click();document.getElementById('histbtn').click();
document.querySelector('#hist tbody tr').click();
var dl=[].map.call(document.querySelectorAll('#pop .vk'),function(x){return x.textContent.trim()});
document.title='RES cols='+cols+' | '+out.join(' | ')+' | weekCard='+dl.join(',')
 +' scroll='+(panes.scrollHeight>panes.clientHeight+1?'YES':'no')+' err='+(window.__e||'none');
