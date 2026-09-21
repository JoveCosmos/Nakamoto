window.dispatchEvent(new Event("resize"));
var c=document.getElementById('calc'), l=document.querySelector('.calclab');
var cs=getComputedStyle(c), r=c.getBoundingClientRect();
var b=document.querySelector('.panes').getBoundingClientRect();
document.title='RES calc='+Math.round(r.width)+'x'+Math.round(r.height)
 +' border='+cs.borderTopWidth+' radius='+cs.borderRadius
 +' label="'+(l?l.textContent:'MISSING')+'" labelY='+(l?Math.round(l.getBoundingClientRect().bottom-r.bottom):'-')
 +' insidePanes='+(r.top>=b.top-1 && r.bottom<=b.bottom+8)
 +' paneh='+getComputedStyle(document.documentElement).getPropertyValue('--paneh').trim()
 +' err='+(window.__e||'none');
