document.getElementById('qbtn').click();
var p=document.getElementById('qpop');
var cur=p.querySelector('.vstat.hot');
document.title='RES pill='+(p.querySelector('.ptag')?'STILL':'gone')
 +' disc='+(p.querySelector('.ck')?'yes':'no')
 +' current="'+cur.querySelector('.vv').innerText.replace(/\s+/g,' ')+'"'
 +' err='+(window.__e||'none');
