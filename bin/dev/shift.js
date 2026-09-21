document.querySelector('.cell').click();
var b=document.getElementById('vbell'),h=document.getElementById('pingh');
var b0=b.getBoundingClientRect().left, h0=h.textContent;
h.textContent='#10,999,999';
var b1=b.getBoundingClientRect().left;
h.textContent='#1';
var b2=b.getBoundingClientRect().left;
document.title='RES initial="'+h0+'" bellShift='+Math.round(b1-b0)+'/'+Math.round(b2-b0)
 +' stable='+(Math.abs(b1-b0)<1&&Math.abs(b2-b0)<1)
 +' btn='+Math.round(b.getBoundingClientRect().width)+'x'+Math.round(b.getBoundingClientRect().height);
