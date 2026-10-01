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
// Its own policy, whatever the keeper asks (audit 2026-09-30): a move goes only to a bonded,
// unjailed validator inside the keeper's window (ranks n-33 to n-3) and only out of what the
// delegator holds at the source; a restake stakes only on a bonded, unjailed validator ranked
// n-3 or higher; at most 20 stake-moving messages per delegator a day; 30 requests a minute;
// a simulated gas ceiling and a timeout height on every transaction.
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
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { SigningStargateClient, GasPrice, QueryClient, calculateFee, setupDistributionExtension, setupStakingExtension } from "@cosmjs/stargate";
import { MsgBeginRedelegate, MsgDelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";
import { MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx";

const PREFIX = "atone", CHAIN_ID = process.env.CHAIN_ID || "atomone-1";   // testnet: atomone-testnet-1
const GAS = process.env.ATOMONE_GAS_PRICE || "0.25uphoton";
const RPCS = (process.env.ATOMONE_RPC || "https://atomone-rpc.gatadao.com,https://atomone-rpc.polkachu.com").split(",").map(s => s.trim()).filter(Boolean);
const BIND = process.env.BIND || "10.9.0.2", PORT = +(process.env.PORT || 8788);
const MAX_MOVES = +(process.env.MAX_MOVES || 20);              // messages in one request (one transaction): gas and size
const MAX_MOVES_DAY = +(process.env.MAX_MOVES_DAY || 60);      // per delegator in any 24 hours; MUST match keeper.py (operator, 2026-10-01)
const MAX_GAS = +(process.env.ATOMONE_MAX_GAS || 12_000_000);   // after the 1.4 margin; 7 redelegations used 2.4M
const TIMEOUT_BLOCKS = 100;                                       // a tx not in a block by then can never land

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
const SECRET_B = Buffer.from(SECRET);
// constant-time compare (audit 2026-09-30): the length check first, timingSafeEqual needs equal lengths
function authorised(h) {
  if (typeof h !== "string") return false;
  const b = Buffer.from(h);
  return b.length === SECRET_B.length && crypto.timingSafeEqual(b, SECRET_B);
}

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
      const query = QueryClient.withExtensions(client.forceGetCometClient(), setupDistributionExtension, setupStakingExtension);
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

// ---- policy: pure functions, no I/O (audit 2026-09-30) ----
// BOTTOM, EDGE and RS_EDGE MUST match keeper.py's BOTTOM, EDGE and RS_EDGE: the keeper plans inside this
// window and the signer refuses anything outside it
const BOTTOM = 34, EDGE = 3, RS_EDGE = 3;
const DAY_MS = 86_400_000, RATE_MAX = 30, RATE_MS = 60_000;
// the bonded set, largest first (a stable sort: ties keep the chain's order, as the keeper's does)
function rankSet(validators) {
  const out = validators.filter(v => v.status === 3 || v.status === "BOND_STATUS_BONDED")
    .map(v => ({ op: v.operatorAddress, tokens: BigInt(v.tokens), jailed: !!v.jailed }));
  return out.sort((a, b) => (a.tokens > b.tokens ? -1 : a.tokens < b.tokens ? 1 : 0));
}
// a move's destination: bonded, not jailed, 0-based index from n-BOTTOM to n-1-EDGE (ranks n-33 to n-3)
function checkMoves(ranked, moves) {
  const n = ranked.length, idx = new Map(ranked.map((v, i) => [v.op, i]));
  const lo = Math.max(0, n - BOTTOM), hi = n - 1 - EDGE;
  for (const m of moves) {
    const i = idx.get(m.dst);
    if (i === undefined) return "destination " + m.dst + " is not bonded";
    if (ranked[i].jailed) return "destination " + m.dst + " is jailed";
    if (i < lo || i > hi) return `destination ${m.dst} is rank ${i + 1} of ${n}, outside ranks ${lo + 1} to ${hi + 1}`;
  }
  return null;
}
// a restake's validator: bonded, not jailed, rank n-RS_EDGE or higher
function checkStake(ranked, stake) {
  const n = ranked.length, idx = new Map(ranked.map((v, i) => [v.op, i]));
  for (const s of stake) {
    const i = idx.get(s.validator);
    if (i === undefined) return "validator " + s.validator + " is not bonded";
    if (ranked[i].jailed) return "validator " + s.validator + " is jailed";
    if (i > n - 1 - RS_EDGE) return `validator ${s.validator} is rank ${i + 1} of ${n}, below rank ${n - RS_EDGE}`;
  }
  return null;
}
// what each source gives in this request, in uatone
function sumBySrc(moves) {
  const out = new Map();
  for (const m of moves) out.set(m.src, (out.get(m.src) || 0n) + BigInt(m.amount));
  return out;
}
// the per-delegator day: one timestamp per stake-moving message signed (redelegations and delegations, both
// endpoints; reward claims move nothing and are not counted). Room is what the last 24 hours leave of MAX_MOVES_DAY
function capHeld(log, granter, now) {
  const kept = (log.get(granter) || []).filter(t => t > now - DAY_MS);
  if (kept.length) log.set(granter, kept); else log.delete(granter);
  return kept.length;
}
function capRecord(log, granter, count, now) {
  const l = log.get(granter) || [];
  for (let i = 0; i < count; i++) l.push(now);
  log.set(granter, l);
}
// every caller together: at most RATE_MAX requests in any RATE_MS
function rateTake(stamps, now) {
  while (stamps.length && stamps[0] <= now - RATE_MS) stamps.shift();
  if (stamps.length >= RATE_MAX) return false;
  stamps.push(now); return true;
}
// a memo: none means the fallback; a string of at most 64 characters with no control characters, else refused
function memoOf(memo, fallback) {
  if (memo === undefined || memo === null || memo === "") return { memo: fallback };
  if (typeof memo !== "string" || memo.length > 64 || /[\u0000-\u001f\u007f-\u009f]/.test(memo)) return { error: "bad memo" };
  return { memo };
}
// ---- end policy ----

// the bonded set from this signer's own RPC, read at most once a minute (and again after every tx it signs)
const SET_TTL_MS = 60_000;
let setCache = { at: 0, ranked: null };
async function bondedSet(query) {
  if (setCache.ranked && Date.now() - setCache.at < SET_TTL_MS) return setCache.ranked;
  const all = []; let key, pages = 0;
  do {
    const r = await query.staking.validators("BOND_STATUS_BONDED", key);
    all.push(...(r.validators || [])); key = r.pagination?.nextKey;
    if (++pages > 50) throw new Error("bonded set: too many pages");
  } while (key && key.length);
  const ranked = rankSet(all);
  if (!ranked.length) throw new Error("bonded set is empty");
  setCache = { at: Date.now(), ranked };
  return ranked;
}
// the delegator's stake at one validator, in uatone (0 when there is none)
async function delegated(query, delegator, validator) {
  try {
    const r = await query.staking.delegation(delegator, validator);
    const b = r.delegationResponse?.balance;
    return b && b.denom === "uatone" ? BigInt(b.amount) : 0n;
  } catch (e) {
    if (/not found/i.test(String(e.message || e))) return 0n;
    throw e;
  }
}
const capLog = new Map(), rateLog = [];

// simulate, refuse over the gas ceiling, then sign with a timeout height; the day's count is kept for what landed
// (code 0) or may still land (sent, not yet seen), never for a tx that failed
async function signChecked(client, sender, granter, msgs, memo, moving) {
  const gas = await client.simulate(sender, msgs, memo);
  const limit = Math.ceil(gas * 1.4);
  if (limit > MAX_GAS) return { refused: `gas ${limit} is more than the ceiling ${MAX_GAS}` };
  const height = await client.getHeight();
  try {
    const result = await client.signAndBroadcast(sender, msgs, calculateFee(limit, GasPrice.fromString(GAS)), memo, BigInt(height + TIMEOUT_BLOCKS));
    if (result.code === 0) { capRecord(capLog, granter, moving, Date.now()); setCache.at = 0; }
    return { result };
  } catch (e) {
    if (e && e.txId) { capRecord(capLog, granter, moving, Date.now()); setCache.at = 0; }
    throw e;
  }
}

function readBody(req) { return new Promise((res, rej) => { let d = ""; req.on("data", c => { d += c; if (d.length > 65536) { rej(new Error("body too large")); req.destroy(); } }); req.on("end", () => res(d)); req.on("error", rej); }); }

const server = http.createServer(async (req, res) => {
  res.setHeader("content-type", "application/json");
  const send = (code, obj) => { res.writeHead(code); res.end(JSON.stringify(obj)); };
  if (!rateTake(rateLog, Date.now())) return send(429, { error: "rate limit: at most " + RATE_MAX + " requests a minute" });
  if (!authorised(req.headers["x-gata-secret"])) return send(401, { error: "unauthorized" });
  try {
    if (req.method === "GET" && req.url === "/whoami") { const { sender } = await getClient(); return send(200, { address: sender, chain_id: CHAIN_ID }); }
    if (req.method === "POST" && req.url === "/authz-restake") return await restake(JSON.parse(await readBody(req)), send);
    if (req.method !== "POST" || req.url !== "/authz-exec") return send(404, { error: "not found" });
    const body = JSON.parse(await readBody(req));
    const { granter, moves } = body;
    if (!isAcc(granter)) return send(400, { error: "bad granter" });
    if (!Array.isArray(moves) || !moves.length || moves.length > MAX_MOVES) return send(400, { error: "bad moves" });
    for (const m of moves) {
      if (!m || !isVal(m.src) || !isVal(m.dst) || m.src === m.dst || !isAmt(m.amount)) return send(400, { error: "bad move" });
    }
    const memo = memoOf(body.memo, "GATA AtomOne Autopilot");
    if (memo.error) return send(400, { error: memo.error });
    const { client, sender, query } = await getClient();
    // the policy, the day's count and the signature in one turn of the queue: two requests cannot both pass the cap
    const out = await serial(async () => {
      if (capHeld(capLog, granter, Date.now()) + moves.length > MAX_MOVES_DAY) return { code: 400, err: "daily move limit (" + MAX_MOVES_DAY + ") reached" };
      const bad = checkMoves(await bondedSet(query), moves);
      if (bad) return { code: 400, err: bad };
      for (const [src, amt] of sumBySrc(moves)) {
        const has = await delegated(query, granter, src);
        if (has < amt) return { code: 400, err: `not enough delegation at ${src}: ${has} uatone, ${amt} asked` };
      }
      const inner = moves.map(m => ({
        typeUrl: "/cosmos.staking.v1beta1.MsgBeginRedelegate",
        value: MsgBeginRedelegate.encode({ delegatorAddress: granter, validatorSrcAddress: m.src, validatorDstAddress: m.dst, amount: { denom: "uatone", amount: String(m.amount) } }).finish(),
      }));
      const exec = { typeUrl: "/cosmos.authz.v1beta1.MsgExec", value: { grantee: sender, msgs: inner } };
      const r = await signChecked(client, sender, granter, [exec], memo.memo, moves.length);
      return r.refused ? { code: 400, err: r.refused } : r;
    });
    if (out.err) { console.log(`autopilot-signer: exec granter=${granter} refused: ${out.err}`); return send(out.code, { error: out.err }); }
    const result = out.result;
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
  const { granter, claim, stake } = body;
  // a restake never sends: every claimed reward is staked back, GATA takes no share
  if (body.send != null) return send(400, { error: "a restake never sends" });
  const out = 0n;
  if (!isAcc(granter)) return send(400, { error: "bad granter" });
  if (!Array.isArray(claim) || !claim.length || claim.length > MAX_MOVES || !claim.every(isVal) || new Set(claim).size !== claim.length) return send(400, { error: "bad claim" });
  if (!Array.isArray(stake) || stake.length > MAX_MOVES || !stake.every(s => s && isVal(s.validator) && isAmt(s.amount))) return send(400, { error: "bad stake" });
  const memo = memoOf(body.memo, "GATA AtomOne Restake");
  if (memo.error) return send(400, { error: memo.error });
  const { client, sender, query } = await getClient();
  const res = await serial(async () => {
    if (capHeld(capLog, granter, Date.now()) + stake.length > MAX_MOVES_DAY) return { code: 400, err: "daily move limit (" + MAX_MOVES_DAY + ") reached" };
    const bad = checkStake(await bondedSet(query), stake);
    if (bad) return { code: 400, err: bad };
    // rewards must come back to the delegator: otherwise the claim lands elsewhere and a
    // stake of 'the same amount' would be the delegator's own liquid ATONE
    const wa = await query.distribution.delegatorWithdrawAddress(granter);
    if (wa.withdrawAddress !== granter) return { code: 409, err: "rewards are paid to another address" };
    let rewards = 0n;
    for (const v of claim) rewards += await pending(query, granter, v);
    const staked = stake.reduce((a, s) => a + BigInt(s.amount), 0n);
    if (staked + out > rewards) return { code: 409, err: "more than the rewards pending", rewards };
    if (staked + out === 0n) return { code: 400, err: "nothing to do" };
    const inner = claim.map(v => ({ typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
      value: MsgWithdrawDelegatorReward.encode({ delegatorAddress: granter, validatorAddress: v }).finish() }))
      .concat(stake.map(s => ({ typeUrl: "/cosmos.staking.v1beta1.MsgDelegate",
        value: MsgDelegate.encode({ delegatorAddress: granter, validatorAddress: s.validator, amount: { denom: "uatone", amount: String(s.amount) } }).finish() })))
    const exec = { typeUrl: "/cosmos.authz.v1beta1.MsgExec", value: { grantee: sender, msgs: inner } };
    const r = await signChecked(client, sender, granter, [exec], memo.memo, stake.length);
    return r.refused ? { code: 400, err: r.refused } : { ...r, rewards, staked };
  });
  if (res.err) {
    console.log(`autopilot-signer: restake granter=${granter} refused: ${res.err}`);
    return send(res.code, res.rewards !== undefined ? { error: res.err, rewards: res.rewards.toString() } : { error: res.err });
  }
  const { result, rewards, staked } = res;
  console.log(`autopilot-signer: restake granter=${granter} claim=${claim.length} rewards=${rewards} staked=${staked} sent=${out} code=${result.code} hash=${result.transactionHash} height=${result.height}`);
  if (result.code !== 0) return send(502, { error: "rejected", code: result.code, raw_log: result.rawLog, txhash: result.transactionHash });
  return send(200, { txhash: result.transactionHash, height: result.height, rewards: rewards.toString(), gas_used: result.gasUsed?.toString?.() });
}

getClient().then(({ sender }) => console.log("autopilot-signer: signing as " + sender)).catch(e => console.error("autopilot-signer: " + (e.message || e)));
server.listen(PORT, BIND, () => console.log(`autopilot-signer: listening on ${BIND}:${PORT}`));
