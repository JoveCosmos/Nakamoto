window.dispatchEvent(new Event("resize"));
document.querySelector('[data-t=home]').click();
var g=document.getElementById('gwrap'),c=document.getElementById('foldchart');
var pane=document.getElementById('p-home');
var h0=Math.round(g.getBoundingClientRect().height);
var p0=Math.round(pane.getBoundingClientRect().height);
document.querySelector('[data-m=graph]').click();
var h1=Math.round(c.getBoundingClientRect().height);
var p1=Math.round(pane.getBoundingClientRect().height);
document.querySelector('[data-m=logo]').click();
var h2=Math.round(g.getBoundingClientRect().height), p2=Math.round(pane.getBoundingClientRect().height);
document.querySelector('[data-m=color]').click();
document.title='RES map='+h0+' graph='+h1+' vals='+h2+' delta='+(h1-h0)
 +' paneH='+p0+'/'+p1+'/'+p2+' shifts='+(p0!==p1||p1!==p2)
 +' vb='+c.getAttribute('viewBox');
