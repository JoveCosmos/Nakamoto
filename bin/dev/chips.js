function lum(s){var m=s.match(/[\d.]+/g).map(Number).slice(0,3).map(function(v){v/=255;
 return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});
 return .2126*m[0]+.7152*m[1]+.0722*m[2];}
var out=[],bad=0;
document.querySelectorAll('.chiprow').forEach(function(row,i){
 var on=row.querySelector('.chip[aria-pressed=true]'); if(!on) return;
 var sp=on.querySelector('span'),b=on.querySelector('b');
 var bg=getComputedStyle(on).backgroundColor;
 var r1=(Math.max(lum(getComputedStyle(sp).color),lum(bg))+.05)/(Math.min(lum(getComputedStyle(sp).color),lum(bg))+.05);
 var r2=(Math.max(lum(getComputedStyle(b).color),lum(bg))+.05)/(Math.min(lum(getComputedStyle(b).color),lum(bg))+.05);
 if(r1<4.5) bad++;
 out.push((row.className.split(' ')[2]||'row'+i)+' bg='+bg.replace(/[a-z() ]/g,'')
  +' label='+r1.toFixed(1)+':1 value='+r2.toFixed(1)+':1');});
document.title='RES '+out.join(' | ')+' lowContrast='+bad;
