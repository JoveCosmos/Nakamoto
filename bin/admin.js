/* Autopilot admin: sign in with Keplr (ADR-36 signArbitrary of a one-time challenge), then a view per network.
   Autopilot and Restake run by themselves at 00:00 and 12:00 UTC. Each wallet is Running, Cooling down (its stake is
   in the chain's 21-day redelegation lock, back to Running when it clears), Disabled (an operator stopped Autopilot
   and Restake for it; Enable undoes it) or Ended (revoked, used up, expired). Every action goes through /admin-api,
   which checks the session and announces it. */
(function(){
  "use strict";
  var E = function(id){ return document.getElementById(id); };
  var NET = "mainnet", TAB = "run", DATA = null, TIMER = null;
  var CHAIN = { mainnet: "atomone-1", testnet: "atomone-testnet-1" };
  var LOCK = 21 * 86400;
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function day(t){ return t ? new Date(t * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "-"; }
  function when(t){ if(!t) return "-"; var d = new Date(t * 1000), n = new Date();
    return d.toDateString() === n.toDateString() ? "today" : d.toDateString() === new Date(n - 864e5).toDateString() ? "yesterday" : day(t); }
  function dur(s){ s = Math.max(0, s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? h + "h " + m + "m" : m + "m"; }
  function nextSlot(){ return (Math.floor(Date.now() / 43200000) + 1) * 43200; }
  function atone(u){ return u == null ? "-" : (u / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 }); }
  function short(a){ return a ? a.slice(0, 10) + "…" + a.slice(-6) : ""; }
  function vn(op){ var n = (DATA.names || {})[op]; return esc(n || short(op)); }
  function api(path, body){
    return fetch("/admin-api/" + path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" }
                                            : { credentials: "same-origin", cache: "no-store" })
      .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); });
  }

  /* ── sign-in, on the network the console is switched to (its operators are that network's list) ── */
  E("signin").addEventListener("click", function(){
    var err = E("err"); err.textContent = "";
    if(!window.keplr){ err.textContent = "Keplr is not installed in this browser."; return; }
    var chain = CHAIN[NET], addr, text;
    window.keplr.enable(chain).then(function(){ return window.keplr.getKey(chain); })
      .then(function(k){ addr = k.bech32Address; return api("challenge"); })
      .then(function(c){ text = c.text; return window.keplr.signArbitrary(chain, addr, text); })
      .then(function(s){ return api("login", { address: addr, pubkey: s.pub_key.value, signature: s.signature, text: text }); })
      .then(start)
      .catch(function(e){ err.textContent = e && e.message ? e.message : String(e); });
  });
  E("out").addEventListener("click", function(){ api("logout", {}).then(function(){ location.reload(); }); });
  function start(){
    api("me").then(function(m){
      E("gate").hidden = true; E("app").hidden = false; E("out").hidden = false; E("who").hidden = false;
      E("who").textContent = short(m.address);
      var nets = m.nets || ["mainnet"];
      if(nets.indexOf(NET) < 0) NET = nets[0];
      Array.prototype.forEach.call(document.querySelectorAll("#net button"), function(x){
        x.setAttribute("aria-pressed", x.dataset.net === NET); x.disabled = nets.indexOf(x.dataset.net) < 0;
        x.title = x.disabled ? "This wallet is not an operator on " + x.dataset.net : ""; });
      load(); if(!TIMER) TIMER = setInterval(load, 30000);
    }).catch(function(){ E("gate").hidden = false; E("app").hidden = true; });
  }
  Array.prototype.forEach.call(document.querySelectorAll("#net button"), function(b){
    b.addEventListener("click", function(){ if(b.disabled) return; NET = b.dataset.net;
      Array.prototype.forEach.call(document.querySelectorAll("#net button"), function(x){ x.setAttribute("aria-pressed", x === b); });
      if(!E("app").hidden) load(); });
  });
  function load(){ api("overview?net=" + NET).then(function(d){ DATA = d; draw(); }).catch(function(e){ E("rows").innerHTML = '<div class=empty>' + esc(e.message) + '</div>'; }); }

  /* ── where each wallet stands ── */
  /* the lock the keeper read at its last plan; before it records one, a move of ours in the last 21 days that left
     under 1 ATONE free */
  function cooling(e){
    var r = e.report || {}, now = Date.now() / 1000;
    if(r.until != null) return r.until > now && (r.staked || 0) - (r.locked || 0) < 1e6 ? r.until : 0;
    var h = (r.history || [])[0]; if(!h || h.at + LOCK <= now) return 0;
    var moved = (r.history || []).filter(function(x){ return x.at + LOCK > now; }).reduce(function(s, x){ return s + (x.uatone || 0); }, 0);
    return (r.staked || 0) - moved < 1e6 ? h.at + LOCK : 0;
  }
  function stOf(e){
    if(["new", "active", "expiring"].indexOf(e.status) < 0) return "ended";
    if(e.paused) return "off";
    return cooling(e) ? "cool" : "run";
  }
  var TABS = [["run", "Running"], ["cool", "Cooling down"], ["off", "Disabled"], ["ended", "Ended"]];
  var ENDED = { "used up": "Used up", revoked: "Revoked", expired: "Expired" };

  function row(e){
    var r = e.report || {}, st = stOf(e), h = (r.history || [])[0];
    var how = st === "cool" ? '<span class=cool>Cooling down until ' + day(cooling(e)) + ', back to Running then</span>'
      : st === "off" ? '<span>Disabled, Autopilot and Restake stopped</span>'
      : st === "ended" ? '<span>' + esc(ENDED[e.status] || e.status || "Ended") + ' ' + day(e.ended) + '</span>'
      : '<span>Next run in ' + dur(nextSlot() - Date.now() / 1000) + (h ? ', last moved to ' + vn(h.dst) : '') + '</span>';
    var act = st === "ended" ? '' : st === "off"
      ? '<button class="btn go" type=button data-do=resume data-g="' + esc(e.granter) + '">Enable</button>'
      : '<button class=btn type=button data-do=hold data-g="' + esc(e.granter) + '">Disable</button>';
    return '<div class=row>' +
      '<span class=who2 title="' + esc(e.granter) + '">' + esc(short(e.granter)) + '<small>granted ' + day(e.made || e.first_seen) + '</small></span>' +
      '<div class=what><b>' + atone(r.staked) + ' ATONE staked</b>' + how + '</div>' +
      '<span class="gain' + (h ? '' : ' dim') + '">' + (h ? '+' + (h.gain || 0).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' a year' : 'no move yet') + '</span>' +
      '<span class="when' + (h ? '' : ' dim') + '">' + (h && h.txhash ? '<a href="https://explorer.gatahub.zone/' + CHAIN[NET] + '/txs/' + esc(String(h.txhash).toUpperCase()) + '" target=_blank rel=noopener title="the move on the explorer">moved ' + when(h.at) + '</a>' : h ? 'moved ' + when(h.at) : '-') + '</span>' +
      '<div class=act>' + act + '</div></div>';
  }

  function draw(){
    if(!DATA) return;
    var L = DATA.ledger || {}, k = DATA.keeper || {}, G = L.grants || {};
    var all = Object.keys(G).map(function(g){ return G[g]; });
    var cnt = {}; all.forEach(function(e){ var s = stOf(e); cnt[s] = (cnt[s] || 0) + 1; });
    var ph = k.photon != null ? k.photon / 1e6 : null;
    E("tiles").innerHTML =
      '<div class="tile run"><em>Running</em><b>' + (cnt.run || 0) + '</b><small>' + (L.restake ? Object.keys(L.restake).length + ' with Restake' : '&nbsp;') + '</small></div>' +
      '<div class="tile cool"><em>Cooling down</em><b>' + (cnt.cool || 0) + '</b><small>21 days after a move</small></div>' +
      '<div class=tile><em>Disabled</em><b>' + (cnt.off || 0) + '</b><small>' + (cnt.ended || 0) + ' ended</small></div>' +
      '<div class="tile' + (ph != null && ph < 15 ? ' low' : '') + '"><em>Signer PHOTON</em><b>' + (ph == null ? '-' : ph.toLocaleString("en-US", { maximumFractionDigits: 1 })) + '</b><small>' +
        (!L.grantee ? 'not set' : k.dry === false ? 'live, ' + short(L.grantee) : 'dry run, ' + short(L.grantee)) + '</small></div>';
    E("when").textContent = "Runs at 00:00 and 12:00 UTC, next in " + dur(nextSlot() - Date.now() / 1000);
    E("tabs").innerHTML = TABS.map(function(t){
      return '<button type=button role=tab data-tab=' + t[0] + ' aria-selected=' + (TAB === t[0]) + '>' + t[1] + '<i>' + (cnt[t[0]] || 0) + '</i></button>'; }).join("");
    var rows = all.filter(function(e){ return stOf(e) === TAB; }).sort(function(a, b){ return ((b.report || {}).staked || 0) - ((a.report || {}).staked || 0); });
    E("rows").innerHTML = !L.grantee ? '<div class=empty>No Autopilot address on ' + NET + ' yet.</div>'
      : rows.length ? rows.map(row).join("") : '<div class=empty>None.</div>';

    var vw = DATA.valwatch || {}, inc = (vw.incidents || []).filter(function(i){ return i.down || i.crit || i.jailed || i.tomb; });
    E("vwsub").textContent = vw.checked ? vw.active + " active" : "";
    E("vw").innerHTML = inc.length ? inc.map(function(i){
      var what = i.tomb ? ["Tombstoned", "crit"] : i.jailed ? ["Jailed", "crit"] : i.crit ? ["Critical", "crit"] : ["Down", "warn"];
      var since = i.down && i.down.since_t ? 'down since ' + when(i.down.since_t) : i.jailed ? 'jailed ' + when(i.jailed) : '';
      return '<div class=row><div class=what><b>' + esc(i.name || short(i.cons)) + '</b><span>' + esc(since) + '</span></div><span class="tag ' + what[1] + '">' + what[0] + '</span></div>'; }).join("")
      : '<div class=empty>No validator is down, critical or jailed.</div>';
  }

  document.addEventListener("click", function(ev){
    var t = ev.target.closest ? ev.target.closest("[data-tab],[data-do]") : null; if(!t) return;
    if(t.dataset.tab){ TAB = t.dataset.tab; draw(); return; }
    if(t.dataset.do === "hold" && !confirm("Disable " + t.dataset.g + "?\nAutopilot and Restake stop for this address until it is enabled.")) return;
    t.disabled = true;
    api("decide", { net: NET, granter: t.dataset.g, action: t.dataset.do }).then(load).catch(function(e){ alert(e.message); t.disabled = false; });
  });
  start();
})();
