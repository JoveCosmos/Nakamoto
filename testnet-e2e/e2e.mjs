// TESTNET end-to-end tool. Every chain call goes to atomone-testnet-1 and refuses anything else.
// The test wallet (atone1dkk5j6j2xcxedn2m4c9r8je3dmmpamle350e33) is kept for reuse, its words sealed in
// /etc/atomone-autopilot-testnet/e2e-wallet.cred; run the tool under systemd-run with both credentials:
//   systemd-run --quiet --wait --pipe -p WorkingDirectory=$PWD \
//     -p LoadCredentialEncrypted=e2e_mnemonic:/etc/atomone-autopilot-testnet/e2e-wallet.cred \
//     -p LoadCredentialEncrypted=autopilot_mnemonic:/etc/atomone-autopilot-testnet/mnemonic.cred \
//     /usr/bin/node $PWD/e2e.mjs <command> ...
// E2E_KEY=<words file> uses another throwaway wallet instead of the kept one (delegate, grant, revoke).
// (node_modules here is a symlink to /opt/atomone-faucet/node_modules, not tracked)
//   node e2e.mjs keygen                 make the test wallet (words kept in ./test.key, 0600, never printed)
//   node e2e.mjs fund <atone> <photon>  send from the testnet Autopilot account (needs its credential)
//   node e2e.mjs delegate <op,op,...> <uatone each>
//   node e2e.mjs grant <allow,...>      Autopilot REDELEGATE + Restake WDRAW/DELEGATE to the grantee, as the page does
//   node e2e.mjs revoke                 revoke all three
//   node e2e.mjs login <url>            sign in to the admin API as the testnet operator (needs its credential), print cookie
import fs from "node:fs";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { Secp256k1HdWallet as AminoWallet } from "@cosmjs/amino";
import { SigningStargateClient, GasPrice } from "@cosmjs/stargate";
import { MsgGrant, MsgRevoke } from "cosmjs-types/cosmos/authz/v1beta1/tx";
import { GenericAuthorization } from "cosmjs-types/cosmos/authz/v1beta1/authz";
import { StakeAuthorization, AuthorizationType } from "cosmjs-types/cosmos/staking/v1beta1/authz";
const RPC = "https://atomone-testnet-rpc.gatadao.com", CHAIN = "atomone-testnet-1", GRANTEE = "atone10aacrd04k78vlku3n4wwdqh0kmp7zjvhvy2yez";
const KEY = new URL("./test.key", import.meta.url).pathname;
const [cmd, ...a] = process.argv.slice(2);
async function cl(words) {
  const w = await DirectSecp256k1HdWallet.fromMnemonic(words, { prefix: "atone" }); const [acc] = await w.getAccounts();
  const c = await SigningStargateClient.connectWithSigner(RPC, w, { gasPrice: GasPrice.fromString("0.03uphoton") });
  if (await c.getChainId() !== CHAIN) throw new Error("not testnet"); return { c, me: acc.address };
}
const opWords = () => fs.readFileSync(process.env.CREDENTIALS_DIRECTORY + "/autopilot_mnemonic", "utf8").trim();
const testWords = () => { const d = process.env.CREDENTIALS_DIRECTORY;
  if (process.env.E2E_KEY) return fs.readFileSync(process.env.E2E_KEY, "utf8").trim();   // another throwaway wallet (words file, 0600)
  if (d && fs.existsSync(d + "/e2e_mnemonic")) return fs.readFileSync(d + "/e2e_mnemonic", "utf8").trim();
  return fs.readFileSync(KEY, "utf8").trim(); };
const done = r => { console.log(cmd, "code", r.code, "tx", r.transactionHash, r.code ? r.rawLog : ""); process.exit(r.code ? 1 : 0); };
if (cmd === "keygen") {
  if (fs.existsSync(KEY)) { const { me } = await cl(testWords()); console.log("exists", me); process.exit(0); }
  const w = await DirectSecp256k1HdWallet.generate(24, { prefix: "atone" }); fs.writeFileSync(KEY, w.mnemonic, { mode: 0o600 });
  const [x] = await w.getAccounts(); console.log("test wallet", x.address); process.exit(0);
}
if (cmd === "addr") { const w = await DirectSecp256k1HdWallet.fromMnemonic(testWords(), { prefix: "atone" }); console.log((await w.getAccounts())[0].address); process.exit(0); }
if (cmd === "fund") {
  const { c, me } = await cl(opWords()); if (me !== GRANTEE) throw new Error("wrong operator key");
  const to = a[2]; done(await c.sendTokens(me, to, [{ denom: "uatone", amount: String(a[0]) }, { denom: "uphoton", amount: String(a[1]) }], "auto", ""));
}
if (cmd === "delegate") {
  const { c, me } = await cl(testWords());
  const msgs = a[0].split(",").map(v => ({ typeUrl: "/cosmos.staking.v1beta1.MsgDelegate", value: { delegatorAddress: me, validatorAddress: v, amount: { denom: "uatone", amount: String(a[1]) } } }));
  done(await c.signAndBroadcast(me, msgs, "auto", ""));
}
const any = (url, bytes) => ({ typeUrl: url, value: bytes });
if (cmd === "grant") {
  const { c, me } = await cl(testWords()); const allow = a[0].split(",");
  const stake = (t, list) => any("/cosmos.staking.v1beta1.StakeAuthorization", StakeAuthorization.encode(StakeAuthorization.fromPartial({ authorizationType: t, allowList: { address: list } })).finish());
  const g = auth => ({ typeUrl: "/cosmos.authz.v1beta1.MsgGrant", value: MsgGrant.fromPartial({ granter: me, grantee: GRANTEE, grant: { authorization: auth } }) });

  const msgs = [g(stake(AuthorizationType.AUTHORIZATION_TYPE_REDELEGATE, allow)),
    g(any("/cosmos.authz.v1beta1.GenericAuthorization", GenericAuthorization.encode({ msg: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward" }).finish())),
    g(stake(AuthorizationType.AUTHORIZATION_TYPE_DELEGATE, a[1] ? a[1].split(",") : allow))];
  done(await c.signAndBroadcast(me, msgs, "auto", "GATA Autopilot"));
}
if (cmd === "revoke") {
  const { c, me } = await cl(testWords());
  const r = t => ({ typeUrl: "/cosmos.authz.v1beta1.MsgRevoke", value: MsgRevoke.fromPartial({ granter: me, grantee: GRANTEE, msgTypeUrl: t }) });
  done(await c.signAndBroadcast(me, [r("/cosmos.staking.v1beta1.MsgBeginRedelegate"), r("/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"), r("/cosmos.staking.v1beta1.MsgDelegate")], "auto", ""));
}
if (cmd === "login") {
  const base = a[0], w = await AminoWallet.fromMnemonic(opWords(), { prefix: "atone" }); const [acc] = await w.getAccounts();
  const ch = await (await fetch(base + "/admin-api/challenge")).json();
  const doc = { chain_id: "", account_number: "0", sequence: "0", fee: { gas: "0", amount: [] }, memo: "",
    msgs: [{ type: "sign/MsgSignData", value: { signer: acc.address, data: Buffer.from(ch.text).toString("base64") } }] };
  const s = await w.signAmino(acc.address, doc);
  const r = await fetch(base + "/admin-api/login", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: acc.address, pubkey: s.signature.pub_key.value, signature: s.signature.signature, text: ch.text }) });
  const ck = (r.headers.get("set-cookie") || "").split(";")[0];
  console.log(r.status, JSON.stringify(await r.json())); fs.writeFileSync(new URL("./admin.cookie", import.meta.url).pathname, ck, { mode: 0o600 }); process.exit(r.ok ? 0 : 1);
}
console.log("unknown command"); process.exit(2);
