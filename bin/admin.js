/* AtomOne Admin: sign in with Keplr (ADR-36 signArbitrary of a one-time challenge), then a monitor per network.
   Autopilot runs by itself every 12 hours (no approval, since 2026-09-30); the console shows the signer, every
   wallet with its last move, next check and Restake, and the watch feeds. Hold is the emergency stop (a reason is
   required, it goes to Discord), Resume undoes it, notes are kept per wallet. Every action goes through /admin-api,
   which checks the session and announces it. */
(function(){
  "use strict";
  var E = function(id){ return document.getElementById(id); };
  var NET = "mainnet", TAB = "live", DATA = null, OPEN = {}, DRAFT = {};
  var CHAIN = { mainnet: "atomone-1", testnet: "atomone-testnet-1" };
  var TXURL = "https://explorer.gatahub.zone/";
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function day(t){ return t ? new Date(t * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "-"; }
  function dur(s){ s = Math.abs(s); var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return d ? d + "d " + h + "h" : h ? h + "h " + m + "m" : m + "m"; }
  function ago(t){ if(!t) return "-"; var s = Date.now() / 1000 - t; return s < 90 ? Math.round(s) + "s ago" : dur(s) + " ago"; }
  /* Autopilot and Restake run at 00:00 and 12:00 UTC */
  function nextSlot(){ return (Math.floor(Date.now() / 43200000) + 1) * 43200; }
  function until(t){ if(!t) return "-"; var s = t - Date.now() / 1000; return s <= 60 ? "due now" : "in " + dur(s); }
  function atone(u, d){ return u == null ? "-" : (u / 1e6).toLocaleString("en-US", { maximumFractionDigits: d == null ? 1 : d }); }
  function pct(r){ return r == null ? "-" : (r * 100).toFixed(1) + "%"; }
  function short(a){ return a ? a.slice(0, 10) + "…" + a.slice(-6) : ""; }
  function txa(h){ return h ? '<a class=tx href="' + TXURL + CHAIN[NET] + '/txs/' + esc(String(h).toUpperCase()) + '" target=_blank rel=noopener>' + esc(String(h).slice(0, 8).toUpperCase()) + '…</a>' : '<span class=dim>-</span>'; }
  function vn(op){ var n = (DATA.names || {})[op]; return esc(n || short(op)); }
  function api(path, body){
    return fetch("/admin-api/" + path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" }
                                            : { credentials: "same-origin", cache: "no-store" })
      .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); });
  }

  /* ── sign-in, on the network the console is switched to (its operators are that network's list) ── */
  function signIn(){
    var err = E("err"); err.textContent = "";
    if(!window.keplr){ err.textContent = "Keplr is not installed in this browser."; return; }
    var chain = CHAIN[NET], addr, text;
    window.keplr.enable(chain).then(function(){ return window.keplr.getKey(chain); })
      .then(function(k){ addr = k.bech32Address; return api("challenge"); })
      .then(function(c){ text = c.text; return window.keplr.signArbitrary(chain, addr, text); })
      .then(function(s){ return api("login", { address: addr, pubkey: s.pub_key.value, signature: s.signature, text: text }); })
      .then(function(){ start(); })
      .catch(function(e){ err.textContent = e && e.message ? e.message : String(e); });
  }
  E("signin").addEventListener("click", signIn);
  E("out").addEventListener("click", function(){ api("logout", {}).then(function(){ location.reload(); }); });
  E("test").addEventListener("click", function(){ var b = E("test"); b.disabled = true;
    api("test-alert", { net: NET }).then(function(r){ b.textContent = r.sent ? "Sent" : "Not sent"; }).catch(function(e){ b.textContent = e.message; })
      .then(function(){ setTimeout(function(){ b.disabled = false; b.textContent = "Send test alert"; }, 2500); }); });

  var TIMER = null;
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
    b.addEventListener("click", function(){ if(b.disabled) return; NET = b.dataset.net; OPEN = {};
      Array.prototype.forEach.call(document.querySelectorAll("#net button"), function(x){ x.setAttribute("aria-pressed", x === b); });
      if(E("app").hidden){ return; } load(); });
  });
  function load(){ api("overview?net=" + NET).then(function(d){ DATA = d; draw(); }).catch(function(e){ E("grants").innerHTML = '<div class=empty>' + esc(e.message) + '</div>'; }); }

  /* ── where each wallet stands ── */
  function stOf(e){ return ["new", "active", "expiring"].indexOf(e.status) < 0 ? "ended" : e.paused || ((e.report || {}).admin || {}).state === "held" ? "held" : "live"; }
  var TABS = [["live", "Running"], ["held", "On hold"], ["ended", "Ended"]];
  function tagOf(st, e){ return st === "live" ? '<span class="tag on">Active</span>' : st === "held" ? '<span class="tag hold">On hold</span>'
    : '<span class=tag>' + esc(e.status === "used up" ? "Used up" : e.status === "revoked" ? "Revoked" : e.status === "expired" ? "Expired" : e.status || "Ended") + '</span>'; }

  function signer(){
    var L = DATA.ledger || {}, k = DATA.keeper || {}, all = rowsAll();
    var n = function(s){ return all.filter(function(e){ return stOf(e) === s; }).length; };
    var ph = k.photon != null ? k.photon / 1e6 : null, low = ph != null && ph < 15;
    E("mode").innerHTML = !L.grantee ? '<span class=tag>Not set</span>' : k.dry === false ? '<span class="tag on">Live</span>' : '<span class="tag hold">Dry run</span>';
    E("signer").innerHTML = !L.grantee ? '<div class=empty>No Autopilot address on ' + NET + ' yet.</div>' :
      '<div class=big><span class=eb>Signs as</span><span class=addr title="' + esc(L.grantee) + '">' + esc(short(L.grantee)) + '</span></div>' +
      '<div class=rows>' +
        '<div class="sr' + (low ? ' low' : '') + '"><span>PHOTON' + (low ? ', low' : '') + '</span><b>' + (ph == null ? '-' : ph.toLocaleString("en-US", { maximumFractionDigits: 2 })) + '</b><i>fees</i></div>' +
        '<div class=sr><span>Runs at</span><b>00:00, 12:00</b><i>UTC</i></div>' +
        '<div class=sr><span>Next run</span><b>' + until(nextSlot()) + '</b><i></i></div>' +
        '<div class=sr><span>Last check</span><b>' + ago(k.checked) + '</b><i></i></div>' +
        '<div class=sr><span>Grants on chain</span><b>' + (k.grants != null ? k.grants : '-') + '</b><i></i></div>' +
      '</div>' +
      '<div class=cnt style="margin-top:14px">' +
        '<div class=on><em>Running</em><b>' + n("live") + '</b></div>' +
        '<div class=hold><em>On hold</em><b>' + n("held") + '</b></div>' +
        '<div><em>Ended</em><b>' + n("ended") + '</b></div>' +
        '<div class=on><em>Restake</em><b>' + Object.keys(L.restake || {}).length + '</b></div>' +
      '</div>';
  }
  function rowsAll(){ var G = (DATA.ledger || {}).grants || {}; return Object.keys(G).map(function(g){ return G[g]; }); }

  function detail(e){
    var r = e.report || {}, g = e.grant || {}, st = stOf(e), mv = r.moves || [], hist = r.history || [], rs = r.restake || {};
    var old = g.cap != null || (g.allow || []).length;
    var h = '<div class=dg><div class=col style="gap:12px">';
    /* what the keeper found last time, and what it did */
    h += '<div class=box><span class=eb>Last plan, ' + ago(r.checked) + '</span>' + (mv.length
      ? '<table><thead><tr><th>From</th><th>To</th><th class=r>ATONE</th><th class=r>Gain a year</th></tr></thead><tbody>' + mv.map(function(m){
          return '<tr><td>' + vn(m.src) + '</td><td>' + vn(m.dst) + '</td><td class="n r">' + atone(m.uatone) + '</td><td class="n r">+' + (m.gain || 0).toFixed(1) + '</td></tr>'; }).join("") +
        '</tbody></table><span class=sub>APR ' + pct(r.now) + ' to ' + pct(r.after) + (r.dry === false ? ', carried out in the same run' : ', dry run: recorded, not signed') + '</span>'
      : '<div class=empty>No move: the stake is cooling down, or no move earns it more than 5 APR points.</div>') + '</div>';
    h += '<div class=box><span class=eb>Moves made</span>' + (hist.length
      ? '<table><thead><tr><th>When</th><th>From</th><th>To</th><th class=r>ATONE</th><th class=r>Tx</th></tr></thead><tbody>' + hist.map(function(m){
          return '<tr><td class=n>' + ago(m.at) + '</td><td>' + vn(m.src) + '</td><td>' + vn(m.dst) + '</td><td class="n r">' + atone(m.uatone) + '</td><td class=r>' + txa(m.txhash) + '</td></tr>'; }).join("") + '</tbody></table>'
      : '<div class=empty>None yet.</div>') + '</div>';
    h += '</div><div class=col style="gap:12px">';
    h += '<div class=box><span class=eb>Wallet</span><div class=kv>' +
      '<span>Address</span><b title="' + esc(e.granter) + '">' + esc(short(e.granter)) + '</b>' +
      '<span>Granted</span><b>' + day(e.made || e.first_seen) + '</b>' +
      (e.tx ? '<span>Grant tx</span><b>' + txa(e.tx) + '</b>' : '') +
      '<span>Staked</span><b>' + atone(r.staked) + ' ATONE</b>' +
      '<span>APR now</span><b>' + pct((r.record || {}).rate != null ? r.record.rate : r.now) + '</b>' +
      (st === "ended" ? '<span>Ended</span><b>' + day(e.ended) + '</b>' : '<span>Next check</span><b>' + (st === "held" ? 'on hold' : until(nextSlot())) + '</b>') +
      (old ? '<span>Old grant</span><b>' + (g.cap != null ? 'cap ' + atone(g.cap) + ' ATONE' : '') + ((g.allow || []).length ? (g.cap != null ? ', ' : '') + g.allow.length + ' validators' : '') + '</b>' : '') +
      '</div></div>';
    h += '<div class=box><span class=eb>Restake</span><div class=kv>' +
      '<span>State</span><b>' + ((DATA.ledger.restake || {})[e.granter] ? 'Active' : 'Inactive') + '</b>' +
      (rs.last_at ? '<span>Last restake</span><b>' + ago(rs.last_at) + '</b>' : '') +
      (rs.count ? '<span>Restakes</span><b>' + rs.count + ', ' + atone(rs.total, 2) + ' ATONE</b>' : '') +
      (rs.rewards != null ? '<span>Rewards now</span><b>' + atone(rs.rewards, 3) + ' ATONE</b>' : '') +
      '</div></div>';
    if(st !== "ended"){
      var d = DRAFT[e.granter] || "";
      h += '<div class=box><span class=eb>' + (st === "held" ? 'On hold' : 'Emergency stop') + '</span>' +
        (st === "held" ? '<div class=act><button class="btn go sm" type=button data-do=resume data-g="' + esc(e.granter) + '">Resume</button></div>'
          : '<div class=act><input data-draft="' + esc(e.granter) + '" placeholder="Reason, sent to Discord" value="' + esc(d) + '"><button class="btn warn sm" type=button data-do=hold data-g="' + esc(e.granter) + '">Hold</button></div>') +
        '<div class=act><input data-ndraft="' + esc(e.granter) + '" placeholder="Add a note" value="' + esc(DRAFT["n:" + e.granter] || "") + '"><button class="btn sm" type=button data-do=note data-g="' + esc(e.granter) + '">Add</button></div>' +
        ((e.notes || []).length ? '<div class=notes>' + e.notes.slice(-4).reverse().map(function(x){ return '<div>' + esc(x.text) + ' <span class=dim>' + ago(x.at) + '</span></div>'; }).join("") + '</div>' : '') +
        '</div>';
    }
    return h + '</div></div>';
  }

  function draw(){
    if(!DATA) return;
    var L = DATA.ledger || {}, k = DATA.keeper || {}, all = rowsAll();
    signer();
    E("checked").textContent = L.checked ? "checked " + ago(L.checked) : "";
    E("tabs").innerHTML = TABS.map(function(t){
      var n = all.filter(function(e){ return stOf(e) === t[0]; }).length;
      return '<button type=button role=tab data-tab=' + t[0] + ' aria-selected=' + (TAB === t[0]) + '>' + t[1] + '<i>' + n + '</i></button>'; }).join("");
    /* someone typing in an opened wallet: leave the list as it is until they are done */
    var foc = document.activeElement, typing = foc && foc.tagName === "INPUT" && E("grants").contains(foc);
    var rows = typing ? [] : all.filter(function(e){ return stOf(e) === TAB; }).sort(function(a, b){ return ((b.report || {}).staked || 0) - ((a.report || {}).staked || 0) || (b.first_seen || 0) - (a.first_seen || 0); });
    if(typing){}
    else if(!L.grantee) E("grants").innerHTML = '<div class=empty>No Autopilot address on ' + NET + ' yet: grants arrive once the signer is installed.</div>';
    else if(!rows.length) E("grants").innerHTML = '<div class=empty>None.</div>';
    else E("grants").innerHTML = '<table><thead><tr><th>Wallet</th><th class=r>Staked</th><th class=r>APR</th><th>Last move</th><th class=hide-s>' + (TAB === "ended" ? 'Ended' : 'Next check') + '</th><th class=hide-s>Restake</th><th class=r>State</th></tr></thead><tbody>' + rows.map(function(e){
      var r = e.report || {}, st = stOf(e), last = (r.history || [])[0], open = !!OPEN[e.granter];
      var nxt = st === "ended" ? day(e.ended) : st === "held" ? '<span class=dim>on hold</span>' : until(nextSlot());
      return '<tr class="row' + (open ? ' open' : '') + '" data-open="' + esc(e.granter) + '" tabindex=0 aria-expanded=' + open + '>' +
        '<td><span class=addr>' + esc(short(e.granter)) + '</span><span class=sub>granted ' + day(e.made || e.first_seen) + '</span></td>' +
        '<td class="n r">' + atone(r.staked) + '</td>' +
        '<td class="n r">' + pct((r.record || {}).rate != null ? r.record.rate : r.now) + '</td>' +
        '<td>' + (last ? txa(last.txhash) + '<span class=sub>' + atone(last.uatone) + ' ATONE, ' + ago(last.at) + '</span>' : '<span class=dim>None yet</span>') + '</td>' +
        '<td class="n hide-s">' + nxt + '</td>' +
        '<td class=hide-s>' + ((L.restake || {})[e.granter] ? '<span class="tag on">Active</span>' : '<span class=tag>Inactive</span>') + '</td>' +
        '<td class=r>' + tagOf(st, e) + '</td></tr>' +
        (open ? '<tr class=det><td colspan=7>' + detail(e) + '</td></tr>' : ''); }).join("") + '</tbody></table>';

    var vw = DATA.valwatch || {}, inc = (vw.incidents || []).filter(function(i){ return i.down || i.crit || i.jailed || i.tomb; });
    E("vwsub").textContent = vw.checked ? vw.active + " active, checked " + ago(vw.checked) : "";
    E("vw").innerHTML = inc.length ? inc.map(function(i){
      var what = i.tomb ? "tombstoned" : i.jailed ? "jailed" : i.crit ? "critical: half the window missed" : "down since " + ago(i.down.since_t);
      return '<div><i class="' + (i.down && !i.crit && !i.jailed ? "warn" : "crit") + '"></i><span>' + esc(i.cons.slice(-10)) + '<small>' + esc(what) + '</small></span></div>'; }).join("")
      : '<div class=empty>No validator is down, critical or freshly jailed.</div>';
    var ev = (L.events || []).slice(-60).reverse();
    E("ev").innerHTML = ev.length ? ev.map(function(x){ return '<div><i class="' + esc(x.level) + '"></i><span>' + esc(x.title) + '<small>' + ago(x.at) + '</small></span></div>'; }).join("")
      : '<div class=empty>No events yet.</div>';
  }

  function decide(t, action, note){
    t.disabled = true;
    api("decide", { net: NET, granter: t.dataset.g, action: action, note: note || "" })
      .then(function(){ DRAFT[t.dataset.g] = ""; load(); }).catch(function(e){ alert(e.message); t.disabled = false; });
  }
  /* what is typed survives the 30-second refresh */
  document.addEventListener("input", function(ev){ var t = ev.target;
    if(t.dataset.draft) DRAFT[t.dataset.draft] = t.value; if(t.dataset.ndraft) DRAFT["n:" + t.dataset.ndraft] = t.value; });
  document.addEventListener("click", function(ev){
    var t = ev.target.closest ? ev.target.closest("[data-tab],[data-do],[data-open]") : null; if(!t) return;
    if(t.dataset.tab){ TAB = t.dataset.tab; draw(); return; }
    if(t.dataset.do === "hold"){ var w = (DRAFT[t.dataset.g] || "").trim(); if(!w){ var inp = document.querySelector('[data-draft="' + t.dataset.g + '"]'); if(inp){ inp.focus(); inp.placeholder = "A reason is needed to hold"; } return; }
      decide(t, "hold", w); return; }
    if(t.dataset.do === "resume"){ decide(t, "resume"); return; }
    if(t.dataset.do === "note"){ var s = (DRAFT["n:" + t.dataset.g] || "").trim(); if(!s) return; t.disabled = true;
      api("note", { net: NET, granter: t.dataset.g, text: s }).then(function(){ DRAFT["n:" + t.dataset.g] = ""; load(); }).catch(function(e){ alert(e.message); t.disabled = false; }); return; }
    if(t.dataset.open && !(ev.target.closest && ev.target.closest("a"))){ OPEN[t.dataset.open] = !OPEN[t.dataset.open]; draw(); }
  });
  document.addEventListener("keydown", function(ev){ var t = ev.target;
    if((ev.key === "Enter" || ev.key === " ") && t.dataset && t.dataset.open && t.tagName === "TR"){ ev.preventDefault(); OPEN[t.dataset.open] = !OPEN[t.dataset.open]; draw(); } });
  start();
})();
