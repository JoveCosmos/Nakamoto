#!/bin/bash
# Screenshot harness: shot.sh <WxH> <snippet-file> <out.png> [--phone]
# Same injection as probe.sh; the snippet sets up state, Chrome captures after
# its virtual-time budget.
set -e
# WEB is the rendered tree to probe and URL where it is served: the dev tree by default,
# production with WEB=/srv/atomone-app/web URL=https://atomone.gatahub.zone
WEB=${WEB:-/srv/atomone-app-dev/web}; URL=${URL:-http://127.0.0.1:8089}
# CHROME_FLAGS adds flags (--force-dark-mode renders the night theme); NODAY=1 drops the day sheet's <link>
CHROME_FLAGS=${CHROME_FLAGS:-}; NODAY=${NODAY:-}
# whatever happens, nothing of ours stays in the published tree
trap 'rm -f $WEB/_probe.html $WEB/_probe.js $WEB/_probe_err.js $WEB/_shot.html $WEB/_shot.js' EXIT
WH=${1:?}; SNIP=${2:?}; OUT=${3:?}; MODE=${4:-}
W=${WH%x*}; H=${WH#*x}
python3 - "$SNIP" "$MODE" "$WEB" "$NODAY" <<'PY'
import io,sys,re
WEB=sys.argv[3]
NODAY=sys.argv[4]
snip=io.open(sys.argv[1],encoding='utf-8').read()
h=io.open(WEB+'/index.html',encoding='utf-8').read()
if NODAY: h=re.sub(r'<link rel=stylesheet href="assets/theme-day.css"[^>]*>\n?','',h)
extra=''
if sys.argv[2]=='--phone':
    h=h.replace('max-width:620px','max-width:760px').replace('max-width:400px','max-width:560px')
    h=h.replace('min-width:621px','min-width:9999px')
    extra='<style>#below{width:390px;margin:0 auto}</style>'
extra+='<style>*{animation:none!important;transition:none!important}</style>'
io.open(WEB+'/_shot.js','w',encoding='utf-8').write(
    'addEventListener("load",function(){setTimeout(function(){try{'+snip+'}catch(e){}},1400)})')
io.open(WEB+'/_shot.html','w',encoding='utf-8').write(h.replace('</body>',extra+'<script src="_shot.js"></script></body>'))
PY
google-chrome $CHROME_FLAGS --headless=new --disable-gpu --no-sandbox --virtual-time-budget=6000 --hide-scrollbars \
  --screenshot="$OUT" --window-size="$W,$H" \
  "$URL/_shot.html" >/dev/null 2>&1
rm -f $WEB/_shot.html $WEB/_shot.js
