document.querySelector('[data-t=eta]').click();
var mv=document.querySelector('#p-eta .sbox.mv');
var cells=[].map.call(mv.children,function(c){
 return c.querySelector('.v').textContent+' '+c.querySelector('.k').textContent;});
var chip=document.querySelector('.chiprow .chip');
var cs=getComputedStyle(chip.querySelector('span'));
var panes=document.querySelector('.panes');
document.title='RES boxes='+cells.join(' | ')+' chipLabel='+cs.fontSize+' '+cs.color.replace(/[a-z() ]/g,'')
 +' gap='+getComputedStyle(chip).gap+' over='+(panes.scrollHeight-panes.clientHeight);
