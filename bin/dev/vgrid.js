document.querySelector('.cell').click();
var g=document.querySelector('#vpop .vgrid'),cs=getComputedStyle(g);
var cells=g.querySelectorAll('.vstat');
var last=cells[cells.length-1].getBoundingClientRect();
var up=document.querySelector('#vpop .upsec').getBoundingClientRect();
document.title='RES borderBottom='+cs.borderBottomWidth+' '+cs.borderBottomColor.replace(/[a-z() ]/g,'')
 +' gapToSigning='+Math.round(up.top-last.bottom)+' cells='+cells.length
 +' err='+(window.__e||'none');
