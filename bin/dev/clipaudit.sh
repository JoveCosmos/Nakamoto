#!/bin/bash
# clipaudit.sh [sizes...] - nothing in a pane may fall below its frame: each pane is clipped to the
# window with no scroll, so text below the edge is simply never seen (2026-09-27: two notes lived there
# for weeks). Walks every route in shell.json at real browser viewports (a window minus its tabs and
# address bar) with a mock wallet, and prints each route's count of clipped text ("n=0" is clean).
#   dev/clipaudit.sh                  default sizes
#   dev/clipaudit.sh 1366x650 1280x620
set -e
cd "$(dirname "$0")"
SIZES=${*:-1920x950 1536x730 1440x780 1366x650 1280x620 1366x600}
ROUTES=$(python3 -c "
import json
d=json.load(open('../shell.json'))
print(' '.join(s['route']+'/'+v['route'] for s in d['sections'] for v in s.get('sub',[]) if not v.get('off')))")
TMP=$(mktemp /tmp/clipaudit.XXXXXX.js); trap 'rm -f $TMP' EXIT
for s in $SIZES; do for r in $ROUTES; do
  sed "s#ROUTE#$r#" clipaudit.js > $TMP
  echo "$s $r :$(CHROME_FLAGS=--force-dark-mode ./probe.sh $s $TMP 2>&1 | tail -1)"
done; done
