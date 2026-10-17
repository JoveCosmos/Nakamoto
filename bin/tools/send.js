/* the fee saver: one or many MsgSend in one transaction, the fee from the chain's own gas price (tx.js gasPrices) against
   what a wallet's stale registry price would charge (TYPICAL uphoton per gas), live as the list changes */
(function(){
"use strict";
var T = window.T, E = T.E, esc = T.esc, TYPICAL = 0.225, MAXN = 60;
var DEN = "uatone", MODE = "rows", ROWS = [{ a: "", x: "" }], BAL = { uatone: 0, uphoton: 0 }, FEE = { n: 0, t: 0, u: 0, gas: 0 }, BUSY = false, stg, PK = [];
function sym(d){ return d === "uatone" ? "ATONE" : "PHOTON"; }
function parseAmt(s){ var v = parseFloat(String(s).replace(/,/g, "")); return v > 0 && isFinite(v) ? Math.round(v * 1e6) : 0; }
function valid(){ var me = T.wallet() && T.wallet().address; return ROWS.map(function(r){ var a = r.a.trim(), x = parseAmt(r.x);
  return { a: a, x: x, aok: T.bechOk(a, "atone") && a !== me, xok: x > 0 }; }); }
function msgs(){ var me = T.wallet().address; return valid().filter(function(r){ return r.aok && r.xok; }).map(function(r){
  return { type: "cosmos-sdk/MsgSend", value: { from_address: me, to_address: r.a, amount: [{ denom: DEN, amount: String(r.x) }] } }; }); }
function drawRows(){
  if(MODE !== "rows") return;
  var v = valid();
  E("rows").innerHTML = ROWS.map(function(r, i){ return '<div class=srow style="animation-delay:' + Math.min(i, 8) * 40 + 'ms"><input type=text name="to' + i + '" data-i=' + i + ' data-k=a value="' + esc(r.a) + '" placeholder="atone1…" autocomplete=off spellcheck=false aria-label="Recipient ' + (i + 1) + '" class="' + (r.a ? (v[i].aok ? 'ok' : 'bad') : '') + '">' +
    '<input type=text name="amt' + i + '" data-i=' + i + ' data-k=x value="' + esc(r.x) + '" placeholder="0.0" inputmode=decimal autocomplete=off aria-label="Amount ' + (i + 1) + '" class="' + (r.x ? (v[i].xok ? 'ok' : 'bad') : '') + '">' +
    '<button class=rm type=button data-rm=' + i + ' aria-label="Remove" ' + (ROWS.length > 1 ? '' : 'disabled') + '><svg viewBox="0 0 24 24" width=14 height=14 fill=none stroke=currentColor stroke-width=2 stroke-linecap=round><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'; }).join("");
}
function state(){
  var v = valid(), good = v.filter(function(r){ return r.aok && r.xok; }), tot = good.reduce(function(s, r){ return s + r.x; }, 0), n = good.length;
  E("stgtag").textContent = n + (n === 1 ? " recipient" : " recipients") + (tot ? ", " + T.fmtA(tot) + " " + sym(DEN) : "");
  var over = tot > (BAL[DEN] || 0), bad = v.some(function(r){ return (r.a && !r.aok) || (r.x && !r.xok); });
  E("bal").innerHTML = 'balance <b>' + T.fmtA(BAL.uatone) + ' ATONE</b> <b>' + T.fmtA(BAL.uphoton) + ' PHOTON</b>' + (over ? ' <span style="color:var(--amber)">not enough ' + sym(DEN) + '</span>' : '');
  E("go").disabled = !n || over || bad || BUSY || n > MAXN; E("go").textContent = n > 1 ? "Send to " + n : "Send";
  E("hero").classList.toggle("idle", !n);
  PK = good.map(function(r){ return r.x; });
  fee(good.length && !over && !bad ? msgs() : null, n);
}
function fee(m, n){
  var k = ++FEE.n; clearTimeout(FEE.t);
  if(!m){ E("fee").textContent = n > MAXN ? "at most " + MAXN + " recipients in one transaction" : " "; E("hf").textContent = "0"; E("hw").textContent = "0"; E("hp").textContent = "0%"; return; }
  E("fee").textContent = "fee: pricing…";
  FEE.t = setTimeout(function(){ T.feePreview(m).then(function(f){ if(k !== FEE.n) return; var u = parseInt(f.fee.amount[0].amount, 10), typ = Math.ceil(f.fee.gas * TYPICAL);
      FEE.u = u; FEE.gas = f.fee.gas; E("hf").textContent = T.fmtP(u); E("hw").textContent = T.fmtP(typ); E("hp").textContent = Math.max(0, Math.round(100 - 100 * u / typ)) + "%";
      E("fee").innerHTML = 'fee ≈ <span class=ok>' + T.fmtP(u) + ' PHOTON</span>, gas ' + f.fee.gas.toLocaleString("en-US") + (BAL.uphoton < u ? ' <span class=bad>no PHOTON for the fee</span>' : '');
      E("go").disabled = E("go").disabled || BAL.uphoton < u; })
    .catch(function(e){ if(k !== FEE.n) return; E("fee").innerHTML = '<span class=bad>' + esc(String(e && e.message || e).replace(/^The chain refused this transaction: /, "").slice(0, 90)) + '</span>'; E("go").disabled = true; }); }, 400);
}
function fromPaste(){ var lines = E("paste").value.split(/\n+/).map(function(l){ return l.trim(); }).filter(Boolean);
  ROWS = lines.slice(0, MAXN + 1).map(function(l){ var p = l.split(/[\s,;]+/); return { a: p[0] || "", x: p[1] || "" }; }); if(!ROWS.length) ROWS = [{ a: "", x: "" }]; }
E("rows").addEventListener("input", function(ev){ var i = ev.target.dataset.i, k = ev.target.dataset.k; if(i == null) return; ROWS[+i][k] = ev.target.value;
  var v = valid()[+i]; ev.target.className = ev.target.value ? (k === "a" ? (v.aok ? "ok" : "bad") : (v.xok ? "ok" : "bad")) : ""; state(); });
E("rows").addEventListener("click", function(ev){ var b = ev.target.closest("[data-rm]"); if(!b || ROWS.length < 2) return; ROWS.splice(+b.dataset.rm, 1); drawRows(); state(); });
E("add").addEventListener("click", function(){ if(MODE === "paste"){ E("paste").value += (E("paste").value && !/\n$/.test(E("paste").value) ? "\n" : ""); E("paste").focus(); return; }
  if(ROWS.length >= MAXN) return; ROWS.push({ a: "", x: "" }); drawRows(); state(); var last = E("rows").querySelector('.srow:last-child input'); if(last) last.focus(); });
E("paste").addEventListener("input", function(){ fromPaste(); state(); });
E("den").addEventListener("click", function(ev){ var b = ev.target.closest("[data-d]"); if(!b) return; DEN = b.dataset.d;
  Array.prototype.forEach.call(E("den").children, function(x){ x.setAttribute("aria-pressed", x === b); }); state(); });
E("mode").addEventListener("click", function(ev){ var b = ev.target.closest("[data-m]"); if(!b) return; MODE = b.dataset.m;
  Array.prototype.forEach.call(E("mode").children, function(x){ x.setAttribute("aria-pressed", x === b); });
  if(MODE === "paste"){ E("paste").value = ROWS.filter(function(r){ return r.a || r.x; }).map(function(r){ return (r.a + " " + r.x).trim(); }).join("\n"); E("rows").hidden = true; E("paste").hidden = false; }
  else { fromPaste(); E("paste").hidden = true; E("rows").hidden = false; drawRows(); } state(); });
E("go").addEventListener("click", function(){
  var m = msgs(); if(!m.length || BUSY) return; BUSY = true; E("go").disabled = true;
  T.sign(m, E("memo").value.trim(), function(t){ E("step").textContent = t; }).then(function(r){
    E("tool").hidden = true; E("done").hidden = false; E("donen").textContent = "Sent to " + m.length; E("donetx").textContent = "fee " + T.fmtP(FEE.u) + " PHOTON";
    E("donelink").href = "https://explorer.gatahub.zone/" + T.CHAIN + "/txs/" + r.hash; stg.stop();
  }).catch(function(e){ E("step").textContent = " "; E("fee").innerHTML = '<span class=bad>' + esc(String(e && e.message || e).slice(0, 120)) + '</span>'; })
  .then(function(){ BUSY = false; balances(); });
});
E("again").addEventListener("click", function(){ E("done").hidden = true; E("tool").hidden = false; ROWS = [{ a: "", x: "" }]; E("paste").value = ""; drawRows(); stg.start(); state(); });
function balances(){ var w = T.wallet(); if(!w) return; window.__TX.balances(w.address).then(function(b){ if(T.wallet() && T.wallet().address === w.address){ BAL = b; state(); } }).catch(function(){}); }
/* the picture: the wallet on the left, a packet flowing to each recipient, sized by amount */
stg = T.stage(E("cv"), function(c, w, h, t){
  var teal = T.tok("--teal"), vio = T.tok("--violet2"), bar = T.tok("--bar"), dot = T.tok("--dot"), x0 = w * .16, y0 = h / 2, n = PK.length, max = Math.max.apply(null, PK.concat([1]));
  if(!n){ for(var k = 0; k < 3; k++){ var rr = (t * 40 + k * 30) % 90; c.globalAlpha = 1 - rr / 90; c.strokeStyle = teal; c.beginPath(); c.arc(x0, y0, 8 + rr, 0, 7); c.stroke(); } c.globalAlpha = 1; }
  for(var i = 0; i < n; i++){ var x1 = w * .84, y1 = n === 1 ? h / 2 : h * (.14 + .72 * i / (n - 1)), r = 3 + 5 * Math.sqrt(PK[i] / max);
    c.strokeStyle = bar; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y0); c.bezierCurveTo(w * .5, y0, w * .5, y1, x1, y1); c.stroke();
    var p = (t * .45 + i * .37) % 1, px = x0 + (x1 - x0) * p, py = y0 + (y1 - y0) * (3 * p * p - 2 * p * p * p);
    c.fillStyle = i % 2 ? vio : teal; c.beginPath(); c.arc(px, py, r, 0, 7); c.fill();
    c.fillStyle = bar; c.beginPath(); c.arc(x1, y1, 5, 0, 7); c.fill(); }
  c.fillStyle = dot; c.beginPath(); c.arc(x0, y0, 7, 0, 7); c.fill(); c.strokeStyle = teal; c.lineWidth = 2; c.beginPath(); c.arc(x0, y0, 11, 0, 7); c.stroke();
});
window.addEventListener("tools:theme", function(){ stg.redraw(); });
T.drawGate(E("gatebox"));
T.onWallet(function(w){ E("gate").hidden = !!w; E("tool").hidden = !w; E("done").hidden = true; if(w){ stg.start(); drawRows(); state(); balances(); } else stg.stop(); });
})();
