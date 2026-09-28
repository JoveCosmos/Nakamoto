// AtomOne TESTNET faucet - runs on the app box, testnet only (atomone-testnet-1; any other chain: refuse to start).
//
// Sends from the testnet Autopilot account (the operator's choice: the one testnet key on this box), read from
// the same sealed systemd credential the testnet signer uses. It is NOT the signer: its own user, unit and
// port, and the signer's code still refuses any send. Mainnet has no faucet and never will from this code.
//
//   GET  /faucet-api/status                    -> { address, chain_id, atone, photon, give, reserve }
//   POST /faucet-api/request {address, token}  -> { txhash }     token: "atone" (100) | "photon" (10)
//
// Rules: each address gets each token ONCE; an IP makes at most IP_DAY requests a day; a reserve of each
// token always stays (the Autopilot signer pays its fees in PHOTON from this account). One send at a time.
//
//   node server.mjs --mint-half   one-off: burn half the account's ATONE for PHOTON (MsgMintPhoton), then exit
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { DirectSecp256k1HdWallet, Registry } from "@cosmjs/proto-signing";
import { SigningStargateClient, GasPrice, defaultRegistryTypes } from "@cosmjs/stargate";
import { BinaryWriter } from "cosmjs-types/binary";
import { Coin } from "cosmjs-types/cosmos/base/v1beta1/coin";

const CHAIN_ID = "atomone-testnet-1", PREFIX = "atone";
const RPC = process.env.ATOMONE_RPC || "https://atomone-testnet-rpc.gatadao.com";
const GAS = process.env.ATOMONE_GAS_PRICE || "0.03uphoton";
const BIND = process.env.BIND || "127.0.0.1", PORT = +(process.env.PORT || 8791);
const STATE = path.join(process.env.STATE_DIRECTORY || "/var/lib/atomone-faucet", "claims.json");
const GIVE = { atone: { denom: "uatone", amount: 100_000_000 }, photon: { denom: "uphoton", amount: 10_000_000 } };
const RESERVE = { uatone: 1_000_000_000, uphoton: 100_000_000 };          // 1,000 ATONE and 100 PHOTON always stay
const IP_DAY = +(process.env.IP_DAY || 4);

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
function save() { const t = STATE + ".tmp"; fs.writeFileSync(t, JSON.stringify(S)); fs.renameSync(t, STATE); }
const isAcc = s => typeof s === "string" && /^atone1[02-9ac-hj-np-z]{38}$/.test(s);
let chain = Promise.resolve(); const serial = fn => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };
const { c, from } = await client();
log("testnet faucet sending from", from, "on", BIND + ":" + PORT);

function body(req) { return new Promise((res, rej) => { let d = ""; req.on("data", x => { d += x; if (d.length > 4096) { rej(new Error("too large")); req.destroy(); } }); req.on("end", () => res(d)); req.on("error", rej); }); }

http.createServer(async (req, res) => {
  const send = (code, o) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(o)); };
  try {
    if (req.method === "GET" && req.url === "/faucet-api/status") {
      const b = await balances(c, from);
      return send(200, { address: from, chain_id: CHAIN_ID, atone: String(b.uatone || 0n), photon: String(b.uphoton || 0n),
                         give: { atone: GIVE.atone.amount, photon: GIVE.photon.amount } });
    }
    if (req.method === "GET" && req.url.startsWith("/faucet-api/claimed?address=")) {
      const a = decodeURIComponent(req.url.split("=")[1] || "");
      return send(200, { atone: !!(S.claims[a] || {}).atone, photon: !!(S.claims[a] || {}).photon });
    }
    if (req.method !== "POST" || req.url !== "/faucet-api/request") return send(404, { error: "not found" });
    const { address, token } = JSON.parse(await body(req) || "{}");
    if (!isAcc(address)) return send(400, { error: "That is not an atone1 address." });
    if (!GIVE[token]) return send(400, { error: "Ask for atone or photon." });
    if (address === from) return send(400, { error: "That is the faucet's own address." });
    const ip = String(req.headers["x-real-ip"] || req.socket.remoteAddress || ""), day = new Date().toISOString().slice(0, 10);
    return await serial(async () => {
      if ((S.claims[address] || {})[token]) return send(409, { error: "This address already received its " + token.toUpperCase() + "." });
      const k = day + " " + ip; if ((S.ips[k] || 0) >= IP_DAY) return send(429, { error: "Too many requests from here today. Try tomorrow." });
      const g = GIVE[token], b = await balances(c, from);
      if ((b[g.denom] || 0n) - BigInt(g.amount) < BigInt(RESERVE[g.denom])) return send(503, { error: "The faucet is empty for " + token.toUpperCase() + " right now." });
      const r = await c.sendTokens(from, address, [{ denom: g.denom, amount: String(g.amount) }], "auto", "");
      log("sent", g.amount, g.denom, "to", address, "code", r.code, r.transactionHash);
      if (r.code) return send(502, { error: "The chain refused it: " + (r.rawLog || r.code) });
      (S.claims[address] = S.claims[address] || {})[token] = { at: Date.now(), tx: r.transactionHash };
      S.ips[k] = (S.ips[k] || 0) + 1;
      for (const x of Object.keys(S.ips)) if (!x.startsWith(day)) delete S.ips[x];
      save();
      return send(200, { txhash: r.transactionHash });
    });
  } catch (e) {
    log("error", e.message || e);
    return send(500, { error: "Something went wrong: " + String(e.message || e).slice(0, 200) });
  }
}).listen(PORT, BIND);
