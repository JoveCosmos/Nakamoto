var VD=JSON.parse(document.getElementById('payload').textContent).vdetail;
var seen={},n=0;
document.querySelectorAll('.cell').forEach(function(c,i){
 if(n>40) return; n++;
 c.click();
 document.querySelectorAll('#vbadges .badge').forEach(function(b){
   var k=b.textContent.replace(/[0-9,.]+/g,'N').trim();
   seen[k]=(seen[k]||0)+1;});
 document.getElementById('vpop').classList.remove('on');});
document.title='RES '+Object.keys(seen).map(function(k){return '"'+k+'" x'+seen[k]}).join(' | ');
