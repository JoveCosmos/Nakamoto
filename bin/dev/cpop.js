var p=document.getElementById('cpop');p.classList.add('on');
var lab=p.querySelector('.rdg .vk'),box=p.querySelector('.rdgbox');
var lb=lab.getBoundingClientRect(),bb=box.getBoundingClientRect();
var div=p.querySelector('.cbx'),svg=div.querySelector('svg');
var d=p.querySelector('.ck'),g=d.querySelector('.kg');
var db=d.getBoundingClientRect(),gb=g.getBoundingClientRect();
var cs=getComputedStyle(g),c=document.createElement('canvas').getContext('2d');
c.font=cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;
var m=c.measureText(g.textContent);
document.title='RES labelGap='+(bb.top-lb.bottom).toFixed(1)
 +' labelBorder='+getComputedStyle(lab).borderTopWidth
 +' labelW='+Math.round(lb.width)+' boxW='+Math.round(bb.width)
 +' divideSVG='+(svg?'yes':'no')+' divideSize='+(svg?Math.round(svg.getBoundingClientRect().width):0)
 +' Cink='+((gb.left+(m.actualBoundingBoxRight-m.actualBoundingBoxLeft)/2)-(db.left+db.width/2)).toFixed(2)
 +' err='+(window.__e||'none');
