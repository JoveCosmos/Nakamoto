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
  function rate0(t, c){ return window.__rateAfter ? window.__rateAfter(t, c, 0) : 0; }
  function VALS(){ return window.__VALS ? window.__VALS() : []; }
  function DD(){ return window.__D || { set: {}, eta: {}, nakamoto: {}, rule: {} }; }
  function tag(cls, t, title){ return '<span class="sv-tag ' + cls + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + t + '</span>'; }
  function fig(cls, k, v){ return '<div class="sv-fig ' + cls + '"><span>' + k + '</span><b>' + v + '</b></div>'; }
  function card(k, v, sub, cls){
    return '<div class=sv-card><span class=sv-k>' + k + '</span>' +
           '<span class="sv-big ' + (cls || "") + '">' + v + '</span><span class=sv-sub>' + (sub || "") + '</span></div>';
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
    var st = E("sv-staked"), su = E("sv-stsub"), ap = E("sv-apr"), au = E("sv-aprsub"), rw = E("sv-rew"), ru = E("sv-rewsub");
    st.innerHTML = (pos ? whole(pos.total) : "—") + '<em>ATONE</em>';
    su.innerHTML = pos ? (pos.rows.length + " validator" + (pos.rows.length === 1 ? "" : "s") +
      (pos.locked > 0 ? ', <s>' + fmt(pos.locked) + " under cooldown</s>" : "")) : "connect a wallet to read your position";
    ap.innerHTML = pos && pos.rows.length ? pct(pos.rate) : "—";
    au.innerHTML = "the set pays <b>" + pct(S.lo) + "</b> to <b>" + pct(S.hi) + "</b>";
    rw.innerHTML = (window.__REW != null ? fmt(window.__REW) : "—") + '<em>ATONE</em>';
    ru.innerHTML = window.__REW > 0 ? "earned and not yet claimed" : pos ? "nothing waiting" : "";

    /* the opportunity: the same plan the advanced view would sign */
    var box = E("sv-optp"), plan = planNow(pos);
    var h = "";
    if(!pos){
      h = '<div class=sv-ph><h3>Your stake, in one screen</h3></div>' +
          '<div class=sv-note>Connect a wallet in the bar above to see what your stake earns, and what it would earn better ' +
          'placed. Nothing leaves your wallet: every move is a transaction you sign yourself.</div>';
    } else if(!pos.rows.length){
      h = '<div class=sv-ph><h3>No stake on AtomOne yet</h3></div>' +
          '<div class=sv-note>Stake ATONE with a validator and this screen fills in: what it earns, what it could earn, and where it sits.</div>' +
          '<div class=sv-tools><button class="sv-btn go" type=button data-act=stake>Stake ATONE</button></div>';
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
      var lift = plan.after - plan.now;
      h = '<div class=sv-ph><h3>Better placed, this earns more</h3>' + tag("g", pp(lift) + " APR") +
          '<div class=sv-rt><button class="sv-btn go" type=button data-act=opt>Redelegate</button></div></div>' +
          '<div class=sv-figs>' +
            fig("", "APR now", pct(plan.now)) +
            fig("up", "APR after", pct(plan.after)) +
            fig(lift >= 0 ? "up" : "dn", "net lift", pp(lift)) +
            fig("up", "a year", "+" + one(plan.gain) + '<i>ATONE</i>') +
          '</div>' +
          '<div class=sv-note><b>' + fmt(pos.free) + ' ATONE</b> moved onto <b>' + plan.picks.length +
          '</b> validator' + (plan.picks.length === 1 ? "" : "s") + ' in <b>' + plan.moves + '</b> move' + (plan.moves === 1 ? "" : "s") +
          ', all in one signature. Redelegated stake cannot move again for 21 days.</div>';
    }
    box.innerHTML = h;

    /* where the stake sits now */
    var al = E("sv-allocp");
    if(!pos){
      /* no wallet: the section keeps its shape, like the wallet pane in the other view */
      al.hidden = false;
      al.innerHTML = '<div class=sv-ph><h3>Where your stake sits</h3></div>' + skelAlloc();
    }
    else if(!pos.rows.length){ al.hidden = true; }
    else {
      al.hidden = false;
      al.innerHTML = '<div class=sv-ph><h3>Where your stake sits</h3>' +
        tag("q", pos.rows.length + " validator" + (pos.rows.length === 1 ? "" : "s")) +
        '<div class=sv-rt>' + tag("g", "APR " + pct(pos.rate)) + '</div></div>' + allocation(pos);
    }

    /* the line under it: autopilot, freshness, the two plain controls */
    var at = window.__atInfo ? window.__atInfo() : null;
    var f = E("sv-foot");
    f.innerHTML = '<span>' + autopilotWord(at) + '</span>' +
      (pos ? '<span class=sv-sep>|</span><span>' + (window.__POSAT ? "read " + ago(window.__POSAT) : "") + '</span>' : "") +
      '<div class=sv-rt>' +
        (pos ? '<button class="sv-btn sml" type=button data-act=refresh>Refresh</button>' : "") +
        '<button class="sv-btn sml" type=button data-route="dashboard/autopilot">Autopilot</button>' +
      '</div>';
  }
  /* Pricing the plan runs the whole optimiser and two quiet redraws of the
     advanced pane, so it is done once per block tick - the only thing that can
     change the answer - and read from cache in between. */
  var PC = { key: null, val: null };
  function planNow(pos){
    if(!pos || !(pos.free > 0) || !window.__optPlan) return null;
    var key = pos.total + "/" + pos.free + "/" + (window.__LIVEH ? window.__LIVEH() : 0);
    if(PC.key !== key){ PC.key = key; PC.val = window.__optPlan(false); }
    return PC.val;
  }
  /* the same shape, waiting for a wallet */
  function skelAlloc(){
    var h = '<div class=sv-bar></div><div class=sv-chips>', i;
    for(i = 0; i < 5; i++) h += '<div class="sv-chip skel"><span class=sv-dot></span><b></b><em></em><s></s><u></u></div>';
    return h + '</div>';
  }
  /* the bar and the chips: the stake as it stands, largest first */
  function allocation(pos){
    var rows = pos.rows.slice().sort(function(a, b){ return b.x - a.x; });
    return '<div class=sv-bar>' + rows.map(function(r){
        return '<i class="' + (r.locked > 0 ? "hld" : "") + '" style="width:' + (r.x / pos.total * 100).toFixed(2) +
               '%;background:hsl(' + hueOf(r.m) + ',48%,52%)" title="' + esc(r.m) + ', ' + fmt(r.x) + ' ATONE"></i>'; }).join("") + '</div>' +
      '<div class=sv-chips>' + rows.map(function(r){
        return '<div class="sv-chip click" data-v="' + esc(r.id) + '" tabindex=0 title="Open this validator">' +
          '<span class=sv-dot style="background:hsl(' + hueOf(r.m) + ',48%,52%)"></span>' +
          '<b>' + esc(r.m) + '</b><em>' + Math.round(r.x / pos.total * 100) + '%</em>' +
          '<s>' + fmt(r.x) + ' ATONE</s><u>' + (r.inactive ? "inactive" : pct(r.rate)) + '</u></div>'; }).join("") + '</div>';
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
    var door = !pos ? "" : '<button class="sv-btn ' + (g ? "" : "pri") + '" type=button data-act=autopilot>' + (g ? "Manage" : "Set up") + '</button>';

    E("sv-atp").innerHTML =
      '<div class=sv-ph><h3>Autopilot</h3>' + state + '<div class=sv-rt>' + door + '</div></div>' +
      '<div class=sv-note>Autopilot is an <b>authz grant</b>: you allow GATA\'s keeper to redelegate <i>your</i> stake between validators <i>you</i> allow, ' +
      'for a period <i>you</i> set. Your stake never leaves your wallet, and you can revoke authz at any time.</div>' +
      '<div class="sv-cards four">' +
        card("Strategy", g ? esc(strategyWord(g)) : "—", g ? allow + " allowed validators" : "chosen when you set it up") +
        card("Stake it may move", g ? esc(a.max_tokens ? fmt(+a.max_tokens.amount) : "no cap") : "—", g ? "the cap you signed" : "a cap you set") +
        card("Runs until", until || "—", g ? "then it lapses on its own" : "3 or 6 months", "sm") +
        card("Your APR", pos && pos.rows.length ? pct(pos.rate) : "—", pos && pos.rows.length ? "on " + whole(pos.total) + " ATONE" : "") +
      '</div>';

    var al = E("sv-atalloc");
    if(pos && pos.rows.length){
      al.hidden = false;
      var rp = at && at.report, last = rp && rp.checked ? window.__dayFull(rp.checked * 1000) : null;
      al.innerHTML = '<div class=sv-ph><h3>' + (g ? "What it manages" : "What it would manage") + '</h3>' +
          tag("q", pos.rows.length + " validator" + (pos.rows.length === 1 ? "" : "s")) +
          '<div class=sv-rt>' + tag(g ? "g" : "q", g ? (last ? "last check " + last : "not checked yet") : "your stake as it stands") + '</div></div>' +
        allocation(pos) +
        (g ? '<div class=sv-note>' + (rp && rp.history && rp.history.length
          ? '<b>' + rp.history.length + '</b> move' + (rp.history.length === 1 ? "" : "s") + ' made, the last on <b>' + window.__dayFull(rp.history[0].at * 1000) + '</b>.'
          : "No move yet. The keeper only moves stake when the gain is worth the 21-day cooldown it costs.") + '</div>' : "");
    } else al.hidden = true;

    E("sv-atauth").innerHTML =
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
      (g ? '<div class=sv-tools><button class="sv-btn red" type=button data-act=autopilot>Revoke authz</button></div>' : "");
  }
  /* the strategy word lives in the grant's memo, which the chain does not keep:
     what stands on chain is the allow-list, so that is what this states */
  function strategyWord(g){
    var a = g && g.authorization || {}, n = ((a.allow_list || {}).address || []).length, V = VALS().length;
    return n >= V ? "Whole set" : n + " of " + V + " validators";
  }

  /* ── NETWORK ────────────────────────────────────────────────────────────── */
  var FILTER = "all", FIND = "";
  function drawNet(){
    var D = DD(), S = setStats(), s = S.set, V = VALS(), mine = window.__MINE || {};
    var e = D.eta || {}, i10 = 0, t10 = 0;
    for(i10 = 0; i10 < 10 && i10 < V.length; i10++) t10 += V[i10][1];
    var top10 = s.bonded ? t10 / s.bonded * 100 : 0;
    var ratio = window.__ratio ? window.__ratio() : NaN;
    E("sv-nethead").innerHTML =
      '<div class=sv-ph><h3>The AtomOne set</h3>' +
        (e.enabled ? tag("a", "Nakamoto bonus active") : tag("q", "bonus off")) +
        (e.week ? tag("q", "week " + e.week) : "") +
        '<div class=sv-rt>' + tag("q", big(s.bonded || 0) + " ATONE staked") +
          tag("q", (s.bonded_pct != null ? s.bonded_pct.toFixed(1) : "—") + "% of supply") +
          tag("q", S.n + " validators") + '</div>' +
      '</div>' +
      '<div class=sv-note>AtomOne shares part of <b>the reward pool, after the community tax,</b> equally between validators and the rest by stake. ' +
      'That is why a smaller validator can pay a higher APR on the same ATONE, and why spreading a stake earns more than concentrating it.</div>';

    E("sv-netcards").innerHTML =
      card("Bonus coefficient", 'η ' + (e.now != null ? e.now.toFixed(2) : "—"),
           e.now != null ? Math.round(e.now * 100) + "% of the reward pool, shared equally" : "") +
      card("APR across the set", pct(S.lo) + '<em>to</em>' + pct(S.hi), "median " + pct(S.mid)) +
      card("Concentration", (isFinite(ratio) ? ratio.toFixed(1) : "—") + '<em>×</em>',
           "largest third against smallest, top ten hold " + top10.toFixed(0) + "%") +
      card("Record", (S.up != null ? S.up.toFixed(2) + "%" : "—"),
           "average 30-day uptime, " + S.clean + " never jailed");

    var segs = [["all", "All " + S.n], ["mine", "My stake"], ["clean", "Never jailed"], ["small", "Below average"]];
    E("sv-segs").innerHTML = segs.map(function(x){
      return '<button class=sv-seg type=button data-f="' + x[0] + '" aria-pressed="' + (FILTER === x[0] ? "true" : "false") + '">' + x[1] + '</button>'; }).join("");

    var mean = (s.bonded || 0) / (S.n || 1), q = FIND.toLowerCase(), rows = [], i;
    for(i = 0; i < V.length; i++){
      var v = V[i], d = (window.__VDBY && window.__VDBY[v[3]]) || {};
      if(FILTER === "mine" && !mine[v[3]]) continue;
      if(FILTER === "clean" && v[4]) continue;
      if(FILTER === "small" && v[1] >= mean) continue;
      if(q && String(v[0]).toLowerCase().indexOf(q) < 0 && String(d.op || "").toLowerCase().indexOf(q) < 0) continue;
      rows.push({ i: i, v: v, d: d });
    }
    var pos = window.__POS, held = {};
    if(pos) pos.rows.forEach(function(r){ held[r.id] = r.x; });
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
        '<td><span class=sv-apr>' + pct(rate0(v[1], v[2])) + '</span></td>' +
        '<td>' + (held[v[3]] ? '<b>' + fmt(held[v[3]]) + '</b>' : '<span class=sv-dim>—</span>') + '</td></tr>';
    });
    E("sv-nettbl").innerHTML = h + '</tbody></table>';
    E("sv-netfoot").innerHTML = '<span>' + rows.length + " of " + S.n + " validators</span>" +
      '<div class=sv-rt>' + (window.__LIVEH && window.__LIVEH() ? "block " + window.__LIVEH().toLocaleString() : "") + '</div>';
  }

  /* ── the head: chain, address, the way out ── */
  var WAS = null;
  function drawHead(){
    var a = window.__ADDR, ac = E("svacct"), cn = E("svconn"), w = window.__WALLET;
    if(a){ ac.hidden = false; if(cn) cn.hidden = true;
           /* the button wears the wallet that is connected, not a generic head */
           var im = ac.querySelector("img"), src = "assets/wallet-" + String((w && w.name) || "keplr").toLowerCase() + ".svg";
           if(im && im.getAttribute("src") !== src) im.setAttribute("src", src);
           ac.title = ((w && w.label) || (w && w.name) || "Wallet") + " \u2014 " + a; }
    else { ac.hidden = true; if(cn) cn.hidden = false; }
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
  function acctMenu(){
    var w = window.__WALLET || {}, a = window.__ADDR || "";
    return '<div class=mh>' + esc(w.label || w.name || "Wallet") + '</div>' +
      '<div class=ma>' + esc(a) + '</div>' +
      '<button class=mi type=button data-act=copy>Copy address</button>' +
      '<button class="mi out" type=button data-act=disconnect>Disconnect</button>';
  }
  var adT;
  /* the menu's own copy: the row says so for a moment, then goes back */
  function copyAddr(row){
    var a = window.__ADDR; if(!a) return;
    var ok = function(){ if(!row) return; var t = row.textContent; row.textContent = "Copied";
      clearTimeout(adT); adT = setTimeout(function(){ row.textContent = t; }, 1200); };
    /* the same fallback the wallet pane uses where the clipboard API is refused */
    var old = function(){ try{ var e = document.createElement("textarea"); e.value = a; e.setAttribute("readonly", "");
      e.style.position = "fixed"; e.style.opacity = "0"; document.body.appendChild(e); e.select();
      document.execCommand("copy"); document.body.removeChild(e); ok(); }catch(err){} };
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(a).then(ok, old);
    else old();
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
    var t = ev.target.closest ? ev.target.closest("[data-w],[data-act]") : null;
    if(!t) return;
    /* the bar answers the click itself, without waiting for the next redraw */
    if(t.dataset.w){ closeMenu(); if(window.__wconnect) window.__wconnect(t.dataset.w); setTimeout(render, 0); return; }
    if(t.dataset.act === "copy"){ copyAddr(t); return; }
    if(t.dataset.act === "disconnect"){ closeMenu(); if(window.__wdisconnect) window.__wdisconnect(); setTimeout(render, 0); }
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
     own route - and calls this to show it: the simple view on one of its screens, or the
     advanced one. th_ui / th_svs keep the choice for a visit that arrives with no route. */
  window.__dashView = function(ui, scr){
    if(ui === "simple"){ root.setAttribute("data-ui", "simple"); if(scr) root.setAttribute("data-svs", scr); }
    else root.removeAttribute("data-ui");
    try{ localStorage.setItem("th_ui", ui === "simple" ? "simple" : "pro"); if(scr) localStorage.setItem("th_svs", scr); }catch(e){}
    render();
  };

  function onClick(ev){
    var t = ev.target.closest ? ev.target.closest("[data-act],[data-w],[data-f],[data-v]") : null;
    if(!t) return;
    if(t.dataset.w){ if(window.__wconnect) window.__wconnect(t.dataset.w); return; }
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
    if(act === "disconnect"){ if(window.__wdisconnect) window.__wdisconnect(); return; }
    if(act === "autopilot"){ var ab = E("atbtn"); if(ab) ab.click(); return; }
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

  var acct = E("svacct");
  if(acct) acct.addEventListener("click", function(ev){ ev.stopPropagation();
    if(menu && !menu.hidden){ closeMenu(); return; } openMenu(acctMenu(), acct); });

  /* every figure follows the dashboard's own redraw, and the height ticks on its own */
  window.addEventListener("thermo:draw", schedule);
  window.addEventListener("thermo:live", schedule);
  setInterval(function(){ if(root.getAttribute("data-ui") === "simple" && screen() === "over") schedule(); }, 15000);
  render();
})();
