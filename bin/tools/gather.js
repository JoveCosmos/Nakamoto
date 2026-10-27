/* gather (operator, 2026-10-27): every delegation the wallet has, moved to ONE validator, GATA HUB, by redelegation.
   No choice of destination by design. The chain's own rules decide what can move today: stake that arrived on a
   validator by redelegation cannot be redelegated again until that entry matures (21 days), and one source may hold
   at most 7 unmatured redelegations to the same destination. Those parts are listed with their date, not offered.
   The moves are split into transactions of at most CHUNK messages, each signed in turn. */
(function(){
"use strict";
var T = window.T, E = T.E, esc = T.esc, CHUNK = 8, MAXENT = 7, MIN = 1000;   /* under 0.001 ATONE: dust the chain rounds to nothing ("too few tokens to redelegate", seen at 1 uatone) */
/* GATA HUB's operator address on each network, checked against our own nodes' consensus keys on 2026-10-27; never
   looked up by moniker, which anyone can copy */
var GATA = T.CHAIN === "atomone-1" ? "atonevaloper10unx6s0cdqntvrumd5hs07rgd5ytcztq7w6s7f" : "atonevaloper18rw0prhskw38kt99ypae4ka46k9js58uuwlg93";
var ROWS = [], ON = {}, HELD = 0, APR = {}, PILOT = false, BUSY = false, FEE = { n: 0, t: 0, u: 0 }, stg, PK = [];

function load(){
  var w = T.wallet(); if(!w) return;
  var a = w.address; ROWS = []; ON = {}; HELD = 0; E("stgtag").textContent = "reading your stake"; draw();
  Promise.all([
    T.get("/cosmos/staking/v1beta1/delegations/" + a + "?pagination.limit=500"),
    T.get("/cosmos/staking/v1beta1/delegators/" + a + "/redelegations?pagination.limit=500").catch(function(){ return {}; }),
    T.names,
    fetch(T.BASE + "data.json", { cache: "no-store" }).then(function(x){ return x.json(); }).catch(function(){ return {}; }),
    T.get("/cosmos/authz/v1beta1/grants/granter/" + a + "?pagination.limit=200").catch(function(){ return {}; })
  ]).then(function(r){
    if(!T.wallet() || T.wallet().address !== a) return;
    APR = {}; ((r[3] && r[3].validators) || []).forEach(function(v){ if(v.op) APR[v.op] = v.net; });
    /* Autopilot is on when this wallet granted our account the right to delegate or redelegate for it */
    var ours = T.ours(); PILOT = !!ours && ((r[4] && r[4].grants) || []).some(function(g){
      if(g.grantee !== ours || (g.expiration && new Date(g.expiration).getTime() < Date.now())) return false;
      var au = g.authorization || {}; return /StakeAuthorization/.test(au["@type"] || "") || /MsgBeginRedelegate|MsgDelegate/.test(au.msg || ""); });
    var now = Date.now(), lockOn = {}, lockTill = {}, toGata = {}, toGataTill = {};
    ((r[1] && r[1].redelegation_responses) || []).forEach(function(x){
      var src = x.redelegation.validator_src_address, dst = x.redelegation.validator_dst_address;
      (x.entries || []).forEach(function(e){
        var till = new Date(e.redelegation_entry.completion_time).getTime(); if(till <= now) return;
        lockOn[dst] = (lockOn[dst] || 0) + parseInt(e.balance, 10); lockTill[dst] = Math.max(lockTill[dst] || 0, till);
        if(dst === GATA){ toGata[src] = (toGata[src] || 0) + 1; toGataTill[src] = Math.min(toGataTill[src] || Infinity, till); } });
    });
    ((r[0] && r[0].delegation_responses) || []).forEach(function(d){
      var v = d.delegation.validator_address, x = parseInt(d.balance.amount, 10); if(!(x >= 1)) return;
      if(v === GATA){ HELD += x; return; }
      var locked = Math.min(x, lockOn[v] || 0), free = x - locked, full = (toGata[v] || 0) >= MAXENT;
      ROWS.push({ v: v, n: T.nameOf(v).n, x: x, free: full ? 0 : free, locked: full ? x : locked,
                  till: full ? toGataTill[v] : lockTill[v], why: full ? "max" : (locked ? "lock" : "") });
    });
    ROWS.sort(function(p, q){ return q.free - p.free; });
    ROWS.forEach(function(r){ if(r.free >= MIN) ON[r.v] = 1; });
    draw(); state();
  }).catch(function(e){ E("stgtag").textContent = "could not read your stake"; E("fee").innerHTML = '<span class=bad>' + esc(String(e && e.message || e).slice(0, 120)) + '</span>'; });
}
function day(t){ return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
function draw(){
  E("rows").innerHTML = ROWS.map(function(r, i){
    var can = r.free >= MIN, note = r.why === "max" ? "7 moves to GATA HUB already, free " + day(r.till)
      : r.locked >= 1 ? T.fmtA(r.locked) + " held until " + day(r.till) : !can ? "too small to move" : "";
    return '<label class="row' + (ON[r.v] ? ' on' : '') + '" style="animation-delay:' + Math.min(i, 8) * 40 + 'ms">' +
      '<input type=checkbox data-v="' + esc(r.v) + '"' + (ON[r.v] ? ' checked' : '') + (can ? '' : ' disabled') + ' aria-label="' + esc(r.n) + '">' +
      '<span class=who><b>' + esc(r.n) + '</b><small>' + esc(T.short(r.v)) + '</small></span>' +
      '<span class=what><b>' + T.fmtA(r.free) + ' ATONE</b>' + (note ? '<span class="pill w">' + esc(note) + '</span>' : '') + '</span></label>';
  }).join("") || '<div class=row ro><span class=who><b>' + (HELD ? "Everything is already on GATA HUB" : "No stake to gather") + '</b><small>' +
    (HELD ? T.fmtA(HELD) + " ATONE" : "this wallet has no delegations") + '</small></span><span></span></div>';
}
function picked(){ return ROWS.filter(function(r){ return ON[r.v] && r.free >= MIN; }); }
function msgs(list){ var me = T.wallet().address; return list.map(function(r){
  return { type: "cosmos-sdk/MsgBeginRedelegate", value: { delegator_address: me, validator_src_address: r.v, validator_dst_address: GATA,
           amount: { denom: "uatone", amount: String(r.free) } } }; }); }
function chunks(m){ var o = []; for(var i = 0; i < m.length; i += CHUNK) o.push(m.slice(i, i + CHUNK)); return o; }
function state(){
  var p = picked(), tot = p.reduce(function(s, r){ return s + r.free; }, 0), n = p.length, k = chunks(p).length;
  E("hv").textContent = n; E("ha").textContent = T.fmtA(tot, 1); E("hg").textContent = T.fmtA(HELD, 1);
  E("hero").classList.toggle("idle", !n);
  var held = ROWS.filter(function(r){ return r.locked >= 1; }).length;
  E("selnote").textContent = ROWS.length ? n + " of " + ROWS.length + " selected" + (held ? ", " + held + " partly held by the chain" : "") : "";
  E("stgtag").textContent = n ? "to GATA HUB" : (HELD ? "on GATA HUB" : "nothing to gather");
  E("go").disabled = !n || BUSY; E("go").textContent = !n ? "Gather" : k > 1 ? "Gather, " + k + " signatures" : "Gather";
  PK = p.map(function(r){ return r.free; }); notes(p); fee(n ? p : null);
}
/* what the move does, before signing: the stake's rate now and after, the 21-day hold it starts, and Autopilot */
function notes(p){
  var h = "";
  if(p.length){
    var all = ROWS.reduce(function(s, r){ return s + r.x; }, 0) + HELD, yNow = HELD * (APR[GATA] || 0), yAfter;
    ROWS.forEach(function(r){ yNow += r.x * (APR[r.v] || 0); });
    yAfter = yNow; p.forEach(function(r){ yAfter += r.free * ((APR[GATA] || 0) - (APR[r.v] || 0)); });
    if(all > 0 && APR[GATA] != null){
      var a0 = yNow / all * 100, a1 = yAfter / all * 100, d = (yAfter - yNow) / 1e6;
      h += '<p' + (d < 0 ? ' class=w' : '') + '>Your staking APR goes from <b>' + a0.toFixed(1) + '%</b> to <b>' + a1.toFixed(1) + '%</b>, ' +
        (d < 0 ? '<b>' + T.fmtA(-d * 1e6, 1) + ' ATONE a year less</b>' : '<b>' + T.fmtA(d * 1e6, 1) + ' ATONE a year more</b>') + '.</p>';
    }
    h += '<p>Moved stake is held on GATA HUB for <b>21 days</b>, until <b>' + day(Date.now() + 21 * 864e5) + '</b>: it keeps earning, but cannot be moved to another validator before then. You can still unstake it.</p>';
  }
  if(PILOT) h += '<p class=w><b>Autopilot is on for this wallet.</b> It will spread this stake across validators again at its next run. Turn Autopilot off in <a href="' + T.BASE + '">Nakamoto</a> first to keep everything on GATA HUB.</p>';
  E("notes").innerHTML = h;
}
/* the fee: each transaction simulated at the chain's price, summed */
function fee(p){
  var k = ++FEE.n; clearTimeout(FEE.t);
  if(!p){ E("fee").textContent = " "; return; }
  E("fee").textContent = "fee: pricing…";
  FEE.t = setTimeout(function(){
    var parts = chunks(msgs(p)), u = 0, gas = 0;
    parts.reduce(function(pr, m){ return pr.then(function(){ return T.feePreview(m).then(function(f){ u += parseInt(f.fee.amount[0].amount, 10); gas += f.fee.gas; }); }); }, Promise.resolve())
      .then(function(){ if(k !== FEE.n) return; FEE.u = u;
        E("fee").innerHTML = 'fee ≈ <span class=ok>' + T.fmtP(u) + ' PHOTON</span>, gas ' + gas.toLocaleString("en-US") ;
        window.__TX.balances(T.wallet().address).then(function(b){ if(k === FEE.n && b.uphoton < u){ E("fee").innerHTML += ' <span class=bad>not enough PHOTON for the fee</span>'; E("go").disabled = true; } }).catch(function(){}); })
      .catch(function(e){ if(k !== FEE.n) return; E("fee").innerHTML = '<span class=bad>' + esc(String(e && e.message || e).replace(/^The chain refused this transaction: /, "").slice(0, 110)) + '</span>'; });
  }, 350);
}
E("rows").addEventListener("change", function(ev){ var v = ev.target.dataset.v; if(!v) return; if(ev.target.checked) ON[v] = 1; else delete ON[v];
  ev.target.closest(".row").classList.toggle("on", ev.target.checked); state(); });
E("selall").addEventListener("click", function(){ ROWS.forEach(function(r){ if(r.free >= MIN) ON[r.v] = 1; }); draw(); state(); });
E("selnone").addEventListener("click", function(){ ON = {}; draw(); state(); });
E("go").addEventListener("click", function(){
  var p = picked(); if(!p.length || BUSY) return; BUSY = true; E("go").disabled = true;
  var parts = chunks(msgs(p)), hashes = [], i = 0;
  (function next(){
    if(i >= parts.length) return Promise.resolve();
    var m = parts[i];
    return T.sign(m, "", function(t){ E("step").textContent = (parts.length > 1 ? "transaction " + (i + 1) + " of " + parts.length + ": " : "") + t; })
      .then(function(r){ hashes.push(r.hash); i++; return next(); });
  })().then(function(){
    var moved = p.reduce(function(s, r){ return s + r.free; }, 0);
    E("tool").hidden = true; E("done").hidden = false;
    E("donen").textContent = "Gathered " + T.fmtA(moved, 1) + " ATONE";
    E("donetx").textContent = "from " + p.length + (p.length === 1 ? " validator" : " validators") + " to GATA HUB" + (hashes.length > 1 ? ", " + hashes.length + " transactions" : "");
    E("donelink").href = "https://explorer.gatahub.zone/" + T.CHAIN + "/txs/" + hashes[hashes.length - 1]; stg.stop();
  }).catch(function(e){
    E("step").textContent = " ";
    E("fee").innerHTML = '<span class=bad>' + (hashes.length ? hashes.length + " of " + parts.length + " transactions went through. " : "") + esc(String(e && e.message || e).slice(0, 120)) + '</span>';
    if(hashes.length) load();
  }).then(function(){ BUSY = false; if(!E("tool").hidden) state(); });
});
E("again").addEventListener("click", function(){ E("done").hidden = true; E("tool").hidden = false; stg.start(); load(); });
/* the picture: each source on the left, its stake flowing into one validator on the right */
stg = T.stage(E("cv"), function(c, w, h, t){
  var teal = T.tok("--teal"), vio = T.tok("--violet2"), bar = T.tok("--bar"), dot = T.tok("--dot"), x1 = w * .84, y1 = h / 2, n = PK.length, max = Math.max.apply(null, PK.concat([1]));
  if(!n){ for(var k = 0; k < 3; k++){ var rr = (t * 40 + k * 30) % 90; c.globalAlpha = 1 - rr / 90; c.strokeStyle = teal; c.beginPath(); c.arc(x1, y1, 8 + rr, 0, 7); c.stroke(); } c.globalAlpha = 1; }
  for(var i = 0; i < n; i++){ var x0 = w * .16, y0 = n === 1 ? h / 2 : h * (.24 + .64 * i / (n - 1)), r = 3 + 5 * Math.sqrt(PK[i] / max);
    c.strokeStyle = bar; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y0); c.bezierCurveTo(w * .5, y0, w * .5, y1, x1, y1); c.stroke();
    var q = (t * .45 + i * .37) % 1, px = x0 + (x1 - x0) * q, py = y0 + (y1 - y0) * (3 * q * q - 2 * q * q * q);
    c.fillStyle = i % 2 ? vio : teal; c.beginPath(); c.arc(px, py, r, 0, 7); c.fill();
    c.fillStyle = bar; c.beginPath(); c.arc(x0, y0, 5, 0, 7); c.fill(); }
  c.fillStyle = dot; c.beginPath(); c.arc(x1, y1, 9, 0, 7); c.fill(); c.strokeStyle = teal; c.lineWidth = 2; c.beginPath(); c.arc(x1, y1, 14, 0, 7); c.stroke();
});
window.addEventListener("tools:theme", function(){ stg.redraw(); });
T.drawGate(E("gatebox"));
T.onWallet(function(w){ E("gate").hidden = !!w; E("tool").hidden = !w; E("done").hidden = true; if(w){ stg.start(); load(); } else stg.stop(); });
})();
