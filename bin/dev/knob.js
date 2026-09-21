var out=[];
['knob','knob3','knob2'].forEach(function(id){
 var k=document.getElementById(id); if(!k){out.push(id+':MISSING');return}
 var g=k.querySelector('.kg'), ks=getComputedStyle(k);
 var gs=g?getComputedStyle(g):null, gr=g?g.getBoundingClientRect():null;
 out.push(id+' text="'+(g?g.textContent.trim():'-')+'"'
  +' bg='+ks.backgroundColor.replace(/[a-z() ]/g,'')
  +' color='+ks.color.replace(/[a-z() ]/g,'')
  +' vis='+ks.visibility+' glyph='+(gr?Math.round(gr.width)+'x'+Math.round(gr.height):'-')
  +' disp='+(gs?gs.display:'-')+' fs='+(gs?gs.fontSize:'-'));});
document.title='RES '+out.join(' | ');
