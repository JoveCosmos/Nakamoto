document.querySelector('[data-t=pays]').click();
var panes=document.querySelector('.panes'),w=panes.firstElementChild;
var parts=[];
document.querySelectorAll('#p-pays .pw > *').forEach(function(c){
 parts.push((c.className||c.tagName).split(' ')[0]+':'+Math.round(c.getBoundingClientRect().height));});
document.title='RES over='+(panes.scrollHeight-panes.clientHeight)+' used='
 +Math.round(w.getBoundingClientRect().height)+' frame='+panes.clientHeight+' | '+parts.join(' ');
