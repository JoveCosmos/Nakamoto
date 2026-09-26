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
    var pos = window.__POS, S = setStats(), bal = window.__BAL;
    /* the wallet, as one thing: what it holds in all, how that splits (staked, available, rewards
       waiting), what the staked part earns - then the PHOTON that pays fees and when it was read */
    var mine = pos && pos.rows.length, hr = mine ? heat(pos.rate) : null, rew = window.__REW || 0;
    var liq = bal ? bal.uatone : 0, stk = pos ? pos.total : 0, tot = liq + stk + rew;
    var seg = function(cls, v){ return v > 0 ? '<i class=' + cls + ' style="flex:' + Math.max(v / (tot || 1), .006).toFixed(4) + ' 1 0"></i>' : ''; };
    put("sv-wal",
      '<div class=sv-wtot><span class=sv-kr><span class=sv-k>Your wallet</span><span class="sv-tag g">Self-custody</span></span>' +
        /* the balance says how fresh it is, and the one control that reads it again sits beside it */
        '<span class=sv-wbal><b class=sv-wbig>' + (pos ? fmt(tot) : "—") + '<em>ATONE</em></b>' +
          (pos ? '<span class=sv-wread>' + (window.__POSAT ? 'read ' + ago(window.__POSAT) : '') +
            '<button class=sv-rf type=button data-act=refresh title="Read the wallet again" aria-label="Refresh"><svg viewBox="0 0 24 24" aria-hidden=true><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg></button></span>' : '') +
        '</span>' +
        '<span class=sv-wapr>' + (mine ? 'staked ATONE earns <b style="color:' + hr.ink + '">' + pct(pos.rate) + '</b> a year'
          : pos ? 'nothing staked' : 'connect a wallet to read it') + '</span></div>' +
      '<div class=sv-wbrk>' +
        '<div class=sv-wbar>' + (pos ? seg("stk", stk) + seg("bal", liq) + seg("rew", rew) : '<i class=none></i>') + '</div>' +
        '<div class=sv-wleg>' +
          '<span><i class=stk></i><em>Staked</em><b>' + (pos ? fmt(stk) : "—") + '</b><s>' + (mine ? "on " + pos.rows.length + " validator" + (pos.rows.length === 1 ? "" : "s") : "") +
            (pos && pos.locked > 0 ? ", " + fmt(pos.locked) + " under cooldown" : "") + '</s></span>' +
          '<span><i class=bal></i><em>Available</em><b>' + (bal ? fmt(liq) : "—") + '</b><s>in the wallet</s></span>' +
          '<span><i class=rew></i><em>Rewards</em><b>' + (window.__REW != null ? fmt(rew) : "—") + '</b><s>' + (rew > 0 ? "ready to claim" : "") + '</s></span>' +
        '</div>' +
        '<div class=sv-wfoot><span><b class=sv-pho>' + (bal ? fmt(bal.uphoton) : "—") + '</b> PHOTON for fees</span></div>' +
      '</div>');

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
      /* nothing below it to show: the message and its one action take the screen's middle */
      h = '<div class=sv-none><h3>No stake on AtomOne</h3>' +
            '<button class="sv-btn go" type=button data-act=stake>Stake ATONE</button></div>';
    } else if(!(pos.free > 0)){
      h = '<div class=sv-ph><h3>Everything is under cooldown</h3>' + tag("a", "21 days") + '</div>' +
          '<div class=sv-note>All <b>' + fmt(pos.total) + ' ATONE</b> was redelegated recently, so the chain will not move it again until <b>' +
          (window.__dayFull ? window.__dayFull(pos.until) : "") + '</b>.</div>';
    } else if(!plan || !(plan.gain > 0.5) || plan.after == null){
      h = '<div class=sv-ph><h3>Nothing to gain by moving</h3></div>' +
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
          '<div class=sv-rt><span class=sv-hmeta title="Redelegated stake cannot move again for 21 days">' + plan.moves + ' move' + (plan.moves === 1 ? "" : "s") +
            ' in one signature, then 21 days in place</span><button class="sv-btn go" type=button data-act=opt>Redelegate</button></div></div>' +
          '<div class=sv-flow>' +
            side("now", "Now", pct(plan.now), hn.ink, "on " + pos.rows.length + " validator" + (pos.rows.length === 1 ? "" : "s"), nowSegs) +
            '<div class=sv-arw aria-hidden=true><svg viewBox="0 0 40 16"><path d="M1 8h36M31 2l6 6-6 6"/></svg></div>' +
            side("aft", "After", pct(plan.after), ha.ink, "on " + plan.picks.length + " validator" + (plan.picks.length === 1 ? "" : "s"), aftSegs) +
            '<div class="sv-side gain"><span class=sv-lab>A year</span><b>+' + one(plan.gain) + '</b><i>ATONE more, at today\'s rates</i></div>' +
          '</div>';
    }
    /* the hero wash only when there is a move to make - the page's one call to action */
    var op = put("sv-optp", h); op.classList.toggle("hero", h.indexOf("data-act=opt") >= 0); op.classList.toggle("fill", h.indexOf("sv-none") >= 0);

    /* where the stake sits now */
    var al = E("sv-allocp");
    if(!pos){
      /* no wallet: the section keeps its shape, like the wallet pane in the other view */
      al.hidden = false;
      put("sv-allocp", '<div class=sv-ph><h3>The validators</h3>' + tag("q", S.n + " in the set") + '<div class=sv-rt>' + hint() + '</div></div>' + scale([], S) + skelAlloc());
    }
    else if(!pos.rows.length){ al.hidden = true; }
    else {
      al.hidden = false;
      put("sv-allocp", '<div class=sv-ph><h3>Your validators</h3>' +
        tag("q", pos.rows.length + " validator" + (pos.rows.length === 1 ? "" : "s")) +
        '<div class=sv-rt>' + hint() + '</div></div>' + allocation(pos, S));
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
  /* one side of the plan: its APR in its own heat, and the stake as a bar of heat segments */
  function side(cls, lab, big, ink, sub, segs){
    /* a long list is its eleven largest and one segment for the rest (a hundred validators would
       not fit the bar), the rest painted at its stake-weighted rate */
    if(segs.length > 12){
      segs = segs.slice().sort(function(a, b){ return b.w - a.w; });
      var rest = segs.slice(11), rw = 0, rr = 0;
      rest.forEach(function(q){ rw += q.w; rr += q.w * q.r; });
      segs = segs.slice(0, 11).concat([{ w: rw, r: rw ? rr / rw : 0, t: rest.length + " more validators" }]);
    }
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
          '<s>' + fmt(r.x) + ' ATONE' + (r.locked > 0 ? ' · cooldown' : '') + '</s><u style="color:' + h.ink + '">' + (r.inactive ? "inactive" : pct(r.rate)) + '</u></div>'; }).join("") + more + '</div>';
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
        : 'Autopilot is <b>free</b>: GATA takes no share of your rewards.') +
      ' It can only do what you allowed above; AtomOne itself refuses anything else.</div>' +
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
  var PROPS = { at: 0, total: null, voting: 0, last: null };
  function readProps(){
    if(PROPS.at && Date.now() - PROPS.at < 600000) return;
    PROPS.at = Date.now();
    var api = (window.__API || "https://atomone-api.gatadao.com") + "/atomone/gov/v1/proposals";
    Promise.all([
      fetch(api + "?pagination.limit=1&pagination.count_total=true&pagination.reverse=true").then(function(r){ return r.json(); }),
      fetch(api + "?proposal_status=PROPOSAL_STATUS_VOTING_PERIOD&pagination.limit=50").then(function(r){ return r.json(); })
    ]).then(function(x){
      PROPS.total = +((x[0].pagination || {}).total || 0) || null;
      var p = (x[0].proposals || [])[0]; PROPS.last = p ? { id: p.id, status: String(p.status || "").replace("PROPOSAL_STATUS_", "").toLowerCase() } : null;
      PROPS.voting = (x[1].proposals || []).length;
      if(screen() === "net") drawNet();
    }).catch(function(){ PROPS.at = 0; });
  }
  function drawNet(){
    var D = DD(), S = setStats(), e = D.eta || {};
    readProps();
    var bon = e.enabled ? '<span class=sv-on>Active</span>' : '<span class=sv-off>Off</span>';
    put("sv-netcards",
      card("Nakamoto Bonus", bon,
           e.enabled ? (e.week ? "week " + e.week + " · " : "") + (e.now != null ? Math.round(e.now * 100) + "% of the reward pool shared equally" : "") : "the reward pool follows stake alone") +
      card("Proposals", PROPS.total != null ? String(PROPS.total) : "—",
           PROPS.voting ? '<b class=sv-on>' + PROPS.voting + ' in voting now</b>'
             : PROPS.last ? "none in voting · #" + esc(PROPS.last.id) + " " + esc(PROPS.last.status.replace(/_/g, " ")) : "") +
      card("Uptime", (S.up != null ? S.up.toFixed(2) + "%" : "—"),
           "30-day average across the set, " + S.clean + " never jailed"));

    drawUp(S);
  }

  /* ── network uptime, live ────────────────────────────────────────────────
     Block by block, the share of the set that signed: the last ~120 blocks (live.py publishes
     them in live.json, which every visitor already reads each block). Until that file carries
     them - an older live.py, or dev, which reads production's file - the screen reads the last
     60 blocks itself, four at a time, and then one per new block. */
  var FB = { rows: {}, busy: false };
  function fbRows(){
    if(FB.busy) return;
    FB.busy = true;
    fetch("/rpc/status", { cache: "no-store" }).then(function(r){ return r.json(); }).then(function(j){
      var head = Number(j.result.sync_info.latest_block_height), want = [], h;
      for(h = head - 59; h <= head; h++) if(!FB.rows[h]) want.push(h);
      for(var k in FB.rows) if(+k <= head - 60) delete FB.rows[k];
      var next = function(){
        var hh = want.shift(); if(hh === undefined) return Promise.resolve();
        return fetch("/rpc/block?height=" + hh, { cache: "no-store" }).then(function(r){ return r.json(); }).then(function(b){
          var sigs = b.result.block.last_commit.signatures || [], miss = [];
          sigs.forEach(function(x){ if(x.block_id_flag !== 2 && x.validator_address) miss.push(x.validator_address); });
          if(sigs.length) FB.rows[hh] = [hh - 1, sigs.length - miss.length, sigs.length, miss.join(",")];
        }).catch(function(){}).then(next);
      };
      return Promise.all([next(), next(), next(), next()]);
    }).catch(function(){}).then(function(){ FB.busy = false; if(screen() === "net") drawUp(setStats()); });
  }
  function upRows(){
    var r = window.__UP && window.__UP.length ? window.__UP
      : Object.keys(FB.rows).map(Number).sort(function(a, b){ return a - b; }).map(function(k){ return FB.rows[k]; });
    /* a phone shows the last 40: 120 bars on 360 pixels are hairlines */
    return innerWidth <= 620 && r.length > 40 ? r.slice(-40) : r;
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
    if(!window.__UP) fbRows();
    var head = '<div class=sv-ph><h3>Network uptime</h3><span class="sv-tag q"><i class=sv-livedot></i>live</span>';
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
    var marks = "", lastLabel = 1e9;
    for(var i = n - 1; i >= 0; i--){
      var r = rows[i]; if(!(r[1] < r[2]) || !r[3]) continue;
      var vs = r[3].split(",").map(who), x = (i + .5) / n * 100, lab = lastLabel - x > 11;
      if(lab) lastLabel = x;
      marks += '<span class="sv-upm' + (lab ? "" : " bare") + (x > 80 ? " rt" : "") + '" style="left:' + x.toFixed(2) + '%" title="' +
        esc("block " + Number(r[0]).toLocaleString() + ": missed by " + vs.map(function(v){ return v.m; }).join(", ")) + '">' +
        '<span class=sv-uplg>' + logo(vs[0].id, vs[0].m) + '</span>' + (lab ? '<b>' + esc(vs[0].m) + (vs.length > 1 ? " +" + (vs.length - 1) : "") + '</b>' : "") + '</span>';
    }
    var hv = UPHOVER >= 0 && UPHOVER < n ? rows[UPHOVER] : null;
    put("sv-up", head +
        '<span class=sv-upwin>last ' + n + ' blocks · about ' + mins + ' min</span>' +
        '<div class=sv-rt>' +
          '<span class=sv-upst><i class=sw></i><em>This block</em><b>' + now.toFixed(0) + '%</b><small>' + last[1] + ' of ' + last[2] + ' signed</small></span>' +
          '<span class=sv-upst><i class="sw av"></i><em>Last ' + n + ' blocks</em><b>' + avg.toFixed(2) + '%</b><small>average</small></span>' +
          (ref != null ? '<span class=sv-upst><i class="sw ref"></i><em>30-day average</em><b class=w>' + ref.toFixed(2) + '%</b><small>dashed line</small></span>' : '') +
        '</div></div>' +
      '<div class=sv-upchart>' +
        '<div class=sv-upmarks>' + marks + '</div>' +
        '<div class=sv-upplot>' +
          '<span class=sv-upy style="bottom:100%">100%</span><span class=sv-upy style="bottom:0">' + lo + '%</span>' +
          (ref != null ? '<span class=sv-upref style="bottom:' + H(ref) + '%"></span>' : '') +
          '<div class=sv-upbars>' + bars + '</div>' +
          (hv ? '<div class=sv-uptip style="left:' + Math.min(76, Math.max(0, (UPHOVER + .5) / n * 100 - 12)).toFixed(1) + '%"><b>block ' + Number(hv[0]).toLocaleString() + '</b>' +
            hv[1] + ' of ' + hv[2] + ' signed' + (hv[3] ? '<br>missed by ' + esc(hv[3].split(",").map(function(a){ return who(a).m; }).join(", ")) : '') + '</div>' : '') +
        '</div>' +
        '<div class=sv-upx><span>&larr; older<i class=bn> · block ' + Number(rows[0][0]).toLocaleString() + '</i></span><span>now<i class=bn> · block ' + Number(last[0]).toLocaleString() + '</i> &rarr;</span></div>' +
      '</div>');
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
  window.addEventListener("thermo:up", function(){ if(screen() === "net" && root.getAttribute("data-svs") === "net") drawUp(setStats()); });
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
    var rt = ev.target.closest ? ev.target.closest(".sv-chip[data-route]") : null;
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
