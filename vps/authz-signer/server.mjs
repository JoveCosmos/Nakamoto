// GATA authz signer - RUNS ON THE SIGNER VPS, on its own key, on its own port.
//
// One job: execute redelegations that AtomOne delegators have AUTHORISED this
// account to make on their behalf (x/authz StakeAuthorization, REDELEGATE), inside
// the bounds each grant carries - the chain enforces the allow-list, the cap and
// the expiry; this service only signs MsgExec{MsgBeginRedelegate...} and nothing
// else. It cannot send coins, cannot grant, cannot delegate. Fees are PHOTON from
// this account's own balance.
//
// Independent of the payout signer: a different mnemonic, a different secret, a
// different unit and port. Compromise of one does not reach the other.
//
//   GET  /whoami          -> { address }                       (secret required)
//   POST /authz-exec      -> { txhash, height }                 (secret required)
//        { granter: "atone1...", memo?: "...",
//          moves: [ { src: "atonevaloper1...", dst: "atonevaloper1...", amount: "123456" } ] }
//   node server.mjs --keygen   prints a fresh 24-word mnemonic and its address, stores nothing
//
// Secrets arrive as systemd credentials (LoadCredentialEncrypted), never as env:
//   $CREDENTIALS_DIRECTORY/authz_mnemonic, $CREDENTIALS_DIRECTORY/authz_secret
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { SigningStargateClient, GasPrice } from "@cosmjs/stargate";
import { MsgBeginRedelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx.js";

const PREFIX = "atone", CHAIN_ID = "atomone-1";
const GAS = process.env.ATOMONE_GAS_PRICE || "0.25uphoton";
const RPCS = (process.env.ATOMONE_RPC || "https://atomone-rpc.gatadao.com,https://atomone-rpc.polkachu.com").split(",").map(s => s.trim()).filter(Boolean);
const BIND = process.env.BIND || "10.9.0.2", PORT = +(process.env.PORT || 8788);
const MAX_MOVES = +(process.env.MAX_MOVES || 20);

if (process.argv.includes("--keygen")) {
  const w = await DirectSecp256k1HdWallet.generate(24, { prefix: PREFIX });
  const [a] = await w.getAccounts();
  console.log("mnemonic: " + w.mnemonic);
  console.log("address:  " + a.address);
  process.exit(0);
}

function cred(name) {
  const dir = process.env.CREDENTIALS_DIRECTORY;
  if (!dir) throw new Error("no CREDENTIALS_DIRECTORY - run under the unit");
  return fs.readFileSync(path.join(dir, name), "utf8").trim();
}
const MNEMONIC = cred("authz_mnemonic"), SECRET = cred("authz_secret");
if (!MNEMONIC || !SECRET) { console.error("authz-signer: missing credential"); process.exit(78); }

async function connectFirst(rpcs, make) {
  let last;
  for (const rpc of rpcs) { try { return await make(rpc); } catch (e) { last = e; console.error("authz-signer: rpc " + rpc + " failed: " + (e.message || e)); } }
  throw last || new Error("no rpc");
}
let clientPromise = null;
async function getClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const wallet = await DirectSecp256k1HdWallet.fromMnemonic(MNEMONIC, { prefix: PREFIX });
      const [account] = await wallet.getAccounts();
      const client = await connectFirst(RPCS, rpc => SigningStargateClient.connectWithSigner(rpc, wallet, { gasPrice: GasPrice.fromString(GAS) }));
      const id = await client.getChainId();
      if (id !== CHAIN_ID) throw new Error("wrong chain " + id);
      return { client, sender: account.address };
    })().catch(e => { clientPromise = null; throw e; });
  }
  return clientPromise;
}

// one signer, one sequence: requests are executed strictly one after another
let chain = Promise.resolve();
function serial(fn) { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; }

const isAcc = s => typeof s === "string" && /^atone1[02-9ac-hj-np-z]{38}$/.test(s);
const isVal = s => typeof s === "string" && /^atonevaloper1[02-9ac-hj-np-z]{38}$/.test(s);
const isAmt = s => /^[1-9]\d{0,17}$/.test(String(s));

function readBody(req) { return new Promise((res, rej) => { let d = ""; req.on("data", c => { d += c; if (d.length > 65536) { rej(new Error("body too large")); req.destroy(); } }); req.on("end", () => res(d)); req.on("error", rej); }); }

const server = http.createServer(async (req, res) => {
  res.setHeader("content-type", "application/json");
  const send = (code, obj) => { res.writeHead(code); res.end(JSON.stringify(obj)); };
  if (req.headers["x-gata-secret"] !== SECRET) return send(401, { error: "unauthorized" });
  try {
    if (req.method === "GET" && req.url === "/whoami") { const { sender } = await getClient(); return send(200, { address: sender, chain_id: CHAIN_ID }); }
    if (req.method !== "POST" || req.url !== "/authz-exec") return send(404, { error: "not found" });
    const body = JSON.parse(await readBody(req));
    const { granter, moves, memo } = body;
    if (!isAcc(granter)) return send(400, { error: "bad granter" });
    if (!Array.isArray(moves) || !moves.length || moves.length > MAX_MOVES) return send(400, { error: "bad moves" });
    for (const m of moves) {
      if (!isVal(m.src) || !isVal(m.dst) || m.src === m.dst || !isAmt(m.amount)) return send(400, { error: "bad move" });
    }
    const { client, sender } = await getClient();
    const inner = moves.map(m => ({
      typeUrl: "/cosmos.staking.v1beta1.MsgBeginRedelegate",
      value: MsgBeginRedelegate.encode({ delegatorAddress: granter, validatorSrcAddress: m.src, validatorDstAddress: m.dst, amount: { denom: "uatone", amount: String(m.amount) } }).finish(),
    }));
    const exec = { typeUrl: "/cosmos.authz.v1beta1.MsgExec", value: { grantee: sender, msgs: inner } };
    const result = await serial(() => client.signAndBroadcast(sender, [exec], "auto", typeof memo === "string" && memo.length <= 64 ? memo : "GATA autopilot"));
    const total = moves.reduce((a, m) => a + Number(m.amount), 0);
    console.log(`authz-signer: exec granter=${granter} moves=${moves.length} uatone=${total} code=${result.code} hash=${result.transactionHash} height=${result.height}`);
    if (result.code !== 0) return send(502, { error: "rejected", code: result.code, raw_log: result.rawLog, txhash: result.transactionHash });
    return send(200, { txhash: result.transactionHash, height: result.height, gas_used: result.gasUsed?.toString?.() });
  } catch (e) {
    console.error("authz-signer: " + (e.message || e));
    return send(500, { error: String(e.message || e) });
  }
});
getClient().then(({ sender }) => console.log("authz-signer: signing as " + sender)).catch(e => console.error("authz-signer: " + (e.message || e)));
server.listen(PORT, BIND, () => console.log(`authz-signer: listening on ${BIND}:${PORT}`));
