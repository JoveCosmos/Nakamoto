var p=document.getElementById('spop');p.classList.add('on');
var cells=[].map.call(p.querySelectorAll('.vstat'),function(c){
 return c.querySelector('.vk').textContent.trim()+'='+c.querySelector('.vv').innerText.replace(/\s+/g,' ').trim();});
var bad=[];
p.querySelectorAll('.vv').forEach(function(v){
 if(v.scrollWidth>v.clientWidth+1) bad.push(v.previousElementSibling.textContent.trim());});
document.title='RES '+cells.join(' | ')+' clipped=['+bad.join(',')+']';
