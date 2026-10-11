/* Signing and broadcasting a redelegation without a library.
   The wallet signs the legacy amino JSON document (Keplr, Adena and Ledger all
   do); the chain wants the transaction as protobuf, so the four messages a
   redelegation needs are encoded here by hand - varints and length-delimited
   fields, nothing else - and the signature travels in SIGN_MODE_LEGACY_AMINO_JSON
   (127). Gas comes from the node's own simulate; fees are PHOTON, the only
   token AtomOne accepts for anything but minting PHOTON (a mint pays in ATONE). */
(function(root){
"use strict";
/* the network this page is for (render.py puts it in the payload, which precedes this script) */
var NET = (function(){ try{ return JSON.parse(document.getElementById("payload").textContent).net || {}; }catch(e){ return {}; } })();
var API = NET.api || "https://atomone-api.gatadao.com", CHAIN = NET.chain || "atomone-1", FEE_DENOM = "uphoton";
var GAS_PRICE = 0.25;            /* uphoton per gas, paid only when the chain's own price cannot be read */
/* (2026-10-09) the chain prices gas itself (x/dynamicfee, 0.01 uphoton at its floor, and every node takes that price):
   a fixed 0.25 paid 25 times what was needed. A fee is the live price times GAS_HEAD, room for a rise while the
   wallet signs; the price is read at most every 30 seconds */
var GAS_HEAD = 2, LIVE = { at: 0, p: null };
var GAS_ADJ = 1.35;

/* ── protobuf, the little that is needed ── */
function varint(n){ var out = []; n = typeof n === "bigint" ? n : BigInt(n);
  while(n >= 128n){ out.push(Number(n & 127n) | 128); n >>= 7n; } out.push(Number(n)); return out; }
function key(field, wire){ return varint((field << 3) | wire); }
function bytesField(field, b){ return key(field, 2).concat(varint(b.length), Array.from(b)); }
function strField(field, s){ return s ? bytesField(field, utf8(s)) : []; }
function uintField(field, n){ return (n === 0 || n === 0n) ? [] : key(field, 0).concat(varint(n)); }
function utf8(s){ return Array.from(new TextEncoder().encode(s)); }
function cat(){ var o = []; for(var i = 0; i < arguments.length; i++) o = o.concat(arguments[i]); return o; }
function coin(c){ return cat(strField(1, c.denom), strField(2, String(c.amount))); }
function any(typeUrl, value){ return cat(strField(1, typeUrl), bytesField(2, value)); }

function msgBytes(m){
  if(m.type === "cosmos-sdk/MsgBeginRedelegate")
    return any("/cosmos.staking.v1beta1.MsgBeginRedelegate", cat(
      strField(1, m.value.delegator_address), strField(2, m.value.validator_src_address),
      strField(3, m.value.validator_dst_address), bytesField(4, coin(m.value.amount))));
  if(m.type === "cosmos-sdk/MsgDelegate")
    return any("/cosmos.staking.v1beta1.MsgDelegate", cat(
      strField(1, m.value.delegator_address), strField(2, m.value.validator_address),
      bytesField(3, coin(m.value.amount))));
  if(m.type === "cosmos-sdk/MsgUndelegate")
    return any("/cosmos.staking.v1beta1.MsgUndelegate", cat(
      strField(1, m.value.delegator_address), strField(2, m.value.validator_address),
      bytesField(3, coin(m.value.amount))));
  /* claiming rewards: MsgWithdrawDelegatorReward{delegator_address(1), validator_address(2)};
     its legacy amino name is "...DelegationReward" */
  if(m.type === "cosmos-sdk/MsgWithdrawDelegationReward")
    return any("/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward", cat(
      strField(1, m.value.delegator_address), strField(2, m.value.validator_address)));
  /* governance: follow a governor (MsgDelegateGovernor{delegator_address(1), governor_address(2)} -
     it moves the following if one exists) or stop (MsgUndelegateGovernor{delegator_address(1)});
     amino names as the chain registers them */
  if(m.type === "atomone/v1/MsgDelegateGovernor")
    return any("/atomone.gov.v1.MsgDelegateGovernor", cat(
      strField(1, m.value.delegator_address), strField(2, m.value.governor_address)));
  if(m.type === "atomone/v1/MsgUndelegateGovernor")
    return any("/atomone.gov.v1.MsgUndelegateGovernor", strField(1, m.value.delegator_address));
  /* voting on a proposal: MsgVote{proposal_id uint64(1), voter(2), option enum(3: 1 yes, 2 abstain, 3 no), metadata(4)};
     the amino value carries proposal_id as a string and the option as its number, as the chain renders them (2026-10-11) */
  if(m.type === "atomone/v1/MsgVote")
    return any("/atomone.gov.v1.MsgVote", cat(uintField(1, BigInt(m.value.proposal_id)), strField(2, m.value.voter),
      uintField(3, m.value.option), strField(4, m.value.metadata || "")));
  /* becoming a governor, or editing one: {address(1), description(2){moniker(1), identity(2), website(3),
     security_contact(4), details(5)}}; the amino value leaves empty fields out, as the chain does */
  if(m.type === "atomone/v1/MsgCreateGovernor" || m.type === "atomone/v1/MsgEditGovernor"){
    var d = m.value.description || {};
    return any(m.type === "atomone/v1/MsgCreateGovernor" ? "/atomone.gov.v1.MsgCreateGovernor" : "/atomone.gov.v1.MsgEditGovernor", cat(
      strField(1, m.value.address), bytesField(2, cat(strField(1, d.moniker), strField(2, d.identity), strField(3, d.website),
      strField(4, d.security_contact), strField(5, d.details)))));
  }
  /* minting PHOTON: MsgMintPhoton{to_address(1), amount Coin(2)} - burns the signer's ATONE and mints PHOTON to the
     same address (the chain makes the signer the to_address); amino name as the chain registers it */
  if(m.type === "atomone/photon/v1/MsgMintPhoton")
    return any("/atomone.photon.v1.MsgMintPhoton", cat(strField(1, m.value.to_address), bytesField(2, coin(m.value.amount))));
  /* ── authz: a grant of restricted staking authority, its revocation, and execution ── */
  if(m.type === "cosmos-sdk/MsgGrant")
    return any("/cosmos.authz.v1beta1.MsgGrant", cat(
      strField(1, m.value.granter), strField(2, m.value.grantee), bytesField(3, grant(m.value.grant))));
  if(m.type === "cosmos-sdk/MsgRevoke")
    return any("/cosmos.authz.v1beta1.MsgRevoke", cat(
      strField(1, m.value.granter), strField(2, m.value.grantee), strField(3, m.value.msg_type_url)));
  if(m.type === "cosmos-sdk/MsgExec"){
    var inner = []; (m.value.msgs || []).forEach(function(x){ inner = inner.concat(bytesField(2, msgBytes(x))); });
    return any("/cosmos.authz.v1beta1.MsgExec", cat(strField(1, m.value.grantee), inner));
  }
  throw new Error("unsupported message " + m.type);
}
/* Grant{authorization Any(1), expiration Timestamp(2)}; StakeAuthorization{max_tokens Coin(1),
   allow_list Validators(2) | deny_list Validators(3), authorization_type enum(4)};
   Validators{address repeated string(1)}; Timestamp{seconds(1), nanos(2)} */
function validators(list){ var o = []; (list || []).forEach(function(a){ o = o.concat(strField(1, a)); }); return o; }
function stakeAuth(a){
  var kind = { delegate: 1, undelegate: 2, redelegate: 3, cancel_unbonding: 4 }[a.authorization_type] || a.authorization_type;
  return any("/cosmos.staking.v1beta1.StakeAuthorization", cat(
    a.max_tokens ? bytesField(1, coin(a.max_tokens)) : [],
    a.allow_list ? bytesField(2, validators(a.allow_list)) : [],
    a.deny_list ? bytesField(3, validators(a.deny_list)) : [],
    uintField(4, kind)));
}
function timestamp(ms){ return cat(uintField(1, Math.floor(ms / 1000)), uintField(2, (ms % 1000) * 1e6)); }
function grant(g){
  var auth = g.authorization.type === "cosmos-sdk/StakeAuthorization" ? stakeAuth(g.authorization.value)
           : g.authorization.type === "cosmos-sdk/GenericAuthorization" ? any("/cosmos.authz.v1beta1.GenericAuthorization", strField(1, g.authorization.value.msg))
           : null;
  if(!auth) throw new Error("unsupported authorization " + g.authorization.type);
  return cat(bytesField(1, auth), g.expiration ? bytesField(2, timestamp(g.expiration)) : []);
}
function body(msgs, memo){ var o = []; msgs.forEach(function(m){ o = o.concat(bytesField(1, msgBytes(m))); });
  return cat(o, strField(2, memo || "")); }
function authInfo(pubKey, sequence, fee, mode){
  var pk = any("/cosmos.crypto.secp256k1.PubKey", bytesField(1, pubKey));
  var single = uintField(1, mode);                     /* ModeInfo.Single.mode */
  var modeInfo = bytesField(1, single);                /* ModeInfo.single */
  var signer = cat(bytesField(1, pk), bytesField(2, modeInfo), uintField(3, sequence));
  var feeB = []; (fee.amount || []).forEach(function(c){ feeB = feeB.concat(bytesField(1, coin(c))); });
  feeB = feeB.concat(uintField(2, fee.gas));
  return cat(bytesField(1, signer), bytesField(2, feeB));
}
function txRaw(bodyB, authB, sig){ return cat(bytesField(1, bodyB), bytesField(2, authB), bytesField(3, sig)); }
function b64(bytes){ var s = ""; for(var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s); }
function unb64(s){ var b = atob(s), o = new Uint8Array(b.length); for(var i = 0; i < b.length; i++) o[i] = b.charCodeAt(i); return o; }

/* ── REST ── */
function call(method, path, bodyObj){
  return new Promise(function(res, rej){
    var x = new XMLHttpRequest(); x.open(method, API + path, true); x.timeout = 20000;
    x.setRequestHeader("content-type", "application/json");
    x.onload = function(){ var d; try{ d = JSON.parse(x.responseText); }catch(e){ return rej(new Error("bad reply")); }
      if(x.status >= 200 && x.status < 300) res(d); else rej(new Error(d.message || ("HTTP " + x.status))); };
    x.onerror = x.ontimeout = function(){ rej(new Error("node unreachable")); };
    x.send(bodyObj ? JSON.stringify(bodyObj) : null);
  });
}
function account(addr){
  return call("GET", "/cosmos/auth/v1beta1/accounts/" + addr).then(function(d){
    var a = d.account || {}; if(a.base_account) a = a.base_account;
    if(!a.account_number) throw new Error("account not found on chain");
    return { number: String(a.account_number), sequence: String(a.sequence || 0) };
  });
}
function balances(addr){
  return call("GET", "/cosmos/bank/v1beta1/balances/" + addr).then(function(d){
    var o = { uatone: 0, uphoton: 0 };
    (d.balances || []).forEach(function(b){ if(b.denom in o) o[b.denom] = parseInt(b.amount, 10); });
    return o;
  });
}
function simulate(msgs, memo, pubKey, sequence){
  var raw = txRaw(body(msgs, memo), authInfo(pubKey, sequence, { amount: [], gas: 0 }, 127), []);
  return call("POST", "/cosmos/tx/v1beta1/simulate", { tx_bytes: b64(raw) })
    .then(function(d){ return parseInt((d.gas_info || {}).gas_used || "0", 10); });
}
/* opt {denom, price}: a fee in another token at its own gas price. Only a mint may use one: a transaction made of
   MsgMintPhoton alone is the chain's fee exception and may pay in ATONE, at PHOTON's price divided by the conversion
   rate (the fee market's own resolver), so a wallet holding no PHOTON can still mint some */
function gasPrices(){
  if(LIVE.p && Date.now() - LIVE.at < 30000) return Promise.resolve(LIVE.p);
  return call("GET", "/cosmos/dynamicfee/v1/gas_prices").then(function(d){
    var p = {}; (d.prices || []).forEach(function(c){ var x = parseFloat(c.amount); if(x > 0) p[c.denom] = x; });
    if(!p[FEE_DENOM]) throw new Error("no gas price");
    LIVE = { at: Date.now(), p: p }; return p;
  }).catch(function(){ return LIVE.p; });           /* unreadable: the last price read, or GAS_PRICE */
}
function livePrice(denom){ var x = LIVE.p && LIVE.p[denom]; return x ? x * GAS_HEAD : 0; }
function feeFor(gasUsed, n, opt){
  var gas = Math.ceil(Math.max(gasUsed * GAS_ADJ, 120000 * n)), d = (opt && opt.denom) || FEE_DENOM, pr = (opt && opt.price) || livePrice(d) || GAS_PRICE;
  return { gas: gas, amount: [{ denom: d, amount: String(Math.ceil(gas * pr)) }] };
}
/* PHOTON minted per ATONE burned, as the chain computes it now */
function mintRate(){
  return call("GET", "/atomone/photon/v1/conversion_rate").then(function(d){ var r = parseFloat(d.conversion_rate); if(!(r > 0)) throw new Error("no conversion rate"); return r; });
}
/* the fee in ATONE for a mint: PHOTON's gas price over the rate, a little above the floor */
function mintFeeOpt(rate){ return { denom: "uatone", price: livePrice("uatone") || GAS_PRICE / rate * 1.1 }; }   /* the chain's own ATONE price when read */
function feeShort(fee, b){
  var c = fee.amount[0], need = parseInt(c.amount, 10), has = b[c.denom] || 0;
  if(has >= need) return null;
  var tok = c.denom === "uatone" ? "ATONE" : "PHOTON";
  return new Error("This needs " + (need / 1e6).toFixed(c.denom === "uatone" ? 6 : 3) + " " + tok + " for the fee and the wallet holds " + (has / 1e6).toFixed(3) + "." +
                   (tok === "PHOTON" ? " Mint PHOTON from ATONE first." : ""));
}

/* A simulation that the node REFUSES is the chain saying the transaction would fail in the
   block - and a failed transaction still pays its fee. So the refusal is surfaced with the
   node's own words, before anything is signed; only an unreachable node falls back to a
   flat gas estimate. */
function gasFallback(e){
  var m = (e && e.message) || "";
  if(m === "node unreachable" || m === "bad reply") return 0;
  throw new Error("The chain refused this transaction: " + m.replace(/^rpc error: code = \w+ desc = /, "").slice(0, 300));
}

/* the sign doc the wallet shows the reader: legacy amino JSON, keys sorted */
function signDoc(acc, fee, msgs, memo){
  return { account_number: acc.number, chain_id: CHAIN,
           fee: { amount: fee.amount, gas: String(fee.gas) }, memo: memo || "", msgs: msgs, sequence: acc.sequence };
}

/* wallet: {name, address, pubKey(Uint8Array), signAmino(signDoc)->{signed, signature}} */
function sendRedelegations(wallet, msgs, memo, onStep, opt){
  var step = onStep || function(){};
  var acc, fee;
  return gasPrices().then(function(){ return account(wallet.address); }).then(function(a){ acc = a; step("simulating");
    return simulate(msgs, memo, wallet.pubKey, acc.sequence).catch(gasFallback);
  }).then(function(gasUsed){
    fee = feeFor(gasUsed, msgs.length, opt);
    return balances(wallet.address).then(function(b){
      /* a mint's fee comes out of the same ATONE it burns: both must fit */
      var short = feeShort(fee, b), burn = opt && opt.burn ? opt.burn : 0;
      if(!short && burn && fee.amount[0].denom === "uatone" && b.uatone < burn + parseInt(fee.amount[0].amount, 10))
        short = new Error("The wallet holds " + (b.uatone / 1e6).toFixed(6) + " ATONE: not enough for this amount and the " + (parseInt(fee.amount[0].amount, 10) / 1e6).toFixed(6) + " ATONE fee.");
      if(short) throw short;
      step("signing", fee);
      return wallet.signAmino(signDoc(acc, fee, msgs, memo));
    });
  }).then(function(r){
    var signed = r.signed || signDoc(acc, fee, msgs, memo);
    var f = { gas: parseInt(signed.fee.gas, 10), amount: signed.fee.amount };
    var raw = txRaw(body(signed.msgs, signed.memo), authInfo(wallet.pubKey, parseInt(signed.sequence, 10), f, 127),
                    unb64(r.signature.signature));
    step("broadcasting");
    return call("POST", "/cosmos/tx/v1beta1/txs", { tx_bytes: b64(raw), mode: "BROADCAST_MODE_SYNC" });
  }).then(function(d){
    var tr = d.tx_response || {};
    if(tr.code && tr.code !== 0) throw new Error("rejected: " + (tr.raw_log || ("code " + tr.code)));
    step("pending", tr.txhash);
    return waitFor(tr.txhash);
  });
}
/* the same journey in SIGN_MODE_DIRECT (1): SignDoc{body_bytes(1), auth_info_bytes(2),
   chain_id(3), account_number(4)} - the wallet signs the bytes the chain will decode, so
   messages with nested Any types (grants) need no amino rendering. Keplr offers signDirect;
   a wallet without it falls back to amino. */
function sendDirect(wallet, msgs, memo, onStep, opt){
  var step = onStep || function(){};
  if(!wallet.signDirect) return sendRedelegations(wallet, msgs, memo, onStep, opt);
  var acc, fee, bodyB;
  return gasPrices().then(function(){ return account(wallet.address); }).then(function(a){ acc = a; step("simulating");
    return simulate(msgs, memo, wallet.pubKey, acc.sequence).catch(gasFallback);
  }).then(function(gasUsed){
    fee = feeFor(gasUsed, msgs.length, opt);
    return balances(wallet.address).then(function(b){
      var short = feeShort(fee, b); if(short) throw short;
      step("signing", fee);
      bodyB = body(msgs, memo);
      var authB = authInfo(wallet.pubKey, parseInt(acc.sequence, 10), fee, 1);
      return wallet.signDirect({ bodyBytes: new Uint8Array(bodyB), authInfoBytes: new Uint8Array(authB), chainId: CHAIN, accountNumber: acc.number })
        .then(function(r){ return { r: r, authB: authB }; });
    });
  }).then(function(x){
    var signed = x.r.signed || {}, bB = signed.bodyBytes ? Array.from(signed.bodyBytes) : bodyB, aB = signed.authInfoBytes ? Array.from(signed.authInfoBytes) : x.authB;
    var raw = txRaw(bB, aB, unb64(x.r.signature.signature));
    step("broadcasting");
    return call("POST", "/cosmos/tx/v1beta1/txs", { tx_bytes: b64(raw), mode: "BROADCAST_MODE_SYNC" });
  }).then(function(d){
    var tr = d.tx_response || {};
    if(tr.code && tr.code !== 0) throw new Error("rejected: " + (tr.raw_log || ("code " + tr.code)));
    step("pending", tr.txhash);
    return waitFor(tr.txhash);
  });
}
function waitFor(hash, tries){
  tries = tries || 0;
  return new Promise(function(res){ setTimeout(res, 3000); }).then(function(){
    return call("GET", "/cosmos/tx/v1beta1/txs/" + hash).then(function(d){
      var tr = d.tx_response || {};
      if(tr.height && tr.height !== "0"){
        /* in a block but failed there: that is the answer, not a reason to keep asking */
        if(tr.code && tr.code !== 0){ var bad = new Error("failed in block " + tr.height + ": " + (tr.raw_log || tr.code)); bad.final = true; throw bad; }
        return { hash: hash, height: tr.height, gasUsed: tr.gas_used };
      }
      throw new Error("not yet");
    }).catch(function(e){
      if(e && e.final) throw e;
      if(tries < 20) return waitFor(hash, tries + 1);
      throw new Error("still pending after a minute: " + hash);
    });
  });
}
var TX = { body: body, authInfo: authInfo, txRaw: txRaw, b64: b64, unb64: unb64, account: account, balances: balances,
           simulate: simulate, gasPrices: gasPrices, feeFor: feeFor, mintRate: mintRate, mintFeeOpt: mintFeeOpt, signDoc: signDoc, send: sendRedelegations, sendDirect: sendDirect, waitFor: waitFor, CHAIN: CHAIN,
           msgBytes: msgBytes };
if(typeof module !== "undefined" && module.exports) module.exports = TX; else { root.__TX = TX; gasPrices(); }   /* read once at load, for the fee previews */
})(typeof window !== "undefined" ? window : globalThis);
