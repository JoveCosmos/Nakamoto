document.querySelector('[data-t=eta]').click();
var out=[];
document.querySelectorAll('#p-eta .panel').forEach(function(p){
 var t=p.querySelector('.ptitle'),sub=p.querySelector('.sub');
 out.push('"'+t.textContent.trim()+'" title='+getComputedStyle(t).fontSize
  +' text='+(sub?getComputedStyle(sub).fontSize:'-')
  +' ok='+(sub?parseFloat(getComputedStyle(t).fontSize)>parseFloat(getComputedStyle(sub).fontSize):'-'));});
var panes=document.querySelector('.panes');
document.title='RES '+out.join(' | ')+' scroll='+(panes.scrollHeight>panes.clientHeight+1?'YES':'no');
