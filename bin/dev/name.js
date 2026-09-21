var VD=JSON.parse(document.getElementById('payload').textContent).vdetail;
var order=VD.map(function(v,i){return [v.m.length,i]}).sort(function(a,b){return b[0]-a[0]});
var out=[],bad=0;
order.slice(0,4).forEach(function(o){
 document.querySelectorAll('.cell')[o[1]].click();
 var nm=document.getElementById('vname'),rk=document.getElementById('vrank');
 var web=document.querySelector('#vpop .vweb');
 var nr=nm.getBoundingClientRect(),rr=rk.getBoundingClientRect(),wr=web.getBoundingClientRect();
 var sameRow=Math.abs(nr.top-rr.top)<6;
 var webBelow=wr.top>=nr.bottom-2 && wr.top-nr.bottom<26;
 if(!sameRow||!webBelow) bad++;
 out.push('"'+nm.textContent.slice(0,14)+'" rankSameRow='+sameRow+' siteRow2='+webBelow);
 document.getElementById('vpop').classList.remove('on');});
document.title='RES '+out.join(' | ')+' bad='+bad;
