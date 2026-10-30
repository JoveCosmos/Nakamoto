/* AtomOne app interactivity. Reads the JSON the renderer embedded, and then
   keeps the stake vector current from live.json - because every delegation moves
   a validator's rank AND its APR, and under the bonus it moves everyone else's
   too, since the bonus is one pool shared N ways. A page rebuilt every 15 minutes
   cannot answer "where should this go" while people are delegating.

   The embedded payload is still the whole page: if live.json never loads, nothing
   breaks and the page renders exactly as it did before. The live feed only
   overwrites the five numbers the model is a function of. */

/* an amount typed or filled into a field, in ATONE (2026-10-09). The page fills fields in one format ("12,345.678",
   see exact()); a reader may type their own. Both marks: the last one is the decimal mark ("1.234,5" or "1,234.5");
   a comma alone is a decimal comma unless exactly three digits follow it ("12,5" is 12.5, "1,000" is 1000); dots
   alone, more than one, group thousands ("1.234.567"). Until then the browser's own grouping (a dot in German,
   Indonesian, Spanish...) made MAX read back as a thousandth of the balance */
window.__amountIn = function(v){
  var s = String(v || "").replace(/[\s\u00a0\u202f'\u2019_]/g, ""), c = s.lastIndexOf(","), d = s.lastIndexOf(".");
  if(/[^0-9.,]/.test(s)) return 0;               /* a sign, an exponent or any letter is refused, never stripped (audit 2026-10-13: "-5" read 5, "1e5" read 15) */
  if(c > -1 && d > -1) s = c > d ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if(c > -1){ var p = s.split(","); s = p.length === 2 && (p[1].length !== 3 || p[0] === "" || p[0] === "0") ? p[0] + "." + p[1] : s.replace(/,/g, ""); }
  else if(s.split(".").length > 2) s = s.replace(/\./g, "");
  var n = parseFloat(s);
  return isFinite(n) && n > 0 ? n : 0;
};

/* ── popup stack: one owner for open and close. The card on top when another
   opens is its parent - hidden while the child shows, put back when the child
   closes - so Escape and a tap outside always step back ONE level, never
   straight home. A card opened from the page has no parent, so closing it
   lands on home. Every popup in the app goes through here; nothing toggles
   "on" by hand any more. */
var POP = (function(){
  var st = [];                                     /* [{el, from, back}] bottom -> top */
  var R = document.documentElement;
  function top(){ return st.length ? st[st.length - 1].el : null; }
  function card(el){ return el.querySelector(".card") || el; }
  /* the keyboard follows the card: focus moves into it on open and back to whatever
     opened it on close; Tab walks the card's own controls and never the page behind */
  function focusIn(el){
    var c = card(el); if(!c.hasAttribute("tabindex")) c.tabIndex = -1;
    try{ c.focus({ preventScroll: true }); }catch(e){ c.focus(); }
  }
  function open(el){
    if(!el) return;
    if(el === top() && el.classList.contains("on")) return;
    /* a stale entry (hidden by hand, e.g. a probe) is dropped with anything above it */
    for(var k = st.length - 1; k >= 0; k--) if(st[k].el === el){ st.splice(k); break; }
    var from = top();
    if(from && !from.classList.contains("on")) from = null;
    if(from) from.classList.remove("on");
    st.push({ el: el, from: from, back: document.activeElement });
    el.classList.remove("back");
    el.classList.add("on");
    R.classList.add("popon");
    focusIn(el);
  }
  function close(el){
    el = el || top(); if(!el) return;
    var i = -1;
    for(var k = st.length - 1; k >= 0; k--) if(st[k].el === el){ i = k; break; }
    if(i < 0){ el.classList.remove("on"); if(!st.length) R.classList.remove("popon"); return; }
    var gone = st.splice(i);                         /* el and anything above it */
    gone.forEach(function(p){ p.el.classList.remove("on"); if(p.el.__onclose) p.el.__onclose(); });
    /* "back" keeps the entrance animation from replaying on the way back */
    if(gone[0].from){ gone[0].from.classList.add("on", "back"); focusIn(gone[0].from); }
    if(!st.length) R.classList.remove("popon");
    var b = gone[0].back;
    if(!gone[0].from && b && b.focus && document.contains(b)) try{ b.focus({ preventScroll: true }); }catch(e){}
  }
  function closeAll(){ while(st.length) close(st[0].el); }
  document.addEventListener("keydown", function(ev){
    if(!st.length) return;
    if(ev.key === "Escape"){ ev.preventDefault(); close(); return; }
    if(ev.key !== "Tab") return;
    var c = card(top()), f = [].filter.call(c.querySelectorAll("button,input,select,textarea,a[href],[tabindex]:not([tabindex='-1'])"),
      function(x){ return !x.disabled && x.offsetParent !== null; });
    if(!f.length){ ev.preventDefault(); return; }
    var a = document.activeElement, first = f[0], last = f[f.length - 1];
    if(!c.contains(a)){ ev.preventDefault(); first.focus(); }
    else if(ev.shiftKey && (a === first || a === c)){ ev.preventDefault(); last.focus(); }
    else if(!ev.shiftKey && a === last){ ev.preventDefault(); first.focus(); }
  });
  document.addEventListener("click", function(ev){
    var t = ev.target;
    if(t && t.classList && t.classList.contains("pop") && t === top()) close(t); });
  return { open: open, close: close, closeAll: closeAll, top: top };
})();
window.__POP = POP;

/* ── one themed dropdown for the app (operator, 2026-10-17: "upgrade, the gata app has them"): a native <select>'s open
   list is the system's own and CSS cannot reach it, so it opened as a plain grey list in every theme. The select stays
   in the page, hidden, as the home of the value: a button stands in for it and the list opens in the page, styled as
   the app's menus. Picking sets the select's value and fires its change event, and code that sets the value moves the
   button too, so callers keep their code. Keyboard as a select: Enter, Space or an arrow opens; arrows, Home and End
   move; Enter or Space picks; Escape or Tab closes. The list follows its button on scroll and opens upward only when
   there is more room above. The same pattern as the GATA app's Dropdown. */
window.__dd = function(sel, cls){
  if(!sel || sel.__dd) return null; sel.__dd = true;
  var x = function(v){ return String(v).replace(/[&<>"]/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var b = document.createElement("button"); b.type = "button"; b.className = "dd-trig" + (cls ? " " + cls : "");
  b.setAttribute("aria-haspopup", "listbox"); b.setAttribute("aria-expanded", "false");
  if(sel.getAttribute("aria-label")) b.setAttribute("aria-label", sel.getAttribute("aria-label"));
  b.innerHTML = '<span class=dd-v></span><svg viewBox="0 0 24 24" aria-hidden=true><path d="M6 9l6 6 6-6"/></svg>';
  sel.classList.add("dd-native"); sel.tabIndex = -1; sel.setAttribute("aria-hidden", "true");
  sel.parentNode.insertBefore(b, sel.nextSibling);
  var list = null, hi = -1, P = HTMLSelectElement.prototype;
  var dv = Object.getOwnPropertyDescriptor(P, "value"), di = Object.getOwnPropertyDescriptor(P, "selectedIndex");
  function sync(){ var o = sel.options[sel.selectedIndex]; b.querySelector(".dd-v").textContent = o ? o.text.trim() : "-"; b.disabled = sel.disabled; if(sel.disabled) close(); }
  function paint(){ if(!list) return; var v = sel.value;
    [].forEach.call(list.children, function(o, i){ o.setAttribute("aria-selected", o.dataset.v === v ? "true" : "false"); o.classList.toggle("hi", i === hi); }); }
  /* code that sets the value (the Constitution follows the reading) moves the button with it */
  Object.defineProperty(sel, "value", { configurable: true, get: function(){ return dv.get.call(this); }, set: function(v){ dv.set.call(this, v); sync(); paint(); } });
  Object.defineProperty(sel, "selectedIndex", { configurable: true, get: function(){ return di.get.call(this); }, set: function(v){ di.set.call(this, v); sync(); paint(); } });
  new MutationObserver(sync).observe(sel, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["disabled"] });
  /* the list lives on <body>, outside the themed sections, so it takes their colours from its button */
  var TOK = ["--wsolid", "--wbd", "--wbd2", "--wt", "--ws", "--wf", "--wh", "--wsans", "--wmono", "--sv-teal"];
  function place(){ if(!list) return;
    var r = b.getBoundingClientRect(), below = innerHeight - r.bottom - 12, above = r.top - 12, cap = 320;
    list.style.minWidth = Math.min(r.width, innerWidth - 16) + "px"; list.style.maxWidth = (innerWidth - 16) + "px";   /* long names end in an ellipsis, never off screen */
    list.style.left = Math.max(8, Math.min(r.left, innerWidth - 8 - list.offsetWidth)) + "px";
    if(below < 140 && above > below){ var h = Math.min(cap, above); list.style.maxHeight = h + "px"; list.style.top = Math.max(8, r.top - 5 - Math.min(h, list.scrollHeight)) + "px"; }
    else { list.style.maxHeight = Math.min(cap, Math.max(below, 140)) + "px"; list.style.top = (r.bottom + 5) + "px"; } }
  function keep(){ var o = list && list.children[hi]; if(!o) return;
    if(o.offsetTop < list.scrollTop) list.scrollTop = o.offsetTop - 5;
    else if(o.offsetTop + o.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = o.offsetTop + o.offsetHeight - list.clientHeight + 5; }
  function open(){ if(list || sel.disabled || !sel.options.length) return;
    list = document.createElement("div"); list.className = "dd-list"; list.setAttribute("role", "listbox");
    var cs = getComputedStyle(b); TOK.forEach(function(n){ var v = cs.getPropertyValue(n); if(v) list.style.setProperty(n, v.trim()); });
    var CK = '<svg viewBox="0 0 24 24" aria-hidden=true><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    list.innerHTML = [].map.call(sel.options, function(o){ var l = o.getAttribute("data-lvl");
      return '<button type=button role=option tabindex=-1 class="dd-o' + ({ "2": " dd-l2", "3": " dd-l3", "4": " dd-l4" }[l] || "") + '" data-v="' + x(o.value) + '"><span>' + x(o.text.trim()) + '</span>' + CK + '</button>'; }).join("");
    document.body.appendChild(list); hi = sel.selectedIndex; paint(); place();
    var cur = list.children[hi]; if(cur) list.scrollTop = cur.offsetTop - (list.clientHeight - cur.offsetHeight) / 2;
    b.setAttribute("aria-expanded", "true"); b.classList.add("open");
    list.addEventListener("click", function(ev){ var o = ev.target.closest(".dd-o"); if(o) pick(o.dataset.v); });
    list.addEventListener("mousemove", function(ev){ var o = ev.target.closest(".dd-o"), i = o ? [].indexOf.call(list.children, o) : -1; if(i >= 0 && i !== hi){ hi = i; paint(); } });
    document.addEventListener("pointerdown", outside, true); document.addEventListener("keydown", key, true);
    window.addEventListener("scroll", follow, true); window.addEventListener("resize", place); }
  function close(){ if(!list) return; list.remove(); list = null; b.setAttribute("aria-expanded", "false"); b.classList.remove("open");
    document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", key, true);
    window.removeEventListener("scroll", follow, true); window.removeEventListener("resize", place); }
  function follow(ev){ if(list && ev.target !== list) place(); }      /* the page moved: the list moves with its button */
  function pick(v){ var ch = v !== sel.value; close(); b.focus(); if(ch){ dv.set.call(sel, v); sync(); sel.dispatchEvent(new Event("change", { bubbles: true })); } }
  function outside(ev){ if(b.contains(ev.target) || (list && list.contains(ev.target))) return; close(); }
  function key(ev){ if(!list) return; var n = sel.options.length, k = ev.key;
    if(k === "Tab"){ close(); return; }
    if(["Escape", "ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].indexOf(k) < 0) return;
    ev.preventDefault(); ev.stopPropagation();          /* the popup under the list must not see these */
    if(k === "Escape"){ close(); b.focus(); return; }
    if(k === "Enter" || k === " "){ var o = list.children[hi]; if(o) pick(o.dataset.v); else close(); return; }
    hi = k === "Home" ? 0 : k === "End" ? n - 1 : Math.max(0, Math.min(n - 1, (hi < 0 ? sel.selectedIndex : hi) + (k === "ArrowDown" ? 1 : -1)));
    paint(); keep(); }
  b.addEventListener("click", function(){ if(list) close(); else open(); });
  b.addEventListener("keydown", function(ev){ if(!list && ["Enter", " ", "ArrowDown", "ArrowUp"].indexOf(ev.key) >= 0){ ev.preventDefault(); open(); } });
  sync();
  return b;
};

/* Pro on a wide screen (operator, 2026-09-30): Stake, Unstake and Claim open no card - the card's list loads in the
   main pane where Redelegate's is, and its figures and button in Outcome. The very same elements are moved there
   and put back, so every handler, state and fee estimate stays the card's own. The phone keeps the cards. */
var DOCK = null;
var DOCK_PARTS = {
  /* hdr: into the pane's title row, where Redelegate keeps its amount field; list: the pane's body; out: Outcome */
  stpop: { mode: "stake",   title: "Stake",         hdr: [".sttop"], list: ["#stlist"],  out: ["#stsum", "#stlock", "#stfee", "#ststep", ".txbtns"] },
  unpop: { mode: "unstake", title: "Unstake",       hdr: [".unamt"], list: ["#unpick"],  out: ["#unsum", "#unlock", "#unfee", "#unstep", ".txbtns"] },
  clpop: { mode: "claim",   title: "Claim",         hdr: [],         list: ["#clpick"],  out: ["#clsum", "#clfee", "#clstep", ".txbtns"] }
};
function proWide(){ return document.documentElement.getAttribute("data-sv") === "dashboard/self" && matchMedia("(min-width:1100px)").matches; }
function undock(){
  if(!DOCK) return;
  for(var i = DOCK.moved.length - 1; i >= 0; i--){ var m = DOCK.moved[i]; m.parent.insertBefore(m.el, m.next); }
  var L = document.getElementById("prolist"), O = document.getElementById("proout");
  if(L) L.hidden = true; if(O) O.hidden = true;
  var H0 = document.getElementById("prohdr"); if(H0) H0.innerHTML = "";
  var h = document.querySelector("#wk-plan>.wk-ph h3"); if(h) h.textContent = "Redelegate";
  document.documentElement.removeAttribute("data-pro");
  var p = DOCK.pop; DOCK = null; proTabs();
  if(p.__onclose) p.__onclose();
}
function dock(pop){
  var P = DOCK_PARTS[pop.id], card = pop.querySelector(".card"), L = document.getElementById("prolist"), O = document.getElementById("proout"), H = document.getElementById("prohdr");
  if(!P || !card || !L || !O){ POP.open(pop); return; }
  undock();
  var moved = [];
  function mv(sel, to){ var el = card.querySelector(sel); if(!el) return; moved.push({ el: el, parent: el.parentNode, next: el.nextSibling }); to.appendChild(el); }
  if(H) P.hdr.forEach(function(s){ mv(s, H); });
  P.list.forEach(function(s){ mv(s, L); }); P.out.forEach(function(s){ mv(s, O); });

  /* the card's own classes ride along, so its parts keep the card's styling */
  /* the list is Redelegate's table and takes none of the card's styling; Outcome's parts keep the card's */
  L.className = "pro-dock"; O.className = "pro-dock " + card.className.replace(/\bcard\b/, "");
  if(H) H.className = "pro-hdr " + card.className.replace(/\bcard\b/, "");
  L.hidden = O.hidden = false;
  var h = document.querySelector("#wk-plan>.wk-ph h3");
  /* Redelegate's title width, measured once, is the width every tab's title takes */
  if(h && !document.documentElement.style.getPropertyValue("--rdh")) document.documentElement.style.setProperty("--rdh", h.getBoundingClientRect().width + "px");
  if(h) h.textContent = P.title;
  document.documentElement.setAttribute("data-pro", P.mode);
  DOCK = { pop: pop, moved: moved };
  /* the list is drawn again now that it is docked: a docked list carries column titles as Redelegate's does */
  if(pop.id === "unpop" && window.__unRows) window.__unRows(); if(pop.id === "clpop" && window.__clDraw) window.__clDraw();
  proTabs(); if(window.__proBrk) window.__proBrk();
}
window.__openCard = function(pop){ if(!pop) return; if(proWide()) dock(pop); else POP.open(pop); };
window.__closeCard = function(pop){ if(DOCK && DOCK.pop === pop) undock(); else POP.close(pop); };
window.__undock = undock;
window.__undockIfNarrow = function(){ if(DOCK && !proWide()) undock(); };
/* the four actions as tabs in the title bar, as every other path has its views there (operator, 2026-09-30) */
function proTabs(){
  var dn = window.__DMYN, pn = document.getElementById("dmyn");
  if(dn && pn && dn.all) pn.textContent = dn.sel && !document.documentElement.hasAttribute("data-pro") ? dn.sel + " selected" : dn.all + " validator" + (dn.all === 1 ? "" : "s");
  var mode = document.documentElement.getAttribute("data-pro") || "redelegate", home = { stake: "stbtn", unstake: "unbtn", claim: "clbtn" };
  [].forEach.call(document.querySelectorAll("#protabs .l2tab"), function(b){
    var a = b.getAttribute("data-pro-act"), on = a === mode, src = home[a] && document.getElementById(home[a]);
    b.setAttribute("aria-selected", on ? "true" : "false"); b.tabIndex = on ? 0 : -1;     /* one Tab stop, the open one */
    if(src && src.hidden) b.setAttribute("aria-disabled", "true"); else b.removeAttribute("aria-disabled");
  });
}
window.__proTabs = proTabs;
document.addEventListener("click", function(ev){
  var b = ev.target.closest ? ev.target.closest("#protabs .l2tab") : null; if(!b || b.getAttribute("aria-disabled") === "true") return;
  var a = b.getAttribute("data-pro-act");
  if(a === "redelegate") undock();
  else if(a === "claim"){ if(window.__claim) window.__claim(); }
  else { var s = document.getElementById(a === "stake" ? "stbtn" : "unbtn"); if(s) s.click(); }
});
/* the node's RPC, proxied on this host (nginx: /rpc/status, /rpc/block) so the
   page never has to cross origins for a height */
/* every chain string that reaches innerHTML or an attribute goes through this */
function att(v){
  return String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
                  .replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
/* the clipboard, with the old selection route where the API is refused; ok() on success */
function copyText(v, ok){
  var old = function(){ try{ var e = document.createElement("textarea"); e.value = v; e.setAttribute("readonly", "");
    e.style.position = "fixed"; e.style.opacity = "0"; document.body.appendChild(e); e.select();
    document.execCommand("copy"); document.body.removeChild(e); ok(); }catch(err){} };
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(ok, old); else old();
}

(function(){
"use strict";
var D = JSON.parse(document.getElementById("payload").textContent);
var VALS = D.validators, S = D.set.bonded, N = D.set.n, R = D.set.reward_pool;
var MEAN = D.set.mean, BASE = D.set.base_apr;
/* How many validators, from the top, together hold more than a third of the
   stake - the Nakamoto coefficient, the set that could halt the chain. It is
   counted from the LIVE stakes only (the vector the 6-second feed keeps
   current): the range controls reshape a hypothetical set for the APR figures,
   but who can halt the chain is a fact about the chain as it is, so the marker
   never follows them. Seven today, eight or nine when the stakes say so. */
function haltCount(T){
  var tot = 0, i;
  for(i = 0; i < T.length; i++) tot += T[i];
  var acc = 0;
  for(i = 0; i < T.length; i++){ acc += T[i]; if(acc > tot / 3) return i + 1; }
  return T.length;
}
var HALT = 0;
var E = function(i){ return document.getElementById(i); };
var f = function(n){ return n.toLocaleString("en-US",{maximumFractionDigits:0}); };
/* BF scales every yield for a hypothetical bonded ratio.
   If participation moves, stakes scale by k = new/live and the distribution SHAPE is
   unchanged, so APR = R(1-e)/(kS) + R*e/(N*kt) = apr/k. Every yield scales inversely
   with the bonded ratio - which is why the colour pattern below never moves when you
   drag it, only the numbers. */
var LIVE_BONDED = D.set.bonded_pct, BF = 1;
function apr(t,e){ return (R*(1-e)/S + R*e/(N*t)) / BF; }

/* a set with no spread at all: the flat green the signing strip uses */
var EVEN = "#2ee06a";
/* the unpainted tile, in rgb() so ink() can read it and pick light type */
var NEUT = "rgb(24,24,52)";

/* emission ramp: indigo -> violet -> rose -> orange -> amber -> cream. The stops
   are the delegation mockup's own box colours: luminance climbs evenly with no
   plateau and no saturated jump, so the map reads as lit facets, not warnings */
var ST=[[0,26,15,46],[.18,87,33,122],[.36,166,48,72],[.54,228,102,31],
        [.72,250,167,34],[.88,255,214,98],[1,255,248,220]];
function lum(u){ u=Math.max(0,Math.min(1,u));
  for(var i=1;i<ST.length;i++){ var a=ST[i-1],b=ST[i];
    if(u<=b[0]){ var k=(b[0]-a[0])?(u-a[0])/(b[0]-a[0]):0;
      return "rgb("+Math.round(a[1]+(b[1]-a[1])*k)+","+Math.round(a[2]+(b[2]-a[2])*k)+","+
             Math.round(a[3]+(b[3]-a[3])*k)+")"; } }
  return "rgb(255,248,220)"; }
/* the simple view paints validators in the map's own colours */
window.lum = lum;
(function(){
  var g=[]; for(var i=0;i<26;i++) g.push(lum(i/25));
  var hot="linear-gradient(90deg,"+g.join(",")+")";
  /* eta and concentration both repaint THESE cells, so both tracks wear the map's
     own ramp. The staked track is a different quantity - it scales every yield
     rather than reshaping the set - so it keeps a cool ramp of its own. */
  var el=E("eta"); if(el) el.style.background=hot;
  /* The concentration track shows what the MAP looks like at each point along it.
     At the far left the set is even, every validator earns the same, and the
     cells go flat green - so the track starts green and only then opens into the
     heat ramp as concentration widens the spread. */
  /* Concentration reads as a health scale, not a heat map: a smooth green ->
     amber -> red sweep, low to high. Sharing the map's ramp made it
     indistinguishable from the coefficient track sitting beside it. */
  var RT=[[0,46,224,106],[.28,150,214,74],[.55,224,186,56],[.8,240,124,44],[1,255,77,31]];
  function risk(u){ u=Math.max(0,Math.min(1,u));
    for(var i=1;i<RT.length;i++){ var a=RT[i-1],b=RT[i];
      if(u<=b[0]){ var k=(b[0]-a[0])?(u-a[0])/(b[0]-a[0]):0;
        return "rgb("+Math.round(a[1]+(b[1]-a[1])*k)+","+Math.round(a[2]+(b[2]-a[2])*k)+","+
               Math.round(a[3]+(b[3]-a[3])*k)+")"; } }
    return "rgb(255,77,31)"; }
  var rr=[]; for(var y=0;y<26;y++) rr.push(risk(y/25));
  var e3=E("concr"); if(e3) e3.style.background="linear-gradient(90deg,"+rr.join(",")+")";
  var CT=[[0,10,12,38],[.3,28,58,120],[.58,34,132,150],[.82,96,206,196],[1,214,245,242]];
  function cool(u){ u=Math.max(0,Math.min(1,u));
    for(var i=1;i<CT.length;i++){ var a=CT[i-1],b=CT[i];
      if(u<=b[0]){ var k=(b[0]-a[0])?(u-a[0])/(b[0]-a[0]):0;
        return "rgb("+Math.round(a[1]+(b[1]-a[1])*k)+","+Math.round(a[2]+(b[2]-a[2])*k)+","+
               Math.round(a[3]+(b[3]-a[3])*k)+")"; } }
    return "rgb(214,245,242)"; }
  var c=[]; for(var j=0;j<26;j++) c.push(cool(j/25));
  var e2=E("bondr"); if(e2) e2.style.background="linear-gradient(90deg,"+c.join(",")+")";
})();

var maxT = VALS[0][1], MODE = "color";
var LIVE_H = D.height || 0, LIVE_AT = 0, LIVE_MOVED = true, LIVE_V = 0;   /* did the last tick move a stake? (a redraw costs 300 rows) */

/* ── concentration as a model input ────────────────────────────────────────
   eta and the bonded share are single numbers; concentration is a property of
   the whole distribution, so "what if it were 3x" means reshaping who holds
   what. Stake is moved between the top and bottom thirds - proportionally
   within each, so the order never changes - and the TOTAL is preserved, which
   keeps the average validator (and therefore the break-even point) fixed. The
   ADR's own group split is used: 33 / 33 / 34 at N=100. */
var CTARGET = null;
/* the thirds are taken over the validators actually drawn (t.length), never over the chain's
   count N: between rebuilds a validator can join the set before this page has a row for it,
   and reading past the end of the list made every ratio NaN */
function thirds(t){ var n = t.length, g = Math.floor(n / 3); return { n: n, g: g, gl: g }; }   /* n/3 at BOTH ends, as the chain splits (nakamoto_bonus.go, 2026-10-13) */

/* Reshape by pulling every holding toward the mean by one factor:
     t(lambda) = mean + lambda * (t - mean)
   lambda = 1 is the live set, 0 makes every validator identical. It preserves
   the TOTAL (so the average validator and the break-even point never move) and
   preserves the ORDER, which the first attempt did not: moving stake only
   between the top and bottom thirds lifted the bottom third above the untouched
   middle, so the smallest validator ended up in the middle third and the APR
   range stopped responding past 3x.

   Given a target ratio r, with A = high-third average - mean and
   B = low-third average - mean:
     mean + lambda*A = r * (mean + lambda*B)  ->  lambda = mean*(r-1) / (A - r*B)
*/
function lambdaFor(r){
  var t = VALS.map(function(v){ return v[1]; }), k = thirds(t), i, Hi = 0, Lo = 0;
  for(i = 0; i < k.g; i++) Hi += t[i];
  for(i = k.n - k.gl; i < k.n; i++) Lo += t[i];
  var A = Hi/k.g - MEAN, B = Lo/k.gl - MEAN, den = A - r*B;
  if(!den) return 1;
  var lam = MEAN*(r - 1)/den;
  /* never take a holding below zero: the smallest one sets the ceiling */
  var tmin = t[k.n-1];
  if(tmin < MEAN) lam = Math.min(lam, MEAN/(MEAN - tmin) * 0.999);
  return Math.max(0, lam);
}
function shaped(){
  var t = VALS.map(function(v){ return v[1]; });
  if(CTARGET === null) return t;
  var lam = lambdaFor(CTARGET);
  return t.map(function(x){ return MEAN + lam*(x - MEAN); });
}
function ratioOf(t){
  var k = thirds(t), Hi = 0, Lo = 0, i;
  for(i = 0; i < k.g; i++) Hi += t[i];
  for(i = k.n - k.gl; i < k.n; i++) Lo += t[i];
  return Lo ? (Hi/k.g)/(Lo/k.gl) : Infinity;
}

/* What goes INSIDE a cell. The heat fill never changes - the modes add to it
   rather than replace it, so the map never stops being a map. */
/* A stable tint per name, so two logo-less validators never look like the same
   one. Hue only - saturation and lightness stay fixed so nothing fights the map. */
function tint(name){
  var h = 0;
  for(var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return "hsl(" + h + ",42%,66%)";
}
window.__tint = tint;
function initial(name){
  var c = (name || "?").replace(/[^A-Za-z0-9]/g, "").charAt(0);
  return (c || "?").toUpperCase();
}

/* Ink chosen from the cell's REAL luminance, not its position on the ramp.
   Position misjudges the middle: the reds and oranges sit mid-ramp but are
   bright, so a "dark half / light half" split put grey-on-orange exactly where
   the map is busiest. Rec.709 luma on the actual fill gets it right everywhere. */
function ink(rgb){
  var m = /(\d+)\D+(\d+)\D+(\d+)/.exec(rgb);
  if(!m) return ["#fffdf7", "rgba(0,0,0,.55)"];
  var L = (0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3]) / 255;
  return L > 0.5 ? ["#1b0e02", "rgba(255,250,240,.38)"]
                 : ["#fffdf7", "rgba(0,0,0,.55)"];
}

function inner(i, bg, aprPct){
  if(MODE === "rank"){
    /* VALS is stake-descending and re-sorted on every live refresh, so the index
       is the live rank; the hash is set small so the number stays scannable */
    return '<span class=pct><i class=hash>#</i><em>' + (i + 1) + '</em></span>';
  }
  if(MODE === "logo"){
    /* the validator's own mark over its heat cell; anyone without an on-chain
       identity gets an initial on a tint derived from the name, so the grid has
       no holes in it */
    var d = (VALS[i] && window.__VDBY && window.__VDBY[VALS[i][3]]) || (D.vdetail || [])[i];
    if(d && d.av) return '<img src="assets/val/' + att(d.id) + '.jpg" alt="">';
    var nm = (VALS[i] && VALS[i][0]) || "";
    return '<span class=mono style="background:' + tint(nm) + '">' + initial(nm) + '</span>';
  }
  if(MODE === "apr" || MODE === "stake"){
    /* Ink picked against this cell's own fill, not one colour for all of them:
       the ramp runs from near-black to cream, so either choice alone is
       unreadable at one end. */
    /* The unit is set apart from the digits: at a 40px cell a full-size "%" reads
       as another numeral and the value stops being scannable. Small, dimmer, and
       on the same baseline keeps it present without competing. */
    var num;
    if(MODE === "apr"){
      num = aprPct.toFixed(0);
    } else {
      var sh = VALS[i][1] / D.set.bonded * 100;
      num = window.innerWidth < 620
        ? (sh >= 10 ? sh.toFixed(0) : sh < 0.1 ? "<0.1" : sh.toFixed(1))
        : (sh < 1 ? sh.toFixed(2) : sh.toFixed(1));
    }
    /* no inline ink: the flat tiles set it in CSS as a tint of their own fill,
       so the figures read as pressed into the tile rather than printed on it */
    return '<span class=pct><em>' + num + '</em><i>%</i></span>';
  }
  return "";
}

/* Perfectly even means every validator earns the same, and the heat ramp has no
   way to say that: a zero spread lands mid-ramp and paints the whole set red,
   which reads as an alarm when it is the opposite. Flat green instead, the same
   green the signing strip uses for a block that was signed. */
/* Monikers are operator-controlled strings from the chain, and this one lands in
   an HTML attribute rather than a text node. A moniker carrying a quote would
   close the attribute and anything after it would be parsed as markup. */
function cell(i, u, aprPct, title, flat){
  var bg = flat || lum(u);
  return '<div class="cell' + (i < HALT ? ' halt' : '') + '" data-v="' + i +
         '" data-apr="' + aprPct.toFixed(1) + '" tabindex="0" role="button" style="background-color:' + bg +
         '" title="' + att(title) + '">' + inner(i, bg, aprPct) + '</div>';
}

/* Colour bounds that survive an outlier. A validator can join the set with a
   thousandth of the median stake, and the bonus then pays it a rate an order of
   magnitude above everyone else - 606% against a 58% median the day two 5.8k
   validators joined. On a linear ramp that one cell pushes 98 of 100 into the
   bottom eighth of the scale and the map goes flat blue. Colour against the
   2nd-98th percentile instead and let the outliers saturate: they stay the
   brightest cells on the map, everyone else gets the ramp back. The band below
   the map still prints the TRUE min and max - the figures are not clipped, only
   the colour scale is. */
function ramp(a){
  var s = a.slice().sort(function(x, y){ return x - y; });
  /* the colour scale ignores the outer 2% at each end - at least one value each side once the
     set has 20 or more, or on a small set (testnet: 43) the rounding kept the outlier and one
     tiny validator set the top of the scale, pressing every other cell into the red */
  var k = s.length >= 20 ? Math.max(1, Math.floor(s.length * 0.02)) : 0;
  var lo = s[k], hi = s[s.length - 1 - k];
  if(!(hi > lo)){ lo = s[0]; hi = s[s.length - 1]; }
  return [lo, hi - lo];
}
window.ramp = ramp;
function fields(e){
  var T = shaped();
  var ys = T.map(function(t){ return apr(t,e); });
  var lo=Math.min.apply(null,ys), hi=Math.max.apply(null,ys), sp=hi-lo;
  var rb = ramp(ys);
  /* Stake mode colours BY STAKE. It used to print stake figures over an
     APR-coloured map, so switching to it changed the numbers and nothing else -
     which read as the button doing nothing. The heat now matches the label. */
  var byStake = MODE === "stake";
  /* Only Map paints. Vals, APR and Stake carry their own content - a mark, a
     figure - and a heat fill behind it just repeats Map in a second place. */
  var heat = MODE === "color";
  /* the halt marker is live math, never the slider's hypothetical set */
  HALT = haltCount(VALS.map(function(v){ return v[1]; }));
  /* In graph mode the 100-cell grid is display:none, and rebuilding its markup
     anyway is what made the Graph button feel slow - a hundred cells parsed on
     every switch for something nobody can see. The APR band below it is still
     on screen, so that part of this function still has to run. */
  if(MODE === "graph" || MODE === "bars"){
    E("aprlo").textContent = (lo*100).toFixed(0) + "%";
    E("aprhi").textContent = (hi*100).toFixed(0) + "%";
    E("g2n").textContent = sp < 1e-9 ? "flat" : (hi/lo).toFixed(1) + "\u00d7";
    if(MODE === "graph") simple(e); else bars(ys);
    return;
  }
  E("g2").classList.toggle("flat", !heat);
  var g2h = VALS.map(function(v,i){
    var u = byStake ? .93 * Math.pow(T[i]/maxT, .55)
                    : (rb[1] ? .08 + .85*Math.pow(Math.max(0, Math.min(1, (ys[i]-rb[0])/rb[1])), .55) : .5);
    /* .93 at most: the ramp's last stretch fades to a near-white cream, and a cell there read as
       unstyled - most of all a lone outlier (testnet: one validator at 166.7% against ~143%) */
    /* .08 floor: the three largest sit at or under the 2nd-percentile clip and
       were painted the ramp's black end - invisible on the frame */
    var flat = heat ? ((sp < 1e-9) ? EVEN : null) : NEUT;
    return cell(i, u, ys[i]*100,
                v[0] + ' - ' + (byStake
                  ? (T[i]/D.set.bonded*100).toFixed(2) + '% of stake'
                  : (ys[i]*100).toFixed(1) + '% APR'), flat);
  }).join("") +
  /* the active set has a hundred places: the ones no validator holds stand as grey boxes
     (testnet: 43 held, 57 open), and a validator that joins takes the next one - so the map,
     and every frame sized from it, keeps its shape on both nets */
  new Array(Math.max(0, 100 - VALS.length) + 1).join('<div class="cell pad" aria-hidden=true title="An open place in the active set"></div>');
  /* a hundred cells are re-parsed only when one of them changed: a tick that moves no
     figure costs nothing, and the cell the keyboard is on keeps its focus */
  var g2 = E("g2"); if(g2.__h !== g2h){ g2.__h = g2h; g2.innerHTML = g2h; }
  /* the reservation has done its job the moment there are cells to measure */
  var gw = E("gwrap");
  if(gw && gw.style.aspectRatio !== "auto") gw.style.aspectRatio = "auto";
  E("aprlo").textContent = (lo*100).toFixed(0) + "%";
  E("aprhi").textContent = (hi*100).toFixed(0) + "%";
  E("g2n").textContent = sp < 1e-9 ? "flat" : (hi/lo).toFixed(1) + "×";
}
/* hovering a tile writes that validator into the band under the map */
(function(){
  var g = E("g2"), ax = document.querySelector(".apx");
  if(!g || !ax) return;
  var base = null;
  function show(c){
    if(base === null) base = ax.innerHTML;
    var i = +c.dataset.v, v = VALS[i]; if(!v) return;
    ax.innerHTML = '#' + (i + 1) + '  <b>' + att(v[0]) + '</b>  ' + c.dataset.apr + '%';
    ax.classList.add("hov");
  }
  function hide(){ if(base !== null){ ax.innerHTML = base; base = null; } ax.classList.remove("hov"); }
  [g, E("vbars")].forEach(function(g){
    if(!g) return;
    g.addEventListener("mouseover", function(ev){ var c = ev.target.closest(".cell,.vbar"); if(c) show(c); });
    g.addEventListener("mouseleave", hide);
    g.addEventListener("focusin", function(ev){ var c = ev.target.closest(".cell,.vbar"); if(c) show(c); });
    g.addEventListener("focusout", hide);
  });
  /* a redraw replaces the cells and the band text; forget the old base */
  window.addEventListener("thermo:redraw", function(){ base = null; ax.classList.remove("hov"); });
})();

/* Mode buttons. Re-render rather than toggle a class, because the APR figure
   and the logo both depend on values that move with the slider. */
Array.prototype.forEach.call(document.querySelectorAll(".mbtn"), function(b){
  b.addEventListener("click", function(){
    MODE = b.getAttribute("data-m");
    Array.prototype.forEach.call(document.querySelectorAll(".mbtn"), function(o){
      o.setAttribute("aria-pressed", o === b ? "true" : "false");
    });
    var g = E("gwrap"), c = E("cwrap"), bw = E("bwrap");
    if(g && c && bw){
      var graph = MODE === "graph", bar = MODE === "bars";
      /* measure BEFORE hiding: a display:none element reports zero height, and
         the chart needs that number to occupy the same space */
      if(graph || bar) rememberGridH();
      g.style.display = graph || bar ? "none" : "";
      c.style.display = graph ? "" : "none";
      bw.style.display = bar ? "" : "none";
      /* hand the chart the grid's height as a hard number - flex will not give
         it back on its own, and a short chart drags the whole pane up */
      c.style.height = graph && gridH ? gridH + "px" : "";   /* the box, not the svg */
      bw.style.height = bar && gridH ? gridH + "px" : "";
    }
    tapNote();
    var ev = +E("eta").value / 100;
    fields(ev);
  });
});

/* The map is what the Staking tab opens on: a click on the tab, or a page the browser brings
   back from its back/forward cache, returns to Map from whichever view was last used (a fresh
   load already starts there) */
window.__mapMode = function(m){
  var b = document.querySelector('.mbtn[data-m="' + m + '"]');
  if(b && MODE !== m) b.click();
};
window.addEventListener("pageshow", function(ev){ if(ev.persisted) window.__mapMode("color"); });

/* trend */
/* The Effect chart, drawn into any svg at that svg's own pixel size: the Trend panel's box, or the popup that opens it big
   (2026-10-30: the popup copied the panel's drawing into a fixed 900x300 frame, so it sat small in one corner of an empty
   card). Its frame, type, strokes and dots match Projection's beside it exactly; the marker's tag sits right of its line,
   as TODAY does (BONUS ON sat left of it and ran into the series name). */
function drawTrendTo(el, W, H, sm){
  /* Weekly on both sides of the bonus. Months could not resolve eight weeks of
     bonus - two points is one interval - and a measure that changes scale at the
     very line it is meant to test proves nothing. */
  var T=D.weekly, PL=sm?34:64, PR=sm?6:28, PT=sm?20:26, PB=sm?34:46;
  /* phones: the axis figures start at the title's left edge and the plot runs to the boxes' right edge, as Projection's */
  var YLX=sm?0:PL-11, YLA=sm?"start":"end";
  if(!el) return;
  if(!T || T.length<2){ el.innerHTML=""; return; }
  var vs=T.map(function(x){return x.top10;});
  var lo=Math.floor(Math.min.apply(null,vs))-1, hi=Math.ceil(Math.max.apply(null,vs))+1;
  var X=function(i){return PL+i/(T.length-1)*(W-PL-PR);};
  var Y=function(v){return PT+(1-(v-lo)/(hi-lo))*(H-PT-PB);};
  var s="",d="",bi=-1;
  T.forEach(function(x,i){ if(bi<0 && x.wk>=0) bi=i; });
  var step=Math.max(1,Math.ceil((hi-lo)/6));
  for(var g=lo+1;g<hi;g+=step) s+='<line x1="'+PL+'" y1="'+Y(g)+'" x2="'+(W-PR)+'" y2="'+Y(g)+
    '" stroke="#232342"/><text x="'+YLX+'" y="'+(Y(g)+4)+'" text-anchor="'+YLA+'" font-size="11.5" fill="#6f6d94">'+g+'%</text>';
  var bx = bi>0 ? X(bi-0.5) : null;
  if(bx!==null){ s+='<rect x="'+bx+'" y="'+PT+'" width="'+(W-PR-bx)+'" height="'+(H-PT-PB)+'" fill="#ff4d1f12"/>'+
    '<line x1="'+bx+'" y1="'+PT+'" x2="'+bx+'" y2="'+(H-PB)+'" stroke="#ff4d1f" stroke-width="1.5"/>'+
    '<text x="'+(bx+10)+'" y="'+(PT+17)+'" font-size="12.5" fill="#ff4d1f">BONUS ON</text>'; }
  T.forEach(function(x,i){ d+=(i?"L":"M")+X(i).toFixed(1)+" "+Y(x.top10).toFixed(1); });
  s+='<path d="'+d+'" fill="none" stroke="#fff8dc" stroke-width="3"/>';
  /* every week is a point, but a label every week would be a smear - one in four,
     always including the first week of the bonus */
  var lab=Math.ceil(T.length/9);
  /* drawn at the box's real size, where nine dates can crowd: a date keeps 52px from the last one and from the bonus's
     start (which always shows), and the dates at the ends anchor inward so neither is clipped */
  var lastLX=-99, bX=bi>=0?X(bi):-999;
  var dlab=function(x,i){ var lx=X(i), a="middle";
    if(i!==bi && (lx-lastLX<52 || Math.abs(lx-bX)<52)) return ""; lastLX=lx;
    if(lx>W-PR-24){ lx=W-PR; a="end"; } else if(lx<PL+20){ a="start"; }
    return '<text x="'+lx.toFixed(1)+'" y="'+(H-PB+23)+'" text-anchor="'+a+'" font-size="10.5" fill="#6f6d94">'+x.date+'</text>'; };
  /* dots as Projection's: 4, the latest 6 (Projection's TODAY), outlined 1.5 */
  T.forEach(function(x,i){ var on=bi>=0&&i>=bi, last=i===T.length-1;
    s+='<circle cx="'+X(i).toFixed(1)+'" cy="'+Y(x.top10).toFixed(1)+'" r="'+(last?6:4)+
      '" fill="'+(on?"#ff4d1f":"#fff8dc")+'" stroke="#06060c" stroke-width="1.5"><title>'+
      x.date+", "+x.top10+"%, nakamoto "+x.nakamoto+'</title></circle>';
    if(i===bi || (i-bi)%lab===0) s+=dlab(x,i); });
  s+='<text x="'+PL+'" y="'+(PT+17)+'" font-size="12.5" fill="#a5a3c4">'+
    (sm?"10 LARGEST VALS":"10 LARGEST VALIDATORS")+'</text>';
  el.setAttribute("viewBox","0 0 "+W+" "+H);
  el.setAttribute("preserveAspectRatio","none");
  el.innerHTML=s;
}
/* the Trend panel's copy: the viewBox takes the BOX's own shape (audit 2026-10-13: a fixed 900x300 letterboxed into the
   tall Trend panel drew the whole chart at ~44% with 6px axis text), as the bonus Graph does; redrawn on resize */
window.__drawTrendTo = drawTrendTo;   // the popup's chart (its code lives in another scope)
var drawTrend = function(){
  // the layout size (clientWidth/Height): a view switching in is scaled by its animation, which getBoundingClientRect reports
  var sm = window.innerWidth < 620, t = E("trend"), box = t ? { width: t.clientWidth, height: t.clientHeight } : null;
  drawTrendTo(E("trend"), box && box.width > 40 ? Math.round(box.width) : (sm?460:900), box && box.height > 40 ? Math.round(box.height) : 300, sm);
};
drawTrend();
(function(){ var t; window.addEventListener("resize", function(){ clearTimeout(t); t = setTimeout(drawTrend, 180); }); })();
/* and when its box first takes a width: drawn at load while the Trend view is hidden, a phone kept the fallback frame */
if(window.ResizeObserver && E("trend")){ (function(){ var tk = ""; new ResizeObserver(function(en){ var w = Math.round(en[0].contentRect.width), h = Math.round(en[0].contentRect.height);
  if(w > 40 && w + "x" + h !== tk){ tk = w + "x" + h; drawTrend(); } }).observe(E("trend")); })(); }

/* pivot */
/* the arithmetic pane and its plot() were retired; simple() below draws the
   fold chart for Graph mode from the same maths */
/* the log axis the fold chart samples across: from just under the smallest
   stake to just over the largest */
var l0=Math.log10(VALS[VALS.length-1][1]*0.8), l1=Math.log10(maxT*1.25);
var gridH = 0;
function rememberGridH(){
  var g = E("gwrap");
  if(g && g.offsetHeight) gridH = g.offsetHeight;
}
/* Bars: one bar per validator, in the map's order (largest first) and on the map's percentile scale, so one outlier
   tops out instead of flattening the rest; the smallest fifth, where the bonus pays most, stands out. A bar opens
   its validator's card as a map box does */
function bars(ys){
  var el = E("vbars"); if(!el) return;
  var n = ys.length, rp = ramp(ys), top = (rp[0] + rp[1]) * 1.04;
  var base = Math.max(0, Math.floor(Math.min.apply(null, ys) * 100 / 5) * 5 - 5) / 100;
  var hot = Math.max(1, Math.round(n * 0.2)), s = "";
  for(var i = 0; i < n; i++){
    var h = Math.max(.04, Math.min(1, (ys[i] - base) / ((top - base) || 1)));
    s += '<div class="vbar' + (i >= n - hot ? ' hot' : i < hot ? ' big' : '') + (i < HALT ? ' halt' : '') + '" data-v="' + i +
         '" data-apr="' + (ys[i] * 100).toFixed(1) + '" tabindex="0" role="button" style="--h:' + (h * 100).toFixed(1) + '%" title="' +
         att('#' + (i + 1) + ' ' + VALS[i][0] + ' - ' + (ys[i] * 100).toFixed(1) + '% APR') + '"></div>';
  }
  if(el.__h !== s){ el.__h = s; el.innerHTML = s; }
}
function simple(e){
  var el = E("foldchart"); if(!el) return;
  var small = window.innerWidth < 620;
  var W = small ? 440 : 900;
  /* Occupy exactly the space the grid vacated. The SVG scales to its container
     width, so the rendered height is W/H of the viewBox - pick H to land on the
     grid's measured height and switching modes stops shifting the page. */
  var box = el.parentNode;
  var cw = box.clientWidth || W;
  var ch = box.clientHeight || gridH;
  var H = ch && cw ? Math.round(W * ch / cw) : 250;
  /* a short box keeps a readable chart by widening the drawing, never by letterboxing it:
     the viewBox always has the box's own shape, so the plot reaches both of its sides */
  var Hmin = small ? 190 : 170;
  if(H < Hmin){ H = Hmin; if(ch && cw) W = Math.round(H * cw / ch); }
  /* edge to edge, like the map's cells: the per-cent figures sit inside the plot, under their rules */
  var L = 0, Rr = 0;
  var T = small ? 22 : 24, B = small ? 40 : 42;
  var FS = small ? 13 : 11, FB = small ? 14 : 13;
  el.setAttribute("viewBox", "0 0 " + W + " " + H);
  /* give it a real size, both ways. Left to its intrinsic ratio this element
     kept the height of whichever viewBox it had first. */
  el.setAttribute("width", cw); el.setAttribute("height", ch);
  el.style.width = cw + "px"; el.style.height = ch + "px";

  var ST = shaped();
  var ys = ST.map(function(t){ return apr(t, e); });
  var mx = Math.max.apply(null, ys), mn = Math.min.apply(null, ys);
  /* Same outlier problem as the map: one 5.8k validator earning 606% sets a 680%
     axis and flattens the other 98 along the bottom. Scale to the 98th percentile
     and let the curve run off the top - which is the honest reading, since the
     bonus really does pay the smallest validators off this chart. The callouts
     still print the true extremes. */
  var rp = ramp(ys);
  var YM = Math.max(0.1, Math.ceil((rp[0] + rp[1]) * 1.12 / 0.1) * 0.1);
  /* The axis follows the modelled set too, or the dots bunch at one end as the
     spread closes. An even set has no spread to plot, so give it a nominal one
     rather than dividing by zero. */
  var tMin = Math.min.apply(null, ST), tMax = Math.max.apply(null, ST);
  var a0 = Math.log10(Math.max(1, tMin) * 0.8), a1 = Math.log10(Math.max(1, tMax) * 1.25);
  if(a1 - a0 < 0.08){ var mid = (a0 + a1) / 2; a0 = mid - 0.4; a1 = mid + 0.4; }
  /* Descending: the big validators anchor the left, the tail runs out to the
     right. Reads with the APR band under it, which puts lowest on the left. */
  var X = function(t){ return L + (a1 - Math.log10(t)) / (a1 - a0) * (W - L - Rr); };
  var Y = function(v){ return T + (1 - v / YM) * (H - T - B); };
  var s = "";

  s += '<defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">' +
       '<stop offset="0" stop-color="#ffb02e" stop-opacity=".30"/>' +
       '<stop offset="1" stop-color="#ffb02e" stop-opacity="0"/></linearGradient></defs>';

  for(var i = 0; i <= 2; i++){
    var gv = YM * i / 2;
    s += '<line x1="' + L + '" y1="' + Y(gv) + '" x2="' + (W - Rr) + '" y2="' + Y(gv) + '" stroke="#232342"/>';
    /* 0% needs no figure: the floor is the floor, and the end labels sit right under it */
    if(i) s += '<text x="' + (L + 2) + '" y="' + (Y(gv) + FS + 4) + '" font-size="' + FS + '" fill="#6f6d94">' +
         (gv * 100).toFixed(0) + '%</text>';
  }

  var d = "", i2;
  for(i2 = 0; i2 <= 160; i2++){
    var t = Math.pow(10, l0 + (l1 - l0) * i2 / 160);
    d += (i2 ? "L" : "M") + X(t).toFixed(1) + " " + Y(Math.min(apr(t, e), YM)).toFixed(1);
  }
  s += '<path d="' + d + 'L' + L + ' ' + Y(0) + 'L' + (W - Rr) + ' ' + Y(0) +
       'Z" fill="url(#fill)"/>';
  s += '<path d="' + d + '" fill="none" stroke="#ffb02e" stroke-width="' +
       (small ? 3 : 2.6) + '" stroke-linecap="round"/>';

  ST.forEach(function(t, k){
    s += '<circle cx="' + X(t).toFixed(1) + '" cy="' + Y(Math.min(ys[k], YM)).toFixed(1) +
         '" r="' + (small ? 3 : 3.4) + '" fill="#fff8dc" fill-opacity=".55"/>';
  });

  var xm = X(MEAN);
  s += '<line x1="' + xm + '" y1="' + T + '" x2="' + xm + '" y2="' + (H - B) +
       '" stroke="#8d8ab8" stroke-width="1" stroke-dasharray="3 4"/>';
  s += '<text x="' + xm + '" y="' + (T - 7) + '" text-anchor="middle" font-size="' + FS +
       '" fill="#a5a3c4">AVERAGE VALIDATOR</text>';

  /* the two ends, named in words and tied to their own dot */
  var xs = X(ST[ST.length - 1]), yS = Y(Math.min(ys[ys.length - 1], YM));
  var xl = X(ST[0]),             yL = Y(Math.min(ys[0], YM));
  s += '<circle cx="' + xs.toFixed(1) + '" cy="' + yS.toFixed(1) + '" r="' + (small ? 5 : 5.5) +
       '" fill="#ff4d1f" stroke="#06060c" stroke-width="1.5"/>';
  s += '<circle cx="' + xl.toFixed(1) + '" cy="' + yL.toFixed(1) + '" r="' + (small ? 5 : 5.5) +
       '" fill="#6f66c8" stroke="#06060c" stroke-width="1.5"/>';
  s += '<text x="' + (xs - 8) + '" y="' + (yS - 8) + '" text-anchor="end" font-size="' + FB +
       '" fill="#fff8dc">' + (mx * 100).toFixed(0) + '%</text>';
  s += '<text x="' + (xl + 8) + '" y="' + (yL - 10) + '" font-size="' + FB +
       '" fill="#fff8dc">' + (mn * 100).toFixed(0) + '%</text>';

  s += '<text x="' + L + '" y="' + (H - 14) + '" font-size="' + FS +
       '" fill="#6f66c8">LARGEST VALIDATOR</text>';
  s += '<text x="' + (W - Rr) + '" y="' + (H - 14) + '" text-anchor="end" font-size="' + FS +
       '" fill="#ff4d1f">SMALLEST VALIDATOR</text>';
  /* on a phone the mean sits near the middle and this label collides with the
     one over the line; the per-cent axis says the same thing anyway */
  if(!small) s += '<text x="' + L + '" y="' + (T - 7) + '" font-size="' + FS +
       '" fill="#a5a3c4">YEARLY RETURN</text>';
  el.innerHTML = s;
}


var sl=E("eta"), bd=E("bond");

/* The knob is an overlay, so it has to be told where the native thumb is. The
   thumb centre does NOT sit at value% of the track: it travels between half a
   thumb-width in from each end, so the usable span is (track - thumb). */
var KNOB_W = 24;
function place(inp, knob){
  if(!inp || !knob) return;
  var w = inp.offsetWidth; if(!w) return;
  var lo = +inp.min, hi = +inp.max;
  var t = (+inp.value - lo) / (hi - lo || 1);
  knob.style.left = (KNOB_W / 2 + t * (w - KNOB_W)) + "px";
}
/* Flex centres a glyph's line box, not its ink: eta's descender drags it low,
   a cap-height C or S sits high, and the correction depends on whichever mono
   face the device actually resolved - so it is measured in the reader's own
   browser rather than baked from mine. */
function centerKnobs(){
  /* every letter that sits in a circle - the three range handles, the three
     buttons above the map and the three panel corners - is centred the same way */
  Array.prototype.forEach.call(document.querySelectorAll(".kg"), function(g){
    if(!(g.textContent || "").trim()) return;          // drawn glyph: nothing to measure
    var cs = getComputedStyle(g);
    var c = centerKnobs._c || (centerKnobs._c = document.createElement("canvas").getContext("2d"));
    c.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
    var m = c.measureText(g.textContent);
    if(typeof m.actualBoundingBoxAscent !== "number") return;   // no ink metrics
    /* Where the baseline sits inside the line box is measured in the DOM, with a
       zero-height inline-block whose bottom edge rests on the baseline by
       definition. Deriving it from TextMetrics.fontBoundingBox* instead looked
       tidier but is missing on Safari before 17.4, and a missing number there
       skipped the correction entirely - which is exactly the phone this is for. */
    var probe = document.createElement("span");
    probe.setAttribute("style", "position:absolute;visibility:hidden;white-space:pre;" +
      "font:" + cs.fontStyle + " " + cs.fontWeight + " " + cs.fontSize + "/" +
      cs.lineHeight + " " + cs.fontFamily);
    probe.textContent = g.textContent;
    var strut = document.createElement("i");
    strut.setAttribute("style", "display:inline-block;width:0;height:0");
    probe.appendChild(strut);
    document.body.appendChild(probe);
    var base = strut.getBoundingClientRect().bottom - probe.getBoundingClientRect().top;
    document.body.removeChild(probe);
    var L = parseFloat(cs.fontSize);                            // line-height is 1
    var ink  = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    /* Snap to the device pixel grid. A fractional translate is rasterised at a
       fractional offset, which on a 9px letter reads as a smeared, slightly
       wrong glyph - the correction has to land the ink on a whole device pixel
       to actually look centred. */
    /* at least half-pixel steps: on a 1x screen whole-pixel snapping left a 9px
       S visibly low (needed +0.3px, got +1px); a half pixel is a faint edge, a
       whole pixel is a letter off centre */
    var dpr = Math.max(2, window.devicePixelRatio || 1);
    var snap = function(v){ return (Math.round(v * dpr) / dpr).toFixed(3) + "px"; };
    g.style.setProperty("--ky", snap(L / 2 - (base - ink)));
    g.style.setProperty("--kx",
      snap(m.width / 2 - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2));
  });
}
function placeKnob(){ place(sl, E("knob")); place(E("bondr"), E("knob2"));
                      place(E("concr"), E("knob3")); }
centerKnobs();
if(document.fonts && document.fonts.ready) document.fonts.ready.then(centerKnobs);
window.addEventListener("resize", function(){ placeKnob(); if(MODE!=="graph" && MODE!=="bars") rememberGridH(); if(MODE==="graph") simple(+sl.value/100);
  if(MODE==="bars"){ var bw = E("bwrap"); if(bw && gridH) bw.style.height = gridH + "px"; } });
sl.value = Math.round(D.eta.now*100);
bd.value = 0;   // 0 = follow the live ratio
/* ── the live vector ──────────────────────────────────────────────────────────
   Everything drawn here is a pure function of: each validator's stake, the bonded
   total, the validator count, the coefficient and the reward pool. So the fast
   path is not an API - it is those numbers, refreshed, and the same local model
   recomputing on top of them. 1.4KB gzipped against a 5.8s block. */
/* a validator's id is its full operator address (2026-10-01, audit H1). A live.json written before that
   keys the vector by the last six characters: it is read through the set's own ids, and a suffix two
   validators share keeps both at the figure they have (an old vector cannot tell them apart; it only
   ever sets the stake shown, never an address that is signed) */
function liveVec(v){
  for(var k in v){ if(k.indexOf("atonevaloper") === 0) return v; break; }
  var n6 = {}, out = {}, i, s6;
  for(i = 0; i < VALS.length; i++){ s6 = String(VALS[i][3]).slice(-6); n6[s6] = (n6[s6] || 0) + 1; }
  for(i = 0; i < VALS.length; i++){ s6 = String(VALS[i][3]).slice(-6);
    if(typeof v[s6] === "number") out[VALS[i][3]] = n6[s6] === 1 ? v[s6] : VALS[i][1]; }
  return out;
}
function applyLive(d){
  if(!d || !d.v || !d.s || !d.n) return false;
  if(d.h && d.h <= LIVE_H) return false;          /* never go backwards */
  var moved = false, i;
  d = { h: d.h, n: d.n, s: d.s, r: d.r, v: liveVec(d.v) };
  for(i = 0; i < VALS.length; i++){
    var t = d.v[VALS[i][3]];
    if(typeof t === "number" && t !== VALS[i][1]){ VALS[i][1] = t; moved = true; }
  }
  /* A validator can leave or join the bonded set between rebuilds. Dropping one
     we no longer see is safe; adding one we have no moniker for is not, so that
     waits for the next full rebuild rather than inventing a row (the model still
     counts it: N is the chain's count). A vector that lost half the set is a bad
     read, not a departure, and drops nothing. */
  var gone = 0;
  for(i = 0; i < VALS.length; i++) if(typeof d.v[VALS[i][3]] !== "number") gone++;
  if(gone && gone < VALS.length / 2){
    for(i = VALS.length - 1; i >= 0; i--) if(typeof d.v[VALS[i][3]] !== "number") VALS.splice(i, 1);
    moved = true;
  }
  if(d.n !== N) moved = true;
  if(!moved && d.h === LIVE_H) return false;
  LIVE_H = d.h || LIVE_H; LIVE_AT = Date.now(); LIVE_MOVED = moved; if(moved) LIVE_V++;
  /* rank is stake order, and stake just moved */
  VALS.sort(function(a, b){ return b[1] - a[1]; });
  S = d.s; N = d.n; R = d.r || R;
  MEAN = S / N; BASE = R / S;
  maxT = VALS[0][1];
  LIVE_C = ratioOf(VALS.map(function(v){ return v[1]; }));
  return true;
}

window.__applyLive = applyLive;
window.__liveMoved = function(){ return LIVE_MOVED; };
/* the whole set again, from data.json: monikers, commissions, jailings, the lifetime
   record, and every detail the cards and the dashboard read - what the refresh button
   is for. The live tokens (the 6-second vector) are kept; a validator new to the set
   takes the build's figure until the next tick. */
function applyData(d){
  if(!d || !d.validators || !d.validators.length || !d.set) return false;
  var live = {}, i;
  for(i = 0; i < VALS.length; i++) live[VALS[i][3]] = VALS[i][1];
  var next = d.validators.map(function(v){
    var id = String(v.op);                       /* the full operator address (2026-10-01) */
    return [v.m, live[id] != null ? live[id] : v.t, v.c, id, v.jail || 0,
            v.life_n ? Math.round((1 - v.life_missed / v.life_n) * 100000) / 1000 : null];
  });
  VALS.length = 0; Array.prototype.push.apply(VALS, next);
  VALS.sort(function(a, b){ return b[1] - a[1]; });
  D.set = d.set; D.eta = d.eta || D.eta; D.vdetail = d.validators; D.generated = d.generated || D.generated;
  if(!LIVE_AT){ S = d.set.bonded; R = d.set.reward_pool; }     /* a live tick outranks the build */
  N = VALS.length; MEAN = S / N; BASE = R / S; maxT = VALS[0][1];
  LIVE_C = ratioOf(VALS.map(function(v){ return v[1]; }));
  if(window.__setVD) window.__setVD(d.validators);
  if(window.__rebuildInact) window.__rebuildInact(d.inactive);   /* a jailing since the page opened is not an offer (audit 2026-10-13) */
  return true;
}
window.__applyData = applyData;
function render(){
  /* data-b=0 is the live ratio - a fixed chip would go stale the moment the chain's
     bonded share moved, and this page is regenerated every 15 minutes. */
  var e=+sl.value/100, raw=+bd.value, pct = raw === 0 ? LIVE_BONDED : raw;
  BF = pct / LIVE_BONDED;
  var et = E("etatop"); if(et) et.textContent = e.toFixed(2);
  /* the strip: each row's readout, the live ticks, and the dirty flag */
  whatif();
  /* the top readout shows what the MAP is drawn at, so it follows the slider
     rather than the chain - the chip beside it keeps the live figure */
  var ct = E("ctop");
  if(ct) ct.textContent = (CTARGET === null ? LIVE_C : CTARGET).toFixed(2) + "\u00d7";
  /* eta's accent follows the modelled concentration, so dragging C below the
     threshold flips the coefficient from rising to falling in front of you */
  var up = (CTARGET === null ? LIVE_C : CTARGET) >= THRESH;
  var qb = E("qbtn"); if(qb){ qb.classList.toggle("rise", up); qb.classList.toggle("fall", !up); }
  /* same flag, inverted reading: green is the low-concentration side */
  var cb = E("cbtn"); if(cb) cb.classList.toggle("low", !up);
  if(CTARGET === null && cr) cr.value = Math.round(LIVE_C * 100);   /* the handle rides the live tick */
  placeKnob();
  /* Show the ATONE that would be staked at the chosen ratio - the quantity the
     reader is actually moving. A "yields ÷2.00" multiplier described the effect but
     never named the cause. At the live setting this is the real staked figure. */
  var st = E("bstake");
  if(st) st.textContent =
    ((raw === 0 ? D.set.bonded : D.set.supply * pct / 100) / 1e12).toFixed(1) + "M";
  fields(e);
  window.dispatchEvent(new Event("thermo:redraw")); }
/* a finger or a mouse dragging a handle fires input many times a frame on some devices: one
   redraw per frame is all anyone can see (an event raised by script still redraws at once) */
var RQ = false;
function soon(ev){
  if(ev && ev.isTrusted === false){ render(); return; }
  if(RQ) return; RQ = true; requestAnimationFrame(function(){ RQ = false; render(); });
}
window.__redraw = render;   /* redraws every derived figure from module state */
window.__S = function(){ return S; };
window.__ETA = function(){ return D.eta.now; };      /* the live coefficient, for the wallet's pricing */
window.__N = function(){ return N; };
window.__R = function(){ return R; };
window.__VALS = function(){ return VALS; };
window.__D = D;
window.__ratio = function(){ return ratioOf(VALS.map(function(v){ return v[1]; })); };   /* largest third against smallest */
window.__thresh = function(){ return +D.thresh || 3; };                                        /* the page's own vector: set, eta, trend, detail */
window.__LIVEH = function(){ return LIVE_H; };
window.__LIVEAT = function(){ return LIVE_AT; };
window.__LIVEV = function(){ return LIVE_V; };       /* counts the ticks that moved a stake */
/* the height under the name, on every tick */
(function(){
  function tick(){ var e = document.getElementById("dlive"); if(e && LIVE_H) e.querySelector("b").textContent = LIVE_H.toLocaleString(); }
  window.addEventListener("thermo:live", tick); tick();
})();

sl.addEventListener("input", soon);
/* The track and the four buttons write the same hidden field, so neither can get
   out of step with the other. data-b=0 still means "follow the live ratio". */
var br = E("bondr");
if(br){
  br.value = Math.round(LIVE_BONDED);
  br.addEventListener("input", function(ev){ bd.value = (+br.value === Math.round(LIVE_BONDED)) ? 0 : br.value; soon(ev); });
}
/* the concentration track carries hundredths of a multiple, so 1041 is 10.41x */
var THRESH = +D.thresh || 3;
var cr = E("concr"), LIVE_C = ratioOf(VALS.map(function(v){ return v[1]; }));
if(cr){
  cr.value = Math.round(LIVE_C * 100);
  cr.addEventListener("input", function(ev){
    CTARGET = +cr.value / 100;
    soon(ev);
  });
}
if(bd.addEventListener) bd.addEventListener("input", soon);
/* ── the what-if strip ───────────────────────────────────────────────────────
   No chips: every value is on the track. A white tick marks the chain as it is
   (it moves with the live feed); a handle within one step of it snaps home. The
   strip, the readouts and the Reset button turn amber while any handle is away
   from live, so a hypothetical is never mistaken for the chain. Each row's
   reset, or a release within a step of live, brings it home. */
/* a tick on a slider's track, placed as the knobs are (render.py's knob_left): a share of the
   track in percent, so it holds while the calculator is hidden. Measured in pixels it could not
   be placed then (width 0) and stayed at the start of the range until a reload. */
function tickAt(inp, tick, v){
  if(!inp || !tick) return;
  var t = Math.min(1, Math.max(0, (v - +inp.min) / (+inp.max - +inp.min || 1)));
  tick.style.left = "calc(" + (KNOB_W / 2) + "px + " + t.toFixed(5) + " * (100% - " + KNOB_W + "px))";
}
function liveOf(k){
  return k === "e" ? Math.round(D.eta.now * 100)
       : k === "c" ? Math.round(LIVE_C * 100) : Math.round(LIVE_BONDED);
}
function whatif(){
  var rows = { e: sl, c: cr, s: br }, dirty = false, moved = 0;
  Object.keys(rows).forEach(function(k){
    var inp = rows[k]; if(!inp) return;
    var live = liveOf(k), d = k === "c" ? CTARGET !== null : +inp.value !== live;
    if(k === "s") d = +bd.value !== 0;
    dirty = dirty || d; if(d) moved++;
    var row = inp.closest(".wrow"); if(!row) return;
    row.classList.toggle("dirty", d);
    /* the reset names the live value it returns to: read off the readout while it shows live -
       a frame later, since a reset rewrites the readout after this runs */
    var rv = row.querySelector(".rval"), rl = row.querySelector(".rlive"), rb = row.querySelector(".rreset");
    if(!d && rv && rl) requestAnimationFrame(function(){ if(!row.classList.contains("dirty")){ rl.textContent = rv.textContent; if(rb) rb.title = "Reset to " + rv.textContent + " (Esc on the slider does the same)"; } });
  });
  document.documentElement.toggleAttribute("data-dirty", dirty);
  var wn = E("wifnote"), tn = E("tapnote"), wc = E("wifn");
  if(wn) wn.hidden = !dirty;
  if(tn) tn.hidden = dirty;
  tapNote();
  if(wc) wc.textContent = moved + (moved === 1 ? " slider" : " sliders") + " moved from live";
  tickAt(sl, E("tke"), liveOf("e"));
  tickAt(cr, E("tkc"), liveOf("c"));
  tickAt(cr, E("tkt"), +(E("tkt") || {dataset:{}}).dataset.v || 0);
  tickAt(br, E("tks"), liveOf("s"));
}
/* "tap any box" belongs to Map alone (operator, 2026-10-12); in the other views it keeps its place unseen, so the
   row under it never moves when the view changes */
function tapNote(){ var tn = E("tapnote"); if(tn) tn.style.visibility = MODE === "color" ? "" : "hidden"; }
function resetLive(k){
  if(!k || k === "e") sl.value = liveOf("e");
  if(!k || k === "c"){ CTARGET = null; if(cr) cr.value = liveOf("c"); }
  if(!k || k === "s"){ bd.value = 0; if(br) br.value = liveOf("s"); }
  render();
}
window.__resetLive = function(){ resetLive(); };
/* snap: a handle released within one step of live goes home */
function snap(inp, k){
  if(!inp) return;
  inp.addEventListener("change", function(){
    var live = liveOf(k), step = (+inp.max - +inp.min) / 60;
    if(Math.abs(+inp.value - live) <= step && +inp.value !== live){
      inp.value = live;
      if(k === "c") CTARGET = null;
      if(k === "s") bd.value = 0;
      render();
    }
  });
}
snap(sl, "e"); snap(cr, "c"); snap(br, "s");
/* the S track writes the hidden field as a hypothetical; landing on live means 0 */
Array.prototype.forEach.call(document.querySelectorAll(".rreset"), function(b){
  b.addEventListener("click", function(){ resetLive(b.dataset.r); }); });
/* one way back for everything moved, and Esc on a moved slider sends that one home */
var wifall = E("wifall"); if(wifall) wifall.addEventListener("click", function(){ resetLive(); });
[[sl, "e"], [cr, "c"], [br, "s"]].forEach(function(p){
  if(!p[0]) return;
  p[0].addEventListener("keydown", function(ev){
    if(ev.key !== "Escape") return;
    var row = p[0].closest(".wrow"); if(!row || !row.classList.contains("dirty")) return;
    ev.preventDefault(); ev.stopPropagation(); resetLive(p[1]);
  });
});
window.addEventListener("resize", whatif);
render();
rememberGridH();

/* ── eta curve + clickable schedule ── */
(function(){
  var SC = D.schedule, ES = D.eta_stats;
  if(!SC || !SC.length) return;
  /* drawn whenever its box takes a new width: at load the Trend view is hidden, so a phone's first draw had no box to
     take its size from and fell back to a scaled frame */
  function drawEta(){
    var sm = window.innerWidth < 620, ebw = E("etacurve") ? E("etacurve").clientWidth : 0;   // layout size, as the Effect graph
    /* the same frame as the Effect graph beside it (PL/PR/PT/PB and the label offsets), so the two line up. Phones: drawn
       at the box's own size, as the Effect graph is, so its type reads at the page's size; the axis figures start at the
       title's left edge and the plot runs to the boxes' right edge (operator, 2026-10-17: "not scaled as per projection
       title and boxes below") */
    var px = sm && ebw > 200;
    /* wide screens: drawn at its box's own size too (2026-10-30: it still took a fixed 900x300 frame, letterboxed to ~44%
       with 5px type beside the true-size Effect graph) - the same pixels, frame, type and marks as Effect */
    var ebh = E("etacurve") ? E("etacurve").clientHeight : 0, wide = ebw > 200 && ebh > 80;   // any width: the box's own height when it has one
    var W=px||wide?ebw:(sm?460:900), H=wide?ebh:px?Math.round(Math.max(200, ebw*0.6)):300, PL=sm?34:64, PR=sm?6:28, PT=sm?20:26, PB=sm?34:46;
    var YLX=sm?0:PL-11, YLA=sm?"start":"end";
    /* a week whose eta is not known (the rule could not be replayed onto the live value:
       testnet, or a history this page cannot reproduce) has eta null - no point, no line */
    var lo=0, hi=Math.max(ES.cap*0.22, Math.max.apply(null,SC.filter(function(r){return r.eta!=null;}).map(function(r){return r.eta;}))*1.9);
    var X=function(i){return PL+i/(SC.length-1)*(W-PL-PR);};
    var Y=function(v){return PT+(1-(v-lo)/(hi-lo))*(H-PT-PB);};
    var nowI=0; SC.forEach(function(r,i){ if(r.now) nowI=i; });
    var s="";
    for(var g=0;g<=4;g++){ var v=hi*g/4;
      s+='<line x1="'+PL+'" y1="'+Y(v)+'" x2="'+(W-PR)+'" y2="'+Y(v)+'" stroke="#232342"/>'+
         '<text x="'+YLX+'" y="'+(Y(v)+4)+'" text-anchor="'+YLA+'" font-size="11.5" fill="#6f6d94">'+v.toFixed(2)+'</text>'; }
    s+='<line x1="'+PL+'" y1="'+Y(ES.floor)+'" x2="'+(W-PR)+'" y2="'+Y(ES.floor)+
       '" stroke="#6f66c8" stroke-width="1.5" stroke-dasharray="4 4"/>'+
       '<text x="'+(W-PR)+'" y="'+(Y(ES.floor)-7)+'" text-anchor="end" font-size="11" fill="#6f66c8">FLOOR '+ES.floor.toFixed(2)+'</text>';
    /* past solid, future dashed - projections must not look like history */
    var dp="",df="";
    SC.forEach(function(r,i){
      if(r.eta==null) return;
      var pt=X(i).toFixed(1)+" "+Y(r.eta).toFixed(1);
      if(i<=nowI) dp+=(dp?"L":"M")+pt;
      if(i>=nowI) df+=(df?"L":"M")+pt; });
    if(SC.some(function(r){ return r.eta==null; }))
      s+='<text x="'+((PL+X(nowI))/2).toFixed(1)+'" y="'+(Y(ES.floor)-40)+'" text-anchor="middle" font-size="12" fill="#8f8db4">past weeks N/A</text>';
    s+='<path d="'+df+'" fill="none" stroke="#6f6d94" stroke-width="2" stroke-dasharray="5 4"/>';
    s+='<path d="'+dp+'" fill="none" stroke="#ffb02e" stroke-width="3"/>';
    s+='<line x1="'+X(nowI)+'" y1="'+PT+'" x2="'+X(nowI)+'" y2="'+(H-PB)+'" stroke="#ff4d1f" stroke-width="1.5"/>';
    s+='<text x="'+(X(nowI)+10)+'" y="'+(PT+17)+'" font-size="12.5" fill="#ff4d1f">TODAY</text>';
    /* where eta is heading, on the graph under TODAY (operator, 2026-10-02: it was a sentence above the chart) - the
       same three states render.py's STEPLINE had; it flips to the line's left when the right side has no room */
    var Ru = D.rule || {}, st = ES.rising ? "rising" : (ES.weeks_to_floor || 0) > 0 ? "falling" : "held at the floor";
    var lab = "\u03b7 " + st + " now" + (Ru.ratio != null ? " (c = " + Ru.ratio.toFixed(2) + "\u00d7)" : ""), lw = lab.length * 6.6;
    var lx = X(nowI) + 10 + lw > W - PR ? X(nowI) - 10 : X(nowI) + 10;
    s+='<text x="'+lx+'" y="'+(PT+34)+'" font-size="12" fill="#ff4d1f"'+(lx < X(nowI) ? ' text-anchor="end"' : '')+'>'+lab+'</text>';
    /* the axis under it: every other week on wide screens; phones name each month once, never two closer than 30px */
    var lastM = "", lastX = -99;
    var xlab = function(r, i){ var m = r.date.split(" ")[0], x = X(i);
      if(sm){ if(m === lastM || x - lastX < 30) return ""; lastM = m; lastX = x; }
      else if(i%2!==0) return "";
      return '<text x="'+x.toFixed(1)+'" y="'+(H-PB+23)+'" text-anchor="middle" font-size="10.5" fill="#6f6d94">'+m+'</text>'; };
    SC.forEach(function(r,i){
      if(r.eta==null){ s+=xlab(r, i); return; }
      s+='<circle class="etapt" data-i="'+i+'" cx="'+X(i).toFixed(1)+'" cy="'+Y(r.eta).toFixed(1)+
         '" r="'+(r.now?6:4)+'" fill="'+(r.now?"#ff4d1f":i<nowI?"#ffb02e":"#6f6d94")+
         '" stroke="#06060c" stroke-width="1.5" style="cursor:pointer"><title>week '+r.week+
         ", "+r.date+", η "+r.eta.toFixed(2)+'</title></circle>';
      s+=xlab(r, i); });
    E("etacurve").setAttribute("viewBox","0 0 "+W+" "+H);
    if(wide) E("etacurve").setAttribute("preserveAspectRatio","none"); else E("etacurve").removeAttribute("preserveAspectRatio");
    E("etacurve").innerHTML=s;
  }
  drawEta();
  if(window.ResizeObserver && E("etacurve")){ var etaK = ""; new ResizeObserver(function(en){ var w = Math.round(en[0].contentRect.width), h = Math.round(en[0].contentRect.height);
    if(w > 40 && w + "x" + h !== etaK){ etaK = w + "x" + h; drawEta(); } }).observe(E("etacurve")); }

  /* popup */
  var pop=E("pop"), R=D.set.reward_pool, N=D.set.n;
  function show(i){
    var r=SC[i];
    E("popw").textContent=r.week;
    var k=r.eta!=null;
    E("pope").textContent=k?r.eta.toFixed(2):"N/A";
    E("popd").textContent=r.date;
    E("popp").textContent=k?(r.eta*100).toFixed(0)+"%":"N/A";
    E("popb").textContent=k?((1-r.eta)*100).toFixed(0)+"%":"N/A";
    E("popf").textContent=k?f(R*r.eta/N/1e6)+" ATONE / yr":"N/A";
    /* the exact block the epoch opened on, from our own index - blank for the
       weeks the chain has not reached yet */
    E("popbk").textContent = r.height ? f(r.height) : "-";
    POP.open(pop);
  }
  Array.prototype.forEach.call(document.querySelectorAll("tr.wk"), function(tr){
    var i=SC.findIndex(function(r){return String(r.week)===tr.dataset.w;});
    tr.addEventListener("click", function(){ show(i); });
    tr.addEventListener("keydown", function(ev){
      if(ev.key==="Enter"||ev.key===" "){ ev.preventDefault(); show(i); } });
  });
  /* the points are redrawn with the chart, so a tap is caught on the chart itself */
  E("etacurve").addEventListener("click", function(ev){ var c = ev.target.closest ? ev.target.closest(".etapt") : null; if(c) show(+c.dataset.i); });

  /* history popup holds the full table; rows inside it open the per-week card.
     The weeks box inside the coefficient card opens it too - as a child, so
     closing it lands back on the coefficient card. */
  var hist=E("hist"), hg=E("histgo");
  if(hg) hg.addEventListener("click", function(){ POP.open(hist); });
})();


/* ── validator cards, and the "?" mechanism card ── */
(function(){
  var VD = D.vdetail || [], vpop = E("vpop"), qpop = E("qpop");
  /* the detail rows are baked in build order; the grid is live order. Key them
     by the validator's own id (its full operator address since 2026-10-01, audit H1:
     the last six were a checksum a ground key could share; the same key the live
     vector uses) so a stake crossing never opens the wrong card. */
  var VDBY = {}; VD.forEach(function(d){ if(d.op) VDBY[String(d.op)] = d; });
  window.__VDBY = VDBY;
  /* the validators outside the active set, by the same id: an inactive one (not jailed) may be
     staked to or redelegated to from the lists' closing row, and its moves need its operator */
  window.__INACT = {};
  window.__rebuildInact = function(list){
    if(list) D.inactive = list;
    window.__INACT = {};
    (D.inactive || []).forEach(function(v){ if(v[5] && !VDBY[v[3]]) window.__INACT[v[3]] = { id: v[3], m: v[0], t: v[1], c: v[2], jailed: !!v[4], op: v[5] }; });
  };
  window.__rebuildInact();
  function inactOk(id){ var x = window.__INACT[id]; return x && !x.jailed ? x : null; }
  window.__inactOk = inactOk;
  /* a refresh brings a new detail list: the same map, refilled, so every holder of it reads the new rows */
  window.__setVD = function(list){ VD = list || []; for(var k in VDBY) delete VDBY[k]; VD.forEach(function(d){ if(d.op) VDBY[String(d.op)] = d; }); };
  /* other sections open a card by the validator's id (the wallet's delegation rows) */
  window.__vshow = function(id){ for(var k = 0; k < VALS.length; k++) if(VALS[k][3] === id){ vshow(k); return true; } return ishow(id); };
  /* a validator outside the active set (inactive, or jailed out) has no live record to show: its own
     small card - what it is, why it earns nothing, the reader's stake there, and the two ways out */
  function ishow(id){
    var x = (window.__INACT || {})[id], pos = window.__POS, row = null, k;
    if(pos) for(k = 0; k < pos.rows.length; k++) if(pos.rows[k].id === id) row = pos.rows[k];
    if(!x && !row) return false;
    var m = x ? x.m : row.m, op = x ? x.op : row.op, mo = E("imono");
    E("iname").textContent = m;
    if(mo){ mo.style.display = "flex"; mo.style.background = tint(m || ""); mo.textContent = initial(m); }
    E("iop").textContent = op ? op.slice(0, 14) + "\u2026" + op.slice(-6) : "";
    E("iop").title = op || "";
    var jailed = x && x.jailed;
    E("ibadges").innerHTML = jailed ? '<span class="badge warn">JAILED</span>' : '<span class="badge dn">INACTIVE</span>';
    E("inote").textContent = jailed ? "Jailed and out of the active set: it earns nothing until its operator unjails it and it is back in the top 100."
                                    : "Outside the active set (the top 100 by stake): it earns nothing until it is back in.";
    E("imine").textContent = row ? f(row.x / 1e6) : "-";
    E("istake").textContent = x ? f(x.t / 1e6) : "-";
    E("icomm").textContent = x ? (x.c * 100).toFixed(0) + "%" : "-";
    /* no Redelegate or Unstake here (operator, 2026-09-30): an inactive validator's card only says what it is */
    POP.open(E("ipop"));
    return true;
  }
  function vshow(i){
    var v = (VALS[i] && VDBY[VALS[i][3]]) || VD[i]; if(!v) return;
    var liveT = VALS[i] ? VALS[i][1] : v.t;
    var lg = E("vlogo");
    var mo = E("vmono");
    if(v.av){
      lg.src = "assets/val/" + v.id + ".jpg";
      lg.style.display = ""; mo.style.display = "none";
    } else {
      lg.removeAttribute("src"); lg.style.display = "none";
      mo.style.display = "flex";
      mo.style.background = tint(v.m || "");
      mo.textContent = initial(v.m);
    }
    E("vname").textContent = v.m;
    /* the operator's own site, shown as a bare host so it stays one short line */
    var wl = E("vweb"), u = (v.web || "").trim();
    /* a bare domain ("nylira.net") is a website too - only a plain host (letters, digits, dots,
       dashes, then a path) is taken, so nothing else a moniker's owner types becomes a link */
    if(u && !/^https?:\/\//i.test(u) && /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/[^\s"'<>]*)?$/i.test(u)) u = "https://" + u;
    if(wl){
      if(u && /^https?:\/\//i.test(u)){
        wl.href = u;
        wl.className = "vweb";
        wl.textContent = u.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
        wl.title = u;
      } else {
        wl.removeAttribute("href");
        wl.className = "vweb none";
        wl.textContent = "no website";
        wl.removeAttribute("title");
      }
    }
    /* deep link carries the operator address, so the bot knows which validator
       the subscriber tapped */
    /* no bot configured yet means no link at all - sending a reader to a bot that
       will never answer is worse than not offering the alert */
    /* the trigger opens the chooser; the deep link is built there, from whatever
       the reader ticks. No bot configured means no alert offer at all. */
    var bl = E("vbell");
    if(bl) bl.hidden = !BOT;
    window.__ACUR = v;
    var b = [];
    /* One tag, not two. On this chain downtime jails AND slashes in the same
       event (slash_fraction_downtime is 0.0001), so the two counts track each
       other and a second tag repeated the first. The burn is the only fact the
       jail count does not already carry, so it rides along here. */
    if(v.jail) b.push('<span class="badge warn">JAILED ' + v.jail + '×' +
                      (v.burned ? ', ' + f(v.burned/1e6) + ' ATONE BURNED' : '') + '</span>');
    else       b.push('<span class="badge ok">NEVER JAILED</span>');
    if(v.tomb) b.push('<span class="badge warn">TOMBSTONED</span>');
    E("vbadges").innerHTML = b.join("");
    var a = apr(liveT, +E("eta").value/100);
    E("vrank").textContent  = "#" + (i + 1);
    E("vvp").textContent    = v.vp.toFixed(3) + "%";
    E("vstake").textContent = f(liveT/1e6);
    E("vcomm").textContent  = (v.c*100).toFixed(0) + "%";
    E("vapr").textContent   = (a*100).toFixed(1) + "%";
    /* the same figure net of commission, and what it actually returned over the
       epochs we can measure - both quieter than the headline rate */
    var vn = E("vnet"); if(vn) vn.textContent = (a*(1-v.c)*100).toFixed(1) + "%";
    var ve = E("vearn");
    if(ve) ve.textContent = v.earn_avg ? (v.earn_avg*100).toFixed(1) + "%" : "-";
    /* 10k blocks is the chain's OWN signing window - real uptime, the figure that
       decides jailing. The 30D/3M strips are a different measurement and say so:
       we index proposers, not commit signatures, so over longer spans the honest
       signal is whether the validator proposed anything that day. */
    E("uv10").textContent   = v.up.toFixed(2) + "%";
    /* testnet: the 30/90-day records, first join, last slash and proposals come from our
       index (mainnet only) - N/A there, never a guess */
    E("uv30").textContent   = v.d30 != null ? v.d30.toFixed(1) + "%" : "N/A";
    E("uv90").textContent   = v.d90 != null ? v.d90.toFixed(1) + "%" : "N/A";
    /* Live, not a snapshot: this walks the most recent commits off the node the
       page is served from, the way a status page shows the last N pings. The
       daily series baked into the page cannot move between rebuilds. */
    pingStart(v.chex);
    var tn = (D.net || {}).net === "testnet";
    E("fjoin").textContent  = v.joined ? dmy(v.joined) : (tn ? "N/A" : "-");
    E("flast").textContent  = v.last_slash || (tn ? "N/A" : "Never");
    E("vprop").textContent  = v.prop != null ? f(v.prop) : "N/A";
    /* the note repeated what the map, the graph and the APR band already say */
    POP.open(vpop);
  }
  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function dmy(iso){
    if(!iso) return "";
    var p = String(iso).split("-");
    return p.length === 3 ? (+p[2]) + " " + MON[+p[1] - 1] + " " + p[0] : iso;
  }
  /* ── live signing strip ────────────────────────────────────────────────────
     The last N commits, read off the node this page is served from. A commit for
     height H travels in block H+1 and names every validator that signed, so one
     block fetch answers one column. Only runs while a card is open, and stops
     the moment it closes - otherwise every popup ever opened keeps polling. */
  var PING_N = 20, pingTimer = null, pingAddr = null, pingBusy = false;

  function pingStop(){
    if(pingTimer){ clearInterval(pingTimer); pingTimer = null; }
    pingAddr = null;
  }
  /* usernames are case-insensitive to Telegram; lowercase reads better in a
     link preview than whatever capitalisation BotFather recorded */
  var BOT = (D.bot || "").toLowerCase();
  window.__BOT = BOT;
  window.__ALERT = D.alert || {};
  window.__ACUR = null;
  function pingStart(addr){
    pingStop();
    var el = E("ubping"); if(!el) return;
    /* Draw the strip's shape immediately. Twenty block fetches take a moment, and
       an empty gap that fills all at once reads as a glitch; placeholder columns
       make the wait legible and stop the card resizing when the data lands. */
    var sk = "";
    for(var q = 0; q < PING_N; q++) sk += '<b class=wait style="height:100%"></b>';
    el.innerHTML = sk;
    if(!addr || !window.fetch){ return; }
    pingAddr = addr;
    pingTick();
    pingTimer = setInterval(pingTick, 9000);
  }
  /* a block never changes once made: each height's signers are read once and kept (the last
     few dozen), so a tick fetches only the heights new since the last one - usually one or
     two - and a second card opens on a strip already known */
  var PCACHE = {};
  function signersOf(b){
    var lc = b && b.result && b.result.block && b.result.block.last_commit, sigs = lc && lc.signatures;
    if(!sigs) return null;
    var on = {}; for(var i = 0; i < sigs.length; i++) if(sigs[i].block_id_flag === 2) on[sigs[i].validator_address] = 1;
    return { h: lc.height, on: on };
  }
  function pingTick(){
    var addr = pingAddr;
    if(!addr || pingBusy) return;
    pingBusy = true;
    fetch("rpc/status", { cache: "no-store" })
      .then(function(r){ return r.json(); })
      .then(function(j){
        var head = Number(j.result.sync_info.latest_block_height), hs = [], i;
        for(i = PING_N - 1; i >= 0; i--) hs.push(head - i);
        for(var k in PCACHE) if(+k < head - 3 * PING_N) delete PCACHE[k];
        return Promise.all(hs.map(function(h){
          if(PCACHE[h] !== undefined) return PCACHE[h];
          return fetch("rpc/block?height=" + h, { cache: "no-store" })
            .then(function(r){ return r.json(); })
            .then(function(b){ var v = signersOf(b); if(v) PCACHE[h] = v; return v; })
            .catch(function(){ return null; });
        }));
      })
      .then(function(rows){
        if(pingAddr !== addr) return;            // card changed mid-flight
        var el = E("ubping"); if(!el) return;
        el.innerHTML = "";
        var top = "";
        rows.forEach(function(r, k){
          var el2 = document.createElement("b");
          el2.style.height = "100%";
          if(!r){
            el2.className = "n";
            el2.title = "no commit";
          } else {
            var signed = !!r.on[addr];
            if(!signed) el2.className = "z";
            /* the newest column is marked so the strip visibly advances: every
               block signed looks identical otherwise, and a live view that never
               changes reads as a frozen picture */
            else if(k === rows.length - 1) el2.className = "tip";
            if(r.h) top = r.h;
            el2.title = (r.h || "") + (signed ? " - signed" : " - missed");
          }
          el.appendChild(el2);
        });
        var ph = E("pingh");
        if(ph && top) ph.textContent = "#" + Number(top).toLocaleString("en-US");
      })
      .catch(function(){ /* a missed poll leaves the last strip in place */ })
      .then(function(){ pingBusy = false; });
  }

  vpop.__onclose = pingStop;                       /* however it closes, the poll stops */
  document.addEventListener("click", function(ev){
    var c = ev.target.closest ? ev.target.closest(".cell, .vbar, tr.vrow") : null;
    if(c && c.dataset.v !== undefined) vshow(+c.dataset.v); });
  document.addEventListener("keydown", function(ev){
    if(ev.key!=="Enter" && ev.key!==" ") return;
    var c = document.activeElement;
    if(c && c.classList && (c.classList.contains("cell") || c.classList.contains("vbar"))){ ev.preventDefault(); vshow(+c.dataset.v); } });

  E("qbtn").addEventListener("click", function(){ POP.open(qpop); kpLive(true); });
  var spop = E("spop");
  if(spop) E("sbtn").addEventListener("click", function(){ POP.open(spop); kpLive(true); });
  /* ── the three cards (ATONE staked, Bonus share, Concentration) read live: the set as the page has it this block,
     the chain's own figures (supply, bonded, inflation, provisions, tax, eta and its params, the mint goal) fetched
     when a card opens and every minute while one stays open. What only the index knows (delegators, the proposer
     Nakamoto) keeps the build's figure. ── */
  var KPL = { at: 0, busy: false, c: null };
  function kpOpen(){ return ["spop", "qpop", "cpop"].some(function(id){ var e = E(id); return e && e.classList.contains("on"); }); }
  function kpChain(){
    if(KPL.busy || (KPL.c && Date.now() - KPL.at < 60000)) return Promise.resolve();
    KPL.busy = true;
    var A = window.__API || "https://atomone-api.gatadao.com", g = function(p){ return fetch(A + p, { cache: "no-store" }).then(function(r){ return r.json(); }); };
    return Promise.all([g("/cosmos/bank/v1beta1/supply/by_denom?denom=uatone"), g("/cosmos/staking/v1beta1/pool"), g("/cosmos/mint/v1beta1/inflation"),
                        g("/cosmos/mint/v1beta1/annual_provisions"), g("/cosmos/distribution/v1beta1/params"), g("/cosmos/mint/v1beta1/params"),
                        g("/cosmos/distribution/v1beta1/nakamoto_bonus_coefficient")])
      .then(function(x){
        var nb = (x[4].params || {}).nakamoto_bonus || {}, mp = x[5].params || {};
        KPL.c = { supply: +((x[0].amount || {}).amount), bonded: +((x[1].pool || {}).bonded_tokens), infl: parseFloat(x[2].inflation), prov: parseFloat(x[3].annual_provisions),
                  tax: parseFloat((x[4].params || {}).community_tax), step: parseFloat(nb.step), floor: parseFloat(nb.minimum_coefficient), cap: parseFloat(nb.maximum_coefficient),
                  eta: parseFloat(x[6].coefficient), goal: parseFloat(mp.goal_bonded), imax: parseFloat(mp.inflation_max), imin: parseFloat(mp.inflation_min) };
        KPL.at = Date.now(); })
      .catch(function(){}).then(function(){ KPL.busy = false; });
  }
  function kpSet(key, html){ Array.prototype.forEach.call(document.querySelectorAll('[data-kp="' + key + '"]'), function(e){ if(e.innerHTML !== html) e.innerHTML = html; }); }
  function kpFill(){
    var whole = function(u){ return Math.round(u / 1e6).toLocaleString("en-US"); }, TH = 3.0;
    /* the set, this block: n/3 at BOTH ends, as the chain splits (nakamoto_bonus.go) - the same
       groups the concentration track reads, so the card and the bar never disagree */
    var V = VALS.slice().sort(function(a, b){ return b[1] - a[1]; }), N = V.length;
    if(N >= 3){
      var S = 0; V.forEach(function(v){ S += v[1]; });
      var MEAN = S / N, g = Math.floor(N / 3), gl = g, Hi = 0, Lo = 0, i;
      for(i = 0; i < g; i++) Hi += V[i][1];
      for(i = N - gl; i < N; i++) Lo += V[i][1];
      var ratio = Lo ? (Hi / g) / (Lo / gl) : Infinity, rising = ratio >= TH;
      /* the stake that must move for the ratio to reach 3x, order kept: every holding pulled toward the mean by one factor */
      var A = Hi / g - MEAN, B = Lo / gl - MEAN, den = A - TH * B, lam = den ? MEAN * (TH - 1) / den : 1, tmin = V[N - 1][1];
      if(tmin < MEAN) lam = Math.min(lam, MEAN / (MEAN - tmin) * 0.999);
      lam = Math.max(0, lam);
      var move = 0; V.forEach(function(v){ move += Math.max(0, v[1] - (MEAN + lam * (v[1] - MEAN))); });
      kpSet("N", String(N)); kpSet("HIGH", whole(Hi / g)); kpSet("LOW", whole(Lo / gl)); kpSet("GROUP", String(g)); kpSet("GROUP_LO", String(gl));
      kpSet("RATIO", ratio.toFixed(2)); kpSet("THRESH", TH.toFixed(2)); kpSet("MOVE", whole(move));
      kpSet("REV_WHEN", (rising ? "&lt; " : "&ge; ") + TH.toFixed(2) + "&times;");
      kpSet("MOVE_FROM", ratio > TH ? "Largest" : "Smallest"); kpSet("MOVE_TO", ratio > TH ? "smallest" : "largest");
      var ru = document.querySelectorAll("#qpop .kp-ru"); if(ru.length === 2){ ru[0].classList.toggle("hot", rising); ru[1].classList.toggle("hot", !rising); }
      var mh = E("meanhov"); if(mh) mh.setAttribute("data-tip", "The average " + whole(MEAN) + " ATONE");
    }
    var c = KPL.c; if(!c) return;
    if(c.supply > 0 && c.bonded > 0){
      var bp = c.bonded / c.supply * 100;
      kpSet("BONDED", whole(c.bonded)); kpSet("SUPPLY", whole(c.supply)); kpSet("BONDED_PCT", bp.toFixed(1));
      var bar = document.querySelector("#spop .kp-bar i"); if(bar) bar.style.width = bp.toFixed(1) + "%";
    }
    /* yearly figures at the REAL block pace (audit 2026-10-13): the chain mints its provisions figure per
       nominal block count, and blocks arrive ~26% faster - the build publishes the measured factor */
    var pace = (D.set && D.set.pace) || 1;
    if(c.infl >= 0) kpSet("INFL", (c.infl * pace * 100).toFixed(1));
    if(c.prov > 0 && c.tax >= 0){ kpSet("MINTED", whole(c.prov * pace)); kpSet("POOL", whole(c.prov * pace * (1 - c.tax))); kpSet("CTAKE", whole(c.prov * pace * c.tax)); kpSet("TAX", (c.tax * 100).toFixed(0)); }
    if(c.eta >= 0){
      var up = V.length >= 3 && document.querySelector("#qpop .kp-ru.hot") === document.querySelectorAll("#qpop .kp-ru")[0];
      kpSet("ETA", c.eta.toFixed(2)); kpSet("ETA_PCT", (c.eta * 100).toFixed(0));
      if(c.step > 0) kpSet("ETA_NEXT", (up ? Math.min(c.cap || 1, c.eta + c.step) : Math.max(c.floor || 0, c.eta - c.step)).toFixed(2));
      if(c.step > 0) kpSet("STEP", c.step.toFixed(2)); if(c.floor >= 0) kpSet("FLOOR", c.floor.toFixed(2)); if(c.cap > 0) kpSet("CAP", c.cap.toFixed(2));
    }
    /* the staking goal: the last box, and the gap below it, stated as the Concentration card states its own */
    var box = E("kpgoal"), mv = E("kpgoalmv");
    if(box && c.goal > 0 && c.supply > 0){
      var tgt = c.goal * c.supply, need = tgt - c.bonded, now = c.bonded / c.supply * 100, atHi = c.infl >= c.imax - 1e-6, atLo = c.infl <= c.imin + 1e-6;
      /* past the goal the chain's mint rule turns inflation around, toward its minimum */
      box.querySelector("b").textContent = (c.goal * 100).toFixed(0) + "%";
      /* the wide words, then the phone's one line */
      var lo = (c.imin * 100).toFixed(0) + "%", two = function(w, p){ return '<span class=kps-w>' + w + '</span><span class=kps-p>' + p + '</span>'; };
      box.querySelector("small").innerHTML = need > 0 ? two("past it, inflation reverses toward " + lo + " minimum", "past it, falls toward " + lo)
        : atLo ? two("inflation holds at its " + lo + " minimum", "holds at " + lo + " minimum") : two("inflation falls toward " + lo + " minimum", "falls toward " + lo);
      if(mv){ mv.hidden = false;
        mv.innerHTML = need > 0
          ? "To go from <b>" + now.toFixed(1) + "%</b> to <b>" + (c.goal * 100).toFixed(0) + "%</b> staked, <b class=or>" + whole(need) + " ATONE</b> more would have to be staked." +
            " Until then inflation " + (atHi ? "holds at its <b>" + (c.imax * 100).toFixed(0) + "%</b> maximum." : "climbs toward <b>" + (c.imax * 100).toFixed(0) + "%</b>.")
          : "Staking is <b>" + now.toFixed(1) + "%</b>, past the <b>" + (c.goal * 100).toFixed(0) + "%</b> goal by <b class=or>" + whole(-need) + " ATONE</b>." +
            " Inflation " + (atLo ? "holds at its <b>" + (c.imin * 100).toFixed(0) + "%</b> minimum." : "falls toward <b>" + (c.imin * 100).toFixed(0) + "%</b>."); }
    }
  }
  function kpLive(fetchToo){ kpFill(); kpFit(); if(fetchToo) kpChain().then(function(){ kpFill(); kpFit(); }); }
  /* phones: a card's figure steps its type down until it fits its box, never an ellipsis (operator, 2026-10-17: "the atone
     value inside popup boxes is incomplete") */
  function kpFit(){
    if(!(window.matchMedia && matchMedia("(max-width:560px)").matches)) return;
    [].forEach.call(document.querySelectorAll(".pop.on .kp .kp-f>b, .pop.on .kp .kp-hv>b, .pop.on .kp .kp-f>small, .pop.on .kp .kp-f>em"), function(x){
      x.style.fontSize = ""; if(!x.clientWidth) return;
      /* the words' own width to the fraction of a pixel: a figure a hair too wide used to end in an ellipsis */
      var over = function(){ var rg = document.createRange(); rg.selectNodeContents(x.firstChild && x.firstChild.nodeType === 1 && x.childNodes.length === 1 ? x.firstChild : x);
        return rg.getBoundingClientRect().width > x.clientWidth + 0.25; };
      var fs = parseFloat(getComputedStyle(x).fontSize);
      var min = x.tagName === "SMALL" || x.tagName === "EM" ? 9.5 : 12;
      while(over() && fs > min){ fs -= 0.5; x.style.fontSize = fs + "px"; }
    });
  }
  window.addEventListener("resize", kpFit);
  /* while a card is open: the set's figures follow every block, the chain's every minute */
  window.addEventListener("thermo:live", function(){ if(kpOpen()) kpLive(Date.now() - KPL.at > 60000); });
  /* the C card explains what steers eta; opened from the page it stands alone,
     opened from the coefficient card it carries "fromq" (the way-back button) */
  var cpop = E("cpop"), cb = E("cbtn");
  if(cb && cpop) cb.addEventListener("click", function(){
    cpop.classList.remove("fromq"); POP.open(cpop); kpLive(true); });

  /* the range handles are handles only: the row titles open the cards */
})();


})();

/* ── the page buttons ───────────────────────────────────────────────────────
   Four buttons in the title row; each swaps what fills the screen below. The
   selected one is stamped on <html> by a script in the head, so the right pane
   is up before the first paint rather than after this file runs. */
(function(){
  /* The tabs themselves - both levels, their clicks, keys, routes and aria - belong to the
     navigation shell (shell.js, from shell.json). This module keeps what only it knows: how
     the window swaps panes (pick), the fall between sections (goSection) and the frame. */
  var ttl = document.getElementById("tsfx");
  /* the open view, as the shell names it (html[data-sv] = section/view) - not the pane,
     since a view with nothing built shares the shell's empty pane with others */
  function openView(){
    var C = window.__SHELL, k = (document.documentElement.getAttribute("data-sv") || "").split("/");
    if(!C) return null;
    for(var i = 0; i < C.sections.length; i++) if(C.sections[i].id === k[0])
      for(var j = 0; j < C.sections[i].sub.length; j++) if(C.sections[i].sub[j].id === k[1]) return C.sections[i].sub[j];
    return null;
  }
  function setTab(k){
    document.documentElement.setAttribute("data-tab", k);
    title();
    try{ localStorage.setItem("th_tab", k); }catch(e){}
  }
  /* Sections live on the index row: Staking, Governance, and My wallet -
     the reader's own wallet, delegations and strategy - which loads the whole
     window like any other section. Changing section: the window's content
     lifts away and the next falls in. The accent and the light travel. */
  var calc = document.getElementById("calc");
  var root = document.documentElement;
  /* the logo stays put; only the word beside it changes - the open view's own */
  function title(){
    var v = openView();
    if(ttl && v){ ttl.textContent = v.label; ttl.style.color = v.accent || ""; }
  }
  function state(){
    var k = root.getAttribute("data-tab") || "home";
    /* the calculator pane's box, for the dashboard to take: the flipbox stays laid out
       (hidden, not gone) while the dashboard is open, so it can be read in every state */
    var fb = document.getElementById("flipbox");
    if(fb && fb.offsetHeight > 100){ root.style.setProperty("--calc-top", fb.offsetTop + "px"); root.style.setProperty("--calc-h", fb.offsetHeight + "px");
      try{ localStorage.setItem("th_calcbox", fb.offsetTop + "/" + fb.offsetHeight + "/" + innerWidth); }catch(e){} }
    /* the window takes the open section's accent (the shell marks which one is open) */
    var acc = "#ffb02e", well = document.getElementById("well"), onb = document.querySelector(".l1tab[aria-selected=true]");
    if(onb) acc = onb.style.getPropertyValue("--acc") || acc;
    if(well){ well.style.setProperty("--acc", acc); well.style.borderColor = acc + "66"; }
    title();
  }
  /* one switch at a time: every change of pane takes a ticket, and a fade still running for an
     older one lands nothing - a quick Dashboard-then-Staking must not end on the dashboard */
  var FLIP = 0;
  function pick(k){ FLIP++; if(calc) calc.classList.remove("fade"); setTab(k); }
  function goSection(k){
    var tok = ++FLIP, cur = root.getAttribute("data-tab") || "home";
    if(cur === k){ if(calc) calc.classList.remove("fade"); return; }   /* back before the last one landed */
    var after = function(){ setTab(k); state(); if(k === "dele" && window.__planDraw) window.__planDraw(); };
    if(!calc || getComputedStyle(calc).transitionDuration === "0s"){ after(); return; }
    var done = false, finish = function(){
      if(done) return; done = true; calc.removeEventListener("transitionend", finish);
      if(tok !== FLIP) return;
      after();
      calc.classList.remove("fade"); calc.classList.add("fadein"); void calc.offsetWidth; calc.classList.remove("fadein");
    };
    calc.addEventListener("transitionend", finish); setTimeout(finish, 260);
    calc.classList.add("fade");
  }
  state();
  window.addEventListener("resize", state);
  window.__flipTo = goSection;
  window.__pick = pick;
  window.__state = state;
  /* One content box for every page, sized to what Home needs. Home is the only
     pane whose height is fixed by its own contents (a 10x10 map); the rest then
     render inside exactly that area, so switching tabs never resizes anything. */
  function frame(){
    var root = document.documentElement;
    var cur = root.getAttribute("data-tab") || "home";
    root.style.removeProperty("--paneh");
    root.style.removeProperty("--maph");
    /* Home has to be the visible pane while it is measured - the panes are shown
       by this very attribute, and a hidden one reports nothing. */
    root.setAttribute("data-tab", "home");
    var home = document.getElementById("p-home"), box = document.querySelector(".panes");
    var gw = document.getElementById("gwrap");
    var map = gw ? Math.floor(gw.getBoundingClientRect().height) : 0;
    /* Measure the room that is there rather than subtracting a header height:
       on a phone the tab row wraps under the logo and the header is two rows. */
    function room(){
      return (box && home)
        ? box.getBoundingClientRect().bottom - home.getBoundingClientRect().top - 14
        : 0;
    }
    function need(){ return home ? home.getBoundingClientRect().height : 0; }
    var h = need(), r = room();
    /* The map is the elastic part of Home. Take the shortfall out of it until
       the pane fits, re-measuring each time: svh against a collapsing URL bar,
       sub-pixel rounding and a wrapped row are not predictable by arithmetic,
       so trust what the page reports rather than a computed guess. */
    for(var i = 0; i < 5 && gw; i++){
      var over = Math.ceil(h - r);
      var scroll = box ? box.scrollHeight - box.clientHeight : 0;
      if(scroll > over) over = scroll;
      /* the map never goes below a readable tile: on a phone (10 columns) that is
         120px, on a wide screen (20 columns) 60px; past that Home scrolls inside */
      var floor = window.innerWidth < 620 ? 120 : 60;
      if(over <= 0 || map - over < floor) break;
      map -= over;
      root.style.setProperty("--maph", map + "px");
      h = need(); r = room();
    }
    /* the calculator's box, read while Home is up: state() can only read it when the
       calculator is open, so a first visit that lands on the dashboard (nothing
       remembered yet) or a resize there would otherwise leave the dashboard on a guess */
    var fb = document.getElementById("flipbox");
    if(fb && fb.offsetHeight > 100){ root.style.setProperty("--calc-top", fb.offsetTop + "px"); root.style.setProperty("--calc-h", fb.offsetHeight + "px");
      try{ localStorage.setItem("th_calcbox", fb.offsetTop + "/" + fb.offsetHeight + "/" + innerWidth); }catch(e){} }
    root.setAttribute("data-tab", cur);
    h = Math.min(h, r);
    if(h > 0) root.style.setProperty("--paneh", Math.round(h) + "px");
    if(r > 0) root.style.setProperty("--roomh", Math.round(r) + "px");   /* the other screens use all of it */
  }
  pick(document.documentElement.getAttribute("data-tab") || "home");
  frame();
  addEventListener("resize", frame);

  /* the schedule pane's fourth box opens the same weekly card the coefficient
     popup does - one list, reachable from either side */
  var sg = document.getElementById("sgohist"), hist = document.getElementById("hist");
  if(sg && hist) sg.addEventListener("click", function(){ POP.open(hist); });

  /* ── the alert chooser ────────────────────────────────────────────────────
     The reader picks what they want to hear about, and the Telegram deep link
     carries those choices. The payload is capped at 64 characters and may only
     contain [A-Za-z0-9_-], so the validator travels as the first 8 characters of
     its consensus address - stable, unlike the rank - and each alert is a
     single letter. */
  (function(){
    var trg = document.getElementById("vbell"), pop = document.getElementById("apop");
    var btn = document.getElementById("tgbtn"), who = document.getElementById("aval");
    if(!trg || !pop || !btn) return;
    var boxes = [].slice.call(pop.querySelectorAll(".aopt input"));
    /* the bot publishes its own rule (window, rank step) through the build, so the wording
       here says what it actually does */
    function words(){
      var AL = window.__ALERT || {};
      boxes.forEach(function(b){ var i = b.parentNode.querySelector("i"); if(!i) return;
        if(b.dataset.f === "d" && AL.window) i.textContent = "misses " + AL.window + " blocks in a row";
        if(b.dataset.f === "r" && AL.rank_step) i.textContent = "moves " + AL.rank_step + " places or more";
        if(b.dataset.f === "h" && AL.slash_window && AL.slash_crit) i.textContent = AL.slash_crit.toLocaleString("en-US") + " of " +
          AL.slash_window.toLocaleString("en-US") + " blocks, jailed at " + Math.round(AL.slash_window * .95).toLocaleString("en-US"); });
    }
    var PER = 8;                                   /* validators per link in the older form, under Telegram's 64 chars */
    /* the whole set in one link: a bitmap over each validator's small stable number (vid,
       from the build), six bits to a character of the alphabet Telegram allows - a hundred
       validators fit in seventeen characters. The older six-hex-per-validator form stays
       for a list where a number is missing. */
    var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    function bitmap(list){
      var bits = [], hi = -1, i;
      for(i = 0; i < list.length; i++){ var n = list[i].vid; if(!(n >= 0)) return null; bits[n] = 1; if(n > hi) hi = n; }
      var out = "", k;
      for(k = 0; k <= hi; k += 6){ var c = 0, j; for(j = 0; j < 6; j++) if(bits[k + j]) c |= 1 << j; out += B64.charAt(c); }
      return out;
    }
    function build(){
      words();
      var f = boxes.filter(function(b){ return b.checked; })
                   .map(function(b){ return b.dataset.f; }).join("");
      var many = window.__AMULTI, more = document.getElementById("amore");
      if(many && many.length){
        var links = [], i, bm = bitmap(many);
        if(bm != null && ("b_" + f + "_" + bm).length <= 64)
          links.push("https://t.me/" + (window.__BOT || "") + "?start=b_" + f + "_" + bm);
        else
          /* one link per eight validators, all carrying the same letters */
          for(i = 0; i < many.length; i += PER)
            links.push("https://t.me/" + (window.__BOT || "") + "?start=m_" + f + "_" + many.slice(i, i + PER).map(function(v){ return v.chex.slice(0, 6); }).join("-"));
        btn.classList.toggle("off", !f);
        if(f) btn.href = links[0]; else btn.removeAttribute("href");
        btn.lastChild.textContent = links.length > 1 ? "Continue in Telegram, " + Math.min(PER, many.length) + " of " + many.length : "Continue in Telegram";
        if(more){ more.hidden = links.length < 2;
          more.innerHTML = links.slice(1).map(function(u, k){ var a = (k + 1) * PER + 1, b = Math.min(many.length, (k + 2) * PER);
            return '<a href="' + att(u) + '" target=_blank rel="noopener noreferrer"' + (f ? '' : ' class=off') + '>Continue in Telegram, ' + a + '-' + b + ' of ' + many.length + '</a>'; }).join("") +
            '<small>Telegram takes eight validators per link</small>'; }
        return;
      }
      if(more) more.hidden = true;
      var cur = window.__ACUR;
      btn.classList.toggle("off", !f || !cur);
      if(!f || !cur) { btn.removeAttribute("href"); return; }
      btn.href = "https://t.me/" + (window.__BOT || "")
               + "?start=v_" + cur.chex + "_" + f;    /* all 40 hex (2026-10-01): a prefix could name two */
      btn.lastChild.textContent = "Continue in Telegram";
    }
    /* the stake and redelegate cards open the same chooser for every validator they touch */
    window.__alertMany = function(list){
      if(!list || !list.length || !window.__BOT) return;
      window.__AMULTI = list; window.__ACUR = null;
      who.textContent = list.length === 1 ? list[0].m : list.length + " validators";
      var lg = document.getElementById("alogo"), mo = document.getElementById("amono"), am = document.getElementById("amany");
      /* one validator wears its own face, as on its card; several wear the count */
      var one = list.length === 1 ? list[0] : null;
      if(lg){ if(one && one.av){ lg.src = "assets/val/" + one.id + ".jpg"; lg.style.display = ""; } else { lg.removeAttribute("src"); lg.style.display = "none"; } }
      if(mo){ mo.style.display = one && one.av ? "none" : "flex";
        mo.style.background = one ? (window.__tint || function(){ return "#334"; })(one.m || "") : "#1f1a3a";
        mo.style.color = "#fff";
        mo.textContent = one ? (one.m || "?").trim().slice(0, 2).toUpperCase() : String(list.length); }
      if(am){ am.hidden = !!one; am.innerHTML = one ? "" : list.slice(0, 12).map(function(v){
          return '<span>' + (v.av ? '<img src="assets/val/' + att(v.id) + '.jpg" alt="">' : '<i style="background:' + (window.__tint || function(){ return "#334"; })(v.m || "") + '">' + att((v.m || "?").trim().slice(0, 1).toUpperCase()) + '</i>') + att(v.m) + '</span>'; }).join("") +
          (list.length > 12 ? '<span class=more>+' + (list.length - 12) + ' more</span>' : ''); }
      build();
      POP.open(pop);
    };
    pop.__onclose = function(){ window.__AMULTI = null; var am = document.getElementById("amany"); if(am){ am.hidden = true; am.innerHTML = ""; } };
    /* a phone wallet's own browser often drops a link that asks for a new window, silently (operator, 2026-10-15:
       "alert button ... does nothing" on a phone): on a phone the Telegram link opens in place, where the phone hands
       t.me to the Telegram app; elsewhere a new tab, and in place if a blocker refuses one */
    pop.addEventListener("click", function(ev){
      var a = ev.target.closest ? ev.target.closest('a[href^="https://t.me/"]') : null;
      if(!a || a.classList.contains("off")) return;
      ev.preventDefault();
      if(/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)){ location.href = a.href; return; }
      var w = null; try{ w = window.open(a.href, "_blank"); if(w) w.opener = null; }catch(e){ w = null; }
      if(!w) location.href = a.href;
    });
    boxes.forEach(function(b){ b.addEventListener("change", build); });
    trg.addEventListener("click", function(){
      if(!window.__ACUR) return;
      window.__AMULTI = null; var am0 = document.getElementById("amany"); if(am0){ am0.hidden = true; am0.innerHTML = ""; }
      var cur = window.__ACUR;
      who.textContent = cur.m;
      /* same avatar treatment as the validator card: a picture if we cached one,
         otherwise the tinted monogram, never a broken image */
      var lg = document.getElementById("alogo"), mo = document.getElementById("amono");
      if(lg && mo){
        if(cur.av){
          lg.src = "assets/val/" + cur.id + ".jpg";
          lg.style.display = ""; mo.style.display = "none";
        } else {
          lg.removeAttribute("src"); lg.style.display = "none";
          mo.style.display = "flex";
          mo.style.background = (window.__tint || function(){ return "#334"; })(cur.m || "");
          mo.textContent = (cur.m || "?").trim().slice(0, 2).toUpperCase();
        }
      }
      build();
      POP.open(pop);
    });
  })();

  /* the rise/fall pair is the rule; tapping it opens the panel that measures it */
  var cg = document.getElementById("cgate");
  if(cg) {
    var toC = function(){
      var c = document.getElementById("cpop");
      if(c){ c.classList.add("fromq"); POP.open(c); }   /* the stack remembers eta */
    };
    var back = document.getElementById("backq");
    if(back) back.addEventListener("click", function(){
      POP.close(document.getElementById("cpop"));      /* lands on the eta card */
    });
    cg.addEventListener("click", toC);
    cg.addEventListener("keydown", function(ev){
      if(ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); toC(); } });
  }
})();

/* ── the trend chart, opened and zoomable ───────────────────────────────────
   Thirty-three weekly points is a lot to read inline. Tapping the chart opens
   it big; pinching scales the viewBox rather than the element, so strokes and
   type stay crisp at any zoom instead of going soft. */
(function(){
  var E = function(i){ return document.getElementById(i); };
  var src = E("trend"), pop = E("gpop"), big = E("trendbig");
  if(!src || !pop || !big) return;
  var V0 = [0, 0, 900, 300], vb = V0.slice(), MINW = 90;

  function apply(){ big.setAttribute("viewBox", vb.join(" ")); }
  function clampVB(){
    vb[2] = Math.min(Math.max(vb[2], MINW), V0[2]);
    vb[3] = vb[2] * (V0[3] / V0[2]);
    vb[0] = Math.min(Math.max(vb[0], 0), V0[2] - vb[2]);
    vb[1] = Math.min(Math.max(vb[1], 0), V0[3] - vb[3]);
  }
  function reset(){ vb = V0.slice(); apply(); }
  /* drawn fresh at the popup's own size (2026-10-30: it copied the panel's drawing, made for the panel's box, into a fixed
     900x300 frame - the chart sat at panel size in one corner of an empty card); zoom works in that frame */
  function open(){ POP.open(pop); requestAnimationFrame(function(){
    var h = Math.round(Math.min(window.innerHeight * .58, 420)); big.style.height = h + "px";
    // the layout width (an svg has no offsetWidth, and the pop-in animation scales its on-screen box while it opens)
    var card = big.parentElement, cs = getComputedStyle(card), w = Math.round(card.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) || 900;
    window.__drawTrendTo(big, w, h, window.innerWidth < 620); V0 = [0, 0, w, h]; reset(); }); }

  src.addEventListener("click", open);
  src.addEventListener("keydown", function(ev){
    if(ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); open(); } });

  function dist(t){ return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
  function mid(t){ return [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2]; }
  var d0 = 0, vb0 = null, p0 = null;

  big.addEventListener("touchstart", function(ev){
    vb0 = vb.slice();
    if(ev.touches.length === 2){ d0 = dist(ev.touches); p0 = mid(ev.touches); }
    else if(ev.touches.length === 1){ p0 = [ev.touches[0].clientX, ev.touches[0].clientY]; d0 = 0; }
  }, {passive: true});

  big.addEventListener("touchmove", function(ev){
    if(!vb0) return;
    var r = big.getBoundingClientRect();
    if(ev.touches.length === 2 && d0){
      ev.preventDefault();
      var k = d0 / Math.max(dist(ev.touches), 1);
      var w = Math.min(Math.max(vb0[2] * k, MINW), V0[2]);
      var h = w * (V0[3] / V0[2]);
      var m = mid(ev.touches);
      var fx = (m[0] - r.left) / r.width, fy = (m[1] - r.top) / r.height;
      vb = [vb0[0] + fx * vb0[2] - fx * w, vb0[1] + fy * vb0[3] - fy * h, w, h];
    } else if(ev.touches.length === 1 && !d0){
      ev.preventDefault();
      vb = [vb0[0] - (ev.touches[0].clientX - p0[0]) / r.width * vb0[2],
            vb0[1] - (ev.touches[0].clientY - p0[1]) / r.height * vb0[3], vb0[2], vb0[3]];
    } else return;
    clampVB(); apply();
  }, {passive: false});

  big.addEventListener("touchend", function(ev){ if(!ev.touches.length){ vb0 = null; d0 = 0; } });

  big.addEventListener("wheel", function(ev){
    ev.preventDefault();
    var r = big.getBoundingClientRect();
    var k = ev.deltaY > 0 ? 1.12 : 1 / 1.12;
    var w = Math.min(Math.max(vb[2] * k, MINW), V0[2]), h = w * (V0[3] / V0[2]);
    var fx = (ev.clientX - r.left) / r.width, fy = (ev.clientY - r.top) / r.height;
    vb = [vb[0] + fx * vb[2] - fx * w, vb[1] + fy * vb[3] - fy * h, w, h];
    clampVB(); apply();
  }, {passive: false});

  big.addEventListener("dblclick", reset);
})();




/* ── day or night ─────────────────────────────────────────────────────────────
   boot.js stamped <html data-theme> before the first paint; the switch flips it and
   remembers the choice. With no choice made, the page follows the browser's preference
   as it changes. The day sheet keys off the attribute alone. */
(function(){
  var b = document.getElementById("thbtn"), r = document.documentElement;
  if(!b) return;
  function paint(){
    var day = r.getAttribute("data-theme") === "light";
    b.setAttribute("aria-checked", day ? "true" : "false");
    b.title = day ? "Night" : "Day";
    var m = document.querySelector('meta[name=theme-color]'); if(m) m.setAttribute("content", day ? "#F4F1EA" : "#06060c");
  }
  paint();
  b.addEventListener("click", function(){
    var day = r.getAttribute("data-theme") !== "light";
    r.setAttribute("data-theme", day ? "light" : "dark"); paint();
    try{ localStorage.setItem("th_theme", day ? "light" : "dark"); }catch(e){}
  });
  if(window.matchMedia){ var mq = matchMedia("(prefers-color-scheme: light)");
    var follow = function(){ var chosen = null; try{ chosen = localStorage.getItem("th_theme"); }catch(e){}
      if(chosen === "light" || chosen === "dark") return;
      r.setAttribute("data-theme", mq.matches ? "light" : "dark"); paint(); };
    if(mq.addEventListener) mq.addEventListener("change", follow); else if(mq.addListener) mq.addListener(follow); }
})();

/* ── transaction notifies ─────────────────────────────────────────────────────
   window.__notify() opens the card and returns {ok, fail, close}; it spins until
   one of them is called. Modeled on the GATA app's toast, anchored top right. */
(function(){
  var box = document.getElementById("txnotes");
  if(!box) return;
  var OKI = '<svg viewBox="0 0 24 24" aria-hidden=true><path d="M4 12.5l5 5L20 6.5"/></svg>';
  var NOI = '<svg viewBox="0 0 24 24" aria-hidden=true><path d="M6 6l12 12M18 6L6 18"/></svg>';
  window.__notify = function(){
    var el = document.createElement("div"), timer = null;
    el.setAttribute("role", "status");
    function close(){ if(timer){ clearTimeout(timer); timer = null; } if(el.parentNode) el.parentNode.removeChild(el); }
    function fill(cls, icon, word, detail, ms){
      el.className = "wk-note" + (cls ? " " + cls : "");
      el.innerHTML = icon + "<b>" + word + "</b>" + (detail ? "<i>" + att(String(detail).slice(0, 220)) + "</i>" : "") +
                     '<button class=x type=button aria-label="Close">\u2715</button>';
      el.querySelector(".x").addEventListener("click", close);
      if(!el.parentNode){ box.appendChild(el); while(box.children.length > 3) box.removeChild(box.firstChild); }
      if(timer) clearTimeout(timer);
      timer = ms ? setTimeout(close, ms) : null;
    }
    fill("", '<span class=sp aria-hidden=true></span>', "Confirming", "", 0);
    return { ok: function(){ fill("ok", OKI, "Confirmed", "", 5000); },
             fail: function(why){ fill("err", NOI, "Failed", why || "", 9000); },
             close: close };
  };
})();

/* ── the poll ─────────────────────────────────────────────────────────────────
   One small file, one block apart. No websocket: a socket per reader against our
   own RPC is a cost with no benefit at this size, and a static file is served by
   nginx from cache with no process in the path. Backs off when the tab is hidden,
   and gives up quietly rather than ever showing an error - a page that keeps
   drawing the last good vector is strictly better than one that apologises. */
(function(){
  var EVERY = 6000, SLOW = 60000, back = 0, timer = null;
  function schedule(ms){ clearTimeout(timer); timer = setTimeout(tick, ms); }
  function tick(){
    if(document.hidden){ schedule(SLOW); return; }
    var x = new XMLHttpRequest();
    x.open("GET", "live.json", true);   /* no cache-buster: no-cache + ETag gives a 304 on an unchanged tick */
    x.timeout = 8000;
    x.onload = function(){
      back = 0;
      try{
        var lj = x.status === 200 ? JSON.parse(x.responseText) : null;
        /* the network-uptime history (live.py): kept as it comes, drawn by the Network screen */
        /* px: the proposers the rows point into (row[5] is an index into it) */
        if(lj && lj.up){ window.__UP = lj.up; window.__PX = lj.px || []; window.dispatchEvent(new Event("thermo:up")); }
        if(lj && window.__applyLive(lj)){
          /* a block with no stake moving is a height tick: the clock and the height
             follow it, the map and the lists do not rebuild for nothing */
          if(window.__liveMoved()) window.__redraw();
          window.dispatchEvent(new Event("thermo:live"));
          /* the plan is not advice that was true once - it re-solves on the same
             vector everyone else is seeing, so a reader watches their own answer
             move as other people act on theirs */
        }
      }catch(e){}
      schedule(EVERY);
    };
    x.onerror = x.ontimeout = function(){
      back = Math.min(back + 1, 5);
      schedule(EVERY * (1 << back));      /* 12s, 24s ... 192s, then holds */
    };
    x.send();
  }
  document.addEventListener("visibilitychange", function(){
    if(!document.hidden) schedule(300);
  });
  schedule(EVERY);
})();

/* ── the strategy model ───────────────────────────────────────────────────────
   What a delegator actually earns from putting x ATONE onto validator i:

     U_i(x) = (1 - c_i) * x * [ a + b / (t_i + x) ]
              a = (1-eta)*R/S        the proportional rate, identical everywhere
              b = eta*R/N            the bonus, a FIXED AMOUNT per validator

   Two things fall out of that, and both contradict how every staking UI works.

   ONE: the advertised rate is not the rate you get. The bonus is a fixed sum
   split across whoever is already there, so your own arrival dilutes it. The
   5,774-ATONE validator showing 606% today pays roughly a fifth of that once
   10,000 ATONE lands on it. Quoting the current rate to someone about to change
   it is not a rounding error, it is the wrong number.

   TWO: a redelegation does not move anyone else. The proportional term depends
   on S, which is unchanged when stake moves inside the set, and the bonus term
   is per-validator. Only the source and the destination change - which is why
   this can be computed honestly in the browser with no global recalculation.

   U_i is concave in x, so maximising the total subject to a fixed budget is a
   water-filling problem with a closed form:

     dU_i/dx = (1-c_i) * [ a + b*t_i/(t_i+x)^2 ] = lambda
     =>  x_i(lambda) = sqrt( (1-c_i)*b*t_i / (lambda - (1-c_i)*a) ) - t_i

   Sum over i is monotone decreasing in lambda, so one bisection finds the
   allocation. No solver, no server, ~100 candidates, microseconds. */
(function(){
  /* the wallet prices with the chain's LIVE η - never the calculator's
     what-if slider, which may have been left anywhere */
  function model(){
    var eta = window.__ETA();
    return { a: (1 - eta) * window.__R() / window.__S(),
             b: eta * window.__R() / window.__N() };
  }

  /* marginal rate at x, per unit, net of commission */
  function slope(m, t, c, x){ return (1 - c) * (m.a + m.b * t / Math.pow(t + x, 2)); }

  /* what the delegator's own rate becomes once x has landed */
  function rateAfter(m, t, c, x){ return (1 - c) * (m.a + m.b / (t + x)); }

  function alloc(cands, budget, m, lambda){
    var out = [], sum = 0;
    for(var i = 0; i < cands.length; i++){
      var v = cands[i], k = (1 - v.c);
      var den = lambda - k * m.a;
      var x = den > 0 ? Math.sqrt(k * m.b * v.t / den) - v.t : Infinity;
      if(!(x > 0)) x = 0;
      out.push(x); sum += x;
    }
    return { x: out, sum: sum };
  }

  /* budget: uatone. cands: [{id,t,c,...}]. Returns the allocation that maximises
     what the DELEGATOR earns, not what the chart advertises. */
  function plan(cands, budget){
    if(!cands.length || !isFinite(budget) || !(budget > 0)) return { moves: [], rate: 0 };
    var m = model();
    /* lambda spans the best marginal rate at zero down to the flat asymptote */
    var hi = 0, lo = 0;
    for(var i = 0; i < cands.length; i++){
      hi = Math.max(hi, slope(m, cands[i].t, cands[i].c, 0));
      lo = Math.max(lo, (1 - cands[i].c) * m.a);
    }
    lo *= 1.0000001;
    for(var it = 0; it < 80; it++){
      var mid = (lo + hi) / 2, r = alloc(cands, budget, m, mid);
      if(r.sum > budget) lo = mid; else hi = mid;
    }
    var r = alloc(cands, budget, m, (lo + hi) / 2);
    /* bisection lands within rounding of the budget; put the remainder on the
       best marginal so the numbers add up exactly */
    var scale = r.sum > 0 ? budget / r.sum : 0;
    var moves = [], earned = 0;
    for(i = 0; i < cands.length; i++){
      var x = r.x[i] * scale;
      if(x < budget * 0.005) continue;             /* ignore dust splits */
      var v = cands[i];
      moves.push({ id: v.id, m: v.m, x: x, t: v.t, c: v.c, rank: v.rank, jail: v.jail, up: v.up,
                   before: (1 - v.c) * (m.a + m.b / v.t),
                   after:  rateAfter(m, v.t, v.c, x) });
      earned += x * rateAfter(m, v.t, v.c, x);
    }
    /* renormalise after dropping dust so the moves still sum to the budget */
    var got = moves.reduce(function(s, q){ return s + q.x; }, 0);
    if(got > 0 && Math.abs(got - budget) > 1){
      var k = budget / got; earned = 0;
      moves.forEach(function(q){ q.x *= k; q.after = rateAfter(m, q.t, q.c, q.x);
                                 earned += q.x * q.after; });
    }
    moves.sort(function(p, q){ return q.x - p.x; });
    return { moves: moves, rate: budget > 0 ? earned / budget : 0 };
  }

  /* Constraints are filters on the candidate list, not terms in the objective.
     Keeping them separate matters: the objective is what the delegator earns,
     and a rule like "never jailed" is a judgement about risk, not about yield.
     Mixing them would quietly price someone's risk tolerance into a rate. */
  function candidates(opt){
    opt = opt || {};
    var V = window.__VALS(), out = [], i;
    for(i = 0; i < V.length; i++){
      var v = V[i];
      if(opt.cleanRecord && v[4]) continue;                  /* ever jailed */
      if(opt.minUptime && (v[5] === null || v[5] < opt.minUptime)) continue;
      if(opt.skipTop && i < Math.floor(V.length / 3)) continue;  /* largest third */
      if(opt.except && opt.except[v[3]]) continue;               /* struck out by the reader */
      if(opt.only && !opt.only[v[3]]) continue;                  /* pinned: exactly these */
      out.push({ id: v[3], m: v[0], t: v[1], c: v[2], jail: v[4], up: v[5], rank: i + 1 });
    }
    /* A cap on how many validators to end up in is applied AFTER the optimiser,
       by re-solving on its own top choices - taking the best N of an unconstrained
       solution is not the best N-validator solution, but re-solving on them is. */
    return out;
  }

  function planWith(budget, opt){
    opt = opt || {};
    var c = candidates(opt);
    if(!c.length) return { moves: [], rate: 0, empty: true };
    var r = plan(c, budget);
    var cap = opt.maxVals | 0;
    if(cap > 0 && r.moves.length > cap){
      var keep = {}, i;
      for(i = 0; i < cap; i++) keep[r.moves[i].id] = 1;
      r = plan(c.filter(function(v){ return keep[v.id]; }), budget);
    }
    return r;
  }

  window.__plan = plan;
  window.__planWith = planWith;
  window.__candidates = candidates;
  window.__rateAfter = function(t, c, x){ return rateAfter(model(), t, c, x); };
  /* new stake (a delegation, not a redelegation) also grows the bonded total, so the proportional
     part is paid over S + added: every ATONE of it earns a little less, the reader's included */
  window.__rateAfterNew = function(t, c, x, added){ var m = model(), S = window.__S(); if(added > 0 && S > 0) m.a = m.a * S / (S + added); return rateAfter(m, t, c, x); };

  /* ── StakePilot (operator, 2026-10-15: "stakepilot should do same as autopilot, same rules ... leaving last 3 vals
     and keep shelf rule"): new ATONE poured by Autopilot's own rule, the shelf rise (shelfFill below, keeper.py fill
     line for line; checked against it at 10 to 1,000,000 ATONE). The smallest validator, leaving out the last 3 of the set,
     rises first, to 300 ATONE under the validator above it; then the two rise together, each 300 ATONE under the one
     above, and the shelf takes the next validator up as it reaches it. Nobody passes the validator above, so no rank
     changes; the largest fifth never take stake; any validator of the active set may. As the amount grows the shelf
     rises, and the plan follows it as it is typed. ── */
  function pilotPlan(u){
    var V = window.__VALS(), n = V.length, S = window.__S();
    if(!(u > 0) || !n || !(S > 0)) return null;
    var m = model(); m.a = m.a * S / (S + u);
    if(!window.__shelfFill) return null;
    var at = {}; V.forEach(function(v, q){ at[v[3]] = q; });
    /* the build's exclusion list lives with the shelf rule, in its own scope: reach it the way the rule itself is
       reached (a bare name here threw on every keystroke and StakePilot drew nothing, 2026-10-25) */
    var skip = window.__noStake || function(){ return false; };
    var add = window.__shelfFill(V, V.map(function(v){ return v[1]; }), u, function(q){ return !skip(V[q][3]); }), legs = [], placed = 0, op;
    for(op in add){ var q = at[op], v = V[q]; legs.push({ id: v[3], m: v[0], rank: q + 1, t: v[1], c: v[2], x: add[op] }); placed += add[op]; }
    /* no room on the shelf at all (operator, 2026-10-17: "stakepilot not working in testnet"): a set levelled flat, as
       testnet's is (ranks 7-43 within 4 ATONE, the one above the zone among them), leaves no validator 300 ATONE under the
       one above, so the rule has no answer. Then the stake goes to the smallest validators the rule may use, in equal
       parts, at most 5 and at least 1 ATONE each; where the shelf has room (mainnet) it is never used */
    if(!legs.length && u >= 1e6 && window.__shelfZone){
      var zone = window.__shelfZone(n).filter(function(q){ return !skip(V[q][3]); }), k = Math.min(5, zone.length, Math.floor(u / 1e6)), each = k ? Math.floor(u / k) : 0;
      for(var z = 0; z < k; z++){ var vz = V[zone[z]]; legs.push({ id: vz[3], m: vz[0], rank: zone[z] + 1, t: vz[1], c: vz[2], x: z === 0 ? u - each * (k - 1) : each }); }
      placed = legs.length ? u : 0;
    }
    if(!legs.length) return null;
    /* what the shelf leaves (dust under 1 ATONE, the last part of a step) goes on its top leg: that one sits 300 ATONE
       under the validator above it, so a little more passes nobody */
    legs.sort(function(p, q){ return p.rank - q.rank; });
    var rest = u - placed; if(rest > 0 && rest < 3e8){ legs[0].x += rest; placed += rest; }
    var earned = 0; legs.forEach(function(q){ q.after = rateAfter(m, q.t, q.c, q.x); earned += q.x * q.after; });
    legs.sort(function(p, q){ return q.x - p.x; });
    var big = V[0];
    return { legs: legs, staked: placed, left: u - placed, rate: earned / placed, earned: earned,
             big: big ? rateAfter(m, big[1], big[2], u) : 0, bigName: big ? big[0] : "" };
  }
  window.__pilotPlan = pilotPlan;
})();

/* ── the plan view ────────────────────────────────────────────────────────────
   Renders whatever the model says right now. It re-renders on the live vector as
   well as on input, because the answer genuinely moves: stake arriving anywhere
   changes that validator's share of a fixed bonus, and with people delegating at
   once the best destination is not a constant. */
(function(){
  var E = function(id){ return document.getElementById(id); };
  var amt = E("amt"), out = E("dstrat");
  if(!amt || !out) return;
  /* the picker is rebuilt on every draw; a live tick redraws the plan too */
  window.addEventListener("thermo:live", function(){ if(document.documentElement.getAttribute("data-tab") === "dele" && (!window.__liveMoved || window.__liveMoved())) draw(); });
  /* the counter: seconds since the numbers were last read - the live tick or a
     refresh, whichever is later - ticking on its own while the wallet is open */
  var ago = E("dago");
  function tickAgo(){
    if(!ago || document.documentElement.getAttribute("data-tab") !== "dele") return;
    var at = Math.max(window.__LIVEAT ? window.__LIVEAT() : 0, window.__POSAT || 0);
    if(!at){ ago.textContent = "-"; return; }
    var s = Math.max(0, Math.round((Date.now() - at) / 1000));
    ago.textContent = (s < 60 ? s + "s" : Math.floor(s / 60) + "m") + " ago";
    ago.classList.toggle("fresh", s < 8);
  }
  setInterval(tickAgo, 1000);
  window.addEventListener("thermo:live", tickAgo);
  var wr = E("wrefresh");
  if(wr) wr.addEventListener("animationend", function(){ wr.classList.remove("spun"); });
  if(wr) wr.addEventListener("click", function(){
    /* one turn on every tap, so a fast read still answers the finger */
    wr.classList.remove("spun"); void wr.offsetWidth; wr.classList.add("spun");
    wr.classList.add("busy");
    var done = function(){ wr.classList.remove("busy"); draw(); tickAgo(); };
    /* first the set itself - ranks, APRs, jailings, records - straight from data.json
       as it stands now (no cache), then the reader's own position; then one redraw */
    var fresh = fetch("data.json", { cache: "no-store" })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){ if(d && window.__applyData && window.__applyData(d)) window.__redraw(); })
      .catch(function(){});
    fresh.then(function(){ return window.__refreshPos ? window.__refreshPos() : null; }).then(done, done);
  });

  function value(){
    return window.__amountIn(amt.value);
  }
  /* the whole amount, to the micro-ATONE, nothing rounded away: what "max" means */
  function exact(u, places){
    var w = Math.floor(u / 1e6), f = Math.round(u - w * 1e6), d = f ? ("000000" + f).slice(-6) : "";
    if(places != null) d = d.slice(0, places);           /* shown short, never rounded up */
    d = d.replace(/0+$/, "");
    return w.toLocaleString("en-US") + (d ? "." + d : "");      /* one format, whatever the browser's language (see __amountIn) */
  }
  /* one decimal, floored: an amount on the page never reads as more than it is.
     Display only - what is signed is the exact micro-ATONE (see MSGS: Math.floor on uatone). */
  function one(a){ return (Math.floor(a * 10) / 10).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
  function fmt(u){
    return one(u / 1e6);
  }

  function pct(x){ return (x * 100).toFixed(1) + "%"; }
  function yr(u, rate){ return one(u * rate / 1e6); }
  function rankOf(V, id){ for(var i = 0; i < V.length; i++) if(V[i][3] === id) return i + 1; return 0; }
  function empty(t){ return '<div class=wk-empty>' + t + '</div>'; }
  function pill(cls, t){ return '<span class="wk-pl ' + cls + '">' + t + '</span>'; }
  function bar(share, cls){ return '<span class="wk-hb ' + (cls || "") + '"><i style="width:' + Math.max(1, Math.round(share * 100)) + '%"></i></span>'; }
  /* a validator's name by its id: the active set, else one outside it (inactive, jailed), else the id's last six */
  function nameOf(id){ var V = window.__VALS(); for(var i = 0; i < V.length; i++) if(V[i][3] === id) return V[i][0];
    var x = (window.__INACT || {})[id]; return x && x.m ? x.m : String(id).slice(-6); }

  /* ── what the reader chooses: an amount, and which of five to keep ──
     The model proposes its best five destinations for the amount (the two
     smallest validators on the chain are left out HERE - a few thousand ATONE
     would double them, and the rate it advertises is one nobody keeps - while
     the calculator's own Picks still show them). The reader unticks any it
     does not want; the plan re-solves on what is ticked, and the growth figure
     follows every tick. */
  var SEL = {};                                    /* ids the reader has ticked */
  /* the delegations the reader ticks as the stake to move (operator, 2026-09-30): none ticked = all free stake */
  var SRCSEL = {};
  function srcAny(){ var pos = window.__POS; return !!pos && pos.rows.some(function(r){ return SRCSEL[r.id] && r.x - r.locked >= 1e5; }); }
  function srcFree(pos){ if(!pos) return 0; if(!srcAny()) return pos.free;
    var f = 0; pos.rows.forEach(function(r){ if(SRCSEL[r.id] && r.x - r.locked >= 1e5) f += r.x - r.locked; }); return f; }
  window.__srcFree = function(){ return srcFree(window.__POS); };
  /* the amount and the ticks agree (operator, 2026-10-01): an amount with nothing ticked draws on every delegation that
     can move, so they are ticked to say so (MAX, a share, a typed amount) */
  function srcTickAll(pos){ if(!pos || srcAny()) return; pos.rows.forEach(function(r){ if(r.x - r.locked >= 1e5) SRCSEL[r.id] = 1; }); }
  /* the rate the stake that would move earns now: the ticked delegations' free stake, weighted; no ticks, the wallet */
  function srcNow(pos){ if(!pos) return 0; if(!srcAny()) return pos.rate;
    var fw = 0, fr = 0; pos.rows.forEach(function(x){ var f = x.x - x.locked; if(SRCSEL[x.id] && f >= 1e5){ fw += f; fr += f * x.rate; } }); return fw > 0 ? fr / fw : 0; }
  var QUIET = false;                               /* a redraw made to be read, not to be announced */
  /* both tables are paged, never scrolled: a fixed number of rows a page */
  var LPS = 6, PPS = 6, PG = { l: 0, p: 0 };
  function pager(el, page, n, per, key){
    if(!el) return;
    var pages = Math.max(1, Math.ceil(n / per)); if(page >= pages) page = pages - 1; PG[key] = page;
    el.innerHTML = n > per ? '<button type=button data-d=-1' + (page === 0 ? ' disabled' : '') + '>\u2039</button><span>' + (page * per + 1) + '-' + Math.min(n, (page + 1) * per) + ' of ' + n + '</span><button type=button data-d=1' + (page >= pages - 1 ? ' disabled' : '') + '>\u203a</button>' : '';
    Array.prototype.forEach.call(el.querySelectorAll("button"), function(b){ b.addEventListener("click", function(){ PG[key] = Math.max(0, Math.min(pages - 1, PG[key] + (+b.dataset.d))); draw(); }); });
    return page;
  }
  var CLEAN = false;                               /* the never-jailed filter */

  /* every validator that would pay this stake more than it earns now (its
     rate before the stake arrives, so the list is stable), best rate first;
     the two smallest on the chain left out, as everywhere in the wallet */
  function big(u){ var a = u / 1e6; return a >= 1e6 ? (a / 1e6).toFixed(2) + "M" : a >= 1e3 ? (a / 1e3).toFixed(1) + "k" : String(Math.floor(a)); }
  function expectWallet(){ try{ var w = localStorage.getItem("th_wallet"); return w === "Keplr" || w === "Adena" || w === "1"; }catch(e){ return false; } }
  function options(B, pos){
    /* who pays more does not depend on the amount: the list stands while the
       field is still empty, priced at zero stake, and reprices as the reader types */
    /* the whole set, always. A validator "would earn you more" if it beats the LOWEST
       rate any of your movable stake earns today - one well-placed delegation must not
       hide that the rest could do better. */
    var low = Infinity;
    if(pos) pos.rows.forEach(function(x){ if(x.x - x.locked > 0 && x.rate < low) low = x.rate; });
    /* nothing movable (no stake, or all of it under cooldown): nothing is "lower" either */
    return window.__candidates({ except: {}, cleanRecord: CLEAN }).map(function(v){ v.rate0 = window.__rateAfter(v.t, v.c, 0); v.better = !isFinite(low) || v.rate0 > low + 0.0005; return v; })
      /* with a wallet: best rate first; without one it is the chain's own list, by rank */
      .sort(function(a, b){ return pos ? b.rate0 - a.rate0 : a.rank - b.rank; });
  }
  function chosen(opt){                            /* those ticked */
    var only = {}, n = 0;
    opt.forEach(function(v){ if(SEL[v.id]){ only[v.id] = 1; n++; } });
    for(var id in SEL) if(!only[id] && window.__inactOk(id)){ only[id] = 1; n++; }   /* ticked in the closing row */
    return { only: only, n: n };
  }
  function logo(id, name){
    var d = window.__VDBY && window.__VDBY[id];
    if(d && d.av) return '<img class=wk-lg src="assets/val/' + att(d.id) + '.jpg" alt="" loading=lazy>';
    var c = (name || "?").replace(/[^A-Za-z0-9]/g, "").charAt(0) || "?", h = 0;
    for(var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return '<span class="wk-lg wk-lgx" style="background:hsl(' + h + ',42%,30%)">' + c.toUpperCase() + '</span>';
  }
  /* The lists' closing row: the validators outside the active set - jailed, or no longer
     bonded - folded into one row that opens on a tap. Listed, never offered: they earn
     nothing while they are out. key names the list, so each keeps its own open state. */
  var IJ = {};
  /* sel: the list's own ticks (STSEL or SEL) - an inactive validator can be ticked like any other,
     a jailed one cannot; ticking one keeps the row open */
  /* the closing sections of a validator list: the inactive ones (tickable - stake there counts toward
     the set, earning nothing until it is in), then the jailed ones at the very end (they cannot be
     picked), each its own band that opens; each sorted by stake */
  function ijRows(key, cols, sel){
    var L = (window.__D && window.__D.inactive) || [];
    var by = function(a, b){ return b[1] - a[1]; };
    var ina = L.filter(function(v){ return !v[4]; }).sort(by), jai = L.filter(function(v){ return v[4]; }).sort(by);
    var h = "";
    [[ina, key + "i", "Inactive validators", "can be selected, 0% while inactive"], [jai, key + "j", "Jailed validators", "cannot be picked"]].forEach(function(g){
      var list = g[0];
      /* an empty group still shows, with its 0, so the list always says where inactive and jailed validators would be */
      if(!list.length){ h += '<tr class="ij-t ij-0"><td colspan=' + cols + '><button type=button class=ij-b disabled aria-disabled=true>' +
        '<span>' + g[2] + '</span><i>0</i><em>none right now</em></button></td></tr>'; return; }
      var ticked = 0; list.forEach(function(v){ if(sel && sel[v[3]]) ticked++; });
      var open = !!IJ[g[1]] || ticked > 0;
      h += '<tr class="ij-t' + (open ? ' open' : '') + '"><td colspan=' + cols + '><button type=button class=ij-b data-ij="' + g[1] + '" aria-expanded=' + open + '>' +
        '<span>' + g[2] + '</span><i>' + list.length + '</i><em>' + g[3] + (ticked ? ', <b>' + ticked + ' selected</b>' : '') + '</em><u aria-hidden=true></u></button></td></tr>';
      if(!open) return;
      list.forEach(function(v){
        var can = !v[4] && !!v[5] && !!sel, on = can && !!sel[v[3]];
        h += '<tr class="ij-r' + (on ? ' on' : '') + (can ? '' : ' no') + '"><td colspan=' + cols + '><div class=ij-w>' +
          (can ? '<input type=checkbox data-id="' + att(v[3]) + '"' + (on ? ' checked' : '') + ' aria-label="' + att(v[0]) + ' (inactive)">' : '<span class=ij-x aria-hidden=true></span>') +
          logo(v[3], v[0]) + '<span class=ij-n>' + att(v[0]) + '</span>' +
          '<span class="ij-tag ' + (v[4] ? 'j' : 'i') + '">' + (v[4] ? 'Jailed' : 'Inactive') + '</span>' +
          '<span class=ij-s>' + big(v[1]) + ' ATONE</span><span class=ij-e>' + (v[4] ? 'cannot be picked' : '0% while inactive') + '</span></div></td></tr>'; });
    });
    return h;
  }
  /* rank in the active set by stake, for the docked lists' rank column */
  function rankMap(){ var m = {}; (window.__VALS ? window.__VALS() : []).slice().sort(function(a, b){ return b[1] - a[1]; }).forEach(function(v, i){ m[v[3]] = i + 1; }); return m; }
  /* a docked Pro list as Redelegate's table: a titles row with its select-all box, then one row per validator;
     cols: [[title, width px or null, class]], cells(r) -> [html...] after the box; sel: {id:1}; toggle(ids, on) */
  function proTable(el, rows, cols, cells, sel, toggle){
    var n = 0; rows.forEach(function(r){ if(sel[r.id]) n++; });
    var h = '<table><colgroup><col style="width:30px">' + cols.map(function(c){ return c[1] ? '<col style="width:' + c[1] + 'px">' : '<col>'; }).join('') + '</colgroup>' +
      '<thead><tr><th class=ck><input type=checkbox class=pro-all aria-label="Tick every validator"' + (n && n === rows.length ? ' checked' : '') + '></th>' +
      cols.map(function(c){ return '<th' + (c[2] ? ' class=' + c[2] : '') + '>' + c[0] + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function(r){ var on = !!sel[r.id];
      h += '<tr' + (on ? ' class=on' : '') + '><td class=ck><input type=checkbox data-id="' + att(r.id) + '" aria-label="' + att(r.m || r.id) + '"' + (on ? ' checked' : '') + '></td>' + cells(r).join('') + '</tr>'; });
    el.innerHTML = h + '</tbody></table>';
    var all = el.querySelector(".pro-all"); if(all) all.addEventListener("change", function(){ toggle(rows.map(function(r){ return r.id; }), all.checked); });
    Array.prototype.forEach.call(el.querySelectorAll("tbody input[data-id]"), function(c){
      c.addEventListener("change", function(){ toggle([c.dataset.id], c.checked); });
      var tr = c.closest("tr"); if(tr) tr.addEventListener("click", function(ev){ if(ev.target === c) return; c.checked = !c.checked; c.dispatchEvent(new Event("change")); }); });
  }
  function ijWire(el, redraw){
    Array.prototype.forEach.call(el.querySelectorAll(".ij-b"), function(b){
      b.addEventListener("click", function(){ IJ[b.dataset.ij] = !IJ[b.dataset.ij]; redraw(); }); });
  }


  /* ── the stat strip ── */
  function stats(pos){
    var st = E("ds-staked"), mv = E("ds-mov"), ph = E("ds-photon"), bl = E("ds-bal"), rw = E("ds-rew");
    if(!pos){ var mx0 = E("amtmax"); if(mx0) mx0.disabled = true; if(mv){ mv.textContent = "-"; mv.className = ""; } var ln0 = E("dlockn"); if(ln0) ln0.hidden = true;
      /* no wallet: the figures go back to a dash - a disconnect must not leave the last
         wallet's numbers standing, which read as still connected */
      [bl, ph, st, rw, E("ds-apr")].forEach(function(x){ if(x){ x.textContent = "-"; x.className = x === ph ? "pho" : ""; } });
      return; }
    var b = window.__BAL;
    /* the tiles carry the whole figure, to the micro-ATONE */
    if(bl) bl.textContent = b ? exact(b.uatone) : "-";
    if(st) st.textContent = exact(pos.total);
    if(rw){ rw.textContent = window.__REW != null ? exact(window.__REW) : "-"; rw.className = window.__REW > 0 ? "ok" : ""; }
    var rt = E("ds-rewt"); if(rt) rt.setAttribute("aria-disabled", clRows().length ? "false" : "true");
    var sf = srcFree(pos);
    if(mv){ mv.textContent = sf > 0 ? exact(sf, 2) : "0"; mv.title = sf > 0 ? exact(sf, 1) + " ATONE can move" + (srcAny() ? " from the ticked delegations" : "") : "nothing can move until the cooldown ends"; mv.className = sf > 0 ? "" : "warn";
      var mxb = E("amtmax"); if(mxb) mxb.disabled = !(sf > 0); }
    var ap = E("ds-apr"); if(ap) ap.textContent = pos.rows.length ? pct(pos.rate) : "-";
    if(ph){ ph.textContent = b ? exact(b.uphoton) : "-";
      ph.className = "pho" + (b && b.uphoton < 50000 ? " warn" : ""); }
  }

  /* ── the delegations, a page at a time ── */
  var HEAD2 = '<table><colgroup><col style="width:28px"><col style="width:30px"><col><col style="width:80px"><col style="width:58px"><col style="width:56px"></colgroup>' +
    '<thead><tr><th class=ck></th><th class=c>rank</th><th class=l>validator</th><th>ATONE</th><th>APR</th><th>rewards</th></tr></thead><tbody>';
  function myRows(pos, V){
    var pn = E("dmyn");
    /* no wallet: the section keeps its shape - the same table, waiting - rather than
       a door, because the door is in the bar above */
    if(!pos){
      if(pn) pn.textContent = ""; pager(E("dmypg"), 0, 0, LPS, "l");
      var sk = HEAD2, q;
      for(q = 0; q < 5; q++) sk += '<tr class=skel><td class=ck></td><td class="c rk"><b></b></td><td class="l nm"><b style="width:' +
        (54 + (q % 3) * 12) + '%"></b></td><td class=amt><b></b></td><td><b></b></td><td class=rw><b></b></td></tr>';
      return sk + '</tbody></table>';
    }
    if(!pos.rows.length){ if(pn) pn.textContent = ""; pager(E("dmypg"), 0, 0, LPS, "l"); return empty("No stake on AtomOne"); }
    var rows = pos.rows.slice().sort(function(a, b){ return b.x - a.x; }), h = "", k;
    var nsel = 0; rows.forEach(function(r){ if(SRCSEL[r.id] && r.x - r.locked >= 1e5) nsel++; });
    /* "N selected" is Redelegate's: in Stake, Unstake and Claim the ticks are not there (proTabs() redoes this on a switch) */
    window.__DMYN = { sel: nsel, all: rows.length };
    if(pn) pn.textContent = nsel && !document.documentElement.hasAttribute("data-pro") ? nsel + " selected" : rows.length + " validator" + (rows.length === 1 ? "" : "s");
    var movable = rows.filter(function(r){ return r.x - r.locked >= 1e5; });
    var slice = rows; pager(E("dmypg"), 0, 0, LPS, "l");
    var LOCK = '<i class=lk><svg viewBox="0 0 24 24" aria-hidden=true><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></i>';
    var RB = window.__REWBY || {};
    /* a box on each delegation: tick the ones to move from (stake in its cooldown cannot be ticked) */
    h += '<table><colgroup><col style="width:28px"><col style="width:30px"><col><col style="width:80px"><col style="width:58px"><col style="width:56px"></colgroup><thead><tr><th class=ck>' +
         (movable.length ? '<input type=checkbox class=src-all aria-label="Tick every delegation that can move"' + (movable.length && movable.every(function(r){ return SRCSEL[r.id]; }) ? ' checked' : '') + '>' : '') +
         '</th><th class=c>rank</th><th class=l>validator</th><th>ATONE</th><th>APR</th><th>rewards</th></tr></thead><tbody>';
    for(k = 0; k < slice.length; k++){
      var rw = slice[k], rk = rankOf(V, rw.id);
      var canSrc = rw.x - rw.locked >= 1e5, onSrc = canSrc && !!SRCSEL[rw.id];
      h += '<tr class="' + (rw.inactive ? 'inactive' : '') + (onSrc ? ' on' : '') + '" data-v="' + att(rw.id) + '" tabindex=0 title="' + (rw.inactive ? 'Not in the active set: this stake earns nothing until it is moved or unstaked' : 'Open this validator') + '">' +
           '<td class=ck>' + (canSrc ? '<input type=checkbox data-src="' + att(rw.id) + '"' + (onSrc ? ' checked' : '') + ' aria-label="Move from ' + att(rw.m) + '">' : '<input type=checkbox disabled aria-label="In its cooldown" title="In its 21-day cooldown: it cannot move yet">') + '</td><td class="c rk">' + (rk || '-') + '</td><td class="l nm">' + logo(rw.id, rw.m) + '<span>' + att(rw.m) + '</span></td>' +
           '<td class=amt><span title="' + (rw.locked > 0 ? 'held until ' + window.__day(rw.until) : 'free to move') + '">' + fmt(rw.x) + (rw.locked > 0 ? LOCK : '') + '</span></td>' +
           /* out of the set, the APR cell names why: Jailed (red) or Inactive */
           '<td' + (rw.inactive ? ' class=st' : '') + '>' + (rw.inactive ? (((window.__INACT || {})[rw.id] || {}).jailed ? '<span class=dmj>Jailed</span>' : '<span class=dmi>Inactive</span>') : pct(rw.rate)) + '</td><td class=rw>' + (RB[rw.id] != null ? fmt(RB[rw.id]) : '-') + '</td></tr>';
    }
    return h + '</tbody></table>';
  }

  /* ── the list: every validator that would earn more, a page at a time; a
     tick builds the plan, a ticked row carries what it would get ── */
  function picks(opt, r, B, pos){
    var el = E("dpicks"); if(!el) return;
    var sel = chosen(opt);
    var sn = E("dseln"); if(sn) sn.innerHTML = sel.n ? "<b>" + sel.n + "</b>selected" : "";
    var now = srcNow(pos);                       /* ticked delegations: their rate, a jailed one 0% */
    /* without a wallet the chip is invisible but keeps its slot, so the field and the
       button do not move when one connects */
    /* the line says only one thing, and only when it is true; otherwise it keeps its
       slot invisibly so the field and the button never move */
    /* the count line ("N validators earn a higher APR") is gone from the page; the rows
       say it themselves (a lower-paying row shows its rate in red) */
    var slice = opt;
    if(!opt.length){ el.innerHTML = ""; return; }
    var by = {}; r.moves.forEach(function(m){ by[m.id] = m; });
    /* the figures a delegator weighs: the validator's share of the set (green below the
       average size - where the bonus pays), its signing record over every block indexed,
       the last 90 days, blocks proposed, jailings; then what this stake gets and earns */
    var MEAN = window.__S() / window.__VALS().length;
    /* three frames: a phone renders only what fits (tick, name with the plan's addition,
       stake, the full APR pair); a wide frame adds the two lifetime columns */
    var ph = window.innerWidth <= 700;
    var wide = !ph && (window.innerWidth > 1560 || window.innerWidth <= 900);
    /* the columns follow the list's OWN width, not the window's (operator, 2026-10-08): at 1280 px the full set left the
       name 34 px, so names and the "+amount" tag ran into the stake column. A frame without 170 px for the name drops the
       two lifetime columns, then takes the phone's compact set (tick, name, stake, now -> there) */
    var lw = el.clientWidth || 0;
    if(wide && lw && lw < 30 + 36 + 64 + 70 + 72 + 64 + 50 + 104 + 170) wide = false;
    if(!ph && lw && lw < 30 + 36 + 64 + 72 + 50 + 104 + 170) ph = true;
    /* a very narrow list (the 1100 px frame: 277 px) gives the stake column to the name as well */
    var tiny = ph && lw && lw < 320;
    /* the wallet's columns (tick, stake, now -> there) are laid out from the first paint for a
       reader who will be reconnected, with dashes until the position lands - so the list does
       not shift when it does */
    var lay = !!pos || expectWallet();
    var h = ph
      ? '<table class=cmp><colgroup><col style="width:' + (lay ? 30 : 24) + 'px"><col>' + (tiny ? '' : '<col style="width:50px">') + '<col style="width:' + (lay ? 96 : 56) + 'px"></colgroup>' +
        '<thead><tr><th class=ck>' + (pos ? '<input type=checkbox id=ckall aria-label="Tick every validator"' + (sel.n && sel.n === opt.length ? ' checked' : '') + '>' : '') + '</th><th class=l>validator</th>' +
        (tiny ? '' : '<th title="the validator\'s stake">stake</th>') + '<th>' + (lay ? 'APR' : 'APR') + '</th></tr></thead><tbody>'
      : '<table><colgroup><col style="width:' + (lay ? 30 : 22) + 'px"><col style="width:36px"><col><col style="width:64px">' + (wide ? '<col style="width:70px">' : '') + '<col style="width:72px">' + (wide ? '<col style="width:64px">' : '') + '<col style="width:50px"><col style="width:' + (lay ? 104 : 60) + 'px"></colgroup>' +
            '<thead><tr><th class=ck>' + (pos ? '<input type=checkbox id=ckall aria-label="Tick every validator"' + (sel.n && sel.n === opt.length ? ' checked' : '') + '>' : '') + '</th><th class=c>rank</th><th class=l>validator</th>' +
            '<th title="the validator\'s stake; green below the average size, where the bonus pays">stake</th>' + (wide ? '<th title="blocks signed over every block on record">signed</th>' : '') + '<th>90<span class=lc>d</span> uptime</th>' + (wide ? '<th title="blocks proposed">proposed</th>' : '') + '<th>jailed</th>' +
            '<th>' + (lay ? 'APR now → there' : 'APR') + '</th></tr></thead><tbody>';
    slice.forEach(function(o){
      var on = !!SEL[o.id], m = by[o.id], there = m ? m.after : o.rate0;
      var d = (window.__VDBY && window.__VDBY[o.id]) || {}, u90 = d.d90 != null ? +d.d90 : (o.up != null ? +o.up : null);
      var vp = o.t / window.__S() * 100, lu = d.life_up != null ? +d.life_up : null, pr = d.prop != null ? +d.prop : null;
      var mv = on && MOVED[o.id] > 0 ? MOVED[o.id] : null;
      /* what this plan adds sits at the right end of the name cell, against the stake
         column: it grows leftwards into the name's spare room, and no column moves */
      if(ph){
        h += '<tr class="' + (on ? 'on' : '') + (pos && !o.better ? ' lt' : '') + '"><td class=ck>' + (pos ? '<input type=checkbox data-id="' + att(o.id) + '" aria-label="' + att(o.m || o.id) + '"' + (on ? ' checked' : '') + '>' : '') + '</td>' +
             '<td class="l nm" data-v="' + att(o.id) + '" tabindex=0 title="Open this validator"><div class=nmw>' + logo(o.id, o.m) + '<span>' + att(o.m) + '</span>' +
             (mv != null ? '<em class="gtag add">+' + fmt(mv) + '</em>' : '') + '</div></td>' +
             (tiny ? '' : '<td class=stk>' + big(o.t) + '</td>') +
             (lay ? '<td class=r2><s>' + (pos && pos.rows.length ? pct(now) : '-') + '</s><em>→</em><b>' + pct(there) + '</b></td>' : '<td class=r2><b>' + pct(o.rate0) + '</b></td>') + '</tr>';
        return;
      }
      h += '<tr class="' + (on ? 'on' : '') + (pos && !o.better ? ' lt' : '') + '"><td class=ck>' + (pos ? '<input type=checkbox data-id="' + att(o.id) + '" aria-label="' + att(o.m || o.id) + '"' + (on ? ' checked' : '') + '>' : '') + '</td>' +
           '<td class="c rk">' + o.rank + '</td><td class="l nm" data-v="' + att(o.id) + '" tabindex=0 title="Open this validator"><div class=nmw>' + logo(o.id, o.m) + '<span>' + att(o.m) + '</span>' +
           (mv != null ? '<em class="gtag add" title="what this plan adds">+' + fmt(mv) + '</em>' : '') + '</div></td>' +
           '<td class="stk" title="' + big(o.t) + ' ATONE, ' + vp.toFixed(vp < 1 ? 2 : 1) + '% of all stake; ' + (o.t < MEAN ? 'below the average size: the bonus pays here' : 'above the average size') + '">' + big(o.t) + '</td>' +
           (wide ? '<td class="' + (lu == null ? 'dim' : lu >= 99.9 ? 'ok' : lu >= 99 ? 'warn' : 'bad') + '">' + (lu == null ? '-' : lu.toFixed(2) + '%') + '</td>' : '') +
           '<td class="' + (u90 == null ? 'dim' : u90 >= 95 ? 'ok' : u90 >= 85 ? 'warn' : 'bad') + '">' + (u90 == null ? '-' : u90.toFixed(1) + '%') + '</td>' +
           (wide ? '<td>' + (pr == null ? '-' : pr >= 1e6 ? (pr / 1e6).toFixed(2) + 'M' : pr >= 1e3 ? (pr / 1e3).toFixed(1) + 'k' : pr) + '</td>' : '') +
           (o.jail == null ? '<td class=dim>N/A</td>' : '<td class="' + (!o.jail ? 'ok' : o.jail > 1 ? 'bad' : 'warn') + '">' + (o.jail ? o.jail : 'Never') + '</td>') +
           (lay ? '<td class=r2><s>' + (pos && pos.rows.length ? pct(now) : '-') + '</s><em>→</em><b>' + pct(there) + '</b></td>' : '<td class=r2><b>' + pct(o.rate0) + '</b></td>') + '</tr>';
    });
    h += ijRows("rd", (h.match(/<col[ >]/g) || []).length, pos ? SEL : null);
    var top = el.scrollTop;
    el.innerHTML = h + '</tbody></table>'; el.scrollTop = top;
    ijWire(el, draw);
    Array.prototype.forEach.call(el.querySelectorAll("tbody input"), function(c){
      c.addEventListener("change", function(){ if(c.checked) SEL[c.dataset.id] = 1; else delete SEL[c.dataset.id]; draw(); }); });
    /* the head's box ticks the whole active set, or clears it; half-ticked it shows as such. An
       inactive validator is never part of "all": it is ticked on its own row and stays as it was */
    var all = E("ckall");
    if(all){ var on = opt.filter(function(v){ return SEL[v.id]; }).length;
      all.checked = on > 0 && on === opt.length; all.indeterminate = on > 0 && on < opt.length;
      all.addEventListener("change", function(){ opt.forEach(function(v){ if(all.checked) SEL[v.id] = 1; else delete SEL[v.id]; }); draw(); }); }
  }

  /* ── the answer: one strip - now → after, the gain, the count, the button ── */
  function result(pos, r, B, sel){
    var el = E("dans"); if(!el) return;
    var now = pos ? pos.rate : 0, after = null, gain = 0;
    /* ticked delegations: now and after are those of the ticked stake alone, weighted by what moves from each, so a
       jailed source reads 0% (operator, 2026-09-30, confirmed 2026-10-08 after a whole-wallet trial: the selected stake is
       what is measured, as Autopilot measures only what it moves); no ticks, the whole wallet */
    var scoped = srcAny() && pos;
    if(scoped) now = srcNow(pos);
    /* the gain is the sum of the moves as the moves list priced them - each chunk from the
       rate it earns where it sits to the rate it earns where it lands (a loss is a loss);
       "after" is the position's blended rate with that gain in it */
    if(B > 0 && r.moves.length && pos && MSGS.length){
      var k; for(k in GAINBY) gain += GAINBY[k];
      after = scoped ? (SCOPE.t > 0 ? SCOPE.aft / SCOPE.t : null) : pos.total > 0 ? pos.rate + gain * 1e6 / pos.total : r.rate;
      if(scoped && SCOPE.t > 0) now = SCOPE.was / SCOPE.t;
    }
    window.__ANS = { now: now, after: after, gain: gain };
    el.innerHTML =
      '<span class="p rate"><i>now</i><b' + (pos && pos.rows.length ? '' : ' class=dim') + '>' + (pos && pos.rows.length ? pct(now) : '-') + '</b><span class=arr>\u2192</span><i>after</i><b class="aft' + (after == null ? ' dim' : after < now - 0.0005 ? ' neg' : '') + '">' + (after == null ? '-' : pct(after)) + '</b></span>' +
      '<span class="p gain"><i>ATONE/year</i><b' + (gain > 0.5 ? '' : gain < -0.5 ? ' class=neg' : ' class=dim') + '>' + (gain > 0.5 ? '+' + one(gain) : gain < -0.5 ? '\u2212' + one(-gain) : '-') + '</b></span>';
    /* no redelegate lock box among Outcome's figures (operator, 2026-10-17); the 21 days stay in the Redelegate title
       row and, on a wide screen, in the note at Outcome's foot */
    /* the same rule as a note at Outcome's foot, above the button (Pro on a wide screen) */
    var rn = E("rdnote"); if(rn){ var sp = rn.querySelector("span"); if(sp) sp.innerHTML = 'Redelegated stake cannot be redelegated again for <b>21 days</b>, until <b>' + (window.__day ? window.__day(Date.now() + 21 * 86400000) : new Date(Date.now() + 21 * 86400000).toLocaleDateString("en-GB", { day: "numeric", month: "short" })) + '</b>'; }
    /* the button lives in the stake row; here it only learns whether it can be pressed */
    var go = E("dgo"); if(go) go.disabled = !(pos && window.__WALLET && MSGS.length);
  }

  /* phones: the lock tag stays on the Delegations title row whatever the amount - its text scales down (never below
     5.5 px) until it fits the room the title leaves, instead of wrapping to a second row (operator, 2026-10-30) */
  function fitLockM(){
    var el = E("dlockm"); if(!el) return; el.style.fontSize = el.style.padding = el.style.letterSpacing = "";
    var row = el.parentElement, h3 = row && row.querySelector("h3");
    if(el.hidden || !el.offsetParent || !h3) return;
    // room = the row's content width less the title and one gap, with 1 px to spare (flex lines break on fractions);
    // need = the tag's whole box at its natural width, borders included
    var cs = getComputedStyle(row), avail = row.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      - h3.getBoundingClientRect().width - (parseFloat(cs.columnGap) || 0) - 1;
    var need = function(){ return el.scrollWidth + (el.offsetWidth - el.clientWidth); };
    if(need() > avail){ el.style.padding = "0 4px"; el.style.letterSpacing = "0"; }   // first the tag's own spacing, then the type
    var size = parseFloat(getComputedStyle(el).fontSize);
    for(var i = 0; i < 6 && need() > avail && size > 5.5; i++){
      size = Math.max(5.5, Math.floor(size * Math.min(.98, avail / need()) * 4) / 4); el.style.fontSize = size + "px"; }
  }
  window.__fitLockM = fitLockM;   // probes call it after changing the amount
  /* refit whenever the row or the title changes size (a web font arriving widens the title after the first fit) */
  (function(){ var go = function(){ var r = E("dlockm"); r = r && r.parentElement; if(!r) return;
      if(window.ResizeObserver){ var ro = new ResizeObserver(function(){ requestAnimationFrame(fitLockM); }); ro.observe(r); var h = r.querySelector("h3"); if(h) ro.observe(h); }
      if(document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ requestAnimationFrame(fitLockM); }); };
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go(); })();
  /* the lock says what of this wallet is locked, and until when; nothing locked, no lock at all (operator, 2026-09-30) */
  function lockTip(pos){ return pos && pos.locked >= 1e6 ? fmt(pos.locked) + ' ATONE locked until ' + window.__dayFull(pos.until) : ''; }
  var MSGS = [];
  var GAINBY = {}, MOVED = {}, SCOPE = { t: 0, was: 0, aft: 0 };   /* the stake this plan touches: amount, rate-weighted now and after */
  function movesPanel(pos, V, r){
    MSGS = []; GAINBY = {}; MOVED = {}; SCOPE = { t: 0, was: 0, aft: 0 };
    var h = "", used = {}, srcRate = {};
    (window.__REDS || []).forEach(function(rr){
      var key = rr.redelegation.validator_src_address + ">" + rr.redelegation.validator_dst_address;
      used[key] = (used[key] || 0) + (rr.entries || []).length; });
    /* the stake leaves the positions that earn least first, largest of equals first */
    var any = srcAny();
    var src = pos ? pos.rows.map(function(x){ srcRate[x.id] = x.rate; return { id: x.id, m: x.m, rate: x.rate, free: x.x - x.locked }; }).filter(function(x){ return x.free > 0 && (!any || SRCSEL[x.id]); })
                        /* a validator asked for by name (the inactive card's Redelegate) goes first of all */
                        .sort(function(a, b){ var f = window.__SRCFIRST; return ((b.id === f) - (a.id === f)) || (a.rate - b.rate) || (b.free - a.free); }) : [];
    if(!r.moves.length) return "";
    function nm(id, m){ return '<td class="l nm"><div class=nmw>' + logo(id, m) + '<span>' + att(m) + '</span></div></td>'; }
    function gainCell(g, left){
      return '<td class="gn' + (g > 0.5 ? '' : g < -0.5 ? ' neg' : ' dim') + '" title="ATONE a year">' + (g > 0.5 ? '+' + one(g) : g < -0.5 ? '\u2212' + one(-g) : '\u00b1 0') + (left <= 2 ? '<i>' + left + '/7</i>' : '') + '</td>';
    }
    r.moves.forEach(function(m){
      var need = m.x;
      src.forEach(function(sv){ if(sv.id === m.id && need > 0 && sv.free > 0){ var t = Math.min(sv.free, need); sv.free -= t; need -= t;
        SCOPE.t += t; SCOPE.was += t * (srcRate[sv.id] || 0); SCOPE.aft += t * m.after;
        h += '<tr class=stay>' + nm(m.id, m.m) + '<td class=ar></td><td class="l dim">already here</td><td class=amt>' + fmt(t) + '</td><td class="gn dim">-</td></tr>'; } });
      src.forEach(function(sv){ if(need <= 0 || sv.free <= 0 || sv.id === m.id) return;
        var t = Math.min(sv.free, need), left = 7 - (used[sv.id + ">" + m.id] || 0); sv.free -= t; need -= t;
        if(Math.floor(t) >= 1) MSGS.push({ from: sv.id, to: m.id, amt: Math.floor(t) });   /* a float remainder under 1 uatone is no move (audit 2026-10-13) */
        var was = srcRate[sv.id] || 0, gain = t * (m.after - was) / 1e6;
        SCOPE.t += t; SCOPE.was += t * was; SCOPE.aft += t * m.after;
        GAINBY[m.id] = (GAINBY[m.id] || 0) + gain; MOVED[m.id] = (MOVED[m.id] || 0) + t;
        h += '<tr title="' + att(sv.m) + ' ' + pct(was) + ' \u2192 ' + att(m.m) + ' ' + pct(m.after) + '">' + nm(sv.id, sv.m) + '<td class=ar>\u2192</td>' + nm(m.id, m.m) +
             '<td class=amt>' + fmt(t) + '</td>' + gainCell(gain, left) + '</tr>'; });
    });
    if(!h) return "";                                /* ticks, but nothing that can move */
    /* the rest of the wallet (operator, 2026-10-08), as the planner and keeper.py: stake already on a destination earns its
       new, lower rate; stake left on a source its new, higher rate. Outcome's ATONE/year sums GAINBY, so it is the wallet's
       true change; each row keeps its own move's figure */
    var vby = {}; window.__VALS().forEach(function(v){ vby[v[3]] = v; });
    var aftBy = {}; r.moves.forEach(function(m){ aftBy[m.id] = m.after; });
    var sentU = {}, recvU = {}, restU = 0; MSGS.forEach(function(x){ sentU[x.from] = (sentU[x.from] || 0) + x.amt; recvU[x.to] = (recvU[x.to] || 0) + x.amt; });
    if(pos) pos.rows.forEach(function(row){ var v = vby[row.id]; if(!v || row.inactive) return;
      if(recvU[row.id] && aftBy[row.id] != null) restU += row.x * (aftBy[row.id] - row.rate);
      else if(sentU[row.id]) restU += (row.x - sentU[row.id]) * (window.__rateAfter(v[1], v[2], -sentU[row.id]) - row.rate); });
    if(restU) GAINBY._rest = restU / 1e6;
    return MVHEAD + '<tbody>' + h + '</tbody></table>';
  }
  /* the moves table's head, shown on its own while there are no moves yet */
  var MVHEAD = '<table><colgroup><col><col style="width:14px"><col><col style="width:66px"><col style="width:76px"></colgroup>' +
               '<thead><tr><th class=l>from</th><th></th><th class=l>to</th><th>stake</th><th>ATONE/yr</th></tr></thead>';

  /* ── status pills at the foot ── */
  function statusFoot(pos, V){
    var el = E("dstat"); if(!el) return;
    if(!pos){ el.innerHTML = ""; ["unbtn", "stbtn", "clbtn"].forEach(function(k){ var b0 = E(k); if(b0) b0.hidden = true; }); return; }
    /* only what needs saying: stake that is held, stake on its way out */
    var h = "";
    /* the cooldown is said once, in the Redelegate title row, where the stake is asked for */
    var ln = E("dlockn"), lm = E("dlockm"); if(ln){ ln.hidden = !(pos.locked >= 1e6);
      if(pos.locked >= 1e6){ ln.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden=true><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><b>' + fmt(pos.locked) + '</b><span class=w>ATONE under redelegate cooldown until</span><span class=w2>locked until</span><b>' + window.__dayFull(pos.until) + '</b>'; ln.title = lockTip(pos); } }
    /* phones show the same tag in Delegations' title row instead (operator, 2026-10-17) */
    if(ln && lm){ lm.hidden = ln.hidden; if(lm.innerHTML !== ln.innerHTML) lm.innerHTML = ln.innerHTML; lm.title = ln.title || ""; }
    fitLockM();
    (window.__UNB || []).forEach(function(u){ h += pill("warn", fmt(u.amt) + " unbonding from " + att(u.m) + ", " + window.__day(u.until)); });
    el.innerHTML = h;
    var ub = E("unbtn"); if(ub) ub.hidden = !(pos && pos.rows.length);
    var sb = E("stbtn"); if(sb) sb.hidden = !pos;
    /* Claim: only while some validator holds rewards to take; it opens the claim card */
    var cb = E("clbtn"); if(cb){ var rb = window.__REWBY || {}, any = pos.rows.some(function(r){ return (rb[r.id] || 0) >= 1; }); cb.hidden = !any; }
  }

  /* rows a page: what the pane has room for, measured, never fewer than four */
  function fitPages(){ LPS = 8; }
  window.addEventListener("resize", function(){ if(document.documentElement.getAttribute("data-tab") === "dele") draw(); });
  function draw(){
    fitPages();
    var B = value() * 1e6, V = window.__VALS(), pos = window.__POS;
    var opt = options(B, pos), sel = chosen(opt);
    /* a tick means "this one, included": the amount splits equally across every
       ticked validator, each share priced at the rate it earns there after it
       lands - the optimiser is not asked to drop anyone the reader chose */
    var r = { moves: [], rate: 0 };
    /* ticks without a stake: the field asks for the number itself */
    var fld = document.querySelector("#wk-plan .wk-field"); if(fld) fld.classList.toggle("need", !!(sel.n && !(B > 0)));
    if(B > 0 && sel.n){
      var share = B / sel.n, earned = 0;
      opt.forEach(function(v){ if(!SEL[v.id]) return;
        var aft = window.__rateAfter(v.t, v.c, share);
        r.moves.push({ id: v.id, m: v.m, x: share, t: v.t, c: v.c, rank: v.rank, jail: v.jail, up: v.up, before: v.rate0, after: aft });
        earned += share * aft; });
      /* inactive validators ticked in the closing row: their share earns nothing while they are out */
      for(var iid in sel.only){ var ix = window.__inactOk(iid); if(ix && !opt.some(function(v){ return v.id === iid; }))
        r.moves.push({ id: iid, m: ix.m, x: share, t: ix.t, c: ix.c, rank: null, jail: 0, up: null, before: 0, after: 0 }); }
      r.rate = earned / B;
    }
    stats(pos);
    var a = E("dmy"), c = E("dstrat");
    /* a redraw (a tick, a new block) keeps the list where the reader left it: every scrolling box from the table up
       is put back where it was (operator, 2026-10-01: a tick reset the delegations to the top) */
    if(a){ var keepSc = []; for(var se = a; se && se !== document.body; se = se.parentElement) if(se.scrollTop) keepSc.push([se, se.scrollTop]);
           a.innerHTML = myRows(pos, V);
           keepSc.forEach(function(k){ k[0].scrollTop = k[1]; }); }
    var mv = movesPanel(pos, V, r);                /* first: the list shows each tick's gain */
    picks(opt, r, B, pos);
    if(c){ c.innerHTML = mv || MVHEAD + '</table>'; c.classList.toggle("none", !mv); }
    var mn = E("dmvn"); if(mn) mn.textContent = MSGS.length ? MSGS.length + (MSGS.length === 1 ? " move" : " moves") : "";
    var me = E("dmvempty"); if(me){ me.hidden = !!MSGS.length;
      /* a wallet with nothing staked has nothing to move: say so, not "select validators" */
      me.textContent = pos && !pos.rows.length ? "No stake on AtomOne" : "Select validators and enter a stake"; }
    result(pos, r, B, sel.n);

    statusFoot(pos, V);
    /* the simple view draws from what this just wrote - never from its own arithmetic */
    if(!QUIET){ try{ window.dispatchEvent(new Event("thermo:draw")); }catch(e){} }
  }

  /* att() is the file-level escaper (defined beside POP) */

  amt.addEventListener("input", function(){ window.__SRCFIRST = null; if(value() > 0) srcTickAll(window.__POS); draw(); });
  /* a delegation row opens its validator's card - the same card the map opens */
  var go0 = E("dgo"); if(go0) go0.addEventListener("click", function(){ if(window.__goSign) window.__goSign(); });
  var dmy = E("dmy");
  function rowCard(ev){
    if(ev.target.closest && ev.target.closest("td.ck, th.ck")) return;       /* a box ticks, it does not open the card */
    var tr = ev.target.closest ? ev.target.closest("[data-v]") : null;
    if(!tr || !window.__vshow) return;
    if(ev.type === "keydown" && ev.key !== "Enter" && ev.key !== " ") return;
    ev.preventDefault(); window.__vshow(tr.getAttribute("data-v"));
  }
  document.addEventListener("keydown", function(ev){
    if(ev.defaultPrevented || (ev.key !== "Enter" && ev.key !== " ")) return;
    var tr = ev.target.closest ? ev.target.closest("tr.vrow[data-v]") : null;
    if(tr && window.__vshow){ ev.preventDefault(); window.__vshow(tr.getAttribute("data-v")); }
  });
  if(dmy){ dmy.addEventListener("click", rowCard); dmy.addEventListener("keydown", rowCard);
    dmy.addEventListener("change", function(ev){
      var c = ev.target, pos = window.__POS; if(!c || c.type !== "checkbox" || !pos) return;
      var wasMax = srcAny() && value() * 1e6 >= srcFree(pos) - 1;
      if(c.classList.contains("src-all")) pos.rows.forEach(function(r){ if(r.x - r.locked >= 1e5){ if(c.checked) SRCSEL[r.id] = 1; else delete SRCSEL[r.id]; } });
      else if(c.dataset.src){ if(c.checked) SRCSEL[c.dataset.src] = 1; else delete SRCSEL[c.dataset.src]; }
      /* the amount follows: never more than the ticked stake can give, all of it when it was all, and nothing when
         nothing is ticked */
      var f = srcFree(pos), a0 = value() * 1e6;
      if(!srcAny()) amt.value = "";
      else if(a0 > f || wasMax) amt.value = f > 0 ? exact(f) : "";
      draw(); }); }
  /* the Redelegate list too: its name cells open the card, its boxes keep the tick */
  var dpk = E("dpicks"); if(dpk){ dpk.addEventListener("click", rowCard); dpk.addEventListener("keydown", rowCard); }
  /* max is what can actually move; with nothing free (all in cooldown) or no wallet it does nothing */
  var mx = E("amtmax"); if(mx) mx.addEventListener("click", function(){ var pos = window.__POS, f = srcFree(pos); if(!pos || !(f > 0)) return; srcTickAll(pos); amt.value = exact(srcFree(pos)); draw(); });
  /* amount presets: a share of what can move */
  Array.prototype.forEach.call(document.querySelectorAll("#amtseg button"), function(b){
    b.addEventListener("click", function(){
      var pos = window.__POS, f = srcFree(pos), base = pos && f > 0 ? f : 10000e6;
      if(pos && f > 0) srcTickAll(pos);
      amt.value = Math.floor(base * (+b.dataset.p) / 100 / 1e6).toLocaleString("en-US");
      Array.prototype.forEach.call(document.querySelectorAll("#amtseg button"), function(o){ o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
      draw();
    });
  });

  /* ── the one click: confirm, sign, broadcast, refresh ── */
  var txpop = E("txpop");
  window.__txMsgs = function(){ return txMsgs(); };   /* the probes read what would be signed */
  function txMsgs(){
    var addr = window.__ADDR, VD = window.__VDBY || {};
    var pos = window.__POS, own = {}; if(pos) pos.rows.forEach(function(r){ if(r.op) own[r.id] = r.op; });
    return MSGS.map(function(m){
      var s = VD[m.from], d = VD[m.to] || window.__inactOk(m.to), src = (s && s.op) || own[m.from];
      if(!src || !d || !d.op) return null;
      return { type: "cosmos-sdk/MsgBeginRedelegate", value: { delegator_address: addr, validator_src_address: src,
               validator_dst_address: d.op, amount: { denom: "uatone", amount: String(m.amt) } } };
    }).filter(Boolean);
  }
  /* the card signs EXACTLY what it listed when it opened (audit 2026-10-13): the messages are snapshotted here,
     so a redraw, resize or live tick while the card is open can neither change nor empty what the button sends */
  var TXSNAP = null;
  window.__goSign = function(){
    if(!txpop) return;
    var msgs = txMsgs(), list = E("txlist"), step = E("txstep"), fee = E("txfee"), sign = E("txsign");
    if(!msgs.length) return;
    var total = 0, dests = {}; msgs.forEach(function(m){ total += +m.value.amount.amount; dests[m.value.validator_dst_address] = 1; });
    var nd = Object.keys(dests).length;
    E("txn").textContent = "";
    var sm = E("txsum"); if(sm) sm.innerHTML = fmt(total) + " ATONE<br>to " + nd + " validator" + (nd === 1 ? "" : "s");
    /* stake already under cooldown, said as the Pro Redelegate title row says it, in the popup's first row */
    var lk = E("txlockn"), pz = window.__POS;
    if(lk){ if(pz && pz.locked >= 1e6 && window.__dayFull){
        lk.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden=true><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><b>' + fmt(pz.locked) + '</b>locked until<b>' + window.__dayFull(pz.until) + '</b>';
        var mvU = 0; msgs.forEach(function(m){ mvU += +m.value.amount.amount; });
        lk.title = fmt(pz.locked) + " ATONE was redelegated in the last 21 days and cannot move again until then; this redelegates " + fmt(mvU) + " of the free " + fmt(pz.free);
      } else { lk.innerHTML = ""; lk.removeAttribute("title"); } }
    var an = window.__ANS || {}, ax = E("txans");
    if(ax) ax.innerHTML = '<span class=p><i>now</i><b>' + pct(an.now || 0) + '</b></span><span class=arr>\u2192</span>' +
      '<span class="p aft' + (an.after != null && an.after < (an.now || 0) - 0.0005 ? ' neg' : '') + '"><i>after</i><b>' + (an.after != null ? pct(an.after) : '-') + '</b></span>' +
      '<span class="p gain' + (an.gain < -0.5 ? ' neg' : '') + '"><i>ATONE/year</i><b>' + (an.gain > 0.5 ? '+' + one(an.gain) : an.gain < -0.5 ? '\u2212' + one(-an.gain) : '-') + '</b></span>';
    list.innerHTML = msgs.map(function(m){
      var s = m.value.validator_src_address, d = m.value.validator_dst_address;
      /* the destination's operator address as signed, to compare with the wallet's own screen (2026-10-01):
         the key's own characters after "atonevaloper" (the prefix every operator shares) give way with an
         ellipsis, the last six always show; the whole address is the title */
      return '<div class=txrow><span class=f>' + logo(s, nameOf(s)) + '<b>' + att(nameOf(s)) + '</b></span><i>\u2192</i>' +
             '<span class="f to">' + logo(d, nameOf(d)) + '<span class=txw><b>' + att(nameOf(d)) + '</b><s class=txop title="' + att(d) + '"><span>' + att(d.slice(12, -6)) + '</span><em>' + att(d.slice(-6)) + '</em></s></span></span><span class=a>' + fmt(+m.value.amount.amount) + ' ATONE</span></div>'; }).join("");
    var lk = E("txlock"), until = new Date(Date.now() + 21 * 86400000);
    if(lk) lk.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden=true><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
      '<span>Redelegated stake cannot be redelegated again for <b>21 days</b>, until <b>' + window.__day(until.getTime()) + '</b></span>';
    fee.textContent = "fee: estimating…"; step.textContent = ""; step.className = "txstep";
    sign.disabled = false; sign.textContent = TXAP ? "Activate Autopilot" : "Redelegate";
    /* the grant travels in the same approval: the card SAYS so as its own row (audit 2026-10-13: the button's
       label alone was the only hint) */
    if(TXAP){ msgs = txAll();
      list.innerHTML += '<div class="txrow txgrant"><span class=f><b>plus the Autopilot grant</b></span>' +
        '<span class=a>redelegate only, revoke anytime</span></div>'; }
    TXSNAP = msgs;
    POP.open(txpop);
    /* a first pass estimates the fee so the reader sees it before signing; an answer for an
       earlier opening of the card (another plan) is dropped */
    var tok = ++TXS;
    if(window.__TX && window.__WALLET){
      txGas({ address: window.__ADDR, pubKey: window.__WALLET.pubKey }, msgs)
      .then(function(g){ if(tok !== TXS) return; var f = window.__TX.feeFor(g, msgs.length); fee.textContent = "fee ≈ " + (parseInt(f.amount[0].amount, 10) / 1e6).toFixed(3) + " PHOTON, gas " + f.gas.toLocaleString(); })
      .catch(function(e){ if(tok !== TXS) return; fee.textContent = "the chain could not price it: " + String(e && e.message || e); });
    }
  };
  var TXS = 0;
  var txsign = E("txsign");
  /* the flow: the button spins, the notify at the top right spins with it until the
     chain confirms the transaction, then answers green or red; the card closes on green */
  if(txpop) txpop.__onclose = function(){ TXAP = false; TXSNAP = null; };   /* a declined or abandoned card leaves nothing behind (audit 2026-10-13: the grant carried over into a later manual Redelegate) */
  if(txsign) txsign.addEventListener("click", function(){
    var msgs = TXSNAP || txAll(); if(!msgs.length || !window.__TX || !window.__WALLET) return;
    txsign.disabled = true; txsign.classList.add("busy");
    var n = window.__notify(), ap = TXAP;
    (ap ? window.__TX.sendDirect(window.__WALLET, msgs, "GATA AtomOne Autopilot", function(){}) : window.__TX.send(window.__WALLET, msgs, "", function(){}))
    .then(function(){
      n.ok(); POP.close(txpop); TXAP = false;
      if(ap && window.__atReload) window.__atReload();
      if(window.__refreshPos) window.__refreshPos().then(function(){ draw(); });
    })
    .catch(function(e){ n.fail(e && e.message || String(e)); })
    .then(function(){ txsign.disabled = false; txsign.classList.remove("busy"); });
  });
  /* the network fee for a card, estimated once its terms settle rather than on every
     keystroke; an answer for terms that have changed since is dropped. get() returns the
     messages; without it any estimate still in flight is dropped */
  var FEEQ = {};
  /* the gas a preview shows, from the node's own simulation. A wallet holding nothing can pay no fee, so its preview is
     the standard estimate without asking: a never-funded address has no account on chain, and that lookup would be a
     failed request in the browser */
  function txGas(w, msgs){
    var b = window.__BAL;
    if(b && !b.uatone && !b.uphoton) return Promise.resolve(0);
    return window.__TX.account(w.address).then(function(acc){ return window.__TX.simulate(msgs, "", w.pubKey, acc.sequence); });
  }
  function feeSoon(key, el, get){
    var q = FEEQ[key] || (FEEQ[key] = { n: 0, t: 0 }), n = ++q.n, w = window.__WALLET;
    clearTimeout(q.t);
    if(!get || !w || !window.__TX || !el) return;
    el.textContent = "fee: estimating\u2026";
    q.t = setTimeout(function(){
      var msgs = get(); if(!msgs || !msgs.length || n !== q.n) return;
      txGas(w, msgs).catch(function(){ return 0; })
        .then(function(g){ if(n !== q.n) return; var f = window.__TX.feeFor(g, msgs.length);
          el.textContent = "fee \u2248 " + (parseInt(f.amount[0].amount, 10) / 1e6).toFixed(3) + " PHOTON, gas " + f.gas.toLocaleString(); });
    }, 350);
  }
  /* ── unstake: one validator, an amount up to what sits there, one MsgUndelegate ──
     Undelegating is allowed even while a delegation is in its redelegation cooldown;
     the ATONE then unbonds for 21 days, earning nothing, before it is liquid. */
  var unpop = E("unpop"), UNSEL = {};
  /* Unstake takes several validators (operator, 2026-09-30): the amount splits across the selected ones in
     proportion to what each holds, so each gives the same share of its stake */
  function unSelRows(){ var pos = window.__POS; if(!pos) return []; return pos.rows.filter(function(r){ return UNSEL[r.id] && r.x >= 1e5; }); }
  function unRows(){
    var pos = window.__POS, el = E("unpick"); if(!el || !pos) return;
    /* dust a redelegation leaves behind (under 0.1 ATONE) is not a position to unstake from */
    var rows = pos.rows.filter(function(r){ return r.x >= 1e5; }).sort(function(a, b){ return b.x - a.x; });
    Object.keys(UNSEL).forEach(function(id){ if(!rows.some(function(r){ return r.id === id; })) delete UNSEL[id]; });
    if(!Object.keys(UNSEL).length && rows.length) UNSEL[rows[0].id] = 1;
    var n = 0; rows.forEach(function(r){ if(UNSEL[r.id]) n++; });
    var head = DOCK && DOCK.pop === unpop ? '<div class=unhead><span>Validator</span><span class=h-st>Status</span><span class=h-x>ATONE</span></div>' : '';
    /* each validator's standing, so stake sitting idle on an inactive or jailed one is plain to see */
    var status = function(r){ var ia = (window.__INACT || {})[r.id], out = r.inactive || !!ia || !(window.__VDBY || {})[r.id];
      return out ? (ia && ia.jailed ? '<u class="vst j">Jailed</u>' : '<u class="vst o">Inactive</u>') : '<u class="vst a">Active</u>'; };
    /* the first row selects every validator at once */
    var all = rows.length > 1 ? '<label class="unrow all' + (n === rows.length ? ' on' : '') + '"><input type=checkbox value="*"' + (n === rows.length ? ' checked' : '') + '>' +
              '<span class="wk-lg wk-lgx">\u2211</span><b>All validators</b><i>' + fmt(pos.total) + '<em>ATONE</em></i></label>' : '';
    if(DOCK && DOCK.pop === unpop){
      var rk = rankMap(); el.className = "unpick wk-tbl2";
      proTable(el, rows, [["rank", 36, "c"], ["validator", null, "l"], ["status", 84, "l"], ["ATONE", 96, ""]],
        function(r){ return ['<td class="c rk">' + (rk[r.id] || '-') + '</td>', '<td class="l nm"><div class=nmw>' + logo(r.id, r.m) + '<span>' + att(r.m) + '</span></div></td>',
                             '<td class=l>' + status(r) + '</td>', '<td>' + fmt(r.x) + '</td>']; },
        UNSEL, function(ids, on){ ids.forEach(function(id){ if(on) UNSEL[id] = 1; else delete UNSEL[id]; }); unRows(); unState(); });
      return;
    }
    el.className = "unpick";
    el.innerHTML = head + all + rows.map(function(r){ var on = !!UNSEL[r.id];
      return '<label class="unrow' + (on ? ' on' : '') + '"><input type=checkbox value="' + att(r.id) + '"' + (on ? ' checked' : '') + '>' +
             logo(r.id, r.m) + '<b>' + att(r.m) + '</b>' + status(r) + '<i>' + fmt(r.x) + '<em>ATONE</em></i></label>'; }).join("");
    Array.prototype.forEach.call(el.querySelectorAll("input"), function(c){
      c.addEventListener("change", function(){
        if(c.value === "*") rows.forEach(function(r){ if(c.checked) UNSEL[r.id] = 1; else delete UNSEL[r.id]; });
        else if(c.checked) UNSEL[c.value] = 1; else delete UNSEL[c.value];
        unRows(); unState(); }); });
  }
  window.__unRows = function(){ unRows(); unState(); };
  function unRow(){ var rs = unSelRows(); if(!rs.length) return null; if(rs.length === 1) return rs[0];
    var x = 0; rs.forEach(function(r){ x += r.x; }); return { id: "*", m: rs.length + " validators", x: x }; }
  function unAmount(){ var a = E("unamt"), n = window.__amountIn(a.value); return isFinite(n) && n > 0 ? Math.round(n * 1e6) : 0; }
  function unState(){
    var r = unRow(), u = unAmount(), mx = E("unmaxv"), hint = E("unhint"), fld = E("unamt") && E("unamt").closest(".unfield"), go = E("unsign"), sm = E("unsum"), lk = E("unlock");
    if(mx) mx.textContent = r ? exact(r.x, 2) : "-";
    var over = r && u > r.x, ok = r && u > 0 && !over;
    if(fld) fld.classList.toggle("bad", !!over);
    if(hint){ hint.className = "unhint" + (over ? " bad" : ""); hint.textContent = over ? "" : (r ? "of " + exact(r.x) + " on " + r.m : ""); }   /* over what sits there: the box turns red, no words */
    /* in Pro the hint is the count, as Redelegate's "2 selected" */
    if(hint && DOCK && DOCK.pop === unpop){ var ns = unSelRows().length; hint.className = "wk-seln"; hint.innerHTML = ns ? '<b>' + ns + '</b>selected' : ''; }
    if(go) go.disabled = !ok || !window.__WALLET;
    if(sm) sm.innerHTML = ok ? fmt(u) + " ATONE<br>from " + att(r.m) : "";
    var until = new Date(Date.now() + 21 * 86400000);

    if(lk) lk.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden=true><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
      '<span>Unstaked ATONE unbonds for <b>21 days</b>, until <b>' + window.__day(until.getTime()) + '</b>, and earns nothing meanwhile</span>';
    E("unfee").textContent = ""; var st = E("unstep"); st.textContent = ""; st.className = "txstep";
    feeSoon("un", E("unfee"), ok ? unMsgs : null);
    proBrk();
  }
  function unMsgs(){
    var r = unRow(), u = unAmount(), VD = window.__VDBY || {};
    if(!r || !(u > 0) || u > r.x) return [];
    var rs = unSelRows().sort(function(a, b){ return b.x - a.x; }), out = [], left = u;
    rs.forEach(function(row, i){
      var d = VD[row.id], op = (d && d.op) || row.op; if(!op) return;
      var t = i === rs.length - 1 ? left : Math.floor(u * row.x / r.x); t = Math.min(t, row.x); left -= t;
      if(t >= 1) out.push({ type: "cosmos-sdk/MsgUndelegate", value: { delegator_address: window.__ADDR, validator_address: op, amount: { denom: "uatone", amount: String(Math.floor(t)) } } });
    });
    return out;
  }
  window.__unMsgs = unMsgs;
  var unbtn = E("unbtn");
  if(unbtn) unbtn.addEventListener("click", function(){
    if(!unpop || !window.__POS) return;
    var a = E("unamt"); if(a) a.value = "";
    var go = E("unsign"); if(go){ go.disabled = true; go.textContent = "Unstake"; }
    unRows(); unState(); window.__openCard(unpop); window.__kbFocus(a);
  });
  window.__unstakeFrom = function(id){
    if(!unpop || !window.__POS) return;
    UNSEL = {}; UNSEL[id] = 1; var a = E("unamt"); if(a) a.value = "";
    var go = E("unsign"); if(go){ go.disabled = true; go.textContent = "Unstake"; }
    unRows(); unState(); window.__openCard(unpop); window.__kbFocus(a);
  };
  var unamtEl = E("unamt"); if(unamtEl) unamtEl.addEventListener("input", unState);
  var unmax = E("unmax"); if(unmax) unmax.addEventListener("click", function(){ var r = unRow(); if(!r) return; E("unamt").value = exact(r.x); unState(); });
  if(unpop) unpop.__onclose = function(){ feeSoon("un"); };
  var uncancel = E("uncancel"); if(uncancel) uncancel.addEventListener("click", function(){ window.__closeCard(unpop); });
  var unsign = E("unsign");
  if(unsign) unsign.addEventListener("click", function(){
    var msgs = unMsgs(); if(!msgs.length || !window.__TX || !window.__WALLET) return;
    unsign.disabled = true; unsign.classList.add("busy");
    var n = window.__notify();
    window.__TX.send(window.__WALLET, msgs, "", function(){})
    .then(function(){
      n.ok(); window.__closeCard(unpop);
      if(window.__refreshPos) window.__refreshPos().then(function(){ draw(); });
    })
    .catch(function(e){ n.fail(e && e.message || String(e)); })
    .then(function(){ unsign.disabled = false; unsign.classList.remove("busy"); });
  });

  /* ── claim: the rewards waiting on each validator, one MsgWithdrawDelegatorReward per
     validator ticked - all of them to begin with. Claimed ATONE lands as available and earns
     nothing until it is staked again ── */
  var clpop = E("clpop"), CLSEL = {};
  function clRows(){
    var pos = window.__POS, by = window.__REWBY || {}; if(!pos) return [];
    return pos.rows.map(function(r){ return { id: r.id, m: r.m, op: r.op, x: by[r.id] || 0 }; })
      .filter(function(r){ return r.x >= 1; }).sort(function(a, b){ return b.x - a.x; });
  }
  function clMsgs(){
    var VD = window.__VDBY || {}, out = [];
    clRows().forEach(function(r){ if(!CLSEL[r.id]) return; var d = VD[r.id], op = (d && d.op) || r.op; if(!op) return;
      out.push({ type: "cosmos-sdk/MsgWithdrawDelegationReward", value: { delegator_address: window.__ADDR, validator_address: op } }); });
    return out;
  }
  window.__clMsgs = clMsgs;
  function clDraw(){
    var el = E("clpick"), rows = clRows(); if(!el) return;
    var n = 0, tot = 0, all = 0; rows.forEach(function(r){ all += r.x; if(CLSEL[r.id]){ n++; tot += r.x; } });
    var every = rows.length > 1 ? '<label class="unrow all' + (n === rows.length ? ' on' : '') + '"><input type=checkbox value="*"' + (n === rows.length ? ' checked' : '') + '>' +
      '<span class="wk-lg wk-lgx">\u2211</span><b>All validators</b><i>' + exact(all, 6) + '<em>ATONE</em></i></label>' : '';
    if(DOCK && DOCK.pop === clpop){
      var rk = rankMap(); el.className = "unpick wk-tbl2";
      proTable(el, rows, [["rank", 36, "c"], ["validator", null, "l"], ["rewards", 110, ""]],
        function(r){ return ['<td class="c rk">' + (rk[r.id] || '-') + '</td>', '<td class="l nm"><div class=nmw>' + logo(r.id, r.m) + '<span>' + att(r.m) + '</span></div></td>',
                             '<td>' + exact(r.x, 6) + '</td>']; },
        CLSEL, function(ids, on){ ids.forEach(function(id){ if(on) CLSEL[id] = 1; else delete CLSEL[id]; }); clDraw(); });
      var sm0 = E("clsum"), go0 = E("clsign"), n0 = 0, tot0 = 0; rows.forEach(function(r){ if(CLSEL[r.id]){ n0++; tot0 += r.x; } });
      if(sm0) sm0.innerHTML = n0 ? exact(tot0, 6) + " ATONE<br>from " + n0 + " validator" + (n0 === 1 ? "" : "s") : "";
      if(go0) go0.disabled = !n0 || !window.__WALLET;
      var ph = E("prohdr"); if(ph) ph.innerHTML = n0 ? '<span class=wk-seln><b>' + n0 + '</b>selected</span>' : '';
      var st0 = E("clstep"); st0.textContent = ""; st0.className = "txstep";
      feeSoon("cl", E("clfee"), n0 ? clMsgs : null); proBrk();
      return;
    }
    el.className = "unpick";
    var head = '';
    el.innerHTML = head + every + rows.map(function(r){ var on = !!CLSEL[r.id];
      return '<label class="unrow' + (on ? ' on' : '') + '"><input type=checkbox value="' + att(r.id) + '"' + (on ? ' checked' : '') + '>' +
             logo(r.id, r.m) + '<b>' + att(r.m) + '</b><i>' + exact(r.x, 6) + '<em>ATONE</em></i></label>'; }).join("");
    Array.prototype.forEach.call(el.querySelectorAll("input"), function(c){
      c.addEventListener("change", function(){
        if(c.value === "*") rows.forEach(function(r){ if(c.checked) CLSEL[r.id] = 1; else delete CLSEL[r.id]; });
        else if(c.checked) CLSEL[c.value] = 1; else delete CLSEL[c.value];
        clDraw(); }); });
    var sm = E("clsum"); if(sm) sm.innerHTML = n ? exact(tot, 6) + " ATONE<br>from " + n + " validator" + (n === 1 ? "" : "s") : "";
    var go = E("clsign"); if(go) go.disabled = !n || !window.__WALLET;
    var st = E("clstep"); st.textContent = ""; st.className = "txstep";
    feeSoon("cl", E("clfee"), n ? clMsgs : null);
    proBrk();
  }
  window.__clDraw = clDraw;
  window.__claim = function(){
    if(!clpop || !window.__POS) return;
    var rows = clRows(); if(!rows.length) return;
    CLSEL = {}; rows.forEach(function(r){ CLSEL[r.id] = 1; });
    var go = E("clsign"); if(go) go.textContent = "Claim";
    E("clfee").textContent = "";
    clDraw(); window.__openCard(clpop);
  };
  if(clpop) clpop.__onclose = function(){ feeSoon("cl"); };
  var clbtn = E("clbtn"); if(clbtn) clbtn.addEventListener("click", function(){ window.__claim(); });
  var rdbtn = E("rdbtn"); if(rdbtn) rdbtn.addEventListener("click", function(){ window.__undock(); });
  var rewt = E("ds-rewt");
  if(rewt){ rewt.addEventListener("click", function(){ window.__claim(); });
    rewt.addEventListener("keydown", function(e){ if(e.key === "Enter" || e.key === " "){ e.preventDefault(); window.__claim(); } }); }
  var clsign = E("clsign");
  if(clsign) clsign.addEventListener("click", function(){
    var msgs = clMsgs(); if(!msgs.length || !window.__TX || !window.__WALLET) return;
    clsign.disabled = true; clsign.classList.add("busy");
    var n = window.__notify();
    window.__TX.send(window.__WALLET, msgs, "", function(){})
    .then(function(){
      n.ok(); window.__closeCard(clpop);
      if(window.__refreshPos) window.__refreshPos().then(function(){ draw(); });
    })
    .catch(function(e){ n.fail(e && e.message || String(e)); })
    .then(function(){ clsign.disabled = false; clsign.classList.remove("busy"); });
  });

  /* ── mint PHOTON (operator, 2026-10-04): ATONE burned for PHOTON at the chain's rate, one MsgMintPhoton to the
     reader's own address. The fee is paid in ATONE - a mint is the chain's one fee exception - so a wallet that
     holds no PHOTON yet can still mint some. Max keeps a little ATONE back for that fee ── */
  var mtpop = E("mtpop"), MT = { rate: 0, q: 0, t: 0 }, MT_KEEP = 50000;   /* 0.05 ATONE: the fee is under 0.01 today */
  function mtAmount(){ var a = E("mtamt"), n = window.__amountIn(a && a.value); return isFinite(n) && n > 0 ? Math.round(n * 1e6) : 0; }
  function mtHave(){ var b = window.__BAL; return b && b.uatone > 0 ? b.uatone : 0; }
  function mtMax(){ return Math.max(0, mtHave() - MT_KEEP); }
  function mtMsgs(){ var u = mtAmount(); return u > 0 && window.__ADDR ? [{ type: "atomone/photon/v1/MsgMintPhoton", value: { to_address: window.__ADDR, amount: { denom: "uatone", amount: String(u) } } }] : []; }
  /* the fee in ATONE, estimated once the amount settles; an answer for an older amount is dropped */
  function mtFeeSoon(el, on){
    var n = ++MT.q, w = window.__WALLET; clearTimeout(MT.t);
    if(!on || !w || !window.__TX || !el || !(MT.rate > 0)){ if(el) el.textContent = ""; return; }
    el.textContent = "fee: estimating\u2026";
    MT.t = setTimeout(function(){
      var msgs = mtMsgs(); if(!msgs.length || n !== MT.q) return;
      txGas(w, msgs).catch(function(){ return 0; })
        .then(function(g){ if(n !== MT.q) return; var f = window.__TX.feeFor(g, 1, window.__TX.mintFeeOpt(MT.rate));
          el.textContent = "fee \u2248 " + (parseInt(f.amount[0].amount, 10) / 1e6).toFixed(6) + " ATONE, gas " + f.gas.toLocaleString(); });
    }, 350);
  }
  function mtState(){
    var u = mtAmount(), have = mtHave(), over = u > have, ok = u > 0 && !over && MT.rate > 0, out = E("mtout");
    var mx = E("mtmaxv"); if(mx) mx.textContent = exact(mtMax(), 2);
    var fld = E("mtamt") && E("mtamt").closest(".unfield"); if(fld) fld.classList.toggle("bad", !!over);
    var hint = E("mthint"); if(hint){ hint.className = "unhint" + (over ? " bad" : ""); hint.textContent = ""; }
    /* one shape whatever the state (operator, 2026-10-11: the box must not change size as the rate arrives): the
       label, the figure line and the note are always there; only their words change */
    if(out) out.innerHTML = '<em>You receive</em><b>' + (MT.rate > 0 && u > 0 ? '\u2248 ' + fmt(Math.floor(u * MT.rate)) : MT.rate > 0 ? '0' : '\u2026') + '<small>PHOTON</small></b>' +
        '<span>' + (MT.rate > 0 ? '1 ATONE = ' + MT.rate.toFixed(4) + ' PHOTON, the chain\'s rate now' : MT.rate < 0 ? 'The chain\'s rate could not be read. Try again in a moment.' : 'Reading today\'s rate\u2026') + '</span>';
    var sm = E("mtsum"); if(sm) sm.innerHTML = ok ? fmt(u) + " ATONE<br>to \u2248 " + fmt(Math.floor(u * MT.rate)) + " PHOTON" : "";
    var lk = E("mtlock"); if(lk) lk.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden=true><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg>' +
      '<span>Minting <b>burns</b> the ATONE for good; PHOTON cannot be turned back into ATONE. The chain sets the rate, and it falls as more PHOTON is minted.</span>';
    var go = E("mtsign"); if(go) go.disabled = !ok || !window.__WALLET;
    var st = E("mtstep"); if(st){ st.textContent = ""; st.className = "txstep"; }
    mtFeeSoon(E("mtfee"), ok);
  }
  window.__mint = function(pre){
    if(!mtpop || !window.__ADDR) return;
    var a = E("mtamt"); if(a) a.value = pre > 0 ? exact(pre) : "";
    var go = E("mtsign"); if(go){ go.disabled = true; go.textContent = "Mint"; }
    MT.rate = 0; mtState(); POP.open(mtpop); window.__kbFocus(a);
    if(window.__TX) window.__TX.mintRate().then(function(r){ MT.rate = r; mtState(); }).catch(function(){ MT.rate = -1; mtState(); });
  };
  if(mtpop) mtpop.__onclose = function(){ mtFeeSoon(null, false); };
  var mtamtEl = E("mtamt"); if(mtamtEl) mtamtEl.addEventListener("input", mtState);
  var mtmax = E("mtmax"); if(mtmax) mtmax.addEventListener("click", function(){ if(!(mtMax() > 0)) return; E("mtamt").value = exact(mtMax()); mtState(); });
  var mtsign = E("mtsign");
  if(mtsign) mtsign.addEventListener("click", function(){
    var msgs = mtMsgs(), u = mtAmount(); if(!msgs.length || !window.__TX || !window.__WALLET || !(MT.rate > 0)) return;
    mtsign.disabled = true; mtsign.classList.add("busy");
    var n = window.__notify(), opt = window.__TX.mintFeeOpt(MT.rate); opt.burn = u;
    window.__TX.send(window.__WALLET, msgs, "", function(){}, opt)
    .then(function(){
      n.ok(); POP.close(mtpop);
      if(window.__refreshPos) window.__refreshPos().then(function(){ draw(); if(window.__pilotRedo) window.__pilotRedo(); });
    })
    .catch(function(e){ n.fail(e && e.message || String(e)); })
    .then(function(){ mtsign.disabled = false; mtsign.classList.remove("busy"); });
  });

  /* ── stake: liquid ATONE onto validators the reader ticks, split equally, one
     MsgDelegate each - the same list as Redelegate, priced at the share that lands ── */
  var stpop = E("stpop"), STSEL = {};
  function stCands(){
    return window.__candidates({ except: {}, cleanRecord: CLEAN }).map(function(v){ v.rate0 = window.__rateAfter(v.t, v.c, 0); return v; })
      .sort(function(a, b){ return a.rank - b.rank; });
  }
  function stAmount(){ var a = E("stamt"), n = window.__amountIn(a.value); return isFinite(n) && n > 0 ? Math.round(n * 1e6) : 0; }
  function stBal(){ var b = window.__BAL; return b && b.uatone > 0 ? b.uatone : 0; }
  function stPlan(){
    var u = stAmount(), ids = Object.keys(STSEL), n = ids.length, share = n ? Math.floor(u / n) : 0, earned = 0, rows = [];
    if(u > 0 && n) stCands().forEach(function(v){ if(!STSEL[v.id]) return; var aft = window.__rateAfterNew(v.t, v.c, share, u); earned += share * aft; rows.push({ id: v.id, m: v.m, x: share, after: aft }); });
    /* an inactive validator ticked in the closing row: its share earns nothing while it is out */
    if(u > 0 && n) ids.forEach(function(id){ var x = window.__inactOk(id); if(x) rows.push({ id: id, m: x.m, x: share, after: 0 }); });
    /* the count IS the rows that will be signed (audit 2026-10-13: a ticked validator missing from the candidate
       list but still in the directory was counted, so "to 3 validators" could sign 2 messages) */
    if(u > 0){ n = rows.length; }
    else ids.forEach(function(id){ if(!window.__inactOk(id) && !(window.__VDBY || {})[id]) n--; });
    if(n < ids.length){ share = n ? Math.floor(u / n) : 0; rows.forEach(function(r){ r.x = share; }); earned = 0; rows.forEach(function(r){ earned += share * r.after; }); }
    /* the rest of the wallet (operator, 2026-10-08): the stake it already has earns the rate after this stake lands - lower
       on a validator that receives some, a little lower everywhere as the bonded total grows */
    var rest = 0, pos = window.__POS, sh = {}; rows.forEach(function(r){ sh[r.id] = r.x; });
    if(u > 0 && n && pos) pos.rows.forEach(function(row){ var v = (window.__VALS() || []).filter(function(q){ return q[3] === row.id; })[0];
      if(!v || row.inactive) return; rest += row.x * (window.__rateAfterNew(v[1], v[2], sh[row.id] || 0, u) - row.rate); });
    return { u: u, n: n, share: share, rate: u > 0 && n ? earned / (share * n) : 0, rows: rows, rest: rest };
  }
  function stRows(){
    var el = E("stlist"); if(!el) return;
    var P = stPlan(), by = {}; P.rows.forEach(function(r){ by[r.id] = r; });
    /* Redelegate's very table (operator, 2026-09-30: "same to same ... each and every pixel"): its columns, widths,
       titles and cells - rank, the name with what this stake adds, the validator's stake, its record, and APR now → there */
    var pos = window.__POS, now = pos && pos.rows.length ? pos.rate : 0, MEAN = window.__S() / window.__VALS().length;
    /* phones (operator, 2026-10-02: "in phone stake pop has no val names logos"): the fixed columns alone were wider
       than the card, so the name column had no width left; a phone keeps the name, the stake and the APR */
    var ph = window.innerWidth <= 620, wide = !ph && (window.innerWidth > 1560 || window.innerWidth <= 900);
    /* the columns follow the list's own width, as Redelegate's: room for the name and its "+amount" first */
    var lw = el.clientWidth || 0;
    if(wide && lw && lw < 30 + 36 + 64 + 70 + 72 + 64 + 50 + 104 + 170) wide = false;
    if(!ph && lw && lw < 30 + 36 + 64 + 72 + 50 + 104 + 170) ph = true;
    var cands = stCands(), allOn = cands.length && cands.every(function(o){ return STSEL[o.id]; });
    /* docked in Pro the cells are 11 px with 7 px sides: a 52 px stake column cut "924.5k" to "924..." */
    var dk = !!(el.closest && el.closest("#prolist"));
    var h = '<table' + (ph ? ' class=cmp' : '') + '><colgroup>' + (ph ? '<col style="width:26px"><col style="width:30px"><col><col style="width:' + (dk ? 60 : 52) + 'px"><col style="width:58px">'
            : '<col style="width:30px"><col style="width:36px"><col><col style="width:64px">' + (wide ? '<col style="width:70px">' : '') + '<col style="width:72px">' + (wide ? '<col style="width:64px">' : '') + '<col style="width:50px"><col style="width:104px">') + '</colgroup>' +
            '<thead><tr><th class=ck><input type=checkbox class=pro-all aria-label="Tick every validator"' + (allOn ? ' checked' : '') + '></th><th class=c>rank</th><th class=l>validator</th>' +
            '<th title="the validator\'s stake; green below the average size, where the bonus pays">stake</th>' + (wide ? '<th title="blocks signed over every block on record">signed</th>' : '') + (ph ? '' : '<th>90<span class=lc>d</span> uptime</th>') + (wide ? '<th title="blocks proposed">proposed</th>' : '') + (ph ? '' : '<th>jailed</th>') +
            '<th>APR</th></tr></thead><tbody>';
    cands.forEach(function(o){
      var on = !!STSEL[o.id], m = by[o.id], there = m ? m.after : o.rate0;
      var d = (window.__VDBY && window.__VDBY[o.id]) || {}, u90 = d.d90 != null ? +d.d90 : (o.up != null ? +o.up : null);
      var vp = o.t / window.__S() * 100, lu = d.life_up != null ? +d.life_up : null, pr = d.prop != null ? +d.prop : null;
      h += '<tr class="' + (on ? 'on' : '') + '"><td class=ck><input type=checkbox data-id="' + att(o.id) + '" aria-label="' + att(o.m || o.id) + '"' + (on ? ' checked' : '') + '></td>' +
           '<td class="c rk">' + o.rank + '</td><td class="l nm"><div class=nmw>' + logo(o.id, o.m) + '<span>' + att(o.m) + '</span>' +
           (m && m.x > 0 ? '<em class="gtag add" title="what this stake adds">+' + fmt(m.x) + '</em>' : '') + '</div></td>' +
           '<td class="stk" title="' + big(o.t) + ' ATONE, ' + vp.toFixed(vp < 1 ? 2 : 1) + '% of all stake; ' + (o.t < MEAN ? 'below the average size: the bonus pays here' : 'above the average size') + '">' + big(o.t) + '</td>' +
           (wide ? '<td class="' + (lu == null ? 'dim' : lu >= 99.9 ? 'ok' : lu >= 99 ? 'warn' : 'bad') + '">' + (lu == null ? '-' : lu.toFixed(2) + '%') + '</td>' : '') +
           (ph ? '' : '<td class="' + (u90 == null ? 'dim' : u90 >= 95 ? 'ok' : u90 >= 85 ? 'warn' : 'bad') + '">' + (u90 == null ? '-' : u90.toFixed(1) + '%') + '</td>') +
           (wide ? '<td>' + (pr == null ? '-' : pr >= 1e6 ? (pr / 1e6).toFixed(2) + 'M' : pr >= 1e3 ? (pr / 1e3).toFixed(1) + 'k' : pr) + '</td>' : '') +
           (ph ? '' : o.jail == null ? '<td class=dim>N/A</td>' : '<td class="' + (!o.jail ? 'ok' : o.jail > 1 ? 'bad' : 'warn') + '">' + (o.jail ? o.jail : 'Never') + '</td>') +
           '<td class=r2><b>' + pct(there) + '</b></td></tr>';     /* the validator's APR with this stake on it: nothing to compare */
    });
    h += ijRows("st", (h.match(/<col[ >]/g) || []).length, STSEL);
    var top = el.scrollTop; el.innerHTML = h + '</tbody></table>'; el.scrollTop = top;
    ijWire(el, stRows);
    /* the titles row's box ticks every active validator, or none - as Redelegate's does */
    var sall = el.querySelector("thead .pro-all"); if(sall) sall.addEventListener("change", function(){
      stCands().forEach(function(o){ if(sall.checked) STSEL[o.id] = 1; else delete STSEL[o.id]; }); stRows(); stState(); });
    Array.prototype.forEach.call(el.querySelectorAll("tbody input"), function(c){
      c.addEventListener("change", function(){ if(c.checked) STSEL[c.dataset.id] = 1; else delete STSEL[c.dataset.id]; stRows(); stState(); });
      /* the whole row selects, as a tick on the box does */
      var tr = c.closest("tr"); if(tr) tr.addEventListener("click", function(ev){ if(ev.target === c || (ev.target.closest && ev.target.closest("a"))) return; c.checked = !c.checked; c.dispatchEvent(new Event("change")); }); });
  }
  function stMsgs(){
    var P = stPlan(), VD = window.__VDBY || {}, out = [];
    if(!(P.u > 0) || !P.n || P.u > stBal() || !(P.share > 0)) return [];
    P.rows.forEach(function(r){ var d = VD[r.id] || window.__inactOk(r.id); if(!d || !d.op) return;
      out.push({ type: "cosmos-sdk/MsgDelegate", value: { delegator_address: window.__ADDR, validator_address: d.op, amount: { denom: "uatone", amount: String(Math.floor(r.x)) } } }); });
    return out;
  }
  window.__stMsgs = stMsgs;
  /* Pro's Outcome for Stake, Unstake and Claim (operator, 2026-09-30: "should list val and full move or breakdown"):
     every validator the action touches with what it does there - as Redelegate's outcome lists its moves */
  function proBrk(){
    var el = E("probrk"), mode = document.documentElement.getAttribute("data-pro"); if(!el) return;
    var pos = window.__POS, byOp = {}; if(pos) pos.rows.forEach(function(r){ if(r.op) byOp[r.op] = r; });
    var rows = [], head = [], tot = 0, fig = ["", ""], fig0 = null;
    var pc = function(x){ return (x * 100).toFixed(1) + "%"; };
    if(mode === "stake"){
      var P = stPlan(); head = ["Validator", "Stake", "APR", "ATONE/yr"];
      P.rows.forEach(function(r){ tot += r.x; rows.push([logo(r.id, r.m) + '<span>' + att(r.m) + '</span>', fmt(r.x), r.after ? pc(r.after) : '0%', '+' + fmt(r.x * r.after)]); });
      fig = ["ATONE/year", P.rows.length ? (tot * P.rate + P.rest >= 0 ? '+' : '\u2212') + fmt(Math.abs(tot * P.rate + P.rest)) : '-'];
    } else if(mode === "unstake"){
      var free = window.__day(Date.now() + 21 * 86400000); head = ["Validator", "Unstake", "Free on"];
      var unBy = {};
      unMsgs().forEach(function(m){ var v = m.value, r = byOp[v.validator_address] || {}, x = +v.amount.amount; tot += x;
        if(r.id) unBy[r.id] = (unBy[r.id] || 0) + x;
        rows.push([logo(r.id, r.m || "") + '<span>' + att(r.m || v.validator_address.slice(-8)) + '</span>', fmt(x), free]); });
      /* what the wallet earns less a year (operator, 2026-10-08): the unstaked ATONE stops earning; stake left on those
         validators earns their new, higher rate, and a smaller bonded total lifts every rate a little */
      var yr = 0;
      if(rows.length && pos){ var vby = {}; window.__VALS().forEach(function(q){ vby[q[3]] = q; });
        pos.rows.forEach(function(row){ var q = vby[row.id], x = unBy[row.id] || 0, r0 = row.inactive ? 0 : row.rate;
          yr -= x * r0;
          if(q && !row.inactive) yr += (row.x - x) * (window.__rateAfterNew(q[1], q[2], -x, -tot) - r0); }); }
      fig0 = ["ATONE", rows.length ? fmt(tot) : '-'];
      fig = ["ATONE/year", rows.length ? (yr < 0 ? '\u2212' : '+') + fmt(Math.abs(yr)) : '-', yr < -5e5];
    } else if(mode === "claim"){
      head = ["Validator", "Rewards"];
      clRows().forEach(function(r){ if(!CLSEL[r.id]) return; tot += r.x; rows.push([logo(r.id, r.m) + '<span>' + att(r.m) + '</span>', exact(r.x, 6)]); });
      fig = ["Rewards", rows.length ? exact(tot, 4) : '-'];
    }
    /* two boxes as Redelegate's Outcome has - how many validators, and the figure that matters here - then the list */
    /* Unstake's first box is the amount and its second what the wallet earns less a year, in red (fig[2]) */
    var boxes = !mode ? '' : '<div class="wk-ans pro-ans"><span class="p"><i>' + (fig0 ? fig0[0] : 'validators') + '</i><b' + (rows.length ? '' : ' class=dim') + '>' + (fig0 ? fig0[1] : (rows.length || '-')) + '</b></span>' +
      '<span class="p gain"><i>' + fig[0] + '</i><b' + (rows.length ? (fig[2] ? ' class=neg' : '') : ' class=dim') + '>' + fig[1] + '</b></span></div>';
    var pa = E("proans"); if(pa) pa.innerHTML = !mode ? '' : boxes.replace(/^<div class="wk-ans pro-ans">|<\/div>$/g, '');
    el.innerHTML = !mode ? '' : (!rows.length ? '<div class=pro-brk-e>' + (mode === "claim" ? 'Select the rewards to claim' : 'Select validators and enter an amount') + '</div>' :
      '<div class=pro-brk-s><table class=pro-brk-t><thead><tr>' + head.map(function(h, i){ return '<th' + (i ? '' : ' class=l') + '>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function(r){ return '<tr>' + r.map(function(c, i){ return '<td' + (i ? '' : ' class=nm') + '>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>');
  }
  window.__proBrk = proBrk;
  function stState(){
    var P = stPlan(), bal = stBal(), mx = E("stmaxv"), hint = E("sthint"), fld = E("stamt") && E("stamt").closest(".unfield"), go = E("stsign"), sm = E("stsum"), lk = E("stlock");
    if(mx) mx.textContent = exact(bal, 2);
    var over = P.u > bal, ok = P.u > 0 && P.n > 0 && !over && P.share > 0;
    if(fld) fld.classList.toggle("bad", !!over);
    if(hint){ hint.className = "unhint" + (over ? " bad" : ""); hint.textContent = over ? "" : (P.u > 0 && !P.n ? "Select a validator" : ""); }   /* over the balance: the box turns red, no words */
    if(go) go.disabled = !ok || !window.__WALLET;
    var sb = E("stbell"); if(sb) sb.disabled = !P.n;
    var sn = E("stseln"); if(sn) sn.innerHTML = P.n ? "<b>" + P.n + "</b>selected" : "";
    /* the blended rate rides in the summary's second line */
    /* a phone keeps the amount and the rate: the count is in the list and beside the field */
    if(sm) sm.innerHTML = ok ? fmt(P.u) + " ATONE<br><span class=kps-w>to " + P.n + " validator" + (P.n === 1 ? "" : "s") + " </span>at " + pct(P.rate) : "";
    if(lk) lk.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden=true><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
      '<span>Staked ATONE earns from the next block; locked; unbonding takes <b>21 days</b>.</span>';
    E("stfee").textContent = ""; var st = E("ststep"); st.textContent = ""; st.className = "txstep";
    feeSoon("st", E("stfee"), ok ? stMsgs : null);
    proBrk();
  }
  var stbtn = E("stbtn");
  if(stbtn) stbtn.addEventListener("click", function(){
    if(!stpop || !window.__POS) return;
    STSEL = {}; var a = E("stamt"); if(a) a.value = "";
    var go = E("stsign"); if(go){ go.disabled = true; go.textContent = "Stake"; }
    stRows(); stState(); window.__openCard(stpop); window.__kbFocus(a);
  });
  var stamtEl = E("stamt"); if(stamtEl) stamtEl.addEventListener("input", function(){ stRows(); stState(); });
  var stmax = E("stmax"); if(stmax) stmax.addEventListener("click", function(){ if(!(stBal() > 0)) return; E("stamt").value = exact(stBal()); stRows(); stState(); });
  /* the card leaves nothing behind (operator, 2026-10-17, as the Redelegate grant once carried over): closed, docked
     away, the view left (undock calls this) or the wallet gone, it drops the ticks, the amount, the list and the
     summary; a card opened on top (Alerts, a validator) only hides it and keeps them */
  function stReset(){ STSEL = {}; var a = E("stamt"); if(a) a.value = "";
    var l = E("stlist"); if(l) l.innerHTML = ""; var sm = E("stsum"); if(sm) sm.innerHTML = ""; }   /* the next open draws them fresh */
  /* a wallet gone: the card itself closes (docked or not, and with anything opened on top of it) */
  window.__stReset = function(){ if(window.__closeCard) window.__closeCard(stpop); stReset(); };
  if(stpop) stpop.__onclose = function(){ feeSoon("st"); stReset(); };
  var stsign = E("stsign");
  if(stsign) stsign.addEventListener("click", function(){
    var msgs = stMsgs(); if(!msgs.length || !window.__TX || !window.__WALLET) return;
    stsign.disabled = true; stsign.classList.add("busy");
    var n = window.__notify();
    window.__TX.send(window.__WALLET, msgs, "", function(){})
    .then(function(){
      n.ok(); window.__closeCard(stpop);
      if(window.__refreshPos) window.__refreshPos().then(function(){ draw(); });
    })
    .catch(function(e){ n.fail(e && e.message || String(e)); })
    .then(function(){ stsign.disabled = false; stsign.classList.remove("busy"); });
  });

  /* ── StakePilot card (operator, 2026-10-15: "suggest the validator for the stake amount, optimising in real
     time ... very less data, very friendly"): an amount, typed or slid, re-planned on every change by
     __pilotPlan; the rate it earns, where it lands, one signature. Fees on AtomOne are PHOTON: a wallet
     without enough is offered a pinch of PHOTON minted from ATONE first (a mint is the one transaction that
     pays its fee in ATONE), so a newcomer holding only ATONE can stake. One shape whatever the amount. ── */
  var sppop = E("sppop"), SP = { key: "", plan: null }, SP_KEEP = 200000, SP_PHO = 20000;   /* 0.2 ATONE kept for a mint; 0.02 PHOTON covers a stake */
  function spBal(){ var b = window.__BAL; return b && b.uatone > 0 ? b.uatone : 0; }
  function spPho(){ var b = window.__BAL; return b && b.uphoton > 0 ? b.uphoton : 0; }
  function spMax(){ return Math.max(0, spBal() - (spPho() >= SP_PHO ? 0 : SP_KEEP)); }
  function spAmount(){ var a = E("spamt"), n = window.__amountIn(a && a.value); return isFinite(n) && n > 0 ? Math.round(n * 1e6) : 0; }
  function spMsgs(){
    var P = SP.plan; if(!P || !P.legs.length || !window.__ADDR) return [];
    var VD = window.__VDBY || {};
    return P.legs.filter(function(q){ return q.x > 0 && VD[q.id] && VD[q.id].op; }).map(function(q){
      return { type: "cosmos-sdk/MsgDelegate", value: { delegator_address: window.__ADDR, validator_address: VD[q.id].op, amount: { denom: "uatone", amount: String(q.x) } } }; });
  }
  /* the slider runs on a square law: fine steps among small amounts, the whole balance at the far end; a slid
     amount rounds to two significant figures, a typed one is taken as it is */
  function spNice(u){ if(u < 1e6) return Math.round(u / 1e5) * 1e5; var p = Math.pow(10, Math.floor(Math.log10(u)) - 1); return Math.round(u / p) * p; }
  function spSlid(){ var r = E("sprng"), mx = spMax(); if(!r || !(mx > 0)) return 0; var s = +r.value / 1000; return s >= 1 ? mx : Math.min(mx, spNice(s * s * mx)); }
  function spFill(){ var r = E("sprng"); if(r) r.style.setProperty("--sp-f", (+r.value / 10) + "%"); }
  function spSyncRange(u){ var r = E("sprng"), mx = spMax(); if(r) r.value = mx > 0 ? Math.round(Math.sqrt(Math.min(1, u / mx)) * 1000) : 0; spFill(); }
  /* ── the live view (operator, 2026-10-17: "make it a feature worth feeling in real time ... avoid texts"): the two
     figures roll to their new values, the validators it lands on are chips, and the set is drawn on a canvas with the
     stake pouring into them - the shelf rising as the amount grows. The drawing runs only while the view is shown ── */
  var SPV = { a: null, y: null, raf: 0 }, REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* a figure is never cut (a phone, a large amount): its type steps down until the value it rolls to fits its box */
  function spFit(b, text){
    b.style.fontSize = ""; if(!b.clientWidth) return;
    var keep = b.textContent; b.textContent = text;
    var fs = parseFloat(getComputedStyle(b).fontSize);
    while(b.scrollWidth > b.clientWidth + 0.5 && fs > 14){ fs -= 1; b.style.fontSize = fs + "px"; }
    b.textContent = keep;
  }
  function spHero(P){
    var el = E("spout"), A = E("spapr"), Y = E("spyr"); if(!el || !A || !Y) return;
    el.classList.toggle("idle", !P);
    cancelAnimationFrame(SPV.raf);
    if(!P){ SPV.a = SPV.y = null; A.textContent = "-"; Y.textContent = "-"; A.style.fontSize = Y.style.fontSize = ""; return; }
    var a1 = P.rate, y1 = P.earned, a0 = SPV.a == null ? a1 : SPV.a, y0 = SPV.y == null ? 0 : SPV.y, t0 = performance.now(), D = REDUCED ? 0 : 340;
    spFit(A, pct(Math.max(a0, a1))); spFit(Y, "+" + fmt(Math.max(y0, y1)));
    (function roll(n){
      var k = D ? Math.max(0, Math.min(1, (performance.now() - t0) / D)) : 1, e = 1 - Math.pow(1 - k, 3);   /* the clock, not the frame's timestamp: that one can precede t0 (or lag), and the ease then ran backwards ("+-2,134.8", 2026-10-18) */
      SPV.a = a0 + (a1 - a0) * e; SPV.y = y0 + (y1 - y0) * e;
      A.textContent = pct(SPV.a); Y.textContent = "+" + fmt(SPV.y);
      if(k < 1) SPV.raf = requestAnimationFrame(roll);
    })(t0);
  }
  function spChips(P){
    var el = E("splegs"); if(!el) return;
    var legs = P ? P.legs : [], cap = 7, show = legs.length > cap ? legs.slice(0, cap - 1) : legs, more = legs.length - show.length;
    var left = P && P.left >= 1e6 ? P.left : 0;
    var key = show.map(function(q){ return q.id; }).join(",") + "|" + more + "|" + (left ? 1 : 0);
    var chip = function(q){ return '<span class=sp-chip data-id="' + att(q.id) + '">' + logo(q.id, q.m) + '<span>' + att(q.m) + '</span><b>+' + fmt(q.x) + '</b></span>'; };
    if(key === SP.key){
      /* the same validators: only the amounts change, in place */
      show.forEach(function(q, i){ var b = el.children[i] && el.children[i].querySelector("b"); if(b){ var t = "+" + fmt(q.x); if(b.textContent !== t) b.textContent = t; } });
      var lf = el.querySelector(".left"); if(lf) lf.textContent = fmt(left) + " ATONE stays";
      if(spOver(el)){ SP.key = null; spChips(P); }   /* a wider amount pushed a chip out: lay them out again */
      return;
    }
    SP.key = key;
    el.innerHTML = show.map(chip).join("") + (more > 0 ? '<span class="sp-chip more">+' + more + '</span>' : '') +
      (left ? '<span class="sp-chip left">' + fmt(left) + ' ATONE stays</span>' : '');
    /* the strip has a fixed height (nothing below it moves) and clips: a validator that does not fit is counted into the
       "+N" chip instead of vanishing, so a phone never shows one validator of three with no sign of the rest */
    var cut = 0, mv, vs;
    while(spOver(el) && (vs = el.querySelectorAll(".sp-chip[data-id]")).length > 1){
      vs[vs.length - 1].remove(); cut++;
      mv = el.querySelector(".sp-chip.more");
      if(!mv){ mv = document.createElement("span"); mv.className = "sp-chip more"; var lv = el.querySelectorAll(".sp-chip[data-id]"); lv[lv.length - 1].after(mv); }
      mv.textContent = "+" + (more + cut);
    }
  }
  /* by layout position, not the painted box: the chips arrive with a short slide, and mid-slide they paint lower than
     they sit, which read as overflow and cut chips that fit */
  function spOver(el){
    var c = el.lastElementChild; if(!c || !el.clientHeight) return false;
    var top = c.offsetParent === el ? c.offsetTop : c.offsetTop - el.offsetTop;
    return top + c.offsetHeight > el.clientHeight + 1;
  }
  /* the stage: every validator of the set as a bar (largest left), the ones the move lands on lit, and the stake flowing
     into them as light; bars ease to their new state, so dragging the slider is felt, not redrawn */
  var STG = { on: false, raf: 0, last: 0, cv: null, ctx: null, w: 0, h: 0, d: 1, n: 0, t: [], k: [], kTo: [], c: [], cTo: [], f: [],
              legs: [], tot: 0, parts: [], acc: 0, rush: 0, col: null, colAt: 0 };
  function stgShown(){ var cv = E("spcv"); return !!(cv && cv.offsetParent && cv.clientWidth > 0); }
  function stgSize(){
    var cv = STG.cv, r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
    if(cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
    STG.w = w; STG.h = h; STG.d = d;
  }
  function stgCols(){
    var cs = getComputedStyle(E("spstage")), g = function(k, x){ var v = cs.getPropertyValue(k).trim(); return v || x; };
    STG.col = { bar: g("--sp-bar", "#2a2a4e"), hot: g("--sp-hot", "#2bc8bd"), hot2: g("--sp-hot2", "#b9b0ff"), dot: g("--sp-dot", "#e6fffb") }; STG.colAt = performance.now();
  }
  function stgSet(P){
    STG.cv = E("spcv"); if(!STG.cv) return;
    var V = window.__VALS(), n = V.length, i;
    if(STG.n !== n){ STG.n = n; STG.k = []; STG.c = []; STG.f = []; for(i = 0; i < n; i++){ STG.k.push(0); STG.c.push(0); STG.f.push(0); } }
    STG.t = V.map(function(v){ return v[1]; });
    STG.kTo = []; STG.cTo = []; for(i = 0; i < n; i++){ STG.kTo.push(0); STG.cTo.push(0); }
    STG.legs = []; STG.tot = 0;
    if(P && P.legs.length){
      var at = {}, mx = 0; V.forEach(function(v, q){ at[v[3]] = q; });
      P.legs.forEach(function(q){ if(q.x > mx) mx = q.x; });
      P.legs.forEach(function(q){ var j = at[q.id]; if(j == null) return; var s = q.x / mx;
        STG.kTo[j] = 0.5 + 0.5 * s; STG.cTo[j] = s; STG.legs.push({ i: j, w: q.x }); STG.tot += q.x; });
      STG.rush = 1;   /* a change sends a wave */
    }
    stgStart();
  }
  function stgStart(){ if(STG.on || !STG.cv) return; STG.on = true; STG.last = performance.now(); stgCols(); STG.raf = requestAnimationFrame(stgTick); }
  function stgStop(){ STG.on = false; cancelAnimationFrame(STG.raf); STG.parts = []; }
  function stgPick(){ var r = Math.random() * STG.tot; for(var j = 0; j < STG.legs.length; j++){ r -= STG.legs[j].w; if(r <= 0) return STG.legs[j].i; } return STG.legs[STG.legs.length - 1].i; }
  function stgTick(now){
    if(!STG.on) return;
    if(!stgShown()){ stgStop(); return; }
    var dt = Math.max(0, Math.min(0.05, (now - STG.last) / 1000)), i; STG.last = now;   /* a first frame can be stamped before stgStart's clock read: never a negative step */
    if(now - STG.colAt > 1000) stgCols();
    stgSize();
    var ctx = STG.ctx || (STG.ctx = STG.cv.getContext("2d")), W = STG.w, H = STG.h, d = STG.d, n = STG.n, C = STG.col;
    var ease = REDUCED ? 1 : Math.min(1, dt * 9);
    for(i = 0; i < n; i++){ STG.k[i] += (STG.kTo[i] - STG.k[i]) * ease; STG.c[i] += (STG.cTo[i] - STG.c[i]) * ease; STG.f[i] *= Math.exp(-dt * 5); }
    /* geometry: the bars fill the stage, heights on a square-root law of stake (the largest reaches the top) */
    var padX = 10 * d, padT = 22 * d, padB = 12 * d, gap = n > 60 ? 1 * d : 2 * d;
    var bw = Math.max(1, (W - 2 * padX - gap * (n - 1)) / n), base = H - padB, top = STG.t.length ? STG.t[0] : 1;
    var bx = function(j){ return padX + j * (bw + gap); }, bh = function(j){ return Math.max(2 * d, (base - padT) * Math.sqrt(STG.t[j] / top)); };
    ctx.clearRect(0, 0, W, H);
    /* bars */
    for(i = 0; i < n; i++){
      var x = bx(i), h = bh(i), y = base - h, k = STG.k[i];
      ctx.globalAlpha = 1; ctx.fillStyle = C.bar; ctx.fillRect(x, y, bw, h);
      if(k > 0.01){
        var g = ctx.createLinearGradient(0, y, 0, base); g.addColorStop(0, C.hot2); g.addColorStop(1, C.hot);
        ctx.globalAlpha = Math.min(1, k); ctx.fillStyle = g; ctx.fillRect(x, y, bw, h);
        /* the cap: what lands here, lit, its height by the share of the move */
        var ch = (3 + 16 * STG.c[i]) * d;
        ctx.globalAlpha = Math.min(1, k * (0.75 + 0.25 * Math.min(1, STG.f[i] + 0.2)));
        ctx.shadowColor = C.hot; ctx.shadowBlur = (8 + 14 * STG.f[i]) * d; ctx.fillStyle = C.dot; ctx.fillRect(x, y - ch - 2 * d, bw, ch); ctx.shadowBlur = 0;
      }
    }
    /* the pour: light falling into the validators it lands on, more of it where more goes, a wave on each change */
    if(!REDUCED && STG.legs.length){
      STG.acc += dt * (18 + 70 * STG.rush); STG.rush *= Math.exp(-dt * 2.2);
      while(STG.acc >= 1 && STG.parts.length < 260){ STG.acc -= 1; var j = stgPick(), tx = bx(j) + bw / 2;
        STG.parts.push({ j: j, x0: tx + (Math.random() - 0.5) * 90 * d, y0: -6 * d, t: 0, dur: 0.6 + Math.random() * 0.5, r: (1 + Math.random() * 1.4) * d }); }
    } else STG.acc = 0;
    ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = C.dot;
    for(i = STG.parts.length - 1; i >= 0; i--){
      var p = STG.parts[i]; p.t += dt / p.dur;
      if(p.t >= 1 || STG.kTo[p.j] < 0.01){ if(p.t >= 1) STG.f[p.j] = Math.min(1, STG.f[p.j] + 0.35); STG.parts.splice(i, 1); continue; }
      var e2 = p.t * p.t, tx2 = bx(p.j) + bw / 2, ty = base - bh(p.j) - (3 + 16 * STG.c[p.j]) * d - 2 * d;
      var px = p.x0 + (tx2 - p.x0) * (1 - Math.pow(1 - p.t, 2)), py = p.y0 + (ty - p.y0) * e2;
      ctx.globalAlpha = 0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, p.t * 1.1));
      ctx.beginPath(); ctx.arc(px, py, p.r, 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    STG.raf = requestAnimationFrame(stgTick);
  }
  if(window.ResizeObserver && E("spstage")) new ResizeObserver(function(){ if(STG.on) stgSize(); else if(stgShown()) stgStart(); }).observe(E("spstage"));
  function spState(){
    var u = spAmount(), bal = spBal(), mx = spMax(), over = u > mx, P = u > 0 && !over ? window.__pilotPlan(u) : null;
    SP.plan = P;
    var mv = E("spmaxv"); if(mv) mv.textContent = exact(mx, 2);
    var fld = E("spamt") && E("spamt").closest(".unfield"); if(fld) fld.classList.toggle("bad", !!over);
    var hint = E("sphint"); if(hint){ hint.className = "unhint" + (over ? " bad" : ""); hint.textContent = ""; }
    spHero(P); spChips(P); stgSet(P);
    /* fees are PHOTON: short of it, one button mints a pinch from ATONE first */
    var ph = E("sppho"), need = spPho() < SP_PHO, phH = need && bal > SP_KEEP ? '<button type=button id=sppm><svg viewBox="0 0 24 24" aria-hidden=true><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/></svg>Mint PHOTON for fees</button>' : '';
    if(ph && ph.innerHTML !== phH){ ph.innerHTML = phH; var pm = E("sppm"); if(pm) pm.addEventListener("click", function(){ if(window.__mint) window.__mint(100000); }); }
    var ok = !!P && P.legs.length > 0 && !need;
    var sm = E("spsum"); if(sm) sm.innerHTML = P ? fmt(P.staked) + " ATONE<br>to " + P.legs.length + " validator" + (P.legs.length === 1 ? "" : "s") + " at " + pct(P.rate) : "";
    /* "Stake", as on the Stake card: the amount is in the summary above, and a label that grew with it moved Back */
    var go = E("spsign"); if(go){ go.disabled = !ok || !window.__WALLET; if(!go.classList.contains("busy")) go.textContent = "Stake"; }
    var sb = E("spbell"); if(sb) sb.disabled = !(P && P.legs.length);
    var st = E("spstep"); if(st){ st.textContent = ""; st.className = "txstep"; }
    feeSoon("sp", E("spfee"), ok ? spMsgs : null);
  }
  function spPrep(u0){
    var a = E("spamt"); if(a) a.value = u0 > 0 ? exact(u0) : "";
    SP.key = ""; var go = E("spsign"); if(go){ go.disabled = true; go.classList.remove("busy"); }
    spSyncRange(u0 > 0 ? u0 : 0);
  }
  /* StakePilot, the stake flow outside Pro (operator, 2026-10-17): every Stake there opens it */
  window.__pilot = function(u0){
    if(!sppop || !window.__ADDR) return;
    spPrep(u0); POP.open(sppop); spState(); window.__kbFocus(E("spamt"));
  };
  window.__spIds = function(){ return SP.plan ? SP.plan.legs.map(function(q){ return q.id; }) : []; };
  /* live figures re-plan the view wherever it is shown: a popup, or Pro's panes */
  window.__pilotRedo = function(){ if(sppop && sppop.classList.contains("on")) spState(); };
  /* a turned phone or a resized window fits the figures again */
  window.addEventListener("resize", function(){ if(sppop && sppop.classList.contains("on") && SP.plan){ var A = E("spapr"), Y = E("spyr");
    if(A && Y){ spFit(A, A.textContent); spFit(Y, Y.textContent); } } });
  /* the chain moves while it is open: each live read re-plans it, so the figures and the pour stay the chain's own */
  window.addEventListener("thermo:live", function(){ window.__pilotRedo(); });
  /* a wallet gone: the Pilot view closes as the Stake card does */
  window.__spReset = function(){ if(sppop && window.__closeCard) window.__closeCard(sppop); };
  /* closed, it keeps no amount and no plan (the next open starts clean) */
  if(sppop) sppop.__onclose = function(){ feeSoon("sp"); SP.plan = null; SP.key = ""; var a = E("spamt"); if(a) a.value = ""; spSyncRange(0); spState(); stgStop(); };
  var spamtEl = E("spamt"); if(spamtEl) spamtEl.addEventListener("input", function(){ spSyncRange(spAmount()); spState(); });
  var sprng = E("sprng"); if(sprng) sprng.addEventListener("input", function(){ var u = spSlid(); E("spamt").value = u > 0 ? exact(u) : ""; spFill(); spState(); });
  var spmax = E("spmax"); if(spmax) spmax.addEventListener("click", function(){ if(!(spMax() > 0)) return; E("spamt").value = exact(spMax()); spSyncRange(spMax()); spState(); });
  var spsign = E("spsign");
  if(spsign) spsign.addEventListener("click", function(){
    var msgs = spMsgs(); if(!msgs.length || !window.__TX || !window.__WALLET) return;
    spsign.disabled = true; spsign.classList.add("busy");
    var n = window.__notify();
    window.__TX.send(window.__WALLET, msgs, "", function(){})
    .then(function(){
      n.ok(); window.__closeCard(sppop);   /* docked in Pro too: the view goes, nothing of the move stays */
      if(window.__refreshPos) window.__refreshPos().then(function(){ draw(); });
    })
    .catch(function(e){ n.fail(e && e.message || String(e)); })
    .then(function(){ spsign.classList.remove("busy"); spState(); });
  });

  /* ── Buy ATONE (operator, 2026-10-15: "buy button like mint ... direct buy from osmosis atone pool"): the
     wallet signs ONE transaction on Osmosis that buys an exact amount of ATONE over the router's best single
     route and sends exactly that home to this AtomOne address over IBC (tx.js osmo, proven by simulation on
     Osmosis at 5, 50 and 500 USDC). A wallet short of PHOTON also gets 2 PHOTON for AtomOne's fees, bought and
     sent in the same signature. Any ATONE already on Osmosis rides home with it, or alone ("Bring it home").
     What is not spent stays in the Osmosis wallet as it was. Mainnet only: testnet has its faucet. ── */
  var bypop = E("bypop"), BY = { key: null, bal: null, px: null, q: null, qn: 0, t: 0, busy: false, done: null, err: "" };
  var BY_SQS = "https://sqs.osmosis.zone", BY_SLIP = 0.997, BY_PHO = 2000000, BY_PHO_PAY = 60000;
  var BY_TOK = [{ d: "ibc/498A0751C798A0D9A389AA3691123DADA57DAA4FE165D5C75894505B876BA6E4", s: "USDC" },
                { d: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2", s: "ATOM" },
                { d: "uosmo", s: "OSMO" }];
  function byO(){ return window.__TX && window.__TX.osmo; }
  function byTok(){ var s = E("bytok"), d = s && s.value; return BY_TOK.filter(function(t){ return t.d === d; })[0] || BY_TOK[0]; }
  function byHave(d){ return (BY.bal && BY.bal[d]) || 0; }
  function byAmount(){ var a = E("byamt"), n = window.__amountIn(a && a.value); return isFinite(n) && n > 0 ? Math.round(n * 1e6) : 0; }
  /* the fee is paid in OSMO when the wallet holds some, else in the token it pays with; that token keeps room for it */
  function byFeeDenom(){ return byHave("uosmo") >= 100000 && byTok().d !== "uosmo" ? "uosmo" : byTok().d; }
  function byReserve(){ var t = byTok().d; return byFeeDenom() === t ? (t === "uosmo" ? 150000 : t === BY_TOK[0].d ? 50000 : 5000) : 0; }
  function byNeedPho(){ var b = window.__BAL; return byTok().d === BY_TOK[0].d && !(b && b.uphoton >= 500000); }
  function byMax(){ return Math.max(0, byHave(byTok().d) - byReserve() - (byNeedPho() ? BY_PHO_PAY : 0)); }
  function byQuote(payD, outD, amt){
    return fetch(BY_SQS + "/router/quote?tokenIn=" + amt + encodeURIComponent(payD) + "&tokenOutDenom=" + encodeURIComponent(outD) + "&singleRoute=true")
      .then(function(r){ return r.json(); }).then(function(q){
        if(!q || !q.route || !q.route.length || !(+q.amount_out > 0)) throw new Error(q && q.message || "no route");
        /* the exact-in route forward, as exact-out wants it: each pool takes the previous pool's token out */
        var tin = payD, pools = q.route[0].pools.map(function(p){ var x = { pool_id: p.id, token_in_denom: tin }; tin = p.token_out_denom; return x; });
        var poolsIn = q.route[0].pools.map(function(p){ return { pool_id: p.id, token_out_denom: p.token_out_denom }; });
        return { out: +q.amount_out, pools: pools, poolsIn: poolsIn, impact: Math.abs(+q.price_impact || 0) };
      });
  }
  function byPrices(){
    return fetch(BY_SQS + "/tokens/prices?base=" + encodeURIComponent(["uosmo", BY_TOK[1].d].join(","))).then(function(r){ return r.json(); }).then(function(p){
      var usd = function(d){ var v = p[d] && Object.values(p[d])[0]; return v ? +v : 0; };
      BY.px = { uosmo: usd("uosmo") }; BY.px[BY_TOK[1].d] = usd(BY_TOK[1].d); BY.px[BY_TOK[0].d] = 1;
    }).catch(function(){});
  }
  function byLoad(){
    var O = byO(); if(!O || !BY.key) return Promise.resolve();
    return Promise.all([O.balances(BY.key.address).then(function(b){ BY.bal = b; }), byPrices()]).catch(function(e){ BY.err = e.message; });
  }
  /* the quote follows the amount: an answer for an older amount is dropped */
  /* the quote is the chain's: the router picks the routes, then a simulation of those swaps on Osmosis answers what each
     gives (exact-in; the router can be a percent off on some routes, the chain never). Home goes 99.7% of that, exactly;
     PHOTON, a small leg, 97%. Re-read on every change of amount, and again just before signing */
  function byChainQuote(u, t){
    var O = byO(), k = BY.key, pho = byNeedPho();
    return Promise.all([byQuote(t.d, O.cfg.atone, u), pho ? byQuote(t.d, O.cfg.photon, BY_PHO_PAY) : Promise.resolve(null)]).then(function(r){
      var sw = function(route, amt){ return { type: "osmosis/poolmanager/split-amount-in", value: { sender: k.address, routes: [{ pools: route.poolsIn, token_in_amount: String(amt) }],
        token_in_denom: t.d, token_out_min_amount: "1" } }; };
      var probe = [sw(r[0], u)]; if(r[1]) probe.push(sw(r[1], BY_PHO_PAY));
      return O.account(k.address).then(function(acc){ return O.probe(probe, "", k.pubKey, acc.sequence); }).then(function(outs){
        var aOut = outs[0] || 0, pOut = r[1] ? (outs[1] || 0) : 0;
        if(!(aOut > 0)) throw new Error("the pool gave nothing for this amount");
        r[0].out = aOut;
        var ph = r[1] && Math.floor(pOut * 0.97) >= BY_PHO ? r[1] : null; if(ph){ ph.out = pOut; ph.min = Math.floor(pOut * 0.97); }
        return { u: u, pay: t.d, atone: r[0], pho: ph, target: Math.floor(aOut * BY_SLIP) };
      });
    });
  }
  function byQuoteSoon(){
    var n = ++BY.qn, u = byAmount(), t = byTok(), O = byO(); clearTimeout(BY.t); BY.q = null;
    if(!(u > 0) || !O || !BY.key || u > byMax()) { byState(); return; }
    BY.q = { wait: true }; byState();
    BY.t = setTimeout(function(){
      byChainQuote(u, t).then(function(q){ if(n !== BY.qn) return; BY.q = q; byState(); byFee(); })
        .catch(function(e){ if(n !== BY.qn) return; BY.q = { err: String(e.message || e).replace(/^.*desc = /, "").slice(0, 120) || "no route" }; byState(); });
    }, 300);
  }
  function byMsgs(){
    var O = byO(), q = BY.q, k = BY.key; if(!O || !q || !q.target || !k || !window.__ADDR) return [];
    var home = Date.now() + 20 * 60000;
    var swap = function(route, amt, min){ return { type: "osmosis/poolmanager/split-amount-in", value: { sender: k.address, routes: [{ pools: route.poolsIn, token_in_amount: String(amt) }],
      token_in_denom: q.pay, token_out_min_amount: String(min) } }; };
    var send = function(d, amt){ return { type: "cosmos-sdk/MsgTransfer", value: { source_port: "transfer", source_channel: O.cfg.channel, token: { denom: d, amount: String(amt) },
      sender: k.address, receiver: window.__ADDR, timeout_timestamp: String(BigInt(home) * 1000000n), memo: "" } }; };
    var msgs = [swap(q.atone, q.u, q.target)];
    if(q.pho) msgs.push(swap(q.pho, BY_PHO_PAY, q.pho.min));
    msgs.push(send(O.cfg.atone, q.target + byHave(O.cfg.atone)));
    if(q.pho) msgs.push(send(O.cfg.photon, q.pho.min + byHave(O.cfg.photon)));
    return msgs;
  }
  /* bring home whatever ATONE (and PHOTON) already waits on Osmosis, in one transfer each */
  function byHomeMsgs(){
    var O = byO(), k = BY.key; if(!O || !k || !window.__ADDR) return [];
    var home = Date.now() + 20 * 60000, out = [];
    [O.cfg.atone, O.cfg.photon].forEach(function(d){ var a = byHave(d); if(a > 0) out.push({ type: "cosmos-sdk/MsgTransfer", value: { source_port: "transfer", source_channel: O.cfg.channel,
      token: { denom: d, amount: String(a) }, sender: k.address, receiver: window.__ADDR, timeout_timestamp: String(BigInt(home) * 1000000n), memo: "" } }); });
    return out;
  }
  function byFeeFor(msgs){
    var O = byO(), k = BY.key, fd = byFeeDenom(); if(!O || !k || !msgs.length) return Promise.reject(new Error("nothing to send"));
    return O.account(k.address).then(function(acc){ return O.simulate(msgs, "", k.pubKey, acc.sequence); }).then(function(g){
      var usdPay = BY.px ? BY.px[fd] : 0; return O.fee(g, fd, BY.px ? BY.px.uosmo : 0, usdPay); });
  }
  function byFee(){
    var el = E("byfee"), msgs = byMsgs(); if(!el) return;
    if(!msgs.length){ el.textContent = ""; return; }
    var n = BY.qn; el.textContent = "fee: estimating…";
    byFeeFor(msgs).then(function(f){ if(n !== BY.qn) return; BY.fee = f; var c = f.amount[0];
      el.textContent = "fee ≈ " + (parseInt(c.amount, 10) / 1e6).toFixed(c.denom === "uosmo" ? 4 : 5) + " " + (BY_TOK.filter(function(t){ return t.d === c.denom; })[0] || { s: c.denom }).s + " on Osmosis";
      byState(); })
    .catch(function(e){ if(n !== BY.qn) return; BY.fee = null; el.textContent = "Osmosis refused this: " + String(e.message || e).replace(/^.*desc = /, "").slice(0, 160); byState(); });
  }
  var byShort = function(a){ return a ? a.slice(0, 10) + "…" + a.slice(-4) : ""; };
  var BY_ARROW = '<svg viewBox="0 0 24 24" aria-hidden=true><path d="M4 12h15M13 6l6 6-6 6"/></svg>';
  function byState(){
    var O = byO(), t = byTok(), u = byAmount(), mx = byMax(), q = BY.q, out = E("byout"), more = E("bymore"), go = E("bysign");
    var mv = E("bymaxv"); if(mv) mv.textContent = BY.key ? exact(mx, 2) : "-";
    var over = BY.key && u > mx, fld = E("byamt") && E("byamt").closest(".unfield"); if(fld) fld.classList.toggle("bad", !!over);
    var home = O ? byHave(O.cfg.atone) : 0, ok = false;
    trkDraw();
    if(out){
      if(!BY.key){ out.className = "by-out idle"; out.innerHTML = '<span>' + (BY.err ? att(BY.err) : 'Connecting to Osmosis…') + '</span>'; }
      else if(q && q.target){ ok = !over && !!BY.fee;
        out.className = "by-out"; var rate = q.u / q.atone.out;
        out.innerHTML = '<em>You get, exactly' + (q.pho ? '<i>+ ' + Math.floor(q.pho.min / 1e6) + ' PHOTON for fees</i>' : '') + '</em><b>' + fmt(q.target) + '<small>ATONE</small></b>' +
          '<span>at ' + rate.toFixed(4) + ' ' + t.s + ' per ATONE' + (q.atone.impact > 0.05 ? ', price impact ' + (q.atone.impact * 100).toFixed(1) + '%' : ', Osmosis pool') + '</span>'; }
      else { out.className = "by-out idle";
        out.innerHTML = '<span>' + (q && q.wait ? 'Asking the Osmosis pool…' : q && q.err ? 'No route right now: ' + att(q.err) : over ? 'More than this token holds on Osmosis' :
          !byHave(t.d) ? 'No ' + t.s + ' in this Osmosis wallet yet' : 'Type how much ' + t.s + ' to spend') + '</span>'; }
    }
    var path = E("bypath"); if(path) path.innerHTML = BY.key && window.__ADDR ? '<div><em>From Osmosis</em><b>' + byShort(BY.key.address) + '</b></div>' + BY_ARROW.replace('<svg', '<svg class=ar') +
      '<div><em>To AtomOne</em><b>' + byShort(window.__ADDR) + '</b></div>' : '';
    if(more){
      var bits = [];
      if(BY.done && BY.done.arrived) bits.push('<button type=button id=bystake>Stake it with StakePilot' + BY_ARROW + '</button>');
      else if(BY.key && home > 0 && !(q && q.target)) bits.push('<button type=button id=byhome' + (BY.busy ? ' disabled' : '') + '>Bring the ' + fmt(home) + ' ATONE on Osmosis home' + BY_ARROW + '</button>');
      if(!BY.done) bits.push('<a href="https://go.skip.build/?dest_chain=osmosis-1&dest_asset=' + encodeURIComponent(O ? O.cfg.atone : "") + '" target=_blank rel=noopener>From another chain, with Skip' + BY_ARROW + '</a>');
      more.innerHTML = bits.join("");
      var bs = E("bystake"); if(bs) bs.addEventListener("click", function(){ var a = BY.done.amt; POP.close(bypop); setTimeout(function(){ if(window.__pilot){ window.__pilot(); var f = E("spamt"); if(f){ f.value = exact(a); f.dispatchEvent(new Event("input")); } } }, 0); });
      var bh = E("byhome"); if(bh) bh.addEventListener("click", byHome);
    }
    var T = BY.trk, live = T && !T.done && !T.failed;
    ["byamt", "bytok", "bymax"].forEach(function(id){ var x = E(id); if(x) x.disabled = !!live; });   /* nothing to change while a buy is on its way */
    var sm = E("bysum"); if(sm) sm.innerHTML = q && q.target && !T ? fmt(q.u) + " " + t.s + "<br>for " + fmt(q.target) + " ATONE" : "";
    if(go){
      if(T){ go.disabled = live; go.textContent = live ? "Buying\u2026" : T.done ? "Buy again" : "Try again"; }
      else { go.disabled = !ok || BY.busy; if(!BY.busy) go.textContent = q && q.target ? "Buy " + fmt(q.target) + " ATONE" : "Buy"; }
    }
  }
  /* Skip-style live progress (operator, 2026-10-15: "our buy should ... display like skip showing live processing of tx"):
     four stages, each lit as the chain answers: the signature, the Osmosis transaction (its link and its time), the IBC
     packet received on AtomOne (AtomOne's own receipt for that packet sequence, not a balance guess), the ATONE home */
  var BY_STAGES = { buy: ["Sign on Osmosis", "Buy on Osmosis", "Send home over IBC", "In your AtomOne wallet"],
                    home: ["Sign on Osmosis", "Send from Osmosis", "Send home over IBC", "In your AtomOne wallet"] }, BY_TIMER = 0;
  function bySecs(ms){ var s = ms / 1000; return s < 60 ? s.toFixed(s < 10 ? 1 : 0) + " s" : Math.floor(s / 60) + " min " + Math.round(s % 60) + " s"; }
  function trkStart(kind){
    BY.trk = { kind: kind, t0: Date.now(), done: false, failed: false, steps: BY_STAGES[kind].map(function(l){ return { l: l, s: "wait", t0: 0, t1: 0, note: "", link: "" }; }) };
    clearInterval(BY_TIMER); BY_TIMER = setInterval(trkTick, 1000);
  }
  function trkSet(i, s, x){
    var st = BY.trk && BY.trk.steps[i]; if(!st) return;
    if(s === "run" && st.s !== "run") st.t0 = Date.now();
    if((s === "ok" || s === "fail") && !st.t1){ st.t1 = Date.now(); if(!st.t0) st.t0 = st.t1; }
    st.s = s; if(x){ if(x.note != null) st.note = x.note; if(x.link) st.link = x.link; }
    trkDraw();
  }
  function trkTime(st, i){ return st.s === "run" && st.t0 ? bySecs(Date.now() - st.t0) : st.s === "ok" && i < 3 && st.t1 ? bySecs(st.t1 - st.t0) : ""; }
  function trkDraw(){
    var el = E("bytrk"), card = bypop && bypop.querySelector(".bycard"), T = BY.trk; if(!el) return;
    if(card) card.classList.toggle("trk", !!T); el.hidden = !T; if(!T) return;
    el.innerHTML = T.steps.map(function(st, i){
      var link = st.link ? '<a href="https://www.mintscan.io/osmosis/tx/' + att(st.link) + '" target=_blank rel=noopener>' + att(st.link.slice(0, 6)) + '\u2026</a>' : '';
      return '<div class="by-st ' + st.s + '" data-i=' + i + '><i aria-hidden=true></i><b>' + st.l + '</b><span>' + (st.note ? '<u>' + att(st.note) + '</u>' : '') +
        '<em class=tm>' + trkTime(st, i) + '</em>' + link + '</span></div>';
    }).join("");
  }
  /* the running stage's clock ticks in place; nothing else is redrawn */
  function trkTick(){
    var T = BY.trk, el = E("bytrk"); if(!T || T.done || T.failed){ clearInterval(BY_TIMER); return; } if(!el) return;
    T.steps.forEach(function(st, i){ if(st.s !== "run") return; var tm = el.querySelector('.by-st[data-i="' + i + '"] .tm'); if(tm) tm.textContent = trkTime(st, i);
      var u = el.querySelector('.by-st[data-i="' + i + '"] u'); if(i === 2 && Date.now() - st.t0 > 180000 && u) u.textContent = "slower than usual"; });
  }
  /* the packets the Osmosis transaction sent, by sequence, from its own events */
  function byPackets(hash){
    var O = byO();
    return fetch(O.cfg.api + "/cosmos/tx/v1beta1/txs/" + hash, { cache: "no-store" }).then(function(r){ return r.json(); }).then(function(d){
      var seq = [];
      ((d.tx_response && d.tx_response.events) || []).forEach(function(e){ if(e.type !== "send_packet") return; var x = {};
        (e.attributes || []).forEach(function(at){ x[at.key] = at.value; });
        if(x.packet_src_channel === O.cfg.channel && x.packet_sequence) seq.push(x.packet_sequence); });
      return seq;
    });
  }
  /* AtomOne's receipt for each packet: once every one is received, the ATONE is in the wallet; a packet unrelayed when its
     timeout passes goes back to the Osmosis wallet */
  function byRelayed(seqs, t0){
    var api = window.__API || "https://atomone-api.gatadao.com", left = seqs.slice(), O = byO();
    return new Promise(function(res, rej){
      var tick = function(){
        if(!left.length) return res();
        if(Date.now() - t0 > 21 * 60000) return rej(new Error("The transfer timed out; Osmosis returns it to your Osmosis wallet"));
        Promise.all(left.map(function(s){ return fetch(api + "/ibc/core/channel/v1/channels/" + O.cfg.home + "/ports/transfer/packet_receipts/" + s, { cache: "no-store" })
          .then(function(r){ return r.json(); }).then(function(j){ return j && j.received ? s : null; }).catch(function(){ return null; }); }))
          .then(function(got){ left = left.filter(function(s){ return got.indexOf(s) < 0; }); if(!left.length) res(); else setTimeout(tick, 4000); });
      };
      setTimeout(tick, 3000);
    });
  }
  /* no packet found in the events (a node that hides them): the AtomOne balance is the signal instead */
  function byBalance(amt, before, t0){
    return new Promise(function(res, rej){
      var tick = function(){
        if(Date.now() - t0 > 21 * 60000) return rej(new Error("Not arrived yet; check your AtomOne balance in a few minutes"));
        window.__TX.balances(window.__ADDR).then(function(b){ if(b.uatone >= before + amt * 0.999) res(); else setTimeout(tick, 5000); }).catch(function(){ setTimeout(tick, 5000); });
      };
      setTimeout(tick, 5000);
    });
  }
  function byRun(msgs, amt, kind){
    var O = byO(), go = E("bysign"); if(!O || !BY.key || !msgs.length) return;
    BY.busy = true; if(go){ go.disabled = true; go.classList.add("busy"); }
    var n = window.__notify(), before = (window.__BAL && window.__BAL.uatone) || 0, cur = 0;
    trkStart(kind); trkSet(0, "run", { note: kind === "buy" ? "reading the pool" : "approve in your wallet" }); byState();
    /* a buy re-reads the chain right before signing, so the amount guaranteed is the pool's now, not a minute ago */
    (kind === "buy" ? byChainQuote(BY.q.u, byTok()).then(function(q){ BY.q = q; msgs = byMsgs(); amt = q.target; trkSet(0, "run", { note: "approve in your wallet" }); return msgs; }) : Promise.resolve(msgs))
    .then(function(m){ return byFeeFor(m); }).then(function(f){ return O.send(BY.key, msgs, "", f, function(s, x){
        if(s === "broadcasting"){ trkSet(0, "ok", { note: "" }); trkSet(1, "run"); cur = 1; }
        if(s === "pending" && x) trkSet(1, "run", { link: x }); }); })
    .then(function(r){ trkSet(1, "ok", { link: r.hash }); trkSet(2, "run"); cur = 2; byLoad();
      return byPackets(r.hash).catch(function(){ return []; }); })
    .then(function(seqs){ var t0 = Date.now(); return seqs.length ? byRelayed(seqs, t0) : byBalance(amt, before, t0); })
    .then(function(){ trkSet(2, "ok"); trkSet(3, "ok", { note: fmt(amt) + " ATONE" }); BY.trk.done = true; BY.done = { amt: amt, arrived: true }; n.ok();
      if(window.__refreshPos) window.__refreshPos().then(function(){ draw(); }); })
    .catch(function(e){ var m = e && e.message || String(e);
      if(BY.trk){ trkSet(cur, "fail", { note: /reject|denied|cancel/i.test(m) ? "declined in the wallet" : m.replace(/^.*desc = /, "").slice(0, 90) }); BY.trk.failed = true; }
      n.fail(m); })
    .then(function(){ BY.busy = false; if(go) go.classList.remove("busy"); byState(); });
  }
  function byHome(){ var O = byO(); if(!O) return; byRun(byHomeMsgs(), byHave(O.cfg.atone), "home"); }
  window.__buy = function(){
    if(!bypop || !window.__ADDR || !window.__TX || window.__TX.CHAIN !== "atomone-1") return;
    if(BY.trk && !BY.trk.done && !BY.trk.failed){ byState(); POP.open(bypop); return; }   /* a buy on its way: show its progress */
    var a = E("byamt"); if(a) a.value = "";
    var s = E("bytok"); if(s && !s.options.length) s.innerHTML = BY_TOK.map(function(t){ return '<option value="' + t.d + '">' + t.s + '</option>'; }).join("");
    BY.q = null; BY.done = null; BY.trk = null; BY.err = ""; BY.fee = null; E("byfee").textContent = ""; E("bystep").textContent = "";
    byState(); POP.open(bypop);
    /* the CONNECTED wallet signs on Osmosis, or nothing does: with Adena connected and Keplr also installed, the swap was
       signed by Keplr's key, spending another wallet's Osmosis funds (2026-10-17) */
    var kp = window.__WALLET && window.__WALLET.name === "Keplr" ? window.keplr : null;
    if(!kp){ BY.err = "Buying here signs on Osmosis, and this wallet cannot. Buy on Osmosis's own app, then send it to this address."; byState(); return; }
    kp.enable("osmosis-1").then(function(){ return kp.getKey("osmosis-1"); }).then(function(k){
      if(k.isNanoLedger) throw new Error("A Ledger signs Osmosis swaps in Osmosis's own app; buy there, then send it to this address.");
      BY.key = { address: k.bech32Address, pubKey: k.pubKey, signDirect: function(doc){ var n = parseInt(doc.accountNumber, 10);
        return kp.signDirect("osmosis-1", k.bech32Address, { bodyBytes: doc.bodyBytes, authInfoBytes: doc.authInfoBytes, chainId: doc.chainId,
          accountNumber: { low: n % 4294967296, high: Math.floor(n / 4294967296), unsigned: true, toString: function(){ return String(n); } } }, { preferNoSetFee: true }); } };
      return byLoad();
    }).then(function(){
      /* pay with what the wallet holds most of, by value */
      var best = BY_TOK.map(function(t){ return [t.d, byHave(t.d) * ((BY.px && BY.px[t.d]) || (t.d === BY_TOK[0].d ? 1 : 0))]; }).sort(function(x, y){ return y[1] - x[1]; })[0];
      if(s && best && best[1] > 0) s.value = best[0];
      byState(); window.__kbFocus(a);
    }).catch(function(e){ BY.err = e && e.message || "Osmosis could not be reached"; byState(); });
  };
  if(bypop) bypop.__onclose = function(){ clearTimeout(BY.t); BY.qn++; };
  var byamtEl = E("byamt"); if(byamtEl) byamtEl.addEventListener("input", byQuoteSoon);
  var bytokEl = E("bytok"); if(bytokEl) bytokEl.addEventListener("change", function(){ E("byamt").value = ""; BY.q = null; byState(); });
  if(bytokEl) window.__dd(bytokEl, "by-dd");                 /* Pay with opens the app's own list */
  var bymax = E("bymax"); if(bymax) bymax.addEventListener("click", function(){ if(!(byMax() > 0)) return; E("byamt").value = exact(byMax()); byQuoteSoon(); });
  var bysign = E("bysign"); if(bysign) bysign.addEventListener("click", function(){
    var T = BY.trk;
    if(T && (T.done || T.failed)){ var again = T.done; BY.trk = null; BY.done = null; if(again){ E("byamt").value = ""; BY.q = null; } byState(); if(!again) byQuoteSoon(); return; }
    if(BY.q && BY.q.target) byRun(byMsgs(), BY.q.target, "buy"); });

  /* ── Autopilot: a StakeAuthorization REDELEGATE grant to GATA's keeper address, with
     an allow-list, a cap and an expiry the reader sets; the keeper (a separate signer,
     its own key, off this box) executes inside those bounds; the chain enforces them.
     The pilot's address and standing come from pilot/_status.json (the public path says pilot, never keeper: operator, 2026-10-11). The card is one
     screen: the terms on the left, the validator set on the right to choose from. ── */
  var atpop = E("atpop"), atcard = atpop && atpop.querySelector(".atcard");
  var AT = { addr: null, dry: true, grant: null, grants: [], days: 90, report: null, who: null };
  /* the validators the grant may use, chosen in this card - apart from the Redelegate list's
     selection (that is where stake moves now; this is where the keeper may move it later) -
     and the card's own view: a standing grant shows its terms until "Change" */
  var ATSEL = {}, AT_EDIT = false, AT_FIND = "", AT_OPEN = 0;
  function atStatus(){
    return fetch("pilot/_status.json", { cache: "no-store" }).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
      AT.addr = j && j.grantee ? j.grantee : null; AT.dry = !j || j.dry !== false; 
      return j; }).catch(function(){ AT.addr = null; return null; });
  }
  var REDEL = "/cosmos.staking.v1beta1.MsgBeginRedelegate", DELEG = "/cosmos.staking.v1beta1.MsgDelegate", WDRAW = "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward";
  function grantType(g){ var a = g && g.authorization || {};
    return a.msg || ({ AUTHORIZATION_TYPE_REDELEGATE: REDEL, AUTHORIZATION_TYPE_DELEGATE: DELEG })[a.authorization_type] || ""; }
  /* what a grant this card builds is for, to set against the kinds that stand */
  function authType(a){
    if(!a) return "";
    if(a.type === "cosmos-sdk/StakeAuthorization") return (a.value.authorization_type === 1 || a.value.authorization_type === "delegate") ? DELEG : REDEL;
    if(a.type === "cosmos-sdk/GenericAuthorization") return a.value.msg;
    return "";
  }
  /* a StakeAuthorization exactly as the chain renders it for SIGN_MODE_LEGACY_AMINO_JSON (cosmossdk.io/x/tx aminojson):
     the type as its enum NUMBER (1 delegate, 3 redelegate) and the empty validator oneof written once as "Validators": null.
     A Ledger can only sign amino JSON, and the chain checks the signature against its own rendering, so the words the
     app used before ("redelegate") failed signature verification. Proven on atomone-testnet-1 2026-10-08: the old form
     rejected, this form accepted for the Autopilot grant, the Restake grants and a revoke. Direct signing is unaffected:
     tx.js encodes the number as before. */
  function stakeAuth(kind){ return { Validators: null, authorization_type: kind }; }
  /* any connected wallet can grant: Keplr signs direct, a Ledger behind Keplr and Adena sign amino JSON with this same
     form (Adena was left out when Ledger came in, 2026-10-08; covered 2026-10-09) */
  window.__canGrant = function(){ var w = window.__WALLET; return !!w && (!!w.signDirect || !!w.signAmino); };
  function revokeMsg(t, to){ return { type: "cosmos-sdk/MsgRevoke", value: { granter: window.__ADDR, grantee: to || AT.addr, msg_type_url: t } }; }
  /* other operators' restake, cancelled in the same approval that turns ours on (operator, 2026-09-30): any other grantee
     holding a delegate grant is a restake service; its delegate grant and its claim grant are revoked. Its other grants
     (vote, redelegate, anything else) are left alone. Unreadable grants: nothing is cancelled, ours still goes on */
  window.__rsOthers = function(){ return otherRestake().then(function(rv){ return rv.grantees || []; }).catch(function(){ return []; }); };
  function otherRestake(){
    var who = window.__ADDR;
    return fetch((window.__API || "https://atomone-api.gatadao.com") + "/cosmos/authz/v1beta1/grants/granter/" + who + "?pagination.limit=500", { cache: "no-store" })
      .then(function(r){ return r.ok ? r.json() : { grants: [] }; })
      .then(function(d){
        var by = {};
        (d.grants || []).forEach(function(x){ if(!x.grantee || x.grantee === AT.addr || x.granter !== who) return;
          var k = grantType(x); if(k === DELEG || k === WDRAW) (by[x.grantee] = by[x.grantee] || {})[k] = 1; });
        var out = []; out.grantees = [];
        Object.keys(by).forEach(function(g){ if(!by[g][DELEG]) return; out.grantees.push(g);
          out.push(revokeMsg(DELEG, g)); if(by[g][WDRAW]) out.push(revokeMsg(WDRAW, g)); });
        return out; })
      .catch(function(){ return []; });
  }
  /* every grant standing between the reader and the keeper: the redelegate one is the
     switch, the delegate + withdraw pair is the restake; a revoke names what stands */
  /* answers { grant: the redelegate one or null, grants: all that stand }, for the address
     asked about - the caller keeps it only if that is still the wallet on the page */
  function atGrant(){
    var who = window.__ADDR;
    if(!AT.addr || !who) return Promise.resolve({ who: who, grant: null, grants: [] });
    return fetch((window.__API || "https://atomone-api.gatadao.com") + "/cosmos/authz/v1beta1/grants?granter=" + who + "&grantee=" + AT.addr + "&pagination.limit=50", { cache: "no-store" })
      .then(function(r){ return r.json(); })
      .then(function(d){ var all = d.grants || [], g = null; all.forEach(function(x){ if(grantType(x) === REDEL) g = x; });
        return Promise.resolve(g ? grantedAt(who) : null).then(function(since){ return { who: who, grant: g, grants: all, since: since }; }); })
      .catch(function(){ return { who: who, grant: null, grants: [] }; });
  }
  /* when the standing grant was made: the chain keeps only its expiry, so the date is the
     latest MsgGrant this wallet signed to the keeper for redelegation (tx search); null if
     the search fails */
  function grantedAt(who){
    var q = encodeURIComponent("message.action='/cosmos.authz.v1beta1.MsgGrant' AND message.sender='" + who + "'");
    return fetch((window.__API || "https://atomone-api.gatadao.com") + "/cosmos/tx/v1beta1/txs?query=" + q + "&order_by=ORDER_BY_DESC&pagination.limit=20", { cache: "no-store" })
      .then(function(r){ return r.json(); })
      .then(function(d){ var rs = d.tx_responses || [];
        for(var i = 0; i < rs.length; i++){
          var ms = ((rs[i].tx || {}).body || {}).messages || [];
          for(var k = 0; k < ms.length; k++){ var m = ms[k], a = m.grant && m.grant.authorization || {};
            if(m["@type"] === "/cosmos.authz.v1beta1.MsgGrant" && m.grantee === AT.addr && a.authorization_type === "AUTHORIZATION_TYPE_REDELEGATE")
              return Date.parse(rs[i].timestamp) || null; } }
        return null; })
      .catch(function(){ return null; });
  }
  function atKeep(r){ if(!r || r.who !== window.__ADDR) return false; AT.grant = r.grant; AT.grants = r.grants; AT.since = r.since || null; return true; }
  /* only grants to our own address (atGrant asks for exactly those) are Autopilot's or Restake's; every other
     authz grant the wallet made - restake bots, any validator's service, GATA's validator included - is foreign
     and ignored: GATA's validator is one validator like any other in this app */
  function atReport(){
    if(!window.__ADDR) return Promise.resolve(null);
    /* a wallet with no report is a 204 (nothing here), not a 404 the browser would print as a failed request */
    return fetch("pilot/" + window.__ADDR + ".json", { cache: "no-store" }).then(function(r){ return r.status === 200 ? r.json() : null; }).catch(function(){ return null; });
  }
  /* no strategies: one fixed rule for Autopilot's own picks (never jailed, 95%+ uptime, the smaller validators) */
  function atPreset(){ return "below"; }
  /* the allow-list: chosen by the reader (between AT_MIN and AT_MAX validators), or decided by
     Autopilot - the best-paying validators that fit the strategy, AT_MAX of them */
  var AT_MIN = 5, AT_MAX = 20;
  function atPick(){ return (document.querySelector("#atpop input[name=atpick]:checked") || {}).value || "auto"; }
  function atSetPick(v){ var r = document.querySelector('#atpop input[name=atpick][value="' + v + '"]'); if(r) r.checked = true; }
  function atRestake(){ var c = E("atrestake"); return !!(c && c.checked); }
  function atViewing(){ return !!AT.grant && !AT_EDIT; }
  /* the set by id: all of it, or the ones a strategy would pick - a count on its card, a
     "fits" mark in the list and a one-tap selection (the chain enforces only the list) */
  function atIdsFor(v){
    var VD = window.__VDBY || {}, V = window.__VALS(), MEAN = window.__S() / V.length, out = [];
    if(v === "all"){ V.forEach(function(x){ var d = VD[x[3]]; if(d && d.op) out.push(x[3]); }); return out; }
    window.__candidates({ except: {}, cleanRecord: false }).forEach(function(c){ var d = VD[c.id]; if(!d || !d.op || d.tomb) return;
      var d90 = d.d90 == null ? null : +d.d90, lu = d.life_up == null ? null : +d.life_up;
      if(v === "passive"){ if(c.rank <= V.length / 2 && !c.jail && (lu == null || lu >= 99) && (d90 == null || d90 >= 99)) out.push(c.id); }
      else if(v === "aggressive"){ if(d90 == null || d90 >= 50) out.push(c.id); }
      else { if(c.t < MEAN && !c.jail && (d90 == null || d90 >= 95)) out.push(c.id); } });
    return out;
  }
  /* Autopilot's own choice: the strategy's fits, best-paying first, AT_MAX of them - topped up
     from the clean rest of the set (never jailed, 95% over 90 days) if too few fit */
  function atAutoIds(){
    var VD = window.__VDBY || {};
    var all = {}; window.__candidates({ except: {}, cleanRecord: false }).forEach(function(c){ all[c.id] = c; });
    var by = function(a, b){ return window.__rateAfter(all[b].t, all[b].c, 0) - window.__rateAfter(all[a].t, all[a].c, 0); };
    var out = atIdsFor(atPreset()).filter(function(id){ return all[id]; }).sort(by).slice(0, AT_MAX);
    if(out.length < AT_MIN){
      var have = {}; out.forEach(function(id){ have[id] = 1; });
      Object.keys(all).filter(function(id){ var d = VD[id] || {}; return !have[id] && !all[id].jail && !d.tomb && (d.d90 == null || +d.d90 >= 95); })
        .sort(by).slice(0, AT_MIN - out.length).forEach(function(id){ out.push(id); });
    }
    return out;
  }
  function atOps(ids){ var VD = window.__VDBY || {}, out = []; ids.forEach(function(id){ var d = VD[id]; if(d && d.op) out.push(d.op); }); return out; }
  function atSelIds(){ var VD = window.__VDBY || {}; return Object.keys(ATSEL).filter(function(id){ return VD[id] && VD[id].op; }); }
  /* a standing grant's allow-list, as the set's ids */
  function atGrantIds(){
    var a = AT.grant && AT.grant.authorization || {}, ops = (a.allow_list || {}).address || [], by = {}, VD = window.__VDBY || {}, out = {}, k;
    for(k in VD) if(VD[k].op) by[VD[k].op] = k;
    ops.forEach(function(op){ if(by[op]) out[by[op]] = 1; });
    return out;
  }
  /* the allow-list: the whole set, or the reader's own selection; the strategy sets the pace */
  function atScope(){ return atOps(atPick() === "selected" ? atSelIds() : atAutoIds()); }
  /* the memo the keeper reads: the strategy word, then the flags */
  /* the memo on the reader's grant: a plain label, nothing reads it */
  function atMemo(){ return "GATA AtomOne Autopilot"; }
  function atMonths(){ return AT.days >= 365 ? "12 months" : AT.days >= 180 ? "6 months" : "3 months"; }
  function atCap(){ var a = E("atcap"), n = window.__amountIn(a.value); return isFinite(n) && n > 0 ? Math.round(n * 1e6) : 0; }
  function atMsgs(){
    var pos = window.__POS;
    if(!AT.addr || !pos) return [];
    /* the operator's rule (2026-09-29): no cap and no validator list - the rule picks the validators (the
       smallest 34, never passing the one above) and the keeper runs it by itself at 00:00 and 12:00 UTC (no
       approval step since 2026-09-30). Until revoked: no end date. The chain reads a StakeAuthorization with
       neither list as "any validator". */
    var auth = stakeAuth(3);
    var msgs = [{ type: "cosmos-sdk/MsgGrant", value: { granter: window.__ADDR, grantee: AT.addr,
      grant: { authorization: { type: "cosmos-sdk/StakeAuthorization", value: auth } } } }];
    /* only the redelegate permission: no send, no fee, no share for GATA - ever. A grant that stands is simply
       overwritten by the new terms; restake is its own switch */
    return msgs;
  }
  window.__atMsgs = atMsgs;
  /* for the one screen's Start Autopilot: the grant alone (null once one stands), and a re-read after it lands */
  window.__atGrantMsg = function(){ if(AT.grant) return null; var m = atMsgs(); return m.length ? m[0] : null; };
  window.__atReload = function(){ atGrant().then(function(r){ if(!atKeep(r)) return; atLine(); var ab = E("atbtn"); if(ab) ab.classList.toggle("on", !!AT.grant); if(window.__redraw) window.__redraw(); }); };
  /* the DELEGATE grant stakes rewards back, so its cap is the rewards the period can earn
     (the whole stake at its APR, half again for margin), never the move cap: the chain cannot
     tell rewards from liquid ATONE, and this keeps what it could ever stake to that size */
  function atRestakeCap(){
    var pos = window.__POS;
    if(!pos || !(pos.total > 0)) return 1000000;
    return Math.max(1000000, Math.ceil(pos.total * Math.max(pos.rate, .05) * (AT.days / 365) * 1.5));
  }
  /* the counts: on the strategy and validator cards, over the list, on the phone's tab */
  function atCounts(){
    var auto = atAutoIds().length, sel = atSelIds().length, view = atViewing(), word = { passive: "Passive", below: "Moderate", aggressive: "Aggressive" }[atPreset()] || "Moderate";
    var na = E("atna"); if(na) na.textContent = "";
    var n2 = E("atn2"); if(n2) n2.textContent = sel ? sel + " selected" : AT_MIN + " to " + AT_MAX + " validators";
    var n = view ? Object.keys(atGrantIds()).length : atPick() === "auto" ? auto : sel;
    /* live, as Redelegate's: the number, then what it counts */
    var c = E("atcount"); if(c) c.innerHTML = view ? "<b>" + n + "</b>allowed" : atPick() === "auto" ? ""
      : "<b>" + sel + "</b>selected" + (sel < AT_MIN || sel > AT_MAX ? ", " + AT_MIN + " to " + AT_MAX : "");
    var vn = E("atvn"); if(vn) vn.textContent = n;
  }
  /* the set, in rank order: a box per validator, what it pays, its record, and marks for the
     ones already holding the reader's stake and the ones the strategy would pick */
  function atRows(){
    var el = E("atlist"); if(!el) return;
    var view = atViewing(), auto = !view && atPick() === "auto", allow = view ? atGrantIds() : null, aset = {};
    if(auto) atAutoIds().forEach(function(id){ aset[id] = 1; });
    var fit = {}; atIdsFor(atPreset()).forEach(function(id){ fit[id] = 1; });
    var mine = window.__MINE || {}, VD = window.__VDBY || {}, q = AT_FIND.trim().toLowerCase(), ph = innerWidth <= 620;
    var rows = window.__candidates({ except: {}, cleanRecord: false }).filter(function(o){
      var d = VD[o.id]; if(!d || !d.op) return false;
      o.on = view ? !!allow[o.id] : auto ? !!aset[o.id] : !!ATSEL[o.id];
      if((view || auto) && !o.on) return false;   /* a standing grant, or Autopilot's pick: only those validators */
      /* a name matches on any letters; an operator key only from five on, or every key matches "at" */
      return !q || String(o.m).toLowerCase().indexOf(q) >= 0 || (q.length >= 5 && String(d.op).toLowerCase().indexOf(q) >= 0); });
    /* easy: the validator, its 90-day uptime and what it pays - rank and jailings stay in Pro's lists */
    var h = '<table><colgroup><col style="width:34px"><col><col style="width:' + (ph ? 66 : 84) + 'px"><col style="width:' + (ph ? 60 : 76) + 'px"></colgroup>' +
            /* no select-all: validators are picked one by one */
            '<thead><tr><th class=ck></th><th class=l>validator</th><th>90<span class=lc>d</span> uptime</th><th>APR</th></tr></thead><tbody>';
    rows.forEach(function(o){
      var d = VD[o.id], u90 = d.d90 != null ? +d.d90 : (o.up != null ? +o.up : null);
      /* Autopilot's own picks are listed, not ticked: nothing here is the reader's selection yet */
      h += '<tr' + (o.on && !auto ? ' class=on' : '') + ' data-id="' + att(o.id) + '"><td class=ck>' + (auto ? '' : '<input type=checkbox aria-label="' + att(o.m) + '"' + (o.on ? ' checked' : '') + (view ? ' disabled' : '') + '>') + '</td>' +
           '<td class="l nm"><div class=nmw>' + logo(o.id, o.m) + '<span class=nmt>' + att(o.m) + '</span>' +
             (mine[o.id] ? '<span class="attg y">yours</span>' : '') + '</div></td>' +
           '<td class="' + (u90 == null ? 'dim' : u90 >= 95 ? 'ok' : u90 >= 85 ? 'warn' : 'bad') + '">' + (u90 == null ? '-' : u90.toFixed(1) + '%') + '</td>' +
           '<td class=r2><b>' + pct(window.__rateAfter(o.t, o.c, 0)) + '</b></td></tr>';
    });
    if(!rows.length) h += '<tr><td class=atnone colspan=4>' +
      (q ? 'No validator matches “' + att(AT_FIND.trim()) + '”.' : 'The set has not loaded yet.') + '</td></tr>';
    var top = el.scrollTop; el.innerHTML = h + '</tbody></table>'; el.scrollTop = top;
    el.classList.toggle("ro", view);
  }
  /* a phone shows one side at a time */
  function atView(v){
    if(atcard) atcard.setAttribute("data-v", v);
    Array.prototype.forEach.call(document.querySelectorAll("#atpop .atview [data-v]"), function(o){
      var on = o.dataset.v === v; o.setAttribute("aria-selected", on ? "true" : "false"); o.tabIndex = on ? 0 : -1; });
  }
  function atState(){
    var pos = window.__POS, cap = atCap(), scope = atScope(), view = atViewing();
    /* the list is shown for Choose yourself (and for a standing grant's own list), hidden for Autopilot's pick */
    if(atcard){ var pk = view ? "selected" : atPick(); atcard.setAttribute("data-pick", pk); atcard.setAttribute("data-view", view ? "1" : "0"); if(pk === "auto" && atcard.getAttribute("data-v") === "vals") atView("setup"); }
    atCounts();
    /* why it matters: stake left alone goes idle when its validator drops out of the set */
    var idl = E("atidle"), iv = window.__idleAtone ? window.__idleAtone() : "";
    if(idl) idl.hidden = true;
    var idn = E("atidlen"); if(idn) idn.textContent = iv ? iv + " ATONE" : "Stake";
    var mx = E("atmaxv"); if(mx) mx.textContent = pos ? exact(pos.free, 2) : "-";
    var signer = window.__canGrant();
    var ok = !view && !!AT.addr && signer;
    var hint = E("athint");
    if(hint){ hint.className = "unhint"; hint.textContent = !signer ? "Connect a wallet" : ""; }
    var go = E("atgrant"); if(go) go.disabled = !ok;
    var sm = E("atsum");
    /* the header says one thing, as Restake's does: Active or Inactive (operator, 2026-09-30) */
    if(sm) sm.innerHTML = view ? '<i class="you-tag on">Active</i>' : '<i class=you-tag>Inactive</i>';
    var fe = E("attxfee"), st = E("atstep"); fe.textContent = ""; st.textContent = ""; st.className = "txstep";
    feeSoon("at", fe, ok ? atMsgs : null);
  }
  function atRefresh(){ atRows(); atState(); }
  /* a standing grant, read back into the card: its list, its cap, its restake */
  function atFromGrant(){
    var ids = atGrantIds(), a = AT.grant.authorization || {}, cap = E("atcap"), rs = E("atrestake");
    var gn = Object.keys(ids).length;
    ATSEL = gn >= AT_MIN && gn <= AT_MAX ? ids : {}; atSetPick(gn >= AT_MIN && gn <= AT_MAX ? "selected" : "auto");
    if(cap) cap.value = a.max_tokens ? exact(+a.max_tokens.amount) : "";
    if(rs) rs.checked = (AT.grants || []).some(function(x){ return grantType(x) === DELEG; });
    atRsSync();
  }
  /* restake is a Yes | No pair like the months; the hidden box underneath is what the rest reads */
  function atRsSync(){ var on = atRestake();
    Array.prototype.forEach.call(document.querySelectorAll("#atrsk button"), function(o){ o.setAttribute("aria-pressed", (o.dataset.r === "1") === on ? "true" : "false"); }); }
  function atShow(){
    var g = AT.grant, view = atViewing(), st = E("atstate");
    st.hidden = !g;
    if(g){
      var a = g.authorization || {}, cap = a.max_tokens ? fmt(+a.max_tokens.amount) + " ATONE" : "no cap", n = ((a.allow_list || {}).address || []).length, exp = g.expiration ? window.__dayFull(new Date(g.expiration).getTime()) : "no expiry";
      var rp = AT.report, last = rp && rp.checked ? new Date(rp.checked * 1000) : null;
      /* restake is its own switch now: this line speaks of Autopilot's grant alone */
      /* what stands, as boxes: its validators, its cap, how long it runs; then the keeper's last word */
      var hn = rp && rp.history ? rp.history.length : 0;
      st.innerHTML = '<div class=atsb><div><em>Moves made</em><b>' + hn + '</b><small>' + (hn ? 'last ' + window.__dayFull(rp.history[0].at * 1000) : 'none yet') + '</small></div>' +
        '<div><em>Validators</em><b>' + (n ? n : 'The rule') + '</b><small>' + (n ? 'allowed (an older grant)' : 'picks them, GATA checks') + '</small></div>' +
        '<div><em>Runs until</em><b>' + (g.expiration ? exp : 'You revoke') + '</b><small>' + (g.expiration ? 'then grant again' : 'no end date') + '</small></div></div>' +
        (AT_EDIT ? '<br><span class=g>Changing it:</span> the terms below replace these when you sign.' : '');
    }
    E("atform").hidden = view;
    E("atrevoke").hidden = !view; E("atedit").hidden = true;   /* nothing to change: no cap, no list */
    var go = E("atgrant"); go.hidden = view; go.textContent = g ? "Update" : "Activate";
    /* no Cancel or Close: a tap outside, or Escape, closes the card. Back stays - it leaves a
       change of a standing grant without closing */
    var ac = E("atcancel"); ac.textContent = "Back"; ac.hidden = !(g && AT_EDIT);
    atRefresh();
  }
  /* the door: the card opens at once on what is known, then re-reads the keeper and the
     chain and follows only if a grant appeared or went in the meantime */
  var atbtn = E("atbtn");
  if(atbtn) atbtn.addEventListener("click", function(){
    if(!atpop || !window.__POS) return;
    var go = E("atgrant"); if(go){ go.disabled = true; go.classList.remove("busy"); }
    AT_EDIT = false; AT_FIND = ""; var f = E("atfind"); if(f) f.value = "";
    var a = E("atcap"); if(a) a.value = "";
    if(AT.grant) atFromGrant();
    else if(!atSelIds().length) Object.keys(SEL).forEach(function(id){ ATSEL[id] = 1; });   /* a first selection: the Redelegate list's */
    atView("setup"); atShow(); POP.open(atpop);
    var tok = ++AT_OPEN;
    atStatus().then(function(){ return Promise.all([atGrant(), atReport()]); }).then(function(r){
      if(tok !== AT_OPEN || !atpop.classList.contains("on")) return;
      var had = !!AT.grant; if(!atKeep(r[0])) return; AT.report = r[1];
      if(!!AT.grant !== had){ AT_EDIT = false; if(AT.grant) atFromGrant(); }
      atShow(); });
  });
  if(atpop) atpop.__onclose = function(){ AT_EDIT = false; AT_OPEN++; feeSoon("at"); };
  var atcapEl = E("atcap"); if(atcapEl) atcapEl.addEventListener("input", atState);
  var atmax = E("atmax"); if(atmax) atmax.addEventListener("click", function(){ var pos = window.__POS; if(!pos || !(pos.free > 0)) return; E("atcap").value = exact(pos.free); atState(); });
  /* Autopilot shows what it picked; Choose yourself, the whole set to pick from */
  Array.prototype.forEach.call(document.querySelectorAll("#atpop input[name=atpick]"), function(r){ r.addEventListener("change", atRefresh); });
  var atrs = E("atrestake"); if(atrs) atrs.addEventListener("change", atState);
  Array.prototype.forEach.call(document.querySelectorAll("#atrsk button"), function(b){ b.addEventListener("click", function(){
    if(!atrs || atViewing()) return; atrs.checked = b.dataset.r === "1"; atRsSync(); atState(); }); });
  Array.prototype.forEach.call(document.querySelectorAll("#atseg button"), function(b){ b.addEventListener("click", function(){
    AT.days = +b.dataset.d; Array.prototype.forEach.call(document.querySelectorAll("#atseg button"), function(o){ o.setAttribute("aria-pressed", o === b ? "true" : "false"); }); atState(); }); });
  /* the list: a tap anywhere on a row selects it or lets it go; from "All", the first tap
     starts a selection of the whole set less that one */
  var atlist = E("atlist");
  if(atlist) atlist.addEventListener("click", function(ev){
    var tr = ev.target.closest ? ev.target.closest("tr[data-id]") : null;
    if(!tr || atViewing()) return;
    var box = tr.querySelector("input"), on = ev.target === box ? box.checked : !tr.classList.contains("on");
    /* from Autopilot's pick, a tap starts the reader's own list with that one validator: picked one by one */
    if(atPick() === "auto"){ ATSEL = {}; atSetPick("selected"); on = true; }
    if(on && !ATSEL[tr.dataset.id] && atSelIds().length >= AT_MAX){
      atRefresh(); var hn = E("athint"); if(hn){ hn.className = "unhint bad"; hn.textContent = "At most " + AT_MAX + " validators: deselect one first"; }
      return; }
    if(on) ATSEL[tr.dataset.id] = 1; else delete ATSEL[tr.dataset.id];
    atRefresh();
  });
  /* the "?" beside a strategy: it opens its note (hover or focus) and never selects the option */
  Array.prototype.forEach.call(document.querySelectorAll("#atpop .athelp"), function(h){
    h.addEventListener("click", function(ev){ ev.preventDefault(); ev.stopPropagation(); h.focus(); });
    h.addEventListener("keydown", function(ev){ if(ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); ev.stopPropagation(); } });
  });
  var atfind = E("atfind");
  if(atfind){
    atfind.addEventListener("input", function(){ AT_FIND = atfind.value; atRows(); });
    /* Escape in a search that has text clears it, and leaves the card open */
    atfind.addEventListener("keydown", function(ev){ if(ev.key === "Escape" && atfind.value){ ev.preventDefault(); ev.stopPropagation(); atfind.value = ""; AT_FIND = ""; atRows(); } });
  }
  Array.prototype.forEach.call(document.querySelectorAll("#atpop .atview [data-v]"), function(b){
    b.addEventListener("click", function(){ atView(b.dataset.v); });
    b.addEventListener("keydown", function(ev){ if(ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return; ev.preventDefault();
      var v = b.dataset.v === "setup" ? "vals" : "setup"; atView(v); var o = document.querySelector('#atpop .atview [data-v="' + v + '"]'); if(o) o.focus(); });
  });
  /* the list's columns follow the width: a turned phone gets the wide markup */
  var atRz = 0; addEventListener("resize", function(){ if(!atpop || !atpop.classList.contains("on")) return; clearTimeout(atRz); atRz = setTimeout(atRows, 150); });
  var atedit = E("atedit"); if(atedit) atedit.addEventListener("click", function(){ AT_EDIT = true; atFromGrant(); atShow(); });
  var atcancel = E("atcancel"); if(atcancel) atcancel.addEventListener("click", function(){
    if(AT.grant && AT_EDIT){ AT_EDIT = false; atFromGrant(); atShow(); return; }
    POP.close(atpop); });
  function atSend(msgs, btn, memo){
    if(!msgs.length || !window.__TX || !window.__WALLET) return;
    btn.disabled = true; btn.classList.add("busy");
    var n = window.__notify();
    window.__TX.sendDirect(window.__WALLET, msgs, memo || "", function(){})
    .then(function(){
      n.ok(); POP.close(atpop);
      atGrant().then(function(r){ if(!atKeep(r)) return; atLine(); var ab = E("atbtn"); if(ab) ab.classList.toggle("on", !!AT.grant); draw(); });
    })
    .catch(function(e){ n.fail(e && e.message || String(e)); })
    .then(function(){ btn.disabled = false; btn.classList.remove("busy"); });
  }
  /* Activate: with a move to make today, the Outcome card shows it and one approval signs the moves and the grant;
     with none, the grant alone is signed here. A standing grant being changed is never a move (operator, 2026-10-08) */
  var atgrant = E("atgrant"); if(atgrant) atgrant.addEventListener("click", function(){
    var pl = !AT.grant && !AT_EDIT && window.__planMoves ? window.__planMoves() : null;
    if(pl && window.__signMoves){ POP.close(atpop); window.__signMoves(pl, true); return; }
    atSend(atMsgs(), atgrant, atMemo());
  });
  /* revoke names every grant that stands (a revoke of one that does not fails the whole tx) */
  var atrevoke = E("atrevoke"); if(atrevoke) atrevoke.addEventListener("click", function(){
    /* Autopilot's own permission only: restake keeps its own switch */
    atSend([revokeMsg(REDEL)], atrevoke); });
  /* ── Restake, its own switch: the claim + delegate pair, for 12 months, capped at what the stake can earn, the
     delegate allow-list = the validators the reader stakes with (and Autopilot's list, when it runs). The keeper
     claims and stakes on the best-paying of them on its own (no admin step), every 12 hours, from 1 ATONE of rewards. ── */
  function rsOn(){ var g = AT.grants || []; return g.some(function(x){ return grantType(x) === DELEG; }) && g.some(function(x){ return grantType(x) === WDRAW; }); }
  function rsAllow(){
    var VD = window.__VDBY || {}, pos = window.__POS, out = {};
    (pos ? pos.rows : []).forEach(function(r){ var d = VD[r.id]; if(!r.inactive && d && d.op) out[d.op] = 1; });
    if(AT.grant) (((AT.grant.authorization || {}).allow_list || {}).address || []).forEach(function(op){ out[op] = 1; });
    return Object.keys(out);
  }
  function rsMsgs(on){
    if(!on){ var t = {}; (AT.grants || []).forEach(function(x){ var k = grantType(x); if(k === WDRAW || k === DELEG) t[k] = 1; });
      return Object.keys(t).map(function(k){ return revokeMsg(k); }); }
    /* no end date, no amount cap, and (operator, 2026-09-29) no validator list: the rewards are compounded into the
       highest-paying validator by the rule (the smallest first, never past the one above), not onto the reader's
       own. The delegate grant can only ever stake - never send or withdraw */
    if(!AT.addr) return [];
    var m = [{ type: "cosmos-sdk/MsgGrant", value: { granter: window.__ADDR, grantee: AT.addr, grant: { authorization: { type: "cosmos-sdk/GenericAuthorization", value: { msg: WDRAW } } } } },
             { type: "cosmos-sdk/MsgGrant", value: { granter: window.__ADDR, grantee: AT.addr, grant: { authorization: { type: "cosmos-sdk/StakeAuthorization", value: stakeAuth(1) } } } }];
    return m;
  }
  /* the Restake card's network fee (operator, 2026-10-01: as the Autopilot card has it): exactly what its button would
     sign - the two grants and any other restake service's revoke, or the revokes - simulated by the node */
  var rspop = E("rspop");
  window.__rsFee = function(){
    var el = E("rsfee"); if(!el) return;
    if(!AT.addr || !window.__ADDR){ feeSoon("rs"); el.textContent = ""; return; }
    var on = rsOn(), msgs = rsMsgs(!on); if(!msgs.length){ feeSoon("rs"); el.textContent = ""; return; }
    (on ? Promise.resolve([]) : otherRestake()).catch(function(){ return []; })
      .then(function(rv){ feeSoon("rs", el, function(){ return msgs.concat(rv); }); });
  };
  if(rspop) rspop.__onclose = function(){ feeSoon("rs"); };
  /* the Restake button acts at once: it reads what stands, builds the grant (or the revoke) and hands it to the wallet
     for approval - no card in between */
  var RS_BUSY = false;
  window.__rsToggle = function(btn){
    if(RS_BUSY || !window.__ADDR) return;
    var n = window.__notify();
    if(!window.__TX || !window.__canGrant()){ n.fail("Connect a wallet to turn on Restake"); return; }
    RS_BUSY = true; if(btn){ btn.disabled = true; btn.classList.add("busy"); }
    var done = false;
    return atStatus().then(function(){ return atGrant(); }).then(function(r){
      atKeep(r);
      if(!AT.addr) throw new Error("Restake opens once GATA's pilot is live");
      var on = rsOn(), msgs = rsMsgs(!on);
      if(!msgs.length) throw new Error(on ? "Nothing to disable" : "Stake with a validator first");
      return (on ? Promise.resolve([]) : otherRestake()).then(function(rv){
        return window.__TX.sendDirect(window.__WALLET, msgs.concat(rv), on ? "" : "GATA AtomOne Restake", function(){}); });
    })
      .then(function(){ n.ok(); done = true; return atGrant().then(function(r){ if(atKeep(r)){ draw(); if(window.__redraw) window.__redraw(); } }); })
      .catch(function(e){ n.fail(e && e.message || String(e)); })
      .then(function(){ RS_BUSY = false; if(btn){ btn.disabled = false; btn.classList.remove("busy"); } return done; });
  };
  /* the wallet's Autopilot line: inactive, or active with the grant's bounds; the door reads Set up / Manage */
  function atLine(){
    var row = E("wkap"), st = E("wkaps"), b = E("atbtn"); if(!row) return;
    var g = AT.grant, a = g && g.authorization || {};
    if(g){ var n = ((a.allow_list || {}).address || []).length, exp = g.expiration ? window.__dayFull(new Date(g.expiration).getTime()) : "no expiry";
      st.className = "wk-aps on"; st.textContent = "Active"; st.title = "until " + exp; if(b) b.textContent = "Revoke"; }
    else { st.className = "wk-aps"; st.textContent = "Inactive"; if(b) b.textContent = "Activate"; }
  }
  window.__atDoor = function(){
    var row = E("wkap"), b = E("atbtn"); if(!b || !row) return;
    /* another wallet (or none): what was read for the last one is dropped at once, so no
       screen shows its grant while this one's is being read */
    var who = window.__POS ? window.__ADDR : null;
    if(who !== AT.who){ AT.who = who; AT.grant = null; AT.grants = []; AT.report = null; ATSEL = {}; b.classList.remove("on"); if(atpop && atpop.classList.contains("on")) POP.close(atpop); }
    if(!who){ row.hidden = true; return; }
    /* the line shows for every connected wallet; while the keeper has no address yet the
       card reads Inactive and Grant stays disabled */
    row.hidden = false; atLine();
    /* the grant and the keeper's report together: the Autopilot screen shows when it last
       checked and what it moved without the card having been opened */
    atStatus().then(function(){ atLine(); if(AT.addr && AT.who === who) Promise.all([atGrant(), atReport()]).then(function(x){
      if(AT.who !== who || !atKeep(x[0])) return; AT.report = x[1]; b.classList.toggle("on", !!AT.grant); atLine(); draw(); }); });
  };

  /* the bells on the two cards: every validator the transaction lands on */
  function alertList(ids){
    var VD = window.__VDBY || {}, out = [], seen = {};
    ids.forEach(function(id){ var d = VD[id]; if(!d || !d.chex || seen[id]) return; seen[id] = 1; out.push({ id: d.id, m: d.m, chex: d.chex, av: d.av, vid: d.vid }); });
    return out;
  }
  var txbell = E("txbell"); if(txbell) txbell.addEventListener("click", function(){ if(window.__alertMany) window.__alertMany(alertList(MSGS.map(function(m){ return m.to; }))); });
  var stbell = E("stbell"); if(stbell) stbell.addEventListener("click", function(){ if(window.__alertMany) window.__alertMany(alertList(Object.keys(STSEL))); });
  var spbell = E("spbell"); if(spbell) spbell.addEventListener("click", function(){ if(window.__alertMany && window.__spIds) window.__alertMany(alertList(window.__spIds())); });
  if(!window.__BOT){ if(txbell) txbell.hidden = true; if(stbell) stbell.hidden = true; if(spbell) spbell.hidden = true; }

  /* The simple view's one question: what would the best placement of everything
     that can move be worth? Answered by the same machinery the pane uses - the
     optimiser picks, the ticks split the amount, the moves panel prices each
     chunk from the rate it leaves to the rate it lands on. With apply=false the
     reader's own selection and amount are put back untouched. */
  /* one validator's stake, moved to the best places: the inactive card's Redelegate. The same machinery as the
     simple view's plan, with the budget that validator's free stake and that validator taken first; answers
     whether there are moves to sign */
  window.__optFrom = function(id){
    var pos = window.__POS, row = null, k;
    if(pos) pos.rows.forEach(function(x){ if(x.id === id) row = x; });
    var B = row ? row.x - row.locked : 0;
    if(!(B > 0)) return false;
    window.__SRCFIRST = id;
    var r = window.__planWith(B, { cleanRecord: CLEAN, maxVals: 10 });
    if(!r.moves.length){ window.__SRCFIRST = null; return false; }
    for(k in SEL) delete SEL[k];
    r.moves.forEach(function(m){ SEL[m.id] = 1; });
    for(k in SRCSEL) delete SRCSEL[k]; SRCSEL[id] = 1;          /* the ticks say where the amount comes from */
    amt.value = exact(B);
    QUIET = true; draw(); QUIET = false;
    return MSGS.length > 0;
  };
  /* THE RULE (operator, 2026-09-29), with the shelf rise (2026-10-01): the page's copy of keeper.py plan() and fill() -
     the same arithmetic, so the move Your move offers is the move Autopilot would make. Water poured from the lowest
     step: the smallest validator (the last EDGE left out) rises first, to STEP (300 ATONE) under the one ranked above it; then
     the two rise together, and the shelf takes the next validator up as it reaches it. Nobody passes the one above;
     the largest fifth never take stake. A source may give all the free stake and fall in rank, never below the top of
     the shelf (operator, 2026-10-01); stake on the smallest 34% never moves out; at most MAXMOVES moves (move less rather than cut); nothing while
     any of the wallet's stake is cooling down. Answers null or { now, after, gain, moves, msgs:[{from,to,amt}] }. */
  var EDGE = 3, GAP = 1e6, STEP = 300e6, MAXMOVES = 60, MIN_LIFT = 0.05;   /* keeper.py EDGE, GAP, STEP, MAX_MOVES_DAY */
  /* keeper.py top(n) and bottom(n): the largest fifth never take stake, the smallest 34% never give (20 and 34 of 100) */
  function topN(n){ return Math.floor(n / 5); }
  function bottomN(n){ return Math.floor((n * 34 + 50) / 100); }
  /* keeper.py fill(): {op: added}; s[j] the stake as it stands, ok(j) whether rank j+1 may take any. One that may not is
     a fixed step: the shelf below it rises to STEP (300 ATONE, the room Restake stakes into) under it, then the pour
     carries on above it */
  function shelfFill(V, s, amount, ok){
    var n = V.length, add = {}, left = Math.floor(amount), i = n - 1 - EDGE, j, TOP = topN(n);
    while(i >= TOP && left >= GAP){
      if(!ok(i)){ i--; continue; }
      var b0 = i;
      while(i - 1 >= TOP && ok(i - 1)) i--;
      var k0 = i; i--;
      var cost = function(k, L){ var c = 0; for(var q = k; q <= b0; q++) c += Math.max(0, L - (q - k) * STEP - s[q]); return c; };
      var k = b0, lmax;
      for(;;){ lmax = s[k - 1] - STEP; if(cost(k, lmax) >= left || k === k0) break; k--; }
      var hi = lmax, lo = Math.min(s[k], hi);
      if(cost(k, hi) <= left) lo = hi;
      else while(lo < hi){ var mid = Math.floor((lo + hi + 1) / 2); if(cost(k, mid) <= left) lo = mid; else hi = mid - 1; }
      for(j = k; j <= b0; j++){ var x = lo - (j - k) * STEP - s[j]; if(x > 0){ add[V[j][3]] = x; left -= x; } }
    }
    Object.keys(add).forEach(function(op){ if(add[op] < 1e6) delete add[op]; });
    return add;
  }
  window.__shelfFill = shelfFill;
  /* validators the build's own list keeps out of a strategy's destinations: stake already there is left alone and may
     still be moved off, they simply take nothing new */
  function noStake(id){ var L = (window.__D && window.__D.nostake) || []; return L.indexOf(id) >= 0; }
  window.__noStake = noStake;
  /* the ranks the shelf may pour into (0-based, smallest first): the last EDGE left out, never the largest fifth */
  window.__shelfZone = function(n){ var o = []; for(var i = n - 1 - EDGE; i >= topN(n); i--) o.push(i); return o; };
  window.__planRank = function(pos){
    if(!pos || !pos.rows.length || !(pos.total > 0)) return null;
    /* stake in its 21-day cooldown stays where it is; the free stake is hunted, all of it at once */
    var V = window.__VALS().slice().sort(function(a, b){ return b[1] - a[1]; }), n = V.length;
    if(!n) return null;
    var at = {}, i; for(i = 0; i < n; i++) at[V[i][3]] = i;
    var bset = {}; for(i = Math.max(0, n - bottomN(n)); i < n; i++) bset[V[i][3]] = 1;
    var now = pos.rows.reduce(function(s, r){ return s + r.x * (r.inactive ? 0 : r.rate); }, 0) / pos.total;
    /* sources in the keeper's order: the most free stake first */
    /* all the free stake may go: the floor (never below the shelf) is set in the rounds, once the shelf is known */
    var src = pos.rows.filter(function(r){ return r.x - r.locked > 0 && !bset[r.id]; }).sort(function(a, b){ return (b.x - b.locked) - (a.x - a.locked); }).map(function(r){
      return { id: r.id, give: Math.floor(r.x - r.locked), rate: r.inactive ? 0 : r.rate };
    }).filter(function(x){ return x.give >= 1e6; });
    if(!src.length) return null;
    var rs = {}; src.forEach(function(x){ rs[x.id] = x.rate; });
    var used = {}; (window.__REDS || []).forEach(function(rr){
      var k = rr.redelegation.validator_src_address + ">" + rr.redelegation.validator_dst_address;
      used[k] = (used[k] || 0) + (rr.entries || []).length; });
    var dstRates = function(ms){ var mv = {}, r = {}; ms.forEach(function(m){ mv[m.to] = (mv[m.to] || 0) + m.amt; });
      Object.keys(mv).forEach(function(k){ var v = V[at[k]]; r[k] = window.__rateAfter(v[1], v[2], mv[k]); }); return { moved: mv, rd: r }; };
    function movesFor(srcs, amount, Vn, s, ok){
      var add = shelfFill(Vn, s, amount, ok), out = [], short = {}, si = 0, lf = srcs.map(function(x){ return { id: x.id, give: x.give }; });
      var an = {}; Vn.forEach(function(v, q){ an[v[3]] = q; });
      Object.keys(add).sort(function(a, b){ return an[b] - an[a]; }).forEach(function(d){
        var need = add[d];
        while(need > 0 && si < lf.length){
          var sx = lf[si], x = Math.min(need, sx.give);
          if((used[sx.id + ">" + d] || 0) < 7) out.push({ from: sx.id, to: d, amt: Math.floor(x) });
          else short[d] = 1;
          sx.give -= x; need -= x;
          if(sx.give <= 0) si++;
        }
      });
      return { out: out, short: Object.keys(short) };
    }
    /* settled in rounds, as the keeper: a destination a full pair would leave short, or one too poor for even the
       best-placed source, becomes a fixed step; a source the shelf cannot lift by more than 5 points stays put */
    var fixed = {}, out = [], done = false;
    for(var round = 0, rmax = 4 * n + 4 * src.length + 10; round < rmax && src.length; round++){
      var budget = src.reduce(function(s, x){ return s + x.give; }, 0), gone = {};
      src.forEach(function(x){ gone[x.id] = x.give; });     /* the cautious bound: every source counted as gone */
      /* the set as it stands once the sources have given: a source that falls in rank is placed where it falls
         (a stable sort, as the keeper's) */
      var Vn = V.map(function(v, q){ return [v, q]; }).sort(function(a, b){
        var d = (b[0][1] - (gone[b[0][3]] || 0)) - (a[0][1] - (gone[a[0][3]] || 0)); return d || a[1] - b[1]; }).map(function(x){ return x[0]; });
      var s = Vn.map(function(v){ return v[1] - (gone[v[3]] || 0); });
      var ok = function(j){ return !fixed[Vn[j][3]] && !gone[Vn[j][3]]; };     /* any validator of the active set (operator, 2026-09-30) */
      var r = movesFor(src, budget, Vn, s, ok);
      while(r.out.length > MAXMOVES && budget > 1e6){ budget = Math.floor(budget * 0.85); r = movesFor(src, budget, Vn, s, ok); }
      out = r.out;
      if(!out.length || out.length > MAXMOVES) return null;
      if(r.short.length){ r.short.forEach(function(d){ fixed[d] = 1; }); continue; }
      /* the floor: no source in the set ends below the shelf's top + 1 ATONE */
      var recv = {}, sent = {}, shelf = 0;
      out.forEach(function(m){ recv[m.to] = (recv[m.to] || 0) + m.amt; sent[m.from] = (sent[m.from] || 0) + m.amt; });
      Object.keys(recv).forEach(function(d){ shelf = Math.max(shelf, V[at[d]][1] + recv[d]); });
      var low = src.filter(function(x){ return at[x.id] != null && V[at[x.id]][1] - (sent[x.id] || 0) < shelf + GAP; });
      if(low.length){ low.forEach(function(x){ x.give = Math.max(0, Math.floor(V[at[x.id]][1] - shelf - GAP)); });
        src = src.filter(function(x){ return x.give >= 1e6; }); continue; }
      var rd = dstRates(out).rd, best = Math.min.apply(null, out.map(function(m){ return rs[m.from]; }));
      var weak = Object.keys(rd).filter(function(d){ return rd[d] - best <= MIN_LIFT; });
      if(weak.length){ weak.forEach(function(d){ fixed[d] = 1; }); continue; }
      var floor = Math.min.apply(null, Object.keys(rd).map(function(d){ return rd[d]; }));
      var high = src.filter(function(x){ return rs[x.id] >= floor - MIN_LIFT; });
      if(high.length){ var top = high.reduce(function(a, b){ return rs[b.id] > rs[a.id] ? b : a; });
        src = src.filter(function(x){ return x !== top; }); continue; }
      done = true; break;
    }
    if(!done) return null;
    /* a source's last piece under 1 ATONE is no move: the shelf it leaves short by less than the 1 ATONE gap keeps its order */
    out = out.filter(function(m){ return m.amt >= 1e6; });
    if(!out.length) return null;
    var D1 = dstRates(out), moved = D1.moved, rd = D1.rd;
    var gainU = 0; out.forEach(function(m){ gainU += m.amt * (rd[m.to] - rs[m.from]); });
    /* the rest of the wallet (operator, 2026-10-08), as keeper.py plan(): stake already on a destination earns its new,
       lower rate; stake that stays on a source earns its new, higher rate */
    var sentU = {}; out.forEach(function(m){ sentU[m.from] = (sentU[m.from] || 0) + m.amt; });
    pos.rows.forEach(function(r){ var v = V[at[r.id]]; if(!v || r.inactive) return;
      if(moved[r.id]) gainU += r.x * (rd[r.id] - r.rate);
      else if(sentU[r.id]) gainU += (r.x - sentU[r.id]) * (window.__rateAfter(v[1], v[2], -sentU[r.id]) - r.rate); });
    var after = now + gainU / pos.total, gain = gainU / 1e6, movedU = out.reduce(function(s, m){ return s + m.amt; }, 0), lift = gainU / movedU;
    /* only a move whose true gain is worth more than 5 APR points on the stake that moves (operator, 2026-09-30 / 10-08) */
    if(gain < 1 || !(lift > MIN_LIFT)) return null;
    /* the moved stake alone (operator, 2026-10-01): what it earns where it sits and where it lands - the numbers
       "The same N ATONE, from a to b" and the sign card speak of */
    var mnow = out.reduce(function(s, m){ return s + m.amt * rs[m.from]; }, 0) / movedU;
    var mafter = out.reduce(function(s, m){ return s + m.amt * rd[m.to]; }, 0) / movedU;
    return { now: now, after: after, gain: gain, lift: lift, mnow: mnow, mafter: mafter, moved: movedU, moves: out.length, msgs: out,
             picks: Object.keys(moved).map(function(k){ return { id: k, m: V[at[k]][0], x: moved[k] }; }) };
  };
  /* sign exactly these moves (the one screen's offer): the signing card lists them and prices them itself */
  /* withAuto: the one screen's Start Autopilot - the same moves plus the Autopilot grant, in ONE approval
     (direct signing carries the grant); the card says so and its button reads Start Autopilot */
  var TXAP = false;
  window.__signMoves = function(plan, withAuto){
    if(!plan || !plan.msgs || !plan.msgs.length || !window.__goSign) return;
    MSGS = plan.msgs.map(function(m){ return { from: m.from, to: m.to, amt: m.amt }; });
    /* the moved stake, as Autopilot measures it (operator, 2026-10-08) */
    window.__ANS = { now: plan.mnow != null ? plan.mnow : plan.now, after: plan.mafter != null ? plan.mafter : plan.after, gain: plan.gain };
    TXAP = !!withAuto && !!window.__atGrantMsg && !!window.__atGrantMsg() && window.__canGrant();
    window.__goSign();
  };
  function txAll(){ var m = txMsgs(); if(TXAP){ var g = window.__atGrantMsg(); if(g) m = m.concat([g]); } return m; }
  /* what stands between this reader and the keeper, for the simple view to state */
  window.__atInfo = function(){ return { addr: AT.addr, dry: AT.dry, grant: AT.grant, grants: AT.grants || [],
    days: AT.days, report: AT.report, since: AT.since || null,
    restake: (AT.grants || []).some(function(x){ return grantType(x) === DELEG; }) }; };
  window.__planDraw = draw;
  draw();

})();

/* ── wallet, read-only ────────────────────────────────────────────────────────
   No library. Keplr and Adena both inject an object, and everything needed to
   read a position is a REST call to our own node - so connecting costs the page
   nothing in dependencies, and signing (which does need proto encoding) stays a
   separate decision for later.

   Additive, never a gate: with no extension, no connection, or a failed fetch,
   the plan still answers the question for whatever amount is typed. */
(function(){
  var E = function(id){ return document.getElementById(id); };
  /* One door: the header's Connect button and its wallet list (simple.js draws them). This
     module connects, disconnects and reads the position. While it connects the header
     button says so; a failure is said once, in the page's failure notice. */
  var btn = E("svconn");
  function busy(on, name){ if(!btn) return; btn.disabled = !!on; btn.textContent = on ? "Connecting " + name + "\u2026" : "Connect wallet"; }
  function failed(why){ if(window.__notify) window.__notify().fail(why); }
  var NETC = (window.__D || {}).net || {};
  /* the network switch: this page's network lit, the other's link keeps the open view */
  (function(){
    var here = NETC.net === "testnet" ? "testnet" : "mainnet";
    document.documentElement.setAttribute("data-net", here);
    var m = document.getElementById("netmain"), t = document.getElementById("nettest"); if(!m || !t) return;
    m.dataset.to = here === "testnet" ? "../" : "./"; t.dataset.to = here === "testnet" ? "./" : "testnet/";
    m.href = m.dataset.to; t.href = t.dataset.to;
    (here === "testnet" ? t : m).setAttribute("aria-current", "page");
    /* the other network opens on the same view: its base plus the open route (a clean path since 2026-09-29) */
    [m, t].forEach(function(a){ a.addEventListener("click", function(){ if(a.getAttribute("aria-current")) return; a.href = a.dataset.to + (window.__shellPath ? window.__shellPath() : ""); }); });
  })();
  var API = NETC.api || "https://atomone-api.gatadao.com";
  var CHAIN = NETC.chain || "atomone-1";
  window.__API = API; window.__NET = NETC;

  var PHONE = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  /* Two wallets, one shape. Keplr resolves values; Adena's cosmos
     surface (v1.19+, AtomOne built in) resolves a {status, code, data}
     envelope, unwrapped here. On a phone only Keplr's in-app browser injects
     a wallet, so the choice is only offered where there is one to make. */
  function unwrapA(r){
    if(r && r.status === "success") return r.data;
    var m = (r && r.message) || "Adena refused";
    throw new Error(/reject/i.test(m) ? "Request rejected" : m);
  }
  function providers(){
    var out = [];
    if(window.keplr) out.push({ name: "Keplr", raw: window.keplr,
      enable: function(){ return enable(window.keplr); },
      getKey: function(){ return window.keplr.getKey(CHAIN); },
      /* preferNoSetFee: Keplr keeps the fee the page computed from the chain's live gas price; without it Keplr put its own
         (0.36 uphoton a gas on AtomOne, 36 times the chain's floor) in its place (2026-10-09) */
      signAmino: function(addr, doc){ return window.keplr.signAmino(CHAIN, addr, doc, { preferNoSetFee: true }); },
      /* SIGN_MODE_DIRECT: the account number travels as a Long-shaped object. Keplr's injected script turns it into
         text with toString() before signing - a plain {low, high} object became "[object Object]" and every direct
         signature (Autopilot grant, Restake, following a governor) failed on chain. toString gives the number. */
      signDirect: function(addr, doc){ var n = parseInt(doc.accountNumber, 10);
        return window.keplr.signDirect(CHAIN, addr, { bodyBytes: doc.bodyBytes, authInfoBytes: doc.authInfoBytes, chainId: doc.chainId,
          accountNumber: { low: n % 4294967296, high: Math.floor(n / 4294967296), unsigned: true, toString: function(){ return String(n); } } }, { preferNoSetFee: true }); } });
    if(window.adena && window.adena.cosmos) out.push({ name: "Adena", raw: window.adena.cosmos,
      enable: function(){ return window.adena.cosmos.enable(CHAIN).then(unwrapA); },
      getKey: function(){ return window.adena.cosmos.getKey(CHAIN).then(unwrapA); },
      signAmino: function(addr, doc){ return window.adena.cosmos.signAmino(CHAIN, addr, doc).then(unwrapA); } });
    return out;
  }
  var CHOSEN = null;
  function wallet(){
    var ps = providers(); if(!ps.length) return null;
    if(CHOSEN){ for(var i = 0; i < ps.length; i++) if(ps[i].name === CHOSEN) return ps[i]; }
    return ps[0];
  }
  /* a wallet that has never seen AtomOne is told about it - our own endpoints,
     the chain's real fee tokens (fees are paid in PHOTON; ATONE fees are only
     accepted for minting PHOTON) */
  var CHAIN_INFO = {
    chainId: CHAIN, chainName: NETC.name || "AtomOne",
    rpc: NETC.rpc || "https://atomone-rpc.gatadao.com", rest: API,
    bip44: { coinType: 118 },
    bech32Config: { bech32PrefixAccAddr: "atone", bech32PrefixAccPub: "atonepub",
      bech32PrefixValAddr: "atonevaloper", bech32PrefixValPub: "atonevaloperpub",
      bech32PrefixConsAddr: "atonevalcons", bech32PrefixConsPub: "atonevalconspub" },
    currencies: [{ coinDenom: "ATONE", coinMinimalDenom: "uatone", coinDecimals: 6 },
                 { coinDenom: "PHOTON", coinMinimalDenom: "uphoton", coinDecimals: 6 }],
    feeCurrencies: [{ coinDenom: "PHOTON", coinMinimalDenom: "uphoton", coinDecimals: 6,
                      gasPriceStep: { low: 0.01, average: 0.02, high: 0.05 } }],   /* x/dynamicfee floor 0.01 (2026-10-09) */
    stakeCurrency: { coinDenom: "ATONE", coinMinimalDenom: "uatone", coinDecimals: 6 },
    features: []
  };
  function enable(w){
    return w.enable(CHAIN).catch(function(e){
      if(w.experimentalSuggestChain && /chain|not (found|support)/i.test(e && e.message || ""))
        return w.experimentalSuggestChain(CHAIN_INFO).then(function(){ return w.enable(CHAIN); });
      throw e;
    });
  }

  function fmt(u){ return (Math.floor(u / 1e5) / 10).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }


  function get(path){
    return new Promise(function(res, rej){
      var x = new XMLHttpRequest();
      x.open("GET", API + path, true); x.timeout = 12000;
      x.onload = function(){
        if(x.status === 200){ try{ res(JSON.parse(x.responseText)); }catch(e){ rej(e); } }
        else rej(new Error("HTTP " + x.status));
      };
      x.onerror = x.ontimeout = function(){ rej(new Error("unreachable")); };
      x.send();
    });
  }

  /* what the reader earns today, blended across wherever their stake already is */
  function position(dels, reds){
    var V = window.__VALS(), by = {}, i, j;
    for(i = 0; i < V.length; i++) by[V[i][3]] = V[i];
    /* locked balance per destination, and when it frees */
    var lock = {};
    for(i = 0; i < (reds || []).length; i++){
      var r = reds[i], dst = r.redelegation.validator_dst_address;
      for(j = 0; j < (r.entries || []).length; j++){
        var e = r.entries[j];
        var t = new Date(e.redelegation_entry.completion_time).getTime();
        if(!(t > Date.now())) continue;              /* matured, just not swept */
        if(!lock[dst]) lock[dst] = { amt: 0, until: t };
        lock[dst].amt += parseInt(e.balance, 10);
        if(t > lock[dst].until) lock[dst].until = t;
      }
    }
    var total = 0, free = 0, weighted = 0, rows = [], until = 0;
    for(i = 0; i < dels.length; i++){
      var d = dels[i];
      var amt = parseInt(d.balance.amount, 10);
      var op = d.delegation.validator_address, v = by[op];   /* the id is the full operator (2026-10-01) */
      if(!(amt > 0)) continue;
      /* the chain refuses ANY redelegation out of a validator that still holds an
         unmatured redelegation in for this delegator (ErrTransitiveRedelegation),
         not just the amount that arrived - so the whole row is held */
      var L = lock[op], held = L ? amt : 0;
      /* a validator outside the active set (unbonded, jailed out, gone) earns nothing:
         that stake is still the reader's, shown as such, and the first to move */
      var rate = v ? window.__rateAfter(v[1], v[2], 0) : 0;   /* already in, no dilution */
      total += amt; free += (amt - held); weighted += amt * rate;
      if(L && L.until > until) until = L.until;
      rows.push({ id: op, op: op, m: v ? v[0] : (((window.__INACT || {})[op] || {}).m || "Inactive validator"), x: amt, rate: rate, locked: held, until: L ? L.until : 0, inactive: !v });
    }
    return { total: total, free: free, locked: total - free, until: until,
             rate: total ? weighted / total : 0, rows: rows };
  }
  /* the position's rates are read against the set as it is now, not as it was when the wallet was read: the
     stake and the model move every block, and "Your APR" must never quote a set the page no longer shows */
  window.__rerate = function(){
    var p = window.__POS; if(!p || !p.rows) return;
    var V = window.__VALS(), by = {}, i, w = 0, tot = 0;
    for(i = 0; i < V.length; i++) by[V[i][3]] = V[i];
    p.rows.forEach(function(r){ var v = by[r.id]; r.rate = v ? window.__rateAfter(v[1], v[2], 0) : 0; r.inactive = !v; w += r.x * r.rate; tot += r.x; });
    p.rate = tot ? w / tot : 0;
  };
  window.__when = when;
  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function day(ms){ var t = new Date(ms); return MON[t.getUTCMonth()] + " " + t.getUTCDate(); }
  function dayFull(ms){ var t = new Date(ms); return t.getUTCDate() + " " + MON[t.getUTCMonth()] + " " + t.getUTCFullYear(); }
  window.__day = day; window.__dayFull = dayFull;
  function when(ms){
    var d = Math.ceil((ms - Date.now()) / 86400000);
    return day(ms) + " (" + d + "d)";
  }

  /* the copy glyph: the clipboard, with the old selection route as the fallback;
     the check shows for a moment. It rides inside the address itself - the whole
     chip is the control, there is no second button beside it. */
  var COPYG = '<svg class=cp viewBox="0 0 24 24" aria-hidden=true><rect x="9" y="9" width="12" height="12" rx="2"/>' +
    '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
    '<svg class=ok viewBox="0 0 24 24" aria-hidden=true><path d="M4 12.5l5 5L20 6.5"/></svg>';
  var wcp = E("waddr"), wcpT = 0;
  if(wcp) wcp.addEventListener("click", function(){
    if(!window.__ADDR) return;
    copyText(window.__ADDR, function(){ wcp.classList.add("done"); wcp.title = "Copied"; clearTimeout(wcpT);
      wcpT = setTimeout(function(){ wcp.classList.remove("done"); wcp.title = "Copy address"; }, 1400); });
  });
  function disconnect(){
    CONN++; SEEN = null;
    if(window.__onPos){ var f0 = window.__onPos; window.__onPos = null; f0(); }
    window.__ADDR = null; window.__POS = null; window.__REDS = null; window.__MINE = null; window.__LOCKNOTE = "";
    window.__DELS = null; window.__WALLET = null; window.__BAL = null;
    window.__UNB = null; window.__REW = null; window.__REWBY = null; window.__POSAT = 0;
    CHOSEN = null;
    try{ localStorage.removeItem("th_wallet"); }catch(e){}
    document.documentElement.removeAttribute("data-wallet");
    var wa = E("waddr"); if(wa){ wa.hidden = true; wa.classList.remove("done"); }
    var ab0 = E("atbtn"); if(ab0) ab0.classList.remove("on"); var ap0 = E("wkap"); if(ap0) ap0.hidden = true;
    var rf0 = E("wrefresh"); if(rf0) rf0.hidden = true;
    busy(false);
    var wn = E("wname"); if(wn) wn.textContent = "Wallet";
    if(window.__atDoor) window.__atDoor();          /* no wallet: nothing of the last one's grant stays */
    if(window.__stReset) window.__stReset();        /* nor of a Stake card's picks */
    if(window.__spReset) window.__spReset();        /* nor of a Pilot move */
    if(window.__redraw) window.__redraw();
    if(window.__planDraw) window.__planDraw();
  }
  /* the header connects and disconnects through these, and nothing else does */
  window.__wconnect = function(name){ CHOSEN = name; connect(true); };
  window.__wdisconnect = disconnect;
  window.__wproviders = providers;
  /* Refresh: read the chain again for this address, on request only */
  window.__refreshPos = function(){
    if(!window.__ADDR || !window.__POS) return Promise.resolve();
    return new Promise(function(res){ window.__onPos = res; connect(true); });
  };

  /* one connection at a time: every connect (and a disconnect) takes a new ticket, and a read
     still in flight for an older ticket is dropped - a slow answer for the last account, or
     for a wallet since disconnected, must never land on the page */
  var CONN = 0, STALE = new Error("stale"), SEEN = null;
  function connect(chosen){
    var ps = providers(), w = null, tok;
    if(CHOSEN){ for(var i = 0; i < ps.length; i++) if(ps[i].name === CHOSEN) w = ps[i]; }
    if(!chosen && !w) return;
    if(!w){
      failed(PHONE ? "Open this page inside the Keplr app (Keplr, then Browser)." : (CHOSEN || "That wallet") + " is not installed in this browser.");
      CHOSEN = null;
      return;
    }
    busy(true, w.name);
    tok = ++CONN;
    function live(v){ if(tok !== CONN) throw STALE; return v; }
    w.enable()
      .then(function(){ live(); return w.getKey(); })
      .then(function(k){
        live();
        window.__ADDR = k.bech32Address;
        /* what the signing step needs: the wallet, the address, the public key */
        /* label: the account's own name as the wallet reports it (what the reader
           called it in Keplr/Adena); name: the provider, kept for the mark */
        /* Adena's API carries no account name (getKey: algo, pubKey, address; GetAccount: no
           name either), so an Adena account reads "My wallet" beside its address */
        /* a Ledger behind Keplr (getKey().isNanoLedger) signs only amino JSON: no signDirect, so tx.js sends every
           transaction, grants included, in SIGN_MODE_LEGACY_AMINO_JSON (see stakeAuth) */
        var ledger = !!k.isNanoLedger;
        window.__WALLET = { name: w.name, label: (k.name || "").trim() || (w.name === "Adena" ? "My wallet" : w.name), address: k.bech32Address, pubKey: k.pubKey,
                            ledger: ledger,
                            signAmino: function(doc){ return w.signAmino(k.bech32Address, doc); },
                            signDirect: w.signDirect && !ledger ? function(doc){ return w.signDirect(k.bech32Address, doc); } : null };
        return get("/cosmos/staking/v1beta1/delegations/" + k.bech32Address);
      })
      .then(function(d){
        live();
        window.__DELS = d.delegation_responses || [];
        /* Stake that ARRIVED by redelegation cannot leave again until its entry
           matures - the chain rejects it outright (ErrTransitiveRedelegation),
           not as a soft cooldown. 21 days. A plan built on locked stake is a plan
           that cannot be signed, so the lock has to be read before anything is
           recommended. */
        return get("/cosmos/staking/v1beta1/delegators/" + window.__ADDR + "/redelegations");
      })
      .then(function(rd){
        live();
        window.__REDS = rd.redelegation_responses || [];
        return get("/cosmos/staking/v1beta1/delegators/" + window.__ADDR + "/unbonding_delegations").catch(function(){ return {}; });
      })
      .then(function(ub){
        live();
        var V = window.__VALS(), by = {}, i; for(i = 0; i < V.length; i++) by[V[i][3]] = V[i][0];
        window.__UNB = [];
        (ub.unbonding_responses || []).forEach(function(u){
          (u.entries || []).forEach(function(e){
            window.__UNB.push({ m: by[u.validator_address] || u.validator_address.slice(-6),
                                amt: parseInt(e.balance, 10), until: new Date(e.completion_time).getTime() }); }); });
        return get("/cosmos/distribution/v1beta1/delegators/" + window.__ADDR + "/rewards").catch(function(){ return {}; });
      })
      .then(function(rw){
        live();
        var tot = 0; ((rw && rw.total) || []).forEach(function(c){ if(c.denom === "uatone") tot += parseFloat(c.amount); });
        window.__REW = rw && rw.total ? tot : null;
        /* and per validator, for the ledger */
        window.__REWBY = {};
        ((rw && rw.rewards) || []).forEach(function(r){ var s = 0; (r.reward || []).forEach(function(c){ if(c.denom === "uatone") s += parseFloat(c.amount); });
          window.__REWBY[String(r.validator_address)] = s; });
        return get("/cosmos/bank/v1beta1/balances/" + window.__ADDR).catch(function(){ return {}; });
      })
      .then(function(bl){
        live();
        var fresh = SEEN !== window.__ADDR; SEEN = window.__ADDR;
        window.__BAL = { uatone: 0, uphoton: 0 };
        (bl.balances || []).forEach(function(c){ if(c.denom in window.__BAL) window.__BAL[c.denom] = parseInt(c.amount, 10); });
        var rd = { redelegation_responses: window.__REDS };
        var p = position(window.__DELS, rd.redelegation_responses || []);
        window.__POSAT = Date.now();
        window.__POS = p;
        window.__MINE = {}; p.rows.forEach(function(x){ window.__MINE[x.id] = 1; });
        if(window.__redraw) window.__redraw();
        try{ localStorage.setItem("th_wallet", w.name); }catch(e){}
        document.documentElement.setAttribute("data-wallet", w.name);
        var rf1 = E("wrefresh"); if(rf1) rf1.hidden = false; busy(false);
        var acct = E("wk-acct");
        if(acct) acct.hidden = false;
        /* the name whole, and an eight-letter form with two dots for a phone */
        if(window.__atDoor) setTimeout(window.__atDoor, 0);
        var wn = E("wname"); if(wn){ var nm0 = String(window.__WALLET.label || ""), sh = nm0.length > 8 && nm0 !== "My wallet" ? nm0.slice(0, 8) + ".." : nm0;
          wn.innerHTML = '<span class=nf>' + att(nm0) + '</span><span class=ns>' + att(sh) + '</span>'; wn.title = nm0; }


        /* the plan runs on what can actually be signed, never on the total */
        var amt = E("amt");
        var wa = E("waddr"); if(wa){ wa.hidden = false;
          /* the short form, its prefix set apart; the copy glyph carries the whole */
          var pre = /^[a-z]+1/.exec(window.__ADDR); pre = pre ? pre[0] : "";
          /* the short form; a phone gets the prefix and the last four only */
          wa.innerHTML = "<em>" + att(pre) + "</em><span class=af>" + att(window.__ADDR.slice(pre.length, pre.length + 5)) + "\u2026" + att(window.__ADDR.slice(-6)) + "</span>" +
                         "<span class=ap>\u2026" + att(window.__ADDR.slice(-4)) + "</span>" + COPYG;
          wa.title = "Copy address"; }
        if(amt && p.free > 0){
          /* the field starts empty behind its placeholder for a new wallet; a refresh of the
             same one keeps what the reader typed */
          if(fresh) amt.value = "";
        } else if(amt && p.total > 0){
          /* every ATONE is mid-redelegation: a plan here could not be signed at
             all, so show the release date rather than a number nobody can act on */
          amt.value = "";
          window.__LOCKNOTE = "All <b>" + fmt(p.total) + "</b> is mid-redelegation and cannot " +
            "move again until <b>" + when(p.until) + "</b>. The chain rejects a second " +
            "redelegation outright - it is not a cooldown you can pay through.";
        }
        if(window.__planDraw) window.__planDraw();
        if(window.__onPos){ var f = window.__onPos; window.__onPos = null; f(); }
      })
      .catch(function(e){
        if(e === STALE) return;                        /* a newer connect, or a disconnect, owns the page now */
        if(window.__onPos){ var f2 = window.__onPos; window.__onPos = null; f2(); }
        if(!window.__POS){ window.__ADDR = null; window.__DELS = null; window.__REDS = null; }
        busy(false);
        /* a failure inside the page's own drawing surfaces here too: the console keeps the whole
           trace, and dev names the frame in the notice itself so it can be reported as seen */
        if(window.console) console.error("position read failed", e);
        var at = /^(dev-|127\.|localhost)/.test(location.hostname) && e && e.stack ? " at " + String(e.stack).split("\n").slice(1, 2).join("").trim().replace(/^at /, "").slice(0, 120) : "";
        failed(e && e.message === "Request rejected" ? "Rejected in the wallet."
               : "Could not read the position (" + (e && e.message || "error") + ")" + at + ".");
      });
  }


  /* a reader who connected before is reconnected on return - the wallet has
     already approved this site, so nothing pops up; the position is re-read */
  var again = false;
  try{ again = localStorage.getItem("th_wallet"); if(again === "1") again = "Keplr"; }catch(e){}
  if(again !== "Keplr" && again !== "Adena") again = null;
  if(again){
    CHOSEN = again;
    /* wait for THAT wallet, not for any wallet: Keplr injecting first must not
       make the page report Adena missing while Adena is still on its way */
    var tries = 0, wait = function(){
      var here = providers().some(function(p){ return p.name === CHOSEN; });
      if(here) connect(true); else if(++tries < 25) setTimeout(wait, 300); };
    setTimeout(wait, 200);
  }
  window.addEventListener("keplr_keystorechange", function(){ if(window.__ADDR) connect(true); });
  /* Adena tells of an account switch through its own On() (2026-10-17: the page went on signing as the account it had
     connected, which Adena refuses or the chain rejects); Keplr's keystore event above does the same for Keplr */
  var adenaOn = function(){ try{ if(window.adena && typeof window.adena.On === "function")
    window.adena.On("changedAccount", function(){ if(window.__ADDR && window.__WALLET && window.__WALLET.name === "Adena") connect(true); }); }catch(e){} };
  if(window.adena) adenaOn(); else window.addEventListener("load", adenaOn);
})();

/* ── the header's live strip (operator, 2026-10-17): a market-bar ticker of what Autopilot and Restake have done, from
   pilot/_status.json (never a wallet count), and later partners' news, as CoinGecko's top bar. It runs left on its own,
   stops while a pointer rests on it, and stands still with reduced motion. ON in production since 2026-10-17 (operator:
   "do it"); TICK_HOSTS lists the hosts it shows on, anywhere else it hides and fetches nothing. Its row is in the page
   from the first paint (the Live badge), so on phones and tablets, where it is a row of its own, nothing moves when
   the figures arrive. ── */
(function(){
  var TICK_HOSTS = /^(atomone\.gatahub\.zone|dev-atomone\.gatahub\.zone|127\.0\.0\.1|localhost)$/;
  var el = document.getElementById("hdrtick");
  if(!el) return;
  if(!TICK_HOSTS.test(location.hostname)){ el.hidden = true; return; }
  var nf = function(n){ return Math.round(n).toLocaleString("en-US"); };
  var I = function(d){ return '<svg viewBox="0 0 24 24" aria-hidden=true>' + d + '</svg>'; };
  var IC = {
    pilot: I('<path d="M12 3l7 18-7-4.5L5 21z"/>'),
    up: I('<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>'),
    re: I('<path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5"/>')
  };
  /* each item: icon, tone, then its parts in reading order - em a label, b a figure, span plain words (operator,
     2026-10-17: "Autopilot 563,637 ATONE moved", "+109,795 ATONE more a year, hands-free", Restake as ONE item) */
  function items(s){
    var i = s && s.impact, L = []; if(!i) return L;
    /* three items (operator, 2026-10-17): Autopilot and Restake as count, name, amount; the counts are runs that landed a
       transaction (the keeper's impact: txs = distinct move transactions, restakes = restake transactions), so a run
       that found nothing to do never counts */
    if(i.moved_uatone > 0) L.push(["pilot", "", [].concat(i.txs > 0 ? [["b", nf(i.txs)]] : [], [["em", "Autopilot moves"], ["b", nf(i.moved_uatone / 1e6) + " ATONE"]])]);
    if(i.gain_atone_year > 0) L.push(["up", "g", [["b", "+" + nf(i.gain_atone_year) + " ATONE"], ["span", "a year, hands-free"]]]);
    if(i.restakes > 0 || i.restaked_uatone > 0) L.push(["re", "g", [].concat(i.restakes > 0 ? [["b", nf(i.restakes)]] : [], [["em", "Restake"]],
      i.restaked_uatone > 0 ? [["b", nf(i.restaked_uatone / 1e6) + " ATONE"]] : [])]);
    return L;
  }
  function draw(L){
    if(!L.length){ el.hidden = true; return; }
    var key = JSON.stringify(L); if(el.__key === key) return; el.__key = key;
    var sep = '<i class=ht-sep aria-hidden=true></i>';
    var one = L.map(function(x){ return '<span class="ht-i' + (x[1] ? ' ' + x[1] : '') + '"><i class=ht-ic>' + IC[x[0]] + '</i>' +
      x[2].map(function(p){ return '<' + p[0] + '>' + p[1] + '</' + p[0] + '>'; }).join("") + '</span>'; }).join(sep) + sep;
    /* the set twice: the run slides one set's width and starts again where it began, with no seam */
    el.innerHTML = '<div class=ht-win><div class=ht-run><div class=ht-set>' + one + '</div><div class=ht-set aria-hidden=true>' + one + '</div></div></div>';
    el.hidden = false;
    var set = el.querySelector(".ht-set"), w = set ? set.getBoundingClientRect().width : 0;
    el.style.setProperty("--ht-dur", Math.max(24, w / 36).toFixed(1) + "s");     /* about 36 px a second, however long */
  }
  function load(){ fetch("pilot/_status.json", { cache: "no-store" }).then(function(r){ return r.ok ? r.json() : null; })
    .then(function(s){ draw(items(s)); }).catch(function(){}); }
  load(); setInterval(load, 10 * 60 * 1000);
})();
