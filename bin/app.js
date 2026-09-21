/* AtomOne app interactivity. Reads the JSON the renderer embedded, and then
   keeps the stake vector current from live.json - because every delegation moves
   a validator's rank AND its APR, and under the bonus it moves everyone else's
   too, since the bonus is one pool shared N ways. A page rebuilt every 15 minutes
   cannot answer "where should this go" while people are delegating.

   The embedded payload is still the whole page: if live.json never loads, nothing
   breaks and the page renders exactly as it did before. The live feed only
   overwrites the five numbers the model is a function of. */
/* ── popup stack: one owner for open and close. The card on top when another
   opens is its parent - hidden while the child shows, put back when the child
   closes - so Escape and a tap outside always step back ONE level, never
   straight home. A card opened from the page has no parent, so closing it
   lands on home. Every popup in the app goes through here; nothing toggles
   "on" by hand any more. */
var POP = (function(){
  var st = [];                                     /* [{el, from}] bottom -> top */
  function top(){ return st.length ? st[st.length - 1].el : null; }
  function open(el){
    if(!el) return;
    if(el === top() && el.classList.contains("on")) return;
    /* a stale entry (hidden by hand, e.g. a probe) is dropped with anything above it */
    for(var k = st.length - 1; k >= 0; k--) if(st[k].el === el){ st.splice(k); break; }
    var from = top();
    if(from && !from.classList.contains("on")) from = null;
    if(from) from.classList.remove("on");
    st.push({ el: el, from: from });
    el.classList.remove("back");
    el.classList.add("on");
  }
  function close(el){
    el = el || top(); if(!el) return;
    var i = -1;
    for(var k = st.length - 1; k >= 0; k--) if(st[k].el === el){ i = k; break; }
    if(i < 0){ el.classList.remove("on"); return; }
    var gone = st.splice(i);                         /* el and anything above it */
    gone.forEach(function(p){ p.el.classList.remove("on"); if(p.el.__onclose) p.el.__onclose(); });
    /* "back" keeps the entrance animation from replaying on the way back */
    if(gone[0].from) gone[0].from.classList.add("on", "back");
  }
  document.addEventListener("keydown", function(ev){
    if(ev.key !== "Escape" || !st.length) return;
    ev.preventDefault(); close(); });
  document.addEventListener("click", function(ev){
    var t = ev.target;
    if(t && t.classList && t.classList.contains("pop") && t === top()) close(t); });
  return { open: open, close: close, top: top };
})();
window.__POP = POP;
/* the node's RPC, proxied on this host (nginx: /rpc/status, /rpc/block) so the
   page never has to cross origins for a height */
/* every chain string that reaches innerHTML or an attribute goes through this */
function att(v){
  return String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;")
                  .replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
var LIVE_H = D.height || 0, LIVE_AT = 0;

/* ── concentration as a model input ────────────────────────────────────────
   eta and the bonded share are single numbers; concentration is a property of
   the whole distribution, so "what if it were 3x" means reshaping who holds
   what. Stake is moved between the top and bottom thirds - proportionally
   within each, so the order never changes - and the TOTAL is preserved, which
   keeps the average validator (and therefore the break-even point) fixed. The
   ADR's own group split is used: 33 / 33 / 34 at N=100. */
var CG = Math.floor(N/3), CGL = N - 2*CG, CTARGET = null;

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
  var t = VALS.map(function(v){ return v[1]; }), i, Hi = 0, Lo = 0;
  for(i = 0; i < CG; i++) Hi += t[i];
  for(i = N - CGL; i < N; i++) Lo += t[i];
  var A = Hi/CG - MEAN, B = Lo/CGL - MEAN, den = A - r*B;
  if(!den) return 1;
  var lam = MEAN*(r - 1)/den;
  /* never take a holding below zero: the smallest one sets the ceiling */
  var tmin = t[N-1];
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
  var Hi = 0, Lo = 0, i;
  for(i = 0; i < CG; i++) Hi += t[i];
  for(i = N - CGL; i < N; i++) Lo += t[i];
  return Lo ? (Hi/CG)/(Lo/CGL) : Infinity;
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
  var lo = s[Math.floor(s.length * 0.02)], hi = s[Math.ceil(s.length * 0.98) - 1];
  if(!(hi > lo)){ lo = s[0]; hi = s[s.length - 1]; }
  return [lo, hi - lo];
}
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
  if(MODE === "graph"){
    E("aprlo").textContent = (lo*100).toFixed(0) + "%";
    E("aprhi").textContent = (hi*100).toFixed(0) + "%";
    E("g2n").textContent = sp < 1e-9 ? "flat" : (hi/lo).toFixed(1) + "\u00d7";
    simple(e);
    return;
  }
  E("g2").classList.toggle("flat", !heat);
  E("g2").innerHTML = VALS.map(function(v,i){
    var u = byStake ? Math.pow(T[i]/maxT, .55)
                    : (rb[1] ? .08 + .92*Math.pow(Math.max(0, Math.min(1, (ys[i]-rb[0])/rb[1])), .55) : .5);
    /* .08 floor: the three largest sit at or under the 2nd-percentile clip and
       were painted the ramp's black end - invisible on the frame */
    var flat = heat ? ((sp < 1e-9) ? EVEN : null) : NEUT;
    return cell(i, u, ys[i]*100,
                v[0] + ' — ' + (byStake
                  ? (T[i]/D.set.bonded*100).toFixed(2) + '% of stake'
                  : (ys[i]*100).toFixed(1) + '% APR'), flat);
  }).join("");
  /* The stake-coloured grid is optional now: "% Stake" shows the same ranking on
     the one grid, so the second strip only renders if the page still has it. */
  var g1 = E("g1");
  if(g1) g1.innerHTML = VALS.map(function(v,i){
    return cell(i, Math.pow(T[i]/maxT,.55), ys[i]*100, v[0] + ' — tap for detail');
  }).join("");
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
  g.addEventListener("mouseover", function(ev){ var c = ev.target.closest(".cell"); if(c) show(c); });
  g.addEventListener("mouseleave", hide);
  g.addEventListener("focusin", function(ev){ var c = ev.target.closest(".cell"); if(c) show(c); });
  g.addEventListener("focusout", hide);
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
    var g = E("gwrap"), c = E("cwrap");
    if(g && c){
      var graph = MODE === "graph";
      /* measure BEFORE hiding: a display:none element reports zero height, and
         the chart needs that number to occupy the same space */
      if(graph) rememberGridH();
      g.style.display = graph ? "none" : "";
      c.style.display = graph ? "" : "none";
      /* hand the chart the grid's height as a hard number - flex will not give
         it back on its own, and a short chart drags the whole pane up */
      c.style.height = graph && gridH ? gridH + "px" : "";   /* the box, not the svg */
    }
    var ev = +E("eta").value / 100;
    fields(ev);
  });
});

/* trend */
(function(){
  /* Weekly on both sides of the bonus. Months could not resolve eight weeks of
     bonus - two points is one interval - and a measure that changes scale at the
     very line it is meant to test proves nothing. */
  var sm = window.innerWidth < 620;
  var T=D.weekly, W=sm?460:900, H=300,
      PL=sm?44:64, PR=sm?16:28, PT=sm?20:26, PB=sm?34:46;
  if(!T || T.length<2){ E("trend").innerHTML=""; return; }
  var vs=T.map(function(x){return x.top10;});
  var lo=Math.floor(Math.min.apply(null,vs))-1, hi=Math.ceil(Math.max.apply(null,vs))+1;
  var X=function(i){return PL+i/(T.length-1)*(W-PL-PR);};
  var Y=function(v){return PT+(1-(v-lo)/(hi-lo))*(H-PT-PB);};
  var s="",d="",bi=-1;
  T.forEach(function(x,i){ if(bi<0 && x.wk>=0) bi=i; });
  var step=Math.max(1,Math.ceil((hi-lo)/6));
  for(var g=lo+1;g<hi;g+=step) s+='<line x1="'+PL+'" y1="'+Y(g)+'" x2="'+(W-PR)+'" y2="'+Y(g)+
    '" stroke="#232342"/><text x="'+(PL-11)+'" y="'+(Y(g)+4)+'" text-anchor="end" font-size="11.5" fill="#6f6d94">'+g+'%</text>';
  var bx = bi>0 ? X(bi-0.5) : null;
  if(bx!==null){ s+='<rect x="'+bx+'" y="'+PT+'" width="'+(W-PR-bx)+'" height="'+(H-PT-PB)+'" fill="#ff4d1f12"/>'+
    '<line x1="'+bx+'" y1="'+PT+'" x2="'+bx+'" y2="'+(H-PB)+'" stroke="#ff4d1f" stroke-width="2"/>'+
    '<text x="'+(bx-10)+'" y="'+(PT+17)+'" font-size="12.5" fill="#ff4d1f" text-anchor="end">BONUS ON</text>'; }
  T.forEach(function(x,i){ d+=(i?"L":"M")+X(i).toFixed(1)+" "+Y(x.top10).toFixed(1); });
  s+='<path d="'+d+'" fill="none" stroke="#fff8dc" stroke-width="2.4"/>';
  /* every week is a point, but a label every week would be a smear - one in four,
     always including the first week of the bonus */
  var lab=Math.ceil(T.length/9);
  T.forEach(function(x,i){ var on=bi>=0&&i>=bi;
    s+='<circle cx="'+X(i).toFixed(1)+'" cy="'+Y(x.top10).toFixed(1)+'" r="'+(on?4.6:3.4)+
      '" fill="'+(on?"#ff4d1f":"#fff8dc")+'" stroke="#06060c" stroke-width="1.2"><title>'+
      x.date+", "+x.top10+"%, nakamoto "+x.nakamoto+'</title></circle>';
    if(i===bi || (i-bi)%lab===0)
      s+='<text x="'+X(i).toFixed(1)+'" y="'+(H-PB+23)+'" text-anchor="middle" font-size="10.5" fill="#6f6d94">'+
      x.date+'</text>'; });
  s+='<text x="'+PL+'" y="'+(PT+17)+'" font-size="12.5" fill="#a5a3c4">'+
    (sm?"10 LARGEST VALS":"10 LARGEST VALIDATORS")+'</text>';
  E("trend").setAttribute("viewBox","0 0 "+W+" "+H);
  E("trend").innerHTML=s;
})();

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
  H = Math.max(H, small ? 190 : 170);
  var L = small ? 44 : 62, Rr = small ? 14 : 24;
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
    s += '<line x1="' + L + '" y1="' + Y(gv) + '" x2="' + (W - Rr) + '" y2="' + Y(gv) +
         '" stroke="#232342"/><text x="' + (L - 8) + '" y="' + (Y(gv) + FS * 0.36) +
         '" text-anchor="end" font-size="' + FS + '" fill="#6f6d94">' +
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
window.addEventListener("resize", function(){ placeKnob(); if(MODE!=="graph") rememberGridH(); if(MODE==="graph") simple(+sl.value/100); });
sl.value = Math.round(D.eta.now*100);
bd.value = 0;   // 0 = follow the live ratio
/* ── the live vector ──────────────────────────────────────────────────────────
   Everything drawn here is a pure function of: each validator's stake, the bonded
   total, the validator count, the coefficient and the reward pool. So the fast
   path is not an API - it is those numbers, refreshed, and the same local model
   recomputing on top of them. 1.4KB gzipped against a 5.8s block. */
function applyLive(d){
  if(!d || !d.v || !d.s || !d.n) return false;
  if(d.h && d.h <= LIVE_H) return false;          /* never go backwards */
  var moved = false, i;
  for(i = 0; i < VALS.length; i++){
    var t = d.v[VALS[i][3]];
    if(typeof t === "number" && t !== VALS[i][1]){ VALS[i][1] = t; moved = true; }
  }
  /* A validator can leave or join the bonded set between rebuilds. Dropping one
     we no longer see is safe; adding one we have no moniker for is not, so that
     waits for the next full rebuild rather than inventing a row. */
  if(VALS.length !== d.n) moved = true;
  if(!moved && d.h === LIVE_H) return false;
  LIVE_H = d.h || LIVE_H; LIVE_AT = Date.now();
  /* rank is stake order, and stake just moved */
  VALS.sort(function(a, b){ return b[1] - a[1]; });
  S = d.s; N = d.n; R = d.r || R;
  MEAN = S / N; BASE = R / S;
  maxT = VALS[0][1];
  CG = Math.floor(N / 3); CGL = N - 2 * CG;
  LIVE_C = ratioOf(VALS.map(function(v){ return v[1]; }));
  return true;
}

window.__applyLive = applyLive;
/* the whole set again, from data.json: monikers, commissions, jailings, the lifetime
   record, and every detail the cards and the dashboard read - what the refresh button
   is for. The live tokens (the 6-second vector) are kept; a validator new to the set
   takes the build's figure until the next tick. */
function applyData(d){
  if(!d || !d.validators || !d.validators.length || !d.set) return false;
  var live = {}, i;
  for(i = 0; i < VALS.length; i++) live[VALS[i][3]] = VALS[i][1];
  var next = d.validators.map(function(v){
    var id = String(v.op).slice(-6);
    return [v.m, live[id] != null ? live[id] : v.t, v.c, id, v.jail || 0,
            v.life_n ? Math.round((1 - v.life_missed / v.life_n) * 100000) / 1000 : null];
  });
  VALS.length = 0; Array.prototype.push.apply(VALS, next);
  VALS.sort(function(a, b){ return b[1] - a[1]; });
  D.set = d.set; D.eta = d.eta || D.eta; D.vdetail = d.validators; D.generated = d.generated || D.generated;
  if(!LIVE_AT){ S = d.set.bonded; R = d.set.reward_pool; }     /* a live tick outranks the build */
  N = VALS.length; MEAN = S / N; BASE = R / S; maxT = VALS[0][1];
  CG = Math.floor(N / 3); CGL = N - 2 * CG;
  LIVE_C = ratioOf(VALS.map(function(v){ return v[1]; }));
  if(window.__setVD) window.__setVD(d.validators);
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
  Array.prototype.forEach.call(document.querySelectorAll(".chip"), function(b){
    if(b.dataset.c!==undefined)
      b.setAttribute("aria-pressed",
        (CTARGET === null ? +b.dataset.c === 0
                          : Math.abs(+b.dataset.c/100 - CTARGET) < 1e-9) ? "true" : "false"); });
  /* eta's accent follows the modelled concentration, so dragging C below the
     threshold flips the coefficient from rising to falling in front of you */
  var up = (CTARGET === null ? LIVE_C : CTARGET) >= THRESH;
  [E("qbtn"), document.querySelector(".echips")].forEach(function(n){
    if(!n) return;
    n.classList.toggle("rise", up); n.classList.toggle("fall", !up); });
  /* same flag, inverted reading: green is the low-concentration side */
  [E("cbtn"), document.querySelector(".cchips")].forEach(function(n){
    if(n) n.classList.toggle("low", !up); });
  if(CTARGET === null && cr) cr.value = Math.round(LIVE_C * 100);   /* the handle rides the live tick */
  placeKnob();
  /* Show the ATONE that would be staked at the chosen ratio - the quantity the
     reader is actually moving. A "yields ÷2.00" multiplier described the effect but
     never named the cause. At the live setting this is the real staked figure. */
  var st = E("bstake");
  if(st) st.textContent =
    ((raw === 0 ? D.set.bonded : D.set.supply * pct / 100) / 1e12).toFixed(1) + "M";
  fields(e);
  window.dispatchEvent(new Event("thermo:redraw"));
  Array.prototype.forEach.call(document.querySelectorAll(".chip"), function(b){
    if(b.dataset.e!==undefined)
      b.setAttribute("aria-pressed", (+b.dataset.e===+sl.value)?"true":"false");
    if(b.dataset.b!==undefined)
      b.setAttribute("aria-pressed", (+b.dataset.b===+bd.value)?"true":"false"); }); }
window.__redraw = render;   /* redraws every derived figure from module state */
window.__S = function(){ return S; };
window.__ETA = function(){ return D.eta.now; };      /* the live coefficient, for the wallet's pricing */
window.__N = function(){ return N; };
window.__R = function(){ return R; };
window.__VALS = function(){ return VALS; };
window.__LIVEH = function(){ return LIVE_H; };
window.__LIVEAT = function(){ return LIVE_AT; };
/* the height under the name, on every tick */
(function(){
  function tick(){ var e = document.getElementById("dlive"); if(e && LIVE_H) e.querySelector("b").textContent = LIVE_H.toLocaleString(); }
  window.addEventListener("thermo:live", tick); tick();
})();

sl.addEventListener("input", render);
/* The track and the four buttons write the same hidden field, so neither can get
   out of step with the other. data-b=0 still means "follow the live ratio". */
var br = E("bondr");
if(br){
  br.value = Math.round(LIVE_BONDED);
  br.addEventListener("input", function(){ bd.value = (+br.value === Math.round(LIVE_BONDED)) ? 0 : br.value; render(); });
}
/* the concentration track carries hundredths of a multiple, so 1041 is 10.41x */
var THRESH = +D.thresh || 3;
var cr = E("concr"), LIVE_C = ratioOf(VALS.map(function(v){ return v[1]; }));
if(cr){
  cr.value = Math.round(LIVE_C * 100);
  cr.addEventListener("input", function(){
    CTARGET = +cr.value / 100;
    render();
  });
}
if(bd.addEventListener) bd.addEventListener("input", render);
/* ── the what-if strip ───────────────────────────────────────────────────────
   No chips: every value is on the track. A white tick marks the chain as it is
   (it moves with the live feed); a handle within one step of it snaps home. The
   strip, the readouts and the Reset button turn amber while any handle is away
   from live, so a hypothetical is never mistaken for the chain. Each row's
   reset, or a release within a step of live, brings it home. */
function tickAt(inp, tick, v){
  if(!inp || !tick) return;
  var w = inp.offsetWidth; if(!w) return;
  var t = (v - +inp.min) / (+inp.max - +inp.min || 1);
  tick.style.left = (KNOB_W / 2 + t * (w - KNOB_W)) + "px";
}
function liveOf(k){
  return k === "e" ? Math.round(D.eta.now * 100)
       : k === "c" ? Math.round(LIVE_C * 100) : Math.round(LIVE_BONDED);
}
function whatif(){
  var rows = { e: sl, c: cr, s: br }, dirty = false;
  Object.keys(rows).forEach(function(k){
    var inp = rows[k]; if(!inp) return;
    var live = liveOf(k), d = k === "c" ? CTARGET !== null : +inp.value !== live;
    if(k === "s") d = +bd.value !== 0;
    dirty = dirty || d;
    var row = inp.closest(".wrow"); if(row) row.classList.toggle("dirty", d);
  });
  document.documentElement.toggleAttribute("data-dirty", dirty);
  tickAt(sl, E("tke"), liveOf("e"));
  tickAt(cr, E("tkc"), liveOf("c"));
  tickAt(cr, E("tkt"), +(E("tkt") || {dataset:{}}).dataset.v || 0);
  tickAt(br, E("tks"), liveOf("s"));
}
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
window.addEventListener("resize", whatif);
render();
rememberGridH();

/* ── eta curve + clickable schedule ── */
(function(){
  var SC = D.schedule, ES = D.eta_stats;
  if(!SC || !SC.length) return;
  var sm = window.innerWidth < 620;
  var W=sm?460:900, H=300, PL=sm?40:58, PR=sm?14:26, PT=sm?22:30, PB=sm?36:48;
  var lo=0, hi=Math.max(ES.cap*0.22, Math.max.apply(null,SC.map(function(r){return r.eta;}))*1.9);
  var X=function(i){return PL+i/(SC.length-1)*(W-PL-PR);};
  var Y=function(v){return PT+(1-(v-lo)/(hi-lo))*(H-PT-PB);};
  var nowI=0; SC.forEach(function(r,i){ if(r.now) nowI=i; });
  var s="";
  for(var g=0;g<=4;g++){ var v=hi*g/4;
    s+='<line x1="'+PL+'" y1="'+Y(v)+'" x2="'+(W-PR)+'" y2="'+Y(v)+'" stroke="#232342"/>'+
       '<text x="'+(PL-10)+'" y="'+(Y(v)+4)+'" text-anchor="end" font-size="11" fill="#6f6d94">'+v.toFixed(2)+'</text>'; }
  s+='<line x1="'+PL+'" y1="'+Y(ES.floor)+'" x2="'+(W-PR)+'" y2="'+Y(ES.floor)+
     '" stroke="#6f66c8" stroke-width="1.5" stroke-dasharray="4 4"/>'+
     '<text x="'+(W-PR)+'" y="'+(Y(ES.floor)-7)+'" text-anchor="end" font-size="11" fill="#6f66c8">FLOOR '+ES.floor.toFixed(2)+'</text>';
  /* past solid, future dashed - projections must not look like history */
  var dp="",df="";
  SC.forEach(function(r,i){
    var pt=X(i).toFixed(1)+" "+Y(r.eta).toFixed(1);
    if(i<=nowI) dp+=(dp?"L":"M")+pt;
    if(i>=nowI) df+=(df?"L":"M")+pt; });
  s+='<path d="'+df+'" fill="none" stroke="#6f6d94" stroke-width="2" stroke-dasharray="5 4"/>';
  s+='<path d="'+dp+'" fill="none" stroke="#ffb02e" stroke-width="3"/>';
  s+='<line x1="'+X(nowI)+'" y1="'+PT+'" x2="'+X(nowI)+'" y2="'+(H-PB)+'" stroke="#ff4d1f" stroke-width="1.5"/>';
  s+='<text x="'+(X(nowI)+9)+'" y="'+(PT+15)+'" font-size="11.5" fill="#ff4d1f">TODAY</text>';
  SC.forEach(function(r,i){
    s+='<circle class="etapt" data-i="'+i+'" cx="'+X(i).toFixed(1)+'" cy="'+Y(r.eta).toFixed(1)+
       '" r="'+(r.now?6:4)+'" fill="'+(r.now?"#ff4d1f":i<nowI?"#ffb02e":"#6f6d94")+
       '" stroke="#06060c" stroke-width="1.5" style="cursor:pointer"><title>week '+r.week+
       ", "+r.date+", η "+r.eta.toFixed(2)+'</title></circle>';
    if(i%2===0) s+='<text x="'+X(i).toFixed(1)+'" y="'+(H-PB+21)+
       '" text-anchor="middle" font-size="10" fill="#6f6d94">'+r.date.split(" ")[0]+'</text>'; });
  E("etacurve").setAttribute("viewBox","0 0 "+W+" "+H);
  E("etacurve").innerHTML=s;

  /* popup */
  var pop=E("pop"), R=D.set.reward_pool, N=D.set.n;
  function show(i){
    var r=SC[i];
    E("popw").textContent=r.week;
    E("pope").textContent=r.eta.toFixed(2);
    E("popd").textContent=r.date;
    E("popp").textContent=(r.eta*100).toFixed(0)+"%";
    E("popb").textContent=((1-r.eta)*100).toFixed(0)+"%";
    E("popf").textContent=f(R*r.eta/N/1e6)+" ATONE / yr";
    /* the exact block the epoch opened on, from our own index - blank for the
       weeks the chain has not reached yet */
    E("popbk").textContent = r.height ? f(r.height) : "\u2014";
    POP.open(pop);
  }
  Array.prototype.forEach.call(document.querySelectorAll("tr.wk"), function(tr){
    var i=SC.findIndex(function(r){return String(r.week)===tr.dataset.w;});
    tr.addEventListener("click", function(){ show(i); });
    tr.addEventListener("keydown", function(ev){
      if(ev.key==="Enter"||ev.key===" "){ ev.preventDefault(); show(i); } });
  });
  Array.prototype.forEach.call(document.querySelectorAll(".etapt"), function(c){
    c.addEventListener("click", function(){ show(+c.dataset.i); }); });

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
     by the validator's own id (the last six of its operator address, the same
     key the live vector uses) so a stake crossing never opens the wrong card. */
  var VDBY = {}; VD.forEach(function(d){ if(d.op) VDBY[String(d.op).slice(-6)] = d; });
  window.__VDBY = VDBY;
  /* a refresh brings a new detail list: the same map, refilled, so every holder of it reads the new rows */
  window.__setVD = function(list){ VD = list || []; for(var k in VDBY) delete VDBY[k]; VD.forEach(function(d){ if(d.op) VDBY[String(d.op).slice(-6)] = d; }); };
  /* other sections open a card by the validator's id (the wallet's delegation rows) */
  window.__vshow = function(id){ for(var k = 0; k < VALS.length; k++) if(VALS[k][3] === id){ vshow(k); return true; } return false; };
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
    if(ve) ve.textContent = v.earn_avg ? (v.earn_avg*100).toFixed(1) + "%" : "\u2014";
    /* 10k blocks is the chain's OWN signing window - real uptime, the figure that
       decides jailing. The 30D/3M strips are a different measurement and say so:
       we index proposers, not commit signatures, so over longer spans the honest
       signal is whether the validator proposed anything that day. */
    E("uv10").textContent   = v.up.toFixed(2) + "%";
    E("uv30").textContent   = v.d30.toFixed(1) + "%";
    E("uv90").textContent   = v.d90.toFixed(1) + "%";
    /* Live, not a snapshot: this walks the most recent commits off the node the
       page is served from, the way a status page shows the last N pings. The
       daily series baked into the page cannot move between rebuilds. */
    pingStart(v.chex);
    E("fjoin").textContent  = v.joined ? dmy(v.joined) : "—";
    E("flast").textContent  = v.last_slash || "never";
    E("vprop").textContent  = f(v.prop);
    /* the note repeated what the map, the graph and the APR band already say */
    POP.open(vpop);
  }
  function zero(c){ return c === "0"; }
  /* One column per day, oldest to newest. A day the validator proposed nothing is
     drawn full height in burn - downtime should be the loudest thing in the strip,
     not the quietest. The newest column is today and therefore partial, which is
     why collect.py normalises it against the blocks actually produced so far. */
  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function dmy(iso){
    if(!iso) return "";
    var p = String(iso).split("-");
    return p.length === 3 ? (+p[2]) + " " + MON[+p[1] - 1] + " " + p[0] : iso;
  }
  function dayISO(i){
    if(!D.uptime_from) return "";
    return new Date(new Date(D.uptime_from + "T00:00:00Z").getTime() + i * 86400000)
             .toISOString().slice(0, 10);
  }
  function strip(el, str, lead){
    el.innerHTML = "";
    var off = D.uptime_days ? D.uptime_days - str.length : 0;
    for(var i = 0; i < str.length; i++){
      var d = +str[i], abs = i + off, b = document.createElement("b");
      b.style.height = d ? (22 + d / 9 * 78) + "%" : "100%";
      if(!d)                        b.className = abs < lead ? "n" : "z";
      else if(i === str.length - 1) b.className = "tip";
      b.title = dayISO(abs) + (d ? " — proposing"
                                 : abs < lead ? " — not in the active set" : " — no blocks proposed");
      el.appendChild(b);
    }
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
  function pingTick(){
    var addr = pingAddr;
    if(!addr || pingBusy) return;
    pingBusy = true;
    fetch("/rpc/status", { cache: "no-store" })
      .then(function(r){ return r.json(); })
      .then(function(j){
        var head = Number(j.result.sync_info.latest_block_height);
        var hs = [];
        for(var i = PING_N - 1; i >= 0; i--) hs.push(head - i);
        return Promise.all(hs.map(function(h){
          return fetch("/rpc/block?height=" + h, { cache: "no-store" })
            .then(function(r){ return r.json(); })
            .catch(function(){ return null; });
        }));
      })
      .then(function(blocks){
        if(pingAddr !== addr) return;            // card changed mid-flight
        var el = E("ubping"); if(!el) return;
        el.innerHTML = "";
        var top = "";
        blocks.forEach(function(b, k){
          var el2 = document.createElement("b");
          var lc = b && b.result && b.result.block && b.result.block.last_commit;
          var sigs = (lc && lc.signatures) || null;
          el2.style.height = "100%";
          if(!sigs){
            el2.className = "n";
            el2.title = "no commit";
          } else {
            var signed = false;
            for(var i = 0; i < sigs.length; i++){
              if(sigs[i].validator_address === addr && sigs[i].block_id_flag === 2){ signed = true; break; }
            }
            if(!signed) el2.className = "z";
            /* the newest column is marked so the strip visibly advances: every
               block signed looks identical otherwise, and a live view that never
               changes reads as a frozen picture */
            else if(k === blocks.length - 1) el2.className = "tip";
            if(lc.height) top = lc.height;
            el2.title = (lc.height || "") + (signed ? " — signed" : " — missed");
          }
          el.appendChild(el2);
        });
        var ph = E("pingh");
        if(ph && top) ph.textContent = "#" + Number(top).toLocaleString("en-US");
      })
      .catch(function(){ /* a missed poll leaves the last strip in place */ })
      .then(function(){ pingBusy = false; });
  }

  function vhide(){ POP.close(vpop); }
  vpop.__onclose = pingStop;                       /* however it closes, the poll stops */
  document.addEventListener("click", function(ev){
    var c = ev.target.closest ? ev.target.closest(".cell, tr.vrow") : null;
    if(c && c.dataset.v !== undefined) vshow(+c.dataset.v); });
  document.addEventListener("keydown", function(ev){
    if(ev.key!=="Enter" && ev.key!==" ") return;
    var c = document.activeElement;
    if(c && c.classList && c.classList.contains("cell")){ ev.preventDefault(); vshow(+c.dataset.v); } });

  E("qbtn").addEventListener("click", function(){ POP.open(qpop); });
  var spop = E("spop");
  if(spop) E("sbtn").addEventListener("click", function(){ POP.open(spop); });
  /* the C card explains what steers eta; opened from the page it stands alone,
     opened from the coefficient card it carries "fromq" (the way-back button) */
  var cpop = E("cpop"), cb = E("cbtn");
  if(cb && cpop) cb.addEventListener("click", function(){
    cpop.classList.remove("fromq"); POP.open(cpop); });

  /* the range handles are handles only: the row titles open the cards */
})();


/* The page is a static file rebuilt on a timer, so the height baked into it is
   as old as the last build. The node's RPC is the SAME ORIGIN as this page, so
   poll it and show the real head - a beating "live" dot beside a number that is
   twelve minutes stale is a lie. Everything else on the page stays as-built,
   which is what the dot below reports on. */
(function(){
  var el = E("hgt"); if(!el || !window.fetch) return;
  function tick(){
    fetch("/rpc/status", { cache: "no-store" })
      .then(function(r){ return r.json(); })
      .then(function(j){
        var h = j && j.result && j.result.sync_info &&
                j.result.sync_info.latest_block_height;
        if(h) el.textContent = Number(h).toLocaleString("en-US");
      })
      .catch(function(){ /* a missed poll just leaves the last good number */ });
  }
  tick();
  setInterval(tick, 10000);
})();

/* Live dot. Green and beating while the data is within one rebuild cycle; amber and
   still once it is not. A dot that is always green is decoration - this one is the
   same signal as the footer timestamp, which is what stops advancing if collect.py
   starts refusing to publish. */
(function(){
  var d = E("dot"), gen = D.generated;
  if(!d || !gen) return;
  function tick(){
    var age = (Date.now() - Date.parse(gen)) / 60000;      // minutes
    var stale = age > 20;                                   // 15 min cycle + 5 min cache
    d.className = "dot" + (stale ? " stale" : "");
    d.title = stale
      ? "data is " + Math.round(age) + " min old - the rebuild may have stopped"
      : "live - rebuilt " + Math.round(age) + " min ago";
  }
  tick(); setInterval(tick, 30000);
})();

})();

/* ── the page buttons ───────────────────────────────────────────────────────
   Four buttons in the title row; each swaps what fills the screen below. The
   selected one is stamped on <html> by a script in the head, so the right pane
   is up before the first paint rather than after this file runs. */
(function(){
  var bs = [].slice.call(document.querySelectorAll(".tabs .tabb[data-t]"));
  if(!bs.length) return;
  var ttl = document.getElementById("tsfx");
  function pick(k){
    document.documentElement.setAttribute("data-tab", k);
    /* the logo stays put; only the words beside it change */
    var b = bs.filter(function(x){ return x.dataset.t === k; })[0];
    if(ttl && b && b.dataset.title){
      ttl.textContent = b.dataset.title;
      if(b.dataset.acc) ttl.style.color = b.dataset.acc;
    }
    bs.forEach(function(b){
      var on = b.dataset.t === k;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    try{ localStorage.setItem("th_tab", k); }catch(e){}
  }
  bs.forEach(function(b){ b.addEventListener("click", function(){ pick(b.dataset.t); }); });
  /* Sections live on the index row: Staking, Governance, and My wallet -
     the reader's own wallet, delegations and strategy - which loads the whole
     window like any other section. Changing section: the window's content
     lifts away and the next falls in. The accent and the light travel. */
  var calc = document.getElementById("calc");
  var TITLES = { dele: ["Manage", "#9ed6f7"], gov: ["Governance", "#2bc8bd"], intro: ["AtomOne", "#e9eff7"] };
  var HOME = { home: 1, eta: 1, pays: 1 };
  var root = document.documentElement;
  function title(){
    var k = root.getAttribute("data-tab") || "home";
    if(TITLES[k] && ttl){ ttl.textContent = TITLES[k][0]; ttl.style.color = TITLES[k][1]; return; }
    var b = bs.filter(function(x){ return x.dataset.t === k; })[0];
    if(ttl && b && b.dataset.title){ ttl.textContent = b.dataset.title; if(b.dataset.acc) ttl.style.color = b.dataset.acc; }
  }
  function state(){
    var k = root.getAttribute("data-tab") || "home";
    /* the calculator pane's box, for the dashboard to take: the flipbox stays laid out
       (hidden, not gone) while the dashboard is open, so it can be read in every state */
    var fb = document.getElementById("flipbox");
    if(fb && fb.offsetHeight > 100){ root.style.setProperty("--calc-top", fb.offsetTop + "px"); root.style.setProperty("--calc-h", fb.offsetHeight + "px");
      try{ localStorage.setItem("th_calcbox", fb.offsetTop + "/" + fb.offsetHeight + "/" + innerWidth); }catch(e){} }
    var acc = "#ffb02e", well = document.getElementById("well");
    Array.prototype.forEach.call(document.querySelectorAll(".ftab[data-go]"), function(b){
      var g = b.dataset.go, on = g === "home" ? !!HOME[k] : g === k;
      b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false");
      if(on) acc = b.style.getPropertyValue("--acc") || acc; });
    if(well){ well.style.setProperty("--acc", acc); well.style.borderColor = acc + "66"; }
    /* the light glides under the open word */
    var ind = document.getElementById("ind"), onb = document.querySelector(".fnav .ftab.on");
    if(ind && !onb) ind.style.width = "0px";          /* the intro: no word is open */
    if(ind && onb){
      var fr = onb.parentNode.getBoundingClientRect(), br = onb.getBoundingClientRect();
      ind.style.left = (br.left - fr.left) + "px"; ind.style.width = br.width + "px";
      ind.style.setProperty("--acc", acc);
    }
    title();
  }
  function goSection(k){
    var cur = root.getAttribute("data-tab") || "home";
    if(cur === k) return;
    var after = function(){ pick(k); state(); if(k === "dele" && window.__planDraw) window.__planDraw(); };
    if(!calc || getComputedStyle(calc).transitionDuration === "0s"){ after(); return; }
    var done = false, finish = function(){
      if(done) return; done = true; calc.removeEventListener("transitionend", finish);
      after();
      calc.classList.remove("fade"); calc.classList.add("fadein"); void calc.offsetWidth; calc.classList.remove("fadein");
    };
    calc.addEventListener("transitionend", finish); setTimeout(finish, 260);
    calc.classList.add("fade");
  }
  /* Staking always opens on Bonus - the word is the section's front door, not
     a way back to whichever tab was open last */
  Array.prototype.forEach.call(document.querySelectorAll(".ftab[data-go]"), function(b){
    b.addEventListener("click", function(){ goSection(b.dataset.go); }); });
  /* the mark and the name: home */
  var brand = document.querySelector(".brand");
  if(brand){ brand.addEventListener("click", function(){ goSection("intro"); });
    brand.addEventListener("keydown", function(e){ if(e.key === "Enter" || e.key === " "){ e.preventDefault(); goSection("intro"); } }); }
  Array.prototype.forEach.call(document.querySelectorAll(".intro [data-go]"), function(b){
    b.addEventListener("click", function(){ goSection(b.dataset.go); }); });
  bs.forEach(function(b){ b.addEventListener("click", state); });
  state();
  window.addEventListener("resize", state);
  window.__flipTo = goSection;
  window.__pick = pick;
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
            return '<a href="' + att(u) + '" target=_blank rel="noopener noreferrer"' + (f ? '' : ' class=off') + '>Continue in Telegram, ' + a + '\u2013' + b + ' of ' + many.length + '</a>'; }).join("") +
            '<small>Telegram takes eight validators per link</small>'; }
        return;
      }
      if(more) more.hidden = true;
      var cur = window.__ACUR;
      btn.classList.toggle("off", !f || !cur);
      if(!f || !cur) { btn.removeAttribute("href"); return; }
      btn.href = "https://t.me/" + (window.__BOT || "")
               + "?start=v_" + cur.chex.slice(0, 8) + "_" + f;
      btn.lastChild.textContent = "Continue in Telegram";
    }
    /* the stake and redelegate cards open the same chooser for every validator they touch */
    window.__alertMany = function(list){
      if(!list || !list.length || !window.__BOT) return;
      window.__AMULTI = list; window.__ACUR = null;
      who.textContent = list.length === 1 ? list[0].m : list.length + " validators";
      var lg = document.getElementById("alogo"), mo = document.getElementById("amono"), am = document.getElementById("amany");
      if(lg) { lg.removeAttribute("src"); lg.style.display = "none"; }
      if(mo){ mo.style.display = "flex"; mo.style.background = "#1f1a3a"; mo.textContent = String(list.length); }
      if(am){ am.hidden = false; am.innerHTML = list.slice(0, 12).map(function(v){
          return '<span>' + (v.av ? '<img src="assets/val/' + att(v.id) + '.jpg" alt="">' : '<i style="background:' + (window.__tint || function(){ return "#334"; })(v.m || "") + '">' + att((v.m || "?").trim().slice(0, 1).toUpperCase()) + '</i>') + att(v.m) + '</span>'; }).join("") +
          (list.length > 12 ? '<span class=more>+' + (list.length - 12) + ' more</span>' : ''); }
      build();
      POP.open(pop);
    };
    pop.__onclose = function(){ window.__AMULTI = null; var am = document.getElementById("amany"); if(am){ am.hidden = true; am.innerHTML = ""; } };
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
          mo.style.background = tint(cur.m || "");
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
  var src = E("trend"), pop = E("gpop"), big = E("trendbig"), rst = E("gzreset");
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
  function open(){ big.innerHTML = src.innerHTML; reset(); POP.open(pop); }

  src.addEventListener("click", open);
  src.addEventListener("keydown", function(ev){
    if(ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); open(); } });
  if(rst) rst.addEventListener("click", reset);

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


/* ── the monochrome switch ────────────────────────────────────────────────────
   State lives on <html data-mono> and in localStorage; boot.js stamps it before
   the first paint so the page never flashes colour. Nothing else in the app has
   to know about it - the whole treatment is CSS. */
(function(){
  var b = document.getElementById("monob"), r = document.documentElement;
  if(!b) return;
  function paint(on){
    r.toggleAttribute("data-mono", on);
    b.setAttribute("aria-checked", on ? "true" : "false");
    b.title = on ? "Colour" : "Wireframe";
  }
  paint(r.hasAttribute("data-mono"));
  b.addEventListener("click", function(){
    var on = !r.hasAttribute("data-mono");
    paint(on);
    try{ localStorage.setItem("th_mono", on ? "1" : "0"); }catch(e){}
  });
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
        if(x.status === 200 && window.__applyLive(JSON.parse(x.responseText))){
          window.__redraw();
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
  window.addEventListener("thermo:live", function(){ if(document.documentElement.getAttribute("data-tab") === "dele") draw(); });
  /* the counter: seconds since the numbers were last read - the live tick or a
     refresh, whichever is later - ticking on its own while the wallet is open */
  var ago = E("dago");
  function tickAgo(){
    if(!ago || document.documentElement.getAttribute("data-tab") !== "dele") return;
    var at = Math.max(window.__LIVEAT ? window.__LIVEAT() : 0, window.__POSAT || 0);
    if(!at){ ago.textContent = "\u2014"; return; }
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
    var n = parseFloat((amt.value || "").replace(/[^0-9.]/g, ""));
    return isFinite(n) && n > 0 ? n : 0;
  }
  /* the whole amount, to the micro-ATONE, nothing rounded away: what "max" means */
  function exact(u, places){
    var w = Math.floor(u / 1e6), f = Math.round(u - w * 1e6), d = f ? ("000000" + f).slice(-6) : "";
    if(places != null) d = d.slice(0, places);           /* shown short, never rounded up */
    d = d.replace(/0+$/, "");
    return w.toLocaleString() + (d ? "." + d : "");
  }
  /* one decimal, floored: an amount on the page never reads as more than it is.
     Display only - what is signed is the exact micro-ATONE (see MSGS: Math.floor on uatone). */
  function one(a){ return (Math.floor(a * 10) / 10).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
  function fmt(u){
    return one(u / 1e6);
  }

  var LAST = {};
  window.__driftReset = function(){ LAST = {}; };
  function drift(id, after){
    var p = LAST[id]; LAST[id] = after;
    if(p === undefined) return "";
    var d = (after - p) * 100;
    if(Math.abs(d) < 0.02) return "";
    return '<span class="dr ' + (d < 0 ? "dn" : "up") + '">' +
           (d < 0 ? "\u25be" : "\u25b4") + Math.abs(d).toFixed(2) + '</span>';
  }

  function pct(x){ return (x * 100).toFixed(1) + "%"; }
  function yr(u, rate){ return one(u * rate / 1e6); }
  function rankOf(V, id){ for(var i = 0; i < V.length; i++) if(V[i][3] === id) return i + 1; return 0; }
  function rankAfter(V, id, t, x){ var n = 1; for(var i = 0; i < V.length; i++) if(V[i][3] !== id && V[i][1] > t + x) n++; return n; }
  function empty(t){ return '<div class=wk-empty>' + t + '</div>'; }
  function pill(cls, t){ return '<span class="wk-pl ' + cls + '">' + t + '</span>'; }
  function bar(share, cls){ return '<span class="wk-hb ' + (cls || "") + '"><i style="width:' + Math.max(1, Math.round(share * 100)) + '%"></i></span>'; }
  function nameOf(id){ var V = window.__VALS(); for(var i = 0; i < V.length; i++) if(V[i][3] === id) return V[i][0]; return id; }

  /* ── what the reader chooses: an amount, and which of five to keep ──
     The model proposes its best five destinations for the amount (the two
     smallest validators on the chain are left out HERE - a few thousand ATONE
     would double them, and the rate it advertises is one nobody keeps - while
     the calculator's own Picks still show them). The reader unticks any it
     does not want; the plan re-solves on what is ticked, and the growth figure
     follows every tick. */
  var SEL = {};                                    /* ids the reader has ticked */
  /* both tables are paged, never scrolled: a fixed number of rows a page */
  var LPS = 6, PPS = 6, PG = { l: 0, p: 0 };
  function pager(el, page, n, per, key){
    if(!el) return;
    var pages = Math.max(1, Math.ceil(n / per)); if(page >= pages) page = pages - 1; PG[key] = page;
    el.innerHTML = n > per ? '<button type=button data-d=-1' + (page === 0 ? ' disabled' : '') + '>\u2039</button><span>' + (page * per + 1) + '\u2013' + Math.min(n, (page + 1) * per) + ' of ' + n + '</span><button type=button data-d=1' + (page >= pages - 1 ? ' disabled' : '') + '>\u203a</button>' : '';
    Array.prototype.forEach.call(el.querySelectorAll("button"), function(b){ b.addEventListener("click", function(){ PG[key] = Math.max(0, Math.min(pages - 1, PG[key] + (+b.dataset.d))); draw(); }); });
    return page;
  }
  function padRows(h, have, per, cols){ for(var k = have; k < per; k++) h += '<tr class=pad><td colspan=' + cols + '></td></tr>'; return h; }
  var CLEAN = false;                               /* the never-jailed filter */
  function tail(){                                 /* the two smallest, by live stake */
    var V = window.__VALS(), x = {};
    if(V.length > 2){ x[V[V.length - 1][3]] = 1; x[V[V.length - 2][3]] = 1; }
    return x;
  }
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
    return window.__candidates({ except: {}, cleanRecord: CLEAN }).map(function(v){ v.rate0 = window.__rateAfter(v.t, v.c, 0); v.better = v.rate0 > low + 0.0005; return v; })
      /* with a wallet: best rate first; without one it is the chain's own list, by rank */
      .sort(function(a, b){ return pos ? b.rate0 - a.rate0 : a.rank - b.rank; });
  }
  function chosen(opt){                            /* those ticked */
    var only = {}, n = 0;
    opt.forEach(function(v){ if(SEL[v.id]){ only[v.id] = 1; n++; } });
    return { only: only, n: n };
  }
  function logo(id, name){
    var d = window.__VDBY && window.__VDBY[id];
    if(d && d.av) return '<img class=wk-lg src="assets/val/' + att(d.id) + '.jpg" alt="" loading=lazy>';
    var c = (name || "?").replace(/[^A-Za-z0-9]/g, "").charAt(0) || "?", h = 0;
    for(var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return '<span class="wk-lg wk-lgx" style="background:hsl(' + h + ',42%,30%)">' + c.toUpperCase() + '</span>';
  }

  /* ── the stat strip ── */
  function stats(pos){
    var st = E("ds-staked"), mv = E("ds-mov"), ph = E("ds-photon"), bl = E("ds-bal"), rw = E("ds-rew");
    if(!pos){ var mx0 = E("amtmax"); if(mx0) mx0.disabled = true; if(mv){ mv.textContent = "\u2014"; mv.className = ""; } var ln0 = E("dlockn"); if(ln0) ln0.hidden = true; return; }
    var b = window.__BAL;
    /* the tiles carry the whole figure, to the micro-ATONE */
    if(bl) bl.textContent = b ? exact(b.uatone) : "—";
    if(st) st.textContent = exact(pos.total);
    var mn = E("dminen"); if(mn) mn.textContent = pos.rows.length + " validator" + (pos.rows.length === 1 ? "" : "s");
    if(rw){ rw.textContent = window.__REW != null ? exact(window.__REW) : "—"; rw.className = window.__REW > 0 ? "ok" : ""; }
    if(mv){ mv.textContent = pos.free > 0 ? exact(pos.free, 2) : "0"; mv.title = pos.free > 0 ? exact(pos.free) + " ATONE can move" : "nothing can move until the cooldown ends"; mv.className = pos.free > 0 ? "" : "warn";
      var mxb = E("amtmax"); if(mxb) mxb.disabled = !(pos.free > 0); }
    var ap = E("ds-apr"); if(ap) ap.textContent = pos.rows.length ? pct(pos.rate) : "\u2014";
    if(ph){ ph.textContent = b ? exact(b.uphoton) : "—";
      ph.className = "pho" + (b && b.uphoton < 50000 ? " warn" : ""); }
  }

  /* ── the delegations, a page at a time ── */
  function myRows(pos, V){
    var pn = E("dmyn");
    if(!pos) return "";
    if(!pos.rows.length){ if(pn) pn.textContent = ""; pager(E("dmypg"), 0, 0, LPS, "l"); return empty("No stake on AtomOne"); }
    var rows = pos.rows.slice().sort(function(a, b){ return b.x - a.x; }), h = "", k;
    if(pn) pn.textContent = rows.length + " validator" + (rows.length === 1 ? "" : "s");
    var slice = rows; pager(E("dmypg"), 0, 0, LPS, "l");
    var LOCK = '<i class=lk><svg viewBox="0 0 24 24" aria-hidden=true><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></i>';
    var RB = window.__REWBY || {};
    h += '<table><colgroup><col style="width:30px"><col><col style="width:80px"><col style="width:50px"><col style="width:56px"></colgroup><thead><tr><th class=c>rank</th><th class=l>validator</th><th>ATONE</th><th>APR</th><th>rewards</th></tr></thead><tbody>';
    for(k = 0; k < slice.length; k++){
      var rw = slice[k], rk = rankOf(V, rw.id);
      h += '<tr data-v="' + att(rw.id) + '" tabindex=0 title="Open this validator"><td class="c rk">' + rk + '</td><td class="l nm">' + logo(rw.id, rw.m) + '<span>' + att(rw.m) + '</span></td>' +
           '<td class=amt><span title="' + (rw.locked > 0 ? 'held until ' + window.__day(rw.until) : 'free to move') + '">' + fmt(rw.x) + (rw.locked > 0 ? LOCK : '') + '</span></td>' +
           '<td>' + pct(rw.rate) + '</td><td class=rw>' + (RB[rw.id] != null ? fmt(RB[rw.id]) : '\u2014') + '</td></tr>';
    }
    return h + '</tbody></table>';
  }

  /* ── the list: every validator that would earn more, a page at a time; a
     tick builds the plan, a ticked row carries what it would get ── */
  function picks(opt, r, B, pos){
    var el = E("dpicks"), cap = E("dcap"); if(!el) return;
    var sel = chosen(opt);
    var now = pos ? pos.rate : 0;
    /* without a wallet the chip is invisible but keeps its slot, so the field and the
       button do not move when one connects */
    /* the line says only one thing, and only when it is true; otherwise it keeps its
       slot invisibly so the field and the button never move */
    /* the count line ("N validators earn a higher APR") is gone from the page; the rows
       say it themselves (a lower-paying row shows its rate in red) */
    if(cap) cap.hidden = true;
    var slice = opt;
    if(!opt.length){ el.innerHTML = ""; return; }
    var by = {}; r.moves.forEach(function(m){ by[m.id] = m; });
    /* the figures a delegator weighs: the validator's share of the set (green below the
       average size - where the bonus pays), its signing record over every block indexed,
       the last 90 days, blocks proposed, jailings; then what this stake gets and earns */
    var MEAN = window.__S() / window.__VALS().length;
    var wide = window.innerWidth > 1560 || window.innerWidth <= 900;   /* the two lifetime columns need a wide frame */
    /* the wallet's columns (tick, stake, now -> there) are laid out from the first paint for a
       reader who will be reconnected, with dashes until the position lands - so the list does
       not shift when it does */
    var lay = !!pos || expectWallet();
    var h = '<table><colgroup><col style="width:' + (lay ? 30 : 22) + 'px"><col style="width:36px"><col><col style="width:64px">' + (wide ? '<col style="width:70px">' : '') + '<col style="width:72px">' + (wide ? '<col style="width:64px">' : '') + '<col style="width:50px"><col style="width:' + (lay ? 104 : 60) + 'px"></colgroup>' +
            '<thead><tr><th class=ck>' + (pos ? '<input type=checkbox id=ckall aria-label="Tick every validator"' + (sel.n && sel.n === opt.length ? ' checked' : '') + '>' : '') + '</th><th class=c>rank</th><th class=l>validator</th>' +
            '<th title="the validator\'s stake; green below the average size, where the bonus pays">stake</th>' + (wide ? '<th title="blocks signed over every block indexed">signed</th>' : '') + '<th>90<span class=lc>d</span> uptime</th>' + (wide ? '<th title="blocks proposed">proposed</th>' : '') + '<th>jailed</th>' +
            '<th>' + (lay ? 'APR now → there' : 'APR') + '</th></tr></thead><tbody>';
    slice.forEach(function(o){
      var on = !!SEL[o.id], m = by[o.id], there = m ? m.after : o.rate0;
      var d = (window.__VDBY && window.__VDBY[o.id]) || {}, u90 = d.d90 != null ? +d.d90 : (o.up != null ? +o.up : null);
      var vp = o.t / window.__S() * 100, lu = d.life_up != null ? +d.life_up : null, pr = d.prop != null ? +d.prop : null;
      var mv = on && MOVED[o.id] > 0 ? MOVED[o.id] : null;
      /* what this plan adds sits at the right end of the name cell, against the stake
         column: it grows leftwards into the name's spare room, and no column moves */
      h += '<tr class="' + (on ? 'on' : '') + (pos && !o.better ? ' lt' : '') + '"><td class=ck>' + (pos ? '<input type=checkbox data-id="' + att(o.id) + '"' + (on ? ' checked' : '') + '>' : '') + '</td>' +
           '<td class="c rk">' + o.rank + '</td><td class="l nm" data-v="' + att(o.id) + '" tabindex=0 title="Open this validator"><div class=nmw>' + logo(o.id, o.m) + '<span>' + att(o.m) + '</span>' +
           (mv != null ? '<em class="gtag add" title="what this plan adds">+' + fmt(mv) + '</em>' : '') + '</div></td>' +
           '<td class="stk" title="' + big(o.t) + ' ATONE, ' + vp.toFixed(vp < 1 ? 2 : 1) + '% of all stake; ' + (o.t < MEAN ? 'below the average size: the bonus pays here' : 'above the average size') + '">' + big(o.t) + '</td>' +
           (wide ? '<td class="' + (lu == null ? 'dim' : lu >= 99.9 ? 'ok' : lu >= 99 ? 'warn' : 'bad') + '">' + (lu == null ? '\u2014' : lu.toFixed(2) + '%') + '</td>' : '') +
           '<td class="' + (u90 == null ? 'dim' : u90 >= 95 ? 'ok' : u90 >= 85 ? 'warn' : 'bad') + '">' + (u90 == null ? '\u2014' : u90.toFixed(1) + '%') + '</td>' +
           (wide ? '<td>' + (pr == null ? '\u2014' : pr >= 1e6 ? (pr / 1e6).toFixed(2) + 'M' : pr >= 1e3 ? (pr / 1e3).toFixed(1) + 'k' : pr) + '</td>' : '') +
           '<td class="' + (!o.jail ? '' : o.jail > 1 ? 'bad' : 'warn') + '">' + (o.jail ? o.jail : 'Never') + '</td>' +
           (lay ? '<td class=r2><s>' + (pos && pos.rows.length ? pct(now) : '\u2014') + '</s><em>→</em><b>' + pct(there) + '</b></td>' : '<td class=r2><b>' + pct(o.rate0) + '</b></td>') + '</tr>';
    });
    var top = el.scrollTop;
    el.innerHTML = h + '</tbody></table>'; el.scrollTop = top;
    Array.prototype.forEach.call(el.querySelectorAll("tbody input"), function(c){
      c.addEventListener("change", function(){ if(c.checked) SEL[c.dataset.id] = 1; else delete SEL[c.dataset.id]; window.__driftReset(); draw(); }); });
    /* the head's box ticks everyone, or clears everyone; half-ticked it shows as such */
    var all = E("ckall");
    if(all){ all.indeterminate = sel.n > 0 && sel.n < opt.length;
      all.addEventListener("change", function(){ SEL = {}; if(all.checked) opt.forEach(function(v){ SEL[v.id] = 1; }); window.__driftReset(); draw(); }); }
  }

  /* ── the answer: one strip - now → after, the gain, the count, the button ── */
  function result(pos, r, B, sel){
    var el = E("dans"); if(!el) return;
    var now = pos ? pos.rate : 0, after = null, gain = 0;
    /* the gain is the sum of the moves as the moves list priced them - each chunk from the
       rate it earns where it sits to the rate it earns where it lands (a loss is a loss);
       "after" is the position's blended rate with that gain in it */
    if(B > 0 && r.moves.length && pos && MSGS.length){
      var k; for(k in GAINBY) gain += GAINBY[k];
      after = pos.total > 0 ? pos.rate + gain * 1e6 / pos.total : r.rate;
    }
    window.__ANS = { now: now, after: after, gain: gain };
    el.innerHTML =
      '<span class="p rate"><i>now</i><b' + (pos && pos.rows.length ? '' : ' class=dim') + '>' + (pos && pos.rows.length ? pct(now) : '\u2014') + '</b><span class=arr>\u2192</span><i>after</i><b class="aft' + (after == null ? ' dim' : after < now - 0.0005 ? ' neg' : '') + '">' + (after == null ? '\u2014' : pct(after)) + '</b></span>' +
      '<span class="p gain"><i>ATONE/year</i><b' + (gain > 0.5 ? '' : gain < -0.5 ? ' class=neg' : ' class=dim') + '>' + (gain > 0.5 ? '+' + one(gain) : gain < -0.5 ? '\u2212' + one(-gain) : '\u2014') + '</b></span>' +
      /* the chain's own rule: what moves cannot move again for 21 days */
      '<span class="p lock" title="' + (MSGS.length ? 'until ' + window.__day(Date.now() + 21 * 86400000) : 'redelegated stake cannot be redelegated again for 21 days') + '"><i><svg viewBox="0 0 24 24" aria-hidden=true><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>redelegate</i><b>21 days</b></span>';
    /* the button lives in the stake row; here it only learns whether it can be pressed */
    var go = E("dgo"); if(go) go.disabled = !(pos && window.__WALLET && MSGS.length);
  }

  var MSGS = [];
  var GAINBY = {}, MOVED = {};
  function movesPanel(pos, V, r){
    MSGS = []; GAINBY = {}; MOVED = {};
    var h = "", used = {}, srcRate = {};
    (window.__REDS || []).forEach(function(rr){
      var key = rr.redelegation.validator_src_address.slice(-6) + ">" + rr.redelegation.validator_dst_address.slice(-6);
      used[key] = (used[key] || 0) + (rr.entries || []).length; });
    /* the stake leaves the positions that earn least first, largest of equals first */
    var src = pos ? pos.rows.map(function(x){ srcRate[x.id] = x.rate; return { id: x.id, m: x.m, rate: x.rate, free: x.x - x.locked }; }).filter(function(x){ return x.free > 0; })
                        .sort(function(a, b){ return (a.rate - b.rate) || (b.free - a.free); }) : [];
    if(!r.moves.length) return "";
    function nm(id, m){ return '<td class="l nm"><div class=nmw>' + logo(id, m) + '<span>' + att(m) + '</span></div></td>'; }
    function gainCell(g, left){
      return '<td class="gn' + (g > 0.5 ? '' : g < -0.5 ? ' neg' : ' dim') + '" title="ATONE a year">' + (g > 0.5 ? '+' + one(g) : g < -0.5 ? '\u2212' + one(-g) : '\u00b1 0') + (left <= 2 ? '<i>' + left + '/7</i>' : '') + '</td>';
    }
    r.moves.forEach(function(m){
      var need = m.x;
      src.forEach(function(sv){ if(sv.id === m.id && need > 0 && sv.free > 0){ var t = Math.min(sv.free, need); sv.free -= t; need -= t;
        h += '<tr class=stay>' + nm(m.id, m.m) + '<td class=ar></td><td class="l dim">already here</td><td class=amt>' + fmt(t) + '</td><td class="gn dim">\u2014</td></tr>'; } });
      src.forEach(function(sv){ if(need <= 0 || sv.free <= 0 || sv.id === m.id) return;
        var t = Math.min(sv.free, need), left = 7 - (used[sv.id + ">" + m.id] || 0); sv.free -= t; need -= t;
        MSGS.push({ from: sv.id, to: m.id, amt: Math.floor(t) });
        var was = srcRate[sv.id] || 0, gain = t * (m.after - was) / 1e6;
        GAINBY[m.id] = (GAINBY[m.id] || 0) + gain; MOVED[m.id] = (MOVED[m.id] || 0) + t;
        h += '<tr title="' + att(sv.m) + ' ' + pct(was) + ' \u2192 ' + att(m.m) + ' ' + pct(m.after) + '">' + nm(sv.id, sv.m) + '<td class=ar>\u2192</td>' + nm(m.id, m.m) +
             '<td class=amt>' + fmt(t) + '</td>' + gainCell(gain, left) + '</tr>'; });
    });
    if(!h) return "";                                /* ticks, but nothing that can move */
    return '<table><colgroup><col><col style="width:14px"><col><col style="width:66px"><col style="width:76px"></colgroup>' +
           '<thead><tr><th class=l>from</th><th></th><th class=l>to</th><th>stake</th><th>ATONE/yr</th></tr></thead><tbody>' + h + '</tbody></table>';
  }

  /* what a validator is, for the comparison: fee and 90-day record from the page's vector */
  function vinfo(id){
    var V = window.__VALS(), d = (window.__VDBY && window.__VDBY[id]) || {}, c = null;
    for(var i = 0; i < V.length; i++) if(V[i][3] === id){ c = V[i][2]; break; }
    return { c: c, d90: d.d90 != null ? +d.d90 : null, jail: d.jail || 0 };
  }
  /* one side of the pair: its own figures, each lit when it beats the other side */
  function vstats(rate, me, orate, other){
    var s = '<span class=vs>';
    s += '<em class="' + (rate > orate + 0.0005 ? 'up' : rate < orate - 0.0005 ? 'dn' : '') + '"><i>APR</i>' + pct(rate) + '</em>';
    if(me.c != null) s += '<em class="' + (other.c != null && me.c < other.c ? 'up' : other.c != null && me.c > other.c ? 'dn' : '') + '"><i>fee</i>' + Math.round(me.c * 100) + '%</em>';
    if(me.d90 != null) s += '<em class="' + (other.d90 != null && me.d90 > other.d90 ? 'up' : other.d90 != null && me.d90 < other.d90 ? 'dn' : '') + '"><i>90d</i>' + me.d90.toFixed(1) + '%</em>';
    return s + '</span>';
  }

  /* ── status pills at the foot ── */
  function statusFoot(pos, V){
    var el = E("dstat"); if(!el) return;
    if(!pos){ el.innerHTML = ""; var ub0 = E("unbtn"); if(ub0) ub0.hidden = true; var sb0 = E("stbtn"); if(sb0) sb0.hidden = true; return; }
    /* only what needs saying: stake that is held, stake on its way out */
    var h = "";
    /* the cooldown is said once, in the Redelegate title row, where the stake is asked for */
    var ln = E("dlockn"); if(ln){ ln.hidden = !(pos.locked > 0);
      if(pos.locked > 0){ ln.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden=true><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><b>' + fmt(pos.locked) + '</b><span class=w>ATONE under redelegate cooldown until</span><span class=w2>locked until</span><b>' + window.__dayFull(pos.until) + '</b>'; ln.title = "redelegated stake cannot be redelegated again for 21 days" + (pos.free > 0 ? "; the rest can move now" : "; nothing can move before then"); } }
    (window.__UNB || []).forEach(function(u){ h += pill("warn", fmt(u.amt) + " unbonding from " + att(u.m) + ", " + window.__day(u.until)); });
    el.innerHTML = h;
    var ub = E("unbtn"); if(ub) ub.hidden = !(pos && pos.rows.length);
    var sb = E("stbtn"); if(sb) sb.hidden = !pos;
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
      r.rate = earned / B;
    }
    stats(pos);
    var sk = E("dstack");
    if(sk){ sk.innerHTML = pos ? pos.rows.slice().sort(function(a, b){ return b.x - a.x; }).map(function(rw){
      var d = window.__VDBY && window.__VDBY[rw.id], hue = 0; for(var q = 0; q < rw.m.length; q++) hue = (hue * 31 + rw.m.charCodeAt(q)) % 360;
      return '<i class="' + (rw.locked > 0 ? 'hld' : '') + '" style="width:' + (rw.x / pos.total * 100).toFixed(2) + '%;background:hsl(' + hue + ',48%,52%)" title="' + att(rw.m) + ', ' + fmt(rw.x) + ' ATONE, ' + Math.round(rw.x / pos.total * 100) + '%"></i>'; }).join("") : ""; }
    var a = E("dmy"), c = E("dstrat");
    if(a) a.innerHTML = myRows(pos, V);
    var mv = movesPanel(pos, V, r);                /* first: the list shows each tick's gain */
    picks(opt, r, B, pos);
    if(c) c.innerHTML = mv;
    var mn = E("dmvn"); if(mn) mn.textContent = MSGS.length ? MSGS.length + (MSGS.length === 1 ? " move" : " moves") : "";
    var me = E("dmvempty"); if(me) me.hidden = !!MSGS.length;
    result(pos, r, B, sel.n);

    statusFoot(pos, V);

  }

  /* att() is the file-level escaper (defined beside POP) */

  amt.addEventListener("input", function(){ window.__driftReset(); draw(); });
  /* a delegation row opens its validator's card - the same card the map opens */
  var go0 = E("dgo"); if(go0) go0.addEventListener("click", function(){ if(window.__goSign) window.__goSign(); });
  var dmy = E("dmy");
  function rowCard(ev){
    var tr = ev.target.closest ? ev.target.closest("[data-v]") : null;
    if(!tr || !window.__vshow) return;
    if(ev.type === "keydown" && ev.key !== "Enter" && ev.key !== " ") return;
    ev.preventDefault(); window.__vshow(tr.getAttribute("data-v"));
  }
  if(dmy){ dmy.addEventListener("click", rowCard); dmy.addEventListener("keydown", rowCard); }
  /* the Redelegate list too: its name cells open the card, its boxes keep the tick */
  var dpk = E("dpicks"); if(dpk){ dpk.addEventListener("click", rowCard); dpk.addEventListener("keydown", rowCard); }
  /* max is what can actually move; with nothing free (all in cooldown) or no wallet it does nothing */
  var mx = E("amtmax"); if(mx) mx.addEventListener("click", function(){ var pos = window.__POS; if(!pos || !(pos.free > 0)) return; amt.value = exact(pos.free); window.__driftReset(); draw(); });
  /* amount presets: a share of what can move */
  Array.prototype.forEach.call(document.querySelectorAll("#amtseg button"), function(b){
    b.addEventListener("click", function(){
      var pos = window.__POS, base = pos && pos.free > 0 ? pos.free : 10000e6;
      amt.value = Math.floor(base * (+b.dataset.p) / 100 / 1e6).toLocaleString();
      Array.prototype.forEach.call(document.querySelectorAll("#amtseg button"), function(o){ o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
      window.__driftReset(); draw();
    });
  });

  /* ── the one click: confirm, sign, broadcast, refresh ── */
  var txpop = E("txpop");
  window.__txMsgs = function(){ return txMsgs(); };   /* the probes read what would be signed */
  function txMsgs(){
    var addr = window.__ADDR, VD = window.__VDBY || {};
    return MSGS.map(function(m){
      var s = VD[m.from], d = VD[m.to];
      if(!s || !d || !s.op || !d.op) return null;
      return { type: "cosmos-sdk/MsgBeginRedelegate", value: { delegator_address: addr, validator_src_address: s.op,
               validator_dst_address: d.op, amount: { denom: "uatone", amount: String(m.amt) } } };
    }).filter(Boolean);
  }
  window.__goSign = function(){
    if(!txpop) return;
    var msgs = txMsgs(), list = E("txlist"), step = E("txstep"), fee = E("txfee"), sign = E("txsign");
    if(!msgs.length) return;
    var total = 0, dests = {}; msgs.forEach(function(m){ total += +m.value.amount.amount; dests[m.value.validator_dst_address] = 1; });
    var nd = Object.keys(dests).length;
    E("txn").textContent = "";
    var sm = E("txsum"); if(sm) sm.innerHTML = fmt(total) + " ATONE<br>to " + nd + " validator" + (nd === 1 ? "" : "s");
    var an = window.__ANS || {}, ax = E("txans");
    if(ax) ax.innerHTML = '<span class=p><i>now</i><b>' + pct(an.now || 0) + '</b></span><span class=arr>\u2192</span>' +
      '<span class="p aft' + (an.after != null && an.after < (an.now || 0) - 0.0005 ? ' neg' : '') + '"><i>after</i><b>' + (an.after != null ? pct(an.after) : '\u2014') + '</b></span>' +
      '<span class="p gain' + (an.gain < -0.5 ? ' neg' : '') + '"><i>ATONE/year</i><b>' + (an.gain > 0.5 ? '+' + one(an.gain) : an.gain < -0.5 ? '\u2212' + one(-an.gain) : '\u2014') + '</b></span>';
    list.innerHTML = msgs.map(function(m){
      var s = m.value.validator_src_address.slice(-6), d = m.value.validator_dst_address.slice(-6);
      return '<div class=txrow><span class=f>' + logo(s, nameOf(s)) + '<b>' + att(nameOf(s)) + '</b></span><i>\u2192</i>' +
             '<span class="f to">' + logo(d, nameOf(d)) + '<b>' + att(nameOf(d)) + '</b></span><span class=a>' + fmt(+m.value.amount.amount) + ' ATONE</span></div>'; }).join("");
    var lk = E("txlock"), until = new Date(Date.now() + 21 * 86400000);
    if(lk) lk.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden=true><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
      '<span>Redelegated stake cannot be redelegated again for <b>21 days</b>, until <b>' + window.__day(until.getTime()) + '</b></span>';
    fee.textContent = "fee: estimating…"; step.textContent = ""; step.className = "txstep";
    sign.disabled = false; sign.textContent = "Redelegate";
    POP.open(txpop);
    /* a first pass estimates the fee so the reader sees it before signing */
    if(window.__TX && window.__WALLET){
      window.__TX.account(window.__ADDR).then(function(acc){
        return window.__TX.simulate(msgs, "", window.__WALLET.pubKey, acc.sequence); })
      .then(function(g){ var f = window.__TX.feeFor(g, msgs.length); fee.textContent = "fee ≈ " + (parseInt(f.amount[0].amount, 10) / 1e6).toFixed(3) + " PHOTON, gas " + f.gas.toLocaleString(); })
      .catch(function(e){ fee.textContent = "the node could not simulate it: " + att(e.message || e); });
    }
  };
  var txsign = E("txsign"), txcancel = E("txcancel");
  if(txcancel) txcancel.addEventListener("click", function(){ POP.close(txpop); });
  if(txsign) txsign.addEventListener("click", function(){
    var msgs = txMsgs(), step = E("txstep"); if(!msgs.length || !window.__TX || !window.__WALLET) return;
    txsign.disabled = true; step.className = "txstep";
    window.__TX.send(window.__WALLET, msgs, "", function(s, x){
      step.textContent = s === "simulating" ? "Estimating gas…" : s === "signing" ? "Waiting for your signature…"
                       : s === "broadcasting" ? "Sending to the chain…" : s === "pending" ? "In the mempool, " + String(x).slice(0, 10) + "… waiting for a block" : s; })
    .then(function(r){
      step.className = "txstep ok"; step.innerHTML = "Done in block <b>" + Number(r.height).toLocaleString() + "</b>, " + att(r.hash).slice(0, 12) + "…";
      txsign.textContent = "Done";
      if(window.__refreshPos) window.__refreshPos().then(function(){ draw(); });
      setTimeout(function(){ POP.close(txpop); }, 4000);
    })
    .catch(function(e){
      step.className = "txstep err"; step.textContent = att(e && e.message || String(e));
      txsign.disabled = false; txsign.textContent = "Try again";
    });
  });
  /* ── unstake: one validator, an amount up to what sits there, one MsgUndelegate ──
     Undelegating is allowed even while a delegation is in its redelegation cooldown;
     the ATONE then unbonds for 21 days, earning nothing, before it is liquid. */
  var unpop = E("unpop"), UNSEL = null;
  function unRows(){
    var pos = window.__POS, el = E("unpick"); if(!el || !pos) return;
    var rows = pos.rows.slice().sort(function(a, b){ return b.x - a.x; });
    if(!UNSEL || (UNSEL !== "*" && !rows.some(function(r){ return r.id === UNSEL; }))) UNSEL = rows.length ? rows[0].id : null;
    /* the first row is everything at once: the whole stake, across every validator */
    var all = rows.length > 1 ? '<label class="unrow all' + (UNSEL === "*" ? ' on' : '') + '"><input type=radio name=unv value="*"' + (UNSEL === "*" ? ' checked' : '') + '>' +
              '<span class="wk-lg wk-lgx">\u2211</span><b>All validators</b><i>' + fmt(pos.total) + '<em>ATONE</em></i></label>' : '';
    el.innerHTML = all + rows.map(function(r){
      return '<label class="unrow' + (r.id === UNSEL ? ' on' : '') + '"><input type=radio name=unv value="' + att(r.id) + '"' + (r.id === UNSEL ? ' checked' : '') + '>' +
             logo(r.id, r.m) + '<b>' + att(r.m) + '</b><i>' + fmt(r.x) + '<em>ATONE</em></i></label>'; }).join("");
    Array.prototype.forEach.call(el.querySelectorAll("input"), function(c){
      c.addEventListener("change", function(){ UNSEL = c.value; Array.prototype.forEach.call(el.querySelectorAll(".unrow"), function(l){ l.classList.toggle("on", l.querySelector("input").value === UNSEL); }); unState(); }); });
  }
  function unRow(){ var pos = window.__POS; if(!pos) return null;
    if(UNSEL === "*") return { id: "*", m: "all validators", x: pos.total };
    for(var i = 0; i < pos.rows.length; i++) if(pos.rows[i].id === UNSEL) return pos.rows[i]; return null; }
  function unAmount(){ var a = E("unamt"), n = parseFloat((a.value || "").replace(/[^0-9.]/g, "")); return isFinite(n) && n > 0 ? Math.floor(n * 1e6) : 0; }
  function unState(){
    var r = unRow(), u = unAmount(), mx = E("unmaxv"), hint = E("unhint"), fld = document.querySelector("#unpop .unfield"), go = E("unsign"), sm = E("unsum"), lk = E("unlock");
    if(mx) mx.textContent = r ? exact(r.x, 2) : "\u2014";
    var over = r && u > r.x, ok = r && u > 0 && !over;
    if(fld) fld.classList.toggle("bad", !!over);
    if(hint){ hint.className = "unhint" + (over ? " bad" : ""); hint.textContent = over ? "more than sits on " + r.m : (r ? "of " + exact(r.x) + " on " + r.m : ""); }
    if(go) go.disabled = !ok || !window.__WALLET;
    if(sm) sm.innerHTML = ok ? fmt(u) + " ATONE<br>from " + (UNSEL === "*" ? unMsgs().length + " validators" : att(r.m)) : "";
    var until = new Date(Date.now() + 21 * 86400000);

    if(lk) lk.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden=true><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
      '<span>Unstaked ATONE unbonds for <b>21 days</b>, until <b>' + window.__day(until.getTime()) + '</b>, and earns nothing meanwhile</span>';
    E("unfee").textContent = ""; var st = E("unstep"); st.textContent = ""; st.className = "txstep";
    if(ok && window.__TX && window.__WALLET){
      var w = window.__WALLET, msgs = unMsgs(), fee = E("unfee");
      fee.textContent = "fee: estimating\u2026";
      window.__TX.account(w.address).then(function(acc){ return window.__TX.simulate(msgs, "", w.pubKey, acc.sequence); }).catch(function(){ return 0; })
        .then(function(g){ if(unAmount() !== u) return; var f = window.__TX.feeFor(g, msgs.length); fee.textContent = "fee \u2248 " + (parseInt(f.amount[0].amount, 10) / 1e6).toFixed(3) + " PHOTON, gas " + f.gas.toLocaleString(); });
    }
  }
  function unMsgs(){
    var r = unRow(), u = unAmount(), VD = window.__VDBY || {}, pos = window.__POS;
    if(!r || !(u > 0) || u > r.x) return [];
    if(UNSEL === "*"){
      /* everything: one message per validator, the largest positions first, until the
         amount is covered - the whole stake when the field holds the total */
      var need = u, out = [];
      pos.rows.slice().sort(function(a, b){ return b.x - a.x; }).forEach(function(row){
        if(need <= 0) return; var d = VD[row.id]; if(!d || !d.op) return;
        var t = Math.min(row.x, need); need -= t;
        out.push({ type: "cosmos-sdk/MsgUndelegate", value: { delegator_address: window.__ADDR, validator_address: d.op, amount: { denom: "uatone", amount: String(Math.floor(t)) } } }); });
      return out;
    }
    var d = VD[UNSEL]; if(!d || !d.op) return [];
    return [{ type: "cosmos-sdk/MsgUndelegate", value: { delegator_address: window.__ADDR, validator_address: d.op, amount: { denom: "uatone", amount: String(u) } } }];
  }
  window.__unMsgs = unMsgs;
  var unbtn = E("unbtn");
  if(unbtn) unbtn.addEventListener("click", function(){
    if(!unpop || !window.__POS) return;
    var a = E("unamt"); if(a) a.value = "";
    var go = E("unsign"); if(go){ go.disabled = true; go.textContent = "Unstake"; }
    unRows(); unState(); POP.open(unpop); if(a) a.focus();
  });
  var unamtEl = E("unamt"); if(unamtEl) unamtEl.addEventListener("input", unState);
  var unmax = E("unmax"); if(unmax) unmax.addEventListener("click", function(){ var r = unRow(); if(!r) return; E("unamt").value = exact(r.x); unState(); });
  var uncancel = E("uncancel"); if(uncancel) uncancel.addEventListener("click", function(){ POP.close(unpop); });
  var unsign = E("unsign");
  if(unsign) unsign.addEventListener("click", function(){
    var msgs = unMsgs(), step = E("unstep"); if(!msgs.length || !window.__TX || !window.__WALLET) return;
    unsign.disabled = true; step.className = "txstep";
    window.__TX.send(window.__WALLET, msgs, "", function(s, x){
      step.textContent = s === "simulating" ? "Estimating gas\u2026" : s === "signing" ? "Waiting for your signature\u2026"
                       : s === "broadcasting" ? "Sending to the chain\u2026" : s === "pending" ? "In the mempool, " + String(x).slice(0, 10) + "\u2026 waiting for a block" : s; })
    .then(function(r){
      step.className = "txstep ok"; step.innerHTML = "Done in block <b>" + Number(r.height).toLocaleString() + "</b>, " + att(r.hash).slice(0, 12) + "\u2026";
      unsign.textContent = "Done";
      if(window.__refreshPos) window.__refreshPos().then(function(){ draw(); });
      setTimeout(function(){ POP.close(unpop); }, 4000);
    })
    .catch(function(e){
      step.className = "txstep err"; step.textContent = att(e && e.message || String(e));
      unsign.disabled = false; unsign.textContent = "Try again";
    });
  });

  /* ── stake: liquid ATONE onto validators the reader ticks, split equally, one
     MsgDelegate each - the same list as Redelegate, priced at the share that lands ── */
  var stpop = E("stpop"), STSEL = {};
  function stCands(){
    return window.__candidates({ except: {}, cleanRecord: CLEAN }).map(function(v){ v.rate0 = window.__rateAfter(v.t, v.c, 0); return v; })
      .sort(function(a, b){ return a.rank - b.rank; });
  }
  function stAmount(){ var a = E("stamt"), n = parseFloat((a.value || "").replace(/[^0-9.]/g, "")); return isFinite(n) && n > 0 ? Math.floor(n * 1e6) : 0; }
  function stBal(){ var b = window.__BAL; return b && b.uatone > 0 ? b.uatone : 0; }
  function stPlan(){
    var u = stAmount(), ids = Object.keys(STSEL), n = ids.length, share = n ? Math.floor(u / n) : 0, earned = 0, rows = [];
    if(u > 0 && n) stCands().forEach(function(v){ if(!STSEL[v.id]) return; var aft = window.__rateAfter(v.t, v.c, share); earned += share * aft; rows.push({ id: v.id, m: v.m, x: share, after: aft }); });
    return { u: u, n: n, share: share, rate: u > 0 && n ? earned / (share * n) : 0, rows: rows };
  }
  function stRows(){
    var el = E("stlist"); if(!el) return;
    var P = stPlan(), by = {}; P.rows.forEach(function(r){ by[r.id] = r; });
    var h = '<table><colgroup><col style="width:24px"><col style="width:30px"><col><col style="width:60px"><col style="width:46px"><col style="width:64px"><col style="width:56px"></colgroup>' +
            '<thead><tr><th></th><th>rank</th><th class=l>validator</th><th>90<span class=lc>d</span> uptime</th><th>jailed</th><th>stake</th><th>APR</th></tr></thead><tbody>';
    stCands().forEach(function(o){
      var on = !!STSEL[o.id], m = by[o.id], d = (window.__VDBY && window.__VDBY[o.id]) || {}, u90 = d.d90 != null ? +d.d90 : (o.up != null ? +o.up : null);
      h += '<tr' + (on ? ' class=on' : '') + '><td class=ck><input type=checkbox data-id="' + att(o.id) + '"' + (on ? ' checked' : '') + '></td>' +
           '<td>' + o.rank + '</td><td class="l nm"><div class=nmw>' + logo(o.id, o.m) + '<span>' + att(o.m) + '</span></div></td>' +
           '<td class="' + (u90 == null ? 'dim' : u90 >= 95 ? 'ok' : u90 >= 85 ? 'warn' : 'bad') + '">' + (u90 == null ? '\u2014' : u90.toFixed(1) + '%') + '</td>' +
           '<td class="' + (!o.jail ? '' : o.jail > 1 ? 'bad' : 'warn') + '">' + (o.jail ? o.jail : 'Never') + '</td>' +
           '<td>' + (m ? fmt(m.x) : '\u2014') + '</td><td class=r2><b>' + pct(m ? m.after : o.rate0) + '</b></td></tr>';
    });
    var top = el.scrollTop; el.innerHTML = h + '</tbody></table>'; el.scrollTop = top;
    Array.prototype.forEach.call(el.querySelectorAll("tbody input"), function(c){
      c.addEventListener("change", function(){ if(c.checked) STSEL[c.dataset.id] = 1; else delete STSEL[c.dataset.id]; stRows(); stState(); }); });
  }
  function stMsgs(){
    var P = stPlan(), VD = window.__VDBY || {}, out = [];
    if(!(P.u > 0) || !P.n || P.u > stBal() || !(P.share > 0)) return [];
    P.rows.forEach(function(r){ var d = VD[r.id]; if(!d || !d.op) return;
      out.push({ type: "cosmos-sdk/MsgDelegate", value: { delegator_address: window.__ADDR, validator_address: d.op, amount: { denom: "uatone", amount: String(Math.floor(r.x)) } } }); });
    return out;
  }
  window.__stMsgs = stMsgs;
  function stState(){
    var P = stPlan(), bal = stBal(), mx = E("stmaxv"), hint = E("sthint"), fld = document.querySelector("#stpop .unfield"), go = E("stsign"), sm = E("stsum"), lk = E("stlock");
    if(mx) mx.textContent = exact(bal, 2);
    var over = P.u > bal, ok = P.u > 0 && P.n > 0 && !over && P.share > 0;
    if(fld) fld.classList.toggle("bad", !!over);
    if(hint){ hint.className = "unhint" + (over ? " bad" : ""); hint.textContent = over ? "more than the wallet holds" : (P.u > 0 && !P.n ? "Select a validator" : "of " + exact(bal) + " liquid"); }
    if(go) go.disabled = !ok || !window.__WALLET;
    var sb = E("stbell"); if(sb) sb.disabled = !P.n;
    /* the blended rate rides in the summary's second line */
    if(sm) sm.innerHTML = ok ? fmt(P.u) + " ATONE<br>to " + P.n + " validator" + (P.n === 1 ? "" : "s") + " at " + pct(P.rate) : "";
    if(lk) lk.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden=true><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
      '<span>Staked ATONE earns from the next block; locked; unbonding takes <b>21 days</b>.</span>';
    E("stfee").textContent = ""; var st = E("ststep"); st.textContent = ""; st.className = "txstep";
    if(ok && window.__TX && window.__WALLET){
      var w = window.__WALLET, msgs = stMsgs(), fee = E("stfee");
      fee.textContent = "fee: estimating\u2026";
      window.__TX.account(w.address).then(function(acc){ return window.__TX.simulate(msgs, "", w.pubKey, acc.sequence); }).catch(function(){ return 0; })
        .then(function(g){ if(stAmount() !== P.u) return; var f = window.__TX.feeFor(g, msgs.length); fee.textContent = "fee \u2248 " + (parseInt(f.amount[0].amount, 10) / 1e6).toFixed(3) + " PHOTON, gas " + f.gas.toLocaleString(); });
    }
  }
  var stbtn = E("stbtn");
  if(stbtn) stbtn.addEventListener("click", function(){
    if(!stpop || !window.__POS) return;
    STSEL = {}; var a = E("stamt"); if(a) a.value = "";
    var go = E("stsign"); if(go){ go.disabled = true; go.textContent = "Stake"; }
    stRows(); stState(); POP.open(stpop); if(a) a.focus();
  });
  var stamtEl = E("stamt"); if(stamtEl) stamtEl.addEventListener("input", function(){ stRows(); stState(); });
  var stmax = E("stmax"); if(stmax) stmax.addEventListener("click", function(){ if(!(stBal() > 0)) return; E("stamt").value = exact(stBal()); stRows(); stState(); });
  var stcancel = E("stcancel"); if(stcancel) stcancel.addEventListener("click", function(){ POP.close(stpop); });
  var stsign = E("stsign");
  if(stsign) stsign.addEventListener("click", function(){
    var msgs = stMsgs(), step = E("ststep"); if(!msgs.length || !window.__TX || !window.__WALLET) return;
    stsign.disabled = true; step.className = "txstep";
    window.__TX.send(window.__WALLET, msgs, "", function(s, x){
      step.textContent = s === "simulating" ? "Estimating gas\u2026" : s === "signing" ? "Waiting for your signature\u2026"
                       : s === "broadcasting" ? "Sending to the chain\u2026" : s === "pending" ? "In the mempool, " + String(x).slice(0, 10) + "\u2026 waiting for a block" : s; })
    .then(function(r){
      step.className = "txstep ok"; step.innerHTML = "Done in block <b>" + Number(r.height).toLocaleString() + "</b>, " + att(r.hash).slice(0, 12) + "\u2026";
      stsign.textContent = "Done";
      if(window.__refreshPos) window.__refreshPos().then(function(){ draw(); });
      setTimeout(function(){ POP.close(stpop); }, 4000);
    })
    .catch(function(e){
      step.className = "txstep err"; step.textContent = att(e && e.message || String(e));
      stsign.disabled = false; stsign.textContent = "Try again";
    });
  });

  /* ── Autopilot: a StakeAuthorization REDELEGATE grant to GATA's keeper address, with
     an allow-list, a cap and an expiry the reader sets; the keeper (a separate signer,
     its own key, off this box) executes inside those bounds; the chain enforces them.
     The keeper's address and standing come from keeper/_status.json ── */
  var atpop = E("atpop"), AT = { addr: null, dry: true, grant: null, days: 90, fee_pct: 0, fee_to: null, report: null };
  function atStatus(){
    return fetch("keeper/_status.json", { cache: "no-store" }).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
      AT.addr = j && j.grantee ? j.grantee : null; AT.dry = !j || j.dry !== false; AT.fee_pct = j && j.fee_pct ? +j.fee_pct : 0; AT.fee_to = j && j.fee_to ? j.fee_to : null; return j; }).catch(function(){ AT.addr = null; return null; });
  }
  var REDEL = "/cosmos.staking.v1beta1.MsgBeginRedelegate", DELEG = "/cosmos.staking.v1beta1.MsgDelegate", WDRAW = "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward";
  function grantType(g){ var a = g && g.authorization || {}; return a.msg || ({ AUTHORIZATION_TYPE_REDELEGATE: REDEL, AUTHORIZATION_TYPE_DELEGATE: DELEG })[a.authorization_type] || ""; }
  /* every grant standing between the reader and the keeper: the redelegate one is the
     switch, the delegate + withdraw pair is the restake; a revoke names what stands */
  function atGrant(){
    if(!AT.addr || !window.__ADDR) return Promise.resolve(null);
    return fetch((window.__API || "https://atomone-api.gatadao.com") + "/cosmos/authz/v1beta1/grants?granter=" + window.__ADDR + "&grantee=" + AT.addr + "&pagination.limit=50", { cache: "no-store" })
      .then(function(r){ return r.json(); }).then(function(d){ AT.grants = d.grants || []; var g = null; AT.grants.forEach(function(x){ if(grantType(x) === REDEL) g = x; }); return g; }).catch(function(){ AT.grants = []; return null; });
  }
  function atReport(){
    if(!window.__ADDR) return Promise.resolve(null);
    return fetch("keeper/" + window.__ADDR + ".json", { cache: "no-store" }).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
  }
  /* the strategies: each is a set of validators the grant allows, and a word in the memo the
     keeper reads for its own pace and thresholds (the chain enforces only the set) */
  function atPreset(){ return (document.querySelector("#atpop input[name=atstrat]:checked") || {}).value || "below"; }
  function atPick(){ return (document.querySelector("#atpop input[name=atpick]:checked") || {}).value || "all"; }
  function atRestake(){ var c = E("atrestake"); return !!(c && c.checked); }
  function atScopeFor(v){
    var VD = window.__VDBY || {}, V = window.__VALS(), MEAN = window.__S() / V.length, out = [];
    if(v === "ticked"){ Object.keys(SEL).forEach(function(id){ var d = VD[id]; if(d && d.op) out.push(d.op); }); return out; }
    if(v === "all"){ V.forEach(function(x){ var d = VD[x[3]]; if(d && d.op) out.push(d.op); }); return out; }   /* the whole set */
    window.__candidates({ except: {}, cleanRecord: false }).forEach(function(c){ var d = VD[c.id]; if(!d || !d.op || d.tomb) return;
      var d90 = d.d90 == null ? null : +d.d90, lu = d.life_up == null ? null : +d.life_up;
      if(v === "passive"){ if(c.rank <= V.length / 2 && !c.jail && (lu == null || lu >= 99) && (d90 == null || d90 >= 99)) out.push(d.op); }
      else if(v === "aggressive"){ if(d90 == null || d90 >= 50) out.push(d.op); }
      else { if(c.t < MEAN && !c.jail && (d90 == null || d90 >= 95)) out.push(d.op); } });
    return out;
  }
  /* the allow-list: the whole set, or the reader's own selection; the strategy sets the pace */
  function atScope(){ return atScopeFor(atPick() === "selected" ? "ticked" : "all"); }
  /* the memo the keeper reads: the strategy word, then the flags */
  var AT_WORD = { passive: "passive", below: "moderate", aggressive: "aggressive" };
  function atMemo(){ return "gata:" + (AT_WORD[atPreset()] || "moderate") + (atPick() === "selected" ? ":picks" : "") + (atRestake() ? ":restake" : ""); }
  function atMonths(){ return AT.days >= 180 ? "6 months" : "3 months"; }
  function atCap(){ var a = E("atcap"), n = parseFloat((a.value || "").replace(/[^0-9.]/g, "")); return isFinite(n) && n > 0 ? Math.floor(n * 1e6) : 0; }
  function atMsgs(){
    var scope = atScope(), cap = atCap(), pos = window.__POS;
    if(!AT.addr || !scope.length || !(cap > 0) || !pos) return [];
    var exp = Date.now() + AT.days * 86400000;
    var msgs = [{ type: "cosmos-sdk/MsgGrant", value: { granter: window.__ADDR, grantee: AT.addr,
      grant: { authorization: { type: "cosmos-sdk/StakeAuthorization", value: { authorization_type: "redelegate", max_tokens: { denom: "uatone", amount: String(cap) }, allow_list: scope } }, expiration: exp } } }];
    /* restake: the keeper may claim the rewards and stake them back, only onto the same set,
       up to the same cap, for the same time */
    if(atRestake()){
      msgs.push({ type: "cosmos-sdk/MsgGrant", value: { granter: window.__ADDR, grantee: AT.addr,
        grant: { authorization: { type: "cosmos-sdk/GenericAuthorization", value: { msg: WDRAW } }, expiration: exp } } });
      msgs.push({ type: "cosmos-sdk/MsgGrant", value: { granter: window.__ADDR, grantee: AT.addr,
        grant: { authorization: { type: "cosmos-sdk/StakeAuthorization", value: { authorization_type: "delegate", max_tokens: { denom: "uatone", amount: String(cap) }, allow_list: scope } }, expiration: exp } } });
    }
    /* the service fee, when one is set: paid with the grant, in the same signature */
    var fee = atFee(); if(fee > 0 && AT.fee_to) msgs.push({ type: "cosmos-sdk/MsgSend", value: { from_address: window.__ADDR, to_address: AT.fee_to, amount: [{ denom: "uatone", amount: String(fee) }] } });
    return msgs;
  }
  window.__atMsgs = atMsgs;
  function atFee(){
    /* 5% (or whatever _status says) of the projected yearly gain, pro-rated to the period */
    var an = window.__ANS || {}, gain = an.gain > 0 ? an.gain : 0;
    if(!AT.fee_pct || !(gain > 0)) return 0;
    return Math.floor(gain * 1e6 * AT.fee_pct / 100 * AT.days / 365);
  }
  function atState(){
    var pos = window.__POS, cap = atCap(), scope = atScope(), mx = E("atmaxv"), hint = E("athint"), go = E("atgrant"), sm = E("atsum"), n1 = E("atn1"), n2 = E("atn2"), feeEl = E("atfee");
    var movable = pos ? pos.free : 0;
    if(mx) mx.textContent = pos ? exact(movable, 2) : "\u2014";
    var n0 = E("atn0"), n3 = E("atn3"), na = E("atna");
    if(n0) n0.textContent = atScopeFor("passive").length + " validators";
    if(n1) n1.textContent = atScopeFor("below").length + " validators";
    if(n3) n3.textContent = atScopeFor("aggressive").length + " validators";
    if(na) na.textContent = atScopeFor("all").length + " validators";
    var un = E("atuntil"); if(un) un.innerHTML = "until <b>" + window.__dayFull(Date.now() + AT.days * 86400000) + "</b>";
    var sel = Object.keys(SEL).length; if(n2) n2.textContent = sel ? sel + " selected" : "none selected yet";
    var ok = !!AT.addr && scope.length > 0 && cap > 0 && !!window.__WALLET && !!window.__WALLET.signDirect;
    if(hint){ hint.className = "unhint" + (!AT.addr ? " bad" : ""); hint.textContent = !AT.addr ? "Autopilot is not open yet" : (!window.__WALLET || !window.__WALLET.signDirect ? "Needs Keplr (direct signing)" : (!scope.length ? (atPick() === "selected" ? "select validators in the Redelegate list first" : "no validators fit that strategy today") : "ATONE the keeper may move in total, for the time")); }
    if(go) go.disabled = !ok;
    if(sm) sm.innerHTML = ok ? fmt(cap) + " ATONE<br>" + (AT_WORD[atPreset()] || "moderate") + ", " + (atPick() === "selected" ? "my selection, " : "") + scope.length + " validators, " + atMonths() + (atRestake() ? ", restake" : "") : "";
    var fee = atFee();
    if(feeEl){ feeEl.hidden = !(fee > 0); if(fee > 0) feeEl.innerHTML = "Service fee <b>" + fmt(fee) + " ATONE</b> - " + AT.fee_pct + "% of the projected gain for " + atMonths() + ", paid with the grant in the same signature."; }
    E("attxfee").textContent = ""; var st = E("atstep"); st.textContent = ""; st.className = "txstep";
    if(ok && window.__TX && window.__WALLET){
      var w = window.__WALLET, msgs = atMsgs(), fe = E("attxfee"); fe.textContent = "fee: estimating\u2026";
      window.__TX.account(w.address).then(function(acc){ return window.__TX.simulate(msgs, "", w.pubKey, acc.sequence); }).catch(function(){ return 0; })
        .then(function(g){ if(atCap() !== cap) return; var f = window.__TX.feeFor(g, msgs.length); fe.textContent = "fee \u2248 " + (parseInt(f.amount[0].amount, 10) / 1e6).toFixed(3) + " PHOTON, gas " + f.gas.toLocaleString(); });
    }
  }
  function atShow(){
    var st = E("atstate"), form = E("atform"), rv = E("atrevoke"), go = E("atgrant"), sm = E("atsum");
    if(AT.grant){
      var a = AT.grant.authorization || {}, cap = a.max_tokens ? fmt(+a.max_tokens.amount) + " ATONE" : "no cap", n = ((a.allow_list || {}).address || []).length, exp = AT.grant.expiration ? window.__dayFull(new Date(AT.grant.expiration).getTime()) : "no expiry";
      var rp = AT.report, last = rp && rp.checked ? new Date(rp.checked * 1000) : null;
      st.hidden = false; form.hidden = true; rv.hidden = false; go.hidden = true;
      var restk = (AT.grants || []).some(function(x){ return grantType(x) === DELEG; });
      st.innerHTML = '<span class=g>Autopilot is on' + (restk ? ', restaking rewards' : '') + '.</span> Cap left <b>' + cap + '</b>, <b>' + n + '</b> allowed validators, until <b>' + exp + '</b>.<br>' +
        (last ? 'Last check <b>' + window.__dayFull(last.getTime()) + '</b>' + (rp.moves && rp.moves.length ? ', <b>' + rp.moves.length + '</b> move' + (rp.moves.length === 1 ? '' : 's') + ' ' + (rp.dry ? 'planned (dry run)' : 'made') + ', <b class=g>+' + one(rp.gain || 0) + '</b> ATONE a year' : ', nothing to move') : 'The keeper has not checked this address yet') +
        (rp && rp.history && rp.history.length ? '<br>Moves made: <b>' + rp.history.length + '</b>, last ' + window.__dayFull(rp.history[0].at * 1000) : '');
      if(sm) sm.innerHTML = "on";
    } else { st.hidden = true; form.hidden = false; rv.hidden = true; go.hidden = !AT.addr; atState(); }   /* no Grant button until the keeper is open */
  }
  var atbtn = E("atbtn");
  if(atbtn) atbtn.addEventListener("click", function(){
    if(!atpop || !window.__POS) return;
    var a = E("atcap"); if(a) a.value = "";
    var go = E("atgrant"); if(go){ go.disabled = true; go.textContent = "Grant"; }
    E("atstep").textContent = "";
    atStatus().then(function(){ return Promise.all([atGrant(), atReport()]); }).then(function(r){ AT.grant = r[0]; AT.report = r[1]; atShow(); POP.open(atpop); });
  });
  var atcapEl = E("atcap"); if(atcapEl) atcapEl.addEventListener("input", atState);
  var atmax = E("atmax"); if(atmax) atmax.addEventListener("click", function(){ var pos = window.__POS; if(!pos || !(pos.free > 0)) return; E("atcap").value = exact(pos.free); atState(); });
  Array.prototype.forEach.call(document.querySelectorAll("#atpop input[name=atstrat],#atpop input[name=atpick],#atpop #atrestake"), function(r){ r.addEventListener("change", atState); });
  Array.prototype.forEach.call(document.querySelectorAll("#atseg button"), function(b){ b.addEventListener("click", function(){
    AT.days = +b.dataset.d; Array.prototype.forEach.call(document.querySelectorAll("#atseg button"), function(o){ o.setAttribute("aria-pressed", o === b ? "true" : "false"); }); atState(); }); });
  var atcancel = E("atcancel"); if(atcancel) atcancel.addEventListener("click", function(){ POP.close(atpop); });
  function atSend(msgs, btn, done, memo){
    var step = E("atstep"); if(!msgs.length || !window.__TX || !window.__WALLET) return;
    btn.disabled = true; step.className = "txstep";
    window.__TX.sendDirect(window.__WALLET, msgs, memo || "", function(s, x){
      step.textContent = s === "simulating" ? "Estimating gas\u2026" : s === "signing" ? "Waiting for your signature\u2026"
                       : s === "broadcasting" ? "Sending to the chain\u2026" : s === "pending" ? "In the mempool, " + String(x).slice(0, 10) + "\u2026 waiting for a block" : s; })
    .then(function(r){
      step.className = "txstep ok"; step.innerHTML = "Done in block <b>" + Number(r.height).toLocaleString() + "</b>, " + att(r.hash).slice(0, 12) + "\u2026";
      btn.textContent = done;
      setTimeout(function(){ atGrant().then(function(g){ AT.grant = g; atShow(); var ab = E("atbtn"); if(ab) ab.classList.toggle("on", !!g); }); }, 1500);
    })
    .catch(function(e){ step.className = "txstep err"; step.textContent = att(e && e.message || String(e)); btn.disabled = false; btn.textContent = "Try again"; });
  }
  var atgrant = E("atgrant"); if(atgrant) atgrant.addEventListener("click", function(){ atSend(atMsgs(), atgrant, "Granted", atMemo()); });
  /* revoke names every grant that stands (a revoke of one that does not fails the whole tx) */
  var atrevoke = E("atrevoke"); if(atrevoke) atrevoke.addEventListener("click", function(){
    var types = {}; (AT.grants || []).forEach(function(x){ var t = grantType(x); if(t) types[t] = 1; }); if(!types[REDEL]) types[REDEL] = 1;
    atSend(Object.keys(types).map(function(t){ return { type: "cosmos-sdk/MsgRevoke", value: { granter: window.__ADDR, grantee: AT.addr, msg_type_url: t } }; }), atrevoke, "Revoked"); });
  /* the door shows with a wallet once the keeper's address is known; lit while a grant stands */
  window.__atDoor = function(){
    var b = E("atbtn"); if(!b) return;
    if(!window.__POS){ b.hidden = true; return; }
    /* the door shows for every connected wallet; while the keeper has no address yet the
       card says "Autopilot is not open yet" and Grant stays disabled */
    b.hidden = false;
    atStatus().then(function(){ if(AT.addr) atGrant().then(function(g){ AT.grant = g; b.classList.toggle("on", !!g); }); });
  };

  /* the bells on the two cards: every validator the transaction lands on */
  function alertList(ids){
    var VD = window.__VDBY || {}, out = [], seen = {};
    ids.forEach(function(id){ var d = VD[id]; if(!d || !d.chex || seen[id]) return; seen[id] = 1; out.push({ id: d.id, m: d.m, chex: d.chex, av: d.av, vid: d.vid }); });
    return out;
  }
  var txbell = E("txbell"); if(txbell) txbell.addEventListener("click", function(){ if(window.__alertMany) window.__alertMany(alertList(MSGS.map(function(m){ return m.to; }))); });
  var stbell = E("stbell"); if(stbell) stbell.addEventListener("click", function(){ if(window.__alertMany) window.__alertMany(alertList(Object.keys(STSEL))); });
  if(!window.__BOT){ if(txbell) txbell.hidden = true; if(stbell) stbell.hidden = true; }

  window.__planDraw = draw;
  draw();
  /* the wallet's two tabs: my stake, my governance (empty for now) */
  Array.prototype.forEach.call(document.querySelectorAll(".wtabs .wk-tab"), function(b){
    b.addEventListener("click", function(){
      Array.prototype.forEach.call(document.querySelectorAll(".wtabs .wk-tab"), function(o){
        var on = o === b; o.classList.toggle("on", on); o.setAttribute("aria-selected", on ? "true" : "false"); });
      var gov = b.dataset.wt === "gov", connected = !!window.__POS;
      var wb = E("wbody"), wg = E("wgovbody");
      if(wb) wb.hidden = gov || !connected;
      if(wg) wg.hidden = !gov || !connected;
    });
  });

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
  var btn = E("wconn"), box = E("wstate");
  if(!btn) return;
  var API = "https://atomone-api.gatadao.com";
  var CHAIN = "atomone-1";
  window.__API = API;

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
      signAmino: function(addr, doc){ return window.keplr.signAmino(CHAIN, addr, doc); },
      /* SIGN_MODE_DIRECT: the account number travels as a Long-shaped object */
      signDirect: function(addr, doc){ var n = parseInt(doc.accountNumber, 10);
        return window.keplr.signDirect(CHAIN, addr, { bodyBytes: doc.bodyBytes, authInfoBytes: doc.authInfoBytes, chainId: doc.chainId,
          accountNumber: { low: n % 4294967296, high: Math.floor(n / 4294967296), unsigned: true } }); } });
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
    chainId: CHAIN, chainName: "AtomOne",
    rpc: "https://atomone-rpc.gatadao.com", rest: API,
    bip44: { coinType: 118 },
    bech32Config: { bech32PrefixAccAddr: "atone", bech32PrefixAccPub: "atonepub",
      bech32PrefixValAddr: "atonevaloper", bech32PrefixValPub: "atonevaloperpub",
      bech32PrefixConsAddr: "atonevalcons", bech32PrefixConsPub: "atonevalconspub" },
    currencies: [{ coinDenom: "ATONE", coinMinimalDenom: "uatone", coinDecimals: 6 },
                 { coinDenom: "PHOTON", coinMinimalDenom: "uphoton", coinDecimals: 6 }],
    feeCurrencies: [{ coinDenom: "PHOTON", coinMinimalDenom: "uphoton", coinDecimals: 6,
                      gasPriceStep: { low: 0.225, average: 0.25, high: 0.3 } }],
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

  function show(html){ box.hidden = false; box.innerHTML = html; }

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
      var r = reds[i], dst = r.redelegation.validator_dst_address.slice(-6);
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
      var v = by[d.delegation.validator_address.slice(-6)];
      if(!v || !(amt > 0)) continue;
      /* the chain refuses ANY redelegation out of a validator that still holds an
         unmatured redelegation in for this delegator (ErrTransitiveRedelegation),
         not just the amount that arrived - so the whole row is held */
      var L = lock[v[3]], held = L ? amt : 0;
      var rate = window.__rateAfter(v[1], v[2], 0);  /* already in, no dilution */
      total += amt; free += (amt - held); weighted += amt * rate;
      if(L && L.until > until) until = L.until;
      rows.push({ id: v[3], m: v[0], x: amt, rate: rate, locked: held, until: L ? L.until : 0 });
    }
    return { total: total, free: free, locked: total - free, until: until,
             rate: total ? weighted / total : 0, rows: rows };
  }
  window.__when = when;
  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function day(ms){ var t = new Date(ms); return MON[t.getUTCMonth()] + " " + t.getUTCDate(); }
  function dayFull(ms){ var t = new Date(ms); return t.getUTCDate() + " " + MON[t.getUTCMonth()] + " " + t.getUTCFullYear(); }
  window.__day = day; window.__dayFull = dayFull;
  function when(ms){
    var d = Math.ceil((ms - Date.now()) / 86400000);
    return day(ms) + " (" + d + "d)";
  }

  /* one Connect button opens the chooser: the two wallets with their marks,
     "installed" under the ones that are, Keplr only on a phone. Connected, the
     chooser and the button go and one Disconnect remains. */
  /* the chooser is a card on the popup stack: Escape and a tap outside close
     it the way they close every other card, and nothing else has to know */
  var pick = E("wpick"), dis = E("wdisc");
  /* the copy glyph: the clipboard, with the old selection route as the fallback;
     the check shows for a moment */
  var wcopy = E("wcopy"), wcopyT = 0;
  if(wcopy) wcopy.addEventListener("click", function(){
    var a = window.__ADDR; if(!a) return;
    var ok = function(){ wcopy.classList.add("done"); wcopy.title = "Copied"; clearTimeout(wcopyT);
      wcopyT = setTimeout(function(){ wcopy.classList.remove("done"); wcopy.title = "Copy address"; }, 1400); };
    var old = function(){ try{ var t = document.createElement("textarea"); t.value = a; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t); ok(); }catch(e){} };
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(a).then(ok, old); else old();
  });
  /* Connect turns into the two tiles in place; each tile carries its state */
  btn.addEventListener("click", function(){ btn.hidden = true; if(pick) pick.hidden = false; chooser(true); });
  function chooser(open){
    if(!pick || !open) return;
    var have = {}; providers().forEach(function(p){ have[p.name] = 1; });
    Array.prototype.forEach.call(pick.querySelectorAll(".wopt"), function(b){
      var n = b.dataset.w, tag = b.querySelector("i");
      b.hidden = PHONE && n !== "Keplr";
      tag.textContent = have[n] ? "installed" : (PHONE ? "open in the Keplr app" : "not installed");
      tag.className = have[n] ? "on" : "";
      b.classList.toggle("off", !have[n]);
    });
    /* a "not installed" line from an earlier attempt is wrong once it is here */
    if(!box.hidden && /not installed/.test(box.textContent) && Object.keys(have).some(function(n){ return box.textContent.indexOf(n) === 0; })) box.hidden = true;
  }
  /* extensions inject after the page has loaded, and not all at once: read
     the tiles' state again a few times, and whenever the tab comes back */
  chooser(true);
  [400, 1200, 3000, 6000].forEach(function(ms){ setTimeout(function(){ chooser(true); }, ms); });
  document.addEventListener("visibilitychange", function(){ if(!document.hidden) chooser(true); });
  window.addEventListener("focus", function(){ chooser(true); });
  if(pick) Array.prototype.forEach.call(pick.querySelectorAll(".wopt"), function(b){
    b.addEventListener("click", function(){ CHOSEN = b.dataset.w; chooser(false); connect(true); }); });
  function disconnect(){
    window.__ADDR = null; window.__POS = null; window.__REDS = null; window.__MINE = null; window.__LOCKNOTE = "";
    window.__DELS = null; window.__WALLET = null; window.__BAL = null;
    window.__UNB = null; window.__REW = null; window.__REWBY = null; window.__POSAT = 0;
    CHOSEN = null;
    try{ localStorage.removeItem("th_wallet"); }catch(e){}
    document.documentElement.removeAttribute("data-wallet");
    var wa = E("waddr"); if(wa) wa.hidden = true;
    var wc0 = E("wcopy"); if(wc0){ wc0.hidden = true; wc0.classList.remove("done"); }
    var ab0 = E("atbtn"); if(ab0){ ab0.hidden = true; ab0.classList.remove("on"); }
    box.hidden = true; if(dis) dis.hidden = true; var blk0 = E("wblk"); if(blk0) blk0.hidden = true; var rf0 = E("wrefresh"); if(rf0) rf0.hidden = true;
    btn.disabled = false; btn.querySelector("span").textContent = "Connect wallet"; btn.hidden = false; if(pick) pick.hidden = true; chooser(true);
    var gate = E("wgate"), acct = E("wk-acct"); if(gate) gate.hidden = false; if(acct) acct.hidden = true;
    var wn = E("wname"); if(wn) wn.textContent = "My wallet";
    var wm = E("wmark"); if(wm) wm.hidden = true;
    var fwn = E("fwn"); if(fwn) fwn.textContent = "Dashboard";
    if(window.__redraw) window.__redraw();
    if(window.__planDraw) window.__planDraw();
  }
  if(dis) dis.addEventListener("click", disconnect);
  /* Refresh: read the chain again for this address, on request only */
  window.__refreshPos = function(){
    if(!window.__ADDR || !window.__POS) return Promise.resolve();
    return new Promise(function(res){ window.__onPos = res; connect(true); });
  };

  function connect(chosen){
    var ps = providers(), w = null;
    if(CHOSEN){ for(var i = 0; i < ps.length; i++) if(ps[i].name === CHOSEN) w = ps[i]; }
    if(!chosen && !w){ chooser(true); return; }
    if(!w){
      show(PHONE ? '<s>Open this page inside the Keplr app (Keplr → Browser).</s>' : '<s>' + att(CHOSEN || "That wallet") + ' is not installed in this browser.</s>');
      CHOSEN = null;
      return;
    }
    btn.disabled = true; btn.querySelector("span").textContent = "Connecting " + w.name + "…";
    show('<s>Connecting ' + att(w.name) + '…</s>');
    w.enable()
      .then(function(){ return w.getKey(); })
      .then(function(k){
        window.__ADDR = k.bech32Address;
        /* what the signing step needs: the wallet, the address, the public key */
        /* label: the account's own name as the wallet reports it (what the reader
           called it in Keplr/Adena); name: the provider, kept for the mark */
        /* Adena's API carries no account name (getKey: algo, pubKey, address; GetAccount: no
           name either), so an Adena account reads "My wallet" beside its address */
        window.__WALLET = { name: w.name, label: (k.name || "").trim() || (w.name === "Adena" ? "My wallet" : w.name), address: k.bech32Address, pubKey: k.pubKey,
                            signAmino: function(doc){ return w.signAmino(k.bech32Address, doc); },
                            signDirect: w.signDirect ? function(doc){ return w.signDirect(k.bech32Address, doc); } : null };
        return get("/cosmos/staking/v1beta1/delegations/" + k.bech32Address);
      })
      .then(function(d){
        window.__DELS = d.delegation_responses || [];
        /* Stake that ARRIVED by redelegation cannot leave again until its entry
           matures - the chain rejects it outright (ErrTransitiveRedelegation),
           not as a soft cooldown. 21 days. A plan built on locked stake is a plan
           that cannot be signed, so the lock has to be read before anything is
           recommended. */
        return get("/cosmos/staking/v1beta1/delegators/" + window.__ADDR + "/redelegations");
      })
      .then(function(rd){
        window.__REDS = rd.redelegation_responses || [];
        return get("/cosmos/staking/v1beta1/delegators/" + window.__ADDR + "/unbonding_delegations").catch(function(){ return {}; });
      })
      .then(function(ub){
        var V = window.__VALS(), by = {}, i; for(i = 0; i < V.length; i++) by[V[i][3]] = V[i][0];
        window.__UNB = [];
        (ub.unbonding_responses || []).forEach(function(u){
          (u.entries || []).forEach(function(e){
            window.__UNB.push({ m: by[u.validator_address.slice(-6)] || u.validator_address.slice(-6),
                                amt: parseInt(e.balance, 10), until: new Date(e.completion_time).getTime() }); }); });
        return get("/cosmos/distribution/v1beta1/delegators/" + window.__ADDR + "/rewards").catch(function(){ return {}; });
      })
      .then(function(rw){
        var tot = 0; ((rw && rw.total) || []).forEach(function(c){ if(c.denom === "uatone") tot += parseFloat(c.amount); });
        window.__REW = rw && rw.total ? tot : null;
        /* and per validator, for the ledger */
        window.__REWBY = {};
        ((rw && rw.rewards) || []).forEach(function(r){ var s = 0; (r.reward || []).forEach(function(c){ if(c.denom === "uatone") s += parseFloat(c.amount); });
          window.__REWBY[String(r.validator_address).slice(-6)] = s; });
        return get("/cosmos/bank/v1beta1/balances/" + window.__ADDR).catch(function(){ return {}; });
      })
      .then(function(bl){
        window.__BAL = { uatone: 0, uphoton: 0 };
        (bl.balances || []).forEach(function(c){ if(c.denom in window.__BAL) window.__BAL[c.denom] = parseInt(c.amount, 10); });
        var rd = { redelegation_responses: window.__REDS };
        var p = position(window.__DELS, rd.redelegation_responses || []);
        window.__POSAT = Date.now();
        window.__POS = p;
        if(window.__driftReset) window.__driftReset();
        window.__MINE = {}; p.rows.forEach(function(x){ window.__MINE[x.id] = 1; });
        if(window.__redraw) window.__redraw();
        try{ localStorage.setItem("th_wallet", w.name); }catch(e){}
        document.documentElement.setAttribute("data-wallet", w.name);
        if(dis) dis.hidden = false; var blk1 = E("wblk"); if(blk1) blk1.hidden = false; var rf1 = E("wrefresh"); if(rf1) rf1.hidden = false; box.hidden = true;
        var fwn = E("fwn"); if(fwn) fwn.textContent = "Dashboard";
        var gate = E("wgate"), acct = E("wk-acct"); if(gate) gate.hidden = true;
        if(acct) acct.hidden = false;
        /* the name whole, and an eight-letter form with two dots for a phone */
        if(window.__atDoor) setTimeout(window.__atDoor, 0);
        var wn = E("wname"); if(wn){ var nm0 = String(window.__WALLET.label || ""), sh = nm0.length > 8 && nm0 !== "My wallet" ? nm0.slice(0, 8) + ".." : nm0;
          wn.innerHTML = '<span class=nf>' + att(nm0) + '</span><span class=ns>' + att(sh) + '</span>'; wn.title = nm0; }
        var wm = E("wmark"); if(wm){ wm.querySelector("img").src = "assets/wallet-" + w.name.toLowerCase() + ".svg"; wm.hidden = false; }


        show('<b>' + fmt(p.total) + '</b> staked ' +
             '<s>across ' + p.rows.length + '</s> ' +
             'earning <u>' + (p.rate * 100).toFixed(1) + '%</u> ' +
             (p.locked > 0
               ? '<span class=lockb>' + fmt(p.locked) + ' locked, ' + when(p.until) + '</span>'
               : '<s>all free to move</s>') +
             '<s>' + window.__ADDR.slice(0, 9) + '…' + window.__ADDR.slice(-4) + '</s>');
        /* the plan runs on what can actually be signed, never on the total */
        var amt = E("amt");
        var wa = E("waddr"); if(wa){ wa.hidden = false;
          /* the short form, its prefix set apart; the copy glyph carries the whole */
          var pre = /^[a-z]+1/.exec(window.__ADDR); pre = pre ? pre[0] : "";
          /* the short form; a phone gets the prefix and the last four only */
          wa.innerHTML = "<em>" + att(pre) + "</em><span class=af>" + att(window.__ADDR.slice(pre.length, pre.length + 5)) + "\u2026" + att(window.__ADDR.slice(-6)) + "</span>" +
                         "<span class=ap>\u2026" + att(window.__ADDR.slice(-4)) + "</span>";
          wa.title = window.__ADDR; }
        var wc = E("wcopy"); if(wc) wc.hidden = false;
        if(amt && p.free > 0){
          /* the field starts empty behind its placeholder; max fills it on demand */
          amt.value = "";
          Array.prototype.forEach.call(document.querySelectorAll(".amtchips .chip"),
            function(o){ o.setAttribute("aria-pressed", "false"); });
        } else if(amt && p.total > 0){
          /* every ATONE is mid-redelegation: a plan here could not be signed at
             all, so show the release date rather than a number nobody can act on */
          amt.value = "";
          window.__LOCKNOTE = "All <b>" + fmt(p.total) + "</b> is mid-redelegation and cannot " +
            "move again until <b>" + when(p.until) + "</b>. The chain rejects a second " +
            "redelegation outright &mdash; it is not a cooldown you can pay through.";
        }
        if(window.__planDraw) window.__planDraw();
        if(window.__onPos){ var f = window.__onPos; window.__onPos = null; f(); }
      })
      .catch(function(e){
        if(window.__onPos){ var f2 = window.__onPos; window.__onPos = null; f2(); }
        if(!window.__POS){ window.__ADDR = null; window.__DELS = null; window.__REDS = null; }
        btn.disabled = false; btn.querySelector("span").textContent = "Connect wallet";
        show('<s>' + (e && e.message === "Request rejected" ? "Rejected in the wallet."
                     : "Could not read the position (" + att(e && e.message || "error") + ").") + '</s>');
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
})();
