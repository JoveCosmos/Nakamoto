var fails=[], log=[];
function t(name, fn){ try{ var r=fn(); if(r!==true) fails.push(name+':'+r); }catch(e){ fails.push(name+':THREW '+e.message); } }
window.dispatchEvent(new Event("resize"));

/* tabs */
['home','eta','pays'].forEach(function(k){
  t('tab-'+k, function(){
    document.querySelector('[data-t='+k+']').click();
    var p=document.getElementById({home:'p-home',eta:'p-eta',pays:'p-pays'}[k]);
    return p.getBoundingClientRect().height>100 || 'pane '+p.getBoundingClientRect().height;
  });
});
document.querySelector('[data-t=home]').click();

/* map modes */
['color','apr','stake','rank','logo','graph'].forEach(function(m){
  t('mode-'+m, function(){
    document.querySelector('[data-m='+m+']').click();
    if(m==='graph') return document.querySelectorAll('#foldchart *').length>10 || 'empty chart';
    return document.querySelectorAll('#g2 .cell').length===100 || 'cells';
  });
});
document.querySelector('[data-m=color]').click();

/* popups open and close */
[['qbtn','qpop'],['cbtn','cpop'],['sbtn','spop']].forEach(function(p){
  t('pop-'+p[1], function(){
    document.getElementById(p[0]).click();
    var on=document.getElementById(p[1]).classList.contains('on');
    window.__POP.close();
    return on || 'did not open';
  });
});
t('pop-vpop', function(){
  document.querySelector('#g2 .cell').click();
  var v=document.getElementById('vpop');
  var ok=v.classList.contains('on') && document.getElementById('vname').textContent.length>0;
  window.__POP.close(); return ok || 'no validator card';
});

/* sliders drive every readout */
t('eta-slider', function(){
  var sl=document.getElementById('eta'), before=document.getElementById('aprhi').textContent;
  sl.value=80; sl.dispatchEvent(new Event('input',{bubbles:true}));
  var after=document.getElementById('aprhi').textContent;
  sl.value=11; sl.dispatchEvent(new Event('input',{bubbles:true}));
  return before!==after || 'apr band did not move';
});
t('conc-track', function(){
  var n=[], cr=document.getElementById('concr');
  [100,299,cr.value].forEach(function(c,i){
    if(i===2){ window.__resetLive(); } else { cr.value=c; cr.dispatchEvent(new Event('input',{bubbles:true})); }
    n.push(document.getElementById('ctop').textContent);
  });
  return (n[0]!==n[1] && n[1]!==n[2]) || 'concentration stuck: '+n.join('/');
});
t('halt-fixed', function(){
  var cr=document.getElementById('concr'), n=[];
  [299,100].forEach(function(c){ cr.value=c; cr.dispatchEvent(new Event('input',{bubbles:true})); n.push(document.querySelectorAll('#g2 .cell.halt').length); });
  window.__resetLive(); n.push(document.querySelectorAll('#g2 .cell.halt').length);
  return (n[0]>0 && n[0]===n[1] && n[1]===n[2]) || 'halt moved with the set: '+n.join('/');
});
t('whatif-reset', function(){
  var sl=document.getElementById('eta'); sl.value=80; sl.dispatchEvent(new Event('input',{bubbles:true}));
  var d1=document.documentElement.hasAttribute('data-dirty');
  window.__resetLive();
  var d2=document.documentElement.hasAttribute('data-dirty');
  return (d1 && !d2) || 'dirty '+d1+'/'+d2;
});

/* tables */
t('picks-tables', function(){
  document.querySelector('[data-t=pays]').click();
  var r=document.querySelectorAll('#p-pays .ptab tbody tr').length;
  var l=document.querySelectorAll('#p-pays .ptab .tlg').length;
  return (r===15 && l===15) || 'rows='+r+' logos='+l;   /* three lists of five */
});
t('trend-charts', function(){
  document.querySelector('[data-t=eta]').click();
  return (document.querySelectorAll('#etacurve *').length>10
       && document.querySelectorAll('#trend *').length>10) || 'a chart is empty';
});
document.querySelector('[data-t=home]').click();

/* the three discs draw their glyph in the middle: a stray rule on a shared
   class name once turned the C disc into a flex column and lifted its glyph */
['de','dc','ds'].forEach(function(k){
  t('disc-'+k, function(){
    var d=document.querySelector('.wrow .disc.'+k), u=d.querySelector('use');
    var a=d.getBoundingClientRect(), b=u.getBoundingClientRect();
    var dx=(b.left+b.width/2)-(a.left+a.width/2), dy=(b.top+b.height/2)-(a.top+a.height/2);
    return (Math.abs(dx)<=1 && Math.abs(dy)<=1) || 'glyph off by '+dx.toFixed(2)+','+dy.toFixed(2);
  });
});

/* the wallet section: no gate of its own any more - the sub-header is the only door,
   and the pane stands with its structure (a skeleton) until a wallet fills it */
t('wallet-door', function(){
  var root=document.documentElement; root.setAttribute('data-tab','dele');   /* the flip is animated; the attribute is the state */
  var g=document.getElementById('wgate'), a=document.getElementById('wk-acct');
  var skel=document.querySelectorAll('#dmy tr.skel').length;
  var rows=document.querySelectorAll('#dpicks tbody tr').length, cap=!document.getElementById('dcap');   /* the count line is gone from the page */
  var conn=document.getElementById('svconn'), bar=document.getElementById('svbar');
  var barShown=getComputedStyle(bar).display!=='none';
  conn.click();
  var menu=document.getElementById('svmenu'), tiles=menu.querySelectorAll('[data-w]').length;
  var ok=g.hidden && !a.hidden && skel===5 && rows>=90 && cap && barShown && !conn.hidden && !menu.hidden && tiles===2;
  menu.hidden=true; menu.innerHTML='';
  root.setAttribute('data-tab','home');
  return ok || 'gate '+g.hidden+' acct '+a.hidden+' skel '+skel+' rows '+rows+' cap '+cap+' bar '+barShown+' conn '+conn.hidden+' tiles '+tiles;
});

/* the dashboard's two views share one window: the same box, one at a time */
t('simple-view', function(){
  var root=document.documentElement, was=root.getAttribute('data-ui');
  root.setAttribute('data-tab','dele');
  var pane=document.getElementById('p-dele'), sv=document.getElementById('sv');
  var advBox=pane.getBoundingClientRect();
  root.setAttribute('data-ui','simple');
  var svBox=sv.getBoundingClientRect(), paneGone=getComputedStyle(pane).display==='none';
  /* the three screens, one shown at a time */
  var seen=[];
  ['over','auto','net'].forEach(function(k){
    sv.setAttribute('data-s',k);
    seen.push(document.querySelectorAll('.sv-screen').length===3 &&
      getComputedStyle(document.querySelector('.sv-screen[data-sc='+k+']')).display!=='none');
  });
  sv.setAttribute('data-s','over');
  if(was) root.setAttribute('data-ui',was); else root.removeAttribute('data-ui');
  root.setAttribute('data-tab','home');
  /* the fixed frame is the desktop's; below 901 both views are content-height and
     the page scrolls, so only the switch itself is asserted there */
  var same=innerWidth<901 || (Math.abs(advBox.left-svBox.left)<1 && Math.abs(advBox.top-svBox.top)<1 &&
           Math.abs(advBox.width-svBox.width)<1 && Math.abs(advBox.height-svBox.height)<1);
  return (same && paneGone && seen.every(Boolean)) ||
    'box '+[advBox.left,advBox.top,advBox.width,advBox.height].map(Math.round)+' vs '+
    [svBox.left,svBox.top,svBox.width,svBox.height].map(Math.round)+' paneGone '+paneGone+' screens '+seen;
});

document.title='RES '+(fails.length? 'FAIL '+fails.length+' :: '+fails.join(' | ')
                                   : 'all pass')+' :: jsErr='+(window.__e||'none');
