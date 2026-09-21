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

/* the wallet section: its own classes, nothing shared with the calculator */
t('wallet-gate', function(){
  var root=document.documentElement; root.setAttribute('data-tab','dele');   /* the flip is animated; the attribute is the state */
  /* the gate is the left pane: a Connect button in its centre, the two tiles once tapped,
     the account block hidden; the right pane already lists the chain's validators */
  var g=document.getElementById('wgate'), a=document.getElementById('wk-acct'), btn=document.getElementById('wconn'), p=document.getElementById('wpick');
  var rows=document.querySelectorAll('#dpicks tbody tr').length, cap=!document.getElementById('dcap');   /* the count line is gone from the page */
  btn.click();
  var c=p.getBoundingClientRect(), tiles=p.querySelectorAll('.wopt').length;
  var ok=!g.hidden && a.hidden && btn.hidden && !p.hidden && c.height>120 && tiles===2 && rows>=90 && cap;
  btn.hidden=false; p.hidden=true;
  root.setAttribute('data-tab','home');
  return ok || 'gate '+g.hidden+' acct '+a.hidden+' btn '+btn.hidden+' card '+Math.round(c.height)+' tiles '+tiles+' rows '+rows+' cap '+cap;
});

document.title='RES '+(fails.length? 'FAIL '+fails.length+' :: '+fails.join(' | ')
                                   : 'all pass')+' :: jsErr='+(window.__e||'none');
