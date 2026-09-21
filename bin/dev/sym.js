document.querySelector('[data-t=eta]').click();
var sv=document.querySelectorAll('#p-eta svg[viewBox]');
var a=sv[0].getBoundingClientRect(),b=sv[1].getBoundingClientRect();
var p=document.querySelectorAll('#p-eta .panel');
var panes=document.querySelector('.panes');
document.title='RES chartA='+Math.round(a.width)+'x'+Math.round(a.height)
 +' chartB='+Math.round(b.width)+'x'+Math.round(b.height)
 +' sameH='+(Math.abs(a.height-b.height)<2)+' sameTop='+(Math.abs(a.top-b.top)<2)
 +' panels='+Math.round(p[0].getBoundingClientRect().height)+'/'+Math.round(p[1].getBoundingClientRect().height)
 +' over='+(panes.scrollHeight-panes.clientHeight)+' err='+(window.__e||'none');
