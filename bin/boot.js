/* before paint: no default pane should ever flash */
try{
 localStorage.removeItem("th_mono");   /* the wireframe theme is gone (2026-09-25) */
 /* day or night: the reader's own choice first, else what the browser prefers */
 var _th=localStorage.getItem("th_theme");
 if(_th!=="light"&&_th!=="dark") _th=(window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark";
 document.documentElement.setAttribute("data-theme",_th);
}catch(e){}

/* The navigation shell, before paint. The route in the address - #/{section}/{view} - says
   which section and view are open; with none, the last tab this browser had (th_tab, and for
   the dashboard its view), else the config's home. It stamps html[data-sec], [data-sv],
   [data-tab], [data-ui], [data-svs], [data-grp]: the attributes every tab and pane rule keys on, so the
   right tab is lit and the right pane is up before anything paints. shell.js takes over. */
try{(function(){
  var R = document.documentElement, C = JSON.parse(document.getElementById("shellcfg").textContent), S = C.sections;
  window.__SHELL = C;
  function sec(k, v){ for(var i = 0; i < S.length; i++) if(S[i][k] === v) return S[i]; return null; }
  function sub(s, k, v){ for(var i = 0; i < s.sub.length; i++) if(s.sub[i][k] === v) return s.sub[i]; return null; }
  function bytab(t, pick){ for(var i = 0; i < S.length; i++) for(var j = 0; j < S[i].sub.length; j++)
    if(S[i].sub[j].tab === t && (!pick || pick(S[i].sub[j]))) return [S[i], S[i].sub[j]]; return null; }
  var mem = {}; try{ mem = JSON.parse(sessionStorage.getItem("shell_last") || "{}"); }catch(e){}
  /* a view that is off (announced, not built) cannot be open; the old Simple/Advanced switch
     is gone, and with it its key */
  try{ localStorage.removeItem("th_ui"); }catch(e){}
  function eff(s, v){ return v.off ? null : v; }
  /* the route is the path under the app's base (clean paths since 2026-09-29); an old #/... link still counts.
     A path that is no route (a harness page) reads as the empty route, so it lands where an empty address did */
  var B = document.querySelector("base"), BASE = B ? B.getAttribute("href") : "/", hh = location.hash || "", pp = location.pathname;
  var route = /^#\//.test(hh) ? hh.replace(/^#\/?/, "") : (pp.indexOf(BASE) === 0 ? pp.slice(BASE.length) : pp.replace(/^\//, ""));
  var h = route.replace(/\/+$/, "").split("/"), s = null, v = null, f;
  if(h[0] && h[0] !== "intro" && !sec("route", h[0])) h = [""];
  if(h[0] === "intro"){ R.setAttribute("data-tab", "intro"); return; }
  if(h[0] && (s = sec("route", h[0]))) v = s.entry === "first" ? s.sub[0] : (h[1] && sub(s, "route", h[1])) || sub(s, "id", mem[s.id]) || s.sub[0];
  /* no route in the address: the landing page is home (the intro) when the config says so */
  if(!s && !h[0] && C.home === "intro"){ R.setAttribute("data-tab", "intro"); return; }
  if(!s){
    var t = localStorage.getItem("th_tab");
    if(t === "intro"){ R.setAttribute("data-tab", "intro"); return; }
    if(t === "dele"){ var sc = localStorage.getItem("th_svs"); f = bytab(t, function(x){ return x.screen === sc; }) || bytab(t); }
    else if(t) f = bytab(t);
    if(f){ s = f[0]; v = f[0].entry === "first" ? f[0].sub[0] : f[1]; }
    else { var hm = (C.home || "").split("/"); s = sec("route", hm[0]); v = s && sub(s, "route", hm[1]); }
  }
  if(!s || !v) return;
  /* a view that is off opens the section's first one that is not */
  if(!eff(s, v)) for(var i = 0; i < s.sub.length; i++) if(eff(s, s.sub[i])){ v = s.sub[i]; break; }
  R.setAttribute("data-sec", s.id); R.setAttribute("data-sv", s.id + "/" + v.id);
  /* a section with a group switch shows one group's tabs: the open view's */
  if(s.switch && v.group) R.setAttribute("data-grp", v.group); else R.removeAttribute("data-grp");
  v = eff(s, v);
  R.setAttribute("data-tab", s.account === "required" && !localStorage.getItem("th_wallet") ? "connect" : (v.tab || "empty"));
  if(v.ui === "simple"){ R.setAttribute("data-ui", "simple"); if(v.screen) R.setAttribute("data-svs", v.screen); }
  else R.removeAttribute("data-ui");
})();}catch(e){}

/* the calculator pane's box, remembered from the last visit, so a page that opens on the
   dashboard sits where the calculator sits before the calculator has been laid out */
try{ var cb = (localStorage.getItem("th_calcbox") || "").split("/");
  if(cb.length === 3 && +cb[2] === innerWidth && +cb[1] > 100){ document.documentElement.style.setProperty("--calc-top", cb[0] + "px"); document.documentElement.style.setProperty("--calc-h", cb[1] + "px"); } }catch(e){}

/* The keyboard is not a new screen (operator, 2026-10-16: "when input field is clicked, the keyboard opens, which
   shuffles the page ... the layout, app elements, all should be stable, rooted"). Every layout measure here listens
   to resize - the frame, the map, the fits - and an on-screen keyboard that shrinks the window (Android's in-app
   browsers, Keplr's among them) fired them all mid-typing. On a touch screen, a resize that keeps the width while a
   field has the focus is the keyboard opening or closing: no listener sees it, so the page keeps the layout it had.
   The decision is made once per resize, by the first listener, before any other runs. */
try{(function(){
  if(!(window.matchMedia && matchMedia("(pointer:coarse)").matches)) return;
  var W = innerWidth, KB = false, add = window.addEventListener;
  function editing(){
    var a = document.activeElement; if(!a) return false; if(a.isContentEditable || a.tagName === "TEXTAREA") return true;
    return a.tagName === "INPUT" && !/^(button|checkbox|radio|range|submit|reset|file|color|image|hidden)$/i.test(a.type || "text");
  }
  add.call(window, "resize", function(){ KB = innerWidth === W && editing(); if(!KB) W = innerWidth; });
  window.__kbd = function(){ return KB; };
  window.addEventListener = function(type, fn, opt){
    if(type !== "resize" || typeof fn !== "function") return add.call(window, type, fn, opt);
    return add.call(window, type, function(e){ if(KB) return; return fn.call(this, e); }, opt);
  };
})();}catch(e){}

/* iPhones and iPads zoom the whole page into any field set under 16px and leave it zoomed: the page "shuffles". Their
   pinch zoom ignores maximum-scale, so this only stops the automatic zoom; Android, which does not auto-zoom and does
   honour the cap, is left alone */
try{ if(/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)){
  var vpm = document.querySelector("meta[name=viewport]"); if(vpm && !/maximum-scale/.test(vpm.content)) vpm.content += ",maximum-scale=1"; } }catch(e){}
