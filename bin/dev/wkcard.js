document.getElementById('qbtn').click();
document.getElementById('histbtn').click();
document.querySelector('#hist tbody tr').click();
var p=document.getElementById('pop'),g=p.querySelector('.vgrid');
var cells=[].map.call(g.querySelectorAll('.vstat'),function(c){
 return c.querySelector('.vk').textContent.trim()+'='+c.querySelector('.vv').textContent.trim();});
var rows=new Set([].map.call(g.querySelectorAll('.vstat'),function(c){
 return Math.round(c.getBoundingClientRect().top)}));
document.title='RES cells='+cells.length+' rows='+rows.size+' full='
 +g.querySelectorAll('.vfull').length+' | '+cells.join(' , ');
