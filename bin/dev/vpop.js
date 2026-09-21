document.querySelector('.cell').click();
var b=document.querySelector('#vpop .aprband');
var big=getComputedStyle(document.getElementById('vapr')).fontSize;
var sub=getComputedStyle(document.querySelector('#vpop .aprx b')).fontSize;
document.title='RES row="'+b.innerText.replace(/\s+/g,' ')+'" big='+big+' sub='+sub
 +' quieter='+(parseFloat(big)>parseFloat(sub))+' err='+(window.__e||'none');
