// TESTNET browser driver: the real page in headless Chrome with a stand-in Keplr whose keys stay in this
// process. The page calls window.keplr exactly as it calls the extension (enable, getKey, signDirect with the
// account number as a Long-like object, signAmino, signArbitrary); each signing request crosses a DevTools
// binding to here, is signed with cosmjs, and the result goes back. Nothing is broadcast from here: the page
// broadcasts through its own code, so the page's own signing path is what gets tested.
//
// Run as a transient unit so the sealed words load as credentials (never printed, never on disk in clear):
//   systemd-run --quiet --unit=atomone-ui-e2e -p WorkingDirectory=$PWD \
//     -p LoadCredentialEncrypted=e2e_mnemonic:/etc/atomone-autopilot-testnet/e2e-wallet.cred \
//     -p LoadCredentialEncrypted=autopilot_mnemonic:/etc/atomone-autopilot-testnet/mnemonic.cred \
//     /usr/bin/node --experimental-websocket $PWD/ui.mjs [extra-key-file ...]
// then drive it on 127.0.0.1:9412 (loopback only):
//   GET  /wallets                       the loaded keys: name -> address
//   POST /use?name=<wallet>             which key the stand-in Keplr exposes (fires keplr_keystorechange)
//   POST /go?url=<url>                  load a page (the stand-in is installed before any page script)
//   POST /eval       body: JS           evaluate in the page (awaits promises), JSON result
//   POST /shot?path=<png>&w=&h=         screenshot
//   POST /dialog?accept=1|0            answer confirm() dialogs (default accept; each is logged)
//   GET  /log                           signing requests seen, and page console errors
//   POST /quit
// Extra key files (0600, words only) load as wallets named after the file.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { Secp256k1HdWallet, serializeSignDoc } from "@cosmjs/amino";
import { toBase64, fromBase64, toBech32, fromBech32 } from "@cosmjs/encoding";

const CHAINS = ["atomone-testnet-1"], PORT = 9412;
const W = {};
async function load(name, words) {
  const d = await DirectSecp256k1HdWallet.fromMnemonic(words, { prefix: "atone" });
  const a = await Secp256k1HdWallet.fromMnemonic(words, { prefix: "atone" });
  const [acc] = await d.getAccounts(); W[name] = { d, a, acc };
}
const CD = process.env.CREDENTIALS_DIRECTORY;
for (const n of ["e2e_mnemonic", "autopilot_mnemonic"]) if (CD && fs.existsSync(CD + "/" + n)) await load(n === "e2e_mnemonic" ? "test" : "operator", fs.readFileSync(CD + "/" + n, "utf8").trim());
for (const f of process.argv.slice(2)) await load(path.basename(f).replace(/\.key$/, ""), fs.readFileSync(f, "utf8").trim());
let cur = Object.keys(W)[0], DIALOG = true;
const LOG = [];

// ── Chrome over the DevTools protocol ──
const DP = 9500 + Math.floor(Math.random() * 400), dir = fs.mkdtempSync(path.join(os.tmpdir(), "ui-e2e-"));
const chrome = spawn("google-chrome", ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--remote-debugging-port=" + DP,
  "--user-data-dir=" + dir, "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let tgt; for (let i = 0; i < 50 && !tgt; i++) { await sleep(200); try { tgt = (await (await fetch(`http://127.0.0.1:${DP}/json`)).json()).find(t => t.type === "page"); } catch {} }
const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = {};
function cdp(method, params = {}) { return new Promise((res, rej) => { const i = ++id; pend[i] = { res, rej }; ws.send(JSON.stringify({ id: i, method, params })); }); }
ws.onmessage = async ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pend[m.id]) { const p = pend[m.id]; delete pend[m.id]; m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); return; }
  if (m.method === "Runtime.bindingCalled" && m.params.name === "__kbridge") bridge(JSON.parse(m.params.payload));
  if (m.method === "Page.javascriptDialogOpening") { LOG.push({ t: Date.now(), dialog: m.params.type, text: m.params.message }); cdp("Page.handleJavaScriptDialog", { accept: DIALOG }); }
  if (m.method === "Runtime.exceptionThrown") LOG.push({ t: Date.now(), err: m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text });
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") LOG.push({ t: Date.now(), console: m.params.args.map(a => a.value ?? a.description).join(" ") });
};
await cdp("Page.enable"); await cdp("Runtime.enable");
await cdp("Runtime.addBinding", { name: "__kbridge" });

// the stand-in Keplr, in the page: every call becomes a bridge request answered by bridge() below
const STANDIN = `(function(){
  var n = 0, wait = {};
  window.__kreply = function(i, ok, v){ var w = wait[i]; delete wait[i]; if(w) ok ? w.res(v) : w.rej(new Error(v)); };
  function ask(op, args){ return new Promise(function(res, rej){ var i = ++n; wait[i] = { res: res, rej: rej }; __kbridge(JSON.stringify({ i: i, op: op, args: args })); }); }
  function b64(u){ var s = ""; for(var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
  function unb64(s){ var b = atob(s), u = new Uint8Array(b.length); for(var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  window.keplr = {
    version: "0.12-standin", mode: "extension",
    enable: function(c){ return ask("enable", [c]); },
    experimentalSuggestChain: function(){ return Promise.resolve(); },
    getKey: function(c){ return ask("getKey", [c]).then(function(k){ k.pubKey = unb64(k.pubKey); k.address = unb64(k.address); return k; }); },
    /* as the extension's injected script: the account number is turned into text with toString() */
    signDirect: function(c, signer, doc){ return ask("signDirect", [c, signer, { bodyBytes: b64(doc.bodyBytes), authInfoBytes: b64(doc.authInfoBytes), chainId: doc.chainId, accountNumber: doc.accountNumber.toString() }])
      .then(function(r){ r.signed.bodyBytes = unb64(r.signed.bodyBytes); r.signed.authInfoBytes = unb64(r.signed.authInfoBytes); return r; }); },
    signAmino: function(c, signer, doc){ return ask("signAmino", [c, signer, doc]); },
    signArbitrary: function(c, signer, data){ return ask("signArbitrary", [c, signer, data]); },
    getOfflineSigner: function(){ throw new Error("stand-in: not used by the page"); }
  };
})();`;
await cdp("Page.addScriptToEvaluateOnNewDocument", { source: STANDIN });

async function reply(i, ok, v) { await cdp("Runtime.evaluate", { expression: `window.__kreply(${i}, ${ok}, ${JSON.stringify(v)})` }); }
async function bridge({ i, op, args }) {
  const w = W[cur], me = w.acc.address;
  try {
    if (!CHAINS.includes(args[0])) throw new Error("stand-in signs testnet only, not " + args[0]);
    if (op !== "enable" && op !== "getKey" && args[1] !== me) throw new Error("signer is not the selected key");
    let out;
    if (op === "enable") out = null;
    else if (op === "getKey") out = { name: cur, algo: "secp256k1", pubKey: toBase64(w.acc.pubkey), address: toBase64(fromBech32(me, 90).data), bech32Address: me, isNanoLedger: false };
    else if (op === "signDirect") {
      const d = args[2];
      const r = await w.d.signDirect(me, { bodyBytes: fromBase64(d.bodyBytes), authInfoBytes: fromBase64(d.authInfoBytes), chainId: d.chainId, accountNumber: BigInt(d.accountNumber) });
      out = { signed: { bodyBytes: toBase64(r.signed.bodyBytes), authInfoBytes: toBase64(r.signed.authInfoBytes), chainId: r.signed.chainId, accountNumber: String(r.signed.accountNumber) }, signature: r.signature };
    } else if (op === "signAmino") out = await w.a.signAmino(me, args[2]);
    else if (op === "signArbitrary") {
      const data = typeof args[2] === "string" ? Buffer.from(args[2]).toString("base64") : toBase64(Uint8Array.from(Object.values(args[2])));
      const doc = { chain_id: "", account_number: "0", sequence: "0", fee: { gas: "0", amount: [] }, memo: "", msgs: [{ type: "sign/MsgSignData", value: { signer: me, data } }] };
      out = (await w.a.signAmino(me, doc)).signature;
    } else throw new Error("unknown " + op);
    LOG.push({ t: Date.now(), wallet: cur, op, ok: true });
    await reply(i, true, out);
  } catch (e) { LOG.push({ t: Date.now(), wallet: cur, op, ok: false, err: e.message }); await reply(i, false, e.message); }
}

// ── the control port ──
const body = req => new Promise(r => { let b = ""; req.on("data", c => b += c); req.on("end", () => r(b)); });
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"), q = k => u.searchParams.get(k), send = (c, o) => { res.writeHead(c, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  try {
    if (u.pathname === "/wallets") return send(200, Object.fromEntries(Object.entries(W).map(([k, v]) => [k, v.acc.address])));
    if (u.pathname === "/use") { if (!W[q("name")]) return send(404, { error: "no such wallet" }); cur = q("name");
      await cdp("Runtime.evaluate", { expression: "window.dispatchEvent(new Event('keplr_keystorechange'))" }); return send(200, { use: cur, address: W[cur].acc.address }); }
    if (u.pathname === "/go") { await cdp("Page.navigate", { url: q("url") }); await sleep(+(q("wait") || 4000)); return send(200, { ok: true }); }
    if (u.pathname === "/eval") { const r = await cdp("Runtime.evaluate", { expression: await body(req), awaitPromise: true, returnByValue: true });
      return send(200, r.exceptionDetails ? { error: r.exceptionDetails.exception?.description || r.exceptionDetails.text } : { value: r.result.value }); }
    if (u.pathname === "/shot") { const w = +(q("w") || 1440), h = +(q("h") || 900);
      await cdp("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
      const r = await cdp("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(q("path"), Buffer.from(r.data, "base64")); return send(200, { ok: true }); }
    if (u.pathname === "/dialog") { DIALOG = q("accept") !== "0"; return send(200, { accept: DIALOG }); }
    if (u.pathname === "/log") return send(200, LOG.slice(-60));
    if (u.pathname === "/quit") { send(200, { bye: true }); chrome.kill(); fs.rmSync(dir, { recursive: true, force: true }); setTimeout(() => process.exit(0), 200); return; }
    send(404, { error: "unknown" });
  } catch (e) { send(500, { error: e.message }); }
}).listen(PORT, "127.0.0.1");
console.log("ui-e2e ready on 127.0.0.1:" + PORT, Object.keys(W).join(","));
