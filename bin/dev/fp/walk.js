(function(){
var OUT=[];
function h32(s){ var h=0x811c9dc5>>>0; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return ('0000000'+h.toString(16)).slice(-8); }
function freeze(){ try{ document.getAnimations().forEach(function(a){ try{ a.finish(); }catch(e){ try{ a.pause(); a.currentTime=0; }catch(e2){} } }); }catch(e){} }
var PROPS=null;
function styleStr(cs){ var s=[]; for(var i=0;i<cs.length;i++){ var p=cs[i]; s.push(p+':'+cs.getPropertyValue(p)); } return s.sort().join(';'); }
var ATTRS={"data-tab": ["connect", "dele", "empty", "eta", "home", "intro", "pays"], "hidden": [], "aria-pressed": ["true"], "type": ["range"], "href": [], "data-ui": ["simple"], "viewBox": [], "disabled": [], "data-v": ["setup", "vals"], "data-wallet": [], "data-theme": ["light"], "data-ver": ["pro", "simple"], "data-sc": ["auto", "net", "over"], "aria-selected": ["true"], "data-title-for": ["dashboard", "governance", "staking"], "role": ["tabpanel"], "data-mono": [], "data-sec": ["dashboard", "governance", "staking"], "data-for": ["dashboard", "governance", "staking"], "data-section": ["dashboard", "governance", "staking"], "data-sv": ["dashboard/autopilot", "dashboard/governors", "dashboard/network", "dashboard/overview", "dashboard/votes", "governance/constitution", "governance/core-daos", "governance/governors", "governance/proposals", "staking/bonus", "staking/picks", "staking/trend"], "data-key": ["dashboard/autopilot", "dashboard/governors", "dashboard/network", "dashboard/overview", "dashboard/votes", "governance/constitution", "governance/core-daos", "governance/governors", "governance/proposals", "staking/bonus", "staking/picks", "staking/trend"], "data-svs": ["auto", "net", "over"], "data-var": ["b"]};
function sig(el){
  var p=el.parentElement, i=0, s=el, n=0; while((s=s.previousElementSibling)) i++; s=el; while((s=s.nextElementSibling)) n++;
  var a=''; for(var k in ATTRS){ var v=el.getAttribute(k); if(v===null) continue; a+=k+(ATTRS[k].indexOf(v)>=0?'='+v:'')+';'; }
  var st=el.getAttribute('style'); var sp=st?st.split(';').map(function(x){return x.split(':')[0].trim()}).sort().join(','):'';
  function cl(e){ return (typeof e.className==='string'?e.className:(e.getAttribute('class')||'')).trim().split(/\s+/).sort().join('.'); }
  var ps=p?(p.tagName+'#'+p.id+'.'+cl(p)):'';
  var gp=p&&p.parentElement?(p.parentElement.tagName+'#'+p.parentElement.id+'.'+cl(p.parentElement)):'';
  return el.tagName+'#'+el.id+'.'+cl(el)+'|'+a+'|'+sp+'|'+ps+'|'+gp+'|'+(i<4?i:'m'+(i%2))+(n===0?'L':'')+(n===1?'l':'');
}
function fp(tag){
  freeze();
  var els=[document.documentElement,document.body].concat([].slice.call(document.body.getElementsByTagName('*')));
  var seen={}, lines=[], all='';
  for(var k=0;k<els.length;k++){ var el=els[k]; if(el.id==='fpout') continue;
    var g=sig(el); if(seen[g]) continue; seen[g]=1;
    var s=styleStr(getComputedStyle(el));
    var b=getComputedStyle(el,'::before'), a=getComputedStyle(el,'::after');
    if(b.content!=='none'&&b.content!=='normal') s+='|B|'+styleStr(b);
    if(a.content!=='none'&&a.content!=='normal') s+='|A|'+styleStr(a);
    var hh=h32(s); lines.push(h32(g)+':'+hh); all+=hh; SIGTXT[h32(g)]=g; }
  OUT.push('#STATE '+tag+' n='+lines.length+' all='+h32(all)); OUT.push(lines.join(' '));
}
var SIGTXT={};
function paths(){ var els=[document.documentElement,document.body].concat([].slice.call(document.body.getElementsByTagName('*'))).filter(function(e){return e.id!=='fpout'});
  return els.map(function(el){ var p=[],e=el; while(e&&e!==document.documentElement){ var i=0,s=e; while((s=s.previousElementSibling)) i++; p.unshift(e.tagName.toLowerCase()+(e.id?'#'+e.id:'')+(typeof e.className==='string'&&e.className?'.'+e.className.trim().split(/\s+/).join('.'):'')+'['+i+']'); e=e.parentElement; } return p.join('>'); }).join('\n'); }
var Q=[];
function at(ms,fn){ Q.push([ms,fn]); }
function go(r){ window.__shellGo(r); }
function pop(id){ var p=document.getElementById(id); window.__POP.open(p); }
function closeAll(){ window.__POP.closeAll(); }
var T=0; function step(d,fn){ T+=d; at(T,fn); }
// ── the walk ──
step(1800,function(){ fp('d-bonus'); });
step(200,function(){ var b=document.getElementById('svconn'); if(b) b.click(); });
step(200,function(){ fp('d-walletmenu'); document.body.click(); });
['apr','stake','rank','logo','graph','color'].forEach(function(m){ step(250,function(){ var b=document.querySelector('.mbtn[data-m='+m+']'); if(b) b.click(); }); step(250,function(){ fp('d-mode-'+m); }); });
step(200,function(){ var s=document.getElementById('eta'); s.value=80; s.dispatchEvent(new Event('input',{bubbles:true})); });
step(250,function(){ fp('d-whatif'); window.__resetLive(); });
['staking/trend','staking/picks','governance/proposals','governance/constitution','dashboard/overview','dashboard/autopilot','dashboard/network','dashboard/votes'].forEach(function(r){
  step(450,function(){ go(r); }); step(450,function(){ fp('d-'+r); }); });
step(300,function(){ window.__shellVer('pro'); go('dashboard/overview'); });
step(500,function(){ fp('d-advanced'); window.__shellVer('simple'); go('staking/bonus'); });
['qpop','cpop','spop','hist','gpop'].forEach(function(id){ step(400,function(){ closeAll(); pop(id); }); step(350,function(){ fp('d-pop-'+id); }); });
step(300,function(){ closeAll(); window.__vshow(window.__VALS()[3][3]); });
step(400,function(){ fp('d-pop-vpop'); closeAll(); });
step(300,function(){ var r=document.querySelector('tr.wk'); if(r) r.click(); });
step(400,function(){ fp('d-pop-week'); closeAll(); });
// connect
step(300,function(){ window.__wconnect('Keplr'); });
step(2200,function(){ go('dashboard/overview'); });
step(600,function(){ fp('c-dashboard/overview'); go('dashboard/autopilot'); });
step(600,function(){ fp('c-dashboard/autopilot'); go('dashboard/network'); });
step(600,function(){ fp('c-dashboard/network'); window.__shellVer('pro'); go('dashboard/overview'); });
step(800,function(){ fp('c-advanced'); });
step(300,function(){ var b=document.getElementById('atbtn'); if(b) b.click(); });
step(600,function(){ fp('c-pop-autopilot'); var v=document.querySelector('#atpop .atview [data-v=vals]'); if(v) v.click(); document.querySelector('#atqa [data-q=fit]').click(); });
step(300,function(){ fp('c-pop-autopilot-2'); closeAll(); var b=document.getElementById('stbtn'); if(b) b.click(); });
step(500,function(){ fp('c-pop-stake'); closeAll(); var u=document.querySelector('[data-unstake],#unbtn,.wk-unst'); if(u) u.click(); });
step(500,function(){ fp('c-pop-unstake'); closeAll(); if(window.__optPlan){ window.__optPlan(true); window.__goSign(); } });
step(600,function(){ fp('c-pop-redelegate'); closeAll(); if(window.__alertMany && window.__BOT) window.__alertMany([{id:'x',m:'Val',chex:'ABCDEF12',vid:3}]); });
step(400,function(){ fp('c-pop-alerts'); closeAll(); window.__shellVer('simple'); go('staking/bonus'); });
step(600,function(){ fp('c-bonus');
  var pre=document.createElement('pre'); pre.id='fpout'; pre.textContent=OUT.join('\n')+'\n#SIGS\n'+Object.keys(SIGTXT).map(function(k){return k+' '+SIGTXT[k]}).join('\n'); document.body.appendChild(pre); });
addEventListener('load',function(){ Q.forEach(function(q){ setTimeout(function(){ try{ q[1](); }catch(e){ OUT.push('#ERR '+e.message); } }, q[0]); }); });
})();
