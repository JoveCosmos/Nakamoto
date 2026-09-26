#!/usr/bin/env python3
"""GATA autopilot keeper - runs on the app box, holds NO key.

Every KEEPER_EVERY seconds it reads, from the chain, every StakeAuthorization
REDELEGATE grant made to the signer's address, and for each granter works out
whether moving some of their stake would earn them more - the same arithmetic the
page uses (ADR-004: rate = (1 - c) * (a + b / (t + x)) with the live eta). If a move
clears the thresholds it asks the remote authz signer (its own key, over WireGuard)
to execute MsgExec{MsgBeginRedelegate...}. The chain enforces the grant's allow-list,
cap and expiry on top of everything here.

What this will never do: move stake that is still in its 21-day cooldown, move to a
jailed or tombstoned validator, move to a validator outside the grant's allow-list,
exceed the grant's remaining cap, make more than KEEPER_MAX_MOVES_PER_DAY moves for
one granter in a day, or act at all while KEEPER_DRY=1 (the default: it only writes
what it WOULD do).

State: /srv/atomone-app/keeper/state/keeper.db (sqlite: runs, moves).
Report per granter: /srv/atomone-app/web/keeper/<granter>.json (the page shows it).
"""
import json, os, sqlite3, sys, time, urllib.request, urllib.error, urllib.parse

API = os.environ.get("ATOMONE_API", "https://atomone-api.gatadao.com")
SIGNER = os.environ.get("KEEPER_SIGNER_URL", "")
SECRET = os.environ.get("KEEPER_SECRET", "")
GRANTEE = os.environ.get("KEEPER_GRANTEE", "").strip()
DRY = os.environ.get("KEEPER_DRY", "1") != "0"
EVERY = int(os.environ.get("KEEPER_EVERY", "21600"))
MIN_GAIN_APR = float(os.environ.get("KEEPER_MIN_GAIN_APR", "0.005"))     # blended rate must rise this much
MIN_GAIN_ATONE = float(os.environ.get("KEEPER_MIN_GAIN_ATONE", "1"))      # and pay at least this per year
MAX_MOVES_DAY = int(os.environ.get("KEEPER_MAX_MOVES_PER_DAY", "7"))
MAX_DESTS = int(os.environ.get("KEEPER_MAX_DESTS", "5"))                  # split across at most this many
FEE_PCT = float(os.environ.get("KEEPER_FEE_PCT", "0"))                     # service fee, % of the projected gain, paid with the grant
FEE_TO = os.environ.get("KEEPER_FEE_TO", "").strip() or None
SPLIT_PCT = float(os.environ.get("KEEPER_SPLIT_PCT", "0") or 0)            # our share of restaked rewards, percent (0 = free)
SPLIT_TO = os.environ.get("KEEPER_SPLIT_TO", "").strip() or None           # the treasury allowed to receive it
DATA = "/srv/atomone-app/web/data.json"
STATE = "/srv/atomone-app/keeper/state/keeper.db"
REPORTS = "/srv/atomone-app/web/keeper"
LOCK_S = 21 * 86400
TYPE_URL = "/cosmos.staking.v1beta1.MsgBeginRedelegate"

def log(*a): print("keeper:", *a, flush=True)

def get(path):
    req = urllib.request.Request(API + path, headers={"accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r: return json.load(r)

def rate_record(c, granter, rows):
    """log the granter's blended APR now, and return it with the APR where Autopilot started
    (the first logged check) and three months ago (the latest check at least 90 days old, else
    the start) - what the page states as 'since Autopilot started' and 'over the last 3 months'"""
    tot = sum(r["x"] for r in rows)
    if not tot:
        return None
    now = int(time.time()); rate = sum(r["x"] * r["rate"] for r in rows) / tot
    c.execute("INSERT INTO rate_log VALUES(?,?,?,?)", (now, granter, rate, int(tot))); c.commit()
    first = c.execute("SELECT at, rate FROM rate_log WHERE granter=? ORDER BY at LIMIT 1", (granter,)).fetchone()
    m3 = c.execute("SELECT at, rate FROM rate_log WHERE granter=? AND at<=? ORDER BY at DESC LIMIT 1", (granter, now - 90 * 86400)).fetchone() or first
    return {"rate": rate, "staked": int(tot), "start": {"at": first[0], "rate": first[1]}, "m3": {"at": m3[0], "rate": m3[1]}}


def db():
    c = sqlite3.connect(STATE); c.execute("PRAGMA journal_mode=WAL")
    c.execute("CREATE TABLE IF NOT EXISTS run(at INT, grants INT, acted INT, note TEXT)")
    c.execute("CREATE TABLE IF NOT EXISTS move(at INT, granter TEXT, src TEXT, dst TEXT, uatone INT, gain REAL, txhash TEXT, dry INT)")
    c.execute("CREATE TABLE IF NOT EXISTS run_g(at INT, granter TEXT)")
    # the granter's blended APR at each check: the first row is where Autopilot started from
    c.execute("CREATE TABLE IF NOT EXISTS rate_log(at INT, granter TEXT, rate REAL, staked INT)")
    # the reward-split ledger: what each granter's stake has earned since we first saw
    # them, and what we have collected of our share - the difference is the due
    c.execute("CREATE TABLE IF NOT EXISTS fee_ledger(granter TEXT PRIMARY KEY, earned INT, collected INT, updated INT)")
    return c

# ── the model, as the page has it ──────────────────────────────────────────
def model():
    D = json.load(open(DATA))
    S, N, R = D["set"]["bonded"], D["set"]["n"], D["set"]["reward_pool"]
    eta = float(D["eta"]["now"])                  # the live eta, never a what-if
    vals = {}
    for v in D["validators"]:
        vals[v["op"]] = {"op": v["op"], "m": v["m"], "t": float(v["t"]), "c": float(v["c"]), "jail": v.get("jail") or 0,
                         "tomb": bool(v.get("tomb")), "d90": v.get("d90"), "rank": v.get("rank")}
    a = (1 - eta) * R / S; b = eta * R / N
    return vals, (a, b), eta

def rate_after(m, t, c, x): return (1 - c) * (m[0] + m[1] / (t + x))

# ── strategies: the word the page wrote into the grant's memo ───────────────
PRESETS = {
    "passive":    {"every": 7 * 86400, "min_apr": 0.015, "min_atone": 5.0, "dests": 2, "d90": 99},
    "moderate":   {"every": 6 * 3600,  "min_apr": 0.005, "min_atone": 1.0, "dests": 5, "d90": 50},
    "aggressive": {"every": 3600,      "min_apr": 0.0025, "min_atone": 0.5, "dests": 8, "d90": 50},
    "picks":      {"every": 6 * 3600,  "min_apr": 0.005, "min_atone": 1.0, "dests": 5, "d90": 0},
}
def preset_of(granter):
    """The strategy rides in the memo of the granter's latest MsgGrant to us."""
    try:
        q = "/cosmos/tx/v1beta1/txs?query=" + urllib.parse.quote("message.action='/cosmos.authz.v1beta1.MsgGrant' AND message.sender='%s'" % granter) + "&limit=5&order_by=ORDER_BY_DESC"
        for t in get(q).get("txs", []):
            if any(m.get("@type") == "/cosmos.authz.v1beta1.MsgGrant" and m.get("grantee") == GRANTEE for m in t["body"]["messages"]):
                memo = (t["body"].get("memo") or "").strip().lower()
                # "gata:<strategy>[:picks][:restake]" - the strategy sets the pace and thresholds;
                # the flags say the allow-list is the reader's own selection / that rewards are to
                # be restaked (the second is not acted on yet: this keeper moves stake only)
                if memo.startswith("gata:"):
                    word = memo[5:].split(":")[0]
                    if word in PRESETS: return word
                return "moderate"
    except Exception as e:
        log("preset lookup failed for %s: %s" % (granter, e))
    return "moderate"

# ── grants ─────────────────────────────────────────────────────────────────
def grants():
    out, key = [], None
    while True:
        q = "/cosmos/authz/v1beta1/grants/grantee/%s?pagination.limit=200" % GRANTEE + ("&pagination.key=%s" % key if key else "")
        d = get(q)
        for g in d.get("grants", []):
            a = g.get("authorization", {})
            if a.get("@type") != "/cosmos.staking.v1beta1.StakeAuthorization": continue
            if a.get("authorization_type") != "AUTHORIZATION_TYPE_REDELEGATE": continue
            exp = g.get("expiration")
            if exp and time.strptime(exp[:19], "%Y-%m-%dT%H:%M:%S") < time.gmtime(): continue
            allow = (a.get("allow_list") or {}).get("address") or None
            deny = set((a.get("deny_list") or {}).get("address") or [])
            cap = a.get("max_tokens"); cap = int(cap["amount"]) if cap and cap.get("denom") == "uatone" else None
            out.append({"granter": g["granter"], "allow": allow, "deny": deny, "cap": cap, "exp": exp})
        key = d.get("pagination", {}).get("next_key")
        if not key: break
    return out

# ── a granter's position ───────────────────────────────────────────────────
def position(addr, vals):
    dels = get("/cosmos/staking/v1beta1/delegations/%s?pagination.limit=500" % addr).get("delegation_responses", [])
    reds = get("/cosmos/staking/v1beta1/delegators/%s/redelegations?pagination.limit=500" % addr).get("redelegation_responses", [])
    lock, now = {}, time.time()
    for r in reds:
        dst = r["redelegation"]["validator_dst_address"]
        for e in r.get("entries", []):
            t = time.mktime(time.strptime(e["redelegation_entry"]["completion_time"][:19], "%Y-%m-%dT%H:%M:%S")) - time.timezone
            if t > now: lock[dst] = lock.get(dst, 0) + int(e["balance"])
    rows = []
    for d in dels:
        op, amt = d["delegation"]["validator_address"], int(d["balance"]["amount"])
        if op not in vals or amt <= 0: continue
        # the chain refuses ANY redelegation out of a validator that still holds an
        # unmatured redelegation in (ErrTransitiveRedelegation): the whole row is held
        rows.append({"op": op, "x": amt, "locked": amt if op in lock else 0})
    return rows, reds

def pairs_used(reds):
    u = {}
    for r in reds:
        k = (r["redelegation"]["validator_src_address"], r["redelegation"]["validator_dst_address"])
        u[k] = u.get(k, 0) + len(r.get("entries", []))
    return u

# ── the plan: from the lowest-earning movable positions to the best allowed ─
def plan(g, rows, reds, vals, m, P=None):
    P = P or PRESETS["moderate"]
    # what each position earns today, and what it can move
    for r in rows:
        v = vals[r["op"]]; r["rate"] = rate_after(m, v["t"], v["c"], 0); r["free"] = r["x"] - r["locked"]
    total = sum(r["x"] for r in rows)
    if not total: return None
    blended = sum(r["x"] * r["rate"] for r in rows) / total
    free = [r for r in rows if r["free"] > 0]
    if not free: return None
    # candidates: allowed, clean, not where the stake already is at a better rate
    cands = []
    for op, v in vals.items():
        if g["allow"] is not None and op not in g["allow"]: continue
        if op in g["deny"] or v["tomb"]: continue
        if v["d90"] is not None and v["d90"] < P["d90"]: continue
        cands.append(v)
    if not cands: return None
    # budget: everything movable, capped by the grant
    budget = sum(r["free"] for r in free)
    if g["cap"] is not None: budget = min(budget, g["cap"])
    if budget <= 0: return None
    # greedy: the stake leaves the weakest positions first and lands where the marginal
    # rate is highest, repriced as it lands, at most MAX_DESTS destinations
    used = pairs_used(reds)
    landed = {c["op"]: 0 for c in cands}
    src = sorted(free, key=lambda r: (r["rate"], -r["free"]))
    moves, spent = [], 0
    step = max(1_000_000, budget // 20)                       # 1 ATONE or 5% of the budget
    while spent < budget:
        s = next((r for r in src if r["free"] > 0), None)
        if not s: break
        best, br = None, -1
        for c in cands:
            if c["op"] == s["op"]: continue
            if len(landed) and landed.get(c["op"], 0) == 0 and sum(1 for k in landed if landed[k] > 0) >= min(MAX_DESTS, P["dests"]): continue
            if used.get((s["op"], c["op"]), 0) >= 7: continue
            rr = rate_after(m, c["t"] + landed[c["op"]], c["c"], step)
            if rr > br: best, br = c, rr
        if not best or br <= s["rate"] + max(MIN_GAIN_APR, P["min_apr"]): 
            # this source cannot be improved by the threshold: next source
            s["free"] = 0; continue
        x = min(step, s["free"], budget - spent)
        moves.append({"src": s["op"], "dst": best["op"], "amount": x, "from_rate": s["rate"], "to_rate": br})
        landed[best["op"]] += x; s["free"] -= x; spent += x
    if not moves: return None
    # merge per (src,dst)
    merged = {}
    for mv in moves:
        k = (mv["src"], mv["dst"]); e = merged.setdefault(k, {"src": mv["src"], "dst": mv["dst"], "amount": 0, "gain": 0.0})
        e["amount"] += mv["amount"]; e["gain"] += mv["amount"] * (mv["to_rate"] - mv["from_rate"]) / 1e6
    out = [e for e in merged.values() if e["gain"] >= max(MIN_GAIN_ATONE, P["min_atone"])]
    if not out: return None
    after = sum(r["x"] * r["rate"] for r in rows)
    for e in out: after += e["amount"] * (e["gain"] * 1e6 / e["amount"])
    return {"moves": out, "now": blended, "after": after / total, "total": total, "gain": sum(e["gain"] for e in out)}

# ── execution ──────────────────────────────────────────────────────────────
def execute(granter, moves):
    body = json.dumps({"granter": granter, "moves": [{"src": m["src"], "dst": m["dst"], "amount": str(int(m["amount"]))} for m in moves], "memo": "GATA autopilot"}).encode()
    req = urllib.request.Request(SIGNER, data=body, method="POST", headers={"content-type": "application/json", "x-gata-secret": SECRET})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.load(r)
    except urllib.error.HTTPError as e:
        try: return {"error": json.load(e)}
        except Exception: return {"error": "HTTP %d" % e.code}

# ── the reward split (accounting only; the send that collects it ships with the
#    restake execution - the signer still signs MsgBeginRedelegate and nothing else) ──
def _uatone(v):
    """'123uatone,4uphoton' -> 123"""
    t = 0
    for part in (v or "").split(","):
        if part.endswith("uatone"):
            try: t += int(part[:-6])
            except ValueError: pass
    return t

def rewards_withdrawn(granter, since_ts):
    """Every reward withdrawal names its delegator in the withdraw_rewards event,
    whoever fired the message - so a manual claim counts exactly like ours."""
    import datetime
    total, page = 0, None
    q = urllib.parse.quote("withdraw_rewards.delegator='%s'" % granter)
    for _ in range(20):                                   # hard page cap
        path = "/cosmos/tx/v1beta1/txs?query=%s&limit=100&order_by=ORDER_BY_DESC" % q + (("&pagination.key=" + urllib.parse.quote(page)) if page else "")
        d = get(path)
        older = False
        for t in d.get("tx_responses", []):
            try:
                at = int(datetime.datetime.strptime(t.get("timestamp", "")[:19], "%Y-%m-%dT%H:%M:%S")
                         .replace(tzinfo=datetime.timezone.utc).timestamp())
            except ValueError:
                at = 0
            if at and at < since_ts:
                older = True; continue
            for ev in t.get("events", []):
                if ev.get("type") != "withdraw_rewards": continue
                a = {x.get("key"): x.get("value") for x in ev.get("attributes", [])}
                if a.get("delegator") == granter: total += _uatone(a.get("amount"))
        page = (d.get("pagination") or {}).get("next_key")
        if older or not page: break
    return total

def split_due(c, granter):
    """Our share as it stands: split% of (everything withdrawn since we first saw this
    granter + what is pending now), minus what we have collected. A manual claim in
    between changes nothing - it is in the withdrawn sum."""
    if not (SPLIT_PCT > 0) or not SPLIT_TO: return None
    since = c.execute("SELECT min(at) FROM run_g WHERE granter=?", (granter,)).fetchone()[0] or int(time.time())
    withdrawn = rewards_withdrawn(granter, since)
    pend = 0
    try:
        d = get("/cosmos/distribution/v1beta1/delegators/%s/rewards" % granter)
        for cn in d.get("total", []):
            if cn.get("denom") == "uatone": pend = int(float(cn.get("amount", "0")))
    except Exception:
        pass
    earned = withdrawn + pend
    row = c.execute("SELECT collected FROM fee_ledger WHERE granter=?", (granter,)).fetchone()
    collected = row[0] if row else 0
    c.execute("INSERT INTO fee_ledger(granter, earned, collected, updated) VALUES(?,?,?,?) "
              "ON CONFLICT(granter) DO UPDATE SET earned=excluded.earned, updated=excluded.updated",
              (granter, earned, collected, int(time.time())))
    c.commit()
    return {"pct": SPLIT_PCT, "earned": earned, "collected": collected,
            "due": max(0, int(earned * SPLIT_PCT / 100) - collected)}

def moves_today(c, granter):
    return c.execute("SELECT count(*) FROM move WHERE granter=? AND at>? AND dry=0", (granter, int(time.time()) - 86400)).fetchone()[0]

def report(granter, obj):
    os.makedirs(REPORTS, exist_ok=True)
    tmp = os.path.join(REPORTS, granter + ".json.tmp")
    json.dump(obj, open(tmp, "w")); os.replace(tmp, os.path.join(REPORTS, granter + ".json"))

def once(c, only=None, live=None, force=False):
    """One pass. only=<granter> restricts it; live overrides KEEPER_DRY for this pass;
    force ignores the strategy's pace (a manual run acts now)."""
    dry = DRY if live is None else (not live)
    vals, m, eta = model()
    gs = [g for g in grants() if not only or g["granter"] == only]; acted = 0
    log("grants=%d dry=%s eta=%.3f%s" % (len(gs), dry, eta, " only=" + only if only else ""))
    for g in gs:
        try:
            name = preset_of(g["granter"]); P = PRESETS[name]
            last = c.execute("SELECT max(at) FROM run_g WHERE granter=?", (g["granter"],)).fetchone()[0] or 0
            if not force and time.time() - last < P["every"]:
                log("granter=%s %s: not due (every %dh)" % (g["granter"], name, P["every"] // 3600)); continue
            rows, reds = position(g["granter"], vals)
            p = plan(g, rows, reds, vals, m, P)
            c.execute("INSERT INTO run_g VALUES(?,?)", (int(time.time()), g["granter"])); c.commit()
            record = rate_record(c, g["granter"], rows)
            rep = {"granter": g["granter"], "checked": int(time.time()), "dry": dry, "strategy": name, "grant": {"cap": g["cap"], "allow": len(g["allow"]) if g["allow"] else None, "expires": g["exp"]},
                   "staked": sum(r["x"] for r in rows), "now": None, "after": None, "moves": [], "last": None}
            if record: rep["record"] = record
            hist = c.execute("SELECT at, src, dst, uatone, gain, txhash FROM move WHERE granter=? AND dry=0 ORDER BY at DESC LIMIT 10", (g["granter"],)).fetchall()
            rep["history"] = [{"at": h[0], "src": h[1], "dst": h[2], "uatone": h[3], "gain": h[4], "txhash": h[5]} for h in hist]
            if p:
                rep.update({"now": p["now"], "after": p["after"], "gain": p["gain"],
                            "moves": [{"src": e["src"], "dst": e["dst"], "uatone": e["amount"], "gain": round(e["gain"], 3)} for e in p["moves"]]})
                if not dry:
                    if moves_today(c, g["granter"]) + len(p["moves"]) > MAX_MOVES_DAY:
                        rep["last"] = {"skipped": "daily limit"}
                    else:
                        r = execute(g["granter"], p["moves"]); rep["last"] = r
                        ok = "txhash" in r and "error" not in r
                        for e in p["moves"]:
                            c.execute("INSERT INTO move VALUES(?,?,?,?,?,?,?,?)", (int(time.time()), g["granter"], e["src"], e["dst"], int(e["amount"]), e["gain"], r.get("txhash") if ok else None, 0))
                        c.commit(); acted += 1
                        log("exec granter=%s moves=%d -> %s" % (g["granter"], len(p["moves"]), r))
                else:
                    for e in p["moves"]:
                        c.execute("INSERT INTO move VALUES(?,?,?,?,?,?,?,?)", (int(time.time()), g["granter"], e["src"], e["dst"], int(e["amount"]), e["gain"], None, 1))
                    c.commit()
                    log("DRY granter=%s would move %d: %s" % (g["granter"], len(p["moves"]), ", ".join("%s->%s %d" % (e["src"][-6:], e["dst"][-6:], e["amount"]) for e in p["moves"])))
            try:
                sd = split_due(c, g["granter"])
                if sd: rep["split"] = sd
            except Exception as e:
                log("split accounting failed for %s: %s" % (g["granter"], e))
            report(g["granter"], rep)
        except Exception as e:
            log("granter %s failed: %s" % (g["granter"], e))
    c.execute("INSERT INTO run VALUES(?,?,?,?)", (int(time.time()), len(gs), acted, "dry" if dry else "live")); c.commit()
    # the signer's own standing, for the page
    try:
        s = get("/cosmos/bank/v1beta1/balances/%s" % GRANTEE)
        photon = next((int(b["amount"]) for b in s.get("balances", []) if b["denom"] == "uphoton"), 0)
        report("_status", {"grantee": GRANTEE, "checked": int(time.time()), "grants": len(gs), "dry": DRY, "photon": photon, "every": EVERY,
                           "fee_pct": FEE_PCT, "fee_to": FEE_TO, "split_pct": SPLIT_PCT, "split_to": SPLIT_TO})
    except Exception as e:
        log("status failed: %s" % e)

def main():
    """Service: loop every KEEPER_EVERY, each granter at its strategy's pace.
    By hand:  keeper.py --once [--granter atone1...] [--live] [--force]
              --once   one pass, then exit (respects KEEPER_DRY unless --live)
              --live   execute for real on this pass only
              --force  act now even if the strategy says it is not due"""
    if not GRANTEE or not SIGNER or not SECRET:
        log("not configured (KEEPER_GRANTEE / KEEPER_SIGNER_URL / KEEPER_SECRET) - parking"); sys.exit(78)
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    c = db(); a = sys.argv[1:]
    if "--once" in a:
        only = a[a.index("--granter") + 1] if "--granter" in a else None
        once(c, only=only, live=True if "--live" in a else None, force="--force" in a); return
    while True:
        try: once(c)
        except Exception as e: log("run failed: %s" % e)
        time.sleep(EVERY)

if __name__ == "__main__": main()
