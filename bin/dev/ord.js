document.querySelector('[data-t=eta]').click();
var p=document.querySelector('#p-eta .panel');
var order=[].map.call(p.children,function(c){
 var n=(typeof c.className==='string'&&c.className)?c.className.split(' ')[0]:c.tagName;
 return n+':'+Math.round(c.getBoundingClientRect().height);});
var panes=document.querySelector('.panes');
document.title='RES '+order.join(' > ')+' over='+(panes.scrollHeight-panes.clientHeight);
