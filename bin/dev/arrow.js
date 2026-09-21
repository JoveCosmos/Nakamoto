var out=[],clash=[];
document.querySelectorAll('.frow .etabox').forEach(function(b){
 var v=b.querySelector('b'),vr=v.getBoundingClientRect(),br=b.getBoundingClientRect();
 var pad=parseFloat(getComputedStyle(b).paddingRight);
 var gap=(br.right-pad)-vr.right;
 if(gap<0) clash.push(b.querySelector('.disc').innerText.trim()+Math.round(gap));
 out.push(b.querySelector('.disc').innerText.trim()+':gap'+Math.round(gap));});
var tabArrow=getComputedStyle(document.querySelector('.brandbar .tabb'),'::after').content;
var boxArrow=getComputedStyle(document.querySelector('.frow .etabox'),'::after').content;
document.title='RES '+out.join(' ')+' clash=['+clash.join(',')+'] tabArrow='+tabArrow
 +' openerArrow='+boxArrow+' err='+(window.__e||'none');
