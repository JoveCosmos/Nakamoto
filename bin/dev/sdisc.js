var out=[];
['spop','cpop','qpop'].forEach(function(id){var p=document.getElementById(id);p.classList.add('on');
 var d=p.querySelector('.ck'),g=d.querySelector('.kg');
 var cs=getComputedStyle(g),c=document.createElement('canvas').getContext('2d');
 c.font=cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;
 var m=c.measureText(g.textContent);
 var gb=g.getBoundingClientRect(),db=d.getBoundingClientRect();
 var inkC=gb.left+(m.actualBoundingBoxRight-m.actualBoundingBoxLeft)/2;
 out.push(id+':'+g.textContent.trim()
  +' discW='+db.width.toFixed(1)+' kgW='+gb.width.toFixed(1)+' adv='+m.width.toFixed(1)
  +' kgLeftInDisc='+(gb.left-db.left).toFixed(1)
  +' inkOff='+(inkC-(db.left+db.width/2)).toFixed(2)
  +' display='+cs.display);
 p.classList.remove('on');});
document.title='RES '+out.join(' | ');
