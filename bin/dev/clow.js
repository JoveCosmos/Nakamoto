window.dispatchEvent(new Event("resize"));
document.querySelector('[data-t=home]').click();
var cb=document.getElementById('cbtn'), row=document.querySelector('.cchips');
function st(){var s=getComputedStyle(cb), ch=row.querySelector('.chip[aria-pressed=true]');
  return (cb.classList.contains('low')?'LOW':'hi')+' bd='+s.borderTopColor
    +' val='+getComputedStyle(cb.querySelector('b')).color
    +' rowLow='+row.classList.contains('low')
    +' chip='+(ch?getComputedStyle(ch).backgroundColor:'none');}
var o=[];
o.push('cb has b: '+!!cb.querySelector('b'));
document.querySelector('.cchips .chip[data-c="299"]').click(); o.push('2.99 '+st());
document.querySelector('.cchips .chip[data-c="0"]').click();   o.push('current '+st());
document.title='RES '+o.join(' || ');
