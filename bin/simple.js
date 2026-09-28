/* ── Simple ───────────────────────────────────────────────────────────────────
   A second presentation of the same product: the app's own header stays where it
   is, and under it this view puts its own - Overview, Autopilot, Network - with
   one screen at a time instead of three panes at once.

   It owns no state and no arithmetic. Every figure is read from what the
   advanced dashboard has already computed (window.__POS, __VALS, __VDBY,
   __ANS, __optPlan, __atInfo), and every action goes through the advanced
   view's own doors (__wconnect, __goSign, the stake and autopilot cards), so
   the two views can never disagree about a number or sign something different.
   Classes are sv-, scoped to #sv. */
(function(){
  var sv = document.getElementById("sv"); if(!sv) return;
  var E = function(id){ return document.getElementById(id); };
  var root = document.documentElement;
  var esc = window.att || function(v){ return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  var PHONE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  /* ── figures, written exactly as the dashboard writes them ── */
  function one(a){ return (Math.floor(a * 10) / 10).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
  function fmt(u){ return one(u / 1e6); }
  function whole(u){ return Math.floor(u / 1e6).toLocaleString(); }
  function pct(x){ return (x * 100).toFixed(1) + "%"; }
  function pp(x){ return (x >= 0 ? "+" : "−") + Math.abs(x * 100).toFixed(1) + "%"; }
  function hueOf(n){ var h = 0, s = String(n || "?"); for(var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function logo(id, name){
    var d = window.__VDBY && window.__VDBY[id];
    if(d && d.av) return '<img src="assets/val/' + esc(d.id) + '.jpg" alt="" loading=lazy>';
    var c = String(name || "?").replace(/[^A-Za-z0-9]/g, "").charAt(0) || "?";
    return '<span class=lg style="background:hsl(' + hueOf(name) + ',42%,30%)">' + esc(c.toUpperCase()) + '</span>';
  }
  /* write a box only when its markup changed: a block tick that changes nothing touches no
     DOM, and the row or chip the keyboard is on keeps its focus */
  var LASTH = {};
  function put(id, h){ if(RAIL[id]) h = rail(h); var el = E(id); if(!el || LASTH[id] === h) return el; LASTH[id] = h; el.innerHTML = h; return el; }
  /* Network panels carry their readouts on a rail down the right rim, the panel's full height,
     not in the heading: the heading is one line beside the graph's column. The draw functions still
     write the readouts in the heading's .sv-rt; this lifts them out beside the body. */
  var RAIL = { "sv-up": 1, "sv-pace": 1, "sv-signp": 1, "sv-prop24": 1, "sv-act7": 1, "sv-actlive": 1, "sv-ecoa": 1, "sv-ecop": 1 };
  function rail(h){
    var i = h.indexOf("<div class=sv-rt>"); if(i < 0 || h.indexOf("sv-rd", i) < 0) return h;
    var j = h.indexOf("</div>", i), k = h.indexOf("</div>", j + 6); if(j < 0 || k < 0) return h;
    var stats = h.slice(i + 17, j);
    return '<div class=sv-rbody><div class=sv-rmain>' + h.slice(0, i) + h.slice(j + 6) + '</div><div class=sv-rail>' + stats + '</div></div>';
  }
  function rate0(t, c){ return window.__rateAfter ? window.__rateAfter(t, c, 0) : 0; }
  function VALS(){ return window.__VALS ? window.__VALS() : []; }
  function DD(){ return window.__D || { set: {}, eta: {}, nakamoto: {}, rule: {} }; }
  /* the testnet page: what only our index knows (history, proposers, jailings, the
     30/90-day and lifetime records) is not known there - it reads N/A, never a zero */
  function TN(){ return ((DD().net || {}).net) === "testnet"; }
  var NA = "N/A", NAMSG = '<div class=sv-upwait>N/A on testnet</div>';
  function tag(cls, t, title){ return '<span class="sv-tag ' + cls + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + t + '</span>'; }
  /* a span of the set's record: centred, and the set itself as a strip of cells under the figure,
     one a validator, lit if it was never jailed in the span */
  function span(k, v, clean, n){
    var c = ""; for(var i = 0; i < n; i++) c += '<i' + (clean == null ? ' class=u' : i < clean ? '' : ' class=j') + '></i>';
    return '<div class="sv-card sv-span"><span class=sv-k>' + k + '</span><span class=sv-big>' + v + '</span>' +
      '<span class=sv-cells title="' + (clean == null ? "N/A on testnet" : clean + ' of ' + n + ' never jailed in this span') + '">' + c + '</span>' +
      '<span class=sv-sub>validator set average, ' + (clean == null ? NA : clean) + ' never jailed</span></div>';
  }

  /* ── heat: the calculator's own colour for an APR ─────────────────────────
     The map paints each validator by its APR on one ramp - indigo for the big ones that
     pay least, through rose and amber to cream for the small ones that pay most - and this
     view speaks the same language: a validator, a stake, a plan is drawn in the colour it
     has on the map, so "brighter earns more" reads before any figure does. Same bounds as
     the map (ramp(): 2nd-98th percentile, outliers saturate), same curve. fill is for bars
     and dots, ink for type (lifted off the dark end, which would vanish on the window);
     day darkens both so cream never lands on ivory. */
  var HB = { key: null, rb: null };
  function heatBounds(){
    var k = (window.__LIVEV ? window.__LIVEV() : 0) + "/" + VALS().length;
    if(HB.key !== k){ var V = VALS(), rs = [], i;
      for(i = 0; i < V.length; i++) rs.push(rate0(V[i][1], V[i][2]));
      HB.key = k; HB.rb = rs.length && window.ramp ? window.ramp(rs) : null; }
    return HB.rb;
  }
  function heatU(r){
    var rb = heatBounds();
    if(!rb || !rb[1] || !(r > 0)) return .5;
    return .08 + .92 * Math.pow(Math.max(0, Math.min(1, (r - rb[0]) / rb[1])), .55);
  }
  function mix(c, to, k){ var m = /(\d+),\s*(\d+),\s*(\d+)/.exec(c); if(!m) return c;
    return "rgb(" + [m[1], m[2], m[3]].map(function(x){ return Math.round(+x + (to - x) * k); }).join(",") + ")"; }
  function heat(r){
    var u = heatU(r), day = root.getAttribute("data-theme") === "light", L = window.lum || function(){ return "rgb(255,176,46)"; };
    /* type keeps the fill's hue, lifted toward white: the low end reads as a cool lavender,
       not as the rose of a warning, and the top stops at gold short of plain white */
    var fill = L(.16 + .84 * u), ink = mix(L(.16 + .84 * Math.min(u, .9)), 255, .34);
    /* day: ivory under everything, so the ramp's cream end would vanish - fills stop at gold,
       type runs from plum through rust to a deep amber */
    if(day){ fill = mix(L(.16 + .84 * Math.min(u, .8)), 0, .08); ink = mix(L(.16 + .84 * Math.max(.3, Math.min(u, .7))), 0, .4); }
    return { u: u, p: (u - .08) / .92, fill: fill, ink: ink };
  }
  /* the ramp itself, as a gradient, for the scale bars */
  function rampCss(){
    var day = root.getAttribute("data-theme") === "light", L = window.lum, g = [], i;
    if(!L) return "linear-gradient(90deg,#572179,#ffd662)";
    for(i = 0; i <= 12; i++){ var t = .08 + .92 * i / 12; g.push(day ? mix(L(.16 + .84 * Math.min(t, .8)), 0, .08) : L(.16 + .84 * t)); }
    return "linear-gradient(90deg," + g.join(",") + ")";
  }
  /* where a rate sits on the map, as a bar with pins: the reader's validators (sized by their
     share), a faint tick for every validator in the set, the set's median */


  /* ── the set, once: the figures every screen quotes ── */
  function setStats(){
    var V = VALS(), D = DD(), rs = [], i, up = 0, upn = 0, u9 = 0, u9n = 0, lf = 0, lfn = 0, clean = 0, c30 = 0, c90 = 0;
    /* never jailed within a span: the validator's latest jailing (last_slash, a date) is older */
    var ago = function(n){ return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }, a30 = ago(30), a90 = ago(90);
    for(i = 0; i < V.length; i++){
      rs.push(rate0(V[i][1], V[i][2]));
      var d = window.__VDBY && window.__VDBY[V[i][3]];
      if(d && d.d30 != null){ up += +d.d30; upn++; }
      if(d && d.d90 != null){ u9 += +d.d90; u9n++; }
      if(d && d.life_up != null){ lf += +d.life_up; lfn++; }
      var ls = (d && d.last_slash) || "";
      if(!V[i][4] || ls < a30) c30++;
      if(!V[i][4] || ls < a90) c90++;
      if(!V[i][4]) clean++;
    }
    var s = rs.slice().sort(function(a, b){ return a - b; });
    return { lo: s[0] || 0, hi: s[s.length - 1] || 0, mid: s.length ? s[(s.length - 1) >> 1] : 0,
             n: V.length, up: upn ? up / upn : null, up90: u9n ? u9 / u9n : null, life: lfn ? lf / lfn : null,
             clean: clean, clean30: c30, clean90: c90, set: D.set || {} };
  }

  /* ── WALLET ──────────────────────────────────────────────────────────────
     One instrument: a readout strip lit from its top edge - who, then the five figures, each
     standing on a meter of its share of the wallet (APR on the set's own heat ramp) - and three
     columns under it: the move, where the stake earns (a skyline over the set's APR range),
     and the validators. Autopilot is the same frame. */
  /* a strip box: its label, then the figure in an engraved well that fills the box - the unit beside it,
     an optional second compartment (x), and the box's bar set into the well's floor, like a gauge. A
     caption (meta) shows only where one is given (Autopilot's, which explains an empty box) */
  function ro(label, value, meta, meter, color, act, apr, unit, x){
    var m = meter == null ? "" : typeof meter === "string" ? meter : apr
      ? '<i class="sd-m apr" style="background:' + rampCss() + '"><u style="left:' + (Math.max(0, Math.min(1, meter)) * 100).toFixed(1) + '%"></u></i>'
      : '<i class=sd-m><s style="width:' + (meter > 0 ? Math.max(1.5, Math.min(100, meter * 100)) : 0).toFixed(1) + '%"></s></i>';
    return '<div class=sd-ro' + (color ? ' style="--rc:' + color + '"' : '') + '>' + (act || "") + '<em>' + label + '</em>' +
      '<span class="sd-well' + (m ? ' mtr' : '') + '"><b>' + value + '</b>' + (unit ? '<i class=u>' + unit + '</i>' : '') + (x || '') + m + '</span>' +
      (meta ? '<small>' + meta + '</small>' : '') + '</div>';
  }

  function fig(label, value, meta, color){
    return '<div class=sd-fig' + (color ? ' style="--rc:' + color + '"' : '') + '><em>' + label + '</em><b>' + value + '</b>' + (meta ? '<small>' + meta + '</small>' : '') + '</div>';
  }
  /* What a stake earns - money, not a ranking: a year of it as the big figure, then a day, a
     week and a month, each in ATONE with its dollars at today's price (none on testnet). Rewards
     accrue every block, so these are today's rate carried forward. */
  function usdOf(u){ var p = !TN() && DD().prices && DD().prices.atone && DD().prices.atone.usd; return p ? u / 1e6 * p : null; }
  function usd(v){ return v == null ? "" : "≈ $" + (v >= 100 ? Math.round(v).toLocaleString() : v >= 1 ? v.toFixed(2) : v.toFixed(3)); }
  /* ex: the example for a visitor with no wallet - ATONE only, the rate as a single figure, no notes */
  function earns(stake, rate, off, ex){
    var y = stake * rate;
    /* restaking monthly: the rewards claimed and staked again each month earn too - the year compounded
       twelve times at today's rate, against the plain year */
    var cy = stake * (Math.pow(1 + rate / 12, 12) - 1), more = cy - y, dapr = (cy / (stake || 1) - rate) * 100;
    var at = !ex && window.__atInfo ? window.__atInfo() : null, on = !!(at && at.grant && at.restake);
    /* restaking already: every figure carries the restake's effect */
    var Y = on ? cy : y, P = function(days){ return Y * days / 365; };
    var amt = function(u){ return '<span class=se-amt>+' + one(u / 1e6) + '</span>'; };
    /* four big boxes, as Move your stake shows its figures: a day, a week, a month and the year; the
       year carries what restake adds (or, restaking, what it already adds) */
    /* restake's lines stand apart at the foot of the year's box, so its label, figure and unit sit level with the
       other three boxes' */
    var rs = rate > 0 ? '<div class=se-rsx>' + (on ? '<span class=se-rsl>Restaking: <b>+' + one(more / 1e6) + ' ATONE</b> of it from restake</span>'
                            : '<span class=se-rsl>Restake: <b>+' + one(more / 1e6) + ' ATONE</b>, +' + dapr.toFixed(1) + '% APR</span><span class=se-rsl2>auto-compounds reward</span>') + '</div>' : '';
    var A = "var(--sv-amber)";
    return '<div class="sd-figs sd-mv four se-earn">' +
      fig("A day", amt(P(1)), "ATONE", A) + fig("A week", amt(P(7)), "ATONE", A) + fig("A month", amt(P(365 / 12)), "ATONE", A) +
      fig(on ? "A year, restaking" : "A year", amt(Y), "ATONE", A).replace(/<\/div>$/, rs + '</div>') + '</div>' +
      /* the two ways on from here, as Move your stake ends on Redelegate: stake more, claim what has accrued
         (none for the no-wallet example: they name nothing to act on) */
      (ex ? '' : '<div class=se-doors><button class="sv-btn sd-go se-cl" type=button data-act=claim>Claim rewards</button>' +
        '<button class="sv-btn go sd-go se-st" type=button data-act=stake>Stake more</button></div>');
  }

  /* the validators, as a list: logo, name and amount, APR in its heat, share of the stake - every
     one of them, largest first; the list scrolls inside its panel */
  function vlist(rows, total, mark){
    rows = rows.slice().sort(function(a, b){ return b.x - a.x; });
    return '<div class=sd-list>' + rows.map(function(r){ var c = heat(r.inactive ? 0 : r.rate);
      return '<div class="sd-vr click" data-v="' + esc(r.id) + '" tabindex=0 title="Open this validator" style="--c:' + c.fill + '">' +
        '<span class=sv-lgo>' + logo(r.id, r.m) + '</span><span class=sd-vn><b>' + esc(r.m) + (mark && mark[r.id] ? '<i class=sd-al title="in the allow-list">allowed</i>' : '') + '</b>' +
        /* the line under the name in colour: the stake in the Staked amber, its share in teal, a cooldown in violet */
        '<s><em class=a>' + fmt(r.x) + '</em> ATONE, <em class=p>' + (r.x / (total || 1) * 100).toFixed(0) + '%</em>' + (r.locked > 0 ? ', <em class=l>cooldown</em>' : '') + '</s></span>' +
        /* out of the set: "Jailed" when it is, in red; otherwise "Inactive" */
        (r.inactive && ((window.__INACT || {})[r.id] || {}).jailed ? '<u class=jl>Jailed</u>' : '<u style="color:' + c.ink + '">' + (r.inactive ? "Inactive" : pct(r.rate)) + '</u>') + '</div>'; }).join("") + '</div>';
  }
  /* Where the stake sits: the share on the largest, middle and smallest third of the active set (by
     stake, live), and any outside it. The bonus is split equally between validators, so the smallest
     third pays most - and stake there is what decentralizes the chain. With no wallet: all bonded ATONE */
  function footprint(pos){
    var V = VALS(), n = V.length, mine = !!(pos && pos.rows.length);
    var head = '<div class=sv-ph><h3>' + (mine ? "Where your stake sits" : "Where all stake sits") + '</h3></div>';
    if(!n) return head + '<div class=sv-upwait>Reading the set\u2026</div>';
    /* the stake by third of the set (rank order, largest first) - yours with a wallet, all bonded ATONE
       without one */
    var band = function(k){ return k < n / 3 ? 0 : k < 2 * n / 3 ? 1 : 2; };
    var at = {}, x = [], amt = [0, 0, 0], out = 0, tot = 0, i;
    for(i = 0; i < n; i++){ at[V[i][3]] = i; x[i] = mine ? 0 : V[i][1]; }
    if(mine) pos.rows.forEach(function(r){ var k = at[r.id]; if(k == null || r.inactive) out += r.x; else x[k] += r.x; });
    for(i = 0; i < n; i++){ amt[band(i)] += x[i]; tot += x[i]; }
    tot += out;
    var sh = function(v){ var p = tot ? v / tot * 100 : 0; return p > 0 && p < 0.1 ? "<0.1" : p.toFixed(p > 0 && p < 10 ? 1 : 0); };
    var sums = [["Largest third", amt[0], 0], ["Middle third", amt[1], 1], ["Smallest third", amt[2], 2]];
    if(out > 0) sums.push(["Inactive", out, 3]);
    /* a barcode of the set: every validator a thin bar in rank order (largest first); the ones holding
       the stake stand tall and bright, the rest short and dim; brackets under it mark the thirds with
       their shares. Each bar opens its validator's card */
    /* every bar is its validator's own stake - the shape of the set - dim; the ones holding the reader's
       stake light up (no wallet: the whole set lit) */
    var hi = 0; for(i = 0; i < n; i++) if(V[i][1] > hi) hi = V[i][1];
    var held = 0; for(i = 0; i < n; i++) if(x[i] > 0) held++;
    var bars = "";
    for(i = 0; i < n; i++){
      var h = hi ? 8 + 92 * Math.sqrt(V[i][1] / hi) : 8;
      bars += '<i class="fp-b b' + band(i) + (x[i] > 0 ? ' on' : '') + '" data-v="' + esc(V[i][3]) + '" style="height:' + h.toFixed(1) + '%" title="#' + (i + 1) + ' ' + esc(V[i][0]) +
        (x[i] > 0 ? ', ' + fmt(x[i]) + ' ATONE' : '') + '"></i>'; }
    var cut1 = Math.ceil(n / 3), cut2 = Math.ceil(2 * n / 3);
    var span = [cut1, cut2 - cut1, n - cut2, Math.ceil(n / 4)];   /* a fourth box, Inactive, only when some stake sits outside the set */
    /* each third: its coloured bracket line over the bars' span, and a box under it with its share and ATONE */
    /* four boxes share the width equally and take short names, so each label fits; amounts from 10,000 ATONE
       shortened (12.3k, 50.6M), the whole figure in the box's title */
    var four = sums.length > 3, short = ["Largest", "Middle", "Smallest", "Inactive"];
    var br = sums.map(function(q, k){ return '<div class="fp-k b' + k + '" style="flex:' + (four ? 1 : span[k]) + ' 1 0"><div class=fp-kb><em>' + (four ? short[k] : q[0]) + '</em><b class=fpt' + k + '>' + sh(q[1]) + '%</b><small title="' + fmt(q[1]) + ' ATONE">' +
      (q[1] >= 1e10 ? big(q[1]) : fmt(q[1])) + '<i> ATONE</i></small></div></div>'; }).join("");
    return head.replace('</h3></div>', '</h3>' + (mine ? tag("q", held + (held === 1 ? " Validator" : " Validators"), "your stake is on " + held + " of the " + n + " validators") : tag("q", n + " Validators")) + '</div>') +
      '<div class=fp-ax><span>#1 largest</span><span>smallest #' + n + '</span></div><div class=fp-bc>' + bars + '</div>' +
      '<div class=fp-br>' + br + '</div>';
  }

  function vskel(n){ var h = ""; for(var i = 0; i < n; i++) h += '<div class="sd-vr skel"><span class=sv-lgo></span><span class=sd-vn><b></b><s></s></span><u></u></div>'; return '<div class=sd-list>' + h + '</div>'; }

  /* the wallet card under its name: the wallet app and the network, as two chips (the address is in the
     top bar, with its copy button) */
  function wmeta(){
    var W = window.__WALLET, a = window.__ADDR, net = TN() ? "Testnet" : "Mainnet";
    if(!W || !a) return '';
    return '<div class=sd-wmeta><span class=sd-wch><i class=app>' + esc(W.name || "Wallet") + '</i><i class="net' + (TN() ? ' tn' : '') + '">' + net + '</i></span></div>';
  }
  /* the wallet strip, one builder for Overview and Manage: the wallet box, then Total, Staked,
     Available, Rewards and APR, each figure in its engraved well */
  function wstrip(){
    var pos = window.__POS, bal = window.__BAL;
    var mine = pos && pos.rows.length, rew = window.__REW || 0, liq = bal ? bal.uatone : 0, stk = pos ? pos.total : 0;
    var wname = (window.__WALLET && String(window.__WALLET.label || "").trim()) || "Your wallet";
    /* the wallet card, then five boxes - Available, Photon, Staked, APR, Rewards - each figure in its well */
    return (
      '<div class="sd-id sd-idw"><div class=sd-idl><div class=sd-top><h3 title="' + esc(wname) + '"><span class=sv-wn>' + esc(wname) + '</span></h3></div>' + wmeta() + '</div></div>' +
      ro("Available", bal ? fmt(liq) : "\u2014", "", null, "var(--sv-violet)", "", false, bal ? "ATONE" : "") +
      ro("Photon", bal ? '<span class=sv-pho>' + fmt(bal.uphoton) + '</span>' : "\u2014", "", null, "var(--sv-pho)", "", false, "") +
      ro("Staked", pos ? fmt(stk) : "\u2014", "", null, "var(--sv-amber)", "", false, pos ? "ATONE" : "") +
      ro("APR", mine ? '<span style="color:' + heat(pos.rate).ink + '">' + pct(pos.rate) + '</span>' : "\u2014", "", null, "var(--sv-teal)", "", false, "") +
      ro("Rewards", window.__REW != null ? fmt(rew) : "\u2014", "", null, "var(--sv-green)", "", false, window.__REW != null ? "ATONE" : ""));
  }
  function drawOver(){
    var pos = window.__POS, S = setStats(), bal = window.__BAL;
    var mine = pos && pos.rows.length, rew = window.__REW || 0, liq = bal ? bal.uatone : 0, stk = pos ? pos.total : 0, tot = liq + stk + rew;
    put("sd-wstrip", wstrip());

    /* the move */
    var plan = planNow(pos), h = "", byId = {};
    VALS().forEach(function(v){ byId[v[3]] = v; });
    var picks = [];
    if(!pos){
      h = '<div class=sv-ph><h3>What your stake could earn</h3></div>' +
        '<ol class="sv-steps col">' +
          '<li style="--sc:#ffb02e"><b>Connect</b><span>Reads your balance, stake.</span></li>' +
          '<li style="--sc:' + heat(S.mid).fill + '"><b>See what it earns</b><span>a day, a week, a year, in ATONE</span></li>' +
          '<li style="--sc:#2ee06a"><b>Redelegate</b><span>to the best earning place, in single signature</span></li>' +
        '</ol>';
    } else if(!pos.rows.length){
      h = '<div class=sv-none><h3>No stake on AtomOne</h3><button class="sv-btn go" type=button data-act=stake>Stake ATONE</button></div>';
    } else if(!(pos.free > 0)){
      h = '<div class=sv-ph><h3>Everything is under cooldown</h3>' + tag("a", "21 days") + '</div>' +
        fig("Your APR", pct(pos.rate), "on " + pos.rows.length + " validators", heat(pos.rate).fill) +
        fig("Free to move on", window.__dayFull ? window.__dayFull(pos.until) : "—", fmt(pos.total) + " ATONE redelegated recently", "var(--sv-amber)") +
        /* the door stands where it always does, greyed until the stake is free */
        '<button class="sv-btn go sd-go" type=button disabled title="' + esc("Free to move on " + (window.__dayFull ? window.__dayFull(pos.until) : "")) + '">Redelegate</button>';
    } else if(!plan || !(plan.gain > 0.5) || plan.after == null){
      h = '<div class=sv-ph><h3>Nothing to gain by moving</h3></div>' +
        fig("Your APR", '<span style="color:' + heat(pos.rate).ink + '">' + pct(pos.rate) + '</span>', "what your stake earns now", heat(pos.rate).fill) +
        fig("Best in the set", '<span style="color:' + heat(S.hi).ink + '">' + pct(S.hi) + '</span>', "the highest APR any validator pays", heat(S.hi).fill) +
        fig("Can move", fmt(pos.free), "ATONE free to redelegate", "var(--sv-amber)") +
        '<div class=sv-note>Your stake already earns as much as the set can pay it today. This window re-reads the chain every block and will say so when that changes.</div>' + jailNote(pos);
    } else {
      var lift = plan.after - plan.now, hn = heat(plan.now), ha = heat(plan.after);
      picks = plan.picks.map(function(q){ var v = byId[q.id]; return { id: q.id, m: q.m, x: q.x, r: v && window.__rateAfter ? window.__rateAfter(v[1], v[2], q.x) : plan.after }; });
      /* the moves' count rides at the right end of the title row, on the same line */
      h = '<div class="sv-ph sd-mvh"><h3>Move your stake</h3>' + tag("g", "+" + (lift * 100).toFixed(1) + "%<i> APR</i>") +
        /* one wording; the row's own width decides whether the pill stays (container queries), so it never wraps */
        (function(n){ var w = n + ' move' + (n === 1 ? '' : 's');
          return '<span class="sv-tag q sd-mvn" title="' + w + ', 1 signature">' + w + ', 1 signature</span>'; })(plan.moves) + '</div>' +
        '<div class="sd-figs sd-mv">' +
          fig("Now", '<span style="color:' + hn.ink + '">' + pct(plan.now) + '</span>', "on " + pos.rows.length + " validator" + (pos.rows.length === 1 ? "" : "s"), hn.fill) +
          fig("After", '<span style="color:' + ha.ink + '">' + pct(plan.after) + '</span>', "on " + plan.picks.length + " validator" + (plan.picks.length === 1 ? "" : "s"), ha.fill) +
          fig("Gain", '<span class=sd-gain>+' + one(plan.gain) + '</span>', "ATONE a year", "var(--sv-green)") +
        '</div>' +
        '<button class="sv-btn go sd-go" type=button data-act=opt>Redelegate</button>';
    }
    var op = put("sd-move", h); op.classList.toggle("fill", h.indexOf("sv-none") >= 0);

    /* where it earns */
    var rows = pos ? pos.rows : [];
    var aft = picks.length && plan ? plan.after : null;
    var off = 0; rows.forEach(function(r){ if(r.inactive) off += r.x; });
    put("sd-sky", mine
      ? '<div class=sv-ph><h3>What your stake earns</h3>' + (pos.rate > 0 ? tag("a", pct(pos.rate) + " APR", "what your stake earns now") : '') + '</div>' + earns(pos.total, pos.rate, off)
      : (function(){
          /* no wallet: 10,000 ATONE at the best APR it can get, as Move your stake would place it - the optimiser
             picks up to ten validators of the live set, the stake splits equally across them, and each one's rate
             is read after its share lands on it; the APR is their average */
          var X = 1e10, bp = window.__planWith ? window.__planWith(X, { maxVals: 10 }) : null, k = bp && bp.moves ? bp.moves.length : 0, r = 0;
          if(k && window.__rateAfter) bp.moves.forEach(function(q){ r += window.__rateAfter(q.t, q.c, X / k) / k; });
          if(!(r > 0)) r = S.hi;
          return '<div class=sv-ph><h3>What 10,000 ATONE earns</h3>' + (r > 0 ? tag("a", pct(r) + " APR", "the best APR 10,000 ATONE can get today" +
            (k > 1 ? ", split across " + k + " validators" : k === 1 ? ", on one validator" : "") + ", after its own effect on their rates") : '') + '</div>' + earns(X, r, 0, true); })());

    /* the validators */
    put("sd-list", footprint(pos));
  }

  /* the plan is recomputed only when a stake moves or the position is re-read */
  var PC = { key: null, val: null };
  function planNow(pos){
    if(!pos || !(pos.free > 0) || !window.__optPlan) return null;
    /* the answer changes only when a stake moves (anyone's) or the reader's position is re-read -
       not on every block */
    var key = pos.total + "/" + pos.free + "/" + (window.__LIVEV ? window.__LIVEV() : 0) + "/" + (window.__POSAT || 0);
    if(PC.key !== key){ PC.key = key; PC.val = window.__optPlan(false); }
    return PC.val;
  }
  /* the reader's validators with a jailing on record, said plainly - only when there are any:
     a record of Never says nothing */
  function jailNote(pos){
    var V = VALS(), by = {}, i;
    for(i = 0; i < V.length; i++) if(V[i][4]) by[V[i][3]] = V[i][4];
    var js = pos.rows.filter(function(r){ return by[r.id]; }).sort(function(a, b){ return by[b.id] - by[a.id]; });
    if(!js.length) return "";
    var nm = function(r){ return '<b>' + esc(r.m) + '</b>'; };
    return '<div class=sv-jail>' + (js.length === 1
      ? 'Your validator ' + nm(js[0]) + ' has been jailed ' + by[js[0].id] + '× in the past.'
      : 'Your validators ' + js.slice(0, 3).map(function(r){ return nm(r) + ' (' + by[r.id] + '×)'; }).concat(js.length > 3 ? [(js.length - 3) + ' more'] : [])
          .join(", ").replace(/, ([^,]*)$/, " and $1") + ' have been jailed in the past.') + '</div>';
  }
  /* one side of the plan: its APR in its own heat, and the stake as a bar of heat segments */

  /* ── AUTOPILOT: the Wallet's frame - the strip, then what it does, the skyline of what it
     would manage (the allow-list capped in violet once a grant stands), and the validators ── */
  /* ATONE sitting on validators outside the active set today, earning nothing - live from the chain read */
  function idleAtone(){ var L = (window.__D && window.__D.inactive) || [], t = 0; L.forEach(function(v){ t += +v[1] || 0; });
    return t > 1e12 ? (t / 1e12).toFixed(1) + "M" : t > 1e9 ? Math.round(t / 1e9) + "k" : ""; }
  window.__idleAtone = idleAtone;
  function drawAuto(){
    var pos = window.__POS, S = setStats(), at = window.__atInfo ? window.__atInfo() : null, g = at && at.grant;
    var a = g && g.authorization || {}, alist = (a.allow_list || {}).address || [], mark = null;
    if(g && alist.length){ mark = {}; var VD = window.__VDBY || {}; for(var k in VD) if(VD[k].op && alist.indexOf(VD[k].op) >= 0) mark[k] = 1; }
    var until = g && g.expiration && window.__dayFull ? window.__dayFull(new Date(g.expiration).getTime()) : null;
    var rp = at && at.report, moves = rp && rp.history ? rp.history.length : 0, rec = g && rp && rp.record && rp.record.start ? rp.record : null;
    var since = g && at.since ? window.__dayFull(at.since) : null;
    var sgn = function(d){ return (d >= 0 ? "+" : "−") + Math.abs(d * 100).toFixed(1) + "%"; }, sgnA = function(u){ return (u >= 0 ? "+" : "−") + one(Math.abs(u) / 1e6); };
    /* no wallet: no door here - the bar's Connect is the one (as the Stake view's wallet card) */
    var door = !pos ? ''
      : !pos.rows.length ? '<button type=button data-act=stake>Stake ATONE</button>'
      : '<button type=button data-act=autopilot>' + (g ? "Manage" : "Set up") + '</button>';
    /* the strip as the Stake view's: the lead card (name and state on one line, the door under them), then five
       boxes - the figure in its well, the unit beside it, no captions and no gauges */
    put("sd-astrip",
      '<div class="sd-id sd-ida"><div class=sd-top><h3>Autopilot</h3></div><div class=sd-wmeta><span class=sd-wch><i class="st' + (g ? ' on' : '') + '">' + (g ? "Active" : "Inactive") + '</i>' + door + '</span></div></div>' +
      (g ? ro("Since start", rec ? sgn(rec.rate - rec.start.rate) : "\u2014", "", null, "var(--sv-green)", "", false, rec ? "APR" : "")
         : ro("Strategy", "\u2014", "", null, "var(--sv-violet)")) +
      ro("May move", g ? (a.max_tokens ? fmt(+a.max_tokens.amount) : "no cap") : "\u2014", "", null, "var(--sv-violet)", "", false, g && a.max_tokens ? "ATONE" : "") +
      ro("Runs until", until || "\u2014", "", null, "var(--sv-violet)") +
      ro("Moves made", g ? String(moves) : "\u2014", "", null, "var(--sv-teal)") +
      ro("Your APR", pos && pos.rows.length ? '<span style="color:' + heat(pos.rate).ink + '">' + pct(pos.rate) + '</span>' : "\u2014", "", null, "var(--sv-teal)"));
    /* restake, in one line: what it has done, or who does it instead, or that it waits */
    function restakeLine(){
      var rs = rp && rp.restake, ot = at && at.others;
      if(!(at && at.restake)) return ot ? "Another service restakes your rewards." : "";
      if(rs && rs.count) return "Restaked <b>" + fmt(rs.total) + " ATONE</b> of rewards in " + rs.count + " run" + (rs.count === 1 ? "" : "s") + (rs.last_at ? ", last " + window.__dayFull(rs.last_at * 1000) : "") + ".";
      if((rs && /another service/.test(rs.skip || "")) || (ot && ot.all)) return "Another service restakes your rewards, so Autopilot leaves them to it.";
      if(ot) return "Another service restakes your rewards on some validators; Autopilot restakes the rest.";
      return "Restake is on: rewards are staked back as they build up.";
    }
    if(g) put("sd-ado",
      '<div class=sv-ph><h3>Autopilot is working</h3></div>' +
      '<div class=sd-ok>Strategy is active on your stake' + (since ? ' since <b class=d>' + since + '</b>' : '') + (rec ? ', earning <b>' + sgn(rec.rate - rec.start.rate) + ' APR</b> (' + sgnA((rec.rate - rec.start.rate) * rec.staked) +
        ' ATONE a year) since Autopilot started, <b>' + sgn(rec.rate - rec.m3.rate) + '</b> over the last 3 months.' : '.') + '</div>' +
      '<div class="sd-figs two">' +
        fig("Since start", rec ? '<span class=sd-gain>' + sgn(rec.rate - rec.start.rate) + '</span><em class=u>APR</em>' : "—",
            rec ? sgnA((rec.rate - rec.start.rate) * rec.staked) + " ATONE a year" : "from its first check", "var(--sv-green)") +
        fig("Last 3 months", rec ? '<span class=sd-gain>' + sgn(rec.rate - rec.m3.rate) + '</span><em class=u>APR</em>' : "—",
            rec ? sgnA((rec.rate - rec.m3.rate) * rec.staked) + " ATONE a year" : "", "var(--sv-teal)") +
      '</div>' +
      (restakeLine() ? '<div class=sd-rs>' + restakeLine() + '</div>' : '') +
      '<div class=sd-fine>The chain enforces the grant: it may redelegate inside your allow-list, and never send, unstake or hold your ATONE.</div>');
    else {
      /* not active: what it does and what it never does, each as Move your stake shows its figures - four big
         boxes, the same with or without a wallet - and, in place of the list, the way to switch it on */
      var G = "var(--sv-green)", T = "var(--sv-teal)", V = "var(--sv-violet)", R = "#ff6a6a", A2 = "var(--sv-amber)";
      put("sd-ado", '<div class=sv-ph><h3>What it does</h3>' + tag("q", "one signature") + '</div>' +
        '<div class="sd-figs sd-mv four ap-mv">' +
          fig("Keeps stake active", "24/7", idleAtone() ? idleAtone() + " ATONE idle on inactive validators" : "through a long winter or a busy month", T) +
          fig("Strategizes", "Better APR", "within your allow-list", V) +
          fig("Restakes", "Rewards", "if you switch it on", G) +
          fig("You approve", "Once", "it runs while you rest", A2) +
        '</div>');
      var share = at && at.split_pct > 0;
      put("sd-asky", '<div class=sv-ph><h3>What it doesn\'t</h3>' + tag("q", "enforced on chain") + '</div>' +
        '<div class="sd-figs sd-mv four ap-mv">' +
          fig("Send", '<span class=ap-no>Never</span>', "nor spend your ATONE", R) +
          fig("Unstake", '<span class=ap-no>Never</span>', "your stake stays staked", R) +
          fig("Custody", '<span class=ap-no>Never</span>', "your ATONE stays in your wallet", R) +
          fig("GATA's share", share ? at.split_pct + '%' : '<span class=ap-ok>0%</span>', share ? "of the rewards it restakes" : "GATA funds your transactions", A2) +
        '</div>');
      /* the validators only once it is active: until then, the way to switch it on */
      var go = !pos ? '<button class="sv-btn go sd-go ap-go" type=button data-shell-connect>Connect a wallet</button>'
        : !pos.rows.length ? '<button class="sv-btn go sd-go ap-go" type=button data-act=stake>Stake ATONE</button>'
        : '<button class="sv-btn go sd-go ap-go" type=button data-act=autopilot>Activate Autopilot</button>';
      put("sd-alist", '<div class=sv-ph><h3>Validators</h3></div><div class=ap-act><b>Activate Autopilot</b>' +
        '<span>' + (!pos ? 'Connect a wallet, then choose the validators Autopilot may use.' : !pos.rows.length ? 'Stake some ATONE first; Autopilot then keeps it with the better payers.'
          : 'Choose the validators it may use. It keeps your stake with the best of them, and lists them here.') + '</span>' + go + '</div>');
      return;
    }
    var rows = pos ? pos.rows : [];
    put("sd-asky", g ? grantView(g, at, rp, since, until) : wouldDo(pos));
    put("sd-alist", rows.length ? '<div class=sv-ph><h3>Validators</h3>' + tag("q", String(rows.length)) + '</div>' + vlist(rows, pos.total, mark)
      : '<div class=sv-ph><h3>Validators</h3></div>' + (pos ? '<div class=sv-upwait>None yet</div>' : vskel(6)));
  }

  /* Before a grant: what Autopilot would change, in two numbers - where the stake earns now and
     the best it can reach today (the same plan the Wallet's Redelegate uses) - and what that is
     worth a year. */
  function wouldDo(pos){
    var h = '<div class=sv-ph><h3>What Autopilot would do</h3></div>';
    if(!pos){
      /* no wallet: the spread Autopilot works in, as two plain facts - what the largest validator
         pays, and the middle of the set (half pay more). Not the single best payer: that is a
         tiny validator whose rate a real stake would dilute at once, so it would read as a promise */
      var V = VALS(), big = null, S0 = setStats();
      V.forEach(function(v){ if(!big || v[1] > big.t) big = { t: v[1], r: rate0(v[1], v[2]), m: v[0] }; });
      if(!big) return h + '<div class=se-say>Connect a wallet to see what Autopilot would do for your stake.</div>';
      return h + '<div class=se-vs><div><em>The largest validator</em><b style="color:' + heat(big.r).ink + '">' + pct(big.r) + '</b><small>' + esc(big.m) + '</small></div><i aria-hidden=true>\u2192</i>' +
          '<div><em>Half the set pays over</em><b style="color:' + heat(S0.mid).ink + '">' + pct(S0.mid) + '</b><small>of ' + V.length + ' validators</small></div></div>' +
        '<div class=se-say>The same ATONE earns more in some places than others. Autopilot keeps your stake with the better payers, among the validators you allow.' +
        ' Connect a wallet to see it for yours.</div>';
    }
    if(!pos.rows.length) return h + '<div class=se-say>Nothing staked yet, so nothing for it to manage.</div>';
    if(!(pos.free > 0)) return h + '<div class=se-say>Your stake is in its 21-day cooldown until <b>' + (window.__dayFull ? window.__dayFull(pos.until) : "later") + '</b>. Autopilot can move it after that.</div>';
    var plan = planNow(pos), hn = heat(pos.rate);
    if(!plan || !(plan.gain > 0.5) || plan.after == null)
      return h + '<div class=se-vs><div><em>Now</em><b style="color:' + hn.ink + '">' + pct(pos.rate) + '</b></div></div>' +
        '<div class=se-say>Your stake already earns the best it can today. Autopilot keeps it there: when rates change, it moves your stake for you.</div>';
    /* the same cards as Move your stake on the Overview: Now and Best today side by side, the gain under both */
    var ha = heat(plan.after);
    return h + '<div class="sd-figs sd-mv">' +
        fig("Now", '<span style="color:' + hn.ink + '">' + pct(plan.now) + '</span>', "on " + pos.rows.length + " validator" + (pos.rows.length === 1 ? "" : "s"), hn.fill) +
        fig("Best today", '<span style="color:' + ha.ink + '">' + pct(plan.after) + '</span>', "where Autopilot would move it", ha.fill) +
        fig("More a year", '<span class=sd-gain>+' + one(plan.gain) + '</span><i class=u>ATONE</i>', "at today\'s rates", "var(--sv-green)") +
      '</div>' +
      '<div class=se-say>Autopilot moves your stake there, and again whenever rates change. You approve once.</div>';
  }
  /* With a grant: how far along it is, and what it has done - its last three moves in words */
  function grantView(g, at, rp, since, until){
    var t0 = at && at.since, t1 = g.expiration ? new Date(g.expiration).getTime() : null, now = Date.now(), day = 86400000;
    var h = '<div class=sv-ph><h3>Your grant</h3></div>';
    if(t0 && t1 && t1 > t0){
      var tot = Math.max(1, Math.round((t1 - t0) / day)), dn = Math.min(tot, Math.max(1, Math.ceil((now - t0) / day))), left = Math.max(0, Math.ceil((t1 - now) / day));
      h += '<div class=se-time><div class=se-tbar><s style="width:' + (Math.min(1, (now - t0) / (t1 - t0)) * 100).toFixed(1) + '%"></s></div>' +
        '<div class=se-tl><span>' + since + '</span><b>Day ' + dn + ' of ' + tot + ', ' + left + ' day' + (left === 1 ? '' : 's') + ' left</b><span>' + until + '</span></div></div>';
    }
    var name = function(op){ var V = VALS(), id = String(op || "").slice(-6); for(var i = 0; i < V.length; i++) if(V[i][3] === id) return esc(V[i][0]); return id; };
    var hist = (rp && rp.history || []).slice(-3).reverse();
    h += '<div class=se-mv><em>Last moves</em>' + (hist.length ? hist.map(function(m){
        return '<div><u>' + (window.__dayFull ? window.__dayFull(m.at * 1000) : "") + '</u><span><b>' + fmt(m.uatone) + ' ATONE</b> from ' + name(m.src) + ' to ' + name(m.dst) + '</span></div>'; }).join("")
      : '<div class=none>No move yet: your stake already sits where it earns the most.</div>') + '</div>';
    return h;
  }

  function strategyWord(g){
    var a = g && g.authorization || {}, n = ((a.allow_list || {}).address || []).length, V = VALS().length;
    return n >= V ? "Whole set" : n + " of " + V + " validators";
  }

  /* ── NETWORK ────────────────────────────────────────────────────────────── */
  /* the chain's governance at a glance: how many proposals, what is open or how the last ended
     (read once a visit from the chain's API; a proposal takes weeks) */
  function drawNet(){
    var S = setStats(), f = function(v){ return v != null ? v.toFixed(2) + "%" : "—"; };
    /* the set's uptime over three spans now stands on the Uptime graph's rail (drawUp): the block-by-
       block figures it replaced are the Signing tab's */

    drawUp(S);
  }

  /* ── network uptime, live ────────────────────────────────────────────────
     Block by block, the share of the set that signed: the last 100 blocks (live.py publishes
     them in live.json, which every visitor already reads each block). Until that file carries
     them - an older live.py, or dev, which reads production's file - the screen reads the last
     100 blocks itself, two at a time (under the RPC's 20 a second), then one per new block. */
  var FB = { rows: {}, busy: false };
  function fbRows(){
    if(FB.busy) return;
    FB.busy = true;
    fetch("rpc/status", { cache: "no-store" }).then(function(r){ return r.json(); }).then(function(j){
      var head = Number(j.result.sync_info.latest_block_height), want = [], h;
      for(h = head - 99; h <= head; h++) if(!FB.rows[h]) want.push(h);
      for(var k in FB.rows) if(+k <= head - 100) delete FB.rows[k];
      var next = function(){
        var hh = want.shift(); if(hh === undefined) return Promise.resolve();
        return fetch("rpc/block?height=" + hh, { cache: "no-store" }).then(function(r){ return r.json(); }).then(function(b){
          var sigs = b.result.block.last_commit.signatures || [], miss = [];
          sigs.forEach(function(x){ if(x.block_id_flag !== 2 && x.validator_address) miss.push(x.validator_address); });
          if(sigs.length) FB.rows[hh] = [hh - 1, sigs.length - miss.length, sigs.length, miss.join(","), Date.parse(b.result.block.header.time)];
        }).catch(function(){}).then(next);
      };
      return Promise.all([next(), next()]);
    }).catch(function(){}).then(function(){ FB.busy = false; if(screen() === "net") drawUp(setStats()); });
  }
  /* the window every Network figure speaks of: the last 100 blocks, whatever the feed carries */
  var WIN = 100;
  function upRows(){
    var r = window.__UP && window.__UP.length ? window.__UP
      : Object.keys(FB.rows).map(Number).sort(function(a, b){ return a - b; }).map(function(k){ return FB.rows[k]; });
    return r.length > WIN ? r.slice(-WIN) : r;
  }
  var UPHOVER = -1;
  /* consensus address (hex) -> the validator's id, name */
  function consIndex(){
    var VD = window.__VDBY || {}, m = {}, k;
    for(k in VD) if(VD[k].chex) m[String(VD[k].chex).toUpperCase()] = { id: k, m: VD[k].m };
    return m;
  }
  function drawUp(S){
    var rows = upRows();
    /* an older live.json has no block times: the fallback reads them for Chain pace */
    if(!window.__UP || !timed(window.__UP)) fbRows();
    drawPace();
    var head = '<div class=sv-ph><h3>Uptime</h3>';
    if(!rows.length){
      put("sv-up", head + '</div><div class=sv-upwait>Reading the latest blocks…</div>');
      return;
    }
    var n = rows.length, pc = rows.map(function(r){ return r[2] ? r[1] / r[2] * 100 : 100; });
    var last = rows[n - 1], now = pc[n - 1], avg = 0, ref = S.up != null ? S.up : null;
    pc.forEach(function(v){ avg += v; }); avg /= n;
    var lo = Math.max(0, Math.min(95, Math.floor(Math.min.apply(null, pc.concat(ref != null ? [ref] : [])) - 1)));
    var H = function(v){ return ((v - lo) / (100 - lo) * 100).toFixed(2); };
    var ix = consIndex(), who = function(a){ return ix[a.toUpperCase()] || { id: null, m: a.slice(0, 8) + "…" }; };
    var mins = Math.round(n * 6 / 60);
    /* one bar per block, oldest on the left: the signed share in teal, the missing share in red
       above it. A block someone missed carries that validator's mark on the plot, named where
       there is room (newest first, a label every ~11% of the width). */
    var bars = rows.map(function(r, i){
      var missed = r[1] < r[2];
      return '<i class="' + (missed ? "miss" : "") + (i === n - 1 ? " tip" : "") + (i === UPHOVER ? " on" : "") + '" style="--h:' + H(pc[i]) + '%" data-i="' + i + '"></i>'; }).join("");
    /* the misses on the plot, as clusters: misses closer than a label's room are one mark at
       their middle - each validator's logo once (three at most, overlapping), then the names,
       two and a count of the rest. A label that would run into the next mark shortens to one
       name and a count, then to logos alone; the tooltip always names everyone and the blocks. */
    var cl = [], W = Math.max(300, ((E("sv-up") || {}).clientWidth || 1200) - 32), px = function(p){ return p / 100 * W; };
    for(var i = n - 1; i >= 0; i--){
      var r = rows[i]; if(!(r[1] < r[2]) || !r[3]) continue;
      var x = (i + .5) / n * 100, c = cl[cl.length - 1];
      if(!c || px(c.lo - x) > 150) cl.push(c = { lo: x, hi: x, vs: [], seen: {}, blocks: [] });
      c.lo = x; c.blocks.push(Number(r[0]));
      r[3].split(",").map(who).forEach(function(v){ var k = v.id || v.m; if(!c.seen[k]){ c.seen[k] = 1; c.vs.push(v); } });
    }
    cl.reverse();                                   /* oldest first, so each knows the next one's place */
    var lab = function(c, full){ var k = c.vs.length, nm = c.vs.slice(0, full ? 2 : 1).map(function(v){ return v.m; }).join(", ");
      var rest = k - (full ? 2 : 1); return nm + (rest > 0 ? " +" + rest : ""); };
    var marks = cl.map(function(c, ci){
      var x = (c.lo + c.hi) / 2, rt = x > 80, nx = cl[ci + 1], room = nx ? px((nx.lo + nx.hi) / 2 - x) - 30 : 1e9;
      var lg = Math.min(3, c.vs.length), lw = 20 + (lg - 1) * 13 + 6, txt = lab(c, true);
      if(!rt && lw + txt.length * 6.3 > room) txt = lab(c, false);
      if(!rt && lw + txt.length * 6.3 > room) txt = "";
      return '<span class="sv-upm' + (txt ? "" : " bare") + (rt ? " rt" : "") + '" style="left:' + x.toFixed(2) + '%" title="' +
        esc(c.vs.map(function(v){ return v.m; }).join(", ") + " missed block" + (c.blocks.length > 1 ? "s " : " ") +
          c.blocks.slice().reverse().map(function(b){ return b.toLocaleString(); }).join(", ")) + '">' +
        '<span class=sv-uplgs>' + c.vs.slice(0, 3).map(function(v){ return '<span class=sv-uplg>' + logo(v.id, v.m) + '</span>'; }).join("") + '</span>' +
        (txt ? '<b>' + esc(txt) + '</b>' : "") + '</span>';
    }).join("");
    var hv = UPHOVER >= 0 && UPHOVER < n ? rows[UPHOVER] : null;
    put("sv-up", head +
        '<span class=sv-upwin>last ' + n + ' blocks ~' + mins + ' min</span>' +
        '<div class=sv-rt>' +
          /* the validator set's average uptime over three spans, and how many never went to jail in each */
          (TN() ? st("30 days", NA, "on testnet") + st("90 days", NA) + st("Since genesis", NA)
            : st("30 days", S.up != null ? S.up.toFixed(2) + "%" : "\u2014", S.clean30 + " never jailed") +
              st("90 days", S.up90 != null ? S.up90.toFixed(2) + "%" : "\u2014", S.clean90 + " never jailed") +
              st("Since genesis", S.life != null ? S.life.toFixed(2) + "%" : "\u2014", S.clean + " never jailed")) +
        '</div></div>' +
      '<div class=sv-upchart>' +
        '<div class=sv-upmarks>' + marks + '</div>' +
        '<div class=sv-upplot>' +
          '<span class=sv-upy style="bottom:100%">100%</span><span class=sv-upy style="bottom:0">' + lo + '%</span>' +
          (ref != null ? '<span class=sv-upref style="bottom:' + H(ref) + '%"><b>30-day ' + ref.toFixed(2) + '%</b></span>' : '') +
          '<div class=sv-upbars>' + bars + '</div>' +
          (hv ? '<div class=sv-uptip style="left:' + Math.min(76, Math.max(0, (UPHOVER + .5) / n * 100 - 12)).toFixed(1) + '%"><b>block ' + Number(hv[0]).toLocaleString() + '</b>' +
            hv[1] + ' of ' + hv[2] + ' signed' + (hv[3] ? '<br>missed by ' + esc(hv[3].split(",").map(function(a){ return who(a).m; }).join(", ")) : '') + '</div>' : '') +
        '</div>' +
        '<div class=sv-upx><span>&larr; older<i class=bn>, block ' + Number(rows[0][0]).toLocaleString() + '</i></span><span>now<i class=bn>, block ' + Number(last[0]).toLocaleString() + '</i> &rarr;</span></div>' +
      '</div>');
  }
  function timed(r){ return r && r.length > 1 && r[r.length - 1][4] > 0; }

  /* ── chain pace: the block time over the window (from the block times live.json carries, or
     the fallback's own reads), blocks a day measured over the last 24 hours (one read of the
     block ~14,400 back, every ten minutes), and each interval as a bar ── */
  var DAY = { at: 0, avg: null };
  function readDay(){
    if(DAY.at && Date.now() - DAY.at < 600000) return;
    DAY.at = Date.now();
    fetch("rpc/status", { cache: "no-store" }).then(function(r){ return r.json(); }).then(function(j){
      var head = +j.result.sync_info.latest_block_height, t1 = Date.parse(j.result.sync_info.latest_block_time), back = 14400;
      return fetch("rpc/block?height=" + (head - back), { cache: "no-store" }).then(function(r){ return r.json(); }).then(function(b){
        var t0 = Date.parse(b.result.block.header.time);
        if(t1 > t0) DAY.avg = (t1 - t0) / 1000 / back;
        if(screen() === "net") drawPace();
      });
    }).catch(function(){ DAY.at = 0; });
  }
  function drawPace(){
    readDay();
    var src = (timed(window.__UP) ? window.__UP : Object.keys(FB.rows).map(Number).sort(function(a, b){ return a - b; }).map(function(k){ return FB.rows[k]; })).slice(-WIN);
    var iv = [], i;
    for(i = 1; i < src.length; i++) if(src[i][4] && src[i - 1][4] && src[i][0] === src[i - 1][0] + 1) iv.push({ h: src[i][0] + 1, s: (src[i][4] - src[i - 1][4]) / 1000 });
    var h = '<div class=sv-ph><h3>Chain pace</h3></div>';
    if(iv.length < 2){ put("sv-pace", h + '<div class=sv-upwait>Reading block times…</div>'); return; }
    var sum = 0, mx = 0, slow = iv[0]; iv.forEach(function(x){ sum += x.s; if(x.s > mx){ mx = x.s; slow = x; } });
    var avg = sum / iv.length, top = mx * 1.08;
    h = '<div class=sv-ph><h3>Chain pace</h3><div class=sv-rt>' +
      st("Block time", avg.toFixed(2) + " s", "slowest " + slow.s.toFixed(1) + " s") +
      st("Blocks a day", DAY.avg ? Math.round(86400 / DAY.avg).toLocaleString() : "—", DAY.avg ? "last 24 hours" : "measuring…") +
      st("Total blocks", Number(src[src.length - 1][0] + 1).toLocaleString(), (DD().coverage || {}).from_date ? "since " + DD().coverage.from_date : "since genesis") +
    '</div></div>' +
    '<div class=sv-pace><span class=sv-pavg style="bottom:' + (avg / top * 100).toFixed(1) + '%"><b>' + avg.toFixed(1) + ' s</b></span>' +
      iv.map(function(x){ return '<i class="' + (x.s > avg * 1.5 ? "slow" : "") + '" style="--h:' + Math.max(4, x.s / top * 100).toFixed(1) + '%" data-t="block ' + x.h.toLocaleString() + ': ' + x.s.toFixed(2) + ' s"></i>'; }).join("") +
    '</div>';
    put("sv-pace", h);
  }

  /* ════ the Network tabs past Uptime: Signing, Proposers, Activity, Economics ════ */
  /* every figure on Network is a readout hanging from its panel's lit top edge: the label, the
     value, a line under it, centred, in its own colour (--rc) */
  function st(label, value, meta, sw){
    return '<span class=sv-rd' + (sw ? ' style="--rc:' + sw + '"' : '') + '><em>' + label + '</em><b>' + value + '</b>' + (meta ? '<small>' + meta + '</small>' : '') + '</span>';
  }
  var DAYN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function big(u){ var a = u / 1e6; return a >= 1e6 ? (a / 1e6).toFixed(1) + "M" : a >= 1e3 ? (a / 1e3).toFixed(1) + "k" : a.toFixed(1); }
  function isDay(){ return root.getAttribute("data-theme") === "light"; }
  /* the proposer a live row points at: its index into live.json's px, then the set */
  function proposer(r, ix){ var hx = r && r[5] != null && window.__PX ? window.__PX[r[5]] : null;
    return hx ? (ix[String(hx).toUpperCase()] || { id: null, m: String(hx).slice(0, 8) + "…" }) : null; }
  function live(r){ return r && r.length > 6; }

  /* ── Signing: every validator by every block of the window, a missed signature red.
     Missers first (most first), then by stake. One canvas: 100 rows by 100 blocks is
     12,000 cells, redrawn each block ── */
  var SG = { list: [], rows: [] };
  function drawSign(){
    var rows = upRows(), n = rows.length, V = VALS(), VD = window.__VDBY || {}, miss = {}, tot = 0;
    if(!window.__UP || !timed(window.__UP)) fbRows();
    rows.forEach(function(r, i){ if(r[3]) r[3].split(",").forEach(function(a){ if(!a) return; a = a.toUpperCase(); (miss[a] = miss[a] || {})[i] = 1; tot++; }); });
    var list = V.map(function(v){ var d = VD[v[3]] || {}, hx = String(d.chex || "").toUpperCase(), m = miss[hx] || {};
      return { id: v[3], m: v[0], t: +v[1], miss: m, k: Object.keys(m).length }; })
      .sort(function(a, b){ return b.k - a.k || b.t - a.t; });
    var bad = list.filter(function(x){ return x.k; });
    SG.list = list; SG.rows = rows;
    var h = '<div class=sv-ph><h3>Signing</h3><span class=sv-gkey><i class=ok></i>signed<i class=bad></i>missed</span><div class=sv-rt>' +
      st("Signed", (list.length - bad.length) + " of " + list.length, n ? "last " + n + " blocks" : "reading the blocks…") +
      st("Missed signatures", n ? String(tot) : "—", !n ? "" : tot ? "across " + bad.length + " validator" + (bad.length === 1 ? "" : "s") : "none in the window", "#ff4d1f") +
      st("Most missed", bad.length ? esc(bad[0].m) : n ? "none" : "—", bad.length ? bad[0].k + " of " + n + " blocks" : n ? "all signed" : "", "#ff4d1f") + '</div></div>';
    if(!n){ put("sv-signp", h + '<div class=sv-upwait>Reading the latest blocks…</div>'); return; }
    h += '<div class=sv-grid><div class=sv-gnames>' + list.map(function(x){
        return '<div class="sv-gn' + (x.k ? ' bad' : '') + '" data-v="' + esc(x.id) + '" title="Open ' + esc(x.m) + '"><span class=sv-lgo>' + logo(x.id, x.m) + '</span><b>' + esc(x.m) + '</b>' + (x.k ? '<em>' + x.k + '</em>' : '') + '</div>'; }).join("") +
      '</div><div class=sv-gcw><canvas class=sv-gc aria-label="Signatures by block"></canvas></div></div>' +
      '<div class=sv-gx><span>&larr; older, block ' + Number(rows[0][0]).toLocaleString() + '</span><span class=sv-gtip id=sv-signtip></span><span>now, block ' + Number(rows[n - 1][0]).toLocaleString() + ' &rarr;</span></div>';
    put("sv-signp", h);
    paintSign();
  }
  function paintSign(){
    var c = document.querySelector("#sv-signp .sv-gc"); if(!c) return;
    var list = SG.list, n = SG.rows.length, w = c.parentNode.clientWidth, RH = 16, dpr = window.devicePixelRatio || 1;
    if(!w || !n) return;
    c.style.width = w + "px"; c.style.height = list.length * RH + "px";
    c.width = Math.round(w * dpr); c.height = Math.round(list.length * RH * dpr);
    var g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, list.length * RH);
    var cw = w / n, gap = cw > 4 ? 1 : 0, ok = isDay() ? "rgba(15,94,80,.55)" : "rgba(43,200,189,.45)", bad = "#ff4d1f";
    list.forEach(function(x, ri){
      var y = ri * RH + 2;
      for(var i = 0; i < n; i++){ g.fillStyle = x.miss[i] ? bad : ok; g.fillRect(i * cw, y, Math.max(1, cw - gap), RH - 4); }
    });
  }
  function signTip(ev){
    var c = ev.target; if(!c.classList || !c.classList.contains("sv-gc")) return;
    var r = c.getBoundingClientRect(), n = SG.rows.length, i = Math.floor((ev.clientX - r.left) / r.width * n), ri = Math.floor((ev.clientY - r.top) / 16);
    var x = SG.list[ri], t = E("sv-signtip"); if(!t) return;
    t.textContent = x && SG.rows[i] ? "block " + Number(SG.rows[i][0]).toLocaleString() + ": " + x.m + (x.miss[i] ? " missed" : " signed") : "";
  }

  /* ── Proposers: who made the latest blocks (live), and blocks proposed per validator over the
     last 24 hours or since genesis (a switch), with each one's share of all the blocks ── */
  var PW = (function(){ try{ return localStorage.getItem("th_pw") === "all" ? "all" : "24h"; }catch(e){ return "24h"; } })();
  function drawProp(){
    var rows = upRows(), ix = consIndex(), V = VALS(), VD = window.__VDBY || {}, D = DD(), p24 = D.p24 || null, pa = D.prop_all || null;
    var all = PW === "all", list = [], got = 0, ever = 0;
    if(all){ V.forEach(function(v){ var c = +((VD[v[3]] || {}).prop || 0); list.push({ id: v[3], m: v[0], c: c }); });
      got = pa ? pa.blocks : list.reduce(function(a, x){ return a + x.c; }, 0); ever = pa ? pa.proposers : list.length; }
    else if(p24){ for(var k in p24){ got += p24[k]; ever++; }
      V.forEach(function(v){ var d = VD[v[3]] || {}; list.push({ id: v[3], m: v[0], c: p24[String(d.chex || "").toUpperCase()] || 0 }); }); }
    list.sort(function(a, b){ return b.c - a.c; });
    var top = list[0], since = (D.coverage || {}).from_date, have = all ? list.length : !!p24;
    var stats = '<div class=sv-rt>' +
      st("Blocks", have ? got.toLocaleString() : "—", all ? "since genesis" + (since ? ", " + since : "") : "last 24 hours, one every " + (got ? (86400 / got).toFixed(1) : "—") + " s") +
      st("Proposers", have ? ever.toLocaleString() : "—", all ? "validators that ever proposed" : "validators that proposed", "var(--sv-violet)") +
      st("Top proposer", top && top.c ? esc(top.m) : "—", top && top.c ? top.c.toLocaleString() + " blocks, " + (top.c / got * 100).toFixed(1) + "%" : "", "var(--sv-amber)") + '</div>';
    /* the latest blocks, newest on the right */
    var lv = rows.filter(live), last = lv.slice(-(innerWidth <= 620 ? 8 : 24));
    put("sv-proplive", '<div class=sv-ph><h3>Latest blocks</h3></div>' + (last.length ? '<div class=sv-plive>' + last.map(function(r){ var p = proposer(r, ix) || { m: "?" };
        return '<div class=sv-pb' + (p.id ? ' data-v="' + esc(p.id) + '"' : '') + ' title="block ' + Number(r[0] + 1).toLocaleString() + ' by ' + esc(p.m) + '"><span class=sv-lgo>' + logo(p.id, p.m) + '</span><b>' + esc(p.m) + '</b><s>' + Number(r[0] + 1).toLocaleString() + '</s></div>'; }).join("") + '</div>'
      : '<div class=sv-upwait>Waiting for the live feed…</div>'));
    var sw = '<span class=sv-sw role=group aria-label="Period">' +
      '<button type=button data-act=pwin data-w=24h aria-pressed=' + !all + '>24 hours</button><button type=button data-act=pwin data-w=all aria-pressed=' + all + '>Since genesis</button></span>';
    if(TN()){
      stats = '<div class=sv-rt>' + st("Blocks", NA, "on testnet") + st("Proposers", NA, "", "var(--sv-violet)") + st("Top proposer", NA, "", "var(--sv-amber)") + '</div>';
      put("sv-prop24", '<div class=sv-ph><h3>Blocks proposed</h3>' + stats + '</div>' + NAMSG); return;
    }
    var head = '<div class=sv-ph><h3>Blocks proposed</h3>' + sw + stats + '</div>';
    if(!have){ put("sv-prop24", head + '<div class=sv-upwait>Reading the last 24 hours…</div>'); return; }
    var mx = Math.max(1, top ? top.c : 1);
    put("sv-prop24", head + '<div class="sv-vlist sv-plist">' + list.map(function(x){
        return '<div class="sv-vr click" data-v="' + esc(x.id) + '" tabindex=0 style="--c:var(--sv-teal)"><span class=sv-lgo>' + logo(x.id, x.m) + '</span><b class=sv-vn>' + esc(x.m) + '</b>' +
          '<s class=sv-va>' + x.c.toLocaleString() + '<em>blocks</em></s>' +
          '<span class=sv-vs><span class=sv-vt><i style="width:' + (x.c / mx * 100).toFixed(1) + '%"></i></span></span>' +
          '<u>' + (got ? (x.c / got * 100).toFixed(2) + "%" : "—") + '</u></div>'; }).join("") + '</div>');
  }

  /* ── Activity: transactions per hour over the last 24 hours, or per day since genesis (a line),
     from the indexer; and per block, live ── */
  var AW = (function(){ try{ var v = localStorage.getItem("th_aw"); return v === "30d" || v === "all" ? v : "24h"; }catch(e){ return "24h"; } })();
  var BW = (function(){ try{ var v = localStorage.getItem("th_bw"); return v === "10k" || v === "all" ? v : "100"; }catch(e){ return "100"; } })();
  function drawAct(){
    var D = DD(), a24 = D.act7 ? D.act7.slice(-24) : null, td = D.txday || null, rows = upRows().filter(live), tx = 0, fee = 0, gas = 0;
    rows.forEach(function(r){ tx += r[6]; if(r[8] > 0) fee += r[8]; if(r[7] > 0) gas += r[7]; });
    var when = function(ts){ var d = new Date(ts * 1000); return DAYN[d.getDay()] + " " + String(d.getHours()).padStart(2, "0") + ":00"; };
    var dl = function(s){ return new Date(s + "T00:00:00Z").toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); };
    var all = AW === "all", tot = 0, bl = 0, top = null, stats, body;
    if(TN()){ AW = "24h"; if(BW !== "100") BW = "100"; }
    var sw = '<span class=sv-sw role=group aria-label="Period">' + [["24h", "24 hours"], ["30d", "30 days"], ["all", "Since genesis"]].map(function(o){
      return '<button type=button data-act=awin data-w=' + o[0] + ' aria-pressed=' + (AW === o[0]) + '>' + o[1] + '</button>'; }).join("") + '</span>';
    if(all){
      if(td) td.forEach(function(x){ tot += x[1]; bl += x[2]; if(!top || x[1] > top[1]) top = x; });
      var since = (D.coverage || {}).from_date;
      stats = '<div class=sv-rt>' + st("Transactions", td ? tot.toLocaleString() : "—", since ? "since " + since : "since genesis") +
        st("Busiest day", top ? top[1].toLocaleString() : "—", top ? dl(top[0]) : "") +
        st("Per block", td && bl ? (tot / bl).toFixed(2) : "—", td ? "average over " + bl.toLocaleString() + " blocks" : "") + '</div>';
      body = td && td.length > 1 ? chart("txday", td.map(function(x){ return { d: x[0], tx: x[1] }; }), [{ k: "tx", cls: "txl", area: true, name: "" }],
          function(v){ return v <= 0 ? "0" : v >= 1000 ? Math.round(v / 1000) + "k" : String(Math.round(v)); },
          function(v){ return Math.round(v).toLocaleString() + " transactions"; })
        : '<div class=sv-upwait>Reading the history…</div>';
    } else if(AW === "30d"){
      var d30 = td ? td.slice(-30) : null;
      if(d30) d30.forEach(function(x){ tot += x[1]; bl += x[2]; if(!top || x[1] > top[1]) top = x; });
      stats = '<div class=sv-rt>' + st("Transactions", d30 ? tot.toLocaleString() : "—", d30 ? "about " + Math.round(tot / Math.max(1, d30.length)).toLocaleString() + " a day" : "") +
        st("Busiest day", top ? top[1].toLocaleString() : "—", top ? dl(top[0]) : "") +
        st("Per block", d30 && bl ? (tot / bl).toFixed(2) : "—", d30 ? "average over " + bl.toLocaleString() + " blocks" : "") + '</div>';
      if(d30 && d30.length){
        var m30 = Math.max(1, Math.max.apply(null, d30.map(function(x){ return x[1]; }))), t30 = "";
        d30.forEach(function(x, i){ if(i % 7 === 0) t30 += '<span style="left:' + (i / d30.length * 100).toFixed(2) + '%">' + new Date(x[0] + "T00:00:00Z").toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" }) + '</span>'; });
        body = '<div class="sv-bars hr">' + bscale(m30, function(v){ return Math.round(v).toLocaleString(); }, true) + d30.map(function(x, i){ var so = i === d30.length - 1;
          return '<i' + (so ? ' class=so' : '') + ' style="--h:' + Math.max(1.5, x[1] / m30 * 100).toFixed(1) + '%" data-t="' + dl(x[0]) + ": " + x[1].toLocaleString() + ' transactions' + (so ? ' so far' : '') + '"></i>'; }).join("") + '</div><div class=sv-bx>' + t30 + '</div>';
      } else body = '<div class=sv-upwait>Reading the last 30 days…</div>';
    } else {
      if(a24) a24.forEach(function(x){ tot += x[1]; bl += x[2]; if(!top || x[1] > top[1]) top = x; });
      stats = '<div class=sv-rt>' + st("Transactions", a24 ? tot.toLocaleString() : "—", a24 ? "about " + Math.round(tot / Math.max(1, a24.length)) + " an hour" : "") +
        st("Busiest hour", top ? top[1].toLocaleString() : "—", top ? when(top[0]) : "") +
        st("Per block", a24 && bl ? (tot / bl).toFixed(2) : "—", a24 ? "average over " + bl.toLocaleString() + " blocks" : "") + '</div>';
      if(a24 && a24.length){
        var m = Math.max(1, Math.max.apply(null, a24.map(function(x){ return x[1]; }))), ticks = "";
        a24.forEach(function(x, i){ var d = new Date(x[0] * 1000); if(d.getHours() % 6 === 0) ticks += '<span style="left:' + (i / a24.length * 100).toFixed(2) + '%">' + (d.getHours() ? String(d.getHours()).padStart(2, "0") + ":00" : DAYN[d.getDay()] + " " + d.getDate()) + '</span>'; });
        body = '<div class="sv-bars hr">' + bscale(m, function(v){ return String(Math.round(v)); }, true) + a24.map(function(x, i){ var so = i === a24.length - 1; return '<i' + (so ? ' class=so' : '') + ' style="--h:' + Math.max(1.5, x[1] / m * 100).toFixed(1) + '%" data-t="' + when(x[0]) + ": " + x[1] + ' transactions' + (so ? ' so far' : '') + '"></i>'; }).join("") + '</div><div class=sv-bx>' + ticks + '</div>';
      } else body = '<div class=sv-upwait>Reading the last 24 hours…</div>';
    }
    if(TN()){ stats = '<div class=sv-rt>' + st("Transactions", NA, "on testnet") + st("Busiest hour", NA) + st("Per block", NA) + '</div>'; body = NAMSG; sw = ""; }
    /* the unit stands right after the title, ahead of the switch - the same in both panels */
    put("sv-act7", '<div class=sv-ph><h3>Transactions</h3><span class=sv-gkey>' + (AW === "24h" ? "per hour" : "per day") + '</span>' + sw + stats + '</div>' + body);
    /* per block: the last 100 blocks live (with gas and fees), the last 10,000 in stretches of 100
       (the average per block in each), or per day since genesis (a line) - the indexer keeps
       transactions, not gas or fees */
    var bw = BW, sb = '<span class=sv-sw role=group aria-label="Period">' + [["100", "Last 100 blocks"], ["10k", "Last 10k blocks"], ["all", "Since genesis"]].map(function(o){
      return '<button type=button data-act=bwin data-w=' + o[0] + ' aria-pressed=' + (bw === o[0]) + '>' + o[1] + '</button>'; }).join("") + '</span>';
    if(TN()) sb = "";           /* testnet: only the live 100 blocks are known */
    var hb = function(k){ return '<div class=sv-ph><h3>Transactions</h3><span class=sv-gkey>per 100 blocks</span>' + sb + k + '</div>'; }, sl, lb;
    if(bw === "100"){
      sl = '<div class=sv-rt>' + st("Transactions", rows.length ? tx.toLocaleString() : "—", rows.length ? "last " + rows.length + " blocks" : "", "var(--sv-violet)") +
        st("Gas used", rows.length ? (gas / 1e6).toFixed(1) + "M" : "—", rows.length ? "of " + (rows.length * 100).toLocaleString() + "M capacity" : "", "var(--sv-violet)") +
        st("Fees paid", rows.length ? (fee / 1e6).toFixed(2) + " PHOTON" : "—", rows.length ? "last " + rows.length + " blocks" : "", "var(--sv-pho)") + '</div>';
      if(rows.length){
        var mb = Math.max(1, Math.max.apply(null, rows.map(function(r){ return r[6]; })));
        lb = '<div class="sv-bars live">' + bscale(mb, function(v){ return String(Math.round(v)); }, true) + rows.map(function(r){ return '<i class="' + (r[6] ? "" : "z") + '" style="--h:' + (r[6] ? Math.max(6, r[6] / mb * 100) : 3).toFixed(1) + '%" data-t="block ' + Number(r[0] + 1).toLocaleString() + ": " + r[6] + " transaction" + (r[6] === 1 ? "" : "s") +
            (r[6] ? ", " + (r[7] >= 0 ? r[7].toLocaleString() + " gas, " + (r[8] / 1e6).toFixed(3) + " PHOTON" : "gas unknown") : "") + '"></i>'; }).join("") + '</div>' +
          '<div class=sv-gx><span>&larr; older, block ' + Number(rows[0][0] + 1).toLocaleString() + '</span><span>now, block ' + Number(rows[rows.length - 1][0] + 1).toLocaleString() + ' &rarr;</span></div>';
      } else lb = '<div class=sv-upwait>Waiting for the live feed…</div>';
    } else if(bw === "10k"){
      var bk = D.b10k || [], T = 0, B = 0, NZ = 0, pk = null;
      bk.forEach(function(x){ T += x[1]; B += x[2]; NZ += x[3]; var r = x[2] ? x[1] / x[2] : 0; if(!pk || r > pk.r) pk = { h: x[0], r: r, b: x[2] }; });
      var span = function(h, b){ return Number(h).toLocaleString() + "–" + Number(h + b - 1).toLocaleString(); };
      sl = '<div class=sv-rt>' + st("Per 100 blocks", B ? (T / B * 100).toFixed(1) : "—", B ? T.toLocaleString() + " in " + B.toLocaleString() + " blocks" : "", "var(--sv-violet)") +
        st("Busiest 100", pk ? String(Math.round(pk.r * pk.b)) : "—", pk ? "blocks " + Number(pk.h).toLocaleString() + " on" : "", "var(--sv-violet)") +
        st("With transactions", B ? NZ.toLocaleString() : "—", B ? "of " + B.toLocaleString() + " blocks" : "") + '</div>';
      if(bk.length){
        var m3 = Math.max(1, Math.max.apply(null, bk.map(function(x){ return x[1]; })));
        lb = '<div class="sv-bars live">' + bscale(m3, function(v){ return String(Math.round(v)); }, true) + bk.map(function(x){
            return '<i class="' + (x[1] ? "" : "z") + '" style="--h:' + (x[1] ? Math.max(3, x[1] / m3 * 100) : 2).toFixed(1) + '%" data-t="blocks ' + span(x[0], x[2]) + ": " + x[1] + " transaction" + (x[1] === 1 ? "" : "s") + ", in " + x[3] + " block" + (x[3] === 1 ? "" : "s") + '"></i>'; }).join("") + '</div>' +
          '<div class=sv-gx><span>&larr; older, block ' + Number(bk[0][0]).toLocaleString() + '</span><span>block ' + Number(bk[bk.length - 1][0] + bk[bk.length - 1][2] - 1).toLocaleString() + ' &rarr;</span></div>';
      } else lb = '<div class=sv-upwait>Reading the last 10,000 blocks…</div>';
    } else {
      var src = (td || []).map(function(x){ return { k: x[0], t: x[1], b: x[2] }; });
      var T = 0, B = 0, pk = null; src.forEach(function(x){ T += x.t; B += x.b; var r = x.b ? x.t / x.b : 0; if(!pk || r > pk.r) pk = { k: x.k, r: r }; });
      sl = '<div class=sv-rt>' + st("Per 100 blocks", B ? (T / B * 100).toFixed(1) : "—", "since genesis", "var(--sv-violet)") +
        st("Busiest day", pk ? (pk.r * 100).toFixed(0) : "—", pk ? dl(pk.k) + ", per 100 blocks" : "", "var(--sv-violet)") +
        st("Transactions", B ? T.toLocaleString() : "—", "since genesis") + '</div>';
      lb = src.length ? chart("tpb", src.map(function(x){ return { d: x.k, r: x.b ? x.t / x.b * 100 : 0 }; }), [{ k: "r", cls: "tpb", area: true }], function(v){ return v <= 0 ? "0" : String(Math.round(v)); },
          function(v){ return v.toFixed(1) + " per 100 blocks"; }) : '<div class=sv-upwait>Reading the history…</div>';
    }
    put("sv-actlive", hb(sl) + lb);
  }

  /* ── Economics: today's supply, stake and pools, and their history (weekly from genesis,
     daily since 2026-09-26) as lines ── */
  /* a line chart: one SVG in a stretched viewBox for the shapes, the scale and the reading in
     HTML so they keep their size. Four labelled levels up the side (0, a third, two thirds, the
     top) with their gridlines; hovering reads the point under the cursor - a line down the plot,
     a dot on each series, the date and each value. key names the chart for the hover's lookup. */
  var CH = {};
  function chart(key, pts, lines, fmtY, fmtV){
    var n = pts.length; if(n < 2) return TN() ? '<div class=sv-upwait>History N/A on testnet</div>' : '<div class=sv-upwait>Not enough history yet</div>';
    var lo = Infinity, hi = -Infinity;
    lines.forEach(function(l){ pts.forEach(function(p){ var v = p[l.k]; if(v < lo) lo = v; if(v > hi) hi = v; }); });
    if(lines.some(function(l){ return l.area; })) lo = Math.min(lo, 0);
    /* a round scale: three or four steps of 1, 2, 2.5 or 5 x a power of ten, so the axis reads 0, 50M,
       100M, 150M rather than thirds of whatever the maximum happened to be */
    var raw = (hi - lo) / 3 || 1, mag = Math.pow(10, Math.floor(Math.log10(raw))), nm = raw / mag;
    var step = (nm <= 1 ? 1 : nm <= 2 ? 2 : nm <= 2.5 ? 2.5 : nm <= 5 ? 5 : 10) * mag;
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step; if(hi <= lo) hi = lo + step;
    var tk = []; for(var tv = lo; tv <= hi + step / 2; tv += step) tk.push(tv);
    CH[key] = { pts: pts, lines: lines, lo: lo, hi: hi, fmt: fmtV || fmtY };
    var X = function(i){ return (i / (n - 1) * 1000).toFixed(1); }, Y = function(v){ return (300 - (v - lo) / (hi - lo) * 300).toFixed(1); };
    var lv = tk.map(function(v){ return (v - lo) / (hi - lo); });
    var svg = '<svg viewBox="0 0 1000 300" preserveAspectRatio=none aria-hidden=true>' +
      lv.slice(1).map(function(f){ var y = (300 * (1 - f)).toFixed(1); return '<line class=gl x1=0 x2=1000 y1=' + y + ' y2=' + y + '></line>'; }).join("") +
      lines.map(function(l){ var d = pts.map(function(p, i){ return (i ? "L" : "M") + X(i) + " " + Y(p[l.k]); }).join("");
        return (l.area ? '<path class="ar ' + l.cls + '" d="' + d + 'L1000 300L0 300Z"></path>' : '') + '<path class="ln ' + l.cls + '" d="' + d + '"></path>'; }).join("") + '</svg>';
    var dl = function(s){ var d = new Date(s + "T00:00:00Z"); return d.toLocaleDateString("en", { month: "short", year: "numeric", timeZone: "UTC" }); };
    /* the date axis: over five months and more, a tick at each quarter (each half-year past three
       years), placed where that month begins; shorter spans keep start, middle and end */
    var days = (Date.parse(pts[n - 1].d) - Date.parse(pts[0].d)) / 864e5, gx;
    if(days >= 150){
      var every = days > 1100 ? 6 : 3, ticks = [], seen = {};
      pts.forEach(function(p, i){ var m = +p.d.slice(5, 7), key = p.d.slice(0, 7); if(i && (m - 1) % every === 0 && !seen[key]){ seen[key] = 1; ticks.push(i); } });
      gx = '<div class="sv-gx sv-gxt">' + ticks.map(function(i){ return '<span style="left:' + (i / (n - 1) * 100).toFixed(2) + '%">' + dl(pts[i].d) + '</span>'; }).join("") + '</div>';
    } else gx = '<div class=sv-gx><span>' + dl(pts[0].d) + '</span><span>' + dl(pts[Math.floor(n / 2)].d) + '</span><span>' + dl(pts[n - 1].d) + '</span></div>';
    /* the latest reading of each line, marked at the right end with its value */
    var ends = lines.map(function(l){ var v = pts[n - 1][l.k], y = (1 - (v - lo) / (hi - lo)) * 100;
      return '<i class="' + l.cls + '" style="top:' + y.toFixed(2) + '%"></i><em class="' + l.cls + '" style="top:' + y.toFixed(2) + '%">' + (fmtV || fmtY)(v) + '</em>'; }).join("");
    return '<div class=sv-lc data-ch="' + key + '">' + svg +
      lv.map(function(f, j){ return '<span class=sv-ly style="bottom:' + (f * 100).toFixed(2) + '%">' + fmtY(tk[j]) + '</span>'; }).join("") +
      '<span class=sv-lcend>' + ends + '</span><i class=sv-lcur></i><span class=sv-lcdots></span><span class=sv-lctip></span></div>' + gx;
  }
  function lcHover(ev){
    var box = ev.target.closest ? ev.target.closest(".sv-lc[data-ch]") : null;
    Array.prototype.forEach.call(document.querySelectorAll(".sv-lc.on"), function(x){ if(x !== box) x.classList.remove("on"); });
    if(!box) return;
    var c = CH[box.dataset.ch]; if(!c) return;
    var r = box.getBoundingClientRect(), n = c.pts.length, i = Math.max(0, Math.min(n - 1, Math.round((ev.clientX - r.left) / r.width * (n - 1))));
    var p = c.pts[i], x = i / (n - 1) * 100, dd = new Date(p.d + "T00:00:00Z").toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    box.classList.add("on");
    box.querySelector(".sv-lcur").style.left = x + "%";
    box.querySelector(".sv-lcdots").innerHTML = c.lines.map(function(l){
      return '<i class="' + l.cls + '" style="left:' + x + '%;top:' + ((1 - (p[l.k] - c.lo) / (c.hi - c.lo)) * 100).toFixed(2) + '%"></i>'; }).join("");
    var t = box.querySelector(".sv-lctip");
    t.innerHTML = '<b>' + dd + '</b>' + c.lines.map(function(l){ return '<span><i class="' + l.cls + '"></i>' + (l.name ? l.name + " " : "") + '<em>' + c.fmt(p[l.k]) + '</em></span>'; }).join("");
    t.style.left = x + "%"; t.classList.toggle("flip", x > 60);
  }
  /* a bar chart's scale, the line charts' own: labelled levels at a third, two thirds and the
     top, each with its gridline across the bars */
  function bscale(mx, f, whole){
    /* whole counts step in whole numbers, each level at its true height (a max of 1 is one level
       at the top, never a '1' two thirds of the way up) */
    var lv = [];
    if(whole){ var step = Math.max(1, Math.ceil(mx / 3)); for(var v = step; v <= mx + 1e-9; v += step) lv.push(v); if(lv[lv.length - 1] < mx) lv.push(mx); }
    else lv = [mx / 3, mx * 2 / 3, mx];
    return lv.map(function(v){ return '<span class=sv-bl2 style="bottom:' + (v / mx * 100).toFixed(2) + '%"><b>' + f(v) + '</b></span>'; }).join("");
  }
  /* a bar's reading, at once (the native title waits a second): the bar's data-t, above it */
  function barHover(ev){
    var b = ev.target.closest ? ev.target.closest(".sv-bars i[data-t],.sv-pace i[data-t]") : null;
    Array.prototype.forEach.call(document.querySelectorAll(".sv-btip.on"), function(x){ if(!b || x.parentNode !== b.parentNode) x.classList.remove("on"); });
    if(!b) return;
    var box = b.parentNode, t = box.querySelector(".sv-btip");
    if(!t){ t = document.createElement("span"); t.className = "sv-btip"; box.appendChild(t); }
    t.textContent = b.dataset.t; t.classList.add("on");
    var x = (b.offsetLeft + b.offsetWidth / 2) / box.clientWidth * 100;
    t.style.left = x + "%"; t.classList.toggle("flip", x > 70); t.classList.toggle("rt", x < 12);
  }

  function drawEco(){
    var E0 = DD().econ, hist = E0 && E0.hist || [], pr = DD().prices || {};
    /* the price cards, as Uptime's: the price, its day, the market it makes */
    var usd = function(v){ return v == null ? NA : "$" + (v >= 1 ? v.toFixed(2) : v >= .01 ? v.toFixed(4) : v.toPrecision(3)); };
    /* market cap from the chain's own supply: CoinGecko's PHOTON circulating figure is far
       below what the chain holds (1.8M against 77M on 2026-09-26) */
    var last = hist.length ? hist[hist.length - 1] : null;
    /* the price rides in the title row: the figure in the token's colour, its day in green or red,
       the market cap quiet beside it */
    var tp = function(k, p, col){ p = p || {}; var d = p.change_24h, sup = last ? last[k] / 1e6 : null, cap = p.usd != null && sup ? p.usd * sup : null;
      return '<span class=sv-tp><b style="color:' + col + '">' + usd(p.usd) + '</b>' +
        (d == null ? '' : '<i class=' + (d >= 0 ? "up" : "dn") + '>' + (d >= 0 ? "+" : "\u2212") + Math.abs(d).toFixed(1) + '% 24h</i>') +
        (cap ? '<small>market cap <u>$' + (cap >= 1e9 ? (cap / 1e9).toFixed(2) + "B" : (cap / 1e6).toFixed(1) + "M") + '</u></small>' : '') + '</span>'; };
    if(!hist.length){ put("sv-ecoa", '<div class=sv-ph><h3>ATONE supply and stake</h3></div><div class=sv-upwait>Reading the chain…</div>'); put("sv-ecop", '<div class=sv-ph><h3>PHOTON supply</h3></div><div class=sv-upwait>Reading the chain…</div>'); return; }
    /* each supply's bottom line is its change over 30 days, against the reading nearest that day */
    var now = hist[hist.length - 1], cut = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), was = null;
    for(var i = hist.length - 1; i >= 0; i--) if(hist[i].d <= cut){ was = hist[i]; break; }
    var ch = function(k){ return was && was[k] ? ((now[k] / was[k] - 1) * 100) : null; };
    var sg = function(v){ return v == null ? "" : (v >= 0 ? "+" : "\u2212") + Math.abs(v).toFixed(1) + "% in 30 days"; };
    var M = function(v){ return v <= 0 ? "0" : (v / 1e12).toFixed(0) + "M"; };
    put("sv-ecoa", '<div class=sv-ph><h3>ATONE</h3><span class=sv-gkey><i class=sup></i>supply<i class=bon></i>bonded</span>' + tp("atone", pr.atone, "var(--sv-amber)") + '<div class=sv-rt>' +
      st("Uncapped supply", big(now.atone), sg(ch("atone")), "var(--sv-amber)") +
      st("Bonded", (now.bonded / now.atone * 100).toFixed(1) + "%", big(now.bonded) + " staked", "var(--sv-amber)") +
      st("Community pool", big(now.pool), "ATONE", "var(--sv-green)") + '</div></div>' +
      chart("ecoa", hist, [{ k: "atone", cls: "sup", name: "Supply" }, { k: "bonded", cls: "bon", area: true, name: "Bonded" }], M, function(v){ return big(v); }));
    put("sv-ecop", '<div class=sv-ph><h3>PHOTON</h3><span class=sv-tmax>1 billion max</span><span class=sv-gkey><i class=pho></i>supply</span>' + tp("photon", pr.photon, "var(--sv-pho)") + '<div class=sv-rt>' +
      st("Capped supply", big(now.photon), sg(ch("photon")), "var(--sv-pho)") +
      st("Mint rate", E0.conv ? E0.conv.toFixed(2) : "—", "PHOTON per ATONE burned", "var(--sv-pho)") +
      st("Community pool", big(now.pool_ph), "PHOTON", "var(--sv-green)") + '</div></div>' +
      chart("ecop", hist, [{ k: "photon", cls: "pho", area: true, name: "Supply" }], M, function(v){ return big(v); }));
  }

  /* ════ Governors: AtomOne's x/gov governors (atomone/gov/v1) - a delegator may follow one, whose
     vote then counts for their stake unless they vote themselves. Read from the chain every 5 min:
     the list, each one's delegators, its voting power (val-shares turned into ATONE by each
     validator's tokens per share), and the governor the connected wallet follows ════ */
  var GV = { at: 0, busy: false, list: null, err: null, mine: {}, bonded: 0 };
  function gapi(p){ return fetch((window.__API || "https://atomone-api.gatadao.com") + p, { cache: "no-store" }).then(function(r){ return r.json(); }); }
  function loadGovs(){
    if(GV.busy || (GV.list && Date.now() - GV.at < 300000)) return;
    GV.busy = true;
    gapi("/atomone/gov/v1/params/voting").then(function(x){ var q = x.params || {};
      GV.rules = { minSelf: +q.min_governor_self_delegation || null, period: parseInt(q.governor_status_change_period, 10) || null }; }).catch(function(){});
    Promise.all([gapi("/atomone/gov/v1/governors?pagination.limit=500"), gapi("/cosmos/staking/v1beta1/validators?pagination.limit=500")])
      .then(function(x){
        var per = {}, bonded = 0;
        (x[1].validators || []).forEach(function(v){ var sh = parseFloat(v.delegator_shares); per[v.operator_address] = sh > 0 ? parseFloat(v.tokens) / sh : 1;
          if(v.status === "BOND_STATUS_BONDED") bonded += parseFloat(v.tokens); });
        GV.bonded = bonded;
        var gs = (x[0].governors || []).map(function(g){ var d = g.description || {};
          return { addr: g.governor_address, m: (d.moniker || "").trim() || g.governor_address.slice(0, 14), web: d.website || "", det: d.details || "",
                   ident: d.identity || "", sec: d.security_contact || "",
                   active: g.status === "GOVERNOR_STATUS_ACTIVE", since: Date.parse(g.last_status_change_time) || null, vp: null, n: null }; });
        return Promise.all(gs.map(function(g){
          return Promise.all([gapi("/atomone/gov/v1/vshares/" + g.addr + "?pagination.limit=500").catch(function(){ return {}; }),
                              gapi("/atomone/gov/v1/governors/" + g.addr + "/delegations?pagination.limit=1&pagination.count_total=true").catch(function(){ return {}; })])
            .then(function(y){ var vp = 0; (y[0].val_shares || []).forEach(function(s){ vp += parseFloat(s.shares) * (per[s.validator_address] || 1); });
              g.vp = vp; g.n = y[1].pagination ? +y[1].pagination.total : null; return g; }); }));
      })
      .then(function(gs){ gs.sort(function(a, b){ return (b.active - a.active) || (b.vp - a.vp); }); GV.list = gs; GV.at = Date.now(); GV.err = null; })
      .catch(function(e){ GV.err = String(e && e.message || e); })
      .then(function(){ GV.busy = false; var sc = screen(); if(sc === "govs" || sc === "mygov") render(); });
  }
  function myGov(){
    var a = window.__ADDR; if(!a) return undefined;
    var c = GV.mine[a];
    if(c === undefined){ GV.mine[a] = null;
      gapi("/atomone/gov/v1/delegations/" + a).then(function(d){ GV.mine[a] = d.governor_address || ""; }).catch(function(){ GV.mine[a] = ""; })
        .then(function(){ if(screen() === "mygov" || screen() === "govs") render(); }); }
    return GV.mine[a];
  }
  function govRows(list, mine){
    var tot = 0; list.forEach(function(g){ tot += g.vp || 0; });
    return '<div class="sv-vlist sv-glist">' + list.map(function(g){
      var sh = GV.bonded ? (g.vp || 0) / GV.bonded * 100 : null;
      return '<div class="sv-vr click' + (g.addr === mine ? ' me' : '') + '" data-gv="' + esc(g.addr) + '" tabindex=0 title="Open this governor" style="--c:' + (g.active ? 'var(--sv-teal)' : 'var(--wbd2)') + '">' +
        '<span class=sv-lgo><span class="lg" style="background:hsl(' + (g.m.charCodeAt(0) * 37 % 360) + ',42%,30%)">' + esc(g.m.charAt(0).toUpperCase()) + '</span></span>' +
        '<span class=sd-vn><b>' + esc(g.m) + (g.addr === mine ? '<i class=sd-al>yours</i>' : '') + '</b><s>' + esc(g.addr.slice(0, 16) + "\u2026" + g.addr.slice(-6)) + '</s></span>' +
        '<span class=sv-gst><em class=' + (g.active ? "on" : "off") + '>' + (g.active ? "active" : "inactive") + '</em></span>' +
        '<span class=sv-gn2><b>' + (g.vp != null ? fmt(g.vp) : NA) + '</b><s>ATONE' + (sh != null ? ', ' + sh.toFixed(2) + '% of bonded' : '') + '</s></span>' +
        '<span class=sv-gn2><b>' + (g.n != null ? g.n : NA) + '</b><s>delegator' + (g.n === 1 ? '' : 's') + '</s></span>' +
        '<span class=sv-gn2><b>' + (g.since ? window.__dayFull(g.since) : NA) + '</b><s>' + (g.active ? 'active since' : 'inactive since') + '</s></span>' +
        /* two fixed slots, the button and the site link, so every row's button stands in one column */
        '<span class=sv-gact>' + (govBtn(g, mine) || '<span></span>') +
        (g.web && /^https?:\/\//.test(g.web) ? '<a class=sv-gweb href="' + esc(g.web) + '" target=_blank rel="noopener noreferrer">site</a>' : '<span></span>') + '</span></div>'; }).join("") + '</div>';
  }
  /* following a governor is one signature: Follow (Switch when another one is followed) on an active
     governor, Stop on the one followed; nothing without a wallet, while the reading is pending, or
     outside the Dashboard */
  /* the Governance section only reads: following is done from the Dashboard's Governance tab */
  function govBtn(g, mine){
    if(screen() !== "mygov") return '';
    if(!window.__ADDR || !window.__WALLET || mine === null || mine === undefined) return '';
    if(g.addr === mine) return '<button class="sv-gbtn stop" type=button data-act=gstop title="Stop following this governor: your stake votes only when you vote">Stop</button>';
    if(!g.active) return '';
    return '<button class=sv-gbtn type=button data-act=gfollow data-g="' + esc(g.addr) + '" title="' + (mine ? 'Follow this governor instead' : 'Let this governor vote for your stake when you do not vote') + '">' + (mine ? 'Switch' : 'Follow') + '</button>';
  }
  function govSend(t, msg){
    if(!window.__TX || !window.__WALLET || !window.__ADDR || t.classList.contains("busy")) return;
    var a = window.__ADDR, n = window.__notify ? window.__notify() : null;
    t.classList.add("busy"); t.disabled = true;
    (window.__TX.sendDirect || window.__TX.send)(window.__WALLET, [msg], "", function(){})
      .then(function(){ if(n) n.ok();
        /* the next block carries it: read the following and the counts again then */
        setTimeout(function(){ delete GV.mine[a]; GV.at = 0; render(); }, 7000); })
      .catch(function(e){ if(n) n.fail(e && e.message || String(e)); })
      .then(function(){ t.classList.remove("busy"); t.disabled = false; });
  }
  /* a governor's card, as a validator's: who it is, what it holds, and the chain's rules for governors */
  function govCard(addr){
    var g = (GV.list || []).filter(function(x){ return x.addr === addr; })[0]; if(!g) return;
    var P = window.__POP, pop = E("gvpop");
    if(!pop){ pop = document.createElement("div"); pop.className = "pop"; pop.id = "gvpop"; document.body.appendChild(pop);
      pop.addEventListener("click", onClick); }
    var R = GV.rules || {}, mine = myGov(), sh = GV.bonded ? (g.vp || 0) / GV.bonded * 100 : null;
    var st = function(k, v, sub){ return '<div class=vstat><span class=vk>' + k + '</span><span class=vv>' + v + '</span>' + (sub ? '<i class=vsubn>' + sub + '</i>' : '') + '</div>'; };
    var web = g.web && /^https?:\/\//.test(g.web) ? '<a class=vweb href="' + esc(g.web) + '" target=_blank rel="noopener noreferrer">' + esc(g.web.replace(/^https?:\/\//, "").replace(/\/+$/, "")) + '</a>' : '<span class="vweb none">no website</span>';
    pop.innerHTML = '<div class="card vcard gvcard" role=dialog aria-modal=true aria-label="Governor ' + esc(g.m) + '">' +
      '<div class="vhead vwrap"><span class=vmono style="display:flex;background:hsl(' + (g.m.charCodeAt(0) * 37 % 360) + ',42%,30%)">' + esc(g.m.charAt(0).toUpperCase()) + '</span>' +
        '<div class=vcol><div class=vname><span class=vnm>' + esc(g.m) + '</span></div><div class=vsub>' + web + '</div></div></div>' +
      '<div class=vbadges><span class="badge ' + (g.active ? 'ok' : 'dn') + '">' + (g.active ? 'ACTIVE' : 'INACTIVE') + '</span>' + (g.addr === mine ? '<span class="badge up">YOU FOLLOW IT</span>' : '') + '</div>' +
      (g.det ? '<p class=gv-det>' + esc(g.det) + '</p>' : '') +
      '<div class=vgrid>' +
        st("voting power", g.vp != null ? fmt(g.vp) : NA, sh != null ? sh.toFixed(2) + "% of bonded ATONE" : "") +
        st("delegators", g.n != null ? String(g.n) : NA, "wallets that follow it") +
        st(g.active ? "active since" : "inactive since", g.since && window.__dayFull ? window.__dayFull(g.since) : NA, "") +
        st("security contact", g.sec ? esc(g.sec) : "\u2014", "") +
        st("identity", g.ident ? esc(g.ident) : "\u2014", g.ident ? "Keybase" : "") +
        st("address", esc(g.addr.slice(0, 12) + "\u2026" + g.addr.slice(-6)), "") +
      '</div>' +
      '<p class=gv-rules>A governor must hold at least <b>' + (R.minSelf ? whole(R.minSelf) : NA) + ' ATONE</b> of its own stake, and may change its status once every <b>' +
        (R.period ? Math.round(R.period / 86400) + ' days' : NA) + '</b>. While inactive, its votes do not count for those who follow it.</p>' +
      (govBtn(g, mine) ? '<div class=gv-go>' + govBtn(g, mine) + '</div>' : '') +
    '</div>';
    if(P) P.open(pop);
  }
  function govEmpty(t){ return '<div class=sv-upwait>' + t + '</div>'; }
  function drawGovs(){
    loadGovs();
    var L = GV.list, act = L ? L.filter(function(g){ return g.active; }) : [], vp = 0, n = 0;
    (L || []).forEach(function(g){ vp += g.vp || 0; n += g.n || 0; });
    var C = ["var(--sv-teal)", "var(--sv-violet)", "var(--sv-green)"], ci = 0, c = function(k, v, sub){ return gstat(k, v, sub, C[ci++ % 3]); };
    put("sv-govcards", c("Governors", L ? String(L.length) : "\u2014", L ? "Active " + act.length : "reading the chain\u2026") +
      c("Voting power", L ? fmt(vp) : "\u2014", L && GV.bonded ? (vp / GV.bonded * 100).toFixed(2) + "% of bonded ATONE follows a governor" : "ATONE") +
      c("Delegators", L ? String(n) : "\u2014", "wallets that follow a governor"));
    var h = '<div class=sv-ph><h3>Governors</h3><span class=sv-gkey>a delegator\'s vote goes with its governor unless it votes itself</span></div>';
    put("sv-govlist", h + (GV.err && !L ? govEmpty("Could not read the governors") : !L ? govEmpty("Reading the governors\u2026")
      : !L.length ? govEmpty("No governors on AtomOne yet") : govRows(L, myGov())));
  }
  function drawMyGov(){
    loadGovs();
    var L = GV.list, mine = myGov(), g = L && mine ? L.filter(function(x){ return x.addr === mine; })[0] : null;
    var h = '<div class=sv-ph><h3>Your governor</h3></div>';
    if(!window.__ADDR) h += govEmpty("Connect a wallet to see the governor it follows");
    else if(mine === null || (mine && !L)) h += govEmpty("Reading\u2026");
    else if(!mine) h += '<div class=sd-ok>You follow no governor: your stake votes only when you vote.</div>';
    else h += '<div class=sd-ok>Your stake follows <b class=d>' + esc(g ? g.m : mine) + '</b>' + (g && !g.active ? ', which is inactive: its votes do not count for you' : '') +
      '. Its vote counts for you on any proposal you do not vote on yourself.</div>' + (g ? govRows([g], mine) : "");
    put("sv-mygovp", h);
    put("sv-mygovlist", '<div class=sv-ph><h3>Governors</h3></div>' + (!L ? govEmpty("Reading the governors\u2026") : !L.length ? govEmpty("No governors on AtomOne yet") : govRows(L, mine)));
  }

  /* ════ Proposals: every AtomOne proposal, read from the chain every 5 min (the one being voted on
     gets its running tally); the tallying rules and the core DAOs' parameters come with them ════ */
  var GP = { at: 0, busy: false, list: null, err: null, tp: null, dao: null, open: {} };
  function loadProps(){
    if(GP.busy || (GP.list && Date.now() - GP.at < 300000)) return;
    GP.busy = true;
    Promise.all([gapi("/atomone/gov/v1/proposals?pagination.limit=500&pagination.reverse=true"),
                 gapi("/atomone/gov/v1/params/tallying").catch(function(){ return {}; }),
                 gapi("/atomone/coredaos/v1/params").catch(function(){ return {}; })])
      .then(function(x){
        var L = (x[0].proposals || []).map(function(p){
          return { id: +p.id, title: p.title || ("Proposal " + p.id), st: p.status, tally: p.final_tally_result || {}, submit: p.submit_time,
                   vs: p.voting_start_time, ve: p.voting_end_time, de: p.deposit_end_time, sum: p.summary || "", by: p.proposer || "",
                   msgs: (p.messages || []).map(function(m){ return m["@type"] || ""; }),
                   dep: (p.total_deposit || []).filter(function(c){ return c.denom === "uatone"; }).reduce(function(a, c){ return a + +c.amount; }, 0),
                   endorsed: !!p.endorsed, ext: +(p.times_voting_period_extended || 0) }; });
        L.sort(function(a, b){ return b.id - a.id; });
        var live = L.filter(function(p){ return p.st === "PROPOSAL_STATUS_VOTING_PERIOD"; });
        return Promise.all(live.map(function(p){ return gapi("/atomone/gov/v1/proposals/" + p.id + "/tally").then(function(t){ if(t.tally) p.tally = t.tally; }).catch(function(){}); }))
          .then(function(){ GP.list = L; GP.tp = x[1].tally_params || x[1].params || null; GP.dao = x[2].params || null; GP.err = null; GP.at = Date.now(); });
      })
      .catch(function(e){ GP.err = (e && e.message) || "error"; })
      .then(function(){ GP.busy = false; var sc = screen(); if(sc === "props" || sc === "daos") render(); });
  }
  var PST = { PROPOSAL_STATUS_VOTING_PERIOD: ["voting", "v"], PROPOSAL_STATUS_PASSED: ["passed", "p"], PROPOSAL_STATUS_REJECTED: ["rejected", "r"],
              PROPOSAL_STATUS_FAILED: ["failed", "f"], PROPOSAL_STATUS_DEPOSIT_PERIOD: ["deposit", "d"] };
  /* what a proposal does, in words: the kind of its first message */
  var PKIND = { MsgSoftwareUpgrade: "Software upgrade", MsgCancelUpgrade: "Upgrade cancelled", MsgUpdateParams: "Parameter change",
                MsgCommunityPoolSpend: "Community pool spend", MsgRecoverClient: "IBC client recovery", MsgIBCSoftwareUpgrade: "IBC upgrade",
                MsgExecLegacyContent: "Legacy proposal", MsgUpdateClient: "IBC client update", MsgAnnotateProposal: "Annotation", MsgEndorseProposal: "Endorsement" };
  function pkind(p){
    if(!p.msgs.length) return "Text";
    var t = String(p.msgs[0]).split(".").pop(), k = PKIND[t] || t.replace(/^Msg/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
    return k + (p.msgs.length > 1 ? " and " + (p.msgs.length - 1) + " more" : "");
  }
  /* a Governance figure, as the Dashboard's strip shows one: its label with a colour key, the figure in an
     engraved well, a line under it */
  function gstat(k, v, sub, rc){ return '<div class=gv-ro style="--rc:' + (rc || 'var(--sv-teal)') + '"><em>' + k + '</em><div class=sd-well><b>' + v + '</b></div>' + (sub ? '<small>' + sub + '</small>' : '<small>&nbsp;</small>') + '</div>'; }
  function ptally(t){ var y = +(t.yes_count || 0), n = +(t.no_count || 0), a = +(t.abstain_count || 0), s = y + n + a; return { y: y, n: n, a: a, s: s }; }
  function pday(t){ return t && window.__dayFull ? window.__dayFull(new Date(t).getTime()) : "—"; }
  function drawProps(){
    loadProps();
    var L = GP.list, tp = GP.tp || {}, C = ["var(--sv-teal)", "var(--sv-amber)", "var(--sv-green)"], ci = 0, c = function(k, v, sub){ return gstat(k, v, sub, C[ci++ % 3]); };
    var n = function(st){ return L ? L.filter(function(p){ return p.st === st; }).length : 0; }, live = L ? L.filter(function(p){ return p.st === "PROPOSAL_STATUS_VOTING_PERIOD"; }) : [];
    put("sv-propcards",
      c("Proposals", L ? String(L.length) : "—", L ? n("PROPOSAL_STATUS_PASSED") + " passed, " + n("PROPOSAL_STATUS_REJECTED") + " rejected" + (n("PROPOSAL_STATUS_FAILED") ? ", " + n("PROPOSAL_STATUS_FAILED") + " failed" : "") +
        /* ids run to the newest; a proposal that never met its deposit is deleted by the chain, so
           the count can be lower - said, so "20" beside "#21" does not read as a mistake */
        (L.length && L[0].id > L.length ? ", " + (L[0].id - L.length) + " dropped (deposit not met)" : "") : "reading the chain…") +
      c("Voting now", L ? (live.length ? String(live.length) : "None") : "—", L ? (live.length ? "#" + live[live.length - 1].id + " ends " + pday(live[live.length - 1].ve) : "no proposal is open") : "") +
      c("To pass", tp.threshold ? "&gt;" + (tp.threshold * 100).toFixed(1) + "%" : "—", tp.quorum ? "of votes yes, with " + (tp.quorum * 100).toFixed(1) + "% of bonded ATONE voting" + (tp.law_threshold ? "; laws and amendments " + (tp.law_threshold * 100).toFixed(0) + "%" : "") : "of votes yes"));
    var h = '<div class=sv-ph><h3>Proposals</h3><span class=sv-gkey>newest first; tap one to read it</span></div>';
    if(GP.err && !L){ put("sv-proplist", h + govEmpty("Could not read the proposals")); return; }
    if(!L){ put("sv-proplist", h + govEmpty("Reading the proposals…")); return; }
    if(!L.length){ put("sv-proplist", h + govEmpty("No proposals yet")); return; }
    put("sv-proplist", h + '<div class=gp-list>' + L.map(function(p){
      var s = PST[p.st] || ["unknown", "d"], t = ptally(p.tally), pc = function(v){ return t.s ? (v / t.s * 100) : 0; }, open = !!GP.open[p.id];
      var when = p.st === "PROPOSAL_STATUS_VOTING_PERIOD" ? "ends " + pday(p.ve) : p.st === "PROPOSAL_STATUS_DEPOSIT_PERIOD" ? "deposit until " + pday(p.de) : "ended " + pday(p.ve);
      var row = '<div class="gp-r' + (open ? ' open' : '') + '" data-gp="' + p.id + '" tabindex=0 role=button aria-expanded=' + open + '>' +
        '<span class=gp-id>#' + p.id + '</span>' +
        '<span class=gp-t><b>' + esc(p.title) + '</b><s>' + esc(pkind(p)) + ', ' + when + (p.endorsed ? ', endorsed by the Steering DAO' : '') + (p.ext ? ', voting extended ' + p.ext + '×' : '') + '</s></span>' +
        '<span class="gp-st ' + s[1] + '">' + s[0] + '</span>' +
        '<span class=gp-v>' + (t.s ? '<span class=gp-bar><i class=y style="width:' + pc(t.y).toFixed(2) + '%"></i><i class=n style="width:' + pc(t.n).toFixed(2) + '%"></i><i class=a style="width:' + pc(t.a).toFixed(2) + '%"></i></span>' +
          '<em>Yes ' + pc(t.y).toFixed(1) + '%</em><small>No ' + pc(t.n).toFixed(1) + '%, abstain ' + pc(t.a).toFixed(1) + '%</small>' : '<small>no votes' + (p.st === "PROPOSAL_STATUS_DEPOSIT_PERIOD" ? ' yet' : '') + '</small>') + '</span></div>';
      if(open){
        var sm = p.sum.length > 2400 ? p.sum.slice(0, 2400) + "…" : p.sum;
        row += '<div class=gp-d><div class=gp-f>' +
          '<span><em>Proposer</em>' + esc(p.by ? p.by.slice(0, 12) + "…" + p.by.slice(-6) : "—") + '</span>' +
          '<span><em>Deposit</em>' + (p.dep ? fmt(p.dep) + ' ATONE' : '—') + '</span>' +
          '<span><em>Submitted</em>' + pday(p.submit) + '</span>' +
          '<span><em>Voting</em>' + (p.vs ? pday(p.vs) + ' to ' + pday(p.ve) : 'not started') + '</span>' +
          (t.s ? '<span><em>Votes cast</em>' + fmt(t.s) + ' ATONE</span>' : '') + '</div>' +
          (sm ? '<div class=gp-sum>' + esc(sm) + '</div>' : '') + '</div>';
      }
      return row; }).join("") + '</div>');
  }
  /* ════ Core DAOs: the Steering and Oversight DAOs the constitution provides for - who holds them
     on chain (x/coredaos params), what each may do, and what has been endorsed so far ════ */
  function drawDaos(){
    loadProps();
    var d = GP.dao, L = GP.list, net = TN() ? "testnet" : "mainnet";
    var C = ["var(--sv-teal)", "var(--sv-amber)", "var(--sv-green)"], ci = 0, c = function(k, v, sub){ return gstat(k, v, sub, C[ci++ % 3]); };
    var who = function(a){ return !d ? "—" : a ? esc(a.slice(0, 10) + "…" + a.slice(-6)) : "Not appointed"; };
    var ext = d ? +(d.voting_period_extensions_limit || 0) : null, dur = d ? Math.round(parseInt(d.voting_period_extension_duration || "0", 10) / 86400) : null;
    put("sv-daocards", c("Steering DAO", who(d && d.steering_dao_address), d ? (d.steering_dao_address ? "on chain" : "none on " + net + " yet") : "reading the chain…") +
      c("Oversight DAO", who(d && d.oversight_dao_address), d ? (d.oversight_dao_address ? "on chain" : "none on " + net + " yet") : "") +
      c("Endorsed proposals", L ? String(L.filter(function(p){ return p.endorsed; }).length) : "—", L ? "of " + L.length + " proposals" : ""));
    var row = function(name, has, text){ return '<div class=gd-r><div class=gd-h><b>' + name + '</b><span class="gp-st ' + (has ? 'p' : 'd') + '">' + (has ? 'appointed' : 'not appointed') + '</span></div><p>' + text + '</p></div>'; };
    put("sv-daop", '<div class=sv-ph><h3>What they are for</h3></div>' + (GP.err && !d ? govEmpty("Could not read the chain") : !d ? govEmpty("Reading the chain…") :
      '<div class=gd-list>' +
      row("Steering DAO", !!d.steering_dao_address, "At most one. It can add advisory notes to proposals, make announcements on chain and extend a proposal's voting period. Its endorsement lets a law pass with more than two thirds instead of 90%.") +
      row("Oversight DAO", !!d.oversight_dao_address, "It can veto a proposal that breaks a governing document, with proof, and extend a proposal's voting period. It cannot act on proposals about its own members.") +
      '<div class=gd-note>' + (ext != null ? 'A proposal\'s voting period can be extended up to <b>' + ext + ' times</b>, <b>' + dur + ' days</b> each. ' : '') +
        'Members of both are appointed by governance and must be public, real people. ' +
        '<a href="https://github.com/atomone-hub/genesis/blob/main/CONSTITUTION.md" target=_blank rel="noopener noreferrer">The constitution</a> sets the rules.</div></div>'));
  }

  /* ════ Constitution: the official text, as the build converted it (constitution.html), fetched
     the first time the view opens; the contents follow the reading and take the reader anywhere ════ */
  var CN = { busy: false, ok: false, err: false };
  function drawCons(){
    var box = E("sv-consp"); if(!box || CN.ok || CN.busy) return;
    CN.busy = true;
    fetch("constitution.html", { cache: "no-cache" }).then(function(r){ if(!r.ok) throw new Error(r.status); return r.text(); })
      .then(function(h){ box.innerHTML = h; CN.ok = true; cnWire(box); })
      .catch(function(){ box.innerHTML = '<div class=sv-upwait>Could not open the constitution. <a href="https://github.com/atomone-hub/genesis/blob/main/CONSTITUTION.md" target=_blank rel="noopener noreferrer">Read it on GitHub</a>.</div>'; })
      .then(function(){ CN.busy = false; });
  }
  function cnWire(box){
    var art = box.querySelector(".cn-art"), links = [].slice.call(box.querySelectorAll(".cn-toc a")), sel = box.querySelector(".cn-sel");
    var heads = links.map(function(a){ return box.querySelector("#" + a.dataset.cn); });
    /* the column scrolls on its own in the frame; on a phone it flows and the page scrolls instead */
    function inner(){ return getComputedStyle(art).overflowY !== "visible"; }
    /* a jump is instant: across thousands of lines a glide only delays the reader */
    function go(id){ var h = box.querySelector("#" + id); if(!h) return;
      if(inner()) art.scrollTop += h.getBoundingClientRect().top - art.getBoundingClientRect().top - 12;
      else window.scrollBy(0, h.getBoundingClientRect().top - 70);
      spy(); }
    links.forEach(function(a){ a.addEventListener("click", function(ev){ ev.preventDefault(); go(a.dataset.cn); }); });
    if(sel) sel.addEventListener("change", function(){ go(sel.value); });
    /* the contents mark the part being read: the last heading above the top third of the column */
    var tick = false;
    function spy(){ tick = false; var cur = 0, top = inner() ? art.getBoundingClientRect().top : 0, line = top + (inner() ? art.clientHeight : innerHeight) / 3;
      for(var i = 0; i < heads.length; i++) if(heads[i] && heads[i].getBoundingClientRect().top <= line) cur = i;
      links.forEach(function(a, i){ a.classList.toggle("on", i === cur); });
      if(sel && heads[cur]) sel.value = heads[cur].id;
      var on = links[cur], toc = box.querySelector(".cn-toc");
      if(on && toc && (on.offsetTop < toc.scrollTop || on.offsetTop > toc.scrollTop + toc.clientHeight - 30)) toc.scrollTop = on.offsetTop - toc.clientHeight / 2; }
    var onScroll = function(){ if(!tick){ tick = true; requestAnimationFrame(spy); } };
    art.addEventListener("scroll", onScroll); window.addEventListener("scroll", onScroll, { passive: true });
    spy();
  }

  /* a proposal row opens and closes its details: a tap, or Enter / Space on it */
  function gpToggle(ev){
    var r = ev.target.closest ? ev.target.closest(".gp-r") : null; if(!r) return;
    if(ev.type === "keydown"){ if(ev.key !== "Enter" && ev.key !== " ") return; ev.preventDefault(); }
    var id = +r.dataset.gp; GP.open[id] = !GP.open[id]; drawProps();
    var again = document.querySelector('.gp-r[data-gp="' + id + '"]'); if(again && ev.type === "keydown") again.focus();
  }
  sv.addEventListener("click", gpToggle);
  sv.addEventListener("keydown", gpToggle);

  /* hovering the plot names a block: its height, how many signed, who did not */
  sv.addEventListener("mousemove", function(ev){
    var p = ev.target.closest ? ev.target.closest(".sv-upplot") : null;
    if(!p){ if(UPHOVER !== -1){ UPHOVER = -1; if(screen() === "net") drawUp(setStats()); } return; }
    var r = p.getBoundingClientRect(), n = upRows().length, i = Math.floor((ev.clientX - r.left) / r.width * n);
    i = Math.max(0, Math.min(n - 1, i));
    if(i !== UPHOVER){ UPHOVER = i; drawUp(setStats()); }
  });
  sv.addEventListener("mouseleave", function(){ if(UPHOVER !== -1){ UPHOVER = -1; if(screen() === "net") drawUp(setStats()); } });
  window.addEventListener("thermo:up", function(){ var sc = screen(); if(root.getAttribute("data-ui") !== "simple") return;
    if(sc === "net") drawUp(setStats()); else if(sc === "sign") drawSign(); else if(sc === "prop") drawProp(); else if(sc === "act") drawAct(); });
  sv.addEventListener("mousemove", signTip);
  sv.addEventListener("mousemove", lcHover);
  sv.addEventListener("mousemove", barHover);
  sv.addEventListener("mouseleave", function(){ lcHover({ target: sv }); barHover({ target: sv }); });
  window.addEventListener("resize", function(){ if(screen() === "sign") paintSign(); });
  window.addEventListener("thermo:live", function(){ if(!window.__UP && screen() === "net") fbRows(); });

  /* ── the head: chain, address, the way out ── */
  var WAS = null;
  function drawHead(){
    var a = window.__ADDR, ac = E("svacct"), cn = E("svconn"), w = window.__WALLET;
    var wl = E("svwelc"), name = w && w.label && w.label !== "My wallet" && w.label !== w.name ? w.label : "";
    if(a){ ac.hidden = false; if(cn) cn.hidden = true;
           /* the pill: the connected wallet's mark, its address as the box allows, copy, disconnect */
           var im = ac.querySelector(".wpl"), src = "assets/wallet-" + String((w && w.name) || "keplr").toLowerCase() + ".svg";
           if(im && im.getAttribute("src") !== src) im.setAttribute("src", src);
           var pa = ac.querySelector(".wpa"); if(pa) pa.textContent = a.slice(0, 7) + "\u2026" + a.slice(-4);
           ac.title = ((w && w.label) || (w && w.name) || "Wallet") + ", " + a; }
    else { ac.hidden = true; if(cn) cn.hidden = false; }
    if(wl){ wl.hidden = !a; wl.innerHTML = a ? "Welcome" + (name ? ", <b>" + esc(name) + "</b>" : "") : ""; }
    /* a redraw every block must not shut a menu the reader just opened: only a
       change of state - connected, or no longer - closes it */
    if(WAS !== !!a){ WAS = !!a; closeMenu(); }
  }
  /* the only door in or out, in both views: the wallet list, then the account */
  var menu = E("svmenu");
  function closeMenu(){
    if(!menu || menu.hidden) return;
    menu.hidden = true; menu.innerHTML = "";
    ["svconn", "svacct"].forEach(function(id){ var b = E(id); if(b) b.setAttribute("aria-expanded", "false"); });
  }
  function openMenu(html, owner){
    if(!menu) return;
    menu.innerHTML = html; menu.hidden = false;
    if(owner) owner.setAttribute("aria-expanded", "true");
  }
  function walletMenu(){
    var have = {};
    (window.__wproviders ? window.__wproviders() : []).forEach(function(p){ have[p.name] = 1; });
    return '<div class=mh>Connect a wallet</div>' + ["Keplr", "Adena"].filter(function(n){ return !(PHONE && n !== "Keplr"); })
      .map(function(n){
        return '<button class=mi type=button data-w="' + n + '"' + (have[n] ? "" : " disabled") + '>' +
          '<img src="assets/wallet-' + n.toLowerCase() + '.svg" alt="">' + n +
          (have[n] ? "" : '<i>not installed</i>') + '</button>'; }).join("");
  }
  var conn = E("svconn");
  if(conn) conn.addEventListener("click", function(ev){ ev.stopPropagation();
    if(menu && !menu.hidden){ closeMenu(); return; } openMenu(walletMenu(), conn); });
  document.addEventListener("click", function(ev){
    if(!menu || menu.hidden || menu.contains(ev.target)) return;
    closeMenu();
  });
  document.addEventListener("keydown", function(ev){ if(ev.key === "Escape") closeMenu(); });
  if(menu) menu.addEventListener("click", function(ev){
    var t = ev.target.closest ? ev.target.closest("[data-w]") : null;
    if(!t) return;
    /* the bar answers the click itself, without waiting for the next redraw */
    closeMenu(); if(window.__wconnect) window.__wconnect(t.dataset.w); setTimeout(render, 0);
  });

  /* ── one draw: the wallet in the header on every section; a screen only for the
     one on show (html[data-svs], which the navigation shell sets) ── */
  var pending = false;
  function screen(){ return root.getAttribute("data-svs") || "over"; }
  /* home's one link: a connected wallet goes straight to its Dashboard, a first visit to Network */
  function homeDoor(){
    var a = document.querySelector(".introgo"); if(!a) return;
    var dash = !!window.__ADDR, want = dash ? "dashboard" : "network";
    if(a.getAttribute("data-route") === want) return;
    a.setAttribute("data-route", want); a.setAttribute("href", "#/" + want);
    a.firstChild.nodeValue = dash ? "Dashboard" : "Network";
  }
  /* Self's Autopilot row: the reader's own gain (the plan the Wallet's Move panel prices, cached the
     same way), counted up once; the line under it turns while Self is open. Working out the plan
     briefly touches Self's amount field, so nothing is recomputed while the reader is typing there. */
  var SA = { g: null, counted: false, i: 0 };
  function selfBand(){
    var m = E("samain"); if(!m || root.getAttribute("data-sv") !== "dashboard/self") return;
    var act = document.activeElement, typing = act && act.tagName === "INPUT" && act.closest && act.closest("#p-dele");
    var pos = window.__POS, plan = typing ? null : planNow(pos), g = typing ? SA.g : (plan && plan.gain > 0.5 ? plan.gain : 0);
    if(g === SA.g && m.getAttribute("data-g") !== null) return;
    SA.g = g; m.setAttribute("data-g", g || 0);
    if(!g){ m.innerHTML = 'Your stake at the best rate, <b>hands-free</b>'; return; }
    var n = m.querySelector(".sa-num");
    if(n && SA.counted){ n.textContent = "+" + one(g); return; }
    /* the true figure is written first; the count-up only decorates it, frame by frame, so a browser
       that runs no frames (a background tab) still shows the real number */
    m.innerHTML = 'Earn <b class=sa-num>+' + one(g) + '</b> <b>ATONE a year</b> more, <b>hands-free</b>';
    if(SA.counted) return;
    SA.counted = true; n = m.querySelector(".sa-num");
    if(matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var t0 = null, done = false;
    requestAnimationFrame(function step(t){ if(done) return; if(t0 === null){ t0 = t; requestAnimationFrame(step); return; }
      var k = Math.min(1, (t - t0) / 1200); n.textContent = "+" + one(SA.g * (1 - Math.pow(1 - k, 3)));
      if(k < 1) requestAnimationFrame(step); else done = true; });
    setTimeout(function(){ done = true; if(n.isConnected) n.textContent = "+" + one(SA.g); }, 1300);   /* frames or not, it ends on the real figure */
  }
  setInterval(function(){
    if(root.getAttribute("data-sv") !== "dashboard/self" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var L = document.querySelectorAll("#saband .sa-l"); if(!L.length) return;
    L[SA.i % L.length].classList.remove("on"); SA.i++; L[SA.i % L.length].classList.add("on");
  }, 2800);
  function render(){
    if(window.__rerate) window.__rerate();
    homeDoor();
    selfBand();
    drawHead();
    if(root.getAttribute("data-sv") === "dashboard/self") put("sd-mstrip", wstrip());
    if(root.getAttribute("data-tab") !== "dele" || root.getAttribute("data-ui") !== "simple") return;
    var s = screen();
    if(s === "over") drawOver();
    else if(s === "auto") drawAuto();
    else if(s === "sign") drawSign();
    else if(s === "prop") drawProp();
    else if(s === "act") drawAct();
    else if(s === "eco") drawEco();
    else if(s === "govs") drawGovs();
    else if(s === "props") drawProps();
    else if(s === "daos") drawDaos();
    else if(s === "cons") drawCons();
    else if(s === "mygov") drawMyGov();
    else drawNet();
  }
  function schedule(){
    if(pending) return;
    pending = true; requestAnimationFrame(function(){ pending = false; render(); });
  }

  /* The shell (shell.js) owns which dashboard view is open - it is a level-2 tab with its
     own route - and calls this with the view as the version switch has it: a simple screen,
     or the advanced one. th_svs keeps the screen for a visit that arrives with no route. */
  window.__dashView = function(ui, scr){
    if(ui === "simple"){ root.setAttribute("data-ui", "simple"); if(scr) root.setAttribute("data-svs", scr); }
    else root.removeAttribute("data-ui");
    /* this only remembers the screen */
    try{ if(scr) localStorage.setItem("th_svs", scr); }catch(e){}
    render();
  };

  function onClick(ev){
    var t = ev.target.closest ? ev.target.closest("[data-act],[data-f],[data-v],[data-gv]") : null;
    if(!t) return;
    var act = t.dataset.act;
    if(!act && t.dataset.gv){ govCard(t.dataset.gv); return; }
    if(act === "opt"){
      if(!window.__optPlan || !window.__goSign) return;
      t.classList.add("busy");
      var p = window.__optPlan(true);
      t.classList.remove("busy");
      if(p && p.moves) window.__goSign();
      return;
    }
    if(act === "stake"){ var sb = E("stbtn"); if(sb) sb.click(); return; }
    if(act === "claim"){ if(window.__claim) window.__claim(); return; }
    if(act === "gfollow"){ govSend(t, { type: "atomone/v1/MsgDelegateGovernor", value: { delegator_address: window.__ADDR, governor_address: t.dataset.g } }); return; }
    if(act === "gstop"){ govSend(t, { type: "atomone/v1/MsgUndelegateGovernor", value: { delegator_address: window.__ADDR } }); return; }
    if(act === "bwin"){ BW = t.dataset.w === "10k" || t.dataset.w === "all" ? t.dataset.w : "100"; try{ localStorage.setItem("th_bw", BW); }catch(e){} drawAct(); return; }
    if(act === "awin"){ AW = t.dataset.w === "30d" || t.dataset.w === "all" ? t.dataset.w : "24h"; try{ localStorage.setItem("th_aw", AW); }catch(e){} drawAct(); return; }
    if(act === "pwin"){ PW = t.dataset.w === "all" ? "all" : "24h"; try{ localStorage.setItem("th_pw", PW); }catch(e){} drawProp(); return; }
    if(act === "refresh"){
      if(window.__refreshPos){ t.classList.add("busy"); window.__refreshPos().then(function(){ t.classList.remove("busy"); render(); }); }
      else { var rf = E("wrefresh"); if(rf) rf.click(); }
      return;
    }
    if(act === "autopilot"){ var ab = E("atbtn"); if(ab) ab.click(); return; }
    /* restake is part of the Autopilot grant: its setup opens with restake set to Yes */
    if(act === "restake"){ var rb = E("atbtn"); if(rb) rb.click(); setTimeout(function(){ var y = document.querySelector('#atrsk [data-r="1"]'); if(y && y.getAttribute("aria-pressed") !== "true") y.click(); }, 60); return; }
    if(act === "connect"){ var cb = E("svconn"); if(cb){ ev.stopPropagation(); cb.click(); } return; }
    if(t.dataset.v && window.__vshow) window.__vshow(t.dataset.v);
  }
  function onKey(ev){
    if(ev.key !== "Enter" && ev.key !== " ") return;
    var rt = ev.target.closest ? ev.target.closest(".sv-chip[data-route],.sv-vr[data-route]") : null;
    if(rt && window.__shellGo){ ev.preventDefault(); window.__shellGo(rt.getAttribute("data-route")); return; }
    var gv = ev.target.closest ? ev.target.closest("[data-gv]") : null;
    if(gv && ev.target === gv){ ev.preventDefault(); govCard(gv.dataset.gv); return; }
    var t = ev.target.closest ? ev.target.closest("[data-v]") : null;
    if(!t || !window.__vshow) return;
    ev.preventDefault(); window.__vshow(t.dataset.v);
  }
  sv.addEventListener("click", onClick);
  var mstrip = E("sd-mstrip"); if(mstrip) mstrip.addEventListener("click", onClick);   /* Manage's copy of the strip */
  sv.addEventListener("keydown", onKey);

  /* the pill's two controls: the address copies, the icon disconnects - no menu */
  var cp = E("svcopy"), out = E("svout"), cpT = 0;
  if(cp) cp.addEventListener("click", function(){ if(window.__ADDR && window.copyText) window.copyText(window.__ADDR, function(){
    cp.classList.add("done"); cp.title = "Copied"; clearTimeout(cpT);
    cpT = setTimeout(function(){ cp.classList.remove("done"); cp.title = "Copy address"; }, 1400); }); });
  if(out) out.addEventListener("click", function(){ if(window.__wdisconnect) window.__wdisconnect(); setTimeout(render, 0); });

  /* a theme switch redraws everything: the heat colours are chosen per theme when drawn, so a
     screen drawn at night kept night's pale inks on day's paper until the next change */
  new MutationObserver(function(){ LASTH = {}; HB.key = null; render(); }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  /* every figure follows the dashboard's own redraw, and the height ticks on its own */
  window.addEventListener("thermo:draw", schedule);
  /* a turned phone gets the other table markup at once, not at the next block */
  var rzT = 0; window.addEventListener("resize", function(){ clearTimeout(rzT); rzT = setTimeout(schedule, 150); });
  window.addEventListener("thermo:live", schedule);
  setInterval(function(){ if(root.getAttribute("data-ui") === "simple" && screen() === "over") schedule(); }, 15000);
  render();
})();
