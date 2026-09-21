window.dispatchEvent(new Event("resize"));
document.querySelector('[data-t=home]').click();
var c=document.querySelector('#g2 .cell'); if(c) c.click();
var b=document.getElementById('vbell');
var r=b.getBoundingClientRect();
var bars=document.getElementById('ubping'), br=bars?bars.getBoundingClientRect():null;
var grid=document.querySelector('.vgrid'), gr=grid?grid.getBoundingClientRect():null;
document.title='RES btn='+r.top.toFixed(1)+'..'+r.bottom.toFixed(1)+' h='+r.height.toFixed(1)
 +' mt='+getComputedStyle(b).marginTop
 +' gridBottom='+(gr?gr.bottom.toFixed(1):'?')
 +' barsTop='+(br?br.top.toFixed(1):'?')
 +' gap='+(gr&&br?(br.top-gr.bottom).toFixed(1):'?');
