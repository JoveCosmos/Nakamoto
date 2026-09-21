document.getElementById('qbtn').click();
var g=document.getElementById('cgate'),cs=getComputedStyle(g);
g.click();
var cOpen=document.getElementById('cpop').classList.contains('on');
var qShut=!document.getElementById('qpop').classList.contains('on');
document.getElementById('cpop').classList.remove('on');
document.getElementById('qbtn').click();
var bullets=[].map.call(document.querySelectorAll('#qpop .bul li'),function(l){return l.innerText.replace(/\s+/g,' ')});
document.title='RES border='+cs.borderTopColor+' cells='+g.children.length
 +' opensC='+cOpen+' closesEta='+qShut
 +' bullet3="'+(bullets[2]||'')+'" err='+(window.__e||'none');
