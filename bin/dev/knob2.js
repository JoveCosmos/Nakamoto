var out=[];
['knob','knob3','knob2'].forEach(function(id){
 var k=document.getElementById(id),g=k.querySelector('.kg');
 var cs=getComputedStyle(g),c=document.createElement('canvas').getContext('2d');
 c.font=cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;
 var m=c.measureText(g.textContent);
 var gb=g.getBoundingClientRect(),kb=k.getBoundingClientRect();
 var inkC=gb.left+(m.actualBoundingBoxRight-m.actualBoundingBoxLeft)/2;
 out.push(id+' dx='+(inkC-(kb.left+kb.width/2)).toFixed(1)
  +' kx='+(g.style.getPropertyValue('--kx')||'unset')
  +' transform='+cs.transform.slice(0,24));});
document.title='RES '+out.join(' | ');
