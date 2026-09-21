var q=document.getElementById('qpop'),c=document.getElementById('cpop'),b=document.getElementById('backq');
document.getElementById('cbtn').click();
var direct=getComputedStyle(b).display;
c.classList.remove('on');
document.getElementById('qbtn').click();
document.getElementById('cgate').click();
var viaEta=getComputedStyle(b).display;
var cOpen=c.classList.contains('on'), qShut=!q.classList.contains('on');
b.click();
var backToEta=q.classList.contains('on'), cShut=!c.classList.contains('on');
document.title='RES directOpen='+direct+' viaEta='+viaEta+' cOpen='+cOpen+' qShut='+qShut
 +' backWorks='+(backToEta&&cShut)+' err='+(window.__e||'none');
