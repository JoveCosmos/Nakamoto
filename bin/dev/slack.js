document.querySelector('[data-t=home]').click();
var panes=document.querySelector('.panes'),w=document.querySelector('.panes').firstElementChild;
var g=document.getElementById('gwrap').getBoundingClientRect();
var cell=document.querySelector('.cell').getBoundingClientRect();
var free=panes.clientHeight-w.getBoundingClientRect().height;
document.title='RES vh='+window.innerHeight+' frame='+panes.clientHeight
 +' used='+Math.round(w.getBoundingClientRect().height)+' free='+Math.round(free)
 +' map='+Math.round(g.width)+'x'+Math.round(g.height)
 +' cell='+Math.round(cell.width)+'x'+Math.round(cell.height);
