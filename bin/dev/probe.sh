#!/bin/bash
# Headless measurement harness for the AtomOne app.
#   probe.sh <WxH> <snippet-file> [--phone]
# The snippet sets document.title; everything after "RES" is printed.
# --phone shifts the breakpoints and clamps the shell to 390px, because headless
# Chrome refuses to open a window narrower than 500px.
set -e
# whatever happens, nothing of ours stays in the published tree
trap 'rm -f /srv/atomone-app/web/_probe.html /srv/atomone-app/web/_probe.js /srv/atomone-app/web/_probe_err.js /srv/atomone-app/web/_shot.html /srv/atomone-app/web/_shot.js' EXIT
WH=${1:?usage: probe.sh WxH snippet.js [--phone]}; SNIP=${2:?}; MODE=${3:-}
W=${WH%x*}; H=${WH#*x}
OUT=/srv/atomone-app/web/_probe.html
python3 - "$SNIP" "$MODE" <<'PY'
import io,sys
snip=io.open(sys.argv[1],encoding='utf-8').read()
h=io.open('/srv/atomone-app/web/index.html',encoding='utf-8').read()

extra=''
if sys.argv[2]=='--phone':
    h=h.replace('max-width:620px','max-width:760px').replace('max-width:400px','max-width:560px')
    h=h.replace('min-width:621px','min-width:9999px')
    extra='<style>#below{width:390px;margin:0 auto}</style>'
io.open('/srv/atomone-app/web/_probe.js','w',encoding='utf-8').write(
    'addEventListener("load",function(){setTimeout(function(){try{'+snip+
    '}catch(e){document.title="RES THREW "+e.message}},1400)})')
h=h.replace('</head>','<script src="_probe_err.js"></script></head>')
io.open('/srv/atomone-app/web/_probe_err.js','w',encoding='utf-8').write(
    'window.__e="";addEventListener("error",function(e){window.__e=e.message})')
js='<script src="_probe.js"></script>'
io.open('/srv/atomone-app/web/_probe.html','w',encoding='utf-8').write(h.replace('</body>',extra+js+'</body>'))
PY
google-chrome --headless=new --disable-gpu --no-sandbox --virtual-time-budget=9000 \
  --dump-dom --window-size="$W,$H" \
  "https://atomone.gatahub.zone/_probe.html" 2>/dev/null \
  | grep -oE '<title>RES[^<]*' | sed 's|<title>RES|  |'
rm -f "$OUT" /srv/atomone-app/web/_probe.js /srv/atomone-app/web/_probe_err.js
