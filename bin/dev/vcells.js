document.querySelector('.cell').click();
var p=document.getElementById('vpop');
var cells=[].map.call(p.querySelectorAll('.vgrid .vstat'),function(c){
 return c.querySelector('.vk').textContent.trim()+'='+c.querySelector('.vv').textContent.trim();});
document.title='RES row="'+p.querySelector('.aprband').innerText.replace(/\s+/g,' ')+'" cells='+cells.join(' | ');
