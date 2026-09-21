var out=[],bad=[];
var ids=['qpop','cpop','spop','vpop','pop','hist','apop'];
document.querySelector('.cell').click();               // vpop needs a validator
document.getElementById('vpop').classList.remove('on');
document.getElementById('qbtn').click();
document.getElementById('histbtn').click();
document.querySelector('#hist tbody tr').click();
document.getElementById('pop').classList.remove('on');
document.getElementById('hist').classList.remove('on');
ids.forEach(function(id){
 var p=document.getElementById(id); if(!p){out.push(id+':MISSING');return}
 p.classList.add('on');
 var card=p.querySelector('.card');
 var kids=[].filter.call(card.children,function(c){return c.getBoundingClientRect().height>1});
 var last=kids[kids.length-1];
 var lastCls=(typeof last.className==='string'?last.className.split(' ')[0]:last.tagName);
 var cells=p.querySelectorAll('.vstat');
 var off=0;
 cells.forEach(function(c){
  var v=c.querySelector('.vv'); if(!v) return;
  var cr=c.getBoundingClientRect(),vr=v.getBoundingClientRect();
  if(Math.abs((vr.left+vr.width/2)-(cr.left+cr.width/2))>2) off++;
  if(vr.height>parseFloat(getComputedStyle(v).lineHeight||18)*1.6) bad.push(id+':wrap');});
 out.push(id+' ends='+lastCls+' cells='+cells.length+' offCentre='+off);
 p.classList.remove('on');});
document.title='RES '+out.join(' | ')+' issues='+bad.join(',')+' err='+(window.__e||'none');
