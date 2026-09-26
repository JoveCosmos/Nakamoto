#!/bin/bash
# fp.sh SRC_HTML DAYCSS WxH OUT [--phone]
# The computed-style fingerprint: loads SRC_HTML (a file in the dev web tree) with the stubs
# (stub.js: a mock Keplr wallet and position, the keeper open with no grant, no live feed, no
# node calls - so every run sees the same page) and walks walk.js's 36 states (each route, map
# mode, the what-if strip, every popup, disconnected and connected), hashing every element's
# full computed style and ::before/::after, one element per structural signature. DAYCSS is the
# day sheet to link (web-relative) or "" for night; CHROME_FLAGS passes through
# (--force-dark-mode). Compare two outputs with fpdiff.py. See the handbook, "Proving a CSS change".
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
WEB=${WEB:-/srv/atomone-app-dev/web}; URL=${URL:-http://127.0.0.1:8089}
SRC=${1:?}; DAY=$2; WH=${3:?}; OUT=${4:?}; MODE=${5:-}
W=${WH%x*}; H=${WH#*x}; TAG=_fp$$
trap "rm -f $WEB/$TAG.html $WEB/$TAG.js" EXIT
python3 - "$WEB" "$SRC" "$DAY" "$MODE" "$TAG" "$HERE" <<'PY'
import io,sys,re
WEB,SRC,DAY,MODE,TAG,HERE=sys.argv[1:7]
h=io.open(WEB+'/'+SRC,encoding='utf-8').read()
if DAY: h=re.sub(r'href="assets/theme-day\.css[^"]*"','href="'+DAY+'"',h)
else: h=re.sub(r'<link rel=stylesheet href="assets/theme-day\.css[^"]*"[^>]*>\n?','',h)
extra=''
if MODE=='--phone':
    h=h.replace('max-width:620px','max-width:760px').replace('max-width:400px','max-width:560px').replace('min-width:621px','min-width:9999px')
    extra='<style>#below{width:390px;margin:0 auto}</style>'
stub=io.open(HERE+'/stub.js',encoding='utf-8').read()
io.open(WEB+'/'+TAG+'.js','w',encoding='utf-8').write(io.open(HERE+'/walk.js',encoding='utf-8').read())
h=h.replace('<head>','<head><script>'+stub+'</script>',1)
h=h.replace('</body>',extra+'<script src="'+TAG+'.js"></script></body>')
io.open(WEB+'/'+TAG+'.html','w',encoding='utf-8').write(h)
PY
google-chrome ${CHROME_FLAGS:-} --headless=new --disable-gpu --no-sandbox --virtual-time-budget=60000 --hide-scrollbars \
  --dump-dom --window-size="$W,$H" "$URL/$TAG.html" 2>/dev/null > "$OUT.dom"
python3 - "$OUT.dom" "$OUT" <<'PY'
import sys,re,html
d=open(sys.argv[1],encoding='utf-8',errors='replace').read()
m=re.search(r'<pre id="fpout">(.*?)</pre>',d,re.S)
open(sys.argv[2],'w').write(html.unescape(m.group(1)) if m else 'NO OUTPUT\n')
PY
rm -f "$OUT.dom"
