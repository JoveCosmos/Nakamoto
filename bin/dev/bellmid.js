document.querySelector('.cell').click();
var b=document.getElementById('vbell'),grid=document.querySelector('#vpop .vgrid');
var bars=document.getElementById('ubping');
var br=b.getBoundingClientRect(),gr=grid.getBoundingClientRect(),ar=bars.getBoundingClientRect();
document.title='RES gridBottom='+Math.round(gr.bottom)+' barsTop='+Math.round(ar.top)
 +' btn='+Math.round(br.top)+'-'+Math.round(br.bottom)+' mid='+Math.round(br.top+br.height/2)
 +' wantMid='+Math.round((gr.bottom+ar.top)/2)
 +' delta='+Math.round((gr.bottom+ar.top)/2-(br.top+br.height/2));
