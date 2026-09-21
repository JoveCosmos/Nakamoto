document.querySelector('.cell').click();
var b=document.getElementById('vbell'),head=document.querySelector('.pinghead');
var grid=document.querySelector('#vpop .vgrid');
var br=b.getBoundingClientRect(),hr=head.getBoundingClientRect(),gr=grid.getBoundingClientRect();
var cs=getComputedStyle(b);
document.title='RES offFromCardMid='+(((br.left+br.width/2)-(gr.left+gr.width/2))).toFixed(1)
 +' offFromHeadMid='+(((br.left+br.width/2)-(hr.left+hr.width/2))).toFixed(1)
 +' topVsHead='+Math.round(br.top-hr.top)
 +' size='+Math.round(br.width)+'x'+Math.round(br.height)
 +' border='+cs.borderTopWidth+' bg='+cs.backgroundColor.replace(/[a-z() ]/g,'');
