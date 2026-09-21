document.querySelector('.cell').click();
document.getElementById('vbell').click();
var p=document.getElementById('apop');
var lg=document.getElementById('alogo'),mo=document.getElementById('amono');
document.title='RES pill='+(p.querySelector('.ptag')?'STILL':'gone')
 +' name="'+document.getElementById('aval').textContent+'"'
 +' logo='+(lg.getAttribute('src')?'img':'mono:'+mo.textContent)
 +' shown='+(lg.style.display!=='none'?'img':'mono')

 +' err='+(window.__e||'none');
