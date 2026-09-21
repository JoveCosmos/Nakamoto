window.dispatchEvent(new Event("resize"));
var out=[],bad=0;
[['eta','knob'],['concr','knob3'],['bondr','knob2']].forEach(function(p){
 var i=document.getElementById(p[0]),k=document.getElementById(p[1]);
 var ir=i.getBoundingClientRect(),kr=k.getBoundingClientRect();
 var t=(i.value-i.min)/(i.max-i.min);
 var want=ir.left+12+t*(ir.width-24);
 var off=(kr.left+kr.width/2)-want;
 if(Math.abs(off)>1.5) bad++;
 var ks=getComputedStyle(k);
 out.push(p[1]+' off'+off.toFixed(1)+' vis='+ks.visibility+' bg='+ks.backgroundColor.replace(/[a-z() ]/g,''));});
document.title='RES '+out.join(' | ')+' bad='+bad+' err='+(window.__e||'none');
