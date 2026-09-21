var out=[],bad=0;
document.querySelectorAll('.tabb').forEach(function(b){
 var r=b.getBoundingClientRect(),g=document.createRange();
 g.selectNodeContents(b);
 var t=g.getBoundingClientRect();
 var off=((t.left+t.width/2)-(r.left+r.width/2));
 if(Math.abs(off)>1.5) bad++;
 out.push(b.dataset.t+':'+off.toFixed(1));});
document.title='RES offsets='+out.join(' ')+' bad='+bad;
