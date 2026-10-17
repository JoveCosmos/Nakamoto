// The tools pages on TESTNET through the e2e driver (ui.mjs on :9412): the revoke scanner and the fee saver, each driven
// through its own buttons with a stand-in wallet kind, every transaction read back from the chain.
//   node tools.mjs <wallet-name> <keplr|ledger|adena|adena-ledger> revoke            revoke every grant the wallet gave
//   node tools.mjs <wallet-name> <kind> send <denom> <addr:amount,addr:amount,...>    one batch send
// Needs ui.mjs running with the wallet loaded. Prints PASS/FAIL lines and a SUMMARY.
const [NAME, KIND, WHAT, ...REST] = process.argv.slice(2);
const UI = "http://127.0.0.1:9412", BASE = "http://127.0.0.1:8089/testnet/", API = "https://atomone-testnet-api.gatadao.com";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = (p, body) => fetch(UI + p, { method: "POST", body: body == null ? undefined : body }).then(r => r.json());
const ev = async js => { const r = await post("/eval", js); if (r.error) throw new Error(r.error); return r.value; };
const chain = p => fetch(API + p).then(r => r.json());
const out = [];
function note(path, ok, extra) { out.push({ path, ok, ...extra }); console.log((ok ? "PASS " : "FAIL ") + path + "  " + JSON.stringify(extra)); }
async function txOf(hash) { for (let k = 0; k < 12; k++) { const d = await chain("/cosmos/tx/v1beta1/txs/" + hash); if (d.tx_response) return d; await sleep(2000); } return null; }
function summary(d) { const tr = d.tx_response, si = d.tx.auth_info.signer_infos[0];
  return { code: tr.code, height: tr.height, mode: si.mode_info.single ? si.mode_info.single.mode.replace("SIGN_MODE_", "") : "multi",
    msgs: d.tx.body.messages.map(m => m["@type"].split(".").pop()), memo: d.tx.body.memo, fee: d.tx.auth_info.fee.amount.map(c => c.amount + c.denom).join("+"), gas: tr.gas_used + "/" + tr.gas_wanted }; }
async function open(page) {
  await post("/use?name=" + NAME); await post("/kind?k=" + KIND);
  await post("/go?url=" + encodeURIComponent(BASE + "tools/" + page) + "&wait=4000");
  const wn = /adena/.test(KIND) ? "Adena" : "Keplr";
  return ev(`window.__wconnect(${JSON.stringify(wn)}).then(function(w){ return { addr: w.address, wallet: w.name, ledger: w.ledger }; })`);
}
const HELP = `window.__e2e = { wait: function(pred, ms, what){ var t0 = Date.now(); return new Promise(function(res, rej){ (function tick(){ var v; try{ v = pred(); }catch(e){}
  if(v) return res(v); if(Date.now() - t0 > (ms || 20000)) return rej(new Error("timeout: " + (what || pred))); setTimeout(tick, 250); })(); }); },
  set: function(el, v){ el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); } }; "ok"`;
(async () => {
  const c = await open(WHAT === "revoke" ? "revoke" : "send"); console.log("connected", JSON.stringify(c)); await ev(HELP);
  if (WHAT === "revoke") {
    const before = (await chain("/cosmos/authz/v1beta1/grants/granter/" + c.addr)).grants || [];
    const n = await ev(`window.__e2e.wait(function(){ var n = +document.getElementById("hn").textContent; return document.getElementById("stgtag").textContent !== "scanning" ? n + 1 : 0; }, 30000, "scan").then(function(n){ return n - 1; })`);
    note("revoke:scan", n === before.length, { shown: n, onchain: before.length });
    if (!before.length) return done();
    await ev(`document.getElementById("selall").click(); "ok"`);
    const sel = await ev(`+document.getElementById("hs").textContent`);
    await ev(`window.__e2e.wait(function(){ return /PHOTON/.test(document.getElementById("fee").textContent); }, 30000, "fee")`);
    const fee = await ev(`document.getElementById("fee").textContent`);
    await ev(`document.getElementById("go").click(); "ok"`);
    const link = await ev(`window.__e2e.wait(function(){ return document.getElementById("done").hidden ? null : document.getElementById("donelink").href; }, 180000, "done")`);
    const hash = link.split("/").pop(), d = await txOf(hash);
    const after = (await chain("/cosmos/authz/v1beta1/grants/granter/" + c.addr)).grants || [];
    const s = d ? summary(d) : {}, want = "LEGACY_AMINO_JSON";
    note("revoke:sign", !!d && s.code === 0 && s.mode === want && after.length === 0 && sel === before.length, { hash: hash.slice(0, 10), ...s, want, selected: sel, left: after.length, fee_shown: fee });
  } else {
    const denom = REST[0], list = REST[1].split(",").map(x => x.split(":"));
    await ev(`(function(){ var d = document.querySelector('#den [data-d="${denom}"]'); if(d) d.click(); document.querySelector('#mode [data-m=paste]').click();
      window.__e2e.set(document.getElementById("paste"), ${JSON.stringify(list.map(x => x[0] + " " + x[1]).join("\n"))}); return "ok"; })()`);
    await ev(`window.__e2e.wait(function(){ return /PHOTON/.test(document.getElementById("fee").textContent) && !document.getElementById("go").disabled; }, 40000, "fee")`);
    const hero = await ev(`[document.getElementById("hf").textContent, document.getElementById("hw").textContent, document.getElementById("hp").textContent, document.getElementById("stgtag").textContent]`);
    const bals0 = {}; for (const [a] of list) bals0[a] = +((((await chain("/cosmos/bank/v1beta1/balances/" + a)).balances || []).find(b => b.denom === denom) || {}).amount || 0);
    await ev(`document.getElementById("go").click(); "ok"`);
    const link = await ev(`window.__e2e.wait(function(){ return document.getElementById("done").hidden ? null : document.getElementById("donelink").href; }, 180000, "done")`);
    const hash = link.split("/").pop(), d = await txOf(hash); const s = d ? summary(d) : {};
    let landed = true; for (const [a, x] of list) { const b = +((((await chain("/cosmos/bank/v1beta1/balances/" + a)).balances || []).find(b => b.denom === denom) || {}).amount || 0); if (b - bals0[a] !== Math.round(+x * 1e6) && a !== c.addr) landed = false; }
    note("send:" + denom + ":" + list.length, !!d && s.code === 0 && s.mode === "LEGACY_AMINO_JSON" && landed && s.msgs.length === list.length, { hash: hash.slice(0, 10), ...s, landed, hero });
  }
  done();
  function done() { console.log("SUMMARY " + JSON.stringify(out)); process.exit(out.every(x => x.ok) ? 0 : 1); }
})().catch(e => { console.log("FAIL " + (WHAT || "?") + " " + e.message.slice(0, 300)); process.exit(1); });
