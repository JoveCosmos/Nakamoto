/* ── the navigation shell ──────────────────────────────────────────────────────────
   Two levels of tabs from one config (bin/shell.json, embedded in the page as #shellcfg):
   level 1 is the sections in the header, level 2 is the open section's views on the
   window's title line. render.py built both strips from the config; boot.js stamped the
   first state before paint. From there this file:
   - routes: every view is #/{section}/{view}; deep links open it, back and forward walk
     it, and the address follows every change (the landing page is #/intro);
   - keys: arrows move within a strip (and open what they land on), Home and End jump to
     its ends; each strip is one Tab stop, and Tab leaves it into the panel it controls;
   - remembers each section's last view for the session, and returns to it;
   - starts sections that follow the wallet over from their first view when the wallet
     changes (a returning wallet reconnecting by itself is not a change);
   - fills its own two panes: a view with nothing built shows its empty state, and a
     section that needs a wallet shows one connect screen while there is none.
   Which tabs exist - labels, routes, order, groups - is only ever read from the config. */
(function(){
  var el = document.getElementById("shellcfg"); if(!el) return;
  var C; try{ C = JSON.parse(el.textContent); }catch(e){ return; }
  var R = document.documentElement, SECS = C.sections;
  var E = function(id){ return document.getElementById(id); };
  window.__SHELL = C;

  function sec(k, v){ for(var i = 0; i < SECS.length; i++) if(SECS[i][k] === v) return SECS[i]; return null; }
  function sub(s, k, v){ for(var i = 0; i < s.sub.length; i++) if(s.sub[i][k] === v) return s.sub[i]; return null; }
  /* A view that is 'off' is announced, not built: its tab stays in the row, greyed and inert,
     and it cannot be open. eff() is the view, or null when it cannot be open. */
  function eff(s, v){ if(!s || !v) return v; return v.off ? null : v; }
  function shown(s, v){ if(eff(s, v)) return v; for(var i = 0; i < s.sub.length; i++) if(eff(s, s.sub[i])) return s.sub[i]; return v; }
  function esc(v){ return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  /* ── memory: each section's last view, for this session ── */
  var MEM = "shell_last";
  function mem(){ try{ return JSON.parse(sessionStorage.getItem(MEM) || "{}") || {}; }catch(e){ return {}; } }
  function keep(m){ try{ sessionStorage.setItem(MEM, JSON.stringify(m)); }catch(e){} }
  function remember(s, v){ var m = mem(); m[s.id] = v.id; keep(m); }
  /* a section with entry "first" always opens on its first view (Staking on Bonus); the
     others come back to the view last open this session */
  function last(s){ return shown(s, s.entry === "first" ? s.sub[0] : sub(s, "id", mem()[s.id]) || s.sub[0]); }

  /* ── routes ── */
  function hashOf(s, v){ return s ? "#/" + s.route + "/" + v.route : "#/intro"; }
  function parse(h){
    var p = (h || "").replace(/^#\/?/, "").split("/");
    if(p[0] === "intro") return { intro: true };
    var s = p[0] && sec("route", p[0]); if(!s) return null;
    return { s: s, v: (p[1] && sub(s, "route", p[1])) || last(s) };
  }

  function connected(){ return !!window.__ADDR; }
  function wantsConnect(s){ return s.account === "required" && !connected(); }
  function panelOf(s, v){
    if(!s) return E("p-intro");
    var e = eff(s, v);
    return E(wantsConnect(s) ? "p-connect" : (e.panel || "p-empty"));
  }

  var cur = { s: null, v: null };

  /* ── the strips: selection, the one Tab stop each (roving tabindex), what each controls ── */
  function sync(){
    var s = cur.s, v = cur.v;
    var l1 = document.querySelectorAll(".l1tab"), any = false;
    Array.prototype.forEach.call(l1, function(b){
      var on = !!s && b.dataset.section === s.id; any = any || on;
      b.setAttribute("aria-selected", on ? "true" : "false"); b.tabIndex = on ? 0 : -1;
    });
    if(!any && l1.length) l1[0].tabIndex = 0;
    Array.prototype.forEach.call(document.querySelectorAll(".l2"), function(list){
      var tabs = list.querySelectorAll(".l2tab"), hit = false;
      Array.prototype.forEach.call(tabs, function(b){
        var on = !!s && !!v && b.dataset.key === s.id + "/" + v.id; hit = hit || on;
        b.setAttribute("aria-selected", on ? "true" : "false"); b.tabIndex = on ? 0 : -1;
      });
      if(!hit && tabs.length) tabs[0].tabIndex = 0;
    });
    /* what each tab controls follows the version (Overview is the three-pane screen in
       Advanced); a tab the version turns off stays in the row, greyed, and says why */
    SECS.forEach(function(x){ x.sub.forEach(function(w){
      var b = E("l2-" + x.id + "-" + w.id), e = eff(x, w); if(!b) return;
      if(e){ b.setAttribute("aria-controls", e.panel || "p-empty"); b.removeAttribute("aria-disabled"); b.removeAttribute("title"); }
      else { b.setAttribute("aria-disabled", "true"); b.title = w.offnote || "Coming soon"; }
    }); });
    /* the group switch: the open view's group is the pressed one */
    Array.prototype.forEach.call(document.querySelectorAll(".l2vb"), function(b){
      b.setAttribute("aria-pressed", s && v && s.switch && b.dataset.g === v.group ? "true" : "false"); });
    var calc = E("calc");
    if(calc){
      if(s){ calc.setAttribute("aria-labelledby", "l1-" + s.id); calc.removeAttribute("aria-label"); }
      else { calc.removeAttribute("aria-labelledby"); calc.setAttribute("aria-label", "AtomOne"); }
    }
    /* a section title may name its open view (.tsub), in the view's accent or the section's */
    if(s && v) Array.prototype.forEach.call(document.querySelectorAll('[data-title-for="' + s.id + '"] .tsub'), function(t){
      t.textContent = v.label; t.style.color = v.accent || s.accent || ""; });
    requestAnimationFrame(reveal);
  }
  /* a narrow strip scrolls sideways: the open view is brought into sight */
  function reveal(){
    var b = document.querySelector(".l2tab[aria-selected=true]"); if(!b) return;
    var trk = b.closest(".l2trk"); if(!trk || trk.scrollWidth <= trk.clientWidth) return;
    var br = b.getBoundingClientRect(), tr = trk.getBoundingClientRect();
    trk.scrollLeft += (br.left - tr.left) - (tr.width - br.width) / 2;
  }

  /* the panels: every view's pane is a tabpanel labelled by its level-2 tab, the window by
     the open section; the shell's shared panes are labelled when they are used */
  function panels(){
    var calc = E("calc");
    if(calc){ calc.setAttribute("role", "tabpanel"); if(!calc.hasAttribute("tabindex")) calc.tabIndex = 0; }
    SECS.forEach(function(s){ s.sub.forEach(function(v){
      var p = v.panel && E(v.panel); if(!p) return;
      p.setAttribute("role", "tabpanel"); p.setAttribute("aria-labelledby", "l2-" + s.id + "-" + v.id);
      if(!p.hasAttribute("tabindex")) p.tabIndex = 0;
    }); });
  }

  /* ── the shell's own panes ── */
  function fillEmpty(s, v){
    var box = E("shellempty"), p = E("p-empty"), e = v.empty || {}, h;
    if(!box) return;
    h = "<h2>" + esc(e.title || v.label) + "</h2><p>" + esc(e.text || (v.label + " has nothing to show yet.")) + "</p>";
    var a = e.action;
    if(a && a.href) h += '<a class=shell-act href="' + esc(a.href) + '"' +
      (/^https?:/.test(a.href) ? ' target=_blank rel="noopener noreferrer"' : "") + ">" + esc(a.label) + "</a>";
    else if(a && a.route) h += '<button class=shell-act type=button data-route="' + esc(a.route) + '">' + esc(a.label) + "</button>";
    box.innerHTML = h;
    if(p) p.setAttribute("aria-labelledby", "l2-" + s.id + "-" + v.id);
  }
  function fillConnect(s){
    var box = E("shellconnect"), p = E("p-connect");
    if(!box) return;
    box.innerHTML = "<h2>Connect a wallet</h2><p>" + esc(s.label) + " works from a connected wallet.</p>" +
      "<button class=shell-act type=button data-shell-connect>Connect wallet</button>";
    if(p) p.setAttribute("aria-labelledby", "l1-" + s.id);
  }

  /* after a view changes: its content starts at the top; on a phone, whose page scrolls,
     the window's top comes back out from under the sticky header if it had gone under it */
  function toTop(s, v){
    var p = panelOf(s, v);
    if(p){ p.scrollTop = 0;
      Array.prototype.forEach.call(p.querySelectorAll(".sv-screen,.sv-wrap,.pw,.wk-tbl2"), function(x){ x.scrollTop = 0; }); }
    var calc = E("calc"), hdr = document.querySelector(".folder");
    if(calc && hdr){
      var over = calc.getBoundingClientRect().top - hdr.getBoundingClientRect().bottom;
      if(over < 0) window.scrollBy(0, over);
    }
  }

  /* ── one move: section and view in, everything else follows ── */
  function go(s, v, how){
    var prevS = cur.s, prevV = cur.v, tab, e;
    if(s) v = shown(s, v);
    e = eff(s, v);
    cur = { s: s, v: v };
    if(!s){ tab = "intro"; R.removeAttribute("data-sec"); R.removeAttribute("data-sv"); }
    else {
      tab = wantsConnect(s) ? "connect" : (e.tab || "empty");
      R.setAttribute("data-sec", s.id); R.setAttribute("data-sv", s.id + "/" + v.id);
      if(s.switch && v.group) R.setAttribute("data-grp", v.group); else R.removeAttribute("data-grp");
      if(tab === "dele" && window.__dashView) window.__dashView(e.ui, e.screen);
      var pn = panelOf(s, v); if(pn && pn.id !== "p-connect") pn.setAttribute("aria-labelledby", "l2-" + s.id + "-" + v.id);
      if(tab === "empty") fillEmpty(s, v);
      if(tab === "connect") fillConnect(s);
    }
    sync();
    if(R.getAttribute("data-tab") !== tab){
      /* a new section falls in (the window's own animation); a view within one swaps */
      if(prevS !== s && window.__flipTo) window.__flipTo(tab);
      else if(window.__pick){ window.__pick(tab); if(window.__state) window.__state(); if(tab === "dele" && window.__planDraw) window.__planDraw(); }
      else R.setAttribute("data-tab", tab);
    } else if(window.__state) window.__state();
    var h = hashOf(s, v);
    if(how === "push" && location.hash !== h) history.pushState(null, "", h);
    else if(how === "replace" && location.hash !== h) history.replaceState(null, "", h);
    if(s){ remember(s, v); if(s.switch && v.group) GLAST[s.id + "/" + v.group] = v; }
    if(prevS !== s || prevV !== v) toTop(s, v);
  }
  /* the group switch (Staking | Governance): a group opens on the view last open in it this
     session, else its first view that can be open */
  var GLAST = {};
  function openGroup(g){
    var s = cur.s; if(!s || !s.switch || (cur.v && cur.v.group === g)) return;
    var v = GLAST[s.id + "/" + g], i;
    if(!v || !eff(s, v)) for(v = null, i = 0; i < s.sub.length; i++) if(s.sub[i].group === g && eff(s, s.sub[i])){ v = s.sub[i]; break; }
    if(v) go(s, v, "push");
  }
  window.__shellGo = function(route){ var r = parse("#/" + route); if(r) r.intro ? go(null, null, "push") : go(r.s, r.v, "push"); };

  function activate(b){
    if(b.getAttribute("aria-disabled") === "true") return;
    var s = sec("id", b.dataset.section); if(!s) return;
    if(b.classList.contains("l1tab")) go(s, cur.s === s && s.entry !== "first" ? cur.v : last(s), "push");
    else { var v = sub(s, "id", b.dataset.sub); if(v) go(s, v, "push"); }
  }

  /* clicks: the tabs, any [data-route] door, and the connect screen's button (links to
     #/... need nothing - the address changes and hashchange below answers it) */
  document.addEventListener("click", function(ev){
    var t = ev.target.closest ? ev.target.closest(".l1tab,.l2tab,.l2vb,[data-route],[data-shell-connect]") : null;
    if(!t) return;
    if(t.classList.contains("l2vb")){ if(t.getAttribute("aria-disabled") !== "true") openGroup(t.dataset.g); return; }
    if(t.hasAttribute("data-shell-connect")){ var c = E("svconn"); if(c) c.click(); return; }
    if(t.hasAttribute("data-route")){ ev.preventDefault(); window.__shellGo(t.getAttribute("data-route")); return; }
    activate(t);
  });

  /* keys, inside a strip: arrows move and open, Home and End jump; Tab is left alone */
  document.addEventListener("keydown", function(ev){
    var t = ev.target;
    if(!t || !t.getAttribute || t.getAttribute("role") !== "tab") return;
    var list = t.closest("[role=tablist]"); if(!list) return;
    /* a tab the open version leaves out, or turns off, is not there to land on */
    var tabs = [].slice.call(list.querySelectorAll("[role=tab]")).filter(function(b){ return b.offsetParent !== null && b.getAttribute("aria-disabled") !== "true"; }), i = tabs.indexOf(t), j = -1;
    if(ev.key === "ArrowRight" || ev.key === "ArrowDown") j = (i + 1) % tabs.length;
    else if(ev.key === "ArrowLeft" || ev.key === "ArrowUp") j = (i - 1 + tabs.length) % tabs.length;
    else if(ev.key === "Home") j = 0;
    else if(ev.key === "End") j = tabs.length - 1;
    else return;
    ev.preventDefault();
    activate(tabs[j]); tabs[j].focus();
  });

  /* back, forward, and links: the address says where to be */
  function fromAddress(){
    var r = parse(location.hash); if(!r) return;
    /* Back or Forward while a card is up: the card goes with the page it was opened on */
    if(window.__POP) window.__POP.closeAll();
    if(r.intro){ if(cur.s || R.getAttribute("data-tab") !== "intro") go(null, null, "pop"); return; }
    if(r.s !== cur.s || r.v !== cur.v) go(r.s, r.v, "pop");
  }
  window.addEventListener("hashchange", fromAddress);
  window.addEventListener("popstate", fromAddress);

  /* ── the wallet: a change of who is connected restarts the sections that follow it ── */
  var seen = null, settled = true, autoT = 0;
  try{ if(localStorage.getItem("th_wallet")) settled = false; }catch(e){}
  if(!settled) autoT = setTimeout(function(){
    settled = true; seen = window.__ADDR || null;
    if(cur.s && cur.s.account === "required" && !seen) go(cur.s, cur.v, "replace");
  }, 8000);
  function identity(){
    var a = window.__ADDR || null;
    if(!settled){                                      /* the returning wallet, reconnecting */
      if(a){ settled = true; seen = a; clearTimeout(autoT); if(cur.s && cur.s.account === "required") go(cur.s, cur.v, "replace"); }
      return;
    }
    if(a === seen) return;
    seen = a;
    var m = mem(); SECS.forEach(function(s){ if(s.account !== "none") delete m[s.id]; }); keep(m);
    if(cur.s && cur.s.account !== "none") go(cur.s, shown(cur.s, cur.s.sub[0]), "replace");
  }
  window.addEventListener("thermo:draw", identity);

  /* ── the first state: what boot.js stamped, written back into the address ── */
  panels();
  (function(){
    var s = sec("id", R.getAttribute("data-sec")), v = s && sub(s, "id", (R.getAttribute("data-sv") || "").split("/")[1]);
    if(s && v){ go(s, v, "replace"); return; }
    if(R.getAttribute("data-tab") === "intro"){ go(null, null, "replace"); return; }
    var hm = (C.home || "").split("/"); s = sec("route", hm[0]); v = s && sub(s, "route", hm[1]);
    if(s && v) go(s, v, "replace");
  })();
})();
