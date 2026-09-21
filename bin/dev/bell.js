window.dispatchEvent(new Event("resize"));
document.querySelector('[data-t=pays]').click();
var b=document.getElementById('vbell');
if(!b){document.title='RES no vbell';}else{
var r=b.getBoundingClientRect();
var bars=document.getElementById('ubping'), br=bars?bars.getBoundingClientRect():null;
var tb=b.closest('.upsec')?b.closest('.upsec').previousElementSibling:null;
var tr=tb?tb.getBoundingClientRect():null;
document.title='RES btn='+r.top.toFixed(1)+'..'+r.bottom.toFixed(1)+' h='+r.height.toFixed(1)
 +' mt='+getComputedStyle(b).marginTop
 +' tableBottom='+(tr?tr.bottom.toFixed(1):'?')+' ('+(tb?tb.className:'?')+')'
 +' barsTop='+(br?br.top.toFixed(1):'?');}
