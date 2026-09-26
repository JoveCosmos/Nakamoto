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
  function big(u){ var a = u / 1e6; return a >= 1e6 ? (a / 1e6).toFixed(2) + "M" : a >= 1e3 ? (a / 1e3).toFixed(1) + "k" : String(Math.floor(a)); }
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
  function put(id, h){ var el = E(id); if(!el || LASTH[id] === h) return el; LASTH[id] = h; el.innerHTML = h; return el; }
  function rate0(t, c){ return window.__rateAfter ? window.__rateAfter(t, c, 0) : 0; }
  function VALS(){ return window.__VALS ? window.__VALS() : []; }
  function DD(){ return window.__D || { set: {}, eta: {}, nakamoto: {}, rule: {} }; }
  function tag(cls, t, title){ return '<span class="sv-tag ' + cls + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + t + '</span>'; }
  function fig(cls, k, v){ return '<div class="sv-fig ' + cls + '"><span>' + k + '</span><b>' + v + '</b></div>'; }
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
    var V = VALS(), ticks = "", i;
    if(!mini) for(i = 0; i < V.length; i++) ticks += '<s style="left:' + (heat(rate0(V[i][1], V[i][2])).p * 100).toFixed(2) + '%"></s>';
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
    var V = VALS(), D = DD(), rs = [], i, up = 0, upn = 0, clean = 0;
    for(i = 0; i < V.length; i++){
      rs.push(rate0(V[i][1], V[i][2]));
      var d = window.__VDBY && window.__VDBY[V[i][3]];
      if(d && d.d30 != null){ up += +d.d30; upn++; }
      if(!V[i][4]) clean++;
    }
    var s = rs.slice().sort(function(a, b){ return a - b; });
    return { lo: s[0] || 0, hi: s[s.length - 1] || 0, mid: s.length ? s[(s.length - 1) >> 1] : 0,
             n: V.length, up: upn ? up / upn : null, clean: clean, set: D.set || {} };
  }

  /* ── OVERVIEW ───────────────────────────────────────────────────────────── */

  function drawOver(){
    var pos = window.__POS, S = setStats();
    put("sv-staked", (pos ? whole(pos.total) : "—") + '<em>ATONE</em>');
    put("sv-stsub", pos ? (pos.rows.length + " validator" + (pos.rows.length === 1 ? "" : "s") +
      (pos.locked > 0 ? ', <s>' + fmt(pos.locked) + " under cooldown</s>" : "")) : "connect a wallet to read your position");
    var mine = pos && pos.rows.length, hr = mine ? heat(pos.rate) : null;
    var ap = put("sv-apr", mine ? pct(pos.rate) : "—"); if(ap) ap.style.color = hr ? hr.ink : "";
    /* your APR where the map would paint it, between what the set pays least and most */
    put("sv-aprsub", scale(mine ? [{ r: pos.rate, s: 12, t: "your APR, " + pct(pos.rate) }] : [], S, true));
    put("sv-rew", (window.__REW != null ? fmt(window.__REW) : "—") + '<em>ATONE</em>');
    put("sv-rewsub", window.__REW > 0 ? "earned and not yet claimed" : pos ? "nothing waiting" : "");

    /* the opportunity: the same plan the advanced view would sign */
    var plan = planNow(pos);
    var h = "";
    if(!pos){
      /* a first visit: the three steps this screen is for, in the colours they carry below */
      h = '<div class=sv-ph><h3>See what your stake could earn</h3>' +
            '<div class=sv-rt><button class="sv-btn pri" type=button data-act=connect>Connect wallet</button></div></div>' +
          '<ol class=sv-steps>' +
            '<li style="--sc:#ffb02e"><b>Connect</b><span>your wallet reads your stake; nothing leaves it</span></li>' +
            '<li style="--sc:' + heat(S.mid).fill + '"><b>See where it sits</b><span>on the map: brighter validators pay more</span></li>' +
            '<li style="--sc:#2ee06a"><b>Redelegate</b><span>to the best-paying place, in one signature</span></li>' +
          '</ol>';
    } else if(!pos.rows.length){
      h = '<div class=sv-ph><h3>No stake on AtomOne yet</h3>' +
            '<div class=sv-rt><button class="sv-btn go" type=button data-act=stake>Stake ATONE</button></div></div>' +
          '<div class=sv-note>Stake ATONE with a validator and this screen fills in: what it earns, what it could earn, and where it sits.</div>';
    } else if(!(pos.free > 0)){
      h = '<div class=sv-ph><h3>Everything is under cooldown</h3>' + tag("a", "21 days") + '</div>' +
          '<div class=sv-note>All <b>' + fmt(pos.total) + ' ATONE</b> was redelegated recently, so the chain will not move it again until <b>' +
          (window.__dayFull ? window.__dayFull(pos.until) : "") + '</b>. It goes on earning where it is.</div>';
    } else if(!plan || !(plan.gain > 0.5) || plan.after == null){
      h = '<div class=sv-ph><h3>Nothing to gain by moving</h3>' + tag("q", "checked just now") + '</div>' +
          '<div class=sv-note>Your stake already earns as much as the set can pay it today. This screen re-reads the chain every block, so it will say so when that changes.</div>' +
          '<div class=sv-figs>' + fig("", "your APR", pct(pos.rate)) + fig("dim", "best in set", pct(S.hi)) +
          fig("dim", "can move", fmt(pos.free) + '<i>ATONE</i>') + fig("dim", "validators", String(pos.rows.length)) + '</div>';
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
          '<div class=sv-rt><span class=sv-hmeta title="Redelegated stake cannot move again for 21 days">' + fmt(pos.free) + ' ATONE · ' + plan.moves + ' move' + (plan.moves === 1 ? "" : "s") +
            ' · one signature · then 21 days in place</span><button class="sv-btn go" type=button data-act=opt>Redelegate</button></div></div>' +
          '<div class=sv-flow>' +
            side("now", "Now", pct(plan.now), hn.ink, "on " + pos.rows.length + " validator" + (pos.rows.length === 1 ? "" : "s"), nowSegs) +
            '<div class=sv-arw aria-hidden=true><svg viewBox="0 0 40 16"><path d="M1 8h36M31 2l6 6-6 6"/></svg></div>' +
            side("aft", "After", pct(plan.after), ha.ink, "on " + plan.picks.length + " validator" + (plan.picks.length === 1 ? "" : "s"), aftSegs) +
            '<div class="sv-side gain"><span class=sv-lab>A year</span><b>+' + one(plan.gain) + '</b><i>ATONE more, at today\'s rates</i></div>' +
          '</div>';
    }
    /* the hero wash only when there is a move to make - the page's one call to action */
    put("sv-optp", h).classList.toggle("hero", h.indexOf("data-act=opt") >= 0);

    /* where the stake sits now */
    var al = E("sv-allocp");
    if(!pos){
      /* no wallet: the section keeps its shape, like the wallet pane in the other view */
      al.hidden = false;
      put("sv-allocp", '<div class=sv-ph><h3>Where stake can sit</h3>' + tag("q", S.n + " validators") + '<div class=sv-rt>' + hint() + '</div></div>' + scale([], S) + skelAlloc());
    }
    else if(!pos.rows.length){ al.hidden = true; }
    else {
      al.hidden = false;
      put("sv-allocp", '<div class=sv-ph><h3>Where your stake sits</h3>' +
        tag("q", pos.rows.length + " validator" + (pos.rows.length === 1 ? "" : "s")) +
        '<div class=sv-rt>' + hint() + '</div></div>' + allocation(pos, S));
    }

    /* the line under it: autopilot, freshness, the two plain controls */
    var at = window.__atInfo ? window.__atInfo() : null;
    put("sv-foot", '<span class="sv-stat' + (at && at.grant ? ' on' : '') + '"><i></i>' + autopilotWord(at) + '</span>' +
      (pos ? '<span class=sv-sep>|</span><span>' + (window.__POSAT ? "read " + ago(window.__POSAT) : "") + '</span>' : "") +
      '<div class=sv-rt>' +
        (pos ? '<button class="sv-btn sml" type=button data-act=refresh>Refresh</button>' : "") +
        '<button class="sv-btn sml" type=button data-route="dashboard/autopilot">Autopilot</button>' +
      '</div>');
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
  /* one side of the plan: its APR in its own heat, and the stake as a bar of heat segments */
  function side(cls, lab, big, ink, sub, segs){
    var tot = 0; segs.forEach(function(q){ tot += q.w; });
    return '<div class="sv-side ' + cls + '"><span class=sv-lab>' + lab + '</span><b style="color:' + ink + '">' + big + '</b><i>' + sub + '</i>' +
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
  /* how to read the scale, said once, in its own colours */
  function hint(){ return '<span class=sv-hint><i class=lo></i>the largest pay least<i class=hi></i>the smallest pay most</span>'; }
  function allocation(pos, S, noScale){
    var rows = pos.rows.slice().sort(function(a, b){ return b.x - a.x; });
    var pins = rows.map(function(r){ return { r: r.inactive ? 0 : r.rate, s: Math.round(9 + 11 * Math.sqrt(r.x / pos.total)), t: r.m + ", " + pct(r.rate) }; });
    return (noScale ? "" : scale(pins, S || setStats())) +
      '<div class=sv-chips>' + rows.map(function(r){ var h = heat(r.inactive ? 0 : r.rate);
        return '<div class="sv-chip click' + (r.locked > 0 ? " hld" : "") + '" data-v="' + esc(r.id) + '" tabindex=0 title="Open this validator" style="--c:' + h.fill + '">' +
          '<span class=sv-lgo>' + logo(r.id, r.m) + '</span>' +
          '<b>' + esc(r.m) + '</b><em>' + Math.round(r.x / pos.total * 100) + '<small>%</small></em>' +
          '<s>' + fmt(r.x) + ' ATONE' + (r.locked > 0 ? ' · cooldown' : '') + '</s><u style="color:' + h.ink + '">' + (r.inactive ? "inactive" : pct(r.rate)) + '</u></div>'; }).join("") + '</div>';
  }
  function ago(at){ var s = Math.max(0, Math.round((Date.now() - at) / 1000)); return s < 60 ? s + "s ago" : Math.floor(s / 60) + "m ago"; }
  function autopilotWord(at){
    if(at && at.grant) return "Autopilot is active" + (at.restake ? ", restaking rewards" : "");
    return "Autopilot is inactive";
  }

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
      '<div class=sv-note>Autopilot is an <b>authz grant</b>: you allow GATA\'s keeper to redelegate <i>your</i> stake between validators <i>you</i> allow, ' +
      'for a period <i>you</i> set. Your stake never leaves your wallet, and you can revoke authz at any time.</div>' +
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
      put("sv-atalloc", '<div class=sv-ph><h3>' + (g ? "What it manages" : "What it would manage") + '</h3>' +
          tag("q", pos.rows.length + " validator" + (pos.rows.length === 1 ? "" : "s")) +
          '<div class=sv-rt>' + tag(g ? "g" : "q", g ? (last ? "last check " + last : "not checked yet") : "your stake as it stands") + '</div></div>' +
        allocation(pos, null, true) +
        (g ? '<div class=sv-note>' + (rp && rp.history && rp.history.length
          ? '<b>' + rp.history.length + '</b> move' + (rp.history.length === 1 ? "" : "s") + ' made, the last on <b>' + window.__dayFull(rp.history[0].at * 1000) + '</b>.'
          : "No move yet. The keeper only moves stake when the gain is worth the 21-day cooldown it costs.") + '</div>' : ""));
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
        ? 'GATA takes <b>' + at.split_pct + '%</b> of the rewards a restake claims. Nothing else is charged.'
        : 'GATA takes <b>no share</b> of your rewards today.') +
      ' The keeper signs with its own key, off this machine, and the chain rejects anything outside the grant.</div>' +
      (g ? '<div class=sv-tools><button class="sv-btn red" type=button data-act=autopilot>Revoke authz</button></div>' : ""));
  }
  /* the strategy word lives in the grant's memo, which the chain does not keep:
     what stands on chain is the allow-list, so that is what this states */
  function strategyWord(g){
    var a = g && g.authorization || {}, n = ((a.allow_list || {}).address || []).length, V = VALS().length;
    return n >= V ? "Whole set" : n + " of " + V + " validators";
  }

  /* ── NETWORK ────────────────────────────────────────────────────────────── */
  /* a validator's APR as the map paints it: a dot of its fill, the figure in its ink */
  function aprCell(r){ var h = heat(r); return '<span class=sv-apr style="color:' + h.ink + '"><i style="background:' + h.fill + '"></i>' + pct(r) + '</span>'; }
  var FILTER = "all", FIND = "";
  function drawNet(){
    var D = DD(), S = setStats(), s = S.set, V = VALS(), mine = window.__MINE || {};
    var e = D.eta || {}, i10 = 0, t10 = 0;
    for(i10 = 0; i10 < 10 && i10 < V.length; i10++) t10 += V[i10][1];
    var top10 = s.bonded ? t10 / s.bonded * 100 : 0;
    var ratio = window.__ratio ? window.__ratio() : NaN;
    put("sv-nethead",
      '<div class=sv-ph><h3>The AtomOne set</h3>' +
        (e.enabled ? tag("a", "Nakamoto bonus active") : tag("q", "bonus off")) +
        (e.week ? tag("q", "week " + e.week) : "") +
        '<div class=sv-rt>' + tag("q", big(s.bonded || 0) + " ATONE staked") +
          tag("q", (s.bonded_pct != null ? s.bonded_pct.toFixed(1) : "—") + "% of supply") +
          tag("q", S.n + " validators") + '</div>' +
      '</div>' +
      '<div class=sv-note>AtomOne shares part of <b>the reward pool, after the community tax,</b> equally between validators and the rest by stake. ' +
      'That is why a smaller validator can pay a higher APR on the same ATONE, and why spreading a stake earns more than concentrating it.</div>');

    put("sv-netcards",
      card("Bonus coefficient", 'η ' + (e.now != null ? e.now.toFixed(2) : "—"),
           e.now != null ? Math.round(e.now * 100) + "% of the reward pool, shared equally" : "") +
      card("APR across the set", '<span style="color:' + heat(S.lo).ink + '">' + pct(S.lo) + '</span><em>to</em><span style="color:' + heat(S.hi).ink + '">' + pct(S.hi) + '</span>',
           "median " + pct(S.mid) + ", brighter pays more") +
      card("Concentration", (isFinite(ratio) ? ratio.toFixed(1) : "—") + '<em>×</em>',
           "largest third against smallest, top ten hold " + top10.toFixed(0) + "%") +
      card("Record", (S.up != null ? S.up.toFixed(2) + "%" : "—"),
           "average 30-day uptime, " + S.clean + " never jailed"));

    var segs = [["all", "All " + S.n], ["mine", "My stake"], ["clean", "Never jailed"], ["small", "Below average"]];
    put("sv-segs", segs.map(function(x){
      return '<button class=sv-seg type=button data-f="' + x[0] + '" aria-pressed="' + (FILTER === x[0] ? "true" : "false") + '">' + x[1] + '</button>'; }).join(""));

    var mean = (s.bonded || 0) / (S.n || 1), q = FIND.toLowerCase(), rows = [], i;
    for(i = 0; i < V.length; i++){
      var v = V[i], d = (window.__VDBY && window.__VDBY[v[3]]) || {};
      if(FILTER === "mine" && !mine[v[3]]) continue;
      if(FILTER === "clean" && v[4]) continue;
      if(FILTER === "small" && v[1] >= mean) continue;
      if(q && String(v[0]).toLowerCase().indexOf(q) < 0 && !(q.length >= 5 && String(d.op || "").toLowerCase().indexOf(q) >= 0)) continue;
      rows.push({ i: i, v: v, d: d });
    }
    var pos = window.__POS, held = {};
    if(pos) pos.rows.forEach(function(r){ held[r.id] = r.x; });
    /* a phone gets its own four columns - the validator with its power and record beneath
       the name - rather than a table wider than the screen */
    if(innerWidth <= 620){
      var hp = '<table class="sv-tbl ph"><colgroup><col style="width:30px"><col><col style="width:58px"><col style="width:66px"></colgroup>' +
               '<thead><tr><th>#</th><th class=l>validator</th><th>APR</th><th>yours</th></tr></thead><tbody>';
      rows.forEach(function(r){
        var v = r.v, d = r.d, up = d.d30 != null ? +d.d30 : null, j = v[4] || 0;
        hp += '<tr' + (held[v[3]] ? ' class=mine' : "") + ' data-v="' + esc(v[3]) + '" tabindex=0 title="Open this validator">' +
          '<td>' + (r.i + 1) + '</td>' +
          '<td class=l><span class=sv-nm>' + logo(v[3], v[0]) + '<span class=tx><b>' + esc(v[0]) + '</b><i>' + big(v[1]) + ' ATONE, ' +
            '<span class="' + (up == null ? "sv-dim" : up >= 95 ? "sv-ok" : up >= 85 ? "sv-warn" : "sv-bad") + '">' + (up == null ? "—" : up.toFixed(1) + "%") + '</span>' +
            (j ? ', <span class="' + (j === 1 ? "sv-warn" : "sv-bad") + '">jailed ' + j + '×</span>' : '') + '</i></span></span></td>' +
          '<td>' + aprCell(rate0(v[1], v[2])) + '</td>' +
          '<td>' + (held[v[3]] ? '<b>' + big(held[v[3]]) + '</b>' : '<span class=sv-dim>—</span>') + '</td></tr>';
      });
      put("sv-nettbl", hp + '</tbody></table>');
      put("sv-netfoot", '<span>' + rows.length + " of " + S.n + " validators</span>" +
        '<div class=sv-rt>' + (window.__LIVEH && window.__LIVEH() ? "block " + window.__LIVEH().toLocaleString() : "") + '</div>');
      return;
    }
    var h = '<table class=sv-tbl><thead><tr><th>#</th><th class=l>validator</th><th>voting power</th><th>30d uptime</th>' +
            '<th>jailed</th><th>fee</th><th>APR</th><th>your stake</th></tr></thead><tbody>';
    rows.forEach(function(r){
      var v = r.v, d = r.d, up = d.d30 != null ? +d.d30 : null, j = v[4] || 0;
      h += '<tr' + (held[v[3]] ? ' class=mine' : "") + ' data-v="' + esc(v[3]) + '" tabindex=0 title="Open this validator">' +
        '<td>' + (r.i + 1) + '</td>' +
        '<td class=l><span class=sv-nm>' + logo(v[3], v[0]) + '<span class=tx><b>' + esc(v[0]) + '</b><i>' + esc(String(d.op || "").slice(0, 14)) + '…</i></span></span></td>' +
        '<td>' + big(v[1]) + ' <span class=sv-dim>ATONE</span><span class=sv-sm>' + (d.vp != null ? d.vp.toFixed(2) + "% share" : "") + '</span></td>' +
        '<td class="' + (up == null ? "sv-dim" : up >= 95 ? "sv-ok" : up >= 85 ? "sv-warn" : "sv-bad") + '">' + (up == null ? "—" : up.toFixed(2) + "%") + '</td>' +
        '<td class="' + (!j ? "sv-dim" : j === 1 ? "sv-warn" : "sv-bad") + '">' + (j ? j + "×" : "never") + '</td>' +
        '<td>' + Math.round(v[2] * 100) + '%</td>' +
        '<td>' + aprCell(rate0(v[1], v[2])) + '</td>' +
        '<td>' + (held[v[3]] ? '<b>' + fmt(held[v[3]]) + '</b>' : '<span class=sv-dim>—</span>') + '</td></tr>';
    });
    put("sv-nettbl", h + '</tbody></table>');
    put("sv-netfoot", '<span>' + rows.length + " of " + S.n + " validators</span>" +
      '<div class=sv-rt>' + (window.__LIVEH && window.__LIVEH() ? "block " + window.__LIVEH().toLocaleString() : "") + '</div>');
  }

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
    /* th_ui is the version switch's (shell.js); this only remembers the screen */
    try{ if(scr) localStorage.setItem("th_svs", scr); }catch(e){}
    render();
  };

  function onClick(ev){
    var t = ev.target.closest ? ev.target.closest("[data-act],[data-f],[data-v]") : null;
    if(!t) return;
    if(t.dataset.f){ FILTER = t.dataset.f; render(); return; }
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
    if(act === "refresh"){ var rf = E("wrefresh"); if(rf) rf.click(); return; }
    if(act === "autopilot"){ var ab = E("atbtn"); if(ab) ab.click(); return; }
    if(act === "connect"){ var cb = E("svconn"); if(cb){ ev.stopPropagation(); cb.click(); } return; }
    if(t.dataset.v && window.__vshow) window.__vshow(t.dataset.v);
  }
  function onKey(ev){
    if(ev.key !== "Enter" && ev.key !== " ") return;
    var t = ev.target.closest ? ev.target.closest("[data-v]") : null;
    if(!t || !window.__vshow) return;
    ev.preventDefault(); window.__vshow(t.dataset.v);
  }
  sv.addEventListener("click", onClick);
  sv.addEventListener("keydown", onKey);
  var find = E("sv-find");
  if(find) find.addEventListener("input", function(){ FIND = find.value.trim(); if(screen() === "net") drawNet(); });

  /* the pill's two controls: the address copies, the icon disconnects - no menu */
  var cp = E("svcopy"), out = E("svout"), cpT = 0;
  if(cp) cp.addEventListener("click", function(){ if(window.__ADDR && window.copyText) window.copyText(window.__ADDR, function(){
    cp.classList.add("done"); cp.title = "Copied"; clearTimeout(cpT);
    cpT = setTimeout(function(){ cp.classList.remove("done"); cp.title = "Copy address"; }, 1400); }); });
  if(out) out.addEventListener("click", function(){ if(window.__wdisconnect) window.__wdisconnect(); setTimeout(render, 0); });

  /* every figure follows the dashboard's own redraw, and the height ticks on its own */
  window.addEventListener("thermo:draw", schedule);
  /* a turned phone gets the other table markup at once, not at the next block */
  var rzT = 0; window.addEventListener("resize", function(){ clearTimeout(rzT); rzT = setTimeout(schedule, 150); });
  window.addEventListener("thermo:live", schedule);
  setInterval(function(){ if(root.getAttribute("data-ui") === "simple" && screen() === "over") schedule(); }, 15000);
  render();
})();
