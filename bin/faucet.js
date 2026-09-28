/* AtomOne testnet faucet page: a connected Keplr fills the address (typing one works too); two requests,
   100 ATONE and 10 PHOTON, each once per address. The faucet service (/faucet-api/, testnet only) sends. */
(function(){
  "use strict";
  var E = function(id){ return document.getElementById(id); };
  var CHAIN = "atomone-testnet-1";
  var CHAIN_INFO = { chainId: CHAIN, chainName: "AtomOne Testnet", rpc: "https://atomone-testnet-rpc.gatadao.com", rest: "https://atomone-testnet-api.gatadao.com",
    bip44: { coinType: 118 },
    bech32Config: { bech32PrefixAccAddr: "atone", bech32PrefixAccPub: "atonepub", bech32PrefixValAddr: "atonevaloper", bech32PrefixValPub: "atonevaloperpub",
      bech32PrefixConsAddr: "atonevalcons", bech32PrefixConsPub: "atonevalconspub" },
    currencies: [{ coinDenom: "ATONE", coinMinimalDenom: "uatone", coinDecimals: 6 }, { coinDenom: "PHOTON", coinMinimalDenom: "uphoton", coinDecimals: 6 }],
    feeCurrencies: [{ coinDenom: "PHOTON", coinMinimalDenom: "uphoton", coinDecimals: 6, gasPriceStep: { low: 0.025, average: 0.03, high: 0.04 } }],
    stakeCurrency: { coinDenom: "ATONE", coinMinimalDenom: "uatone", coinDecimals: 6 }, features: [] };
  var addr = E("addr"), msg = E("msg"), btns = document.querySelectorAll(".go button"), CLAIMED = {};
  var ok = function(a){ return /^atone1[02-9ac-hj-np-z]{38}$/.test(a); };
  function say(t, cls){ msg.textContent = t; msg.className = "msg" + (cls ? " " + cls : ""); }
  function api(path, body){
    return fetch("/faucet-api/" + path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" })
      .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); });
  }
  function draw(){
    var a = addr.value.trim(), good = ok(a);
    addr.classList.toggle("bad", !!a && !good);
    Array.prototype.forEach.call(btns, function(b){ var t = b.dataset.token, got = good && CLAIMED[a] && CLAIMED[a][t];
      b.disabled = !good || !!got || b.classList.contains("busy");
      b.querySelector("small").textContent = got ? "Received" : "Request " + t.toUpperCase(); });
  }
  function check(){
    var a = addr.value.trim(); draw();
    if(!ok(a) || CLAIMED[a]) return;
    api("claimed?address=" + encodeURIComponent(a)).then(function(c){ CLAIMED[a] = c; draw(); }).catch(function(){});
  }
  addr.addEventListener("input", function(){ say(""); check(); });
  /* Keplr: fills the address (the testnet chain is offered to Keplr if it does not know it yet) */
  function connect(quiet){
    var k = window.keplr;
    if(!k){ if(!quiet) say("Keplr is not installed in this browser: paste your address instead.", "err"); return; }
    k.enable(CHAIN).catch(function(e){
      if(k.experimentalSuggestChain) return k.experimentalSuggestChain(CHAIN_INFO).then(function(){ return k.enable(CHAIN); });
      throw e; })
      .then(function(){ return k.getKey(CHAIN); })
      .then(function(key){ addr.value = key.bech32Address; E("conn").textContent = "Connected"; say(""); check(); })
      .catch(function(e){ if(!quiet) say(e && e.message ? e.message : String(e), "err"); });
  }
  E("conn").addEventListener("click", function(){ connect(false); });
  Array.prototype.forEach.call(btns, function(b){
    b.addEventListener("click", function(){
      var a = addr.value.trim(), t = b.dataset.token; if(!ok(a)) return;
      b.classList.add("busy"); draw(); say("Sending " + (t === "atone" ? "100 ATONE" : "10 PHOTON") + "…");
      api("request", { address: a, token: t })
        .then(function(r){ (CLAIMED[a] = CLAIMED[a] || {})[t] = true; say("Sent. Transaction " + r.txhash.slice(0, 12) + "… It arrives within a few seconds.", "ok"); })
        .catch(function(e){ if(/already received/.test(e.message)) (CLAIMED[a] = CLAIMED[a] || {})[t] = true; say(e.message, "err"); })
        .then(function(){ b.classList.remove("busy"); draw(); });
    });
  });
  api("status").catch(function(){ say("The faucet is not answering right now.", "err"); });
  /* a wallet connected in the app before fills the address at once */
  try{ if(localStorage.getItem("th_wallet") === "Keplr") connect(true); }catch(e){}
  draw();
})();
