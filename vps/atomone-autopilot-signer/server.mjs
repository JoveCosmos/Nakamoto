// AtomOne Autopilot signer - RUNS ON THE SIGNER VPS, on its own key, user, port and unit.
//
// Two jobs, both on behalf of AtomOne delegators who AUTHORISED this account (x/authz):
//  1. moves: MsgExec{MsgBeginRedelegate...} inside a StakeAuthorization REDELEGATE grant;
//  2. restake: MsgExec{MsgWithdrawDelegatorReward..., MsgDelegate...} - claim the
//     rewards and stake them all back onto the grant's allow-list. It never sends anything anywhere.
// The chain enforces every grant's allow-list, cap and expiry. On top, before signing a
// restake this service reads the chain itself and refuses unless the delegator's rewards
// are paid to the delegator's own address AND what it would stake is no more
// than the rewards pending on the validators it claims from - so it can never be used
// to stake a delegator's own liquid ATONE, whatever the keeper asks. It cannot
// grant. Fees are PHOTON from this account's own balance.
//
// Independent of the payout signer: a different mnemonic, secret, Linux user, unit and
// port. Neither process can read the other's credentials.
//
//   GET  /whoami          -> { address }                       (secret required)
//   POST /authz-exec      -> { txhash, height }                 (secret required)
//        { granter: "atone1...", memo?: "...",
//          moves: [ { src: "atonevaloper1...", dst: "atonevaloper1...", amount: "123456" } ] }
//   POST /authz-restake   -> { txhash, height, rewards }         (secret required)
//        { granter: "atone1...", memo?: "...",
//          claim: [ "atonevaloper1...", ... ],
//          stake: [ { validator: "atonevaloper1...", amount: "123456" } ],
//        }                                  (no send: a restake never sends anything anywhere)
//   node server.mjs --keygen   prints a fresh 24-word mnemonic and its address, stores nothing
//
// Secrets arrive as systemd credentials (LoadCredentialEncrypted), never as env:
//   $CREDENTIALS_DIRECTORY/autopilot_mnemonic, $CREDENTIALS_DIRECTORY/autopilot_secret
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { SigningStargateClient, GasPrice, QueryClient, setupDistributionExtension } from "@cosmjs/stargate";
import { MsgBeginRedelegate, MsgDelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";
import { MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx";

const PREFIX = "atone", CHAIN_ID = process.env.CHAIN_ID || "atomone-1";   // testnet: atomone-testnet-1
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
const MNEMONIC = cred("autopilot_mnemonic"), SECRET = cred("autopilot_secret");
if (!MNEMONIC || !SECRET) { console.error("autopilot-signer: missing credential"); process.exit(78); }

async function connectFirst(rpcs, make) {
  let last;
  for (const rpc of rpcs) { try { return await make(rpc); } catch (e) { last = e; console.error("autopilot-signer: rpc " + rpc + " failed: " + (e.message || e)); } }
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
      const query = QueryClient.withExtensions(client.forceGetCometClient(), setupDistributionExtension);
      return { client, sender: account.address, query };
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
    if (req.method === "POST" && req.url === "/authz-restake") return await restake(JSON.parse(await readBody(req)), send);
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
    console.log(`autopilot-signer: exec granter=${granter} moves=${moves.length} uatone=${total} code=${result.code} hash=${result.transactionHash} height=${result.height}`);
    if (result.code !== 0) return send(502, { error: "rejected", code: result.code, raw_log: result.rawLog, txhash: result.transactionHash });
    return send(200, { txhash: result.transactionHash, height: result.height, gas_used: result.gasUsed?.toString?.() });
  } catch (e) {
    console.error("autopilot-signer: " + (e.message || e));
    return send(500, { error: String(e.message || e) });
  }
});
// the rewards pending for one delegation, in whole uatone (the chain keeps 18 decimals)
async function pending(query, delegator, validator) {
  const r = await query.distribution.delegationRewards(delegator, validator);
  let t = 0n;
  for (const c of r.rewards || []) if (c.denom === "uatone") t += BigInt(c.amount) / 10n ** 18n;
  return t;
}
async function restake(body, send) {
  const { granter, claim, stake, memo } = body;
  // a restake never sends: every claimed reward is staked back, GATA takes no share
  if (body.send != null) return send(400, { error: "a restake never sends" });
  const out = 0n;
  if (!isAcc(granter)) return send(400, { error: "bad granter" });
  if (!Array.isArray(claim) || !claim.length || claim.length > MAX_MOVES || !claim.every(isVal) || new Set(claim).size !== claim.length) return send(400, { error: "bad claim" });
  if (!Array.isArray(stake) || stake.length > MAX_MOVES || !stake.every(s => isVal(s.validator) && isAmt(s.amount))) return send(400, { error: "bad stake" });
  const { client, sender, query } = await getClient();
  // rewards must come back to the delegator: otherwise the claim lands elsewhere and a
  // stake of 'the same amount' would be the delegator's own liquid ATONE
  const wa = await query.distribution.delegatorWithdrawAddress(granter);
  if (wa.withdrawAddress !== granter) return send(409, { error: "rewards are paid to another address" });
  let rewards = 0n;
  for (const v of claim) rewards += await pending(query, granter, v);
  const staked = stake.reduce((a, s) => a + BigInt(s.amount), 0n);
  if (staked + out > rewards) return send(409, { error: "more than the rewards pending", rewards: rewards.toString() });
  if (staked + out === 0n) return send(400, { error: "nothing to do" });
  const inner = claim.map(v => ({ typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
    value: MsgWithdrawDelegatorReward.encode({ delegatorAddress: granter, validatorAddress: v }).finish() }))
    .concat(stake.map(s => ({ typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
      value: MsgDelegate.encode({ delegatorAddress: granter, validatorAddress: s.validator, amount: { denom: "uatone", amount: String(s.amount) } }).finish() })))
  const exec = { typeUrl: "/cosmos.authz.v1beta1.MsgExec", value: { grantee: sender, msgs: inner } };
  const result = await serial(() => client.signAndBroadcast(sender, [exec], "auto", typeof memo === "string" && memo.length <= 64 ? memo : "GATA autopilot restake"));
  console.log(`autopilot-signer: restake granter=${granter} claim=${claim.length} rewards=${rewards} staked=${staked} sent=${out} code=${result.code} hash=${result.transactionHash} height=${result.height}`);
  if (result.code !== 0) return send(502, { error: "rejected", code: result.code, raw_log: result.rawLog, txhash: result.transactionHash });
  return send(200, { txhash: result.transactionHash, height: result.height, rewards: rewards.toString(), gas_used: result.gasUsed?.toString?.() });
}

getClient().then(({ sender }) => console.log("autopilot-signer: signing as " + sender)).catch(e => console.error("autopilot-signer: " + (e.message || e)));
server.listen(PORT, BIND, () => console.log(`autopilot-signer: listening on ${BIND}:${PORT}`));
