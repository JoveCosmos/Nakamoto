var p=document.getElementById('cpop');p.classList.add('on');
var box=p.querySelector('.rdgbox'),v=p.querySelector('.rdgv'),u=p.querySelector('.rdgu');
var cap=p.querySelector('.cbcap'),band=p.querySelector('.cband');
var cs=getComputedStyle(box);
var labels=[].map.call(p.querySelectorAll('.vstat .vk'),function(x){return x.textContent.trim()});
var eta=getComputedStyle(document.querySelector('.disc.de')).backgroundColor;
document.title='RES value='+(v?v.textContent:'-')+' unit='+(u?u.textContent:'MISSING')
 +' unitBelow='+(u&&v?(u.getBoundingClientRect().top>=v.getBoundingClientRect().bottom-1):'-')
 +' boxRadius='+cs.borderTopLeftRadius+'/'+cs.borderTopRightRadius
 +' capTag='+getComputedStyle(cap).borderTopWidth+' capCentred='
 +(Math.abs((cap.getBoundingClientRect().left+cap.getBoundingClientRect().width/2)
   -(band.getBoundingClientRect().left+band.getBoundingClientRect().width/2))<2)
 +' etaDisc='+eta.replace(/[a-z() ]/g,'')
 +' labels='+labels.join('|')+' err='+(window.__e||'none');
