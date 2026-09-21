var fails=[], on=function(id){return document.getElementById(id).classList.contains('on');};
function t(n,fn){try{var r=fn(); if(r!==true) fails.push(n+':'+r);}catch(e){fails.push(n+':THREW '+e.message);}}
function esc(){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));}
function outside(id){var p=document.getElementById(id); p.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
function click(id){document.getElementById(id).click();}
var tap=function(inp,knob){var r=document.getElementById(knob).getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2, el=document.getElementById(inp);
  el.dispatchEvent(new PointerEvent('pointerdown',{clientX:x,clientY:y,bubbles:true}));
  el.dispatchEvent(new PointerEvent('pointerup',{clientX:x,clientY:y,bubbles:true}));};
/* eta -> weekly history -> back to eta */
t('q-hist-back',function(){click('qbtn'); if(!on('qpop'))return 'q no'; click('histgo'); if(!on('hist')||on('qpop'))return 'hist '+on('hist')+' q '+on('qpop'); esc(); if(!(on('qpop')&&!on('hist')))return 'after esc q='+on('qpop')+' h='+on('hist'); esc(); return !on('qpop')||'q still on';});
/* eta -> C (gate) -> outside click -> eta */
t('q-c-outside',function(){click('qbtn'); click('cgate'); if(!(on('cpop')&&!on('qpop')))return 'c='+on('cpop')+' q='+on('qpop'); var fq=document.getElementById('cpop').classList.contains('fromq'); outside('cpop'); if(!(on('qpop')&&!on('cpop')))return 'after outside q='+on('qpop')+' c='+on('cpop'); esc(); return (fq&&!on('qpop'))||'fromq='+fq+' q='+on('qpop');});
/* eta -> C -> back button -> eta */
t('q-c-backq',function(){click('qbtn'); click('cgate'); click('backq'); var ok=on('qpop')&&!on('cpop'); esc(); return ok||'q='+on('qpop')+' c='+on('cpop');});
/* C from the page closes to home */
t('c-root',function(){click('cbtn'); var fq=document.getElementById('cpop').classList.contains('fromq'); esc(); return (!fq&&!on('cpop')&&!on('qpop'))||'fq='+fq;});
/* hist -> week row -> esc -> hist -> esc -> home */
t('hist-row',function(){document.querySelector('[data-t=eta]').click(); click('sgohist'); if(!on('hist'))return 'hist no'; document.querySelector('#hist tr.wk').click(); if(!(on('pop')&&!on('hist')))return 'pop='+on('pop')+' h='+on('hist'); esc(); if(!(on('hist')&&!on('pop')))return 'after esc h='+on('hist'); esc(); document.querySelector('[data-t=home]').click(); return !on('hist')||'hist still';});
/* validator -> alert -> esc -> validator -> outside -> home */
t('v-alert',function(){document.querySelector('#g2 .cell').click(); if(!on('vpop'))return 'v no'; click('vbell'); if(!(on('apop')&&!on('vpop')))return 'a='+on('apop')+' v='+on('vpop'); esc(); if(!(on('vpop')&&!on('apop')))return 'after esc v='+on('vpop'); outside('vpop'); return !on('vpop')||'v still';});
/* rank default */
t('rank',function(){document.querySelector('[data-m=rank]').click(); var c=document.querySelectorAll('#g2 .cell'); var ok=c[0].textContent==='#1'&&c[99].textContent==='#100'; document.querySelector('[data-m=color]').click(); return ok||c[0].textContent+'/'+c[99].textContent;});
t('modes-order',function(){return [].map.call(document.querySelectorAll('.mbtn'),function(b){return b.textContent;}).join(',')==='Map,APR,Stake,Rank,Logo,Graph'||'order';});
t('map-material',function(){document.querySelector('[data-m=color]').click(); var c=document.querySelector('#g2 .cell'), cs=getComputedStyle(c); var bg=c.style.backgroundColor; document.querySelector('[data-m=color]').click(); return (cs.backgroundImage!=='none'&&bg.indexOf('rgb')===0&&cs.boxShadow!=='none')||'bi='+cs.backgroundImage.slice(0,20)+' bg='+bg;});
t('map-floor',function(){document.querySelector('[data-m=color]').click(); var c=document.querySelector('#g2 .cell'); var m=c.style.backgroundColor.match(/\d+/g).map(Number); document.querySelector('[data-m=color]').click(); var L=(.2126*m[0]+.7152*m[1]+.0722*m[2])/255; return L>0.06||'first tile '+c.style.backgroundColor;});
t('header',function(){return (document.querySelector('.btx').textContent.trim()==='Nakamoto Bonus'&&!document.querySelector('img.lead')&&document.querySelector('[data-t=home]').textContent==='Bonus')||document.querySelector('.btx').textContent;});
t('eta-card',function(){click('qbtn'); var q=document.getElementById('qpop'); var ks=[].map.call(q.querySelectorAll('.vgrid:not(.gbelow) .vk'),function(k){return k.textContent.replace(/\s+/g,' ').trim();}).join('|');
  var d=q.querySelector('.vhead .disc').getBoundingClientRect(), g=q.querySelector('.vgrid').getBoundingClientRect();
  var b1=q.querySelectorAll('.bul:not(.bul2) li').length, b2=q.querySelectorAll('.bul2 li').length, first=q.querySelector('.bul li').textContent.trim().charCodeAt(0);
  var hb=!!document.getElementById('histbtn'), ow=q.querySelector('.vhead .disc').offsetWidth;
  /* the three heads share one design: a 16px disc at the left edge of the head, the word after it */
  var hl=q.querySelector('.vhead').getBoundingClientRect().left; esc();
  return (ks.indexOf('current|projected|step / week|weeks|floor|cap')===0 && ow===16 && d.left-hl<30 && b1===1 && b2===2 && first===951 && !hb) || 'ks='+ks+' disc-left='+(d.left-hl).toFixed(1)+' w='+ow+' b='+b1+'/'+b2+' first='+first+' hb='+hb;});
t('c-card',function(){click('cbtn'); var c=document.getElementById('cpop'); var caps=[].map.call(c.querySelectorAll('.rdgc'),function(e){return e.textContent;}).join(','); var rows=c.querySelectorAll('.rdgp').length; var dw=c.querySelector('.vhead .disc').offsetWidth, dl=c.querySelector('.vhead .disc').getBoundingClientRect().left-c.querySelector('.vhead').getBoundingClientRect().left; esc(); return (caps==='ATONE,validator,concentration'&&rows===3&&dw===16&&dl<30)||caps+' disc='+dw+'@'+dl.toFixed(1);});
t('s-card',function(){click('sbtn'); var s=document.getElementById('spop'); var ttl=s.querySelector('.ptag').textContent; var dw=s.querySelector('.disc').offsetWidth; esc(); return (ttl==='ATONE staked'&&(dw===16||dw===15))||ttl+' '+dw;});
t('alert-march',function(){var r=document.querySelector('#vbell .march rect'); if(!r)return 'no rect'; var cs=getComputedStyle(r); return (cs.animationName==='march'&&cs.strokeDasharray.indexOf('5')===0)||cs.animationName+' '+cs.strokeDasharray;});
t('wireframe',function(){click('monob'); document.querySelector('[data-m=rank]').click(); var h=document.documentElement.hasAttribute('data-mono'); var vs=getComputedStyle(document.querySelector('.sec')).backgroundColor; var eb=getComputedStyle(document.getElementById('qbtn')).backgroundColor; var cell=getComputedStyle(document.querySelector('#g2 .cell')).backgroundColor; var flt=getComputedStyle(document.querySelector('.below')).filter; document.querySelector('[data-m=color]').click(); click('monob'); return (h&&vs==='rgb(0, 0, 0)'&&eb==='rgba(0, 0, 0, 0)'&&cell==='rgb(0, 0, 0)'&&flt==='none')||'h='+h+' sec='+vs+' eb='+eb+' cell='+cell+' filter='+flt;});

t('hover-band',function(){var c=document.querySelector('#g2 .cell'); c.dispatchEvent(new MouseEvent('mouseover',{bubbles:true})); var t=document.querySelector('.apx').textContent; document.getElementById('g2').dispatchEvent(new MouseEvent('mouseleave')); var back=document.querySelector('.apx').textContent; return (t.indexOf('#1')===0&&t.indexOf('%')>0&&back.indexOf('Smallest')===0)||t+' / '+back;});
t('no-plan',function(){return (!document.querySelector('[data-t=plan]')&&!document.getElementById('p-plan'))||'plan present';});
t('rowbtn',function(){var b=document.getElementById('qbtn'); return (b.closest('.rlab')!==null&&b.textContent.indexOf('bonus share')>=0)||'qbtn not in row';});
document.title='RES '+(fails.length?'FAIL '+fails.length+' :: '+fails.join(' | '):'all pass')+' :: jsErr='+(window.__e||'none');
