/* Autopilot Admin: sign in with Keplr (ADR-36 signArbitrary of a one-time challenge), then the
   grants ledger per network - new, active, expiring, ended - with pause/resume and notes, the
   validator watch's open incidents and the event feed. Every action goes through /admin-api,
   which checks the session and announces it on Discord. */
(function(){
  "use strict";
  var E = function(id){ return document.getElementById(id); };
  var NET = "mainnet", TAB = "live", DATA = null;
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
    var chain = CHAIN.mainnet, addr, text;
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

  var GROUPS = { live: ["new", "active", "expiring"], new: ["new"], expiring: ["expiring"], ended: ["expired", "revoked", "used up"] };
  function draw(){
    var L = DATA.ledger || {}, G = L.grants || {}, c = L.counts || {}, k = DATA.keeper || {};
    var n = function(s){ return c[s] || 0; };
    function ro(label, v, meta, col){ return '<div class=ro style="--rc:' + col + '"><em>' + label + '</em><b>' + v + '</b><small>' + (meta || "&nbsp;") + '</small></div>'; }
    E("strip").innerHTML =
      ro("Autopilot address", L.grantee ? short(L.grantee) : "N/A", L.grantee ? (k.dry === false ? "live" : "dry run") : "not set yet", "var(--violet)") +
      ro("New", n("new"), "first 24 hours", "var(--teal)") +
      ro("Active", n("active"), "settled", "var(--green)") +
      ro("Expiring", n("expiring"), "within 7 days", "var(--amber)") +
      ro("Ended", n("expired") + n("revoked") + n("used up"), n("revoked") + " revoked, " + n("used up") + " used up", "var(--f)") +
      ro("Paused", DATA.admin.pauses, "skipped by the keeper", "var(--amber)") +
      ro("Signer PHOTON", k.photon != null ? (k.photon / 1e6).toLocaleString(undefined, { maximumFractionDigits: 1 }) : "N/A", "pays every fee", "var(--teal)");
    E("checked").textContent = L.checked ? "ledger checked " + ago(L.checked) : "";
    E("tabs").innerHTML = [["live", "Standing"], ["new", "New"], ["expiring", "Expiring"], ["ended", "Ended"]].map(function(t){
      var cnt = GROUPS[t[0]].reduce(function(a, s){ return a + n(s); }, 0);
      return '<button class=tab type=button data-tab=' + t[0] + ' aria-pressed=' + (TAB === t[0]) + '>' + t[1] + '<i>' + cnt + '</i></button>'; }).join("");
    var rows = Object.keys(G).map(function(g){ return G[g]; }).filter(function(e){ return GROUPS[TAB].indexOf(e.status) >= 0; })
      .sort(function(a, b){ return (b.first_seen || 0) - (a.first_seen || 0); });
    if(!L.grantee) E("grants").innerHTML = '<div class=empty>No Autopilot address on ' + NET + ' yet: grants start arriving once the signer is installed and its address is set.</div>';
    else if(!rows.length) E("grants").innerHTML = '<div class=empty>None.</div>';
    else E("grants").innerHTML = '<table><thead><tr><th>Delegator</th><th>State</th><th>Terms</th><th>Autopilot</th><th></th></tr></thead><tbody>' + rows.map(function(e){
      var g = e.grant || {}, r = e.report || {}, rec = r.record, rs = r.restake || {};
      var st = e.status === "used up" ? "used" : e.status;
      return '<tr><td><div class=addr>' + esc(short(e.granter)) + (e.paused ? '<span class=paused>PAUSED</span>' : '') + '</div>' +
          '<div class=sub>since ' + day(e.made || e.first_seen) + ', ' + esc(e.strategy || "N/A") + '</div>' +
          (e.notes && e.notes.length ? '<div class=notes>' + e.notes.slice(-3).map(function(x){ return '<div>' + esc(x.text) + ' <span class=sub>' + ago(x.at) + '</span></div>'; }).join("") + '</div>' : '') + '</td>' +
        '<td><span class="pill st-' + st + '">' + esc(e.status) + '</span>' + (e.ended ? '<div class=sub>' + day(e.ended) + '</div>' : '') + '</td>' +
        '<td class=n>' + atone(g.cap) + '<div class=sub>' + (g.allow || []).length + ' validators, until ' + day(g.exp) + (g.restake ? ', restake' : '') + '</div></td>' +
        '<td class=n>' + (r.checked ? ago(r.checked) : "N/A") + '<div class=sub>' + ((r.history || []).length) + ' moves' + (rs.count ? ', ' + rs.count + ' restakes' : '') +
          (rec && rec.start ? ', ' + ((rec.rate - rec.start.rate) * 100 >= 0 ? "+" : "") + ((rec.rate - rec.start.rate) * 100).toFixed(1) + '% APR' : '') + '</div></td>' +
        '<td><div class=acts>' + (["new", "active", "expiring"].indexOf(e.status) >= 0
          ? '<button class="btn sm" type=button data-pause="' + esc(e.granter) + '" data-p=' + (e.paused ? 0 : 1) + '>' + (e.paused ? "Resume" : "Pause") + '</button>' : '') +
          '<button class="btn sm" type=button data-note="' + esc(e.granter) + '">Note</button></div></td></tr>'; }).join("") + '</tbody></table>';
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
  document.addEventListener("click", function(ev){
    var t = ev.target.closest ? ev.target.closest("[data-tab],[data-pause],[data-note]") : null; if(!t) return;
    if(t.dataset.tab){ TAB = t.dataset.tab; draw(); return; }
    if(t.dataset.pause){ t.disabled = true; api("pause", { net: NET, granter: t.dataset.pause, paused: t.dataset.p === "1" }).then(load).catch(function(e){ alert(e.message); t.disabled = false; }); return; }
    if(t.dataset.note){ var s = prompt("Note for " + t.dataset.note); if(s && s.trim()) api("note", { net: NET, granter: t.dataset.note, text: s.trim() }).then(load).catch(function(e){ alert(e.message); }); }
  });
  start();
})();
