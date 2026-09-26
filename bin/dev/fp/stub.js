(function(){
  try{ localStorage.clear(); sessionStorage.clear(); }catch(e){}
  var O=XMLHttpRequest.prototype.open,S=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open=function(m,u){this.__u=u;return O.apply(this,arguments)};
  XMLHttpRequest.prototype.send=function(){var x=this;
    function ops(){var VD=window.__VDBY||{};var o=[];for(var k in VD){if(VD[k].op)o.push(VD[k].op);if(o.length>=6)break}return o}
    var u=x.__u||"",can=null,st=200;
    if(/live\.json/.test(u)){ st=404; can=""; }
    else if(/\/delegations\/atone1/.test(u)){var op=ops();var a=[4030.5,3401.25,2897,2267.75,1200,800.5];
      can=JSON.stringify({delegation_responses:op.map(function(p,i){return {delegation:{delegator_address:"atone1qm3fgxj20mmx2r40q3pd2dxej2mq3f0cpezvcu",validator_address:p,shares:"1"},balance:{denom:"uatone",amount:String(Math.floor(a[i]*1e6))}}})});}
    else if(/redelegations|unbonding_delegations/.test(u)) can='{"redelegation_responses":[],"unbonding_responses":[]}';
    else if(/\/rewards/.test(u)){var o2=ops();can=JSON.stringify({rewards:o2.map(function(p,i){return {validator_address:p,reward:[{denom:"uatone",amount:String((i+1)*7.34e6)}]}}),total:[{denom:"uatone",amount:"154100000"}]});}
    else if(/\/balances\//.test(u)) can='{"balances":[{"denom":"uatone","amount":"387160362"},{"denom":"uphoton","amount":"5362701728"}]}';
    if(can!==null){Object.defineProperty(x,"status",{get:function(){return st}});Object.defineProperty(x,"responseText",{get:function(){return can}});setTimeout(function(){x.onload&&x.onload()},30);return}
    return S.apply(this,arguments)};
  var F=window.fetch;window.fetch=function(u,o){u=String(u);
    function js(v){return Promise.resolve(new Response(JSON.stringify(v),{status:200,headers:{"Content-Type":"application/json"}}))}
    if(/keeper\/_status\.json/.test(u)) return js({grantee:"atone1keeperxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",dry:true});
    if(/keeper\/atone1/.test(u)) return Promise.resolve(new Response("nf",{status:404}));
    if(/authz\/v1beta1\/grants/.test(u)) return js({grants:[]});
    if(/\/rpc\/|simulate|auth\/v1beta1\/accounts|data\.json/.test(u)) return Promise.reject(new Error("stub"));
    return F.apply(this,arguments)};
  window.keplr={enable:function(){return Promise.resolve()},getKey:function(){return Promise.resolve({name:"jove",bech32Address:"atone1qm3fgxj20mmx2r40q3pd2dxej2mq3f0cpezvcu",pubKey:new Uint8Array(33)})},signDirect:function(){return Promise.reject(new Error("never"))}};
})();
