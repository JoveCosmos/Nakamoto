document.querySelector('.cell').click();
var b=document.getElementById('vbell'),grid=document.querySelector('#vpop .vgrid');
var bars=document.getElementById('ubping');
var cells=grid.querySelectorAll('.vstat');
var last=cells[cells.length-1].getBoundingClientRect();
var lastTxt=cells[cells.length-1].querySelector('.vv').getBoundingClientRect();
var br=b.getBoundingClientRect(),gr=grid.getBoundingClientRect(),ar=bars.getBoundingClientRect();
document.title='RES btnMid='+Math.round(br.top+br.height/2)+' border='+Math.round(gr.bottom)
 +' barsTop='+Math.round(ar.top)+' onBorder='+(Math.abs((br.top+br.height/2)-gr.bottom)<3)
 +' overlapsText='+(br.top<lastTxt.bottom&&br.right>lastTxt.left&&br.left<lastTxt.right);
