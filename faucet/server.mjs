// AtomOne TESTNET faucet - runs on the app box, testnet only (atomone-testnet-1; any other chain: refuse to start).
//
// Sends from the testnet Autopilot account (the operator's choice: the one testnet key on this box), read from
// the same sealed systemd credential the testnet signer uses. It is NOT the signer: its own user, unit and
// port, and the signer's code still refuses any send. Mainnet has no faucet and never will from this code.
//
//   GET  /faucet-api/status                    -> { address, chain_id, atone, photon, give, reserve }
//   POST /faucet-api/request {address, token}  -> { txhash }     token: "atone" (10) | "photon" (1), each once per 24 hours
//
// Rules: each address gets each token ONCE; an IP makes at most IP_DAY requests a day; a reserve of each
// token always stays (the Autopilot signer pays its fees in PHOTON from this account). One send at a time,
// at most QUEUE_MAX waiting. A POST is JSON from the app's own pages only (audit 2026-09-30).
//
//   node server.mjs --mint-half   one-off: burn half the account's ATONE for PHOTON (MsgMintPhoton), then exit
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { DirectSecp256k1HdWallet, Registry } from "@cosmjs/proto-signing";
import { SigningStargateClient, GasPrice, defaultRegistryTypes, TimeoutError } from "@cosmjs/stargate";
import { fromBech32 } from "@cosmjs/encoding";
import { BinaryWriter } from "cosmjs-types/binary";
import { Coin } from "cosmjs-types/cosmos/base/v1beta1/coin";

const CHAIN_ID = "atomone-testnet-1", PREFIX = "atone";
const RPC = process.env.ATOMONE_RPC || "https://atomone-testnet-rpc.gatadao.com";
const GAS = process.env.ATOMONE_GAS_PRICE || "0.03uphoton";
const BIND = process.env.BIND || "127.0.0.1", PORT = +(process.env.PORT || 8791);
const STATE = path.join(process.env.STATE_DIRECTORY || "/var/lib/atomone-faucet", "claims.json");
const GIVE = { atone: { denom: "uatone", amount: 10_000_000 }, photon: { denom: "uphoton", amount: 1_000_000 } };   // 10 ATONE, 1 PHOTON (operator, 2026-09-30)
const WINDOW = 24 * 3600 * 1000;                                                    // each token once per address per 24 hours
const recent = (c) => c && typeof c === "object" && Date.now() - (c.at || 0) < WINDOW;
const RESERVE = { uatone: 1_000_000_000, uphoton: 100_000_000 };          // 1,000 ATONE and 100 PHOTON always stay
const IP_DAY = +(process.env.IP_DAY || 4);
const FEE_EST = 10_000n;                                                   // 0.01 PHOTON: a send's fee, over-estimated (~0.003 today)
const QUEUE_MAX = 20;                                                      // requests waiting for the one sender
const ORIGINS = new Set(["https://atomone.gatahub.zone", "https://dev-atomone.gatahub.zone", "http://127.0.0.1:8089"]);   // the last: the loopback test harness

// MsgMintPhoton{to_address(1), amount(2)} - AtomOne's own message, not in cosmjs' registry
const MINT_URL = "/atomone.photon.v1.MsgMintPhoton";
const MsgMintPhoton = {
  encode(m, w = BinaryWriter.create()) { if (m.toAddress) w.uint32(10).string(m.toAddress); if (m.amount) Coin.encode(m.amount, w.uint32(18).fork()).ldelim(); return w; },
  decode() { throw new Error("not needed"); }, fromPartial(m) { return m; },
};

function cred(name) {
  const dir = process.env.CREDENTIALS_DIRECTORY;
  if (!dir) throw new Error("no CREDENTIALS_DIRECTORY - run under the unit");
  return fs.readFileSync(path.join(dir, name), "utf8").trim();
}
const log = (...a) => console.log("faucet:", ...a);

async function client() {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(cred("autopilot_mnemonic"), { prefix: PREFIX });
  const [acc] = await wallet.getAccounts();
  const registry = new Registry([...defaultRegistryTypes, [MINT_URL, MsgMintPhoton]]);
  const c = await SigningStargateClient.connectWithSigner(RPC, wallet, { gasPrice: GasPrice.fromString(GAS), registry });
  const id = await c.getChainId();
  if (id !== CHAIN_ID) throw new Error("refusing to run on " + id + ": this faucet is testnet only");
  return { c, from: acc.address };
}
async function balances(c, a) { const b = {}; for (const x of await c.getAllBalances(a)) b[x.denom] = BigInt(x.amount); return b; }

if (process.argv.includes("--mint-half")) {
  const { c, from } = await client();
  const b = await balances(c, from), half = (b.uatone || 0n) / 2n;
  if (half <= 0n) { log("no ATONE to convert"); process.exit(1); }
  const msg = { typeUrl: MINT_URL, value: { toAddress: from, amount: { denom: "uatone", amount: half.toString() } } };
  const r = await c.signAndBroadcast(from, [msg], "auto", "");
  log("mint", half.toString(), "uatone -> code", r.code, "tx", r.transactionHash, r.code ? r.rawLog : "");
  const a = await balances(c, from); log("now", String(a.uatone || 0n), "uatone,", String(a.uphoton || 0n), "uphoton");
  process.exit(r.code ? 1 : 0);
}

const S = (() => { try { return JSON.parse(fs.readFileSync(STATE, "utf8")); } catch { return { claims: {}, ips: {} }; } })();
function save() {
  // claims older than the window and other days' IP counts are dropped here (audit 2026-09-30)
  const day = new Date().toISOString().slice(0, 10);
  for (const a of Object.keys(S.claims)) {
    const cl = S.claims[a];
    for (const t of Object.keys(cl || {})) if (!recent(cl[t])) delete cl[t];
    if (!cl || !Object.keys(cl).length) delete S.claims[a];
  }
  for (const x of Object.keys(S.ips)) if (!x.startsWith(day)) delete S.ips[x];
  const t = STATE + ".tmp"; fs.writeFileSync(t, JSON.stringify(S)); fs.renameSync(t, STATE);
}
// prefix, charset and length, then the bech32 checksum and a 20-byte account (audit 2026-09-30)
const isAcc = s => {
  if (typeof s !== "string" || !/^atone1[02-9ac-hj-np-z]{38}$/.test(s)) return false;
  // an explicit limit: this @scure/base throws on fromBech32's default (Infinity) for every address
  try { const d = fromBech32(s, 90); return d.prefix === PREFIX && d.data.length === 20; } catch { return false; }
};
let chain = Promise.resolve(), pending = 0;
const serial = fn => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };
const fail = (status, msg) => Object.assign(new Error(msg), { status });
const { c, from } = await client();
log("testnet faucet sending from", from, "on", BIND + ":" + PORT);

function body(req) {
  return new Promise((res, rej) => {
    if (+(req.headers["content-length"] || 0) > 4096) return rej(fail(413, "too large"));
    let d = "", over = false;
    req.on("data", x => { if (over) return; d += x; if (d.length > 4096) { over = true; rej(fail(413, "too large")); } });
    req.on("end", () => { if (!over) res(d); }); req.on("error", rej);
  });
}
function json(s) {
  let o; try { o = JSON.parse(s || "{}"); } catch { throw fail(400, "bad json"); }
  if (!o || typeof o !== "object" || Array.isArray(o)) throw fail(400, "not an object");
  return o;
}

http.createServer(async (req, res) => {
  const send = (code, o, more) => { if (res.headersSent) return; res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store", ...more }); res.end(JSON.stringify(o)); };
  try {
    if (req.method === "GET" && req.url === "/faucet-api/status") {
      const b = await balances(c, from);
      return send(200, { address: from, chain_id: CHAIN_ID, atone: String(b.uatone || 0n), photon: String(b.uphoton || 0n),
                         give: { atone: GIVE.atone.amount, photon: GIVE.photon.amount } });
    }
    if (req.method === "GET" && req.url.startsWith("/faucet-api/claimed?address=")) {
      const a = decodeURIComponent(req.url.split("=")[1] || "");
      const cl = S.claims[a] || {}, out = {};
      for (const t of ["atone", "photon"]) { const c = cl[t]; out[t] = !!recent(c); if (recent(c)) { out[t + "_tx"] = c.tx || null; out[t + "_next"] = c.at + WINDOW; } }
      return send(200, out);
    }
    if (req.method !== "POST" || req.url !== "/faucet-api/request") return send(404, { error: "not found" });
    // a third-party page may not spend a visitor's IP quota: JSON only, and only from the app's own pages (audit 2026-09-30)
    if (String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase() !== "application/json") return send(415, { error: "Send JSON." });
    if (req.headers.origin !== undefined && !ORIGINS.has(req.headers.origin)) return send(403, { error: "Not from here." });
    const { address, token } = json(await body(req));
    if (!isAcc(address)) return send(400, { error: "That is not an atone1 address." });
    if (typeof token !== "string" || !Object.hasOwn(GIVE, token)) return send(400, { error: "Ask for atone or photon." });
    if (address === from) return send(400, { error: "That is the faucet's own address." });
    if (pending >= QUEUE_MAX) return send(503, { error: "The faucet is busy, try again shortly." });
    const ip = String(req.headers["x-real-ip"] || req.socket.remoteAddress || "");
    pending++;
    try {
      return await serial(async () => {
        const prev = (S.claims[address] || {})[token];
        if (recent(prev)) return send(409, { error: "This address already received " + token.toUpperCase() + " in the last 24 hours. Again after " + new Date(prev.at + WINDOW).toISOString().slice(11, 16) + " UTC." });
        const day = new Date().toISOString().slice(0, 10), k = day + " " + ip;
        if ((S.ips[k] || 0) >= IP_DAY) return send(429, { error: "Too many requests from here today. Try tomorrow." });
        const g = GIVE[token], b = await balances(c, from);
        // the fee is paid in PHOTON whatever is sent, so the PHOTON reserve is checked for every send (audit 2026-09-30)
        const ph = (b.uphoton || 0n) - FEE_EST - (g.denom === "uphoton" ? BigInt(g.amount) : 0n);
        if ((b[g.denom] || 0n) - BigInt(g.amount) < BigInt(RESERVE[g.denom]) || ph < BigInt(RESERVE.uphoton))
          return send(503, { error: "The faucet is empty for " + token.toUpperCase() + " right now." });
        // the attempt counts from here, paid or not (audit 2026-09-30)
        S.ips[k] = (S.ips[k] || 0) + 1; save();
        let r;
        try { r = await c.sendTokens(from, address, [{ denom: g.denom, amount: String(g.amount) }], "auto", ""); }
        catch (e) {
          // broadcast but not seen in time: it may still land, so the address counts as paid (audit 2026-09-30)
          if (e instanceof TimeoutError && e.txId) {
            (S.claims[address] = S.claims[address] || {})[token] = { at: Date.now(), tx: e.txId, unconfirmed: true }; save();
            log("sent (not yet seen on chain)", g.amount, g.denom, "to", address, e.txId);
            return send(202, { txhash: e.txId, pending: true });
          }
          throw e;
        }
        log("sent", g.amount, g.denom, "to", address, "code", r.code, r.transactionHash);
        if (r.code) { log("refused by the chain:", String(r.rawLog || "").slice(0, 300)); return send(502, { error: "The chain refused the transaction. Try again later." }); }
        (S.claims[address] = S.claims[address] || {})[token] = { at: Date.now(), tx: r.transactionHash };
        save();
        return send(200, { txhash: r.transactionHash });
      });
    } finally { pending--; }
  } catch (e) {
    log("error", e.status ? e.message : (e && e.stack) || e);
    // fixed texts only: the detail stays in the journal (audit 2026-09-30)
    if (e.status === 413) return send(413, { error: "Too large." }, { connection: "close" });
    if (e.status === 400) return send(400, { error: "Send a JSON object." });
    return send(500, { error: "Something went wrong. Try again later." });
  }
}).listen(PORT, BIND);
