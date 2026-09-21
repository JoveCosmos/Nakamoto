document.querySelector('[data-t=eta]').click();
var pn=document.querySelectorAll('#p-eta .panel');
var out=[];
pn.forEach(function(p,i){
 var b=p.querySelector('.sbox');
 var cells=b?[].map.call(b.children,function(c){
   return c.querySelector('.v').textContent+'/'+c.querySelector('.k').textContent}):[];
 var r=b?b.getBoundingClientRect():null;
 out.push('P'+i+' cells='+cells.length+' box='+(r?Math.round(r.width)+'x'+Math.round(r.height):'-')
  +' ['+cells.join(' , ')+']');});
var panes=document.querySelector('.panes');
document.title='RES '+out.join(' | ')+' over='+(panes.scrollHeight-panes.clientHeight);
