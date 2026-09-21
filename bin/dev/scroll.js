window.dispatchEvent(new Event("resize"));
var ID={home:'p-home',eta:'p-eta',pays:'p-pays'}, o=[];
Object.keys(ID).forEach(function(t){
  document.querySelector('[data-t='+t+']').click();
  var p=document.getElementById(ID[t]);
  o.push(t+' h='+Math.round(p.clientHeight)+' content='+p.scrollHeight
   +(p.scrollHeight>p.clientHeight+1?' SCROLLS':' no-scroll')
   +' ovf='+getComputedStyle(p).overflowY);
});
var sv=document.getElementById('trend');
o.push('trendSvg='+sv.getAttribute('viewBox')+' h='+Math.round(sv.getBoundingClientRect().height));
o.push('rows='+document.querySelectorAll('#p-pays .ptab tbody tr').length);
o.push('docScroll='+(document.documentElement.scrollHeight>window.innerHeight?'YES':'no'));
document.querySelector('[data-t=home]').click();
document.title='RES win='+window.innerHeight+' | '+o.join(' | ');
