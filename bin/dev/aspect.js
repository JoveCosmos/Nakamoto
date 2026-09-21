document.querySelector('[data-t=home]').click();
var g=document.getElementById('gwrap').getBoundingClientRect();
var c=document.querySelector('.cell').getBoundingClientRect();
var panes=document.querySelector('.panes'),w=panes.firstElementChild.getBoundingClientRect();
var sec=document.querySelector('.sec.fw').getBoundingClientRect();
document.title='RES vh='+window.innerHeight+' shell='+Math.round(document.getElementById('below').getBoundingClientRect().width)
 +' gutterL='+Math.round(sec.left)+' map='+Math.round(g.width)+'x'+Math.round(g.height)
 +' cell='+c.width.toFixed(1)+'x'+c.height.toFixed(1)+' ratio='+(c.width/c.height).toFixed(2)
 +' free='+Math.round(panes.clientHeight-w.height);
