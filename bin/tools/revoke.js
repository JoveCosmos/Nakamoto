/* the revoke scanner: every grant the wallet gave (authz/grants/granter), drawn as it loads, any selection revoked in
   one signature (N MsgRevoke); a Ledger takes at most PAGE per signature, so a larger selection goes in rounds */
(function(){
"use strict";
var T = window.T, E = T.E, esc = T.esc, PAGE = 15;
var G = [], R = [], SEL = {}, stg = null, LIVE = [], FEE = { n: 0, t: 0 }, BUSY = false;
var KIND = { "/cosmos.staking.v1beta1.MsgBeginRedelegate": "redelegate", "/cosmos.staking.v1beta1.MsgDelegate": "delegate", "/cosmos.staking.v1beta1.MsgUndelegate": "undelegate",
  "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward": "claim rewards", "/cosmos.bank.v1beta1.MsgSend": "SEND", "/cosmos.gov.v1beta1.MsgVote": "vote", "/atomone.gov.v1.MsgVote": "vote",
  "/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission": "commission", "/cosmos.staking.v1beta1.MsgCancelUnbondingDelegation": "cancel unbonding" };
function kind(g){ var a = g.authorization || {}, t = a["@type"] || "";
  if(/StakeAuthorization/.test(t)) return { "AUTHORIZATION_TYPE_REDELEGATE": "redelegate", "AUTHORIZATION_TYPE_DELEGATE": "delegate", "AUTHORIZATION_TYPE_UNDELEGATE": "undelegate" }[a.authorization_type] || "stake";
  if(/SendAuthorization/.test(t)) return "SEND";
  var m = a.msg || ""; return KIND[m] || m.split(".").pop().replace(/^Msg/, "").toLowerCase() || "generic"; }
function url(g){ var a = g.authorization || {}, t = a["@type"] || "";
  if(/StakeAuthorization/.test(t)) return { "AUTHORIZATION_TYPE_REDELEGATE": "/cosmos.staking.v1beta1.MsgBeginRedelegate", "AUTHORIZATION_TYPE_DELEGATE": "/cosmos.staking.v1beta1.MsgDelegate",
    "AUTHORIZATION_TYPE_UNDELEGATE": "/cosmos.staking.v1beta1.MsgUndelegate", "AUTHORIZATION_TYPE_CANCEL_UNBONDING_DELEGATION": "/cosmos.staking.v1beta1.MsgCancelUnbondingDelegation" }[a.authorization_type];
  if(/SendAuthorization/.test(t)) return "/cosmos.bank.v1beta1.MsgSend";
  return a.msg; }
function expiry(g){ if(!g.expiration) return "no expiry"; var d = new Date(g.expiration), ms = d - Date.now();
  if(ms < 0) return "expired"; var days = Math.round(ms / 864e5); return days > 400 ? d.getFullYear() + "" : days + " d"; }
function all(path){ var out = [];
  function page(key){ return T.get(path + "?pagination.limit=100" + (key ? "&pagination.key=" + encodeURIComponent(key) : "")).then(function(d){
    out = out.concat(d.grants || []); var nk = d.pagination && d.pagination.next_key; return nk && out.length < 2000 ? page(nk) : out; }); }
  return page(null); }
function scan(w){
  G = []; R = []; SEL = {}; E("rows").innerHTML = ""; E("rrows").innerHTML = ""; E("stgtag").textContent = "scanning"; E("hero").classList.add("idle"); draw();
  Promise.all([T.names, all("/cosmos/authz/v1beta1/grants/granter/" + w.address), all("/cosmos/authz/v1beta1/grants/grantee/" + w.address).catch(function(){ return []; })])
    .then(function(x){ if(!T.wallet() || T.wallet().address !== w.address) return;
      G = x[1].map(function(g, i){ var n = T.nameOf(g.grantee), k = kind(g); return { i: i, grantee: g.grantee, who: n.kind, kind: k, url: url(g), exp: expiry(g), expired: expiry(g) === "expired",
          name: n.kind === "ours" ? (k === "redelegate" ? "Nakamoto Autopilot" : "Nakamoto Restake") : n.n }; })
        .filter(function(g){ return g.url; });
      R = x[2].map(function(g){ var n = T.nameOf(g.granter); return { granter: g.granter, name: n.n, who: n.kind, kind: kind(g), exp: expiry(g) }; });
      G.forEach(function(g){ SEL[g.i] = g.who === "unknown" || g.expired || g.kind === "SEND"; });   /* the ones to look at first come ticked */
      LIVE = G.map(function(g, k){ return { g: g, born: performance.now() + k * 90 }; });
      E("stgtag").textContent = G.length ? G.length + " grants" : "no grants";
      E("hero").classList.remove("idle"); rows(); hero(); })
    .catch(function(e){ E("stgtag").textContent = "could not read grants"; E("fee").textContent = String(e && e.message || e).slice(0, 80); });
}
function rows(){
  E("rows").innerHTML = G.length ? G.map(function(g, k){ return '<label class="row' + (SEL[g.i] ? ' on' : '') + '" style="animation-delay:' + (k * 60) + 'ms"><input type=checkbox data-i=' + g.i + (SEL[g.i] ? ' checked' : '') + ' aria-label="' + esc(g.name) + ' ' + esc(g.kind) + '">' +
    '<span class=who><b>' + esc(g.name) + (g.who === "ours" ? '' : g.who === "unknown" ? ' <span class="pill w">unknown</span>' : ' <span class=pill>validator</span>') + '</b><small>' + esc(g.grantee) + '</small></span>' +
    '<span class=what><span class="pill ' + (g.kind === "SEND" ? 'r' : g.kind === "redelegate" || g.kind === "delegate" ? 't' : 'v') + '">' + esc(g.kind) + '</span><span>' + esc(g.exp) + '</span></span></label>'; }).join("")
    : '<div class=empty>no permissions given</div>';
  E("rrows").innerHTML = R.length ? R.map(function(g, k){ return '<div class="row ro" style="animation-delay:' + (k * 60) + 'ms"><span class=who><b>' + esc(g.name) + '</b><small>' + esc(g.granter) + '</small></span><span class=what><span class="pill v">' + esc(g.kind) + '</span><span>' + esc(g.exp) + '</span></span></div>'; }).join("")
    : '<div class=empty>none</div>';
}
function hero(){
  var n = G.length, s = G.filter(function(g){ return SEL[g.i]; }).length, u = G.filter(function(g){ return g.who === "unknown"; }).length;
  E("hn").textContent = n; E("hs").textContent = s; E("hu").textContent = u;
  E("selnote").textContent = s > PAGE ? Math.ceil(s / PAGE) + " signatures (" + PAGE + " each)" : s ? "one signature" : " ";
  E("go").disabled = !s || BUSY; E("go").textContent = s ? "Revoke " + s : "Revoke";
  E("selall").disabled = !n || s === n; E("selnone").disabled = !s;
  fee();
}
function fee(){
  var s = G.filter(function(g){ return SEL[g.i]; }), n = ++FEE.n; clearTimeout(FEE.t);
  if(!s.length){ E("fee").textContent = " "; return; }
  E("fee").textContent = "fee: pricing…";
  FEE.t = setTimeout(function(){ T.feePreview(msgs(s.slice(0, PAGE))).then(function(f){ if(n !== FEE.n) return;
      E("fee").innerHTML = 'fee ≈ <span class=ok>' + T.fmtP(parseInt(f.fee.amount[0].amount, 10)) + ' PHOTON</span>' + (s.length > PAGE ? ' per signature' : '') + ', gas ' + f.fee.gas.toLocaleString("en-US"); })
    .catch(function(e){ if(n !== FEE.n) return; E("fee").innerHTML = '<span class=bad>' + esc(String(e && e.message || e).replace(/^The chain refused this transaction: /, "").slice(0, 90)) + '</span>'; }); }, 350);
}
function msgs(list){ var a = T.wallet().address; return list.map(function(g){ return { type: "cosmos-sdk/MsgRevoke", value: { granter: a, grantee: g.grantee, msg_type_url: g.url } }; }); }
E("rows").addEventListener("change", function(ev){ var c = ev.target; if(!c.matches("input[data-i]")) return; SEL[+c.dataset.i] = c.checked; c.closest(".row").classList.toggle("on", c.checked); hero(); });
E("selall").addEventListener("click", function(){ G.forEach(function(g){ SEL[g.i] = true; }); rows(); hero(); });
E("selnone").addEventListener("click", function(){ G.forEach(function(g){ SEL[g.i] = false; }); rows(); hero(); });
E("go").addEventListener("click", function(){
  var s = G.filter(function(g){ return SEL[g.i]; }); if(!s.length || BUSY) return;
  BUSY = true; E("go").disabled = true; var done = [], hashes = [];
  (function round(){
    var batch = s.slice(done.length, done.length + PAGE), k = Math.floor(done.length / PAGE) + 1, of = Math.ceil(s.length / PAGE);
    return T.sign(msgs(batch), "", function(t){ E("step").textContent = (of > 1 ? k + "/" + of + " " : "") + t; }).then(function(r){
      hashes.push(r.hash); batch.forEach(function(g){ done.push(g); var i = LIVE.findIndex(function(x){ return x.g === g; }); if(i >= 0) LIVE[i].gone = performance.now(); });
      if(done.length < s.length) return round(); });
  })().then(function(){
    E("tool").hidden = true; E("done").hidden = false; E("donen").textContent = done.length + " revoked"; E("donetx").textContent = hashes.length > 1 ? hashes.length + " transactions" : "";
    E("donelink").href = "https://explorer.gatahub.zone/" + T.CHAIN + "/txs/" + hashes[hashes.length - 1]; stg.stop();
  }).catch(function(e){ E("step").textContent = " "; E("fee").innerHTML = '<span class=bad>' + esc(String(e && e.message || e).slice(0, 120)) + '</span>'; })
  .then(function(){ BUSY = false; hero(); });
});
E("again").addEventListener("click", function(){ E("done").hidden = true; E("tool").hidden = false; stg.start(); scan(T.wallet()); });
/* the picture: the wallet in the centre, each grantee a node on a ring, ticked ones in red, revoked ones fading out */
function draw(){}
stg = T.stage(E("cv"), function(c, w, h, t){
  var teal = T.tok("--teal"), red = T.tok("--red"), vio = T.tok("--violet"), bar = T.tok("--bar"), dot = T.tok("--dot"), cx = w / 2, cy = h / 2, now = performance.now();
  c.strokeStyle = bar; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, Math.min(w, h) * .36, 0, 7); c.stroke();
  if(!LIVE.length){ for(var k = 0; k < 3; k++){ var rr = (t * 40 + k * 30) % 90; c.globalAlpha = 1 - rr / 90; c.beginPath(); c.arc(cx, cy, 8 + rr, 0, 7); c.strokeStyle = teal; c.stroke(); } c.globalAlpha = 1; }
  var n = LIVE.length, R0 = Math.min(w, h) * (w > 460 ? .36 : .3);
  LIVE.forEach(function(x, i){ var age = (now - x.born) / 600; if(age < 0) return; var ease = Math.min(1, age), e2 = 1 - Math.pow(1 - ease, 3);
    var ang = -Math.PI / 2 + i * Math.PI * 2 / Math.max(1, n) + Math.sin(t * .6 + i) * .03, r = R0 * e2, gone = x.gone ? Math.min(1, (now - x.gone) / 500) : 0;
    var px = cx + Math.cos(ang) * (r + gone * 60), py = cy + Math.sin(ang) * (r + gone * 60), on = SEL[x.g.i];
    c.globalAlpha = (1 - gone) * e2; c.strokeStyle = on ? red : x.g.who === "ours" ? teal : vio; c.lineWidth = on ? 1.6 : 1; c.beginPath(); c.moveTo(cx, cy); c.lineTo(px, py); c.stroke();
    c.fillStyle = on ? red : x.g.who === "unknown" ? T.tok("--amber") : x.g.who === "ours" ? teal : vio; c.beginPath(); c.arc(px, py, on ? 6 : 4.5, 0, 7); c.fill();
    if(on){ c.globalAlpha *= .35 + .3 * Math.sin(t * 4 + i); c.beginPath(); c.arc(px, py, 11, 0, 7); c.strokeStyle = red; c.stroke(); }
    /* the label, kept inside the picture: the name and kind where there is room, the kind alone on a phone */
    if(n <= 12){ var lab = w > 460 ? (x.g.name.length > 18 ? x.g.name.slice(0, 17) + "\u2026" : x.g.name) + " " + x.g.kind : x.g.kind;
      c.globalAlpha = (1 - gone) * e2; c.fillStyle = T.tok("--wf"); c.font = "10px " + T.tok("--wmono"); c.textAlign = "center"; c.textBaseline = "middle";
      var tw = c.measureText(lab).width, lx = px + Math.cos(ang) * (14 + tw / 2), ly = py + Math.sin(ang) * 16;
      lx = Math.max(tw / 2 + 4, Math.min(w - tw / 2 - 4, lx)); ly = Math.max(28, Math.min(h - 8, ly)); c.fillText(lab, lx, ly); }
    c.globalAlpha = 1; });
  c.fillStyle = dot; c.beginPath(); c.arc(cx, cy, 7, 0, 7); c.fill(); c.strokeStyle = teal; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, 11, 0, 7); c.stroke();
});
window.addEventListener("tools:theme", function(){ stg.redraw(); });
T.drawGate(E("gatebox"));
T.onWallet(function(w){ E("gate").hidden = !!w; E("tool").hidden = !w; E("done").hidden = true; if(w){ stg.start(); scan(w); } else { stg.stop(); G = []; LIVE = []; } });
})();
