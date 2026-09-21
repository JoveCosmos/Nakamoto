var out=[];
document.querySelectorAll('.tabb').forEach(function(x){x.click();
 out.push(x.dataset.t+' btn='+getComputedStyle(x).color.replace(/[a-z() ]/g,'')
  +' title='+getComputedStyle(document.getElementById('tsfx')).color.replace(/[a-z() ]/g,''));});
document.querySelector('[data-t=home]').click();
document.title='RES '+out.join(' | ')+' err='+(window.__e||'none');
