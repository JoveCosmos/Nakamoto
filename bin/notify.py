"""notify: one Discord message per event, for every AtomOne app service (validator watch,
Autopilot grants, keeper and signer health). The webhook comes from DISCORD_WEBHOOK in the
unit's environment (/etc/gata/atomone-app-alerts.env) and is never logged or written out.

    notify.send("warn", "Validator down", "SG-1 missed 312 of the last 320 blocks", fields={...})

level: info (blue), ok (green), warn (amber), crit (red). A failure to reach Discord is
logged and swallowed: an alert that cannot be delivered must never stop the service."""
import json, os, sys, time, urllib.request, urllib.error

HOOK = os.environ.get("DISCORD_WEBHOOK", "").strip()
COLOR = {"info": 0x2bc8bd, "ok": 0x2ee06a, "warn": 0xffb02e, "crit": 0xff4d1f}
ICON = {"info": "ℹ️", "ok": "✅", "warn": "⚠️", "crit": "🚨"}
_last = [0.0]


def send(level, title, text="", fields=None, url=None, net="mainnet"):
    if not HOOK:
        print("notify: no DISCORD_WEBHOOK, not sent: %s" % title, file=sys.stderr, flush=True)
        return False
    emb = {"title": "%s %s" % (ICON.get(level, ""), title)[:250], "description": (text or "")[:3900],
           "color": COLOR.get(level, COLOR["info"]),
           "footer": {"text": "AtomOne %s, GATA" % net},
           "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    if fields:
        emb["fields"] = [{"name": str(k)[:250], "value": str(v)[:1000] or "-", "inline": True} for k, v in list(fields.items())[:24]]
    if url:
        emb["url"] = url
    body = json.dumps({"username": "AtomOne watch", "embeds": [emb], "allowed_mentions": {"parse": []}}).encode()
    for attempt in range(3):
        # Discord allows ~5 messages / 2 s per webhook: keep a small gap between sends
        gap = 0.5 - (time.time() - _last[0])
        if gap > 0:
            time.sleep(gap)
        req = urllib.request.Request(HOOK, data=body, method="POST",
                                     headers={"content-type": "application/json", "user-agent": "gata-atomone-app/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=15):
                _last[0] = time.time()
                return True
        except urllib.error.HTTPError as e:
            if e.code == 429:
                try:
                    wait = float(json.load(e).get("retry_after", 1))
                except Exception:
                    wait = 2.0
                time.sleep(min(wait, 30)); continue
            print("notify: discord HTTP %d for %s" % (e.code, title), file=sys.stderr, flush=True)
            return False
        except Exception as e:
            print("notify: discord unreachable (%s) for %s" % (type(e).__name__, title), file=sys.stderr, flush=True)
            time.sleep(2)
    return False
