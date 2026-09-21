document.getElementById('qbtn').click();
var p=document.getElementById('qpop');
var top=[].map.call(p.querySelectorAll('.vgrid:not(.gbelow) .vstat'),function(c){
 return c.querySelector('.vk').textContent.trim()});
var bot=[].map.call(p.querySelectorAll('.vgrid.gbelow .vstat'),function(c){
 return c.querySelector('.vk').textContent.trim()+'='+c.querySelector('.vv').textContent.trim()});
document.title='RES title="'+p.querySelector('.ptag').textContent.trim()+'" top='+top.join(',')
 +' below='+bot.join(' ')+' err='+(window.__e||'none');
