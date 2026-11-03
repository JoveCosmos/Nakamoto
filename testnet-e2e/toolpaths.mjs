// Tools inside the app on TESTNET (2026-11-03): each tool opened from the app's Tools menu (window.__tool), signing
// with the app's wallet through the e2e stand-in, every transaction read back from the chain.
//   node toolpaths.mjs <wallet-name> <keplr|ledger|adena|adena-ledger> [send,send-batch,revoke,gather]
// revoke needs grants to exist (run paths.mjs autopilot-on,restake-on first); gather needs stake off GATA HUB that
// can move (run paths.mjs stake first). E2E_PHONE=1 runs at 390x844.
const D = "http://127.0.0.1:9412", API = "https://atomone-testnet-api.gatadao.com", PAGE = "http://127.0.0.1:8089/testnet/";
const [NAME, KIND, ONLY] = process.argv.slice(2);
const GATA = "atonevaloper18rw0prhskw38kt99ypae4ka46k9js58uuwlg93";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => (await fetch(D + p, { method: "POST", body })).json();
const ev = async js => { const r = await post("/eval", js); if (r.error) throw new Error(r.error); return r.value; };
const chain = async p => (await fetch(API + p)).json();
function note(path, ok, info) { console.log((ok ? "PASS " : "FAIL ") + path + "  " + JSON.stringify(info)); }
const FR = `var F = document.getElementById('tlfr'), W = F && F.contentWindow, Dc = W && W.document;`;
const HOOK = `(function(){ ${FR} if(!W || !W.__TX || W.__txhook) return W && W.__txhook; W.__txlog = [];
  ["send"].forEach(function(fn){ var f = W.__TX[fn]; W.__TX[fn] = function(w, msgs, memo){ var rec = { types: msgs.map(function(m){ return m.type; }) }; W.__txlog.push(rec);
    return f.apply(this, arguments).then(function(r){ rec.ok = true; rec.hash = r && r.hash; return r; }, function(e){ rec.ok = false; rec.err = String(e && e.message || e); throw e; }); }; });
  W.__txhook = true; return true; })()`;
async function connect() {
  await post("/use?name=" + NAME); await post("/kind?k=" + KIND);
  await post(process.env.E2E_PHONE ? "/size?w=390&h=844" : "/size?w=0");
  await post("/go?url=" + encodeURIComponent(PAGE) + "&wait=6000");
  const wn = /adena/.test(KIND) ? "Adena" : "Keplr";
  return ev(`new Promise(function(res){ window.__wconnect && window.__wconnect(${JSON.stringify(wn)}); var t0 = Date.now();
    (function tick(){ if(window.__ADDR && window.__BAL) return res({ addr: window.__ADDR, wallet: window.__WALLET.name });
      if(Date.now() - t0 > 30000) return res({ error: "no connect" }); setTimeout(tick, 300); })(); })`);
}
async function open(tool) {
  await ev(`(async function(){ for(var i = 0; i < 4 && document.querySelector('.pop.on'); i++){ window.__POP.close(document.querySelector('.pop.on')); await new Promise(function(r){ setTimeout(r, 300); }); }
    window.__tool(${JSON.stringify(tool)}); return 1; })()`);
  for (let k = 0; k < 60; k++) { await sleep(500);
    const ok = await ev(`(function(){ ${FR} return !!(Dc && W.T && W.T.wallet() && Dc.getElementById('tool') && !Dc.getElementById('tool').hidden); })()`).catch(() => false);
    if (ok) { await ev(HOOK); return true; } }
  return false;
}
async function txWait(n0, ms = 150000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const r = await ev(`(function(){ ${FR} var L = W.__txlog || []; return L.length > ${n0} && L[L.length - 1].ok !== undefined ? L[L.length - 1] : null; })()`).catch(() => null);
    if (r) return r; await sleep(700); }
  return null;
}
async function txOf(hash) { for (let k = 0; k < 10; k++) { const d = await chain("/cosmos/tx/v1beta1/txs/" + hash); if (d.tx_response) return d; await sleep(2000); } return null; }
const sum = d => ({ code: d.tx_response.code, mode: (d.tx.auth_info.signer_infos[0].mode_info.single || {}).mode, msgs: d.tx.body.messages.map(m => m["@type"].split(".").pop()),
  fee: d.tx.auth_info.fee.amount.map(c => c.amount + c.denom).join("+"), gas: d.tx_response.gas_used + "/" + d.tx_response.gas_wanted });
async function run(path, act, check) {
  if (ONLY && !ONLY.split(",").includes(path)) return;
  try {
    const n0 = await ev(`(function(){ ${FR} return (W.__txlog || []).length; })()`);
    await ev(`(async function(){ ${FR} var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
      var wait = async function(p, ms, what){ var t0 = Date.now(); while(Date.now() - t0 < (ms || 30000)){ try{ if(p()) return; }catch(e){} await sleep(300); } throw new Error('timeout: ' + what); };
      var type = function(el, v){ el.value = v; el.dispatchEvent(new W.Event('input', { bubbles: true })); };
      ${act} })()`);
    const rec = await txWait(n0); if (!rec) return note(path, false, { page: "no transaction" });
    if (!rec.ok) return note(path, false, { page: rec.err });
    const d = await txOf(rec.hash); if (!d) return note(path, false, { hash: rec.hash, chain: "not found" });
    const s = sum(d), c = await check(d, s);
    note(path, s.code === 0 && c.check === "ok", { hash: rec.hash.slice(0, 10), ...s, ...c });
  } catch (e) { note(path, false, { page: String(e.message || e).slice(0, 300) }); }
}
const c = await connect(); if (c.error) { note("connect", false, c); process.exit(1); }
console.log("connected " + JSON.stringify(c));
const A = c.addr, OPER = "atone10aacrd04k78vlku3n4wwdqh0kmp7zjvhvy2yez", FAU = "atone1j7u4528vu28cl6950kqtl60wdl5djed6x47yms";

if (!ONLY || /send/.test(ONLY)) {
  await open("send");
  await run("send", `var a = Dc.querySelector('#rows input[data-k=a]'), x = Dc.querySelector('#rows input[data-k=x]'); type(a, ${JSON.stringify(OPER)}); type(x, '0.011');
    await wait(function(){ return !Dc.getElementById('go').disabled; }, 30000, 'Send enabled'); Dc.getElementById('go').click();`,
    async (d, s) => { const m = d.tx.body.messages[0]; return { to: m.to_address.slice(0, 12), amt: m.amount[0].amount + m.amount[0].denom,
      check: s.msgs.length === 1 && s.msgs[0] === "MsgSend" && m.to_address === OPER && m.amount[0].amount === "11000" && /uphoton/.test(s.fee) ? "ok" : "FAILED" }; });
  await open("send");
  await run("send-batch", `Dc.querySelector('#mode [data-m=paste]').click(); await sleep(300); var p = Dc.getElementById('paste'); type(p, ${JSON.stringify(OPER + " 0.012\n" + FAU + " 0.013")});
    await wait(function(){ return !Dc.getElementById('go').disabled; }, 30000, 'Send enabled'); Dc.getElementById('go').click();`,
    async (d, s) => ({ n: s.msgs.length, check: s.msgs.length === 2 && s.msgs.every(m => m === "MsgSend") ? "ok" : "FAILED" }));
}
if (!ONLY || /revoke/.test(ONLY)) {
  const g0 = ((await chain("/cosmos/authz/v1beta1/grants/granter/" + A)).grants || []).length;
  await open("revoke");
  await run("revoke", `await wait(function(){ return Dc.querySelectorAll('#rows input[type=checkbox]').length >= ${Math.max(1, g0)}; }, 40000, 'grant rows');
    Dc.getElementById('selall').click(); await wait(function(){ return !Dc.getElementById('go').disabled; }, 30000, 'Revoke enabled'); Dc.getElementById('go').click();`,
    async (d, s) => { const g = ((await chain("/cosmos/authz/v1beta1/grants/granter/" + A)).grants || []).length;
      return { grants: g0 + " -> " + g, check: g0 > 0 && g === 0 && s.msgs.every(m => m === "MsgRevoke") ? "ok" : "FAILED" }; });
}
if (!ONLY || /gather/.test(ONLY)) {
  await open("gather");
  await run("gather", `await wait(function(){ return !Dc.getElementById('go').disabled; }, 60000, 'Gather enabled'); Dc.getElementById('go').click();`,
    async (d, s) => { const ms = d.tx.body.messages; return { n: ms.length, check: ms.length >= 1 && ms.every(m => m["@type"].endsWith("MsgBeginRedelegate") && m.validator_dst_address === GATA) ? "ok" : "FAILED" }; });
}
await ev(`(function(){ window.__POP.close(document.getElementById('tlpop')); return 1; })()`).catch(() => {});
