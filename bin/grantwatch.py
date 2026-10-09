#!/usr/bin/env python3
"""grantwatch: every Autopilot grant made to GATA, tracked through its life, alerts to Discord.

Every GRANT_SECONDS (120) it reads all authz grants to the Autopilot address (GRANTEE) and
keeps a ledger per delegator (STATE_DIR/grants-<net>.json) that the admin console reads:

    new        a grant arrived (the first 24 hours)          -> Discord: new grant (no approval: the keeper acts on its next run)
    active     standing, settled                              (a renewal or new terms -> Discord)
    expiring   standing, ends within 7 days                   -> Discord at 7 days and at 1 day
    expired    gone at or after its expiry                    -> Discord
    revoked    gone before its expiry, cap not used up         -> Discord
    used up    gone (or at 0) because its cap was spent        -> Discord

The cap (max_tokens) falls as moves are made; a fall with the same terms is use, not a change.
Restake (a MsgWithdrawDelegatorReward generic grant + a DELEGATE stake grant, no admin step) is
tracked on its own: Discord when a delegator turns it on or off. The plan, the 48-hour decision
clock and its reminders are the keeper's (it owns the plans); this watches the grants.
A fresh ledger records what already stands without alerting. Pause marks (set in the admin
console) live in the ledger too; the keeper skips a paused delegator.

    NET, ATOMONE_API, GRANTEE (else KEEPER_GRANTEE), DISCORD_WEBHOOK (via notify)
    grantwatch.py          run forever          grantwatch.py --once   one pass, print, send nothing
"""
import calendar, hashlib, json, os, queue, sqlite3, sys, threading, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import notify

NET = os.environ.get("NET", "mainnet")
API = os.environ.get("ATOMONE_API", "https://atomone-api.gatadao.com").rstrip("/")
GRANTEE = (os.environ.get("GRANTEE") or os.environ.get("KEEPER_GRANTEE") or "").strip()
EVERY = float(os.environ.get("GRANT_SECONDS", "120"))
STATE = os.path.join(os.environ.get("STATE_DIR", "/srv/atomone-app/state"), "grants-%s.json" % NET)
SITE = os.environ.get("SITE_URL", "https://atomone.gatahub.zone")
REDEL = "AUTHORIZATION_TYPE_REDELEGATE"
WDRAW = "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"
NEW_S, SOON_S, LAST_S = 86400, 7 * 86400, 86400
MAX_LIST = 64           # (red team 2026-10-01) a grant whose allow or deny list is longer is ignored: the page never builds more than ~31
BURST = 3               # more grant announcements than this in one poll go to Discord as one message


def log(*a): print("grantwatch:", *a, flush=True)


def get(path, timeout=30):
    with urllib.request.urlopen(urllib.request.Request(API + path, headers={"accept": "application/json"}), timeout=timeout) as r:
        return json.load(r)


def ts(iso):
    if not iso: return None
    return calendar.timegm(time.strptime(iso[:19], "%Y-%m-%dT%H:%M:%S"))     # UTC whatever the process TZ (audit 2026-09-30)


def fmt_atone(u): return "{:,.1f}".format((u or 0) / 1e6)


def day(t): return time.strftime("%-d %b %Y", time.gmtime(t)) if t else "no expiry"


def allow_sha(lst): return hashlib.sha1(json.dumps(sorted(lst or [])).encode()).hexdigest()[:16]


# (red team 2026-10-01) the ledger keeps the allow-list's count and sha1, not the list: a ledger entry written before
# carries "allow" and is read the same way
def allow_n(g): return g["allow_n"] if "allow_n" in g else len(g.get("allow") or [])


def allow_sig(g): return g.get("allow_sha") or allow_sha(g.get("allow"))


_BIG = set()
def too_long(g, a):
    """(red team 2026-10-01) an allow or deny list over MAX_LIST: that grant is ignored, logged once"""
    n = max(len((a.get("allow_list") or {}).get("address") or []), len((a.get("deny_list") or {}).get("address") or []))
    if n <= MAX_LIST: return False
    k = (g.get("granter"), a.get("@type"), a.get("authorization_type") or a.get("msg"))
    if k not in _BIG: _BIG.add(k); log("ignored a grant from %s: a validator list of %d (over %d)" % (g.get("granter"), n, MAX_LIST))
    return True


def standing():
    """delegator -> the terms of what they granted us now"""
    out, key = {}, ""
    while True:
        d = get("/cosmos/authz/v1beta1/grants/grantee/%s?pagination.limit=200" % GRANTEE + ("&pagination.key=" + urllib.parse.quote(key) if key else ""))
        for g in d.get("grants", []):
            a, r = g.get("authorization", {}), out.setdefault(g["granter"], {})
            t = a.get("@type", "")
            exp = ts(g.get("expiration"))
            if too_long(g, a): continue
            if t.endswith("StakeAuthorization") and a.get("authorization_type") == REDEL:
                cap = a.get("max_tokens")
                lst = (a.get("allow_list") or {}).get("address") or []
                r.update({"cap": int(cap["amount"]) if cap and cap.get("denom") == "uatone" else None,
                          "allow_n": len(lst), "allow_sha": allow_sha(lst), "exp": exp})
            elif t.endswith("StakeAuthorization") and a.get("authorization_type") == "AUTHORIZATION_TYPE_DELEGATE":
                r["restake"] = True
            elif t.endswith("GenericAuthorization") and a.get("msg") == WDRAW:
                r["claim"] = True
        key = (d.get("pagination") or {}).get("next_key")
        if not key: break
    return out


def autopilot(allg): return {k: v for k, v in allg.items() if "exp" in v}


def restaking(allg): return {k for k, v in allg.items() if v.get("restake") and v.get("claim")}


def granted(granter):
    """when the delegator's latest grant to us was made, and its transaction"""
    try:
        q = urllib.parse.quote("message.action='/cosmos.authz.v1beta1.MsgGrant' AND message.sender='%s'" % granter)
        for t in get("/cosmos/tx/v1beta1/txs?query=%s&pagination.limit=5&order_by=ORDER_BY_DESC" % q).get("tx_responses", []):
            if any(m.get("grantee") == GRANTEE for m in t["tx"]["body"]["messages"]):
                return ts(t.get("timestamp")), t.get("txhash")
    except Exception as e:
        log("grant lookup failed for %s: %s" % (granter, e))
    return None, None


def short(a): return a[:12] + "\u2026" + a[-6:]


def cap(g): return "no cap" if g.get("cap") is None else fmt_atone(g.get("cap")) + " ATONE"


def when(t): return time.strftime("%-d %b %H:%M UTC", time.gmtime(t))


def revoked(granter, since):
    """did the delegator sign a MsgRevoke to us since the grant was made? (unknown -> True)"""
    try:
        q = urllib.parse.quote("message.action='/cosmos.authz.v1beta1.MsgRevoke' AND message.sender='%s'" % granter)
        for t in get("/cosmos/tx/v1beta1/txs?query=%s&pagination.limit=10&order_by=ORDER_BY_DESC" % q).get("tx_responses", []):
            if (ts(t.get("timestamp")) or 0) >= since and any(m.get("grantee") == GRANTEE for m in t["tx"]["body"]["messages"]):
                return True
        return False
    except Exception:
        return True


def load():
    """a missing ledger starts fresh; one that exists and does not parse stops the watcher (the state audit, 2026-10-01):
    starting over would lose every grant's history and fire nothing"""
    if not os.path.exists(STATE): return {"grantee": GRANTEE, "grants": {}, "events": [], "started": None}
    return json.load(open(STATE))


def save(s):
    tmp = os.path.join(os.path.dirname(STATE), "." + os.path.basename(STATE) + ".tmp")
    with open(tmp, "w") as f:
        json.dump(s, f); f.flush(); os.fsync(f.fileno())
    os.replace(tmp, STATE)


# the counts over time, the milestones and every grant event, in SQLite beside the ledger (restic covers state/)
DBP = os.path.join(os.path.dirname(STATE), "grants-%s.db" % NET)
def gdb():
    c = sqlite3.connect(DBP); c.execute("PRAGMA journal_mode=WAL"); c.execute("PRAGMA busy_timeout=5000")
    c.execute("CREATE TABLE IF NOT EXISTS milestone(metric TEXT, threshold INT, value INT, reached_at INT, announced_at INT, PRIMARY KEY(metric, threshold))")
    c.execute("CREATE TABLE IF NOT EXISTS svc_count(at INT, service TEXT, users INT, uatone INT, PRIMARY KEY(at, service))")
    c.execute("CREATE TABLE IF NOT EXISTS grant_event(id INTEGER PRIMARY KEY, at INT, granter TEXT, service TEXT, what TEXT, title TEXT)")
    c.execute("CREATE INDEX IF NOT EXISTS ix_grant_event ON grant_event(granter, at)")
    return c


def terms(g): return (allow_sig(g), g.get("exp"), bool(g.get("restake")))


def step(L, allg, now=None):
    """update the ledger from what stands; return the events to announce"""
    now = now or int(time.time())
    first = L.get("started") is None
    ev, G = [], L["grants"]
    now_grants = autopilot(allg)
    # restake: on and off, per delegator (no admin step, so an alert is all it needs)
    R, on = L.setdefault("restake", {}), restaking(allg)
    for gr in sorted(on - set(R)):
        R[gr] = {"since": now}
        if not first: ev.append(("info", "Restake enabled: " + short(gr), "Rewards are claimed and staked again every 12 hours, from 1 ATONE.", {"Delegator": gr}))
    for gr in sorted(set(R) - on):
        R.pop(gr, None)
        ev.append(("info", "Restake disabled: " + short(gr), "The delegator revoked the restake grant.", {"Delegator": gr}))
    for gr, g in now_grants.items():
        e = G.get(gr)
        live = e and e.get("status") in ("new", "active", "expiring")
        if not live:
            made, tx = granted(gr) if not first else (None, None)
            G[gr] = {"granter": gr, "first_seen": now, "made": made or now, "tx": tx,
                     "status": "new", "grant": g, "cap0": g.get("cap"), "warned": [], "paused": (e or {}).get("paused", False),
                     "history": ((e or {}).get("history") or [])[-20:] + [{"at": now, "what": "granted"}]}
            if not first:
                ev.append(("info", "New Autopilot grant: " + short(gr), "Autopilot runs every 12 hours with no approval step: the first move, if one earns 5 APR points more, is made on its next run.", {
                    "Delegator": gr, "Cap": cap(g), "Validators": str(allow_n(g)) if allow_n(g) else "any, the rule picks",
                    "Restake": "on" if gr in on else "off"}))
            continue
        old = e["grant"]
        if terms(old) != terms(g) or (g.get("cap") or 0) > (old.get("cap") or 0):
            e["history"].append({"at": now, "what": "changed"})
            e["cap0"], e["warned"] = g.get("cap"), []
            ev.append(("info", "Autopilot grant changed: " + short(gr), "The delegator changed the validators or the cap. The keeper plans again.", {
                "Delegator": gr, "Cap": cap(g), "Validators": str(allow_n(g)) if allow_n(g) else "any, the rule picks", "Restake": "on" if gr in on else "off"}))
        e["grant"] = g
        left = (g.get("exp") or 0) - now if g.get("exp") else None
        e["status"] = "expiring" if left is not None and left <= SOON_S else ("new" if now - e["first_seen"] < NEW_S else "active")
        for mark, limit, level in (("7d", SOON_S, "warn"), ("1d", LAST_S, "warn")):
            if left is not None and 0 < left <= limit and mark not in e["warned"]:
                e["warned"].append(mark)
                if not first:
                    ev.append((level, "Autopilot grant ends %s: %s" % ("in a day" if mark == "1d" else "within a week", short(gr)),
                               "The delegator can renew it from the Autopilot screen.", {"Delegator": gr, "Ends": day(g.get("exp"))}))
    for gr, e in G.items():
        if gr in now_grants or e.get("status") not in ("new", "active", "expiring"): continue
        g = e["grant"]
        # the chain deletes a grant when its cap reaches zero, often while the last reading still
        # showed some left: gone early is 'revoked' only if the delegator signed a MsgRevoke
        if g.get("exp") and g["exp"] <= now + 60: st, text = "expired", "It reached its end date."
        elif revoked(gr, e.get("made") or e["first_seen"]): st, text = "revoked", "The delegator withdrew the authorisation."
        else: st, text = "used up", "Its cap was spent on moves."
        e["status"], e["ended"] = st, now
        e["history"].append({"at": now, "what": st})
        ev.append(("warn" if st == "revoked" else "info", "Autopilot grant %s: %s" % (st, short(gr)), text + " Nothing waits for an operator any more.",
                   {"Delegator": gr, "Was": cap({"cap": e.get("cap0")}) + ", " + str(allow_n(g)) + " validators", "Since": day(e.get("made"))}))
    if first: L["started"] = now
    for level, title, text, fields in ev:
        L["events"].append({"at": now, "level": level, "title": title, "delegator": fields.get("Delegator")})
    L["events"] = L["events"][-500:]
    L["grantee"], L["checked"] = GRANTEE, now
    L["counts"] = {s: sum(1 for e in G.values() if e.get("status") == s) for s in ("new", "active", "expiring", "expired", "revoked", "used up")}
    return ev


# ── Discord (operator, 2026-10-01): a new Autopilot or Restake grant with the live counts, and the milestones ──────
# Every other ledger event (changed, revoked, used up, expiring, Restake off) stays in the ledger and the admin
# console only. Counts: wallets holding the grant now; ATONE: what those wallets have staked.
USERS_AT = (20, 50, 100)
ATONE_AT = (200_000, 500_000, 1_000_000)
_stk = {}
def staked(granter):
    """the wallet's total delegated ATONE (uatone), read at most every 10 minutes"""
    hit = _stk.get(granter)
    if hit and time.time() - hit[0] < 600: return hit[1]
    try:
        d = get("/cosmos/staking/v1beta1/delegations/%s?pagination.limit=500" % granter)
        u = sum(int(x["balance"]["amount"]) for x in d.get("delegation_responses", []))
        _stk[granter] = (time.time(), u); return u
    except Exception:
        return hit[1] if hit else 0

def totals(L):
    ap = [g for g, e in L["grants"].items() if e.get("status") in ("new", "active", "expiring")]
    rs = list((L.get("restake") or {}).keys())
    return {"autopilot": (len(ap), sum(staked(g) for g in ap)), "restake": (len(rs), sum(staked(g) for g in rs))}

# (red team 2026-10-01) Discord is sent from one daemon thread, in order: a slow or failing webhook never holds the poll
_Q, _W = queue.Queue(maxsize=200), []
def _worker():
    while True:
        job = _Q.get()
        try: job()
        except Exception as e: log("discord job failed: %s" % e)


def later(job):
    if not _W:
        t = threading.Thread(target=_worker, name="discord", daemon=True); t.start(); _W.append(t)
    try: _Q.put_nowait(job)
    except queue.Full: log("discord queue full, a message dropped")


def disc(level, title, text, fields):
    later(lambda: notify.discord(NET, level, title, text, fields, SITE + "/admin"))


def announce(L, ev):
    """the two grant events of this step as sentences, Autopilot and Restake never in one message (operator, 2026-10-09:
    an admin watch, no explanations), with the service's total as it stands after it. More than BURST of one service
    in one poll: one message for that service listing every address (red team 2026-10-01: a flood is one message)"""
    want = [e for e in ev if e[1].startswith("New Autopilot grant") or e[1].startswith("Restake enabled")]
    if not want: return
    T = totals(L)
    for svc, name, prefix, did in (("autopilot", "Autopilot", "New Autopilot grant", "granted Autopilot"),
                                   ("restake", "Restake", "Restake enabled", "turned on Restake")):
        grs = [e[3].get("Delegator") for e in want if e[1].startswith(prefix)]
        if not grs: continue
        tot = "%s now has %d wallets and {:,.1f} ATONE staked.".format(T[svc][1] / 1e6) % (name, T[svc][0])
        if len(grs) <= BURST:
            for gr in grs:
                disc("ok", "New Autopilot grant" if svc == "autopilot" else "Restake turned on",
                     "`%s` %s with {:,.2f} ATONE staked.\n%s".format(staked(gr) / 1e6) % (gr, did, tot), None)
            continue
        text, n = "%d wallets %s in one check:\n" % (len(grs), did), 0
        for gr in grs:
            ln = "`%s` {:,.2f} ATONE\n".format(staked(gr) / 1e6) % gr
            if len(text) + len(ln) + 120 > 3800: break
            text += ln; n += 1
        if n < len(grs): text += "and %d more (the admin console lists them all)\n" % (len(grs) - n)
        disc("ok", "%d new %s" % (len(grs), "Autopilot grants" if svc == "autopilot" else "Restake wallets"), text + tot, None)

def milestones(L, c):
    """20 / 50 / 100 users and 200k / 500k / 1M ATONE, per service, each announced once (a row in `milestone`). The very
    first pass (no counts recorded yet) marks what already stands without announcing it; the counts go to svc_count"""
    T, now = totals(L), int(time.time())
    quiet, jobs = not c.execute("SELECT 1 FROM svc_count LIMIT 1").fetchone(), []
    for svc in ("autopilot", "restake"):
        c.execute("INSERT OR REPLACE INTO svc_count VALUES(?,?,?,?)", (now, svc, T[svc][0], T[svc][1]))
    for svc, name in (("autopilot", "Autopilot"), ("restake", "Restake")):
        users, uatone = T[svc]
        for metric, value, marks, title, text in (
                (svc + "_users", users, USERS_AT, lambda n: "%s reached %d users" % (name, n),
                 "%d wallets hold the %s grant, {:,.1f} ATONE staked.".format(uatone / 1e6) % (users, name)),
                (svc + "_atone", uatone // 1_000_000, ATONE_AT, lambda a: "%s reached {:,} ATONE".format(a) % name,
                 "{:,.1f} ATONE staked by %d %s wallets.".format(uatone / 1e6) % (users, name))):
            for n in marks:
                if value < n or c.execute("SELECT 1 FROM milestone WHERE metric=? AND threshold=?", (metric, n)).fetchone(): continue
                c.execute("INSERT INTO milestone VALUES(?,?,?,?,?)", (metric, n, value, now, now if quiet else None))
                if not quiet: jobs.append((metric, n, title(n), text, None))
    c.commit()
    # sent from the Discord thread, which marks announced_at on its own connection once it went (red team 2026-10-01)
    for metric, n, title_, text_, f in jobs:
        later(lambda m=metric, k=n, t=title_, x=text_, f=f: _ms_sent(m, k) if notify.discord(NET, "ok", t, x, f, SITE + "/admin") else None)


def _ms_sent(metric, n):
    c2 = sqlite3.connect(DBP, timeout=5)
    try: c2.execute("UPDATE milestone SET announced_at=? WHERE metric=? AND threshold=?", (int(time.time()), metric, n)); c2.commit()
    finally: c2.close()


def main():
    once = "--once" in sys.argv
    if not GRANTEE:
        log("no Autopilot address set (GRANTEE/KEEPER_GRANTEE) for %s: idle" % NET)
        L = load(); L["grantee"] = None; L["checked"] = int(time.time())
        if not once: save(L)
        if once: return
        while True:
            time.sleep(600)
            if (os.environ.get("GRANTEE") or os.environ.get("KEEPER_GRANTEE")): break
        return
    L, fails, mtick = load(), 0, 0
    c = gdb()
    while True:
        try:
            ev = step(L, standing())
            for level, title, text, fields in ev:
                log(level, title, fields.get("Delegator"))
            if once:
                print(json.dumps(L["counts"]), [e[1] for e in ev]); return
            for level, title, text, fields in ev:          # every event, kept for good
                c.execute("INSERT INTO grant_event(at, granter, service, what, title) VALUES(?,?,?,?,?)", (int(time.time()), fields.get("Delegator"),
                          "restake" if title.startswith("Restake") else "autopilot", title.split(":")[0], title))
            c.commit()
            save(L); fails = 0
            announce(L, ev)
            # milestones every 10 minutes and after any event (the first pass marks what already stands, silently)
            if ev or time.time() - mtick >= 600:
                milestones(L, c); mtick = time.time()
        except Exception as e:
            fails += 1; log("read failed: %s" % e)
            if fails == 10: notify.ops("warn", "Grant watch cannot read the chain", str(e)[:300], net=NET)
        time.sleep(EVERY)


if __name__ == "__main__":
    main()
