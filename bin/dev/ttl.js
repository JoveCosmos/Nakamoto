var out=[];
document.querySelectorAll('.tabb').forEach(function(x){x.click();
 out.push(x.dataset.t+':"'+document.querySelector('.btx').innerText.replace(/\s+/g,' ')+'"');});
document.querySelector('[data-t=home]').click();
document.title='RES '+out.join(' ')+' err='+(window.__e||'none');
