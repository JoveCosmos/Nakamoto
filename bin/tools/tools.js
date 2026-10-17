/* shared by the tools pages: the theme switch, the wallet (Keplr, Adena, a Ledger through either, as the app connects
   them), names for addresses, and the signing path through tx.js (amino everywhere: a Ledger and Adena sign only amino,
   and a MsgRevoke or MsgSend needs nothing more). Exposed as window.T. */
(function(){
"use strict";
var NET = JSON.parse(document.getElementById("payload").textContent).net || {};
var BASE = NET.base || "/", API = NET.api, CHAIN = NET.chain;
var E = function(id){ return document.getElementById(id); };
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
/* ── theme, as boot.js keeps it (th_theme) ── */
(function(){ var th; try{ th = localStorage.getItem("th_theme"); }catch(e){}
  if(th !== "light" && th !== "dark") th = window.matchMedia && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", th); })();
document.addEventListener("click", function(ev){ var b = ev.target.closest && ev.target.closest("#thbtn"); if(!b) return;
  var th = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", th); try{ localStorage.setItem("th_theme", th); }catch(e){}
  window.dispatchEvent(new Event("tools:theme")); });
/* ── REST ── */
function get(p){ return fetch(API + p, { cache: "no-store" }).then(function(r){ return r.json(); }); }
/* ── a chain query the REST API answers with an error status for "none" (a wallet that follows no governor) goes to
   the node's ABCI query through this site (rpc/abci_query, as the app does): always 200, the chain's code in the body ── */
function pbVar(n){ var o = []; while(n > 127){ o.push(n % 128 + 128); n = Math.floor(n / 128); } o.push(n); return o; }
function pbStr(f, str){ var u = Array.from(new TextEncoder().encode(str)); return [f * 8 + 2].concat(pbVar(u.length), u); }
function pbRead(b){
  var o = {}, i = 0, vr = function(){ var x = 0, m = 1, c; do { c = b[i++]; x += (c & 127) * m; m *= 128; } while(c & 128 && i < b.length); return x; };
  while(i < b.length){ var t = vr(), f = Math.floor(t / 8), w = t % 8, v;
    if(w === 0) v = vr(); else if(w === 2){ var n = vr(); v = b.subarray(i, i + n); i += n; } else if(w === 1){ i += 8; continue; } else if(w === 5){ i += 4; continue; } else break;
    (o[f] = o[f] || []).push(v); }
  return o;
}
function abciQ(path, bytes){
  var hex = bytes.map(function(x){ return (x < 16 ? "0" : "") + x.toString(16); }).join("");
  return fetch(BASE + 'rpc/abci_query?path="' + path + '"&data=0x' + hex, { cache: "no-store" })
    .then(function(r){ if(!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(function(j){ var q = j && j.result && j.result.response; if(!q) throw new Error("no answer");
      var raw = atob(q.value || ""), v = new Uint8Array(raw.length); for(var i = 0; i < raw.length; i++) v[i] = raw.charCodeAt(i);
      return { code: +q.code || 0, log: String(q.log || ""), value: v }; });
}
/* the governor this wallet follows (x/gov GovernanceDelegation), or null */
function govOf(addr){
  return abciQ("/atomone.gov.v1.Query/GovernanceDelegation", pbStr(1, addr))
    .then(function(q){ if(q.code) return null; var v = (pbRead(q.value)[1] || [])[0]; return v ? new TextDecoder().decode(v) : null; }).catch(function(){ return null; });
}
/* ── bech32: an address is checked before it is used ── */
var CH = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
function pm(v){ var g = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3], c = 1;
  for(var i = 0; i < v.length; i++){ var b = c >>> 25; c = ((c & 0x1ffffff) << 5) ^ v[i]; for(var k = 0; k < 5; k++) if((b >> k) & 1) c ^= g[k]; } return c >>> 0; }
function hrpx(h){ var o = []; for(var i = 0; i < h.length; i++) o.push(h.charCodeAt(i) >> 5); o.push(0); for(i = 0; i < h.length; i++) o.push(h.charCodeAt(i) & 31); return o; }
function bechOk(a, hrp){ if(typeof a !== "string" || a.length < 14 || a.length > 90 || a !== a.toLowerCase()) return false;
  var p = a.lastIndexOf("1"); if(p < 1 || a.slice(0, p) !== hrp) return false; var d = [];
  for(var i = p + 1; i < a.length; i++){ var x = CH.indexOf(a[i]); if(x < 0) return false; d.push(x); } return pm(hrpx(hrp).concat(d)) === 1; }
function conv(a, hrp){ var p = a.lastIndexOf("1"), d = []; for(var i = p + 1; i < a.length - 6; i++) d.push(CH.indexOf(a[i]));
  var c = pm(hrpx(hrp).concat(d, [0, 0, 0, 0, 0, 0])) ^ 1, o = hrp + "1"; for(i = 0; i < d.length; i++) o += CH[d[i]];
  for(i = 0; i < 6; i++) o += CH[(c >> (5 * (5 - i))) & 31]; return o; }
/* ── names: validators (and their operator accounts) from the app's data, our own grantee from its status ── */
var NAMES = {}, GOVS = {}, OURS = null, namesReady = Promise.all([
  get("/atomone/gov/v1/governors?pagination.limit=500").then(function(d){ (d.governors || []).forEach(function(g){ var m = ((g.description || {}).moniker || "").trim(); if(m) GOVS[g.governor_address] = m; }); }).catch(function(){}),
  fetch(BASE + "data.json", { cache: "no-store" }).then(function(r){ return r.json(); }).then(function(d){
    (d.validators || []).concat(d.inactive || []).forEach(function(v){ if(!v.op) return; NAMES[v.op] = v.m; NAMES[conv(v.op, "atone")] = v.m; }); }).catch(function(){}),
  fetch(BASE + "pilot/_status.json", { cache: "no-store" }).then(function(r){ return r.ok ? r.json() : null; }).then(function(s){ OURS = s && s.grantee || null; }).catch(function(){})
]);
function nameOf(a){ if(OURS && a === OURS) return { n: "Nakamoto", kind: "ours" }; if(NAMES[a]) return { n: NAMES[a], kind: "validator" }; return { n: a.slice(0, 10) + "…" + a.slice(-6), kind: "unknown" }; }
function short(a){ return a.slice(0, 10) + "…" + a.slice(-6); }
function govName(a){ return GOVS[a] || short(a); }
/* ── the wallet ── */
function unwrapA(r){ if(r && r.status === "success") return r.data; var m = (r && r.message) || "Adena refused"; throw new Error(/reject/i.test(m) ? "Request rejected" : m); }
function providers(){
  var out = [];
  if(window.keplr) out.push({ name: "Keplr", enable: function(){ return window.keplr.enable(CHAIN); }, getKey: function(){ return window.keplr.getKey(CHAIN); },
    signAmino: function(addr, doc){ return window.keplr.signAmino(CHAIN, addr, doc, { preferNoSetFee: true }); } });
  if(window.adena && window.adena.cosmos) out.push({ name: "Adena", enable: function(){ return window.adena.cosmos.enable(CHAIN).then(unwrapA); },
    getKey: function(){ return window.adena.cosmos.getKey(CHAIN).then(unwrapA); }, signAmino: function(addr, doc){ return window.adena.cosmos.signAmino(CHAIN, addr, doc).then(unwrapA); } });
  return out;
}
var W = null, onWallet = [];
function connect(name){
  var ps = providers(), w = null; for(var i = 0; i < ps.length; i++) if(ps[i].name === name) w = ps[i];
  if(!w) return Promise.reject(new Error(name + " is not installed in this browser."));
  return w.enable().then(function(){ return w.getKey(); }).then(function(k){
    W = { name: w.name, address: k.bech32Address, pubKey: k.pubKey, ledger: !!k.isNanoLedger, label: (k.name || "").trim(),
          signAmino: function(doc){ return w.signAmino(k.bech32Address, doc); } };
    window.__ADDR = W.address; window.__WALLET = W; try{ localStorage.setItem("th_wallet", w.name); }catch(e){}
    drawWallet(); onWallet.forEach(function(f){ f(W); }); return W; });
}
function disconnect(){ W = null; window.__ADDR = null; window.__WALLET = null; try{ localStorage.removeItem("th_wallet"); }catch(e){} drawWallet(); onWallet.forEach(function(f){ f(null); }); }
function drawWallet(){
  var el = E("wal"); if(!el) return;
  if(!W){ el.hidden = true; return; }
  el.hidden = false; el.innerHTML = '<b title="' + esc(W.address) + '">' + esc(short(W.address)) + '</b>' + (W.ledger ? '<span class=pill>Ledger</span>' : '') +
    '<button class=x type=button id=walx aria-label="Disconnect"><svg viewBox="0 0 24 24" width=14 height=14 fill=none stroke=currentColor stroke-width=2 stroke-linecap=round><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
}
document.addEventListener("click", function(ev){ if(ev.target.closest && ev.target.closest("#walx")) disconnect(); });
/* the gate: a button per wallet found, a note for a phone without one */
function drawGate(el, err){
  var ps = providers(), phone = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  el.innerHTML = '<div class=wrow>' + (ps.length ? ps.map(function(p){ return '<button class=wbtn type=button data-w="' + p.name + '"><img src="' + BASE + 'assets/' + (p.name === "Keplr" ? "wallet-keplr" : "wallet-adena") + '.svg" alt="">' + p.name + '</button>'; }).join("")
    : '<span class=ledger>' + (phone ? "Open this page inside the Keplr app" : "Install Keplr or Adena") + '</span>') + '</div>' +
    '<span class=ledger>' + (ps.length ? "A Ledger signs through either" : "") + '</span><div class=err id=gerr>' + esc(err || "") + '</div>';
}
document.addEventListener("click", function(ev){ var b = ev.target.closest && ev.target.closest(".wbtn[data-w]"); if(!b) return;
  var g = b.closest(".gate"); connect(b.dataset.w).catch(function(e){ var x = E("gerr"); if(x) x.textContent = e && e.message || String(e); }); });
window.__wconnect = function(name){ return connect(name); };   /* the app's hook, so the same drivers work */
/* ── signing: amino, through tx.js; step(text) tells the page where it is ── */
function sign(msgs, memo, step){
  if(!W) return Promise.reject(new Error("Connect a wallet first"));
  return window.__TX.send(W, msgs, memo || "", function(s, x){
    step({ simulating: "pricing the fee", signing: "sign in " + W.name, broadcasting: "sending", pending: "waiting for the block" }[s] || s, x); });
}
/* a fee preview: the gas simulated for these messages at the chain's price, or 0 when the chain refuses (the page says why) */
function feePreview(msgs){
  return window.__TX.gasPrices().then(function(){ return window.__TX.account(W.address); })
    .then(function(acc){ return window.__TX.simulate(msgs, "", W.pubKey, acc.sequence); })
    .then(function(g){ return { fee: window.__TX.feeFor(g, msgs.length), gas: g }; });
}
function fmtP(u){ return (u / 1e6).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 4 }); }
function fmtA(u, d){ return (u / 1e6).toLocaleString("en-US", { maximumFractionDigits: d == null ? 2 : d }); }
/* a canvas sized to its box at the device's pixel ratio; draw(ctx, w, h, t) runs each frame while on */
function stage(cv, draw){
  var ctx = cv.getContext("2d"), on = false, raf = 0, t0 = 0, reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function size(){ var r = cv.getBoundingClientRect(), p = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.max(1, Math.round(r.width * p)); cv.height = Math.max(1, Math.round(r.height * p)); ctx.setTransform(p, 0, 0, p, 0, 0); return r; }
  function tick(ts){ if(!on) return; if(!t0) t0 = ts; var r = cv.getBoundingClientRect(); if(Math.round(r.width * (window.devicePixelRatio || 1)) !== cv.width) size();
    ctx.clearRect(0, 0, r.width, r.height); draw(ctx, r.width, r.height, (ts - t0) / 1000); if(reduced) return; raf = requestAnimationFrame(tick); }
  return { start: function(){ if(on) return; on = true; t0 = 0; size(); raf = requestAnimationFrame(tick); }, stop: function(){ on = false; cancelAnimationFrame(raf); },
    redraw: function(){ if(!on) return; var r = size(); ctx.clearRect(0, 0, r.width, r.height); draw(ctx, r.width, r.height, 0); if(reduced) return; cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); } };
}
function tok(name){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
window.T = { NET: NET, BASE: BASE, CHAIN: CHAIN, E: E, esc: esc, get: get, bechOk: bechOk, conv: conv, names: namesReady, nameOf: nameOf, short: short,
  govOf: govOf, govName: govName, wallet: function(){ return W; }, onWallet: function(f){ onWallet.push(f); }, connect: connect, drawGate: drawGate, sign: sign, feePreview: feePreview,
  fmtP: fmtP, fmtA: fmtA, stage: stage, tok: tok, ours: function(){ return OURS; } };
})();
