/* Autopilot Admin: sign in with Keplr (ADR-36 signArbitrary of a one-time challenge), then the
   decision queue per network. Every Autopilot grant waits for an operator (48 hours): Review shows
   the keeper's plan, and Yes (exactly that plan) or No (you settle it by hand) decides it; nothing
   moves without it. Also the standing grants, holds, ended grants, the validator watch's open
   incidents and the event feed. Every action goes through /admin-api,
   which checks the session and announces it on Discord. */
(function(){
  "use strict";
  var E = function(id){ return document.getElementById(id); };
  var NET = "mainnet", TAB = "waiting", DATA = null;
  var CHAIN = { mainnet: "atomone-1", testnet: "atomone-testnet-1" };
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"]/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function day(t){ return t ? new Date(t * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "N/A"; }
  function ago(t){ if(!t) return "N/A"; var s = Math.round(Date.now() / 1000 - t); return s < 90 ? s + "s ago" : s < 5400 ? Math.round(s / 60) + "m ago" : s < 172800 ? Math.round(s / 3600) + "h ago" : Math.round(s / 86400) + "d ago"; }
  function atone(u){ return u == null ? "no cap" : (u / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 }) + " ATONE"; }
  function short(a){ return a ? a.slice(0, 10) + "…" + a.slice(-6) : ""; }
  function api(path, body){
    return fetch("/admin-api/" + path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" }
                                            : { credentials: "same-origin", cache: "no-store" })
      .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); });
  }

  /* ── sign-in ── */
  function signIn(){
    var err = E("err"); err.textContent = "";
    if(!window.keplr){ err.textContent = "Keplr is not installed in this browser."; return; }
    /* signed on the network the console is switched to: its operators are that network's list */
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

  function start(){
    api("me").then(function(m){
      E("gate").hidden = true; E("app").hidden = false; E("out").hidden = false; E("test").hidden = false;
      E("who").textContent = short(m.address);
      var nets = m.nets || ["mainnet"];
      if(nets.indexOf(NET) < 0) NET = nets[0];
      Array.prototype.forEach.call(document.querySelectorAll("#net button"), function(x){
        x.setAttribute("aria-pressed", x.dataset.net === NET); x.disabled = nets.indexOf(x.dataset.net) < 0;
        x.title = x.disabled ? "This wallet is not an operator on " + x.dataset.net : ""; });
      load(); setInterval(load, 30000);
    }).catch(function(){ E("gate").hidden = false; E("app").hidden = true; });
  }

  /* ── the network switch ── */
  Array.prototype.forEach.call(document.querySelectorAll("#net button"), function(b){
    b.addEventListener("click", function(){ NET = b.dataset.net;
      Array.prototype.forEach.call(document.querySelectorAll("#net button"), function(x){ x.setAttribute("aria-pressed", x === b); });
      load(); });
  });

  function load(){ api("overview?net=" + NET).then(function(d){ DATA = d; draw(); }).catch(function(e){ E("grants").innerHTML = '<div class=empty>' + esc(e.message) + '</div>'; }); }

  /* where each delegator stands with the operators: the keeper writes it into its report (admin block) */
  function stOf(e){ var ad = (e.report || {}).admin; return ["new", "active", "expiring"].indexOf(e.status) < 0 ? "ended" : ad ? ad.state : "planning"; }
  var GROUPS = { waiting: ["waiting", "planning"], live: ["managed", "approved", "waiting", "planning", "held"], held: ["held"], ended: ["ended"] };
  var OPEN = {};
  function left(ad){ if(!ad || !ad.deadline) return null; return ad.deadline - Date.now() / 1000; }
  function dur(s){ s = Math.abs(s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h >= 24 ? Math.floor(h / 24) + "d " + (h % 24) + "h" : h + "h " + m + "m"; }
  function clock(ad){ var l = left(ad); if(l == null) return '<span class=sub>N/A</span>';
    return l <= 0 ? '<b class=over>overdue ' + dur(l) + '</b>' : '<b class="' + (l < 3 * 3600 ? 'late' : l < 12 * 3600 ? 'soon' : 'ok') + '">' + dur(l) + ' left</b>'; }
  function vn(op){ var n = (DATA.names || {})[op]; return esc(n || short(op)); }
  function pct(r){ return r == null ? "N/A" : (r * 100).toFixed(1) + "%"; }
  function planLine(r){ var mv = r.moves || [];
    return mv.length ? mv.length + ' move' + (mv.length === 1 ? '' : 's') + ', +' + (r.gain || 0).toFixed(1) + ' ATONE a year<div class=sub>APR ' + pct(r.now) + ' to ' + pct(r.after) + '</div>'
                     : 'no move<div class=sub>the stake already sits well</div>'; }
  var SLAB = { waiting: "waiting", planning: "planning", managed: "managed", approved: "approved", held: "held", ended: "ended" };
  function review(e){
    var r = e.report || {}, ad = r.admin || {}, g = e.grant || {}, mv = r.moves || [], st = stOf(e);
    var can = st !== "ended";
    var h = '<div class=rv>';
    h += '<div class=rvg><div><em>Staked</em><b>' + atone(r.staked) + '</b></div><div><em>Moves</em><b>' + mv.length + '</b></div>' +
         '<div><em>Validators</em><b>' + ((g.allow || []).length ? (g.allow || []).length + ' allowed' : 'the rule') + '</b></div><div><em>Restake</em><b>' + (g.restake ? "on" : "off") + '</b></div>' +
         '<div><em>Grant made</em><b>' + day(ad.made || e.made) + '</b></div><div><em>Plan</em><b class=mono>' + esc(ad.plan_id || "none") + '</b></div></div>';
    h += mv.length ? '<table class=plan><thead><tr><th>From</th><th>To</th><th class=r>ATONE</th><th class=r>Gain a year</th></tr></thead><tbody>' + mv.map(function(m){
        return '<tr><td>' + vn(m.src) + '</td><td>' + vn(m.dst) + '</td><td class="n r">' + (m.uatone / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 }) + '</td><td class="n r">+' + (m.gain || 0).toFixed(2) + '</td></tr>'; }).join("") +
        '</tbody></table><div class=sub>Blended APR ' + pct(r.now) + ' now, ' + pct(r.after) + ' after. ' + (r.dry === false ? 'Yes signs these moves; No moves nothing and you settle it by hand.' : 'Dry run: Yes records them and signs nothing.') + '</div>'
      : '<div class=empty>Nothing to move now' + (r.checked ? ' (checked ' + ago(r.checked) + ')' : '') + ': the stake is cooling down or already in place. No clears it.</div>';
    if(ad.applied) h += '<div class=sub>Last applied ' + ago(ad.applied.at) + (ad.applied.by ? ' by ' + esc(short(ad.applied.by)) : '') + (ad.applied.dry ? ', dry run' : ad.applied.ok ? ', tx ' + esc((ad.applied.txhash || "").slice(0, 12)) : ', FAILED: ' + esc(ad.applied.error || "")) + '</div>';
    var decs = (ad.decisions || []).slice().reverse();
    if(decs.length) h += '<div class=hist>' + decs.map(function(d){ return '<div><b>' + esc(d.action) + '</b> ' + esc(short(d.by)) + ' <span class=sub>' + ago(d.at) + '</span>' + (d.note ? '<div class=sub>' + esc(d.note) + '</div>' : '') + '</div>'; }).join("") + '</div>';
    if(can) h += '<div class=acts>' +
      (st === "held" ? '<button class="btn pri" type=button data-do=resume data-g="' + esc(e.granter) + '">Resume</button>'
        : (mv.length ? '<button class="btn pri" type=button data-do=apply data-g="' + esc(e.granter) + '" data-pid="' + esc(ad.plan_id || "") + '"' + (st === "approved" ? ' disabled' : '') + '>' + (st === "approved" ? 'Yes, carrying out' : 'Yes') + '</button>' : '') +
          '<button class=btn type=button data-do=nomove data-g="' + esc(e.granter) + '">No</button>') + '</div>';
    return h + '</div>';
  }
  function draw(){
    var L = DATA.ledger || {}, G = L.grants || {}, c = L.counts || {}, k = DATA.keeper || {};
    var all = Object.keys(G).map(function(g){ return G[g]; });
    var by = function(s){ return all.filter(function(e){ return stOf(e) === s; }); };
    var wait = by("waiting").concat(by("planning")), over = wait.filter(function(e){ var l = left((e.report || {}).admin); return l != null && l <= 0; });
    var soonest = wait.map(function(e){ return left((e.report || {}).admin); }).filter(function(x){ return x != null; }).sort(function(a, b){ return a - b; })[0];
    function ro(label, v, meta, col, cls){ return '<div class=ro style="--rc:' + col + '"><em>' + label + '</em><b' + (cls ? ' class=' + cls : '') + '>' + v + '</b><small>' + (meta || "&nbsp;") + '</small></div>'; }
    E("strip").innerHTML =
      ro("Autopilot address", L.grantee ? short(L.grantee) : "N/A", L.grantee ? (k.dry === false ? "live" : "dry run") : "not set yet", "var(--violet)", "addrv") +
      ro("Waiting", wait.length, soonest != null ? (soonest <= 0 ? "one is overdue" : "next due in " + dur(soonest)) : "nothing to decide", "var(--amber)") +
      ro("Overdue", over.length, "48 hours passed", "var(--red)") +
      ro("Managed", by("managed").length + by("approved").length, "decided, the keeper follows", "var(--green)") +
      ro("On hold", by("held").length, "clock and keeper stopped", "var(--f)") +
      ro("Restake", Object.keys(L.restake || {}).length, "wallets restaking, no admin step", "var(--teal)") +
      ro("Signer PHOTON", k.photon != null ? (k.photon / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "N/A", "pays every fee", "var(--teal)");
    E("checked").textContent = L.checked ? "ledger checked " + ago(L.checked) : "";
    E("tabs").innerHTML = [["waiting", "Waiting"], ["live", "Standing"], ["held", "On hold"], ["ended", "Ended"]].map(function(t){
      var cnt = all.filter(function(e){ return GROUPS[t[0]].indexOf(stOf(e)) >= 0; }).length;
      return '<button class=tab type=button data-tab=' + t[0] + ' aria-pressed=' + (TAB === t[0]) + '>' + t[1] + '<i>' + cnt + '</i></button>'; }).join("");
    var rows = all.filter(function(e){ return GROUPS[TAB].indexOf(stOf(e)) >= 0; })
      .sort(TAB === "waiting" ? function(a, b){ return (left((a.report || {}).admin) || 9e9) - (left((b.report || {}).admin) || 9e9); }
                              : function(a, b){ return (b.first_seen || 0) - (a.first_seen || 0); });
    if(!L.grantee) E("grants").innerHTML = '<div class=empty>No Autopilot address on ' + NET + ' yet: grants start arriving once the signer is installed and its address is set.</div>';
    else if(!rows.length) E("grants").innerHTML = '<div class=empty>' + (TAB === "waiting" ? 'Nothing waits for a decision.' : 'None.') + '</div>';
    else E("grants").innerHTML = '<table><thead><tr><th>Delegator</th><th>State</th><th>' + (TAB === "waiting" ? 'Time left' : 'Grant') + '</th><th>Plan</th><th></th></tr></thead><tbody>' + rows.map(function(e){
      var g = e.grant || {}, r = e.report || {}, ad = r.admin || {}, st = stOf(e), open = !!OPEN[e.granter];
      return '<tr class="' + (open ? 'open' : '') + '"><td><div class=addr>' + esc(short(e.granter)) + '</div>' +
          '<div class=sub>granted ' + day(e.made || e.first_seen) + (ad.reason === "new plan" ? ', new plan' : '') + '</div>' +
          (e.notes && e.notes.length ? '<div class=notes>' + e.notes.slice(-2).map(function(x){ return '<div>' + esc(x.text) + ' <span class=sub>' + ago(x.at) + '</span></div>'; }).join("") + '</div>' : '') + '</td>' +
        '<td><span class="pill st-' + st + '">' + (SLAB[st] || st) + '</span>' + (st === "ended" ? '<div class=sub>' + esc(e.status) + ' ' + day(e.ended) + '</div>' : '') + '</td>' +
        '<td class=n>' + (TAB === "waiting" ? clock(ad) : atone(g.cap) + '<div class=sub>' + (g.allow || []).length + ' validators' + (g.restake ? ', restake' : '') + '</div>') + '</td>' +
        '<td class=n>' + (st === "planning" ? '<span class=sub>the keeper plans within a minute</span>' : planLine(r)) + '</td>' +
        '<td><button class="btn sm" type=button data-open="' + esc(e.granter) + '">' + (open ? 'Close' : 'Review') + '</button></td></tr>' +
        (open ? '<tr class=rvrow><td colspan=5>' + review(e) + '</td></tr>' : ''); }).join("") + '</tbody></table>';
    var vw = DATA.valwatch || {}, inc = (vw.incidents || []).filter(function(i){ return i.down || i.crit || i.jailed || i.tomb; });
    E("vwsub").textContent = vw.checked ? vw.active + " active, checked " + ago(vw.checked) : "N/A";
    E("vw").innerHTML = inc.length ? '<div class=ev>' + inc.map(function(i){
      var what = i.tomb ? "tombstoned" : i.jailed ? "jailed" : i.crit ? "critical: half the window missed" : "down since " + ago(i.down.since_t);
      return '<div><i class="' + (i.down && !i.crit && !i.jailed ? "warn" : "crit") + '"></i><span>' + esc(i.cons.slice(-10)) + '<small>' + esc(what) + '</small></span></div>'; }).join("") + '</div>'
      : '<div class=empty>No validator is down, critical or freshly jailed.</div>';
    var ev = (L.events || []).slice(-60).reverse();
    E("ev").innerHTML = ev.length ? ev.map(function(x){ return '<div><i class="' + esc(x.level) + '"></i><span>' + esc(x.title) + '<small>' + (x.delegator ? esc(short(x.delegator)) + ", " : "") + ago(x.at) + '</small></span></div>'; }).join("")
      : '<div class=empty>No grant events yet.</div>';
  }
  function decide(t, action, note){
    t.disabled = true;
    api("decide", { net: NET, granter: t.dataset.g, action: action, plan_id: t.dataset.pid || null, note: note || "" })
      .then(load).catch(function(e){ alert(e.message); t.disabled = false; });
  }
  document.addEventListener("click", function(ev){
    var t = ev.target.closest ? ev.target.closest("[data-tab],[data-open],[data-do],[data-note]") : null; if(!t) return;
    if(t.dataset.tab){ TAB = t.dataset.tab; draw(); return; }
    if(t.dataset.open){ OPEN[t.dataset.open] = !OPEN[t.dataset.open]; draw(); return; }
    if(t.dataset.do === "apply"){ if(confirm("Yes for " + t.dataset.g + "?\nThe keeper makes exactly these moves within a minute.")) decide(t, "apply"); return; }
    if(t.dataset.do === "nomove"){ if(confirm("No for " + t.dataset.g + "?\nNothing moves; you settle it by hand.")) decide(t, "nomove"); return; }
    if(t.dataset.do === "hold"){ var w = prompt("Why hold " + t.dataset.g + "? (the note goes to Discord)"); if(w && w.trim()) decide(t, "hold", w.trim()); return; }
    if(t.dataset.do === "resume"){ decide(t, "resume"); return; }
    if(t.dataset.note){ var s = prompt("Note for " + t.dataset.note); if(s && s.trim()) api("note", { net: NET, granter: t.dataset.note, text: s.trim() }).then(load).catch(function(e){ alert(e.message); }); }
  });
  start();
})();
