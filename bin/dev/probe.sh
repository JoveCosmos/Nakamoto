#!/bin/bash
# Headless measurement harness for the AtomOne app.
#   probe.sh <WxH> <snippet-file> [--phone]
# The snippet sets document.title; everything after "RES" is printed.
# --phone shifts the breakpoints and clamps the shell to 390px, because headless
# Chrome refuses to open a window narrower than 500px.
set -e
# WEB is the rendered tree to probe and URL where it is served: the dev tree by default,
# production with WEB=/srv/atomone-app/web URL=https://atomone.gatahub.zone
WEB=${WEB:-/srv/atomone-app-dev/web}; URL=${URL:-http://127.0.0.1:8089}
# whatever happens, nothing of ours stays in the published tree
trap 'rm -f $WEB/_probe.html $WEB/_probe.js $WEB/_probe_err.js $WEB/_shot.html $WEB/_shot.js' EXIT
WH=${1:?usage: probe.sh WxH snippet.js [--phone]}; SNIP=${2:?}; MODE=${3:-}
W=${WH%x*}; H=${WH#*x}
OUT=$WEB/_probe.html
python3 - "$SNIP" "$MODE" "$WEB" <<'PY'
import io,sys
WEB=sys.argv[3]
snip=io.open(sys.argv[1],encoding='utf-8').read()
h=io.open(WEB+'/index.html',encoding='utf-8').read()

extra=''
if sys.argv[2]=='--phone':
    h=h.replace('max-width:620px','max-width:760px').replace('max-width:400px','max-width:560px')
    h=h.replace('min-width:621px','min-width:9999px')
    extra='<style>#below{width:390px;margin:0 auto}</style>'
io.open(WEB+'/_probe.js','w',encoding='utf-8').write(
    'addEventListener("load",function(){setTimeout(function(){try{'+snip+
    '}catch(e){document.title="RES THREW "+e.message}},1400)})')
h=h.replace('</head>','<script src="_probe_err.js"></script></head>')
io.open(WEB+'/_probe_err.js','w',encoding='utf-8').write(
    'window.__e="";addEventListener("error",function(e){window.__e=e.message})')
js='<script src="_probe.js"></script>'
io.open(WEB+'/_probe.html','w',encoding='utf-8').write(h.replace('</body>',extra+js+'</body>'))
PY
google-chrome --headless=new --disable-gpu --no-sandbox --virtual-time-budget=9000 \
  --dump-dom --window-size="$W,$H" \
  "$URL/_probe.html" 2>/dev/null \
  | grep -oE '<title>RES[^<]*' | sed 's|<title>RES|  |'
rm -f "$OUT" $WEB/_probe.js $WEB/_probe_err.js
