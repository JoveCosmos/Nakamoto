/* the revoke scanner: every grant the wallet gave (authz/grants/granter) and the governor it follows (x/gov), drawn as
   they load, any selection revoked in one signature (N MsgRevoke, plus MsgUndelegateGovernor for the follow); a Ledger
   takes at most PAGE per signature, so a larger selection goes in rounds */
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
  /* a governor's own wallet follows itself (the chain's rule, it cannot be undone): not a grant to list; its followers are
     what is given to it (operator, 2026-11-03) */
  var myGov = T.conv(w.address, "atonegov");
  var followers = T.get("/atomone/gov/v1/governors/" + myGov + "/delegations?pagination.limit=1&pagination.count_total=true")
    .then(function(d){ return d && d.pagination ? +d.pagination.total || 0 : 0; }).catch(function(){ return 0; });
  Promise.all([T.names, all("/cosmos/authz/v1beta1/grants/granter/" + w.address), all("/cosmos/authz/v1beta1/grants/grantee/" + w.address).catch(function(){ return []; }), T.govOf(w.address), followers])
    .then(function(x){ if(!T.wallet() || T.wallet().address !== w.address) return;
      G = x[1].map(function(g, i){ var n = T.nameOf(g.grantee), k = kind(g); return { i: i, grantee: g.grantee, who: n.kind, kind: k, url: url(g), exp: expiry(g), expired: expiry(g) === "expired",
          name: n.kind === "ours" ? (k === "redelegate" ? "Nakamoto Autopilot" : "Nakamoto Restake") : n.n }; })
        .filter(function(g){ return g.url; });
      /* the governor the wallet follows votes with its stake: listed as its own kind, never pre-ticked */
      if(x[3] && x[3] !== myGov) G.push({ i: G.length, grantee: x[3], who: "governor", kind: "governor", gov: true, exp: "until unfollowed", expired: false, name: "Governor: " + T.govName(x[3]) });
      R = x[2].map(function(g){ var n = T.nameOf(g.granter); return { granter: g.granter, name: n.n, who: n.kind, kind: kind(g), exp: expiry(g) }; });
      var nf = Math.max(0, x[4] - (x[3] === myGov ? 1 : 0));
      if(x[3] === myGov || nf) R.unshift({ granter: myGov, name: nf + (nf === 1 ? " follower" : " followers") + " vote with you", who: "governor", kind: "governor", exp: "you are a governor", fl: nf });
      G.forEach(function(g){ SEL[g.i] = g.who === "unknown" || g.expired || g.kind === "SEND"; });   /* the ones to look at first come ticked */
      LIVE = G.map(function(g, k){ return { g: g, born: performance.now() + k * 90 }; });
      E("stgtag").textContent = G.length ? G.length + " grants" : "no grants";
      E("hero").classList.remove("idle"); rows(); hero(); })
    .catch(function(e){ E("stgtag").textContent = "could not read grants"; E("fee").textContent = T.why(e); });
}
function rows(){
  E("rows").innerHTML = G.length ? G.map(function(g, k){ return '<label class="row' + (SEL[g.i] ? ' on' : '') + '" style="animation-delay:' + (k * 60) + 'ms"><input type=checkbox data-i=' + g.i + (SEL[g.i] ? ' checked' : '') + ' aria-label="' + esc(g.name) + ' ' + esc(g.kind) + '">' +
    '<span class=who><b>' + esc(g.name) + (g.who === "ours" || g.who === "governor" ? '' : g.who === "unknown" ? ' <span class="pill w">unknown</span>' : ' <span class=pill>validator</span>') + '</b><small>' + esc(g.grantee) + '</small></span>' +
    '<span class=what><span class="pill ' + (g.kind === "SEND" ? 'r' : g.kind === "redelegate" || g.kind === "delegate" ? 't' : 'v') + '">' + esc(g.kind) + '</span><span>' + esc(g.exp) + '</span></span></label>'; }).join("")
    : '<div class=empty>no permissions given</div>';
  E("rrows").innerHTML = R.length ? R.map(function(g, k){ return '<div class="row ro' + (g.fl ? ' fl" role=button tabindex=0 data-fl="' + esc(g.granter) + '" title="See who follows you"' : '"') + ' style="animation-delay:' + (k * 60) + 'ms"><span class=who><b>' + esc(g.name) + '</b><small>' + esc(g.granter) + '</small></span><span class=what><span class="pill v">' + esc(g.kind) + '</span><span>' + esc(g.exp) + '</span></span></div>'; }).join("")
    : '<div class=empty>none</div>';
}
function hero(){
  var n = G.length, s = G.filter(function(g){ return SEL[g.i]; }).length, u = G.filter(function(g){ return g.who === "unknown"; }).length;
  E("hn").textContent = n; E("hs").textContent = s; E("hu").textContent = u;
  /* the live count where the selection buttons were (operator, 2026-11-03) */
  E("selnote").innerHTML = s ? '<b>' + s + '</b> selected' + (s > PAGE ? ', ' + Math.ceil(s / PAGE) + ' signatures' : '') : '';   /* only once something is ticked */
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
    .catch(function(e){ if(n !== FEE.n) return; E("fee").innerHTML = '<span class=bad>' + esc(T.why(e)) + '</span>'; }); }, 350);
}
function msgs(list){ var a = T.wallet().address; return list.map(function(g){ return g.gov ? { type: "atomone/v1/MsgUndelegateGovernor", value: { delegator_address: a } }
  : { type: "cosmos-sdk/MsgRevoke", value: { granter: a, grantee: g.grantee, msg_type_url: g.url } }; }); }
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
  }).catch(function(e){ E("step").textContent = " "; E("fee").innerHTML = '<span class=bad>' + esc(T.why(e)) + '</span>'; })
  .then(function(){ BUSY = false; hero(); });
});
E("again").addEventListener("click", function(){ E("done").hidden = true; E("tool").hidden = false; stg.start(); scan(T.wallet()); });
/* (operator, 2026-11-03) a governor's followers, as a list: tap the row */
function followers(gov){
  var me = T.wallet() && T.wallet().address, out = [];
  var box = document.createElement("div"); box.className = "flpop"; box.innerHTML = '<div class=flcard role=dialog aria-modal=true aria-label="Followers"><header><b>Followers</b><span id=fln>reading…</span><button type=button class=flx aria-label=Close>Close</button></header><div class=fllist id=fll></div></div>';
  document.body.appendChild(box);
  var close = function(){ box.remove(); document.removeEventListener("keydown", esck); }, esck = function(ev){ if(ev.key === "Escape") close(); };
  box.addEventListener("click", function(ev){ if(ev.target === box || ev.target.closest(".flx")) close(); }); document.addEventListener("keydown", esck);
  function page(key){ return T.get("/atomone/gov/v1/governors/" + gov + "/delegations?pagination.limit=200" + (key ? "&pagination.key=" + encodeURIComponent(key) : ""))
    .then(function(d){ out = out.concat((d.delegations || []).map(function(x){ return x.delegator_address; }).filter(function(a){ return a !== me; }));
      var nk = d.pagination && d.pagination.next_key; return nk && out.length < 5000 ? page(nk) : out; }); }
  page(null).then(function(list){
    E("fln").textContent = list.length + (list.length === 1 ? " wallet" : " wallets");
    E("fll").innerHTML = list.length ? list.map(function(a){ var n = T.nameOf(a); return '<div class=flr><b>' + esc(n.kind === "unknown" ? T.short(a) : n.n) + '</b><small>' + esc(a) + '</small></div>'; }).join("") : '<div class=empty>none</div>';
  }).catch(function(e){ E("fln").textContent = T.why(e); });
}
E("rrows").addEventListener("click", function(ev){ var r = ev.target.closest && ev.target.closest("[data-fl]"); if(r) followers(r.dataset.fl); });
E("rrows").addEventListener("keydown", function(ev){ if(ev.key !== "Enter" && ev.key !== " ") return; var r = ev.target.closest && ev.target.closest("[data-fl]"); if(r){ ev.preventDefault(); followers(r.dataset.fl); } });
/* the picture: the wallet in the centre, each grantee a node on a ring, ticked ones in red, revoked ones fading out */
function draw(){}
/* (operator, 2026-11-03: clearer) a radar sweep while the grants are read; then each grant is a labelled pill on a ring
   around "You", coloured by who holds it, its line carrying a pulse outward (the permission leaving the wallet); a
   ticked one turns red with a cut mark on its line; a revoked one snaps and falls away; none at all is a calm shield */
stg = T.stage(E("cv"), function(c, w, h, t){
  var teal = T.tok("--teal"), red = T.tok("--red"), vio = T.tok("--violet"), amb = T.tok("--amber"), bar = T.tok("--bar"), dot = T.tok("--dot"), ink = T.tok("--wt") || dot;
  var mono = T.tok("--wmono") || "monospace", cx = w / 2, cy = h / 2, now = performance.now(), phone = w < 460;
  var RX = w * .36, RY = h * .34, R0 = Math.min(RX, RY), scanning = E("stgtag").textContent === "scanning";
  var col = function(x){ return SEL[x.g.i] ? red : x.g.who === "unknown" ? amb : x.g.who === "ours" || x.g.who === "governor" ? teal : vio; };
  /* the ring */
  c.strokeStyle = bar; c.lineWidth = 1; c.setLineDash([2, 5]); c.beginPath(); c.ellipse(cx, cy, RX, RY, 0, 0, 7); c.stroke(); c.setLineDash([]);
  if(scanning){
    var a = (t * 1.8) % (Math.PI * 2);
    for(var k = 0; k < 24; k++){ var a0 = a - k * .045; c.globalAlpha = (1 - k / 24) * .5; c.strokeStyle = teal; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a0) * RX, cy + Math.sin(a0) * RY); c.stroke(); }
    c.globalAlpha = 1;
  } else if(!LIVE.length){
    /* nothing granted: a shield with a tick */
    var S = Math.min(w, h) * .16; c.strokeStyle = teal; c.lineWidth = 2.4; c.lineJoin = "round";
    c.beginPath(); c.moveTo(cx, cy - S); c.lineTo(cx + S * .8, cy - S * .62); c.lineTo(cx + S * .8, cy + S * .05);
    c.quadraticCurveTo(cx + S * .7, cy + S * .75, cx, cy + S); c.quadraticCurveTo(cx - S * .7, cy + S * .75, cx - S * .8, cy + S * .05);
    c.lineTo(cx - S * .8, cy - S * .62); c.closePath(); c.stroke();
    c.beginPath(); c.moveTo(cx - S * .32, cy); c.lineTo(cx - S * .06, cy + S * .28); c.lineTo(cx + S * .38, cy - S * .22); c.stroke();
    c.fillStyle = T.tok("--wf"); c.font = "11px " + mono; c.textAlign = "center"; c.textBaseline = "top";
    c.fillText("nobody can act for your wallet", cx, Math.min(h - 16, cy + S + 14)); return;
  }
  var n = LIVE.length;
  LIVE.forEach(function(x, i){
    var age = (now - x.born) / 600; if(age < 0) return; var e2 = 1 - Math.pow(1 - Math.min(1, age), 3);
    /* spread from the top, a little off the vertical so no pill sits straight over You at the sides */
    var gone = x.gone ? Math.min(1, (now - x.gone) / 700) : 0, ang = -Math.PI / 2 + (i + .5) * Math.PI * 2 / Math.max(1, n);
    var px = cx + Math.cos(ang) * (RX * e2 + gone * 40), py = cy + Math.sin(ang) * (RY * e2 + gone * 40) + gone * gone * 30, on = SEL[x.g.i], cc = col(x);
    c.globalAlpha = (1 - gone) * e2;
    /* the line: whole, or snapped in two once revoked */
    c.strokeStyle = cc; c.lineWidth = on ? 2 : 1.3; if(on) c.setLineDash([6, 4]);
    var mx = cx + (px - cx) * .5, my = cy + (py - cy) * .5, gap = gone * 14;
    c.beginPath(); c.moveTo(cx + Math.cos(ang) * 14, cy + Math.sin(ang) * 14); c.lineTo(mx - Math.cos(ang) * gap, my - Math.sin(ang) * gap); c.stroke();
    c.beginPath(); c.moveTo(mx + Math.cos(ang) * gap, my + Math.sin(ang) * gap); c.lineTo(px, py); c.stroke(); c.setLineDash([]);
    /* the pulse travelling out */
    if(!gone){ var f = ((t * .55 + i * .37) % 1), qx = cx + (px - cx) * f, qy = cy + (py - cy) * f; c.fillStyle = cc; c.globalAlpha = e2 * (1 - f) * .9;
      c.beginPath(); c.arc(qx, qy, on ? 3 : 2.4, 0, 7); c.fill(); c.globalAlpha = (1 - gone) * e2; }
    /* the cut mark on a ticked line */
    if(on && !gone){ var s2 = 6; c.strokeStyle = red; c.lineWidth = 2.2; c.lineCap = "round";
      c.beginPath(); c.moveTo(mx - s2, my - s2); c.lineTo(mx + s2, my + s2); c.moveTo(mx + s2, my - s2); c.lineTo(mx - s2, my + s2); c.stroke(); c.lineCap = "butt"; }
    /* many grants (over 8): a dot each, the names are in the list beside (2026-11-03: pills would overlap) */
    if(n > 8){ c.fillStyle = cc; c.beginPath(); c.arc(px, py, on ? 6 : 4.5, 0, 7); c.fill(); c.globalAlpha = 1; return; }
    /* the pill: name (phones: the kind alone), kept inside the picture */
    var lab = phone ? x.g.kind : (x.g.name.length > 20 ? x.g.name.slice(0, 19) + "…" : x.g.name), sub = phone ? "" : x.g.kind;
    c.font = "600 11px " + mono; var tw = Math.max(c.measureText(lab).width, sub ? (c.font = "10px " + mono, c.measureText(sub).width) : 0);
    var pw = tw + 18, ph = sub ? 34 : 22, bx = Math.max(4, Math.min(w - pw - 4, px - pw / 2)), by = Math.max(4, Math.min(h - ph - 4, py - ph / 2));
    c.fillStyle = T.tok("--wc") || "#fff"; c.strokeStyle = cc; c.lineWidth = on ? 2 : 1.2;
    c.beginPath(); if(c.roundRect) c.roundRect(bx, by, pw, ph, 8); else c.rect(bx, by, pw, ph); c.fill(); c.stroke();
    c.fillStyle = on ? red : ink; c.font = "600 11px " + mono; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(lab, bx + pw / 2, by + (sub ? 12 : ph / 2));
    if(sub){ c.fillStyle = cc; c.font = "10px " + mono; c.fillText(sub, bx + pw / 2, by + 24); }
    c.globalAlpha = 1;
  });
  /* You, in the middle */
  c.fillStyle = teal; c.beginPath(); c.arc(cx, cy, 13, 0, 7); c.fill();
  c.fillStyle = T.tok("--teal-ink"); c.font = "700 9px " + mono; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("YOU", cx, cy + .5);
});
window.addEventListener("tools:theme", function(){ stg.redraw(); });
T.drawGate(E("gatebox"));
T.onWallet(function(w){ E("gate").hidden = !!w; E("tool").hidden = !w; E("done").hidden = true; if(w){ stg.start(); scan(w); } else { stg.stop(); G = []; LIVE = []; } });
})();
