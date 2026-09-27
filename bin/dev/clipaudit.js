/* clipaudit.js - the probe snippet for clipaudit.sh (ROUTE is replaced per run): every piece of visible text
   that sits below a clipping box or the bottom of the screen with no scroll to reach it. */
window.keplr={enable:function(){return Promise.resolve()},getKey:function(){return Promise.resolve({name:"demo",bech32Address:"atone14y3usgepvcxxs6jkjqwhuyjy6eyhu7rkvpg2a7",pubKey:new Uint8Array(33)})},signDirect:function(){return Promise.reject(new Error("no"))}};
setTimeout(function(){window.__wconnect("Keplr");},50);
setTimeout(function(){ __shellGo("ROUTE"); },900);
setTimeout(function(){
 var VH=innerHeight, out=[], seen=0;
 function ownText(e){ for(var n=e.firstChild;n;n=n.nextSibling) if(n.nodeType===3 && n.nodeValue.trim()) return n.nodeValue.trim(); return ""; }
 var all=document.body.getElementsByTagName('*');
 for(var i=0;i<all.length;i++){ var e=all[i], t=ownText(e); if(!t) continue;
   if(e.closest('.pop:not(.on)') || e.closest('script,style,noscript,title,svg defs')) continue;
   var cs=getComputedStyle(e); if(cs.visibility==='hidden' || +cs.opacity===0) continue;
   var r=e.getBoundingClientRect(); if(r.width<1||r.height<1) continue;
   /* hidden pane? any ancestor display none gives zero rect, skipped above */
   var why="", a=e.parentElement, ok=false;
   while(a && a!==document.documentElement){ var as=getComputedStyle(a), oy=as.overflowY;
     if(oy==='auto'||oy==='scroll'){ if(a.scrollHeight>a.clientHeight+1){ ok=true; break; } }
     if(oy==='hidden'||oy==='clip'||oy==='auto'||oy==='scroll'){ var ar=a.getBoundingClientRect();
       if(r.top>=ar.bottom-1){ why='below '+(a.id?'#'+a.id:a.className.split(' ')[0]||a.tagName); break; }
       if(r.bottom>ar.bottom+2){ why='cut by '+(a.id?'#'+a.id:a.className.split(' ')[0]||a.tagName)+' ('+Math.round(r.bottom-ar.bottom)+'px)'; break; } }
     a=a.parentElement; }
   /* text spilling out of its own panel: a panel does not clip, and an outer scroller would pass it as
      reachable, so this is checked first - a spill is a fault whether or not the page scrolls */
   var pn=e.closest('.sd-col,.wk-pane,.sv-panel,.panel'); if(pn && pn!==e){ var pr=pn.getBoundingClientRect();
     /* a list scrolling inside the panel is fine: only text with no scroller between it and the panel counts */
     var py=getComputedStyle(pn).overflowY, inner=(py==='auto'||py==='scroll') && pn.scrollHeight>pn.clientHeight+1;   /* the panel scrolls itself */
     for(var q=e.parentElement; !inner && q && q!==pn; q=q.parentElement){ var qy=getComputedStyle(q).overflowY; if((qy==='auto'||qy==='scroll') && q.scrollHeight>q.clientHeight+1){ inner=true; break; } }
     if(!inner && r.bottom>pr.bottom+2){ why='spills out of '+(pn.id?'#'+pn.id:pn.className.split(' ')[0])+' ('+Math.round(r.bottom-pr.bottom)+'px)'; ok=false; } }
   if(ok && !why) continue;
   var docScroll = document.scrollingElement.scrollHeight > VH+1 && getComputedStyle(document.body).overflowY!=='hidden' && getComputedStyle(document.documentElement).overflowY!=='hidden';
   if(!why && r.top>=VH-1 && !docScroll) why='below screen';
   if(!why && r.bottom>VH+2 && !docScroll) why='cut by screen';
   if(why){ seen++; if(out.length<14) out.push((e.id?'#'+e.id:e.tagName.toLowerCase()+'.'+(e.className||'').toString().split(' ')[0])+' "'+t.slice(0,48)+'" '+why); }
 }
 document.title='RES n='+seen+(out.length?' :: '+out.join(' || '):'');
},6500);
