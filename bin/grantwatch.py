#!/usr/bin/env python3
"""grantwatch: every Autopilot grant made to GATA, tracked through its life, alerts to Discord.

Every GRANT_SECONDS (120) it reads all authz grants to the Autopilot address (GRANTEE) and
keeps a ledger per delegator (STATE_DIR/grants-<net>.json) that the admin console reads:

    new        a grant arrived (the first 24 hours)          -> Discord: new grant
    active     standing, settled                              (a renewal or new terms -> Discord)
    expiring   standing, ends within 7 days                   -> Discord at 7 days and at 1 day
    expired    gone at or after its expiry                    -> Discord
    revoked    gone before its expiry, cap not used up         -> Discord
    used up    gone (or at 0) because its cap was spent        -> Discord

The cap (max_tokens) falls as moves are made; a fall with the same terms is use, not a change.
A fresh ledger records what already stands without alerting. Pause marks (set in the admin
console) live in the ledger too; the keeper skips a paused delegator.

    NET, ATOMONE_API, GRANTEE (else KEEPER_GRANTEE), DISCORD_WEBHOOK (via notify)
    grantwatch.py          run forever          grantwatch.py --once   one pass, print, send nothing
"""
import json, os, sys, time, urllib.parse, urllib.request

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


def log(*a): print("grantwatch:", *a, flush=True)


def get(path, timeout=30):
    with urllib.request.urlopen(urllib.request.Request(API + path, headers={"accept": "application/json"}), timeout=timeout) as r:
        return json.load(r)


def ts(iso):
    if not iso: return None
    return int(time.mktime(time.strptime(iso[:19], "%Y-%m-%dT%H:%M:%S")) - time.timezone)


def fmt_atone(u): return "{:,.1f}".format((u or 0) / 1e6)


def day(t): return time.strftime("%-d %b %Y", time.gmtime(t)) if t else "no expiry"


def standing():
    """delegator -> the terms of what they granted us now"""
    out, key = {}, ""
    while True:
        d = get("/cosmos/authz/v1beta1/grants/grantee/%s?pagination.limit=200" % GRANTEE + ("&pagination.key=" + urllib.parse.quote(key) if key else ""))
        for g in d.get("grants", []):
            a, r = g.get("authorization", {}), out.setdefault(g["granter"], {})
            t = a.get("@type", "")
            exp = ts(g.get("expiration"))
            if t.endswith("StakeAuthorization") and a.get("authorization_type") == REDEL:
                cap = a.get("max_tokens")
                r.update({"cap": int(cap["amount"]) if cap and cap.get("denom") == "uatone" else None,
                          "allow": (a.get("allow_list") or {}).get("address") or [], "exp": exp})
            elif t.endswith("StakeAuthorization") and a.get("authorization_type") == "AUTHORIZATION_TYPE_DELEGATE":
                r["restake"] = True
            elif t.endswith("GenericAuthorization") and a.get("msg") == WDRAW:
                r["claim"] = True
            elif t.endswith("SendAuthorization"):
                r["split"] = sum(int(x["amount"]) for x in a.get("spend_limit", []) if x.get("denom") == "uatone")
        key = (d.get("pagination") or {}).get("next_key")
        if not key: break
    return {k: v for k, v in out.items() if "exp" in v}


def strategy(granter):
    """the strategy word the page wrote into the grant's memo (and when the grant was made)"""
    try:
        q = urllib.parse.quote("message.action='/cosmos.authz.v1beta1.MsgGrant' AND message.sender='%s'" % granter)
        for t in get("/cosmos/tx/v1beta1/txs?query=%s&pagination.limit=5&order_by=ORDER_BY_DESC" % q).get("tx_responses", []):
            if any(m.get("grantee") == GRANTEE for m in t["tx"]["body"]["messages"]):
                memo = (t["tx"]["body"].get("memo") or "").lower()
                word = memo[5:].split(":")[0] if memo.startswith("gata:") else "moderate"
                return word, ts(t.get("timestamp")), t.get("txhash")
    except Exception as e:
        log("strategy lookup failed for %s: %s" % (granter, e))
    return None, None, None


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
    try: return json.load(open(STATE))
    except Exception: return {"grantee": GRANTEE, "grants": {}, "events": [], "started": None}


def save(s):
    tmp = STATE + ".tmp"
    json.dump(s, open(tmp, "w")); os.replace(tmp, STATE)


def terms(g): return (sorted(g.get("allow") or []), g.get("exp"), bool(g.get("restake")))


def step(L, now_grants, now=None):
    """update the ledger from what stands; return the events to announce"""
    now = now or int(time.time())
    first = L.get("started") is None
    ev, G = [], L["grants"]
    for gr, g in now_grants.items():
        e = G.get(gr)
        live = e and e.get("status") in ("new", "active", "expiring")
        if not live:
            word, made, tx = strategy(gr) if not first else (None, None, None)
            G[gr] = {"granter": gr, "first_seen": now, "made": made or now, "tx": tx, "strategy": word or "moderate",
                     "status": "new", "grant": g, "cap0": g.get("cap"), "warned": [], "paused": (e or {}).get("paused", False),
                     "history": ((e or {}).get("history") or [])[-20:] + [{"at": now, "what": "granted"}]}
            if not first:
                ev.append(("info", "New Autopilot grant", "A delegator authorised GATA's Autopilot.", {
                    "Delegator": gr, "Strategy": word or "moderate", "May move": fmt_atone(g.get("cap")) + " ATONE",
                    "Validators": str(len(g.get("allow") or [])), "Until": day(g.get("exp")),
                    "Restake": "yes" if g.get("restake") else "no"}))
            continue
        old = e["grant"]
        if terms(old) != terms(g) or (g.get("cap") or 0) > (old.get("cap") or 0):
            e["history"].append({"at": now, "what": "changed"})
            e["cap0"], e["warned"] = g.get("cap"), []
            word, made, tx = strategy(gr)
            if word: e["strategy"] = word
            ev.append(("info", "Autopilot grant renewed", "A delegator changed or renewed their Autopilot grant.", {
                "Delegator": gr, "May move": fmt_atone(g.get("cap")) + " ATONE", "Validators": str(len(g.get("allow") or [])),
                "Until": day(g.get("exp")), "Restake": "yes" if g.get("restake") else "no"}))
        e["grant"] = g
        left = (g.get("exp") or 0) - now if g.get("exp") else None
        e["status"] = "expiring" if left is not None and left <= SOON_S else ("new" if now - e["first_seen"] < NEW_S else "active")
        for mark, limit, level in (("7d", SOON_S, "warn"), ("1d", LAST_S, "warn")):
            if left is not None and 0 < left <= limit and mark not in e["warned"]:
                e["warned"].append(mark)
                if not first:
                    ev.append((level, "Autopilot grant ends %s" % ("in a day" if mark == "1d" else "within a week"),
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
        ev.append(("warn" if st == "revoked" else "info", "Autopilot grant %s" % st, text,
                   {"Delegator": gr, "Was": fmt_atone(e.get("cap0")) + " ATONE, " + str(len(g.get("allow") or [])) + " validators", "Since": day(e.get("made"))}))
    if first: L["started"] = now
    for level, title, text, fields in ev:
        L["events"].append({"at": now, "level": level, "title": title, "delegator": fields.get("Delegator")})
    L["events"] = L["events"][-500:]
    L["grantee"], L["checked"] = GRANTEE, now
    L["counts"] = {s: sum(1 for e in G.values() if e.get("status") == s) for s in ("new", "active", "expiring", "expired", "revoked", "used up")}
    return ev


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
    L, fails = load(), 0
    while True:
        try:
            ev = step(L, standing())
            for level, title, text, fields in ev:
                log(level, title, fields.get("Delegator"))
                if not once: notify.send(level, title, text, fields, SITE + "/#/admin" if NET == "mainnet" else None, net=NET)
            if once:
                print(json.dumps(L["counts"]), [e[1] for e in ev]); return
            save(L); fails = 0
        except Exception as e:
            fails += 1; log("read failed: %s" % e)
            if fails == 10: notify.send("warn", "Grant watch cannot read the chain", str(e)[:300], net=NET)
        time.sleep(EVERY)


if __name__ == "__main__":
    main()
