"""notify: the AtomOne app's two alert channels.

  discord(net, level, title, text, fields)  business events only (operator, 2026-10-01): a new Autopilot or Restake
      grant with the live counts, user and ATONE milestones, every Autopilot and Restake run, the treasury low on
      PHOTON, the testnet faucet low. The network leads every title. Webhook: DISCORD_WEBHOOK.
  ops(level, title, text, fields, net)      everything operational (a service down, the signer not answering, retries,
      the validator watch, admin sign-ins, Disable / Enable): Telegram, the box's ops bot (@ChainsPingBot): its token is the sealed credential
      ops_tg_token (/etc/gata/atomone-app-ops-tg.cred), the group is OPS_TG_CHAT.
      With no Telegram configured it is written to the journal only.

Both live in /etc/gata/atomone-app-alerts.env and are never logged or written out. level: info, ok, warn, crit. A
failure to deliver is logged and swallowed: an alert that cannot be delivered must never stop a service.
`send()` is kept for old callers and goes to ops."""
import json, os, sys, time, urllib.request, urllib.error, urllib.parse

HOOK = os.environ.get("DISCORD_WEBHOOK", "").strip()
def _cred(name):
    """a systemd credential (LoadCredentialEncrypted), readable only by the unit that loads it"""
    d = os.environ.get("CREDENTIALS_DIRECTORY")
    try: return open(os.path.join(d, name)).read().strip() if d else ""
    except OSError: return ""
TG_TOKEN = os.environ.get("OPS_TG_TOKEN", "").strip() or _cred("ops_tg_token")
TG_CHAT = os.environ.get("OPS_TG_CHAT", "").strip()
COLOR = {"info": 0x2bc8bd, "ok": 0x2ee06a, "warn": 0xffb02e, "crit": 0xff4d1f}
ICON = {"info": "ℹ️", "ok": "✅", "warn": "⚠️", "crit": "🚨"}
NETCOLOR = {"mainnet": None, "testnet": 0x8f8db4}          # testnet embeds are grey whatever the level: never mistaken for mainnet
_last = [0.0, 0.0]


def _log(msg):
    print("notify: " + msg, file=sys.stderr, flush=True)


def discord(net, level, title, text="", fields=None, url=None):
    net = "testnet" if str(net).lower().startswith("test") else "mainnet"
    head = "%s %s | %s" % (ICON.get(level, ""), net.upper(), title)
    if not HOOK:
        _log("no DISCORD_WEBHOOK, not sent: " + head); return False
    emb = {"title": head[:250], "description": (text or "")[:3900],
           "color": NETCOLOR.get(net) or COLOR.get(level, COLOR["info"]),
           "author": {"name": "AtomOne %s" % net.upper()},
           "footer": {"text": "GATA AtomOne app, %s" % net},
           "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    if fields:
        emb["fields"] = [{"name": str(k)[:250], "value": str(v)[:1000] or "-", "inline": len(str(v)) <= 40}
                         for k, v in list(fields.items())[:24]]
    if url:
        emb["url"] = url
    body = json.dumps({"username": "AtomOne %s" % net.upper(), "embeds": [emb], "allowed_mentions": {"parse": []}}).encode()
    for attempt in range(3):
        gap = 0.5 - (time.time() - _last[0])           # Discord allows ~5 messages / 2 s per webhook
        if gap > 0: time.sleep(gap)
        req = urllib.request.Request(HOOK, data=body, method="POST",
                                     headers={"content-type": "application/json", "user-agent": "gata-atomone-app/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=15):
                _last[0] = time.time(); return True
        except urllib.error.HTTPError as e:
            if e.code == 429:
                try: wait = float(json.load(e).get("retry_after", 1))
                except Exception: wait = 2.0
                time.sleep(min(wait, 30)); continue
            _log("discord HTTP %d for %s" % (e.code, title)); return False
        except Exception as e:
            _log("discord unreachable (%s) for %s" % (type(e).__name__, title)); time.sleep(2)
    return False


def _esc(s):
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def ops(level, title, text="", fields=None, net="mainnet"):
    net = "testnet" if str(net).lower().startswith("test") else "mainnet"
    head = "%s <b>AtomOne app, %s</b>\n%s" % (ICON.get(level, ""), net.upper(), _esc(title))
    lines = [head] + ([_esc(text)] if text else []) + ["%s: <code>%s</code>" % (_esc(k), _esc(v)) for k, v in (fields or {}).items()]
    msg = "\n".join(lines)[:3900]
    if not (TG_TOKEN and TG_CHAT):
        _log("ops (no Telegram configured): %s | %s" % (title, text)); return False
    data = urllib.parse.urlencode({"chat_id": TG_CHAT, "text": msg, "parse_mode": "HTML", "disable_web_page_preview": "true"}).encode()
    for attempt in range(3):
        gap = 1.0 - (time.time() - _last[1])
        if gap > 0: time.sleep(gap)
        try:
            with urllib.request.urlopen(urllib.request.Request("https://api.telegram.org/bot%s/sendMessage" % TG_TOKEN, data=data), timeout=15):
                _last[1] = time.time(); return True
        except urllib.error.HTTPError as e:
            if e.code == 429:
                try: wait = float(json.load(e).get("parameters", {}).get("retry_after", 2))
                except Exception: wait = 2.0
                time.sleep(min(wait, 30)); continue
            _log("telegram HTTP %d for %s" % (e.code, title)); return False
        except Exception as e:
            _log("telegram unreachable (%s) for %s" % (type(e).__name__, title)); time.sleep(2)
    return False


def send(level, title, text="", fields=None, url=None, net="mainnet"):
    """old interface: operational, so it goes to ops"""
    return ops(level, title, text, fields, net)
