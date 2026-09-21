document.querySelector('[data-t=eta]').click();
document.getElementById('trend').dispatchEvent(new MouseEvent('click',{bubbles:true}));
var g=document.getElementById('gpop'),card=g.querySelector('.card');
var big=document.getElementById('trendbig');
var before=big.getAttribute('viewBox');
big.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,clientX:400,clientY:150,bubbles:true,cancelable:true}));
var after=big.getAttribute('viewBox');
big.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));
document.title='RES open='+g.classList.contains('on')+' header='+(card.querySelector('.vhead')?'STILL':'gone')
 +' reset='+(document.getElementById('gzreset')?'STILL':'gone')
 +' pts='+big.querySelectorAll('circle').length
 +' zoom='+(before!==after)+' dblReset='+(big.getAttribute('viewBox')===before)
 +' err='+(window.__e||'none');
