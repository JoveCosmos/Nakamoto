var fails=[], log=[];
function t(name, fn){ try{ var r=fn(); if(r!==true) fails.push(name+':'+r); }catch(e){ fails.push(name+':THREW '+e.message); } }
window.dispatchEvent(new Event("resize"));
/* no animation: a change of section (the window's fall) then completes on the spot */
(function(){ var s=document.createElement('style'); s.textContent='*{transition:none!important;animation:none!important}'; document.head.appendChild(s); })();
function go(r){ window.__shellGo(r); }
/* the testnet page (web/testnet): its set is smaller and what only the index knows is N/A */
var TESTNET = document.documentElement.getAttribute('data-net') === 'testnet';

/* the staking views, through their level-2 tabs */
['bonus','trend','picks'].forEach(function(k){
  t('tab-'+k, function(){
    document.getElementById('l2-staking-'+k).click();
    var p=document.getElementById({bonus:'p-home',trend:'p-eta',picks:'p-pays'}[k]);
    return p.getBoundingClientRect().height>100 || 'pane '+p.getBoundingClientRect().height;
  });
});
go('staking/bonus');

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
  go('staking/picks');
  var r=document.querySelectorAll('#p-pays .ptab tbody tr').length;
  var l=document.querySelectorAll('#p-pays .ptab .tlg').length;
  var ph=document.querySelectorAll('#p-pays .ptab tbody tr.phr').length;
  if(TESTNET) return (r===15 && ph===10) || 'testnet rows='+r+' placeholders='+ph;   /* five rows each, history rows as placeholders */
  return (r===15 && l===15) || 'rows='+r+' logos='+l;   /* three lists of five */
});
t('trend-charts', function(){
  go('staking/trend');
  return (document.querySelectorAll('#etacurve *').length>10
       && (TESTNET || document.querySelectorAll('#trend *').length>10)) || 'a chart is empty';
});
go('staking/bonus');

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
  var root=document.documentElement; go('dashboard/self');
  var g=document.getElementById('wgate'), a=document.getElementById('wk-acct');
  var skel=document.querySelectorAll('#dmy tr.skel').length;
  var rows=document.querySelectorAll('#dpicks tbody tr').length, cap=!document.getElementById('dcap');   /* the count line is gone from the page */
  var conn=document.getElementById('svconn'), bar=document.querySelector('.folder .hdr-r');
  var barShown=!!bar && getComputedStyle(bar).display!=='none' && bar.contains(conn);
  conn.click();
  var menu=document.getElementById('svmenu'), tiles=menu.querySelectorAll('[data-w]').length;
  var ok=!g && !document.getElementById('wdisc') && !a.hidden && skel===5 && rows>=(TESTNET ? 40 : 90) && cap && barShown && !conn.hidden && !menu.hidden && tiles===2;
  menu.hidden=true; menu.innerHTML='';
  go('staking/bonus');
  return ok || 'gate '+!!g+' acct '+a.hidden+' skel '+skel+' rows '+rows+' cap '+cap+' bar '+barShown+' conn '+conn.hidden+' tiles '+tiles;
});

/* the dashboard's two views share one window: the same box, one at a time */
t('simple-view', function(){
  go('dashboard/self');
  var pane=document.getElementById('p-dele'), sv=document.getElementById('sv');
  var advBox=pane.getBoundingClientRect();
  go('dashboard/wallet');
  var svBox=sv.getBoundingClientRect(), paneGone=getComputedStyle(pane).display==='none';
  /* the three screens, one shown at a time, each its own level-2 view */
  var seen=[];
  [['dashboard/wallet','sv-over'],['dashboard/autopilot','sv-auto'],['network/uptime','sv-net']].forEach(function(k){
    go(k[0]);
    var id=k[1];
    seen.push([].filter.call(document.querySelectorAll('.sv-screen'),function(x){ return getComputedStyle(x).display!=='none'; }).map(function(x){ return x.id; }).join()===id);
  });
  go('staking/bonus');
  /* the fixed frame is the desktop's; below 901 both views are content-height and
     the page scrolls, so only the switch itself is asserted there */
  var same=innerWidth<901 || (Math.abs(advBox.left-svBox.left)<1 && Math.abs(advBox.top-svBox.top)<1 &&
           Math.abs(advBox.width-svBox.width)<1 && Math.abs(advBox.height-svBox.height)<1);
  return (same && paneGone && seen.every(Boolean)) ||
    'box '+[advBox.left,advBox.top,advBox.width,advBox.height].map(Math.round)+' vs '+
    [svBox.left,svBox.top,svBox.width,svBox.height].map(Math.round)+' paneGone '+paneGone+' screens '+seen;
});

/* ── the navigation shell (shell.json): the spec's acceptance, checked from the config ── */
var CFG=window.__SHELL, SECS=CFG.sections;
t('shell-from-config', function(){
  var l1=[].map.call(document.querySelectorAll('.l1tab .l1lbl'),function(x){ return x.textContent; }).join('|');
  var want1=SECS.map(function(s){ return s.label; }).join('|');
  var bad=[];
  SECS.forEach(function(s){
    var got=[].map.call(document.querySelectorAll('.l2[data-for="'+s.id+'"] .l2tab'),function(b){ return b.textContent; }).join('|');
    var want=s.sub.map(function(v){ return v.label; }).join('|');
    if(got!==want) bad.push(s.id+':'+got);
  });
  return (l1===want1 && !bad.length) || 'l1 '+l1+' l2 '+bad.join(' ');
});
t('shell-one-strip', function(){
  var bad=[];
  function shown(){ return [].filter.call(document.querySelectorAll('.l2'),function(l){ return getComputedStyle(l).display!=='none'; }).map(function(l){ return l.dataset.for; }); }
  /* a section with one view and no switch shows no strip at all */
  SECS.forEach(function(s){ go(s.route+'/'+s.sub[0].route); var v=shown(), want=(s.sub.length>1||s.version)?s.id:''; if(v.join()!==want) bad.push(s.id+'->'+v.join()); });
  go('intro'); if(shown().length) bad.push('intro->'+shown().join());
  go('staking/bonus');
  return !bad.length || bad.join(' ');
});
t('shell-every-view-renders', function(){
  var bad=[];
  SECS.forEach(function(s){ s.sub.forEach(function(v){
    go(s.route+'/'+v.route);
    /* a view that is off cannot be open: its route lands on the section's first view */
    if(v.off){ if(location.hash!=='#/'+s.route+'/'+s.sub[0].route) bad.push(s.id+'/'+v.id+' (off, opened '+location.hash+')'); return; }
    var R=document.documentElement, ok=location.hash==='#/'+s.route+'/'+v.route && R.getAttribute('data-sv')===s.id+'/'+v.id;
    var p=document.getElementById(v.panel||'p-empty'), r=p&&p.getBoundingClientRect();
    if(!ok || !p || r.height<60 || !p.textContent.trim()) bad.push(s.id+'/'+v.id+(ok?'':' (route)')+(p?' h'+Math.round(r.height):' (no panel)'));
    if(!v.tab && document.getElementById('shellempty').textContent.indexOf(v.empty.title)<0) bad.push(s.id+'/'+v.id+' (empty state)');
  }); });
  go('staking/bonus');
  return !bad.length || bad.join(', ');
});
t('shell-aria', function(){
  var bad=[];
  document.querySelectorAll('[role=tablist]').forEach(function(l){
    var tabs=l.querySelectorAll('[role=tab]'), zero=[].filter.call(tabs,function(b){ return b.tabIndex===0; }).length;
    if(zero!==1) bad.push((l.dataset.for||'l1')+' has '+zero+' Tab stops');
    tabs.forEach(function(b){
      var c=b.getAttribute('aria-controls');
      if(!c || !document.getElementById(c)) bad.push(b.id+' controls '+c);
      if(!/^(true|false)$/.test(b.getAttribute('aria-selected'))) bad.push(b.id+' aria-selected');
      if(!b.textContent.trim()) bad.push(b.id+' has no text');
      var h=parseFloat(getComputedStyle(b,'::after').height), w=b.getBoundingClientRect().width;
      if(b.offsetParent && (!(h>=44) || w<44)) bad.push(b.id+' target '+h+'x'+Math.round(w));   /* strips on screen; a hidden one has no box */
    });
  });
  document.querySelectorAll('[role=tabpanel]').forEach(function(p){
    var lb=p.getAttribute('aria-labelledby'); if(lb && !document.getElementById(lb)) bad.push(p.id+' labelledby '+lb);
  });
  return !bad.length || bad.join(', ');
});
/* the dashboard's group switch: Staking | Governance ends the title row and chooses which
   group's tabs the row shows; Self (the three panes) is Staking's third view; Governance's
   views are announced, not built, so its option and its tabs are greyed and inert */
t('shell-groups', function(){
  /* the Dashboard is one row of four views - Overview, Manage, Autopilot, Governance - no group switch */
  var R=document.documentElement, bad=[];
  function vis(id){ var e=document.getElementById(id); return !!e && e.offsetParent!==null && e.getBoundingClientRect().height>0; }
  function tabs(){ return [].filter.call(document.querySelectorAll('.l2[data-for=dashboard] .l2tab'),function(b){ return b.offsetParent!==null; }).map(function(b){ return b.dataset.sub; }).join(); }
  go('dashboard/wallet');
  var sw=document.querySelector('.l2ver[data-for=dashboard]');
  if(sw && sw.offsetParent!==null) bad.push('a group switch is shown');
  if(tabs()!=='overview,self,autopilot,governors') bad.push('tabs '+tabs());
  if(!vis('sv-over') || vis('p-dele')) bad.push('overview is not the simple screen');
  document.getElementById('l2-dashboard-self').click();
  if(location.hash!=='#/dashboard/self' || !vis('p-dele') || vis('sv')) bad.push('manage is not the three panes '+location.hash);
  document.getElementById('l2-dashboard-governors').click();
  if(location.hash!=='#/dashboard/governance' || !vis('sv-mygov')) bad.push('governance page '+location.hash);
  go('network/uptime'); if(location.hash!=='#/network/uptime' || !vis('sv-net')) bad.push('network '+location.hash);
  go('staking/bonus');
  return !bad.length || bad.join(', ');
});
t('shell-no-sideways-page', function(){
  return document.documentElement.scrollWidth<=innerWidth+1 || 'page is '+document.documentElement.scrollWidth+' wide in '+innerWidth;
});
go('staking/bonus');

document.title='RES '+(fails.length? 'FAIL '+fails.length+' :: '+fails.join(' | ')
                                   : 'all pass')+' :: jsErr='+(window.__e||'none');
