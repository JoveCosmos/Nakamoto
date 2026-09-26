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
# restake: claim a granter's rewards and stake them back onto their allow-list. Planned and
# reported always; executed only with KEEPER_RESTAKE=1 AND KEEPER_DRY=0
RESTAKE = os.environ.get("KEEPER_RESTAKE", "0") == "1"
MIN_RESTAKE = float(os.environ.get("KEEPER_MIN_RESTAKE_ATONE", "1"))       # skip while rewards are below this
MAX_CLAIM = int(os.environ.get("KEEPER_MAX_CLAIM", "18"))                  # validators claimed in one transaction (the signer takes 20 messages)
RESTAKE_URL = os.environ.get("KEEPER_RESTAKE_URL", "") or (SIGNER.rsplit("/", 1)[0] + "/authz-restake" if SIGNER else "")
WDRAW_URL = "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward"
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
    c.execute("CREATE TABLE IF NOT EXISTS restake(at INT, granter TEXT, rewards INT, staked INT, sent INT, target TEXT, txhash TEXT, dry INT)")
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
    "passive":    {"every": 7 * 86400, "min_apr": 0.015, "min_atone": 5.0, "dests": 2, "d90": 99, "restake_every": 7 * 86400},
    "moderate":   {"every": 6 * 3600,  "min_apr": 0.005, "min_atone": 1.0, "dests": 5, "d90": 50, "restake_every": 86400},
    "aggressive": {"every": 3600,      "min_apr": 0.0025, "min_atone": 0.5, "dests": 8, "d90": 50, "restake_every": 12 * 3600},
    "picks":      {"every": 6 * 3600,  "min_apr": 0.005, "min_atone": 1.0, "dests": 5, "d90": 0, "restake_every": 86400},
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

# ── restake ────────────────────────────────────────────────────────────────
LEDGER = os.environ.get("KEEPER_LEDGER", "/srv/atomone-app/state/grants-mainnet.json")
def paused():
    """delegators the operator paused in the admin console (grantwatch's ledger)"""
    try: return {k for k, v in json.load(open(LEDGER)).get("grants", {}).items() if v.get("paused")}
    except Exception: return set()

def restake_grants():
    """granter -> what they let us do with rewards: claim (a GenericAuthorization for
    MsgWithdrawDelegatorReward), stake (StakeAuthorization DELEGATE: allow-list, what is left
    of its cap) and send (SendAuthorization: what is left of its limit, for the split)"""
    out, key, now = {}, None, time.gmtime()
    while True:
        d = get("/cosmos/authz/v1beta1/grants/grantee/%s?pagination.limit=200" % GRANTEE + ("&pagination.key=%s" % urllib.parse.quote(key) if key else ""))
        for g in d.get("grants", []):
            exp = g.get("expiration")
            if exp and time.strptime(exp[:19], "%Y-%m-%dT%H:%M:%S") < now: continue
            a, r = g.get("authorization", {}), out.setdefault(g["granter"], {})
            t = a.get("@type")
            if t == "/cosmos.authz.v1beta1.GenericAuthorization" and a.get("msg") == WDRAW_URL:
                r["claim"] = True
            elif t == "/cosmos.staking.v1beta1.StakeAuthorization" and a.get("authorization_type") == "AUTHORIZATION_TYPE_DELEGATE":
                cap = a.get("max_tokens")
                r["stake"] = {"allow": (a.get("allow_list") or {}).get("address") or [],
                              "cap": int(cap["amount"]) if cap and cap.get("denom") == "uatone" else None}
            elif t == "/cosmos.bank.v1beta1.SendAuthorization":
                r["send"] = sum(int(x["amount"]) for x in a.get("spend_limit", []) if x.get("denom") == "uatone")
        key = d.get("pagination", {}).get("next_key")
        if not key: break
    return {k: v for k, v in out.items() if v.get("claim") and v.get("stake")}

def others_claiming(granter):
    """validators another service already restakes for this granter. On AtomOne a restake
    bot (REStake and the like) needs only a StakeAuthorization DELEGATE allow-listed to its
    validator: delegating to a validator first pays that validator's pending rewards out, so
    'delegate the pending amount' restakes them. If we claimed first, such a bot would stake
    that amount out of the granter's liquid ATONE - so those validators are left to it.
    None = another service may claim or delegate without naming validators: stay out."""
    d = get("/cosmos/authz/v1beta1/grants/granter/%s?pagination.limit=200" % granter)
    ops, who, now = set(), set(), time.gmtime()
    for g in d.get("grants", []):
        if g.get("grantee") == GRANTEE: continue
        exp = g.get("expiration")
        if exp and time.strptime(exp[:19], "%Y-%m-%dT%H:%M:%S") < now: continue
        a = g.get("authorization", {})
        if a.get("@type") == "/cosmos.authz.v1beta1.GenericAuthorization" and a.get("msg") in (WDRAW_URL, "/cosmos.staking.v1beta1.MsgDelegate"):
            return None, sorted(who | {g["grantee"]})
        if a.get("@type") == "/cosmos.staking.v1beta1.StakeAuthorization" and a.get("authorization_type") == "AUTHORIZATION_TYPE_DELEGATE":
            allow = (a.get("allow_list") or {}).get("address") or []
            if not allow: return None, sorted(who | {g["grantee"]})
            ops |= set(allow); who.add(g["grantee"])
    return ops, sorted(who)

def plan_restake(c, granter, rg, vals, m, P):  # noqa: C901
    """what a restake would do now: claim every reward we may (not those another service
    claims), stake it on the best validator of the DELEGATE allow-list, less the split"""
    last = c.execute("SELECT max(at) FROM restake WHERE granter=?", (granter,)).fetchone()[0] or 0
    if time.time() - last < P.get("restake_every", 86400): return {"skip": "not due"}
    wa = get("/cosmos/distribution/v1beta1/delegators/%s/withdraw_address" % granter).get("withdraw_address")
    if wa != granter: return {"skip": "rewards are paid to another address"}
    cov, who = others_claiming(granter)
    if cov is None: return {"skip": "another service claims these rewards", "others": who}
    # the largest rewards first, at most MAX_CLAIM validators a transaction, and no more than
    # the DELEGATE cap can take back in: what is claimed is all staked, nothing left idle
    pend = []
    for r in get("/cosmos/distribution/v1beta1/delegators/%s/rewards" % granter).get("rewards", []):
        v = r["validator_address"]
        amt = sum(int(float(x["amount"])) for x in r.get("reward", []) if x.get("denom") == "uatone")
        if amt > 0 and v not in cov: pend.append((amt, v))
    pend.sort(reverse=True)
    cap = rg["stake"]["cap"]
    rewards, claim = 0, []
    for amt, v in pend:
        if len(claim) >= MAX_CLAIM: break
        if cap is not None and claim and rewards + amt > cap: continue
        rewards += amt; claim.append(v)
    out = {"rewards": rewards, "pending_all": sum(a for a, _ in pend), "others": who, "covered": sorted(cov)}
    if rewards < MIN_RESTAKE * 1e6: out["skip"] = "below %g ATONE" % MIN_RESTAKE; return out
    send = 0
    if SPLIT_PCT > 0 and SPLIT_TO and rg.get("send"):
        sd = split_due(c, granter) or {}
        send = min(sd.get("due", 0), rewards, rg["send"])
    stake = rewards - send
    if cap is not None and stake > cap: out["skip"] = "delegate cap used up"; return out
    best, br = None, -1
    for op in rg["stake"]["allow"]:
        v = vals.get(op)
        if not v or v["tomb"] or (P["d90"] and (v["d90"] is None or v["d90"] < P["d90"])): continue
        rt = rate_after(m, v["t"], v["c"], stake)
        if rt > br: best, br = op, rt
    if not best or stake <= 0: out["skip"] = "no allowed validator to stake on" if not best else "delegate cap used up"; return out
    out.update({"claim": claim, "stake": [{"validator": best, "amount": int(stake)}], "send": int(send), "rate": br,
                "fee_uphoton": int((120000 + 60000 * (len(claim) + 2)) * 0.25)})
    return out

def execute_restake(granter, p):
    body = {"granter": granter, "claim": p["claim"], "stake": [{"validator": s["validator"], "amount": str(s["amount"])} for s in p["stake"]], "memo": "GATA autopilot restake"}
    if p.get("send"): body["send"] = str(p["send"])
    req = urllib.request.Request(RESTAKE_URL, data=json.dumps(body).encode(), method="POST", headers={"content-type": "application/json", "x-gata-secret": SECRET})
    try:
        with urllib.request.urlopen(req, timeout=120) as r: return json.load(r)
    except urllib.error.HTTPError as e:
        try: return {"error": json.load(e)}
        except Exception: return {"error": "HTTP %d" % e.code}

def restake_step(c, granter, rgs, vals, m, P, dry):
    """plan, execute when allowed, record; returns what the report shows"""
    rg = rgs.get(granter)
    if not rg: return None
    try:
        p = plan_restake(c, granter, rg, vals, m, P)
    except Exception as e:
        return {"error": str(e)[:200]}
    live = RESTAKE and not dry
    if "claim" in p:
        amt = sum(s["amount"] for s in p["stake"])
        if live:
            r = execute_restake(granter, p); p["result"] = r
            ok = "txhash" in r and "error" not in r
            c.execute("INSERT INTO restake VALUES(?,?,?,?,?,?,?,?)", (int(time.time()), granter, p["rewards"], amt, p["send"], p["stake"][0]["validator"], r.get("txhash") if ok else None, 0))
            if ok and p["send"]:
                c.execute("UPDATE fee_ledger SET collected=collected+? WHERE granter=?", (p["send"], granter))
            c.commit()
            log("restake granter=%s rewards=%d staked=%d sent=%d -> %s" % (granter, p["rewards"], amt, p["send"], r))
        else:
            log("DRY restake granter=%s would claim %d from %d validators, stake %d on %s, send %d" % (granter, p["rewards"], len(p["claim"]), amt, p["stake"][0]["validator"][-6:], p["send"]))
    done = c.execute("SELECT count(*), coalesce(sum(staked), 0), max(at) FROM restake WHERE granter=? AND dry=0 AND txhash IS NOT NULL", (granter,)).fetchone()
    p.update({"live": live, "count": done[0], "total": done[1], "last_at": done[2]})
    return p

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
    try: rgs = restake_grants()
    except Exception as e: rgs = {}; log("restake grants unreadable: %s" % e)
    log("grants=%d dry=%s eta=%.3f%s" % (len(gs), dry, eta, " only=" + only if only else ""))
    for g in gs:
        try:
            if g["granter"] in paused():
                log("granter=%s paused in the admin console: skipped" % g["granter"]); continue
            name = preset_of(g["granter"]); P = PRESETS[name]
            last = c.execute("SELECT max(at) FROM run_g WHERE granter=?", (g["granter"],)).fetchone()[0] or 0
            if not force and time.time() - last < P["every"]:
                log("granter=%s %s: not due (every %dh)" % (g["granter"], name, P["every"] // 3600)); continue
            rows, reds = position(g["granter"], vals)
            p = plan(g, rows, reds, vals, m, P)
            c.execute("INSERT INTO run_g VALUES(?,?)", (int(time.time()), g["granter"])); c.commit()
            record = rate_record(c, g["granter"], rows)
            # restake before the moves: a redelegation pays its source's rewards out on its own,
            # and the signer only restakes rewards still pending
            rs = restake_step(c, g["granter"], rgs, vals, m, P, dry)
            rep = {"granter": g["granter"], "checked": int(time.time()), "dry": dry, "strategy": name, "grant": {"cap": g["cap"], "allow": len(g["allow"]) if g["allow"] else None, "expires": g["exp"]},
                   "staked": sum(r["x"] for r in rows), "now": None, "after": None, "moves": [], "last": None}
            if record: rep["record"] = record
            if rs: rep["restake"] = rs
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
