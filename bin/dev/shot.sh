#!/bin/bash
# Screenshot harness: shot.sh <WxH> <snippet-file> <out.png> [--phone]
# Same injection as probe.sh; the snippet sets up state, Chrome captures after
# its virtual-time budget.
set -e
# whatever happens, nothing of ours stays in the published tree
trap 'rm -f /srv/atomone-app/web/_probe.html /srv/atomone-app/web/_probe.js /srv/atomone-app/web/_probe_err.js /srv/atomone-app/web/_shot.html /srv/atomone-app/web/_shot.js' EXIT
WH=${1:?}; SNIP=${2:?}; OUT=${3:?}; MODE=${4:-}
W=${WH%x*}; H=${WH#*x}
python3 - "$SNIP" "$MODE" <<'PY'
import io,sys
snip=io.open(sys.argv[1],encoding='utf-8').read()
h=io.open('/srv/atomone-app/web/index.html',encoding='utf-8').read()
extra=''
if sys.argv[2]=='--phone':
    h=h.replace('max-width:620px','max-width:760px').replace('max-width:400px','max-width:560px')
    h=h.replace('min-width:621px','min-width:9999px')
    extra='<style>#below{width:390px;margin:0 auto}</style>'
extra+='<style>*{animation:none!important;transition:none!important}</style>'
io.open('/srv/atomone-app/web/_shot.js','w',encoding='utf-8').write(
    'addEventListener("load",function(){setTimeout(function(){try{'+snip+'}catch(e){}},1400)})')
io.open('/srv/atomone-app/web/_shot.html','w',encoding='utf-8').write(h.replace('</body>',extra+'<script src="_shot.js"></script></body>'))
PY
google-chrome --headless=new --disable-gpu --no-sandbox --virtual-time-budget=6000 --hide-scrollbars \
  --screenshot="$OUT" --window-size="$W,$H" \
  "https://atomone.gatahub.zone/_shot.html" >/dev/null 2>&1
rm -f /srv/atomone-app/web/_shot.html /srv/atomone-app/web/_shot.js
