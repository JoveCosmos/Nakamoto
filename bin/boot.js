/* before paint: no default pane should ever flash */
try{
 if(localStorage.getItem("th_mono")==="1") document.documentElement.setAttribute("data-mono","1");
 /* day or night: the reader's own choice first, else what the browser prefers */
 var _th=localStorage.getItem("th_theme");
 if(_th!=="light"&&_th!=="dark") _th=(window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark";
 document.documentElement.setAttribute("data-theme",_th);
}catch(e){}

/* The navigation shell, before paint. The route in the address - #/{section}/{view} - says
   which section and view are open; with none, the last tab this browser had (th_tab, and for
   the dashboard its view), else the config's home. It stamps html[data-sec], [data-sv],
   [data-tab], [data-ui], [data-svs]: the attributes every tab and pane rule keys on, so the
   right tab is lit and the right pane is up before anything paints. shell.js takes over. */
try{(function(){
  var R = document.documentElement, C = JSON.parse(document.getElementById("shellcfg").textContent), S = C.sections;
  window.__SHELL = C;
  function sec(k, v){ for(var i = 0; i < S.length; i++) if(S[i][k] === v) return S[i]; return null; }
  function sub(s, k, v){ for(var i = 0; i < s.sub.length; i++) if(s.sub[i][k] === v) return s.sub[i]; return null; }
  function bytab(t, pick){ for(var i = 0; i < S.length; i++) for(var j = 0; j < S[i].sub.length; j++)
    if(S[i].sub[j].tab === t && (!pick || pick(S[i].sub[j]))) return [S[i], S[i].sub[j]]; return null; }
  var mem = {}; try{ mem = JSON.parse(sessionStorage.getItem("shell_last") || "{}"); }catch(e){}
  var h = (location.hash || "").replace(/^#\/?/, "").split("/"), s = null, v = null, f;
  if(h[0] === "intro"){ R.setAttribute("data-tab", "intro"); return; }
  if(h[0] && (s = sec("route", h[0]))) v = (h[1] && sub(s, "route", h[1])) || sub(s, "id", mem[s.id]) || s.sub[0];
  if(!s){
    var t = localStorage.getItem("th_tab");
    if(t === "intro"){ R.setAttribute("data-tab", "intro"); return; }
    if(t === "dele"){
      var ui = localStorage.getItem("th_ui"), sc = localStorage.getItem("th_svs");
      f = ui === "simple" ? (bytab(t, function(x){ return x.screen === sc; }) || bytab(t, function(x){ return x.ui === "simple"; }))
                          : bytab(t, function(x){ return x.ui !== "simple"; });
    } else if(t) f = bytab(t);
    if(f){ s = f[0]; v = f[1]; }
    else { var hm = (C.home || "").split("/"); s = sec("route", hm[0]); v = s && sub(s, "route", hm[1]); }
  }
  if(!s || !v) return;
  R.setAttribute("data-sec", s.id); R.setAttribute("data-sv", s.id + "/" + v.id);
  R.setAttribute("data-tab", s.account === "required" && !localStorage.getItem("th_wallet") ? "connect" : (v.tab || "empty"));
  if(v.ui === "simple"){ R.setAttribute("data-ui", "simple"); if(v.screen) R.setAttribute("data-svs", v.screen); }
  else R.removeAttribute("data-ui");
})();}catch(e){}

/* the calculator pane's box, remembered from the last visit, so a page that opens on the
   dashboard sits where the calculator sits before the calculator has been laid out */
try{ var cb = (localStorage.getItem("th_calcbox") || "").split("/");
  if(cb.length === 3 && +cb[2] === innerWidth && +cb[1] > 100){ document.documentElement.style.setProperty("--calc-top", cb[0] + "px"); document.documentElement.style.setProperty("--calc-h", cb[1] + "px"); } }catch(e){}
