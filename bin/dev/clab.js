var p=document.getElementById('cpop');p.classList.add('on');
document.title='RES cells='+[].map.call(p.querySelectorAll('.vstat .vk'),
  function(x){return x.textContent.trim()}).join(' | ');
