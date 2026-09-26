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
  function tag(cls, t, title){ return '<span class="sv-tag ' + cls + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + t + '</span>'; }
  /* a shaded box inside a panel: a coloured tick and label, the value, a line of detail */
  function box(cls, label, value, meta, style, act){
    return '<div class="sv-box b-' + cls + '"' + (style ? ' style="' + style + '"' : '') + '>' + (act || "") + '<span class=sv-bl>' + label + '</span>' +
      '<b class=sv-bv>' + value + '</b><span class=sv-bm>' + (meta || "") + '</span></div>';
  }
  /* a span of the set's record: centred, and the set itself as a strip of cells under the figure,
     one a validator, lit if it was never jailed in the span */
  function span(k, v, clean, n){
    var c = ""; for(var i = 0; i < n; i++) c += '<i' + (i < clean ? '' : ' class=j') + '></i>';
    return '<div class="sv-card sv-span"><span class=sv-k>' + k + '</span><span class=sv-big>' + v + '</span>' +
      '<span class=sv-cells title="' + clean + ' of ' + n + ' never jailed in this span">' + c + '</span>' +
      '<span class=sv-sub>validator set average, ' + clean + ' never jailed</span></div>';
  }
  function card(k, v, sub, cls){
    return '<div class=sv-card><span class=sv-k>' + k + '</span>' +
           '<span class="sv-big ' + (cls || "") + '">' + v + '</span><span class=sv-sub>' + (sub || "") + '</span></div>';
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
  function scale(pins, S, mini){
    var ticks = "";
    var md = heat(S.mid);
    /* one line: the lowest rate the set pays, the ramp, the highest */
    return '<div class="sv-hrow' + (mini ? " mini" : "") + '"><span class=sv-hl>' + pct(S.lo) + '</span>' +
      '<div class=sv-heat><i style="background:' + rampCss() + '"></i>' + ticks +
      '<u style="left:' + (md.p * 100).toFixed(2) + '%" title="the set\'s median, ' + pct(S.mid) + '"></u>' +
      pins.map(function(q){ var h = heat(q.r);
        return '<b style="left:' + (h.p * 100).toFixed(2) + '%;--c:' + h.fill + ';--s:' + (q.s || 12) + 'px"' + (q.t ? ' title="' + esc(q.t) + '"' : "") + '></b>'; }).join("") +
      '</div><span class=sv-hl>' + pct(S.hi) + '</span></div>';
  }

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

  /* ── OVERVIEW ───────────────────────────────────────────────────────────── */

  function drawOver(){
    var pos = window.__POS, S = setStats(), bal = window.__BAL;
    /* the wallet, as one thing: what it holds in all, how that splits (staked, available, rewards
       waiting), what the staked part earns - then the PHOTON that pays fees and when it was read */
    var wname = (window.__WALLET && String(window.__WALLET.label || "").trim()) || "Your wallet";
    var mine = pos && pos.rows.length, hr = mine ? heat(pos.rate) : null, rew = window.__REW || 0;
    var liq = bal ? bal.uatone : 0, stk = pos ? pos.total : 0, tot = liq + stk + rew;
    var read = pos ? '<span class=sv-wread>' + (window.__POSAT ? 'read ' + ago(window.__POSAT) : '') +
      '<button class=sv-rf type=button data-act=refresh title="Read the wallet again" aria-label="Refresh"><svg viewBox="0 0 24 24" aria-hidden=true><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg></button></span>' : '';
    put("sv-wal",
      /* the heading is the account's own name, as the wallet calls it (Keplr's key name) */
      '<div class=sv-ph><h3 title="' + esc(wname) + '"><span class=sv-wn>' + esc(wname) + '</span></h3><span class="sv-tag g">Self-custody</span><div class=sv-rt>' + read + '</div></div>' +
      '<div class="sv-boxes four">' +
        box("tot", "Total", (pos ? fmt(tot) : "—") + '<em>ATONE</em>',
            mine ? 'staked ATONE earns <b style="color:' + hr.ink + '">' + pct(pos.rate) + '</b> a year' : pos ? "nothing staked" : "connect a wallet to read it") +
        box("stk", "Staked", pos ? fmt(stk) : "—",
            mine ? "on " + pos.rows.length + " validator" + (pos.rows.length === 1 ? "" : "s") + (pos.locked > 0 ? ", " + fmt(pos.locked) + " in cooldown" : "") : pos ? "nothing staked" : "") +
        box("bal", "Available", bal ? fmt(liq) : "—", bal ? '<b class=sv-pho>' + fmt(bal.uphoton) + '</b> PHOTON for fees' : "") +
        box("rew", "Rewards", window.__REW != null ? fmt(rew) : "—", rew > 0 ? "ready to claim" : pos ? "nothing waiting" : "",
            null, rew >= 1 ? '<button class=sv-bact type=button data-act=claim title="Claim your staking rewards">Claim</button>' : "") +
      '</div>');

    /* the opportunity: the same plan the advanced view would sign */
    var plan = planNow(pos);
    var h = "";
    if(!pos){
      /* a first visit: the three steps this screen is for, in the colours they carry below */
      h = '<div class=sv-ph><h3>See what your stake could earn</h3>' +
            '<div class=sv-rt><button class="sv-btn pri" type=button data-act=connect>Connect wallet</button></div></div>' +
          '<ol class="sv-steps col">' +
            '<li style="--sc:#ffb02e"><b>Connect</b><span>your wallet reads your stake; nothing leaves it</span></li>' +
            '<li style="--sc:' + heat(S.mid).fill + '"><b>See where it sits</b><span>on the map: brighter validators pay more</span></li>' +
            '<li style="--sc:#2ee06a"><b>Redelegate</b><span>to the best-paying place, in one signature</span></li>' +
          '</ol>';
    } else if(!pos.rows.length){
      /* nothing below it to show: the message and its one action take the screen's middle */
      h = '<div class=sv-none><h3>No stake on AtomOne</h3>' +
            '<button class="sv-btn go" type=button data-act=stake>Stake ATONE</button></div>';
    } else if(!(pos.free > 0)){
      h = '<div class=sv-ph><h3>Everything is under cooldown</h3>' + tag("a", "21 days") + '</div>' +
          '<div class="sv-boxes two">' + box("now", "Your APR", pct(pos.rate), "on " + pos.rows.length + " validators", "--bc:" + heat(pos.rate).fill) +
            box("cool", "Free to move on", window.__dayFull ? window.__dayFull(pos.until) : "—", fmt(pos.total) + " ATONE redelegated recently") + '</div>' +
          '<div class=sv-note>All <b>' + fmt(pos.total) + ' ATONE</b> was redelegated recently, so the chain will not move it again until <b>' +
          (window.__dayFull ? window.__dayFull(pos.until) : "") + '</b>.</div>';
    } else if(!plan || !(plan.gain > 0.5) || plan.after == null){
      h = '<div class=sv-ph><h3>Nothing to gain by moving</h3></div>' +
          '<div class="sv-boxes four eq sv-mv">' + box("now", "Your APR", '<span style="color:' + heat(pos.rate).ink + '">' + pct(pos.rate) + '</span>', "what your stake earns now", "--bc:" + heat(pos.rate).fill) +
            box("hi", "Best in the set", '<span style="color:' + heat(S.hi).ink + '">' + pct(S.hi) + '</span>', "the highest APR any validator pays", "--bc:" + heat(S.hi).fill) +
            box("stk", "Can move", fmt(pos.free), "ATONE free to redelegate") + box("tot", "Validators", String(pos.rows.length), "holding your stake") + '</div>' +
          '<div class=sv-note>Your stake already earns as much as the set can pay it today. This window re-reads the chain every block and will say so when that changes.</div>' + jailNote(pos);
    } else {
      /* now -> after -> a year: the stake as it earns today, where the plan puts it, and what
         that is worth - each side drawn in the colours the map gives it */
      var lift = plan.after - plan.now, hn = heat(plan.now), ha = heat(plan.after);
      var nowSegs = pos.rows.slice().sort(function(a, b){ return b.x - a.x; }).map(function(r){ return { w: r.x, r: r.rate, t: r.m }; });
      var V = VALS(), byId = {}; V.forEach(function(v){ byId[v[3]] = v; });
      var aftSegs = plan.picks.map(function(q){ var v = byId[q.id];
        return { w: q.x, r: v && window.__rateAfter ? window.__rateAfter(v[1], v[2], q.x) : plan.after, t: q.m }; });
      if(pos.locked > 0) aftSegs.push({ w: pos.locked, r: plan.now, t: "stays: under cooldown" });
      h = '<div class=sv-ph><h3>Move your stake, earn more</h3>' + tag("g", pp(lift) + " APR") +
          '<div class=sv-rt><button class="sv-btn go" type=button data-act=opt>Redelegate</button></div></div>' +
          '<div class="sv-boxes three sv-mv">' +
            side("now", "Now", pct(plan.now), hn, "on " + pos.rows.length + " validator" + (pos.rows.length === 1 ? "" : "s"), nowSegs) +
            side("aft", "After", pct(plan.after), ha, "on " + plan.picks.length + " validator" + (plan.picks.length === 1 ? "" : "s"), aftSegs) +
            box("gain", "A year", "+" + one(plan.gain) + '<em>ATONE</em>', "more, at today\'s rates") +
          '</div>' +
          '<div class=sv-mvnote>' + plan.moves + ' move' + (plan.moves === 1 ? "" : "s") + ' in one signature. Redelegated stake stays in place for 21 days.</div>';
    }
    /* the hero wash only when there is a move to make - the page's one call to action */
    var op = put("sv-optp", h); op.classList.toggle("hero", h.indexOf("data-act=opt") >= 0); op.classList.toggle("fill", h.indexOf("sv-none") >= 0);

    /* where the stake sits now */
    var al = E("sv-allocp");
    if(!pos){
      /* no wallet: the section keeps its shape, like the wallet pane in the other view */
      al.hidden = false;
      put("sv-allocp", '<div class=sv-ph><h3>The validators</h3>' + tag("q", S.n + " in the set") + '</div>' + '<div class=sv-vsc>' + scale([], S, true) + '</div>' + valSkel());
    }
    else if(!pos.rows.length){ al.hidden = true; }
    else {
      al.hidden = false;
      put("sv-allocp", '<div class=sv-ph><h3>Your validators</h3>' +
        tag("q", pos.rows.length + " validator" + (pos.rows.length === 1 ? "" : "s")) + '</div>' + valList(pos, S));
    }

  }
  /* Pricing the plan runs the whole optimiser and two quiet redraws of the
     advanced pane, so it is done once per change that can move the answer and
     read from cache in between. */
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
  function side(cls, lab, big, h, sub, segs){
    /* a long list is its eleven largest and one segment for the rest (a hundred validators would
       not fit the bar), the rest painted at its stake-weighted rate */
    if(segs.length > 12){
      segs = segs.slice().sort(function(a, b){ return b.w - a.w; });
      var rest = segs.slice(11), rw = 0, rr = 0;
      rest.forEach(function(q){ rw += q.w; rr += q.w * q.r; });
      segs = segs.slice(0, 11).concat([{ w: rw, r: rw ? rr / rw : 0, t: rest.length + " more validators" }]);
    }
    var tot = 0; segs.forEach(function(q){ tot += q.w; });
    return '<div class="sv-box b-' + cls + '" style="--bc:' + h.fill + '"><span class=sv-bl>' + lab + '</span><b class=sv-bv style="color:' + h.ink + '">' + big + '</b>' +
      '<span class=sv-bm>' + sub + '</span>' +
      '<div class=sv-mbar>' + segs.map(function(q){
        return '<em style="flex:' + (tot ? (q.w / tot * 100).toFixed(2) : 1) + ' 1 0;background:' + heat(q.r).fill + '" title="' + esc(q.t) + '"></em>'; }).join("") +
      '</div></div>';
  }
  /* the same shape, waiting for a wallet */
  function skelAlloc(){
    var h = '<div class=sv-chips>', i;
    for(i = 0; i < 5; i++) h += '<div class="sv-chip skel"><span class=sv-lgo></span><b></b><em></em><s></s><u></u></div>';
    return h + '</div>';
  }
  /* The stake on the map, then validator by validator, largest first. Each validator is
     pinned where the map paints it (the pin's size is its share of the stake), and its card
     carries the same colour: a reader sees at a glance whether the stake sits at the dim,
     low-paying end or the bright one. */
  /* The wallet's validators as a list: where the stake sits on the APR scale (pins, sized by
     share), then one shaded row each - logo, name and amount, a share bar in the validator's heat,
     its APR in that colour. Five rows at most: four and the rest, which opens Manual. */
  function valList(pos, S){
    var rows = pos.rows.slice().sort(function(a, b){ return b.x - a.x; });
    var pins = rows.map(function(r){ return { r: r.inactive ? 0 : r.rate, s: Math.round(8 + 9 * Math.sqrt(r.x / pos.total)), t: r.m + ", " + pct(r.rate) }; });
    if(rows.length > 12) pins.forEach(function(q){ q.s = Math.max(7, Math.round(q.s * .7)); });
    var shown = rows.length > 5 ? rows.slice(0, 4) : rows, rest = rows.slice(shown.length), restX = 0;
    rest.forEach(function(r){ restX += r.x; });
    var h = '<div class=sv-vlist>' + shown.map(function(r){ var c = heat(r.inactive ? 0 : r.rate), sh = r.x / pos.total * 100;
      return '<div class="sv-vr click" data-v="' + esc(r.id) + '" tabindex=0 title="Open this validator" style="--c:' + c.fill + '">' +
        '<span class=sv-lgo>' + logo(r.id, r.m) + '</span>' +
        '<b class=sv-vn>' + esc(r.m) + '</b><s class=sv-va title="' + (r.locked > 0 ? 'part of it in its 21-day cooldown' : '') + '">' + fmt(r.x) + '<em>ATONE</em></s>' +
        '<span class=sv-vs><span class=sv-vt><i style="width:' + Math.max(2, sh).toFixed(1) + '%"></i></span><em>' + Math.round(sh) + '%</em></span>' +
        '<u style="color:' + c.ink + '">' + (r.inactive ? "inactive" : pct(r.rate)) + '</u></div>'; }).join("");
    if(rest.length) h += '<div class="sv-vr more" data-route="dashboard/manual" tabindex=0 title="All your validators, in Manual">' +
      '<span class=sv-lgo>+' + rest.length + '</span><b class=sv-vn>' + rest.length + ' more</b><s class=sv-va>' + fmt(restX) + '<em>ATONE</em></s>' +
      '<span class=sv-vs><span class=sv-vt><i style="width:' + (restX / pos.total * 100).toFixed(1) + '%"></i></span><em>' + Math.round(restX / pos.total * 100) + '%</em></span><u>see all</u></div>';
    return '<div class=sv-vsc title="The largest validators pay least, the smallest pay most">' + scale(pins, S, true) + '</div>' + h + '</div>';
  }
  function valSkel(){
    var h = '<div class=sv-vlist>', i;
    for(i = 0; i < 4; i++) h += '<div class="sv-vr skel"><span class=sv-lgo></span><b class=sv-vn></b><s class=sv-va></s><span class=sv-vs><span class=sv-vt></span></span><u></u></div>';
    return h + '</div>';
  }
  /* how to read the scale, said once, in its own colours */
  function hint(){ return '<span class=sv-hint><i class=lo></i>the largest pay least<i class=hi></i>the smallest pay most</span>'; }
  function allocation(pos, S, noScale){
    var rows = pos.rows.slice().sort(function(a, b){ return b.x - a.x; });
    var pins = rows.map(function(r){ return { r: r.inactive ? 0 : r.rate, s: Math.round(9 + 11 * Math.sqrt(r.x / pos.total)), t: r.m + ", " + pct(r.rate) }; });
    /* one row, however many validators: the four largest and a card for the rest, which
       opens Manual with the whole list (twenty or fifty cards would push the screen out of
       its box). The pins still show every one, smaller the more there are. */
    var shown = rows.length > 5 ? rows.slice(0, 4) : rows, rest = rows.slice(shown.length), restX = 0;
    rest.forEach(function(r){ restX += r.x; });
    if(rows.length > 12) pins.forEach(function(q){ q.s = Math.max(7, Math.round(q.s * .7)); });
    var more = rest.length ? '<div class="sv-chip more click" data-route="dashboard/manual" tabindex=0 title="All your validators, in Manual">' +
      '<span class=sv-lgo>+' + rest.length + '</span><b>' + rest.length + ' more</b><em>' + Math.round(restX / pos.total * 100) + '<small>%</small></em>' +
      '<s>' + fmt(restX) + ' ATONE</s><u>see all</u></div>' : "";
    return (noScale ? "" : scale(pins, S || setStats())) +
      '<div class=sv-chips>' + shown.map(function(r){ var h = heat(r.inactive ? 0 : r.rate);
        return '<div class="sv-chip click' + (r.locked > 0 ? " hld" : "") + '" data-v="' + esc(r.id) + '" tabindex=0 title="Open this validator" style="--c:' + h.fill + '">' +
          '<span class=sv-lgo>' + logo(r.id, r.m) + '</span>' +
          '<b>' + esc(r.m) + '</b><em>' + Math.round(r.x / pos.total * 100) + '<small>%</small></em>' +
          '<s>' + fmt(r.x) + ' ATONE' + (r.locked > 0 ? ', in cooldown' : '') + '</s><u style="color:' + h.ink + '">' + (r.inactive ? "inactive" : pct(r.rate)) + '</u></div>'; }).join("") + more + '</div>';
  }
  function ago(at){ var s = Math.max(0, Math.round((Date.now() - at) / 1000)); return s < 60 ? s + "s ago" : Math.floor(s / 60) + "m ago"; }

  /* ── AUTOPILOT ──────────────────────────────────────────────────────────── */
  function drawAuto(){
    var pos = window.__POS, at = window.__atInfo ? window.__atInfo() : null, g = at && at.grant;
    var a = g && g.authorization || {};
    var allow = ((a.allow_list || {}).address || []).length;
    var until = g && g.expiration && window.__dayFull ? window.__dayFull(new Date(g.expiration).getTime()) : null;
    var state = g ? tag("g", "Active") : tag("q", "Inactive");
    /* the one door this screen needs, for where the reader is: no wallet, a wallet with
       nothing staked, a stake with no grant, a grant standing */
    var door = !pos ? '<button class="sv-btn pri" type=button data-act=connect>Connect wallet</button>'
      : !pos.rows.length ? '<button class="sv-btn pri" type=button data-act=stake>Stake ATONE</button>'
      : '<button class="sv-btn ' + (g ? "" : "vio") + '" type=button data-act=autopilot>' + (g ? "Manage" : "Set up") + '</button>';

    put("sv-atp",
      '<div class=sv-ph><h3>Autopilot</h3>' + state + '<div class=sv-rt>' + door + '</div></div>' +
      '<div class=sv-note>Autopilot moves your stake to better-paying validators for you: only among the validators <i>you</i> pick, ' +
      'only for as long as <i>you</i> choose. Your ATONE never leaves your wallet, and you can switch it off at any time.</div>' +
      '<div class="sv-cards four">' +
        card("Strategy", g ? esc(strategyWord(g)) : "—", g ? allow + " allowed validators" : "chosen when you set it up") +
        card("Stake it may move", g ? esc(a.max_tokens ? fmt(+a.max_tokens.amount) : "no cap") : "—", g ? "the cap you signed" : "a cap you set") +
        card("Runs until", until || "—", g ? "then it lapses on its own" : "3 or 6 months", "sm") +
        card("Your APR", pos && pos.rows.length ? pct(pos.rate) : "—", pos && pos.rows.length ? "on " + whole(pos.total) + " ATONE" : "") +
      '</div>');

    var al = E("sv-atalloc");
    if(!pos){
      /* no wallet: the section keeps its shape, as on the overview */
      al.hidden = false;
      put("sv-atalloc", '<div class=sv-ph><h3>What it would manage</h3></div>' + skelAlloc());
    } else if(pos.rows.length){
      al.hidden = false;
      var rp = at && at.report, last = rp && rp.checked ? window.__dayFull(rp.checked * 1000) : null;
      /* what the keeper has done, in the header: the moves, and when it last looked */
      var mv = rp && rp.history && rp.history.length
        ? tag("q", rp.history.length + " move" + (rp.history.length === 1 ? "" : "s") + ", last " + window.__dayFull(rp.history[0].at * 1000))
        : tag("q", "no move yet", "The keeper only moves stake when the gain is worth the 21-day cooldown it costs");
      put("sv-atalloc", '<div class=sv-ph><h3>' + (g ? "What it manages" : "What it would manage") + '</h3>' +
          tag("q", pos.rows.length + " validator" + (pos.rows.length === 1 ? "" : "s")) +
          '<div class=sv-rt>' + (g ? mv + tag("g", last ? "checked " + last : "not checked yet") : tag("q", "your stake as it stands")) + '</div></div>' +
        allocation(pos, null, true));
    } else al.hidden = true;

    put("sv-atauth",
      '<div class=sv-ph><h3>What the grant allows</h3>' + tag("q", "enforced by the chain, not by us") + '</div>' +
      '<div class=sv-can>' +
        '<div><u>it may</u><p>' +
          '<span class=sv-ok>redelegate inside your allow-list</span>' +
          (at && at.restake ? '<span class=sv-ok>claim and restake your rewards</span>' : '<span class=sv-dim>claim and restake, if you switch it on</span>') +
        '</p></div>' +
        '<div><u>it may never</u><p>' +
          '<span class=sv-bad>send or spend your ATONE</span>' +
          '<span class=sv-bad>unstake it</span>' +
          '<span class=sv-bad>hold or custody it</span>' +
        '</p></div>' +
      '</div>' +
      '<div class=sv-note>' + (at && at.split_pct > 0
        ? 'GATA keeps <b>' + at.split_pct + '%</b> of the rewards it restakes for you, and charges nothing else.'
        : 'Autopilot is <b>free</b>: GATA takes no share of your rewards.') + '</div>' +
      "");
  }
  /* the strategy word lives in the grant's memo, which the chain does not keep:
     what stands on chain is the allow-list, so that is what this states */
  function strategyWord(g){
    var a = g && g.authorization || {}, n = ((a.allow_list || {}).address || []).length, V = VALS().length;
    return n >= V ? "Whole set" : n + " of " + V + " validators";
  }

  /* ── NETWORK ────────────────────────────────────────────────────────────── */
  /* the chain's governance at a glance: how many proposals, what is open or how the last ended
     (read once a visit from the chain's API; a proposal takes weeks) */
  function drawNet(){
    var S = setStats(), f = function(v){ return v != null ? v.toFixed(2) + "%" : "—"; };
    /* the set's uptime over three spans: each is the average of the validators' own records */
    put("sv-netcards", span("30 days", f(S.up), S.clean30, S.n) + span("90 days", f(S.up90), S.clean90, S.n) +
      span("Since genesis", f(S.life), S.clean, S.n));

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
    fetch("/rpc/status", { cache: "no-store" }).then(function(r){ return r.json(); }).then(function(j){
      var head = Number(j.result.sync_info.latest_block_height), want = [], h;
      for(h = head - 99; h <= head; h++) if(!FB.rows[h]) want.push(h);
      for(var k in FB.rows) if(+k <= head - 100) delete FB.rows[k];
      var next = function(){
        var hh = want.shift(); if(hh === undefined) return Promise.resolve();
        return fetch("/rpc/block?height=" + hh, { cache: "no-store" }).then(function(r){ return r.json(); }).then(function(b){
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
          st("Active validators", String(last[2] || S.n), "", "var(--sv-violet)") +
          st("This block", now.toFixed(0) + "%") +
          st("Last " + n + " blocks", avg.toFixed(2) + "%") +
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
    fetch("/rpc/status", { cache: "no-store" }).then(function(r){ return r.json(); }).then(function(j){
      var head = +j.result.sync_info.latest_block_height, t1 = Date.parse(j.result.sync_info.latest_block_time), back = 14400;
      return fetch("/rpc/block?height=" + (head - back), { cache: "no-store" }).then(function(r){ return r.json(); }).then(function(b){
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
    put("sv-act7", '<div class=sv-ph><h3>Transactions</h3>' + sw + '<span class=sv-gkey>' + (AW === "24h" ? "per hour" : "per day") + '</span>' + stats + '</div>' + body);
    /* per block: the last 100 blocks live (with gas and fees), the last 10,000 in stretches of 100
       (the average per block in each), or per day since genesis (a line) - the indexer keeps
       transactions, not gas or fees */
    var bw = BW, sb = '<span class=sv-sw role=group aria-label="Period">' + [["100", "Last 100 blocks"], ["10k", "Last 10k blocks"], ["all", "Since genesis"]].map(function(o){
      return '<button type=button data-act=bwin data-w=' + o[0] + ' aria-pressed=' + (bw === o[0]) + '>' + o[1] + '</button>'; }).join("") + '</span>';
    var hb = function(k){ return '<div class=sv-ph><h3>Transactions per 100 blocks</h3>' + sb + k + '</div>'; }, sl, lb;
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
    var n = pts.length; if(n < 2) return '<div class=sv-upwait>Not enough history yet</div>';
    var lo = Infinity, hi = -Infinity;
    lines.forEach(function(l){ pts.forEach(function(p){ var v = p[l.k]; if(v < lo) lo = v; if(v > hi) hi = v; }); });
    if(lines.some(function(l){ return l.area; })) lo = Math.min(lo, 0);
    var pad = (hi - lo) * .06 || 1; hi += pad; if(lo > 0) lo = Math.max(0, lo - pad);
    CH[key] = { pts: pts, lines: lines, lo: lo, hi: hi, fmt: fmtV || fmtY };
    var X = function(i){ return (i / (n - 1) * 1000).toFixed(1); }, Y = function(v){ return (300 - (v - lo) / (hi - lo) * 300).toFixed(1); };
    var lv = [0, 1 / 3, 2 / 3, 1];
    var svg = '<svg viewBox="0 0 1000 300" preserveAspectRatio=none aria-hidden=true>' +
      lv.slice(1).map(function(f){ var y = (300 * (1 - f)).toFixed(1); return '<line class=gl x1=0 x2=1000 y1=' + y + ' y2=' + y + '></line>'; }).join("") +
      lines.map(function(l){ var d = pts.map(function(p, i){ return (i ? "L" : "M") + X(i) + " " + Y(p[l.k]); }).join("");
        return (l.area ? '<path class="ar ' + l.cls + '" d="' + d + 'L1000 300L0 300Z"></path>' : '') + '<path class="ln ' + l.cls + '" d="' + d + '"></path>'; }).join("") + '</svg>';
    var dl = function(s){ var d = new Date(s + "T00:00:00Z"); return d.toLocaleDateString("en", { month: "short", year: "numeric", timeZone: "UTC" }); };
    return '<div class=sv-lc data-ch="' + key + '">' + svg +
      lv.map(function(f){ return '<span class=sv-ly style="bottom:' + (f * 100).toFixed(2) + '%">' + fmtY(lo + (hi - lo) * f) + '</span>'; }).join("") +
      '<i class=sv-lcur></i><span class=sv-lcdots></span><span class=sv-lctip></span></div>' +
      '<div class=sv-gx><span>' + dl(pts[0].d) + '</span><span>' + dl(pts[Math.floor(n / 2)].d) + '</span><span>' + dl(pts[n - 1].d) + '</span></div>';
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
    var E0 = DD().econ, hist = E0 && E0.hist || [];
    if(!hist.length){ put("sv-ecoa", '<div class=sv-ph><h3>ATONE supply and stake</h3></div><div class=sv-upwait>Reading the chain…</div>'); put("sv-ecop", '<div class=sv-ph><h3>PHOTON supply</h3></div><div class=sv-upwait>Reading the chain…</div>'); return; }
    var now = hist[hist.length - 1], cut = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), was = null;
    for(var i = hist.length - 1; i >= 0; i--) if(hist[i].d <= cut){ was = hist[i]; break; }
    var ch = function(k){ return was && was[k] ? ((now[k] / was[k] - 1) * 100) : null; };
    var sg = function(v){ return v == null ? "" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1) + "% in 30 days"; };
    var M = function(v){ return v <= 0 ? "0" : (v / 1e12).toFixed(0) + "M"; };
    put("sv-ecoa", '<div class=sv-ph><h3>ATONE</h3><span class=sv-gkey><i class=sup></i>supply<i class=bon></i>bonded</span><div class=sv-rt>' +
      st("Supply", big(now.atone), sg(ch("atone")), "var(--sv-amber)") +
      st("Bonded", (now.bonded / now.atone * 100).toFixed(1) + "%", big(now.bonded) + " staked", "var(--sv-amber)") +
      st("Inflation", DD().set && DD().set.inflation != null ? (DD().set.inflation * 100).toFixed(0) + "%" : "—", "a year, minted to stakers", "var(--sv-amber)") +
      st("Community pool", big(now.pool), "ATONE", "var(--sv-green)") + '</div></div>' +
      chart("ecoa", hist, [{ k: "atone", cls: "sup", name: "Supply" }, { k: "bonded", cls: "bon", area: true, name: "Bonded" }], M, function(v){ return big(v); }));
    put("sv-ecop", '<div class=sv-ph><h3>PHOTON</h3><span class=sv-gkey><i class=pho></i>supply</span><div class=sv-rt>' +
      st("Supply", big(now.photon), sg(ch("photon")), "var(--sv-pho)") +
      st("Mint rate", E0.conv ? E0.conv.toFixed(2) : "—", "PHOTON per ATONE burned", "var(--sv-pho)") +
      st("Community pool", big(now.pool_ph), "PHOTON", "var(--sv-green)") + '</div></div>' +
      chart("ecop", hist, [{ k: "photon", cls: "pho", area: true, name: "Supply" }], M, function(v){ return big(v); }));
  }

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
  function render(){
    drawHead();
    if(root.getAttribute("data-tab") !== "dele" || root.getAttribute("data-ui") !== "simple") return;
    var s = screen();
    if(s === "over") drawOver();
    else if(s === "auto") drawAuto();
    else if(s === "sign") drawSign();
    else if(s === "prop") drawProp();
    else if(s === "act") drawAct();
    else if(s === "eco") drawEco();
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
    var t = ev.target.closest ? ev.target.closest("[data-act],[data-f],[data-v]") : null;
    if(!t) return;
    var act = t.dataset.act;
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
    if(act === "bwin"){ BW = t.dataset.w === "10k" || t.dataset.w === "all" ? t.dataset.w : "100"; try{ localStorage.setItem("th_bw", BW); }catch(e){} drawAct(); return; }
    if(act === "awin"){ AW = t.dataset.w === "30d" || t.dataset.w === "all" ? t.dataset.w : "24h"; try{ localStorage.setItem("th_aw", AW); }catch(e){} drawAct(); return; }
    if(act === "pwin"){ PW = t.dataset.w === "all" ? "all" : "24h"; try{ localStorage.setItem("th_pw", PW); }catch(e){} drawProp(); return; }
    if(act === "refresh"){
      if(window.__refreshPos){ t.classList.add("busy"); window.__refreshPos().then(function(){ t.classList.remove("busy"); render(); }); }
      else { var rf = E("wrefresh"); if(rf) rf.click(); }
      return;
    }
    if(act === "autopilot"){ var ab = E("atbtn"); if(ab) ab.click(); return; }
    if(act === "connect"){ var cb = E("svconn"); if(cb){ ev.stopPropagation(); cb.click(); } return; }
    if(t.dataset.v && window.__vshow) window.__vshow(t.dataset.v);
  }
  function onKey(ev){
    if(ev.key !== "Enter" && ev.key !== " ") return;
    var rt = ev.target.closest ? ev.target.closest(".sv-chip[data-route],.sv-vr[data-route]") : null;
    if(rt && window.__shellGo){ ev.preventDefault(); window.__shellGo(rt.getAttribute("data-route")); return; }
    var t = ev.target.closest ? ev.target.closest("[data-v]") : null;
    if(!t || !window.__vshow) return;
    ev.preventDefault(); window.__vshow(t.dataset.v);
  }
  sv.addEventListener("click", onClick);
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
