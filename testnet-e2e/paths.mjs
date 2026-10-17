// Wallet-path run on TESTNET: drives the dev app (127.0.0.1:8089/testnet/) through the e2e driver (ui.mjs on :9412),
// one wallet kind at a time, every signing path through the page's own buttons; each transaction is then read back
// from the chain (code, sign mode, messages) and the state it should have changed is checked.
//   node paths.mjs <wallet-name> <keplr|ledger|adena|adena-ledger> [path,path,...]
// Paths: stakepilot stake stake-askpilot mint claim redelegate unstake autopilot-on autopilot-off restake-on restake-off
// governor-follow governor-unfollow vote. Needs: ui.mjs running with the wallet loaded (a throwaway words file from
// `e2e.mjs keyfile`, funded with `e2e.mjs send`), ~10 ATONE and ~1.5 PHOTON per wallet, and for "vote" a proposal in
// voting (`e2e.mjs propose`). Claim needs rewards the page has read: run it a minute after staking.
// First run 2026-10-17: keplr 13/13, ledger 13/13, adena 13/13, adena-ledger 7/7, all code 0; Keplr direct on the
// grant/governor/vote paths, amino everywhere else and for every Ledger and Adena path.
const D = "http://127.0.0.1:9412", API = "https://atomone-testnet-api.gatadao.com", PAGE = "http://127.0.0.1:8089/testnet/";
const [NAME, KIND, ONLY] = process.argv.slice(2);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = async (p, body) => (await fetch(D + p, { method: "POST", body })).json();
const ev = async js => { const r = await post("/eval", js); if (r.error) throw new Error(r.error); return r.value; };
const chain = async p => (await fetch(API + p)).json();
const out = [];
function note(path, ok, info) { out.push({ path, ok, ...info }); console.log((ok ? "PASS " : "FAIL ") + path + "  " + JSON.stringify(info)); }

// in-page helpers: type, click, wait, and the outcome of the next transaction the page sends
const HELP = `window.__e2e = {
  sleep: function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); },
  wait: function(pred, ms, what){ var t0 = Date.now(); return new Promise(function(res, rej){ (function tick(){ var v; try{ v = pred(); }catch(e){}
    if(v) return res(v); if(Date.now() - t0 > (ms || 20000)) return rej(new Error("timeout: " + (what || pred))); setTimeout(tick, 250); })(); }); },
  type: function(id, v){ var a = document.getElementById(id); if(!a) throw new Error("no #" + id); a.value = v; a.dispatchEvent(new Event("input", { bubbles: true })); },
  click: function(sel){ var b = typeof sel === "string" ? document.querySelector(sel) : sel; if(!b) throw new Error("no " + sel); b.click(); return b; },
  vis: function(sel){ var b = document.querySelector(sel); return b && (b.offsetParent || b.closest(".pop.on")) ? b : null; },
  tx: function(n0, ms){ return window.__e2e.wait(function(){ var L = window.__txlog; return L.length > n0 && L[L.length - 1].ok !== undefined ? L[L.length - 1] : null; }, ms || 150000, "the transaction") }
};
(function(){ if(window.__txhook) return; window.__txlog = [];
  ["send", "sendDirect"].forEach(function(fn){ var f = window.__TX[fn];
    window.__TX[fn] = function(w, msgs, memo){ var rec = { fn: fn, types: msgs.map(function(m){ return m.type; }), memo: memo, wallet: w && w.name, direct: !!(w && w.signDirect) };
      window.__txlog.push(rec);
      return f.apply(this, arguments).then(function(r){ rec.ok = true; rec.hash = r && r.hash; rec.height = r && r.height; return r; },
        function(e){ rec.ok = false; rec.err = String(e && e.message || e); throw e; }); }; });
  window.__txhook = true; })();
"ok"`;

async function connect() {
  await post("/use?name=" + NAME); await post("/kind?k=" + KIND);
  await post("/go?url=" + encodeURIComponent(PAGE) + "&wait=6000");
  const wn = /adena/.test(KIND) ? "Adena" : "Keplr";
  const r = await ev(`new Promise(function(res){ window.__wconnect && window.__wconnect(${JSON.stringify(wn)}); var t0 = Date.now();
    (function tick(){ if(window.__ADDR && window.__POS && window.__BAL) return res({ addr: window.__ADDR, wallet: window.__WALLET.name, direct: !!window.__WALLET.signDirect,
      ledger: !!(window.__WALLET.ledger || document.querySelector('.wchip-ledger, [data-ledger]')), bal: window.__BAL });
      if(Date.now() - t0 > 30000) return res({ error: "no connect", addr: window.__ADDR }); setTimeout(tick, 300); })(); })`);
  await ev(HELP);
  return r;
}

// a transaction read back from the chain
async function txOf(hash) {
  for (let k = 0; k < 10; k++) { const d = await chain("/cosmos/tx/v1beta1/txs/" + hash); if (d.tx_response) return d; await sleep(2000); }
  return null;
}
function summary(d) {
  const tr = d.tx_response, si = d.tx.auth_info.signer_infos[0];
  return { code: tr.code, height: tr.height, mode: si.mode_info.single ? si.mode_info.single.mode.replace("SIGN_MODE_", "") : "multi",
    msgs: d.tx.body.messages.map(m => m["@type"].split(".").pop()), memo: d.tx.body.memo, fee: d.tx.auth_info.fee.amount.map(c => c.amount + c.denom).join("+"), gas: tr.gas_used + "/" + tr.gas_wanted };
}
// the expected sign mode per wallet: Keplr signs direct where the page asks for direct; a Ledger and Adena sign amino
const expectMode = fn => (KIND === "keplr" && fn === "sendDirect") ? "DIRECT" : "LEGACY_AMINO_JSON";

async function run(path, pageJs, check, route) {
  if (ONLY && !ONLY.split(",").includes(path)) return;
  let rec;
  try { rec = await ev(`(async function(){ var E = window.__e2e, n0 = window.__txlog.length;
      for(var k = 0; k < 6 && document.querySelector('.pop.on'); k++){ window.__POP.close(document.querySelector('.pop.on')); await E.sleep(300); }
      if(window.__undock) window.__undock();
      window.__shellGo(${JSON.stringify(route || "dashboard/wallet")}); await E.sleep(1800);
      ${pageJs}; return await E.tx(n0); })()`); }
  catch (e) { return note(path, false, { page: e.message.slice(0, 300) }); }
  if (!rec || !rec.ok) return note(path, false, { page: rec && rec.err, types: rec && rec.types });
  const d = await txOf(rec.hash); if (!d) return note(path, false, { hash: rec.hash, chain: "tx not found" });
  const s = summary(d), want = expectMode(rec.fn);
  let extra = {}; try { extra = check ? (await check(d, s)) || {} : {}; } catch (e) { extra = { check: "FAILED " + e.message }; }
  const ok = s.code === 0 && s.mode === want && !String(extra.check || "").startsWith("FAILED");
  note(path, ok, { hash: rec.hash.slice(0, 10), ...s, want, ...extra });
  await sleep(1500);
}

const me = () => ev("window.__ADDR");
const delegs = async a => ((await chain("/cosmos/staking/v1beta1/delegations/" + a)).delegation_responses || []).map(x => ({ v: x.delegation.validator_address, x: +x.balance.amount }));
const bal = async (a, dn) => +(((await chain("/cosmos/bank/v1beta1/balances/" + a)).balances || []).find(b => b.denom === dn) || { amount: 0 }).amount;

(async () => {
  const c = await connect(); console.log("connected", JSON.stringify(c));
  if (c.error) process.exit(1);
  const A = c.addr;

  // testnet: ranks 7 to 43 hold the same stake, so the shelf rule finds no place at all; for the signing paths a plan of
  // three legs on three of the smallest stands in (the page's planner, not its signing, is what is replaced)
  if ((await ev("window.__pilotPlan(2e6)")) === null) await ev(`(function(){ var real = window.__pilotPlan;
    window.__pilotPlan = function(u){ var r = real(u); if(r) return r; var V = window.__VALS(), n = V.length, legs = [], x = Math.floor(u / 3);
      [n - 6, n - 5, n - 4].forEach(function(q, i){ var v = V[q]; legs.push({ id: v[3], m: v[0], rank: q + 1, t: v[1], c: v[2], x: i === 2 ? u - 2 * x : x, after: window.__rateAfter(v[1], v[2], x) }); });
      return { legs: legs, staked: u, left: 0, rate: legs[0].after, earned: u * legs[0].after, big: 0, bigName: "", standIn: true }; }; return 1; })()`);
  await run("stakepilot", `E.click('[data-act=stake]'); await E.wait(function(){ return E.vis('#spamt'); }, 15000, 'StakePilot card');
    E.type('spamt', '2'); await E.wait(function(){ var b = document.getElementById('spsign'); return b && !b.disabled; }, 30000, 'StakePilot sign enabled');
    E.click('#spsign')`, async (d, s) => {
    const tot = d.tx.body.messages.reduce((t, m) => t + +m.amount.amount, 0);
    return { staked: tot / 1e6, check: tot === 2e6 && s.msgs.every(m => m === "MsgDelegate") ? "ok" : "FAILED total " + tot };
  });

  // 2 Stake, picked by hand: one validator ticked
  await run("stake", `E.click('#stbtn'); await E.wait(function(){ return E.vis('#stamt'); }, 15000, 'Stake card');
    E.type('stamt', '1'); await E.sleep(300); E.click('#stlist tbody input[data-id]'); await E.wait(function(){ var b = document.getElementById('stsign'); return b && !b.disabled; }, 30000, 'Stake enabled');
    E.click('#stsign')`, async (d, s) => ({ check: s.msgs.length === 1 && s.msgs[0] === "MsgDelegate" && d.tx.body.messages[0].amount.amount === "1000000" ? "ok" : "FAILED" }));

  // 3 Stake with Ask Pilot
  await run("stake-askpilot", `E.click('#stbtn'); await E.wait(function(){ return E.vis('#stamt'); }, 15000, 'Stake card');
    E.click('#stask'); E.type('stamt', '2'); await E.wait(function(){ var b = document.getElementById('stsign'); return b && !b.disabled; }, 30000, 'Stake enabled');
    E.click('#stsign')`, async (d, s) => {
    const tot = d.tx.body.messages.reduce((t, m) => t + +m.amount.amount, 0);
    return { legs: s.msgs.length, check: tot === 2e6 && s.msgs.every(m => m === "MsgDelegate") ? "ok" : "FAILED total " + tot };
  });

  // 4 Mint PHOTON (fee in ATONE)
  const ph0 = await bal(A, "uphoton");
  await run("mint", `E.click('[data-act=mint]'); await E.wait(function(){ return E.vis('#mtamt'); }, 15000, 'Mint card');
    E.type('mtamt', '1'); await E.wait(function(){ var b = document.getElementById('mtsign'); return b && !b.disabled; }, 30000, 'Mint enabled');
    E.click('#mtsign')`, async (d, s) => {
    const ph1 = await bal(A, "uphoton");
    return { photon: (ph0 / 1e6).toFixed(3) + " -> " + (ph1 / 1e6).toFixed(3), check: s.msgs[0] === "MsgMintPhoton" && /uatone/.test(s.fee) ? "ok" : "FAILED" };
  });

  // 5 Claim rewards
  await run("claim", `await E.sleep(8000); window.__claim(); await E.wait(function(){ return E.vis('#clsign'); }, 15000, 'Claim card');
    await E.wait(function(){ var b = document.getElementById('clsign'); return b && !b.disabled; }, 30000, 'Claim enabled');
    E.click('#clsign')`, async (d, s) => ({ check: s.msgs.length >= 1 && s.msgs.every(m => m === "MsgWithdrawDelegatorReward") ? "ok" : "FAILED" }));

  // 6 Redelegate in Pro: 0.4 ATONE from what is staked to one more validator
  await run("redelegate", `E.type('amt', '0.4'); await E.sleep(600);
    var c = [].slice.call(document.querySelectorAll('#dpicks tbody input[data-id]')).filter(function(x){ return !x.checked; })[3]; E.click(c);
    await E.wait(function(){ var b = document.getElementById('dgo'); return b && !b.disabled; }, 30000, 'Redelegate enabled'); E.click('#dgo');
    await E.wait(function(){ return E.vis('#txsign'); }, 15000, 'Redelegate card'); await E.sleep(1500); E.click('#txsign')`,
    async (d, s) => ({ check: s.msgs.length >= 1 && s.msgs.every(m => m === "MsgBeginRedelegate") ? "ok" : "FAILED" }), "dashboard/self");

  // 7 Unstake 0.3 ATONE from the largest delegation
  await run("unstake", `E.click('#unbtn'); await E.wait(function(){ return E.vis('#unamt'); }, 15000, 'Unstake card');
    E.type('unamt', '0.3'); await E.wait(function(){ var b = document.getElementById('unsign'); return b && !b.disabled; }, 30000, 'Unstake enabled');
    E.click('#unsign')`, async (d, s) => {
    const u = (await chain("/cosmos/staking/v1beta1/delegators/" + A + "/unbonding_delegations")).unbonding_responses || [];
    return { unbonding: u.length, check: s.msgs[0] === "MsgUndelegate" && u.length ? "ok" : "FAILED" };
  });

  // 8 Autopilot on, then off (revoke)
  const grants = async () => ((await chain("/cosmos/authz/v1beta1/grants/granter/" + A)).grants || []).map(g => (g.authorization["@type"] || "").split(".").pop() + ":" + (g.authorization.authorization_type || g.authorization.msg || ""));
  await run("autopilot-on", `E.click('[data-act=youauto]'); await E.wait(function(){ return E.vis('#atgrant'); }, 15000, 'Autopilot card');
    await E.wait(function(){ var b = document.getElementById('atgrant'); return b && !b.disabled; }, 30000, 'Activate enabled'); E.click('#atgrant')`,
    async (d, s) => { const g = await grants(); return { grants: g, check: s.msgs[0] === "MsgGrant" && g.some(x => /REDELEGATE/.test(x)) ? "ok" : "FAILED" }; });
  await run("autopilot-off", `E.click('[data-act=youauto]'); await E.wait(function(){ return E.vis('#atrevoke') && !document.getElementById('atrevoke').hidden; }, 15000, 'Revoke button');
    E.click('#atrevoke')`,
    async (d, s) => { const g = await grants(); return { grants: g, check: s.msgs[0] === "MsgRevoke" && !g.some(x => /REDELEGATE/.test(x)) ? "ok" : "FAILED" }; });

  // 9 Restake on, then off
  await run("restake-on", `E.click('[data-act=restakesw]'); await E.wait(function(){ return E.vis('#rsgo'); }, 15000, 'Restake card');
    await E.wait(function(){ var b = document.getElementById('rsgo'); return b && !b.disabled; }, 30000, 'Restake enabled'); E.click('#rsgo')`,
    async (d, s) => { const g = await grants(); return { grants: g, check: g.some(x => /DELEGATE$/.test(x)) && g.some(x => /WithdrawDelegatorReward/.test(x)) ? "ok" : "FAILED" }; });
  await run("restake-off", `E.click('[data-act=restakesw]'); await E.sleep(2500);
    var b = E.vis('#rsgo'); if(b){ await E.wait(function(){ return !b.disabled; }, 30000, 'Restake off enabled'); E.click(b); }`,
    async (d, s) => { const g = await grants(); return { grants: g, check: s.msgs.every(m => m === "MsgRevoke") && !g.length ? "ok" : "FAILED" }; });

  // 10 a governor: follow the first active one, then stop following
  await run("governor-follow", `document.querySelector('tr.gvt-r[data-gv]').click(); await E.wait(function(){ return E.vis('[data-act=gfollow]'); }, 15000, 'Follow button');
    E.click(E.vis('[data-act=gfollow]'))`,
    async (d, s) => ({ check: s.msgs[0] === "MsgDelegateGovernor" ? "ok" : "FAILED " + s.msgs[0] }), "governance/governors");
  // the page reads the following again 7 s after a follow lands
  await run("governor-unfollow", `await E.sleep(9000); var r = [].slice.call(document.querySelectorAll('tr.gvt-r[data-gv]')); var hit = null;
    for(var i = 0; i < r.length && !hit; i++){ r[i].click(); await E.sleep(1200); hit = E.vis('[data-act=gstop]'); if(!hit){ window.__POP.close(document.querySelector('.pop.on')); await E.sleep(400); } }
    if(!hit) throw new Error('no Unfollow on any governor'); E.click(hit)`,
    async (d, s) => ({ check: s.msgs[0] === "MsgUndelegateGovernor" ? "ok" : "FAILED " + s.msgs[0] }), "governance/governors");

  // 11 vote on the open testnet proposal
  await run("vote", `var row = document.querySelector('.gpx-r[data-gp]'); var pid = row.dataset.gp; row.click();
    await E.wait(function(){ return document.querySelector('[data-act=vote][data-pid="' + pid + '"]'); }, 20000, 'vote buttons');
    var bs = [].slice.call(document.querySelectorAll('[data-act=vote][data-pid="' + pid + '"]')); E.click(bs.filter(function(b){ return !b.classList.contains('on'); })[0])`,
    async (d, s) => { const m = d.tx.body.messages[0]; const v = await chain("/atomone/gov/v1/proposals/" + m.proposal_id + "/votes/" + A);
      return { proposal: m.proposal_id, option: m.option, recorded: v.vote && v.vote.options.map(o => o.option).join(","), check: s.msgs[0] === "MsgVote" && v.vote ? "ok" : "FAILED" }; }, "governance/proposals");

  console.log("SUMMARY " + JSON.stringify(out));
  process.exit(out.every(x => x.ok) ? 0 : 1);
})();
