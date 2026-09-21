document.querySelector('.cell').click();
var t=document.getElementById('vbell'); t.click();
var p=document.getElementById('apop'),b=document.getElementById('tgbtn');
var open1=p.classList.contains('on');
var h1=b.getAttribute('href');
var boxes=[].slice.call(p.querySelectorAll('.aopt input'));
boxes[2].checked=true; boxes[2].dispatchEvent(new Event('change'));
var h2=b.getAttribute('href');
boxes.forEach(function(x){x.checked=false;x.dispatchEvent(new Event('change'))});
var off=b.className;
document.title='RES open='+open1+' who="'+document.getElementById('aval').textContent+'"'
 +' h1='+(h1?h1.split('start=')[1]:'none')
 +' h2='+(h2?h2.split('start=')[1]:'none')
 +' noneSelected='+off+' err='+(window.__e||'none');
